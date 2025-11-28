/**
 * Section Intent UI Manager
 * Phase 2.1: Manages the section intent UI in the floating suggestions panel
 *
 * This module connects the HTML-based section intent controls to the
 * sectionIntentState.js state management module.
 */

import {
    getSectionIntent,
    setSectionIntent,
    getInsertAfterIndex,
    setInsertAfterIndex,
    refreshInsertContext,
    INTENT_MODES,
    CONTINUE_SUBMODES
} from '../state/sectionIntentState.js';

import { getSelectedIndicesArray, getProgressionData, selectSingle } from '../state/trainerState.js';
import { getCompositionState } from '../state/compositionState.js';

// Import selectChordCard dynamically to avoid circular dependency
let selectChordCardFn = null;
async function getSelectChordCard() {
    if (!selectChordCardFn) {
        try {
            const module = await import('../features/progressionBuilder.js');
            selectChordCardFn = module.selectChordCard;
        } catch (e) {
        }
    }
    return selectChordCardFn;
}

let isInitialized = false;

// DOM element references
let selectionRequiredPrompt = null;
let sectionIntentControls = null;
let insertPositionChord = null;
let continueOptions = null;
let newSectionOptions = null;
let currentSectionName = null;

/**
 * Initialize the section intent UI
 * Call this after the DOM is ready
 */
export function initSectionIntentUI() {
    if (isInitialized) return;

    // Get DOM elements
    selectionRequiredPrompt = document.getElementById('selection-required-prompt');
    sectionIntentControls = document.getElementById('section-intent-controls');
    insertPositionChord = document.getElementById('insert-position-chord');
    continueOptions = document.getElementById('continue-section-options');
    newSectionOptions = document.getElementById('new-section-options');
    currentSectionName = document.getElementById('current-section-name');

    if (!selectionRequiredPrompt || !sectionIntentControls) {
        return;
    }

    // Set up event listeners for the UI controls
    setupEventListeners();

    // Set up event listeners for external events
    setupExternalEventListeners();

    isInitialized = true;
}

/**
 * Set up event listeners for the section intent controls
 */
function setupEventListeners() {
    // Select Last Chord button
    const selectLastBtn = document.getElementById('select-last-chord-btn');
    if (selectLastBtn) {
        selectLastBtn.addEventListener('click', handleSelectLastChord);
    }

    // Intent mode radio buttons (Continue vs New Section)
    const intentModeRadios = document.querySelectorAll('input[name="section-intent-mode"]');
    intentModeRadios.forEach(radio => {
        radio.addEventListener('change', handleIntentModeChange);
    });

    // Continue submode radio buttons
    const continueSubmodeRadios = document.querySelectorAll('input[name="continue-submode"]');
    continueSubmodeRadios.forEach(radio => {
        radio.addEventListener('change', handleContinueSubmodeChange);
    });

    // New section type select
    const newSectionTypeSelect = document.getElementById('new-section-type-select');
    if (newSectionTypeSelect) {
        newSectionTypeSelect.addEventListener('change', handleNewSectionTypeChange);
    }
}

/**
 * Set up listeners for external events (chord selection, panel show, etc.)
 */
function setupExternalEventListeners() {
    // Listen for chord selection changes (multiple event names for compatibility)
    window.addEventListener('chordSelected', handleChordSelectionChange);
    window.addEventListener('chordCardSelected', handleChordSelectionChange);
    window.addEventListener('chordDeselected', handleChordSelectionChange);

    // Listen for panel show event to refresh state
    window.addEventListener('suggestionsPanelShown', handlePanelShown);

    // Listen for progression updates
    window.addEventListener('progressionUpdated', handleProgressionUpdate);
}

/**
 * Handle the panel being shown - refresh the UI state
 */
function handlePanelShown(event) {
    if (event.detail?.mode === 'chords') {
        refreshUI();
    }
}

/**
 * Handle chord selection changes
 */
function handleChordSelectionChange() {
    refreshUI();
}

/**
 * Handle progression updates
 */
function handleProgressionUpdate() {
    // Only refresh if the panel might be visible
    refreshUI();
}

/**
 * Refresh the entire UI based on current state
 */
export function refreshUI() {
    if (!isInitialized) return;

    const selectedIndices = getSelectedIndicesArray();
    const progression = getProgressionData();
    const progressionLength = progression ? progression.length : 0;

    // Get sections from composition state
    let sections = [];
    try {
        const compositionState = getCompositionState();
        if (compositionState) {
            sections = compositionState.getSections() || [];
        }
    } catch (e) {
        // Composition state not available
    }

    // Refresh the insert context in the state module
    refreshInsertContext(sections, progressionLength);

    // Check if we have a selection
    if (!selectedIndices || selectedIndices.length === 0) {
        // No selection - show prompt if there are chords in progression
        if (progression && progression.length > 0) {
            showSelectionRequiredPrompt();
        } else {
            // Empty progression - show controls but with "(start of progression)" message
            hideSelectionRequiredPrompt();
            updateInsertPositionDisplay(null, true);
        }
    } else {
        // Have selection - show controls
        hideSelectionRequiredPrompt();

        // Get the last selected index (for multi-select)
        const insertAfterIndex = selectedIndices[selectedIndices.length - 1];

        // Update the insert position display
        updateInsertPositionDisplay(insertAfterIndex, false);

        // Update section info
        updateSectionInfo(insertAfterIndex);
    }

    // Update the intent mode display
    updateIntentModeDisplay();
}

/**
 * Show the "selection required" prompt
 */
function showSelectionRequiredPrompt() {
    if (selectionRequiredPrompt) {
        selectionRequiredPrompt.classList.remove('hidden');
    }
    if (sectionIntentControls) {
        sectionIntentControls.classList.add('hidden');
    }
}

/**
 * Hide the "selection required" prompt and show controls
 */
function hideSelectionRequiredPrompt() {
    if (selectionRequiredPrompt) {
        selectionRequiredPrompt.classList.add('hidden');
    }
    if (sectionIntentControls) {
        sectionIntentControls.classList.remove('hidden');
    }
}

/**
 * Update the "Inserting after:" display
 */
function updateInsertPositionDisplay(chordIndex, isEmptyProgression) {
    if (!insertPositionChord) return;

    if (isEmptyProgression) {
        insertPositionChord.textContent = '(start of progression)';
        return;
    }

    if (chordIndex === null || chordIndex === undefined) {
        insertPositionChord.textContent = '(none selected)';
        return;
    }

    const progression = getProgressionData();
    if (!progression || chordIndex >= progression.length) {
        insertPositionChord.textContent = `Chord ${chordIndex + 1}`;
        return;
    }

    const chord = progression[chordIndex];
    const chordName = `${chord.root || 'Unknown'} ${chord.type || ''}`.trim();
    insertPositionChord.textContent = `"${chordName}" (chord ${chordIndex + 1})`;
}

/**
 * Update the section info display
 */
function updateSectionInfo(chordIndex) {
    if (!currentSectionName) return;

    try {
        const compositionState = getCompositionState();
        if (!compositionState) {
            currentSectionName.textContent = '(ungrouped)';
            return;
        }

        const sections = compositionState.getSections();
        if (!sections || sections.length === 0) {
            currentSectionName.textContent = '(ungrouped)';
            return;
        }

        // Find the section containing this chord
        for (const section of sections) {
            if (section.chordIndices && section.chordIndices.includes(chordIndex)) {
                const sectionType = section.type || 'Unknown';
                const sectionLabel = section.label || sectionType.charAt(0).toUpperCase() + sectionType.slice(1);
                currentSectionName.textContent = sectionLabel;
                return;
            }
        }

        currentSectionName.textContent = '(ungrouped)';
    } catch (e) {
        currentSectionName.textContent = '(ungrouped)';
    }
}

/**
 * Update the intent mode radio buttons and sub-options visibility
 */
function updateIntentModeDisplay() {
    const intent = getSectionIntent();

    // Update radio button states
    const continueRadio = document.querySelector('input[name="section-intent-mode"][value="continue"]');
    const newRadio = document.querySelector('input[name="section-intent-mode"][value="new"]');

    if (continueRadio && newRadio) {
        continueRadio.checked = intent.mode === INTENT_MODES.CONTINUE;
        newRadio.checked = intent.mode === INTENT_MODES.NEW_SECTION;
    }

    // Show/hide sub-options
    if (continueOptions && newSectionOptions) {
        if (intent.mode === INTENT_MODES.CONTINUE) {
            continueOptions.classList.remove('hidden');
            newSectionOptions.classList.add('hidden');
        } else {
            continueOptions.classList.add('hidden');
            newSectionOptions.classList.remove('hidden');
        }
    }

    // Update submode radio buttons
    const submodeRadios = document.querySelectorAll('input[name="continue-submode"]');
    submodeRadios.forEach(radio => {
        radio.checked = radio.value === intent.subMode;
    });

    // Update section type select
    const sectionTypeSelect = document.getElementById('new-section-type-select');
    if (sectionTypeSelect && intent.newSectionType) {
        sectionTypeSelect.value = intent.newSectionType;
    }
}

/**
 * Handle "Select Last Chord" button click
 */
async function handleSelectLastChord() {
    const progression = getProgressionData();
    if (!progression || progression.length === 0) return;

    const lastIndex = progression.length - 1;

    // Try to use the selectChordCard function from progressionBuilder
    const selectChordCard = await getSelectChordCard();
    if (selectChordCard) {
        selectChordCard(lastIndex);
    } else {
        // Fallback: update state directly
        selectSingle(lastIndex);
    }

    // Also update the insert position
    setInsertAfterIndex(lastIndex);
    refreshUI();
}

/**
 * Handle intent mode change (Continue vs New Section)
 */
function handleIntentModeChange(event) {
    const mode = event.target.value === 'new' ? INTENT_MODES.NEW_SECTION : INTENT_MODES.CONTINUE;

    // Update sub-options visibility
    if (continueOptions && newSectionOptions) {
        if (mode === INTENT_MODES.CONTINUE) {
            continueOptions.classList.remove('hidden');
            newSectionOptions.classList.add('hidden');
        } else {
            continueOptions.classList.add('hidden');
            newSectionOptions.classList.remove('hidden');
        }
    }

    // Update state - this automatically dispatches 'sectionIntentChanged' event
    setSectionIntent({ mode });
}

/**
 * Handle continue submode change
 */
function handleContinueSubmodeChange(event) {
    const subMode = event.target.value;

    // Update state - this automatically dispatches 'sectionIntentChanged' event
    setSectionIntent({ subMode });
}

/**
 * Handle new section type change
 */
function handleNewSectionTypeChange(event) {
    const newSectionType = event.target.value;

    // Update state - this automatically dispatches 'sectionIntentChanged' event
    setSectionIntent({ newSectionType });
}

/**
 * Get the current section intent for external use
 */
export function getCurrentSectionIntent() {
    return getSectionIntent();
}

/**
 * Check if the UI is initialized
 */
export function isUIInitialized() {
    return isInitialized;
}

// Export for testing
export default {
    initSectionIntentUI,
    refreshUI,
    getCurrentSectionIntent,
    isUIInitialized
};
