/**
 * Melodic Phrase Generator
 * Phase 4: Enhanced Melody Generation
 *
 * Generates complete melodic phrases with contour shapes, phrase-level scoring,
 * and multiple candidate generation for user selection.
 */

import {
    generateMelodySuggestions,
    noteToMidi,
    midiToNote,
    getPitchClass,
    getChordTones,
    isChordTone,
    isScaleTone,
    getScaleNotes,
    SCALES,
    CHORD_INTERVALS,
    STYLE_RULES,
    MOOD_RULES
} from './melodySuggestion.js';
import { getSavedMelodyWeights } from '../config/weightPresets.js';

// -----------------------------------------------------------------------------
// Mood scoring function for phrase generation
// Adapted from melodySuggestion.js scoreMood for use in phrase candidate scoring
// -----------------------------------------------------------------------------

/**
 * Apply mood-based scoring to a note candidate in phrase generation
 * @param {number} noteMidi - MIDI number of the candidate note
 * @param {number} notePc - Pitch class (0-11) of the candidate note
 * @param {Object} chord - Current chord {root, type}
 * @param {Array} chordTones - Pitch classes of chord tones
 * @param {number|null} prevMidi - MIDI of previous note (null if first note)
 * @param {string} mood - Selected mood (bright, dark, jazzy, tense, calm, energetic)
 * @returns {number} Mood bonus/penalty score
 */
function scoreMoodForPhrase(noteMidi, notePc, chord, chordTones, prevMidi, mood) {
    const moodRules = MOOD_RULES[mood];
    if (!moodRules) return 0;

    let moodScore = 0;
    const rootPc = getPitchClass(chord.root);
    const interval = (notePc - rootPc + 12) % 12;
    const octave = Math.floor(noteMidi / 12) - 1;

    // Register bonuses/penalties
    if (moodRules.highRegisterBonus && octave > 4) {
        moodScore += moodRules.highRegisterBonus * (octave - 4);
    }
    if (moodRules.lowRegisterPenalty && octave < 4) {
        moodScore += moodRules.lowRegisterPenalty * (4 - octave);
    }

    // Interval-based bonuses
    if (moodRules.preferMajorThird && interval === 4) {
        moodScore += 12;
    }
    if (moodRules.preferMinorThird && interval === 3) {
        moodScore += 12;
    }
    if (moodRules.preferPerfectFifth && interval === 7) {
        moodScore += 10;
    }
    if (moodRules.preferMinorSixth && interval === 8) {
        moodScore += 10;
    }
    if (moodRules.preferSeventh && (interval === 10 || interval === 11)) {
        moodScore += 10;
    }

    // Tension handling
    if (moodRules.tensionBonus) {
        // Tritone and 9ths get bonus for tense/jazzy moods
        if (interval === 6 || interval === 1 || interval === 2) {
            moodScore += moodRules.tensionBonus;
        }
    }
    if (moodRules.consonanceBonus) {
        // Perfect consonances get bonus for calm mood
        if (interval === 0 || interval === 5 || interval === 7) {
            moodScore += moodRules.consonanceBonus;
        }
    }
    if (moodRules.dissonancePenalty) {
        // Dissonances get penalty for calm mood
        if (interval === 1 || interval === 6 || interval === 11) {
            moodScore += moodRules.dissonancePenalty;
        }
    }

    // Leap handling (if we have a previous note)
    if (prevMidi !== null) {
        const leapSize = Math.abs(noteMidi - prevMidi);

        if (moodRules.wideLeapBonus && leapSize > 5) {
            moodScore += moodRules.wideLeapBonus;
        }
        if (moodRules.wideLeapPenalty && leapSize > 5) {
            moodScore += moodRules.wideLeapPenalty;
        }
        if (moodRules.stepwiseBonus && leapSize <= 2) {
            moodScore += moodRules.stepwiseBonus;
        }
        if (moodRules.stepwisePenalty && leapSize <= 2) {
            moodScore += moodRules.stepwisePenalty;
        }
        if (moodRules.leapBonus && leapSize >= 3 && leapSize <= 7) {
            moodScore += moodRules.leapBonus;
        }
    }

    // Chord tone bonus for energetic mood
    if (moodRules.chordToneBonus) {
        if (chordTones.includes(notePc)) {
            moodScore += moodRules.chordToneBonus;
        }
    }
    if (moodRules.rootBonus && interval === 0) {
        moodScore += moodRules.rootBonus;
    }

    return moodScore;
}
import { getEnharmonicPreferenceForKey } from '../utils/noteUtils.js';

// -----------------------------------------------------------------------------
// Beat Strength Utilities - For rhythm-aware pitch selection
// -----------------------------------------------------------------------------

/**
 * Determine the metric strength of a beat position
 * @param {number} beat - Beat position within measure (0-indexed)
 * @param {number} beatsPerMeasure - Number of beats in the measure
 * @returns {string} 'downbeat' | 'secondary' | 'beat' | 'offbeat' | 'weak'
 */
function getBeatStrength(beat, beatsPerMeasure = 4) {
    // Normalize to handle fractional beats
    const normalizedBeat = beat % beatsPerMeasure;
    const isOnBeat = Math.abs(normalizedBeat - Math.round(normalizedBeat)) < 0.01;
    const roundedBeat = Math.round(normalizedBeat);

    if (Math.abs(normalizedBeat) < 0.01) {
        return 'downbeat'; // Beat 1 - strongest
    }

    if (beatsPerMeasure === 4) {
        // 4/4 time
        if (Math.abs(normalizedBeat - 2) < 0.01) return 'secondary'; // Beat 3
        if (isOnBeat && (roundedBeat === 1 || roundedBeat === 3)) return 'beat'; // Beats 2, 4
    } else if (beatsPerMeasure === 3) {
        // 3/4 time
        if (isOnBeat) return 'beat'; // Beats 2, 3
    } else if (beatsPerMeasure === 2) {
        // 2/4 time
        if (Math.abs(normalizedBeat - 1) < 0.01) return 'beat'; // Beat 2
    } else if (beatsPerMeasure === 6) {
        // 6/8 time (compound duple)
        if (Math.abs(normalizedBeat - 3) < 0.01) return 'secondary'; // Beat 4 (second strong beat)
        if (isOnBeat) return 'beat';
    }

    // Check for "and" of the beat (0.5)
    const fractionalPart = normalizedBeat - Math.floor(normalizedBeat);
    if (Math.abs(fractionalPart - 0.5) < 0.01) {
        return 'offbeat'; // The "and" of any beat
    }

    // Everything else (16th notes, etc.)
    return 'weak';
}

/**
 * Get a score modifier based on beat strength and note type
 * @param {string} beatStrength - 'downbeat' | 'secondary' | 'beat' | 'offbeat' | 'weak'
 * @param {boolean} isChordTone - Whether the note is a chord tone
 * @param {boolean} isScaleTone - Whether the note is a scale tone
 * @param {boolean} isApproachTone - Whether the note is a chromatic approach tone
 * @returns {number} Score modifier to add
 */
function getBeatStrengthScoreModifier(beatStrength, isChordTone, isScaleTone, isApproachTone) {
    switch (beatStrength) {
        case 'downbeat':
            // Strongly prefer chord tones on downbeats
            if (isChordTone) return 20;
            if (isScaleTone) return 5;
            return -15; // Penalize non-scale tones on downbeat
        case 'secondary':
            // Prefer chord tones, but less strictly
            if (isChordTone) return 12;
            if (isScaleTone) return 5;
            return -8;
        case 'beat':
            // Moderate preference for chord tones
            if (isChordTone) return 8;
            if (isScaleTone) return 3;
            return -5;
        case 'offbeat':
            // Approach tones and passing tones are fine here
            if (isApproachTone) return 10;
            if (isChordTone) return 5;
            if (isScaleTone) return 5;
            return 0; // Non-diatonic OK on offbeats
        case 'weak':
            // Anything goes on weak beats - passing tones, approach tones encouraged
            if (isApproachTone) return 12;
            if (isScaleTone) return 3;
            return 2; // Even chromatic tones OK
        default:
            return 0;
    }
}

// -----------------------------------------------------------------------------
// Contour Shape Definitions
// -----------------------------------------------------------------------------

/**
 * Contour shapes define the melodic direction pattern within a phrase
 */
export const CONTOUR_SHAPES = {
    ascending: {
        id: 'ascending',
        label: 'Ascending',
        description: 'Steadily rising melodic line',
        pattern: [0, 0.25, 0.5, 0.75, 1.0],
        weight: (pos) => pos // Linear rise
    },
    descending: {
        id: 'descending',
        label: 'Descending',
        description: 'Steadily falling melodic line',
        pattern: [1.0, 0.75, 0.5, 0.25, 0],
        weight: (pos) => 1 - pos // Linear fall
    },
    arch: {
        id: 'arch',
        label: 'Arch',
        description: 'Rise to peak then fall - classic phrase shape',
        pattern: [0, 0.5, 1.0, 0.5, 0],
        weight: (pos) => Math.sin(pos * Math.PI) // Smooth arch
    },
    invertedArch: {
        id: 'invertedArch',
        label: 'Inverted Arch',
        description: 'Fall to low point then rise',
        pattern: [1.0, 0.5, 0, 0.5, 1.0],
        weight: (pos) => 1 - Math.sin(pos * Math.PI) // Inverted smooth arch
    },
    wave: {
        id: 'wave',
        label: 'Wave',
        description: 'Oscillating up and down motion',
        pattern: [0.5, 1.0, 0.5, 0, 0.5, 1.0],
        weight: (pos) => 0.5 + 0.5 * Math.sin(pos * Math.PI * 2) // Full wave
    },
    plateau: {
        id: 'plateau',
        label: 'Plateau',
        description: 'Rise, hold, then fall',
        pattern: [0, 0.8, 1.0, 1.0, 0.8, 0],
        weight: (pos) => {
            if (pos < 0.25) return pos * 4;
            if (pos > 0.75) return (1 - pos) * 4;
            return 1.0;
        }
    },
    ramp: {
        id: 'ramp',
        label: 'Ramp Up',
        description: 'Gradual build to climax at end',
        pattern: [0, 0.1, 0.3, 0.6, 1.0],
        weight: (pos) => pos * pos // Exponential rise
    },
    cascade: {
        id: 'cascade',
        label: 'Cascade',
        description: 'Start high and tumble down with steps',
        pattern: [1.0, 0.9, 0.7, 0.4, 0],
        weight: (pos) => 1 - (pos * pos) // Exponential fall
    },
    static: {
        id: 'static',
        label: 'Static',
        description: 'Stays around same pitch level',
        pattern: [0.5, 0.5, 0.5, 0.5, 0.5],
        weight: () => 0.5 // Constant middle
    },
    question: {
        id: 'question',
        label: 'Question',
        description: 'Ends on upward motion (interrogative)',
        pattern: [0.5, 0.3, 0.2, 0.4, 0.8],
        weight: (pos) => pos < 0.6 ? 0.3 - pos * 0.2 : (pos - 0.6) * 2
    },
    answer: {
        id: 'answer',
        label: 'Answer',
        description: 'Ends on downward resolution',
        pattern: [0.5, 0.7, 0.8, 0.5, 0.2],
        weight: (pos) => pos < 0.5 ? 0.5 + pos * 0.6 : 1.1 - pos
    }
};

// -----------------------------------------------------------------------------
// Phrase Length and Rhythm Patterns
// -----------------------------------------------------------------------------

export const PHRASE_LENGTHS = {
    short: { notes: 4, label: '2 beats (half measure)', beats: 2 },
    medium: { notes: 8, label: '4 beats (1 measure)', beats: 4 },
    long: { notes: 12, label: '8 beats (2 measures)', beats: 8 },
    extended: { notes: 16, label: '16 beats (4 measures)', beats: 16 }
};

export const RHYTHM_PATTERNS = {
    steady: {
        id: 'steady',
        label: 'Steady',
        description: 'Even note values',
        getPattern: (length) => Array(length).fill(1)
    },
    longShort: {
        id: 'longShort',
        label: 'Long-Short',
        description: 'Alternating long and short notes',
        getPattern: (length) => Array(length).fill(0).map((_, i) => i % 2 === 0 ? 2 : 1)
    },
    shortLong: {
        id: 'shortLong',
        label: 'Short-Long',
        description: 'Alternating short and long notes',
        getPattern: (length) => Array(length).fill(0).map((_, i) => i % 2 === 0 ? 1 : 2)
    },
    accelerating: {
        id: 'accelerating',
        label: 'Accelerating',
        description: 'Notes get faster',
        getPattern: (length) => Array(length).fill(0).map((_, i) => Math.max(1, 3 - Math.floor(i / 3)))
    },
    decelerating: {
        id: 'decelerating',
        label: 'Decelerating',
        description: 'Notes get slower',
        getPattern: (length) => Array(length).fill(0).map((_, i) => 1 + Math.floor(i / 3))
    },
    syncopated: {
        id: 'syncopated',
        label: 'Syncopated',
        description: 'Off-beat emphasis',
        getPattern: (length) => {
            const pattern = [];
            for (let i = 0; i < length; i++) {
                pattern.push(i % 4 === 1 || i % 4 === 3 ? 2 : 1);
            }
            return pattern;
        }
    },
    even8th: {
        id: 'even8th',
        label: 'Even 8th Notes',
        description: 'All eighth notes - steady 8th note feel',
        fixedNoteValue: 0.5, // Each note is exactly 0.5 beats (8th note)
        getPattern: (length) => Array(length).fill(0.5) // All 8th notes (0.5 beats each)
    },
    even16th: {
        id: 'even16th',
        label: 'Even 16th Notes',
        description: 'All sixteenth notes - fast, busy feel',
        fixedNoteValue: 0.25, // Each note is exactly 0.25 beats (16th note)
        getPattern: (length) => Array(length).fill(0.25) // All 16th notes (0.25 beats each)
    },
    swing: {
        id: 'swing',
        label: 'Swing',
        description: 'Jazz swing feel - long-short triplet groove',
        getPattern: (length) => {
            // Swing is typically 2:1 ratio (like triplet quarter + triplet eighth)
            // For every pair: first note gets 2/3, second gets 1/3
            const pattern = [];
            for (let i = 0; i < length; i++) {
                pattern.push(i % 2 === 0 ? 2 : 1); // 2:1 ratio for swing feel
            }
            return pattern;
        }
    },
    mixed: {
        id: 'mixed',
        label: 'Mixed Rhythms',
        description: 'Varied rhythm values for interest',
        getPattern: (length) => {
            // Mix of different note values for rhythmic variety
            const rhythmOptions = [1, 1, 1.5, 2, 0.5, 0.5, 1];
            const pattern = [];
            for (let i = 0; i < length; i++) {
                pattern.push(rhythmOptions[i % rhythmOptions.length]);
            }
            return pattern;
        }
    },
    // =========================================================================
    // NEW RHYTHM PATTERNS - Added for improved variety and musicality
    // =========================================================================
    dottedQuarterEighth: {
        id: 'dottedQuarterEighth',
        label: 'Dotted Quarter-Eighth',
        description: 'Classic dotted rhythm - very singable and memorable',
        getPattern: (length) => {
            // Alternating dotted quarter (1.5) and eighth (0.5)
            const pattern = [];
            for (let i = 0; i < length; i++) {
                pattern.push(i % 2 === 0 ? 1.5 : 0.5);
            }
            return pattern;
        }
    },
    dottedEighthSixteenth: {
        id: 'dottedEighthSixteenth',
        label: 'Dotted Eighth-Sixteenth',
        description: 'Bouncy dotted rhythm - energetic feel',
        getPattern: (length) => {
            // Alternating dotted eighth (0.75) and sixteenth (0.25)
            const pattern = [];
            for (let i = 0; i < length; i++) {
                pattern.push(i % 2 === 0 ? 0.75 : 0.25);
            }
            return pattern;
        }
    },
    backbeat: {
        id: 'backbeat',
        label: 'Backbeat',
        description: 'Emphasis on beats 2 and 4 - rock/pop feel',
        getPattern: (length) => {
            // Short pickup, long on backbeats
            const pattern = [];
            for (let i = 0; i < length; i++) {
                // Creates: short-LONG-short-LONG pattern
                pattern.push(i % 2 === 0 ? 0.5 : 1.5);
            }
            return pattern;
        }
    },
    anacrusis: {
        id: 'anacrusis',
        label: 'Pickup Notes',
        description: 'Starts with pickup notes leading to downbeat',
        getPattern: (length) => {
            if (length < 3) return Array(length).fill(1);
            // Start with short pickups, land on longer downbeat
            const pattern = [0.5, 0.5]; // Two pickup eighth notes
            pattern.push(2); // Land on half note
            // Fill remaining with quarters
            for (let i = 3; i < length; i++) {
                pattern.push(1);
            }
            return pattern;
        }
    },
    tripletFeel: {
        id: 'tripletFeel',
        label: 'Triplet Feel',
        description: 'Groups of three - waltz-like or jazz feel',
        getPattern: (length) => {
            // Each "beat" divided into 3 parts (approximated with standard durations)
            // Using 2/3 beat per note (closest standard is 0.67, we'll use pattern scaling)
            const pattern = [];
            for (let i = 0; i < length; i++) {
                // Create groups of 3 with slight accent on first
                pattern.push(i % 3 === 0 ? 1.2 : 0.9);
            }
            return pattern;
        }
    },
    marchlike: {
        id: 'marchlike',
        label: 'March-like',
        description: 'Strong downbeats with even subdivision',
        getPattern: (length) => {
            // Long-short-short pattern (like a march or gallop)
            const pattern = [];
            for (let i = 0; i < length; i++) {
                const pos = i % 3;
                if (pos === 0) pattern.push(2);      // Long downbeat
                else pattern.push(1);                 // Short follow-ups
            }
            return pattern;
        }
    },
    cadential: {
        id: 'cadential',
        label: 'Cadential',
        description: 'Slows down at phrase endings - natural resolution',
        getPattern: (length) => {
            // Start faster, end slower
            const pattern = [];
            for (let i = 0; i < length; i++) {
                const position = i / (length - 1); // 0 to 1
                // Gradually increase note length: 0.5 -> 2
                pattern.push(0.5 + position * 1.5);
            }
            return pattern;
        }
    },
    hemiola: {
        id: 'hemiola',
        label: 'Hemiola',
        description: '3 against 2 feel - creates rhythmic tension',
        getPattern: (length) => {
            // Groups of 3 over groups of 2
            const pattern = [];
            for (let i = 0; i < length; i++) {
                // Alternating 3-beat and 2-beat groupings
                const group = Math.floor(i / 2) % 2;
                pattern.push(group === 0 ? 1.5 : 1);
            }
            return pattern;
        }
    },
    restful: {
        id: 'restful',
        label: 'Spacious',
        description: 'Longer notes with breathing room',
        getPattern: (length) => {
            // Longer notes create a relaxed, spacious feel
            const pattern = [];
            for (let i = 0; i < length; i++) {
                // Alternate between half notes and quarters with variety
                pattern.push(i % 3 === 0 ? 2 : 1.5);
            }
            return pattern;
        }
    },
    driving: {
        id: 'driving',
        label: 'Driving',
        description: 'Consistent eighth notes with occasional longer notes',
        getPattern: (length) => {
            const pattern = [];
            for (let i = 0; i < length; i++) {
                // Mostly eighths with occasional quarters for breathing
                pattern.push(i % 4 === 3 ? 1 : 0.5);
            }
            return pattern;
        }
    }
};

// -----------------------------------------------------------------------------
// Rhythmic Variation Modes - Add human-like imperfection and expression
// -----------------------------------------------------------------------------

/**
 * Rhythmic variation modes allow for controlled imperfection in rhythm
 * This makes melodies sound more natural and less mechanical
 */
export const RHYTHMIC_VARIATION_MODES = {
    none: {
        id: 'none',
        label: 'Exact',
        description: 'Use rhythm pattern exactly as generated',
        variationRange: 0
    },
    subtle: {
        id: 'subtle',
        label: 'Subtle',
        description: 'Very slight variations - almost imperceptible',
        variationRange: 0.15
    },
    moderate: {
        id: 'moderate',
        label: 'Moderate',
        description: 'Noticeable but tasteful variations',
        variationRange: 0.3
    },
    expressive: {
        id: 'expressive',
        label: 'Expressive',
        description: 'Significant rubato-style variations',
        variationRange: 0.5
    },
    free: {
        id: 'free',
        label: 'Free',
        description: 'Very loose interpretation of rhythm',
        variationRange: 0.7
    }
};

/**
 * Apply rhythmic variation to a rhythm array
 * @param {Array<number>} rhythm - Array of beat durations
 * @param {string} variationMode - Variation mode id
 * @param {Array<number>} standardDurations - Available standard durations to snap to
 * @returns {Array<number>} Modified rhythm array
 */
function applyRhythmicVariation(rhythm, variationMode, standardDurations) {
    const mode = RHYTHMIC_VARIATION_MODES[variationMode] || RHYTHMIC_VARIATION_MODES.none;
    if (mode.variationRange === 0) return rhythm;

    const snapToNearest = (value) => {
        let closest = value;
        let minDiff = Infinity;
        for (const std of standardDurations) {
            const diff = Math.abs(value - std);
            if (diff < minDiff) {
                minDiff = diff;
                closest = std;
            }
        }
        return closest;
    };

    return rhythm.map((duration, i) => {
        // Don't vary first and last notes as much (phrase boundaries should be stable)
        const positionFactor = (i === 0 || i === rhythm.length - 1) ? 0.3 : 1;

        // Random variation within range
        const variation = (Math.random() - 0.5) * 2 * mode.variationRange * positionFactor;

        // Apply variation and snap to standard duration
        const varied = duration * (1 + variation);

        // Ensure we don't go below 16th note or above whole note
        const clamped = Math.max(0.25, Math.min(4, varied));

        return snapToNearest(clamped);
    });
}

/**
 * Apply intelligent phrase-aware variation
 * This variation considers musical context like phrase endings and climaxes
 * @param {Array<number>} rhythm - Array of beat durations
 * @param {Array<Object>} noteDetails - Note details for context
 * @param {string} variationMode - Variation mode id
 * @param {Array<number>} standardDurations - Available standard durations
 * @returns {Array<number>} Modified rhythm array
 */
function applyContextualVariation(rhythm, noteDetails, variationMode, standardDurations) {
    const mode = RHYTHMIC_VARIATION_MODES[variationMode] || RHYTHMIC_VARIATION_MODES.none;
    if (mode.variationRange === 0) return rhythm;

    const snapToNearest = (value) => {
        let closest = value;
        let minDiff = Infinity;
        for (const std of standardDurations) {
            const diff = Math.abs(value - std);
            if (diff < minDiff) {
                minDiff = diff;
                closest = std;
            }
        }
        return closest;
    };

    return rhythm.map((duration, i) => {
        let variationFactor = 1;

        // Phrase boundaries: more stable
        if (i === 0 || i === rhythm.length - 1) {
            variationFactor *= 0.2;
        }

        // Chord tones: slightly more stable (they're "landing points")
        if (noteDetails[i]?.isChordTone) {
            variationFactor *= 0.7;
        }

        // High notes (potential climax): can stretch slightly
        const isHighPoint = noteDetails[i]?.midi > 72; // Above C5
        if (isHighPoint) {
            variationFactor *= 1.2;
        }

        // Apply variation
        const variation = (Math.random() - 0.5) * 2 * mode.variationRange * variationFactor;
        const varied = duration * (1 + variation);
        const clamped = Math.max(0.25, Math.min(4, varied));

        return snapToNearest(clamped);
    });
}

// -----------------------------------------------------------------------------
// Section Type Profiles for Melody Generation
// -----------------------------------------------------------------------------

/**
 * Section type profiles define melodic characteristics for different song sections.
 * These influence note selection, density preferences, and range usage.
 */
export const SECTION_MELODY_PROFILES = {
    verse: {
        id: 'verse',
        label: 'Verse',
        description: 'Conversational, narrative - moderate movement and range',
        // Scoring adjustments
        chordToneBonus: 1.0,        // Normal chord tone preference
        stepwiseBonus: 1.2,         // Prefer stepwise motion (conversational)
        leapPenalty: 1.0,           // Normal leap penalty
        rangeMultiplier: 0.85,      // Slightly narrower range
        densityMultiplier: 0.9,     // Slightly less dense
        // Preferred contours for this section
        preferredContours: ['arch', 'wave', 'static', 'question'],
        // Position preferences (0=low, 1=high relative to range)
        preferredRangeCenter: 0.45, // Slightly below center
        // Repetition tolerance (verses often have melodic motifs)
        repetitionBonus: 8,
        // Ending preference
        endingPreference: 'open'    // Doesn't need strong resolution
    },
    chorus: {
        id: 'chorus',
        label: 'Chorus',
        description: 'Memorable hook - wider intervals, higher energy',
        chordToneBonus: 1.3,        // Strong chord tone preference (memorable)
        stepwiseBonus: 0.8,         // Allow more leaps
        leapPenalty: 0.7,           // Reduced leap penalty (hooks use leaps)
        rangeMultiplier: 1.15,      // Wider range
        densityMultiplier: 1.0,     // Normal density
        preferredContours: ['arch', 'plateau', 'ascending'],
        preferredRangeCenter: 0.6,  // Higher in range
        repetitionBonus: 15,        // Choruses thrive on repetition
        endingPreference: 'strong'  // Strong resolution
    },
    bridge: {
        id: 'bridge',
        label: 'Bridge',
        description: 'Contrast and departure - explore different territory',
        chordToneBonus: 0.9,        // Slightly less chord-focused
        stepwiseBonus: 1.0,         // Normal
        leapPenalty: 0.8,           // Allow some unexpected leaps
        rangeMultiplier: 1.1,       // Slightly wider
        densityMultiplier: 1.0,     // Normal
        preferredContours: ['ascending', 'ramp', 'wave', 'invertedArch'],
        preferredRangeCenter: 0.55, // Slightly higher
        repetitionBonus: -5,        // Avoid repetition (contrast)
        endingPreference: 'tension' // Can end with tension
    },
    intro: {
        id: 'intro',
        label: 'Intro',
        description: 'Establishing mood - simple, clear, sets expectations',
        chordToneBonus: 1.4,        // Very chord-focused (clear tonality)
        stepwiseBonus: 1.1,         // Prefer smooth motion
        leapPenalty: 1.2,           // Avoid jarring leaps
        rangeMultiplier: 0.8,       // Narrow range
        densityMultiplier: 0.7,     // Sparse
        preferredContours: ['ascending', 'arch', 'static'],
        preferredRangeCenter: 0.4,  // Lower register
        repetitionBonus: 10,        // Simple motifs work well
        endingPreference: 'open'    // Leads into song
    },
    outro: {
        id: 'outro',
        label: 'Outro',
        description: 'Conclusion and resolution - winding down',
        chordToneBonus: 1.3,        // Chord-focused (resolution)
        stepwiseBonus: 1.2,         // Smooth descent
        leapPenalty: 1.1,           // Avoid surprises
        rangeMultiplier: 0.85,      // Narrowing down
        densityMultiplier: 0.8,     // Slowing down
        preferredContours: ['descending', 'cascade', 'answer'],
        preferredRangeCenter: 0.35, // Lower, settling
        repetitionBonus: 12,        // Fading repetition works
        endingPreference: 'resolved' // Must resolve
    },
    prechorus: {
        id: 'prechorus',
        label: 'Pre-Chorus',
        description: 'Building anticipation - rising energy toward chorus',
        chordToneBonus: 1.1,        // Slightly chord-focused
        stepwiseBonus: 0.9,         // Allow building motion
        leapPenalty: 0.9,           // Some leaps OK
        rangeMultiplier: 1.0,       // Normal
        densityMultiplier: 1.1,     // Slightly busier
        preferredContours: ['ascending', 'ramp', 'arch'],
        preferredRangeCenter: 0.5,  // Building upward
        repetitionBonus: 5,         // Some repetition OK
        endingPreference: 'tension' // End with anticipation
    },
    solo: {
        id: 'solo',
        label: 'Solo',
        description: 'Expressive freedom - wider range, varied motion',
        chordToneBonus: 0.8,        // More freedom from chord tones
        stepwiseBonus: 0.7,         // Free to leap
        leapPenalty: 0.5,           // Leaps encouraged
        rangeMultiplier: 1.3,       // Wide range
        densityMultiplier: 1.2,     // Can be dense
        preferredContours: ['wave', 'arch', 'ramp', 'cascade'],
        preferredRangeCenter: 0.5,  // Full range usage
        repetitionBonus: -10,       // Avoid repetition
        endingPreference: 'strong'  // End with impact
    },
    breakdown: {
        id: 'breakdown',
        label: 'Breakdown',
        description: 'Stripped back - minimal, rhythmic focus',
        chordToneBonus: 1.5,        // Very chord-focused
        stepwiseBonus: 1.3,         // Minimal movement
        leapPenalty: 1.5,           // Strong leap penalty
        rangeMultiplier: 0.6,       // Very narrow
        densityMultiplier: 0.6,     // Sparse
        preferredContours: ['static', 'plateau'],
        preferredRangeCenter: 0.4,  // Lower/mid
        repetitionBonus: 20,        // Repetition is key
        endingPreference: 'open'    // Builds back up
    }
};

/**
 * Get section profile with fallback to default
 * @param {string} sectionType - Section type identifier
 * @returns {Object} Section profile
 */
function getSectionProfile(sectionType) {
    if (!sectionType) return null;
    const normalized = sectionType.toLowerCase().replace(/[^a-z]/g, '');
    return SECTION_MELODY_PROFILES[normalized] || null;
}

// -----------------------------------------------------------------------------
// Chromatic notes for MIDI conversion
// -----------------------------------------------------------------------------

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Get correctly spelled note name based on key
 * @param {number} pitchClass - 0-11 pitch class index
 * @param {string} key - Key signature for enharmonic preference
 * @returns {string} Note name with correct spelling for the key
 */
function getSpelledNoteName(pitchClass, key) {
    const preference = getEnharmonicPreferenceForKey(key);
    return preference === 'flat' ? FLAT_NOTES[pitchClass] : CHROMATIC_NOTES[pitchClass];
}

// -----------------------------------------------------------------------------
// Phrase Generation Functions
// -----------------------------------------------------------------------------

/**
 * Generate a melodic phrase based on contour shape and musical context
 *
 * @param {Object} options - Generation options
 * @param {Object} options.chord - Current chord {root, type}
 * @param {string} options.key - Current key (e.g., 'C', 'Gm')
 * @param {string} options.contourId - Contour shape ID
 * @param {string} options.lengthId - Phrase length ID (short, medium, long, extended)
 * @param {string} options.rhythmId - Rhythm pattern ID
 * @param {string} options.styleId - Style preset ID (pop, jazz, classical, rock)
 * @param {string} options.mood - Mood preset ID (bright, dark, jazzy, tense, calm, energetic)
 * @param {string} options.previousNote - Last note before phrase (for voice leading)
 * @param {number} options.octave - Target octave (default 4)
 * @param {number} options.range - Range in semitones (default 12)
 * @param {number} options.densityMultiplier - Note density multiplier (0.5-1.5, default 1.0)
 * @param {Array} options.chordSequence - Chord sequence for multi-chord phrases
 * @returns {Object} Generated phrase with notes, rhythm, and scoring
 */
export function generatePhrase({
    chord = { root: 'C', type: 'Major' },
    key = 'C',
    contourId = 'arch',
    lengthId = 'medium',
    rhythmId = 'steady',
    styleId = 'any',
    mood = 'bright', // Mood preset for emotional character
    previousNote = null,
    octave = 4,
    range = 12,
    // Note density multiplier (0.5 = sparse, 1.0 = normal, 1.5 = dense)
    densityMultiplier = 1.0,
    // Chord sequence for multi-chord phrases
    // Array of { chord, noteIndices } or null to use single chord
    chordSequence = null,
    // Optional: override target beats (for section-aware generation)
    // If provided, this overrides the beats from phraseLength
    targetBeats = null,
    // Optional: context for section-aware generation
    sectionContext = null, // { previousMelody, nextChords, sectionType, timeSignature, startBeat }
    // Optional: rhythmic variation mode ('none', 'subtle', 'moderate', 'expressive', 'free')
    rhythmicVariation = 'none'
} = {}) {
    const contour = CONTOUR_SHAPES[contourId] || CONTOUR_SHAPES.arch;
    const phraseLength = PHRASE_LENGTHS[lengthId] || PHRASE_LENGTHS.medium;
    const rhythmPattern = RHYTHM_PATTERNS[rhythmId] || RHYTHM_PATTERNS.steady;

    // Get section profile for section-aware adjustments
    const sectionType = sectionContext?.sectionType;
    const sectionProfile = getSectionProfile(sectionType);

    // Use targetBeats if provided, otherwise use phraseLength.beats
    const effectiveTargetBeats = targetBeats !== null ? targetBeats : phraseLength.beats;

    // Calculate appropriate note count based on target beats
    // Base note count = 1 note per beat (e.g., 4 beats = 4 notes at normal density)
    // Density multiplier adjusts this: 0.5 = half notes, 1.0 = quarters, 2.0 = eighths
    let baseNoteCount;
    if (targetBeats !== null) {
        // One note per beat as baseline
        baseNoteCount = effectiveTargetBeats;
    } else {
        baseNoteCount = phraseLength.notes;
    }

    // Apply section-aware density adjustment
    const sectionDensityMultiplier = sectionProfile?.densityMultiplier || 1.0;
    const effectiveDensityMultiplier = densityMultiplier * sectionDensityMultiplier;

    // For fixed note-value patterns (even8th, even16th), calculate noteCount from target beats
    // This ensures we get the exact number of notes needed to fill the target duration
    let noteCount;
    if (rhythmPattern.fixedNoteValue) {
        // Fixed note value: calculate how many notes fit in the target beats
        noteCount = Math.round(effectiveTargetBeats / rhythmPattern.fixedNoteValue);
    } else {
        // Apply density multiplier to note count
        // Clamp between 2 notes minimum and a dynamic maximum based on target beats
        // For short phrases (4 beats), max ~16 notes (sixteenths)
        // For longer selections, scale proportionally: max = targetBeats * 4 (allowing up to 16th notes throughout)
        const dynamicMaxNotes = Math.max(24, Math.round(effectiveTargetBeats * 4));
        noteCount = Math.max(2, Math.min(dynamicMaxNotes, Math.round(baseNoteCount * effectiveDensityMultiplier)));
    }
    const notes = [];
    const noteDetails = [];

    // Get scale context
    const scaleType = key.includes('m') ? 'minor' : 'major';
    const keyRoot = key.replace('m', '');
    const scaleNotes = getScaleNotes(keyRoot, scaleType);

    // Get user's custom melody weights and apply them as multipliers to style rules
    // This matches the behavior in melodySuggestion.js for consistency
    const userWeights = getSavedMelodyWeights();
    const baseStyleRules = STYLE_RULES[styleId] || STYLE_RULES.any;
    const styleRules = {
        chordToneBoost: baseStyleRules.chordToneBoost * userWeights.chordTone,
        scaleToneBoost: baseStyleRules.scaleToneBoost * userWeights.scaleTone,
        stepwiseBoost: baseStyleRules.stepwiseBoost * userWeights.voiceLeading,
        approachToneBoost: baseStyleRules.approachToneBoost * userWeights.approachTone,
        tensionPenalty: baseStyleRules.tensionPenalty / userWeights.tensionTolerance, // Inverse relationship
        preferredIntervals: baseStyleRules.preferredIntervals,
        avoidIntervals: baseStyleRules.avoidIntervals,
        useBlueNotes: baseStyleRules.useBlueNotes
    };
    const recencyPenaltyMultiplier = userWeights.recencyPenalty;

    // Track recently used pitch classes for recency penalty (within this phrase)
    const recentPitchClasses = [];

    // Build chord timing map: for each chord, calculate which beat range it covers
    // This allows us to map note indices to chords based on their position in time
    let chordTimingMap = null;
    let totalChordBeats = 0; // Track actual total beats from chord sequence
    if (chordSequence && chordSequence.length > 0) {
        chordTimingMap = [];
        let beatOffset = 0;
        for (const entry of chordSequence) {
            // Get duration from multiple possible sources, supporting fractional beats
            const chordDuration = entry.duration || entry.beats || entry.durationBeats ||
                                  (entry.endBeat !== undefined && entry.startBeat !== undefined ?
                                   entry.endBeat - entry.startBeat : 4);
            chordTimingMap.push({
                chord: entry.chord || entry,
                startBeat: beatOffset,
                endBeat: beatOffset + chordDuration,
                duration: chordDuration
            });
            beatOffset += chordDuration;
        }
        totalChordBeats = beatOffset;
    }

    // Use the actual total beats from chord sequence if available, otherwise use effectiveTargetBeats
    const actualTotalBeats = totalChordBeats > 0 ? totalChordBeats : effectiveTargetBeats;

    // Helper to get chord for a specific note index
    // Maps note index to a beat position, then finds which chord covers that beat
    const getChordForNoteIndex = (noteIndex) => {
        if (!chordTimingMap || chordTimingMap.length === 0) {
            return chord; // Fall back to single chord
        }

        // Calculate which beat this note falls on (evenly distributed across actual total beats)
        // Note index 0 = beat 0, note index (noteCount-1) = last beat
        // Use actualTotalBeats to properly map notes across chords of varying durations
        const beatPosition = (noteIndex / Math.max(1, noteCount - 1)) * actualTotalBeats;

        // Find which chord covers this beat position
        for (const timing of chordTimingMap) {
            if (beatPosition >= timing.startBeat && beatPosition < timing.endBeat) {
                return timing.chord;
            }
        }

        // Edge case: if beatPosition equals the total (last note), use the last chord
        if (chordTimingMap.length > 0) {
            return chordTimingMap[chordTimingMap.length - 1].chord;
        }

        return chord; // Ultimate fallback
    };

    // Initial chord tones (for first note)
    const chordTones = getChordTones(chord);

    // Apply section-aware range adjustment
    const sectionRangeMultiplier = sectionProfile?.rangeMultiplier || 1.0;
    const effectiveRange = Math.round(range * sectionRangeMultiplier);

    // Apply section-aware range center preference
    const rangeCenterOffset = sectionProfile?.preferredRangeCenter
        ? Math.round((sectionProfile.preferredRangeCenter - 0.5) * 6) // ±3 semitones max
        : 0;

    // Calculate range bounds with section adjustments
    const baseMidi = 60 + (octave - 4) * 12 + rangeCenterOffset; // C4 = 60, adjusted for section
    const lowBound = baseMidi - Math.floor(effectiveRange / 2);
    const highBound = baseMidi + Math.ceil(effectiveRange / 2);

    let currentNote = previousNote;

    for (let i = 0; i < noteCount; i++) {
        const position = i / (noteCount - 1); // 0 to 1 position in phrase
        const targetHeight = contour.weight(position);

        // Calculate target MIDI based on contour
        const targetMidi = Math.round(lowBound + targetHeight * (highBound - lowBound));

        // Get the chord for THIS note position (may differ from starting chord)
        const noteChord = getChordForNoteIndex(i);
        const noteChordTones = getChordTones(noteChord);

        // styleRules already computed above with user weights applied

        // Get candidates around target, using the note's chord context
        const candidates = getCandidatesAroundTarget(targetMidi, noteChord, key, scaleNotes, noteChordTones, styleId);

        // Look ahead: get next chord if available (for anticipation on last notes of current chord)
        let nextChord = null;
        if (chordTimingMap && chordTimingMap.length > 1) {
            const nextNoteChord = getChordForNoteIndex(i + 1);
            if (nextNoteChord && nextNoteChord.root !== noteChord.root) {
                nextChord = nextNoteChord;
            }
        }

        // Score candidates
        const scoredCandidates = candidates.map(candidate => {
            let score = 100;

            // Get section-aware multipliers (default to 1.0 if no profile)
            const sectionChordToneBonus = sectionProfile?.chordToneBonus || 1.0;
            const sectionStepwiseBonus = sectionProfile?.stepwiseBonus || 1.0;
            const sectionLeapPenalty = sectionProfile?.leapPenalty || 1.0;

            // Distance from target pitch (contour adherence)
            const distanceFromTarget = Math.abs(candidate.midi - targetMidi);
            score -= distanceFromTarget * 3;

            // Chord tone bonus - now using the chord for THIS note position
            // Apply both style-specific and section-specific chordToneBoost
            // INCREASED from 20 to 35 to prioritize chord tones over contour adherence
            const isChordToneOfNoteChord = noteChordTones.includes(candidate.midi % 12);
            if (isChordToneOfNoteChord) {
                score += Math.round(35 * styleRules.chordToneBoost * sectionChordToneBonus);
                // Root and 5th get extra bonus at phrase boundaries
                if (i === 0 || i === noteCount - 1) {
                    const rootPc = getPitchClass(noteChord.root);
                    const notePc = candidate.midi % 12;
                    if (notePc === rootPc) score += 20; // Root (increased)
                    if ((notePc - rootPc + 12) % 12 === 7) score += 15; // 5th (increased)
                }
                // 3rd also gets bonus as it defines chord quality
                const thirdInterval = noteChordTones.length > 1 ? noteChordTones[1] : null;
                if (thirdInterval !== null && candidate.midi % 12 === thirdInterval) {
                    score += 10; // 3rd bonus
                }
            }

            // Scale tone bonus - apply style-specific scaleToneBoost
            if (candidate.isScaleTone) {
                score += Math.round(10 * styleRules.scaleToneBoost);
            }

            // Tension penalty for non-scale, non-chord tones
            if (!candidate.isScaleTone && !isChordToneOfNoteChord) {
                score -= Math.round(15 * styleRules.tensionPenalty);
            }

            // === APPROACH TONE SCORING ===
            // Chromatic approach tones (half-step to chord tone) get a bonus ONLY when:
            // 1. NOT on phrase boundaries (first/last note)
            // 2. NOT on strong beats (first note of a chord)
            // 3. The style supports approach tones
            // Approach tones are passing notes that resolve - they shouldn't land on downbeats
            const candidatePc = candidate.midi % 12;
            let isApproachTone = false;
            let approachToneTargetPc = null;

            // Only consider approach tones for middle notes in the phrase, not boundaries
            const isPhraseBoundary = (i === 0 || i === noteCount - 1);
            // Check if this is likely a strong beat (first note in the chord's duration)
            // We approximate this by checking if we're at the start of the phrase or
            // if we just changed chords
            const isStrongBeat = (i === 0) || (i > 0 && noteChord !== getChordForNoteIndex(i - 1));

            if (!isChordToneOfNoteChord && !isPhraseBoundary && !isStrongBeat) {
                for (const chordTonePc of noteChordTones) {
                    // Check if candidate is a half-step above or below a chord tone
                    if ((candidatePc + 1) % 12 === chordTonePc || (candidatePc + 11) % 12 === chordTonePc) {
                        isApproachTone = true;
                        approachToneTargetPc = chordTonePc;
                        break;
                    }
                }
                if (isApproachTone) {
                    score += Math.round(12 * styleRules.approachToneBoost);
                }
            }

            // === CRITICAL: Penalty for notes that CLASH with chord tones ===
            // These are notes a half-step away from chord tones - they create harsh dissonance
            // This penalty applies ALWAYS for phrase boundaries and strong beats
            // For weak beats, approach tones are exempt (they resolve to chord tones)
            const notePc = candidatePc; // Reuse the already computed value
            let hasClash = false;
            const shouldPenalizeClash = !isApproachTone || isPhraseBoundary || isStrongBeat;
            if (shouldPenalizeClash) {
                for (const chordTonePc of noteChordTones) {
                    const distance = Math.abs(notePc - chordTonePc);
                    // Half-step clash (1 semitone or 11 semitones which is enharmonic)
                    if (distance === 1 || distance === 11) {
                        hasClash = true;
                        // Heavier penalty on phrase boundaries and strong beats
                        const clashPenalty = (isPhraseBoundary || isStrongBeat) ? 45 : 35;
                        score -= clashPenalty;
                        break;
                    }
                }
            }

            // === Penalty for "avoid notes" - the 4th over a major chord ===
            // The natural 4th (5 semitones above root) clashes with the major 3rd
            const rootPc = getPitchClass(noteChord.root);
            if (rootPc !== null) {
                const intervalFromRoot = (notePc - rootPc + 12) % 12;
                // Perfect 4th (5 semitones) over major/dominant chords is an avoid note
                const chordType = (noteChord.type || 'Major').toLowerCase();
                const isMajorType = chordType.includes('major') || chordType === 'dominant 7th' ||
                                   (!chordType.includes('minor') && !chordType.includes('dim') && !chordType.includes('m'));
                if (intervalFromRoot === 5 && isMajorType) {
                    score -= 25; // 4th over major chord - avoid note
                }
                // Tritone (6 semitones) is very dissonant unless it's part of the chord (like in dom7)
                if (intervalFromRoot === 6 && !noteChordTones.includes(notePc)) {
                    score -= 20; // Tritone not in chord
                }
            }

            // === BEAT STRENGTH SCORING ===
            // Estimate where this note will land rhythmically and score accordingly
            // Chord tones on strong beats, passing/approach tones on weak beats
            {
                const tsInfo = sectionContext?.timeSignature || { num: 4, denom: 4 };
                const beatsPerMeasureForStrength = tsInfo.num * (4 / tsInfo.denom);
                const phraseStart = sectionContext?.startBeat || 0;

                // Estimate this note's beat position based on note index
                // Assumes relatively even distribution (actual rhythm generated later)
                const estimatedBeat = phraseStart + (i / Math.max(1, noteCount - 1)) * effectiveTargetBeats;
                const beatStrength = getBeatStrength(estimatedBeat, beatsPerMeasureForStrength);

                // Apply beat-strength-aware scoring
                const beatStrengthModifier = getBeatStrengthScoreModifier(
                    beatStrength,
                    isChordToneOfNoteChord,
                    candidate.isScaleTone,
                    isApproachTone
                );
                score += beatStrengthModifier;
            }

            // Voice leading from previous note
            if (currentNote) {
                const prevMidi = noteToMidi(currentNote);
                if (prevMidi !== null) {
                    const interval = Math.abs(candidate.midi - prevMidi);
                    // Apply both style-specific and section-specific stepwiseBoost
                    if (interval <= 2) score += Math.round(15 * styleRules.stepwiseBoost * sectionStepwiseBonus); // Stepwise
                    else if (interval <= 4) score += 10; // Small leap
                    else if (interval <= 7) score += Math.round(5 / sectionLeapPenalty); // Medium leap - reduced by section penalty
                    else if (interval > 12) score -= Math.round(10 * sectionLeapPenalty); // Large leap penalty - amplified by section

                    // Apply preferred/avoided intervals
                    if (styleRules.preferredIntervals && styleRules.preferredIntervals.includes(interval)) {
                        score += 5;
                    }
                    if (styleRules.avoidIntervals && styleRules.avoidIntervals.includes(interval)) {
                        score -= 8;
                    }
                }
            }

            // Anticipation: if next chord is different, bonus for notes that lead into it
            if (nextChord) {
                const nextChordTones = getChordTones(nextChord);
                const notePc = candidate.midi % 12;
                const nextRootPc = getPitchClass(nextChord.root);

                // Bonus for chord tones of next chord (anticipation)
                if (nextChordTones.includes(notePc)) {
                    score += 12; // Anticipates next chord
                }
                // Leading tone bonus (half-step below next root)
                if ((notePc + 1) % 12 === nextRootPc) {
                    score += 15; // Strong leading tone
                }
                // Common tone bonus (in both current and next chord)
                if (isChordToneOfNoteChord && nextChordTones.includes(notePc)) {
                    score += 8; // Common tone - smooth transition
                }
            }

            // Phrase position considerations
            if (i === 0) {
                // First note - prefer chord tones
                if (isChordToneOfNoteChord) score += 10;
            }
            if (i === noteCount - 1) {
                // Last note - section-aware ending preference
                const finalChord = getChordForNoteIndex(noteCount - 1);
                const rootPc = getPitchClass(finalChord.root);
                const notePc = candidate.midi % 12;
                const endingPref = sectionProfile?.endingPreference || 'strong';

                if (endingPref === 'resolved' || endingPref === 'strong') {
                    // Strong resolution - strongly prefer root, then 5th
                    if (notePc === rootPc) score += 25;
                    else if ((notePc - rootPc + 12) % 12 === 7) score += 15; // 5th
                    else if (isChordToneOfNoteChord) score += 8; // Other chord tones
                } else if (endingPref === 'open') {
                    // Open ending - any chord tone is fine, slight root preference
                    if (notePc === rootPc) score += 12;
                    else if (isChordToneOfNoteChord) score += 10;
                } else if (endingPref === 'tension') {
                    // Tension ending - prefer non-root chord tones or scale tones
                    if (notePc === rootPc) score += 5; // Slight root preference still
                    else if ((notePc - rootPc + 12) % 12 === 7) score += 12; // 5th creates mild tension
                    else if (isChordToneOfNoteChord) score += 15; // 3rd or 7th = good tension
                    else if (candidate.isScaleTone) score += 8; // Scale tone tension
                }
            }

            // === MOOD-BASED SCORING ===
            // Apply mood rules (bright, dark, jazzy, tense, calm, energetic)
            // This was previously missing - mood selection had no effect on phrase generation!
            const prevMidi = currentNote ? noteToMidi(currentNote) : null;
            const moodBonus = scoreMoodForPhrase(
                candidate.midi,
                candidate.midi % 12,
                noteChord,
                noteChordTones,
                prevMidi,
                mood
            );
            score += moodBonus;

            // === RECENCY PENALTY ===
            // Penalize notes that have been used recently in this phrase
            // This matches the behavior in melodySuggestion.js for consistency
            if (recentPitchClasses.length > 0) {
                const candidatePc = candidate.midi % 12;

                // Count occurrences and find most recent position
                let occurrenceCount = 0;
                let mostRecentPosition = -1;

                recentPitchClasses.forEach((recentPc, idx) => {
                    if (recentPc === candidatePc) {
                        occurrenceCount++;
                        // idx 0 is oldest, so most recent is highest idx
                        if (mostRecentPosition === -1 || idx > mostRecentPosition) {
                            mostRecentPosition = idx;
                        }
                    }
                });

                if (occurrenceCount > 0) {
                    // Penalty increases with frequency
                    const frequencyPenalty = occurrenceCount * 8; // -8 points per occurrence

                    // Penalty increases with recency (higher position = more recent)
                    // Max penalty 15 for most recent, decreasing for older notes
                    const recencyFromEnd = recentPitchClasses.length - 1 - mostRecentPosition;
                    const recencyPenalty = recencyFromEnd < 5
                        ? (5 - recencyFromEnd) * 3
                        : 0;

                    // Apply user's recency penalty multiplier
                    const totalPenalty = (frequencyPenalty + recencyPenalty) * recencyPenaltyMultiplier;
                    score -= totalPenalty;
                }
            }

            return { ...candidate, score, landingChord: noteChord };
        });

        // Sort by score and select best
        scoredCandidates.sort((a, b) => b.score - a.score);

        // Add some randomness for variety (weighted random from top candidates)
        const topCandidates = scoredCandidates.slice(0, Math.min(5, scoredCandidates.length));
        const selected = weightedRandomSelect(topCandidates);

        notes.push(selected.note);
        noteDetails.push({
            note: selected.note,
            midi: selected.midi,
            score: selected.score,
            isChordTone: selected.isChordTone,
            isScaleTone: selected.isScaleTone,
            contourPosition: position,
            targetMidi: targetMidi,
            // Chord context for this note
            landingChord: selected.landingChord || noteChord,
            isChordToneOfLandingChord: noteChordTones.includes(selected.midi % 12)
        });

        currentNote = selected.note;

        // Track this pitch class for recency penalty on future notes
        // Keep only last 8 pitch classes to match melodySuggestion.js behavior
        recentPitchClasses.push(selected.midi % 12);
        if (recentPitchClasses.length > 8) {
            recentPitchClasses.shift();
        }
    }

    // ==========================================================================
    // RHYTHM GENERATION - Use rhythm patterns with standard note durations
    // ==========================================================================

    // Full set of standard durations (includes dotted values)
    const allStandardDurations = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];

    // Simple durations for "steady" rhythm - no dotted values for even feel
    const simpleDurations = [4, 2, 1, 0.5, 0.25];

    // Use simple durations for steady rhythm, full set for others
    const standardDurations = rhythmId === 'steady' ? simpleDurations : allStandardDurations;

    // Helper to snap a value to the nearest standard duration
    const snapToStandard = (value) => {
        let closest = 0.5;
        let minDiff = Infinity;
        for (const std of standardDurations) {
            const diff = Math.abs(value - std);
            if (diff < minDiff) {
                minDiff = diff;
                closest = std;
            }
        }
        return closest;
    };

    // Get the raw rhythm pattern (relative values like [2, 1, 2, 1] for longShort)
    let rawPattern = rhythmPattern.getPattern(noteCount);

    // Calculate the sum of raw pattern values
    const rawSum = rawPattern.reduce((sum, r) => sum + r, 0);

    // Scale factor to make pattern fit target beats
    const scaleFactor = effectiveTargetBeats / rawSum;

    // Convert raw pattern to actual beat durations, snapping to standard values
    let rhythm = rawPattern.map(r => {
        const scaled = r * scaleFactor;
        return snapToStandard(scaled);
    });

    // Calculate total after snapping
    let totalBeats = rhythm.reduce((sum, r) => sum + r, 0);

    // Adjust to match target exactly by modifying the last note
    if (Math.abs(totalBeats - effectiveTargetBeats) > 0.01) {
        const lastIdx = rhythm.length - 1;
        const currentLast = rhythm[lastIdx];
        const needed = currentLast + (effectiveTargetBeats - totalBeats);

        // Find best standard duration for the last note
        let bestLast = currentLast;
        let bestDiff = Math.abs(effectiveTargetBeats - totalBeats);

        for (const std of standardDurations) {
            const wouldTotal = totalBeats - currentLast + std;
            const diff = Math.abs(wouldTotal - effectiveTargetBeats);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestLast = std;
            }
        }
        rhythm[lastIdx] = bestLast;
        totalBeats = rhythm.reduce((sum, r) => sum + r, 0);
    }

    // If still not exact, try adjusting second-to-last note too
    if (Math.abs(totalBeats - effectiveTargetBeats) > 0.01 && rhythm.length >= 2) {
        const lastIdx = rhythm.length - 1;
        const secondLastIdx = rhythm.length - 2;

        for (const std1 of standardDurations) {
            for (const std2 of standardDurations) {
                const wouldTotal = totalBeats - rhythm[lastIdx] - rhythm[secondLastIdx] + std1 + std2;
                if (Math.abs(wouldTotal - effectiveTargetBeats) < 0.01) {
                    rhythm[secondLastIdx] = std1;
                    rhythm[lastIdx] = std2;
                    totalBeats = wouldTotal;
                    break;
                }
            }
            if (Math.abs(totalBeats - effectiveTargetBeats) < 0.01) break;
        }
    }

    // Final safety: ensure we hit the target beats exactly
    // First, if we're over, pop notes until we're at or under target
    while (totalBeats > effectiveTargetBeats + 0.01 && rhythm.length > 1) {
        rhythm.pop();
        notes.pop();
        noteDetails.pop();
        totalBeats = rhythm.reduce((sum, r) => sum + r, 0);
    }

    // If under, extend the last note to exactly fill the target
    if (totalBeats < effectiveTargetBeats - 0.01 && rhythm.length > 0) {
        const deficit = effectiveTargetBeats - totalBeats;
        const lastIdx = rhythm.length - 1;
        const needed = rhythm[lastIdx] + deficit;

        // First try to find an exact standard duration
        let found = false;
        for (const std of standardDurations) {
            if (Math.abs(std - needed) < 0.01 && std <= 4) {
                rhythm[lastIdx] = std;
                found = true;
                break;
            }
        }

        // If no exact match, use the exact needed value (even if non-standard)
        // This ensures we hit the target beats precisely
        if (!found && needed > 0 && needed <= 4) {
            rhythm[lastIdx] = needed;
        }

        totalBeats = rhythm.reduce((sum, r) => sum + r, 0);
    }

    // If still over (by a small amount), adjust last note down
    if (totalBeats > effectiveTargetBeats + 0.01 && rhythm.length > 0) {
        const excess = totalBeats - effectiveTargetBeats;
        const lastIdx = rhythm.length - 1;
        const adjusted = rhythm[lastIdx] - excess;
        if (adjusted >= 0.25) {  // Don't go below 16th note
            rhythm[lastIdx] = adjusted;
            totalBeats = rhythm.reduce((sum, r) => sum + r, 0);
        }
    }

    // ==========================================================================
    // MEASURE-BOUNDARY AWARENESS - Prevent tiny tied note fragments
    // ==========================================================================
    // When notes cross measure boundaries, they get split with ties.
    // A note ending at beat 4.125 creates a tied 16th note at the start of the
    // next measure, which sounds unnatural. This adjusts rhythms to avoid that.

    const timeSignature = sectionContext?.timeSignature || { num: 4, denom: 4 };
    const beatsPerMeasure = timeSignature.num * (4 / timeSignature.denom);
    const MIN_TIE_FRAGMENT = 0.5; // Don't create ties smaller than 8th note

    // Calculate where this phrase starts (default to beat 0 if unknown)
    const phraseStartBeat = sectionContext?.startBeat || 0;

    // Walk through the rhythm and adjust notes that would create tiny tie fragments
    let currentBeat = phraseStartBeat;
    for (let i = 0; i < rhythm.length; i++) {
        const noteDuration = rhythm[i];
        const noteEndBeat = currentBeat + noteDuration;

        // Find the next measure boundary after the note starts
        const measureNumber = Math.floor(currentBeat / beatsPerMeasure);
        const nextMeasureBoundary = (measureNumber + 1) * beatsPerMeasure;

        // Check if this note crosses the measure boundary
        if (noteEndBeat > nextMeasureBoundary && currentBeat < nextMeasureBoundary) {
            const distanceToBarline = nextMeasureBoundary - currentBeat;
            const overhang = noteEndBeat - nextMeasureBoundary;

            // Case 1: The overhang is tiny (would create a small tied fragment)
            if (overhang > 0 && overhang < MIN_TIE_FRAGMENT) {
                // Try to extend to fill the next measure fragment
                // But only if the extension is reasonable (not doubling the note)
                if (overhang < noteDuration * 0.5) {
                    // Find next standard duration that fills to barline or slightly past
                    const targetDuration = distanceToBarline;
                    let bestDuration = noteDuration;
                    let bestDiff = overhang;

                    for (const std of standardDurations) {
                        if (std >= distanceToBarline - 0.01 && std <= distanceToBarline + 0.01) {
                            // Perfect: ends exactly at barline
                            bestDuration = std;
                            bestDiff = 0;
                            break;
                        }
                        // Or find one that ends at a reasonable point past the barline
                        const wouldOverhang = (currentBeat + std) - nextMeasureBoundary;
                        if (wouldOverhang >= MIN_TIE_FRAGMENT && wouldOverhang < bestDiff) {
                            bestDuration = std;
                            bestDiff = wouldOverhang;
                        }
                    }

                    if (bestDiff < overhang) {
                        rhythm[i] = bestDuration;
                    }
                }
            }

            // Case 2: The part before barline is tiny (note barely starts before barline)
            if (distanceToBarline > 0 && distanceToBarline < MIN_TIE_FRAGMENT) {
                // Try to shrink the note to end before barline, or extend to start at barline
                // Shrink is usually better musically
                const targetDuration = noteDuration - distanceToBarline;
                if (targetDuration >= 0.25) {
                    // Find standard duration close to target
                    let bestDuration = noteDuration;
                    let bestDiff = Infinity;

                    for (const std of standardDurations) {
                        const diff = Math.abs(std - targetDuration);
                        if (diff < bestDiff && std >= 0.25) {
                            bestDuration = std;
                            bestDiff = diff;
                        }
                    }

                    // Shift this note to start at the barline instead
                    // This means we need to extend the previous note or add a rest
                    if (i > 0 && distanceToBarline < 0.5) {
                        // Extend previous note to fill the gap
                        rhythm[i - 1] += distanceToBarline;
                        rhythm[i] = bestDuration;
                    }
                }
            }
        }

        currentBeat += rhythm[i];
    }

    // Recalculate total after adjustments
    totalBeats = rhythm.reduce((sum, r) => sum + r, 0);

    // Final cleanup: ensure we still hit target beats after boundary adjustments
    if (Math.abs(totalBeats - effectiveTargetBeats) > 0.1) {
        // Adjust last note to compensate
        const diff = effectiveTargetBeats - totalBeats;
        const lastIdx = rhythm.length - 1;
        const newLast = rhythm[lastIdx] + diff;
        if (newLast >= 0.25 && newLast <= 4) {
            rhythm[lastIdx] = newLast;
        }
    }

    // ==========================================================================
    // RHYTHMIC VARIATION - Apply human-like imperfection if requested
    // ==========================================================================
    if (rhythmicVariation && rhythmicVariation !== 'none') {
        // Use contextual variation which considers note details for smarter variations
        const variedRhythm = applyContextualVariation(rhythm, noteDetails, rhythmicVariation, standardDurations);

        // Copy varied rhythm back (in place to preserve reference)
        for (let i = 0; i < rhythm.length; i++) {
            rhythm[i] = variedRhythm[i];
        }

        // Recalculate total after variation
        totalBeats = rhythm.reduce((sum, r) => sum + r, 0);

        // Adjust last note to hit target if we drifted too much
        if (Math.abs(totalBeats - effectiveTargetBeats) > 0.1) {
            const diff = effectiveTargetBeats - totalBeats;
            const lastIdx = rhythm.length - 1;
            const newLast = rhythm[lastIdx] + diff;
            if (newLast >= 0.25 && newLast <= 4) {
                rhythm[lastIdx] = newLast;
            }
        }
    }

    // Calculate overall phrase score
    const phraseScore = calculatePhraseScore(noteDetails, contour, chord, key);

    // Build unique chords used in this phrase
    const chordsUsed = chordSequence
        ? [...new Set(chordSequence.map(e => `${e.chord.root} ${e.chord.type}`))]
        : [`${chord.root} ${chord.type}`];

    return {
        notes,
        noteDetails,
        rhythm,
        contour: contourId,
        length: lengthId,
        rhythmPattern: rhythmId,
        rhythmicVariation, // Include variation mode used
        phraseScore,
        chordsUsed,
        noteCount,
        densityMultiplier,
        targetBeats: effectiveTargetBeats, // Include for reference
        context: {
            chord,
            key,
            styleId,
            mood, // Include mood in context for reference
            octave,
            range,
            densityMultiplier,
            rhythmicVariation,
            chordSequence: chordSequence || null
        }
    };
}

/**
 * Get candidate notes around a target MIDI pitch
 */
function getCandidatesAroundTarget(targetMidi, chord, key, scaleNotes, chordTones, styleId) {
    const candidates = [];
    const searchRange = 6; // +/- 6 semitones from target

    for (let midi = targetMidi - searchRange; midi <= targetMidi + searchRange; midi++) {
        const pitchClass = midi % 12;
        const octave = Math.floor(midi / 12) - 1;
        const spelledPitch = getSpelledNoteName(pitchClass, key);
        const noteName = spelledPitch + octave;

        candidates.push({
            note: noteName,
            midi: midi,
            pitchClass: pitchClass,
            isChordTone: chordTones.includes(pitchClass),
            isScaleTone: scaleNotes.includes(pitchClass)
        });
    }

    return candidates;
}

/**
 * Weighted random selection from scored candidates
 */
function weightedRandomSelect(candidates) {
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // Convert scores to weights (higher score = higher weight)
    const minScore = Math.min(...candidates.map(c => c.score));
    const weights = candidates.map(c => Math.max(1, c.score - minScore + 10));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    let random = Math.random() * totalWeight;
    for (let i = 0; i < candidates.length; i++) {
        random -= weights[i];
        if (random <= 0) return candidates[i];
    }

    return candidates[0];
}

/**
 * Calculate overall phrase score
 */
function calculatePhraseScore(noteDetails, contour, chord, key) {
    let score = 0;
    let maxScore = 0;

    // Note-by-note quality (40% of total)
    const noteScores = noteDetails.map(n => n.score);
    const avgNoteScore = noteScores.reduce((a, b) => a + b, 0) / noteScores.length;
    score += avgNoteScore * 0.4;
    maxScore += 100 * 0.4;

    // Contour adherence (25% of total)
    let contourError = 0;
    for (const detail of noteDetails) {
        contourError += Math.abs(detail.midi - detail.targetMidi);
    }
    const avgContourError = contourError / noteDetails.length;
    const contourScore = Math.max(0, 100 - avgContourError * 5);
    score += contourScore * 0.25;
    maxScore += 100 * 0.25;

    // Voice leading smoothness (20% of total)
    let voiceLeadingScore = 100;
    for (let i = 1; i < noteDetails.length; i++) {
        const interval = Math.abs(noteDetails[i].midi - noteDetails[i - 1].midi);
        if (interval > 12) voiceLeadingScore -= 15; // Large leap penalty
        else if (interval > 7) voiceLeadingScore -= 5; // Medium leap small penalty
    }
    score += Math.max(0, voiceLeadingScore) * 0.2;
    maxScore += 100 * 0.2;

    // Phrase boundary quality (15% of total)
    let boundaryScore = 0;
    const firstNote = noteDetails[0];
    const lastNote = noteDetails[noteDetails.length - 1];
    if (firstNote.isChordTone) boundaryScore += 50;
    if (lastNote.isChordTone) boundaryScore += 50;
    score += boundaryScore * 0.15;
    maxScore += 100 * 0.15;

    return Math.round((score / maxScore) * 100);
}

// -----------------------------------------------------------------------------
// Multiple Phrase Candidate Generation
// -----------------------------------------------------------------------------

/**
 * Generate multiple phrase candidates for user selection
 *
 * @param {Object} options - Same options as generatePhrase
 * @param {number} count - Number of candidates to generate (default 5)
 * @returns {Array} Array of phrase candidates sorted by score
 */
export function generatePhraseCandidates(options, count = 5) {
    const candidates = [];

    // Generate ALL candidates with the requested contour
    // Variety comes from inherent randomness in note selection within the contour shape
    for (let i = 0; i < count; i++) {
        candidates.push(generatePhrase(options));
    }

    // Sort by score (highest first)
    candidates.sort((a, b) => b.phraseScore - a.phraseScore);

    // Normalize phraseScore to 0-100% range (min-max normalization)
    const rawScores = candidates.map(c => c.phraseScore);
    const minScore = Math.min(...rawScores);
    const maxScore = Math.max(...rawScores);
    const scoreRange = maxScore - minScore;

    // Normalize scores: highest = 100%, lowest = 10% (to show they still have value)
    candidates.forEach(c => {
        if (scoreRange > 0) {
            const normalized = ((c.phraseScore - minScore) / scoreRange) * 90 + 10;
            c.phraseScore = Math.round(normalized);
        } else {
            c.phraseScore = 75;
        }
    });

    // Add rank to each candidate
    candidates.forEach((c, i) => {
        c.rank = i + 1;
    });

    return candidates;
}

/**
 * Get complementary contours for variety in candidate generation
 */
function getComplementaryContours(primaryContour) {
    const complementMap = {
        ascending: ['arch', 'ramp'],
        descending: ['invertedArch', 'cascade'],
        arch: ['ascending', 'plateau'],
        invertedArch: ['descending', 'wave'],
        wave: ['arch', 'invertedArch'],
        plateau: ['arch', 'ramp'],
        ramp: ['ascending', 'arch'],
        cascade: ['descending', 'invertedArch'],
        static: ['wave', 'arch'],
        question: ['ascending', 'arch'],
        answer: ['descending', 'arch']
    };

    return complementMap[primaryContour] || ['arch', 'wave'];
}

// -----------------------------------------------------------------------------
// Phrase Variation Functions
// -----------------------------------------------------------------------------

/**
 * Create a variation of an existing phrase
 *
 * @param {Object} phrase - Original phrase
 * @param {string} variationType - Type of variation
 * @returns {Object} Varied phrase
 */
export function createPhraseVariation(phrase, variationType = 'embellish') {
    const { notes, noteDetails, rhythm, context } = phrase;
    const newNotes = [...notes];
    const newRhythm = [...rhythm];

    switch (variationType) {
        case 'transpose':
            // Transpose by random interval (2nd, 3rd, 4th, or 5th)
            const intervals = [2, 3, 4, 5, 7];
            const transposeInterval = intervals[Math.floor(Math.random() * intervals.length)];
            const direction = Math.random() > 0.5 ? 1 : -1;
            for (let i = 0; i < newNotes.length; i++) {
                const midi = noteToMidi(newNotes[i]);
                if (midi !== null) {
                    newNotes[i] = midiToNote(midi + transposeInterval * direction);
                }
            }
            break;

        case 'invert':
            // Melodic inversion around the first note
            const pivotMidi = noteToMidi(newNotes[0]);
            if (pivotMidi !== null) {
                for (let i = 1; i < newNotes.length; i++) {
                    const midi = noteToMidi(newNotes[i]);
                    if (midi !== null) {
                        const interval = midi - pivotMidi;
                        newNotes[i] = midiToNote(pivotMidi - interval);
                    }
                }
            }
            break;

        case 'retrograde':
            // Reverse the note order
            newNotes.reverse();
            break;

        case 'augment':
            // Double the rhythm values (slower)
            for (let i = 0; i < newRhythm.length; i++) {
                newRhythm[i] = newRhythm[i] * 2;
            }
            break;

        case 'diminish':
            // Halve the rhythm values (faster)
            for (let i = 0; i < newRhythm.length; i++) {
                newRhythm[i] = Math.max(0.5, newRhythm[i] / 2);
            }
            break;

        case 'embellish':
            // Add passing tones between some notes
            const embellishedNotes = [];
            const embellishedRhythm = [];
            for (let i = 0; i < newNotes.length; i++) {
                embellishedNotes.push(newNotes[i]);
                embellishedRhythm.push(newRhythm[i] / 2);

                // 30% chance to add passing tone
                if (i < newNotes.length - 1 && Math.random() < 0.3) {
                    const currentMidi = noteToMidi(newNotes[i]);
                    const nextMidi = noteToMidi(newNotes[i + 1]);
                    if (currentMidi !== null && nextMidi !== null) {
                        const midMidi = Math.round((currentMidi + nextMidi) / 2);
                        if (midMidi !== currentMidi && midMidi !== nextMidi) {
                            embellishedNotes.push(midiToNote(midMidi));
                            embellishedRhythm.push(0.5);
                        }
                    }
                }
            }
            return {
                ...phrase,
                notes: embellishedNotes,
                rhythm: embellishedRhythm,
                variationType: 'embellish'
            };

        case 'simplify':
            // Remove some notes (keep chord tones)
            const simplifiedNotes = [];
            const simplifiedRhythm = [];
            for (let i = 0; i < newNotes.length; i++) {
                const detail = noteDetails[i];
                // Keep chord tones and every other scale tone
                if (detail.isChordTone || (detail.isScaleTone && i % 2 === 0)) {
                    simplifiedNotes.push(newNotes[i]);
                    simplifiedRhythm.push(newRhythm[i] * 1.5);
                }
            }
            return {
                ...phrase,
                notes: simplifiedNotes,
                rhythm: simplifiedRhythm,
                variationType: 'simplify'
            };
    }

    return {
        ...phrase,
        notes: newNotes,
        rhythm: newRhythm,
        variationType
    };
}

// -----------------------------------------------------------------------------
// Rhythmic Motif Development - Extract, develop, and reuse rhythmic patterns
// -----------------------------------------------------------------------------

/**
 * Extract a rhythmic motif from a phrase
 * A motif is a short, memorable rhythmic pattern (typically 2-4 notes)
 * @param {Array<number>} rhythm - Full rhythm array
 * @param {number} startIndex - Starting index for motif extraction
 * @param {number} length - Number of notes in motif (default 3)
 * @returns {Object} Motif object with pattern and metadata
 */
export function extractRhythmicMotif(rhythm, startIndex = 0, length = 3) {
    const actualLength = Math.min(length, rhythm.length - startIndex);
    const pattern = rhythm.slice(startIndex, startIndex + actualLength);

    // Calculate relative pattern (normalized to first note)
    const baseValue = pattern[0] || 1;
    const relativePattern = pattern.map(d => d / baseValue);

    // Calculate total duration
    const totalDuration = pattern.reduce((sum, d) => sum + d, 0);

    return {
        pattern,
        relativePattern,
        length: actualLength,
        totalDuration,
        startIndex
    };
}

/**
 * Develop variations of a rhythmic motif
 * @param {Object} motif - Original motif from extractRhythmicMotif
 * @param {string} developmentType - Type of development
 * @returns {Object} Developed motif
 */
export function developMotif(motif, developmentType = 'augment') {
    const { pattern, relativePattern } = motif;

    switch (developmentType) {
        case 'augment':
            // Double all values (slower version)
            return {
                ...motif,
                pattern: pattern.map(d => d * 2),
                developmentType
            };

        case 'diminish':
            // Halve all values (faster version, minimum 0.25)
            return {
                ...motif,
                pattern: pattern.map(d => Math.max(0.25, d / 2)),
                developmentType
            };

        case 'retrograde':
            // Reverse the pattern
            return {
                ...motif,
                pattern: [...pattern].reverse(),
                developmentType
            };

        case 'extend':
            // Add repetition of last note
            return {
                ...motif,
                pattern: [...pattern, pattern[pattern.length - 1]],
                developmentType
            };

        case 'truncate':
            // Remove last note
            return {
                ...motif,
                pattern: pattern.slice(0, -1),
                developmentType
            };

        case 'syncopate':
            // Shift emphasis by adding short note at start
            return {
                ...motif,
                pattern: [0.25, ...pattern.map(d => Math.max(0.25, d - 0.0625))],
                developmentType
            };

        case 'stretch':
            // Add slight extensions to create rubato feel
            return {
                ...motif,
                pattern: pattern.map((d, i) =>
                    i === pattern.length - 1 ? d * 1.5 : d
                ),
                developmentType
            };

        case 'compress':
            // Shorten all but the last note
            return {
                ...motif,
                pattern: pattern.map((d, i) =>
                    i === pattern.length - 1 ? d : d * 0.75
                ),
                developmentType
            };

        default:
            return motif;
    }
}

/**
 * Apply a rhythmic motif to a phrase, replacing or augmenting its rhythm
 * @param {Object} phrase - Original phrase
 * @param {Object} motif - Motif to apply
 * @param {string} applicationMode - 'replace' | 'repeat' | 'interleave'
 * @returns {Object} Phrase with motif applied
 */
export function applyMotifToPhrase(phrase, motif, applicationMode = 'repeat') {
    const { pattern } = motif;
    const originalRhythm = phrase.rhythm;
    let newRhythm;

    switch (applicationMode) {
        case 'replace':
            // Replace entire rhythm with motif (repeated to fill)
            newRhythm = [];
            let totalDuration = 0;
            const targetDuration = originalRhythm.reduce((sum, d) => sum + d, 0);
            while (totalDuration < targetDuration && newRhythm.length < originalRhythm.length) {
                for (const d of pattern) {
                    if (newRhythm.length >= originalRhythm.length) break;
                    newRhythm.push(d);
                    totalDuration += d;
                }
            }
            break;

        case 'repeat':
            // Repeat the motif for each group of notes
            newRhythm = [];
            for (let i = 0; i < originalRhythm.length; i++) {
                newRhythm.push(pattern[i % pattern.length]);
            }
            break;

        case 'interleave':
            // Alternate between original rhythm and motif
            newRhythm = originalRhythm.map((d, i) =>
                i % 2 === 0 ? d : pattern[i % pattern.length]
            );
            break;

        default:
            newRhythm = originalRhythm;
    }

    return {
        ...phrase,
        rhythm: newRhythm,
        appliedMotif: motif,
        motifApplicationMode: applicationMode
    };
}

/**
 * Generate a phrase that develops a motif from a previous phrase
 * This creates thematic unity between phrases
 * @param {Object} options - Standard generatePhrase options
 * @param {Object} sourcePhrase - Previous phrase to extract motif from
 * @param {string} motifDevelopment - How to develop the motif
 * @returns {Object} New phrase with developed motif
 */
export function generatePhraseWithMotifDevelopment(options, sourcePhrase, motifDevelopment = 'augment') {
    // Extract the most prominent rhythmic motif from source
    const sourceMotif = extractRhythmicMotif(sourcePhrase.rhythm, 0, 3);

    // Develop the motif
    const developedMotif = developMotif(sourceMotif, motifDevelopment);

    // Generate a new phrase
    const newPhrase = generatePhrase(options);

    // Apply the developed motif to create thematic connection
    return applyMotifToPhrase(newPhrase, developedMotif, 'repeat');
}

/**
 * Analyze rhythmic similarity between two phrases
 * Useful for ensuring variety or thematic unity
 * @param {Object} phrase1 - First phrase
 * @param {Object} phrase2 - Second phrase
 * @returns {Object} Similarity analysis
 */
export function analyzeRhythmicSimilarity(phrase1, phrase2) {
    const r1 = phrase1.rhythm;
    const r2 = phrase2.rhythm;

    // Normalize to same length for comparison
    const minLen = Math.min(r1.length, r2.length);

    // Calculate average difference in durations
    let totalDiff = 0;
    for (let i = 0; i < minLen; i++) {
        totalDiff += Math.abs(r1[i] - r2[i]);
    }
    const avgDifference = totalDiff / minLen;

    // Calculate pattern correlation
    // High correlation = similar patterns
    const normalize = arr => {
        const sum = arr.reduce((a, b) => a + b, 0);
        return arr.map(v => v / sum);
    };

    const norm1 = normalize(r1.slice(0, minLen));
    const norm2 = normalize(r2.slice(0, minLen));

    let correlation = 0;
    for (let i = 0; i < minLen; i++) {
        correlation += norm1[i] * norm2[i];
    }

    return {
        averageDifference: avgDifference,
        correlation: correlation,
        similarityScore: Math.max(0, 100 - avgDifference * 20), // 0-100 scale
        isHighlySimilar: correlation > 0.8,
        isDissimilar: correlation < 0.3
    };
}

// -----------------------------------------------------------------------------
// Export contour shape list for UI
// -----------------------------------------------------------------------------

export const CONTOUR_SHAPE_LIST = Object.values(CONTOUR_SHAPES).map(c => ({
    id: c.id,
    label: c.label,
    description: c.description
}));

export const PHRASE_LENGTH_LIST = Object.entries(PHRASE_LENGTHS).map(([id, data]) => ({
    id,
    label: data.label,
    notes: data.notes,
    beats: data.beats
}));

export const RHYTHM_PATTERN_LIST = Object.values(RHYTHM_PATTERNS).map(r => ({
    id: r.id,
    label: r.label,
    description: r.description
}));

export const RHYTHMIC_VARIATION_LIST = Object.values(RHYTHMIC_VARIATION_MODES).map(v => ({
    id: v.id,
    label: v.label,
    description: v.description,
    variationRange: v.variationRange
}));

export const MOTIF_DEVELOPMENT_TYPES = [
    { id: 'augment', label: 'Augmentation', description: 'Slow down the motif (double durations)' },
    { id: 'diminish', label: 'Diminution', description: 'Speed up the motif (halve durations)' },
    { id: 'retrograde', label: 'Retrograde', description: 'Reverse the rhythmic pattern' },
    { id: 'extend', label: 'Extension', description: 'Add a note to lengthen the motif' },
    { id: 'truncate', label: 'Truncation', description: 'Remove a note to shorten the motif' },
    { id: 'syncopate', label: 'Syncopation', description: 'Add off-beat emphasis' },
    { id: 'stretch', label: 'Stretch', description: 'Lengthen the final note for emphasis' },
    { id: 'compress', label: 'Compression', description: 'Shorten notes to create urgency' }
];
