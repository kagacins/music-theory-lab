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
 * Get the properly spelled note name for a scale degree in a given key.
 * This ensures correct enharmonic spelling (e.g., E# instead of F in F# major).
 *
 * @param {string} key - Key signature (e.g., "F#", "Ab", "C")
 * @param {number} scaleDegreeIndex - 0-based scale degree (0=I, 1=II, ..., 6=VII)
 * @returns {string} Properly spelled note name (e.g., "E#", "Bb", "C")
 */
function getScaleDegreeNote(key, scaleDegreeIndex) {
    const noteLetters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

    // Get the key's letter (without accidentals)
    const keyLetter = key.charAt(0).toUpperCase();
    const keyLetterIndex = noteLetters.indexOf(keyLetter);

    if (keyLetterIndex === -1) {
        // Fallback to simple calculation if key letter not found
        return null;
    }

    // The target letter for this scale degree
    const targetLetterIndex = (keyLetterIndex + scaleDegreeIndex) % 7;
    const targetLetter = noteLetters[targetLetterIndex];

    // Calculate what pitch class the scale degree should be
    // First, get the key's pitch class
    let keyPitchClass = ALL_NOTES.indexOf(key);
    if (keyPitchClass === -1) {
        // Try enharmonic equivalent
        keyPitchClass = ALL_NOTES.indexOf(ENHARMONIC_MAP[key]);
    }
    if (keyPitchClass === -1) {
        return null;
    }

    // Get the semitone offset for this scale degree
    const semitoneOffset = MAJOR_SCALE_STEPS[scaleDegreeIndex];
    const targetPitchClass = (keyPitchClass + semitoneOffset) % 12;

    // Now we need to find what accidental makes targetLetter equal targetPitchClass
    // First, find the natural pitch class for targetLetter
    const naturalPitchClasses = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
    const naturalPitch = naturalPitchClasses[targetLetter];

    // Calculate the difference (how many semitones we need to adjust)
    let diff = targetPitchClass - naturalPitch;

    // Normalize diff to be between -6 and +6 (to prefer simpler accidentals)
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;

    // Determine accidental
    let accidental = '';
    if (diff === 0) {
        accidental = '';  // Natural
    } else if (diff === 1) {
        accidental = '#';  // Sharp
    } else if (diff === -1) {
        accidental = 'b';  // Flat
    } else if (diff === 2) {
        accidental = '##';  // Double sharp
    } else if (diff === -2) {
        accidental = 'bb';  // Double flat
    } else {
        // Unusual interval - fall back to simple array lookup
        return null;
    }

    return targetLetter + accidental;
}

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

    // Use proper scale degree spelling for each note
    const scaleNotes = [];
    for (let i = 0; i < 7; i++) {
        const properlySpelledNote = getScaleDegreeNote(key, i);

        if (properlySpelledNote) {
            // Calculate the correct octave for this scale degree
            let noteOctave = baseOctave;

            // Handle octave wrap for notes like B# (same pitch as C but different letter)
            // and Cb (same pitch as B but different letter)
            const keyLetter = key.charAt(0).toUpperCase();
            const noteLetters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
            const keyLetterIndex = noteLetters.indexOf(keyLetter);
            const noteLetterIndex = (keyLetterIndex + i) % 7;

            // If we've wrapped past B to C/D/E..., increment octave
            if (noteLetterIndex < keyLetterIndex && i > 0) {
                noteOctave++;
            }

            // Special handling for B# (sounds like C, written as B#)
            if (properlySpelledNote === 'B#') {
                noteOctave--; // B# in octave 4 sounds like C5
            }
            // Special handling for Cb (sounds like B, written as Cb)
            if (properlySpelledNote === 'Cb') {
                noteOctave++; // Cb in octave 4 sounds like B3
            }

            scaleNotes.push(properlySpelledNote + noteOctave);
        } else {
            // Fallback to old method if proper spelling fails
            let scaleRootIndex = ALL_NOTES.indexOf(key);
            if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[key]);
            const scaleRootMidi = noteToMidi(ALL_NOTES[scaleRootIndex] + baseOctave);
            const noteMidi = scaleRootMidi + MAJOR_SCALE_STEPS[i];
            const rawNote = Tone.Midi(noteMidi).toNote();
            scaleNotes.push(resolveEnharmonic(rawNote, key, enharmonicPreference));
        }
    }

    return scaleNotes;
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
        // Try to get properly spelled scale degree note (handles E#, B#, Cb, Fb, etc.)
        const properlySpelledRoot = getScaleDegreeNote(key, mapEntry.index);

        if (properlySpelledRoot) {
            chordRootNote = properlySpelledRoot;
        } else {
            // Fallback to simple calculation if proper spelling fails
            let scaleRootIndex = ALL_NOTES.indexOf(key);
            if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[key]);

            const scaleStep = MAJOR_SCALE_STEPS[mapEntry.index];
            const chordRootIndex = (scaleRootIndex + scaleStep) % 12;
            chordRootNote = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[chordRootIndex];
        }
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
    let scaleDegreeIndex = MAJOR_SCALE_STEPS.indexOf(interval);
    let chromaticPrefix = '';

    // Handle chromatic/out-of-key notes
    if (scaleDegreeIndex === -1) {
        // Find the closest diatonic degree and determine if it's sharp or flat
        // Major scale intervals: [0, 2, 4, 5, 7, 9, 11]
        // Chromatic intervals that are NOT in major scale: 1, 3, 6, 8, 10
        const chromaticMapping = {
            1: { degree: 1, prefix: '♭' },  // ♭II (e.g., Db in C)
            3: { degree: 2, prefix: '♭' },  // ♭III (e.g., Eb in C) - could also be ♯II
            6: { degree: 3, prefix: '♯' },  // ♯IV (e.g., F# in C) - could also be ♭V
            8: { degree: 4, prefix: '♭' },  // ♭VI (e.g., Ab in C) - could also be ♯V
            10: { degree: 5, prefix: '♭' }  // ♭VII (e.g., Bb in C)
        };

        const mapping = chromaticMapping[interval];
        if (mapping) {
            scaleDegreeIndex = mapping.degree;
            chromaticPrefix = mapping.prefix;
        } else {
            return null; // Should never happen, but safety fallback
        }
    }

    // Find the matching Roman numeral for the base triad quality
    const romanKeys = Object.keys(ROMAN_MAP_BASE);

    // Determine the base quality for finding the roman numeral
    // For extended chords, we need to find the base triad (Major, Minor, Diminished)
    // Sus chords use uppercase roman numerals (like Major)
    let baseQuality = chordType;
    if (chordType.includes('Major') || chordType === 'Dominant 7th' || chordType === 'Add9' ||
        chordType.includes('6th') && !chordType.includes('Minor') ||
        chordType === 'Sus2' || chordType === 'Sus4' || chordType === 'Power Chord') {
        baseQuality = 'Major';
    } else if (chordType.includes('Minor') || chordType === 'Half-Diminished 7th') {
        baseQuality = 'Minor';
    } else if (chordType.includes('Diminished')) {
        baseQuality = 'Diminished';
    } else if (chordType.includes('Augmented')) {
        baseQuality = 'Augmented';
    }

    const foundKey = romanKeys.find(key =>
        ROMAN_MAP_BASE[key].index === scaleDegreeIndex &&
        ROMAN_MAP_BASE[key].quality === baseQuality
    );

    // If no exact match found, DON'T fall back to a different quality.
    // Instead, construct the roman numeral based on the quality we have.
    // This ensures D Major gets "II" not "ii"
    let baseRoman = foundKey;

    if (!baseRoman && scaleDegreeIndex !== -1) {
        // Construct the roman numeral from scale degree and quality
        const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
        const baseNumeral = romanNumerals[scaleDegreeIndex];

        if (baseQuality === 'Major') {
            baseRoman = baseNumeral; // Uppercase for major
        } else if (baseQuality === 'Minor') {
            baseRoman = baseNumeral.toLowerCase(); // Lowercase for minor
        } else if (baseQuality === 'Diminished') {
            baseRoman = baseNumeral.toLowerCase() + '°'; // Lowercase + degree symbol
        } else if (baseQuality === 'Augmented') {
            baseRoman = baseNumeral + '+'; // Uppercase + plus symbol
        }
    }

    if (!baseRoman) return null;

    // Add chord quality suffix for extended chords
    const qualitySuffix = getChordQualitySuffix(chordType, baseRoman);

    // Add chromatic prefix for out-of-key chords (e.g., ♭II, ♯IV)
    return chromaticPrefix + baseRoman + qualitySuffix;
}

/**
 * Get the quality suffix for a chord type to append to roman numeral
 * @param {string} chordType - Chord type from CHORD_DEFINITIONS
 * @param {string} baseRoman - Base roman numeral (e.g., "I", "ii", "V")
 * @returns {string} Quality suffix (e.g., "maj7", "7", "°7", "sus2", "sus4")
 */
function getChordQualitySuffix(chordType, baseRoman) {
    // Sus chords need their suffix
    if (chordType === 'Sus2') {
        return 'sus2';
    }
    if (chordType === 'Sus4') {
        return 'sus4';
    }

    // Basic triads - no suffix needed
    if (['Major', 'Minor', 'Augmented', 'Power Chord'].includes(chordType)) {
        return '';
    }

    // Diminished triad gets ° symbol
    if (chordType === 'Diminished') {
        return '°';
    }

    // 7th chords
    if (chordType === 'Major 7th') {
        return 'maj7';
    }
    if (chordType === 'Dominant 7th') {
        return '7';
    }
    if (chordType === 'Minor 7th') {
        return '7'; // Minor roman (ii, iii, vi) already indicates minor quality
    }
    if (chordType === 'Minor-Major 7th') {
        return 'maj7'; // Minor roman with major 7
    }
    if (chordType === 'Diminished 7th') {
        return '°7';
    }
    if (chordType === 'Half-Diminished 7th') {
        return 'ø7';
    }
    if (chordType === 'Augmented 7th') {
        return '+7';
    }

    // 6th chords
    if (chordType === 'Major 6th' || chordType === 'Minor 6th') {
        return '6';
    }

    // 9th chords
    if (chordType === 'Add9') {
        return 'add9';
    }
    if (chordType === 'Major 9th') {
        return 'maj9';
    }
    if (chordType === 'Dominant 9th') {
        return '9';
    }
    if (chordType === 'Minor 9th') {
        return '9';
    }
    if (chordType === '6/9') {
        return '6/9';
    }

    // 11th and 13th chords
    if (chordType === 'Dominant 11th' || chordType === 'Minor 11th') {
        return '11';
    }
    if (chordType === 'Dominant 13th') {
        return '13';
    }

    // Altered chords
    if (chordType === '7b5') {
        return '7b5';
    }
    if (chordType === '7#5') {
        return '7#5';
    }
    if (chordType === '7b9') {
        return '7b9';
    }
    if (chordType === '7#9') {
        return '7#9';
    }

    return '';
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
