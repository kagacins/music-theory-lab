/**
 * VexFlow Renderer - Core rendering engine for professional music notation
 * Part of the Phase 4.4 VexFlow Professional Notation enhancement
 *
 * This module provides the foundation for rendering music notation using VexFlow,
 * including note conversion, duration mapping, accidental handling, and core rendering.
 */

// VexFlow is loaded globally from the browser build
// Use a getter function to check at runtime, not at module load time
// VexFlow 5.x uses window.VexFlow, older versions use window.Vex.Flow
function getVF() {
  return window.VexFlow || (window.Vex ? window.Vex.Flow : null);
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Duration mapping from Tone.js format to VexFlow format
 * Tone.js uses: 1n, 2n, 4n, 8n, 16n, 32n, 64n (with optional dot: 2n., 4n., etc.)
 * VexFlow uses: w, h, q, 8, 16, 32, 64 (with 'd' suffix for dotted: hd, qd, etc.)
 */
export const DURATION_MAP = {
  '1n': 'w',      // whole
  '2n': 'h',      // half
  '4n': 'q',      // quarter
  '8n': '8',      // eighth
  '16n': '16',    // sixteenth
  '32n': '32',    // thirty-second
  '64n': '64',    // sixty-fourth
  '2n.': 'hd',    // dotted half
  '4n.': 'qd',    // dotted quarter
  '8n.': '8d',    // dotted eighth
  '16n.': '16d',  // dotted sixteenth
  '32n.': '32d',  // dotted thirty-second
  // Tuplet durations - map to base note visual representation
  // (VexFlow handles the tuplet bracket/number separately)
  '4t': 'q',      // Quarter triplet
  '8t': '8',      // Eighth triplet
  '16t': '16',    // 16th triplet
  '4q': 'q',      // Quarter quintuplet
  '8q': '8',      // Eighth quintuplet
  '16q': '16',    // 16th quintuplet
  '4x': 'q',      // Quarter sextuplet
  '8x': '8',      // Eighth sextuplet
  '16x': '16',    // 16th sextuplet
};

/**
 * Reverse mapping for VexFlow to Tone.js duration
 */
export const REVERSE_DURATION_MAP = {
  'w': '1n',
  'h': '2n',
  'q': '4n',
  '8': '8n',
  '16': '16n',
  '32': '32n',
  '64': '64n',
  'wd': '1n.',
  'hd': '2n.',
  'qd': '4n.',
  '8d': '8n.',
  '16d': '16n.',
  '32d': '32n.',
};

/**
 * Duration values in beats (for 4/4 time)
 */
export const DURATION_BEATS = {
  'w': 4,
  'h': 2,
  'q': 1,
  '8': 0.5,
  '16': 0.25,
  '32': 0.125,
  '64': 0.0625,
  'wd': 6,
  'hd': 3,
  'qd': 1.5,
  '8d': 0.75,
  '16d': 0.375,
  '32d': 0.1875,
};

/**
 * Tone.js duration values in beats
 */
export const TONE_DURATION_BEATS = {
  '1n': 4,
  '2n': 2,
  '4n': 1,
  '8n': 0.5,
  '16n': 0.25,
  '32n': 0.125,
  '64n': 0.0625,
  '1n.': 6,
  '2n.': 3,
  '4n.': 1.5,
  '8n.': 0.75,
  '16n.': 0.375,
  '32n.': 0.1875,
  // Tuplet durations (actual beat values)
  '4t': 2/3,        // Quarter triplet = 2/3 beat
  '8t': 1/3,        // Eighth triplet = 1/3 beat
  '16t': 1/6,       // 16th triplet = 1/6 beat
  '4q': 4/5,        // Quarter quintuplet = 4/5 beat
  '8q': 2/5,        // Eighth quintuplet = 2/5 beat
  '16q': 1/5,       // 16th quintuplet = 1/5 beat
  '4x': 2/3,        // Quarter sextuplet = 2/3 beat (same as triplet)
  '8x': 1/3,        // Eighth sextuplet = 1/3 beat
  '16x': 1/6,       // 16th sextuplet = 1/6 beat
};

/**
 * Key signature accidentals (sharps/flats for each key)
 */
export const KEY_SIGNATURES = {
  'C': [],
  'G': ['F#'],
  'D': ['F#', 'C#'],
  'A': ['F#', 'C#', 'G#'],
  'E': ['F#', 'C#', 'G#', 'D#'],
  'B': ['F#', 'C#', 'G#', 'D#', 'A#'],
  'F#': ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'],
  'C#': ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'],
  'F': ['Bb'],
  'Bb': ['Bb', 'Eb'],
  'Eb': ['Bb', 'Eb', 'Ab'],
  'Ab': ['Bb', 'Eb', 'Ab', 'Db'],
  'Db': ['Bb', 'Eb', 'Ab', 'Db', 'Gb'],
  'Gb': ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
  'Cb': ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'],
  // Minor keys (use relative major key signatures)
  'Am': [],
  'Em': ['F#'],
  'Bm': ['F#', 'C#'],
  'F#m': ['F#', 'C#', 'G#'],
  'C#m': ['F#', 'C#', 'G#', 'D#'],
  'G#m': ['F#', 'C#', 'G#', 'D#', 'A#'],
  'D#m': ['F#', 'C#', 'G#', 'D#', 'A#', 'E#'],
  'A#m': ['F#', 'C#', 'G#', 'D#', 'A#', 'E#', 'B#'],
  'Dm': ['Bb'],
  'Gm': ['Bb', 'Eb'],
  'Cm': ['Bb', 'Eb', 'Ab'],
  'Fm': ['Bb', 'Eb', 'Ab', 'Db'],
  'Bbm': ['Bb', 'Eb', 'Ab', 'Db', 'Gb'],
  'Ebm': ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'],
  'Abm': ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'],
};

/**
 * Comfortable note ranges for each clef (MIDI numbers)
 * Notes outside these ranges will get octave shift indicators (8va, 8vb, etc.)
 * PHASE 1.4+: Adjusted thresholds - 8va starts at E6 (88), 8vb starts below F3 (includes E3)
 */
export const CLEF_RANGES = {
  treble: {
    min: 53,    // F3 - notes at E3 (52) and below get 8vb
    max: 87,    // D#6 - notes at E6 (88) and above get 8va
    min16: 40,  // E2 - notes below get 16vb (two octaves)
    max16: 99,  // D#7 - notes at E7 (100) and above get 16va (two octaves)
    min32: 28,  // E1 - notes below get 32vb (three octaves)
    max32: 111  // D#8 - notes at E8 (112) and above get 32va (three octaves)
  },
  bass: {
    min: 36,    // C2 - notes below get 8vb
    max: 71,    // B4 - notes above get 8va
    min16: 24,  // C1 - notes below get 16vb
    max16: 83,  // B5 - notes above get 16va
    min32: 12,  // C0 - notes below get 32vb
    max32: 95   // B6 - notes above get 32va
  },
};

/**
 * Note names for pitch class calculations
 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// ============================================================================
// NOTE CONVERSION UTILITIES
// ============================================================================

/**
 * Parse a note string like "C4", "F#5", "Bb3" into components
 * @param {string} noteStr - Note string with octave
 * @returns {Object} - { noteName: string, octave: number, accidental: string|null }
 */
export function parseNote(noteStr) {
  if (!noteStr || typeof noteStr !== 'string') {
    return { noteName: 'C', octave: 4, accidental: null };
  }

  const match = noteStr.match(/^([A-Ga-g])([#b]?)(\d+)?$/);
  if (!match) {
    console.warn(`Invalid note format: ${noteStr}`);
    return { noteName: 'C', octave: 4, accidental: null };
  }

  const noteName = match[1].toUpperCase();
  const accidental = match[2] || null;
  const octave = match[3] ? parseInt(match[3], 10) : 4;

  return { noteName, octave, accidental };
}

/**
 * Convert a note string to VexFlow key format
 * VexFlow uses: "C/4", "F#/5", "Bb/3"
 * @param {string} noteStr - Note string like "C4", "F#5"
 * @returns {string} - VexFlow key format
 */
export function noteToVexKey(noteStr) {
  const { noteName, octave, accidental } = parseNote(noteStr);
  const fullNote = noteName + (accidental || '');
  return `${fullNote}/${octave}`;
}

/**
 * Calculate automatic stem direction based on note pitch and clef
 * Standard convention:
 * - Treble clef: Notes on B4 or above get stems down, below B4 get stems up
 * - Bass clef: Notes on D3 or above get stems down, below D3 get stems up
 * @param {string|string[]} pitch - Note pitch(es) like "C4", "F#5" or array of pitches
 * @param {string} clef - 'treble' or 'bass'
 * @returns {number} - 1 for stem up, -1 for stem down
 */
export function calculateAutoStemDirection(pitch, clef = 'treble') {
  // For chords, use the average pitch or the middle note
  let pitchToCheck = pitch;
  if (Array.isArray(pitch)) {
    // Use the middle pitch for stem direction calculation
    const middleIndex = Math.floor(pitch.length / 2);
    pitchToCheck = pitch[middleIndex];
  }

  const { noteName, octave } = parseNote(pitchToCheck);

  // Convert to a numeric value for comparison (C=0, D=2, E=4, F=5, G=7, A=9, B=11)
  const noteValues = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const noteValue = noteValues[noteName] || 0;

  // Calculate absolute pitch position (octave * 12 + note value)
  const pitchPosition = octave * 12 + noteValue;

  // Middle line references:
  // Treble clef: B4 = 4 * 12 + 11 = 59
  // Bass clef: D3 = 3 * 12 + 2 = 38
  const middleLine = clef === 'bass' ? 38 : 59;

  // Notes at or above middle line get stems down (-1), below get stems up (1)
  return pitchPosition >= middleLine ? -1 : 1;
}

/**
 * Convert VexFlow key format back to note string
 * @param {string} vexKey - VexFlow key like "C/4", "F#/5"
 * @returns {string} - Note string like "C4", "F#5"
 */
export function vexKeyToNote(vexKey) {
  const parts = vexKey.split('/');
  if (parts.length !== 2) return vexKey;
  return `${parts[0]}${parts[1]}`;
}

/**
 * Convert note to MIDI number
 * @param {string} noteStr - Note string like "C4", "F#5"
 * @returns {number} - MIDI number (0-127)
 */
export function noteToMidi(noteStr) {
  const { noteName, octave, accidental } = parseNote(noteStr);

  let pitchClass = NOTE_NAMES.indexOf(noteName);
  if (pitchClass === -1) {
    pitchClass = NOTE_NAMES_FLAT.indexOf(noteName);
  }
  if (pitchClass === -1) pitchClass = 0;

  if (accidental === '#') pitchClass += 1;
  else if (accidental === 'b') pitchClass -= 1;

  // Normalize pitch class
  pitchClass = ((pitchClass % 12) + 12) % 12;

  return (octave + 1) * 12 + pitchClass;
}

/**
 * Convert MIDI number to note string
 * @param {number} midi - MIDI number (0-127)
 * @param {boolean} useFlats - Use flat names instead of sharps
 * @returns {string} - Note string like "C4", "F#5"
 */
export function midiToNote(midi, useFlats = false) {
  const octave = Math.floor(midi / 12) - 1;
  const pitchClass = midi % 12;
  const noteName = useFlats ? NOTE_NAMES_FLAT[pitchClass] : NOTE_NAMES[pitchClass];
  return `${noteName}${octave}`;
}

/**
 * Convert Tone.js duration to VexFlow duration
 * @param {string} toneDuration - Tone.js duration like "4n", "8n."
 * @returns {string} - VexFlow duration like "q", "8d"
 */
export function convertDuration(toneDuration) {
  return DURATION_MAP[toneDuration] || 'q';
}

/**
 * Convert VexFlow duration to Tone.js duration
 * @param {string} vexDuration - VexFlow duration like "q", "8d"
 * @returns {string} - Tone.js duration like "4n", "8n."
 */
export function convertDurationToTone(vexDuration) {
  return REVERSE_DURATION_MAP[vexDuration] || '4n';
}

/**
 * Get the number of beats for a duration
 * @param {string} duration - VexFlow or Tone.js duration
 * @returns {number} - Number of beats
 */
export function getDurationBeats(duration) {
  return DURATION_BEATS[duration] || TONE_DURATION_BEATS[duration] || 1;
}

/**
 * Calculate optimal note+tie combination to fill a given number of beats
 * Uses the fewest number of notes+ties possible
 * Examples:
 *   7 beats = whole note (4) + dotted half (3)
 *   5 beats = whole note (4) + quarter (1)
 *   1.5 beats = dotted quarter (1.5)
 *   2.25 beats = half (2) + sixteenth (0.25)
 *
 * @param {number} beats - Number of beats to fill
 * @returns {Array<{duration: string, beats: number, dotted: boolean}>} - Array of note durations in VexFlow format
 */
export function calculateNoteTieCombination(beats) {
  // Available note durations in descending order (including dotted notes)
  // Format: [vexflow_duration, beats, is_dotted]
  const durations = [
    { duration: 'w', beats: 6, dotted: true },    // dotted whole (rarely used, but possible)
    { duration: 'w', beats: 4, dotted: false },   // whole
    { duration: 'h', beats: 3, dotted: true },    // dotted half
    { duration: 'h', beats: 2, dotted: false },   // half
    { duration: 'q', beats: 1.5, dotted: true },  // dotted quarter
    { duration: 'q', beats: 1, dotted: false },   // quarter
    { duration: '8', beats: 0.75, dotted: true }, // dotted eighth
    { duration: '8', beats: 0.5, dotted: false }, // eighth
    { duration: '16', beats: 0.375, dotted: true }, // dotted sixteenth
    { duration: '16', beats: 0.25, dotted: false }, // sixteenth
    { duration: '32', beats: 0.1875, dotted: true }, // dotted thirty-second
    { duration: '32', beats: 0.125, dotted: false } // thirty-second
  ];

  const result = [];
  let remaining = beats;

  // Greedy algorithm: use largest possible durations first
  for (const { duration, beats: durationBeats, dotted } of durations) {
    while (remaining >= durationBeats - 0.0001) { // Small epsilon for floating point comparison
      result.push({ duration, beats: durationBeats, dotted });
      remaining -= durationBeats;
      // Round to avoid floating point errors
      remaining = Math.round(remaining * 10000) / 10000;
    }
    if (remaining < 0.001) break; // Done
  }

  // If there's still a tiny remainder (floating point error), ignore it
  if (remaining > 0.001) {
    console.warn(`Could not perfectly fill ${beats} beats. Remaining: ${remaining}`);
  }

  return result;
}

// ============================================================================
// ACCIDENTAL HANDLING
// ============================================================================

/**
 * Determine if a note needs an accidental based on key signature
 * @param {string} noteStr - Note string like "C4", "F#5"
 * @param {string} key - Key signature like "C", "G", "F"
 * @returns {string|null} - Accidental to display: '#', 'b', 'n', or null
 */
export function getRequiredAccidental(noteStr, key) {
  const { noteName, accidental } = parseNote(noteStr);
  const keyAccidentals = KEY_SIGNATURES[key] || [];

  const fullNote = noteName + (accidental || '');
  const noteBase = noteName;

  // Check if this note (with any accidental) is in the key signature
  const sharpInKey = keyAccidentals.includes(noteBase + '#');
  const flatInKey = keyAccidentals.includes(noteBase + 'b');

  if (accidental === '#') {
    // Note has sharp - show if not in key signature
    return sharpInKey ? null : '#';
  } else if (accidental === 'b') {
    // Note has flat - show if not in key signature
    return flatInKey ? null : 'b';
  } else {
    // Natural note - show natural if key has accidental on this note
    if (sharpInKey || flatInKey) {
      return 'n';
    }
    return null;
  }
}

/**
 * Create a measure-level accidental tracker
 * Tracks which accidentals have been shown in the current measure
 * so we can properly show naturals when an accidental is cancelled
 * @returns {Object} - Tracker object with methods
 */
export function createMeasureAccidentalTracker() {
  // Map: note letter (A-G) -> current accidental state in this measure
  // null = use key signature default, '#' = sharp shown, 'b' = flat shown, 'n' = natural shown
  const activeAccidentals = new Map();

  return {
    /**
     * Determine what accidental to show for a note, considering measure context
     * @param {string} noteStr - Note string like "C4", "F#5", "Bb3"
     * @param {string} key - Key signature
     * @returns {string|null} - Accidental to show: '#', 'b', 'n', or null
     */
    getAccidentalForNote(noteStr, key) {
      const { noteName, accidental } = parseNote(noteStr);
      const keyAccidentals = KEY_SIGNATURES[key] || [];

      // What's the key signature default for this note?
      const sharpInKey = keyAccidentals.includes(noteName + '#');
      const flatInKey = keyAccidentals.includes(noteName + 'b');
      const keyDefault = sharpInKey ? '#' : flatInKey ? 'b' : null;

      // What's currently active in this measure for this note letter?
      const measureActive = activeAccidentals.get(noteName);

      // What does the current note want?
      const noteWants = accidental || null; // '#', 'b', or null (natural)

      // Determine if we need to show an accidental
      let showAccidental = null;

      if (measureActive !== undefined) {
        // Something was already shown in this measure for this note letter
        if (noteWants !== measureActive) {
          // Note wants something different than what's active
          if (noteWants === null) {
            // Note wants natural, but measure has sharp/flat active
            // Show natural if key signature doesn't already have it natural
            if (keyDefault !== null) {
              showAccidental = 'n';
            } else {
              // Key is already natural, measure had accidental, need to cancel it
              showAccidental = 'n';
            }
          } else {
            // Note wants sharp or flat, different from measure active
            showAccidental = noteWants;
          }
        }
        // else: note wants same as measure active, no accidental needed
      } else {
        // First occurrence of this note letter in the measure
        // Compare against key signature
        if (noteWants !== keyDefault) {
          if (noteWants === null && keyDefault !== null) {
            // Note is natural but key has accidental - show natural
            showAccidental = 'n';
          } else if (noteWants !== null) {
            // Note has accidental not in key - show it
            showAccidental = noteWants;
          }
        }
        // else: matches key signature, no accidental needed
      }

      // Update the active state for this note letter
      activeAccidentals.set(noteName, noteWants);

      return showAccidental;
    },

    /**
     * Reset the tracker (call at start of each measure)
     */
    reset() {
      activeAccidentals.clear();
    },

    /**
     * Get current active accidental for a note letter (for debugging)
     * @param {string} noteName - Note letter (A-G)
     * @returns {string|null|undefined} - Active accidental or undefined if not set
     */
    getActive(noteName) {
      return activeAccidentals.get(noteName);
    }
  };
}

/**
 * Get VexFlow key signature string from key name
 * @param {string} key - Key name like "C Major", "G", "Am"
 * @returns {string} - VexFlow key signature like "C", "G", "Am"
 */
export function getVexFlowKeySignature(key) {
  if (!key) return 'C';

  // Handle formats like "C Major", "A Minor", "G"
  const normalized = key
    .replace(/\s*(Major|major|M)\s*$/i, '')
    .replace(/\s*(Minor|minor)\s*$/i, 'm')
    .trim();

  return normalized || 'C';
}

// ============================================================================
// OCTAVE SHIFT CALCULATIONS
// ============================================================================

/**
 * Calculate if a note needs octave shift for display
 * @param {string} noteStr - Note string like "C4", "F#5"
 * @param {string} clef - 'treble' or 'bass'
 * @returns {Object} - { shift: number, label: string|null }
 */
export function getOctaveShift(noteStr, clef = 'treble') {
  const midi = noteToMidi(noteStr);
  const range = CLEF_RANGES[clef];

  if (midi > range.max + 12) {
    return { shift: -2, label: '15ma' }; // Down 2 octaves for display
  } else if (midi > range.max) {
    return { shift: -1, label: '8va' };  // Down 1 octave for display
  } else if (midi < range.min - 12) {
    return { shift: 2, label: '15mb' };  // Up 2 octaves for display
  } else if (midi < range.min) {
    return { shift: 1, label: '8vb' };   // Up 1 octave for display
  }

  return { shift: 0, label: null };
}

/**
 * Apply octave shift to a note for display
 * @param {string} noteStr - Note string like "C4", "F#5"
 * @param {number} shift - Octave shift amount
 * @returns {string} - Shifted note string
 */
export function applyOctaveShift(noteStr, shift) {
  if (shift === 0) return noteStr;

  const { noteName, octave, accidental } = parseNote(noteStr);
  const newOctave = octave + shift;
  return `${noteName}${accidental || ''}${newOctave}`;
}

// ============================================================================
// VEXFLOW CREATION HELPERS
// ============================================================================

/**
 * Create a VexFlow renderer for a container element
 * @param {HTMLElement} container - Container element (canvas or div)
 * @param {number} width - Width in pixels
 * @param {number} height - Height in pixels
 * @returns {Object} - { renderer, context }
 */
export function createRenderer(container, width, height) {
  const VF = getVF();
  if (!VF) {
    return null;
  }

  // Clear existing content (but DON'T manually resize - let VexFlow do it in one step)
  if (container.tagName === 'CANVAS') {
    const ctx = container.getContext('2d');
    ctx.clearRect(0, 0, container.width, container.height);
    // REMOVED: Manual resize that was causing double-resize and triggering scroll
    // container.width = width;
    // container.height = height;
  } else {
    container.innerHTML = '';
  }

  // Let VexFlow handle the resize in ONE operation (not two)
  const renderer = new VF.Renderer(container, VF.Renderer.Backends.CANVAS);
  renderer.resize(width, height);
  const context = renderer.getContext();

  return { renderer, context };
}

/**
 * Create a VexFlow stave
 * @param {Object} options - Stave options
 * @returns {Object} - VexFlow Stave object
 */
export function createStave(options = {}) {
  const VF = getVF();
  if (!VF) return null;

  const {
    x = 10,
    y = 40,
    width = 400,
    clef = 'treble',
    timeSignature = null,
    keySignature = null,
    showClef = true,
    showTimeSignature = true,
    showKeySignature = true,
  } = options;

  const stave = new VF.Stave(x, y, width);

  if (showClef) {
    stave.addClef(clef);
  }

  if (showKeySignature && keySignature) {
    stave.addKeySignature(getVexFlowKeySignature(keySignature));
  }

  if (showTimeSignature && timeSignature) {
    const [num, denom] = timeSignature.split('/');
    stave.addTimeSignature(`${num}/${denom}`);
  }

  return stave;
}

/**
 * Create a VexFlow StaveNote from note data
 * @param {Object} noteData - Note data object
 * @param {string} key - Key signature for accidentals
 * @param {string} clef - Clef for the note
 * @returns {Object} - VexFlow StaveNote
 */
export function createStaveNote(noteData, key = 'C', clef = 'treble') {
  const VF = getVF();
  if (!VF) return null;

  const {
    pitch,           // Note string like "C4", "F#5"
    duration,        // Tone.js or VexFlow duration
    isRest = false,  // Is this a rest?
    dotted = false,  // Is this dotted?
    accidental = null, // Explicit accidental override
    articulation = null, // Articulation: 'staccato', 'accent', 'tenuto', 'marcato'
    stemDirection = null, // Optional stem direction: 1 (up), -1 (down), null (auto)
    isCue = false,   // Create as cue-sized (smaller) note/rest
  } = noteData;

  // Convert duration if needed
  let vexDuration = DURATION_MAP[duration] || duration || 'q';

  // Check if the duration is dotted (either from dotted flag OR from duration string like '2n.')
  const isDotted = dotted || (duration && duration.endsWith('.')) || vexDuration.endsWith('d');

  // Add 'r' suffix for rests
  if (isRest) {
    // Remove the 'd' (dotted) suffix temporarily, add 'r' for rest
    vexDuration = vexDuration.replace(/d$/, '') + 'r';
    // Re-add 'd' if it was dotted
    if (isDotted) vexDuration = vexDuration.replace('r', 'dr');
  } else if (isDotted && !vexDuration.includes('d')) {
    vexDuration += 'd';
  }

  // Create the note
  let keys, noteConfig;

  if (isRest) {
    // Rest position based on clef
    const restLine = clef === 'bass' ? 'D/3' : 'B/4';
    keys = [restLine];
    noteConfig = { keys, duration: vexDuration, clef };
  } else {
    // Convert pitch to VexFlow key format
    const vexKey = noteToVexKey(pitch);
    keys = [vexKey];
    noteConfig = { keys, duration: vexDuration, clef };
  }

  // For cue-sized notes/rests, set glyph_font_scale at construction time
  // VexFlow 5.x requires this to be in the constructor config, not set after
  if (isCue) {
    // Make cue rests noticeably smaller - about 60% of normal size
    // VexFlow default is typically 39, so 39 * 0.6 = ~23
    // Hardcode the value since VF.DEFAULT_NOTATION_FONT_SCALE may not exist in all versions
    const CUE_FONT_SCALE = 23; // ~60% of normal (39)
    noteConfig.glyph_font_scale = CUE_FONT_SCALE;
    // Smaller ledger lines for cue notes
    noteConfig.stroke_px = 1;
    console.log(`[createStaveNote] Creating cue note/rest with glyph_font_scale=${CUE_FONT_SCALE}`);
  }

  // Determine stem direction for non-rest notes
  let finalStemDirection = null;
  if (!isRest) {
    if (stemDirection !== null && stemDirection !== undefined) {
      finalStemDirection = stemDirection;
    } else {
      // Calculate stem direction based on pitch position relative to middle line
      finalStemDirection = calculateAutoStemDirection(pitch, clef);
    }
  }

  // Debug: log noteConfig when creating cue notes
  if (isCue) {
    console.log('[createStaveNote] noteConfig for cue:', JSON.stringify(noteConfig));
  }

  const staveNote = new VF.StaveNote(noteConfig);

  // Debug: check if render_options has glyph_font_scale
  if (isCue && staveNote.render_options) {
    console.log('[createStaveNote] staveNote.render_options:', staveNote.render_options);
  }

  // Set stem direction AFTER creation using setStemDirection() - config property gets ignored
  if (finalStemDirection !== null && staveNote.setStemDirection) {
    staveNote.setStemDirection(finalStemDirection);
  }

  // Add accidentals for non-rest notes
  if (!isRest) {
    const requiredAccidental = accidental || getRequiredAccidental(pitch, key);
    if (requiredAccidental) {
      try {
        // Always pass index 0 for single notes (required by VexFlow)
        staveNote.addModifier(new VF.Accidental(requiredAccidental), 0);
      } catch (error) {
        console.warn('[VexFlowRenderer] Error adding accidental modifier:', error.message);
        // Don't crash - the accidental will be missing but note will still render
      }
    }
  }

  // Add dot if needed (use isDotted which checks both dotted flag and duration string)
  // Note: Rests don't use addDot() - the dot is already encoded in the duration string (e.g., 'hdr')
  if (isDotted && !isRest) {
    staveNote.addDot(0);
  }

  // Add articulation if specified
  if (!isRest && articulation) {
    const articulationMap = {
      'staccato': 'a.',
      'accent': 'a>',
      'tenuto': 'a-',
      'marcato': 'a^',
    };

    const vexArticulation = articulationMap[articulation];
    if (vexArticulation) {
      staveNote.addModifier(new VF.Articulation(vexArticulation), 0);
    }
  }

  return staveNote;
}

/**
 * Create VexFlow StaveNotes for a chord (multiple simultaneous notes)
 * @param {Array} pitches - Array of pitch strings
 * @param {string} duration - Duration for all notes
 * @param {string} key - Key signature
 * @param {string} clef - Clef for the chord
 * @param {boolean} dotted - Is the chord dotted
 * @param {string} articulation - Articulation for the chord
 * @param {string|Array|null} accidental - Explicit accidental override (string for all pitches, array for per-pitch)
 * @returns {Object} - VexFlow StaveNote with multiple keys
 */
export function createChordNote(pitches, duration = '4n', key = 'C', clef = 'treble', dotted = false, articulation = null, accidental = null, stemDirection = null) {
  const VF = getVF();
  if (!VF || !pitches || pitches.length === 0) return null;

  // Convert duration and add 'd' suffix if dotted
  let vexDuration = DURATION_MAP[duration] || duration || 'q';
  if (dotted && !vexDuration.includes('d')) {
    vexDuration += 'd';
  }

  // Convert all pitches to VexFlow keys
  const keys = pitches.map(pitch => noteToVexKey(pitch));

  // Create the chord note config
  const noteConfig = {
    keys,
    duration: vexDuration,
    clef,
  };

  // Determine stem direction
  let finalStemDirection;
  if (stemDirection !== null && stemDirection !== undefined) {
    finalStemDirection = stemDirection;
  } else {
    // Calculate stem direction based on pitch position relative to middle line
    finalStemDirection = calculateAutoStemDirection(pitches, clef);
  }

  // Create the chord note (don't pass stem_direction in config - it gets ignored)
  const staveNote = new VF.StaveNote(noteConfig);

  // Set stem direction AFTER creation using setStemDirection()
  if (staveNote.setStemDirection) {
    staveNote.setStemDirection(finalStemDirection);
  }

  // Add accidentals for each pitch
  // Supports: string (applies to all), array (per-pitch), or null (auto-detect from key)
  pitches.forEach((pitch, index) => {
    let requiredAccidental;

    if (Array.isArray(accidental)) {
      // Per-pitch accidentals array - use undefined check, not truthiness
      // (null means "no accidental needed" from measure tracker, don't fall back)
      requiredAccidental = accidental[index] !== undefined ? accidental[index] : getRequiredAccidental(pitch, key);
    } else if (typeof accidental === 'string' && pitches.length === 1) {
      // Single accidental for single-note chord
      requiredAccidental = accidental;
    } else {
      // Auto-detect from key signature
      requiredAccidental = getRequiredAccidental(pitch, key);
    }

    if (requiredAccidental) {
      try {
        staveNote.addModifier(new VF.Accidental(requiredAccidental), index);
      } catch (error) {
        console.warn('[VexFlowRenderer] Error adding accidental to chord note:', error.message);
      }
    }
  });

  // Add dot modifier for each note in the chord
  if (dotted) {
    // Use VexFlow Dot modifier
    pitches.forEach((_, index) => {
      staveNote.addModifier(new VF.Dot(), index);
    });
  }

  // Add articulation if specified (applied to the entire chord)
  if (articulation) {
    const articulationMap = {
      'staccato': 'a.',
      'accent': 'a>',
      'tenuto': 'a-',
      'marcato': 'a^',
    };

    const vexArticulation = articulationMap[articulation];
    if (vexArticulation) {
      // For chords, apply articulation to the top note (last index)
      staveNote.addModifier(new VF.Articulation(vexArticulation), pitches.length - 1);
    }
  }

  return staveNote;
}

/**
 * Create a rest note
 * @param {string} duration - Duration of the rest
 * @param {string} clef - Clef for positioning
 * @param {Object} options - Optional settings for rest appearance
 * @param {boolean} options.isCue - If true, render as cue-sized (smaller) rest
 * @param {boolean} options.hidden - If true, rest is hidden (for clean notation mode)
 * @returns {Object} - VexFlow StaveNote (rest)
 */
export function createRest(duration = '4n', clef = 'treble', options = {}) {
  const { isCue = false, hidden = false } = options;

  // Pass isCue to createStaveNote so it can set glyph_font_scale at construction time
  // VexFlow 5.x requires scale to be set in constructor, not after
  const restNote = createStaveNote({
    pitch: null,
    duration,
    isRest: true,
    isCue, // Pass cue flag to constructor
  }, 'C', clef);

  if (!restNote) return null;

  // Mark as hidden FIRST (priority: invisible spacer but selectable)
  if (hidden) {
    restNote.glyph = null; // Remove glyph to make it not render
    restNote._isHiddenRest = true;
    restNote._isCueRest = isCue;
    return restNote;
  }

  // Apply cue color styling AFTER creation (color can be set post-construction)
  if (isCue && restNote.setStyle) {
    restNote.setStyle({
      fillStyle: 'rgba(0, 0, 0, 0.4)',
      strokeStyle: 'rgba(0, 0, 0, 0.4)',
    });
    // Try to add CSS class for post-render scaling
    if (restNote.addClass) {
      restNote.addClass('vf-cue-rest');
    }
    // Also set attribute for finding in DOM
    if (restNote.setAttribute) {
      restNote.setAttribute('data-cue-rest', 'true');
    }
  }

  restNote._isCueRest = isCue;
  return restNote;
}

/**
 * Create a VexFlow GhostNote - an invisible note that maintains rhythmic spacing
 * Use this for hidden rests in multi-voice notation to keep voices aligned
 * @param {string} duration - Duration string (e.g., '4n', 'q')
 * @returns {Object} - VexFlow GhostNote
 */
export function createGhostNote(duration = '4n') {
  const VF = getVF();
  if (!VF) {
    console.error('[createGhostNote] VexFlow not available!');
    return null;
  }

  // Check if GhostNote class exists
  if (!VF.GhostNote) {
    console.error('[createGhostNote] VF.GhostNote class not found! VexFlow version issue?');
    return null;
  }

  // Convert duration to VexFlow format
  let vexDuration = DURATION_MAP[duration] || duration || 'q';

  // GhostNote doesn't use 'r' suffix - it's inherently a spacer
  // Remove any 'r' suffix if present
  vexDuration = vexDuration.replace(/r$/, '');

  console.log(`[createGhostNote] Creating ghost note with duration: ${vexDuration}`);

  try {
    const ghostNote = new VF.GhostNote({ duration: vexDuration });
    ghostNote._isGhostNote = true;
    ghostNote._isHiddenRest = true;
    console.log('[createGhostNote] SUCCESS - GhostNote created');
    return ghostNote;
  } catch (e) {
    console.error('[createGhostNote] FAILED to create GhostNote:', e);
    // Fallback: create a rest and hide it
    const fallbackRest = createRest(duration, 'treble', { hidden: true });
    return fallbackRest;
  }
}

// ============================================================================
// VOICE AND FORMATTING
// ============================================================================

/**
 * Create a VexFlow Voice with the given notes
 * @param {Array} notes - Array of VexFlow StaveNote objects
 * @param {Object} options - Voice options
 * @returns {Object} - VexFlow Voice
 */
export function createVoice(notes, options = {}) {
  const VF = getVF();
  if (!VF) return null;

  const {
    numBeats = 4,
    beatValue = 4,
    softMode = true, // Don't throw on duration mismatch
  } = options;

  const voice = new VF.Voice({
    num_beats: numBeats,
    beat_value: beatValue,
  });

  if (softMode) {
    voice.setMode(VF.Voice.Mode.SOFT);
  }

  // MULTI-VOICE FIX: Filter out any undefined notes to prevent VexFlow errors
  const validNotes = notes.filter(note => note !== undefined && note !== null);
  if (validNotes.length !== notes.length) {
    console.warn('[createVoice] Filtered out', notes.length - validNotes.length, 'undefined notes');
  }

  voice.addTickables(validNotes);
  return voice;
}

/**
 * Format and draw voices on staves
 * @param {Object} context - VexFlow context
 * @param {Array} voiceStavePairs - Array of { voice, stave } objects
 */
export function formatAndDraw(context, voiceStavePairs) {
  const VF = getVF();
  if (!VF || !voiceStavePairs || voiceStavePairs.length === 0) return;

  const formatter = new VF.Formatter();

  // Get all voices and calculate width
  const voices = voiceStavePairs.map(pair => pair.voice);
  const firstStave = voiceStavePairs[0].stave;

  // Join voices for proper formatting
  formatter.joinVoices(voices);

  // Format to stave width
  const staveWidth = firstStave.getWidth() - firstStave.getNoteStartX();
  formatter.format(voices, staveWidth);

  // Draw each stave and voice
  voiceStavePairs.forEach(({ voice, stave }) => {
    stave.setContext(context).draw();
    voice.draw(context, stave);
  });
}

/**
 * Generate beams for a group of notes
 * @param {Array} notes - Array of VexFlow StaveNote objects
 * @param {Object} options - Beam options
 * @returns {Array} - Array of VexFlow Beam objects
 */
export function generateBeams(notes, options = {}) {
  const VF = getVF();
  if (!VF || !notes || notes.length === 0) return [];

  const {
    groups = null, // Custom beam groups
    stemDirection = null, // Force stem direction
  } = options;

  try {
    if (groups) {
      return VF.Beam.generateBeams(notes, { groups });
    }
    return VF.Beam.generateBeams(notes);
  } catch (e) {
    console.warn('Error generating beams:', e);
    return [];
  }
}

/**
 * Draw beams on context
 * @param {Object} context - VexFlow context
 * @param {Array} beams - Array of VexFlow Beam objects
 */
export function drawBeams(context, beams) {
  if (!beams) return;
  beams.forEach(beam => beam.setContext(context).draw());
}

// ============================================================================
// TUPLET RENDERING
// ============================================================================

/**
 * Create a VexFlow Tuplet bracket for a group of notes
 * @param {Array} vexNotes - Array of VexFlow StaveNote objects in the tuplet
 * @param {Object} tupletInfo - Tuplet information { actual, normal, type }
 * @param {Object} options - Additional tuplet options
 * @returns {Object|null} - VexFlow Tuplet object or null on error
 */
export function createTuplet(vexNotes, tupletInfo, options = {}) {
  const VF = getVF();
  if (!VF || !vexNotes || vexNotes.length < 2) {
    console.warn('[createTuplet] Invalid inputs:', { hasVF: !!VF, noteCount: vexNotes?.length });
    return null;
  }

  const { actual, normal } = tupletInfo;
  if (!actual || !normal) {
    console.warn('[createTuplet] Missing actual/normal in tupletInfo:', tupletInfo);
    return null;
  }

  const {
    location = 'top',      // 'top' or 'bottom'
    bracketed = true,      // Show bracket
    ratioed = false,       // Show as "3:2" vs just "3"
  } = options;

  try {
    // VexFlow 5.x uses different constants
    const LOCATION_TOP = VF.Tuplet?.LOCATION_TOP ?? VF.Tuplet?.Position?.TOP ?? 1;
    const LOCATION_BOTTOM = VF.Tuplet?.LOCATION_BOTTOM ?? VF.Tuplet?.Position?.BOTTOM ?? -1;

    const tuplet = new VF.Tuplet(vexNotes, {
      num_notes: actual,
      notes_occupied: normal,
      location: location === 'top' ? LOCATION_TOP : LOCATION_BOTTOM,
      bracketed: bracketed,
      ratioed: ratioed,
    });

    return tuplet;
  } catch (e) {
    console.error('[createTuplet] Error creating tuplet:', e);
    return null;
  }
}

/**
 * Draw tuplet brackets on context
 * @param {Object} context - VexFlow context
 * @param {Array} tuplets - Array of VexFlow Tuplet objects
 */
export function drawTuplets(context, tuplets) {
  if (!tuplets || !context) return;
  tuplets.forEach(tuplet => {
    try {
      tuplet.setContext(context).draw();
    } catch (e) {
      console.warn('[drawTuplets] Error drawing tuplet:', e);
    }
  });
}

// ============================================================================
// MEASURE RENDERING
// ============================================================================

/**
 * Render a single measure with notes
 * @param {Object} context - VexFlow context
 * @param {Object} measureData - Measure data
 * @param {Object} options - Rendering options
 */
export function renderMeasure(context, measureData, options = {}) {
  const VF = getVF();
  if (!VF) return;

  const {
    x = 10,
    y = 40,
    width = 220,
    clef = 'treble',
    keySignature = 'C',
    timeSignature = '4/4',
    showClef = true,
    showKeySignature = true,
    showTimeSignature = true,
    showBarline = true,
  } = options;

  const { notes = [] } = measureData;

  // Create stave
  const stave = createStave({
    x,
    y,
    width,
    clef,
    keySignature,
    timeSignature,
    showClef,
    showKeySignature,
    showTimeSignature,
  });

  if (showBarline) {
    stave.setEndBarType(VF.Barline.type.SINGLE);
  }

  // Create VexFlow notes
  const vexNotes = notes.map(note => {
    if (note.isRest) {
      return createRest(note.duration, clef);
    } else if (Array.isArray(note.pitches)) {
      return createChordNote(note.pitches, note.duration, keySignature, clef);
    } else {
      return createStaveNote(note, keySignature, clef);
    }
  });

  // Handle empty measures
  if (vexNotes.length === 0) {
    vexNotes.push(createRest('1n', clef));
  }

  // Create voice and format
  const [num, denom] = timeSignature.split('/');
  const voice = createVoice(vexNotes, {
    numBeats: parseInt(num, 10),
    beatValue: parseInt(denom, 10),
  });

  // Generate and draw beams
  const beams = generateBeams(vexNotes);

  // Format and draw
  formatAndDraw(context, [{ voice, stave }]);
  drawBeams(context, beams);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Constants
  DURATION_MAP,
  REVERSE_DURATION_MAP,
  DURATION_BEATS,
  TONE_DURATION_BEATS,
  KEY_SIGNATURES,
  CLEF_RANGES,

  // Note utilities
  parseNote,
  noteToVexKey,
  vexKeyToNote,
  noteToMidi,
  midiToNote,
  convertDuration,
  convertDurationToTone,
  getDurationBeats,

  // Accidentals
  getRequiredAccidental,
  getVexFlowKeySignature,

  // Octave shifts
  getOctaveShift,
  applyOctaveShift,

  // VexFlow creation
  createRenderer,
  createStave,
  createStaveNote,
  createChordNote,
  createRest,
  createVoice,
  formatAndDraw,
  generateBeams,
  drawBeams,
  renderMeasure,
};
