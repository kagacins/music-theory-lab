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
import { loadProgression, renderProgressionDisplay, renderProgressionControls, updateProgressionEnharmonics } from '../features/progressionBuilder/index.js';
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
                        const learnContainer = document.getElementById('learn-tab-content');
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

    // Restore keyboard when switching AWAY from chordlab-new
    // The new Chord Lab captures the keyboard element, so we need to restore it for other tabs
    if (previousTab === 'chordlab-new' && tabId !== 'chordlab-new') {
        if (window.getFullScreenChordLabEditor) {
            const editor = window.getFullScreenChordLabEditor();
            if (editor && editor._restoreKeyboard) {
                editor._restoreKeyboard();
            }
        }
    }

    // Restore keyboard when switching AWAY from scaleexplorer-new
    // The new Scale Explorer captures the keyboard element, so we need to restore it for other tabs
    if (previousTab === 'scaleexplorer-new' && tabId !== 'scaleexplorer-new') {
        if (window.getFullScreenScaleExplorer) {
            const editor = window.getFullScreenScaleExplorer();
            if (editor && editor._restoreKeyboard) {
                editor._restoreKeyboard();
            }
        }
    }

    // Restore notation PageManager when switching AWAY from studio-new
    // The new Composition Studio captures the notation canvas, so we need to restore it for Classic mode
    if (previousTab === 'studio-new' && tabId !== 'studio-new') {
        if (window.getFullScreenNotationEditor) {
            const editor = window.getFullScreenNotationEditor();
            if (editor && editor.isTabMode) {
                // Restore the PageManager container to the classic notation-pages-container
                const composer = window.getNotationComposer?.();
                const classicContainer = document.getElementById('notation-pages-container');
                if (composer?.pageManager && classicContainer) {
                    // Move existing page canvases to the correct container
                    const fullscreenContainer = document.getElementById('fullscreen-pages-container');
                    if (fullscreenContainer) {
                        const pages = Array.from(fullscreenContainer.querySelectorAll('.notation-page'));
                        pages.forEach(page => classicContainer.appendChild(page));
                    }
                    // Reset the PageManager container
                    composer.pageManager.setContainer(classicContainer);
                    // Force a re-render to update the display
                    setTimeout(() => {
                        composer.render(true);
                    }, 50);
                }
                // Mark tab mode as closed (but don't call closeTabMode which would switch tabs again)
                editor.isTabMode = false;
                editor.tabContent = null;
            }
        }
    }

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

    // Close FAB when switching tabs
    if (window.closeFab) {
        window.closeFab();
    }

    // Hide sticky action bar for all tabs - FAB is now the primary control interface
    const actionBar = document.getElementById('action-bar');
    if (actionBar) {
        actionBar.classList.add('hidden');
    }

    // Show/hide FAB based on tab (always visible for builder and melody, hidden for studio-new)
    const mobileFab = document.getElementById('mobile-fab');
    if (mobileFab) {
        if (tabId === 'builder' || tabId === 'melody') {
            // Always show FAB in Chord Lab and Composition Studio (Classic)
            mobileFab.classList.remove('hidden', 'touch-device-only');
        } else {
            // Hide FAB on other tabs (including studio-new which has its own controls)
            mobileFab.classList.add('hidden');
        }
    }

    // Hide keyboard section for full-screen experiences with their own keyboards
    const keyboardSection = document.getElementById('keyboard-section');
    if (keyboardSection) {
        if (tabId === 'studio-new' || tabId === 'chordlab-new' || tabId === 'scaleexplorer-new') {
            keyboardSection.classList.add('hidden');
        } else {
            keyboardSection.classList.remove('hidden');
        }
    }

    // Adjust header for full-screen tabs (full-width, simplified)
    const mainHeader = document.getElementById('main-header');
    const headerWrapper = mainHeader?.parentElement; // The max-w-7xl wrapper
    const headerDisplayPanels = document.getElementById('header-display-panels');

    if (mainHeader && headerWrapper) {
        if (tabId === 'studio-new' || tabId === 'chordlab-new' || tabId === 'scaleexplorer-new') {
            // Show header but in full-width mode for full-screen tabs
            mainHeader.classList.remove('hidden');
            // Make wrapper full-width and add fixed positioning
            headerWrapper.classList.remove('max-w-7xl');
            headerWrapper.classList.add('studio-new-header-wrapper');
            // Hide the info display panels for Composition Studio and Scale Explorer
            // but SHOW them for Chord Lab (New) to match classic Chord Lab
            if (headerDisplayPanels) {
                if (tabId === 'chordlab-new') {
                    headerDisplayPanels.classList.remove('hidden');
                } else {
                    headerDisplayPanels.classList.add('hidden');
                }
            }
        } else {
            mainHeader.classList.remove('hidden');
            // Restore normal width constraint
            headerWrapper.classList.add('max-w-7xl');
            headerWrapper.classList.remove('studio-new-header-wrapper');
            // Show the info display panels again
            if (headerDisplayPanels) {
                headerDisplayPanels.classList.remove('hidden');
            }
        }
    }

    // Show/hide Chord Lab quick buttons container (above FAB, visible when FAB is collapsed in Chord Lab)
    const fabBuilderQuickBtns = document.getElementById('fab-builder-quick-buttons');
    if (fabBuilderQuickBtns) {
        fabBuilderQuickBtns.classList.toggle('hidden', tabId !== 'builder');
    }

    // Show/hide Melody quick buttons (above FAB, visible when FAB is collapsed in Composition Studio)
    const fabMelodyQuickBtns = document.getElementById('fab-melody-quick-buttons');
    if (fabMelodyQuickBtns) {
        fabMelodyQuickBtns.classList.toggle('hidden', tabId !== 'melody');
    }

    const tabs = ['builder', 'melody', 'scales', 'learn', 'studio-new', 'chordlab-new', 'scaleexplorer-new'];
    // Also hide the old trainer tab content
    const trainerTab = document.getElementById('tab-trainer');
    if (trainerTab) trainerTab.classList.add('hidden');

    // Also hide the chordlab-new tab container when not active (it has fixed positioning)
    const chordlabNewTab = document.getElementById('tab-chordlab-new');
    if (chordlabNewTab) {
        chordlabNewTab.classList.toggle('hidden', tabId !== 'chordlab-new');
    }

    // Also hide the scaleexplorer-new tab container when not active (it has fixed positioning)
    const scaleexplorerNewTab = document.getElementById('tab-scaleexplorer-new');
    if (scaleexplorerNewTab) {
        scaleexplorerNewTab.classList.toggle('hidden', tabId !== 'scaleexplorer-new');
    }

    tabs.forEach(id => {
        document.getElementById(`tab-${id}`)?.classList.toggle('hidden', id !== tabId);

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
        } else if (id === 'studio-new') {
            activeColor = 'bg-indigo-600'; // Indigo for Composition Studio (New)
            inactiveHover = 'hover:bg-gray-700';
        } else if (id === 'chordlab-new') {
            activeColor = 'bg-amber-500'; // Amber for Chord Lab (New), matching classic Chord Lab
            inactiveHover = 'hover:bg-gray-700';
        } else if (id === 'scaleexplorer-new') {
            activeColor = 'bg-lime-500'; // Lime for Scale Explorer (New), matching classic Scale Explorer
            inactiveHover = 'hover:bg-gray-700';
        }

        // Update sidebar button (if it exists)
        const sidebarBtn = document.getElementById(`sidebar-btn-${id}`);
        if (sidebarBtn) {
            sidebarBtn.classList.remove('bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-teal-600', 'bg-lime-400', 'bg-lime-500', 'bg-violet-600', 'bg-indigo-500', 'hover:bg-gray-700');
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
            headerBtn.classList.remove('bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-teal-600', 'bg-lime-400', 'bg-lime-500', 'bg-violet-600', 'bg-indigo-500', 'bg-amber-500', 'text-white', 'text-gray-500', 'text-gray-600', 'hover:bg-gray-100', 'active');
            // Special case: melody button should be active for both 'melody' and 'studio-new' tabs
            // Special case: builder button should be active for both 'builder' and 'chordlab-new' tabs
            // Special case: scales button should be active for both 'scales' and 'scaleexplorer-new' tabs
            const isActive = (id === tabId) || (id === 'melody' && tabId === 'studio-new') || (id === 'builder' && tabId === 'chordlab-new') || (id === 'scales' && tabId === 'scaleexplorer-new');
            if (isActive) {
                // Add active class for new pill styling (CSS handles the gradient)
                headerBtn.classList.add('active');
                // Also add legacy classes for backwards compatibility
                headerBtn.classList.add(activeColor, 'text-white');
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

    clearHighlights();
    // Note: Stop all playback functionality would go here if needed

    // Adjust spacing based on tab (Chord Lab and Composition Studio have no action bar, so content moves closer to keyboard)
    // Note: keyboardSection already declared above for studio-new visibility handling
    if (keyboardSection) {
        if (tabId === 'builder' || tabId === 'melody') {
            // Remove margin since action bar is hidden - content moves up
            keyboardSection.style.marginBottom = '4px';
        } else {
            // Reset to default (mb-2 = 0.5rem = 8px) for other tabs that may show action bar
            keyboardSection.style.marginBottom = '';
        }
    }

    // Restore visibility logic for the correct display panel
    document.getElementById('builder-info-display').classList.toggle('hidden', tabId !== 'builder');
    document.getElementById('progression-chord-display').classList.add('hidden'); // Always hidden (trainer tab removed)
    document.getElementById('scale-info-display').classList.toggle('hidden', tabId !== 'scales');

    // Manage visibility of floating controls
    document.getElementById('floating-builder-controls').classList.add('hidden');
    document.getElementById('floating-scale-controls').classList.toggle('hidden', tabId !== 'scales');
    document.getElementById('floating-learn-controls').classList.toggle('hidden', tabId !== 'learn');

    // Show/hide the correct action button containers
    const builderActions = document.getElementById('builder-actions-container');
    const trainerActions = document.getElementById('trainer-main-actions');
    const builderCentral = document.getElementById('builder-central-actions');
    const scaleCentral = document.getElementById('scale-central-actions');
    const builderOctave = document.getElementById('builder-octave-controls-container');
    const trainerOctave = document.getElementById('trainer-octave-controls-container');
    const scaleOctave = document.getElementById('scale-octave-controls-container');

    if (tabId === 'builder') {
        updateBuilderDisplay();
        // Render progression display in Chord Lab (like we do for melody tab)
        renderProgressionDisplay('progression-visualization');
        // Update the Chord Lab progression panel to reflect any changes made in other tabs
        if (window.renderBuilderProgressionCards) {
            window.renderBuilderProgressionCards();
        }
        // Reset shared-chord-display width for Chord Builder
        const sharedChordDisplay = document.getElementById('shared-chord-display');
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
        const sharedChordDisplay = document.getElementById('shared-chord-display');
        if (sharedChordDisplay) {
            sharedChordDisplay.classList.remove('w-80');
            sharedChordDisplay.classList.add('w-64');
        }
        updateKeyboardLabels();
        // Refresh notation if in Free mode and progression exists (Phase 4.4+)
        setTimeout(() => {
            const panel = document.getElementById('melody-controls-panel');
            const freeModeControls = document.getElementById('free-mode-controls');
            // Only refresh if panel is visible and Free mode is active
            const panelVisible = !panel || !panel.classList.contains('hidden');
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
        const sharedChordDisplay = document.getElementById('shared-chord-display');
        if (sharedChordDisplay) {
            sharedChordDisplay.classList.remove('w-72', 'w-80');
            sharedChordDisplay.classList.add('w-64');
        }
        updateKeyboardLabels();
    } else if (tabId === 'learn') {
        // Lazy load and initialize Learn tab content
        const learnContainer = document.getElementById('learn-tab-content');
        if (learnContainer && !learnContainer.dataset.initialized) {
            // Show loading state
            learnContainer.innerHTML = `
                <div class="flex items-center justify-center h-64">
                    <div class="text-center">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <div class="text-gray-600 dark:text-gray-400">Loading Theory Academy...</div>
                    </div>
                </div>
            `;
            // Lazy load the module
            import('./learnTabController.js').then(module => {
                learnContainer.dataset.initialized = 'true';
                module.initLearnTab();
            }).catch(err => {
                console.error('[Tabs] Failed to load Learn tab:', err);
                learnContainer.innerHTML = `
                    <div class="text-center py-12 text-red-500">
                        Failed to load Theory Academy. Please refresh the page.
                    </div>
                `;
            });
        } else if (window.initLearnTab) {
            // Already loaded, just reinitialize
            window.initLearnTab();
        }
        // Use same width as other tabs
        const sharedChordDisplay = document.getElementById('shared-chord-display');
        if (sharedChordDisplay) {
            sharedChordDisplay.classList.remove('w-72', 'w-80');
            sharedChordDisplay.classList.add('w-64');
        }
    } else if (tabId === 'studio-new') {
        // Initialize Composition Studio (New) - the new full-screen experience as a tab
        // First ensure melody/composition state is synced
        if (window.syncProgressionToMelodyComposer) {
            window.syncProgressionToMelodyComposer();
        }

        // Initialize the full-screen notation editor in tab mode
        if (window.initStudioNewTab) {
            window.initStudioNewTab();
        }

        // Trigger coach analysis when entering Composition Studio (New)
        // Use a small delay to ensure everything is initialized
        setTimeout(() => {
            if (window.triggerCoachAnalysis) {
                window.triggerCoachAnalysis();
            }
        }, 500);
    } else if (tabId === 'chordlab-new') {
        // Initialize Chord Lab (New) - the new full-screen chord lab experience as a tab
        if (window.initChordLabNewTab) {
            window.initChordLabNewTab();
        }
    } else if (tabId === 'scaleexplorer-new') {
        // Initialize Scale Explorer (New) - the new full-screen scale explorer experience as a tab
        if (window.initScaleExplorerNewTab) {
            window.initScaleExplorerNewTab();
        }
    }

    // Update the tab subtitle to show current tab name
    const tabSubtitle = document.getElementById('tab-subtitle');
    if (tabSubtitle) {
        const tabNames = {
            'builder': 'Chord Lab',
            'melody': 'Composition Studio',
            'scales': 'Scale Explorer',
            'learn': 'Theory Academy',
            'studio-new': 'Composition Studio (New)',
            'chordlab-new': 'Chord Lab (New)',
            'scaleexplorer-new': 'Scale Explorer (New)'
        };
        const tabColors = {
            'builder': 'text-amber-600',
            'melody': 'text-violet-600',
            'scales': 'text-lime-600',
            'learn': 'text-blue-600',
            'studio-new': 'text-indigo-600',
            'chordlab-new': 'text-amber-600',
            'scaleexplorer-new': 'text-lime-600'
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

    // Dispatch event for guided mode tutorials
    window.dispatchEvent(new CustomEvent('tabSelected', {
        detail: { tab: tabId, previousTab: previousTab }
    }));

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
