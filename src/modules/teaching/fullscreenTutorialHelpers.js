/**
 * fullscreenTutorialHelpers.js
 *
 * Reusable infrastructure for guided exercises using the fullscreen
 * Chord Lab (chordlab-new) and Composition Studio (studio-new) tabs.
 *
 * This module provides:
 * 1. Selector mappings (classic -> fullscreen)
 * 2. Helper functions for common tutorial operations
 * 3. Step transformation utilities
 * 4. Visual highlighting helpers
 *
 * Based on patterns established in the Let It Be tutorials.
 */

// ===========================================
// SELECTOR MAPPINGS: Classic -> Fullscreen
// ===========================================

/**
 * Maps classic mode selectors to their fullscreen equivalents.
 * Used to transform existing tutorial steps for fullscreen mode.
 */
export const SELECTOR_MAP = {
    // Chord Lab selectors
    '#builder-note-selector': '#fs-root-buttons',
    '#builder-chord-type-selector': '#fs-chord-grid-container',
    '#builder-inversion-selector': '#fs-inversion-buttons',
    '#chord-root-selector': '#fs-root-buttons',
    '#chord-setup-panel': '#fs-chord-setup-sidebar',

    // FAB / Add chord buttons
    '#fab-add-chord-quick': '#fs-chordlab-fab button:first-child',
    '#fab-add-chord': '#fs-chordlab-fab button:first-child',

    // Progression Builder / Trainer selectors
    '#quick-add-chord-form-melody': '#fs-quick-add-panel',
    '#melody-progression-visualization': '#fs-chord-cards-container',
    '#melody-progression-setup-panel': '#fs-progression-setup',

    // Play buttons
    '#action-play-btn': '#fs-play-btn',

    // Tab targets
    'builder': 'chordlab-new',
    'trainer': 'studio-new',
};

/**
 * Maps chord types to their fullscreen selector.
 * The fullscreen Chord Lab uses data attributes for chord types.
 * @param {string} chordType - The chord type (e.g., "Major", "Minor")
 * @returns {string} The fullscreen selector for that chord type
 */
export function getChordTypeSelector(chordType) {
    return `#fs-chord-grid-container .key-button-wrapper[data-chord-type="${chordType}"]`;
}

/**
 * Maps root notes to their fullscreen button selector.
 * @param {string} rootNote - The root note (e.g., "C", "G")
 * @returns {string} The selector for finding that root button
 */
export function getRootButtonSelector(rootNote) {
    // Root buttons are found by text content, so we return the container
    // and handle the specific button in onEnter
    return '#fs-root-buttons';
}

// ===========================================
// TAB MAPPING
// ===========================================

/**
 * Maps classic tab names to fullscreen tab names
 */
export const TAB_MAP = {
    'builder': 'chordlab-new',
    'trainer': 'studio-new',
    'melody': 'studio-new',
    'scales': 'scale-explorer',
};

/**
 * Get the fullscreen tab name for a classic tab
 * @param {string} classicTab - Classic tab name
 * @returns {string} Fullscreen tab name
 */
export function getFullscreenTab(classicTab) {
    return TAB_MAP[classicTab] || classicTab;
}

// ===========================================
// VISUAL HIGHLIGHTING HELPERS
// ===========================================

/**
 * Standard purple glow effect used for highlighted elements
 */
export const HIGHLIGHT_STYLES = {
    purple: {
        boxShadow: '0 0 15px 5px rgba(139, 92, 246, 0.6)',
        color: 'rgba(139, 92, 246, 0.6)'
    },
    orange: {
        boxShadow: '0 0 15px 5px rgba(249, 115, 22, 0.6)',
        color: 'rgba(249, 115, 22, 0.6)'
    },
    indigo: {
        boxShadow: '0 0 15px 5px rgba(99, 102, 241, 0.8)',
        color: 'rgba(99, 102, 241, 0.8)'
    },
    red: {
        boxShadow: '0 0 15px 5px rgba(239, 68, 68, 0.6)',
        color: 'rgba(239, 68, 68, 0.6)'
    },
    green: {
        boxShadow: '0 0 15px 5px rgba(34, 197, 94, 0.6)',
        color: 'rgba(34, 197, 94, 0.6)'
    }
};

/**
 * Apply pulsing highlight to an element
 * @param {HTMLElement|string} elementOrSelector - Element or CSS selector
 * @param {string} color - Color name from HIGHLIGHT_STYLES (default: 'purple')
 * @param {boolean} scale - Whether to also scale the element (default: false)
 */
export function applyHighlight(elementOrSelector, color = 'purple', scale = false) {
    const element = typeof elementOrSelector === 'string'
        ? document.querySelector(elementOrSelector)
        : elementOrSelector;

    if (!element) return;

    const styles = HIGHLIGHT_STYLES[color] || HIGHLIGHT_STYLES.purple;
    element.classList.add('animate-pulse');
    element.style.boxShadow = styles.boxShadow;

    if (scale) {
        element.style.transform = 'scale(1.1)';
    }
}

/**
 * Remove highlight from an element
 * @param {HTMLElement|string} elementOrSelector - Element or CSS selector
 */
export function removeHighlight(elementOrSelector) {
    const element = typeof elementOrSelector === 'string'
        ? document.querySelector(elementOrSelector)
        : elementOrSelector;

    if (!element) return;

    element.classList.remove('animate-pulse');
    element.style.boxShadow = '';
    element.style.transform = '';
}

/**
 * Clear all root button highlights in fullscreen Chord Lab
 */
export function clearRootButtonHighlights() {
    const rootButtons = document.querySelector('#fs-root-buttons');
    if (rootButtons) {
        rootButtons.querySelectorAll('button').forEach(btn => {
            removeHighlight(btn);
        });
    }
}

/**
 * Highlight a specific root button by note name
 * @param {string} noteName - The note name (e.g., "C", "G", "A")
 * @param {string} color - Color from HIGHLIGHT_STYLES (default: 'purple')
 */
export function highlightRootButton(noteName, color = 'purple') {
    clearRootButtonHighlights();

    setTimeout(() => {
        const rootButtons = document.querySelector('#fs-root-buttons');
        if (rootButtons) {
            const btn = Array.from(rootButtons.querySelectorAll('button'))
                .find(b => b.textContent.trim() === noteName);
            if (btn) {
                applyHighlight(btn, color);
            }
        }
    }, 300);
}

/**
 * Highlight a chord type button in the fullscreen Chord Lab library
 * @param {string} chordType - The chord type (e.g., "Major", "Minor")
 * @param {string} color - Color from HIGHLIGHT_STYLES (default: 'purple')
 */
export function highlightChordTypeButton(chordType, color = 'purple') {
    setTimeout(() => {
        const selector = getChordTypeSelector(chordType);
        const btn = document.querySelector(selector);
        if (btn) {
            applyHighlight(btn, color);
        }
    }, 300);
}

/**
 * Remove highlight from a chord type button
 * @param {string} chordType - The chord type to un-highlight
 */
export function removeChordTypeHighlight(chordType) {
    const selector = getChordTypeSelector(chordType);
    const btn = document.querySelector(selector);
    if (btn) {
        removeHighlight(btn);
    }
}

/**
 * Highlight the Add Chord FAB button
 * @param {string} color - Color from HIGHLIGHT_STYLES (default: 'indigo')
 */
export function highlightAddChordButton(color = 'indigo') {
    setTimeout(() => {
        const addBtn = document.querySelector('#fs-chordlab-fab button:first-child');
        if (addBtn) {
            applyHighlight(addBtn, color, true); // with scale
        }
    }, 300);
}

/**
 * Remove highlight from the Add Chord FAB button
 */
export function removeAddChordButtonHighlight() {
    const addBtn = document.querySelector('#fs-chordlab-fab button:first-child');
    if (addBtn) {
        removeHighlight(addBtn);
    }
}

// ===========================================
// DOCK PANEL HELPERS
// ===========================================

/**
 * Open a dock panel in the fullscreen Composition Studio
 * @param {string} panelId - The panel ID ('chords', 'quick-add', 'sections', etc.)
 */
export function openDockPanel(panelId) {
    const editor = window.getFullScreenNotationEditor?.();
    if (editor?.bottomPanel) {
        if (editor.bottomPanel.activePanel !== panelId) {
            editor.bottomPanel.toggle(panelId);
        }
    }
}

/**
 * Close the active dock panel in the fullscreen Composition Studio
 */
export function closeDockPanel() {
    const editor = window.getFullScreenNotationEditor?.();
    if (editor?.bottomPanel?.activePanel) {
        editor.bottomPanel.closeActivePanel();
    }
}

/**
 * Check if a specific dock panel is open
 * @param {string} panelId - The panel ID to check
 * @returns {boolean} True if the panel is open
 */
export function isDockPanelOpen(panelId) {
    const editor = window.getFullScreenNotationEditor?.();
    return editor?.bottomPanel?.activePanel === panelId;
}

// ===========================================
// SPOTLIGHT PASSTHROUGH HELPERS
// ===========================================

/**
 * Enable click passthrough on the spotlight overlay
 * Used when users need to interact with spotlit elements
 */
export function enableSpotlightPassthrough() {
    const overlay = document.getElementById('guided-spotlight-overlay');
    if (overlay) {
        overlay.style.pointerEvents = 'none';
    }
}

/**
 * Disable click passthrough on the spotlight overlay
 */
export function disableSpotlightPassthrough() {
    const overlay = document.getElementById('guided-spotlight-overlay');
    if (overlay) {
        overlay.style.pointerEvents = 'auto';
    }
}

// ===========================================
// STEP TRANSFORMATION
// ===========================================

/**
 * Transform a classic mode step to use fullscreen selectors
 * This is the main utility for migrating existing tutorials
 *
 * @param {Object} step - The original step definition
 * @param {Object} options - Transformation options
 * @returns {Object} The transformed step for fullscreen mode
 */
export function transformStepForFullscreen(step, options = {}) {
    const transformed = { ...step };

    // Transform spotlight selector
    if (step.spotlight) {
        transformed.spotlight = transformSelector(step.spotlight, step);
    }

    // Transform targetElement selector
    if (step.targetElement) {
        transformed.targetElement = transformSelector(step.targetElement, step);
    }

    // Add quickAdvance if validation exists and not explicitly set
    if (step.validation && transformed.quickAdvance === undefined) {
        transformed.quickAdvance = true;
    }

    return transformed;
}

/**
 * Transform a selector from classic to fullscreen format
 * @param {string} selector - The classic mode selector
 * @param {Object} step - The step object (for context like validation value)
 * @returns {string} The fullscreen selector
 */
function transformSelector(selector, step = {}) {
    // Check if this is a chord type selector that needs special handling
    if (selector === '#builder-chord-type-selector' && step.validation?.value) {
        return getChordTypeSelector(step.validation.value);
    }

    // Check direct mapping
    if (SELECTOR_MAP[selector]) {
        return SELECTOR_MAP[selector];
    }

    // Return original if no mapping exists
    return selector;
}

/**
 * Transform an entire guidedSteps array for fullscreen mode
 * @param {Array} steps - Array of step definitions
 * @param {Object} options - Transformation options
 * @returns {Array} Transformed steps array
 */
export function transformStepsForFullscreen(steps, options = {}) {
    return steps.map(step => transformStepForFullscreen(step, options));
}

// ===========================================
// onEnter/onExit FACTORY FUNCTIONS
// ===========================================

/**
 * Create an onEnter callback for highlighting a root button
 * @param {string} noteName - The note to highlight
 * @param {string} color - Highlight color (default: 'purple')
 * @returns {Function} onEnter callback
 */
export function createRootButtonOnEnter(noteName, color = 'purple') {
    return () => {
        highlightRootButton(noteName, color);
    };
}

/**
 * Create an onExit callback for clearing root button highlights
 * @returns {Function} onExit callback
 */
export function createRootButtonOnExit() {
    return () => {
        clearRootButtonHighlights();
    };
}

/**
 * Create an onEnter callback for highlighting a chord type button
 * @param {string} chordType - The chord type to highlight
 * @param {string} color - Highlight color (default: 'purple')
 * @returns {Function} onEnter callback
 */
export function createChordTypeOnEnter(chordType, color = 'purple') {
    return () => {
        highlightChordTypeButton(chordType, color);
    };
}

/**
 * Create an onExit callback for removing chord type highlight
 * @param {string} chordType - The chord type to un-highlight
 * @returns {Function} onExit callback
 */
export function createChordTypeOnExit(chordType) {
    return () => {
        removeChordTypeHighlight(chordType);
    };
}

/**
 * Create an onEnter callback for highlighting the Add Chord button
 * @param {string} color - Highlight color (default: 'indigo')
 * @returns {Function} onEnter callback
 */
export function createAddChordOnEnter(color = 'indigo') {
    return () => {
        highlightAddChordButton(color);
    };
}

/**
 * Create an onExit callback for removing Add Chord button highlight
 * @returns {Function} onExit callback
 */
export function createAddChordOnExit() {
    return () => {
        removeAddChordButtonHighlight();
    };
}

/**
 * Create an onEnter callback for highlighting a tab button
 * @param {string} tabId - The tab button ID (e.g., 'header-tab-btn-builder')
 * @param {string} color - Highlight color (default: 'orange')
 * @returns {Function} onEnter callback
 */
export function createTabButtonOnEnter(tabId, color = 'orange') {
    return () => {
        const btn = document.getElementById(tabId);
        if (btn) {
            // Re-enable the button if it was disabled during tutorial
            btn.removeAttribute('data-tutorial-disabled');
            btn.style.opacity = '';
            btn.style.pointerEvents = '';
            applyHighlight(btn, color);
        }
    };
}

/**
 * Create an onExit callback for removing tab button highlight
 * @param {string} tabId - The tab button ID
 * @returns {Function} onExit callback
 */
export function createTabButtonOnExit(tabId) {
    return () => {
        const btn = document.getElementById(tabId);
        if (btn) {
            removeHighlight(btn);
        }
    };
}

// ===========================================
// FULLSCREEN STEP BUILDERS
// ===========================================

/**
 * Create a step for selecting a root note in fullscreen Chord Lab
 * @param {string} noteName - The note to select (e.g., "C")
 * @param {Object} options - Additional step options
 * @returns {Object} Complete step definition
 */
export function createRootSelectionStep(noteName, options = {}) {
    return {
        instruction: options.instruction || `Click "${noteName}" in the Root section.`,
        spotlight: '#fs-root-buttons',
        targetElement: '#fs-root-buttons',
        spotlightPadding: 8,
        callout: options.callout || null,
        validation: { type: 'root_selected', value: noteName },
        successMessage: options.successMessage || `${noteName} selected!`,
        quickAdvance: true,
        onEnter: createRootButtonOnEnter(noteName, options.color || 'purple'),
        onExit: createRootButtonOnExit()
    };
}

/**
 * Create a step for selecting a chord type in fullscreen Chord Lab
 * @param {string} chordType - The chord type to select (e.g., "Major")
 * @param {Object} options - Additional step options
 * @returns {Object} Complete step definition
 */
export function createChordTypeSelectionStep(chordType, options = {}) {
    return {
        instruction: options.instruction || `Select "${chordType}" in the Library panel.`,
        spotlight: getChordTypeSelector(chordType),
        targetElement: getChordTypeSelector(chordType),
        spotlightPadding: 8,
        callout: options.callout || null,
        validation: { type: 'type_selected', value: chordType },
        successMessage: options.successMessage || `${chordType} selected!`,
        quickAdvance: options.quickAdvance !== false,
        onEnter: createChordTypeOnEnter(chordType, options.color || 'purple'),
        onExit: createChordTypeOnExit(chordType)
    };
}

/**
 * Create a step for adding a chord to progression in fullscreen Chord Lab
 * @param {string} root - The chord root (e.g., "C")
 * @param {string} type - The chord type (e.g., "Major")
 * @param {Object} options - Additional step options
 * @returns {Object} Complete step definition
 */
export function createAddChordStep(root, type, options = {}) {
    const chordName = `${root} ${type}`;
    return {
        instruction: options.instruction || 'Click the indigo "+" button to add this chord to your progression.',
        spotlight: '#fs-chordlab-fab button:first-child',
        targetElement: '#fs-chordlab-fab button:first-child',
        spotlightPadding: 12,
        callout: options.callout || null,
        validation: { type: 'chord_added_to_progression', value: chordName },
        successMessage: options.successMessage || `${chordName} added!`,
        onEnter: createAddChordOnEnter('indigo'),
        onExit: createAddChordOnExit()
    };
}

/**
 * Create a step for navigating to a tab
 * @param {string} targetTab - The tab to navigate to ('chordlab-new' or 'studio-new')
 * @param {Object} options - Additional step options
 * @returns {Object} Complete step definition
 */
export function createTabNavigationStep(targetTab, options = {}) {
    const isChordLab = targetTab === 'chordlab-new' || targetTab === 'builder';
    const tabButtonId = isChordLab ? 'header-tab-btn-builder' : 'header-tab-btn-melody';
    const tabLabel = isChordLab ? 'Chord Lab' : 'Composition Studio';
    const fullscreenTab = isChordLab ? 'chordlab-new' : 'studio-new';

    return {
        instruction: options.instruction || `Click "${tabLabel}" in the navigation.`,
        spotlight: `#${tabButtonId}`,
        targetElement: `#${tabButtonId}`,
        spotlightPadding: 8,
        callout: options.callout || null,
        isActionStep: true,
        validation: { type: 'tab_selected', value: fullscreenTab },
        successMessage: options.successMessage || `Welcome to the ${tabLabel}!`,
        quickAdvance: true,
        onEnter: createTabButtonOnEnter(tabButtonId, 'orange'),
        onExit: createTabButtonOnExit(tabButtonId)
    };
}

/**
 * Create an info-only step (no validation required)
 * @param {string} instruction - The instruction text
 * @param {Object} options - Additional step options
 * @returns {Object} Complete step definition
 */
export function createInfoStep(instruction, options = {}) {
    return {
        instruction,
        spotlight: options.spotlight || null,
        targetElement: options.targetElement || null,
        scrollTarget: options.scrollTarget || null, // Scroll to element without spotlighting
        callout: options.callout || null,
        validation: null,
        successMessage: null
    };
}

/**
 * Create a chord playback step with spotlight on Play button (Chord Lab)
 * @param {Object} options - Step options
 * @returns {Object} Complete step definition
 */
export function createPlayChordStep(options = {}) {
    return {
        instruction: options.instruction || 'Press and hold the green Play button to hear the chord.',
        spotlight: '#fs-fab-play-chord-quick',
        targetElement: '#fs-fab-play-chord-quick',
        callout: options.callout || null,
        validation: { type: 'chord_played' },
        successMessage: options.successMessage || 'Great! You played the chord.',
        onEnter: () => {
            // Highlight the Play Chord button
            setTimeout(() => {
                const playBtn = document.querySelector('#fs-fab-play-chord-quick');
                if (playBtn) {
                    playBtn.classList.add('animate-pulse');
                    playBtn.style.boxShadow = '0 0 15px 5px rgba(34, 197, 94, 0.8)';
                    playBtn.style.transform = 'scale(1.1)';
                }
            }, 100);
        },
        onExit: () => {
            const playBtn = document.querySelector('#fs-fab-play-chord-quick');
            if (playBtn) {
                playBtn.classList.remove('animate-pulse');
                playBtn.style.boxShadow = '';
                playBtn.style.transform = '';
            }
        }
    };
}

/**
 * Create a progression playback step with spotlight on the green floating Play button (Composition Studio)
 * Use this for steps that play the full progression in studio-new tab
 * @param {Object} options - Step options
 * @returns {Object} Complete step definition
 */
export function createPlayProgressionStep(options = {}) {
    return {
        instruction: options.instruction || 'Click the green Play button to hear your progression!',
        spotlight: '#fs-fab-quick-play',
        targetElement: '#fs-fab-quick-play',
        callout: options.callout || null,
        validation: { type: 'chord_played' },
        successMessage: options.successMessage || 'Great! You played the progression.',
        onEnter: () => {
            // Highlight the Play All button with green glow
            setTimeout(() => {
                const playBtn = document.querySelector('#fs-fab-quick-play');
                if (playBtn) {
                    playBtn.classList.add('animate-pulse');
                    playBtn.style.boxShadow = '0 0 15px 5px rgba(34, 197, 94, 0.8)';
                    playBtn.style.transform = 'scale(1.1)';
                }
            }, 100);
        },
        onExit: () => {
            const playBtn = document.querySelector('#fs-fab-quick-play');
            if (playBtn) {
                playBtn.classList.remove('animate-pulse');
                playBtn.style.boxShadow = '';
                playBtn.style.transform = '';
            }
        }
    };
}

/**
 * Create steps to play a progression in Chord Lab (chordlab-new tab)
 * This is a 3-step process:
 *   1. Click the FAB + button to expand the menu
 *   2. Click the Playback category button
 *   3. Click "Play Progression"
 *
 * @param {Object} options - Step options
 * @param {string} options.instruction - Final instruction shown on step 3 (optional)
 * @param {string} options.callout - Educational callout shown on step 3 (optional)
 * @param {string} options.successMessage - Success message after playing (optional)
 * @returns {Array} Array of 3 step definitions
 */
export function createChordLabPlayProgressionSteps(options = {}) {
    return [
        // Step 1: Open FAB menu
        {
            instruction: 'Click the + button to open the actions menu.',
            spotlight: '#fs-fab-main',
            targetElement: '#fs-fab-main',
            callout: null,
            validation: { type: 'fab_menu_opened' },
            successMessage: 'Menu opened!',
            onEnter: () => {
                setTimeout(() => {
                    const fabMain = document.querySelector('#fs-fab-main');
                    if (fabMain) {
                        fabMain.classList.add('animate-pulse');
                        fabMain.style.boxShadow = '0 0 15px 5px rgba(99, 102, 241, 0.8)';
                        fabMain.style.transform = 'scale(1.1)';
                    }
                }, 100);
            },
            onExit: () => {
                const fabMain = document.querySelector('#fs-fab-main');
                if (fabMain) {
                    fabMain.classList.remove('animate-pulse');
                    fabMain.style.boxShadow = '';
                    fabMain.style.transform = '';
                }
            }
        },
        // Step 2: Click Playback category
        {
            instruction: 'Click the green Playback button.',
            spotlight: '.fs-fab-category[data-category="playback"] .fs-fab-category-btn',
            targetElement: '.fs-fab-category[data-category="playback"] .fs-fab-category-btn',
            callout: null,
            validation: { type: 'playback_submenu_opened' },
            successMessage: 'Playback menu opened!',
            onEnter: () => {
                setTimeout(() => {
                    const playbackBtn = document.querySelector('.fs-fab-category[data-category="playback"] .fs-fab-category-btn');
                    if (playbackBtn) {
                        playbackBtn.classList.add('animate-pulse');
                        playbackBtn.style.boxShadow = '0 0 15px 5px rgba(34, 197, 94, 0.8)';
                        playbackBtn.style.transform = 'scale(1.1)';
                    }
                }, 100);
            },
            onExit: () => {
                const playbackBtn = document.querySelector('.fs-fab-category[data-category="playback"] .fs-fab-category-btn');
                if (playbackBtn) {
                    playbackBtn.classList.remove('animate-pulse');
                    playbackBtn.style.boxShadow = '';
                    playbackBtn.style.transform = '';
                }
            }
        },
        // Step 3: Click Play Progression
        // IMPORTANT: Use .fs-fab-submenu prefix to target the VISIBLE button in the submenu,
        // not the hidden one elsewhere in the DOM
        {
            instruction: options.instruction || 'Click "Play Progression" to hear your chord progression!',
            spotlight: '.fs-fab-submenu button[data-action="play-builder-progression"]',
            targetElement: '.fs-fab-submenu button[data-action="play-builder-progression"]',
            callout: options.callout || null,
            validation: { type: 'progression_played' },
            successMessage: options.successMessage || 'Great! You played the progression.',
            onEnter: () => {
                // The button should already be visible since the submenu was just opened
                // Try multiple times with increasing delays to handle animation timing
                const highlightButton = () => {
                    const playProgBtn = document.querySelector('.fs-fab-submenu button[data-action="play-builder-progression"]');
                    if (playProgBtn) {
                        playProgBtn.classList.add('animate-pulse');
                        playProgBtn.style.boxShadow = '0 0 15px 5px rgba(59, 130, 246, 0.8)';
                        playProgBtn.style.transform = 'scale(1.05)';
                        return true;
                    }
                    return false;
                };

                // Try immediately, then at 100ms, 300ms, 500ms
                if (!highlightButton()) {
                    setTimeout(() => {
                        if (!highlightButton()) {
                            setTimeout(() => {
                                if (!highlightButton()) {
                                    setTimeout(highlightButton, 200);
                                }
                            }, 200);
                        }
                    }, 100);
                }
            },
            onExit: () => {
                const playProgBtn = document.querySelector('.fs-fab-submenu button[data-action="play-builder-progression"]');
                if (playProgBtn) {
                    playProgBtn.classList.remove('animate-pulse');
                    playProgBtn.style.boxShadow = '';
                    playProgBtn.style.transform = '';
                }
            }
        }
    ];
}

/**
 * Create a keyboard viewing step that repositions the Chord Lab content
 * so the keyboard is visible below the banner overlay.
 *
 * Use this when you want to draw attention to the keyboard highlighting
 * without requiring any user action.
 *
 * @param {string} instruction - The instruction text
 * @param {Object} options - Step options
 * @param {string} options.callout - Educational context
 * @returns {Object} Complete step definition
 */
export function createKeyboardStep(instruction, options = {}) {
    return {
        instruction,
        spotlight: '#fs-chordlab-keyboard-area',
        targetElement: '#fs-chordlab-keyboard-area',
        callout: options.callout || null,
        validation: null,
        successMessage: null,
        onEnter: () => {
            // Push the Chord Lab content down so keyboard is visible below the banner
            const chordLabContent = document.querySelector('#chordlab-new-content');
            const banner = document.querySelector('#lesson-guided-banner');
            if (chordLabContent && banner) {
                const bannerHeight = banner.offsetHeight;
                chordLabContent.style.transition = 'margin-top 0.3s ease-in-out';
                chordLabContent.style.marginTop = `${bannerHeight}px`;
                // Update spotlight position after transition completes
                setTimeout(() => {
                    if (window.forceSpotlightUpdate) {
                        window.forceSpotlightUpdate();
                    }
                }, 350);
            }
        },
        onExit: () => {
            // Remove the margin when leaving this step
            const chordLabContent = document.querySelector('#chordlab-new-content');
            if (chordLabContent) {
                chordLabContent.style.marginTop = '';
            }
        }
    };
}

// ===========================================
// TUTORIAL SETUP HELPERS
// ===========================================

/**
 * Standard tutorial setup - clear progression, reset BPM, disable tooltips
 * Call this at the start of fullscreen tutorials
 */
export function setupFullscreenTutorial() {
    // Set flag to suppress Theory Moments during tutorial setup
    window.isTutorialSetupInProgress = true;

    // Clear the progression
    if (window.clearProgression) {
        window.clearProgression(true);
    }

    // Reset BPM to 120
    const defaultBpm = 120;
    window.g_Tempo = defaultBpm;
    if (window.setPlaybackBPM) window.setPlaybackBPM(defaultBpm);
    if (window.setMelodyTempo) window.setMelodyTempo(defaultBpm);

    // Update BPM UI elements
    const bpmElements = [
        { slider: 'fab-bpm-slider', value: 'fab-bpm-value' },
        { slider: 'fs-fab-bpm-slider', value: 'fs-fab-bpm-value' }
    ];

    bpmElements.forEach(({ slider, value }) => {
        const sliderEl = document.getElementById(slider);
        const valueEl = document.getElementById(value);
        if (sliderEl) sliderEl.value = defaultBpm;
        if (valueEl) valueEl.textContent = defaultBpm;
    });

    // Disable chord card tooltips during tutorial
    document.body.classList.add('progression-tooltips-disabled');

    // Disable tooltips in fullscreen Chord Lab
    if (window.chordLabBottomPanel) {
        window.chordLabBottomPanel.tooltipsEnabled = false;
    }

    const tooltipsToggle = document.getElementById('fs-details-toggle');
    if (tooltipsToggle) {
        tooltipsToggle.checked = false;
        const toggleContainer = tooltipsToggle.closest('.flex.items-center');
        if (toggleContainer) {
            toggleContainer.dataset.tutorialDisabled = 'true';
            toggleContainer.style.opacity = '0.4';
            toggleContainer.style.pointerEvents = 'none';
        }
    }
}

/**
 * Standard tutorial cleanup
 * Call this in onComplete callback
 */
export function cleanupFullscreenTutorial() {
    // Re-enable tooltips
    document.body.classList.remove('progression-tooltips-disabled');

    // Re-enable tooltips in fullscreen Chord Lab
    if (window.chordLabBottomPanel) {
        window.chordLabBottomPanel.tooltipsEnabled = true;
    }

    const tooltipsToggle = document.getElementById('fs-details-toggle');
    if (tooltipsToggle) {
        const toggleContainer = tooltipsToggle.closest('.flex.items-center');
        if (toggleContainer) {
            toggleContainer.removeAttribute('data-tutorial-disabled');
            toggleContainer.style.opacity = '';
            toggleContainer.style.pointerEvents = '';
        }
    }

    // Clear tutorial setup flag
    window.isTutorialSetupInProgress = false;
}

// ===========================================
// EXPORTS
// ===========================================

export default {
    // Selector mappings
    SELECTOR_MAP,
    TAB_MAP,
    getChordTypeSelector,
    getRootButtonSelector,
    getFullscreenTab,

    // Visual highlighting
    HIGHLIGHT_STYLES,
    applyHighlight,
    removeHighlight,
    clearRootButtonHighlights,
    highlightRootButton,
    highlightChordTypeButton,
    removeChordTypeHighlight,
    highlightAddChordButton,
    removeAddChordButtonHighlight,

    // Dock panel helpers
    openDockPanel,
    closeDockPanel,
    isDockPanelOpen,

    // Spotlight helpers
    enableSpotlightPassthrough,
    disableSpotlightPassthrough,

    // Step transformation
    transformStepForFullscreen,
    transformStepsForFullscreen,

    // Factory functions for onEnter/onExit
    createRootButtonOnEnter,
    createRootButtonOnExit,
    createChordTypeOnEnter,
    createChordTypeOnExit,
    createAddChordOnEnter,
    createAddChordOnExit,
    createTabButtonOnEnter,
    createTabButtonOnExit,

    // Step builders
    createRootSelectionStep,
    createChordTypeSelectionStep,
    createAddChordStep,
    createTabNavigationStep,
    createInfoStep,
    createPlayChordStep,
    createPlayProgressionStep,
    createChordLabPlayProgressionSteps,

    // Setup/cleanup
    setupFullscreenTutorial,
    cleanupFullscreenTutorial
};
