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

  // Pagination presets
  paginationPresets: {
    '8_MEASURES': {
      measuresPerPage: 8,
      systemsPerPage: 2,
      measuresPerSystem: 4,
    },
    '16_MEASURES': {
      measuresPerPage: 16,
      systemsPerPage: 4,
      measuresPerSystem: 4,
    },
  },

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

/**
 * Apply a pagination preset to the page config
 * @param {string} presetName - Name of preset ('8_MEASURES' or '16_MEASURES')
 */
export function applyPaginationPreset(presetName) {
  const preset = PAGE_CONFIG.paginationPresets[presetName];
  if (!preset) {
    console.warn(`Unknown pagination preset: ${presetName}`);
    return;
  }

  PAGE_CONFIG.measuresPerPage = preset.measuresPerPage;
  PAGE_CONFIG.systemsPerPage = preset.systemsPerPage;
  PAGE_CONFIG.measuresPerSystem = preset.measuresPerSystem;
}

/**
 * Get the current pagination preset name
 * @returns {string} - Preset name or 'CUSTOM'
 */
export function getCurrentPreset() {
  for (const [name, preset] of Object.entries(PAGE_CONFIG.paginationPresets)) {
    if (
      preset.measuresPerPage === PAGE_CONFIG.measuresPerPage &&
      preset.systemsPerPage === PAGE_CONFIG.systemsPerPage &&
      preset.measuresPerSystem === PAGE_CONFIG.measuresPerSystem
    ) {
      return name;
    }
  }
  return 'CUSTOM';
}

/**
 * Calculate total number of pages needed for given measure count
 * @param {number} totalMeasures - Total number of measures
 * @returns {number} - Number of pages
 */
export function getTotalPages(totalMeasures) {
  return Math.ceil(totalMeasures / PAGE_CONFIG.measuresPerPage);
}

/**
 * Get the range of measures for a specific page
 * @param {number} pageIndex - Page index (0-based)
 * @returns {Object} - { startMeasure, endMeasure }
 */
export function getMeasureRangeForPage(pageIndex) {
  const startMeasure = pageIndex * PAGE_CONFIG.measuresPerPage;
  const endMeasure = startMeasure + PAGE_CONFIG.measuresPerPage - 1;

  return {
    startMeasure,
    endMeasure,
  };
}
