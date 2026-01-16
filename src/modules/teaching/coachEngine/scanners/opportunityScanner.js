/**
 * Opportunity Scanner
 *
 * Scans for missing patterns and techniques the user hasn't tried yet.
 * Creates "opportunity" coach items that point out what could be explored.
 */

import { COACH_ITEM_TYPES, COACH_CATEGORIES, OPPORTUNITY_TYPES } from '../types.js';

// ============================================================================
// HELPERS
// ============================================================================

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
 * Check if a chord is a borrowed chord
 */
function isBorrowed(roman) {
    const normalized = normalizeRoman(roman);
    return normalized.startsWith('b') || normalized.startsWith('#');
}

/**
 * Check if chord has a seventh
 */
function hasSeventh(chord) {
    return chord.type?.includes('7') ||
           chord.type?.includes('7th') ||
           chord.type?.toLowerCase().includes('seventh');
}

/**
 * Get harmonic function for a roman numeral
 */
function getFunction(roman) {
    const normalized = normalizeRoman(roman).toUpperCase();

    // Tonic function
    if (['I', 'VI', 'III'].includes(normalized)) return 'tonic';

    // Dominant function
    if (['V', 'VII'].includes(normalized)) return 'dominant';

    // Subdominant function
    if (['IV', 'II'].includes(normalized)) return 'subdominant';

    // Chromatic/borrowed
    return 'chromatic';
}

// ============================================================================
// NO BORROWED CHORDS
// ============================================================================

/**
 * Check if progression has no borrowed chords
 * @param {Object} context - Analysis context
 * @returns {Array} Opportunity items
 */
export function scanNoBorrowedChords(context) {
    const { progression, mode = 'major' } = context;
    const items = [];

    if (!progression || progression.length < 5) {
        return items;
    }

    // Count borrowed chords
    let borrowedCount = 0;

    for (const chord of progression) {
        const roman = chord.roman || chord.romanNumeral;
        if (isBorrowed(roman)) {
            borrowedCount++;
        }
    }

    // If no borrowed chords and enough chords to warrant suggestion
    if (borrowedCount === 0 && progression.length >= 6) {
        items.push({
            ...OPPORTUNITY_TYPES['no-borrowed-chords'],
            data: {
                count: progression.length,
                suggestions: ['bVII', 'bVI', 'iv']
            }
        });
    }

    return items;
}

// ============================================================================
// NO CADENCE
// ============================================================================

/**
 * Check if progression lacks a clear cadence
 * @param {Object} context - Analysis context
 * @returns {Array} Opportunity items
 */
export function scanNoCadence(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 4) {
        return items;
    }

    // Look for cadence patterns
    let hasCadence = false;

    for (let i = 1; i < progression.length; i++) {
        const prevRoman = normalizeRoman(progression[i - 1].roman || progression[i - 1].romanNumeral);
        const currRoman = normalizeRoman(progression[i].roman || progression[i].romanNumeral);

        // V-I (authentic)
        if ((prevRoman === 'V' || prevRoman === 'v') &&
            (currRoman === 'I' || currRoman === 'i')) {
            hasCadence = true;
            break;
        }

        // IV-I (plagal)
        if ((prevRoman === 'IV' || prevRoman === 'iv') &&
            (currRoman === 'I' || currRoman === 'i')) {
            hasCadence = true;
            break;
        }

        // V-vi (deceptive)
        if ((prevRoman === 'V' || prevRoman === 'v') &&
            (currRoman === 'vi' || currRoman === 'VI')) {
            hasCadence = true;
            break;
        }
    }

    if (!hasCadence) {
        items.push({
            ...OPPORTUNITY_TYPES['no-cadence'],
            data: {
                count: progression.length,
                suggestion: 'Try ending with V→I or IV→I'
            }
        });
    }

    return items;
}

// ============================================================================
// NO SECONDARY DOMINANTS
// ============================================================================

/**
 * Check if progression has no secondary dominants
 * @param {Object} context - Analysis context
 * @returns {Array} Opportunity items
 */
export function scanNoSecondaryDominants(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 6) {
        return items;
    }

    // Look for secondary dominants (V/x notation)
    let hasSecondaryDom = false;

    for (const chord of progression) {
        const roman = chord.roman || chord.romanNumeral || '';
        if (roman.includes('/')) {
            hasSecondaryDom = true;
            break;
        }
    }

    if (!hasSecondaryDom) {
        items.push({
            ...OPPORTUNITY_TYPES['no-secondary-dominants'],
            data: {
                count: progression.length,
                suggestions: ['V/V', 'V/ii', 'V/vi']
            }
        });
    }

    return items;
}

// ============================================================================
// FLAT TENSION
// ============================================================================

/**
 * Check if tension is relatively flat throughout
 * @param {Object} context - Analysis context
 * @returns {Array} Opportunity items
 */
export function scanFlatTension(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 6) {
        return items;
    }

    // Simple tension scoring based on function
    const tensionScores = progression.map(chord => {
        const roman = chord.roman || chord.romanNumeral;
        const func = getFunction(roman);

        switch (func) {
            case 'dominant': return 80;
            case 'subdominant': return 50;
            case 'chromatic': return 60;
            default: return 30; // tonic
        }
    });

    // Calculate variance
    const mean = tensionScores.reduce((a, b) => a + b, 0) / tensionScores.length;
    const variance = tensionScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / tensionScores.length;
    const stdDev = Math.sqrt(variance);

    // If standard deviation is low (<15), tension is flat
    if (stdDev < 15) {
        items.push({
            ...OPPORTUNITY_TYPES['flat-tension'],
            data: {
                variance: Math.round(stdDev),
                mean: Math.round(mean),
                suggestion: 'Build to a climax with more dominant chords'
            }
        });
    }

    return items;
}

// ============================================================================
// ALL ROOT POSITION
// ============================================================================

/**
 * Check if all chords are in root position
 * @param {Object} context - Analysis context
 * @returns {Array} Opportunity items
 */
export function scanAllRootPosition(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 5) {
        return items;
    }

    // Count inversions
    let rootPositionCount = 0;

    for (const chord of progression) {
        if (!chord.inversion || chord.inversion === 0) {
            rootPositionCount++;
        }
    }

    const percent = Math.round((rootPositionCount / progression.length) * 100);

    // If >85% root position
    if (percent > 85) {
        items.push({
            ...OPPORTUNITY_TYPES['bass-always-root'],
            data: {
                percent,
                count: rootPositionCount,
                total: progression.length,
                suggestion: 'Try 1st inversion for stepwise bass lines'
            }
        });
    }

    return items;
}

// ============================================================================
// NO EXTENSIONS
// ============================================================================

/**
 * Check if all chords are triads (no 7ths or extensions)
 * @param {Object} context - Analysis context
 * @returns {Array} Opportunity items
 */
export function scanNoExtensions(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 6) {
        return items;
    }

    // Count chords with extensions
    let extensionCount = 0;

    for (const chord of progression) {
        if (hasSeventh(chord)) {
            extensionCount++;
        }
    }

    // If no extensions
    if (extensionCount === 0) {
        items.push({
            ...OPPORTUNITY_TYPES['no-extensions'],
            data: {
                count: progression.length,
                suggestion: 'Try V7, ii7, or vii°7 for richer harmonies'
            }
        });
    }

    return items;
}

// ============================================================================
// FUNCTION IMBALANCE
// ============================================================================

/**
 * Check for harmonic function imbalance
 * @param {Object} context - Analysis context
 * @returns {Array} Opportunity items
 */
export function scanFunctionImbalance(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 6) {
        return items;
    }

    // Count functions
    const functions = { tonic: 0, dominant: 0, subdominant: 0, chromatic: 0 };

    for (const chord of progression) {
        const roman = chord.roman || chord.romanNumeral;
        const func = getFunction(roman);
        functions[func]++;
    }

    const total = progression.length;

    // Find dominant function
    let maxFunc = 'tonic';
    let maxPercent = 0;

    for (const [func, count] of Object.entries(functions)) {
        const percent = (count / total) * 100;
        if (percent > maxPercent) {
            maxPercent = percent;
            maxFunc = func;
        }
    }

    // If one function dominates (>60%)
    if (maxPercent > 60) {
        const breakdown = Object.entries(functions)
            .filter(([, count]) => count > 0)
            .map(([func, count]) => `${func}: ${Math.round((count / total) * 100)}%`)
            .join(', ');

        items.push({
            ...OPPORTUNITY_TYPES['function-imbalance'],
            data: {
                dominant: maxFunc,
                percent: Math.round(maxPercent),
                breakdown,
                suggestion: `Add more ${maxFunc === 'tonic' ? 'subdominant and dominant' : 'variety'}`
            }
        });
    }

    return items;
}

// ============================================================================
// COMBINED SCANNER
// ============================================================================

/**
 * Scan for all opportunities
 * @param {Object} context - Analysis context
 * @returns {Array} All opportunity items
 */
export function scanAllOpportunities(context) {
    const items = [];

    try {
        items.push(...scanNoBorrowedChords(context));
    } catch (e) {
        console.warn('[Scanners] No borrowed chords scan error:', e);
    }

    try {
        items.push(...scanNoCadence(context));
    } catch (e) {
        console.warn('[Scanners] No cadence scan error:', e);
    }

    try {
        items.push(...scanNoSecondaryDominants(context));
    } catch (e) {
        console.warn('[Scanners] No secondary dominants scan error:', e);
    }

    try {
        items.push(...scanFlatTension(context));
    } catch (e) {
        console.warn('[Scanners] Flat tension scan error:', e);
    }

    try {
        items.push(...scanAllRootPosition(context));
    } catch (e) {
        console.warn('[Scanners] All root position scan error:', e);
    }

    try {
        items.push(...scanNoExtensions(context));
    } catch (e) {
        console.warn('[Scanners] No extensions scan error:', e);
    }

    try {
        items.push(...scanFunctionImbalance(context));
    } catch (e) {
        console.warn('[Scanners] Function imbalance scan error:', e);
    }

    return items;
}

export default scanAllOpportunities;
