/**
 * Note Formatter - Note spacing and beaming utilities
 * Part of the Phase 4.4 VexFlow Professional Notation enhancement
 *
 * This module handles advanced formatting concerns like automatic beaming,
 * stem direction, note spacing, and voice allocation.
 */

import { noteToMidi, getDurationBeats } from './vexFlowRenderer.js';

// VexFlow is loaded globally
const VF = window.Vex ? window.Vex.Flow : null;

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Beam grouping patterns by time signature
 */
export const BEAM_PATTERNS = {
  '4/4': [2, 2],           // Two groups of 2 beats each
  '3/4': [1, 1, 1],        // Three groups of 1 beat
  '2/4': [1, 1],           // Two groups of 1 beat
  '6/8': [3, 3],           // Two groups of 3 eighth notes
  '9/8': [3, 3, 3],        // Three groups of 3 eighth notes
  '12/8': [3, 3, 3, 3],    // Four groups of 3 eighth notes
  '2/2': [2, 2],           // Two groups of 2 beats
  '3/8': [3],              // One group of 3 eighth notes
  '5/4': [2, 3],           // Common 5/4 grouping
  '7/8': [2, 2, 3],        // Common 7/8 grouping
};

/**
 * Default stem directions based on staff position
 * Reference: B4 (MIDI 71) for treble, D3 (MIDI 50) for bass
 */
export const STEM_REFERENCE = {
  treble: 71,  // B4 - notes above go stem down, below go stem up
  bass: 50,    // D3 - notes above go stem down, below go stem up
};

// ============================================================================
// BEAMING
// ============================================================================

/**
 * Get beam groups for a time signature
 * @param {string} timeSignature - Time signature like "4/4"
 * @returns {Array} - Array of VexFlow Fraction objects for beam groups
 */
export function getBeamGroups(timeSignature) {
  if (!VF) return null;

  const pattern = BEAM_PATTERNS[timeSignature];
  if (!pattern) {
    // Default to grouping by beat
    const [num, denom] = timeSignature.split('/').map(Number);
    const beatValue = 4 / denom;
    return Array(num).fill(new VF.Fraction(beatValue, 1));
  }

  return pattern.map(beats => new VF.Fraction(beats, 1));
}

/**
 * Group notes for beaming
 * @param {Array} notes - Array of VexFlow StaveNotes
 * @param {string} timeSignature - Time signature
 * @returns {Array} - Array of note groups to beam together
 */
export function groupNotesForBeaming(notes, timeSignature) {
  const groups = [];
  const pattern = BEAM_PATTERNS[timeSignature] || [1, 1, 1, 1];

  let noteIndex = 0;
  let currentBeat = 0;
  let patternIndex = 0;
  let currentGroup = [];

  while (noteIndex < notes.length) {
    const note = notes[noteIndex];
    const noteDuration = getNoteBeats(note);

    // Check if this note can be beamed (eighth note or smaller)
    const isBeamable = canBeBeamed(note);

    if (isBeamable) {
      currentGroup.push(note);
    } else {
      // End current group if any
      if (currentGroup.length >= 2) {
        groups.push([...currentGroup]);
      }
      currentGroup = [];
    }

    currentBeat += noteDuration;

    // Check if we've completed a beat group
    const groupBeats = pattern[patternIndex] || 1;
    if (currentBeat >= groupBeats) {
      if (currentGroup.length >= 2) {
        groups.push([...currentGroup]);
      }
      currentGroup = [];
      currentBeat -= groupBeats;
      patternIndex = (patternIndex + 1) % pattern.length;
    }

    noteIndex++;
  }

  // Don't forget the last group
  if (currentGroup.length >= 2) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Check if a note can be beamed (eighth or smaller)
 * @param {Object} note - VexFlow StaveNote
 * @returns {boolean}
 */
function canBeBeamed(note) {
  if (!note || !note.getDuration) return false;

  const duration = note.getDuration();
  return ['8', '16', '32', '64', '8d', '16d', '32d'].includes(duration);
}

/**
 * Get the beat value of a note
 * @param {Object} note - VexFlow StaveNote
 * @returns {number} - Number of beats
 */
function getNoteBeats(note) {
  if (!note || !note.getDuration) return 1;

  const duration = note.getDuration();
  const durationMap = {
    'w': 4, 'h': 2, 'q': 1, '8': 0.5, '16': 0.25, '32': 0.125, '64': 0.0625,
    'wd': 6, 'hd': 3, 'qd': 1.5, '8d': 0.75, '16d': 0.375, '32d': 0.1875,
    'wr': 4, 'hr': 2, 'qr': 1, '8r': 0.5, '16r': 0.25,
  };

  return durationMap[duration] || 1;
}

/**
 * Generate beams for notes using VexFlow
 * @param {Array} notes - Array of VexFlow StaveNotes
 * @param {string} timeSignature - Time signature
 * @returns {Array} - Array of VexFlow Beam objects
 */
export function generateSmartBeams(notes, timeSignature = '4/4') {
  if (!VF) return [];

  const beamGroups = getBeamGroups(timeSignature);

  try {
    return VF.Beam.generateBeams(notes, {
      groups: beamGroups,
      maintain_stem_directions: false,
    });
  } catch (e) {
    console.warn('Error generating smart beams:', e);
    return [];
  }
}

// ============================================================================
// STEM DIRECTIONS
// ============================================================================

/**
 * Calculate stem direction for a note
 * @param {string} pitch - Pitch string like "C4"
 * @param {string} clef - 'treble' or 'bass'
 * @returns {number} - 1 for up, -1 for down
 */
export function calculateStemDirection(pitch, clef = 'treble') {
  const midi = noteToMidi(pitch);
  const reference = STEM_REFERENCE[clef] || STEM_REFERENCE.treble;

  // Notes above the reference line get stems down, below get stems up
  return midi >= reference ? -1 : 1;
}

/**
 * Calculate stem direction for a chord (multiple notes)
 * @param {Array} pitches - Array of pitch strings
 * @param {string} clef - 'treble' or 'bass'
 * @returns {number} - 1 for up, -1 for down
 */
export function calculateChordStemDirection(pitches, clef = 'treble') {
  if (!pitches || pitches.length === 0) return 1;

  // Calculate average position
  const midiValues = pitches.map(p => noteToMidi(p));
  const avgMidi = midiValues.reduce((a, b) => a + b, 0) / midiValues.length;

  const reference = STEM_REFERENCE[clef] || STEM_REFERENCE.treble;
  return avgMidi >= reference ? -1 : 1;
}

/**
 * Apply stem directions to notes based on their positions
 * @param {Array} notes - Array of VexFlow StaveNotes
 * @param {string} clef - 'treble' or 'bass'
 */
export function applyStemDirections(notes, clef = 'treble') {
  if (!VF) return;

  const reference = STEM_REFERENCE[clef];

  notes.forEach(note => {
    if (note.isRest && note.isRest()) return;

    const keys = note.getKeys();
    if (!keys || keys.length === 0) return;

    // Calculate average MIDI value for chords
    let totalMidi = 0;
    for (const key of keys) {
      const [noteName, octave] = key.split('/');
      const pitch = noteName + octave;
      totalMidi += noteToMidi(pitch);
    }
    const avgMidi = totalMidi / keys.length;

    // Set stem direction
    const direction = avgMidi >= reference
      ? VF.Stem.DOWN
      : VF.Stem.UP;

    note.setStemDirection(direction);
  });
}

// ============================================================================
// NOTE SPACING
// ============================================================================

/**
 * Calculate ideal note spacing based on durations
 * @param {Array} notes - Array of note data
 * @returns {Array} - Array of spacing values
 */
export function calculateNoteSpacing(notes) {
  if (!notes || notes.length === 0) return [];

  // Base spacing unit (for quarter note)
  const baseSpacing = 40;

  return notes.map(note => {
    const duration = note.duration || '4n';
    const beats = getDurationBeats(duration);

    // Logarithmic scaling for better visual proportion
    // Longer notes get more space, but not linearly
    return baseSpacing * Math.pow(beats, 0.6);
  });
}

/**
 * Calculate minimum measure width based on content
 * @param {Array} trebleNotes - Treble clef notes
 * @param {Array} bassNotes - Bass clef notes
 * @param {Object} options - Options
 * @returns {number} - Minimum width in pixels
 */
export function calculateMinimumMeasureWidth(trebleNotes, bassNotes, options = {}) {
  const {
    minWidth = 150,
    maxWidth = 400,
    baseNoteWidth = 30,
    accidentalWidth = 8,
    dotWidth = 5,
  } = options;

  // Get all notes
  const allNotes = [...(trebleNotes || []), ...(bassNotes || [])];

  if (allNotes.length === 0) {
    return minWidth;
  }

  // Calculate based on note count and modifiers
  let width = 50; // Base padding

  for (const note of allNotes) {
    width += baseNoteWidth;

    if (note.accidental) {
      width += accidentalWidth;
    }

    if (note.dotted) {
      width += dotWidth;
    }

    // Chord notes need more space
    if (note.pitches && note.pitches.length > 1) {
      width += (note.pitches.length - 1) * 5;
    }
  }

  // Use the larger of treble or bass note requirements
  const trebleWidth = calculateLineWidth(trebleNotes);
  const bassWidth = calculateLineWidth(bassNotes);
  width = Math.max(width, trebleWidth, bassWidth);

  return Math.max(minWidth, Math.min(maxWidth, width));
}

/**
 * Calculate width needed for a line of notes
 * @param {Array} notes - Array of notes
 * @returns {number} - Width in pixels
 */
function calculateLineWidth(notes) {
  if (!notes) return 0;

  const spacing = calculateNoteSpacing(notes);
  return spacing.reduce((sum, s) => sum + s, 0);
}

// ============================================================================
// VOICE ALLOCATION
// ============================================================================

/**
 * Separate notes into voices based on stem direction
 * @param {Array} notes - Array of note data
 * @param {string} clef - 'treble' or 'bass'
 * @returns {Object} - { voice1: [], voice2: [] }
 */
export function allocateVoices(notes, clef = 'treble') {
  const voice1 = [];
  const voice2 = [];

  // Simple allocation: notes with explicit voice property
  for (const note of notes) {
    if (note.voice === 2) {
      voice2.push(note);
    } else {
      voice1.push(note);
    }
  }

  return { voice1, voice2 };
}

/**
 * Merge voices back into a single array with voice markers
 * @param {Array} voice1 - Voice 1 notes
 * @param {Array} voice2 - Voice 2 notes
 * @returns {Array} - Merged notes with beat positions
 */
export function mergeVoices(voice1, voice2) {
  const merged = [];

  // Calculate beat positions for each voice
  const v1WithBeats = addBeatPositions(voice1);
  const v2WithBeats = addBeatPositions(voice2);

  // Combine and sort by beat position
  merged.push(...v1WithBeats.map(n => ({ ...n, voice: 1 })));
  merged.push(...v2WithBeats.map(n => ({ ...n, voice: 2 })));

  merged.sort((a, b) => a.beatPosition - b.beatPosition);

  return merged;
}

/**
 * Add beat position to each note
 * @param {Array} notes - Array of notes
 * @returns {Array} - Notes with beatPosition property
 */
function addBeatPositions(notes) {
  let beat = 0;
  return notes.map(note => {
    const noteWithBeat = { ...note, beatPosition: beat };
    beat += getDurationBeats(note.duration || '4n');
    return noteWithBeat;
  });
}

// ============================================================================
// COLLISION DETECTION
// ============================================================================

/**
 * Detect note collisions (seconds/unisons in chords)
 * @param {Array} pitches - Array of pitch strings
 * @returns {Array} - Array of collision pairs
 */
export function detectCollisions(pitches) {
  if (!pitches || pitches.length < 2) return [];

  const collisions = [];
  const midiValues = pitches.map(p => noteToMidi(p)).sort((a, b) => a - b);

  for (let i = 0; i < midiValues.length - 1; i++) {
    const interval = midiValues[i + 1] - midiValues[i];
    if (interval <= 2) {
      // Second or unison
      collisions.push({
        lower: midiValues[i],
        upper: midiValues[i + 1],
        interval,
      });
    }
  }

  return collisions;
}

/**
 * Calculate note head offsets for collisions
 * @param {Array} pitches - Array of pitch strings
 * @param {number} stemDirection - 1 for up, -1 for down
 * @returns {Array} - Array of { pitch, offset } objects
 */
export function calculateCollisionOffsets(pitches, stemDirection = 1) {
  const collisions = detectCollisions(pitches);
  const offsets = {};

  // Initialize all to 0
  for (const pitch of pitches) {
    offsets[pitch] = 0;
  }

  // Apply offsets for collisions
  for (const collision of collisions) {
    // The note that goes on the opposite side of the stem
    const offsetNote = stemDirection === 1 ? collision.upper : collision.lower;

    for (const pitch of pitches) {
      if (noteToMidi(pitch) === offsetNote) {
        offsets[pitch] = stemDirection === 1 ? 1 : -1;
        break;
      }
    }
  }

  return pitches.map(pitch => ({
    pitch,
    offset: offsets[pitch],
  }));
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Beaming
  BEAM_PATTERNS,
  getBeamGroups,
  groupNotesForBeaming,
  generateSmartBeams,

  // Stem directions
  STEM_REFERENCE,
  calculateStemDirection,
  calculateChordStemDirection,
  applyStemDirections,

  // Spacing
  calculateNoteSpacing,
  calculateMinimumMeasureWidth,

  // Voices
  allocateVoices,
  mergeVoices,

  // Collisions
  detectCollisions,
  calculateCollisionOffsets,
};
