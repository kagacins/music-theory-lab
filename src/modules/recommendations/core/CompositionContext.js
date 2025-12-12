/**
 * CompositionContext - Phase 5: Cross-Engine Coordination
 *
 * Shared state for all recommendation engines with lazy analysis computation
 * and change notification system. This is the central hub that all engines
 * read from and that coordinates updates across the system.
 *
 * Key responsibilities:
 * - Aggregate state from compositionState, trainerState, sectionIntentState
 * - Provide lazy-computed analysis (cached until invalidated)
 * - Notify registered engines when relevant state changes
 * - Track composition "fingerprint" for cache invalidation
 */

import { EventEmitter } from '../../utils/eventEmitter.js';
import { getCompositionState } from '../../state/compositionState.js';
import { getProgressionData, getCurrentKey } from '../../state/trainerState.js';
import {
    getSectionIntent,
    getEffectiveSectionContext,
    getInsertAfterIndex,
    INTENT_MODES,
    CONTINUE_SUBMODES
} from '../../state/sectionIntentState.js';
import { getHarmonyAnalyzer } from '../../analysis/harmonyAnalyzer.js';
import { getTensionArcPlanner } from '../../analysis/TensionArcPlanner.js';
import {
    analyzeRhythmicContext,
    HARMONIC_RHYTHM_TRENDS
} from '../../features/rhythmicContextAnalyzer.js';

/**
 * CompositionContext Class
 * Provides a unified view of the current composition state for all engines
 */
class CompositionContext extends EventEmitter {
    constructor() {
        super();

        // Cache for lazy-computed analysis
        this._analysisCache = {
            harmonyAnalysis: null,
            tensionAnalysis: null,
            patternAnalysis: null,
            fingerprint: null
        };

        // Analyzers (lazy-loaded)
        this._harmonyAnalyzer = null;
        this._tensionPlanner = null;

        // State snapshot
        this._snapshot = null;
        this._snapshotFingerprint = null;

        // Registered engine listeners
        this._engineListeners = new Map();

        // Debounce timer for batch updates
        this._updateTimer = null;
        this._pendingUpdate = false;

        // Track initialization
        this._isInitialized = false;

        // Rhythmic analysis cache (Phase 4)
        this._rhythmicCache = null;
        this._rhythmicCacheKey = null;
        this._rhythmAwarenessEnabled = localStorage.getItem('chord-suggestion-rhythm-awareness') !== 'false';
        this._currentStyle = localStorage.getItem('chord-suggestion-style') || 'pop';
    }

    /**
     * Initialize the context and set up event listeners
     */
    initialize() {
        if (this._isInitialized) return;

        this._setupEventListeners();
        this._isInitialized = true;

        // Take initial snapshot
        this.refresh();
    }

    /**
     * Set up listeners for all relevant state changes
     */
    _setupEventListeners() {
        const events = [
            'progressionUpdated',
            'keyChanged',
            'sectionCreated',
            'sectionUpdated',
            'sectionDeleted',
            'chordAddedToSection',
            'chordRemovedFromSection',
            'sectionsReordered',
            'sectionIntentChanged',
            'chordSelected',
            'chordCardSelected'
        ];

        events.forEach(eventName => {
            window.addEventListener(eventName, (e) => {
                this._scheduleUpdate(eventName, e.detail);
            });
        });

        // Listen for rhythm awareness setting changes (Phase 4)
        window.addEventListener('rhythmAwarenessChanged', (e) => {
            this._rhythmAwarenessEnabled = e.detail.enabled;
            this._invalidateRhythmicCache();
            this.emit('rhythmSettingChanged', e.detail);
        });

        // Listen for style changes that affect rhythm analysis
        window.addEventListener('chord-suggestion-preference-changed', (e) => {
            if (e.detail.style && e.detail.style !== this._currentStyle) {
                this._currentStyle = e.detail.style;
                this._invalidateRhythmicCache();
            }
        });
    }

    /**
     * Schedule a debounced update to batch rapid changes
     */
    _scheduleUpdate(eventName, detail) {
        this._pendingUpdate = true;

        if (this._updateTimer) {
            clearTimeout(this._updateTimer);
        }

        this._updateTimer = setTimeout(() => {
            this._performUpdate(eventName, detail);
        }, 16); // ~1 frame debounce
    }

    /**
     * Perform the actual update
     */
    _performUpdate(eventName, detail) {
        this._pendingUpdate = false;
        this._updateTimer = null;

        // Invalidate caches
        this._invalidateAnalysisCache();

        // Take new snapshot
        this.refresh();

        // Notify all registered engines
        this._notifyEngines(eventName, detail);
    }

    /**
     * Invalidate all cached analysis
     */
    _invalidateAnalysisCache() {
        this._analysisCache = {
            harmonyAnalysis: null,
            tensionAnalysis: null,
            patternAnalysis: null,
            fingerprint: null
        };
        // Also invalidate rhythmic cache when progression changes
        this._invalidateRhythmicCache();
    }

    /**
     * Invalidate rhythmic analysis cache (Phase 4)
     */
    _invalidateRhythmicCache() {
        this._rhythmicCache = null;
        this._rhythmicCacheKey = null;
    }

    /**
     * Notify all registered engine listeners
     */
    _notifyEngines(eventName, detail) {
        for (const [engineId, callback] of this._engineListeners) {
            try {
                callback({
                    type: 'contextChanged',
                    source: eventName,
                    detail,
                    context: this.getSnapshot()
                });
            } catch (error) {

            }
        }

        // Also emit on the EventEmitter for general listeners
        this.emit('contextChanged', {
            source: eventName,
            detail,
            context: this.getSnapshot()
        });
    }

    /**
     * Register an engine to receive context updates
     * @param {string} engineId - Unique identifier for the engine
     * @param {Function} callback - Function to call on updates
     * @returns {Function} Unsubscribe function
     */
    registerEngine(engineId, callback) {
        this._engineListeners.set(engineId, callback);

        // Return unsubscribe function
        return () => {
            this._engineListeners.delete(engineId);
        };
    }

    /**
     * Refresh the state snapshot
     */
    refresh() {
        const progression = getProgressionData() || [];
        const key = getCurrentKey() || 'C';
        const compositionState = getCompositionState();
        const sections = compositionState?.getSections() || [];
        const sectionIntent = getSectionIntent();
        const effectiveContext = getEffectiveSectionContext();
        const insertAfterIndex = getInsertAfterIndex();

        // Calculate fingerprint for cache invalidation
        const fingerprint = this._calculateFingerprint(progression, key, sections);

        this._snapshot = {
            // Core composition data
            progression,
            key,

            // Section data
            sections,
            sectionIntent,
            effectiveContext,

            // Position data
            insertAfterIndex,
            currentChordIndex: insertAfterIndex !== null ? insertAfterIndex : progression.length - 1,

            // Reference chord (the one we're building from)
            referenceChord: progression.length > 0
                ? progression[insertAfterIndex !== null ? insertAfterIndex : progression.length - 1]
                : null,

            // Metadata
            fingerprint,
            timestamp: Date.now(),

            // Derived state
            isEmpty: progression.length === 0,
            isStartOfSection: sectionIntent?.mode === INTENT_MODES.NEW_SECTION,
            isConcluding: sectionIntent?.subMode === CONTINUE_SUBMODES.CONCLUDING,
            isFinal: sectionIntent?.subMode === CONTINUE_SUBMODES.FINAL
        };

        this._snapshotFingerprint = fingerprint;

        return this._snapshot;
    }

    /**
     * Calculate a fingerprint for the current state
     * Used for cache invalidation
     */
    _calculateFingerprint(progression, key, sections) {
        const progStr = progression.map(c => `${c.root}${c.type}${c.inversion || 0}`).join('|');
        const sectStr = sections.map(s => `${s.id}:${s.type}:${s.chordIndices?.join(',')}`).join('|');
        return `${key}::${progStr}::${sectStr}`;
    }

    /**
     * Get the current state snapshot
     * @param {Object} options - Options for snapshot
     * @param {boolean} [options.includeRhythmic=false] - Include rhythmic context data
     * @returns {Object} Current composition context snapshot
     */
    getSnapshot(options = { includeRhythmic: false }) {
        if (!this._snapshot) {
            this.refresh();
        }

        const base = { ...this._snapshot };

        // Include rhythmic context if requested and enabled
        if (options.includeRhythmic && this._rhythmAwarenessEnabled) {
            base.rhythmicContext = this.getRhythmicSnapshot();
        }

        return base;
    }

    // =========================================================================
    // LAZY-COMPUTED ANALYSIS GETTERS
    // =========================================================================

    /**
     * Get harmony analysis (lazy-computed and cached)
     * @returns {Object} Harmony analysis results
     */
    getHarmonyAnalysis() {
        if (this._analysisCache.harmonyAnalysis &&
            this._analysisCache.fingerprint === this._snapshotFingerprint) {
            return this._analysisCache.harmonyAnalysis;
        }

        if (!this._harmonyAnalyzer) {
            this._harmonyAnalyzer = getHarmonyAnalyzer();
        }

        const snapshot = this.getSnapshot();
        const analysis = this._harmonyAnalyzer.analyzeProgression(
            snapshot.progression,

        this._analysisCache.harmonyAnalysis = analysis;
        this._analysisCache.fingerprint = this._snapshotFingerprint;

        return analysis;
    }

    /**
     * Get tension arc analysis (lazy-computed and cached)
     * @param {string} genre - Genre for tension curve template
     * @returns {Object} Tension analysis results
     */
    getTensionAnalysis(genre = 'pop') {
        const cacheKey = `tension_${genre}`;
        if (this._analysisCache[cacheKey] &&
            this._analysisCache.fingerprint === this._snapshotFingerprint) {
            return this._analysisCache[cacheKey];
        }

        if (!this._tensionPlanner) {
            this._tensionPlanner = getTensionArcPlanner();
        }

        const snapshot = this.getSnapshot();
        const analysis = this._tensionPlanner.analyzeProgression(
            snapshot.progression,
            snapshot.key,

        this._analysisCache[cacheKey] = analysis;
        this._analysisCache.fingerprint = this._snapshotFingerprint;

        return analysis;
    }

    /**
     * Get pattern analysis (lazy-computed and cached)
     * @returns {Object} Detected patterns
     */
    getPatternAnalysis() {
        if (this._analysisCache.patternAnalysis &&
            this._analysisCache.fingerprint === this._snapshotFingerprint) {
            return this._analysisCache.patternAnalysis;
        }

        if (!this._harmonyAnalyzer) {
            this._harmonyAnalyzer = getHarmonyAnalyzer();
        }

        const snapshot = this.getSnapshot();
        const patterns = this._harmonyAnalyzer.detectPatterns(
            snapshot.progression,

        this._analysisCache.patternAnalysis = patterns;
        this._analysisCache.fingerprint = this._snapshotFingerprint;

        return patterns;
    }

    // =========================================================================
    // CONVENIENCE GETTERS
    // =========================================================================

    /**
     * Get the current key
     */
    getKey() {
        return this.getSnapshot().key;
    }

    /**
     * Get the current progression
     */
    getProgression() {
        return this.getSnapshot().progression;
    }

    /**
     * Get the reference chord (the one recommendations are based on)
     */
    getReferenceChord() {
        return this.getSnapshot().referenceChord;
    }

    /**
     * Get section information for a chord index
     * @param {number} chordIndex - Index of the chord
     * @returns {Object|null} Section containing this chord, or null
     */
    getSectionForChord(chordIndex) {
        const sections = this.getSnapshot().sections;
        for (const section of sections) {
            if (section.chordIndices?.includes(chordIndex)) {
                return section;
            }
        }
        return null;
    }

    /**
     * Get the current section context based on intent
     * @returns {Object|null} Current section context
     */
    getCurrentSectionContext() {
        const snapshot = this.getSnapshot();

        if (snapshot.effectiveContext) {
            return snapshot.effectiveContext;
        }

        // Fallback: find section for current chord
        return this.getSectionForChord(snapshot.currentChordIndex);
    }

    /**
     * Check if the composition is empty
     */
    isEmpty() {
        return this.getSnapshot().isEmpty;
    }

    /**
     * Get the insert position for new chords
     */
    getInsertPosition() {
        const snapshot = this.getSnapshot();
        return snapshot.insertAfterIndex !== null
            ? snapshot.insertAfterIndex + 1
            : snapshot.progression.length;
    }

    // =========================================================================
    // RHYTHMIC ANALYSIS (Phase 4)
    // =========================================================================

    /**
     * Get rhythmic context snapshot for current composition state
     * @param {Object} options - Analysis options
     * @param {string} [options.style] - Musical style override
     * @returns {Object} Rhythmic analysis snapshot
     */
    getRhythmicSnapshot(options = {}) {
        const cacheKey = this._buildRhythmicCacheKey(options);

        // Return cached result if valid
        if (this._rhythmicCache && this._rhythmicCacheKey === cacheKey) {
            return this._rhythmicCache;
        }

        // Compute new analysis
        const analysis = this._computeRhythmicSnapshot(options);
        this._rhythmicCache = analysis;
        this._rhythmicCacheKey = cacheKey;

        return analysis;
    }

    /**
     * Build cache key for rhythmic analysis
     * @private
     */
    _buildRhythmicCacheKey(options) {
        const snapshot = this.getSnapshot();
        const lastChord = snapshot.progression[snapshot.progression.length - 1];
        return JSON.stringify({
            progressionLength: snapshot.progression.length,
            lastChordBeats: lastChord?.beats,
            insertAfterIndex: snapshot.insertAfterIndex,
            style: options.style || this._currentStyle,
            fingerprint: snapshot.fingerprint
        });
    }

    /**
     * Compute rhythmic snapshot (internal)
     * @private
     */
    _computeRhythmicSnapshot(options = {}) {
        const snapshot = this.getSnapshot();
        const sectionContext = this._getCurrentSectionContext();

        return analyzeRhythmicContext(
            { storedProgressionData: snapshot.progression },
            {
                style: options.style || this._currentStyle || 'pop',
                currentChordIndex: snapshot.insertAfterIndex ?? (snapshot.progression.length - 1),
                insertAfterIndex: snapshot.insertAfterIndex,
                sectionContext: sectionContext
            }
        );
    }

    /**
     * Get current section context for rhythm analysis
     * @private
     */
    _getCurrentSectionContext() {
        const snapshot = this.getSnapshot();
        if (!snapshot.sections || snapshot.sections.length === 0) return null;

        // Find section containing current chord
        const currentIndex = snapshot.insertAfterIndex ?? (snapshot.progression.length - 1);
        const currentSection = snapshot.sections.find(s => {
            if (s.chordIndices && s.chordIndices.includes(currentIndex)) return true;
            // Also check startIndex/endIndex if available
            if (s.startIndex !== undefined && s.endIndex !== undefined) {
                return currentIndex >= s.startIndex && currentIndex <= s.endIndex;
            }
            return false;
        });

        if (!currentSection) return null;

        return {
            type: currentSection.type,
            startIndex: currentSection.startIndex ?? currentSection.chordIndices?.[0],
            endIndex: currentSection.endIndex ?? currentSection.chordIndices?.[currentSection.chordIndices.length - 1],
            targetLength: currentSection.targetLength
        };
    }

    /**
     * Check if rhythm awareness is enabled
     * @returns {boolean}
     */
    isRhythmAwarenessEnabled() {
        return this._rhythmAwarenessEnabled;
    }

    /**
     * Get the current style setting
     * @returns {string}
     */
    getCurrentStyle() {
        return this._currentStyle;
    }
}

// Singleton instance
let contextInstance = null;

/**
 * Get or create the CompositionContext singleton
 * @returns {CompositionContext}
 */
export function getCompositionContext() {
    if (!contextInstance) {
        contextInstance = new CompositionContext();
    }
    return contextInstance;
}

/**
 * Initialize the composition context
 * Should be called once at app startup
 */
export function initializeCompositionContext() {
    const context = getCompositionContext();
    context.initialize();
    return context;
}

export default CompositionContext;
