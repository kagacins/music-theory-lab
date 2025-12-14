/**
 * Ear Training Audio Module
 *
 * Audio playback utilities for ear training exercises.
 * Uses Tone.js piano sampler from audioEngine.
 */

import { getPiano, preWarmAudioContext } from '../../audio/audioEngine.js';
import { ALL_NOTES, CHORD_DEFINITIONS, INTERVAL_DEFINITIONS } from '../../../data/music-data.js';

// ===========================================
// CONSTANTS
// ===========================================

// Base octave for exercises (middle register)
const BASE_OCTAVE = 4;

// Timing constants (in seconds)
const NOTE_DURATION = 0.8;
const NOTE_GAP = 0.15;
const CHORD_DURATION = 1.2;
const ARPEGGIO_NOTE_DURATION = 0.4;
const ARPEGGIO_GAP = 0.2;

// ===========================================
// NOTE GENERATION
// ===========================================

/**
 * Get a random root note
 * @param {boolean} includeAccidentals - Whether to include sharps/flats
 * @returns {string} Random note name (e.g., "C", "F#")
 */
export function getRandomRoot(includeAccidentals = true) {
    const notes = includeAccidentals
        ? ALL_NOTES
        : ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    return notes[Math.floor(Math.random() * notes.length)];
}

/**
 * Get a random octave within a reasonable range
 * @param {number} min - Minimum octave (default 3)
 * @param {number} max - Maximum octave (default 5)
 * @returns {number} Random octave
 */
export function getRandomOctave(min = 3, max = 5) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculate interval notes from a root note
 * @param {string} rootNote - Root note with octave (e.g., "C4")
 * @param {number} semitones - Number of semitones for the interval
 * @returns {Object} Object with root and interval note
 */
export function getIntervalFromRoot(rootNote, semitones) {
    const rootMidi = Tone.Midi(rootNote).toMidi();
    const intervalMidi = rootMidi + semitones;
    const intervalNote = Tone.Midi(intervalMidi).toNote();

    return {
        root: rootNote,
        interval: intervalNote,
        semitones
    };
}

/**
 * Get chord notes from a root note and chord type
 * @param {string} rootNote - Root note with octave (e.g., "C4")
 * @param {string} chordType - Chord type from CHORD_DEFINITIONS
 * @returns {Array<string>} Array of note names with octaves
 */
export function getChordNotesFromRoot(rootNote, chordType) {
    const chordDef = CHORD_DEFINITIONS[chordType];
    if (!chordDef) return [rootNote];

    const rootMidi = Tone.Midi(rootNote).toMidi();

    return chordDef.intervals.map(interval => {
        const noteMidi = rootMidi + interval;
        return Tone.Midi(noteMidi).toNote();
    });
}

// ===========================================
// AUDIO PLAYBACK
// ===========================================

/**
 * Play a single note
 * @param {string} note - Note with octave (e.g., "C4")
 * @param {number} duration - Duration in seconds
 * @param {number} delay - Delay before playing in seconds
 * @returns {Promise} Resolves when note finishes
 */
export function playNote(note, duration = NOTE_DURATION, delay = 0) {
    return new Promise((resolve) => {
        preWarmAudioContext();
        const piano = getPiano();
        if (!piano) {
            console.warn('[EarTrainingAudio] Piano not initialized');
            resolve();
            return;
        }

        const now = Tone.now();
        piano.triggerAttackRelease(note, duration, now + delay);

        setTimeout(() => {
            resolve();
        }, (delay + duration) * 1000);
    });
}

/**
 * Play an interval (two notes in sequence)
 * @param {string} note1 - First note with octave
 * @param {string} note2 - Second note with octave
 * @param {boolean} ascending - Whether to play ascending (default true)
 * @returns {Promise} Resolves when interval finishes
 */
export async function playInterval(note1, note2, ascending = true) {
    preWarmAudioContext();
    const piano = getPiano();
    if (!piano) {
        console.warn('[EarTrainingAudio] Piano not initialized');
        return;
    }

    const [first, second] = ascending ? [note1, note2] : [note2, note1];

    const now = Tone.now();

    // Play first note
    piano.triggerAttackRelease(first, NOTE_DURATION, now);

    // Play second note after a gap
    piano.triggerAttackRelease(second, NOTE_DURATION, now + NOTE_DURATION + NOTE_GAP);

    // Wait for both notes to finish
    return new Promise(resolve => {
        setTimeout(resolve, (NOTE_DURATION * 2 + NOTE_GAP) * 1000);
    });
}

/**
 * Play an interval harmonically (both notes together)
 * @param {string} note1 - First note with octave
 * @param {string} note2 - Second note with octave
 * @returns {Promise} Resolves when interval finishes
 */
export async function playIntervalHarmonic(note1, note2) {
    preWarmAudioContext();
    const piano = getPiano();
    if (!piano) {
        console.warn('[EarTrainingAudio] Piano not initialized');
        return;
    }

    const now = Tone.now();

    // Play both notes together
    piano.triggerAttackRelease(note1, CHORD_DURATION, now);
    piano.triggerAttackRelease(note2, CHORD_DURATION, now);

    return new Promise(resolve => {
        setTimeout(resolve, CHORD_DURATION * 1000);
    });
}

/**
 * Play a chord (all notes together)
 * @param {Array<string>} notes - Array of notes with octaves
 * @param {number} duration - Duration in seconds
 * @returns {Promise} Resolves when chord finishes
 */
export async function playChord(notes, duration = CHORD_DURATION) {
    preWarmAudioContext();
    const piano = getPiano();
    if (!piano) {
        console.warn('[EarTrainingAudio] Piano not initialized');
        return;
    }

    const now = Tone.now();

    // Play all notes together
    notes.forEach(note => {
        piano.triggerAttackRelease(note, duration, now);
    });

    return new Promise(resolve => {
        setTimeout(resolve, duration * 1000);
    });
}

/**
 * Play a chord as an arpeggio (notes in sequence)
 * @param {Array<string>} notes - Array of notes with octaves
 * @param {boolean} ascending - Whether to play ascending (default true)
 * @returns {Promise} Resolves when arpeggio finishes
 */
export async function playArpeggio(notes, ascending = true) {
    preWarmAudioContext();
    const piano = getPiano();
    if (!piano) {
        console.warn('[EarTrainingAudio] Piano not initialized');
        return;
    }

    const orderedNotes = ascending ? [...notes] : [...notes].reverse();
    const now = Tone.now();

    orderedNotes.forEach((note, index) => {
        const startTime = now + index * (ARPEGGIO_NOTE_DURATION + ARPEGGIO_GAP);
        piano.triggerAttackRelease(note, ARPEGGIO_NOTE_DURATION, startTime);
    });

    const totalDuration = orderedNotes.length * (ARPEGGIO_NOTE_DURATION + ARPEGGIO_GAP);

    return new Promise(resolve => {
        setTimeout(resolve, totalDuration * 1000);
    });
}

/**
 * Play a chord progression
 * @param {Array<Array<string>>} chords - Array of chord note arrays
 * @param {number} chordDuration - Duration per chord in seconds
 * @returns {Promise} Resolves when progression finishes
 */
export async function playProgression(chords, chordDuration = 1.0) {
    preWarmAudioContext();
    const piano = getPiano();
    if (!piano) {
        console.warn('[EarTrainingAudio] Piano not initialized');
        return;
    }

    const gap = 0.1;
    const now = Tone.now();

    chords.forEach((chordNotes, chordIndex) => {
        const chordStartTime = now + chordIndex * (chordDuration + gap);
        chordNotes.forEach(note => {
            piano.triggerAttackRelease(note, chordDuration, chordStartTime);
        });
    });

    const totalDuration = chords.length * (chordDuration + gap);

    return new Promise(resolve => {
        setTimeout(resolve, totalDuration * 1000);
    });
}

/**
 * Play a melody (sequence of single notes)
 * @param {Array<string>} notes - Array of notes with octaves
 * @param {number} noteDuration - Duration per note in seconds
 * @returns {Promise} Resolves when melody finishes
 */
export async function playMelody(notes, noteDuration = 0.5) {
    preWarmAudioContext();
    const piano = getPiano();
    if (!piano) {
        console.warn('[EarTrainingAudio] Piano not initialized');
        return;
    }

    const gap = 0.05;
    const now = Tone.now();

    notes.forEach((note, index) => {
        const startTime = now + index * (noteDuration + gap);
        piano.triggerAttackRelease(note, noteDuration, startTime);
    });

    const totalDuration = notes.length * (noteDuration + gap);

    return new Promise(resolve => {
        setTimeout(resolve, totalDuration * 1000);
    });
}

// ===========================================
// EXERCISE GENERATORS
// ===========================================

/**
 * Generate a random interval exercise
 * @param {number} difficulty - Difficulty level 1-5
 * @returns {Object} Exercise data with answer and notes
 */
export function generateIntervalExercise(difficulty = 1) {
    // Define intervals for each difficulty level
    const intervalsByDifficulty = {
        1: ['Perfect 4th', 'Perfect 5th', 'Octave'],  // Perfect intervals only
        2: ['Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Perfect 5th'],
        3: ['Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th'],
        4: Object.keys(INTERVAL_DEFINITIONS).filter(i => !i.includes('9th')),  // All except compound
        5: Object.keys(INTERVAL_DEFINITIONS)  // All including compound
    };

    const availableIntervals = intervalsByDifficulty[difficulty] || intervalsByDifficulty[1];
    const intervalName = availableIntervals[Math.floor(Math.random() * availableIntervals.length)];
    const intervalDef = INTERVAL_DEFINITIONS[intervalName];

    if (!intervalDef) {
        console.error('[EarTrainingAudio] Invalid interval:', intervalName);
        return generateIntervalExercise(1);
    }

    const semitones = intervalDef.intervals[1] || 0;

    // Generate root note
    const rootNote = getRandomRoot(difficulty >= 2);
    const octave = getRandomOctave(3, 4);
    const rootWithOctave = `${rootNote}${octave}`;

    // Calculate interval note
    const { interval: intervalNote } = getIntervalFromRoot(rootWithOctave, semitones);

    // Randomly decide ascending or descending
    const ascending = Math.random() > 0.3;  // 70% ascending

    return {
        type: 'interval',
        answer: intervalName,
        rootNote: rootWithOctave,
        intervalNote,
        semitones,
        ascending,
        options: availableIntervals,
        difficulty
    };
}

/**
 * Generate a random chord quality exercise
 * @param {number} difficulty - Difficulty level 1-5
 * @returns {Object} Exercise data with answer and notes
 */
export function generateChordExercise(difficulty = 1) {
    // Define chord types for each difficulty level
    const chordsByDifficulty = {
        1: ['Major', 'Minor'],  // Just major/minor
        2: ['Major', 'Minor', 'Diminished', 'Augmented'],  // Add dim/aug
        3: ['Major', 'Minor', 'Diminished', 'Augmented', 'Dominant 7th', 'Major 7th', 'Minor 7th'],
        4: ['Major', 'Minor', 'Diminished', 'Augmented', 'Dominant 7th', 'Major 7th', 'Minor 7th', 'Diminished 7th', 'Half-Diminished 7th', 'Sus2', 'Sus4'],
        5: ['Major', 'Minor', 'Diminished', 'Augmented', 'Dominant 7th', 'Major 7th', 'Minor 7th', 'Diminished 7th', 'Half-Diminished 7th', 'Sus2', 'Sus4', 'Dominant 9th', 'Major 9th', 'Minor 9th']
    };

    const availableChords = chordsByDifficulty[difficulty] || chordsByDifficulty[1];
    const chordType = availableChords[Math.floor(Math.random() * availableChords.length)];

    // Generate root note
    const rootNote = getRandomRoot(difficulty >= 2);
    const octave = getRandomOctave(3, 4);
    const rootWithOctave = `${rootNote}${octave}`;

    // Get chord notes
    const notes = getChordNotesFromRoot(rootWithOctave, chordType);

    // Randomly decide block or arpeggio
    const playAsArpeggio = Math.random() > 0.5;

    return {
        type: 'chord',
        answer: chordType,
        rootNote: rootWithOctave,
        rootName: rootNote,
        notes,
        playAsArpeggio,
        options: availableChords,
        difficulty
    };
}

/**
 * Generate a chord tone exercise
 * @param {number} difficulty - Difficulty level 1-5
 * @returns {Object} Exercise data with chord and target note
 */
export function generateChordToneExercise(difficulty = 1) {
    // Use simpler chords for chord tone exercises
    const chordTypes = difficulty >= 3
        ? ['Major', 'Minor', 'Dominant 7th', 'Major 7th', 'Minor 7th']
        : ['Major', 'Minor'];

    const chordType = chordTypes[Math.floor(Math.random() * chordTypes.length)];
    const chordDef = CHORD_DEFINITIONS[chordType];

    // Generate root note
    const rootNote = getRandomRoot(difficulty >= 2);
    const octave = 4;
    const rootWithOctave = `${rootNote}${octave}`;

    // Get chord notes
    const chordNotes = getChordNotesFromRoot(rootWithOctave, chordType);

    // Generate target note - either in chord or not
    const isInChord = Math.random() > 0.4;  // 60% chance in chord

    let targetNote;
    let targetIndex;

    if (isInChord) {
        targetIndex = Math.floor(Math.random() * chordNotes.length);
        targetNote = chordNotes[targetIndex];
    } else {
        // Pick a note not in the chord
        const rootMidi = Tone.Midi(rootWithOctave).toMidi();
        const chordMidiNotes = chordNotes.map(n => Tone.Midi(n).toMidi() % 12);
        let attempts = 0;

        do {
            const randomOffset = Math.floor(Math.random() * 12);
            const testMidi = rootMidi + randomOffset;
            if (!chordMidiNotes.includes(testMidi % 12)) {
                targetNote = Tone.Midi(testMidi).toNote();
                break;
            }
            attempts++;
        } while (attempts < 20);

        targetIndex = -1;
    }

    // Define tone names based on difficulty
    const toneNames = ['Root', '3rd', '5th'];
    if (chordDef.intervals.length > 3) {
        toneNames.push('7th');
    }
    if (chordDef.intervals.length > 4) {
        toneNames.push('9th');
    }

    return {
        type: 'chordTone',
        answer: isInChord ? toneNames[targetIndex] : 'Not in chord',
        isInChord,
        targetNote,
        targetIndex,
        chordType,
        chordNotes,
        rootNote: rootWithOctave,
        options: difficulty >= 3 ? [...toneNames, 'Not in chord'] : ['In chord', 'Not in chord'],
        difficulty
    };
}

export default {
    getRandomRoot,
    getRandomOctave,
    getIntervalFromRoot,
    getChordNotesFromRoot,
    playNote,
    playInterval,
    playIntervalHarmonic,
    playChord,
    playArpeggio,
    playProgression,
    playMelody,
    generateIntervalExercise,
    generateChordExercise,
    generateChordToneExercise
};
