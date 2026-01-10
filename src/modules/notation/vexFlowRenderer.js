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

// Import centralized duration utilities for consistent dotted note handling
import { isDotted as checkIsDotted, getBaseDuration, toVexFlowDuration } from './durationUtils.js';

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
  'Cbm': ['Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Fb'],  // Same as Cb major (7 flats)
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
    max: 68,    // G#4 - notes at A4 (69) and above get 8va (~3 ledger lines)
    min16: 24,  // C1 - notes below get 16vb
    max16: 80,  // G#5 - notes at A5 and above get 16va
    min32: 12,  // C0 - notes below get 32vb
    max32: 92   // G#6 - notes at A7 and above get 32va
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
 * Parse a note string like "C4", "F#5", "Bb3", "F##4", "Bbb3" into components
 * Supports double sharps (## or x) and double flats (bb)
 * @param {string} noteStr - Note string with octave
 * @returns {Object} - { noteName: string, octave: number, accidental: string|null }
 */
export function parseNote(noteStr) {
  if (!noteStr || typeof noteStr !== 'string') {
    return { noteName: 'C', octave: 4, accidental: null };
  }

  // Match note name, optional accidental (##, x, bb, #, b, or n for natural), optional octave
  const match = noteStr.match(/^([A-Ga-g])(##|x|bb|[#bn]?)(\d+)?$/);
  if (!match) {
    console.warn(`Invalid note format: ${noteStr}`);
    return { noteName: 'C', octave: 4, accidental: null };
  }

  const noteName = match[1].toUpperCase();
  let accidental = match[2] || null;
  // Normalize 'x' to '##' for consistency
  if (accidental === 'x') {
    accidental = '##';
  }
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
 * Apply key signature accidentals to a pitch
 * When the user clicks on a staff line/space without selecting an accidental,
 * this function applies the key signature's accidental to the pitch.
 * For example: clicking on F in G major (which has F#) returns "F#4" instead of "F4"
 * @param {string} pitch - Diatonic pitch like "F4", "C5"
 * @param {string} key - Key signature like "C", "G", "F"
 * @returns {string} - Pitch with key signature accidental applied
 */
export function applyKeySignatureToPitch(pitch, key) {
  const { noteName, octave } = parseNote(pitch);
  if (!noteName || octave === undefined) return pitch;

  const keyAccidentals = KEY_SIGNATURES[key] || [];

  // Check if this note has an accidental in the key signature
  const sharpInKey = keyAccidentals.includes(noteName + '#');
  const flatInKey = keyAccidentals.includes(noteName + 'b');

  if (sharpInKey) {
    return `${noteName}#${octave}`;
  } else if (flatInKey) {
    return `${noteName}b${octave}`;
  }

  // No accidental in key signature for this note
  return pitch;
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
 * VexFlow accepts specific key formats:
 * - Major keys: "C", "G", "D", "A", "E", "B", "F#", "C#", "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"
 * - Minor keys: "Am", "Em", "Bm", "F#m", "C#m", "G#m", "D#m", "A#m", "Dm", "Gm", "Cm", "Fm", "Bbm", "Ebm", "Abm"
 * @param {string} key - Key name like "C Major", "G", "Am", "Bb", "Dm"
 * @returns {string} - VexFlow key signature like "C", "G", "Am", "Bb", "Dm"
 */
export function getVexFlowKeySignature(key) {
  if (!key) {
    return 'C';
  }

  // VexFlow valid key signatures
  const validMajorKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
  const validMinorKeys = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'];

  // Check if it's already a valid key BEFORE normalizing
  // This prevents the normalization regex from stripping 'm' from minor keys
  const trimmedKey = key.trim();
  if (validMajorKeys.includes(trimmedKey) || validMinorKeys.includes(trimmedKey)) {
    return trimmedKey;
  }

  // Handle formats like "C Major", "A Minor", "G"
  // Note: We use separate patterns without /i flag for 'M' to avoid matching lowercase 'm'
  let normalized = key
    .replace(/\s*(Major|major)\s*$/i, '')  // Remove "Major" or "major" suffix
    .replace(/\s*M\s*$/, '')               // Remove uppercase "M" suffix (case-sensitive)
    .replace(/\s*(Minor|minor)\s*$/i, 'm') // Convert "Minor" to "m"
    .trim();

  // Check if normalized version is valid
  if (validMajorKeys.includes(normalized) || validMinorKeys.includes(normalized)) {
    return normalized;
  }

  // Handle enharmonic equivalents for major keys
  const majorEnharmonics = {
    'Db': 'Db', 'C#': 'Db',  // 5 flats vs 7 sharps - use flats
    'Gb': 'Gb', 'F#': 'F#',  // Both are valid, prefer as given
    'Cb': 'Cb', 'B': 'B',    // Both valid
    'D#': 'Eb', 'Fb': 'E',   // Invalid for VexFlow, convert
    'G#': 'Ab', 'A#': 'Bb',  // Invalid for VexFlow, convert
    'E#': 'F', 'B#': 'C',    // Unusual, convert
  };

  // Handle enharmonic equivalents for minor keys
  // VexFlow doesn't support keys with double flats/sharps, so we convert to enharmonic equivalents
  // Preference: Keep the "character" of the key (flat keys stay flat, sharp keys stay sharp when possible)
  const minorEnharmonics = {
    'D#m': 'Ebm', 'A#m': 'Bbm', 'E#m': 'Fm', 'B#m': 'Cm',
    'Fbm': 'Em',
    'Cbm': 'Abm',  // Cb minor (10 flats) → Ab minor (7 flats) - preserve flat character
    'Dbm': 'C#m',  // Db minor (8 flats) → C# minor (4 sharps)
    'Gbm': 'F#m',  // Gb minor (9 flats) → F# minor (3 sharps)
  };

  // Check for enharmonic conversion needed
  if (normalized.endsWith('m')) {
    const converted = minorEnharmonics[normalized];
    if (converted) {
      return converted;
    }
  } else {
    const converted = majorEnharmonics[normalized];
    if (converted) {
      return converted;
    }
  }

  // Default to C if we can't parse
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
    const vexKey = getVexFlowKeySignature(keySignature);
    stave.addKeySignature(vexKey);
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
    dynamic = null,  // Dynamic marking: 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz', 'fp'
    stemDirection = null, // Optional stem direction: 1 (up), -1 (down), null (auto)
    ornament = null, // Ornament: 'trill', 'mordent', 'invertedMordent', 'turn', 'invertedTurn'
    graceNotes = null, // Array of grace notes: { pitch, duration, slash }
    lyric = null,    // Lyric syllable: { text: string, syllabic: 'single'|'begin'|'middle'|'end' }
    pedal = null,    // Pedal marking: 'down', 'up', 'half', 'change'
  } = noteData;

  // Convert duration if needed
  let vexDuration = DURATION_MAP[duration] || duration || 'q';

  // Use centralized checkIsDotted for consistent dotted note detection
  // This handles: note.dotted flag, duration ending with '.', and VexFlow 'd' suffix
  const isDotted = checkIsDotted({ dotted, duration }) || vexDuration.endsWith('d');

  // Add 'r' suffix for rests
  if (isRest) {
    // Remove the 'd' (dotted) suffix temporarily, add 'r' for rest
    // Note: Don't add 'd' back to rest durations - VexFlow doesn't support 'hdr' etc.
    // The dot is added via addDot(0) later for both notes and rests
    vexDuration = vexDuration.replace(/d$/, '') + 'r';
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

  const staveNote = new VF.StaveNote(noteConfig);

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
  // Note: Both notes AND rests need the dot modifier to visually show the dot
  // Use addModifier(new VF.Dot(), 0) which works for both notes and rests
  if (isDotted) {
    staveNote.addModifier(new VF.Dot(), 0);
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

  // Add ornament if specified
  if (!isRest && ornament) {
    // VexFlow 5 ornament codes - all use VF.Ornament class
    // See: https://github.com/vexflow/vexflow/blob/master/src/tables.ts
    // Ornament names are camelCase: mordentInverted, turnInverted (not a.mordent_inverted)
    const ornamentMap = {
      'trill': 'tr',
      'mordent': 'mordent',
      'invertedMordent': 'mordentInverted',  // VexFlow 5 uses camelCase ornament names
      'turn': 'turn',
      'invertedTurn': 'turnInverted',  // VexFlow 5 uses camelCase ornament names
    };

    // Unicode fallback symbols for ornaments
    const unicodeSymbols = {
      'trill': 'tr',
      'mordent': '𝆰',
      'invertedMordent': '𝆱',
      'turn': '𝆗',
      'invertedTurn': '𝆘',
    };

    const vexOrnamentCode = ornamentMap[ornament];
    if (vexOrnamentCode) {
      try {
        const ornamentObj = new VF.Ornament(vexOrnamentCode);
        staveNote.addModifier(ornamentObj, 0);
      } catch (error) {
        // If VexFlow doesn't recognize the ornament, fall back to text annotation
        console.warn('[VexFlowRenderer] Error adding ornament, using Unicode fallback:', error.message);
        const symbol = unicodeSymbols[ornament] || ornament;
        const textAnnotation = new VF.Annotation(symbol)
          .setFont('Times New Roman', 14, 'normal')
          .setVerticalJustification(VF.Annotation.VerticalJustify.TOP);
        staveNote.addModifier(textAnnotation, 0);
      }
    }
  }

  // Add grace notes if specified
  if (!isRest && graceNotes && Array.isArray(graceNotes) && graceNotes.length > 0) {
    try {
      const vexGraceNotes = graceNotes.map(gn => {
        const graceKey = noteToVexKey(gn.pitch);
        const graceDuration = DURATION_MAP[gn.duration] || '8';
        const graceNote = new VF.GraceNote({
          keys: [graceKey],
          duration: graceDuration,
          slash: gn.slash || false,
        });
        return graceNote;
      });

      // Create a GraceNoteGroup and attach to the main note
      const graceGroup = new VF.GraceNoteGroup(vexGraceNotes);
      staveNote.addModifier(graceGroup, 0);
    } catch (error) {
      console.warn('[VexFlowRenderer] Error adding grace notes:', error.message);
    }
  }

  // Add dynamic marking if specified
  // Using Annotation modifier for dynamics text
  // For treble clef: position below (BOTTOM) so dynamics appear between staves
  // For bass clef: position above (TOP) so dynamics appear between staves
  if (!isRest && dynamic) {
    try {
      const verticalJustify = clef === 'bass'
        ? VF.Annotation.VerticalJustify.TOP
        : VF.Annotation.VerticalJustify.BOTTOM;
      const annotation = new VF.Annotation(dynamic)
        .setFont('Times', 12, 'bold italic')
        .setVerticalJustification(verticalJustify);
      staveNote.addModifier(annotation, 0);
    } catch (error) {
      console.warn('[VexFlowRenderer] Error adding dynamic annotation:', error.message);
    }
  }

  // Add pedal marking FIRST (appears closer to staff, above lyrics)
  // Pedal markings appear below bass staff notes
  if (!isRest && pedal) {
    try {
      // Map pedal type to display symbol
      const pedalSymbols = {
        'down': 'Ped.',    // Depress pedal
        'up': '*',          // Release pedal
        'change': '↻',      // Quick release and re-depress
        'half': '½Ped.'     // Half-pedal
      };
      const pedalText = pedalSymbols[pedal] || pedal;

      const pedalAnnotation = new VF.Annotation(pedalText)
        .setFont('Times New Roman', 12, 'italic')
        .setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);

      staveNote.addModifier(pedalAnnotation, 0);
    } catch (error) {
      console.warn('[VexFlowRenderer] Error adding pedal annotation:', error.message);
    }
  }

  // Add lyric syllable SECOND (appears below pedal marking)
  // Lyrics appear at the bottom of the staff system at a consistent Y position
  if (!isRest && lyric && lyric.text) {
    try {
      // Format lyric text based on syllabic position
      let lyricText = lyric.text;
      if (lyric.syllabic === 'begin' || lyric.syllabic === 'middle') {
        lyricText += '-';  // Add hyphen for continuing syllables
      }
      if (lyric.syllabic === 'middle' || lyric.syllabic === 'end') {
        lyricText = '-' + lyricText;  // Prefix hyphen for continued syllables
      }

      // Calculate pitch-dependent Y shift for consistent lyric baseline
      // Reference pitch E4 (MIDI 64) = bottom line of treble staff
      // Higher notes need larger Y shift to push lyrics down to consistent level
      // Lower notes need smaller Y shift
      // Each semitone ≈ 2.5 pixels in VexFlow (half of a staff space)
      const REFERENCE_MIDI = 64;  // E4 - bottom line of treble staff
      const BASE_Y_SHIFT = 55;    // Base shift from reference pitch
      const PIXELS_PER_SEMITONE = 2.5;

      const noteMidi = noteToMidi(pitch);
      const midiDiff = noteMidi - REFERENCE_MIDI;
      const pitchAdjustment = midiDiff * PIXELS_PER_SEMITONE;

      // Higher notes (positive midiDiff) need more Y shift to push lyric down
      const lyricYShift = BASE_Y_SHIFT + pitchAdjustment;

      const lyricAnnotation = new VF.Annotation(lyricText)
        .setFont('Times New Roman', 11, 'normal')
        .setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);

      lyricAnnotation.setYShift(lyricYShift);

      staveNote.addModifier(lyricAnnotation, 0);
    } catch (error) {
      console.warn('[VexFlowRenderer] Error adding lyric annotation:', error.message);
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
 * @param {number|null} stemDirection - Optional stem direction
 * @param {string|null} dynamic - Dynamic marking: 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz', 'fp'
 * @param {string|null} ornament - Ornament: 'trill', 'mordent', 'invertedMordent', 'turn', 'invertedTurn'
 * @param {Array|null} graceNotes - Array of grace notes: { pitch, duration, slash }
 * @param {Object|null} lyric - Lyric syllable: { text: string, syllabic: 'single'|'begin'|'middle'|'end' }
 * @param {string|null} pedal - Pedal marking: 'down', 'up', 'half', 'change'
 * @returns {Object} - VexFlow StaveNote with multiple keys
 */
export function createChordNote(pitches, duration = '4n', key = 'C', clef = 'treble', dotted = false, articulation = null, accidental = null, stemDirection = null, dynamic = null, ornament = null, graceNotes = null, lyric = null, pedal = null) {
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
  // Use centralized checkIsDotted for consistent detection across all formats
  const isDotted = checkIsDotted({ dotted, duration }) || vexDuration.endsWith('d');
  if (isDotted) {
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

  // Add ornament if specified (applied to the top note of the chord)
  // VexFlow 5 ornament codes - all use VF.Ornament class
  // See: https://github.com/vexflow/vexflow/blob/master/src/tables.ts
  if (ornament) {
    const ornamentMap = {
      'trill': 'tr',
      'mordent': 'mordent',
      'invertedMordent': 'mordentInverted',  // VexFlow 5 uses camelCase ornament names
      'turn': 'turn',
      'invertedTurn': 'turnInverted',  // VexFlow 5 uses camelCase ornament names
    };

    // Unicode fallback symbols for ornaments
    const unicodeSymbols = {
      'trill': 'tr',
      'mordent': '𝆰',
      'invertedMordent': '𝆱',
      'turn': '𝆗',
      'invertedTurn': '𝆘',
    };

    const vexOrnamentCode = ornamentMap[ornament];
    if (vexOrnamentCode) {
      try {
        const ornamentObj = new VF.Ornament(vexOrnamentCode);
        staveNote.addModifier(ornamentObj, pitches.length - 1);
      } catch (error) {
        // Fall back to Unicode symbol if VexFlow ornament fails
        console.warn('[VexFlowRenderer] Error adding ornament to chord, using Unicode fallback:', error.message);
        const symbol = unicodeSymbols[ornament] || ornament;
        const textAnnotation = new VF.Annotation(symbol)
          .setFont('Times New Roman', 14, 'normal')
          .setVerticalJustification(VF.Annotation.VerticalJustify.TOP);
        staveNote.addModifier(textAnnotation, pitches.length - 1);
      }
    }
  }

  // Add grace notes if specified (applied to the chord)
  if (graceNotes && Array.isArray(graceNotes) && graceNotes.length > 0) {
    try {
      const vexGraceNotes = graceNotes.map(gn => {
        const graceKey = noteToVexKey(gn.pitch);
        const graceDuration = DURATION_MAP[gn.duration] || '8';
        const graceNote = new VF.GraceNote({
          keys: [graceKey],
          duration: graceDuration,
          slash: gn.slash || false,
        });
        return graceNote;
      });

      // Create a GraceNoteGroup and attach to the chord
      const graceGroup = new VF.GraceNoteGroup(vexGraceNotes);
      staveNote.addModifier(graceGroup, 0);
    } catch (error) {
      console.warn('[VexFlowRenderer] Error adding grace notes to chord:', error.message);
    }
  }

  // Add dynamic marking if specified (applied to the chord)
  // Using Annotation modifier for dynamics text
  // Position: BOTTOM for treble (below staff), TOP for bass (above staff, between staves)
  if (dynamic) {
    try {
      const verticalJustify = clef === 'bass'
        ? VF.Annotation.VerticalJustify.TOP
        : VF.Annotation.VerticalJustify.BOTTOM;
      const annotation = new VF.Annotation(dynamic)
        .setFont('Times', 12, 'bold italic')
        .setVerticalJustification(verticalJustify);
      staveNote.addModifier(annotation, 0);
    } catch (error) {
      console.warn('[VexFlowRenderer] Error adding dynamic annotation to chord:', error.message);
    }
  }

  // Add pedal marking FIRST (appears closer to staff, above lyrics)
  if (pedal) {
    try {
      // Map pedal type to display symbol
      const pedalSymbols = {
        'down': 'Ped.',    // Depress pedal
        'up': '*',          // Release pedal
        'change': '↻',      // Quick release and re-depress
        'half': '½Ped.'     // Half-pedal
      };
      const pedalText = pedalSymbols[pedal] || pedal;

      const pedalAnnotation = new VF.Annotation(pedalText)
        .setFont('Times New Roman', 12, 'italic')
        .setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);

      staveNote.addModifier(pedalAnnotation, 0);
    } catch (error) {
      console.warn('[VexFlowRenderer] Error adding pedal annotation to chord:', error.message);
    }
  }

  // Add lyric syllable SECOND (appears below pedal marking)
  if (lyric && lyric.text) {
    try {
      // Format lyric text based on syllabic position
      let lyricText = lyric.text;
      if (lyric.syllabic === 'begin' || lyric.syllabic === 'middle') {
        lyricText += '-';  // Add hyphen for continuing syllables
      }
      if (lyric.syllabic === 'middle' || lyric.syllabic === 'end') {
        lyricText = '-' + lyricText;  // Prefix hyphen for continued syllables
      }

      // Calculate pitch-dependent Y shift for consistent lyric baseline
      // Use the lowest pitch in the chord for positioning reference
      // Reference pitch E4 (MIDI 64) = bottom line of treble staff
      const REFERENCE_MIDI = 64;  // E4 - bottom line of treble staff
      const BASE_Y_SHIFT = 55;    // Base shift from reference pitch
      const PIXELS_PER_SEMITONE = 2.5;

      // Find the lowest pitch in the chord for lyric positioning
      let lowestMidi = Infinity;
      for (const p of pitches) {
        const midi = noteToMidi(p);
        if (midi < lowestMidi) lowestMidi = midi;
      }
      if (lowestMidi === Infinity) lowestMidi = REFERENCE_MIDI;

      const midiDiff = lowestMidi - REFERENCE_MIDI;
      const pitchAdjustment = midiDiff * PIXELS_PER_SEMITONE;
      const lyricYShift = BASE_Y_SHIFT + pitchAdjustment;

      const lyricAnnotation = new VF.Annotation(lyricText)
        .setFont('Times New Roman', 11, 'normal')
        .setVerticalJustification(VF.Annotation.VerticalJustify.BOTTOM);

      lyricAnnotation.setYShift(lyricYShift);

      staveNote.addModifier(lyricAnnotation, 0);
    } catch (error) {
      console.warn('[VexFlowRenderer] Error adding lyric annotation to chord:', error.message);
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
  const { isCue = false, hidden = false, dotted = false } = options;

  const restNote = createStaveNote({
    pitch: null,
    duration,
    isRest: true,
    dotted,
  }, 'C', clef);

  if (!restNote) return null;

  // Mark as hidden FIRST (takes priority - invisible spacer)
  if (hidden) {
    if (restNote.setStyle) {
      restNote.setStyle({
        fillStyle: 'transparent',
        strokeStyle: 'transparent',
      });
    }
    restNote._isHiddenRest = true;
    restNote._isCueRest = isCue;
    return restNote;
  }

  // Apply cue-sized styling (smaller rest) - only if NOT hidden
  if (isCue) {
    // Lighter color for secondary voice cue rests
    if (restNote.setStyle) {
      restNote.setStyle({
        fillStyle: '#aaaaaa',
        strokeStyle: '#aaaaaa',
      });
    }

    // VexFlow 5.x: Scale the glyph using multiple approaches
    // Use much smaller values for noticeable cue size (default is ~38)
    const cueScale = 20; // Much smaller than default
    const cueScaleRatio = 0.55; // 55% of normal size

    // Approach 1: render_options.glyph_font_scale (VexFlow internal)
    if (restNote.render_options) {
      restNote.render_options.glyph_font_scale = cueScale;
    }

    // Approach 2: setRenderOptions if available
    if (typeof restNote.setRenderOptions === 'function') {
      restNote.setRenderOptions({ glyph_font_scale: cueScale });
    }

    // Approach 3: Direct glyph scale property (VexFlow 5.x)
    if (restNote.glyph) {
      restNote.glyph.scale = cueScaleRatio;
    }

    // Approach 4: Set font info for scaling
    try {
      if (restNote.fontInfo) {
        restNote.fontInfo.size = cueScale;
      }
    } catch (e) {
      // Font info access may fail
    }

    // Approach 5: Try setting scale on the note itself
    if (typeof restNote.setFontSize === 'function') {
      restNote.setFontSize(cueScale);
    }

    restNote._isCueSize = true;
  }

  restNote._isCueRest = isCue;
  return restNote;
}

/**
 * Create a VexFlow GhostNote - an invisible note that maintains rhythmic spacing
 * Use this for hidden rests in multi-voice notation to keep voices aligned.
 *
 * GhostNotes are the preferred way to handle "hidden" rests because they:
 * 1. Properly participate in tick calculations for voice alignment
 * 2. Are completely invisible (no styling hacks needed)
 * 3. Work seamlessly with VexFlow's Formatter
 *
 * @param {string} duration - Duration string (e.g., '4n', 'q', '2n')
 * @returns {Object} - VexFlow GhostNote, or null on error
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
    // Fallback: create a transparent rest
    return createRest(duration, 'treble', { hidden: true });
  }

  // Convert duration to VexFlow format
  let vexDuration = DURATION_MAP[duration] || duration || 'q';

  // GhostNote doesn't use 'r' suffix - it's inherently a spacer
  // Remove any 'r' suffix if present
  vexDuration = vexDuration.replace(/r$/, '');

  try {
    const ghostNote = new VF.GhostNote({ duration: vexDuration });
    ghostNote._isGhostNote = true;
    ghostNote._isHiddenRest = true;
    return ghostNote;
  } catch (e) {
    console.error('[createGhostNote] FAILED to create GhostNote:', e);
    // Fallback: create a transparent rest
    return createRest(duration, 'treble', { hidden: true });
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
    groups = null,
    stemDirection = null,
    timeSignature = '4/4', // Time signature for beat grouping
    preserveGrouping = false, // When true, skip beat-based splitting (group was manually defined)
  } = options;

  try {
    // Filter to only beamable notes
    const beamableNotes = notes.filter(note => {
      if (note.isRest?.() || note.getNoteType?.() === 'r') return false;
      const dur = note.getDuration ? note.getDuration() : '';
      return ['8', '16', '32', '64'].some(d => dur.startsWith(d));
    });

    if (beamableNotes.length < 2) return [];

    // Set stem direction BEFORE creating beams
    if (stemDirection !== null) {
      beamableNotes.forEach(note => {
        if (note.setStemDirection) {
          note.setStemDirection(stemDirection);
        }
      });
    }

    // When preserveGrouping is true, beam all notes together without beat-based splitting
    // This is used when manual beam controls have already defined the grouping
    if (preserveGrouping) {
      if (beamableNotes.length < 2) return [];
      try {
        const beam = new VF.Beam(beamableNotes, false);
        return [beam];
      } catch (e) {
        console.warn('Error creating preserved beam:', e);
        return [];
      }
    }

    // Parse time signature to determine beat grouping
    const [tsNum, tsDenom] = timeSignature.split('/').map(Number);

    // Determine if compound meter (6/8, 9/8, 12/8, etc.)
    // Compound meters have numerator divisible by 3 (but not 3 itself in simple time)
    // and denominator of 8
    const isCompoundMeter = tsDenom === 8 && tsNum >= 6 && tsNum % 3 === 0;

    // Calculate beat value in quarter notes
    // Simple meter: beat = denominator note value (e.g., 4/4 -> quarter = 1)
    // Compound meter: beat = dotted denominator (e.g., 6/8 -> dotted quarter = 1.5)
    let beatValueInQuarters;
    if (isCompoundMeter) {
      // In compound meter, 3 eighth notes = 1 beat
      // 3 * 0.5 = 1.5 quarter notes per beat
      beatValueInQuarters = 1.5;
    } else if (tsDenom === 2) {
      // 2/2 (cut time): half note = 1 beat = 2 quarter notes
      beatValueInQuarters = 2;
    } else if (tsDenom === 8) {
      // Simple 3/8, 5/8, etc.: eighth note = 1 beat = 0.5 quarter notes
      beatValueInQuarters = 0.5;
    } else {
      // 4/4, 3/4, 2/4, etc.: quarter note = 1 beat
      beatValueInQuarters = 1;
    }

    // Group beamable notes by beat boundaries
    const beamGroups = [];
    let currentGroup = [];
    let currentGroupDuration = null;
    let currentBeatValue = 0;
    let lastNoteIndex = -1;

    // Duration to beat value (in quarter notes)
    const getDurationBeatValue = (dur) => {
      // Handle dotted durations
      const isDotted = dur.includes('d');
      let baseValue;
      if (dur.startsWith('8')) baseValue = 0.5;
      else if (dur.startsWith('16')) baseValue = 0.25;
      else if (dur.startsWith('32')) baseValue = 0.125;
      else if (dur.startsWith('64')) baseValue = 0.0625;
      else baseValue = 0.5;

      return isDotted ? baseValue * 1.5 : baseValue;
    };

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      if (!beamableNotes.includes(note)) {
        // Non-beamable note breaks the group
        if (currentGroup.length >= 2) {
          beamGroups.push([...currentGroup]);
        }
        currentGroup = [];
        currentGroupDuration = null;
        currentBeatValue = 0;
        continue;
      }

      const dur = note.getDuration ? note.getDuration() : '8';
      const beatValue = getDurationBeatValue(dur);

      // Check if consecutive in the original note array
      if (lastNoteIndex !== -1 && i !== lastNoteIndex + 1) {
        // Gap in notes, break group
        if (currentGroup.length >= 2) {
          beamGroups.push([...currentGroup]);
        }
        currentGroup = [];
        currentGroupDuration = null;
        currentBeatValue = 0;
      }

      // Check if duration type changed (don't mix 8ths with 16ths in simple meter)
      // In compound meter, we can beam 8ths together more freely
      const durType = dur.startsWith('8') ? '8' : dur.startsWith('16') ? '16' : dur.startsWith('32') ? '32' : '64';
      if (!isCompoundMeter && currentGroupDuration !== null && currentGroupDuration !== durType) {
        // Duration type changed, break group
        if (currentGroup.length >= 2) {
          beamGroups.push([...currentGroup]);
        }
        currentGroup = [];
        currentGroupDuration = null;
        currentBeatValue = 0;
      }

      currentGroup.push(note);
      currentGroupDuration = durType;
      currentBeatValue += beatValue;
      lastNoteIndex = i;

      // Break at beat boundaries
      if (currentBeatValue >= beatValueInQuarters) {
        if (currentGroup.length >= 2) {
          beamGroups.push([...currentGroup]);
        }
        currentGroup = [];
        currentGroupDuration = null;
        currentBeatValue = 0;
      }
    }

    if (currentGroup.length >= 2) {
      beamGroups.push(currentGroup);
    }

    // Create beams using VF.Beam constructor directly
    // This respects the stem direction we set on notes
    const beams = [];
    for (const group of beamGroups) {
      try {
        // VF.Beam constructor: new Beam(notes, auto_stem)
        // When auto_stem is false/undefined, it uses the stem direction already set on notes
        const beam = new VF.Beam(group, false);
        beams.push(beam);
      } catch (e) {
        console.warn('Error creating beam:', e);
      }
    }

    return beams;
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
  beams.forEach(beam => {
    try {
      // Validate that all notes in the beam have tick contexts before drawing
      // This prevents "NoTickContext: Can't getAbsoluteX()" errors
      const notes = beam.getNotes ? beam.getNotes() : beam.notes;
      if (notes && notes.length > 0) {
        const allNotesHaveTickContext = notes.every(note => {
          try {
            // Try to access the tick context - if it throws, the note isn't formatted
            return note.getTickContext && note.getTickContext() !== null;
          } catch {
            return false;
          }
        });

        if (!allNotesHaveTickContext) {
          console.warn('[drawBeams] Skipping beam - some notes missing tick context');
          return;
        }
      }

      beam.setContext(context);
      beam.draw();
    } catch (e) {
      console.warn('[drawBeams] Error drawing beam:', e.message);
    }
  });
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
      return createRest(note.duration, clef, { dotted: note.dotted || false });
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
  applyKeySignatureToPitch,
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
  createGhostNote,
  createVoice,
  formatAndDraw,
  generateBeams,
  drawBeams,
  renderMeasure,
};
