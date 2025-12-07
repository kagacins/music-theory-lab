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

// VexFlow is loaded globally
// Use a getter function to check at runtime, not at module load time
// VexFlow 5.x uses window.VexFlow, older versions use window.Vex.Flow
function getVF() {
  return window.VexFlow || (window.Vex ? window.Vex.Flow : null);
}

const VOICE_STEM_DIRECTIONS = {
  primary: 1,
  secondary: -1,
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
 * Generate beams that respect tuplet groupings
 * Tuplet notes are beamed together as a unit, non-tuplet notes use standard beaming
 * @param {Array} vexNotes - All VexFlow notes in the measure
 * @param {Object} tupletGroups - Tuplet groups from createNotesForStaff
 * @returns {Array} - Array of VexFlow Beam objects
 */
function generateBeamsWithTuplets(vexNotes, tupletGroups) {
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
        const beam = new VF.Beam(beamableNotes);
        beams.push(beam);
      } catch (e) {
        console.warn('[generateBeamsWithTuplets] Error creating tuplet beam:', e);
      }
    }

    // Mark all notes in this tuplet as processed
    group.notes.forEach(n => tupletNoteSet.add(n));
  }

  // Group consecutive non-tuplet beamable notes, breaking at rests
  // This ensures notes separated by rests are NOT beamed together
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

    // Check if this note is beamable
    if (isBeamable(note)) {
      currentGroup.push(note);
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
  for (const group of beamGroups) {
    try {
      const groupBeams = generateBeams(group);
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
  measureWidth: 220,           // Width of each measure
  staffSpacing: 80,            // Vertical space between staves
  systemMarginTop: 20,         // Top margin for first system
  systemMarginBottom: 160,     // Bottom margin (increased for chord brackets + deep bass ledger lines)
  braceWidth: 15,              // Width for the brace
  measurePadding: 10,          // Padding within measures
  clefWidth: 30,               // Width for clef
  keySignatureWidth: 20,       // Width per accidental in key signature
  timeSignatureWidth: 30,      // Width for time signature
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
  const durationToBeats = (duration) => {
    if (!duration) return 1;
    const baseDuration = duration.replace(/[dn.]/g, '');
    const isDotted = duration.includes('d') || duration.includes('.');
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

  // Beats to duration string mapping
  const beatsToDuration = (beats) => {
    if (beats >= 4) return '1n';
    if (beats >= 3) return '2nd'; // dotted half
    if (beats >= 2) return '2n';
    if (beats >= 1.5) return '4nd'; // dotted quarter
    if (beats >= 1) return '4n';
    if (beats >= 0.75) return '8nd'; // dotted eighth
    if (beats >= 0.5) return '8n';
    if (beats >= 0.25) return '16n';
    if (beats >= 0.125) return '32n';
    return '4n';
  };

  // Build a map of occupied beat ranges
  // Include BOTH notes AND existing rests - we don't want to add rests where rests already exist
  const occupiedRanges = [];
  notes.forEach(note => {
    const start = note.beat ?? 0;
    const duration = durationToBeats(note.duration);
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
        const restDuration = beatsToDuration(gapDuration);
        const restBeats = durationToBeats(restDuration);

        rests.push({
          beat: gapStart,
          duration: restDuration,
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
    const restDuration = beatsToDuration(remainingBeats);
    const restBeats = durationToBeats(restDuration);

    rests.push({
      beat: currentBeat,
      duration: restDuration,
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
 * In clean notation mode, rests in one voice that coincide with notes in
 * another voice on the same beat can be hidden (the beat structure is clear).
 * However, rests that are REQUIRED for rhythmic clarity (before a re-entry)
 * are always shown.
 *
 * @param {Array} primaryVoiceNotes - Notes from voice 1 (typically stems up)
 * @param {Array} secondaryVoiceNotes - Notes from voice 2 (typically stems down)
 * @param {Object} options - Display options
 * @param {string} options.restDisplayMode - 'clean' (smart omission) or 'explicit' (show all)
 * @param {boolean} options.cueRestsForSecondaryVoice - Use smaller rests for voice 2
 * @returns {Object} - { primaryRestVisibility: Map, secondaryRestVisibility: Map }
 *                     Each map: beat -> { hidden: boolean, isCue: boolean }
 */
export function analyzeRestVisibility(primaryVoiceNotes, secondaryVoiceNotes, options = {}) {
  const {
    restDisplayMode = 'clean',
    cueRestsForSecondaryVoice = true,
  } = options;

  // Maps: beat number -> { hidden: boolean, isCue: boolean }
  const primaryRestVisibility = new Map();
  const secondaryRestVisibility = new Map();

  // If explicit mode, show all rests (no hiding)
  if (restDisplayMode === 'explicit') {
    return { primaryRestVisibility, secondaryRestVisibility };
  }

  // Build beat maps for each voice
  // Format: beat -> { isRest: boolean, hasNote: boolean, isLastBeforeNote: boolean }
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
  const secondaryBeatMap = buildBeatMap(secondaryVoiceNotes);

  // Helper: Check if a rest at given beat in voice is "required"
  // A rest is required if the voice has a note AFTER this rest beat
  // (i.e., the rest is needed to position the re-entry)
  const isRestRequired = (voiceNotes, restBeat) => {
    // Find if there's any non-rest note after this beat
    return voiceNotes.some(note => {
      const noteBeat = note.beat ?? 0;
      const isNote = !note.isRest && note.type !== 'rest';
      return isNote && noteBeat > restBeat;
    });
  };

  // Analyze primary voice rests
  primaryVoiceNotes.forEach((note, idx) => {
    if (note.isRest || note.type === 'rest') {
      const beat = note.beat ?? 0;
      const secondaryAtBeat = secondaryBeatMap.get(beat);

      // Check if secondary voice has a note at this beat
      const secondaryHasNote = secondaryAtBeat?.hasNote;

      // Check if this rest is required for re-entry
      const restRequired = isRestRequired(primaryVoiceNotes, beat);

      if (secondaryHasNote && !restRequired) {
        // Hide primary voice rest - beat structure is clear from secondary voice
        primaryRestVisibility.set(beat, { hidden: true, isCue: false });
      }
    }
  });

  // Analyze secondary voice rests
  secondaryVoiceNotes.forEach((note, idx) => {
    if (note.isRest || note.type === 'rest') {
      const beat = note.beat ?? 0;
      const primaryAtBeat = primaryBeatMap.get(beat);

      // Check if primary voice has a note at this beat
      const primaryHasNote = primaryAtBeat?.hasNote;

      // Check if this rest is required for re-entry
      const restRequired = isRestRequired(secondaryVoiceNotes, beat);

      // Voice 2 rests visibility depends on cueRestsForSecondaryVoice setting
      if (cueRestsForSecondaryVoice) {
        // Cue mode enabled: show as cue-sized, hide only if primary has note AND rest not required
        const shouldHide = primaryHasNote && !restRequired;
        secondaryRestVisibility.set(beat, { hidden: shouldHide, isCue: true });
      } else {
        // Cue mode disabled: hide all Voice 2 rests where primary has a note
        // (standard multi-voice notation hides secondary voice rests when primary voice has content)
        if (primaryHasNote) {
          secondaryRestVisibility.set(beat, { hidden: true, isCue: false });
        }
        // If primary doesn't have a note at this beat, the rest renders normally (no entry needed)
      }
    }
  });

  return { primaryRestVisibility, secondaryRestVisibility };
}

/**
 * Apply rest visibility settings to a note array before rendering.
 * Modifies notes in place, adding _restDisplay property.
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

    // Seventh chords
    'Dominant 7th': '7',
    'Major 7th': 'maj7',
    'Minor 7th': 'm7',
    'Half-Diminished 7th': 'm7b5',
    'Diminished 7th': 'dim7',
    'Minor-Major 7th': 'mMaj7',

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

  // If we have root, build the display name from root + type
  if (root) {
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

  // Look for tied notes across measure boundaries
  // Semantic: note.tied=true means "tie FROM this note TO the next note"
  // So we check the LAST note of the current measure for the tied flag
  for (let i = 0; i < renderedMeasures.length - 1; i++) {
    const currentMeasure = renderedMeasures[i];
    const nextMeasure = renderedMeasures[i + 1];

    // Get bass notes from rendered measures (VexFlow note objects)
    const currentBassNotes = currentMeasure.bassNotes;
    const nextBassNotes = nextMeasure.bassNotes;

    if (!currentBassNotes || !nextBassNotes || currentBassNotes.length === 0 || nextBassNotes.length === 0) {
      continue;
    }

    // Get measure data for the CURRENT measure (where the tie starts)
    const currentMeasureData = measures[currentMeasure.index];

    // Try both paths to get the bass note data for current measure
    let currentBassNoteData = currentMeasureData?.notation?.bass?.voices?.[0]?.notes;
    if (!currentBassNoteData || currentBassNoteData.length === 0) {
      currentBassNoteData = currentMeasureData?.bassNotes;
    }

    if (!currentBassNoteData || currentBassNoteData.length === 0) {
      continue;
    }

    // Check the LAST note of current measure for tied flag
    const lastNoteData = currentBassNoteData[currentBassNoteData.length - 1];

    // Check if this note is tied TO the next measure
    // Skip ties for rests - rests don't need tie markings
    if (lastNoteData && (lastNoteData.isTied === true || lastNoteData.tied === true) && !lastNoteData.isRest) {
      const lastCurrentNote = currentBassNotes[currentBassNotes.length - 1];
      const firstNextNote = nextBassNotes[0];

      // Also check if the next note is a rest - skip tie if so
      const nextMeasureData = measures[nextMeasure.index];
      let nextBassNoteData = nextMeasureData?.notation?.bass?.voices?.[0]?.notes;
      if (!nextBassNoteData || nextBassNoteData.length === 0) {
        nextBassNoteData = nextMeasureData?.bassNotes;
      }
      const firstNextNoteData = nextBassNoteData?.[0];
      if (firstNextNoteData?.isRest) {
        continue; // Skip tie if next note is a rest
      }

      // IMPORTANT: Only draw tie if pitches match - ties connect same pitches only
      if (!pitchesMatch(lastNoteData, firstNextNoteData)) {
        continue; // Skip tie if pitches don't match (different chords)
      }

      // Check if measures are on the same row
      if (!areMeasuresOnSameRow(currentMeasure, nextMeasure)) {
        // Cross-row tie: draw two partial ties
        // 1. "Tie to nowhere" - from last note to right edge of current row
        // 2. "Tie from nowhere" - from left edge of next row to first note
        try {
          const startBox = lastCurrentNote.getBoundingBox();
          const endBox = firstNextNote.getBoundingBox();

          if (startBox) {
            const direction = getTieDirection(lastCurrentNote);
            const startX = startBox.getX() + startBox.getW();
            // End at right edge of measure (about 30px past the note)
            const endX = startX + 30;

            let startY;
            if (direction === 'above') {
              startY = startBox.getY() - 5;
            } else {
              startY = startBox.getY() + startBox.getH() + 5;
            }

            // Draw partial tie going to the right (tie to nowhere)
            drawPartialTieCurve(ctx, startX, startY, endX, startY, direction, 'end');
          }

          if (endBox) {
            const direction = getTieDirection(firstNextNote);
            const endX = endBox.getX();
            // Start from left edge of measure (about 30px before the note)
            const startX = endX - 30;

            let endY;
            if (direction === 'above') {
              endY = endBox.getY() - 5;
            } else {
              endY = endBox.getY() + endBox.getH() + 5;
            }

            // Draw partial tie coming from the left (tie from nowhere)
            drawPartialTieCurve(ctx, startX, endY, endX, endY, direction, 'start');
          }
        } catch (e) {
          // Could not get bounding box - skip this tie
        }
        continue;
      }

      // Same-row tie: draw full tie between notes
      try {
        const startBox = lastCurrentNote.getBoundingBox();
        const endBox = firstNextNote.getBoundingBox();

        if (startBox && endBox) {
          // Determine tie direction based on the notes
          const direction = getTieDirection(lastCurrentNote);

          const startX = startBox.getX() + startBox.getW();
          const endX = endBox.getX();

          let startY, endY;
          if (direction === 'above') {
            // Tie above the notes
            startY = startBox.getY() - 5;
            endY = endBox.getY() - 5;
          } else {
            // Tie below the notes
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

  // Also check for ties within measures (for split notes)
  // Semantic: note.tied=true means "tie FROM this note TO the next note"
  // So we check each note (except the last) for the tied flag
  for (const renderedMeasure of renderedMeasures) {
    const bassNotes = renderedMeasure.bassNotes;
    if (!bassNotes || bassNotes.length < 2) continue;

    const measureData = measures[renderedMeasure.index];

    let bassNoteData = measureData?.notation?.bass?.voices?.[0]?.notes;
    if (!bassNoteData) {
      bassNoteData = measureData?.bassNotes;
    }

    if (!bassNoteData || bassNoteData.length < 2) continue;

    // Check each note (except the last) for tied flag
    for (let j = 0; j < bassNotes.length - 1 && j < bassNoteData.length - 1; j++) {
      const noteData = bassNoteData[j];
      const nextNoteData = bassNoteData[j + 1];

      // Skip ties for rests - rests don't need tie markings
      // Check if THIS note has tied=true (meaning tie TO the next note)
      // Also verify pitches match - ties only connect same pitches
      if (noteData && (noteData.isTied === true || noteData.tied === true) && !noteData.isRest && !nextNoteData?.isRest && pitchesMatch(noteData, nextNoteData)) {
        const currNote = bassNotes[j];
        const nextNote = bassNotes[j + 1];

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

  // =====================================================================
  // BASS TIES - Cross-page partial ties
  // These handle ties that continue to/from another page
  // =====================================================================

  // Check FIRST measure of page for "tie from nowhere" (note has isTied=true)
  // This means the note is a continuation from the previous page
  if (renderedMeasures.length > 0) {
    const firstMeasure = renderedMeasures[0];
    const firstBassNotes = firstMeasure.bassNotes;

    if (firstBassNotes && firstBassNotes.length > 0) {
      const firstMeasureData = measures[firstMeasure.index];
      let firstBassNoteData = firstMeasureData?.notation?.bass?.voices?.[0]?.notes;
      if (!firstBassNoteData || firstBassNoteData.length === 0) {
        firstBassNoteData = firstMeasureData?.bassNotes;
      }

      const firstNoteData = firstBassNoteData?.[0];

      // If first note has isTied=true, it's a continuation from previous page
      if (firstNoteData && firstNoteData.isTied === true && !firstNoteData.isRest) {
        const firstNote = firstBassNotes[0];
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

  // Check LAST measure of page for "tie to nowhere" (note has tied=true)
  // This means the note continues to the next page
  if (renderedMeasures.length > 0) {
    const lastMeasure = renderedMeasures[renderedMeasures.length - 1];
    const lastBassNotes = lastMeasure.bassNotes;

    if (lastBassNotes && lastBassNotes.length > 0) {
      const lastMeasureData = measures[lastMeasure.index];
      let lastBassNoteData = lastMeasureData?.notation?.bass?.voices?.[0]?.notes;
      if (!lastBassNoteData || lastBassNoteData.length === 0) {
        lastBassNoteData = lastMeasureData?.bassNotes;
      }

      const lastNoteData = lastBassNoteData?.[lastBassNoteData.length - 1];

      // If last note has tied=true, it continues to the next page
      if (lastNoteData && lastNoteData.tied === true && !lastNoteData.isRest) {
        const lastNote = lastBassNotes[lastBassNotes.length - 1];
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
  // So we check the LAST note of the current measure for the tied flag
  for (let i = 0; i < renderedMeasures.length - 1; i++) {
    const currentMeasure = renderedMeasures[i];
    const nextMeasure = renderedMeasures[i + 1];

    // Get treble notes from rendered measures (VexFlow note objects)
    const currentTrebleNotes = currentMeasure.trebleNotes;
    const nextTrebleNotes = nextMeasure.trebleNotes;

    if (!currentTrebleNotes || !nextTrebleNotes || currentTrebleNotes.length === 0 || nextTrebleNotes.length === 0) {
      continue;
    }

    // Get measure data for the CURRENT measure (where the tie starts)
    const currentMeasureData = measures[currentMeasure.index];

    // Try both paths to get the treble note data for current measure
    let currentTrebleNoteData = currentMeasureData?.notation?.treble?.voices?.[0]?.notes;
    if (!currentTrebleNoteData || currentTrebleNoteData.length === 0) {
      currentTrebleNoteData = currentMeasureData?.trebleNotes;
    }

    if (!currentTrebleNoteData || currentTrebleNoteData.length === 0) {
      continue;
    }

    // Check the LAST note of current measure for tied flag
    const lastNoteData = currentTrebleNoteData[currentTrebleNoteData.length - 1];

    // Check if this note is tied TO the next measure
    if (lastNoteData && (lastNoteData.isTied === true || lastNoteData.tied === true) && !lastNoteData.isRest) {
      const lastCurrentNote = currentTrebleNotes[currentTrebleNotes.length - 1];
      const firstNextNote = nextTrebleNotes[0];

      // Check if next note is a rest
      const nextMeasureData = measures[nextMeasure.index];
      let nextTrebleNoteData = nextMeasureData?.notation?.treble?.voices?.[0]?.notes;
      if (!nextTrebleNoteData || nextTrebleNoteData.length === 0) {
        nextTrebleNoteData = nextMeasureData?.trebleNotes;
      }
      const firstNextNoteData = nextTrebleNoteData?.[0];
      if (firstNextNoteData?.isRest) {
        continue; // Skip tie if next note is a rest
      }

      // IMPORTANT: Only draw tie if pitches match - ties connect same pitches only
      if (!pitchesMatch(lastNoteData, firstNextNoteData)) {
        continue; // Skip tie if pitches don't match (different chords)
      }

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
  for (const renderedMeasure of renderedMeasures) {
    const trebleNotes = renderedMeasure.trebleNotes;
    if (!trebleNotes || trebleNotes.length < 2) continue;

    const measureData = measures[renderedMeasure.index];

    let trebleNoteData = measureData?.notation?.treble?.voices?.[0]?.notes;
    if (!trebleNoteData) {
      trebleNoteData = measureData?.trebleNotes;
    }

    if (!trebleNoteData || trebleNoteData.length < 2) continue;

    // Check each note (except the last) for tied flag
    for (let j = 0; j < trebleNotes.length - 1 && j < trebleNoteData.length - 1; j++) {
      const noteData = trebleNoteData[j];
      const nextNoteData = trebleNoteData[j + 1];

      // Check if THIS note has tied=true (meaning tie TO the next note)
      // Also verify pitches match - ties only connect same pitches
      if (noteData && (noteData.isTied === true || noteData.tied === true) && !noteData.isRest && !nextNoteData?.isRest && pitchesMatch(noteData, nextNoteData)) {
        const currNote = trebleNotes[j];
        const nextNote = trebleNotes[j + 1];

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
    } else if (isBass && isAutoGeneratedBass) {
      // Only auto-generated bass notes are blue
      // Chord notes remain black
      fillStyle = BASS_COLOR;
      strokeStyle = '#2563EB'; // Darker blue for stroke
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
  const sharpKeys = ['G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
  const flatKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

  const normalized = getVexFlowKeySignature(key).replace('m', '');

  let sharpIndex = sharpKeys.indexOf(normalized);
  if (sharpIndex !== -1) return sharpIndex + 1;

  let flatIndex = flatKeys.indexOf(normalized);
  if (flatIndex !== -1) return flatIndex + 1;

  return 0;
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
    // Multi-voice rest display options
    restDisplayMode = 'clean',      // 'clean' (smart omission) or 'explicit' (show all)
    cueRestsForSecondaryVoice = true, // Use smaller rests for voice 2
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

  // Set barlines
  if (showBarlines) {
    if (isLastInSystem) {
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
  let hasMultipleVoices = secondaryTrebleVoiceNotes.length > 0;

  // Track if we swapped voices (for correct voiceIndex in regions)
  let primaryVoiceIndex = 0;
  let secondaryVoiceIndex = 1;

  // If only voice 2 has notes, treat it as the primary voice to keep rendering stable
  // BUT preserve the original voiceIndex for click region tracking
  if (primaryTrebleVoiceNotes.length === 0 && secondaryTrebleVoiceNotes.length > 0) {
    primaryTrebleVoiceNotes = secondaryTrebleVoiceNotes;
    primaryVoiceIndex = 1;  // These notes are actually from voice 1
    secondaryTrebleVoiceNotes = [];
    hasMultipleVoices = false;
  }

  // Stem direction: only set explicit directions when multiple voices are present
  // Single voice: let VexFlow use auto-stemming (based on pitch position)
  // Multiple voices: voice 0 = up (1), voice 1 = down (-1)

  // Apply smart rest visibility for multi-voice notation
  if (hasMultipleVoices) {
    // Fill gaps with rests so smart rest analysis has rests to analyze
    // Pass voiceIndex so auto-generated rests are properly tagged
    primaryTrebleVoiceNotes = fillGapsWithRests(primaryTrebleVoiceNotes, timeSignature, 'treble', primaryVoiceIndex);
    secondaryTrebleVoiceNotes = fillGapsWithRests(secondaryTrebleVoiceNotes, timeSignature, 'treble', secondaryVoiceIndex);

    const { primaryRestVisibility, secondaryRestVisibility } = analyzeRestVisibility(
      primaryTrebleVoiceNotes,
      secondaryTrebleVoiceNotes,
      { restDisplayMode, cueRestsForSecondaryVoice }
    );
    applyRestVisibility(primaryTrebleVoiceNotes, primaryRestVisibility);
    applyRestVisibility(secondaryTrebleVoiceNotes, secondaryRestVisibility);
  }

  // Create notes for voice 0 (primary voice)
  // Only pass stemDirection when we have multiple voices
  const trebleResult = hasMultipleVoices
    ? createNotesForStaff(primaryTrebleVoiceNotes, keySignature, 'treble', timeSignature, {
        stemDirection: VOICE_STEM_DIRECTIONS.primary,
        voiceIndex: 0,
      })
    : createNotesForStaff(primaryTrebleVoiceNotes, keySignature, 'treble', timeSignature); // No options = auto stems
  const vexTrebleNotes = trebleResult.notes;
  const trebleOttavaBrackets = trebleResult.ottavaBrackets;
  const trebleTies = trebleResult.ties;
  const trebleTupletGroups = trebleResult.tupletGroups;
  const trebleBeams = generateBeamsWithTuplets(vexTrebleNotes, trebleTupletGroups);

  // Create notes for voice 1 (secondary voice) if present
  let vexTrebleNotes2 = [];
  let trebleBeams2 = [];
  let trebleTupletGroups2 = {};
  if (hasMultipleVoices) {
    const trebleResult2 = createNotesForStaff(secondaryTrebleVoiceNotes, keySignature, 'treble', timeSignature, {
      stemDirection: VOICE_STEM_DIRECTIONS.secondary,
      voiceIndex: 1,
    });
    vexTrebleNotes2 = trebleResult2.notes;
    trebleTupletGroups2 = trebleResult2.tupletGroups;
    trebleBeams2 = generateBeamsWithTuplets(vexTrebleNotes2, trebleTupletGroups2);
  }

  // Render bass notes - MULTI-VOICE SUPPORT (same pattern as treble)
  // Separate notes by voice index
  let primaryBassVoiceNotes = bassNotes.filter(n => (n.voiceIndex || 0) === 0);
  let secondaryBassVoiceNotes = bassNotes.filter(n => n.voiceIndex === 1);
  let hasBassMultipleVoices = secondaryBassVoiceNotes.length > 0;

  // Track if we swapped voices (for correct voiceIndex in regions)
  let primaryBassVoiceIndex = 0;
  let secondaryBassVoiceIndex = 1;

  // If only voice 2 has notes, treat it as the primary voice to keep rendering stable
  if (primaryBassVoiceNotes.length === 0 && secondaryBassVoiceNotes.length > 0) {
    primaryBassVoiceNotes = secondaryBassVoiceNotes;
    primaryBassVoiceIndex = 1;
    secondaryBassVoiceNotes = [];
    hasBassMultipleVoices = false;
  }

  // Apply smart rest visibility for multi-voice bass notation
  if (hasBassMultipleVoices) {
    // Fill gaps with rests so smart rest analysis has rests to analyze
    // Pass voiceIndex so auto-generated rests are properly tagged
    primaryBassVoiceNotes = fillGapsWithRests(primaryBassVoiceNotes, timeSignature, 'bass', primaryBassVoiceIndex);
    secondaryBassVoiceNotes = fillGapsWithRests(secondaryBassVoiceNotes, timeSignature, 'bass', secondaryBassVoiceIndex);

    const { primaryRestVisibility, secondaryRestVisibility } = analyzeRestVisibility(
      primaryBassVoiceNotes,
      secondaryBassVoiceNotes,
      { restDisplayMode, cueRestsForSecondaryVoice }
    );
    applyRestVisibility(primaryBassVoiceNotes, primaryRestVisibility);
    applyRestVisibility(secondaryBassVoiceNotes, secondaryRestVisibility);
  }

  // Create notes for bass voice 0 (primary voice)
  const bassResult = hasBassMultipleVoices
    ? createNotesForStaff(primaryBassVoiceNotes, keySignature, 'bass', timeSignature, {
        stemDirection: VOICE_STEM_DIRECTIONS.primary,
        voiceIndex: 0,
      })
    : createNotesForStaff(primaryBassVoiceNotes, keySignature, 'bass', timeSignature);
  const vexBassNotes = bassResult.notes;
  const bassOttavaBrackets = bassResult.ottavaBrackets;
  const bassTies = bassResult.ties;
  const bassTupletGroups = bassResult.tupletGroups;
  const bassBeams = generateBeamsWithTuplets(vexBassNotes, bassTupletGroups);

  // Create notes for bass voice 1 (secondary voice) if present
  let vexBassNotes2 = [];
  let bassBeams2 = [];
  let bassTupletGroups2 = {};
  if (hasBassMultipleVoices) {
    const bassResult2 = createNotesForStaff(secondaryBassVoiceNotes, keySignature, 'bass', timeSignature, {
      stemDirection: VOICE_STEM_DIRECTIONS.secondary,
      voiceIndex: 1,
    });
    vexBassNotes2 = bassResult2.notes;
    bassTupletGroups2 = bassResult2.tupletGroups;
    bassBeams2 = generateBeamsWithTuplets(vexBassNotes2, bassTupletGroups2);
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

  if (hasMultipleVoices && vexTrebleNotes2.length > 0) {
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

  if (hasBassMultipleVoices && vexBassNotes2.length > 0) {
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
  const getDurationInBeats = (durationStr) => {
    if (!durationStr) return 1;
    // Handle dotted notation with 'd' suffix (e.g., 'hd', 'qd', '8d')
    const baseDuration = durationStr.replace(/[dn.]/g, '');
    const isDotted = durationStr.includes('d') || durationStr.includes('.');
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
      const duration = getDurationInBeats(note.duration);
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
  if (hasMultipleVoices && vexTrebleNotes2.length > 0) {
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
  if (hasBassMultipleVoices && vexBassNotes2.length > 0) {
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
  if (hasMultipleVoices && alignedTrebleNotes2.length > 0) {
    alignedTrebleVoice2 = createVoice(alignedTrebleNotes2, voiceOptions);
  }

  // Create second bass voice if we have multi-voice content (already aligned)
  let alignedBassVoice2 = null;
  if (hasBassMultipleVoices && alignedBassNotes2.length > 0) {
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
    const staveWidth = width - trebleStave.getNoteStartX() + x - endPadding;

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
  if (hasMultipleVoices) {
    drawBeams(context, trebleBeams2);
  }
  drawBeams(context, bassBeams);
  if (hasBassMultipleVoices) {
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
  if (hasMultipleVoices) {
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
  if (hasBassMultipleVoices) {
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
        const boundingBox = vexNote.getBoundingBox();
        const noteData = sourceNotes[noteIdx];

        if (boundingBox && noteData) {

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
            noteHeadPositions, // Array of {x, y} for each note head
            bounds: {
              x: boundingBox.getX() - 4,
              y: boundingBox.getY() - 4,
              width: boundingBox.getW() + 8,
              height: boundingBox.getH() + 8,
            },
          });
        }
      } catch (e) {
        // Ignore bounding box errors but keep rendering going
      }
    });
  };

  appendTrebleRegions(vexTrebleNotes, primaryTrebleVoiceNotes, primaryVoiceIndex);
  if (hasMultipleVoices && vexTrebleNotes2.length > 0) {
    appendTrebleRegions(vexTrebleNotes2, secondaryTrebleVoiceNotes, secondaryVoiceIndex);
  }

  // Collect bass note regions - MULTI-VOICE SUPPORT (same pattern as treble)
  const appendBassRegions = (vexNotes, sourceNotes, voiceIndex) => {
    vexNotes.forEach((vexNote, noteIdx) => {
      try {
        const boundingBox = vexNote.getBoundingBox();
        if (boundingBox && sourceNotes[noteIdx]) {
          const noteData = sourceNotes[noteIdx];

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
            noteHeadPositions, // Array of {x, y} for each note head
            bounds: {
              x: boundingBox.getX() - 4,
              y: boundingBox.getY() - 4,
              width: boundingBox.getW() + 8,
              height: boundingBox.getH() + 8,
            },
          });
        }
      } catch (e) {
        // Ignore bounding box errors
      }
    });
  };

  appendBassRegions(vexBassNotes, primaryBassVoiceNotes, primaryBassVoiceIndex);
  if (hasBassMultipleVoices && vexBassNotes2.length > 0) {
    appendBassRegions(vexBassNotes2, secondaryBassVoiceNotes, secondaryBassVoiceIndex);
  }

  // Draw chord symbol if present in measure data AND this is the start of a building block
  // Chord symbols should only appear at the beginning of each building block (chord segment)
  if (measureData.metadata && measureData.metadata.chordSymbol && isBlockStart) {
    const chordSymbol = measureData.metadata.chordSymbol;
    // Position at beginning of measure (with small left padding)
    const chordX = x + 5;
    // Position 30px above treble staff, but never go below y=15 to stay on canvas
    const chordY = Math.max(15, trebleY - 30);

    // Use VexFlow's CanvasContext methods for text rendering
    // Standard notation style: black, serif font, moderate size
    const VF = getVF();
    if (VF && context) {
      context.save();
      context.setFont('Times New Roman, serif', 14, 'normal');
      context.setFillStyle('#000000'); // Black (standard for chord symbols)
      context.fillText(chordSymbol, chordX, chordY);
      context.restore();
    }
  }

  // Draw incomplete measure indicator if beats don't add up
  // Parse time signature to get expected beats per measure
  const [timeSigNum] = timeSignature.split('/').map(Number);
  const beatsPerMeasure = timeSigNum || 4;

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
    trebleOttavaBrackets,
    bassOttavaBrackets,
    noteRegions,
    hasMultipleVoices, // Flag indicating if multi-voice is active
  };
}

/**
 * Apply ottava adjustment to notes for comfortable display in clef
 * Notes too high get 8va (shift down for display), notes too low get 8vb (shift up for display)
 * @param {Array} pitches - Array of pitch strings
 * @param {string} clef - 'treble' or 'bass'
 * @returns {Object} - { adjustedPitches, ottavaLabel, ottavaShift }
 */
function applyOttavaAdjustment(pitches, clef) {
  if (!pitches || pitches.length === 0) {
    return { adjustedPitches: pitches, ottavaLabel: null, ottavaShift: 0 };
  }

  const range = CLEF_RANGES[clef];

  // Check if any notes need adjustment
  let needsShiftDown = false;  // 8va - notes too high
  let needsShiftUp = false;    // 8vb - notes too low

  for (const pitch of pitches) {
    const midi = noteToMidi(pitch);
    if (midi > range.max) {
      needsShiftDown = true;
    } else if (midi < range.min) {
      needsShiftUp = true;
    }
  }

  // If conflicting needs, prioritize based on average pitch
  if (needsShiftDown && needsShiftUp) {
    const avgMidi = pitches.reduce((sum, p) => sum + noteToMidi(p), 0) / pitches.length;
    const midRange = (range.min + range.max) / 2;
    if (avgMidi > midRange) {
      needsShiftUp = false;  // More notes are high
    } else {
      needsShiftDown = false;  // More notes are low
    }
  }

  if (needsShiftDown) {
    // Shift all notes down one octave for display, mark with 8va
    const adjustedPitches = pitches.map(pitch => applyOctaveShift(pitch, -1));
    return { adjustedPitches, ottavaLabel: '8va', ottavaShift: -1 };
  } else if (needsShiftUp) {
    // Shift all notes up one octave for display, mark with 8vb
    const adjustedPitches = pitches.map(pitch => applyOctaveShift(pitch, 1));
    return { adjustedPitches, ottavaLabel: '8vb', ottavaShift: 1 };
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
      const restDisplayOptions = {};
      if (note._restDisplay) {
        restDisplayOptions.hidden = note._restDisplay.hidden || false;
        restDisplayOptions.isCue = note._restDisplay.isCue || false;
      }

      const restNote = createRest(note.duration || '4n', clef, restDisplayOptions);
      if (!restNote) {
        console.warn('[createNotesForStaff] createRest returned null for note:', JSON.stringify(note));
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
      const chordNote = createChordNote(adjustedPitches, note.duration || '4n', keySignature, clef, note.dotted || false, note.articulation || null, measureAccidentals, stemDirection);
      if (!chordNote) {
        console.warn('[createNotesForStaff] createChordNote returned null for note:', JSON.stringify(note), 'adjustedPitches:', adjustedPitches);
        continue;
      }

      // Preserve isTied property for cross-measure tie rendering
      if (note.isTied !== undefined) {
        chordNote.isTied = note.isTied;
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
    enableHarmonicColoring = false, // Enable chord tone coloring
    showChordSpans = true,       // Show chord span shading and brackets
    // Multi-voice rest display options
    restDisplayMode = 'clean',      // 'clean' (smart omission) or 'explicit' (show all)
    cueRestsForSecondaryVoice = true, // Use smaller rests for secondary voice
    // Multi-page support: offset for global measure index (0-based)
    globalMeasureOffset = 0,     // First measure's global index (for page 2, this would be 8)
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

  // Helper function to draw measure highlights
  function drawMeasureHighlight(measureIndex, color, isBorder = false) {
    const systemIndex = Math.floor(measureIndex / measuresPerLine);
    const measureInSystem = measureIndex % measuresPerLine;
    const isFirstInSystem = measureInSystem === 0;

    const x = dimensions.braceWidth + (measureInSystem * measureWidth) +
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

  // Draw partial measure highlight for chord spans that don't align with measure boundaries
  // startBeat and endBeat are absolute beat positions from the beginning of the piece
  function drawChordSpanHighlight(startBeat, endBeat, color) {
    const beatsPerMeasure = timeSignature.num || timeSignature.numerator || 4;

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
      const h = dimensions.systemHeight - GRAND_STAFF_DEFAULTS.systemMarginTop - GRAND_STAFF_DEFAULTS.systemMarginBottom;

      // Calculate horizontal position and width within this measure
      let x, w;

      if (m === startMeasure && m === endMeasure) {
        // Chord starts and ends in same measure
        const startFraction = startBeatInMeasure / beatsPerMeasure;
        const endFraction = endBeatInMeasure / beatsPerMeasure;
        x = measureX + (fullWidth * startFraction);
        w = fullWidth * (endFraction - startFraction);
      } else if (m === startMeasure) {
        // First measure of span - from startBeat to end of measure
        const startFraction = startBeatInMeasure / beatsPerMeasure;
        x = measureX + (fullWidth * startFraction);
        w = fullWidth * (1 - startFraction);
      } else if (m === endMeasure) {
        // Last measure of span - from start of measure to endBeat
        // If endBeatInMeasure is 0, it means the chord ends exactly at the start of this measure,
        // so we shouldn't draw anything in this measure (the previous measure was the last)
        const endFraction = endBeatInMeasure === 0 ? 0 : endBeatInMeasure / beatsPerMeasure;
        // For first measure in system, beats start after the clef/key/time signature
        // So we need to offset x and adjust the width calculation
        if (isFirstInSystem) {
          x = measureX + dimensions.firstMeasureExtra;
          w = measureWidth * endFraction;
        } else {
          x = measureX;
          w = fullWidth * endFraction;
        }
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
    const beatsPerMeasure = timeSignature.num || timeSignature.numerator || 4;

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

      // Calculate x position and width for this measure segment
      let segmentX, segmentW;

      if (m === startMeasure && m === endMeasure) {
        const startFraction = startBeatInMeasure / beatsPerMeasure;
        const endFraction = endBeatInMeasure / beatsPerMeasure;
        segmentX = measureX + (fullWidth * startFraction);
        segmentW = fullWidth * (endFraction - startFraction);
      } else if (m === startMeasure) {
        const startFraction = startBeatInMeasure / beatsPerMeasure;
        segmentX = measureX + (fullWidth * startFraction);
        segmentW = fullWidth * (1 - startFraction);
      } else if (m === endMeasure) {
        // If endBeatInMeasure is 0, chord ends exactly at start of this measure
        const endFraction = endBeatInMeasure === 0 ? 0 : endBeatInMeasure / beatsPerMeasure;
        // For first measure in system, beats start after the clef/key/time signature
        if (isFirstInSystem) {
          segmentX = measureX + dimensions.firstMeasureExtra;
          segmentW = measureWidth * endFraction;
        } else {
          segmentX = measureX;
          segmentW = fullWidth * endFraction;
        }
      } else {
        segmentX = measureX;
        segmentW = fullWidth;
      }

      // Start new span if we're on a new system
      if (systemIndex !== currentSystem) {
        if (currentSpan) {
          systemSpans.push(currentSpan);
        }
        currentSystem = systemIndex;
        currentSpan = {
          systemIndex,
          startX: segmentX,
          endX: segmentX + segmentW,
          width: segmentW
        };
      } else {
        // Extend current span
        currentSpan.endX = segmentX + segmentW;
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

      if (context.svg) {
        // SVG rendering
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'chord-bracket-group');

        // Horizontal line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', span.startX);
        line.setAttribute('y1', bracketY);
        line.setAttribute('x2', span.endX);
        line.setAttribute('y2', bracketY);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '2');
        group.appendChild(line);

        // Left vertical tick
        const leftTick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        leftTick.setAttribute('x1', span.startX);
        leftTick.setAttribute('y1', bracketY - bracketHeight / 2);
        leftTick.setAttribute('x2', span.startX);
        leftTick.setAttribute('y2', bracketY + bracketHeight / 2);
        leftTick.setAttribute('stroke', color);
        leftTick.setAttribute('stroke-width', '2');
        group.appendChild(leftTick);

        // Right vertical tick
        const rightTick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        rightTick.setAttribute('x1', span.endX);
        rightTick.setAttribute('y1', bracketY - bracketHeight / 2);
        rightTick.setAttribute('x2', span.endX);
        rightTick.setAttribute('y2', bracketY + bracketHeight / 2);
        rightTick.setAttribute('stroke', color);
        rightTick.setAttribute('stroke-width', '2');
        group.appendChild(rightTick);

        // Chord name text (only on the first span or if it's the only span)
        if (index === 0) {
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          const textX = span.startX + (span.width / 2);
          const textY = bracketY + 25;
          text.setAttribute('x', textX);
          text.setAttribute('y', textY);
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('font-family', 'Arial, sans-serif');
          text.setAttribute('font-size', '13');
          text.setAttribute('font-weight', 'bold');
          text.setAttribute('fill', '#333');
          text.textContent = chordName;
          group.appendChild(text);

          // Register click region for the chord bracket label
          if (chordData && chordIndex >= 0) {
            // Estimate text width based on character count (approximate)
            const estimatedTextWidth = chordName.length * 8;
            chordBracketRegions.push({
              type: 'chordBracket',
              x: textX - estimatedTextWidth / 2 - 5,
              y: textY - 15,
              width: estimatedTextWidth + 10,
              height: 25,
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
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

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
          ctx.font = 'bold 13px Arial, sans-serif';
          ctx.fillStyle = '#333';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const textX = span.startX + (span.width / 2);
          const textY = bracketY + 5;
          ctx.fillText(chordName, textX, textY);

          // Register click region for the chord bracket label
          if (chordData && chordIndex >= 0) {
            // Estimate text width based on character count (approximate)
            const estimatedTextWidth = chordName.length * 8;
            chordBracketRegions.push({
              type: 'chordBracket',
              x: textX - estimatedTextWidth / 2 - 5,
              y: textY - 5,
              width: estimatedTextWidth + 10,
              height: 25,
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

  // Draw chord span shading and brackets - alternating colors for consecutive chords
  // Uses beat-based positioning to show exact horizontal spans, even within measures
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
          // Format chord name with inversion using helper function
          let chordName = formatChordNameForDisplay(chord);

          // Add inversion indicator only for non-root inversions
          const inversion = chord.inversion || 0;
          if (inversion === 1) {
            chordName += ' (1st)';
          } else if (inversion === 2) {
            chordName += ' (2nd)';
          } else if (inversion === 3) {
            chordName += ' (3rd)';
          }

          // Add edited indicator
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
            // Format chord name using helper function
            let chordName = formatChordNameForDisplay(chord);

            // Add inversion indicator only for non-root inversions
            const inversion = chord.inversion || 0;
            if (inversion === 1) {
              chordName += ' (1st)';
            } else if (inversion === 2) {
              chordName += ' (2nd)';
            } else if (inversion === 3) {
              chordName += ' (3rd)';
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

  // Build set of building block start measures for chord symbol placement
  // Chord symbols should only appear at the START of each building block (chord segment)
  const buildingBlockStartMeasures = new Set();
  const beatsPerMeasure = parseInt(timeSignature.split('/')[0]) || 4;

  if (window.getCompositionState) {
    const compositionState = window.getCompositionState();
    const segments = compositionState?.getChordSegments?.() || [];

    segments.forEach(segment => {
      // Calculate the measure index where this building block starts
      const startMeasure = Math.floor(segment.startBeat / beatsPerMeasure);
      buildingBlockStartMeasures.add(startMeasure);
    });
  }

  // If no segments found, fall back to showing chord symbol on every measure
  const hasSegments = buildingBlockStartMeasures.size > 0;

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
      // Multi-voice rest display options
      restDisplayMode,
      cueRestsForSecondaryVoice,
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

    // Helper to get the highest pitched note's line (largest line number for 8va bass notes)
    function getHighestPitchLine(note) {
      try {
        const keyProps = note.getKeyProps();
        if (keyProps && keyProps.length > 0) {
          // For bass clef 8va notes, highest pitch = largest line number
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

    // Helper to get the lowest pitched note's line (smallest line number for 8vb bass notes)
    function getLowestPitchLine(note) {
      try {
        const keyProps = note.getKeyProps();
        if (keyProps && keyProps.length > 0) {
          // For bass clef 8vb notes, lowest pitch = smallest line number
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

    // Process bass clef brackets (where chord progressions are)
    let currentBassOttava = null;
    let bassOttavaStart = null;
    let bassOttavaEnd = null;
    let bassHighestPitchLine = -Infinity; // Track highest pitched note (largest line number for 8va)
    let bassLowestPitchLine = Infinity; // Track lowest pitched note (smallest line number for 8vb)

    for (let i = 0; i < renderedMeasures.length; i++) {
      const measure = renderedMeasures[i];
      const bassNotes = measure.bassNotes;
      const brackets = measure.bassOttavaBrackets;

      // Check if this measure has ottava (for chord progressions, may have multiple notes per measure)
      const hasOttava = brackets && brackets.length > 0;
      // Get the first bracket's label and indices (for measures with multiple notes)
      const firstBracket = hasOttava ? brackets[0] : null;
      const lastBracket = hasOttava ? brackets[brackets.length - 1] : null;
      const ottavaLabel = firstBracket ? firstBracket.label : null;
      const bracketStartIndex = firstBracket ? firstBracket.startIndex : 0;
      const bracketEndIndex = lastBracket ? lastBracket.endIndex : 0;

      if (ottavaLabel) {
        // Get the actual notes at the bracket indices
        const startNote = bassNotes[bracketStartIndex] || bassNotes[0];
        const endNote = bassNotes[bracketEndIndex] || bassNotes[bassNotes.length - 1];

        if (currentBassOttava === ottavaLabel) {
          // Continue the bracket - use the end note index from this measure's bracket
          bassOttavaEnd = { measure: i, noteIndex: bracketEndIndex, note: endNote };
          // Update extreme note positions for all notes in the bracket
          for (let ni = bracketStartIndex; ni <= bracketEndIndex && ni < bassNotes.length; ni++) {
            const highPitchLine = getHighestPitchLine(bassNotes[ni]);
            const lowPitchLine = getLowestPitchLine(bassNotes[ni]);
            if (highPitchLine > bassHighestPitchLine) bassHighestPitchLine = highPitchLine;
            if (lowPitchLine < bassLowestPitchLine) bassLowestPitchLine = lowPitchLine;
          }
        } else {
          // Draw previous bracket if exists
          if (currentBassOttava && bassOttavaStart && bassOttavaEnd) {
            try {
              const is8va = currentBassOttava === '8va';
              // Use TOP position for 8va (above notes), BOTTOM position for 8vb (below notes)
              const position = is8va ? TOP_POSITION : BOTTOM_POSITION;
              const textBracket = new VF.TextBracket({
                start: bassOttavaStart.note,
                stop: bassOttavaEnd.note,
                text: currentBassOttava,
                superscript: '',
                position: position,
              });
              // Position based on extreme note: for 8va, above highest; for 8vb, below lowest
              // For 8va (TOP): larger line number = higher pitch = more positive offset to push up
              // For 8vb (BOTTOM): smaller line number = lower pitch = more positive offset to push down
              // Bass clef: large positive line = high pitch, small/negative line = low pitch
              const lineOffset = is8va ? (bassHighestPitchLine - 5.0) : (3.5 - bassLowestPitchLine);
              textBracket.setLine(lineOffset);
              textBracket.setContext(context).draw();
            } catch (e) {
              console.warn('Error drawing ottava bracket:', e);
            }
          }
          // Start new bracket using the correct start index from this measure
          currentBassOttava = ottavaLabel;
          bassOttavaStart = { measure: i, noteIndex: bracketStartIndex, note: startNote };
          bassOttavaEnd = { measure: i, noteIndex: bracketEndIndex, note: endNote };
          // Calculate extreme positions for all notes in this bracket
          bassHighestPitchLine = -Infinity;
          bassLowestPitchLine = Infinity;
          for (let ni = bracketStartIndex; ni <= bracketEndIndex && ni < bassNotes.length; ni++) {
            const highPitchLine = getHighestPitchLine(bassNotes[ni]);
            const lowPitchLine = getLowestPitchLine(bassNotes[ni]);
            if (highPitchLine > bassHighestPitchLine) bassHighestPitchLine = highPitchLine;
            if (lowPitchLine < bassLowestPitchLine) bassLowestPitchLine = lowPitchLine;
          }
        }
      } else {
        // No ottava in this measure - draw any pending bracket
        if (currentBassOttava && bassOttavaStart && bassOttavaEnd) {
          try {
            const is8va = currentBassOttava === '8va';
            // Use TOP position for 8va (above notes), BOTTOM position for 8vb (below notes)
            const position = is8va ? TOP_POSITION : BOTTOM_POSITION;
            const textBracket = new VF.TextBracket({
              start: bassOttavaStart.note,
              stop: bassOttavaEnd.note,
              text: currentBassOttava,
              superscript: '',
              position: position,
            });
            // For 8va (TOP): larger line number = higher pitch = more positive offset to push up
            // For 8vb (BOTTOM): smaller line number = lower pitch = more positive offset to push down
            const lineOffset = is8va ? (bassHighestPitchLine - 5.0) : (3.5 - bassLowestPitchLine);
            textBracket.setLine(lineOffset);
            textBracket.setContext(context).draw();
          } catch (e) {
            console.warn('Error drawing ottava bracket:', e);
          }
        }
        currentBassOttava = null;
        bassOttavaStart = null;
        bassOttavaEnd = null;
        bassHighestPitchLine = -Infinity;
        bassLowestPitchLine = Infinity;
      }
    }

    // Draw final bracket if exists
    if (currentBassOttava && bassOttavaStart && bassOttavaEnd) {
      try {
        const is8va = currentBassOttava === '8va';
        // Use TOP position for 8va (above notes), BOTTOM position for 8vb (below notes)
        const position = is8va ? TOP_POSITION : BOTTOM_POSITION;
        const textBracket = new VF.TextBracket({
          start: bassOttavaStart.note,
          stop: bassOttavaEnd.note,
          text: currentBassOttava,
          superscript: '',
          position: position,
        });
        // For 8va (TOP): larger line number = higher pitch = more positive offset to push up
        // For 8vb (BOTTOM): smaller line number = lower pitch = more positive offset to push down
        const lineOffset = is8va ? (bassHighestPitchLine - 5.0) : (3.5 - bassLowestPitchLine);
        textBracket.setLine(lineOffset);
        textBracket.setContext(context).draw();
      } catch (e) {
        console.warn('Error drawing ottava bracket:', e);
      }
    }

    // Process treble clef brackets with dynamic positioning
    // Note: In treble clef, line numbers work opposite to bass clef:
    // - Small/negative line numbers = high pitch (above staff)
    // - Large positive line numbers = low pitch (below staff)
    let currentTrebleOttava = null;
    let trebleOttavaStart = null;
    let trebleOttavaEnd = null;
    let trebleHighestPitchLine = Infinity; // Track highest pitched note (smallest line number for 8va)
    let trebleLowestPitchLine = -Infinity; // Track lowest pitched note (largest line number for 8vb)

    for (let i = 0; i < renderedMeasures.length; i++) {
      const measure = renderedMeasures[i];
      const trebleNotes = measure.trebleNotes;
      const brackets = measure.trebleOttavaBrackets;

      const hasOttava = brackets && brackets.length > 0;
      const ottavaLabel = hasOttava ? brackets[0].label : null;

      // Find first and last note with this ottava label in the measure
      // The brackets array tracks startIndex/endIndex within the measure
      let firstOttavaNote = trebleNotes[0];
      let lastOttavaNote = trebleNotes[0];
      if (hasOttava && brackets[0]) {
        const bracket = brackets[0];
        if (bracket.startIndex !== undefined && trebleNotes[bracket.startIndex]) {
          firstOttavaNote = trebleNotes[bracket.startIndex];
        }
        if (bracket.endIndex !== undefined && trebleNotes[bracket.endIndex]) {
          lastOttavaNote = trebleNotes[bracket.endIndex];
        }
      }

      if (ottavaLabel) {
        if (currentTrebleOttava === ottavaLabel) {
          // Continue the bracket - use last note with ottava in this measure
          trebleOttavaEnd = { measure: i, noteIndex: brackets[0]?.endIndex || 0, note: lastOttavaNote };
          // Update extreme note positions for all notes in this measure's bracket
          for (let j = (brackets[0]?.startIndex || 0); j <= (brackets[0]?.endIndex || 0) && j < trebleNotes.length; j++) {
            const highPitchLine = getLowestPitchLine(trebleNotes[j]); // MIN = highest pitch in treble
            const lowPitchLine = getHighestPitchLine(trebleNotes[j]); // MAX = lowest pitch in treble
            if (highPitchLine < trebleHighestPitchLine) trebleHighestPitchLine = highPitchLine;
            if (lowPitchLine > trebleLowestPitchLine) trebleLowestPitchLine = lowPitchLine;
          }
        } else {
          // Draw previous bracket if exists
          if (currentTrebleOttava && trebleOttavaStart && trebleOttavaEnd) {
            try {
              const is8va = currentTrebleOttava === '8va';
              // Use TOP position for 8va (above notes), BOTTOM position for 8vb (below notes)
              const position = is8va ? TOP_POSITION : BOTTOM_POSITION;
              const textBracket = new VF.TextBracket({
                start: trebleOttavaStart.note,
                stop: trebleOttavaEnd.note,
                text: currentTrebleOttava,
                superscript: '',
                position: position,
              });
              // For treble clef: smaller line = higher pitch, larger line = lower pitch
              // 8va (TOP): smaller line needs larger positive offset to push bracket higher
              // 8vb (BOTTOM): larger line needs positive offset to push bracket lower
              const lineOffset = is8va ? (8.0 - trebleHighestPitchLine) : (trebleLowestPitchLine - 3.5);
              textBracket.setLine(lineOffset);
              textBracket.setContext(context).draw();
            } catch (e) {
              console.warn('Error drawing ottava bracket:', e);
            }
          }
          // Start new bracket - use first note with ottava in this measure
          currentTrebleOttava = ottavaLabel;
          trebleOttavaStart = { measure: i, noteIndex: brackets[0]?.startIndex || 0, note: firstOttavaNote };
          trebleOttavaEnd = { measure: i, noteIndex: brackets[0]?.endIndex || 0, note: lastOttavaNote };
          // Update extreme positions for all notes in the bracket
          trebleHighestPitchLine = Infinity;
          trebleLowestPitchLine = -Infinity;
          for (let j = (brackets[0]?.startIndex || 0); j <= (brackets[0]?.endIndex || 0) && j < trebleNotes.length; j++) {
            const highPitchLine = getLowestPitchLine(trebleNotes[j]); // MIN = highest pitch in treble
            const lowPitchLine = getHighestPitchLine(trebleNotes[j]); // MAX = lowest pitch in treble
            if (highPitchLine < trebleHighestPitchLine) trebleHighestPitchLine = highPitchLine;
            if (lowPitchLine > trebleLowestPitchLine) trebleLowestPitchLine = lowPitchLine;
          }
        }
      } else {
        // No ottava in this measure - draw any pending bracket
        if (currentTrebleOttava && trebleOttavaStart && trebleOttavaEnd) {
          try {
            const is8va = currentTrebleOttava === '8va';
            // Use TOP position for 8va (above notes), BOTTOM position for 8vb (below notes)
            const position = is8va ? TOP_POSITION : BOTTOM_POSITION;
            const textBracket = new VF.TextBracket({
              start: trebleOttavaStart.note,
              stop: trebleOttavaEnd.note,
              text: currentTrebleOttava,
              superscript: '',
              position: position,
            });
            // For treble clef: smaller line = higher pitch, larger line = lower pitch
            // 8va (TOP): smaller line needs larger positive offset to push bracket higher
            // 8vb (BOTTOM): larger line needs positive offset to push bracket lower
            const lineOffset = is8va ? (8.0 - trebleHighestPitchLine) : (trebleLowestPitchLine - 3.5);
            textBracket.setLine(lineOffset);
            textBracket.setContext(context).draw();
          } catch (e) {
            console.warn('Error drawing ottava bracket:', e);
          }
        }
        currentTrebleOttava = null;
        trebleOttavaStart = null;
        trebleOttavaEnd = null;
        trebleHighestPitchLine = Infinity;
        trebleLowestPitchLine = -Infinity;
      }
    }

    // Draw final treble bracket if exists
    if (currentTrebleOttava && trebleOttavaStart && trebleOttavaEnd) {
      try {
        const is8va = currentTrebleOttava === '8va';
        // Use TOP position for 8va (above notes), BOTTOM position for 8vb (below notes)
        const position = is8va ? TOP_POSITION : BOTTOM_POSITION;
        const textBracket = new VF.TextBracket({
          start: trebleOttavaStart.note,
          stop: trebleOttavaEnd.note,
          text: currentTrebleOttava,
          superscript: '',
          position: position,
        });
        // For treble clef: smaller line = higher pitch, larger line = lower pitch
        // 8va (TOP): smaller line needs larger positive offset to push bracket higher
        // 8vb (BOTTOM): larger line needs positive offset to push bracket lower
        const lineOffset = is8va ? (8.0 - trebleHighestPitchLine) : (trebleLowestPitchLine - 3.5);
        textBracket.setLine(lineOffset);
        textBracket.setContext(context).draw();
      } catch (e) {
        console.warn('Error drawing ottava bracket:', e);
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
  console.log('[renderGrandStaffSystem] Checking for ties across', renderedMeasures.length, 'measures');
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
    chordBracketRegions,  // Click regions for chord bracket labels
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
          // For non-rests, require valid pitch
          const pitch = note.pitch || note;
          if (pitch && typeof pitch === 'string' && pitch.match(/^[A-G][#b]?\d+$/)) return true;
          // Filter out notes with null/undefined pitch
          return false;
        })
        .map(note => ({
          pitch: note.pitch || note,
          duration: note.duration || '4n',
          isRest: note.isRest || false,
          tuplet: note.tuplet || null,
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
            // For non-rests, require valid pitch
            const pitch = note.pitch || note;
            if (pitch && typeof pitch === 'string' && pitch.match(/^[A-G][#b]?\d+$/)) return true;
            // Filter out notes with null/undefined pitch
            return false;
          })
          .map(note => ({
            pitch: note.pitch || note,
            duration: note.duration || '1n',
            isRest: note.isRest || false,
            tuplet: note.tuplet || null,
          }));
      } else {
        // Single bass note - validate before adding
        const pitch = bassNotes[i];
        if (pitch && typeof pitch === 'string' && pitch.match(/^[A-G][#b]?\d+$/)) {
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
