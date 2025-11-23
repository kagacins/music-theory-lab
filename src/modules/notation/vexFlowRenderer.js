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
 * PHASE 1.4+: Adjusted thresholds - 8va starts at E6 (88), 8vb starts at E3 (52)
 */
export const CLEF_RANGES = {
  treble: {
    min: 52,    // E3 - notes below get 8vb
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
  } = noteData;

  // Convert duration if needed
  let vexDuration = DURATION_MAP[duration] || duration || 'q';

  // Add 'r' suffix for rests
  if (isRest) {
    vexDuration = vexDuration.replace(/d$/, '') + 'r';
    if (dotted) vexDuration = vexDuration.replace('r', 'dr');
  } else if (dotted && !vexDuration.includes('d')) {
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

  const staveNote = new VF.StaveNote(noteConfig);

  // Add accidentals for non-rest notes
  if (!isRest) {
    const requiredAccidental = accidental || getRequiredAccidental(pitch, key);
    if (requiredAccidental) {
      staveNote.addModifier(new VF.Accidental(requiredAccidental));
    }
  }

  // Add dot if needed
  if (dotted) {
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
 * @returns {Object} - VexFlow StaveNote with multiple keys
 */
export function createChordNote(pitches, duration = '4n', key = 'C', clef = 'treble', dotted = false, articulation = null) {
  const VF = getVF();
  if (!VF || !pitches || pitches.length === 0) return null;

  // Convert duration and add 'd' suffix if dotted
  let vexDuration = DURATION_MAP[duration] || duration || 'q';
  if (dotted && !vexDuration.includes('d')) {
    vexDuration += 'd';
  }

  // Convert all pitches to VexFlow keys
  const keys = pitches.map(pitch => noteToVexKey(pitch));

  // Create the chord note
  const staveNote = new VF.StaveNote({
    keys,
    duration: vexDuration,
    clef,
  });

  // Add accidentals for each pitch
  pitches.forEach((pitch, index) => {
    const requiredAccidental = getRequiredAccidental(pitch, key);
    if (requiredAccidental) {
      staveNote.addModifier(new VF.Accidental(requiredAccidental), index);
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
 * @returns {Object} - VexFlow StaveNote (rest)
 */
export function createRest(duration = '4n', clef = 'treble') {
  return createStaveNote({
    pitch: null,
    duration,
    isRest: true,
  }, 'C', clef);
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

  voice.addTickables(notes);
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
