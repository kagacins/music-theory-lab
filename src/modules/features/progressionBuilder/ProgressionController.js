/**
 * ProgressionController.js
 *
 * Phase 1.6 of progressionBuilder.js refactoring
 *
 * RESPONSIBILITY: Controller and state management functions for chord progression operations
 *
 * This module contains all controller functions that manage chord progression state:
 * - Chord Updates (type, root, inversion, duration, voicing, octave)
 * - Chord Addition (by params, to sections)
 * - Chord Removal (single, multiple, clear)
 * - Chord Note Management (toggle notes, notation)
 * - Chord Selection (single, multi-select, keyboard shortcuts)
 * - Copy/Paste/Duplicate operations
 * - Data Loading/Saving
 * - Key & Transposition (key changes, transpose chords/melody)
 * - Recording (record mode toggle, save)
 * - History & Undo/Redo (capture state, restore, undo, redo)
 * - View Mode & Section Management (scroll vs section view, section selection)
 * - Panel Toggles (collapse/expand panels)
 * - Helper functions for controller operations
 *
 * DEPENDENCIES:
 * - trainerState: Progression data, current index, key, etc.
 * - compositionState: Single source of truth for chord data
 * - sectionIntentState: Position-based insertion
 * - globalState: Tab, notation preference
 * - buildingBlock: Undo/redo serialization
 * - noteUtils: Note/chord utilities
 * - romanNumerals: Roman numeral conversion
 * - music-data: Chord definitions, scales, intervals
 * - audioEngine: Audio playback
 * - lessonGuidedMode: Tutorial event dispatching
 * - autoSave: Dirty marking
 *
 * EXPORTS:
 * All controller functions are exported for use by main progressionBuilder.js
 * and other modules. This is the largest export list in the refactoring.
 */

// ============================================================================
// IMPORTS
// ============================================================================

// State management
import {
    getTrainerState,
    setProgressionData,
    setCurrentIndex,
    setIsPlaying,
    setIsReady,
    setIsRecording,
    setRecordedProgression,
    setProgressionRomans,
    setCurrentKey,
    setScaleNotes,
    setTrainerChordNotes,
    getProgressionData,
    getCurrentIndex,
    getIsPlaying,
    getIsRecording,
    getCurrentKey,
    getProgressionRomans,
    getScaleNotes,
    getTrainerChordNotes,
    getStepChordTimeoutId,
    setStepChordTimeoutId,
    getSuggestionStyle,
    setSuggestionStyle,
    getSuggestionMood,
    setSuggestionMood,
    getStyleMoodSuggestions,
    setStyleMoodSuggestions,
    getTensionProfile,
    setTensionProfile,
    getSelectedChordIndex,
    setSelectedChordIndex,
    // Multi-select state
    getSelectedChordIndices,
    isChordSelected,
    addToSelection,
    removeFromSelection,
    toggleSelection,
    clearSelection,
    selectSingle,
    selectRange,
    getLastSelectedIndex,
    getSelectionCount,
    getSelectedIndicesArray,
    // Clipboard state
    setClipboard,
    getClipboard,
    clearClipboard,
    hasClipboard,
    // Cache management
    invalidateProgressionDataCache
} from '../../state/trainerState.js';

import {
    getCurrentTab,
    getNotationPreference
} from '../../state/globalState.js';

import { BuildingBlockSequence } from '../../state/buildingBlock.js';

// Guided mode integration
import { dispatchBuilderEvent, isGuidedModeActive, validateProgressionChord } from '../../ui/lessonGuidedMode.js';

// Audio utilities
import {
    getPiano,
    getInstrument,
    getAudioIsReady,
    getAudioIsLoading,
    initAudio,
    whenAudioReady
} from '../../audio/audioEngine.js';

// Auto-save
import { markDirty as markAutoSaveDirty } from '../../storage/autoSave.js';

// CompositionState for treble transposition
import { getCompositionState } from '../../state/compositionState.js';

// Note/chord utilities
import {
    noteToMidi,
    resolveEnharmonic,
    getNoteKeyId,
    getInvertedChordNotes,
    getLHNotes,
    getEnharmonicPreferenceForKey
} from '../../utils/noteUtils.js';

// Roman numeral utilities
import { noteToRomanNumeral } from '../../utils/romanNumerals.js';

// Data definitions
import {
    SHARP_NOTES,
    FLAT_NOTES,
    ALL_NOTES,
    CHORD_DEFINITIONS,
    INVERSION_NAMES,
    MAJOR_SCALE_STEPS,
    ENHARMONIC_MAP,
    ROMAN_MAP_BASE
} from '../../../data/music-data.js';

// Section intent for position-based insertion
import {
    getInsertAfterIndex,
    getSectionIntent,
    setSectionIntent,
    INTENT_MODES
} from '../../state/sectionIntentState.js';

// Undo/redo utilities
import {
    saveState,
    undo as undoHistory,
    redo as redoHistory,
    pushToRedoStack,
    pushToUndoStack,
    clearHistory,
    canUndo,
    canRedo
} from '../../utils/undoRedo.js';

// TEMPORARY: Import working implementations from old module for delegation
import {
    loadProgression as loadProgressionOld,
    updateProgressionEnharmonics as updateProgressionEnharmonicsOld,
    removeChordFromProgression as removeChordFromProgressionOld,
    clearProgression as clearProgressionOld,
    toggleProgressionNote as toggleProgressionNoteOld,
    toggleProgressionLHNote as toggleProgressionLHNoteOld
} from '../progressionBuilder.js';

// ============================================================================
// MODULE-LEVEL STATE
// ============================================================================

// View mode: 'scroll' (horizontal scroll) or 'section' (section-based navigation)
let progressionViewMode = 'scroll';

// Selected section IDs for section view mode (supports multi-select)
let selectedSectionIds = new Set();

// User's preferred section order (includes both real section IDs and pseudo-section IDs)
// null means use default ordering, array means use this specific order
let userSectionOrder = null;

// LocalStorage key for view mode persistence
const VIEW_MODE_STORAGE_KEY = 'progression-view-mode';

// ============================================================================
// VIEW MODE STATE FUNCTIONS
// ============================================================================

/**
 * Initialize view mode from localStorage
 */
function initViewModeState() {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === 'scroll' || stored === 'section') {
        progressionViewMode = stored;
    }
}

/**
 * Get current view mode
 * @returns {'scroll'|'section'} Current view mode
 */
export function getProgressionViewMode() {
    return progressionViewMode;
}

/**
 * Set view mode and persist to localStorage
 * @param {'scroll'|'section'} mode - View mode to set
 */
export function setProgressionViewMode(mode) {
    if (mode !== 'scroll' && mode !== 'section') return;
    progressionViewMode = mode;
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);

    // Clear section selection when switching modes
    if (mode === 'scroll') {
        selectedSectionIds.clear();
        // Also clear the notation measure filter so render() shows all measures
        const notationComposer = window.getNotationComposer ? window.getNotationComposer() : null;
        if (notationComposer && typeof notationComposer.clearMeasureFilter === 'function') {
            notationComposer.clearMeasureFilter();
        }
    }
}

/**
 * Get selected section IDs for section view
 * @returns {Array<string>} Array of selected section IDs
 */
export function getSelectedSectionIds() {
    return [...selectedSectionIds];
}

/**
 * Check if a section is currently selected
 * @param {string} sectionId - Section ID to check
 * @returns {boolean} True if section is selected
 */
export function isSectionSelectedInView(sectionId) {
    return selectedSectionIds.has(sectionId);
}

/**
 * Select a section (optionally additive for multi-select)
 * @param {string} sectionId - Section ID to select
 * @param {boolean} additive - If true, add to selection; if false, replace selection
 */
export function selectSectionInView(sectionId, additive = false) {
    if (!additive) {
        selectedSectionIds.clear();
    }
    selectedSectionIds.add(sectionId);
}

/**
 * Deselect a section
 * @param {string} sectionId - Section ID to deselect
 */
export function deselectSectionInView(sectionId) {
    selectedSectionIds.delete(sectionId);
}

/**
 * Clear all section selections
 */
export function clearSectionSelection() {
    selectedSectionIds.clear();
    // Reset user section order to default when selection is cleared
    userSectionOrder = null;
    // Also clear the notation measure filter when clearing section selection
    const notationComposer = window.getNotationComposer ? window.getNotationComposer() : null;
    if (notationComposer && typeof notationComposer.clearMeasureFilter === 'function') {
        notationComposer.clearMeasureFilter();
    }
}

/**
 * Select a range of adjacent sections from last selected to target
 * @param {string} targetSectionId - Target section ID
 * @param {Array} sections - Array of all sections (in order)
 */
export function selectSectionRange(targetSectionId, sections) {
    if (selectedSectionIds.size === 0) {
        // No previous selection, just select the target
        selectedSectionIds.add(targetSectionId);
        return;
    }

    // Get the current selection's last section
    const selectedArray = [...selectedSectionIds];
    const lastSelectedId = selectedArray[selectedArray.length - 1];

    // Find indices
    const lastIndex = sections.findIndex(s => s.id === lastSelectedId);
    const targetIndex = sections.findIndex(s => s.id === targetSectionId);

    if (lastIndex === -1 || targetIndex === -1) return;

    // Select all sections in range
    const start = Math.min(lastIndex, targetIndex);
    const end = Math.max(lastIndex, targetIndex);

    for (let i = start; i <= end; i++) {
        selectedSectionIds.add(sections[i].id);
    }
}

/**
 * Navigate to previous section in section view
 * Handles pseudo-sections and wraps to "All" view
 */
export function navigateToPreviousSection() {
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    const realSections = compositionState.getSections();
    // Get all sections including pseudo-sections, already sorted by position
    // Use window for buildSectionChipsWithUngrouped (old module function)
    const allSections = window.buildSectionChipsWithUngrouped ?
        window.buildSectionChipsWithUngrouped(realSections) : [];
    if (allSections.length === 0) return;

    const selectedIds = getSelectedSectionIds();
    if (selectedIds.length === 0) {
        // Already at "All" - select last section
        selectSectionInView(allSections[allSections.length - 1].id);
    } else {
        // Find current section index and go to previous
        const currentId = selectedIds[0];
        const currentIndex = allSections.findIndex(s => s.id === currentId);
        if (currentIndex === -1) {
            // Current selection not found, go to "All"
            clearSectionSelection();
        } else if (currentIndex === 0) {
            // At first section - go to "All" (clear selection)
            clearSectionSelection();
        } else {
            const prevIndex = currentIndex - 1;
            selectSectionInView(allSections[prevIndex].id);
        }
    }

    // Use window for helper functions (old module)
    if (window.rerenderActiveProgressionDisplay) {
        window.rerenderActiveProgressionDisplay();
    }
    if (window.updateNotationForSelectedSections) {
        window.updateNotationForSelectedSections();
    }
}

/**
 * Navigate to next section in section view
 * Handles pseudo-sections and stays at last section
 */
export function navigateToNextSection() {
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    const realSections = compositionState.getSections();
    // Get all sections including pseudo-sections, already sorted by position
    // Use window for buildSectionChipsWithUngrouped (old module function)
    const allSections = window.buildSectionChipsWithUngrouped ?
        window.buildSectionChipsWithUngrouped(realSections) : [];
    if (allSections.length === 0) return;

    const selectedIds = getSelectedSectionIds();
    if (selectedIds.length === 0) {
        // No selection - select first section
        selectSectionInView(allSections[0].id);
    } else {
        // Find current section index and go to next
        const currentId = selectedIds[selectedIds.length - 1];
        const currentIndex = allSections.findIndex(s => s.id === currentId);
        if (currentIndex === -1) {
            // Current selection not found, select first
            selectSectionInView(allSections[0].id);
        } else {
            const nextIndex = Math.min(allSections.length - 1, currentIndex + 1);
            selectSectionInView(allSections[nextIndex].id);
        }
    }

    // Use window for helper functions (old module)
    if (window.rerenderActiveProgressionDisplay) {
        window.rerenderActiveProgressionDisplay();
    }
    if (window.updateNotationForSelectedSections) {
        window.updateNotationForSelectedSections();
    }
}

// Initialize view mode state on load
initViewModeState();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the enharmonic preference based on the current key
 */
export function getKeyBasedEnharmonic() {
    const currentKey = getCurrentKey();
    return getEnharmonicPreferenceForKey(currentKey);
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get max inversion for LH type
 * @param {string} lhType - Left hand type
 * @returns {number} Maximum inversion number
 */
function getMaxInversionForLhType(lhType) {
    let intervals;
    if (lhType === 'Major' || lhType === 'Minor' || lhType === 'Dominant 7th') {
        intervals = CHORD_DEFINITIONS[lhType].intervals;
    } else if (lhType === 'shell_maj7' || lhType === 'shell_min7' || lhType === 'shell_dom7') {
        intervals = [0, 4, 11]; // All shells are 3-note chords
    } else {
        return 0;
    }
    return intervals.length - 1;
}

/**
 * Calculate scale notes for a given key
 * @param {string} key - Root note of the scale
 * @param {number} octave - Base octave
 * @param {number} octaveShift - Octave shift from base
 * @returns {Array<string>} Array of scale note names with octaves
 */
function calculateScaleNotes(key, octave = 4, octaveShift = 0) {
    const baseOctave = octave + octaveShift;
    let scaleRootIndex = ALL_NOTES.indexOf(key);
    if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[key]);

    const scaleRootMidi = noteToMidi(ALL_NOTES[scaleRootIndex] + baseOctave);
    const scaleMidiNotes = MAJOR_SCALE_STEPS.map(step => scaleRootMidi + step);
    const rawNoteNames = scaleMidiNotes.map(midi => Tone.Midi(midi).toNote());
    const resolvedNoteNames = rawNoteNames.map(note => resolveEnharmonic(note, key, getKeyBasedEnharmonic()));

    return resolvedNoteNames;
}

/**
 * Transpose a single pitch by a number of semitones
 * @param {string} pitch - The pitch to transpose (e.g., 'C4', 'F#5')
 * @param {number} semitones - Number of semitones to shift (can be negative)
 * @param {Array} noteArray - Array of note names to use for spelling
 * @returns {string} The transposed pitch
 */
function transposePitch(pitch, semitones, noteArray) {
    // Parse pitch into note name and octave
    const match = pitch.match(/^([A-Ga-g][#b]?)(\d+)$/);
    if (!match) {
        console.warn('[transposePitch] Could not parse pitch:', pitch);
        return pitch;
    }

    const noteName = match[1].toUpperCase();
    let octave = parseInt(match[2], 10);

    // Find note index - first try directly, then use enharmonic equivalent
    let noteIndex = ALL_NOTES.indexOf(noteName);
    if (noteIndex === -1) {
        const enharmonicNote = ENHARMONIC_MAP[noteName];
        if (enharmonicNote) {
            noteIndex = ALL_NOTES.indexOf(enharmonicNote);
        }
    }

    if (noteIndex === -1) {
        console.warn('[transposePitch] Could not find note index:', noteName);
        return pitch;
    }

    // Calculate new index and octave
    let newIndex = noteIndex + semitones;
    while (newIndex >= 12) {
        newIndex -= 12;
        octave++;
    }
    while (newIndex < 0) {
        newIndex += 12;
        octave--;
    }

    const newNoteName = noteArray[newIndex];
    return `${newNoteName}${octave}`;
}

/**
 * Adjust a pitch for mode change (major ↔ minor)
 * @param {string} pitch - The pitch to potentially adjust (already transposed)
 * @param {string} keyRoot - The root note of the new key
 * @param {boolean} isMinor - Whether the new key is minor
 * @param {Array} noteArray - Array of note names to use for spelling
 * @returns {string} The adjusted pitch (or original if no adjustment needed)
 */
function adjustPitchForModeChange(pitch, keyRoot, isMinor, noteArray) {
    // Parse pitch
    const match = pitch.match(/^([A-Ga-g][#b]?)(\d+)$/);
    if (!match) return pitch;

    const noteName = match[1].toUpperCase();
    const octave = parseInt(match[2], 10);

    // Find note index
    let noteIndex = ALL_NOTES.indexOf(noteName);
    if (noteIndex === -1) {
        const enharmonicNote = ENHARMONIC_MAP[noteName];
        if (enharmonicNote) {
            noteIndex = ALL_NOTES.indexOf(enharmonicNote);
        }
    }

    // Find key root index
    let keyIndex = ALL_NOTES.indexOf(keyRoot);
    if (keyIndex === -1) {
        const enharmonicKey = ENHARMONIC_MAP[keyRoot];
        if (enharmonicKey) {
            keyIndex = ALL_NOTES.indexOf(enharmonicKey);
        }
    }

    if (noteIndex === -1 || keyIndex === -1) return pitch;

    // Calculate scale degree (semitones from key root)
    const semitoneFromRoot = (noteIndex - keyIndex + 12) % 12;

    if (isMinor) {
        // We want minor scale - check if note is at major 3rd, 6th, or 7th and lower it
        if (semitoneFromRoot === 4) {
            return transposePitch(pitch, -1, noteArray);
        } else if (semitoneFromRoot === 9) {
            return transposePitch(pitch, -1, noteArray);
        } else if (semitoneFromRoot === 11) {
            return transposePitch(pitch, -1, noteArray);
        }
    } else {
        // We want major scale - check if note is at minor 3rd, 6th, or 7th and raise it
        if (semitoneFromRoot === 3) {
            return transposePitch(pitch, 1, noteArray);
        } else if (semitoneFromRoot === 8) {
            return transposePitch(pitch, 1, noteArray);
        } else if (semitoneFromRoot === 10) {
            return transposePitch(pitch, 1, noteArray);
        }
    }

    return pitch; // No adjustment needed for other scale degrees
}

// ============================================================================
// CHORD UPDATE FUNCTIONS
// ============================================================================

/**
 * Update chord type from simplified view
 * @param {number} index - Chord index
 * @param {string} newType - New chord type
 * Delegates to old module implementation via window
 */
export function updateChordType(index, newType) {
    // Use old module implementation
    if (window.updateChordTypeOld) {
        window.updateChordTypeOld(index, newType);
    }
}

/**
 * Update chord root note from simplified view
 * @param {number} index - Chord index
 * @param {string} newRoot - New root note
 * Delegates to old module implementation via window
 */
export function updateChordRoot(index, newRoot) {
    // Use old module implementation
    if (window.updateChordRootOld) {
        window.updateChordRootOld(index, newRoot);
    }
}

/**
 * Update chord inversion from simplified view
 * @param {number} index - Chord index
 * @param {number} newInversion - New inversion
 * @param {boolean} shouldUpdateUI - Whether to update UI
 * @param {boolean} shouldSyncNotation - Whether to sync notation
 * Delegates to old module implementation via window
 */
export function updateChordInversion(index, newInversion, shouldUpdateUI = true, shouldSyncNotation = true) {
    // Use old module implementation
    if (window.updateChordInversionOld) {
        window.updateChordInversionOld(index, newInversion, shouldUpdateUI, shouldSyncNotation);
    }
}

/**
 * Update chord duration from simplified view
 * @param {number} index - Chord index
 * @param {HTMLElement} sourceElement - Source element triggering the change
 * Delegates to old module implementation via window
 */
export function updateChordDuration(index, sourceElement) {
    // Use old module implementation
    if (window.updateChordDurationOld) {
        window.updateChordDurationOld(index, sourceElement);
    }
}

/**
 * Finalize duration change after update (or after user confirmation)
 */
export function finalizeDurationChange(index, totalBeats) {
    // TODO: Extract implementation from progressionBuilder.js
    console.log('[ProgressionController] finalizeDurationChange - placeholder');
}

/**
 * Update chord voicing from simplified view
 */
export function updateChordVoicing(index, newVoicing) {
    // TODO: Extract implementation from progressionBuilder.js
    console.log('[ProgressionController] updateChordVoicing - placeholder');
}

/**
 * Update RH octave shift
 */
export function updateRHOctaveShift(index, shift) {
    // TODO: Extract implementation from progressionBuilder.js
    console.log('[ProgressionController] updateRHOctaveShift - placeholder');
}

/**
 * Update a progression chord's properties
 * @param {number} index - Index of chord
 * @param {string} property - Property to update
 * @param {*} value - New value
 */
export function updateProgressionChord(index, property, value) {
    // TODO: Extract implementation from progressionBuilder.js
    console.log('[ProgressionController] updateProgressionChord - placeholder');
}

/**
 * Update left hand properties for a progression chord
 * @param {number} index - Index of chord
 * @param {string} property - Property to update
 * @param {*} value - New value
 */
export function updateProgressionChordLH(index, property, value) {
    // TODO: Extract implementation from progressionBuilder.js
    console.log('[ProgressionController] updateProgressionChordLH - placeholder');
}

/**
 * Update chord and render preserving treble notes
 */
export function updateChordAndRenderPreservingTrebleNotes(index, options = {}) {
    // TODO: Extract implementation from progressionBuilder.js
    console.log('[ProgressionController] updateChordAndRenderPreservingTrebleNotes - placeholder');
}

// ============================================================================
// CHORD ADDITION FUNCTIONS
// ============================================================================

/**
 * Add a chord to the progression by parameters
 * @param {string} chordType - Chord type
 * @param {string} root - Root note
 * @param {number} inversion - Inversion (default 0)
 * @param {number} octaveShift - Octave shift (default 0)
 */
export function addChordToProgressionByParams(chordType, root, inversion = 0, octaveShift = 0) {
    // Save current state for undo (same mechanism as other progression edits)
    if (window.captureProgressionState && window.pushToUndoStack) {
        const currentState = window.captureProgressionState();
        pushToUndoStack(currentState);
    }

    const trainerState = getTrainerState();

    // Phase 2.1: Get insert position from section intent state
    const insertAfterIndex = getInsertAfterIndex();
    const sectionIntent = getSectionIntent();
    const usePositionBasedInsert = insertAfterIndex !== null &&
                                   insertAfterIndex >= 0 &&
                                   insertAfterIndex < trainerState.progressionData.length;

    // Get full chord information using getInvertedChordNotes
    const result = getInvertedChordNotes(
        root,
        chordType,
        inversion,
        trainerState.currentKey,
        octaveShift,
        getKeyBasedEnharmonic(),
        getNotationPreference()
    );

    // Calculate roman numeral for the chord
    const roman = noteToRomanNumeral(root, trainerState.currentKey, chordType) || '';

    // Generate default LH notes (default pattern: 'off' - no LH by default for recommendations)
    const defaultLHType = 'off';
    const defaultLHInversion = 0;
    const defaultLHRelativeShift = 0; // No shift from LH base octave (octave 2) by default
    const rhOctaveShift = octaveShift; // Use the provided octave shift
    const absoluteLHOctaveShift = rhOctaveShift + defaultLHRelativeShift;
    const lhNotes = getLHNotes(
        root,
        defaultLHType,
        defaultLHInversion,
        trainerState.currentKey,
        absoluteLHOctaveShift,
        chordType,
        getKeyBasedEnharmonic()
    );

    // Get default beats based on current time signature (one full measure)
    let defaultBeats = 4;
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (compositionState && compositionState.metadata && compositionState.metadata.timeSignature) {
        const ts = compositionState.metadata.timeSignature;
        const num = ts.num || 4;
        const denom = ts.denom || 4;
        defaultBeats = num * (4 / denom);
    }

    // Create complete chord data with all required properties
    const newChordData = {
        name: result.name,
        simpleName: result.simpleName,
        notes: result.specificNotes,
        root: root,
        type: chordType,
        inversion: inversion || 0,
        selectionMode: 'chord',
        omittedNotes: [],
        octaveShift: rhOctaveShift,
        lhType: defaultLHType,
        lhInversion: defaultLHInversion,
        lhOctaveShift: defaultLHRelativeShift,
        lhNotes: lhNotes,
        lhOmittedNotes: [],
        roman: roman,
        beats: defaultBeats
    };

    // === Stable add path: reuse addToProgressionData (same as Chord Builder) ===
    const currentProgression = getProgressionData();
    const originalLength = currentProgression.length;

    // Append using the canonical helper (handles compositionState + notation)
    if (window.addToProgressionData) {
        window.addToProgressionData(newChordData);
    } else {
        // Fallback: append and sync manually
        const appended = [...currentProgression, newChordData];
        setProgressionData(appended);
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('melody-progression-visualization', true);
            window.renderProgressionDisplay('melody-progression-visualization', false);
        }
    }

    // After append, compute actual indices
    const afterAppend = getProgressionData();
    const newLength = afterAppend.length;
    const appendedIndex = newLength - 1;

    // Track the final index where the chord ends up
    let insertedIndex = appendedIndex;

    // If we have a valid insert-after index, move the appended chord there
    if (usePositionBasedInsert && appendedIndex >= 0) {
        const targetIndex = insertAfterIndex + 1;
        if (targetIndex >= 0 && targetIndex < newLength && targetIndex !== appendedIndex) {
            const compositionState = window.getCompositionState ? window.getCompositionState() : null;
            if (compositionState && typeof compositionState.reorderChord === 'function') {
                compositionState.reorderChord(appendedIndex, targetIndex);

                const reordered = compositionState.exportToProgressionData();
                setProgressionData(reordered);
                if (window.renderProgressionDisplay) {
                    window.renderProgressionDisplay('melody-progression-visualization', true);
                    window.renderProgressionDisplay('melody-progression-visualization', false);
                }
            } else {
                // Pure JS fallback reorder if compositionState is unavailable
                const manual = [...afterAppend];
                const [moved] = manual.splice(appendedIndex, 1);
                manual.splice(targetIndex, 0, moved);
                setProgressionData(manual);
                if (window.renderProgressionDisplay) {
                    window.renderProgressionDisplay('melody-progression-visualization', true);
                    window.renderProgressionDisplay('melody-progression-visualization', false);
                }
            }
            // Update insertedIndex to reflect the actual position
            insertedIndex = targetIndex;
        }
    }

    // Phase 2.1: Handle section assignment based on intent
    let sectionWasModified = false;
    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState && sectionIntent) {
            try {
                if (sectionIntent.mode === INTENT_MODES.NEW_SECTION && sectionIntent.newSectionType) {
                    // Create a new section with this chord as the first chord
                    const newSection = compositionState.createSection(
                        sectionIntent.newSectionType,
                        [insertedIndex]
                    );
                    if (newSection) {
                        sectionWasModified = true;
                    }
                } else if (sectionIntent.mode === INTENT_MODES.CONTINUE && sectionIntent.targetSection) {
                    // Add the chord to the existing section
                    compositionState.addChordToSection(insertedIndex, sectionIntent.targetSection.id);
                    sectionWasModified = true;
                }
                // If ungrouped (no targetSection), leave the chord ungrouped
            } catch (e) {
                // Silently fail
            }
        }

        // Fallback: If no sectionIntent was set, check for wireframe sections with available slots
        if (!sectionIntent && compositionState && !sectionWasModified) {
            try {
                const allSections = compositionState.getSections?.() || [];

                // Find the first section with available slots
                const sectionWithSlot = allSections.find(section => {
                    const currentCount = section.chordIndices?.length || 0;
                    const expectedCount = section.expectedChordCount || 4;
                    return currentCount < expectedCount;
                });

                if (sectionWithSlot) {
                    compositionState.addChordToSection(insertedIndex, sectionWithSlot.id);
                    sectionWasModified = true;
                }
            } catch (e) {
                // Silently fail - chord will remain ungrouped
            }
        }
    }

    // Re-render display if a section was modified (to show section visuals)
    if (sectionWasModified && window.renderProgressionDisplay) {
        window.renderProgressionDisplay('melody-progression-visualization', true);
        window.renderProgressionDisplay('melody-progression-visualization', false);
    }

    // Update unified suggestions
    if (window.updateUnifiedSuggestions) {
        window.updateUnifiedSuggestions();
    }

    // Phase 2.2: Dispatch event for chord recommendations sidebar
    window.dispatchEvent(new CustomEvent('progressionUpdated', {
        detail: {
            progression: getProgressionData(), // Fixed: use current progression data
            key: trainerState.currentKey
        }
    }));

    // Dispatch event for guided lesson mode
    if (isGuidedModeActive()) {
        dispatchBuilderEvent('progressionChordAdded', {
            chord: `${root} ${chordType}`,
            root,
            type: chordType,
            inversion,
            position: insertedIndex,
            key: trainerState.currentKey
        });
    }

    // Phase 2.1: Select the newly inserted chord
    selectChordCard(insertedIndex);
}

/**
 * Add a chord directly to a specific section
 */
export function addChordToSection(sectionId) {
    // TODO: Extract implementation from progressionBuilder.js
    console.log('[ProgressionController] addChordToSection - placeholder');
}

/**
 * Add a chord to the progression data
 * Handles enharmonic respelling, borrowed chord detection, position-based insertion,
 * and multi-display rendering.
 *
 * @param {Object} chordData - Chord data to add (root, type, inversion, beats, notes, etc.)
 * @param {Object} options - Options object
 * @param {boolean} options.skipRender - Skip rendering if true (for batch operations)
 */
export function addToProgressionData(chordData, options = {}) {
    const trainerState = getTrainerState();

    // Auto-respell chord root to match key's enharmonic preference
    // BUT: Don't respell borrowed chords - they need their flat/sharp for theory identification
    if (chordData.root) {
        const keyPref = getKeyBasedEnharmonic();
        const originalRoot = chordData.root;

        // Check if the root note uses the opposite accidental type
        const rootHasSharp = originalRoot.includes('#');
        const rootHasFlat = originalRoot.includes('b');

        // Check if this is a borrowed chord (starts with ♭ or b like bVII, ♭VII, bVI, etc.)
        // Borrowed chords should keep their flat spelling for proper theory analysis
        // Calculate the proper roman numeral if not already set correctly
        let romanNumeral = chordData.romanNumeral || chordData.roman || '';

        // If roman is just the note name (e.g., "Bb" instead of "♭VII"), calculate properly
        if (!romanNumeral || romanNumeral === originalRoot || !romanNumeral.match(/^[♭♯b#]?[IViv]+/)) {
            const currentKey = getCurrentKey() || 'C';
            romanNumeral = noteToRomanNumeral(originalRoot, currentKey, chordData.type || 'Major') || '';
        }

        const isFlatBorrowedChord = romanNumeral.startsWith('♭') || romanNumeral.startsWith('b');
        const isSharpBorrowedChord = romanNumeral.startsWith('♯') || romanNumeral.startsWith('#');
        const isBorrowedChord = isFlatBorrowedChord || isSharpBorrowedChord;

        // For borrowed chords, ensure spelling matches the roman numeral:
        // - ♭VII should use Bb (flat), not A# (sharp)
        // - ♯IV should use F# (sharp), not Gb (flat)
        let shouldRespell = false;
        let targetSpelling = keyPref;

        if (isFlatBorrowedChord && rootHasSharp) {
            // Borrowed flat chord (like ♭VII) but root has sharp - respell to flat
            shouldRespell = true;
            targetSpelling = 'flat';
        } else if (isSharpBorrowedChord && rootHasFlat) {
            // Borrowed sharp chord (like ♯IV) but root has flat - respell to sharp
            shouldRespell = true;
            targetSpelling = 'sharp';
        } else if (!isBorrowedChord && ((keyPref === 'flat' && rootHasSharp) || (keyPref === 'sharp' && rootHasFlat))) {
            // Regular diatonic chord with wrong spelling for key
            shouldRespell = true;
        }

        if (shouldRespell) {
            // Need to respell - find the enharmonic equivalent
            const sharpIndex = SHARP_NOTES.indexOf(originalRoot);
            const flatIndex = FLAT_NOTES.indexOf(originalRoot);
            const noteIndex = sharpIndex !== -1 ? sharpIndex : flatIndex;

            if (noteIndex !== -1) {
                const newRoot = targetSpelling === 'flat' ? FLAT_NOTES[noteIndex] : SHARP_NOTES[noteIndex];

                // Only respell if the new root is different
                if (newRoot !== originalRoot) {
                    chordData.root = newRoot;

                    // Also update simpleName and name if they contain the old root
                    if (chordData.simpleName && chordData.simpleName.startsWith(originalRoot)) {
                        chordData.simpleName = newRoot + chordData.simpleName.slice(originalRoot.length);
                    }
                    if (chordData.name && chordData.name.startsWith(originalRoot)) {
                        chordData.name = newRoot + chordData.name.slice(originalRoot.length);
                    }

                    // Regenerate notes array using the new root
                    // This ensures proper note spelling (e.g., Bb-D-F instead of A#-C##-E#)
                    if (chordData.type) {
                        const currentKey = getCurrentKey() || 'C';
                        const inversion = chordData.inversion || 0;
                        const octaveShift = chordData.octaveShift || 0;

                        const result = getInvertedChordNotes(
                            newRoot,
                            chordData.type,
                            inversion,
                            currentKey,
                            octaveShift,
                            targetSpelling,
                            getNotationPreference()
                        );

                        if (result && result.specificNotes && result.specificNotes.length > 0) {
                            chordData.notes = result.specificNotes;
                            // Also update the name and simpleName from the result
                            if (result.name) chordData.name = result.name;
                            if (result.simpleName) chordData.simpleName = result.simpleName;
                        }
                    }

                    // Don't show toast for borrowed chord respelling (it's expected behavior)
                    // Only show for regular diatonic respelling
                    if (!isBorrowedChord && window.showToast) {
                        window.showToast(`Respelled ${originalRoot} as ${newRoot} to match key of ${getCurrentKey()}`, 'info', 3000);
                    }
                }
            }
        }

        // Update the roman numeral in chord data if we calculated it
        if (romanNumeral && romanNumeral !== chordData.roman && romanNumeral !== chordData.romanNumeral) {
            chordData.roman = romanNumeral;
        }
    }

    // If beats not provided, default to one full measure based on current time signature
    if (chordData.beats === undefined) {
        let defaultBeats = 4;
        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        if (compositionState && compositionState.metadata && compositionState.metadata.timeSignature) {
            const ts = compositionState.metadata.timeSignature;
            // Normalize to quarter-note beats: num * (4 / denom)
            // e.g., 4/4 = 4 beats, 3/4 = 3 beats, 6/8 = 3 beats (6 eighth notes = 3 quarter notes)
            const num = ts.num || 4;
            const denom = ts.denom || 4;
            defaultBeats = num * (4 / denom);
        }
        chordData.beats = defaultBeats;
    }

    // Save state before adding (only on first chord of batch to avoid multiple undo states)
    if (!options.skipRender) {
        saveStateBeforeChange();
    }

    // Phase 2.1: Check for position-based insertion
    const insertAfterIndex = getInsertAfterIndex();
    const usePositionBasedInsert = insertAfterIndex !== null &&
                                   insertAfterIndex >= 0 &&
                                   insertAfterIndex < trainerState.progressionData.length;

    if (usePositionBasedInsert) {
        // Insert after the selected chord
        const targetIndex = insertAfterIndex + 1;
        trainerState.progressionData.splice(targetIndex, 0, chordData);

        // Update compositionState if available to keep it in sync
        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        if (compositionState && typeof compositionState.insertChordAt === 'function') {
            // If compositionState has an insertChordAt method, use it
            // Otherwise the sync will happen via setProgressionData
        }
    } else {
        // Default: append to end
        trainerState.progressionData.push(chordData);
    }

    if (chordData.roman && !trainerState.progressionRomans.includes(chordData.roman)) {
        trainerState.progressionRomans.push(chordData.roman);
    }
    setProgressionData(trainerState.progressionData);

    // Mark progression as ready when chords are added (fixes Chord Lab playback)
    setIsReady(true);

    // Dispatch event for guided lesson mode
    if (isGuidedModeActive()) {
        dispatchBuilderEvent('progressionChordAdded', {
            chord: `${chordData.root} ${chordData.type}`,
            root: chordData.root,
            type: chordData.type,
            inversion: chordData.inversion,
            position: trainerState.progressionData.length - 1,
            key: trainerState.currentKey
        });
    }

    // Dispatch event for Theory Moments (teaching integration)
    const chordIndex = trainerState.progressionData.length - 1;
    console.log('[addToProgressionData] Dispatching chordAddedForTheory event:', {
        chord: chordData.root + ' ' + chordData.type,
        roman: chordData.roman,
        index: chordIndex,
        key: trainerState.currentKey
    });
    window.dispatchEvent(new CustomEvent('chordAddedForTheory', {
        detail: {
            chord: chordData,
            index: chordIndex,
            key: trainerState.currentKey,
            progression: trainerState.progressionData
        }
    }));

    // Skip all rendering if in batch mode
    if (options.skipRender) {
        return;
    }

    // Save scroll position to prevent jumping when notation refreshes
    // Save both window scroll and any scrollable container scroll positions
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    const canvasContainer = document.getElementById('interactive-melody-notation-canvas')?.parentElement;
    const containerScrollTop = canvasContainer ? canvasContainer.scrollTop : 0;
    const containerScrollLeft = canvasContainer ? canvasContainer.scrollLeft : 0;

    // Render both progression displays to keep them in sync
    // TODO: Import renderProgressionDisplay from ProgressionRenderer once all modules extracted
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('melody-progression-visualization', true);
        window.renderProgressionDisplay('melody-progression-visualization', false);
    }

    // Also update the Chord Lab/Builder panel if it exists
    if (window.updateBuilderProgressionPanel) {
        window.updateBuilderProgressionPanel();
    }

    // Auto-render melody notation if on Composition Studio tab or if Free mode is active
    // This function already checks the tab and only refreshes if needed
    // Pass preventScroll=true to prevent page from jumping to notation
    if (window.renderMelodyNotationIfNeeded) {
        window.renderMelodyNotationIfNeeded(true);
    }

    // Restore scroll position multiple times to catch any delayed scrolling
    // This prevents the page from jumping when notation refreshes on any tab
    const restoreScroll = () => {
        // Prevent any element from getting focus that might cause scrolling
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'CANVAS' || activeElement.id?.includes('canvas'))) {
            // Blur canvas if it got focused (which would cause scroll)
            activeElement.blur();
        }

        window.scrollTo(scrollX, scrollY);
        if (canvasContainer) {
            canvasContainer.scrollTop = containerScrollTop;
            canvasContainer.scrollLeft = containerScrollLeft;
        }
    };

    // Restore immediately and after rendering delays
    restoreScroll();
    requestAnimationFrame(() => {
        restoreScroll();
        requestAnimationFrame(() => {
            restoreScroll();
            // Multiple restores to catch any delayed scrolls from async rendering
            setTimeout(restoreScroll, 50);
            setTimeout(restoreScroll, 100);
            setTimeout(restoreScroll, 200);
            setTimeout(restoreScroll, 300);
        });
    });
}

// ============================================================================
// CHORD REMOVAL FUNCTIONS
// ============================================================================

/**
 * Remove a chord from the progression
 * @param {number} index - Index of chord to remove
 */
export function removeChordFromProgression(index) {
    const trainerState = getTrainerState();

    if (trainerState.isPlaying && window.handleAutoPlayback) {
        window.handleAutoPlayback();
    }

    // Save state before removing
    if (window.saveStateBeforeChange) {
        window.saveStateBeforeChange();
    }

    // IMPORTANT: progressionData is now delegated to compositionState
    // Use compositionState.removeChord() which properly syncs edits before removing
    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        // removeChord() handles syncMeasuresToBuildingBlocks internally to preserve edits
        compositionState.removeChord(index);
    } else {
        // Fallback for legacy code
        trainerState.progressionData.splice(index, 1);
    }

    // Still update Romans (this is in trainerState, not compositionState)
    trainerState.progressionRomans.splice(index, 1);

    // Handle selection state after deletion
    const selectedIndex = getSelectedChordIndex();
    const progressionLength = trainerState.progressionData.length;

    if (progressionLength === 0) {
        // No chords left, reset selection
        setSelectedChordIndex(0);
    } else if (index === selectedIndex) {
        // Deleted the selected chord - move selection to next chord (or first if this was last)
        if (index < progressionLength) {
            // Stay at same index (which is now the next chord)
            setSelectedChordIndex(index);
        } else {
            // Deleted the last chord, select the new last chord
            setSelectedChordIndex(progressionLength - 1);
        }
    } else if (index < selectedIndex) {
        // Deleted a chord before the selected one - decrement selected index
        setSelectedChordIndex(selectedIndex - 1);
    }
    // else: deleted a chord after the selected one - selected index stays the same

    // Re-render both tabs to ensure synchronization
    if (window.renderProgressionDisplay) {
        // First render the main progression builder
        window.renderProgressionDisplay('melody-progression-visualization', true);
        // Then render the melody composer tab (syncBothTabs=false to avoid infinite recursion)
        window.renderProgressionDisplay('melody-progression-visualization', false);
    }

    // Auto-render melody notation if on Composition Studio tab or if Free mode is active
    if (window.renderMelodyNotationIfNeeded) {
        window.renderMelodyNotationIfNeeded();
    }

    // Phase 2.2: Dispatch event for chord recommendations sidebar
    window.dispatchEvent(new CustomEvent('progressionUpdated', {
        detail: {
            progression: trainerState.progressionData,
            key: trainerState.currentKey
        }
    }));

    // Refresh notation to reflect the deleted chord
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }

    // Dispatch event for tutorial system
    if (window.dispatchBuilderEvent) {
        window.dispatchBuilderEvent('chordDeleted', {
            deletedIndex: index,
            remainingChords: progressionLength
        });
    }
}

/**
 * Delete selected chords with confirmation
 * @param {number[]} indices - Array of chord indices to delete
 */
export function deleteSelectedChords(indices) {
    if (indices.length === 0) return;

    // Confirm if deleting multiple
    if (indices.length > 1) {
        if (!confirm(`Delete ${indices.length} selected chords?`)) {
            return;
        }
    }

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    // Save state for undo before making changes
    if (window.saveStateBeforeChange) {
        window.saveStateBeforeChange();
    }

    // Delete in reverse order to preserve indices
    const sortedIndices = [...indices].sort((a, b) => b - a);
    sortedIndices.forEach(idx => {
        compositionState.removeChord(idx);
    });

    // Clear selection
    clearMultiSelection();

    // Re-render
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('melody-progression-visualization', true);
        window.renderProgressionDisplay('melody-progression-visualization', false);
    }
}

/**
 * Clear all chords from the progression
 * Shows confirmation dialog if progression has chords (unless skipConfirmation is true)
 * @param {boolean} skipConfirmation - If true, skip the confirmation dialog
 */
export function clearProgression(skipConfirmation = false) {
    console.log('[clearProgression] Called with skipConfirmation:', skipConfirmation);
    const trainerState = getTrainerState();
    const progressionData = getProgressionData();
    console.log('[clearProgression] Current chord count:', progressionData?.length || 0);

    // If there are chords, ask for confirmation (unless skipped)
    if (!skipConfirmation && progressionData && progressionData.length > 0) {
        const chordCount = progressionData.length;
        const message = chordCount === 1
            ? 'Are you sure you want to clear the progression? This will remove 1 chord.'
            : `Are you sure you want to clear the progression? This will remove ${chordCount} chords.`;

        if (!confirm(message)) {
            return; // User cancelled
        }
    }

    // Save state for undo before clearing
    if (window.saveStateBeforeChange) {
        window.saveStateBeforeChange();
    }

    // Stop any active playback
    if (trainerState.isPlaying && window.handleAutoPlayback) {
        window.handleAutoPlayback();
    }

    // Stop any step chord playback
    if (window.stopStepChord) {
        window.stopStepChord();
    }

    // Clear progression data
    setProgressionData([]);
    setProgressionRomans([]);
    setCurrentIndex(0);
    setIsReady(false);
    console.log('[clearProgression] After clear, chord count:', getProgressionData()?.length || 0);

    // Clear highlights
    if (window.clearHighlights) {
        window.clearHighlights();
    }

    // Clear card highlights
    document.querySelectorAll('.active-progression-card').forEach(card => {
        card.classList.remove('active-progression-card');
    });

    // Re-render the display
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('melody-progression-visualization', true);
        window.renderProgressionDisplay('melody-progression-visualization', false);
    }

    // Update UI
    if (window.updateProgressionControlsUI) {
        window.updateProgressionControlsUI();
    }

    // Re-render melody notation canvas
    if (window.renderMelodyNotationIfNeeded) {
        window.renderMelodyNotationIfNeeded();
    }

    // Phase 2.2: Dispatch event for chord recommendations sidebar
    window.dispatchEvent(new CustomEvent('progressionUpdated', {
        detail: {
            progression: [],
            key: trainerState.currentKey
        }
    }));

    // Sync cleared progression to compositionState, then refresh notation
    if (window.syncProgressionToMelodyComposer) {
        window.syncProgressionToMelodyComposer();
    }
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }

    // Update Voice Leading and Theory Insights panels to reflect empty progression
    if (window.voiceLeadingDiagram && window.voiceLeadingDiagram.update) {
        window.voiceLeadingDiagram.update();
    }
    if (window.theoryInsightsPanel && window.theoryInsightsPanel.update) {
        window.theoryInsightsPanel.update();
    }
}

// ============================================================================
// CHORD NOTE MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Toggle a note in the progression chord voicing
 * @param {number} chordIndex - Index of chord
 * @param {string} note - Note to toggle
 */
export function toggleProgressionNote(chordIndex, note) {
    // Get compositionState directly - the single source of truth
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) {
        return;
    }

    const trainerState = getTrainerState();
    const chordData = compositionState.getChord(chordIndex);
    if (!chordData) return;

    // Save state before toggling
    if (window.saveStateBeforeChange) {
        window.saveStateBeforeChange();
    }

    // Ensure omittedNotes array exists
    const omittedNotes = chordData.omittedNotes || [];

    const noteOmitIndex = omittedNotes.indexOf(note);
    if (noteOmitIndex > -1) {
        omittedNotes.splice(noteOmitIndex, 1); // Note was omitted, so un-omit it
    } else {
        omittedNotes.push(note); // Note was played, so omit it
    }

    // Update chord in compositionState
    compositionState.updateChordByIndex(chordIndex, {
        omittedNotes: omittedNotes
    });

    // Get updated chord for playback
    const updatedChord = compositionState.getChord(chordIndex);

    if (!updatedChord) {
        return;
    }

    // Play chord with duration after voicing change
    const voicedNotes = (updatedChord.notes || []).filter(n => !(updatedChord.omittedNotes || []).includes(n));
    const lhNotes = window.getLHNotes ? window.getLHNotes(
        updatedChord.root,
        updatedChord.lhType,
        updatedChord.lhInversion,
        trainerState.currentKey,
        updatedChord.lhOctaveShift,
        updatedChord.type,
        getKeyBasedEnharmonic()
    ).filter(n => !(updatedChord.lhOmittedNotes || []).includes(n)) : [];
    const allNotes = voicedNotes.concat(lhNotes);

    if (allNotes.length > 0 && window.playTrainerChordOnce) {
        window.playTrainerChordOnce(allNotes);
    }

    // Update the chord notation canvas in the detailed card AND bass clef
    if (window.refreshChordNotationCanvas) {
        window.refreshChordNotationCanvas(chordIndex, updatedChord);
    }

    // Sync progressionData changes to notation display
    if (window.updateChordAndRenderPreservingTrebleNotes) {
        window.updateChordAndRenderPreservingTrebleNotes(chordIndex);
    }
}

/**
 * Toggle a note in the progression LH voicing
 * @param {number} chordIndex - Index of chord
 * @param {string} note - Note to toggle
 */
export function toggleProgressionLHNote(chordIndex, note) {
    const trainerState = getTrainerState();
    const chordData = trainerState.progressionData[chordIndex];
    if (!chordData) return;

    // Save state before toggling
    if (window.saveStateBeforeChange) {
        window.saveStateBeforeChange();
    }

    if (!chordData.lhOmittedNotes) {
        chordData.lhOmittedNotes = [];
    }

    const noteOmitIndex = chordData.lhOmittedNotes.indexOf(note);
    if (noteOmitIndex > -1) {
        chordData.lhOmittedNotes.splice(noteOmitIndex, 1);
    } else {
        chordData.lhOmittedNotes.push(note);
    }

    // Skip ALL re-rendering to avoid blinking - checkbox state is already correct in DOM
    // The UI will update when user makes other changes (type, inversion, etc.)

    // Play chord with duration after LH voicing change
    const voicedNotes = chordData.notes.filter(n => !(chordData.omittedNotes || []).includes(n));
    const lhNotes = window.getLHNotes ? window.getLHNotes(
        chordData.root,
        chordData.lhType,
        chordData.lhInversion,
        trainerState.currentKey,
        chordData.lhOctaveShift,
        chordData.type,
        getKeyBasedEnharmonic()
    ).filter(n => !chordData.lhOmittedNotes.includes(n)) : [];
    const allNotes = voicedNotes.concat(lhNotes);
    if (allNotes.length > 0 && window.playTrainerChordOnce) {
        window.playTrainerChordOnce(allNotes);
    }

    // Update the chord notation canvas in the detailed card AND bass clef
    if (window.refreshChordNotationCanvas) {
        window.refreshChordNotationCanvas(chordIndex, chordData);
    }

    // Sync progressionData changes to notation display
    if (window.updateChordAndRenderPreservingTrebleNotes) {
        window.updateChordAndRenderPreservingTrebleNotes(chordIndex);
    }
}

/**
 * Toggle staff notation visibility
 */
export function toggleProgressionNotation(chordIndex, sourceContainerId) {
    // TODO: Extract implementation from progressionBuilder.js
    console.log('[ProgressionController] toggleProgressionNotation - placeholder');
}

// ============================================================================
// CHORD SELECTION FUNCTIONS
// ============================================================================

/**
 * Select a chord card (single selection)
 */
/**
 * Select a chord card and update UI state
 * @param {number} index - Chord index
 */
export function selectChordCard(index) {
    // Save selection to state and also update currentIndex to keep them in sync
    setSelectedChordIndex(index);
    setCurrentIndex(index);

    // CRITICAL: Also update multi-select state so getSelectedIndicesArray() returns correct data
    // This is needed for sectionIntentUI to properly track insert position
    clearSelection();
    selectSingle(index);

    // First remove all existing selections (visual)
    deselectAllChordCards();

    // Select the specified card in both containers
    const wrappers = document.querySelectorAll(`.chord-card-wrapper[data-chord-index="${index}"]`);
    wrappers.forEach(wrapper => {
        const card = wrapper.querySelector('.simplified-card, .detailed-card');
        if (card) {
            card.classList.add('ring-4', 'ring-purple-500', 'ring-offset-2');
            card.setAttribute('data-selected', 'true');
        }
    });

    // Ensure shifts are maintained after selection
    if (window.updateCardShifts) {
        window.updateCardShifts();
    }

    // Bi-directional sync: highlight tension curve point when chord card is selected
    if (window.unhighlightAllTensionPoints) {
        window.unhighlightAllTensionPoints();
    }
    if (window.highlightTensionPointForSelection) {
        window.highlightTensionPointForSelection(index);
    }

    // Sync measure selection with chord card selection (legacy system)
    if (window.setSelectedMeasureIndex) {
        window.setSelectedMeasureIndex(index);
    }

    // Fire event for new notation system bi-directional sync
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chordCardSelected', {
            detail: { index }
        }));
    }
}

/**
 * Remove selection from all chord cards
 */
export function deselectAllChordCards() {
    const allCards = document.querySelectorAll('.simplified-card[data-selected="true"], .detailed-card[data-selected="true"]');
    allCards.forEach(card => {
        card.classList.remove('ring-4', 'ring-purple-500', 'ring-offset-2');
        card.removeAttribute('data-selected');
    });
    // Also clear multi-select visual styling
    const allWrappers = document.querySelectorAll('.chord-card-wrapper.multi-selected');
    allWrappers.forEach(wrapper => {
        wrapper.classList.remove('multi-selected');
    });
}

/**
 * Highlight a chord card
 * @param {number} index - Chord index
 */
export function highlightChordCard(index) {
    // First remove all existing highlights
    unhighlightAllChordCards();

    // Highlight the specified card in both containers
    const wrappers = document.querySelectorAll(`.chord-card-wrapper[data-chord-index="${index}"]`);
    wrappers.forEach(wrapper => {
        const card = wrapper.querySelector('.simplified-card, .detailed-card');
        if (card) {
            card.classList.add('ring-4', 'ring-blue-400', 'ring-offset-2');
            card.setAttribute('data-highlighted', 'true');
        }
    });

    // Ensure shifts are maintained after highlighting (in case highlighting triggered any layout changes)
    if (window.updateCardShifts) {
        window.updateCardShifts();
    }
}

/**
 * Remove highlights from all chord cards
 */
export function unhighlightAllChordCards() {
    const allCards = document.querySelectorAll('.simplified-card[data-highlighted="true"], .detailed-card[data-highlighted="true"]');
    allCards.forEach(card => {
        // Remove blue highlight color
        card.classList.remove('ring-blue-400');
        card.removeAttribute('data-highlighted');

        // Only remove ring-4 and ring-offset-2 if card is NOT selected
        // (selected cards need these classes for their purple ring)
        if (!card.hasAttribute('data-selected')) {
            card.classList.remove('ring-4', 'ring-offset-2');
        } else {
            // Card is selected, ensure purple ring color is applied
            card.classList.add('ring-purple-500');
        }
    });
}

/**
 * Expand a chord card
 * @param {number} index - Chord index
 * Delegates to old module implementation via window
 */
export function expandChordCard(index) {
    // Use old module implementation (complex function with many dependencies)
    if (window.expandChordCardOld) {
        window.expandChordCardOld(index);
    }
}

/**
 * Collapse a chord card
 */
export function collapseChordCard(index) {
    // TODO: Extract implementation from progressionBuilder.js
    console.log('[ProgressionController] collapseChordCard - placeholder');
}

/**
 * Collapse all chord cards
 * Delegates to old module implementation via window
 */
export function collapseAllChordCards() {
    // Use old module implementation
    if (window.collapseAllChordCardsOld) {
        window.collapseAllChordCardsOld();
    }
}

// ============================================================================
// MULTI-SELECT FUNCTIONS
// ============================================================================

/**
 * Handle Ctrl/Cmd+click to toggle a card in multi-selection
 */
export function handleMultiSelectToggle(index) {
    toggleSelection(index);
    // TODO: Extract remaining implementation
    console.log('[ProgressionController] handleMultiSelectToggle - partial implementation');
}

/**
 * Handle Shift+click to range-select
 */
export function handleMultiSelectRange(index) {
    const lastIndex = getLastSelectedIndex();
    if (lastIndex === null) {
        selectSingle(index);
    } else {
        selectRange(lastIndex, index);
    }
    // TODO: Extract remaining implementation
    console.log('[ProgressionController] handleMultiSelectRange - partial implementation');
}

/**
 * Update visual styles for all cards based on multi-select state
 */
export function updateMultiSelectVisuals() {
    const selectedIndices = getSelectedIndicesArray();

    // First, clear all multi-select visuals
    const allWrappers = document.querySelectorAll('.chord-card-wrapper');
    allWrappers.forEach(wrapper => {
        wrapper.classList.remove('multi-selected');
        const card = wrapper.querySelector('.simplified-card, .detailed-card');
        if (card) {
            card.classList.remove('ring-4', 'ring-purple-500', 'ring-offset-2', 'ring-blue-500');
            card.removeAttribute('data-selected');
        }
    });

    // Apply multi-select styling to selected cards
    selectedIndices.forEach((idx, i) => {
        const wrappers = document.querySelectorAll(`.chord-card-wrapper[data-chord-index="${idx}"]`);
        wrappers.forEach(wrapper => {
            wrapper.classList.add('multi-selected');
            const card = wrapper.querySelector('.simplified-card, .detailed-card');
            if (card) {
                card.setAttribute('data-selected', 'true');
                // First selected gets purple ring, others get blue
                if (i === 0) {
                    card.classList.add('ring-4', 'ring-purple-500', 'ring-offset-2');
                } else {
                    card.classList.add('ring-4', 'ring-blue-500', 'ring-offset-2');
                }
            }
        });
    });

    // Update bass selection UI when selection changes
    // Use setTimeout to ensure this runs after DOM updates
    setTimeout(() => {
        if (typeof updateBassSelectionUI === 'function') {
            updateBassSelectionUI();
        }
    }, 0);
}

/**
 * Clear multi-selection and update visuals
 */
export function clearMultiSelection() {
    clearSelection();
    updateMultiSelectVisuals();
}

/**
 * Update the bass selection UI based on current chord selection
 * Shows/hides the "Apply to Selected" controls and selection count
 * Delegates to old module implementation via window
 */
export function updateBassSelectionUI() {
    // Use old module implementation
    if (window.updateBassSelectionUIOld) {
        window.updateBassSelectionUIOld();
    }
}

/**
 * Update the info display showing which chords have custom bass patterns
 * Delegates to old module implementation via window
 */
export function updateCustomBassPatternInfo() {
    // Use old module implementation
    if (window.updateCustomBassPatternInfoOld) {
        window.updateCustomBassPatternInfoOld();
    }
}

// ============================================================================
// COPY/PASTE/DUPLICATE FUNCTIONS
// ============================================================================

/**
 * Copy selected chords to clipboard
 */
export function copySelectedChords(indices) {
    if (indices.length === 0) return;

    const trainerState = getTrainerState();
    const progressionData = trainerState.progressionData || [];

    const chordsToCopy = indices
        .filter(idx => idx < progressionData.length)
        .sort((a, b) => a - b)
        .map(idx => ({ ...progressionData[idx] }));

    if (chordsToCopy.length > 0) {
        setClipboard({ type: 'chords', data: chordsToCopy });
    }
}

/**
 * Paste chords from clipboard at insertion point
 */
export function pasteChords() {
    const clipboard = getClipboard();
    if (!clipboard || clipboard.type !== 'chords' || !clipboard.data?.length) {
        return;
    }

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    // Save state for undo before making changes
    if (window.saveStateBeforeChange) {
        window.saveStateBeforeChange();
    }

    const trainerState = getTrainerState();
    const progressionData = trainerState.progressionData || [];

    // Find insertion point (after last selected, or at end)
    const selectedIndices = getSelectedIndicesArray();
    let insertAt = progressionData.length;
    if (selectedIndices.length > 0) {
        insertAt = Math.max(...selectedIndices) + 1;
    }

    // Insert each chord
    clipboard.data.forEach((chord, i) => {
        const newChord = { ...chord };
        compositionState.insertChord(insertAt + i, newChord);
    });

    // Clear selection and select pasted chords
    clearSelection();
    for (let i = 0; i < clipboard.data.length; i++) {
        addToSelection(insertAt + i);
    }

    // Re-render
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('melody-progression-visualization', true);
        window.renderProgressionDisplay('melody-progression-visualization', false);
    }

    updateMultiSelectVisuals();
}

/**
 * Duplicate selected chords (insert copies after the selection)
 * @param {number[]} indices - Array of chord indices to duplicate
 */
export function duplicateSelectedChords(indices) {
    if (indices.length === 0) return;

    const trainerState = getTrainerState();
    const progressionData = trainerState.progressionData || [];
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    // Save state for undo before making changes
    if (window.saveStateBeforeChange) {
        window.saveStateBeforeChange();
    }

    // Get chord data for selected indices
    const chordsToDuplicate = indices
        .filter(idx => idx < progressionData.length)
        .sort((a, b) => a - b)
        .map(idx => ({ ...progressionData[idx] }));

    if (chordsToDuplicate.length === 0) return;

    // Insert after the last selected chord
    const insertAt = Math.max(...indices) + 1;

    // Insert each chord
    chordsToDuplicate.forEach((chord, i) => {
        compositionState.insertChord(insertAt + i, { ...chord });
    });

    // Clear selection and select duplicated chords
    clearSelection();
    for (let i = 0; i < chordsToDuplicate.length; i++) {
        addToSelection(insertAt + i);
    }

    // Re-render
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('melody-progression-visualization', true);
        window.renderProgressionDisplay('melody-progression-visualization', false);
    }

    updateMultiSelectVisuals();
}

// ============================================================================
// DATA LOADING/SAVING FUNCTIONS
// ============================================================================

/**
 * Load progression from dropdown selections
 * Delegates to old module implementation via window
 */
export function loadProgression(...args) {
    // Use old module implementation
    if (window.loadProgressionOld) {
        return window.loadProgressionOld(...args);
    }
}

/**
 * Update enharmonic spellings for all chords in the progression
 * Delegates to old module implementation via window
 */
export function updateProgressionEnharmonics(...args) {
    // Use old module implementation
    if (window.updateProgressionEnharmonicsOld) {
        return window.updateProgressionEnharmonicsOld(...args);
    }
}

/**
 * Get chord notes for a progression chord
 * @param {string} key - Key signature
 * @param {string} romanNumeral - Roman numeral
 * @param {string} selectedType - Chord type
 * @param {number} selectedInversion - Inversion
 * @param {number} octaveShift - Octave shift (default 0)
 * Delegates to old module implementation via window
 */
export function getProgressionChordNotes(key, romanNumeral, selectedType, selectedInversion, octaveShift = 0) {
    // Use old module implementation
    if (window.getProgressionChordNotesOld) {
        return window.getProgressionChordNotesOld(key, romanNumeral, selectedType, selectedInversion, octaveShift);
    }
    return null;
}

// ============================================================================
// KEY & TRANSPOSITION FUNCTIONS
// ============================================================================

/**
 * Set the key dropdown value
 * @param {string} targetKey - Target key
 * @param {boolean} triggerLoad - Whether to trigger load (default false)
 * Delegates to old module implementation via window
 */
export function setKeyDropdownValue(targetKey, triggerLoad = false) {
    // Use old module implementation
    if (window.setKeyDropdownValueOld) {
        window.setKeyDropdownValueOld(targetKey, triggerLoad);
    }
}

/**
 * Transpose all chords in the progression to a new key
 * @param {string} oldKey - Old key
 * @param {string} newKey - New key
 * Delegates to old module implementation via window
 */
export function transposeProgression(oldKey, newKey) {
    // Use old module implementation
    if (window.transposeProgressionOld) {
        window.transposeProgressionOld(oldKey, newKey);
    }
}

/**
 * Update Roman numerals for all chords to reflect a new key
 * @param {string} newKey - New key
 * Delegates to old module implementation via window
 */
export function updateRomanNumerals(newKey) {
    // Use old module implementation
    if (window.updateRomanNumeralsOld) {
        window.updateRomanNumeralsOld(newKey);
    }
}

/**
 * Transpose all treble clef notes by the interval between two keys
 */
export function transposeTreble(oldKey, newKey) {
    // TODO: Extract implementation from progressionBuilder.js
    console.log('[ProgressionController] transposeTreble - placeholder');
}

/**
 * Transpose treble notes AND adjust for mode change
 */
export function transposeTrebleWithModeAdjust(oldKey, newKey) {
    // TODO: Extract implementation from progressionBuilder.js
    console.log('[ProgressionController] transposeTrebleWithModeAdjust - placeholder');
}

// ============================================================================
// RECORDING FUNCTIONS
// ============================================================================

/**
 * Toggle recording mode
 * Delegates to old module implementation via window
 */
export function toggleRecording() {
    // Use old module implementation
    if (window.toggleRecordingOld) {
        window.toggleRecordingOld();
    }
}

/**
 * Save the recorded progression
 * Delegates to old module implementation via window
 */
export function saveRecording() {
    // Use old module implementation
    if (window.saveRecordingOld) {
        window.saveRecordingOld();
    }
}

// ============================================================================
// HISTORY & UNDO/REDO FUNCTIONS
// ============================================================================

/**
 * Capture progression state snapshot
 */
function captureProgressionState() {
    const trainerState = getTrainerState();
    const state = {
        progressionData: JSON.parse(JSON.stringify(trainerState.progressionData)),
        progressionRomans: [...trainerState.progressionRomans],
        currentKey: trainerState.currentKey
    };

    // Capture notation state from CompositionState
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (compositionState) {
        if (compositionState.measures) {
            state.notationData = JSON.parse(JSON.stringify(compositionState.measures));
        }
        if (compositionState.metadata?.timeSignature) {
            state.timeSignature = { ...compositionState.metadata.timeSignature };
        }
        if (compositionState.trebleBlockSequence) {
            try {
                state.trebleBlockSequence = compositionState.trebleBlockSequence.toJSON();
            } catch (e) {
                console.warn('[captureProgressionState] Failed to serialize trebleBlockSequence:', e);
            }
        }
        if (compositionState.bassBlockSequence) {
            try {
                state.bassBlockSequence = compositionState.bassBlockSequence.toJSON();
            } catch (e) {
                console.warn('[captureProgressionState] Failed to serialize bassBlockSequence:', e);
            }
        }
        if (compositionState.chordSegments) {
            state.chordSegments = JSON.parse(JSON.stringify(compositionState.chordSegments));
        }
        if (compositionState.metadata) {
            state.metadata = JSON.parse(JSON.stringify(compositionState.metadata));
        }
    }

    return state;
}

/**
 * Restore a progression state snapshot
 */
function restoreProgressionState(state) {
    if (!state) return;

    setProgressionData(state.progressionData);
    setProgressionRomans(state.progressionRomans);
    setCurrentKey(state.currentKey);

    // Restore notation state
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (compositionState) {
        if (state.notationData) {
            compositionState.measures = JSON.parse(JSON.stringify(state.notationData));
        }
        if (state.timeSignature) {
            compositionState.metadata.timeSignature = { ...state.timeSignature };
        }
        if (state.trebleBlockSequence) {
            try {
                compositionState.trebleBlockSequence = BuildingBlockSequence.fromJSON(state.trebleBlockSequence);
            } catch (e) {
                console.warn('[restoreProgressionState] Failed to restore trebleBlockSequence:', e);
            }
        }
        if (state.bassBlockSequence) {
            try {
                compositionState.bassBlockSequence = BuildingBlockSequence.fromJSON(state.bassBlockSequence);
            } catch (e) {
                console.warn('[restoreProgressionState] Failed to restore bassBlockSequence:', e);
            }
        }
        if (state.chordSegments) {
            compositionState.chordSegments = JSON.parse(JSON.stringify(state.chordSegments));
        }
        compositionState.events.emit('loaded', { measures: compositionState.measures });
    }

    // TODO: Extract remaining implementation
}

/**
 * Handle undo action
 * Delegates to old module implementation via window
 */
export function handleUndo() {
    // Use old module implementation
    if (window.handleUndoOld) {
        window.handleUndoOld();
    }
}

/**
 * Handle redo action
 * Delegates to old module implementation via window
 */
export function handleRedo() {
    // Use old module implementation
    if (window.handleRedoOld) {
        window.handleRedoOld();
    }
}

/**
 * Save current state before making changes
 * Delegates to old module implementation via window
 */
export function saveStateBeforeChange() {
    // Use old module implementation
    if (window.saveStateBeforeChangeOld) {
        window.saveStateBeforeChangeOld();
    }
}

// ============================================================================
// PANEL TOGGLE FUNCTIONS
// ============================================================================

/**
 * Toggle progression controls panel
 */
export function toggleProgressionControlsPanel() {
    if (isGuidedModeActive()) return;

    const panel = document.getElementById('progression-controls-panel');
    const chevron = document.getElementById('progression-controls-chevron');
    if (!panel || !chevron) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }

    if (window.savePanelState) {
        window.savePanelState('progression-controls-panel', !isHidden);
    }
}

/**
 * Toggle progression cards panel
 */
export function toggleProgressionCardsPanel() {
    if (isGuidedModeActive()) return;

    const panel = document.getElementById('progression-visualization-panel');
    const chevron = document.getElementById('progression-visualization-chevron');
    if (!panel || !chevron) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }

    if (window.savePanelState) {
        window.savePanelState('progression-visualization-panel', !isHidden);
    }
}

// ============================================================================
// ANALYSIS VIEW TOGGLES
// ============================================================================

/**
 * Module-level state for analysis view visibility
 */
let simplifiedViewVisible = true;
let tensionCurveVisible = true;

/**
 * Toggle simplified chord sequence view visibility
 */
export function toggleSimplifiedView() {
    simplifiedViewVisible = !simplifiedViewVisible;

    const container = document.getElementById('simplified-chord-sequence');
    const btn = document.getElementById('toggle-simplified-view-btn');

    if (container) {
        if (simplifiedViewVisible) {
            container.style.display = '';
            if (btn) {
                btn.classList.remove('opacity-50');
                btn.classList.add('bg-purple-100', 'hover:bg-purple-200', 'border-purple-300', 'text-purple-700');
                btn.classList.remove('bg-gray-200', 'border-gray-300', 'text-gray-500');
            }
        } else {
            container.style.display = 'none';
            if (btn) {
                btn.classList.add('opacity-50');
                btn.classList.remove('bg-purple-100', 'hover:bg-purple-200', 'border-purple-300', 'text-purple-700');
                btn.classList.add('bg-gray-200', 'border-gray-300', 'text-gray-500');
            }
        }
    }
}

/**
 * Toggle tension curve visualization visibility
 */
export function toggleTensionCurve() {
    tensionCurveVisible = !tensionCurveVisible;

    const container = document.getElementById('tension-arc-container') || document.getElementById('tension-curve-container');
    const btn = document.getElementById('toggle-tension-curve-btn');

    if (container) {
        if (tensionCurveVisible) {
            container.style.display = '';
            if (btn) {
                btn.classList.remove('opacity-50');
                btn.classList.add('bg-blue-100', 'hover:bg-blue-200', 'border-blue-300', 'text-blue-700');
                btn.classList.remove('bg-gray-200', 'border-gray-300', 'text-gray-500');
            }
        } else {
            container.style.display = 'none';
            if (btn) {
                btn.classList.add('opacity-50');
                btn.classList.remove('bg-blue-100', 'hover:bg-blue-200', 'border-blue-300', 'text-blue-700');
                btn.classList.add('bg-gray-200', 'border-gray-300', 'text-gray-500');
            }
        }
    }
}

/**
 * Get visibility state for analysis views
 */
export function getAnalysisViewState() {
    return {
        simplifiedViewVisible,
        tensionCurveVisible
    };
}

// ============================================================================
// WINDOW EXPORTS
// ============================================================================

// Export to window for HTML event handlers and external access
if (typeof window !== 'undefined') {
    // View mode
    window.setProgressionViewMode = setProgressionViewMode;
    window.getProgressionViewMode = getProgressionViewMode;
    window.navigateToPreviousSection = navigateToPreviousSection;
    window.navigateToNextSection = navigateToNextSection;
    window.clearSectionSelection = clearSectionSelection;

    // Selection
    window.clearMultiSelection = clearMultiSelection;
    window.getChordSelectionCount = getSelectionCount;
    window.getSelectedChordIndicesArray = getSelectedIndicesArray;
    window.updateBassSelectionUI = updateBassSelectionUI;
    window.updateCustomBassPatternInfo = updateCustomBassPatternInfo;

    // Copy/paste
    window.copySelectedChords = () => copySelectedChords(getSelectedIndicesArray());
    window.pasteChords = pasteChords;
    window.duplicateSelectedChords = () => duplicateSelectedChords(getSelectedIndicesArray());
    window.deleteSelectedChords = () => deleteSelectedChords(getSelectedIndicesArray());

    // Chord operations
    window.addChordToProgressionByParams = addChordToProgressionByParams;
    window.addChordToSection = addChordToSection;

    // Transposition
    window.transposeProgression = transposeProgression;
    window.updateRomanNumerals = updateRomanNumerals;
    window.transposeTreble = transposeTreble;
    window.transposeTrebleWithModeAdjust = transposeTrebleWithModeAdjust;
    window.setKeyDropdownValue = setKeyDropdownValue;
}
