/**
 * Section Intent State Module
 * Phase 2: Section Context Integration
 *
 * Tracks the user's intended section context for the next chord to be added.
 * This allows the recommendation engine to provide context-appropriate suggestions
 * and enables position-based chord insertion.
 */

import { getSelectedIndicesArray, getSelectedChordIndex } from './trainerState.js';

/**
 * Section intent modes
 */
export const INTENT_MODES = {
    CONTINUE: 'continue',
    NEW_SECTION: 'new'
};

/**
 * Sub-modes for continuing a section
 */
export const CONTINUE_SUBMODES = {
    BUILDING: 'building',      // Section is still growing, middle position
    CONCLUDING: 'concluding',  // Approaching section end, pre-cadence
    FINAL: 'final'             // This is the last chord of the section
};

/**
 * Internal state object
 */
let sectionIntent = {
    // Primary mode: continue current section or start new
    mode: INTENT_MODES.CONTINUE,

    // Sub-mode for continue: building, concluding, or final
    subMode: CONTINUE_SUBMODES.BUILDING,

    // For new section mode: which type to create
    newSectionType: 'verse',

    // Current section being extended (section object or null for ungrouped)
    targetSection: null,

    // Computed ungrouped range if chord is not in a section
    ungroupedRange: null,

    // Index to insert after (based on selection)
    insertAfterIndex: null,

    // Whether user needs to select a chord first
    needsSelection: false,

    // Timestamp of last update (for debugging)
    lastUpdated: null
};

/**
 * Listeners for state changes
 */
const listeners = new Set();

/**
 * Notify all listeners of state change
 */
function notifyListeners() {
    const state = getSectionIntent();
    listeners.forEach(callback => {
        try {
            callback(state);
        } catch (e) {

        }
    });

    // Also dispatch a global event
    window.dispatchEvent(new CustomEvent('sectionIntentChanged', {
        detail: state
    }));
}

/**
 * Get the current section intent state
 * @returns {Object} Copy of current intent state
 */
export function getSectionIntent() {
    return { ...sectionIntent };
}

/**
 * Update section intent with partial updates
 * @param {Object} updates - Properties to update
 */
export function setSectionIntent(updates) {
    sectionIntent = {
        ...sectionIntent,
        ...updates,
        lastUpdated: Date.now()
    };
    notifyListeners();
}

/**
 * Get the current intent mode
 * @returns {string} 'continue' or 'new'
 */
export function getSectionIntentMode() {
    return sectionIntent.mode;
}

/**
 * Set the intent mode
 * @param {string} mode - INTENT_MODES.CONTINUE or INTENT_MODES.NEW_SECTION
 */
export function setSectionIntentMode(mode) {
    if (mode !== INTENT_MODES.CONTINUE && mode !== INTENT_MODES.NEW_SECTION) {

        return;
    }
    setSectionIntent({ mode });
}

/**
 * Get the continue sub-mode
 * @returns {string} 'building', 'concluding', or 'final'
 */
export function getContinueSubMode() {
    return sectionIntent.subMode;
}

/**
 * Set the continue sub-mode
 * @param {string} subMode - One of CONTINUE_SUBMODES
 */
export function setContinueSubMode(subMode) {
    if (!Object.values(CONTINUE_SUBMODES).includes(subMode)) {

        return;
    }
    setSectionIntent({ subMode });
}

/**
 * Get the new section type
 * @returns {string} Section type (verse, chorus, etc.)
 */
export function getNewSectionType() {
    return sectionIntent.newSectionType;
}

/**
 * Set the new section type
 * @param {string} type - Section type to create
 */
export function setNewSectionType(type) {
    setSectionIntent({ newSectionType: type });
}

/**
 * Get the index to insert after
 * @returns {number|null} Index or null if not set
 */
export function getInsertAfterIndex() {
    return sectionIntent.insertAfterIndex;
}

/**
 * Set the index to insert after
 * @param {number|null} index - Index to insert after
 */
export function setInsertAfterIndex(index) {
    setSectionIntent({ insertAfterIndex: index });
}

/**
 * Get the target section being extended
 * @returns {Object|null} Section object or null
 */
export function getTargetSection() {
    return sectionIntent.targetSection;
}

/**
 * Check if user needs to select a chord first
 * @returns {boolean} True if selection is needed
 */
export function needsChordSelection() {
    return sectionIntent.needsSelection;
}

/**
 * Subscribe to section intent changes
 * @param {Function} callback - Function to call on state change
 * @returns {Function} Unsubscribe function
 */
export function subscribeToIntentChanges(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
}

/**
 * Compute the insertion context based on current selection state
 * @param {Array} sections - Section data from compositionState
 * @param {number} progressionLength - Total chords in progression
 * @returns {Object} Computed context
 */
export function computeInsertContext(sections, progressionLength) {
    // Get current selection
    const selectedIndices = getSelectedIndicesArray();

    // If no selection and progression exists, user needs to select
    if ((!selectedIndices || selectedIndices.length === 0) && progressionLength > 0) {
        return {
            insertAfterIndex: null,
            targetSection: null,
            ungroupedRange: null,
            needsSelection: true
        };
    }

    // If empty progression, insert at position 0 (will be first chord)
    if (progressionLength === 0) {
        return {
            insertAfterIndex: -1, // Special case: insert at beginning
            targetSection: null,
            ungroupedRange: { startIndex: 0, endIndex: 0, length: 1 },
            needsSelection: false
        };
    }

    // Use last selected chord as insertion point
    const insertAfterIndex = selectedIndices[selectedIndices.length - 1];

    // Find section for this chord
    let targetSection = null;
    if (sections && sections.length > 0) {
        for (const section of sections) {
            if (section.chordIndices && section.chordIndices.includes(insertAfterIndex)) {
                targetSection = { ...section };
                break;
            }
        }
    }

    // If ungrouped, compute implicit section range
    let ungroupedRange = null;
    if (!targetSection) {
        ungroupedRange = computeUngroupedRange(insertAfterIndex, sections || [], progressionLength);
    }

    return {
        insertAfterIndex,
        targetSection,
        ungroupedRange,
        needsSelection: false
    };
}

/**
 * Compute range of ungrouped chords (implicit section)
 * @param {number} chordIndex - Index of the chord
 * @param {Array} sections - All sections
 * @param {number} progressionLength - Total progression length
 * @returns {Object} Range object { startIndex, endIndex, length }
 */
function computeUngroupedRange(chordIndex, sections, progressionLength) {
    if (progressionLength === 0) {
        return { startIndex: 0, endIndex: 0, length: 1 };
    }

    // Collect all chord indices that are in sections
    const groupedIndices = new Set();
    sections.forEach(section => {
        if (section.chordIndices) {
            section.chordIndices.forEach(idx => groupedIndices.add(idx));
        }
    });

    // Find contiguous ungrouped range containing chordIndex
    let startIndex = chordIndex;
    let endIndex = chordIndex;

    // Expand backward
    while (startIndex > 0 && !groupedIndices.has(startIndex - 1)) {
        startIndex--;
    }

    // Expand forward
    while (endIndex < progressionLength - 1 && !groupedIndices.has(endIndex + 1)) {
        endIndex++;
    }

    return {
        startIndex,
        endIndex,
        length: endIndex - startIndex + 1
    };
}

/**
 * Update the section intent state based on current selection
 * Call this when selection changes or when opening the panel
 * @param {Array} sections - Sections from compositionState
 * @param {number} progressionLength - Total chords
 */
export function refreshInsertContext(sections, progressionLength) {
    const context = computeInsertContext(sections, progressionLength);

    setSectionIntent({
        insertAfterIndex: context.insertAfterIndex,
        targetSection: context.targetSection,
        ungroupedRange: context.ungroupedRange,
        needsSelection: context.needsSelection
    });

    return context;
}

/**
 * Update the section intent state based on a specific chord index
 * Use this when you have an explicit index (e.g., from modal's selectedProgressionIndex)
 * instead of relying on the global trainer selection state
 * @param {number} chordIndex - The chord index to compute context for
 * @param {Array} sections - Sections from compositionState
 * @param {number} progressionLength - Total chords
 * @returns {Object} The computed context
 */
export function refreshInsertContextForIndex(chordIndex, sections, progressionLength) {
    // If no valid index, return empty context
    if (chordIndex < 0 || chordIndex >= progressionLength) {
        return {
            insertAfterIndex: null,
            targetSection: null,
            ungroupedRange: null,
            needsSelection: true
        };
    }

    // Find section for this chord
    let targetSection = null;
    if (sections && sections.length > 0) {
        for (const section of sections) {
            if (section.chordIndices && section.chordIndices.includes(chordIndex)) {
                targetSection = { ...section };
                break;
            }
        }
    }

    // If ungrouped, compute implicit section range
    let ungroupedRange = null;
    if (!targetSection) {
        ungroupedRange = computeUngroupedRange(chordIndex, sections || [], progressionLength);
    }

    const context = {
        insertAfterIndex: chordIndex,
        targetSection,
        ungroupedRange,
        needsSelection: false
    };

    // Update the state
    setSectionIntent(context);

    return context;
}

/**
 * Get section context for recommendation scoring based on current intent
 * This translates user intent into the format expected by sectionTransitionAnalyzer
 * @returns {Object|null} Section context for scoring
 */
export function getEffectiveSectionContext() {
    const intent = getSectionIntent();

    // If user needs to select, no context
    if (intent.needsSelection) {
        return null;
    }

    // Determine section type and position based on intent
    let sectionType, position, isAtSectionEnd, nextSectionType;

    if (intent.mode === INTENT_MODES.NEW_SECTION) {
        // Starting a new section - this chord will be first in new section
        sectionType = intent.newSectionType;
        position = 'first';
        isAtSectionEnd = false;
        nextSectionType = null;
    } else {
        // Continuing current section
        if (intent.targetSection) {
            sectionType = intent.targetSection.type;
        } else {
            // Ungrouped - default to 'custom' or could infer from context
            sectionType = 'custom';
        }

        // Map subMode to position
        switch (intent.subMode) {
            case CONTINUE_SUBMODES.BUILDING:
                position = 'middle';
                isAtSectionEnd = false;
                break;
            case CONTINUE_SUBMODES.CONCLUDING:
                position = 'end';
                isAtSectionEnd = false; // Not the last chord, but approaching end
                break;
            case CONTINUE_SUBMODES.FINAL:
                position = 'end';
                isAtSectionEnd = true; // This IS the last chord
                break;
            default:
                position = 'middle';
                isAtSectionEnd = false;
        }
    }

    // Build the context object matching sectionTransitionAnalyzer expectations
    return {
        currentSectionType: sectionType,
        currentSectionId: intent.targetSection?.id || null,
        positionInSection: -1, // Unknown, using position category instead
        sectionLength: intent.targetSection?.chordIndices?.length ||
                       intent.ungroupedRange?.length || 1,
        position: position,
        isAtSectionEnd: isAtSectionEnd,
        nextSectionType: nextSectionType,
        isTransitionPoint: isAtSectionEnd && nextSectionType !== null,
        // Additional info for recommendation service
        intentMode: intent.mode,
        intentSubMode: intent.subMode
    };
}

/**
 * Reset section intent to defaults
 */
export function resetSectionIntent() {
    sectionIntent = {
        mode: INTENT_MODES.CONTINUE,
        subMode: CONTINUE_SUBMODES.BUILDING,
        newSectionType: 'verse',
        targetSection: null,
        ungroupedRange: null,
        insertAfterIndex: null,
        needsSelection: false,
        lastUpdated: Date.now()
    };
    notifyListeners();
}

/**
 * Get a human-readable description of current intent
 * @returns {string} Description for UI display
 */
export function getIntentDescription() {
    const intent = getSectionIntent();

    if (intent.needsSelection) {
        return 'Select a chord to indicate insertion point';
    }

    if (intent.mode === INTENT_MODES.NEW_SECTION) {
        const typeLabel = intent.newSectionType.charAt(0).toUpperCase() +
                          intent.newSectionType.slice(1);
        return `Starting new ${typeLabel} section`;
    }

    // Continue mode
    const sectionName = intent.targetSection?.label || 'ungrouped section';

    switch (intent.subMode) {
        case CONTINUE_SUBMODES.BUILDING:
            return `Continuing ${sectionName}`;
        case CONTINUE_SUBMODES.CONCLUDING:
            return `Approaching end of ${sectionName}`;
        case CONTINUE_SUBMODES.FINAL:
            return `Final chord of ${sectionName}`;
        default:
            return `Continuing ${sectionName}`;
    }
}

// Export constants for external use
export { INTENT_MODES as SectionIntentModes };
export { CONTINUE_SUBMODES as ContinueSubModes };
