/**
 * Comprehensive Chord Recommendation Engine
 *
 * A 3D scoring system that evaluates all possible next chords across three dimensions:
 * 1. Root Note (12 chromatic possibilities)
 * 2. Chord Type (Major, Minor, Dominant 7th, etc.)
 * 3. Inversion (Root, 1st, 2nd, etc.)
 *
 * Plus a 4th dimension: Tension Direction (resolve, maintain, build)
 *
 * Each (root, type, inversion) combination is scored based on:
 * - Voice leading quality (bass movement, common tones, total movement)
 * - Harmonic function relationships (tonic → subdominant → dominant)
 * - Style preferences (pop, jazz, classical, rock, indie)
 * - Mood preferences (bright, dark, jazzy, tense, calm, energetic)
 * - Tension trajectory (whether to resolve, maintain, or build tension)
 */

import { CHORD_DEFINITIONS, ALL_NOTES } from '../../data/music-data.js';
import { getInvertedChordNotes, noteToMidi } from '../utils/noteUtils.js';
import { analyzeProgressionContext, scoreContextAwareness } from './progressionContext.js';
import { getSavedWeights } from '../config/weightPresets.js';

// Harmonic function definitions
const HARMONIC_FUNCTIONS = {
    TONIC: 'tonic',           // I, iii, vi
    SUBDOMINANT: 'subdominant', // ii, IV
    DOMINANT: 'dominant'       // V, vii°
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

// Common chord types to evaluate (ordered by commonality)
const CHORD_TYPES_TO_EVALUATE = [
    'Major',
    'Minor',
    'Dominant 7th',
    'Major 7th',
    'Minor 7th',
    'Diminished',
    'Suspended 4th',
    'Suspended 2nd',
    'Add9',
    'Major 6th',
    'Minor 6th',
    'Dominant 9th',
    'Major 9th',
    'Minor 9th',
    'Augmented',
    'Half Diminished 7th',
    'Diminished 7th'
];

// Modal interchange: Define borrowed chords from parallel modes
// Format: { mode: [[interval, chordType, commonality]] }
const MODAL_INTERCHANGE_CHORDS = {
    'parallel-minor': [
        [0, 'Minor', 85],      // i - parallel minor tonic
        [3, 'Major', 70],      // ♭III - borrowed major III
        [5, 'Minor', 95],      // iv - minor subdominant (VERY common)
        [8, 'Major', 85],      // ♭VI - borrowed flat VI (common)
        [10, 'Major', 90]      // ♭VII - borrowed flat VII (rock staple)
    ],
    'dorian': [
        [0, 'Minor', 60],      // i - Dorian tonic
        [2, 'Minor', 55],      // ii - Dorian ii
        [5, 'Major', 65],      // IV - Dorian IV
        [7, 'Minor', 50]       // v - minor dominant
    ],
    'phrygian': [
        [0, 'Minor', 45],      // i - Phrygian tonic
        [1, 'Major', 60],      // ♭II - Phrygian flat II (exotic)
        [5, 'Minor', 50],      // iv - Phrygian iv
        [8, 'Diminished', 40]  // vi° - Phrygian diminished vi
    ],
    'lydian': [
        [0, 'Major', 55],      // I - Lydian tonic
        [2, 'Major', 60],      // II - Lydian II (raised 4th)
        [4, 'Minor', 50],      // iii - Lydian iii
        [6, 'Diminished', 45]  // #iv° - Lydian sharp 4
    ],
    'mixolydian': [
        [0, 'Major', 70],      // I - Mixolydian tonic
        [2, 'Minor', 60],      // ii - Mixolydian ii
        [5, 'Major', 65],      // IV - Mixolydian IV
        [10, 'Major', 85]      // ♭VII - Mixolydian flat VII (common in rock)
    ]
};

/**
 * Helper: Get scale degree of a chord root in a key
 * @param {string} chordRoot - Root note of the chord (e.g., 'C', 'F#')
 * @param {string} key - Musical key (e.g., 'C', 'G')
 * @returns {number|null} Scale degree (1-7) or null if invalid
 */
function getScaleDegree(chordRoot, key) {
    const keyIndex = ALL_NOTES.indexOf(key);
    const chordIndex = ALL_NOTES.indexOf(chordRoot);

    if (keyIndex === -1 || chordIndex === -1) return null;

    // Calculate semitone distance
    let distance = (chordIndex - keyIndex + 12) % 12;

    // Map to scale degree (major scale)
    const degreeMap = {
        0: 1,  // Root (I)
        2: 2,  // 2nd (ii)
        4: 3,  // 3rd (iii)
        5: 4,  // 4th (IV)
        7: 5,  // 5th (V)
        9: 6,  // 6th (vi)
        11: 7  // 7th (vii°)
    };

    return degreeMap[distance] || null;
}

/**
 * Helper: Check if a chord is diatonic (naturally in the key)
 * @param {string} chordRoot - Root note of the chord
 * @param {string} chordType - Chord type
 * @param {string} key - Musical key
 * @returns {boolean} True if the chord is diatonic to the key
 */
function isDiatonic(chordRoot, chordType, key) {
    const keyIndex = ALL_NOTES.indexOf(key);
    const chordIndex = ALL_NOTES.indexOf(chordRoot);

    if (keyIndex === -1 || chordIndex === -1) return false;

    // Calculate interval from key root
    const interval = (chordIndex - keyIndex + 12) % 12;

    // Diatonic chords in major key (interval -> expected chord type)
    const majorKeyDiatonic = {
        0: ['Major', 'Major 7th', 'Major 6th', 'Major 9th'],  // I
        2: ['Minor', 'Minor 7th', 'Minor 6th', 'Minor 9th'],  // ii
        4: ['Minor', 'Minor 7th', 'Minor 6th', 'Minor 9th'],  // iii
        5: ['Major', 'Major 7th', 'Major 6th', 'Major 9th'],  // IV
        7: ['Major', 'Dominant 7th', 'Dominant 9th', 'Major'], // V (can be major or dom7)
        9: ['Minor', 'Minor 7th', 'Minor 6th', 'Minor 9th'],  // vi
        11: ['Diminished', 'Half Diminished 7th', 'Diminished 7th'] // vii°
    };

    // Check if this interval and chord type match a diatonic chord
    if (majorKeyDiatonic[interval]) {
        return majorKeyDiatonic[interval].includes(chordType);
    }

    return false;
}

/**
 * Helper: Check if a chord is borrowed from a parallel mode
 * @param {string} chordRoot - Root note of the chord
 * @param {string} chordType - Chord type
 * @param {string} key - Musical key
 * @returns {Object|null} {mode: string, commonality: number, sourceMode: string} or null if diatonic
 */
function getBorrowedChordInfo(chordRoot, chordType, key) {
    const keyIndex = ALL_NOTES.indexOf(key);
    const chordIndex = ALL_NOTES.indexOf(chordRoot);

    if (keyIndex === -1 || chordIndex === -1) return null;

    // IMPORTANT: First check if this is a diatonic chord
    // If it's naturally in the key, it's NOT borrowed!
    if (isDiatonic(chordRoot, chordType, key)) {
        return null; // Diatonic, not borrowed
    }

    // Calculate interval from key root
    const interval = (chordIndex - keyIndex + 12) % 12;

    // Check each mode to see if this chord exists as a borrowed chord
    for (const [modeName, chords] of Object.entries(MODAL_INTERCHANGE_CHORDS)) {
        for (const [chordInterval, chordTypePattern, commonality] of chords) {
            if (interval === chordInterval && chordType === chordTypePattern) {
                return {
                    mode: modeName,
                    commonality: commonality,
                    sourceMode: modeName
                };
            }
        }
    }

    return null; // Not a borrowed chord (might be chromatic/other)
}

/**
 * Helper: Get all borrowed chords for a key across all modes
 * @param {string} key - Musical key
 * @returns {Array} Array of {root, type, mode, commonality}
 */
function getAllBorrowedChords(key) {
    const keyIndex = ALL_NOTES.indexOf(key);
    if (keyIndex === -1) return [];

    const borrowed = [];

    for (const [modeName, chords] of Object.entries(MODAL_INTERCHANGE_CHORDS)) {
        for (const [interval, chordType, commonality] of chords) {
            const rootIndex = (keyIndex + interval) % 12;
            const root = ALL_NOTES[rootIndex];

            borrowed.push({
                root,
                type: chordType,
                mode: modeName,
                commonality
            });
        }
    }

    return borrowed;
}

/**
 * Score modal interchange appropriateness
 * Evaluates how well a borrowed chord fits the context
 * @param {string} chordRoot - Root note of the chord
 * @param {string} chordType - Chord type
 * @param {string} key - Musical key
 * @param {string} style - Style preference
 * @param {string} mood - Mood preference
 * @param {Object} context - Progression context (optional)
 * @returns {number} Modal interchange score (0-100)
 */
function scoreModalInterchange(chordRoot, chordType, key, style, mood, context = null) {
    // Check if this is a borrowed chord
    const borrowedInfo = getBorrowedChordInfo(chordRoot, chordType, key);

    // If it's not a borrowed chord, return neutral score
    if (!borrowedInfo) {
        return 50; // Diatonic chords get neutral modal interchange score
    }

    let score = borrowedInfo.commonality; // Start with base commonality (40-95)

    // 1. Context Appropriateness (adjust ±20 points)
    if (context && context.hasContext) {
        // Don't suggest borrowed chords on the first chord
        if (context.progressionLength < 2) {
            score -= 30; // Strong penalty
        }

        // Don't suggest during a resolution (would undermine the cadence)
        if (context.cadence.approaching && context.cadence.expectsTonic) {
            score -= 25; // Penalty for disrupting cadence
        }

        // Encourage before cadences (adds emotional weight)
        if (context.cadence.approaching && !context.cadence.expectsTonic) {
            score += 15; // Bonus for pre-cadence color
        }

        // Encourage when building tension
        if (context.tension.trend === 'rising') {
            score += 10;
        }
    }

    // 2. Source Mode Alignment with Style (adjust ±15 points)
    const modeStyleFit = {
        'parallel-minor': {
            'rock': 20,      // ♭VII is a rock staple
            'pop': 15,       // Common in modern pop
            'indie': 18,     // Very common in indie
            'jazz': 10,      // Used but not defining
            'classical': -10 // Less common in classical
        },
        'mixolydian': {
            'rock': 18,      // Mixolydian ♭VII is classic rock
            'blues': 20,     // Essential for blues
            'pop': 10,
            'jazz': 12,
            'classical': -5
        },
        'dorian': {
            'jazz': 20,      // Very jazzy/soulful
            'rnbSoul': 18,
            'pop': 8,
            'rock': 5,
            'classical': -5
        },
        'phrygian': {
            'latinJazz': 20, // Spanish/exotic
            'indie': 12,
            'jazz': 10,
            'pop': 5,
            'classical': 5
        },
        'lydian': {
            'jazz': 15,      // Dreamy, sophisticated
            'indie': 15,
            'pop': 10,
            'classical': 8,
            'rock': 5
        }
    };

    const styleFitMap = modeStyleFit[borrowedInfo.mode];
    if (styleFitMap && styleFitMap[style] !== undefined) {
        score += styleFitMap[style];
    }

    // 3. Source Mode Alignment with Mood (adjust ±15 points)
    const modeMoodFit = {
        'parallel-minor': {
            'dark': 20,      // Perfect for dark moods
            'tense': 15,
            'calm': -10,
            'bright': -15    // Contradicts bright mood
        },
        'mixolydian': {
            'energetic': 15,
            'bright': 10,
            'jazzy': 10,
            'dark': -5
        },
        'dorian': {
            'jazzy': 20,
            'calm': 10,
            'dark': 5,
            'bright': -5
        },
        'phrygian': {
            'tense': 18,
            'dark': 15,
            'bright': -10,
            'calm': -10
        },
        'lydian': {
            'bright': 18,
            'calm': 15,
            'dark': -10,
            'tense': -5
        }
    };

    const moodFitMap = modeMoodFit[borrowedInfo.mode];
    if (moodFitMap && moodFitMap[mood] !== undefined) {
        score += moodFitMap[mood];
    }

    // Clamp to 0-100
    return Math.max(0, Math.min(100, score));
}

/**
 * Main function: Generate comprehensive chord recommendations
 * @param {string} currentRoot - Current root note (e.g., 'C')
 * @param {string} currentChordType - Current chord type (e.g., 'Major')
 * @param {number} currentInversion - Current inversion (0, 1, 2, etc.)
 * @param {string} key - Musical key context (e.g., 'C')
 * @param {string} style - Style preference ('balanced', 'pop', 'jazz', 'classical', 'rock', 'indie')
 * @param {string} mood - Mood preference ('bright', 'dark', 'jazzy', 'tense', 'calm', 'energetic')
 * @param {string} tensionDirection - Tension direction ('resolve', 'maintain', 'build')
 * @param {number} limit - Maximum number of results to return (default 10, use 0 or null for all)
 * @param {Array} progressionData - Full progression history (optional, for context-aware mode)
 * @param {boolean} contextMode - Enable context-aware scoring (default false)
 * @param {number} lookbackDepth - Number of previous chords to analyze (default 4)
 * @returns {Array<{root:string, type:string, inversion:number, score:number, reason:string, confidence:number}>}
 */
export function generateComprehensiveRecommendations(
    currentRoot,
    currentChordType,
    currentInversion = 0,
    key = 'C',
    style = 'balanced',
    mood = 'bright',
    tensionDirection = 'resolve',
    limit = 10,
    progressionData = [],
    contextMode = false,
    lookbackDepth = 4,
    customWeights = null
) {
    const recommendations = [];

    // Get current chord's MIDI notes for voice leading analysis
    const currentMidi = getChordMidi(currentRoot, currentChordType, currentInversion);
    if (currentMidi.length === 0) {
        return getDefaultRecommendations(key);
    }

    // Get current chord's harmonic function in the key
    const currentDegree = getScaleDegree(currentRoot, key);
    // IMPORTANT: Don't default borrowed chords (null degree) to TONIC!
    // Borrowed chords should be handled separately, not treated as I
    const currentFunction = currentDegree !== null ? (DEGREE_TO_FUNCTION[currentDegree] || HARMONIC_FUNCTIONS.TONIC) : null;

    // Analyze progression context if context mode is enabled
    let context = null;
    if (contextMode && progressionData && progressionData.length > 0) {
        context = analyzeProgressionContext(progressionData, key, lookbackDepth);
    }

    // Evaluate all possible next chords across all three dimensions
    ALL_NOTES.forEach(nextRoot => {
        const nextDegree = getScaleDegree(nextRoot, key);
        // IMPORTANT: Don't default borrowed chords (null degree) to TONIC!
        // This was causing D#add9 to be scored as I chord (tonic)
        const nextFunction = nextDegree !== null ? (DEGREE_TO_FUNCTION[nextDegree] || HARMONIC_FUNCTIONS.TONIC) : null;

        // Get harmonic function score (how well does this root fit the progression?)
        const functionScore = scoreHarmonicFunction(currentFunction, nextFunction, tensionDirection);

        // Skip roots with very poor harmonic relationships (unless jazz/indie style)
        if (functionScore < 10 && style !== 'jazz' && style !== 'indie') {
            return; // Skip this root
        }

        // For each root, evaluate multiple chord types
        CHORD_TYPES_TO_EVALUATE.forEach(nextType => {
            const chordDef = CHORD_DEFINITIONS[nextType];
            if (!chordDef) return;

            // Get style/mood fit for this chord type
            const styleFit = scoreStyleFit(nextType, style);
            const moodFit = scoreMoodFit(nextType, currentChordType, mood);

            // Skip chord types that don't fit style/mood (unless balanced)
            if ((styleFit < 20 || moodFit < 20) && style !== 'balanced') {
                return; // Skip this chord type
            }

            // For each chord type, evaluate all possible inversions
            const maxInversion = chordDef.intervals.length - 1;
            for (let nextInversion = 0; nextInversion <= maxInversion; nextInversion++) {
                const nextMidi = getChordMidi(nextRoot, nextType, nextInversion);
                if (nextMidi.length === 0) continue;

                // Calculate comprehensive voice leading score
                const voiceLeadingScore = scoreVoiceLeading(currentMidi, nextMidi, nextInversion);

                // Calculate context-aware score if enabled
                let contextScore = 0;
                if (context && context.hasContext) {
                    contextScore = scoreContextAwareness(
                        { root: nextRoot, type: nextType, inversion: nextInversion },
                        context,
                        key
                    );
                }

                // Calculate modal interchange score
                const modalInterchangeScore = scoreModalInterchange(
                    nextRoot,
                    nextType,
                    key,
                    style,
                    mood,
                    context
                );

                // Get custom weights from parameter, or from localStorage (or defaults)
                const weights = customWeights || getSavedWeights(contextMode);

                // Calculate total score (weighted combination using custom weights)
                let totalScore;
                if (contextMode && context && context.hasContext) {
                    // Context-aware mode: use context weights (includes context and modal interchange factors)
                    totalScore =
                        (functionScore * weights.harmonic) +
                        (voiceLeadingScore * weights.voiceLeading) +
                        (styleFit * weights.style) +
                        (moodFit * weights.mood) +
                        (contextScore * (weights.context || 0)) +
                        (modalInterchangeScore * (weights.modalInterchange || 0));
                } else {
                    // Standard mode: use standard weights (includes modal interchange factor)
                    totalScore =
                        (functionScore * weights.harmonic) +
                        (voiceLeadingScore * weights.voiceLeading) +
                        (styleFit * weights.style) +
                        (moodFit * weights.mood) +
                        (modalInterchangeScore * (weights.modalInterchange || 0));
                }

                // Apply penalty for recommending the exact same chord and inversion
                // (Generally not musically useful to repeat the exact same chord immediately)
                if (nextRoot === currentRoot && nextType === currentChordType && nextInversion === currentInversion) {
                    totalScore *= 0.3; // 70% penalty for exact repetition
                }

                // Check if this is a borrowed chord
                const borrowedInfo = getBorrowedChordInfo(nextRoot, nextType, key);

                // Generate human-readable reason
                const reason = generateReason(
                    currentRoot, nextRoot, nextType, nextInversion,
                    functionScore, voiceLeadingScore, styleFit, moodFit,
                    currentFunction, nextFunction, tensionDirection,
                    contextScore, context, modalInterchangeScore, borrowedInfo
                );

                recommendations.push({
                    root: nextRoot,
                    type: nextType,
                    inversion: nextInversion,
                    score: Math.round(totalScore),
                    reason: reason,
                    confidence: Math.min(100, Math.round(totalScore)),
                    functionScore,
                    voiceLeadingScore,
                    styleFit,
                    moodFit,
                    contextScore,
                    modalInterchangeScore,
                    borrowedFrom: borrowedInfo ? borrowedInfo.mode : null
                });
            }
        });
    });

    // Sort by total score (highest first)
    recommendations.sort((a, b) => b.score - a.score);

    // Return limited results (or all if limit is 0/null)
    if (limit && limit > 0) {
        return recommendations.slice(0, limit);
    }
    return recommendations; // Return all
}

/**
 * Score harmonic function relationships
 * Returns 0-100 score based on how well the harmonic progression works
 */
function scoreHarmonicFunction(currentFunction, nextFunction, tensionDirection) {
    let score = 50; // Base score

    // Handle borrowed chords (chords outside the key)
    // These have null function and should NOT be treated as TONIC
    if (currentFunction === null || nextFunction === null) {
        // Borrowed chords get a neutral base score
        // Modal interchange scoring will handle their appropriateness separately
        return 50; // Neutral - let modal interchange score decide
    }

    // Common harmonic progressions (music theory fundamentals)
    if (currentFunction === HARMONIC_FUNCTIONS.TONIC) {
        if (nextFunction === HARMONIC_FUNCTIONS.SUBDOMINANT) {
            score = tensionDirection === 'build' ? 95 : 85;
        } else if (nextFunction === HARMONIC_FUNCTIONS.DOMINANT) {
            score = tensionDirection === 'build' ? 90 : 80;
        } else if (nextFunction === HARMONIC_FUNCTIONS.TONIC) {
            score = tensionDirection === 'maintain' ? 80 : 60;
        }
    } else if (currentFunction === HARMONIC_FUNCTIONS.SUBDOMINANT) {
        if (nextFunction === HARMONIC_FUNCTIONS.DOMINANT) {
            score = tensionDirection === 'build' ? 100 : 90;
        } else if (nextFunction === HARMONIC_FUNCTIONS.TONIC) {
            score = tensionDirection === 'resolve' ? 85 : 70;
        } else if (nextFunction === HARMONIC_FUNCTIONS.SUBDOMINANT) {
            score = tensionDirection === 'maintain' ? 75 : 60;
        }
    } else if (currentFunction === HARMONIC_FUNCTIONS.DOMINANT) {
        if (nextFunction === HARMONIC_FUNCTIONS.TONIC) {
            score = tensionDirection === 'resolve' ? 100 : 85;
        } else if (nextFunction === HARMONIC_FUNCTIONS.SUBDOMINANT) {
            score = tensionDirection === 'maintain' ? 70 : 55;
        } else if (nextFunction === HARMONIC_FUNCTIONS.DOMINANT) {
            score = tensionDirection === 'build' ? 80 : 65;
        }
    }

    return score;
}

/**
 * Score voice leading quality
 * Evaluates bass movement, common tones, total movement, range, contrary motion
 * Returns 0-100 score
 */
function scoreVoiceLeading(currentMidi, nextMidi, nextInversion) {
    let score = 0;
    const qualities = [];

    // 1. Bass movement (0-25 points) - prefer smaller intervals
    const bassDiff = Math.abs(nextMidi[0] - currentMidi[0]);
    const bassScore = Math.max(0, 25 - bassDiff);
    score += bassScore;

    if (bassDiff === 0) qualities.push('static bass');
    else if (bassDiff <= 2) qualities.push('smooth bass');
    else if (bassDiff <= 5) qualities.push('stepwise bass');
    else if (bassDiff <= 7) qualities.push('skip in bass');

    // 2. Common tones (0-25 points) - prefer shared notes
    const commonTones = currentMidi.filter(n1 =>
        nextMidi.some(n2 => n2 % 12 === n1 % 12)
    ).length;
    const commonToneScore = commonTones * 8; // Up to 25 points
    score += Math.min(25, commonToneScore);

    if (commonTones >= 2) qualities.push(`${commonTones} common tones`);

    // 3. Total voice movement (0-30 points) - minimize movement
    const totalMovement = currentMidi.reduce((sum, curr, i) => {
        if (i >= nextMidi.length) return sum;
        const minDist = Math.min(...nextMidi.map(next => Math.abs(next - curr)));
        return sum + minDist;
    }, 0);
    const movementScore = Math.max(0, 30 - (totalMovement / 2));
    score += movementScore;

    if (totalMovement <= 5) qualities.push('very smooth');
    else if (totalMovement <= 10) qualities.push('smooth');

    // 4. Voice range (0-10 points) - prefer mid-range voicings
    const avgPitch = nextMidi.reduce((a, b) => a + b, 0) / nextMidi.length;
    const rangePenalty = Math.abs(avgPitch - 60); // Distance from middle C
    const rangeScore = Math.max(0, 10 - (rangePenalty / 3));
    score += rangeScore;

    // 5. Contrary motion bonus (0-10 points) - outer voices moving opposite directions
    if (currentMidi.length > 1 && nextMidi.length > 1) {
        const bassMovement = nextMidi[0] - currentMidi[0];
        const sopranoMovement = nextMidi[nextMidi.length - 1] - currentMidi[currentMidi.length - 1];
        if (bassMovement !== 0 && sopranoMovement !== 0 &&
            Math.sign(bassMovement) !== Math.sign(sopranoMovement)) {
            score += 10;
            qualities.push('contrary motion');
        }
    }

    return Math.min(100, score);
}

/**
 * Score how well a chord type fits a musical style
 * Returns 0-100 score
 */
function scoreStyleFit(chordType, style) {
    let score = 50; // Base score

    if (style === 'pop') {
        if (['Major', 'Minor', 'Dominant 7th'].includes(chordType)) score = 95;
        else if (['Suspended 4th', 'Add9'].includes(chordType)) score = 80;
        else if (chordType.includes('9th') || chordType.includes('13th')) score = 30;
        else score = 60;
    } else if (style === 'jazz') {
        if (chordType.includes('7th') || chordType.includes('9th')) score = 95;
        else if (chordType.includes('6th') || chordType.includes('Add')) score = 85;
        else if (['Major', 'Minor'].includes(chordType)) score = 60;
        else score = 75;
    } else if (style === 'classical') {
        if (['Major', 'Minor', 'Dominant 7th', 'Diminished'].includes(chordType)) score = 95;
        else if (['Major 7th', 'Minor 7th'].includes(chordType)) score = 80;
        else score = 50;
    } else if (style === 'rock') {
        if (['Major', 'Minor', 'Dominant 7th'].includes(chordType)) score = 95;
        else if (['Suspended 4th', 'Power 5th'].includes(chordType)) score = 90;
        else score = 60;
    } else if (style === 'indie') {
        if (chordType.includes('Add') || chordType.includes('6th')) score = 95;
        else if (chordType.includes('Suspended') || chordType === 'Augmented') score = 90;
        else score = 70;
    } else { // balanced
        score = 75; // All chord types equally valid
    }

    return score;
}

/**
 * Score how well a chord type fits a mood
 * Returns 0-100 score
 */
function scoreMoodFit(nextChordType, currentChordType, mood) {
    let score = 50; // Base score

    if (mood === 'bright') {
        if (nextChordType === 'Major') score = 95;
        else if (nextChordType === 'Major 7th') score = 90;
        else if (nextChordType === 'Dominant 7th') score = 85;
        else if (nextChordType === 'Add9') score = 85;
        else if (nextChordType.includes('Major')) score = 80;
        else if (nextChordType === 'Minor') score = 50;
        else if (nextChordType === 'Diminished') score = 30;
    } else if (mood === 'dark') {
        if (nextChordType === 'Minor') score = 95;
        else if (nextChordType === 'Minor 7th') score = 90;
        else if (nextChordType === 'Diminished') score = 85;
        else if (nextChordType === 'Half Diminished 7th') score = 85;
        else if (nextChordType.includes('Minor')) score = 80;
        else if (nextChordType === 'Major') score = 50;
    } else if (mood === 'jazzy') {
        if (nextChordType.includes('9th')) score = 95;
        else if (nextChordType.includes('7th')) score = 90;
        else if (nextChordType.includes('6th')) score = 85;
        else if (nextChordType.includes('Add')) score = 80;
        else score = 60;
    } else if (mood === 'tense') {
        if (nextChordType === 'Diminished' || nextChordType === 'Diminished 7th') score = 95;
        else if (nextChordType === 'Augmented') score = 90;
        else if (nextChordType === 'Dominant 7th') score = 85;
        else if (nextChordType === 'Half Diminished 7th') score = 85;
        else score = 50;
    } else if (mood === 'calm') {
        if (nextChordType === 'Major 7th') score = 95;
        else if (nextChordType === 'Major 6th') score = 90;
        else if (nextChordType === 'Minor 7th') score = 85;
        else if (nextChordType === 'Add9') score = 85;
        else if (nextChordType === 'Major' || nextChordType === 'Minor') score = 80;
        else score = 60;
    } else if (mood === 'energetic') {
        if (nextChordType === 'Dominant 7th') score = 95;
        else if (nextChordType === 'Major') score = 90;
        else if (nextChordType === 'Suspended 4th') score = 85;
        else if (nextChordType === 'Dominant 9th') score = 85;
        else score = 70;
    }

    return score;
}

/**
 * Generate human-readable reason for the recommendation
 */
function generateReason(
    currentRoot, nextRoot, nextType, nextInversion,
    functionScore, voiceLeadingScore, styleFit, moodFit,
    currentFunction, nextFunction, tensionDirection,
    contextScore = 0, context = null, modalInterchangeScore = 50, borrowedInfo = null
) {
    const reasons = [];

    // Modal interchange reason (high priority for borrowed chords)
    if (borrowedInfo && modalInterchangeScore >= 70) {
        const modeLabels = {
            'parallel-minor': 'parallel minor',
            'mixolydian': 'Mixolydian',
            'dorian': 'Dorian',
            'phrygian': 'Phrygian',
            'lydian': 'Lydian'
        };
        const modeLabel = modeLabels[borrowedInfo.mode] || borrowedInfo.mode;
        reasons.push(`Borrowed from ${modeLabel}`);
    }

    // Context-aware reasons (highest priority if enabled)
    if (context && context.hasContext) {
        if (context.cadence.approaching && contextScore >= 70) {
            if (context.cadence.type === 'ii-V') {
                reasons.push('Completes ii-V-I progression');
            } else if (context.cadence.type === 'authentic') {
                reasons.push('Resolves V-I cadence');
            } else if (context.cadence.type === 'plagal') {
                reasons.push('Plagal (IV-I) resolution');
            }
        }

        if (context.tension.trend === 'rising' && contextScore >= 65) {
            reasons.push('continues tension arc');
        } else if (context.tension.trend === 'falling' && contextScore >= 65) {
            reasons.push('releases tension smoothly');
        }

        if (context.bassMovement.pattern === 'circle-of-fifths' && contextScore >= 60) {
            reasons.push('follows circle of fifths');
        }
    }

    // Harmonic function reason
    if (functionScore >= 90) {
        if (nextFunction === HARMONIC_FUNCTIONS.TONIC && tensionDirection === 'resolve') {
            reasons.push('Strong resolution to tonic');
        } else if (nextFunction === HARMONIC_FUNCTIONS.DOMINANT && tensionDirection === 'build') {
            reasons.push('Builds tension toward dominant');
        } else if (nextFunction === HARMONIC_FUNCTIONS.SUBDOMINANT) {
            reasons.push('Classic subdominant motion');
        } else {
            reasons.push('Excellent harmonic progression');
        }
    } else if (functionScore >= 70) {
        reasons.push('Good harmonic flow');
    }

    // Voice leading reason
    if (voiceLeadingScore >= 80) {
        reasons.push('excellent voice leading');
    } else if (voiceLeadingScore >= 60) {
        reasons.push('smooth voice leading');
    }

    // Style/mood reason
    if (styleFit >= 85 && moodFit >= 85) {
        reasons.push('perfect for style and mood');
    } else if (styleFit >= 85) {
        reasons.push('fits musical style well');
    } else if (moodFit >= 85) {
        reasons.push('matches desired mood');
    }

    // Fallback
    if (reasons.length === 0) {
        reasons.push('Interesting harmonic choice');
    }

    return reasons.join(', ');
}

/**
 * Helper: Get chord MIDI notes
 */
function getChordMidi(root, chordType, inversion) {
    try {
        const res = getInvertedChordNotes(
            root,
            chordType,
            inversion,
            root,
            0,
            'sharp',
            'full'
        );
        return (res.specificNotes || []).map(note => noteToMidi(note));
    } catch (e) {
        return [];
    }
}

/**
 * Get default recommendations when no current chord context
 */
function getDefaultRecommendations(key) {
    return [
        { root: key, type: 'Major', inversion: 0, score: 100, reason: 'Start with the tonic (home) chord', confidence: 100 },
        { root: key, type: 'Minor', inversion: 0, score: 85, reason: 'Start with minor for a darker feel', confidence: 85 },
        { root: key, type: 'Major 7th', inversion: 0, score: 80, reason: 'Jazz-influenced starting point', confidence: 80 }
    ];
}
