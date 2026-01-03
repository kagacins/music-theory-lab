/**
 * Note Editor - Interactive click/drag note editing
 * Part of the Phase 4.4 VexFlow Professional Notation enhancement
 *
 * This module handles interactive note editing including:
 * - Click to add notes at staff positions
 * - Drag to reposition notes
 * - Visual selection and highlighting
 * - Ghost note preview on hover
 */

import { StaffLayoutManager, pitchToLine as layoutPitchToLine } from './staffLayouter.js';
import { noteToMidi, midiToNote, applyKeySignatureToPitch } from './vexFlowRenderer.js';
import { dispatchBuilderEvent } from '../ui/lessonGuidedMode.js';
import {
  normalizeDottedState,
  isDotted,
  getBaseDuration,
  beatsToDuration,
  beatsToDurationString,
  durationToBeats,
  getNoteDurationInBeats,
  createNote,
} from './durationUtils.js';
import { analyzeChordTone, CHORD_TONE_COLORS } from '../analysis/chordToneAnalyzer.js';
import { getPiano } from '../audio/audioEngine.js';
import { showNoteOverflowDialog } from '../ui/modals.js';
import {
  TUPLET_RATIOS,
  generateTupletGroupId,
  createTupletAttribute,
  getTupletDuration,
} from '../state/buildingBlock.js';
import { getBeatsPerMeasureFromTimeSignature } from '../state/compositionState.js';
import { DEFAULT_TIME_SIGNATURE } from '../../data/music-data.js';
import { getEnharmonicPreferenceForKey } from '../utils/noteUtils.js';
import { getCurrentKey } from '../state/trainerState.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Editor states
 */
export const EDITOR_STATES = {
  IDLE: 'idle',
  SELECTING: 'selecting',
  DRAGGING: 'dragging',
  ADDING: 'adding',
};

/**
 * Selection colors
 */
export const SELECTION_COLORS = {
  selected: '#4a9eff',
  hover: 'rgba(74, 158, 255, 0.3)',
  ghost: 'rgba(74, 158, 255, 0.5)',
};

/**
 * Staff line spacing in pixels
 */
export const LINE_SPACING = 10;

// ============================================================================
// NOTE EDITOR CLASS
// ============================================================================

/**
 * Interactive note editor for staff notation
 */
export class NoteEditor {
  constructor(options = {}) {
    // Canvas and context
    this.canvas = options.canvas || null;
    this.overlayCanvas = options.overlayCanvas || null; // DEPRECATED: Now using main canvas for ghost notes

    // Layout manager reference
    this.layoutManager = options.layoutManager || new StaffLayoutManager();

    // Composer integration reference (for selected measure)
    this.composerIntegration = options.composerIntegration || null;

    // PageManager reference (for multi-page support)
    this.pageManager = options.pageManager || null;

    // Track pages with event listeners to prevent duplicates
    this.pagesWithListeners = new Set();
    this.keyboardListenerAttached = false;

    // State
    this.state = EDITOR_STATES.IDLE;
    this.isEnabled = true;

    // Selection
    this.selectedNotes = new Set(); // Set of note IDs
    this.hideSelectionHighlight = false; // PHASE 1.4: Esc hides visual, keeps selection for polyphony
    this.hoveredPosition = null;
    this.ghostNote = null;
    this.isShiftHeld = false; // Track if Shift key is held
    // REMOVED: Hover toolbar - now using contextual top toolbar instead

    // Drag state
    this.dragStartPosition = null;
    this.dragCurrentPosition = null;
    this.draggedNotes = [];

    // Tool state (from toolbar)
    this.currentDuration = '4n';
    this.isRestMode = false;
    this.isDotted = false;
    this.currentAccidental = null;
    this.currentArticulation = null; // Current articulation from toolbar
    this.currentDynamic = null; // Current dynamic marking from toolbar (pp, p, mp, mf, f, ff, sfz, fp)
    this.currentVoice = 1; // Active voice (1 or 2) for multi-voice support

    // Chord context for coloring
    this.chordContext = null;
    this.keySignature = 'C';

    // Clipboard for copy/paste
    this.clipboard = null; // { type: 'notes' | 'buildingBlock', data: [...] }

    // Tuplet insert mode state
    this.tupletInsertMode = null; // null, 'triplet', 'quintuplet', or 'sextuplet'
    this.tupletInsertProgress = {
      groupId: null,
      notes: [],
      target: 0,
    };

    // Callbacks
    this.onNoteAdd = options.onNoteAdd || (() => {});
    this.onNoteMove = options.onNoteMove || (() => {});
    this.onNoteSelect = options.onNoteSelect || (() => {});
    this.onNoteDelete = options.onNoteDelete || (() => {});
    this.onPolyphonyAdd = options.onPolyphonyAdd || (() => {});
    this.onTupletModeChange = options.onTupletModeChange || (() => {});

    // Bind event handlers
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseLeave = this.handleMouseLeave.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);

    // Initialize
    if (this.pageManager) {
      // Multi-page: Events will be attached when pages are created
      // We'll do this via a mutation observer or render callback
    } else if (this.canvas) {
      // Legacy single canvas
      this.attachEventListeners();
    }
  }

  // ============================================================================
  // VOICE ACCESS HELPERS
  // ============================================================================

  /**
   * Get the appropriate voice from a measure based on staff type
   * For treble: uses the current treble voice (1 or 2 -> index 0 or 1)
   * For bass: uses the current bass voice (1 or 2 -> index 0 or 1)
   * @param {Object} measure - The measure object
   * @param {string} staff - 'treble' or 'bass'
   * @returns {Object} - Voice object with notes array
   */
  getVoice(measure, staff) {
    if (!measure || !measure.notation || !measure.notation[staff]) {
      return { notes: [] };
    }
    const voiceIndex = this.getVoiceIndexForStaff(staff);
    const voices = measure.notation[staff].voices;

    // Ensure voice exists
    while (voices.length <= voiceIndex) {
      voices.push({ notes: [] });
    }

    return voices[voiceIndex] || { notes: [] };
  }

  /**
   * Get voice index for a given staff
   * @param {string} staff - 'treble' or 'bass'
   * @returns {number} - Voice index (0-based)
   */
  getVoiceIndexForStaff(staff) {
    // Get voice from compositionState if available (handles both treble and bass)
    if (window.getCompositionState) {
      const compositionState = window.getCompositionState();
      if (compositionState?.getActiveVoiceIndexForStaff) {
        return compositionState.getActiveVoiceIndexForStaff(staff);
      }
    }
    // Fallback to local voice tracking for treble, 0 for bass
    return staff === 'treble' ? this.getCurrentVoiceIndex() : 0;
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================

  /**
   * Attach event listeners to canvas(es)
   */
  attachEventListeners() {
    if (this.pageManager) {
      // Multi-page: Attach to all page canvases
      this.attachPageEventListeners();
    } else if (this.canvas) {
      // Legacy: Attach to single canvas
      this.attachSingleCanvasListeners();
    }
  }

  /**
   * Attach listeners to single canvas (legacy)
   */
  attachSingleCanvasListeners() {
    if (!this.canvas) return;

    // Remove existing listeners first to prevent duplicates
    this.detachEventListeners();

    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave);

    // Global keyboard listeners
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  /**
   * Attach listeners to all page canvases
   * CRITICAL: Track actual canvas elements, not just IDs, since canvases can be recreated
   */
  attachPageEventListeners() {
    if (!this.pageManager) return;

    // Attach to all existing pages
    const pages = this.pageManager.getAllPages();

    // Initialize canvas-based tracking if not exists
    if (!this.pagesWithCanvasListeners) {
      this.pagesWithCanvasListeners = new WeakSet();
    }

    pages.forEach(page => {
      // Skip if this ACTUAL CANVAS ELEMENT already has listeners attached
      // Using WeakSet with canvas reference instead of ID string
      if (this.pagesWithCanvasListeners.has(page.canvas)) {
        return;
      }

      // Attach listeners
      page.canvas.addEventListener('mousedown', this.handleMouseDown);
      page.canvas.addEventListener('mousemove', this.handleMouseMove);
      page.canvas.addEventListener('mouseup', this.handleMouseUp);
      page.canvas.addEventListener('mouseleave', this.handleMouseLeave);

      // Mark this canvas element as having listeners
      this.pagesWithCanvasListeners.add(page.canvas);
      // Keep old Set for backwards compatibility
      this.pagesWithListeners.add(page.canvas.id);
    });

    // Global keyboard listener (only add once)
    if (!this.keyboardListenerAttached) {
      document.addEventListener('keydown', this.handleKeyDown);
      this.keyboardListenerAttached = true;
    }
  }

  /**
   * Detach event listeners
   */
  detachEventListeners() {
    if (!this.canvas) return;

    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);

    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
  }

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Handle mouse down
   * @param {MouseEvent} e - Mouse event
   */
  handleMouseDown(e) {
    if (!this.isEnabled) return;

    const position = this.getCanvasPosition(e);

    // Check if clicking on a chord bracket label (selects bass block, or Shift+click replaces bass)
    if (this.composerIntegration && this.composerIntegration.checkChordBracketClick(position.x, position.y, e)) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    // REMOVED: Hover toolbar click handling - now using contextual top toolbar

    let staffPosition = this.layoutManager.getStaffPositionAtPoint(position.x, position.y);

    // When Alt is held, prefer the last hovered position (ghost note)
    if (e.altKey && this.hoveredPosition && this.hoveredPosition.pitch) {
      staffPosition = this.hoveredPosition;
    }

    // Phase 3: Apply staff selection mode override from toolbar
    // If user has explicitly selected treble or bass, override the auto-detected staff
    if (staffPosition && staffPosition.staff) {
      const staffSelectionMode = this.composerIntegration?.toolbar?.getStaffSelectionMode?.() || 'auto';
      if (staffSelectionMode !== 'auto') {
        // Only override if a valid pitch can be mapped to the selected staff
        // This prevents placing notes in impossible positions
        const overrideStaff = staffSelectionMode; // 'treble' or 'bass'
        if (overrideStaff !== staffPosition.staff) {
          // Need to recalculate pitch for the different staff
          // Use the same Y position but interpret for different staff
          staffPosition = { ...staffPosition, staff: overrideStaff };
          // The pitch will be adjusted in addNoteAtPosition based on staff
        }
      }
    }

    // TUTORIAL ASSISTED PLACEMENT: If a tutorial has specified an expected note,
    // override the clicked pitch to ensure the note is placed correctly.
    // This helps users learn the toolbar mechanics without getting frustrated by pitch accuracy.
    if (window.tutorialExpectedNote && staffPosition && staffPosition.pitch) {
      staffPosition.pitch = window.tutorialExpectedNote;
    }

    // Check interaction mode from toolbar
    // Alt-based mode switching (matching Measure Isolation Modal pattern):
    // - When interactionMode = 'select' (default): Normal = Select, Alt = Entry
    // - When interactionMode = 'noteEntry' (sticky): Normal = Entry, Alt = Select (inverted)
    const interactionMode = this.composerIntegration?.toolbar?.getInteractionMode?.() || 'select';

    // Determine if we're in note entry mode based on toggle and Alt state
    // When toggle is OFF ('select'): Alt = entry mode, normal = select mode
    // When toggle is ON ('noteEntry'): Normal = entry mode, Alt = select mode (inverted)
    const inNoteEntryMode = interactionMode === 'noteEntry'
      ? !e.altKey   // Sticky mode ON: normal click is entry, Alt inverts to select
      : e.altKey;   // Sticky mode OFF: Alt enables entry, normal click is select

    // DEBUG: Log mode state
    console.log(`[NoteEditor] interactionMode=${interactionMode}, altKey=${e.altKey}, inNoteEntryMode=${inNoteEntryMode}`);

    // Check if clicking on an existing note (for selection)
    // Only try to select notes when NOT in entry mode
    const clickedNote = inNoteEntryMode ? null : this.findNoteAtPosition(position.x, position.y);
    console.log(`[NoteEditor] clickedNote=${clickedNote ? 'found' : 'null'}`);

    if (clickedNote) {
      // Clicking on a note - handle selection (works with or without Alt in select mode)
      e.stopPropagation();
      e.preventDefault();

      // For chords, create pitch-specific ID if pitchIndex is available
      const isChord = clickedNote.pitches && clickedNote.pitches.length > 1;
      const pitchSpecificId = isChord && clickedNote.pitchIndex !== undefined
        ? this.createNoteId(clickedNote.measureIndex, clickedNote.staff, clickedNote.voiceIndex || 0, clickedNote.noteIndex, clickedNote.pitchIndex)
        : clickedNote.id;

      // Check if any part of this note/chord is already selected
      const baseNoteId = clickedNote.id;
      const isNoteSelected = this.selectedNotes.has(baseNoteId) ||
        (isChord && [...this.selectedNotes].some(id => this.getBaseNoteId(id) === baseNoteId));

      // Helper to store auto-generated rest info (needs to happen AFTER clearSelection but BEFORE selectNote)
      const storeAutoGeneratedRestInfo = () => {
        if (clickedNote.isAutoGenerated) {
          if (!this.autoGeneratedRestInfo) {
            this.autoGeneratedRestInfo = new Map();
          }
          this.autoGeneratedRestInfo.set(clickedNote.id, {
            measureIndex: clickedNote.measureIndex,
            staff: clickedNote.staff,
            voiceIndex: clickedNote.voiceIndex || 0,
            beat: clickedNote.beat,
            duration: clickedNote.duration,
          });
        }
      };

      if (e.shiftKey) {
        // Shift+Click = add to selection (use pitch-specific ID for chords)
        storeAutoGeneratedRestInfo();
        this.toggleNoteSelection(pitchSpecificId);
      } else if (e.altKey && isNoteSelected) {
        // Alt+Click on selected note(s) = start dragging
        this.startDrag(position, staffPosition);
      } else {
        // Regular click = select this note only (pitch-specific for chords)
        this.clearSelection();
        storeAutoGeneratedRestInfo();
        this.selectNote(pitchSpecificId);
      }
      return;
    }

    // Not clicking on a note - check if we're in entry mode to add notes
    if (!inNoteEntryMode) {
      // Not in entry mode = let event bubble to measure selection/playback
      return;
    }

    // In note entry mode
    // Only proceed if clicking on a valid staff position
    if (!staffPosition || !staffPosition.staff) {
      return;
    }

    // Prevent event from bubbling to measure selection handlers
    e.stopPropagation();
    e.preventDefault();

    if (staffPosition.pitch) {
      // PHASE 1.4: Check if there's a selected note in the same measure to add polyphony to
      // This allows Alt+Click (without Shift) to add pitches to selected notes
      const selectedNoteInMeasure = this.getSelectedNoteInMeasure(staffPosition);

      if (selectedNoteInMeasure) {
        // Add this pitch to the selected note (polyphony)
        // SECTION VIEW FIX: Apply filter offset to convert local index to global
        const filterOffset = this.composerIntegration?.getMeasureFilterOffset?.() || 0;
        // Apply key signature to pitch when no explicit accidental is selected
        const polyphonyCompositionState = window.getCompositionState?.();
        const effectivePitch = this.getEffectivePitch(staffPosition.pitch, polyphonyCompositionState);
        this.onPolyphonyAdd({
          measureIndex: selectedNoteInMeasure.measureIndex + filterOffset,
          staff: selectedNoteInMeasure.staff,
          voiceIndex: selectedNoteInMeasure.voiceIndex || 0,
          noteIndex: selectedNoteInMeasure.noteIndex,
          pitch: effectivePitch,
        });
      } else if (e.shiftKey && this.canAddPitchToNearbyNote(staffPosition)) {
        // Legacy: Shift+Alt+Click adds to last note in measure (kept for compatibility)
        this.addPitchToNearbyNote(staffPosition);
      } else {
        // Add a new note at this position (different measure or no selection)
        this.addNoteAtPosition(staffPosition);
      }
    }
  }

  /**
   * Get a selected note in the same measure and staff as the given position
   * PHASE 1.4: Used for polyphony addition via Alt+Click
   * @param {Object} staffPosition - Staff position data
   * @returns {Object|null} - Selected note region or null
   */
  getSelectedNoteInMeasure(staffPosition) {
    if (!staffPosition.measure || !this.noteRegions || this.selectedNotes.size === 0) {
      return null;
    }

    // Find selected notes in the same measure and staff
    for (const noteId of this.selectedNotes) {
      // Handle both regular note IDs (3/4-part legacy) and new IDs (4/5-part with voiceIndex)
      const baseNoteId = this.getBaseNoteId(noteId);
      const region = this.noteRegions.find(r => {
        const regionId = this.createNoteId(r.measureIndex, r.staff, r.voiceIndex || 0, r.noteIndex);
        return regionId === baseNoteId &&
               r.measureIndex === staffPosition.measure.index &&
               r.staff === staffPosition.staff;
      });

      if (region) {
        return region;
      }
    }

    return null;
  }

  /**
   * Check if we can add a pitch to a nearby note (for polyphony)
   * @param {Object} staffPosition - Staff position data
   * @returns {boolean} - True if there's a note at similar position
   */
  canAddPitchToNearbyNote(staffPosition) {
    if (!staffPosition.measure || !this.noteRegions) return false;

    // Look for notes in the same measure and staff
    const sameStaffNotes = this.noteRegions.filter(
      region => region.measureIndex === staffPosition.measure.index &&
                region.staff === staffPosition.staff
    );

    // Check if there's a note nearby in the same beat
    return sameStaffNotes.length > 0;
  }

  /**
   * Add pitch to nearest note to create chord (polyphony)
   * @param {Object} staffPosition - Staff position data
   */
  addPitchToNearbyNote(staffPosition) {
    if (!staffPosition.measure || !this.noteRegions) return;

    // Find the last note in the same measure and staff
    const sameStaffNotes = this.noteRegions.filter(
      region => region.measureIndex === staffPosition.measure.index &&
                region.staff === staffPosition.staff
    );

    if (sameStaffNotes.length > 0) {
      // Add to the last note
      const targetNote = sameStaffNotes[sameStaffNotes.length - 1];

      // SECTION VIEW FIX: Apply filter offset to convert local index to global
      const filterOffset = this.composerIntegration?.getMeasureFilterOffset?.() || 0;

      // Apply key signature to pitch when no explicit accidental is selected
      const nearbyCompositionState = window.getCompositionState?.();
      const effectivePitch = this.getEffectivePitch(staffPosition.pitch, nearbyCompositionState);

      // Emit polyphony add event
      this.onPolyphonyAdd({
        measureIndex: targetNote.measureIndex + filterOffset,
        staff: targetNote.staff,
        noteIndex: targetNote.noteIndex,
        pitch: effectivePitch,
      });
    }
  }

  /**
   * Handle mouse move
   * @param {MouseEvent} e - Mouse event
   */
  handleMouseMove(e) {
    if (!this.isEnabled) return;

    const position = this.getCanvasPosition(e);
    let staffPosition = this.layoutManager.getStaffPositionAtPoint(position.x, position.y);

    // Phase 3: Apply staff selection mode override from toolbar for ghost note
    if (staffPosition && staffPosition.staff) {
      const staffSelectionMode = this.composerIntegration?.toolbar?.getStaffSelectionMode?.() || 'auto';
      if (staffSelectionMode !== 'auto') {
        staffPosition = { ...staffPosition, staff: staffSelectionMode };
      }
    }

    // Track Shift key state
    this.isShiftHeld = e.shiftKey;

    // REMOVED: Hover toolbar logic - now using contextual top toolbar

    // Determine if we're in note entry mode (matching handleMouseDown logic)
    // When toggle is OFF ('select'): Alt = entry mode
    // When toggle is ON ('noteEntry'): Normal = entry mode, Alt = select mode
    const interactionMode = this.composerIntegration?.toolbar?.getInteractionMode?.() || 'select';
    const inNoteEntryMode = interactionMode === 'noteEntry'
      ? !e.altKey  // Sticky mode: normal is entry, Alt inverts to select
      : e.altKey;  // Default: Alt enables entry

    // Only show ghost note in entry mode
    if (!inNoteEntryMode) {
      this.hoveredPosition = null;
      this.ghostNote = null;
      this.renderOverlay();
      return;
    }

    if (this.state === EDITOR_STATES.DRAGGING) {
      // Update drag position
      this.dragCurrentPosition = staffPosition;
      this.updateDragPreview();
    } else {
      // Update hover position
      this.hoveredPosition = staffPosition;
      // Pass canvas coordinates (includes scroll) to updateGhostNote
      this.updateGhostNote(staffPosition, position.x, position.y);
    }

    this.renderOverlay();
  }

  /**
   * Handle mouse up
   * @param {MouseEvent} e - Mouse event
   */
  handleMouseUp(e) {
    if (!this.isEnabled) return;

    const position = this.getCanvasPosition(e);

    // REMOVED: Hover toolbar event blocking - now using contextual top toolbar

    if (this.state === EDITOR_STATES.DRAGGING) {
      this.endDrag();
    }

    this.state = EDITOR_STATES.IDLE;
  }

  /**
   * Handle mouse leave
   */
  handleMouseLeave() {
    this.hoveredPosition = null;
    this.ghostNote = null;

    if (this.state === EDITOR_STATES.DRAGGING) {
      this.cancelDrag();
    }

    this.renderOverlay();
  }

  /**
   * Handle keyboard events
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyDown(e) {
    if (!this.isEnabled) return;

    // Delete selected notes
    // Ctrl+Delete/Backspace = shift delete (removes note and shifts others left)
    // Delete/Backspace alone = replace with rest (preserves rhythm)
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedNotes.size > 0) {
        e.preventDefault();
        const shiftDelete = e.ctrlKey || e.metaKey;
        this.deleteSelectedNotes(shiftDelete);
      }
    }

    // Play selected notes (Space or P key)
    if ((e.key === ' ' || e.key === 'p' || e.key === 'P') && this.selectedNotes.size > 0) {
      e.preventDefault();
      this.playSelectedNotes();
    }

    // Select all (Ctrl+A)
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      this.selectAll();
    }

    // Copy (Ctrl+C) / Copy Building Block (Ctrl+Shift+C)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
      if (this.selectedNotes.size > 0) {
        e.preventDefault();
        if (e.shiftKey) {
          this.copyBuildingBlock(); // Copy entire building block
        } else {
          this.copySelectedNotes(); // Copy just selected notes
        }
      }
    }

    // Paste (Ctrl+V) / Paste at Beginning (Ctrl+Shift+V) / Paste at End (Ctrl+Alt+V)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
      if (this.clipboard) {
        e.preventDefault();
        if (e.shiftKey) {
          this.pasteNotes('beginning');
        } else if (e.altKey) {
          this.pasteNotes('end');
        } else {
          this.pasteNotes('afterSelection');
        }
      }
    }

    // Octave shift up (Ctrl+Up)
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowUp') {
      if (this.selectedNotes.size > 0) {
        e.preventDefault();
        this.shiftSelectedNotesOctave(1); // Up one octave
      }
    }

    // Octave shift down (Ctrl+Down)
    if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowDown') {
      if (this.selectedNotes.size > 0) {
        e.preventDefault();
        this.shiftSelectedNotesOctave(-1); // Down one octave
      }
    }

    // Escape to deselect notes (clears selection entirely)
    if (e.key === 'Escape') {
      if (this.selectedNotes.size > 0) {
        e.preventDefault();
        this.selectedNotes.clear();
        this.hideSelectionHighlight = false;
        this.renderOverlay();

        // Update toolbar to show no selection
        if (this.onNoteSelect) {
          this.onNoteSelect([]);
        }

        // Dispatch event for tutorial validation
        dispatchBuilderEvent('notationNotesDeselected', {});
      }
    }

    // Arrow keys to move selected notes OR insert notes before/after
    if (this.selectedNotes.size > 0) {
      // Insert note before/after (Shift + Arrow Left/Right)
      if (e.shiftKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        this.insertNoteBeforeSelected();
      } else if (e.shiftKey && e.key === 'ArrowRight') {
        e.preventDefault();
        this.insertNoteAfterSelected();
      }
      // Move notes up/down (Arrow Up/Down)
      else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.moveSelectedNotes(1); // Up one step
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.moveSelectedNotes(-1); // Down one step
      }
    }

    // Change duration of selected notes (Shift + 1-6 for durations, already handled by toolbar)
    // But we can add direct duration change via number keys when notes are selected
    if (this.selectedNotes.size > 0 && !e.shiftKey) {
      const durationMap = {
        '1': '1n',  // Whole note
        '2': '2n',  // Half note
        '3': '4n',  // Quarter note
        '4': '8n',  // Eighth note
        '5': '16n', // 16th note
        '6': '32n'  // 32nd note
      };

      if (durationMap[e.key]) {
        e.preventDefault();
        this.changeDurationOfSelected(durationMap[e.key]);
      }
    }

    // Articulations (when notes are selected)
    if (this.selectedNotes.size > 0) {
      // Staccato (Shift + S)
      if (e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        this.toggleArticulationOnSelected('staccato');
      }
      // Accent (Shift + A)
      else if (e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        this.toggleArticulationOnSelected('accent');
      }
      // Tenuto (Shift + T)
      else if (e.shiftKey && (e.key === 'T' || e.key === 't')) {
        e.preventDefault();
        this.toggleArticulationOnSelected('tenuto');
      }
      // Marcato (Shift + M)
      else if (e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        e.preventDefault();
        this.toggleArticulationOnSelected('marcato');
      }
    }

    // Tie toggle (T key, when notes are selected)
    if (this.selectedNotes.size > 0 && !e.shiftKey) {
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault();
        this.toggleTieOnSelected();
      }
    }

    // Tuplet creation from selection (Shift + 3/5/6)
    // Use e.code to check physical key since Shift changes e.key (e.g., Shift+3 = '#')
    if (this.selectedNotes.size >= 2 && e.shiftKey && !e.ctrlKey && !e.metaKey) {
      if (e.code === 'Digit3') {
        e.preventDefault();
        this.createTupletFromSelection('triplet');
      } else if (e.code === 'Digit5') {
        e.preventDefault();
        this.createTupletFromSelection('quintuplet');
      } else if (e.code === 'Digit6') {
        e.preventDefault();
        this.createTupletFromSelection('sextuplet');
      }
    }

    // Tuplet insert mode toggle (Ctrl+Shift + 3/5/6)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      if (e.code === 'Digit3') {
        e.preventDefault();
        this.toggleTupletInsertMode('triplet');
      } else if (e.code === 'Digit5') {
        e.preventDefault();
        this.toggleTupletInsertMode('quintuplet');
      } else if (e.code === 'Digit6') {
        e.preventDefault();
        this.toggleTupletInsertMode('sextuplet');
      }
    }

    // Exit tuplet insert mode with Escape
    if (e.key === 'Escape' && this.tupletInsertMode) {
      e.preventDefault();
      this.exitTupletInsertMode();
    }
  }

  /**
   * Handle keyboard key up events
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyUp(e) {
    if (!this.isEnabled) return;

    // Clear ghost note when Alt key is released
    if (e.key === 'Alt' || e.keyCode === 18) {
      this.hoveredPosition = null;
      this.ghostNote = null;
      this.renderOverlay();
    }
  }

  // ============================================================================
  // POSITION UTILITIES
  // ============================================================================

  /**
   * Get canvas-relative position from mouse event
   * @param {MouseEvent} e - Mouse event
   * @returns {Object} - { x, y }
   */
  getCanvasPosition(e) {
    // Multi-page mode: Use page-local coordinates (NO SCROLL CONVERSION!)
    if (this.pageManager) {
      const pageInfo = this.pageManager.getPageFromEvent(e);
      if (pageInfo) {
        return {
          x: pageInfo.x,
          y: pageInfo.y,
          page: pageInfo.page,
        };
      }
      // Mouse not over any page canvas
      return { x: 0, y: 0, page: null };
    }

    // Legacy single canvas mode
    const rect = this.canvas.getBoundingClientRect();
    const scrollLeft = this.canvas.parentElement ? this.canvas.parentElement.scrollLeft : 0;
    const scrollTop = this.canvas.parentElement ? this.canvas.parentElement.scrollTop : 0;

    // CRITICAL: clientY - rectTop gives viewport-relative position, but we need canvas-local position
    // Since parent scrolls and canvas is position:static, we must ADD scroll to get full canvas coords
    const pos = {
      x: (e.clientX - rect.left) + scrollLeft,
      y: (e.clientY - rect.top) + scrollTop,
    };

    return pos;
  }

  /**
   * Set note regions from renderer
   * @param {Array} regions - Array of note regions with bounding boxes
   */
  setNoteRegions(regions) {
    this.noteRegions = regions || [];
  }

  /**
   * Find note at a given position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object|null} - Note data or null, includes pitchIndex for chords
   */
  findNoteAtPosition(x, y) {
    if (!this.noteRegions || this.noteRegions.length === 0) {
      return null;
    }

    // Convert canvas-local coordinates to layout coordinates
    // Note regions have bounds in layout coordinates (absolute positions in full canvas)
    // But x, y are in canvas-local coordinates (viewport-relative)
    const scrollLeft = this.canvas.parentElement ? this.canvas.parentElement.scrollLeft : 0;
    const scrollTop = this.canvas.parentElement ? this.canvas.parentElement.scrollTop : 0;
    const layoutX = x + scrollLeft;
    const layoutY = y + scrollTop;

    // Note head hit detection radius (slightly larger than visual highlight)
    const NOTE_HEAD_HIT_RADIUS_X = 10;
    const NOTE_HEAD_HIT_RADIUS_Y = 8;
    const NOTE_HEAD_X_OFFSET = 5;  // Match visual offset (VexFlow returns left edge)

    // First pass: Check for precise note head hits (for chords and single notes)
    const noteHeadMatches = [];

    for (const region of this.noteRegions) {
      if (region.noteHeadPositions && region.noteHeadPositions.length > 0) {
        // Check each note head position
        for (let i = 0; i < region.noteHeadPositions.length; i++) {
          const pos = region.noteHeadPositions[i];
          const centerX = pos.x + NOTE_HEAD_X_OFFSET;  // Apply offset to match visual
          // Ellipse hit test: (x-cx)^2/rx^2 + (y-cy)^2/ry^2 <= 1
          const dx = (layoutX - centerX) / NOTE_HEAD_HIT_RADIUS_X;
          const dy = (layoutY - pos.y) / NOTE_HEAD_HIT_RADIUS_Y;
          const distSquared = dx * dx + dy * dy;

          if (distSquared <= 1) {
            // Hit! Calculate actual distance for prioritization
            const distance = Math.sqrt(Math.pow(layoutX - centerX, 2) + Math.pow(layoutY - pos.y, 2));
            noteHeadMatches.push({
              region,
              noteHeadIndex: i,
              distance,
            });
          }
        }
      }
    }

    // If we have note head matches, use the closest one
    if (noteHeadMatches.length > 0) {
      noteHeadMatches.sort((a, b) => a.distance - b.distance);
      const bestMatch = noteHeadMatches[0];
      const region = bestMatch.region;

      const result = {
        id: this.createNoteId(region.measureIndex, region.staff, region.voiceIndex || 0, region.noteIndex),
        measureIndex: region.measureIndex,
        staff: region.staff,
        voiceIndex: region.voiceIndex || 0,
        noteIndex: region.noteIndex,
        pitch: region.pitch,
        pitches: region.pitches,
        bounds: region.bounds,
        beat: region.beat,  // Include beat for auto-generated rest handling
        isAutoGenerated: region.isAutoGenerated || false,  // Flag for auto-generated rests
        isRest: region.isRest || false,
        duration: region.duration || '4n',
      };

      // Map note head index back to pitch index
      if (region.pitches && region.pitches.length > 1) {
        // VexFlow's getYs() returns positions sorted by pitch (low to high)
        // Need to map back to original pitch index
        const sortedPitches = region.pitches.map((p, idx) => ({
          pitch: p,
          originalIndex: idx,
          midi: noteToMidi(p)
        })).sort((a, b) => a.midi - b.midi);

        if (bestMatch.noteHeadIndex < sortedPitches.length) {
          result.pitchIndex = sortedPitches[bestMatch.noteHeadIndex].originalIndex;
          result.selectedPitch = region.pitches[result.pitchIndex];
        } else {
          result.pitchIndex = 0;
          result.selectedPitch = region.pitches[0];
        }
      } else {
        result.pitchIndex = 0;
        result.selectedPitch = region.pitch || (region.pitches ? region.pitches[0] : null);
      }

      return result;
    }

    // Fallback: Check bounding boxes (for regions without note head positions)
    const matchingRegions = [];

    for (const region of this.noteRegions) {
      if (!region.bounds) continue;

      const { x: rx, y: ry, width, height } = region.bounds;

      // Check if point is within bounding box (comparing layout coordinates)
      if (layoutX >= rx && layoutX <= rx + width && layoutY >= ry && layoutY <= ry + height) {
        // Calculate distance from click to region center (for overlap resolution)
        const centerX = rx + width / 2;
        const centerY = ry + height / 2;
        const distanceToCenter = Math.sqrt(
          Math.pow(layoutX - centerX, 2) + Math.pow(layoutY - centerY, 2)
        );

        matchingRegions.push({
          region,
          distanceToCenter,
        });
      }
    }

    // No matches
    if (matchingRegions.length === 0) {
      return null;
    }

    // Pick the region with the smallest distance to center (best match for overlapping regions)
    matchingRegions.sort((a, b) => a.distanceToCenter - b.distanceToCenter);
    const bestMatch = matchingRegions[0].region;

    const result = {
      id: this.createNoteId(bestMatch.measureIndex, bestMatch.staff, bestMatch.voiceIndex || 0, bestMatch.noteIndex),
      measureIndex: bestMatch.measureIndex,
      staff: bestMatch.staff,
      voiceIndex: bestMatch.voiceIndex || 0,
      noteIndex: bestMatch.noteIndex,
      pitch: bestMatch.pitch,
      pitches: bestMatch.pitches,
      bounds: bestMatch.bounds,
      beat: bestMatch.beat,  // Include beat for auto-generated rest handling
      isAutoGenerated: bestMatch.isAutoGenerated || false,  // Flag for auto-generated rests
      isRest: bestMatch.isRest || false,
      duration: bestMatch.duration || '4n',
    };

    // For chords (multiple pitches), determine which pitch was clicked based on Y position
    if (bestMatch.pitches && bestMatch.pitches.length > 1) {
      // Try to use note head positions if available
      if (bestMatch.noteHeadPositions && bestMatch.noteHeadPositions.length > 0) {
        const pitchIndex = this.findClosestPitchIndexByNoteHeads(bestMatch, layoutY);
        result.pitchIndex = pitchIndex;
        result.selectedPitch = bestMatch.pitches[pitchIndex];
      } else {
        const pitchIndex = this.findClosestPitchIndex(bestMatch.pitches, layoutY, bestMatch.bounds, bestMatch.staff);
        result.pitchIndex = pitchIndex;
        result.selectedPitch = bestMatch.pitches[pitchIndex];
      }
    } else {
      result.pitchIndex = 0;
      result.selectedPitch = bestMatch.pitch || (bestMatch.pitches ? bestMatch.pitches[0] : null);
    }

    return result;
  }

  /**
   * Find closest pitch index using actual note head positions
   * @param {Object} region - Note region with noteHeadPositions
   * @param {number} clickY - Y coordinate of click
   * @returns {number} - Index of closest pitch
   */
  findClosestPitchIndexByNoteHeads(region, clickY) {
    if (!region.noteHeadPositions || region.noteHeadPositions.length === 0) {
      return 0;
    }

    // Find the note head closest to the click Y
    let closestIdx = 0;
    let closestDistance = Infinity;

    for (let i = 0; i < region.noteHeadPositions.length; i++) {
      const distance = Math.abs(clickY - region.noteHeadPositions[i].y);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIdx = i;
      }
    }

    // Map note head index (sorted by pitch) back to original pitch index
    const sortedPitches = region.pitches.map((p, idx) => ({
      pitch: p,
      originalIndex: idx,
      midi: noteToMidi(p)
    })).sort((a, b) => a.midi - b.midi);

    if (closestIdx < sortedPitches.length) {
      return sortedPitches[closestIdx].originalIndex;
    }
    return 0;
  }

  /**
   * Find the closest pitch index based on Y position within a chord
   * @param {Array} pitches - Array of pitch strings (e.g., ['C4', 'E4', 'G4'])
   * @param {number} clickY - Y coordinate of click
   * @param {Object} bounds - Bounding box of the note
   * @param {string} staff - Staff name ('treble' or 'bass')
   * @returns {number} - Index of closest pitch
   */
  findClosestPitchIndex(pitches, clickY, bounds, staff) {
    if (!pitches || pitches.length <= 1) return 0;

    // Sort pitches by MIDI value (low to high)
    const sortedPitches = pitches.map((p, idx) => ({
      pitch: p,
      originalIndex: idx,
      midi: noteToMidi(p)
    })).sort((a, b) => a.midi - b.midi);

    // On staff: higher Y = lower pitch, lower Y = higher pitch
    // Divide the bounding box height by number of pitches
    const { y: boundsY, height } = bounds;
    const pitchZoneHeight = height / sortedPitches.length;

    // Calculate which zone the click falls into
    // clickY relative to bounds top
    const relativeY = clickY - boundsY;

    // Zone 0 is at the top (highest pitch), zone n-1 is at bottom (lowest pitch)
    let zoneIndex = Math.floor(relativeY / pitchZoneHeight);
    zoneIndex = Math.max(0, Math.min(sortedPitches.length - 1, zoneIndex));

    // Top zone = highest pitch = last in sortedPitches
    // Bottom zone = lowest pitch = first in sortedPitches
    const pitchAtZone = sortedPitches[sortedPitches.length - 1 - zoneIndex];

    return pitchAtZone.originalIndex;
  }

  /**
   * Convert staff position to pitch
   * @param {Object} staffPosition - Staff position data
   * @returns {string} - Pitch string like "C4"
   */
  positionToPitch(staffPosition) {
    return staffPosition.pitch || 'C4';
  }

  // ============================================================================
  // NOTE OPERATIONS
  // ============================================================================

  /**
   * Find the insertion point for a new note based on X position
   * Determines if the note should be inserted before/after an existing note
   * @param {Object} staffPosition - Staff position with x, y coordinates
   * @param {number} measureIndex - Target measure index
   * @param {string} staff - Staff name ('treble' or 'bass')
   * @returns {Object|null} - {action: 'before'|'after', noteIndex: number} or null if should append
   */
  findInsertionPoint(staffPosition, measureIndex, staff) {
    if (!this.noteRegions || this.noteRegions.length === 0) {
      return null; // No existing notes
    }

    // MULTI-VOICE: Get the current voice index for this staff (used as fallback)
    const currentVoiceIndex = this.getVoiceIndexForStaff(staff);

    // Find all notes in the same measure and staff (from ANY voice)
    // We'll determine which voice based on which note is clicked
    const notesInMeasure = this.noteRegions.filter(r =>
      r.measureIndex === measureIndex &&
      r.staff === staff &&
      r.bounds // Has position info
    );

    if (notesInMeasure.length === 0) {
      return null; // No notes in this measure yet
    }

    const clickX = staffPosition.x;

    // Sort notes by their X position (left to right)
    notesInMeasure.sort((a, b) => a.bounds.x - b.bounds.x);

    // Check if clicking before the first note
    const firstNote = notesInMeasure[0];
    if (clickX < firstNote.bounds.x) {
      return {
        action: 'before',
        noteIndex: firstNote.noteIndex,
        voiceIndex: firstNote.voiceIndex ?? currentVoiceIndex // Use clicked note's voice
      };
    }

    // Check if clicking after the last note
    const lastNote = notesInMeasure[notesInMeasure.length - 1];
    if (clickX > lastNote.bounds.x + lastNote.bounds.width) {
      return null; // Append to end (use normal behavior with selected voice)
    }

    // Check if clicking between two notes or on a note
    for (let i = 0; i < notesInMeasure.length; i++) {
      const currentNote = notesInMeasure[i];
      const noteStart = currentNote.bounds.x;
      const noteEnd = currentNote.bounds.x + currentNote.bounds.width;

      // Check if click is ON this note
      if (clickX >= noteStart && clickX <= noteEnd) {
        // Multiple notes may be at the same X position (different voices at same beat)
        // Find all notes at this X position and pick the one closest to click Y
        const clickY = staffPosition.y;
        const notesAtSameX = notesInMeasure.filter(n =>
          clickX >= n.bounds.x && clickX <= n.bounds.x + n.bounds.width
        );

        if (notesAtSameX.length > 1 && clickY !== undefined) {
          // Multiple notes at same X - pick the one closest to the click Y
          let closestNote = notesAtSameX[0];
          let closestDistance = Math.abs((closestNote.bounds.y + closestNote.bounds.height / 2) - clickY);

          for (const note of notesAtSameX) {
            const noteCenterY = note.bounds.y + note.bounds.height / 2;
            const distance = Math.abs(noteCenterY - clickY);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestNote = note;
            }
          }

          return {
            action: 'after',
            noteIndex: closestNote.noteIndex,
            voiceIndex: closestNote.voiceIndex ?? currentVoiceIndex
          };
        }

        // Single note at this position - use it
        return {
          action: 'after',
          noteIndex: currentNote.noteIndex,
          voiceIndex: currentNote.voiceIndex ?? currentVoiceIndex
        };
      }

      // Check if between this note and the next
      if (i < notesInMeasure.length - 1) {
        const nextNote = notesInMeasure[i + 1];
        const nextStart = nextNote.bounds.x;

        if (clickX > noteEnd && clickX < nextStart) {
          // Between two notes - determine which is closer
          const distanceToCurrent = clickX - noteEnd;
          const distanceToNext = nextStart - clickX;

          if (distanceToCurrent < distanceToNext) {
            // Closer to current note - insert after it, use its voice
            return {
              action: 'after',
              noteIndex: currentNote.noteIndex,
              voiceIndex: currentNote.voiceIndex ?? currentVoiceIndex
            };
          } else {
            // Closer to next note - insert before it, use its voice
            return {
              action: 'before',
              noteIndex: nextNote.noteIndex,
              voiceIndex: nextNote.voiceIndex ?? currentVoiceIndex
            };
          }
        }
      }
    }

    return null; // No specific insertion point found
  }

  /**
   * Calculate the beat position from a click X coordinate
   * Uses rendered note regions from any voice to determine the beat position
   * This is essential for multi-voice support where Voice 2 notes need to align with Voice 1
   * @param {number} clickX - X coordinate of the click
   * @param {number} measureIndex - Target measure index
   * @param {string} staff - Staff name ('treble' or 'bass')
   * @returns {number} - Beat position (0-based)
   */
  getBeatPositionFromX(clickX, measureIndex, staff) {
    if (!this.noteRegions || this.noteRegions.length === 0) {
      return 0; // Default to beat 0 if no notes exist
    }

    // Find all notes in the same measure and staff (from any voice)
    const notesInMeasure = this.noteRegions.filter(r =>
      r.measureIndex === measureIndex &&
      r.staff === staff &&
      r.bounds
    );

    if (notesInMeasure.length === 0) {
      return 0; // No notes in this measure yet
    }

    // Sort notes by their X position (left to right)
    notesInMeasure.sort((a, b) => a.bounds.x - b.bounds.x);

    // Get the compositionState to look up beat positions
    const compositionState = window.getCompositionState?.();
    if (!compositionState) {
      return 0;
    }

    const measure = compositionState.measures[measureIndex];
    if (!measure) {
      return 0;
    }

    // Check if clicking before the first note - return beat 0
    const firstNote = notesInMeasure[0];
    if (clickX < firstNote.bounds.x) {
      return 0;
    }

    // Find which note region the click is on or near
    for (let i = 0; i < notesInMeasure.length; i++) {
      const region = notesInMeasure[i];
      const noteStart = region.bounds.x;
      const noteEnd = region.bounds.x + region.bounds.width;

      // If click is within or near this note's region
      if (clickX >= noteStart && clickX <= noteEnd + 20) {
        // Get the beat position of this note from Voice 0
        const voice0 = measure.notation[staff]?.voices?.[0];
        if (voice0 && voice0.notes[region.noteIndex]) {
          return voice0.notes[region.noteIndex].beat || 0;
        }
      }

      // If click is between this note and the next
      if (i < notesInMeasure.length - 1) {
        const nextRegion = notesInMeasure[i + 1];
        if (clickX > noteEnd && clickX < nextRegion.bounds.x) {
          // Return the beat position of the next note
          const voice0 = measure.notation[staff]?.voices?.[0];
          if (voice0 && voice0.notes[nextRegion.noteIndex]) {
            return voice0.notes[nextRegion.noteIndex].beat || 0;
          }
        }
      }
    }

    // If clicking after all notes, calculate beat position at end
    const lastNote = notesInMeasure[notesInMeasure.length - 1];
    const voice0 = measure.notation[staff]?.voices?.[0];
    if (voice0 && voice0.notes[lastNote.noteIndex]) {
      const lastBeat = voice0.notes[lastNote.noteIndex].beat || 0;
      const lastDuration = this.durationToBeats(
        voice0.notes[lastNote.noteIndex].duration || '4n',
        voice0.notes[lastNote.noteIndex].dotted
      );
      return lastBeat + lastDuration;
    }

    return 0;
  }

  // ============================================================================
  // NOTE INSERTION
  // ============================================================================

  /**
   * Add a note at a staff position
   * @param {Object} staffPosition - Staff position data
   */
  addNoteAtPosition(staffPosition) {
    if (!staffPosition.pitch) {
      return;
    }

    // IMPORTANT: Sync ALL tool state from toolbar before adding note
    // This ensures we always use the current toolbar state, not potentially stale cached values
    if (window.getCurrentNoteIsRest) {
      const currentRestMode = window.getCurrentNoteIsRest();
      if (this.isRestMode !== currentRestMode) {
        this.isRestMode = currentRestMode;
      }
    }
    if (window.getCurrentNoteDuration) {
      const currentDuration = window.getCurrentNoteDuration();
      // Duration from toolbar may have dotted suffix, strip it
      const durationWithoutDot = currentDuration.replace('.', '');
      if (this.currentDuration !== durationWithoutDot) {
        this.currentDuration = durationWithoutDot;
      }
    }
    if (window.getCurrentNoteDotted) {
      const currentDotted = window.getCurrentNoteDotted();
      if (this.isDotted !== currentDotted) {
        this.isDotted = currentDotted;
      }
    }

    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    // CRITICAL: Always use the CLICKED/HOVERED measure, not the selected measure
    // The measure where the mouse is hovering is what the user expects the note to be added to
    // SECTION VIEW FIX: Apply filter offset to convert local index to global
    const filterOffset = this.composerIntegration?.getMeasureFilterOffset?.() || 0;
    const targetMeasureIndex = (staffPosition.measure?.index ?? 0) + filterOffset;

    // Use the staff from staffPosition (treble or bass from where user clicked)
    const staff = staffPosition.staff;

    // Calculate beats for this note
    const noteBeats = this.durationToBeats(this.currentDuration, this.isDotted);
    const remainingBeats = this.getRemainingBeats(targetMeasureIndex, staff);

    // NEW: Check if we should insert at a specific position (between existing notes)
    // Look for existing notes at the clicked X position
    const insertionPoint = this.findInsertionPoint(staffPosition, targetMeasureIndex, staff);

    if (insertionPoint !== null && window.getCompositionState) {
      // We found a specific insertion point - use intelligent insertion

      const compositionState = window.getCompositionState();
      if (!compositionState || !compositionState.measures[targetMeasureIndex]) {
        console.warn('[NoteEditor] Cannot access compositionState');
        return;
      }

      // MULTI-VOICE: Use the voice from the insertion point (the clicked note's voice)
      const insertVoiceIndex = insertionPoint.voiceIndex ?? this.getVoiceIndexForStaff(staff);

      // Check if the note fits in the measure (duration validation)
      // Calculate current beats used from compositionState (more accurate than noteRegions)
      const measure = compositionState.measures[targetMeasureIndex];

      // Get the specific voice from the insertion point
      const voices = measure.notation?.[staff]?.voices || [];
      while (voices.length <= insertVoiceIndex) {
        voices.push({ notes: [] });
      }
      const voice = voices[insertVoiceIndex];

      let usedBeats = 0;
      for (const note of voice.notes) {
        let beats = this.durationToBeats(note.duration || '4n', note.dotted);
        // Account for tuplet notes (e.g., triplet quarter notes take 0.667 beats, not 1)
        if (note.tuplet && note.tuplet.type && TUPLET_RATIOS[note.tuplet.type]) {
          const ratio = TUPLET_RATIOS[note.tuplet.type];
          beats = beats * (ratio.normal / ratio.actual);
        }
        usedBeats += beats;
      }

      // Calculate requested beats, accounting for tuplet insert mode
      let requestedBeats = this.durationToBeats(this.currentDuration, this.isDotted);
      if (this.tupletInsertMode && TUPLET_RATIOS[this.tupletInsertMode]) {
        // In tuplet mode, the note takes up fewer beats (e.g., triplet: 3 notes in time of 2)
        const ratio = TUPLET_RATIOS[this.tupletInsertMode];
        requestedBeats = requestedBeats * (ratio.normal / ratio.actual);
      }

      // Calculate available beats differently for treble vs bass
      let maxBeats;
      let availableBeats;

      // Get beats per measure from time signature (normalized to quarter-note beats)
      const ts = compositionState.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE;
      const beatsPerMeasure = ts.num * (4 / ts.denom); // e.g., 6/8 = 3, 4/4 = 4, 3/4 = 3

      if (staff === 'bass') {
        // BASS CLEF: Use building block (chord segment) boundaries, not measure boundaries
        const beatInMeasure = this.getCurrentBeat(targetMeasureIndex, staff);
        const blockInfo = this.getBuildingBlockInfo(targetMeasureIndex, beatInMeasure);

        if (blockInfo) {
          // Get total used beats in the entire building block
          const usedInBlock = this.getUsedBeatsInBuildingBlock(blockInfo.segment);
          maxBeats = blockInfo.segmentDurationBeats;
          availableBeats = maxBeats - usedInBlock;
        } else {
          // Fallback to measure-based if no segment found
          maxBeats = beatsPerMeasure;
          availableBeats = maxBeats - usedBeats;
        }
      } else {
        // TREBLE CLEF: Use measure boundaries
        maxBeats = beatsPerMeasure;
        availableBeats = maxBeats - usedBeats;
      }

      // TREBLE CLEF: Handle overflow with user choice dialog
      if (staff === 'treble' && requestedBeats > availableBeats) {
        const overflowBeats = requestedBeats - availableBeats;

        // Determine if this is the last note position (appending to end)
        const isAppendingToEnd = insertionPoint.noteIndex >= voice.notes.length - 1;

        // Prepare note data for use in callback
        // Apply key signature to pitch when no explicit accidental is selected
        const effectivePitch = this.getEffectivePitch(staffPosition.pitch, compositionState);
        const noteDataForCallback = {
          pitch: effectivePitch,
          pitches: [effectivePitch],
          duration: this.currentDuration,
          isRest: this.isRestMode,
          dotted: this.isDotted,
          accidental: this.currentAccidental,
          articulation: this.currentArticulation,
          dynamic: this.currentDynamic,
        };

        // Show overflow dialog
        showNoteOverflowDialog({
          overflowBeats,
          noteDuration: this.currentDuration,
          onChoice: (choice) => {
            if (choice === null) {
              // User cancelled
              return;
            }

            if (choice === 'truncate') {
              // Truncate: Insert the note at the position and remove any notes that overflow
              const targetIndex = insertionPoint.action === 'before' ? insertionPoint.noteIndex : insertionPoint.noteIndex + 1;

              // Calculate the beat position where we're inserting
              let insertBeat = 0;
              for (let i = 0; i < targetIndex; i++) {
                let beats = this.durationToBeats(voice.notes[i].duration || '4n', voice.notes[i].dotted);
                insertBeat += beats;
              }

              const maxBeats = beatsPerMeasure; // Use time signature
              const spaceAfterInsertPoint = maxBeats - insertBeat;

              if (spaceAfterInsertPoint <= 0) {
                console.warn('[NoteEditor] No space at insert position');
                return;
              }

              // Determine the duration for the new note (truncate if needed)
              let newNoteBeats = requestedBeats;
              if (newNoteBeats > spaceAfterInsertPoint) {
                newNoteBeats = spaceAfterInsertPoint;
              }
              const fitDuration = this.beatsToDuration(newNoteBeats);

              // Remove all notes from the insert position onward (they get truncated out)
              voice.notes.splice(targetIndex);

              // Add the new note
              const truncatedNote = {
                ...noteDataForCallback,
                duration: fitDuration.duration,
                dotted: fitDuration.dotted,
                beat: insertBeat,
              };
              voice.notes.push(truncatedNote);

              // Recalculate beat positions
              this.recalculateBeatPositions(voice.notes);

              // Sync to treble block sequence if needed
              if (staff === 'treble' && compositionState.trebleBlockSequence?.blocks?.length > 0) {
                compositionState.syncMeasuresToTrebleBlock();
              }

              this.composerIntegration.render();
            } else if (choice === 'shift') {
              // Shift: use the treble block sequence to insert with shift
              this.insertTrebleNoteWithShiftAtPosition(
                targetMeasureIndex,
                insertionPoint,
                noteDataForCallback,
                compositionState
              );
            }
          },
        });
        return;
      }

      // If no room at all, don't add the note
      if (availableBeats <= 0) {
        const context = staff === 'bass' ? 'Building block' : 'Measure';
        console.warn(`[NoteEditor] ${context} is full, cannot insert note`);
        return;
      }

      // Calculate the duration to use (cap at available beats if needed)
      let durationToUse = this.currentDuration;
      let dottedToUse = this.isDotted;

      if (requestedBeats > availableBeats) {
        // Reduce duration to fit available space
        const fitDuration = this.beatsToDuration(availableBeats);
        durationToUse = fitDuration.duration;
        dottedToUse = fitDuration.dotted;
        const context = staff === 'bass' ? 'building block' : 'measure';
      }

      // Apply key signature to pitch when no explicit accidental is selected
      const effectivePitch = this.getEffectivePitch(staffPosition.pitch, compositionState);
      const noteData = {
        pitch: effectivePitch,
        pitches: [effectivePitch],
        duration: durationToUse,
        isRest: this.isRestMode,
        dotted: dottedToUse,
        accidental: this.currentAccidental,
        articulation: this.currentArticulation,
        dynamic: this.currentDynamic,
      };

      // Insert note at the specified position
      const targetIndex = insertionPoint.action === 'before' ? insertionPoint.noteIndex : insertionPoint.noteIndex + 1;
      voice.notes.splice(targetIndex, 0, noteData);

      this.composerIntegration.render();
      return;
    }

    // No specific insertion point found - use original behavior (append to end)
    // Calculate remaining beats based on staff type
    let effectiveRemainingBeats = remainingBeats; // Measure-based for treble

    // DEBUG: Trace append-to-end path
    const voiceIdx = this.getVoiceIndexForStaff(staff);

    if (staff === 'bass') {
      // BASS CLEF: Voice 1 uses building block constraints, Voice 2 uses measure constraints
      const bassVoiceIndex = this.getVoiceIndexForStaff('bass');

      if (bassVoiceIndex === 0) {
        // Voice 1 (chord cards): Calculate remaining beats within the building block
        const beatInMeasure = this.getCurrentBeat(targetMeasureIndex, staff);
        const blockInfo = this.getBuildingBlockInfo(targetMeasureIndex, beatInMeasure);

        if (blockInfo) {
          const usedInBlock = this.getUsedBeatsInBuildingBlock(blockInfo.segment);
          effectiveRemainingBeats = blockInfo.segmentDurationBeats - usedInBlock;
        }
      } else {
        // Voice 2+: Use measure-based constraints (same as treble)
        // remainingBeats is already calculated correctly for the current voice
        effectiveRemainingBeats = remainingBeats;
      }
    }

    // TREBLE CLEF: Check for overflow when appending
    if (staff === 'treble' && noteBeats > effectiveRemainingBeats && effectiveRemainingBeats > 0) {
      const overflowBeats = noteBeats - effectiveRemainingBeats;

      // Prepare note data for use in callback
      // Apply key signature to pitch when no explicit accidental is selected
      const overflowCompositionState = window.getCompositionState?.();
      const effectivePitch = this.getEffectivePitch(staffPosition.pitch, overflowCompositionState);
      const noteDataForCallback = {
        pitch: effectivePitch,
        pitches: [effectivePitch],
        duration: this.currentDuration,
        isRest: this.isRestMode,
        dotted: this.isDotted,
        accidental: this.currentAccidental,
        articulation: this.currentArticulation,
        dynamic: this.currentDynamic,
        beat: this.getCurrentBeat(targetMeasureIndex, staff),
      };

      // Show overflow dialog
      showNoteOverflowDialog({
        overflowBeats,
        noteDuration: this.currentDuration,
        onChoice: (choice) => {
          if (choice === null) {
            // User cancelled
            return;
          }

          if (choice === 'truncate') {
            // Truncate: add note with reduced duration to fit measure
            const fitDuration = this.beatsToDuration(effectiveRemainingBeats);
            const truncatedNote = {
              type: this.isRestMode ? 'rest' : 'note',
              ...noteDataForCallback,
              duration: fitDuration.duration,
              dotted: fitDuration.dotted,
            };
            this.onNoteAdd({
              measureIndex: targetMeasureIndex,
              staff: staff,
              note: truncatedNote,
            });
          } else if (choice === 'shift') {
            // Shift: use the treble block sequence to insert with shift
            const compositionState = window.getCompositionState();
            if (compositionState) {
              this.insertTrebleNoteWithShiftAtEnd(
                targetMeasureIndex,
                noteDataForCallback,
                compositionState
              );
            }
          }
        },
      });
      return;
    }

    // If the note fits completely, add it normally
    if (noteBeats <= effectiveRemainingBeats) {
      // getCurrentBeat now respects the current voice (Voice 1 or Voice 2)
      const beatPosition = this.getCurrentBeat(targetMeasureIndex, staff);

      // Apply key signature to pitch when no explicit accidental is selected
      const normalCompositionState = window.getCompositionState?.();
      const effectivePitch = this.getEffectivePitch(staffPosition.pitch, normalCompositionState);

      const noteData = {
        type: this.isRestMode ? 'rest' : 'note',
        pitch: effectivePitch,
        duration: this.currentDuration,
        isRest: this.isRestMode,
        dotted: this.isDotted,
        accidental: this.currentAccidental,
        articulation: this.currentArticulation,
        dynamic: this.currentDynamic,
        beat: beatPosition,
      };

      // Apply tuplet attributes if in tuplet insert mode
      if (this.tupletInsertMode) {
        this.applyTupletAttributesToNoteData(noteData, targetMeasureIndex, staff);
      }

      this.onNoteAdd({
        measureIndex: targetMeasureIndex,
        staff: staff,
        note: noteData,
      });

      // Check if measure is now full
      const newRemainingBeats = this.getRemainingBeats(targetMeasureIndex, staff);
      if (newRemainingBeats <= 0.001) {
        this.autoAdvanceMeasure(targetMeasureIndex);
      }

      return;
    }

    // BASS CLEF: Don't split across building blocks - just truncate to fit the current block
    if (staff === 'bass') {
      if (effectiveRemainingBeats > 0) {
        const beatPosition = this.getCurrentBeat(targetMeasureIndex, staff);
        // Truncate to fit remaining space in building block
        const truncatedBeats = Math.min(noteBeats, effectiveRemainingBeats);
        const fitDuration = this.beatsToDuration(truncatedBeats);
        // Apply key signature to pitch when no explicit accidental is selected
        const bassCompositionState = window.getCompositionState?.();
        const effectivePitch = this.getEffectivePitch(staffPosition.pitch, bassCompositionState);
        const truncatedNote = {
          type: this.isRestMode ? 'rest' : 'note',
          pitch: effectivePitch,
          duration: fitDuration.duration,
          isRest: this.isRestMode,
          dotted: fitDuration.dotted,
          accidental: this.currentAccidental,
          articulation: this.currentArticulation,
          dynamic: this.currentDynamic,
          beat: beatPosition,
        };

        this.onNoteAdd({
          measureIndex: targetMeasureIndex,
          staff: staff,
          note: truncatedNote,
        });

        if (truncatedBeats < noteBeats) {
        }
      } else {
        console.warn('[NoteEditor] Building block is full, cannot add bass note');
      }
      return;
    }

    // TREBLE CLEF: Split across measures with ties (original behavior)
    // Apply key signature to pitch when no explicit accidental is selected
    // Calculate effective pitch ONCE for consistency across tied notes
    const tieCompositionState = window.getCompositionState?.();
    const effectivePitch = this.getEffectivePitch(staffPosition.pitch, tieCompositionState);

    // Add first part to fill current measure
    if (effectiveRemainingBeats > 0) {
      const beatPosition = this.getCurrentBeat(targetMeasureIndex, staff);
      const firstPartDuration = this.beatsToDuration(effectiveRemainingBeats);
      const firstPartNote = {
        type: this.isRestMode ? 'rest' : 'note',
        pitch: effectivePitch,
        duration: firstPartDuration.duration,
        isRest: this.isRestMode,
        dotted: firstPartDuration.dotted,
        accidental: this.currentAccidental,
        articulation: this.currentArticulation,
        dynamic: this.currentDynamic,
        tie: 'start', // Mark as start of tie
        beat: beatPosition,
      };

      this.onNoteAdd({
        measureIndex: targetMeasureIndex,
        staff: staff,
        note: firstPartNote,
      });
    }

    // Calculate remaining beats for next measure
    let remainingNoteBeats = noteBeats - effectiveRemainingBeats;
    let currentMeasureIndex = targetMeasureIndex + 1;

    // Add tied notes to subsequent measures
    while (remainingNoteBeats > 0.001) {
      const beatsToAdd = Math.min(remainingNoteBeats, 4); // Max 4 beats per measure
      const tiedDuration = this.beatsToDuration(beatsToAdd);
      const beatPosition = this.getCurrentBeat(currentMeasureIndex, staff);

      const tiedNote = {
        type: this.isRestMode ? 'rest' : 'note',
        pitch: effectivePitch, // Use same pitch as first part of tie
        duration: tiedDuration.duration,
        isRest: this.isRestMode,
        dotted: tiedDuration.dotted,
        accidental: null, // No accidental on tied notes
        articulation: null, // No articulation on tied continuation notes
        tie: remainingNoteBeats - beatsToAdd > 0.001 ? 'continue' : 'end',
        beat: beatPosition,
      };

      this.onNoteAdd({
        measureIndex: currentMeasureIndex,
        staff: staff,
        note: tiedNote,
      });

      remainingNoteBeats -= beatsToAdd;
      currentMeasureIndex++;
    }

    // Auto-advance to the last measure we added to
    this.autoAdvanceMeasure(currentMeasureIndex - 1);
  }

  /**
   * Insert a treble note with shift at a specific position
   * Uses direct voice-based shifting for multi-voice scenarios,
   * falls back to trebleBlockSequence for single-voice
   * @param {number} measureIndex - Target measure index
   * @param {Object} insertionPoint - { action, noteIndex }
   * @param {Object} noteData - Note data to insert
   * @param {Object} compositionState - CompositionState instance
   */
  insertTrebleNoteWithShiftAtPosition(measureIndex, insertionPoint, noteData, compositionState) {
    console.log('[SHIFT-INSERT] insertTrebleNoteWithShiftAtPosition called:', {
      measureIndex,
      insertionPoint,
      noteData,
    });

    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);
    const UNITS_PER_BEAT = 48;

    // Calculate the beat position of the insertion point
    const measure = compositionState.measures[measureIndex];

    // MULTI-VOICE: Use the voice from the insertion point (the clicked note's voice)
    // This ensures clicking on a Voice 1 note inserts into Voice 1, etc.
    const voiceIndex = insertionPoint.voiceIndex ?? this.getVoiceIndexForStaff('treble');

    // Get the specific voice to insert into
    const voices = measure.notation?.treble?.voices || [];
    while (voices.length <= voiceIndex) {
      voices.push({ notes: [] });
    }
    const voice = voices[voiceIndex];

    let beatPosition = 0;

    // MULTI-VOICE CHECK: Detect if Voice 2 has any notes across all measures
    // If so, we must use direct voice-based shifting to preserve voice separation
    const hasMultipleVoices = compositionState.measures.some(m => {
      const voices = m.notation?.treble?.voices || [];
      return voices.length > 1 && voices[1]?.notes?.length > 0;
    });

    // Check if we're trying to insert relative to a tied note continuation
    const targetNoteIndex = insertionPoint.noteIndex;
    const targetNote = voice.notes[targetNoteIndex];

    if (targetNote && targetNote.isTied) {
      // Tied notes are continuations of notes from a previous measure.
      // We need to find the original note and insert relative to that instead.
      // For "before" a tied note, insert before the original note in the previous measure.
      // For "after" a tied note, insert after the full tied note ends.

      if (insertionPoint.action === 'before') {
        // Find the original note by looking backwards
        // The tied continuation starts at beat 0 of this measure, so the original
        // note is at the end of the previous measure
        if (measureIndex > 0) {
          const prevMeasure = compositionState.measures[measureIndex - 1];
          const prevVoice = this.getVoice(prevMeasure, 'treble');
          if (prevVoice && prevVoice.notes.length > 0) {
            // Find the last non-rest note in previous measure (the start of the tie)
            let origNoteIndex = prevVoice.notes.length - 1;
            // Insert before that note instead
            return this.insertTrebleNoteWithShiftAtPosition(
              measureIndex - 1,
              { action: 'before', noteIndex: origNoteIndex },
              noteData,
              compositionState
            );
          }
        }
        // If we can't find the original, insert at the start of this measure
        beatPosition = 0;
      } else {
        // "after" a tied note - we need to insert after the tied note ends
        // The tied note takes up some beats in this measure
        let beats = this.durationToBeats(targetNote.duration || '4n', targetNote.dotted);
        beatPosition = beats; // Insert after the tied note's portion in this measure
      }
    } else {
      // Normal note - sum beats up to the insertion point
      const targetIndex = insertionPoint.action === 'before' ? insertionPoint.noteIndex : insertionPoint.noteIndex + 1;
      for (let i = 0; i < targetIndex && i < voice.notes.length; i++) {
        const note = voice.notes[i];
        let beats = this.durationToBeats(note.duration || '4n', note.dotted);
        beatPosition += beats;
      }
    }

    console.log('[SHIFT-INSERT] Calculated beatPosition:', beatPosition, 'hasMultipleVoices:', hasMultipleVoices);

    // MULTI-VOICE: Use extract → insert → rebuild (NO SYNC algorithm)
    if (hasMultipleVoices) {
      // Calculate note duration in beats
      let durationBeats = this.durationToBeats(noteData.duration || '4n', noteData.dotted);

      console.log('[SHIFT-INSERT] MULTI-VOICE path: using extract→rebuild algorithm');
      console.log('[SHIFT-INSERT] Inserting at measure', measureIndex, 'beat', beatPosition, 'duration', durationBeats);

      // 1. Extract all notes from insertion point onward (this also removes them)
      const logicalNotes = this.extractLogicalNotes('treble', voiceIndex, measureIndex, beatPosition, compositionState, beatsPerMeasure);

      // 2. Create the new note as a logical note
      const newLogical = {
        pitches: noteData.pitches || [noteData.pitch],
        totalDuration: durationBeats,
        tiedForward: false,
        attributes: {
          articulation: noteData.articulation,
          accidental: noteData.accidental,
          dynamic: noteData.dynamic,
          velocity: noteData.velocity,
          isRest: noteData.isRest || false,
        }
      };

      // 3. Rebuild: new note first, then all extracted notes
      this.rebuildNotesAfterShift('treble', voiceIndex, measureIndex, beatPosition, [newLogical, ...logicalNotes], compositionState, beatsPerMeasure);

      // CRITICAL: Mark measures as manually edited to prevent overwrite from stale block sequence
      compositionState._measuresManuallyEdited = true;

      // Render the changes
      this.composerIntegration.render();

      // CRITICAL: Trigger toolbar update for the (now changed) selected note
      if (this.selectedNotes.size > 0) {
        setTimeout(() => {
          this.onNoteSelect(Array.from(this.selectedNotes));
        }, 50);
      }
      return;
    }

    // SINGLE-VOICE: Also use extract → rebuild for consistency (NO SYNC)
    const singleNoteDur = noteData.duration || '4n';
    let durationBeats = this.durationToBeats(singleNoteDur, noteData.dotted);

    console.log('[SHIFT-INSERT] SINGLE-VOICE path: using extract→rebuild algorithm');
    console.log('[SHIFT-INSERT] Inserting at measure', measureIndex, 'beat', beatPosition, 'duration', durationBeats);

    // 1. Extract all notes from insertion point onward (this also removes them)
    const logicalNotes = this.extractLogicalNotes('treble', voiceIndex, measureIndex, beatPosition, compositionState, beatsPerMeasure);

    // 2. Create the new note as a logical note
    const newLogical = {
      pitches: noteData.pitches || [noteData.pitch],
      totalDuration: durationBeats,
      tiedForward: false,
      attributes: {
        articulation: noteData.articulation,
        accidental: noteData.accidental,
        dynamic: noteData.dynamic,
        velocity: noteData.velocity,
        isRest: noteData.isRest || false,
      }
    };

    // 3. Rebuild: new note first, then all extracted notes
    this.rebuildNotesAfterShift('treble', voiceIndex, measureIndex, beatPosition, [newLogical, ...logicalNotes], compositionState, beatsPerMeasure);

    // CRITICAL: Mark measures as manually edited to prevent overwrite from stale block sequence
    compositionState._measuresManuallyEdited = true;

    // Render the changes
    this.composerIntegration.render();

    // CRITICAL: Trigger toolbar update for the (now changed) selected note
    // The selection ID still points to the same index, but that index now contains the NEW note
    // So we need to re-call onNoteSelect to refresh the toolbar with the new note's properties
    if (this.selectedNotes.size > 0) {
      setTimeout(() => {
        this.onNoteSelect(Array.from(this.selectedNotes));
      }, 50);
    }
  }

  /**
   * Insert a treble note with shift at the end of a measure
   * @param {number} measureIndex - Target measure index
   * @param {Object} noteData - Note data to insert
   * @param {Object} compositionState - CompositionState instance
   */
  insertTrebleNoteWithShiftAtEnd(measureIndex, noteData, compositionState) {
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);

    // Calculate the beat position (end of used beats in measure)
    const usedBeats = this.getMeasureBeatsUsed(measureIndex, 'treble');
    const voiceIndex = this.getVoiceIndexForStaff('treble');

    // Calculate note duration in beats
    let durationBeats = this.durationToBeats(noteData.duration || '4n', noteData.dotted);

    console.log('[SHIFT-INSERT-END] Using extract→rebuild algorithm');
    console.log('[SHIFT-INSERT-END] Inserting at measure', measureIndex, 'beat', usedBeats, 'duration', durationBeats);

    // 1. Extract all notes from insertion point onward (this also removes them)
    const logicalNotes = this.extractLogicalNotes('treble', voiceIndex, measureIndex, usedBeats, compositionState, beatsPerMeasure);

    // 2. Create the new note as a logical note
    const newLogical = {
      pitches: noteData.pitches || [noteData.pitch],
      totalDuration: durationBeats,
      tiedForward: false,
      attributes: {
        articulation: noteData.articulation,
        accidental: noteData.accidental,
        dynamic: noteData.dynamic,
        velocity: noteData.velocity,
        isRest: noteData.isRest || false,
      }
    };

    // 3. Rebuild: new note first, then all extracted notes
    this.rebuildNotesAfterShift('treble', voiceIndex, measureIndex, usedBeats, [newLogical, ...logicalNotes], compositionState, beatsPerMeasure);

    // CRITICAL: Mark measures as manually edited to prevent overwrite from stale block sequence
    compositionState._measuresManuallyEdited = true;

    // Render the changes
    this.composerIntegration.render();

    // CRITICAL: Trigger toolbar update for the (now changed) selected note
    if (this.selectedNotes.size > 0) {
      setTimeout(() => {
        this.onNoteSelect(Array.from(this.selectedNotes));
      }, 50);
    }
  }

  /**
   * Insert a bass note with shift at a specific position
   *
   * NEW ARCHITECTURE (Phase 1 of Bass Block Isolation):
   * This now delegates to compositionState.insertBassNoteWithShift() which operates
   * on the bassBlockSequence blocks directly. Each chord's block is ISOLATED - shift
   * operations cannot push notes into adjacent chord blocks.
   *
   * @param {number} measureIndex - Target measure index
   * @param {Object} insertionPoint - { action, noteIndex, voiceIndex }
   * @param {Object} noteData - Note data to insert
   * @param {Object} compositionState - CompositionState instance
   * @param {number} beatsPerMeasure - Beats per measure from time signature
   */
  insertBassNoteWithShiftAtPosition(measureIndex, insertionPoint, noteData, compositionState, beatsPerMeasure) {
    const measure = compositionState.measures[measureIndex];
    if (!measure) {
      console.warn('[NoteEditor] Could not find measure for bass insert with shift');
      return;
    }

    const voiceIndex = insertionPoint.voiceIndex ?? this.getVoiceIndexForStaff('bass');

    // Ensure voice exists
    if (!measure.notation?.bass?.voices) {
      measure.notation = measure.notation || {};
      measure.notation.bass = measure.notation.bass || {};
      measure.notation.bass.voices = [{ notes: [] }];
    }
    while (measure.notation.bass.voices.length <= voiceIndex) {
      measure.notation.bass.voices.push({ notes: [] });
    }
    const voice = measure.notation.bass.voices[voiceIndex];

    // Calculate beat position for insertion (relative to measure start)
    let beatPositionInMeasure = 0;
    const targetIndex = insertionPoint.action === 'before' ? insertionPoint.noteIndex : insertionPoint.noteIndex + 1;
    for (let i = 0; i < targetIndex && i < voice.notes.length; i++) {
      const note = voice.notes[i];
      let beats = this.durationToBeats(note.duration || '4n', note.dotted);
      beatPositionInMeasure += beats;
    }

    // Calculate absolute beat position
    const absoluteBeat = measureIndex * beatsPerMeasure + beatPositionInMeasure;

    // Get the bass block for this position
    const blockInfo = compositionState.getBassBlockForBeat(absoluteBeat);
    if (!blockInfo) {
      console.warn('[NoteEditor] Could not find bass block for beat:', absoluteBeat);
      // Fall back to legacy behavior (no block isolation)
      this._legacyInsertBassNoteWithShift(measureIndex, insertionPoint, noteData, compositionState, beatsPerMeasure, voice, beatPositionInMeasure);
      return;
    }

    // Use BLOCK-ISOLATED extract→rebuild approach
    // This is the same proven pattern used for treble, but constrained to a single chord block
    console.log('[SHIFT-INSERT-BASS] Using BLOCK-ISOLATED extract→rebuild approach');
    console.log(`[SHIFT-INSERT-BASS] Block ${blockInfo.chordIndex}, blockStartBeat=${blockInfo.blockStartBeat}, blockBeats=${blockInfo.block.beats}`);

    const blockStartBeat = blockInfo.blockStartBeat;
    const blockEndBeat = blockStartBeat + blockInfo.block.beats;
    const insertBeatInBlock = absoluteBeat - blockStartBeat;
    const durationBeats = this.durationToBeats(noteData.duration || '4n', noteData.dotted);

    console.log(`[SHIFT-INSERT-BASS] Insert at beat ${insertBeatInBlock} within block [0, ${blockInfo.block.beats})`);

    // Step 1: Extract notes from this block only (from insertion point to block end)
    const logicalNotes = this._extractLogicalNotesFromBlock(
      'bass', voiceIndex, compositionState, beatsPerMeasure,
      blockStartBeat, blockEndBeat, absoluteBeat
    );
    console.log(`[SHIFT-INSERT-BASS] Extracted ${logicalNotes.length} logical notes from block`);

    // Step 2: Create the new note as a logical note
    const newLogical = {
      pitches: noteData.pitches || [noteData.pitch],
      totalDuration: durationBeats,
      tiedForward: false,
      attributes: {
        articulation: noteData.articulation,
        accidental: noteData.accidental,
        dynamic: noteData.dynamic,
        velocity: noteData.velocity,
        isRest: noteData.isRest || false,
      }
    };

    // Step 3: Rebuild within block boundaries only
    // The key difference: truncate notes that would overflow the block boundary
    this._rebuildNotesInBlock(
      'bass', voiceIndex, compositionState, beatsPerMeasure,
      blockStartBeat, blockEndBeat, absoluteBeat,
      [newLogical, ...logicalNotes]
    );

    // Mark bass as edited and save for affected measures
    const startMeasure = Math.floor(blockStartBeat / beatsPerMeasure);
    const endMeasure = Math.floor((blockEndBeat - 0.001) / beatsPerMeasure);
    for (let m = startMeasure; m <= endMeasure && m < compositionState.measures.length; m++) {
      if (compositionState.measures[m]?.notation?.bass) {
        compositionState.measures[m].notation.bass.autoGenerated = false;
        compositionState.saveEditedBassNotesForMeasure(m);
      }
    }

    // Sync measures back to bass block sequence
    compositionState.syncMeasuresToBuildingBlocks();

    // Render the changes
    this.composerIntegration.render();

    // CRITICAL: Trigger toolbar update for the (now changed) selected note
    // The selection ID still points to the same index, but that index now contains the NEW note
    // So we need to re-call onNoteSelect to refresh the toolbar with the new note's properties
    if (this.selectedNotes.size > 0) {
      setTimeout(() => {
        this.onNoteSelect(Array.from(this.selectedNotes));
      }, 50);
    }
  }

  /**
   * Extract logical notes from a specific block range only
   * Used for block-isolated bass shift operations
   * @private
   */
  _extractLogicalNotesFromBlock(clef, voiceIndex, compositionState, beatsPerMeasure, blockStartBeat, blockEndBeat, fromAbsoluteBeat) {
    console.log('[_extractLogicalNotesFromBlock] Extracting from block:', { blockStartBeat, blockEndBeat, fromAbsoluteBeat });
    const logicalNotes = [];

    // Determine which measures contain this block
    const startMeasure = Math.floor(blockStartBeat / beatsPerMeasure);
    const endMeasure = Math.floor((blockEndBeat - 0.001) / beatsPerMeasure);

    for (let m = startMeasure; m <= endMeasure && m < compositionState.measures.length; m++) {
      const measure = compositionState.measures[m];
      if (!measure) continue;

      const voices = clef === 'treble'
        ? measure.notation?.treble?.voices
        : measure.notation?.bass?.voices;

      if (!voices || !voices[voiceIndex]) continue;

      const voice = voices[voiceIndex];
      if (!voice.notes) continue;

      const measureStartBeat = m * beatsPerMeasure;
      const notesToRemove = [];

      for (const note of voice.notes) {
        const noteBeatInMeasure = note.beat || 0;
        const absoluteNoteBeat = measureStartBeat + noteBeatInMeasure;

        // Skip notes outside this block
        if (absoluteNoteBeat < blockStartBeat || absoluteNoteBeat >= blockEndBeat) continue;

        // Skip notes before the extraction point
        if (absoluteNoteBeat < fromAbsoluteBeat) continue;

        // Mark for removal
        notesToRemove.push(note);

        const durationBeats = this.durationToBeats(note.duration || '4n', note.dotted);

        if (note.isTied && logicalNotes.length > 0) {
          // Continuation of previous note
          const lastLogical = logicalNotes[logicalNotes.length - 1];
          lastLogical.totalDuration += durationBeats;
          if (note.tied) lastLogical.tiedForward = true;
        } else {
          // New logical note
          logicalNotes.push({
            pitches: note.pitches || [note.pitch],
            totalDuration: durationBeats,
            tiedForward: note.tied || false,
            attributes: {
              articulation: note.articulation,
              accidental: note.accidental,
              dynamic: note.dynamic,
              velocity: note.velocity,
              isRest: note.isRest || note.type === 'rest',
            }
          });
        }
      }

      // Remove extracted notes
      voice.notes = voice.notes.filter(n => !notesToRemove.includes(n));
    }

    console.log('[_extractLogicalNotesFromBlock] Extracted:', logicalNotes.map(n => ({
      pitches: n.pitches,
      duration: n.totalDuration
    })));

    return logicalNotes;
  }

  /**
   * Rebuild notes within a specific block range only
   * Notes that would overflow the block boundary are TRUNCATED
   * @private
   */
  _rebuildNotesInBlock(clef, voiceIndex, compositionState, beatsPerMeasure, blockStartBeat, blockEndBeat, startAbsoluteBeat, logicalNotes) {
    console.log('[_rebuildNotesInBlock] Rebuilding in block:', { blockStartBeat, blockEndBeat, startAbsoluteBeat, noteCount: logicalNotes.length });

    let currentAbsoluteBeat = startAbsoluteBeat;
    const blockDuration = blockEndBeat - blockStartBeat;

    for (const logicalNote of logicalNotes) {
      // Calculate how much of this note fits in the remaining block space
      const beatInBlock = currentAbsoluteBeat - blockStartBeat;
      const remainingBlockSpace = blockDuration - beatInBlock;

      if (remainingBlockSpace <= 0) {
        // No more room in block - truncate remaining notes
        console.log('[_rebuildNotesInBlock] Block full, truncating remaining notes');
        break;
      }

      // Truncate note duration if it would overflow
      let noteBeats = logicalNote.totalDuration;
      let wasTruncated = false;
      if (noteBeats > remainingBlockSpace) {
        console.log(`[_rebuildNotesInBlock] Truncating note from ${noteBeats} to ${remainingBlockSpace} beats`);
        noteBeats = remainingBlockSpace;
        wasTruncated = true;
      }

      // Place note across measures as needed (within block)
      let remainingBeats = noteBeats;
      let isFirstPart = true;

      while (remainingBeats > 0 && currentAbsoluteBeat < blockEndBeat) {
        const currentMeasure = Math.floor(currentAbsoluteBeat / beatsPerMeasure);
        const beatInMeasure = currentAbsoluteBeat - (currentMeasure * beatsPerMeasure);
        const beatsLeftInMeasure = beatsPerMeasure - beatInMeasure;

        // Don't exceed block boundary
        const beatsToBlockEnd = blockEndBeat - currentAbsoluteBeat;
        const beatsToPlace = Math.min(remainingBeats, beatsLeftInMeasure, beatsToBlockEnd);
        const isLastPart = (remainingBeats <= beatsToPlace) && !wasTruncated;

        // Get or create measure
        while (currentMeasure >= compositionState.measures.length) {
          compositionState.addMeasure({});
        }

        const measure = compositionState.measures[currentMeasure];
        const voices = clef === 'treble'
          ? measure.notation?.treble?.voices
          : measure.notation?.bass?.voices;

        if (!voices) break;

        while (voices.length <= voiceIndex) {
          voices.push({ notes: [] });
        }
        const voice = voices[voiceIndex];

        // Create the note
        const { duration: noteDuration, dotted: noteDotted } = beatsToDuration(beatsToPlace);
        const measureNote = {
          type: logicalNote.attributes.isRest ? 'rest' : 'note',
          pitches: logicalNote.pitches,
          duration: noteDuration,
          dotted: noteDotted,
          beat: beatInMeasure,
          isTied: !isFirstPart,
          tied: !isLastPart || (remainingBeats > beatsToPlace),
          isRest: logicalNote.attributes.isRest || false,
        };

        // Add attributes on first part only
        if (isFirstPart) {
          if (logicalNote.attributes.articulation) measureNote.articulation = logicalNote.attributes.articulation;
          if (logicalNote.attributes.accidental) measureNote.accidental = logicalNote.attributes.accidental;
          if (logicalNote.attributes.dynamic) measureNote.dynamic = logicalNote.attributes.dynamic;
          if (logicalNote.attributes.velocity !== undefined) measureNote.velocity = logicalNote.attributes.velocity;
        }

        console.log('[_rebuildNotesInBlock] Created note:', {
          measure: currentMeasure,
          beat: beatInMeasure,
          duration: noteDuration,
          dotted: noteDotted,
          beatsPlaced: beatsToPlace
        });

        voice.notes.push(measureNote);
        voice.notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));

        currentAbsoluteBeat += beatsToPlace;
        remainingBeats -= beatsToPlace;
        isFirstPart = false;
      }
    }

    console.log('[_rebuildNotesInBlock] Rebuild complete');
  }

  /**
   * Legacy fallback for bass insert when block sequence isn't available
   * @private
   */
  _legacyInsertBassNoteWithShift(measureIndex, insertionPoint, noteData, compositionState, beatsPerMeasure, voice, beatPosition) {
    console.log('[SHIFT-INSERT-BASS] Using LEGACY extract→rebuild algorithm');
    console.log('[SHIFT-INSERT-BASS] Inserting at measure', measureIndex, 'beat', beatPosition);

    const voiceIndex = insertionPoint.voiceIndex ?? this.getVoiceIndexForStaff('bass');
    let durationBeats = this.durationToBeats(noteData.duration || '4n', noteData.dotted);

    // 1. Extract all notes from insertion point onward (this also removes them)
    const logicalNotes = this.extractLogicalNotes('bass', voiceIndex, measureIndex, beatPosition, compositionState, beatsPerMeasure);

    // 2. Create the new note as a logical note
    const newLogical = {
      pitches: noteData.pitches || [noteData.pitch],
      totalDuration: durationBeats,
      tiedForward: false,
      attributes: {
        articulation: noteData.articulation,
        accidental: noteData.accidental,
        dynamic: noteData.dynamic,
        velocity: noteData.velocity,
        isRest: noteData.isRest || false,
      }
    };

    // 3. Rebuild: new note first, then all extracted notes
    this.rebuildNotesAfterShift('bass', voiceIndex, measureIndex, beatPosition, [newLogical, ...logicalNotes], compositionState, beatsPerMeasure);

    // Mark bass as edited and save
    const measure = compositionState.measures[measureIndex];
    measure.notation.bass.autoGenerated = false;
    compositionState.saveEditedBassNotesForMeasure(measureIndex);

    // Render the changes
    this.composerIntegration.render();

    // CRITICAL: Trigger toolbar update for the (now changed) selected note
    if (this.selectedNotes.size > 0) {
      setTimeout(() => {
        this.onNoteSelect(Array.from(this.selectedNotes));
      }, 50);
    }
  }

  /**
   * Auto-advance measure selection to next measure
   * @param {number} currentMeasureIndex - Current measure index
   */
  autoAdvanceMeasure(currentMeasureIndex) {
    if (!this.composerIntegration) return;

    const nextMeasureIndex = currentMeasureIndex + 1;

    // Check if next measure exists
    const measureCount = this.composerIntegration.compositionState?.getMeasureCount() || 0;

    if (nextMeasureIndex < measureCount) {
      this.composerIntegration.setSelectedMeasure(nextMeasureIndex);
    }
  }

  // ============================================================================
  // NOTE MODIFICATION (Move, Delete, Transpose)
  // ============================================================================

  /**
   * Move selected notes by a number of steps
   * @param {number} steps - Number of steps (positive = up, negative = down)
   */
  moveSelectedNotes(steps) {
    // Save state for undo before making changes
    if (this.selectedNotes.size > 0 && typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    const moves = [];

    for (const noteId of this.selectedNotes) {
      // Parse note ID to get location (supports pitch-specific IDs with 5 parts)
      const [measureIndex, staff, voiceIndex, noteIndex, pitchIndex] = this.parseNoteId(noteId);

      // Get current pitch and calculate new pitch
      // This would need access to the actual note data
      // For now, emit the move event with step info

      moves.push({
        noteId,
        measureIndex,
        staff,
        voiceIndex,
        noteIndex,
        pitchIndex, // Include pitch index for individual note transposition in chords
        steps,
      });
    }


    if (moves.length > 0) {
      this.onNoteMove(moves);
    }
  }

  /**
   * Delete selected notes (supports individual pitch deletion from chords)
   * @param {boolean} shiftDelete - If true, shift subsequent notes left instead of replacing with rests
   */
  deleteSelectedNotes(shiftDelete = false) {
    // Only save state if there are notes to delete
    if (this.selectedNotes.size > 0 && typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    const fullDeletions = [];
    const pitchDeletions = [];

    const compositionState = window.getCompositionState?.();
    const beatsPerMeasure = compositionState ?
      getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature) : 4;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex, pitchIndex] = this.parseNoteId(noteId);

      if (pitchIndex !== null) {
        // Pitch-specific deletion from chord
        pitchDeletions.push({ measureIndex, staff, voiceIndex, noteIndex, pitchIndex, noteId });
      } else {
        // Full note deletion
        const deletion = { measureIndex, staff, voiceIndex, noteIndex, shiftDelete };

        // For auto-generated rests (noteIndex === -1), include beat/duration from stored info
        if (noteIndex === -1 && this.autoGeneratedRestInfo?.has(noteId)) {
          const restInfo = this.autoGeneratedRestInfo.get(noteId);
          deletion.beat = restInfo.beat;
          deletion.duration = restInfo.duration;
          deletion.isAutoGenerated = true;
        } else if (compositionState) {
          // Get beat info for proper sorting in shift-delete mode
          const measure = compositionState.measures[measureIndex];
          const voiceKey = staff === 'treble' ? 'treble' : 'bass';
          const notes = measure?.notation?.[voiceKey]?.voices?.[voiceIndex]?.notes;
          if (notes && noteIndex < notes.length) {
            deletion.beat = notes[noteIndex].beat || 0;
            deletion.duration = notes[noteIndex].duration || '4n';
          }
        }

        // Calculate absolute beat for proper sorting
        deletion.absoluteBeat = measureIndex * beatsPerMeasure + (deletion.beat || 0);
        fullDeletions.push(deletion);
      }
    }

    // Handle pitch deletions first (remove individual pitches from chords)
    if (pitchDeletions.length > 0) {
      this.deletePitchesFromChords(pitchDeletions);
    }

    if (shiftDelete) {
      // For shift delete, sort by absolute beat ASCENDING (earliest first)
      // and calculate total beats to shift, then do one combined shift
      fullDeletions.sort((a, b) => a.absoluteBeat - b.absoluteBeat);

      // Group deletions by staff and voice for combined processing
      const groupedDeletions = new Map();
      for (const deletion of fullDeletions) {
        const key = `${deletion.staff}-${deletion.voiceIndex}`;
        if (!groupedDeletions.has(key)) {
          groupedDeletions.set(key, []);
        }
        groupedDeletions.get(key).push(deletion);
      }

      // Process each staff/voice group
      for (const [key, deletions] of groupedDeletions) {
        // Mark as batch operation - only the first one triggers the shift
        // The shift will handle all deletions in this group
        if (deletions.length > 0) {
          const firstDeletion = deletions[0];
          firstDeletion.batchDeletions = deletions;
          this.onNoteDelete(firstDeletion);
        }
      }
    } else {
      // For normal delete (replace with rest), sort by noteIndex descending
      // so we delete from end first (indices don't shift when replacing with rest)
      fullDeletions.sort((a, b) => b.noteIndex - a.noteIndex);

      for (const deletion of fullDeletions) {
        this.onNoteDelete(deletion);
      }
    }

    this.clearSelection();
  }

  /**
   * Delete individual pitches from chords
   * @param {Array} pitchDeletions - Array of {measureIndex, staff, noteIndex, pitchIndex}
   */
  deletePitchesFromChords(pitchDeletions) {
    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    // Group by note (multiple pitches might be deleted from same chord)
    const byNote = {};
    for (const pd of pitchDeletions) {
      const key = `${pd.measureIndex}-${pd.staff}-${pd.noteIndex}`;
      if (!byNote[key]) {
        byNote[key] = { ...pd, pitchIndices: [] };
      }
      byNote[key].pitchIndices.push(pd.pitchIndex);
    }

    let changedCount = 0;

    for (const key of Object.keys(byNote)) {
      const { measureIndex, staff, voiceIndex, noteIndex, pitchIndices } = byNote[key];

      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      // MULTI-VOICE: Use the voice from the deletion, not the currently selected voice
      const voiceKey = staff === 'treble' ? 'treble' : 'bass';
      const voice = measure.notation?.[voiceKey]?.voices?.[voiceIndex];
      if (!voice || !voice.notes[noteIndex]) continue;

      const note = voice.notes[noteIndex];
      if (!note.pitches || note.pitches.length <= 1) {
        // Single pitch note - delete the whole note instead
        this.onNoteDelete({ measureIndex, staff, voiceIndex, noteIndex });
        continue;
      }

      // Sort pitch indices descending to remove from end first
      pitchIndices.sort((a, b) => b - a);

      for (const pitchIdx of pitchIndices) {
        if (pitchIdx >= 0 && pitchIdx < note.pitches.length) {
          note.pitches.splice(pitchIdx, 1);
          changedCount++;
        }
      }

      // If all pitches removed, delete the note
      if (note.pitches.length === 0) {
        this.onNoteDelete({ measureIndex, staff, voiceIndex, noteIndex });
      } else {
        // Update the primary pitch to first remaining pitch
        note.pitch = note.pitches[0];
      }
    }

    if (changedCount > 0) {
      // Sync treble changes to block sequence
      if (compositionState.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
      }

      // Sync bass changes to block sequence (preserves edits for duplication)
      if (compositionState.bassBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToBuildingBlocks();
      }

      this.composerIntegration.render(true);
    }
  }

  /**
   * Transpose selected notes by specified semitones
   * @param {number} semitones - Number of semitones to transpose (positive = up, negative = down)
   */
  transposeSelection(semitones) {
    if (this.selectedNotes.size === 0 || semitones === 0) return;

    // Save state before change for undo
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    // Note names for transposition
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

    // Helper to transpose a single pitch string (e.g., "C4" -> "D4" for +2 semitones)
    const transposePitch = (pitch) => {
      const match = pitch.match(/^([A-G][#b]?)(\d+)$/);
      if (!match) return pitch;

      const [, noteName, octaveStr] = match;
      let octave = parseInt(octaveStr, 10);

      // Convert note name to semitone index (0-11)
      let noteIndex = noteNames.indexOf(noteName);
      if (noteIndex === -1) {
        // Try flat names
        noteIndex = flatNames.indexOf(noteName);
      }
      if (noteIndex === -1) return pitch;

      // Add semitones
      let newIndex = noteIndex + semitones;

      // Handle octave changes
      while (newIndex >= 12) {
        newIndex -= 12;
        octave++;
      }
      while (newIndex < 0) {
        newIndex += 12;
        octave--;
      }

      // Clamp octave to reasonable range
      octave = Math.max(0, Math.min(8, octave));

      // Use key-based enharmonic preference to determine sharp or flat spelling
      const enharmonicPref = getEnharmonicPreferenceForKey(getCurrentKey());
      const newNoteName = (enharmonicPref === 'flat' ? flatNames : noteNames)[newIndex];
      return `${newNoteName}${octave}`;
    };

    let changedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex, pitchIndex] = this.parseNoteId(noteId);

      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      const voiceKey = staff === 'treble' ? 'treble' : 'bass';
      const voice = measure.notation?.[voiceKey]?.voices?.[voiceIndex];
      if (!voice || !voice.notes[noteIndex]) continue;

      const note = voice.notes[noteIndex];
      if (note.isRest) continue; // Skip rests

      // If pitchIndex is specified, only transpose that pitch
      if (pitchIndex !== null && note.pitches) {
        if (pitchIndex >= 0 && pitchIndex < note.pitches.length) {
          note.pitches[pitchIndex] = transposePitch(note.pitches[pitchIndex]);
          changedCount++;
        }
      } else {
        // Transpose all pitches in the note
        if (note.pitches && note.pitches.length > 0) {
          note.pitches = note.pitches.map(p => transposePitch(p));
          changedCount++;
        }
        // Also transpose the primary pitch if it exists
        if (note.pitch) {
          note.pitch = transposePitch(note.pitch);
          changedCount++;
        }
      }
    }

    if (changedCount > 0) {
      // Mark as dirty for auto-save
      if (typeof window.markAutoSaveDirty === 'function') {
        window.markAutoSaveDirty();
      }

      // Sync changes to block sequences
      if (compositionState.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
      }
      if (compositionState.bassBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToBuildingBlocks();
      }

      // Re-render
      this.composerIntegration.render(true);
    }
  }

  /**
   * Play selected notes with audio playback
   */
  playSelectedNotes() {
    const piano = getPiano();
    if (!piano) {
      return;
    }

    // Get note data for all selected notes
    const notesToPlay = [];
    for (const noteId of this.selectedNotes) {
      // Handle both regular note IDs (3/4-part legacy) and new IDs (4/5-part with voiceIndex)
      const baseNoteId = this.getBaseNoteId(noteId);
      const region = this.noteRegions.find(r => {
        const regionId = this.createNoteId(r.measureIndex, r.staff, r.voiceIndex || 0, r.noteIndex);
        return regionId === baseNoteId;
      });

      if (region && !region.isRest) {
        // Handle chords (multiple pitches) or single notes
        const pitches = region.pitches || (region.pitch ? [region.pitch] : []);
        const duration = region.duration || '4n';

        notesToPlay.push({
          pitches,
          duration,
          measureIndex: region.measureIndex,
        });
      }
    }

    if (notesToPlay.length === 0) {
      return;
    }

    // Sort by measure index to play in order
    notesToPlay.sort((a, b) => a.measureIndex - b.measureIndex);

    // Play notes sequentially with Tone.js Transport
    const now = window.Tone.now();
    let currentTime = now;

    notesToPlay.forEach((note) => {
      // Play each pitch in the chord simultaneously
      note.pitches.forEach((pitch) => {
        piano.triggerAttackRelease(pitch, note.duration, currentTime);
      });

      // Advance time for next note (convert duration to seconds)
      const durationSeconds = window.Tone.Time(note.duration).toSeconds();
      currentTime += durationSeconds;
    });
  }

  // ============================================================================
  // SHIFT INSERT/DELETE OPERATIONS
  // ============================================================================

  /**
   * Insert a note before the first selected note
   */
  insertNoteBeforeSelected() {
    console.log('[SHIFT-INSERT] insertNoteBeforeSelected called, selectedNotes:', Array.from(this.selectedNotes));

    if (this.selectedNotes.size === 0) {
      console.warn('[NoteEditor] No notes selected for insert before');
      return;
    }

    // Save state for undo BEFORE making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    // Get the first selected note
    const firstNoteId = Array.from(this.selectedNotes)[0];
    console.log('[SHIFT-INSERT] First note ID:', firstNoteId);
    const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(firstNoteId);
    console.log('[SHIFT-INSERT] Parsed: measureIndex=', measureIndex, 'staff=', staff, 'voiceIndex=', voiceIndex, 'noteIndex=', noteIndex);

    // Get beats per measure from time signature
    const compositionStateCheck = window.getCompositionState?.();
    const ts = compositionStateCheck?.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE;
    const beatsPerMeasure = ts.num * (4 / ts.denom); // e.g., 6/8 = 3, 4/4 = 4

    // Check if the selected note is a tied continuation
    if (compositionStateCheck) {
      const measureCheck = compositionStateCheck.measures[measureIndex];
      const voiceCheck = staff === 'treble' ? measureCheck?.notation?.treble?.voices?.[0] : measureCheck?.notation?.bass?.voices?.[0];
      const targetNote = voiceCheck?.notes?.[noteIndex];

      if (targetNote && targetNote.isTied) {
        // This is a tied continuation - inform the user and handle specially
        // For tied notes, the "before" insertion will be handled by insertTrebleNoteWithShiftAtPosition
        // which redirects to the original note in the previous measure
      }
    }

    // SIMPLIFICATION: Always insert a quarter note (1 beat)
    // User can change duration afterward if needed - this eliminates toolbar sync confusion
    console.log('[SHIFT-INSERT-BEFORE] Inserting quarter note (default)');
    const noteData = {
      pitch: 'C4', // Default pitch, user can change it
      pitches: ['C4'],
      duration: '4n', // Always quarter note
      dotted: false,
      isRest: false,
      accidental: null,
      articulation: null,
    };


    const compositionState = window.getCompositionState?.();
    if (!compositionState || !compositionState.measures[measureIndex]) {
      console.warn('[NoteEditor] ❌ Could not access compositionState');
      return;
    }

    const measure = compositionState.measures[measureIndex];
    const voice = this.getVoice(measure, staff);

    // Calculate current beats used in measure
    let usedBeats = 0;
    for (const note of voice.notes) {
      let beats = this.durationToBeats(note.duration || '4n', note.dotted);
      // Account for tuplet notes (e.g., triplet quarter notes take 0.667 beats, not 1)
      if (note.tuplet && note.tuplet.type && TUPLET_RATIOS[note.tuplet.type]) {
        const ratio = TUPLET_RATIOS[note.tuplet.type];
        beats = beats * (ratio.normal / ratio.actual);
      }
      usedBeats += beats;
    }

    const maxBeats = beatsPerMeasure; // Use time signature
    // Calculate requested beats, accounting for tuplet insert mode
    let requestedBeats = this.durationToBeats(this.currentDuration, this.isDotted);
    if (this.tupletInsertMode && TUPLET_RATIOS[this.tupletInsertMode]) {
      const ratio = TUPLET_RATIOS[this.tupletInsertMode];
      requestedBeats = requestedBeats * (ratio.normal / ratio.actual);
    }
    const availableBeats = maxBeats - usedBeats;
    console.log('[SHIFT-INSERT] Overflow check: usedBeats=', usedBeats, 'requestedBeats=', requestedBeats, 'availableBeats=', availableBeats);

    // Shift+Arrow should ALWAYS shift downstream notes
    // Only show dialog if there would be overflow (notes pushed past measure end)
    const wouldOverflow = (usedBeats + requestedBeats) > maxBeats;
    console.log('[SHIFT-INSERT] wouldOverflow=', wouldOverflow);

    if (wouldOverflow) {
      const overflowBeats = (usedBeats + requestedBeats) - maxBeats;
      console.log('[SHIFT-INSERT] Overflow detected! Showing dialog. overflowBeats=', overflowBeats);

      showNoteOverflowDialog({
        overflowBeats,
        noteDuration: this.currentDuration,
        bassBlockIsolated: staff === 'bass', // Bass clef only gets truncate option (block-isolated)
        onChoice: (choice) => {
          console.log('[SHIFT-INSERT] insertNoteBeforeSelected dialog choice:', choice);
          if (choice === null) {
            return;
          }

          if (choice === 'truncate') {
            console.log('[SHIFT-INSERT] Taking TRUNCATE path, staff=', staff);

            // For bass clef with block isolation, "truncate" means:
            // Insert the new note and shift existing notes, truncating any that overflow the block boundary
            // This is the SAME as "shift" but with the understanding that overflow is expected and accepted
            if (staff === 'bass') {
              console.log('[SHIFT-INSERT] Bass truncate - using block-isolated shift with truncation');
              // Use the same shift method - it will automatically truncate at block boundary
              this.insertBassNoteWithShiftAtPosition(
                measureIndex,
                { action: 'before', noteIndex, voiceIndex },
                noteData,
                compositionState,
                beatsPerMeasure
              );
              return;
            }

            // Treble clef: Original truncate behavior - insert and remove overflow
            // Calculate the beat position where we're inserting
            let insertBeat = 0;
            for (let i = 0; i < noteIndex; i++) {
              const dur = voice.notes[i].duration || '4n';
              const hasDot = dur.includes('.');
              let beats = this.durationToBeats(dur);
              if (voice.notes[i].dotted && !hasDot) beats *= 1.5;
              insertBeat += beats;
            }

              const maxBeats = beatsPerMeasure; // Use time signature
              const spaceAfterInsertPoint = maxBeats - insertBeat;

              if (spaceAfterInsertPoint <= 0) {
                console.warn('[NoteEditor] No space at insert position');
                return;
              }

              // Determine the duration for the new note (truncate if needed)
              let newNoteBeats = requestedBeats;
              if (newNoteBeats > spaceAfterInsertPoint) {
                newNoteBeats = spaceAfterInsertPoint;
              }
              const fitDuration = this.beatsToDuration(newNoteBeats);

              // Remove all notes from the insert position onward (they get truncated out)
              voice.notes.splice(noteIndex);

              // Add the new note
              const truncatedNote = {
                ...noteData,
                duration: fitDuration.duration,
                dotted: fitDuration.dotted,
                beat: insertBeat,
              };
              voice.notes.push(truncatedNote);

              // Recalculate beat positions
              this.recalculateBeatPositions(voice.notes);

              // Sync to treble block sequence if needed
              if (staff === 'treble' && compositionState.trebleBlockSequence?.blocks?.length > 0) {
                compositionState.syncMeasuresToTrebleBlock();
              }

              this.composerIntegration.render();
            } else if (choice === 'shift') {
              console.log('[SHIFT-INSERT] Taking SHIFT path, staff=', staff);
              // Shift: use appropriate method based on staff
              if (staff === 'treble') {
                console.log('[SHIFT-INSERT] Calling insertTrebleNoteWithShiftAtPosition');
                this.insertTrebleNoteWithShiftAtPosition(
                  measureIndex,
                  { action: 'before', noteIndex, voiceIndex },
                  noteData,
                  compositionState
                );
              } else {
                console.log('[SHIFT-INSERT] Calling insertBassNoteWithShiftAtPosition');
                // Bass clef: use shiftNotesForward approach
                this.insertBassNoteWithShiftAtPosition(
                  measureIndex,
                  { action: 'before', noteIndex, voiceIndex },
                  noteData,
                  compositionState,
                  beatsPerMeasure
                );
              }
            }
          },
        });
        return;
      }

    // No overflow - but Shift+Arrow should still shift downstream notes
    // Use the shift method directly
    console.log('[SHIFT-INSERT] No overflow - using shift insert at noteIndex=', noteIndex);
    if (staff === 'treble') {
      this.insertTrebleNoteWithShiftAtPosition(
        measureIndex,
        { action: 'before', noteIndex, voiceIndex },
        noteData,
        compositionState
      );
    } else {
      this.insertBassNoteWithShiftAtPosition(
        measureIndex,
        { action: 'before', noteIndex, voiceIndex },
        noteData,
        compositionState,
        beatsPerMeasure
      );
    }
  }

  /**
   * Insert a note after the last selected note
   */
  insertNoteAfterSelected() {
    if (this.selectedNotes.size === 0) return;

    // Save state for undo BEFORE making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    // Get the last selected note
    const noteIds = Array.from(this.selectedNotes);
    const lastNoteId = noteIds[noteIds.length - 1];
    const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(lastNoteId);

    // SIMPLIFICATION: Always insert a quarter note (1 beat)
    // User can change duration afterward if needed - this eliminates toolbar sync confusion
    console.log('[SHIFT-INSERT-AFTER] Inserting quarter note (default)');
    const noteData = {
      pitch: 'C4', // Default pitch, user can change it
      pitches: ['C4'],
      duration: '4n', // Always quarter note
      dotted: false,
      isRest: false,
      accidental: null,
      articulation: null,
    };

    const compositionState = window.getCompositionState?.();
    if (!compositionState || !compositionState.measures[measureIndex]) {
      console.warn('[NoteEditor] ❌ Could not access compositionState');
      return;
    }

    // Get beats per measure from time signature
    const ts = compositionState.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE;
    const beatsPerMeasure = ts.num * (4 / ts.denom); // e.g., 6/8 = 3, 4/4 = 4

    const measure = compositionState.measures[measureIndex];
    const voice = this.getVoice(measure, staff);

    // Check if the selected note is a tied continuation
    const targetNote = voice.notes?.[noteIndex];
    if (targetNote && targetNote.isTied) {
      // For tied notes, inserting "after" means after the tied portion ends in this measure
      // The insertTrebleNoteWithShiftAtPosition handles this correctly
    }

    // Calculate current beats used in measure
    let usedBeats = 0;
    for (const note of voice.notes) {
      let beats = this.durationToBeats(note.duration || '4n', note.dotted);
      // Account for tuplet notes (e.g., triplet quarter notes take 0.667 beats, not 1)
      if (note.tuplet && note.tuplet.type && TUPLET_RATIOS[note.tuplet.type]) {
        const ratio = TUPLET_RATIOS[note.tuplet.type];
        beats = beats * (ratio.normal / ratio.actual);
      }
      usedBeats += beats;
    }

    const maxBeats = beatsPerMeasure; // Use time signature
    // Calculate requested beats, accounting for tuplet insert mode
    let requestedBeats = this.durationToBeats(this.currentDuration, this.isDotted);
    if (this.tupletInsertMode && TUPLET_RATIOS[this.tupletInsertMode]) {
      const ratio = TUPLET_RATIOS[this.tupletInsertMode];
      requestedBeats = requestedBeats * (ratio.normal / ratio.actual);
    }
    const availableBeats = maxBeats - usedBeats;

    // Check if measure is already full and we're inserting after the last note
    // In this case, there's no space in THIS measure - inform user
    const isLastNote = noteIndex === voice.notes.length - 1;
    const measureIsFull = Math.abs(usedBeats - maxBeats) < 0.01;

    if (isLastNote && measureIsFull) {
      // The measure is completely full - inserting after the last note means the new note
      // would start in the next measure. This is confusing UX, so we block it.
      alert('This measure is already full. To add more notes, click in the next measure or delete/shorten existing notes.');
      return;
    }

    // Shift+Arrow should ALWAYS shift downstream notes
    // Only show dialog if there would be overflow (notes pushed past measure end)
    const wouldOverflow = (usedBeats + requestedBeats) > maxBeats;

    if (wouldOverflow) {
      const overflowBeats = (usedBeats + requestedBeats) - maxBeats;

      showNoteOverflowDialog({
        overflowBeats,
        noteDuration: this.currentDuration,
        bassBlockIsolated: staff === 'bass', // Bass clef only gets truncate option (block-isolated)
        onChoice: (choice) => {
          if (choice === null) {
            return;
          }

          if (choice === 'truncate') {
            console.log('[SHIFT-INSERT-AFTER] Taking TRUNCATE path, staff=', staff);
            // For bass clef with block isolation, "truncate" means:
            // Insert the new note and shift existing notes, truncating any that overflow the block boundary
            if (staff === 'bass') {
              console.log('[SHIFT-INSERT-AFTER] Bass truncate - using block-isolated shift with truncation');
              this.insertBassNoteWithShiftAtPosition(
                measureIndex,
                { action: 'after', noteIndex, voiceIndex },
                noteData,
                compositionState,
                beatsPerMeasure
              );
              return;
            }

            // Treble clef: Insert the note after the selected and remove any notes that overflow
            // Calculate the beat position after the selected note
            let insertBeat = 0;
            for (let i = 0; i <= noteIndex; i++) {
              const dur = voice.notes[i].duration || '4n';
              const hasDot = dur.includes('.');
              let beats = this.durationToBeats(dur);
              if (voice.notes[i].dotted && !hasDot) beats *= 1.5;
              insertBeat += beats;
            }

            const maxBeats = beatsPerMeasure; // Use time signature
            const spaceAfterInsertPoint = maxBeats - insertBeat;

            if (spaceAfterInsertPoint <= 0) {
              console.warn('[NoteEditor] No space at insert position');
              return;
            }

            // Determine the duration for the new note (truncate if needed)
            let newNoteBeats = requestedBeats;
            if (newNoteBeats > spaceAfterInsertPoint) {
              newNoteBeats = spaceAfterInsertPoint;
            }
            const fitDuration = this.beatsToDuration(newNoteBeats);

            // Calculate which notes need to be removed to make room for the new note
            // Only remove notes that would overlap with the new note's duration
            const insertPosition = noteIndex + 1;
            const newNoteEndBeat = insertBeat + newNoteBeats;

            // Find which notes to keep after the new note
            let currentBeat = insertBeat;
            let notesToRemove = 0;
            for (let i = insertPosition; i < voice.notes.length; i++) {
              const dur = voice.notes[i].duration || '4n';
              const hasDot = dur.includes('.');
              let noteBeats = this.durationToBeats(dur);
              if (voice.notes[i].dotted && !hasDot) noteBeats *= 1.5;

              // If this note starts before the new note would end, it needs to be removed
              if (currentBeat < newNoteEndBeat) {
                notesToRemove++;
                currentBeat += noteBeats;
              } else {
                break;
              }
            }

            // Remove only the notes that overlap with the new note
            voice.notes.splice(insertPosition, notesToRemove);

            // Insert the new note at the correct position
            const truncatedNote = {
              ...noteData,
              duration: fitDuration.duration,
              dotted: fitDuration.dotted,
              beat: insertBeat,
            };
            voice.notes.splice(insertPosition, 0, truncatedNote);

            // Recalculate beat positions
            this.recalculateBeatPositions(voice.notes);

            // Sync to treble block sequence if needed
            if (staff === 'treble' && compositionState.trebleBlockSequence?.blocks?.length > 0) {
              compositionState.syncMeasuresToTrebleBlock();
            }

            this.composerIntegration.render();
          } else if (choice === 'shift') {
            // Shift: use appropriate method based on staff
            if (staff === 'treble') {
              this.insertTrebleNoteWithShiftAtPosition(
                measureIndex,
                { action: 'after', noteIndex, voiceIndex },
                noteData,
                compositionState
              );
            } else {
              // Bass clef: use shiftNotesForward approach
              this.insertBassNoteWithShiftAtPosition(
                measureIndex,
                { action: 'after', noteIndex, voiceIndex },
                noteData,
                compositionState,
                beatsPerMeasure
              );
            }
          }
        },
      });
      return;
    }

    // No overflow - but Shift+Arrow should still shift downstream notes
    // Use the shift method directly
    if (staff === 'treble') {
      this.insertTrebleNoteWithShiftAtPosition(
        measureIndex,
        { action: 'after', noteIndex, voiceIndex },
        noteData,
        compositionState
      );
    } else {
      this.insertBassNoteWithShiftAtPosition(
        measureIndex,
        { action: 'after', noteIndex, voiceIndex },
        noteData,
        compositionState,
        beatsPerMeasure
      );
    }
  }

  /**
   * Convert Tone.js duration to beats (quarter notes)
   * @param {string} duration - Tone.js duration (e.g., '4n', '2n')
   * @param {boolean} dotted - Whether the note is dotted
   * @returns {number} - Number of beats
   */
  durationToBeats(duration, dotted = false) {
    const durationMap = {
      '1n': 4,    // Whole note = 4 beats
      '2n': 2,    // Half note = 2 beats
      '4n': 1,    // Quarter note = 1 beat
      '8n': 0.5,  // Eighth note = 0.5 beats
      '16n': 0.25, // Sixteenth note = 0.25 beats
      '32n': 0.125 // Thirty-second note = 0.125 beats
    };

    // Tuplet ratios - actual notes in time of normal
    const tupletRatios = {
      triplet: { actual: 3, normal: 2 },      // 3 notes in time of 2
      quintuplet: { actual: 5, normal: 4 },   // 5 notes in time of 4
      sextuplet: { actual: 6, normal: 4 },    // 6 notes in time of 4
    };

    let baseDuration = duration;
    let tupletType = null;
    let dottedFromString = false;

    if (duration && typeof duration === 'string') {
      // Check for dotted notation in string (e.g., '2n.' -> '2n' + dotted)
      // IMPORTANT: Strip the dot FIRST before checking tuplet suffixes
      if (duration.includes('.')) {
        baseDuration = duration.replace('.', '');
        dottedFromString = true;
      }

      // Check for tuplet duration suffix (t=triplet, q=quintuplet, x=sextuplet)
      if (baseDuration.endsWith('t') && /^\d+t$/.test(baseDuration)) {
        baseDuration = baseDuration.replace('t', 'n');
        tupletType = 'triplet';
      } else if (baseDuration.endsWith('q') && /^\d+q$/.test(baseDuration)) {
        baseDuration = baseDuration.replace('q', 'n');
        tupletType = 'quintuplet';
      } else if (baseDuration.endsWith('x') && /^\d+x$/.test(baseDuration)) {
        baseDuration = baseDuration.replace('x', 'n');
        tupletType = 'sextuplet';
      }
    }

    let beats = durationMap[baseDuration] || 1;

    // Apply tuplet ratio if this is a tuplet note
    if (tupletType && tupletRatios[tupletType]) {
      const ratio = tupletRatios[tupletType];
      beats = beats * (ratio.normal / ratio.actual);
    }

    // Apply dotted multiplier - use dottedFromString OR dotted parameter
    // but NOT both (avoid double-counting)
    if (dottedFromString || dotted) {
      beats *= 1.5;
    }
    return beats;
  }

  /**
   * Recalculate beat positions for all notes in a voice
   * @param {Array} notes - Array of notes in the voice
   */
  recalculateBeatPositions(notes) {
    let currentBeat = 0;
    notes.forEach((note, index) => {
      note.beat = currentBeat;
      const noteBeats = this.durationToBeats(note.duration, note.dotted || false);
      currentBeat += noteBeats;
    });
  }

  // ============================================================================
  // DURATION CHANGES
  // ============================================================================

  /**
   * Change duration of all selected notes
   * @param {string} newDuration - New Tone.js duration
   */
  changeDurationOfSelected(newDuration) {
    if (this.selectedNotes.size === 0) {
      console.warn('[NoteEditor] No notes selected');
      return;
    }

    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    // For treble clef notes, check if duration change would cause overflow
    // and show dialog if needed
    const compositionState = window.getCompositionState?.();
    if (!compositionState) {
      console.warn('[NoteEditor] No compositionState available');
      return;
    }

    // Check for overflow scenarios in both treble and bass clef
    const overflows = [];

    // Get the actual time signature for proper beat calculation
    const timeSignature = compositionState.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE;
    const maxBeats = getBeatsPerMeasureFromTimeSignature(timeSignature);

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);

      const measure = compositionState.measures[measureIndex];
      if (measure) {
        const voiceKey = staff === 'treble' ? 'treble' : 'bass';
        const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
        if (voice && voice.notes[noteIndex]) {
          const currentNote = voice.notes[noteIndex];
          const currentDuration = currentNote.duration || '4n';
          const currentDotted = currentNote.dotted || false;

          // PREDICTABLE BEHAVIOR: When changing duration, use non-dotted by default.
          // This way clicking "whole note" gives you 4 beats, not 6 beats.
          // If the user wants a dotted whole, they click whole, then click dot.
          // This prevents confusion when a dotted note is selected (which auto-syncs
          // the toolbar's dotted state to ON) and user just wants to change duration.
          const newDotted = false;

          // Skip if nothing is changing
          if (currentDuration === newDuration) {
            continue;
          }

          const currentBeats = this.durationToBeats(currentDuration, currentDotted);
          const newBeats = this.durationToBeats(newDuration, newDotted);

          // Calculate current measure beats used (excluding this note)
          let usedBeats = 0;
          for (let i = 0; i < voice.notes.length; i++) {
            if (i !== noteIndex) {
              const dur = voice.notes[i].duration || '4n';
              const hasDot = dur.includes('.');
              let beats = this.durationToBeats(dur);
              if (voice.notes[i].dotted && !hasDot) beats *= 1.5;
              usedBeats += beats;
            }
          }

          const availableBeats = maxBeats - usedBeats;

          if (newBeats > availableBeats) {
            overflows.push({
              noteId,
              measureIndex,
              noteIndex,
              voiceIndex, // Include voiceIndex for bass shift support
              staff,
              overflowBeats: newBeats - availableBeats,
              availableBeats,
              newBeats,
              currentNote,
              newDotted,
            });
          }
        }
      }
    }

    // If there are overflows, show dialog for the first one
    // (For simplicity, handle one at a time)
    if (overflows.length > 0) {
      const overflow = overflows[0];

      showNoteOverflowDialog({
        overflowBeats: overflow.overflowBeats,
        noteDuration: newDuration,
        bassBlockIsolated: overflow.staff === 'bass', // Bass clef only gets truncate option (block-isolated)
        onChoice: (choice) => {
          if (choice === null) {
            return;
          }

          if (choice === 'truncate') {
            if (overflow.staff === 'bass') {
              // BASS: Apply the new duration and truncate downstream notes within the block
              this.applyDurationChangeWithTruncateBass(
                overflow.measureIndex,
                overflow.noteIndex,
                overflow.voiceIndex,
                newDuration,
                overflow.newDotted,
                compositionState
              );
            } else {
              // TREBLE: Truncate the note itself to fit available space
              const fitDuration = this.beatsToDuration(overflow.availableBeats);
              this.applyDurationChange(newDuration, fitDuration.duration, fitDuration.dotted, [overflow.noteId]);
            }
          } else if (choice === 'shift') {
            // Shift: push downstream notes forward to make room (treble only)
            if (overflow.staff === 'treble') {
              this.applyDurationChangeWithShift(overflow.measureIndex, overflow.noteIndex, newDuration, overflow.newDotted, compositionState);
            }
            // Note: Bass clef never reaches here since bassBlockIsolated hides the shift option
          }
        },
      });
      return;
    }

    // No overflow - apply changes directly (preserve each note's dotted state)
    this.applyDurationChangePreserveDotted(newDuration, Array.from(this.selectedNotes));
  }

  /**
   * Apply duration change to selected notes without overflow handling
   * @param {string} requestedDuration - Originally requested duration
   * @param {string} actualDuration - Actual duration to apply
   * @param {boolean} isDotted - Whether dotted
   * @param {Array} noteIds - Array of note IDs to change
   */
  applyDurationChange(requestedDuration, actualDuration, isDotted, noteIds) {
    let changedCount = 0;
    const measuresToRecalculate = new Set();
    const compositionState = window.getCompositionState?.();

    for (const noteId of noteIds) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);

      if (compositionState && compositionState.measures[measureIndex]) {
        const measure = compositionState.measures[measureIndex];
        const voiceKey = staff === 'treble' ? 'treble' : 'bass';
        const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
        if (voice && voice.notes[noteIndex]) {
          voice.notes[noteIndex].duration = actualDuration;
          voice.notes[noteIndex].dotted = isDotted;
          changedCount++;

          measuresToRecalculate.add(`${measureIndex}-${staff}`);
        }
      }
    }

    // Recalculate beat positions for all affected measures
    if (compositionState) {
      for (const key of measuresToRecalculate) {
        const [measureIndex, staff] = key.split('-');
        const measure = compositionState.measures[parseInt(measureIndex)];
        if (measure) {
          const voice = this.getVoice(measure, staff);
          if (voice && voice.notes) {
            this.recalculateBeatPositions(voice.notes);
          }
        }
      }

      // Sync treble changes to block sequence
      if (compositionState.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
      }

      // Save bass edits to preserve changes across chord operations
      for (const key of measuresToRecalculate) {
        const [measureIdx, staffName] = key.split('-');
        if (staffName === 'bass') {
          const measure = compositionState.measures[parseInt(measureIdx)];
          if (measure && measure.notation?.bass) {
            measure.notation.bass.autoGenerated = false;
            compositionState.saveEditedBassNotesForMeasure(parseInt(measureIdx));
          }
        }
      }
    }

    if (changedCount > 0) {
      this.composerIntegration.render(true);

      setTimeout(() => {
        this.renderOverlay();
      }, 50);
    }
  }

  /**
   * Apply duration change while preserving each note's current dotted state
   * @param {string} newDuration - New duration to apply
   * @param {Array} noteIds - Array of note IDs to change
   */
  applyDurationChangePreserveDotted(newDuration, noteIds) {
    let changedCount = 0;
    const measuresToRecalculate = new Set();
    const compositionState = window.getCompositionState?.();

    for (const noteId of noteIds) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);

      if (compositionState && compositionState.measures[measureIndex]) {
        const measure = compositionState.measures[measureIndex];
        const voiceKey = staff === 'treble' ? 'treble' : 'bass';
        const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
        if (voice && voice.notes[noteIndex]) {
          const currentNote = voice.notes[noteIndex];

          // Skip if duration is already the same
          if (currentNote.duration === newDuration) {
            continue;
          }

          currentNote.duration = newDuration;
          // Keep dotted state unchanged
          changedCount++;

          measuresToRecalculate.add(`${measureIndex}-${staff}`);
        }
      }
    }

    // Recalculate beat positions for all affected measures
    if (compositionState) {
      for (const key of measuresToRecalculate) {
        const [measureIndex, staff] = key.split('-');
        const measure = compositionState.measures[parseInt(measureIndex)];
        if (measure) {
          const voice = this.getVoice(measure, staff);
          if (voice && voice.notes) {
            this.recalculateBeatPositions(voice.notes);
          }
        }
      }

      // Sync treble changes to block sequence
      if (compositionState.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
      }

      // Save bass edits to preserve the entire building block
      for (const key of measuresToRecalculate) {
        const [measureIdx, staffName] = key.split('-');
        if (staffName === 'bass') {
          const measure = compositionState.measures[parseInt(measureIdx)];
          if (measure && measure.notation?.bass) {
            measure.notation.bass.autoGenerated = false;
            compositionState.saveEditedBassNotesForMeasure(parseInt(measureIdx));
          }
        }
      }
    }

    if (changedCount > 0) {
      this.composerIntegration.render(true);

      setTimeout(() => {
        this.renderOverlay();
      }, 50);
    }
  }

  /**
   * Apply duration change with shift for treble notes
   * @param {number} measureIndex - Measure index
   * @param {number} noteIndex - Note index in measure
   * @param {string} newDuration - New duration
   * @param {boolean} isDotted - Whether dotted
   * @param {Object} compositionState - CompositionState instance
   */
  applyDurationChangeWithShift(measureIndex, noteIndex, newDuration, isDotted, compositionState) {
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);
    const voiceIndex = this.getVoiceIndexForStaff('treble');

    // Get the note from the measure
    const measure = compositionState.measures[measureIndex];
    if (!measure) {
      console.warn('[NoteEditor] Could not find measure for duration change with shift');
      return;
    }

    const voice = this.getVoice(measure, 'treble');
    if (!voice || !voice.notes || noteIndex >= voice.notes.length) {
      console.warn('[NoteEditor] Could not find voice/note for duration change with shift');
      return;
    }

    const note = voice.notes[noteIndex];
    const noteBeat = note.beat || 0;

    // Calculate durations - pass dotted flag for canonical format support
    const currentBeats = this.getDurationInBeats(note.duration || '4n', note.dotted);
    let newBeats = this.durationToBeats(newDuration);
    if (isDotted) newBeats *= 1.5;

    // If reducing duration, just apply directly
    if (newBeats <= currentBeats) {
      this.applyDurationChange(newDuration, newDuration, isDotted, [`${measureIndex}-treble-${noteIndex}`]);
      return;
    }

    console.log('[DURATION-SHIFT] Using extract→rebuild algorithm');
    console.log('[DURATION-SHIFT] Changing note at measure', measureIndex, 'beat', noteBeat, 'from', currentBeats, 'to', newBeats, 'beats');

    // 1. Extract all notes from this note's position to end (this also removes them)
    const logicalNotes = this.extractLogicalNotes('treble', voiceIndex, measureIndex, noteBeat, compositionState, beatsPerMeasure);

    // 2. Modify the first logical note's duration (this is the note being changed)
    if (logicalNotes.length > 0) {
      logicalNotes[0].totalDuration = newBeats;
    }

    // 3. Rebuild from the note's position
    this.rebuildNotesAfterShift('treble', voiceIndex, measureIndex, noteBeat, logicalNotes, compositionState, beatsPerMeasure);

    // CRITICAL: Mark measures as manually edited to prevent overwrite from stale block sequence
    compositionState._measuresManuallyEdited = true;

    this.composerIntegration.render(true);

    setTimeout(() => {
      this.renderOverlay();
    }, 50);
  }

  /**
   * Apply duration change with shift for bass notes
   * @param {number} measureIndex - Measure index
   * @param {number} noteIndex - Note index in measure
   * @param {number} voiceIndex - Voice index (0-based)
   * @param {string} newDuration - New duration
   * @param {boolean} isDotted - Whether dotted
   * @param {Object} compositionState - CompositionState instance
   */
  applyDurationChangeWithShiftBass(measureIndex, noteIndex, voiceIndex, newDuration, isDotted, compositionState) {
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);

    // Get the note from the measure
    const measure = compositionState.measures[measureIndex];
    if (!measure) {
      console.warn('[NoteEditor] Could not find measure for bass duration change with shift');
      return;
    }

    const voice = measure.notation?.bass?.voices?.[voiceIndex];
    if (!voice || !voice.notes || noteIndex >= voice.notes.length) {
      console.warn('[NoteEditor] Could not find voice/note for bass duration change with shift');
      return;
    }

    const note = voice.notes[noteIndex];
    const noteBeat = note.beat || 0;

    // Calculate durations - pass dotted flag for canonical format support
    const currentBeats = this.getDurationInBeats(note.duration || '4n', note.dotted);
    let newBeats = this.durationToBeats(newDuration);
    if (isDotted) newBeats *= 1.5;

    // If reducing duration, just apply directly
    if (newBeats <= currentBeats) {
      this.applyDurationChange(newDuration, newDuration, isDotted, [`${measureIndex}-bass-${voiceIndex}-${noteIndex}`]);
      return;
    }

    console.log('[DURATION-SHIFT-BASS] Using extract→rebuild algorithm');
    console.log('[DURATION-SHIFT-BASS] Changing note at measure', measureIndex, 'beat', noteBeat, 'from', currentBeats, 'to', newBeats, 'beats');

    // 1. Extract all notes from this note's position to end (this also removes them)
    const logicalNotes = this.extractLogicalNotes('bass', voiceIndex, measureIndex, noteBeat, compositionState, beatsPerMeasure);

    // 2. Modify the first logical note's duration (this is the note being changed)
    if (logicalNotes.length > 0) {
      logicalNotes[0].totalDuration = newBeats;
    }

    // 3. Rebuild from the note's position
    this.rebuildNotesAfterShift('bass', voiceIndex, measureIndex, noteBeat, logicalNotes, compositionState, beatsPerMeasure);

    // Mark bass as edited and save for all affected measures
    for (let m = measureIndex; m < compositionState.measures.length; m++) {
      const mMeasure = compositionState.measures[m];
      if (mMeasure && mMeasure.notation?.bass) {
        mMeasure.notation.bass.autoGenerated = false;
        compositionState.saveEditedBassNotesForMeasure(m);
      }
    }

    this.composerIntegration.render(true);

    setTimeout(() => {
      this.renderOverlay();
    }, 50);
  }

  /**
   * Apply duration change to a bass note with block-isolated truncation.
   * Changes the note to the new duration and truncates downstream notes within the same chord block.
   * @param {number} measureIndex - Measure index
   * @param {number} noteIndex - Note index within voice
   * @param {number} voiceIndex - Voice index
   * @param {string} newDuration - New duration string
   * @param {boolean} isDotted - Whether dotted
   * @param {Object} compositionState - Composition state
   */
  applyDurationChangeWithTruncateBass(measureIndex, noteIndex, voiceIndex, newDuration, isDotted, compositionState) {
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);

    // Get the note from the measure
    const measure = compositionState.measures[measureIndex];
    if (!measure) {
      console.warn('[NoteEditor] Could not find measure for bass duration change with truncate');
      return;
    }

    const voice = measure.notation?.bass?.voices?.[voiceIndex];
    if (!voice || !voice.notes || noteIndex >= voice.notes.length) {
      console.warn('[NoteEditor] Could not find voice/note for bass duration change with truncate');
      return;
    }

    const note = voice.notes[noteIndex];
    const noteBeat = note.beat || 0;

    // Calculate new duration in beats
    let newBeats = this.durationToBeats(newDuration);
    if (isDotted) newBeats *= 1.5;

    // Get block info for this note
    const absoluteBeat = measureIndex * beatsPerMeasure + noteBeat;
    const blockInfo = this.getBuildingBlockInfo(measureIndex, noteBeat);

    if (!blockInfo) {
      console.warn('[NoteEditor] Could not find block info for bass duration change');
      // Fall back to simple duration change
      this.applyDurationChange(newDuration, newDuration, isDotted, [`${measureIndex}-bass-${voiceIndex}-${noteIndex}`]);
      return;
    }

    // Use correct property names from getBuildingBlockInfo return value
    const blockStartBeat = blockInfo.segmentStartBeat;
    const blockEndBeat = blockInfo.segmentEndBeat;

    console.log('[DURATION-TRUNCATE-BASS] Block-isolated truncation');
    console.log(`[DURATION-TRUNCATE-BASS] Block ${blockInfo.chordIndex}, range [${blockStartBeat}, ${blockEndBeat}), note at beat ${absoluteBeat}`);

    // Check if there are any notes after this one in the block that would be affected
    const currentNoteBeats = this.durationToBeats(note.duration || '4n', note.dotted);
    const currentNoteEndBeat = absoluteBeat + currentNoteBeats;

    // If the new duration is shorter or equal AND doesn't overlap subsequent notes, just apply directly
    // But if new duration is LONGER, we need extract→rebuild to handle downstream notes
    if (newBeats <= currentNoteBeats) {
      // Shrinking the note - safe to apply directly
      console.log('[DURATION-TRUNCATE-BASS] Duration is shrinking, applying directly');
      this.applyDurationChange(newDuration, newDuration, isDotted, [`${measureIndex}-bass-${voiceIndex}-${noteIndex}`]);
      return;
    }

    // New duration is larger - need to use extract→rebuild to truncate downstream notes
    console.log(`[DURATION-TRUNCATE-BASS] Duration expanding from ${currentNoteBeats} to ${newBeats} beats, using extract→rebuild`);

    // Extract notes from this position within the block only
    const logicalNotes = this._extractLogicalNotesFromBlock(
      'bass', voiceIndex, compositionState, beatsPerMeasure,
      blockStartBeat, blockEndBeat, absoluteBeat
    );

    console.log(`[DURATION-TRUNCATE-BASS] Extracted ${logicalNotes.length} logical notes from block`);

    // Modify the first logical note's duration (this is the note being changed)
    if (logicalNotes.length > 0) {
      logicalNotes[0].totalDuration = newBeats;
    }

    // Rebuild within block boundaries - this will truncate overflow
    this._rebuildNotesInBlock(
      'bass', voiceIndex, compositionState, beatsPerMeasure,
      blockStartBeat, blockEndBeat, absoluteBeat,
      logicalNotes
    );

    // Mark bass as edited and sync
    if (measure.notation?.bass) {
      measure.notation.bass.autoGenerated = false;
      compositionState.saveEditedBassNotesForMeasure(measureIndex);
    }

    // Sync measures back to bass block sequence
    compositionState.syncMeasuresToBuildingBlocks();

    this.composerIntegration.render(true);

    setTimeout(() => {
      this.renderOverlay();
    }, 50);
  }

  // ============================================================================
  // ARTICULATIONS, DYNAMICS, ORNAMENTS
  // ============================================================================

  /**
   * Toggle articulation on all selected notes
   * @param {string} articulation - Articulation type ('staccato', 'accent', 'tenuto', 'marcato')
   */
  toggleArticulationOnSelected(articulation) {
    if (this.selectedNotes.size === 0) return;

    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    let changedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);

      // Update compositionState directly (single source of truth)
      if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState && compositionState.measures[measureIndex]) {
          const measure = compositionState.measures[measureIndex];
          const voiceKey = staff === 'treble' ? 'treble' : 'bass';
          const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
          if (voice && voice.notes[noteIndex]) {
            const note = voice.notes[noteIndex];
            // Toggle: if already has this articulation, remove it; otherwise set it
            note.articulation = note.articulation === articulation ? null : articulation;
            changedCount++;
          }
        }
      }
    }

    if (changedCount > 0) {
      const compositionState = window.getCompositionState?.();

      // Sync treble changes to block sequence (if using treble block sequence)
      if (compositionState?.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
      }

      // Save bass edits to preserve the entire building block
      for (const noteId of this.selectedNotes) {
        const [measureIndex, staff, voiceIndex] = this.parseNoteId(noteId);
        if (staff === 'bass' && compositionState) {
          const measure = compositionState.measures[measureIndex];
          if (measure && measure.notation?.bass) {
            measure.notation.bass.autoGenerated = false;
            compositionState.saveEditedBassNotesForMeasure(measureIndex);
          }
        }
      }

      this.composerIntegration.render(true); // Force immediate render
    }
  }

  /**
   * Toggle dynamic marking on all selected notes
   * @param {string} dynamic - Dynamic type ('pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz', 'fp')
   */
  toggleDynamicOnSelected(dynamic) {
    if (this.selectedNotes.size === 0) return;

    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    let changedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);

      // Update compositionState directly (single source of truth)
      if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState && compositionState.measures[measureIndex]) {
          const measure = compositionState.measures[measureIndex];
          const voiceKey = staff === 'treble' ? 'treble' : 'bass';
          const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
          if (voice && voice.notes[noteIndex]) {
            const note = voice.notes[noteIndex];
            // Toggle: if already has this dynamic, remove it; otherwise set it
            note.dynamic = note.dynamic === dynamic ? null : dynamic;
            changedCount++;
          }
        }
      }
    }

    if (changedCount > 0) {
      const compositionState = window.getCompositionState?.();

      // Sync treble changes to block sequence (if using treble block sequence)
      if (compositionState?.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
      }

      // Save bass edits to preserve the entire building block
      for (const noteId of this.selectedNotes) {
        const [measureIndex, staff, voiceIndex] = this.parseNoteId(noteId);
        if (staff === 'bass' && compositionState) {
          const measure = compositionState.measures[measureIndex];
          if (measure && measure.notation?.bass) {
            measure.notation.bass.autoGenerated = false;
            compositionState.saveEditedBassNotesForMeasure(measureIndex);
          }
        }
      }

      this.composerIntegration.render(true); // Force immediate render
    }
  }

  /**
   * Apply a hairpin (crescendo/decrescendo) to the selected note range
   * Requires at least 2 notes selected in the same clef
   * @param {string} hairpinType - 'crescendo' or 'decrescendo'
   */
  applyHairpinToSelected(hairpinType) {
    if (this.selectedNotes.size < 2) {
      console.log('[applyHairpinToSelected] Need at least 2 notes selected');
      return;
    }

    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    // Parse all selected notes and group by clef
    const notesByClef = { treble: [], bass: [] };

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);
      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      const voiceKey = staff === 'treble' ? 'treble' : 'bass';
      const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
      if (!voice || !voice.notes[noteIndex]) continue;

      const note = voice.notes[noteIndex];
      const clef = staff === 'treble' ? 'treble' : 'bass';

      notesByClef[clef].push({
        measureIndex,
        beat: note.beat || 0,
        voiceIndex: voiceIndex || 0,
        noteIndex
      });
    }

    // Determine which clef has the selection (prefer the one with more notes)
    let targetClef = 'treble';
    if (notesByClef.bass.length > notesByClef.treble.length) {
      targetClef = 'bass';
    } else if (notesByClef.treble.length === 0 && notesByClef.bass.length > 0) {
      targetClef = 'bass';
    }

    const notes = notesByClef[targetClef];
    if (notes.length < 2) {
      console.log('[applyHairpinToSelected] Need at least 2 notes in the same clef');
      return;
    }

    // Sort notes by position (measure, then beat)
    notes.sort((a, b) => {
      if (a.measureIndex !== b.measureIndex) {
        return a.measureIndex - b.measureIndex;
      }
      return a.beat - b.beat;
    });

    // Get first and last note as hairpin start/end
    const startNote = notes[0];
    const endNote = notes[notes.length - 1];

    // Add hairpin to compositionState
    const hairpin = compositionState.addHairpin({
      type: hairpinType,
      clef: targetClef,
      voiceIndex: startNote.voiceIndex,
      startMeasure: startNote.measureIndex,
      startBeat: startNote.beat,
      endMeasure: endNote.measureIndex,
      endBeat: endNote.beat
    });

    console.log(`[applyHairpinToSelected] Created ${hairpinType} hairpin:`, hairpin);

    // Re-render to show the hairpin
    this.composerIntegration.render(true);
  }

  /**
   * Remove hairpins that overlap with the selected notes
   * If any selected note is part of a hairpin, that hairpin is removed
   */
  removeHairpinFromSelected() {
    if (this.selectedNotes.size === 0) return;

    const compositionState = window.getCompositionState?.();
    if (!compositionState || !compositionState.hairpins || compositionState.hairpins.length === 0) {
      return;
    }

    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    // Parse all selected notes to find their positions
    const selectedPositions = [];
    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);
      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      const voiceKey = staff === 'treble' ? 'treble' : 'bass';
      const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
      if (!voice || !voice.notes[noteIndex]) continue;

      const note = voice.notes[noteIndex];
      const clef = staff === 'treble' ? 'treble' : 'bass';

      selectedPositions.push({
        clef,
        measureIndex,
        beat: note.beat || 0
      });
    }

    if (selectedPositions.length === 0) return;

    // Find hairpins that contain any of the selected notes
    const hairpinsToRemove = [];
    for (const hairpin of compositionState.hairpins) {
      for (const pos of selectedPositions) {
        if (pos.clef !== hairpin.clef) continue;

        // Check if this position is within the hairpin's range
        const posValue = pos.measureIndex * 1000 + pos.beat;
        const hairpinStart = hairpin.startMeasure * 1000 + hairpin.startBeat;
        const hairpinEnd = hairpin.endMeasure * 1000 + hairpin.endBeat;

        if (posValue >= hairpinStart && posValue <= hairpinEnd) {
          hairpinsToRemove.push(hairpin.id);
          break; // Don't need to check more positions for this hairpin
        }
      }
    }

    // Remove the hairpins
    let removedCount = 0;
    for (const hairpinId of hairpinsToRemove) {
      if (compositionState.removeHairpin(hairpinId)) {
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`[removeHairpinFromSelected] Removed ${removedCount} hairpin(s)`);
      this.composerIntegration.render(true);
    }
  }

  /**
   * Apply a slur to the selected note range
   * Requires at least 2 notes selected in the same clef
   */
  applySlurToSelected() {
    if (this.selectedNotes.size < 2) {
      console.log('[applySlurToSelected] Need at least 2 notes selected');
      return;
    }

    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    // Parse all selected notes and group by clef
    const notesByClef = { treble: [], bass: [] };

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);
      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      const voiceKey = staff === 'treble' ? 'treble' : 'bass';
      const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
      if (!voice || !voice.notes[noteIndex]) continue;

      const note = voice.notes[noteIndex];
      const clef = staff === 'treble' ? 'treble' : 'bass';

      notesByClef[clef].push({
        measureIndex,
        beat: note.beat || 0,
        voiceIndex: voiceIndex || 0,
        noteIndex
      });
    }

    // Determine which clef has the selection (prefer the one with more notes)
    let targetClef = 'treble';
    if (notesByClef.bass.length > notesByClef.treble.length) {
      targetClef = 'bass';
    } else if (notesByClef.treble.length === 0 && notesByClef.bass.length > 0) {
      targetClef = 'bass';
    }

    const notes = notesByClef[targetClef];
    if (notes.length < 2) {
      console.log('[applySlurToSelected] Need at least 2 notes in the same clef');
      return;
    }

    // Sort notes by position (measure, then beat)
    notes.sort((a, b) => {
      if (a.measureIndex !== b.measureIndex) {
        return a.measureIndex - b.measureIndex;
      }
      return a.beat - b.beat;
    });

    // Get first and last note as slur start/end
    const startNote = notes[0];
    const endNote = notes[notes.length - 1];

    // Add slur to compositionState
    const slur = compositionState.addSlur({
      clef: targetClef,
      voiceIndex: startNote.voiceIndex,
      startMeasure: startNote.measureIndex,
      startBeat: startNote.beat,
      endMeasure: endNote.measureIndex,
      endBeat: endNote.beat
    });

    console.log(`[applySlurToSelected] Created slur:`, slur);

    // Re-render to show the slur
    this.composerIntegration.render(true);
  }

  /**
   * Remove slurs that overlap with the selected notes
   * If any selected note is part of a slur, that slur is removed
   */
  removeSlurFromSelected() {
    if (this.selectedNotes.size === 0) return;

    const compositionState = window.getCompositionState?.();
    if (!compositionState || !compositionState.slurs || compositionState.slurs.length === 0) {
      return;
    }

    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    // Parse all selected notes to find their positions
    const selectedPositions = [];
    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);
      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      const voiceKey = staff === 'treble' ? 'treble' : 'bass';
      const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
      if (!voice || !voice.notes[noteIndex]) continue;

      const note = voice.notes[noteIndex];
      const clef = staff === 'treble' ? 'treble' : 'bass';

      selectedPositions.push({
        clef,
        measureIndex,
        beat: note.beat || 0
      });
    }

    if (selectedPositions.length === 0) return;

    // Find slurs that contain any of the selected notes
    const slursToRemove = [];
    for (const slur of compositionState.slurs) {
      for (const pos of selectedPositions) {
        if (pos.clef !== slur.clef) continue;

        // Check if this position is within the slur's range
        const posValue = pos.measureIndex * 1000 + pos.beat;
        const slurStart = slur.startMeasure * 1000 + slur.startBeat;
        const slurEnd = slur.endMeasure * 1000 + slur.endBeat;

        if (posValue >= slurStart && posValue <= slurEnd) {
          slursToRemove.push(slur.id);
          break; // Don't need to check more positions for this slur
        }
      }
    }

    // Remove the slurs
    let removedCount = 0;
    for (const slurId of slursToRemove) {
      if (compositionState.removeSlur(slurId)) {
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`[removeSlurFromSelected] Removed ${removedCount} slur(s)`);
      this.composerIntegration.render(true);
    }
  }

  /**
   * Apply an ornament to all selected notes
   * @param {string} ornamentType - The ornament type: 'trill', 'mordent', 'invertedMordent', 'turn', 'invertedTurn'
   */
  applyOrnamentToSelected(ornamentType) {
    if (this.selectedNotes.size === 0) {
      console.log('[applyOrnamentToSelected] No notes selected');
      return;
    }

    // Save state for undo
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    let changedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);
      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      const voiceKey = staff === 'treble' ? 'treble' : 'bass';
      const voice = measure.notation?.[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
      if (!voice || !voice.notes || !voice.notes[noteIndex]) continue;

      const note = voice.notes[noteIndex];

      // Skip rests
      if (note.isRest) continue;

      // Toggle ornament: if same ornament already applied, remove it
      if (note.ornament === ornamentType) {
        note.ornament = null;
      } else {
        note.ornament = ornamentType;
      }
      changedCount++;
    }

    if (changedCount > 0) {
      console.log(`[applyOrnamentToSelected] Applied/toggled '${ornamentType}' on ${changedCount} note(s)`);
      this.composerIntegration.render(true);
    }
  }

  /**
   * Remove ornaments from all selected notes
   */
  removeOrnamentFromSelected() {
    if (this.selectedNotes.size === 0) {
      console.log('[removeOrnamentFromSelected] No notes selected');
      return;
    }

    // Save state for undo
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    let removedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);
      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      const voiceKey = staff === 'treble' ? 'treble' : 'bass';
      const voice = measure.notation?.[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
      if (!voice || !voice.notes || !voice.notes[noteIndex]) continue;

      const note = voice.notes[noteIndex];

      if (note.ornament) {
        note.ornament = null;
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`[removeOrnamentFromSelected] Removed ornaments from ${removedCount} note(s)`);
      this.composerIntegration.render(true);
    }
  }

  /**
   * Add a grace note to selected notes
   * Grace notes are small notes preceding the main note
   * @param {string} graceType - 'acciaccatura' (slashed/crushed) or 'appoggiatura' (leaning)
   */
  addGraceNoteToSelected(graceType) {
    if (this.selectedNotes.size === 0) {
      console.log('[addGraceNoteToSelected] No notes selected');
      return;
    }

    // Save state for undo
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    let changedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);
      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      const voiceKey = staff === 'treble' ? 'treble' : 'bass';
      const voice = measure.notation?.[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
      if (!voice || !voice.notes || !voice.notes[noteIndex]) continue;

      const note = voice.notes[noteIndex];

      // Skip rests
      if (note.isRest) continue;

      // Get the pitch of the target note to calculate grace note pitch
      const targetPitch = note.pitches ? note.pitches[0] : note.pitch;
      if (!targetPitch) continue;

      // Calculate a grace note pitch (one scale step below by default)
      // For simplicity, we'll go one semitone below
      const gracePitch = this.transposeHalfStep(targetPitch, -1);

      // Create grace note object
      const graceNote = {
        pitch: gracePitch,
        duration: '8n',  // Eighth note is standard for grace notes
        slash: graceType === 'acciaccatura',  // Acciaccatura has a slash through it
      };

      // Add to existing grace notes or create new array
      if (!note.graceNotes) {
        note.graceNotes = [graceNote];
      } else {
        note.graceNotes.push(graceNote);
      }
      changedCount++;
    }

    if (changedCount > 0) {
      console.log(`[addGraceNoteToSelected] Added ${graceType} to ${changedCount} note(s)`);
      this.composerIntegration.render(true);
    }
  }

  /**
   * Remove all grace notes from selected notes
   */
  removeGraceNotesFromSelected() {
    if (this.selectedNotes.size === 0) {
      console.log('[removeGraceNotesFromSelected] No notes selected');
      return;
    }

    // Save state for undo
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    let removedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);
      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      const voiceKey = staff === 'treble' ? 'treble' : 'bass';
      const voice = measure.notation?.[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
      if (!voice || !voice.notes || !voice.notes[noteIndex]) continue;

      const note = voice.notes[noteIndex];

      if (note.graceNotes && note.graceNotes.length > 0) {
        note.graceNotes = null;
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`[removeGraceNotesFromSelected] Removed grace notes from ${removedCount} note(s)`);
      this.composerIntegration.render(true);
    }
  }

  /**
   * Transpose grace notes on selected notes by a number of half steps
   * @param {number} halfSteps - positive = up, negative = down
   */
  transposeGraceNotesOnSelected(halfSteps) {
    if (this.selectedNotes.size === 0) {
      console.log('[transposeGraceNotesOnSelected] No notes selected');
      return;
    }

    // Save state for undo
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    let transposedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);
      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      const voiceKey = staff === 'treble' ? 'treble' : 'bass';
      const voice = measure.notation?.[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
      if (!voice || !voice.notes || !voice.notes[noteIndex]) continue;

      const note = voice.notes[noteIndex];

      // Check if note has grace notes
      if (note.graceNotes && note.graceNotes.length > 0) {
        // Transpose each grace note
        note.graceNotes = note.graceNotes.map(gn => ({
          ...gn,
          pitch: this.transposeHalfStep(gn.pitch, halfSteps)
        }));
        transposedCount++;
      }
    }

    if (transposedCount > 0) {
      console.log(`[transposeGraceNotesOnSelected] Transposed grace notes on ${transposedCount} note(s) by ${halfSteps} half steps`);
      this.composerIntegration.render(true);
    }
  }

  /**
   * Set the pitch of grace notes on selected notes directly
   * @param {string} pitch - The new pitch for all grace notes (e.g., "C4", "F#5")
   */
  setGraceNotePitchOnSelected(pitch) {
    if (this.selectedNotes.size === 0) {
      console.log('[setGraceNotePitchOnSelected] No notes selected');
      return;
    }

    // Save state for undo
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    let changedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);
      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      const voiceKey = staff === 'treble' ? 'treble' : 'bass';
      const voice = measure.notation?.[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
      if (!voice || !voice.notes || !voice.notes[noteIndex]) continue;

      const note = voice.notes[noteIndex];

      // Check if note has grace notes
      if (note.graceNotes && note.graceNotes.length > 0) {
        // Set pitch for all grace notes
        note.graceNotes = note.graceNotes.map(gn => ({
          ...gn,
          pitch: pitch
        }));
        changedCount++;
      }
    }

    if (changedCount > 0) {
      console.log(`[setGraceNotePitchOnSelected] Set grace note pitch to ${pitch} on ${changedCount} note(s)`);
      this.composerIntegration.render(true);
    }
  }

  /**
   * Transpose a pitch by a number of half steps
   * @param {string} pitch - e.g., "C4", "F#5"
   * @param {number} halfSteps - positive = up, negative = down
   * @returns {string} - transposed pitch
   */
  transposeHalfStep(pitch, halfSteps) {
    const noteOrder = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#', 'Cb': 'B' };

    // Parse the pitch
    const match = pitch.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return pitch;

    let [, noteName, octaveStr] = match;
    let octave = parseInt(octaveStr);

    // Normalize flats to sharps for calculation
    if (flatToSharp[noteName]) {
      noteName = flatToSharp[noteName];
    }

    // Find current index
    let noteIndex = noteOrder.indexOf(noteName);
    if (noteIndex === -1) {
      // Handle natural notes that might have been written with 'b' (like 'E' for 'Fb')
      noteIndex = noteOrder.indexOf(noteName.charAt(0));
    }
    if (noteIndex === -1) return pitch;

    // Calculate new index
    let newIndex = noteIndex + halfSteps;

    // Handle octave changes
    while (newIndex < 0) {
      newIndex += 12;
      octave--;
    }
    while (newIndex >= 12) {
      newIndex -= 12;
      octave++;
    }

    return noteOrder[newIndex] + octave;
  }

  /**
   * Apply a tempo marking at the selected note's measure position
   * @param {Object} tempoMarking - { symbol, bpm } tempo marking info
   */
  applyTempoMarking(tempoMarking) {
    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    // Get the measure index from: 1) selected notes, 2) selected measure, 3) default to 0
    let measureIndex = 0;
    if (this.selectedNotes.size > 0) {
      const firstNoteId = [...this.selectedNotes][0];
      const [measIdx] = this.parseNoteId(firstNoteId);
      measureIndex = measIdx;
    } else if (this.composerIntegration?.selectedMeasure != null) {
      measureIndex = this.composerIntegration.selectedMeasure;
    }

    // Save state for undo
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    compositionState.addTempoMarking({
      measureIndex,
      symbol: tempoMarking.symbol,
      bpm: tempoMarking.bpm,
    });

    console.log(`[applyTempoMarking] Added ${tempoMarking.symbol} at measure ${measureIndex}`);
    this.composerIntegration.render(true);
  }

  /**
   * Apply a repeat sign at the current selected measure
   * @param {string} repeatType - 'repeatStart', 'repeatEnd', 'repeatBoth', or 'none' to remove
   */
  applyRepeatSign(repeatType) {
    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    // Get the measure index from: 1) selected notes, 2) selected measure, 3) default to 0
    let measureIndex = 0;
    if (this.selectedNotes.size > 0) {
      const firstNoteId = [...this.selectedNotes][0];
      const [measIdx] = this.parseNoteId(firstNoteId);
      measureIndex = measIdx;
    } else if (this.composerIntegration?.selectedMeasure != null) {
      measureIndex = this.composerIntegration.selectedMeasure;
    }

    // Save state for undo
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    if (repeatType === 'none') {
      // Remove repeat sign from this measure
      compositionState.removeRepeatSign(measureIndex);
      console.log(`[applyRepeatSign] Removed repeat sign from measure ${measureIndex}`);
    } else {
      // Add or update repeat sign
      compositionState.addRepeatSign({
        measureIndex,
        type: repeatType, // 'repeatStart', 'repeatEnd', 'repeatBoth'
      });
      console.log(`[applyRepeatSign] Added ${repeatType} at measure ${measureIndex}`);
    }

    this.composerIntegration.render(true);
  }

  /**
   * Apply a volta bracket at the current selected measure
   * @param {string} voltaNumber - '1', '2', or other ending number
   */
  applyVoltaBracket(voltaNumber) {
    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    // Get the measure index from: 1) selected notes, 2) selected measure, 3) default to 0
    let measureIndex = 0;
    if (this.selectedNotes.size > 0) {
      const firstNoteId = [...this.selectedNotes][0];
      const [measIdx] = this.parseNoteId(firstNoteId);
      measureIndex = measIdx;
    } else if (this.composerIntegration?.selectedMeasure != null) {
      measureIndex = this.composerIntegration.selectedMeasure;
    }

    // Save state for undo
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    // Toggle volta at this measure
    const result = compositionState.toggleVoltaAtMeasure(measureIndex, voltaNumber);

    if (result) {
      console.log(`[applyVoltaBracket] Added volta ${voltaNumber} at measure ${measureIndex}`);
    } else {
      console.log(`[applyVoltaBracket] Removed volta ${voltaNumber} from measure ${measureIndex}`);
    }

    this.composerIntegration.render(true);
  }

  // ============================================================================
  // TIES, DOTTED, RESTS
  // ============================================================================

  /**
   * Toggle tie on all selected notes
   * When multiple notes are selected, only toggle tie on the FIRST note of each pair,
   * to prevent unwanted cascading ties.
   */
  toggleTieOnSelected() {
    if (this.selectedNotes.size === 0) return;

    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    let changedCount = 0;
    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);

    // Parse and sort selected notes by position (measure, then beat)
    const parsedNotes = [];
    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);
      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;
      const voiceKey = staff === 'treble' ? 'treble' : 'bass';
      const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
      if (!voice || !voice.notes[noteIndex]) continue;
      const note = voice.notes[noteIndex];
      parsedNotes.push({
        noteId,
        measureIndex,
        staff,
        voiceIndex,
        noteIndex,
        beat: note.beat || 0,
        note,
        voice,
        voiceKey,
      });
    }

    // Sort by position (measure first, then beat within measure)
    parsedNotes.sort((a, b) => {
      if (a.measureIndex !== b.measureIndex) return a.measureIndex - b.measureIndex;
      return a.beat - b.beat;
    });

    // Track which notes have been targeted by a tie from a previous selected note
    // so we don't create a cascading tie from them
    const tieTiedNotes = new Set();

    for (const parsed of parsedNotes) {
      const { measureIndex, staff, voiceIndex, noteIndex, note, voice, voiceKey } = parsed;

      // If this note was just tied FROM a previous selected note, skip toggling its tie
      // This prevents cascading: if user selects A,B,C, clicking tie should only tie A→B,
      // not also B→C
      const noteIdForCheck = `${measureIndex}-${staff}-${voiceIndex}-${noteIndex}`;
      if (tieTiedNotes.has(noteIdForCheck)) {
        continue;
      }

      // Toggle tied state
      const newTiedState = !note.tied;
      note.tied = newTiedState;
      changedCount++;

      // CRITICAL: Also update isTied on the next note to keep tie state consistent
      // This prevents sync from incorrectly merging notes after tie is removed
      let nextNote = null;
      let nextMeasureIdx = measureIndex;
      let nextNoteIdx = noteIndex + 1;
      let nextVoiceForLookup = voice;

      // Check if next note is in this measure
      if (nextNoteIdx < voice.notes.length) {
        nextNote = voice.notes[nextNoteIdx];
      } else {
        // Check the next measure for continuation
        nextMeasureIdx = measureIndex + 1;
        if (nextMeasureIdx < compositionState.measures.length) {
          const nextMeasure = compositionState.measures[nextMeasureIdx];
          const nextVoice = nextMeasure.notation[voiceKey]?.voices?.[voiceIndex];
          if (nextVoice && nextVoice.notes && nextVoice.notes.length > 0) {
            nextNote = nextVoice.notes[0];
            nextVoiceForLookup = nextVoice;
            nextNoteIdx = 0;
          }
        }
      }

      // If the next note exists and has the same pitches, update its isTied
      if (nextNote) {
        const samePitches = this.pitchArraysMatch(
          note.pitches || (note.pitch ? [note.pitch] : []),
          nextNote.pitches || (nextNote.pitch ? [nextNote.pitch] : [])
        );
        if (samePitches) {
          nextNote.isTied = newTiedState;
          // Mark this next note as having been tied-to, so we don't toggle its tie
          if (newTiedState) {
            const nextNoteIdForCheck = `${nextMeasureIdx}-${staff}-${voiceIndex}-${nextNoteIdx}`;
            tieTiedNotes.add(nextNoteIdForCheck);
          }
        }
      }
    }

    if (changedCount > 0) {
      // Sync treble changes to block sequence (if using treble block sequence)
      if (compositionState.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
      }

      // Save bass edits to preserve the entire building block
      for (const noteId of this.selectedNotes) {
        const [measureIndex, staff, voiceIndex] = this.parseNoteId(noteId);
        if (staff === 'bass') {
          const measure = compositionState.measures[measureIndex];
          if (measure && measure.notation?.bass) {
            measure.notation.bass.autoGenerated = false;
            compositionState.saveEditedBassNotesForMeasure(measureIndex);
          }
        }
      }

      this.composerIntegration.render(true); // Force immediate render

      // Dispatch event for tutorial validation
      dispatchBuilderEvent('notationTieCreated', { changedCount, selectedNotes: Array.from(this.selectedNotes) });
    }
  }

  /**
   * Check if two pitch arrays have the same pitches
   */
  pitchArraysMatch(pitches1, pitches2) {
    if (!pitches1 || !pitches2) return false;
    if (pitches1.length !== pitches2.length) return false;
    const sorted1 = [...pitches1].sort();
    const sorted2 = [...pitches2].sort();
    return sorted1.every((p, i) => p === sorted2[i]);
  }

  /**
   * Toggle dotted on all selected notes
   * When adding a dot (increasing duration by 50%), check for measure overflow
   */
  toggleDottedOnSelected() {
    if (this.selectedNotes.size === 0) return;

    const compositionState = window.getCompositionState?.();
    if (!compositionState) {
      console.warn('[NoteEditor] No compositionState available');
      return;
    }

    // Get time signature for beat calculation
    const timeSignature = compositionState.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE;
    const maxBeats = getBeatsPerMeasureFromTimeSignature(timeSignature);

    // Check for overflow when ADDING a dot (not when removing one)
    const overflows = [];

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);

      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      const voiceKey = staff === 'treble' ? 'treble' : 'bass';
      const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
      if (!voice || !voice.notes[noteIndex]) continue;

      const note = voice.notes[noteIndex];
      const currentDotted = note.dotted || false;

      // Only check overflow when ADDING a dot (toggling from false to true)
      if (!currentDotted) {
        const currentDuration = note.duration || '4n';
        const currentBeats = this.durationToBeats(currentDuration, false);
        const newBeats = currentBeats * 1.5; // Adding dot increases by 50%

        // Calculate current measure beats used (excluding this note)
        let usedBeats = 0;
        for (let i = 0; i < voice.notes.length; i++) {
          if (i !== noteIndex) {
            const dur = voice.notes[i].duration || '4n';
            let beats = this.durationToBeats(dur, voice.notes[i].dotted || false);
            usedBeats += beats;
          }
        }

        const availableBeats = maxBeats - usedBeats;

        if (newBeats > availableBeats) {
          overflows.push({
            noteId,
            measureIndex,
            noteIndex,
            voiceIndex,
            staff,
            overflowBeats: newBeats - availableBeats,
            availableBeats,
            newBeats,
            currentNote: note,
          });
        }
      }
    }

    // If there are overflows when adding dot, show dialog
    if (overflows.length > 0) {
      const overflow = overflows[0];

      showNoteOverflowDialog({
        overflowBeats: overflow.overflowBeats,
        noteDuration: `dotted ${overflow.currentNote.duration || '4n'}`,
        bassBlockIsolated: overflow.staff === 'bass',
        onChoice: (choice) => {
          if (choice === null) {
            return; // User cancelled
          }

          if (choice === 'truncate') {
            // Apply the dotted change and truncate downstream notes
            this._applyDottedWithTruncate(overflow, compositionState, maxBeats);
          } else if (choice === 'shift') {
            // Apply the dotted change and shift downstream notes
            this._applyDottedWithShift(overflow, compositionState, maxBeats);
          }
        },
      });
      return;
    }

    // No overflow - apply dotted toggle directly
    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    let changedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);

      const measure = compositionState.measures[measureIndex];
      if (measure) {
        const voiceKey = staff === 'treble' ? 'treble' : 'bass';
        const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
        if (voice && voice.notes[noteIndex]) {
          const note = voice.notes[noteIndex];
          // Toggle dotted state
          note.dotted = !note.dotted;
          changedCount++;
        }
      }
    }

    if (changedCount > 0) {
      // Recalculate beat positions for affected measures
      for (const noteId of this.selectedNotes) {
        const [measureIndex, staff, voiceIndex] = this.parseNoteId(noteId);
        const measure = compositionState.measures[measureIndex];
        if (measure) {
          const voiceKey = staff === 'treble' ? 'treble' : 'bass';
          const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
          if (voice && voice.notes) {
            this.recalculateBeatPositions(voice.notes);
          }
        }
      }

      // Sync treble changes to block sequence (if using treble block sequence)
      if (compositionState?.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
      }

      // Save bass edits to preserve the entire building block
      for (const noteId of this.selectedNotes) {
        const [measureIndex, staff, voiceIndex] = this.parseNoteId(noteId);
        if (staff === 'bass') {
          const measure = compositionState.measures[measureIndex];
          if (measure && measure.notation?.bass) {
            measure.notation.bass.autoGenerated = false;
            compositionState.saveEditedBassNotesForMeasure(measureIndex);
          }
        }
      }

      this.composerIntegration.render(true);
    }
  }

  /**
   * Apply dotted change with truncation of downstream notes
   * @private
   */
  _applyDottedWithTruncate(overflow, compositionState, maxBeats) {
    // Save state for undo
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    const { measureIndex, staff, voiceIndex, noteIndex } = overflow;
    const measure = compositionState.measures[measureIndex];
    const voiceKey = staff === 'treble' ? 'treble' : 'bass';
    const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);

    if (!voice || !voice.notes[noteIndex]) return;

    // Set dotted
    voice.notes[noteIndex].dotted = true;

    // Calculate how much space we need
    const noteBeats = this.durationToBeats(voice.notes[noteIndex].duration || '4n', true);

    // Calculate beat position of this note
    let noteBeat = 0;
    for (let i = 0; i < noteIndex; i++) {
      noteBeat += this.durationToBeats(voice.notes[i].duration || '4n', voice.notes[i].dotted || false);
    }

    // Remove notes that overflow
    const noteEndBeat = noteBeat + noteBeats;
    const notesToKeep = [];
    let currentBeat = 0;

    for (let i = 0; i < voice.notes.length; i++) {
      const n = voice.notes[i];
      const nBeats = this.durationToBeats(n.duration || '4n', n.dotted || false);

      if (i <= noteIndex) {
        // Keep notes up to and including the dotted note
        notesToKeep.push(n);
        currentBeat += nBeats;
      } else if (currentBeat < maxBeats) {
        // Keep subsequent notes only if they fit
        if (currentBeat + nBeats <= maxBeats) {
          notesToKeep.push(n);
          currentBeat += nBeats;
        } else {
          // Truncate this note or skip it
          break;
        }
      }
    }

    voice.notes = notesToKeep;
    this.recalculateBeatPositions(voice.notes);

    // Sync and render
    if (staff === 'treble' && compositionState?.trebleBlockSequence?.blocks?.length > 0) {
      compositionState.syncMeasuresToTrebleBlock();
    }
    if (staff === 'bass') {
      measure.notation.bass.autoGenerated = false;
      compositionState.saveEditedBassNotesForMeasure(measureIndex);
    }

    this.composerIntegration.render(true);
  }

  /**
   * Apply dotted change with shift of downstream notes
   * @private
   */
  _applyDottedWithShift(overflow, compositionState, maxBeats) {
    // Save state for undo
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    const { measureIndex, staff, voiceIndex, noteIndex } = overflow;
    const measure = compositionState.measures[measureIndex];
    const voiceKey = staff === 'treble' ? 'treble' : 'bass';
    const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);

    if (!voice || !voice.notes[noteIndex]) return;

    const note = voice.notes[noteIndex];
    const oldBeats = this.durationToBeats(note.duration || '4n', false);
    const newBeats = oldBeats * 1.5;
    const shiftAmount = newBeats - oldBeats;

    // Set dotted
    note.dotted = true;

    // Use the extract→rebuild pattern for treble
    if (staff === 'treble') {
      // Recalculate beat positions - shift forward
      this.recalculateBeatPositions(voice.notes);

      // Sync to block sequence
      if (compositionState?.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
      }
    } else {
      // Bass - recalculate and save
      this.recalculateBeatPositions(voice.notes);
      measure.notation.bass.autoGenerated = false;
      compositionState.saveEditedBassNotesForMeasure(measureIndex);
    }

    this.composerIntegration.render(true);
  }

  /**
   * Toggle rest mode on all selected notes
   */
  toggleRestOnSelected() {
    if (this.selectedNotes.size === 0) return;

    let changedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);

      // Update compositionState directly
      if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState && compositionState.measures[measureIndex]) {
          const measure = compositionState.measures[measureIndex];

          // Handle auto-generated rests (noteIndex === -1)
          // These don't exist in compositionState, so we need to CREATE a note at the beat position
          if (noteIndex === -1) {
            // Try to get rest info from stored map, or fall back to finding the region
            let restInfo = this.autoGeneratedRestInfo?.get(noteId);

            // If not in autoGeneratedRestInfo, try to find it in noteRegions
            if (!restInfo) {
              const region = this.noteRegions?.find(r =>
                r.measureIndex === measureIndex &&
                r.staff === staff &&
                (r.voiceIndex || 0) === voiceIndex &&
                r.noteIndex === -1
              );
              if (region) {
                restInfo = {
                  measureIndex: region.measureIndex,
                  staff: region.staff,
                  voiceIndex: region.voiceIndex || 0,
                  beat: region.beat,
                  duration: region.duration,
                };
              }
            }

            if (restInfo) {
              const voiceKey = staff === 'treble' ? 'treble' : 'bass';
              const targetVoiceIndex = restInfo.voiceIndex;

              // Ensure voice structure exists
              if (!measure.notation[voiceKey]) {
                measure.notation[voiceKey] = { voices: [{ notes: [] }] };
              }
              while (measure.notation[voiceKey].voices.length <= targetVoiceIndex) {
                measure.notation[voiceKey].voices.push({ notes: [] });
              }
              const voice = measure.notation[voiceKey].voices[targetVoiceIndex];

              // Create new note at the beat position
              const defaultPitch = staff === 'treble' ? 'B4' : 'D3';
              const newNote = {
                type: 'note',
                isRest: false,
                pitch: defaultPitch,
                pitches: [defaultPitch],
                duration: restInfo.duration || '4n',
                beat: restInfo.beat,
                voiceIndex: targetVoiceIndex,
              };

              // Insert note and sort by beat
              voice.notes.push(newNote);
              voice.notes.sort((a, b) => (a.beat ?? 0) - (b.beat ?? 0));

              // Clean up the stored info
              this.autoGeneratedRestInfo?.delete(noteId);

              changedCount++;
              continue;
            } else {
              console.warn('[NoteEditor] Could not find rest info for auto-generated rest:', noteId);
              continue;
            }
          }

          // Use voiceIndex from the noteId, not the "active" voice
          const voiceKey = staff === 'treble' ? 'treble' : 'bass';
          const voice = measure.notation[voiceKey]?.voices?.[voiceIndex];
          if (voice && voice.notes[noteIndex]) {
            const note = voice.notes[noteIndex];
            // Toggle between rest and note
            note.isRest = !note.isRest;
            note.type = note.isRest ? 'rest' : 'note';

            // When converting rest to note, ensure it has a pitch
            if (!note.isRest && (!note.pitch && (!note.pitches || note.pitches.length === 0))) {
              // Default pitch based on staff
              const defaultPitch = staff === 'treble' ? 'B4' : 'D3';
              note.pitch = defaultPitch;
              note.pitches = [defaultPitch];
            }

            changedCount++;
          }
        }
      }
    }

    if (changedCount > 0) {
      const compositionState = window.getCompositionState?.();

      // Sync treble changes to block sequence (if using treble block sequence)
      if (compositionState?.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
      }

      // Save bass edits to preserve the entire building block
      for (const noteId of this.selectedNotes) {
        const [measureIndex, staff, voiceIndex] = this.parseNoteId(noteId);
        if (staff === 'bass' && compositionState) {
          const measure = compositionState.measures[measureIndex];
          if (measure && measure.notation?.bass) {
            measure.notation.bass.autoGenerated = false;
            compositionState.saveEditedBassNotesForMeasure(measureIndex);
          }
        }
      }

      this.composerIntegration.render(true);
    }
  }

  // ============================================================================
  // TUPLETS
  // ============================================================================

  /**
   * Create a tuplet from selected notes
   * @param {string} tupletType - 'triplet', 'quintuplet', or 'sextuplet'
   */
  createTupletFromSelection(tupletType) {
    if (this.selectedNotes.size < 2) {
      return;
    }

    // Get tuplet info
    const tupletInfo = TUPLET_RATIOS[tupletType];
    if (!tupletInfo) {
      console.error('[NoteEditor] Unknown tuplet type:', tupletType);
      return;
    }

    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    // Parse and sort selected notes by measure, staff, and note index
    const parsedNotes = [];
    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);
      parsedNotes.push({ noteId, measureIndex, staff, noteIndex });
    }

    // Sort by measureIndex, then noteIndex
    parsedNotes.sort((a, b) => {
      if (a.measureIndex !== b.measureIndex) return a.measureIndex - b.measureIndex;
      return a.noteIndex - b.noteIndex;
    });

    // Validate: All notes must be in the same measure and same staff
    const firstNote = parsedNotes[0];
    const allSameMeasure = parsedNotes.every(n => n.measureIndex === firstNote.measureIndex);
    const allSameStaff = parsedNotes.every(n => n.staff === firstNote.staff);

    if (!allSameMeasure) {
      return;
    }

    if (!allSameStaff) {
      return;
    }

    // Validate: Notes must be consecutive
    for (let i = 1; i < parsedNotes.length; i++) {
      if (parsedNotes[i].noteIndex !== parsedNotes[i - 1].noteIndex + 1) {
        return;
      }
    }

    // Validate: Number of notes must match tuplet type
    const expectedNotes = tupletInfo.actual;
    if (parsedNotes.length !== expectedNotes) {
      return;
    }

    // Generate group ID
    const groupId = generateTupletGroupId();

    // Apply tuplet attributes to selected notes
    const compositionState = window.getCompositionState?.();
    if (!compositionState) {
      console.error('[NoteEditor] No compositionState available');
      return;
    }

    const measure = compositionState.measures[firstNote.measureIndex];
    if (!measure) {
      console.error('[NoteEditor] Measure not found:', firstNote.measureIndex);
      return;
    }

    const voice = this.getVoice(measure, firstNote.staff);

    if (!voice || !voice.notes) {
      console.error('[NoteEditor] Voice not found for staff:', firstNote.staff);
      return;
    }

    // Calculate the original total beats of selected notes
    // Supports canonical format: duration='2n', dotted=true
    const durationToBeats = (duration, dotted = false) => {
      const map = { '1n': 4, '2n': 2, '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125 };
      const hasDotInString = duration?.includes('.');
      const baseDur = duration.replace(/[tqx.]$/, '');
      let beats = map[baseDur] || 1;
      // Apply dotted multiplier if dot in string OR separate dotted flag
      if (hasDotInString || dotted) {
        beats *= 1.5;
      }
      return beats;
    };

    let originalTotalBeats = 0;
    for (let i = 0; i < parsedNotes.length; i++) {
      const noteData = voice.notes[parsedNotes[i].noteIndex];
      if (noteData) {
        let beats = durationToBeats(noteData.duration || '4n', noteData.dotted);
        originalTotalBeats += beats;
      }
    }

    // Apply tuplet attributes to each note
    for (let i = 0; i < parsedNotes.length; i++) {
      const noteData = voice.notes[parsedNotes[i].noteIndex];
      if (noteData) {
        const isStart = i === 0;
        const isEnd = i === parsedNotes.length - 1;
        noteData.tuplet = createTupletAttribute(tupletType, groupId, isStart, isEnd);

        // Convert duration to tuplet duration (add 't', 'q', or 'x' suffix)
        const baseDuration = noteData.duration || '8n';
        noteData.duration = getTupletDuration(baseDuration, tupletType);
      }
    }

    // Calculate new total beats after tuplet conversion
    // Tuplet takes up (normal/actual) of the original time
    // e.g., triplet: 3 notes in time of 2, so 3 quarter notes become 2 beats
    const tupletTotalBeats = originalTotalBeats * (tupletInfo.normal / tupletInfo.actual);
    const savedBeats = originalTotalBeats - tupletTotalBeats;

    // If we saved beats, insert a rest after the tuplet to fill the gap
    if (savedBeats > 0.001) {
      // Helper to convert beats to best-fit duration(s)
      const beatsToDuration = (beats) => {
        if (beats >= 4) return '1n';
        if (beats >= 2) return '2n';
        if (beats >= 1) return '4n';
        if (beats >= 0.5) return '8n';
        if (beats >= 0.25) return '16n';
        return '32n';
      };

      const lastNoteIndex = parsedNotes[parsedNotes.length - 1].noteIndex;
      const nextNoteIndex = lastNoteIndex + 1;

      // Check if the next note after the tuplet is a rest - if so, combine them
      const nextNote = voice.notes[nextNoteIndex];
      if (nextNote && (nextNote.isRest || nextNote.type === 'rest')) {
        // Calculate the existing rest's beats (uses local durationToBeats with dotted support)
        let existingRestBeats = durationToBeats(nextNote.duration || '4n', nextNote.dotted);

        // Combine the beats
        const combinedBeats = savedBeats + existingRestBeats;
        const combinedDuration = beatsToDuration(combinedBeats);

        // Update the existing rest with the combined duration
        nextNote.duration = combinedDuration;
        nextNote.dotted = false; // Reset dotted since we recalculated
      } else {
        // No adjacent rest - insert a new rest
        const restDuration = beatsToDuration(savedBeats);

        const restData = {
          type: 'rest',
          pitch: firstNote.staff === 'treble' ? 'B4' : 'D3',
          pitches: [firstNote.staff === 'treble' ? 'B4' : 'D3'],
          duration: restDuration,
          isRest: true,
          dotted: false,
        };

        voice.notes.splice(nextNoteIndex, 0, restData);
      }
    }

    // CRITICAL: Recalculate beat positions after tuplet modification
    // The tuplet notes now have shorter durations, so their beat positions must be updated
    this.recalculateBeatPositions(voice.notes);

    // Sync changes
    if (firstNote.staff === 'treble' && compositionState.trebleBlockSequence?.blocks?.length > 0) {
      compositionState.syncMeasuresToTrebleBlock();
    }

    if (firstNote.staff === 'bass') {
      measure.notation.bass.autoGenerated = false;
      compositionState.saveEditedBassNotesForMeasure(firstNote.measureIndex);
    }

    // Re-render
    this.composerIntegration.render(true);

    // Update toolbar selection state to reflect tuplet change
    if (this.composerIntegration.updateToolbarSelectionState) {
      this.composerIntegration.updateToolbarSelectionState();
    }
  }

  /**
   * Remove tuplet attributes from selected notes
   * Converts tuplet notes back to regular notes with original durations
   */
  removeTupletFromSelection() {
    if (this.selectedNotes.size === 0) {
      return;
    }

    const compositionState = window.getCompositionState?.();
    if (!compositionState) {
      console.error('[NoteEditor] No compositionState available');
      return;
    }

    // Helper to convert tuplet duration back to base duration
    const tupletToBaseDuration = (duration) => {
      if (!duration) return '4n';
      // Remove tuplet suffix (t, q, x) and add 'n'
      const match = duration.match(/^(\d+)[tqx]$/);
      if (match) {
        return match[1] + 'n';
      }
      return duration;
    };

    let changedCount = 0;
    const affectedMeasures = new Set();

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);

      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      const voice = this.getVoice(measure, staff);

      if (!voice || !voice.notes[noteIndex]) continue;

      const noteData = voice.notes[noteIndex];
      if (noteData.tuplet) {
        // Convert duration back to base duration
        noteData.duration = tupletToBaseDuration(noteData.duration);
        // Remove tuplet attribute
        delete noteData.tuplet;
        changedCount++;
        affectedMeasures.add(`${measureIndex}-${staff}`);
      }
    }

    if (changedCount > 0) {
      // Sync changes for affected measures
      for (const key of affectedMeasures) {
        const [measureIndex, staff] = key.split('-');
        const measureIdx = parseInt(measureIndex);

        if (staff === 'treble' && compositionState.trebleBlockSequence?.blocks?.length > 0) {
          compositionState.syncMeasuresToTrebleBlock();
        }

        if (staff === 'bass') {
          const measure = compositionState.measures[measureIdx];
          if (measure?.notation?.bass) {
            measure.notation.bass.autoGenerated = false;
            compositionState.saveEditedBassNotesForMeasure(measureIdx);
          }
        }
      }

      // Re-render
      this.composerIntegration.render(true);

      // Update toolbar selection state to reflect tuplet removal
      if (this.composerIntegration.updateToolbarSelectionState) {
        this.composerIntegration.updateToolbarSelectionState();
      }
    }
  }

  /**
   * Toggle tuplet insert mode
   * @param {string} tupletType - 'triplet', 'quintuplet', or 'sextuplet'
   */
  toggleTupletInsertMode(tupletType) {
    if (this.tupletInsertMode === tupletType) {
      // Already in this mode - exit
      this.exitTupletInsertMode();
    } else {
      // Enter new mode
      const tupletInfo = TUPLET_RATIOS[tupletType];
      if (!tupletInfo) {
        console.error('[NoteEditor] Unknown tuplet type:', tupletType);
        return;
      }

      this.tupletInsertMode = tupletType;
      this.tupletInsertProgress = {
        groupId: generateTupletGroupId(),
        notes: [],
        target: tupletInfo.actual,
        measureIndex: null,
        staff: null,
      };

      // Notify UI about mode change
      if (this.onTupletModeChange) {
        this.onTupletModeChange(tupletType);
      }
    }
  }

  /**
   * Exit tuplet insert mode (cancels any partial tuplet)
   */
  exitTupletInsertMode() {
    if (!this.tupletInsertMode) return;

    const partialNotes = this.tupletInsertProgress.notes.length;
    if (partialNotes > 0) {
      // Remove tuplet attributes from any partially-added notes
      this.removePartialTuplet();
    }

    this.tupletInsertMode = null;
    this.tupletInsertProgress = {
      groupId: null,
      notes: [],
      target: 0,
      measureIndex: null,
      staff: null,
    };


    // Notify UI about mode change
    if (this.onTupletModeChange) {
      this.onTupletModeChange(null);
    }
  }

  /**
   * Remove tuplet attributes from partially-added notes
   */
  removePartialTuplet() {
    if (!this.tupletInsertProgress.notes.length) return;

    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    const { measureIndex, staff, notes } = this.tupletInsertProgress;
    const measure = compositionState.measures[measureIndex];
    if (!measure) return;

    const voice = this.getVoice(measure, staff);

    if (!voice) return;

    // Remove tuplet attributes from each partially-added note
    for (const noteInfo of notes) {
      const noteData = voice.notes[noteInfo.noteIndex];
      if (noteData && noteData.tuplet) {
        delete noteData.tuplet;
        // Revert duration to base duration
        if (noteData.duration && (noteData.duration.includes('t') || noteData.duration.includes('q') || noteData.duration.includes('x'))) {
          // Remove tuplet suffix
          noteData.duration = noteData.duration.replace(/[tqx]$/, '') + 'n';
        }
      }
    }

    // Re-render
    this.composerIntegration.render(true);
  }

  /**
   * Apply tuplet attributes to a newly added note (called from note addition flow)
   * @param {number} measureIndex - Measure index
   * @param {string} staff - Staff name
   * @param {number} noteIndex - Note index in voice
   * @param {Object} noteData - The note data object
   * @returns {boolean} - True if tuplet was applied
   */
  applyTupletToNewNote(measureIndex, staff, noteIndex, noteData) {
    if (!this.tupletInsertMode) return false;

    const { groupId, notes, target } = this.tupletInsertProgress;

    // Validate: Must be same measure and staff as previous notes
    if (notes.length > 0) {
      if (measureIndex !== this.tupletInsertProgress.measureIndex ||
          staff !== this.tupletInsertProgress.staff) {
        return false;
      }
    } else {
      // First note - set measure/staff
      this.tupletInsertProgress.measureIndex = measureIndex;
      this.tupletInsertProgress.staff = staff;
    }

    // Apply tuplet attribute
    const isStart = notes.length === 0;
    const isEnd = notes.length === target - 1;
    noteData.tuplet = createTupletAttribute(this.tupletInsertMode, groupId, isStart, isEnd);

    // Convert duration to tuplet duration
    const baseDuration = noteData.duration || this.currentDuration || '8n';
    noteData.duration = getTupletDuration(baseDuration, this.tupletInsertMode);

    // Track this note
    notes.push({ measureIndex, staff, noteIndex });


    // Check if tuplet is complete
    if (notes.length >= target) {

      // Start a new tuplet group for continuous entry
      this.tupletInsertProgress = {
        groupId: generateTupletGroupId(),
        notes: [],
        target: target,
        measureIndex: null,
        staff: null,
      };
    }

    return true;
  }

  /**
   * Apply tuplet attributes to a note data object being added (for insert mode)
   * @param {Object} noteData - The note data object to modify
   * @param {number} measureIndex - Measure index
   * @param {string} staff - Staff name
   * @returns {boolean} - True if tuplet was applied
   */
  applyTupletAttributesToNoteData(noteData, measureIndex, staff) {
    if (!this.tupletInsertMode) return false;

    const { groupId, notes, target } = this.tupletInsertProgress;

    // Validate: Must be same measure and staff as previous notes in this tuplet group
    if (notes.length > 0) {
      if (measureIndex !== this.tupletInsertProgress.measureIndex ||
          staff !== this.tupletInsertProgress.staff) {
        this.exitTupletInsertMode();
        return false;
      }
    } else {
      // First note - set measure/staff
      this.tupletInsertProgress.measureIndex = measureIndex;
      this.tupletInsertProgress.staff = staff;
    }

    // Apply tuplet attribute
    const isStart = notes.length === 0;
    const isEnd = notes.length === target - 1;
    noteData.tuplet = createTupletAttribute(this.tupletInsertMode, groupId, isStart, isEnd);

    // Convert duration to tuplet duration
    const baseDuration = noteData.duration || this.currentDuration || '8n';
    noteData.duration = getTupletDuration(baseDuration, this.tupletInsertMode);

    // Track this note (use a placeholder index - actual index set after addition)
    notes.push({ measureIndex, staff, noteIndex: -1 });


    // Check if tuplet is complete
    if (notes.length >= target) {
      // Start a new tuplet group for continuous entry
      this.tupletInsertProgress = {
        groupId: generateTupletGroupId(),
        notes: [],
        target: target,
        measureIndex: null,
        staff: null,
      };
    }

    return true;
  }

  // ============================================================================
  // ACCIDENTALS
  // ============================================================================

  /**
   * Change accidental on all selected notes (supports per-pitch accidentals in chords)
   * @param {string} accidental - Accidental ('#', 'b', 'n', or null)
   */
  changeAccidentalOnSelected(accidental) {
    if (this.selectedNotes.size === 0) return;

    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    let changedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, noteIndex, pitchIndex] = this.parseNoteId(noteId);

      // Update compositionState directly
      if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState && compositionState.measures[measureIndex]) {
          const measure = compositionState.measures[measureIndex];
          const voice = this.getVoice(measure, staff);
          if (voice && voice.notes[noteIndex]) {
            const note = voice.notes[noteIndex];
            // Only apply to notes, not rests
            if (!note.isRest) {
              if (pitchIndex !== null && note.pitches && note.pitches.length > 1) {
                // Pitch-specific accidental for chord
                // Initialize accidentals array if needed
                if (!note.accidentals) {
                  note.accidentals = new Array(note.pitches.length).fill(null);
                }
                // Ensure array is correct length
                while (note.accidentals.length < note.pitches.length) {
                  note.accidentals.push(null);
                }
                note.accidentals[pitchIndex] = accidental;
                changedCount++;
              } else {
                // Single note or whole chord accidental
                note.accidental = accidental;
                changedCount++;
              }
            }
          }
        }
      }
    }

    if (changedCount > 0) {
      const compositionState = window.getCompositionState?.();

      // Sync treble changes to block sequence (if using treble block sequence)
      if (compositionState?.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
      }

      // Save bass edits to preserve the entire building block
      for (const noteId of this.selectedNotes) {
        const [measureIndex, staff, voiceIndex] = this.parseNoteId(noteId);
        if (staff === 'bass' && compositionState) {
          const measure = compositionState.measures[measureIndex];
          if (measure && measure.notation?.bass) {
            measure.notation.bass.autoGenerated = false;
            compositionState.saveEditedBassNotesForMeasure(measureIndex);
          }
        }
      }

      // Force a complete re-render from scratch
      this.composerIntegration.render(true);
      // Also refresh the overlay after a brief delay to ensure noteRegions are updated
      setTimeout(() => {
        this.renderOverlay();
      }, 50);
    }
  }

  // ============================================================================
  // NOTE ID UTILITIES
  // ============================================================================

  /**
   * Parse note ID into components (instance method returning array)
   * Format: measureIndex-staff-voiceIndex-noteIndex[-pitchIndex]
   * Legacy format (without voiceIndex): measureIndex-staff-noteIndex[-pitchIndex]
   * Note: Uses the static parseNoteId for actual parsing
   */
  parseNoteId(noteId) {
    const { measureIndex, staff, voiceIndex, noteIndex, pitchIndex } = NoteEditor.parseNoteId(noteId);
    return [measureIndex, staff, voiceIndex, noteIndex, pitchIndex];
  }

  /**
   * Create note ID from location
   * @param {number} measureIndex - Measure index
   * @param {string} staff - Staff name
   * @param {number} voiceIndex - Voice index (default 0)
   * @param {number} noteIndex - Note index
   * @param {number|null} pitchIndex - Optional pitch index for chords
   * @returns {string} - Note ID
   */
  createNoteId(measureIndex, staff, voiceIndex, noteIndex, pitchIndex = null) {
    // Encode negative noteIndex with 'n' prefix to avoid double-dash parsing issues
    // e.g., -1 becomes "n1", -2 becomes "n2"
    const encodedNoteIndex = noteIndex < 0 ? `n${Math.abs(noteIndex)}` : noteIndex;
    const baseId = `${measureIndex}-${staff}-${voiceIndex}-${encodedNoteIndex}`;
    return pitchIndex !== null ? `${baseId}-${pitchIndex}` : baseId;
  }

  /**
   * Parse a note ID string into its component parts
   * Handles both regular noteIndex (e.g., "0-treble-0-3") and
   * negative noteIndex encoded with 'n' prefix (e.g., "0-treble-0-n1" for noteIndex=-1)
   * @param {string} noteId - Note ID string
   * @returns {object} - { measureIndex, staff, voiceIndex, noteIndex, pitchIndex }
   */
  static parseNoteId(noteId) {
    const parts = noteId.split('-');
    const measureIndex = parseInt(parts[0]);
    const staff = parts[1];
    const voiceIndex = parseInt(parts[2]) || 0;

    // Handle negative noteIndex encoded as 'n' prefix (e.g., "n1" means -1)
    let noteIndex;
    const noteIndexPart = parts[3];
    if (noteIndexPart && noteIndexPart.startsWith('n')) {
      noteIndex = -parseInt(noteIndexPart.substring(1));
    } else {
      noteIndex = parseInt(noteIndexPart);
      // Fallback for legacy 3-part IDs where noteIndex was at position 2
      if (isNaN(noteIndex)) {
        noteIndex = parseInt(parts[2]);
      }
    }

    // Handle pitchIndex - may also have 'n' prefix if negative
    let pitchIndex = null;
    if (parts.length > 4) {
      const pitchPart = parts[4];
      if (pitchPart && pitchPart.startsWith('n')) {
        pitchIndex = -parseInt(pitchPart.substring(1));
      } else {
        pitchIndex = parseInt(pitchPart);
      }
    }

    return { measureIndex, staff, voiceIndex, noteIndex, pitchIndex };
  }

  /**
   * Get the base note ID (without pitch index) from a potentially pitch-specific ID
   * New format: measureIndex-staff-voiceIndex-noteIndex[-pitchIndex] -> measureIndex-staff-voiceIndex-noteIndex
   * Legacy format: measureIndex-staff-noteIndex[-pitchIndex] -> measureIndex-staff-0-noteIndex (normalized)
   * @param {string} noteId - Note ID
   * @returns {string} - Base note ID (measureIndex-staff-voiceIndex-noteIndex)
   */
  getBaseNoteId(noteId) {
    // Use the static parser and recreate the base ID
    const { measureIndex, staff, voiceIndex, noteIndex } = NoteEditor.parseNoteId(noteId);
    return this.createNoteId(measureIndex, staff, voiceIndex, noteIndex);
  }

  /**
   * Check if a note ID refers to a specific pitch within a chord
   * @param {string} noteId - Note ID
   * @returns {boolean} - True if ID includes pitch index
   */
  hasPitchIndex(noteId) {
    const { pitchIndex } = NoteEditor.parseNoteId(noteId);
    return pitchIndex !== null && !isNaN(pitchIndex);
  }

  /**
   * Calculate the bounding box for a specific pitch within a chord
   * @param {Object} region - Note region with bounds and pitches
   * @param {number} pitchIndex - Index of the pitch to highlight
   * @returns {Object} - {x, y, width, height} for the specific pitch
   */
  getPitchBounds(region, pitchIndex) {
    if (!region || !region.bounds || !region.pitches || region.pitches.length <= 1) {
      // Not a chord or no valid data - return whole bounds
      return region?.bounds || null;
    }

    const { x, y, width, height } = region.bounds;
    const numPitches = region.pitches.length;

    // Sort pitches by MIDI value (low to high) to match click zone logic
    const sortedPitches = region.pitches.map((p, idx) => ({
      pitch: p,
      originalIndex: idx,
      midi: noteToMidi(p)
    })).sort((a, b) => a.midi - b.midi);

    // Find which sorted position our pitchIndex corresponds to
    const sortedPosition = sortedPitches.findIndex(p => p.originalIndex === pitchIndex);
    if (sortedPosition === -1) {
      return region.bounds; // Fallback
    }

    // On staff: higher Y = lower pitch, lower Y = higher pitch
    // sortedPosition 0 = lowest pitch = bottom of chord (highest Y)
    // sortedPosition n-1 = highest pitch = top of chord (lowest Y)
    const pitchZoneHeight = height / numPitches;

    // Calculate Y position for this pitch
    // Highest pitch (last in sorted) is at top (y), lowest pitch (first in sorted) is at bottom (y + height - pitchZoneHeight)
    const pitchY = y + (numPitches - 1 - sortedPosition) * pitchZoneHeight;

    return {
      x: x,
      y: pitchY,
      width: width,
      height: pitchZoneHeight
    };
  }

  // ============================================================================
  // SELECTION
  // ============================================================================

  /**
   * Get selected notes as structured objects
   * @returns {Array<{noteId: string, staff: string, measureIndex: number, voiceIndex: number, noteIndex: number, beat: number, pitches: string[], isRest: boolean}>}
   */
  getSelectedNotes() {
    const result = [];
    const compositionState = window.getCompositionState?.();

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);

      // Get the beat position and pitch from the actual note
      let beat = 0;
      let pitches = [];
      let isRest = false;
      if (compositionState?.measures?.[measureIndex]) {
        const measure = compositionState.measures[measureIndex];
        const voiceKey = staff === 'treble' ? 'treble' : 'bass';
        const voice = measure.notation?.[voiceKey]?.voices?.[voiceIndex];
        const note = voice?.notes?.[noteIndex];
        if (note) {
          beat = note.beat || 0;
          pitches = note.pitches || [];
          isRest = note.isRest || false;
        }
      }

      result.push({
        noteId,
        staff,
        measureIndex,
        voiceIndex,
        noteIndex,
        beat,
        pitches,
        isRest
      });
    }

    return result;
  }

  /**
   * Select a note
   * @param {string} noteId - Note ID
   */
  selectNote(noteId) {
    this.selectedNotes.add(noteId);
    this.hideSelectionHighlight = false; // Show highlight when selecting
    this.onNoteSelect(Array.from(this.selectedNotes));
    this.renderOverlay();

    // Update the active staff and bass block based on the selected note
    this._updateEditingStateFromSelection(noteId);

    // Dispatch event for tutorial validation
    dispatchBuilderEvent('notationNoteSelected', { noteId, selectedNotes: Array.from(this.selectedNotes) });
  }

  /**
   * Update the editing state (active staff and bass block) based on a selected note
   * @param {string} noteId - Note ID (e.g., "0-bass-0-1")
   * @private
   */
  _updateEditingStateFromSelection(noteId) {
    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    // Parse the note ID to get measure, staff, voice, note indices
    const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);

    // Update the active staff in compositionState
    compositionState.setActiveStaff(staff);

    // Also update the toolbar staff selection mode to match the selected note's staff
    // This provides intuitive UX: selecting a treble note switches to treble mode, etc.
    if (this.composerIntegration?.toolbar) {
      const currentMode = this.composerIntegration.toolbar.getStaffSelectionMode?.();
      // Only switch if we're in a forced mode (treble/bass) and selected a note from different staff
      // In auto mode, we don't force a switch
      if (currentMode !== 'auto' && currentMode !== staff) {
        this.composerIntegration.toolbar.setStaffSelectionMode(staff);
      } else {
        // Still refresh the context to show updated info
        this.composerIntegration.toolbar.refreshEditingContext?.();
      }
    }

    // If it's a bass note, update the active bass block
    if (staff === 'bass') {
      // Get the note's beat position to determine which block it belongs to
      const measure = compositionState.measures?.[measureIndex];
      const voice = measure?.notation?.bass?.voices?.[voiceIndex];
      const note = voice?.notes?.[noteIndex];

      if (note !== undefined) {
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(
          compositionState.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE
        );
        const absoluteBeat = measureIndex * beatsPerMeasure + (note.beat || 0);
        compositionState.updateActiveBassBlockFromBeat(absoluteBeat);
      }
    } else {
      // Treble note selected - clear the active bass block
      compositionState.setActiveBassBlockIndex(null);
    }
  }

  /**
   * Toggle note selection
   * @param {string} noteId - Note ID
   */
  toggleNoteSelection(noteId) {
    if (this.selectedNotes.has(noteId)) {
      this.selectedNotes.delete(noteId);
    } else {
      this.selectedNotes.add(noteId);
    }
    this.hideSelectionHighlight = false; // Show highlight when toggling
    this.onNoteSelect(Array.from(this.selectedNotes));
    this.renderOverlay();

    // Update editing state if we're adding a note
    if (this.selectedNotes.has(noteId)) {
      this._updateEditingStateFromSelection(noteId);
    } else if (this.selectedNotes.size === 0) {
      // All notes deselected - clear active bass block
      const compositionState = window.getCompositionState?.();
      compositionState?.setActiveBassBlockIndex(null);
    }

    // Dispatch event for tutorial validation
    dispatchBuilderEvent('notationNoteSelected', { noteId, selectedNotes: Array.from(this.selectedNotes) });
  }

  /**
   * Clear selection
   */
  clearSelection() {
    this.selectedNotes.clear();
    // Also clear auto-generated rest info since those selections are no longer valid
    if (this.autoGeneratedRestInfo) {
      this.autoGeneratedRestInfo.clear();
    }
    this.onNoteSelect([]);
    this.renderOverlay();

    // Clear the active bass block when selection is cleared
    const compositionState = window.getCompositionState?.();
    compositionState?.setActiveBassBlockIndex(null);
  }

  /**
   * Get info about an auto-generated rest by its noteId
   * @param {string} noteId - Note ID
   * @returns {object|null} - { measureIndex, staff, voiceIndex, beat, duration } or null if not found
   */
  getAutoGeneratedRestInfo(noteId) {
    if (!this.autoGeneratedRestInfo) return null;
    return this.autoGeneratedRestInfo.get(noteId) || null;
  }

  /**
   * Select all notes
   */
  selectAll() {
    // This would need to iterate through all notes
    // For now, just trigger the callback
    this.onNoteSelect(['all']);
  }

  // ============================================================================
  // DRAG OPERATIONS
  // ============================================================================

  /**
   * Start dragging selected notes
   * @param {Object} position - Mouse position
   * @param {Object} staffPosition - Staff position
   */
  startDrag(position, staffPosition) {
    this.state = EDITOR_STATES.DRAGGING;
    this.dragStartPosition = staffPosition;
    this.dragCurrentPosition = staffPosition;

    // Store initial positions of dragged notes
    this.draggedNotes = [];
    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);
      this.draggedNotes.push({
        noteId,
        measureIndex,
        staff,
        noteIndex,
        startPitch: null, // Would get from actual note data
      });
    }
  }

  /**
   * Update drag preview
   */
  updateDragPreview() {
    // Calculate pitch difference from start to current
    if (!this.dragStartPosition || !this.dragCurrentPosition) return;

    const startLine = this.dragStartPosition.line || 0;
    const currentLine = this.dragCurrentPosition.line || 0;
    const lineDelta = currentLine - startLine;

    // Update preview positions (this would update visual feedback)
  }

  /**
   * End drag operation
   */
  endDrag() {
    if (!this.dragStartPosition || !this.dragCurrentPosition) {
      this.cancelDrag();
      return;
    }

    // Calculate final pitch changes
    const startLine = this.dragStartPosition.line || 0;
    const currentLine = this.dragCurrentPosition.line || 0;
    const steps = currentLine - startLine;

    if (steps !== 0) {
      this.moveSelectedNotes(steps);
    }

    this.dragStartPosition = null;
    this.dragCurrentPosition = null;
    this.draggedNotes = [];
    this.state = EDITOR_STATES.IDLE;
  }

  /**
   * Cancel drag operation
   */
  cancelDrag() {
    this.dragStartPosition = null;
    this.dragCurrentPosition = null;
    this.draggedNotes = [];
    this.state = EDITOR_STATES.IDLE;
    this.renderOverlay();
  }

  // ============================================================================
  // BEAT CALCULATION & VALIDATION
  // ============================================================================

  /**
   * Convert duration string to beats (quarter notes) - with tuplet and dotted support
   * @param {string} duration - Duration like "4n", "2n", "8n", "8t" (triplet), "2n." (dotted), etc.
   * @returns {number} - Number of beats
   */
  durationToBeats(duration, dotted = false) {
    const durationMap = {
      '1n': 4,    // Whole note = 4 beats
      '2n': 2,    // Half note = 2 beats
      '4n': 1,    // Quarter note = 1 beat
      '8n': 0.5,  // Eighth note = 0.5 beats
      '16n': 0.25, // Sixteenth note = 0.25 beats
      '32n': 0.125, // Thirty-second note = 0.125 beats
    };

    // Tuplet ratios
    const tupletRatios = {
      triplet: { actual: 3, normal: 2 },
      quintuplet: { actual: 5, normal: 4 },
      sextuplet: { actual: 6, normal: 4 },
    };

    let baseDuration = duration;
    let tupletType = null;
    // Check both: dot in string OR separate dotted parameter (canonical format)
    let isDotted = dotted;

    if (duration && typeof duration === 'string') {
      // Check for dotted notation in string (e.g., '2n.' -> '2n' + dotted)
      if (duration.includes('.')) {
        baseDuration = duration.replace('.', '');
        isDotted = true;
      }

      // Check for tuplet duration suffix
      if (baseDuration.endsWith('t') && /^\d+t$/.test(baseDuration)) {
        baseDuration = baseDuration.replace('t', 'n');
        tupletType = 'triplet';
      } else if (baseDuration.endsWith('q') && /^\d+q$/.test(baseDuration)) {
        baseDuration = baseDuration.replace('q', 'n');
        tupletType = 'quintuplet';
      } else if (baseDuration.endsWith('x') && /^\d+x$/.test(baseDuration)) {
        baseDuration = baseDuration.replace('x', 'n');
        tupletType = 'sextuplet';
      }
    }

    let beats = durationMap[baseDuration] || 1;

    // Apply tuplet ratio if this is a tuplet note
    if (tupletType && tupletRatios[tupletType]) {
      const ratio = tupletRatios[tupletType];
      beats = beats * (ratio.normal / ratio.actual);
    }

    // Apply dotted multiplier if duration string had a dot OR separate dotted flag
    if (isDotted) {
      beats *= 1.5;
    }

    return beats;
  }

  /**
   * Calculate total beats used in a measure
   * Uses compositionState as the source of truth (more accurate than noteRegions)
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @returns {number} - Total beats used
   */
  getMeasureBeatsUsed(measureIndex, staff) {
    // Try to get accurate data from compositionState first
    if (window.getCompositionState) {
      const compositionState = window.getCompositionState();
      if (compositionState && compositionState.measures && compositionState.measures[measureIndex]) {
        const measure = compositionState.measures[measureIndex];
        // MULTI-VOICE: Use current voice, not always voice 0
        const voice = this.getVoice(measure, staff);

        if (voice && voice.notes) {
          let usedBeats = 0;
          for (const note of voice.notes) {
            let beats = this.durationToBeats(note.duration || '4n', note.dotted);
            // Account for tuplet notes (e.g., triplet quarter notes take 0.667 beats, not 1)
            if (note.tuplet && note.tuplet.type && TUPLET_RATIOS[note.tuplet.type]) {
              const ratio = TUPLET_RATIOS[note.tuplet.type];
              beats = beats * (ratio.normal / ratio.actual);
            }
            usedBeats += beats;
          }
          return usedBeats;
        }
      }
    }

    // Fallback to noteRegions if compositionState not available
    if (!this.noteRegions) return 0;

    const notesInMeasure = this.noteRegions.filter(
      r => r.measureIndex === measureIndex && r.staff === staff
    );

    // Calculate total beats from note durations
    // noteRegions should have duration info attached during rendering
    return notesInMeasure.reduce((total, region) => {
      let beats = this.durationToBeats(region.duration || '4n', region.dotted);
      return total + beats;
    }, 0);
  }

  /**
   * Get beats per measure from current time signature
   * @returns {number} - Beats per measure (normalized to quarter-note beats)
   */
  getBeatsPerMeasure() {
    const compositionState = window.getCompositionState?.();
    const ts = compositionState?.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE;
    return ts.num * (4 / ts.denom); // e.g., 6/8 = 3, 4/4 = 4, 3/4 = 3
  }

  /**
   * Check if a note can be added to a measure without exceeding beat limit
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {string} duration - Note duration to add
   * @param {boolean} isDotted - Whether note is dotted
   * @returns {boolean} - True if note can be added
   */
  canAddNoteToBeat(measureIndex, staff, duration, isDotted) {
    // Get time signature from compositionState
    const maxBeats = this.getBeatsPerMeasure();

    // Calculate current beats used
    const currentBeats = this.getMeasureBeatsUsed(measureIndex, staff);

    // Calculate new note beats
    let newBeats = this.durationToBeats(duration);
    if (isDotted) {
      newBeats *= 1.5;
    }

    // Check if adding would exceed limit
    const totalBeats = currentBeats + newBeats;
    return totalBeats <= maxBeats;
  }

  /**
   * Get remaining beats in a measure
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @returns {number} - Remaining beats
   */
  getRemainingBeats(measureIndex, staff) {
    const maxBeats = this.getBeatsPerMeasure();
    const usedBeats = this.getMeasureBeatsUsed(measureIndex, staff);
    return maxBeats - usedBeats;
  }

  /**
   * Get current beat position in a measure (where next note would be added)
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @returns {number} - Beat position (0 to beatsPerMeasure)
   */
  getCurrentBeat(measureIndex, staff) {
    return this.getBeatsPerMeasure() - this.getRemainingBeats(measureIndex, staff);
  }

  /**
   * Convert beats to closest duration string
   * @param {number} beats - Number of beats
   * @returns {Object} - {duration, dotted}
   */
  beatsToDuration(beats) {
    // Map beats to durations (with dotted variants)
    const durationMap = [
      { beats: 4, duration: '1n', dotted: false },
      { beats: 3, duration: '2n', dotted: true },
      { beats: 2, duration: '2n', dotted: false },
      { beats: 1.5, duration: '4n', dotted: true },
      { beats: 1, duration: '4n', dotted: false },
      { beats: 0.75, duration: '8n', dotted: true },
      { beats: 0.5, duration: '8n', dotted: false },
      { beats: 0.375, duration: '16n', dotted: true },
      { beats: 0.25, duration: '16n', dotted: false },
      { beats: 0.125, duration: '32n', dotted: false },
    ];

    // Find exact match or closest smaller duration
    for (const entry of durationMap) {
      if (Math.abs(entry.beats - beats) < 0.001) {
        return { duration: entry.duration, dotted: entry.dotted };
      }
    }

    // If no exact match, return closest smaller
    for (const entry of durationMap) {
      if (entry.beats <= beats) {
        return { duration: entry.duration, dotted: entry.dotted };
      }
    }

    // Fallback
    return { duration: '4n', dotted: false };
  }

  /**
   * Convert duration to beats (with tuplet support)
   * Note: This is a duplicate method - the primary one is at line ~2628
   * @param {string} duration - Duration like '4n', '8n', '8t' (triplet), '2n.' (dotted), etc.
   * @param {boolean} dotted - Whether the note is dotted
   * @returns {number} - Number of beats
   */
  durationToBeats(duration, dotted = false) {
    const baseDurations = {
      '1n': 4,
      '2n': 2,
      '4n': 1,
      '8n': 0.5,
      '16n': 0.25,
      '32n': 0.125,
    };

    // Tuplet ratios - actual notes in time of normal
    const tupletRatios = {
      triplet: { actual: 3, normal: 2 },
      quintuplet: { actual: 5, normal: 4 },
      sextuplet: { actual: 6, normal: 4 },
    };

    let baseDuration = duration;
    let tupletType = null;
    let dottedFromString = false;

    if (duration && typeof duration === 'string') {
      // Check for dotted notation in string (e.g., '2n.' -> '2n' + dotted)
      // IMPORTANT: Strip the dot FIRST before checking tuplet suffixes
      if (duration.includes('.')) {
        baseDuration = duration.replace('.', '');
        dottedFromString = true;
      }

      // Check for tuplet duration suffix
      if (baseDuration.endsWith('t') && /^\d+t$/.test(baseDuration)) {
        baseDuration = baseDuration.replace('t', 'n');
        tupletType = 'triplet';
      } else if (baseDuration.endsWith('q') && /^\d+q$/.test(baseDuration)) {
        baseDuration = baseDuration.replace('q', 'n');
        tupletType = 'quintuplet';
      } else if (baseDuration.endsWith('x') && /^\d+x$/.test(baseDuration)) {
        baseDuration = baseDuration.replace('x', 'n');
        tupletType = 'sextuplet';
      }
    }

    let beats = baseDurations[baseDuration] || 1;

    // Apply tuplet ratio if this is a tuplet note
    if (tupletType && tupletRatios[tupletType]) {
      const ratio = tupletRatios[tupletType];
      beats = beats * (ratio.normal / ratio.actual);
    }

    // Apply dotted multiplier - use dottedFromString OR dotted parameter
    // but NOT both (avoid double-counting)
    if (dottedFromString || dotted) {
      beats *= 1.5;
    }
    return beats;
  }

  /**
   * Get building block info for a bass note position
   * Returns the chord segment (building block) boundaries for the given measure and beat
   * @param {number} measureIndex - Measure index
   * @param {number} beatInMeasure - Beat position within the measure
   * @returns {Object|null} - { segment, absoluteBeat, remainingBeatsInBlock, usedBeatsInBlock }
   */
  getBuildingBlockInfo(measureIndex, beatInMeasure = 0) {
    const compositionState = window.getCompositionState?.();
    if (!compositionState) return null;

    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);

    // Calculate absolute beat position
    const absoluteBeat = (measureIndex * beatsPerMeasure) + beatInMeasure;

    // Get the chord segment for this beat
    const segment = compositionState.getChordSegmentForBeat(absoluteBeat);
    if (!segment) return null;

    // Calculate remaining beats in this building block from the current position
    const segmentEndBeat = segment.startBeat + segment.durationBeats;
    const remainingBeatsInBlock = segmentEndBeat - absoluteBeat;

    // Calculate how many beats are used in this building block before this position
    const usedBeatsInBlock = absoluteBeat - segment.startBeat;

    return {
      segment,
      absoluteBeat,
      remainingBeatsInBlock,
      usedBeatsInBlock,
      segmentStartBeat: segment.startBeat,
      segmentEndBeat,
      segmentDurationBeats: segment.durationBeats,
      chordIndex: segment.chordIndex,
    };
  }

  /**
   * Get total used beats in a building block (chord segment) for bass
   * MULTI-VOICE: Only counts beats for the current voice, allowing independent voice editing
   * @param {Object} segment - The chord segment
   * @returns {number} - Total beats used by existing bass notes in this segment for the current voice
   */
  getUsedBeatsInBuildingBlock(segment) {
    const compositionState = window.getCompositionState?.();
    if (!compositionState || !segment) return 0;

    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);
    const startMeasure = Math.floor(segment.startBeat / beatsPerMeasure);
    const endMeasure = Math.ceil((segment.startBeat + segment.durationBeats) / beatsPerMeasure) - 1;

    // MULTI-VOICE: Get the current bass voice index
    const currentVoiceIndex = this.getVoiceIndexForStaff('bass');

    let usedBeats = 0;

    // Sum up bass notes across all measures that this segment spans (for CURRENT VOICE only)
    for (let m = startMeasure; m <= endMeasure && m < compositionState.getMeasureCount(); m++) {
      const measure = compositionState.getMeasure(m);
      if (!measure?.notation?.bass?.voices) continue;

      const measureStartBeat = m * beatsPerMeasure;
      const measureEndBeat = (m + 1) * beatsPerMeasure;

      // Calculate the overlap between this measure and the segment
      const overlapStart = Math.max(measureStartBeat, segment.startBeat);
      const overlapEnd = Math.min(measureEndBeat, segment.startBeat + segment.durationBeats);

      // MULTI-VOICE: Only count notes from the current voice, not all voices
      const voice = measure.notation.bass.voices[currentVoiceIndex];
      if (!voice?.notes) continue;

      for (const note of voice.notes) {
        const noteBeat = (note.beat || 0) + measureStartBeat;
        // Only count notes that fall within this segment's beat range
        if (noteBeat >= overlapStart && noteBeat < overlapEnd) {
          let noteBeats = this.durationToBeats(note.duration || '4n', note.dotted);
          // Account for tuplet notes (e.g., triplet quarter notes take 0.667 beats, not 1)
          if (note.tuplet && note.tuplet.type && TUPLET_RATIOS[note.tuplet.type]) {
            const ratio = TUPLET_RATIOS[note.tuplet.type];
            noteBeats = noteBeats * (ratio.normal / ratio.actual);
          }
          usedBeats += noteBeats;
        }
      }
    }

    return usedBeats;
  }

  // ============================================================================
  // GHOST NOTE PREVIEW
  // ============================================================================

  /**
   * Update ghost note preview
   * @param {Object} staffPosition - Staff position
   * @param {number} mouseX - Mouse X coordinate for positioning
   * @param {number} mouseY - Mouse Y coordinate for positioning
   */
  updateGhostNote(staffPosition, mouseX, mouseY) {
    if (!staffPosition || !staffPosition.pitch || !staffPosition.staff) {
      this.ghostNote = null;
      return;
    }

    // IMPORTANT: Query the toolbar directly to ensure we have the current state
    // This avoids sync issues between toolbar and noteEditor
    const isRestFromToolbar = window.getCurrentNoteIsRest ? window.getCurrentNoteIsRest() : this.isRestMode;
    const dottedFromToolbar = window.getCurrentNoteDotted ? window.getCurrentNoteDotted() : this.isDotted;
    let durationFromToolbar = window.getCurrentNoteDuration ? window.getCurrentNoteDuration() : this.currentDuration;
    // Duration from toolbar may have dotted suffix, strip it
    durationFromToolbar = durationFromToolbar.replace('.', '');

    // Apply key signature to pitch when no explicit accidental is selected
    const ghostCompositionState = window.getCompositionState?.();
    const effectivePitch = this.getEffectivePitch(staffPosition.pitch, ghostCompositionState);

    // Create ghost note data
    this.ghostNote = {
      pitch: effectivePitch,
      staff: staffPosition.staff,
      measure: staffPosition.measure,
      duration: durationFromToolbar,
      dotted: dottedFromToolbar,
      isRest: isRestFromToolbar,
      mouseX: mouseX, // Store mouse X for accurate positioning
      mouseY: mouseY, // Store mouse Y for accurate positioning
    };

    // Get harmonic coloring based on the hovered measure's chord
    // staffPosition.measure is the measureBounds object, use .index to get measure number
    const measureIndex = staffPosition.measure?.index;
    if (!isRestFromToolbar && measureIndex !== undefined) {
      // Get chord for the current measure being hovered
      const compositionState = ghostCompositionState;
      const chord = compositionState?.getChord?.(measureIndex) || this.chordContext;
      const key = compositionState?.metadata?.key || this.keySignature || 'C';

      if (chord) {
        const analysis = analyzeChordTone(
          effectivePitch,
          chord,
          key
        );
        if (analysis) {
          this.ghostNote.color = analysis.colors.fill;
          this.ghostNote.tooltip = analysis.tooltip;
          this.ghostNote.toneType = analysis.relationship; // e.g., 'root', 'third', 'scaleTone', etc.
        }
      }
    }
  }

  // REMOVED: Hover toolbar - now using contextual top toolbar instead
  // isPositionInToolbar(position) {
  //   return false; // Always return false - toolbar is removed
  // }

  // REMOVED: Hover toolbar - now using contextual top toolbar instead
  // /**
  //  * Update hover toolbar when Shift is held over selected notes
  //  * @param {Object} position - Canvas position {x, y}
  //  */
  // updateHoverToolbar(position) {
  //   // This method has been removed - we now use the contextual top toolbar
  // }

  // ============================================================================
  // OVERLAY RENDERING
  // ============================================================================

  /**
   * Render the overlay (selection, ghost notes, etc.)
   * PHASE 1A: Drawing directly on main canvas - triggers full re-render!
   */
  renderOverlay() {
    // PHASE 1A/1.3: For ghost notes and selection on main canvas, trigger full re-render
    // The composer's debouncing (60fps limit) prevents excessive renders

    // Always trigger render in multi-page mode to update/clear highlights properly
    if (this.composerIntegration) {
      this.composerIntegration.render();
      return;
    }

    // Selection highlighting: Only works in legacy single-canvas mode
    // Multi-page mode is handled by composerIntegration calling drawSelectionHighlightsMultiPage
    if (this.overlayCanvas && !this.pageManager) {
      const overlayCtx = this.overlayCanvas.getContext('2d');
      overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
      this.drawSelectionHighlights(overlayCtx);
    }
  }

  /**
   * Draw selection highlights
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  drawSelectionHighlights(ctx) {
    if (!this.noteRegions || this.selectedNotes.size === 0) return;

    // PHASE 1.4: Don't draw highlights if user pressed Esc to hide them
    if (this.hideSelectionHighlight) return;

    ctx.save();
    ctx.strokeStyle = SELECTION_COLORS.selected;
    ctx.lineWidth = 2;
    ctx.fillStyle = SELECTION_COLORS.hover;

    // Get scroll offset to convert layout coordinates → canvas-local coordinates
    const scrollLeft = this.canvas.parentElement ? this.canvas.parentElement.scrollLeft : 0;
    const scrollTop = this.canvas.parentElement ? this.canvas.parentElement.scrollTop : 0;

    // Note head highlight size (ellipse around note head)
    const NOTE_HEAD_RADIUS_X = 8;  // Horizontal radius
    const NOTE_HEAD_RADIUS_Y = 6;  // Vertical radius
    const NOTE_HEAD_X_OFFSET = 5;  // Shift right to center on note head (VexFlow returns left edge)

    // Draw highlight for each selected note
    for (const noteId of this.selectedNotes) {
      // Find the region for this note
      // Handle both regular note IDs (3/4-part legacy) and new IDs (4/5-part with voiceIndex)
      const baseNoteId = this.getBaseNoteId(noteId);
      const region = this.noteRegions.find(r => {
        const regionId = this.createNoteId(r.measureIndex, r.staff, r.voiceIndex || 0, r.noteIndex);
        return regionId === baseNoteId;
      });

      if (region && region.bounds) {
        // Check if this is a pitch-specific selection within a chord
        const [, , , , pitchIndex] = this.parseNoteId(noteId);  // [measureIndex, staff, voiceIndex, noteIndex, pitchIndex]
        const isChord = region.pitches && region.pitches.length > 1;
        const isPitchSpecific = pitchIndex !== null && isChord;

        // Try to use precise note head positions if available
        if (region.noteHeadPositions && region.noteHeadPositions.length > 0) {
          // Get the correct note head position based on pitch index
          let noteHeadIdx = 0;
          if (isPitchSpecific && pitchIndex !== null) {
            // Map pitch index to note head position
            // VexFlow's getYs() returns positions from bottom to top (low to high pitch)
            // Our pitch arrays are in original order, need to find sorted position
            const sortedPitches = region.pitches.map((p, idx) => ({
              pitch: p,
              originalIndex: idx,
              midi: noteToMidi(p)
            })).sort((a, b) => a.midi - b.midi);

            const sortedPosition = sortedPitches.findIndex(p => p.originalIndex === pitchIndex);
            if (sortedPosition !== -1 && sortedPosition < region.noteHeadPositions.length) {
              noteHeadIdx = sortedPosition;
            }
          }

          // Draw ellipse highlight on the specific note head
          if (isPitchSpecific || !isChord) {
            // Single note or specific pitch in chord - highlight just that note head
            const pos = region.noteHeadPositions[noteHeadIdx];
            if (pos) {
              const headX = pos.x + NOTE_HEAD_X_OFFSET - scrollLeft;
              const headY = pos.y - scrollTop;

              ctx.beginPath();
              ctx.ellipse(headX, headY, NOTE_HEAD_RADIUS_X, NOTE_HEAD_RADIUS_Y, 0, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();
            }
          } else {
            // Whole chord selected (no specific pitch) - highlight all note heads
            for (const pos of region.noteHeadPositions) {
              const headX = pos.x + NOTE_HEAD_X_OFFSET - scrollLeft;
              const headY = pos.y - scrollTop;

              ctx.beginPath();
              ctx.ellipse(headX, headY, NOTE_HEAD_RADIUS_X, NOTE_HEAD_RADIUS_Y, 0, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();
            }
          }
        } else {
          // Fall back to bounding box if note head positions not available
          const bounds = isPitchSpecific
            ? this.getPitchBounds(region, pitchIndex)
            : region.bounds;

          if (bounds) {
            const x = bounds.x - scrollLeft;
            const y = bounds.y - scrollTop;
            const { width, height } = bounds;

            ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
            ctx.strokeRect(x - 1, y - 1, width + 2, height + 2);
          }
        }
      }
    }

    ctx.restore();
  }

  /**
   * Draw selection highlights on multi-page layout
   * PHASE 1.3: Note Selection and Editing - Multi-page selection highlighting
   * @param {PageManager} pageManager - Page manager instance
   */
  drawSelectionHighlightsMultiPage(pageManager) {
    if (!this.noteRegions || this.selectedNotes.size === 0 || !pageManager) return;

    // PHASE 1.4: Don't draw highlights if user pressed Esc to hide them
    if (this.hideSelectionHighlight) {
      return;
    }

    // Note head highlight size (ellipse around note head)
    const NOTE_HEAD_RADIUS_X = 8;  // Horizontal radius
    const NOTE_HEAD_RADIUS_Y = 6;  // Vertical radius
    const NOTE_HEAD_X_OFFSET = 5;  // Shift right to center on note head (VexFlow returns left edge)

    // Group selected notes by page (store both noteId and region)
    const notesByPage = new Map();

    for (const noteId of this.selectedNotes) {
      // Find the region for this note
      // Handle both regular note IDs (3/4-part legacy) and new IDs (4/5-part with voiceIndex)
      const baseNoteId = this.getBaseNoteId(noteId);
      const region = this.noteRegions.find(r => {
        const regionId = this.createNoteId(r.measureIndex, r.staff, r.voiceIndex || 0, r.noteIndex);
        return regionId === baseNoteId;
      });

      if (region && region.bounds) {
        // Find which page contains this measure
        const page = pageManager.getPageForMeasure(region.measureIndex);
        if (page) {
          if (!notesByPage.has(page)) {
            notesByPage.set(page, []);
          }
          notesByPage.get(page).push({ noteId, region });
        }
      }
    }

    // Draw highlights on each page
    for (const [page, selections] of notesByPage) {
      const ctx = page.canvas.getContext('2d');

      ctx.save();
      ctx.strokeStyle = SELECTION_COLORS.selected;
      ctx.lineWidth = 2;
      ctx.fillStyle = SELECTION_COLORS.hover;

      // Draw highlight for each selected note on this page
      for (const { noteId, region } of selections) {
        // Check if this is a pitch-specific selection within a chord
        const [, , , , pitchIndex] = this.parseNoteId(noteId);  // [measureIndex, staff, voiceIndex, noteIndex, pitchIndex]
        const isChord = region.pitches && region.pitches.length > 1;
        const isPitchSpecific = pitchIndex !== null && isChord;

        // Try to use precise note head positions if available
        if (region.noteHeadPositions && region.noteHeadPositions.length > 0) {
          // Get the correct note head position based on pitch index
          let noteHeadIdx = 0;
          if (isPitchSpecific && pitchIndex !== null) {
            // Map pitch index to note head position
            // VexFlow's getYs() returns positions from bottom to top (low to high pitch)
            const sortedPitches = region.pitches.map((p, idx) => ({
              pitch: p,
              originalIndex: idx,
              midi: noteToMidi(p)
            })).sort((a, b) => a.midi - b.midi);

            const sortedPosition = sortedPitches.findIndex(p => p.originalIndex === pitchIndex);
            if (sortedPosition !== -1 && sortedPosition < region.noteHeadPositions.length) {
              noteHeadIdx = sortedPosition;
            }
          }

          // Draw ellipse highlight on the specific note head
          if (isPitchSpecific || !isChord) {
            // Single note or specific pitch in chord - highlight just that note head
            const pos = region.noteHeadPositions[noteHeadIdx];
            if (pos) {
              ctx.beginPath();
              ctx.ellipse(pos.x + NOTE_HEAD_X_OFFSET, pos.y, NOTE_HEAD_RADIUS_X, NOTE_HEAD_RADIUS_Y, 0, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();
            }
          } else {
            // Whole chord selected (no specific pitch) - highlight all note heads
            for (const pos of region.noteHeadPositions) {
              ctx.beginPath();
              ctx.ellipse(pos.x + NOTE_HEAD_X_OFFSET, pos.y, NOTE_HEAD_RADIUS_X, NOTE_HEAD_RADIUS_Y, 0, 0, 2 * Math.PI);
              ctx.fill();
              ctx.stroke();
            }
          }
        } else {
          // Fall back to bounding box if note head positions not available
          const bounds = isPitchSpecific
            ? this.getPitchBounds(region, pitchIndex)
            : region.bounds;

          if (bounds) {
            const { x, y, width, height } = bounds;
            ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
            ctx.strokeRect(x - 1, y - 1, width + 2, height + 2);
          }
        }
      }

      ctx.restore();
    }
  }

  /**
   * Draw ghost note preview
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  drawGhostNote(ctx) {
    if (!this.ghostNote || !this.ghostNote.measure) {
      return;
    }

    const bounds = this.ghostNote.measure;

    // PHASE 1A: Drawing on main canvas now - use layout coordinates directly!
    // No scroll offset needed since main canvas uses same coordinate system as VexFlow

    // Calculate note X position (use layout coordinates)
    const noteX = this.ghostNote.mouseX !== undefined
      ? this.ghostNote.mouseX
      : (bounds.x + (bounds.width / 2));

    // CRITICAL: Use actual VexFlow positions if available (nuclear solution)
    let trebleY, bassY;
    const useActualPositions = bounds.actualTrebleY !== undefined && bounds.actualBassY !== undefined;

    if (useActualPositions) {
      // NUCLEAR SOLUTION: Use ACTUAL VexFlow positions directly
      // Main canvas and VexFlow use same layout coordinate system - perfect alignment!
      trebleY = bounds.actualTrebleY;
      bassY = bounds.actualBassY;
    } else {
      // Fallback: calculate positions from measure Y in layout coordinates
      const systemMarginTop = 30; // Match GRAND_STAFF_DEFAULTS
      const staffHeight = 80;
      const staffSpacing = 80;
      trebleY = bounds.y + systemMarginTop;
      bassY = bounds.y + systemMarginTop + staffHeight + staffSpacing;
    }

    // Calculate note Y position from pitch and staff line
    const staffY = this.ghostNote.staff === 'treble' ? trebleY : bassY;
    const pixelsPerStep = 5; // Matches StaffLayouter

    // Convert pitch to line number (reverse of lineToPitch calculation)
    const line = layoutPitchToLine(this.ghostNote.pitch, this.ghostNote.staff);
    const steps = line / 2;

    // staffLayouter formula: relativeY = 80 - (steps * 5)
    const bottomLineY = 80;
    const noteY = staffY + (bottomLineY - steps * pixelsPerStep);

    // Draw ghost note (coordinates are in layout space, same as VexFlow)
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = this.ghostNote.color || SELECTION_COLORS.ghost;
    ctx.strokeStyle = this.ghostNote.color || SELECTION_COLORS.ghost;

    if (this.ghostNote.isRest) {
      // Draw rest symbol
      ctx.font = '20px serif';
      ctx.textAlign = 'center';
      ctx.fillText('𝄽', noteX, noteY + 5);
    } else {
      // Draw note head
      ctx.beginPath();
      ctx.ellipse(noteX, noteY, 6, 4, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw drag preview
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  drawDragPreview(ctx) {
    // This would draw preview of notes being dragged
  }

  // REMOVED: Hover toolbar - now using contextual top toolbar instead
  // /**
  //  * Draw hover toolbar for editing selected notes (Shift+hover)
  //  * @param {CanvasRenderingContext2D} ctx - Canvas context
  //  */
  // drawHoverToolbar(ctx) {
  //   // This method has been removed - we now use the contextual top toolbar
  // }

  // ============================================================================
  // TOOL STATE
  // ============================================================================

  /**
   * Set current duration for new notes
   * @param {string} duration - Duration like '4n', '8n'
   */
  setDuration(duration) {
    this.currentDuration = duration;
  }

  /**
   * Set rest mode
   * @param {boolean} isRest - Whether to insert rests
   */
  setRestMode(isRest) {
    this.isRestMode = isRest;
  }

  /**
   * Set dotted mode
   * @param {boolean} isDotted - Whether to insert dotted notes
   */
  setDotted(isDotted) {
    this.isDotted = isDotted;
  }

  /**
   * Set current accidental
   * @param {string|null} accidental - '#', 'b', 'n', or null
   */
  setAccidental(accidental) {
    this.currentAccidental = accidental;
  }

  /**
   * Get the effective pitch for a diatonic position, applying key signature if no explicit accidental is selected.
   * When currentAccidental is null, the key signature's accidental is applied to the pitch.
   * When currentAccidental is '#', 'b', or 'n', that explicit accidental is used instead.
   * @param {string} diatonicPitch - The diatonic pitch from staff position (e.g., "F4")
   * @param {Object} compositionState - The composition state containing metadata
   * @returns {string} - The pitch with accidental applied (e.g., "F#4" in G major if no accidental selected)
   */
  getEffectivePitch(diatonicPitch, compositionState) {
    const key = compositionState?.metadata?.key || this.keySignature || 'C';

    if (this.currentAccidental === null) {
      // No explicit accidental selected - apply key signature
      return applyKeySignatureToPitch(diatonicPitch, key);
    } else if (this.currentAccidental === 'n') {
      // User explicitly selected natural - keep the diatonic pitch as-is
      return diatonicPitch;
    } else {
      // User explicitly selected sharp or flat - apply it to the pitch
      const match = diatonicPitch.match(/^([A-Ga-g])([#b]?)(\d+)$/);
      if (match) {
        return `${match[1].toUpperCase()}${this.currentAccidental}${match[3]}`;
      }
      return diatonicPitch;
    }
  }

  /**
   * Set current articulation
   * @param {string|null} articulation - 'staccato', 'accent', 'tenuto', 'marcato', or null
   */
  setArticulation(articulation) {
    this.currentArticulation = articulation;
  }

  /**
   * Set current dynamic marking
   * @param {string|null} dynamic - 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz', 'fp', or null
   */
  setDynamic(dynamic) {
    this.currentDynamic = dynamic;
  }

  /**
   * Set current voice for multi-voice editing
   * @param {number} voiceNumber - Voice number (1 or 2)
   */
  setCurrentVoice(voiceNumber) {
    this.currentVoice = Math.max(1, Math.min(2, voiceNumber));
  }

  /**
   * Get current voice index (0-based) for internal use
   * @returns {number} - Voice index (0 or 1)
   */
  getCurrentVoiceIndex() {
    return this.currentVoice - 1;
  }

  /**
   * Set chord context for harmonic coloring
   * @param {Object} chord - Current chord data
   * @param {string} key - Key signature
   */
  setChordContext(chord, key) {
    this.chordContext = chord;
    this.keySignature = key;
  }

  // ============================================================================
  // ENABLE/DISABLE
  // ============================================================================

  /**
   * Enable the editor
   */
  enable() {
    this.isEnabled = true;
  }

  /**
   * Disable the editor
   */
  disable() {
    this.isEnabled = false;
    this.clearSelection();
    this.cancelDrag();
    this.ghostNote = null;
    this.renderOverlay();
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  // ============================================================================
  // COPY / PASTE / OCTAVE SHIFT
  // ============================================================================

  /**
   * Copy selected notes to clipboard
   * Notes are sorted by their position (measure, then beat within measure)
   */
  copySelectedNotes() {
    if (this.selectedNotes.size === 0) {
      return;
    }

    const compositionState = window.getCompositionState?.();
    if (!compositionState) {
      console.warn('[NoteEditor] No composition state available');
      return;
    }

    // Collect selected notes with their full data
    const notesToCopy = [];
    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);
      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      const voice = this.getVoice(measure, staff);
      if (!voice || !voice.notes[noteIndex]) continue;

      const note = voice.notes[noteIndex];
      notesToCopy.push({
        measureIndex,
        staff,
        noteIndex,
        note: JSON.parse(JSON.stringify(note)), // Deep copy
      });
    }

    if (notesToCopy.length === 0) {
      return;
    }

    // Sort by position: first by measure, then by beat
    notesToCopy.sort((a, b) => {
      if (a.measureIndex !== b.measureIndex) {
        return a.measureIndex - b.measureIndex;
      }
      const aBeat = a.note.beat || 0;
      const bBeat = b.note.beat || 0;
      return aBeat - bBeat;
    });

    // Calculate relative beats from the first note
    const firstBeat = notesToCopy[0].note.beat || 0;
    const firstMeasure = notesToCopy[0].measureIndex;
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);

    notesToCopy.forEach(item => {
      const absoluteBeat = (item.measureIndex - firstMeasure) * beatsPerMeasure + (item.note.beat || 0);
      item.relativeBeat = absoluteBeat - firstBeat;
    });

    // Store in clipboard
    this.clipboard = {
      type: 'notes',
      staff: notesToCopy[0].staff, // All notes should be from same staff for now
      data: notesToCopy.map(item => ({
        relativeBeat: item.relativeBeat,
        note: item.note,
      })),
    };


    // Emit event for UI feedback
    if (this.composerIntegration?.events) {
      this.composerIntegration.events.emit('notesCopied', notesToCopy.length);
    }
  }

  /**
   * Copy a complete building block (both treble and bass notes for a chord)
   * @param {number} chordIndex - The chord index to copy, or null to use selected note's chord
   */
  copyBuildingBlock(chordIndex = null) {
    const compositionState = window.getCompositionState?.();
    if (!compositionState) {
      console.warn('[NoteEditor] No composition state available');
      return;
    }

    // If no chord index provided, try to determine from selection
    if (chordIndex === null) {
      if (this.selectedNotes.size === 0) {
        return;
      }

      // Get chord index from first selected note
      const firstNoteId = Array.from(this.selectedNotes)[0];
      const [measureIndex] = this.parseNoteId(firstNoteId);
      const measure = compositionState.measures[measureIndex];
      if (measure && measure.chord) {
        chordIndex = measure.chord.chordIndex;
      } else {
        return;
      }
    }

    const segment = compositionState.getChordSegment?.(chordIndex);
    if (!segment) {
      return;
    }

    // Get the full chord data from the progression (segment.chord may be incomplete)
    let fullChordData = segment.chord ? JSON.parse(JSON.stringify(segment.chord)) : null;

    // Try to get more complete chord info from the progression
    const progressionData = compositionState.exportToProgressionData?.();
    if (progressionData && progressionData[chordIndex]) {
      const progChord = progressionData[chordIndex];
      fullChordData = {
        root: progChord.root,
        type: progChord.type,
        inversion: progChord.inversion || 0,
        duration: progChord.duration || segment.durationBeats,
        ...progChord,
      };
    }

    // Collect all treble and bass notes for this chord
    const trebleNotes = [];
    const bassNotes = [];
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);

    for (let i = 0; i < compositionState.measures.length; i++) {
      const measure = compositionState.measures[i];
      if (!measure) continue;

      // Check treble notes
      const trebleVoice = measure.notation.treble?.voices?.[0];
      if (trebleVoice) {
        for (const note of trebleVoice.notes) {
          const noteChordIndex = note.chordIndex !== undefined ? note.chordIndex : measure.chord?.chordIndex;
          if (noteChordIndex === chordIndex) {
            trebleNotes.push({
              measureIndex: i,
              note: JSON.parse(JSON.stringify(note)),
            });
          }
        }
      }

      // Check bass notes
      const bassVoice = measure.notation.bass?.voices?.[0];
      if (bassVoice) {
        for (const note of bassVoice.notes) {
          const noteChordIndex = note.chordIndex !== undefined ? note.chordIndex : measure.chord?.chordIndex;
          if (noteChordIndex === chordIndex) {
            bassNotes.push({
              measureIndex: i,
              note: JSON.parse(JSON.stringify(note)),
            });
          }
        }
      }
    }

    if (trebleNotes.length === 0 && bassNotes.length === 0) {
      return;
    }

    // Calculate relative positions from the segment start
    const startBeat = segment.startBeat;
    const startMeasure = Math.floor(startBeat / beatsPerMeasure);

    const processNotes = (notes) => {
      return notes.map(item => {
        const absoluteBeat = item.measureIndex * beatsPerMeasure + (item.note.beat || 0);
        const relativeBeat = absoluteBeat - startBeat;
        return {
          relativeBeat,
          note: item.note,
        };
      });
    };

    // Extract the actual bass pitches from the first bass note (for lhNotes)
    // This ensures the building block is initialized with the correct octave
    let bassPitches = [];
    if (bassNotes.length > 0) {
      const firstBassNote = bassNotes[0].note;
      bassPitches = firstBassNote.pitches || (firstBassNote.pitch ? [firstBassNote.pitch] : []);
    }

    // Update fullChordData with the actual bass pitches as lhNotes
    if (bassPitches.length > 0 && fullChordData) {
      fullChordData.lhNotes = bassPitches;
    }

    this.clipboard = {
      type: 'buildingBlock',
      chordData: fullChordData,
      durationBeats: segment.durationBeats,
      trebleNotes: processNotes(trebleNotes),
      bassNotes: processNotes(bassNotes),
      bassPitches: bassPitches, // Store for explicit use when pasting
    };


    if (this.composerIntegration?.events) {
      this.composerIntegration.events.emit('buildingBlockCopied', {
        trebleCount: trebleNotes.length,
        bassCount: bassNotes.length,
      });
    }
  }

  /**
   * Paste notes from clipboard
   * @param {string} position - 'afterSelection', 'beginning', or 'end'
   */
  pasteNotes(position = 'afterSelection') {
    if (!this.clipboard) {
      return;
    }

    // Handle building block paste
    if (this.clipboard.type === 'buildingBlock') {
      this.pasteBuildingBlock(position);
      return;
    }

    if (this.clipboard.type !== 'notes') {
      return;
    }

    const compositionState = window.getCompositionState?.();
    if (!compositionState) {
      console.warn('[NoteEditor] No composition state available');
      return;
    }

    // Calculate paste position
    const pasteInfo = this.calculatePastePosition(position, this.clipboard.staff);
    if (!pasteInfo) return;

    const { startMeasure, startBeat, beatsPerMeasure } = pasteInfo;

    // Calculate total duration of notes being pasted
    let totalPasteBeats = 0;
    for (const item of this.clipboard.data) {
      const noteBeats = this.getDurationInBeats(item.note.duration || '4n', item.note.dotted);
      const endBeat = item.relativeBeat + noteBeats;
      if (endBeat > totalPasteBeats) totalPasteBeats = endBeat;
    }

    // Check if there are existing notes after the paste position
    const hasNotesAfter = this.hasNotesAfterPosition(startMeasure, startBeat, this.clipboard.staff, compositionState);

    if (hasNotesAfter && position !== 'end') {
      // Show dialog asking user what to do
      this.showPasteOptionsDialog(
        () => this.executePasteWithShift(startMeasure, startBeat, totalPasteBeats, this.clipboard.staff),
        () => this.executePasteWithDelete(startMeasure, startBeat, this.clipboard.staff)
      );
    } else {
      // No notes after, just paste directly
      this.executePasteDirectly(startMeasure, startBeat, this.clipboard.staff);
    }
  }

  /**
   * Calculate the paste position based on position type
   */
  calculatePastePosition(position, staff) {
    const compositionState = window.getCompositionState?.();
    if (!compositionState) return null;

    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);
    let startMeasure = 0;
    let startBeat = 0;

    if (position === 'beginning') {
      startMeasure = 0;
      startBeat = 0;
    } else if (position === 'end') {
      const lastMeasureIndex = compositionState.measures.length - 1;
      const lastMeasure = compositionState.measures[lastMeasureIndex];
      if (lastMeasure) {
        const voice = this.getVoice(lastMeasure, staff);
        if (voice && voice.notes.length > 0) {
          const lastNote = voice.notes[voice.notes.length - 1];
          const durationBeats = this.getDurationInBeats(lastNote.duration || '4n', lastNote.dotted);
          startMeasure = lastMeasureIndex;
          startBeat = (lastNote.beat || 0) + durationBeats;

          while (startBeat >= beatsPerMeasure) {
            startBeat -= beatsPerMeasure;
            startMeasure++;
          }
        }
      }
    } else {
      // Paste after selection
      if (this.selectedNotes.size === 0) {
        startMeasure = 0;
        startBeat = 0;
      } else {
        let maxPosition = { measureIndex: -1, beat: -1, duration: '4n' };
        for (const noteId of this.selectedNotes) {
          const [measureIndex, noteStaff, noteIndex] = this.parseNoteId(noteId);
          const measure = compositionState.measures[measureIndex];
          if (!measure) continue;

          const voice = this.getVoice(measure, noteStaff);
          if (!voice || !voice.notes[noteIndex]) continue;

          const note = voice.notes[noteIndex];
          const absoluteBeat = measureIndex * beatsPerMeasure + (note.beat || 0);
          const maxAbsoluteBeat = maxPosition.measureIndex * beatsPerMeasure + maxPosition.beat;

          if (absoluteBeat > maxAbsoluteBeat || maxPosition.measureIndex === -1) {
            maxPosition = { measureIndex, beat: note.beat || 0, duration: note.duration || '4n', dotted: note.dotted };
          }
        }

        if (maxPosition.measureIndex >= 0) {
          const durationBeats = this.getDurationInBeats(maxPosition.duration, maxPosition.dotted);
          startBeat = maxPosition.beat + durationBeats;
          startMeasure = maxPosition.measureIndex;

          while (startBeat >= beatsPerMeasure) {
            startBeat -= beatsPerMeasure;
            startMeasure++;
          }
        }
      }
    }

    return { startMeasure, startBeat, beatsPerMeasure };
  }

  /**
   * Check if there are notes after a given position
   */
  hasNotesAfterPosition(measureIndex, beat, staff, compositionState) {
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);

    for (let m = measureIndex; m < compositionState.measures.length; m++) {
      const measure = compositionState.measures[m];
      if (!measure) continue;

      const voice = staff === 'treble' ? measure.notation.treble?.voices?.[0] : measure.notation.bass?.voices?.[0];
      if (!voice || !voice.notes) continue;

      for (const note of voice.notes) {
        const noteBeat = note.beat || 0;
        if (m === measureIndex && noteBeat >= beat) return true;
        if (m > measureIndex && voice.notes.length > 0) return true;
      }
    }
    return false;
  }

  /**
   * Show dialog asking user whether to shift or delete notes
   */
  showPasteOptionsDialog(onShift, onDelete) {
    // Remove any existing dialog
    const existing = document.getElementById('paste-options-dialog');
    if (existing) existing.remove();

    const dialog = document.createElement('div');
    dialog.id = 'paste-options-dialog';
    dialog.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
    dialog.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">Paste Notes</h3>
        <p class="text-sm text-gray-600 mb-4">There are existing notes after the paste position. What would you like to do?</p>
        <div class="space-y-2">
          <button id="paste-shift-btn" class="w-full px-4 py-3 text-left bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
            <div class="font-medium text-blue-800">Shift existing notes</div>
            <div class="text-xs text-blue-600 mt-1">Move all notes after this position to make room.</div>
          </button>
          <button id="paste-delete-btn" class="w-full px-4 py-3 text-left bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors">
            <div class="font-medium text-red-800">Replace existing notes</div>
            <div class="text-xs text-red-600 mt-1">Delete all notes after this position.</div>
          </button>
        </div>
        <div class="mt-4 flex justify-end">
          <button id="paste-cancel-btn" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    document.getElementById('paste-shift-btn').addEventListener('click', () => {
      dialog.remove();
      onShift();
    });

    document.getElementById('paste-delete-btn').addEventListener('click', () => {
      dialog.remove();
      onDelete();
    });

    document.getElementById('paste-cancel-btn').addEventListener('click', () => {
      dialog.remove();
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.remove();
    });
  }

  /**
   * Execute paste by shifting existing notes forward
   */
  executePasteWithShift(startMeasure, startBeat, shiftBeats, staff) {
    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);

    // Shift all notes after the paste position forward
    this.shiftNotesForward(startMeasure, startBeat, shiftBeats, staff, compositionState, beatsPerMeasure);

    // Now paste the notes
    this.executePasteDirectly(startMeasure, startBeat, staff);
  }

  /**
   * Shift notes forward by a given number of beats
   */
  shiftNotesForward(fromMeasure, fromBeat, shiftBeats, staff, compositionState, beatsPerMeasure) {
    // Collect all notes that need to be shifted from ALL voices
    const notesToShift = [];

    for (let m = fromMeasure; m < compositionState.measures.length; m++) {
      const measure = compositionState.measures[m];
      if (!measure) continue;

      // MULTI-VOICE: Get all voices for the staff
      const voices = staff === 'treble' ? measure.notation.treble?.voices : measure.notation.bass?.voices;
      if (!voices) continue;

      // Iterate through all voices
      voices.forEach((voice, voiceIndex) => {
        if (!voice || !voice.notes) return;

        for (let i = voice.notes.length - 1; i >= 0; i--) {
          const note = voice.notes[i];
          const noteBeat = note.beat || 0;

          // Check if this note should be shifted
          if (m > fromMeasure || (m === fromMeasure && noteBeat >= fromBeat)) {
            notesToShift.push({
              measureIndex: m,
              noteIndex: i,
              voiceIndex: voiceIndex,
              note: JSON.parse(JSON.stringify(note)),
            });
            // Remove from current position
            voice.notes.splice(i, 1);
          }
        }
      });
    }

    // Re-insert notes at shifted positions
    for (const item of notesToShift) {
      const oldAbsoluteBeat = item.measureIndex * beatsPerMeasure + (item.note.beat || 0);
      const newAbsoluteBeat = oldAbsoluteBeat + shiftBeats;
      const newMeasure = Math.floor(newAbsoluteBeat / beatsPerMeasure);
      const newBeat = newAbsoluteBeat % beatsPerMeasure;


      // Add measures if needed (instead of skipping)
      while (newMeasure >= compositionState.measures.length) {
        compositionState.addMeasure({});
      }

      const measure = compositionState.measures[newMeasure];
      if (!measure) continue;

      // MULTI-VOICE: Get the specific voice this note belongs to
      const voices = staff === 'treble' ? measure.notation.treble?.voices : measure.notation.bass?.voices;

      // Ensure voice exists in target measure
      if (!voices) {
        console.warn(`[shiftNotesForward] No voices array in measure ${newMeasure}`);
        continue;
      }
      while (voices.length <= item.voiceIndex) {
        voices.push({ notes: [] });
      }
      const voice = voices[item.voiceIndex];

      // Check if note needs to be split across measure boundary
      const noteDuration = this.getDurationInBeats(item.note.duration || '4n', item.note.dotted);
      const noteEndBeat = newBeat + noteDuration;

      if (noteEndBeat > beatsPerMeasure) {
        // Split note across measure boundary
        const firstPartBeats = beatsPerMeasure - newBeat;
        const secondPartBeats = noteEndBeat - beatsPerMeasure;

        // First part (tied)
        const firstNote = {
          ...item.note,
          beat: newBeat,
          duration: this.beatsToDurationString(firstPartBeats),
          tied: true,
        };
        voice.notes.push(firstNote);

        // Second part in next measure - create measure and voice if needed
        const nextMeasureIndex = newMeasure + 1;
        while (nextMeasureIndex >= compositionState.measures.length) {
          compositionState.addMeasure({});
        }
        const nextMeasure = compositionState.measures[nextMeasureIndex];
        // MULTI-VOICE: Get the same voice index in the next measure
        const nextVoices = staff === 'treble' ? nextMeasure.notation.treble?.voices : nextMeasure.notation.bass?.voices;
        if (nextVoices) {
          while (nextVoices.length <= item.voiceIndex) {
            nextVoices.push({ notes: [] });
          }
          const secondNote = {
            ...item.note,
            beat: 0,
            duration: this.beatsToDurationString(secondPartBeats),
            isTied: true,
          };
          nextVoices[item.voiceIndex].notes.push(secondNote);
        }
      } else {
        // Note fits in measure
        item.note.beat = newBeat;
        voice.notes.push(item.note);
      }

      // Sort notes by beat
      voice.notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));
    }
  }

  /**
   * Clear any notes/rests at a specific beat position that would conflict with a new note
   * @param {Object} voice - The voice object containing notes array
   * @param {number} beat - The beat position to clear
   * @param {number} duration - Duration in beats of the note being inserted
   * @param {number} beatsPerMeasure - Beats per measure for validation
   */
  clearConflictingNotesAtBeat(voice, beat, duration, beatsPerMeasure) {
    if (!voice.notes) return;

    const noteEnd = beat + duration;

    // Remove any notes that overlap with the beat range [beat, beat+duration)
    voice.notes = voice.notes.filter(note => {
      const noteBeat = note.beat || 0;
      const noteDuration = this.getDurationInBeats(note.duration || '4n', note.dotted);
      const noteEndBeat = noteBeat + noteDuration;

      // Check for overlap: notes overlap if their ranges intersect
      const overlaps = noteBeat < noteEnd && noteEndBeat > beat;

      if (overlaps) {
        console.log(`[clearConflictingNotesAtBeat] Removing overlapping note at beat ${noteBeat}, duration ${note.duration}`);
      }

      return !overlaps;
    });
  }

  /**
   * Validate that a measure doesn't exceed beatsPerMeasure
   * @param {Object} measure - The measure object
   * @param {string} staff - 'treble' or 'bass'
   * @param {number} voiceIndex - Voice index
   * @param {number} beatsPerMeasure - Expected beats per measure
   * @param {number} measureIndex - For logging
   * @returns {boolean} - True if valid
   */
  validateMeasureDuration(measure, staff, voiceIndex, beatsPerMeasure, measureIndex) {
    if (!measure) return true;

    const voices = staff === 'treble' ? measure.notation.treble?.voices : measure.notation.bass?.voices;
    if (!voices || !voices[voiceIndex]) return true;

    const notes = voices[voiceIndex].notes || [];
    let maxEndBeat = 0;

    for (const note of notes) {
      const noteBeat = note.beat || 0;
      const noteDuration = this.getDurationInBeats(note.duration || '4n', note.dotted);
      const noteEndBeat = noteBeat + noteDuration;

      if (noteEndBeat > beatsPerMeasure) {
        console.error(`[validateMeasureDuration] VIOLATION: Measure ${measureIndex + 1} has note ending at beat ${noteEndBeat} (max: ${beatsPerMeasure})`);
        return false;
      }

      maxEndBeat = Math.max(maxEndBeat, noteEndBeat);
    }

    return true;
  }

  /**
   * Shift notes backward by a given number of beats (used for shift-delete)
   * Handles merging tied notes that no longer cross measure boundaries
   * and splitting notes that now cross boundaries
   */
  shiftNotesBackward(fromMeasure, fromBeat, shiftBeats, staff, voiceIndex, compositionState, beatsPerMeasure) {
    console.log('[shiftNotesBackward] === Starting shift ===');
    console.log('[shiftNotesBackward] fromMeasure:', fromMeasure + 1, 'fromBeat:', fromBeat, 'shiftBeats:', shiftBeats);

    // Collect all notes that need to be shifted from the specific voice
    const notesToShift = [];

    for (let m = fromMeasure; m < compositionState.measures.length; m++) {
      const measure = compositionState.measures[m];
      if (!measure) continue;

      const voices = staff === 'treble' ? measure.notation.treble?.voices : measure.notation.bass?.voices;
      if (!voices || !voices[voiceIndex]) continue;

      const voice = voices[voiceIndex];
      if (!voice.notes) continue;

      for (let i = voice.notes.length - 1; i >= 0; i--) {
        const note = voice.notes[i];
        const noteBeat = note.beat || 0;

        // Check if this note should be shifted (after the deletion point)
        if (m > fromMeasure || (m === fromMeasure && noteBeat >= fromBeat)) {
          console.log(`[shiftNotesBackward] Collecting note for shift: measure ${m + 1}, beat ${noteBeat}, duration ${note.duration}, pitch ${note.pitch || note.pitches}`);
          notesToShift.push({
            measureIndex: m,
            noteIndex: i,
            voiceIndex: voiceIndex,
            note: JSON.parse(JSON.stringify(note)),
          });
          // Remove from current position
          voice.notes.splice(i, 1);
        }
      }
    }

    console.log('[shiftNotesBackward] Notes collected for shifting:', notesToShift.length);

    // Check if we need to merge tied notes that were split across measures
    // First, identify pairs of tied notes in the collected notes
    const mergedNotes = this.mergeTiedNotes(notesToShift, beatsPerMeasure, shiftBeats);
    console.log('[shiftNotesBackward] After mergeTiedNotes:', mergedNotes.length, 'notes');

    // Re-insert notes at shifted positions
    for (const item of mergedNotes) {
      const oldAbsoluteBeat = item.measureIndex * beatsPerMeasure + (item.note.beat || 0);
      const newAbsoluteBeat = oldAbsoluteBeat - shiftBeats;

      console.log(`[shiftNotesBackward] Processing note: oldAbsoluteBeat=${oldAbsoluteBeat}, newAbsoluteBeat=${newAbsoluteBeat}`);

      // Skip if would go before the start of composition
      if (newAbsoluteBeat < 0) {
        console.log('[shiftNotesBackward] SKIPPING - would be negative beat');
        continue;
      }

      const newMeasure = Math.floor(newAbsoluteBeat / beatsPerMeasure);
      const newBeat = newAbsoluteBeat % beatsPerMeasure;

      console.log(`[shiftNotesBackward] New position: measure ${newMeasure + 1}, beat ${newBeat}`);

      if (newMeasure >= compositionState.measures.length) {
        console.log('[shiftNotesBackward] SKIPPING - measure out of range');
        continue;
      }

      const measure = compositionState.measures[newMeasure];
      if (!measure) continue;

      const voices = staff === 'treble' ? measure.notation.treble?.voices : measure.notation.bass?.voices;
      if (!voices) continue;

      while (voices.length <= voiceIndex) {
        voices.push({ notes: [] });
      }
      const voice = voices[voiceIndex];

      // Check if note needs to be split across measure boundary
      const noteDuration = this.getDurationInBeats(item.note.duration || '4n', item.note.dotted);
      const noteEndBeat = newBeat + noteDuration;

      console.log(`[shiftNotesBackward] Note duration: ${item.note.duration} = ${noteDuration} beats, endBeat: ${noteEndBeat}, beatsPerMeasure: ${beatsPerMeasure}`);

      if (noteEndBeat > beatsPerMeasure) {
        // Split note across measure boundary
        const firstPartBeats = beatsPerMeasure - newBeat;
        const secondPartBeats = noteEndBeat - beatsPerMeasure;

        console.log(`[shiftNotesBackward] SPLITTING: firstPartBeats=${firstPartBeats} -> ${this.beatsToDurationString(firstPartBeats)}, secondPartBeats=${secondPartBeats} -> ${this.beatsToDurationString(secondPartBeats)}`);

        // Check if original note had forward tie (to preserve chain)
        const originalHadForwardTie = item.note.tied === true;
        console.log(`[shiftNotesBackward] SPLIT: originalHadForwardTie=${originalHadForwardTie}, item.note.tied=${item.note.tied}, item.note.isTied=${item.note.isTied}`);

        // First part (tied forward to second part)
        const firstNote = {
          ...item.note,
          beat: newBeat,
          duration: this.beatsToDurationString(firstPartBeats),
          tied: true,  // Always ties forward to the second part
        };
        // Keep isTied if original had it (was tied FROM a previous note)
        // NOTE: Use explicit false instead of delete to survive serialization
        if (!item.note.isTied) {
          firstNote.isTied = false;
        }
        console.log(`[shiftNotesBackward] SPLIT firstNote: beat=${firstNote.beat}, duration=${firstNote.duration}, tied=${firstNote.tied}, isTied=${firstNote.isTied}`);
        // Clear any conflicting notes before inserting
        this.clearConflictingNotesAtBeat(voice, newBeat, firstPartBeats, beatsPerMeasure);
        voice.notes.push(firstNote);

        // Second part in next measure
        const nextMeasureIndex = newMeasure + 1;
        if (nextMeasureIndex < compositionState.measures.length) {
          const nextMeasure = compositionState.measures[nextMeasureIndex];
          const nextVoices = staff === 'treble' ? nextMeasure.notation.treble?.voices : nextMeasure.notation.bass?.voices;
          if (nextVoices) {
            while (nextVoices.length <= voiceIndex) {
              nextVoices.push({ notes: [] });
            }
            const secondNote = {
              ...item.note,
              beat: 0,
              duration: this.beatsToDurationString(secondPartBeats),
              isTied: true,  // Always tied FROM the first part
            };
            // PRESERVE the forward tie if original had one (maintains chain to next note)
            // NOTE: Use explicit false instead of delete to survive serialization
            if (!originalHadForwardTie) {
              secondNote.tied = false;
            }
            console.log(`[shiftNotesBackward] SPLIT secondNote: beat=${secondNote.beat}, duration=${secondNote.duration}, tied=${secondNote.tied}, isTied=${secondNote.isTied}`);
            // Clear any conflicting notes before inserting
            this.clearConflictingNotesAtBeat(nextVoices[voiceIndex], 0, secondPartBeats, beatsPerMeasure);
            nextVoices[voiceIndex].notes.push(secondNote);
          }
        }
      } else {
        // Note fits in measure
        const newNote = { ...item.note, beat: newBeat };
        // CRITICAL: Ensure tied and isTied are always booleans (not undefined) to survive serialization
        if (newNote.tied === undefined) {
          newNote.tied = false;
        }
        if (newNote.isTied === undefined) {
          newNote.isTied = false;
        }
        if (item.wasMerged) {
          // Only clear isTied - the merged note absorbed what it was tied FROM
          // But PRESERVE tied if the merged note should still tie FORWARD to another note
          // NOTE: Use explicit false instead of delete to survive serialization
          newNote.isTied = false;
          // Note: tied flag was already correctly set/unset in mergeTiedNotes based on continuation.note.tied
        }
        console.log(`[shiftNotesBackward] Inserting note at measure ${newMeasure + 1}, beat ${newBeat}, duration ${newNote.duration}, tied=${newNote.tied}, isTied=${newNote.isTied}`);
        // Clear any conflicting notes before inserting
        const noteDurationBeats = this.getDurationInBeats(newNote.duration || '4n', newNote.dotted);
        this.clearConflictingNotesAtBeat(voice, newBeat, noteDurationBeats, beatsPerMeasure);
        voice.notes.push(newNote);
      }

      // Sort notes by beat
      voice.notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));
    }

    console.log('[shiftNotesBackward] === Shift complete ===');

    // VALIDATION: Check all affected measures for duration violations
    console.log('[shiftNotesBackward] === Validating measure durations ===');
    for (let m = 0; m < compositionState.measures.length; m++) {
      const isValid = this.validateMeasureDuration(compositionState.measures[m], staff, voiceIndex, beatsPerMeasure, m);
      if (!isValid) {
        console.error(`[shiftNotesBackward] Measure ${m + 1} failed validation!`);
      }
    }

    // DEBUG: Log final state of affected measures
    console.log('[shiftNotesBackward] === Final State Debug ===');
    for (let m = 0; m < Math.min(3, compositionState.measures.length); m++) {
      const measure = compositionState.measures[m];
      if (!measure) continue;
      const voices = staff === 'treble' ? measure.notation.treble?.voices : measure.notation.bass?.voices;
      if (!voices || !voices[voiceIndex]) continue;
      const voice = voices[voiceIndex];
      let totalBeats = 0;
      const noteDetails = voice.notes.map(n => {
        const beats = this.getDurationInBeats(n.duration || '4n', n.dotted);
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
      console.log(`[shiftNotesBackward] Measure ${m + 1}: totalBeats=${totalBeats}, notes=`, noteDetails);
    }
  }

  /**
   * Merge tied notes that will now fit in a single measure after shifting
   * @param {Array} notesToShift - Notes being shifted
   * @param {number} beatsPerMeasure - Beats per measure
   * @param {number} shiftBeats - How many beats we're shifting backward
   * @returns {Array} - Notes with merged tied pairs combined
   */
  mergeTiedNotes(notesToShift, beatsPerMeasure, shiftBeats) {
    console.log('[mergeTiedNotes] === Starting merge check ===');
    console.log('[mergeTiedNotes] Input notes:', notesToShift.length, 'shiftBeats:', shiftBeats);

    // Sort notes by their absolute position
    notesToShift.sort((a, b) => {
      const aAbs = a.measureIndex * beatsPerMeasure + (a.note.beat || 0);
      const bAbs = b.measureIndex * beatsPerMeasure + (b.note.beat || 0);
      return aAbs - bAbs;
    });

    // Log each note to be processed
    for (const item of notesToShift) {
      console.log('[mergeTiedNotes] Note:', {
        measure: item.measureIndex + 1,
        beat: item.note.beat,
        duration: item.note.duration,
        pitch: item.note.pitch || item.note.pitches,
        tied: item.note.tied,
        isTied: item.note.isTied
      });
    }

    // Run merge passes until no more merges happen
    let workingList = [...notesToShift];
    let mergeHappened = true;
    let passCount = 0;

    while (mergeHappened && passCount < 10) { // Safety limit
      passCount++;
      mergeHappened = false;
      const result = [];
      const processed = new Set();

      console.log(`[mergeTiedNotes] === Merge pass ${passCount}, ${workingList.length} notes ===`);

      for (let i = 0; i < workingList.length; i++) {
        if (processed.has(i)) continue;

        const item = workingList[i];
        const note = item.note;

        // Check if this note is tied forward (has a following tied note)
        if (note.tied) {
          console.log(`[mergeTiedNotes] Note ${i} has tied=true, looking for continuation...`);

          // Calculate where this note ends (absolute beat)
          const noteAbsoluteBeat = item.measureIndex * beatsPerMeasure + (note.beat || 0);
          const noteDuration = this.getDurationInBeats(note.duration || '4n', note.dotted);
          const noteEndAbsoluteBeat = noteAbsoluteBeat + noteDuration;

          // Look for a continuation note that starts where this note ends
          // Check for isTied=true OR same pitch at adjacent beat (for cases where isTied wasn't set properly)
          const continuationIdx = workingList.findIndex((other, idx) => {
            if (idx === i || processed.has(idx)) return false;

            const otherAbsoluteBeat = other.measureIndex * beatsPerMeasure + (other.note.beat || 0);

            // Check if this note ends where the other begins (with small tolerance for floating point)
            const isAdjacent = Math.abs(noteEndAbsoluteBeat - otherAbsoluteBeat) < 0.001;
            if (!isAdjacent) return false;

            // Check pitch match (for single notes) or both are rests
            const pitchMatch = note.pitch === other.note.pitch ||
                              (note.isRest && other.note.isRest) ||
                              (Array.isArray(note.pitches) && Array.isArray(other.note.pitches) &&
                               JSON.stringify(note.pitches.sort()) === JSON.stringify(other.note.pitches.sort()));

            if (!pitchMatch) return false;

            // CRITICAL FIX: Only merge if the continuation note is ACTUALLY tied (isTied=true)
            // Previous bug: merged notes just because they had same pitch and were adjacent
            // This caused incorrect duration calculations and measure overflow
            return other.note.isTied === true;
          });

          console.log(`[mergeTiedNotes] Looking for continuation at absoluteBeat ${noteEndAbsoluteBeat}, found at index: ${continuationIdx}`);

          if (continuationIdx !== -1) {
            const continuation = workingList[continuationIdx];

            // Calculate where this merged note would end up
            const oldAbsoluteBeat = item.measureIndex * beatsPerMeasure + (note.beat || 0);
            const newAbsoluteBeat = oldAbsoluteBeat - shiftBeats;
            const newMeasure = Math.floor(newAbsoluteBeat / beatsPerMeasure);
            const newBeat = newAbsoluteBeat % beatsPerMeasure;

            // Calculate combined duration
            const firstDuration = this.getDurationInBeats(note.duration || '4n', note.dotted);
            const secondDuration = this.getDurationInBeats(continuation.note.duration || '4n', continuation.note.dotted);
            const combinedDuration = firstDuration + secondDuration;

            console.log(`[mergeTiedNotes] Merge candidate: firstDuration=${firstDuration}, secondDuration=${secondDuration}, combined=${combinedDuration}`);
            console.log(`[mergeTiedNotes] New position would be: measure ${newMeasure + 1}, beat ${newBeat}`);

            // ALWAYS merge tied note chains - the reinsertion code will split again if needed
            // This ensures the total duration is preserved correctly through the shift
            {
              // Merge the notes!
              const mergedDurationStr = this.beatsToDurationString(combinedDuration);
              console.log(`[mergeTiedNotes] MERGING! Combined ${combinedDuration} beats -> duration string: "${mergedDurationStr}"`);
              console.log(`[mergeTiedNotes] First note isTied: ${note.isTied}, Continuation tied: ${continuation.note.tied}`);

              const mergedNote = {
                ...note,
                duration: mergedDurationStr,
              };

              // PRESERVE the tie chain:
              // - If the first note was tied FROM something (isTied), keep that
              // - If the continuation was tied TO something (tied), keep that
              // NOTE: Use explicit false instead of delete to survive serialization
              if (!note.isTied) {
                mergedNote.isTied = false;
              }
              // If continuation had tied=true (pointing to next note), preserve it
              if (continuation.note.tied) {
                mergedNote.tied = true;
                console.log('[mergeTiedNotes] Preserving forward tie from continuation');
              } else {
                mergedNote.tied = false;
              }

              result.push({
                ...item,
                note: mergedNote,
                wasMerged: true,
              });

              processed.add(i);
              processed.add(continuationIdx);
              mergeHappened = true; // A merge occurred, need another pass
              continue;
            }
          }
        }

        // Not merged - add as-is
        if (!processed.has(i)) {
          console.log(`[mergeTiedNotes] Note ${i} not merged, passing through as-is`);
          result.push(item);
          processed.add(i);
        }
      } // end for loop

      // Update working list for next pass
      workingList = result;

      // Re-sort for next pass
      workingList.sort((a, b) => {
        const aAbs = a.measureIndex * beatsPerMeasure + (a.note.beat || 0);
        const bAbs = b.measureIndex * beatsPerMeasure + (b.note.beat || 0);
        return aAbs - bAbs;
      });
    } // end while loop

    console.log(`[mergeTiedNotes] Completed after ${passCount} passes, returning ${workingList.length} notes`);
    console.log('[mergeTiedNotes] Final workingList:', workingList.map(item => ({
      measureIndex: item.measureIndex,
      beat: item.note.beat,
      duration: item.note.duration,
      beats: this.getDurationInBeats(item.note.duration || '4n', item.note.dotted),
      pitch: item.note.pitch || item.note.pitches,
      tied: item.note.tied || false,
      isTied: item.note.isTied || false,
      wasMerged: item.wasMerged || false
    })));
    return workingList;
  }

  // ============================================================================
  // SEQUENTIAL REBUILD ALGORITHM (NO-SYNC APPROACH)
  // See docs/SHIFT_OPERATIONS_IMPLEMENTATION_GUIDE.md for full documentation
  // ============================================================================

  /**
   * Extract logical notes from a position to end of composition.
   * Combines tied note sequences into single logical notes with total duration.
   * Also REMOVES the extracted notes from measures.
   *
   * @param {string} clef - 'treble' or 'bass'
   * @param {number} voiceIndex - 0 or 1
   * @param {number} fromMeasure - Starting measure index
   * @param {number} fromBeat - Starting beat within that measure
   * @param {Object} compositionState - The composition state object
   * @param {number} beatsPerMeasure - Beats per measure from time signature
   * @returns {Array} Array of logical note objects
   */
  extractLogicalNotes(clef, voiceIndex, fromMeasure, fromBeat, compositionState, beatsPerMeasure) {
    console.log('[extractLogicalNotes] Starting extraction:', { clef, voiceIndex, fromMeasure, fromBeat });
    const logicalNotes = [];

    for (let m = fromMeasure; m < compositionState.measures.length; m++) {
      const measure = compositionState.measures[m];
      if (!measure) continue;

      const voices = clef === 'treble'
        ? measure.notation?.treble?.voices
        : measure.notation?.bass?.voices;

      if (!voices || !voices[voiceIndex]) continue;

      const voice = voices[voiceIndex];
      if (!voice.notes) continue;

      const notesToRemove = [];

      // Sort notes by beat to process in order
      const sortedNotes = [...voice.notes].sort((a, b) => (a.beat || 0) - (b.beat || 0));

      for (const note of sortedNotes) {
        const noteBeat = note.beat || 0;

        // Skip notes before extraction point in the first measure
        if (m === fromMeasure && noteBeat < fromBeat) continue;

        // Mark for removal
        notesToRemove.push(note);

        // Get duration in beats - use centralized durationToBeats that handles dotted flag
        // This is CRITICAL: canonical format has duration='2n' and dotted=true separately
        const durationBeats = durationToBeats(note.duration || '4n', note.dotted);

        if (note.isTied) {
          // This is a continuation of a previous note - add to last logical note's duration
          if (logicalNotes.length > 0) {
            const lastLogical = logicalNotes[logicalNotes.length - 1];
            lastLogical.totalDuration += durationBeats;
            console.log('[extractLogicalNotes] Combined tied note, new total:', lastLogical.totalDuration);
            // If this continuation was also tied forward, remember that
            if (note.tied) {
              lastLogical.tiedForward = true;
            }
          } else {
            // Edge case: tied note with no preceding note (shouldn't happen normally)
            console.warn('[extractLogicalNotes] Found isTied note with no preceding note');
            logicalNotes.push({
              pitches: note.pitches || [note.pitch],
              totalDuration: durationBeats,
              tiedForward: note.tied || false,
              attributes: {
                articulation: note.articulation,
                accidental: note.accidental,
                dynamic: note.dynamic,
                velocity: note.velocity,
                isRest: note.isRest || note.type === 'rest',
              }
            });
          }
        } else {
          // New logical note (not a continuation)
          logicalNotes.push({
            pitches: note.pitches || [note.pitch],
            totalDuration: durationBeats,
            tiedForward: note.tied || false,
            attributes: {
              articulation: note.articulation,
              accidental: note.accidental,
              dynamic: note.dynamic,
              velocity: note.velocity,
              isRest: note.isRest || note.type === 'rest',
            }
          });
          console.log('[extractLogicalNotes] New logical note:', {
            pitches: note.pitches || [note.pitch],
            duration: durationBeats,
            isRest: note.isRest || note.type === 'rest'
          });
        }
      }

      // Remove extracted notes from the voice
      const beforeCount = voice.notes.length;
      voice.notes = voice.notes.filter(n => !notesToRemove.includes(n));
      const afterCount = voice.notes.length;
      console.log(`[extractLogicalNotes] Measure ${m}: removed ${beforeCount - afterCount} of ${beforeCount} notes, ${afterCount} remaining`);
    }

    console.log('[extractLogicalNotes] Extracted', logicalNotes.length, 'logical notes');

    // DEBUG: Log the state of all measures after extraction
    for (let m = fromMeasure; m < compositionState.measures.length; m++) {
      const measure = compositionState.measures[m];
      const voices = clef === 'treble' ? measure?.notation?.treble?.voices : measure?.notation?.bass?.voices;
      const noteCount = voices?.[voiceIndex]?.notes?.length || 0;
      console.log(`[extractLogicalNotes] After extraction - Measure ${m} has ${noteCount} notes in voice ${voiceIndex}`);
    }

    return logicalNotes;
  }

  /**
   * Rebuild notes from a position, placing each logical note sequentially.
   * Automatically splits notes that cross measure boundaries.
   * Automatically combines notes that fit in one measure (no explicit combine needed).
   *
   * @param {string} clef - 'treble' or 'bass'
   * @param {number} voiceIndex - 0 or 1
   * @param {number} startMeasure - Starting measure index
   * @param {number} startBeat - Starting beat within that measure
   * @param {Array} logicalNotes - Array of logical note objects to place
   * @param {Object} compositionState - The composition state object
   * @param {number} beatsPerMeasure - Beats per measure from time signature
   */
  rebuildNotesAfterShift(clef, voiceIndex, startMeasure, startBeat, logicalNotes, compositionState, beatsPerMeasure) {
    console.log('[rebuildNotesAfterShift] Starting rebuild:', { clef, voiceIndex, startMeasure, startBeat, noteCount: logicalNotes.length });
    let currentMeasure = startMeasure;
    let currentBeat = startBeat;

    for (const logicalNote of logicalNotes) {
      let remainingBeats = logicalNote.totalDuration;
      let isFirstPart = true;

      console.log('[rebuildNotesAfterShift] Placing note:', {
        pitches: logicalNote.pitches,
        totalDuration: remainingBeats,
        startingAt: { measure: currentMeasure, beat: currentBeat }
      });

      while (remainingBeats > 0) {
        // Ensure measure exists
        while (currentMeasure >= compositionState.measures.length) {
          compositionState.addMeasure({});
        }

        const measure = compositionState.measures[currentMeasure];
        const voices = clef === 'treble'
          ? measure.notation?.treble?.voices
          : measure.notation?.bass?.voices;

        if (!voices) {
          console.error('[rebuildNotesAfterShift] No voices array in measure', currentMeasure);
          break;
        }

        // Ensure voice exists
        while (voices.length <= voiceIndex) {
          voices.push({ notes: [] });
        }
        const voice = voices[voiceIndex];

        // Calculate how much fits in this measure
        const beatsAvailable = beatsPerMeasure - currentBeat;
        const beatsToPlace = Math.min(remainingBeats, beatsAvailable);
        const isLastPart = remainingBeats <= beatsAvailable;

        // Create the measure note using centralized duration utilities
        // beatsToDuration returns CANONICAL format: { duration: '2n', dotted: true }
        const { duration: noteDuration, dotted: noteDotted } = beatsToDuration(beatsToPlace);

        // Calculate tied flag properly:
        // - If NOT the last part: always true (ties to next part of same split note)
        // - If IS the last part: use logicalNote.tiedForward (preserves user's tie to another note)
        const tiedValue = !isLastPart ? true : (logicalNote.tiedForward || false);

        const measureNote = {
          type: logicalNote.attributes.isRest ? 'rest' : 'note',
          pitches: logicalNote.pitches,
          duration: noteDuration,  // WITHOUT dot suffix (canonical format)
          dotted: noteDotted,      // Separate boolean (canonical format)
          beat: currentBeat,
          // Tie flags
          isTied: !isFirstPart,   // Tied FROM previous if not first part
          tied: tiedValue,        // Ties TO next if not last part, OR preserves user's forward tie
          // Other properties
          isRest: logicalNote.attributes.isRest || false,
        };

        // Add attributes only on first part
        if (isFirstPart) {
          if (logicalNote.attributes.articulation) {
            measureNote.articulation = logicalNote.attributes.articulation;
          }
          if (logicalNote.attributes.accidental) {
            measureNote.accidental = logicalNote.attributes.accidental;
          }
          if (logicalNote.attributes.dynamic) {
            measureNote.dynamic = logicalNote.attributes.dynamic;
          }
          if (logicalNote.attributes.velocity !== undefined) {
            measureNote.velocity = logicalNote.attributes.velocity;
          }
        }

        console.log('[rebuildNotesAfterShift] Created note:', {
          measure: currentMeasure,
          beat: currentBeat,
          duration: measureNote.duration,
          tied: measureNote.tied,
          isTied: measureNote.isTied
        });

        // Add to voice and sort
        voice.notes.push(measureNote);
        voice.notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));

        // Advance position
        currentBeat += beatsToPlace;
        remainingBeats -= beatsToPlace;
        isFirstPart = false;

        // Move to next measure if current is full
        if (currentBeat >= beatsPerMeasure) {
          currentMeasure++;
          currentBeat = 0;
        }
      }
    }

    console.log('[rebuildNotesAfterShift] Rebuild complete');

    // DEBUG: Log final state of all affected measures
    for (let m = startMeasure; m <= currentMeasure && m < compositionState.measures.length; m++) {
      const measure = compositionState.measures[m];
      const voices = clef === 'treble' ? measure?.notation?.treble?.voices : measure?.notation?.bass?.voices;
      const notes = voices?.[voiceIndex]?.notes || [];
      console.log(`[rebuildNotesAfterShift] Final state - Measure ${m}:`, notes.map(n => ({
        beat: n.beat,
        duration: n.duration,
        tied: n.tied,
        isTied: n.isTied
      })));
    }
  }

  /**
   * Delete a note with shift using extract→rebuild pattern
   * This is the NO SYNC approach - works directly on measures
   * @param {string} clef - 'treble' or 'bass'
   * @param {number} voiceIndex - Voice index (0 or 1)
   * @param {number} measureIndex - Measure containing the note
   * @param {number} noteIndex - Index of note to delete
   * @param {Object} compositionState - CompositionState instance
   */
  deleteNoteWithShift(clef, voiceIndex, measureIndex, noteIndex, compositionState) {
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);

    console.log('[DELETE-WITH-SHIFT] Starting delete:', { clef, voiceIndex, measureIndex, noteIndex });

    // Get the measure and voice
    const measure = compositionState.measures[measureIndex];
    if (!measure) {
      console.error('[DELETE-WITH-SHIFT] Measure not found');
      return;
    }

    const voices = clef === 'treble'
      ? measure.notation?.treble?.voices
      : measure.notation?.bass?.voices;

    if (!voices || !voices[voiceIndex]) {
      console.error('[DELETE-WITH-SHIFT] Voice not found');
      return;
    }

    const voice = voices[voiceIndex];
    const noteToDelete = voice.notes[noteIndex];
    if (!noteToDelete) {
      console.error('[DELETE-WITH-SHIFT] Note not found at index', noteIndex);
      return;
    }

    const deleteBeat = noteToDelete.beat || 0;
    const deleteDuration = this.getDurationInBeats(noteToDelete.duration || '4n', noteToDelete.dotted);

    console.log('[DELETE-WITH-SHIFT] Deleting note at beat', deleteBeat, 'with duration', deleteDuration);

    // Calculate the beat AFTER the deleted note (where extraction should start)
    const afterDeleteBeat = deleteBeat + deleteDuration;
    const afterDeleteMeasure = measureIndex + Math.floor(afterDeleteBeat / beatsPerMeasure);
    const afterDeleteBeatInMeasure = afterDeleteBeat % beatsPerMeasure;

    // If the note is part of a tie chain (isTied=true), we need to find the start of the chain
    // and delete the entire tied sequence
    let actualDeleteBeat = deleteBeat;
    let actualDeleteMeasure = measureIndex;

    // Check if this note is a tie continuation
    if (noteToDelete.isTied) {
      // Walk backward to find the start of the tie chain
      console.log('[DELETE-WITH-SHIFT] Note is tied continuation, finding chain start');
      // For now, just delete this note and let the tie break
    }

    // Step 1: Remove the note being deleted from the measure
    voice.notes.splice(noteIndex, 1);
    console.log('[DELETE-WITH-SHIFT] Removed note from voice');

    // Step 2: If the deleted note was tied forward, clear isTied on what was the next note
    // (now at noteIndex position after splice)
    if (noteToDelete.tied && noteIndex < voice.notes.length) {
      const nextNote = voice.notes[noteIndex];
      if (nextNote && nextNote.isTied) {
        delete nextNote.isTied;
        console.log('[DELETE-WITH-SHIFT] Cleared isTied on following note');
      }
    }

    // Step 3: Extract all notes AFTER the deleted note's position
    const logicalNotes = this.extractLogicalNotes(clef, voiceIndex, measureIndex, deleteBeat, compositionState, beatsPerMeasure);
    console.log('[DELETE-WITH-SHIFT] Extracted', logicalNotes.length, 'logical notes after delete position');

    // Step 4: Rebuild from the delete position (notes shift left into the gap)
    if (logicalNotes.length > 0) {
      this.rebuildNotesAfterShift(clef, voiceIndex, measureIndex, deleteBeat, logicalNotes, compositionState, beatsPerMeasure);
    }

    // CRITICAL: Mark measures as manually edited to prevent overwrite from stale block sequence
    compositionState._measuresManuallyEdited = true;

    console.log('[DELETE-WITH-SHIFT] Delete complete');
  }

  /**
   * Execute paste by deleting notes after position
   */
  executePasteWithDelete(startMeasure, startBeat, staff) {
    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);

    // Delete all notes at or after the paste position from ALL voices
    for (let m = startMeasure; m < compositionState.measures.length; m++) {
      const measure = compositionState.measures[m];
      if (!measure) continue;

      // MULTI-VOICE: Get all voices for the staff
      const voices = staff === 'treble' ? measure.notation.treble?.voices : measure.notation.bass?.voices;
      if (!voices) continue;

      // Iterate through all voices
      voices.forEach((voice) => {
        if (!voice || !voice.notes) return;

        if (m === startMeasure) {
          // In the paste measure, remove notes at or after startBeat
          voice.notes = voice.notes.filter(note => (note.beat || 0) < startBeat);
        } else {
          // In subsequent measures, remove all notes
          voice.notes = [];
        }
      });
    }

    // Now paste the notes
    this.executePasteDirectly(startMeasure, startBeat, staff);
  }

  /**
   * Execute paste directly without shift/delete handling
   */
  executePasteDirectly(startMeasure, startBeat, staff) {
    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);
    const pastedNoteIds = [];

    for (const item of this.clipboard.data) {
      const absoluteBeat = startBeat + item.relativeBeat;
      let targetMeasure = startMeasure + Math.floor(absoluteBeat / beatsPerMeasure);
      let targetBeat = absoluteBeat % beatsPerMeasure;

      if (targetMeasure >= compositionState.measures.length) {
        continue;
      }

      const measure = compositionState.measures[targetMeasure];
      if (!measure) continue;

      const voice = this.getVoice(measure, staff);
      if (!voice) continue;

      // Check if note needs to be split
      const noteDuration = this.getDurationInBeats(item.note.duration || '4n', item.note.dotted);
      const noteEndBeat = targetBeat + noteDuration;

      if (noteEndBeat > beatsPerMeasure && targetMeasure + 1 < compositionState.measures.length) {
        // Split note across measure boundary
        const firstPartBeats = beatsPerMeasure - targetBeat;
        const secondPartBeats = noteEndBeat - beatsPerMeasure;

        // First part
        const firstNote = {
          ...JSON.parse(JSON.stringify(item.note)),
          beat: targetBeat,
          duration: this.beatsToDurationString(firstPartBeats),
          tied: true,
        };
        voice.notes.push(firstNote);
        voice.notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));
        const firstIndex = voice.notes.indexOf(firstNote);
        pastedNoteIds.push(`${targetMeasure}-${staff}-${firstIndex}`);

        // Second part in next measure
        const nextMeasure = compositionState.measures[targetMeasure + 1];
        const nextVoice = staff === 'treble' ? nextMeasure.notation.treble?.voices?.[0] : nextMeasure.notation.bass?.voices?.[0];
        if (nextVoice) {
          const secondNote = {
            ...JSON.parse(JSON.stringify(item.note)),
            beat: 0,
            duration: this.beatsToDurationString(secondPartBeats),
            isTied: true,
          };
          nextVoice.notes.push(secondNote);
          nextVoice.notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));
        }
      } else {
        // Note fits in measure
        const newNote = {
          ...JSON.parse(JSON.stringify(item.note)),
          beat: targetBeat,
        };
        voice.notes.push(newNote);
        voice.notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));
        const insertedIndex = voice.notes.indexOf(newNote);
        pastedNoteIds.push(`${targetMeasure}-${staff}-${insertedIndex}`);
      }
    }

    if (pastedNoteIds.length > 0) {

      this.selectedNotes.clear();
      pastedNoteIds.forEach(id => this.selectedNotes.add(id));

      if (staff === 'treble' && compositionState.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
      }

      // Save bass edits if applicable
      if (staff === 'bass') {
        for (const noteId of pastedNoteIds) {
          const [measureIndex] = this.parseNoteId(noteId);
          const measure = compositionState.measures[measureIndex];
          if (measure?.notation?.bass) {
            measure.notation.bass.autoGenerated = false;
            compositionState.saveEditedBassNotesForMeasure(measureIndex);
          }
        }
      }

      this.composerIntegration.render(true);
      setTimeout(() => {
        this.renderOverlay();
        this.onNoteSelect(Array.from(this.selectedNotes));
      }, 50);
    }
  }

  /**
   * Convert beats to duration string
   */
  beatsToDurationString(beats) {
    let result;
    if (beats >= 4) result = '1n';
    else if (beats >= 3) result = '2n.';
    else if (beats >= 2) result = '2n';
    else if (beats >= 1.5) result = '4n.';
    else if (beats >= 1) result = '4n';
    else if (beats >= 0.75) result = '8n.';
    else if (beats >= 0.5) result = '8n';
    else if (beats >= 0.25) result = '16n';
    else result = '32n';

    console.log(`[beatsToDurationString] ${beats} beats -> "${result}"`);
    return result;
  }

  /**
   * Paste at beginning of composition
   */
  pasteAtBeginning() {
    this.pasteNotes('beginning');
  }

  /**
   * Paste at end of composition
   */
  pasteAtEnd() {
    this.pasteNotes('end');
  }

  /**
   * Paste a building block from clipboard
   * @param {string} position - 'afterSelection', 'beginning', or 'end'
   */
  pasteBuildingBlock(position = 'afterSelection') {
    if (!this.clipboard || this.clipboard.type !== 'buildingBlock') {
      return;
    }

    const compositionState = window.getCompositionState?.();
    if (!compositionState) {
      console.warn('[NoteEditor] No composition state available');
      return;
    }

    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);
    let startBeat = 0;
    let insertChordIndex = 0;

    if (position === 'beginning') {
      startBeat = 0;
      insertChordIndex = 0;
    } else if (position === 'end') {
      // Find total beats in composition based on last chord segment
      const segments = compositionState.getChordSegments?.() || [];
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        startBeat = lastSegment.startBeat + lastSegment.durationBeats;
        insertChordIndex = segments.length;
      } else {
        startBeat = 0;
        insertChordIndex = 0;
      }
    } else {
      // After selection - find the end of selected note's chord
      if (this.selectedNotes.size > 0) {
        const firstNoteId = Array.from(this.selectedNotes)[0];
        const [measureIndex] = this.parseNoteId(firstNoteId);
        const measure = compositionState.measures[measureIndex];
        if (measure && measure.chord) {
          const chordIndex = measure.chord.chordIndex;
          const segment = compositionState.getChordSegment?.(chordIndex);
          if (segment) {
            startBeat = segment.startBeat + segment.durationBeats;
            insertChordIndex = chordIndex + 1;
          }
        }
      }
    }

    const blockDurationBeats = this.clipboard.durationBeats || 4;

    // Check if there are notes after the paste position (in either staff)
    const hasTrebleAfter = this.hasNotesAfterPosition(
      Math.floor(startBeat / beatsPerMeasure), startBeat % beatsPerMeasure, 'treble', compositionState
    );
    const hasBassAfter = this.hasNotesAfterPosition(
      Math.floor(startBeat / beatsPerMeasure), startBeat % beatsPerMeasure, 'bass', compositionState
    );
    const hasNotesAfter = hasTrebleAfter || hasBassAfter;

    // Always shift existing content to make room for the pasted building block
    if (hasNotesAfter && position !== 'end') {
      this.executeBuildingBlockPasteWithShift(startBeat, blockDurationBeats, insertChordIndex);
    } else {
      // No notes after, just paste directly
      this.executeBuildingBlockPasteDirectly(startBeat, insertChordIndex);
    }
  }

  /**
   * Execute building block paste with shifting both treble and bass
   */
  executeBuildingBlockPasteWithShift(startBeat, shiftBeats, insertChordIndex) {
    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);
    const startMeasure = Math.floor(startBeat / beatsPerMeasure);
    const startBeatInMeasure = startBeat % beatsPerMeasure;

    // Shift BOTH treble and bass notes forward
    this.shiftNotesForward(startMeasure, startBeatInMeasure, shiftBeats, 'treble', compositionState, beatsPerMeasure);
    this.shiftNotesForward(startMeasure, startBeatInMeasure, shiftBeats, 'bass', compositionState, beatsPerMeasure);

    // Explicitly clear the paste range to prevent any leftover or regenerated notes
    const endBeat = startBeat + shiftBeats;
    const endMeasure = Math.floor((endBeat - 0.001) / beatsPerMeasure); // -0.001 to handle exact boundaries

    for (let m = startMeasure; m <= endMeasure && m < compositionState.measures.length; m++) {
      const measure = compositionState.measures[m];
      if (!measure) continue;

      for (const staff of ['treble', 'bass']) {
        const voice = staff === 'treble' ? measure.notation.treble?.voices?.[0] : measure.notation.bass?.voices?.[0];
        if (!voice || !voice.notes) continue;

        if (m === startMeasure && m === endMeasure) {
          // Paste range is within one measure
          const endBeatInMeasure = endBeat % beatsPerMeasure || beatsPerMeasure;
          voice.notes = voice.notes.filter(note => {
            const beat = note.beat || 0;
            return beat < startBeatInMeasure || beat >= endBeatInMeasure;
          });
        } else if (m === startMeasure) {
          // First measure of paste range - keep notes before startBeat
          voice.notes = voice.notes.filter(note => (note.beat || 0) < startBeatInMeasure);
        } else if (m === endMeasure) {
          // Last measure of paste range - keep notes at or after endBeat
          const endBeatInMeasure = endBeat % beatsPerMeasure;
          if (endBeatInMeasure > 0) {
            voice.notes = voice.notes.filter(note => (note.beat || 0) >= endBeatInMeasure);
          } else {
            // endBeat lands exactly on measure boundary, clear entire measure
            voice.notes = [];
          }
        } else {
          // Middle measures - clear all notes
          voice.notes = [];
        }
      }
    }

    // Now paste the building block
    this.executeBuildingBlockPasteDirectly(startBeat, insertChordIndex);
  }

  /**
   * Execute building block paste directly
   */
  executeBuildingBlockPasteDirectly(startBeat, insertChordIndex) {
    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);
    const durationBeats = this.clipboard.durationBeats || 4;

    // Debug logging - show full pitch information
    // Insert the chord card into the progression if we have chord data
    // NOTE: This may trigger syncWithProgressionData which regenerates bass notes
    if (this.clipboard.chordData && window.insertChordCardAt) {
      try {
        const result = window.insertChordCardAt(insertChordIndex, this.clipboard.chordData, durationBeats);
      } catch (e) {
        console.warn('[NoteEditor] Could not insert chord card:', e);
      }
    } else {
      console.warn('[NoteEditor] Cannot insert chord card:', {
        hasChordData: !!this.clipboard.chordData,
        hasInsertFn: !!window.insertChordCardAt
      });
    }

    // Clear the paste range AFTER chord insertion (which may have regenerated bass)
    // to prevent duplicate notes
    const startMeasure = Math.floor(startBeat / beatsPerMeasure);
    const startBeatInMeasure = startBeat % beatsPerMeasure;
    const endBeat = startBeat + durationBeats;
    const endMeasure = Math.floor((endBeat - 0.001) / beatsPerMeasure);

    for (let m = startMeasure; m <= endMeasure && m < compositionState.measures.length; m++) {
      const measure = compositionState.measures[m];
      if (!measure) continue;

      for (const staff of ['treble', 'bass']) {
        const voice = staff === 'treble' ? measure.notation.treble?.voices?.[0] : measure.notation.bass?.voices?.[0];
        if (!voice || !voice.notes) continue;

        if (m === startMeasure && m === endMeasure) {
          // Paste range is within one measure
          const endBeatInMeasure = endBeat % beatsPerMeasure || beatsPerMeasure;
          voice.notes = voice.notes.filter(note => {
            const beat = note.beat || 0;
            return beat < startBeatInMeasure || beat >= endBeatInMeasure;
          });
        } else if (m === startMeasure) {
          voice.notes = voice.notes.filter(note => (note.beat || 0) < startBeatInMeasure);
        } else if (m === endMeasure) {
          const endBeatInMeasure = endBeat % beatsPerMeasure;
          if (endBeatInMeasure > 0) {
            voice.notes = voice.notes.filter(note => (note.beat || 0) >= endBeatInMeasure);
          } else {
            voice.notes = [];
          }
        } else {
          voice.notes = [];
        }
      }
    }

    // Helper to insert notes with split/tie handling
    const insertNotesWithSplit = (notesData, staff) => {
      const insertedIds = [];

      for (const item of notesData) {
        const absoluteBeat = startBeat + item.relativeBeat;
        let targetMeasure = Math.floor(absoluteBeat / beatsPerMeasure);
        let targetBeat = absoluteBeat % beatsPerMeasure;

        if (targetMeasure >= compositionState.measures.length) {
          continue;
        }

        const measure = compositionState.measures[targetMeasure];
        if (!measure) continue;

        const voice = this.getVoice(measure, staff);
        if (!voice) continue;

        const noteDuration = this.getDurationInBeats(item.note.duration || '4n', item.note.dotted);
        const noteEndBeat = targetBeat + noteDuration;

        if (noteEndBeat > beatsPerMeasure && targetMeasure + 1 < compositionState.measures.length) {
          // Split note across measure boundary
          const firstPartBeats = beatsPerMeasure - targetBeat;
          const secondPartBeats = noteEndBeat - beatsPerMeasure;

          const firstNote = {
            ...JSON.parse(JSON.stringify(item.note)),
            beat: targetBeat,
            duration: this.beatsToDurationString(firstPartBeats),
            tied: true,
            chordIndex: insertChordIndex, // Set correct chordIndex for the pasted chord
          };
          voice.notes.push(firstNote);
          voice.notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));
          insertedIds.push(`${targetMeasure}-${staff}-${voice.notes.indexOf(firstNote)}`);

          const nextMeasure = compositionState.measures[targetMeasure + 1];
          const nextVoice = staff === 'treble' ? nextMeasure.notation.treble?.voices?.[0] : nextMeasure.notation.bass?.voices?.[0];
          if (nextVoice) {
            const secondNote = {
              ...JSON.parse(JSON.stringify(item.note)),
              beat: 0,
              duration: this.beatsToDurationString(secondPartBeats),
              isTied: true,
              chordIndex: insertChordIndex, // Set correct chordIndex for the pasted chord
            };
            nextVoice.notes.push(secondNote);
            nextVoice.notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));
          }
        } else {
          const newNote = {
            ...JSON.parse(JSON.stringify(item.note)),
            beat: targetBeat,
            chordIndex: insertChordIndex, // Set correct chordIndex for the pasted chord
          };
          voice.notes.push(newNote);
          voice.notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));
          insertedIds.push(`${targetMeasure}-${staff}-${voice.notes.indexOf(newNote)}`);
        }
      }

      return insertedIds;
    };

    // Insert treble notes
    const trebleIds = insertNotesWithSplit(this.clipboard.trebleNotes || [], 'treble');

    // Insert bass notes
    const bassIds = insertNotesWithSplit(this.clipboard.bassNotes || [], 'bass');

    const totalInserted = trebleIds.length + bassIds.length;

    if (totalInserted > 0) {

      this.selectedNotes.clear();
      [...trebleIds, ...bassIds].forEach(id => this.selectedNotes.add(id));

      // Sync treble to block sequence
      if (compositionState.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
      }

      // Save bass edits and sync to building block sequence
      for (const noteId of bassIds) {
        const [measureIndex] = this.parseNoteId(noteId);
        const measure = compositionState.measures[measureIndex];
        if (measure?.notation?.bass) {
          measure.notation.bass.autoGenerated = false;
          compositionState.saveEditedBassNotesForMeasure(measureIndex);
        }
      }

      // CRITICAL: Sync the pasted bass notes back to the BuildingBlockSequence
      // This ensures the bass block has our pasted notes, not auto-generated ones
      // Without this, renderBassBlocksToMeasures would overwrite our pasted notes
      if (bassIds.length > 0 && compositionState.syncMeasuresToBuildingBlocks) {
        compositionState.syncMeasuresToBuildingBlocks();
      }

      this.composerIntegration.render(true);
      setTimeout(() => {
        this.renderOverlay();
        this.onNoteSelect(Array.from(this.selectedNotes));
      }, 50);
    }
  }

  /**
   * Shift selected notes up or down by octave
   * @param {number} direction - 1 for up, -1 for down
   */
  shiftSelectedNotesOctave(direction) {
    if (this.selectedNotes.size === 0) return;

    const steps = direction * 12; // 12 semitones = 1 octave

    // Use the existing move mechanism but with 7 diatonic steps (one octave)
    // Actually, let's calculate the octave shift directly
    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    let changedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, noteIndex, pitchIndex] = this.parseNoteId(noteId);
      const measure = compositionState.measures[measureIndex];
      if (!measure) continue;

      const voice = this.getVoice(measure, staff);
      if (!voice || !voice.notes[noteIndex]) continue;

      const note = voice.notes[noteIndex];
      if (note.isRest) continue;

      // Shift the pitch by one octave
      if (pitchIndex !== null && note.pitches && note.pitches.length > 1) {
        // Pitch-specific octave shift
        const currentPitch = note.pitches[pitchIndex];
        const newPitch = this.shiftPitchByOctave(currentPitch, direction, staff);
        note.pitches[pitchIndex] = newPitch;
        note.pitch = note.pitches[0];
        changedCount++;
      } else {
        // Whole note/chord octave shift
        if (note.pitches && note.pitches.length > 0) {
          note.pitches = note.pitches.map(p => this.shiftPitchByOctave(p, direction, staff));
          note.pitch = note.pitches[0];
        } else if (note.pitch) {
          note.pitch = this.shiftPitchByOctave(note.pitch, direction, staff);
        }
        changedCount++;
      }
    }

    if (changedCount > 0) {
      // Sync treble changes
      if (compositionState.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
      }

      // Save bass edits if applicable
      for (const noteId of this.selectedNotes) {
        const [measureIndex, staff, voiceIndex] = this.parseNoteId(noteId);
        if (staff === 'bass' && compositionState) {
          const measure = compositionState.measures[measureIndex];
          if (measure && measure.notation?.bass) {
            measure.notation.bass.autoGenerated = false;
            compositionState.saveEditedBassNotesForMeasure(measureIndex);
          }
        }
      }

      this.composerIntegration.render(true);
      setTimeout(() => this.renderOverlay(), 50);
    }
  }

  /**
   * Shift a pitch by one octave
   * @param {string} pitch - Pitch like 'C4', 'F#5'
   * @param {number} direction - 1 for up, -1 for down
   * @param {string} staff - 'treble' or 'bass' for range limits
   * @returns {string} New pitch
   */
  shiftPitchByOctave(pitch, direction, staff) {
    if (!pitch) return pitch;

    // Parse pitch: note name + optional accidental + octave number
    const match = pitch.match(/^([A-Ga-g])([#b]?)(\d+)$/);
    if (!match) return pitch;

    const [, noteName, accidental, octaveStr] = match;
    let octave = parseInt(octaveStr, 10);

    // Shift octave
    octave += direction;

    // Apply reasonable limits
    const minOctave = staff === 'bass' ? 1 : 3;
    const maxOctave = staff === 'bass' ? 4 : 7;
    octave = Math.max(minOctave, Math.min(maxOctave, octave));

    return `${noteName.toUpperCase()}${accidental}${octave}`;
  }

  /**
   * Helper: Get duration in beats
   * @param {string} duration - Duration string like '4n', '8n'
   * @returns {number} Duration in beats
   */
  getDurationInBeats(duration, dotted = false) {
    const map = {
      '1n': 4, '1n.': 6,
      '2n': 2, '2n.': 3,
      '4n': 1, '4n.': 1.5,
      '8n': 0.5, '8n.': 0.75,
      '16n': 0.25, '16n.': 0.375,
      '32n': 0.125,
    };
    const baseBeats = map[duration] || 1;
    // CANONICAL FORMAT FIX: If dotted flag is set but duration doesn't have '.',
    // multiply by 1.5. This handles notes with duration='2n' and dotted=true
    if (dotted && !duration.includes('.')) {
      return baseBeats * 1.5;
    }
    return baseBeats;
  }

  /**
   * Destroy the editor
   */
  destroy() {
    this.detachEventListeners();
    this.clearSelection();
    this.canvas = null;
    this.overlayCanvas = null;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a note editor instance
 * @param {Object} options - Configuration options
 * @returns {NoteEditor} - New instance
 */
export function createNoteEditor(options = {}) {
  return new NoteEditor(options);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  EDITOR_STATES,
  SELECTION_COLORS,
  LINE_SPACING,
  NoteEditor,
  createNoteEditor,
};
