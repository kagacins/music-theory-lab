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
    CHORD_INTERVALS
} from './melodySuggestion.js';

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
    short: { notes: 4, label: 'Short (4 notes)', beats: 2 },
    medium: { notes: 8, label: 'Medium (8 notes)', beats: 4 },
    long: { notes: 12, label: 'Long (12 notes)', beats: 8 },
    extended: { notes: 16, label: 'Extended (16 notes)', beats: 8 }
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
    }
};

// -----------------------------------------------------------------------------
// Chromatic notes for MIDI conversion
// -----------------------------------------------------------------------------

const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

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
 * @param {string} options.previousNote - Last note before phrase (for voice leading)
 * @param {number} options.octave - Target octave (default 4)
 * @param {number} options.range - Range in semitones (default 12)
 * @returns {Object} Generated phrase with notes, rhythm, and scoring
 */
export function generatePhrase({
    chord = { root: 'C', type: 'Major' },
    key = 'C',
    contourId = 'arch',
    lengthId = 'medium',
    rhythmId = 'steady',
    styleId = 'any',
    previousNote = null,
    octave = 4,
    range = 12,
    // New: chord sequence for multi-chord phrases
    // Array of { chord, noteIndices } or null to use single chord
    chordSequence = null
} = {}) {
    const contour = CONTOUR_SHAPES[contourId] || CONTOUR_SHAPES.arch;
    const phraseLength = PHRASE_LENGTHS[lengthId] || PHRASE_LENGTHS.medium;
    const rhythmPattern = RHYTHM_PATTERNS[rhythmId] || RHYTHM_PATTERNS.steady;

    const noteCount = phraseLength.notes;
    const notes = [];
    const noteDetails = [];

    // Get scale context
    const scaleType = key.includes('m') ? 'minor' : 'major';
    const keyRoot = key.replace('m', '');
    const scaleNotes = getScaleNotes(keyRoot, scaleType);

    // Helper to get chord for a specific note index
    const getChordForNoteIndex = (noteIndex) => {
        if (!chordSequence || chordSequence.length === 0) {
            return chord; // Fall back to single chord
        }
        // Find which chord this note index falls under
        for (const entry of chordSequence) {
            if (entry.noteIndices && entry.noteIndices.includes(noteIndex)) {
                return entry.chord;
            }
        }
        // Default to first chord in sequence or provided chord
        return chordSequence[0]?.chord || chord;
    };

    // Initial chord tones (for first note)
    const chordTones = getChordTones(chord);

    // Calculate range bounds
    const baseMidi = 60 + (octave - 4) * 12; // C4 = 60
    const lowBound = baseMidi - Math.floor(range / 2);
    const highBound = baseMidi + Math.ceil(range / 2);

    let currentNote = previousNote;

    for (let i = 0; i < noteCount; i++) {
        const position = i / (noteCount - 1); // 0 to 1 position in phrase
        const targetHeight = contour.weight(position);

        // Calculate target MIDI based on contour
        const targetMidi = Math.round(lowBound + targetHeight * (highBound - lowBound));

        // Get the chord for THIS note position (may differ from starting chord)
        const noteChord = getChordForNoteIndex(i);
        const noteChordTones = getChordTones(noteChord);

        // Get candidates around target, using the note's chord context
        const candidates = getCandidatesAroundTarget(targetMidi, noteChord, key, scaleNotes, noteChordTones, styleId);

        // Look ahead: get next chord if available (for anticipation on last notes of current chord)
        let nextChord = null;
        if (chordSequence && chordSequence.length > 0) {
            const nextNoteChord = getChordForNoteIndex(i + 1);
            if (nextNoteChord && nextNoteChord.root !== noteChord.root) {
                nextChord = nextNoteChord;
            }
        }

        // Score candidates
        const scoredCandidates = candidates.map(candidate => {
            let score = 100;

            // Distance from target pitch (contour adherence)
            const distanceFromTarget = Math.abs(candidate.midi - targetMidi);
            score -= distanceFromTarget * 3;

            // Chord tone bonus - now using the chord for THIS note position
            const isChordToneOfNoteChord = noteChordTones.includes(candidate.midi % 12);
            if (isChordToneOfNoteChord) {
                score += 20;
                // Root and 5th get extra bonus at phrase boundaries
                if (i === 0 || i === noteCount - 1) {
                    const rootPc = getPitchClass(noteChord.root);
                    const notePc = candidate.midi % 12;
                    if (notePc === rootPc) score += 15; // Root
                    if ((notePc - rootPc + 12) % 12 === 7) score += 10; // 5th
                }
            }

            // Scale tone bonus
            if (candidate.isScaleTone) {
                score += 10;
            }

            // Voice leading from previous note
            if (currentNote) {
                const prevMidi = noteToMidi(currentNote);
                if (prevMidi !== null) {
                    const interval = Math.abs(candidate.midi - prevMidi);
                    if (interval <= 2) score += 15; // Stepwise
                    else if (interval <= 4) score += 10; // Small leap
                    else if (interval <= 7) score += 5; // Medium leap
                    else if (interval > 12) score -= 10; // Large leap penalty
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
                // Last note - prefer resolution (root or 5th of the FINAL chord)
                const finalChord = getChordForNoteIndex(noteCount - 1);
                const rootPc = getPitchClass(finalChord.root);
                const notePc = candidate.midi % 12;
                if (notePc === rootPc) score += 20;
                if ((notePc - rootPc + 12) % 12 === 7) score += 10;
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
    }

    // Generate rhythm
    const rhythm = rhythmPattern.getPattern(noteCount);

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
        phraseScore,
        chordsUsed,
        context: {
            chord,
            key,
            styleId,
            octave,
            range,
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
        const noteName = CHROMATIC_NOTES[pitchClass] + octave;

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

    // Generate with requested contour
    for (let i = 0; i < Math.ceil(count / 2); i++) {
        candidates.push(generatePhrase(options));
    }

    // Generate with complementary contours for variety
    const complementaryContours = getComplementaryContours(options.contourId);
    for (let i = 0; i < Math.floor(count / 2); i++) {
        const contourId = complementaryContours[i % complementaryContours.length];
        candidates.push(generatePhrase({ ...options, contourId }));
    }

    // Sort by score (highest first)
    candidates.sort((a, b) => b.phraseScore - a.phraseScore);

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
