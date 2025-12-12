/**
 * Tab Management Module
 * Handles switching between different tabs (Builder, Trainer, Scales) and refreshing tab content
 */

import { getCurrentTab, setCurrentTab } from '../state/globalState.js';
import { getTrainerState } from '../state/trainerState.js';
import { clearHighlights, updateKeyboardLabels, highlightTrainer } from './keyboard.js';
import { updateBuilderDisplay, renderBuilderSelectors, updateChordTypeButtonCaptions, updateIntervalButtonCaptions } from '../features/chordBuilder.js';
import { getBuilderRootIndex } from '../state/builderState.js';
import { getEnharmonicPreference } from '../state/globalState.js';
import { SHARP_NOTES, FLAT_NOTES } from '../../data/music-data.js';
import { updateKeySignatureDisplay } from './header.js';
import { loadProgression, renderProgressionDisplay, renderProgressionControls, updateProgressionEnharmonics } from '../features/progressionBuilder.js';
import { updateScaleDisplay, renderScaleSelectors } from '../features/scaleExplorer.js';
import { updateButtonVisibility } from './presetUI.js';
import { updateTabSidebarHeight } from './sectionSidebar.js';
import { initEnhancedNotation } from '../notation/notationInit.js';

// ===========================================
// BROWSER HISTORY STATE MANAGEMENT
// ===========================================

// Track the current lesson being viewed (if any)
let currentLessonId = null;

/**
 * Set the current lesson ID for history tracking
 * Called by lessonViewer when rendering a lesson
 */
export function setCurrentLessonForHistory(lessonId) {
    currentLessonId = lessonId;
}

/**
 * Get the current lesson ID
 */
export function getCurrentLessonForHistory() {
    return currentLessonId;
}

/**
 * Initialize browser history handling for tab navigation
 * This allows the back button to return to previous tabs/lessons
 */
export function initTabHistory() {
    // Handle browser back/forward buttons
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.tabId) {
            // Switch to the tab without pushing new history
            switchTab(event.state.tabId, { pushHistory: false });

            // If there was a lesson being viewed, restore it
            if (event.state.lessonId && event.state.tabId === 'learn') {
                setTimeout(() => {
                    if (window.renderLessonViewer) {
                        // Use learn-tab-content (the inner container) not tab-learn (the outer wrapper)
                        const learnContainer = document.getElementById('learn-tab-
                        if (learnContainer) {
                            window.renderLessonViewer(event.state.lessonId, learnContainer, false);
                        }
                    }
                }, 100);
            }
        }
    });

    // Set initial state
    const initialTab = getCurrentTab() || 'builder';
    if (!history.state) {
        history.replaceState({ tabId: initialTab, lessonId: null }, '', '');
    }
}

/**
 * Switches between tabs and manages their visibility and state
 * @param {string} tabId - The ID of the tab to switch to ('builder', 'melody', 'scales', or 'learn')
 * @param {Object} options - Options for tab switching
 * @param {boolean} options.pushHistory - Whether to push to browser history (default: true)
 */
export function switchTab(tabId, options = {}) {
    // Redirect deprecated 'trainer' tab to 'melody' (Composition Studio)
    if (tabId === 'trainer') {
        tabId = 'melody';
    }

    const { pushHistory = true } = options;

    // Get the previous tab and lesson for history
    const previousTab = getCurrentTab();
    const previousLessonId = currentLessonId;

    // Push to browser history if requested and tab is changing
    if (pushHistory && previousTab !== tabId) {
        // First, update the current state with the lesson if we're leaving the learn tab
        if (previousTab === 'learn' && previousLessonId) {
            history.replaceState({ tabId: previousTab, lessonId: previousLessonId }, '', '');
        }

        // Push the new tab state
        history.pushState({ tabId: tabId, lessonId: null }, '', '');
    }

    // Clear lesson ID when leaving the learn tab
    if (tabId !== 'learn') {
        currentLessonId = null;
    }

    // Set data attribute on body for CSS tab-aware theming (action bar, etc.)
    document.body.setAttribute('data-active-tab', tabId);

    // Show/hide sticky action bar based on tab (builder and melody tabs)
    const actionBar = document.getElementById('action-
    if (actionBar) {
        const showActionBar = tabId === 'builder' || tabId === 'melody';
        actionBar.classList.toggle('hidden', !showActionBar);
    }

    const tabs = ['builder', 'melody', 'scales', 'learn'];
    // Also hide the old trainer tab content
    const trainerTab = document.getElementById('tab-
    if (trainerTab) trainerTab.classList.add('

    tabs.forEach(id => {
        document.getElementById(`tab-${id}`).classList.toggle('hidden', id !== tabId);

        // Set button colors based on tab type - matching keyboard highlighting colors
        let activeColor, inactiveHover;
        if (id === 'builder') {
            activeColor = 'bg-orange-500'; // Orange for Chord Builder (amber on keyboard)
            inactiveHover = 'hover:bg-gray-700';
        } else if (id === 'melody') {
            activeColor = 'bg-violet-600'; // Violet for Melody Composer
            inactiveHover = 'hover:bg-gray-700';
        } else if (id === 'scales') {
            activeColor = 'bg-lime-400'; // Lime for Scale Explorer (lime-400 matches keyboard)
            inactiveHover = 'hover:bg-gray-700';
        } else if (id === 'learn') {
            activeColor = 'bg-blue-500'; // Blue for Learn tab
            inactiveHover = 'hover:bg-gray-700';
        }
        
        // Update sidebar button (if it exists)
        const sidebarBtn = document.getElementById(`sidebar-btn-${id}`);
        if (sidebarBtn) {
            sidebarBtn.classList.remove('bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-teal-600', 'bg-lime-400', 'bg-violet-600', 'bg-indigo-500', 'hover:bg-gray-700');
            if (id === tabId) {
                sidebarBtn.classList.add(activeColor);
            } else {
                sidebarBtn.classList.add(inactiveHover);
            }
        }

        // Update header button (if it exists)
        const headerBtn = document.getElementById(`header-tab-btn-${id}`);
        if (headerBtn) {
            // Remove old styling classes
            headerBtn.classList.remove('bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-teal-600', 'bg-lime-400', 'bg-violet-600', 'bg-indigo-500', 'text-white', 'text-gray-500', 'text-gray-600', 'hover:bg-gray-100', '
            if (id === tabId) {
                // Add active class for new pill styling (CSS handles the gradient)
                headerBtn.classList.add('
                // Also add legacy classes for backwards compatibility
                headerBtn.classList.add(activeColor, 'text-
            } else {
                headerBtn.classList.add('text-gray-600', 'hover:bg-gray-100');
            }
        }

        if (id === tabId) {
            setCurrentTab(id);
        }
    });

    // Update window.currentTab for modules that access it
    if (typeof window !== 'undefined') {
        window.currentTab = tabId;
    }
    
    // Restore panel states for the tab being switched to
    // Use a small delay to ensure DOM is ready
    if (window.restoreTabPanelStates && (tabId === 'builder' || tabId === 'melody')) {
        setTimeout(() => {
            window.restoreTabPanelStates(tabId);
        }, 10);
    }

    // Show/hide expand/collapse header buttons based on active tab
    const headerExpandCollapse = document.getElementById('header-expand-collapse-
    if (headerExpandCollapse) {
        // Show controls for tabs that have collapsible sections
        if (tabId === 'builder' || tabId === 'melody') {
            headerExpandCollapse.classList.remove('
        } else {
            headerExpandCollapse.classList.add('
        }
    }

    clearHighlights();
    // Note: Stop all playback functionality would go here if needed

    // Restore visibility logic for the correct display panel
    document.getElementById('builder-info-display').classList.toggle('hidden', tabId !== '
    document.getElementById('progression-chord-display').classList.add('hidden'); // Always hidden (trainer tab removed)
    document.getElementById('scale-info-display').classList.toggle('hidden', tabId !== '

    // Manage visibility of floating controls
    document.getElementById('floating-builder-controls').classList.add('
    document.getElementById('floating-melody-controls').classList.toggle('hidden', tabId !== '
    document.getElementById('floating-scale-controls').classList.toggle('hidden', tabId !== '
    document.getElementById('floating-learn-controls').classList.toggle('hidden', tabId !== '

    // Show/hide the correct action button containers
    const builderActions = document.getElementById('builder-actions-
    const trainerActions = document.getElementById('trainer-main-
    const builderCentral = document.getElementById('builder-central-
    const scaleCentral = document.getElementById('scale-central-
    const builderOctave = document.getElementById('builder-octave-controls-
    const trainerOctave = document.getElementById('trainer-octave-controls-
    const scaleOctave = document.getElementById('scale-octave-controls-

    if (tabId === 'builder') {
        updateBuilderDisplay();
        // Update the Chord Lab progression panel to reflect any changes made in other tabs
        if (window.renderBuilderProgressionCards) {
            window.renderBuilderProgressionCards();
        }
        // Reset shared-chord-display width for Chord Builder
        const sharedChordDisplay = document.getElementById('shared-chord-
        if (sharedChordDisplay) {
            sharedChordDisplay.classList.remove('w-80');
            sharedChordDisplay.classList.add('w-64');
        }
        // Update key signature display based on current root note selection
        const builderRootIndex = getBuilderRootIndex();
        const enharmonicPreference = getEnharmonicPreference();
        const rootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[builderRootIndex];
        if (rootNote && window.updateKeySignatureDisplay) {
            window.updateKeySignatureDisplay(rootNote);
        }
        updateKeyboardLabels();
    } else if (tabId === 'melody') {
        // Always render progression display when entering Composition Studio
        renderProgressionDisplay();
        const trainerState = getTrainerState();

        // Phase 4.4: Initialize enhanced notation system FIRST
        // This must be done before other initializations that might trigger old renderers
        initEnhancedNotation({
            canvasId: 'interactive-melody-notation-canvas',
            createToolbar: true,
        });

        // Phase 1B: Initialize composition bridge
        if (window.initMelodyComposerBridge) {
            window.initMelodyComposerBridge();
        }

        // Sync progression timeline to melody tab
        if (window.syncProgressionToMelodyTab) {
            window.syncProgressionToMelodyTab();
        }

        // Phase 1B: Sync progression to composition state
        if (window.syncProgressionToMelodyComposer) {
            window.syncProgressionToMelodyComposer();
        }

        // Re-sync notation after compositionState is populated with bass notes
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        }

        // Phase 2.2: Initialize chord recommendations sidebar
        if (window.initializeRecommendationsSidebar) {
            window.initializeRecommendationsSidebar();
        }

        // Phase 4.1: Initialize melody suggestions controller
        if (window.initMelodySuggestionController) {
            window.initMelodySuggestionController({
                styleId: document.getElementById('melody-style-select')?.value || 'pop',
                octave: 4
            });
        }

        // Update key signature display
        if (trainerState.currentKey && window.updateKeySignatureDisplay) {
            updateKeySignatureDisplay(trainerState.currentKey);
        }
        // Reset shared-chord-display width for Melody Composer
        const sharedChordDisplay = document.getElementById('shared-chord-
        if (sharedChordDisplay) {
            sharedChordDisplay.classList.remove('w-80');
            sharedChordDisplay.classList.add('w-64');
        }
        updateKeyboardLabels();
        // Refresh notation if in Free mode and progression exists (Phase 4.4+)
        setTimeout(() => {
            const panel = document.getElementById('melody-controls-
            const freeModeControls = document.getElementById('free-mode-
            // Only refresh if panel is visible and Free mode is active
            const panelVisible = !panel || !panel.classList.contains('
            if (panelVisible && freeModeControls && !freeModeControls.classList.contains('hidden')) {
                if (window.refreshNotationFromProgression) {
                    // Wait a bit to ensure notation system is ready
                    setTimeout(() => {
                        window.refreshNotationFromProgression();
                    }, 100);
                }
            }
        }, 200);
    } else if (tabId === 'scales') {
        updateScaleDisplay();
        // Update window.scaleRootIndex for Roman numerals
        if (window.getScaleRootIndex) {
            window.scaleRootIndex = window.getScaleRootIndex();
        }
        // Use same width as other tabs to prevent layout shift
        const sharedChordDisplay = document.getElementById('shared-chord-
        if (sharedChordDisplay) {
            sharedChordDisplay.classList.remove('w-72', 'w-80');
            sharedChordDisplay.classList.add('w-64');
        }
        updateKeyboardLabels();
    } else if (tabId === 'learn') {
        // Initialize Learn tab content
        if (window.initLearnTab) {
            window.initLearnTab();
        }
        // Use same width as other tabs
        const sharedChordDisplay = document.getElementById('shared-chord-
        if (sharedChordDisplay) {
            sharedChordDisplay.classList.remove('w-72', 'w-80');
            sharedChordDisplay.classList.add('w-64');
        }
    }

    // Update the tab subtitle to show current tab name
    const tabSubtitle = document.getElementById('tab-
    if (tabSubtitle) {
        const tabNames = {
            'builder': 'Chord Lab',
            'melody': 'Composition Studio',
            'scales': 'Scale Explorer',
            'learn': 'Theory Academy'
        };
        const tabColors = {
            'builder': 'text-amber-600',
            'melody': 'text-violet-600',
            'scales': 'text-lime-600',
            'learn': 'text-blue-600'
        };
        // Remove all color classes and add the new one
        tabSubtitle.className = 'text-[10px] font-semibold leading-tight ' + (tabColors[tabId] || 'text-gray-600');
        tabSubtitle.textContent = tabNames[tabId] || tabId;
    }

    // Update preset button visibility based on current tab
    updateButtonVisibility();

    // Update sidebar height for the active tab to ensure it meets dimension requirements
    // This ensures the sidebar height matches the taller of: white container OR sidebar content
    if (tabId === 'builder' || tabId === 'melody') {
        updateTabSidebarHeight(tabId);
    }

    // Sidebar stays open - user may want to make other selections
}

/**
 * Refreshes all tab content and displays
 * Called when global settings change (like enharmonic preference)
 */
export function refreshAllTabs() {
    renderBuilderSelectors();
    renderProgressionControls();
    renderProgressionDisplay();
    renderScaleSelectors();
    updateBuilderDisplay();
    
    // Update key signature display after builder display updates
    const builderRootIndex = getBuilderRootIndex();
    const enharmonicPreference = getEnharmonicPreference();
    const rootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[builderRootIndex];
    if (window.updateKeySignatureDisplay) {
        window.updateKeySignatureDisplay(rootNote);
    }
    
    const trainerState = getTrainerState();
    if (trainerState.isReady) {
        // Update enharmonic spellings without regenerating the progression
        updateProgressionEnharmonics();
    }
    updateScaleDisplay();
    updateChordTypeButtonCaptions();
    updateIntervalButtonCaptions();
    
    // Update window.scaleRootIndex for Roman numerals if available
    if (window.getScaleRootIndex) {
        window.scaleRootIndex = window.getScaleRootIndex();
    }
    
    // Always update keyboard labels after refreshing tabs
    updateKeyboardLabels();
}
