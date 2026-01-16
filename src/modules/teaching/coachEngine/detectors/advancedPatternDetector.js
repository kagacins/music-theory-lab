/**
 * Advanced Pattern Detector
 *
 * Detects more sophisticated harmonic patterns:
 * - Tritone substitutions
 * - Pedal point patterns
 * - Chromatic bass lines
 * - Parallel harmony
 * - Neapolitan chords
 */

import { OBSERVATION_TYPES } from '../types.js';

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
 * Normalize roman numeral for comparison
 */
function normalizeRoman(roman) {
    if (!roman) return '';
    return roman
        .replace(/♭/g, 'b')
        .replace(/♯/g, '#')
        .replace(/(maj|min|add|sus|dim|aug|°)/gi, '')
        .replace(/7|9|11|13/g, '');
}

// ============================================================================
// TRITONE SUBSTITUTION DETECTION
// ============================================================================

/**
 * Detect tritone substitutions
 * A tritone sub replaces V with bII (both have tritone interval to the tonic)
 * Pattern: bII → I (often bII7 → I)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectTritoneSubstitution(context) {
    const { progression, key } = context;
    const items = [];

    if (!progression || progression.length < 2) {
        return items;
    }

    for (let i = 1; i < progression.length; i++) {
        const prev = progression[i - 1];
        const curr = progression[i];

        const prevRoman = normalizeRoman(prev.roman || prev.romanNumeral);
        const currRoman = normalizeRoman(curr.roman || curr.romanNumeral);

        // bII → I pattern (classic tritone sub resolution)
        if ((prevRoman === 'bII' || prevRoman === 'bii') &&
            (currRoman === 'I' || currRoman === 'i')) {
            items.push({
                type: 'observation',
                category: 'harmony',
                id: 'tritone-substitution',
                priority: 85,
                emoji: '🔄',
                title: 'Tritone Substitution',
                message: {
                    simple: 'You used bII instead of V - this is called a tritone substitution!',
                    intermediate: 'The bII→I is a tritone substitution for V→I. Both share the same tritone (B-F in C), creating smooth voice leading.',
                    advanced: 'Tritone substitution exploits enharmonic equivalence of the tritone interval. The bII7 shares two notes with V7 (the 3rd and 7th are swapped), enabling chromatic bass motion.'
                },
                data: {
                    pattern: `${prevRoman} → ${currRoman}`,
                    measureIndex: i,
                    fromChord: prev,
                    toChord: curr
                },
                actions: {
                    deepDive: true
                }
            });
            break; // Only report first one
        }

        // Also check for bII approaching V (chromatic approach)
        if ((prevRoman === 'bII' || prevRoman === 'bii') &&
            (currRoman === 'V' || currRoman === 'v')) {
            items.push({
                type: 'observation',
                category: 'harmony',
                id: 'chromatic-dominant-approach',
                priority: 75,
                emoji: '🎯',
                title: 'Chromatic Dominant Approach',
                message: {
                    simple: 'You approached the V chord from a half-step above - nice chromatic motion!',
                    intermediate: 'bII→V creates a chromatic bass line. The bII can act as an upper neighbor to V.',
                    advanced: 'This is related to tritone substitution - bII approaching V creates chromatic tension before the dominant.'
                },
                data: {
                    pattern: `${prevRoman} → ${currRoman}`,
                    measureIndex: i,
                    fromChord: prev,
                    toChord: curr
                },
                actions: {
                    deepDive: true
                }
            });
            break;
        }
    }

    return items;
}

// ============================================================================
// PEDAL POINT DETECTION
// ============================================================================

/**
 * Detect pedal point (sustained bass note through chord changes)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectPedalPoint(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 3) {
        return items;
    }

    // Look for 3+ consecutive chords with same bass note
    let pedalStart = -1;
    let pedalLength = 0;
    let pedalNote = null;

    for (let i = 0; i < progression.length; i++) {
        const chord = progression[i];
        // Get bass note (could be from inversion or explicit bass)
        const bassNote = chord.bass || chord.root;

        if (pedalNote === null) {
            pedalNote = bassNote;
            pedalStart = i;
            pedalLength = 1;
        } else if (bassNote === pedalNote) {
            pedalLength++;
        } else {
            // Pedal ended - check if it was significant
            if (pedalLength >= 3) {
                items.push({
                    type: 'observation',
                    category: 'harmony',
                    id: 'pedal-point',
                    priority: 80,
                    emoji: '🎹',
                    title: 'Pedal Point',
                    message: {
                        simple: `Nice! You kept ${pedalNote} in the bass for ${pedalLength} chords - this is a pedal point!`,
                        intermediate: `A ${pedalNote} pedal point creates stability while harmonies change above. Common pedals are on tonic (I) or dominant (V).`,
                        advanced: `Pedal points create harmonic tension by sustaining one note against changing harmonies. The dissonances resolve when the pedal is released.`
                    },
                    data: {
                        pedalNote,
                        startIndex: pedalStart,
                        length: pedalLength,
                        chords: progression.slice(pedalStart, pedalStart + pedalLength).map(c => c.root)
                    },
                    actions: {
                        deepDive: true
                    }
                });
            }

            // Start new potential pedal
            pedalNote = bassNote;
            pedalStart = i;
            pedalLength = 1;
        }
    }

    // Check for pedal at end
    if (pedalLength >= 3) {
        items.push({
            type: 'observation',
            category: 'harmony',
            id: 'pedal-point',
            priority: 80,
            emoji: '🎹',
            title: 'Pedal Point',
            message: {
                simple: `Nice! You kept ${pedalNote} in the bass for ${pedalLength} chords - this is a pedal point!`,
                intermediate: `A ${pedalNote} pedal point creates stability while harmonies change above. Common pedals are on tonic (I) or dominant (V).`,
                advanced: `Pedal points create harmonic tension by sustaining one note against changing harmonies. The dissonances resolve when the pedal is released.`
            },
            data: {
                pedalNote,
                startIndex: pedalStart,
                length: pedalLength,
                chords: progression.slice(pedalStart, pedalStart + pedalLength).map(c => c.root)
            },
            actions: {
                deepDive: true
            }
        });
    }

    return items;
}

// ============================================================================
// CHROMATIC BASS LINE DETECTION
// ============================================================================

/**
 * Detect chromatic bass line (stepwise chromatic motion in bass)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectChromaticBassLine(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 3) {
        return items;
    }

    // Look for 3+ consecutive chromatic bass motion
    let chromaticStart = -1;
    let chromaticLength = 0;
    let direction = null; // 'ascending' or 'descending'

    for (let i = 1; i < progression.length; i++) {
        const prevBass = progression[i - 1].bass || progression[i - 1].root;
        const currBass = progression[i].bass || progression[i].root;

        const interval = getInterval(prevBass, currBass);

        // Check for chromatic motion (1 or 11 semitones = half step)
        const isHalfStepUp = interval === 1;
        const isHalfStepDown = interval === 11;

        if (isHalfStepUp || isHalfStepDown) {
            const currentDirection = isHalfStepUp ? 'ascending' : 'descending';

            if (direction === null || direction === currentDirection) {
                if (chromaticStart === -1) {
                    chromaticStart = i - 1;
                    chromaticLength = 2;
                } else {
                    chromaticLength++;
                }
                direction = currentDirection;
            } else {
                // Direction changed - check if we had a significant run
                if (chromaticLength >= 3) {
                    const bassNotes = progression.slice(chromaticStart, chromaticStart + chromaticLength).map(c => c.bass || c.root);
                    items.push({
                        type: 'observation',
                        category: 'voice-leading',
                        id: 'chromatic-bass-line',
                        priority: 82,
                        emoji: '📈',
                        title: 'Chromatic Bass Line',
                        message: {
                            simple: `Great chromatic bass line ${direction}! This creates smooth, dramatic motion.`,
                            intermediate: `Your ${direction} chromatic bass line (${bassNotes.join(' → ')}) creates smooth voice leading and harmonic tension.`,
                            advanced: `Chromatic bass lines are powerful compositional devices. The ${direction} motion creates a sense of ${direction === 'ascending' ? 'rising intensity' : 'resolution or descent'}.`
                        },
                        data: {
                            direction,
                            startIndex: chromaticStart,
                            length: chromaticLength,
                            bassNotes
                        },
                        actions: {
                            deepDive: true
                        }
                    });
                }

                // Reset for new direction
                chromaticStart = i - 1;
                chromaticLength = 2;
                direction = currentDirection;
            }
        } else {
            // Not chromatic - check if we had a significant run
            if (chromaticLength >= 3) {
                const bassNotes = progression.slice(chromaticStart, chromaticStart + chromaticLength).map(c => c.bass || c.root);
                items.push({
                    type: 'observation',
                    category: 'voice-leading',
                    id: 'chromatic-bass-line',
                    priority: 82,
                    emoji: '📈',
                    title: 'Chromatic Bass Line',
                    message: {
                        simple: `Great chromatic bass line ${direction}! This creates smooth, dramatic motion.`,
                        intermediate: `Your ${direction} chromatic bass line (${bassNotes.join(' → ')}) creates smooth voice leading and harmonic tension.`,
                        advanced: `Chromatic bass lines are powerful compositional devices. The ${direction} motion creates a sense of ${direction === 'ascending' ? 'rising intensity' : 'resolution or descent'}.`
                    },
                    data: {
                        direction,
                        startIndex: chromaticStart,
                        length: chromaticLength,
                        bassNotes
                    },
                    actions: {
                        deepDive: true
                    }
                });
            }

            // Reset
            chromaticStart = -1;
            chromaticLength = 0;
            direction = null;
        }
    }

    // Check for chromatic line at end
    if (chromaticLength >= 3) {
        const bassNotes = progression.slice(chromaticStart, chromaticStart + chromaticLength).map(c => c.bass || c.root);
        items.push({
            type: 'observation',
            category: 'voice-leading',
            id: 'chromatic-bass-line',
            priority: 82,
            emoji: '📈',
            title: 'Chromatic Bass Line',
            message: {
                simple: `Great chromatic bass line ${direction}! This creates smooth, dramatic motion.`,
                intermediate: `Your ${direction} chromatic bass line (${bassNotes.join(' → ')}) creates smooth voice leading and harmonic tension.`,
                advanced: `Chromatic bass lines are powerful compositional devices. The ${direction} motion creates a sense of ${direction === 'ascending' ? 'rising intensity' : 'resolution or descent'}.`
            },
            data: {
                direction,
                startIndex: chromaticStart,
                length: chromaticLength,
                bassNotes
            },
            actions: {
                deepDive: true
            }
        });
    }

    return items;
}

// ============================================================================
// PARALLEL HARMONY DETECTION
// ============================================================================

/**
 * Detect parallel harmony (same chord quality moving in parallel motion)
 * @param {Object} context - Analysis context
 * @returns {Array} Coach items
 */
export function detectParallelHarmony(context) {
    const { progression } = context;
    const items = [];

    if (!progression || progression.length < 3) {
        return items;
    }

    // Look for 3+ chords of same quality moving by same interval
    let parallelStart = -1;
    let parallelLength = 0;
    let quality = null;
    let intervalPattern = null;

    for (let i = 1; i < progression.length; i++) {
        const prev = progression[i - 1];
        const curr = progression[i];

        const sameQuality = prev.type === curr.type;
        const interval = getInterval(prev.root, curr.root);

        if (sameQuality && interval !== 0) {
            if (quality === null || (quality === curr.type && intervalPattern === interval)) {
                if (parallelStart === -1) {
                    parallelStart = i - 1;
                    parallelLength = 2;
                    quality = curr.type;
                    intervalPattern = interval;
                } else {
                    parallelLength++;
                }
            } else {
                // Check if we had a significant run
                if (parallelLength >= 3) {
                    const chords = progression.slice(parallelStart, parallelStart + parallelLength).map(c => `${c.root}${c.type === 'Minor' ? 'm' : ''}`);
                    items.push({
                        type: 'observation',
                        category: 'harmony',
                        id: 'parallel-harmony',
                        priority: 78,
                        emoji: '➡️',
                        title: 'Parallel Harmony',
                        message: {
                            simple: `You're moving ${quality} chords in parallel - this creates a bold, modern sound!`,
                            intermediate: `Parallel ${quality.toLowerCase()} chords (${chords.join(' → ')}) create a modal, non-functional sound used in pop, film, and impressionist music.`,
                            advanced: `Parallel planing ignores traditional voice leading rules for a distinctive effect. This technique is common in Debussy, film scores, and contemporary pop.`
                        },
                        data: {
                            quality,
                            interval: intervalPattern,
                            startIndex: parallelStart,
                            length: parallelLength,
                            chords
                        },
                        actions: {
                            deepDive: true
                        }
                    });
                }

                // Reset for new pattern
                parallelStart = i - 1;
                parallelLength = 2;
                quality = curr.type;
                intervalPattern = interval;
            }
        } else {
            // Not parallel - check if we had a significant run
            if (parallelLength >= 3) {
                const chords = progression.slice(parallelStart, parallelStart + parallelLength).map(c => `${c.root}${c.type === 'Minor' ? 'm' : ''}`);
                items.push({
                    type: 'observation',
                    category: 'harmony',
                    id: 'parallel-harmony',
                    priority: 78,
                    emoji: '➡️',
                    title: 'Parallel Harmony',
                    message: {
                        simple: `You're moving ${quality} chords in parallel - this creates a bold, modern sound!`,
                        intermediate: `Parallel ${quality.toLowerCase()} chords (${chords.join(' → ')}) create a modal, non-functional sound used in pop, film, and impressionist music.`,
                        advanced: `Parallel planing ignores traditional voice leading rules for a distinctive effect. This technique is common in Debussy, film scores, and contemporary pop.`
                    },
                    data: {
                        quality,
                        interval: intervalPattern,
                        startIndex: parallelStart,
                        length: parallelLength,
                        chords
                    },
                    actions: {
                        deepDive: true
                    }
                });
            }

            // Reset
            parallelStart = -1;
            parallelLength = 0;
            quality = null;
            intervalPattern = null;
        }
    }

    // Check for parallel at end
    if (parallelLength >= 3) {
        const chords = progression.slice(parallelStart, parallelStart + parallelLength).map(c => `${c.root}${c.type === 'Minor' ? 'm' : ''}`);
        items.push({
            type: 'observation',
            category: 'harmony',
            id: 'parallel-harmony',
            priority: 78,
            emoji: '➡️',
            title: 'Parallel Harmony',
            message: {
                simple: `You're moving ${quality} chords in parallel - this creates a bold, modern sound!`,
                intermediate: `Parallel ${quality.toLowerCase()} chords (${chords.join(' → ')}) create a modal, non-functional sound used in pop, film, and impressionist music.`,
                advanced: `Parallel planing ignores traditional voice leading rules for a distinctive effect. This technique is common in Debussy, film scores, and contemporary pop.`
            },
            data: {
                quality,
                interval: intervalPattern,
                startIndex: parallelStart,
                length: parallelLength,
                chords
            },
            actions: {
                deepDive: true
            }
        });
    }

    return items;
}

// ============================================================================
// COMBINED DETECTOR
// ============================================================================

/**
 * Run all advanced pattern detectors
 * @param {Object} context - Analysis context
 * @returns {Array} All detected coach items
 */
export function detectAdvancedPatterns(context) {
    const items = [];

    try {
        items.push(...detectTritoneSubstitution(context));
    } catch (e) {
        console.warn('[AdvancedPatternDetector] Tritone sub error:', e);
    }

    try {
        items.push(...detectPedalPoint(context));
    } catch (e) {
        console.warn('[AdvancedPatternDetector] Pedal point error:', e);
    }

    try {
        items.push(...detectChromaticBassLine(context));
    } catch (e) {
        console.warn('[AdvancedPatternDetector] Chromatic bass error:', e);
    }

    try {
        items.push(...detectParallelHarmony(context));
    } catch (e) {
        console.warn('[AdvancedPatternDetector] Parallel harmony error:', e);
    }

    return items;
}

export default detectAdvancedPatterns;
