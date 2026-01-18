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
 *
 * ============================================================================
 * SCORING CONSTANTS REFERENCE (hardcoded values with rationale)
 * ============================================================================
 *
 * HARMONIC FUNCTION SCORING (scoreHarmonicFunction):
 * - TENSION_DELTA = 12 points: Standardized bonus for "preferred" tension direction
 *   Rationale: 12pts is ~15% of a typical 80-point base score, enough to influence
 *   ranking without overwhelming voice leading or style scores.
 *
 * - Base scores by progression type:
 *   - S→D (IV→V, ii→V): 88  - Most common tension-building pattern
 *   - D→I (V→I authentic): 88  - Fundamental resolution, matches S→D importance
 *   - T→S (I→IV, I→ii): 83  - Very common forward motion
 *   - D→vi (deceptive): 78  - Common in pop/classical, not a "mistake"
 *   - T→D (I→V direct): 78  - Acceptable but skips subdominant
 *   - T→T (tonic motion): 72  - Within-function movement (I→vi)
 *   - D→D (V→vii°): 68  - Building more tension, less common
 *   - IV→vi, ii→vi: 68  - Valid but less common resolution
 *   - S→S (ii→IV): 65  - Staying in subdominant function
 *   - D→S retrogression: 60  - "Backwards" but used in rock/pop (V→IV)
 *   - V→iii: 58  - Unusual resolution target
 *   - I→I repeat: 55  - Avoid exact repetition unless maintain mode
 *   - IV→iii, ii→iii: 55  - Unusual, low base
 *
 * VOICE LEADING SCORING (scoreVoiceLeading):
 * - Bass movement: 0-25 points (25 - bassDiff semitones)
 *   Rationale: Small bass intervals (steps) are preferred over leaps
 * - Common tones: 8 points each, max 25
 *   Rationale: Shared notes create smooth transitions
 * - Total movement: 0-30 points (30 - totalMovement/2)
 *   Rationale: Minimal overall voice movement is classical ideal
 * - Voice range: 0-10 points based on distance from middle C
 *   Rationale: Mid-range voicings sound balanced
 * - Contrary motion: +10 points when bass and soprano move opposite
 *   Rationale: Contrary motion is a fundamental voice leading principle
 *
 * LEADING TONE RESOLUTION (checkLeadingToneResolution):
 * - Bonus: 15 points (increased by 1.5x to 22.5 in resolve mode)
 *   Rationale: Leading tone → tonic is the most important melodic tendency
 *   in Western tonal music. 15pts significantly boosts authentic cadences.
 *
 * REPETITION HANDLING (in main scoring loop):
 * - gapsSinceLastAppearance <= 2: No penalty (return patterns like I-IV-I)
 * - gapsSinceLastAppearance 3-4: Mild penalty (15%)
 * - gapsSinceLastAppearance 5-6: Moderate penalty (25%)
 * - gapsSinceLastAppearance 7+: Full penalty (40%)
 * - Direct repeat (immediate): 35% penalty
 *   Rationale: Return patterns are musical, only penalize true repetition
 *
 * STYLE-SPECIFIC CHORD SCORING (graduated tiers):
 * - Perfect match: 95 (chord is signature for style)
 * - Strong match: 88 (highly characteristic)
 * - Good match: 78 (commonly used)
 * - Acceptable: 68 (works but not characteristic)
 * - Neutral: 58 (neither characteristic nor wrong)
 * - Base: 50 (default for unmatched)
 *   Rationale: Graduated scoring prevents cliff effects where small
 *   differences in style fit cause large score jumps.
 *
 * SECTION BONUSES (in sectionTransitionAnalyzer.js):
 * - MAX_SECTION_BONUS = 40 points
 * - MAX_SECTION_PENALTY = -25 points
 * - MAX_TRANSITION_BONUS = 30 points
 *   Rationale: Caps prevent section context from overwhelming harmonic logic.
 *   A "perfect" section fit shouldn't make a bad chord beat a good one.
 *
 * SECONDARY DOMINANT SCORING (in extendedHarmonicRelationships.js):
 * - V/V: 40 points (most common secondary dominant)
 * - V/vi: 35 points (very common, especially in minor key songs)
 * - V/ii: 32 points (common in jazz and classical)
 * - V/IV: 28 points (less common but valid)
 * - V/iii: 25 points (rare)
 *   Rationale: Reflects actual usage frequency in Western music corpus.
 *
 * ROOT FATIGUE (in chordSequences.js):
 * - historyDepth: 12 chords (extended from 8)
 * - basePenalty: 12 points (reduced from 15)
 *   Rationale: Extended lookback catches longer patterns; reduced penalty
 *   allows more variety without being punitive.
 *
 * ============================================================================
 */

import { CHORD_DEFINITIONS, ALL_NOTES } from '../../data/music-data.js';
import { getInvertedChordNotes, noteToMidi } from '../utils/noteUtils.js';
import { analyzeProgressionContext, scoreContextAwareness } from './progressionContext.js';
import { getSavedWeights } from '../config/weightPresets.js';

// Phase 1 Enhancement Modules
import { scoreEnhancedVoiceLeading, detectParallelMotion } from './enhancedVoiceLeading.js';
import {
    scoreExtendedHarmonicRelationships,
    ResolutionExpectationTracker,
    detectSecondaryDominant,
    detectChromaticMediant
} from './extendedHarmonicRelationships.js';
import { getAdaptiveWeights, explainWeightChoices } from './dynamicWeights.js';
import { getRelevantChordTypes, CHORD_TYPE_PROFILES } from './chordTypeProfiles.js';

// Phase 2 Section Context Modules
import {
    analyzeSectionContext,
    getSectionAwareScore,
    generateSectionReasons
} from './sectionTransitionAnalyzer.js';
import { getSectionProfile, getChordTypePreference } from './sectionProfiles.js';

// Phase 3 Tension Arc Modules
import {
    getTensionArcPlanner,
    CHORD_TENSION_SCORES
} from '../analysis/TensionArcPlanner.js';

// Rhythmic Context Analysis (Duration Awareness)
import {
    analyzeRhythmicContext,
    quickDurationSuggestion,
    getDurationForSectionPosition,
    STYLE_HARMONIC_RHYTHM,
    SECTION_DURATION_MODIFIERS,
    HARMONIC_RHYTHM_TRENDS,
    DEFAULT_DURATION
} from './rhythmicContextAnalyzer.js';

// ============================================================================
// PERFORMANCE OPTIMIZATION: Memoization Cache for Sequence Generation
// ============================================================================
// During sequence generation, generateComprehensiveRecommendations is called
// 100-300+ times with many duplicate parameter combinations. This cache stores
// results keyed by a hash of the parameters, dramatically reducing computation.

const recommendationCache = new Map();
const CACHE_MAX_SIZE = 500; // Max entries before pruning
const CACHE_TTL_MS = 30000; // 30 seconds - cache expires for fresh modal opens

/**
 * Generate a cache key from recommendation parameters.
 * Only includes parameters that affect the scoring outcome.
 */
function generateCacheKey(
    currentRoot, currentChordType, currentInversion,
    key, style, mood, tensionDirection, limit,
    progressionData, contextMode, lookbackDepth,
    useEnhancedScoring, sectionInfo
) {
    // Create a simplified representation of progression for cache key
    // Only use last N chords as that's what affects scoring
    const relevantProgression = progressionData?.slice(-lookbackDepth) || [];
    const progressionKey = relevantProgression.map(c =>
        c ? `${c.root}|${c.type}|${c.inversion || 0}` : 'null'
    ).join(',');

    // Section info key (only relevant parts)
    const sectionKey = sectionInfo ?
        `${sectionInfo.sectionType || ''}|${sectionInfo.position || ''}|${sectionInfo.totalChords || ''}` :
        'null';

    return `${currentRoot}|${currentChordType}|${currentInversion}|${key}|${style}|${mood}|${tensionDirection}|${limit}|${progressionKey}|${contextMode}|${lookbackDepth}|${useEnhancedScoring}|${sectionKey}`;
}

/**
 * Clear the recommendation cache.
 * Call this when the modal opens to ensure fresh results.
 */
export function clearRecommendationCache() {
    recommendationCache.clear();
}

/**
 * Prune old entries if cache is too large.
 */
function pruneCache() {
    if (recommendationCache.size <= CACHE_MAX_SIZE) return;

    // Remove oldest entries (first half)
    const entriesToRemove = Math.floor(CACHE_MAX_SIZE / 2);
    const keys = Array.from(recommendationCache.keys());
    for (let i = 0; i < entriesToRemove && i < keys.length; i++) {
        recommendationCache.delete(keys[i]);
    }
}

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
    'Sus4',
    'Sus2',
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
 * @param {string} key - Musical key (e.g., 'C', 'G', 'Gm')
 * @returns {number|null} Scale degree (1-7) or null if invalid
 */
function getScaleDegree(chordRoot, key) {
    // Detect if this is a minor key
    const isMinorKey = key && key.endsWith('m') && !key.endsWith('dim');
    const keyRoot = isMinorKey ? key.slice(0, -1) : key;

    const keyIndex = ALL_NOTES.indexOf(keyRoot);
    const chordIndex = ALL_NOTES.indexOf(chordRoot);

    if (keyIndex === -1 || chordIndex === -1) return null;

    // Calculate semitone distance
    let distance = (chordIndex - keyIndex + 12) % 12;

    // Map to scale degree based on key type
    // Major scale intervals: 0, 2, 4, 5, 7, 9, 11
    const majorDegreeMap = {
        0: 1,  // Root (I)
        2: 2,  // 2nd (ii)
        4: 3,  // 3rd (iii)
        5: 4,  // 4th (IV)
        7: 5,  // 5th (V)
        9: 6,  // 6th (vi)
        11: 7  // 7th (vii°)
    };

    // Natural minor scale intervals: 0, 2, 3, 5, 7, 8, 10
    const minorDegreeMap = {
        0: 1,   // Root (i)
        2: 2,   // 2nd (ii°)
        3: 3,   // 3rd (III)
        5: 4,   // 4th (iv)
        7: 5,   // 5th (v)
        8: 6,   // 6th (VI)
        10: 7   // 7th (VII)
    };

    const degreeMap = isMinorKey ? minorDegreeMap : majorDegreeMap;
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
 * @param {Object} customWeights - Custom scoring weights (optional)
 * @param {boolean} useEnhancedScoring - Enable Phase 1 enhanced scoring (default true)
 * @param {Object} sectionInfo - Section context info (Phase 2)
 * @param {number} sectionInfo.currentChordIndex - Index of current chord in progression
 * @param {Array} sectionInfo.sections - Array of section objects from compositionState
 * @param {Object} tensionArcInfo - Tension arc info (Phase 3)
 * @param {boolean} tensionArcInfo.enabled - Whether to use tension arc scoring
 * @param {number} tensionArcInfo.weight - Weight for tension arc scoring (0-1, default 0.15)
 * @param {Object} rhythmInfo - Rhythmic context info (Duration Awareness)
 * @param {boolean} rhythmInfo.enabled - Whether to include duration suggestions
 * @param {Object} rhythmInfo.compositionState - Full composition state for rhythm analysis
 * @param {number} rhythmInfo.insertAfterIndex - Index after which to insert (for position context)
 * @param {Object} forwardContextInfo - Forward-looking context info (Phase 4 - Compare mode enhancement)
 * @param {boolean} forwardContextInfo.enabled - Whether to use forward context scoring
 * @param {Object} forwardContextInfo.nextChord - The chord that follows the position being replaced
 * @param {number} forwardContextInfo.weight - Weight for forward context scoring (0-1, default 0.15)
 * @returns {Array<{root:string, type:string, inversion:number, score:number, reason:string, confidence:number, suggestedDuration:number, durationReason:string, durationConfidence:number}>}
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
    customWeights = null,
    useEnhancedScoring = true,  // Phase 1 enhanced scoring (voice leading, harmonic relationships)
    sectionInfo = null,         // Phase 2 section context
    tensionArcInfo = null,      // Phase 3 tension arc scoring
    rhythmInfo = null,          // Rhythmic context for duration suggestions
    forwardContextInfo = null   // Phase 4: Forward-looking context (for Compare mode)
) {
    // Safety check for required parameters
    if (!currentRoot || !currentChordType) {
        return getDefaultRecommendations(key || 'C');
    }

    // Ensure progressionData is an array
    if (!Array.isArray(progressionData)) {
        progressionData = [];
    }

    // ==========================================================================
    // CACHE CHECK: Return cached results if available
    // ==========================================================================
    // Note: We only cache when customWeights, tensionArcInfo, rhythmInfo, and
    // forwardContextInfo are null (the common case in sequence generation).
    // These parameters change the scoring in ways that would require more complex
    // cache key generation.
    const canUseCache = !customWeights && !tensionArcInfo && !rhythmInfo && !forwardContextInfo;

    if (canUseCache) {
        const cacheKey = generateCacheKey(
            currentRoot, currentChordType, currentInversion,
            key, style, mood, tensionDirection, limit,
            progressionData, contextMode, lookbackDepth,
            useEnhancedScoring, sectionInfo
        );

        const cached = recommendationCache.get(cacheKey);
        if (cached) {
            // Return a shallow copy of cached results to prevent mutation
            return cached.map(r => ({ ...r }));
        }

        // Store cache key for later storage
        var _cacheKey = cacheKey;
    }

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
        try {
            context = analyzeProgressionContext(progressionData, key, lookbackDepth);
        } catch (e) {
            context = null;
        }
    }

    // Initialize resolution expectation tracker for enhanced scoring
    let resolutionTracker = null;
    if (useEnhancedScoring && progressionData && progressionData.length > 0) {
        try {
            resolutionTracker = new ResolutionExpectationTracker();
            // Process progression history to build expectation state
            for (let i = 0; i < progressionData.length; i++) {
                const chord = progressionData[i];
                if (chord && chord.root) {
                    resolutionTracker.processChord(chord, key);
                }
            }
        } catch (e) {
            resolutionTracker = null;
        }
    }

    // Get adaptive weights if enhanced scoring is enabled
    let adaptiveWeightsInfo = null;
    if (useEnhancedScoring && context) {
        try {
            adaptiveWeightsInfo = explainWeightChoices(context, style);
        } catch (e) {
        }
    }

    // Get relevant chord types based on context (smart filtering)
    let chordTypesToEvaluate = CHORD_TYPES_TO_EVALUATE;
    if (useEnhancedScoring) {
        try {
            const filterContext = {
                style,
                mood,
                tensionDirection,
                progressionLength: progressionData ? progressionData.length : 0,
                isApproachingCadence: context?.cadence?.approaching || false,
                currentTension: context?.tension?.currentTension || 50
            };
            const relevantTypes = getRelevantChordTypes(filterContext);
            // Use top-scoring chord types (those with score >= 50)
            chordTypesToEvaluate = relevantTypes
                .filter(ct => ct.score >= 50)
                .map(ct => ct.type);
            // Ensure we have at least the basic types
            if (chordTypesToEvaluate.length < 5) {
                chordTypesToEvaluate = CHORD_TYPES_TO_EVALUATE;
            }
        } catch (e) {
            chordTypesToEvaluate = CHORD_TYPES_TO_EVALUATE;
        }
    }

    // Phase 2: Analyze section context if provided
    let sectionContext = null;
    let nextChordIndex = null;
    if (sectionInfo) {
        try {
            // Phase 2.1: Check for intent-based context override
            if (sectionInfo.intentContext) {
                // Use the intent-based section context directly
                // This provides user-specified section type and position
                sectionContext = sectionInfo.intentContext;
                nextChordIndex = (sectionInfo.insertAfterIndex ?? sectionInfo.currentChordIndex ?? progressionData.length - 1) + 1;
            } else if (sectionInfo.sections && sectionInfo.sections.length > 0) {
                // Fallback: Analyze section context from existing sections
                // The next chord index is current + 1 (we're recommending the NEXT chord)
                nextChordIndex = (sectionInfo.currentChordIndex ?? progressionData.length - 1) + 1;
                sectionContext = analyzeSectionContext(nextChordIndex, sectionInfo.sections);
            }
        } catch (e) {
            sectionContext = null;
        }
    }

    // Phase 3: Initialize tension arc planner and calculate target tension
    let tensionArcPlanner = null;
    let targetTension = null;
    let tensionArcWeight = 0.15; // Default weight for tension arc scoring
    let useMultiDimensionalTension = false;
    if (tensionArcInfo && tensionArcInfo.enabled) {
        try {
            tensionArcPlanner = getTensionArcPlanner();

            // Enable multi-dimensional tension based on style
            // This adds rhythmic, melodic, and dynamic tension analysis alongside harmonic
            useMultiDimensionalTension = tensionArcInfo.multiDimensional !== false; // Default to true
            if (useMultiDimensionalTension) {
                tensionArcPlanner.setMultiDimensionalMode(true, style);
            }

            // Calculate normalized position for the next chord
            const nextChordPosition = progressionData.length;
            const totalExpectedChords = Math.max(nextChordPosition + 4, 8); // Estimate total progression length
            const normalizedPosition = nextChordPosition / totalExpectedChords;
            targetTension = tensionArcPlanner.getTargetTensionAt(normalizedPosition);
            tensionArcWeight = tensionArcInfo.weight || 0.15;
        } catch (e) {
            tensionArcPlanner = null;
        }
    }

    // Rhythmic Context Analysis: Calculate duration suggestions
    let rhythmicAnalysis = null;
    if (rhythmInfo && rhythmInfo.enabled) {
        try {
            rhythmicAnalysis = analyzeRhythmicContext(
                rhythmInfo.compositionState || { storedProgressionData: progressionData },
                {
                    style: style,
                    currentChordIndex: sectionInfo?.currentChordIndex ?? (progressionData.length - 1),
                    insertAfterIndex: rhythmInfo.insertAfterIndex ?? sectionInfo?.insertAfterIndex,
                    sectionContext: sectionContext ? {
                        type: sectionContext.sectionType,
                        startIndex: sectionContext.sectionStart,
                        endIndex: sectionContext.sectionEnd
                    } : null
                }
            );
        } catch (e) {
            rhythmicAnalysis = null;
        }
    }

    // Evaluate all possible next chords across all three dimensions
    ALL_NOTES.forEach(nextRoot => {
        const nextDegree = getScaleDegree(nextRoot, key);
        // IMPORTANT: Don't default borrowed chords (null degree) to TONIC!
        // This was causing D#add9 to be scored as I chord (tonic)
        const nextFunction = nextDegree !== null ? (DEGREE_TO_FUNCTION[nextDegree] || HARMONIC_FUNCTIONS.TONIC) : null;

        // Get harmonic function score (how well does this root fit the progression?)
        const functionScore = scoreHarmonicFunction(currentFunction, nextFunction, tensionDirection, currentDegree, nextDegree);

        // Skip roots with very poor harmonic relationships (unless jazz/indie style)
        if (functionScore < 10 && style !== 'jazz' && style !== 'indie') {
            return; // Skip this root
        }

        // For each root, evaluate multiple chord types (using filtered list if enhanced scoring)
        chordTypesToEvaluate.forEach(nextType => {
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
                try {
                    const nextMidi = getChordMidi(nextRoot, nextType, nextInversion);
                    if (nextMidi.length === 0) continue;

                    // Calculate voice leading score (enhanced or standard)
                    let voiceLeadingScore;
                    let voiceLeadingDetails = null;
                    if (useEnhancedScoring) {
                        try {
                            const vlResult = scoreEnhancedVoiceLeading(currentMidi, nextMidi, key, {
                                style: style,  // Pass style for voice leading preset selection
                                sectionPosition: sectionContext?.position || null  // Pass section position for context-aware scoring
                            });
                            voiceLeadingScore = vlResult.score;
                            voiceLeadingDetails = vlResult;
                        } catch (e) {
                            voiceLeadingScore = scoreVoiceLeading(currentMidi, nextMidi, nextInversion);
                        }
                    } else {
                        voiceLeadingScore = scoreVoiceLeading(currentMidi, nextMidi, nextInversion);
                    }

                    // Calculate extended harmonic relationship score (Phase 1 enhancement)
                    let extendedHarmonicScore = 0;
                    let harmonicDetails = null;
                    if (useEnhancedScoring) {
                        try {
                            const currentChord = { root: currentRoot, type: currentChordType };
                            const nextChord = { root: nextRoot, type: nextType };
                            const harmonicResult = scoreExtendedHarmonicRelationships(
                                currentChord,
                                nextChord,
                                key,
                                progressionData || []
                            );
                            extendedHarmonicScore = harmonicResult.score;
                            harmonicDetails = harmonicResult;
                        } catch (e) {
                            // Fall back to no extended harmonic score
                        }
                    }

                    // Calculate resolution expectation score
                    let resolutionScore = 0;
                    if (useEnhancedScoring && resolutionTracker) {
                        try {
                            const nextChord = { root: nextRoot, type: nextType };
                            resolutionScore = resolutionTracker.scoreResolution(nextChord, key);
                        } catch (e) {
                            // Fall back to no resolution score
                        }
                    }

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

                // Phase 2: Calculate section-aware score
                let sectionScore = 0;
                let sectionScoreDetails = null;
                if (sectionContext) {
                    try {
                        const nextChord = { root: nextRoot, type: nextType, inversion: nextInversion };
                        // Phase 2.1: Pass intent context to scoring function
                        // This allows user's position intent (building/concluding/final) to affect recommendations
                        sectionScoreDetails = getSectionAwareScore(
                            nextChord,
                            nextChordIndex,
                            sectionInfo.sections,
                            key,
                            sectionContext  // Pass the intent context for position override
                        );
                        sectionScore = sectionScoreDetails.totalAdjustment;
                    } catch (e) {
                        // Fall back to no section score
                    }
                }

                // Phase 3: Calculate tension arc alignment score
                let tensionArcScore = 0;
                let tensionArcDetails = null;
                if (tensionArcPlanner && targetTension !== null) {
                    try {
                        let chordTension;
                        let dimensionBreakdown = null;

                        if (useMultiDimensionalTension) {
                            // Use multi-dimensional tension (harmonic + rhythmic + melodic + dynamic)
                            // Context includes measure data when available for rhythmic/melodic analysis
                            const nextChord = { root: nextRoot, type: nextType, inversion: nextInversion };
                            const tensionContext = {
                                positionInProgression: progressionData.length,
                                totalChords: Math.max(progressionData.length + 4, 8)
                            };

                            // If rhythmicAnalysis is available, add measure data for rhythmic tension
                            if (rhythmicAnalysis && rhythmicAnalysis.measureNotes) {
                                tensionContext.measureData = { notes: rhythmicAnalysis.measureNotes };
                                tensionContext.melodyNotes = rhythmicAnalysis.measureNotes.filter(n => !n.isRest);
                            }

                            const mdTensionResult = tensionArcPlanner.calculateMultiDimensionalTension(
                                nextChord, key, tensionContext
                            );
                            chordTension = mdTensionResult.total;
                            dimensionBreakdown = mdTensionResult.dimensions;
                        } else {
                            // Fall back to base harmonic tension only
                            const chordTensionInfo = CHORD_TENSION_SCORES[nextType] || { baseTension: 0.5 };
                            chordTension = chordTensionInfo.baseTension;
                        }

                        // Calculate how well this chord's tension aligns with the target
                        const tensionDeviation = Math.abs(chordTension - targetTension);
                        const tensionAlignment = 1 - tensionDeviation; // 0-1, higher is better

                        // Convert to 0-100 score
                        tensionArcScore = tensionAlignment * 100;

                        tensionArcDetails = {
                            chordTension,
                            targetTension,
                            tensionAlignment,
                            deviation: tensionDeviation,
                            direction: chordTension > targetTension ? 'above' : 'below',
                            isMultiDimensional: useMultiDimensionalTension,
                            dimensions: dimensionBreakdown
                        };
                    } catch (e) {
                        tensionArcScore = 0;
                    }
                }

                // Phase 4: Calculate forward context score (how well this chord leads to the NEXT chord)
                // Used primarily in Compare mode to evaluate alternatives based on what follows
                let forwardContextScore = 0;
                let forwardContextDetails = null;
                if (forwardContextInfo && forwardContextInfo.enabled && forwardContextInfo.nextChord) {
                    try {
                        const fwdNextChord = forwardContextInfo.nextChord;
                        const forwardWeight = forwardContextInfo.weight || 0.15;

                        // Calculate voice leading to the next chord
                        const fwdNextMidi = getChordMidi(fwdNextChord.root, fwdNextChord.type, fwdNextChord.inversion || 0);
                        if (fwdNextMidi.length > 0) {
                            const forwardVLScore = scoreVoiceLeading(nextMidi, fwdNextMidi, fwdNextChord.inversion || 0);

                            // Calculate harmonic function score for this -> next transition
                            const fwdNextDegree = getScaleDegree(fwdNextChord.root, key);
                            const fwdNextFunction = fwdNextDegree !== null ? (DEGREE_TO_FUNCTION[fwdNextDegree] || HARMONIC_FUNCTIONS.TONIC) : null;
                            const forwardFunctionScore = scoreHarmonicFunction(nextFunction, fwdNextFunction, tensionDirection, nextDegree, fwdNextDegree);

                            // Combine voice leading and harmonic function for forward score
                            // Weight: 40% voice leading, 60% harmonic function (function more important for flow)
                            forwardContextScore = (forwardVLScore * 0.4) + (forwardFunctionScore * 0.6);

                            forwardContextDetails = {
                                nextChord: `${fwdNextChord.root} ${fwdNextChord.type}`,
                                voiceLeadingToNext: forwardVLScore,
                                functionToNext: forwardFunctionScore,
                                combinedScore: forwardContextScore,
                                weight: forwardWeight
                            };
                        }
                    } catch (e) {
                        forwardContextScore = 0;
                    }
                }

                // Get weights - use saved weights as base, then apply adaptive adjustments if enhanced scoring
                //
                // IMPORTANT: This weight calculation approach should be mirrored in melody generation:
                // 1. Always retrieve user's saved slider weights via getSavedWeights() or getSavedMelodyWeights()
                // 2. Pass saved weights as customOverrides to getAdaptiveWeights() (or melody equivalent)
                // 3. getAdaptiveWeights() uses saved weights as the STARTING POINT, then applies
                //    style modifiers, position profiles, pattern adjustments, and tension adjustments
                // 4. This ensures user slider preferences are respected while still benefiting from
                //    context-aware adaptive adjustments
                //
                let weights;
                // Always start with saved weights (user's slider preferences)
                const savedWeights = customWeights || getSavedWeights(contextMode);

                if (useEnhancedScoring && context) {
                    // Apply adaptive adjustments on top of saved weights
                    weights = getAdaptiveWeights(context, style, {
                        usePositionProfile: true,
                        useStyleModifiers: true,
                        usePatternAdjustments: true,
                        useTensionAdjustments: true,
                        customOverrides: savedWeights  // Use saved weights as the base
                    });
                } else {
                    weights = savedWeights;
                }

                // Calculate total score (weighted combination using custom weights)
                let totalScore;

                // Blend extended harmonic score with base function score when enhanced scoring is enabled
                let harmonicScoreBlended = functionScore;
                if (useEnhancedScoring && extendedHarmonicScore > 0) {
                    // Blend: 60% extended harmonic (which includes secondary dominants, chromatic mediants, sequences)
                    // 40% traditional function score
                    harmonicScoreBlended = (extendedHarmonicScore * 0.6) + (functionScore * 0.4);
                }

                // Add resolution expectation bonus when enhanced scoring is enabled
                let resolutionBonus = 0;
                if (useEnhancedScoring && resolutionScore > 0) {
                    // Resolution expectations can boost the score significantly
                    resolutionBonus = resolutionScore * 0.15; // Up to 15 point bonus
                }

                // Leading tone resolution bonus - THE most important voice leading rule
                // Check if current chord has leading tone and next chord resolves it
                const leadingToneCheck = checkLeadingToneResolution(currentMidi, nextMidi, key);
                let leadingToneBonus = 0;
                if (leadingToneCheck.resolved && tensionDirection === 'final') {
                    // Maximum bonus in FINAL mode - leading tone resolution is critical for endings
                    leadingToneBonus = leadingToneCheck.bonus * 2.0;
                } else if (leadingToneCheck.resolved && tensionDirection === 'resolve') {
                    // 1.5x bonus in resolve mode - this is what we want for approaching end
                    leadingToneBonus = leadingToneCheck.bonus * 1.5;
                } else if (leadingToneCheck.resolved) {
                    // Regular bonus in other modes
                    leadingToneBonus = leadingToneCheck.bonus;
                }

                // Phase 2: Section context adds/subtracts from score directly
                // Section scores are absolute adjustments, not weighted
                const sectionAdjustment = sectionScore || 0;

                // Phase 3: Calculate tension arc bonus/penalty
                // Tension arc score is weighted and added to total
                const tensionArcBonus = tensionArcScore * tensionArcWeight;

                // Phase 4: Calculate forward context bonus
                // Forward context score evaluates how well this chord leads to the NEXT chord
                const forwardContextWeight = forwardContextInfo?.weight || 0.15;
                const forwardContextBonus = forwardContextScore * forwardContextWeight;

                if (contextMode && context && context.hasContext) {
                    // Context-aware mode: use context weights (includes context and modal interchange factors)
                    totalScore =
                        (harmonicScoreBlended * weights.harmonic) +
                        (voiceLeadingScore * weights.voiceLeading) +
                        (styleFit * weights.style) +
                        (moodFit * weights.mood) +
                        (contextScore * (weights.context || 0)) +
                        (modalInterchangeScore * (weights.modalInterchange || 0)) +
                        resolutionBonus +
                        leadingToneBonus +    // Leading tone resolution (most important voice leading)
                        sectionAdjustment +   // Phase 2: Section-aware adjustment
                        tensionArcBonus +     // Phase 3: Tension arc alignment
                        forwardContextBonus;  // Phase 4: Forward context (leads well to next chord)
                } else {
                    // Standard mode: use standard weights (includes modal interchange factor)
                    totalScore =
                        (harmonicScoreBlended * weights.harmonic) +
                        (voiceLeadingScore * weights.voiceLeading) +
                        (styleFit * weights.style) +
                        (moodFit * weights.mood) +
                        (modalInterchangeScore * (weights.modalInterchange || 0)) +
                        resolutionBonus +
                        leadingToneBonus +    // Leading tone resolution (most important voice leading)
                        sectionAdjustment +   // Phase 2: Section-aware adjustment
                        tensionArcBonus +     // Phase 3: Tension arc alignment
                        forwardContextBonus;  // Phase 4: Forward context (leads well to next chord)
                }

                // =========================================================================
                // REPETITION HANDLING: Allow common patterns like I-IV-I, I-V-I
                // =========================================================================
                // We want to:
                // - Heavily penalize TRUE consecutive repetitions (A-A, A-A-A)
                // - ALLOW return patterns (A-B-A, I-IV-I, I-V-I) which are musically valid
                // - Lightly discourage excessive reuse over longer spans
                // =========================================================================

                const currentChordIdx = sectionInfo?.currentChordIndex ?? (progressionData.length - 1);
                let repetitionPenalty = 1.0; // No penalty by default

                if (progressionData && progressionData.length > 0 && currentChordIdx >= 0) {
                    // Check for TRUE consecutive repetition (same chord immediately before)
                    const immediatelyPrevious = progressionData[currentChordIdx];
                    const isImmediateRepeat = immediatelyPrevious &&
                        immediatelyPrevious.root === nextRoot &&
                        immediatelyPrevious.type === nextType;

                    if (isImmediateRepeat) {
                        // Count how many times in a row this chord appears
                        let consecutiveCount = 1;
                        for (let i = currentChordIdx - 1; i >= 0; i--) {
                            const historyChord = progressionData[i];
                            if (historyChord &&
                                historyChord.root === nextRoot &&
                                historyChord.type === nextType) {
                                consecutiveCount++;
                            } else {
                                break;
                            }
                        }

                        // Penalties for true consecutive repetition
                        // 1 in a row (would make 2): 0.4 multiplier (60% penalty) - reduced from 70%
                        // 2 in a row (would make 3): 0.15 multiplier (85% penalty)
                        // 3+ in a row: 0.05 multiplier (95% penalty)
                        if (consecutiveCount === 1) {
                            repetitionPenalty = 0.4;  // Less harsh - 2 in a row can happen
                        } else if (consecutiveCount === 2) {
                            repetitionPenalty = 0.15;
                        } else {
                            repetitionPenalty = 0.05;
                        }
                    } else {
                        // NOT an immediate repeat - check for valid return patterns
                        // Return patterns like I-IV-I, I-V-I should NOT be penalized
                        // Only apply light variety penalty for excessive reuse

                        const VARIETY_LOOKBACK = 6; // Increased from 4 to 6 for better pattern detection
                        let recentAppearances = 0;
                        let gapsSinceLastAppearance = 0;
                        let foundAppearance = false;

                        const startIdx = Math.max(0, currentChordIdx - VARIETY_LOOKBACK + 1);
                        for (let i = currentChordIdx; i >= startIdx; i--) {
                            const historyChord = progressionData[i];
                            if (historyChord &&
                                historyChord.root === nextRoot &&
                                historyChord.type === nextType) {
                                recentAppearances++;
                                if (!foundAppearance) {
                                    gapsSinceLastAppearance = currentChordIdx - i;
                                    foundAppearance = true;
                                }
                            }
                        }

                        // Very light penalty for non-consecutive appearances
                        // Key change: if there's a 1-2 chord gap, this is a RETURN pattern (I-IV-I)
                        // Don't penalize return patterns at all!
                        if (recentAppearances > 0) {
                            if (gapsSinceLastAppearance <= 2) {
                                // Return pattern (1-2 chords between) - NO PENALTY
                                // This allows I-IV-I, I-V-I, I-ii-V-I patterns
                                repetitionPenalty = 1.0;
                            } else {
                                // Longer gap - apply light variety nudge (8% per appearance, max 25%)
                                // Reduced from 15% per appearance
                                repetitionPenalty = Math.max(0.75, 1 - (recentAppearances * 0.08));
                            }
                        }
                    }
                }

                totalScore *= repetitionPenalty;

                // Apply tension-aware scoring for suspended chords
                // Sus4 and Sus2 chords have inherent unresolved tension (the suspended note wants to resolve)
                // IMPORTANT: Sus chords on V resolving to I is a CLASSIC cadential pattern (V-sus4-I)
                // We should NOT heavily penalize sus chords in resolve mode if they're on dominant
                const isSuspendedChord = nextType === 'Sus4' || nextType === 'Sus2';
                if (isSuspendedChord) {
                    if (tensionDirection === 'final') {
                        // FINAL mode: Sus chords are NOT endings - they leave unresolved tension
                        // Strong penalty - you don't end on a suspended chord
                        totalScore *= 0.45; // 55% penalty - sus chords are not final chords
                    } else if (tensionDirection === 'resolve') {
                        // Check if this is a dominant-function sus chord (common cadential pattern)
                        const susChordFunction = nextFunction; // Already calculated above

                        if (susChordFunction === 'dominant') {
                            // V-sus4 is a CLASSIC pre-resolution chord
                            // Light penalty only - this is good voice leading to I
                            totalScore *= 0.85; // Only 15% penalty for dominant sus
                        } else if (susChordFunction === 'subdominant') {
                            // IV-sus4 is also valid in plagal cadences
                            totalScore *= 0.78; // 22% penalty
                        } else {
                            // Other sus chords in resolve context are less common
                            totalScore *= 0.65; // 35% penalty (reduced from 45%)
                        }
                    } else if (tensionDirection === 'build') {
                        // Sus chords are good for building tension
                        // Give a small bonus for dominant sus in build mode
                        const susChordFunction = nextFunction;
                        if (susChordFunction === 'dominant') {
                            totalScore *= 1.08; // 8% bonus for V-sus4 building tension
                        }
                        // Other sus chords: no adjustment (they naturally score well)
                    }
                    // 'maintain' direction: no adjustment, suspended chords are neutral
                }

                // Apply simplicity bonus for basic triads vs. extended chords
                // This helps simple Major/Minor triads compete against 7th chords
                // which often score equally or higher due to more voice leading options
                const isSimpleTriad = nextType === 'Major' || nextType === 'Minor';
                const is7thChord = nextType.includes('7th') || nextType.includes('9th') || nextType.includes('11th') || nextType.includes('13th');

                if (isSimpleTriad) {
                    // Bonus for simple triads, scaled by style appropriateness
                    let simplicityBonus = 0;
                    if (style === 'pop') {
                        simplicityBonus = 12; // Strong preference for triads in pop
                    } else if (style === 'rock') {
                        simplicityBonus = 15; // Very strong preference for triads in rock
                    } else if (style === 'classical') {
                        simplicityBonus = 8;  // Moderate preference in classical
                    } else if (style === 'indie') {
                        simplicityBonus = 6;  // Slight preference in indie
                    } else if (style === 'jazz') {
                        simplicityBonus = 0;  // No preference in jazz - 7ths are idiomatic
                    } else {
                        simplicityBonus = 5;  // Small preference in balanced mode
                    }
                    totalScore += simplicityBonus;
                } else if (is7thChord && style !== 'jazz') {
                    // Small penalty for 7th chords in non-jazz styles
                    // This helps prevent 7th chord dominance in pop/rock/etc.
                    let extendedPenalty = 0;
                    if (style === 'pop') {
                        extendedPenalty = 6;  // 7ths are less common in pop
                    } else if (style === 'rock') {
                        extendedPenalty = 8;  // 7ths are less common in rock
                    } else if (style === 'classical') {
                        extendedPenalty = 3;  // 7ths are used but less frequent
                    } else if (style === 'balanced') {
                        extendedPenalty = 3;  // Small penalty to maintain variety
                    }
                    totalScore -= extendedPenalty;
                }

                // Check if this is a borrowed chord
                const borrowedInfo = getBorrowedChordInfo(nextRoot, nextType, key);

                // Phase 2: Get section-specific reasons
                let sectionReasons = [];
                if (sectionScoreDetails && sectionScoreDetails.hasSection) {
                    sectionReasons = generateSectionReasons(sectionScoreDetails);
                }

                // Generate human-readable reason
                const reason = generateReason(
                    currentRoot, nextRoot, nextType, nextInversion,
                    functionScore, voiceLeadingScore, styleFit, moodFit,
                    currentFunction, nextFunction, tensionDirection,
                    contextScore, context, modalInterchangeScore, borrowedInfo,
                    key, nextDegree,  // Add key and degree for accurate cadence text
                    harmonicDetails, voiceLeadingDetails,  // Phase 1 enhanced scoring details
                    sectionReasons  // Phase 2: Section-aware reasons
                );

                // Calculate chord-specific duration adjustments
                // Some chord types/functions may warrant different durations
                let chordDurationAdjustment = null;
                if (rhythmicAnalysis) {
                    chordDurationAdjustment = calculateChordDurationAdjustment(
                        nextRoot, nextType, nextFunction, nextDegree,
                        tensionDirection, rhythmicAnalysis, sectionContext
                    );
                }

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
                    borrowedFrom: borrowedInfo ? borrowedInfo.mode : null,
                    // Phase 1 enhanced scoring details
                    extendedHarmonicScore: useEnhancedScoring ? extendedHarmonicScore : null,
                    resolutionScore: useEnhancedScoring ? resolutionScore : null,
                    harmonicDetails: useEnhancedScoring ? harmonicDetails : null,
                    voiceLeadingDetails: useEnhancedScoring ? voiceLeadingDetails : null,
                    // Phase 2 section-aware details
                    sectionScore: sectionScore,
                    sectionDetails: sectionScoreDetails,
                    sectionReasons: sectionReasons,
                    // Phase 3 tension arc details
                    tensionArcScore: tensionArcScore,
                    tensionArcDetails: tensionArcDetails,
                    // Phase 4 forward context details (how well this leads to the next chord)
                    forwardContextScore: forwardContextScore,
                    forwardContextDetails: forwardContextDetails,
                    // Rhythmic/Duration suggestions
                    suggestedDuration: rhythmicAnalysis
                        ? (chordDurationAdjustment?.duration ?? rhythmicAnalysis.suggestedDuration)
                        : null,
                    durationConfidence: rhythmicAnalysis
                        ? (chordDurationAdjustment?.confidence ?? rhythmicAnalysis.durationConfidence)
                        : null,
                    durationReason: rhythmicAnalysis
                        ? (chordDurationAdjustment?.reason ?? rhythmicAnalysis.reasoning[0]?.adjustment)
                        : null,
                    durationAlternatives: rhythmicAnalysis
                        ? rhythmicAnalysis.alternativeDurations
                        : null,
                    rhythmicContext: rhythmicAnalysis ? {
                        averageDuration: rhythmicAnalysis.averageDuration,
                        harmonicRhythmTrend: rhythmicAnalysis.harmonicRhythmTrend,
                        sectionPosition: rhythmicAnalysis.sectionPosition
                    } : null
                });
                } catch (e) {
                    // Skip this chord if there's an error evaluating it
                }
            }
        });
    });

    // Sort by total score (highest first)
    recommendations.sort((a, b) => b.score - a.score);

    // Normalize scores to use a better 0-100 range for better differentiation
    // This preserves relative ordering while spreading scores more evenly
    if (recommendations.length > 1) {
        const scores = recommendations.map(r => r.score);
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        const range = maxScore - minScore;

        if (range > 0) {
            // Normalize to 15-100 range (keeping minimum at 15 so no chord appears completely "bad")
            const normalizedMin = 15;
            const normalizedRange = 100 - normalizedMin;

            recommendations.forEach(rec => {
                const normalizedScore = normalizedMin + ((rec.score - minScore) / range) * normalizedRange;
                rec.originalScore = rec.score; // Keep original for debugging
                rec.score = Math.round(normalizedScore);
                rec.confidence = rec.score; // Update confidence to match
            });
        }
    }

    // Return limited results (or all if limit is 0/null)
    const result = (limit && limit > 0) ? recommendations.slice(0, limit) : recommendations;

    // ==========================================================================
    // CACHE STORE: Save results for future calls with same parameters
    // ==========================================================================
    if (canUseCache && _cacheKey) {
        pruneCache();
        // Store a copy to prevent mutation issues
        recommendationCache.set(_cacheKey, result.map(r => ({ ...r })));
    }

    return result;
}

/**
 * Score harmonic function relationships
 * Returns 0-100 score based on how well the harmonic progression works
 * @param {string|null} currentFunction - Current chord's harmonic function
 * @param {string|null} nextFunction - Next chord's harmonic function
 * @param {string} tensionDirection - Tension direction
 * @param {number|null} currentDegree - Current chord's scale degree (1-7)
 * @param {number|null} nextDegree - Next chord's scale degree (1-7)
 * @returns {number} Score 0-100
 */
function scoreHarmonicFunction(currentFunction, nextFunction, tensionDirection, currentDegree = null, nextDegree = null) {
    // =========================================================================
    // HARMONIC FUNCTION SCORING - Standardized Deltas
    // =========================================================================
    // Base philosophy:
    // - "Preferred" direction bonus: +12 points (standardized delta)
    // - Base scores represent musical commonality
    // - V→vi (deceptive) is musically valid and common - don't over-penalize
    // - I/iii/vi are distinguished by nextDegree parameter
    //
    // tensionDirection values:
    // - 'build': Continue building tension (BUILDING mode)
    // - 'resolve': Approaching resolution (CONCLUDING mode) - prepares for cadence
    // - 'final': Last chord (FINAL mode) - should strongly favor actual resolution
    // - 'maintain': Sustain current level
    // =========================================================================

    let score = 50; // Base score for unhandled cases

    // Handle borrowed chords (chords outside the key)
    // These have null function and should NOT be treated as TONIC
    if (currentFunction === null || nextFunction === null) {
        // Borrowed chords get a neutral base score
        // Modal interchange scoring will handle their appropriateness separately
        return 50; // Neutral - let modal interchange score decide
    }

    // Standardized delta: 12 points for being in "preferred" tension direction
    const TENSION_DELTA = 12;
    // FINAL mode gets even stronger preference for resolution
    const FINAL_DELTA = 18;

    // Common harmonic progressions (music theory fundamentals)
    if (currentFunction === HARMONIC_FUNCTIONS.TONIC) {
        if (nextFunction === HARMONIC_FUNCTIONS.SUBDOMINANT) {
            // T→S: Natural forward motion, builds toward dominant
            // Base: 83 (very common), Build bonus: +12
            // FINAL mode: Should stay on tonic, not move to subdominant
            const base = 83;
            if (tensionDirection === 'final') {
                score = base - 15; // Penalty - final chord should be tonic, not moving away
            } else if (tensionDirection === 'build') {
                score = base + TENSION_DELTA;
            } else {
                score = base;
            }
        } else if (nextFunction === HARMONIC_FUNCTIONS.DOMINANT) {
            // T→D: Skipping subdominant - acceptable but less common than T→S→D
            // Base: 78, Build bonus: +12
            // FINAL mode: Should stay on tonic, not move to dominant
            const base = 78;
            if (tensionDirection === 'final') {
                score = base - 20; // Strong penalty - going to V when should resolve
            } else if (tensionDirection === 'build') {
                score = base + TENSION_DELTA;
            } else {
                score = base;
            }
        } else if (nextFunction === HARMONIC_FUNCTIONS.TONIC) {
            // T→T: Staying in tonic function - works for maintain
            // Distinguish I→vi, I→iii vs I→I
            if (nextDegree === 1 && currentDegree === 1) {
                // I→I: Repeating exact same chord - good for FINAL (staying on tonic)
                const base = 55;
                if (tensionDirection === 'final') {
                    score = base + FINAL_DELTA; // Good - staying on tonic for final
                } else if (tensionDirection === 'maintain') {
                    score = base + TENSION_DELTA;
                } else {
                    score = base;
                }
            } else {
                // I→vi or I→iii or vice versa: Moving within tonic function
                // FINAL mode: Moving away from I is not ideal for ending
                const base = 72;
                if (tensionDirection === 'final') {
                    score = base - 10; // Penalty - should stay on I for final
                } else if (tensionDirection === 'maintain') {
                    score = base + TENSION_DELTA;
                } else {
                    score = base;
                }
            }
        }
    } else if (currentFunction === HARMONIC_FUNCTIONS.SUBDOMINANT) {
        if (nextFunction === HARMONIC_FUNCTIONS.DOMINANT) {
            // S→D: Classic tension building (IV→V or ii→V)
            // Base: 88 (extremely common), Build bonus: +12 = 100
            // FINAL mode: Should resolve to tonic, not build more tension
            const base = 88;
            if (tensionDirection === 'final') {
                score = base - 15; // Penalty - final should resolve, not build tension
            } else if (tensionDirection === 'build') {
                score = base + TENSION_DELTA;
            } else {
                score = base;
            }
        } else if (nextFunction === HARMONIC_FUNCTIONS.TONIC) {
            // S→T: Resolution paths (plagal cadence or deceptive)
            // Distinguish between actual tonic (I) vs other tonic-function chords (iii, vi)
            if (nextDegree === 1) {
                // IV→I or ii→I (plagal motion) - very strong, common resolution
                // Base: 80, Resolve bonus: +12 = 92, Final bonus: +18 = 98
                const base = 80;
                if (tensionDirection === 'final') {
                    score = base + FINAL_DELTA; // Strongest preference for I in FINAL mode
                } else if (tensionDirection === 'resolve') {
                    score = base + TENSION_DELTA;
                } else {
                    score = base;
                }
            } else if (nextDegree === 6) {
                // IV→vi or ii→vi - less common but musically valid
                // Base: 68, Resolve bonus: +12 = 80
                // FINAL mode: vi is NOT a true ending - don't give bonus
                const base = 68;
                if (tensionDirection === 'final') {
                    score = base - 5; // Slight penalty - vi is not a true ending chord
                } else if (tensionDirection === 'resolve') {
                    score = base + TENSION_DELTA;
                } else {
                    score = base;
                }
            } else {
                // IV→iii or ii→iii - unusual, lower base score
                // Base: 55, Resolve bonus: +12 = 67
                // FINAL mode: iii is NOT an ending chord
                const base = 55;
                if (tensionDirection === 'final') {
                    score = base - 10; // Penalty - iii is not an ending chord
                } else if (tensionDirection === 'resolve') {
                    score = base + TENSION_DELTA;
                } else {
                    score = base;
                }
            }
        } else if (nextFunction === HARMONIC_FUNCTIONS.SUBDOMINANT) {
            // S→S: ii→IV or IV→ii, staying in subdominant
            // Base: 65, Maintain bonus: +12 = 77
            // FINAL mode: Should resolve to tonic, not stay on subdominant
            const base = 65;
            if (tensionDirection === 'final') {
                score = base - 15; // Penalty - final should resolve to tonic
            } else if (tensionDirection === 'maintain') {
                score = base + TENSION_DELTA;
            } else {
                score = base;
            }
        }
    } else if (currentFunction === HARMONIC_FUNCTIONS.DOMINANT) {
        if (nextFunction === HARMONIC_FUNCTIONS.TONIC) {
            // D→T: Resolution - the most fundamental progression in tonal music
            // Distinguish between actual tonic (I) vs other tonic-function chords
            if (nextDegree === 1) {
                // V→I or vii°→I (authentic cadence) - strongest resolution
                // Base: 88, Resolve bonus: +12 = 100, Final bonus: +18 = 106 (capped to 100)
                const base = 88;
                if (tensionDirection === 'final') {
                    score = Math.min(100, base + FINAL_DELTA); // STRONGEST preference for authentic cadence
                } else if (tensionDirection === 'resolve') {
                    score = base + TENSION_DELTA;
                } else {
                    score = base;
                }
            } else if (nextDegree === 6) {
                // V→vi (deceptive cadence) - COMMON and musically valid!
                // Used extensively in pop, classical, and jazz
                // Base: 78, Resolve bonus: +12 = 90
                // FINAL mode: Deceptive cadence is NOT a true ending - penalize
                const base = 78;
                if (tensionDirection === 'final') {
                    score = base - 8; // Deceptive cadence doesn't work as FINAL chord
                } else if (tensionDirection === 'resolve') {
                    score = base + TENSION_DELTA; // Good for CONCLUDING - surprise before real ending
                } else {
                    score = base;
                }
            } else {
                // V→iii - unusual resolution target
                // Base: 58, Resolve bonus: +12 = 70
                // FINAL mode: iii is NOT an ending chord
                const base = 58;
                if (tensionDirection === 'final') {
                    score = base - 15; // Strong penalty - iii is never a final chord
                } else if (tensionDirection === 'resolve') {
                    score = base + TENSION_DELTA;
                } else {
                    score = base;
                }
            }
        } else if (nextFunction === HARMONIC_FUNCTIONS.SUBDOMINANT) {
            // D→S: Retrogression - moving "backwards" in functional harmony
            // Less common but used in rock/pop (V→IV)
            // Base: 60, Maintain bonus: +12 = 72
            // FINAL mode: Going backward is NOT resolving
            const base = 60;
            if (tensionDirection === 'final') {
                score = base - 15; // Strong penalty - should resolve, not regress
            } else if (tensionDirection === 'maintain') {
                score = base + TENSION_DELTA;
            } else {
                score = base;
            }
        } else if (nextFunction === HARMONIC_FUNCTIONS.DOMINANT) {
            // D→D: V→vii° or staying on dominant - building more tension
            // Base: 68, Build bonus: +12 = 80
            // FINAL mode: Should resolve, not continue building
            const base = 68;
            if (tensionDirection === 'final') {
                score = base - 20; // Strong penalty - final chord should resolve!
            } else if (tensionDirection === 'build') {
                score = base + TENSION_DELTA;
            } else {
                score = base;
            }
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
 * Check if a chord transition resolves the leading tone (7th scale degree to tonic)
 * This is the most important voice leading rule in tonal music
 * Returns bonus score if leading tone resolves properly
 *
 * @param {Array} currentMidi - Current chord MIDI values
 * @param {Array} nextMidi - Next chord MIDI values
 * @param {string} key - Musical key
 * @returns {Object} { resolved: boolean, bonus: number, reason: string }
 */
function checkLeadingToneResolution(currentMidi, nextMidi, key) {
    if (!key || !currentMidi || !nextMidi || currentMidi.length === 0 || nextMidi.length === 0) {
        return { resolved: false, bonus: 0, reason: null };
    }

    // Get the leading tone (7th degree) of the key
    const keyIndex = ALL_NOTES.indexOf(key);
    if (keyIndex === -1) return { resolved: false, bonus: 0, reason: null };

    // Leading tone is 11 semitones above tonic (B in C major)
    const leadingTonePc = (keyIndex + 11) % 12;
    const tonicPc = keyIndex;

    // Check if current chord contains the leading tone
    let hasLeadingTone = false;
    let leadingToneMidi = null;

    for (const midi of currentMidi) {
        if (midi % 12 === leadingTonePc) {
            hasLeadingTone = true;
            leadingToneMidi = midi;
            break;
        }
    }

    if (!hasLeadingTone) {
        return { resolved: false, bonus: 0, reason: null };
    }

    // Check if next chord contains the tonic in appropriate voice (should step up)
    // Leading tone should resolve UP by half step to tonic
    const expectedResolution = leadingToneMidi + 1;

    for (const midi of nextMidi) {
        if (midi === expectedResolution || (midi % 12 === tonicPc && Math.abs(midi - leadingToneMidi) <= 2)) {
            // Leading tone resolved properly!
            return {
                resolved: true,
                bonus: 15, // Significant bonus for proper resolution
                reason: 'Leading tone resolves to tonic'
            };
        }
    }

    // Leading tone present but didn't resolve to tonic - this is acceptable but not ideal
    // Don't penalize, but don't reward either
    return { resolved: false, bonus: 0, reason: null };
}

/**
 * Score how well a chord type fits a musical style
 * Returns 0-100 score
 *
 * IMPROVED: Uses gradual scoring tiers instead of binary jumps
 * This creates more nuanced recommendations with better variety
 */
function scoreStyleFit(chordType, style) {
    // Define chord complexity/rarity tiers for each style
    // Each style has its own preference curve

    const styleProfiles = {
        pop: {
            // Pop favors simple, familiar chords
            tier1: ['Major', 'Minor'],                                           // 95: core pop chords
            tier2: ['Dominant 7th', 'Sus4'],                                     // 88: common additions
            tier3: ['Add9', 'Major 7th', 'Sus2'],                               // 78: acceptable color
            tier4: ['Minor 7th', 'Major 6th'],                                  // 68: occasional use
            tier5: ['Dominant 9th', 'Minor 6th', 'Augmented'],                  // 55: rare in pop
            base: 45  // Everything else
        },
        jazz: {
            // Jazz favors extensions and alterations
            tier1: ['Major 7th', 'Minor 7th', 'Dominant 7th'],                  // 95: jazz staples
            tier2: ['Dominant 9th', 'Minor 9th', 'Major 9th', 'Half Diminished 7th'], // 90: common extensions
            tier3: ['Major 6th', 'Minor 6th', 'Add9', 'Diminished 7th'],        // 82: good variety
            tier4: ['Sus4', 'Augmented', 'Dominant 11th', 'Dominant 13th'],     // 75: acceptable
            tier5: ['Major', 'Minor'],                                           // 65: triads less common
            base: 58
        },
        classical: {
            // Classical favors traditional harmony
            tier1: ['Major', 'Minor', 'Dominant 7th'],                          // 95: period-appropriate
            tier2: ['Diminished', 'Diminished 7th', 'Major 7th'],               // 85: Romantic era
            tier3: ['Minor 7th', 'Half Diminished 7th'],                        // 72: occasional
            tier4: ['Augmented', 'Sus4'],                                        // 60: rare but used
            tier5: [],                                                           // n/a
            base: 48
        },
        rock: {
            // Rock favors power and directness
            tier1: ['Major', 'Minor', 'Power Chord'],                           // 95: rock essentials
            tier2: ['Dominant 7th', 'Sus4'],                                    // 88: classic rock sounds
            tier3: ['Sus2', 'Add9', 'Major 7th'],                               // 75: modern rock
            tier4: ['Minor 7th', 'Augmented', 'Diminished'],                    // 62: progressive rock
            tier5: [],
            base: 52
        },
        indie: {
            // Indie favors color and quirk
            tier1: ['Add9', 'Major 7th', 'Minor 7th'],                          // 95: indie favorites
            tier2: ['Major', 'Minor', 'Sus4', 'Sus2'],                          // 88: foundation
            tier3: ['Major 6th', 'Minor 6th', 'Augmented'],                     // 80: color chords
            tier4: ['Dominant 7th', 'Diminished', 'Half Diminished 7th'],       // 70: dramatic moments
            tier5: [],
            base: 62
        },
        balanced: {
            // Balanced gives slight preference to common chords
            tier1: ['Major', 'Minor', 'Dominant 7th'],                          // 85
            tier2: ['Major 7th', 'Minor 7th', 'Sus4'],                          // 80
            tier3: ['Add9', 'Sus2', 'Diminished'],                              // 75
            tier4: ['Augmented', 'Diminished 7th', 'Half Diminished 7th'],      // 70
            tier5: [],
            base: 65
        }
    };

    const profile = styleProfiles[style] || styleProfiles.balanced;

    // Check each tier
    if (profile.tier1.includes(chordType)) return 95;
    if (profile.tier2.includes(chordType)) return 88;
    if (profile.tier3.includes(chordType)) return 78;
    if (profile.tier4.includes(chordType)) return 68;
    if (profile.tier5.includes(chordType)) return 58;

    // Check for partial matches (e.g., "Major 9th" contains "9th")
    // Apply a small bonus if chord type is related to preferred types
    if (style === 'jazz' && (chordType.includes('9th') || chordType.includes('11th') || chordType.includes('13th'))) {
        return 82;
    }
    if (style === 'indie' && chordType.includes('Add')) {
        return 85;
    }

    return profile.base;
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
        else if (nextChordType === 'Sus4') score = 85;
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
    contextScore = 0, context = null, modalInterchangeScore = 50, borrowedInfo = null,
    key = 'C', nextDegree = null,  // Add key and degree for accurate cadence text
    harmonicDetails = null, voiceLeadingDetails = null,  // Phase 1 enhanced scoring details
    sectionReasons = []  // Phase 2 section-aware reasons
) {
    const reasons = [];

    // Phase 2: Add section-specific reasons first (highest priority for user context)
    if (sectionReasons && sectionReasons.length > 0) {
        // Add top 2 section reasons to keep output concise
        reasons.push(...sectionReasons.slice(0, 2));
    }

    // Phase 1 Enhanced: Secondary dominant reasons (highest priority)
    if (harmonicDetails && harmonicDetails.isSecondaryDominant) {
        const target = harmonicDetails.secondaryDominantTarget;
        if (target) {
            reasons.push(`Secondary dominant (V/${target})`);
        }
    }

    // Phase 1 Enhanced: Chromatic mediant reasons
    if (harmonicDetails && harmonicDetails.chromaticMediant) {
        const mediant = harmonicDetails.chromaticMediant;
        if (mediant.isChromaticMediant) {
            reasons.push(`Chromatic mediant (${mediant.type})`);
        }
    }

    // Phase 1 Enhanced: Sequence continuation
    if (harmonicDetails && harmonicDetails.continuesSequence) {
        reasons.push('Continues harmonic sequence');
    }

    // Phase 1 Enhanced: Voice leading quality reasons
    if (voiceLeadingDetails) {
        if (voiceLeadingDetails.hasParallelFifths || voiceLeadingDetails.hasParallelOctaves) {
            // Note: these are typically penalized, but if score is still high, chord has other merits
        }
        if (voiceLeadingDetails.tendencyToneResolved) {
            reasons.push('Resolves leading tone');
        }
        if (voiceLeadingDetails.contraryMotion && voiceLeadingScore >= 75) {
            reasons.push('Strong contrary motion');
        }
    }

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
                // Check if it's actually resolving to I (degree 1)
                if (nextDegree === 1) {
                    reasons.push('Resolves V-I cadence');
                } else if (nextFunction === HARMONIC_FUNCTIONS.TONIC) {
                    // Resolving to another tonic-function chord (iii or vi)
                    reasons.push('Resolves to tonic-function chord');
                }
            } else if (context.cadence.type === 'plagal') {
                // Check if it's actually resolving to I (degree 1)
                if (nextDegree === 1) {
                    reasons.push('Plagal (IV-I) resolution');
                } else if (nextFunction === HARMONIC_FUNCTIONS.TONIC) {
                    // Resolving to another tonic-function chord (iii or vi)
                    // Don't call it "plagal IV-I" when it's not actually going to I
                    reasons.push('Resolves to tonic-function chord');
                }
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
        if (nextFunction === HARMONIC_FUNCTIONS.TONIC && (tensionDirection === 'resolve' || tensionDirection === 'final')) {
            // Only say "Strong resolution to tonic" if it's actually the I chord (degree 1)
            if (nextDegree === 1) {
                if (tensionDirection === 'final') {
                    reasons.push('Perfect final cadence to tonic');
                } else {
                    reasons.push('Strong resolution to tonic');
                }
            } else {
                // For iii or vi (also tonic function but not degree 1)
                reasons.push('Resolution to tonic-function chord');
            }
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

/**
 * Analyze a specific chord transition with detailed scoring breakdown
 * Useful for UI/debugging to understand why a chord was recommended
 *
 * @param {Object} currentChord - {root, type, inversion}
 * @param {Object} nextChord - {root, type, inversion}
 * @param {string} key - Musical key
 * @param {Array} progressionData - Full progression history
 * @param {Object} options - {style, mood, tensionDirection}
 * @returns {Object} Detailed analysis of the chord transition
 */
export function analyzeChordTransition(currentChord, nextChord, key, progressionData = [], options = {}) {
    const { style = 'balanced', mood = 'bright', tensionDirection = 'resolve' } = options;

    const currentMidi = getChordMidi(currentChord.root, currentChord.type, currentChord.inversion || 0);
    const nextMidi = getChordMidi(nextChord.root, nextChord.type, nextChord.inversion || 0);

    if (currentMidi.length === 0 || nextMidi.length === 0) {
        return { error: 'Invalid chord(s)' };
    }

    // Enhanced voice leading analysis
    const voiceLeadingResult = scoreEnhancedVoiceLeading(currentMidi, nextMidi, key, {
        style: style  // Pass style for voice leading preset selection
    });

    // Extended harmonic relationships
    const harmonicResult = scoreExtendedHarmonicRelationships(
        currentChord,
        nextChord,
        key,
        progressionData
    );

    // Detect specific patterns
    const secondaryDominant = detectSecondaryDominant(currentChord, nextChord, key);
    const chromaticMediant = detectChromaticMediant(currentChord, nextChord);
    const parallelMotion = detectParallelMotion(currentMidi, nextMidi);

    // Context analysis
    let contextAnalysis = null;
    if (progressionData.length > 0) {
        contextAnalysis = analyzeProgressionContext(progressionData, key, 4);
    }

    // Get adaptive weights for this context
    const adaptiveWeights = contextAnalysis
        ? getAdaptiveWeights(contextAnalysis, style)
        : null;
    const weightExplanation = contextAnalysis
        ? explainWeightChoices(contextAnalysis, style)
        : null;

    return {
        voiceLeading: {
            score: voiceLeadingResult.score,
            details: voiceLeadingResult,
            parallelMotion
        },
        harmony: {
            score: harmonicResult.score,
            details: harmonicResult,
            secondaryDominant,
            chromaticMediant
        },
        context: contextAnalysis,
        weights: {
            adaptive: adaptiveWeights,
            explanation: weightExplanation
        },
        overallAssessment: generateTransitionAssessment(voiceLeadingResult, harmonicResult, secondaryDominant, chromaticMediant)
    };
}

/**
 * Generate a human-readable assessment of a chord transition
 */
function generateTransitionAssessment(voiceLeading, harmony, secondaryDominant, chromaticMediant) {
    const assessments = [];

    // Voice leading quality
    if (voiceLeading.score >= 80) {
        assessments.push('Excellent voice leading with smooth motion');
    } else if (voiceLeading.score >= 60) {
        assessments.push('Good voice leading');
    } else if (voiceLeading.score < 40) {
        assessments.push('Voice leading could be smoother');
    }

    // Parallel motion warnings
    if (voiceLeading.hasParallelFifths) {
        assessments.push('Contains parallel fifths (traditionally avoided)');
    }
    if (voiceLeading.hasParallelOctaves) {
        assessments.push('Contains parallel octaves (traditionally avoided)');
    }

    // Special harmonic relationships
    if (secondaryDominant && secondaryDominant.isSecondaryDominant) {
        assessments.push(`Functions as secondary dominant (${secondaryDominant.label})`);
    }
    if (chromaticMediant && chromaticMediant.isChromaticMediant) {
        assessments.push(`Chromatic mediant relationship (${chromaticMediant.type})`);
    }

    // Harmonic quality
    if (harmony.score >= 75) {
        assessments.push('Strong harmonic connection');
    } else if (harmony.score >= 50) {
        assessments.push('Acceptable harmonic progression');
    } else {
        assessments.push('Unusual harmonic relationship');
    }

    return assessments;
}

/**
 * Get chord type profile information for UI display
 * @param {string} chordType - The chord type to look up
 * @returns {Object|null} Profile information or null if not found
 */
export function getChordTypeProfile(chordType) {
    return CHORD_TYPE_PROFILES[chordType] || null;
}

// ============================================================================
// RHYTHMIC DURATION ADJUSTMENT FUNCTIONS
// ============================================================================

/**
 * Calculate chord-specific duration adjustments based on harmonic function,
 * chord type, and musical context.
 *
 * @param {string} chordRoot - Root note of the chord
 * @param {string} chordType - Chord type (Major, Minor, etc.)
 * @param {string} harmonicFunction - Harmonic function (tonic, dominant, subdominant)
 * @param {number|null} scaleDegree - Scale degree (1-7) or null
 * @param {string} tensionDirection - Tension direction (resolve, maintain, build)
 * @param {Object} rhythmicAnalysis - Result from analyzeRhythmicContext
 * @param {Object} sectionContext - Current section context
 * @returns {Object|null} Adjusted duration suggestion or null for default
 */
function calculateChordDurationAdjustment(
    chordRoot,
    chordType,
    harmonicFunction,
    scaleDegree,
    tensionDirection,
    rhythmicAnalysis,
    sectionContext
) {
    if (!rhythmicAnalysis) return null;

    const baseDuration = rhythmicAnalysis.suggestedDuration;
    const baseConfidence = rhythmicAnalysis.durationConfidence;
    let adjustedDuration = baseDuration;
    let adjustedConfidence = baseConfidence;
    let reason = null;

    // 1. Cadential chord adjustments
    // V chord (dominant) often has specific rhythmic treatment
    if (scaleDegree === 5 && harmonicFunction === HARMONIC_FUNCTIONS.DOMINANT) {
        if (tensionDirection === 'final') {
            // FINAL mode on dominant? This is unusual - keep it short to rush to resolution
            adjustedDuration = Math.max(1, baseDuration * 0.5);
            adjustedDuration = roundToMusicalDuration(adjustedDuration);
            reason = 'Dominant at section end - should resolve quickly';
            adjustedConfidence = Math.min(80, baseConfidence);
        } else if (tensionDirection === 'resolve') {
            // Pre-resolution dominant - typically shorter to create forward motion
            adjustedDuration = Math.max(1, baseDuration * 0.75);
            adjustedDuration = roundToMusicalDuration(adjustedDuration);
            reason = 'Dominant chord before resolution - shorter for momentum';
            adjustedConfidence = Math.min(90, baseConfidence + 10);
        } else if (tensionDirection === 'build') {
            // Building tension - hold the dominant longer
            adjustedDuration = Math.min(8, baseDuration * 1.25);
            adjustedDuration = roundToMusicalDuration(adjustedDuration);
            reason = 'Building tension on dominant - extended duration';
            adjustedConfidence = Math.min(85, baseConfidence + 5);
        }
    }

    // 2. Tonic resolution adjustments
    // I chord (tonic) at resolution points often gets longer duration
    if (scaleDegree === 1 && harmonicFunction === HARMONIC_FUNCTIONS.TONIC) {
        if (tensionDirection === 'final') {
            // FINAL tonic - give it maximum weight, this is THE ending
            adjustedDuration = Math.min(8, baseDuration * 1.5);
            adjustedDuration = roundToMusicalDuration(adjustedDuration);
            reason = 'Final tonic - satisfying conclusion';
            adjustedConfidence = Math.min(95, baseConfidence + 15);
        } else if (tensionDirection === 'resolve') {
            // Resolution to tonic - give it weight
            adjustedDuration = Math.min(8, baseDuration * 1.25);
            adjustedDuration = roundToMusicalDuration(adjustedDuration);
            reason = 'Resolution to tonic - satisfying arrival';
            adjustedConfidence = Math.min(88, baseConfidence + 8);
        }

        // Final chord of section - even longer
        if (sectionContext && rhythmicAnalysis.sectionPosition === 'final') {
            adjustedDuration = Math.min(8, baseDuration * 1.5);
            adjustedDuration = roundToMusicalDuration(adjustedDuration);
            reason = 'Final tonic chord - section conclusion';
            adjustedConfidence = Math.min(92, baseConfidence + 12);
        }
    }

    // 3. Pre-cadential chord adjustments (IV, ii)
    if (scaleDegree === 4 || scaleDegree === 2) {
        if (rhythmicAnalysis.sectionPosition === 'approaching_cadence') {
            // Subdominant approaching cadence - slight acceleration
            adjustedDuration = Math.max(1, baseDuration * 0.85);
            adjustedDuration = roundToMusicalDuration(adjustedDuration);
            reason = 'Pre-cadential motion - building forward momentum';
            adjustedConfidence = Math.min(80, baseConfidence + 5);
        }
    }

    // 4. Chord type-specific adjustments
    // Tension chords (diminished, augmented) often work better shorter
    if (chordType === 'Diminished' || chordType === 'Diminished 7th' || chordType === 'Augmented') {
        adjustedDuration = Math.max(1, Math.min(adjustedDuration, 2));
        reason = reason || 'Tension chord - shorter duration maintains intensity';
        adjustedConfidence = Math.min(85, adjustedConfidence);
    }

    // Suspended chords often lead to resolution - can be shorter
    if (chordType === 'Sus4' || chordType === 'Sus2') {
        adjustedDuration = Math.max(1, adjustedDuration * 0.85);
        adjustedDuration = roundToMusicalDuration(adjustedDuration);
        reason = reason || 'Suspended chord - anticipating resolution';
    }

    // 5. Jazz chord extensions often benefit from slightly longer durations
    // to let the color notes ring
    if (chordType.includes('9th') || chordType.includes('11th') || chordType.includes('13th')) {
        if (adjustedDuration < 2) {
            adjustedDuration = 2;
            reason = reason || 'Extended chord - allowing colors to register';
            adjustedConfidence = Math.min(80, adjustedConfidence);
        }
    }

    // 6. Section position overrides
    if (rhythmicAnalysis.sectionPosition === 'opening' && !reason) {
        // Opening chords establish the feel - use base duration
        return null; // Use default suggestion
    }

    // If no specific adjustment was made, return null to use default
    if (adjustedDuration === baseDuration && !reason) {
        return null;
    }

    return {
        duration: adjustedDuration,
        confidence: adjustedConfidence,
        reason: reason,
        baseWas: baseDuration,
        adjustmentType: adjustedDuration < baseDuration ? 'shortened' : 'lengthened'
    };
}

/**
 * Round duration to nearest musical value
 * @param {number} duration - Duration in beats
 * @returns {number} Rounded duration
 */
function roundToMusicalDuration(duration) {
    const musicalValues = [0.5, 1, 1.5, 2, 3, 4, 6, 8];
    return musicalValues.reduce((prev, curr) =>
        Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
    );
}

/**
 * Export rhythm-related utilities for external use
 */
export {
    analyzeRhythmicContext,
    quickDurationSuggestion,
    STYLE_HARMONIC_RHYTHM,
    HARMONIC_RHYTHM_TRENDS
};
