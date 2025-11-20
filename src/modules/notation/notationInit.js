/**
 * Notation Initialization - Wires up the new notation system to the Melody Composer UI
 * Part of the Phase 4.4 VexFlow Professional Notation enhancement
 *
 * This module initializes the NotationComposer and connects it to:
 * - The existing canvas elements in the Melody Composer tab
 * - The recommendation engines (chord and melody suggestions)
 * - The harmonic tone coloring system
 */

import { NotationComposer } from './composerIntegration.js';
import { NoteEditor } from './noteEditor.js';
import { getCurrentKey } from '../state/trainerState.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Transpose a pitch by a number of scale steps
 * @param {string} pitch - Current pitch (e.g., "C4")
 * @param {number} steps - Number of steps (positive = up, negative = down)
 * @param {string} staff - 'treble' or 'bass' for clef context
 * @returns {string} - New pitch
 */
function transposePitchBySteps(pitch, steps, staff) {
  // Chromatic scale
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // Parse pitch
  const match = pitch.match(/^([A-G]#?)(\d+)$/);
  if (!match) return pitch;

  const [, noteName, octave] = match;
  const octaveNum = parseInt(octave, 10);

  // Find note index
  let noteIndex = notes.indexOf(noteName);
  if (noteIndex === -1) {
    // Try flat notation
    const flats = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
    const sharp = flats[noteName];
    if (sharp) noteIndex = notes.indexOf(sharp);
  }

  if (noteIndex === -1) return pitch;

  // Calculate new position (steps are half-steps for now)
  let newIndex = noteIndex + steps;
  let newOctave = octaveNum;

  // Handle octave wrapping
  while (newIndex < 0) {
    newIndex += 12;
    newOctave--;
  }
  while (newIndex >= 12) {
    newIndex -= 12;
    newOctave++;
  }

  return notes[newIndex] + newOctave;
}

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

/**
 * Create or get overlay canvas for visual feedback
 * @param {HTMLCanvasElement} baseCanvas - Base canvas element
 * @returns {HTMLCanvasElement} - Overlay canvas
 */
function getOrCreateOverlayCanvas(baseCanvas) {
  // Check if overlay already exists
  let overlay = document.getElementById(baseCanvas.id + '-overlay');

  if (!overlay) {
    // Create new overlay canvas
    overlay = document.createElement('canvas');
    overlay.id = baseCanvas.id + '-overlay';
    overlay.style.position = 'absolute';
    overlay.style.left = baseCanvas.offsetLeft + 'px';
    overlay.style.top = baseCanvas.offsetTop + 'px';
    overlay.style.pointerEvents = 'none'; // Let clicks pass through to base canvas
    overlay.style.zIndex = '10';

    // Match dimensions
    overlay.width = baseCanvas.width;
    overlay.height = baseCanvas.height;

    // Insert after base canvas
    baseCanvas.parentElement.insertBefore(overlay, baseCanvas.nextSibling);

    // Update overlay position/size when base canvas changes
    const resizeObserver = new ResizeObserver(() => {
      overlay.width = baseCanvas.width;
      overlay.height = baseCanvas.height;
      overlay.style.left = baseCanvas.offsetLeft + 'px';
      overlay.style.top = baseCanvas.offsetTop + 'px';
    });
    resizeObserver.observe(baseCanvas);
  }

  return overlay;
}

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
    console.log('[NotationInit] Already initialized, syncing from progression');
    notationComposer.syncFromProgression();
    return notationComposer;
  }

  console.log('[NotationInit] Initializing enhanced notation system...');

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

  // Create overlay canvas for visual feedback
  overlayCanvas = getOrCreateOverlayCanvas(primaryCanvas);

  // Create note editor for interactive editing
  noteEditor = new NoteEditor({
    canvas: primaryCanvas,
    overlayCanvas: overlayCanvas,
    layoutManager: notationComposer.layoutManager,
    onNoteAdd: (data) => {
      console.log('[NoteEditor] onNoteAdd called:', {
        measureIndex: data.measureIndex,
        staff: data.staff,
        pitch: data.note.pitch,
        duration: data.note.duration,
        isRest: data.note.isRest
      });

      // Add note to BOTH compositionState (source) AND measureManager (cache)
      // This ensures persistence even when syncFromProgression() runs

      // 1. Add to compositionState (source of truth)
      if (notationComposer.compositionState) {
        const measure = notationComposer.compositionState.getMeasure(data.measureIndex);
        if (measure) {
          const voiceKey = data.staff === 'treble' ? 'treble' : 'bass';
          const voice = measure.notation[voiceKey].voices[0];

          if (voice) {
            voice.notes.push({
              pitch: data.note.pitch,
              pitches: data.note.pitches,
              duration: data.note.duration,
              isRest: data.note.isRest,
              dotted: data.note.dotted,
              accidental: data.note.accidental,
            });
            console.log('[NoteEditor] Note added to compositionState', voiceKey, 'voice');
          }
        }
      }

      // 2. Add to measureManager (for immediate rendering without full sync)
      if (notationComposer.measureManager) {
        const measure = notationComposer.measureManager.getMeasure(data.measureIndex);
        if (measure) {
          const notesArray = data.staff === 'treble' ? 'trebleNotes' : 'bassNotes';
          const autoGenFlag = data.staff === 'treble' ? 'isAutoGeneratedMelody' : 'isAutoGeneratedBass';

          const noteData = {
            pitch: data.note.pitch,
            pitches: data.note.pitches,
            duration: data.note.duration,
            isRest: data.note.isRest,
            dotted: data.note.dotted,
            accidental: data.note.accidental,
          };

          if (!measure[notesArray]) {
            measure[notesArray] = [];
          }

          // CRITICAL: If this is the first manual note added to a staff with auto-generated notes,
          // clear the auto-generated notes first
          // Only clear if the flag is explicitly TRUE (auto-generated)
          // If it's false or undefined with existing notes, those are manual notes - don't clear
          if (measure[autoGenFlag] === true && measure[notesArray].length > 0) {
            console.log(`[NoteEditor] Clearing ${measure[notesArray].length} auto-generated ${data.staff} notes before adding first manual note`);
            measure[notesArray] = [];
          }

          measure[notesArray].push(noteData);

          // Mark that this measure has manually added notes (not auto-generated)
          measure[autoGenFlag] = false;
          console.log(`[NoteEditor] Set ${autoGenFlag} = false on measure`, data.measureIndex);

          console.log('[NoteEditor] Note added to measureManager', data.staff, 'staff');
          console.log('[NoteEditor] Measure after update:', {
            trebleNotes: measure.trebleNotes?.length,
            bassNotes: measure.bassNotes?.length,
            isAutoGeneratedMelody: measure.isAutoGeneratedMelody,
            isAutoGeneratedBass: measure.isAutoGeneratedBass
          });
        }
      }

      // Trigger re-render
      notationComposer.render();

      // Update note editor with new note regions
      if (notationComposer.noteRegions) {
        noteEditor.setNoteRegions(notationComposer.noteRegions);
      }

      // Notify callbacks
      if (notationComposer.onNoteAdded) {
        notationComposer.onNoteAdded(data.measureIndex, data.staff, data.note);
      }
    },
    onNoteMove: (moves) => {
      // Handle note pitch changes (drag operations) - update both data sources
      moves.forEach(move => {
        // 1. Update compositionState
        if (notationComposer.compositionState) {
          const measure = notationComposer.compositionState.getMeasure(move.measureIndex);
          if (measure) {
            const voiceKey = move.staff === 'treble' ? 'treble' : 'bass';
            const note = measure.notation[voiceKey]?.voices[0]?.notes[move.noteIndex];

            if (note && move.steps !== 0) {
              const currentPitch = note.pitch || note.pitches?.[0] || 'C4';
              const newPitch = transposePitchBySteps(currentPitch, move.steps, move.staff);

              if (note.pitches) {
                note.pitches = note.pitches.map(p => transposePitchBySteps(p, move.steps, move.staff));
              } else {
                note.pitch = newPitch;
              }
            }
          }
        }

        // 2. Update measureManager
        if (notationComposer.measureManager) {
          const measure = notationComposer.measureManager.getMeasure(move.measureIndex);
          if (measure) {
            const notesArray = move.staff === 'treble' ? 'trebleNotes' : 'bassNotes';
            const note = measure[notesArray]?.[move.noteIndex];

            if (note && move.steps !== 0) {
              const currentPitch = note.pitch || note.pitches?.[0] || 'C4';
              const newPitch = transposePitchBySteps(currentPitch, move.steps, move.staff);

              if (note.pitches) {
                note.pitches = note.pitches.map(p => transposePitchBySteps(p, move.steps, move.staff));
              } else {
                note.pitch = newPitch;
              }
            }
          }
        }
      });

      notationComposer.render();

      // Update note regions after move
      if (notationComposer.noteRegions) {
        noteEditor.setNoteRegions(notationComposer.noteRegions);
      }
    },
    onNoteSelect: (noteIds) => {
      // Handle note selection changes
      noteEditor.selectedNotes = new Set(noteIds);
      noteEditor.renderOverlay();
    },
    onNoteDelete: (deletion) => {
      // Delete from both data sources
      // 1. Delete from compositionState
      if (notationComposer.compositionState) {
        const measure = notationComposer.compositionState.getMeasure(deletion.measureIndex);
        if (measure) {
          const voiceKey = deletion.staff === 'treble' ? 'treble' : 'bass';
          const notes = measure.notation[voiceKey]?.voices[0]?.notes;
          if (notes && deletion.noteIndex < notes.length) {
            notes.splice(deletion.noteIndex, 1);
          }
        }
      }

      // 2. Delete from measureManager
      if (notationComposer.measureManager) {
        const measure = notationComposer.measureManager.getMeasure(deletion.measureIndex);
        if (measure) {
          const notesArray = deletion.staff === 'treble' ? 'trebleNotes' : 'bassNotes';
          if (measure[notesArray] && deletion.noteIndex < measure[notesArray].length) {
            measure[notesArray].splice(deletion.noteIndex, 1);

            // If all notes are deleted from a staff, reset the auto-generated flag
            // so auto-generation can populate the measure again
            if (deletion.staff === 'treble' && measure.trebleNotes.length === 0) {
              delete measure.isAutoGeneratedMelody;
            } else if (deletion.staff === 'bass' && measure.bassNotes.length === 0) {
              delete measure.isAutoGeneratedBass;
            }
          }
        }
      }

      notationComposer.render();

      // Update note regions after delete
      if (notationComposer.noteRegions) {
        noteEditor.setNoteRegions(notationComposer.noteRegions);
      }
    },
    onPolyphonyAdd: (data) => {
      // Add pitch to existing note to create chord - update both data sources
      // 1. Update compositionState
      if (notationComposer.compositionState) {
        const measure = notationComposer.compositionState.getMeasure(data.measureIndex);
        if (measure) {
          const voiceKey = data.staff === 'treble' ? 'treble' : 'bass';
          const note = measure.notation[voiceKey]?.voices[0]?.notes[data.noteIndex];

          if (note) {
            if (note.pitches && Array.isArray(note.pitches)) {
              if (!note.pitches.includes(data.pitch)) {
                note.pitches.push(data.pitch);
                note.pitches.sort();
              }
            } else if (note.pitch) {
              note.pitches = [note.pitch, data.pitch].sort();
              delete note.pitch;
            }
          }
        }
      }

      // 2. Update measureManager
      if (notationComposer.measureManager) {
        const measure = notationComposer.measureManager.getMeasure(data.measureIndex);
        if (measure) {
          const notesArray = data.staff === 'treble' ? 'trebleNotes' : 'bassNotes';
          const note = measure[notesArray]?.[data.noteIndex];

          if (note) {
            if (note.pitches && Array.isArray(note.pitches)) {
              if (!note.pitches.includes(data.pitch)) {
                note.pitches.push(data.pitch);
                note.pitches.sort();
              }
            } else if (note.pitch) {
              note.pitches = [note.pitch, data.pitch].sort();
              delete note.pitch;
            }
          }
        }
      }

      notationComposer.render();

      // Update note regions
      if (notationComposer.noteRegions) {
        noteEditor.setNoteRegions(notationComposer.noteRegions);
      }
    },
  });

  // Connect toolbar to note editor
  if (notationComposer.toolbar && noteEditor) {
    // Store original callbacks
    const originalCallbacks = {
      onDurationChange: notationComposer.toolbar.onDurationChange,
      onRestModeChange: notationComposer.toolbar.onRestModeChange,
      onDottedChange: notationComposer.toolbar.onDottedChange,
      onAccidentalChange: notationComposer.toolbar.onAccidentalChange,
    };

    // Enhance callbacks to also update note editor
    notationComposer.toolbar.onDurationChange = (duration) => {
      noteEditor.setDuration(duration);
      originalCallbacks.onDurationChange(duration);
    };

    notationComposer.toolbar.onRestModeChange = (isRest) => {
      noteEditor.setRestMode(isRest);
      originalCallbacks.onRestModeChange(isRest);
    };

    notationComposer.toolbar.onDottedChange = (isDotted) => {
      noteEditor.setDotted(isDotted);
      originalCallbacks.onDottedChange(isDotted);
    };

    notationComposer.toolbar.onAccidentalChange = (accidental) => {
      noteEditor.setAccidental(accidental);
      originalCallbacks.onAccidentalChange(accidental);
    };

    // Set initial chord context for harmonic coloring
    if (notationComposer.compositionState) {
      const key = notationComposer.compositionState.metadata?.key || getCurrentKey();
      noteEditor.setChordContext(null, key);
    }
  }

  // Sync from existing progression
  notationComposer.syncFromProgression();

  // Sync note regions after initial render
  if (notationComposer.noteRegions) {
    noteEditor.setNoteRegions(notationComposer.noteRegions);
  }

  // Hook into the composer's render method to always update note regions
  const originalRender = notationComposer.render.bind(notationComposer);
  notationComposer.render = function() {
    originalRender();
    // Update note regions in editor after each render
    if (this.noteRegions && noteEditor) {
      noteEditor.setNoteRegions(this.noteRegions);
    }
  };

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
