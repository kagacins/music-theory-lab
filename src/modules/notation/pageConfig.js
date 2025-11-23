/**
 * Page Configuration for Multi-Page Notation
 * Defines page sizes, margins, and layout settings for paginated music notation
 */

export const PAGE_CONFIG = {
  // Standard page dimensions (8.5" x 11" at 96 DPI)
  width: 816,
  height: 1056,

  // Page margins
  margin: {
    top: 60,
    bottom: 60,
    left: 50,
    right: 50,
  },

  // Layout settings
  measuresPerPage: 8,    // Default: 2 systems of 4 measures each
  systemsPerPage: 2,     // Number of grand staff systems per page
  measuresPerSystem: 4,  // Measures per system

  // Visual styling
  pageGap: 20,           // Gap between pages in continuous scroll
  pageShadow: '0 2px 8px rgba(0,0,0,0.15)',
  pageBackground: 'white',

  // View modes
  viewModes: {
    SINGLE: 'single',           // One page at a time
    TWO_PAGE: 'two-page',       // Two pages side-by-side (book view)
    CONTINUOUS: 'continuous',   // All pages, scroll vertically
  },

  // Default view mode
  defaultViewMode: 'continuous',
};

/**
 * Calculate usable area within page margins
 */
export function getUsablePageArea() {
  return {
    x: PAGE_CONFIG.margin.left,
    y: PAGE_CONFIG.margin.top,
    width: PAGE_CONFIG.width - PAGE_CONFIG.margin.left - PAGE_CONFIG.margin.right,
    height: PAGE_CONFIG.height - PAGE_CONFIG.margin.top - PAGE_CONFIG.margin.bottom,
  };
}

/**
 * Calculate which page a measure should be on
 * @param {number} measureIndex - Measure index
 * @returns {number} - Page index (0-based)
 */
export function getPageForMeasure(measureIndex) {
  return Math.floor(measureIndex / PAGE_CONFIG.measuresPerPage);
}

/**
 * Calculate measure's position within its page
 * @param {number} measureIndex - Measure index
 * @returns {Object} - { pageIndex, systemIndex, measureInSystem }
 */
export function getMeasurePagePosition(measureIndex) {
  const pageIndex = getPageForMeasure(measureIndex);
  const measureInPage = measureIndex % PAGE_CONFIG.measuresPerPage;
  const systemIndex = Math.floor(measureInPage / PAGE_CONFIG.measuresPerSystem);
  const measureInSystem = measureInPage % PAGE_CONFIG.measuresPerSystem;

  return {
    pageIndex,
    systemIndex,
    measureInSystem,
    measureInPage,
  };
}
