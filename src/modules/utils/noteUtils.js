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

// Keys that use flats in their key signature
const FLAT_KEYS = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'];
// Keys that use sharps in their key signature
const SHARP_KEYS = ['G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m'];
// C major and A minor are neutral (no sharps or flats)
const NEUTRAL_KEYS = ['C', 'Am'];

/**
 * Determine the appropriate enharmonic preference (sharp or flat) based on the key
 * @param {string} key - Key signature (e.g., "F", "Bb", "G", "F# Minor")
 * @returns {string} 'sharp' or 'flat'
 */
export function getEnharmonicPreferenceForKey(key) {
    if (!key) return 'sharp';

    // Normalize the key - extract the root and check for major/minor
    const normalizedKey = key.trim();

    // Check for minor keys
    const isMinor = normalizedKey.toLowerCase().includes('minor') ||
                    normalizedKey.toLowerCase().includes('min') ||
                    normalizedKey.endsWith('m');

    // Extract just the root note
    let root = normalizedKey
        .replace(/\s*(major|minor|min|m)$/i, '')
        .replace(/\s+/g, '')
        .trim();

    // Handle enharmonic equivalents - normalize to a consistent form
    const enharmonicRoots = {
        'Db': 'Db', 'C#': 'Db',
        'Eb': 'Eb', 'D#': 'Eb',
        'Gb': 'Gb', 'F#': 'F#',
        'Ab': 'Ab', 'G#': 'Ab',
        'Bb': 'Bb', 'A#': 'Bb'
    };

    // Check if the root itself contains a flat - that's a strong signal
    if (root.includes('b')) {
        return 'flat';
    }

    // For keys with sharps in their name, prefer sharps
    if (root.includes('#')) {
        return 'sharp';
    }

    // Build the full key name to check against our lists
    const fullKey = isMinor ? root + 'm' : root;

    if (FLAT_KEYS.includes(fullKey) || FLAT_KEYS.includes(root)) {
        return 'flat';
    }

    if (SHARP_KEYS.includes(fullKey) || SHARP_KEYS.includes(root)) {
        return 'sharp';
    }

    // Default to flat for neutral keys like C major, A minor
    // Flat spellings (Bb, Eb, Ab) are more common in popular music than sharp equivalents (A#, D#, G#)
    return 'flat';
}

/**
 * Spell a note correctly for a given key
 * Uses the key's enharmonic preference to choose between sharp and flat spellings
 * @param {string} note - Note name (with or without octave, e.g., "C#" or "C#4")
 * @param {string} key - Key signature for context
 * @returns {string} Correctly spelled note for the key
 */
export function spellNoteInKey(note, key) {
    if (!note) return note;

    const preference = getEnharmonicPreferenceForKey(key);

    // Check if note has octave
    const hasOctave = /\d$/.test(note);
    const notePart = hasOctave ? note.slice(0, -1) : note;
    const octavePart = hasOctave ? note.slice(-1) : '';

    // Find the note index
    let noteIndex = ALL_NOTES.indexOf(notePart);
    if (noteIndex === -1) {
        // Try finding via enharmonic map
        const sharpName = ENHARMONIC_MAP[notePart];
        if (sharpName) {
            noteIndex = ALL_NOTES.indexOf(sharpName);
        }
    }

    if (noteIndex === -1) return note; // Can't resolve, return original

    // Get the correctly spelled note based on preference
    const spelledNote = preference === 'flat' ? FLAT_NOTES[noteIndex] : SHARP_NOTES[noteIndex];

    return spelledNote + octavePart;
}

/**
 * Convert a note name with octave to MIDI number
 * @param {string} note - Note name with octave (e.g., "C4")
 * @returns {number} MIDI number
 */
export function noteToMidi(note) {
    if (!note || typeof note !== 'string') {
        console.warn(`Invalid note passed to noteToMidi: ${note}`);
        return NaN;
    }
    try {
        const midi = Tone.Midi(note).toMidi();
        if (isNaN(midi)) {
            console.warn(`noteToMidi returned NaN for note: ${note}`);
        }
        return midi;
    } catch (e) {
        console.warn(`Error converting note to MIDI: ${note}`, e);
        return NaN;
    }
}

/**
 * Resolve enharmonic spelling of a note based on key and preference
 * @param {string} noteWithOctave - Note name with octave (e.g., "C#4")
 * @param {string} key - Key signature for context
 * @returns {string} Resolved note name with octave
 * @requires enharmonicPreference - global state variable
 */
export function resolveEnharmonic(noteWithOctave, key, enharmonicPreference = null) {
    // If no preference provided, derive from key (or default to flat for common spellings)
    if (enharmonicPreference === null) {
        enharmonicPreference = key ? getEnharmonicPreferenceForKey(key) : 'flat';
    }
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
        // In flat mode, we should use FLAT_NOTES for consistency.
        // The key signature determines the spelling, and flat keys use flat spellings.
        // For example, in F major, Bb is spelled as Bb (not A#), even though pitch class 10
        // is in the F major scale.
        noteNoOctave = FLAT_NOTES[noteIndex];
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
 * @param {number} octave - Base octave (default 3 for LH chord voicing)
 * @returns {Object} Object with baseNotes (without octave) and specificNotes (with octave)
 * @requires enharmonicPreference - global state variable
 */
export function getChordNotes(rootNoteName, chordType, key, octave = 3, enharmonicPreference = null) {
    // If no preference provided, derive from key (or default to flat for common spellings)
    if (enharmonicPreference === null) {
        enharmonicPreference = key ? getEnharmonicPreferenceForKey(key) : 'flat';
    }

    const chordDef = CHORD_DEFINITIONS[chordType];
    if (!chordDef) { return { baseNotes: [], specificNotes: [] }; }

    const rootMidi = noteToMidi(`${rootNoteName}${octave}`);

    // Validate rootMidi - if it's NaN or invalid, return empty notes
    if (isNaN(rootMidi) || rootMidi === null || rootMidi === undefined) {
        console.warn(`Invalid root note for chord: ${rootNoteName}${octave}`);
        return { baseNotes: [], specificNotes: [] };
    }

    const noteNameArray = (enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES);

    // Helper function to spell intervals correctly
    const spellInterval = (rootNote, intervalSemitones, enharmonicPref) => {
        // Define expected interval letter distances for common intervals
        const intervalLetterMap = {
            0: 0,   // Root - same letter
            1: 1,   // m2 - one letter up
            2: 1,   // M2 - one letter up
            3: 2,   // m3 - two letters up
            4: 2,   // M3 - two letters up
            5: 3,   // P4 - three letters up
            6: 4,   // d5/A4 - four letters up (tritone)
            7: 4,   // P5 - four letters up
            8: 5,   // m6 - five letters up
            9: 5,   // M6 - five letters up
            10: 6,  // m7 - six letters up
            11: 6,  // M7 - six letters up
            12: 0   // Octave - same letter (next octave)
        };

        const noteLetters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const rootLetter = rootNote.replace(/[#b]/g, '').charAt(0);
        const rootIndex = noteLetters.indexOf(rootLetter);

        if (rootIndex === -1) return null;

        const expectedLetterDistance = intervalLetterMap[intervalSemitones % 12];
        if (expectedLetterDistance === undefined) return null;

        const targetLetterIndex = (rootIndex + expectedLetterDistance) % 7;
        const targetLetter = noteLetters[targetLetterIndex];

        return targetLetter;
    };

    const specificNotes = chordDef.intervals.map((interval, index) => {
        const noteMidi = rootMidi + interval;
        // Validate noteMidi before converting
        if (isNaN(noteMidi) || noteMidi === null || noteMidi === undefined) {
            console.warn(`Invalid MIDI value: ${rootMidi} + ${interval} = ${noteMidi}`);
            return null;
        }

        // Get the expected letter for this interval
        const expectedLetter = spellInterval(rootNoteName, interval, enharmonicPreference);

        // Get raw note from Tone.js (may have wrong enharmonic spelling)
        const rawNote = Tone.Midi(noteMidi).toNote();
        if (!rawNote || typeof rawNote !== 'string') {
            console.warn(`Invalid note from MIDI ${noteMidi}: ${rawNote}`);
            return null;
        }

        let [rawNoteName, noteOctave] = [rawNote.slice(0, -1), parseInt(rawNote.slice(-1))];

        // Validate noteOctave
        if (isNaN(noteOctave) || noteOctave === null || noteOctave === undefined) {
            console.warn(`Invalid octave parsed from note ${rawNote}`);
            return null;
        }

        // If we have an expected letter and it doesn't match, find the correct enharmonic
        let noteName = rawNoteName;
        if (expectedLetter) {
            const rawLetter = rawNoteName.replace(/[#b]/g, '');

            if (rawLetter !== expectedLetter) {
                // Need to find enharmonic equivalent with correct letter
                // Check if we need a sharp or flat
                const pitchClass = noteMidi % 12;

                // Find which note in our preference array matches this pitch class
                const noteInSharpArray = SHARP_NOTES[pitchClass];
                const noteInFlatArray = FLAT_NOTES[pitchClass];

                // Choose the one that starts with the expected letter
                if (noteInSharpArray && noteInSharpArray.charAt(0) === expectedLetter) {
                    noteName = noteInSharpArray;
                } else if (noteInFlatArray && noteInFlatArray.charAt(0) === expectedLetter) {
                    noteName = noteInFlatArray;
                } else {
                    // Neither array has a note with the expected letter at this pitch class
                    // This happens for unusual enharmonics like E#, B#, Cb, Fb
                    // Calculate what accidental is needed
                    const naturalPitchClasses = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 };
                    const expectedNaturalPitch = naturalPitchClasses[expectedLetter];

                    if (expectedNaturalPitch !== undefined) {
                        let diff = pitchClass - expectedNaturalPitch;
                        // Normalize to -6 to +6 range
                        if (diff > 6) diff -= 12;
                        if (diff < -6) diff += 12;

                        if (diff === 1) {
                            noteName = expectedLetter + '#';  // E# for pitch class 5 when expecting E
                        } else if (diff === -1) {
                            noteName = expectedLetter + 'b';  // Cb for pitch class 11 when expecting C
                        } else if (diff === 2) {
                            noteName = expectedLetter + '##'; // Double sharp
                        } else if (diff === -2) {
                            noteName = expectedLetter + 'bb'; // Double flat
                        } else {
                            // Fallback: use enharmonic preference
                            noteName = (enharmonicPreference === 'sharp' ? noteInSharpArray : noteInFlatArray) || rawNoteName;
                        }
                    } else {
                        // Fallback: use enharmonic preference
                        noteName = (enharmonicPreference === 'sharp' ? noteInSharpArray : noteInFlatArray) || rawNoteName;
                    }
                }
            }
        }

        // Handle octave adjustments for enharmonics that cross octave boundaries
        // B#/C boundary: B#3 = C4, so when spelling C as B#, subtract 1 from octave
        // Cb/B boundary: Cb4 = B3, so when spelling B as Cb, add 1 to octave
        // Note: E#/F and Fb/E do NOT cross octave boundaries (E#3 = F3, Fb3 = E3)
        if (noteName === "Cb" && rawNoteName !== "Cb") {
            noteOctave = noteOctave + 1;
        } else if (noteName === "B#" && rawNoteName !== "B#") {
            noteOctave = noteOctave - 1;
        }
        // E# and Fb don't need octave adjustment - they're in the same octave as F and E

        // Final return — this single string is what's used for both playback and highlighting
        return `${noteName}${noteOctave}`;

    }).filter(note => note != null); // Filter out any null values from invalid notes

    const baseNotes = specificNotes.map(n => n.slice(0, -1));
    return { baseNotes, specificNotes };
}

/**
 * Get the notes of an inverted chord
 * @param {string} rootNote - Root note name (e.g., "C")
 * @param {string|Object} chordType - Chord type string or temporary definition object
 * @param {number} inversion - Inversion number (0 = root position)
 * @param {string} key - Key signature for enharmonic resolution
 * @param {number} octaveShift - Octave shift in semitones from base octave 3
 * @returns {Object} Object with name, simpleName, and specificNotes
 * @requires enharmonicPreference, notationPreference - global state variables
 */
export function getInvertedChordNotes(rootNote, chordType, inversion, key, octaveShift = 0, enharmonicPreference = null, notationPreference = 'full') {
    // If no preference provided, derive from key (or default to flat for common spellings)
    if (enharmonicPreference === null) {
        enharmonicPreference = key ? getEnharmonicPreferenceForKey(key) : 'flat';
    }
    // Determine if chordType is a string (e.g., "Major") or a temporary definition object.
    const isStringLookup = typeof chordType === 'string';
    const chordDef = isStringLookup ? CHORD_DEFINITIONS[chordType] : chordType;

    // Convert octaveShift from semitones to octaves (12 semitones = 1 octave)
    // Base octave is 3 (LH chord voicing range), clamp to valid MIDI range (0-8)
    const baseOctave = Math.max(0, Math.min(8, 3 + Math.floor(octaveShift / 12)));
    // Pass the correct definition to getChordNotes
    const baseChord = getChordNotes(rootNote, isStringLookup ? chordType : chordDef, key, baseOctave, enharmonicPreference);

    if (!chordDef || baseChord.specificNotes.length === 0) return { name: "N/A", simpleName: "N/A", specificNotes: [] };

    let invertedNotes = [...baseChord.specificNotes];
    const numNotes = invertedNotes.length;

    if (inversion >= numNotes) inversion = 0;

    for (let i = 0; i < inversion; i++) {
        const noteToShift = invertedNotes.shift();
        if (!noteToShift) {
            console.warn(`No note to shift for inversion ${i} of chord ${rootNote} ${chordType}`);
            break;
        }

        const shiftedMidi = noteToMidi(noteToShift) + 12;
        // Validate shiftedMidi before converting
        if (isNaN(shiftedMidi) || shiftedMidi === null || shiftedMidi === undefined) {
            console.warn(`Invalid MIDI value for shifted note: ${noteToShift} -> ${shiftedMidi}`);
            break;
        }

        // Convert the new MIDI value back to a note name. Tone.js handles the octave correctly.
        const rawShiftedNote = Tone.Midi(shiftedMidi).toNote();
        if (!rawShiftedNote || typeof rawShiftedNote !== 'string') {
            console.warn(`Invalid note from MIDI ${shiftedMidi}: ${rawShiftedNote}`);
            break;
        }

        // Now, resolve its enharmonic spelling based on the key and user preference.
        const resolvedNote = resolveEnharmonic(rawShiftedNote, key, enharmonicPreference);
        if (resolvedNote && typeof resolvedNote === 'string') {
            invertedNotes.push(resolvedNote);
        } else {
            console.warn(`Invalid resolved note: ${resolvedNote} from ${rawShiftedNote}`);
        }
    }

    const simpleName = rootNote + (chordDef.symbol || '');

    let finalChordName;
    if (notationPreference === 'symbol') {
        finalChordName = simpleName;
    } else {
        // Only show chordType name if it was a string lookup
        // Only show inversion label for non-root inversions (inversion > 0)
        const inversionLabel = inversion > 0 ? ` (${INVERSION_NAMES[inversion]})` : '';
        finalChordName = `${rootNote} ${isStringLookup ? chordType : ''}${inversionLabel}`;
    }

    return { name: finalChordName, simpleName: simpleName, specificNotes: invertedNotes };
}

/**
 * Get the notes of an interval
 * @param {string} rootNote - Root note name (e.g., "C")
 * @param {string} intervalType - Interval type from INTERVAL_DEFINITIONS
 * @param {number} octaveShift - Octave shift in semitones from base octave 3
 * @returns {Object} Object with name and specificNotes
 * @requires enharmonicPreference - global state variable
 */
export function getIntervalNotes(rootNote, intervalType, octaveShift = 0, enharmonicPreference = null) {
    // If no preference provided, default to flat for common spellings
    if (enharmonicPreference === null) {
        enharmonicPreference = 'flat';
    }
    const definition = INTERVAL_DEFINITIONS[intervalType];
    if (!definition) return { name: "N/A", specificNotes: [] };

    // Base octave is 3 (LH chord voicing range)
    const baseOctave = 3 + octaveShift;
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
export function getLHNotes(rootNote, lhType, lhInversion = 0, key, lhOctaveShift, rhChordType = 'Major', enharmonicPreference = null) {
    // If no preference provided, derive from key (or default to flat for common spellings)
    if (enharmonicPreference === null) {
        enharmonicPreference = key ? getEnharmonicPreferenceForKey(key) : 'flat';
    }
    if (lhType === 'off') {
        return [];
    }

    // Base octave is 2 for bass accompaniment (one octave below LH chord voicing at octave 3)
    const baseOctave = 2;
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

// ============================================================================
// PITCH/PITCHES STANDARDIZATION HELPERS
// ============================================================================
// ⚠️ IMPORTANT: Use these functions instead of directly accessing note.pitch or note.pitches
// See: docs/pitch-pitches-standardization.md for full documentation

/**
 * Safely get all pitches from a note object
 * Handles both legacy single-note format (note.pitch) and polyphonic format (note.pitches)
 *
 * @param {Object} note - Note object
 * @returns {Array<string>} Array of pitch strings (e.g., ["C4", "E4", "G4"])
 *
 * @example
 * // Single note (legacy format)
 * const note1 = { pitch: 'C4', duration: '4n' };
 * getNotePitches(note1); // ['C4']
 *
 * @example
 * // Chord (polyphonic format)
 * const note2 = { pitches: ['C4', 'E4', 'G4'], duration: '4n' };
 * getNotePitches(note2); // ['C4', 'E4', 'G4']
 */
export function getNotePitches(note) {
  if (!note) return [];

  // Prefer note.pitches (polyphonic format - standard going forward)
  if (note.pitches && Array.isArray(note.pitches) && note.pitches.length > 0) {
    return note.pitches;
  }

  // Fallback to note.pitch (legacy single-note format)
  if (note.pitch && typeof note.pitch === 'string') {
    return [note.pitch];
  }

  // No valid pitch data
  return [];
}

/**
 * Check if a note has any pitch data (single or polyphonic)
 *
 * @param {Object} note - Note object
 * @returns {boolean} True if note has pitch or pitches
 *
 * @example
 * hasPitch({ pitch: 'C4' });           // true
 * hasPitch({ pitches: ['C4', 'E4'] }); // true
 * hasPitch({ type: 'rest' });          // false
 */
export function hasPitch(note) {
  return getNotePitches(note).length > 0;
}

/**
 * Get the primary (first/lowest) pitch from a note
 * Useful for situations that need a single representative pitch (UI display, analysis, etc.)
 *
 * @param {Object} note - Note object
 * @returns {string|null} Pitch string or null if no pitches
 *
 * @example
 * // Single note
 * getPrimaryPitch({ pitch: 'C4' }); // 'C4'
 *
 * @example
 * // Chord - returns lowest pitch
 * getPrimaryPitch({ pitches: ['C4', 'E4', 'G4'] }); // 'C4'
 */
export function getPrimaryPitch(note) {
  const pitches = getNotePitches(note);
  return pitches.length > 0 ? pitches[0] : null;
}

/**
 * Check if a note is polyphonic (has multiple pitches)
 *
 * @param {Object} note - Note object
 * @returns {boolean} True if note has more than one pitch
 *
 * @example
 * isPolyphonic({ pitch: 'C4' });                   // false
 * isPolyphonic({ pitches: ['C4', 'E4', 'G4'] });   // true
 */
export function isPolyphonic(note) {
  return getNotePitches(note).length > 1;
}
