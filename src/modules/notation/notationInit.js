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
import { getCurrentKey, getSelectedChordIndex, invalidateProgressionDataCache } from '../state/trainerState.js';
import { generateBassVoicing } from '../integration/bassAutoFill.js';
import { initializeIntegratedSuggestions, FeatureFlags } from '../canvas/suggestions/index.js';
import { DEFAULT_TIME_SIGNATURE } from '../../data/music-data.js';

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
function transposePitchBySteps(pitch, steps, staff, keySignature = 'C') {
  // Keys that use flats (major and their relative minors)
  const flatKeys = ['F', 'Dm', 'Bb', 'Gm', 'Eb', 'Cm', 'Ab', 'Fm', 'Db', 'Bbm', 'Gb', 'Ebm', 'Cb', 'Abm'];
  const useFlats = flatKeys.includes(keySignature);

  // Chromatic scale with sharps
  const sharpNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  // Chromatic scale with flats
  const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  // Use appropriate scale based on key
  const notes = useFlats ? flatNotes : sharpNotes;

  // Parse pitch - handle both sharps and flats in input
  const match = pitch.match(/^([A-G][#b]?)(\d+)$/);
  if (!match) return pitch;

  const [, noteName, octave] = match;
  const octaveNum = parseInt(octave, 10);

  // Find note index - try sharp scale first, then flat scale
  let noteIndex = sharpNotes.indexOf(noteName);
  if (noteIndex === -1) {
    noteIndex = flatNotes.indexOf(noteName);
  }
  if (noteIndex === -1) {
    // Handle enharmonic equivalents
    const enharmonics = { 'Db': 1, 'Eb': 3, 'Gb': 6, 'Ab': 8, 'Bb': 10, 'C#': 1, 'D#': 3, 'F#': 6, 'G#': 8, 'A#': 10 };
    noteIndex = enharmonics[noteName];
  }

  if (noteIndex === undefined || noteIndex === -1) return pitch;

  // Calculate new position (steps are half-steps)
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
let suggestionManager = null;
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
    overlay.style.pointerEvents = 'none'; // Let clicks pass through to base canvas
    overlay.style.zIndex = '10';

    // Match dimensions
    overlay.width = baseCanvas.width;
    overlay.height = baseCanvas.height;

    // Insert after base canvas
    baseCanvas.parentElement.insertBefore(overlay, baseCanvas.nextSibling);

    // Function to update overlay position to match canvas
    // With multi-page system, no container scroll exists - pages use document scroll
    const updateOverlayPosition = () => {
      // Overlay is position:absolute, base canvas is position:static
      // Simply match the canvas position (no scroll adjustments needed)
      overlay.style.left = baseCanvas.offsetLeft + 'px';
      overlay.style.top = baseCanvas.offsetTop + 'px';
    };

    // Set initial position
    updateOverlayPosition();

    // Update overlay position/size when base canvas changes
    const resizeObserver = new ResizeObserver(() => {
      overlay.width = baseCanvas.width;
      overlay.height = baseCanvas.height;
      updateOverlayPosition();
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

  // Get canvas element (will be replaced by multi-page system)
  primaryCanvas = document.getElementById(canvasId);
  if (!primaryCanvas) {
    return null;
  }

  // Get page container (use the dedicated multi-page container)
  const pageContainer = document.getElementById('notation-pages-container') || primaryCanvas.parentElement;

  // Hide the old single canvas (PageManager will create new page canvases)
  primaryCanvas.style.display = 'none';

  // Check for existing toolbar container
  // Note: Toolbar creation is disabled for pagination mode as it may already exist in HTML
  toolbarContainer = document.getElementById(toolbarContainerId);
  if (!toolbarContainer && createToolbar && primaryCanvas.parentElement) {
    // Only create toolbar if we have a valid parent element
    // For pagination mode, toolbar should be defined in HTML
    try {
      toolbarContainer = document.createElement('div');
      toolbarContainer.id = toolbarContainerId;
      toolbarContainer.className = 'notation-toolbar-container mb-4';
      primaryCanvas.parentElement.insertBefore(toolbarContainer, primaryCanvas);
    } catch (e) {
      console.warn('Could not create toolbar container:', e);
      toolbarContainer = null;
    }
  }

  // Create or reuse the notation composer
  if (notationComposer) {
    // Already initialized - just sync and render
    notationComposer.syncFromProgression();
    return notationComposer;
  }


  // Get page navigator container
  const pageNavigatorContainer = document.getElementById('notation-page-navigator');

  // Create new notation composer with PageManager and Pagination
  notationComposer = new NotationComposer({
    container: primaryCanvas, // Legacy - kept for backward compat
    pageContainer: pageContainer, // Multi-page container
    toolbarContainer: toolbarContainer,
    pageNavigatorContainer: pageNavigatorContainer, // NEW: Page navigation controls
    measuresPerLine: 4,
    showMeasureNumbers: true,
    showChordSymbols: true,
    enableHarmonicColoring: true,
    enableMelodySuggestions: true,
    enablePagination: true, // NEW: Enable pagination
    viewMode: 'single', // NEW: Single page view
    onUpdate: handleNotationUpdate,
    onSelectionChange: handleSelectionChange,
    onNoteAdded: handleNoteAdded,
    autoInit: false, // We'll init manually after setup
  });

  // Initialize now (creates PageManager)
  notationComposer.init();

  // Create overlay canvas for visual feedback (legacy, for selection highlights)
  overlayCanvas = getOrCreateOverlayCanvas(primaryCanvas);

  // Create note editor for interactive editing
  // For multi-page: Will attach events to page canvases via PageManager
  noteEditor = new NoteEditor({
    canvas: primaryCanvas, // Legacy - not used in multi-page mode
    overlayCanvas: overlayCanvas, // For selection highlights
    layoutManager: notationComposer.layoutManager,
    composerIntegration: notationComposer, // For selected measure access
    pageManager: notationComposer.pageManager, // Multi-page support
    onNoteAdd: (data) => {
      // Use addNoteIntelligently for proper measure-filling and overflow handling
      // This works for both notes AND rests
      if (window.addNoteIntelligently) {
        // Set selected measure to match the clicked measure
        if (notationComposer && typeof notationComposer.setSelectedMeasure === 'function') {
          notationComposer.setSelectedMeasure(data.measureIndex);
        }

        const pitch = data.note.pitch || 'B4'; // Default pitch for rests (won't be used if isRest is true)
        window.addNoteIntelligently(
          pitch,
          data.note.duration,
          data.note.dotted || false,
          data.staff,
          data.note.isRest || false,  // isRest flag
          data.note.accidental,
          data.note.articulation,  // Pass articulation from toolbar
          data.note.tuplet  // Pass tuplet attribute for tuplet insert mode
        );
      } else {
        // Fallback: Add directly to compositionState with beat validation
        if (notationComposer.compositionState) {
          const measure = notationComposer.compositionState.getMeasure(data.measureIndex);
          if (measure) {
            const voiceKey = data.staff === 'treble' ? 'treble' : 'bass';
            // MULTI-VOICE: Use current voice for the appropriate staff
            const voiceIndex = notationComposer.compositionState.getActiveVoiceIndexForStaff(data.staff);
            // Ensure voice exists
            while (measure.notation[voiceKey].voices.length <= voiceIndex) {
              measure.notation[voiceKey].voices.push({ notes: [] });
            }
            const voice = measure.notation[voiceKey].voices[voiceIndex];

            if (voice) {
              // Calculate used beats in this voice
              // Supports canonical format: duration='2n', dotted=true
              const localDurationToBeats = (dur, dotted = false) => {
                const map = { '1n': 4, '2n': 2, '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125 };
                const hasDotInString = dur?.includes('.');
                let beats = map[dur?.replace('.', '')] || 1;
                if (hasDotInString || dotted) beats *= 1.5;
                return beats;
              };
              let usedBeats = 0;
              for (const note of voice.notes) {
                let beats = localDurationToBeats(note.duration || '4n', note.dotted);
                usedBeats += beats;
              }

              // Calculate beats for new note
              let noteBeats = localDurationToBeats(data.note.duration || '4n', data.note.dotted);

              // Get beats per measure from time signature
              const ts = notationComposer.compositionState?.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE;
              const maxBeats = ts.num * (4 / ts.denom); // e.g., 6/8 = 3, 4/4 = 4
              if (usedBeats + noteBeats > maxBeats + 0.01) {
                console.warn(`[onNoteAdd] Cannot add note - would exceed ${maxBeats} beats (used: ${usedBeats}, adding: ${noteBeats})`);
                return;
              }

              voice.notes.push({
                type: data.note.type || (data.note.isRest ? 'rest' : 'note'),
                pitch: data.note.pitch,
                pitches: data.note.pitches || (data.note.pitch ? [data.note.pitch] : []),
                duration: data.note.duration,
                isRest: data.note.isRest,
                dotted: data.note.dotted,
                accidental: data.note.accidental,
                beat: data.note.beat,
                tuplet: data.note.tuplet, // Preserve tuplet attributes
              });
            }
          }
        }
      }

      // Sync treble changes to block sequence (if using treble block sequence)
      if (data.staff === 'treble' && notationComposer.compositionState?.trebleBlockSequence?.blocks?.length > 0) {
        notationComposer.compositionState.syncMeasuresToTrebleBlock();
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
        const isPitchSpecific = move.pitchIndex !== null && move.pitchIndex !== undefined;

        // BASS TRANSPOSITION DEBUG LOGGING
        if (move.staff === 'bass') {
        }

        // 1. Update compositionState
        if (notationComposer.compositionState) {
          const measure = notationComposer.compositionState.getMeasure(move.measureIndex);
          if (measure) {
            const voiceKey = move.staff === 'treble' ? 'treble' : 'bass';
            // Use voiceIndex from move if available, otherwise use active voice for the staff
            const voiceIndex = move.voiceIndex !== undefined ? move.voiceIndex :
                (notationComposer.compositionState.getActiveVoiceIndexForStaff ? notationComposer.compositionState.getActiveVoiceIndexForStaff(move.staff) : 0);
            const note = measure.notation[voiceKey]?.voices[voiceIndex]?.notes[move.noteIndex];

            // BASS DEBUG: Log state before transposition
            if (move.staff === 'bass') {
              console.log('[BASS TRANSPOSE] Note BEFORE:', JSON.stringify({ pitch: note?.pitch, pitches: note?.pitches }));
            }

            if (note && move.steps !== 0) {
              // Get key signature for proper accidental spelling (sharps vs flats)
              const keySignature = notationComposer.compositionState?.metadata?.key || 'C';

              if (isPitchSpecific && note.pitches && note.pitches.length > 1) {
                // Pitch-specific transposition: only transpose the selected pitch within the chord
                const currentPitch = note.pitches[move.pitchIndex];
                const newPitch = transposePitchBySteps(currentPitch, move.steps, move.staff, keySignature);
                note.pitches[move.pitchIndex] = newPitch;
                // Update pitch property to the transposed pitch (for playback highlighting)
                note.pitch = note.pitches[0];
              } else {
                // Whole note/chord transposition: transpose all pitches
                const currentPitch = note.pitch || note.pitches?.[0] || 'C4';
                const newPitch = transposePitchBySteps(currentPitch, move.steps, move.staff, keySignature);

                if (note.pitches) {
                  note.pitches = note.pitches.map(p => transposePitchBySteps(p, move.steps, move.staff, keySignature));
                }
                // CRITICAL: Always update pitch property for playback
                note.pitch = newPitch;
              }

              // BASS DEBUG: Log state after transposition
              if (move.staff === 'bass') {
                console.log('[BASS TRANSPOSE] Note AFTER:', JSON.stringify({ pitch: note?.pitch, pitches: note?.pitches }));
                // Verify the note object is the same as measure.notation.bass.voices[0].notes[0]
                const measureNote = measure.notation.bass?.voices?.[0]?.notes?.[move.noteIndex];
                console.log('[BASS TRANSPOSE] measureNote AFTER:', JSON.stringify({ pitch: measureNote?.pitch, pitches: measureNote?.pitches }));
                // Log IMMEDIATELY after to catch any mutation
                setTimeout(() => {
                  console.log('[BASS TRANSPOSE] 0ms later - measureNote:', JSON.stringify({ pitch: measureNote?.pitch, pitches: measureNote?.pitches }));
                }, 0);
              }
            }
          }
        }

        // 2. Update measureManager - SKIP if this is the same note object as compositionState
        // (they share references, so transposing again would double-transpose!)
        if (notationComposer.measureManager?.measures) {
          const mmMeasure = notationComposer.measureManager.measures[move.measureIndex];
          if (mmMeasure) {
            const notesArray = move.staff === 'treble' ? 'trebleNotes' : 'bassNotes';
            const mmNote = mmMeasure[notesArray]?.[move.noteIndex];

            // Get the compositionState note to check if it's the same object
            const csMeasure = notationComposer.compositionState?.getMeasure(move.measureIndex);
            const voicesKey = move.staff === 'treble' ? 'treble' : 'bass';
            const csNote = csMeasure?.notation?.[voicesKey]?.voices?.[0]?.notes?.[move.noteIndex];

            // Check if the pitches arrays are the same reference
            const sameArray = mmNote?.pitches === csNote?.pitches;

            if (move.staff === 'bass') {
              console.log('[BASS TRANSPOSE] measureManager note pitches:', JSON.stringify(mmNote?.pitches));
              console.log('[BASS TRANSPOSE] compositionState note pitches:', JSON.stringify(csNote?.pitches));
            }

            // ONLY transpose if the arrays are different (not shared references)
            if (mmNote && move.steps !== 0 && !sameArray) {
              // Get key signature for proper accidental spelling (sharps vs flats)
              const keySignature = notationComposer.compositionState?.metadata?.key || 'C';

              if (isPitchSpecific && mmNote.pitches && mmNote.pitches.length > 1) {
                // Pitch-specific transposition
                const currentPitch = mmNote.pitches[move.pitchIndex];
                const newPitch = transposePitchBySteps(currentPitch, move.steps, move.staff, keySignature);
                mmNote.pitches[move.pitchIndex] = newPitch;
                mmNote.pitch = mmNote.pitches[0];
              } else {
                // Whole note/chord transposition
                const currentPitch = mmNote.pitch || mmNote.pitches?.[0] || 'C4';
                const newPitch = transposePitchBySteps(currentPitch, move.steps, move.staff, keySignature);

                if (mmNote.pitches) {
                  mmNote.pitches = mmNote.pitches.map(p => transposePitchBySteps(p, move.steps, move.staff, keySignature));
                }
                // CRITICAL: Always update pitch property for playback
                mmNote.pitch = newPitch;
              }
            } else if (sameArray && move.staff === 'bass') {
            }
          }
        }
      });

      // For pitch-only changes (arrow up/down), use lightweight pitch sync
      // instead of full block rebuild - much faster for simple transpositions
      const hasTrebleMoves = moves.some(m => m.staff === 'treble');
      if (hasTrebleMoves && notationComposer.compositionState?.trebleBlockSequence?.blocks?.length > 0) {
        // Use lightweight pitch-only sync for each treble move
        moves.forEach(move => {
          if (move.staff === 'treble') {
            const measure = notationComposer.compositionState.getMeasure(move.measureIndex);
            if (measure) {
              // Use voiceIndex from move if available, otherwise use active voice for the staff
              const voiceIndex = move.voiceIndex !== undefined ? move.voiceIndex :
                  (notationComposer.compositionState.getActiveVoiceIndexForStaff ? notationComposer.compositionState.getActiveVoiceIndexForStaff('treble') : 0);
              const note = measure.notation.treble?.voices[voiceIndex]?.notes[move.noteIndex];
              if (note) {
                const pitches = note.pitches || (note.pitch ? [note.pitch] : []);
                notationComposer.compositionState.syncTreblePitchOnly(move.measureIndex, move.noteIndex, pitches);
              }
            }
          }
        });
      }

      // Handle bass note moves - save the entire building block
      const hasBassMoves = moves.some(m => m.staff === 'bass');
      if (hasBassMoves && notationComposer.compositionState) {
        moves.forEach(move => {
          if (move.staff === 'bass') {
            const measure = notationComposer.compositionState.getMeasure(move.measureIndex);
            if (measure && measure.notation?.bass) {
              // Mark as user-edited (not auto-generated)
              measure.notation.bass.autoGenerated = false;

              // BASS DEBUG: Log what's in the measure BEFORE saving
              const bassNotes = measure.notation.bass.voices?.[0]?.notes || [];
              console.log('[BASS TRANSPOSE] Measure', move.measureIndex, 'bass notes BEFORE save:', JSON.stringify(bassNotes.map(n => ({ pitch: n.pitch, pitches: n.pitches }))));

              // Save the entire building block for this chord
              notationComposer.compositionState.saveEditedBassNotesForMeasure(move.measureIndex);

              // BASS DEBUG: Log what's in the building block AFTER saving
              const chordIndex = measure.chord?.chordIndex;
              if (chordIndex !== undefined) {
                const block = notationComposer.compositionState.bassBlockSequence?.blocks?.[chordIndex];
                if (block) {
                  const blockNotes = block.getNotes ? block.getNotes() : [];
                  console.log('[BASS TRANSPOSE] Building block', chordIndex, 'notes AFTER save:', blockNotes.map(n => ({ pitches: n.pitches, startUnit: n.startUnit })));
                }
              }
            }
          }
        });

        // BASS DEBUG: Log final state before render
        moves.forEach(move => {
          if (move.staff === 'bass') {
            const measure = notationComposer.compositionState.getMeasure(move.measureIndex);
            const bassNotes = measure?.notation?.bass?.voices?.[0]?.notes || [];
            console.log('[BASS TRANSPOSE] Final measure', move.measureIndex, 'bass:', bassNotes.map(n => ({ pitch: n.pitch, pitches: n.pitches })));
          }
        });
      }

      notationComposer.render();

      // BASS DEBUG: Log what got rendered
      if (hasBassMoves && notationComposer.compositionState) {
        moves.forEach(move => {
          if (move.staff === 'bass') {
            const measure = notationComposer.compositionState.getMeasure(move.measureIndex);
            const bassNotes = measure?.notation?.bass?.voices?.[0]?.notes || [];
            console.log('[BASS TRANSPOSE] Rendered measure', move.measureIndex, 'bass:', bassNotes.map(n => ({ pitch: n.pitch, pitches: n.pitches })));
          }
        });
      }

      // Update note regions after move
      if (notationComposer.noteRegions) {
        noteEditor.setNoteRegions(notationComposer.noteRegions);
      }
    },
    onNoteSelect: (noteIds) => {
      // Handle note selection changes
      noteEditor.selectedNotes = new Set(noteIds);
      noteEditor.renderOverlay();

      // Update toolbar with selection state for contextual editing
      if (notationComposer && notationComposer.toolbar) {
        // Get full note objects from composition state
        const selectedNoteObjects = [];
        const selectedVoices = new Set();

        if (notationComposer.compositionState) {
          noteIds.forEach(noteId => {
            // Parse note ID using NoteEditor's parser to handle negative noteIndex encoding
            const { measureIndex, staff, voiceIndex, noteIndex, pitchIndex } = NoteEditor.parseNoteId(noteId);

            // Track which voices are selected
            selectedVoices.add(voiceIndex);

            const measure = notationComposer.compositionState.getMeasure(measureIndex);

            if (measure) {
              const voiceKey = staff;
              // Use the correct voice index from the note ID
              const notes = measure.notation[voiceKey]?.voices[voiceIndex]?.notes;

              // Handle auto-generated rests (noteIndex === -1) - these don't exist in compositionState
              if (noteIndex === -1) {
                console.log(`[onNoteSelectionChanged] Auto-generated rest selected (noteIndex=-1)`);
                // Get the rest info from noteEditor (includes duration, beat, etc.)
                const restInfo = noteEditor.getAutoGeneratedRestInfo(noteId);
                // Create a synthetic note object for the toolbar to recognize this as a rest
                const syntheticRest = {
                  isRest: true,
                  type: restInfo?.duration || '4n', // Use actual duration from rest info
                  measureIndex,
                  staff,
                  voiceIndex,
                  noteIndex: -1,
                  pitchIndex: null,
                  beat: restInfo?.beat,
                  _autoGenerated: true
                };
                selectedNoteObjects.push(syntheticRest);
                return; // Continue to next noteId
              }

              const note = notes?.[noteIndex];
              if (note) {
                // Create note object for toolbar
                const noteObj = {
                  ...note,
                  measureIndex,
                  staff,
                  voiceIndex,
                  noteIndex,
                  pitchIndex
                };

                // For pitch-specific selections, get the accidental for that specific pitch
                if (pitchIndex !== null && note.accidentals && note.accidentals[pitchIndex]) {
                  noteObj.accidental = note.accidentals[pitchIndex];
                }

                // For pitch-specific selections, set the selected pitch
                if (pitchIndex !== null && note.pitches && note.pitches[pitchIndex]) {
                  noteObj.selectedPitch = note.pitches[pitchIndex];
                }

                selectedNoteObjects.push(noteObj);
              }
            }
          });
        }

        // Update the voice selector to match the selected note's voice
        // Only update if all selected notes are from the same voice
        if (selectedVoices.size === 1) {
          const selectedVoice = [...selectedVoices][0];
          // Voice selector uses 1-based index (Voice 1, Voice 2), but internal is 0-based
          notationComposer.toolbar.setVoiceDisplay(selectedVoice + 1);
        }

        notationComposer.toolbar.updateSelectionState(selectedNoteObjects);
      }

      // Phase 4: Trigger melody suggestion updates when note selection changes
      if (window.onTrebleNoteSelectionChanged) {
        // Get the selected treble note info for melody suggestions
        const trebleNoteIds = noteIds.filter(id => id.split('-')[1] === 'treble');
        window.onTrebleNoteSelectionChanged(trebleNoteIds);
      }
    },
    onNoteDelete: (deletion) => {
      // Get voice index from deletion (default to 0 for backward compatibility)
      const voiceIndex = deletion.voiceIndex ?? 0;

      // Handle auto-generated rest deletion (noteIndex === -1)
      // These rests don't exist in compositionState - they're created by fillGapsWithRests during rendering
      // Deleting a rest is a no-op - rests maintain rhythmic structure
      if (deletion.noteIndex === -1) {
        notationComposer.render(); // Re-render to clear selection highlighting
        return;
      }

      // Helper to clear isTied flag on the next note when deleting the first note of a tie
      const clearTieOnNextNote = (measureIndex, staff, vIdx, noteIndex) => {
        if (!notationComposer.compositionState) return;

        const measure = notationComposer.compositionState.getMeasure(measureIndex);
        if (!measure) return;

        const voiceKey = staff === 'treble' ? 'treble' : 'bass';
        const notes = measure.notation[voiceKey]?.voices[vIdx]?.notes;
        if (!notes) return;

        // If there's a note after the one being deleted, clear its isTied flag
        // (noteIndex + 1 becomes noteIndex after deletion, so we check noteIndex + 1 before deletion)
        if (noteIndex + 1 < notes.length) {
          const nextNote = notes[noteIndex + 1];
          if (nextNote && (nextNote.isTied || nextNote.tied)) {
            delete nextNote.isTied;
            delete nextNote.tied;
          }
        } else if (noteIndex === notes.length - 1) {
          // Deleted note was the last in this measure - check first note of next measure
          const nextMeasure = notationComposer.compositionState.getMeasure(measureIndex + 1);
          if (nextMeasure) {
            const nextNotes = nextMeasure.notation[voiceKey]?.voices[vIdx]?.notes;
            if (nextNotes && nextNotes.length > 0) {
              const firstNextNote = nextNotes[0];
              if (firstNextNote && (firstNextNote.isTied || firstNextNote.tied)) {
                delete firstNextNote.isTied;
                delete firstNextNote.tied;
              }
            }
          }
        }
      };

      // Clear tie on next note before replacing with rest (must happen before the conversion)
      clearTieOnNextNote(deletion.measureIndex, deletion.staff, voiceIndex, deletion.noteIndex);

      // Replace note with rest(s) of the same total duration (preserves rhythmic structure)
      // Dotted durations need to be split into multiple rests since VexFlow doesn't support dotted rests well
      // e.g., dotted half (3 beats) -> half rest + quarter rest

      // Helper to convert duration to beats (with tuplet support)
      // Supports canonical format: duration='2n', dotted=true
      const durationToBeats = (dur, dotted = false) => {
        const map = {
          '1n': 4, '1n.': 6,
          '2n': 2, '2n.': 3,
          '4n': 1, '4n.': 1.5,
          '8n': 0.5, '8n.': 0.75,
          '16n': 0.25, '16n.': 0.375,
          '32n': 0.125,
        };

        // Tuplet ratios
        const tupletRatios = {
          triplet: { actual: 3, normal: 2 },
          quintuplet: { actual: 5, normal: 4 },
          sextuplet: { actual: 6, normal: 4 },
        };

        // Check for tuplet duration suffix (t=triplet, q=quintuplet, x=sextuplet)
        let baseDuration = dur;
        let tupletType = null;
        if (dur && typeof dur === 'string') {
          if (dur.endsWith('t') && /^\d+t$/.test(dur)) {
            baseDuration = dur.replace('t', 'n');
            tupletType = 'triplet';
          } else if (dur.endsWith('q') && /^\d+q$/.test(dur)) {
            baseDuration = dur.replace('q', 'n');
            tupletType = 'quintuplet';
          } else if (dur.endsWith('x') && /^\d+x$/.test(dur)) {
            baseDuration = dur.replace('x', 'n');
            tupletType = 'sextuplet';
          }
        }

        // Check for dotted in string format
        const hasDotInString = dur?.includes('.');
        let beats = map[baseDuration] || 1;

        // Apply tuplet ratio if this is a tuplet note
        if (tupletType && tupletRatios[tupletType]) {
          const ratio = tupletRatios[tupletType];
          beats = beats * (ratio.normal / ratio.actual);
        }

        // Apply dotted multiplier if dotted flag is true and not already in string
        if (dotted && !hasDotInString) {
          beats = beats * 1.5;
        }

        return beats;
      };

      // Helper to convert beats to duration string
      const beatsToDuration = (beats) => {
        if (beats >= 4) return '1n';
        if (beats >= 2) return '2n';
        if (beats >= 1) return '4n';
        if (beats >= 0.5) return '8n';
        if (beats >= 0.25) return '16n';
        return '32n';
      };

      // Helper to split a dotted duration into multiple non-dotted rests
      // voiceIdx parameter ensures rests stay in the correct voice for multi-voice notation
      // dotted parameter supports canonical format { duration: '2n', dotted: true }
      const splitDottedDuration = (duration, startBeat, voiceIdx, dotted = false) => {
        const totalBeats = durationToBeats(duration, dotted);
        const rests = [];

        // Check for dotted in BOTH formats: duration ending with '.' OR separate dotted flag
        const hasDotInString = duration.endsWith('.');
        const isDotted = hasDotInString || dotted;

        // For dotted durations, split into base + half of base
        // e.g., dotted half (3 beats) = half (2) + quarter (1)
        // e.g., dotted quarter (1.5 beats) = quarter (1) + eighth (0.5)
        if (isDotted) {
          // Get base duration (remove dot from string if present, or use duration as-is for canonical format)
          const baseDuration = hasDotInString ? duration.slice(0, -1) : duration;
          const baseBeats = durationToBeats(baseDuration);
          const dotBeats = baseBeats / 2;
          // For Voice 2 (voiceIdx === 1), mark as cue rest for multi-voice notation
          const isCueRest = voiceIdx === 1;

          rests.push({
            type: 'rest',
            isRest: true,
            duration: baseDuration,
            beat: startBeat,
            voiceIndex: voiceIdx, // Preserve voice for multi-voice support
            _userCreated: true, // Mark as user-created (from deletion) to distinguish from auto-generated
            _restDisplay: isCueRest ? { hidden: false, isCue: true } : undefined, // Apply cue styling for Voice 2
          });
          rests.push({
            type: 'rest',
            isRest: true,
            duration: beatsToDuration(dotBeats),
            beat: startBeat + baseBeats,
            voiceIndex: voiceIdx, // Preserve voice for multi-voice support
            _userCreated: true,
            _restDisplay: isCueRest ? { hidden: false, isCue: true } : undefined, // Apply cue styling for Voice 2
          });
        } else {
          // Non-dotted duration - just create a single rest
          // For Voice 2 (voiceIdx === 1), mark as cue rest for multi-voice notation
          const isCueRest = voiceIdx === 1;
          rests.push({
            type: 'rest',
            isRest: true,
            duration: duration,
            beat: startBeat,
            voiceIndex: voiceIdx, // Preserve voice for multi-voice support
            _userCreated: true, // Mark as user-created (from deletion) to distinguish from auto-generated
            _restDisplay: isCueRest ? { hidden: false, isCue: true } : undefined, // Apply cue styling for Voice 2
          });
        }

        return rests;
      };

      // Check if the item being deleted is already a rest
      let isAlreadyRest = false;
      if (notationComposer.compositionState) {
        const measure = notationComposer.compositionState.getMeasure(deletion.measureIndex);
        if (measure) {
          const voiceKey = deletion.staff === 'treble' ? 'treble' : 'bass';
          const notes = measure.notation[voiceKey]?.voices[voiceIndex]?.notes;
          if (notes && deletion.noteIndex < notes.length) {
            const originalNote = notes[deletion.noteIndex];
            isAlreadyRest = originalNote.isRest || originalNote.type === 'rest';
          } else {
          }
        }
      }

      // If it's already a rest and NOT shift-delete, do nothing - rests maintain rhythmic structure
      // Users who want to "fill" a rest should add a note there instead
      // But for shift-delete, we CAN remove rests to compact the timeline
      if (isAlreadyRest && !deletion.shiftDelete) {
        notationComposer.render(); // Re-render to clear selection highlighting
        return;
      }

      // SHIFT DELETE: Remove note/rest and shift subsequent notes left (doesn't preserve rhythmic structure)
      if (deletion.shiftDelete && notationComposer.compositionState) {
        const timeSignature = notationComposer.compositionState.metadata?.timeSignature || { num: 4, denom: 4 };
        const beatsPerMeasure = timeSignature.num * (4 / timeSignature.denom);

        // DEBUG: Log initial state of measures 1 and 2
        console.log('[SHIFT-DELETE] === Starting shift-delete operation ===');
        console.log('[SHIFT-DELETE] beatsPerMeasure:', beatsPerMeasure);
        for (let m = 0; m < Math.min(3, notationComposer.compositionState.measures.length); m++) {
          const meas = notationComposer.compositionState.getMeasure(m);
          if (meas) {
            const trebleNotes = meas.notation?.treble?.voices?.[0]?.notes || [];
            console.log(`[SHIFT-DELETE] Measure ${m + 1} BEFORE:`, trebleNotes.map(n => ({
              pitch: n.pitch || n.pitches,
              beat: n.beat,
              duration: n.duration,
              beats: durationToBeats(n.duration || '4n'),
              isRest: n.isRest
            })));
          }
        }

        // Handle batch deletions (multiple selections deleted at once)
        if (deletion.batchDeletions && deletion.batchDeletions.length > 1) {
          const batchDeletions = deletion.batchDeletions;
          console.log('[SHIFT-DELETE] Batch deletions count:', batchDeletions.length);

          // All deletions in a batch are from the same staff/voice
          const staff = batchDeletions[0].staff;
          const batchVoiceIndex = batchDeletions[0].voiceIndex ?? 0;
          const voiceKey = staff === 'treble' ? 'treble' : 'bass';

          // TREBLE STAFF with Voice 0: Use block sequence approach
          if (staff === 'treble' && batchVoiceIndex === 0) {
            const compositionState = notationComposer.compositionState;

            // Step 1: Sync measures to block FIRST
            if (compositionState.trebleBlockSequence?.blocks?.length > 0) {
              compositionState.syncMeasuresToTrebleBlock();
            } else {
              compositionState.initializeTrebleBlockSequence();
            }

            // Step 2: Collect unit positions for all notes to delete
            const unitsToDelete = [];
            for (const del of batchDeletions) {
              const noteInfo = compositionState.getTrebleNoteUnit(del.measureIndex, del.noteIndex);
              if (noteInfo) {
                unitsToDelete.push({
                  startUnit: noteInfo.startUnit,
                  durationUnits: noteInfo.durationUnits,
                  measureIndex: del.measureIndex,
                  noteIndex: del.noteIndex
                });
              }
            }

            console.log('[SHIFT-DELETE] Using block sequence approach for batch treble deletion');
            console.log('[SHIFT-DELETE] Units to delete:', unitsToDelete.map(u => ({
              startUnit: u.startUnit,
              durationUnits: u.durationUnits
            })));

            // Sort by startUnit DESCENDING so we delete from end first
            // This prevents earlier deletions from invalidating later positions
            unitsToDelete.sort((a, b) => b.startUnit - a.startUnit);

            // Step 3: Delete each note using block sequence approach
            for (const unitInfo of unitsToDelete) {
              compositionState.deleteTrebleNoteWithShift(unitInfo.startUnit, true);
            }

            // Log final state
            console.log('[SHIFT-DELETE] === After batch shift-delete complete ===');
            for (let m = 0; m < Math.min(3, compositionState.measures.length); m++) {
              const meas = compositionState.getMeasure(m);
              if (meas) {
                const notesLog = meas.notation?.treble?.voices?.[0]?.notes || [];
                let totalBeats = 0;
                const details = notesLog.map(n => {
                  const beats = durationToBeats(n.duration || '4n');
                  totalBeats += beats;
                  return {
                    beat: n.beat,
                    duration: n.duration,
                    beats: beats,
                    pitch: n.pitch || n.pitches,
                    tied: n.tied || false,
                    isTied: n.isTied || false
                  };
                });
                console.log(`[SHIFT-DELETE] Measure ${m + 1} AFTER: totalBeats=${totalBeats}`, details);
              }
            }

            notationComposer.render();
            return;
          }

          // BASS STAFF or VOICE 2+: Use old measure-based approach
          // Collect all notes to delete with their absolute positions
          const notesToDelete = [];
          for (const del of batchDeletions) {
            const measure = notationComposer.compositionState.getMeasure(del.measureIndex);
            if (!measure) continue;
            const notes = measure.notation[voiceKey]?.voices[batchVoiceIndex]?.notes;
            if (!notes || del.noteIndex >= notes.length) continue;

            const note = notes[del.noteIndex];
            const absoluteBeat = del.measureIndex * beatsPerMeasure + (note.beat || 0);
            notesToDelete.push({
              measureIndex: del.measureIndex,
              noteIndex: del.noteIndex,
              beat: note.beat || 0,
              absoluteBeat,
              duration: note.duration || '4n',
              beats: durationToBeats(note.duration || '4n')
            });
          }

          console.log('[SHIFT-DELETE] Using measure-based approach for batch bass/voice2+ deletion');
          console.log('[SHIFT-DELETE] Notes to delete:', notesToDelete.map(n => ({
            measure: n.measureIndex + 1,
            beat: n.beat,
            duration: n.duration,
            beats: n.beats,
            absoluteBeat: n.absoluteBeat
          })));

          // Sort by absolute beat descending so we can remove from end first (preserves indices)
          notesToDelete.sort((a, b) => b.absoluteBeat - a.absoluteBeat);

          // Track total beats removed for shifting
          let totalShiftBeats = 0;
          let earliestAbsoluteBeat = Infinity;
          let earliestMeasureIndex = Infinity;
          let earliestBeat = 0;

          // Remove notes from end to beginning (preserves indices)
          for (const noteInfo of notesToDelete) {
            const measure = notationComposer.compositionState.getMeasure(noteInfo.measureIndex);
            if (!measure) continue;
            const notes = measure.notation[voiceKey]?.voices[batchVoiceIndex]?.notes;
            if (!notes) continue;

            // Find the note by beat position (indices may have changed due to earlier deletions)
            const actualIndex = notes.findIndex(n =>
              Math.abs((n.beat || 0) - noteInfo.beat) < 0.001
            );

            console.log(`[SHIFT-DELETE] Removing note at measure ${noteInfo.measureIndex + 1}, beat ${noteInfo.beat}, found at index ${actualIndex}`);

            if (actualIndex >= 0) {
              // Clear tie on next note
              clearTieOnNextNote(noteInfo.measureIndex, staff, batchVoiceIndex, actualIndex);

              // Remove the note
              notes.splice(actualIndex, 1);
              totalShiftBeats += noteInfo.beats;

              // Track the earliest position for shifting
              if (noteInfo.absoluteBeat < earliestAbsoluteBeat) {
                earliestAbsoluteBeat = noteInfo.absoluteBeat;
                earliestMeasureIndex = noteInfo.measureIndex;
                earliestBeat = noteInfo.beat;
              }
            }
          }

          console.log('[SHIFT-DELETE] Total beats to shift:', totalShiftBeats);
          console.log('[SHIFT-DELETE] Earliest position - measure:', earliestMeasureIndex + 1, 'beat:', earliestBeat);

          // Shift all subsequent notes backward by total beats removed
          if (noteEditor && totalShiftBeats > 0 && earliestMeasureIndex < Infinity) {
            noteEditor.shiftNotesBackward(
              earliestMeasureIndex,
              earliestBeat,
              totalShiftBeats,
              staff,
              batchVoiceIndex,
              notationComposer.compositionState,
              beatsPerMeasure
            );
          }

          // DEBUG: Log final state after shift
          console.log('[SHIFT-DELETE] === After shift (final state) ===');
          for (let m = 0; m < Math.min(3, notationComposer.compositionState.measures.length); m++) {
            const meas = notationComposer.compositionState.getMeasure(m);
            if (meas) {
              const trebleNotes = meas.notation?.treble?.voices?.[0]?.notes || [];
              console.log(`[SHIFT-DELETE] Measure ${m + 1}:`, trebleNotes.map(n => ({
                pitch: n.pitch || n.pitches,
                beat: n.beat,
                duration: n.duration,
                beats: durationToBeats(n.duration || '4n'),
                isRest: n.isRest
              })));
            }
          }

          if (staff === 'bass') {
            notationComposer.compositionState.saveEditedBassNotesForMeasure(earliestMeasureIndex);
          }

          notationComposer.render();
          return;
        }

        // Single deletion (original logic)
        console.log('[SINGLE-SHIFT-DELETE] === Starting single note shift-delete ===');
        console.log('[SINGLE-SHIFT-DELETE] Deleting from measure:', deletion.measureIndex + 1, 'noteIndex:', deletion.noteIndex);

        // Log FULL state of first 3 measures BEFORE deletion
        for (let m = 0; m < Math.min(3, notationComposer.compositionState.measures.length); m++) {
          const meas = notationComposer.compositionState.getMeasure(m);
          if (meas) {
            const voiceKeyLog = deletion.staff === 'treble' ? 'treble' : 'bass';
            const notesLog = meas.notation?.[voiceKeyLog]?.voices?.[voiceIndex]?.notes || [];
            console.log(`[SINGLE-SHIFT-DELETE] Measure ${m + 1} BEFORE:`, notesLog.map(n => ({
              beat: n.beat,
              duration: n.duration,
              beats: durationToBeats(n.duration || '4n'),
              pitch: n.pitch || n.pitches,
              tied: n.tied || false,
              isTied: n.isTied || false
            })));
          }
        }

        // Use new extract→rebuild approach for ALL staffs/voices (NO SYNC architecture)
        if (noteEditor && noteEditor.deleteNoteWithShift) {
          const compositionState = notationComposer.compositionState;
          const clef = deletion.staff === 'treble' ? 'treble' : 'bass';

          console.log('[SINGLE-SHIFT-DELETE] Using extract→rebuild approach');

          // Call the new deleteNoteWithShift method
          noteEditor.deleteNoteWithShift(clef, voiceIndex, deletion.measureIndex, deletion.noteIndex, compositionState);

          // Log FULL state AFTER shift
          console.log('[SINGLE-SHIFT-DELETE] === After shift-delete complete ===');
          for (let m = 0; m < Math.min(3, compositionState.measures.length); m++) {
            const meas = compositionState.getMeasure(m);
            if (meas) {
              const voiceKeyLog = deletion.staff === 'treble' ? 'treble' : 'bass';
              const notesLog = meas.notation?.[voiceKeyLog]?.voices?.[voiceIndex]?.notes || [];
              let totalBeats = 0;
              const details = notesLog.map(n => {
                const beats = durationToBeats(n.duration || '4n');
                totalBeats += beats;
                return {
                  beat: n.beat,
                  duration: n.duration,
                  beats: beats,
                  pitch: n.pitch || n.pitches,
                  tied: n.tied || false,
                  isTied: n.isTied || false
                };
              });
              console.log(`[SINGLE-SHIFT-DELETE] Measure ${m + 1} AFTER: totalBeats=${totalBeats}`, details);
            }
          }

          if (deletion.staff === 'bass') {
            compositionState.saveEditedBassNotesForMeasure(deletion.measureIndex);
          }

          notationComposer.render();
          return;
        }

        // BASS STAFF or VOICE 2+: Use the old measure-based approach
        // (Block sequence doesn't handle bass or multiple voices)
        const measure = notationComposer.compositionState.getMeasure(deletion.measureIndex);
        if (measure) {
          const voiceKey = deletion.staff === 'treble' ? 'treble' : 'bass';
          const notes = measure.notation[voiceKey]?.voices[voiceIndex]?.notes;
          if (notes && deletion.noteIndex < notes.length) {
            const originalNote = notes[deletion.noteIndex];
            const duration = originalNote.duration || '4n';
            const startBeat = originalNote.beat || 0;
            const shiftBeats = durationToBeats(duration, originalNote.dotted);

            console.log('[SINGLE-SHIFT-DELETE] Using measure-based approach for bass/voice2+');
            console.log('[SINGLE-SHIFT-DELETE] Note being deleted:', {
              beat: startBeat,
              duration: duration,
              beats: shiftBeats,
              pitch: originalNote.pitch || originalNote.pitches,
              tied: originalNote.tied || false,
              isTied: originalNote.isTied || false
            });

            // Remove the note
            notes.splice(deletion.noteIndex, 1);

            // Shift all subsequent notes backward
            if (noteEditor) {
              noteEditor.shiftNotesBackward(
                deletion.measureIndex,
                startBeat,
                shiftBeats,
                deletion.staff,
                voiceIndex,
                notationComposer.compositionState,
                beatsPerMeasure
              );
            }

            // Log FULL state AFTER shift
            console.log('[SINGLE-SHIFT-DELETE] === After shift-delete complete ===');
            for (let m = 0; m < Math.min(3, notationComposer.compositionState.measures.length); m++) {
              const meas = notationComposer.compositionState.getMeasure(m);
              if (meas) {
                const voiceKeyLog = deletion.staff === 'treble' ? 'treble' : 'bass';
                const notesLog = meas.notation?.[voiceKeyLog]?.voices?.[voiceIndex]?.notes || [];
                let totalBeats = 0;
                const details = notesLog.map(n => {
                  const beats = durationToBeats(n.duration || '4n');
                  totalBeats += beats;
                  return {
                    beat: n.beat,
                    duration: n.duration,
                    beats: beats,
                    pitch: n.pitch || n.pitches,
                    tied: n.tied || false,
                    isTied: n.isTied || false
                  };
                });
                console.log(`[SINGLE-SHIFT-DELETE] Measure ${m + 1} AFTER: totalBeats=${totalBeats}`, details);
              }
            }

            if (deletion.staff === 'bass') {
              notationComposer.compositionState.saveEditedBassNotesForMeasure(deletion.measureIndex);
            }
          }
        }
        notationComposer.render();
        return;
      }

      // 1. Handle in compositionState (normal delete - replace with rest)
      if (notationComposer.compositionState) {
        const measure = notationComposer.compositionState.getMeasure(deletion.measureIndex);
        if (measure) {
          const voiceKey = deletion.staff === 'treble' ? 'treble' : 'bass';
          const notes = measure.notation[voiceKey]?.voices[voiceIndex]?.notes;
          if (notes && deletion.noteIndex < notes.length) {
            // Deleting a note - replace with rest(s) to preserve rhythmic structure
            const originalNote = notes[deletion.noteIndex];
            const duration = originalNote.duration || '4n';
            const startBeat = originalNote.beat || 0;

            // Get the replacement rests - pass voiceIndex and dotted flag for canonical format support
            const replacementRests = splitDottedDuration(duration, startBeat, voiceIndex, originalNote.dotted);
            console.log(`[onNoteDelete] Replacing note with ${replacementRests.length} rest(s):`, replacementRests.map(r => ({beat: r.beat, duration: r.duration, voiceIndex: r.voiceIndex})));

            // Replace the single note with possibly multiple rests
            notes.splice(deletion.noteIndex, 1, ...replacementRests);
            measure.notation[voiceKey].autoGenerated = false;
          }
        }
      }

      // 2. Handle in measureManager
      if (notationComposer.measureManager && notationComposer.measureManager.measures) {
        const measure = notationComposer.measureManager.measures[deletion.measureIndex];
        if (measure) {
          const notesArray = deletion.staff === 'treble' ? 'trebleNotes' : 'bassNotes';

          if (measure[notesArray] && deletion.noteIndex < measure[notesArray].length) {
            // Deleting a note - replace with rest(s) to preserve rhythmic structure
            // (Rest deletion returns early above, so this only handles notes)
            const originalNote = measure[notesArray][deletion.noteIndex];
            const duration = originalNote.duration || '4n';
            const startBeat = originalNote.beat || 0;

            // Get the replacement rests - pass dotted flag for canonical format support
            const replacementRests = splitDottedDuration(duration, startBeat, undefined, originalNote.dotted);

            // Replace the single note with possibly multiple rests
            measure[notesArray].splice(deletion.noteIndex, 1, ...replacementRests);
          }
        }
      }

      // NOTE: Legacy sync code REMOVED
      // interactiveMelody.melodyNotes is no longer used for note storage
      // All notes now live in compositionState only

      // Sync treble changes to block sequence (if using treble block sequence)
      if (deletion.staff === 'treble' && notationComposer.compositionState?.trebleBlockSequence?.blocks?.length > 0) {
        notationComposer.compositionState.syncMeasuresToTrebleBlock();
      }

      // Save bass edits to preserve the entire building block
      if (deletion.staff === 'bass' && notationComposer.compositionState) {
        notationComposer.compositionState.saveEditedBassNotesForMeasure(deletion.measureIndex);
      }

      notationComposer.render();

      // Update note regions after delete
      if (notationComposer.noteRegions) {
        noteEditor.setNoteRegions(notationComposer.noteRegions);
      }
    },
    onPolyphonyAdd: (data) => {
      // Add pitch to existing note to create chord - update both data sources
      // Get voice index from data (default to 0 for backward compatibility)
      const voiceIndex = data.voiceIndex ?? 0;

      // 1. Update compositionState
      if (notationComposer.compositionState) {
        const measure = notationComposer.compositionState.getMeasure(data.measureIndex);
        if (measure) {
          const voiceKey = data.staff === 'treble' ? 'treble' : 'bass';
          // Use the correct voice index from the selected note
          const note = measure.notation[voiceKey]?.voices[voiceIndex]?.notes[data.noteIndex];

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

      // 2. Update measureManager (legacy - uses flat arrays, voice 0 only)
      if (voiceIndex === 0 && notationComposer.measureManager?.measures) {
        const measure = notationComposer.measureManager.measures[data.measureIndex];
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

      // Sync treble changes to block sequence (if polyphony added to treble staff)
      if (data.staff === 'treble' && notationComposer.compositionState?.trebleBlockSequence?.blocks?.length > 0) {
        notationComposer.compositionState.syncMeasuresToTrebleBlock();
      }

      // Save bass edits to preserve the entire building block
      if (data.staff === 'bass' && notationComposer.compositionState) {
        const measure = notationComposer.compositionState.getMeasure(data.measureIndex);
        if (measure && measure.notation?.bass) {
          measure.notation.bass.autoGenerated = false;
          notationComposer.compositionState.saveEditedBassNotesForMeasure(data.measureIndex);
        }
      }

      notationComposer.render();

      // Update note regions
      if (notationComposer.noteRegions) {
        noteEditor.setNoteRegions(notationComposer.noteRegions);
      }
    },
    onTupletModeChange: (tupletType) => {
      // Sync tuplet mode between noteEditor and toolbar
      // Pass false for notifyNoteEditor to avoid circular callback loop
      if (notationComposer?.toolbar) {
        notationComposer.toolbar.setTupletInsertMode(tupletType, false);
      }
    },
  });

  // PHASE 1A: Connect noteEditor to composer for ghost note rendering
  notationComposer.noteEditor = noteEditor;

  // Initialize Integrated Canvas Suggestions System
  try {
    // Get the first page canvas for initialization
    const firstPageCanvas = notationComposer.pageManager?.pages?.[0]?.canvas || primaryCanvas;
    const firstPageContext = firstPageCanvas?.getContext?.('2d');

    if (firstPageCanvas && firstPageContext) {
      suggestionManager = initializeIntegratedSuggestions({
        canvas: firstPageCanvas,
        context: firstPageContext,
        compositionState: notationComposer.compositionState,
        notationRenderer: notationComposer.vexRenderer,
        layoutManager: notationComposer.layoutManager,
        config: {
          melody: {
            defaultStyle: 'any',
            defaultOctave: 4,
            maxSuggestions: 5,
            cacheEnabled: true
          },
          chord: {
            defaultStyle: 'balanced',
            defaultMood: 'bright',
            maxSuggestions: 8,
            cacheEnabled: true
          }
        }
      });

      // Connect to note editor
      noteEditor.suggestionManager = suggestionManager;

      // Store globally for access
      window.suggestionManager = suggestionManager;

      // Disable old palette system - we now use the floating suggestions panel
      // Unregister Tab/Shift+Tab from palette keyboard handler
      if (suggestionManager?.keyboardHandler) {
        suggestionManager.keyboardHandler.unregisterShortcut('Tab');
        suggestionManager.keyboardHandler.unregisterShortcut('Shift+Tab');
        suggestionManager.keyboardHandler.disable();
      }
    }
  } catch (error) {
    console.warn('Could not initialize integrated suggestions:', error);
  }

  // Connect toolbar to note editor
  if (notationComposer.toolbar && noteEditor) {
    // Store original callbacks
    const originalCallbacks = {
      onDurationChange: notationComposer.toolbar.onDurationChange,
      onRestModeChange: notationComposer.toolbar.onRestModeChange,
      onDottedChange: notationComposer.toolbar.onDottedChange,
      onAccidentalChange: notationComposer.toolbar.onAccidentalChange,
      onArticulationChange: notationComposer.toolbar.onArticulationChange,
    };

    // Enhance callbacks to support both mode: setting defaults AND editing selected notes
    // IMPORTANT: Always update the default for new notes, AND apply to selected notes if any
    notationComposer.toolbar.onDurationChange = (duration) => {
      // Always set the duration for new notes (keeps toolbar and noteEditor in sync)
      noteEditor.setDuration(duration);
      originalCallbacks.onDurationChange(duration);

      if (noteEditor.selectedNotes.size > 0) {
        // Also change duration of selected notes
        noteEditor.changeDurationOfSelected(duration);
      }
    };

    notationComposer.toolbar.onRestModeChange = (isRest) => {
      // When notes are selected, we're converting existing notes, not setting mode for new notes
      // So we need special handling
      if (noteEditor.selectedNotes.size > 0) {
        // Toggle rest mode on selected notes
        noteEditor.toggleRestOnSelected();

        // Refresh toolbar selection state after toggling rest
        // This ensures the rest button reflects the new state of the notes
        const selectedNoteObjects = [];
        if (notationComposer.compositionState) {
          for (const noteId of noteEditor.selectedNotes) {
            const { measureIndex, staff, voiceIndex, noteIndex, pitchIndex } = NoteEditor.parseNoteId(noteId);

            // Skip auto-generated rests (noteIndex === -1) - they don't exist in compositionState
            if (noteIndex === -1) continue;

            const measure = notationComposer.compositionState.getMeasure(measureIndex);
            if (measure) {
              const note = measure.notation[staff]?.voices[voiceIndex]?.notes[noteIndex];
              if (note) {
                selectedNoteObjects.push({
                  ...note,
                  measureIndex,
                  staff,
                  voiceIndex,
                  noteIndex,
                  pitchIndex
                });
              }
            }
          }
        }

        // CRITICAL FIX: After converting selected notes, sync isRestMode to match the RESULT
        // If we converted rests to notes, user probably wants to continue adding notes (isRestMode=false)
        // If we converted notes to rests, user probably wants to continue adding rests (isRestMode=true)
        // The new state is the OPPOSITE of what the notes WERE (since we toggled them)
        // So we set isRestMode to match what the notes ARE NOW
        const newRestState = selectedNoteObjects.length > 0 ?
          (selectedNoteObjects[0].isRest || selectedNoteObjects[0].type === 'rest') : false;

        // Update both toolbar and noteEditor to match the resulting state
        notationComposer.toolbar.isRestMode = newRestState;
        noteEditor.setRestMode(newRestState);

        notationComposer.toolbar.updateSelectionState(selectedNoteObjects);
      } else {
        // No notes selected - this is setting mode for new notes
        noteEditor.setRestMode(isRest);
        originalCallbacks.onRestModeChange(isRest);
      }
    };

    notationComposer.toolbar.onDottedChange = (isDotted) => {
      // Always set dotted for new notes
      noteEditor.setDotted(isDotted);
      originalCallbacks.onDottedChange(isDotted);

      if (noteEditor.selectedNotes.size > 0) {
        // Also toggle dotted on selected notes
        noteEditor.toggleDottedOnSelected();
      }
    };

    notationComposer.toolbar.onAccidentalChange = (accidental) => {
      // Always set accidental for new notes
      noteEditor.setAccidental(accidental);
      originalCallbacks.onAccidentalChange(accidental);

      if (noteEditor.selectedNotes.size > 0) {
        // Also change accidental on selected notes
        noteEditor.changeAccidentalOnSelected(accidental);
      }
    };

    notationComposer.toolbar.onArticulationChange = (articulation) => {
      // Always set articulation for new notes
      noteEditor.setArticulation(articulation);
      originalCallbacks.onArticulationChange(articulation);

      if (noteEditor.selectedNotes.size > 0) {
        // Also toggle articulation on selected notes
        noteEditor.toggleArticulationOnSelected(articulation);
      }
    };

    // Handle chord symbol application
    notationComposer.toolbar.onChordSymbolApply = (chordSymbol) => {
      // Find the target chord based on selection priority:
      // 1. Selected notes -> use their measure's chord
      // 2. Selected measure -> use that measure's chord
      // 3. Highlighted chord card -> use that chord directly
      // 4. Default to first chord
      let targetMeasureIndex = 0;
      let chordIndex = undefined;

      if (noteEditor.selectedNotes.size > 0) {
        // Get first selected note's measure
        const firstNoteId = [...noteEditor.selectedNotes][0];
        const [measureIndex] = firstNoteId.split('-');
        targetMeasureIndex = parseInt(measureIndex);
      } else if (notationComposer.selectedMeasure !== null && notationComposer.selectedMeasure !== undefined) {
        // Use the currently selected measure (from clicking on a measure)
        targetMeasureIndex = notationComposer.selectedMeasure;
      } else {
        // Use the currently selected chord card from trainerState
        const selectedIndex = getSelectedChordIndex();
        if (selectedIndex !== null && selectedIndex !== undefined && selectedIndex >= 0) {
          chordIndex = selectedIndex;
        }
      }

      // Apply chord symbol to the chord (not the measure) so it moves with the chord
      if (notationComposer.compositionState) {
        // If we don't have chordIndex yet, get it from the target measure
        if (chordIndex === undefined) {
          const measure = notationComposer.compositionState.getMeasure(targetMeasureIndex);
          chordIndex = measure?.chord?.chordIndex;

          // Fallback: find chord by beat position
          if (chordIndex === undefined && notationComposer.compositionState.getChordSegmentForBeat) {
            const timeSignature = notationComposer.compositionState.metadata?.timeSignature || { num: 4, denom: 4 };
            const beatsPerMeasure = timeSignature.num * (4 / timeSignature.denom);
            const measureStartBeat = targetMeasureIndex * beatsPerMeasure;
            const segment = notationComposer.compositionState.getChordSegmentForBeat(measureStartBeat);
            if (segment) {
              chordIndex = segment.chordIndex;
            }
          }
        }

        if (chordIndex !== undefined) {
          // Get the chord segment and update its displayNameOverride
          const segment = notationComposer.compositionState.getChordSegment(chordIndex);
          if (segment && segment.chord) {
            segment.chord.displayNameOverride = chordSymbol;
          }

          // Also update storedProgressionData (source of truth for rebuilding segments)
          const storedData = notationComposer.compositionState.storedProgressionData;
          if (storedData && storedData[chordIndex]) {
            storedData[chordIndex].displayNameOverride = chordSymbol;
          }

          // Update all measures that belong to this chord
          const measures = notationComposer.compositionState.measures;
          for (const m of measures) {
            if (m.chord && m.chord.chordIndex === chordIndex) {
              m.chord.displayNameOverride = chordSymbol;
            }
          }

          // Invalidate the progression data cache so drag/drop operations see the updated data
          invalidateProgressionDataCache();

          // Re-render to show chord symbol
          notationComposer.render(true);
        }
      }
    };

    // Handle copy/paste/octave operations
    notationComposer.toolbar.onCopy = () => {
      noteEditor.copySelectedNotes();
    };

    notationComposer.toolbar.onPaste = (position) => {
      noteEditor.pasteNotes(position);
    };

    notationComposer.toolbar.onCopyBlock = () => {
      noteEditor.copyBuildingBlock();
    };

    notationComposer.toolbar.onOctaveShift = (direction) => {
      noteEditor.shiftSelectedNotesOctave(direction);
    };

    // Set initial chord context for harmonic coloring
    if (notationComposer.compositionState) {
      const key = notationComposer.compositionState.metadata?.key || getCurrentKey();
      noteEditor.setChordContext(null, key);
    }
  }

  // NOTE: Do NOT call syncFromProgression() here!
  // The compositionState is not yet populated at this point.
  // tabs.js will call syncProgressionToMelodyComposer() first to populate compositionState,
  // then call refreshNotationFromProgression() which will properly render.
  // Previously, calling syncFromProgression() here would result in empty render
  // because compositionState.measures was empty.

  // Sync note regions will be done after the first proper render
  // (when refreshNotationFromProgression is called from tabs.js)

  // Hook into the composer's render method to always update note regions
  const originalRender = notationComposer.render.bind(notationComposer);
  notationComposer.render = function(...args) {
    originalRender(...args); // CRITICAL: Forward all arguments including bypassSyncCheck

    // Update note regions in editor after each render
    if (this.noteRegions && noteEditor) {
      noteEditor.setNoteRegions(this.noteRegions);
    }

    // Multi-page: Reattach event listeners after pages are created/updated
    if (this.pageManager) {
      // Reattach composer events (measure selection, playback)
      this.attachPageCanvasEvents();

      // Reattach note editor events (note editing)
      if (noteEditor) {
        noteEditor.attachPageEventListeners();
      }
    }
  };

  isInitialized = true;

  // PHASE 1.3: Expose a function to check if notes are selected
  // This is used by KeyboardHandler to avoid intercepting arrow keys during note editing
  window.notationEditorHasSelection = () => {
    return noteEditor && noteEditor.selectedNotes && noteEditor.selectedNotes.size > 0;
  };

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

/**
 * Get the suggestion manager instance
 * @returns {CanvasSuggestionManager|null}
 */
export function getSuggestionManager() {
  return suggestionManager;
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
export function refreshNotationFromProgression(preventScroll = false) {
  if (!notationComposer) {
    return false;
  }

  // Save scroll position before syncing to prevent page jumping
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;
  const canvasContainer = notationComposer.config?.container?.parentElement;
  const containerScrollTop = canvasContainer ? canvasContainer.scrollTop : 0;
  const containerScrollLeft = canvasContainer ? canvasContainer.scrollLeft : 0;

  // Prevent canvas from getting focus (which causes scroll)
  const canvas = notationComposer.config?.container;
  if (canvas && preventScroll) {
    // Make canvas non-focusable to prevent scroll
    canvas.setAttribute('tabindex', '-1');
    canvas.style.outline = 'none';
    // Also prevent any scrollIntoView calls
    const originalScrollIntoView = canvas.scrollIntoView;
    canvas.scrollIntoView = () => {}; // No-op
    // Restore after a delay
    setTimeout(() => {
      if (canvas.scrollIntoView === (() => {})) {
        canvas.scrollIntoView = originalScrollIntoView;
      }
    }, 500);
  }

  notationComposer.syncFromProgression(preventScroll);
  
  // Restore scroll position after sync completes
  const restoreScroll = () => {
    window.scrollTo(scrollX, scrollY);
    if (canvasContainer) {
      canvasContainer.scrollTop = containerScrollTop;
      canvasContainer.scrollLeft = containerScrollLeft;
    }
  };
  
  if (preventScroll) {
    // More aggressive scroll prevention when explicitly requested
    // Restore scroll immediately and multiple times
    restoreScroll();
    requestAnimationFrame(() => {
      restoreScroll();
      requestAnimationFrame(() => {
        restoreScroll();
        setTimeout(restoreScroll, 10);
        setTimeout(restoreScroll, 50);
        setTimeout(restoreScroll, 100);
        setTimeout(restoreScroll, 200);
      });
    });
  } else {
    // Normal scroll restoration
    requestAnimationFrame(() => {
      restoreScroll();
      requestAnimationFrame(() => {
        restoreScroll();
        setTimeout(restoreScroll, 50);
        setTimeout(restoreScroll, 100);
      });
    });
  }
  
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
    key: getCurrentKey() // Pass key for enharmonic preference
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
  if (suggestionManager) {
    suggestionManager.dispose();
    suggestionManager = null;
  }

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
 * Centralized keyboard shortcuts data structure
 * When adding new shortcuts, add them here to keep the modal in sync
 */
export const KEYBOARD_SHORTCUTS = {
  global: {
    title: 'Global Shortcuts',
    icon: '🌐',
    color: 'blue',
    shortcuts: [
      { key: '?', action: 'Show this help', detail: 'Opens this keyboard shortcuts reference guide. Works anywhere in the app.' },
      { key: 'Tab', action: 'Recommendations modal', detail: 'Opens the AI recommendations modal with chord suggestions. Press again to close.' },
      { key: 'Shift + Tab', action: 'Melody suggestions', detail: 'Opens the recommendations modal directly to the melody suggestions tab.' },
      { key: 'R', action: 'Recommendations modal', detail: 'Alternative shortcut to open the recommendations modal.' },
      { key: 'Ctrl/⌘ + Z', action: 'Undo', detail: 'Undoes the last action (chord addition, note edit, etc.).' },
      { key: 'Ctrl/⌘ + Shift + Z', action: 'Redo', detail: 'Redoes the last undone action.' },
      { key: 'Escape', action: 'Close modal/panel', detail: 'Closes any open modal, panel, or dropdown menu.' },
    ]
  },
  mouse: {
    title: 'Mouse Controls',
    icon: '🖱️',
    color: 'violet',
    shortcuts: [
      { key: 'Click on note', action: 'Select note', detail: 'Click any note to select it (shows blue highlight). The toolbar will update to show the selected note\'s properties.' },
      { key: 'Shift + Click', action: 'Multi-select notes', detail: 'Hold Shift and click multiple notes to select them together. You can then modify all selected notes at once.' },
      { key: 'Alt + Click on staff', action: 'Add note at position', detail: 'Hold Alt and click anywhere on the treble or bass staff to insert a new note at that pitch and beat position.' },
      { key: 'Alt + Hover', action: 'Ghost note preview', detail: 'Hold Alt while hovering over the staff to see a transparent preview of where the note will be placed before clicking.' },
      { key: 'Click on measure', action: 'Select measure', detail: 'Click on an empty area of a measure to select it. The measure will be highlighted with a blue border.' },
      { key: 'Hold click (200ms)', action: 'Play measure', detail: 'Click and hold on a measure for 200ms to play all notes in that measure. Release to stop.' },
    ]
  },
  selection: {
    title: 'Selection & Clipboard',
    icon: '📋',
    color: 'blue',
    shortcuts: [
      { key: 'Ctrl/⌘ + A', action: 'Select all notes', detail: 'Selects every note in the current composition. Useful for bulk operations like transposition.' },
      { key: 'Ctrl/⌘ + C', action: 'Copy selected notes', detail: 'Copies the currently selected notes to the clipboard. Notes retain their relative positions and properties.' },
      { key: 'Ctrl/⌘ + Shift + C', action: 'Copy building block', detail: 'Copies the entire building block (chord section) containing the selected notes, including all bass patterns.' },
      { key: 'Ctrl/⌘ + V', action: 'Paste notes', detail: 'Pastes copied notes after the current selection. If no selection, pastes at the current cursor position.' },
      { key: 'Ctrl/⌘ + Shift + V', action: 'Paste at beginning', detail: 'Pastes copied notes at the very beginning of the composition, before all existing notes.' },
      { key: 'Ctrl/⌘ + Alt + V', action: 'Paste at end', detail: 'Pastes copied notes at the end of the composition, after all existing notes.' },
      { key: 'Delete / Backspace', action: 'Delete (replace with rest)', detail: 'Replaces selected notes with rests of the same duration, preserving rhythmic structure.' },
      { key: 'Ctrl + Delete', action: 'Shift delete', detail: 'Removes notes completely and shifts subsequent notes left to fill the gap. Tied notes are automatically merged or split as needed.' },
      { key: 'Escape', action: 'Clear selection', detail: 'Deselects all notes and exits any special modes (tuplet insert mode, etc.).' },
    ]
  },
  undoRedo: {
    title: 'Undo & Redo',
    icon: '↩️',
    color: 'gray',
    shortcuts: [
      { key: 'Ctrl/⌘ + Z', action: 'Undo', detail: 'Reverses the last action. Works for note additions, deletions, pitch changes, and most other edits.' },
      { key: 'Ctrl/⌘ + Shift + Z', action: 'Redo', detail: 'Re-applies an action that was undone. Redo history is cleared when you make a new change.' },
      { key: 'Ctrl/⌘ + Y', action: 'Redo (alternate)', detail: 'Alternative shortcut for Redo, common in Windows applications.' },
    ]
  },
  noteEditing: {
    title: 'Note Editing',
    icon: '🎵',
    color: 'indigo',
    shortcuts: [
      { key: 'Space or P', action: 'Play selected notes', detail: 'Plays the currently selected notes through the audio engine. Great for auditioning your work.' },
      { key: '↑ Arrow Up', action: 'Transpose up (step)', detail: 'Moves selected notes up by one scale step (semitone). Works on single or multiple selected notes.' },
      { key: '↓ Arrow Down', action: 'Transpose down (step)', detail: 'Moves selected notes down by one scale step (semitone). Works on single or multiple selected notes.' },
      { key: 'Ctrl/⌘ + ↑', action: 'Transpose up (octave)', detail: 'Moves selected notes up by one full octave (12 semitones). Useful for voice leading adjustments.' },
      { key: 'Ctrl/⌘ + ↓', action: 'Transpose down (octave)', detail: 'Moves selected notes down by one full octave (12 semitones). Useful for voice leading adjustments.' },
      { key: 'Shift + ←', action: 'Insert before', detail: 'Inserts a new note before the currently selected note, using the current toolbar duration settings.' },
      { key: 'Shift + →', action: 'Insert after', detail: 'Inserts a new note after the currently selected note, using the current toolbar duration settings.' },
    ]
  },
  duration: {
    title: 'Note Duration',
    icon: '⏱️',
    color: 'purple',
    shortcuts: [
      { key: '1 (with selection)', action: 'Whole note', detail: 'Changes selected notes to whole notes (4 beats in 4/4 time). Also sets toolbar default.' },
      { key: '2 (with selection)', action: 'Half note', detail: 'Changes selected notes to half notes (2 beats in 4/4 time). Also sets toolbar default.' },
      { key: '3 (with selection)', action: 'Quarter note', detail: 'Changes selected notes to quarter notes (1 beat in 4/4 time). Also sets toolbar default.' },
      { key: '4 (with selection)', action: 'Eighth note', detail: 'Changes selected notes to eighth notes (½ beat in 4/4 time). Also sets toolbar default.' },
      { key: '5 (with selection)', action: '16th note', detail: 'Changes selected notes to 16th notes (¼ beat in 4/4 time). Also sets toolbar default.' },
      { key: '6 (with selection)', action: '32nd note', detail: 'Changes selected notes to 32nd notes (⅛ beat in 4/4 time). Also sets toolbar default.' },
      { key: 'Shift + 1-6', action: 'Set toolbar duration', detail: 'Sets the toolbar duration for new notes without requiring a selection. Shift+1=whole, Shift+2=half, etc.' },
      { key: '. (period)', action: 'Toggle dotted', detail: 'Toggles dotted mode, which adds 50% to note duration (e.g., dotted quarter = 1.5 beats).' },
    ]
  },
  accidentals: {
    title: 'Accidentals',
    icon: '♯♭',
    color: 'amber',
    shortcuts: [
      { key: 'S', action: 'Sharp (♯)', detail: 'Adds or toggles a sharp accidental. When notes are selected, applies to selection. Otherwise sets toolbar default.' },
      { key: 'F or -', action: 'Flat (♭)', detail: 'Adds or toggles a flat accidental. When notes are selected, applies to selection. Otherwise sets toolbar default.' },
      { key: 'N or =', action: 'Natural (♮)', detail: 'Adds or toggles a natural accidental. Useful for canceling key signature accidentals on specific notes.' },
    ]
  },
  articulations: {
    title: 'Articulations',
    icon: '🎼',
    color: 'teal',
    shortcuts: [
      { key: 'Shift + S', action: 'Staccato (.)', detail: 'Toggles staccato articulation on selected notes. Staccato notes are played short and detached.' },
      { key: 'Shift + A', action: 'Accent (>)', detail: 'Toggles accent articulation on selected notes. Accented notes are played with emphasis.' },
      { key: 'Shift + T', action: 'Tenuto (—)', detail: 'Toggles tenuto articulation on selected notes. Tenuto notes are held for their full duration.' },
      { key: 'Shift + M', action: 'Marcato (^)', detail: 'Toggles marcato articulation on selected notes. Marcato is a stronger accent.' },
    ]
  },
  tiesAndTuplets: {
    title: 'Ties & Tuplets',
    icon: '🔗',
    color: 'rose',
    shortcuts: [
      { key: 'T', action: 'Toggle tie', detail: 'Ties the selected note to the next note of the same pitch. Tied notes play as one continuous sound.' },
      { key: 'R', action: 'Toggle rest mode', detail: 'Switches between inserting notes and inserting rests. Active when the rest button is highlighted.' },
      { key: 'Shift + 3', action: 'Create triplet', detail: 'Converts 3 selected notes into a triplet (3 notes in the time of 2). Select exactly 3 notes first.' },
      { key: 'Shift + 5', action: 'Create quintuplet', detail: 'Converts 5 selected notes into a quintuplet (5 notes in the time of 4). Select exactly 5 notes first.' },
      { key: 'Shift + 6', action: 'Create sextuplet', detail: 'Converts 6 selected notes into a sextuplet (6 notes in the time of 4). Select exactly 6 notes first.' },
      { key: 'Ctrl/⌘ + Shift + 3', action: 'Triplet insert mode', detail: 'Enters triplet insert mode. Next 3 notes you add will automatically form a triplet.' },
      { key: 'Ctrl/⌘ + Shift + 5', action: 'Quintuplet insert mode', detail: 'Enters quintuplet insert mode. Next 5 notes you add will automatically form a quintuplet.' },
      { key: 'Ctrl/⌘ + Shift + 6', action: 'Sextuplet insert mode', detail: 'Enters sextuplet insert mode. Next 6 notes you add will automatically form a sextuplet.' },
    ]
  },
  suggestions: {
    title: 'Suggestions Panel',
    icon: '💡',
    color: 'yellow',
    shortcuts: [
      { key: 'Tab', action: 'Chord suggestions', detail: 'Opens/closes the floating chord suggestions panel. Shows recommended next chords based on music theory.' },
      { key: 'Shift + Tab', action: 'Melody suggestions', detail: 'Opens/closes the melody suggestions panel. Shows melodic ideas based on current chord and style.' },
      { key: 'Ctrl/⌘ + Tab', action: 'Generate panel', detail: 'Opens the AI generation panel for creating chord progressions or melodies automatically.' },
      { key: '1-9', action: 'Quick select', detail: 'Quickly applies suggestion #1-9 from the panel. Number corresponds to position in the list.' },
      { key: '↑↓ Arrows', action: 'Navigate suggestions', detail: 'Move up/down through the suggestions list when the panel is open.' },
      { key: 'Enter', action: 'Apply suggestion', detail: 'Applies the currently highlighted suggestion to your composition.' },
      { key: 'Space (hold)', action: 'Preview suggestion', detail: 'Hold Space to temporarily hear how a suggestion would sound. Release to stop preview.' },
      { key: 'R', action: 'Refresh suggestions', detail: 'Regenerates the suggestions list with new options based on current context.' },
      { key: 'Ctrl/⌘ + I', action: 'Toggle AI assist', detail: 'Enables/disables the AI assist mode which provides real-time composition suggestions.' },
    ]
  },
  chordProgression: {
    title: 'Chord Progression',
    icon: '🎹',
    color: 'emerald',
    shortcuts: [
      { key: 'Ctrl/⌘ + A', action: 'Select all chords', detail: 'Selects all chord cards in the progression builder for bulk operations.' },
      { key: 'Ctrl/⌘ + C', action: 'Copy chords', detail: 'Copies selected chord cards to clipboard, including their voicings and bass patterns.' },
      { key: 'Ctrl/⌘ + V', action: 'Paste chords', detail: 'Pastes copied chord cards after the current selection in the progression.' },
      { key: 'Ctrl/⌘ + D', action: 'Duplicate chords', detail: 'Creates a copy of selected chord cards immediately after the originals.' },
      { key: 'Escape', action: 'Clear selection', detail: 'Deselects all chord cards and cancels any ongoing chord label editing.' },
    ]
  },
  pageNavigation: {
    title: 'Page Navigation',
    icon: '📄',
    color: 'slate',
    shortcuts: [
      { key: 'Ctrl/⌘ + →', action: 'Next page', detail: 'Navigates to the next page of notation when viewing multi-page scores.' },
      { key: 'Ctrl/⌘ + ←', action: 'Previous page', detail: 'Navigates to the previous page of notation when viewing multi-page scores.' },
      { key: 'Ctrl/⌘ + Page Down', action: 'Next page (alt)', detail: 'Alternative shortcut for navigating to the next page.' },
      { key: 'Ctrl/⌘ + Page Up', action: 'Previous page (alt)', detail: 'Alternative shortcut for navigating to the previous page.' },
    ]
  },
  general: {
    title: 'General',
    icon: '⚙️',
    color: 'zinc',
    shortcuts: [
      { key: 'Escape', action: 'Close modal/panel', detail: 'Closes any open modal dialog, popup, or floating panel. Also exits special editing modes.' },
      { key: 'Enter', action: 'Confirm input', detail: 'Confirms text input in chord symbol fields, label editing, and other input contexts.' },
    ]
  }
};

/**
 * Show keyboard shortcuts modal
 */
export function showNotationShortcuts() {
  // Generate shortcut sections HTML
  const generateSections = () => {
    return Object.entries(KEYBOARD_SHORTCUTS).map(([key, section]) => {
      const colorClasses = {
        violet: 'text-violet-700 bg-violet-50 border-violet-200',
        blue: 'text-blue-700 bg-blue-50 border-blue-200',
        gray: 'text-gray-700 bg-gray-50 border-gray-200',
        indigo: 'text-indigo-700 bg-indigo-50 border-indigo-200',
        purple: 'text-purple-700 bg-purple-50 border-purple-200',
        amber: 'text-amber-700 bg-amber-50 border-amber-200',
        teal: 'text-teal-700 bg-teal-50 border-teal-200',
        rose: 'text-rose-700 bg-rose-50 border-rose-200',
        yellow: 'text-yellow-700 bg-yellow-50 border-yellow-200',
        emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        slate: 'text-slate-700 bg-slate-50 border-slate-200',
        zinc: 'text-zinc-700 bg-zinc-50 border-zinc-200',
      };
      const colors = colorClasses[section.color] || colorClasses.gray;
      const [textColor, bgColor, borderColor] = colors.split(' ');

      return `
        <div class="shortcut-section mb-4">
          <h4 class="font-semibold ${textColor} mb-2 flex items-center gap-2">
            <span>${section.icon}</span>
            <span>${section.title}</span>
          </h4>
          <div class="space-y-1 text-sm">
            ${section.shortcuts.map(s => `
              <div class="shortcut-row flex justify-between items-start py-1 px-2 rounded hover:${bgColor} cursor-help group relative"
                   title="${s.detail.replace(/"/g, '&quot;')}">
                <span class="font-medium text-gray-800 flex-shrink-0">
                  <kbd class="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">${s.key}</kbd>
                </span>
                <span class="text-gray-600 text-right ml-2">${s.action}</span>
                <div class="tooltip absolute left-0 right-0 bottom-full mb-1 p-2 ${bgColor} border ${borderColor} rounded shadow-lg text-xs ${textColor} opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  ${s.detail}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');
  };

  // Create modal HTML
  const modalHTML = `
    <div id="notation-shortcuts-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onclick="if(event.target===this) this.remove()">
      <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div class="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 class="text-xl font-bold text-gray-900">⌨️ Keyboard Shortcuts</h3>
            <p class="text-sm text-gray-500 mt-1">Hover over any shortcut for detailed information</p>
          </div>
          <button onclick="document.getElementById('notation-shortcuts-modal').remove()" class="text-gray-400 hover:text-gray-600 p-2">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div class="p-4 overflow-y-auto flex-1">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            ${generateSections()}
          </div>

          <div class="mt-4 p-3 bg-violet-50 border border-violet-200 rounded-lg">
            <p class="text-sm text-violet-900">
              <strong>💡 Tip:</strong> Bass clef notes from chord progression cards are auto-generated. To modify them, edit the chord cards directly or use the rhythmic pattern templates. Treble clef notes can be freely edited.
            </p>
          </div>

          <div class="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p class="text-sm text-blue-900">
              <strong>🖥️ Platform Note:</strong> On Mac, use <kbd class="px-1 py-0.5 bg-blue-100 border border-blue-300 rounded text-xs">⌘ Command</kbd> instead of <kbd class="px-1 py-0.5 bg-blue-100 border border-blue-300 rounded text-xs">Ctrl</kbd> for all shortcuts.
            </p>
          </div>

          <div class="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p class="text-sm text-amber-900">
              <strong>⚠️ Browser Note:</strong> Some common shortcuts (<kbd class="px-1 py-0.5 bg-amber-100 border border-amber-300 rounded text-xs">Ctrl+S</kbd>, <kbd class="px-1 py-0.5 bg-amber-100 border border-amber-300 rounded text-xs">Ctrl+Tab</kbd>, <kbd class="px-1 py-0.5 bg-amber-100 border border-amber-300 rounded text-xs">Space</kbd>) are reserved by browsers. Use <kbd class="px-1 py-0.5 bg-amber-100 border border-amber-300 rounded text-xs">Tab</kbd> or <kbd class="px-1 py-0.5 bg-amber-100 border border-amber-300 rounded text-xs">R</kbd> for recommendations, and click play buttons for playback.
            </p>
          </div>
        </div>
      </div>
    </div>
    <style>
      #notation-shortcuts-modal .tooltip {
        pointer-events: none;
        max-width: 300px;
        white-space: normal;
        line-height: 1.4;
      }
      #notation-shortcuts-modal .shortcut-row:hover {
        z-index: 5;
      }
      #notation-shortcuts-modal kbd {
        white-space: nowrap;
      }
    </style>
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
  window.getNoteEditor = getNoteEditor;
  window.getSuggestionManager = getSuggestionManager;
  window.isNotationInitialized = isNotationInitialized;
  window.showNotationShortcuts = showNotationShortcuts;
  // Export FeatureFlags for suggestion control
  window.FeatureFlags = FeatureFlags;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  initEnhancedNotation,
  isNotationInitialized,
  getNotationComposer,
  getNoteEditor,
  getSuggestionManager,
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
