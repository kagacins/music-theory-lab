/**
 * Chord Helper Functions for Unified Recommendation Modal
 *
 * Pure music theory utilities for chord name/note calculations.
 * These are "leaf" functions with no dependencies on modal state.
 */

import { CHORD_DEFINITIONS } from '../../../../data/music-data.js';
import { spellNoteInKey, getEnharmonicPreferenceForKey } from '../../../utils/noteUtils.js';

/**
 * Get chord notes for display in explanation modals (no octave numbers)
 * @param {string} root - Root note (e.g., 'C', 'F#')
 * @param {string} type - Chord type from CHORD_DEFINITIONS
 * @param {string} [key] - Optional key for enharmonic spelling (defaults to root as key)
 * @returns {Array<string>} Array of note names (first 3 notes of chord)
 */
export function getChordNotesForDisplay(root, type, key = null) {
    const chordDef = CHORD_DEFINITIONS[type];
    if (!chordDef) return [root];

    // Use sharps for indexing, then spell correctly for key
    const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const rootIndex = SHARP_NOTES.findIndex(n => normalizeNoteForComparison(n) === normalizeNoteForComparison(root));
    if (rootIndex === -1) return [root];

    // Use provided key, or fall back to root as key context
    const effectiveKey = key || root;

    return chordDef.intervals.slice(0, 3).map(interval => {
        const noteIndex = (rootIndex + interval) % 12;
        const rawNote = SHARP_NOTES[noteIndex];
        // Spell note correctly for the key (e.g., Gb in Gm, F# in G)
        return spellNoteInKey(rawNote, effectiveKey);
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
 * @param {string} key - Key root note (e.g., 'C', 'Gm', 'Bb')
 * @returns {string} Chord name (e.g., 'C', 'Dm', 'G')
 */
export function getChordInKeyForDegree(degree, key) {
    // Use sharps for indexing
    const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

    // Extract key root (strip 'm' for minor keys)
    const keyRoot = key.replace(/m$/, '');

    // Find key index in either array
    let keyIndex = SHARP_NOTES.indexOf(keyRoot);
    if (keyIndex === -1) keyIndex = FLAT_NOTES.indexOf(keyRoot);
    if (keyIndex === -1) return degree;

    const degreeToSemitone = {
        'I': 0, 'ii': 2, 'II': 2, 'iii': 4, 'III': 4, 'IV': 5, 'iv': 5,
        'V': 7, 'vi': 9, 'VI': 9, 'vii': 11, 'VII': 11
    };

    const semitone = degreeToSemitone[degree];
    if (semitone === undefined) return degree;

    const noteIndex = (keyIndex + semitone) % 12;
    const rawNote = SHARP_NOTES[noteIndex];
    // Spell correctly for the key (e.g., Bb in F major, A# would be wrong)
    const chordRoot = spellNoteInKey(rawNote, key);

    // Determine quality based on degree
    const minorDegrees = ['ii', 'iii', 'vi'];
    const isMinor = minorDegrees.includes(degree);

    return isMinor ? `${chordRoot}m` : chordRoot;
}

/**
 * Get a note relative to a given key by transposing by semitones
 * @param {string} key - Starting note (e.g., 'C', 'F#', 'Bb', 'Gm')
 * @param {number} semitones - Number of semitones to transpose
 * @returns {string} Transposed note name (spelled correctly for key)
 */
export function getRelativeNote(key, semitones) {
    const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

    // Extract key root (strip 'm' for minor keys)
    const keyRoot = key.replace(/m$/, '');

    let keyIndex = SHARP_NOTES.indexOf(keyRoot);
    if (keyIndex === -1) keyIndex = FLAT_NOTES.indexOf(keyRoot);
    if (keyIndex === -1) keyIndex = 0;

    const newIndex = ((keyIndex + semitones) % 12 + 12) % 12; // Handle negative semitones
    const rawNote = SHARP_NOTES[newIndex];
    // Spell correctly for the key
    return spellNoteInKey(rawNote, key);
}
