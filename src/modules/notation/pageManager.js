/**
 * Page Manager - Manages multi-page canvas system for music notation
 * Each page represents one sheet of music paper
 */

import { PAGE_CONFIG, getPageForMeasure, getMeasurePagePosition } from './pageConfig.js';

export class PageManager {
  constructor(container, options = {}) {
    this.container = container;
    this.pages = []; // Array of page objects
    this.currentViewMode = options.viewMode || PAGE_CONFIG.defaultViewMode || PAGE_CONFIG.viewModes.CONTINUOUS;
    this.currentPage = 0; // For single page view
    this.pageLayoutManager = null; // Reference to PageLayoutManager
    this.onPageChange = options.onPageChange || null; // Callback when page changes

    this.init();
  }

  init() {
    // Create initial page
    this.addPage();
  }

  /**
   * Set the PageLayoutManager reference
   * @param {PageLayoutManager} pageLayoutManager - Page layout manager instance
   */
  setPageLayoutManager(pageLayoutManager) {
    this.pageLayoutManager = pageLayoutManager;
  }

  /**
   * Update the container where new pages are appended
   * Used when switching between normal and fullscreen modes
   * @param {HTMLElement} newContainer - New container element
   */
  setContainer(newContainer) {
    this.container = newContainer;
  }

  /**
   * Get the current container
   * @returns {HTMLElement} - Current container element
   */
  getContainer() {
    return this.container;
  }

  /**
   * Create a new page canvas
   * @returns {Object} - Page object with canvas and context
   */
  addPage() {
    const pageIndex = this.pages.length;

    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.id = `notation-page-${pageIndex}`;
    canvas.className = 'notation-page';
    canvas.width = PAGE_CONFIG.width;
    canvas.height = PAGE_CONFIG.height;

    // Style the canvas
    canvas.style.display = 'block';
    canvas.style.backgroundColor = PAGE_CONFIG.pageBackground;
    canvas.style.boxShadow = PAGE_CONFIG.pageShadow;
    canvas.style.marginBottom = PAGE_CONFIG.pageGap + 'px';
    canvas.style.cursor = 'default';

    // For two-page spread, add side margins
    if (this.currentViewMode === PAGE_CONFIG.viewModes.TWO_PAGE) {
      canvas.style.display = 'inline-block';
      canvas.style.marginRight = PAGE_CONFIG.pageGap + 'px';
    }

    // Add to container
    this.container.appendChild(canvas);

    // Get context
    const ctx = canvas.getContext('2d');

    // Create page object
    const page = {
      index: pageIndex,
      canvas,
      ctx,
      measures: [], // Measures rendered on this page
    };

    this.pages.push(page);

    return page;
  }

  /**
   * Get page for a given measure index
   * Creates pages as needed
   * @param {number} measureIndex - Measure index
   * @returns {Object} - Page object
   */
  getPageForMeasure(measureIndex) {
    const pageIndex = getPageForMeasure(measureIndex);

    // Create pages up to needed page
    while (this.pages.length <= pageIndex) {
      this.addPage();
    }

    return this.pages[pageIndex];
  }

  /**
   * Get all pages
   * @returns {Array} - Array of page objects
   */
  getAllPages() {
    return this.pages;
  }

  /**
   * Get page by index
   * @param {number} pageIndex - Page index
   * @returns {Object|null} - Page object or null
   */
  getPage(pageIndex) {
    return this.pages[pageIndex] || null;
  }

  /**
   * Get page canvas element from mouse event
   * @param {MouseEvent} e - Mouse event
   * @returns {Object|null} - { page, x, y } or null
   */
  getPageFromEvent(e) {
    // Find which canvas was targeted
    let target = e.target;
    if (!target || target.tagName !== 'CANVAS') {
      return null;
    }

    // Find page with this canvas
    const page = this.pages.find(p => p.canvas === target);
    if (!page) {
      return null;
    }

    // Get page-local coordinates
    const rect = page.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    return { page, x, y };
  }

  /**
   * Clear a specific page
   * @param {number} pageIndex - Page index
   */
  clearPage(pageIndex) {
    const page = this.getPage(pageIndex);
    if (page) {
      page.ctx.clearRect(0, 0, page.canvas.width, page.canvas.height);
      page.measures = [];
    }
  }

  /**
   * Clear all pages
   */
  clearAllPages() {
    this.pages.forEach(page => {
      page.ctx.clearRect(0, 0, page.canvas.width, page.canvas.height);
      page.measures = [];
    });
  }

  /**
   * Set view mode (single, two-page spread, continuous)
   * @param {string} mode - View mode from PAGE_CONFIG.viewModes
   */
  setViewMode(mode) {
    if (!Object.values(PAGE_CONFIG.viewModes).includes(mode)) {
      console.warn('[PageManager] Invalid view mode:', mode);
      return;
    }

    this.currentViewMode = mode;
    this.updateLayout();
  }

  /**
   * Update page layout based on current view mode
   */
  updateLayout() {
    this.pages.forEach((page, index) => {
      const canvas = page.canvas;

      switch (this.currentViewMode) {
        case PAGE_CONFIG.viewModes.SINGLE:
          // Show only current page
          canvas.style.display = (index === this.currentPage) ? 'block' : 'none';
          canvas.style.marginRight = '0';
          break;

        case PAGE_CONFIG.viewModes.TWO_PAGE:
          // Show two pages side-by-side (book view)
          const startPage = Math.floor(this.currentPage / 2) * 2;
          const isVisible = index >= startPage && index < startPage + 2;
          canvas.style.display = isVisible ? 'inline-block' : 'none';
          canvas.style.marginRight = (index % 2 === 0) ? PAGE_CONFIG.pageGap + 'px' : '0';
          break;

        case PAGE_CONFIG.viewModes.CONTINUOUS:
          // Show all pages vertically
          canvas.style.display = 'block';
          canvas.style.marginRight = '0';
          break;
      }
    });
  }

  /**
   * Navigate to specific page (for single/two-page view)
   * @param {number} pageIndex - Page index
   * @returns {boolean} - True if navigation was successful
   */
  goToPage(pageIndex) {
    // CRITICAL: Use logical page count from PageLayoutManager for validation
    // Canvas pages are created lazily during renderWithPagination()
    const totalPages = this.pageLayoutManager
      ? this.pageLayoutManager.getTotalPages()
      : this.pages.length;

    if (pageIndex < 0 || pageIndex >= totalPages) {
      return false;
    }

    this.currentPage = pageIndex;

    // Sync with PageLayoutManager if available
    if (this.pageLayoutManager) {
      this.pageLayoutManager.setCurrentPage(pageIndex);
    }

    // Only update layout if the canvas exists (it will be created by render)
    if (pageIndex < this.pages.length) {
      this.updateLayout();
    }

    // Trigger callback
    if (this.onPageChange) {
      this.onPageChange(pageIndex);
    }

    return true;
  }

  /**
   * Go to next page
   * @returns {boolean} - True if navigation was successful
   */
  nextPage() {
    const increment = this.currentViewMode === PAGE_CONFIG.viewModes.TWO_PAGE ? 2 : 1;
    const nextPage = this.currentPage + increment;

    // CRITICAL: Use logical page count from PageLayoutManager, not physical canvas count
    // Canvas pages are created lazily during renderWithPagination(), but navigation
    // needs to know the total logical pages based on measure count
    const totalPages = this.pageLayoutManager
      ? this.pageLayoutManager.getTotalPages()
      : this.pages.length;

    if (nextPage >= totalPages) {
      return false;
    }

    return this.goToPage(nextPage);
  }

  /**
   * Go to previous page
   * @returns {boolean} - True if navigation was successful
   */
  previousPage() {
    const decrement = this.currentViewMode === PAGE_CONFIG.viewModes.TWO_PAGE ? 2 : 1;
    const prevPage = Math.max(0, this.currentPage - decrement);

    if (prevPage === this.currentPage) {
      return false;
    }

    return this.goToPage(prevPage);
  }

  /**
   * Get current page index
   * @returns {number}
   */
  getCurrentPage() {
    return this.currentPage;
  }

  /**
   * Get page metadata for display
   * @returns {Object} - { currentPage, totalPages, canGoNext, canGoPrev }
   */
  getPageMetadata() {
    // CRITICAL: Use logical page count from PageLayoutManager for accurate navigation state
    // Canvas pages are created lazily, so this.pages.length may not reflect true total
    const totalPages = this.pageLayoutManager
      ? this.pageLayoutManager.getTotalPages()
      : this.pages.length;

    return {
      currentPage: this.currentPage + 1, // 1-based for display
      totalPages: totalPages,
      canGoNext: this.currentPage < totalPages - 1,
      canGoPrev: this.currentPage > 0,
    };
  }

  /**
   * Register measure on a page
   * @param {number} pageIndex - Page index
   * @param {number} measureIndex - Measure index
   * @param {Object} bounds - Measure bounds { x, y, width, height, trebleY, bassY }
   */
  registerMeasure(pageIndex, measureIndex, bounds) {
    const page = this.getPage(pageIndex);
    if (page) {
      page.measures.push({
        index: measureIndex,
        bounds,
      });
    }
  }

  /**
   * Get measures on a specific page
   * @param {number} pageIndex - Page index
   * @returns {Array} - Array of measure data
   */
  getPageMeasures(pageIndex) {
    const page = this.getPage(pageIndex);
    return page ? page.measures : [];
  }

  /**
   * Destroy all pages and clean up
   */
  destroy() {
    this.pages.forEach(page => {
      if (page.canvas.parentElement) {
        page.canvas.parentElement.removeChild(page.canvas);
      }
    });
    this.pages = [];
  }
}
