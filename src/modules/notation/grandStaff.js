/**
 * Grand Staff - Two-hand display with brace connector
 * Part of the Phase 4.4 VexFlow Professional Notation enhancement
 *
 * This module handles rendering a grand staff with treble (right hand) and
 * bass (left hand) clefs, connected by a brace and shared barlines.
 */

import {
  createRenderer,
  createStave,
  createStaveNote,
  createChordNote,
  createRest,
  createGhostNote,
  createVoice,
  generateBeams,
  drawBeams,
  createTuplet,
  drawTuplets,
  getVexFlowKeySignature,
  noteToMidi,
  midiToNote,
  parseNote,
  getOctaveShift,
  applyOctaveShift,
  CLEF_RANGES,
  getDurationBeats,
  createMeasureAccidentalTracker,
} from './vexFlowRenderer.js';

import { analyzeChordTone, CHORD_TONE_COLORS } from '../analysis/chordToneAnalyzer.js';
import { getBeatsPerMeasureFromTimeSignature } from '../state/compositionState.js';

// VexFlow is loaded globally
// Use a getter function to check at runtime, not at module load time
// VexFlow 5.x uses window.VexFlow, older versions use window.Vex.Flow
function getVF() {
  return window.VexFlow || (window.Vex ? window.Vex.Flow : null);
}

// Stem directions for multi-voice notation
// Treble clef: V1 (melody) on top with stems UP, V2 (harmony) below with stems DOWN
// Bass clef: V1 (bass line) on bottom with stems DOWN, V2 (harmony/texture) above with stems UP
const TREBLE_VOICE_STEM_DIRECTIONS = {
  primary: 1,      // Voice 0: stems UP (melody on top)
  secondary: -1,   // Voice 1: stems DOWN (harmony below)
};

const BASS_VOICE_STEM_DIRECTIONS = {
  primary: -1,     // Voice 0: stems DOWN (bass line on bottom)
  secondary: 1,    // Voice 1: stems UP (harmony/texture above)
};

// ============================================================================
// TUPLET-AWARE BEAM GENERATION
// ============================================================================

/**
 * Check if a VexFlow note is beamable (eighth note or smaller)
 * @param {Object} vexNote - VexFlow StaveNote
 * @returns {boolean} - True if the note can be beamed
 */
function isBeamable(vexNote) {
  if (!vexNote || vexNote.isRest?.() || vexNote.getNoteType?.() === 'r') return false;
  const duration = vexNote.getDuration?.();
  // Beamable durations: 8, 16, 32 (and their dotted variants)
  return duration && ['8', '16', '32'].some(d => duration.startsWith(d));
}

/**
 * Generate beams that respect tuplet groupings and manual beam controls
 * Tuplet notes are beamed together as a unit, non-tuplet notes use standard beaming
 * Manual beam controls (_beamControl) allow forcing beam start/end/break points
 * @param {Array} vexNotes - All VexFlow notes in the measure
 * @param {Object} tupletGroups - Tuplet groups from createNotesForStaff
 * @param {string} timeSignature - Time signature for beat grouping (e.g., '4/4', '6/8')
 * @returns {Array} - Array of VexFlow Beam objects
 */
function generateBeamsWithTuplets(vexNotes, tupletGroups, timeSignature = '4/4') {
  const VF = getVF();
  if (!VF || !vexNotes || vexNotes.length === 0) return [];

  const beams = [];

  // Collect all notes that are in tuplet groups
  const tupletNoteSet = new Set();

  // Create beams for each tuplet group
  for (const group of Object.values(tupletGroups)) {
    if (!group.notes || group.notes.length < 2) continue;

    // Filter to only beamable notes in this tuplet
    const beamableNotes = group.notes.filter(n => isBeamable(n));

    if (beamableNotes.length >= 2) {
      try {
        // Get stem direction from the first note in the tuplet group
        let tupletStemDirection = null;
        if (beamableNotes[0].getStemDirection) {
          tupletStemDirection = beamableNotes[0].getStemDirection();
        }
        // Use generateBeams with preserveGrouping=true to beam ALL tuplet notes together
        // Tuplets should always be beamed as a single unit, not split by beat boundaries
        const tupletBeams = generateBeams(beamableNotes, {
          stemDirection: tupletStemDirection,
          timeSignature,
          preserveGrouping: true  // Critical: beam all tuplet notes together
        });
        beams.push(...tupletBeams);
      } catch (e) {
        console.warn('[generateBeamsWithTuplets] Error creating tuplet beam:', e);
      }
    }

    // Mark all notes in this tuplet as processed
    group.notes.forEach(n => tupletNoteSet.add(n));
  }

  // Group consecutive non-tuplet beamable notes, breaking at:
  // - Rests
  // - Notes with _beamControl.unbeam = true (removes note from beaming entirely)
  // - After notes with _beamControl.end = true
  // - Before notes with _beamControl.start = true
  const beamGroups = [];
  let currentGroup = [];

  for (const note of vexNotes) {
    // Skip tuplet notes (already handled above)
    if (tupletNoteSet.has(note)) {
      // Tuplet note breaks the current beam group
      if (currentGroup.length >= 2) {
        beamGroups.push(currentGroup);
      }
      currentGroup = [];
      continue;
    }

    const beamControl = note._beamControl;

    // Check if this note should be unbeamed entirely (removed from any beam group)
    // Support both 'unbeam' (new) and 'break' (legacy) property names
    if (beamControl?.unbeam || beamControl?.break) {
      // End current group before this note
      if (currentGroup.length >= 2) {
        beamGroups.push(currentGroup);
      }
      currentGroup = [];
      // This note is not beamed - skip it (it will render with individual flag)
      continue;
    }

    // Check if this note should start a new beam group
    if (beamControl?.start && currentGroup.length > 0) {
      // End previous group before starting new one
      if (currentGroup.length >= 2) {
        beamGroups.push(currentGroup);
      }
      currentGroup = [];
    }

    // Check if this note is beamable
    if (isBeamable(note)) {
      currentGroup.push(note);

      // Check if this note should end the beam group
      if (beamControl?.end) {
        if (currentGroup.length >= 2) {
          beamGroups.push(currentGroup);
        }
        currentGroup = [];
      }
    } else {
      // Rest or non-beamable note breaks the current beam group
      if (currentGroup.length >= 2) {
        beamGroups.push(currentGroup);
      }
      currentGroup = [];
    }
  }

  // Don't forget the last group
  if (currentGroup.length >= 2) {
    beamGroups.push(currentGroup);
  }

  // Generate beams for each group
  // Check if the GROUP has any notes with manual beam controls
  // If so, preserve the exact grouping; otherwise, let generateBeams apply beat-based splitting
  for (const group of beamGroups) {
    try {
      // Get stem direction from the first note in the group
      // This ensures beams respect multi-voice stem directions
      let groupStemDirection = null;
      if (group.length > 0 && group[0].getStemDirection) {
        groupStemDirection = group[0].getStemDirection();
      }

      // Check if this specific group has manual beam controls
      const groupHasManualControls = group.some(n => {
        const bc = n._beamControl;
        return bc && (bc.start || bc.end || bc.unbeam || bc.break);
      });

      // If manual beam controls exist in this group, preserve its exact grouping
      // Otherwise, let generateBeams apply beat-based splitting
      const groupBeams = generateBeams(group, {
        stemDirection: groupStemDirection,
        timeSignature,
        preserveGrouping: groupHasManualControls
      });
      beams.push(...groupBeams);
    } catch (e) {
      console.warn('[generateBeamsWithTuplets] Error creating standard beams:', e);
    }
  }

  return beams;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default dimensions for grand staff layout
 */
export const GRAND_STAFF_DEFAULTS = {
  measureWidth: 252,           // Width of each measure (balanced for 16 sixteenth notes and standard screens)
  staffSpacing: 80,            // Vertical space between staves
  systemMarginTop: 45,         // Top margin for each system (volta brackets + chord symbols + title spacing)
  systemMarginBottom: 80,      // Bottom margin (bass ledger lines + chord bracket labels with Roman numerals)
  braceWidth: 30,              // Width for the brace (includes left margin)
  measurePadding: 10,          // Padding within measures
  clefWidth: 24,               // Width for clef
  keySignatureWidth: 14,       // Width per accidental in key signature
  timeSignatureWidth: 24,      // Width for time signature
};

// ============================================================================
// MULTI-VOICE REST DISPLAY LOGIC
// ============================================================================

/**
 * Fill gaps in a voice's notes with rest entries.
 * This is required for smart rest visibility analysis to work - both voices
 * need explicit rest entries at beats where they're silent.
 *
 * @param {Array} notes - Array of note objects with beat and duration
 * @param {string} timeSignature - Time signature string (e.g., '4/4')
 * @param {string} clef - 'treble' or 'bass' for rest pitch positioning
 * @returns {Array} - Notes array with rests added to fill gaps
 */
export function fillGapsWithRests(notes, timeSignature = '4/4', clef = 'treble', voiceIndex = undefined) {
  if (!notes || notes.length === 0) {
    return notes;
  }

  // If voiceIndex not provided, try to infer from existing notes
  if (voiceIndex === undefined && notes.length > 0) {
    voiceIndex = notes[0].voiceIndex;
  }

  // Parse time signature to get total beats in measure
  const [num, denom] = timeSignature.split('/').map(Number);
  const totalBeats = num || 4;

  // Duration string to beats mapping
  // Supports canonical format: duration='2n', dotted=true (separate parameter)
  const durationToBeats = (duration, dotted = false) => {
    if (!duration) return 1;
    const baseDuration = duration.replace(/[dn.]/g, '');
    // Check both: dot in string OR separate dotted flag (canonical format)
    const isDotted = duration.includes('d') || duration.includes('.') || dotted;
    let beats = 1;
    switch (baseDuration) {
      case '1': case 'w': beats = 4; break;
      case '2': case 'h': beats = 2; break;
      case '4': case 'q': beats = 1; break;
      case '8': beats = 0.5; break;
      case '16': beats = 0.25; break;
      case '32': beats = 0.125; break;
      default:
        // Try parsing as '4n' format
        if (baseDuration.endsWith('n')) {
          const noteValue = parseInt(baseDuration.replace('n', ''), 10);
          if (!isNaN(noteValue)) {
            beats = 4 / noteValue;
          }
        }
    }
    return isDotted ? beats * 1.5 : beats;
  };

  // Beats to duration object mapping (returns { duration, dotted } for canonical format)
  const beatsToDurationObj = (beats) => {
    if (beats >= 4) return { duration: '1n', dotted: false };
    if (beats >= 3) return { duration: '2n', dotted: true };   // dotted half
    if (beats >= 2) return { duration: '2n', dotted: false };
    if (beats >= 1.5) return { duration: '4n', dotted: true }; // dotted quarter
    if (beats >= 1) return { duration: '4n', dotted: false };
    if (beats >= 0.75) return { duration: '8n', dotted: true }; // dotted eighth
    if (beats >= 0.5) return { duration: '8n', dotted: false };
    if (beats >= 0.25) return { duration: '16n', dotted: false };
    if (beats >= 0.125) return { duration: '32n', dotted: false };
    return { duration: '4n', dotted: false };
  };

  // Build a map of occupied beat ranges
  // Include BOTH notes AND existing rests - we don't want to add rests where rests already exist
  const occupiedRanges = [];
  notes.forEach(note => {
    const start = note.beat ?? 0;
    const duration = durationToBeats(note.duration, note.dotted);
    occupiedRanges.push({ start, end: start + duration });
  });

  // Sort by start beat
  occupiedRanges.sort((a, b) => a.start - b.start);

  // Find gaps and create rests
  const rests = [];
  let currentBeat = 0;

  for (const range of occupiedRanges) {
    if (range.start > currentBeat) {
      // Gap found - create rest(s) to fill it
      let gapStart = currentBeat;
      const gapEnd = range.start;

      while (gapStart < gapEnd) {
        const gapDuration = gapEnd - gapStart;
        const { duration: restDuration, dotted: restDotted } = beatsToDurationObj(gapDuration);
        const restBeats = durationToBeats(restDuration, restDotted);

        rests.push({
          beat: gapStart,
          duration: restDuration,
          dotted: restDotted,
          isRest: true,
          type: 'rest',
          pitch: clef === 'bass' ? 'D3' : 'B4',
          voiceIndex: voiceIndex, // Preserve voice for multi-voice support
          _autoGenerated: true, // Mark as auto-generated for debugging
        });

        gapStart += restBeats;
      }
    }
    currentBeat = Math.max(currentBeat, range.end);
  }

  // Fill any remaining gap at the end of the measure
  while (currentBeat < totalBeats) {
    const remainingBeats = totalBeats - currentBeat;
    const { duration: restDuration, dotted: restDotted } = beatsToDurationObj(remainingBeats);
    const restBeats = durationToBeats(restDuration, restDotted);

    rests.push({
      beat: currentBeat,
      duration: restDuration,
      dotted: restDotted,
      isRest: true,
      type: 'rest',
      pitch: clef === 'bass' ? 'D3' : 'B4',
      voiceIndex: voiceIndex, // Preserve voice for multi-voice support
      _autoGenerated: true,
    });

    currentBeat += restBeats;
  }

  // Combine original notes with generated rests and sort by beat
  const combined = [...notes, ...rests];
  combined.sort((a, b) => (a.beat ?? 0) - (b.beat ?? 0));

  return combined;
}

/**
 * Analyze two voices and determine rest visibility for clean notation.
 *
 * REST RULES FOR TWO-VOICE NOTATION:
 * 1. V1 (primary voice) rests: Always full-size regular rests
 * 2. V2 (secondary voice) rests: Hidden in clean mode when V1 has content at same beat
 *    - When V1 has a note or rest, V2's filler rest is redundant
 * 3. In "explicit" mode ("All"): Show all V2 rests as cue rests (small and gray)
 *
 * @param {Array} primaryVoiceNotes - Notes from voice 1 (typically stems up)
 * @param {Array} secondaryVoiceNotes - Notes from voice 2 (typically stems down)
 * @param {Object} options - Display options
 * @param {string} options.restDisplayMode - 'clean' (smart omission) or 'explicit' (show all)
 * @returns {Object} - { primaryRestVisibility: Map, secondaryRestVisibility: Map }
 *                     Each map: beat -> { hidden: boolean, isCue: boolean }
 */
export function analyzeRestVisibility(primaryVoiceNotes, secondaryVoiceNotes, options = {}) {
  const {
    restDisplayMode = 'clean',
  } = options;

  // Maps: beat number -> { hidden: boolean, isCue: boolean }
  const primaryRestVisibility = new Map();
  const secondaryRestVisibility = new Map();

  // "explicit" mode ("All"): show all rests
  // "clean" mode: hide redundant V2 rests
  const isExplicitMode = restDisplayMode === 'explicit';

  // Build beat maps for each voice - track what's at each beat
  const buildBeatMap = (notes) => {
    const beatMap = new Map();
    notes.forEach((note, idx) => {
      const beat = note.beat ?? 0;
      beatMap.set(beat, {
        isRest: note.isRest || note.type === 'rest',
        hasNote: !note.isRest && note.type !== 'rest',
        index: idx,
      });
    });
    return beatMap;
  };

  const primaryBeatMap = buildBeatMap(primaryVoiceNotes);

  // Primary voice rests: always regular (no cue styling needed)
  // No entries needed - they render as normal full-size rests

  // Secondary voice rests visibility:
  // - Clean mode: HIDE when V1 has anything (note or rest) at that beat
  // - Explicit mode: Show as cue rests (small and gray)
  secondaryVoiceNotes.forEach((note) => {
    if (note.isRest || note.type === 'rest') {
      const beat = note.beat ?? 0;
      const primaryAtBeat = primaryBeatMap.get(beat);

      // V1 has content at this beat if there's any entry (note or rest)
      const primaryHasContent = primaryAtBeat !== undefined;

      if (!isExplicitMode && primaryHasContent) {
        // Clean mode: hide V2 rest when V1 has anything at same position
        // The rhythmic structure is already established by V1
        secondaryRestVisibility.set(beat, { hidden: true, isCue: true });
      } else {
        // Explicit mode: show V2 rests as cue rests (small and gray)
        secondaryRestVisibility.set(beat, { hidden: false, isCue: true });
      }
    }
  });

  return { primaryRestVisibility, secondaryRestVisibility };
}

/**
 * Apply rest visibility settings to a note array before rendering.
 * Modifies notes in place, adding _restDisplay property.
 *
 * The _restDisplay property controls how rests are rendered:
 * - { hidden: true } -> Use GhostNote (invisible spacer)
 * - { isCue: true } -> Use small grayed cue rest
 * - neither -> Normal full-size rest
 *
 * @param {Array} notes - Array of note data
 * @param {Map} restVisibilityMap - Map of beat -> { hidden, isCue }
 */
export function applyRestVisibility(notes, restVisibilityMap) {
  if (!restVisibilityMap || restVisibilityMap.size === 0) return;

  notes.forEach(note => {
    if (note.isRest || note.type === 'rest') {
      const beat = note.beat ?? 0;
      const visibility = restVisibilityMap.get(beat);
      if (visibility) {
        note._restDisplay = visibility;
      }
    }
  });
}

/**
 * Convert chord type to display suffix (e.g., "Suspended 4th" -> "sus4")
 * @param {string} chordType - Full chord type name
 * @returns {string} - Display suffix
 */
function getChordTypeSuffix(chordType) {
  if (!chordType) return '';

  const suffixes = {
    // Basic triads
    'Major': '',
    'Minor': 'm',
    'Diminished': 'dim',
    'Augmented': 'aug',
    'Power Chord': '5',

    // Suspended chords (all variants)
    'Sus2': 'sus2',
    'Sus4': 'sus4',
    'Sus2': 'sus2',
    'Sus4': 'sus4',

    // Sixth chords
    'Major 6th': '6',
    'Minor 6th': 'm6',

    // Seventh chords
    'Dominant 7th': '7',
    'Major 7th': 'maj7',
    'Minor 7th': 'm7',
    'Half-Diminished 7th': 'm7b5',
    'Diminished 7th': 'dim7',
    'Minor-Major 7th': 'mMaj7',
    'Augmented 7th': 'aug7',

    // Ninth chords
    'Add9': 'add9',
    'Add9': 'add9',
    'Minor 9th': 'm9',
    'Minor 9': 'm9',
    'Major 9th': 'maj9',
    'Major 9': 'maj9',
    'Dominant 9th': '9',
    'Dominant 9': '9',
    '6/9': '6/9',

    // Extended chords
    'Minor 11th': 'm11',
    'Minor 11': 'm11',
    'Dominant 11th': '11',
    'Dominant 11': '11',
    'Minor 13th': 'm13',
    'Minor 13': 'm13',
    'Dominant 13th': '13',
    'Dominant 13': '13',
  };

  return suffixes[chordType] || '';
}

/**
 * Format chord name for display (e.g., "G" + "Suspended 4th" -> "Gsus4")
 * @param {object} chord - Chord object with root, type, name, simpleName
 * @returns {string} - Formatted chord name
 */
function formatChordNameForDisplay(chord) {
  if (!chord) return '';

  // ALWAYS build from root + type to ensure we show the current chord data
  // The 'name' property can be stale if only root/type were updated
  const root = chord.root || '';
  const type = chord.type || '';

  // Handle "No Chord" specially - return N.C.
  if (type === 'No Chord') {
    return 'N.C.';
  }

  // If we have root, build the display name from root + type
  if (root) {
    // For intervals, use "C P4" format; for chords, use normal symbol
    if (chord.selectionMode === 'interval') {
      return root + ' ' + (chord.simpleName || type);
    }
    const suffix = getChordTypeSuffix(type);
    return root + suffix;
  }

  // Fallback to simpleName or name if no root
  if (chord.simpleName) return chord.simpleName;
  if (chord.name) {
    // Strip inversion indicators from name if present
    return chord.name.replace(/\s*\((Root|1st|2nd|3rd|4th|5th)\)$/i, '').trim();
  }

  return '';
}

/**
 * Get staff connector types (must be called at runtime when VF is available)
 */
function getConnectorTypes() {
  const VF = getVF();
  return {
    BRACE: VF ? VF.StaveConnector.type.BRACE : 1,
    SINGLE_LEFT: VF ? VF.StaveConnector.type.SINGLE_LEFT : 4,
    SINGLE_RIGHT: VF ? VF.StaveConnector.type.SINGLE_RIGHT : 0,
    BRACKET: VF ? VF.StaveConnector.type.BRACKET : 3,
  };
}

// ============================================================================
// MANUAL TIE CURVE RENDERING
// ============================================================================

/**
 * Draw tie curves manually using canvas API
 * This bypasses VexFlow's StaveTie which fails for cross-measure ties
 * @param {Object} context - VexFlow/Canvas context
 * @param {Array} renderedMeasures - Array of rendered measure objects
 * @param {Array} measures - Original measure data
 */
function drawManualTies(context, renderedMeasures, measures) {
  if (!renderedMeasures || renderedMeasures.length === 0) {
    return;
  }

  // VexFlow 5.x context structure: context.vexFlowCanvasContext is the raw 2D context
  // But we need to try multiple approaches since VexFlow context varies
  let ctx = null;
  let contextSource = 'unknown';

  // Try different ways to get the raw canvas context
  if (context.vexFlowCanvasContext && typeof context.vexFlowCanvasContext.beginPath === 'function') {
    ctx = context.vexFlowCanvasContext;
    contextSource = 'vexFlowCanvasContext';
  } else if (context.context && typeof context.context.beginPath === 'function') {
    ctx = context.context;
    contextSource = 'context.context';
  } else if (context.canvas && context.canvas.getContext) {
    // VexFlow context has a canvas property
    ctx = context.canvas.getContext('2d');
    contextSource = 'context.canvas.getContext';
  } else if (typeof context.beginPath === 'function') {
    // context IS the raw canvas context
    ctx = context;
    contextSource = 'context directly';
  } else if (context.getCanvasContext && typeof context.getCanvasContext === 'function') {
    // Some VexFlow versions expose this method
    ctx = context.getCanvasContext();
    contextSource = 'getCanvasContext()';
  }

  // Last resort: try to find the canvas element and get its context
  if (!ctx) {
    // Try to get from the backend
    try {
      if (context.backend && context.backend.ctx) {
        ctx = context.backend.ctx;
        contextSource = 'backend.ctx';
      }
    } catch (e) {
      // Ignore
    }
  }

  if (!ctx || typeof ctx.beginPath !== 'function') {
    return;
  }

  drawManualTiesOnContext(ctx, renderedMeasures, measures);
}

/**
 * Draw ties on a canvas 2D context
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Array} renderedMeasures - Rendered measures with VexFlow notes
 * @param {Array} measures - Original measure data
 */
function drawManualTiesOnContext(ctx, renderedMeasures, measures) {

  // Helper to determine if two measures are on the same row (system)
  // We check if the Y positions are similar (within tolerance)
  function areMeasuresOnSameRow(measure1, measure2) {
    if (!measure1 || !measure2) return false;

    // Get Y positions from the actual bounds or stave positions
    const y1 = measure1.actualBounds?.bassY || measure1.bounds?.y || 0;
    const y2 = measure2.actualBounds?.bassY || measure2.bounds?.y || 0;

    // If Y positions differ by more than 50px, they're on different rows
    return Math.abs(y1 - y2) < 50;
  }

  // Helper to determine tie direction based on note stem direction
  // In bass clef: tie curves AWAY from note heads
  // - If stem is up (note is low), tie goes below
  // - If stem is down (note is high), tie goes above
  function getTieDirection(vexNote) {
    if (!vexNote) return 'above'; // Default for bass clef

    try {
      // VexFlow notes have getStemDirection() method
      // 1 = up, -1 = down
      const stemDir = vexNote.getStemDirection ? vexNote.getStemDirection() : null;

      if (stemDir === 1) {
        // Stem up = note is low, tie goes below
        return 'below';
      } else if (stemDir === -1) {
        // Stem down = note is high, tie goes above
        return 'above';
      }

      // For whole notes (no stem), check the note's Y position
      // Higher on staff (lower Y) = tie above, lower on staff (higher Y) = tie below
      const box = vexNote.getBoundingBox();
      if (box) {
        // Middle line of bass clef is around D3
        // Notes above middle line get ties above, below get ties below
        const noteY = box.getY() + box.getH() / 2;
        // Approximate middle of bass staff - adjust based on your layout
        return noteY < 150 ? 'above' : 'below';
      }
    } catch (e) {
      // Ignore errors
    }

    return 'above'; // Default for bass clef (most bass notes are low)
  }

  // Helper to normalize pitch for comparison (handle enharmonic equivalents)
  // Returns a simplified pitch string for comparison, e.g., "C3", "F#2"
  function normalizePitch(pitch) {
    if (!pitch) return null;
    // Handle array of pitches (chords) - return first pitch for tie comparison
    if (Array.isArray(pitch)) {
      pitch = pitch[0];
    }
    if (typeof pitch !== 'string') return null;
    // Normalize to uppercase and handle common enharmonic variations
    return pitch.trim().toUpperCase();
  }

  // Helper to check if two notes have matching pitches (for valid ties)
  // A tie should only connect notes of the SAME pitch
  function pitchesMatch(noteData1, noteData2) {
    if (!noteData1 || !noteData2) return false;

    // Get pitches from various possible properties
    const pitch1 = noteData1.pitch || noteData1.pitches?.[0] || noteData1.keys?.[0];
    const pitch2 = noteData2.pitch || noteData2.pitches?.[0] || noteData2.keys?.[0];

    const norm1 = normalizePitch(pitch1);
    const norm2 = normalizePitch(pitch2);

    if (!norm1 || !norm2) return false;

    // Direct match
    if (norm1 === norm2) return true;

    // Handle enharmonic equivalents (e.g., C# = Db)
    const enharmonicMap = {
      'C#': 'DB', 'DB': 'C#',
      'D#': 'EB', 'EB': 'D#',
      'F#': 'GB', 'GB': 'F#',
      'G#': 'AB', 'AB': 'G#',
      'A#': 'BB', 'BB': 'A#',
    };

    // Extract note name and octave
    const match1 = norm1.match(/^([A-G][#B]?)(\d+)?$/);
    const match2 = norm2.match(/^([A-G][#B]?)(\d+)?$/);

    if (!match1 || !match2) return false;

    const [, note1, oct1] = match1;
    const [, note2, oct2] = match2;

    // Octaves must match (if specified)
    if (oct1 && oct2 && oct1 !== oct2) return false;

    // Check direct note match or enharmonic equivalent
    if (note1 === note2) return true;
    if (enharmonicMap[note1] === note2) return true;

    return false;
  }

  // Look for tied bass notes across measure boundaries
  // Semantic: note.tied=true means "tie FROM this note TO the next note"
  // So we check the LAST note of each voice in the current measure for the tied flag
  // MULTI-VOICE: Check all voices, not just voice 0
  for (let i = 0; i < renderedMeasures.length - 1; i++) {
    const currentMeasure = renderedMeasures[i];
    const nextMeasure = renderedMeasures[i + 1];

    // Get bass notes from rendered measures (VexFlow note objects)
    const currentBassNotes = currentMeasure.bassNotes;
    const nextBassNotes = nextMeasure.bassNotes;

    if (!currentBassNotes || !nextBassNotes || currentBassNotes.length === 0 || nextBassNotes.length === 0) {
      continue;
    }

    // Get measure data for the CURRENT and NEXT measures
    const currentMeasureData = measures[currentMeasure.index];
    const nextMeasureData = measures[nextMeasure.index];

    // Get flat bassNotes arrays (the renderer uses flat arrays with voiceIndex property)
    const currentAllNotes = currentMeasureData?.bassNotes || [];
    const nextAllNotes = nextMeasureData?.bassNotes || [];

    // Check each voice for ties (voice 0 and voice 1)
    for (let voiceIndex = 0; voiceIndex < 2; voiceIndex++) {
      // Filter notes by voiceIndex
      const currentVoiceNotes = currentAllNotes.filter(n => (n.voiceIndex || 0) === voiceIndex);
      const nextVoiceNotes = nextAllNotes.filter(n => (n.voiceIndex || 0) === voiceIndex);

      if (currentVoiceNotes.length === 0) continue;

      // Find the last non-rest note in this voice (by beat position, not array order)
      const sortedCurrentNotes = [...currentVoiceNotes].sort((a, b) => (b.beat || 0) - (a.beat || 0));
      let lastNoteData = null;
      for (const note of sortedCurrentNotes) {
        if (!note.isRest && note.type !== 'rest') {
          lastNoteData = note;
          break;
        }
      }

      if (!lastNoteData || lastNoteData.tied !== true) continue;

      // Find the first non-rest note in the next measure's same voice (by beat position)
      const sortedNextNotes = [...nextVoiceNotes].sort((a, b) => (a.beat || 0) - (b.beat || 0));
      let firstNextNoteData = null;
      for (const note of sortedNextNotes) {
        if (!note.isRest && note.type !== 'rest') {
          firstNextNoteData = note;
          break;
        }
      }

      if (!firstNextNoteData || firstNextNoteData.isRest) continue;

      // IMPORTANT: Only draw tie if pitches match - ties connect same pitches only
      if (!pitchesMatch(lastNoteData, firstNextNoteData)) {
        continue;
      }

      // VexFlow has separate arrays: bassNotes for voice 0, bassNotes2 for voice 1
      const currentVexNotes = voiceIndex === 0 ? currentBassNotes : (currentMeasure.bassNotes2 || []);
      const nextVexNotes = voiceIndex === 0 ? nextBassNotes : (nextMeasure.bassNotes2 || []);

      if (currentVexNotes.length === 0 || nextVexNotes.length === 0) continue;

      // Get the last note from current measure and first from next
      const lastCurrentNote = currentVexNotes[currentVexNotes.length - 1];
      const firstNextNote = nextVexNotes[0];

      if (!lastCurrentNote || !firstNextNote) continue;

      // Check if measures are on the same row
      if (!areMeasuresOnSameRow(currentMeasure, nextMeasure)) {
        // Cross-row tie: draw two partial ties
        try {
          const startBox = lastCurrentNote.getBoundingBox();
          const endBox = firstNextNote.getBoundingBox();

          if (startBox) {
            const direction = getTieDirection(lastCurrentNote);
            const startX = startBox.getX() + startBox.getW();
            const endX = startX + 30;

            let startY;
            if (direction === 'above') {
              startY = startBox.getY() - 5;
            } else {
              startY = startBox.getY() + startBox.getH() + 5;
            }

            drawPartialTieCurve(ctx, startX, startY, endX, startY, direction, 'end');
          }

          if (endBox) {
            const direction = getTieDirection(firstNextNote);
            const endX = endBox.getX();
            const startX = endX - 30;

            let endY;
            if (direction === 'above') {
              endY = endBox.getY() - 5;
            } else {
              endY = endBox.getY() + endBox.getH() + 5;
            }

            drawPartialTieCurve(ctx, startX, endY, endX, endY, direction, 'start');
          }
        } catch (e) {
          // Could not draw cross-row bass tie
        }
      } else {
        // Same row - draw normal tie
        try {
          const startBox = lastCurrentNote.getBoundingBox();
          const endBox = firstNextNote.getBoundingBox();

          if (startBox && endBox) {
            const direction = getTieDirection(lastCurrentNote);

            const startX = startBox.getX() + startBox.getW();
            const endX = endBox.getX();

            let startY, endY;
            if (direction === 'above') {
              startY = startBox.getY() - 5;
              endY = endBox.getY() - 5;
            } else {
              startY = startBox.getY() + startBox.getH() + 5;
              endY = endBox.getY() + endBox.getH() + 5;
            }

            drawTieCurve(ctx, startX, startY, endX, endY, direction);
          }
        } catch (e) {
          // Could not get bounding box - skip this tie
        }
      }
    }
  }

  // Also check for bass ties within measures (for split notes)
  // Semantic: note.tied=true means "tie FROM this note TO the next note"
  // MULTI-VOICE: Check all voices, not just voice 0
  for (const renderedMeasure of renderedMeasures) {
    const bassNotes = renderedMeasure.bassNotes;
    if (!bassNotes || bassNotes.length < 2) continue;

    const measureData = measures[renderedMeasure.index];

    // Get flat bassNotes array with voiceIndex property
    const allBassNoteData = measureData?.bassNotes || [];

    // Check each voice for within-measure ties
    for (let voiceIndex = 0; voiceIndex < 2; voiceIndex++) {
      // Filter notes by voiceIndex and sort by beat position
      const voiceNotes = allBassNoteData
        .filter(n => (n.voiceIndex || 0) === voiceIndex)
        .sort((a, b) => (a.beat || 0) - (b.beat || 0));

      if (voiceNotes.length < 2) continue;

      // VexFlow has separate arrays: bassNotes for voice 0, bassNotes2 for voice 1
      const vexNotes = voiceIndex === 0 ? bassNotes : (renderedMeasure.bassNotes2 || []);

      if (vexNotes.length < 2) continue;

      // Check each note (except the last) for tied flag
      for (let j = 0; j < voiceNotes.length - 1 && j < vexNotes.length - 1; j++) {
        const noteData = voiceNotes[j];
        const nextNoteData = voiceNotes[j + 1];

        // Skip ties for rests - rests don't need tie markings
        // Check if THIS note has tied=true (meaning tie TO the next note)
        // Also verify pitches match - ties only connect same pitches
        if (noteData && noteData.tied === true && !noteData.isRest && !nextNoteData?.isRest && pitchesMatch(noteData, nextNoteData)) {
          const currNote = vexNotes[j];
          const nextNote = vexNotes[j + 1];

          try {
            const startBox = currNote.getBoundingBox();
            const endBox = nextNote.getBoundingBox();

            if (startBox && endBox) {
              const direction = getTieDirection(currNote);

              const startX = startBox.getX() + startBox.getW();
              const endX = endBox.getX();

              let startY, endY;
              if (direction === 'above') {
                startY = startBox.getY() - 5;
                endY = endBox.getY() - 5;
              } else {
                startY = startBox.getY() + startBox.getH() + 5;
                endY = endBox.getY() + endBox.getH() + 5;
              }

              drawTieCurve(ctx, startX, startY, endX, endY, direction);
            }
          } catch (e) {
            // Could not get bounding box for intra-measure tie - skip
          }
        }
      }
    }
  }

  // =====================================================================
  // BASS TIES - Cross-page partial ties
  // These handle ties that continue to/from another page
  // MULTI-VOICE: Check all voices, not just voice 0
  // =====================================================================

  // Check FIRST measure of page for "tie from nowhere" (note has isTied=true)
  // This means the note is a continuation from the previous page
  if (renderedMeasures.length > 0) {
    const firstMeasure = renderedMeasures[0];
    const firstBassNotes = firstMeasure.bassNotes;

    if (firstBassNotes && firstBassNotes.length > 0) {
      const firstMeasureData = measures[firstMeasure.index];
      const allBassNoteData = firstMeasureData?.bassNotes || [];

      // Check each voice for cross-page ties
      for (let voiceIndex = 0; voiceIndex < 2; voiceIndex++) {
        // Filter notes by voiceIndex and sort by beat position
        const voiceNotes = allBassNoteData
          .filter(n => (n.voiceIndex || 0) === voiceIndex)
          .sort((a, b) => (a.beat || 0) - (b.beat || 0));

        if (voiceNotes.length === 0) continue;

        const firstNoteData = voiceNotes[0];

        // If first note has isTied=true, it's a continuation from previous page
        if (firstNoteData && firstNoteData.isTied === true && !firstNoteData.isRest) {
          // VexFlow has separate arrays: bassNotes for voice 0, bassNotes2 for voice 1
          const vexNotes = voiceIndex === 0 ? firstBassNotes : (firstMeasure.bassNotes2 || []);

          if (vexNotes.length === 0) continue;

          const firstNote = vexNotes[0];
          try {
            const box = firstNote.getBoundingBox();
            if (box) {
              const direction = getTieDirection(firstNote);
              const endX = box.getX();
              const startX = endX - 30; // "From nowhere" - left of the note

              let endY;
              if (direction === 'above') {
                endY = box.getY() - 5;
              } else {
                endY = box.getY() + box.getH() + 5;
              }

              // Draw partial tie coming from the left
              drawPartialTieCurve(ctx, startX, endY, endX, endY, direction, 'start');
            }
          } catch (e) {
            // Could not get bounding box - skip
          }
        }
      }
    }
  }

  // Check LAST measure of page for "tie to nowhere" (note has tied=true)
  // This means the note continues to the next page
  if (renderedMeasures.length > 0) {
    const lastMeasure = renderedMeasures[renderedMeasures.length - 1];
    const lastBassNotes = lastMeasure.bassNotes;

    if (lastBassNotes && lastBassNotes.length > 0) {
      const lastMeasureData = measures[lastMeasure.index];
      const allBassNoteData = lastMeasureData?.bassNotes || [];

      // Check each voice for cross-page ties
      for (let voiceIndex = 0; voiceIndex < 2; voiceIndex++) {
        // Filter notes by voiceIndex and sort by beat position (descending to get last note)
        const voiceNotes = allBassNoteData
          .filter(n => (n.voiceIndex || 0) === voiceIndex)
          .sort((a, b) => (b.beat || 0) - (a.beat || 0));

        if (voiceNotes.length === 0) continue;

        const lastNoteData = voiceNotes[0]; // First after descending sort = last by beat

        // If last note has tied=true, it continues to the next page
        if (lastNoteData && lastNoteData.tied === true && !lastNoteData.isRest) {
          // VexFlow has separate arrays: bassNotes for voice 0, bassNotes2 for voice 1
          const vexNotes = voiceIndex === 0 ? lastBassNotes : (lastMeasure.bassNotes2 || []);

          if (vexNotes.length === 0) continue;

          const lastNote = vexNotes[vexNotes.length - 1];
          try {
            const box = lastNote.getBoundingBox();
            if (box) {
              const direction = getTieDirection(lastNote);
              const startX = box.getX() + box.getW();
              const endX = startX + 30; // "To nowhere" - right of the note

              let startY;
              if (direction === 'above') {
                startY = box.getY() - 5;
              } else {
                startY = box.getY() + box.getH() + 5;
              }

              // Draw partial tie going to the right
              drawPartialTieCurve(ctx, startX, startY, endX, startY, direction, 'end');
            }
          } catch (e) {
            // Could not get bounding box - skip
          }
        }
      }
    }
  }

  // =====================================================================
  // TREBLE TIES - Cross-measure and intra-measure
  // =====================================================================

  // Helper to determine tie direction for treble notes
  function getTrebleTieDirection(vexNote) {
    if (!vexNote) return 'below'; // Default for treble clef

    try {
      const stemDir = vexNote.getStemDirection ? vexNote.getStemDirection() : null;

      if (stemDir === 1) {
        // Stem up = tie goes below
        return 'below';
      } else if (stemDir === -1) {
        // Stem down = tie goes above
        return 'above';
      }

      // For whole notes (no stem), check the note's Y position
      const box = vexNote.getBoundingBox();
      if (box) {
        const noteY = box.getY() + box.getH() / 2;
        return noteY < 100 ? 'above' : 'below';
      }
    } catch (e) {
      // Ignore errors
    }

    return 'below'; // Default for treble clef
  }

  // Look for tied treble notes across measure boundaries
  // Semantic: note.tied=true means "tie FROM this note TO the next note"
  // So we check the LAST note of each voice in the current measure for the tied flag
  // MULTI-VOICE: Check all voices, not just voice 0
  for (let i = 0; i < renderedMeasures.length - 1; i++) {
    const currentMeasure = renderedMeasures[i];
    const nextMeasure = renderedMeasures[i + 1];

    // Get treble notes from rendered measures (VexFlow note objects)
    const currentTrebleNotes = currentMeasure.trebleNotes;
    const nextTrebleNotes = nextMeasure.trebleNotes;

    if (!currentTrebleNotes || !nextTrebleNotes || currentTrebleNotes.length === 0 || nextTrebleNotes.length === 0) {
      continue;
    }

    // Get measure data for the CURRENT and NEXT measures
    const currentMeasureData = measures[currentMeasure.index];
    const nextMeasureData = measures[nextMeasure.index];

    // Get flat trebleNotes arrays (the renderer uses flat arrays with voiceIndex property)
    const currentAllNotes = currentMeasureData?.trebleNotes || [];
    const nextAllNotes = nextMeasureData?.trebleNotes || [];

    // Check each voice for ties (voice 0 and voice 1)
    for (let voiceIndex = 0; voiceIndex < 2; voiceIndex++) {
      // Filter notes by voiceIndex
      const currentVoiceNotes = currentAllNotes.filter(n => (n.voiceIndex || 0) === voiceIndex);
      const nextVoiceNotes = nextAllNotes.filter(n => (n.voiceIndex || 0) === voiceIndex);

      if (currentVoiceNotes.length === 0) continue;

      // Find the last non-rest note in this voice (by beat position, not array order)
      const sortedCurrentNotes = [...currentVoiceNotes].sort((a, b) => (b.beat || 0) - (a.beat || 0));
      let lastNoteData = null;
      for (const note of sortedCurrentNotes) {
        if (!note.isRest && note.type !== 'rest') {
          lastNoteData = note;
          break;
        }
      }

      if (!lastNoteData || lastNoteData.tied !== true) continue;

      // Find the first non-rest note in the next measure's same voice (by beat position)
      const sortedNextNotes = [...nextVoiceNotes].sort((a, b) => (a.beat || 0) - (b.beat || 0));
      let firstNextNoteData = null;
      for (const note of sortedNextNotes) {
        if (!note.isRest && note.type !== 'rest') {
          firstNextNoteData = note;
          break;
        }
      }

      if (!firstNextNoteData || firstNextNoteData.isRest) continue;

      // IMPORTANT: Only draw tie if pitches match - ties connect same pitches only
      if (!pitchesMatch(lastNoteData, firstNextNoteData)) {
        continue;
      }

      // VexFlow has separate arrays: trebleNotes for voice 0, trebleNotes2 for voice 1
      const currentVexNotes = voiceIndex === 0 ? currentTrebleNotes : (currentMeasure.trebleNotes2 || []);
      const nextVexNotes = voiceIndex === 0 ? nextTrebleNotes : (nextMeasure.trebleNotes2 || []);

      if (currentVexNotes.length === 0 || nextVexNotes.length === 0) continue;

      // Get the last note from current measure and first from next
      const lastCurrentNote = currentVexNotes[currentVexNotes.length - 1];
      const firstNextNote = nextVexNotes[0];

      if (!lastCurrentNote || !firstNextNote) continue;

      // Check if measures are on the same row
      if (!areMeasuresOnSameRow(currentMeasure, nextMeasure)) {
        // Cross-row tie: draw two partial ties
        try {
          const startBox = lastCurrentNote.getBoundingBox();
          const endBox = firstNextNote.getBoundingBox();

          if (startBox) {
            const direction = getTrebleTieDirection(lastCurrentNote);
            const startX = startBox.getX() + startBox.getW();
            const endX = startX + 30;

            let startY;
            if (direction === 'above') {
              startY = startBox.getY() - 5;
            } else {
              startY = startBox.getY() + startBox.getH() + 5;
            }

            drawPartialTieCurve(ctx, startX, startY, endX, startY, direction, 'end');
          }

          if (endBox) {
            const direction = getTrebleTieDirection(firstNextNote);
            const endX = endBox.getX();
            const startX = endX - 30;

            let endY;
            if (direction === 'above') {
              endY = endBox.getY() - 5;
            } else {
              endY = endBox.getY() + endBox.getH() + 5;
            }

            drawPartialTieCurve(ctx, startX, endY, endX, endY, direction, 'start');
          }
        } catch (e) {
          // Could not draw cross-row treble tie
        }
      } else {
        // Same row - draw normal tie
        try {
          const startBox = lastCurrentNote.getBoundingBox();
          const endBox = firstNextNote.getBoundingBox();

          if (startBox && endBox) {
            const direction = getTrebleTieDirection(lastCurrentNote);

            const startX = startBox.getX() + startBox.getW();
            const endX = endBox.getX();

            let startY, endY;
            if (direction === 'above') {
              startY = startBox.getY() - 5;
              endY = endBox.getY() - 5;
            } else {
              startY = startBox.getY() + startBox.getH() + 5;
              endY = endBox.getY() + endBox.getH() + 5;
            }

            drawTieCurve(ctx, startX, startY, endX, endY, direction);
          }
        } catch (e) {
          // Could not draw treble tie
        }
      }
    }
  }

  // Also check for treble ties within measures (for split notes)
  // Semantic: note.tied=true means "tie FROM this note TO the next note"
  // So we check each note (except the last) for the tied flag
  // MULTI-VOICE: Check all voices, not just voice 0
  for (const renderedMeasure of renderedMeasures) {
    const trebleNotes = renderedMeasure.trebleNotes;
    if (!trebleNotes || trebleNotes.length < 2) continue;

    const measureData = measures[renderedMeasure.index];
    // Use flat trebleNotes array (the renderer uses flat arrays with voiceIndex property)
    const allNotes = measureData?.trebleNotes || [];

    // Check each voice for within-measure ties
    for (let voiceIndex = 0; voiceIndex < 2; voiceIndex++) {
      // Filter notes by voiceIndex and sort by beat
      const voiceNoteData = allNotes
        .filter(n => (n.voiceIndex || 0) === voiceIndex)
        .sort((a, b) => (a.beat || 0) - (b.beat || 0));

      if (voiceNoteData.length < 2) continue;

      // Check each note (except the last) for tied flag
      for (let j = 0; j < voiceNoteData.length - 1; j++) {
        const noteData = voiceNoteData[j];
        const nextNoteData = voiceNoteData[j + 1];

        // Check if THIS note has tied=true (meaning tie TO the next note)
        // Also verify pitches match - ties only connect same pitches
        // IMPORTANT: Only check 'tied' (ties TO next), NOT 'isTied' (continuation FROM previous)
        if (noteData && noteData.tied === true && !noteData.isRest && !nextNoteData?.isRest && pitchesMatch(noteData, nextNoteData)) {
          // VexFlow has separate arrays: trebleNotes for voice 0, trebleNotes2 for voice 1
          const vexNotesForVoice = voiceIndex === 0 ? trebleNotes : (renderedMeasure.trebleNotes2 || []);

          // Find the VexFlow notes at positions j and j+1 within this voice
          if (vexNotesForVoice.length > j + 1) {
            const currNote = vexNotesForVoice[j];
            const nextNote = vexNotesForVoice[j + 1];

            try {
              const startBox = currNote.getBoundingBox();
              const endBox = nextNote.getBoundingBox();

              if (startBox && endBox) {
                const direction = getTrebleTieDirection(currNote);

                const startX = startBox.getX() + startBox.getW();
                const endX = endBox.getX();

                let startY, endY;
                if (direction === 'above') {
                  startY = startBox.getY() - 5;
                  endY = endBox.getY() - 5;
                } else {
                  startY = startBox.getY() + startBox.getH() + 5;
                  endY = endBox.getY() + endBox.getH() + 5;
                }

                drawTieCurve(ctx, startX, startY, endX, endY, direction);
              }
            } catch (e) {
              // Could not get bounding box for intra-measure treble tie - skip
            }
          }
        }
      }
    }
  }

  // =====================================================================
  // TREBLE TIES - Cross-page partial ties
  // These handle ties that continue to/from another page
  // =====================================================================

  // Check FIRST measure of page for "tie from nowhere" (note has isTied=true)
  if (renderedMeasures.length > 0) {
    const firstMeasure = renderedMeasures[0];
    const firstTrebleNotes = firstMeasure.trebleNotes;

    if (firstTrebleNotes && firstTrebleNotes.length > 0) {
      const firstMeasureData = measures[firstMeasure.index];
      let firstTrebleNoteData = firstMeasureData?.notation?.treble?.voices?.[0]?.notes;
      if (!firstTrebleNoteData || firstTrebleNoteData.length === 0) {
        firstTrebleNoteData = firstMeasureData?.trebleNotes;
      }

      const firstNoteData = firstTrebleNoteData?.[0];

      // If first note has isTied=true, it's a continuation from previous page
      if (firstNoteData && firstNoteData.isTied === true && !firstNoteData.isRest) {
        const firstNote = firstTrebleNotes[0];
        try {
          const box = firstNote.getBoundingBox();
          if (box) {
            const direction = getTrebleTieDirection(firstNote);
            const endX = box.getX();
            const startX = endX - 30;

            let endY;
            if (direction === 'above') {
              endY = box.getY() - 5;
            } else {
              endY = box.getY() + box.getH() + 5;
            }

            drawPartialTieCurve(ctx, startX, endY, endX, endY, direction, 'start');
          }
        } catch (e) {
          // Could not get bounding box - skip
        }
      }
    }
  }

  // Check LAST measure of page for "tie to nowhere" (note has tied=true)
  if (renderedMeasures.length > 0) {
    const lastMeasure = renderedMeasures[renderedMeasures.length - 1];
    const lastTrebleNotes = lastMeasure.trebleNotes;

    if (lastTrebleNotes && lastTrebleNotes.length > 0) {
      const lastMeasureData = measures[lastMeasure.index];
      let lastTrebleNoteData = lastMeasureData?.notation?.treble?.voices?.[0]?.notes;
      if (!lastTrebleNoteData || lastTrebleNoteData.length === 0) {
        lastTrebleNoteData = lastMeasureData?.trebleNotes;
      }

      const lastNoteData = lastTrebleNoteData?.[lastTrebleNoteData.length - 1];

      // If last note has tied=true, it continues to the next page
      if (lastNoteData && lastNoteData.tied === true && !lastNoteData.isRest) {
        const lastNote = lastTrebleNotes[lastTrebleNotes.length - 1];
        try {
          const box = lastNote.getBoundingBox();
          if (box) {
            const direction = getTrebleTieDirection(lastNote);
            const startX = box.getX() + box.getW();
            const endX = startX + 30;

            let startY;
            if (direction === 'above') {
              startY = box.getY() - 5;
            } else {
              startY = box.getY() + box.getH() + 5;
            }

            drawPartialTieCurve(ctx, startX, startY, endX, startY, direction, 'end');
          }
        } catch (e) {
          // Could not get bounding box - skip
        }
      }
    }
  }
}

/**
 * Draw a tie curve using quadratic Bezier
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} startX - Start X position
 * @param {number} startY - Start Y position
 * @param {number} endX - End X position
 * @param {number} endY - End Y position
 * @param {string} direction - 'above' or 'below' the notes
 */
function drawTieCurve(ctx, startX, startY, endX, endY, direction = 'below') {
  // Control point offset determines the curve's height
  const controlPointOffset = direction === 'below' ? 12 : -12;

  // Control point is at the midpoint horizontally, offset vertically
  const controlX = (startX + endX) / 2;

  // For 'below', curve dips down (positive Y offset from max Y)
  // For 'above', curve rises up (negative Y offset from min Y)
  let controlY;
  if (direction === 'below') {
    controlY = Math.max(startY, endY) + controlPointOffset;
  } else {
    controlY = Math.min(startY, endY) + controlPointOffset;
  }

  // Draw the tie as a filled shape for better appearance
  ctx.save();
  ctx.fillStyle = '#000000';

  // Outer curve
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(controlX, controlY, endX, endY);

  // Inner curve (creates thickness)
  const innerOffset = direction === 'below' ? -4 : 4;
  ctx.quadraticCurveTo(controlX, controlY + innerOffset, startX, startY);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a partial tie curve for cross-row ties
 * These are "tie to nowhere" (going off right edge) or "tie from nowhere" (coming from left edge)
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} startX - Start X position
 * @param {number} startY - Start Y position
 * @param {number} endX - End X position
 * @param {number} endY - End Y position
 * @param {string} direction - 'above' or 'below' the notes
 * @param {string} openEnd - 'start' (tie from nowhere) or 'end' (tie to nowhere)
 */
function drawPartialTieCurve(ctx, startX, startY, endX, endY, direction = 'below', openEnd = 'end') {
  // Control point offset determines the curve's height (smaller for partial ties)
  const controlPointOffset = direction === 'below' ? 8 : -8;

  // Control point is at the midpoint horizontally, offset vertically
  const controlX = (startX + endX) / 2;

  let controlY;
  if (direction === 'below') {
    controlY = Math.max(startY, endY) + controlPointOffset;
  } else {
    controlY = Math.min(startY, endY) + controlPointOffset;
  }

  ctx.save();
  ctx.fillStyle = '#000000';

  // Draw the tie as a filled shape
  ctx.beginPath();

  if (openEnd === 'end') {
    // Tie to nowhere: starts thick at note, tapers to thin at right edge
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    // Inner curve - taper to almost nothing at the end
    const innerOffset = direction === 'below' ? -3 : 3;
    const taperOffset = direction === 'below' ? -1 : 1;
    ctx.quadraticCurveTo(controlX, controlY + innerOffset, startX, startY + taperOffset);
  } else {
    // Tie from nowhere: starts thin at left edge, thickens to note
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    // Inner curve - starts thin, ends thick
    const innerOffset = direction === 'below' ? -3 : 3;
    const taperOffset = direction === 'below' ? -1 : 1;
    ctx.quadraticCurveTo(controlX, controlY + innerOffset, startX, startY + taperOffset);
  }

  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ============================================================================
// ============================================================================
// HAIRPIN RENDERING
// ============================================================================

/**
 * Draw hairpins (crescendo/decrescendo) for a system
 * @param {Object} context - VexFlow context
 * @param {Array} renderedMeasures - Array of rendered measure objects containing VexFlow notes
 * @param {Array} hairpins - Array of hairpin objects from compositionState
 * @param {Array} measures - Original measure data (for beat positions)
 */
function drawHairpins(context, renderedMeasures, hairpins, measures) {
  if (!renderedMeasures || renderedMeasures.length === 0 || !hairpins || hairpins.length === 0) {
    return;
  }

  // Get raw canvas context (same as drawManualTies)
  let ctx = null;
  if (context.vexFlowCanvasContext && typeof context.vexFlowCanvasContext.beginPath === 'function') {
    ctx = context.vexFlowCanvasContext;
  } else if (context.context && typeof context.context.beginPath === 'function') {
    ctx = context.context;
  } else if (context.canvas && context.canvas.getContext) {
    ctx = context.canvas.getContext('2d');
  } else if (typeof context.beginPath === 'function') {
    ctx = context;
  } else if (context.getCanvasContext && typeof context.getCanvasContext === 'function') {
    ctx = context.getCanvasContext();
  }
  if (!ctx) {
    try {
      if (context.backend && context.backend.ctx) {
        ctx = context.backend.ctx;
      }
    } catch (e) { /* ignore */ }
  }
  if (!ctx || typeof ctx.beginPath !== 'function') {
    return;
  }

  // Helper to check if two measures are on the same row (same Y position)
  function areMeasuresOnSameRow(measure1, measure2) {
    if (!measure1 || !measure2) return false;
    const y1 = measure1.actualBounds?.bassY || measure1.bounds?.y || 0;
    const y2 = measure2.actualBounds?.bassY || measure2.bounds?.y || 0;
    return Math.abs(y1 - y2) < 50;
  }

  // Helper to get Y position (midpoint between staves)
  function getHairpinY(measureData) {
    const trebleStave = measureData.trebleStave;
    const bassStave = measureData.bassStave;
    if (trebleStave && bassStave) {
      const trebleBottom = trebleStave.getYForLine(5);
      const bassTop = bassStave.getYForLine(0);
      return (trebleBottom + bassTop) / 2;
    }
    return null;
  }

  // Helper to draw a hairpin segment
  // openStart/openEnd indicate "continuation" points (mid-hairpin, cut off)
  // For a complete hairpin: openStart=false, openEnd=false
  // For "start to nowhere": openStart=false, openEnd=true
  // For "from nowhere to end": openStart=true, openEnd=false
  // For "continuation" (middle row): openStart=true, openEnd=true
  function drawHairpinSegment(startX, endX, staffY, type, openStart, openEnd) {
    const hairpinHeight = 8;
    const halfHeight = hairpinHeight / 2;
    // Intermediate height for "cut off" points (slightly open, showing continuation)
    const midHeight = hairpinHeight / 4;

    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();

    let startHeight, endHeight;

    if (type === 'crescendo') {
      // Crescendo: starts at a point (0) and opens up to full height
      // Complete: 0 -> halfHeight
      // Start to nowhere: 0 -> midHeight (partial opening)
      // From nowhere to end: midHeight -> halfHeight (finish opening)
      // Continuation: midHeight -> midHeight (parallel at mid-height)
      if (!openStart && !openEnd) {
        // Complete hairpin
        startHeight = 0;
        endHeight = halfHeight;
      } else if (!openStart && openEnd) {
        // Start to nowhere: starts at point, ends partially open
        startHeight = 0;
        endHeight = midHeight;
      } else if (openStart && !openEnd) {
        // From nowhere to end: starts partially open, ends fully open
        startHeight = midHeight;
        endHeight = halfHeight;
      } else {
        // Continuation: parallel lines at mid-height
        startHeight = midHeight;
        endHeight = midHeight;
      }
    } else {
      // Decrescendo: starts wide (full height) and closes to a point (0)
      // Complete: halfHeight -> 0
      // Start to nowhere: halfHeight -> midHeight (partial closing)
      // From nowhere to end: midHeight -> 0 (finish closing)
      // Continuation: midHeight -> midHeight (parallel at mid-height)
      if (!openStart && !openEnd) {
        // Complete hairpin
        startHeight = halfHeight;
        endHeight = 0;
      } else if (!openStart && openEnd) {
        // Start to nowhere: starts wide, ends partially narrowed
        startHeight = halfHeight;
        endHeight = midHeight;
      } else if (openStart && !openEnd) {
        // From nowhere to end: starts partially narrowed, ends at point
        startHeight = midHeight;
        endHeight = 0;
      } else {
        // Continuation: parallel lines at mid-height
        startHeight = midHeight;
        endHeight = midHeight;
      }
    }

    // Draw top line
    ctx.moveTo(startX, staffY - startHeight);
    ctx.lineTo(endX, staffY - endHeight);
    // Draw bottom line
    ctx.moveTo(startX, staffY + startHeight);
    ctx.lineTo(endX, staffY + endHeight);

    ctx.stroke();
    ctx.restore();
  }

  for (const hairpin of hairpins) {
    try {
      // Find the start and end rendered measures
      const startMeasureData = renderedMeasures.find(m => m.index === hairpin.startMeasure);
      const endMeasureData = renderedMeasures.find(m => m.index === hairpin.endMeasure);

      // Handle different cases for cross-row/cross-page hairpins
      const hasStart = !!startMeasureData;
      const hasEnd = !!endMeasureData;

      if (!hasStart && !hasEnd) {
        // Neither start nor end is on this page - check if hairpin passes through
        // Find any measures that fall within the hairpin range
        const middleMeasures = renderedMeasures.filter(m =>
          m.index > hairpin.startMeasure && m.index < hairpin.endMeasure
        );

        if (middleMeasures.length > 0) {
          // Draw continuation segments for each row
          let currentRowStart = null;
          let currentRowEnd = null;
          let currentY = null;

          for (const measure of middleMeasures) {
            const measureY = getHairpinY(measure);
            if (measureY === null) continue;

            if (currentY === null || !areMeasuresOnSameRow({ actualBounds: { bassY: currentY } }, measure)) {
              // New row - draw previous row's segment if exists
              if (currentRowStart !== null && currentRowEnd !== null) {
                drawHairpinSegment(currentRowStart, currentRowEnd, currentY, hairpin.type, true, true);
              }
              // Start new row
              currentRowStart = measure.actualBounds?.x || measure.bounds?.x || 0;
              currentY = measureY;
            }
            // Extend to this measure's end
            currentRowEnd = (measure.actualBounds?.x || measure.bounds?.x || 0) +
                           (measure.actualBounds?.width || measure.bounds?.width || 200);
          }
          // Draw final row
          if (currentRowStart !== null && currentRowEnd !== null) {
            drawHairpinSegment(currentRowStart, currentRowEnd, currentY, hairpin.type, true, true);
          }
        }
        continue;
      }

      // Get note data for positioning
      const clefKey = hairpin.clef === 'treble' ? 'trebleNotes' : 'bassNotes';

      if (hasStart && hasEnd && areMeasuresOnSameRow(startMeasureData, endMeasureData)) {
        // Simple case: start and end on same row - draw complete hairpin
        const startNotes = hairpin.clef === 'treble' ? startMeasureData.trebleNotes : startMeasureData.bassNotes;
        const endNotes = hairpin.clef === 'treble' ? endMeasureData.trebleNotes : endMeasureData.bassNotes;

        if (!startNotes?.length || !endNotes?.length) continue;

        const startMeasureNotesData = measures[hairpin.startMeasure];
        const endMeasureNotesData = measures[hairpin.endMeasure];
        if (!startMeasureNotesData || !endMeasureNotesData) continue;

        const startNoteData = startMeasureNotesData[clefKey] || [];
        const endNoteData = endMeasureNotesData[clefKey] || [];

        // Find start note index
        let startNoteIndex = 0;
        for (let i = 0; i < startNoteData.length; i++) {
          if (Math.abs((startNoteData[i]?.beat || 0) - hairpin.startBeat) < 0.01) {
            startNoteIndex = i;
            break;
          }
        }

        // Find end note index
        let endNoteIndex = 0;
        for (let i = 0; i < endNoteData.length; i++) {
          if (Math.abs((endNoteData[i]?.beat || 0) - hairpin.endBeat) < 0.01) {
            endNoteIndex = i;
            break;
          }
        }

        const startVexNote = startNotes[startNoteIndex];
        const endVexNote = endNotes[endNoteIndex];
        if (!startVexNote || !endVexNote) continue;

        const startX = startVexNote.getAbsoluteX();
        const endX = endVexNote.getAbsoluteX() + (endVexNote.getBoundingBox()?.getW() || 20);
        const staffY = getHairpinY(startMeasureData);
        if (staffY === null) continue;

        drawHairpinSegment(startX, endX, staffY, hairpin.type, false, false);

      } else {
        // Cross-row or cross-page: draw partial hairpins

        // Draw "start to nowhere" if start is on this page
        if (hasStart) {
          const startNotes = hairpin.clef === 'treble' ? startMeasureData.trebleNotes : startMeasureData.bassNotes;
          if (startNotes?.length) {
            const startMeasureNotesData = measures[hairpin.startMeasure];
            const startNoteData = startMeasureNotesData?.[clefKey] || [];

            let startNoteIndex = 0;
            for (let i = 0; i < startNoteData.length; i++) {
              if (Math.abs((startNoteData[i]?.beat || 0) - hairpin.startBeat) < 0.01) {
                startNoteIndex = i;
                break;
              }
            }

            const startVexNote = startNotes[startNoteIndex];
            if (startVexNote) {
              const startX = startVexNote.getAbsoluteX();
              // Extend to the right edge of the row (find last measure on same row)
              let rowEndX = startX + 100; // Default extension
              for (const measure of renderedMeasures) {
                if (areMeasuresOnSameRow(startMeasureData, measure)) {
                  const measureEnd = (measure.actualBounds?.x || measure.bounds?.x || 0) +
                                    (measure.actualBounds?.width || measure.bounds?.width || 200);
                  if (measureEnd > rowEndX) rowEndX = measureEnd;
                }
              }
              const staffY = getHairpinY(startMeasureData);
              if (staffY !== null) {
                // openStart=false (has start note), openEnd=true (goes to nowhere)
                drawHairpinSegment(startX, rowEndX - 10, staffY, hairpin.type, false, true);
              }
            }
          }
        }

        // Draw "from nowhere to end" if end is on this page
        if (hasEnd) {
          const endNotes = hairpin.clef === 'treble' ? endMeasureData.trebleNotes : endMeasureData.bassNotes;
          if (endNotes?.length) {
            const endMeasureNotesData = measures[hairpin.endMeasure];
            const endNoteData = endMeasureNotesData?.[clefKey] || [];

            let endNoteIndex = 0;
            for (let i = 0; i < endNoteData.length; i++) {
              if (Math.abs((endNoteData[i]?.beat || 0) - hairpin.endBeat) < 0.01) {
                endNoteIndex = i;
                break;
              }
            }

            const endVexNote = endNotes[endNoteIndex];
            if (endVexNote) {
              const endX = endVexNote.getAbsoluteX() + (endVexNote.getBoundingBox()?.getW() || 20);
              // Extend from the left edge of the row (find first measure on same row)
              let rowStartX = endX - 100; // Default extension
              for (const measure of renderedMeasures) {
                if (areMeasuresOnSameRow(endMeasureData, measure)) {
                  const measureStart = measure.actualBounds?.x || measure.bounds?.x || 0;
                  if (measureStart < rowStartX || rowStartX === endX - 100) rowStartX = measureStart;
                }
              }
              const staffY = getHairpinY(endMeasureData);
              if (staffY !== null) {
                // openStart=true (comes from nowhere), openEnd=false (has end note)
                drawHairpinSegment(rowStartX + 10, endX, staffY, hairpin.type, true, false);
              }
            }
          }
        }

        // Draw continuation segments for measures between start and end (on different rows)
        if (hasStart && hasEnd) {
          // Find measures between start and end that are on different rows from both
          for (const measure of renderedMeasures) {
            if (measure.index <= hairpin.startMeasure || measure.index >= hairpin.endMeasure) continue;
            if (areMeasuresOnSameRow(startMeasureData, measure)) continue;
            if (areMeasuresOnSameRow(endMeasureData, measure)) continue;

            // This measure is on a different row - draw full-width continuation
            const measureStart = measure.actualBounds?.x || measure.bounds?.x || 0;
            const measureEnd = measureStart + (measure.actualBounds?.width || measure.bounds?.width || 200);
            const staffY = getHairpinY(measure);
            if (staffY !== null) {
              drawHairpinSegment(measureStart + 10, measureEnd - 10, staffY, hairpin.type, true, true);
            }
          }
        }
      }

    } catch (e) {
      // Silently continue on error
    }
  }
}

// ============================================================================
// SLUR RENDERING
// ============================================================================

/**
 * Draw slurs (curved phrasing marks) between notes
 * Slurs connect multiple notes indicating they should be played smoothly (legato)
 * Unlike ties, slurs can connect notes of different pitches
 *
 * @param {Object} context - VexFlow rendering context
 * @param {Array} renderedMeasures - Array of rendered measure data
 * @param {Array} slurs - Array of slur objects from compositionState
 * @param {Array} measures - Array of measure note data
 */
function drawSlurs(context, renderedMeasures, slurs, measures) {
  if (!renderedMeasures || renderedMeasures.length === 0 || !slurs || slurs.length === 0) {
    return;
  }

  // Get raw canvas context (same pattern as drawHairpins)
  let ctx = null;
  if (context.vexFlowCanvasContext && typeof context.vexFlowCanvasContext.beginPath === 'function') {
    ctx = context.vexFlowCanvasContext;
  } else if (context.context && typeof context.context.beginPath === 'function') {
    ctx = context.context;
  } else if (context.canvas && context.canvas.getContext) {
    ctx = context.canvas.getContext('2d');
  } else if (typeof context.beginPath === 'function') {
    ctx = context;
  } else if (context.getCanvasContext && typeof context.getCanvasContext === 'function') {
    ctx = context.getCanvasContext();
  }
  if (!ctx) {
    try {
      if (context.backend && context.backend.ctx) {
        ctx = context.backend.ctx;
      }
    } catch (e) { /* ignore */ }
  }
  if (!ctx || typeof ctx.beginPath !== 'function') {
    return;
  }

  // Helper to check if two measures are on the same row
  function areMeasuresOnSameRow(measure1, measure2) {
    if (!measure1 || !measure2) return false;
    const y1 = measure1.actualBounds?.bassY || measure1.bounds?.y || 0;
    const y2 = measure2.actualBounds?.bassY || measure2.bounds?.y || 0;
    return Math.abs(y1 - y2) < 50;
  }

  // Helper to get note Y position based on clef and stem direction
  // Slurs curve AWAY from stems: stem up → slur below, stem down → slur above
  function getSlurDirection(vexNote, clef) {
    if (!vexNote) return clef === 'treble' ? 'above' : 'below';

    try {
      const stemDir = vexNote.getStemDirection ? vexNote.getStemDirection() : null;
      if (stemDir === 1) {
        // Stem up = slur goes BELOW (away from stem)
        return 'below';
      } else if (stemDir === -1) {
        // Stem down = slur goes ABOVE (away from stem)
        return 'above';
      }
    } catch (e) { /* ignore */ }

    // Default based on clef
    return clef === 'treble' ? 'above' : 'below';
  }

  // Helper to get note position for slur endpoint
  // Uses getYs() for accurate note head Y positions (excludes grace notes)
  function getNoteSlurPosition(vexNote, direction) {
    if (!vexNote) return { x: 0, y: 0 };

    try {
      // Get X position - use getAbsoluteX which gives the note head X
      // Add half the glyph width to center on the note head
      let x = vexNote.getAbsoluteX ? vexNote.getAbsoluteX() : 0;
      const glyphWidth = vexNote.getGlyphWidth ? vexNote.getGlyphWidth() : 12;
      x += glyphWidth / 2;

      // Get Y position from note head Ys (more reliable than bounding box)
      // getYs() returns array of Y coordinates for each note head
      const ys = vexNote.getYs ? vexNote.getYs() : null;

      if (ys && ys.length > 0) {
        // Use top or bottom note head Y based on direction
        if (direction === 'above') {
          const topY = Math.min(...ys);
          return { x, y: topY - 12 };  // Position above the highest note head
        } else {
          const bottomY = Math.max(...ys);
          return { x, y: bottomY + 12 };  // Position below the lowest note head
        }
      }

      // Fallback to bounding box if getYs not available
      const bbox = vexNote.getBoundingBox ? vexNote.getBoundingBox() : null;
      if (bbox && typeof bbox.getY === 'function') {
        const bboxY = bbox.getY();
        const bboxH = bbox.getH();
        if (direction === 'above') {
          return { x, y: bboxY - 8 };
        } else {
          return { x, y: bboxY + bboxH + 8 };
        }
      }

      // Ultimate fallback
      return { x, y: direction === 'above' ? 50 : 150 };
    } catch (e) {
      // Fallback on any error
      const x = vexNote.getAbsoluteX ? vexNote.getAbsoluteX() : 0;
      return { x, y: direction === 'above' ? 50 : 150 };
    }
  }

  // Helper to draw a complete slur curve
  function drawSlurCurve(startX, startY, endX, endY, direction) {
    // Validate positions - check for invalid coordinates
    // X should be positive (on canvas), Y can be 0 but not negative
    if (!startX || startX <= 0 || !endX || endX <= 0 ||
        startY === undefined || startY < 0 || endY === undefined || endY < 0) {
      console.warn('[drawSlurCurve] Invalid positions - skipping slur draw', { startX, startY, endX, endY });
      return;
    }

    const controlPointOffset = direction === 'below' ? 20 : -20;

    // Control point at midpoint, offset for curve
    const controlX = (startX + endX) / 2;
    const controlY = (direction === 'below' ?
      Math.max(startY, endY) : Math.min(startY, endY)) + controlPointOffset;

    console.log('[drawSlurCurve] Drawing slur curve:', { startX, startY, endX, endY, controlX, controlY, direction });

    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    // Draw slur as a stroked curve (thinner than ties)
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    ctx.stroke();

    ctx.restore();
  }

  // Helper to draw a partial slur (for cross-row slurs)
  function drawPartialSlur(startX, startY, endX, endY, direction, openEnd) {
    const controlPointOffset = direction === 'below' ? 15 : -15;

    const controlX = (startX + endX) / 2;
    const controlY = (direction === 'below' ?
      Math.max(startY, endY) : Math.min(startY, endY)) + controlPointOffset;

    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    ctx.stroke();

    ctx.restore();
  }

  // Debug: Log slurs and available measures
  console.log('[drawSlurs] Drawing slurs:', slurs.length, 'slurs, renderedMeasures:', renderedMeasures.map(m => m.index));

  for (const slur of slurs) {
    try {
      // Find the start and end rendered measures
      const startMeasureData = renderedMeasures.find(m => m.index === slur.startMeasure);
      const endMeasureData = renderedMeasures.find(m => m.index === slur.endMeasure);

      const hasStart = !!startMeasureData;
      const hasEnd = !!endMeasureData;

      console.log('[drawSlurs] Processing slur:', { slur, hasStart, hasEnd, startMeasureIndex: slur.startMeasure, endMeasureIndex: slur.endMeasure });

      if (!hasStart && !hasEnd) {
        // Neither start nor end visible - skip for now
        console.warn('[drawSlurs] Skipping slur - neither start nor end measure found');
        continue;
      }

      const clefKey = slur.clef === 'treble' ? 'trebleNotes' : 'bassNotes';
      // Use voice-specific VexFlow notes array: trebleNotes for voice 0, trebleNotes2 for voice 1
      const voiceIndex = slur.voiceIndex || 0;
      const notesKey = slur.clef === 'treble'
        ? (voiceIndex === 0 ? 'trebleNotes' : 'trebleNotes2')
        : (voiceIndex === 0 ? 'bassNotes' : 'bassNotes2');

      if (hasStart && hasEnd && areMeasuresOnSameRow(startMeasureData, endMeasureData)) {
        // Same row - draw complete slur
        const startNotes = startMeasureData[notesKey] || startMeasureData[clefKey];
        const endNotes = endMeasureData[notesKey] || endMeasureData[clefKey];
        if (!startNotes?.length || !endNotes?.length) {
          console.warn('[drawSlurs] No VexFlow notes found for slur', { slur, notesKey, startNotesLen: startNotes?.length, endNotesLen: endNotes?.length });
          continue;
        }

        // Find the note at the start beat
        const startMeasureNotesData = measures[slur.startMeasure];
        const endMeasureNotesData = measures[slur.endMeasure];
        // Filter input note data by voiceIndex to get correct indices
        const startNoteDataAll = startMeasureNotesData?.[clefKey] || [];
        const endNoteDataAll = endMeasureNotesData?.[clefKey] || [];
        const startNoteData = startNoteDataAll.filter(n => (n?.voiceIndex || 0) === voiceIndex);
        const endNoteData = endNoteDataAll.filter(n => (n?.voiceIndex || 0) === voiceIndex);

        // Find start note index by beat within the voice
        let startNoteIndex = -1;
        for (let i = 0; i < startNoteData.length; i++) {
          if (Math.abs((startNoteData[i]?.beat || 0) - slur.startBeat) < 0.01) {
            startNoteIndex = i;
            break;
          }
        }

        // Find end note index by beat within the voice
        let endNoteIndex = -1;
        for (let i = 0; i < endNoteData.length; i++) {
          if (Math.abs((endNoteData[i]?.beat || 0) - slur.endBeat) < 0.01) {
            endNoteIndex = i;
            break;
          }
        }

        // Debug: log if note indices weren't found by beat match
        if (startNoteIndex === -1 || endNoteIndex === -1) {
          console.warn('[drawSlurs] Could not find note by beat match', {
            slur,
            voiceIndex,
            startNoteIndex,
            endNoteIndex,
            startNoteDataBeats: startNoteData.map(n => n?.beat),
            endNoteDataBeats: endNoteData.map(n => n?.beat),
            vexNoteCounts: { start: startNotes.length, end: endNotes.length }
          });
          // Fall back to index 0 if not found
          if (startNoteIndex === -1) startNoteIndex = 0;
          if (endNoteIndex === -1) endNoteIndex = 0;
        }

        const startVexNote = startNotes[startNoteIndex];
        const endVexNote = endNotes[endNoteIndex];
        if (!startVexNote || !endVexNote) {
          console.warn('[drawSlurs] VexFlow note not found at index', { startNoteIndex, endNoteIndex, startNotesLen: startNotes.length, endNotesLen: endNotes.length });
          continue;
        }

        // Debug: Log VexFlow note details including getYs for accurate positioning
        const startYs = startVexNote?.getYs?.();
        const endYs = endVexNote?.getYs?.();
        console.log('[drawSlurs] Found VexFlow notes:', {
          startVexNote: startVexNote?.constructor?.name,
          endVexNote: endVexNote?.constructor?.name,
          startHasModifiers: startVexNote?.getModifiers?.()?.length,
          endHasModifiers: endVexNote?.getModifiers?.()?.length,
          startAbsoluteX: startVexNote?.getAbsoluteX?.(),
          endAbsoluteX: endVexNote?.getAbsoluteX?.(),
          startYs: startYs,
          endYs: endYs,
        });

        // Determine slur direction based on stem direction
        const direction = getSlurDirection(startVexNote, slur.clef);

        const startPos = getNoteSlurPosition(startVexNote, direction);
        const endPos = getNoteSlurPosition(endVexNote, direction);

        console.log('[drawSlurs] Slur positions:', { startPos, endPos, direction });

        drawSlurCurve(startPos.x, startPos.y, endPos.x, endPos.y, direction);

      } else {
        // Cross-row slur - draw partial segments

        if (hasStart) {
          const startNotes = startMeasureData[notesKey] || startMeasureData[clefKey];
          if (startNotes?.length) {
            const startMeasureNotesData = measures[slur.startMeasure];
            const startNoteDataAll = startMeasureNotesData?.[clefKey] || [];
            // Filter by voiceIndex for correct note mapping
            const startNoteData = startNoteDataAll.filter(n => (n?.voiceIndex || 0) === voiceIndex);

            let startNoteIndex = 0;
            for (let i = 0; i < startNoteData.length; i++) {
              if (Math.abs((startNoteData[i]?.beat || 0) - slur.startBeat) < 0.01) {
                startNoteIndex = i;
                break;
              }
            }

            const startVexNote = startNotes[startNoteIndex];
            if (startVexNote) {
              const direction = getSlurDirection(startVexNote, slur.clef);
              const startPos = getNoteSlurPosition(startVexNote, direction);

              // Find right edge of current row
              let rowEndX = startPos.x + 100;
              for (const measure of renderedMeasures) {
                if (areMeasuresOnSameRow(startMeasureData, measure)) {
                  const measureEnd = (measure.actualBounds?.x || measure.bounds?.x || 0) +
                                    (measure.actualBounds?.width || measure.bounds?.width || 200);
                  if (measureEnd > rowEndX) rowEndX = measureEnd;
                }
              }

              drawPartialSlur(startPos.x, startPos.y, rowEndX - 10, startPos.y, direction, 'end');
            }
          }
        }

        if (hasEnd) {
          const endNotes = endMeasureData[notesKey] || endMeasureData[clefKey];
          if (endNotes?.length) {
            const endMeasureNotesData = measures[slur.endMeasure];
            const endNoteDataAll = endMeasureNotesData?.[clefKey] || [];
            // Filter by voiceIndex for correct note mapping
            const endNoteData = endNoteDataAll.filter(n => (n?.voiceIndex || 0) === voiceIndex);

            let endNoteIndex = 0;
            for (let i = 0; i < endNoteData.length; i++) {
              if (Math.abs((endNoteData[i]?.beat || 0) - slur.endBeat) < 0.01) {
                endNoteIndex = i;
                break;
              }
            }

            const endVexNote = endNotes[endNoteIndex];
            if (endVexNote) {
              const direction = getSlurDirection(endVexNote, slur.clef);
              const endPos = getNoteSlurPosition(endVexNote, direction);

              // Find left edge of current row
              let rowStartX = endPos.x - 100;
              for (const measure of renderedMeasures) {
                if (areMeasuresOnSameRow(endMeasureData, measure)) {
                  const measureStart = measure.actualBounds?.x || measure.bounds?.x || 0;
                  if (measureStart < rowStartX || rowStartX === endPos.x - 100) {
                    rowStartX = measureStart;
                  }
                }
              }

              drawPartialSlur(rowStartX + 10, endPos.y, endPos.x, endPos.y, direction, 'start');
            }
          }
        }
      }

    } catch (e) {
      // Silently continue on error
    }
  }
}

// ============================================================================
// TEMPO MARKING RENDERING
// ============================================================================

/**
 * Draw tempo markings above the staff at their designated measures
 * @param {Object} context - VexFlow rendering context
 * @param {Array} renderedMeasures - Array of rendered measure data
 * @param {Array} tempoMarkings - Array of tempo marking objects
 */
function drawTempoMarkings(context, renderedMeasures, tempoMarkings) {
  if (!renderedMeasures || renderedMeasures.length === 0 || !tempoMarkings || tempoMarkings.length === 0) {
    return;
  }

  // Get raw canvas context
  let ctx = null;
  if (context.vexFlowCanvasContext && typeof context.vexFlowCanvasContext.fillText === 'function') {
    ctx = context.vexFlowCanvasContext;
  } else if (context.context && typeof context.context.fillText === 'function') {
    ctx = context.context;
  } else if (context.canvas && context.canvas.getContext) {
    ctx = context.canvas.getContext('2d');
  } else if (typeof context.fillText === 'function') {
    ctx = context;
  } else if (context.getCanvasContext && typeof context.getCanvasContext === 'function') {
    ctx = context.getCanvasContext();
  }
  if (!ctx) {
    try {
      if (context.backend && context.backend.ctx) {
        ctx = context.backend.ctx;
      }
    } catch (e) { /* ignore */ }
  }
  if (!ctx || typeof ctx.fillText !== 'function') {
    return;
  }

  for (const tempo of tempoMarkings) {
    try {
      // Find the rendered measure for this tempo marking
      const measureData = renderedMeasures.find(m => m.index === tempo.measureIndex);
      if (!measureData) continue;

      // Get position above the treble staff
      const trebleStave = measureData.trebleStave;
      if (!trebleStave) continue;

      const x = measureData.actualBounds?.x || measureData.bounds?.x || trebleStave.getX();
      const y = trebleStave.getYForLine(0) - 20; // Above the top of the staff

      ctx.save();
      ctx.font = 'bold italic 14px Times, serif';
      ctx.fillStyle = '#000000';
      ctx.fillText(tempo.symbol, x + 10, y);
      ctx.restore();

    } catch (e) {
      // Silently continue on error
    }
  }
}

// ============================================================================
// NOTE COLORING
// ============================================================================

/**
 * Apply coloring to VexFlow notes based on harmonic analysis and playback state
 * @param {Array} vexNotes - Array of VexFlow note objects
 * @param {Array} noteData - Original note data with pitch info
 * @param {Object} options - Coloring options
 */
function applyNoteColoring(vexNotes, noteData, options = {}) {
  const {
    measureIndex = 0,
    chord = null,
    keySignature = 'C',
    activeNotes = null,
    enableHarmonicColoring = false,
    isBass = false,
    isAutoGeneratedBass = false,  // Only color bass blue if auto-generated
    colorSuggestedNotes = false,  // Color voice 2 notes as suggestions (for preview)
  } = options;


  // Color constants
  const ACTIVE_COLOR = '#EF4444';         // Red for actively playing
  const BASS_COLOR = '#3B82F6';           // Blue for auto-generated bass notes
  const SUGGESTED_COLOR = '#10B981';      // Green for suggested notes (voice 2)
  const DEFAULT_COLOR = '#000000';        // Black default

  for (let i = 0; i < vexNotes.length; i++) {
    const vexNote = vexNotes[i];
    const note = noteData[i];

    // Skip rests
    if (!note || note.isRest || vexNote.isRest()) {
      continue;
    }

    // Get pitch(es) for this note
    const pitches = note.pitches || (note.pitch ? [note.pitch] : []);
    if (pitches.length === 0) continue;

    let fillStyle = DEFAULT_COLOR;
    let strokeStyle = DEFAULT_COLOR;

    // Priority 1: Check if any note in this chord is actively playing
    const isActive = activeNotes && pitches.some(pitch => {
      // Note ID format: "measureIndex-beat-pitch"
      const beat = note.beat || 0;
      const noteId = `${measureIndex}-${beat}-${pitch}`;
      const hasNote = activeNotes.has(noteId);
      return hasNote;
    });

    if (isActive) {
      fillStyle = ACTIVE_COLOR;
      strokeStyle = '#DC2626'; // Darker red for stroke
    } else if (colorSuggestedNotes && note.voiceIndex === 1) {
      // Color voice 2 notes as suggested (green) in preview mode
      fillStyle = SUGGESTED_COLOR;
      strokeStyle = '#059669'; // Darker green for stroke
    } else if (enableHarmonicColoring && chord && chord.root && !isBass) {
      // Apply harmonic tone coloring - ONLY to treble clef (melody notes)
      // Bass clef notes should remain black
      const primaryPitch = pitches[0];
      try {
        const analysis = analyzeChordTone(primaryPitch, chord, keySignature);
        if (analysis && analysis.colors) {
          fillStyle = analysis.colors.fill;
          strokeStyle = analysis.colors.stroke;
        }
      } catch (e) {
        // Fall back to default if analysis fails
      }
    }

    // Apply the style to the VexFlow note
    try {
      vexNote.setStyle({
        fillStyle: fillStyle,
        strokeStyle: strokeStyle,
      });
    } catch (e) {
      // Some note types may not support setStyle
    }
  }
}

// ============================================================================
// GRAND STAFF DIMENSIONS
// ============================================================================

/**
 * Calculate dimensions for a grand staff system
 * @param {Object} options - Calculation options
 * @returns {Object} - Dimension calculations
 */
export function calculateGrandStaffDimensions(options = {}) {
  const {
    numMeasures = 4,
    measuresPerLine = 4,
    measureWidth = GRAND_STAFF_DEFAULTS.measureWidth,
    staffSpacing = GRAND_STAFF_DEFAULTS.staffSpacing,
    systemMarginTop = GRAND_STAFF_DEFAULTS.systemMarginTop,
    systemMarginBottom = GRAND_STAFF_DEFAULTS.systemMarginBottom,
    braceWidth = GRAND_STAFF_DEFAULTS.braceWidth,
    showClef = true,
    showKeySignature = true,
    showTimeSignature = true,
    keySignature = 'C',
  } = options;

  // Calculate number of rows/systems
  const numSystems = Math.ceil(numMeasures / measuresPerLine);

  // Calculate width for notation elements on first measure of each system
  let firstMeasureExtra = 0;
  if (showClef) firstMeasureExtra += GRAND_STAFF_DEFAULTS.clefWidth;
  if (showKeySignature) {
    const numAccidentals = getKeySignatureAccidentalCount(keySignature);
    firstMeasureExtra += numAccidentals * GRAND_STAFF_DEFAULTS.keySignatureWidth;
  }
  if (showTimeSignature) firstMeasureExtra += GRAND_STAFF_DEFAULTS.timeSignatureWidth;

  // Calculate total width
  const measuresInRow = Math.min(numMeasures, measuresPerLine);
  const contentWidth = braceWidth + firstMeasureExtra + (measuresInRow * measureWidth);
  const totalWidth = contentWidth + 40; // Add padding

  // Calculate height for each system (treble + bass + spacing)
  const staffHeight = 80; // Standard 5-line staff height
  const systemHeight = (staffHeight * 2) + staffSpacing + systemMarginTop + systemMarginBottom;

  // Total height
  const totalHeight = numSystems * systemHeight;

  return {
    numSystems,
    measuresPerLine,
    measureWidth,
    staffSpacing,
    staffHeight,
    systemHeight,
    totalWidth,
    totalHeight,
    braceWidth,
    firstMeasureExtra,
    trebleY: systemMarginTop,
    bassY: systemMarginTop + staffHeight + staffSpacing,
  };
}

/**
 * Get the number of accidentals in a key signature
 * @param {string} key - Key name
 * @returns {number} - Number of accidentals
 */
function getKeySignatureAccidentalCount(key) {
  // Major keys with sharps (in order: 1, 2, 3, 4, 5, 6, 7 sharps)
  const sharpMajorKeys = ['G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
  // Major keys with flats (in order: 1, 2, 3, 4, 5, 6, 7 flats)
  const flatMajorKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
  // Minor keys with sharps (relative to major: Em=1, Bm=2, F#m=3, C#m=4, G#m=5, D#m=6, A#m=7)
  const sharpMinorKeys = ['Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'A#m'];
  // Minor keys with flats (relative to major: Dm=1, Gm=2, Cm=3, Fm=4, Bbm=5, Ebm=6, Abm=7)
  const flatMinorKeys = ['Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'];

  const normalized = getVexFlowKeySignature(key);
  const isMinor = normalized.endsWith('m');

  if (isMinor) {
    // Handle minor keys
    let sharpIndex = sharpMinorKeys.indexOf(normalized);
    if (sharpIndex !== -1) return sharpIndex + 1;

    let flatIndex = flatMinorKeys.indexOf(normalized);
    if (flatIndex !== -1) return flatIndex + 1;

    // Am (A minor) has 0 accidentals
    if (normalized === 'Am') return 0;
  } else {
    // Handle major keys
    let sharpIndex = sharpMajorKeys.indexOf(normalized);
    if (sharpIndex !== -1) return sharpIndex + 1;

    let flatIndex = flatMajorKeys.indexOf(normalized);
    if (flatIndex !== -1) return flatIndex + 1;
  }

  return 0; // C major or Am have 0 accidentals
}

// ============================================================================
// GRAND STAFF RENDERING
// ============================================================================

/**
 * Render a grand staff measure (treble + bass with brace)
 * @param {Object} context - VexFlow context
 * @param {Object} measureData - Data for both hands
 * @param {Object} options - Rendering options
 * @returns {Object} - { trebleStave, bassStave, connectors }
 */
export function renderGrandStaffMeasure(context, measureData, options = {}) {
  const VF = getVF();
  if (!VF) {
    console.error('VexFlow not loaded');
    return null;
  }

  const CONNECTOR_TYPES = getConnectorTypes();

  const {
    x = 10,
    y = 40,
    width = GRAND_STAFF_DEFAULTS.measureWidth,
    staffSpacing = GRAND_STAFF_DEFAULTS.staffSpacing,
    keySignature = 'C',
    timeSignature = '4/4',
    showClef = true,
    showKeySignature = true,
    showTimeSignature = true,
    showBrace = true,
    showBarlines = true,
    isFirstInSystem = true,
    isLastInSystem = false,
    measureNumber = null,
    // Coloring options
    measureIndex = 0,
    chord = null,           // Chord for harmonic analysis {root, type}
    activeNotes = null,     // Set of active note IDs for red highlighting
    enableHarmonicColoring = false,
    isAutoGeneratedBass = false,  // Only color bass notes blue if auto-generated
    colorSuggestedNotes = false,  // Color voice 2 notes as suggestions (green in preview)
    isBlockStart = true,    // Whether this measure is the start of a building block (for chord symbol display)
    chordStartsInfo = [],    // Array of chord start info objects (for multi-chord positioning within measure)
    firstMeasureExtra = 60,  // Extra width for clef/key/time sig in first measure of system
    // Multi-voice rest display options
    restDisplayMode = 'clean',      // 'clean' (smart omission) or 'explicit' (show all)
    // Repeat signs
    repeatSign = null,              // 'repeatStart', 'repeatEnd', 'repeatBoth', or null
    // Volta brackets (1st/2nd endings)
    voltaType = null,               // { type: 'begin'|'mid'|'end'|'begin_end', number: '1' } or null
  } = options;

  const {
    trebleNotes = [],  // Array of note data for treble clef
    bassNotes = [],    // Array of note data for bass clef
  } = measureData;

  // Calculate bass staff Y position
  const trebleY = y;
  const bassY = y + 80 + staffSpacing; // 80 = staff height

  // Create treble stave
  const trebleStave = createStave({
    x,
    y: trebleY,
    width,
    clef: 'treble',
    keySignature: isFirstInSystem ? keySignature : null,
    timeSignature: isFirstInSystem ? timeSignature : null,
    showClef: isFirstInSystem && showClef,
    showKeySignature: isFirstInSystem && showKeySignature,
    showTimeSignature: isFirstInSystem && showTimeSignature,
  });

  // Create bass stave
  const bassStave = createStave({
    x,
    y: bassY,
    width,
    clef: 'bass',
    keySignature: isFirstInSystem ? keySignature : null,
    timeSignature: isFirstInSystem ? timeSignature : null,
    showClef: isFirstInSystem && showClef,
    showKeySignature: isFirstInSystem && showKeySignature,
    showTimeSignature: isFirstInSystem && showTimeSignature,
  });

  // Set barlines (including repeat signs)
  if (showBarlines) {
    // Handle repeat signs at beginning of measure
    if (repeatSign === 'repeatStart' || repeatSign === 'repeatBoth') {
      trebleStave.setBegBarType(VF.Barline.type.REPEAT_BEGIN);
      bassStave.setBegBarType(VF.Barline.type.REPEAT_BEGIN);
    }

    // Handle repeat signs at end of measure or regular barlines
    if (repeatSign === 'repeatEnd') {
      trebleStave.setEndBarType(VF.Barline.type.REPEAT_END);
      bassStave.setEndBarType(VF.Barline.type.REPEAT_END);
    } else if (repeatSign === 'repeatBoth') {
      trebleStave.setEndBarType(VF.Barline.type.REPEAT_END);
      bassStave.setEndBarType(VF.Barline.type.REPEAT_END);
    } else if (isLastInSystem) {
      trebleStave.setEndBarType(VF.Barline.type.END);
      bassStave.setEndBarType(VF.Barline.type.END);
    } else {
      trebleStave.setEndBarType(VF.Barline.type.SINGLE);
      bassStave.setEndBarType(VF.Barline.type.SINGLE);
    }
  }

  // Add measure number
  if (measureNumber !== null && isFirstInSystem) {
    trebleStave.setMeasure(measureNumber);
  }

  // Add volta bracket (1st/2nd endings) if present
  if (voltaType && VF.Volta) {
    // VexFlow Volta types: NONE=1, BEGIN=2, MID=3, END=4, BEGIN_END=5
    const voltaTypeMap = {
      'begin': VF.Volta.type?.BEGIN ?? 2,
      'mid': VF.Volta.type?.MID ?? 3,
      'end': VF.Volta.type?.END ?? 4,
      'begin_end': VF.Volta.type?.BEGIN_END ?? 5,
    };
    const vfVoltaType = voltaTypeMap[voltaType.type] || voltaTypeMap['begin'];
    // Y position: VexFlow Volta y parameter shifts bracket vertically relative to stave's y
    // Chord symbols now at trebleY+20. Volta at 0 places it at stave top, above chord text.
    trebleStave.setVoltaType(vfVoltaType, voltaType.number + '.', 0);
  }

  // Draw staves
  trebleStave.setContext(context).draw();
  bassStave.setContext(context).draw();

  // Create connectors
  const connectors = [];

  if (showBrace && isFirstInSystem) {
    // Brace on the left
    const brace = new VF.StaveConnector(trebleStave, bassStave);
    brace.setType(CONNECTOR_TYPES.BRACE);
    brace.setContext(context).draw();
    connectors.push(brace);

    // Left line
    const leftLine = new VF.StaveConnector(trebleStave, bassStave);
    leftLine.setType(CONNECTOR_TYPES.SINGLE_LEFT);
    leftLine.setContext(context).draw();
    connectors.push(leftLine);
  }

  // Right barline connector
  if (showBarlines) {
    const rightLine = new VF.StaveConnector(trebleStave, bassStave);
    rightLine.setType(CONNECTOR_TYPES.SINGLE_RIGHT);
    rightLine.setContext(context).draw();
    connectors.push(rightLine);
  }

  // Render treble notes - MULTI-VOICE SUPPORT
  // Separate notes by voice index
  let primaryTrebleVoiceNotes = trebleNotes.filter(n => (n.voiceIndex || 0) === 0);
  let secondaryTrebleVoiceNotes = trebleNotes.filter(n => n.voiceIndex === 1);
  let hasMultipleVoicesInMeasure = secondaryTrebleVoiceNotes.length > 0;

  // Track if we swapped voices (for correct voiceIndex in regions)
  let primaryVoiceIndex = 0;
  let secondaryVoiceIndex = 1;

  // If only voice 2 has notes, treat it as the primary voice to keep rendering stable
  // BUT preserve the original voiceIndex for click region tracking
  if (primaryTrebleVoiceNotes.length === 0 && secondaryTrebleVoiceNotes.length > 0) {
    primaryTrebleVoiceNotes = secondaryTrebleVoiceNotes;
    primaryVoiceIndex = 1;  // These notes are actually from voice 1
    secondaryTrebleVoiceNotes = [];
    hasMultipleVoicesInMeasure = false;
  }

  // Stem direction: only set explicit directions when multiple voices are present in THIS measure
  // Single voice: let VexFlow use auto-stemming (based on pitch position)
  // Multiple voices: voice 0 = up (1), voice 1 = down (-1)

  // Apply smart rest visibility for multi-voice notation
  if (hasMultipleVoicesInMeasure) {
    // Fill gaps with rests so smart rest analysis has rests to analyze
    // Pass voiceIndex so auto-generated rests are properly tagged
    primaryTrebleVoiceNotes = fillGapsWithRests(primaryTrebleVoiceNotes, timeSignature, 'treble', primaryVoiceIndex);
    secondaryTrebleVoiceNotes = fillGapsWithRests(secondaryTrebleVoiceNotes, timeSignature, 'treble', secondaryVoiceIndex);

    const { primaryRestVisibility, secondaryRestVisibility } = analyzeRestVisibility(
      primaryTrebleVoiceNotes,
      secondaryTrebleVoiceNotes,
      { restDisplayMode }
    );
    applyRestVisibility(primaryTrebleVoiceNotes, primaryRestVisibility);
    applyRestVisibility(secondaryTrebleVoiceNotes, secondaryRestVisibility);
  }

  // Create notes for voice 0 (primary voice)
  // Only pass stemDirection when we have multiple voices in this measure
  const trebleResult = hasMultipleVoicesInMeasure
    ? createNotesForStaff(primaryTrebleVoiceNotes, keySignature, 'treble', timeSignature, {
        stemDirection: TREBLE_VOICE_STEM_DIRECTIONS.primary,
        voiceIndex: 0,
      })
    : createNotesForStaff(primaryTrebleVoiceNotes, keySignature, 'treble', timeSignature); // No options = auto stems
  const vexTrebleNotes = trebleResult.notes;
  const trebleOttavaBrackets = trebleResult.ottavaBrackets;
  const trebleTies = trebleResult.ties;
  const trebleTupletGroups = trebleResult.tupletGroups;

  const trebleBeams = generateBeamsWithTuplets(vexTrebleNotes, trebleTupletGroups, timeSignature);

  // Create notes for voice 1 (secondary voice) if present in THIS measure
  let vexTrebleNotes2 = [];
  let trebleBeams2 = [];
  let trebleTupletGroups2 = {};
  let trebleOttavaBrackets2 = [];
  if (hasMultipleVoicesInMeasure) {
    const trebleResult2 = createNotesForStaff(secondaryTrebleVoiceNotes, keySignature, 'treble', timeSignature, {
      stemDirection: TREBLE_VOICE_STEM_DIRECTIONS.secondary,
      voiceIndex: 1,
    });
    vexTrebleNotes2 = trebleResult2.notes;
    trebleTupletGroups2 = trebleResult2.tupletGroups;
    trebleOttavaBrackets2 = trebleResult2.ottavaBrackets || [];

    trebleBeams2 = generateBeamsWithTuplets(vexTrebleNotes2, trebleTupletGroups2, timeSignature);
  }

  // Render bass notes - MULTI-VOICE SUPPORT (same pattern as treble)
  // Separate notes by voice index
  let primaryBassVoiceNotes = bassNotes.filter(n => (n.voiceIndex || 0) === 0);
  let secondaryBassVoiceNotes = bassNotes.filter(n => n.voiceIndex === 1);
  let hasBassMultipleVoicesInMeasure = secondaryBassVoiceNotes.length > 0;

  // Track if we swapped voices (for correct voiceIndex in regions)
  let primaryBassVoiceIndex = 0;
  let secondaryBassVoiceIndex = 1;

  // If only voice 2 has notes, treat it as the primary voice to keep rendering stable
  if (primaryBassVoiceNotes.length === 0 && secondaryBassVoiceNotes.length > 0) {
    primaryBassVoiceNotes = secondaryBassVoiceNotes;
    primaryBassVoiceIndex = 1;
    secondaryBassVoiceNotes = [];
    hasBassMultipleVoicesInMeasure = false;
  }

  // Apply smart rest visibility for multi-voice bass notation
  if (hasBassMultipleVoicesInMeasure) {
    // Fill gaps with rests so smart rest analysis has rests to analyze
    // Pass voiceIndex so auto-generated rests are properly tagged
    primaryBassVoiceNotes = fillGapsWithRests(primaryBassVoiceNotes, timeSignature, 'bass', primaryBassVoiceIndex);
    secondaryBassVoiceNotes = fillGapsWithRests(secondaryBassVoiceNotes, timeSignature, 'bass', secondaryBassVoiceIndex);

    const { primaryRestVisibility, secondaryRestVisibility } = analyzeRestVisibility(
      primaryBassVoiceNotes,
      secondaryBassVoiceNotes,
      { restDisplayMode }
    );
    applyRestVisibility(primaryBassVoiceNotes, primaryRestVisibility);
    applyRestVisibility(secondaryBassVoiceNotes, secondaryRestVisibility);
  }

  // Create notes for bass voice 0 (primary voice)
  // Bass clef uses opposite stem directions: V1 stems DOWN (bass on bottom), V2 stems UP (harmony above)
  const bassResult = hasBassMultipleVoicesInMeasure
    ? createNotesForStaff(primaryBassVoiceNotes, keySignature, 'bass', timeSignature, {
        stemDirection: BASS_VOICE_STEM_DIRECTIONS.primary,
        voiceIndex: 0,
      })
    : createNotesForStaff(primaryBassVoiceNotes, keySignature, 'bass', timeSignature);
  const vexBassNotes = bassResult.notes;
  const bassOttavaBrackets = bassResult.ottavaBrackets;
  const bassTies = bassResult.ties;
  const bassTupletGroups = bassResult.tupletGroups;
  const bassBeams = generateBeamsWithTuplets(vexBassNotes, bassTupletGroups, timeSignature);

  // Create notes for bass voice 1 (secondary voice) if present in THIS measure
  let vexBassNotes2 = [];
  let bassBeams2 = [];
  let bassTupletGroups2 = {};
  let bassOttavaBrackets2 = [];
  if (hasBassMultipleVoicesInMeasure) {
    const bassResult2 = createNotesForStaff(secondaryBassVoiceNotes, keySignature, 'bass', timeSignature, {
      stemDirection: BASS_VOICE_STEM_DIRECTIONS.secondary,
      voiceIndex: 1,
    });
    vexBassNotes2 = bassResult2.notes;
    bassTupletGroups2 = bassResult2.tupletGroups;
    bassOttavaBrackets2 = bassResult2.ottavaBrackets || [];
    bassBeams2 = generateBeamsWithTuplets(vexBassNotes2, bassTupletGroups2, timeSignature);
  }

  // Apply note coloring
  applyNoteColoring(vexTrebleNotes, primaryTrebleVoiceNotes, {
    measureIndex,
    chord,
    keySignature,
    activeNotes,
    enableHarmonicColoring,
    colorSuggestedNotes,
    clef: 'treble',
  });

  if (hasMultipleVoicesInMeasure && vexTrebleNotes2.length > 0) {
    applyNoteColoring(vexTrebleNotes2, secondaryTrebleVoiceNotes, {
      measureIndex,
      chord,
      keySignature,
      activeNotes,
      enableHarmonicColoring,
      colorSuggestedNotes,
      clef: 'treble',
    });
  }

  applyNoteColoring(vexBassNotes, primaryBassVoiceNotes, {
    measureIndex,
    chord,
    keySignature,
    activeNotes,
    enableHarmonicColoring,
    colorSuggestedNotes,
    clef: 'bass',
    isBass: true,
    isAutoGeneratedBass,  // Only color blue if auto-generated
  });

  if (hasBassMultipleVoicesInMeasure && vexBassNotes2.length > 0) {
    applyNoteColoring(vexBassNotes2, secondaryBassVoiceNotes, {
      measureIndex,
      chord,
      keySignature,
      activeNotes,
      enableHarmonicColoring,
      colorSuggestedNotes,
      clef: 'bass',
      isBass: true,
      isAutoGeneratedBass: false,  // Voice 2 is always manually added
    });
  }

  // Create voices
  const [num, denom] = timeSignature.split('/');
  const voiceOptions = {
    numBeats: parseInt(num, 10),
    beatValue: parseInt(denom, 10),
  };

  // === Beat-aligned voice creation using GhostNotes ===
  // Build a unified beat grid and insert GhostNotes to ensure ALL voices
  // have tickables at the same beat positions for proper vertical alignment
  // This includes: Voice 1 & 2 within treble, Voice 1 & 2 within bass, and treble vs bass

  // Helper to round beats for comparison (avoid floating point issues)
  const roundBeat = (beat) => Math.round((beat ?? 0) * 10000) / 10000;

  // Helper to convert beats to VexFlow duration string
  // Handles both regular and dotted durations for proper tick alignment
  const beatsToDuration = (beats) => {
    // Handle dotted durations first (1.5x base duration)
    if (beats >= 6) return 'wd';      // 6 beats = dotted whole
    if (beats >= 4) return 'w';       // 4 beats = whole
    if (beats >= 3) return 'hd';      // 3 beats = dotted half
    if (beats >= 2) return 'h';       // 2 beats = half
    if (beats >= 1.5) return 'qd';    // 1.5 beats = dotted quarter
    if (beats >= 1) return 'q';       // 1 beat = quarter
    if (beats >= 0.75) return '8d';   // 0.75 beats = dotted eighth
    if (beats >= 0.5) return '8';     // 0.5 beats = eighth
    if (beats >= 0.375) return '16d'; // 0.375 beats = dotted sixteenth
    if (beats >= 0.25) return '16';   // 0.25 beats = sixteenth
    if (beats >= 0.125) return '32';  // 0.125 beats = thirty-second
    // For triplet subdivisions, approximate to nearest duration
    if (beats >= 0.667) return 'q';   // Triplet quarter ≈ quarter
    if (beats >= 0.333) return '8';   // Triplet eighth ≈ eighth
    return '16';
  };

  // Helper to get note duration in beats from note data or VexFlow duration string
  // CANONICAL FORMAT: accepts optional dotted parameter for notes with duration='2n' and dotted=true
  const getDurationInBeats = (durationStr, dotted = false) => {
    if (!durationStr) return 1;
    // Handle dotted: check duration string ('d' suffix, '.' suffix) OR separate dotted flag
    const baseDuration = durationStr.replace(/[dn.]/g, '');
    const isDotted = durationStr.includes('d') || durationStr.includes('.') || dotted;
    let beats = 1;
    switch (baseDuration) {
      case '1': case 'w': beats = 4; break;
      case '2': case 'h': beats = 2; break;
      case '4': case 'q': beats = 1; break;
      case '8': beats = 0.5; break;
      case '16': beats = 0.25; break;
      case '32': beats = 0.125; break;
      default:
        // Try parsing as '4n' format
        if (baseDuration.endsWith('n')) {
          const noteValue = parseInt(baseDuration.replace('n', ''), 10);
          if (!isNaN(noteValue)) {
            beats = 4 / noteValue;
          }
        }
    }
    return isDotted ? beats * 1.5 : beats;
  };

  // Build a beat map from note data and corresponding VexFlow notes
  const buildBeatMap = (notesArray, vexArray) => {
    const map = new Map();
    notesArray.forEach((note, i) => {
      const beat = roundBeat(note.beat);
      const duration = getDurationInBeats(note.duration, note.dotted);
      map.set(beat, { note, index: i, vexNote: vexArray[i], duration, endBeat: beat + duration });
    });
    return map;
  };

  // Helper to check if a beat is covered by any note in a voice (note started earlier but duration extends past)
  const isBeatCoveredByPreviousNote = (beatMap, currentBeat) => {
    for (const [startBeat, entry] of beatMap) {
      if (startBeat < currentBeat && entry.endBeat > currentBeat) {
        return true;
      }
    }
    return false;
  };

  // === FUNCTION: Align two voices within the same clef using GhostNotes ===
  // This ensures Voice 1 and Voice 2 on the same stave are properly aligned
  const alignVoicesWithGhostNotes = (notes1, vex1, notes2, vex2, totalBeats) => {
    const beatMap1 = buildBeatMap(notes1, vex1);
    const beatMap2 = buildBeatMap(notes2, vex2);

    // Collect all unique beat positions from both voices
    const allBeats = new Set([...beatMap1.keys(), ...beatMap2.keys()]);
    const sortedBeats = Array.from(allBeats).sort((a, b) => a - b);

    const aligned1 = [];
    const aligned2 = [];

    for (let i = 0; i < sortedBeats.length; i++) {
      const beat = sortedBeats[i];
      const nextBeat = i < sortedBeats.length - 1 ? sortedBeats[i + 1] : totalBeats;
      const gapBeats = nextBeat - beat;

      const entry1 = beatMap1.get(beat);
      const entry2 = beatMap2.get(beat);

      // Voice 1: add note or ghost
      if (entry1) {
        aligned1.push(entry1.vexNote);
      } else if (gapBeats > 0 && !isBeatCoveredByPreviousNote(beatMap1, beat)) {
        const ghostDuration = beatsToDuration(gapBeats);
        aligned1.push(new VF.GhostNote({ duration: ghostDuration }));
      }

      // Voice 2: add note or ghost
      if (entry2) {
        aligned2.push(entry2.vexNote);
      } else if (gapBeats > 0 && !isBeatCoveredByPreviousNote(beatMap2, beat)) {
        const ghostDuration = beatsToDuration(gapBeats);
        aligned2.push(new VF.GhostNote({ duration: ghostDuration }));
      }
    }

    return { aligned1, aligned2 };
  };

  const totalBeats = parseInt(num, 10);

  // === Step 1: Align Voice 1 and Voice 2 within TREBLE clef ===
  let alignedTrebleNotes1 = vexTrebleNotes;
  let alignedTrebleNotes2 = vexTrebleNotes2;
  if (hasMultipleVoicesInMeasure && vexTrebleNotes2.length > 0) {
    const trebleAligned = alignVoicesWithGhostNotes(
      primaryTrebleVoiceNotes, vexTrebleNotes,
      secondaryTrebleVoiceNotes, vexTrebleNotes2,
      totalBeats
    );
    alignedTrebleNotes1 = trebleAligned.aligned1;
    alignedTrebleNotes2 = trebleAligned.aligned2;
  }

  // === Step 2: Align Voice 1 and Voice 2 within BASS clef ===
  let alignedBassNotes1 = vexBassNotes;
  let alignedBassNotes2 = vexBassNotes2;
  if (hasBassMultipleVoicesInMeasure && vexBassNotes2.length > 0) {
    const bassAligned = alignVoicesWithGhostNotes(
      primaryBassVoiceNotes, vexBassNotes,
      secondaryBassVoiceNotes, vexBassNotes2,
      totalBeats
    );
    alignedBassNotes1 = bassAligned.aligned1;
    alignedBassNotes2 = bassAligned.aligned2;
  }

  // === Step 3: Align primary treble and bass voices across clefs ===
  // Build beat maps for cross-clef alignment (using the within-clef aligned notes)
  const trebleBeatMap = buildBeatMap(primaryTrebleVoiceNotes, alignedTrebleNotes1);
  const bassBeatMap = buildBeatMap(primaryBassVoiceNotes, alignedBassNotes1);

  // Collect all unique beat positions from both clefs
  const allCrossClefBeats = new Set([...trebleBeatMap.keys(), ...bassBeatMap.keys()]);
  const sortedCrossClefBeats = Array.from(allCrossClefBeats).sort((a, b) => a - b);

  // Create cross-clef aligned note arrays with GhostNotes where needed
  const alignedTrebleNotes = [];
  const alignedBassNotes = [];

  for (let i = 0; i < sortedCrossClefBeats.length; i++) {
    const beat = sortedCrossClefBeats[i];
    const nextBeat = i < sortedCrossClefBeats.length - 1 ? sortedCrossClefBeats[i + 1] : totalBeats;
    const gapBeats = nextBeat - beat;

    const trebleEntry = trebleBeatMap.get(beat);
    const bassEntry = bassBeatMap.get(beat);

    // Treble voice
    if (trebleEntry) {
      alignedTrebleNotes.push(trebleEntry.vexNote);
    } else if (gapBeats > 0 && !isBeatCoveredByPreviousNote(trebleBeatMap, beat)) {
      // Insert GhostNote for treble only if not covered by a previous note's duration
      const ghostDuration = beatsToDuration(gapBeats);
      const ghost = new VF.GhostNote({ duration: ghostDuration });
      alignedTrebleNotes.push(ghost);
    }

    // Bass voice
    if (bassEntry) {
      alignedBassNotes.push(bassEntry.vexNote);
    } else if (gapBeats > 0 && !isBeatCoveredByPreviousNote(bassBeatMap, beat)) {
      // Insert GhostNote for bass only if not covered by a previous note's duration
      const ghostDuration = beatsToDuration(gapBeats);
      const ghost = new VF.GhostNote({ duration: ghostDuration });
      alignedBassNotes.push(ghost);
    }
  }

  // Create voices with aligned notes
  const alignedTrebleVoice = createVoice(alignedTrebleNotes, voiceOptions);
  const alignedBassVoice = createVoice(alignedBassNotes, voiceOptions);

  // Create second treble voice if we have multi-voice content (already aligned)
  let alignedTrebleVoice2 = null;
  if (hasMultipleVoicesInMeasure && alignedTrebleNotes2.length > 0) {
    alignedTrebleVoice2 = createVoice(alignedTrebleNotes2, voiceOptions);
  }

  // Create second bass voice if we have multi-voice content (already aligned)
  let alignedBassVoice2 = null;
  if (hasBassMultipleVoicesInMeasure && alignedBassNotes2.length > 0) {
    alignedBassVoice2 = createVoice(alignedBassNotes2, voiceOptions);
  }

  // Format and draw voices
  if (alignedTrebleNotes.length > 0 && alignedBassNotes.length > 0) {
    const formatter = new VF.Formatter();

    // Join voices that share the same stave together
    if (alignedTrebleVoice2) {
      // Multiple treble voices - join them together
      formatter.joinVoices([alignedTrebleVoice, alignedTrebleVoice2]);
    } else {
      formatter.joinVoices([alignedTrebleVoice]);
    }

    // Join bass voices together
    if (alignedBassVoice2) {
      formatter.joinVoices([alignedBassVoice, alignedBassVoice2]);
    } else {
      formatter.joinVoices([alignedBassVoice]);
    }

    // Reserve padding at the end of the measure to prevent notes touching the bar line
    const endPadding = 15;
    // Calculate available width for notes: from note start to end of stave, minus padding
    // Note: getNoteStartX() returns ABSOLUTE position (includes stave's x offset)
    // So we need: (x + width) - getNoteStartX() - endPadding
    // This ensures first measure (wider but with clef/key/time) has same note area as other measures
    const noteEndX = x + width;
    const noteStartX = trebleStave.getNoteStartX();
    const staveWidth = noteEndX - noteStartX - endPadding;

    // Format all voices together
    const allVoices = [];
    allVoices.push(alignedTrebleVoice);
    if (alignedTrebleVoice2) allVoices.push(alignedTrebleVoice2);
    allVoices.push(alignedBassVoice);
    if (alignedBassVoice2) allVoices.push(alignedBassVoice2);
    formatter.format(allVoices, staveWidth);

    alignedTrebleVoice.draw(context, trebleStave);
    if (alignedTrebleVoice2) {
      alignedTrebleVoice2.draw(context, trebleStave);
    }
    alignedBassVoice.draw(context, bassStave);
    if (alignedBassVoice2) {
      alignedBassVoice2.draw(context, bassStave);
    }
  }

  // Draw beams
  drawBeams(context, trebleBeams);
  if (hasMultipleVoicesInMeasure) {
    drawBeams(context, trebleBeams2);
  }
  drawBeams(context, bassBeams);
  if (hasBassMultipleVoicesInMeasure) {
    drawBeams(context, bassBeams2);
  }

  // Draw tuplet brackets
  // Convert tuplet groups to VexFlow Tuplet objects and draw them
  const trebleTuplets = Object.values(trebleTupletGroups)
    .filter(group => group.notes.length >= 2)
    .map(group => createTuplet(group.notes, group.info, { location: 'top' }))
    .filter(t => t !== null);
  drawTuplets(context, trebleTuplets);

  // Draw tuplets for second treble voice
  if (hasMultipleVoicesInMeasure) {
    const trebleTuplets2 = Object.values(trebleTupletGroups2)
      .filter(group => group.notes.length >= 2)
      .map(group => createTuplet(group.notes, group.info, { location: 'bottom' }))
      .filter(t => t !== null);
    drawTuplets(context, trebleTuplets2);
  }

  const bassTuplets = Object.values(bassTupletGroups)
    .filter(group => group.notes.length >= 2)
    .map(group => createTuplet(group.notes, group.info, { location: 'bottom' }))
    .filter(t => t !== null);
  drawTuplets(context, bassTuplets);

  // Draw tuplets for second bass voice
  if (hasBassMultipleVoicesInMeasure) {
    const bassTuplets2 = Object.values(bassTupletGroups2)
      .filter(group => group.notes.length >= 2)
      .map(group => createTuplet(group.notes, group.info, { location: 'top' }))
      .filter(t => t !== null);
    drawTuplets(context, bassTuplets2);
  }

  // Draw ties (only within same measure for now)
  // TODO: Cross-measure ties are handled at the system level by drawManualTies
  // note.tied=true means "this note is tied TO the next note"
  trebleTies.forEach(tieInfo => {
    const startIdx = tieInfo.startIndex;
    const endIdx = startIdx + 1;
    // Validate: need valid indices and both notes must exist
    if (startIdx >= 0 && endIdx < vexTrebleNotes.length) {
      const firstNote = vexTrebleNotes[startIdx];
      const lastNote = vexTrebleNotes[endIdx];
      // VexFlow StaveTie requires both notes to be valid StaveNote objects
      if (firstNote && lastNote && !firstNote.isRest() && !lastNote.isRest()) {
        try {
          const staveTie = new VF.StaveTie({
            first_note: firstNote,
            last_note: lastNote,
            first_indices: [0],
            last_indices: [0]
          });
          staveTie.setContext(context).draw();
        } catch (e) {
          // Silently skip invalid ties (e.g., incompatible note types)
        }
      }
    }
  });

  bassTies.forEach(tieInfo => {
    const startIdx = tieInfo.startIndex;
    const endIdx = startIdx + 1;
    // Validate: need valid indices and both notes must exist
    if (startIdx >= 0 && endIdx < vexBassNotes.length) {
      const firstNote = vexBassNotes[startIdx];
      const lastNote = vexBassNotes[endIdx];
      // VexFlow StaveTie requires both notes to be valid StaveNote objects
      if (firstNote && lastNote && !firstNote.isRest() && !lastNote.isRest()) {
        try {
          const staveTie = new VF.StaveTie({
            first_note: firstNote,
            last_note: lastNote,
            first_indices: [0],
            last_indices: [0]
          });
          staveTie.setContext(context).draw();
        } catch (e) {
          // Silently skip invalid ties (e.g., incompatible note types)
        }
      }
    }
  });

  // Collect note regions for tooltip detection
  // Bounding boxes are available after draw()
  const noteRegions = [];

  const appendTrebleRegions = (vexArray, sourceNotes, voiceIndex) => {
    vexArray.forEach((vexNote, noteIdx) => {
      try {
        const noteData = sourceNotes[noteIdx];
        if (!noteData) return;

        let boundingBox = null;
        try {
          boundingBox = vexNote.getBoundingBox();
        } catch (bbErr) {
          // GhostNotes may throw on getBoundingBox
        }

        // For notes without bounding boxes (GhostNotes, or any note that fails getBoundingBox),
        // create a synthetic bounding box so the position remains clickable/selectable
        let syntheticBounds = null;
        if (!boundingBox) {
          try {
            const noteX = vexNote.getAbsoluteX();
            if (noteX !== undefined && noteX !== null) {
              // Create synthetic bounds: 30px wide centered on noteX, at staff middle
              syntheticBounds = {
                x: noteX - 15,
                y: trebleY + 20,  // Middle of treble staff
                width: 30,
                height: 40,
              };
            }
          } catch (posErr) {
          }
        }

        // Use actual bounds or synthetic bounds
        const bounds = boundingBox ? {
          x: boundingBox.getX() - 4,
          y: boundingBox.getY() - 4,
          width: boundingBox.getW() + 8,
          height: boundingBox.getH() + 8,
        } : syntheticBounds;

        if (bounds) {
          // Calculate original index (in compositionState, without auto-generated rests)
          // This ensures noteIndex matches the position in compositionState.voices[].notes[]
          let originalNoteIndex = 0;
          for (let i = 0; i < noteIdx; i++) {
            if (!sourceNotes[i]._autoGenerated) {
              originalNoteIndex++;
            }
          }

          // Get individual note head positions for precise selection
          let noteHeadPositions = null;
          try {
            const ys = vexNote.getYs(); // Y positions for each note head
            const noteX = vexNote.getAbsoluteX(); // X position
            if (ys && ys.length > 0) {
              noteHeadPositions = ys.map(y => ({ x: noteX, y }));
            }
          } catch (posErr) {
            // Fall back to bounding box if position methods not available
          }

          const region = {
            staff: 'treble',
            measureIndex,
            // For auto-generated rests, use -1 as noteIndex to indicate they don't exist in compositionState
            noteIndex: noteData._autoGenerated ? -1 : originalNoteIndex,
            voiceIndex,
            pitch: noteData.pitch || (noteData.pitches ? noteData.pitches[0] : null),
            pitches: noteData.pitches || (noteData.pitch ? [noteData.pitch] : []),
            beat: noteData.beat || noteIdx,
            duration: noteData.duration || '4n',
            dotted: noteData.dotted || false,
            isRest: noteData.isRest || false,
            isAutoGenerated: noteData._autoGenerated || false, // Flag for auto-generated rests
            isHiddenRest: vexNote._isGhostNote || vexNote._isHiddenRest || false, // Flag for GhostNotes
            noteHeadPositions, // Array of {x, y} for each note head
            bounds,
          };

          if (noteData._autoGenerated) {
          }

          noteRegions.push(region);
        } else {
        }
      } catch (e) {
        // Ignore bounding box errors but keep rendering going
      }
    });
  };

  appendTrebleRegions(vexTrebleNotes, primaryTrebleVoiceNotes, primaryVoiceIndex);
  if (hasMultipleVoicesInMeasure && vexTrebleNotes2.length > 0) {
    appendTrebleRegions(vexTrebleNotes2, secondaryTrebleVoiceNotes, secondaryVoiceIndex);
  }

  // Collect bass note regions - MULTI-VOICE SUPPORT (same pattern as treble)
  const appendBassRegions = (vexNotes, sourceNotes, voiceIndex) => {
    vexNotes.forEach((vexNote, noteIdx) => {
      try {
        const noteData = sourceNotes[noteIdx];
        if (!noteData) return;

        let boundingBox = null;
        try {
          boundingBox = vexNote.getBoundingBox();
        } catch (bbErr) {
          // GhostNotes may throw on getBoundingBox
        }

        // For GhostNotes (hidden rests), create a synthetic bounding box
        // so the beat position remains clickable/selectable
        let syntheticBounds = null;
        if (!boundingBox && (vexNote._isGhostNote || vexNote._isHiddenRest)) {
          try {
            const noteX = vexNote.getAbsoluteX();
            if (noteX !== undefined) {
              // Create synthetic bounds: 30px wide centered on noteX, at staff middle
              syntheticBounds = {
                x: noteX - 15,
                y: bassY + 20,  // Middle of bass staff
                width: 30,
                height: 40,
              };
            }
          } catch (posErr) {
            // Can't get position, skip this note
          }
        }

        // Use actual bounds or synthetic bounds for GhostNotes
        const bounds = boundingBox ? {
          x: boundingBox.getX() - 4,
          y: boundingBox.getY() - 4,
          width: boundingBox.getW() + 8,
          height: boundingBox.getH() + 8,
        } : syntheticBounds;

        if (bounds) {
          // Calculate original index (in compositionState, without auto-generated rests)
          // This ensures noteIndex matches the position in compositionState.voices[].notes[]
          let originalNoteIndex = 0;
          for (let i = 0; i < noteIdx; i++) {
            if (!sourceNotes[i]._autoGenerated) {
              originalNoteIndex++;
            }
          }

          // Get individual note head positions for precise selection
          let noteHeadPositions = null;
          try {
            const ys = vexNote.getYs(); // Y positions for each note head
            const noteX = vexNote.getAbsoluteX(); // X position
            if (ys && ys.length > 0) {
              noteHeadPositions = ys.map(y => ({ x: noteX, y }));
            }
          } catch (posErr) {
            // Fall back to bounding box if position methods not available
          }

          noteRegions.push({
            staff: 'bass',
            measureIndex,
            // For auto-generated rests, use -1 as noteIndex to indicate they don't exist in compositionState
            noteIndex: noteData._autoGenerated ? -1 : originalNoteIndex,
            voiceIndex,  // MULTI-VOICE: Include voice index for proper identification
            pitch: noteData.pitch || (noteData.pitches ? noteData.pitches[0] : null),
            pitches: noteData.pitches || (noteData.pitch ? [noteData.pitch] : []),
            beat: noteData.beat || noteIdx,
            duration: noteData.duration || '4n',
            dotted: noteData.dotted || false,  // Include dotted for beat calculations
            isRest: noteData.isRest || false,
            isAutoGenerated: noteData._autoGenerated || false, // Flag for auto-generated rests
            isHiddenRest: vexNote._isGhostNote || vexNote._isHiddenRest || false, // Flag for GhostNotes
            noteHeadPositions, // Array of {x, y} for each note head
            bounds,
          });
        }
      } catch (e) {
        // Ignore bounding box errors
      }
    });
  };

  appendBassRegions(vexBassNotes, primaryBassVoiceNotes, primaryBassVoiceIndex);
  if (hasBassMultipleVoicesInMeasure && vexBassNotes2.length > 0) {
    appendBassRegions(vexBassNotes2, secondaryBassVoiceNotes, secondaryBassVoiceIndex);
  }

  // Build a map of beat positions to actual VexFlow note X positions
  // This gives us precise alignment with where notes are actually rendered
  // ALWAYS build this map so we can use it for brackets and coloring too
  const measureBeatToNoteX = new Map();
  let currentBeatForMap = 0;
  primaryBassVoiceNotes.forEach((noteData, idx) => {
    const vexNote = vexBassNotes[idx];
    if (vexNote && typeof vexNote.getAbsoluteX === 'function') {
      try {
        const noteX = vexNote.getAbsoluteX();
        if (noteX !== undefined && noteX !== null) {
          measureBeatToNoteX.set(currentBeatForMap, noteX);
        }
      } catch (e) {
        // Ignore errors from notes without position
      }
    }
    // Advance beat counter by this note's duration
    const noteDuration = noteData.duration || '4n';
    const noteBeats = getDurationBeats(noteDuration);
    const isDotted = noteData.dotted || noteDuration.includes('.');
    currentBeatForMap += isDotted ? noteBeats * 1.5 : noteBeats;
  });

  // Draw chord symbols for all chords that start in this measure
  // Uses chordStartsInfo array to support multiple chords per measure (e.g., 1.25 beat chord + next chord)
  // Also captures exact rendered positions for coach badge overlays
  const renderedChordLabelPositions = [];

  if (isBlockStart && chordStartsInfo.length > 0) {
    // Position chord symbols immediately above treble staff top line
    const chordY = trebleY + 20;

    // Fallback: use linear calculation if no note positions available
    const noteStartX = trebleStave.getNoteStartX();
    const noteEndX = x + width - 15;
    const noteAreaWidth = noteEndX - noteStartX;
    const beatsPerMeasureForPosition = getBeatsPerMeasureFromTimeSignature(timeSignature);

    const VF = getVF();
    if (VF && context) {
      context.save();
      context.setFont('Times New Roman, serif', 14, 'normal');
      context.setFillStyle('#000000'); // Black (standard for chord symbols)

      // Draw each chord symbol at its beat position and capture position
      chordStartsInfo.forEach(({ beatOffset, chordSymbol, segmentIndex }) => {
        if (chordSymbol) {
          let chordX;
          let xSource = 'unknown';
          // Try to find exact note position for this beat
          if (measureBeatToNoteX.has(beatOffset)) {
            chordX = measureBeatToNoteX.get(beatOffset);
            xSource = 'exact-beat';
          } else {
            // Fallback: find closest beat position or use linear calculation
            let closestBeat = null;
            let closestDist = Infinity;
            for (const [beat, noteX] of measureBeatToNoteX) {
              const dist = Math.abs(beat - beatOffset);
              if (dist < closestDist && dist < 0.1) { // Within 0.1 beats tolerance
                closestDist = dist;
                closestBeat = beat;
              }
            }
            if (closestBeat !== null) {
              chordX = measureBeatToNoteX.get(closestBeat);
              xSource = `closest-beat(${closestBeat})`;
            } else {
              // Final fallback: linear interpolation
              const beatFraction = beatOffset / beatsPerMeasureForPosition;
              chordX = noteStartX + (noteAreaWidth * beatFraction) + 7;
              xSource = `linear(noteStartX=${noteStartX}, beatFrac=${beatFraction.toFixed(2)})`;
            }
          }
          console.log(`[grandStaff] Drawing chord "${chordSymbol}" (segment ${segmentIndex}) at x=${Math.round(chordX)}, y=${Math.round(chordY)}, beatOffset=${beatOffset}, source=${xSource}`);
          context.fillText(chordSymbol, chordX, chordY);

          // Capture the exact rendered position for coach badge overlays
          const textWidth = chordSymbol.length * 8; // Approximate width
          renderedChordLabelPositions.push({
            chordIndex: segmentIndex,
            chordSymbol,
            x: chordX,
            y: chordY,
            width: textWidth,
            height: 18
          });
        }
      });

      context.restore();
    }
  } else if (measureData.metadata && measureData.metadata.chordSymbol && isBlockStart && chordStartsInfo.length === 0) {
    // Fallback: Use measure metadata chord symbol if no chordStartsInfo provided (for backward compatibility)
    const chordSymbol = measureData.metadata.chordSymbol;
    const noteStartX = trebleStave.getNoteStartX();
    const chordX = noteStartX + 7; // Shift right 7px to align with note heads
    const chordY = trebleY + 20;

    const VF = getVF();
    if (VF && context) {
      context.save();
      context.setFont('Times New Roman, serif', 14, 'normal');
      context.setFillStyle('#000000');
      context.fillText(chordSymbol, chordX, chordY);
      context.restore();
    }
  }

  // Draw incomplete measure indicator if beats don't add up
  // Parse time signature to get expected beats per measure (normalized to quarter-note beats)
  const [timeSigNum, timeSigDenom] = timeSignature.split('/').map(Number);
  // Normalize to quarter-note beats: 4/4 = 4, 3/4 = 3, 6/8 = 3 (since 6 eighth notes = 3 quarter notes)
  const beatsPerMeasure = (timeSigNum || 4) * (4 / (timeSigDenom || 4));

  // Calculate total beats for a set of notes
  const calcTotalBeats = (notes) => {
    if (!notes || notes.length === 0) return 0;
    let total = 0;
    for (const note of notes) {
      let dur = note.duration || '4n';
      // Handle both VexFlow format (q, h, w) and Tone.js format (4n, 2n, 1n)
      let beats = getDurationBeats(dur);
      // Only apply dotted multiplier if duration doesn't already include '.'
      // (getDurationBeats already returns correct value for '4n.', '2n.', etc.)
      if ((note.dotted || dur.includes('d')) && !dur.includes('.')) {
        beats *= 1.5;
      }
      total += beats;
    }
    return total;
  };

  // For multi-voice measures, check each voice separately
  // Voice 1 and Voice 2 should each have the correct number of beats independently
  const checkVoiceCompleteness = (notes, beatsRequired) => {
    // Split notes by voiceIndex
    const voice1Notes = notes.filter(n => (n.voiceIndex || 0) === 0);
    const voice2Notes = notes.filter(n => n.voiceIndex === 1);

    // Voice 1 must be complete if it has notes
    const voice1Beats = calcTotalBeats(voice1Notes);
    const voice1Incomplete = voice1Notes.length > 0 && Math.abs(voice1Beats - beatsRequired) > 0.01;

    // Voice 2 must be complete if it has notes
    const voice2Beats = calcTotalBeats(voice2Notes);
    const voice2Incomplete = voice2Notes.length > 0 && Math.abs(voice2Beats - beatsRequired) > 0.01;

    return voice1Incomplete || voice2Incomplete;
  };

  // Check treble and bass staves (each voice checked independently)
  const trebleIncomplete = checkVoiceCompleteness(trebleNotes, beatsPerMeasure);
  const bassIncomplete = checkVoiceCompleteness(bassNotes, beatsPerMeasure);

  if (trebleIncomplete || bassIncomplete) {
    const VF = getVF();
    if (VF && context) {
      context.save();

      // Draw a subtle warning indicator - orange/amber triangle with exclamation
      const indicatorX = x + width - 15;
      const indicatorY = trebleY + 5;

      // Draw small warning triangle
      context.beginPath();
      context.moveTo(indicatorX, indicatorY);
      context.lineTo(indicatorX + 10, indicatorY);
      context.lineTo(indicatorX + 5, indicatorY - 10);
      context.closePath();
      context.setFillStyle('rgba(245, 158, 11, 0.8)'); // Amber/warning color
      context.fill();

      // Draw exclamation mark
      context.setFillStyle('#FFFFFF');
      context.setFont('Arial', 7, 'bold');
      context.fillText('!', indicatorX + 3.5, indicatorY - 2);

      context.restore();
    }
  }

  return {
    trebleStave,
    bassStave,
    connectors,
    trebleVoice: alignedTrebleVoice,
    trebleVoice2: alignedTrebleVoice2, // Second treble voice for multi-voice support
    bassVoice: alignedBassVoice,
    trebleNotes: vexTrebleNotes,
    trebleNotes2: vexTrebleNotes2, // Second treble voice notes for multi-voice support
    bassNotes: vexBassNotes,
    bassNotes2: vexBassNotes2, // Second bass voice notes for multi-voice support
    trebleOttavaBrackets,
    trebleOttavaBrackets2, // Voice 2 treble ottava brackets
    bassOttavaBrackets,
    bassOttavaBrackets2, // Voice 2 bass ottava brackets
    noteRegions,
    hasMultipleVoicesInMeasure, // Flag indicating if multi-voice is active
    beatToNoteX: measureBeatToNoteX, // Map of beat positions to actual VexFlow X positions for this measure
    renderedChordLabelPositions, // Exact positions where chord labels were drawn (for coach badge overlays)
  };
}

/**
 * Apply ottava adjustment to notes for comfortable display in clef
 * Notes too high get 8va/15ma (shift down for display), notes too low get 8vb/15mb (shift up for display)
 * Supports up to 2-octave shifts (15ma/15mb)
 * @param {Array} pitches - Array of pitch strings
 * @param {string} clef - 'treble' or 'bass'
 * @returns {Object} - { adjustedPitches, ottavaLabel, ottavaShift }
 */
function applyOttavaAdjustment(pitches, clef) {
  if (!pitches || pitches.length === 0) {
    return { adjustedPitches: pitches, ottavaLabel: null, ottavaShift: 0 };
  }

  const range = CLEF_RANGES[clef];

  // Find the most extreme note to determine shift needed
  let maxMidi = -Infinity;
  let minMidi = Infinity;

  for (const pitch of pitches) {
    const midi = noteToMidi(pitch);
    if (midi !== null) {
      maxMidi = Math.max(maxMidi, midi);
      minMidi = Math.min(minMidi, midi);
    }
  }

  // Determine shift needed based on how far out of range
  // Supports up to 3-octave shifts (22ma/22mb)
  let shiftAmount = 0;
  let ottavaLabel = null;

  if (maxMidi > range.max + 24) {
    // Need 22ma (3 octaves down for display)
    shiftAmount = -3;
    ottavaLabel = '22ma';
  } else if (maxMidi > range.max + 12) {
    // Need 15ma (2 octaves down for display)
    shiftAmount = -2;
    ottavaLabel = '15ma';
  } else if (maxMidi > range.max) {
    // Need 8va (1 octave down for display)
    shiftAmount = -1;
    ottavaLabel = '8va';
  } else if (minMidi < range.min - 24) {
    // Need 22mb (3 octaves up for display)
    shiftAmount = 3;
    ottavaLabel = '22mb';
  } else if (minMidi < range.min - 12) {
    // Need 15mb (2 octaves up for display)
    shiftAmount = 2;
    ottavaLabel = '15mb';
  } else if (minMidi < range.min) {
    // Need 8vb (1 octave up for display)
    shiftAmount = 1;
    ottavaLabel = '8vb';
  }

  // If conflicting needs (some notes high, some low), prioritize based on average
  if ((maxMidi > range.max) && (minMidi < range.min)) {
    const avgMidi = pitches.reduce((sum, p) => sum + (noteToMidi(p) || 0), 0) / pitches.length;
    const midRange = (range.min + range.max) / 2;
    if (avgMidi > midRange) {
      // Prioritize shifting down (8va/15ma/22ma)
      if (maxMidi > range.max + 24) {
        shiftAmount = -3;
        ottavaLabel = '22ma';
      } else if (maxMidi > range.max + 12) {
        shiftAmount = -2;
        ottavaLabel = '15ma';
      } else {
        shiftAmount = -1;
        ottavaLabel = '8va';
      }
    } else {
      // Prioritize shifting up (8vb/15mb/22mb)
      if (minMidi < range.min - 24) {
        shiftAmount = 3;
        ottavaLabel = '22mb';
      } else if (minMidi < range.min - 12) {
        shiftAmount = 2;
        ottavaLabel = '15mb';
      } else {
        shiftAmount = 1;
        ottavaLabel = '8vb';
      }
    }
  }

  if (shiftAmount !== 0) {
    const adjustedPitches = pitches.map(pitch => applyOctaveShift(pitch, shiftAmount));
    return { adjustedPitches, ottavaLabel, ottavaShift: shiftAmount };
  }

  return { adjustedPitches: pitches, ottavaLabel: null, ottavaShift: 0 };
}

/**
 * Create VexFlow notes for a staff from note data
 * @param {Array} notes - Array of note data
 * @param {string} keySignature - Key signature
 * @param {string} clef - Clef type
 * @param {string} timeSignature - Time signature
 * @returns {Object} - { notes: Array of VexFlow StaveNotes, ottavaBrackets: Array of bracket info }
 */
function createNotesForStaff(notes, keySignature, clef, timeSignature, options = {}) {
  const VF = getVF();
  const { stemDirection = null, voiceIndex = 0 } = options;

  if (!notes || notes.length === 0) {
    // Return a whole rest for empty measures
    return { notes: [createRest('1n', clef)], ottavaBrackets: [], ties: [], tupletGroups: {} };
  }

  const vexNotes = [];
  const ottavaBrackets = []; // Track brackets: { startIndex, endIndex, label }
  const ties = []; // Track tie starts for rendering
  const tupletGroups = {}; // Track tuplet groups: { groupId: { notes: [], info: {} } }
  let currentBracket = null;

  // Create measure-level accidental tracker to handle cases like F# followed by F natural
  // in the same measure - the natural needs to be shown explicitly
  const accidentalTracker = createMeasureAccidentalTracker();

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];

    if (note.isRest) {
      // Rests end any current bracket
      if (currentBracket) {
        currentBracket.endIndex = vexNotes.length - 1;
        if (currentBracket.endIndex >= currentBracket.startIndex) {
          ottavaBrackets.push(currentBracket);
        }
        currentBracket = null;
      }

      // Apply rest display settings (hidden or cue-sized) for multi-voice clean notation
      // When hidden is true, use GhostNote for proper spacing without visible rest
      // When isCue is true, use smaller grayed cue rest
      let restNote;
      if (note._restDisplay?.hidden) {
        // Use GhostNote for hidden rests - maintains spacing without visual clutter
        restNote = createGhostNote(note.duration || '4n');
      } else {
        // Use regular rest (possibly cue-sized)
        const restDisplayOptions = {
          isCue: note._restDisplay?.isCue || false,
          dotted: note.dotted || false,
        };
        restNote = createRest(note.duration || '4n', clef, restDisplayOptions);
      }

      if (!restNote) {
        console.warn('[createNotesForStaff] createRest/createGhostNote returned null for note:', JSON.stringify(note));
        continue;
      }
      vexNotes.push(restNote);

      // Track tuplet groups for rests too
      if (note.tuplet && note.tuplet.groupId) {
        const groupId = note.tuplet.groupId;
        if (!tupletGroups[groupId]) {
          tupletGroups[groupId] = {
            notes: [],
            info: {
              actual: note.tuplet.actual,
              normal: note.tuplet.normal,
              type: note.tuplet.type,
            },
          };
        }
        tupletGroups[groupId].notes.push(restNote);
      }
    } else if (note.pitches && Array.isArray(note.pitches)) {
      // Chord - apply ottava adjustment
      const { adjustedPitches, ottavaLabel } = applyOttavaAdjustment(note.pitches, clef);
      // Use measure-level accidental tracker for each pitch in the chord
      // This handles cases like F# followed by F natural in the same measure
      const measureAccidentals = adjustedPitches.map(pitch =>
        accidentalTracker.getAccidentalForNote(pitch, keySignature)
      );
      // Use computed measure-aware accidentals (overrides any provided accidentals for correct notation)
      const chordNote = createChordNote(adjustedPitches, note.duration || '4n', keySignature, clef, note.dotted || false, note.articulation || null, measureAccidentals, stemDirection, note.dynamic || null, note.ornament || null, note.graceNotes || null, note.lyric || null, note.pedal || null);
      if (!chordNote) {
        console.warn('[createNotesForStaff] createChordNote returned null for note:', JSON.stringify(note), 'adjustedPitches:', adjustedPitches);
        continue;
      }

      // Preserve isTied property for cross-measure tie rendering
      if (note.isTied !== undefined) {
        chordNote.isTied = note.isTied;
      }

      // Preserve beam property for custom beam grouping
      if (note.beam) {
        chordNote._beamControl = note.beam;
      }

      // Track ottava brackets
      if (ottavaLabel) {
        if (currentBracket && currentBracket.label === ottavaLabel) {
          // Continue existing bracket
          currentBracket.endIndex = vexNotes.length;
        } else {
          // End previous bracket if different label
          if (currentBracket) {
            if (currentBracket.endIndex >= currentBracket.startIndex) {
              ottavaBrackets.push(currentBracket);
            }
          }
          // Start new bracket
          currentBracket = {
            startIndex: vexNotes.length,
            endIndex: vexNotes.length,
            label: ottavaLabel,
          };
        }
      } else if (currentBracket) {
        // No ottava needed, end current bracket
        if (currentBracket.endIndex >= currentBracket.startIndex) {
          ottavaBrackets.push(currentBracket);
        }
        currentBracket = null;
      }

      vexNotes.push(chordNote);

      // Track tuplet groups
      if (note.tuplet && note.tuplet.groupId) {
        const groupId = note.tuplet.groupId;
        if (!tupletGroups[groupId]) {
          tupletGroups[groupId] = {
            notes: [],
            info: {
              actual: note.tuplet.actual,
              normal: note.tuplet.normal,
              type: note.tuplet.type,
            },
          };
        }
        tupletGroups[groupId].notes.push(chordNote);
      }
    } else if (note.pitch) {
      // Single note - apply ottava adjustment
      const { adjustedPitches, ottavaLabel } = applyOttavaAdjustment([note.pitch], clef);
      // Use measure-level accidental tracker for proper accidental display
      // This handles cases like F# followed by F natural in the same measure
      const measureAccidental = accidentalTracker.getAccidentalForNote(adjustedPitches[0], keySignature);
      const adjustedNote = { ...note, pitch: adjustedPitches[0], stemDirection, accidental: measureAccidental };
      const staveNote = createStaveNote(adjustedNote, keySignature, clef);
      if (!staveNote) {
        console.warn('[createNotesForStaff] createStaveNote returned null for note:', JSON.stringify(note));
        continue;
      }

      // Preserve isTied property for cross-measure tie rendering
      if (note.isTied !== undefined) {
        staveNote.isTied = note.isTied;
      }

      // Preserve beam property for custom beam grouping
      if (note.beam) {
        staveNote._beamControl = note.beam;
      }

      // Track ottava brackets
      if (ottavaLabel) {
        if (currentBracket && currentBracket.label === ottavaLabel) {
          // Continue existing bracket
          currentBracket.endIndex = vexNotes.length;
        } else {
          // End previous bracket if different label
          if (currentBracket) {
            if (currentBracket.endIndex >= currentBracket.startIndex) {
              ottavaBrackets.push(currentBracket);
            }
          }
          // Start new bracket
          currentBracket = {
            startIndex: vexNotes.length,
            endIndex: vexNotes.length,
            label: ottavaLabel,
          };
        }
      } else if (currentBracket) {
        // No ottava needed, end current bracket
        if (currentBracket.endIndex >= currentBracket.startIndex) {
          ottavaBrackets.push(currentBracket);
        }
        currentBracket = null;
      }

      vexNotes.push(staveNote);

      // Track tuplet groups (for single notes)
      if (note.tuplet && note.tuplet.groupId) {
        const groupId = note.tuplet.groupId;
        if (!tupletGroups[groupId]) {
          tupletGroups[groupId] = {
            notes: [],
            info: {
              actual: note.tuplet.actual,
              normal: note.tuplet.normal,
              type: note.tuplet.type,
            },
          };
        }
        tupletGroups[groupId].notes.push(staveNote);
      }
    } else {
      // MULTI-VOICE FIX: Note has neither pitches array nor pitch property - log and skip
      console.warn('[createNotesForStaff] Skipping invalid note with no pitch data:', JSON.stringify(note));
    }

    // Track ties: if this note has tied=true, mark it for tie rendering
    if (note.tied && vexNotes.length > 0) {
      ties.push({
        startIndex: vexNotes.length - 1,
        // We'll find the end note in the next measure or later in this function
      });
    }
  }

  // Close any remaining bracket
  if (currentBracket && currentBracket.endIndex >= currentBracket.startIndex) {
    ottavaBrackets.push(currentBracket);
  }

  return { notes: vexNotes, ottavaBrackets, ties, tupletGroups };
}

// ============================================================================
// FULL SYSTEM RENDERING
// ============================================================================

/**
 * Render a complete grand staff system (multiple measures)
 * @param {Object} container - Canvas or div container
 * @param {Array} measures - Array of measure data
 * @param {Object} options - Rendering options
 * @returns {Object} - Rendered system information
 */
export function renderGrandStaffSystem(container, measures, options = {}) {
  const VF = getVF();
  if (!VF || !measures) {
    console.error('[renderGrandStaffSystem] VexFlow not loaded or no measures provided');
    return null;
  }

  const {
    measuresPerLine = 4,
    measureWidth = GRAND_STAFF_DEFAULTS.measureWidth,
    staffSpacing = GRAND_STAFF_DEFAULTS.staffSpacing,
    keySignature = 'C',
    timeSignature = '4/4',
    startMeasureNumber = 1,
    showMeasureNumbers = true,
    // Highlighting options
    selectedMeasureIndex = -1,   // Blue border for selected measure
    activeMeasureIndex = -1,     // Yellow background for playing measure
    activeNotes = null,          // Set of note IDs for red highlighting
    playbackCursor = null,       // { measureIndex, beat } for vertical cursor line
    enableHarmonicColoring = false, // Enable chord tone coloring
    showChordSpans = true,       // Show chord span shading and brackets
    // Multi-voice rest display options
    restDisplayMode = 'clean',      // 'clean' (smart omission) or 'explicit' (show all)
    // Multi-page support: offset for global measure index (0-based)
    globalMeasureOffset = 0,     // First measure's global index (for page 2, this would be 8)
    // Phase 2 Bass Block Isolation: active block highlighting
    activeBassBlockIndex = -1,   // Index of the active bass block for highlighting (-1 = none)
    chordSegments = [],          // Array of chord segments for block boundary visualization
    // Coach Engine highlights (for analysis feedback)
    coachHighlightIndices = [],  // Array of chord indices to highlight with amber/yellow for coach feedback
    // Hairpins (crescendo/decrescendo)
    hairpins = [],               // Array of hairpin objects from compositionState
    // Slurs (curved lines for phrasing)
    slurs = [],                  // Array of slur objects from compositionState
    // Tempo markings
    tempoMarkings = [],          // Array of tempo marking objects from compositionState
    // Repeat signs
    repeatSigns = [],            // Array of repeat sign objects from compositionState
    // Volta brackets (1st/2nd endings)
    voltaBrackets = [],          // Array of volta bracket objects from compositionState
  } = options;

  // Calculate dimensions
  const dimensions = calculateGrandStaffDimensions({
    numMeasures: measures.length,
    measuresPerLine,
    measureWidth,
    staffSpacing,
    keySignature,
    ...options,
  });

  // Create renderer
  const { renderer, context } = createRenderer(
    container,
    dimensions.totalWidth,
    dimensions.totalHeight
  );

  if (!context) return null;

  // Get the SVG or canvas context for direct drawing
  const svgContext = context.svg || context;

  // Collection for chord bracket click regions
  const chordBracketRegions = [];

  // Collection for chord symbol positions (above staff) for coach badge overlay
  const chordSymbolRegions = [];

  // Array to hold rendered measure data including beat-to-X position maps
  // This will be populated during measure rendering and used for accurate bracket/coloring positioning
  let measureBeatMaps = [];

  // Helper function to draw measure highlights
  function drawMeasureHighlight(measureIndex, color, isBorder = false) {
    const systemIndex = Math.floor(measureIndex / measuresPerLine);
    const measureInSystem = measureIndex % measuresPerLine;
    const isFirstInSystem = measureInSystem === 0;

    const x = (dimensions.leftOffset || 0) + dimensions.braceWidth + (measureInSystem * measureWidth) +
      (isFirstInSystem ? 0 : dimensions.firstMeasureExtra);
    const y = dimensions.trebleY + (systemIndex * dimensions.systemHeight);
    const w = isFirstInSystem
      ? measureWidth + dimensions.firstMeasureExtra
      : measureWidth;
    const h = dimensions.systemHeight - GRAND_STAFF_DEFAULTS.systemMarginTop - GRAND_STAFF_DEFAULTS.systemMarginBottom;

    // Draw using VexFlow's SVG context
    if (context.svg) {
      // SVG renderer
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', w);
      rect.setAttribute('height', h);

      if (isBorder) {
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', color);
        rect.setAttribute('stroke-width', '2');
      } else {
        rect.setAttribute('fill', color);
        rect.setAttribute('stroke', 'none');
      }

      // Insert at beginning so it's behind other elements
      context.svg.insertBefore(rect, context.svg.firstChild);
    } else if (context.context2D || context.vexFlowCanvasContext) {
      // Canvas renderer
      const ctx = context.context2D || context.vexFlowCanvasContext;
      if (ctx) {
        ctx.save();
        if (isBorder) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, w, h);
        }
        ctx.restore();
      }
    }
  }

  // Helper function to get X position for a beat in a specific measure
  // Uses actual VexFlow note positions when available, falls back to linear interpolation
  function getBeatXPosition(measureIndex, beatInMeasure, measureX, measureEndX, beatsPerMeasure, isFirstInSystem) {
    // Try to get actual position from rendered measure's beat map
    const measureData = measureBeatMaps[measureIndex];
    if (measureData && measureData.beatToNoteX) {
      const beatMap = measureData.beatToNoteX;

      // Try exact match first
      if (beatMap.has(beatInMeasure)) {
        return beatMap.get(beatInMeasure);
      }

      // Try to find closest beat within 0.1 tolerance
      let closestBeat = null;
      let closestDist = Infinity;
      for (const [beat, noteX] of beatMap) {
        const dist = Math.abs(beat - beatInMeasure);
        if (dist < closestDist && dist < 0.1) {
          closestDist = dist;
          closestBeat = beat;
        }
      }
      if (closestBeat !== null) {
        return beatMap.get(closestBeat);
      }

      // If we have at least one position, use interpolation based on known positions
      if (beatMap.size > 0) {
        // Find the two closest positions to interpolate between
        let lowerBeat = -Infinity, lowerX = measureX;
        let upperBeat = Infinity, upperX = measureEndX;

        for (const [beat, noteX] of beatMap) {
          if (beat <= beatInMeasure && beat > lowerBeat) {
            lowerBeat = beat;
            lowerX = noteX;
          }
          if (beat >= beatInMeasure && beat < upperBeat) {
            upperBeat = beat;
            upperX = noteX;
          }
        }

        // Interpolate between lower and upper
        if (lowerBeat !== -Infinity && upperBeat !== Infinity && upperBeat !== lowerBeat) {
          const fraction = (beatInMeasure - lowerBeat) / (upperBeat - lowerBeat);
          return lowerX + fraction * (upperX - lowerX);
        } else if (lowerBeat !== -Infinity) {
          // We're past the last known beat, extrapolate
          const perBeatWidth = (measureEndX - lowerX) / (beatsPerMeasure - lowerBeat);
          return lowerX + (beatInMeasure - lowerBeat) * perBeatWidth;
        }
      }
    }

    // Final fallback: linear interpolation based on fraction of measure
    const noteStartOffset = isFirstInSystem ? dimensions.firstMeasureExtra : 0;
    const noteAreaStart = measureX + noteStartOffset;
    const noteAreaWidth = measureEndX - noteAreaStart;
    const fraction = beatInMeasure / beatsPerMeasure;
    return noteAreaStart + (noteAreaWidth * fraction);
  }

  // Draw partial measure highlight for chord spans that don't align with measure boundaries
  // startBeat and endBeat are absolute beat positions from the beginning of the piece
  function drawChordSpanHighlight(startBeat, endBeat, color) {
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);

    // Convert global beat positions to global measure indices
    const globalStartMeasure = Math.floor(startBeat / beatsPerMeasure);
    const globalEndMeasure = Math.floor(endBeat / beatsPerMeasure);

    // Convert to local measure indices for this page
    const localStartMeasure = globalStartMeasure - globalMeasureOffset;
    const localEndMeasure = globalEndMeasure - globalMeasureOffset;

    // Skip if this highlight is entirely outside this page's measures
    if (localEndMeasure < 0 || localStartMeasure >= measures.length) {
      return; // Chord is on a different page
    }

    // Clamp to this page's measure range
    const startMeasure = Math.max(0, localStartMeasure);
    const endMeasure = Math.min(measures.length - 1, localEndMeasure);

    // Calculate beat positions within measures
    const startBeatInMeasure = localStartMeasure < 0 ? 0 : (startBeat % beatsPerMeasure);
    const endBeatInMeasure = localEndMeasure >= measures.length ? beatsPerMeasure : (endBeat % beatsPerMeasure);

    // Draw the span across measures
    for (let m = startMeasure; m <= endMeasure; m++) {
      if (m >= measures.length) break;

      const systemIndex = Math.floor(m / measuresPerLine);
      const measureInSystem = m % measuresPerLine;
      const isFirstInSystem = measureInSystem === 0;

      const measureX = dimensions.braceWidth + (measureInSystem * measureWidth) +
        (isFirstInSystem ? 0 : dimensions.firstMeasureExtra);
      const y = dimensions.trebleY + (systemIndex * dimensions.systemHeight);
      const fullWidth = isFirstInSystem
        ? measureWidth + dimensions.firstMeasureExtra
        : measureWidth;
      const measureEndX = measureX + fullWidth;
      const h = dimensions.systemHeight - GRAND_STAFF_DEFAULTS.systemMarginTop - GRAND_STAFF_DEFAULTS.systemMarginBottom;

      // Calculate horizontal position and width within this measure using actual note positions
      let x, w;

      if (m === startMeasure && m === endMeasure) {
        // Chord starts and ends in same measure
        // If chord starts at beat 0, use measure's left edge (measureX)
        if (startBeatInMeasure === 0) {
          x = measureX;
        } else {
          x = getBeatXPosition(m, startBeatInMeasure, measureX, measureEndX, beatsPerMeasure, isFirstInSystem);
        }
        const endX = getBeatXPosition(m, endBeatInMeasure, measureX, measureEndX, beatsPerMeasure, isFirstInSystem);
        w = endX - x;
      } else if (m === startMeasure) {
        // First measure of span - from startBeat to end of measure
        // If chord starts at beat 0, use measure's left edge (measureX)
        if (startBeatInMeasure === 0) {
          x = measureX;
        } else {
          x = getBeatXPosition(m, startBeatInMeasure, measureX, measureEndX, beatsPerMeasure, isFirstInSystem);
        }
        w = measureEndX - x;
      } else if (m === endMeasure) {
        // Last measure of span - from start of measure to endBeat
        // If endBeatInMeasure is 0, it means the chord ends exactly at the start of this measure
        if (endBeatInMeasure === 0) {
          continue; // Skip drawing in this measure, the previous measure was the last
        }
        // Start at measure's left edge (measureX) - fullWidth accounts for first-in-system extra
        x = measureX;
        const endX = getBeatXPosition(m, endBeatInMeasure, measureX, measureEndX, beatsPerMeasure, isFirstInSystem);
        w = endX - x;
      } else {
        // Middle measure - full width
        x = measureX;
        w = fullWidth;
      }

      // Draw the highlight
      if (context.svg) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', w);
        rect.setAttribute('height', h);
        rect.setAttribute('fill', color);
        rect.setAttribute('stroke', 'none');
        context.svg.insertBefore(rect, context.svg.firstChild);
      } else if (context.context2D || context.vexFlowCanvasContext) {
        const ctx = context.context2D || context.vexFlowCanvasContext;
        if (ctx) {
          ctx.save();
          ctx.fillStyle = color;
          ctx.fillRect(x, y, w, h);
          ctx.restore();
        }
      }
    }
  }

  // Draw chord bracket beneath bass clef with chord name
  // Also registers click regions for bracket label interaction
  // @param {number} startBeat - Start beat position
  // @param {number} endBeat - End beat position
  // @param {string} chordName - Display name for the chord
  // @param {string} color - Bracket color
  // @param {Object} chordData - Full chord data for click handling
  // @param {number} chordIndex - Index of this chord in the progression
  function drawChordBracket(startBeat, endBeat, chordName, color, chordData = null, chordIndex = -1) {
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);

    // Convert global beat positions to global measure indices
    const globalStartMeasure = Math.floor(startBeat / beatsPerMeasure);
    const globalEndMeasure = Math.floor(endBeat / beatsPerMeasure);

    // Convert to local measure indices for this page
    const localStartMeasure = globalStartMeasure - globalMeasureOffset;
    const localEndMeasure = globalEndMeasure - globalMeasureOffset;

    // Skip if this chord bracket is entirely outside this page's measures
    if (localEndMeasure < 0 || localStartMeasure >= measures.length) {
      return; // Chord is on a different page
    }

    // Clamp to this page's measure range
    const startMeasure = Math.max(0, localStartMeasure);
    const endMeasure = Math.min(measures.length - 1, localEndMeasure);

    // Calculate beat positions within measures
    // For startBeatInMeasure: if chord starts before this page, it starts at beat 0
    const startBeatInMeasure = localStartMeasure < 0 ? 0 : (startBeat % beatsPerMeasure);
    // For endBeatInMeasure: if chord ends after this page, it ends at the end of the measure
    const endBeatInMeasure = localEndMeasure >= measures.length ? beatsPerMeasure : (endBeat % beatsPerMeasure);

    // Group consecutive measures by system
    const systemSpans = [];
    let currentSystem = -1;
    let currentSpan = null;

    for (let m = startMeasure; m <= endMeasure; m++) {
      if (m >= measures.length) break;

      const systemIndex = Math.floor(m / measuresPerLine);
      const measureInSystem = m % measuresPerLine;
      const isFirstInSystem = measureInSystem === 0;

      const measureX = dimensions.braceWidth + (measureInSystem * measureWidth) +
        (isFirstInSystem ? 0 : dimensions.firstMeasureExtra);
      const fullWidth = isFirstInSystem
        ? measureWidth + dimensions.firstMeasureExtra
        : measureWidth;
      const measureEndX = measureX + fullWidth;

      // Calculate x position and width for this measure segment using actual note positions
      let segmentX, segmentEndX;

      if (m === startMeasure && m === endMeasure) {
        // Chord starts and ends in same measure
        // If chord starts at beat 0, use measure's left edge (measureX)
        if (startBeatInMeasure === 0) {
          segmentX = measureX;
        } else {
          segmentX = getBeatXPosition(m, startBeatInMeasure, measureX, measureEndX, beatsPerMeasure, isFirstInSystem);
        }
        segmentEndX = getBeatXPosition(m, endBeatInMeasure, measureX, measureEndX, beatsPerMeasure, isFirstInSystem);
      } else if (m === startMeasure) {
        // First measure of span
        // If chord starts at beat 0, use measure's left edge (measureX)
        if (startBeatInMeasure === 0) {
          segmentX = measureX;
        } else {
          segmentX = getBeatXPosition(m, startBeatInMeasure, measureX, measureEndX, beatsPerMeasure, isFirstInSystem);
        }
        segmentEndX = measureEndX;
      } else if (m === endMeasure) {
        // Last measure of span
        // If endBeatInMeasure is 0, chord ends exactly at start of this measure
        if (endBeatInMeasure === 0) {
          continue; // Skip this measure, the chord ended in the previous measure
        }
        // Start at measure's left edge (measureX) - fullWidth accounts for first-in-system extra
        segmentX = measureX;
        segmentEndX = getBeatXPosition(m, endBeatInMeasure, measureX, measureEndX, beatsPerMeasure, isFirstInSystem);
      } else {
        // Middle measure - full width
        segmentX = measureX;
        segmentEndX = measureEndX;
      }

      const segmentW = segmentEndX - segmentX;

      // Start new span if we're on a new system
      if (systemIndex !== currentSystem) {
        if (currentSpan) {
          systemSpans.push(currentSpan);
        }
        currentSystem = systemIndex;
        currentSpan = {
          systemIndex,
          startX: segmentX,
          endX: segmentEndX,
          width: segmentW
        };
      } else {
        // Extend current span
        currentSpan.endX = segmentEndX;
        currentSpan.width = currentSpan.endX - currentSpan.startX;
      }
    }

    // Add final span
    if (currentSpan) {
      systemSpans.push(currentSpan);
    }

    // Draw bracket for each system span
    systemSpans.forEach((span, index) => {
      const bassY = dimensions.trebleY + (span.systemIndex * dimensions.systemHeight) +
                    80 + staffSpacing; // Position of bass staff
      const bracketY = bassY + 120; // Well below the bass staff to accommodate low notes
      const bracketHeight = 15;

      const ctx = context.context2D || context.vexFlowCanvasContext;

      // Check if this is the active bass block - use highlighted styling
      const isActiveBlock = chordIndex >= 0 && chordIndex === activeBassBlockIndex;
      const bracketColor = isActiveBlock ? '#6366f1' : color;  // Indigo when active
      const strokeWidth = isActiveBlock ? '3' : '2';

      if (context.svg) {
        // SVG rendering
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'chord-bracket-group' + (isActiveBlock ? ' active-block' : ''));

        // Horizontal line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', span.startX);
        line.setAttribute('y1', bracketY);
        line.setAttribute('x2', span.endX);
        line.setAttribute('y2', bracketY);
        line.setAttribute('stroke', bracketColor);
        line.setAttribute('stroke-width', strokeWidth);
        group.appendChild(line);

        // Left vertical tick
        const leftTick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        leftTick.setAttribute('x1', span.startX);
        leftTick.setAttribute('y1', bracketY - bracketHeight / 2);
        leftTick.setAttribute('x2', span.startX);
        leftTick.setAttribute('y2', bracketY + bracketHeight / 2);
        leftTick.setAttribute('stroke', bracketColor);
        leftTick.setAttribute('stroke-width', strokeWidth);
        group.appendChild(leftTick);

        // Right vertical tick
        const rightTick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        rightTick.setAttribute('x1', span.endX);
        rightTick.setAttribute('y1', bracketY - bracketHeight / 2);
        rightTick.setAttribute('x2', span.endX);
        rightTick.setAttribute('y2', bracketY + bracketHeight / 2);
        rightTick.setAttribute('stroke', bracketColor);
        rightTick.setAttribute('stroke-width', strokeWidth);
        group.appendChild(rightTick);

        // Chord name text (only on the first span or if it's the only span)
        if (index === 0) {
          const textX = span.startX + (span.width / 2);
          const textY = bracketY + 25;
          const estimatedTextWidth = chordName.length * 8;
          const hasRoman = !!chordData?.roman;
          // Expand pill width to accommodate Roman numeral if present
          const romanWidth = hasRoman ? chordData.roman.length * 7 : 0;
          const pillWidth = Math.max(estimatedTextWidth, romanWidth) + 16;

          // Add background pill when active
          if (isActiveBlock) {
            const bgPill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bgPill.setAttribute('x', textX - pillWidth / 2);
            bgPill.setAttribute('y', textY - 13);
            bgPill.setAttribute('width', pillWidth);
            bgPill.setAttribute('height', hasRoman ? 34 : 20);  // Taller if Roman numeral present
            bgPill.setAttribute('rx', '10');
            bgPill.setAttribute('ry', '10');
            bgPill.setAttribute('fill', '#6366f1');
            bgPill.setAttribute('class', 'active-block-label-bg');
            group.appendChild(bgPill);
          }

          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', textX);
          text.setAttribute('y', textY);
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('font-family', 'Arial, sans-serif');
          text.setAttribute('font-size', '13');
          text.setAttribute('font-weight', 'bold');
          text.setAttribute('fill', isActiveBlock ? '#ffffff' : '#333');
          text.textContent = chordName;
          group.appendChild(text);

          // Draw Roman numeral below chord name if available
          const romanNumeral = chordData?.roman;
          if (romanNumeral) {
            const romanText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            romanText.setAttribute('x', textX);
            romanText.setAttribute('y', textY + 14);  // 14px below chord name
            romanText.setAttribute('text-anchor', 'middle');
            romanText.setAttribute('font-family', 'Arial, sans-serif');
            romanText.setAttribute('font-size', '11');
            romanText.setAttribute('font-weight', 'normal');
            romanText.setAttribute('fill', isActiveBlock ? 'rgba(255,255,255,0.85)' : '#666');
            romanText.textContent = romanNumeral;
            group.appendChild(romanText);
          }

          // Register click region for the chord bracket label
          if (chordData && chordIndex >= 0) {
            // Estimate text width based on character count (approximate)
            const estimatedTextWidth = chordName.length * 8;
            // Expand height to include Roman numeral
            const regionHeight = romanNumeral ? 40 : 25;
            chordBracketRegions.push({
              type: 'chordBracket',
              x: textX - estimatedTextWidth / 2 - 5,
              y: textY - 15,
              width: estimatedTextWidth + 10,
              height: regionHeight,
              chordIndex,
              chordData,
              chordName,
              startBeat,
              endBeat,
              durationBeats: endBeat - startBeat,
              systemIndex: span.systemIndex,
            });
          }
        }

        context.svg.appendChild(group);
      } else if (ctx) {
        // Canvas rendering
        ctx.save();
        ctx.strokeStyle = bracketColor;
        ctx.lineWidth = isActiveBlock ? 3 : 2;

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(span.startX, bracketY);
        ctx.lineTo(span.endX, bracketY);
        ctx.stroke();

        // Left vertical tick
        ctx.beginPath();
        ctx.moveTo(span.startX, bracketY - bracketHeight / 2);
        ctx.lineTo(span.startX, bracketY + bracketHeight / 2);
        ctx.stroke();

        // Right vertical tick
        ctx.beginPath();
        ctx.moveTo(span.endX, bracketY - bracketHeight / 2);
        ctx.lineTo(span.endX, bracketY + bracketHeight / 2);
        ctx.stroke();

        // Chord name text (only on the first span or if it's the only span)
        if (index === 0) {
          const textX = span.startX + (span.width / 2);
          const textY = bracketY + 5;
          const estimatedTextWidth = chordName.length * 8;
          const hasRoman = !!chordData?.roman;
          // Expand pill width to accommodate Roman numeral if present
          const romanWidth = hasRoman ? chordData.roman.length * 7 : 0;
          const pillWidthCalc = Math.max(estimatedTextWidth, romanWidth) + 16;

          // Draw background pill when active
          if (isActiveBlock) {
            ctx.fillStyle = '#6366f1';
            ctx.beginPath();
            const pillX = textX - pillWidthCalc / 2;
            const pillY = textY - 3;
            const pillWidth = pillWidthCalc;
            const pillHeight = hasRoman ? 34 : 20;  // Taller if Roman numeral present
            const radius = 10;
            // Rounded rectangle
            ctx.moveTo(pillX + radius, pillY);
            ctx.lineTo(pillX + pillWidth - radius, pillY);
            ctx.quadraticCurveTo(pillX + pillWidth, pillY, pillX + pillWidth, pillY + radius);
            ctx.lineTo(pillX + pillWidth, pillY + pillHeight - radius);
            ctx.quadraticCurveTo(pillX + pillWidth, pillY + pillHeight, pillX + pillWidth - radius, pillY + pillHeight);
            ctx.lineTo(pillX + radius, pillY + pillHeight);
            ctx.quadraticCurveTo(pillX, pillY + pillHeight, pillX, pillY + pillHeight - radius);
            ctx.lineTo(pillX, pillY + radius);
            ctx.quadraticCurveTo(pillX, pillY, pillX + radius, pillY);
            ctx.closePath();
            ctx.fill();
          }

          ctx.font = 'bold 13px Arial, sans-serif';
          ctx.fillStyle = isActiveBlock ? '#ffffff' : '#333';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(chordName, textX, textY);

          // Draw Roman numeral below chord name if available
          const romanNumeral = chordData?.roman;
          if (romanNumeral) {
            ctx.font = '11px Arial, sans-serif';
            ctx.fillStyle = isActiveBlock ? 'rgba(255,255,255,0.85)' : '#666';
            ctx.fillText(romanNumeral, textX, textY + 15);  // 15px below chord name
          }

          // Register click region for the chord bracket label
          if (chordData && chordIndex >= 0) {
            // Estimate text width based on character count (approximate)
            const estimatedTextWidth = chordName.length * 8;
            // Expand height to include Roman numeral
            const regionHeight = romanNumeral ? 40 : 25;
            chordBracketRegions.push({
              type: 'chordBracket',
              x: textX - estimatedTextWidth / 2 - 5,
              y: textY - 5,
              width: estimatedTextWidth + 10,
              height: regionHeight,
              chordIndex,
              chordData,
              chordName,
              startBeat,
              endBeat,
              durationBeats: endBeat - startBeat,
              systemIndex: span.systemIndex,
            });
          }
        }

        ctx.restore();
      }
    });
  }

  // ========================================================================
  // TITLE AND COMPOSER RENDERING (First page only)
  // ========================================================================
  // Render title on left, composer on right, same line at top of first page
  if (globalMeasureOffset === 0) {
    const compState = window.getCompositionState?.();
    const title = compState?.metadata?.title;
    const composer = compState?.metadata?.composer;

    if (title || composer) {
      // Get raw canvas context for text rendering
      let ctx = null;
      if (context.context2D) {
        ctx = context.context2D;
      } else if (context.vexFlowCanvasContext) {
        ctx = context.vexFlowCanvasContext;
      } else if (context.canvas && context.canvas.getContext) {
        ctx = context.canvas.getContext('2d');
      }

      const centerX = dimensions.totalWidth / 2;
      const rightMargin = dimensions.totalWidth - 30;
      const textY = 25; // Vertical position from top

      if (ctx) {
        ctx.save();

        // Title centered
        if (title) {
          ctx.font = 'bold 20px Georgia, Times New Roman, serif';
          ctx.fillStyle = '#1a1a1a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(title, centerX, textY);
        }

        // Composer on the right
        if (composer) {
          ctx.font = 'italic 14px Georgia, Times New Roman, serif';
          ctx.fillStyle = '#555555';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(composer, rightMargin, textY);
        }

        ctx.restore();
      } else if (context.svg) {
        // SVG renderer - title centered
        if (title) {
          const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          titleText.setAttribute('x', centerX);
          titleText.setAttribute('y', textY);
          titleText.setAttribute('text-anchor', 'middle');
          titleText.setAttribute('font-family', 'Georgia, Times New Roman, serif');
          titleText.setAttribute('font-size', '20px');
          titleText.setAttribute('font-weight', 'bold');
          titleText.setAttribute('fill', '#1a1a1a');
          titleText.textContent = title;
          context.svg.appendChild(titleText);
        }

        // SVG renderer - composer on right
        if (composer) {
          const composerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          composerText.setAttribute('x', rightMargin);
          composerText.setAttribute('y', textY);
          composerText.setAttribute('text-anchor', 'end');
          composerText.setAttribute('font-family', 'Georgia, Times New Roman, serif');
          composerText.setAttribute('font-size', '14px');
          composerText.setAttribute('font-style', 'italic');
          composerText.setAttribute('fill', '#555555');
          composerText.textContent = composer;
          context.svg.appendChild(composerText);
        }
      }
    }
  }

  // Draw measure highlights before rendering measures
  // Active measure (yellow background for playback) - draw first so it's behind
  if (activeMeasureIndex >= 0 && activeMeasureIndex < measures.length) {
    drawMeasureHighlight(activeMeasureIndex, 'rgba(255, 200, 0, 0.25)', false);
  }

  // Selected measure (blue border) - always show, even during playback
  // This helps users see which measure is selected independently of playback state
  if (selectedMeasureIndex >= 0 && selectedMeasureIndex < measures.length) {
    drawMeasureHighlight(selectedMeasureIndex, 'rgba(59, 130, 246, 0.8)', true);
  }

  // Draw playback cursor (vertical line showing current playback position)
  // DISABLED: Feature disabled due to render conflicts
  if (playbackCursor && playbackCursor.measureIndex >= 0 && playbackCursor.measureIndex < measures.length) {
    const cursorMeasureIndex = playbackCursor.measureIndex;
    const cursorBeat = playbackCursor.beat || 0;
    const systemIndex = Math.floor(cursorMeasureIndex / measuresPerLine);
    const measureInSystem = cursorMeasureIndex % measuresPerLine;
    const isFirstInSystem = measureInSystem === 0;

    // Parse time signature for beats per measure
    const [beatsNum] = timeSignature.split('/').map(Number);
    const beatsPerMeasure = beatsNum || 4;

    // Calculate x position within the measure
    const measureX = dimensions.braceWidth + (measureInSystem * measureWidth) +
      (isFirstInSystem ? dimensions.firstMeasureExtra : 0);
    const measureContentWidth = isFirstInSystem
      ? measureWidth
      : measureWidth;

    // Calculate cursor position based on beat (as fraction of measure)
    const beatFraction = cursorBeat / beatsPerMeasure;
    const cursorX = measureX + (beatFraction * measureContentWidth);

    // Calculate y positions for the full system height
    const y = dimensions.trebleY + (systemIndex * dimensions.systemHeight);
    const h = dimensions.systemHeight - GRAND_STAFF_DEFAULTS.systemMarginTop - GRAND_STAFF_DEFAULTS.systemMarginBottom;

    // Draw the cursor line
    if (context.svg) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', cursorX);
      line.setAttribute('y1', y);
      line.setAttribute('x2', cursorX);
      line.setAttribute('y2', y + h);
      line.setAttribute('stroke', '#E53935');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-linecap', 'round');
      line.classList.add('playback-cursor');
      context.svg.appendChild(line);
    }
  }

  // ========================================================================
  // Phase 2 Bass Block Isolation: Draw active bass block highlight
  // ========================================================================
  // When a bass note is selected, highlight the corresponding chord block region
  // to show the user which block they're editing
  function drawActiveBassBlockHighlight() {
    if (activeBassBlockIndex < 0 || !chordSegments || chordSegments.length === 0) {
      return;
    }

    // Find the segment for the active block
    const segment = chordSegments.find(s => s.chordIndex === activeBassBlockIndex);
    if (!segment) {
      return;
    }

    const startBeat = segment.startBeat;
    const endBeat = startBeat + segment.durationBeats;
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);

    // Convert global beat positions to global measure indices
    const globalStartMeasure = Math.floor(startBeat / beatsPerMeasure);
    const globalEndMeasure = Math.floor(endBeat / beatsPerMeasure);

    // Convert to local measure indices for this page
    const localStartMeasure = globalStartMeasure - globalMeasureOffset;
    const localEndMeasure = globalEndMeasure - globalMeasureOffset;

    // Skip if this block is entirely outside this page's measures
    if (localEndMeasure < 0 || localStartMeasure >= measures.length) {
      return;
    }

    // Clamp to this page's measure range
    const startMeasure = Math.max(0, localStartMeasure);
    const endMeasure = Math.min(measures.length - 1, localEndMeasure);

    // Calculate beat positions within measures
    const startBeatInMeasure = localStartMeasure < 0 ? 0 : (startBeat % beatsPerMeasure);
    const endBeatInMeasure = localEndMeasure >= measures.length ? beatsPerMeasure : (endBeat % beatsPerMeasure);

    // Color for active block highlight (cyan/blue with transparency)
    const highlightColor = 'rgba(59, 130, 246, 0.15)'; // Light blue
    const borderColor = 'rgba(59, 130, 246, 0.6)';    // Stronger blue for border

    // Draw the highlight across measures (BASS STAFF ONLY)
    for (let m = startMeasure; m <= endMeasure; m++) {
      if (m >= measures.length) break;

      const systemIndex = Math.floor(m / measuresPerLine);
      const measureInSystem = m % measuresPerLine;
      const isFirstInSystem = measureInSystem === 0;

      const measureX = dimensions.braceWidth + (measureInSystem * measureWidth) +
        (isFirstInSystem ? 0 : dimensions.firstMeasureExtra);
      const fullWidth = isFirstInSystem
        ? measureWidth + dimensions.firstMeasureExtra
        : measureWidth;

      // Calculate Y position for BASS STAFF ONLY (not treble)
      const bassY = dimensions.trebleY + (systemIndex * dimensions.systemHeight) + 80 + staffSpacing;
      const bassHeight = 80; // Height of bass staff region

      // Calculate horizontal position and width within this measure
      let x, w;

      if (m === startMeasure && m === endMeasure) {
        const startFraction = startBeatInMeasure / beatsPerMeasure;
        const endFraction = endBeatInMeasure / beatsPerMeasure;
        x = measureX + (fullWidth * startFraction);
        w = fullWidth * (endFraction - startFraction);
      } else if (m === startMeasure) {
        const startFraction = startBeatInMeasure / beatsPerMeasure;
        x = measureX + (fullWidth * startFraction);
        w = fullWidth * (1 - startFraction);
      } else if (m === endMeasure) {
        const endFraction = endBeatInMeasure === 0 ? 0 : endBeatInMeasure / beatsPerMeasure;
        if (isFirstInSystem) {
          x = measureX + dimensions.firstMeasureExtra;
          w = measureWidth * endFraction;
        } else {
          x = measureX;
          w = fullWidth * endFraction;
        }
      } else {
        x = measureX;
        w = fullWidth;
      }

      // Draw the highlight
      if (context.svg) {
        // Background fill
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', bassY);
        rect.setAttribute('width', w);
        rect.setAttribute('height', bassHeight);
        rect.setAttribute('fill', highlightColor);
        rect.setAttribute('stroke', 'none');
        rect.setAttribute('class', 'active-bass-block-highlight');
        context.svg.insertBefore(rect, context.svg.firstChild);

        // Draw dashed boundary lines at block edges
        if (m === startMeasure && startBeatInMeasure > 0.001) {
          // Left boundary (only if block doesn't start at measure start)
          const leftLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          leftLine.setAttribute('x1', x);
          leftLine.setAttribute('y1', bassY);
          leftLine.setAttribute('x2', x);
          leftLine.setAttribute('y2', bassY + bassHeight);
          leftLine.setAttribute('stroke', borderColor);
          leftLine.setAttribute('stroke-width', '2');
          leftLine.setAttribute('stroke-dasharray', '4,4');
          leftLine.setAttribute('class', 'active-bass-block-boundary');
          context.svg.appendChild(leftLine);
        }

        if (m === endMeasure && endBeatInMeasure > 0.001 && endBeatInMeasure < beatsPerMeasure - 0.001) {
          // Right boundary (only if block doesn't end at measure end)
          const rightLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          rightLine.setAttribute('x1', x + w);
          rightLine.setAttribute('y1', bassY);
          rightLine.setAttribute('x2', x + w);
          rightLine.setAttribute('y2', bassY + bassHeight);
          rightLine.setAttribute('stroke', borderColor);
          rightLine.setAttribute('stroke-width', '2');
          rightLine.setAttribute('stroke-dasharray', '4,4');
          rightLine.setAttribute('class', 'active-bass-block-boundary');
          context.svg.appendChild(rightLine);
        }
      } else if (context.context2D || context.vexFlowCanvasContext) {
        const ctx = context.context2D || context.vexFlowCanvasContext;
        if (ctx) {
          ctx.save();
          ctx.fillStyle = highlightColor;
          ctx.fillRect(x, bassY, w, bassHeight);

          // Draw dashed boundary lines
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);

          if (m === startMeasure && startBeatInMeasure > 0.001) {
            ctx.beginPath();
            ctx.moveTo(x, bassY);
            ctx.lineTo(x, bassY + bassHeight);
            ctx.stroke();
          }

          if (m === endMeasure && endBeatInMeasure > 0.001 && endBeatInMeasure < beatsPerMeasure - 0.001) {
            ctx.beginPath();
            ctx.moveTo(x + w, bassY);
            ctx.lineTo(x + w, bassY + bassHeight);
            ctx.stroke();
          }

          ctx.restore();
        }
      }
    }
  }

  // Draw the active bass block highlight
  drawActiveBassBlockHighlight();

  // ========================================================================
  // Draw coach highlights (for analysis feedback from Coach Engine)
  // ========================================================================
  function drawCoachHighlights() {
    if (!coachHighlightIndices || coachHighlightIndices.length === 0 || !chordSegments || chordSegments.length === 0) {
      return;
    }

    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);
    const highlightColor = 'rgba(251, 191, 36, 0.25)'; // Amber/yellow with transparency
    const borderColor = 'rgba(251, 191, 36, 0.8)';     // Stronger amber for border

    for (const chordIndex of coachHighlightIndices) {
      const segment = chordSegments.find(s => s.chordIndex === chordIndex);
      if (!segment) continue;

      const startBeat = segment.startBeat;
      const endBeat = startBeat + segment.durationBeats;

      // Convert global beat positions to global measure indices
      const globalStartMeasure = Math.floor(startBeat / beatsPerMeasure);
      const globalEndMeasure = Math.floor(endBeat / beatsPerMeasure);

      // Convert to local measure indices for this page
      const localStartMeasure = globalStartMeasure - globalMeasureOffset;
      const localEndMeasure = globalEndMeasure - globalMeasureOffset;

      // Skip if this block is entirely outside this page's measures
      if (localEndMeasure < 0 || localStartMeasure >= measures.length) {
        continue;
      }

      // Clamp to this page's measure range
      const startMeasure = Math.max(0, localStartMeasure);
      const endMeasure = Math.min(measures.length - 1, localEndMeasure);

      // Calculate beat positions within measures
      const startBeatInMeasure = localStartMeasure < 0 ? 0 : (startBeat % beatsPerMeasure);
      const endBeatInMeasure = localEndMeasure >= measures.length ? beatsPerMeasure : (endBeat % beatsPerMeasure);

      // Draw the highlight across BOTH staves (treble and bass)
      for (let m = startMeasure; m <= endMeasure; m++) {
        if (m >= measures.length) break;

        const systemIndex = Math.floor(m / measuresPerLine);
        const measureInSystem = m % measuresPerLine;
        const isFirstInSystem = measureInSystem === 0;

        const measureX = dimensions.braceWidth + (measureInSystem * measureWidth) +
          (isFirstInSystem ? 0 : dimensions.firstMeasureExtra);
        const fullWidth = isFirstInSystem
          ? measureWidth + dimensions.firstMeasureExtra
          : measureWidth;

        // Calculate Y position to span BOTH staves
        const trebleY = dimensions.trebleY + (systemIndex * dimensions.systemHeight);
        const bassY = trebleY + 80 + staffSpacing;
        const totalHeight = (bassY + 80) - trebleY; // From top of treble to bottom of bass

        // Calculate horizontal position and width within this measure
        let x, w;

        if (m === startMeasure && m === endMeasure) {
          const startFraction = startBeatInMeasure / beatsPerMeasure;
          const endFraction = endBeatInMeasure / beatsPerMeasure;
          x = measureX + (fullWidth * startFraction);
          w = fullWidth * (endFraction - startFraction);
        } else if (m === startMeasure) {
          const startFraction = startBeatInMeasure / beatsPerMeasure;
          x = measureX + (fullWidth * startFraction);
          w = fullWidth * (1 - startFraction);
        } else if (m === endMeasure) {
          const endFraction = endBeatInMeasure === 0 ? 0 : endBeatInMeasure / beatsPerMeasure;
          if (isFirstInSystem) {
            x = measureX + dimensions.firstMeasureExtra;
            w = measureWidth * endFraction;
          } else {
            x = measureX;
            w = fullWidth * endFraction;
          }
        } else {
          x = measureX;
          w = fullWidth;
        }

        // Draw the highlight
        if (context.svg) {
          // Background fill
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', x);
          rect.setAttribute('y', trebleY - 10); // Extend slightly above treble staff
          rect.setAttribute('width', w);
          rect.setAttribute('height', totalHeight + 20); // Extend slightly below bass staff
          rect.setAttribute('fill', highlightColor);
          rect.setAttribute('stroke', borderColor);
          rect.setAttribute('stroke-width', '2');
          rect.setAttribute('rx', '4'); // Rounded corners
          rect.setAttribute('class', 'coach-highlight-region');
          // Insert at the beginning so it's behind notes
          context.svg.insertBefore(rect, context.svg.firstChild);
        }
      }
    }
  }

  // Draw coach highlights if any
  drawCoachHighlights();

  // NOTE: Chord span shading and brackets are drawn AFTER measure rendering (see below)
  // This allows us to use actual VexFlow note positions for accurate alignment

  // Build set of building block start measures for chord symbol placement
  // Chord symbols should only appear at the START of each building block (chord segment)
  const buildingBlockStartMeasures = new Set();
  // CRITICAL FIX: Use proper beats per measure calculation (handles compound meters like 6/8)
  const beatsPerMeasureForSymbols = getBeatsPerMeasureFromTimeSignature(timeSignature);

  // Also track the beat offset within each measure where each chord starts
  // This is needed to position chord symbols correctly when chords don't align to measure boundaries
  // CRITICAL: Use array to support multiple chords starting in the same measure (e.g., 1.25 beat chord + next chord)
  const chordStartsInMeasure = new Map(); // measureIndex -> array of chord start info

  if (window.getCompositionState) {
    const compositionState = window.getCompositionState();
    const segments = compositionState?.getChordSegments?.() || [];

    console.log('[grandStaff] Processing', segments.length, 'segments for chord labels, beatsPerMeasure:', beatsPerMeasureForSymbols);
    segments.forEach((segment, segmentIndex) => {
      // Calculate the measure index where this building block starts
      const startMeasure = Math.floor(segment.startBeat / beatsPerMeasureForSymbols);
      buildingBlockStartMeasures.add(startMeasure);
      // Store the beat offset within the measure (for positioning chord symbol)
      const beatInMeasure = segment.startBeat % beatsPerMeasureForSymbols;
      // Determine chord symbol - handle No Chord specially
      let chordSymbol = null;
      if (segment.chord?.type === 'No Chord') {
        chordSymbol = 'N.C.';  // Show "N.C." for No Chord
      } else if (segment.chord?.root) {
        chordSymbol = segment.chord.selectionMode === 'interval'
          ? `${segment.chord.root} ${segment.chord.simpleName || segment.chord.type}`
          : `${segment.chord.root}${getChordTypeSuffix(segment.chord.type)}`;
      }
      console.log('[grandStaff] Segment', segmentIndex, ':', segment.chord?.root, 'startBeat:', segment.startBeat, '-> measure', startMeasure, ', beat', beatInMeasure, ', symbol:', chordSymbol);
      // Get existing array for this measure or create new one
      if (!chordStartsInMeasure.has(startMeasure)) {
        chordStartsInMeasure.set(startMeasure, []);
      }
      chordStartsInMeasure.get(startMeasure).push({
        beatOffset: beatInMeasure,
        chordSymbol,
        segmentIndex
      });
    });
  }

  // If no segments found, fall back to showing chord symbol on every measure
  const hasSegments = buildingBlockStartMeasures.size > 0;
  console.log('[grandStaff] chordStartsInMeasure map:', Array.from(chordStartsInMeasure.entries()));
  console.log('[grandStaff] measures.length:', measures.length, ', hasSegments:', hasSegments);

  // Render each measure
  const renderedMeasures = [];

  for (let i = 0; i < measures.length; i++) {
    const systemIndex = Math.floor(i / measuresPerLine);
    const measureInSystem = i % measuresPerLine;
    const isFirstInSystem = measureInSystem === 0;
    const isLastInSystem = measureInSystem === measuresPerLine - 1 || i === measures.length - 1;

    // Calculate position
    const x = dimensions.braceWidth + (measureInSystem * measureWidth) +
      (isFirstInSystem ? 0 : dimensions.firstMeasureExtra);
    const y = dimensions.trebleY + (systemIndex * dimensions.systemHeight);
    const width = isFirstInSystem
      ? measureWidth + dimensions.firstMeasureExtra
      : measureWidth;

    // Get chord info from measure data for harmonic coloring
    const measureChord = measures[i].chord || null;
    const isAutoGeneratedBass = measures[i].isAutoGeneratedBass || false;

    // Determine if this measure is the start of a building block
    // If we have segment data, only show chord symbol at block starts
    // Otherwise (fallback), show on every measure
    const isBlockStart = hasSegments ? buildingBlockStartMeasures.has(i) : true;

    // Get chord start info for this measure (may have multiple chords starting in same measure)
    const chordStartsInfo = chordStartsInMeasure.get(i) || [];

    // Look up repeat sign for this measure (using global measure index)
    const globalMeasureIndex = globalMeasureOffset + i;
    const measureRepeatSign = repeatSigns.find(rs => rs.measureIndex === globalMeasureIndex);

    // Look up volta bracket for this measure (using global measure index)
    const measureVolta = voltaBrackets.find(v =>
      globalMeasureIndex >= v.startMeasure && globalMeasureIndex <= v.endMeasure
    );
    let voltaType = null;
    if (measureVolta) {
      const isStart = globalMeasureIndex === measureVolta.startMeasure;
      const isEnd = globalMeasureIndex === measureVolta.endMeasure;
      if (isStart && isEnd) {
        voltaType = { type: 'begin_end', number: measureVolta.number };
      } else if (isStart) {
        voltaType = { type: 'begin', number: measureVolta.number };
      } else if (isEnd) {
        voltaType = { type: 'end', number: measureVolta.number };
      } else {
        voltaType = { type: 'mid', number: measureVolta.number };
      }
    }

    // Render the measure
    const result = renderGrandStaffMeasure(context, measures[i], {
      x,
      y,
      width,
      staffSpacing,
      keySignature,
      timeSignature,
      isFirstInSystem,
      isLastInSystem,
      measureNumber: showMeasureNumbers ? startMeasureNumber + i : null,
      // Coloring options
      measureIndex: i,
      chord: measureChord,
      activeNotes,
      enableHarmonicColoring,
      isAutoGeneratedBass,
      isBlockStart, // NEW: Flag to control chord symbol display
      // Chord positioning info - array of chord starts in this measure (supports multiple chords per measure)
      chordStartsInfo,
      // First measure extra width for accurate chord symbol positioning
      firstMeasureExtra: dimensions.firstMeasureExtra,
      // Multi-voice rest display options
      restDisplayMode,
      // Repeat sign for this measure
      repeatSign: measureRepeatSign?.type || null,
      // Volta bracket for this measure
      voltaType,
    });

    if (result) {
      // CRITICAL: Get ACTUAL positions from VexFlow staves (not calculated positions)
      // VexFlow may render at different Y positions than we calculated
      const actualTrebleY = result.trebleStave ? result.trebleStave.getY() : y;
      const actualBassY = result.bassStave ? result.bassStave.getY() : y + 80 + staffSpacing;
      const actualX = result.trebleStave ? result.trebleStave.getX() : x;
      const actualWidth = result.trebleStave ? result.trebleStave.getWidth() : width;

      renderedMeasures.push({
        index: i,
        ...result,
        bounds: {
          x,
          y,
          width,
          height: dimensions.systemHeight - dimensions.systemMarginTop - dimensions.systemMarginBottom,
        },
        // ACTUAL positions from VexFlow - use these instead of calculated!
        actualBounds: {
          x: actualX,
          trebleY: actualTrebleY,
          bassY: actualBassY,
          width: actualWidth,
          // System height is from treble top to bass bottom + some margin
          height: (actualBassY - actualTrebleY) + 100, // 100 = staff height + margin
        },
      });
    }
  }

  // Populate measureBeatMaps from rendered measures for accurate bracket/coloring positioning
  // This must happen AFTER measures are rendered so we have actual VexFlow note positions
  measureBeatMaps = renderedMeasures.map(rm => ({
    beatToNoteX: rm.beatToNoteX || new Map()
  }));

  // Collect chord symbol regions from rendered measures
  // These are the EXACT positions where chord labels were drawn (captured during rendering)
  for (let i = 0; i < renderedMeasures.length; i++) {
    const renderedMeasure = renderedMeasures[i];
    if (renderedMeasure.renderedChordLabelPositions && renderedMeasure.renderedChordLabelPositions.length > 0) {
      for (const pos of renderedMeasure.renderedChordLabelPositions) {
        chordSymbolRegions.push({
          ...pos,
          measureIndex: i
        });
      }
    }
  }
  console.log('[grandStaff] chordSymbolRegions collected from rendered measures:', chordSymbolRegions.length, 'regions',
    chordSymbolRegions.map(r => ({ chordIndex: r.chordIndex, symbol: r.chordSymbol, x: Math.round(r.x), y: Math.round(r.y) })));

  // Draw chord span shading and brackets - alternating colors for consecutive chords
  // Uses beat-based positioning with actual VexFlow note positions for accurate alignment
  // This is drawn AFTER measure rendering so we have access to measureBeatMaps
  if (showChordSpans) {
    // Clear any existing chord bracket SVG groups before re-drawing
    if (context.svg) {
      const existingBrackets = context.svg.querySelectorAll('.chord-bracket-group');
      existingBrackets.forEach(el => el.remove());
    }
    const chordSpanColors = [
      'rgba(200, 220, 255, 0.15)',  // Light blue
      'rgba(220, 255, 220, 0.15)',  // Light green
      'rgba(255, 240, 200, 0.15)',  // Light yellow
      'rgba(255, 220, 220, 0.15)',  // Light red
      'rgba(240, 220, 255, 0.15)',  // Light purple
    ];

    const chordBracketColors = [
      '#4080E0',  // Blue
      '#40B060',  // Green
      '#D0A040',  // Yellow/Gold
      '#D06060',  // Red
      '#9060C0',  // Purple
    ];

    // Get chord information from compositionState to calculate beat positions
    // Use chordSegments if available (Phase 5 of Bass Clef Refactoring) for more accurate positioning
    if (window.getCompositionState) {
      const compositionState = window.getCompositionState();

      // Try to use chord segments first (more accurate, includes edited bass tracking)
      const segments = compositionState.getChordSegments ? compositionState.getChordSegments() : null;

      if (segments && segments.length > 0) {
        // Use segment data for accurate beat positions
        segments.forEach((segment, index) => {
          const startBeat = segment.startBeat;
          const endBeat = segment.startBeat + segment.durationBeats;
          const chord = segment.chord || {};

          // Draw the background shading for this chord
          // Use slightly different color if bass has been edited
          let bgColor = chordSpanColors[index % chordSpanColors.length];
          if (segment.isEdited) {
            // Add subtle indicator that this segment has edited bass
            bgColor = bgColor.replace('0.15', '0.2'); // Slightly more opaque
          }

          drawChordSpanHighlight(
            startBeat,
            endBeat,
            bgColor
          );

          // Draw the bracket with chord name beneath bass clef
          // Use displayNameOverride if user has manually set a chord name, otherwise format automatically
          let chordName;
          if (chord.displayNameOverride) {
            chordName = chord.displayNameOverride;
          } else {
            // Format chord name with inversion using helper function
            chordName = formatChordNameForDisplay(chord);

            // Add inversion indicator only for non-root inversions
            const inversion = chord.inversion || 0;
            if (inversion === 1) {
              chordName += ' (1st)';
            } else if (inversion === 2) {
              chordName += ' (2nd)';
            } else if (inversion === 3) {
              chordName += ' (3rd)';
            }
          }

          // Add edited indicator for bass notes
          if (segment.isEdited) {
            chordName += ' ✎';
          }

          drawChordBracket(
            startBeat,
            endBeat,
            chordName,
            chordBracketColors[index % chordBracketColors.length],
            chord,  // Pass full chord data for click handling
            index   // Pass chord index
          );
        });
      } else {
        // Fallback to original chord-based approach
        const chords = compositionState.getChords();

        if (chords && chords.length > 0) {
          let beatOffset = 0;
          chords.forEach((chord, index) => {
            const chordBeats = chord.beats !== undefined ? chord.beats : 4;
            const startBeat = beatOffset;
            const endBeat = beatOffset + chordBeats;

            // Draw the background shading for this chord
            drawChordSpanHighlight(
              startBeat,
              endBeat,
              chordSpanColors[index % chordSpanColors.length]
            );

            // Draw the bracket with chord name beneath bass clef
            // Use displayNameOverride if user has manually set a chord name, otherwise format automatically
            let chordName;
            if (chord.displayNameOverride) {
              chordName = chord.displayNameOverride;
            } else {
              // Format chord name using helper function
              chordName = formatChordNameForDisplay(chord);

              // Add inversion indicator only for non-root inversions
              const inversion = chord.inversion || 0;
              if (inversion === 1) {
                chordName += ' (1st)';
              } else if (inversion === 2) {
                chordName += ' (2nd)';
              } else if (inversion === 3) {
                chordName += ' (3rd)';
              }
            }

            drawChordBracket(
              startBeat,
              endBeat,
              chordName,
              chordBracketColors[index % chordBracketColors.length],
              chord,  // Pass full chord data for click handling
              index   // Pass chord index
            );

            beatOffset += chordBeats;
          });
        }
      }
    }
  }

  // Draw cross-measure ottava brackets
  // Track consecutive measures that need the same ottava adjustment
  if (VF && renderedMeasures.length > 0) {
    const TOP_POSITION = VF.TextBracket.Position?.TOP ?? VF.TextBracket.Positions?.TOP ?? 1;
    const BOTTOM_POSITION = VF.TextBracket.Position?.BOTTOM ?? VF.TextBracket.Positions?.BOTTOM ?? -1;

    // Helper to get line position for highest note in a chord
    // For bass clef 8va notes: VexFlow reports them with large positive line numbers
    // We want the SMALLEST line number (most negative or closest to 0) for notes near/above staff
    // But for notes far above bass clef, VexFlow uses large positive numbers, so we also track max
    function getNoteLinePosition(note) {
      try {
        const keyProps = note.getKeyProps();
        if (keyProps && keyProps.length > 0) {
          // Find the smallest line number (typically highest on staff)
          let minLine = Infinity;
          for (const prop of keyProps) {
            if (prop.line < minLine) {
              minLine = prop.line;
            }
          }
          return minLine;
        }
      } catch (e) {
        // Error getting line position
      }
      return 2; // Default to middle of staff
    }

    // VexFlow line numbers: LARGER/positive = higher on staff = higher pitch
    // So "highest pitch" means LARGEST line number (most positive)
    function getHighestPitchLine(note) {
      try {
        const keyProps = note.getKeyProps();
        if (keyProps && keyProps.length > 0) {
          // Highest pitch = largest line number (higher on staff)
          let maxLine = -Infinity;
          for (const prop of keyProps) {
            if (prop.line > maxLine) {
              maxLine = prop.line;
            }
          }
          return maxLine;
        }
      } catch (e) {
        // Fallback
      }
      return 2;
    }

    // VexFlow line numbers: SMALLER/negative = lower on staff = lower pitch
    // So "lowest pitch" means SMALLEST line number (most negative)
    function getLowestPitchLine(note) {
      try {
        const keyProps = note.getKeyProps();
        if (keyProps && keyProps.length > 0) {
          // Lowest pitch = smallest line number (lower on staff)
          let minLine = Infinity;
          for (const prop of keyProps) {
            if (prop.line < minLine) {
              minLine = prop.line;
            }
          }
          return minLine;
        }
      } catch (e) {
        // Fallback
      }
      return 2;
    }

    // Process bass clef brackets with cross-measure support
    // VexFlow line numbers: LARGER = higher pitch, SMALLER/negative = lower pitch
    //
    // Strategy: Track active bracket across measures. A bracket continues if
    // the next measure starts with the same ottava label. Close bracket when
    // ottava label changes or measure has no ottava.
    let currentBassOttava = null;
    let bassOttavaStart = null;
    let bassOttavaEnd = null;
    // For 8va: want MAX of highest lines (largest = highest pitch)
    // For 8vb: want MIN of lowest lines (smallest = lowest pitch)
    let bassHighestPitchLine = -Infinity;  // Will find MAX via > comparison
    let bassLowestPitchLine = Infinity;    // Will find MIN via < comparison
    let bassNoteCount = 0;

    for (let i = 0; i < renderedMeasures.length; i++) {
      const measure = renderedMeasures[i];
      const bassNotes = measure.bassNotes;
      const brackets = measure.bassOttavaBrackets;

      if (!bassNotes || bassNotes.length === 0) {
        // No notes - close any pending bracket
        if (currentBassOttava && bassOttavaStart && bassOttavaEnd) {
          drawBassBracket(currentBassOttava, bassOttavaStart, bassOttavaEnd, bassHighestPitchLine, bassLowestPitchLine, bassNoteCount);
        }
        currentBassOttava = null;
        bassOttavaStart = null;
        bassOttavaEnd = null;
        bassHighestPitchLine = -Infinity;  // Reset for MAX finding
        bassLowestPitchLine = Infinity;    // Reset for MIN finding
        bassNoteCount = 0;
        continue;
      }

      if (!brackets || brackets.length === 0) {
        // No ottava in this measure - close any pending bracket
        if (currentBassOttava && bassOttavaStart && bassOttavaEnd) {
          drawBassBracket(currentBassOttava, bassOttavaStart, bassOttavaEnd, bassHighestPitchLine, bassLowestPitchLine, bassNoteCount);
        }
        currentBassOttava = null;
        bassOttavaStart = null;
        bassOttavaEnd = null;
        bassHighestPitchLine = -Infinity;  // Reset for MAX finding
        bassLowestPitchLine = Infinity;    // Reset for MIN finding
        bassNoteCount = 0;
        continue;
      }

      // Process each bracket in this measure
      for (let bIdx = 0; bIdx < brackets.length; bIdx++) {
        const bracket = brackets[bIdx];
        const startIdx = bracket.startIndex ?? 0;
        const endIdx = bracket.endIndex ?? 0;
        const ottavaLabel = bracket.label;

        // Check if this is a continuation of the current bracket
        if (currentBassOttava === ottavaLabel && bIdx === 0 && startIdx === 0) {
          // Continue the bracket - first bracket starts at note 0, same label
          bassOttavaEnd = bassNotes[endIdx];
          const bracketNoteCount = endIdx - startIdx + 1;
          bassNoteCount += bracketNoteCount;
          // Update line positions for notes in this bracket
          // VexFlow: larger line = higher pitch, smaller line = lower pitch
          for (let j = startIdx; j <= endIdx && j < bassNotes.length; j++) {
            const noteHighestLine = getHighestPitchLine(bassNotes[j]); // largest line = highest pitch
            const noteLowestLine = getLowestPitchLine(bassNotes[j]);   // smallest line = lowest pitch
            // Track max highest (for 8va) and min lowest (for 8vb)
            if (noteHighestLine > bassHighestPitchLine) bassHighestPitchLine = noteHighestLine;
            if (noteLowestLine < bassLowestPitchLine) bassLowestPitchLine = noteLowestLine;
          }
        } else {
          // Different label or gap - draw previous bracket if exists
          if (currentBassOttava && bassOttavaStart && bassOttavaEnd) {
            drawBassBracket(currentBassOttava, bassOttavaStart, bassOttavaEnd, bassHighestPitchLine, bassLowestPitchLine, bassNoteCount);
          }

          // Start new bracket
          currentBassOttava = ottavaLabel;
          bassOttavaStart = bassNotes[startIdx];
          bassOttavaEnd = bassNotes[endIdx];
          const bracketNoteCount = endIdx - startIdx + 1;
          // VexFlow: larger line = higher pitch, smaller line = lower pitch
          // For 8va: want MAX of highest lines (largest = highest pitch)
          // For 8vb: want MIN of lowest lines (smallest = lowest pitch)
          bassHighestPitchLine = -Infinity;  // Will find MAX
          bassLowestPitchLine = Infinity;    // Will find MIN
          bassNoteCount = bracketNoteCount;

          // Calculate line positions for notes in this bracket
          for (let j = startIdx; j <= endIdx && j < bassNotes.length; j++) {
            const noteHighestLine = getHighestPitchLine(bassNotes[j]); // largest line = highest pitch
            const noteLowestLine = getLowestPitchLine(bassNotes[j]);   // smallest line = lowest pitch
            // Track max highest (for 8va) and min lowest (for 8vb)
            if (noteHighestLine > bassHighestPitchLine) bassHighestPitchLine = noteHighestLine;
            if (noteLowestLine < bassLowestPitchLine) bassLowestPitchLine = noteLowestLine;
          }
        }

        // If this bracket doesn't end at the last note, or there are more brackets,
        // we need to close this one before moving to the next
        const isLastBracket = bIdx === brackets.length - 1;
        const endsAtLastNote = endIdx === bassNotes.length - 1;

        if (!isLastBracket || !endsAtLastNote) {
          // Draw this bracket and prepare for next
          if (currentBassOttava && bassOttavaStart && bassOttavaEnd) {
            drawBassBracket(currentBassOttava, bassOttavaStart, bassOttavaEnd, bassHighestPitchLine, bassLowestPitchLine, bassNoteCount);
          }
          currentBassOttava = null;
          bassOttavaStart = null;
          bassOttavaEnd = null;
          bassHighestPitchLine = -Infinity;  // Reset for MAX finding
          bassLowestPitchLine = Infinity;    // Reset for MIN finding
          bassNoteCount = 0;
        }
      }
    }

    // Draw final bass bracket if exists
    if (currentBassOttava && bassOttavaStart && bassOttavaEnd) {
      drawBassBracket(currentBassOttava, bassOttavaStart, bassOttavaEnd, bassHighestPitchLine, bassLowestPitchLine, bassNoteCount);
    }

    // Process bass clef Voice 2 brackets with cross-measure support
    // Same logic as Voice 1, but uses bassNotes2 and bassOttavaBrackets2
    let currentBassOttava2 = null;
    let bassOttavaStart2 = null;
    let bassOttavaEnd2 = null;
    let bassHighestPitchLine2 = -Infinity;
    let bassLowestPitchLine2 = Infinity;
    let bassNoteCount2 = 0;

    for (let i = 0; i < renderedMeasures.length; i++) {
      const measure = renderedMeasures[i];
      const bassNotes2 = measure.bassNotes2;
      const brackets2 = measure.bassOttavaBrackets2;

      if (!bassNotes2 || bassNotes2.length === 0) {
        // No Voice 2 notes - close any pending bracket
        if (currentBassOttava2 && bassOttavaStart2 && bassOttavaEnd2) {
          drawBassBracket(currentBassOttava2, bassOttavaStart2, bassOttavaEnd2, bassHighestPitchLine2, bassLowestPitchLine2, bassNoteCount2);
        }
        currentBassOttava2 = null;
        bassOttavaStart2 = null;
        bassOttavaEnd2 = null;
        bassHighestPitchLine2 = -Infinity;
        bassLowestPitchLine2 = Infinity;
        bassNoteCount2 = 0;
        continue;
      }

      if (!brackets2 || brackets2.length === 0) {
        // No ottava in this measure for Voice 2 - close any pending bracket
        if (currentBassOttava2 && bassOttavaStart2 && bassOttavaEnd2) {
          drawBassBracket(currentBassOttava2, bassOttavaStart2, bassOttavaEnd2, bassHighestPitchLine2, bassLowestPitchLine2, bassNoteCount2);
        }
        currentBassOttava2 = null;
        bassOttavaStart2 = null;
        bassOttavaEnd2 = null;
        bassNoteCount2 = 0;
        bassHighestPitchLine2 = -Infinity;
        bassLowestPitchLine2 = Infinity;
        continue;
      }

      // Process each bracket in this measure for Voice 2
      for (let bIdx = 0; bIdx < brackets2.length; bIdx++) {
        const bracket = brackets2[bIdx];
        const startIdx = bracket.startIndex ?? 0;
        const endIdx = bracket.endIndex ?? 0;
        const ottavaLabel = bracket.label;
        const bracketNoteCount = endIdx - startIdx + 1;

        // Check if this is a continuation of the current bracket
        if (currentBassOttava2 === ottavaLabel && bIdx === 0 && startIdx === 0) {
          // Continue the bracket
          bassOttavaEnd2 = bassNotes2[endIdx];
          bassNoteCount2 += bracketNoteCount;
          for (let j = startIdx; j <= endIdx && j < bassNotes2.length; j++) {
            const noteHighestLine = getHighestPitchLine(bassNotes2[j]);
            const noteLowestLine = getLowestPitchLine(bassNotes2[j]);
            if (noteHighestLine > bassHighestPitchLine2) bassHighestPitchLine2 = noteHighestLine;
            if (noteLowestLine < bassLowestPitchLine2) bassLowestPitchLine2 = noteLowestLine;
          }
        } else {
          // Different label or gap - draw previous bracket if exists
          if (currentBassOttava2 && bassOttavaStart2 && bassOttavaEnd2) {
            drawBassBracket(currentBassOttava2, bassOttavaStart2, bassOttavaEnd2, bassHighestPitchLine2, bassLowestPitchLine2, bassNoteCount2);
          }

          // Start new bracket
          currentBassOttava2 = ottavaLabel;
          bassOttavaStart2 = bassNotes2[startIdx];
          bassOttavaEnd2 = bassNotes2[endIdx];
          bassHighestPitchLine2 = -Infinity;
          bassLowestPitchLine2 = Infinity;
          bassNoteCount2 = bracketNoteCount;

          for (let j = startIdx; j <= endIdx && j < bassNotes2.length; j++) {
            const noteHighestLine = getHighestPitchLine(bassNotes2[j]);
            const noteLowestLine = getLowestPitchLine(bassNotes2[j]);
            if (noteHighestLine > bassHighestPitchLine2) bassHighestPitchLine2 = noteHighestLine;
            if (noteLowestLine < bassLowestPitchLine2) bassLowestPitchLine2 = noteLowestLine;
          }
        }

        // Check if we need to close this bracket before next
        const isLastBracket = bIdx === brackets2.length - 1;
        const endsAtLastNote = endIdx === bassNotes2.length - 1;

        if (!isLastBracket || !endsAtLastNote) {
          if (currentBassOttava2 && bassOttavaStart2 && bassOttavaEnd2) {
            drawBassBracket(currentBassOttava2, bassOttavaStart2, bassOttavaEnd2, bassHighestPitchLine2, bassLowestPitchLine2, bassNoteCount2);
          }
          currentBassOttava2 = null;
          bassOttavaStart2 = null;
          bassOttavaEnd2 = null;
          bassHighestPitchLine2 = -Infinity;
          bassLowestPitchLine2 = Infinity;
          bassNoteCount2 = 0;
        }
      }
    }

    // Draw final bass Voice 2 bracket if exists
    if (currentBassOttava2 && bassOttavaStart2 && bassOttavaEnd2) {
      drawBassBracket(currentBassOttava2, bassOttavaStart2, bassOttavaEnd2, bassHighestPitchLine2, bassLowestPitchLine2, bassNoteCount2);
    }

    // Helper function to draw a bass bracket with correct positioning
    function drawBassBracket(label, startNote, endNote, highestLine, lowestLine, noteCount = 1) {
      if (!startNote || !endNote) return;
      try {
        // 8va/15ma/22ma: bracket above notes (TOP position)
        // 8vb/15mb/22mb: bracket below notes (BOTTOM position)
        const isAbove = label === '8va' || label === '15ma' || label === '22ma';
        const position = isAbove ? TOP_POSITION : BOTTOM_POSITION;

        const textBracket = new VF.TextBracket({
          start: startNote,
          stop: endNote,
          text: label,
          superscript: '',
          position: position,
        });

        // VexFlow line numbers: LARGER = higher pitch, SMALLER/negative = lower pitch
        // highestLine = largest line number (highest pitch)
        // lowestLine = smallest line number (lowest pitch, can be negative)
        let lineOffset;
        if (isAbove) {
          // 8va/15ma/22ma: BASS CLEF TOP position bracket above the highest note
          // For TOP: LARGER NEGATIVE = bracket moves DOWN (closer to notes)
          // Using same offset as treble clef
          lineOffset = highestLine - 4.5;
        } else {
          // 8vb/15mb: BASS CLEF BOTTOM position
          // Lower notes have smaller (more negative) line numbers
          // For BASS BOTTOM: LARGER POSITIVE = DOWN
          lineOffset = -lowestLine + 2.0;
        }

        textBracket.setLine(lineOffset);
        textBracket.setContext(context).draw();
      } catch (e) {
        console.warn('Error drawing bass ottava bracket:', e);
      }
    }

    // Process treble clef brackets with cross-measure support
    // In treble clef, line numbers work opposite to bass clef:
    // - Small/negative line numbers = high pitch (above staff)
    // - Large positive line numbers = low pitch (below staff)
    //
    // Strategy: Track active bracket across measures. A bracket continues if
    // the next measure starts with the same ottava label. Close bracket when
    // ottava label changes or measure has no ottava.
    let currentTrebleOttava = null;
    let trebleOttavaStart = null;
    let trebleOttavaEnd = null;
    let trebleHighestPitchLine = -Infinity;  // Will find MAX (largest = highest pitch)
    let trebleLowestPitchLine = Infinity;   // Will find MIN (smallest = lowest pitch)
    let trebleNoteCount = 0;

    for (let i = 0; i < renderedMeasures.length; i++) {
      const measure = renderedMeasures[i];
      const trebleNotes = measure.trebleNotes;
      const brackets = measure.trebleOttavaBrackets;

      if (!trebleNotes || trebleNotes.length === 0) {
        // No notes - close any pending bracket
        if (currentTrebleOttava && trebleOttavaStart && trebleOttavaEnd) {
          drawTrebleBracket(currentTrebleOttava, trebleOttavaStart, trebleOttavaEnd, trebleHighestPitchLine, trebleLowestPitchLine, trebleNoteCount);
        }
        currentTrebleOttava = null;
        trebleOttavaStart = null;
        trebleOttavaEnd = null;
        trebleHighestPitchLine = -Infinity;  // Reset for MAX finding (same as initial)
        trebleLowestPitchLine = Infinity;    // Reset for MIN finding (same as initial)
        trebleNoteCount = 0;
        continue;
      }

      if (!brackets || brackets.length === 0) {
        // No ottava in this measure - close any pending bracket
        if (currentTrebleOttava && trebleOttavaStart && trebleOttavaEnd) {
          drawTrebleBracket(currentTrebleOttava, trebleOttavaStart, trebleOttavaEnd, trebleHighestPitchLine, trebleLowestPitchLine, trebleNoteCount);
        }
        currentTrebleOttava = null;
        trebleOttavaStart = null;
        trebleOttavaEnd = null;
        trebleNoteCount = 0;
        trebleHighestPitchLine = -Infinity;  // Reset for MAX finding (same as initial)
        trebleLowestPitchLine = Infinity;    // Reset for MIN finding (same as initial)
        continue;
      }

      // Process each bracket in this measure
      for (let bIdx = 0; bIdx < brackets.length; bIdx++) {
        const bracket = brackets[bIdx];
        const startIdx = bracket.startIndex ?? 0;
        const endIdx = bracket.endIndex ?? 0;
        const ottavaLabel = bracket.label;
        const bracketNoteCount = endIdx - startIdx + 1;

        // Check if this is a continuation of the current bracket
        if (currentTrebleOttava === ottavaLabel && bIdx === 0 && startIdx === 0) {
          // Continue the bracket - first bracket starts at note 0, same label
          trebleOttavaEnd = trebleNotes[endIdx];
          trebleNoteCount += bracketNoteCount;
          // Update line positions for notes in this bracket
          // VexFlow: larger line = higher pitch, smaller line = lower pitch
          for (let j = startIdx; j <= endIdx && j < trebleNotes.length; j++) {
            const noteHighestLine = getHighestPitchLine(trebleNotes[j]); // largest line number = highest pitch
            const noteLowestLine = getLowestPitchLine(trebleNotes[j]);   // smallest line number = lowest pitch
            // Track max highest (for 8va) and min lowest (for 8vb) - same logic as new bracket
            if (noteHighestLine > trebleHighestPitchLine) trebleHighestPitchLine = noteHighestLine;
            if (noteLowestLine < trebleLowestPitchLine) trebleLowestPitchLine = noteLowestLine;
          }
        } else {
          // Different label or gap - draw previous bracket if exists
          if (currentTrebleOttava && trebleOttavaStart && trebleOttavaEnd) {
            drawTrebleBracket(currentTrebleOttava, trebleOttavaStart, trebleOttavaEnd, trebleHighestPitchLine, trebleLowestPitchLine, trebleNoteCount);
          }

          // Start new bracket
          currentTrebleOttava = ottavaLabel;
          trebleOttavaStart = trebleNotes[startIdx];
          trebleOttavaEnd = trebleNotes[endIdx];
          // VexFlow: larger line = higher pitch, smaller line = lower pitch
          // For 8va: want MAX of highest lines (largest = highest note)
          // For 8vb: want MIN of lowest lines (smallest = lowest note)
          trebleHighestPitchLine = -Infinity;  // Will find MAX
          trebleLowestPitchLine = Infinity;    // Will find MIN
          trebleNoteCount = bracketNoteCount;

          // Calculate line positions for notes in this bracket
          for (let j = startIdx; j <= endIdx && j < trebleNotes.length; j++) {
            const noteHighestLine = getHighestPitchLine(trebleNotes[j]); // largest line = highest pitch
            const noteLowestLine = getLowestPitchLine(trebleNotes[j]);   // smallest line = lowest pitch
            // Track max highest (for 8va) and min lowest (for 8vb)
            if (noteHighestLine > trebleHighestPitchLine) trebleHighestPitchLine = noteHighestLine;
            if (noteLowestLine < trebleLowestPitchLine) trebleLowestPitchLine = noteLowestLine;
          }
        }

        // If this bracket doesn't end at the last note, or there are more brackets,
        // we need to close this one before moving to the next
        const isLastBracket = bIdx === brackets.length - 1;
        const endsAtLastNote = endIdx === trebleNotes.length - 1;

        if (!isLastBracket || !endsAtLastNote) {
          // Draw this bracket and prepare for next
          if (currentTrebleOttava && trebleOttavaStart && trebleOttavaEnd) {
            drawTrebleBracket(currentTrebleOttava, trebleOttavaStart, trebleOttavaEnd, trebleHighestPitchLine, trebleLowestPitchLine, trebleNoteCount);
          }
          currentTrebleOttava = null;
          trebleOttavaStart = null;
          trebleOttavaEnd = null;
          trebleHighestPitchLine = -Infinity;  // Reset for MAX finding
          trebleLowestPitchLine = Infinity;    // Reset for MIN finding
          trebleNoteCount = 0;
        }
      }
    }

    // Draw final treble bracket if exists
    if (currentTrebleOttava && trebleOttavaStart && trebleOttavaEnd) {
      drawTrebleBracket(currentTrebleOttava, trebleOttavaStart, trebleOttavaEnd, trebleHighestPitchLine, trebleLowestPitchLine, trebleNoteCount);
    }

    // Process treble clef Voice 2 brackets with cross-measure support
    // Same logic as Voice 1, but uses trebleNotes2 and trebleOttavaBrackets2
    let currentTrebleOttava2 = null;
    let trebleOttavaStart2 = null;
    let trebleOttavaEnd2 = null;
    let trebleHighestPitchLine2 = -Infinity;
    let trebleLowestPitchLine2 = Infinity;
    let trebleNoteCount2 = 0;

    for (let i = 0; i < renderedMeasures.length; i++) {
      const measure = renderedMeasures[i];
      const trebleNotes2 = measure.trebleNotes2;
      const brackets2 = measure.trebleOttavaBrackets2;

      if (!trebleNotes2 || trebleNotes2.length === 0) {
        // No Voice 2 notes - close any pending bracket
        if (currentTrebleOttava2 && trebleOttavaStart2 && trebleOttavaEnd2) {
          drawTrebleBracket(currentTrebleOttava2, trebleOttavaStart2, trebleOttavaEnd2, trebleHighestPitchLine2, trebleLowestPitchLine2, trebleNoteCount2);
        }
        currentTrebleOttava2 = null;
        trebleOttavaStart2 = null;
        trebleOttavaEnd2 = null;
        trebleHighestPitchLine2 = -Infinity;
        trebleLowestPitchLine2 = Infinity;
        trebleNoteCount2 = 0;
        continue;
      }

      if (!brackets2 || brackets2.length === 0) {
        // No ottava in this measure for Voice 2 - close any pending bracket
        if (currentTrebleOttava2 && trebleOttavaStart2 && trebleOttavaEnd2) {
          drawTrebleBracket(currentTrebleOttava2, trebleOttavaStart2, trebleOttavaEnd2, trebleHighestPitchLine2, trebleLowestPitchLine2, trebleNoteCount2);
        }
        currentTrebleOttava2 = null;
        trebleOttavaStart2 = null;
        trebleOttavaEnd2 = null;
        trebleNoteCount2 = 0;
        trebleHighestPitchLine2 = -Infinity;
        trebleLowestPitchLine2 = Infinity;
        continue;
      }

      // Process each bracket in this measure for Voice 2
      for (let bIdx = 0; bIdx < brackets2.length; bIdx++) {
        const bracket = brackets2[bIdx];
        const startIdx = bracket.startIndex ?? 0;
        const endIdx = bracket.endIndex ?? 0;
        const ottavaLabel = bracket.label;
        const bracketNoteCount = endIdx - startIdx + 1;

        // Check if this is a continuation of the current bracket
        if (currentTrebleOttava2 === ottavaLabel && bIdx === 0 && startIdx === 0) {
          // Continue the bracket
          trebleOttavaEnd2 = trebleNotes2[endIdx];
          trebleNoteCount2 += bracketNoteCount;
          for (let j = startIdx; j <= endIdx && j < trebleNotes2.length; j++) {
            const noteHighestLine = getHighestPitchLine(trebleNotes2[j]);
            const noteLowestLine = getLowestPitchLine(trebleNotes2[j]);
            if (noteHighestLine > trebleHighestPitchLine2) trebleHighestPitchLine2 = noteHighestLine;
            if (noteLowestLine < trebleLowestPitchLine2) trebleLowestPitchLine2 = noteLowestLine;
          }
        } else {
          // Different label or gap - draw previous bracket if exists
          if (currentTrebleOttava2 && trebleOttavaStart2 && trebleOttavaEnd2) {
            drawTrebleBracket(currentTrebleOttava2, trebleOttavaStart2, trebleOttavaEnd2, trebleHighestPitchLine2, trebleLowestPitchLine2, trebleNoteCount2);
          }

          // Start new bracket
          currentTrebleOttava2 = ottavaLabel;
          trebleOttavaStart2 = trebleNotes2[startIdx];
          trebleOttavaEnd2 = trebleNotes2[endIdx];
          trebleHighestPitchLine2 = -Infinity;
          trebleLowestPitchLine2 = Infinity;
          trebleNoteCount2 = bracketNoteCount;

          for (let j = startIdx; j <= endIdx && j < trebleNotes2.length; j++) {
            const noteHighestLine = getHighestPitchLine(trebleNotes2[j]);
            const noteLowestLine = getLowestPitchLine(trebleNotes2[j]);
            if (noteHighestLine > trebleHighestPitchLine2) trebleHighestPitchLine2 = noteHighestLine;
            if (noteLowestLine < trebleLowestPitchLine2) trebleLowestPitchLine2 = noteLowestLine;
          }
        }

        // Check if we need to close this bracket before next
        const isLastBracket = bIdx === brackets2.length - 1;
        const endsAtLastNote = endIdx === trebleNotes2.length - 1;

        if (!isLastBracket || !endsAtLastNote) {
          if (currentTrebleOttava2 && trebleOttavaStart2 && trebleOttavaEnd2) {
            drawTrebleBracket(currentTrebleOttava2, trebleOttavaStart2, trebleOttavaEnd2, trebleHighestPitchLine2, trebleLowestPitchLine2, trebleNoteCount2);
          }
          currentTrebleOttava2 = null;
          trebleOttavaStart2 = null;
          trebleOttavaEnd2 = null;
          trebleHighestPitchLine2 = -Infinity;
          trebleLowestPitchLine2 = Infinity;
          trebleNoteCount2 = 0;
        }
      }
    }

    // Draw final treble Voice 2 bracket if exists
    if (currentTrebleOttava2 && trebleOttavaStart2 && trebleOttavaEnd2) {
      drawTrebleBracket(currentTrebleOttava2, trebleOttavaStart2, trebleOttavaEnd2, trebleHighestPitchLine2, trebleLowestPitchLine2, trebleNoteCount2);
    }

    // Helper function to draw a treble bracket with correct positioning
    function drawTrebleBracket(label, startNote, endNote, highestLine, lowestLine, noteCount = 1) {
      if (!startNote || !endNote) return;
      try {
        // 8va/15ma/22ma: bracket above notes (TOP position)
        // 8vb/15mb/22mb: bracket below notes (BOTTOM position)
        const isAbove = label === '8va' || label === '15ma' || label === '22ma';
        const position = isAbove ? TOP_POSITION : BOTTOM_POSITION;

        const textBracket = new VF.TextBracket({
          start: startNote,
          stop: endNote,
          text: label,
          superscript: '',
          position: position,
        });

        // VexFlow line numbers: LARGER = higher pitch (higher on staff)
        // highestLine = largest line number (highest pitch)
        // lowestLine = smallest line number (lowest pitch, can be negative)
        let lineOffset;
        if (isAbove) {
          // 8va/15ma/22ma: TOP position bracket above the highest note
          // Higher notes have larger line numbers, so use highestLine directly
          // For TOP: LARGER NEGATIVE = bracket moves DOWN (closer to notes)
          lineOffset = highestLine - 4.5;
        } else {
          // 8vb/15mb: TREBLE CLEF BOTTOM position
          // Lower notes have smaller (more negative) line numbers
          // Negate lowestLine so lower notes push bracket further down
          lineOffset = -lowestLine + 3.0;
        }

        textBracket.setLine(lineOffset);
        textBracket.setContext(context).draw();
      } catch (e) {
        console.warn('Error drawing treble ottava bracket:', e);
      }
    }
  }

  // NOTE: Experimental chord-duration brackets and labels under the bass staff
  // have been disabled for now. The core staff rendering remains unchanged.

  // TODO: Draw cross-measure ties for bass notes
  // VexFlow 5.x StaveTie API has issues with notes on different staves/pages
  // The `isTied` property is correctly flowing through the data pipeline (see logs above)
  // but VexFlow's tie validation fails for cross-measure ties in multi-page rendering
  //
  // Possible solutions to explore:
  // 1. Use VexFlow's Curve API to manually draw tie curves
  // 2. Render ties within the measure rendering loop instead of after
  // 3. Use a single-page canvas for tie rendering
  //
  // For now, cross-measure ties are visually missing but:
  // ✅ Variable durations work correctly
  // ✅ Playback only triggers once (no retriggering for tied notes)
  // ✅ Chord progression remains stable when changing durations
  // ✅ `isTied` property flows correctly through the entire pipeline

  /* COMMENTED OUT - VexFlow StaveTie fails for cross-measure/cross-page ties
  for (let i = 0; i < renderedMeasures.length - 1; i++) {
    const currentMeasure = renderedMeasures[i];
    const nextMeasure = renderedMeasures[i + 1];

    if (nextMeasure.bassNotes && nextMeasure.bassNotes.length > 0) {
      const firstNextNote = nextMeasure.bassNotes[0];
      if (firstNextNote && firstNextNote.isTied === true) {
        if (currentMeasure.bassNotes && currentMeasure.bassNotes.length > 0) {
          const lastCurrentNote = currentMeasure.bassNotes[currentMeasure.bassNotes.length - 1];
          // Tie drawing code here - currently fails with VexFlow 5.x API
        }
      }
    }
  }
  */

  // ==========================================================================
  // MANUAL TIE CURVE RENDERING (Phase 3 of Bass Clef Refactoring)
  // ==========================================================================
  // Draw tie curves manually using canvas API to bypass VexFlow's StaveTie limitations
  // This works for cross-measure ties within the same system

  drawManualTies(context, renderedMeasures, measures);

  // ==========================================================================
  // HAIRPIN RENDERING (Crescendo/Decrescendo)
  // ==========================================================================
  // Draw hairpins between staves using VexFlow's StaveHairpin
  if (hairpins && hairpins.length > 0) {
    drawHairpins(context, renderedMeasures, hairpins, measures);
  }

  // ==========================================================================
  // SLUR RENDERING (Phrase marks / legato)
  // ==========================================================================
  // Draw slurs as curved lines connecting notes
  if (slurs && slurs.length > 0) {
    drawSlurs(context, renderedMeasures, slurs, measures);
  }

  // ==========================================================================
  // TEMPO MARKING RENDERING
  // ==========================================================================
  // Draw tempo markings (Allegro, Andante, etc.) above the staff
  if (tempoMarkings && tempoMarkings.length > 0) {
    drawTempoMarkings(context, renderedMeasures, tempoMarkings);
  }

  // Collect all note regions and add chord tone analysis
  const allNoteRegions = [];
  renderedMeasures.forEach((measure) => {
    if (measure.noteRegions) {
      const measureData = measures[measure.index];
      const chord = measureData?.chord;

      measure.noteRegions.forEach((region) => {
        // Add chord tone analysis for tooltip
        let analysis = null;
        if (!region.isRest && chord && chord.root && region.pitch) {
          try {
            analysis = analyzeChordTone(region.pitch, chord, keySignature);
          } catch (e) {
            // Ignore analysis errors
          }
        }

        allNoteRegions.push({
          ...region,
          chord,
          analysis,
        });
      });
    }
  });

  return {
    renderer,
    context,
    dimensions,
    measures: renderedMeasures,
    noteRegions: allNoteRegions,
    chordBracketRegions,  // Click regions for chord bracket labels (below staff)
    chordSymbolRegions,   // Position data for chord symbols (above staff) for coach overlay
  };
}

// ============================================================================
// DATA CONVERSION
// ============================================================================

/**
 * Convert existing melody composer data to grand staff format
 * @param {Object} composerData - Existing melody composer data
 * @returns {Array} - Array of grand staff measure data
 */
export function convertToGrandStaffFormat(composerData) {
  const measures = [];
  const {
    melody = [],
    chords = [],
    bassNotes = [],
    timeSignature = '4/4',
    key = 'C',
  } = composerData;

  // Group melody notes by measure
  const notesPerMeasure = getNotesPerMeasure(timeSignature);
  const melodyByMeasure = groupNotesByMeasure(melody, notesPerMeasure);

  // Get number of measures
  const numMeasures = Math.max(
    melodyByMeasure.length,
    chords.length,
    bassNotes.length,
    1
  );

  for (let i = 0; i < numMeasures; i++) {
    const measureData = {
      trebleNotes: [],
      bassNotes: [],
    };

    // Add melody notes to treble
    if (melodyByMeasure[i]) {
      measureData.trebleNotes = melodyByMeasure[i]
        .filter(note => {
          // Keep rests
          if (note.isRest) return true;
          // For non-rests, require valid pitch (allows double sharps ## and double flats bb)
          const pitch = note.pitch || note;
          if (pitch && typeof pitch === 'string' && pitch.match(/^[A-G][#b]*\d+$/)) return true;
          // Filter out notes with null/undefined pitch
          return false;
        })
        .map(note => ({
          pitch: note.pitch || note,
          duration: note.duration || '4n',
          isRest: note.isRest || false,
          tuplet: note.tuplet || null,
          tupletType: note.tupletType || null,
          tupletGroupId: note.tupletGroupId || null,
        }));
    }

    // Add bass notes or chord voicing to bass
    if (bassNotes[i]) {
      // If we have explicit bass notes
      if (Array.isArray(bassNotes[i])) {
        measureData.bassNotes = bassNotes[i]
          .filter(note => {
            // Keep rests
            if (note.isRest) return true;
            // For non-rests, require valid pitch (allows double sharps ## and double flats bb)
            const pitch = note.pitch || note;
            if (pitch && typeof pitch === 'string' && pitch.match(/^[A-G][#b]*\d+$/)) return true;
            // Filter out notes with null/undefined pitch
            return false;
          })
          .map(note => ({
            pitch: note.pitch || note,
            duration: note.duration || '1n',
            isRest: note.isRest || false,
            tuplet: note.tuplet || null,
            tupletType: note.tupletType || null,
            tupletGroupId: note.tupletGroupId || null,
          }));
      } else {
        // Single bass note - validate before adding (allows double sharps ## and double flats bb)
        const pitch = bassNotes[i];
        if (pitch && typeof pitch === 'string' && pitch.match(/^[A-G][#b]*\d+$/)) {
          measureData.bassNotes = [{
            pitch: bassNotes[i],
            duration: '1n',
          }];
        }
      }
    } else if (chords[i]) {
      // Convert chord to bass notes
      const chord = chords[i];
      if (chord.lhNotes && chord.lhNotes.length > 0) {
        measureData.bassNotes = [{
          pitches: chord.lhNotes,
          duration: '1n',
        }];
      } else if (chord.notes && chord.notes.length > 0) {
        // Separate into treble and bass based on octave
        const bassChordNotes = chord.notes.filter(note => {
          const midi = noteToMidi(note);
          return midi < CLEF_RANGES.treble.min;
        });
        if (bassChordNotes.length > 0) {
          measureData.bassNotes = [{
            pitches: bassChordNotes,
            duration: '1n',
          }];
        }
      }
    }

    measures.push(measureData);
  }

  return measures;
}

/**
 * Get number of beats per measure from time signature
 * @param {string} timeSignature - Time signature like "4/4"
 * @returns {number} - Number of beats
 */
function getNotesPerMeasure(timeSignature) {
  const [num, denom] = timeSignature.split('/').map(Number);
  return num;
}

/**
 * Group notes by measure based on their duration
 * @param {Array} notes - Array of notes
 * @param {number} beatsPerMeasure - Beats per measure
 * @returns {Array} - Array of arrays, one per measure
 */
function groupNotesByMeasure(notes, beatsPerMeasure) {
  const measures = [];
  let currentMeasure = [];
  let currentBeat = 0;

  for (const note of notes) {
    const noteDuration = getNoteDurationInBeats(note.duration || '4n');

    if (currentBeat + noteDuration > beatsPerMeasure) {
      // Start new measure
      if (currentMeasure.length > 0) {
        measures.push(currentMeasure);
      }
      currentMeasure = [note];
      currentBeat = noteDuration;
    } else {
      currentMeasure.push(note);
      currentBeat += noteDuration;
    }

    // Check if measure is full
    if (currentBeat >= beatsPerMeasure) {
      measures.push(currentMeasure);
      currentMeasure = [];
      currentBeat = 0;
    }
  }

  // Add remaining notes
  if (currentMeasure.length > 0) {
    measures.push(currentMeasure);
  }

  return measures;
}

/**
 * Get duration in beats
 * @param {string} duration - Tone.js duration
 * @returns {number} - Beats
 */
function getNoteDurationInBeats(duration) {
  const durationMap = {
    '1n': 4,
    '2n': 2,
    '4n': 1,
    '8n': 0.5,
    '16n': 0.25,
    '32n': 0.125,
    '1n.': 6,
    '2n.': 3,
    '4n.': 1.5,
    '8n.': 0.75,
  };
  return durationMap[duration] || 1;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Constants
  GRAND_STAFF_DEFAULTS,

  // Dimension calculations
  calculateGrandStaffDimensions,

  // Rendering
  renderGrandStaffMeasure,
  renderGrandStaffSystem,

  // Data conversion
  convertToGrandStaffFormat,
};
