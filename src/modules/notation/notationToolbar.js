/**
 * Notation Toolbar - UI controls for notation editing
 * Part of the Phase 4.4 VexFlow Professional Notation enhancement
 *
 * This module creates and manages the toolbar for note entry and editing,
 * including duration selection, rests, accidentals, and display options.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Available note durations
 */
export const DURATIONS = [
  { id: '1n', label: 'Whole', symbol: '𝅝', beats: 4 },
  { id: '2n', label: 'Half', symbol: '𝅗𝅥', beats: 2 },
  { id: '4n', label: 'Quarter', symbol: '♩', beats: 1 },
  { id: '8n', label: 'Eighth', symbol: '♪', beats: 0.5 },
  { id: '16n', label: '16th', symbol: '𝅘𝅥𝅯', beats: 0.25 },
  { id: '32n', label: '32nd', symbol: '𝅘𝅥𝅰', beats: 0.125 },
];

/**
 * Accidental types
 */
export const ACCIDENTALS = [
  { id: '#', label: 'Sharp', symbol: '♯' },
  { id: 'b', label: 'Flat', symbol: '♭' },
  { id: 'n', label: 'Natural', symbol: '♮' },
];

/**
 * Articulation types
 */
export const ARTICULATIONS = [
  { id: 'staccato', label: 'Staccato', symbol: '.' },
  { id: 'accent', label: 'Accent', symbol: '>' },
  { id: 'tenuto', label: 'Tenuto', symbol: '—' },
  { id: 'marcato', label: 'Marcato', symbol: '^' },
];

/**
 * Zoom levels
 */
export const ZOOM_LEVELS = [50, 75, 100, 125, 150, 175, 200];

/**
 * Measures per line options
 */
export const MEASURES_PER_LINE_OPTIONS = [2, 3, 4, 5, 6, 8];

// ============================================================================
// TOOLBAR CLASS
// ============================================================================

/**
 * Notation toolbar controller
 */
export class NotationToolbar {
  constructor(options = {}) {
    this.container = null;
    this.currentDuration = '4n';
    this.isRestMode = false;
    this.isDotted = false;
    this.currentAccidental = null;
    this.currentArticulation = null;
    this.zoom = 100;
    this.measuresPerLine = 4;
    this.voiceNumber = 1;

    // Callbacks
    this.onDurationChange = options.onDurationChange || (() => {});
    this.onRestModeChange = options.onRestModeChange || (() => {});
    this.onDottedChange = options.onDottedChange || (() => {});
    this.onAccidentalChange = options.onAccidentalChange || (() => {});
    this.onArticulationChange = options.onArticulationChange || (() => {});
    this.onZoomChange = options.onZoomChange || (() => {});
    this.onMeasuresPerLineChange = options.onMeasuresPerLineChange || (() => {});
    this.onVoiceChange = options.onVoiceChange || (() => {});
    this.onUndo = options.onUndo || (() => {});
    this.onRedo = options.onRedo || (() => {});
    this.onDelete = options.onDelete || (() => {});
    this.onTie = options.onTie || (() => {});
  }

  /**
   * Create the toolbar element
   * @param {HTMLElement} container - Container element
   */
  create(container) {
    this.container = container;
    this.render();
    this.attachEventListeners();
  }

  /**
   * Render the toolbar HTML
   */
  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="notation-toolbar">
        <!-- Duration Section -->
        <div class="toolbar-section duration-section">
          <span class="section-label">Duration</span>
          <div class="button-group duration-buttons">
            ${DURATIONS.map(d => `
              <button
                class="toolbar-btn duration-btn ${d.id === this.currentDuration ? 'active' : ''}"
                data-duration="${d.id}"
                title="${d.label} note"
              >
                ${d.symbol}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Modifiers Section -->
        <div class="toolbar-section modifiers-section">
          <button
            class="toolbar-btn rest-btn ${this.isRestMode ? 'active' : ''}"
            data-action="rest"
            title="Rest"
          >
            𝄽
          </button>
          <button
            class="toolbar-btn dot-btn ${this.isDotted ? 'active' : ''}"
            data-action="dot"
            title="Dotted"
          >
            •
          </button>
          <button
            class="toolbar-btn tie-btn"
            data-action="tie"
            title="Tie"
          >
            ⁀
          </button>
        </div>

        <!-- Accidentals Section -->
        <div class="toolbar-section accidentals-section">
          <span class="section-label">Accidental</span>
          <div class="button-group accidental-buttons">
            ${ACCIDENTALS.map(a => `
              <button
                class="toolbar-btn accidental-btn ${a.id === this.currentAccidental ? 'active' : ''}"
                data-accidental="${a.id}"
                title="${a.label}"
              >
                ${a.symbol}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Articulations Section -->
        <div class="toolbar-section articulations-section">
          <span class="section-label">Articulation</span>
          <div class="button-group articulation-buttons">
            ${ARTICULATIONS.map(a => `
              <button
                class="toolbar-btn articulation-btn ${a.id === this.currentArticulation ? 'active' : ''}"
                data-articulation="${a.id}"
                title="${a.label}"
              >
                ${a.symbol}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Edit Section -->
        <div class="toolbar-section edit-section">
          <button
            class="toolbar-btn undo-btn"
            data-action="undo"
            title="Undo (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            class="toolbar-btn redo-btn"
            data-action="redo"
            title="Redo (Ctrl+Y)"
          >
            ↪
          </button>
          <button
            class="toolbar-btn delete-btn"
            data-action="delete"
            title="Delete (Del)"
          >
            🗑
          </button>
        </div>

        <!-- Voice Section -->
        <div class="toolbar-section voice-section">
          <span class="section-label">Voice</span>
          <select class="voice-select" title="Select voice">
            <option value="1" ${this.voiceNumber === 1 ? 'selected' : ''}>Voice 1</option>
            <option value="2" ${this.voiceNumber === 2 ? 'selected' : ''}>Voice 2</option>
          </select>
        </div>

        <!-- View Section -->
        <div class="toolbar-section view-section">
          <span class="section-label">Zoom</span>
          <select class="zoom-select" title="Zoom level">
            ${ZOOM_LEVELS.map(z => `
              <option value="${z}" ${z === this.zoom ? 'selected' : ''}>${z}%</option>
            `).join('')}
          </select>

          <span class="section-label">Measures/Line</span>
          <select class="measures-select" title="Measures per line">
            ${MEASURES_PER_LINE_OPTIONS.map(m => `
              <option value="${m}" ${m === this.measuresPerLine ? 'selected' : ''}>${m}</option>
            `).join('')}
          </select>
        </div>
      </div>
    `;

    // Add styles
    this.addStyles();
  }

  /**
   * Add toolbar styles
   */
  addStyles() {
    if (document.getElementById('notation-toolbar-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'notation-toolbar-styles';
    styles.textContent = `
      .notation-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        padding: 12px;
        background: var(--bg-secondary, #2a2a2a);
        border-radius: 8px;
        margin-bottom: 16px;
        align-items: center;
      }

      .toolbar-section {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .section-label {
        font-size: 12px;
        color: var(--text-muted, #888);
        margin-right: 4px;
      }

      .button-group {
        display: flex;
        gap: 2px;
      }

      .toolbar-btn {
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 4px;
        background: var(--bg-tertiary, #333);
        color: var(--text-primary, #fff);
        font-size: 18px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }

      .toolbar-btn:hover {
        background: var(--bg-hover, #444);
      }

      .toolbar-btn.active {
        background: var(--accent-color, #4a9eff);
        color: white;
      }

      .toolbar-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .duration-btn {
        font-size: 20px;
      }

      .accidental-btn {
        font-size: 16px;
      }

      .articulation-btn {
        font-size: 14px;
        font-weight: bold;
      }

      .toolbar-section select {
        padding: 6px 8px;
        border-radius: 4px;
        border: none;
        background: var(--bg-tertiary, #333);
        color: var(--text-primary, #fff);
        font-size: 12px;
        cursor: pointer;
      }

      .toolbar-section select:focus {
        outline: 2px solid var(--accent-color, #4a9eff);
      }

      .zoom-select, .measures-select, .voice-select {
        min-width: 70px;
      }

      @media (max-width: 768px) {
        .notation-toolbar {
          padding: 8px;
          gap: 8px;
        }

        .toolbar-btn {
          width: 32px;
          height: 32px;
          font-size: 16px;
        }

        .section-label {
          display: none;
        }
      }
    `;
    document.head.appendChild(styles);
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    if (!this.container) return;

    // Duration buttons
    this.container.querySelectorAll('.duration-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.setDuration(e.target.dataset.duration);
      });
    });

    // Rest button
    this.container.querySelector('.rest-btn')?.addEventListener('click', () => {
      this.toggleRestMode();
    });

    // Dot button
    this.container.querySelector('.dot-btn')?.addEventListener('click', () => {
      this.toggleDotted();
    });

    // Tie button
    this.container.querySelector('.tie-btn')?.addEventListener('click', () => {
      this.onTie();
    });

    // Accidental buttons
    this.container.querySelectorAll('.accidental-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.setAccidental(e.target.dataset.accidental);
      });
    });

    // Articulation buttons
    this.container.querySelectorAll('.articulation-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.setArticulation(e.target.dataset.articulation);
      });
    });

    // Undo/Redo/Delete
    this.container.querySelector('[data-action="undo"]')?.addEventListener('click', () => {
      this.onUndo();
    });

    this.container.querySelector('[data-action="redo"]')?.addEventListener('click', () => {
      this.onRedo();
    });

    this.container.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      this.onDelete();
    });

    // Voice select
    this.container.querySelector('.voice-select')?.addEventListener('change', (e) => {
      this.voiceNumber = parseInt(e.target.value, 10);
      this.onVoiceChange(this.voiceNumber);
    });

    // Zoom select
    this.container.querySelector('.zoom-select')?.addEventListener('change', (e) => {
      this.zoom = parseInt(e.target.value, 10);
      this.onZoomChange(this.zoom);
    });

    // Measures per line select
    this.container.querySelector('.measures-select')?.addEventListener('change', (e) => {
      this.measuresPerLine = parseInt(e.target.value, 10);
      this.onMeasuresPerLineChange(this.measuresPerLine);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  /**
   * Handle keyboard shortcuts
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyDown(e) {
    // Skip if user is typing in an input field
    if (e.target.matches('input, textarea')) {
      return;
    }

    // Allow browser shortcuts when Ctrl/Meta is pressed (except for undo/redo)
    const hasModifier = e.ctrlKey || e.metaKey || e.altKey;

    // Undo/Redo - these intentionally override browser shortcuts
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.onRedo();
        } else {
          this.onUndo();
        }
        return;
      }
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        this.onRedo();
        return;
      }
      // Let all other Ctrl/Cmd shortcuts pass through to the browser
      // (e.g., Ctrl+Plus/Minus for zoom, Ctrl+F for find, etc.)
      return;
    }

    // Duration shortcuts (1-6) - only when no modifiers
    if (!hasModifier && e.key >= '1' && e.key <= '6') {
      const index = parseInt(e.key, 10) - 1;
      if (index < DURATIONS.length) {
        e.preventDefault();
        this.setDuration(DURATIONS[index].id);
      }
    }

    // Rest mode (R)
    if (!hasModifier && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      this.toggleRestMode();
    }

    // Dotted (.)
    if (!hasModifier && e.key === '.') {
      e.preventDefault();
      this.toggleDotted();
    }

    // Accidentals - only when no modifiers to avoid conflicts with browser shortcuts
    if (!hasModifier) {
      if (e.key === '#' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.setAccidental('#');
      }
      if (e.key === '-' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        this.setAccidental('b');
      }
      if (e.key === '=' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        this.setAccidental('n');
      }
    }

    // Delete
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.onDelete();
    }

    // Tie (T)
    if (!hasModifier && (e.key === 't' || e.key === 'T')) {
      e.preventDefault();
      this.onTie();
    }
  }

  /**
   * Set current duration
   * @param {string} duration - Duration ID
   */
  setDuration(duration) {
    this.currentDuration = duration;
    this.updateDurationButtons();
    this.onDurationChange(duration);
  }

  /**
   * Get current duration
   * @returns {string} - Current duration
   */
  getDuration() {
    return this.isDotted ? this.currentDuration + '.' : this.currentDuration;
  }

  /**
   * Toggle rest mode
   */
  toggleRestMode() {
    this.isRestMode = !this.isRestMode;
    this.updateRestButton();
    this.onRestModeChange(this.isRestMode);
  }

  /**
   * Toggle dotted
   */
  toggleDotted() {
    this.isDotted = !this.isDotted;
    this.updateDotButton();
    this.onDottedChange(this.isDotted);
  }

  /**
   * Set accidental
   * @param {string} accidental - Accidental ID or null to clear
   */
  setAccidental(accidental) {
    // Toggle if clicking the same accidental
    if (this.currentAccidental === accidental) {
      this.currentAccidental = null;
    } else {
      this.currentAccidental = accidental;
    }
    this.updateAccidentalButtons();
    this.onAccidentalChange(this.currentAccidental);
  }

  /**
   * Set articulation
   * @param {string} articulation - Articulation ID or null to clear
   */
  setArticulation(articulation) {
    // Toggle if clicking the same articulation
    if (this.currentArticulation === articulation) {
      this.currentArticulation = null;
    } else {
      this.currentArticulation = articulation;
    }
    this.updateArticulationButtons();
    this.onArticulationChange(this.currentArticulation);
  }

  /**
   * Update duration button states
   */
  updateDurationButtons() {
    if (!this.container) return;
    this.container.querySelectorAll('.duration-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.duration === this.currentDuration);
    });
  }

  /**
   * Update rest button state
   */
  updateRestButton() {
    if (!this.container) return;
    const btn = this.container.querySelector('.rest-btn');
    if (btn) btn.classList.toggle('active', this.isRestMode);
  }

  /**
   * Update dot button state
   */
  updateDotButton() {
    if (!this.container) return;
    const btn = this.container.querySelector('.dot-btn');
    if (btn) btn.classList.toggle('active', this.isDotted);
  }

  /**
   * Update accidental button states
   */
  updateAccidentalButtons() {
    if (!this.container) return;
    this.container.querySelectorAll('.accidental-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.accidental === this.currentAccidental);
    });
  }

  /**
   * Update articulation button states
   */
  updateArticulationButtons() {
    if (!this.container) return;
    this.container.querySelectorAll('.articulation-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.articulation === this.currentArticulation);
    });
  }

  /**
   * Set undo/redo button states
   * @param {boolean} canUndo - Can undo
   * @param {boolean} canRedo - Can redo
   */
  setUndoRedoState(canUndo, canRedo) {
    if (!this.container) return;
    const undoBtn = this.container.querySelector('.undo-btn');
    const redoBtn = this.container.querySelector('.redo-btn');
    if (undoBtn) undoBtn.disabled = !canUndo;
    if (redoBtn) redoBtn.disabled = !canRedo;
  }

  /**
   * Get current tool state
   * @returns {Object} - Current tool state
   */
  getState() {
    return {
      duration: this.getDuration(),
      isRest: this.isRestMode,
      dotted: this.isDotted,
      accidental: this.currentAccidental,
      articulation: this.currentArticulation,
      voice: this.voiceNumber,
      zoom: this.zoom,
      measuresPerLine: this.measuresPerLine,
    };
  }

  /**
   * Reset tool state
   */
  reset() {
    this.currentDuration = '4n';
    this.isRestMode = false;
    this.isDotted = false;
    this.currentAccidental = null;
    this.currentArticulation = null;
    this.render();
    this.attachEventListeners();
  }

  /**
   * Destroy toolbar
   */
  destroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  DURATIONS,
  ACCIDENTALS,
  ARTICULATIONS,
  ZOOM_LEVELS,
  MEASURES_PER_LINE_OPTIONS,
  NotationToolbar,
};
