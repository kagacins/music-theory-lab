/**
 * Melody Suggestion Engine
 * Provides context-aware melody note suggestions based on chord, key, and style
 */

import { getSavedMelodyWeights } from '../config/weightPresets.js';

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
    'Suspended 2nd': [0, 2, 7],
    'Suspended 4th': [0, 5, 7],
    'Add 9': [0, 2, 4, 7],
    '6th': [0, 4, 7, 9],
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

const STYLE_RULES = {
    any: {
        chordToneBoost: 1.0,
        scaleToneBoost: 1.0,
        stepwiseBoost: 1.0,
        approachToneBoost: 1.0,
        tensionPenalty: 1.0,
        preferredIntervals: [0, 2, 3, 4, 5, 7], // Unison, 2nds, 3rds, 4ths, 5ths
        avoidIntervals: [6, 10, 11] // Tritone, 7ths
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

    const intervals = CHORD_INTERVALS[chord.type] || CHORD_INTERVALS['Major'];
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
 */
function scoreContour(note, previousNote, contourPreset) {
    if (!previousNote || contourPreset === 'any') return 0;

    const currentMidi = noteToMidi(note);
    const prevMidi = noteToMidi(previousNote);
    if (currentMidi === null || prevMidi === null) return 0;

    const direction = currentMidi - prevMidi;

    switch (contourPreset) {
        case 'ascending':
            return direction > 0 ? 10 : direction < 0 ? -10 : 0;
        case 'descending':
            return direction < 0 ? 10 : direction > 0 ? -10 : 0;
        case 'stepwise':
            return Math.abs(direction) <= 2 ? 15 : -10;
        case 'arch':
            // Favor ascending early, descending later (would need position context)
            return 0;
        default:
            return 0;
    }
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
 * @returns {Object} Suggestions and context
 */
export function generateMelodySuggestions({
    chord = { root: 'C', type: 'Major' },
    key = 'C',
    previousNote = null,
    styleId = 'any',
    contourId = 'any',
    octave = 4,
    range = 2,
    recentNotes = [] // Array of recent note names for recency penalty
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
            const noteName = CHROMATIC_NOTES[pc] + oct;
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

            // Apply contour preference
            const contourBonus = scoreContour(noteName, previousNote, contourId);

            // Calculate total score
            let totalScore = 0;
            if (scores.length > 0) {
                // Use highest score as base, add bonuses from others
                scores.sort((a, b) => b - a);
                totalScore = scores[0] + scores.slice(1).reduce((sum, s) => sum + s * 0.2, 0);
            }
            totalScore += contourBonus;

            // Apply recency/frequency penalty
            // Recent notes get a penalty based on how recently/frequently they were used
            if (recentNotes && recentNotes.length > 0) {
                // Get pitch class without octave for matching (e.g., 'C4' -> 'C')
                const pitchClass = CHROMATIC_NOTES[pc];

                // Count occurrences and find most recent position
                let occurrenceCount = 0;
                let mostRecentPosition = -1;

                recentNotes.forEach((recentNote, idx) => {
                    // Extract pitch class from recent note
                    const recentPitchClass = recentNote.replace(/\d+$/, '');
                    if (recentPitchClass === pitchClass) {
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
                    totalScore -= totalPenalty;

                    if (frequencyPenalty + recencyPenalty > 0) {
                        reasons.push(`Recently used (${occurrenceCount}×)`);
                    }
                }
            }

            totalScore = clamp(totalScore);

            // Only include notes with reasonable scores
            if (totalScore > 20) {
                // Determine primary category
                const primaryCategory = categories[0] || 'scaleTone';
                const categoryInfo = NOTE_CATEGORIES[primaryCategory] || NOTE_CATEGORIES.scaleTone;

                candidates.push({
                    note: noteName,
                    pitch: CHROMATIC_NOTES[pc],
                    octave: oct,
                    totalScore: Math.round(totalScore),
                    category: primaryCategory,
                    categoryLabel: categoryInfo.label,
                    reasons: reasons,
                    chordDegree: getChordDegree(noteName, chord),
                    isChordTone: isChordTone(noteName, chord),
                    isScaleTone: isScaleTone(noteName, keyRoot, scaleType),
                    voiceLeadingDistance: previousNote ? getInterval(previousNote, noteName) : null
                });
            }
        }
    }

    // Sort by score and take top suggestions
    const sortedCandidates = candidates
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 15);

    // Group by category for UI display
    const byCategory = {
        chordTone: sortedCandidates.filter(c => c.category === 'chordTone'),
        scaleTone: sortedCandidates.filter(c => c.category === 'scaleTone'),
        stepwiseMotion: sortedCandidates.filter(c => c.category === 'stepwiseMotion'),
        approachTone: sortedCandidates.filter(c => c.category === 'approachTone'),
        tension: sortedCandidates.filter(c => c.category === 'tension')
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
            range
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
export function getChordToneSuggestions({ chord, octave = 4, range = 2 }) {
    const chordTones = getChordTones(chord);
    const suggestions = [];

    const startOctave = octave - Math.floor(range / 2);
    const endOctave = octave + Math.ceil(range / 2);

    for (let oct = startOctave; oct <= endOctave; oct++) {
        for (const pc of chordTones) {
            const noteName = CHROMATIC_NOTES[pc] + oct;
            suggestions.push({
                note: noteName,
                pitch: CHROMATIC_NOTES[pc],
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
