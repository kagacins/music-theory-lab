/**
 * Bass Auto-Fill Module
 *
 * Automatically generates bass clef voicings from chord progressions
 * with intelligent voice leading and rhythm patterns.
 *
 * Based on Phase 1.2 of progression-builder-integration.md
 */

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
        isChordContinuation = false // New: is this a tied continuation from previous measure?
    } = options;

    if (!chord || !chord.root) {
        return { notes: [] };
    }

    // Get chord notes in bass register
    const chordNotes = getChordNotesInBassRegister(chord);

    // If this is a chord continuation (tied from previous measure),
    // generate a simple tied whole note (or fill the available beats)
    if (isChordContinuation) {
        return generateTiedBass(chord, chordNotes, beatsInMeasure);
    }

    // First chord: use root position
    if (!previousChord || !previousChord.root) {
        return generateFirstChordBass(chord, chordNotes, bassPattern, timeSignature, beatsInMeasure);
    }

    // Subsequent chords: use voice leading
    if (voiceLeadingStrict) {
        return generateVoiceLedBass(chord, chordNotes, previousChord, bassPattern, timeSignature, beatsInMeasure);
    }

    // Fallback: simple root note
    return generateSimpleBass(chord, chordNotes, bassPattern, timeSignature, beatsInMeasure);
}

/**
 * Get chord notes transposed to bass register (octave 2-3)
 * @param {object} chord - Chord data
 * @returns {array} Array of note names in bass register
 */
function getChordNotesInBassRegister(chord) {
    if (!chord.notes || chord.notes.length === 0) {
        // Fallback: just use root note
        return [`${chord.root}2`, `${chord.root}3`];
    }

    // Filter out omitted notes before processing
    const voicedNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));

    // If all notes are omitted, use root as fallback
    if (voicedNotes.length === 0) {
        return [`${chord.root}2`, `${chord.root}3`];
    }

    // Remove octave numbers and add bass octaves
    const noteNames = voicedNotes.map(note => note.replace(/\d+$/, ''));
    const uniqueNotes = [...new Set(noteNames)]; // Remove duplicates

    // Create bass register versions
    const bassNotes = [];

    // First add all notes in octave 2
    uniqueNotes.forEach(note => {
        bassNotes.push(`${note}2`);
    });

    // Then add all notes in octave 3
    uniqueNotes.forEach(note => {
        bassNotes.push(`${note}3`);
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
 * @returns {object} Bass voicing
 */
function generateFirstChordBass(chord, chordNotes, pattern, timeSignature) {
    const root = `${chord.root}2`; // Root in bass octave

    if (pattern === 'whole-note') {
        return {
            notes: [{
                type: 'note',
                pitch: root,
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
                { type: 'note', pitch: root, duration: '2n', beat: 0, dotted: false },
                { type: 'note', pitch: fifth, duration: '2n', beat: 2, dotted: false }
            ]
        };
    }

    if (pattern === 'arpeggio' && timeSignature.num === 4) {
        return generateArpeggioPattern(chordNotes, timeSignature);
    }

    if (pattern === 'alberti' && timeSignature.num === 4) {
        return generateAlbertiPattern(chordNotes, timeSignature);
    }

    if (pattern === 'walking' && timeSignature.num === 4) {
        // For first chord, create walking pattern starting from root
        // Pattern: root → up a step → back to root → fifth
        const rootMidi = noteToMidi(root);
        const approachNote = midiToNoteName(rootMidi + 1); // Whole step up
        const fifth = findFifth(chord.root, chordNotes);

        return {
            notes: [
                { type: 'note', pitch: root, duration: '4n', beat: 0, dotted: false },
                { type: 'note', pitch: approachNote, duration: '4n', beat: 1, dotted: false },
                { type: 'note', pitch: root, duration: '4n', beat: 2, dotted: false },
                { type: 'note', pitch: fifth, duration: '4n', beat: 3, dotted: false }
            ]
        };
    }

    // Default: whole note
    return {
        notes: [{
            type: 'note',
            pitch: root,
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
 * @returns {object} Bass voicing
 */
function generateVoiceLedBass(chord, chordNotes, previousChord, pattern, timeSignature) {
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

    // Phase 1C Round 4 Fix: Only use voice leading (closestNote) for whole-note pattern
    // All other patterns (root-fifth, arpeggio, alberti, walking) should use the actual chord root
    // to maintain the pattern's musical intent
    const actualRoot = `${chord.root}2`;

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
                // Use actual root, not voice-led note, to maintain root-fifth pattern integrity
                { type: 'note', pitch: actualRoot, duration: '2n', beat: 0, dotted: false },
                { type: 'note', pitch: fifth, duration: '2n', beat: 2, dotted: false }
            ]
        };
    }

    if (pattern === 'arpeggio') {
        // Arpeggio should start from the root and ascend through chord tones
        return generateArpeggioPattern(chordNotes, timeSignature);
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
 * @returns {object} Bass voicing with tied notes
 */
function generateTiedBass(chord, chordNotes, beatsInMeasure) {
    const root = `${chord.root}2`;

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
            pitch: root,
            duration: duration,
            beat: 0,
            dotted: duration.includes('.'),
            isTied: true // Mark as tied from previous measure
        }]
    };
}

/**
 * Generate simple bass (root note)
 * @param {object} chord - Chord data
 * @param {array} chordNotes - Available bass notes
 * @param {string} pattern - Bass pattern
 * @param {object} timeSignature - Time signature
 * @param {number} beatsInMeasure - Number of beats to fill (default: 4)
 * @returns {object} Bass voicing
 */
function generateSimpleBass(chord, chordNotes, pattern, timeSignature, beatsInMeasure = 4) {
    const root = `${chord.root}2`;

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
            pitch: root,
            duration: duration,
            beat: 0,
            dotted: duration.includes('.')
        }]
    };
}

/**
 * Find the fifth of a chord in the bass register
 * @param {string} root - Root note name (e.g., 'C', 'D#')
 * @param {array} chordNotes - Available chord notes
 * @returns {string} Fifth note name
 */
function findFifth(root, chordNotes) {
    const fifthInterval = 7; // Perfect fifth
    const rootMidi = noteToMidi(`${root}2`);
    const fifthMidi = rootMidi + fifthInterval;

    // Find the note in chordNotes closest to the perfect fifth
    const closest = findClosestNote(chordNotes, fifthMidi);

    return closest || `${root}2`;
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
 * Generate arpeggio pattern (ascending chord tones)
 * @param {array} chordNotes - Chord notes
 * @param {object} timeSignature - Time signature
 * @param {string|null} startNote - Optional starting note for voice leading
 * @returns {object} Bass voicing
 */
function generateArpeggioPattern(chordNotes, timeSignature, startNote = null) {
    const { num } = timeSignature;

    if (num === 4) {
        // Quarter note arpeggio: C - E - G - C
        const notes = chordNotes.slice(0, 4);
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
        // Quarter note arpeggio in 3/4: C - E - G
        const notes = chordNotes.slice(0, 3);
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

    // Fallback: whole note
    return {
        notes: [{
            type: 'note',
            pitch: chordNotes[0],
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
