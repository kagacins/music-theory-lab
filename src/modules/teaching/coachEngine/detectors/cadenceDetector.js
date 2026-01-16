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
 * Normalize roman numeral for comparison
 * @param {string} roman - Roman numeral string
 * @returns {string} Normalized roman numeral
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

        if (!prevRoman || !currRoman) continue;

        // Deceptive Cadence: V → vi
        if ((prevRoman === 'V' || prevRoman === 'V7') &&
            (currRoman === 'vi' || currRoman === 'VI')) {
            items.push({
                ...OBSERVATION_TYPES['deceptive-cadence'],
                data: {
                    from: prevRoman,
                    to: currRoman,
                    measureIndex: i,
                    fromChord: prevChord,
                    toChord: currChord
                }
            });
        }

        // Plagal Cadence: IV → I or iv → I
        if ((prevRoman === 'IV' || prevRoman === 'iv') &&
            (currRoman === 'I' || currRoman === 'i')) {
            items.push({
                ...OBSERVATION_TYPES['plagal-cadence'],
                data: {
                    from: prevRoman,
                    to: currRoman,
                    measureIndex: i,
                    fromChord: prevChord,
                    toChord: currChord
                }
            });
        }

        // Perfect Authentic Cadence: V → I
        // Show less frequently since it's common (handled by priority in types.js)
        if ((prevRoman === 'V' || prevRoman === 'V7') &&
            (currRoman === 'I' || currRoman === 'i')) {
            // Only add sometimes (random chance based on priority)
            if (Math.random() < 0.3) {
                items.push({
                    ...OBSERVATION_TYPES['perfect-cadence'],
                    data: {
                        from: prevRoman,
                        to: currRoman,
                        measureIndex: i,
                        fromChord: prevChord,
                        toChord: currChord
                    }
                });
            }
        }

        // Half Cadence: ends on V
        // Check if this is the last chord or followed by non-resolution
        if (i === progression.length - 1 &&
            (currRoman === 'V' || currRoman === 'V7')) {
            items.push({
                ...OBSERVATION_TYPES['half-cadence'],
                data: {
                    to: currRoman,
                    measureIndex: i,
                    toChord: currChord
                }
            });
        }
    }

    return items;
}

export default detectCadences;
