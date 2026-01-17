/**
 * Borrowed Chord Detector
 *
 * Detects borrowed chords (modal interchange) and creates coach observations.
 * Wraps existing patternDetection.js functionality.
 */

import { COACH_ITEM_TYPES, COACH_CATEGORIES, OBSERVATION_TYPES } from '../types.js';

// ============================================================================
// BORROWED CHORD DETECTION
// ============================================================================

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
        const roman = normalizeRoman(chord.roman || chord.romanNumeral);

        const borrowedType = identifyBorrowedChord(roman, mode);
        if (!borrowedType) continue;

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
