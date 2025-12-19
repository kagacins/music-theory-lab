/**
 * Progression Context Analysis Module
 *
 * Analyzes chord progression history to provide context-aware recommendations.
 * Detects patterns like cadences, tension arcs, and repetition to inform scoring.
 */

import { ALL_NOTES } from '../../data/music-data.js';
import { getInvertedChordNotes } from '../utils/noteUtils.js';

// Harmonic function definitions (matching comprehensiveChordRecommendations.js)
const HARMONIC_FUNCTIONS = {
    TONIC: 'tonic',
    SUBDOMINANT: 'subdominant',
    DOMINANT: 'dominant'
};

// Map scale degrees to harmonic functions
const DEGREE_TO_FUNCTION = {
    1: HARMONIC_FUNCTIONS.TONIC,
    2: HARMONIC_FUNCTIONS.SUBDOMINANT,
    3: HARMONIC_FUNCTIONS.TONIC,
    4: HARMONIC_FUNCTIONS.SUBDOMINANT,
    5: HARMONIC_FUNCTIONS.DOMINANT,
    6: HARMONIC_FUNCTIONS.TONIC,
    7: HARMONIC_FUNCTIONS.DOMINANT
};

// Tension values for different chord types (0-100)
const CHORD_TYPE_TENSION = {
    'Major': 20,
    'Minor': 30,
    'Dominant 7th': 75,
    'Major 7th': 25,
    'Minor 7th': 40,
    'Diminished': 85,
    'Diminished 7th': 90,
    'Half Diminished 7th': 70,
    'Augmented': 80,
    'Sus4': 55,
    'Sus2': 45,
    'Add9': 30,
    'Major 6th': 25,
    'Minor 6th': 35,
    'Dominant 9th': 70,
    'Major 9th': 30,
    'Minor 9th': 45
};

/**
 * Helper: Get scale degree of a chord root in a key
 * @param {string} chordRoot - Root note of the chord
 * @param {string} key - Musical key (e.g., 'C', 'G', 'Gm')
 * @returns {number|null} Scale degree (1-7) or null
 */
function getScaleDegree(chordRoot, key) {
    // Detect if this is a minor key
    const isMinorKey = key && key.endsWith('m') && !key.endsWith('dim');
    const keyRoot = isMinorKey ? key.slice(0, -1) : key;

    const keyIndex = ALL_NOTES.indexOf(keyRoot);
    const chordIndex = ALL_NOTES.indexOf(chordRoot);

    if (keyIndex === -1 || chordIndex === -1) return null;

    let distance = (chordIndex - keyIndex + 12) % 12;

    // Major scale intervals: 0, 2, 4, 5, 7, 9, 11
    const majorDegreeMap = {
        0: 1,  // I
        2: 2,  // ii
        4: 3,  // iii
        5: 4,  // IV
        7: 5,  // V
        9: 6,  // vi
        11: 7  // vii°
    };

    // Natural minor scale intervals: 0, 2, 3, 5, 7, 8, 10
    const minorDegreeMap = {
        0: 1,   // i
        2: 2,   // ii°
        3: 3,   // III
        5: 4,   // iv
        7: 5,   // v
        8: 6,   // VI
        10: 7   // VII
    };

    const degreeMap = isMinorKey ? minorDegreeMap : majorDegreeMap;
    return degreeMap[distance] || null;
}

/**
 * Helper: Get harmonic function for a chord in a key
 * @param {string} root - Root note
 * @param {string} key - Musical key
 * @returns {string} Harmonic function (tonic/subdominant/dominant)
 */
function getHarmonicFunction(root, key) {
    const degree = getScaleDegree(root, key);
    // IMPORTANT: Don't default borrowed chords (null degree) to TONIC!
    // Return null for borrowed chords so they're not treated as I
    return degree !== null ? (DEGREE_TO_FUNCTION[degree] || HARMONIC_FUNCTIONS.TONIC) : null;
}

/**
 * Helper: Calculate tension value for a chord
 * @param {Object} chord - Chord object {root, type, inversion}
 * @returns {number} Tension value (0-100)
 */
function getChordTension(chord) {
    const baseTension = CHORD_TYPE_TENSION[chord.type] || 50;

    // Inversions can slightly increase tension
    const inversionTension = chord.inversion * 5;

    return Math.min(100, baseTension + inversionTension);
}

/**
 * Detect if progression is approaching a cadence point
 * @param {Array} recentChords - Array of recent chord objects
 * @param {string} key - Musical key
 * @returns {Object} Cadence detection result
 */
export function detectCadenceApproach(recentChords, key) {
    if (recentChords.length < 2) {
        return { approaching: false, type: null, strength: 0 };
    }

    const lastChord = recentChords[recentChords.length - 1];
    const secondLast = recentChords[recentChords.length - 2];

    const lastFunction = getHarmonicFunction(lastChord.root, key);
    const secondLastFunction = getHarmonicFunction(secondLast.root, key);

    // Detect various cadence patterns

    // Authentic Cadence: V → I (or approaching V)
    if (lastFunction === HARMONIC_FUNCTIONS.DOMINANT) {
        return {
            approaching: true,
            type: 'authentic',
            strength: 90,
            expectsTonic: true
        };
    }

    // Plagal Cadence: IV → I (or approaching IV)
    if (lastFunction === HARMONIC_FUNCTIONS.SUBDOMINANT) {
        return {
            approaching: true,
            type: 'plagal',
            strength: 70,
            expectsTonic: true
        };
    }

    // ii-V-I pattern detection (jazz/common progression)
    if (recentChords.length >= 2) {
        if (secondLastFunction === HARMONIC_FUNCTIONS.SUBDOMINANT &&
            lastFunction === HARMONIC_FUNCTIONS.DOMINANT) {
            return {
                approaching: true,
                type: 'ii-V',
                strength: 95,
                expectsTonic: true
            };
        }
    }

    // IV-V-I pattern detection (classical)
    if (recentChords.length >= 3) {
        const thirdLast = recentChords[recentChords.length - 3];
        const thirdLastFunction = getHarmonicFunction(thirdLast.root, key);

        if (thirdLastFunction === HARMONIC_FUNCTIONS.SUBDOMINANT &&
            secondLastFunction === HARMONIC_FUNCTIONS.DOMINANT &&
            lastFunction === HARMONIC_FUNCTIONS.TONIC) {
            // Just completed a full cadence - suggest moving away
            return {
                approaching: false,
                type: 'completed-cadence',
                strength: 0,
                expectsMovement: true
            };
        }
    }

    return { approaching: false, type: null, strength: 0 };
}

/**
 * Analyze tension/release arc over recent progression
 * @param {Array} recentChords - Array of recent chord objects
 * @returns {Object} Tension analysis
 */
export function analyzeTensionArc(recentChords) {
    if (recentChords.length === 0) {
        return { trend: 'neutral', currentTension: 50, trajectory: [] };
    }

    // Calculate tension for each chord
    const tensionValues = recentChords.map(chord => getChordTension(chord));

    // Analyze trend (rising, falling, or stable)
    let trend = 'neutral';
    if (tensionValues.length >= 2) {
        const recent = tensionValues.slice(-3); // Look at last 3 chords
        const avgEarly = recent.slice(0, Math.ceil(recent.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(recent.length / 2);
        const avgLate = recent.slice(Math.floor(recent.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(recent.length / 2);

        if (avgLate > avgEarly + 10) {
            trend = 'rising';
        } else if (avgLate < avgEarly - 10) {
            trend = 'falling';
        } else {
            trend = 'stable';
        }
    }

    return {
        trend,
        currentTension: tensionValues[tensionValues.length - 1],
        trajectory: tensionValues,
        averageTension: tensionValues.reduce((a, b) => a + b, 0) / tensionValues.length
    };
}

/**
 * Analyze bass movement pattern
 * @param {Array} recentChords - Array of recent chord objects
 * @returns {Object} Bass movement analysis
 */
export function analyzeBassMovement(recentChords) {
    if (recentChords.length < 2) {
        return { pattern: 'none', intervals: [] };
    }

    const intervals = [];
    for (let i = 1; i < recentChords.length; i++) {
        const prevRoot = recentChords[i - 1].root;
        const currRoot = recentChords[i].root;

        const prevIndex = ALL_NOTES.indexOf(prevRoot);
        const currIndex = ALL_NOTES.indexOf(currRoot);

        if (prevIndex !== -1 && currIndex !== -1) {
            const interval = (currIndex - prevIndex + 12) % 12;
            intervals.push(interval);
        }
    }

    // Detect patterns
    let pattern = 'varied';

    // Check for stepwise motion (semitone or whole step)
    const stepwise = intervals.filter(i => i <= 2 || i >= 10).length;
    if (stepwise === intervals.length) {
        pattern = 'stepwise';
    }

    // Check for circle of fifths (interval of 7 semitones)
    const fifths = intervals.filter(i => i === 7 || i === 5).length;
    if (fifths >= intervals.length - 1 && intervals.length >= 2) {
        pattern = 'circle-of-fifths';
    }

    // Check for chromatic (all semitones)
    const chromatic = intervals.filter(i => i === 1 || i === 11).length;
    if (chromatic === intervals.length && intervals.length >= 2) {
        pattern = 'chromatic';
    }

    return { pattern, intervals };
}

/**
 * Detect repeated chords in progression
 * @param {Array} recentChords - Array of recent chord objects
 * @param {Object} nextChord - Potential next chord {root, type, inversion}
 * @returns {Object} Repetition analysis
 */
export function analyzeRepetition(recentChords, nextChord) {
    if (recentChords.length === 0) {
        return { isRepeat: false, repeatCount: 0, lastSeen: -1 };
    }

    let repeatCount = 0;
    let lastSeen = -1;

    for (let i = recentChords.length - 1; i >= 0; i--) {
        const chord = recentChords[i];
        if (chord.root === nextChord.root && chord.type === nextChord.type) {
            repeatCount++;
            if (lastSeen === -1) {
                lastSeen = recentChords.length - 1 - i;
            }
        }
    }

    const isRepeat = repeatCount > 0;
    const isImmediate = lastSeen === 0; // Last chord was the same

    return { isRepeat, repeatCount, lastSeen, isImmediate };
}

/**
 * Main function: Analyze progression context
 * @param {Array} progressionData - Full progression array from trainerState
 * @param {string} key - Musical key
 * @param {number} lookbackDepth - Number of chords to analyze (default 4)
 * @returns {Object} Comprehensive context analysis
 */
export function analyzeProgressionContext(progressionData, key, lookbackDepth = 4) {
    // Get recent chords (last N chords)
    const recentChords = progressionData.slice(-lookbackDepth);

    // If no progression history, return minimal context
    if (recentChords.length === 0) {
        return {
            hasContext: false,
            recentChords: [],
            cadence: { approaching: false, type: null, strength: 0 },
            tension: { trend: 'neutral', currentTension: 50, trajectory: [] },
            bassMovement: { pattern: 'none', intervals: [] }
        };
    }

    // Perform all analyses
    const cadence = detectCadenceApproach(recentChords, key);
    const tension = analyzeTensionArc(recentChords);
    const bassMovement = analyzeBassMovement(recentChords);

    return {
        hasContext: true,
        recentChords,
        cadence,
        tension,
        bassMovement,
        progressionLength: progressionData.length
    };
}

/**
 * Score a potential next chord based on progression context
 * @param {Object} nextChord - Potential next chord {root, type, inversion}
 * @param {Object} context - Context analysis from analyzeProgressionContext
 * @param {string} key - Musical key
 * @returns {number} Context-aware score (0-100)
 */
export function scoreContextAwareness(nextChord, context, key) {
    if (!context.hasContext) {
        return 50; // Neutral score if no context
    }

    let score = 50; // Base score
    const reasons = [];

    // 1. Cadence awareness (30 points)
    if (context.cadence.approaching) {
        const nextFunction = getHarmonicFunction(nextChord.root, key);

        if (context.cadence.expectsTonic && nextFunction === HARMONIC_FUNCTIONS.TONIC) {
            score += 30;
            reasons.push('Resolves cadence');
        } else if (context.cadence.type === 'ii-V') {
            // In ii-V progression, tonic is strongly expected
            if (nextFunction === HARMONIC_FUNCTIONS.TONIC) {
                score += 30;
            } else {
                score -= 20; // Penalty for not resolving
            }
        } else {
            score -= 10; // Small penalty for not resolving other cadences
        }
    } else if (context.cadence.expectsMovement) {
        const nextFunction = getHarmonicFunction(nextChord.root, key);
        if (nextFunction !== HARMONIC_FUNCTIONS.TONIC) {
            score += 15;
            reasons.push('Moves away after cadence');
        }
    }

    // 2. Tension arc continuation (25 points)
    const nextTension = getChordTension(nextChord);
    const currentTension = context.tension.currentTension;

    if (context.tension.trend === 'rising') {
        // If tension is rising, reward continued rise or plateau
        if (nextTension >= currentTension) {
            score += 20;
            reasons.push('Continues tension rise');
        } else if (nextTension < currentTension - 20) {
            score += 15; // Big release can also be good
            reasons.push('Releases tension dramatically');
        } else {
            score -= 10; // Awkward partial release
        }
    } else if (context.tension.trend === 'falling') {
        // If tension is falling, reward continued fall or arrival
        if (nextTension <= currentTension) {
            score += 20;
            reasons.push('Continues tension release');
        } else {
            score -= 5; // Slight penalty for reversing trend
        }
    } else {
        // Stable tension - prefer some movement
        if (Math.abs(nextTension - currentTension) > 15) {
            score += 10;
            reasons.push('Adds dynamic contrast');
        }
    }

    // 3. Repetition penalty (20 points)
    const repetition = analyzeRepetition(context.recentChords, nextChord);

    if (repetition.isImmediate) {
        score -= 25; // Strong penalty for immediate repetition
        reasons.push('Repeats previous chord');
    } else if (repetition.isRepeat && repetition.lastSeen <= 2) {
        score -= 15; // Moderate penalty for recent repetition
        reasons.push('Recently used');
    } else if (repetition.repeatCount >= 2) {
        score -= 10; // Small penalty for frequent use
    }

    // 4. Bass movement smoothness (15 points)
    if (context.recentChords.length > 0) {
        const lastChord = context.recentChords[context.recentChords.length - 1];
        const lastRoot = lastChord.root;
        const nextRoot = nextChord.root;

        const lastIndex = ALL_NOTES.indexOf(lastRoot);
        const nextIndex = ALL_NOTES.indexOf(nextRoot);

        if (lastIndex !== -1 && nextIndex !== -1) {
            const interval = Math.min(
                Math.abs(nextIndex - lastIndex),
                12 - Math.abs(nextIndex - lastIndex)
            );

            // Prefer circle of fifths or stepwise
            if (interval === 5 || interval === 7) {
                score += 15; // Perfect for circle of fifths
                reasons.push('Circle of fifths motion');
            } else if (interval <= 2) {
                score += 12; // Good for stepwise
                reasons.push('Smooth bass line');
            } else if (interval >= 6) {
                score -= 5; // Large leaps are less smooth
            }
        }
    }

    // 5. Pattern continuation bonus (10 points)
    if (context.bassMovement.pattern === 'circle-of-fifths') {
        const nextFunction = getHarmonicFunction(nextChord.root, key);
        // Bonus for continuing circle of fifths
        if (context.recentChords.length > 0) {
            const lastRoot = context.recentChords[context.recentChords.length - 1].root;
            const lastIndex = ALL_NOTES.indexOf(lastRoot);
            const nextIndex = ALL_NOTES.indexOf(nextChord.root);
            const interval = (nextIndex - lastIndex + 12) % 12;

            if (interval === 7 || interval === 5) {
                score += 10;
                reasons.push('Continues circle of fifths');
            }
        }
    }

    // Clamp score to 0-100 range
    return Math.max(0, Math.min(100, score));
}
