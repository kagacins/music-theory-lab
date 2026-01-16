/**
 * Harmonic Suggestion Generator
 *
 * Generates suggestions for harmonic enrichment:
 * - Borrowed chord opportunities
 * - Secondary dominant opportunities
 * - Seventh chord additions
 * - Resolution suggestions
 */

import { COACH_ITEM_TYPES, COACH_CATEGORIES, SUGGESTION_TYPES } from '../types.js';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Note to semitone mapping
 */
const NOTE_TO_SEMITONE = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'Fb': 4,
    'E#': 5, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9,
    'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11, 'B#': 0
};

/**
 * Normalize roman numeral
 */
function normalizeRoman(roman) {
    if (!roman) return '';
    return roman
        .replace(/♭/g, 'b')
        .replace(/♯/g, '#')
        .replace(/(maj|min|add|sus|dim|aug|°)/gi, '')
        .replace(/7|9|11|13/g, '');
}

/**
 * Check if a chord is diatonic in major key
 */
function isDiatonic(roman) {
    const diatonic = ['I', 'i', 'II', 'ii', 'III', 'iii', 'IV', 'iv', 'V', 'v', 'VI', 'vi', 'VII', 'vii'];
    const normalized = normalizeRoman(roman);
    return diatonic.includes(normalized);
}

/**
 * Check if chord has a seventh
 */
function hasSeventh(chord) {
    return chord.type?.includes('7') ||
           chord.type?.includes('7th') ||
           chord.type?.toLowerCase().includes('seventh');
}

// ============================================================================
// BORROWED CHORD SUGGESTIONS
// ============================================================================

/**
 * Suggest borrowed chords when progression is all diatonic
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items
 */
export function suggestBorrowedChords(context) {
    const { progression, mode = 'major' } = context;
    const items = [];

    if (!progression || progression.length < 4) {
        return items;
    }

    // Count diatonic vs borrowed chords
    let diatonicCount = 0;

    for (const chord of progression) {
        const roman = normalizeRoman(chord.roman || chord.romanNumeral);
        if (isDiatonic(roman)) {
            diatonicCount++;
        }
    }

    // If all/mostly diatonic (>90%), suggest a borrowed chord
    if (diatonicCount / progression.length > 0.9) {
        // Find a good spot to suggest (usually before a cadence or at IV)
        for (let i = 0; i < progression.length - 1; i++) {
            const chord = progression[i];
            const nextChord = progression[i + 1];

            const roman = normalizeRoman(chord.roman || chord.romanNumeral);
            const nextRoman = normalizeRoman(nextChord.roman || nextChord.romanNumeral);

            // Suggest bVII before I (rock cadence)
            if (nextRoman === 'I' && roman !== 'V') {
                items.push({
                    ...SUGGESTION_TYPES['try-borrowed-chord'],
                    data: {
                        chordIndex: i,
                        suggestion: 'bVII',
                        reason: 'Creates a rock-style cadence before I',
                        context: `${roman} → I`
                    }
                });
                break;
            }

            // Suggest iv instead of IV for melancholy
            if (roman === 'IV') {
                items.push({
                    ...SUGGESTION_TYPES['try-borrowed-chord'],
                    data: {
                        chordIndex: i,
                        suggestion: 'iv',
                        reason: 'Minor iv adds a bittersweet quality',
                        context: `Try ${chord.root}m instead of ${chord.root}`
                    }
                });
                break;
            }

            // Suggest bVI for drama
            if (roman === 'vi' || roman === 'VI') {
                items.push({
                    ...SUGGESTION_TYPES['try-borrowed-chord'],
                    data: {
                        chordIndex: i,
                        suggestion: 'bVI',
                        reason: 'bVI adds dramatic, cinematic color',
                        context: 'Borrowed from parallel minor'
                    }
                });
                break;
            }
        }
    }

    return items;
}

// ============================================================================
// SECONDARY DOMINANT SUGGESTIONS
// ============================================================================

/**
 * Suggest secondary dominants to intensify motion
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items
 */
export function suggestSecondaryDominants(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 3) {
        return items;
    }

    // Look for ii-V-I patterns that could use V/V
    for (let i = 0; i < progression.length - 2; i++) {
        const chord = progression[i];
        const next = progression[i + 1];
        const afterNext = progression[i + 2];

        const roman = normalizeRoman(chord.roman || chord.romanNumeral);
        const nextRoman = normalizeRoman(next.roman || next.romanNumeral);
        const afterRoman = normalizeRoman(afterNext.roman || afterNext.romanNumeral);

        // If we have ii-V-I, suggest adding V/V before V
        if ((roman === 'ii' || roman === 'II') &&
            (nextRoman === 'V') &&
            (afterRoman === 'I')) {
            items.push({
                ...SUGGESTION_TYPES['try-secondary-dominant'],
                data: {
                    insertAfterIndex: i,
                    suggestion: 'V/V',
                    target: 'V',
                    reason: 'V/V intensifies the pull to V in your ii-V-I',
                    pattern: `${roman} → [V/V] → V → I`
                }
            });
            break;
        }

        // If we have IV-V, suggest V/V
        if ((roman === 'IV') && (nextRoman === 'V')) {
            items.push({
                ...SUGGESTION_TYPES['try-secondary-dominant'],
                data: {
                    chordIndex: i,
                    suggestion: 'V/V',
                    target: 'V',
                    reason: 'Replace IV with V/V for stronger pull to V',
                    pattern: `[V/V] → V`
                }
            });
            break;
        }
    }

    return items;
}

// ============================================================================
// SEVENTH CHORD SUGGESTIONS
// ============================================================================

/**
 * Suggest adding sevenths to triads
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items
 */
export function suggestSevenths(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 4) {
        return items;
    }

    // Count triads vs seventh chords
    let triadCount = 0;
    let candidateIndex = -1;
    let candidateChord = null;

    for (let i = 0; i < progression.length; i++) {
        const chord = progression[i];
        if (!hasSeventh(chord)) {
            triadCount++;

            // Good candidates for 7ths: V, ii, or vii
            const roman = normalizeRoman(chord.roman || chord.romanNumeral);
            if (candidateIndex === -1) {
                if (roman === 'V' || roman === 'ii' || roman === 'II') {
                    candidateIndex = i;
                    candidateChord = chord;
                }
            }
        }
    }

    // If mostly triads (>80%) and we found a candidate
    if (triadCount / progression.length > 0.8 && candidateChord) {
        const roman = normalizeRoman(candidateChord.roman || candidateChord.romanNumeral);

        items.push({
            ...SUGGESTION_TYPES['add-seventh'],
            data: {
                chordIndex: candidateIndex,
                chord: candidateChord.root,
                roman: roman,
                suggestion: roman === 'V' ? 'V7' : (roman === 'ii' ? 'ii7' : 'vii°7'),
                reason: roman === 'V'
                    ? 'V7 creates stronger pull to I'
                    : 'Seventh adds richness and forward motion'
            }
        });
    }

    return items;
}

// ============================================================================
// RESOLUTION SUGGESTIONS
// ============================================================================

/**
 * Suggest resolving unresolved dominants
 * @param {Object} context - Analysis context
 * @returns {Array} Suggestion items
 */
export function suggestResolutions(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    // Check if last chord is an unresolved dominant
    const lastChord = progression[progression.length - 1];
    const lastRoman = normalizeRoman(lastChord.roman || lastChord.romanNumeral);

    if (lastRoman === 'V' || lastRoman === 'v') {
        items.push({
            ...SUGGESTION_TYPES['resolve-dominant'],
            data: {
                chordIndex: progression.length - 1,
                chord: lastChord,
                suggestion: 'I',
                reason: 'Your progression ends on V - it wants to resolve to I!'
            }
        });
    }

    // Check for V followed by something other than I or vi
    for (let i = 0; i < progression.length - 1; i++) {
        const chord = progression[i];
        const next = progression[i + 1];

        const roman = normalizeRoman(chord.roman || chord.romanNumeral);
        const nextRoman = normalizeRoman(next.roman || next.romanNumeral);

        if (roman === 'V' || roman === 'v') {
            // Normal resolutions: I, i, vi, VI
            const normalResolutions = ['I', 'i', 'vi', 'VI'];
            if (!normalResolutions.includes(nextRoman)) {
                // Offer deceptive cadence as alternative
                items.push({
                    ...SUGGESTION_TYPES['try-deceptive-cadence'],
                    data: {
                        chordIndex: i + 1,
                        from: roman,
                        to: nextRoman,
                        suggestion: 'vi',
                        reason: `V → ${nextRoman} is unusual. Try V → vi for a deceptive cadence!`
                    }
                });
                break;
            }
        }
    }

    return items;
}

// ============================================================================
// COMBINED GENERATOR
// ============================================================================

/**
 * Generate all harmonic enrichment suggestions
 * @param {Object} context - Analysis context
 * @returns {Array} All suggestion items
 */
export function generateHarmonicSuggestions(context) {
    return [
        ...suggestBorrowedChords(context),
        ...suggestSecondaryDominants(context),
        ...suggestSevenths(context),
        ...suggestResolutions(context)
    ];
}

export default generateHarmonicSuggestions;
