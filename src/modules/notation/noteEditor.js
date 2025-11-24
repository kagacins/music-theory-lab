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

    // Chord context for coloring
    this.chordContext = null;
    this.keySignature = 'C';

    // Callbacks
    this.onNoteAdd = options.onNoteAdd || (() => {});
    this.onNoteMove = options.onNoteMove || (() => {});
    this.onNoteSelect = options.onNoteSelect || (() => {});
    this.onNoteDelete = options.onNoteDelete || (() => {});
    this.onPolyphonyAdd = options.onPolyphonyAdd || (() => {});

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
   * CRITICAL: Only attach to pages that don't already have listeners to prevent duplicates
   */
  attachPageEventListeners() {
    if (!this.pageManager) return;

    // Attach to all existing pages
    const pages = this.pageManager.getAllPages();
    pages.forEach(page => {
      // Skip if this page already has listeners attached
      const pageId = page.canvas.id;
      if (this.pagesWithListeners.has(pageId)) {
        return;
      }

      // Attach listeners
      page.canvas.addEventListener('mousedown', this.handleMouseDown);
      page.canvas.addEventListener('mousemove', this.handleMouseMove);
      page.canvas.addEventListener('mouseup', this.handleMouseUp);
      page.canvas.addEventListener('mouseleave', this.handleMouseLeave);

      // Mark this page as having listeners
      this.pagesWithListeners.add(pageId);
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

    // REMOVED: Hover toolbar click handling - now using contextual top toolbar

    let staffPosition = this.layoutManager.getStaffPositionAtPoint(position.x, position.y);

    // When Alt is held, prefer the last hovered position (ghost note)
    if (e.altKey && this.hoveredPosition && this.hoveredPosition.pitch) {
      staffPosition = this.hoveredPosition;
    }

    // Check if clicking on an existing note FIRST (before checking Alt key)
    const clickedNote = this.findNoteAtPosition(position.x, position.y);

    if (clickedNote) {
      // Clicking on a note - handle selection (works with or without Alt)
      e.stopPropagation();
      e.preventDefault();

      if (e.shiftKey) {
        // Shift+Click = add to selection
        this.toggleNoteSelection(clickedNote.id);
      } else if (e.altKey && this.selectedNotes.has(clickedNote.id)) {
        // Alt+Click on selected note(s) = start dragging
        this.startDrag(position, staffPosition);
      } else {
        // Regular click = select this note only
        this.clearSelection();
        this.selectNote(clickedNote.id);
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
        this.onPolyphonyAdd({
          measureIndex: selectedNoteInMeasure.measureIndex,
          staff: selectedNoteInMeasure.staff,
          noteIndex: selectedNoteInMeasure.noteIndex,
          pitch: staffPosition.pitch,
        });
      } else if (e.shiftKey && this.canAddPitchToNearbyNote(staffPosition)) {
        // Legacy: Shift+Alt+Click adds to last note in measure (kept for compatibility)
        console.log('[NoteEditor] Using legacy Shift+Alt+Click polyphony');
        this.addPitchToNearbyNote(staffPosition);
      } else {
        // Add a new note at this position (different measure or no selection)
        console.log('[NoteEditor] Adding new note at position');
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
      console.log('[NoteEditor] getSelectedNoteInMeasure: No measure, regions, or selection');
      return null;
    }

    console.log('[NoteEditor] Looking for selected note in measure', staffPosition.measure.index, 'staff', staffPosition.staff);
    console.log('[NoteEditor] Currently selected notes:', Array.from(this.selectedNotes));

    // Find selected notes in the same measure and staff
    for (const noteId of this.selectedNotes) {
      const region = this.noteRegions.find(r => {
        const regionId = this.createNoteId(r.measureIndex, r.staff, r.noteIndex);
        return regionId === noteId &&
               r.measureIndex === staffPosition.measure.index &&
               r.staff === staffPosition.staff;
      });

      if (region) {
        console.log('[NoteEditor] Found selected note in same measure:', region);
        return region;
      }
    }

    console.log('[NoteEditor] No selected note found in this measure');
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

      // Emit polyphony add event
      this.onPolyphonyAdd({
        measureIndex: targetNote.measureIndex,
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

    // Escape to deselect notes (clears selection entirely)
    if (e.key === 'Escape') {
      if (this.selectedNotes.size > 0) {
        e.preventDefault();
        console.log('[NoteEditor] Esc pressed - deselecting all notes');
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
        console.log('[NoteEditor] ArrowUp pressed, moving notes up');
        e.preventDefault();
        this.moveSelectedNotes(1); // Up one step
      } else if (e.key === 'ArrowDown') {
        console.log('[NoteEditor] ArrowDown pressed, moving notes down');
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
   * @returns {Object|null} - Note data or null
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

    // Check each note region for intersection
    for (const region of this.noteRegions) {
      if (!region.bounds) continue;

      const { x: rx, y: ry, width, height } = region.bounds;

      // Check if point is within bounding box (comparing layout coordinates)
      if (layoutX >= rx && layoutX <= rx + width && layoutY >= ry && layoutY <= ry + height) {
        return {
          id: this.createNoteId(region.measureIndex, region.staff, region.noteIndex),
          measureIndex: region.measureIndex,
          staff: region.staff,
          noteIndex: region.noteIndex,
          pitch: region.pitch,
          pitches: region.pitches,
          bounds: region.bounds,
        };
      }
    }

    return null;
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

    // Find all notes in the same measure and staff
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
      return { action: 'before', noteIndex: firstNote.noteIndex };
    }

    // Check if clicking after the last note
    const lastNote = notesInMeasure[notesInMeasure.length - 1];
    if (clickX > lastNote.bounds.x + lastNote.bounds.width) {
      return null; // Append to end (use normal behavior)
    }

    // Check if clicking between two notes
    for (let i = 0; i < notesInMeasure.length - 1; i++) {
      const currentNote = notesInMeasure[i];
      const nextNote = notesInMeasure[i + 1];

      const currentEnd = currentNote.bounds.x + currentNote.bounds.width;
      const nextStart = nextNote.bounds.x;

      // If click is between this note and the next
      if (clickX >= currentEnd && clickX <= nextStart) {
        // Determine if closer to current or next note
        const distanceToCurrent = clickX - currentEnd;
        const distanceToNext = nextStart - clickX;

        if (distanceToCurrent < distanceToNext) {
          // Closer to current note - insert after it
          return { action: 'after', noteIndex: currentNote.noteIndex };
        } else {
          // Closer to next note - insert before it
          return { action: 'before', noteIndex: nextNote.noteIndex };
        }
      }
    }

    return null; // No specific insertion point found
  }

  /**
   * Add a note at a staff position
   * @param {Object} staffPosition - Staff position data
   */
  addNoteAtPosition(staffPosition) {
    if (!staffPosition.pitch) {
      return;
    }

    // CRITICAL: Always use the CLICKED/HOVERED measure, not the selected measure
    // The measure where the mouse is hovering is what the user expects the note to be added to
    const targetMeasureIndex = staffPosition.measure?.index ?? 0;

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
      console.log(`[NoteEditor] Inserting note at position: ${insertionPoint.action} note index ${insertionPoint.noteIndex}`);

      const compositionState = window.getCompositionState();
      if (!compositionState || !compositionState.measures[targetMeasureIndex]) {
        console.warn('[NoteEditor] Cannot access compositionState');
        return;
      }

      const noteData = {
        pitch: staffPosition.pitch,
        pitches: [staffPosition.pitch],
        duration: this.currentDuration,
        isRest: this.isRestMode,
        dotted: this.isDotted,
        accidental: this.currentAccidental,
        articulation: this.currentArticulation, // Include articulation from toolbar
      };

      const measure = compositionState.measures[targetMeasureIndex];
      const voice = staff === 'treble' ? measure.notation.treble.voices[0] : measure.notation.bass.voices[0];

      // Insert note at the specified position
      const targetIndex = insertionPoint.action === 'before' ? insertionPoint.noteIndex : insertionPoint.noteIndex + 1;
      voice.notes.splice(targetIndex, 0, noteData);

      this.composerIntegration.render();
      console.log('[NoteEditor] ✅ Successfully inserted note at position');
      return;
    }

    // No specific insertion point found - use original behavior (append to end)
    // If the note fits completely, add it normally
    if (noteBeats <= remainingBeats) {
      const beatPosition = this.getCurrentBeat(targetMeasureIndex, staff);

      const noteData = {
        type: this.isRestMode ? 'rest' : 'note',
        pitch: staffPosition.pitch,
        duration: this.currentDuration,
        isRest: this.isRestMode,
        dotted: this.isDotted,
        accidental: this.currentAccidental,
        articulation: this.currentArticulation, // Include articulation from toolbar
        beat: beatPosition,
      };

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

    // Note doesn't fit - split it across measures with ties
    // Add first part to fill current measure
    if (remainingBeats > 0) {
      const beatPosition = this.getCurrentBeat(targetMeasureIndex, staff);
      const firstPartDuration = this.beatsToDuration(remainingBeats);
      const firstPartNote = {
        type: this.isRestMode ? 'rest' : 'note',
        pitch: staffPosition.pitch,
        duration: firstPartDuration.duration,
        isRest: this.isRestMode,
        dotted: firstPartDuration.dotted,
        accidental: this.currentAccidental,
        articulation: this.currentArticulation, // Include articulation from toolbar
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
    let remainingNoteBeats = noteBeats - remainingBeats;
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
    console.log('[NoteEditor] moveSelectedNotes called with steps:', steps, 'selectedNotes:', this.selectedNotes);
    const moves = [];

    for (const noteId of this.selectedNotes) {
      // Parse note ID to get location
      const [measureIndex, staff, noteIndex] = this.parseNoteId(noteId);

      // Get current pitch and calculate new pitch
      // This would need access to the actual note data
      // For now, emit the move event with step info

      moves.push({
        noteId,
        measureIndex,
        staff,
        noteIndex,
        steps,
      });
    }

    console.log('[NoteEditor] Prepared moves:', moves);

    if (moves.length > 0) {
      this.onNoteMove(moves);
    }
  }

  /**
   * Delete selected notes
   */
  deleteSelectedNotes() {
    const deletions = [];

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, noteIndex] = this.parseNoteId(noteId);
      deletions.push({ measureIndex, staff, noteIndex });
    }

    // Sort by noteIndex descending so we delete from end first
    deletions.sort((a, b) => b.noteIndex - a.noteIndex);

    for (const deletion of deletions) {
      this.onNoteDelete(deletion);
    }

    this.clearSelection();
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
      const region = this.noteRegions.find(r => {
        const regionId = this.createNoteId(r.measureIndex, r.staff, r.noteIndex);
        return regionId === noteId;
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
    console.log('[NoteEditor] insertNoteBeforeSelected called, selectedNotes:', this.selectedNotes.size);

    if (this.selectedNotes.size === 0) {
      console.warn('[NoteEditor] No notes selected for insert before');
      return;
    }

    // Get the first selected note
    const firstNoteId = Array.from(this.selectedNotes)[0];
    const [measureIndex, staff, noteIndex] = this.parseNoteId(firstNoteId);

    console.log(`[NoteEditor] Inserting before: measure=${measureIndex}, staff=${staff}, noteIndex=${noteIndex}`);

    // Create new note with current toolbar settings
    const noteData = {
      pitch: 'C4', // Default pitch, user can change it
      pitches: ['C4'],
      duration: this.currentDuration,
      dotted: this.isDotted,
      isRest: this.isRestMode,
      accidental: this.currentAccidental,
      articulation: this.currentArticulation, // Include articulation from toolbar
    };

    console.log('[NoteEditor] Note data to insert:', noteData);

    // Insert note directly into compositionState
    if (window.getCompositionState) {
      const compositionState = window.getCompositionState();
      if (compositionState && compositionState.measures[measureIndex]) {
        const measure = compositionState.measures[measureIndex];
        const voice = staff === 'treble' ? measure.notation.treble.voices[0] : measure.notation.bass.voices[0];

        // Insert before the specified note
        voice.notes.splice(noteIndex, 0, noteData);

        this.composerIntegration.render();
        console.log('[NoteEditor] ✅ Successfully inserted note before selected');
      } else {
        console.warn('[NoteEditor] ❌ Could not access compositionState');
      }
    }
  }

  /**
   * Insert a note after the last selected note
   */
  insertNoteAfterSelected() {
    if (this.selectedNotes.size === 0) return;

    // Get the last selected note
    const noteIds = Array.from(this.selectedNotes);
    const lastNoteId = noteIds[noteIds.length - 1];
    const [measureIndex, staff, noteIndex] = this.parseNoteId(lastNoteId);

    // Create new note with current toolbar settings
    const noteData = {
      pitch: 'C4', // Default pitch, user can change it
      pitches: ['C4'],
      duration: this.currentDuration,
      dotted: this.isDotted,
      isRest: this.isRestMode,
      accidental: this.currentAccidental,
      articulation: this.currentArticulation, // Include articulation from toolbar
    };

    // Insert note directly into compositionState
    if (window.getCompositionState) {
      const compositionState = window.getCompositionState();
      if (compositionState && compositionState.measures[measureIndex]) {
        const measure = compositionState.measures[measureIndex];
        const voice = staff === 'treble' ? measure.notation.treble.voices[0] : measure.notation.bass.voices[0];

        // Insert after the specified note
        voice.notes.splice(noteIndex + 1, 0, noteData);

        this.composerIntegration.render();
        console.log('[NoteEditor] ✅ Successfully inserted note after selected');
      } else {
        console.warn('[NoteEditor] ❌ Could not access compositionState');
      }
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

    let beats = durationMap[duration] || 1;
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
    notes.forEach(note => {
      note.beat = currentBeat;
      const noteBeats = this.durationToBeats(note.duration, note.dotted || false);
      currentBeat += noteBeats;
    });
    console.log('[NoteEditor] Recalculated beat positions:', notes.map(n => ({ duration: n.duration, beat: n.beat })));
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

    console.log('[NoteEditor] changeDurationOfSelected:', {
      newDuration,
      isDotted: this.isDotted,
      selectedNotes: Array.from(this.selectedNotes)
    });

    let changedCount = 0;
    const measuresToRecalculate = new Set(); // Track which measures need beat recalculation

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, noteIndex] = this.parseNoteId(noteId);

      console.log('[NoteEditor] Processing note:', {
        noteId,
        measureIndex,
        staff,
        noteIndex
      });

      // Update compositionState directly (single source of truth)
      if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState && compositionState.measures[measureIndex]) {
          const measure = compositionState.measures[measureIndex];
          const voice = staff === 'treble' ? measure.notation.treble.voices[0] : measure.notation.bass.voices[0];
          if (voice && voice.notes[noteIndex]) {
            console.log(`[NoteEditor] BEFORE update - note duration:`, voice.notes[noteIndex].duration);
            voice.notes[noteIndex].duration = newDuration;
            voice.notes[noteIndex].dotted = this.isDotted;
            console.log(`[NoteEditor] AFTER update - note duration:`, voice.notes[noteIndex].duration, 'dotted:', voice.notes[noteIndex].dotted);
            changedCount++;
            console.log('[NoteEditor] ✅ Updated note duration in compositionState');

            // Mark this measure/staff for beat recalculation
            measuresToRecalculate.add(`${measureIndex}-${staff}`);
          }
        }
      }
    }

    // Recalculate beat positions for all affected measures
    if (window.getCompositionState) {
      const compositionState = window.getCompositionState();
      for (const key of measuresToRecalculate) {
        const [measureIndex, staff] = key.split('-');
        const measure = compositionState.measures[parseInt(measureIndex)];
        if (measure) {
          const voice = staff === 'treble' ? measure.notation.treble.voices[0] : measure.notation.bass.voices[0];
          if (voice && voice.notes) {
            this.recalculateBeatPositions(voice.notes);
          }
        }
      }
    }

    if (changedCount > 0) {
      console.log(`[NoteEditor] Calling render(true) after changing ${changedCount} note(s)`);
      this.composerIntegration.render(true); // Force immediate render, bypass debouncing
      console.log(`[NoteEditor] ✅ Changed duration of ${changedCount} note(s) to ${newDuration}`);

      // IMPORTANT: Re-render overlay to update blue highlight positions
      // The render() call above updates noteRegions, but we need to redraw the overlay
      setTimeout(() => {
        this.renderOverlay();
        console.log('[NoteEditor] Refreshed overlay after duration change');
      }, 50); // Small delay to ensure noteRegions are updated

      // Note: noteRegions are automatically updated via the render hook in notationInit.js
    } else {
      console.warn('[NoteEditor] Could not change duration - would exceed measure capacity');
    }
  }

  /**
   * Toggle articulation on all selected notes
   * @param {string} articulation - Articulation type ('staccato', 'accent', 'tenuto', 'marcato')
   */
  toggleArticulationOnSelected(articulation) {
    if (this.selectedNotes.size === 0) return;

    let changedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, noteIndex] = this.parseNoteId(noteId);

      // Update compositionState directly (single source of truth)
      if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState && compositionState.measures[measureIndex]) {
          const measure = compositionState.measures[measureIndex];
          const voice = staff === 'treble' ? measure.notation.treble.voices[0] : measure.notation.bass.voices[0];
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
      this.composerIntegration.render(true); // Force immediate render
      console.log(`[NoteEditor] Toggled ${articulation} on ${changedCount} note(s)`);
    }
  }

  /**
   * Toggle tie on all selected notes
   */
  toggleTieOnSelected() {
    if (this.selectedNotes.size === 0) return;

    let changedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, noteIndex] = this.parseNoteId(noteId);

      // Update compositionState directly (single source of truth)
      if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState && compositionState.measures[measureIndex]) {
          const measure = compositionState.measures[measureIndex];
          const voice = staff === 'treble' ? measure.notation.treble.voices[0] : measure.notation.bass.voices[0];
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
      this.composerIntegration.render(true); // Force immediate render
      console.log(`[NoteEditor] Toggled tie on ${changedCount} note(s)`);
    }
  }

  /**
   * Toggle dotted on all selected notes
   */
  toggleDottedOnSelected() {
    if (this.selectedNotes.size === 0) return;

    let changedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, noteIndex] = this.parseNoteId(noteId);

      // Update compositionState directly
      if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState && compositionState.measures[measureIndex]) {
          const measure = compositionState.measures[measureIndex];
          const voice = staff === 'treble' ? measure.notation.treble.voices[0] : measure.notation.bass.voices[0];
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
      const [measureIndex, staff, noteIndex] = this.parseNoteId(noteId);

      // Update compositionState directly
      if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState && compositionState.measures[measureIndex]) {
          const measure = compositionState.measures[measureIndex];
          const voice = staff === 'treble' ? measure.notation.treble.voices[0] : measure.notation.bass.voices[0];
          if (voice && voice.notes[noteIndex]) {
            const note = voice.notes[noteIndex];
            // Toggle between rest and note
            note.isRest = !note.isRest;
            note.type = note.isRest ? 'rest' : 'note';
            changedCount++;
            console.log('[NoteEditor] ✅ Toggled rest mode in compositionState');
          }
        }
      }
    }

    if (changedCount > 0) {
      this.composerIntegration.render(true);
      console.log(`[NoteEditor] Toggled rest on ${changedCount} note(s)`);
    }
  }

  /**
   * Change accidental on all selected notes
   * @param {string} accidental - Accidental ('#', 'b', 'n', or null)
   */
  changeAccidentalOnSelected(accidental) {
    if (this.selectedNotes.size === 0) return;

    let changedCount = 0;

    for (const noteId of this.selectedNotes) {
      const [measureIndex, staff, noteIndex] = this.parseNoteId(noteId);

      // Update compositionState directly
      if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState && compositionState.measures[measureIndex]) {
          const measure = compositionState.measures[measureIndex];
          const voice = staff === 'treble' ? measure.notation.treble.voices[0] : measure.notation.bass.voices[0];
          if (voice && voice.notes[noteIndex]) {
            const note = voice.notes[noteIndex];
            // Only apply to notes, not rests
            if (!note.isRest) {
              note.accidental = accidental;
              changedCount++;
            }
          }
        }
      }
    }

    if (changedCount > 0) {
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
   * @param {string} noteId - Note ID like "0-treble-1"
   * @returns {Array} - [measureIndex, staff, noteIndex]
   */
  parseNoteId(noteId) {
    const parts = noteId.split('-');
    return [
      parseInt(parts[0], 10),
      parts[1],
      parseInt(parts[2], 10),
    ];
  }

  /**
   * Create note ID from location
   * @param {number} measureIndex - Measure index
   * @param {string} staff - Staff name
   * @param {number} noteIndex - Note index
   * @returns {string} - Note ID
   */
  createNoteId(measureIndex, staff, noteIndex) {
    return `${measureIndex}-${staff}-${noteIndex}`;
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
      const [measureIndex, staff, noteIndex] = this.parseNoteId(noteId);
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
   * Convert duration string to beats (quarter notes)
   * @param {string} duration - Duration like "4n", "2n", "8n", etc.
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
    return durationMap[duration] || 1;
  }

  /**
   * Calculate total beats used in a measure from note regions
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @returns {number} - Total beats used
   */
  getMeasureBeatsUsed(measureIndex, staff) {
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
    // Get time signature (hardcoded to 4/4 for now)
    // TODO: Get from compositionState metadata
    const maxBeats = 4;

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
    const maxBeats = 4; // 4/4 time
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
    return 4 - this.getRemainingBeats(measureIndex, staff);
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
   * Convert duration to beats
   * @param {string} duration - Duration like '4n', '8n', etc.
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

    const baseBeats = baseDurations[duration] || 1;
    return dotted ? baseBeats * 1.5 : baseBeats;
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

    // Get harmonic coloring if chord context is set
    if (this.chordContext && !this.isRestMode) {
      const analysis = analyzeChordTone(
        staffPosition.pitch,
        this.chordContext,
        this.keySignature
      );
      if (analysis) {
        this.ghostNote.color = analysis.colors.fill;
        this.ghostNote.tooltip = analysis.tooltip;
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

    // Draw highlight for each selected note
    for (const noteId of this.selectedNotes) {
      // Find the region for this note
      const region = this.noteRegions.find(r => {
        const regionId = this.createNoteId(r.measureIndex, r.staff, r.noteIndex);
        return regionId === noteId;
      });

      if (region && region.bounds) {
        // Convert from layout coordinates to canvas-local coordinates for overlay drawing
        const x = region.bounds.x - scrollLeft;
        const y = region.bounds.y - scrollTop;
        const { width, height } = region.bounds;

        // Draw filled background
        ctx.fillRect(x - 2, y - 2, width + 4, height + 4);

        // Draw border
        ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
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

    // Group selected notes by page
    const notesByPage = new Map();

    for (const noteId of this.selectedNotes) {
      // Find the region for this note
      const region = this.noteRegions.find(r => {
        const regionId = this.createNoteId(r.measureIndex, r.staff, r.noteIndex);
        return regionId === noteId;
      });

      if (region && region.bounds) {
        // Find which page contains this measure
        const page = pageManager.getPageForMeasure(region.measureIndex);
        if (page) {
          if (!notesByPage.has(page)) {
            notesByPage.set(page, []);
          }
          notesByPage.get(page).push(region);
        }
      }
    }

    // Draw highlights on each page
    for (const [page, regions] of notesByPage) {
      const ctx = page.canvas.getContext('2d');

      ctx.save();
      ctx.strokeStyle = SELECTION_COLORS.selected;
      ctx.lineWidth = 2;
      ctx.fillStyle = SELECTION_COLORS.hover;

      // Draw highlight for each selected note on this page
      for (const region of regions) {
        const { x, y, width, height } = region.bounds;

        // PHASE 1.3: Drawing on page canvas - use layout coordinates directly!
        // Same coordinate system as VexFlow, same as ghost note rendering

        // Draw filled background
        ctx.fillRect(x - 2, y - 2, width + 4, height + 4);

        // Draw border
        ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
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
   * Set current articulation
   * @param {string|null} articulation - 'staccato', 'accent', 'tenuto', 'marcato', or null
   */
  setArticulation(articulation) {
    this.currentArticulation = articulation;
    console.log('[NoteEditor] Articulation set to:', articulation);
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
