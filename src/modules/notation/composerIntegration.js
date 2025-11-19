/**
 * Composer Integration - Bridges new notation system with existing Melody Composer
 * Part of the Phase 4.4 VexFlow Professional Notation enhancement
 *
 * This module connects the new modular notation system with:
 * - CompositionState (measure/chord/notation data)
 * - Progression Builder (chord recommendations)
 * - Melody Suggestion Engine
 * - Harmonic Tone Analyzer (coloring)
 */

import { getCompositionState } from '../state/compositionState.js';
import { getProgressionData, getCurrentKey } from '../state/trainerState.js';
import { analyzeChordTone, CHORD_TONE_COLORS } from '../analysis/chordToneAnalyzer.js';
import { StaffLayoutManager } from './staffLayouter.js';
import { MeasureManager } from './measureEditor.js';
import { NotationToolbar } from './notationToolbar.js';
import {
  renderGrandStaffSystem,
  convertToGrandStaffFormat,
  GRAND_STAFF_DEFAULTS,
} from './grandStaff.js';
import {
  createRenderer,
  noteToMidi,
  getVexFlowKeySignature,
} from './vexFlowRenderer.js';

// ============================================================================
// NOTATION COMPOSER CLASS
// ============================================================================

/**
 * Main class that integrates the new notation system with existing components
 */
export class NotationComposer {
  constructor(options = {}) {
    // Configuration
    this.config = {
      container: options.container || null,
      toolbarContainer: options.toolbarContainer || null,
      measuresPerLine: options.measuresPerLine || 4,
      showMeasureNumbers: options.showMeasureNumbers !== false,
      showChordSymbols: options.showChordSymbols !== false,
      enableHarmonicColoring: options.enableHarmonicColoring !== false,
      enableMelodySuggestions: options.enableMelodySuggestions !== false,
    };

    // State management
    this.compositionState = null;
    this.layoutManager = new StaffLayoutManager({
      measuresPerLine: this.config.measuresPerLine,
    });
    this.measureManager = new MeasureManager();
    this.toolbar = null;

    // Rendering state
    this.renderedSystem = null;
    this.selectedMeasure = null;
    this.selectedStaff = null;
    this.selectedNote = null;

    // Event handlers
    this.onUpdate = options.onUpdate || (() => {});
    this.onSelectionChange = options.onSelectionChange || (() => {});
    this.onNoteAdded = options.onNoteAdded || (() => {});

    // Initialize
    if (options.autoInit !== false) {
      this.init();
    }
  }

  /**
   * Initialize the notation composer
   */
  init() {
    // Get composition state
    this.compositionState = getCompositionState();

    // Create toolbar if container provided
    if (this.config.toolbarContainer) {
      this.toolbar = new NotationToolbar({
        onDurationChange: () => this.render(),
        onZoomChange: (zoom) => {
          this.layoutManager.setZoom(zoom / 100);
          this.render();
        },
        onMeasuresPerLineChange: (mpl) => {
          this.config.measuresPerLine = mpl;
          this.layoutManager.setConfig({ measuresPerLine: mpl });
          this.render();
        },
        onUndo: () => this.undo(),
        onRedo: () => this.redo(),
        onDelete: () => this.deleteSelected(),
        onTie: () => this.addTie(),
      });
      this.toolbar.create(this.config.toolbarContainer);
    }

    // Subscribe to composition state changes
    if (this.compositionState) {
      this.compositionState.events.on('chordChanged', () => this.render());
      this.compositionState.events.on('noteAdded', () => this.render());
      this.compositionState.events.on('noteRemoved', () => this.render());
      this.compositionState.events.on('measureAdded', () => this.render());
      this.compositionState.events.on('measureRemoved', () => this.render());
      this.compositionState.events.on('bassUpdated', () => this.render());
    }

    // Set up canvas event listeners
    if (this.config.container) {
      this.setupCanvasEvents();
    }

    console.log('[NotationComposer] Initialized');
  }

  // ============================================================================
  // DATA CONVERSION
  // ============================================================================

  /**
   * Convert CompositionState measures to grand staff format
   * @returns {Array} - Array of measure data for rendering
   */
  convertMeasuresToGrandStaff() {
    if (!this.compositionState) {
      return [];
    }

    const measures = [];
    const measureCount = this.compositionState.getMeasureCount();

    for (let i = 0; i < measureCount; i++) {
      const measure = this.compositionState.getMeasure(i);
      if (!measure) continue;

      const measureData = {
        trebleNotes: [],
        bassNotes: [],
        chordSymbol: null,
        measureNumber: i + 1,
      };

      // Convert treble clef notes
      const trebleVoices = measure.notation.treble.voices;
      if (trebleVoices && trebleVoices[0]) {
        measureData.trebleNotes = trebleVoices[0].notes.map(note => ({
          pitch: note.pitch,
          duration: note.duration || '4n',
          isRest: note.isRest || false,
          dotted: note.dotted || false,
          accidental: note.accidental || null,
        }));
      }

      // Convert bass clef notes
      const bassVoices = measure.notation.bass.voices;
      if (bassVoices && bassVoices[0]) {
        measureData.bassNotes = bassVoices[0].notes.map(note => {
          // Handle both single notes and chords
          if (note.pitches && Array.isArray(note.pitches)) {
            return {
              pitches: note.pitches,
              duration: note.duration || '1n',
            };
          }
          return {
            pitch: note.pitch,
            duration: note.duration || '1n',
            isRest: note.isRest || false,
          };
        });
      }

      // Add chord symbol if available
      if (measure.chord && measure.chord.root) {
        const typeSuffix = this.getChordTypeSuffix(measure.chord.type);
        measureData.chordSymbol = measure.chord.root + typeSuffix;
      }

      measures.push(measureData);
    }

    return measures;
  }

  /**
   * Get chord type suffix for display
   * @param {string} chordType - Chord type name
   * @returns {string} - Suffix for chord symbol
   */
  getChordTypeSuffix(chordType) {
    if (!chordType) return '';

    const suffixes = {
      'Major': '',
      'Minor': 'm',
      'Dominant 7th': '7',
      'Major 7th': 'maj7',
      'Minor 7th': 'm7',
      'Diminished': 'dim',
      'Augmented': 'aug',
      'Suspended 2': 'sus2',
      'Suspended 4': 'sus4',
      'Add 9': 'add9',
      'Minor 9': 'm9',
      'Major 9': 'maj9',
      'Dominant 9': '9',
      'Minor 11': 'm11',
      'Dominant 11': '11',
      'Minor 13': 'm13',
      'Dominant 13': '13',
    };

    return suffixes[chordType] || '';
  }

  /**
   * Sync from progression data
   */
  syncFromProgression() {
    const progressionData = getProgressionData();
    const currentKey = getCurrentKey();

    if (!progressionData || progressionData.length === 0) {
      console.log('[NotationComposer] No progression to sync');
      return;
    }

    // Clear and rebuild measure manager
    this.measureManager.setMeasures([]);

    for (let i = 0; i < progressionData.length; i++) {
      const chord = progressionData[i];
      const measureData = {
        trebleNotes: [],
        bassNotes: [],
        keySignature: currentKey,
        timeSignature: '4/4',
      };

      // Add chord notes to bass as whole note chord
      if (chord.notes && chord.notes.length > 0) {
        // Separate into treble and bass based on octave
        const trebleNotes = [];
        const bassNotes = [];

        chord.notes.forEach(note => {
          const midi = noteToMidi(note);
          if (midi >= 60) { // Middle C and above
            trebleNotes.push(note);
          } else {
            bassNotes.push(note);
          }
        });

        if (trebleNotes.length > 0) {
          measureData.trebleNotes.push({
            pitches: trebleNotes,
            duration: '1n',
          });
        }

        if (bassNotes.length > 0) {
          measureData.bassNotes.push({
            pitches: bassNotes,
            duration: '1n',
          });
        }
      }

      this.measureManager.addMeasure(null, measureData);
    }

    this.render();
    console.log(`[NotationComposer] Synced ${progressionData.length} chords`);
  }

  // ============================================================================
  // RENDERING
  // ============================================================================

  /**
   * Render the notation
   */
  render() {
    if (!this.config.container) {
      console.warn('[NotationComposer] No container specified');
      return;
    }

    // Get measures to render
    let measures;
    if (this.compositionState && this.compositionState.getMeasureCount() > 0) {
      measures = this.convertMeasuresToGrandStaff();
    } else {
      measures = this.measureManager.getAllMeasures();
    }

    if (measures.length === 0) {
      // Render empty state
      this.renderEmptyState();
      return;
    }

    // Get key signature
    const key = this.compositionState
      ? this.compositionState.metadata.key
      : getCurrentKey() || 'C';

    // Get time signature
    const timeSig = this.compositionState
      ? `${this.compositionState.metadata.timeSignature.num}/${this.compositionState.metadata.timeSignature.denom}`
      : '4/4';

    // Calculate layout
    this.layoutManager.calculateLayout(measures.length, {
      keySignature: key,
      timeSignature: timeSig,
    });

    // Render the grand staff system
    this.renderedSystem = renderGrandStaffSystem(this.config.container, measures, {
      measuresPerLine: this.config.measuresPerLine,
      keySignature: key,
      timeSignature: timeSig,
      showMeasureNumbers: this.config.showMeasureNumbers,
    });

    // Apply harmonic coloring if enabled
    if (this.config.enableHarmonicColoring) {
      this.applyHarmonicColoring();
    }

    // Update toolbar state
    if (this.toolbar) {
      this.toolbar.setUndoRedoState(
        this.measureManager.canUndo(),
        this.measureManager.canRedo()
      );
    }

    // Notify listeners
    this.onUpdate();
  }

  /**
   * Render empty state
   */
  renderEmptyState() {
    const container = this.config.container;
    if (!container) return;

    // Clear and show message
    if (container.tagName === 'CANVAS') {
      const ctx = container.getContext('2d');
      container.width = 800;
      container.height = 200;
      ctx.clearRect(0, 0, container.width, container.height);
      ctx.font = '16px Arial';
      ctx.fillStyle = '#888';
      ctx.textAlign = 'center';
      ctx.fillText(
        'No measures to display. Add chords in Progression Builder or click to add notes.',
        container.width / 2,
        container.height / 2
      );
    }
  }

  /**
   * Apply harmonic tone coloring to rendered notes
   */
  applyHarmonicColoring() {
    // This will be called during playback to highlight notes
    // For static rendering, we'll apply colors based on chord context
    // Implementation will use the analyzeChordTone function
  }

  // ============================================================================
  // INTERACTION
  // ============================================================================

  /**
   * Set up canvas event listeners for interaction
   */
  setupCanvasEvents() {
    const container = this.config.container;
    if (!container) return;

    // Click handler
    container.addEventListener('click', (e) => {
      this.handleClick(e);
    });

    // Mouse move for hover effects
    container.addEventListener('mousemove', (e) => {
      this.handleMouseMove(e);
    });

    // Mouse leave
    container.addEventListener('mouseleave', () => {
      this.handleMouseLeave();
    });
  }

  /**
   * Handle click on canvas
   * @param {MouseEvent} e - Mouse event
   */
  handleClick(e) {
    const rect = this.config.container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find what was clicked
    const position = this.layoutManager.getStaffPositionAtPoint(x, y);

    if (position && position.measure && position.staff) {
      this.selectedMeasure = position.measure.index;
      this.selectedStaff = position.staff;

      // If we have a pitch, add a note
      if (position.pitch && this.toolbar) {
        const toolState = this.toolbar.getState();

        const noteData = {
          pitch: position.pitch,
          duration: toolState.duration,
          isRest: toolState.isRest,
          dotted: toolState.dotted,
          accidental: toolState.accidental,
        };

        this.addNote(this.selectedMeasure, this.selectedStaff, noteData);
      }

      this.onSelectionChange({
        measure: this.selectedMeasure,
        staff: this.selectedStaff,
        pitch: position.pitch,
      });
    }
  }

  /**
   * Handle mouse move for hover effects
   * @param {MouseEvent} e - Mouse event
   */
  handleMouseMove(e) {
    // Future: Show ghost note preview
  }

  /**
   * Handle mouse leave
   */
  handleMouseLeave() {
    // Future: Hide ghost note preview
  }

  // ============================================================================
  // NOTE OPERATIONS
  // ============================================================================

  /**
   * Add a note to the composition
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {Object} noteData - Note data
   */
  addNote(measureIndex, staff, noteData) {
    // Update composition state if available
    if (this.compositionState) {
      // Ensure measure exists
      while (this.compositionState.getMeasureCount() <= measureIndex) {
        this.compositionState.addMeasure({});
      }

      this.compositionState.addNote(measureIndex, staff, 0, noteData);
    } else {
      // Use measure manager
      while (this.measureManager.getMeasureCount() <= measureIndex) {
        this.measureManager.addMeasure();
      }

      this.measureManager.addNote(measureIndex, staff, noteData);
    }

    this.onNoteAdded(measureIndex, staff, noteData);
    this.render();
  }

  /**
   * Delete selected note
   */
  deleteSelected() {
    if (this.measureManager.getSelection().noteIndex !== null) {
      this.measureManager.deleteSelected();
      this.render();
    }
  }

  /**
   * Add a tie to selected note
   */
  addTie() {
    const selection = this.measureManager.getSelection();
    if (selection.noteIndex !== null) {
      this.measureManager.updateNote(
        selection.measureIndex,
        selection.staff,
        selection.noteIndex,
        { tied: true }
      );
      this.render();
    }
  }

  /**
   * Undo last action
   */
  undo() {
    this.measureManager.undo();
    this.render();
  }

  /**
   * Redo last undone action
   */
  redo() {
    this.measureManager.redo();
    this.render();
  }

  // ============================================================================
  // MEASURE OPERATIONS
  // ============================================================================

  /**
   * Add a new measure
   * @param {number} index - Index to insert at (null for end)
   */
  addMeasure(index = null) {
    if (this.compositionState) {
      this.compositionState.addMeasure({});
    } else {
      this.measureManager.addMeasure(index);
    }
    this.render();
  }

  /**
   * Remove a measure
   * @param {number} index - Measure index
   */
  removeMeasure(index) {
    if (this.compositionState) {
      this.compositionState.removeMeasure(index);
    } else {
      this.measureManager.removeMeasure(index);
    }
    this.render();
  }

  // ============================================================================
  // SETTINGS
  // ============================================================================

  /**
   * Update configuration
   * @param {Object} config - New configuration
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };

    if (config.measuresPerLine) {
      this.layoutManager.setConfig({ measuresPerLine: config.measuresPerLine });
    }

    this.render();
  }

  /**
   * Get current configuration
   * @returns {Object} - Current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Set zoom level
   * @param {number} zoom - Zoom percentage (50-200)
   */
  setZoom(zoom) {
    this.layoutManager.setZoom(zoom / 100);
    this.render();
  }

  // ============================================================================
  // EXPORT/IMPORT
  // ============================================================================

  /**
   * Export to JSON
   * @returns {string} - JSON string
   */
  toJSON() {
    return this.measureManager.toJSON();
  }

  /**
   * Import from JSON
   * @param {string} json - JSON string
   */
  fromJSON(json) {
    this.measureManager.fromJSON(json);
    this.render();
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Destroy the composer and clean up
   */
  destroy() {
    if (this.toolbar) {
      this.toolbar.destroy();
    }

    // Remove event listeners from canvas
    if (this.config.container) {
      this.config.container.replaceWith(this.config.container.cloneNode(true));
    }

    // Clear state
    this.compositionState = null;
    this.renderedSystem = null;

    console.log('[NotationComposer] Destroyed');
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a NotationComposer instance
 * @param {Object} options - Configuration options
 * @returns {NotationComposer} - New instance
 */
export function createNotationComposer(options = {}) {
  return new NotationComposer(options);
}

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

/**
 * Initialize notation composer for the Melody Composer tab
 * @param {HTMLElement} canvasContainer - Container for the staff canvas
 * @param {HTMLElement} toolbarContainer - Container for the toolbar
 * @returns {NotationComposer} - Initialized composer
 */
export function initMelodyComposerNotation(canvasContainer, toolbarContainer) {
  const composer = new NotationComposer({
    container: canvasContainer,
    toolbarContainer: toolbarContainer,
    enableHarmonicColoring: true,
    enableMelodySuggestions: true,
  });

  // Sync from progression if available
  composer.syncFromProgression();

  return composer;
}

/**
 * Get harmonic analysis for a note
 * @param {string} pitch - Note pitch like "C4"
 * @param {Object} chord - Chord data
 * @param {string} key - Key signature
 * @returns {Object} - Analysis result with colors
 */
export function getHarmonicAnalysis(pitch, chord, key) {
  if (!pitch || !chord) return null;

  return analyzeChordTone(pitch, chord, key);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  NotationComposer,
  createNotationComposer,
  initMelodyComposerNotation,
  getHarmonicAnalysis,
};
