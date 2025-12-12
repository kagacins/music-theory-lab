/**
 * Melody Suggestion Engine
 * Provides context-aware melody note suggestions based on chord, key, and style
 */

import { getSavedMelodyWeights } from '../config/weightPresets.js';
import { getEnharmonicPreferenceForKey } from '../utils/noteUtils.js';

// -----------------------------------------------------------------------------
// Public preset metadata
// -----------------------------------------------------------------------------

export const MELODY_STYLE_PRESETS = [
    { id: 'any', label: 'Balanced', description: 'General-purpose melody with mix of chord tones and passing notes.' },
    { id: 'pop', label: 'Pop / Top 40', description: 'Emphasis on chord tones and singable intervals.' },
    { id: 'jazz', label: 'Jazz', description: 'More approach tones, chromatic passing, and tensions.' },
    { id: 'classical', label: 'Classical', description: 'Strong voice leading with stepwise motion preferred.' },
    { id: 'rock', label: 'Rock / Blues', description: 'Pentatonic focus with blue notes and power.' }
];

export const MELODY_CONTOUR_PRESETS = [
    { id: 'any', label: 'Free', description: 'No contour preference - all directions equally weighted.' },
    { id: 'ascending', label: 'Ascending', description: 'Favor upward melodic motion.' },
    { id: 'descending', label: 'Descending', description: 'Favor downward melodic motion.' },
    { id: 'arch', label: 'Arch', description: 'Rise then fall pattern.' },
    { id: 'stepwise', label: 'Stepwise', description: 'Strongly prefer stepwise motion over leaps.' }
];

// -----------------------------------------------------------------------------
// Note categories and base scores (from roadmap specification)
// -----------------------------------------------------------------------------

const NOTE_CATEGORIES = {
    chordTone: {
        baseScore: 95,
        label: 'Chord Tone',
        description: 'Strong and stable - part of the current chord'
    },
    scaleTone: {
        baseScore: 70,
        label: 'Scale Tone',
        description: 'In the key - safe melodic choice'
    },
    stepwiseMotion: {
        baseScore: 85,
        label: 'Stepwise',
        description: 'Smooth motion from previous note'
    },
    approachTone: {
        baseScore: 75,
        label: 'Approach',
        description: 'Chromatic approach to chord tone'
    },
    passingTone: {
        baseScore: 65,
        label: 'Passing',
        description: 'Creates melodic movement between chord tones'
    },
    tension: {
        baseScore: 55,
        label: 'Tension',
        description: 'Adds color - resolve carefully'
    },
    avoid: {
        baseScore: 25,
        label: 'Avoid',
        description: 'Clashes with chord - use sparingly'
    }
};

// -----------------------------------------------------------------------------
// Scale and interval definitions
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

/**
 * Convert note name to MIDI number for pitch distance calculations
 * @param {string} noteName - Note name like 'C4', 'F#5', 'Bb3'
 * @returns {number} MIDI number (C4 = 60)
 */
function getMIDINumber(noteName) {
    const match = noteName.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return 60; // Default to middle C if invalid

    const pitchClass = match[1];
    const octaveNum = parseInt(match[2]);

    // Find pitch class index (normalize sharps/flats)
    let pitchIndex = CHROMATIC_NOTES.indexOf(pitchClass);
    if (pitchIndex === -1) {
        pitchIndex = FLAT_NOTES.indexOf(pitchClass);
    }
    if (pitchIndex === -1) return 60; // Default if not found

    // MIDI number = (octave + 1) * 12 + pitch class
    // C4 = 60, so octave 4 starts at 48
    return (octaveNum + 1) * 12 + pitchIndex;
}

const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
    melodicMinor: [0, 2, 3, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    pentatonicMajor: [0, 2, 4, 7, 9],
    pentatonicMinor: [0, 3, 5, 7, 10],
    blues: [0, 3, 5, 6, 7, 10]
};

const CHORD_INTERVALS = {
    'Major': [0, 4, 7],
    'Minor': [0, 3, 7],
    'Diminished': [0, 3, 6],
    'Augmented': [0, 4, 8],
    'Dominant 7th': [0, 4, 7, 10],
    'Major 7th': [0, 4, 7, 11],
    'Minor 7th': [0, 3, 7, 10],
    'Half-Diminished 7th': [0, 3, 6, 10],
    'Diminished 7th': [0, 3, 6, 9],
    'Minor-Major 7th': [0, 3, 7, 11],
    'Augmented 7th': [0, 4, 8, 10],
    'Sus2': [0, 2, 7],
    'Sus4': [0, 5, 7],
    'Add9': [0, 2, 4, 7],
    'Major 6th': [0, 4, 7, 9],
    'Minor 6th': [0, 3, 7, 9],
    '9th': [0, 4, 7, 10, 14],
    'Major 9th': [0, 4, 7, 11, 14],
    'Minor 9th': [0, 3, 7, 10, 14],
    '11th': [0, 4, 7, 10, 14, 17],
    '13th': [0, 4, 7, 10, 14, 21],
    'Power Chord': [0, 7]
};

// -----------------------------------------------------------------------------
// Style-specific scoring rules
// -----------------------------------------------------------------------------

export const STYLE_RULES = {
    any: {
        chordToneBoost: 1.0,
        scaleToneBoost: 1.0,
        stepwiseBoost: 1.0,
        approachToneBoost: 1.0,
        tensionPenalty: 1.0,
        preferredIntervals: [0, 2, 3, 4, 5, 7], // Unison, 2nds, 3rds, 4ths, 5ths
        avoidIntervals: [6, 10, 11] // Tritone, 7ths
    },
    balanced: {
        // Same as 'any' - general-purpose balanced melody
        chordToneBoost: 1.0,
        scaleToneBoost: 1.0,
        stepwiseBoost: 1.0,
        approachToneBoost: 1.0,
        tensionPenalty: 1.0,
        preferredIntervals: [0, 2, 3, 4, 5, 7],
        avoidIntervals: [6, 10, 11]
    },
    indie: {
        // Indie/Alternative - more unexpected, creative choices
        chordToneBoost: 0.9,
        scaleToneBoost: 1.0,
        stepwiseBoost: 0.8,
        approachToneBoost: 1.2,
        tensionPenalty: 0.7, // More tolerant of tension
        preferredIntervals: [0, 2, 3, 4, 5, 7, 9], // Allows 6ths
        avoidIntervals: [6] // Only avoid tritone
    },
    pop: {
        chordToneBoost: 1.3,
        scaleToneBoost: 1.1,
        stepwiseBoost: 1.2,
        approachToneBoost: 0.7,
        tensionPenalty: 1.4,
        preferredIntervals: [0, 2, 4, 5, 7], // Simple intervals
        avoidIntervals: [1, 6, 10, 11] // Chromatic, tritone, 7ths
    },
    jazz: {
        chordToneBoost: 1.0,
        scaleToneBoost: 0.9,
        stepwiseBoost: 1.0,
        approachToneBoost: 1.4,
        tensionPenalty: 0.6, // Jazz loves tension
        preferredIntervals: [0, 1, 2, 3, 4, 5, 7], // All close intervals including chromatic
        avoidIntervals: [] // Jazz allows everything
    },
    classical: {
        chordToneBoost: 1.1,
        scaleToneBoost: 1.2,
        stepwiseBoost: 1.5,
        approachToneBoost: 0.8,
        tensionPenalty: 1.2,
        preferredIntervals: [0, 2, 3, 4, 5], // Stepwise and thirds
        avoidIntervals: [6, 10, 11] // Tritone, 7ths
    },
    rock: {
        chordToneBoost: 1.2,
        scaleToneBoost: 1.0,
        stepwiseBoost: 0.9,
        approachToneBoost: 0.6,
        tensionPenalty: 0.8,
        preferredIntervals: [0, 3, 4, 5, 7], // Pentatonic-friendly
        avoidIntervals: [1, 6], // Chromatic, tritone (unless blue note)
        useBlueNotes: true
    }
};

// -----------------------------------------------------------------------------
// Mood-specific scoring modifiers
// These apply additional bonuses/penalties based on the selected mood
// -----------------------------------------------------------------------------

export const MOOD_RULES = {
    bright: {
        // Happy/Bright - favor major intervals, higher register, avoid dissonance
        majorIntervalBonus: 15,
        minorIntervalPenalty: -10,
        highRegisterBonus: 8, // per octave above 4
        lowRegisterPenalty: -5,
        preferMajorThird: true,
        preferPerfectFifth: true,
        dissonancePenalty: -12, // Bright/happy melodies should avoid dissonance
        chordToneBonus: 8 // Slight preference for chord tones in bright melodies
    },
    dark: {
        // Melancholic/Dark - favor minor intervals, lower register
        majorIntervalBonus: -5,
        minorIntervalPenalty: 10, // Actually a bonus for dark
        highRegisterBonus: -5,
        lowRegisterPenalty: 0,
        preferMinorThird: true,
        preferMinorSixth: true
    },
    jazzy: {
        // Jazzy/Complex - favor extensions, chromatic approach
        tensionBonus: 15,
        chromaticApproachBonus: 12,
        extensionBonus: 10, // 9ths, 11ths, 13ths
        preferSeventh: true
    },
    tense: {
        // Tense/Dramatic - favor dissonance, wide leaps
        tensionBonus: 20,
        wideLeapBonus: 10, // Leaps > 5 semitones
        tritoneBonus: 15,
        stepwisePenalty: -8
    },
    calm: {
        // Calm/Peaceful - favor stepwise motion, consonance
        stepwiseBonus: 15,
        wideLeapPenalty: -12,
        consonanceBonus: 10,
        dissonancePenalty: -15
    },
    energetic: {
        // Energetic/Driving - favor rhythmic patterns, strong beats
        chordToneBonus: 10,
        leapBonus: 8,
        repeatPenalty: -10, // Discourage repetition
        rootBonus: 12
    }
};

// -----------------------------------------------------------------------------
// Utility functions
// -----------------------------------------------------------------------------

/**
 * Convert note name to MIDI number
 */
function noteToMidi(note) {
    if (!note) return null;

    const match = note.match(/^([A-Ga-g][#b]?)(\d+)?$/);
    if (!match) return null;

    const [, pitchClass, octaveStr] = match;
    const octave = octaveStr ? parseInt(octaveStr) : 4;

    let semitone = CHROMATIC_NOTES.indexOf(pitchClass.toUpperCase());
    if (semitone === -1) {
        semitone = FLAT_NOTES.indexOf(pitchClass.charAt(0).toUpperCase() + pitchClass.slice(1).toLowerCase());
    }
    if (semitone === -1) return null;

    return semitone + (octave + 1) * 12;
}

/**
 * Convert MIDI number to note name
 */
function midiToNote(midi, preferFlats = false) {
    if (midi === null || midi === undefined) return null;

    const octave = Math.floor(midi / 12) - 1;
    const semitone = midi % 12;
    const noteName = preferFlats ? FLAT_NOTES[semitone] : CHROMATIC_NOTES[semitone];

    return `${noteName}${octave}`;
}

/**
 * Get pitch class (0-11) from note name
 */
function getPitchClass(note) {
    if (!note) return null;

    const noteName = note.replace(/\d+$/, '').toUpperCase();
    let pc = CHROMATIC_NOTES.indexOf(noteName);
    if (pc === -1) {
        pc = FLAT_NOTES.indexOf(noteName.charAt(0) + noteName.slice(1).toLowerCase());
    }
    return pc;
}

/**
 * Calculate interval in semitones between two notes
 */
function getInterval(note1, note2) {
    const midi1 = noteToMidi(note1);
    const midi2 = noteToMidi(note2);
    if (midi1 === null || midi2 === null) return null;
    return Math.abs(midi2 - midi1);
}

/**
 * Get scale notes for a given key
 */
function getScaleNotes(key, scaleType = 'major') {
    const keyPc = getPitchClass(key);
    if (keyPc === null) return [];

    const intervals = SCALES[scaleType] || SCALES.major;
    return intervals.map(interval => (keyPc + interval) % 12);
}

/**
 * Get chord tones for a given chord
 */
function getChordTones(chord) {
    if (!chord || !chord.root) return [];

    const rootPc = getPitchClass(chord.root);
    if (rootPc === null) return [];

    // Try to find the chord type in CHORD_INTERVALS
    let intervals = CHORD_INTERVALS[chord.type];

    // If not found, try common aliases and patterns
    if (!intervals && chord.type) {
        const type = chord.type.toLowerCase();

        // Map common variations to canonical names
        if (type === 'm' || type === 'min' || type.includes('minor') && !type.includes('7')) {
            intervals = CHORD_INTERVALS['Minor'];
        } else if (type === 'm7' || type === 'min7' || type === '-7' || type.includes('minor 7')) {
            intervals = CHORD_INTERVALS['Minor 7th'];
        } else if (type === 'maj7' || type === 'M7' || type.includes('major 7')) {
            intervals = CHORD_INTERVALS['Major 7th'];
        } else if (type === '7' || type === 'dom7' || type.includes('dominant')) {
            intervals = CHORD_INTERVALS['Dominant 7th'];
        } else if (type === 'dim' || type.includes('diminish') && !type.includes('7')) {
            intervals = CHORD_INTERVALS['Diminished'];
        } else if (type === 'dim7' || type === 'o7' || type.includes('diminished 7')) {
            intervals = CHORD_INTERVALS['Diminished 7th'];
        } else if (type === 'm7b5' || type === 'ø7' || type.includes('half-dim') || type.includes('half dim')) {
            intervals = CHORD_INTERVALS['Half-Diminished 7th'];
        } else if (type === 'aug' || type === '+' || type.includes('augment') && !type.includes('7')) {
            intervals = CHORD_INTERVALS['Augmented'];
        } else if (type.includes('sus2')) {
            intervals = CHORD_INTERVALS['Sus2'];
        } else if (type.includes('sus4') || type === 'sus') {
            intervals = CHORD_INTERVALS['Sus4'];
        }
    }

    // Ultimate fallback with warning
    if (!intervals) {

        intervals = CHORD_INTERVALS['Major'];
    }

    return intervals.map(interval => (rootPc + interval) % 12);
}

/**
 * Check if a note is a chord tone
 */
function isChordTone(note, chord) {
    const notePc = getPitchClass(note);
    const chordTones = getChordTones(chord);
    return chordTones.includes(notePc);
}

/**
 * Check if a note is in the scale
 */
function isScaleTone(note, key, scaleType = 'major') {
    const notePc = getPitchClass(note);
    const scaleNotes = getScaleNotes(key, scaleType);
    return scaleNotes.includes(notePc);
}

/**
 * Get the degree of a note in a chord (root=1, 3rd=3, 5th=5, etc.)
 */
function getChordDegree(note, chord) {
    const notePc = getPitchClass(note);
    const rootPc = getPitchClass(chord.root);
    if (notePc === null || rootPc === null) return null;

    const interval = (notePc - rootPc + 12) % 12;

    const degreeMap = {
        0: 'Root',
        1: 'b9',
        2: '9',
        3: 'b3/m3',
        4: '3',
        5: '11',
        6: '#11/b5',
        7: '5',
        8: '#5/b13',
        9: '13/6',
        10: 'b7',
        11: '7'
    };

    return degreeMap[interval] || interval;
}

/**
 * Clamp value between 0 and 100
 */
function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}

// -----------------------------------------------------------------------------
// Suggestion scoring functions
// -----------------------------------------------------------------------------

/**
 * Score a note based on its relationship to the chord
 */
function scoreChordRelation(note, chord, styleRules) {
    const chordTones = getChordTones(chord);
    const notePc = getPitchClass(note);

    if (chordTones.includes(notePc)) {
        // Chord tone - highest priority
        const rootPc = getPitchClass(chord.root);
        const interval = (notePc - rootPc + 12) % 12;

        // Root and 5th are most stable
        if (interval === 0) return { score: NOTE_CATEGORIES.chordTone.baseScore * styleRules.chordToneBoost, category: 'chordTone', detail: 'Root' };
        if (interval === 7) return { score: (NOTE_CATEGORIES.chordTone.baseScore - 3) * styleRules.chordToneBoost, category: 'chordTone', detail: '5th' };
        if (interval === 4 || interval === 3) return { score: (NOTE_CATEGORIES.chordTone.baseScore - 5) * styleRules.chordToneBoost, category: 'chordTone', detail: '3rd' };

        // 7ths and extensions
        return { score: (NOTE_CATEGORIES.chordTone.baseScore - 10) * styleRules.chordToneBoost, category: 'chordTone', detail: 'Extension' };
    }

    return null;
}

/**
 * Score a note based on scale membership
 */
function scoreScaleRelation(note, key, scaleType, styleRules) {
    if (isScaleTone(note, key, scaleType)) {
        return {
            score: NOTE_CATEGORIES.scaleTone.baseScore * styleRules.scaleToneBoost,
            category: 'scaleTone',
            detail: 'In key'
        };
    }
    return null;
}

/**
 * Score based on voice leading from previous note
 */
function scoreVoiceLeading(note, previousNote, styleRules) {
    if (!previousNote) return null;

    const interval = getInterval(previousNote, note);
    if (interval === null) return null;

    // Stepwise motion (1-2 semitones)
    if (interval <= 2) {
        return {
            score: NOTE_CATEGORIES.stepwiseMotion.baseScore * styleRules.stepwiseBoost,
            category: 'stepwiseMotion',
            detail: interval === 1 ? 'Half step' : interval === 2 ? 'Whole step' : 'Repeat'
        };
    }

    // Small leap (3-4 semitones = minor/major 3rd)
    if (interval <= 4) {
        return {
            score: 75 * styleRules.stepwiseBoost,
            category: 'stepwiseMotion',
            detail: 'Small leap (3rd)'
        };
    }

    // Medium leap (5-7 semitones = 4th, tritone, 5th)
    if (interval <= 7) {
        const penalty = interval === 6 ? 0.7 : 0.85; // Tritone penalty
        return {
            score: 60 * penalty,
            category: 'passingTone',
            detail: interval === 6 ? 'Tritone leap' : 'Medium leap'
        };
    }

    // Large leap (octave or more) - use sparingly
    return {
        score: 40,
        category: 'tension',
        detail: 'Large leap'
    };
}

/**
 * Score approach tones (chromatic notes leading to chord tones)
 */
function scoreApproachTone(note, chord, previousNote, styleRules) {
    const notePc = getPitchClass(note);
    const chordTones = getChordTones(chord);

    // Check if this note is a half-step away from a chord tone
    for (const chordTone of chordTones) {
        if ((notePc + 1) % 12 === chordTone || (notePc + 11) % 12 === chordTone) {
            return {
                score: NOTE_CATEGORIES.approachTone.baseScore * styleRules.approachToneBoost,
                category: 'approachTone',
                detail: 'Chromatic approach'
            };
        }
    }

    return null;
}

/**
 * Score tension notes (notes that create harmonic tension)
 */
function scoreTension(note, chord, key, styleRules) {
    const notePc = getPitchClass(note);
    const rootPc = getPitchClass(chord.root);
    const interval = (notePc - rootPc + 12) % 12;

    // b9, #11, b13 are tension notes
    const tensionIntervals = [1, 6, 8];

    if (tensionIntervals.includes(interval)) {
        return {
            score: NOTE_CATEGORIES.tension.baseScore / styleRules.tensionPenalty,
            category: 'tension',
            detail: interval === 1 ? 'b9 tension' : interval === 6 ? '#11 tension' : 'b13 tension'
        };
    }

    return null;
}

/**
 * Apply contour preference scoring
 * Increased bonuses to make contour selection more impactful
 * @param {string} note - The candidate note
 * @param {string|null} previousNote - Previous note played (can be null)
 * @param {string} contourPreset - The contour preference (ascending, descending, stepwise, etc.)
 * @param {string} chordRoot - The chord root note (used as fallback reference when no previousNote)
 * @param {number} targetOctave - The target octave for the melody
 */
function scoreContour(note, previousNote, contourPreset, chordRoot = 'C', targetOctave = 4) {
    if (contourPreset === 'any') return 0;

    const currentMidi = noteToMidi(note);
    if (currentMidi === null) return 0;

    // Use previousNote if available, otherwise use chord root at target octave as reference
    let refMidi;
    if (previousNote) {
        refMidi = noteToMidi(previousNote);
    } else {
        // Use chord root at target octave as reference point
        refMidi = noteToMidi(chordRoot + targetOctave);
    }
    if (refMidi === null) return 0;

    const direction = currentMidi - refMidi;

    switch (contourPreset) {
        case 'ascending':
            return direction > 0 ? 25 : direction < 0 ? -20 : 0;
        case 'descending':
            return direction < 0 ? 25 : direction > 0 ? -20 : 0;
        case 'stepwise':
            return Math.abs(direction) <= 2 ? 30 : -15;
        case 'arch':
            // Favor ascending early, descending later (would need position context)
            return 0;
        default:
            return 0;
    }
}

/**
 * Apply mood-based scoring to a note candidate
 * @param {string} note - The candidate note
 * @param {Object} chord - Current chord {root, type}
 * @param {string} previousNote - Previous note played
 * @param {string} mood - Selected mood (bright, dark, jazzy, tense, calm, energetic)
 * @returns {number} Mood bonus/penalty score
 */
function scoreMood(note, chord, previousNote, mood) {
    const moodRules = MOOD_RULES[mood];
    if (!moodRules) return 0;

    const noteMidi = noteToMidi(note);
    if (noteMidi === null) return 0;

    let moodScore = 0;
    const notePc = getPitchClass(note);
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

    // Leap handling
    if (previousNote) {
        const prevMidi = noteToMidi(previousNote);
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
    }

    // Chord tone bonus for energetic mood
    if (moodRules.chordToneBonus) {
        const chordTones = getChordTones(chord);
        if (chordTones.includes(notePc)) {
            moodScore += moodRules.chordToneBonus;
        }
    }
    if (moodRules.rootBonus && interval === 0) {
        moodScore += moodRules.rootBonus;
    }

    return moodScore;
}

// -----------------------------------------------------------------------------
// Anticipation Scoring (for upcoming chord changes)
// -----------------------------------------------------------------------------

/**
 * Score anticipation - how well a note leads into the next chord
 * @param {string} note - Note to score
 * @param {Object} currentChord - Current chord {root, type}
 * @param {Object} nextChord - Next chord {root, type}
 * @param {number} anticipationFactor - 0-1, how close we are to chord change (1 = at boundary)
 * @returns {Object|null} Score object or null
 */
function scoreAnticipation(note, currentChord, nextChord, anticipationFactor) {
    if (!nextChord || anticipationFactor <= 0) return null;

    const notePc = getPitchClass(note);
    const nextChordTones = getChordTones(nextChord);
    const currentChordTones = getChordTones(currentChord);
    const nextRootPc = getPitchClass(nextChord.root);

    let anticipationScore = 0;
    let detail = '';

    // Check if note is a chord tone of the NEXT chord
    if (nextChordTones.includes(notePc)) {
        const interval = (notePc - nextRootPc + 12) % 12;
        if (interval === 0) {
            // Root of next chord - strong anticipation
            anticipationScore = 35;
            detail = `Anticipates ${nextChord.root} (root)`;
        } else if (interval === 7) {
            // Fifth of next chord
            anticipationScore = 28;
            detail = `Anticipates ${nextChord.root} (5th)`;
        } else if (interval === 4 || interval === 3) {
            // Third of next chord
            anticipationScore = 30;
            detail = `Anticipates ${nextChord.root} (3rd)`;
        } else {
            // Other chord tone (7th, etc.)
            anticipationScore = 22;
            detail = `Anticipates ${nextChord.root} (extension)`;
        }

        // Extra bonus if it's also a common tone (shared between chords)
        if (currentChordTones.includes(notePc)) {
            anticipationScore += 10;
            detail += ' (common tone)';
        }
    }
    // Check for leading tone to next chord's root (half-step below)
    else if ((notePc + 1) % 12 === nextRootPc) {
        anticipationScore = 32;
        detail = `Leading tone to ${nextChord.root}`;
    }
    // Check for leading tone to next chord's third
    else if ((notePc + 1) % 12 === nextChordTones[1] || (notePc + 11) % 12 === nextChordTones[1]) {
        anticipationScore = 20;
        detail = `Approach to ${nextChord.root}'s 3rd`;
    }
    // Check for common tone bonus (note in both chords)
    else if (currentChordTones.includes(notePc) && nextChordTones.includes(notePc)) {
        anticipationScore = 15;
        detail = `Common tone (${currentChord.root}→${nextChord.root})`;
    }

    if (anticipationScore > 0) {
        // Weight by anticipation factor - stronger effect closer to chord change
        return {
            score: anticipationScore * anticipationFactor,
            category: 'anticipation',
            detail
        };
    }

    return null;
}

/**
 * Get common tones between two chords
 */
export function getCommonTones(chord1, chord2) {
    const tones1 = getChordTones(chord1);
    const tones2 = getChordTones(chord2);
    return tones1.filter(t => tones2.includes(t));
}

// -----------------------------------------------------------------------------
// Main suggestion generation
// -----------------------------------------------------------------------------

/**
 * Generate melody note suggestions
 *
 * @param {Object} options - Suggestion parameters
 * @param {Object} options.chord - Current chord {root, type}
 * @param {string} options.key - Current key (e.g., 'C', 'G')
 * @param {string} options.previousNote - Previous melody note (e.g., 'C4')
 * @param {string} options.styleId - Style preset ID
 * @param {string} options.contourId - Contour preset ID
 * @param {number} options.octave - Target octave (default 4)
 * @param {number} options.range - Octave range to consider (default 2)
 * @param {Array} options.recentNotes - Array of recent note names for recency penalty
 * @param {Object} options.nextChord - Next chord in progression (for anticipation)
 * @param {number} options.anticipationFactor - 0-1, proximity to chord change (1 = at boundary)
 * @returns {Object} Suggestions and context
 */
export function generateMelodySuggestions({
    chord = { root: 'C', type: 'Major' },
    key = 'C',
    previousNote = null,
    styleId = 'any',
    contourId = 'any',
    mood = 'bright', // Default mood
    octave = 4,
    range = 2,
    recentNotes = [],
    nextChord = null,
    anticipationFactor = 0
} = {}) {
    const baseStyleRules = STYLE_RULES[styleId] || STYLE_RULES.any;

    // Get user's custom weights and apply them as multipliers
    const userWeights = getSavedMelodyWeights();
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

    // Store recency penalty weight for later use
    const recencyPenaltyMultiplier = userWeights.recencyPenalty;

    const candidates = [];

    // Determine scale type based on key signature
    const scaleType = key.includes('m') ? 'minor' : 'major';
    const keyRoot = key.replace('m', '');

    // Generate candidate notes across the range
    const startOctave = octave - Math.floor(range / 2);
    const endOctave = octave + Math.ceil(range / 2);

    for (let oct = startOctave; oct <= endOctave; oct++) {
        for (let pc = 0; pc < 12; pc++) {
            const spelledPitch = getSpelledNoteName(pc, key);
            const noteName = spelledPitch + oct;
            const scores = [];
            const reasons = [];
            const categories = [];

            // Score chord relation
            const chordScore = scoreChordRelation(noteName, chord, styleRules);
            if (chordScore) {
                scores.push(chordScore.score);
                reasons.push(`${chordScore.detail} of ${chord.root} ${chord.type}`);
                categories.push(chordScore.category);
            }

            // Score scale relation (if not already a chord tone)
            if (!chordScore) {
                const scaleScore = scoreScaleRelation(noteName, keyRoot, scaleType, styleRules);
                if (scaleScore) {
                    scores.push(scaleScore.score);
                    reasons.push(`${scaleScore.detail} (${key})`);
                    categories.push(scaleScore.category);
                }
            }

            // Score voice leading
            const voiceScore = scoreVoiceLeading(noteName, previousNote, styleRules);
            if (voiceScore) {
                scores.push(voiceScore.score * 0.3); // Weight voice leading less than harmony
                reasons.push(voiceScore.detail);
                if (!categories.includes(voiceScore.category)) {
                    categories.push(voiceScore.category);
                }
            }

            // Score approach tone potential
            if (!chordScore) {
                const approachScore = scoreApproachTone(noteName, chord, previousNote, styleRules);
                if (approachScore) {
                    scores.push(approachScore.score);
                    reasons.push(approachScore.detail);
                    categories.push(approachScore.category);
                }
            }

            // Score tension
            if (!chordScore && scores.length === 0) {
                const tensionScore = scoreTension(noteName, chord, key, styleRules);
                if (tensionScore) {
                    scores.push(tensionScore.score);
                    reasons.push(tensionScore.detail);
                    categories.push(tensionScore.category);
                }
            }

            // Score anticipation (how well note leads into next chord)
            let anticipationBonus = 0;
            if (nextChord && anticipationFactor > 0) {
                const anticipationResult = scoreAnticipation(noteName, chord, nextChord, anticipationFactor);
                if (anticipationResult) {
                    anticipationBonus = anticipationResult.score;
                    reasons.push(anticipationResult.detail);
                    if (!categories.includes('anticipation')) {
                        categories.push('
                    }
                }
            }

            // Apply contour preference (use chord root as reference when no previousNote)
            const contourBonus = scoreContour(noteName, previousNote, contourId, chord.root, octave);

            // Apply mood-based scoring
            const moodBonus = scoreMood(noteName, chord, previousNote, mood);

            // Apply pitch proximity bonus - favor notes closer to previous note or target range
            let proximityBonus = 0;

            if (previousNote) {
                // Calculate pitch distance in semitones
                const prevMIDI = getMIDINumber(previousNote);
                const currentMIDI = getMIDINumber(noteName);
                const semitoneDist = Math.abs(currentMIDI - prevMIDI);

                // Favor notes close to the previous note (smooth melodic motion)
                if (semitoneDist <= 2) {
                    proximityBonus += 15; // Stepwise motion (1-2 semitones)
                } else if (semitoneDist <= 5) {
                    proximityBonus += 10; // Small leaps (3-5 semitones)
                } else if (semitoneDist <= 7) {
                    proximityBonus += 5; // Medium leaps (6-7 semitones, like perfect 5th)
                } else if (semitoneDist <= 12) {
                    proximityBonus += 2; // Larger leaps (octave or less)
                }
                // No bonus for leaps larger than an octave
            } else {
                // No previous note - favor notes in the target octave range
                // Calculate distance from center of target octave (e.g., C4 for octave 4)
                const targetCenterMIDI = 60 + (octave - 4) * 12; // C4 = MIDI 60
                const currentMIDI = getMIDINumber(noteName);
                const distanceFromCenter = Math.abs(currentMIDI - targetCenterMIDI);

                // Strongly favor notes within the target octave (increased impact)
                if (distanceFromCenter <= 6) {
                    proximityBonus += 35; // Within target octave (±6 semitones from center)
                } else if (distanceFromCenter <= 12) {
                    proximityBonus += 15; // Within adjacent octaves
                } else if (distanceFromCenter <= 18) {
                    proximityBonus += 5; // Within 1.5 octaves
                } else {
                    proximityBonus -= 10; // Penalty for notes too far from target range
                }
            }

            // Calculate base harmonic score (without proximity)
            let harmonicScore = 0;
            if (scores.length > 0) {
                // Use highest score as base, add bonuses from others
                scores.sort((a, b) => b - a);
                harmonicScore = scores[0] + scores.slice(1).reduce((sum, s) => sum + s * 0.2, 0);
            }
            harmonicScore += contourBonus;
            harmonicScore += moodBonus;

            // Apply recency/frequency penalty to harmonic score
            if (recentNotes && recentNotes.length > 0) {
                // Get pitch class without octave for matching (e.g., 'C4' -> 'C')
                // Use spelled pitch to match against recent notes which may be spelled either way
                const pitchClass = spelledPitch;
                // Also check the enharmonic equivalent for matching
                const altPitchClass = CHROMATIC_NOTES[pc] === spelledPitch ? FLAT_NOTES[pc] : CHROMATIC_NOTES[pc];

                // Count occurrences and find most recent position
                let occurrenceCount = 0;
                let mostRecentPosition = -1;

                recentNotes.forEach((recentNote, idx) => {
                    // Extract pitch class from recent note
                    const recentPitchClass = recentNote.replace(/\d+$/, '');
                    // Match against both spellings (e.g., "A#" and "Bb" are the same pitch)
                    if (recentPitchClass === pitchClass || recentPitchClass === altPitchClass) {
                        occurrenceCount++;
                        if (mostRecentPosition === -1 || idx < mostRecentPosition) {
                            mostRecentPosition = idx;
                        }
                    }
                });

                if (occurrenceCount > 0) {
                    // Penalty increases with frequency
                    const frequencyPenalty = occurrenceCount * 8; // -8 points per occurrence

                    // Penalty increases with recency (position 0 = most recent)
                    // Max penalty 15 for most recent, decreasing to 0 for older notes
                    const recencyPenalty = mostRecentPosition < 5
                        ? (5 - mostRecentPosition) * 3
                        : 0;

                    // Apply user's recency penalty multiplier
                    const totalPenalty = (frequencyPenalty + recencyPenalty) * recencyPenaltyMultiplier;
                    harmonicScore -= totalPenalty;

                    if (frequencyPenalty + recencyPenalty > 0) {
                        reasons.push(`Recently used (${occurrenceCount}×)`);
                    }
                }
            }

            // Calculate total score naturally without clamping
            // We'll normalize all scores to 0-100 range at the end
            const totalScore = harmonicScore + proximityBonus + anticipationBonus;

            // Only include notes with reasonable scores
            if (totalScore > 20) {
                // Determine primary category
                const primaryCategory = categories[0] || 'scaleTone';
                const categoryInfo = NOTE_CATEGORIES[primaryCategory] || NOTE_CATEGORIES.scaleTone;

                candidates.push({
                    note: noteName,
                    pitch: spelledPitch,
                    octave: oct,
                    totalScore: Math.round(totalScore),
                    category: primaryCategory,
                    categoryLabel: categoryInfo.label,
                    reasons: reasons,
                    chordDegree: getChordDegree(noteName, chord),
                    isChordTone: isChordTone(noteName, chord),
                    isScaleTone: isScaleTone(noteName, keyRoot, scaleType),
                    voiceLeadingDistance: previousNote ? getInterval(previousNote, noteName) : null,
                    // Anticipation info
                    anticipatesNextChord: nextChord ? isChordTone(noteName, nextChord) : false,
                    isCommonTone: nextChord ? (isChordTone(noteName, chord) && isChordTone(noteName, nextChord)) : false
                });
            }
        }
    }

    // Sort by score and take top suggestions
    const sortedCandidates = candidates
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 15);

    // Normalize scores to 0-100 range to preserve relative differences
    if (sortedCandidates.length > 0) {
        const scores = sortedCandidates.map(c => c.totalScore);
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        const range = maxScore - minScore;

        if (range > 0) {
            sortedCandidates.forEach(candidate => {
                candidate.totalScore = Math.round(((candidate.totalScore - minScore) / range) * 100);
            });
        } else {
            // All scores are the same, set all to 100
            sortedCandidates.forEach(candidate => {
                candidate.totalScore = 100;
            });
        }
    }

    // Group by category for UI display
    const byCategory = {
        chordTone: sortedCandidates.filter(c => c.category === 'chordTone'),
        scaleTone: sortedCandidates.filter(c => c.category === 'scaleTone'),
        stepwiseMotion: sortedCandidates.filter(c => c.category === 'stepwiseMotion'),
        approachTone: sortedCandidates.filter(c => c.category === 'approachTone'),
        tension: sortedCandidates.filter(c => c.category === 'tension'),
        anticipation: sortedCandidates.filter(c => c.anticipatesNextChord)
    };

    return {
        suggestions: sortedCandidates,
        byCategory,
        context: {
            chord,
            key,
            previousNote,
            styleId,
            contourId,
            octave,
            range,
            nextChord,
            anticipationFactor
        }
    };
}

/**
 * Get quick suggestions (top 5) for immediate display
 */
export function getQuickSuggestions(options) {
    const result = generateMelodySuggestions(options);
    return result.suggestions.slice(0, 5);
}

/**
 * Get chord tone suggestions only
 */
export function getChordToneSuggestions({ chord, octave = 4, range = 2, key = 'C' }) {
    const chordTones = getChordTones(chord);
    const suggestions = [];

    const startOctave = octave - Math.floor(range / 2);
    const endOctave = octave + Math.ceil(range / 2);

    for (let oct = startOctave; oct <= endOctave; oct++) {
        for (const pc of chordTones) {
            const spelledPitch = getSpelledNoteName(pc, key);
            const noteName = spelledPitch + oct;
            suggestions.push({
                note: noteName,
                pitch: spelledPitch,
                octave: oct,
                chordDegree: getChordDegree(noteName, chord),
                isRoot: pc === getPitchClass(chord.root)
            });
        }
    }

    return suggestions;
}

/**
 * Analyze a melody note in context
 */
export function analyzeNote({ note, chord, key, previousNote }) {
    const analysis = {
        note,
        isChordTone: isChordTone(note, chord),
        isScaleTone: isScaleTone(note, key.replace('m', ''), key.includes('m') ? 'minor' : 'major'),
        chordDegree: getChordDegree(note, chord),
        intervalFromPrevious: previousNote ? getInterval(previousNote, note) : null,
        category: 'scaleTone',
        description: ''
    };

    if (analysis.isChordTone) {
        analysis.category = 'chordTone';
        analysis.description = `${analysis.chordDegree} of ${chord.root} ${chord.type} - strong and stable`;
    } else if (analysis.isScaleTone) {
        analysis.category = 'scaleTone';
        analysis.description = `Scale tone in ${key} - good melodic choice`;
    } else {
        // Check if it's an approach tone
        const chordTones = getChordTones(chord);
        const notePc = getPitchClass(note);
        const isApproach = chordTones.some(ct =>
            (notePc + 1) % 12 === ct || (notePc + 11) % 12 === ct
        );

        if (isApproach) {
            analysis.category = 'approachTone';
            analysis.description = 'Chromatic approach - resolve to nearby chord tone';
        } else {
            analysis.category = 'tension';
            analysis.description = 'Outside the key - creates tension, resolve carefully';
        }
    }

    return analysis;
}

// -----------------------------------------------------------------------------
// Export utility functions for use elsewhere
// -----------------------------------------------------------------------------

export {
    noteToMidi,
    midiToNote,
    getPitchClass,
    getInterval,
    getScaleNotes,
    getChordTones,
    isChordTone,
    isScaleTone,
    getChordDegree,
    NOTE_CATEGORIES,
    SCALES,
    CHORD_INTERVALS
};
