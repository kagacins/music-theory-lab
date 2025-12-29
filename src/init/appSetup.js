/**
 * appSetup.js
 *
 * Application setup and initialization logic.
 * This module handles:
 * - Initial UI state setup (toggle states, indicators)
 * - Saved state loading from localStorage
 * - Dark mode initialization
 * - Responsive title configuration
 * - Initial rendering and keyboard setup
 *
 * Extracted from main.js Phase 3.2 refactoring.
 */

import {
    switchTab
} from '../modules/ui/tabs.js';

import {
    getCurrentTab,
    getEnharmonicPreference,
    getIsRomanNumeralEngineOn,
    getIsKeyNamesOn,
    getIsClassicKeyboardOn,
    getIsCompactModeOn,
    getIsDarkModeOn,
    getIsFretboardModeOn,
    getNotationPreference,
    getNumOctaves
} from '../modules/state/globalState.js';

import {
    getTrainerState
} from '../modules/state/trainerState.js';

import {
    renderKeyboard,
    updateKeyboardLabels
} from '../modules/ui/keyboard.js';

import {
    renderProgressionControls,
    renderProgressionDisplay,
    loadProgression
} from '../modules/features/progressionBuilder/index.js';

import {
    renderBuilderSelectors,
    updateLHInversionSelector,
    updateBuilderOctaveUI
} from '../modules/features/chordBuilder.js';

import {
    renderScaleSelectors,
    updateScaleOctaveUI,
    updateScaleSpeedUI
} from '../modules/features/scaleExplorer.js';

import {
    updateArpeggioSpeedUI
} from '../modules/audio/arpeggiator.js';

import {
    restoreSettingsGroupStates,
    restoreHeaderDisplaysState
} from '../modules/ui/sidebar.js';

import {
    initTabHistory
} from '../modules/ui/tabs.js';

import {
    getCompositionState
} from '../modules/state/compositionState.js';

import {
    setMelodyClef,
    setChordClef
} from '../modules/audio/melodyGenerator.js';

/**
 * Handle tooltips on mobile/touch devices
 * Native title tooltips can interfere with button presses on touch devices
 */
function handleMobileTooltips() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
        // Remove title attributes from buttons on touch devices
        const buttons = document.querySelectorAll('button[title]');
        buttons.forEach(btn => {
            btn.removeAttribute('title');
        });
    }
}

/**
 * Setup responsive title abbreviation
 * Adjusts title text based on viewport width
 */
function setupResponsiveTitle() {
    const updateTitle = () => {
        const titleElement = document.querySelector('h1');
        if (!titleElement) return;

        const width = window.innerWidth;
        if (width < 640) {
            // Mobile: shortest version
            titleElement.textContent = 'MTL';
        } else if (width < 768) {
            // Small screens: abbreviated
            titleElement.textContent = 'Music Theory Lab';
        } else {
            // Desktop: full title
            titleElement.textContent = 'Music Theory Lab';
        }
    };

    updateTitle();
    window.addEventListener('resize', updateTitle);
}

/**
 * Main app setup function
 * Called from main.js after window exports are initialized
 */
export function setupApp() {
    // Clear any old landing page skip preference (we now always show landing page)
    localStorage.removeItem('skipLandingPage');

    // Scroll all tab content areas to top on initial page load
    const tabIds = ['tab-builder', 'tab-melody', 'tab-scales', 'tab-learn'];
    tabIds.forEach(tabId => {
        const tabContent = document.getElementById(tabId);
        if (tabContent) {
            tabContent.scrollTop = 0;
        }
    });
    // Also scroll the main window to top
    window.scrollTo(0, 0);

    // Calculate and set keyboard sticky position based on header height
    const header = document.getElementById('main-header');
    if (header) {
        const headerHeight = header.offsetHeight;
        const headerTop = parseInt(getComputedStyle(header).top) || 16; // top-4 = 1rem = 16px
        const keyboardTop = headerHeight + headerTop;
        document.documentElement.style.setProperty('--header-height', `${keyboardTop}px`);
    }

    // Set initial tab data attribute on body
    document.body.setAttribute('data-active-tab', getCurrentTab());

    // Handle tooltips on mobile/touch devices
    handleMobileTooltips();

    // Hide Tab hint banner if user previously dismissed it
    const tabHintBanner = document.getElementById('tab-hint-banner');
    if (tabHintBanner && localStorage.getItem('tab-hint-dismissed') === 'true') {
        tabHintBanner.classList.add('hidden');
    }

    // ===========================
    // INITIAL UI RENDERING
    // ===========================

    // Ensure g_NumOctaves is available
    window.g_NumOctaves = getNumOctaves();

    // Render initial UI
    renderKeyboard();
    // Expose g_KeyboardKeys to window for modules that need it
    // Note: g_KeyboardKeys is set by renderKeyboard()
    window.g_KeyboardKeys = window.g_KeyboardKeys || [];

    renderProgressionControls();
    renderProgressionDisplay();
    renderBuilderSelectors();
    renderScaleSelectors();

    // Initialize window state for modules that access it
    window.currentTab = getCurrentTab();
    window.enharmonicPreference = getEnharmonicPreference();
    window.isRomanNumeralEngineOn = getIsRomanNumeralEngineOn();
    window.isKeyNamesOn = getIsKeyNamesOn();

    // Initialize browser history support for tab navigation
    initTabHistory();

    // ===========================
    // TOGGLE STATE INITIALIZATION
    // ===========================

    // Initialize Chord Lab enharmonic toggle state (if it exists)
    const chordLabEnharmonicToggle = document.getElementById('chordlab-enharmonic-toggle');
    if (chordLabEnharmonicToggle) {
        // enharmonic: initial preference is 'sharp', so toggle should be unchecked (false = sharp)
        chordLabEnharmonicToggle.checked = getEnharmonicPreference() === 'flat';
        // Update enharmonic indicators to match initial state
        const sharpIndicator = document.getElementById('chordlab-sharp-indicator');
        const flatIndicator = document.getElementById('chordlab-flat-indicator');
        if (sharpIndicator && flatIndicator) {
            if (getEnharmonicPreference() === 'sharp') {
                sharpIndicator.className = 'text-[9px] font-semibold text-white/90';
                flatIndicator.className = 'text-[9px] font-semibold text-white/60';
            } else {
                sharpIndicator.className = 'text-[9px] font-semibold text-white/60';
                flatIndicator.className = 'text-[9px] font-semibold text-white/90';
            }
        }
    }

    // Initialize toggle states (with null checks for optional toggles)
    const notationToggle = document.getElementById('notation-toggle');
    if (notationToggle) notationToggle.checked = false;
    const romanNumeralToggle = document.getElementById('roman-numeral-toggle');
    if (romanNumeralToggle) romanNumeralToggle.checked = false;
    const keyNamesToggle = document.getElementById('key-names-toggle');
    if (keyNamesToggle) keyNamesToggle.checked = false;
    const classicKeyboardToggle = document.getElementById('classic-keyboard-toggle');
    if (classicKeyboardToggle) classicKeyboardToggle.checked = false;
    const compactControlsToggle = document.getElementById('compact-controls-toggle');
    if (compactControlsToggle) compactControlsToggle.checked = false;

    // Initialize chord tone highlighting toggle
    const chordToneToggle = document.getElementById('chord-tone-highlighting-toggle');
    if (chordToneToggle) {
        // Get current setting from localStorage or CompositionState
        let chordToneEnabled = true;
        try {
            if (window.getCompositionState) {
                const compositionState = window.getCompositionState();
                const settings = compositionState.getSettings();
                chordToneEnabled = settings.highlightChordTones !== false;
            } else {
                const stored = localStorage.getItem('chord-tone-highlighting');
                chordToneEnabled = stored !== 'false';
            }
        } catch (e) {
            const stored = localStorage.getItem('chord-tone-highlighting');
            chordToneEnabled = stored !== 'false';
        }
        chordToneToggle.checked = chordToneEnabled;

        // Update indicator colors
        const offIndicator = document.getElementById('chord-tone-off-indicator');
        const onIndicator = document.getElementById('chord-tone-on-indicator');
        if (chordToneEnabled) {
            if (onIndicator) {
                onIndicator.classList.remove('text-gray-500');
                onIndicator.classList.add('text-indigo-300');
            }
            if (offIndicator) {
                offIndicator.classList.remove('text-indigo-300');
                offIndicator.classList.add('text-gray-500');
            }
        } else {
            if (offIndicator) {
                offIndicator.classList.remove('text-gray-500');
                offIndicator.classList.add('text-indigo-300');
            }
            if (onIndicator) {
                onIndicator.classList.remove('text-indigo-300');
                onIndicator.classList.add('text-gray-500');
            }
        }
    }

    // Initialize chord spans toggle
    const chordSpansToggle = document.getElementById('chord-spans-toggle');
    if (chordSpansToggle) {
        // Get current setting from localStorage or CompositionState
        let chordSpansEnabled = true; // Default to true (checked)
        try {
            if (window.getCompositionState) {
                const compositionState = window.getCompositionState();
                const settings = compositionState.getSettings();
                chordSpansEnabled = settings.showChordSpans !== false;
            } else {
                const stored = localStorage.getItem('chord-spans');
                chordSpansEnabled = stored !== 'false';
            }
        } catch (e) {
            const stored = localStorage.getItem('chord-spans');
            chordSpansEnabled = stored !== 'false';
        }
        chordSpansToggle.checked = chordSpansEnabled;

        // Update indicator colors
        const offIndicator = document.getElementById('chord-spans-off-indicator');
        const onIndicator = document.getElementById('chord-spans-on-indicator');
        if (chordSpansEnabled) {
            if (onIndicator) {
                onIndicator.classList.remove('text-gray-500');
                onIndicator.classList.add('text-indigo-300');
            }
            if (offIndicator) {
                offIndicator.classList.remove('text-indigo-300');
                offIndicator.classList.add('text-gray-500');
            }
        } else {
            if (offIndicator) {
                offIndicator.classList.remove('text-gray-500');
                offIndicator.classList.add('text-indigo-300');
            }
            if (onIndicator) {
                onIndicator.classList.remove('text-indigo-300');
                onIndicator.classList.add('text-gray-500');
            }
        }
    }

    // Restore settings group collapsed states from localStorage
    restoreSettingsGroupStates();

    // Restore header displays collapsed state from localStorage
    restoreHeaderDisplaysState();

    // Initialize melody mode toggle (default to Free mode - unchecked)
    const melodyModeToggle = document.getElementById('melody-mode-toggle');
    const recordingToggleContainer = document.getElementById('melody-recording-toggle-container');
    if (melodyModeToggle) {
        melodyModeToggle.checked = false; // Free mode is default (unchecked)
        // Initialize Free mode - ensure UI is in correct state
        const aiModeControls = document.getElementById('ai-mode-controls');
        const freeModeControls = document.getElementById('free-mode-controls');
        if (aiModeControls) {
            aiModeControls.classList.add('hidden');
        }
        if (freeModeControls) {
            freeModeControls.classList.remove('hidden');
        }
        // Show recording toggle in Free mode (since Free is the default)
        if (recordingToggleContainer) {
            recordingToggleContainer.classList.remove('hidden');
        }
        // Set initial state but don't automatically enable interactive mode
        window.isInteractiveMode = false;
    }

    // Initialize melody recording toggle (default to off/Stop)
    const melodyRecordingToggle = document.getElementById('melody-recording-toggle');
    if (melodyRecordingToggle) {
        melodyRecordingToggle.checked = false; // Stop is default (unchecked)
        // Refresh notation if in Free mode
        setTimeout(() => {
            const freeModeControls = document.getElementById('free-mode-controls');
            if (freeModeControls && !freeModeControls.classList.contains('hidden')) {
                // Wait a bit longer to ensure notation system is ready
                setTimeout(() => {
                    if (window.refreshNotationFromProgression) {
                        window.refreshNotationFromProgression();
                    }
                }, 100);
            }
        }, 300);
    }

    // Initialize clef toggle button states (both clef toggles are always visible)
    // Set initial button states
    setTimeout(() => {
        if (setMelodyClef && setChordClef) {
            // Trigger update to set initial button states (treble is default)
            setMelodyClef('treble');
            setChordClef('treble');
        }
    }, 200);

    // Initialize indicator colors for Notation Style
    const notationFullIndicator = document.getElementById('notation-full-indicator');
    const notationSymbolIndicator = document.getElementById('notation-symbol-indicator');
    if (getNotationPreference() === 'full') {
        notationFullIndicator.classList.remove('text-gray-500');
        notationFullIndicator.classList.add('text-indigo-300');
        notationSymbolIndicator.classList.remove('text-indigo-300');
        notationSymbolIndicator.classList.add('text-gray-500');
    } else {
        notationSymbolIndicator.classList.remove('text-gray-500');
        notationSymbolIndicator.classList.add('text-indigo-300');
        notationFullIndicator.classList.remove('text-indigo-300');
        notationFullIndicator.classList.add('text-gray-500');
    }

    // Initialize indicator colors for Roman Numerals
    const romanOffIndicator = document.getElementById('roman-off-indicator');
    const romanOnIndicator = document.getElementById('roman-on-indicator');
    if (getIsRomanNumeralEngineOn()) {
        romanOnIndicator.classList.remove('text-gray-500');
        romanOnIndicator.classList.add('text-indigo-300');
        romanOffIndicator.classList.remove('text-indigo-300');
        romanOffIndicator.classList.add('text-gray-500');
    } else {
        romanOffIndicator.classList.remove('text-gray-500');
        romanOffIndicator.classList.add('text-indigo-300');
        romanOnIndicator.classList.remove('text-indigo-300');
        romanOnIndicator.classList.add('text-gray-500');
    }

    // Initialize indicator colors for Key Names
    const keyNamesOffIndicator = document.getElementById('key-names-off-indicator');
    const keyNamesOnIndicator = document.getElementById('key-names-on-indicator');
    if (getIsKeyNamesOn()) {
        keyNamesOnIndicator.classList.remove('text-gray-500');
        keyNamesOnIndicator.classList.add('text-indigo-300');
        keyNamesOffIndicator.classList.remove('text-indigo-300');
        keyNamesOffIndicator.classList.add('text-gray-500');
    } else {
        keyNamesOffIndicator.classList.remove('text-gray-500');
        keyNamesOffIndicator.classList.add('text-indigo-300');
        keyNamesOnIndicator.classList.remove('text-indigo-300');
        keyNamesOnIndicator.classList.add('text-gray-500');
    }

    // Initialize indicator colors for Classic Keyboard
    const classicKeyboardOffIndicator = document.getElementById('classic-keyboard-off-indicator');
    const classicKeyboardOnIndicator = document.getElementById('classic-keyboard-on-indicator');
    if (getIsClassicKeyboardOn()) {
        // Classic keyboard is ON - show classic style
        classicKeyboardOnIndicator.classList.remove('text-gray-500');
        classicKeyboardOnIndicator.classList.add('text-indigo-300');
        classicKeyboardOffIndicator.classList.remove('text-indigo-300');
        classicKeyboardOffIndicator.classList.add('text-gray-500');
        // Remove modern keyboard class to show classic style
        const keyboard = document.getElementById('piano-keyboard');
        if (keyboard) {
            keyboard.classList.remove('modern-keyboard');
        }
    } else {
        // Classic keyboard is OFF - show modern style (default)
        classicKeyboardOffIndicator.classList.remove('text-gray-500');
        classicKeyboardOffIndicator.classList.add('text-indigo-300');
        classicKeyboardOnIndicator.classList.remove('text-indigo-300');
        classicKeyboardOnIndicator.classList.add('text-gray-500');
        // Add modern keyboard class to show modern style
        const keyboard = document.getElementById('piano-keyboard');
        if (keyboard) {
            keyboard.classList.add('modern-keyboard');
        }
    }

    // Initialize window.isClassicKeyboardOn
    window.isClassicKeyboardOn = getIsClassicKeyboardOn();

    // Apply compact mode class if enabled
    if (getIsCompactModeOn()) {
        document.body.classList.add('compact-mode');
    }

    // Initialize fretboard toggle - default to off (piano keyboard shown)
    const fretboardToggle = document.getElementById('fretboard-toggle');
    if (fretboardToggle) {
        fretboardToggle.checked = false;
        const fretboardPianoIndicator = document.getElementById('fretboard-piano-indicator');
        const fretboardGuitarIndicator = document.getElementById('fretboard-guitar-indicator');
        if (fretboardPianoIndicator && fretboardGuitarIndicator) {
            fretboardPianoIndicator.classList.remove('text-gray-500');
            fretboardPianoIndicator.classList.add('text-indigo-300');
            fretboardGuitarIndicator.classList.remove('text-indigo-300');
            fretboardGuitarIndicator.classList.add('text-gray-500');
        }
    }

    // Initialize dark mode toggle and apply saved state
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const isDarkMode = getIsDarkModeOn();
    if (darkModeToggle) {
        darkModeToggle.checked = isDarkMode;

        // Update indicator colors
        const lightIndicator = document.getElementById('dark-mode-light-indicator');
        const darkIndicator = document.getElementById('dark-mode-dark-indicator');
        if (lightIndicator && darkIndicator) {
            if (isDarkMode) {
                darkIndicator.classList.remove('text-gray-500');
                darkIndicator.classList.add('text-indigo-300');
                lightIndicator.classList.remove('text-indigo-300');
                lightIndicator.classList.add('text-gray-500');
            } else {
                lightIndicator.classList.remove('text-gray-500');
                lightIndicator.classList.add('text-indigo-300');
                darkIndicator.classList.remove('text-indigo-300');
                darkIndicator.classList.add('text-gray-500');
            }
        }
    }

    // Apply dark mode class to body if dark mode is enabled
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
    }

    // ===========================
    // STATE LOADING
    // ===========================

    // Initialize trainer state
    loadProgression();

    // Set window.trainerState for modules that access it
    window.trainerState = getTrainerState();

    // Switch to builder tab
    switchTab('builder');

    // Update UI elements
    // Call updateKeyboardLabels after a short delay to ensure keyboard is fully rendered
    setTimeout(() => {
        updateKeyboardLabels();
    }, 100);
    updateLHInversionSelector();
    updateBuilderOctaveUI();
    updateScaleOctaveUI();
    updateScaleSpeedUI();
    updateArpeggioSpeedUI();

    // Load saved state for floating controls visibility
    const savedVisibility = localStorage.getItem('isFloatingControlsVisible');
    if (savedVisibility === 'false' && window.toggleFloatingControls) {
        window.toggleFloatingControls();
    }

    // Setup responsive title abbreviation
    setupResponsiveTitle();
}

// ===========================================
// LANDING PAGE FUNCTIONS
// ===========================================

/**
 * Enter the main app and switch to a specific tab
 * @param {string} tabName - The tab to switch to after entering
 */
export function enterAppToTab(tabName) {
    const landingPage = document.getElementById('landing-page');
    const mainApp = document.getElementById('main-app');

    if (landingPage && mainApp) {
        // Fade out landing page
        landingPage.style.transition = 'opacity 0.3s ease-out';
        landingPage.style.opacity = '0';

        setTimeout(() => {
            landingPage.classList.add('hidden');
            mainApp.classList.remove('hidden');

            // Fade in main app
            mainApp.style.opacity = '0';
            mainApp.style.transition = 'opacity 0.3s ease-in';
            setTimeout(() => {
                mainApp.style.opacity = '1';
                // Switch to the requested tab after app is visible
                if (window.switchTab) {
                    window.switchTab(tabName);
                }
            }, 50);
        }, 300);
    }
}

/**
 * Show the Start Here modal (placeholder for guided onboarding)
 */
export function showStartHereModal() {
    // For now, show a placeholder modal explaining the Start Here feature is coming
    const content = `
        <div class="text-center">
            <div class="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-3">Start Here - Coming Soon!</h3>
            <p class="text-gray-600 mb-4">
                A guided onboarding experience is in development that will help you discover all the features of the Interactive Music Theory Lab.
            </p>
            <p class="text-gray-600 mb-4">
                <strong>In the meantime, here are some quick tips:</strong>
            </p>
            <ul class="text-left text-gray-600 space-y-2 mb-4 max-w-md mx-auto">
                <li class="flex items-start gap-2">
                    <span class="text-indigo-500 font-bold">1.</span>
                    <span><strong>Chord Lab</strong> - Build and explore chords on the interactive keyboard</span>
                </li>
                <li class="flex items-start gap-2">
                    <span class="text-purple-500 font-bold">2.</span>
                    <span><strong>Composition Studio</strong> - Create progressions and generate melodies</span>
                </li>
                <li class="flex items-start gap-2">
                    <span class="text-emerald-500 font-bold">3.</span>
                    <span><strong>Scale Explorer</strong> - Learn scales and modes with fingering guides</span>
                </li>
                <li class="flex items-start gap-2">
                    <span class="text-rose-500 font-bold">4.</span>
                    <span><strong>Theory Academy</strong> - Interactive lessons from basics to advanced</span>
                </li>
            </ul>
            <p class="text-sm text-gray-500">
                Press <kbd class="px-2 py-1 bg-gray-100 rounded text-xs font-mono">?</kbd> anywhere in the app to see keyboard shortcuts!
            </p>
        </div>
    `;

    if (window.showModalHTML) {
        window.showModalHTML(content, true);
    } else if (window.showModal) {
        window.showModal('Start Here feature coming soon! Explore the tabs to discover all features.');
    }
}
