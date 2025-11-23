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
    this.actualMeasurePositions = new Map(); // CRITICAL: Actual VexFlow positions from rendering
    this.pageLayoutManager = null; // Reference to PageLayoutManager for pagination
    this.currentPageIndex = 0; // Current page being displayed
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
    // Keep actualMeasurePositions - they're set by VexFlow rendering, not layout calculation
  }

  /**
   * Set the PageLayoutManager for pagination support
   * @param {PageLayoutManager} pageLayoutManager - Page layout manager instance
   */
  setPageLayoutManager(pageLayoutManager) {
    this.pageLayoutManager = pageLayoutManager;
  }

  /**
   * Set the current page index
   * @param {number} pageIndex - Page index (0-based)
   */
  setCurrentPageIndex(pageIndex) {
    this.currentPageIndex = pageIndex;
  }

  /**
   * Get the current page index
   * @returns {number} - Current page index
   */
  getCurrentPageIndex() {
    return this.currentPageIndex;
  }

  /**
   * Check if pagination is enabled
   * @returns {boolean} - True if PageLayoutManager is set
   */
  isPaginationEnabled() {
    return this.pageLayoutManager !== null;
  }

  /**
   * CRITICAL: Set actual measure positions from VexFlow rendering
   * This is the "nuclear" solution - we extract ACTUAL positions from VexFlow
   * instead of calculating them, eliminating coordinate mismatch errors
   * @param {Array} measures - Rendered measures with actualBounds from VexFlow
   */
  setActualMeasurePositions(measures) {
    this.actualMeasurePositions.clear();

    measures.forEach((measure, loopIndex) => {
      if (measure.actualBounds) {
        // CRITICAL: Use measure.index if available (for pagination), otherwise use loop index
        const measureIndex = measure.index !== undefined ? measure.index : loopIndex;

        this.actualMeasurePositions.set(measureIndex, {
          index: measureIndex,
          x: measure.actualBounds.x,
          trebleY: measure.actualBounds.trebleY,
          bassY: measure.actualBounds.bassY,
          width: measure.actualBounds.width,
          height: measure.actualBounds.height,
        });
      }
    });
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
      pageIndex = null, // NEW: Specific page to layout (null = all measures)
    } = options;

    const {
      measuresPerLine,
      marginTop,
      marginBottom,
      marginLeft,
      marginRight,
      systemSpacing,
    } = this.config;

    // NEW: If pagination is enabled and pageIndex specified, layout only that page
    let startMeasureIndex = 0;
    let endMeasureIndex = numMeasures;

    if (this.isPaginationEnabled() && pageIndex !== null) {
      const currentPage = this.pageLayoutManager.pages[pageIndex];
      if (currentPage) {
        startMeasureIndex = currentPage.startMeasure;
        endMeasureIndex = currentPage.endMeasure + 1;
        numMeasures = endMeasureIndex - startMeasureIndex;
      }
    }

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
      const startMeasure = startMeasureIndex + (systemIndex * measuresPerLine);
      const endMeasure = Math.min(startMeasure + measuresPerLine, endMeasureIndex);
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
   * @param {number} x - X coordinate (canvas-local)
   * @param {number} y - Y coordinate (canvas-local)
   * @returns {Object|null} - Measure bounds or null
   */
  getMeasureAtPoint(x, y) {
    // CRITICAL: Use actual VexFlow positions if available (nuclear solution)
    const useActualPositions = this.actualMeasurePositions.size > 0;

    // CRITICAL: x and y are canvas-local coordinates (viewport-relative, from getBoundingClientRect)
    // In pagination mode: coordinates are already page-local, no scroll offset needed
    // In legacy mode: VexFlow positions are layout coordinates, need to ADD scroll
    let realX, realY;
    if (this.isPaginationEnabled()) {
      // Pagination mode: use coordinates directly (they're already page-local)
      realX = x / this.config.zoom;
      realY = y / this.config.zoom;
    } else {
      // Legacy mode: add scroll offset to convert viewport → layout coordinates
      realX = (x + this.config.scrollX) / this.config.zoom;
      realY = (y + this.config.scrollY) / this.config.zoom;
    }

    // If we have actual VexFlow positions, use those
    if (useActualPositions) {
      const verticalTolerance = 80; // Allow clicks well below bass staff

      for (const [index, actualPos] of this.actualMeasurePositions) {
        // NEW: In pagination mode, only check measures on current page
        if (this.isPaginationEnabled() && this.pageLayoutManager) {
          if (!this.pageLayoutManager.isMeasureOnCurrentPage(index)) {
            continue;
          }
        }

        // Check horizontal bounds
        if (realX >= actualPos.x && realX <= actualPos.x + actualPos.width) {
          // Check vertical bounds - use the full height from trebleY to bassY + tolerance
          const topY = actualPos.trebleY;
          const bottomY = actualPos.bassY + 100; // bassY + staff height + tolerance

          if (realY >= topY && realY <= bottomY) {
            // Return in the same format as calculated bounds for compatibility
            return {
              index: index,
              system: Math.floor(index / this.config.measuresPerLine),
              x: actualPos.x,
              y: actualPos.trebleY, // Use trebleY as the measure Y
              width: actualPos.width,
              height: actualPos.height,
              // Include actual staff positions
              actualTrebleY: actualPos.trebleY,
              actualBassY: actualPos.bassY,
            };
          }
        }
      }

      return null;
    }

    // Fallback: use calculated bounds if actual positions not available
    if (this.measureBounds.size === 0) {
      return null;
    }

    const verticalTolerance = 80;
    for (const [index, bounds] of this.measureBounds) {
      if (
        realX >= bounds.x &&
        realX <= bounds.x + bounds.width &&
        realY >= bounds.y &&
        realY <= bounds.y + bounds.height + verticalTolerance
      ) {
        return bounds;
      }
    }

    return null;
  }

  /**
   * Find the staff (treble or bass) at a point
   * @param {number} x - X coordinate (canvas-local)
   * @param {number} y - Y coordinate (canvas-local)
   * @returns {Object|null} - { measure, staff: 'treble'|'bass', line, pitch }
   */
  getStaffPositionAtPoint(x, y) {
    const measureBounds = this.getMeasureAtPoint(x, y);
    if (!measureBounds) {
      return null;
    }

    // y is already canvas-local (page-local in pagination mode), only apply zoom
    // Note: getMeasureAtPoint already handles scroll offset if needed
    const realY = y / this.config.zoom;

    // CRITICAL: Use actual VexFlow staff positions if available
    const useActualPositions = measureBounds.actualTrebleY !== undefined && measureBounds.actualBassY !== undefined;

    let trebleY, bassY;

    if (useActualPositions) {
      // NUCLEAR SOLUTION: Use ACTUAL VexFlow positions
      trebleY = measureBounds.actualTrebleY;
      bassY = measureBounds.actualBassY;
    } else {
      // Fallback: calculate positions (old way)
      const systemMarginTop = 20;
      const staffHeight = 80;
      const staffSpacing = 80;
      trebleY = measureBounds.y + systemMarginTop;
      bassY = measureBounds.y + systemMarginTop + staffHeight + staffSpacing;
    }

    // Determine which staff
    const trebleBottom = trebleY + 40;
    const bassTop = bassY - 20;
    const middleY = (trebleBottom + bassTop) / 2;

    let staff, staffY;

    if (realY >= bassY) {
      staff = 'bass';
      staffY = bassY;
    } else if (realY <= middleY) {
      staff = 'treble';
      staffY = trebleY;
    } else {
      staff = 'bass';
      staffY = bassY;
    }

    // Calculate staff line position
    const relativeY = realY - staffY;

    // VexFlow renders staff lines with specific spacing
    // The 5 staff lines are typically at y positions (relative to staff top):
    // Line 0 (top): y = 0
    // Line 1: y = 20
    // Line 2 (middle): y = 40
    // Line 3: y = 60
    // Line 4 (bottom): y = 80

    // But we want to include ledger lines and spaces, so we use:
    // Each diatonic step (line or space) = 5px vertically
    // NOTE: Staff lines are 20px apart, but there are 2 diatonic steps between lines
    // (e.g., E to F to G), so each step is 10px... WAIT, let's recalculate:
    // Actually, VexFlow spaces things such that each visual position is 5px

    // For ghost notes, we define line numbers relative to the bottom staff line:
    // Line 0 = bottom staff line (E4 for treble, G2 for bass) at relative y = 80
    // Line 2 = first space above (F4/A2) at relative y = 70
    // Line 4 = second line (G4/B2) at relative y = 60
    // Line 6 = second space (A4/C3) at relative y = 50
    // Line 8 = middle line (B4/D3) at relative y = 40
    // etc.

    const pixelsPerStep = 5;  // 5px per diatonic step (line or space)

    // Calculate line number from Y position
    // Bottom staff line (E4 / G2) is 80px below the top line
    const bottomLineY = 80;
    const steps = Math.round((bottomLineY - relativeY) / pixelsPerStep);
    const line = steps * 2; // Even numbers (0,2,4,...) to match conversion

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
  // Each increment of 2 represents a diatonic step (line or space)
  // line = 0   -> bottom staff line (E4 / G2)
  // line = 2   -> first space above (F4 / A2)
  // line = -2  -> first space below, etc.
  const basePitch = staff === 'treble' ? 'E4' : 'G2';
  const steps = Math.round(line / 2);
  return calculateLedgerPitch(basePitch, steps);
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

  // Multiply by 2 so that each diatonic step maps to 2 line units
  return (absolutePosition - referencePosition) * 2;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  LAYOUT_DEFAULTS,
  StaffLayoutManager,
  pitchToLine,
};
