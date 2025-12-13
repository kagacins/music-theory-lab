/**
 * Bass Auto-Fill Module
 *
 * Automatically generates bass clef voicings from chord progressions
 * with intelligent voice leading and rhythm patterns.
 *
 * Based on Phase 1.2 of progression-builder-integration.md
 */

import { getBeatsPerMeasureFromTimeSignature } from '../state/compositionState.js';

// Intervals for different chord types (in semitones from root)
// Includes both canonical names (with spaces) and common aliases
const CHORD_INTERVALS = {
    'Major': [0, 4, 7],
    'Minor': [0, 3, 7],
    'Diminished': [0, 3, 6],
    'Augmented': [0, 4, 8],
    'Major 7th': [0, 4, 7, 11],
    'Major7': [0, 4, 7, 11],
    'Minor 7th': [0, 3, 7, 10],
    'Minor7': [0, 3, 7, 10],
    'Dominant 7th': [0, 4, 7, 10],
    'Dominant7': [0, 4, 7, 10],
    'Diminished 7th': [0, 3, 6, 9],
    'Diminished7': [0, 3, 6, 9],
    'Half-Diminished 7th': [0, 3, 6, 10],
    'HalfDiminished7': [0, 3, 6, 10],
    'Sus2': [0, 2, 7],
    'Sus4': [0, 5, 7],
    'Add9': [0, 4, 7, 14],
    'Major 6th': [0, 4, 7, 9],
    'Major6': [0, 4, 7, 9],
    'Minor 6th': [0, 3, 7, 9],
    'Minor6': [0, 3, 7, 9],
    'Major 9th': [0, 4, 7, 11, 14],
    'Major9': [0, 4, 7, 11, 14],
    'Minor 9th': [0, 3, 7, 10, 14],
    'Minor9': [0, 3, 7, 10, 14],
    'Dominant 9th': [0, 4, 7, 10, 14],
    'Dominant9': [0, 4, 7, 10, 14]
};

/**
 * Get chord intervals with robust fallback handling
 */
function getChordIntervalsRobust(chordType) {
    let intervals = CHORD_INTERVALS[chordType];

    if (!intervals && chordType) {
        const type = chordType.toLowerCase();
        if (type === 'm' || type === 'min' || (type.includes('minor') && !type.includes('7'))) {
            intervals = CHORD_INTERVALS['Minor'];
        } else if (type === 'm7' || type === 'min7' || type.includes('minor 7')) {
            intervals = CHORD_INTERVALS['Minor 7th'];
        } else if (type === 'maj7' || type.includes('major 7')) {
            intervals = CHORD_INTERVALS['Major 7th'];
        } else if (type === '7' || type.includes('dominant 7')) {
            intervals = CHORD_INTERVALS['Dominant 7th'];
        } else if (type === 'dim' || (type.includes('diminish') && !type.includes('7'))) {
            intervals = CHORD_INTERVALS['Diminished'];
        } else if (type === 'dim7' || type.includes('diminished 7')) {
            intervals = CHORD_INTERVALS['Diminished 7th'];
        } else if (type === 'm7b5' || type.includes('half-dim') || type.includes('half dim')) {
            intervals = CHORD_INTERVALS['Half-Diminished 7th'];
        } else if (type === 'aug' || type === '+' || type.includes('augment')) {
            intervals = CHORD_INTERVALS['Augmented'];
        }
    }

    if (!intervals) {
        console.warn(`[bassAutoFill] Unknown chord type "${chordType}", falling back to Major`);
        intervals = CHORD_INTERVALS['Major'];
    }

    return intervals;
}

// Note names for calculation
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Default octave for each bass pattern
 * Octave 2: Traditional low bass register (upright bass, stride left hand)
 * Octave 3: Higher, clearer register (classical accompaniment, lighter styles)
 *
 * These are defaults - users can override via the octave selector
 */
export const BASS_PATTERN_OCTAVE_DEFAULTS = {
    // Octave 2 - Low bass register (traditional bass patterns)
    'whole-note': 2,
    'root-fifth': 2,
    'walking': 2,
    'stride': 2,           // Needs low "oom" for stride effect
    'boogie': 2,           // Boogie-woogie needs that low rumble
    'driving-rock': 2,
    'motown': 2,
    'country': 2,
    'pedal': 2,
    'power-chord': 2,
    'rock-power': 2,
    'open-fifth': 2,
    'half-time': 2,
    'reggae': 2,           // One-drop bass is typically low
    'disco-octave': 2,     // Disco bass is funky but low
    'funk': 2,
    'staccato': 2,
    'call-response': 2,

    // Octave 3 - Higher, clearer register
    'alberti': 3,          // Classical Alberti is mid-register (Mozart, etc.)
    'arpeggio': 3,         // Arpeggios often clearer in higher register
    'bossa-nova': 3,       // Bossa guitar/piano bass is often mid-register
    'shell-voicing': 3,    // Jazz shells need clarity
    'ballad': 3,           // Ballad accompaniment is lighter
    'bebop': 3,            // Bebop lines need articulation clarity

    // Octave 2 but could go either way
    'broken-octave': 2,    // Starts at 2, alternates to 3
    'octave-doubling': 2,  // Base is 2, doubles at 3
    'syncopated': 2,
    'dotted-rhythm': 2,
    'anticipation': 2,
    'shuffle': 2,
    'chromatic-approach': 2,
    'scalar-walk': 2,
    'tango': 2,
    'montuno': 2,
    'tenths': 2,
    'gospel': 2
};

/**
 * Get the default octave for a bass pattern
 * @param {string} pattern - Bass pattern name
 * @returns {number} Default octave (2 or 3)
 */
export function getDefaultOctaveForPattern(pattern) {
    return BASS_PATTERN_OCTAVE_DEFAULTS[pattern] ?? 2;
}

const NOTE_TO_SEMITONE = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'Fb': 4,
    'F': 5, 'E#': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11, 'Cb': 11
};

/**
 * Get the bass note based on chord inversion and bassFollowsInversion setting
 * @param {object} chord - Chord data { root, type, inversion }
 * @param {boolean} bassFollowsInversion - Whether bass should follow inversion
 * @param {number} octave - Bass octave (default: 2)
 * @returns {string} Bass note with octave (e.g., 'C2', 'E2', 'G2')
 */
function getBassNoteForChord(chord, bassFollowsInversion, octave = 2) {
    // If not following inversion, always return root
    if (!bassFollowsInversion || !chord.inversion || chord.inversion === 0) {
        return `${chord.root}${octave}`;
    }

    // Get intervals for this chord type
    const intervals = getChordIntervalsRobust(chord.type);

    // Get the interval index for this inversion (clamped to available intervals)
    const inversionIndex = Math.min(chord.inversion, intervals.length - 1);
    const semitones = intervals[inversionIndex];

    // Calculate the bass note
    const rootSemitone = NOTE_TO_SEMITONE[chord.root];
    if (rootSemitone === undefined) {
        return `${chord.root}${octave}`; // Fallback to root if unknown note
    }

    const bassNoteSemitone = (rootSemitone + semitones) % 12;
    const bassNoteName = NOTE_NAMES[bassNoteSemitone];

    return `${bassNoteName}${octave}`;
}

/**
 * Convert note name to MIDI number (standalone implementation)
 * @param {string} note - Note name with octave (e.g., 'C4', 'D#3')
 * @returns {number} MIDI number (0-127)
 */
function noteToMidi(note) {
    // Try to use Tone.js if available (for compatibility with existing code)
    if (typeof Tone !== 'undefined' && Tone.Midi) {
        return Tone.Midi(note).toMidi();
    }

    // Fallback: standalone implementation
    const noteMap = {
        'C': 0, 'C#': 1, 'Db': 1,
        'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4,
        'F': 5, 'F#': 6, 'Gb': 6,
        'G': 7, 'G#': 8, 'Ab': 8,
        'A': 9, 'A#': 10, 'Bb': 10,
        'B': 11
    };

    // Extract note name and octave
    const match = note.match(/^([A-G][#b]?)(-?\d+)$/);
    if (!match) {
        console.warn('Invalid note format:', note);
        return 60; // Default to middle C
    }

    const noteName = match[1];
    const octave = parseInt(match[2]);

    const noteOffset = noteMap[noteName];
    if (noteOffset === undefined) {
        console.warn('Unknown note name:', noteName);
        return 60;
    }

    // MIDI number formula: (octave + 1) * 12 + noteOffset
    return (octave + 1) * 12 + noteOffset;
}

/**
 * Generate bass voicing for a chord with voice leading
 * @param {object} chord - Chord data { root, type, inversion, notes }
 * @param {object|null} previousChord - Previous chord for voice leading
 * @param {object} options - Generation options
 * @returns {object} Bass voicing { notes: [...] }
 */
export function generateBassVoicing(chord, previousChord = null, options = {}) {
    const {
        voiceLeadingStrict = true,
        bassPattern = 'root-fifth',
        timeSignature = { num: 4, denom: 4 },
        style = 'classical',
        beatsInMeasure = 4, // New: how many beats this chord occupies in this measure
        isChordContinuation = false, // New: is this a tied continuation from previous measure?
        bassFollowsInversion = false // New: whether bass should follow chord inversion
    } = options;

    if (!chord || !chord.root) {
        return { notes: [] };
    }

    // Get chord notes in bass register
    const chordNotes = getChordNotesInBassRegister(chord);

    // If this is a chord continuation (tied from previous measure),
    // generate a simple tied whole note (or fill the available beats)
    if (isChordContinuation) {
        return generateTiedBass(chord, chordNotes, beatsInMeasure, bassFollowsInversion);
    }

    // First chord: use root position
    if (!previousChord || !previousChord.root) {
        return generateFirstChordBass(chord, chordNotes, bassPattern, timeSignature, beatsInMeasure, bassFollowsInversion);
    }

    // Subsequent chords: use voice leading
    if (voiceLeadingStrict) {
        return generateVoiceLedBass(chord, chordNotes, previousChord, bassPattern, timeSignature, beatsInMeasure, bassFollowsInversion);
    }

    // Fallback: simple root note
    return generateSimpleBass(chord, chordNotes, bassPattern, timeSignature, beatsInMeasure, bassFollowsInversion);
}

/**
 * Get chord notes transposed to bass register
 * @param {object} chord - Chord data
 * @param {number} baseOctave - Base octave for bass (default: 2)
 * @returns {array} Array of note names in bass register (baseOctave and baseOctave+1)
 */
function getChordNotesInBassRegister(chord, baseOctave = 2) {
    const upperOctave = baseOctave + 1;

    if (!chord.notes || chord.notes.length === 0) {
        // Fallback: just use root note
        return [`${chord.root}${baseOctave}`, `${chord.root}${upperOctave}`];
    }

    // Filter out omitted notes before processing
    const voicedNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));

    // If all notes are omitted, use root as fallback
    if (voicedNotes.length === 0) {
        return [`${chord.root}${baseOctave}`, `${chord.root}${upperOctave}`];
    }

    // Remove octave numbers and add bass octaves
    const noteNames = voicedNotes.map(note => note.replace(/\d+$/, ''));
    const uniqueNotes = [...new Set(noteNames)]; // Remove duplicates

    // Create bass register versions
    const bassNotes = [];

    // First add all notes in base octave
    uniqueNotes.forEach(note => {
        bassNotes.push(`${note}${baseOctave}`);
    });

    // Then add all notes in upper octave
    uniqueNotes.forEach(note => {
        bassNotes.push(`${note}${upperOctave}`);
    });

    // Phase 1C Round 4.5: Sort by pitch for proper arpeggio patterns
    // This ensures F major (F-A-C) becomes [C2, F2, A2, C3, F3, A3] (ascending)
    // instead of [F2, A2, C2, F3, A3, C3] (chord-tone order)
    bassNotes.sort((a, b) => noteToMidi(a) - noteToMidi(b));

    return bassNotes;
}

/**
 * Generate bass for the first chord in a progression
 * @param {object} chord - Chord data
 * @param {array} chordNotes - Available bass notes
 * @param {string} pattern - Bass pattern
 * @param {object} timeSignature - Time signature
 * @param {number} beatsInMeasure - Number of beats to fill
 * @param {boolean} bassFollowsInversion - Whether bass should follow chord inversion
 * @returns {object} Bass voicing
 */
function generateFirstChordBass(chord, chordNotes, pattern, timeSignature, beatsInMeasure = 4, bassFollowsInversion = false) {
    // Get the bass note based on inversion setting
    const bassNote = getBassNoteForChord(chord, bassFollowsInversion, 2);

    if (pattern === 'whole-note') {
        return {
            notes: [{
                type: 'note',
                pitch: bassNote,
                duration: '1n',
                beat: 0,
                dotted: false
            }]
        };
    }

    if (pattern === 'root-fifth' && timeSignature.num === 4) {
        const fifth = findFifth(chord.root, chordNotes);
        return {
            notes: [
                { type: 'note', pitch: bassNote, duration: '2n', beat: 0, dotted: false },
                { type: 'note', pitch: fifth, duration: '2n', beat: 2, dotted: false }
            ]
        };
    }

    if (pattern === 'arpeggio' && timeSignature.num === 4) {
        return generateArpeggioPattern(chordNotes, timeSignature, null, chord.root);
    }

    if (pattern === 'alberti' && timeSignature.num === 4) {
        return generateAlbertiPattern(chordNotes, timeSignature);
    }

    if (pattern === 'walking' && timeSignature.num === 4) {
        // For first chord, create walking pattern starting from bass note
        // Pattern: bass → up a step → back to bass → fifth
        const bassMidi = noteToMidi(bassNote);
        const approachNote = midiToNoteName(bassMidi + 1); // Whole step up
        const fifth = findFifth(chord.root, chordNotes);

        return {
            notes: [
                { type: 'note', pitch: bassNote, duration: '4n', beat: 0, dotted: false },
                { type: 'note', pitch: approachNote, duration: '4n', beat: 1, dotted: false },
                { type: 'note', pitch: bassNote, duration: '4n', beat: 2, dotted: false },
                { type: 'note', pitch: fifth, duration: '4n', beat: 3, dotted: false }
            ]
        };
    }

    // Default: whole note
    return {
        notes: [{
            type: 'note',
            pitch: bassNote,
            duration: '1n',
            beat: 0,
            dotted: false
        }]
    };
}

/**
 * Generate bass with voice leading from previous chord
 * @param {object} chord - Current chord
 * @param {array} chordNotes - Available bass notes
 * @param {object} previousChord - Previous chord
 * @param {string} pattern - Bass pattern
 * @param {object} timeSignature - Time signature
 * @param {number} beatsInMeasure - Number of beats to fill
 * @param {boolean} bassFollowsInversion - Whether bass should follow chord inversion
 * @returns {object} Bass voicing
 */
function generateVoiceLedBass(chord, chordNotes, previousChord, pattern, timeSignature, beatsInMeasure = 4, bassFollowsInversion = false) {
    // CRITICAL FIX: Get the ACTUAL bass note from previous chord's generated bass
    // Don't assume it was the root in octave 2 - use the actual generated note!
    let previousBass = `${previousChord.root}2`; // Default fallback

    // If previousChord has actual bass notes, use the first one
    if (previousChord.bass && previousChord.bass.notes && previousChord.bass.notes.length > 0) {
        previousBass = previousChord.bass.notes[0].pitch || previousBass;
    }

    const previousMidi = noteToMidi(previousBass);

    // CRITICAL: For bass voice leading, constrain to octave 2 only to prevent 8va markings
    // Filter chordNotes to only include octave 2 notes
    const bassOctaveNotes = chordNotes.filter(note => note.endsWith('2'));

    // Find closest note in current chord to previous bass (octave 2 only)
    const closestNote = findClosestNote(bassOctaveNotes, previousMidi);

    // Get the bass note based on inversion setting (Phase: Bass Follows Inversion)
    // Use this for patterns that emphasize the bass note (root-fifth, walking, etc.)
    const bassNote = getBassNoteForChord(chord, bassFollowsInversion, 2);

    if (pattern === 'whole-note') {
        // Whole-note pattern uses voice leading for smooth bass lines
        return {
            notes: [{
                type: 'note',
                pitch: closestNote,
                duration: '1n',
                beat: 0,
                dotted: false
            }]
        };
    }

    if (pattern === 'root-fifth' && timeSignature.num === 4) {
        const fifth = findFifth(chord.root, chordNotes);
        return {
            notes: [
                // Use bass note (respects inversion setting) to maintain pattern integrity
                { type: 'note', pitch: bassNote, duration: '2n', beat: 0, dotted: false },
                { type: 'note', pitch: fifth, duration: '2n', beat: 2, dotted: false }
            ]
        };
    }

    if (pattern === 'arpeggio') {
        // Arpeggio should start from the root and ascend through chord tones
        return generateArpeggioPattern(chordNotes, timeSignature, null, chord.root);
    }

    if (pattern === 'alberti') {
        // Alberti uses fixed pattern (lowest-highest-middle-highest)
        return generateAlbertiPattern(chordNotes, timeSignature);
    }

    if (pattern === 'walking' && timeSignature.num === 4) {
        // Walking bass handles its own voice leading with stepwise motion
        return generateWalkingBassPattern(chord, previousChord, chordNotes, previousMidi);
    }

    // Default: whole note with voice leading
    return {
        notes: [{
            type: 'note',
            pitch: closestNote,
            duration: '1n',
            beat: 0,
            dotted: false
        }]
    };
}

/**
 * Generate tied bass for chord continuations
 * When a chord spans multiple measures, this creates the tied notes for subsequent measures
 * @param {object} chord - Chord data
 * @param {array} chordNotes - Available bass notes
 * @param {number} beatsInMeasure - Number of beats to fill in this measure
 * @param {boolean} bassFollowsInversion - Whether bass should follow chord inversion
 * @returns {object} Bass voicing with tied notes
 */
function generateTiedBass(chord, chordNotes, beatsInMeasure, bassFollowsInversion = false) {
    // Get the bass note based on inversion setting
    const bassNote = getBassNoteForChord(chord, bassFollowsInversion, 2);

    // Import the note+tie algorithm from vexFlowRenderer
    // For now, use a simple whole note if beatsInMeasure === 4, otherwise use the appropriate duration
    const duration = beatsInMeasure === 4 ? '1n' :
                    beatsInMeasure === 2 ? '2n' :
                    beatsInMeasure === 1 ? '4n' :
                    beatsInMeasure === 3 ? '2n.' :
                    beatsInMeasure === 1.5 ? '4n.' :
                    '1n'; // fallback

    return {
        notes: [{
            type: 'note',
            pitch: bassNote,
            duration: duration,
            beat: 0,
            dotted: duration.includes('.'),
            isTied: true // Mark as tied from previous measure
        }]
    };
}

/**
 * Generate simple bass (root note or inversion bass note)
 * @param {object} chord - Chord data
 * @param {array} chordNotes - Available bass notes
 * @param {string} pattern - Bass pattern
 * @param {object} timeSignature - Time signature
 * @param {number} beatsInMeasure - Number of beats to fill (default: 4)
 * @param {boolean} bassFollowsInversion - Whether bass should follow chord inversion
 * @returns {object} Bass voicing
 */
function generateSimpleBass(chord, chordNotes, pattern, timeSignature, beatsInMeasure = 4, bassFollowsInversion = false) {
    // Get the bass note based on inversion setting
    const bassNote = getBassNoteForChord(chord, bassFollowsInversion, 2);

    // Use appropriate duration based on beatsInMeasure
    const duration = beatsInMeasure === 4 ? '1n' :
                    beatsInMeasure === 2 ? '2n' :
                    beatsInMeasure === 1 ? '4n' :
                    beatsInMeasure === 3 ? '2n.' :
                    beatsInMeasure === 1.5 ? '4n.' :
                    '1n'; // fallback

    return {
        notes: [{
            type: 'note',
            pitch: bassNote,
            duration: duration,
            beat: 0,
            dotted: duration.includes('.')
        }]
    };
}

/**
 * Find the third of a chord in the bass register
 * Correctly handles major vs minor chords
 * @param {string} root - Root note name (e.g., 'C', 'D#')
 * @param {Object} chord - Chord object with type property
 * @param {number} octave - Target octave (default 2)
 * @returns {string} Third note name
 */
function findThird(root, chord, octave = 2) {
    const chordType = (chord?.type || 'Major').toLowerCase();
    // Minor third = 3 semitones, Major third = 4 semitones
    const isMinor = chordType.includes('minor') || chordType.includes('min') ||
                    chordType === 'm' || chordType === 'm7' || chordType === 'm9' ||
                    chordType.includes('dim') || chordType.startsWith('m');
    const thirdInterval = isMinor ? 3 : 4;
    const rootMidi = noteToMidi(`${root}${octave}`);
    const thirdMidi = rootMidi + thirdInterval;
    return midiToNoteName(thirdMidi);
}

/**
 * Find the sixth of a chord in the bass register
 * Correctly handles major vs minor chords
 * @param {string} root - Root note name (e.g., 'C', 'D#')
 * @param {Object} chord - Chord object with type property
 * @param {number} octave - Target octave (default 2)
 * @returns {string} Sixth note name
 */
function findSixth(root, chord, octave = 2) {
    const chordType = (chord?.type || 'Major').toLowerCase();
    // Minor 6th = 8 semitones, Major 6th = 9 semitones
    // Use minor 6th for minor chords to stay diatonic
    const isMinor = chordType.includes('minor') || chordType.includes('min') ||
                    chordType === 'm' || chordType === 'm7' || chordType === 'm9' ||
                    chordType.includes('dim') || chordType.startsWith('m');
    const sixthInterval = isMinor ? 8 : 9;
    const rootMidi = noteToMidi(`${root}${octave}`);
    const sixthMidi = rootMidi + sixthInterval;
    return midiToNoteName(sixthMidi);
}

/**
 * Find the fifth of a chord in the bass register
 * @param {string} root - Root note name (e.g., 'C', 'D#')
 * @param {array} chordNotes - Available chord notes
 * @returns {string} Fifth note name
 */
function findFifth(root, chordNotes, octave = 2) {
    const fifthInterval = 7; // Perfect fifth
    const rootMidi = noteToMidi(`${root}${octave}`);
    const fifthMidi = rootMidi + fifthInterval;

    // Find the note in chordNotes closest to the perfect fifth
    const closest = findClosestNote(chordNotes, fifthMidi);

    return closest || `${root}${octave}`;
}

/**
 * Find the closest note to a target MIDI number
 * @param {array} noteNames - Array of note names (e.g., ['C2', 'E2', 'G2'])
 * @param {number} targetMidi - Target MIDI number
 * @returns {string} Closest note name
 */
function findClosestNote(noteNames, targetMidi) {
    if (!noteNames || noteNames.length === 0) return null;

    let closestNote = noteNames[0];
    let smallestDistance = Math.abs(noteToMidi(noteNames[0]) - targetMidi);

    noteNames.forEach(noteName => {
        const distance = Math.abs(noteToMidi(noteName) - targetMidi);
        if (distance < smallestDistance) {
            smallestDistance = distance;
            closestNote = noteName;
        }
    });

    return closestNote;
}

/**
 * Reorder chord notes to start from the root note
 * For arpeggio patterns that should begin on the root (R-3-5-R)
 * @param {array} chordNotes - Pitch-sorted chord notes
 * @param {string} root - Root note name (e.g., 'F', 'Bb')
 * @returns {array} Notes reordered to start from root
 */
function reorderFromRoot(chordNotes, root) {
    if (!chordNotes || chordNotes.length === 0) return chordNotes;

    // Find the first note that matches the root (ignoring octave)
    const rootIndex = chordNotes.findIndex(note => {
        const noteName = note.replace(/\d+$/, '');
        return noteName === root ||
               // Handle enharmonic equivalents
               (noteName === 'A#' && root === 'Bb') ||
               (noteName === 'Bb' && root === 'A#') ||
               (noteName === 'C#' && root === 'Db') ||
               (noteName === 'Db' && root === 'C#') ||
               (noteName === 'D#' && root === 'Eb') ||
               (noteName === 'Eb' && root === 'D#') ||
               (noteName === 'F#' && root === 'Gb') ||
               (noteName === 'Gb' && root === 'F#') ||
               (noteName === 'G#' && root === 'Ab') ||
               (noteName === 'Ab' && root === 'G#');
    });

    if (rootIndex <= 0) return chordNotes; // Already starts with root or not found

    // Reorder: root and notes after it, then wrap around
    return [...chordNotes.slice(rootIndex), ...chordNotes.slice(0, rootIndex)];
}

/**
 * Generate arpeggio pattern (ascending chord tones starting from root)
 * @param {array} chordNotes - Chord notes
 * @param {object} timeSignature - Time signature
 * @param {string|null} startNote - Optional starting note for voice leading
 * @param {string|null} root - Root note name for proper arpeggio ordering
 * @returns {object} Bass voicing
 */
function generateArpeggioPattern(chordNotes, timeSignature, startNote = null, root = null) {
    const { num } = timeSignature;

    // Reorder notes to start from root for proper arpeggio (R-3-5-R)
    const orderedNotes = root ? reorderFromRoot(chordNotes, root) : chordNotes;

    if (num === 4) {
        // Quarter note arpeggio: R - 3 - 5 - R (e.g., F - A - C - F)
        const notes = orderedNotes.slice(0, 4);
        return {
            notes: notes.map((pitch, idx) => ({
                type: 'note',
                pitch,
                duration: '4n',
                beat: idx,
                dotted: false
            }))
        };
    }

    if (num === 3) {
        // Quarter note arpeggio in 3/4: R - 3 - 5
        const notes = orderedNotes.slice(0, 3);
        return {
            notes: notes.map((pitch, idx) => ({
                type: 'note',
                pitch,
                duration: '4n',
                beat: idx,
                dotted: false
            }))
        };
    }

    // Fallback: whole note on root
    return {
        notes: [{
            type: 'note',
            pitch: orderedNotes[0],
            duration: '1n',
            beat: 0,
            dotted: false
        }]
    };
}

/**
 * Generate Alberti bass pattern (C-G-E-G)
 * @param {array} chordNotes - Chord notes
 * @param {object} timeSignature - Time signature
 * @returns {object} Bass voicing
 */
function generateAlbertiPattern(chordNotes, timeSignature) {
    if (timeSignature.num !== 4 || chordNotes.length < 3) {
        // Fallback to arpeggio if not suitable
        return generateArpeggioPattern(chordNotes, timeSignature);
    }

    // Alberti pattern: lowest - highest - middle - highest
    const sorted = [...chordNotes].sort((a, b) => noteToMidi(a) - noteToMidi(b));
    const pattern = [sorted[0], sorted[2] || sorted[1], sorted[1], sorted[2] || sorted[1]];

    return {
        notes: pattern.map((pitch, idx) => ({
            type: 'note',
            pitch,
            duration: '4n',
            beat: idx,
            dotted: false
        }))
    };
}

/**
 * Generate walking bass pattern (jazz style)
 * @param {object} chord - Current chord
 * @param {object} previousChord - Previous chord
 * @param {array} chordNotes - Chord notes
 * @param {number} previousMidi - MIDI number of previous bass note
 * @returns {object} Bass voicing
 */
function generateWalkingBassPattern(chord, previousChord, chordNotes, previousMidi) {
    // Walking bass: stepwise motion between chord tones
    const root = `${chord.root}2`;
    const rootMidi = noteToMidi(root);

    // Phase 1C Fix: Get the actual last note from the previous chord's pattern
    // For first measure: root-step-root-fifth, so last note is the fifth
    // We need to determine what the last note actually was
    const previousFifth = findFifth(previousChord.root, getChordNotesInBassRegister(previousChord));
    const actualPreviousLastMidi = noteToMidi(previousFifth);

    // Create walking line with smooth stepwise motion
    // Calculate if we should walk up or down to reach the root
    const distance = rootMidi - actualPreviousLastMidi;

    // Create a smooth walking pattern
    if (Math.abs(distance) <= 2) {
        // Small distance: use chromatic approach
        const approachNote = findApproachNote(actualPreviousLastMidi, rootMidi);
        const fifth = findFifth(chord.root, chordNotes);

        return {
            notes: [
                { type: 'note', pitch: approachNote, duration: '4n', beat: 0, dotted: false },
                { type: 'note', pitch: root, duration: '4n', beat: 1, dotted: false },
                { type: 'note', pitch: fifth, duration: '4n', beat: 2, dotted: false },
                { type: 'note', pitch: root, duration: '4n', beat: 3, dotted: false }
            ]
        };
    } else {
        // Larger distance: walk stepwise
        const step1 = midiToNoteName(actualPreviousLastMidi + (distance > 0 ? 2 : -2)); // Whole step toward root
        const step2 = midiToNoteName(actualPreviousLastMidi + (distance > 0 ? 4 : -4)); // Another whole step
        const fifth = findFifth(chord.root, chordNotes);

        return {
            notes: [
                { type: 'note', pitch: step1, duration: '4n', beat: 0, dotted: false },
                { type: 'note', pitch: step2, duration: '4n', beat: 1, dotted: false },
                { type: 'note', pitch: root, duration: '4n', beat: 2, dotted: false },
                { type: 'note', pitch: fifth, duration: '4n', beat: 3, dotted: false }
            ]
        };
    }
}

/**
 * Find chromatic or diatonic approach note
 * @param {number} fromMidi - Starting MIDI number
 * @param {number} toMidi - Target MIDI number
 * @returns {string} Approach note name
 */
function findApproachNote(fromMidi, toMidi) {
    // Use chromatic approach (half step below target)
    const approachMidi = toMidi - 1;
    return midiToNoteName(approachMidi);
}

/**
 * Convert MIDI number to note name
 * @param {number} midi - MIDI number
 * @returns {string} Note name (e.g., 'C2', 'D#3')
 */
function midiToNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return `${noteNames[noteIndex]}${octave}`;
}

/**
 * Generate bass rhythm based on time signature and style
 * @param {object} chord - Chord data
 * @param {object} timeSignature - Time signature
 * @param {string} style - Style ('classical', 'jazz', 'pop')
 * @returns {array} Array of duration strings
 */
export function generateBassRhythm(chord, timeSignature, style = 'classical') {
    const { num, denom } = timeSignature;

    // 4/4 time
    if (num === 4 && denom === 4) {
        if (style === 'jazz') {
            // Walking bass: 4 quarter notes
            return ['4n', '4n', '4n', '4n'];
        }
        if (style === 'pop') {
            // Pop: root-fifth pattern
            return ['2n', '2n'];
        }
        // Classical: whole note or quarter-quarter-half
        return Math.random() > 0.5 ? ['1n'] : ['4n', '4n', '2n'];
    }

    // 3/4 time
    if (num === 3 && denom === 4) {
        if (style === 'jazz') {
            // Three quarter notes
            return ['4n', '4n', '4n'];
        }
        // Classical: dotted half or quarter-quarter-quarter
        return Math.random() > 0.5 ? ['2n.'] : ['4n', '4n', '4n'];
    }

    // 6/8 time
    if (num === 6 && denom === 8) {
        // Dotted quarter notes (2 per measure)
        return ['4n.', '4n.'];
    }

    // Default: whole note
    return ['1n'];
}

/**
 * Calculate voice leading quality score between two chords
 * @param {object} chord1 - First chord
 * @param {object} chord2 - Second chord
 * @returns {number} Voice leading score (0-100)
 */
export function calculateVoiceLeadingScore(chord1, chord2) {
    if (!chord1 || !chord2 || !chord1.notes || !chord2.notes) {
        return 50; // Neutral score
    }

    const notes1 = chord1.notes.map(n => noteToMidi(n));
    const notes2 = chord2.notes.map(n => noteToMidi(n));

    // Count common tones
    const commonTones = notes1.filter(n1 => notes2.includes(n1)).length;

    // Calculate average movement
    let totalMovement = 0;
    notes1.forEach(n1 => {
        const closestN2 = notes2.reduce((closest, n2) =>
            Math.abs(n2 - n1) < Math.abs(closest - n1) ? n2 : closest
        , notes2[0]);
        totalMovement += Math.abs(closestN2 - n1);
    });
    const averageMovement = totalMovement / notes1.length;

    // Score calculation
    // - More common tones = better (up to 40 points)
    // - Less movement = better (up to 60 points)
    const commonToneScore = (commonTones / notes1.length) * 40;
    const movementScore = Math.max(0, 60 - (averageMovement * 5));

    return Math.min(100, commonToneScore + movementScore);
}

// ============================================================================
// BUILDING BLOCK BASS GENERATION
// ============================================================================
// These functions generate bass patterns for entire building blocks (chords)
// that may span multiple measures. They handle proper note duration splitting
// and ties across measure boundaries.

/**
 * Duration values in beats (for 4/4 time with quarter = 1 beat)
 */
const DURATION_BEATS = {
    '1n': 4,      // whole note
    '2n.': 3,     // dotted half
    '2n': 2,      // half note
    '4n.': 1.5,   // dotted quarter
    '4n': 1,      // quarter note
    '8n.': 0.75,  // dotted eighth
    '8n': 0.5,    // eighth note
    '16n': 0.25,  // sixteenth note
};

/**
 * Convert beats to the best duration notation
 * @param {number} beats - Number of beats
 * @returns {object} { duration: string, dotted: boolean }
 */
function beatsToDurationNotation(beats) {
    if (beats >= 4) return { duration: '1n', dotted: false };
    if (beats >= 3) return { duration: '2n', dotted: true };
    if (beats >= 2) return { duration: '2n', dotted: false };
    if (beats >= 1.5) return { duration: '4n', dotted: true };
    if (beats >= 1) return { duration: '4n', dotted: false };
    if (beats >= 0.75) return { duration: '8n', dotted: true };
    if (beats >= 0.5) return { duration: '8n', dotted: false };
    return { duration: '16n', dotted: false };
}

/**
 * Get the beat value of a duration string
 * @param {string} duration - Duration string (e.g., '4n', '2n.')
 * @returns {number} Number of beats
 */
function getDurationBeats(duration) {
    const dotted = duration.includes('.');
    const baseDuration = duration.replace('.', '');
    const baseBeats = DURATION_BEATS[baseDuration] || DURATION_BEATS[duration] || 1;
    return dotted ? baseBeats * 1.5 : baseBeats;
}

/**
 * Generate bass pattern for an entire building block duration
 * This handles variable durations (e.g., 7 beats) and creates proper rhythmic patterns
 *
 * @param {object} chord - Chord data { root, type, notes, inversion }
 * @param {object|null} previousChord - Previous chord for voice leading
 * @param {number} totalBeats - Total duration of the building block in beats
 * @param {object} options - Generation options
 * @param {string} options.bassPattern - Bass pattern name (e.g., 'root-fifth', 'walking')
 * @param {boolean} options.bassFollowsInversion - Whether bass follows chord inversion
 * @param {object} options.timeSignature - Time signature { num, denom }
 * @param {number} options.bassOctave - Base octave for bass (default: pattern-specific or 2)
 * @returns {Array} Array of note objects with beat positions (absolute within block)
 */
export function generateBuildingBlockBass(chord, previousChord = null, totalBeats, options = {}) {
    const {
        bassPattern = 'root-fifth',
        bassFollowsInversion = false,
        timeSignature = { num: 4, denom: 4 },
        bassOctave = null,  // null means use pattern-specific default
    } = options;

    if (!chord || !chord.root) {
        return [];
    }

    // Determine the octave to use: explicit override > pattern default > fallback to 2
    const effectiveOctave = bassOctave ?? getDefaultOctaveForPattern(bassPattern);

    const chordNotes = getChordNotesInBassRegister(chord, effectiveOctave);
    // Get the bass note based on inversion setting, using the effective octave
    const bassNote = getBassNoteForChord(chord, bassFollowsInversion, effectiveOctave);
    const fifth = findFifth(chord.root, chordNotes, effectiveOctave);
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);

    // Generate the pattern based on type
    // Note: bassNote respects the bassFollowsInversion setting
    // Pass bassNote, fifth, and effectiveOctave to ensure correct octave is used
    switch (bassPattern) {
        case 'whole-note':
            return generateWholeNoteBlockBass(bassNote, totalBeats, beatsPerMeasure);

        case 'root-fifth':
            return generateRootFifthBlockBass(bassNote, fifth, totalBeats, beatsPerMeasure);

        case 'arpeggio':
            return generateArpeggioBlockBass(chordNotes, totalBeats, beatsPerMeasure, chord.root, effectiveOctave);

        case 'alberti':
            return generateAlbertiBlockBass(chordNotes, totalBeats, beatsPerMeasure);

        case 'walking':
            return generateWalkingBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth, effectiveOctave);

        // Polyphonic patterns
        case 'broken-octave':
            return generateBrokenOctaveBlockBass(bassNote, totalBeats, beatsPerMeasure, effectiveOctave);

        case 'octave-doubling':
            return generateOctaveDoublingBlockBass(bassNote, totalBeats, beatsPerMeasure, effectiveOctave);

        case 'power-chord':
            return generatePowerChordBlockBass(bassNote, fifth, totalBeats, beatsPerMeasure);

        case 'stride':
            return generateStrideBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave);

        case 'boogie':
            return generateBoogieBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth, effectiveOctave);

        case 'shell-voicing':
            return generateShellVoicingBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave);

        // Style patterns
        case 'tango':
            return generateTangoBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth);

        case 'montuno':
            return generateMontunoBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth);

        case 'reggae':
            return generateReggaeBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth);

        case 'country':
            return generateCountryBlockBass(bassNote, fifth, totalBeats, beatsPerMeasure);

        case 'pedal':
            return generatePedalBlockBass(bassNote, totalBeats, beatsPerMeasure);

        case 'driving-rock':
            return generateDrivingRockBlockBass(bassNote, totalBeats, beatsPerMeasure);

        case 'funk':
            return generateFunkBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth);

        case 'tenths':
            return generateTenthsBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave);

        // RHYTHMIC PATTERNS
        case 'dotted-rhythm':
            return generateDottedRhythmBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth);

        case 'syncopated':
            return generateSyncopatedBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth);

        case 'anticipation':
            return generateAnticipationBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth);

        case 'shuffle':
            return generateShuffleBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth);

        // MELODIC PATTERNS
        case 'chromatic-approach':
            return generateChromaticApproachBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave);

        case 'scalar-walk':
            return generateScalarWalkBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave);

        case 'bebop':
            return generateBebopBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave);

        // STYLE PATTERNS
        case 'bossa-nova':
            return generateBossaNovaBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth);

        case 'disco-octave':
            return generateDiscoOctaveBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave);

        case 'motown':
            return generateMotownBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth, effectiveOctave);

        case 'ballad':
            return generateBalladBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth);

        // REST-BASED PATTERNS
        case 'staccato':
            return generateStaccatoBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth);

        case 'call-response':
            return generateCallResponseBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth);

        // ADDITIONAL POLYPHONIC PATTERNS
        case 'open-fifth':
            return generateOpenFifthBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth);

        case 'rock-power':
            return generateRockPowerBlockBass(bassNote, fifth, totalBeats, beatsPerMeasure);

        case 'gospel':
            return generateGospelBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave);

        case 'half-time':
            return generateHalfTimeBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth);

        default:
            return generateWholeNoteBlockBass(bassNote, totalBeats, beatsPerMeasure);
    }
}

/**
 * Generate whole-note bass pattern for a building block
 * Fills the duration with whole notes (or appropriate tied notes)
 */
function generateWholeNoteBlockBass(root, totalBeats, beatsPerMeasure) {
    const notes = [];
    let currentBeat = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const beatInMeasure = currentBeat % beatsPerMeasure;
        const beatsToMeasureEnd = beatsPerMeasure - beatInMeasure;

        // Determine the longest note we can place
        let noteBeats;
        if (remainingBeats >= beatsToMeasureEnd && beatsToMeasureEnd === beatsPerMeasure) {
            // Can place a whole note
            noteBeats = Math.min(beatsPerMeasure, remainingBeats);
        } else {
            // Need to fit within measure boundary or remaining duration
            noteBeats = Math.min(beatsToMeasureEnd, remainingBeats);
        }

        // Find the best duration notation for these beats
        const { duration, dotted } = findBestDuration(noteBeats);
        const actualBeats = getDurationBeats(dotted ? duration + '.' : duration);

        // Handle tie if this note needs to connect to the next
        const needsTie = currentBeat > 0 || (actualBeats < noteBeats);

        notes.push({
            type: 'note',
            pitch: root,
            pitches: [root],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: currentBeat > 0, // Tied if not the first note
            tie: actualBeats < remainingBeats ? 'start' : undefined,
        });

        currentBeat += actualBeats;
    }

    return notes;
}

/**
 * Generate root-fifth pattern for a building block
 * Alternates root and fifth, with proper duration handling
 *
 * Example for 7 beats:
 * - Beat 0-2: Root (half note)
 * - Beat 2-4: Fifth (half note)
 * - Beat 4-6: Root (half note)
 * - Beat 6-7: Fifth (quarter note)
 */
function generateRootFifthBlockBass(root, fifth, totalBeats, beatsPerMeasure) {
    const notes = [];
    let currentBeat = 0;
    let isRoot = true; // Alternate between root and fifth

    // Each root-fifth note is 2 beats (half note)
    // Alternate root-fifth-root-fifth...
    // Handle partial patterns when beats don't divide evenly by 2

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const pitch = isRoot ? root : fifth;

        // Standard duration for root-fifth is 2 beats (half note)
        // But adjust if less than 2 beats remain
        let noteBeats = Math.min(2, remainingBeats);

        // Check if we need to split at measure boundary
        const beatInMeasure = currentBeat % beatsPerMeasure;
        const beatsToMeasureEnd = beatsPerMeasure - beatInMeasure;

        if (noteBeats > beatsToMeasureEnd) {
            // Need to split at measure boundary - this will be handled by splitBlockBassIntoMeasures
            noteBeats = beatsToMeasureEnd;
        }

        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: pitch,
            pitches: [pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;

        // Always alternate after each note (whether full or partial)
        // This ensures root-fifth-root-fifth pattern continues even with odd beats
        isRoot = !isRoot;
    }

    return notes;
}

/**
 * Generate arpeggio pattern for a building block
 * Quarter notes cycling through chord tones, starting from root
 * @param {array} chordNotes - Chord notes (pitch-sorted)
 * @param {number} totalBeats - Total beats to fill
 * @param {number} beatsPerMeasure - Beats per measure
 * @param {string|null} root - Root note name for proper ordering
 */
function generateArpeggioBlockBass(chordNotes, totalBeats, beatsPerMeasure, root = null) {
    const notes = [];
    let currentBeat = 0;
    let noteIndex = 0;

    // Reorder to start from root for proper arpeggio (R-3-5-R)
    const orderedNotes = root ? reorderFromRoot(chordNotes, root) : chordNotes;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const pitch = orderedNotes[noteIndex % orderedNotes.length];

        // Each arpeggio note is 1 beat (quarter note)
        const noteBeats = Math.min(1, remainingBeats);
        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: pitch,
            pitches: [pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        noteIndex++;
    }

    return notes;
}

/**
 * Generate Alberti pattern for a building block
 * Low-high-mid-high pattern cycling through duration
 */
function generateAlbertiBlockBass(chordNotes, totalBeats, beatsPerMeasure) {
    if (chordNotes.length < 3) {
        return generateArpeggioBlockBass(chordNotes, totalBeats, beatsPerMeasure);
    }

    const notes = [];
    let currentBeat = 0;

    // Sort notes by pitch for Alberti pattern (low-high-mid-high)
    const sorted = [...chordNotes].sort((a, b) => noteToMidi(a) - noteToMidi(b));
    const pattern = [sorted[0], sorted[2] || sorted[1], sorted[1], sorted[2] || sorted[1]];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const pitch = pattern[patternIndex % pattern.length];

        // Each Alberti note is 1 beat (quarter note)
        const noteBeats = Math.min(1, remainingBeats);
        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: pitch,
            pitches: [pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        patternIndex++;
    }

    return notes;
}

/**
 * Generate walking bass pattern for a building block
 * Stepwise motion with chromatic approaches
 */
function generateWalkingBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth, effectiveOctave) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;
    const rootMidi = noteToMidi(root);
    const fifthMidi = noteToMidi(fifth);

    // Walking pattern per 4 beats: root, step up, root, fifth
    // Repeat as needed for longer durations
    let beatInPattern = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        let pitch;

        // Determine pitch based on position in 4-beat pattern
        switch (beatInPattern % 4) {
            case 0: pitch = root; break;
            case 1: pitch = midiToNoteName(rootMidi + 2); break; // Step up
            case 2: pitch = root; break;
            case 3: pitch = fifth; break;
            default: pitch = root;
        }

        const noteBeats = Math.min(1, remainingBeats);
        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: pitch,
            pitches: [pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        beatInPattern++;
    }

    return notes;
}

// ============================================================================
// POLYPHONIC BASS PATTERNS
// ============================================================================
// These patterns generate multiple simultaneous notes (chords) in the bass clef

/**
 * Generate broken octave pattern for a building block
 * Alternates between low root and high root (octave apart)
 * Creates a fuller, more resonant bass sound
 */
function generateBrokenOctaveBlockBass(root, totalBeats, beatsPerMeasure) {
    const notes = [];
    let currentBeat = 0;

    // Extract note name and create low/high versions
    const noteName = root.replace(/\d+$/, '');
    const lowRoot = `${noteName}2`;
    const highRoot = `${noteName}3`;
    let isLow = true;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const pitch = isLow ? lowRoot : highRoot;

        // Each note is 1 beat (quarter note) for rhythmic movement
        let noteBeats = Math.min(1, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: pitch,
            pitches: [pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        isLow = !isLow;
    }

    return notes;
}

/**
 * Generate octave doubling pattern for a building block
 * Plays root and octave simultaneously as a chord
 * Creates a powerful, organ-like bass foundation
 */
function generateOctaveDoublingBlockBass(root, totalBeats, beatsPerMeasure) {
    const notes = [];
    let currentBeat = 0;

    // Extract note name and create low/high versions
    const noteName = root.replace(/\d+$/, '');
    const lowRoot = `${noteName}2`;
    const highRoot = `${noteName}3`;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const beatInMeasure = currentBeat % beatsPerMeasure;
        const beatsToMeasureEnd = beatsPerMeasure - beatInMeasure;

        // Use whole notes or fill to measure boundary
        let noteBeats = Math.min(beatsPerMeasure, remainingBeats, beatsToMeasureEnd);
        if (beatInMeasure === 0 && remainingBeats >= beatsPerMeasure) {
            noteBeats = beatsPerMeasure;
        }

        const { duration, dotted } = findBestDuration(noteBeats);

        // Create a chord with both octaves
        notes.push({
            type: 'note',
            pitch: lowRoot,
            pitches: [lowRoot, highRoot], // Both notes as chord
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
    }

    return notes;
}

/**
 * Generate power chord pattern (root + fifth) for a building block
 * Plays root and fifth simultaneously - classic rock/pop bass
 */
function generatePowerChordBlockBass(root, fifth, totalBeats, beatsPerMeasure) {
    const notes = [];
    let currentBeat = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const beatInMeasure = currentBeat % beatsPerMeasure;
        const beatsToMeasureEnd = beatsPerMeasure - beatInMeasure;

        // Use half notes for rhythmic interest
        let noteBeats = Math.min(2, remainingBeats, beatsToMeasureEnd);
        if (noteBeats < 1) noteBeats = remainingBeats;

        const { duration, dotted } = findBestDuration(noteBeats);

        // Create a chord with root and fifth
        notes.push({
            type: 'note',
            pitch: root,
            pitches: [root, fifth], // Both notes as chord
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
    }

    return notes;
}

/**
 * Generate stride bass pattern for a building block
 * Alternates between low bass note and mid-register chord
 * Classic jazz/ragtime left-hand pattern
 */
function generateStrideBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote (already calculated with correct octave)
    const root = bassNote;
    // Get chord tones in the upper octave for the "stride" chord
    const upperOctave = effectiveOctave + 1;
    const midChordNotes = chordNotes.filter(n => n.endsWith(String(upperOctave))).slice(0, 3);

    let isBassBeat = true; // Alternate bass note and chord

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;

        // Each stride element is 1 beat
        let noteBeats = Math.min(1, remainingBeats);
        const { duration, dotted } = findBestDuration(noteBeats);

        if (isBassBeat) {
            // Low bass note on beats 1 and 3
            notes.push({
                type: 'note',
                pitch: root,
                pitches: [root],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        } else {
            // Mid-register chord on beats 2 and 4
            notes.push({
                type: 'note',
                pitch: midChordNotes[0] || root,
                pitches: midChordNotes.length > 0 ? midChordNotes : [root],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        }

        currentBeat += noteBeats;
        isBassBeat = !isBassBeat;
    }

    return notes;
}

/**
 * Generate boogie-woogie bass pattern for a building block
 * Classic 8-to-the-bar blues/boogie left-hand pattern
 * Uses eighth notes with characteristic chromatic movement
 */
function generateBoogieBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth, effectiveOctave) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;
    const rootMidi = noteToMidi(root);
    const third = findThird(chord.root, chord, effectiveOctave); // Chord-quality-aware third
    const sixth = findSixth(chord.root, chord, effectiveOctave); // Chord-quality-aware sixth

    // Boogie pattern: root-3rd-5th-6th-5th-3rd (ascending/descending)
    const boogiePattern = [
        root,
        third,
        fifth,
        sixth,
        fifth,
        third,
        root,
        midiToNoteName(rootMidi - 1), // Leading tone below
    ];

    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const pitch = boogiePattern[patternIndex % boogiePattern.length];

        // Each boogie note is half a beat (eighth note)
        let noteBeats = Math.min(0.5, remainingBeats);
        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: pitch,
            pitches: [pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        patternIndex++;
    }

    return notes;
}

/**
 * Generate shell voicing pattern for a building block
 * Jazz piano "shell" voicings: root + 3rd or root + 7th
 * Sparse but harmonically rich
 *
 * Shell voicings use:
 * - For 7th chords: root + 7th (omit 3rd and 5th for clarity)
 * - For triads: root + 3rd (the defining interval)
 *
 * The 3rd or 7th is placed in octave 3 (above the root in octave 2)
 * for clearer voice separation typical of jazz voicings
 */
function generateShellVoicingBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote (already calculated with correct octave)
    const root = bassNote;
    const rootMidi = noteToMidi(root);

    // Determine chord quality and get appropriate shell notes
    // Chord types from music-data.js: "Major", "Minor", "Major 7th", "Minor 7th", "Dominant 7th", etc.
    const chordType = (chord.type || '').toLowerCase().trim();
    let intervalSemitones;
    let isSeventhChord = false;

    // Check for 7th chords first (they contain "7" in the name)
    if (chordType.includes('major 7') || chordType.includes('maj7')) {
        // Major 7th chord: root + major 7th (11 semitones)
        intervalSemitones = 11;
        isSeventhChord = true;
    } else if (chordType.includes('minor 7') || chordType.includes('min7') ||
               (chordType.includes('m7') && !chordType.includes('dim'))) {
        // Minor 7th chord: root + minor 7th (10 semitones)
        intervalSemitones = 10;
        isSeventhChord = true;
    } else if (chordType.includes('dominant 7') || chordType.includes('dom7')) {
        // Dominant 7th chord: root + minor 7th (10 semitones)
        intervalSemitones = 10;
        isSeventhChord = true;
    } else if (chordType.includes('diminished 7') || chordType.includes('dim7')) {
        // Diminished 7th chord: root + diminished 7th (9 semitones)
        intervalSemitones = 9;
        isSeventhChord = true;
    } else if (chordType.includes('half-diminished') || chordType.includes('m7b5') || chordType.includes('ø')) {
        // Half-diminished: root + minor 7th
        intervalSemitones = 10;
        isSeventhChord = true;
    } else if (chordType.includes('7') && !chordType.includes('sus')) {
        // Any other 7th chord (like 7b5, 7#9, etc.): use minor 7th as default
        intervalSemitones = 10;
        isSeventhChord = true;
    } else if (chordType.includes('minor') || chordType.includes('min') || chordType === 'm') {
        // Minor triad: root + minor 3rd (3 semitones)
        intervalSemitones = 3;
    } else if (chordType.includes('diminished') || chordType.includes('dim')) {
        // Diminished triad: root + minor 3rd (3 semitones)
        intervalSemitones = 3;
    } else if (chordType.includes('augmented') || chordType.includes('aug')) {
        // Augmented triad: root + major 3rd (4 semitones)
        intervalSemitones = 4;
    } else {
        // Major triad (default): root + major 3rd (4 semitones)
        intervalSemitones = 4;
    }

    // Calculate the shell note - place it in octave 3 for better separation
    // Root is in octave 2, shell note will be in octave 3
    const root3Midi = rootMidi + 12; // Root in octave 3
    const shellNoteMidi = root3Midi + (intervalSemitones - 12); // Adjust to place in octave 3

    // For 7ths: use the 7th interval from root in octave 3
    // For 3rds: use the 3rd interval from root in octave 3
    const thirdOrSeventh = midiToNoteName(rootMidi + intervalSemitones);

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const beatInMeasure = currentBeat % beatsPerMeasure;
        const beatsToMeasureEnd = beatsPerMeasure - beatInMeasure;

        // Use half notes for shell voicings
        let noteBeats = Math.min(2, remainingBeats, beatsToMeasureEnd);
        if (noteBeats < 1) noteBeats = remainingBeats;

        const { duration, dotted } = findBestDuration(noteBeats);

        // Shell voicing: root + 3rd or 7th
        notes.push({
            type: 'note',
            pitch: root,
            pitches: [root, thirdOrSeventh],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
    }

    return notes;
}

/**
 * Generate tango/habanera bass pattern for a building block
 * Classic tango rhythm: dotted quarter + eighth + half
 * Creates that distinctive Latin feel
 */
function generateTangoBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;

    // Tango pattern per 4 beats: root (dotted quarter), fifth (eighth), root (half)
    // Duration pattern: 1.5 + 0.5 + 2 = 4 beats
    const tangoPattern = [
        { pitch: root, beats: 1.5 },      // Dotted quarter on beat 1
        { pitch: fifth, beats: 0.5 },     // Eighth note
        { pitch: root, beats: 2 },        // Half note on beat 3
    ];

    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = tangoPattern[patternIndex % tangoPattern.length];

        let noteBeats = Math.min(patternNote.beats, remainingBeats);
        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: patternNote.pitch,
            pitches: [patternNote.pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        patternIndex++;
    }

    return notes;
}

/**
 * Generate Latin montuno bass pattern for a building block
 * Syncopated Cuban-style bass with anticipated notes
 */
function generateMontunoBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;
    const rootMidi = noteToMidi(root);
    const octave = midiToNoteName(rootMidi + 12);

    // Montuno: syncopated pattern with anticipation
    // Pattern: root, fifth, octave, fifth (eighth notes with syncopation)
    const montunoPattern = [root, fifth, octave, fifth, root, octave, fifth, root];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const pitch = montunoPattern[patternIndex % montunoPattern.length];

        // Eighth notes for driving rhythm
        let noteBeats = Math.min(0.5, remainingBeats);
        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: pitch,
            pitches: [pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        patternIndex++;
    }

    return notes;
}

/**
 * Generate reggae one-drop bass pattern for a building block
 * Classic reggae: emphasis on beat 3 with syncopated pickup
 * Pattern per 4 beats:
 *   Beat 1: rest (quarter)
 *   Beat 2: eighth rest + eighth note pickup (fifth)
 *   Beat 3: root (quarter) - THE DROP
 *   Beat 4: fifth (eighth) + root (eighth)
 * This creates the characteristic reggae groove with anticipation
 */
function generateReggaeBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;

    // Reggae pattern: rest, pickup, drop, groove
    // Total: 1 + 0.5 + 0.5 + 1 + 0.5 + 0.5 = 4 beats
    const reggaePattern = [
        { pitch: null, beats: 1 },         // Beat 1: rest
        { pitch: null, beats: 0.5 },       // Beat 2: rest
        { pitch: fifth, beats: 0.5 },      // Beat 2&: pickup to the drop
        { pitch: root, beats: 1 },         // Beat 3: THE DROP
        { pitch: fifth, beats: 0.5 },      // Beat 4: groove
        { pitch: root, beats: 0.5 },       // Beat 4&: pickup to next bar
    ];

    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = reggaePattern[patternIndex % reggaePattern.length];

        let noteBeats = Math.min(patternNote.beats, remainingBeats);
        const { duration, dotted } = findBestDuration(noteBeats);

        if (patternNote.pitch === null) {
            // Rest
            notes.push({
                type: 'rest',
                isRest: true,
                pitch: null,
                pitches: [],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        } else {
            // Note
            notes.push({
                type: 'note',
                pitch: patternNote.pitch,
                pitches: [patternNote.pitch],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        }

        currentBeat += noteBeats;
        patternIndex++;
    }

    // Combine consecutive rests into larger values (e.g., quarter + eighth rest -> dotted quarter rest)
    return combineConsecutiveRests(notes);
}

/**
 * Generate country bass pattern for a building block
 * Classic country "boom-chick" with walk-up approach at end of pattern
 * Pattern per 4 beats: root (quarter), fifth (quarter), root (quarter), walk-up note (quarter)
 * The walk-up note adds the characteristic country bass movement
 */
function generateCountryBlockBass(root, fifth, totalBeats, beatsPerMeasure) {
    const notes = [];
    let currentBeat = 0;

    // Get MIDI for calculating walk-up note
    const rootMidi = noteToMidi(root);
    // Walk-up note is typically a major 2nd above the root (leading tone approach)
    const walkUpNote = midiToNoteName(rootMidi + 2);

    // Country pattern: root, fifth, root, walk-up (4 quarter notes)
    const countryPattern = [root, fifth, root, walkUpNote];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const pitch = countryPattern[patternIndex % countryPattern.length];

        // Each note is 1 beat (quarter note) for country drive
        let noteBeats = Math.min(1, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: pitch,
            pitches: [pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        patternIndex++;
    }

    return notes;
}

/**
 * Generate pedal tone bass pattern for a building block
 * Rhythmic pedal with half-note pulse - distinct from static whole-note
 * Creates a grounded, pulsing foundation while harmonies change above
 * Pattern: Half note on root, repeated (provides pulse unlike whole-note)
 */
function generatePedalBlockBass(root, totalBeats, beatsPerMeasure) {
    const notes = [];
    let currentBeat = 0;

    // Extract note name and create octave version for emphasis
    const noteName = root.replace(/\d+$/, '');
    const lowRoot = `${noteName}2`;

    // Half-note pedal pulse - gives more drive than static whole note
    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const beatInMeasure = currentBeat % beatsPerMeasure;

        // Use half notes for pulsing effect (distinct from whole-note)
        let noteBeats = Math.min(2, remainingBeats);

        // Check measure boundary
        const beatsToMeasureEnd = beatsPerMeasure - beatInMeasure;
        if (noteBeats > beatsToMeasureEnd) {
            noteBeats = beatsToMeasureEnd;
        }

        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: lowRoot,
            pitches: [lowRoot],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
    }

    return notes;
}

/**
 * Generate driving rock bass pattern for a building block
 * Straight eighth notes on the root for energy
 */
function generateDrivingRockBlockBass(root, totalBeats, beatsPerMeasure) {
    const notes = [];
    let currentBeat = 0;

    // All eighth notes on the root - driving, energetic feel
    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;

        let noteBeats = Math.min(0.5, remainingBeats);
        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: root,
            pitches: [root],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
    }

    return notes;
}

/**
 * Generate funk slap bass pattern for a building block
 * Syncopated funk pattern with 16th note subdivisions
 * Characteristic "slap and pop" feel with ghost notes
 * Pattern per 4 beats (16 sixteenths):
 *   1e+a 2e+a 3e+a 4e+a
 *   R.O. .R.. R.5. .O.R  (R=root, O=octave, 5=fifth, .=rest)
 */
function generateFunkBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;
    const rootMidi = noteToMidi(root);
    const octave = midiToNoteName(rootMidi + 12);

    // Funk pattern: 16th note based for authentic syncopation
    // Each entry is 0.25 beats (16th note)
    // Total: 16 x 0.25 = 4 beats
    const funkPattern = [
        // Beat 1: R.O.
        { pitch: root, beats: 0.25 },      // 1
        { pitch: null, beats: 0.25 },      // e (ghost)
        { pitch: octave, beats: 0.25 },    // + (pop)
        { pitch: null, beats: 0.25 },      // a
        // Beat 2: .R..
        { pitch: null, beats: 0.25 },      // 2
        { pitch: root, beats: 0.25 },      // e (syncopated hit)
        { pitch: null, beats: 0.25 },      // +
        { pitch: null, beats: 0.25 },      // a
        // Beat 3: R.5.
        { pitch: root, beats: 0.25 },      // 3
        { pitch: null, beats: 0.25 },      // e
        { pitch: fifth, beats: 0.25 },     // + (accent)
        { pitch: null, beats: 0.25 },      // a
        // Beat 4: .O.R
        { pitch: null, beats: 0.25 },      // 4
        { pitch: octave, beats: 0.25 },    // e (pop)
        { pitch: null, beats: 0.25 },      // +
        { pitch: root, beats: 0.25 },      // a (pickup)
    ];

    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = funkPattern[patternIndex % funkPattern.length];

        let noteBeats = Math.min(patternNote.beats, remainingBeats);
        const { duration, dotted } = findBestDuration(noteBeats);

        // Include rests explicitly so measure is filled
        if (patternNote.pitch === null) {
            notes.push({
                type: 'rest',
                isRest: true,
                pitch: null,
                pitches: [],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        } else {
            notes.push({
                type: 'note',
                pitch: patternNote.pitch,
                pitches: [patternNote.pitch],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        }

        currentBeat += noteBeats;
        patternIndex++;
    }

    // Combine consecutive rests into larger values (e.g., two 16th rests -> one 8th rest)
    return combineConsecutiveRests(notes);
}

/**
 * Generate 10ths pattern for a building block
 * Root + 10th (3rd up an octave) - rich romantic sound
 */
function generateTenthsBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote (already calculated with correct octave)
    const root = bassNote;
    const rootMidi = noteToMidi(root);

    // Determine if major or minor 10th based on chord type
    const chordType = (chord.type || '').toLowerCase();
    const isMinor = chordType.includes('minor') || chordType.includes('min') ||
                    chordType.includes('dim') || chordType === 'm';
    const tenthInterval = isMinor ? 15 : 16; // Minor 10th = 15, Major 10th = 16
    const tenth = midiToNoteName(rootMidi + tenthInterval);

    // Use half notes for a flowing, romantic feel
    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const beatInMeasure = currentBeat % beatsPerMeasure;
        const beatsToMeasureEnd = beatsPerMeasure - beatInMeasure;

        let noteBeats = Math.min(2, remainingBeats, beatsToMeasureEnd);
        if (noteBeats < 1) noteBeats = remainingBeats;

        const { duration, dotted } = findBestDuration(noteBeats);

        // Root + 10th played together
        notes.push({
            type: 'note',
            pitch: root,
            pitches: [root, tenth],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
    }

    return notes;
}

// ============================================================================
// NEW RHYTHMIC PATTERNS
// ============================================================================

/**
 * Generate dotted rhythm bass pattern
 * Classic "long-short" feel: dotted quarter + eighth
 * Creates a lilting, dance-like groove
 * Pattern per 2 beats: dotted quarter (1.5) + eighth (0.5)
 */
function generateDottedRhythmBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;

    // Dotted rhythm: long-short pattern alternating root and fifth
    // Pattern: root (dotted quarter), fifth (eighth), root (dotted quarter), fifth (eighth)
    const dottedPattern = [
        { pitch: root, beats: 1.5 },   // Dotted quarter
        { pitch: fifth, beats: 0.5 },  // Eighth
    ];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = dottedPattern[patternIndex % dottedPattern.length];
        let noteBeats = Math.min(patternNote.beats, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: patternNote.pitch,
            pitches: [patternNote.pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        patternIndex++;
    }

    return notes;
}

/**
 * Generate syncopated bass pattern
 * Off-beat accents for rhythmic tension
 * Pattern: rest on beat 1, note on "and", note on beat 3, rest on beat 4
 */
function generateSyncopatedBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;

    // Syncopated pattern: emphasizes off-beats
    // Pattern per 4 beats: rest (0.5), root (0.5), rest (0.5), fifth (0.5), root (1), rest (1)
    const syncopatedPattern = [
        { pitch: null, beats: 0.5 },    // Rest
        { pitch: root, beats: 0.5 },    // Off-beat hit
        { pitch: null, beats: 0.5 },    // Rest
        { pitch: fifth, beats: 0.5 },   // Off-beat hit
        { pitch: root, beats: 1 },      // Beat 3
        { pitch: null, beats: 1 },      // Rest on beat 4
    ];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = syncopatedPattern[patternIndex % syncopatedPattern.length];
        let noteBeats = Math.min(patternNote.beats, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        if (patternNote.pitch === null) {
            notes.push({
                type: 'rest',
                isRest: true,
                pitch: null,
                pitches: [],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        } else {
            notes.push({
                type: 'note',
                pitch: patternNote.pitch,
                pitches: [patternNote.pitch],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        }

        currentBeat += noteBeats;
        patternIndex++;
    }

    return combineConsecutiveRests(notes);
}

/**
 * Generate anticipation bass pattern
 * Notes anticipate the next beat - creates forward momentum
 * Pattern: notes on the "and" of beats, creating push toward next measure
 */
function generateAnticipationBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;

    // Anticipation pattern: notes slightly before the beat
    // Pattern per 4 beats: rest (0.5), root (1.5), rest (0.5), fifth (1.5)
    const anticipationPattern = [
        { pitch: null, beats: 0.5 },    // Rest (beat 1)
        { pitch: root, beats: 1.5 },    // Anticipation note held through beat 2
        { pitch: null, beats: 0.5 },    // Rest (beat 3)
        { pitch: fifth, beats: 1.5 },   // Anticipation note held through beat 4
    ];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = anticipationPattern[patternIndex % anticipationPattern.length];
        let noteBeats = Math.min(patternNote.beats, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        if (patternNote.pitch === null) {
            notes.push({
                type: 'rest',
                isRest: true,
                pitch: null,
                pitches: [],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        } else {
            notes.push({
                type: 'note',
                pitch: patternNote.pitch,
                pitches: [patternNote.pitch],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        }

        currentBeat += noteBeats;
        patternIndex++;
    }

    return combineConsecutiveRests(notes);
}

/**
 * Generate shuffle bass pattern
 * Swing feel with long-short triplet subdivision
 * Classic blues/swing groove
 */
function generateShuffleBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;
    const rootMidi = noteToMidi(root);
    const thirdBelow = midiToNoteName(rootMidi - 4); // Major third below for blues feel

    // Shuffle pattern: approximated with dotted eighth + sixteenth
    // For each beat: long note (0.75) + short note (0.25)
    // Cycle through: root-root, fifth-fifth, root-root, third-root
    const shufflePattern = [
        { pitch: root, beats: 0.75 },
        { pitch: root, beats: 0.25 },
        { pitch: fifth, beats: 0.75 },
        { pitch: fifth, beats: 0.25 },
        { pitch: root, beats: 0.75 },
        { pitch: root, beats: 0.25 },
        { pitch: thirdBelow, beats: 0.75 },
        { pitch: root, beats: 0.25 },
    ];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = shufflePattern[patternIndex % shufflePattern.length];
        let noteBeats = Math.min(patternNote.beats, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: patternNote.pitch,
            pitches: [patternNote.pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        patternIndex++;
    }

    return notes;
}

// ============================================================================
// NEW MELODIC/WALKING PATTERNS
// ============================================================================

/**
 * Generate chromatic approach bass pattern
 * Walks chromatically toward the root from below
 * Creates tension and resolution
 */
function generateChromaticApproachBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote (already calculated with correct octave)
    const root = bassNote;
    const rootMidi = noteToMidi(root);

    // Chromatic approach: walk up chromatically to the root
    // Pattern: 3 semitones below, 2 below, 1 below, root
    const chromaticPattern = [
        { pitch: midiToNoteName(rootMidi - 3), beats: 1 },
        { pitch: midiToNoteName(rootMidi - 2), beats: 1 },
        { pitch: midiToNoteName(rootMidi - 1), beats: 1 },
        { pitch: root, beats: 1 },
    ];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = chromaticPattern[patternIndex % chromaticPattern.length];
        let noteBeats = Math.min(patternNote.beats, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: patternNote.pitch,
            pitches: [patternNote.pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        patternIndex++;
    }

    return notes;
}

/**
 * Generate scalar walk bass pattern
 * Walks through scale tones for melodic interest
 * Uses major scale intervals from the root
 */
function generateScalarWalkBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote (already calculated with correct octave)
    const root = bassNote;
    const rootMidi = noteToMidi(root);

    // Scalar pattern using major scale intervals (ascending then descending)
    // 0, 2, 4, 5, 7, 5, 4, 2 (root, 2nd, 3rd, 4th, 5th, 4th, 3rd, 2nd)
    const scaleIntervals = [0, 2, 4, 5, 7, 5, 4, 2];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const interval = scaleIntervals[patternIndex % scaleIntervals.length];
        const pitch = midiToNoteName(rootMidi + interval);

        let noteBeats = Math.min(0.5, remainingBeats); // Eighth notes for scalar movement

        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: pitch,
            pitches: [pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        patternIndex++;
    }

    return notes;
}

/**
 * Generate bebop bass pattern
 * Jazz bebop-style walking with chromatic passing tones
 * Features characteristic chromatic approaches and enclosures
 */
function generateBebopBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote (already calculated with correct octave)
    const root = bassNote;
    const rootMidi = noteToMidi(root);
    const fifth = findFifth(chord.root, chordNotes, effectiveOctave);
    const fifthMidi = noteToMidi(fifth);

    // Bebop pattern with enclosure and chromatic passing tones
    // Root, chromatic below fifth, fifth, chromatic above root, repeat
    const bebopPattern = [
        { pitch: root, beats: 1 },
        { pitch: midiToNoteName(fifthMidi - 1), beats: 1 }, // Chromatic approach to fifth
        { pitch: fifth, beats: 1 },
        { pitch: midiToNoteName(rootMidi + 1), beats: 1 },  // Chromatic neighbor above root
    ];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = bebopPattern[patternIndex % bebopPattern.length];
        let noteBeats = Math.min(patternNote.beats, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: patternNote.pitch,
            pitches: [patternNote.pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        patternIndex++;
    }

    return notes;
}

// ============================================================================
// NEW STYLE-SPECIFIC PATTERNS
// ============================================================================

/**
 * Generate bossa nova bass pattern
 * Classic Brazilian bossa nova feel
 * Syncopated pattern with emphasis on beats 1 and the "and" of 2
 */
function generateBossaNovaBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;

    // Bossa nova pattern: root on 1, fifth on "and" of 2, root on 3
    // Creates the characteristic syncopated Brazilian feel
    const bossaPattern = [
        { pitch: root, beats: 1.5 },   // Dotted quarter on beat 1
        { pitch: fifth, beats: 0.5 },  // Eighth on "and" of 2
        { pitch: root, beats: 2 },     // Half note on beat 3
    ];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = bossaPattern[patternIndex % bossaPattern.length];
        let noteBeats = Math.min(patternNote.beats, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: patternNote.pitch,
            pitches: [patternNote.pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        patternIndex++;
    }

    return notes;
}

/**
 * Generate disco octave bass pattern
 * Classic disco pumping octaves on every beat
 * Alternates between low and high octave
 */
function generateDiscoOctaveBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave) {
    const notes = [];
    let currentBeat = 0;

    // Use passed effectiveOctave for low/high octave calculation
    const noteName = chord.root;
    const lowRoot = `${noteName}${effectiveOctave}`;
    const highRoot = `${noteName}${effectiveOctave + 1}`;

    // Disco pattern: steady eighths alternating octaves
    // Low-high-low-high... (8 per measure)
    let isLow = true;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const pitch = isLow ? lowRoot : highRoot;

        let noteBeats = Math.min(0.5, remainingBeats); // Eighth notes

        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: pitch,
            pitches: [pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        isLow = !isLow;
    }

    return notes;
}

/**
 * Generate Motown bass pattern
 * Melodic, syncopated Motown/soul style bass
 * Uses chord tones with rhythmic variety
 */
function generateMotownBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth, effectiveOctave) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;
    const rootMidi = noteToMidi(root);
    const third = findThird(chord.root, chord, effectiveOctave); // Chord-quality-aware third
    const octave = midiToNoteName(rootMidi + 12);

    // Motown pattern: melodic with syncopation
    // Pattern: root, third (syncopated), fifth, octave drop back to root
    const motownPattern = [
        { pitch: root, beats: 0.75 },    // Dotted eighth
        { pitch: third, beats: 0.25 },   // Sixteenth (syncopated)
        { pitch: fifth, beats: 0.5 },    // Eighth
        { pitch: octave, beats: 0.5 },   // Eighth
        { pitch: root, beats: 0.5 },     // Eighth
        { pitch: null, beats: 0.5 },     // Eighth rest
        { pitch: fifth, beats: 0.5 },    // Eighth
        { pitch: root, beats: 0.5 },     // Eighth
    ];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = motownPattern[patternIndex % motownPattern.length];
        let noteBeats = Math.min(patternNote.beats, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        if (patternNote.pitch === null) {
            notes.push({
                type: 'rest',
                isRest: true,
                pitch: null,
                pitches: [],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        } else {
            notes.push({
                type: 'note',
                pitch: patternNote.pitch,
                pitches: [patternNote.pitch],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        }

        currentBeat += noteBeats;
        patternIndex++;
    }

    return combineConsecutiveRests(notes);
}

/**
 * Generate ballad bass pattern
 * Sparse, expressive pattern for slow songs
 * Leaves space for emotional impact
 */
function generateBalladBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;

    // Ballad pattern: sparse with breathing room
    // Pattern: root (dotted half), rest, fifth to root pickup
    const balladPattern = [
        { pitch: root, beats: 3 },     // Dotted half note
        { pitch: null, beats: 0.5 },   // Rest (breathing room)
        { pitch: fifth, beats: 0.5 },  // Pickup note
    ];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = balladPattern[patternIndex % balladPattern.length];
        let noteBeats = Math.min(patternNote.beats, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        if (patternNote.pitch === null) {
            notes.push({
                type: 'rest',
                isRest: true,
                pitch: null,
                pitches: [],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        } else {
            notes.push({
                type: 'note',
                pitch: patternNote.pitch,
                pitches: [patternNote.pitch],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        }

        currentBeat += noteBeats;
        patternIndex++;
    }

    return combineConsecutiveRests(notes);
}

// ============================================================================
// REST-BASED PATTERNS
// ============================================================================

/**
 * Generate staccato bass pattern
 * Short, detached notes with rests between
 * Creates a punchy, percussive feel
 */
function generateStaccatoBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;

    // Staccato pattern: short note followed by rest
    // Creates a punchy, detached feel with 8th notes
    const staccatoPattern = [
        { pitch: root, beats: 0.5 },   // Eighth note
        { pitch: null, beats: 0.5 },   // Eighth rest
        { pitch: fifth, beats: 0.5 },  // Eighth note
        { pitch: null, beats: 0.5 },   // Eighth rest
        { pitch: root, beats: 0.5 },   // Eighth note
        { pitch: null, beats: 0.5 },   // Eighth rest
        { pitch: root, beats: 0.5 },   // Eighth note
        { pitch: null, beats: 0.5 },   // Eighth rest
    ];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = staccatoPattern[patternIndex % staccatoPattern.length];
        let noteBeats = Math.min(patternNote.beats, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        if (patternNote.pitch === null) {
            notes.push({
                type: 'rest',
                isRest: true,
                pitch: null,
                pitches: [],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        } else {
            notes.push({
                type: 'note',
                pitch: patternNote.pitch,
                pitches: [patternNote.pitch],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        }

        currentBeat += noteBeats;
        patternIndex++;
    }

    return combineConsecutiveRests(notes);
}

/**
 * Generate call-and-response bass pattern
 * Phrases followed by rests - like a musical conversation
 * Great for gospel, blues, and soul
 */
function generateCallResponseBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;
    // Extract octave from bassNote for third calculation
    const octave = parseInt(bassNote.match(/\d+$/)?.[0] || '2');
    const third = findThird(chord.root, chord, octave + 1); // Use next octave for the third

    // Call-response pattern: "call" phrase then rest for "response"
    // Pattern: root-third-fifth (call), rest, root-fifth (response), rest
    const callResponsePattern = [
        { pitch: root, beats: 0.5 },     // Call starts
        { pitch: third, beats: 0.5 },
        { pitch: fifth, beats: 0.5 },    // Call ends
        { pitch: null, beats: 0.5 },     // Rest (response space)
        { pitch: root, beats: 0.5 },     // Response starts
        { pitch: fifth, beats: 0.5 },    // Response ends
        { pitch: null, beats: 1 },       // Rest (breathing room)
    ];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = callResponsePattern[patternIndex % callResponsePattern.length];
        let noteBeats = Math.min(patternNote.beats, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        if (patternNote.pitch === null) {
            notes.push({
                type: 'rest',
                isRest: true,
                pitch: null,
                pitches: [],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        } else {
            notes.push({
                type: 'note',
                pitch: patternNote.pitch,
                pitches: [patternNote.pitch],
                duration: duration,
                beat: currentBeat,
                dotted: dotted,
                isTied: false,
            });
        }

        currentBeat += noteBeats;
        patternIndex++;
    }

    return combineConsecutiveRests(notes);
}

// ============================================================================
// ADDITIONAL POLYPHONIC PATTERNS
// ============================================================================

/**
 * Generate open fifth bass pattern
 * Root and fifth played together with open voicing
 * Creates a powerful, open sound
 */
function generateOpenFifthBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const beatInMeasure = currentBeat % beatsPerMeasure;
        const beatsToMeasureEnd = beatsPerMeasure - beatInMeasure;

        // Use whole notes for sustained open sound
        let noteBeats = Math.min(beatsPerMeasure, remainingBeats, beatsToMeasureEnd);
        if (beatInMeasure === 0 && remainingBeats >= beatsPerMeasure) {
            noteBeats = beatsPerMeasure;
        }

        const { duration, dotted } = findBestDuration(noteBeats);

        // Root + fifth together
        notes.push({
            type: 'note',
            pitch: root,
            pitches: [root, fifth],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
    }

    return notes;
}

/**
 * Generate rock power bass pattern
 * Root and fifth power chord with rhythmic drive
 * Half note chords for rock/metal feel
 */
function generateRockPowerBlockBass(root, fifth, totalBeats, beatsPerMeasure) {
    const notes = [];
    let currentBeat = 0;

    // Rock power pattern: power chord on half notes
    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;

        // Half notes for driving rock feel
        let noteBeats = Math.min(2, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: root,
            pitches: [root, fifth],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
    }

    return notes;
}

/**
 * Generate gospel bass pattern
 * Rich passing chord movement typical of gospel music
 * Uses passing chords and chromatic approaches
 */
function generateGospelBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, effectiveOctave) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote (already calculated with correct octave)
    const root = bassNote;
    const rootMidi = noteToMidi(root);
    const third = findThird(chord.root, chord, effectiveOctave); // Chord-quality-aware third
    const fifth = findFifth(chord.root, chordNotes, effectiveOctave);
    const sixth = findSixth(chord.root, chord, effectiveOctave); // Chord-quality-aware sixth
    const passingNote = midiToNoteName(rootMidi + 2); // Whole step above root

    // Gospel pattern: root-third, passing chord, fifth-root
    // Uses chord-appropriate sixth for diatonic gospel sound
    const gospelPattern = [
        { pitches: [root, third], beats: 1 },
        { pitches: [passingNote, fifth], beats: 1 },  // Passing chord
        { pitches: [root, sixth], beats: 1 },
        { pitches: [root, fifth], beats: 1 },
    ];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = gospelPattern[patternIndex % gospelPattern.length];
        let noteBeats = Math.min(patternNote.beats, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: patternNote.pitches[0],
            pitches: patternNote.pitches,
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        patternIndex++;
    }

    return notes;
}

/**
 * Generate half-time feel bass pattern
 * Notes only on beats 1 and 3 - creates spacious feel
 * Great for ballads and slow grooves
 */
function generateHalfTimeBlockBass(chord, chordNotes, totalBeats, beatsPerMeasure, bassNote, fifth) {
    const notes = [];
    let currentBeat = 0;

    // Use passed bassNote and fifth (already calculated with correct octave)
    const root = bassNote;

    // Half-time: notes on 1 and 3 only
    const halfTimePattern = [
        { pitch: root, beats: 2 },   // Beat 1-2
        { pitch: fifth, beats: 2 },  // Beat 3-4
    ];
    let patternIndex = 0;

    while (currentBeat < totalBeats) {
        const remainingBeats = totalBeats - currentBeat;
        const patternNote = halfTimePattern[patternIndex % halfTimePattern.length];
        let noteBeats = Math.min(patternNote.beats, remainingBeats);

        const { duration, dotted } = findBestDuration(noteBeats);

        notes.push({
            type: 'note',
            pitch: patternNote.pitch,
            pitches: [patternNote.pitch],
            duration: duration,
            beat: currentBeat,
            dotted: dotted,
            isTied: false,
        });

        currentBeat += noteBeats;
        patternIndex++;
    }

    return notes;
}

/**
 * Find the best standard duration for a given number of beats
 * Returns the largest duration that fits within the beats
 * @param {number} beats - Number of beats to fill
 * @returns {object} { duration: string, dotted: boolean }
 */
function findBestDuration(beats) {
    // Check durations from longest to shortest
    if (beats >= 4) return { duration: '1n', dotted: false };
    if (beats >= 3) return { duration: '2n', dotted: true };
    if (beats >= 2) return { duration: '2n', dotted: false };
    if (beats >= 1.5) return { duration: '4n', dotted: true };
    if (beats >= 1) return { duration: '4n', dotted: false };
    if (beats >= 0.75) return { duration: '8n', dotted: true };
    if (beats >= 0.5) return { duration: '8n', dotted: false };
    return { duration: '16n', dotted: false };
}

/**
 * Combine consecutive rests into larger rest values
 * E.g., two 16th rests become one 8th rest
 * @param {Array} notes - Array of notes/rests
 * @returns {Array} Array with consecutive rests combined
 */
function combineConsecutiveRests(notes) {
    if (!notes || notes.length === 0) return notes;

    const result = [];
    let i = 0;

    while (i < notes.length) {
        const current = notes[i];

        // If not a rest, just add it and continue
        if (!current.isRest && current.type !== 'rest') {
            result.push(current);
            i++;
            continue;
        }

        // It's a rest - look ahead for consecutive rests
        let combinedBeats = getDurationBeats(current.dotted ? current.duration + '.' : current.duration);
        let currentBeat = current.beat;
        let j = i + 1;

        // Combine consecutive rests
        while (j < notes.length) {
            const next = notes[j];
            if (!next.isRest && next.type !== 'rest') break;

            // Check if this rest is adjacent (immediately follows)
            const nextBeats = getDurationBeats(next.dotted ? next.duration + '.' : next.duration);
            const expectedBeat = currentBeat + combinedBeats;

            // Allow small floating point tolerance
            if (Math.abs(next.beat - expectedBeat) < 0.001) {
                combinedBeats += nextBeats;
                j++;
            } else {
                break;
            }
        }

        // Create a single combined rest with the best duration
        const { duration, dotted } = findBestDuration(combinedBeats);

        result.push({
            type: 'rest',
            isRest: true,
            pitch: null,
            pitches: [],
            duration: duration,
            beat: current.beat,
            dotted: dotted,
            isTied: false,
        });

        i = j;
    }

    return result;
}

/**
 * Split building block bass notes into measures
 * Handles ties across measure boundaries
 *
 * @param {Array} blockNotes - Notes generated by generateBuildingBlockBass
 * @param {number} startBeat - Starting beat of the building block (absolute)
 * @param {number} beatsPerMeasure - Beats per measure
 * @param {number} chordIndex - Index of the chord/building block
 * @returns {Array} Array of measure objects, each with { measureIndex, notes }
 */
export function splitBlockBassIntoMeasures(blockNotes, startBeat, beatsPerMeasure, chordIndex) {
    const measureNotes = new Map(); // measureIndex -> notes array

    for (const note of blockNotes) {
        const absoluteBeat = startBeat + note.beat;
        const measureIndex = Math.floor(absoluteBeat / beatsPerMeasure);
        const beatInMeasure = absoluteBeat % beatsPerMeasure;

        // Get or create the notes array for this measure
        if (!measureNotes.has(measureIndex)) {
            measureNotes.set(measureIndex, []);
        }

        // Calculate note duration in beats
        const noteDurationBeats = getDurationBeats(note.dotted ? note.duration + '.' : note.duration);
        const noteEndBeat = absoluteBeat + noteDurationBeats;
        const measureEndBeat = (measureIndex + 1) * beatsPerMeasure;

        if (noteEndBeat <= measureEndBeat) {
            // Note fits entirely within this measure
            measureNotes.get(measureIndex).push({
                ...note,
                beat: beatInMeasure,
                chordIndex: chordIndex,
            });
        } else {
            // Note needs to be split across measures
            const beatsInFirstMeasure = measureEndBeat - absoluteBeat;
            const beatsInNextMeasure = noteEndBeat - measureEndBeat;

            // First part (in current measure)
            const firstPart = findBestDuration(beatsInFirstMeasure);
            measureNotes.get(measureIndex).push({
                ...note,
                beat: beatInMeasure,
                duration: firstPart.duration,
                dotted: firstPart.dotted,
                tie: 'start',
                chordIndex: chordIndex,
            });

            // Second part (in next measure) - may need further splitting
            let remainingBeats = beatsInNextMeasure;
            let currentMeasure = measureIndex + 1;
            let currentBeatInMeasure = 0;

            while (remainingBeats > 0) {
                if (!measureNotes.has(currentMeasure)) {
                    measureNotes.set(currentMeasure, []);
                }

                const beatsInThisMeasure = Math.min(remainingBeats, beatsPerMeasure - currentBeatInMeasure);
                const partDuration = findBestDuration(beatsInThisMeasure);
                const isLastPart = beatsInThisMeasure >= remainingBeats;

                measureNotes.get(currentMeasure).push({
                    type: note.type,
                    pitch: note.pitch,
                    pitches: note.pitches,
                    duration: partDuration.duration,
                    beat: currentBeatInMeasure,
                    dotted: partDuration.dotted,
                    isTied: true,
                    tie: isLastPart ? 'end' : 'continue',
                    chordIndex: chordIndex,
                });

                remainingBeats -= beatsInThisMeasure;
                currentMeasure++;
                currentBeatInMeasure = 0;
            }
        }
    }

    // Convert map to sorted array
    const result = [];
    for (const [measureIndex, notes] of measureNotes) {
        result.push({
            measureIndex,
            notes: notes.sort((a, b) => a.beat - b.beat),
        });
    }

    return result.sort((a, b) => a.measureIndex - b.measureIndex);
}
