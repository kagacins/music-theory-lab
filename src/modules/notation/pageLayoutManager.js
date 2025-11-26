/**
 * Page Layout Manager
 * Handles distribution of measures across pages and tracks page-to-measure mappings
 */

import {
  PAGE_CONFIG,
  getTotalPages,
  getMeasureRangeForPage,
  getMeasurePagePosition,
} from './pageConfig.js';

export class PageLayoutManager {
  constructor() {
    this.pages = [];
    this.measureToPageMap = new Map();
    this.totalMeasures = 0;
    this.currentPageIndex = 0;
  }

  /**
   * Calculate page layout for all measures
   * @param {number} totalMeasures - Total number of measures
   */
  calculatePageLayout(totalMeasures) {
    this.totalMeasures = totalMeasures;
    this.pages = [];
    this.measureToPageMap.clear();

    const totalPageCount = getTotalPages(totalMeasures);

    for (let pageIndex = 0; pageIndex < totalPageCount; pageIndex++) {
      const { startMeasure, endMeasure } = getMeasureRangeForPage(pageIndex);

      // Clamp endMeasure to actual total measures
      const actualEndMeasure = Math.min(endMeasure, totalMeasures - 1);

      const page = {
        pageIndex,
        startMeasure,
        endMeasure: actualEndMeasure,
        measureCount: actualEndMeasure - startMeasure + 1,
        systems: this.calculateSystemsForPage(startMeasure, actualEndMeasure),
      };

      this.pages.push(page);

      // Map each measure to its page
      for (let m = startMeasure; m <= actualEndMeasure; m++) {
        this.measureToPageMap.set(m, pageIndex);
      }
    }

    return this.pages;
  }

  /**
   * Calculate systems for a specific page
   * @param {number} startMeasure - First measure on page
   * @param {number} endMeasure - Last measure on page
   * @returns {Array} - Array of system objects
   */
  calculateSystemsForPage(startMeasure, endMeasure) {
    const systems = [];
    const measuresPerSystem = PAGE_CONFIG.measuresPerSystem;
    const measureCount = endMeasure - startMeasure + 1;

    const systemCount = Math.ceil(measureCount / measuresPerSystem);

    for (let systemIndex = 0; systemIndex < systemCount; systemIndex++) {
      const systemStartMeasure = startMeasure + (systemIndex * measuresPerSystem);
      const systemEndMeasure = Math.min(
        systemStartMeasure + measuresPerSystem - 1,
        endMeasure
      );

      systems.push({
        systemIndex,
        startMeasure: systemStartMeasure,
        endMeasure: systemEndMeasure,
        measureCount: systemEndMeasure - systemStartMeasure + 1,
      });
    }

    return systems;
  }

  /**
   * Get page information for a specific measure
   * @param {number} measureIndex - Measure index
   * @returns {Object|null} - Page object or null if not found
   */
  getPageForMeasure(measureIndex) {
    const pageIndex = this.measureToPageMap.get(measureIndex);
    if (pageIndex === undefined) {
      return null;
    }
    return this.pages[pageIndex];
  }

  /**
   * Get the current page object
   * @returns {Object|null} - Current page object
   */
  getCurrentPage() {
    if (this.currentPageIndex < 0 || this.currentPageIndex >= this.pages.length) {
      return null;
    }
    return this.pages[this.currentPageIndex];
  }

  /**
   * Set the current page index
   * @param {number} pageIndex - Page index to set as current
   * @returns {boolean} - True if successful
   */
  setCurrentPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= this.pages.length) {
      return false;
    }
    this.currentPageIndex = pageIndex;
    return true;
  }

  /**
   * Navigate to the next page
   * @returns {boolean} - True if navigation was successful
   */
  nextPage() {
    if (this.currentPageIndex < this.pages.length - 1) {
      this.currentPageIndex++;
      return true;
    }
    return false;
  }

  /**
   * Navigate to the previous page
   * @returns {boolean} - True if navigation was successful
   */
  prevPage() {
    if (this.currentPageIndex > 0) {
      this.currentPageIndex--;
      return true;
    }
    return false;
  }

  /**
   * Navigate to the page containing a specific measure
   * @param {number} measureIndex - Measure index to navigate to
   * @returns {boolean} - True if navigation was successful
   */
  goToMeasure(measureIndex) {
    const pageIndex = this.measureToPageMap.get(measureIndex);
    if (pageIndex !== undefined) {
      this.currentPageIndex = pageIndex;
      return true;
    }
    return false;
  }

  /**
   * Get total number of pages
   * @returns {number} - Total page count
   */
  getTotalPages() {
    // If pages have been calculated, use that count
    if (this.pages.length > 0) {
      return this.pages.length;
    }
    // Fallback: calculate from totalMeasures if set
    if (this.totalMeasures > 0) {
      return getTotalPages(this.totalMeasures);
    }
    // Default: at least 1 page
    return 1;
  }

  /**
   * Check if a measure is on the current page
   * @param {number} measureIndex - Measure index
   * @returns {boolean} - True if measure is on current page
   */
  isMeasureOnCurrentPage(measureIndex) {
    const currentPage = this.getCurrentPage();
    if (!currentPage) {
      return false;
    }
    return measureIndex >= currentPage.startMeasure &&
           measureIndex <= currentPage.endMeasure;
  }

  /**
   * Get measures for the current page
   * @returns {Array} - Array of measure indices on current page
   */
  getCurrentPageMeasures() {
    const currentPage = this.getCurrentPage();
    if (!currentPage) {
      return [];
    }

    const measures = [];
    for (let i = currentPage.startMeasure; i <= currentPage.endMeasure; i++) {
      measures.push(i);
    }
    return measures;
  }

  /**
   * Get page metadata for display
   * @returns {Object} - { currentPage, totalPages, firstMeasure, lastMeasure }
   */
  getPageMetadata() {
    const currentPage = this.getCurrentPage();
    return {
      currentPage: this.currentPageIndex + 1, // 1-based for display
      totalPages: this.pages.length,
      firstMeasure: currentPage ? currentPage.startMeasure + 1 : 0, // 1-based
      lastMeasure: currentPage ? currentPage.endMeasure + 1 : 0, // 1-based
    };
  }

  /**
   * Get all pages
   * @returns {Array} - Array of all page objects
   */
  getAllPages() {
    return this.pages;
  }
}
