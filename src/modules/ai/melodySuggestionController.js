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

// -----------------------------------------------------------------------------
// Controller State
// -----------------------------------------------------------------------------

let compositionState = null;
let currentMeasureIndex = 0;
let currentStyleId = 'any';
let currentContourId = 'any';
let targetOctave = 4;
let isInitialized = false;

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
 * Refresh suggestions based on current context
 */
export function refreshSuggestions() {
    if (!compositionState) return;

    const measure = compositionState.getMeasure(currentMeasureIndex);
    if (!measure) {
        clearSuggestions();
        return;
    }

    // Get current context
    const chord = measure.chord;
    const key = compositionState.metadata.key;

    // Get previous note from current measure (last note in treble voice)
    const trebleNotes = compositionState.getNotes(currentMeasureIndex, 'treble', 0);
    const previousNote = trebleNotes.length > 0
        ? trebleNotes[trebleNotes.length - 1].pitch
        : null;

    // If no previous note in current measure, check previous measure
    let prevNoteFromPrevMeasure = null;
    if (!previousNote && currentMeasureIndex > 0) {
        const prevMeasureNotes = compositionState.getNotes(currentMeasureIndex - 1, 'treble', 0);
        if (prevMeasureNotes.length > 0) {
            prevNoteFromPrevMeasure = prevMeasureNotes[prevMeasureNotes.length - 1].pitch;
        }
    }

    const actualPreviousNote = previousNote || prevNoteFromPrevMeasure;

    // Collect recent notes for frequency/recency penalty
    // Get notes from all measures, most recent first
    const recentNotes = [];
    const measureCount = compositionState.getMeasureCount();
    for (let i = measureCount - 1; i >= 0 && recentNotes.length < 20; i--) {
        const measureNotes = compositionState.getNotes(i, 'treble', 0);
        // Add notes in reverse order (most recent first)
        for (let j = measureNotes.length - 1; j >= 0 && recentNotes.length < 20; j--) {
            if (measureNotes[j].pitch) {
                recentNotes.push(measureNotes[j].pitch);
            }
        }
    }

    // Generate and display suggestions
    updateSuggestions({
        chord: chord.root ? chord : { root: 'C', type: 'Major' },
        key,
        previousNote: actualPreviousNote,
        styleId: currentStyleId,
        contourId: currentContourId,
        octave: targetOctave,
        recentNotes: recentNotes
    });
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

    // Get the selected note duration from UI (defaults to quarter note)
    const duration = window.getCurrentNoteDuration ? window.getCurrentNoteDuration() : '4n';
    const dotted = window.getCurrentNoteDotted ? window.getCurrentNoteDotted() : false;

    // CRITICAL: Set the notation composer's selected measure to match the controller's current measure
    // This ensures addNoteIntelligently adds to the correct measure
    const notationComposer = window.getNotationComposer && window.getNotationComposer();
    if (notationComposer && typeof notationComposer.setSelectedMeasure === 'function') {
        notationComposer.setSelectedMeasure(currentMeasureIndex);
    }

    // Use addNoteIntelligently for proper measure-filling and auto-advance
    // This adds to compositionState, handles measure overflow, and auto-advances
    if (window.addNoteIntelligently) {
        const result = window.addNoteIntelligently(
            suggestion.note,  // pitch
            duration,         // duration from toolbar
            dotted,          // dotted from toolbar
            'treble',        // staff
            false,           // isRest
            null             // accidental (let auto-detection handle it)
        );
    } else {
        // Fallback: add directly to compositionState
        compositionState.addNote(currentMeasureIndex, 'treble', 0, {
            pitch: suggestion.note,
            duration: duration,
            dotted: dotted,
            velocity: 0.8,
            isChordTone: suggestion.isChordTone
        });
    }

    // Play the note for feedback
    playNote(suggestion.note, '8n');

    // Visual feedback
    showInsertFeedback(suggestion);

    // Re-render the notation canvas to show the new note
    // IMPORTANT: Do NOT call syncNotationFromProgression() here!
    // That would sync FROM progressionData TO compositionState, overwriting the note we just added
    // Instead, just render the notation directly
    if (notationComposer && typeof notationComposer.render === 'function') {
        notationComposer.render();
    }

    // Refresh suggestions with new context (after a short delay)
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
