// noteUtils.js
// Utility functions for note and chord calculations

import {
    ALL_NOTES,
    SHARP_NOTES,
    FLAT_NOTES,
    MAJOR_SCALE_STEPS,
    CHORD_DEFINITIONS,
    INTERVAL_DEFINITIONS,
    INVERSION_NAMES,
    ENHARMONIC_MAP
} from '../../data/music-data.js';

// DEPENDENCIES: These functions reference state variables from music.js
// - enharmonicPreference: 'sharp' or 'flat' preference for note display
// - notationPreference: 'full' or 'symbol' for chord name display
// These will need to be passed as parameters or accessed via a state management system

/**
 * Convert a note name with octave to MIDI number
 * @param {string} note - Note name with octave (e.g., "C4")
 * @returns {number} MIDI number
 */
export function noteToMidi(note) {
    return Tone.Midi(note).toMidi();
}

/**
 * Resolve enharmonic spelling of a note based on key and preference
 * @param {string} noteWithOctave - Note name with octave (e.g., "C#4")
 * @param {string} key - Key signature for context
 * @returns {string} Resolved note name with octave
 * @requires enharmonicPreference - global state variable
 */
export function resolveEnharmonic(noteWithOctave, key, enharmonicPreference = 'sharp') {
    let noteNoOctave = noteWithOctave.slice(0, -1);
    const octave = noteWithOctave.slice(-1);

    let noteIndex = ALL_NOTES.indexOf(noteNoOctave);
    if (noteIndex === -1) {
        const sharpName = ENHARMONIC_MAP[noteNoOctave];
        noteIndex = ALL_NOTES.indexOf(sharpName);
    }
    if (noteIndex === -1) return noteWithOctave;

    if (enharmonicPreference === 'sharp') {
        noteNoOctave = SHARP_NOTES[noteIndex];
    } else { // 'flat'
        // In flat mode, we need to decide whether to show a sharp or a flat.
        // The rule is: if the note is part of the key's major scale, use the key's natural spelling.
        // Otherwise, prefer the flat name.
        const keyRootName = ENHARMONIC_MAP[key] || key;
        const keyRootIndex = ALL_NOTES.indexOf(keyRootName);

        if (keyRootIndex !== -1) {
            const scaleNoteIndices = MAJOR_SCALE_STEPS.map(step => (keyRootIndex + step) % 12);

            // If the note's sharp name is in the scale, use the sharp name.
            // This handles cases like G in Ab major.
            if (scaleNoteIndices.includes(noteIndex)) {
                 noteNoOctave = SHARP_NOTES[noteIndex];
            } else {
                // Otherwise, it's a chromatic note, prefer the flat name.
                // This handles cases like the minor 3rd of Ab (Cb).
                noteNoOctave = FLAT_NOTES[noteIndex];
            }
        } else {
            // Fallback for keys not in our map (shouldn't happen with builder)
            noteNoOctave = FLAT_NOTES[noteIndex];
        }
    }

    return noteNoOctave + octave;
}

/**
 * Get the DOM key ID for a note
 * @param {string} note - Note name with octave (e.g., "C4")
 * @returns {string} DOM element ID
 */
export function getNoteKeyId(note) {
    let noteName = note.slice(0, -1);
    const octave = note.slice(-1);
    if (noteName.includes('b')) {
        noteName = ENHARMONIC_MAP[noteName] || noteName;
    }
    return `key-${noteName.replace('#', 's')}${octave}`;
}

/**
 * Get the notes of a chord
 * @param {string} rootNoteName - Root note name (e.g., "C")
 * @param {string} chordType - Chord type from CHORD_DEFINITIONS
 * @param {string} key - Key signature for enharmonic resolution
 * @param {number} octave - Base octave (default 4)
 * @returns {Object} Object with baseNotes (without octave) and specificNotes (with octave)
 * @requires enharmonicPreference - global state variable
 */
export function getChordNotes(rootNoteName, chordType, key, octave = 4, enharmonicPreference = 'sharp') {
    const chordDef = CHORD_DEFINITIONS[chordType];
    if (!chordDef) { return { baseNotes: [], specificNotes: [] }; }

    const rootMidi = noteToMidi(`${rootNoteName}${octave}`);
    const noteNameArray = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES);

    const specificNotes = chordDef.intervals.map(interval => {
    const noteMidi = rootMidi + interval;
    const rawNote = Tone.Midi(noteMidi).toNote();
    let [noteName, noteOctave] = [rawNote.slice(0, -1), parseInt(rawNote.slice(-1))];

    // Fix enharmonic spellings (Cb, Fb, B#, E#)
    if (noteName === "Cb") {
        noteName = "Cb";
        noteOctave += 1;
    } else if (noteName === "Fb") {
        noteName = "Fb";
        noteOctave += 1;
    } else if (noteName === "B#") {
        noteName = "B#";
        noteOctave -= 1;
    } else if (noteName === "E#") {
        noteName = "E#";
        noteOctave -= 1;
    }

    // Final return — this single string is what's used for both playback and highlighting
    return `${noteName}${noteOctave}`;

    });

    const baseNotes = specificNotes.map(n => n.slice(0, -1));
    return { baseNotes, specificNotes };
}

/**
 * Get the notes of an inverted chord
 * @param {string} rootNote - Root note name (e.g., "C")
 * @param {string|Object} chordType - Chord type string or temporary definition object
 * @param {number} inversion - Inversion number (0 = root position)
 * @param {string} key - Key signature for enharmonic resolution
 * @param {number} octaveShift - Octave shift from base octave 4
 * @returns {Object} Object with name, simpleName, and specificNotes
 * @requires enharmonicPreference, notationPreference - global state variables
 */
export function getInvertedChordNotes(rootNote, chordType, inversion, key, octaveShift = 0, enharmonicPreference = 'sharp', notationPreference = 'full') {
    // Determine if chordType is a string (e.g., "Major") or a temporary definition object.
    const isStringLookup = typeof chordType === 'string';
    const chordDef = isStringLookup ? CHORD_DEFINITIONS[chordType] : chordType;

    const baseOctave = 4 + octaveShift;
    // Pass the correct definition to getChordNotes
    const baseChord = getChordNotes(rootNote, isStringLookup ? chordType : chordDef, key, baseOctave, enharmonicPreference);

    if (!chordDef || baseChord.specificNotes.length === 0) return { name: "N/A", simpleName: "N/A", specificNotes: [] };

    let invertedNotes = [...baseChord.specificNotes];
    const numNotes = invertedNotes.length;

    if (inversion >= numNotes) inversion = 0;

    for (let i = 0; i < inversion; i++) {
        const noteToShift = invertedNotes.shift();
        const shiftedMidi = noteToMidi(noteToShift) + 12;
        // Convert the new MIDI value back to a note name. Tone.js handles the octave correctly.
        const rawShiftedNote = Tone.Midi(shiftedMidi).toNote();
        // Now, resolve its enharmonic spelling based on the key and user preference.
        invertedNotes.push(resolveEnharmonic(rawShiftedNote, key, enharmonicPreference));
    }

    const simpleName = rootNote + (chordDef.symbol || '');

    let finalChordName;
    if (notationPreference === 'symbol') {
        finalChordName = simpleName;
    } else {
        // Only show chordType name if it was a string lookup
        finalChordName = `${rootNote} ${isStringLookup ? chordType : ''} (${INVERSION_NAMES[inversion]})`;
    }

    return { name: finalChordName, simpleName: simpleName, specificNotes: invertedNotes };
}

/**
 * Get the notes of an interval
 * @param {string} rootNote - Root note name (e.g., "C")
 * @param {string} intervalType - Interval type from INTERVAL_DEFINITIONS
 * @param {number} octaveShift - Octave shift from base octave 4
 * @returns {Object} Object with name and specificNotes
 * @requires enharmonicPreference - global state variable
 */
export function getIntervalNotes(rootNote, intervalType, octaveShift = 0, enharmonicPreference = 'sharp') {
    const definition = INTERVAL_DEFINITIONS[intervalType];
    if (!definition) return { name: "N/A", specificNotes: [] };

    const baseOctave = 4 + octaveShift;
    const rootMidi = noteToMidi(`${rootNote}${baseOctave}`);

    const specificNotes = definition.intervals.map(interval => {
        const noteMidi = rootMidi + interval;
        const rawNote = Tone.Midi(noteMidi).toNote();
        return resolveEnharmonic(rawNote, rootNote, enharmonicPreference);
    });

    return { name: `${rootNote} ${intervalType}`, specificNotes: specificNotes };
}

/**
 * Get left hand (bass) notes for accompaniment
 * @param {string} rootNote - Root note name (e.g., "C")
 * @param {string} lhType - Left hand type (e.g., 'rootOnly', 'rootAnd5th', etc.)
 * @param {number} lhInversion - Left hand inversion (default 0)
 * @param {string} key - Key signature for enharmonic resolution
 * @param {number} lhOctaveShift - Octave shift for left hand
 * @param {string} rhChordType - Right hand chord type (used for 'spread' voicing)
 * @returns {Array<string>} Array of note names with octaves
 * @requires enharmonicPreference - global state variable
 */
export function getLHNotes(rootNote, lhType, lhInversion = 0, key, lhOctaveShift, rhChordType = 'Major', enharmonicPreference = 'sharp') {
    if (lhType === 'off') {
        return [];
    }

    const baseOctave = 4; // A consistent starting point for calculation.
    const rootMidi = noteToMidi(`${rootNote}${baseOctave}`) + lhOctaveShift;

    let intervals = [];

    if (lhType === 'rootOnly') {
        intervals = [0];
    } else if (lhType === 'rootAnd5th') {
        intervals = [0, 7];
    } else if (lhType === 'powerChord') {
        intervals = [0, 7, 12];
    } else if (lhType === 'Major') {
        intervals = [...CHORD_DEFINITIONS['Major'].intervals]; // Create a copy
    } else if (lhType === 'Minor') {
        intervals = [...CHORD_DEFINITIONS['Minor'].intervals]; // Create a copy
    } else if (lhType === 'shell_maj7') {
        intervals = [0, 4, 11]; // Root, Major 3rd, Major 7th
    } else if (lhType === 'shell_min7') {
        intervals = [0, 3, 10]; // Root, Minor 3rd, Minor 7th
    } else if (lhType === 'shell_dom7') {
        intervals = [0, 4, 10]; // Root, Major 3rd, Minor 7th
    } else if (lhType === 'Dominant 7th') {
        intervals = [...CHORD_DEFINITIONS['Dominant 7th'].intervals]; // Create a copy
    } else if (lhType === 'spread') {
        // Determine if the RH chord is major or minor to select the correct 10th
        const isMinor = rhChordType.includes('Minor') || rhChordType.includes('Diminished');
        const tenth = isMinor ? 3 + 12 : 4 + 12; // Minor 10th (m3 + octave) or Major 10th (M3 + octave)
        intervals = [0, 7, tenth]; // R-5-10
    } else if (lhType === 'quartal') {
        intervals = [0, 5, 10]; // R-4-b7
    } else if (lhType === 'spread_maj') {
        intervals = [0, 7, 16]; // R-5-10 (Major)
    }

    // Apply inversion to the intervals array before calculating notes
    for (let i = 0; i < lhInversion; i++) {
        if (intervals.length > 0) {
            const firstInterval = intervals.shift();
            intervals.push(firstInterval + 12);
        }
    }

    // Calculate final note names from the intervals
    const notes = intervals.map(interval => {
        const noteMidi = rootMidi + interval;
        return resolveEnharmonic(Tone.Midi(noteMidi).toNote(), key, enharmonicPreference);
    });

    return notes;
}
