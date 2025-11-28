/**
 * Melody Suggestion Controller
 * Phase 4.1: Integration between Melody Suggestion Engine and Composition State
 *
 * Handles the workflow of:
 * - Listening for context changes (measure selection, chord changes)
 * - Generating and updating suggestions
 * - Inserting selected notes into the composition
 * - Previewing notes with audio
 */

import { generateMelodySuggestions, getQuickSuggestions } from './melodySuggestion.js';
import {
    initMelodySuggestionPanel,
    updateSuggestions,
    onNoteSelected,
    onNotePreview,
    clearSuggestions
} from '../ui/melodySuggestionPanel.js';
import { getCompositionState } from '../state/compositionState.js';
import { getPiano, getAudioIsReady } from '../audio/audioEngine.js';
import { getChordContext } from './chordTimeline.js';

// -----------------------------------------------------------------------------
// Controller State
// -----------------------------------------------------------------------------

let compositionState = null;
let currentMeasureIndex = 0;
let currentStyleId = 'any';
let currentContourId = 'any';
let targetOctave = 4;
let isInitialized = false;

// Selected note tracking for context-aware suggestions
let selectedNoteInfo = null; // { measureIndex, noteIndex, note, isLastNote }

/**
 * Convert Tone.js duration to beats (quarter notes)
 * @param {string} duration - Duration string (e.g., '4n', '8n', '2n')
 * @returns {number} Number of beats
 */
function getDurationInBeats(duration) {
    const durationMap = {
        '1n': 4,      // whole note
        '2n': 2,      // half note
        '4n': 1,      // quarter note
        '8n': 0.5,    // eighth note
        '16n': 0.25,  // sixteenth note
        '2n.': 3,     // dotted half
        '4n.': 1.5,   // dotted quarter
        '8n.': 0.75   // dotted eighth
    };
    return durationMap[duration] || 1;
}

// -----------------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------------

/**
 * Initialize the melody suggestion controller
 * @param {object} options - Configuration options
 */
export function initMelodySuggestionController(options = {}) {
    // Get composition state
    compositionState = getCompositionState();
    if (!compositionState) {
        return false;
    }

    // Apply options
    currentStyleId = options.styleId || 'any';
    currentContourId = options.contourId || 'any';
    targetOctave = options.octave || 4;

    // Initialize UI panel
    initMelodySuggestionPanel();

    // Set up callbacks
    onNoteSelected(handleNoteSelected);
    onNotePreview(handleNotePreview);

    // Listen to composition state events
    setupEventListeners();

    isInitialized = true;

    // Initial refresh with delay to ensure progression data is available
    setTimeout(() => {
        if (compositionState && compositionState.getMeasureCount() > 0) {
            refreshSuggestions();
        }
    }, 100);

    return true;
}

/**
 * Set up event listeners for composition state changes
 */
function setupEventListeners() {
    if (!compositionState) return;

    // Listen for chord changes to update suggestions
    compositionState.events.on('chordChanged', (measureIndex, newChord, previousChord) => {
        if (measureIndex === currentMeasureIndex) {
            refreshSuggestions();
        }
    });

    // Listen for cursor changes (measure selection)
    compositionState.events.on('cursorMoved', (newCursor) => {
        if (newCursor.measure !== currentMeasureIndex) {
            currentMeasureIndex = newCursor.measure;
            refreshSuggestions();
        }
    });

    // Listen for note additions to update previous note context
    compositionState.events.on('noteAdded', (measureIndex, staff, voiceIndex, note) => {
        if (staff === 'treble' && measureIndex === currentMeasureIndex) {
            // Refresh suggestions with new previous note context
            refreshSuggestions();
        }
    });

    // Listen for progression imports
    compositionState.events.on('progressionImported', () => {
        refreshSuggestions();
    });

    // Listen for style changes from the floating panel dropdown
    // Use a small delay to ensure the floating panel DOM is ready
    const setupStyleListener = () => {
        const styleSelect = document.getElementById('floating-melody-style-select');
        if (styleSelect) {
            console.log('✅ Floating melody style dropdown found, attaching event listener');
            styleSelect.addEventListener('change', (e) => {
                setStyle(e.target.value);
            });
            return true;
        }
        return false;
    };

    // Try immediately
    if (!setupStyleListener()) {
        // If not found, try again after a delay (for floating panel initialization)
        setTimeout(() => {
            if (!setupStyleListener()) {
                console.warn('⚠️ Floating melody style dropdown not found after delay');
            }
        }, 500);
    }
}


// -----------------------------------------------------------------------------
// Suggestion Generation
// -----------------------------------------------------------------------------

/**
 * Refresh suggestions based on current context and selected note
 */
export function refreshSuggestions() {
    if (!compositionState) return;

    // Update selected note info using enhanced controller's function if available
    updateSelectedNoteInfo();

    // Use selected note's measure if available, otherwise current measure
    const contextMeasureIndex = selectedNoteInfo ? selectedNoteInfo.measureIndex : currentMeasureIndex;
    const measure = compositionState.getMeasure(contextMeasureIndex);
    if (!measure) {
        clearSuggestions();
        return;
    }

    // Get current context
    const chord = measure.chord;
    const key = compositionState.metadata.key;

    // Get chord context including next chord for anticipation
    const noteIndex = selectedNoteInfo ? selectedNoteInfo.noteIndex : 0;
    const chordContext = getChordContext(contextMeasureIndex, noteIndex);
    const nextChord = chordContext?.nextChord || null;
    const anticipationFactor = chordContext?.anticipationFactor || 0;

    // Get the reference note (selected note or last note)
    let previousNote = null;
    let recentNotes = [];

    if (selectedNoteInfo && selectedNoteInfo.note) {
        // Use the selected note as the reference for voice leading
        previousNote = selectedNoteInfo.note.pitch || selectedNoteInfo.note.pitches?.[0];

        // Collect notes UP TO AND INCLUDING the selected note (not after)
        const measureCount = compositionState.getMeasureCount();
        for (let i = 0; i <= selectedNoteInfo.measureIndex && recentNotes.length < 20; i++) {
            const measureNotes = compositionState.getNotes(i, 'treble', 0);
            const maxNoteIndex = (i === selectedNoteInfo.measureIndex)
                ? selectedNoteInfo.noteIndex + 1  // Include selected note
                : measureNotes.length;

            for (let j = 0; j < maxNoteIndex && recentNotes.length < 20; j++) {
                if (measureNotes[j].pitch) {
                    recentNotes.push(measureNotes[j].pitch);
                }
            }
        }
        // Reverse so most recent is first
        recentNotes = recentNotes.reverse();
    } else {
        // Fallback: use last note in current measure
        const trebleNotes = compositionState.getNotes(contextMeasureIndex, 'treble', 0);
        previousNote = trebleNotes.length > 0
            ? trebleNotes[trebleNotes.length - 1].pitch
            : null;

        // If no previous note in current measure, check previous measure
        if (!previousNote && contextMeasureIndex > 0) {
            const prevMeasureNotes = compositionState.getNotes(contextMeasureIndex - 1, 'treble', 0);
            if (prevMeasureNotes.length > 0) {
                previousNote = prevMeasureNotes[prevMeasureNotes.length - 1].pitch;
            }
        }

        // Collect all notes (old behavior for fallback)
        const measureCount = compositionState.getMeasureCount();
        for (let i = measureCount - 1; i >= 0 && recentNotes.length < 20; i--) {
            const measureNotes = compositionState.getNotes(i, 'treble', 0);
            for (let j = measureNotes.length - 1; j >= 0 && recentNotes.length < 20; j--) {
                if (measureNotes[j].pitch) {
                    recentNotes.push(measureNotes[j].pitch);
                }
            }
        }
    }

    // Generate and display suggestions
    updateSuggestions({
        chord: chord.root ? chord : { root: 'C', type: 'Major' },
        key,
        previousNote: previousNote,
        styleId: currentStyleId,
        contourId: currentContourId,
        octave: targetOctave,
        recentNotes: recentNotes,
        selectedNoteInfo: selectedNoteInfo,  // Pass to panel for context display
        nextChord: nextChord,
        anticipationFactor: anticipationFactor
    });
}

/**
 * Update selected note info from noteEditor
 */
function updateSelectedNoteInfo() {
    const notationComposer = window.getNotationComposer && window.getNotationComposer();
    const noteEditor = notationComposer?.noteEditor;

    if (!compositionState) {
        selectedNoteInfo = null;
        return;
    }

    // Check if there's a selected note in the note editor
    if (noteEditor && noteEditor.selectedNotes && noteEditor.selectedNotes.size > 0) {
        const noteIds = Array.from(noteEditor.selectedNotes);
        // Find the last selected treble note
        for (let i = noteIds.length - 1; i >= 0; i--) {
            const parts = noteIds[i].split('-');
            if (parts.length >= 3 && parts[1] === 'treble') {
                const measureIndex = parseInt(parts[0]);
                const noteIndex = parseInt(parts[2]);

                const measure = compositionState.measures[measureIndex];
                const trebleNotes = measure?.notation?.treble?.voices?.[0]?.notes || [];
                const note = trebleNotes[noteIndex];

                // Count total notes
                let totalNotes = 0;
                const measureCount = compositionState.getMeasureCount();
                for (let m = 0; m < measureCount; m++) {
                    const mNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes || [];
                    totalNotes += mNotes.length;
                }

                // Calculate absolute position
                let absolutePosition = 0;
                for (let m = 0; m < measureIndex; m++) {
                    const mNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes || [];
                    absolutePosition += mNotes.length;
                }
                absolutePosition += noteIndex;

                selectedNoteInfo = {
                    measureIndex,
                    noteIndex,
                    note,
                    isLastNote: absolutePosition === totalNotes - 1,
                    totalNotes,
                    absolutePosition
                };
                return;
            }
        }
    }

    // No treble selection - find the last note
    const measureCount = compositionState.getMeasureCount();
    for (let m = measureCount - 1; m >= 0; m--) {
        const trebleNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes || [];
        if (trebleNotes.length > 0) {
            let totalNotes = 0;
            for (let i = 0; i < measureCount; i++) {
                const mNotes = compositionState.measures[i]?.notation?.treble?.voices?.[0]?.notes || [];
                totalNotes += mNotes.length;
            }

            selectedNoteInfo = {
                measureIndex: m,
                noteIndex: trebleNotes.length - 1,
                note: trebleNotes[trebleNotes.length - 1],
                isLastNote: true,
                totalNotes,
                absolutePosition: totalNotes - 1
            };
            return;
        }
    }

    selectedNoteInfo = null;
}

// -----------------------------------------------------------------------------
// Note Insertion
// -----------------------------------------------------------------------------

/**
 * Handle when user selects a note to insert
 * @param {object} suggestion - The selected suggestion
 */
function handleNoteSelected(suggestion) {
    if (!compositionState) {
        return;
    }

    // Update selected note info first
    updateSelectedNoteInfo();

    // If inserting in the middle (not appending), show dialog
    if (selectedNoteInfo && !selectedNoteInfo.isLastNote) {
        showNoteInsertModeDialog(suggestion);
        return;
    }

    // Appending at end - proceed directly
    insertNoteAtEnd(suggestion);
}

/**
 * Show dialog for insert mode selection (shift vs delete) for single notes
 */
function showNoteInsertModeDialog(suggestion) {
    // Remove any existing dialog
    const existing = document.getElementById('note-insert-mode-dialog');
    if (existing) existing.remove();

    const afterNote = selectedNoteInfo?.note?.pitch || selectedNoteInfo?.note?.pitches?.[0] || 'selected note';

    const dialog = document.createElement('div');
    dialog.id = 'note-insert-mode-dialog';
    dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    dialog.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl p-5 max-w-md w-full mx-4">
            <h3 class="font-semibold text-gray-800 mb-3">Insert Note: ${suggestion.note}</h3>
            <p class="text-sm text-gray-600 mb-4">
                You're inserting after <strong>${afterNote}</strong> in the middle of your melody.
                How would you like to handle the existing notes?
            </p>
            <div class="space-y-3">
                <button id="note-insert-shift" class="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                    <div class="font-medium text-gray-800">Shift existing notes</div>
                    <div class="text-xs text-gray-500 mt-1">Move all notes after this position forward.</div>
                </button>
                <button id="note-insert-delete" class="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-red-400 hover:bg-red-50 transition-colors">
                    <div class="font-medium text-gray-800">Replace existing notes</div>
                    <div class="text-xs text-gray-500 mt-1">Delete all notes after this position.</div>
                </button>
            </div>
            <div class="mt-4 flex justify-end">
                <button id="note-insert-cancel" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    document.getElementById('note-insert-shift').addEventListener('click', () => {
        dialog.remove();
        insertNoteWithShift(suggestion);
    });

    document.getElementById('note-insert-delete').addEventListener('click', () => {
        dialog.remove();
        insertNoteWithDelete(suggestion);
    });

    document.getElementById('note-insert-cancel').addEventListener('click', () => {
        dialog.remove();
    });

    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.remove();
    });
}

/**
 * Insert note at end (append mode)
 */
function insertNoteAtEnd(suggestion) {
    const duration = window.getCurrentNoteDuration ? window.getCurrentNoteDuration() : '4n';
    const dotted = window.getCurrentNoteDotted ? window.getCurrentNoteDotted() : false;

    const notationComposer = window.getNotationComposer && window.getNotationComposer();
    if (notationComposer && typeof notationComposer.setSelectedMeasure === 'function') {
        const measureIndex = selectedNoteInfo ? selectedNoteInfo.measureIndex : currentMeasureIndex;
        notationComposer.setSelectedMeasure(measureIndex);
    }

    if (window.addNoteIntelligently) {
        window.addNoteIntelligently(
            suggestion.note,
            duration,
            dotted,
            'treble',
            false,
            null
        );
    } else {
        compositionState.addNote(currentMeasureIndex, 'treble', 0, {
            pitch: suggestion.note,
            duration: duration,
            dotted: dotted,
            velocity: 0.8,
            isChordTone: suggestion.isChordTone
        });
    }

    finalizeNoteInsertion(suggestion, notationComposer);
}

/**
 * Insert note with shift - moves existing notes forward
 */
function insertNoteWithShift(suggestion) {
    if (!selectedNoteInfo) {
        insertNoteAtEnd(suggestion);
        return;
    }

    const { measureIndex, noteIndex } = selectedNoteInfo;
    const duration = window.getCurrentNoteDuration ? window.getCurrentNoteDuration() : '4n';
    const UNITS_PER_BEAT = 48;

    // Ensure treble block sequence is initialized
    if (!compositionState.trebleBlockSequence?.blocks?.length) {
        compositionState.initializeTrebleBlockSequence?.();
    }

    // Get the insertion point (after selected note)
    const noteUnitInfo = compositionState.getTrebleNoteUnit?.(measureIndex, noteIndex);
    if (!noteUnitInfo) {
        console.warn('Could not get note unit info, falling back to append');
        insertNoteAtEnd(suggestion);
        return;
    }

    const insertUnit = noteUnitInfo.startUnit + noteUnitInfo.durationUnits;
    const durationUnits = durationToUnitsLocal(duration);

    if (compositionState.insertTrebleNoteWithShift) {
        compositionState.insertTrebleNoteWithShift(
            insertUnit,
            durationUnits,
            [suggestion.note],
            { velocity: 0.8 }
        );
    }

    const notationComposer = window.getNotationComposer && window.getNotationComposer();
    finalizeNoteInsertion(suggestion, notationComposer);
}

/**
 * Insert note by deleting notes after selection
 */
function insertNoteWithDelete(suggestion) {
    if (!selectedNoteInfo) {
        insertNoteAtEnd(suggestion);
        return;
    }

    const { measureIndex, noteIndex } = selectedNoteInfo;

    // Delete all notes after the selected note
    deleteNotesAfterPosition(measureIndex, noteIndex);

    // Now append the note
    insertNoteAtEnd(suggestion);
}

/**
 * Delete all treble notes after a given position
 */
function deleteNotesAfterPosition(measureIndex, noteIndex) {
    if (!compositionState) return;

    const measureCount = compositionState.getMeasureCount();

    // Delete notes in current measure after noteIndex
    const currentMeasure = compositionState.measures[measureIndex];
    if (currentMeasure?.notation?.treble?.voices?.[0]?.notes) {
        currentMeasure.notation.treble.voices[0].notes.splice(noteIndex + 1);
    }

    // Delete all notes in subsequent measures
    for (let m = measureIndex + 1; m < measureCount; m++) {
        const measure = compositionState.measures[m];
        if (measure?.notation?.treble?.voices?.[0]?.notes) {
            measure.notation.treble.voices[0].notes = [];
        }
    }

    if (compositionState.syncMeasuresToTrebleBlock) {
        compositionState.syncMeasuresToTrebleBlock();
    }
}

/**
 * Convert duration string to units
 */
function durationToUnitsLocal(duration) {
    const UNITS_PER_BEAT = 48;
    const durationMap = {
        '1n': 4 * UNITS_PER_BEAT,
        '2n': 2 * UNITS_PER_BEAT,
        '4n': 1 * UNITS_PER_BEAT,
        '8n': 0.5 * UNITS_PER_BEAT,
        '16n': 0.25 * UNITS_PER_BEAT,
        '32n': 0.125 * UNITS_PER_BEAT
    };
    return durationMap[duration] || UNITS_PER_BEAT;
}

/**
 * Finalize note insertion (play, feedback, refresh)
 */
function finalizeNoteInsertion(suggestion, notationComposer) {
    // Play the note for feedback
    playNote(suggestion.note, '8n');

    // Visual feedback
    showInsertFeedback(suggestion);

    // Re-render
    if (notationComposer && typeof notationComposer.render === 'function') {
        notationComposer.render();
    }

    // Refresh suggestions with new context
    setTimeout(() => refreshSuggestions(), 100);
}

/**
 * Handle note preview (play without inserting)
 * @param {string} noteName - Note to preview (e.g., 'C4')
 */
function handleNotePreview(noteName) {
    playNote(noteName, '8n');
}

/**
 * Play a note using available audio system
 * @param {string} noteName - Note to play (e.g., 'C4')
 * @param {string} duration - Duration (e.g., '8n', '4n')
 */
function playNote(noteName, duration = '8n') {
    try {
        const piano = getPiano();
        if (piano && getAudioIsReady()) {
            // Use the piano sampler for authentic sound
            piano.triggerAttackRelease(noteName, duration);
        }
    } catch (error) {
        // Audio playback error - silent fail
    }
}

/**
 * Show visual feedback after inserting note
 */
function showInsertFeedback(suggestion) {
    // Create temporary feedback element
    const feedback = document.createElement('div');
    feedback.className = 'note-insert-feedback';
    feedback.textContent = `Added ${suggestion.note}`;
    feedback.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 8px 16px;
        background: #10b981;
        color: white;
        border-radius: 6px;
        font-size: 0.85rem;
        z-index: 1000;
        animation: fadeInOut 1.5s ease forwards;
    `;

    document.body.appendChild(feedback);

    setTimeout(() => {
        feedback.remove();
    }, 1500);
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Set the current measure for suggestions
 * @param {number} measureIndex - Measure index
 */
export function setCurrentMeasure(measureIndex) {
    if (measureIndex !== currentMeasureIndex) {
        currentMeasureIndex = measureIndex;
        refreshSuggestions();
    }
}

/**
 * Set the style preset
 * @param {string} styleId - Style preset ID
 */
export function setStyle(styleId) {
    console.log('🎵 Melody Style Changed:', styleId);
    currentStyleId = styleId;
    refreshSuggestions();
}

/**
 * Set the contour preset
 * @param {string} contourId - Contour preset ID
 */
export function setContour(contourId) {
    currentContourId = contourId;
    refreshSuggestions();
}

/**
 * Set the target octave
 * @param {number} octave - Target octave
 */
export function setOctave(octave) {
    targetOctave = octave;
    refreshSuggestions();
}

/**
 * Get current configuration
 */
export function getConfig() {
    return {
        measureIndex: currentMeasureIndex,
        styleId: currentStyleId,
        contourId: currentContourId,
        octave: targetOctave
    };
}

/**
 * Check if controller is initialized
 */
export function isControllerInitialized() {
    return isInitialized;
}

/**
 * Insert a specific note programmatically
 * @param {string} noteName - Note to insert (e.g., 'C4')
 * @param {object} options - Additional note options
 */
export function insertNote(noteName, options = {}) {
    if (!compositionState) return;

    const note = {
        pitch: noteName,
        duration: options.duration || '4n',
        velocity: options.velocity || 0.8,
        ...options
    };

    compositionState.addNote(currentMeasureIndex, 'treble', 0, note);

    if (options.playSound !== false) {
        playNote(noteName, '8n');
    }
}

/**
 * Get suggestions for a specific context without updating UI
 * @param {object} context - Context for suggestions
 * @returns {Array} Array of suggestions
 */
export function getSuggestionsFor(context) {
    return getQuickSuggestions(context);
}

// -----------------------------------------------------------------------------
// CSS for feedback animation
// -----------------------------------------------------------------------------

const feedbackStyles = document.createElement('style');
feedbackStyles.textContent = `
@keyframes fadeInOut {
    0% { opacity: 0; transform: translateY(10px); }
    20% { opacity: 1; transform: translateY(0); }
    80% { opacity: 1; transform: translateY(0); }
    100% { opacity: 0; transform: translateY(-10px); }
}
`;
document.head.appendChild(feedbackStyles);

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export default {
    initMelodySuggestionController,
    refreshSuggestions,
    setCurrentMeasure,
    setStyle,
    setContour,
    setOctave,
    getConfig,
    isControllerInitialized,
    insertNote,
    getSuggestionsFor
};
