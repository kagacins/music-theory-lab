/**
 * Notation Toolbar - UI controls for notation editing
 * Part of the Phase 4.4 VexFlow Professional Notation enhancement
 *
 * This module creates and manages the toolbar for note entry and editing,
 * including duration selection, rests, accidentals, and display options.
 */

import { TIME_SIGNATURES, DEFAULT_TIME_SIGNATURE } from '../../data/music-data.js';
import { dispatchBuilderEvent } from '../ui/lessonGuidedMode.js';
import { getBaseDuration, isDotted as checkIsDotted } from './durationUtils.js';

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
    this.timeSignature = '4/4';  // Current time signature as string

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
    this.onTimeSignatureChange = options.onTimeSignatureChange || (() => {});
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
    this.onTranspose = options.onTranspose || (() => {});

    // Tuplet mode state
    this.tupletInsertMode = null; // null, 'triplet', 'quintuplet', 'sextuplet'

    // Interaction mode: 'noteEntry' = Alt+click always adds note, 'select' = clicking on notes selects them
    this.interactionMode = localStorage.getItem('notation-interaction-mode') || 'select';
    this.onInteractionModeChange = options.onInteractionModeChange || (() => {});

    // Multi-voice rest display settings
    this.restDisplayMode = localStorage.getItem('notation-rest-display-mode') || 'clean'; // 'clean' or 'explicit'
    this.cueRestsForSecondaryVoice = localStorage.getItem('notation-cue-rests') !== 'false'; // default true
    this.onRestDisplayModeChange = options.onRestDisplayModeChange || (() => {});

    // Voice leading visualization
    this.isVoiceLeadingVisible = localStorage.getItem('voice-leading-overlay-visible') === 'true';
    this.onVoiceLeadingToggle = options.onVoiceLeadingToggle || (() => {});

    // Metronome state
    this.metronomeEnabled = localStorage.getItem('metronome-enabled') === 'true';
    this.onMetronomeToggle = options.onMetronomeToggle || (() => {});

    // Staff selection state (Phase 3: Bass Block Isolation)
    // Always reset to 'auto' on page load for better UX - don't persist across sessions
    this.staffSelectionMode = 'auto'; // 'treble', 'bass', or 'auto'
    this.onStaffSelectionChange = options.onStaffSelectionChange || (() => {});
  }

  /**
   * Create the toolbar element
   * @param {HTMLElement} container - Container element
   */
  create(container) {
    this.container = container;
    this.render();
    this.attachEventListeners();
    this.handleMobileTooltips();
  }

  /**
   * Handle tooltips - create hover tooltips for all buttons
   * Uses actual DOM elements for reliable display
   */
  handleMobileTooltips() {
    if (!this.container) return;

    // Create a single tooltip element that will be reused
    let tooltip = document.getElementById('notation-toolbar-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'notation-toolbar-tooltip';
      tooltip.style.cssText = `
        position: fixed;
        background: #1f2937;
        color: white;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        z-index: 999999;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        opacity: 0;
        transition: opacity 0.15s ease;
        display: none;
      `;
      document.body.appendChild(tooltip);
    }

    // Find all elements with title attributes
    const elementsWithTitles = this.container.querySelectorAll('[title]');
    elementsWithTitles.forEach(el => {
      const title = el.getAttribute('title');
      if (title) {
        // Store in data attribute
        el.setAttribute('data-tooltip', title);
        // Remove native title to prevent double tooltips
        el.removeAttribute('title');

        // Add hover listeners
        el.addEventListener('mouseenter', (e) => {
          const text = el.getAttribute('data-tooltip');
          if (!text) return;

          tooltip.textContent = text;
          tooltip.style.display = 'block';

          // Position tooltip above the element
          const rect = el.getBoundingClientRect();
          tooltip.style.left = `${rect.left + rect.width / 2}px`;
          tooltip.style.top = `${rect.top - 8}px`;
          tooltip.style.transform = 'translate(-50%, -100%)';

          // Fade in
          requestAnimationFrame(() => {
            tooltip.style.opacity = '1';
          });
        });

        el.addEventListener('mouseleave', () => {
          tooltip.style.opacity = '0';
          setTimeout(() => {
            if (tooltip.style.opacity === '0') {
              tooltip.style.display = 'none';
            }
          }, 150);
        });
      }
    });
  }

  /**
   * Render the toolbar HTML
   */
  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="notation-toolbar">
        <!-- Selection Indicator and Tools (shown when notes selected) -->
        <div class="toolbar-section selection-indicator" style="display: ${this.selectedNotesCount > 0 ? 'flex' : 'none'};">
          <span class="selection-badge">✓ ${this.selectedNotesCount} note${this.selectedNotesCount !== 1 ? 's' : ''} selected</span>
          <!-- Transpose Tools -->
          <div class="transpose-tools">
            <button class="toolbar-btn transpose-btn" data-transpose="-12" title="Transpose down octave">⬇8va</button>
            <button class="toolbar-btn transpose-btn" data-transpose="-1" title="Transpose down semitone">−</button>
            <button class="toolbar-btn transpose-btn" data-transpose="1" title="Transpose up semitone">+</button>
            <button class="toolbar-btn transpose-btn" data-transpose="12" title="Transpose up octave">⬆8va</button>
          </div>
        </div>

        <!-- NOTE INPUT GROUP -->
        <div class="toolbar-group">
          <span class="group-label">Input</span>
          <div class="toolbar-group-content">
            <!-- Mode Toggle -->
            <div class="toolbar-section interaction-mode-section">
              <div class="button-group">
                <button
                  class="toolbar-btn interaction-mode-btn ${this.interactionMode === 'noteEntry' ? 'active' : ''}"
                  data-interaction-mode="noteEntry"
                  title="Note Entry Mode - Click to add notes"
                >✏</button>
                <button
                  class="toolbar-btn interaction-mode-btn ${this.interactionMode === 'select' ? 'active' : ''}"
                  data-interaction-mode="select"
                  title="Select Mode - Click to select notes, Alt+Click to add"
                >⎀</button>
              </div>
            </div>

            <!-- Duration -->
            <div class="toolbar-section duration-section">
              <div class="button-group duration-buttons">
                ${DURATIONS.map((d, i) => `
                  <button
                    class="toolbar-btn duration-btn ${d.id === this.currentDuration ? 'active' : ''}"
                    data-duration="${d.id}"
                    title="${d.label} (Shift+${i + 1})"
                  >${d.symbol}</button>
                `).join('')}
              </div>
            </div>

            <!-- Modifiers -->
            <div class="toolbar-section modifiers-section">
              <button class="toolbar-btn rest-btn ${this.isRestMode ? 'active' : ''}" data-action="rest" title="Rest mode (R)">𝄽</button>
              <button class="toolbar-btn dot-btn ${this.isDotted ? 'active' : ''}" data-action="dot" title="Dotted note (.)">•</button>
              <button class="toolbar-btn tie-btn" data-action="tie" title="Tie notes (T)">⁀</button>
            </div>

            <!-- Tuplets -->
            <div class="toolbar-section tuplet-section">
              <div class="button-group">
                <button class="toolbar-btn tuplet-btn ${this.tupletInsertMode === 'triplet' ? 'active' : ''}" data-tuplet="triplet" title="Triplet (3:2)">3</button>
                <button class="toolbar-btn tuplet-btn ${this.tupletInsertMode === 'quintuplet' ? 'active' : ''}" data-tuplet="quintuplet" title="Quintuplet (5:4)">5</button>
                <button class="toolbar-btn tuplet-btn ${this.tupletInsertMode === 'sextuplet' ? 'active' : ''}" data-tuplet="sextuplet" title="Sextuplet (6:4)">6</button>
              </div>
            </div>
          </div>
        </div>

        <!-- PITCH/STYLE GROUP -->
        <div class="toolbar-group">
          <span class="group-label">Pitch</span>
          <div class="toolbar-group-content">
            <!-- Accidentals -->
            <div class="toolbar-section accidentals-section">
              <div class="button-group">
                ${ACCIDENTALS.map(a => {
                  const shortcut = a.id === '#' ? 'S' : a.id === 'b' ? 'F' : 'N';
                  return `
                  <button
                    class="toolbar-btn accidental-btn ${a.id === this.currentAccidental ? 'active' : ''}"
                    data-accidental="${a.id}"
                    title="${a.label} (${shortcut})"
                  >${a.symbol}</button>
                `;}).join('')}
              </div>
            </div>

            <!-- Articulations -->
            <div class="toolbar-section articulations-section">
              <div class="button-group">
                ${ARTICULATIONS.map(a => `
                  <button
                    class="toolbar-btn articulation-btn ${a.id === this.currentArticulation ? 'active' : ''}"
                    data-articulation="${a.id}"
                    title="${a.label} articulation"
                  >${a.symbol}</button>
                `).join('')}
              </div>
            </div>
          </div>
        </div>

        <!-- EDIT GROUP -->
        <div class="toolbar-group">
          <span class="group-label">Edit</span>
          <div class="toolbar-group-content">
            <div class="toolbar-section edit-section">
              <button class="toolbar-btn undo-btn" data-action="undo" title="Undo last action (Ctrl+Z)">↩</button>
              <button class="toolbar-btn redo-btn" data-action="redo" title="Redo last action (Ctrl+Y)">↪</button>
              <button class="toolbar-btn copy-btn" data-action="copy" title="Copy selected notes (Ctrl+C)">📋</button>
              <button class="toolbar-btn paste-btn" data-action="paste" title="Paste notes (Ctrl+V)">📥</button>
              <button class="toolbar-btn copy-block-btn" data-action="copyBlock" title="Copy entire block/measure">📦</button>
              <button class="toolbar-btn delete-btn" data-action="delete" title="Delete selected (Del = replace with rest, Ctrl+Del = shift notes left)">🗑</button>
            </div>
          </div>
        </div>

        <!-- CHORD GROUP -->
        <div class="toolbar-group">
          <span class="group-label">Chord</span>
          <div class="toolbar-group-content">
            <div class="toolbar-section chord-symbol-section">
              <input type="text" class="chord-symbol-input" placeholder="Cmaj7" title="Type chord symbol (e.g., Cmaj7, Dm, G7)">
              <button class="toolbar-btn apply-chord-btn" data-action="applyChord" title="Apply chord symbol to measure (Enter)">✓</button>
            </div>
          </div>
        </div>

        <!-- VIEW GROUP -->
        <div class="toolbar-group">
          <span class="group-label">View</span>
          <div class="toolbar-group-content">
            <div class="toolbar-section view-section">
              <select class="time-signature-select" title="Change time signature">
                ${TIME_SIGNATURES.map(ts => `
                  <option value="${ts.value}" ${this.timeSignature === ts.value ? 'selected' : ''}>${ts.value}</option>
                `).join('')}
              </select>
              <select class="staff-select" data-mode="${this.staffSelectionMode}" title="Select which staff to edit&#10;• Auto (A): Click position determines staff&#10;• Treble (G): Force edits to treble clef&#10;• Bass (B): Force edits to bass clef (use to edit bass blocks)">
                <option value="auto" ${this.staffSelectionMode === 'auto' ? 'selected' : ''}>🎯 Auto</option>
                <option value="treble" ${this.staffSelectionMode === 'treble' ? 'selected' : ''}>🎼 Treble</option>
                <option value="bass" ${this.staffSelectionMode === 'bass' ? 'selected' : ''}>🎸 Bass</option>
              </select>
              <span class="editing-context-indicator" title="Current editing context"><span class="context-icon">📍</span><span class="context-text">Ready</span></span>
              <select class="voice-select" title="Select voice to edit (V to cycle, Alt+1/2 to switch)">
                <option value="1" ${this.voiceNumber === 1 ? 'selected' : ''}>Voice 1</option>
                <option value="2" ${this.voiceNumber === 2 ? 'selected' : ''}>Voice 2</option>
              </select>
              <select class="measures-select" title="Number of measures per line">
                ${MEASURES_PER_LINE_OPTIONS.map(m => `
                  <option value="${m}" ${m === this.measuresPerLine ? 'selected' : ''}>${m} measures</option>
                `).join('')}
              </select>
              <button class="toolbar-btn metronome-btn ${this.metronomeEnabled ? 'active' : ''}" data-action="metronome" title="Toggle metronome click during playback">🔔</button>
            </div>
          </div>
        </div>

        <!-- 2ND VOICE OPTIONS GROUP -->
        <div class="toolbar-group voice-options-group">
          <span class="group-label">2nd Voice Rests</span>
          <div class="toolbar-group-content">
            <div class="toolbar-section rest-display-section">
              <div class="button-group">
                <button class="toolbar-btn rest-display-btn ${this.restDisplayMode === 'clean' ? 'active' : ''}" data-rest-mode="clean" title="Clean: Hide redundant rests in 2nd voice">Clean</button>
                <button class="toolbar-btn rest-display-btn ${this.restDisplayMode === 'explicit' ? 'active' : ''}" data-rest-mode="explicit" title="Show all rests in both voices">All</button>
              </div>
              <label class="cue-rest-toggle ${this.restDisplayMode === 'explicit' ? 'disabled' : ''}" title="Show small gray cue rests where voices overlap (only applies in Clean mode)">
                <input type="checkbox" class="cue-rest-checkbox" ${this.cueRestsForSecondaryVoice ? 'checked' : ''} ${this.restDisplayMode === 'explicit' ? 'disabled' : ''}>
                <span class="cue-rest-label">Cue Rests</span>
              </label>
            </div>
          </div>
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
    // Remove existing styles to ensure updates are applied
    const existing = document.getElementById('notation-toolbar-styles');
    if (existing) existing.remove();

    const styles = document.createElement('style');
    styles.id = 'notation-toolbar-styles';
    styles.textContent = `
      .notation-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 6px 8px;
        background: var(--bg-secondary, #2a2a2a);
        border-radius: 6px;
        margin-bottom: 8px;
        align-items: stretch;
      }

      /* Toolbar groups with labels */
      .toolbar-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 4px 6px;
        background: rgba(255,255,255,0.03);
        border-radius: 4px;
        border: 1px solid rgba(255,255,255,0.05);
      }

      .group-label {
        font-size: 9px;
        font-weight: 600;
        color: var(--text-muted, #888);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        text-align: center;
        margin-bottom: 2px;
      }

      .toolbar-group-content {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .toolbar-section {
        display: flex;
        align-items: center;
        gap: 2px;
      }

      /* Subtle divider between sections within a group */
      .toolbar-group-content > .toolbar-section:not(:first-child)::before {
        content: '';
        width: 1px;
        height: 16px;
        background: rgba(255,255,255,0.1);
        margin-right: 2px;
      }

      .button-group {
        display: flex;
        gap: 1px;
      }

      .toolbar-btn {
        width: 32px;
        height: 32px;
        border: none;
        border-radius: 4px;
        background: var(--bg-tertiary, #333);
        color: var(--text-primary, #fff);
        font-size: 15px;
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
        font-size: 18px;
      }

      .accidental-btn {
        font-size: 15px;
      }

      .articulation-btn {
        font-size: 14px;
        font-weight: bold;
      }

      .tuplet-btn {
        font-size: 13px;
        font-weight: 600;
      }

      .toolbar-section select {
        padding: 4px 8px;
        border-radius: 4px;
        border: none;
        background: var(--bg-tertiary, #333);
        color: var(--text-primary, #fff);
        font-size: 12px;
        cursor: pointer;
        height: 32px;
      }

      .toolbar-section select:focus {
        outline: 2px solid var(--accent-color, #4a9eff);
      }

      .zoom-select {
        min-width: 52px;
      }

      .measures-select {
        min-width: 55px;
      }

      .staff-select {
        min-width: 90px;
        font-size: 11px;
        font-weight: bold;
        border-radius: 4px;
        padding: 3px 6px;
        transition: all 0.2s ease;
      }

      .staff-select[data-mode="treble"] {
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
        color: white;
        border: 2px solid #60a5fa;
      }

      .staff-select[data-mode="bass"] {
        background: linear-gradient(135deg, #8b5cf6, #6d28d9);
        color: white;
        border: 2px solid #a78bfa;
      }

      .staff-select[data-mode="auto"] {
        background: linear-gradient(135deg, #6b7280, #4b5563);
        color: white;
        border: 2px solid #9ca3af;
      }

      .staff-select option {
        background: #1f2937;
        color: white;
      }

      .editing-context-indicator {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px;
        background: linear-gradient(135deg, #374151, #1f2937);
        color: #d1d5db;
        border-radius: 12px;
        font-size: 10px;
        font-weight: 500;
        white-space: nowrap;
        border: 1px solid #4b5563;
        transition: all 0.2s ease;
      }

      .editing-context-indicator .context-icon {
        font-size: 11px;
      }

      .editing-context-indicator .context-text {
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Treble mode styling */
      .editing-context-indicator[data-mode="treble"] {
        background: linear-gradient(135deg, #1e40af, #1e3a8a);
        color: white;
        border-color: #3b82f6;
      }

      /* Bass mode styling */
      .editing-context-indicator[data-mode="bass"] {
        background: linear-gradient(135deg, #6d28d9, #5b21b6);
        color: white;
        border-color: #8b5cf6;
        animation: pulse-glow 2s ease-in-out infinite;
      }

      /* Selected note styling */
      .editing-context-indicator[data-has-selection="true"] {
        border-color: #fbbf24;
        box-shadow: 0 0 6px rgba(251, 191, 36, 0.4);
      }

      .editing-context-indicator .highlight {
        color: #fef08a;
        font-weight: bold;
      }

      @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 0 4px rgba(139, 92, 246, 0.4); }
        50% { box-shadow: 0 0 8px rgba(139, 92, 246, 0.8); }
      }

      .voice-select {
        min-width: 36px;
      }

      .selection-indicator {
        background: var(--accent-color, #4a9eff);
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: bold;
      }

      .selection-badge {
        color: white;
        font-size: 11px;
        white-space: nowrap;
      }

      .transpose-tools {
        display: flex;
        gap: 2px;
        margin-left: 8px;
        padding-left: 8px;
        border-left: 1px solid rgba(255, 255, 255, 0.3);
      }

      .transpose-btn {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: none;
        padding: 2px 6px;
        font-size: 10px;
        font-weight: 600;
        border-radius: 3px;
        cursor: pointer;
        transition: background 0.15s;
      }

      .transpose-btn:hover {
        background: rgba(255, 255, 255, 0.35);
      }

      .transpose-btn:active {
        background: rgba(255, 255, 255, 0.5);
      }

      .chord-symbol-input {
        padding: 4px 8px;
        border-radius: 4px;
        border: 1px solid var(--bg-tertiary, #333);
        background: var(--bg-input, #222);
        color: var(--text-primary, #fff);
        font-size: 12px;
        font-family: 'Courier New', monospace;
        width: 70px;
        text-align: center;
        height: 32px;
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
        width: 28px;
        padding: 0;
        font-size: 12px;
        font-weight: 600;
      }

      /* 2nd Voice options group - subtle highlight */
      .voice-options-group {
        background: rgba(74, 158, 255, 0.05);
        border-color: rgba(74, 158, 255, 0.15);
      }

      .voice-options-group .group-label {
        color: var(--accent-color, #4a9eff);
      }

      /* Rest display mode section */
      .rest-display-section {
        border-left: none;
        padding-left: 0;
      }

      .rest-display-section::before {
        display: none;
      }

      .rest-display-btn {
        width: auto;
        padding: 0 8px;
        font-size: 11px;
        font-weight: 500;
        height: 32px;
      }

      .cue-rest-toggle {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        background: var(--bg-tertiary, #333);
        font-size: 11px;
        color: var(--text-primary, #fff);
        transition: background 0.15s ease;
        height: 32px;
      }

      .cue-rest-toggle:hover:not(.disabled) {
        background: var(--bg-hover, #444);
      }

      .cue-rest-toggle.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .cue-rest-checkbox {
        width: 12px;
        height: 14px;
        cursor: pointer;
      }

      .cue-rest-checkbox:disabled {
        cursor: not-allowed;
      }

      .cue-rest-label {
        font-size: 11px;
        color: var(--text-muted, #888);
      }

      /* Ensure tooltips aren't clipped */
      .notation-toolbar,
      .toolbar-group,
      .toolbar-group-content,
      .toolbar-section,
      .button-group {
        overflow: visible !important;
      }

      /* Custom tooltips using data-tooltip attribute */
      [data-tooltip] {
        position: relative;
      }

      [data-tooltip]:hover::after {
        content: attr(data-tooltip);
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        background: #1f2937;
        color: white;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        z-index: 99999;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        opacity: 1;
      }

      /* Arrow for tooltip */
      [data-tooltip]:hover::before {
        content: '';
        position: absolute;
        bottom: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: #1f2937;
        z-index: 99999;
        pointer-events: none;
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

        /* Hide tooltips on small screens to avoid clutter */
        .toolbar-btn[data-tooltip]:hover::after,
        .toolbar-btn[data-tooltip]:hover::before {
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

    // Interaction mode buttons
    this.container.querySelectorAll('.interaction-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.interactionMode;
        if (mode) {
          this.setInteractionMode(mode);
        }
      });
    });

    // Duration buttons - use currentTarget to ensure we get the button element, not child text nodes
    this.container.querySelectorAll('.duration-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const duration = e.currentTarget.dataset.duration;
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
        if (accidental) {
          this.setAccidental(accidental);
        }
      });
    });

    // Articulation buttons - use currentTarget to ensure we get the button element
    this.container.querySelectorAll('.articulation-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const articulation = e.currentTarget.dataset.articulation;
        if (articulation) {
          this.setArticulation(articulation);
        }
      });
    });

    // Transpose buttons - transpose selected notes by semitones
    this.container.querySelectorAll('.transpose-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const semitones = parseInt(e.currentTarget.dataset.transpose, 10);
        if (!isNaN(semitones) && this.selectedNotesCount > 0) {
          this.onTranspose(semitones);
        }
      });
    });

    // Tuplet buttons
    this.container.querySelectorAll('.tuplet-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tupletType = e.currentTarget.dataset.tuplet;

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

    // Staff select (Phase 3: Bass Block Isolation)
    this.container.querySelector('.staff-select')?.addEventListener('change', (e) => {
      this.setStaffSelectionMode(e.target.value);
    });

    // Voice select
    this.container.querySelector('.voice-select')?.addEventListener('change', (e) => {
      this.voiceNumber = parseInt(e.target.value, 10);
      this.onVoiceChange(this.voiceNumber);
    });

    // Time signature select
    this.container.querySelector('.time-signature-select')?.addEventListener('change', (e) => {
      const value = e.target.value;
      const [num, denom] = value.split('/').map(Number);
      this.timeSignature = value;
      this.onTimeSignatureChange(num, denom);
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

    // Rest display mode buttons
    this.container.querySelectorAll('.rest-display-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.restMode;
        if (mode) {
          this.setRestDisplayMode(mode);
        }
      });
    });

    // Cue rest checkbox
    this.container.querySelector('.cue-rest-checkbox')?.addEventListener('change', (e) => {
      this.setCueRestsEnabled(e.target.checked);
    });

    // Voice leading toggle button
    this.container.querySelector('.voice-leading-btn')?.addEventListener('click', () => {
      this.toggleVoiceLeading();
    });

    // Metronome toggle button
    this.container.querySelector('.metronome-btn')?.addEventListener('click', () => {
      this.toggleMetronome();
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
    // Note: We use e.code (e.g., 'Digit1') instead of e.key because e.key returns shifted characters ('!', '@', etc.)
    if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const digitMatch = e.code?.match(/^Digit([1-6])$/);
      if (digitMatch) {
        const index = parseInt(digitMatch[1], 10) - 1;
        if (index < DURATIONS.length) {
          e.preventDefault();
          this.setDuration(DURATIONS[index].id);
        }
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

    // Delete - Ctrl+Delete/Backspace = shift delete (removes note and shifts others left)
    //          Delete/Backspace alone = replace with rest (preserves rhythm)
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      const shiftDelete = e.ctrlKey || e.metaKey;
      this.onDelete(shiftDelete);
    }

    // Tie (T)
    if (!hasModifier && (e.key === 't' || e.key === 'T')) {
      e.preventDefault();
      this.onTie();
    }

    // Voice switching
    // V - Cycle through voices
    if (!hasModifier && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      this.cycleVoice();
    }

    // Alt+1 and Alt+2 for direct voice selection
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      if (e.key === '1') {
        e.preventDefault();
        this.setVoice(1);
      } else if (e.key === '2') {
        e.preventDefault();
        this.setVoice(2);
      }
    }

    // Staff selection shortcuts (G/B/A) - use G for treble since T is for Tie
    // G = Treble (G clef), B = Bass, A = Auto
    if (!hasModifier) {
      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        this.setStaffSelectionMode('treble');
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        this.setStaffSelectionMode('bass');
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        this.setStaffSelectionMode('auto');
      }
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

    // Dispatch event for tutorial validation
    dispatchBuilderEvent('notationDurationSelected', { duration });
  }

  /**
   * Get current duration
   * @returns {string} - Current duration
   */
  getDuration() {
    return this.isDotted ? this.currentDuration + '.' : this.currentDuration;
  }

  /**
   * Set interaction mode
   * @param {string} mode - 'noteEntry' or 'select'
   */
  setInteractionMode(mode) {
    if (mode !== 'noteEntry' && mode !== 'select') return;
    this.interactionMode = mode;
    localStorage.setItem('notation-interaction-mode', mode);
    this.updateInteractionModeButtons();
    this.onInteractionModeChange(mode);

    // Dispatch event for tutorial validation
    dispatchBuilderEvent('notationInteractionModeSet', { mode });
  }

  /**
   * Get current interaction mode
   * @returns {string} - 'noteEntry' or 'select'
   */
  getInteractionMode() {
    return this.interactionMode;
  }

  /**
   * Set staff selection mode (Phase 3: Bass Block Isolation)
   * @param {string} mode - 'treble', 'bass', or 'auto'
   */
  setStaffSelectionMode(mode) {
    if (mode !== 'treble' && mode !== 'bass' && mode !== 'auto') return;
    this.staffSelectionMode = mode;
    // Don't persist to localStorage - always reset to 'auto' on page load
    this.updateStaffSelectDropdown();
    this.onStaffSelectionChange(mode);

    // Also update compositionState if available
    const compositionState = window.getCompositionState?.();
    if (compositionState) {
      compositionState.setStaffSelectionMode(mode);
      // If explicitly selecting a staff, update the active staff
      if (mode !== 'auto') {
        compositionState.setActiveStaff(mode);
      }
    }

    // Update the editing context indicator with full context
    this.refreshEditingContext();

    // Dispatch event for tutorial validation
    dispatchBuilderEvent('notationStaffSelectionSet', { mode });
  }

  /**
   * Get current staff selection mode
   * @returns {string} - 'treble', 'bass', or 'auto'
   */
  getStaffSelectionMode() {
    return this.staffSelectionMode;
  }

  /**
   * Update staff selection dropdown to match current state
   */
  updateStaffSelectDropdown() {
    if (!this.container) return;
    const select = this.container.querySelector('.staff-select');
    if (select) {
      select.value = this.staffSelectionMode;
      select.setAttribute('data-mode', this.staffSelectionMode);
    }
  }

  /**
   * Update the editing context indicator in the toolbar
   * Shows context-aware information based on current staff mode and selection
   * @param {Object} context - Context information
   * @param {string} context.mode - 'treble', 'bass', or 'auto'
   * @param {number|null} context.bassBlockIndex - Index of active bass block (bass mode)
   * @param {string|null} context.chordName - Name of the chord for bass block
   * @param {number|null} context.measureIndex - Current measure (0-indexed)
   * @param {number|null} context.beat - Current beat position
   * @param {boolean} context.hasSelection - Whether notes are selected
   * @param {string|null} context.selectedStaff - Staff of selected note ('treble' or 'bass')
   */
  updateEditingContext(context = {}) {
    if (!this.container) return;
    const indicator = this.container.querySelector('.editing-context-indicator');
    const iconSpan = this.container.querySelector('.context-icon');
    const textSpan = this.container.querySelector('.context-text');
    if (!indicator || !iconSpan || !textSpan) return;

    const {
      mode = this.staffSelectionMode,
      bassBlockIndex = null,
      chordName = null,
      measureIndex = null,
      beat = null,
      hasSelection = false,
      selectedStaff = null,
      selectedPitches = [],
      isRest = false
    } = context;

    // Set data attributes for CSS styling
    indicator.setAttribute('data-mode', mode);
    indicator.setAttribute('data-has-selection', hasSelection ? 'true' : 'false');

    let icon = '📍';
    let text = 'Ready';
    let title = 'Current editing context';

    // Format pitches for display (e.g., "C4" or "C4, E4, G4" for chords)
    const formatPitches = (pitches) => {
      if (!pitches || pitches.length === 0) return null;
      if (pitches.length === 1) return pitches[0];
      return pitches.join(', ');
    };

    if (hasSelection && selectedStaff) {
      // Note is selected - show info about the selected note
      icon = selectedStaff === 'bass' ? '🎸' : '🎼';
      const pitchDisplay = isRest ? 'Rest' : formatPitches(selectedPitches);

      if (selectedStaff === 'bass' && bassBlockIndex !== null && bassBlockIndex >= 0) {
        // Bass note selected - show pitch, chord, and measure
        if (pitchDisplay) {
          text = `<span class="highlight">${pitchDisplay}</span>`;
          title = `Selected: ${pitchDisplay}`;
        } else {
          text = `Selected: <span class="highlight">${chordName || `Block ${bassBlockIndex + 1}`}</span>`;
          title = `Editing bass block for ${chordName || `chord ${bassBlockIndex + 1}`}`;
        }
        if (chordName && pitchDisplay) {
          text += ` in ${chordName}`;
          title += ` in ${chordName}`;
        }
        if (measureIndex !== null) {
          text += ` (m${measureIndex + 1})`;
          title += `, measure ${measureIndex + 1}`;
        }
      } else {
        // Treble note selected - show pitch, chord context, and measure
        if (pitchDisplay) {
          text = `<span class="highlight">${pitchDisplay}</span>`;
          title = `Selected: ${pitchDisplay}`;
        } else {
          text = `Selected: m${measureIndex !== null ? measureIndex + 1 : '?'}`;
          title = `Editing treble note in measure ${measureIndex !== null ? measureIndex + 1 : '?'}`;
        }
        if (chordName) {
          text += ` over ${chordName}`;
          title += ` over ${chordName}`;
        }
        if (measureIndex !== null) {
          text += ` (m${measureIndex + 1})`;
          title += `, measure ${measureIndex + 1}`;
        }
      }
    } else if (mode === 'bass') {
      // Bass mode - show active block info
      icon = '🎸';
      if (bassBlockIndex !== null && bassBlockIndex >= 0) {
        text = `Bass: <span class="highlight">${chordName || `Block ${bassBlockIndex + 1}`}</span>`;
        title = `Editing bass block for ${chordName || `chord ${bassBlockIndex + 1}`}\nClick chord bracket to select different block`;
      } else {
        text = 'Bass: <span class="highlight">Click bracket</span>';
        title = 'Click a chord bracket below the bass staff to select a block to edit';
      }
    } else if (mode === 'treble') {
      // Treble mode - show measure info
      icon = '🎼';
      if (measureIndex !== null) {
        text = `Treble: m${measureIndex + 1}`;
        title = `Next note will be added to measure ${measureIndex + 1}`;
        if (chordName) {
          text += ` <span class="highlight">${chordName}</span>`;
          title += ` (over ${chordName})`;
        }
      } else {
        text = 'Treble: Ready';
        title = 'Click on the treble staff to add notes';
      }
    } else {
      // Auto mode
      icon = '🎯';
      text = 'Auto';
      title = 'Click position determines treble or bass staff';
    }

    iconSpan.textContent = icon;
    textSpan.innerHTML = text;
    indicator.title = title;
  }

  /**
   * Legacy method - redirects to updateEditingContext for backward compatibility
   * @deprecated Use updateEditingContext instead
   */
  updateActiveBlockIndicator(blockIndex, chordName = null) {
    this.updateEditingContext({
      mode: 'bass',
      bassBlockIndex: blockIndex,
      chordName: chordName
    });
  }

  /**
   * Refresh the editing context indicator by gathering current state
   * Call this when state changes and you need to update the indicator
   */
  refreshEditingContext() {
    const compositionState = window.getCompositionState?.();
    if (!compositionState) {
      this.updateEditingContext({ mode: this.staffSelectionMode });
      return;
    }

    const bassBlockIndex = compositionState.getActiveBassBlockIndex?.();
    const chords = compositionState.getChords?.() || [];

    // Get chord name for bass block
    let chordName = null;
    if (bassBlockIndex !== null && bassBlockIndex >= 0 && chords[bassBlockIndex]) {
      const chord = chords[bassBlockIndex];
      const symbol = window.CHORD_DEFINITIONS?.[chord.type]?.symbol || '';
      chordName = `${chord.root}${symbol}`;
    }

    // Get selection info from noteEditor if available
    let hasSelection = false;
    let selectedStaff = null;
    let measureIndex = null;
    let selectedChordName = null;
    let selectedPitches = [];
    let isRest = false;

    const composer = window.getNotationComposer?.();
    const noteEditor = composer?.noteEditor;
    if (noteEditor) {
      const selectedNotes = noteEditor.getSelectedNotes?.() || [];
      hasSelection = selectedNotes.length > 0;

      if (hasSelection && selectedNotes[0]) {
        const firstNote = selectedNotes[0];
        selectedStaff = firstNote.staff || null;
        measureIndex = firstNote.measureIndex ?? null;
        selectedPitches = firstNote.pitches || [];
        isRest = firstNote.isRest || false;

        // Get chord name for the selected note's position
        if (measureIndex !== null) {
          const chordSegments = compositionState.getChordSegments?.() || [];
          const beatsPerMeasure = compositionState.getBeatsPerMeasure?.() || 4;
          const absoluteBeat = measureIndex * beatsPerMeasure + (firstNote.beat || 0);

          for (const segment of chordSegments) {
            if (absoluteBeat >= segment.startBeat && absoluteBeat < segment.startBeat + segment.durationBeats) {
              const segChord = chords[segment.chordIndex];
              if (segChord) {
                const segSymbol = window.CHORD_DEFINITIONS?.[segChord.type]?.symbol || '';
                selectedChordName = `${segChord.root}${segSymbol}`;
              }
              // Also update bassBlockIndex if a bass note is selected
              if (selectedStaff === 'bass') {
                chordName = selectedChordName;
              }
              break;
            }
          }
        }
      }
    }

    this.updateEditingContext({
      mode: this.staffSelectionMode,
      bassBlockIndex: bassBlockIndex,
      chordName: hasSelection ? selectedChordName : chordName,
      measureIndex: measureIndex,
      hasSelection: hasSelection,
      selectedStaff: selectedStaff,
      selectedPitches: selectedPitches,
      isRest: isRest
    });
  }

  /**
   * Update interaction mode button states
   */
  updateInteractionModeButtons() {
    if (!this.container) return;
    this.container.querySelectorAll('.interaction-mode-btn').forEach(btn => {
      const isActive = btn.dataset.interactionMode === this.interactionMode;
      btn.classList.toggle('active', isActive);
    });
  }

  /**
   * Set rest display mode for multi-voice notation
   * @param {string} mode - 'clean' (smart omission) or 'explicit' (show all)
   */
  setRestDisplayMode(mode) {
    if (mode !== 'clean' && mode !== 'explicit') return;
    this.restDisplayMode = mode;
    localStorage.setItem('notation-rest-display-mode', mode);
    this.updateRestDisplayButtons();
    this.onRestDisplayModeChange({
      restDisplayMode: this.restDisplayMode,
      cueRestsForSecondaryVoice: this.cueRestsForSecondaryVoice,
      hideCueRests: !this.cueRestsForSecondaryVoice,
    });
  }

  /**
   * Set cue rests enabled for secondary voice
   * When enabled (checkbox checked): Show small gray cue rests
   * When disabled (checkbox unchecked): Hide cue rests using GhostNotes
   * @param {boolean} enabled - Whether to show cue-sized rests (true) or hide them (false)
   */
  setCueRestsEnabled(enabled) {
    this.cueRestsForSecondaryVoice = enabled;
    localStorage.setItem('notation-cue-rests', enabled ? 'true' : 'false');
    this.onRestDisplayModeChange({
      restDisplayMode: this.restDisplayMode,
      cueRestsForSecondaryVoice: this.cueRestsForSecondaryVoice,
      hideCueRests: !this.cueRestsForSecondaryVoice,
    });
  }

  /**
   * Set time signature
   * @param {number} num - Numerator (e.g., 4)
   * @param {number} denom - Denominator (e.g., 4)
   */
  setTimeSignature(num, denom) {
    this.timeSignature = `${num}/${denom}`;
    this.updateTimeSignatureSelect();
    // Note: We don't call onTimeSignatureChange here because this is typically
    // called to sync the UI with external state, not to trigger a change
  }

  /**
   * Update time signature select to match current state
   */
  updateTimeSignatureSelect() {
    if (!this.container) return;
    const select = this.container.querySelector('.time-signature-select');
    if (select) {
      select.value = this.timeSignature;
    }
  }

  /**
   * Get current rest display settings
   * @returns {Object} - { restDisplayMode, cueRestsForSecondaryVoice, hideCueRests }
   */
  getRestDisplaySettings() {
    return {
      restDisplayMode: this.restDisplayMode,
      cueRestsForSecondaryVoice: this.cueRestsForSecondaryVoice,
      // hideCueRests is the inverse: when cue checkbox is checked (show cue), hide is false
      hideCueRests: !this.cueRestsForSecondaryVoice,
    };
  }

  /**
   * Update rest display mode button states and cue checkbox disabled state
   */
  updateRestDisplayButtons() {
    if (!this.container) return;
    this.container.querySelectorAll('.rest-display-btn').forEach(btn => {
      const isActive = btn.dataset.restMode === this.restDisplayMode;
      btn.classList.toggle('active', isActive);
    });

    // Disable cue checkbox when in "All" (explicit) mode
    const cueToggle = this.container.querySelector('.cue-rest-toggle');
    const cueCheckbox = this.container.querySelector('.cue-rest-checkbox');
    if (cueToggle && cueCheckbox) {
      const isExplicit = this.restDisplayMode === 'explicit';
      cueToggle.classList.toggle('disabled', isExplicit);
      cueCheckbox.disabled = isExplicit;
    }
  }

  /**
   * Toggle rest mode
   */
  toggleRestMode() {
    this.isRestMode = !this.isRestMode;
    this.updateRestButton();
    this.onRestModeChange(this.isRestMode);

    // Dispatch event for tutorial validation
    dispatchBuilderEvent('notationRestModeToggled', { isRestMode: this.isRestMode });
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
   * Toggle voice leading visualization
   */
  toggleVoiceLeading() {
    this.isVoiceLeadingVisible = !this.isVoiceLeadingVisible;
    localStorage.setItem('voice-leading-overlay-visible', this.isVoiceLeadingVisible.toString());
    this.updateVoiceLeadingButton();
    this.onVoiceLeadingToggle(this.isVoiceLeadingVisible);
  }

  /**
   * Update voice leading button state
   */
  updateVoiceLeadingButton() {
    const btn = this.container?.querySelector('.voice-leading-btn');
    if (btn) {
      btn.classList.toggle('active', this.isVoiceLeadingVisible);
    }
  }

  /**
   * Set voice leading visibility explicitly
   * @param {boolean} visible - Whether to show voice leading
   */
  setVoiceLeadingVisible(visible) {
    if (this.isVoiceLeadingVisible !== visible) {
      this.isVoiceLeadingVisible = visible;
      localStorage.setItem('voice-leading-overlay-visible', this.isVoiceLeadingVisible.toString());
      this.updateVoiceLeadingButton();
      this.onVoiceLeadingToggle(this.isVoiceLeadingVisible);
    }
  }

  /**
   * Toggle metronome on/off
   */
  toggleMetronome() {
    this.metronomeEnabled = !this.metronomeEnabled;
    localStorage.setItem('metronome-enabled', this.metronomeEnabled.toString());
    this.updateMetronomeButton();
    this.onMetronomeToggle(this.metronomeEnabled);

    // Also update the global metronome state via audioEngine
    if (window.setMetronomeEnabled) {
      window.setMetronomeEnabled(this.metronomeEnabled);
    }
  }

  /**
   * Update metronome button state
   */
  updateMetronomeButton() {
    const btn = this.container?.querySelector('.metronome-btn');
    if (btn) {
      btn.classList.toggle('active', this.metronomeEnabled);
    }
  }

  /**
   * Set metronome enabled state explicitly
   * @param {boolean} enabled - Whether metronome should be enabled
   */
  setMetronomeEnabled(enabled) {
    if (this.metronomeEnabled !== enabled) {
      this.metronomeEnabled = enabled;
      localStorage.setItem('metronome-enabled', this.metronomeEnabled.toString());
      this.updateMetronomeButton();
      this.onMetronomeToggle(this.metronomeEnabled);
    }
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
    this.container.querySelectorAll('.tuplet-btn').forEach(btn => {
      const isActive = btn.dataset.tuplet === this.tupletInsertMode;
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
   * Set the active voice
   * @param {number} voiceNumber - Voice number (1 or 2)
   */
  setVoice(voiceNumber) {
    this.voiceNumber = Math.max(1, Math.min(2, voiceNumber));
    this.updateVoiceSelector();
    this.onVoiceChange(this.voiceNumber);
  }

  /**
   * Set the voice display without triggering callbacks
   * Used when selecting notes to reflect which voice they belong to
   * @param {number} voiceNumber - Voice number (1 or 2)
   */
  setVoiceDisplay(voiceNumber) {
    this.voiceNumber = Math.max(1, Math.min(2, voiceNumber));
    this.updateVoiceSelector();
  }

  /**
   * Cycle through voices (1 -> 2 -> 1 -> ...)
   */
  cycleVoice() {
    const newVoice = this.voiceNumber === 1 ? 2 : 1;
    this.setVoice(newVoice);
  }

  /**
   * Update voice selector UI to reflect current voice
   */
  updateVoiceSelector() {
    if (!this.container) return;
    const select = this.container.querySelector('.voice-select');
    if (select) {
      select.value = this.voiceNumber.toString();
    }
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
    this.handleMobileTooltips();
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

      // CRITICAL FIX: Must update ALL button states to show toolbar defaults
      // Previously these were skipped due to early return, causing stale visual state
      this.updateDurationButtonsForSelection();
      this.updateArticulationButtonsForSelection();
      this.updateDotButtonForSelection();
      this.updateRestButtonForSelection();
      this.updateAccidentalButtons();
      this.updateTieButtonForSelection();
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
      if (note.duration) {
        // Use centralized getBaseDuration to normalize (strips '.' suffix)
        durations.add(getBaseDuration(note.duration));
      }
      articulations.add(note.articulation || 'none');
      // Use centralized checkIsDotted - handles all formats consistently
      dottedStates.add(checkIsDotted(note));
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

    // CRITICAL FIX: Sync internal state to match what's being shown visually
    // This ensures that if the user adds a new note while something is selected,
    // the new note will have the same properties as shown in the toolbar
    // Only sync when there's a consistent value (not 'mixed')
    if (this.selectionDuration && this.selectionDuration !== 'mixed') {
      this.currentDuration = this.selectionDuration;
    }
    if (this.selectionIsRest !== null && this.selectionIsRest !== 'mixed') {
      this.isRestMode = this.selectionIsRest;
    }
    if (this.selectionDotted !== null && this.selectionDotted !== 'mixed') {
      this.isDotted = this.selectionDotted;
    }

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
      // CRITICAL FIX: When no selection, show the toolbar's default state (currentDuration)
      // When there IS a selection, show the selection state (selectionDuration)
      let isActive, isMixed;
      if (this.selectedNotesCount > 0) {
        isActive = this.selectionDuration && this.selectionDuration === btn.dataset.duration;
        isMixed = this.selectionDuration === 'mixed';
      } else {
        // No selection - show the toolbar's default state for new notes
        isActive = btn.dataset.duration === this.currentDuration;
        isMixed = false;
      }

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

    // CRITICAL FIX: When no selection, show the toolbar's default state (isDotted)
    // When there IS a selection, show the selection state (selectionDotted)
    let isActive, isMixed;
    if (this.selectedNotesCount > 0) {
      isActive = this.selectionDotted === true;
      isMixed = this.selectionDotted === 'mixed';
    } else {
      // No selection - show the toolbar's default state for new notes
      isActive = this.isDotted;
      isMixed = false;
    }

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

    // CRITICAL FIX: When no selection, show the toolbar's default state (isRestMode)
    // When there IS a selection, show the selection state (selectionIsRest)
    let isActive, isMixed;
    if (this.selectedNotesCount > 0) {
      isActive = this.selectionIsRest === true;
      isMixed = this.selectionIsRest === 'mixed';
    } else {
      // No selection - show the toolbar's default state for new notes
      isActive = this.isRestMode;
      isMixed = false;
    }

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
