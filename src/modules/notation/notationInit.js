/**
 * Notation Initialization - Wires up the new notation system to the Melody Composer UI
 * Part of the Phase 4.4 VexFlow Professional Notation enhancement
 *
 * This module initializes the NotationComposer and connects it to:
 * - The existing canvas elements in the Melody Composer tab
 * - The recommendation engines (chord and melody suggestions)
 * - The harmonic tone coloring system
 */

import { NotationComposer, createNotationComposer } from './composerIntegration.js';
import { NoteEditor, createNoteEditor } from './noteEditor.js';
import { NotationToolbar } from './notationToolbar.js';
import { getCompositionState } from '../state/compositionState.js';
import { getProgressionData, getCurrentKey } from '../state/trainerState.js';
import { analyzeChordTone } from '../analysis/chordToneAnalyzer.js';

// ============================================================================
// GLOBAL STATE
// ============================================================================

// Singleton instance of the notation composer
let notationComposer = null;
let noteEditor = null;
let isInitialized = false;

// Canvas element references
let primaryCanvas = null;
let overlayCanvas = null;
let toolbarContainer = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the enhanced notation system for the Melody Composer
 * Called when the melody tab is activated
 * @param {Object} options - Initialization options
 * @returns {NotationComposer} - The notation composer instance
 */
export function initEnhancedNotation(options = {}) {
  const {
    canvasId = 'interactive-melody-notation-canvas',
    toolbarContainerId = 'notation-toolbar-container',
    createToolbar = true,
  } = options;

  // Get canvas element
  primaryCanvas = document.getElementById(canvasId);
  if (!primaryCanvas) {
    return null;
  }

  // Check for existing toolbar container or create one
  toolbarContainer = document.getElementById(toolbarContainerId);
  if (!toolbarContainer && createToolbar) {
    // Create toolbar container before the canvas
    toolbarContainer = document.createElement('div');
    toolbarContainer.id = toolbarContainerId;
    toolbarContainer.className = 'notation-toolbar-container mb-4';
    primaryCanvas.parentElement.insertBefore(toolbarContainer, primaryCanvas);
  }

  // Create or reuse the notation composer
  if (notationComposer) {
    // Already initialized - just sync and render
    notationComposer.syncFromProgression();
    return notationComposer;
  }

  // Create new notation composer
  notationComposer = new NotationComposer({
    container: primaryCanvas,
    toolbarContainer: toolbarContainer,
    measuresPerLine: 4,
    showMeasureNumbers: true,
    showChordSymbols: true,
    enableHarmonicColoring: true,
    enableMelodySuggestions: true,
    onUpdate: handleNotationUpdate,
    onSelectionChange: handleSelectionChange,
    onNoteAdded: handleNoteAdded,
    autoInit: false, // We'll init manually after setup
  });

  // Initialize now
  notationComposer.init();

  // Create note editor for interactive editing
  noteEditor = new NoteEditor({
    canvas: primaryCanvas,
    layoutManager: notationComposer.layoutManager,
    onNoteAdd: (data) => {
      notationComposer.addNote(data.measureIndex, data.staff, data.note);
    },
    onNoteMove: (moves) => {
      // Handle note moves
    },
    onNoteSelect: (noteIds) => {
      // Handle note selection
    },
    onNoteDelete: (deletion) => {
      if (notationComposer.compositionState) {
        notationComposer.compositionState.removeNote(
          deletion.measureIndex,
          deletion.staff,
          0,
          deletion.noteIndex
        );
        notationComposer.render();
      }
    },
  });

  // Sync from existing progression
  notationComposer.syncFromProgression();

  isInitialized = true;

  return notationComposer;
}

/**
 * Check if notation system is initialized
 * @returns {boolean}
 */
export function isNotationInitialized() {
  return isInitialized;
}

/**
 * Get the notation composer instance
 * @returns {NotationComposer|null}
 */
export function getNotationComposer() {
  return notationComposer;
}

/**
 * Get the note editor instance
 * @returns {NoteEditor|null}
 */
export function getNoteEditor() {
  return noteEditor;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

/**
 * Handle notation update events
 */
function handleNotationUpdate() {
  // Notify other systems that notation has changed
  if (window.onNotationUpdate) {
    window.onNotationUpdate();
  }
}

/**
 * Handle selection change events
 * @param {Object} selection - Selection data
 */
function handleSelectionChange(selection) {
  // Update chord context for harmonic coloring
  if (selection.measure !== null && notationComposer) {
    const chord = notationComposer.compositionState?.getChord(selection.measure);
    const key = notationComposer.compositionState?.metadata.key || getCurrentKey();

    if (noteEditor && chord) {
      noteEditor.setChordContext(chord, key);
    }
  }
}

/**
 * Handle note added events
 * @param {number} measureIndex - Measure index
 * @param {string} staff - Staff name
 * @param {Object} noteData - Note data
 */
function handleNoteAdded(measureIndex, staff, noteData) {
  // Trigger melody suggestion update
  if (window.updateMelodySuggestions) {
    window.updateMelodySuggestions(measureIndex);
  }

  // Update recommendations sidebar
  if (window.updateUnifiedSuggestions) {
    window.updateUnifiedSuggestions();
  }
}

// ============================================================================
// RENDERING FUNCTIONS
// ============================================================================

/**
 * Render the notation (wrapper for backward compatibility)
 * @param {HTMLCanvasElement} canvas - Optional canvas override
 */
export function renderEnhancedNotation(canvas = null) {
  if (!notationComposer) {
    return;
  }

  if (canvas) {
    notationComposer.config.container = canvas;
  }

  notationComposer.render();
}

/**
 * Re-render with updated data from progression
 * @returns {boolean} - True if rendering was performed, false if not initialized
 */
export function refreshNotationFromProgression() {
  if (!notationComposer) {
    return false;
  }

  notationComposer.syncFromProgression();
  return true;
}

// ============================================================================
// TOOL STATE MANAGEMENT
// ============================================================================

/**
 * Set the current note duration for new notes
 * @param {string} duration - Duration like '4n', '8n'
 */
export function setNotationDuration(duration) {
  if (notationComposer && notationComposer.toolbar) {
    notationComposer.toolbar.setDuration(duration);
  }
  if (noteEditor) {
    noteEditor.setDuration(duration);
  }
}

/**
 * Set rest mode
 * @param {boolean} isRest - Whether to insert rests
 */
export function setNotationRestMode(isRest) {
  if (notationComposer && notationComposer.toolbar) {
    notationComposer.toolbar.isRestMode = isRest;
    notationComposer.toolbar.updateRestButton();
  }
  if (noteEditor) {
    noteEditor.setRestMode(isRest);
  }
}

/**
 * Set dotted mode
 * @param {boolean} isDotted - Whether to use dotted notes
 */
export function setNotationDotted(isDotted) {
  if (notationComposer && notationComposer.toolbar) {
    notationComposer.toolbar.isDotted = isDotted;
    notationComposer.toolbar.updateDotButton();
  }
  if (noteEditor) {
    noteEditor.setDotted(isDotted);
  }
}

/**
 * Set accidental for next note
 * @param {string|null} accidental - '#', 'b', 'n', or null
 */
export function setNotationAccidental(accidental) {
  if (notationComposer && notationComposer.toolbar) {
    notationComposer.toolbar.setAccidental(accidental);
  }
  if (noteEditor) {
    noteEditor.setAccidental(accidental);
  }
}

// ============================================================================
// PLAYBACK INTEGRATION
// ============================================================================

/**
 * Highlight a note during playback
 * @param {number} measureIndex - Measure index
 * @param {string} staff - 'treble' or 'bass'
 * @param {number} noteIndex - Note index
 * @param {Object} chord - Current chord for coloring
 */
export function highlightPlayingNote(measureIndex, staff, noteIndex, chord) {
  if (!notationComposer) return;

  // Get note data
  const compositionState = notationComposer.compositionState;
  if (!compositionState) return;

  const notes = compositionState.getNotes(measureIndex, staff);
  if (!notes || !notes[noteIndex]) return;

  const note = notes[noteIndex];
  const key = compositionState.metadata.key;

  // Get harmonic analysis for coloring
  if (chord && note.pitch) {
    const analysis = analyzeChordTone(note.pitch, chord, key);
    if (analysis) {
      // Apply color to rendered note
      // This would update the visual representation
    }
  }

  // Update visual highlight (to be implemented in renderer)
}

/**
 * Clear playback highlights
 */
export function clearPlaybackHighlights() {
  // Clear any visual highlights from playback
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Destroy the notation system and clean up resources
 */
export function destroyEnhancedNotation() {
  if (noteEditor) {
    noteEditor.destroy();
    noteEditor = null;
  }

  if (notationComposer) {
    notationComposer.destroy();
    notationComposer = null;
  }

  isInitialized = false;
}

// ============================================================================
// WINDOW EXPORTS (for HTML event handlers)
// ============================================================================

// Export functions to window for HTML event handlers
if (typeof window !== 'undefined') {
  window.initEnhancedNotation = initEnhancedNotation;
  window.renderEnhancedNotation = renderEnhancedNotation;
  window.refreshNotationFromProgression = refreshNotationFromProgression;
  window.setNotationDuration = setNotationDuration;
  window.setNotationRestMode = setNotationRestMode;
  window.setNotationDotted = setNotationDotted;
  window.setNotationAccidental = setNotationAccidental;
  window.highlightPlayingNote = highlightPlayingNote;
  window.clearPlaybackHighlights = clearPlaybackHighlights;
  window.getNotationComposer = getNotationComposer;
  window.isNotationInitialized = isNotationInitialized;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  initEnhancedNotation,
  isNotationInitialized,
  getNotationComposer,
  getNoteEditor,
  renderEnhancedNotation,
  refreshNotationFromProgression,
  setNotationDuration,
  setNotationRestMode,
  setNotationDotted,
  setNotationAccidental,
  highlightPlayingNote,
  clearPlaybackHighlights,
  destroyEnhancedNotation,
};
