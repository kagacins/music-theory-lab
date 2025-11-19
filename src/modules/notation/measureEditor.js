/**
 * Measure Editor - Measure-level data operations
 * Part of the Phase 4.4 VexFlow Professional Notation enhancement
 *
 * This module handles creating, editing, and managing measure data
 * including notes, rests, chords, and timing calculations.
 */

import {
  getDurationBeats,
  TONE_DURATION_BEATS,
  noteToMidi,
  midiToNote,
} from './vexFlowRenderer.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default time signature
 */
export const DEFAULT_TIME_SIGNATURE = '4/4';

/**
 * Note data template
 */
export const NOTE_TEMPLATE = {
  pitch: null,       // Pitch string like "C4", null for rests
  duration: '4n',    // Tone.js duration
  isRest: false,     // Is this a rest?
  dotted: false,     // Is dotted?
  tied: false,       // Start of a tie?
  tiedTo: false,     // End of a tie?
  accidental: null,  // Explicit accidental: '#', 'b', 'n', null
  articulation: null, // 'staccato', 'accent', 'tenuto', etc.
  dynamic: null,     // 'pp', 'p', 'mp', 'mf', 'f', 'ff'
  voice: 1,          // Voice number (1 or 2)
};

/**
 * Measure data template
 */
export const MEASURE_TEMPLATE = {
  trebleNotes: [],   // Array of notes for treble clef
  bassNotes: [],     // Array of notes for bass clef
  timeSignature: '4/4',
  keySignature: 'C',
  chordSymbol: null, // Chord symbol to display above staff
  tempo: null,       // Tempo marking (null = inherit from previous)
  rehearsalMark: null, // Rehearsal letter/number
};

// ============================================================================
// MEASURE MANAGER CLASS
// ============================================================================

/**
 * Manages measure data and editing operations
 */
export class MeasureManager {
  constructor(options = {}) {
    this.measures = [];
    this.timeSignature = options.timeSignature || DEFAULT_TIME_SIGNATURE;
    this.keySignature = options.keySignature || 'C';
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoSteps = options.maxUndoSteps || 50;
    this.selection = {
      measureIndex: null,
      staff: null,
      noteIndex: null,
    };
  }

  /**
   * Get total number of measures
   * @returns {number}
   */
  getMeasureCount() {
    return this.measures.length;
  }

  /**
   * Get a measure by index
   * @param {number} index - Measure index
   * @returns {Object|null} - Measure data or null
   */
  getMeasure(index) {
    if (index < 0 || index >= this.measures.length) return null;
    return { ...this.measures[index] };
  }

  /**
   * Get all measures
   * @returns {Array} - Copy of all measures
   */
  getAllMeasures() {
    return this.measures.map(m => ({ ...m }));
  }

  /**
   * Set all measures (for loading)
   * @param {Array} measures - Array of measure data
   */
  setMeasures(measures) {
    this.saveState();
    this.measures = measures.map(m => this.normalizeMeasure(m));
  }

  /**
   * Add a new measure
   * @param {number} index - Index to insert at (default: end)
   * @param {Object} measureData - Optional measure data
   * @returns {number} - Index of new measure
   */
  addMeasure(index = null, measureData = {}) {
    this.saveState();

    const measure = this.normalizeMeasure({
      ...MEASURE_TEMPLATE,
      timeSignature: this.timeSignature,
      keySignature: this.keySignature,
      ...measureData,
    });

    if (index === null || index >= this.measures.length) {
      this.measures.push(measure);
      return this.measures.length - 1;
    } else {
      this.measures.splice(index, 0, measure);
      return index;
    }
  }

  /**
   * Remove a measure
   * @param {number} index - Measure index to remove
   * @returns {Object|null} - Removed measure or null
   */
  removeMeasure(index) {
    if (index < 0 || index >= this.measures.length) return null;

    this.saveState();
    return this.measures.splice(index, 1)[0];
  }

  /**
   * Normalize measure data to ensure all required fields
   * @param {Object} measure - Measure data
   * @returns {Object} - Normalized measure
   */
  normalizeMeasure(measure) {
    return {
      ...MEASURE_TEMPLATE,
      ...measure,
      trebleNotes: (measure.trebleNotes || []).map(n => this.normalizeNote(n)),
      bassNotes: (measure.bassNotes || []).map(n => this.normalizeNote(n)),
    };
  }

  /**
   * Normalize note data
   * @param {Object} note - Note data
   * @returns {Object} - Normalized note
   */
  normalizeNote(note) {
    if (typeof note === 'string') {
      // Simple pitch string
      return { ...NOTE_TEMPLATE, pitch: note };
    }

    // Handle chord notes with pitches array
    if (note.pitches && Array.isArray(note.pitches)) {
      // Chord - keep pitches array format
      return {
        ...NOTE_TEMPLATE,
        ...note,
        pitch: null, // Chords use pitches, not pitch
      };
    }

    return { ...NOTE_TEMPLATE, ...note };
  }

  // ============================================================================
  // NOTE OPERATIONS
  // ============================================================================

  /**
   * Add a note to a measure
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {Object} noteData - Note data
   * @param {number} position - Beat position (or null for end)
   * @returns {boolean} - Success
   */
  addNote(measureIndex, staff, noteData, position = null) {
    const measure = this.measures[measureIndex];
    if (!measure) return false;

    this.saveState();

    const note = this.normalizeNote(noteData);
    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;

    if (position === null) {
      notes.push(note);
    } else {
      // Insert at specific beat position
      const insertIndex = this.findNoteIndexAtBeat(notes, position);
      notes.splice(insertIndex, 0, note);
    }

    return true;
  }

  /**
   * Add a rest to a measure
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {string} duration - Duration of rest
   * @param {number} position - Beat position (or null for end)
   * @returns {boolean} - Success
   */
  addRest(measureIndex, staff, duration = '4n', position = null) {
    return this.addNote(measureIndex, staff, {
      isRest: true,
      duration,
    }, position);
  }

  /**
   * Remove a note from a measure
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note index
   * @returns {Object|null} - Removed note or null
   */
  removeNote(measureIndex, staff, noteIndex) {
    const measure = this.measures[measureIndex];
    if (!measure) return null;

    this.saveState();

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    if (noteIndex < 0 || noteIndex >= notes.length) return null;

    return notes.splice(noteIndex, 1)[0];
  }

  /**
   * Update a note in a measure
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note index
   * @param {Object} updates - Properties to update
   * @returns {boolean} - Success
   */
  updateNote(measureIndex, staff, noteIndex, updates) {
    const measure = this.measures[measureIndex];
    if (!measure) return false;

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    if (noteIndex < 0 || noteIndex >= notes.length) return false;

    this.saveState();

    notes[noteIndex] = { ...notes[noteIndex], ...updates };
    return true;
  }

  /**
   * Change pitch of a note (for drag operations)
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note index
   * @param {string} newPitch - New pitch
   * @returns {boolean} - Success
   */
  changePitch(measureIndex, staff, noteIndex, newPitch) {
    return this.updateNote(measureIndex, staff, noteIndex, { pitch: newPitch });
  }

  /**
   * Change duration of a note
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note index
   * @param {string} duration - New duration
   * @returns {boolean} - Success
   */
  changeDuration(measureIndex, staff, noteIndex, duration) {
    return this.updateNote(measureIndex, staff, noteIndex, { duration });
  }

  /**
   * Toggle dotted on a note
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note index
   * @returns {boolean} - Success
   */
  toggleDotted(measureIndex, staff, noteIndex) {
    const measure = this.measures[measureIndex];
    if (!measure) return false;

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    if (noteIndex < 0 || noteIndex >= notes.length) return false;

    return this.updateNote(measureIndex, staff, noteIndex, {
      dotted: !notes[noteIndex].dotted,
    });
  }

  /**
   * Set accidental on a note
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note index
   * @param {string|null} accidental - '#', 'b', 'n', or null
   * @returns {boolean} - Success
   */
  setAccidental(measureIndex, staff, noteIndex, accidental) {
    return this.updateNote(measureIndex, staff, noteIndex, { accidental });
  }

  // ============================================================================
  // CHORD OPERATIONS (Multiple simultaneous notes)
  // ============================================================================

  /**
   * Add notes as a chord (simultaneous notes)
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {Array} pitches - Array of pitch strings
   * @param {string} duration - Duration for all notes
   * @param {number} position - Beat position
   * @returns {boolean} - Success
   */
  addChord(measureIndex, staff, pitches, duration = '4n', position = null) {
    return this.addNote(measureIndex, staff, {
      pitches: pitches,
      duration,
    }, position);
  }

  /**
   * Add a pitch to an existing chord
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note/chord index
   * @param {string} pitch - Pitch to add
   * @returns {boolean} - Success
   */
  addPitchToChord(measureIndex, staff, noteIndex, pitch) {
    const measure = this.measures[measureIndex];
    if (!measure) return false;

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    if (noteIndex < 0 || noteIndex >= notes.length) return false;

    this.saveState();

    const note = notes[noteIndex];
    if (note.pitches) {
      // Already a chord
      note.pitches.push(pitch);
      note.pitches.sort((a, b) => noteToMidi(a) - noteToMidi(b));
    } else if (note.pitch) {
      // Convert single note to chord
      note.pitches = [note.pitch, pitch].sort((a, b) => noteToMidi(a) - noteToMidi(b));
      delete note.pitch;
    }

    return true;
  }

  /**
   * Remove a pitch from a chord
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note/chord index
   * @param {string} pitch - Pitch to remove
   * @returns {boolean} - Success
   */
  removePitchFromChord(measureIndex, staff, noteIndex, pitch) {
    const measure = this.measures[measureIndex];
    if (!measure) return false;

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    if (noteIndex < 0 || noteIndex >= notes.length) return false;

    const note = notes[noteIndex];
    if (!note.pitches) return false;

    this.saveState();

    const pitchIndex = note.pitches.indexOf(pitch);
    if (pitchIndex === -1) return false;

    note.pitches.splice(pitchIndex, 1);

    // Convert back to single note if only one pitch remains
    if (note.pitches.length === 1) {
      note.pitch = note.pitches[0];
      delete note.pitches;
    } else if (note.pitches.length === 0) {
      // Remove the note entirely
      return this.removeNote(measureIndex, staff, noteIndex) !== null;
    }

    return true;
  }

  // ============================================================================
  // TIMING AND BEAT CALCULATIONS
  // ============================================================================

  /**
   * Get beats per measure from time signature
   * @param {string} timeSignature - Time signature
   * @returns {number} - Beats per measure
   */
  getBeatsPerMeasure(timeSignature = null) {
    const ts = timeSignature || this.timeSignature;
    const [num, denom] = ts.split('/').map(Number);
    return num * (4 / denom);
  }

  /**
   * Calculate total beats of notes in a measure
   * @param {Array} notes - Array of notes
   * @returns {number} - Total beats
   */
  calculateTotalBeats(notes) {
    return notes.reduce((total, note) => {
      const beats = this.getNoteDuration(note);
      return total + beats;
    }, 0);
  }

  /**
   * Get duration of a note in beats
   * @param {Object} note - Note data
   * @returns {number} - Duration in beats
   */
  getNoteDuration(note) {
    let duration = TONE_DURATION_BEATS[note.duration] || 1;
    if (note.dotted) {
      duration *= 1.5;
    }
    return duration;
  }

  /**
   * Find note index at a specific beat position
   * @param {Array} notes - Array of notes
   * @param {number} beat - Beat position
   * @returns {number} - Note index
   */
  findNoteIndexAtBeat(notes, beat) {
    let currentBeat = 0;
    for (let i = 0; i < notes.length; i++) {
      const noteDuration = this.getNoteDuration(notes[i]);
      if (currentBeat + noteDuration > beat) {
        return i;
      }
      currentBeat += noteDuration;
    }
    return notes.length;
  }

  /**
   * Get beat position of a note
   * @param {Array} notes - Array of notes
   * @param {number} noteIndex - Note index
   * @returns {number} - Beat position
   */
  getNoteStartBeat(notes, noteIndex) {
    let beat = 0;
    for (let i = 0; i < noteIndex && i < notes.length; i++) {
      beat += this.getNoteDuration(notes[i]);
    }
    return beat;
  }

  /**
   * Validate measure timing (notes fit in measure)
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @returns {Object} - { valid, totalBeats, expectedBeats, difference }
   */
  validateTiming(measureIndex, staff) {
    const measure = this.measures[measureIndex];
    if (!measure) return { valid: false, error: 'Invalid measure' };

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    const totalBeats = this.calculateTotalBeats(notes);
    const expectedBeats = this.getBeatsPerMeasure(measure.timeSignature);

    return {
      valid: Math.abs(totalBeats - expectedBeats) < 0.001,
      totalBeats,
      expectedBeats,
      difference: totalBeats - expectedBeats,
    };
  }

  /**
   * Auto-fill measure with rests to complete timing
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   */
  autoFillWithRests(measureIndex, staff) {
    const validation = this.validateTiming(measureIndex, staff);
    if (validation.valid || validation.difference >= 0) return;

    this.saveState();

    const measure = this.measures[measureIndex];
    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    let remainingBeats = -validation.difference;

    // Add rests to fill the gap
    const restDurations = [
      { beats: 4, duration: '1n' },
      { beats: 2, duration: '2n' },
      { beats: 1, duration: '4n' },
      { beats: 0.5, duration: '8n' },
      { beats: 0.25, duration: '16n' },
    ];

    while (remainingBeats > 0.001) {
      for (const rest of restDurations) {
        if (rest.beats <= remainingBeats) {
          notes.push(this.normalizeNote({
            isRest: true,
            duration: rest.duration,
          }));
          remainingBeats -= rest.beats;
          break;
        }
      }
    }
  }

  // ============================================================================
  // SELECTION
  // ============================================================================

  /**
   * Set selection
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass' or null
   * @param {number} noteIndex - Note index or null
   */
  setSelection(measureIndex, staff = null, noteIndex = null) {
    this.selection = { measureIndex, staff, noteIndex };
  }

  /**
   * Get current selection
   * @returns {Object} - { measureIndex, staff, noteIndex }
   */
  getSelection() {
    return { ...this.selection };
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this.selection = { measureIndex: null, staff: null, noteIndex: null };
  }

  /**
   * Get selected note
   * @returns {Object|null} - Selected note or null
   */
  getSelectedNote() {
    const { measureIndex, staff, noteIndex } = this.selection;
    if (measureIndex === null || staff === null || noteIndex === null) return null;

    const measure = this.measures[measureIndex];
    if (!measure) return null;

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    return notes[noteIndex] || null;
  }

  /**
   * Delete selected note
   * @returns {boolean} - Success
   */
  deleteSelected() {
    const { measureIndex, staff, noteIndex } = this.selection;
    if (measureIndex === null || staff === null || noteIndex === null) return false;

    const result = this.removeNote(measureIndex, staff, noteIndex);
    if (result) {
      this.clearSelection();
    }
    return result !== null;
  }

  // ============================================================================
  // UNDO/REDO
  // ============================================================================

  /**
   * Save current state to undo stack
   */
  saveState() {
    const state = JSON.stringify(this.measures);
    this.undoStack.push(state);

    // Limit undo stack size
    if (this.undoStack.length > this.maxUndoSteps) {
      this.undoStack.shift();
    }

    // Clear redo stack on new action
    this.redoStack = [];
  }

  /**
   * Undo last action
   * @returns {boolean} - Success
   */
  undo() {
    if (this.undoStack.length === 0) return false;

    // Save current state to redo stack
    this.redoStack.push(JSON.stringify(this.measures));

    // Restore previous state
    const previousState = this.undoStack.pop();
    this.measures = JSON.parse(previousState);

    return true;
  }

  /**
   * Redo last undone action
   * @returns {boolean} - Success
   */
  redo() {
    if (this.redoStack.length === 0) return false;

    // Save current state to undo stack
    this.undoStack.push(JSON.stringify(this.measures));

    // Restore next state
    const nextState = this.redoStack.pop();
    this.measures = JSON.parse(nextState);

    return true;
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  canRedo() {
    return this.redoStack.length > 0;
  }

  // ============================================================================
  // IMPORT/EXPORT
  // ============================================================================

  /**
   * Export measures to JSON
   * @returns {string} - JSON string
   */
  toJSON() {
    return JSON.stringify({
      measures: this.measures,
      timeSignature: this.timeSignature,
      keySignature: this.keySignature,
    });
  }

  /**
   * Import measures from JSON
   * @param {string} json - JSON string
   */
  fromJSON(json) {
    try {
      const data = JSON.parse(json);
      this.timeSignature = data.timeSignature || DEFAULT_TIME_SIGNATURE;
      this.keySignature = data.keySignature || 'C';
      this.setMeasures(data.measures || []);
    } catch (e) {
      console.error('Error parsing measure data:', e);
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  NOTE_TEMPLATE,
  MEASURE_TEMPLATE,
  DEFAULT_TIME_SIGNATURE,
  MeasureManager,
};
