/**
 * Cadence Detector
 *
 * Detects cadence patterns and creates coach observations.
 * Wraps existing patternDetection.js functionality.
 */

import { COACH_ITEM_TYPES, COACH_CATEGORIES, OBSERVATION_TYPES } from '../types.js';

// ============================================================================
// CADENCE DETECTION
// ============================================================================

/**
 * Normalize roman numeral for comparison (removes extensions like 7, maj7, etc.)
 * @param {string} roman - Roman numeral string
 * @returns {string} Normalized roman numeral (base only)
 */
function normalizeRoman(roman) {
    if (!roman) return '';
    // Convert Unicode symbols to ASCII
    let normalized = roman
        .replace(/♭/g, 'b')
        .replace(/♯/g, '#');
    // Remove extensions but keep base numeral and accidentals
    return normalized.replace(/(maj|min|add|sus|dim|aug|°)/gi, '').replace(/7|9|11|13/g, '');
}

/**
 * Check if a roman numeral represents a minor chord (lowercase)
 * @param {string} roman - Roman numeral string
 * @returns {boolean} True if minor
 */
function isMinorRoman(roman) {
    if (!roman) return false;
    // Extract just the numeral part (remove accidentals and extensions)
    const match = roman.match(/[b#♭♯]?([ivIV]+)/);
    if (!match) return false;
    const numeral = match[1];
    // Lowercase numerals indicate minor
    return numeral === numeral.toLowerCase();
}

/**
 * Check if a chord is inverted
 * @param {Object} chord - Chord object
 * @returns {boolean} True if chord is inverted (inversion > 0)
 */
function isInverted(chord) {
    return chord && (chord.inversion > 0 || chord.inversion === 1 || chord.inversion === 2 || chord.inversion === 3);
}

/**
 * Detect cadences in progression
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items for detected cadences
 */
export function detectCadences(context) {
    const { progression, key } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    // Check each pair of consecutive chords
    for (let i = 1; i < progression.length; i++) {
        const prevChord = progression[i - 1];
        const currChord = progression[i];

        const prevRoman = normalizeRoman(prevChord.roman || prevChord.romanNumeral);
        const currRoman = normalizeRoman(currChord.roman || currChord.romanNumeral);
        const prevRomanRaw = prevChord.roman || prevChord.romanNumeral || '';
        const currRomanRaw = currChord.roman || currChord.romanNumeral || '';

        if (!prevRoman || !currRoman) continue;

        // Deceptive Cadence: V → vi
        if ((prevRoman === 'V' || prevRoman === 'V7') &&
            (currRoman === 'vi' || currRoman === 'VI')) {
            items.push({
                ...OBSERVATION_TYPES['deceptive-cadence'],
                data: {
                    from: prevRomanRaw,
                    to: currRomanRaw,
                    startIndex: i - 1,
                    endIndex: i,
                    chordIndices: [i],
                    chordIndex: i,
                    chord: currChord,
                    fromChord: prevChord,
                    toChord: currChord
                }
            });
        }

        // Plagal Cadences: IV/iv → I
        if ((prevRoman === 'IV' || prevRoman === 'iv') &&
            (currRoman === 'I' || currRoman === 'i')) {

            const prevIsMinor = isMinorRoman(prevRomanRaw);
            const prevInverted = isInverted(prevChord);
            const currInverted = isInverted(currChord);

            // Determine which type of plagal cadence
            if (prevInverted || currInverted) {
                // Inverted Plagal Cadence
                items.push({
                    ...OBSERVATION_TYPES['inverted-plagal-cadence'],
                    data: {
                        from: prevRomanRaw,
                        to: currRomanRaw,
                        startIndex: i - 1,
                        endIndex: i,
                        chordIndices: [i],
                        chordIndex: i,
                        chord: currChord,
                        fromChord: prevChord,
                        toChord: currChord,
                        prevInverted,
                        currInverted
                    }
                });
            } else if (prevIsMinor) {
                // Minor Plagal Cadence (iv → I)
                items.push({
                    ...OBSERVATION_TYPES['minor-plagal-cadence'],
                    data: {
                        from: prevRomanRaw,
                        to: currRomanRaw,
                        startIndex: i - 1,
                        endIndex: i,
                        chordIndices: [i],
                        chordIndex: i,
                        chord: currChord,
                        fromChord: prevChord,
                        toChord: currChord
                    }
                });
            } else {
                // Standard Plagal Cadence (IV → I)
                items.push({
                    ...OBSERVATION_TYPES['plagal-cadence'],
                    data: {
                        from: prevRomanRaw,
                        to: currRomanRaw,
                        startIndex: i - 1,
                        endIndex: i,
                        chordIndices: [i],
                        chordIndex: i,
                        chord: currChord,
                        fromChord: prevChord,
                        toChord: currChord
                    }
                });
            }
        }

        // Backdoor Cadence: ♭VII → I
        if ((prevRoman === 'bVII' || prevRoman === 'bvii') &&
            (currRoman === 'I' || currRoman === 'i')) {
            items.push({
                ...OBSERVATION_TYPES['backdoor-cadence'],
                data: {
                    from: prevRomanRaw,
                    to: currRomanRaw,
                    startIndex: i - 1,
                    endIndex: i,
                    chordIndices: [i],
                    chordIndex: i,
                    chord: currChord,
                    fromChord: prevChord,
                    toChord: currChord
                }
            });
        }

        // Perfect Authentic Cadence: V → I
        if ((prevRoman === 'V' || prevRoman === 'V7') &&
            (currRoman === 'I' || currRoman === 'i')) {
            items.push({
                ...OBSERVATION_TYPES['perfect-cadence'],
                data: {
                    from: prevRomanRaw,
                    to: currRomanRaw,
                    startIndex: i - 1,
                    endIndex: i,
                    chordIndices: [i],
                    chordIndex: i,
                    chord: currChord,
                    fromChord: prevChord,
                    toChord: currChord
                }
            });
        }

        // Half Cadence: ends on V
        if (i === progression.length - 1 &&
            (currRoman === 'V' || currRoman === 'V7')) {
            items.push({
                ...OBSERVATION_TYPES['half-cadence'],
                data: {
                    to: currRomanRaw,
                    chordIndex: i,
                    chord: currChord,
                    toChord: currChord
                }
            });
        }
    }

    return items;
}

export default detectCadences;
