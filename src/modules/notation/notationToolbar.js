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

    // Selection state for contextual editing
    this.selectedNotesCount = 0;
    this.selectionDuration = null;  // null = no selection, 'mixed' = multiple durations, '4n' = all same
    this.selectionArticulation = null;  // null = none, 'mixed' = multiple, 'staccato' = all same
    this.selectionDotted = null;  // null = no selection, 'mixed' = multiple, true/false = all same
    this.selectionTied = null;  // null = no selection, 'mixed' = multiple, true/false = all same
    this.selectionTuplet = null;  // null = no tuplet, 'triplet'/'quintuplet'/'sextuplet' = all same tuplet type

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
    this.onChordSymbolApply = options.onChordSymbolApply || (() => {});
    this.onCopy = options.onCopy || (() => {});
    this.onPaste = options.onPaste || (() => {});
    this.onCopyBlock = options.onCopyBlock || (() => {});
    this.onOctaveShift = options.onOctaveShift || (() => {});
    this.onTupletCreate = options.onTupletCreate || (() => {});
    this.onTupletModeToggle = options.onTupletModeToggle || (() => {});
    this.onTupletRemove = options.onTupletRemove || (() => {});

    // Tuplet mode state
    this.tupletInsertMode = null; // null, 'triplet', 'quintuplet', 'sextuplet'
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
        <!-- Selection Indicator (shown when notes selected) -->
        <div class="toolbar-section selection-indicator" style="display: ${this.selectedNotesCount > 0 ? 'flex' : 'none'};">
          <span class="selection-badge">✓ ${this.selectedNotesCount} note${this.selectedNotesCount !== 1 ? 's' : ''} selected</span>
        </div>

        <!-- Duration Section -->
        <div class="toolbar-section duration-section">
          <span class="section-label">Duration</span>
          <div class="button-group duration-buttons">
            ${DURATIONS.map((d, i) => `
              <button
                class="toolbar-btn duration-btn ${d.id === this.currentDuration ? 'active' : ''}"
                data-duration="${d.id}"
                title="${d.label} note (Shift+${i + 1})"
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

        <!-- Tuplet Section -->
        <div class="toolbar-section tuplet-section">
          <span class="section-label">Tuplet</span>
          <div class="button-group tuplet-buttons">
            <button
              class="toolbar-btn tuplet-btn ${this.tupletInsertMode === 'triplet' ? 'active' : ''}"
              data-tuplet="triplet"
              title="Triplet (3:2) - Select 3 notes + Shift+3, or Ctrl+Shift+3 for insert mode"
            >
              3
            </button>
            <button
              class="toolbar-btn tuplet-btn ${this.tupletInsertMode === 'quintuplet' ? 'active' : ''}"
              data-tuplet="quintuplet"
              title="Quintuplet (5:4) - Select 5 notes + Shift+5, or Ctrl+Shift+5 for insert mode"
            >
              5
            </button>
            <button
              class="toolbar-btn tuplet-btn ${this.tupletInsertMode === 'sextuplet' ? 'active' : ''}"
              data-tuplet="sextuplet"
              title="Sextuplet (6:4) - Select 6 notes + Shift+6, or Ctrl+Shift+6 for insert mode"
            >
              6
            </button>
          </div>
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
            class="toolbar-btn copy-btn"
            data-action="copy"
            title="Copy Notes (Ctrl+C)"
          >
            📋
          </button>
          <button
            class="toolbar-btn copy-block-btn"
            data-action="copyBlock"
            title="Copy Building Block (Ctrl+Shift+C)"
          >
            ⊞
          </button>
          <button
            class="toolbar-btn paste-btn"
            data-action="paste"
            title="Paste (Ctrl+V)"
          >
            📥
          </button>
          <select class="paste-position-select" title="Paste Position">
            <option value="afterSelection">After Selection</option>
            <option value="beginning">At Beginning</option>
            <option value="end">At End</option>
          </select>
          <button
            class="toolbar-btn delete-btn"
            data-action="delete"
            title="Delete (Del)"
          >
            🗑
          </button>
        </div>

        <!-- Octave Section -->
        <div class="toolbar-section octave-section">
          <button
            class="toolbar-btn octave-up-btn"
            data-action="octaveUp"
            title="Octave Up (Ctrl+↑)"
          >
            ⬆8
          </button>
          <button
            class="toolbar-btn octave-down-btn"
            data-action="octaveDown"
            title="Octave Down (Ctrl+↓)"
          >
            ⬇8
          </button>
        </div>

        <!-- Chord Symbol Section -->
        <div class="toolbar-section chord-symbol-section">
          <span class="section-label">Chord Symbol</span>
          <input
            type="text"
            class="chord-symbol-input"
            placeholder="Cmaj7"
            title="Chord symbol (appears above measure)"
            maxlength="12"
          >
          <button class="toolbar-btn apply-chord-btn" title="Apply chord symbol to measure">
            Apply
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

      .toolbar-btn:focus {
        outline: none;
      }

      .toolbar-btn.active {
        background: var(--accent-color, #4a9eff);
        color: white;
      }

      .toolbar-btn.mixed {
        background: linear-gradient(135deg, var(--accent-color, #4a9eff) 50%, var(--bg-tertiary, #333) 50%);
        position: relative;
      }

      .toolbar-btn.mixed::after {
        content: '?';
        position: absolute;
        top: 2px;
        right: 2px;
        font-size: 10px;
        background: rgba(255,255,255,0.3);
        border-radius: 50%;
        width: 14px;
        height: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
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

      .selection-indicator {
        background: var(--accent-color, #4a9eff);
        padding: 8px 12px;
        border-radius: 6px;
        font-weight: bold;
      }

      .selection-badge {
        color: white;
        font-size: 13px;
        white-space: nowrap;
      }

      .chord-symbol-input {
        padding: 6px 10px;
        border-radius: 4px;
        border: 1px solid var(--bg-tertiary, #333);
        background: var(--bg-input, #222);
        color: var(--text-primary, #fff);
        font-size: 13px;
        font-family: 'Courier New', monospace;
        width: 100px;
        text-align: center;
      }

      .chord-symbol-input:focus {
        outline: 2px solid var(--accent-color, #4a9eff);
        border-color: var(--accent-color, #4a9eff);
      }

      .chord-symbol-input::placeholder {
        color: var(--text-muted, #666);
        font-style: italic;
      }

      .apply-chord-btn {
        width: auto;
        padding: 0 12px;
        font-size: 12px;
        font-weight: 600;
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

    // Duration buttons - use currentTarget to ensure we get the button element, not child text nodes
    this.container.querySelectorAll('.duration-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const duration = e.currentTarget.dataset.duration;
        console.log('[NotationToolbar] Duration button clicked:', duration);
        if (duration) {
          this.setDuration(duration);
        }
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

    // Accidental buttons - use currentTarget to ensure we get the button element
    this.container.querySelectorAll('.accidental-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const accidental = e.currentTarget.dataset.accidental;
        console.log('[NotationToolbar] Accidental button clicked:', accidental);
        if (accidental) {
          this.setAccidental(accidental);
        }
      });
    });

    // Articulation buttons - use currentTarget to ensure we get the button element
    this.container.querySelectorAll('.articulation-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const articulation = e.currentTarget.dataset.articulation;
        console.log('[NotationToolbar] Articulation button clicked:', articulation);
        if (articulation) {
          this.setArticulation(articulation);
        }
      });
    });

    // Tuplet buttons
    this.container.querySelectorAll('.tuplet-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tupletType = e.currentTarget.dataset.tuplet;
        console.log('[NotationToolbar] Tuplet button clicked:', tupletType, 'selectedNotesCount:', this.selectedNotesCount);

        // If notes are selected and selection has tuplet, remove it
        if (this.selectedNotesCount > 0 && this.selectionTuplet === tupletType) {
          this.onTupletRemove(tupletType);
          return;
        }

        // If notes are selected, try to create tuplet from selection
        if (this.selectedNotesCount > 0) {
          this.onTupletCreate(tupletType);
          return;
        }

        // No selection - toggle tuplet insert mode
        if (this.tupletInsertMode === tupletType) {
          this.setTupletInsertMode(null);
        } else {
          this.setTupletInsertMode(tupletType);
        }
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

    // Copy/Paste buttons
    this.container.querySelector('[data-action="copy"]')?.addEventListener('click', () => {
      this.onCopy();
    });

    this.container.querySelector('[data-action="paste"]')?.addEventListener('click', () => {
      const position = this.container.querySelector('.paste-position-select')?.value || 'afterSelection';
      this.onPaste(position);
    });

    this.container.querySelector('[data-action="copyBlock"]')?.addEventListener('click', () => {
      this.onCopyBlock();
    });

    this.container.querySelector('[data-action="octaveUp"]')?.addEventListener('click', () => {
      this.onOctaveShift(1);
    });

    this.container.querySelector('[data-action="octaveDown"]')?.addEventListener('click', () => {
      this.onOctaveShift(-1);
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

    // Chord symbol apply button
    this.container.querySelector('.apply-chord-btn')?.addEventListener('click', () => {
      const input = this.container.querySelector('.chord-symbol-input');
      const chordSymbol = input?.value.trim();
      if (chordSymbol) {
        this.onChordSymbolApply(chordSymbol);
        input.value = ''; // Clear after applying
      }
    });

    // Chord symbol input - apply on Enter key
    this.container.querySelector('.chord-symbol-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const chordSymbol = e.target.value.trim();
        if (chordSymbol) {
          this.onChordSymbolApply(chordSymbol);
          e.target.value = ''; // Clear after applying
        }
      }
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

    // Duration shortcuts (Shift+1-6) - Use Shift to avoid conflicts with chord/melody suggestion shortcuts (1-5)
    if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.key >= '1' && e.key <= '6') {
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
    // Note: '#' comes from Shift+3, but we only want it for accidentals, not tuplets
    // Only set sharp accidental with 's/S' keys, not '#' (which conflicts with tuplet Shift+3)
    if (!hasModifier) {
      if (e.key === 's' || e.key === 'S') {
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
    console.log('[NotationToolbar] setDuration called:', duration, '(was:', this.currentDuration, ')');
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
   * Set tuplet insert mode
   * @param {string|null} tupletType - 'triplet', 'quintuplet', 'sextuplet', or null to exit
   * @param {boolean} notifyNoteEditor - Whether to notify noteEditor of the change (default true)
   */
  setTupletInsertMode(tupletType, notifyNoteEditor = true) {
    console.log('[NotationToolbar] setTupletInsertMode called with:', tupletType, 'notify:', notifyNoteEditor);

    // Only notify if mode actually changed and notification is requested
    const modeChanged = this.tupletInsertMode !== tupletType;
    this.tupletInsertMode = tupletType;
    this.updateTupletButtons();

    // Only notify noteEditor if this is a user-initiated change (not a sync callback)
    if (modeChanged && notifyNoteEditor) {
      this.onTupletModeToggle(tupletType);
    }
  }

  /**
   * Update tuplet button states
   */
  updateTupletButtons() {
    if (!this.container) return;
    console.log('[NotationToolbar] updateTupletButtons - tupletInsertMode:', this.tupletInsertMode);
    this.container.querySelectorAll('.tuplet-btn').forEach(btn => {
      const isActive = btn.dataset.tuplet === this.tupletInsertMode;
      console.log(`[NotationToolbar] Button ${btn.dataset.tuplet}: active=${isActive}`);
      btn.classList.toggle('active', isActive);
    });
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
   * Update toolbar based on selected notes (contextual editing)
   * @param {Array} selectedNotes - Array of selected note objects
   */
  updateSelectionState(selectedNotes = []) {
    this.selectedNotesCount = selectedNotes.length;

    if (selectedNotes.length === 0) {
      // No selection - toolbar controls new note defaults
      this.selectionDuration = null;
      this.selectionArticulation = null;
      this.selectionDotted = null;
      this.selectionIsRest = null;
      this.selectionAccidental = null;
      this.selectionTied = null;
      this.selectionTuplet = null;

      // Hide selection indicator
      const indicator = this.container?.querySelector('.selection-indicator');
      if (indicator) indicator.style.display = 'none';

      // Reset accidental buttons to show current toolbar state
      this.updateAccidentalButtons();
      // Reset tie button
      this.updateTieButtonForSelection();
      // Reset tuplet buttons
      this.updateTupletButtonsForSelection();

      return;
    }

    // Analyze selected notes to find common properties
    const durations = new Set();
    const articulations = new Set();
    const dottedStates = new Set();
    const restStates = new Set();
    const accidentals = new Set();
    const tiedStates = new Set();
    const tupletTypes = new Set();

    selectedNotes.forEach(note => {
      if (note.duration) durations.add(note.duration);
      articulations.add(note.articulation || 'none');
      dottedStates.add(note.dotted || false);
      restStates.add(note.isRest || note.type === 'rest' || false);
      accidentals.add(note.accidental || 'none');
      tiedStates.add(note.tied || note.isTied || false);
      tupletTypes.add(note.tuplet?.type || 'none');
    });

    // Set selection state
    this.selectionDuration = durations.size === 1 ? [...durations][0] : 'mixed';
    this.selectionArticulation = articulations.size === 1 ? ([...articulations][0] === 'none' ? null : [...articulations][0]) : 'mixed';
    this.selectionDotted = dottedStates.size === 1 ? [...dottedStates][0] : 'mixed';
    this.selectionIsRest = restStates.size === 1 ? [...restStates][0] : 'mixed';
    this.selectionAccidental = accidentals.size === 1 ? ([...accidentals][0] === 'none' ? null : [...accidentals][0]) : 'mixed';
    this.selectionTied = tiedStates.size === 1 ? [...tiedStates][0] : 'mixed';
    this.selectionTuplet = tupletTypes.size === 1 ? ([...tupletTypes][0] === 'none' ? null : [...tupletTypes][0]) : 'mixed';

    console.log('[NotationToolbar] Selection state:', {
      count: this.selectedNotesCount,
      duration: this.selectionDuration,
      articulation: this.selectionArticulation,
      dotted: this.selectionDotted,
      isRest: this.selectionIsRest,
      accidental: this.selectionAccidental,
      tied: this.selectionTied,
      tuplet: this.selectionTuplet
    });

    // Update selection indicator
    const indicator = this.container?.querySelector('.selection-indicator');
    if (indicator) {
      indicator.style.display = 'flex';
      const badge = indicator.querySelector('.selection-badge');
      if (badge) {
        // Show "rest(s)" or "note(s)" based on selection
        const itemType = this.selectionIsRest === true ? 'rest' :
                        this.selectionIsRest === false ? 'note' : 'item';
        badge.textContent = `✓ ${this.selectedNotesCount} ${itemType}${this.selectedNotesCount !== 1 ? 's' : ''} selected`;
      }
    }

    // Update button states to reflect selection
    this.updateDurationButtonsForSelection();
    this.updateArticulationButtonsForSelection();
    this.updateDotButtonForSelection();
    this.updateRestButtonForSelection();
    this.updateAccidentalButtonsForSelection();
    this.updateTieButtonForSelection();
    this.updateTupletButtonsForSelection();
  }

  /**
   * Update duration buttons to show selection state
   */
  updateDurationButtonsForSelection() {
    if (!this.container) return;

    this.container.querySelectorAll('.duration-btn').forEach(btn => {
      const isActive = this.selectionDuration && this.selectionDuration === btn.dataset.duration;
      const isMixed = this.selectionDuration === 'mixed';

      btn.classList.toggle('active', isActive);
      btn.classList.toggle('mixed', isMixed);

      // Update title to show mode
      const durationName = DURATIONS.find(d => d.id === btn.dataset.duration)?.label || '';
      if (this.selectedNotesCount > 0) {
        btn.title = `Change selected notes to ${durationName}`;
      } else {
        const index = DURATIONS.findIndex(d => d.id === btn.dataset.duration);
        btn.title = `${durationName} note (Shift+${index + 1})`;
      }
    });
  }

  /**
   * Update articulation buttons to show selection state
   */
  updateArticulationButtonsForSelection() {
    if (!this.container) return;

    this.container.querySelectorAll('.articulation-btn').forEach(btn => {
      const isActive = this.selectionArticulation && this.selectionArticulation === btn.dataset.articulation;
      const isMixed = this.selectionArticulation === 'mixed';

      btn.classList.toggle('active', isActive);
      btn.classList.toggle('mixed', isMixed);

      // Update title
      const artName = ARTICULATIONS.find(a => a.id === btn.dataset.articulation)?.label || '';
      if (this.selectedNotesCount > 0) {
        btn.title = `Toggle ${artName} on selected notes`;
      } else {
        btn.title = artName;
      }
    });
  }

  /**
   * Update dot button to show selection state
   */
  updateDotButtonForSelection() {
    if (!this.container) return;

    const btn = this.container.querySelector('.dot-btn');
    if (!btn) return;

    const isActive = this.selectionDotted === true;
    const isMixed = this.selectionDotted === 'mixed';

    btn.classList.toggle('active', isActive);
    btn.classList.toggle('mixed', isMixed);

    // Update title
    if (this.selectedNotesCount > 0) {
      btn.title = 'Toggle dotted on selected notes';
    } else {
      btn.title = 'Dotted';
    }
  }

  /**
   * Update rest button to show selection state
   */
  updateRestButtonForSelection() {
    if (!this.container) return;

    const btn = this.container.querySelector('.rest-btn');
    if (!btn) return;

    const isActive = this.selectionIsRest === true;
    const isMixed = this.selectionIsRest === 'mixed';

    btn.classList.toggle('active', isActive);
    btn.classList.toggle('mixed', isMixed);

    // Update title
    if (this.selectedNotesCount > 0) {
      btn.title = isActive ? 'Convert rest(s) to note(s)' : 'Convert note(s) to rest(s)';
    } else {
      btn.title = 'Rest mode';
    }
  }

  /**
   * Update accidental buttons to show selection state
   */
  updateAccidentalButtonsForSelection() {
    if (!this.container) return;

    this.container.querySelectorAll('.accidental-btn').forEach(btn => {
      const accId = btn.dataset.accidental;
      const isActive = this.selectionAccidental && this.selectionAccidental === accId;
      const isMixed = this.selectionAccidental === 'mixed';

      btn.classList.toggle('active', isActive);
      btn.classList.toggle('mixed', isMixed);

      // Update title
      const accName = ACCIDENTALS.find(a => a.id === accId)?.label || '';
      if (this.selectedNotesCount > 0) {
        btn.title = `Set ${accName} on selected notes`;
      } else {
        btn.title = accName;
      }
    });
  }

  /**
   * Update tie button to show selection state
   */
  updateTieButtonForSelection() {
    if (!this.container) return;

    const btn = this.container.querySelector('.tie-btn');
    if (!btn) return;

    const isActive = this.selectionTied === true;
    const isMixed = this.selectionTied === 'mixed';

    btn.classList.toggle('active', isActive);
    btn.classList.toggle('mixed', isMixed);

    // Update title
    if (this.selectedNotesCount > 0) {
      btn.title = isActive ? 'Remove tie from selected note(s)' : 'Tie selected note(s) to next';
    } else {
      btn.title = 'Tie';
    }
  }

  /**
   * Update tuplet buttons to show selection state
   */
  updateTupletButtonsForSelection() {
    if (!this.container) return;
    console.log('[NotationToolbar] updateTupletButtonsForSelection - selectedNotesCount:', this.selectedNotesCount, 'tupletInsertMode:', this.tupletInsertMode);

    this.container.querySelectorAll('.tuplet-btn').forEach(btn => {
      const tupletType = btn.dataset.tuplet;

      // If notes are selected, show selection tuplet state
      if (this.selectedNotesCount > 0) {
        const isActive = this.selectionTuplet === tupletType;
        const isMixed = this.selectionTuplet === 'mixed';

        btn.classList.toggle('active', isActive);
        btn.classList.toggle('mixed', isMixed);

        // Update title based on selection state
        if (isActive) {
          btn.title = `Remove ${tupletType} from selected notes`;
        } else {
          btn.title = `Convert selected notes to ${tupletType}`;
        }
      } else {
        // No selection - show insert mode state
        const isInsertMode = this.tupletInsertMode === tupletType;
        btn.classList.toggle('active', isInsertMode);
        btn.classList.remove('mixed');

        const noteCount = tupletType === 'triplet' ? 3 : tupletType === 'quintuplet' ? 5 : 6;
        btn.title = isInsertMode
          ? `Exit ${tupletType} insert mode`
          : `Enter ${tupletType} insert mode (${noteCount} notes)`;
      }
    });
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
