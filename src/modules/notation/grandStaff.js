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
  getVexFlowKeySignature,
  noteToMidi,
  CLEF_RANGES,
} from './vexFlowRenderer.js';

// VexFlow is loaded globally
const VF = window.Vex ? window.Vex.Flow : null;

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
  systemMarginBottom: 20,      // Bottom margin
  braceWidth: 15,              // Width for the brace
  measurePadding: 10,          // Padding within measures
  clefWidth: 30,               // Width for clef
  keySignatureWidth: 20,       // Width per accidental in key signature
  timeSignatureWidth: 30,      // Width for time signature
};

/**
 * Staff connector types
 */
export const CONNECTOR_TYPES = {
  BRACE: VF ? VF.StaveConnector.type.BRACE : 1,
  SINGLE_LEFT: VF ? VF.StaveConnector.type.SINGLE_LEFT : 4,
  SINGLE_RIGHT: VF ? VF.StaveConnector.type.SINGLE_RIGHT : 0,
  BRACKET: VF ? VF.StaveConnector.type.BRACKET : 3,
};

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
  if (!VF) {
    console.error('VexFlow not loaded');
    return null;
  }

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

  // Render treble notes
  const vexTrebleNotes = createNotesForStaff(trebleNotes, keySignature, 'treble', timeSignature);
  const trebleBeams = generateBeams(vexTrebleNotes.filter(n => !n.isRest()));

  // Render bass notes
  const vexBassNotes = createNotesForStaff(bassNotes, keySignature, 'bass', timeSignature);
  const bassBeams = generateBeams(vexBassNotes.filter(n => !n.isRest()));

  // Create voices
  const [num, denom] = timeSignature.split('/');
  const voiceOptions = {
    numBeats: parseInt(num, 10),
    beatValue: parseInt(denom, 10),
  };

  const trebleVoice = createVoice(vexTrebleNotes, voiceOptions);
  const bassVoice = createVoice(vexBassNotes, voiceOptions);

  // Format and draw voices
  if (vexTrebleNotes.length > 0 && vexBassNotes.length > 0) {
    const formatter = new VF.Formatter();
    formatter.joinVoices([trebleVoice]);
    formatter.joinVoices([bassVoice]);

    const staveWidth = width - trebleStave.getNoteStartX() + x;
    formatter.format([trebleVoice, bassVoice], staveWidth);

    trebleVoice.draw(context, trebleStave);
    bassVoice.draw(context, bassStave);
  }

  // Draw beams
  drawBeams(context, trebleBeams);
  drawBeams(context, bassBeams);

  return {
    trebleStave,
    bassStave,
    connectors,
    trebleVoice,
    bassVoice,
  };
}

/**
 * Create VexFlow notes for a staff from note data
 * @param {Array} notes - Array of note data
 * @param {string} keySignature - Key signature
 * @param {string} clef - Clef type
 * @param {string} timeSignature - Time signature
 * @returns {Array} - Array of VexFlow StaveNotes
 */
function createNotesForStaff(notes, keySignature, clef, timeSignature) {
  if (!notes || notes.length === 0) {
    // Return a whole rest for empty measures
    return [createRest('1n', clef)];
  }

  const vexNotes = [];

  for (const note of notes) {
    if (note.isRest) {
      vexNotes.push(createRest(note.duration || '4n', clef));
    } else if (note.pitches && Array.isArray(note.pitches)) {
      // Chord
      vexNotes.push(createChordNote(note.pitches, note.duration || '4n', keySignature, clef));
    } else if (note.pitch) {
      // Single note
      vexNotes.push(createStaveNote(note, keySignature, clef));
    }
  }

  return vexNotes;
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
  if (!VF || !measures) {
    console.error('VexFlow not loaded or no measures provided');
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

    // Adjust width for first measure
    const width = isFirstInSystem
      ? measureWidth + dimensions.firstMeasureExtra
      : measureWidth;

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
    });

    if (result) {
      renderedMeasures.push({
        index: i,
        ...result,
        bounds: {
          x,
          y,
          width,
          height: dimensions.systemHeight - dimensions.systemMarginTop - dimensions.systemMarginBottom,
        },
      });
    }
  }

  return {
    renderer,
    context,
    dimensions,
    measures: renderedMeasures,
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
      measureData.trebleNotes = melodyByMeasure[i].map(note => ({
        pitch: note.pitch || note,
        duration: note.duration || '4n',
        isRest: note.isRest || false,
      }));
    }

    // Add bass notes or chord voicing to bass
    if (bassNotes[i]) {
      // If we have explicit bass notes
      if (Array.isArray(bassNotes[i])) {
        measureData.bassNotes = bassNotes[i].map(note => ({
          pitch: note.pitch || note,
          duration: note.duration || '1n',
          isRest: note.isRest || false,
        }));
      } else {
        measureData.bassNotes = [{
          pitch: bassNotes[i],
          duration: '1n',
        }];
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
  CONNECTOR_TYPES,

  // Dimension calculations
  calculateGrandStaffDimensions,

  // Rendering
  renderGrandStaffMeasure,
  renderGrandStaffSystem,

  // Data conversion
  convertToGrandStaffFormat,
};
