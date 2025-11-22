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
import { generateBassVoicing } from '../integration/bassAutoFill.js';

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

  // Create overlay canvas for visual feedback
  overlayCanvas = getOrCreateOverlayCanvas(primaryCanvas);

  // Create note editor for interactive editing
  noteEditor = new NoteEditor({
    canvas: primaryCanvas,
    overlayCanvas: overlayCanvas,
    layoutManager: notationComposer.layoutManager,
    composerIntegration: notationComposer, // For selected measure access
    onNoteAdd: (data) => {
      console.log('[NotationInit] onNoteAdd called:', data);

      // Use addNoteIntelligently for proper measure-filling and overflow handling
      // This works for both notes AND rests
      if (window.addNoteIntelligently) {
        // Set selected measure to match the clicked measure
        if (notationComposer && typeof notationComposer.setSelectedMeasure === 'function') {
          notationComposer.setSelectedMeasure(data.measureIndex);
        }

        const pitch = data.note.pitch || 'B4'; // Default pitch for rests (won't be used if isRest is true)
        const result = window.addNoteIntelligently(
          pitch,
          data.note.duration,
          data.note.dotted || false,
          data.staff,
          data.note.isRest || false,  // isRest flag
          data.note.accidental
        );

        console.log('[NotationInit] addNoteIntelligently result:', result);
      } else {
        // Fallback: Add directly to compositionState (old behavior)
        if (notationComposer.compositionState) {
          const measure = notationComposer.compositionState.getMeasure(data.measureIndex);
          console.log('[NotationInit] CompositionState measure:', measure);
          if (measure) {
            const voiceKey = data.staff === 'treble' ? 'treble' : 'bass';
            const voice = measure.notation[voiceKey].voices[0];
            console.log('[NotationInit] Voice before add:', voice?.notes);

            if (voice) {
              voice.notes.push({
                type: data.note.type || (data.note.isRest ? 'rest' : 'note'),
                pitch: data.note.pitch,
                pitches: data.note.pitches || (data.note.pitch ? [data.note.pitch] : []),
                duration: data.note.duration,
                isRest: data.note.isRest,
                dotted: data.note.dotted,
                accidental: data.note.accidental,
                beat: data.note.beat,
              });
              console.log('[NotationInit] Voice after add:', voice.notes);
            }
          }
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
      console.log('[NotationInit] onNoteMove called with', moves.length, 'moves');

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

              console.log('[NotationInit] Transposing note from', currentPitch, 'to', newPitch);

              if (note.pitches) {
                note.pitches = note.pitches.map(p => transposePitchBySteps(p, move.steps, move.staff));
              }
              // CRITICAL: Always update pitch property for playback
              note.pitch = newPitch;
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
              }
              // CRITICAL: Always update pitch property for playback
              note.pitch = newPitch;
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
      console.log('[NotationInit] onNoteDelete called:', deletion);

      // Delete from both data sources
      // 1. Delete from compositionState
      if (notationComposer.compositionState) {
        const measure = notationComposer.compositionState.getMeasure(deletion.measureIndex);
        console.log('[NotationInit] CompositionState measure:', measure);
        if (measure) {
          const voiceKey = deletion.staff === 'treble' ? 'treble' : 'bass';
          const notes = measure.notation[voiceKey]?.voices[0]?.notes;
          console.log('[NotationInit] Notes before delete:', notes);
          if (notes && deletion.noteIndex < notes.length) {
            notes.splice(deletion.noteIndex, 1);
            console.log('[NotationInit] Notes after delete:', notes);
          }
        }
      }

      // 2. Delete from measureManager
      if (notationComposer.measureManager) {
        const measure = notationComposer.measureManager.getMeasure(deletion.measureIndex);
        console.log('[NotationInit] MeasureManager measure:', measure);
        if (measure) {
          const notesArray = deletion.staff === 'treble' ? 'trebleNotes' : 'bassNotes';
          console.log(`[NotationInit] ${notesArray} before delete:`, measure[notesArray]);
          if (measure[notesArray] && deletion.noteIndex < measure[notesArray].length) {
            measure[notesArray].splice(deletion.noteIndex, 1);
            console.log(`[NotationInit] ${notesArray} after delete:`, measure[notesArray]);

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

      // NOTE: Legacy sync code REMOVED
      // interactiveMelody.melodyNotes is no longer used for note storage
      // All notes now live in compositionState only

      console.log('[NotationInit] Calling render...');
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
  notationComposer.render = function(...args) {
    originalRender(...args); // CRITICAL: Forward all arguments including bypassSyncCheck
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

/**
 * Update bass notes for a specific measure and re-render
 * This is used when chord properties change (like omittedNotes) without needing a full sync
 * @param {number} measureIndex - Index of measure to update
 * @param {object} chord - Chord data with all properties including omittedNotes
 * @returns {boolean} - True if update was performed
 */
export function updateMeasureBass(measureIndex, chord) {
  if (!notationComposer || !notationComposer.measureManager) {
    return false;
  }

  // Check if this measure exists
  if (measureIndex < 0 || measureIndex >= notationComposer.measureManager.measures.length) {
    console.warn('[NotationInit] Measure index out of bounds:', measureIndex);
    return false;
  }

  // Check if auto-generate bass is enabled
  const autoGenerateBass = document.getElementById('auto-generate-bass-toggle')?.checked ?? true;
  if (!autoGenerateBass) {
    // Don't update bass if auto-generate is disabled
    return false;
  }

  // Get previous chord for voice leading
  const previousMeasure = measureIndex > 0
    ? notationComposer.measureManager.measures[measureIndex - 1]
    : null;
  const previousChord = previousMeasure ? previousMeasure.chord : null;

  // Generate bass voicing
  const bassVoicing = generateBassVoicing(chord, previousChord, {
    voiceLeadingStrict: false,
    bassPattern: 'whole-note',
    timeSignature: '4/4',
  });

  // Update the measure's bass notes directly in measureManager
  const measure = notationComposer.measureManager.measures[measureIndex];
  measure.bassNotes = bassVoicing;
  measure.chord = chord; // Also update the chord reference

  // Re-render without full sync
  notationComposer.render();

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

/**
 * Get current notation toolbar state
 * @returns {Object} - {duration, isDotted, isRest, accidental}
 */
export function getNotationState() {
  if (noteEditor) {
    return {
      duration: noteEditor.currentDuration,
      isDotted: noteEditor.isDotted,
      isRest: noteEditor.isRestMode,
      accidental: noteEditor.currentAccidental,
    };
  }
  // Fallback defaults
  return {
    duration: '4n',
    isDotted: false,
    isRest: false,
    accidental: null,
  };
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

/**
 * Show keyboard shortcuts modal
 */
export function showNotationShortcuts() {
  // Create modal HTML
  const modalHTML = `
    <div id="notation-shortcuts-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="if(event.target===this) this.remove()">
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-bold text-gray-900">Notation Editor Keyboard Shortcuts</h3>
            <button onclick="document.getElementById('notation-shortcuts-modal').remove()" class="text-gray-400 hover:text-gray-600">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <h4 class="font-semibold text-violet-700 mb-2">Mouse Controls</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="font-medium">Click on note/chord</span><span class="text-gray-600">Select note (blue highlight)</span></div>
                <div class="flex justify-between"><span class="font-medium">Shift + Click</span><span class="text-gray-600">Multi-select notes</span></div>
                <div class="flex justify-between"><span class="font-medium">Alt + Click on staff</span><span class="text-gray-600">Add note at position</span></div>
                <div class="flex justify-between"><span class="font-medium">Alt + Hover on staff</span><span class="text-gray-600">Show ghost note preview</span></div>
                <div class="flex justify-between"><span class="font-medium">Click on empty measure</span><span class="text-gray-600">Select/play measure</span></div>
                <div class="flex justify-between"><span class="font-medium">Hold click on measure</span><span class="text-gray-600">Play measure (200ms hold)</span></div>
              </div>
            </div>

            <div>
              <h4 class="font-semibold text-violet-700 mb-2">Keyboard Controls</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="font-medium">Space or P</span><span class="text-gray-600">Play selected notes</span></div>
                <div class="flex justify-between"><span class="font-medium">Delete / Backspace</span><span class="text-gray-600">Delete selected notes</span></div>
                <div class="flex justify-between"><span class="font-medium">Arrow Up / Down</span><span class="text-gray-600">Transpose selected notes</span></div>
                <div class="flex justify-between"><span class="font-medium">Escape</span><span class="text-gray-600">Clear selection</span></div>
                <div class="flex justify-between"><span class="font-medium">Ctrl + A</span><span class="text-gray-600">Select all notes</span></div>
              </div>
            </div>

            <div>
              <h4 class="font-semibold text-violet-700 mb-2">Toolbar Controls</h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between"><span class="font-medium">Duration buttons</span><span class="text-gray-600">Set note duration (whole, half, quarter, etc.)</span></div>
                <div class="flex justify-between"><span class="font-medium">Dot button</span><span class="text-gray-600">Toggle dotted notes (1.5x duration)</span></div>
                <div class="flex justify-between"><span class="font-medium">Rest button</span><span class="text-gray-600">Add rests instead of notes</span></div>
                <div class="flex justify-between"><span class="font-medium">Accidental buttons</span><span class="text-gray-600">Add sharp, flat, or natural</span></div>
              </div>
            </div>

            <div class="bg-violet-50 border border-violet-200 rounded p-3">
              <p class="text-sm text-violet-900"><strong>Note:</strong> Bass clef notes from chord progression cards are auto-generated and cannot be deleted individually. To change them, modify the chord progression cards or disable "Auto-generate Bass" toggle.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Remove existing modal if any
  const existing = document.getElementById('notation-shortcuts-modal');
  if (existing) existing.remove();

  // Add to body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// ============================================================================
// WINDOW EXPORTS (for HTML event handlers)
// ============================================================================

// Export functions to window for HTML event handlers
if (typeof window !== 'undefined') {
  window.initEnhancedNotation = initEnhancedNotation;
  window.renderEnhancedNotation = renderEnhancedNotation;
  window.refreshNotationFromProgression = refreshNotationFromProgression;
  window.updateMeasureBass = updateMeasureBass;
  window.setNotationDuration = setNotationDuration;
  window.setNotationRestMode = setNotationRestMode;
  window.setNotationDotted = setNotationDotted;
  window.setNotationAccidental = setNotationAccidental;
  window.getNotationState = getNotationState;
  window.highlightPlayingNote = highlightPlayingNote;
  window.clearPlaybackHighlights = clearPlaybackHighlights;
  window.getNotationComposer = getNotationComposer;
  window.isNotationInitialized = isNotationInitialized;
  window.showNotationShortcuts = showNotationShortcuts;
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
  getNotationState,
  highlightPlayingNote,
  clearPlaybackHighlights,
  destroyEnhancedNotation,
};
