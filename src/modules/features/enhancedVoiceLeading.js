/**
 * Enhanced Voice Leading Scoring Module
 *
 * Provides advanced voice leading analysis beyond simple distance-based scoring:
 * - Interval-quality-aware bass movement scoring
 * - Parallel fifths/octaves detection
 * - Voice crossing detection
 * - Tendency tone resolution checking
 * - Leap recovery analysis
 * - Soprano contour quality assessment
 */

import { ALL_NOTES } from '../../data/music-data.js';

/**
 * Bass movement quality scores by interval
 * Based on music theory principles:
 * - Perfect 5th/4th movements are strongest in bass
 * - Stepwise motion is smooth
 * - Tritone is unstable
 * - Large leaps (6ths, 7ths) are less common/smooth
 */
const BASS_INTERVAL_SCORES = {
    0: 18,   // Unison - stable but static (slight penalty for no movement)
    1: 10,   // Minor 2nd - chromatic, can be harsh
    2: 16,   // Major 2nd - smooth stepwise motion
    3: 14,   // Minor 3rd - acceptable
    4: 13,   // Major 3rd - acceptable
    5: 22,   // Perfect 4th - very strong bass movement
    6: 6,    // Tritone - unstable, needs careful handling
    7: 25,   // Perfect 5th - strongest, most natural bass movement
    8: 12,   // Minor 6th - less common
    9: 11,   // Major 6th - less common
    10: 14,  // Minor 7th - can work, especially in jazz
    11: 8    // Major 7th - awkward, rare
};

/**
 * Get MIDI pitch class (0-11) from MIDI note number
 */
function getPitchClass(midi) {
    return ((midi % 12) + 12) % 12;
}

/**
 * Get the key's MIDI pitch class from note name
 */
function noteToPitchClass(noteName) {
    if (!noteName) return null;
    const noteBase = noteName.replace(/[0-9]/g, '');
    const index = ALL_NOTES.indexOf(noteBase);
    return index !== -1 ? index : null;
}

/**
 * Detect parallel perfect intervals (fifths and octaves)
 * These are generally avoided in traditional voice leading
 *
 * @param {number[]} currentMidi - Current chord MIDI notes (sorted low to high)
 * @param {number[]} nextMidi - Next chord MIDI notes (sorted low to high)
 * @returns {Object} Detection results with details
 */
export function detectParallelMotion(currentMidi, nextMidi) {
    const issues = {
        parallelFifths: false,
        parallelOctaves: false,
        parallelFifthsCount: 0,
        parallelOctavesCount: 0,
        details: []
    };

    if (currentMidi.length < 2 || nextMidi.length < 2) {
        return issues;
    }

    // Check each voice pair
    const minVoices = Math.min(currentMidi.length, nextMidi.length);

    for (let i = 0; i < minVoices - 1; i++) {
        for (let j = i + 1; j < minVoices; j++) {
            // Current interval between voices i and j
            const currentInterval = getPitchClass(currentMidi[j] - currentMidi[i]);
            // Next interval between same voices
            const nextInterval = getPitchClass(nextMidi[j] - nextMidi[i]);

            // Check if both voices moved
            const voice1Movement = nextMidi[i] - currentMidi[i];
            const voice2Movement = nextMidi[j] - currentMidi[j];

            // Parallel motion = both voices move in same direction
            const isParallelMotion =
                voice1Movement !== 0 &&
                voice2Movement !== 0 &&
                Math.sign(voice1Movement) === Math.sign(voice2Movement);

            if (isParallelMotion) {
                // Check for parallel fifths (interval of 7 semitones)
                if (currentInterval === 7 && nextInterval === 7) {
                    issues.parallelFifths = true;
                    issues.parallelFifthsCount++;
                    issues.details.push({
                        type: 'parallel_fifths',
                        voices: [i, j],
                        description: `Parallel 5ths between voices ${i + 1} and ${j + 1}`
                    });
                }

                // Check for parallel octaves (interval of 0 semitones, but different octaves)
                if (currentInterval === 0 && nextInterval === 0 && voice1Movement !== 0) {
                    issues.parallelOctaves = true;
                    issues.parallelOctavesCount++;
                    issues.details.push({
                        type: 'parallel_octaves',
                        voices: [i, j],
                        description: `Parallel 8ves between voices ${i + 1} and ${j + 1}`
                    });
                }
            }
        }
    }

    return issues;
}

/**
 * Detect voice crossings
 * Voice crossing occurs when a voice moves above a higher voice or below a lower voice
 *
 * @param {number[]} currentMidi - Current chord MIDI notes (sorted low to high)
 * @param {number[]} nextMidi - Next chord MIDI notes (sorted low to high)
 * @returns {Object} Voice crossing detection results
 */
export function detectVoiceCrossing(currentMidi, nextMidi) {
    const crossings = {
        count: 0,
        details: []
    };

    if (currentMidi.length < 2 || nextMidi.length < 2) {
        return crossings;
    }

    const minVoices = Math.min(currentMidi.length, nextMidi.length);

    for (let i = 0; i < minVoices - 1; i++) {
        // Check if voice i crosses above voice i+1
        if (nextMidi[i] > nextMidi[i + 1]) {
            crossings.count++;
            crossings.details.push({
                type: 'crossing',
                voices: [i, i + 1],
                description: `Voice ${i + 1} crosses above voice ${i + 2}`
            });
        }
    }

    return crossings;
}

/**
 * Check resolution of tendency tones
 * - Leading tone (scale degree 7) should resolve up to tonic
 * - Scale degree 4 often resolves down to 3
 * - Tritone (in dominant 7th) resolves inward or outward
 *
 * @param {number[]} currentMidi - Current chord MIDI notes
 * @param {number[]} nextMidi - Next chord MIDI notes
 * @param {string} key - Musical key
 * @returns {Object} Resolution analysis
 */
export function checkTendencyToneResolution(currentMidi, nextMidi, key) {
    const keyPitchClass = noteToPitchClass(key);
    if (keyPitchClass === null) {
        return { score: 0, resolved: [], unresolved: [], details: [] };
    }

    const result = {
        score: 0,
        resolved: [],
        unresolved: [],
        details: []
    };

    // Define tendency tones relative to key
    const leadingTone = (keyPitchClass + 11) % 12;  // Scale degree 7
    const tonic = keyPitchClass;                     // Scale degree 1
    const fourthDegree = (keyPitchClass + 5) % 12;  // Scale degree 4
    const thirdDegree = (keyPitchClass + 4) % 12;   // Scale degree 3
    const seventhOfV = (keyPitchClass + 11) % 12;   // Leading tone
    const tritonePartner = (keyPitchClass + 6) % 12; // Tritone from tonic

    // Check each voice
    for (let i = 0; i < currentMidi.length && i < nextMidi.length; i++) {
        const currentPC = getPitchClass(currentMidi[i]);
        const nextPC = getPitchClass(nextMidi[i]);
        const movement = nextMidi[i] - currentMidi[i];

        // Leading tone resolution (7 → 1)
        if (currentPC === leadingTone) {
            if (nextPC === tonic && movement > 0 && movement <= 2) {
                // Proper resolution: up by step to tonic
                result.score += 12;
                result.resolved.push({
                    voice: i,
                    type: 'leading_tone',
                    from: currentPC,
                    to: nextPC
                });
                result.details.push(`Voice ${i + 1}: Leading tone resolves up to tonic`);
            } else if (nextPC === tonic) {
                // Resolved but by leap - less ideal
                result.score += 5;
                result.resolved.push({
                    voice: i,
                    type: 'leading_tone_leap',
                    from: currentPC,
                    to: nextPC
                });
            } else {
                // Unresolved leading tone
                result.score -= 8;
                result.unresolved.push({
                    voice: i,
                    type: 'leading_tone',
                    from: currentPC,
                    to: nextPC
                });
                result.details.push(`Voice ${i + 1}: Unresolved leading tone`);
            }
        }

        // Fourth degree resolution (4 → 3)
        if (currentPC === fourthDegree) {
            if (nextPC === thirdDegree && movement < 0 && movement >= -2) {
                // Proper resolution: down by step to third
                result.score += 6;
                result.resolved.push({
                    voice: i,
                    type: 'fourth_degree',
                    from: currentPC,
                    to: nextPC
                });
            }
            // 4th degree can also resolve up to 5, so no penalty for other movements
        }

        // Tritone resolution (in context of dominant 7th)
        if (currentPC === tritonePartner) {
            // The tritone (augmented 4th/diminished 5th from tonic) typically resolves inward
            const resolvesIn = (nextPC === thirdDegree || nextPC === (keyPitchClass + 7) % 12);
            if (resolvesIn) {
                result.score += 5;
                result.resolved.push({
                    voice: i,
                    type: 'tritone',
                    from: currentPC,
                    to: nextPC
                });
            }
        }
    }

    return result;
}

/**
 * Analyze leap recovery
 * Large leaps (more than a 3rd) should typically be followed by stepwise motion
 * in the opposite direction
 *
 * @param {number[]} currentMidi - Current chord MIDI notes
 * @param {number[]} nextMidi - Next chord MIDI notes
 * @param {number[]} previousMidi - Previous chord MIDI notes (optional)
 * @returns {Object} Leap recovery analysis
 */
export function analyzeLeapRecovery(currentMidi, nextMidi, previousMidi = null) {
    const result = {
        score: 0,
        details: []
    };

    if (!previousMidi || previousMidi.length === 0) {
        // Can't analyze leap recovery without previous chord
        return result;
    }

    const minVoices = Math.min(previousMidi.length, currentMidi.length, nextMidi.length);

    for (let i = 0; i < minVoices; i++) {
        const previousLeap = currentMidi[i] - previousMidi[i];
        const currentMovement = nextMidi[i] - currentMidi[i];

        // Check if previous movement was a leap (more than 4 semitones = major 3rd)
        if (Math.abs(previousLeap) > 4) {
            // This voice had a leap
            const leapDirection = Math.sign(previousLeap);
            const recoveryDirection = Math.sign(currentMovement);

            if (recoveryDirection !== 0 && recoveryDirection !== leapDirection) {
                // Moving in opposite direction (good recovery)
                if (Math.abs(currentMovement) <= 2) {
                    // Stepwise recovery - ideal
                    result.score += 8;
                    result.details.push({
                        voice: i,
                        type: 'stepwise_recovery',
                        leap: previousLeap,
                        recovery: currentMovement
                    });
                } else if (Math.abs(currentMovement) <= 4) {
                    // Small leap recovery - acceptable
                    result.score += 4;
                    result.details.push({
                        voice: i,
                        type: 'small_leap_recovery',
                        leap: previousLeap,
                        recovery: currentMovement
                    });
                }
            } else if (recoveryDirection === leapDirection && Math.abs(currentMovement) > 2) {
                // Continuing in same direction after leap - less ideal
                result.score -= 5;
                result.details.push({
                    voice: i,
                    type: 'unrecovered_leap',
                    leap: previousLeap,
                    movement: currentMovement
                });
            }
        }
    }

    return result;
}

/**
 * Analyze soprano (top voice) contour quality
 * A good melody/soprano line has variety and direction
 *
 * @param {number[]} currentMidi - Current chord MIDI notes
 * @param {number[]} nextMidi - Next chord MIDI notes
 * @returns {Object} Soprano contour analysis
 */
export function analyzeSopranoContour(currentMidi, nextMidi) {
    if (currentMidi.length === 0 || nextMidi.length === 0) {
        return { score: 0, quality: null };
    }

    const currentSoprano = currentMidi[currentMidi.length - 1];
    const nextSoprano = nextMidi[nextMidi.length - 1];
    const movement = nextSoprano - currentSoprano;

    let score = 0;
    let quality = null;

    if (movement === 0) {
        // Static soprano - neutral
        score = 5;
        quality = 'static';
    } else if (Math.abs(movement) <= 2) {
        // Stepwise - very good for melody
        score = 12;
        quality = 'stepwise';
    } else if (Math.abs(movement) <= 4) {
        // Small leap (3rd) - good
        score = 10;
        quality = 'small_leap';
    } else if (Math.abs(movement) <= 7) {
        // Medium leap (4th/5th) - acceptable
        score = 6;
        quality = 'medium_leap';
    } else if (Math.abs(movement) <= 9) {
        // Larger leap (6th) - use sparingly
        score = 3;
        quality = 'large_leap';
    } else {
        // Very large leap (7th+) - rare, can be dramatic
        score = 0;
        quality = 'very_large_leap';
    }

    return { score, quality, movement };
}

/**
 * Main enhanced voice leading scoring function
 * Combines all voice leading analysis into a single comprehensive score
 *
 * @param {number[]} currentMidi - Current chord MIDI notes
 * @param {number[]} nextMidi - Next chord MIDI notes
 * @param {string} key - Musical key
 * @param {Object} options - Additional options
 * @returns {Object} Comprehensive voice leading analysis
 */
export function scoreEnhancedVoiceLeading(currentMidi, nextMidi, key, options = {}) {
    const { previousMidi = null, style = 'balanced' } = options;

    let totalScore = 0;
    const breakdown = {};
    const details = [];
    const issues = [];

    // Safety check for invalid MIDI arrays
    if (!currentMidi || !nextMidi || !Array.isArray(currentMidi) || !Array.isArray(nextMidi)) {
        return {
            score: 50, // Neutral score
            breakdown: {},
            details: [],
            issues: ['Invalid chord data'],
            hasParallelFifths: false,
            hasParallelOctaves: false,
            tendencyToneResolved: false,
            contraryMotion: false
        };
    }

    // 1. Bass Movement Quality (0-25 points)
    if (currentMidi.length > 0 && nextMidi.length > 0) {
        const bassInterval = Math.abs(nextMidi[0] - currentMidi[0]) % 12;
        const bassScore = BASS_INTERVAL_SCORES[bassInterval] || 10;
        breakdown.bassMovement = bassScore;
        totalScore += bassScore;

        if (bassInterval === 7 || bassInterval === 5) {
            details.push('Strong bass movement (4th/5th)');
        } else if (bassInterval <= 2 && bassInterval > 0) {
            details.push('Smooth stepwise bass');
        } else if (bassInterval === 0) {
            details.push('Pedal bass');
        }
    }

    // 2. Parallel Motion Detection (-15 to 0 points)
    const parallelMotion = detectParallelMotion(currentMidi, nextMidi);
    let parallelPenalty = 0;

    if (parallelMotion.parallelFifths) {
        // Classical style penalizes parallel fifths heavily, jazz less so
        parallelPenalty -= style === 'classical' ? 15 : 8;
        issues.push('Parallel 5ths');
    }
    if (parallelMotion.parallelOctaves) {
        parallelPenalty -= style === 'classical' ? 12 : 6;
        issues.push('Parallel 8ves');
    }

    breakdown.parallelMotion = parallelPenalty;
    totalScore += parallelPenalty;

    // 3. Voice Crossing Detection (-8 to 0 points per crossing)
    const voiceCrossing = detectVoiceCrossing(currentMidi, nextMidi);
    const crossingPenalty = -voiceCrossing.count * 8;
    breakdown.voiceCrossing = crossingPenalty;
    totalScore += crossingPenalty;

    if (voiceCrossing.count > 0) {
        issues.push(`${voiceCrossing.count} voice crossing(s)`);
    }

    // 4. Tendency Tone Resolution (-8 to +12 points)
    const tendencyResolution = checkTendencyToneResolution(currentMidi, nextMidi, key);
    breakdown.tendencyTones = tendencyResolution.score;
    totalScore += tendencyResolution.score;

    if (tendencyResolution.resolved.length > 0) {
        details.push('Proper resolution of tendency tones');
    }
    if (tendencyResolution.unresolved.length > 0) {
        issues.push('Unresolved tendency tone(s)');
    }

    // 5. Leap Recovery Analysis (-5 to +8 points)
    const leapRecovery = analyzeLeapRecovery(currentMidi, nextMidi, previousMidi);
    breakdown.leapRecovery = leapRecovery.score;
    totalScore += leapRecovery.score;

    // 6. Soprano Contour (0-12 points)
    const sopranoContour = analyzeSopranoContour(currentMidi, nextMidi);
    breakdown.sopranoContour = sopranoContour.score;
    totalScore += sopranoContour.score;

    if (sopranoContour.quality === 'stepwise') {
        details.push('Smooth soprano line');
    }

    // 7. Common Tones (0-20 points)
    const commonTones = currentMidi.filter(n1 =>
        nextMidi.some(n2 => getPitchClass(n2) === getPitchClass(n1))
    ).length;
    const commonToneScore = Math.min(20, commonTones * 7);
    breakdown.commonTones = commonToneScore;
    totalScore += commonToneScore;

    if (commonTones >= 2) {
        details.push(`${commonTones} common tones`);
    }

    // 8. Total Voice Movement (0-20 points)
    let totalMovement = 0;
    const minVoices = Math.min(currentMidi.length, nextMidi.length);
    for (let i = 0; i < minVoices; i++) {
        totalMovement += Math.abs(nextMidi[i] - currentMidi[i]);
    }
    const movementScore = Math.max(0, 20 - (totalMovement / 3));
    breakdown.totalMovement = Math.round(movementScore);
    totalScore += movementScore;

    if (totalMovement <= 6) {
        details.push('Very efficient voice leading');
    } else if (totalMovement <= 12) {
        details.push('Smooth voice leading');
    }

    // 9. Contrary Motion Bonus (0-8 points)
    if (currentMidi.length > 1 && nextMidi.length > 1) {
        const bassMovement = nextMidi[0] - currentMidi[0];
        const sopranoMovement = nextMidi[nextMidi.length - 1] - currentMidi[currentMidi.length - 1];

        if (bassMovement !== 0 && sopranoMovement !== 0 &&
            Math.sign(bassMovement) !== Math.sign(sopranoMovement)) {
            breakdown.contraryMotion = 8;
            totalScore += 8;
            details.push('Contrary motion in outer voices');
        } else {
            breakdown.contraryMotion = 0;
        }
    }

    // Normalize to 0-100 scale
    // Maximum possible: 25 + 0 + 0 + 12 + 8 + 12 + 20 + 20 + 8 = 105
    // Minimum possible: 6 - 27 - 24 - 8 - 5 + 0 + 0 + 0 + 0 = -58
    const normalizedScore = Math.max(0, Math.min(100, totalScore + 30));

    return {
        score: Math.round(normalizedScore),
        rawScore: Math.round(totalScore),
        breakdown,
        details,
        issues,
        parallelMotion,
        voiceCrossing,
        tendencyResolution,
        sopranoContour
    };
}

/**
 * Quick voice leading score for performance-critical scenarios
 * Uses simplified calculations
 *
 * @param {number[]} currentMidi - Current chord MIDI notes
 * @param {number[]} nextMidi - Next chord MIDI notes
 * @returns {number} Score 0-100
 */
export function scoreVoiceLeadingQuick(currentMidi, nextMidi) {
    if (currentMidi.length === 0 || nextMidi.length === 0) {
        return 50;
    }

    let score = 50;

    // Bass movement
    const bassInterval = Math.abs(nextMidi[0] - currentMidi[0]) % 12;
    score += (BASS_INTERVAL_SCORES[bassInterval] || 10) - 12; // Centered around 0

    // Common tones
    const commonTones = currentMidi.filter(n1 =>
        nextMidi.some(n2 => getPitchClass(n2) === getPitchClass(n1))
    ).length;
    score += commonTones * 5;

    // Total movement penalty
    const minVoices = Math.min(currentMidi.length, nextMidi.length);
    let totalMovement = 0;
    for (let i = 0; i < minVoices; i++) {
        totalMovement += Math.abs(nextMidi[i] - currentMidi[i]);
    }
    score -= totalMovement / 4;

    // Quick parallel fifths check (just outer voices)
    if (currentMidi.length >= 2 && nextMidi.length >= 2) {
        const currentOuter = getPitchClass(currentMidi[currentMidi.length - 1] - currentMidi[0]);
        const nextOuter = getPitchClass(nextMidi[nextMidi.length - 1] - nextMidi[0]);
        const bassMove = nextMidi[0] - currentMidi[0];
        const sopMove = nextMidi[nextMidi.length - 1] - currentMidi[currentMidi.length - 1];

        if (currentOuter === 7 && nextOuter === 7 &&
            bassMove !== 0 && Math.sign(bassMove) === Math.sign(sopMove)) {
            score -= 10;
        }
    }

    return Math.max(0, Math.min(100, Math.round(score)));
}
