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
  // BEAT CALCULATION AND VALIDATION
  // ============================================================================

  /**
   * Calculate total beats used in a staff of a measure
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @returns {number} - Total beats used
   */
  getUsedBeats(measureIndex, staff) {
    const measure = this.measures[measureIndex];
    if (!measure) return 0;

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    let totalBeats = 0;

    for (const note of notes) {
      const beats = getDurationBeats(note.duration);
      totalBeats += note.dotted ? beats * 1.5 : beats;
    }

    return totalBeats;
  }

  /**
   * Calculate remaining beats available in a measure
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @returns {number} - Remaining beats
   */
  getRemainingBeats(measureIndex, staff) {
    const measure = this.measures[measureIndex];
    if (!measure) return 0;

    // Parse time signature (e.g., "4/4" -> 4 beats)
    const [numerator] = (measure.timeSignature || '4/4').split('/').map(Number);
    const maxBeats = numerator;

    const usedBeats = this.getUsedBeats(measureIndex, staff);
    return Math.max(0, maxBeats - usedBeats);
  }

  /**
   * Check if a note with given duration can fit in the measure
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {string} duration - Tone.js duration
   * @param {boolean} dotted - Is dotted?
   * @returns {boolean} - Can fit
   */
  canFitNote(measureIndex, staff, duration, dotted = false) {
    const remainingBeats = this.getRemainingBeats(measureIndex, staff);
    const beats = getDurationBeats(duration);
    const requiredBeats = dotted ? beats * 1.5 : beats;

    return requiredBeats <= remainingBeats;
  }

  /**
   * Insert a note before another note
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Index of note to insert before
   * @param {Object} noteData - Note data
   * @returns {boolean} - Success
   */
  insertNoteBefore(measureIndex, staff, noteIndex, noteData) {
    const measure = this.measures[measureIndex];
    if (!measure) return false;

    // Check if note will fit
    if (!this.canFitNote(measureIndex, staff, noteData.duration, noteData.dotted)) {
      console.warn('Note does not fit in measure');
      return false;
    }

    this.saveState();

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    const normalizedNote = this.normalizeNote(noteData);

    notes.splice(noteIndex, 0, normalizedNote);

    return true;
  }

  /**
   * Insert a note after another note
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Index of note to insert after
   * @param {Object} noteData - Note data
   * @returns {boolean} - Success
   */
  insertNoteAfter(measureIndex, staff, noteIndex, noteData) {
    return this.insertNoteBefore(measureIndex, staff, noteIndex + 1, noteData);
  }

  /**
   * Change the duration of an existing note
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note index
   * @param {string} newDuration - New Tone.js duration
   * @param {boolean} newDotted - New dotted state
   * @returns {boolean} - Success
   */
  changeNoteDuration(measureIndex, staff, noteIndex, newDuration, newDotted = false) {
    console.log('[MeasureEditor] changeNoteDuration called:', {
      measureIndex,
      staff,
      noteIndex,
      newDuration,
      newDotted
    });

    const measure = this.measures[measureIndex];
    if (!measure) {
      console.warn('[MeasureEditor] Measure not found:', measureIndex);
      return false;
    }

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    const note = notes[noteIndex];
    if (!note) {
      console.warn('[MeasureEditor] Note not found:', { staff, noteIndex });
      return false;
    }

    console.log('[MeasureEditor] Current note:', {
      duration: note.duration,
      dotted: note.dotted,
      pitch: note.pitch || note.pitches
    });

    // Calculate current note's beats
    const currentBeats = getDurationBeats(note.duration);
    const currentTotalBeats = note.dotted ? currentBeats * 1.5 : currentBeats;

    // Calculate new note's beats
    const newBeats = getDurationBeats(newDuration);
    const newTotalBeats = newDotted ? newBeats * 1.5 : newBeats;

    // Check if change would fit
    const remainingBeats = this.getRemainingBeats(measureIndex, staff);
    const beatDifference = newTotalBeats - currentTotalBeats;

    console.log('[MeasureEditor] Beat calculation:', {
      currentBeats,
      currentTotalBeats,
      newBeats,
      newTotalBeats,
      remainingBeats,
      beatDifference
    });

    if (beatDifference > remainingBeats) {
      console.warn('[MeasureEditor] New duration does not fit in measure');
      return false;
    }

    this.saveState();

    note.duration = newDuration;
    note.dotted = newDotted;

    console.log('[MeasureEditor] Duration changed successfully. New note:', {
      duration: note.duration,
      dotted: note.dotted
    });

    return true;
  }

  // ============================================================================
  // ARTICULATIONS AND EXPRESSIONS
  // ============================================================================

  /**
   * Set articulation for a note
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note index
   * @param {string} articulation - Articulation type ('staccato', 'accent', 'tenuto', 'marcato', null)
   * @returns {boolean} - Success
   */
  setArticulation(measureIndex, staff, noteIndex, articulation) {
    const measure = this.measures[measureIndex];
    if (!measure) return false;

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    const note = notes[noteIndex];
    if (!note) return false;

    this.saveState();
    note.articulation = articulation;
    return true;
  }

  /**
   * Toggle articulation for a note (turn on if off, turn off if on)
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note index
   * @param {string} articulation - Articulation type
   * @returns {boolean} - Success
   */
  toggleArticulation(measureIndex, staff, noteIndex, articulation) {
    const measure = this.measures[measureIndex];
    if (!measure) return false;

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    const note = notes[noteIndex];
    if (!note) return false;

    const newArticulation = note.articulation === articulation ? null : articulation;
    return this.setArticulation(measureIndex, staff, noteIndex, newArticulation);
  }

  /**
   * Set dynamic marking for a note
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note index
   * @param {string} dynamic - Dynamic marking ('pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', null)
   * @returns {boolean} - Success
   */
  setDynamic(measureIndex, staff, noteIndex, dynamic) {
    const measure = this.measures[measureIndex];
    if (!measure) return false;

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    const note = notes[noteIndex];
    if (!note) return false;

    this.saveState();
    note.dynamic = dynamic;
    return true;
  }

  // ============================================================================
  // TIES AND SLURS
  // ============================================================================

  /**
   * Add a tie to a note (connects to next note of same pitch)
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note index
   * @returns {boolean} - Success
   */
  addTie(measureIndex, staff, noteIndex) {
    const measure = this.measures[measureIndex];
    if (!measure) return false;

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    const note = notes[noteIndex];
    if (!note) return false;

    // Can't tie a rest
    if (note.isRest) return false;

    this.saveState();
    note.tied = true;

    // Mark next note as tied-to if it exists and has same pitch
    if (noteIndex + 1 < notes.length) {
      const nextNote = notes[noteIndex + 1];
      if (!nextNote.isRest && (nextNote.pitch === note.pitch ||
          (note.pitches && nextNote.pitches && JSON.stringify(note.pitches) === JSON.stringify(nextNote.pitches)))) {
        nextNote.tiedTo = true;
      }
    }

    return true;
  }

  /**
   * Remove a tie from a note
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note index
   * @returns {boolean} - Success
   */
  removeTie(measureIndex, staff, noteIndex) {
    const measure = this.measures[measureIndex];
    if (!measure) return false;

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    const note = notes[noteIndex];
    if (!note) return false;

    this.saveState();
    note.tied = false;

    // Remove tiedTo from next note
    if (noteIndex + 1 < notes.length) {
      notes[noteIndex + 1].tiedTo = false;
    }

    return true;
  }

  /**
   * Toggle tie on a note
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note index
   * @returns {boolean} - Success
   */
  toggleTie(measureIndex, staff, noteIndex) {
    const measure = this.measures[measureIndex];
    if (!measure) return false;

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    const note = notes[noteIndex];
    if (!note || note.isRest) return false;

    return note.tied ? this.removeTie(measureIndex, staff, noteIndex) : this.addTie(measureIndex, staff, noteIndex);
  }

  /**
   * Add a slur between two notes (can be different pitches)
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} startNoteIndex - Start note index
   * @param {number} endNoteIndex - End note index
   * @returns {boolean} - Success
   */
  addSlur(measureIndex, staff, startNoteIndex, endNoteIndex) {
    const measure = this.measures[measureIndex];
    if (!measure) return false;

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    const startNote = notes[startNoteIndex];
    const endNote = notes[endNoteIndex];

    if (!startNote || !endNote) return false;
    if (startNote.isRest || endNote.isRest) return false;
    if (startNoteIndex >= endNoteIndex) return false;

    this.saveState();

    // Initialize slur data if not present
    if (!startNote.slur) {
      startNote.slur = { type: 'start', endIndex: endNoteIndex };
    } else {
      startNote.slur.type = 'start';
      startNote.slur.endIndex = endNoteIndex;
    }

    if (!endNote.slur) {
      endNote.slur = { type: 'end', startIndex: startNoteIndex };
    } else {
      endNote.slur.type = 'end';
      endNote.slur.startIndex = startNoteIndex;
    }

    return true;
  }

  /**
   * Remove slur from a note
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} noteIndex - Note index
   * @returns {boolean} - Success
   */
  removeSlur(measureIndex, staff, noteIndex) {
    const measure = this.measures[measureIndex];
    if (!measure) return false;

    const notes = staff === 'treble' ? measure.trebleNotes : measure.bassNotes;
    const note = notes[noteIndex];
    if (!note || !note.slur) return false;

    this.saveState();

    // Remove slur from connected note
    if (note.slur.type === 'start' && note.slur.endIndex !== undefined) {
      const endNote = notes[note.slur.endIndex];
      if (endNote) delete endNote.slur;
    } else if (note.slur.type === 'end' && note.slur.startIndex !== undefined) {
      const startNote = notes[note.slur.startIndex];
      if (startNote) delete startNote.slur;
    }

    delete note.slur;
    return true;
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
