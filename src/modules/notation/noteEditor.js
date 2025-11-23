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
    this.hoveredPosition = null;
    this.ghostNote = null;

    // Drag state
    this.dragStartPosition = null;
    this.dragCurrentPosition = null;
    this.draggedNotes = [];

    // Tool state (from toolbar)
    this.currentDuration = '4n';
    this.isRestMode = false;
    this.isDotted = false;
    this.currentAccidental = null;

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

    // Global keyboard listener
    document.addEventListener('keydown', this.handleKeyDown);
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
      // Check if Shift is held and there's a note at same time position to add pitch to (polyphony)
      if (e.shiftKey && this.canAddPitchToNearbyNote(staffPosition)) {
        this.addPitchToNearbyNote(staffPosition);
      } else {
        // Add a new note at this position
        this.addNoteAtPosition(staffPosition);
      }
    }
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

    // Escape to clear selection
    if (e.key === 'Escape') {
      this.clearSelection();
      this.renderOverlay();
    }

    // Arrow keys to move selected notes
    if (this.selectedNotes.size > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.moveSelectedNotes(1); // Up one step
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.moveSelectedNotes(-1); // Down one step
      }
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

  // ============================================================================
  // OVERLAY RENDERING
  // ============================================================================

  /**
   * Render the overlay (selection, ghost notes, etc.)
   * PHASE 1A: Drawing directly on main canvas - triggers full re-render!
   */
  renderOverlay() {
    // PHASE 1A: For ghost notes on main canvas, trigger full re-render
    // The composer's debouncing (60fps limit) prevents excessive renders
    if (this.ghostNote && this.composerIntegration) {
      // Queue a re-render which will redraw VexFlow + call our drawGhostNote
      this.composerIntegration.render();
      return;
    }

    // Selection highlighting: Only works in legacy single-canvas mode
    // Multi-page mode: TODO - implement selection rendering on page canvases
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
