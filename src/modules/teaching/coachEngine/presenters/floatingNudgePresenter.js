/**
 * Floating Nudge Presenter
 *
 * Displays coach items (observations, suggestions, opportunities) as
 * floating notification cards. Part of the three-tier coaching system.
 *
 * Features:
 * - Skill-level aware messaging
 * - Auto-hide with hover pause
 * - Action buttons (preview, apply, learn more)
 * - Deep links to panels and modals
 * - Recall last nudge functionality
 */

import { COACH_ITEM_TYPES, COACH_CATEGORIES } from '../types.js';

// ============================================================================
// STATE
// ============================================================================

let currentNudge = null;
let lastShownNudge = null;
let autoHideTimeoutId = null;
let isHovering = false;
let isEnabled = true;
let skillLevel = 'simple';

// Default auto-hide delays by item type
const AUTO_HIDE_DELAYS = {
    [COACH_ITEM_TYPES.OBSERVATION]: 10000,  // 10 seconds - "you did something!"
    [COACH_ITEM_TYPES.SUGGESTION]: 15000,    // 15 seconds - needs more thought
    [COACH_ITEM_TYPES.OPPORTUNITY]: 12000    // 12 seconds - exploration prompt
};

// Color themes by item type
const TYPE_THEMES = {
    [COACH_ITEM_TYPES.OBSERVATION]: {
        gradient: 'from-emerald-500 to-teal-500',
        border: '#10b981',
        bgTint: '#10b98122',
        label: 'Noticed!'
    },
    [COACH_ITEM_TYPES.SUGGESTION]: {
        gradient: 'from-purple-500 to-indigo-500',
        border: '#8b5cf6',
        bgTint: '#8b5cf622',
        label: 'Try This'
    },
    [COACH_ITEM_TYPES.OPPORTUNITY]: {
        gradient: 'from-amber-500 to-orange-500',
        border: '#f59e0b',
        bgTint: '#f59e0b22',
        label: 'Explore'
    }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the floating nudge presenter
 */
export function initFloatingNudgePresenter() {
    // Load preferences
    loadPreferences();

    // Add CSS styles
    addStyles();

    // Expose global functions
    window.toggleCoachNudges = toggleCoachNudges;
    window.recallCoachNudge = recallCoachNudge;
    window.canRecallCoachNudge = canRecallCoachNudge;
    window.showCoachNudge = showNudge;

    console.log('[FloatingNudgePresenter] Initialized');
}

/**
 * Load user preferences
 */
function loadPreferences() {
    try {
        const prefs = localStorage.getItem('coachNudgePrefs');
        if (prefs) {
            const parsed = JSON.parse(prefs);
            isEnabled = parsed.enabled !== false;
            skillLevel = parsed.skillLevel || 'simple';
        }

        // Also check the existing theory skill level setting
        const theoryLevel = localStorage.getItem('theorySkillLevel');
        if (theoryLevel) {
            skillLevel = theoryLevel;
        }
    } catch (e) {
        console.warn('[FloatingNudgePresenter] Could not load preferences:', e);
    }
}

/**
 * Save user preferences
 */
function savePreferences() {
    try {
        localStorage.setItem('coachNudgePrefs', JSON.stringify({
            enabled: isEnabled,
            skillLevel: skillLevel
        }));
    } catch (e) {
        console.warn('[FloatingNudgePresenter] Could not save preferences:', e);
    }
}

// ============================================================================
// TOGGLE
// ============================================================================

/**
 * Toggle coach nudges on/off
 * @param {boolean} [forceState] - Optional forced state
 * @returns {boolean} New enabled state
 */
export function toggleCoachNudges(forceState) {
    isEnabled = forceState !== undefined ? forceState : !isEnabled;
    savePreferences();
    console.log('[FloatingNudgePresenter] Enabled:', isEnabled);
    return isEnabled;
}

/**
 * Check if nudges are enabled
 * @returns {boolean}
 */
export function isNudgesEnabled() {
    return isEnabled;
}

// ============================================================================
// DISPLAY
// ============================================================================

/**
 * Show a coach nudge
 * @param {Object} item - The coach item to display
 */
export function showNudge(item) {
    if (!isEnabled || !item) {
        console.log('[FloatingNudgePresenter] Nudge skipped (disabled or no item)');
        return;
    }

    // Don't show during tutorials
    if (window.isGuidedModeActive?.() || window.isTutorialSetupInProgress) {
        console.log('[FloatingNudgePresenter] Skipping during tutorial');
        return;
    }

    // Remove any existing nudge
    hideNudge(true);

    // Store for recall
    lastShownNudge = item;
    currentNudge = item;

    // Get theme for this item type
    const theme = TYPE_THEMES[item.type] || TYPE_THEMES[COACH_ITEM_TYPES.OBSERVATION];

    // Create the popup element
    const popup = document.createElement('div');
    popup.id = 'coach-nudge-popup';
    popup.className = 'fixed top-4 right-4 z-[99998] max-w-sm';
    popup.style.animation = 'coachSlideIn 0.3s ease-out';

    // Get message content for current skill level
    const message = getMessageForSkillLevel(item, skillLevel);

    popup.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-l-4 overflow-hidden" style="border-color: ${theme.border}">
            <!-- Header -->
            <div class="px-4 py-3 flex items-center justify-between" style="background: linear-gradient(135deg, ${theme.bgTint}, transparent)">
                <div class="flex items-center gap-2">
                    <span class="text-2xl">${item.emoji || '💡'}</span>
                    <div>
                        <span class="text-xs font-medium px-2 py-0.5 rounded-full text-white bg-gradient-to-r ${theme.gradient}">${theme.label}</span>
                        <h3 class="font-bold text-gray-800 dark:text-gray-200 text-sm mt-1">${item.title}</h3>
                    </div>
                </div>
                <button id="coach-nudge-close" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition p-1" title="Close">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>

            <!-- Content -->
            <div class="px-4 py-3">
                <p id="coach-nudge-content" class="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">${message}</p>

                ${item.data ? renderDataSection(item) : ''}
            </div>

            <!-- Actions -->
            ${renderActions(item)}

            <!-- Footer -->
            <div class="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-600 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <label class="text-xs text-gray-500 dark:text-gray-400">Detail:</label>
                    <select id="coach-nudge-skill-level" class="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-indigo-500">
                        <option value="simple" ${skillLevel === 'simple' ? 'selected' : ''}>Beginner</option>
                        <option value="intermediate" ${skillLevel === 'intermediate' ? 'selected' : ''}>Intermediate</option>
                        <option value="advanced" ${skillLevel === 'advanced' ? 'selected' : ''}>Advanced</option>
                    </select>
                </div>
                ${item.category ? `
                    <span class="text-xs text-gray-400 dark:text-gray-500">${formatCategory(item.category)}</span>
                ` : ''}
            </div>
        </div>
    `;

    // Add to DOM
    document.body.appendChild(popup);

    // Setup event listeners
    setupNudgeEventListeners(popup, item);

    // Start auto-hide timer
    const delay = AUTO_HIDE_DELAYS[item.type] || 10000;
    startAutoHideTimer(delay);

    console.log('[FloatingNudgePresenter] Showing nudge:', item.id);
}

/**
 * Get message for the current skill level
 * @param {Object} item - Coach item
 * @param {string} level - Skill level
 * @returns {string}
 */
function getMessageForSkillLevel(item, level) {
    // Check if message is an object with skill levels
    if (typeof item.message === 'object' && item.message !== null) {
        return item.message[level] || item.message.simple || item.message.intermediate || 'Interesting pattern detected!';
    }

    // If message is a string, return it
    if (typeof item.message === 'string') {
        return item.message;
    }

    return 'Interesting pattern detected!';
}

/**
 * Render data section for the nudge
 * @param {Object} item - Coach item
 * @returns {string} HTML string
 */
function renderDataSection(item) {
    const data = item.data;
    if (!data) return '';

    let html = '<div class="mt-2 text-xs text-gray-500 dark:text-gray-400">';

    // Pattern display
    if (data.pattern) {
        html += `<div class="mt-1"><strong>Pattern:</strong> ${data.pattern}</div>`;
    }

    // Chords involved
    if (data.chords && Array.isArray(data.chords)) {
        html += `<div class="mt-1"><strong>Chords:</strong> ${data.chords.join(' → ')}</div>`;
    }

    // Suggestions
    if (data.suggestions && Array.isArray(data.suggestions)) {
        html += `<div class="mt-1"><strong>Try:</strong> ${data.suggestions.slice(0, 3).join(', ')}</div>`;
    }

    // Specific suggestion
    if (data.suggestion && typeof data.suggestion === 'string') {
        html += `<div class="mt-1 italic">${data.suggestion}</div>`;
    }

    // Stats
    if (data.percent !== undefined) {
        html += `<div class="mt-1"><strong>Currently:</strong> ${data.percent}%</div>`;
    }

    html += '</div>';
    return html;
}

/**
 * Render action buttons for the nudge
 * @param {Object} item - Coach item
 * @returns {string} HTML string
 */
function renderActions(item) {
    const actions = item.actions;
    if (!actions) return '';

    let buttons = [];

    // Preview action (for suggestions)
    if (actions.preview) {
        buttons.push(`
            <button class="coach-action-btn coach-action-preview px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Preview
            </button>
        `);
    }

    // Apply action (for suggestions)
    if (actions.apply) {
        buttons.push(`
            <button class="coach-action-btn coach-action-apply px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white transition flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                Apply
            </button>
        `);
    }

    // Compare action
    if (actions.compare) {
        buttons.push(`
            <button class="coach-action-btn coach-action-compare px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path>
                </svg>
                Compare
            </button>
        `);
    }

    // Open panel action
    if (actions.openPanel) {
        buttons.push(`
            <button class="coach-action-btn coach-action-panel px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path>
                </svg>
                Explore
            </button>
        `);
    }

    // Deep dive / modal action
    if (actions.deepDive) {
        buttons.push(`
            <button class="coach-action-btn coach-action-deepdive px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-300 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition flex items-center gap-1">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                </svg>
                Learn More
            </button>
        `);
    }

    if (buttons.length === 0) return '';

    return `
        <div class="px-4 pb-3 flex flex-wrap gap-2">
            ${buttons.join('')}
        </div>
    `;
}

/**
 * Format category for display
 * @param {string} category - Category constant
 * @returns {string}
 */
function formatCategory(category) {
    const labels = {
        [COACH_CATEGORIES.CADENCE]: 'Cadence',
        [COACH_CATEGORIES.VOICE_LEADING]: 'Voice Leading',
        [COACH_CATEGORIES.HARMONY]: 'Harmony',
        [COACH_CATEGORIES.BORROWED]: 'Borrowed Chord',
        [COACH_CATEGORIES.SEQUENCE]: 'Sequence',
        [COACH_CATEGORIES.TENSION]: 'Tension',
        [COACH_CATEGORIES.VARIETY]: 'Variety'
    };
    return labels[category] || category;
}

/**
 * Setup event listeners for the nudge popup
 * @param {HTMLElement} popup - The popup element
 * @param {Object} item - The coach item
 */
function setupNudgeEventListeners(popup, item) {
    // Close button
    const closeBtn = document.getElementById('coach-nudge-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => hideNudge());
    }

    // Skill level selector
    const skillSelect = document.getElementById('coach-nudge-skill-level');
    if (skillSelect) {
        skillSelect.addEventListener('change', (e) => {
            skillLevel = e.target.value;
            savePreferences();
            // Also save to the shared theory skill level
            localStorage.setItem('theorySkillLevel', skillLevel);

            // Update content
            const contentEl = document.getElementById('coach-nudge-content');
            if (contentEl) {
                contentEl.textContent = getMessageForSkillLevel(item, skillLevel);
            }
        });
    }

    // Hover handling - pause auto-hide
    popup.addEventListener('mouseenter', () => {
        isHovering = true;
        if (autoHideTimeoutId) {
            clearTimeout(autoHideTimeoutId);
            autoHideTimeoutId = null;
        }
    });

    popup.addEventListener('mouseleave', () => {
        isHovering = false;
        startAutoHideTimer(3000); // 3 seconds after mouse leaves
    });

    // Action buttons
    const previewBtn = popup.querySelector('.coach-action-preview');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => handlePreviewAction(item));
    }

    const applyBtn = popup.querySelector('.coach-action-apply');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => handleApplyAction(item));
    }

    const compareBtn = popup.querySelector('.coach-action-compare');
    if (compareBtn) {
        compareBtn.addEventListener('click', () => handleCompareAction(item));
    }

    const panelBtn = popup.querySelector('.coach-action-panel');
    if (panelBtn) {
        panelBtn.addEventListener('click', () => handlePanelAction(item));
    }

    const deepDiveBtn = popup.querySelector('.coach-action-deepdive');
    if (deepDiveBtn) {
        deepDiveBtn.addEventListener('click', () => handleDeepDiveAction(item));
    }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * Handle preview action
 * @param {Object} item - Coach item
 */
function handlePreviewAction(item) {
    console.log('[FloatingNudgePresenter] Preview action:', item.id);

    // If there's chord data, try to play it
    if (item.data?.chord) {
        const chord = item.data.chord;
        if (window.previewChord) {
            window.previewChord(chord);
        } else if (window.playChord && chord.root && chord.type) {
            window.playChord(chord.root, chord.type, chord.inversion || 0);
        }
    }

    // If there's a specific suggestion, try to preview it
    if (item.data?.suggestedChord) {
        const suggested = item.data.suggestedChord;
        if (window.previewChord) {
            window.previewChord(suggested);
        }
    }
}

/**
 * Handle apply action
 * @param {Object} item - Coach item
 */
function handleApplyAction(item) {
    console.log('[FloatingNudgePresenter] Apply action:', item.id);

    // Apply the suggestion
    if (item.data?.suggestedChord && item.data?.chordIndex !== undefined) {
        const suggested = item.data.suggestedChord;
        const index = item.data.chordIndex;

        if (window.updateChordAtIndex) {
            window.updateChordAtIndex(index, suggested);
            hideNudge();
        }
    } else if (item.data?.applyFunction && typeof window[item.data.applyFunction] === 'function') {
        window[item.data.applyFunction](item.data);
        hideNudge();
    }
}

/**
 * Handle compare action
 * @param {Object} item - Coach item
 */
function handleCompareAction(item) {
    console.log('[FloatingNudgePresenter] Compare action:', item.id);

    // Open the unified recommendation modal in compare mode
    if (window.openUnifiedRecommendationModal) {
        const chordIndex = item.data?.chordIndex ?? 0;
        window.openUnifiedRecommendationModal(chordIndex, 'compare');
        hideNudge();
    }
}

/**
 * Handle panel action (open bottom panel)
 * @param {Object} item - Coach item
 */
function handlePanelAction(item) {
    console.log('[FloatingNudgePresenter] Panel action:', item.id);

    // Determine which panel to open based on category
    const category = item.category;

    if (category === COACH_CATEGORIES.BORROWED && window.toggleBorrowedChordsPanel) {
        window.toggleBorrowedChordsPanel();
    } else if (category === COACH_CATEGORIES.VOICE_LEADING && window.toggleVoiceLeadingPanel) {
        window.toggleVoiceLeadingPanel();
    } else if (window.toggleTheoryPanel) {
        // Default to theory panel
        window.toggleTheoryPanel();
    }

    hideNudge();
}

/**
 * Handle deep dive action (open modal for detailed exploration)
 * @param {Object} item - Coach item
 */
function handleDeepDiveAction(item) {
    console.log('[FloatingNudgePresenter] Deep dive action:', item.id);

    // Open the unified recommendation modal
    if (window.openUnifiedRecommendationModal) {
        const chordIndex = item.data?.chordIndex ?? 0;

        // Determine the best tab to open based on category
        let tab = 'suggest';
        if (item.category === COACH_CATEGORIES.VOICE_LEADING) {
            tab = 'optimize';
        } else if (item.category === COACH_CATEGORIES.BORROWED) {
            tab = 'transform';
        } else if (item.category === COACH_CATEGORIES.SEQUENCE) {
            tab = 'sequence';
        }

        window.openUnifiedRecommendationModal(chordIndex, tab);
    }

    hideNudge();
}

// ============================================================================
// HIDE / RECALL
// ============================================================================

/**
 * Hide the current nudge
 * @param {boolean} preserveLast - If true, preserve for recall
 * @param {string} reason - 'dismiss' | 'expire' | 'replaced'
 */
export function hideNudge(preserveLast = false, reason = 'dismiss') {
    // Clear auto-hide timer
    if (autoHideTimeoutId) {
        clearTimeout(autoHideTimeoutId);
        autoHideTimeoutId = null;
    }

    const popup = document.getElementById('coach-nudge-popup');
    if (popup) {
        popup.style.animation = 'coachSlideOut 0.2s ease-in forwards';
        setTimeout(() => popup.remove(), 200);
    }

    // Call appropriate callback
    if (currentNudgeCallbacks) {
        if (reason === 'expire' && currentNudgeCallbacks.onExpire) {
            currentNudgeCallbacks.onExpire();
        } else if (reason === 'dismiss' && currentNudgeCallbacks.onDismiss) {
            currentNudgeCallbacks.onDismiss();
        }
    }

    currentNudge = null;
    currentNudgeCallbacks = null;
    currentNudgeId = null;
    isHovering = false;
}

/**
 * Start the auto-hide timer
 * @param {number} delay - Delay in milliseconds
 */
function startAutoHideTimer(delay) {
    if (autoHideTimeoutId) {
        clearTimeout(autoHideTimeoutId);
    }

    autoHideTimeoutId = setTimeout(() => {
        if (currentNudge && !isHovering) {
            hideNudge(false, 'expire');
        }
    }, delay);
}

/**
 * Recall the last shown nudge
 * @returns {boolean} True if recalled
 */
export function recallCoachNudge() {
    if (lastShownNudge) {
        showNudge(lastShownNudge);
        return true;
    }
    return false;
}

/**
 * Check if a nudge can be recalled
 * @returns {boolean}
 */
export function canRecallCoachNudge() {
    return lastShownNudge !== null;
}

// ============================================================================
// STYLES
// ============================================================================

/**
 * Add CSS styles for animations
 */
function addStyles() {
    if (document.getElementById('coach-nudge-styles')) return;

    const style = document.createElement('style');
    style.id = 'coach-nudge-styles';
    style.textContent = `
        @keyframes coachSlideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes coachSlideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }

        #coach-nudge-popup {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        #coach-nudge-popup .coach-action-btn {
            cursor: pointer;
        }

        #coach-nudge-popup .coach-action-btn:active {
            transform: scale(0.95);
        }
    `;
    document.head.appendChild(style);
}

// ============================================================================
// PRESENTER INTERFACE
// ============================================================================

// Store callbacks for current nudge
let currentNudgeCallbacks = null;
let currentNudgeId = null;

/**
 * Presenter class for use with CoachEngine
 */
export class FloatingNudgePresenter {
    constructor() {
        initFloatingNudgePresenter();
    }

    /**
     * Show a coach item as a nudge
     * @param {Object} item - The coach item to present
     * @param {string} nudgeId - Unique identifier for this nudge
     * @param {Object} callbacks - Callback functions
     * @param {Function} callbacks.onDismiss - Called when user dismisses
     * @param {Function} callbacks.onAction - Called when user clicks an action
     * @param {Function} callbacks.onExpire - Called when auto-hide triggers
     */
    show(item, nudgeId, callbacks = {}) {
        currentNudgeId = nudgeId;
        currentNudgeCallbacks = callbacks;
        showNudge(item);
    }

    /**
     * Present a coach item (alias for show without tracking)
     * @param {Object} item - The coach item to present
     */
    present(item) {
        showNudge(item);
    }

    /**
     * Check if presenter is enabled
     * @returns {boolean}
     */
    isEnabled() {
        return isNudgesEnabled();
    }

    /**
     * Hide the current nudge
     */
    hide() {
        hideNudge();
    }
}

export default FloatingNudgePresenter;
