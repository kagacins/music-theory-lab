/**
 * Borrowed Chord Detector
 *
 * Detects borrowed chords (modal interchange) and creates coach observations.
 * Wraps existing patternDetection.js functionality.
 *
 * CONTEXT-AWARE: bVII can function as either a borrowed chord OR as V/IV (secondary dominant).
 * If bVII resolves to IV, it's functioning as a secondary dominant, not a borrowed chord.
 * We prioritize the secondary dominant interpretation when the resolution confirms it.
 */

import { COACH_ITEM_TYPES, COACH_CATEGORIES, OBSERVATION_TYPES } from '../types.js';

// ============================================================================
// BORROWED CHORD DETECTION
// ============================================================================

/**
 * Note to semitone mapping for interval calculation
 */
const NOTE_TO_SEMITONE = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'Fb': 4,
    'E#': 5, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9,
    'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11, 'B#': 0
};

/**
 * Get semitone value for a note
 */
function getNoteValue(note) {
    if (!note) return -1;
    return NOTE_TO_SEMITONE[note] ?? -1;
}

/**
 * Calculate interval in semitones between two notes
 */
function getInterval(note1, note2) {
    const v1 = getNoteValue(note1);
    const v2 = getNoteValue(note2);
    if (v1 === -1 || v2 === -1) return null;
    return ((v2 - v1) + 12) % 12;
}

/**
 * Borrowed chord definitions with their observation types
 */
const BORROWED_CHORD_MAP = {
    'bVI': 'borrowed-bVI',
    'bVII': 'borrowed-bVII',
    'iv': 'borrowed-iv',
    'bIII': 'borrowed-bIII',
    // Additional borrowed chords that share observation types
    'bvi': 'borrowed-bVI',  // Lowercase variant
    'bvii': 'borrowed-bVII',
    'IV': null,  // Not borrowed in major
    'bII': null  // Neapolitan - could add separate type
};

/**
 * Normalize roman numeral for comparison
 * @param {string} roman - Roman numeral string
 * @returns {string} Normalized roman numeral (preserves case for quality detection)
 */
function normalizeRoman(roman) {
    if (!roman) return '';
    // Convert Unicode symbols to ASCII
    let normalized = roman
        .replace(/♭/g, 'b')
        .replace(/♯/g, '#');
    // Remove extensions but keep base numeral, accidentals, and case
    return normalized.replace(/(maj|min|add|sus|dim|aug|°)/gi, '').replace(/7|9|11|13/g, '');
}

/**
 * Check if a bVII chord is functioning as V/IV (secondary dominant to IV)
 * @param {Object} chord - Current chord (bVII)
 * @param {Object} nextChord - Next chord in progression
 * @param {string} key - Current key
 * @returns {boolean} True if functioning as V/IV
 */
function isBVIIFunctioningAsSecondaryDominant(chord, nextChord, key) {
    if (!nextChord || !chord) return false;

    // Check if this chord resolves a perfect fifth down to the next chord
    // V/IV means this chord is the V of IV, so it should resolve down a 5th to IV
    const interval = getInterval(chord.root, nextChord.root);

    // Perfect fifth down = 5 semitones (or 7 up, same thing)
    const resolvesDownFifth = interval === 5 || interval === 7;

    if (!resolvesDownFifth) return false;

    // Now check if the next chord is IV (subdominant)
    // Get key root
    const keyRoot = key?.replace(/\s*(major|minor|min|m)$/i, '').trim() || 'C';
    const keyRootSemitone = getNoteValue(keyRoot);
    const nextRootSemitone = getNoteValue(nextChord.root);

    if (keyRootSemitone === -1 || nextRootSemitone === -1) return false;

    // IV is 5 semitones above the tonic
    const intervalFromTonic = ((nextRootSemitone - keyRootSemitone) + 12) % 12;
    const isIV = intervalFromTonic === 5;

    return isIV;
}

/**
 * Check if a roman numeral indicates a borrowed chord
 * @param {string} roman - Normalized roman numeral
 * @param {string} mode - Current mode ('major' or 'minor')
 * @returns {string|null} Borrowed chord type or null
 */
function identifyBorrowedChord(roman, mode) {
    if (!roman) return null;

    // In major keys, these are borrowed
    if (mode === 'major') {
        // bVI - flat six major
        if (roman === 'bVI' || roman === 'bvi') return 'bVI';

        // bVII - flat seven major
        if (roman === 'bVII' || roman === 'bvii') return 'bVII';

        // iv - minor four (instead of major IV)
        if (roman === 'iv') return 'iv';

        // bIII - flat three major
        if (roman === 'bIII' || roman === 'biii') return 'bIII';

        // bII - Neapolitan
        if (roman === 'bII' || roman === 'bii') return 'bII';
    }

    // In minor keys, these would be borrowed from parallel major
    // (less common to highlight, but could add)

    return null;
}

/**
 * Detect borrowed chords in progression
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items for detected borrowed chords
 */
export function detectBorrowedChords(context) {
    const { progression, key = 'C' } = context;
    let { mode = 'major' } = context;
    const items = [];

    if (!progression || progression.length === 0) {
        return items;
    }

    // Check if key indicates minor (e.g., "Bbm", "Am", "F#m")
    // Keys like "Bbm" end with 'm' but are not "dim" chords
    if (key && key.endsWith('m') && key.length > 1 && !key.endsWith('dim')) {
        mode = 'minor';
    }

    // Track which borrowed chords we've already reported in this analysis
    // to avoid duplicate observations for the same chord appearing multiple times
    const reportedTypes = new Set();

    for (let i = 0; i < progression.length; i++) {
        const chord = progression[i];
        const nextChord = i < progression.length - 1 ? progression[i + 1] : null;
        const roman = normalizeRoman(chord.roman || chord.romanNumeral);

        const borrowedType = identifyBorrowedChord(roman, mode);
        if (!borrowedType) continue;

        // CONTEXT-AWARE: If bVII resolves to IV, it's functioning as V/IV (secondary dominant)
        // In this case, skip the borrowed chord report - the secondary dominant detector
        // will catch this and provide the more accurate interpretation
        if (borrowedType === 'bVII' && isBVIIFunctioningAsSecondaryDominant(chord, nextChord, key)) {
            // Skip - this will be reported as V/IV by the secondary dominant detector
            continue;
        }

        // Map to observation type
        const observationTypeMap = {
            'bVI': 'borrowed-bVI',
            'bVII': 'borrowed-bVII',
            'iv': 'borrowed-iv',
            'bIII': 'borrowed-bIII'
        };

        const observationId = observationTypeMap[borrowedType];
        if (!observationId) continue;

        // Only report first occurrence of each type
        if (reportedTypes.has(observationId)) continue;
        reportedTypes.add(observationId);

        const observationType = OBSERVATION_TYPES[observationId];
        if (!observationType) continue;

        items.push({
            ...observationType,
            data: {
                borrowedType,
                roman,
                chordIndex: i,
                chord: chord,
                root: chord.root,
                type: chord.type
            }
        });
    }

    return items;
}

export default detectBorrowedChords;
