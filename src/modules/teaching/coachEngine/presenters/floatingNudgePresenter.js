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

    // Expose diagnostic function
    window.coachDiagnostics = runCoachDiagnostics;
}

/**
 * Run diagnostics on the coach system - call via window.coachDiagnostics()
 */
function runCoachDiagnostics() {
    console.group('🔍 Coach Engine Diagnostics');

    // Check if styles are injected
    const styleEl = document.getElementById('coach-nudge-styles');
    console.log('CSS Styles injected:', !!styleEl);

    // Check current nudge state
    console.log('Current nudge:', currentNudge);
    console.log('Last shown nudge:', lastShownNudge);
    console.log('Is enabled:', isEnabled);
    console.log('Skill level:', skillLevel);

    // Check for popup
    const popup = document.getElementById('coach-nudge-popup');
    console.log('Popup element exists:', !!popup);

    if (popup) {
        // Check action buttons
        const showBtn = popup.querySelector('.coach-action-show');
        const hearBtn = popup.querySelector('.coach-action-hear');
        const deepDiveBtn = popup.querySelector('.coach-action-deepdive');

        console.log('Show button found:', !!showBtn);
        console.log('Hear button found:', !!hearBtn);
        console.log('Learn More button found:', !!deepDiveBtn);
    }

    // Check global functions
    console.log('window.setCoachHighlight exists:', typeof window.setCoachHighlight === 'function');
    console.log('window.showUnifiedRecommendationModal exists:', typeof window.showUnifiedRecommendationModal === 'function');
    console.log('window.playNotesArray exists:', typeof window.playNotesArray === 'function');
    console.log('window.getPiano exists:', typeof window.getPiano === 'function');

    // Check chord cards
    const fsContainer = document.getElementById('fs-chord-cards-container');
    if (fsContainer) {
        const cards = fsContainer.querySelectorAll('[data-chord-index]');
        console.log('Chord cards in fullscreen container:', cards.length);
        cards.forEach((card, i) => {
            console.log(`  Card ${i}: data-chord-index="${card.getAttribute('data-chord-index')}"`);
        });
    } else {
        console.log('Fullscreen chord container not found');
    }

    // Check coach engine
    if (window.coachEngine) {
        console.log('Coach engine instance:', window.coachEngine);
        console.log('Queue length:', window.coachEngine.queue?.length || 0);
        console.log('History length:', window.coachEngine.history?.length || 0);
        console.log('Cooldowns:', window.coachEngine.cooldowns?.size || 0);
    } else {
        console.log('Coach engine not found on window');
    }

    console.groupEnd();

    return {
        stylesInjected: !!styleEl,
        popupExists: !!popup,
        coachEngine: window.coachEngine,
        currentNudge,
        lastShownNudge
    };
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

// Track if current nudge should stay open (no auto-hide)
let keepCurrentNudgeOpen = false;

/**
 * Show a coach nudge
 * @param {Object} item - The coach item to display
 * @param {Object} [position] - Optional position { x, y } for custom positioning
 * @param {Object} [options] - Optional display options
 * @param {boolean} [options.keepSummaryOpen] - If true, use fade animation and disable auto-hide
 */
export function showNudge(item, position = null, options = {}) {
    if (!isEnabled || !item) {
        return;
    }

    // Don't show during tutorials
    if (window.isGuidedModeActive?.() || window.isTutorialSetupInProgress) {
        return;
    }

    // Remove any existing nudge
    hideNudge(true);

    // Store for recall
    lastShownNudge = item;
    currentNudge = item;
    keepCurrentNudgeOpen = options.keepSummaryOpen || false;

    // Get theme for this item type
    const theme = TYPE_THEMES[item.type] || TYPE_THEMES[COACH_ITEM_TYPES.OBSERVATION];

    // Create the popup element
    const popup = document.createElement('div');
    popup.id = 'coach-nudge-popup';

    // Choose animation based on options
    const animation = options.keepSummaryOpen ? 'coachFadeIn 0.25s ease-out' : 'coachSlideIn 0.3s ease-out';

    // Use custom position if provided, otherwise default to top-right
    if (position && position.x !== undefined && position.y !== undefined) {
        popup.className = 'fixed z-[99998] max-w-sm';
        popup.style.cssText = `animation: ${animation}; pointer-events: auto; left: ${position.x}px; top: ${position.y}px;`;
    } else {
        popup.className = 'fixed top-4 right-4 z-[99998] max-w-sm';
        popup.style.cssText = `animation: ${animation}; pointer-events: auto;`;
    }

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
                <p id="coach-nudge-content" class="text-gray-700 dark:text-gray-300 text-base leading-relaxed">${message}</p>

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

    // Check if popup is clipped by viewport bottom and adjust position
    requestAnimationFrame(() => {
        const rect = popup.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const bottomMargin = 16; // Minimum margin from bottom edge

        if (rect.bottom > viewportHeight - bottomMargin) {
            // Popup is clipped at bottom - move it up
            const overflow = rect.bottom - (viewportHeight - bottomMargin);

            if (position && position.y !== undefined) {
                // Custom positioned popup - adjust the top position
                const newTop = Math.max(bottomMargin, position.y - overflow);
                popup.style.top = `${newTop}px`;
            } else {
                // Default top-right positioned popup - switch to bottom positioning
                popup.classList.remove('top-4');
                popup.classList.add('bottom-4');
            }
        }
    });

    // Setup event listeners
    setupNudgeEventListeners(popup, item);

    // Start auto-hide timer (skip if keepSummaryOpen is set - user must close manually)
    if (!options.keepSummaryOpen) {
        const delay = AUTO_HIDE_DELAYS[item.type] || 10000;
        startAutoHideTimer(delay);
    }
}

/**
 * Get message for the current skill level
 * @param {Object} item - Coach item
 * @param {string} level - Skill level
 * @returns {string}
 */
function getMessageForSkillLevel(item, level) {
    let message = 'Interesting pattern detected!';

    // Check if message is an object with skill levels
    if (typeof item.message === 'object' && item.message !== null) {
        message = item.message[level] || item.message.simple || item.message.intermediate || message;
    } else if (typeof item.message === 'string') {
        message = item.message;
    }

    // Interpolate template placeholders with item.data values
    // Templates use {{key}} syntax, e.g., "Try {{suggestion}} for color"
    if (item.data && typeof message === 'string') {
        message = message.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return item.data[key] !== undefined ? item.data[key] : match;
        });
    }

    return message;
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

    // Instance list - clickable locations when multiple occurrences
    if (data.instances && data.instances.length > 0) {
        const count = data.instanceCount || data.instances.length;
        html += `
            <div class="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <div class="font-semibold text-amber-700 dark:text-amber-300 mb-1">
                    📍 Found in ${count} location${count > 1 ? 's' : ''}:
                </div>
                <div class="space-y-1 max-h-24 overflow-y-auto">
                    ${data.instances.map((inst, idx) => `
                        <button class="coach-instance-btn w-full text-left px-2 py-1 rounded hover:bg-amber-100 dark:hover:bg-amber-800/50 transition text-amber-800 dark:text-amber-200 flex items-center gap-2"
                                data-instance-index="${idx}">
                            <span class="w-5 h-5 flex items-center justify-center bg-amber-200 dark:bg-amber-700 rounded-full text-[10px] font-bold">${idx + 1}</span>
                            <span class="truncate">${inst.label || `Location ${idx + 1}`}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Pattern display
    if (data.pattern) {
        html += `<div class="mt-1"><strong>Pattern:</strong> ${data.pattern}</div>`;
    }

    // Chords involved (only if no instances list, to avoid redundancy)
    if (!data.instances && data.chords && Array.isArray(data.chords)) {
        html += `<div class="mt-1"><strong>Chords:</strong> ${data.chords.join(' → ')}</div>`;
    }

    // Voice info for voice leading issues
    if (data.voice1 && data.voice2) {
        html += `<div class="mt-1"><strong>Voices:</strong> ${data.voice1} and ${data.voice2}</div>`;
    }

    // Notes involved
    if (data.notes && !data.instances) {
        html += `<div class="mt-1"><strong>Notes:</strong> ${data.notes}</div>`;
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
    const actions = item.actions || {};
    let buttons = [];

    // NOTE: Show, Hear It, Preview, and Apply buttons are temporarily disabled
    // as they don't work reliably. They can be re-enabled when properly implemented.

    // TEMPORARILY DISABLED: "Show" button - highlights referenced chord(s) in the progression
    // const hasChordReference = item.data?.chordIndex !== undefined ||
    //                           item.data?.chordIndices?.length > 0 ||
    //                           item.data?.startIndex !== undefined;
    // if (hasChordReference) {
    //     buttons.push(`
    //         <button class="coach-action-btn coach-action-show ...">Show</button>
    //     `);
    // }

    // TEMPORARILY DISABLED: "Hear It" button - plays the detected/referenced chord
    // if (item.data?.chord && (item.type === COACH_ITEM_TYPES.OBSERVATION || actions.preview)) {
    //     buttons.push(`
    //         <button class="coach-action-btn coach-action-hear ...">Hear It</button>
    //     `);
    // }

    // TEMPORARILY DISABLED: Preview action (for suggestions with a suggested chord)
    // if (actions.preview && item.data?.suggestedChord) {
    //     buttons.push(`
    //         <button class="coach-action-btn coach-action-preview ...">Preview</button>
    //     `);
    // }

    // TEMPORARILY DISABLED: Apply action (for suggestions with actionable data)
    // if (actions.apply && (item.data?.suggestedChord || item.data?.suggestedInversion !== undefined)) {
    //     buttons.push(`
    //         <button class="coach-action-btn coach-action-apply ...">Apply</button>
    //     `);
    // }

    // Learn More button - only show for OBSERVATION type items (like cadences, sequences)
    // Don't show for SUGGESTION items (like "Try a Surprise") since those modals have
    // placeholder content and don't add useful information
    if (item.type === COACH_ITEM_TYPES.OBSERVATION) {
        buttons.push(`
            <button class="coach-action-btn coach-action-deepdive px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-300 dark:border-indigo-500 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition flex items-center gap-1" title="Learn more about this concept">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
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
    // Close button - use popup.querySelector to find within the popup element
    const closeBtn = popup.querySelector('#coach-nudge-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => hideNudge());
    } else {
        console.warn('[FloatingNudgePresenter] Close button not found');
    }

    // Skill level selector - use popup.querySelector to find within the popup element
    const skillSelect = popup.querySelector('#coach-nudge-skill-level');
    if (skillSelect) {
        skillSelect.addEventListener('change', (e) => {
            const newLevel = e.target.value;
            skillLevel = newLevel;
            savePreferences();
            // Also save to the shared theory skill level
            localStorage.setItem('theorySkillLevel', skillLevel);

            // Update content - use popup.querySelector to find within the popup element
            const contentEl = popup.querySelector('#coach-nudge-content');
            if (contentEl) {
                const newMessage = getMessageForSkillLevel(item, skillLevel);
                contentEl.innerHTML = newMessage;
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
        // Only auto-hide if not in keepOpen mode
        if (!keepCurrentNudgeOpen) {
            startAutoHideTimer(3000); // 3 seconds after mouse leaves
        }
    });

    // Instance navigation buttons (clickable location list)
    const instanceBtns = popup.querySelectorAll('.coach-instance-btn');
    console.log('[FloatingNudgePresenter] Instance buttons found:', instanceBtns.length);
    instanceBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(btn.dataset.instanceIndex);
            handleInstanceClick(item, idx);
        });
    });

    // Action buttons - log what we find
    console.log('[FloatingNudgePresenter] Setting up action button listeners...');

    const showBtn = popup.querySelector('.coach-action-show');
    console.log('[FloatingNudgePresenter] Show button found:', !!showBtn);
    if (showBtn) {
        showBtn.addEventListener('click', (e) => {
            console.log('[FloatingNudgePresenter] Show button CLICKED');
            e.stopPropagation();
            handleShowAction(item);
        });
    }

    const hearBtn = popup.querySelector('.coach-action-hear');
    console.log('[FloatingNudgePresenter] Hear button found:', !!hearBtn);
    if (hearBtn) {
        hearBtn.addEventListener('click', (e) => {
            console.log('[FloatingNudgePresenter] Hear button CLICKED');
            e.stopPropagation();
            handleHearAction(item);
        });
    }

    const previewBtn = popup.querySelector('.coach-action-preview');
    console.log('[FloatingNudgePresenter] Preview button found:', !!previewBtn);
    if (previewBtn) {
        previewBtn.addEventListener('click', (e) => {
            console.log('[FloatingNudgePresenter] Preview button CLICKED');
            e.stopPropagation();
            handlePreviewAction(item);
        });
    }

    const applyBtn = popup.querySelector('.coach-action-apply');
    console.log('[FloatingNudgePresenter] Apply button found:', !!applyBtn);
    if (applyBtn) {
        applyBtn.addEventListener('click', (e) => {
            console.log('[FloatingNudgePresenter] Apply button CLICKED');
            e.stopPropagation();
            handleApplyAction(item);
        });
    }

    const compareBtn = popup.querySelector('.coach-action-compare');
    if (compareBtn) {
        compareBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleCompareAction(item);
        });
    }

    const panelBtn = popup.querySelector('.coach-action-panel');
    if (panelBtn) {
        panelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handlePanelAction(item);
        });
    }

    const deepDiveBtn = popup.querySelector('.coach-action-deepdive');
    console.log('[FloatingNudgePresenter] Learn More button found:', !!deepDiveBtn);
    if (deepDiveBtn) {
        deepDiveBtn.addEventListener('click', (e) => {
            console.log('[FloatingNudgePresenter] Learn More button CLICKED');
            e.stopPropagation();
            handleDeepDiveAction(item);
        });
    }

    console.log('[FloatingNudgePresenter] Action button setup complete');
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * Handle click on a specific instance in the location list
 * @param {Object} item - Coach item
 * @param {number} instanceIndex - Index of the clicked instance
 */
function handleInstanceClick(item, instanceIndex) {
    const instances = item.data?.instances;
    if (!instances || instanceIndex >= instances.length) {
        console.warn('[FloatingNudgePresenter] Invalid instance index:', instanceIndex);
        return;
    }

    const instance = instances[instanceIndex];
    console.log('[FloatingNudgePresenter] Instance click:', instanceIndex, instance);

    // Get chord indices from this instance
    let indices = instance.chordIndices || [];
    if (instance.fromChordIndex !== undefined) {
        indices.push(instance.fromChordIndex);
    }
    if (instance.toChordIndex !== undefined) {
        indices.push(instance.toChordIndex);
    }
    if (instance.chordIndex !== undefined) {
        indices.push(instance.chordIndex);
    }
    indices = [...new Set(indices)];

    if (indices.length > 0) {
        // Highlight the chord cards for this instance
        highlightChordCards(indices);

        // Scroll to the first chord
        scrollToChordCard(indices[0]);

        // Also highlight specific notes if available
        if (instance.fromNotes || instance.toNotes || instance.crossedNotes) {
            highlightNotesInNotation(instance);
        }
    }
}

/**
 * Highlight specific notes in the VexFlow notation
 * @param {Object} instance - Instance data with note information
 */
function highlightNotesInNotation(instance) {
    // This function will highlight notes in the staff notation
    // For now, we'll use a CSS-based approach targeting note elements
    // In the future, this could be enhanced to work with VexFlow's note elements directly

    // Remove any existing note highlights
    document.querySelectorAll('.coach-note-highlight').forEach(el => {
        el.classList.remove('coach-note-highlight');
    });

    // Try to find and highlight notes in the notation
    // The notation renderer would need to support this - for now we'll
    // trigger an event that the notation system can listen for
    if (window.highlightNotesInStaff) {
        const notes = [
            ...(instance.fromNotes || []),
            ...(instance.toNotes || []),
            ...(instance.crossedNotes || [])
        ];
        window.highlightNotesInStaff(notes, instance.chordIndices || []);
    }

    console.log('[FloatingNudgePresenter] Note highlight requested for:', instance);
}

/**
 * Handle "Show" action - highlights the referenced chord(s) in the progression
 * @param {Object} item - Coach item
 */
function handleShowAction(item) {
    console.log('[FloatingNudgePresenter] ========== SHOW ACTION ==========');
    console.log('[FloatingNudgePresenter] Item ID:', item.id);
    console.log('[FloatingNudgePresenter] Item data:', JSON.stringify(item.data, null, 2));

    // If there are instances, show the first one
    if (item.data?.instances?.length > 0) {
        console.log('[FloatingNudgePresenter] Has instances, delegating to handleInstanceClick');
        handleInstanceClick(item, 0);
        return;
    }

    // Collect chord indices to highlight
    let indices = [];

    if (item.data?.chordIndex !== undefined) {
        console.log('[FloatingNudgePresenter] Found chordIndex:', item.data.chordIndex);
        indices.push(item.data.chordIndex);
    }
    if (item.data?.chordIndices?.length > 0) {
        console.log('[FloatingNudgePresenter] Found chordIndices:', item.data.chordIndices);
        indices.push(...item.data.chordIndices);
    }
    // For cadences that span two chords
    if (item.data?.startIndex !== undefined) {
        indices.push(item.data.startIndex);
        if (item.data?.endIndex !== undefined) {
            indices.push(item.data.endIndex);
        }
    }

    // Remove duplicates
    indices = [...new Set(indices)];

    if (indices.length === 0) {
        console.warn('[FloatingNudgePresenter] No chord indices to highlight');
        return;
    }

    // Highlight the chord cards
    highlightChordCards(indices);

    // Scroll the first chord into view
    scrollToChordCard(indices[0]);
}

/**
 * Highlight chord cards at the specified indices
 * @param {number[]} indices - Chord indices to highlight
 */
function highlightChordCards(indices) {
    console.log('[FloatingNudgePresenter] highlightChordCards called with indices:', indices);

    // Remove any existing highlights
    document.querySelectorAll('.coach-highlight').forEach(el => {
        el.classList.remove('coach-highlight');
    });

    // Also trigger the VexFlow notation highlight if available
    if (window.setCoachHighlight && indices.length > 0) {
        window.setCoachHighlight(indices, 5000);
    }

    let totalCardsFound = 0;

    // Add highlight to each chord card
    for (const index of indices) {
        // Find chord cards with this index across all visualizations
        const selectors = [
            `#progression-visualization [data-chord-index="${index}"]`,
            `#melody-progression-visualization [data-chord-index="${index}"]`,
            `#builder-progression-visualization [data-chord-index="${index}"]`,
            `#fs-chord-cards-container [data-chord-index="${index}"]`,
            `.chord-card-wrapper[data-chord-index="${index}"]`
        ];

        for (const selector of selectors) {
            const cards = document.querySelectorAll(selector);
            totalCardsFound += cards.length;
            cards.forEach(card => {
                card.classList.add('coach-highlight');
                console.log('[FloatingNudgePresenter] Added highlight to card:', selector, card);
            });
        }
    }

    console.log('[FloatingNudgePresenter] Total cards found and highlighted:', totalCardsFound);

    // Auto-remove highlight after 5 seconds
    setTimeout(() => {
        document.querySelectorAll('.coach-highlight').forEach(el => {
            el.classList.remove('coach-highlight');
        });
    }, 5000);
}

/**
 * Scroll a chord card into view
 * @param {number} index - Chord index
 */
function scrollToChordCard(index) {
    // Try to find a visible chord card container
    const containers = [
        document.getElementById('fs-chord-cards-container'),
        document.getElementById('progression-visualization'),
        document.getElementById('melody-progression-visualization')
    ];

    for (const container of containers) {
        if (!container || container.offsetParent === null) continue; // Skip hidden containers

        const card = container.querySelector(`[data-chord-index="${index}"]`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            break;
        }
    }
}

/**
 * Handle "Hear It" action - plays the detected chord
 * @param {Object} item - Coach item
 */
function handleHearAction(item) {
    console.log('[FloatingNudgePresenter] Hear action:', item.id);

    const chord = item.data?.chord;
    if (!chord) {
        console.warn('[FloatingNudgePresenter] No chord data to play');
        return;
    }

    // Use the chord's notes array if available (preserves correct octaves)
    if (chord.notes && chord.notes.length > 0) {
        if (window.playNotesArray) {
            window.playNotesArray(chord.notes);
        } else if (window.getPiano) {
            const piano = window.getPiano();
            if (piano) {
                piano.triggerAttackRelease(chord.notes, '2n');
            }
        }
    } else if (chord.root && chord.type) {
        // Fallback to generating notes
        if (window.playChord) {
            window.playChord(chord.root, chord.type, chord.inversion || 0);
        }
    }
}

/**
 * Handle preview action - plays the suggested chord
 * @param {Object} item - Coach item
 */
function handlePreviewAction(item) {
    console.log('[FloatingNudgePresenter] Preview action:', item.id);

    const suggested = item.data?.suggestedChord;
    if (!suggested) {
        console.warn('[FloatingNudgePresenter] No suggested chord to preview');
        return;
    }

    // Play the suggested chord
    if (suggested.notes && suggested.notes.length > 0) {
        if (window.playNotesArray) {
            window.playNotesArray(suggested.notes);
        } else if (window.getPiano) {
            const piano = window.getPiano();
            if (piano) {
                piano.triggerAttackRelease(suggested.notes, '2n');
            }
        }
    } else if (suggested.root && suggested.type) {
        if (window.playChord) {
            window.playChord(suggested.root, suggested.type, suggested.inversion || 0);
        }
    }
}

/**
 * Handle apply action - applies the suggested change
 * @param {Object} item - Coach item
 */
function handleApplyAction(item) {
    console.log('[FloatingNudgePresenter] Apply action:', item.id);

    const chordIndex = item.data?.chordIndex;
    if (chordIndex === undefined) {
        console.warn('[FloatingNudgePresenter] No chord index for apply action');
        return;
    }

    // Apply suggested chord replacement
    if (item.data?.suggestedChord) {
        const suggested = item.data.suggestedChord;
        if (window.updateChordAtIndex) {
            window.updateChordAtIndex(chordIndex, suggested);
            hideNudge();
            return;
        }
    }

    // Apply inversion change
    if (item.data?.suggestedInversion !== undefined) {
        if (window.setChordInversion) {
            window.setChordInversion(chordIndex, item.data.suggestedInversion);
            hideNudge();
            return;
        }
    }

    // Custom apply function
    if (item.data?.applyFunction && typeof window[item.data.applyFunction] === 'function') {
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
    if (window.showUnifiedRecommendationModal) {
        const chordIndex = item.data?.chordIndex ?? 0;
        window.showUnifiedRecommendationModal({ chordIndex, initialTab: 'chord' });
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
 * Handle deep dive / learn more action
 * Shows an educational modal with information about the concept
 * @param {Object} item - Coach item
 */
function handleDeepDiveAction(item) {
    console.log('[FloatingNudgePresenter] ========== LEARN MORE ACTION ==========');
    console.log('[FloatingNudgePresenter] Item ID:', item.id);
    console.log('[FloatingNudgePresenter] Item category:', item.category);

    // Show the educational modal with information about this coach item's concept
    showLearnMoreModal(item);
    hideNudge();
}

/**
 * Show an educational modal for a coach item
 * @param {Object} item - Coach item
 */
function showLearnMoreModal(item) {
    // Remove any existing modal
    const existingModal = document.getElementById('coach-learn-more-modal');
    if (existingModal) existingModal.remove();

    // Get educational content for this item
    const content = getEducationalContent(item);

    // Create the modal
    const modal = document.createElement('div');
    modal.id = 'coach-learn-more-modal';
    modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-4';
    modal.style.cssText = 'animation: coachFadeIn 0.2s ease-out;';

    modal.innerHTML = `
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="document.getElementById('coach-learn-more-modal')?.remove()"></div>
        <div class="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <!-- Header -->
            <div class="px-6 py-4 bg-gradient-to-r ${content.gradientClass} text-white">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <span class="text-3xl">${content.emoji}</span>
                        <div>
                            <h2 class="text-xl font-bold">${content.title}</h2>
                            <span class="text-xs opacity-80">${content.category}</span>
                        </div>
                    </div>
                    <button onclick="document.getElementById('coach-learn-more-modal')?.remove()"
                            class="text-white/80 hover:text-white transition p-1">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Content -->
            <div class="px-6 py-4 overflow-y-auto max-h-[calc(80vh-180px)]">
                <!-- Main explanation -->
                <div class="mb-4">
                    <h3 class="font-semibold text-gray-800 dark:text-gray-200 mb-2">What is this?</h3>
                    <p class="text-gray-600 dark:text-gray-300 leading-relaxed">${content.explanation}</p>
                </div>

                ${content.analogy ? `
                    <div class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div class="flex items-start gap-2">
                            <span class="text-lg">💡</span>
                            <p class="text-amber-800 dark:text-amber-200 text-sm">${content.analogy}</p>
                        </div>
                    </div>
                ` : ''}

                ${content.examples?.length > 0 ? `
                    <div class="mb-4">
                        <h3 class="font-semibold text-gray-800 dark:text-gray-200 mb-2">Examples</h3>
                        <ul class="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 text-sm">
                            ${content.examples.map(ex => `<li>${ex}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${content.tip ? `
                    <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div class="flex items-start gap-2">
                            <span class="text-lg">🎯</span>
                            <div>
                                <span class="font-medium text-blue-800 dark:text-blue-200 text-sm">Tip: </span>
                                <span class="text-blue-700 dark:text-blue-300 text-sm">${content.tip}</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-600 flex justify-end">
                <button onclick="document.getElementById('coach-learn-more-modal')?.remove()"
                        class="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white rounded-lg font-medium transition">
                    Got it!
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

/**
 * Get educational content for a coach item
 * @param {Object} item - Coach item
 * @returns {Object} Educational content object
 */
function getEducationalContent(item) {
    // Map coach item IDs to educational content
    const contentMap = {
        // Cadences
        'perfect-cadence': {
            title: 'Perfect Authentic Cadence',
            category: 'Cadences',
            emoji: '✅',
            gradientClass: 'from-emerald-500 to-teal-500',
            explanation: "The Perfect Authentic Cadence (V→I) is the strongest, most conclusive ending in music. It's the musical equivalent of a full stop at the end of a sentence - final, complete, and satisfying.",
            analogy: "Think of it like a ball finally landing after being thrown. The V chord is like the ball in the air (tension), and the I chord is the satisfying 'thunk' when it lands (resolution).",
            examples: ["End of 'Happy Birthday'", "End of 'Twinkle Twinkle Little Star'", "Almost every Classical piece ends this way"],
            tip: "Use V→I to create strong endings for your phrases and sections."
        },
        'plagal-cadence': {
            title: 'Plagal Cadence (The Amen Cadence)',
            category: 'Cadences',
            emoji: '🙏',
            gradientClass: 'from-purple-500 to-indigo-500',
            explanation: "The Plagal Cadence (IV→I) is a softer, gentler ending. It's called the 'Amen' cadence because hymns often end this way - peaceful and settled rather than dramatic.",
            analogy: "If V→I is landing after a jump, IV→I is gently sitting down. Both arrive at home, but one is more forceful, the other more peaceful.",
            examples: ["The 'Amen' at the end of hymns", "End of 'Let It Be' by The Beatles", "Often follows an authentic cadence for extra 'settling'"],
            tip: "Use IV→I when you want a gentle, peaceful ending instead of a dramatic one."
        },
        'deceptive-cadence': {
            title: 'Deceptive Cadence',
            category: 'Cadences',
            emoji: '🎉',
            gradientClass: 'from-pink-500 to-rose-500',
            explanation: "The Deceptive Cadence (V→vi) is a musical plot twist! When you expect V to resolve to I, it surprises you by going to vi instead. It's satisfying but unexpected.",
            analogy: "It's like walking home and suddenly turning down a different street. You didn't go where expected, but it's still a nice destination.",
            examples: ["Creates a 'not yet finished' feeling", "Common in romantic classical music", "Extends emotional passages"],
            tip: "Use V→vi when you want to surprise the listener and keep the music going instead of ending."
        },
        'half-cadence': {
            title: 'Half Cadence',
            category: 'Cadences',
            emoji: '❓',
            gradientClass: 'from-amber-500 to-orange-500',
            explanation: "A Half Cadence ends on the V chord - it's like a musical question mark. It creates suspense and the expectation of more music to come.",
            analogy: "It's like ending a sentence with '...' - incomplete and expectant. The listener knows there's more coming.",
            examples: ["Often used between sections of a piece", "Creates a pause without full resolution", "The listener waits for the answer"],
            tip: "Use half cadences to create pauses and breathing points in the middle of your music."
        },

        // Borrowed Chords
        'borrowed-bVI': {
            title: 'Borrowed bVI Chord',
            category: 'Borrowed Chords',
            emoji: '🎭',
            gradientClass: 'from-indigo-500 to-purple-500',
            explanation: "The bVI chord is 'borrowed' from the parallel minor key. In C major, using Ab major instead of Am adds dramatic, cinematic color - think epic movie soundtracks!",
            analogy: "It's like using a word from another language because it expresses something your native language doesn't have perfectly.",
            examples: ["C → Ab → G → C (dramatic progression)", "Common in film scores", "The 'epic' sound of superhero movies"],
            tip: "Use bVI when you want to add drama and emotion - it works especially well going to V or I."
        },
        'borrowed-bVII': {
            title: 'Borrowed bVII Chord',
            category: 'Borrowed Chords',
            emoji: '🎸',
            gradientClass: 'from-orange-500 to-red-500',
            explanation: "The bVII chord has that classic rock and folk flavor. In C major, Bb major is borrowed from C Mixolydian mode and creates a laid-back, rootsy feel.",
            analogy: "It's the sound of a guitarist who learned from classic rock rather than classical music - authentic and unpretentious.",
            examples: ["C → Bb → F → C (rock progression)", "Sweet Home Alabama", "Free Fallin' by Tom Petty"],
            tip: "Use bVII→IV→I for instant rock credibility. It's THE rock cadence."
        },
        'borrowed-iv': {
            title: 'Minor iv Chord',
            category: 'Borrowed Chords',
            emoji: '😢',
            gradientClass: 'from-blue-500 to-indigo-500',
            explanation: "The minor iv (like Fm in C major) is borrowed from the parallel minor. It transforms the usually bright IV chord into something bittersweet and melancholic.",
            analogy: "It's like a sunny day with a few clouds - still beautiful, but with a touch of sadness.",
            examples: ["C → Fm → C (the 'creep' progression)", "Adds emotional depth to pop ballads", "Common in emotional climaxes"],
            tip: "Use minor iv when you want to add a touch of sadness or yearning to an otherwise major-key song."
        },

        // Voice Leading
        'smooth-voice-leading': {
            title: 'Smooth Voice Leading',
            category: 'Voice Leading',
            emoji: '🌊',
            gradientClass: 'from-cyan-500 to-blue-500',
            explanation: "Smooth voice leading means each note moves as little as possible when changing chords. Small, stepwise movements create elegant, professional-sounding progressions.",
            analogy: "Think of each note as a person walking. It's easier and smoother to take small steps than to keep jumping around!",
            examples: ["Hold common tones (notes in both chords)", "Move other voices by step when possible", "Avoid big leaps in all voices at once"],
            tip: "Try using chord inversions to create stepwise bass lines - this immediately improves voice leading."
        },
        'fix-parallel-fifths': {
            title: 'Parallel Fifths',
            category: 'Voice Leading',
            emoji: '⚠️',
            gradientClass: 'from-yellow-500 to-amber-500',
            explanation: "When two voices move in parallel fifths (both moving the same direction, maintaining a fifth apart), they lose their independence and 'merge' into one perceived line.",
            analogy: "It's like two people walking exactly in lockstep - they start to look like one entity instead of two individuals.",
            examples: ["Common in rock and metal (intentional)", "Avoided in classical counterpoint", "Creates a 'hollow' or 'open' sound"],
            tip: "In classical styles, fix parallel fifths using contrary motion. In rock? Keep them - they're part of the sound!"
        },
        'fix-parallel-octaves': {
            title: 'Parallel Octaves',
            category: 'Voice Leading',
            emoji: '⚠️',
            gradientClass: 'from-yellow-500 to-amber-500',
            explanation: "When two voices move in parallel octaves, they're essentially playing the same note in different registers. This reduces the number of independent voices in your texture.",
            analogy: "It's like two singers singing the same melody together - powerful for unison, but you lose the harmony.",
            examples: ["Reduces textural richness", "Both voices sound like one", "Sometimes used intentionally for power"],
            tip: "Move one voice in the opposite direction, or have one voice stay on a common tone while the other moves."
        },
        'fix-voice-crossing': {
            title: 'Voice Crossing',
            category: 'Voice Leading',
            emoji: '🔀',
            gradientClass: 'from-purple-500 to-pink-500',
            explanation: "Voice crossing happens when a higher voice goes below a lower voice (or vice versa). This can create muddiness and confusion about which voice is which.",
            analogy: "Imagine two dancers who keep bumping into each other because they're crossing paths - it looks messy!",
            examples: ["Bass going above tenor", "Alto going below bass", "Creates registral confusion"],
            tip: "Keep your voices in their own 'lanes' - soprano stays high, bass stays low, and inner voices stay in the middle."
        },
        'try-inversion': {
            title: 'Chord Inversions',
            category: 'Voice Leading',
            emoji: '✨',
            gradientClass: 'from-violet-500 to-purple-500',
            explanation: "Instead of always playing chords in root position, try inversions! First inversion puts the 3rd in the bass, second inversion puts the 5th. This creates smooth, melodic bass lines.",
            analogy: "It's like rearranging furniture in a room - same pieces, different arrangement, different feel.",
            examples: ["C/E (first inversion, E in bass)", "C/G (second inversion, G in bass)", "Walking bass lines use lots of inversions"],
            tip: "When your bass is making big jumps, see if an inversion of the next chord could create stepwise motion instead."
        },

        // Secondary Dominants
        'secondary-dominant': {
            title: 'Secondary Dominants',
            category: 'Advanced Harmony',
            emoji: '🔥',
            gradientClass: 'from-red-500 to-orange-500',
            explanation: "A secondary dominant is a chord that acts as the V of another chord (not just I). It 'points' to that chord, making its arrival feel more important and satisfying.",
            analogy: "It's like giving someone a royal introduction: 'Ladies and gentlemen... JOHN!' instead of just 'Here's John.'",
            examples: ["D7 → G in C major (V/V)", "A7 → Dm in C major (V/ii)", "E7 → Am in C major (V/vi)"],
            tip: "To create a secondary dominant, play a major chord or dominant 7th a fifth above any diatonic chord."
        },
        'try-secondary-dominant': {
            title: 'Secondary Dominants',
            category: 'Advanced Harmony',
            emoji: '🔥',
            gradientClass: 'from-red-500 to-orange-500',
            explanation: "Secondary dominants add chromatic interest and create stronger 'pulls' between chords. They're like turbo-charging your progressions!",
            analogy: "Think of them as spotlights - they highlight and intensify the arrival at any chord, not just the tonic.",
            examples: ["ii-V-I becomes ii-V/V-V-I", "Add A7 before Dm for extra drama", "Chain them: A7→D7→G7→C"],
            tip: "Before any major or minor chord, try adding its V7 chord for instant sophistication."
        },

        // Tension Chord Resolutions
        'resolve-sus4': {
            title: 'Suspended 4th Resolution',
            category: 'Resolution',
            emoji: '🎯',
            gradientClass: 'from-cyan-500 to-blue-500',
            explanation: "A sus4 chord replaces the 3rd with a 4th, creating tension that wants to resolve. The 4th naturally falls down by step to the 3rd, completing the chord.",
            analogy: "It's like holding your breath - the suspension creates expectation, and the resolution is the satisfying exhale.",
            examples: ["Csus4 → C (the 4th F falls to E)", "Gsus4 → G (the 4th C falls to B)", "Very common in pop and rock"],
            tip: "Use sus4 chords to add melodic interest. The suspension-resolution pattern is extremely satisfying to the ear."
        },
        'resolve-sus2': {
            title: 'Suspended 2nd Resolution',
            category: 'Resolution',
            emoji: '🎯',
            gradientClass: 'from-cyan-500 to-blue-500',
            explanation: "A sus2 chord replaces the 3rd with a 2nd, creating an open, unresolved sound. The 2nd can rise up to the 3rd to complete the chord.",
            analogy: "Sus2 chords sound more ambiguous than sus4 - they're asking a question rather than holding back an answer.",
            examples: ["Csus2 → C (the 2nd D rises to E)", "Often used for dreamy, open textures", "Popular in alternative and indie rock"],
            tip: "Sus2 chords don't demand resolution as strongly as sus4. You can leave them unresolved for an ethereal effect."
        },
        'resolve-diminished': {
            title: 'Diminished Chord Resolution',
            category: 'Resolution',
            emoji: '⚡',
            gradientClass: 'from-purple-500 to-pink-500',
            explanation: "Diminished chords are highly unstable due to their tritone interval. They function like leading-tone chords and typically resolve up by half step.",
            analogy: "A diminished chord is like standing on one foot on a slippery surface - it desperately wants to find stable ground.",
            examples: ["B° → C (the root rises a half step)", "G#° → Am (common in classical music)", "Creates strong dramatic tension"],
            tip: "Diminished 7th chords can resolve to ANY major or minor chord a half step above any of their notes - they're versatile!"
        },
        'resolve-augmented': {
            title: 'Augmented Chord Resolution',
            category: 'Resolution',
            emoji: '✨',
            gradientClass: 'from-pink-500 to-rose-500',
            explanation: "Augmented chords have a raised 5th that creates an unstable, dreamlike quality. The raised 5th typically wants to continue rising by half step.",
            analogy: "An augmented chord feels like being suspended in air - magical but unsustainable, needing to land somewhere.",
            examples: ["C+ → F (common V+ → I in F major)", "Creates a chromatic line: G → G#(+) → A", "Used for dramatic effect"],
            tip: "Augmented chords often function as altered dominants. Try V+ → I for a colorful resolution."
        },
        'resolve-dominant7': {
            title: 'Dominant 7th Resolution',
            category: 'Resolution',
            emoji: '🔥',
            gradientClass: 'from-orange-500 to-red-500',
            explanation: "Dominant 7th chords contain a tritone (between the 3rd and 7th) that creates powerful tension. This tritone resolves inward: the 7th falls and the 3rd rises.",
            analogy: "The tritone is like a rubber band stretched to its limit - it has to snap back to resolve.",
            examples: ["G7 → C (the classic V7-I)", "The 7th (F) falls to E, the 3rd (B) rises to C", "Foundation of jazz harmony"],
            tip: "Any dominant 7th chord wants to resolve down a 5th. This makes them perfect for creating chains: A7 → D7 → G7 → C."
        },

        // Sequences
        'circle-of-fifths': {
            title: 'Circle of Fifths Motion',
            category: 'Sequences',
            emoji: '🔄',
            gradientClass: 'from-teal-500 to-cyan-500',
            explanation: "When chords move in fifths (each chord is a fifth below the previous), they create one of music's most powerful patterns. Each chord 'points' to the next like dominoes falling.",
            analogy: "It's like a chain reaction - each chord naturally leads to the next, creating unstoppable forward momentum.",
            examples: ["Am → Dm → G → C", "Full cycle: I→IV→vii→iii→vi→ii→V→I", "Autumn Leaves uses this extensively"],
            tip: "Start from vi and move through the cycle: vi→ii→V→I is one of the most common progressions in jazz and pop."
        },
        'harmonic-sequence': {
            title: 'Harmonic Sequence',
            category: 'Sequences',
            emoji: '📐',
            gradientClass: 'from-green-500 to-emerald-500',
            explanation: "A harmonic sequence repeats a chord pattern at different pitch levels. This creates unity through repetition while also creating directional motion.",
            analogy: "It's like climbing stairs - each step is the same motion, but you're constantly moving somewhere.",
            examples: ["Descending thirds: C→Am→F→Dm", "Descending steps: C→Bm→Am→G", "Creates predictable, satisfying patterns"],
            tip: "Once you establish a pattern, the listener expects it to continue - you can surprise them by breaking it at a strategic moment."
        },

        // Modal Patterns
        'dorian-pattern': {
            title: 'Dorian Mode',
            category: 'Modal Patterns',
            emoji: '🎷',
            gradientClass: 'from-indigo-500 to-blue-500',
            explanation: "The Dorian mode is like a minor scale with a raised 6th. This allows a major IV chord over a minor tonic - the distinctive sound of jazz, funk, and soul.",
            analogy: "It's minor with a silver lining - sad but hopeful, dark but sophisticated.",
            examples: ["i→IV (Dm→G in D Dorian)", "'So What' by Miles Davis", "Most funk and soul music"],
            tip: "For instant Dorian flavor, play a minor chord with a major chord one whole step below it (like Am→G)."
        },
        'mixolydian-pattern': {
            title: 'Mixolydian Mode',
            category: 'Modal Patterns',
            emoji: '🎸',
            gradientClass: 'from-orange-500 to-amber-500',
            explanation: "The Mixolydian mode is like a major scale with a lowered 7th. This creates the bVII chord that defines classic rock, blues, and folk music.",
            analogy: "It's the sound of a guitarist who learned from classic rock records rather than classical music - authentic and earthy.",
            examples: ["I→bVII (C→Bb in C Mixolydian)", "'Sweet Home Alabama'", "'Norwegian Wood' by The Beatles"],
            tip: "For instant rock credibility, add the bVII chord to any major key progression."
        },

        // Chromatic Relationships
        'chromatic-mediant': {
            title: 'Chromatic Mediant',
            category: 'Advanced Harmony',
            emoji: '✨',
            gradientClass: 'from-pink-500 to-purple-500',
            explanation: "Chromatic mediants are chords a third apart with chromatic alterations. They create dramatic, colorful shifts common in film scores and romantic music.",
            analogy: "It's like a sudden change of lighting in a movie - the scene is transformed without actually moving anywhere.",
            examples: ["C major → E major", "C major → Ab major", "Common in Hans Zimmer scores"],
            tip: "Try moving from any major chord to another major chord a major or minor third away for instant cinematic drama."
        },

        // Tension
        'tension-climax': {
            title: 'Tension Peak',
            category: 'Form & Structure',
            emoji: '📈',
            gradientClass: 'from-red-500 to-pink-500',
            explanation: "Great music builds to tension peaks and then releases them. A tension climax is the most intense moment in your progression - the top of the emotional arc.",
            analogy: "It's like the peak of a rollercoaster - the maximum height before the thrilling release.",
            examples: ["Dominant chords create tension", "Dissonance increases toward the peak", "Resolution follows the climax"],
            tip: "Plan your progressions with tension arcs in mind - build up tension gradually, then release it satisfyingly."
        },

        // Rhythm
        'vary-harmonic-rhythm': {
            title: 'Harmonic Rhythm',
            category: 'Rhythm & Pacing',
            emoji: '⏱️',
            gradientClass: 'from-blue-500 to-purple-500',
            explanation: "Harmonic rhythm is how quickly the chords change. Varying it creates interest - faster changes for excitement, slower changes for stability.",
            analogy: "It's like the pacing of a conversation - sometimes quick back-and-forth, sometimes pausing to let ideas sink in.",
            examples: ["Slow at the start, fast at cadences", "One chord per bar vs. two chords per bar", "Longer chords on important moments"],
            tip: "Speed up harmonic rhythm as you approach a cadence - it creates momentum and makes the resolution more satisfying."
        },

        // Opportunities
        'no-borrowed-chords': {
            title: 'Modal Interchange',
            category: 'Advanced Harmony',
            emoji: '🎨',
            gradientClass: 'from-violet-500 to-indigo-500',
            explanation: "Borrowed chords add color by using chords from parallel modes. They're like spices in cooking - a little goes a long way!",
            analogy: "Imagine painting with only primary colors versus having the full rainbow available. Borrowed chords expand your palette.",
            examples: ["bVII for rock flavor", "bVI for drama", "iv for melancholy"],
            tip: "Try replacing IV with iv for instant emotional depth. Or use bVII→IV→I for a rock cadence."
        },
        'no-cadence': {
            title: 'Cadential Patterns',
            category: 'Form & Structure',
            emoji: '🏁',
            gradientClass: 'from-green-500 to-teal-500',
            explanation: "Cadences are musical punctuation - they create sense of arrival and closure. Without them, music can feel like it's wandering without purpose.",
            analogy: "Music without cadences is like a story without periods or chapter endings - the listener doesn't know when to breathe.",
            examples: ["V→I (strongest ending)", "IV→I (gentle ending)", "V→vi (surprise continuation)"],
            tip: "End phrases with V→I or IV→I. Even if the whole song is one phrase, it needs an ending!"
        },

        // New comprehensive patterns

        'harmonic-rhythm-change': {
            title: 'Harmonic Rhythm Shift',
            category: 'Rhythm & Pacing',
            emoji: '⏱️',
            gradientClass: 'from-blue-500 to-purple-500',
            explanation: "Harmonic rhythm is the rate at which chords change. When the pace speeds up or slows down, it creates dramatic effect - like a movie scene building to a climax or settling into calm.",
            analogy: "It's like your heartbeat - it quickens during exciting moments and slows when you're relaxed. Music does the same!",
            examples: ["Speeding up before a cadence", "Slowing down for emphasis", "Half-note chords becoming quarter-note chords"],
            tip: "Use faster harmonic rhythm to build excitement toward important moments, and slower rhythm for weight and emphasis."
        },

        'leading-tone-resolution': {
            title: 'Leading Tone Resolution',
            category: 'Voice Leading',
            emoji: '🎯',
            gradientClass: 'from-emerald-500 to-teal-500',
            explanation: "The leading tone is the 7th scale degree - it's called that because it 'leads' strongly to the tonic. This half-step pull (like B→C in C major) is the most powerful melodic tendency in tonal music.",
            analogy: "The leading tone is like a homing pigeon - it always wants to fly home to the tonic. The closer it gets (just a half step away), the stronger the pull.",
            examples: ["B→C in C major", "F#→G in G major", "Always resolves up by half step"],
            tip: "When you hear V→I, listen for the leading tone resolving up to the tonic - it's what makes the resolution so satisfying!"
        },

        'tritone-usage': {
            title: 'Tritone - The Devil\'s Interval',
            category: 'Tension',
            emoji: '😈',
            gradientClass: 'from-red-500 to-purple-500',
            explanation: "The tritone (augmented 4th / diminished 5th) divides the octave exactly in half. Medieval musicians called it 'diabolus in musica' (the devil in music) because of its extreme dissonance and instability.",
            analogy: "The tritone is like a cat on a fence - it can't stay there long and must jump one way or the other. It resolves inward to a third or outward to a sixth.",
            examples: ["B and F in C major", "Found in every dominant 7th chord", "Creates the 'pull' in V7→I"],
            tip: "The tritone is your friend for creating tension! It's what makes dominant chords want to resolve so badly."
        },

        'cadential-64': {
            title: 'Cadential 6/4',
            category: 'Cadences',
            emoji: '👑',
            gradientClass: 'from-amber-500 to-yellow-500',
            explanation: "The cadential 6/4 is when a I chord appears in second inversion (with the 5th in the bass) right before V. Despite being spelled as I, it actually functions as an embellishment of V - the 6th and 4th resolve down to the 5th and 3rd.",
            analogy: "It's like a dramatic pause before the hero's entrance - the I⁶₄ builds anticipation for the V that follows.",
            examples: ["I⁶₄ → V → I is the strongest cadence", "The bass stays on scale degree 5", "Found at the end of Classical pieces"],
            tip: "Use the cadential 6/4 for extra-strong endings. The I⁶₄ → V⁷ → I sequence is the gold standard of Classical cadences."
        },

        'augmented-sixth': {
            title: 'Augmented 6th Chords',
            category: 'Advanced Harmony',
            emoji: '🎻',
            gradientClass: 'from-purple-500 to-pink-500',
            explanation: "Augmented 6th chords contain the interval of an augmented 6th (usually between ♭6 and ♯4). This distinctive interval expands outward by half steps to an octave on the dominant. There are three types: Italian (3 notes), French (4 notes with #2), and German (4 notes with b3).",
            analogy: "Think of an augmented 6th as two arrows pointing outward - both notes want to spread apart by half step, landing perfectly on the dominant.",
            examples: ["Italian: ♭6, 1, ♯4", "French: ♭6, 1, 2, ♯4", "German: ♭6, 1, ♭3, ♯4"],
            tip: "Use augmented 6th chords to create dramatic chromatic approaches to the dominant. They're favorites of Romantic composers!"
        },

        'retrogression': {
            title: 'Retrogression',
            category: 'Harmonic Motion',
            emoji: '⬅️',
            gradientClass: 'from-orange-500 to-red-500',
            explanation: "Normal functional harmony moves T→S→D→T (tonic to subdominant to dominant to tonic). A retrogression reverses this, like D→S (dominant back to subdominant). It's unexpected but can create interesting effects.",
            analogy: "It's like walking backwards - unusual and attention-getting, but sometimes exactly what you want for dramatic effect.",
            examples: ["V→IV (dominant to subdominant)", "Common in rock and blues", "Creates a sense of 'going back'"],
            tip: "Retrogressions aren't wrong - they just break expectations. Use them intentionally for surprise or a modal/rock flavor."
        },

        'palindromic-progression': {
            title: 'Palindromic Progression',
            category: 'Form & Structure',
            emoji: '🔁',
            gradientClass: 'from-cyan-500 to-blue-500',
            explanation: "A palindrome reads the same forwards and backwards. In music, a palindromic progression creates beautiful arch-form symmetry - the chords mirror around a center point.",
            analogy: "Like the word 'RACECAR' or 'A MAN A PLAN A CANAL PANAMA' - the same both ways. Your progression creates musical symmetry!",
            examples: ["I-IV-V-IV-I", "Am-G-F-G-Am", "Creates sense of 'returning home'"],
            tip: "Palindromic progressions are great for verses that feel complete and balanced. The symmetry is deeply satisfying."
        },

        'suspension-resolution': {
            title: 'Suspension Resolution',
            category: 'Voice Leading',
            emoji: '🎵',
            gradientClass: 'from-teal-500 to-cyan-500',
            explanation: "A suspension occurs when a note from the previous chord is held over, creating temporary dissonance that then resolves. Sus4 chords (4th instead of 3rd) resolve the 4th down to 3rd; sus2 chords can resolve the 2nd up to 3rd.",
            analogy: "It's like holding your breath and then exhaling - the suspension creates tension, and the resolution brings relief.",
            examples: ["Csus4 → C (F resolves to E)", "Gsus4 → G (C resolves to B)", "Classic rock and pop sound"],
            tip: "Suspensions add melodic interest to chord changes. Try Dsus4→D for that classic acoustic guitar moment!"
        },

        'ostinato-pattern': {
            title: 'Ostinato (Repeating Pattern)',
            category: 'Form & Structure',
            emoji: '🔄',
            gradientClass: 'from-green-500 to-teal-500',
            explanation: "An ostinato is a short musical pattern that repeats throughout a piece. Rather than being monotonous, repetition creates groove, hypnotic effect, and allows melodies to shine over a stable foundation.",
            analogy: "It's like the heartbeat of your music - steady, reliable, and grounding. Think of how a drum loop lets a rapper flow freely.",
            examples: ["Am-F-C-G (repeated throughout)", "Pachelbel's Canon bass line", "Most EDM and pop songs"],
            tip: "Embrace repetition! A strong ostinato lets listeners lock in while you layer melodies, builds, and variations on top."
        },

        'chromatic-voice-motion': {
            title: 'Chromatic Voice Motion',
            category: 'Voice Leading',
            emoji: '🌈',
            gradientClass: 'from-pink-500 to-rose-500',
            explanation: "Chromatic voice motion occurs when inner voices (not just bass) move by half steps between chords. This creates smooth, expressive connections and can add color without changing the overall harmony dramatically.",
            analogy: "It's like a painter blending colors gradually rather than jumping from one to another - the transition is smooth and beautiful.",
            examples: ["C-E-G → C-E♭-G (major to minor)", "Inner voice descending chromatically", "Common in jazz and romantic music"],
            tip: "Listen to your inner voices! Small chromatic motions can transform ordinary progressions into something magical."
        },

        'voice-range-extreme': {
            title: 'Register Extreme',
            category: 'Voice Leading',
            emoji: '📊',
            gradientClass: 'from-indigo-500 to-violet-500',
            explanation: "When voices reach extreme high or low registers, it creates dramatic effect. High notes feel climactic and intense; low notes feel deep and powerful. Range expansion adds emotional weight.",
            analogy: "It's like raising your voice in excitement or lowering it for gravitas - the register conveys emotion.",
            examples: ["Soprano reaching high C", "Bass dropping to low E", "Climactic moments use range extremes"],
            tip: "Use register extremes sparingly for maximum impact. Save your highest and lowest notes for the most important moments."
        },

        'pedal-point': {
            title: 'Pedal Point',
            category: 'Advanced Harmony',
            emoji: '🎹',
            gradientClass: 'from-amber-500 to-orange-500',
            explanation: "A pedal point is a sustained or repeated note (usually in the bass) that continues while the harmonies above it change. It creates tension as dissonances occur, then resolution when the harmonies finally align.",
            analogy: "It's like standing firm while the world moves around you - the pedal is the anchor while chords float above.",
            examples: ["Tonic pedal at endings", "Dominant pedal building tension", "Bach used them extensively"],
            tip: "Try a tonic pedal under changing chords for a grounded, climactic ending. Or use a dominant pedal to build suspense!"
        },

        'tritone-substitution': {
            title: 'Tritone Substitution',
            category: 'Advanced Harmony',
            emoji: '🔄',
            gradientClass: 'from-violet-500 to-purple-500',
            explanation: "A tritone substitution replaces a dominant chord with another dominant chord a tritone away. G7 can become D♭7 because they share the same tritone (B and F). This creates chromatic bass motion.",
            analogy: "It's like a secret twin - the two chords share the same dissonant core (the tritone) but approach from different directions.",
            examples: ["G7 → C becomes D♭7 → C", "Creates chromatic bass: D♭→C", "Essential in jazz harmony"],
            tip: "Try replacing V7 with ♭II7 for instant jazz sophistication. The chromatic bass line sounds incredibly smooth."
        }
    };

    // Get content for this item, or generate a default
    const content = contentMap[item.id];

    if (content) {
        return content;
    }

    // Generate default content based on the item's own message
    const itemMessage = typeof item.message === 'object'
        ? item.message[skillLevel] || item.message.simple
        : item.message || '';

    return {
        title: item.title || 'Music Theory Concept',
        category: formatCategory(item.category) || 'Theory',
        emoji: item.emoji || '💡',
        gradientClass: getCategoryGradient(item.category),
        explanation: itemMessage || "This is an interesting pattern or technique in music theory. Experiment with it in your progressions!",
        tip: "Listen carefully to how this pattern sounds. Try to identify it in music you already know and love."
    };
}

/**
 * Get gradient class for a category
 * @param {string} category - Coach category
 * @returns {string} Tailwind gradient class
 */
function getCategoryGradient(category) {
    const gradients = {
        [COACH_CATEGORIES.CADENCE]: 'from-emerald-500 to-teal-500',
        [COACH_CATEGORIES.BORROWED_CHORD]: 'from-purple-500 to-indigo-500',
        [COACH_CATEGORIES.SECONDARY_DOMINANT]: 'from-red-500 to-orange-500',
        [COACH_CATEGORIES.SEQUENCE]: 'from-cyan-500 to-blue-500',
        [COACH_CATEGORIES.MODAL_PATTERN]: 'from-indigo-500 to-purple-500',
        [COACH_CATEGORIES.CHROMATIC_MEDIANT]: 'from-pink-500 to-purple-500',
        [COACH_CATEGORIES.VOICE_LEADING]: 'from-blue-500 to-cyan-500',
        [COACH_CATEGORIES.TENSION]: 'from-red-500 to-pink-500',
        [COACH_CATEGORIES.INVERSION]: 'from-violet-500 to-purple-500',
        [COACH_CATEGORIES.VOICE_LEADING_FIX]: 'from-yellow-500 to-amber-500',
        [COACH_CATEGORIES.HARMONIC_ENRICHMENT]: 'from-green-500 to-emerald-500',
        [COACH_CATEGORIES.RESOLUTION]: 'from-teal-500 to-cyan-500',
        [COACH_CATEGORIES.RHYTHM]: 'from-blue-500 to-purple-500',
        [COACH_CATEGORIES.MISSING_PATTERN]: 'from-amber-500 to-orange-500',
        [COACH_CATEGORIES.VARIETY]: 'from-violet-500 to-indigo-500',
        [COACH_CATEGORIES.STRUCTURE]: 'from-gray-500 to-slate-500'
    };
    return gradients[category] || 'from-indigo-500 to-purple-500';
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
        // Use fade animation if the nudge was opened with keepSummaryOpen, otherwise slide
        const animation = keepCurrentNudgeOpen ? 'coachFadeOut 0.2s ease-in forwards' : 'coachSlideOut 0.2s ease-in forwards';
        popup.style.animation = animation;
        setTimeout(() => popup.remove(), 200);
    }

    // Reset the keepOpen flag
    keepCurrentNudgeOpen = false;

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

        @keyframes coachFadeIn {
            from {
                opacity: 0;
                transform: scale(0.95);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        @keyframes coachFadeOut {
            from {
                opacity: 1;
                transform: scale(1);
            }
            to {
                opacity: 0;
                transform: scale(0.95);
            }
        }

        @keyframes coachHighlightPulse {
            0%, 100% {
                box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.6),
                            0 0 0 6px rgba(251, 191, 36, 0.3);
            }
            50% {
                box-shadow: 0 0 0 5px rgba(251, 191, 36, 0.8),
                            0 0 0 10px rgba(251, 191, 36, 0.4);
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

        /* Highlight animation for chord cards */
        .coach-highlight {
            animation: coachHighlightPulse 1s ease-in-out infinite !important;
            position: relative !important;
            z-index: 100 !important;
            outline: 3px solid #fbbf24 !important;
            outline-offset: 2px !important;
            border-radius: 12px !important;
        }

        .coach-highlight > * {
            /* Add a golden tint to child elements */
            background-blend-mode: overlay;
        }

        .coach-highlight::before {
            content: '👆';
            position: absolute;
            top: -28px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 20px;
            animation: bounce 0.5s ease-in-out infinite;
            z-index: 101;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }

        @keyframes bounce {
            0%, 100% { transform: translateX(-50%) translateY(0); }
            50% { transform: translateX(-50%) translateY(-5px); }
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
