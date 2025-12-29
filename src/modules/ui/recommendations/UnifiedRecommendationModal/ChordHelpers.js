/**
 * Chord Helper Functions for Unified Recommendation Modal
 *
 * Pure music theory utilities for chord name/note calculations.
 * These are "leaf" functions with no dependencies on modal state.
 */

import { CHORD_DEFINITIONS } from '../../../../data/music-data.js';

/**
 * Get chord notes for display in explanation modals (no octave numbers)
 * @param {string} root - Root note (e.g., 'C', 'F#')
 * @param {string} type - Chord type from CHORD_DEFINITIONS
 * @returns {Array<string>} Array of note names (first 3 notes of chord)
 */
export function getChordNotesForDisplay(root, type) {
    const chordDef = CHORD_DEFINITIONS[type];
    if (!chordDef) return [root];

    const notes = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const rootIndex = notes.findIndex(n => normalizeNoteForComparison(n) === normalizeNoteForComparison(root));
    if (rootIndex === -1) return [root];

    return chordDef.intervals.slice(0, 3).map(interval => {
        const noteIndex = (rootIndex + interval) % 12;
        return notes[noteIndex];
    });
}

/**
 * Normalize note for comparison in explanation modals
 * Converts flat enharmonic equivalents to sharps for comparison
 * @param {string} note - Note name (e.g., 'Db', 'C#')
 * @returns {string} Normalized note name
 */
export function normalizeNoteForComparison(note) {
    const enharmonics = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
    return enharmonics[note] || note;
}

/**
 * Get chord name for a scale degree in a given key
 * Converts roman numeral notation to actual chord names
 * @param {string} degree - Roman numeral degree (e.g., 'I', 'ii', 'V')
 * @param {string} key - Key root note
 * @returns {string} Chord name (e.g., 'C', 'Dm', 'G')
 */
export function getChordInKeyForDegree(degree, key) {
    const notes = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    const keyIndex = notes.indexOf(key);
    if (keyIndex === -1) return degree;

    const degreeToSemitone = {
        'I': 0, 'ii': 2, 'II': 2, 'iii': 4, 'III': 4, 'IV': 5, 'iv': 5,
        'V': 7, 'vi': 9, 'VI': 9, 'vii': 11, 'VII': 11
    };

    const semitone = degreeToSemitone[degree];
    if (semitone === undefined) return degree;

    const noteIndex = (keyIndex + semitone) % 12;
    const chordRoot = notes[noteIndex];

    // Determine quality based on degree
    const minorDegrees = ['ii', 'iii', 'vi'];
    const isMinor = minorDegrees.includes(degree);

    return isMinor ? `${chordRoot}m` : chordRoot;
}

/**
 * Get a note relative to a given key by transposing by semitones
 * @param {string} key - Starting note (e.g., 'C', 'F#', 'Bb')
 * @param {number} semitones - Number of semitones to transpose
 * @returns {string} Transposed note name (uses sharps)
 */
export function getRelativeNote(key, semitones) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

    let keyIndex = notes.indexOf(key);
    if (keyIndex === -1) keyIndex = flatNotes.indexOf(key);
    if (keyIndex === -1) keyIndex = 0;

    const newIndex = (keyIndex + semitones) % 12;
    return notes[newIndex];
}
