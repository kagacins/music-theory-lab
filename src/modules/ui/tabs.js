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

/**
 * Switches between tabs and manages their visibility and state
 * @param {string} tabId - The ID of the tab to switch to ('builder', 'trainer', or 'scales')
 */
export function switchTab(tabId) {
    const tabs = ['builder', 'trainer', 'melody', 'scales'];
    tabs.forEach(id => {
        document.getElementById(`tab-${id}`).classList.toggle('hidden', id !== tabId);

        // Set button colors based on tab type - matching keyboard highlighting colors
        let activeColor, inactiveHover;
        if (id === 'builder') {
            activeColor = 'bg-orange-500'; // Orange for Chord Builder (amber on keyboard)
            inactiveHover = 'hover:bg-gray-700';
        } else if (id === 'trainer') {
            activeColor = 'bg-teal-600'; // Teal for Progression Builder (teal-600 matches keyboard)
            inactiveHover = 'hover:bg-gray-700';
        } else if (id === 'melody') {
            activeColor = 'bg-violet-600'; // Violet for Melody Composer
            inactiveHover = 'hover:bg-gray-700';
        } else if (id === 'scales') {
            activeColor = 'bg-lime-400'; // Lime for Scale Explorer (lime-400 matches keyboard)
            inactiveHover = 'hover:bg-gray-700';
        }
        
        // Update sidebar button
        const sidebarBtn = document.getElementById(`sidebar-btn-${id}`);
        sidebarBtn.classList.remove('bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-teal-600', 'bg-lime-400', 'bg-violet-600', 'bg-indigo-500', 'hover:bg-gray-700');
        if (id === tabId) {
            sidebarBtn.classList.add(activeColor);
        } else {
            sidebarBtn.classList.add(inactiveHover);
        }

        // Update header button
        const headerBtn = document.getElementById(`header-tab-btn-${id}`);
        headerBtn.classList.remove('bg-orange-500', 'bg-blue-500', 'bg-green-500', 'bg-teal-600', 'bg-lime-400', 'bg-violet-600', 'bg-indigo-500', 'text-white', 'text-gray-500', 'hover:bg-gray-200');
        if (id === tabId) {
            headerBtn.classList.add(activeColor, 'text-white');
        } else {
            headerBtn.classList.add('text-gray-500', 'hover:bg-gray-200');
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
    if (window.restoreTabPanelStates && (tabId === 'builder' || tabId === 'trainer' || tabId === 'melody')) {
        setTimeout(() => {
            window.restoreTabPanelStates(tabId);
        }, 10);
    }

    // Show/hide expand/collapse header buttons based on active tab
    const headerExpandCollapse = document.getElementById('header-expand-collapse-group');
    if (headerExpandCollapse) {
        // Show controls for tabs that have collapsible sections
        if (tabId === 'builder' || tabId === 'trainer' || tabId === 'melody') {
            headerExpandCollapse.classList.remove('hidden');
        } else {
            headerExpandCollapse.classList.add('hidden');
        }
    }

    clearHighlights();
    // Note: Stop all playback functionality would go here if needed

    // Restore visibility logic for the correct display panel
    document.getElementById('builder-info-display').classList.toggle('hidden', tabId !== 'builder');
    document.getElementById('progression-chord-display').classList.toggle('hidden', tabId !== 'trainer');
    document.getElementById('scale-info-display').classList.toggle('hidden', tabId !== 'scales');

    // Manage visibility of floating controls
    document.getElementById('floating-builder-controls').classList.toggle('hidden', tabId !== 'builder');
    document.getElementById('floating-trainer-controls').classList.toggle('hidden', tabId !== 'trainer');
    document.getElementById('floating-melody-controls').classList.toggle('hidden', tabId !== 'melody');
    document.getElementById('floating-scale-controls').classList.toggle('hidden', tabId !== 'scales');

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
    } else if (tabId === 'trainer') {
        const trainerState = getTrainerState();
        // Always render progression display, even if empty
        renderProgressionDisplay();
        if (trainerState.scaleNotes && trainerState.scaleNotes.length > 0) {
            highlightTrainer(trainerState.scaleNotes, null);
            updateKeySignatureDisplay(trainerState.currentKey);
        } else {
            loadProgression();
        }
        // Reset shared-chord-display width for Progression Builder
        const sharedChordDisplay = document.getElementById('shared-chord-display');
        if (sharedChordDisplay) {
            sharedChordDisplay.classList.remove('w-80');
            sharedChordDisplay.classList.add('w-64');
        }
        updateKeyboardLabels();
    } else if (tabId === 'melody') {
        const trainerState = getTrainerState();

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

        // Phase 2.2: Initialize chord recommendations sidebar
        if (window.initializeRecommendationsSidebar) {
            window.initializeRecommendationsSidebar();
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
        // Render chord progression on staff if in Free mode and progression exists
        setTimeout(() => {
            const panel = document.getElementById('melody-controls-panel');
            const freeModeControls = document.getElementById('free-mode-controls');
            const canvas = document.getElementById('interactive-melody-notation-canvas');
            // Only render if panel is visible and Free mode is active
            const panelVisible = !panel || !panel.classList.contains('hidden');
            if (panelVisible && freeModeControls && !freeModeControls.classList.contains('hidden')) {
                if (canvas && window.renderChordProgressionStaff) {
                    // Wait a bit to ensure canvas has dimensions
                    setTimeout(() => {
                        if (canvas.width > 0 && canvas.height > 0) {
                            window.renderChordProgressionStaff(canvas);
                        } else {
                            // Canvas not ready, try again
                            setTimeout(() => {
                                window.renderChordProgressionStaff(canvas);
                            }, 300);
                        }
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
    }

    // Update the main page title
    const mainTitle = document.getElementById('main-title');
    const baseTitle = "Interactive Music Theory Lab";
    let tabTitle = "";
    if (tabId === 'builder') {
        tabTitle = "Chord Builder";
    } else if (tabId === 'trainer') {
        tabTitle = "Progression Builder";
    } else if (tabId === 'melody') {
        tabTitle = "Melody Composer";
    } else if (tabId === 'scales') {
        tabTitle = "Scale Explorer";
    }
    mainTitle.innerHTML = `${baseTitle}:<br><span class="text-xl sm:text-2xl font-extrabold text-indigo-700">${tabTitle}</span>`;
    
    // Update responsive title after setting the new title
    if (window.updateResponsiveTitle) {
        setTimeout(() => window.updateResponsiveTitle(), 10);
    }

    // Update preset button visibility based on current tab
    updateButtonVisibility();

    // Update sidebar height for the active tab to ensure it meets dimension requirements
    // This ensures the sidebar height matches the taller of: white container OR sidebar content
    if (tabId === 'builder' || tabId === 'trainer' || tabId === 'melody') {
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
