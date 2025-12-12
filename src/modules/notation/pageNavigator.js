/**
 * Page Navigator - UI controls for navigating between pages
 * Provides prev/next buttons and page indicator for paginated notation
 */

export class PageNavigator {
  constructor(options = {}) {
    this.container = null;
    this.pageManager = null;
    this.pageLayoutManager = null;

    // Callbacks
    this.onPageChange = options.onPageChange || (() => {});
    this.onMeasuresPerPageChange = options.onMeasuresPerPageChange || (() => {});

    // Current state
    this.currentPage = 1;
    this.totalPages = 1;
    this.measuresPerPageOption = '8_MEASURES';

    // DOM elements
    this.prevButton = null;
    this.nextButton = null;
    this.pageIndicator = null;
    this.measuresPerPageSelect = null;
  }

  /**
   * Set the PageManager reference
   * @param {PageManager} pageManager - Page manager instance
   */
  setPageManager(pageManager) {
    this.pageManager = pageManager;
  }

  /**
   * Set the PageLayoutManager reference
   * @param {PageLayoutManager} pageLayoutManager - Page layout manager instance
   */
  setPageLayoutManager(pageLayoutManager) {
    this.pageLayoutManager = pageLayoutManager;
  }

  /**
   * Create the navigator element
   * @param {HTMLElement} container - Container element
   */
  create(container) {
    this.container = container;
    this.render();
    this.attachEventListeners();
    this.updateDisplay();
  }

  /**
   * Render the navigator HTML
   */
  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="page-navigator" style="
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 2px 4px;
        background-color: #f5f5f5;
        border-radius: 3px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 10px;
        height: 24px;
      ">
        <!-- Measures per page selector -->
        <div style="display: flex; align-items: center; gap: 3px;">
          <label for="measures-per-page-select" style="font-size: 9px; color: #555; white-space: nowrap;">
            Measures:
          </label>
          <select id="measures-per-page-select" style="
            padding: 1px 4px;
            border: 1px solid #ccc;
            border-radius: 2px;
            background-color: white;
            cursor: pointer;
            font-size: 9px;
            height: 18px;
          ">
            <option value="8_MEASURES">8</option>
            <option value="16_MEASURES">16</option>
          </select>
        </div>

        <!-- Separator -->
        <div style="width: 1px; height: 16px; background-color: #ddd;"></div>

        <!-- Navigation controls -->
        <div style="display: flex; align-items: center; gap: 4px;">
          <button id="page-nav-prev" style="
            padding: 2px 6px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 9px;
            font-weight: 500;
            transition: background-color 0.2s;
            height: 18px;
            line-height: 1;
          " onmouseover="this.style.backgroundColor='#0056b3'" onmouseout="this.style.backgroundColor='#007bff'">
            ←
          </button>

          <div id="page-indicator" style="
            font-size: 9px;
            font-weight: 600;
            color: #333;
            min-width: 50px;
            text-align: center;
            white-space: nowrap;
          ">
            Page 1 of 1
          </div>

          <button id="page-nav-next" style="
            padding: 2px 6px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 2px;
            cursor: pointer;
            font-size: 9px;
            font-weight: 500;
            transition: background-color 0.2s;
            height: 18px;
            line-height: 1;
          " onmouseover="this.style.backgroundColor='#0056b3'" onmouseout="this.style.backgroundColor='#007bff'">
            →
          </button>
        </div>

        <!-- Measure range indicator -->
        <div id="measure-range" style="
          font-size: 9px;
          color: #666;
          padding-left: 4px;
          border-left: 1px solid #ddd;
          white-space: nowrap;
        ">
          1-8
        </div>
      </div>
    `;

    // Store references to interactive elements
    this.prevButton = this.container.querySelector('#page-nav-
    this.nextButton = this.container.querySelector('#page-nav-
    this.pageIndicator = this.container.querySelector('#page-
    this.measuresPerPageSelect = this.container.querySelector('#measures-per-page-
    this.measureRange = this.container.querySelector('#measure-
  }

  /**
   * Attach event listeners to navigation controls
   */
  attachEventListeners() {
    if (!this.prevButton || !this.nextButton || !this.measuresPerPageSelect) return;

    this.prevButton.addEventListener('click', () => this.handlePreviousPage());
    this.nextButton.addEventListener('click', () => this.handleNextPage());
    this.measuresPerPageSelect.addEventListener('change', (e) => this.handleMeasuresPerPageChange(e));

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  /**
   * Handle previous page button click
   */
  handlePreviousPage() {
    if (!this.pageManager) return;

    const success = this.pageManager.previousPage();
    if (success) {
      this.updateDisplay();
      this.onPageChange(this.pageManager.getCurrentPage());
    }
  }

  /**
   * Handle next page button click
   */
  handleNextPage() {
    if (!this.pageManager) return;

    const success = this.pageManager.nextPage();
    if (success) {
      this.updateDisplay();
      this.onPageChange(this.pageManager.getCurrentPage());
    }
  }

  /**
   * Handle measures per page selection change
   */
  handleMeasuresPerPageChange(e) {
    const preset = e.target.value;
    this.measuresPerPageOption = preset;

    // Trigger callback to notify parent component
    if (this.onMeasuresPerPageChange) {
      this.onMeasuresPerPageChange(preset);
    }
  }

  /**
   * Handle keyboard shortcuts for page navigation
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyboard(e) {
    // Only handle if no input field is focused
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }

    switch (e.key) {
      case 'PageDown':
      case 'ArrowRight':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.handleNextPage();
        }
        break;

      case 'PageUp':
      case 'ArrowLeft':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.handlePreviousPage();
        }
        break;
    }
  }

  /**
   * Update the display to reflect current page state
   */
  updateDisplay() {
    if (!this.pageManager || !this.pageLayoutManager) return;

    const metadata = this.pageManager.getPageMetadata();
    const pageLayoutMetadata = this.pageLayoutManager.getPageMetadata();

    this.currentPage = metadata.currentPage;
    this.totalPages = metadata.totalPages;

    // Update page indicator
    if (this.pageIndicator) {
      this.pageIndicator.textContent = `Page ${this.currentPage} of ${this.totalPages}`;
    }

    // Update measure range
    if (this.measureRange) {
      this.measureRange.textContent =
        `Measures ${pageLayoutMetadata.firstMeasure}-${pageLayoutMetadata.lastMeasure}`;
    }

    // Enable/disable buttons
    if (this.prevButton) {
      this.prevButton.disabled = !metadata.canGoPrev;
      this.prevButton.style.opacity = metadata.canGoPrev ? '1' : '0.5';
      this.prevButton.style.cursor = metadata.canGoPrev ? 'pointer' : 'not-allowed';
    }

    if (this.nextButton) {
      this.nextButton.disabled = !metadata.canGoNext;
      this.nextButton.style.opacity = metadata.canGoNext ? '1' : '0.5';
      this.nextButton.style.cursor = metadata.canGoNext ? 'pointer' : 'not-allowed';
    }
  }

  /**
   * Set the current page (updates display)
   * @param {number} pageIndex - Page index (0-based)
   */
  setCurrentPage(pageIndex) {
    if (!this.pageManager) return;

    this.pageManager.goToPage(pageIndex);
    this.updateDisplay();
  }

  /**
   * Destroy the navigator and clean up
   */
  destroy() {
    // Remove keyboard listener
    document.removeEventListener('keydown', this.handleKeyboard);

    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
