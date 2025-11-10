// romanNumerals.js
// Roman numeral analysis and scale degree utilities

import {
    ALL_NOTES,
    SHARP_NOTES,
    FLAT_NOTES,
    MAJOR_SCALE_STEPS,
    ROMAN_MAP_BASE,
    ENHARMONIC_MAP
} from '../../data/music-data.js';

import { noteToMidi, resolveEnharmonic, getInvertedChordNotes } from './noteUtils.js';

// DEPENDENCIES: These functions reference state variables from music.js
// - enharmonicPreference: 'sharp' or 'flat' preference for note display
// These will need to be passed as parameters or accessed via a state management system

/**
 * Calculate the notes in a major scale for a given key
 * @param {string} key - Key signature (e.g., "C", "G", "Ab")
 * @param {number} octave - Base octave (default 4)
 * @param {number} octaveShift - Octave shift from base octave
 * @returns {Array<string>} Array of note names with octaves in the scale
 * @requires enharmonicPreference - global state variable
 */
export function calculateScaleNotes(key, octave = 4, octaveShift = 0, enharmonicPreference = 'sharp') {
    const baseOctave = octave + octaveShift;
    let scaleRootIndex = ALL_NOTES.indexOf(key);
    if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[key]);

    const scaleRootMidi = noteToMidi(ALL_NOTES[scaleRootIndex] + baseOctave);
    const scaleMidiNotes = MAJOR_SCALE_STEPS.map(step => scaleRootMidi + step);
    const rawNoteNames = scaleMidiNotes.map(midi => Tone.Midi(midi).toNote());
    const resolvedNoteNames = rawNoteNames.map(note => resolveEnharmonic(note, key, enharmonicPreference));

    return resolvedNoteNames;
}

/**
 * Get chord notes for a Roman numeral in a given key
 * @param {string} key - Key signature (e.g., "C", "G", "Ab")
 * @param {string} romanNumeral - Roman numeral (e.g., "I", "ii", "V7") or note name for non-diatonic chords
 * @param {string} selectedType - Chord type from CHORD_DEFINITIONS
 * @param {number} selectedInversion - Inversion number (0 = root position)
 * @param {number} octaveShift - Octave shift from base octave 4
 * @returns {Object|null} Object with roman, name, simpleName, notes, root, type, inversion
 * @requires enharmonicPreference, notationPreference - global state variables
 */
export function getProgressionChordNotes(key, romanNumeral, selectedType, selectedInversion, octaveShift = 0, enharmonicPreference = 'sharp', notationPreference = 'full') {
    let mapEntry = ROMAN_MAP_BASE[romanNumeral];
    let chordRootNote = '';

    // If the roman numeral isn't standard (e.g., it's a note name like 'Db'),
    // we handle it as a non-diatonic chord.
    if (!mapEntry) {
        chordRootNote = romanNumeral; // The 'romanNumeral' is actually the root note.
    } else {
        let scaleRootIndex = ALL_NOTES.indexOf(key);
        if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[key]);

        const scaleStep = MAJOR_SCALE_STEPS[mapEntry.index];
        const chordRootIndex = (scaleRootIndex + scaleStep) % 12;
        chordRootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[chordRootIndex];
    }

    if (!chordRootNote) {
        return null; // Could not determine root note
    }

    const chordResult = getInvertedChordNotes(chordRootNote, selectedType, selectedInversion, key, octaveShift, enharmonicPreference, notationPreference);

    return {
        roman: romanNumeral,
        name: chordResult.name,
        simpleName: chordResult.simpleName,
        notes: chordResult.specificNotes,
        root: chordRootNote,
        type: selectedType,
        inversion: selectedInversion
    };
}

/**
 * Convert a note name to its Roman numeral representation in a given key
 * @param {string} noteName - Note name (e.g., "C", "G", "Ab")
 * @param {string} key - Key signature (e.g., "C", "G", "Ab")
 * @param {string} chordType - Chord type from CHORD_DEFINITIONS
 * @returns {string|null} Roman numeral or null if not in the diatonic scale
 */
export function noteToRomanNumeral(noteName, key, chordType) {
    // Find the scale degree of the note in the given key
    let keyRootIndex = ALL_NOTES.indexOf(key);
    if (keyRootIndex === -1) keyRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[key]);

    let noteIndex = ALL_NOTES.indexOf(noteName);
    if (noteIndex === -1) noteIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[noteName]);

    if (keyRootIndex === -1 || noteIndex === -1) return null;

    // Calculate the interval from the key root
    const interval = (noteIndex - keyRootIndex + 12) % 12;

    // Find the scale degree in the major scale
    const scaleDegreeIndex = MAJOR_SCALE_STEPS.indexOf(interval);
    if (scaleDegreeIndex === -1) return null; // Not in the diatonic scale

    // Find the matching Roman numeral
    const romanKeys = Object.keys(ROMAN_MAP_BASE);
    const foundKey = romanKeys.find(key =>
        ROMAN_MAP_BASE[key].index === scaleDegreeIndex &&
        ROMAN_MAP_BASE[key].quality === chordType
    );

    // Fallback: find by scale degree only if no exact match
    const fallbackKey = romanKeys.find(key =>
        ROMAN_MAP_BASE[key].index === scaleDegreeIndex
    );

    return foundKey || fallbackKey || null;
}

/**
 * Toggle the Roman numeral analysis engine on/off
 * @requires isRomanNumeralEngineOn - global state variable
 * @requires DOM element: #roman-numeral-toggle
 * @returns {boolean} New state of the Roman numeral engine
 */
export function toggleRomanNumeralEngine() {
    const toggle = document.getElementById('roman-numeral-toggle');
    const isRomanNumeralEngineOn = toggle.checked;

    // Update indicator colors
    const offIndicator = document.getElementById('roman-off-indicator');
    const onIndicator = document.getElementById('roman-on-indicator');

    if (isRomanNumeralEngineOn) {
        onIndicator.classList.remove('text-gray-500');
        onIndicator.classList.add('text-indigo-300');
        offIndicator.classList.remove('text-indigo-300');
        offIndicator.classList.add('text-gray-500');
    } else {
        offIndicator.classList.remove('text-gray-500');
        offIndicator.classList.add('text-indigo-300');
        onIndicator.classList.remove('text-indigo-300');
        onIndicator.classList.add('text-gray-500');
    }

    // Note: updateKeyboardLabels should be called after this with the new state
    // The visual state of the toggle is handled by CSS and the checkbox's checked state.

    return isRomanNumeralEngineOn;
}
