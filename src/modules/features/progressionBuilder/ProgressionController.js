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

// Community submission context (for edit flow)
import { clearLoadedSubmissionContext } from '../../community/loadedSubmissionContext.js';
import { showAlertModal } from '../../ui/modals.js';

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
    canRedo,
    updateUndoRedoButtons
} from '../../utils/undoRedo.js';

// Rendering functions (direct imports, not window.*)
import {
    updateSingleCard,
    updateTensionCurveIfVisible,
    rerenderActiveProgressionDisplay,
    createDetailedCardHTML,
    attachCardEventListeners,
    createSimplifiedCardStructure,
    renderChordNotation,
    calculateCanvasDimensions,
    updateCardShifts,
    refreshChordNotationCanvas,
    renderProgressionDisplay,
    highlightTensionPointForSelection,
    unhighlightAllTensionPoints,
    hideAllChordTooltips
} from './ProgressionRenderer.js';

// Playback functions
import {
    startProgressionChord,
    stopTrainerChord,
    playTrainerChordOnce,
    handleAutoPlayback,
    stopStepChord
} from './ProgressionPlayback.js';

// UI utilities
import { showToast } from '../../ui/toastNotifications.js';
import { clearHighlights, updateKeyboardLabels } from '../../ui/keyboard.js';
import { savePanelState } from '../../storage/panelState.js';

// Notation sync
import { syncProgressionToMelodyComposer } from '../../integration/melodyComposerBridge.js';
import { refreshNotationFromProgression, getNotationComposer } from '../../notation/notationInit.js';

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

// Expanded chord cards (detailed view)
const expandedChords = new Set();

/**
 * Check if a chord card is expanded
 * @param {number} index - Chord index
 * @returns {boolean} True if the chord card is expanded
 */
export function isChordExpanded(index) {
    return expandedChords.has(index);
}

// LocalStorage keys for persistence
const VIEW_MODE_STORAGE_KEY = 'progression-view-mode';
const SECTION_ORDER_STORAGE_KEY = 'user-section-order';

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
        const notationComposer = getNotationComposer();
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
 * Set user's preferred section order
 * @param {Array<string>} order - Array of section IDs in desired order
 */
export function setUserSectionOrder(order) {
    userSectionOrder = order;
    // Persist to localStorage
    if (order && order.length > 0) {
        localStorage.setItem(SECTION_ORDER_STORAGE_KEY, JSON.stringify(order));
    } else {
        localStorage.removeItem(SECTION_ORDER_STORAGE_KEY);
    }
}

/**
 * Get user's preferred section order
 * @returns {Array<string>|null} Array of section IDs or null if using default order
 */
export function getUserSectionOrder() {
    // If not loaded yet, try to load from localStorage
    if (userSectionOrder === null) {
        const stored = localStorage.getItem(SECTION_ORDER_STORAGE_KEY);
        if (stored) {
            try {
                userSectionOrder = JSON.parse(stored);
            } catch (e) {
                console.warn('Failed to parse stored section order:', e);
                userSectionOrder = null;
            }
        }
    }
    return userSectionOrder;
}

/**
 * Clear all section selections
 */
export function clearSectionSelection() {
    selectedSectionIds.clear();
    // Reset user section order to default when selection is cleared
    userSectionOrder = null;
    // Also clear the notation measure filter when clearing section selection
    const notationComposer = getNotationComposer();
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
 * Going "before" the first section selects "All" (clears selection)
 */
export function navigateToPreviousSection() {
    const compositionState = getCompositionState();
    if (!compositionState) return;

    const realSections = compositionState.getSections();
    // Get all sections including pseudo-sections, already sorted by position
    const allSections = window.buildSectionChipsWithUngrouped(realSections);
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

    rerenderActiveProgressionDisplay();
    window.updateNotationForSelectedSections();
}

/**
 * Navigate to next section in section view
 * Handles pseudo-sections and stays at last section
 */
export function navigateToNextSection() {
    const compositionState = getCompositionState();
    if (!compositionState) return;

    const realSections = compositionState.getSections();
    // Get all sections including pseudo-sections, already sorted by position
    const allSections = window.buildSectionChipsWithUngrouped(realSections);
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

    rerenderActiveProgressionDisplay();
    window.updateNotationForSelectedSections();
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

    // Validate key parameter
    if (!key || typeof key !== 'string') {
        console.warn(`[calculateScaleNotes] Invalid key: ${key}, defaulting to C`);
        key = 'C';
    }

    // Extract root note from key (handles "Em", "C#m", "Bb", etc.)
    // Key format: [A-G][#b]?[m]? where 'm' indicates minor
    let rootNote = key;
    const keyMatch = key.match(/^([A-Ga-g][#b]?)/);
    if (keyMatch) {
        rootNote = keyMatch[1].charAt(0).toUpperCase() + keyMatch[1].slice(1); // Normalize: "c#" -> "C#"
    }

    let scaleRootIndex = ALL_NOTES.indexOf(rootNote);
    if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[rootNote]);

    // If still not found, default to C
    if (scaleRootIndex === -1) {
        console.warn(`[calculateScaleNotes] Key "${key}" (root: "${rootNote}") not found in ALL_NOTES or ENHARMONIC_MAP, defaulting to C`);
        scaleRootIndex = 0; // C
    }

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

/**
 * Transpose all treble clef (melody) notes by the interval between two keys.
 * Shifts all pitches uniformly, keeping the melodic contour identical.
 * @param {string} oldKey - The original key (e.g., 'C', 'Am')
 * @param {string} newKey - The new key to transpose to
 */
export function transposeTreble(oldKey, newKey) {
    const compositionState = getCompositionState();
    if (!compositionState) {
        console.warn('[transposeTreble] No compositionState available');
        return;
    }

    // Extract root notes from key strings
    const oldKeyRoot = oldKey.replace(/m$/, '');
    const newKeyRoot = newKey.replace(/m$/, '');

    // Find key indices - first try directly in ALL_NOTES, then use enharmonic equivalent
    let oldIndex = ALL_NOTES.indexOf(oldKeyRoot);
    if (oldIndex === -1) {
        const enharmonicOld = ENHARMONIC_MAP[oldKeyRoot];
        if (enharmonicOld) oldIndex = ALL_NOTES.indexOf(enharmonicOld);
    }

    let newIndex = ALL_NOTES.indexOf(newKeyRoot);
    if (newIndex === -1) {
        const enharmonicNew = ENHARMONIC_MAP[newKeyRoot];
        if (enharmonicNew) newIndex = ALL_NOTES.indexOf(enharmonicNew);
    }

    if (oldIndex === -1 || newIndex === -1) {
        console.warn('[transposeTreble] Could not find key indices:', oldKeyRoot, newKeyRoot);
        return;
    }

    // Calculate semitone shift
    const semitones = (newIndex - oldIndex + 12) % 12;
    if (semitones === 0) return; // No transposition needed

    // Determine enharmonic preference for the new key
    const enharmonicPref = getEnharmonicPreferenceForKey(newKey);
    const noteArray = enharmonicPref === 'flat' ? FLAT_NOTES : SHARP_NOTES;

    // Get all measures and transpose treble notes
    const measures = compositionState.measures;
    let notesTransposed = 0;

    measures.forEach((measure, measureIndex) => {
        const voices = measure.notation?.treble?.voices || [];
        voices.forEach((voice, voiceIndex) => {
            const notes = voice.notes || [];
            notes.forEach((note, noteIndex) => {
                if (note.isRest || !note.pitches || note.pitches.length === 0) return;

                // Transpose each pitch in the note
                note.pitches = note.pitches.map(pitch => {
                    return transposePitch(pitch, semitones, noteArray);
                });

                notesTransposed++;
            });
        });
    });

    // Sync the changes back to the treble block sequence
    if (compositionState.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
    }

    // Emit event to trigger re-render
    compositionState.events.emit('measuresChanged', { source: 'transposeTreble' });
}

/**
 * Transpose treble notes AND adjust for mode change (major <-> minor).
 * This shifts pitches by the interval AND adjusts scale degrees 3, 6, 7
 * to match the new mode's scale.
 * @param {string} oldKey - The original key (e.g., 'C', 'Am')
 * @param {string} newKey - The new key to transpose to
 */
export function transposeTrebleWithModeAdjust(oldKey, newKey) {
    const compositionState = getCompositionState();
    if (!compositionState) {
        console.warn('[transposeTrebleWithModeAdjust] No compositionState available');
        return;
    }

    // Determine mode change
    const oldIsMinor = oldKey.endsWith('m');
    const newIsMinor = newKey.endsWith('m');
    const modeChanged = oldIsMinor !== newIsMinor;

    // Extract root notes from key strings
    const oldKeyRoot = oldKey.replace(/m$/, '');
    const newKeyRoot = newKey.replace(/m$/, '');

    // Find key indices - first try directly in ALL_NOTES, then use enharmonic equivalent
    let oldIndex = ALL_NOTES.indexOf(oldKeyRoot);
    if (oldIndex === -1) {
        const enharmonicOld = ENHARMONIC_MAP[oldKeyRoot];
        if (enharmonicOld) oldIndex = ALL_NOTES.indexOf(enharmonicOld);
    }

    let newIndex = ALL_NOTES.indexOf(newKeyRoot);
    if (newIndex === -1) {
        const enharmonicNew = ENHARMONIC_MAP[newKeyRoot];
        if (enharmonicNew) newIndex = ALL_NOTES.indexOf(enharmonicNew);
    }

    if (oldIndex === -1 || newIndex === -1) {
        console.warn('[transposeTrebleWithModeAdjust] Could not find key indices:', oldKeyRoot, newKeyRoot);
        return;
    }

    // Calculate semitone shift
    const semitones = (newIndex - oldIndex + 12) % 12;

    // Determine enharmonic preference for the new key
    const enharmonicPref = getEnharmonicPreferenceForKey(newKey);
    const noteArray = enharmonicPref === 'flat' ? FLAT_NOTES : SHARP_NOTES;

    // Get all measures and transpose treble notes
    const measures = compositionState.measures;
    let notesTransposed = 0;
    let notesAdjusted = 0;

    measures.forEach((measure, measureIndex) => {
        const voices = measure.notation?.treble?.voices || [];
        voices.forEach((voice, voiceIndex) => {
            const notes = voice.notes || [];
            notes.forEach((note, noteIndex) => {
                if (note.isRest || !note.pitches || note.pitches.length === 0) return;

                // Transpose each pitch in the note
                note.pitches = note.pitches.map(pitch => {
                    // First, do the basic interval transposition
                    let transposedPitch = transposePitch(pitch, semitones, noteArray);

                    // Then, if mode changed, check if this is scale degree 3, 6, or 7 and adjust
                    if (modeChanged) {
                        const adjustedPitch = adjustPitchForModeChange(
                            transposedPitch,
                            newKeyRoot,
                            newIsMinor,
                            noteArray
                        );
                        if (adjustedPitch !== transposedPitch) {
                            notesAdjusted++;
                            transposedPitch = adjustedPitch;
                        }
                    }

                    return transposedPitch;
                });

                notesTransposed++;
            });
        });
    });

    // Sync the changes back to the treble block sequence
    if (compositionState.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
    }

    // Emit event to trigger re-render
    compositionState.events.emit('measuresChanged', { source: 'transposeTrebleWithModeAdjust' });
}

// ============================================================================
// CHORD UPDATE FUNCTIONS
// ============================================================================

/**
 * Update chord type from simplified view
 * Changes the chord type while preserving the root note
 * @param {number} index - Chord index
 * @param {string} newType - New chord type (must match CHORD_DEFINITIONS key exactly)
 */
export function updateChordType(index, newType) {
    // Get compositionState directly - the single source of truth
    const compositionState = getCompositionState();
    if (!compositionState) {
        return;
    }

    const trainerState = getTrainerState();
    const chord = compositionState.getChord(index);
    if (!chord) {
        return;
    }

    // Use the chord's root directly - this is more reliable for non-diatonic chords
    // like secondary dominants (B7 in key of C) where the roman numeral might just be the note name
    const chordRoot = chord.root;
    if (!chordRoot) {
        console.warn('[updateChordType] No root note available for chord');
        return;
    }

    // Regenerate chord notes using getInvertedChordNotes directly with the chord's root
    // This is more reliable than getProgressionChordNotes for non-diatonic chords
    const chordResult = getInvertedChordNotes(
        chordRoot,
        newType,
        chord.inversion || 0,
        chord.key || trainerState.currentKey,
        0, // Get base notes without octave shift
        getKeyBasedEnharmonic(),
        getNotationPreference()
    );

    if (!chordResult || !chordResult.specificNotes || chordResult.specificNotes.length === 0) {
        console.warn('[updateChordType] Could not regenerate notes for chord:', chordRoot, newType);
        return;
    }

    const chordInfo = {
        notes: chordResult.specificNotes,
        name: chordResult.name,
        simpleName: chordResult.simpleName
    };

    // Prepare updates object
    const updates = {
        type: newType,
        notes: chordInfo.notes,
        lhNotes: chordInfo.lhNotes,
        name: chordInfo.name,
        simpleName: chordInfo.simpleName
    };

    // Reapply octave shift if it was previously set
    if (chord.octaveShift && chord.octaveShift !== 0) {
        updates.notes = updates.notes.map(note => {
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return note;
            const noteName = match[1];
            const octave = parseInt(match[2]);
            const newOctave = octave + Math.floor(chord.octaveShift / 12);
            // Clamp octave to valid MIDI range (0-8)
            const clampedOctave = Math.max(0, Math.min(8, newOctave));
            return `${noteName}${clampedOctave}`;
        });
    }

    // Save state for undo BEFORE making changes
    saveStateBeforeChange();

    // Update chord in compositionState
    compositionState.updateChordByIndex(index, updates);

    // Also update trainerState.progressionData to keep in sync
    if (trainerState.progressionData && trainerState.progressionData[index]) {
        Object.assign(trainerState.progressionData[index], updates);
    }

    // Update only this card and tension curve (type changes affect tension)
    updateSingleCard(index);
    updateTensionCurveIfVisible();

    // Update the grand staff notation
    updateChordAndRenderPreservingTrebleNotes(index);

    // Play the chord with the new type
    const voicedNotes = updates.notes.filter(n => !(chord.omittedNotes || []).includes(n));
    const rhOctaveShift = chord.octaveShift || 0;
    const lhRelativeShift = chord.lhOctaveShift || 0;
    const absoluteLHOctaveShift = rhOctaveShift + lhRelativeShift;
    const lhNotes = getLHNotes(
        chord.root,
        chord.lhType,
        chord.lhInversion,
        trainerState.currentKey,
        absoluteLHOctaveShift,
        newType,
        getKeyBasedEnharmonic()
    ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
    const allNotes = voicedNotes.concat(lhNotes);
    if (allNotes.length > 0) {
        playTrainerChordOnce(allNotes);
    }

    // Dispatch event for guided mode tutorials
    dispatchBuilderEvent('chordCardEdited', {
        chordIndex: index,
        property: 'type',
        value: newType,
        chord: `${chord.root} ${newType}`
    });
}

/**
 * Update chord root note from simplified view
 * Changes the root note while preserving the chord type
 * @param {number} index - Chord index
 * @param {string} newRoot - New root note
 */
export function updateChordRoot(index, newRoot) {
    // Get compositionState directly - the single source of truth
    const compositionState = getCompositionState();
    if (!compositionState) {
        return;
    }

    const trainerState = getTrainerState();
    const chord = compositionState.getChord(index);
    if (!chord) {
        return;
    }

    // Keep the same chord type, just change the root
    const chordType = chord.type || 'Major';

    // Regenerate chord notes using getInvertedChordNotes directly with the new root
    // This is more reliable than getProgressionChordNotes for all chord types
    const chordResult = getInvertedChordNotes(
        newRoot,
        chordType,
        chord.inversion || 0,
        chord.key || trainerState.currentKey,
        0, // Get base notes without octave shift
        getKeyBasedEnharmonic(),
        getNotationPreference()
    );

    if (!chordResult || !chordResult.specificNotes || chordResult.specificNotes.length === 0) {
        console.warn('[updateChordRoot] Could not regenerate notes for chord:', newRoot, chordType);
        return;
    }

    // Prepare updates object
    const updates = {
        root: newRoot,
        notes: chordResult.specificNotes,
        name: chordResult.name,
        simpleName: chordResult.simpleName,
        roman: '' // Clear roman numeral since we're using absolute root
    };

    // Reapply octave shift if it was previously set
    if (chord.octaveShift && chord.octaveShift !== 0) {
        updates.notes = updates.notes.map(note => {
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return note;
            const noteName = match[1];
            const octave = parseInt(match[2]);
            const newOctave = octave + Math.floor(chord.octaveShift / 12);
            // Clamp octave to valid MIDI range (0-8)
            const clampedOctave = Math.max(0, Math.min(8, newOctave));
            return `${noteName}${clampedOctave}`;
        });
    }

    // Save state for undo BEFORE making changes
    saveStateBeforeChange();

    // Update chord in compositionState
    compositionState.updateChordByIndex(index, updates);

    // Also update trainerState.progressionData to keep in sync
    if (trainerState.progressionData && trainerState.progressionData[index]) {
        Object.assign(trainerState.progressionData[index], updates);
    }

    // Update only this card and tension curve
    updateSingleCard(index);
    updateTensionCurveIfVisible();

    // Update the grand staff notation
    updateChordAndRenderPreservingTrebleNotes(index);

    // Play the chord with the new root
    const voicedNotes = updates.notes.filter(n => !(chord.omittedNotes || []).includes(n));
    const rhOctaveShift = chord.octaveShift || 0;
    const lhRelativeShift = chord.lhOctaveShift || 0;
    const absoluteLHOctaveShift = rhOctaveShift + lhRelativeShift;
    const lhNotes = getLHNotes(
        newRoot,
        chord.lhType,
        chord.lhInversion,
        trainerState.currentKey,
        absoluteLHOctaveShift,
        chordType,
        getKeyBasedEnharmonic()
    ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
    const allNotes = voicedNotes.concat(lhNotes);
    if (allNotes.length > 0) {
        playTrainerChordOnce(allNotes);
    }

    // Dispatch event for guided mode tutorials
    dispatchBuilderEvent('chordCardEdited', {
        chordIndex: index,
        property: 'root',
        value: newRoot,
        chord: `${newRoot} ${chordType}`
    });
}

/**
 * Update chord inversion from simplified view
 * Changes the chord inversion while preserving the root and type
 * @param {number} index - Chord index
 * @param {number} newInversion - New inversion (0 = root position, 1 = first inversion, etc.)
 * @param {boolean} shouldUpdateUI - Whether to update UI (default true)
 * @param {boolean} shouldSyncNotation - Whether to sync notation (default true)
 */
export function updateChordInversion(index, newInversion, shouldUpdateUI = true, shouldSyncNotation = true) {
    // Get compositionState directly - the single source of truth
    const compositionState = getCompositionState();
    if (!compositionState) {
        return;
    }

    const trainerState = getTrainerState();
    const chord = compositionState.getChord(index);
    if (!chord) {
        return;
    }

    // Use the chord's root directly - this is more reliable for non-diatonic chords
    // like secondary dominants (B7 in key of C) where the roman numeral might just be the note name
    const chordRoot = chord.root;
    if (!chordRoot) {
        console.warn('[updateChordInversion] No root note available for chord');
        return;
    }

    // Regenerate chord notes using getInvertedChordNotes directly with the chord's root and type
    // This is more reliable than getProgressionChordNotes for non-diatonic chords
    const chordResult = getInvertedChordNotes(
        chordRoot,
        chord.type,
        newInversion,
        chord.key || trainerState.currentKey,
        0, // Get base notes without octave shift
        getKeyBasedEnharmonic(),
        getNotationPreference()
    );

    if (!chordResult || !chordResult.specificNotes || chordResult.specificNotes.length === 0) {
        console.warn('[updateChordInversion] Could not regenerate notes for chord:', chordRoot, chord.type);
        return;
    }

    const chordInfo = { notes: chordResult.specificNotes };

    // Prepare updates object
    const updates = {
        inversion: newInversion,
        notes: chordInfo.notes,
        lhNotes: chordInfo.lhNotes,
        omittedNotes: [] // Clear omittedNotes since note names change with inversion
    };

    // Reapply octave shift if it was previously set
    if (chord.octaveShift && chord.octaveShift !== 0) {
        updates.notes = updates.notes.map(note => {
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return note;
            const noteName = match[1];
            const octave = parseInt(match[2]);
            const newOctave = octave + Math.floor(chord.octaveShift / 12);
            // Clamp octave to valid MIDI range (0-8)
            const clampedOctave = Math.max(0, Math.min(8, newOctave));
            return `${noteName}${clampedOctave}`;
        });
    }

    // Save state for undo BEFORE making changes
    saveStateBeforeChange();

    // Update chord in compositionState
    compositionState.updateChordByIndex(index, updates);

    // Dispatch event for guided mode tutorials
    dispatchBuilderEvent('chordCardEdited', {
        chordIndex: index,
        property: 'inversion',
        value: newInversion,
        chord: `${chord.root} ${chord.type}`
    });

    // Also update trainerState.progressionData to keep in sync
    if (trainerState.progressionData && trainerState.progressionData[index]) {
        Object.assign(trainerState.progressionData[index], updates);
    }

    // Update only this card and tension curve (inversions affect tension and voice leading)
    // Skip UI update if called from tooltip to prevent closing the tooltip
    if (shouldUpdateUI) {
        updateSingleCard(index);
        updateTensionCurveIfVisible();
    }

    // Update the grand staff notation - skip if called from tooltip buttons (will sync on mouseup)
    if (shouldSyncNotation) {
        // Use new helper function that preserves treble notes
        updateChordAndRenderPreservingTrebleNotes(index);
    }
}

/**
 * Update chord duration from simplified view
 * Now supports confirmation dialog when truncation is needed
 * @param {number} index - Chord index
 * @param {HTMLElement} sourceElement - Source element triggering the change
 */
export function updateChordDuration(index, sourceElement, directBeatsValue = null) {
    // Get compositionState directly - the single source of truth
    const compositionState = getCompositionState();
    if (!compositionState) {
        return;
    }

    // Get the chord from compositionState
    const chord = compositionState.getChord(index);
    if (!chord) {
        return;
    }

    let totalBeats;
    let singleDurationSelect = null;
    let durationWholeSelect = null;
    let durationFracSelect = null;

    // If directBeatsValue is provided, use it directly (from new single dropdown)
    if (directBeatsValue !== null && !isNaN(directBeatsValue)) {
        totalBeats = directBeatsValue;
        // Find the single dropdown for potential revert
        if (sourceElement) {
            const wrapper = sourceElement.closest('.chord-card-wrapper') ||
                           sourceElement.closest('[data-chord-index]');
            if (wrapper) {
                singleDurationSelect = wrapper.querySelector('.duration-select');
            }
        }
    } else {
        // Legacy: Find the duration selectors (two-dropdown system)
        if (sourceElement) {
            // Find the closest wrapper containing the duration controls
            const wrapper = sourceElement.closest('.chord-card-wrapper') ||
                           sourceElement.closest('[data-chord-index]');
            if (wrapper) {
                durationWholeSelect = wrapper.querySelector('.duration-whole-select');
                durationFracSelect = wrapper.querySelector('.duration-frac-select');
            }
        }

        // If not found via sourceElement, search in all containers
        if (!durationWholeSelect || !durationFracSelect) {
            const wrappers = document.querySelectorAll(`[data-chord-index="${index}"]`);
            for (const wrapper of wrappers) {
                const wholeSelect = wrapper.querySelector('.duration-whole-select');
                const fracSelect = wrapper.querySelector('.duration-frac-select');
                if (wholeSelect && fracSelect) {
                    durationWholeSelect = wholeSelect;
                    durationFracSelect = fracSelect;
                    break;
                }
            }
        }

        if (!durationWholeSelect || !durationFracSelect) {
            return;
        }

        // Parse the selected values
        const wholeBeats = parseInt(durationWholeSelect.value) || 0;
        const fracBeats = parseFloat(durationFracSelect.value) || 0;
        totalBeats = wholeBeats + fracBeats;
    }

    // Validation: minimum 0.25 beats (16th note)
    if (totalBeats < 0.25) {
        showAlertModal({
            title: 'Invalid Duration',
            message: 'Chord duration must be at least 0.25 beats (16th note)',
            type: 'warning'
        });
        // Reset to previous value
        const prevBeats = chord.beats || 4;
        if (singleDurationSelect) {
            singleDurationSelect.value = prevBeats;
        } else if (durationWholeSelect && durationFracSelect) {
            const prevWhole = Math.floor(prevBeats);
            const prevFrac = prevBeats - prevWhole;
            durationWholeSelect.value = prevWhole;
            durationFracSelect.value = prevFrac;
        }
        return;
    }

    // Check if the value actually changed
    if (chord.beats === totalBeats) {
        return; // No change needed
    }

    // Save state for undo BEFORE making changes
    saveStateBeforeChange();

    // Update the chord duration using compositionState's dedicated method
    // This now returns confirmation info if truncation is needed
    const result = compositionState.updateChordDuration(index, totalBeats);

    // Check if we need user confirmation for truncation
    if (result && result.needsConfirmation) {
        showTruncationWarningDialog(result.truncationInfo, () => {
            // User confirmed - force apply the change
            compositionState.forceApplyChordDuration(index, totalBeats);
            finalizeDurationChange(index, totalBeats);
        }, () => {
            // User cancelled - revert the selectors
            const prevBeats = chord.beats || 4;
            if (singleDurationSelect) {
                singleDurationSelect.value = prevBeats;
            } else if (durationWholeSelect && durationFracSelect) {
                const prevWhole = Math.floor(prevBeats);
                const prevFrac = prevBeats - prevWhole;
                durationWholeSelect.value = prevWhole;
                durationFracSelect.value = prevFrac;
            }
        });
        return;
    }

    // No confirmation needed - finalize the change
    finalizeDurationChange(index, totalBeats);
}

/**
 * Finalize duration change after update (or after user confirmation)
 * @param {number} index - Chord index
 * @param {number} totalBeats - New duration in beats
 */
export function finalizeDurationChange(index, totalBeats) {
    // Update all card displays (both tabs)
    updateSingleCard(index);

    // Trigger re-render of the notation
    const notationComposer = getNotationComposer();
    if (notationComposer) {
        notationComposer.render();
    }

    // Dispatch event for other components that may need to know
    window.dispatchEvent(new CustomEvent('chordDurationChanged', {
        detail: { index, beats: totalBeats }
    }));

    // Dispatch for tutorial system
    dispatchBuilderEvent('chordDurationChanged', { index, beats: totalBeats });

    // Update unified suggestions if available
    if (window.updateUnifiedSuggestions) {
        window.updateUnifiedSuggestions();
    }
}

/**
 * Show warning dialog when reducing duration would truncate notes
 * @param {Object} truncationInfo - Info about what will be truncated
 * @param {Function} onConfirm - Callback when user confirms
 * @param {Function} onCancel - Callback when user cancels
 */
function showTruncationWarningDialog(truncationInfo, onConfirm, onCancel) {
    // Build description of what will be affected
    let affectedDescription = '';

    if (truncationInfo.truncatedNotes.length > 0) {
        affectedDescription += `<li><strong>${truncationInfo.truncatedNotes.length} note(s)</strong> will be removed entirely</li>`;
    }

    if (truncationInfo.adjustedNote) {
        const adj = truncationInfo.adjustedNote;
        affectedDescription += `<li>The last note will be shortened from <strong>${adj.original.duration}</strong> to <strong>${adj.adjusted.duration}</strong></li>`;
    }

    const modalHTML = `
        <div id="truncation-warning-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
                <div class="bg-amber-500 px-6 py-4">
                    <h3 class="text-xl font-bold text-white flex items-center gap-2">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                        Note Truncation Warning
                    </h3>
                </div>
                <div class="p-6">
                    <p class="text-gray-700 mb-4">
                        Reducing the duration of <strong>${truncationInfo.chordName}</strong> from
                        <strong>${truncationInfo.oldDuration}</strong> to <strong>${truncationInfo.newDuration}</strong> beats
                        will affect edited bass notes:
                    </p>
                    <ul class="list-disc list-inside text-gray-600 mb-4 space-y-1">
                        ${affectedDescription}
                    </ul>
                    <p class="text-gray-600 text-sm">
                        This action cannot be undone. Do you want to continue?
                    </p>
                </div>
                <div class="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                    <button id="truncation-cancel-btn" class="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors">
                        Cancel
                    </button>
                    <button id="truncation-confirm-btn" class="px-4 py-2 text-white bg-amber-500 rounded hover:bg-amber-600 transition-colors">
                        Truncate Notes
                    </button>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existing = document.getElementById('truncation-warning-modal');
    if (existing) existing.remove();

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Get modal and buttons
    const modal = document.getElementById('truncation-warning-modal');
    const cancelBtn = document.getElementById('truncation-cancel-btn');
    const confirmBtn = document.getElementById('truncation-confirm-btn');

    // Handle cancel
    const handleCancel = () => {
        modal.remove();
        if (onCancel) onCancel();
    };

    // Handle confirm
    const handleConfirm = () => {
        modal.remove();
        if (onConfirm) onConfirm();
    };

    // Attach event listeners
    cancelBtn.addEventListener('click', handleCancel);
    confirmBtn.addEventListener('click', handleConfirm);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) handleCancel();
    });
}

/**
 * Update chord voicing from simplified view
 * @param {number} index - Chord index
 * @param {string} newVoicing - New voicing type ('close', 'open', etc.)
 */
export function updateChordVoicing(index, newVoicing) {
    // Save state for undo BEFORE making changes
    saveStateBeforeChange();

    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    chord.voicing = newVoicing;

    // Update only this card (voicing doesn't affect tension curve)
    updateSingleCard(index);
}

/**
 * Update RH octave shift
 * @param {number} index - Chord index
 * @param {number} shift - Octave shift value (in semitones, typically -12, 0, or 12)
 */
export function updateRHOctaveShift(index, shift) {
    // Get compositionState directly - the single source of truth
    const compositionState = getCompositionState();
    if (!compositionState) {
        return;
    }

    const trainerState = getTrainerState();
    const chord = compositionState.getChord(index);
    if (!chord) {
        return;
    }

    // Use the chord's root directly - this is more reliable for non-diatonic chords
    // like secondary dominants (B7 in key of C) where the roman numeral might just be the note name
    const chordRoot = chord.root;
    if (!chordRoot) {
        console.warn('[updateRHOctaveShift] No root note available for chord');
        return;
    }

    // Regenerate notes using getInvertedChordNotes directly with the chord's root and type
    // This is more reliable than getProgressionChordNotes for non-diatonic chords
    const chordResult = getInvertedChordNotes(
        chordRoot,
        chord.type,
        chord.inversion || 0,
        chord.key || trainerState.currentKey,
        0, // Get base notes without octave shift
        getKeyBasedEnharmonic(),
        getNotationPreference()
    );

    if (!chordResult || !chordResult.specificNotes || chordResult.specificNotes.length === 0) {
        console.warn('[updateRHOctaveShift] Could not regenerate notes for chord:', chordRoot, chord.type);
        return;
    }

    const chordInfo = { notes: chordResult.specificNotes };

    // Apply octave shift
    const shiftedNotes = chordInfo.notes.map(note => {
        const match = note.match(/^([A-G][#b]?)(\d+)$/);
        if (!match) return note;
        const noteName = match[1];
        const octave = parseInt(match[2]);
        const newOctave = octave + Math.floor(shift / 12);
        // Clamp octave to valid MIDI range (0-8)
        const clampedOctave = Math.max(0, Math.min(8, newOctave));
        return `${noteName}${clampedOctave}`;
    });

    // Save state for undo BEFORE making changes
    saveStateBeforeChange();

    // Update chord in compositionState
    compositionState.updateChordByIndex(index, {
        octaveShift: shift,
        notes: shiftedNotes
    });

    // Also update trainerState.progressionData to keep in sync
    if (trainerState.progressionData && trainerState.progressionData[index]) {
        trainerState.progressionData[index].octaveShift = shift;
        trainerState.progressionData[index].notes = shiftedNotes;
    }

    // Update only this card
    updateSingleCard(index);

    // Also update the grand staff notation
    updateChordAndRenderPreservingTrebleNotes(index);

    // Play the chord with the new octave (LH is relative to RH, so update LH too)
    const updatedChord = compositionState.getChord(index);
    const voicedNotes = (updatedChord.notes || []).filter(n => !(updatedChord.omittedNotes || []).includes(n));
    const lhRelativeShift = updatedChord.lhOctaveShift || 0;
    const absoluteLHOctaveShift = shift + lhRelativeShift;
    const lhNotes = getLHNotes(
        updatedChord.root,
        updatedChord.lhType,
        updatedChord.lhInversion,
        trainerState.currentKey,
        absoluteLHOctaveShift,
        updatedChord.type,
        getKeyBasedEnharmonic()
    ).filter(n => !(updatedChord.lhOmittedNotes || []).includes(n));
    const allNotes = voicedNotes.concat(lhNotes);
    if (allNotes.length > 0) {
        playTrainerChordOnce(allNotes);
    }
}

/**
 * Update a progression chord's properties
 * @param {number} index - Index of chord
 * @param {string} property - Property to update ('type', 'inversion', 'octaveShift', 'rhythmPattern')
 * @param {*} value - New value
 */
export function updateProgressionChord(index, property, value) {
    const trainerState = getTrainerState();
    if (!trainerState.progressionData[index]) return;

    // Save state before updating
    saveStateBeforeChange();

    let chordState = { ...trainerState.progressionData[index] };
    const oldOctaveShift = chordState.octaveShift || 0;
    const oldNotes = [...(chordState.notes || [])];
    const oldOmittedNotes = [...(chordState.omittedNotes || [])];
    const oldLhOmittedNotes = [...(chordState.lhOmittedNotes || [])];

    if (property === 'type') {
        chordState.type = value;
        chordState.inversion = 0;
    } else if (property === 'inversion') {
        chordState.inversion = value;
    } else if (property === 'octaveShift') {
        chordState.octaveShift = value;
    } else if (property === 'rhythmPattern') {
        chordState.rhythmPattern = value;
    }

    // Get key without 'm' suffix for calculation
    let keyForCalculation = trainerState.currentKey || 'C';
    const isMinorKey = keyForCalculation && keyForCalculation.endsWith('m');
    if (isMinorKey) {
        keyForCalculation = keyForCalculation.replace(/m$/, '');
    }

    // Use roman numeral if available, otherwise fall back to root note
    const romanOrRoot = chordState.roman || chordState.root;
    if (!romanOrRoot) {
        console.warn('[updateProgressionChord] No roman numeral or root note available for chord');
        return;
    }

    const newData = getProgressionChordNotes(
        keyForCalculation,
        romanOrRoot,
        chordState.type,
        chordState.inversion,
        chordState.octaveShift
    );

    if (newData) {
        // Convert Roman numeral to minor case if key is minor
        if (isMinorKey && newData.roman) {
            const minorMap = {
                'I': 'i',
                'ii': 'ii°',
                'iii': 'III',
                'IV': 'iv',
                'V': 'v',
                'vi': 'VI',
                'vii°': 'VII'
            };
            newData.roman = minorMap[newData.roman] || newData.roman;
        }

        // If octave shift changed, map omitted notes from old octave to new octave
        if (property === 'octaveShift' && oldOctaveShift !== chordState.octaveShift) {
            // Build a comprehensive map from old note to new note by matching note names
            const noteMap = new Map();
            const usedNewNotes = new Set();

            // First pass: try to match by exact position
            const minLength = Math.min(oldNotes.length, newData.notes.length);
            for (let i = 0; i < minLength; i++) {
                const oldNote = oldNotes[i];
                const newNote = newData.notes[i];
                const oldMatch = oldNote.match(/^([A-G][#b]?)(\d+)$/);
                const newMatch = newNote.match(/^([A-G][#b]?)(\d+)$/);

                if (oldMatch && newMatch && oldMatch[1] === newMatch[1]) {
                    noteMap.set(oldNote, newNote);
                    usedNewNotes.add(newNote);
                }
            }

            // Second pass: match remaining notes by name
            oldNotes.forEach((oldNote) => {
                if (noteMap.has(oldNote)) return;

                const oldMatch = oldNote.match(/^([A-G][#b]?)(\d+)$/);
                if (!oldMatch) return;

                const oldNoteName = oldMatch[1];
                const matchingNewNote = newData.notes.find(note => {
                    if (usedNewNotes.has(note)) return false;
                    const newMatch = note.match(/^([A-G][#b]?)(\d+)$/);
                    return newMatch && newMatch[1] === oldNoteName;
                });

                if (matchingNewNote) {
                    noteMap.set(oldNote, matchingNewNote);
                    usedNewNotes.add(matchingNewNote);
                }
            });

            // Map omitted notes using the comprehensive map
            const mappedOmittedNotes = oldOmittedNotes
                .map(oldOmittedNote => {
                    const mapped = noteMap.get(oldOmittedNote);
                    if (mapped) return mapped;

                    const oldMatch = oldOmittedNote.match(/^([A-G][#b]?)(\d+)$/);
                    if (oldMatch) {
                        const oldNoteName = oldMatch[1];
                        const matchingNewNote = newData.notes.find(note => {
                            const newMatch = note.match(/^([A-G][#b]?)(\d+)$/);
                            return newMatch && newMatch[1] === oldNoteName;
                        });
                        return matchingNewNote;
                    }
                    return undefined;
                })
                .filter(note => note !== undefined && note !== null);

            newData.omittedNotes = mappedOmittedNotes;

            // Also map LH omitted notes if they exist
            if (oldLhOmittedNotes.length > 0 && chordState.lhType && chordState.lhType !== 'off') {
                const oldLhNotes = getLHNotes(
                    chordState.root,
                    chordState.lhType,
                    chordState.lhInversion,
                    trainerState.currentKey,
                    chordState.lhOctaveShift || 0,
                    chordState.type,
                    getKeyBasedEnharmonic()
                );

                const newLhNotes = getLHNotes(
                    newData.root,
                    chordState.lhType,
                    chordState.lhInversion,
                    trainerState.currentKey,
                    chordState.lhOctaveShift || 0,
                    newData.type,
                    getKeyBasedEnharmonic()
                );

                const lhNoteNameMap = new Map();
                oldLhNotes.forEach((oldLhNote, idx) => {
                    if (newLhNotes[idx]) {
                        lhNoteNameMap.set(oldLhNote, newLhNotes[idx]);
                    } else {
                        const oldMatch = oldLhNote.match(/^([A-G][#b]?)(\d+)$/);
                        if (oldMatch) {
                            const oldNoteName = oldMatch[1];
                            const matchingNewNote = newLhNotes.find(note => {
                                const newMatch = note.match(/^([A-G][#b]?)(\d+)$/);
                                return newMatch && newMatch[1] === oldNoteName;
                            });
                            if (matchingNewNote) {
                                lhNoteNameMap.set(oldLhNote, matchingNewNote);
                            }
                        }
                    }
                });

                const mappedLhOmittedNotes = oldLhOmittedNotes
                    .map(oldOmittedNote => lhNoteNameMap.get(oldOmittedNote))
                    .filter(note => note !== undefined);

                newData.lhOmittedNotes = mappedLhOmittedNotes;
            } else {
                newData.lhOmittedNotes = oldLhOmittedNotes;
            }
        } else {
            // No octave shift change, preserve omitted notes as-is
            newData.omittedNotes = oldOmittedNotes;
            newData.lhOmittedNotes = oldLhOmittedNotes;
        }

        // Preserve properties that aren't recalculated
        newData.isVoicingExpanded = chordState.isVoicingExpanded;
        newData.lhType = chordState.lhType;
        newData.lhInversion = chordState.lhInversion;
        newData.lhOctaveShift = chordState.lhOctaveShift;
        newData.octaveShift = chordState.octaveShift;
        newData.rhythmPattern = chordState.rhythmPattern;
        trainerState.progressionData[index] = newData;

        // Re-render progression displays
        renderProgressionDisplay('progression-visualization', true);
        renderProgressionDisplay('melody-progression-visualization', true);
    }

    const lhNotes = getLHNotes(
        newData.root,
        newData.lhType,
        newData.lhInversion,
        trainerState.currentKey,
        newData.lhOctaveShift,
        newData.type,
        getKeyBasedEnharmonic()
    );

    // Play chord respecting omitted notes
    const rhNotesToPlay = newData.notes.filter(n => !(newData.omittedNotes || []).includes(n));
    const lhNotesToPlay = lhNotes.filter(n => !(newData.lhOmittedNotes || []).includes(n));
    playTrainerChordOnce(rhNotesToPlay.concat(lhNotesToPlay));

    const chordDisplay = document.getElementById('progression-chord-notes-display');
    if (chordDisplay) {
        chordDisplay.textContent = `Changed: ${newData.roman} (${newData.name})`;
    }
}

/**
 * Update left hand properties for a progression chord
 * @param {number} index - Index of chord
 * @param {string} property - Property to update ('lhType', 'lhInversion', 'lhOctaveShift')
 * @param {*} value - New value
 */
export function updateProgressionChordLH(index, property, value) {
    const trainerState = getTrainerState();
    if (!trainerState.progressionData[index]) return;

    // Save state before updating
    saveStateBeforeChange();

    trainerState.progressionData[index][property] = property.includes('Inversion') || property.includes('Octave') ? parseInt(value, 10) : value;

    // If the LH type is changed, reset the inversion to Root
    if (property === 'lhType') {
        trainerState.progressionData[index].lhInversion = 0;
    }

    const chord = trainerState.progressionData[index];
    const lhNotes = getLHNotes(
        chord.root,
        chord.lhType,
        chord.lhInversion,
        trainerState.currentKey,
        chord.lhOctaveShift,
        chord.type,
        getKeyBasedEnharmonic()
    );
    playTrainerChordOnce(chord.notes.concat(lhNotes));

    // Re-render progression displays
    renderProgressionDisplay('progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', true);
}

/**
 * Helper function to update a chord in compositionState and render WITHOUT wiping treble notes
 * Use this instead of syncNotationFromProgression() to preserve user-added treble notes
 * @param {number} index - chord index to sync
 * @param {object} [options]
 * @param {boolean} [options.skipCardRefresh=false] - if true, do not rebuild card DOM
 */
export function updateChordAndRenderPreservingTrebleNotes(index, options = {}) {
    const { skipCardRefresh = false } = options;
    const compositionState = getCompositionState();
    const notationComposer = getNotationComposer();
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];

    if (!chord || !compositionState || !notationComposer) return;

    // Block renders and syncs during update
    const wasBlockingRenders = notationComposer.isSyncingFromProgression;
    notationComposer.isSyncingFromProgression = true;

    const syncInstance = window.getProgressionNotationSync && window.getProgressionNotationSync();
    const wasBlockingSync = syncInstance ? syncInstance.isUpdating : false;
    if (syncInstance) {
        syncInstance.isUpdating = true;
    }

    try {
        // Ensure measure exists in compositionState
        while (compositionState.getMeasureCount() <= index) {
            compositionState.addMeasure({});
        }

        // Update the chord with ALL properties from progression
        compositionState.updateChord(index, {
            root: chord.root,
            type: chord.type,
            notes: chord.notes || [],
            inversion: chord.inversion || 0,
            voicing: chord.voicing || 'close',
            roman: chord.roman || null,
            name: chord.name || null,
            octaveShift: chord.octaveShift || 0,
            lhOctaveShift: chord.lhOctaveShift || 0,
            omittedNotes: chord.omittedNotes || [],
            lhOmittedNotes: chord.lhOmittedNotes || [],
            beats: chord.beats !== undefined ? chord.beats : 4
        });

        // Regenerate bass for this building block (chord)
        const autoGenerateBass = compositionState.getSettings().autoGenerateBass;
        const measure = compositionState.getMeasure(index);

        if (autoGenerateBass) {
            // Use building-block-aware regeneration that handles multi-measure chords
            compositionState.regenerateAutoBassByChordIndex(index);
        } else {
            // Create simple whole-note bass from chord notes
            if (measure && measure.notation && measure.notation.bass && chord.notes && chord.notes.length > 0) {
                const voicedNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
                if (voicedNotes.length > 0) {
                    measure.notation.bass.voices[0].notes = [{
                        type: 'note',
                        pitches: [...voicedNotes],
                        duration: '1n',
                        beat: 0,
                        dotted: false
                    }];
                    measure.notation.bass.autoGenerated = false;
                }
            }
        }
    } finally {
        // Restore previous states
        notationComposer.isSyncingFromProgression = wasBlockingRenders;
        if (syncInstance) {
            syncInstance.isUpdating = wasBlockingSync;
        }
    }

    // Update chord cards across all tabs unless explicitly skipped
    if (!skipCardRefresh) {
        updateSingleCard(index);
    }

    // Render the notation
    if (notationComposer && typeof notationComposer.render === 'function') {
        notationComposer.render();
    }

    // Update voice leading analysis to reflect chord changes
    if (window.updateVoiceLeading) {
        window.updateVoiceLeading();
    }
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
 * @param {boolean} playShutterSound - Whether to play the camera shutter sound (default: true)
 */
export function addChordToProgressionByParams(chordType, root, inversion = 0, octaveShift = 0, playShutterSound = true) {
    // Play camera shutter sound effect (only if requested and buffer is loaded)
    if (playShutterSound && window.getAudioIsReady && window.getCameraShutter) {
        const audioIsReady = window.getAudioIsReady();
        const shutter = window.getCameraShutter();
        if (audioIsReady && shutter && shutter.loaded) {
            shutter.start();
        }
    }

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
    const compositionState = getCompositionState();
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
    // skipSuccessToast: true because we show our own toast at the end of this function
    if (window.addToProgressionData) {
        window.addToProgressionData(newChordData, { skipSuccessToast: true });
    } else {
        // Fallback: append and sync manually
        const appended = [...currentProgression, newChordData];
        setProgressionData(appended);
        renderProgressionDisplay('melody-progression-visualization', true);
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
            const compositionState = getCompositionState();
            if (compositionState && typeof compositionState.reorderChord === 'function') {
                compositionState.reorderChord(appendedIndex, targetIndex);

                const reordered = compositionState.exportToProgressionData();
                setProgressionData(reordered);
                renderProgressionDisplay('melody-progression-visualization', true);
            } else {
                // Pure JS fallback reorder if compositionState is unavailable
                const manual = [...afterAppend];
                const [moved] = manual.splice(appendedIndex, 1);
                manual.splice(targetIndex, 0, moved);
                setProgressionData(manual);
                renderProgressionDisplay('melody-progression-visualization', true);
            }
            // Update insertedIndex to reflect the actual position
            insertedIndex = targetIndex;
        }
    }

    // Phase 2.1: Handle section assignment based on intent
    let sectionWasModified = false;
    const sectionCompositionState = getCompositionState();
    if (sectionCompositionState && sectionIntent) {
        try {
            if (sectionIntent.mode === INTENT_MODES.NEW_SECTION && sectionIntent.newSectionType) {
                // Create a new section with this chord as the first chord
                const newSection = sectionCompositionState.createSection(
                    sectionIntent.newSectionType,
                    [insertedIndex]
                );
                if (newSection) {
                    sectionWasModified = true;
                }
            } else if (sectionIntent.mode === INTENT_MODES.CONTINUE && sectionIntent.targetSection) {
                // Add the chord to the existing section
                sectionCompositionState.addChordToSection(insertedIndex, sectionIntent.targetSection.id);
                sectionWasModified = true;
            }
            // If ungrouped (no targetSection), leave the chord ungrouped
        } catch (e) {
            // Silently fail
        }
    }

    // Fallback: If no sectionIntent was set, check for wireframe sections with available slots
    if (!sectionIntent && sectionCompositionState && !sectionWasModified) {
        try {
            const allSections = sectionCompositionState.getSections?.() || [];

            // Find the first section with available slots
            const sectionWithSlot = allSections.find(section => {
                const currentCount = section.chordIndices?.length || 0;
                const expectedCount = section.expectedChordCount || 4;
                return currentCount < expectedCount;
            });

            if (sectionWithSlot) {
                sectionCompositionState.addChordToSection(insertedIndex, sectionWithSlot.id);
                sectionWasModified = true;
            }
        } catch (e) {
            // Silently fail - chord will remain ungrouped
        }
    }

    // Re-render display if a section was modified (to show section visuals)
    if (sectionWasModified) {
        renderProgressionDisplay('melody-progression-visualization', true);
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

    // Show success toast notification
    const chordSymbol = CHORD_DEFINITIONS[chordType]?.symbol ?? '';
    const displayName = `${root}${chordSymbol}`;
    showToast(`Added ${displayName} to progression`, { type: 'success', duration: 2000 });

    // Phase 2.1: Select the newly inserted chord
    selectChordCard(insertedIndex);
}

/**
 * Add a "No Chord" (N.C.) placeholder to the progression.
 * This reserves time in the composition without specifying harmony.
 * The bass clef will be empty/rest during this time.
 */
export function addNoChordToProgression() {
    // Save current state for undo
    if (window.captureProgressionState && window.pushToUndoStack) {
        const currentState = window.captureProgressionState();
        pushToUndoStack(currentState);
    }

    // Get default beats based on current time signature
    let defaultBeats = 4;
    const compositionState = getCompositionState();
    if (compositionState && compositionState.metadata && compositionState.metadata.timeSignature) {
        const ts = compositionState.metadata.timeSignature;
        const num = ts.num || 4;
        const denom = ts.denom || 4;
        defaultBeats = num * (4 / denom);
    }

    // Create No Chord data with empty notes
    const noChordData = {
        name: 'N.C.',
        simpleName: 'N.C.',
        notes: [],              // Empty - no chord tones
        root: '',               // No root
        type: 'No Chord',
        inversion: 0,
        selectionMode: 'chord',
        omittedNotes: [],
        octaveShift: 0,
        lhType: 'off',          // No left hand
        lhInversion: 0,
        lhOctaveShift: 0,
        lhNotes: [],            // Empty bass notes
        lhOmittedNotes: [],
        roman: '',              // No roman numeral
        beats: defaultBeats
    };

    // Add using the standard add function
    if (window.addToProgressionData) {
        window.addToProgressionData(noChordData);
    }

    console.log('[addNoChordToProgression] Added No Chord placeholder');
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
                    if (!isBorrowedChord) {
                        showToast(`Respelled ${originalRoot} as ${newRoot} to match key of ${getCurrentKey()}`, 'info', 3000);
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
        const compositionState = getCompositionState();
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
    // If appendToEnd option is set, skip position-based insertion and always add at end
    const insertAfterIndex = options.appendToEnd ? null : getInsertAfterIndex();
    const usePositionBasedInsert = insertAfterIndex !== null &&
                                   insertAfterIndex >= 0 &&
                                   insertAfterIndex < trainerState.progressionData.length;

    if (usePositionBasedInsert) {
        // Insert after the selected chord
        const targetIndex = insertAfterIndex + 1;
        trainerState.progressionData.splice(targetIndex, 0, chordData);

        // Update compositionState if available to keep it in sync
        const compositionState = getCompositionState();
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
    renderProgressionDisplay('melody-progression-visualization', true);

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

    // Show success toast notification (unless caller wants to show their own)
    if (!options.skipSuccessToast) {
        const chordSymbol = CHORD_DEFINITIONS[chordData.type]?.symbol ?? '';
        const displayName = `${chordData.root}${chordSymbol}`;
        showToast(`Added ${displayName} to progression`, { type: 'success', duration: 2000 });
    }
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

    if (trainerState.isPlaying) {
        handleAutoPlayback();
    }

    // Hide any open tooltips before removing the chord
    hideAllChordTooltips();

    // Save state before removing
    if (window.saveStateBeforeChange) {
        window.saveStateBeforeChange();
    }

    // IMPORTANT: progressionData is now delegated to compositionState
    // Use compositionState.removeChord() which properly syncs edits before removing
    const compositionState = getCompositionState();
    if (compositionState) {
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
    // First render the main progression builder
    renderProgressionDisplay('melody-progression-visualization', true);
    // Then render the melody composer tab (syncBothTabs=false to avoid infinite recursion)
    renderProgressionDisplay('melody-progression-visualization', false);

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
    refreshNotationFromProgression();

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

    const compositionState = getCompositionState();
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
    renderProgressionDisplay('melody-progression-visualization', true);
}

/**
 * Clear all chords from the progression
 * Shows confirmation dialog if progression has chords (unless skipConfirmation is true)
 * @param {boolean} skipConfirmation - If true, skip the confirmation dialog
 */
export function clearProgression(skipConfirmation = false) {
    const trainerState = getTrainerState();
    const progressionData = getProgressionData();

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
    if (trainerState.isPlaying) {
        handleAutoPlayback();
    }

    // Stop any step chord playback
    stopStepChord();

    // Clear progression data
    setProgressionData([]);
    setProgressionRomans([]);
    setCurrentIndex(0);
    setIsReady(false);

    // Clear highlights
    clearHighlights();

    // Clear card highlights
    document.querySelectorAll('.active-progression-card').forEach(card => {
        card.classList.remove('active-progression-card');
    });

    // Re-render the display
    renderProgressionDisplay('melody-progression-visualization', true);

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
    syncProgressionToMelodyComposer();
    refreshNotationFromProgression();

    // Update Voice Leading and Theory Insights panels to reflect empty progression
    if (window.voiceLeadingDiagram && window.voiceLeadingDiagram.update) {
        window.voiceLeadingDiagram.update();
    }
    if (window.theoryInsightsPanel && window.theoryInsightsPanel.update) {
        window.theoryInsightsPanel.update();
    }

    // Clear any loaded submission context (user is starting fresh)
    clearLoadedSubmissionContext();
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
    const compositionState = getCompositionState();
    if (!compositionState) {
        return;
    }

    const trainerState = getTrainerState();
    const chordData = compositionState.getChord(chordIndex);
    if (!chordData) return;

    // Save state before toggling
    saveStateBeforeChange();

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
    const lhNotes = getLHNotes(
        updatedChord.root,
        updatedChord.lhType,
        updatedChord.lhInversion,
        trainerState.currentKey,
        updatedChord.lhOctaveShift,
        updatedChord.type,
        getKeyBasedEnharmonic()
    ).filter(n => !(updatedChord.lhOmittedNotes || []).includes(n));
    const allNotes = voicedNotes.concat(lhNotes);

    if (allNotes.length > 0) {
        playTrainerChordOnce(allNotes);
    }

    // Update the chord notation canvas in the detailed card AND bass clef
    refreshChordNotationCanvas(chordIndex, updatedChord);

    // Sync progressionData changes to notation display
    updateChordAndRenderPreservingTrebleNotes(chordIndex);
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
    saveStateBeforeChange();

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
    const lhNotes = getLHNotes(
        chordData.root,
        chordData.lhType,
        chordData.lhInversion,
        trainerState.currentKey,
        chordData.lhOctaveShift,
        chordData.type,
        getKeyBasedEnharmonic()
    ).filter(n => !chordData.lhOmittedNotes.includes(n));
    const allNotes = voicedNotes.concat(lhNotes);
    if (allNotes.length > 0) {
        playTrainerChordOnce(allNotes);
    }

    // Update the chord notation canvas in the detailed card AND bass clef
    refreshChordNotationCanvas(chordIndex, chordData);

    // Sync progressionData changes to notation display
    updateChordAndRenderPreservingTrebleNotes(chordIndex);
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
    unhighlightAllTensionPoints();
    highlightTensionPointForSelection(index);

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
 * Expand a chord card to detailed view
 * Updates cards in both containers to keep them in sync
 * @param {number} index - Chord index
 */
export function expandChordCard(index) {
    expandedChords.add(index);

    // Hide any floating tooltips that might be visible
    document.querySelectorAll("[id^='inversion-tooltip-']").forEach(el => {
        el.style.display = 'none';
    });

    // Dispatch event for tutorial tracking
    dispatchBuilderEvent('chordCardExpanded', { chordIndex: index });

    // Find wrappers in both containers
    const wrappers = document.querySelectorAll(`.chord-card-wrapper[data-chord-index="${index}"]`);

    wrappers.forEach(wrapper => {
        const trainerState = getTrainerState();
        const chord = trainerState.progressionData[index];
        const key = trainerState.currentKey || 'C';

        // Ensure no-animation class is present and add expanded class for wider width
        wrapper.classList.add('no-animation', 'expanded-card-wrapper');

        // Replace content with detailed view immediately (no delay needed with no-animation class)
        // Use direct imports from ProgressionRenderer
        wrapper.innerHTML = createDetailedCardHTML(chord, index, key);
        attachCardEventListeners(wrapper, index);

        // Render chord notation on the canvas (after DOM is ready)
        requestAnimationFrame(() => {
            const canvas = wrapper.querySelector('.chord-notation-canvas');
            if (canvas) {
                renderChordNotation(chord, key, canvas);

                // Adjust card dimensions based on canvas size
                const dimensions = calculateCanvasDimensions(key, chord.notes);
                const detailedCard = wrapper.querySelector('.detailed-card');
                if (detailedCard) {
                    detailedCard.style.minWidth = `${dimensions.width + 20}px`;
                }
                // Don't set wrapper minWidth - CSS handles it via fit-content

                // Update card shifts after layout is applied
                requestAnimationFrame(() => {
                    updateCardShifts();
                });
            }
        });
    });

    // Update shifts for all cards after layout is applied
    requestAnimationFrame(() => {
        updateCardShifts();
    });
}

/**
 * Collapse a chord card back to simplified view
 * Updates cards in both containers to keep them in sync
 * @param {number} index - Chord index
 */
export function collapseChordCard(index) {
    expandedChords.delete(index);

    // Hide any floating tooltips that might be visible
    document.querySelectorAll("[id^='inversion-tooltip-']").forEach(el => {
        el.style.display = 'none';
    });

    // Find wrappers in both containers
    const wrappers = document.querySelectorAll(`.chord-card-wrapper[data-chord-index="${index}"]`);

    wrappers.forEach(wrapper => {
        const trainerState = getTrainerState();
        const chord = trainerState.progressionData[index];
        const key = trainerState.currentKey || 'C';

        // Ensure no-animation class is present and remove expanded class
        wrapper.classList.add('no-animation');
        wrapper.classList.remove('expanded-card-wrapper');

        // Replace content with simplified view (control bar + card)
        // Use direct imports from ProgressionRenderer
        wrapper.innerHTML = '';
        const simplifiedStructure = createSimplifiedCardStructure(chord, index, key);
        wrapper.appendChild(simplifiedStructure);
        attachCardEventListeners(wrapper, index);

        // Reset wrapper width
        wrapper.style.minWidth = '';

        // Force layout by reading dimensions
        wrapper.getBoundingClientRect();
    });

    // Dispatch event AFTER DOM updates so validation can check DOM state correctly
    dispatchBuilderEvent('chordCardCollapsed', { chordIndex: index });

    // Update shifts for all cards after layout is applied
    requestAnimationFrame(() => {
        updateCardShifts();
    });
}

/**
 * Collapse all expanded chord cards
 * Used for tutorial cleanup and other bulk operations
 */
export function collapseAllChordCards() {
    // Get a copy of the Set since we're modifying it during iteration
    const expandedIndices = [...expandedChords];
    expandedIndices.forEach(index => {
        collapseChordCard(index);
    });

    // Also find any expanded cards in the DOM that might not be in the Set
    // (e.g., if expanded through a different code path)
    document.querySelectorAll('.expanded-card-wrapper').forEach(wrapper => {
        const index = parseInt(wrapper.getAttribute('data-chord-index'));
        if (!isNaN(index) && !expandedIndices.includes(index)) {
            collapseChordCard(index);
        }
    });

    // Clear the expanded set to ensure clean state
    expandedChords.clear();
}

// ============================================================================
// MULTI-SELECT FUNCTIONS
// ============================================================================

/**
 * Handle Ctrl/Cmd+click to toggle a card in multi-selection
 */
export function handleMultiSelectToggle(index) {
    toggleSelection(index);
    updateMultiSelectVisuals();
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
    updateMultiSelectVisuals();
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

    // Dispatch event for tutorial validation
    const totalChords = document.querySelectorAll('.chord-card-wrapper').length;
    console.log('[ProgressionController] Dispatching chordsSelectionChanged:', {
        selectedCount: selectedIndices.length,
        totalChords,
        selectedIndices
    });
    dispatchBuilderEvent('chordsSelectionChanged', {
        selectedCount: selectedIndices.length,
        totalChords,
        selectedIndices
    });
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
 */
export function updateBassSelectionUI() {
    const selectionControls = document.getElementById('bass-selection-controls');
    const selectionCountEl = document.getElementById('bass-selection-count');
    const customPatternsInfo = document.getElementById('custom-bass-patterns-info');

    const selectedCount = getSelectionCount();
    const selectedIndices = getSelectedIndicesArray();

    // Show/hide selection controls
    if (selectionControls) {
        selectionControls.style.display = selectedCount > 0 ? 'flex' : 'none';
    }

    // Update count label
    if (selectionCountEl && selectedCount > 0) {
        selectionCountEl.textContent = `${selectedCount} chord${selectedCount > 1 ? 's' : ''}`;
    }

    // Update custom patterns info
    updateCustomBassPatternInfo();
}

/**
 * Update the info display showing which chords have custom bass patterns
 */
export function updateCustomBassPatternInfo() {
    const infoEl = document.getElementById('custom-bass-patterns-info');
    if (!infoEl) return;

    const compositionState = getCompositionState();
    if (!compositionState || typeof compositionState.getChordsWithCustomBassPatterns !== 'function') {
        infoEl.classList.add('hidden');
        return;
    }

    const customIndices = compositionState.getChordsWithCustomBassPatterns();

    if (customIndices.length === 0) {
        infoEl.classList.add('hidden');
        return;
    }

    // Format the list (1-indexed for user display)
    const chordList = customIndices.map(i => i + 1).join(', ');
    infoEl.textContent = `Custom: ${chordList}`;
    infoEl.classList.remove('hidden');
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

    const compositionState = getCompositionState();
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
    renderProgressionDisplay('melody-progression-visualization', true);

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
    const compositionState = getCompositionState();
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
    renderProgressionDisplay('melody-progression-visualization', true);

    updateMultiSelectVisuals();
}

// ============================================================================
// DATA LOADING/SAVING FUNCTIONS
// ============================================================================

/**
 * Load a progression from the dropdown selector
 * Initializes progression data and scale highlighting
 */
export function loadProgression() {
    const keySelect = document.getElementById('trainer-key-select');
    const progressionSelect = document.getElementById('trainer-progression-select');

    const trainerState = getTrainerState();

    // Stop playback if currently playing - but only if we're not already stopping
    // This prevents infinite recursion when handleAutoPlayback calls loadProgression
    if (trainerState.isPlaying && !trainerState._isStopping) {
        // Set a flag to prevent recursion
        trainerState._isStopping = true;
        handleAutoPlayback();
        trainerState._isStopping = false;
    }

    setCurrentKey(keySelect.value);

    // Automatically set enharmonic preference based on key signature
    // Note: Enharmonic spelling in Composition Studio is now automatically
    // determined by the key via getKeyBasedEnharmonic(), not the global toggle.
    // Chord Lab's toggle remains independent for learning purposes.

    setProgressionRomans(progressionSelect.value.split(','));
    setCurrentIndex(0);
    setIsPlaying(false);

    // Set isReady using the setter function
    setIsReady(true);

    // Get fresh trainerState after setting everything
    const freshTrainerState = getTrainerState();

    // Update window.trainerState immediately so updateKeyboardLabels can use it
    if (typeof window !== 'undefined') {
        window.trainerState = freshTrainerState;
    }


    // Clear any existing card highlights
    document.querySelectorAll('.active-progression-card').forEach(card => card.classList.remove('active-progression-card'));

    // Calculate scale notes using fresh state
    const scaleNotes = calculateScaleNotes(freshTrainerState.currentKey, 4, freshTrainerState.octaveShift);
    setScaleNotes(scaleNotes);

    // Generate progression data using fresh state
    // Check if key is minor
    const currentKey = freshTrainerState.currentKey;
    const isMinorKey = currentKey && currentKey.endsWith('m');

    // Convert Roman numerals to minor case if key is minor
    const convertToMinorCase = (roman) => {
        const minorMap = {
            'I': 'i',
            'ii': 'ii°',
            'iii': 'III',
            'IV': 'iv',
            'V': 'v',
            'vi': 'VI',
            'vii°': 'VII'
        };
        return minorMap[roman] || roman;
    };

    const progressionData = freshTrainerState.progressionRomans.map(roman => {
        // Convert Roman numeral to minor case if key is minor
        const displayRoman = isMinorKey ? convertToMinorCase(roman) : roman;

        // Handle roman numerals with accidental prefixes (bVII, #IV, etc.)
        // Check both ASCII (b, #) and Unicode (♭, ♯) symbols
        let baseRoman = roman;
        if (roman.startsWith('b') || roman.startsWith('♭') || roman.startsWith('#') || roman.startsWith('♯')) {
            baseRoman = roman.substring(1); // Remove accidental prefix
        }

        // Try to find the base roman numeral in the map
        let baseInfo = ROMAN_MAP_BASE[roman] || ROMAN_MAP_BASE[baseRoman];

        // For borrowed chords (with accidental), default quality based on common patterns
        // bVII in rock is typically Major, #IV is typically Major, etc.
        let chordType = 'Major'; // Default for borrowed chords
        if (baseInfo) {
            chordType = baseInfo.quality;
        } else if (baseRoman === 'VII' || baseRoman === 'vii') {
            // VII (without degree) is typically Major when borrowed
            chordType = 'Major';
        }

        // Get key without 'm' suffix for calculation
        const keyForCalculation = isMinorKey ? currentKey.replace(/m$/, '') : currentKey;
        const chordData = getProgressionChordNotes(keyForCalculation, roman, chordType, 0, freshTrainerState.octaveShift);
        if (chordData) {
            // Validate and filter notes to ensure they're all valid strings
            if (chordData.notes && Array.isArray(chordData.notes)) {
                chordData.notes = chordData.notes.filter(note =>
                    note != null && note !== '' && typeof note === 'string' && note !== 'NaN' && !note.includes('undefined') && !note.includes('NaN')
                );
            }
            // Use the converted Roman numeral for display
            chordData.roman = displayRoman;
            // Set default LH settings for newly loaded progressions
            chordData.lhType = 'off';
            chordData.lhInversion = 0;
            chordData.lhOctaveShift = 0;
            chordData.lhOmittedNotes = [];
            chordData.rhythmPattern = 'block';
            chordData.selectionMode = 'chord';
            chordData.omittedNotes = [];
            chordData.octaveShift = 0;
        }
        return chordData;
    }).filter(Boolean); // Remove any nulls if getProgressionChordNotes fails

    setProgressionData(progressionData);

    if (window.updateProgressionControlsUI) {
        window.updateProgressionControlsUI();
    }
    renderProgressionDisplay('melody-progression-visualization', true);
    if (window.highlightTrainer) {
        window.highlightTrainer(scaleNotes, null);
    }

    // Update keyboard labels (function to be imported from UI module)
    // Always update to ensure Roman numerals are shown if enabled
    // This must be called after window.trainerState is updated
    // Use a small delay to ensure state is fully updated
    setTimeout(() => {
        updateKeyboardLabels();
    }, 10);

    // Display key name with proper quality
    const keyDisplayName = freshTrainerState.currentKey;
    const isMinor = keyDisplayName && keyDisplayName.endsWith('m');
    const keyQuality = isMinor ? ' minor' : ' Major';
    const progressionChordNotesDisplay = document.getElementById('progression-chord-notes-display');
    if (progressionChordNotesDisplay) {
        progressionChordNotesDisplay.textContent = 'Ready: ' + keyDisplayName + keyQuality;
    }

    // Update key signature display (function to be imported from UI module)
    if (window.updateKeySignatureDisplay) {
        window.updateKeySignatureDisplay(freshTrainerState.currentKey);
    }

    // Update key signature text (function to be imported from UI module)
    if (window.updateKeySignatureText) {
        window.updateKeySignatureText(freshTrainerState.currentKey);
    }

    // Update unified suggestions (tension score, mood, etc.)
    if (window.updateUnifiedSuggestions) {
        window.updateUnifiedSuggestions();
    }

    // Update "Current Key" display text
    if (window.updateCurrentKeyDisplay) {
        window.updateCurrentKeyDisplay();
    }

    // Sync progression to compositionState first, then refresh notation
    syncProgressionToMelodyComposer();
    refreshNotationFromProgression();

    // Dispatch event for guided lesson mode
    if (isGuidedModeActive()) {
        dispatchBuilderEvent('progressionKeyChanged', {
            key: freshTrainerState.currentKey
        });
    }

    // Update key display in melody tab header
    const melodyCurrentKeyDisplay = document.getElementById('melody-current-key-display');
    if (melodyCurrentKeyDisplay && freshTrainerState.currentKey) {
        melodyCurrentKeyDisplay.textContent = freshTrainerState.currentKey;
    }

    // Update key display in Song Workbench
    const melodyWorkbenchKeyDisplay = document.getElementById('melody-workbench-key-display');
    if (melodyWorkbenchKeyDisplay && freshTrainerState.currentKey) {
        melodyWorkbenchKeyDisplay.textContent = freshTrainerState.currentKey;
    }
}

/**
 * Update enharmonic spellings for all chords in the progression without regenerating chord data
 * Called when the user changes the accidental preference (sharp/flat)
 */
export function updateProgressionEnharmonics() {
    const trainerState = getTrainerState();
    const progressionData = trainerState.progressionData;

    if (!progressionData || progressionData.length === 0) {
        return;
    }

    const enharmonicPref = getKeyBasedEnharmonic();
    const targetNotes = enharmonicPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    const sourceNotes = enharmonicPref === 'sharp' ? FLAT_NOTES : SHARP_NOTES;

    // Helper to convert a note name (without octave) to the target enharmonic
    const convertNoteName = (noteName) => {
        if (!noteName) return noteName;

        // Check if it's already in the target array
        if (targetNotes.includes(noteName)) {
            return noteName;
        }

        // Find in source array and get equivalent from target
        const sourceIndex = sourceNotes.indexOf(noteName);
        if (sourceIndex !== -1) {
            return targetNotes[sourceIndex];
        }

        // Handle special cases like double sharps/flats or unusual spellings
        // Try ALL_NOTES as fallback
        const allNotesIndex = ALL_NOTES.indexOf(noteName);
        if (allNotesIndex !== -1) {
            return targetNotes[allNotesIndex];
        }

        // If not found in any array, check ENHARMONIC_MAP
        if (ENHARMONIC_MAP[noteName]) {
            const mappedNote = ENHARMONIC_MAP[noteName];
            const mappedIndex = sourceNotes.indexOf(mappedNote);
            if (mappedIndex !== -1) {
                return targetNotes[mappedIndex];
            }
            return mappedNote;
        }

        return noteName;
    };

    // Update each chord in the progression
    progressionData.forEach(chord => {
        if (!chord) return;

        // Convert root note
        const oldRoot = chord.root;
        const newRoot = convertNoteName(oldRoot);
        chord.root = newRoot;

        // Convert notes array (notes with octaves)
        if (chord.notes && Array.isArray(chord.notes)) {
            chord.notes = chord.notes.map(noteWithOctave => {
                if (!noteWithOctave || typeof noteWithOctave !== 'string') return noteWithOctave;
                return resolveEnharmonic(noteWithOctave, trainerState.currentKey, enharmonicPref);
            });
        }

        // Update simpleName with new root
        if (chord.simpleName && oldRoot !== newRoot) {
            chord.simpleName = chord.simpleName.replace(new RegExp('^' + escapeRegex(oldRoot)), newRoot);
        }

        // Update name with new root
        if (chord.name && oldRoot !== newRoot) {
            chord.name = chord.name.replace(new RegExp('^' + escapeRegex(oldRoot)), newRoot);
        }

        // Convert lhNotes if present
        if (chord.lhNotes && Array.isArray(chord.lhNotes)) {
            chord.lhNotes = chord.lhNotes.map(noteWithOctave => {
                if (!noteWithOctave || typeof noteWithOctave !== 'string') return noteWithOctave;
                return resolveEnharmonic(noteWithOctave, trainerState.currentKey, enharmonicPref);
            });
        }
    });

    // Update the state with modified data
    setProgressionData(progressionData);

    // Re-render the display
    renderProgressionDisplay('melody-progression-visualization', true);

    // Update keyboard labels
    setTimeout(() => {
        updateKeyboardLabels();
    }, 10);
}

/**
 * Get chord notes for a progression chord
 * @param {string} key - Key signature
 * @param {string} romanNumeral - Roman numeral or note name
 * @param {string} selectedType - Chord type
 * @param {number} selectedInversion - Inversion
 * @param {number} octaveShift - Octave shift
 * @returns {Object|null} Chord data object
 */
export function getProgressionChordNotes(key, romanNumeral, selectedType, selectedInversion, octaveShift = 0) {
    // Guard against null/undefined romanNumeral
    if (!romanNumeral) {
        console.warn('[getProgressionChordNotes] romanNumeral is null or undefined');
        return null;
    }

    // Use key-specific enharmonic preference, not global getCurrentKey()
    // This is critical during transposition when the current key hasn't been updated yet
    const keyEnharmonicPref = getEnharmonicPreferenceForKey(key);

    // Extract just the root note from the key (e.g., "Cm" -> "C", "F# minor" -> "F#")
    const keyRoot = key.replace(/\s*(major|minor|min|m)$/i, '').trim();

    let mapEntry = ROMAN_MAP_BASE[romanNumeral];
    let chordRootNote = '';

    // Handle roman numerals with flat (#) or flat (b) prefixes (e.g., bVII, #IV)
    let accidental = '';
    let baseRoman = romanNumeral;

    // Handle secondary dominants (e.g., V/iii, V/vi, V/V)
    if (romanNumeral.includes('/')) {
        const parts = romanNumeral.split('/');
        const targetRoman = parts[1]; // The chord we're targeting (e.g., 'iii' in 'V/iii')

        // Find the root of the target chord
        const targetEntry = ROMAN_MAP_BASE[targetRoman] || ROMAN_MAP_BASE[targetRoman.replace(/[°7]/g, '')];
        if (targetEntry) {
            let scaleRootIndex = ALL_NOTES.indexOf(keyRoot);
            if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[keyRoot]);

            const targetStep = MAJOR_SCALE_STEPS[targetEntry.index];
            const targetRootIndex = (scaleRootIndex + targetStep) % 12;

            // The secondary dominant is a perfect 5th above the target
            // V/x means the dominant of x, which is 7 semitones above x
            const secondaryDomIndex = (targetRootIndex + 7) % 12;
            chordRootNote = (keyEnharmonicPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[secondaryDomIndex];

            // Return early with the resolved chord
            if (chordRootNote) {
                const chordResult = getInvertedChordNotes(
                    chordRootNote,
                    selectedType,
                    selectedInversion,
                    key,
                    octaveShift,
                    keyEnharmonicPref,
                    getNotationPreference()
                );

                if (chordResult && chordResult.specificNotes) {
                    const validNotes = (chordResult.specificNotes || []).filter(note =>
                        note != null && note !== '' && typeof note === 'string' && note !== 'NaN' && !note.includes('undefined') && !note.includes('NaN')
                    );

                    if (validNotes.length > 0) {
                        return {
                            roman: romanNumeral,
                            name: chordResult.name || 'N/A',
                            simpleName: chordResult.simpleName || 'N/A',
                            notes: validNotes,
                            root: chordRootNote,
                            type: selectedType,
                            inversion: selectedInversion
                        };
                    }
                }
            }
        }
    }

    // Strip chord quality suffixes from roman numeral before lookup (e.g., ii7 -> ii, Imaj7 -> I)
    // This handles cases like ii7, V7, Imaj7, viio7, IVmaj9, Vsus4, vi6, etc.
    const cleanRoman = romanNumeral.replace(
        /maj13|min13|maj11|min11|maj9|min9|maj7|min7|dim7|aug7|add13|add11|add9|sus4|sus2|13|11|9|7|6|°|ø|\+/gi,
        ''
    );

    // Check for flat or sharp prefix (both ASCII and Unicode)
    if (cleanRoman.startsWith('b') || cleanRoman.startsWith('♭')) {
        accidental = 'flat';
        baseRoman = cleanRoman.substring(1); // Remove 'b' or '♭' prefix
    } else if (cleanRoman.startsWith('#') || cleanRoman.startsWith('♯')) {
        accidental = 'sharp';
        baseRoman = cleanRoman.substring(1); // Remove '#' or '♯' prefix
    } else {
        baseRoman = cleanRoman;
    }

    // Try to find the base roman numeral in the map
    mapEntry = ROMAN_MAP_BASE[baseRoman];

    // If the roman numeral isn't standard (e.g., it's a note name like 'Db'),
    // we handle it as a non-diatonic chord.
    if (!mapEntry) {
        // If it has an accidental prefix, it's likely a borrowed chord - try to parse it
        if (accidental && baseRoman) {
            // Try common roman numeral patterns
            const romanToIndex = {
                'I': 0, 'II': 1, 'III': 2, 'IV': 3, 'V': 4, 'VI': 5, 'VII': 6,
                'i': 0, 'ii': 1, 'iii': 2, 'iv': 3, 'v': 4, 'vi': 5, 'vii': 6
            };

            // Handle 'VII' without the degree symbol
            const baseForLookup = baseRoman.replace('°', '').replace('°', '');
            const scaleDegreeIndex = romanToIndex[baseForLookup];

            if (scaleDegreeIndex !== undefined) {
                let scaleRootIndex = ALL_NOTES.indexOf(keyRoot);
                if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[keyRoot]);

                // Get the diatonic scale step
                const scaleStep = MAJOR_SCALE_STEPS[scaleDegreeIndex];
                let chordRootIndex = (scaleRootIndex + scaleStep) % 12;

                // Apply accidental (flat lowers by 1 semitone, sharp raises by 1 semitone)
                if (accidental === 'flat') {
                    chordRootIndex = (chordRootIndex - 1 + 12) % 12;
                } else if (accidental === 'sharp') {
                    chordRootIndex = (chordRootIndex + 1) % 12;
                }

                chordRootNote = (keyEnharmonicPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[chordRootIndex];
            } else {
                chordRootNote = cleanRoman; // Fall back to treating as note name (use cleaned version)
            }
        } else {
            chordRootNote = cleanRoman; // The 'romanNumeral' is actually the root note (use cleaned version)
        }
    } else {
        let scaleRootIndex = ALL_NOTES.indexOf(keyRoot);
        if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[keyRoot]);

        const scaleStep = MAJOR_SCALE_STEPS[mapEntry.index];
        let chordRootIndex = (scaleRootIndex + scaleStep) % 12;

        // Apply accidental if present
        if (accidental === 'flat') {
            chordRootIndex = (chordRootIndex - 1 + 12) % 12;
        } else if (accidental === 'sharp') {
            chordRootIndex = (chordRootIndex + 1) % 12;
        }

        chordRootNote = (keyEnharmonicPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[chordRootIndex];
    }

    if (!chordRootNote) {
        return null; // Could not determine root note
    }

    const chordResult = getInvertedChordNotes(
        chordRootNote,
        selectedType,
        selectedInversion,
        key,
        octaveShift,
        keyEnharmonicPref,
        getNotationPreference()
    );

    // Validate chordResult
    if (!chordResult || !chordResult.specificNotes) {
        return null;
    }

    // Validate and filter notes to ensure they're all valid strings
    const validNotes = (chordResult.specificNotes || []).filter(note =>
        note != null && note !== '' && typeof note === 'string' && note !== 'NaN' && !note.includes('undefined') && !note.includes('NaN')
    );

    // If no valid notes, return null
    if (validNotes.length === 0) {
        return null;
    }

    return {
        roman: romanNumeral,
        name: chordResult.name || 'N/A',
        simpleName: chordResult.simpleName || 'N/A',
        notes: validNotes,
        root: chordRootNote,
        type: selectedType,
        inversion: selectedInversion
    };
}

// ============================================================================
// KEY & TRANSPOSITION FUNCTIONS
// ============================================================================

/**
 * Repopulate the key dropdown based on enharmonic preference
 * @param {string} enharmonicPref - 'sharp' or 'flat'
 */
function repopulateKeyDropdown(enharmonicPref) {
    const keySelect = document.getElementById('trainer-key-select');
    if (!keySelect) return;

    const notes = enharmonicPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    keySelect.innerHTML = '';

    // Add major keys
    notes.forEach((note) => {
        const option = document.createElement('option');
        option.value = note;
        option.textContent = `${note} Major`;
        keySelect.appendChild(option);
    });

    // Add minor keys
    notes.forEach((note) => {
        const option = document.createElement('option');
        option.value = `${note}m`;
        option.textContent = `${note} minor`;
        keySelect.appendChild(option);
    });
}

/**
 * Set the key dropdown value, repopulating the dropdown if needed to match the key's enharmonic spelling.
 * This solves the chicken-and-egg problem where the dropdown might be populated with sharps
 * but the key being set uses flats (e.g., "Bb").
 * @param {string} targetKey - The key to set (e.g., "Bb", "F#m", "C")
 * @param {boolean} triggerLoad - Whether to trigger loadProgression after setting (default: false)
 */
export function setKeyDropdownValue(targetKey, triggerLoad = false) {
    const keySelect = document.getElementById('trainer-key-select');
    if (!keySelect || !targetKey) return;

    // Determine what enharmonic preference this key needs
    const targetEnharmonic = getEnharmonicPreferenceForKey(targetKey);

    // Check if the dropdown currently has this key as an option
    const hasOption = Array.from(keySelect.options).some(opt => opt.value === targetKey);

    // If the key isn't in the dropdown, repopulate with the correct note set
    if (!hasOption) {
        repopulateKeyDropdown(targetEnharmonic);
    }

    // Now set the value
    keySelect.value = targetKey;

    // Update trainerState
    setCurrentKey(targetKey);

    // Optionally trigger load
    if (triggerLoad && window.loadProgression) {
        window.loadProgression();
    }
}

/**
 * Transpose all chords in the progression to a new key.
 * Keeps Roman numerals the same but changes chord roots and notes.
 * Also adjusts chord quality when transposing between major and minor modes.
 * Example: I in C Major (C major) → I in G Major (G major)
 * Example: I in E Major (E major) → i in E minor (E minor)
 * @param {string} oldKey - Original key (e.g., "C", "Am")
 * @param {string} newKey - Target key (e.g., "G", "Em")
 */
export function transposeProgression(oldKey, newKey) {
    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) return;

    // Determine if keys are major or minor
    const oldIsMinor = oldKey.endsWith('m');
    const newIsMinor = newKey.endsWith('m');
    const modeChanged = oldIsMinor !== newIsMinor;

    // Extract root notes from key strings (remove "m" suffix for minor keys)
    const oldKeyRoot = oldKey.replace(/m$/, '');
    const newKeyRoot = newKey.replace(/m$/, '');

    // Find key indices - first try directly in ALL_NOTES, then use enharmonic equivalent
    let oldIndex = ALL_NOTES.indexOf(oldKeyRoot);
    if (oldIndex === -1) {
        const enharmonicOld = ENHARMONIC_MAP[oldKeyRoot];
        if (enharmonicOld) oldIndex = ALL_NOTES.indexOf(enharmonicOld);
    }

    let newIndex = ALL_NOTES.indexOf(newKeyRoot);
    if (newIndex === -1) {
        const enharmonicNew = ENHARMONIC_MAP[newKeyRoot];
        if (enharmonicNew) newIndex = ALL_NOTES.indexOf(enharmonicNew);
    }

    if (oldIndex === -1 || newIndex === -1) {
        console.warn('[transposeProgression] Could not find key indices:', oldKeyRoot, newKeyRoot);
        return;
    }

    // Calculate semitone shift
    const semitones = (newIndex - oldIndex + 12) % 12;

    // If same root AND same mode, nothing to do
    if (semitones === 0 && !modeChanged) return;

    // Determine enharmonic preference for the new key
    const enharmonicPref = getEnharmonicPreferenceForKey(newKey);
    const noteArray = enharmonicPref === 'flat' ? FLAT_NOTES : SHARP_NOTES;

    console.log(`[transposeProgression] Transposing from ${oldKey} to ${newKey} (${semitones} semitones, mode changed: ${modeChanged}, ${enharmonicPref} spelling)`);

    // Diatonic chord qualities by scale degree (1-7)
    // Major key: I=Major, ii=Minor, iii=Minor, IV=Major, V=Major, vi=Minor, vii°=Diminished
    // Minor key: i=Minor, ii°=Diminished, III=Major, iv=Minor, v=Minor, VI=Major, VII=Major
    const majorKeyQualities = {
        1: 'Major', 2: 'Minor', 3: 'Minor', 4: 'Major', 5: 'Major', 6: 'Minor', 7: 'Diminished'
    };
    const minorKeyQualities = {
        1: 'Minor', 2: 'Diminished', 3: 'Major', 4: 'Minor', 5: 'Minor', 6: 'Major', 7: 'Major'
    };

    // Transpose each chord
    progressionData.forEach((chord, index) => {
        console.log(`[transposeProgression] Processing chord ${index}:`, {
            root: chord.root,
            type: chord.type,
            roman: chord.roman,
            simpleName: chord.simpleName,
            name: chord.name
        });

        if (!chord.root) {
            console.warn(`[transposeProgression] Chord ${index} has no root, skipping`);
            return;
        }

        // Save original values for logging
        const originalRoot = chord.root;
        const originalType = chord.type;

        // Get current root index
        // First try to find the root directly in ALL_NOTES (which uses sharps)
        // Only use ENHARMONIC_MAP if not found (for flat notes like Db, Eb, Gb, Ab, Bb)
        let rootIndex = ALL_NOTES.indexOf(chord.root);
        if (rootIndex === -1) {
            // Root not found directly - try enharmonic equivalent
            const enharmonicRoot = ENHARMONIC_MAP[chord.root];
            if (enharmonicRoot) {
                rootIndex = ALL_NOTES.indexOf(enharmonicRoot);
            }
        }
        if (rootIndex === -1) {
            console.warn(`[transposeProgression] Could not find root index for chord ${index}:`, chord.root);
            return;
        }

        // Calculate new root
        const newRootIndex = (rootIndex + semitones) % 12;
        const newRoot = noteArray[newRootIndex];

        // Determine if we need to change chord quality due to mode change
        let newType = chord.type;
        if (modeChanged && chord.roman) {
            // Extract the scale degree from the Roman numeral
            const romanClean = chord.roman.replace(/[^IViv]/g, '').toUpperCase();
            const degreeMap = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7 };
            const degree = degreeMap[romanClean];

            if (degree) {
                const targetQualities = newIsMinor ? minorKeyQualities : majorKeyQualities;
                const expectedQuality = targetQualities[degree];

                // Only change basic triads (Major ↔ Minor ↔ Diminished)
                // Don't change extended chords (7ths, 9ths, etc.) - just their base quality
                const basicTriads = ['Major', 'Minor', 'Diminished', 'Augmented'];

                if (basicTriads.includes(chord.type)) {
                    // Simple triad - just change the quality
                    newType = expectedQuality;
                    console.log(`[transposeProgression] Mode change: ${chord.type} → ${newType} for degree ${degree}`);
                } else if (chord.type.includes('7') || chord.type.includes('9') || chord.type.includes('11') || chord.type.includes('13')) {
                    // Extended chord - try to update the base quality
                    // e.g., "Major 7th" → "Minor 7th", "Dominant 7th" stays as is (V7 is common in minor)
                    if (chord.type === 'Major 7th' && expectedQuality === 'Minor') {
                        newType = 'Minor 7th';
                    } else if (chord.type === 'Minor 7th' && expectedQuality === 'Major') {
                        newType = 'Major 7th';
                    } else if (chord.type === 'Minor 7th' && expectedQuality === 'Diminished') {
                        newType = 'Half-Diminished 7th';
                    }
                    // Keep Dominant 7th as is - it's used in both modes
                    console.log(`[transposeProgression] Extended chord mode change: ${chord.type} → ${newType} for degree ${degree}`);
                }
            }
        }

        // Update Roman numeral case to match new mode
        let newRoman = chord.roman;
        if (modeChanged && chord.roman) {
            // Update case: Major chords = uppercase, Minor/Dim chords = lowercase
            const isNewChordMajor = newType === 'Major' || newType === 'Major 7th' || newType === 'Dominant 7th' || newType === 'Augmented';
            const romanBase = chord.roman.replace(/[^IViv]/g, '');
            const romanSuffix = chord.roman.replace(/[IViv]/g, '');

            if (isNewChordMajor) {
                newRoman = romanBase.toUpperCase() + romanSuffix;
            } else {
                newRoman = romanBase.toLowerCase() + romanSuffix;
            }
        }

        // Update chord data
        chord.root = newRoot;
        chord.type = newType;
        chord.roman = newRoman;
        chord.name = `${newRoot} ${newType}`;
        chord.simpleName = newRoot;

        // Regenerate chord notes using existing helper
        // Try getProgressionChordNotes first (requires roman numeral)
        let chordNotesData = null;
        if (newRoman) {
            chordNotesData = getProgressionChordNotes(
                newKey,
                newRoman,
                newType,
                chord.inversion || 0,
                chord.octaveShift || 0
            );
        }

        if (chordNotesData && chordNotesData.notes) {
            chord.notes = chordNotesData.notes;
        } else {
            // Fallback: use getInvertedChordNotes directly when roman numeral is missing
            // This handles community progressions that may not have roman numerals
            const fallbackResult = getInvertedChordNotes(
                newRoot,
                newType,
                chord.inversion || 0,
                newKey,
                chord.octaveShift || 0,
                enharmonicPref,
                'full'
            );
            if (fallbackResult && fallbackResult.specificNotes) {
                chord.notes = fallbackResult.specificNotes;
            }
        }

        // Also update left-hand notes if present
        if (chord.lhType && chord.lhType !== 'off') {
            const lhNotesData = getLHNotes(
                newRoot,
                chord.lhType,
                chord.lhInversion || 0,
                newKey,
                chord.lhOctaveShift || 0,
                newType,
                getKeyBasedEnharmonic()
            );
            if (lhNotesData) {
                chord.lhNotes = lhNotesData;
            }
        }

    });

    // Update the progression data
    setProgressionData([...progressionData]);
}

/**
 * Update Roman numerals for all chords to reflect a new key.
 * Keeps chord notes the same but recalculates Roman numerals.
 * Example: C major (I in C) → C major (IV in G)
 * @param {string} newKey - The new key to analyze chords against
 */
export function updateRomanNumerals(newKey) {
    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) return;

    console.log(`[updateRomanNumerals] Updating Roman numerals for key: ${newKey}`);

    // Recalculate Roman numeral for each chord
    progressionData.forEach((chord, index) => {
        if (!chord.root) return;

        // Use noteToRomanNumeral to calculate the new Roman numeral
        const newRoman = noteToRomanNumeral(chord.root, newKey, chord.type);

        if (newRoman) {
            console.log(`[updateRomanNumerals] Chord ${index}: ${chord.root} ${chord.type} - ${chord.roman} → ${newRoman}`);
            chord.roman = newRoman;
        } else {
            console.warn(`[updateRomanNumerals] Could not calculate Roman numeral for chord ${index}:`, chord.root, chord.type);
        }
    });

    // Update the progression data
    setProgressionData([...progressionData]);
}

// ============================================================================
// RECORDING FUNCTIONS
// ============================================================================

/**
 * Toggle recording mode
 */
export function toggleRecording() {
    const trainerState = getTrainerState();
    const isRecording = !trainerState.isRecording;
    setIsRecording(isRecording);

    const recordBtn = document.getElementById('record-progression-btn');
    const recordText = document.getElementById('record-text');
    const recordIcon = document.getElementById('record-icon');
    const saveBtn = document.getElementById('save-recording-btn');

    if (isRecording) {
        // Start recording
        setRecordedProgression([]);
        setProgressionData([]);
        setProgressionRomans([]);

        renderProgressionDisplay('melody-progression-visualization', true);

        recordText.textContent = 'Stop';
        recordBtn.classList.add('animate-pulse');
        recordIcon.innerHTML = '<rect x="7" y="7" width="6" height="6"></rect>'; // Square icon
        saveBtn.disabled = true;

        showToast("Recording started. Play chords on the keyboard.", { type: 'info' });
    } else {
        // Stop recording
        recordText.textContent = 'Record';
        recordBtn.classList.remove('animate-pulse');
        recordIcon.innerHTML = '<circle cx="10" cy="10" r="7"></circle>'; // Circle icon
        saveBtn.disabled = trainerState.recordedProgression.length === 0;

        if (trainerState.recordedProgression.length > 0) {
            showToast("Recording stopped. Press 'Save' to keep it.", { type: 'info' });
        }
    }
}

/**
 * Save the recorded progression
 */
export function saveRecording() {
    document.getElementById('save-recording-btn').disabled = true;
    showToast("Progression saved!", { type: 'success' });
    // The progression is already in trainerState.progressionData, so we just need to finalize it
}

// ============================================================================
// HISTORY & UNDO/REDO FUNCTIONS
// ============================================================================

/**
 * Capture progression state snapshot
 */
export function captureProgressionState() {
    const trainerState = getTrainerState();
    const state = {
        progressionData: JSON.parse(JSON.stringify(trainerState.progressionData)),
        progressionRomans: [...trainerState.progressionRomans],
        currentKey: trainerState.currentKey
    };

    // Capture notation state from CompositionState
    const compositionState = getCompositionState();
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
        // Capture tempo markings, repeat signs, and hairpins (stored separately from measures)
        if (compositionState.tempoMarkings) {
            state.tempoMarkings = [...compositionState.tempoMarkings];
        }
        if (compositionState.repeatSigns) {
            state.repeatSigns = [...compositionState.repeatSigns];
        }
        if (compositionState.hairpins) {
            state.hairpins = [...compositionState.hairpins];
        }
    }

    return state;
}

/**
 * Update progression control UI buttons (play/step)
 * Updates button states and styling based on playback state
 */
export function updateProgressionControlsUI() {
    // Always get fresh state to ensure accuracy
    const trainerState = getTrainerState();
    // Also check window.trainerState for consistency
    const isPlaying = trainerState.isPlaying || (window.trainerState && window.trainerState.isPlaying);
    const isReady = trainerState.isReady;

    const playBtn = document.getElementById('play-progression-btn');
    const stepBtn = document.getElementById('step-chord-btn');

    if (!stepBtn || !playBtn) return;

    // Update Step button - disabled when not ready OR when playing
    stepBtn.disabled = !isReady || isPlaying;

    // Always use pointer cursor - remove any cursor-not-allowed classes
    stepBtn.classList.remove('cursor-not-allowed');
    stepBtn.classList.add('cursor-pointer');

    const playText = document.getElementById('play-text');
    if (isPlaying) {
        if (playText) playText.textContent = 'Stop';
        playBtn.classList.remove('bg-teal-600', 'hover:bg-teal-700');
        playBtn.classList.add('bg-red-600', 'hover:bg-red-700');
    } else {
        if (playText) playText.textContent = 'Auto Play';
        playBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        playBtn.classList.add('bg-teal-600', 'hover:bg-teal-700');
    }
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
    const compositionState = getCompositionState();
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
        // Restore tempo markings and repeat signs
        if (state.tempoMarkings) {
            compositionState.tempoMarkings = [...state.tempoMarkings];
        }
        if (state.repeatSigns) {
            compositionState.repeatSigns = [...state.repeatSigns];
        }
        if (state.hairpins) {
            compositionState.hairpins = [...state.hairpins];
        }
        compositionState.events.emit('loaded', { measures: compositionState.measures });
    }

    // TODO: Extract remaining implementation
}

/**
 * Handle undo action
 */
export function handleUndo() {
    if (!canUndo()) return;

    // Save current state to redo stack before undoing
    const currentState = captureProgressionState();
    pushToRedoStack(currentState);

    // Get previous state
    const previousState = undoHistory();

    // Restore previous state
    if (previousState) {
        restoreProgressionState(previousState);

        // Re-render progression display in both tabs
        renderProgressionDisplay('melody-progression-visualization', true);

        // Re-render VexFlow notation from the restored compositionState.measures
        // IMPORTANT: Do NOT call syncProgressionToMelodyComposer() here!
        // That would overwrite the restored notation data with a fresh sync from progressionData,
        // losing the specific note edits (duration, accidentals, etc.) we just restored.
        const notationComposerForRender = getNotationComposer();
        if (notationComposerForRender && typeof notationComposerForRender.render === 'function') {
            notationComposerForRender.render(true);
        }

        // Refresh chord recommendations and analysis (includes borrowed chords)
        if (window.recommendationService) {
            window.recommendationService.refreshRecommendations();
        }

        // Refresh melody suggestions if controller is initialized
        if (window.melodySuggestionController &&
            typeof window.melodySuggestionController.refreshSuggestions === 'function') {
            window.melodySuggestionController.refreshSuggestions();
        }

        // Show feedback
        const display = document.getElementById('progression-chord-notes-display');
        if (display) {
            display.textContent = 'Undo: Restored previous state';
        }

        // Update undo/redo button states
        updateUndoRedoButtons();
    }
}

/**
 * Handle redo action
 */
export function handleRedo() {
    if (!canRedo()) return;

    // Save current state to undo stack before redoing
    const currentState = captureProgressionState();
    pushToUndoStack(currentState);

    // Get next state
    const nextState = redoHistory();

    // Restore next state
    if (nextState) {
        restoreProgressionState(nextState);

        // Re-render progression display in both tabs
        renderProgressionDisplay('melody-progression-visualization', true);

        // Re-render VexFlow notation from the restored compositionState.measures
        // IMPORTANT: Do NOT call syncProgressionToMelodyComposer() here!
        // That would overwrite the restored notation data with a fresh sync from progressionData,
        // losing the specific note edits (duration, accidentals, etc.) we just restored.
        const notationComposerForRender = getNotationComposer();
        if (notationComposerForRender && typeof notationComposerForRender.render === 'function') {
            notationComposerForRender.render(true);
        }

        // Refresh chord recommendations and analysis (includes borrowed chords)
        if (window.recommendationService) {
            window.recommendationService.refreshRecommendations();
        }

        // Refresh melody suggestions if controller is initialized
        if (window.melodySuggestionController &&
            typeof window.melodySuggestionController.refreshSuggestions === 'function') {
            window.melodySuggestionController.refreshSuggestions();
        }

        // Show feedback
        const display = document.getElementById('progression-chord-notes-display');
        if (display) {
            display.textContent = 'Redo: Restored next state';
        }

        // Update undo/redo button states
        updateUndoRedoButtons();
    }
}

/**
 * Save current state before making changes
 * Call this before any edit operation to enable undo support
 */
export function saveStateBeforeChange() {
    const currentState = captureProgressionState();
    saveState(currentState);

    // Mark composition as dirty for auto-save
    // This triggers the debounced auto-save mechanism
    try {
        markAutoSaveDirty();
    } catch (e) {
        // Auto-save may not be initialized yet, ignore
    }
}

// ============================================================================
// PANEL TOGGLE FUNCTIONS
// ============================================================================

/**
 * Toggle progression controls panel
 */
export function toggleProgressionControlsPanel(event = null) {
    if (isGuidedModeActive()) return;

    // If event is provided, check if click was in the right 25% zone (collapse zone)
    if (event && event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        const clickX = event.clientX;
        const rightZoneStart = rect.right - (rect.width * 0.25);

        // If click was NOT in the right zone, don't toggle (unless clicking chevron)
        const clickedChevron = event.target.closest('[id$="-chevron"]') ||
                               event.target.closest('.chevron-icon') ||
                               event.target.closest('svg[class*="rotate"]');

        if (clickX < rightZoneStart && !clickedChevron) {
            return;
        }
    }

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

    savePanelState('progression-controls-panel', !isHidden);
}

/**
 * Toggle progression cards panel
 */
export function toggleProgressionCardsPanel(event = null) {
    if (isGuidedModeActive()) return;

    // If event is provided, check if click was in the right 25% zone (collapse zone)
    if (event && event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        const clickX = event.clientX;
        const rightZoneStart = rect.right - (rect.width * 0.25);

        // If click was NOT in the right zone, don't toggle (unless clicking chevron)
        const clickedChevron = event.target.closest('[id$="-chevron"]') ||
                               event.target.closest('.chevron-icon') ||
                               event.target.closest('svg[class*="rotate"]');

        if (clickX < rightZoneStart && !clickedChevron) {
            return;
        }
    }

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

    savePanelState('progression-visualization-panel', !isHidden);
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
// KEYBOARD HIGHLIGHTING
// ============================================================================

/**
 * Highlights piano keys for scale and chord notes
 * Used for visual feedback during chord playback
 */
export function highlightTrainer(scaleNotes, chordNotes) {
    // Clear highlights (function to be imported from UI module)
    clearHighlights();

    // Check if keyboard is visible (exists in DOM)
    const keyboardEl = document.getElementById('piano-keyboard');
    if (!keyboardEl) return;

    // Highlight scale notes if on trainer tab and scaleNotes provided
    if (getCurrentTab() === 'trainer' && scaleNotes) {
        scaleNotes.forEach(note => {
            const keyId = getNoteKeyId(note);
            const keyElement = document.getElementById(keyId);
            if (keyElement) keyElement.classList.add('active-scale');
        });
    }

    // Always highlight chord notes when playing (regardless of tab)
    if (chordNotes) {
        chordNotes.forEach(note => {
            const keyId = getNoteKeyId(note);
            const keyElement = document.getElementById(keyId);
            if (keyElement) keyElement.classList.add('active-progression');
        });
    }
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
    window.updateMultiSelectVisuals = updateMultiSelectVisuals;
    window.updateBassSelectionUI = updateBassSelectionUI;
    window.updateCustomBassPatternInfo = updateCustomBassPatternInfo;

    // Copy/paste
    window.copySelectedChords = () => copySelectedChords(getSelectedIndicesArray());
    window.pasteChords = pasteChords;
    window.duplicateSelectedChords = () => duplicateSelectedChords(getSelectedIndicesArray());
    window.deleteSelectedChords = () => deleteSelectedChords(getSelectedIndicesArray());

    // Chord operations
    window.addChordToProgressionByParams = addChordToProgressionByParams;
    // Note: addChordToSection is exported from ProgressionModals.js and assigned to window in index.js

    // Transposition
    window.transposeProgression = transposeProgression;
    window.updateRomanNumerals = updateRomanNumerals;
    window.transposeTreble = transposeTreble;
    window.transposeTrebleWithModeAdjust = transposeTrebleWithModeAdjust;
    window.setKeyDropdownValue = setKeyDropdownValue;
}
