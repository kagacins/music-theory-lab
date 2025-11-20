/**
 * Staff Layouter - Multi-system layout management
 * Part of the Phase 4.4 VexFlow Professional Notation enhancement
 *
 * This module handles laying out multiple systems of music notation,
 * including line breaks, page breaks, and scrollable/zoomable views.
 */

import {
  GRAND_STAFF_DEFAULTS,
  calculateGrandStaffDimensions,
} from './grandStaff.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Layout configuration defaults
 */
export const LAYOUT_DEFAULTS = {
  measuresPerLine: 4,
  pageWidth: 800,
  pageHeight: 1100,
  marginTop: 40,
  marginBottom: 40,
  marginLeft: 20,
  marginRight: 20,
  systemSpacing: 60,        // Space between systems
  zoom: 1.0,
  minZoom: 0.5,
  maxZoom: 2.0,
  scrollX: 0,
  scrollY: 0,
};

// ============================================================================
// LAYOUT MANAGER
// ============================================================================

/**
 * Layout manager for multi-system notation
 */
export class StaffLayoutManager {
  constructor(options = {}) {
    this.config = { ...LAYOUT_DEFAULTS, ...options };
    this.systems = [];
    this.totalHeight = 0;
    this.totalWidth = 0;
    this.measureBounds = new Map(); // Map measure index to bounds
  }

  /**
   * Update configuration
   * @param {Object} options - New configuration options
   */
  setConfig(options) {
    this.config = { ...this.config, ...options };
    this.invalidate();
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
   * @param {number} zoom - Zoom level (0.5 to 2.0)
   */
  setZoom(zoom) {
    this.config.zoom = Math.max(
      this.config.minZoom,
      Math.min(this.config.maxZoom, zoom)
    );
  }

  /**
   * Get zoom level
   * @returns {number} - Current zoom level
   */
  getZoom() {
    return this.config.zoom;
  }

  /**
   * Set scroll position
   * @param {number} x - Horizontal scroll
   * @param {number} y - Vertical scroll
   */
  setScroll(x, y) {
    this.config.scrollX = x;
    this.config.scrollY = y;
  }

  /**
   * Get scroll position
   * @returns {Object} - { x, y }
   */
  getScroll() {
    return {
      x: this.config.scrollX,
      y: this.config.scrollY,
    };
  }

  /**
   * Invalidate layout (force recalculation)
   */
  invalidate() {
    this.systems = [];
    this.measureBounds.clear();
  }

  /**
   * Calculate layout for given measures
   * @param {number} numMeasures - Number of measures
   * @param {Object} options - Additional options
   * @returns {Object} - Layout information
   */
  calculateLayout(numMeasures, options = {}) {
    const {
      keySignature = 'C',
      timeSignature = '4/4',
    } = options;

    const {
      measuresPerLine,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      systemSpacing,
    } = this.config;

    // Calculate number of systems
    const numSystems = Math.ceil(numMeasures / measuresPerLine);
    this.systems = [];

    // Get grand staff dimensions
    const grandStaffDims = calculateGrandStaffDimensions({
      numMeasures: measuresPerLine,
      measuresPerLine,
      keySignature,
    });

    // Calculate each system
    let currentY = marginTop;

    for (let systemIndex = 0; systemIndex < numSystems; systemIndex++) {
      const startMeasure = systemIndex * measuresPerLine;
      const endMeasure = Math.min(startMeasure + measuresPerLine, numMeasures);
      const measuresInSystem = endMeasure - startMeasure;

      const system = {
        index: systemIndex,
        startMeasure,
        endMeasure,
        measuresCount: measuresInSystem,
        x: marginLeft,
        y: currentY,
        width: grandStaffDims.totalWidth,
        height: grandStaffDims.systemHeight,
      };

      this.systems.push(system);

      // Calculate bounds for each measure in this system
      for (let i = 0; i < measuresInSystem; i++) {
        const measureIndex = startMeasure + i;
        const isFirst = i === 0;

        const measureX = marginLeft + grandStaffDims.braceWidth +
          (i * grandStaffDims.measureWidth) +
          (isFirst ? 0 : grandStaffDims.firstMeasureExtra);

        const measureWidth = isFirst
          ? grandStaffDims.measureWidth + grandStaffDims.firstMeasureExtra
          : grandStaffDims.measureWidth;

        this.measureBounds.set(measureIndex, {
          index: measureIndex,
          system: systemIndex,
          x: measureX,
          y: currentY,
          width: measureWidth,
          height: grandStaffDims.systemHeight,
        });
      }

      currentY += grandStaffDims.systemHeight + systemSpacing;
    }

    // Calculate total dimensions
    this.totalHeight = currentY - systemSpacing + marginBottom;
    this.totalWidth = marginLeft + grandStaffDims.totalWidth + marginRight;

    return {
      systems: this.systems,
      totalWidth: this.totalWidth,
      totalHeight: this.totalHeight,
      measureBounds: this.measureBounds,
    };
  }

  /**
   * Get system containing a measure
   * @param {number} measureIndex - Measure index
   * @returns {Object|null} - System info or null
   */
  getSystemForMeasure(measureIndex) {
    return this.systems.find(
      s => measureIndex >= s.startMeasure && measureIndex < s.endMeasure
    );
  }

  /**
   * Get bounds for a measure
   * @param {number} measureIndex - Measure index
   * @returns {Object|null} - Bounds or null
   */
  getMeasureBounds(measureIndex) {
    return this.measureBounds.get(measureIndex) || null;
  }

  /**
   * Get all measure bounds
   * @returns {Map} - Map of measure index to bounds
   */
  getAllMeasureBounds() {
    return new Map(this.measureBounds);
  }

  /**
   * Find measure at a point (for click handling)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object|null} - Measure bounds or null
   */
  getMeasureAtPoint(x, y) {
    // Apply zoom and scroll transformation
    const realX = (x + this.config.scrollX) / this.config.zoom;
    const realY = (y + this.config.scrollY) / this.config.zoom;

    // Debug: log if no bounds exist
    if (this.measureBounds.size === 0) {
      console.warn('[StaffLayouter] No measure bounds available for click detection');
      return null;
    }

    for (const [index, bounds] of this.measureBounds) {
      if (
        realX >= bounds.x &&
        realX <= bounds.x + bounds.width &&
        realY >= bounds.y &&
        realY <= bounds.y + bounds.height
      ) {
        return bounds;
      }
    }

    return null;
  }

  /**
   * Find the staff (treble or bass) at a point
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object|null} - { measure, staff: 'treble'|'bass', line, pitch }
   */
  getStaffPositionAtPoint(x, y) {
    const measureBounds = this.getMeasureAtPoint(x, y);
    if (!measureBounds) return null;

    // Apply zoom and scroll
    const realY = (y + this.config.scrollY) / this.config.zoom;

    // Calculate staff Y positions from measure bounds
    // trebleY = measure.y + systemMarginTop (20)
    // bassY = measure.y + systemMarginTop + staffHeight + staffSpacing (20 + 40 + 80 = 140)
    const systemMarginTop = 20;
    const staffHeight = 40;
    const staffSpacing = 80;
    const trebleY = measureBounds.y + systemMarginTop;
    const bassY = measureBounds.y + systemMarginTop + staffHeight + staffSpacing;

    // Determine which staff
    // Allow ledger lines: extend staff detection beyond the 5-line staff
    const trebleBottom = trebleY + 80; // Staff height + space for ledger lines
    const bassTop = bassY - 40; // Allow ledger lines above bass staff

    let staff, staffY;

    // Middle point between staves to determine which staff the mouse is closer to
    const middleY = (trebleBottom + bassTop) / 2;

    if (realY <= middleY) {
      // Closer to treble staff
      staff = 'treble';
      staffY = trebleY;
    } else {
      // Closer to bass staff
      staff = 'bass';
      staffY = bassY;
    }

    // Calculate staff line (0 = bottom line, 8 = top line for 5-line staff)
    // staffY is the Y position of the top line of the staff (from VexFlow Stave)
    // The staff spans from staffY (top line) to staffY + 40 (bottom line)
    const relativeY = realY - staffY;
    const lineSpacing = 10; // Pixels between lines
    const line = Math.round((40 - relativeY) / (lineSpacing / 2));

    // Convert line to pitch
    const pitch = lineToPitch(line, staff);

    return {
      measure: measureBounds,
      staff,
      line,
      pitch,
    };
  }

  /**
   * Get visible measures based on scroll and viewport
   * @param {number} viewportWidth - Viewport width
   * @param {number} viewportHeight - Viewport height
   * @returns {Array} - Array of visible measure indices
   */
  getVisibleMeasures(viewportWidth, viewportHeight) {
    const visible = [];
    const zoom = this.config.zoom;
    const scrollX = this.config.scrollX;
    const scrollY = this.config.scrollY;

    // Calculate visible area in layout coordinates
    const visibleLeft = scrollX / zoom;
    const visibleTop = scrollY / zoom;
    const visibleRight = (scrollX + viewportWidth) / zoom;
    const visibleBottom = (scrollY + viewportHeight) / zoom;

    for (const [index, bounds] of this.measureBounds) {
      // Check if measure overlaps with visible area
      if (
        bounds.x + bounds.width >= visibleLeft &&
        bounds.x <= visibleRight &&
        bounds.y + bounds.height >= visibleTop &&
        bounds.y <= visibleBottom
      ) {
        visible.push(index);
      }
    }

    return visible;
  }

  /**
   * Scroll to make a measure visible
   * @param {number} measureIndex - Measure index
   * @param {number} viewportWidth - Viewport width
   * @param {number} viewportHeight - Viewport height
   */
  scrollToMeasure(measureIndex, viewportWidth, viewportHeight) {
    const bounds = this.getMeasureBounds(measureIndex);
    if (!bounds) return;

    const zoom = this.config.zoom;

    // Calculate the target scroll position to center the measure
    const targetX = (bounds.x * zoom) - (viewportWidth / 2) + (bounds.width * zoom / 2);
    const targetY = (bounds.y * zoom) - (viewportHeight / 2) + (bounds.height * zoom / 2);

    // Clamp to valid scroll range
    this.config.scrollX = Math.max(0, Math.min(
      this.totalWidth * zoom - viewportWidth,
      targetX
    ));
    this.config.scrollY = Math.max(0, Math.min(
      this.totalHeight * zoom - viewportHeight,
      targetY
    ));
  }

  /**
   * Get canvas dimensions for rendering
   * @returns {Object} - { width, height }
   */
  getCanvasDimensions() {
    return {
      width: this.totalWidth * this.config.zoom,
      height: this.totalHeight * this.config.zoom,
    };
  }
}

// ============================================================================
// PITCH CALCULATIONS
// ============================================================================

/**
 * Convert staff line number to pitch
 * @param {number} line - Line number (0 = bottom ledger, increasing up)
 * @param {string} staff - 'treble' or 'bass'
 * @returns {string} - Pitch string like "C4"
 */
function lineToPitch(line, staff) {
  // Line 0 is the bottom line
  // For treble clef: bottom line is E4
  // For bass clef: bottom line is G2

  // Extended pitch arrays to support wide ledger line range
  const treblePitches = [
    // Below staff ledger lines
    'A3', 'B3', 'C4', 'D4',
    // Staff lines (E4 = bottom line)
    'E4', 'F4', 'G4', 'A4', 'B4',
    'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5',
    // Above staff ledger lines
    'C6', 'D6', 'E6', 'F6', 'G6', 'A6', 'B6', 'C7',
  ];

  const bassPitches = [
    // Below staff ledger lines
    'C2', 'D2', 'E2', 'F2',
    // Staff lines (G2 = bottom line)
    'G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3',
    // Above staff ledger lines
    'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5',
  ];

  // Adjust for staff lines
  // Treble: bottom line (E4) = index 4, Bass: bottom line (G2) = index 4
  const pitches = staff === 'treble' ? treblePitches : bassPitches;
  const adjustedIndex = line + 4; // Bottom line is at index 4

  if (adjustedIndex < 0 || adjustedIndex >= pitches.length) {
    // Ledger line - calculate based on pattern
    if (adjustedIndex < 0) {
      // Below staff
      const steps = -adjustedIndex;
      return staff === 'treble'
        ? calculateLedgerPitch('C4', -steps)
        : calculateLedgerPitch('E2', -steps);
    } else {
      // Above staff
      const steps = adjustedIndex - pitches.length + 1;
      return staff === 'treble'
        ? calculateLedgerPitch('C6', steps)
        : calculateLedgerPitch('E4', steps);
    }
  }

  return pitches[adjustedIndex];
}

/**
 * Calculate pitch for ledger lines
 * @param {string} basePitch - Base pitch to calculate from
 * @param {number} steps - Number of steps (positive = up, negative = down)
 * @returns {string} - Calculated pitch
 */
function calculateLedgerPitch(basePitch, steps) {
  const noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const match = basePitch.match(/^([A-G])(\d+)$/);
  if (!match) return basePitch;

  const noteName = match[1];
  let octave = parseInt(match[2], 10);
  let noteIndex = noteNames.indexOf(noteName);

  noteIndex += steps;

  // Handle octave changes
  while (noteIndex >= 7) {
    noteIndex -= 7;
    octave += 1;
  }
  while (noteIndex < 0) {
    noteIndex += 7;
    octave -= 1;
  }

  return `${noteNames[noteIndex]}${octave}`;
}

/**
 * Convert pitch to staff line number
 * @param {string} pitch - Pitch string like "C4"
 * @param {string} staff - 'treble' or 'bass'
 * @returns {number} - Line number
 */
export function pitchToLine(pitch, staff) {
  const match = pitch.match(/^([A-Ga-g])([#b]?)(\d+)$/);
  if (!match) return 4; // Middle of staff

  const noteName = match[1].toUpperCase();
  const octave = parseInt(match[3], 10);

  const noteValues = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  const noteValue = noteValues[noteName];

  // Calculate absolute position
  const absolutePosition = (octave * 7) + noteValue;

  // Reference positions
  // Treble: E4 is line 0 (bottom line)
  // Bass: G2 is line 0 (bottom line)
  const referencePosition = staff === 'treble'
    ? (4 * 7) + 2  // E4
    : (2 * 7) + 4; // G2

  return absolutePosition - referencePosition;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  LAYOUT_DEFAULTS,
  StaffLayoutManager,
  pitchToLine,
};
