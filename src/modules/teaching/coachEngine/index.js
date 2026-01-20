/**
 * Coach Engine - Main Entry Point
 *
 * Unified system for proactive observations and suggestions.
 * Aggregates detection from existing analyzers, prioritizes findings,
 * and routes them to appropriate presentation (nudges, panels, modal).
 *
 * Three tiers of presentation:
 * - Tier 1: Floating nudges (automatic, lightweight)
 * - Tier 2: Panel highlights (Theory, Borrowed, Voice Leading)
 * - Tier 3: Modal deep links (Unified Recommendation Modal)
 */

import {
    COACH_ITEM_TYPES,
    COACH_CATEGORIES,
    OBSERVATION_TYPES,
    SUGGESTION_TYPES,
    OPPORTUNITY_TYPES,
    getCoachItemType
} from './types.js';

// Import detectors, generators, and scanners
import { detectAllObservations } from './detectors/index.js';
import { generateAllSuggestions } from './generators/index.js';
import { scanForAllOpportunities } from './scanners/index.js';

// Import presenter
import { FloatingNudgePresenter } from './presenters/index.js';

// Import Experience Mode state
import { getExperienceMode } from '../../state/globalState.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY_PREFERENCES = 'coachEnginePreferences';
const STORAGE_KEY_HISTORY = 'coachEngineHistory';

/**
 * Timing configuration
 */
const TIMING = {
    DEBOUNCE_AFTER_EDIT: 2000,      // Wait 2s after last edit
    MIN_BETWEEN_ANY: 8000,          // 8s between any nudges
    MIN_BETWEEN_SAME_TYPE: 60000,   // 60s between same type (default)
    MAX_QUEUE_SIZE: 10,             // Max items in queue
    MAX_VISIBLE_NUDGES: 2,          // Max nudges shown at once
    AUTO_HIDE_DELAY: 8000,          // Auto-hide after 8s
    HISTORY_RETENTION: 3600000      // Keep history for 1 hour
};

/**
 * Priority modifiers
 */
const PRIORITY_MODIFIERS = {
    FIRST_TIME: 20,           // First time seeing this type
    RARE_PATTERN: 15,         // Uncommon harmonic event
    IN_CONTEXT: 10,           // Relevant to current work
    RECENTLY_SHOWN: -30,      // Same type shown recently
    USER_DISMISSED: -50,      // User dismissed this type before
    SUGGESTION_BOOST: 5       // Slight boost for suggestions (equal weight)
};

// ============================================================================
// COACH ENGINE CLASS
// ============================================================================

class CoachEngine {
    constructor() {
        // State
        this.queue = [];
        this.history = [];
        this.cooldowns = new Map();
        this.visibleNudges = [];

        // Preferences
        this.enabled = true;
        this.skillLevel = 'intermediate'; // simple, intermediate, advanced
        this.dismissedTypes = new Set();
        this.enabledCategories = new Set(Object.values(COACH_CATEGORIES));

        // Debounce timer
        this._debounceTimer = null;
        this._lastNudgeTime = 0;

        // Event handlers (bound for removal)
        this._boundHandlers = {
            chordAdded: this._onChordAdded.bind(this),
            chordRemoved: this._onChordRemoved.bind(this),
            chordUpdated: this._onChordUpdated.bind(this),
            progressionChanged: this._onProgressionChanged.bind(this),
            noteEdited: this._onNoteEdited.bind(this),
            measureCompleted: this._onMeasureCompleted.bind(this),
            experienceModeChanged: this._onExperienceModeChanged.bind(this)
        };

        // Detectors (will be populated by registerDetector)
        this._detectors = [];

        // Presenter (will be set by setPresenter)
        this._presenter = null;

        // Load saved state
        this._loadPreferences();
        this._loadHistory();
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Initialize the coach engine and start listening for events
     */
    init() {
        // Attach event listeners
        window.addEventListener('chordAddedForTheory', this._boundHandlers.chordAdded);
        window.addEventListener('chordRemoved', this._boundHandlers.chordRemoved);
        window.addEventListener('chordUpdated', this._boundHandlers.chordUpdated);
        window.addEventListener('progressionUpdated', this._boundHandlers.progressionChanged);
        window.addEventListener('chordsChanged', this._boundHandlers.progressionChanged);
        window.addEventListener('noteEdited', this._boundHandlers.noteEdited);

        // Listen for Experience Mode changes
        window.addEventListener('experienceModeChanged', this._boundHandlers.experienceModeChanged);

        // Sync enabled state with current Experience Mode
        // Coach is disabled in Focus mode, enabled in Guided/Explore modes
        this._syncWithExperienceMode();

        // Expose global functions for debugging/testing
        window.coachEngine = this;
        window.triggerCoachAnalysis = () => this.analyzeCurrentComposition();
    }

    /**
     * Shut down the coach engine
     */
    destroy() {
        // Remove event listeners
        window.removeEventListener('chordAddedForTheory', this._boundHandlers.chordAdded);
        window.removeEventListener('chordRemoved', this._boundHandlers.chordRemoved);
        window.removeEventListener('chordUpdated', this._boundHandlers.chordUpdated);
        window.removeEventListener('progressionUpdated', this._boundHandlers.progressionChanged);
        window.removeEventListener('chordsChanged', this._boundHandlers.progressionChanged);
        window.removeEventListener('noteEdited', this._boundHandlers.noteEdited);
        window.removeEventListener('experienceModeChanged', this._boundHandlers.experienceModeChanged);

        // Clear timers
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }

        // Save state
        this._savePreferences();
        this._saveHistory();
    }

    /**
     * Register a detector function
     * @param {Function} detector - Function that takes context and returns coach items
     */
    registerDetector(detector) {
        this._detectors.push(detector);
    }

    /**
     * Set the presenter for displaying nudges
     * @param {Object} presenter - Presenter with show(), hide(), update() methods
     */
    setPresenter(presenter) {
        this._presenter = presenter;
    }

    /**
     * Enable/disable the coach engine
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        this._savePreferences();
    }

    /**
     * Set skill level for message complexity
     * @param {string} level - 'simple', 'intermediate', or 'advanced'
     */
    setSkillLevel(level) {
        if (['simple', 'intermediate', 'advanced'].includes(level)) {
            this.skillLevel = level;
            this._savePreferences();
        }
    }

    /**
     * Dismiss a coach item type permanently
     * @param {string} typeId - Coach item type ID
     */
    dismissType(typeId) {
        this.dismissedTypes.add(typeId);
        this._savePreferences();
    }

    /**
     * Re-enable a dismissed type
     * @param {string} typeId - Coach item type ID
     */
    undismissType(typeId) {
        this.dismissedTypes.delete(typeId);
        this._savePreferences();
    }

    /**
     * Enable/disable a category
     * @param {string} category - COACH_CATEGORIES value
     * @param {boolean} enabled
     */
    setCategoryEnabled(category, enabled) {
        if (enabled) {
            this.enabledCategories.add(category);
        } else {
            this.enabledCategories.delete(category);
        }
        this._savePreferences();
    }

    /**
     * Manually trigger analysis of current composition
     * Useful for testing or when user explicitly requests analysis
     * @param {boolean} clearCooldowns - If true, clears all cooldowns first (for manual "Analyze" button)
     */
    analyzeCurrentComposition(clearCooldowns = true) {
        // Don't run analysis if coach is disabled (Focus mode)
        if (!this.enabled) {
            return;
        }

        // When user manually clicks "Analyze", they want to see results regardless of cooldowns
        if (clearCooldowns) {
            this.cooldowns.clear();
            this._lastNudgeTime = 0;
        }

        const context = this._buildContext();
        if (context) {
            this._runAnalysis(context);
        } else {
            // No context (e.g., progression cleared or < 2 chords) - clear badges
            if (window.updateMeasureCoachItems) {
                window.updateMeasureCoachItems([]);
            }
        }
    }

    /**
     * Get current queue of pending coach items
     * @returns {Array} Pending items
     */
    getQueue() {
        return [...this.queue];
    }

    /**
     * Get recent history of shown items
     * @returns {Array} History items
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Get items that should be highlighted in a specific panel
     * @param {string} panelId - Panel identifier
     * @returns {Array} Items for that panel
     */
    getHighlightsForPanel(panelId) {
        const recentItems = this.history.filter(item =>
            Date.now() - item.timestamp < 60000 && // Last 60 seconds
            item.actions?.explorePanel === panelId
        );
        return recentItems;
    }

    /**
     * Clear all history and reset cooldowns
     */
    reset() {
        this.queue = [];
        this.history = [];
        this.cooldowns.clear();
        this._lastNudgeTime = 0;
        this._saveHistory();
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    _onChordAdded(event) {
        if (!this.enabled) return;
        this._scheduleAnalysis('chordAdded', event.detail);
    }

    _onChordRemoved(event) {
        if (!this.enabled) return;
        this._scheduleAnalysis('chordRemoved', event.detail);
    }

    _onChordUpdated(event) {
        if (!this.enabled) return;
        this._scheduleAnalysis('chordUpdated', event.detail);
    }

    _onProgressionChanged(event) {
        if (!this.enabled) return;
        this._scheduleAnalysis('progressionChanged', event.detail);
    }

    _onNoteEdited(event) {
        if (!this.enabled) return;
        this._scheduleAnalysis('noteEdited', event.detail);
    }

    _onMeasureCompleted(event) {
        if (!this.enabled) return;
        this._scheduleAnalysis('measureCompleted', event.detail);
    }

    /**
     * Handle Experience Mode changes
     * Coach is disabled in Focus mode, enabled in Guided/Explore modes
     */
    _onExperienceModeChanged(event) {
        console.log('[CoachEngine] experienceModeChanged event received:', event.detail);
        this._syncWithExperienceMode();
    }

    /**
     * Sync coach enabled state with current Experience Mode
     * Focus mode = disabled, Guided/Explore = enabled
     */
    _syncWithExperienceMode() {
        const mode = getExperienceMode?.() || 'guided';
        const shouldBeEnabled = mode !== 'focus';

        const wasEnabled = this.enabled;
        this.enabled = shouldBeEnabled;

        if (wasEnabled !== shouldBeEnabled) {
            if (!shouldBeEnabled) {
                // Switching to focus mode - clear any visible badges/nudges
                if (window.updateMeasureCoachItems) {
                    window.updateMeasureCoachItems([]);
                }
            } else {
                // Switching back to Guided/Explore - re-run analysis to show badges
                this.analyzeCurrentComposition();
            }
        }
    }

    // ========================================================================
    // ANALYSIS PIPELINE
    // ========================================================================

    /**
     * Schedule analysis with debouncing
     */
    _scheduleAnalysis(eventType, eventDetail) {
        // Clear existing timer
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }

        // Schedule new analysis
        this._debounceTimer = setTimeout(() => {
            const context = this._buildContext(eventType, eventDetail);
            if (context) {
                this._runAnalysis(context);
            } else {
                // No context (e.g., progression cleared or < 2 chords) - clear badges
                if (window.updateMeasureCoachItems) {
                    window.updateMeasureCoachItems([]);
                }
            }
        }, TIMING.DEBOUNCE_AFTER_EDIT);
    }

    /**
     * Build context object for analysis
     */
    _buildContext(eventType = null, eventDetail = null) {
        // Get composition state
        const compState = window.getCompositionState?.();
        if (!compState) {
            console.warn('[CoachEngine] No composition state available');
            return null;
        }

        // Get progression data
        const progressionData = compState.exportToProgressionData?.() || [];
        if (progressionData.length < 2) {
            // Need at least 2 chords for meaningful analysis
            return null;
        }

        // Get settings
        const settings = compState.getSettings?.() || {};
        const key = compState.metadata?.key || settings.key || 'C';
        const mode = settings.mode || 'major';

        // Get trainer state for additional context
        const trainerState = window.getTrainerState?.();

        return {
            eventType,
            eventDetail,
            progression: progressionData,
            key,
            mode,
            chordCount: progressionData.length,
            compState,
            trainerState,
            timestamp: Date.now()
        };
    }

    /**
     * Run all detectors and process results
     */
    _runAnalysis(context) {
        const allItems = [];

        // Run registered detectors
        for (const detector of this._detectors) {
            try {
                const items = detector(context);
                if (items && items.length > 0) {
                    allItems.push(...items);
                }
            } catch (error) {
                console.error('[CoachEngine] Detector error:', error);
            }
        }

        // Filter, prioritize, and queue
        const filtered = this._filterItems(allItems);
        const prioritized = this._prioritizeItems(filtered);
        this._queueItems(prioritized);

        // Update measure coach items for notation overlay icons
        // Pass ALL detected items (not just filtered) so the icons show everything
        if (window.updateMeasureCoachItems) {
            window.updateMeasureCoachItems(allItems);
        }

        // Process queue
        this._processQueue();
    }

    /**
     * Filter items based on cooldowns, preferences, and category
     */
    _filterItems(items) {
        return items.filter(item => {
            // Check if type is dismissed
            if (this.dismissedTypes.has(item.id)) {
                return false;
            }

            // Check if category is enabled
            if (!this.enabledCategories.has(item.category)) {
                return false;
            }

            // Check cooldown
            if (this._isOnCooldown(item.id)) {
                return false;
            }

            return true;
        });
    }

    /**
     * Calculate priority scores and sort
     */
    _prioritizeItems(items) {
        return items
            .map(item => ({
                ...item,
                score: this._calculatePriority(item)
            }))
            .filter(item => item.score > 30) // Minimum threshold
            .sort((a, b) => b.score - a.score)
            .slice(0, TIMING.MAX_QUEUE_SIZE);
    }

    /**
     * Calculate priority score for an item
     */
    _calculatePriority(item) {
        let score = item.priority || 50;

        // First time seeing this type?
        const hasSeenBefore = this.history.some(h => h.id === item.id);
        if (!hasSeenBefore) {
            score += PRIORITY_MODIFIERS.FIRST_TIME;
        }

        // Recently shown same type?
        const recentSameType = this.history.filter(h =>
            h.id === item.id &&
            Date.now() - h.timestamp < 300000 // 5 minutes
        );
        if (recentSameType.length > 0) {
            score += PRIORITY_MODIFIERS.RECENTLY_SHOWN;
        }

        // Boost suggestions to equal weight with observations
        if (item.type === COACH_ITEM_TYPES.SUGGESTION) {
            score += PRIORITY_MODIFIERS.SUGGESTION_BOOST;
        }

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Add items to the queue
     */
    _queueItems(items) {
        for (const item of items) {
            // Check if already in queue
            const existsInQueue = this.queue.some(q => q.id === item.id);
            if (!existsInQueue) {
                this.queue.push({
                    ...item,
                    timestamp: Date.now()
                });
            }
        }

        // Trim queue to max size
        if (this.queue.length > TIMING.MAX_QUEUE_SIZE) {
            this.queue = this.queue.slice(0, TIMING.MAX_QUEUE_SIZE);
        }
    }

    /**
     * Process the queue and show nudges
     */
    _processQueue() {
        // Check if we can show a nudge
        const now = Date.now();
        if (now - this._lastNudgeTime < TIMING.MIN_BETWEEN_ANY) {
            return;
        }

        // Check if we have room for more nudges
        if (this.visibleNudges.length >= TIMING.MAX_VISIBLE_NUDGES) {
            return;
        }

        // Get next item from queue
        if (this.queue.length === 0) {
            return;
        }

        const item = this.queue.shift();

        // Set cooldown
        const cooldown = item.cooldown || TIMING.MIN_BETWEEN_SAME_TYPE;
        this._setCooldown(item.id, cooldown);

        // Add to history
        this.history.push({
            ...item,
            shownAt: now
        });
        this._trimHistory();
        this._saveHistory();

        // Show the nudge
        this._showNudge(item);
        this._lastNudgeTime = now;
    }

    // ========================================================================
    // COOLDOWN MANAGEMENT
    // ========================================================================

    _isOnCooldown(typeId) {
        const expiry = this.cooldowns.get(typeId);
        if (!expiry) return false;
        return Date.now() < expiry;
    }

    _setCooldown(typeId, duration) {
        this.cooldowns.set(typeId, Date.now() + duration);
    }

    _clearCooldown(typeId) {
        this.cooldowns.delete(typeId);
    }

    // ========================================================================
    // PRESENTATION
    // ========================================================================

    /**
     * Show a nudge using the presenter
     * NOTE: Automatic floating nudges are disabled - coach is accessed via measure compass icons
     */
    _showNudge(item) {
        // DISABLED: Automatic floating nudges
        // Coach insights are now accessed only through measure compass icons
        // The items are still tracked in history and displayed via the notation overlay
        return;

        // Original code preserved for reference:
        /*
        if (!this._presenter) {
            console.warn('[CoachEngine] No presenter set, cannot show nudge');
            return;
        }

        // Build display item with skill-appropriate message
        const displayItem = this._buildDisplayItem(item);

        // Track visible nudge
        const nudgeId = `nudge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.visibleNudges.push(nudgeId);

        // Show via presenter
        this._presenter.show(displayItem, nudgeId, {
            onDismiss: () => this._onNudgeDismissed(nudgeId),
            onAction: (action) => this._onNudgeAction(item, action),
            onExpire: () => this._onNudgeExpired(nudgeId)
        });

        console.log('[CoachEngine] Showing nudge:', item.id, item.title);
        */
    }

    /**
     * Build display item with appropriate message for skill level
     */
    _buildDisplayItem(item) {
        const typeDef = getCoachItemType(item.id) || item;

        // Preserve the full message object (with all skill levels) for runtime switching
        // The presenter will select the appropriate message based on its current skill level
        let messageObj = typeDef.message || item.message || {};

        // If message is a string (legacy), convert to object
        if (typeof messageObj === 'string') {
            messageObj = {
                simple: messageObj,
                intermediate: messageObj,
                advanced: messageObj
            };
        }

        // Interpolate template variables into ALL skill level messages
        if (item.data && typeof messageObj === 'object') {
            const interpolatedMessages = {};
            for (const level of ['simple', 'intermediate', 'advanced']) {
                if (messageObj[level]) {
                    interpolatedMessages[level] = this._interpolateMessage(messageObj[level], item.data);
                }
            }
            messageObj = interpolatedMessages;
        }

        return {
            ...item,
            message: messageObj,  // Keep as object with all skill levels
            emoji: typeDef.emoji || '💡',
            title: typeDef.title || item.title || 'Tip',
            actions: typeDef.actions || item.actions || {},
            skillLevel: this.skillLevel
        };
    }

    /**
     * Interpolate template variables in message
     */
    _interpolateMessage(template, data) {
        if (!template || !data) return template;

        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] !== undefined ? data[key] : match;
        });
    }

    _onNudgeDismissed(nudgeId) {
        this.visibleNudges = this.visibleNudges.filter(id => id !== nudgeId);
        // Process queue in case more items are waiting
        setTimeout(() => this._processQueue(), 500);
    }

    _onNudgeExpired(nudgeId) {
        this.visibleNudges = this.visibleNudges.filter(id => id !== nudgeId);
        // Process queue in case more items are waiting
        setTimeout(() => this._processQueue(), 500);
    }

    _onNudgeAction(item, action) {
        switch (action) {
            case 'learnMore':
                if (item.actions?.learnMore) {
                    window.openLesson?.(item.actions.learnMore);
                }
                break;

            case 'explorePanel':
                if (item.actions?.explorePanel) {
                    this._openPanel(item.actions.explorePanel);
                }
                break;

            case 'deepDive':
                if (item.actions?.deepDive) {
                    this._openModal(item.actions.deepDive, item);
                }
                break;

            case 'preview':
                this._previewItem(item);
                break;

            case 'apply':
                this._applyItem(item);
                break;

            case 'compare':
                this._openModal({ tab: 'chord', intent: 'compare' }, item);
                break;

            case 'dismiss':
                this.dismissType(item.id);
                break;
        }
    }

    _openPanel(panelId) {
        // Open the appropriate full-screen bottom panel
        const panelMap = {
            'theory': 'theory',
            'borrowed': 'borrowed',
            'voice-leading': 'voice-leading'
        };

        const targetPanel = panelMap[panelId];
        if (targetPanel && window.fullScreenEditor?.bottomPanel) {
            window.fullScreenEditor.bottomPanel.toggle(targetPanel);
        }
    }

    _openModal(config, item) {
        // Open Unified Recommendation Modal with context
        if (window.showUnifiedRecommendationModal) {
            window.showUnifiedRecommendationModal({
                initialTab: config.tab,
                initialIntent: config.intent,
                context: {
                    ...item.data,
                    fromCoach: true
                }
            });
        }
    }

    _previewItem(item) {
        // Preview the suggestion (play audio)
        // Implementation depends on item type
        // Will be handled by specific suggestion handlers
    }

    _applyItem(item) {
        // Apply the suggestion
        // Implementation depends on item type
        // Will be handled by specific suggestion handlers
    }

    // ========================================================================
    // PERSISTENCE
    // ========================================================================

    _loadPreferences() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_PREFERENCES);
            if (stored) {
                const prefs = JSON.parse(stored);
                // NOTE: Don't load `enabled` from preferences - it's controlled by Experience Mode
                // this.enabled is set by _syncWithExperienceMode() in init()
                this.skillLevel = prefs.skillLevel || 'intermediate';
                this.dismissedTypes = new Set(prefs.dismissedTypes || []);
                if (prefs.enabledCategories) {
                    this.enabledCategories = new Set(prefs.enabledCategories);
                }
            }
        } catch (e) {
            console.warn('[CoachEngine] Failed to load preferences:', e);
        }
    }

    _savePreferences() {
        try {
            // NOTE: Don't save `enabled` - it's controlled by Experience Mode, not user preference
            localStorage.setItem(STORAGE_KEY_PREFERENCES, JSON.stringify({
                skillLevel: this.skillLevel,
                dismissedTypes: Array.from(this.dismissedTypes),
                enabledCategories: Array.from(this.enabledCategories)
            }));
        } catch (e) {
            console.warn('[CoachEngine] Failed to save preferences:', e);
        }
    }

    _loadHistory() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
            if (stored) {
                const history = JSON.parse(stored);
                // Filter out old history
                this.history = history.filter(item =>
                    Date.now() - item.timestamp < TIMING.HISTORY_RETENTION
                );
            }
        } catch (e) {
            console.warn('[CoachEngine] Failed to load history:', e);
        }
    }

    _saveHistory() {
        try {
            // Only save recent history
            const recentHistory = this.history.filter(item =>
                Date.now() - item.timestamp < TIMING.HISTORY_RETENTION
            );
            localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(recentHistory));
        } catch (e) {
            console.warn('[CoachEngine] Failed to save history:', e);
        }
    }

    _trimHistory() {
        // Keep only recent history
        this.history = this.history.filter(item =>
            Date.now() - item.timestamp < TIMING.HISTORY_RETENTION
        );
        // Limit size
        if (this.history.length > 100) {
            this.history = this.history.slice(-100);
        }
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let coachEngineInstance = null;

/**
 * Get the coach engine singleton
 * @returns {CoachEngine}
 */
export function getCoachEngine() {
    if (!coachEngineInstance) {
        coachEngineInstance = new CoachEngine();
    }
    return coachEngineInstance;
}

/**
 * Initialize the coach engine with all detectors and presenter
 * Call this once during app startup
 */
export function initCoachEngine() {
    const engine = getCoachEngine();

    // Register all detectors
    engine.registerDetector(detectAllObservations);
    engine.registerDetector(generateAllSuggestions);
    engine.registerDetector(scanForAllOpportunities);

    // Create and set presenter
    const presenter = new FloatingNudgePresenter();
    engine.setPresenter(presenter);

    // Initialize engine (attach event listeners)
    engine.init();

    return engine;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export {
    COACH_ITEM_TYPES,
    COACH_CATEGORIES,
    OBSERVATION_TYPES,
    SUGGESTION_TYPES,
    OPPORTUNITY_TYPES,
    getCoachItemType
} from './types.js';
