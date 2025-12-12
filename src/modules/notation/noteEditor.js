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
import { noteToMidi, midiToNote } from './vexFlowRenderer.js';
import { analyzeChordTone, CHORD_TONE_COLORS } from '../analysis/chordToneAnalyzer.js';
import { getPiano } from '../audio/audioEngine.js';
import { showNoteOverflowDialog } from '../ui/modals.js';
import {
  TUPLET_RATIOS,
  generateTupletGroupId,
  createTupletAttribute,
  getTupletDuration,
} from '../state/buildingBlock.js';
import {
  getBeatsPerMeasureFromTimeSignature,
  getMeasureCapacityTicks,
  durationStringToTicks,
  sumNoteTicks,
} from '../state/compositionState.js';

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

    // Check if clicking on a chord bracket label (for bass replacement)
    if (this.composerIntegration && this.composerIntegration.checkChordBracketClick(position.x, position.y)) {
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

    // Check interaction mode from toolbar
    // In 'noteEntry' mode with Alt held, skip note selection and go directly to note addition
    const interactionMode = this.composerIntegration?.toolbar?.getInteractionMode?.() || 'select';
    const isNoteEntryMode = interactionMode === 'noteEntry' && e.altKey;

    // Check if clicking on an existing note FIRST (before checking Alt key)
    // Skip this check in noteEntry mode when Alt is held - prioritize adding notes
    const clickedNote = isNoteEntryMode ? null : this.findNoteAtPosition(position.x, position.y);

    if (clickedNote) {
      // Clicking on a note - handle selection (works with or without Alt in select mode)
      e.stopPropagation();
      e.preventDefault();

      // For chords, create pitch-specific ID if pitchIndex is available
      const isChord = clickedNote.pitches && clickedNote.pitches.length > 1;
      const pitchSpecificId = isChord && clickedNote.pitchIndex !== undefined
        ? this.createNoteId(clickedNote.measureIndex, clickedNote.staff, clickedNote.voiceIndex || 0, clickedNote.noteIndex, clickedNote.pitchIndex)
        : clickedNote.id;

      // Track auto-generated rest info so we can create notes at their position
      if (clickedNote.isAutoGenerated) {
        // Store the info needed to create a note at this position
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

      // Check if any part of this note/chord is already selected
      const baseNoteId = clickedNote.id;
      const isNoteSelected = this.selectedNotes.has(baseNoteId) ||
        (isChord && [...this.selectedNotes].some(id => this.getBaseNoteId(id) === baseNoteId));

      if (e.shiftKey) {
        // Shift+Click = add to selection (use pitch-specific ID for chords)
        this.toggleNoteSelection(pitchSpecificId);
      } else if (e.altKey && isNoteSelected) {
        // Alt+Click on selected note(s) = start dragging
        this.startDrag(position, staffPosition);
      } else {
        // Regular click = select this note only (pitch-specific for chords)
        this.clearSelection();
        this.selectNote(pitchSpecificId);
      }
      return;
    }

    // Not clicking on a note - check if we're in note addition mode (Alt held)
    if (!e.altKey) {
      // No Alt key, not clicking on note = let event bubble to measure selection/playback
      return;
    }

    // Alt is held and not clicking on a note - this is note addition mode
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
        console.log('[NoteEditor] Adding polyphony to selected note:', selectedNoteInMeasure);
        // SECTION VIEW FIX: Apply filter offset to convert local index to global
        const filterOffset = this.composerIntegration?.getMeasureFilterOffset?.() || 0;
        this.onPolyphonyAdd({
          measureIndex: selectedNoteInMeasure.measureIndex + filterOffset,
          staff: selectedNoteInMeasure.staff,
          voiceIndex: selectedNoteInMeasure.voiceIndex || 0,
          noteIndex: selectedNoteInMeasure.noteIndex,
          pitch: staffPosition.pitch,
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

      // Emit polyphony add event
      this.onPolyphonyAdd({
        measureIndex: targetNote.measureIndex + filterOffset,
        staff: targetNote.staff,
        noteIndex: targetNote.noteIndex,
        pitch: staffPosition.pitch,
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
    const staffPosition = this.layoutManager.getStaffPositionAtPoint(position.x, position.y);

    // Track Shift key state
    this.isShiftHeld = e.shiftKey;

    // REMOVED: Hover toolbar logic - now using contextual top toolbar

    // Only show ghost note if Alt key is held (note editing mode)
    if (!e.altKey) {
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
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selectedNotes.size > 0) {
        e.preventDefault();
        this.deleteSelectedNotes();
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

          console.log(`[NoteEditor] Multiple notes at X=${clickX}, clickY=${clickY}, chose voice ${(closestNote.voiceIndex ?? 0) + 1}`);
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

  /**
   * Add a note at a staff position
   * @param {Object} staffPosition - Staff position data
   */
  addNoteAtPosition(staffPosition) {
    if (!staffPosition.pitch) {
      return;
    }

    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    // DEBUG: Track progressionData state at start of note addition
    if (window.getCompositionState) {
      const compositionState = window.getCompositionState();
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

    // DEBUG: Early trace
    const earlyVoiceIdx = this.getVoiceIndexForStaff(staff);
    console.log(`[NoteEditor] addNoteAtPosition: staff=${staff}, voiceIndex=${earlyVoiceIdx}, measure=${targetMeasureIndex}, noteBeats=${noteBeats}, remainingBeats=${remainingBeats}`);

    // NEW: Check if we should insert at a specific position (between existing notes)
    // Look for existing notes at the clicked X position
    const insertionPoint = this.findInsertionPoint(staffPosition, targetMeasureIndex, staff);
    console.log(`[NoteEditor] findInsertionPoint result:`, insertionPoint);

    if (insertionPoint !== null && window.getCompositionState) {
      // We found a specific insertion point - use intelligent insertion

      const compositionState = window.getCompositionState();
      if (!compositionState || !compositionState.measures[targetMeasureIndex]) {
        console.warn('[NoteEditor] Cannot access compositionState');
        return;
      }

      // MULTI-VOICE: Prefer the selected note's voice; fallback to active voice for this staff
      let insertVoiceIndex = this.getVoiceIndexForStaff(staff);
      const selected = this.getSelectedRegion?.();
      if (selected && selected.staff === staff && typeof selected.voiceIndex === 'number') {
        insertVoiceIndex = selected.voiceIndex;
      }
      console.log(`[NoteEditor] Insertion point found: action=${insertionPoint.action}, noteIndex=${insertionPoint.noteIndex}, voiceIndex=${insertVoiceIndex}`);

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
        let beats = this.durationToBeats(note.duration || '4n');
        if (note.dotted) beats *= 1.5;
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
          const timeSignature = compositionState.metadata?.timeSignature || { num: 4, denom: 4 };
          maxBeats = getBeatsPerMeasureFromTimeSignature(timeSignature);
          availableBeats = maxBeats - usedBeats;
        }
      } else {
        // TREBLE CLEF: Use measure boundaries
        const timeSignature = compositionState.metadata?.timeSignature || { num: 4, denom: 4 };
        maxBeats = getBeatsPerMeasureFromTimeSignature(timeSignature);
        availableBeats = maxBeats - usedBeats;
      }

      // TREBLE CLEF: Handle overflow with user choice dialog
      if (staff === 'treble' && requestedBeats > availableBeats) {
        const overflowBeats = requestedBeats - availableBeats;

        // Determine if this is the last note position (appending to end)
        const isAppendingToEnd = insertionPoint.noteIndex >= voice.notes.length - 1;

        // Prepare note data for use in callback
        const noteDataForCallback = {
          pitch: staffPosition.pitch,
          pitches: [staffPosition.pitch],
          duration: this.currentDuration,
          isRest: this.isRestMode,
          dotted: this.isDotted,
          accidental: this.currentAccidental,
          articulation: this.currentArticulation,
        };

        // Show overflow dialog
        showNoteOverflowDialog({
          overflowBeats,
          noteDuration: this.currentDuration,
          onChoice: (choice) => {
            if (choice === null) {
              // User cancelled
              console.log('[NoteEditor] User cancelled overflow dialog');
              return;
            }

            if (choice === 'truncate') {
              // Truncate: Insert the note at the position and remove any notes that overflow
              const targetIndex = insertionPoint.action === 'before' ? insertionPoint.noteIndex : insertionPoint.noteIndex + 1;

              // Calculate the beat position where we're inserting
              let insertBeat = 0;
              for (let i = 0; i < targetIndex; i++) {
                let beats = this.durationToBeats(voice.notes[i].duration || '4n');
                if (voice.notes[i].dotted) beats *= 1.5;
                insertBeat += beats;
              }

              // Use the time-signature-aware maxBeats from outer scope
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
              // Note truncated due to measure constraints
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
        console.log(`[NoteEditor] Reducing note duration from ${this.currentDuration} to ${durationToUse} to fit ${context}`);
      }

      const noteData = {
        pitch: staffPosition.pitch,
        pitches: [staffPosition.pitch],
        duration: durationToUse,
        isRest: this.isRestMode,
        dotted: dottedToUse,
        accidental: this.currentAccidental,
        articulation: this.currentArticulation, // Include articulation from toolbar
        voiceIndex: insertVoiceIndex, // Pin to the resolved voice for insertion
      };
      console.log('[NoteEditor] Inserting note with duration:', durationToUse, '(toolbar currentDuration:', this.currentDuration, ')');

      // Insert note at the specified position
      const targetIndex = insertionPoint.action === 'before' ? insertionPoint.noteIndex : insertionPoint.noteIndex + 1;
      voice.notes.splice(targetIndex, 0, noteData);

      this.composerIntegration.render();
      // Note inserted successfully
      return;
    }

    // No specific insertion point found - use original behavior (append to end)
    // Calculate remaining beats based on staff type
    let effectiveRemainingBeats = remainingBeats; // Measure-based for treble

    // DEBUG: Trace append-to-end path
    const voiceIdx = this.getVoiceIndexForStaff(staff);
    console.log(`[NoteEditor] Append path: staff=${staff}, voiceIndex=${voiceIdx}, measureIndex=${targetMeasureIndex}, remainingBeats=${remainingBeats}, noteBeats=${noteBeats}`);

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
      const noteDataForCallback = {
        pitch: staffPosition.pitch,
        pitches: [staffPosition.pitch],
        duration: this.currentDuration,
        isRest: this.isRestMode,
        dotted: this.isDotted,
        accidental: this.currentAccidental,
        articulation: this.currentArticulation,
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

    // Handle case where measure is completely full - move to next measure
    if (effectiveRemainingBeats <= 0.001) {
      console.log(`[NoteEditor] Measure ${targetMeasureIndex} is full (${effectiveRemainingBeats} beats remaining), moving to next measure`);
      const nextMeasureIndex = targetMeasureIndex + 1;

      // Ensure next measure exists
      const compositionState = window.getCompositionState?.();
      if (compositionState) {
        while (compositionState.measures.length <= nextMeasureIndex) {
          compositionState.addMeasure({});
        }
      }

      // Recursively call addNoteAtPosition with the next measure
      const nextStaffPosition = { ...staffPosition, measure: { index: nextMeasureIndex } };
      console.log(`[NoteEditor] Redirecting to measure ${nextMeasureIndex}`);
      this.addNoteAtPosition(nextStaffPosition);
      return;
    }

    // If the note fits completely, add it normally
    console.log(`[NoteEditor] Checking fit: noteBeats=${noteBeats} <= effectiveRemainingBeats=${effectiveRemainingBeats}? ${noteBeats <= effectiveRemainingBeats}`);
    if (noteBeats <= effectiveRemainingBeats) {
      // getCurrentBeat now respects the current voice (Voice 1 or Voice 2)
      const beatPosition = this.getCurrentBeat(targetMeasureIndex, staff);
      console.log(`[NoteEditor] Note fits! beatPosition=${beatPosition}, calling onNoteAdd`);

      const noteData = {
        type: this.isRestMode ? 'rest' : 'note',
        pitch: staffPosition.pitch,
        duration: this.currentDuration,
        isRest: this.isRestMode,
        dotted: this.isDotted,
        accidental: this.currentAccidental,
        articulation: this.currentArticulation, // Include articulation from toolbar
        beat: beatPosition,
        voiceIndex: this.getVoiceIndexForStaff(staff), // Pin to active voice
      };

      // Apply tuplet attributes if in tuplet insert mode
      if (this.tupletInsertMode) {
        this.applyTupletAttributesToNoteData(noteData, targetMeasureIndex, staff);
      }

      console.log(`[NoteEditor] Calling onNoteAdd with:`, { measureIndex: targetMeasureIndex, staff, note: noteData });
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
        const truncatedNote = {
          type: this.isRestMode ? 'rest' : 'note',
          pitch: staffPosition.pitch,
          duration: fitDuration.duration,
          isRest: this.isRestMode,
          dotted: fitDuration.dotted,
          accidental: this.currentAccidental,
          articulation: this.currentArticulation,
          beat: beatPosition,
        };

        this.onNoteAdd({
          measureIndex: targetMeasureIndex,
          staff: staff,
          note: truncatedNote,
        });

        if (truncatedBeats < noteBeats) {
          console.log(`[NoteEditor] Bass note truncated from ${noteBeats} to ${truncatedBeats} beats to fit building block`);
        }
      } else {
        console.warn('[NoteEditor] Building block is full, cannot add bass note');
      }
      return;
    }

    // TREBLE CLEF: Split across measures with ties (original behavior)
    // Add first part to fill current measure
    if (effectiveRemainingBeats > 0) {
      const beatPosition = this.getCurrentBeat(targetMeasureIndex, staff);
      const firstPartDuration = this.beatsToDuration(effectiveRemainingBeats);
      const firstPartNote = {
        type: this.isRestMode ? 'rest' : 'note',
        pitch: staffPosition.pitch,
        duration: firstPartDuration.duration,
        isRest: this.isRestMode,
        dotted: firstPartDuration.dotted,
        accidental: this.currentAccidental,
        articulation: this.currentArticulation,
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
        pitch: staffPosition.pitch,
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
    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;
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

    // Targeting specific voice for insertion

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
        console.log('[NoteEditor] Inserting before tied note - redirecting to before original note in previous measure');
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
        let beats = this.durationToBeats(targetNote.duration || '4n');
        if (targetNote.dotted) beats *= 1.5;
        beatPosition = beats; // Insert after the tied note's portion in this measure
      }
    } else {
      // Normal note - sum beats up to the insertion point
      const targetIndex = insertionPoint.action === 'before' ? insertionPoint.noteIndex : insertionPoint.noteIndex + 1;
      for (let i = 0; i < targetIndex && i < voice.notes.length; i++) {
        const note = voice.notes[i];
        let beats = this.durationToBeats(note.duration || '4n');
        if (note.dotted) beats *= 1.5;
        beatPosition += beats;
      }
    }

    // MULTI-VOICE: Use direct voice-based shifting to preserve voice separation
    if (hasMultipleVoices) {
      // Multi-voice insertion logic

      // Shift notes forward
      const allVoices = measure.notation?.treble?.voices || [];

      // Calculate note duration in beats
      let durationBeats = this.durationToBeats(noteData.duration);
      if (noteData.dotted) durationBeats *= 1.5;

      console.log(`[insert] Inserting note into voice ${voiceIndex} at measure ${measureIndex}, beat ${beatPosition}, shift ${durationBeats} beats`);

      // Shifting notes forward to make space - ONLY shift the target voice, not all voices
      this.shiftNotesForward(measureIndex, beatPosition, durationBeats, 'treble', compositionState, beatsPerMeasure, voiceIndex);

      // Continue with insertion

      // Insert the new note at the insertion point in the CURRENT voice
      const newNote = {
        type: noteData.isRest ? 'rest' : 'note',
        pitches: noteData.pitches || [noteData.pitch],
        pitch: noteData.pitch,
        duration: noteData.duration,
        beat: beatPosition,
        dotted: noteData.dotted || false,
        isRest: noteData.isRest || false,
        articulation: noteData.articulation,
        accidental: noteData.accidental,
        dynamic: noteData.dynamic,
        velocity: noteData.velocity,
      };

      // Inserting note into specified voice and position
      voice.notes.push(newNote);
      voice.notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));

      // Insertion complete

      // Check for overflow to next measure (handled by shiftNotesForward)

      // Sync treble block sequence to match the updated measures
      // This prevents ghost notes from stale block sequence data
      if (compositionState.trebleBlockSequence?.blocks?.length > 0) {
        compositionState.syncMeasuresToTrebleBlock();
      }

      // Render the changes
      this.composerIntegration.render();
      return;
    }

    // SINGLE-VOICE: Use trebleBlockSequence (original approach)
    // Calculate absolute beat and unit position
    const absoluteBeat = measureIndex * beatsPerMeasure + beatPosition;
    const insertUnit = Math.round(absoluteBeat * UNITS_PER_BEAT);

    // Calculate duration in units
    let durationBeats = this.durationToBeats(noteData.duration);
    if (noteData.dotted) durationBeats *= 1.5;
    const durationUnits = Math.round(durationBeats * UNITS_PER_BEAT);

    // Get pitches array
    const pitches = noteData.isRest ? [] : (noteData.pitches || [noteData.pitch]);

    // Use the compositionState method to insert with shift
    compositionState.insertTrebleNoteWithShift(insertUnit, durationUnits, pitches, {
      articulation: noteData.articulation,
      accidental: noteData.accidental,
      dynamic: noteData.dynamic,
      velocity: noteData.velocity,
    });

    // Render the changes
    this.composerIntegration.render();
    // Single-voice note insertion completed
  }

  /**
   * Insert a treble note with shift at the end of a measure
   * @param {number} measureIndex - Target measure index
   * @param {Object} noteData - Note data to insert
   * @param {Object} compositionState - CompositionState instance
   */
  insertTrebleNoteWithShiftAtEnd(measureIndex, noteData, compositionState) {
    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;
    const UNITS_PER_BEAT = 48;

    // Calculate the beat position (end of used beats in measure)
    const usedBeats = this.getMeasureBeatsUsed(measureIndex, 'treble');

    // MULTI-VOICE CHECK: Detect if Voice 2 has any notes across all measures
    const hasMultipleVoices = compositionState.measures.some(m => {
      const voices = m.notation?.treble?.voices || [];
      return voices.length > 1 && voices[1]?.notes?.length > 0;
    });

    // MULTI-VOICE: Use direct voice-based shifting to preserve voice separation
    if (hasMultipleVoices) {
      // Get the current voice index from the toolbar
      const voiceIndex = this.getVoiceIndexForStaff('treble');
      console.log(`[NoteEditor] insertTrebleNoteWithShiftAtEnd: Using direct voice-based shift (multi-voice mode, voice ${voiceIndex + 1})`);

      // Calculate note duration in beats
      let durationBeats = this.durationToBeats(noteData.duration);
      if (noteData.dotted) durationBeats *= 1.5;

      // Shift notes forward in TARGET voice only from the end of this measure
      this.shiftNotesForward(measureIndex, usedBeats, durationBeats, 'treble', compositionState, beatsPerMeasure, voiceIndex);

      // Insert the new note at the end in the CURRENT voice
      const measure = compositionState.measures[measureIndex];
      const voice = this.getVoice(measure, 'treble');

      const newNote = {
        type: noteData.isRest ? 'rest' : 'note',
        pitches: noteData.pitches || [noteData.pitch],
        pitch: noteData.pitch,
        duration: noteData.duration,
        beat: usedBeats,
        dotted: noteData.dotted || false,
        isRest: noteData.isRest || false,
        articulation: noteData.articulation,
        accidental: noteData.accidental,
        dynamic: noteData.dynamic,
        velocity: noteData.velocity,
      };

      voice.notes.push(newNote);
      voice.notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));

      // Render the changes
      this.composerIntegration.render();
      // Note inserted at end of measure
      return;
    }

    // SINGLE-VOICE: Use trebleBlockSequence (original approach)
    const absoluteBeat = measureIndex * beatsPerMeasure + usedBeats;
    const insertUnit = Math.round(absoluteBeat * UNITS_PER_BEAT);

    // Calculate duration in units
    let durationBeats = this.durationToBeats(noteData.duration);
    if (noteData.dotted) durationBeats *= 1.5;
    const durationUnits = Math.round(durationBeats * UNITS_PER_BEAT);

    // Get pitches array
    const pitches = noteData.isRest ? [] : (noteData.pitches || [noteData.pitch]);

    // Use the compositionState method to insert with shift
    compositionState.insertTrebleNoteWithShift(insertUnit, durationUnits, pitches, {
      articulation: noteData.articulation,
      accidental: noteData.accidental,
      dynamic: noteData.dynamic,
      velocity: noteData.velocity,
    });

    // Render the changes
    this.composerIntegration.render();
    console.log('[NoteEditor] ✅ Inserted note with shift at end');
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

  /**
   * Move selected notes by a number of steps
   * @param {number} steps - Number of steps (positive = up, negative = down)
   */
  moveSelectedNotes(steps) {
    // Save state for undo before making changes
    if (this.selectedNotes.size > 0 && typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    console.log('[NoteEditor] moveSelectedNotes called with steps:', steps, 'selectedNotes:', this.selectedNotes);
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

    console.log('[NoteEditor] Prepared moves:', moves);

    if (moves.length > 0) {
      this.onNoteMove(moves);
    }
  }

  /**
   * Delete selected notes (supports individual pitch deletion from chords)
   */
  deleteSelectedNotes() {
    // Only save state if there are notes to delete
    if (this.selectedNotes.size > 0 && typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    const fullDeletions = [];
    const pitchDeletions = [];

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex, pitchIndex] = this.parseNoteId(noteId);

      if (pitchIndex !== null) {
        // Pitch-specific deletion from chord
        pitchDeletions.push({ measureIndex, staff, voiceIndex, noteIndex, pitchIndex, noteId });
      } else {
        // Full note deletion
        const deletion = { measureIndex, staff, voiceIndex, noteIndex };

        // For auto-generated rests (noteIndex === -1), include beat/duration from stored info
        if (noteIndex === -1 && this.autoGeneratedRestInfo?.has(noteId)) {
          const restInfo = this.autoGeneratedRestInfo.get(noteId);
          deletion.beat = restInfo.beat;
          deletion.duration = restInfo.duration;
          deletion.isAutoGenerated = true;
        }

        fullDeletions.push(deletion);
      }
    }

    // Handle pitch deletions first (remove individual pitches from chords)
    if (pitchDeletions.length > 0) {
      this.deletePitchesFromChords(pitchDeletions);
    }

    // Sort full deletions by noteIndex descending so we delete from end first
    fullDeletions.sort((a, b) => b.noteIndex - a.noteIndex);

    for (const deletion of fullDeletions) {
      this.onNoteDelete(deletion);
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
      console.log(`[NoteEditor] Deleted ${changedCount} pitch(es) from chord(s)`);
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

        console.log('[NoteEditor.playSelectedNotes] Playing note from noteRegions:', {
          noteId,
          pitch: region.pitch,
          duration: duration,
          measureIndex: region.measureIndex,
          noteIndex: region.noteIndex
        });

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
        const durationSeconds = window.Tone.Time(note.duration).toSeconds();
        console.log('[NoteEditor.playSelectedNotes] Tone.js playback:', {
          pitch,
          durationString: note.duration,
          durationSeconds: durationSeconds,
          tempo: window.Tone.Transport.bpm.value
        });
        piano.triggerAttackRelease(pitch, note.duration, currentTime);
      });

      // Advance time for next note (convert duration to seconds)
      const durationSeconds = window.Tone.Time(note.duration).toSeconds();
      currentTime += durationSeconds;
    });
  }

  /**
   * Insert a note before the first selected note
   */
  insertNoteBeforeSelected() {
    if (this.selectedNotes.size === 0) {
      console.warn('[NoteEditor] No notes selected for insert before');
      return;
    }

    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    // Get the first selected note
    const firstNoteId = Array.from(this.selectedNotes)[0];
    const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(firstNoteId);

    // Debug: Log which note was selected for insertion

    // Check if the selected note is a tied continuation
    const compositionStateCheck = window.getCompositionState?.();
    if (compositionStateCheck) {
      const measureCheck = compositionStateCheck.measures[measureIndex];
      const voiceCheck = staff === 'treble' ? measureCheck?.notation?.treble?.voices?.[0] : measureCheck?.notation?.bass?.voices?.[0];
      const targetNote = voiceCheck?.notes?.[noteIndex];

      if (targetNote && targetNote.isTied) {
        // This is a tied continuation - inform the user and handle specially
        console.log('[NoteEditor] Selected note is a tied continuation');
        // For tied notes, the "before" insertion will be handled by insertTrebleNoteWithShiftAtPosition
        // which redirects to the original note in the previous measure
      }
    }

    // Create new note with current toolbar settings
    const noteData = {
      pitch: 'C4', // Default pitch, user can change it
      pitches: ['C4'],
      duration: this.currentDuration,
      dotted: this.isDotted,
      isRest: this.isRestMode,
      accidental: this.currentAccidental,
      articulation: this.currentArticulation,
    };

    console.log('[NoteEditor] Note data to insert:', noteData);
    console.log(`[NoteEditor] Inserting before: measure=${measureIndex}, staff=${staff}, voiceIndex=${voiceIndex}, noteIndex=${noteIndex}`);

    const compositionState = window.getCompositionState?.();
    if (!compositionState || !compositionState.measures[measureIndex]) {
      console.warn('[NoteEditor] ❌ Could not access compositionState');
      return;
    }

    const measure = compositionState.measures[measureIndex];

    // CRITICAL: Use the voiceIndex from the selected note, NOT the active voice from toolbar
    // This ensures we insert into the same voice as the selected note
    const voices = staff === 'treble' ? measure.notation?.treble?.voices : measure.notation?.bass?.voices;
    if (!voices || voices.length <= voiceIndex) {
      console.warn('[NoteEditor] ❌ Voice not found:', voiceIndex);
      return;
    }
    const voice = voices[voiceIndex];

    // Calculate current beats used in measure
    let usedBeats = 0;
    for (const note of voice.notes) {
      let beats = this.durationToBeats(note.duration || '4n');
      if (note.dotted) beats *= 1.5;
      // Account for tuplet notes (e.g., triplet quarter notes take 0.667 beats, not 1)
      if (note.tuplet && note.tuplet.type && TUPLET_RATIOS[note.tuplet.type]) {
        const ratio = TUPLET_RATIOS[note.tuplet.type];
        beats = beats * (ratio.normal / ratio.actual);
      }
      usedBeats += beats;
    }

    // Get time-signature-aware max beats
    const timeSignature = compositionState.metadata?.timeSignature || { num: 4, denom: 4 };
    const maxBeats = getBeatsPerMeasureFromTimeSignature(timeSignature);

    // Calculate requested beats, accounting for tuplet insert mode
    let requestedBeats = this.durationToBeats(this.currentDuration, this.isDotted);
    if (this.tupletInsertMode && TUPLET_RATIOS[this.tupletInsertMode]) {
      const ratio = TUPLET_RATIOS[this.tupletInsertMode];
      requestedBeats = requestedBeats * (ratio.normal / ratio.actual);
    }
    const availableBeats = maxBeats - usedBeats;

    // Check if measure is already full
    const measureIsFull = Math.abs(usedBeats - maxBeats) < 0.01;

    // When inserting BEFORE a note, we're inserting at the same beat as the selected note.
    // This ALWAYS requires shifting notes forward (or truncating/deleting).
    // Calculate if shifting would cause overflow:
    const hasNotesAfterInsertPoint = noteIndex < voice.notes.length; // Always true for "insert before"
    const wouldOverflow = hasNotesAfterInsertPoint && (usedBeats + requestedBeats > maxBeats);

    // Show dialog if: overflow would occur, OR measure is already full, OR there's no room at all
    const needsDialog = wouldOverflow || measureIsFull || requestedBeats > availableBeats;

    if (needsDialog) {
      if (staff === 'treble') {
        const overflowBeats = Math.max(0, requestedBeats - availableBeats);

        showNoteOverflowDialog({
          overflowBeats,
          noteDuration: this.currentDuration,
          onChoice: (choice) => {
            if (choice === null) {
              console.log('[NoteEditor] User cancelled insert before');
              return;
            }

            if (choice === 'truncate') {
              // Truncate: Insert the note at the position and remove any notes that overflow
              // Calculate the beat position where we're inserting
              let insertBeat = 0;
              for (let i = 0; i < noteIndex; i++) {
                let beats = this.durationToBeats(voice.notes[i].duration || '4n');
                if (voice.notes[i].dotted) beats *= 1.5;
                insertBeat += beats;
              }

              // Use time-signature-aware max beats (maxBeats already calculated above)
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
              // Note truncated due to measure constraints
            } else if (choice === 'shift') {
              // Shift: use treble block sequence
              this.insertTrebleNoteWithShiftAtPosition(
                measureIndex,
                { action: 'before', noteIndex, voiceIndex },
                noteData,
                compositionState
              );
            }
          },
        });
        return;
      } else {
        // Bass clef - just block the insertion
        console.warn('[NoteEditor] Measure is full, cannot insert note');
        return;
      }
    }

    // No overflow - insert directly at the position
    // But we still need to shift notes forward properly, so use the shift function
    if (staff === 'treble') {
      this.insertTrebleNoteWithShiftAtPosition(
        measureIndex,
        { action: 'before', noteIndex, voiceIndex },
        noteData,
        compositionState
      );
    } else {
      // Bass clef - simple splice (single voice)
      // Calculate beat position for the new note
      let insertBeat = 0;
      for (let i = 0; i < noteIndex; i++) {
        let beats = this.durationToBeats(voice.notes[i].duration || '4n');
        if (voice.notes[i].dotted) beats *= 1.5;
        insertBeat += beats;
      }
      noteData.beat = insertBeat;

      // Update beats of notes that will be shifted
      let currentBeat = insertBeat + requestedBeats;
      for (let i = noteIndex; i < voice.notes.length; i++) {
        voice.notes[i].beat = currentBeat;
        let beats = this.durationToBeats(voice.notes[i].duration || '4n');
        if (voice.notes[i].dotted) beats *= 1.5;
        currentBeat += beats;
      }

      voice.notes.splice(noteIndex, 0, noteData);
      this.composerIntegration.render();
    }
  }

  /**
   * Insert a note after the last selected note
   */
  insertNoteAfterSelected() {
    if (this.selectedNotes.size === 0) return;

    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    // Get the last selected note
    const noteIds = Array.from(this.selectedNotes);
    const lastNoteId = noteIds[noteIds.length - 1];
    const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(lastNoteId);

    // Inserting after selected note

    // Create new note with current toolbar settings
    const noteData = {
      pitch: 'C4', // Default pitch, user can change it
      pitches: ['C4'],
      duration: this.currentDuration,
      dotted: this.isDotted,
      isRest: this.isRestMode,
      accidental: this.currentAccidental,
      articulation: this.currentArticulation,
    };

    const compositionState = window.getCompositionState?.();
    if (!compositionState || !compositionState.measures[measureIndex]) {
      console.warn('[NoteEditor] ❌ Could not access compositionState');
      return;
    }

    const measure = compositionState.measures[measureIndex];
    const voice = this.getVoice(measure, staff);

    // Check if the selected note is a tied continuation
    const targetNote = voice.notes?.[noteIndex];
    if (targetNote && targetNote.isTied) {
      console.log('[NoteEditor] Selected note is a tied continuation - inserting after the tied portion');
      // For tied notes, inserting "after" means after the tied portion ends in this measure
      // The insertTrebleNoteWithShiftAtPosition handles this correctly
    }

    // Calculate current beats used in measure
    let usedBeats = 0;
    for (const note of voice.notes) {
      let beats = this.durationToBeats(note.duration || '4n');
      if (note.dotted) beats *= 1.5;
      // Account for tuplet notes (e.g., triplet quarter notes take 0.667 beats, not 1)
      if (note.tuplet && note.tuplet.type && TUPLET_RATIOS[note.tuplet.type]) {
        const ratio = TUPLET_RATIOS[note.tuplet.type];
        beats = beats * (ratio.normal / ratio.actual);
      }
      usedBeats += beats;
    }

    // Get time-signature-aware max beats
    const timeSignature = compositionState.metadata?.timeSignature || { num: 4, denom: 4 };
    const maxBeats = getBeatsPerMeasureFromTimeSignature(timeSignature);

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

    // Check if inserting in the middle of existing notes (not at end)
    const hasNotesAfterInsertPoint = noteIndex < voice.notes.length - 1;

    if (isLastNote && measureIsFull) {
      console.log('[NoteEditor] Measure is full and trying to insert after last note - no space in this measure');
      // The measure is completely full - inserting after the last note means the new note
      // would start in the next measure. This is confusing UX, so we block it.
      alert('This measure is already full. To add more notes, click in the next measure or delete/shorten existing notes.');
      return;
    }

    // Show dialog when:
    // 1. There's overflow (requestedBeats > availableBeats), OR
    // 2. We're inserting in the middle and have notes after that would be displaced
    const needsDialog = requestedBeats > availableBeats || (hasNotesAfterInsertPoint && measureIsFull);

    if (needsDialog) {
      if (staff === 'treble') {
        const overflowBeats = requestedBeats - availableBeats;

        showNoteOverflowDialog({
          overflowBeats,
          noteDuration: this.currentDuration,
          onChoice: (choice) => {
            if (choice === null) {
              console.log('[NoteEditor] User cancelled insert after');
              return;
            }

            if (choice === 'truncate') {
              // Truncate: Insert the note after the selected and remove any notes that overflow
              // Calculate the beat position after the selected note
              let insertBeat = 0;
              for (let i = 0; i <= noteIndex; i++) {
                let beats = this.durationToBeats(voice.notes[i].duration || '4n');
                if (voice.notes[i].dotted) beats *= 1.5;
                insertBeat += beats;
              }

              // Use time-signature-aware max beats (maxBeats already calculated above)
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
                let noteBeats = this.durationToBeats(voice.notes[i].duration || '4n');
                if (voice.notes[i].dotted) noteBeats *= 1.5;

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
              console.log('[NoteEditor] ✅ Truncated note inserted after selected, overflow removed');
            } else if (choice === 'shift') {
              // Shift: use treble block sequence
              this.insertTrebleNoteWithShiftAtPosition(
                measureIndex,
                { action: 'after', noteIndex, voiceIndex },
                noteData,
                compositionState
              );
            }
          },
        });
        return;
      } else {
        // Bass clef - just block the insertion
        console.warn('[NoteEditor] Measure is full, cannot insert note');
        return;
      }
    }

    // No overflow - insert directly
    voice.notes.splice(noteIndex + 1, 0, noteData);
    this.composerIntegration.render();
    // Note inserted after selected note
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

    // Check for tuplet duration suffix (t=triplet, q=quintuplet, x=sextuplet)
    let baseDuration = duration;
    let tupletType = null;
    if (duration && typeof duration === 'string') {
      if (duration.endsWith('t') && /^\d+t$/.test(duration)) {
        baseDuration = duration.replace('t', 'n');
        tupletType = 'triplet';
      } else if (duration.endsWith('q') && /^\d+q$/.test(duration)) {
        baseDuration = duration.replace('q', 'n');
        tupletType = 'quintuplet';
      } else if (duration.endsWith('x') && /^\d+x$/.test(duration)) {
        baseDuration = duration.replace('x', 'n');
        tupletType = 'sextuplet';
      }
    }

    let beats = durationMap[baseDuration] || 1;

    // Apply tuplet ratio if this is a tuplet note
    if (tupletType && tupletRatios[tupletType]) {
      const ratio = tupletRatios[tupletType];
      beats = beats * (ratio.normal / ratio.actual);
    }

    if (dotted) {
      beats *= 1.5; // Dotted notes are 1.5x their base duration
    }
    return beats;
  }

  /**
   * Recalculate beat positions for all notes in a voice
   * @param {Array} notes - Array of notes in the voice
   */
  recalculateBeatPositions(notes) {
    let currentBeat = 0;
    console.log('[NoteEditor] ===== RECALCULATING BEAT POSITIONS =====');
    notes.forEach((note, index) => {
      note.beat = currentBeat;
      const noteBeats = this.durationToBeats(note.duration, note.dotted || false);
      console.log(`[NoteEditor] Note ${index}: duration=${note.duration}, dotted=${note.dotted}, tuplet=${JSON.stringify(note.tuplet)}, beat=${currentBeat.toFixed(3)}, noteBeats=${noteBeats.toFixed(3)}`);
      currentBeat += noteBeats;
    });
    console.log('[NoteEditor] Final beat positions:', notes.map(n => ({ duration: n.duration, beat: n.beat?.toFixed?.(3) || n.beat, tuplet: n.tuplet?.type })));
  }

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

    console.log('[NoteEditor] changeDurationOfSelected:', {
      newDuration,
      isDotted: this.isDotted,
      selectedNotes: Array.from(this.selectedNotes)
    });

    // For treble clef notes, check if duration change would cause overflow
    // and show dialog if needed
    const compositionState = window.getCompositionState?.();
    if (!compositionState) {
      console.warn('[NoteEditor] No compositionState available');
      return;
    }

    // Check for overflow scenarios in treble clef
    const trebleOverflows = [];

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);

      if (staff === 'treble') {
        const measure = compositionState.measures[measureIndex];
        if (measure) {
          const voice = measure.notation.treble.voices?.[voiceIndex] || this.getVoice(measure, 'treble');
          if (voice && voice.notes[noteIndex]) {
            const currentNote = voice.notes[noteIndex];
            const currentDuration = currentNote.duration || '4n';
            const currentDotted = currentNote.dotted || false;

            // When changing duration, preserve the note's current dotted state
            // (User must explicitly toggle dotted separately if they want to change it)
            const newDotted = currentDotted;

            // Skip if nothing is changing
            if (currentDuration === newDuration) {
              console.log('[NoteEditor] Duration unchanged, skipping:', noteId);
              continue;
            }

            const currentBeats = this.durationToBeats(currentDuration, currentDotted);
            const newBeats = this.durationToBeats(newDuration, newDotted);

            // Calculate current measure beats used (excluding this note)
            let usedBeats = 0;
            for (let i = 0; i < voice.notes.length; i++) {
              if (i !== noteIndex) {
                let beats = this.durationToBeats(voice.notes[i].duration || '4n');
                if (voice.notes[i].dotted) beats *= 1.5;
                usedBeats += beats;
              }
            }

            // Get time-signature-aware max beats
            const timeSignature = compositionState.metadata?.timeSignature || { num: 4, denom: 4 };
            const maxBeats = getBeatsPerMeasureFromTimeSignature(timeSignature);
            const availableBeats = maxBeats - usedBeats;

            if (newBeats > availableBeats) {
              trebleOverflows.push({
                noteId,
                measureIndex,
                noteIndex,
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
    }

    // If there are treble overflows, show dialog for the first one
    // (For simplicity, handle one at a time)
    if (trebleOverflows.length > 0) {
      const overflow = trebleOverflows[0];

      showNoteOverflowDialog({
        overflowBeats: overflow.overflowBeats,
        noteDuration: newDuration,
        onChoice: (choice) => {
          if (choice === null) {
            console.log('[NoteEditor] User cancelled duration change');
            return;
          }

          if (choice === 'truncate') {
            // Truncate: set duration to max that fits
            const fitDuration = this.beatsToDuration(overflow.availableBeats);
            this.applyDurationChange(newDuration, fitDuration.duration, fitDuration.dotted, [overflow.noteId]);
          } else if (choice === 'shift') {
            // Shift: use treble block sequence to handle the shift
            this.applyDurationChangeWithShift(overflow.measureIndex, overflow.noteIndex, newDuration, overflow.newDotted, compositionState);
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
          console.log(`[NoteEditor] BEFORE update - note duration:`, voice.notes[noteIndex].duration);
          voice.notes[noteIndex].duration = actualDuration;
          voice.notes[noteIndex].dotted = isDotted;
          console.log(`[NoteEditor] AFTER update - note duration:`, voice.notes[noteIndex].duration, 'dotted:', voice.notes[noteIndex].dotted);
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
    }

    if (changedCount > 0) {
      console.log(`[NoteEditor] Calling render(true) after changing ${changedCount} note(s)`);
      this.composerIntegration.render(true);
      console.log(`[NoteEditor] ✅ Changed duration of ${changedCount} note(s) to ${actualDuration}`);

      setTimeout(() => {
        this.renderOverlay();
        console.log('[NoteEditor] Refreshed overlay after duration change');
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
            console.log(`[NoteEditor] Duration already ${newDuration}, skipping:`, noteId);
            continue;
          }

          console.log(`[NoteEditor] Changing duration: ${currentNote.duration} -> ${newDuration}, preserving dotted: ${currentNote.dotted}`);
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
      console.log(`[NoteEditor] Calling render(true) after changing ${changedCount} note(s)`);
      this.composerIntegration.render(true);
      console.log(`[NoteEditor] ✅ Changed duration of ${changedCount} note(s) to ${newDuration}`);

      setTimeout(() => {
        this.renderOverlay();
        console.log('[NoteEditor] Refreshed overlay after duration change');
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
    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;
    const UNITS_PER_BEAT = 48;

    // Get the note's unit position
    const noteUnit = compositionState.getTrebleNoteUnit(measureIndex, noteIndex);
    if (!noteUnit) {
      console.warn('[NoteEditor] Could not find note unit for duration change with shift');
      return;
    }

    // Calculate the duration difference in units
    const currentBeats = this.durationToBeats(noteUnit.note.duration || '4n', noteUnit.note.dotted);
    let newBeats = this.durationToBeats(newDuration);
    if (isDotted) newBeats *= 1.5;
    const beatDelta = newBeats - currentBeats;

    if (beatDelta <= 0) {
      // Duration is being reduced - just apply it directly
      this.applyDurationChange(newDuration, newDuration, isDotted, [`${measureIndex}-treble-${noteIndex}`]);
      return;
    }

    // Duration is being increased - need to shift downstream notes
    const shiftUnits = Math.round(beatDelta * UNITS_PER_BEAT);

    // Get the treble block and shift units from the end of this note forward
    if (compositionState.trebleBlockSequence?.blocks?.length > 0) {
      const block = compositionState.trebleBlockSequence.blocks[0];
      const noteEndUnit = noteUnit.startUnit + Math.round(currentBeats * UNITS_PER_BEAT);

      // First, update the note's duration in the measure
      const measure = compositionState.measures[measureIndex];
      const voice = this.getVoice(measure, 'treble');
      voice.notes[noteIndex].duration = newDuration;
      voice.notes[noteIndex].dotted = isDotted;

      // Then sync to block sequence (this will recalculate everything)
      compositionState.syncMeasuresToTrebleBlock();

      // Expand the block and shift downstream content
      const totalUnits = block.units.length;
      const newTotalUnits = totalUnits + shiftUnits;
      const newTotalBeats = Math.ceil(newTotalUnits / UNITS_PER_BEAT);
      block.setDuration(newTotalBeats);

      // Shift units from noteEndUnit forward
      for (let i = block.units.length - 1; i >= noteEndUnit + shiftUnits; i--) {
        const sourceIndex = i - shiftUnits;
        if (sourceIndex >= noteEndUnit && sourceIndex < totalUnits) {
          const sourceUnit = block.units[sourceIndex];
          block.units[i] = sourceUnit.clone();
          if (block.units[i].parentIndex !== null && block.units[i].parentIndex >= noteEndUnit) {
            block.units[i].parentIndex += shiftUnits;
          }
        }
      }

      // Fill the gap with the extended note
      const pitches = noteUnit.note.pitches || (noteUnit.note.pitch ? [noteUnit.note.pitch] : []);
      block.setNote(noteUnit.startUnit, Math.round(newBeats * UNITS_PER_BEAT), pitches, {
        articulation: noteUnit.note.articulation,
        accidental: noteUnit.note.accidental,
      });

      // Ensure we have enough measures
      const requiredMeasures = Math.ceil(newTotalBeats / beatsPerMeasure);
      while (compositionState.measures.length < requiredMeasures) {
        compositionState.addMeasure({});
      }

      // Re-render to measures
      compositionState.renderTrebleBlocksToMeasures();
    }

    this.composerIntegration.render(true);
    console.log('[NoteEditor] ✅ Applied duration change with shift');

    setTimeout(() => {
      this.renderOverlay();
    }, 50);
  }

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
            console.log('[NoteEditor] ✅ Updated articulation in compositionState');
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
      console.log(`[NoteEditor] Toggled ${articulation} on ${changedCount} note(s)`);
    }
  }

  /**
   * Toggle tie on all selected notes
   */
  toggleTieOnSelected() {
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
            // Toggle tied state
            note.tied = !note.tied;
            changedCount++;
            console.log('[NoteEditor] ✅ Updated tie in compositionState');
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
      console.log(`[NoteEditor] Toggled tie on ${changedCount} note(s)`);
    }
  }

  /**
   * Toggle dotted on all selected notes
   */
  toggleDottedOnSelected() {
    if (this.selectedNotes.size === 0) return;

    // Save state for undo before making changes
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    let changedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, voiceIndex, noteIndex] = this.parseNoteId(noteId);

      // Update compositionState directly
      if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState && compositionState.measures[measureIndex]) {
          const measure = compositionState.measures[measureIndex];
          const voiceKey = staff === 'treble' ? 'treble' : 'bass';
          const voice = measure.notation[voiceKey]?.voices?.[voiceIndex] || this.getVoice(measure, staff);
          if (voice && voice.notes[noteIndex]) {
            const note = voice.notes[noteIndex];
            // Toggle dotted state
            note.dotted = !note.dotted;
            changedCount++;
            console.log('[NoteEditor] ✅ Toggled dotted in compositionState');
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
      console.log(`[NoteEditor] Toggled dotted on ${changedCount} note(s)`);
    }
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
          if (noteIndex === -1 && this.autoGeneratedRestInfo?.has(noteId)) {
            const restInfo = this.autoGeneratedRestInfo.get(noteId);
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
            this.autoGeneratedRestInfo.delete(noteId);

            changedCount++;
            console.log('[NoteEditor] ✅ Created note from auto-generated rest at beat:', restInfo.beat);
            continue;
          }

          const voice = this.getVoice(measure, staff);
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
            console.log('[NoteEditor] ✅ Toggled rest mode in compositionState, isRest:', note.isRest);
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
      console.log(`[NoteEditor] Toggled rest on ${changedCount} note(s)`);
    }
  }

  /**
   * Create a tuplet from selected notes
   * @param {string} tupletType - 'triplet', 'quintuplet', or 'sextuplet'
   */
  createTupletFromSelection(tupletType) {
    if (this.selectedNotes.size < 2) {
      console.log('[NoteEditor] Need at least 2 notes to create a tuplet');
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
      console.log('[NoteEditor] Tuplet notes must be in the same measure');
      return;
    }

    if (!allSameStaff) {
      console.log('[NoteEditor] Tuplet notes must be on the same staff');
      return;
    }

    // Validate: Notes must be consecutive
    for (let i = 1; i < parsedNotes.length; i++) {
      if (parsedNotes[i].noteIndex !== parsedNotes[i - 1].noteIndex + 1) {
        console.log('[NoteEditor] Tuplet notes must be consecutive');
        return;
      }
    }

    // Validate: Number of notes must match tuplet type
    const expectedNotes = tupletInfo.actual;
    if (parsedNotes.length !== expectedNotes) {
      console.log(`[NoteEditor] ${tupletType} requires exactly ${expectedNotes} notes, but ${parsedNotes.length} selected`);
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
    const durationToBeats = (duration) => {
      const map = { '1n': 4, '2n': 2, '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125 };
      const baseDur = duration.replace(/[tqx.]$/, '');
      return map[baseDur] || 1;
    };

    let originalTotalBeats = 0;
    for (let i = 0; i < parsedNotes.length; i++) {
      const noteData = voice.notes[parsedNotes[i].noteIndex];
      if (noteData) {
        let beats = durationToBeats(noteData.duration || '4n');
        if (noteData.dotted) beats *= 1.5;
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

        console.log(`[NoteEditor] Applied tuplet to note ${parsedNotes[i].noteIndex}:`, JSON.stringify(noteData.tuplet), 'duration:', noteData.duration);
        console.log(`[NoteEditor] Full note data after tuplet:`, JSON.stringify(noteData));
      }
    }

    // Calculate new total beats after tuplet conversion
    // Tuplet takes up (normal/actual) of the original time
    // e.g., triplet: 3 notes in time of 2, so 3 quarter notes become 2 beats
    const tupletTotalBeats = originalTotalBeats * (tupletInfo.normal / tupletInfo.actual);
    const savedBeats = originalTotalBeats - tupletTotalBeats;

    console.log(`[NoteEditor] Tuplet conversion: ${originalTotalBeats} beats -> ${tupletTotalBeats} beats (saved ${savedBeats} beats)`);

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
        // Calculate the existing rest's beats
        let existingRestBeats = durationToBeats(nextNote.duration || '4n');
        if (nextNote.dotted) existingRestBeats *= 1.5;

        // Combine the beats
        const combinedBeats = savedBeats + existingRestBeats;
        const combinedDuration = beatsToDuration(combinedBeats);

        // Update the existing rest with the combined duration
        nextNote.duration = combinedDuration;
        nextNote.dotted = false; // Reset dotted since we recalculated

        console.log(`[NoteEditor] Combined rests: ${savedBeats} + ${existingRestBeats} = ${combinedBeats} beats (${combinedDuration})`);
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
        console.log(`[NoteEditor] Inserted ${restDuration} rest after tuplet to fill ${savedBeats} beats`);
      }
    }

    // CRITICAL: Recalculate beat positions after tuplet modification
    // The tuplet notes now have shorter durations, so their beat positions must be updated
    console.log('[NoteEditor] Before recalculating beats - voice.notes:', voice.notes.map(n => ({ duration: n.duration, beat: n.beat, tuplet: n.tuplet?.type })));
    this.recalculateBeatPositions(voice.notes);
    console.log('[NoteEditor] After recalculating beats - voice.notes:', voice.notes.map(n => ({ duration: n.duration, beat: n.beat?.toFixed?.(3) || n.beat, tuplet: n.tuplet?.type })));

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
    console.log(`[NoteEditor] Created ${tupletType} from ${parsedNotes.length} notes`);

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
      console.log('[NoteEditor] No notes selected to remove tuplet from');
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
      console.log(`[NoteEditor] Removed tuplet from ${changedCount} note(s)`);

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

      console.log(`[NoteEditor] Entered ${tupletType} insert mode (${tupletInfo.actual} notes needed)`);

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
      console.log(`[NoteEditor] Cancelling partial tuplet with ${partialNotes} notes`);
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

    console.log('[NoteEditor] Exited tuplet insert mode');

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
    console.log('[NoteEditor] Removed partial tuplet attributes');
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
        console.log('[NoteEditor] Tuplet notes must be in same measure/staff');
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

    console.log(`[NoteEditor] Added tuplet note ${notes.length}/${target}`);

    // Check if tuplet is complete
    if (notes.length >= target) {
      console.log(`[NoteEditor] Completed ${this.tupletInsertMode}`);

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
        console.log('[NoteEditor] Tuplet notes must be in same measure/staff - exiting tuplet mode');
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

    console.log(`[NoteEditor] Applied tuplet to new note ${notes.length}/${target}`);

    // Check if tuplet is complete
    if (notes.length >= target) {
      console.log(`[NoteEditor] Completed ${this.tupletInsertMode} (${target} notes)`);

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

  /**
   * Parse note ID to get location
   * @param {string} noteId - Note ID like "0-treble-1" or "0-treble-1-2" for pitch index
   * @returns {Array} - [measureIndex, staff, noteIndex, pitchIndex] (pitchIndex is null for whole notes)
   */
  /**
   * Parse note ID into components
   * Format: measureIndex-staff-voiceIndex-noteIndex[-pitchIndex]
   * Legacy format (without voiceIndex): measureIndex-staff-noteIndex[-pitchIndex]
   */
  parseNoteId(noteId) {
    const parts = noteId.split('-');

    // Check if this is the new format (5 parts with pitchIndex, or 4 parts without)
    // or legacy format (4 parts with pitchIndex, or 3 parts without)
    // New format: measureIndex-staff-voiceIndex-noteIndex[-pitchIndex]
    // Legacy format: measureIndex-staff-noteIndex[-pitchIndex]

    if (parts.length >= 4 && !isNaN(parseInt(parts[2], 10)) && !isNaN(parseInt(parts[3], 10))) {
      // New format with voiceIndex
      return [
        parseInt(parts[0], 10),           // measureIndex
        parts[1],                          // staff
        parseInt(parts[2], 10),           // voiceIndex
        parseInt(parts[3], 10),           // noteIndex
        parts.length > 4 ? parseInt(parts[4], 10) : null,  // pitchIndex
      ];
    } else {
      // Legacy format without voiceIndex - assume voice 0
      return [
        parseInt(parts[0], 10),           // measureIndex
        parts[1],                          // staff
        0,                                 // voiceIndex (default to 0)
        parseInt(parts[2], 10),           // noteIndex
        parts.length > 3 ? parseInt(parts[3], 10) : null,  // pitchIndex
      ];
    }
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
    const baseId = `${measureIndex}-${staff}-${voiceIndex}-${noteIndex}`;
    return pitchIndex !== null ? `${baseId}-${pitchIndex}` : baseId;
  }

  /**
   * Get the base note ID (without pitch index) from a potentially pitch-specific ID
   * New format: measureIndex-staff-voiceIndex-noteIndex[-pitchIndex] -> measureIndex-staff-voiceIndex-noteIndex
   * Legacy format: measureIndex-staff-noteIndex[-pitchIndex] -> measureIndex-staff-0-noteIndex (normalized)
   * @param {string} noteId - Note ID
   * @returns {string} - Base note ID (measureIndex-staff-voiceIndex-noteIndex)
   */
  getBaseNoteId(noteId) {
    const parts = noteId.split('-');
    // New format: 4+ parts means we have voiceIndex
    if (parts.length >= 4 && !isNaN(parseInt(parts[2], 10)) && !isNaN(parseInt(parts[3], 10))) {
      // New format: measureIndex-staff-voiceIndex-noteIndex[-pitchIndex]
      return `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}`;
    } else {
      // Legacy format: measureIndex-staff-noteIndex[-pitchIndex] -> normalize to new format with voice 0
      return `${parts[0]}-${parts[1]}-0-${parts[2]}`;
    }
  }

  /**
   * Check if a note ID refers to a specific pitch within a chord
   * New format: measureIndex-staff-voiceIndex-noteIndex-pitchIndex (5 parts)
   * Legacy format: measureIndex-staff-noteIndex-pitchIndex (4 parts)
   * @param {string} noteId - Note ID
   * @returns {boolean} - True if ID includes pitch index
   */
  hasPitchIndex(noteId) {
    const parts = noteId.split('-');
    // New format has 5 parts with pitchIndex, legacy has 4 parts with pitchIndex
    if (parts.length >= 4 && !isNaN(parseInt(parts[2], 10)) && !isNaN(parseInt(parts[3], 10))) {
      // New format
      return parts.length > 4;
    } else {
      // Legacy format
      return parts.length > 3;
    }
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
   * Select a note
   * @param {string} noteId - Note ID
   */
  selectNote(noteId) {
    this.selectedNotes.add(noteId);
    this.hideSelectionHighlight = false; // Show highlight when selecting
    this.onNoteSelect(Array.from(this.selectedNotes));
    this.renderOverlay();
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
   * Convert duration string to beats (quarter notes) - with tuplet support
   * @param {string} duration - Duration like "4n", "2n", "8n", "8t" (triplet), etc.
   * @returns {number} - Number of beats
   */
  durationToBeats(duration) {
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

    // Check for tuplet duration suffix
    let baseDuration = duration;
    let tupletType = null;
    if (duration && typeof duration === 'string') {
      if (duration.endsWith('t') && /^\d+t$/.test(duration)) {
        baseDuration = duration.replace('t', 'n');
        tupletType = 'triplet';
      } else if (duration.endsWith('q') && /^\d+q$/.test(duration)) {
        baseDuration = duration.replace('q', 'n');
        tupletType = 'quintuplet';
      } else if (duration.endsWith('x') && /^\d+x$/.test(duration)) {
        baseDuration = duration.replace('x', 'n');
        tupletType = 'sextuplet';
      }
    }

    let beats = durationMap[baseDuration] || 1;

    // Apply tuplet ratio if this is a tuplet note
    if (tupletType && tupletRatios[tupletType]) {
      const ratio = tupletRatios[tupletType];
      beats = beats * (ratio.normal / ratio.actual);
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
            let beats = this.durationToBeats(note.duration || '4n');
            if (note.dotted) beats *= 1.5;
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
      const duration = region.duration || '4n'; // Default to quarter note
      let beats = this.durationToBeats(duration);
      if (region.dotted) {
        beats *= 1.5;
      }
      return total + beats;
    }, 0);
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
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    const timeSignature = compositionState?.metadata?.timeSignature || { num: 4, denom: 4 };
    const maxBeats = getBeatsPerMeasureFromTimeSignature(timeSignature);

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
    // Get time signature from compositionState
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    const timeSignature = compositionState?.metadata?.timeSignature || { num: 4, denom: 4 };
    const maxBeats = getBeatsPerMeasureFromTimeSignature(timeSignature);
    const usedBeats = this.getMeasureBeatsUsed(measureIndex, staff);
    return maxBeats - usedBeats;
  }

  /**
   * Get current beat position in a measure (where next note would be added)
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @returns {number} - Beat position (0-4 for 4/4 time)
   */
  getCurrentBeat(measureIndex, staff) {
    // Get time signature from compositionState
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    const timeSignature = compositionState?.metadata?.timeSignature || { num: 4, denom: 4 };
    const maxBeats = getBeatsPerMeasureFromTimeSignature(timeSignature);
    return maxBeats - this.getRemainingBeats(measureIndex, staff);
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
   * Note: This is a duplicate method - the primary one is at line ~2011
   * @param {string} duration - Duration like '4n', '8n', '8t' (triplet), etc.
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

    // Check for tuplet duration suffix
    let baseDuration = duration;
    let tupletType = null;
    if (duration && typeof duration === 'string') {
      if (duration.endsWith('t') && /^\d+t$/.test(duration)) {
        baseDuration = duration.replace('t', 'n');
        tupletType = 'triplet';
      } else if (duration.endsWith('q') && /^\d+q$/.test(duration)) {
        baseDuration = duration.replace('q', 'n');
        tupletType = 'quintuplet';
      } else if (duration.endsWith('x') && /^\d+x$/.test(duration)) {
        baseDuration = duration.replace('x', 'n');
        tupletType = 'sextuplet';
      }
    }

    let beats = baseDurations[baseDuration] || 1;

    // Apply tuplet ratio if this is a tuplet note
    if (tupletType && tupletRatios[tupletType]) {
      const ratio = tupletRatios[tupletType];
      beats = beats * (ratio.normal / ratio.actual);
    }

    return dotted ? beats * 1.5 : beats;
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

    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;

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

    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;
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
          let noteBeats = this.durationToBeats(note.duration || '4n');
          if (note.dotted) noteBeats *= 1.5;
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

    // Create ghost note data
    this.ghostNote = {
      pitch: staffPosition.pitch,
      staff: staffPosition.staff,
      measure: staffPosition.measure,
      duration: this.currentDuration,
      isRest: this.isRestMode,
      mouseX: mouseX, // Store mouse X for accurate positioning
      mouseY: mouseY, // Store mouse Y for accurate positioning
    };

    // Get harmonic coloring based on the hovered measure's chord
    // staffPosition.measure is the measureBounds object, use .index to get measure number
    const measureIndex = staffPosition.measure?.index;
    if (!this.isRestMode && measureIndex !== undefined) {
      // Get chord for the current measure being hovered
      const compositionState = window.getCompositionState?.();
      const chord = compositionState?.getChord?.(measureIndex) || this.chordContext;
      const key = compositionState?.metadata?.key || this.keySignature || 'C';

      if (chord) {
        const analysis = analyzeChordTone(
          staffPosition.pitch,
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
      console.log('[NoteEditor] Skipping highlight rendering (hideSelectionHighlight=true)');
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
      const systemMarginTop = 20;
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
    console.log('[NoteEditor] setDuration called:', duration, '(was:', this.currentDuration, ')');
    this.currentDuration = duration;
  }

  /**
   * Set rest mode
   * @param {boolean} isRest - Whether to insert rests
   */
  setRestMode(isRest) {
    console.log('[NoteEditor] setRestMode called:', isRest, '(was:', this.isRestMode, ')');
    this.isRestMode = isRest;
  }

  /**
   * Set dotted mode
   * @param {boolean} isDotted - Whether to insert dotted notes
   */
  setDotted(isDotted) {
    console.log('[NoteEditor] setDotted called:', isDotted, '(was:', this.isDotted, ')');
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
   * Set current articulation
   * @param {string|null} articulation - 'staccato', 'accent', 'tenuto', 'marcato', or null
   */
  setArticulation(articulation) {
    this.currentArticulation = articulation;
    console.log('[NoteEditor] Articulation set to:', articulation);
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
      console.log('[NoteEditor] No notes selected to copy');
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
      console.log('[NoteEditor] No valid notes found to copy');
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
    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;

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

    console.log(`[NoteEditor] Copied ${notesToCopy.length} notes to clipboard`);

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
        console.log('[NoteEditor] No selection - cannot determine which building block to copy');
        return;
      }

      // Get chord index from first selected note
      const firstNoteId = Array.from(this.selectedNotes)[0];
      const [measureIndex] = this.parseNoteId(firstNoteId);
      const measure = compositionState.measures[measureIndex];
      if (measure && measure.chord) {
        chordIndex = measure.chord.chordIndex;
      } else {
        console.log('[NoteEditor] Cannot determine chord index from selection');
        return;
      }
    }

    const segment = compositionState.getChordSegment?.(chordIndex);
    if (!segment) {
      console.log('[NoteEditor] No chord segment found for index:', chordIndex);
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
    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;

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
      console.log('[NoteEditor] No notes found in building block');
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
      console.log('[NoteEditor] Extracted bass pitches for lhNotes:', bassPitches);
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

    console.log(`[NoteEditor] Copied building block: ${trebleNotes.length} treble + ${bassNotes.length} bass notes, chord:`, fullChordData, 'bassPitches:', bassPitches);

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
      console.log('[NoteEditor] Nothing in clipboard to paste');
      return;
    }

    // Handle building block paste
    if (this.clipboard.type === 'buildingBlock') {
      this.pasteBuildingBlock(position);
      return;
    }

    if (this.clipboard.type !== 'notes') {
      console.log('[NoteEditor] Unknown clipboard type:', this.clipboard.type);
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
      const noteBeats = this.getDurationInBeats(item.note.duration || '4n');
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

    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;
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
          const durationBeats = this.getDurationInBeats(lastNote.duration || '4n');
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
            maxPosition = { measureIndex, beat: note.beat || 0, duration: note.duration || '4n' };
          }
        }

        if (maxPosition.measureIndex >= 0) {
          const durationBeats = this.getDurationInBeats(maxPosition.duration);
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
    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;

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

    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;

    // Shift all notes after the paste position forward
    this.shiftNotesForward(startMeasure, startBeat, shiftBeats, staff, compositionState, beatsPerMeasure);

    // Now paste the notes
    this.executePasteDirectly(startMeasure, startBeat, staff);
  }

  /**
   * Shift notes forward by a given number of beats
   * @param {number} fromMeasure - Starting measure index
   * @param {number} fromBeat - Starting beat position
   * @param {number} shiftBeats - Number of beats to shift forward
   * @param {string} staff - 'treble' or 'bass'
   * @param {Object} compositionState - The composition state
   * @param {number} beatsPerMeasure - Beats per measure
   * @param {number|null} targetVoiceIndex - If provided, only shift this voice. If null/undefined, shift all voices.
   */
  shiftNotesForward(fromMeasure, fromBeat, shiftBeats, staff, compositionState, beatsPerMeasure, targetVoiceIndex = null) {
    const voiceInfo = targetVoiceIndex !== null ? `voice ${targetVoiceIndex + 1} only` : 'all voices';
    console.log(`[shift] Shifting notes in ${staff} (${voiceInfo}) from measure ${fromMeasure}, beat ${fromBeat} by ${shiftBeats} beats`);
    // Collect notes that need to be shifted
    const notesToShift = [];

    for (let m = fromMeasure; m < compositionState.measures.length; m++) {
      const measure = compositionState.measures[m];
      if (!measure) continue;

      // MULTI-VOICE: Get all voices for the staff
      const voices = staff === 'treble' ? measure.notation.treble?.voices : measure.notation.bass?.voices;
      if (!voices) continue;

      // Iterate through voices (only target voice if specified, otherwise all)
      voices.forEach((voice, voiceIndex) => {
        // Skip if we're targeting a specific voice and this isn't it
        if (targetVoiceIndex !== null && voiceIndex !== targetVoiceIndex) return;

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

    // Preparing to shift notes forward
    const voiceCounts = {};
    notesToShift.forEach(item => {
      const voiceNum = item.voiceIndex + 1;
      if (!voiceCounts[voiceNum]) voiceCounts[voiceNum] = [];
      voiceCounts[voiceNum].push(`${item.note.pitch || item.note.pitches?.join(',')}@beat${item.note.beat}`);
    });
    Object.keys(voiceCounts).forEach(voiceNum => {
      console.log(`  Voice ${voiceNum}: ${voiceCounts[voiceNum].join(' | ')}`);
    });

    // Re-insert notes at shifted positions
    for (const item of notesToShift) {
      const oldAbsoluteBeat = item.measureIndex * beatsPerMeasure + (item.note.beat || 0);
      const newAbsoluteBeat = oldAbsoluteBeat + shiftBeats;
      const newMeasure = Math.floor(newAbsoluteBeat / beatsPerMeasure);
      const newBeat = newAbsoluteBeat % beatsPerMeasure;

      console.log(`[shiftNotesForward] Shifting note from measure ${item.measureIndex} beat ${item.note.beat} to measure ${newMeasure} beat ${newBeat}`);

      // Add measures if needed (instead of skipping)
      while (newMeasure >= compositionState.measures.length) {
        console.log(`[shiftNotesForward] Adding new measure ${compositionState.measures.length}`);
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
        console.log(`[shiftNotesForward] Creating voice ${voices.length} in measure ${newMeasure}`);
        voices.push({ notes: [] });
      }
      const voice = voices[item.voiceIndex];

      // Check if note needs to be split across measure boundary
      const noteDuration = this.getDurationInBeats(item.note.duration || '4n');
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
          console.log(`[shiftNotesForward] Adding measure ${compositionState.measures.length} for tied note continuation`);
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
   * Execute paste by deleting notes after position
   */
  executePasteWithDelete(startMeasure, startBeat, staff) {
    const compositionState = window.getCompositionState?.();
    if (!compositionState) return;

    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;

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

    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;
    const pastedNoteIds = [];

    for (const item of this.clipboard.data) {
      const absoluteBeat = startBeat + item.relativeBeat;
      let targetMeasure = startMeasure + Math.floor(absoluteBeat / beatsPerMeasure);
      let targetBeat = absoluteBeat % beatsPerMeasure;

      if (targetMeasure >= compositionState.measures.length) {
        console.log('[NoteEditor] Skipping note - would exceed composition length');
        continue;
      }

      const measure = compositionState.measures[targetMeasure];
      if (!measure) continue;

      const voice = this.getVoice(measure, staff);
      if (!voice) continue;

      // Check if note needs to be split
      const noteDuration = this.getDurationInBeats(item.note.duration || '4n');
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
      console.log(`[NoteEditor] Pasted ${pastedNoteIds.length} notes`);

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
    if (beats >= 4) return '1n';
    if (beats >= 3) return '2n.';
    if (beats >= 2) return '2n';
    if (beats >= 1.5) return '4n.';
    if (beats >= 1) return '4n';
    if (beats >= 0.75) return '8n.';
    if (beats >= 0.5) return '8n';
    if (beats >= 0.25) return '16n';
    return '32n';
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
      console.log('[NoteEditor] No building block in clipboard');
      return;
    }

    const compositionState = window.getCompositionState?.();
    if (!compositionState) {
      console.warn('[NoteEditor] No composition state available');
      return;
    }

    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;
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
      console.log('[NoteEditor] Shifting existing treble and bass notes to accommodate pasted building block');
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

    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;
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

    const beatsPerMeasure = compositionState.metadata?.timeSignature?.num || 4;
    const durationBeats = this.clipboard.durationBeats || 4;

    // Debug logging - show full pitch information
    console.log('[NoteEditor] executeBuildingBlockPasteDirectly:', {
      startBeat,
      insertChordIndex,
      durationBeats,
      hasChordData: !!this.clipboard.chordData,
      chordData: this.clipboard.chordData,
      lhNotes: this.clipboard.chordData?.lhNotes,
      hasInsertFn: !!window.insertChordCardAt,
      bassNotesCount: this.clipboard.bassNotes?.length,
      bassNotes: this.clipboard.bassNotes?.map(n => ({
        relativeBeat: n.relativeBeat,
        pitch: n.note.pitch,
        pitches: n.note.pitches,
        duration: n.note.duration
      })),
      bassPitchesFromClipboard: this.clipboard.bassPitches
    });

    // Insert the chord card into the progression if we have chord data
    // NOTE: This may trigger syncWithProgressionData which regenerates bass notes
    if (this.clipboard.chordData && window.insertChordCardAt) {
      try {
        const result = window.insertChordCardAt(insertChordIndex, this.clipboard.chordData, durationBeats);
        console.log(`[NoteEditor] Inserted chord card at index ${insertChordIndex}, result:`, result);
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
          console.log('[NoteEditor] Skipping note - beyond composition');
          continue;
        }

        const measure = compositionState.measures[targetMeasure];
        if (!measure) continue;

        const voice = this.getVoice(measure, staff);
        if (!voice) continue;

        const noteDuration = this.getDurationInBeats(item.note.duration || '4n');
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
          console.log(`[NoteEditor] Pasting ${staff} note:`, {
            targetMeasure,
            targetBeat,
            chordIndex: insertChordIndex,
            pitches: newNote.pitches,
            pitch: newNote.pitch,
            originalPitches: item.note.pitches,
            originalPitch: item.note.pitch
          });
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
      console.log(`[NoteEditor] Pasted building block: ${trebleIds.length} treble + ${bassIds.length} bass notes`);

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
        console.log('[NoteEditor] Synced pasted bass notes to BuildingBlockSequence');
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
    console.log(`[NoteEditor] Shifting selected notes ${direction > 0 ? 'up' : 'down'} one octave`);

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
      console.log(`[NoteEditor] Shifted ${changedCount} note(s) by one octave`);
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
  getDurationInBeats(duration) {
    const map = {
      '1n': 4, '1n.': 6,
      '2n': 2, '2n.': 3,
      '4n': 1, '4n.': 1.5,
      '8n': 0.5, '8n.': 0.75,
      '16n': 0.25, '16n.': 0.375,
      '32n': 0.125,
    };
    return map[duration] || 1;
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
