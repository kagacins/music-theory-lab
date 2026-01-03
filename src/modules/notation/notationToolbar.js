/**
 * Notation Toolbar - UI controls for notation editing
 * Part of the Phase 4.4 VexFlow Professional Notation enhancement
 *
 * This module creates and manages the toolbar for note entry and editing,
 * including duration selection, rests, accidentals, and display options.
 *
 * LAYOUT OPTIONS (Phase 3 Enhancement):
 * - Banner (horizontal): Traditional top toolbar
 * - Sidebar (vertical): Left-side toolbar for better visibility while editing
 * - Sticky: Toolbar follows scroll within notation viewport
 * - Floating Palette: Context-sensitive mini toolbar near cursor (optional)
 */

import { TIME_SIGNATURES, DEFAULT_TIME_SIGNATURE } from '../../data/music-data.js';
import { dispatchBuilderEvent } from '../ui/lessonGuidedMode.js';
import { getBaseDuration, isDotted as checkIsDotted } from './durationUtils.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Toolbar layout modes
 */
export const TOOLBAR_LAYOUTS = {
  BANNER: 'banner',     // Horizontal toolbar at top (default)
  SIDEBAR: 'sidebar',   // Vertical toolbar on left side
};

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
 * Dynamic markings
 */
export const DYNAMICS = [
  { id: 'pp', label: 'Pianissimo', symbol: 'pp' },
  { id: 'p', label: 'Piano', symbol: 'p' },
  { id: 'mp', label: 'Mezzo-piano', symbol: 'mp' },
  { id: 'mf', label: 'Mezzo-forte', symbol: 'mf' },
  { id: 'f', label: 'Forte', symbol: 'f' },
  { id: 'ff', label: 'Fortissimo', symbol: 'ff' },
  { id: 'sfz', label: 'Sforzando', symbol: 'sfz' },
  { id: 'fp', label: 'Forte-piano', symbol: 'fp' },
];

/**
 * Hairpin types (crescendo/decrescendo)
 */
export const HAIRPINS = [
  { id: 'crescendo', label: 'Crescendo', symbol: '⟨' },
  { id: 'decrescendo', label: 'Decrescendo', symbol: '⟩' },
];

/**
 * Ornament types for note embellishment
 */
export const ORNAMENTS = [
  { id: 'trill', label: 'Trill', symbol: 'tr' },
  { id: 'mordent', label: 'Mordent', symbol: '𝆰' },
  { id: 'invertedMordent', label: 'Inverted Mordent', symbol: '𝆱' },
  { id: 'turn', label: 'Turn', symbol: '𝆗' },
  { id: 'invertedTurn', label: 'Inverted Turn', symbol: '⤻' },
];

/**
 * Grace note types
 */
export const GRACE_NOTES = [
  { id: 'acciaccatura', label: 'Acciaccatura (crushed)', symbol: '♪/' },  // Slashed grace note (fast)
  { id: 'appoggiatura', label: 'Appoggiatura (leaning)', symbol: '♪' },  // No slash (longer)
];

/**
 * Common tempo markings with BPM ranges
 */
export const TEMPO_MARKINGS = [
  { id: 'largo', label: 'Largo (Very slow)', symbol: 'Largo', bpm: '40-60' },
  { id: 'adagio', label: 'Adagio (Slow)', symbol: 'Adagio', bpm: '66-76' },
  { id: 'andante', label: 'Andante (Walking pace)', symbol: 'Andante', bpm: '76-108' },
  { id: 'moderato', label: 'Moderato (Moderate)', symbol: 'Moderato', bpm: '108-120' },
  { id: 'allegro', label: 'Allegro (Fast)', symbol: 'Allegro', bpm: '120-156' },
  { id: 'vivace', label: 'Vivace (Lively)', symbol: 'Vivace', bpm: '156-176' },
  { id: 'presto', label: 'Presto (Very fast)', symbol: 'Presto', bpm: '168-200' },
];

/**
 * Repeat sign types
 */
export const REPEAT_SIGNS = [
  { id: 'repeatStart', label: 'Repeat Start |:', symbol: '|:' },
  { id: 'repeatEnd', label: 'Repeat End :|', symbol: ':|' },
  { id: 'repeatBoth', label: 'Repeat Both :|:', symbol: ':|:' },
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
    this.currentDynamic = null;
    this.zoom = 100;
    this.measuresPerLine = 4;
    this.voiceNumber = 1;
    this.timeSignature = '4/4';  // Current time signature as string

    // Selection state for contextual editing
    this.selectedNotesCount = 0;
    this.selectionDuration = null;  // null = no selection, 'mixed' = multiple durations, '4n' = all same
    this.selectionArticulation = null;  // null = none, 'mixed' = multiple, 'staccato' = all same
    this.selectionDynamic = null;  // null = none, 'mixed' = multiple, 'p'/'f'/etc = all same
    this.selectionDotted = null;  // null = no selection, 'mixed' = multiple, true/false = all same
    this.selectionTied = null;  // null = no selection, 'mixed' = multiple, true/false = all same
    this.selectionTuplet = null;  // null = no tuplet, 'triplet'/'quintuplet'/'sextuplet' = all same tuplet type

    // Callbacks
    this.onDurationChange = options.onDurationChange || (() => {});
    this.onRestModeChange = options.onRestModeChange || (() => {});
    this.onDottedChange = options.onDottedChange || (() => {});
    this.onAccidentalChange = options.onAccidentalChange || (() => {});
    this.onArticulationChange = options.onArticulationChange || (() => {});
    this.onDynamicChange = options.onDynamicChange || (() => {});
    this.onHairpinApply = options.onHairpinApply || (() => {});  // Hairpin: crescendo/decrescendo applied to selected range
    this.onHairpinRemove = options.onHairpinRemove || (() => {});  // Remove hairpin from selected notes
    this.onZoomChange = options.onZoomChange || (() => {});
    this.onMeasuresPerLineChange = options.onMeasuresPerLineChange || (() => {});
    this.onTimeSignatureChange = options.onTimeSignatureChange || (() => {});
    this.onVoiceChange = options.onVoiceChange || (() => {});
    this.onUndo = options.onUndo || (() => {});
    this.onRedo = options.onRedo || (() => {});
    this.onDelete = options.onDelete || (() => {});
    this.onMeasureEdit = options.onMeasureEdit || (() => {});  // Open Measure Isolation Editor
    this.onTie = options.onTie || (() => {});
    this.onSlur = options.onSlur || (() => {});  // Slur: create slur between selected notes
    this.onSlurRemove = options.onSlurRemove || (() => {});  // Remove slur from selected notes
    this.onOrnamentApply = options.onOrnamentApply || (() => {});  // Apply ornament to selected notes
    this.onOrnamentRemove = options.onOrnamentRemove || (() => {});  // Remove ornament from selected notes
    this.onGraceNoteAdd = options.onGraceNoteAdd || (() => {});  // Add grace note to selected note
    this.onGraceNoteRemove = options.onGraceNoteRemove || (() => {});  // Remove grace notes from selected note
    this.onGraceNoteTranspose = options.onGraceNoteTranspose || (() => {});  // Transpose grace notes by half steps
    this.onTempoMarkingApply = options.onTempoMarkingApply || (() => {});  // Apply tempo marking at selected position
    this.onRepeatSignApply = options.onRepeatSignApply || (() => {});  // Apply repeat sign at selected measure
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

    // ========================================================================
    // LAYOUT OPTIONS (Phase 3 Enhancement)
    // ========================================================================

    // Progressive disclosure: whether Tier 2 (expanded options) is visible
    this.isTier2Expanded = false;

    // Sticky toolbar: follows scroll within notation viewport
    this.isStickyEnabled = localStorage.getItem('notation-toolbar-sticky') !== 'false'; // default true

    // Floating palette: persistent mini toolbar near notation area
    this.isFloatingPaletteEnabled = localStorage.getItem('notation-floating-palette') === 'true'; // default false
    this.floatingPaletteElement = null;

    // Floating palette customization - which tools to show
    // Default: durations, dot, rest, accidentals, staff select
    this.paletteSettings = this.loadPaletteSettings();
  }

  /**
   * Load palette customization settings from localStorage
   * @returns {Object} Palette settings with tool visibility flags
   */
  loadPaletteSettings() {
    const defaults = {
      showDurations: true,
      showDotRest: true,
      showAccidentals: true,
      showStaffSelect: true,
      showModeToggle: false,
      showTuplets: false,
      showArticulations: false,
      showDynamics: false,
    };

    try {
      const saved = localStorage.getItem('notation-floating-palette-settings');
      if (saved) {
        return { ...defaults, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load palette settings:', e);
    }
    return defaults;
  }

  /**
   * Save palette customization settings to localStorage
   */
  savePaletteSettings() {
    try {
      localStorage.setItem('notation-floating-palette-settings', JSON.stringify(this.paletteSettings));
    } catch (e) {
      console.warn('Failed to save palette settings:', e);
    }
  }

  /**
   * Update a palette setting and rebuild the palette
   * @param {string} setting - Setting name
   * @param {boolean} value - Setting value
   */
  updatePaletteSetting(setting, value) {
    this.paletteSettings[setting] = value;
    this.savePaletteSettings();
    // Rebuild palette if it exists, keeping settings panel open
    if (this.floatingPaletteElement && this.isFloatingPaletteEnabled) {
      // Check if settings panel was open before rebuild
      const settingsPanel = this.floatingPaletteElement.querySelector('.palette-settings-panel');
      const wasSettingsOpen = settingsPanel && settingsPanel.style.display !== 'none';

      // Rebuild palette
      this.createFloatingPalette();

      // Restore settings panel state
      if (wasSettingsOpen) {
        const newSettingsPanel = this.floatingPaletteElement.querySelector('.palette-settings-panel');
        if (newSettingsPanel) {
          newSettingsPanel.style.display = 'block';
        }
      }
    }
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

    // If floating palette is enabled and we're on Composition Studio tab, create it now
    if (this.isFloatingPaletteEnabled && this.isOnCompositionStudioTab()) {
      this.createFloatingPalette();
    }

    // Listen for tab changes to show/hide palette
    this.setupTabChangeListener();
  }

  /**
   * Check if current tab is Composition Studio (melody tab)
   * @returns {boolean}
   */
  isOnCompositionStudioTab() {
    return window.currentTab === 'melody';
  }

  /**
   * Setup listener for tab changes to show/hide floating palette
   */
  setupTabChangeListener() {
    // Listen for tabSelected event from tabs.js
    window.addEventListener('tabSelected', (e) => {
      this.handleTabChange(e.detail?.tab);
    });
  }

  /**
   * Handle tab change - show/hide floating palette
   * @param {string} tabId - The new active tab ID
   */
  handleTabChange(tabId) {
    if (this.isFloatingPaletteEnabled) {
      if (tabId === 'melody') {
        // On Composition Studio - show palette
        if (!this.floatingPaletteElement) {
          this.createFloatingPalette();
        } else {
          this.floatingPaletteElement.classList.add('visible');
        }
      } else {
        // Not on Composition Studio - hide palette
        if (this.floatingPaletteElement) {
          this.floatingPaletteElement.classList.remove('visible');
        }
      }
    }
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

    const stickyClass = this.isStickyEnabled ? 'toolbar-sticky' : '';

    this.container.innerHTML = `
      <div class="notation-toolbar notation-toolbar-banner ${stickyClass}">
        <!-- TIER 1: ESSENTIAL (Always Visible) -->
        <div class="toolbar-tier toolbar-tier-1">
          <!-- Mode Toggle (Leftmost - Alt-based mode switching with sticky toggle) -->
          <div class="toolbar-section mode-section" style="display: flex; align-items: center; gap: 4px;">
            <span class="text-xs text-gray-600" style="white-space: nowrap;">Entry:</span>
            <div class="button-group" style="display: flex; gap: 2px;">
              <button class="toolbar-btn interaction-mode-btn ${this.interactionMode === 'noteEntry' ? 'active' : ''}" data-interaction-mode="noteEntry" title="Entry Mode ON - click adds notes (hold Alt to select)" style="min-width: 32px; padding: 4px 8px;">ON</button>
              <button class="toolbar-btn interaction-mode-btn ${this.interactionMode === 'select' ? 'active' : ''}" data-interaction-mode="select" title="Entry Mode OFF - click selects notes (hold Alt to add)" style="min-width: 32px; padding: 4px 8px;">OFF</button>
            </div>
            <span class="mode-hint text-xs text-gray-500" style="white-space: nowrap;">${this.interactionMode === 'noteEntry' ? '(Alt=Sel)' : '(Alt=Add)'}</span>
          </div>

          <!-- Selection Indicator (shown when notes selected) -->
          <div class="toolbar-section selection-indicator" style="display: ${this.selectedNotesCount > 0 ? 'flex' : 'none'};">
            <span class="selection-badge">✓ ${this.selectedNotesCount}</span>
            <div class="transpose-tools">
              <button class="toolbar-btn transpose-btn" data-transpose="-12" title="Transpose down octave">⬇8</button>
              <button class="toolbar-btn transpose-btn" data-transpose="1" title="Transpose up semitone">+</button>
              <button class="toolbar-btn transpose-btn" data-transpose="-1" title="Transpose down semitone">−</button>
              <button class="toolbar-btn transpose-btn" data-transpose="12" title="Transpose up octave">⬆8</button>
            </div>
          </div>

          <!-- Duration Buttons (Essential) -->
          <div class="toolbar-section duration-section">
            <div class="button-group duration-buttons">
              ${DURATIONS.slice(0, 5).map((d, i) => `
                <button
                  class="toolbar-btn duration-btn ${d.id === this.currentDuration ? 'active' : ''}"
                  data-duration="${d.id}"
                  title="${d.label} (Shift+${i + 1})"
                >${d.symbol}</button>
              `).join('')}
            </div>
          </div>

          <!-- Modifiers: Dot, Rest (Essential) -->
          <div class="toolbar-section modifiers-section">
            <button class="toolbar-btn dot-btn ${this.isDotted ? 'active' : ''}" data-action="dot" title="Dotted note (.)">•</button>
            <button class="toolbar-btn rest-btn ${this.isRestMode ? 'active' : ''}" data-action="rest" title="Rest mode (R)">𝄽</button>
          </div>

          <!-- Accidentals (Essential) -->
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

          <!-- Staff Select (Essential) -->
          <div class="toolbar-section staff-section">
            <select class="staff-select" data-mode="${this.staffSelectionMode}" title="Staff: Auto (A) | Treble (G) | Bass (B)">
              <option value="auto" ${this.staffSelectionMode === 'auto' ? 'selected' : ''}>🎯 Auto</option>
              <option value="treble" ${this.staffSelectionMode === 'treble' ? 'selected' : ''}>🎼 Treble</option>
              <option value="bass" ${this.staffSelectionMode === 'bass' ? 'selected' : ''}>🎸 Bass</option>
            </select>
            <span class="editing-context-indicator" title="Current editing context"><span class="context-icon">📍</span><span class="context-text">Ready</span></span>
          </div>

          <!-- Quick Actions (Essential) -->
          <div class="toolbar-section quick-actions-section">
            <button class="toolbar-btn measure-edit-btn" data-action="measureEdit" title="Measure Isolation Editor (Edit single measure)">🔲</button>
          </div>

          <!-- Floating Palette Toggle -->
          <div class="toolbar-section palette-section">
            <label class="floating-palette-toggle" title="Show persistent quick-tools palette">
              <input type="checkbox" class="floating-palette-checkbox" ${this.isFloatingPaletteEnabled ? 'checked' : ''}>
              <span class="toggle-label">Palette</span>
            </label>
          </div>

          <!-- Expand/Collapse Button -->
          <button class="toolbar-btn expand-btn ${this.isTier2Expanded ? 'active' : ''}" data-action="toggleTier2" title="Show more options">
            <span class="expand-icon">${this.isTier2Expanded ? '▲ Less' : '▼ More'}</span>
          </button>
        </div>

        <!-- TIER 2: EXPANDED (Click to Show) -->
        <div class="toolbar-tier toolbar-tier-2 ${this.isTier2Expanded ? 'expanded' : 'collapsed'}">
          <!-- Voice Selection (grouped with V2 Rests) -->
          <div class="toolbar-group tier2-group">
            <span class="group-label">Voice</span>
            <div class="toolbar-group-content">
              <select class="voice-select" title="Voice (V to cycle)">
                <option value="1" ${this.voiceNumber === 1 ? 'selected' : ''}>V1</option>
                <option value="2" ${this.voiceNumber === 2 ? 'selected' : ''}>V2</option>
              </select>
            </div>
          </div>

          <!-- Voice 2 Rest Display (grouped with Voice) -->
          <div class="toolbar-group tier2-group rest-display-section">
            <span class="group-label">V2 Rests</span>
            <div class="toolbar-group-content">
              <button class="toolbar-btn rest-display-btn ${this.restDisplayMode === 'clean' ? 'active' : ''}" data-rest-mode="clean" title="Clean mode - hide redundant rests">Clean</button>
              <button class="toolbar-btn rest-display-btn ${this.restDisplayMode === 'explicit' ? 'active' : ''}" data-rest-mode="explicit" title="Show all rests explicitly">All</button>
            </div>
          </div>

          <!-- Edit Actions -->
          <div class="toolbar-group tier2-group">
            <span class="group-label">Edit</span>
            <div class="toolbar-group-content">
              <button class="toolbar-btn undo-btn" data-action="undo" title="Undo (Ctrl+Z)">↩</button>
              <button class="toolbar-btn redo-btn" data-action="redo" title="Redo (Ctrl+Y)">↪</button>
              <button class="toolbar-btn delete-btn" data-action="delete" title="Delete">🗑</button>
            </div>
          </div>

          <!-- Copy/Paste -->
          <div class="toolbar-group tier2-group">
            <span class="group-label">Clip</span>
            <div class="toolbar-group-content">
              <button class="toolbar-btn copy-btn" data-action="copy" title="Copy (Ctrl+C)">📋</button>
              <button class="toolbar-btn paste-btn" data-action="paste" title="Paste (Ctrl+V)">📥</button>
              <button class="toolbar-btn copy-block-btn" data-action="copyBlock" title="Copy Block">📦</button>
            </div>
          </div>

          <!-- View Options -->
          <div class="toolbar-group tier2-group">
            <span class="group-label">View</span>
            <div class="toolbar-group-content">
              <select class="time-signature-select" title="Time signature">
                ${TIME_SIGNATURES.map(ts => `
                  <option value="${ts.value}" ${this.timeSignature === ts.value ? 'selected' : ''}>${ts.value}</option>
                `).join('')}
              </select>
              <select class="measures-select" title="Measures per line">
                ${MEASURES_PER_LINE_OPTIONS.map(m => `
                  <option value="${m}" ${m === this.measuresPerLine ? 'selected' : ''}>${m}</option>
                `).join('')}
              </select>
              <button class="toolbar-btn metronome-btn ${this.metronomeEnabled ? 'active' : ''}" data-action="metronome" title="Metronome">🔔</button>
            </div>
          </div>

          <!-- Tuplets -->
          <div class="toolbar-group tier2-group">
            <span class="group-label">Tuplet</span>
            <div class="toolbar-group-content">
              <button class="toolbar-btn tuplet-btn ${this.tupletInsertMode === 'triplet' ? 'active' : ''}" data-tuplet="triplet" title="Triplet">3</button>
              <button class="toolbar-btn tuplet-btn ${this.tupletInsertMode === 'quintuplet' ? 'active' : ''}" data-tuplet="quintuplet" title="Quintuplet">5</button>
              <button class="toolbar-btn tuplet-btn ${this.tupletInsertMode === 'sextuplet' ? 'active' : ''}" data-tuplet="sextuplet" title="Sextuplet">6</button>
            </div>
          </div>

          <!-- Articulations -->
          <div class="toolbar-group tier2-group">
            <span class="group-label">Artic.</span>
            <div class="toolbar-group-content">
              ${ARTICULATIONS.map(a => `
                <button class="toolbar-btn articulation-btn ${a.id === this.currentArticulation ? 'active' : ''}" data-articulation="${a.id}" title="${a.label}">${a.symbol}</button>
              `).join('')}
            </div>
          </div>

          <!-- Dynamics -->
          <div class="toolbar-group tier2-group">
            <span class="group-label">Dynamics</span>
            <div class="toolbar-group-content dynamics-buttons">
              ${DYNAMICS.map(d => `
                <button class="toolbar-btn dynamic-btn ${d.id === this.currentDynamic ? 'active' : ''}" data-dynamic="${d.id}" title="${d.label}">${d.symbol}</button>
              `).join('')}
            </div>
          </div>

          <!-- Hairpins -->
          <div class="toolbar-group tier2-group">
            <span class="group-label">Hairpin</span>
            <div class="toolbar-group-content">
              ${HAIRPINS.map(h => `
                <button class="toolbar-btn hairpin-btn" data-hairpin="${h.id}" title="${h.label} (select 2 notes first)">${h.symbol}</button>
              `).join('')}
              <button class="toolbar-btn hairpin-remove-btn" data-action="remove-hairpin" title="Remove hairpin (select note in hairpin)">✕</button>
            </div>
          </div>

          <!-- Tie Button -->
          <div class="toolbar-group tier2-group">
            <span class="group-label">Tie</span>
            <div class="toolbar-group-content">
              <button class="toolbar-btn tie-btn" data-action="tie" title="Tie notes (T)">⁀</button>
            </div>
          </div>

          <!-- Slur Button -->
          <div class="toolbar-group tier2-group">
            <span class="group-label">Slur</span>
            <div class="toolbar-group-content">
              <button class="toolbar-btn slur-btn" data-action="slur" title="Slur (select 2+ notes)">⌢</button>
              <button class="toolbar-btn slur-remove-btn" data-action="remove-slur" title="Remove slur">✕</button>
            </div>
          </div>

          <!-- Ornaments -->
          <div class="toolbar-group tier2-group">
            <span class="group-label">Ornament</span>
            <div class="toolbar-group-content ornament-buttons">
              ${ORNAMENTS.map(o => `
                <button class="toolbar-btn ornament-btn" data-ornament="${o.id}" title="${o.label}">${o.symbol}</button>
              `).join('')}
              <button class="toolbar-btn ornament-remove-btn" data-action="remove-ornament" title="Remove ornament">✕</button>
            </div>
          </div>

          <!-- Grace Notes -->
          <div class="toolbar-group tier2-group">
            <span class="group-label">Grace</span>
            <div class="toolbar-group-content grace-note-buttons">
              ${GRACE_NOTES.map(g => `
                <button class="toolbar-btn grace-note-btn" data-grace="${g.id}" title="${g.label}">${g.symbol}</button>
              `).join('')}
              <button class="toolbar-btn grace-transpose-btn" data-grace-transpose="-1" title="Transpose grace note down">-</button>
              <button class="toolbar-btn grace-transpose-btn" data-grace-transpose="1" title="Transpose grace note up">+</button>
              <button class="toolbar-btn grace-remove-btn" data-action="remove-grace" title="Remove grace notes">✕</button>
            </div>
          </div>

          <!-- Tempo Markings -->
          <div class="toolbar-group tier2-group">
            <span class="group-label">Tempo</span>
            <div class="toolbar-group-content tempo-buttons">
              <select class="tempo-select" title="Select tempo marking">
                <option value="">-</option>
                ${TEMPO_MARKINGS.map(t => `
                  <option value="${t.id}" title="${t.bpm} BPM">${t.symbol}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Repeat Signs -->
          <div class="toolbar-group tier2-group">
            <span class="group-label">Repeat</span>
            <div class="toolbar-group-content repeat-buttons">
              ${REPEAT_SIGNS.map(r => `
                <button class="toolbar-btn repeat-btn" data-repeat="${r.id}" title="${r.label}">${r.symbol}</button>
              `).join('')}
            </div>
          </div>

          <!-- Chord Symbol (in Tier 2) -->
          <div class="toolbar-group tier2-group chord-group">
            <span class="group-label">Chord</span>
            <div class="toolbar-group-content">
              <input type="text" class="chord-symbol-input" placeholder="Cmaj7" title="Chord symbol">
              <button class="toolbar-btn apply-chord-btn" data-action="applyChord" title="Apply">✓</button>
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
      /* ================================================================
         LAYOUT SYSTEM STYLES (Phase 3 Enhancement)
         ================================================================ */

      .notation-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 6px 8px;
        background: var(--bg-secondary, #2a2a2a);
        border-radius: 6px;
        margin-bottom: 8px;
        align-items: stretch;
        transition: all 0.3s ease;
      }

      /* Banner Layout (horizontal - default) */
      .notation-toolbar-banner {
        flex-direction: row;
        width: 100%;
      }

      .notation-toolbar-banner .toolbar-tier-1 {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
        width: 100%;
      }

      .notation-toolbar-banner .toolbar-tier-2 {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: flex-start;
        width: 100%;
        margin-top: 4px;
        padding-top: 8px;
        border-top: 1px solid rgba(255,255,255,0.1);
        max-height: 0;
        overflow: hidden;
        opacity: 0;
        transition: max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease, margin 0.3s ease;
        padding-top: 0;
        margin-top: 0;
      }

      .notation-toolbar-banner .toolbar-tier-2.expanded {
        max-height: 500px;
        opacity: 1;
        padding-top: 8px;
        margin-top: 4px;
      }

      /* Sticky Toolbar */
      .toolbar-sticky {
        position: sticky;
        top: 0;
        z-index: 100;
        background: var(--bg-secondary, #2a2a2a);
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }

      /* Expand/Layout toggle buttons - scoped to notation toolbar only */
      .notation-toolbar .expand-btn {
        width: auto !important;
        min-width: 60px;
        padding: 0 8px !important;
        font-size: 11px !important;
        background: rgba(74, 158, 255, 0.2) !important;
        border: 1px solid rgba(74, 158, 255, 0.3) !important;
      }

      .notation-toolbar .expand-btn .expand-icon {
        font-size: 11px;
        white-space: nowrap;
      }

      .notation-toolbar .expand-btn:hover {
        background: rgba(74, 158, 255, 0.35) !important;
      }

      .notation-toolbar .expand-btn.active {
        background: var(--accent-color, #4a9eff) !important;
      }

      /* Tier 2 group styling */
      .tier2-group {
        min-width: 0;
      }

      .tier2-group .group-label {
        font-size: 8px;
        margin-bottom: 1px;
      }

      /* Floating palette toggle */
      .floating-palette-toggle {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        font-size: 11px;
        color: var(--text-secondary, #aaa);
      }

      .floating-palette-toggle input[type="checkbox"] {
        width: 14px;
        height: 14px;
        cursor: pointer;
      }

      .floating-palette-toggle .toggle-label {
        font-size: 10px;
      }

      /* ================================================================
         FLOATING PALETTE STYLES
         A persistent mini-toolbar that hovers near the notation area
         ================================================================ */
      .notation-floating-palette {
        position: absolute;
        display: none;
        flex-direction: column;
        gap: 4px;
        padding: 6px;
        background: var(--bg-secondary, #2a2a2a);
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        z-index: 100;
        pointer-events: auto;
        right: 10px;
        top: 50px;
      }

      .notation-floating-palette.visible {
        display: flex;
      }

      .notation-floating-palette .palette-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 4px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        margin-bottom: 4px;
      }

      .notation-floating-palette .palette-title {
        font-size: 9px;
        font-weight: 600;
        color: var(--text-muted, #888);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .notation-floating-palette .palette-close {
        width: 16px;
        height: 16px;
        border: none;
        background: transparent;
        color: var(--text-muted, #888);
        cursor: pointer;
        font-size: 12px;
        padding: 0;
        line-height: 1;
      }

      .notation-floating-palette .palette-close:hover {
        color: var(--text-primary, #fff);
      }

      .notation-floating-palette .toolbar-btn {
        width: 28px;
        height: 28px;
        font-size: 13px;
      }

      .notation-floating-palette .palette-row {
        display: flex;
        gap: 2px;
        align-items: center;
      }

      .notation-floating-palette .palette-divider {
        width: 1px;
        height: 20px;
        background: rgba(255,255,255,0.1);
        margin: 0 4px;
      }

      .notation-floating-palette .staff-select-mini {
        font-size: 11px;
        padding: 2px 4px;
        background: #3a3a3a;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 4px;
        color: #fff;
        cursor: pointer;
      }

      .notation-floating-palette .staff-select-mini:hover {
        background: #4a4a4a;
      }

      .notation-floating-palette .staff-select-mini option {
        background: #2a2a2a;
        color: #fff;
      }

      /* Palette header with multiple buttons */
      .notation-floating-palette .palette-header-buttons {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .notation-floating-palette .palette-settings-btn {
        width: 18px;
        height: 18px;
        border: none;
        background: transparent;
        color: var(--text-muted, #888);
        cursor: pointer;
        font-size: 12px;
        padding: 0;
        line-height: 1;
        border-radius: 3px;
      }

      .notation-floating-palette .palette-settings-btn:hover {
        color: var(--text-primary, #fff);
        background: rgba(255,255,255,0.1);
      }

      /* Palette settings panel */
      .notation-floating-palette .palette-settings-panel {
        border-top: 1px solid rgba(255,255,255,0.1);
        margin-top: 4px;
        padding-top: 6px;
      }

      .notation-floating-palette .palette-settings-title {
        font-size: 9px;
        font-weight: 600;
        color: var(--text-muted, #888);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
      }

      .notation-floating-palette .palette-setting-item {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 0;
        cursor: pointer;
        font-size: 11px;
        color: var(--text-secondary, #aaa);
      }

      .notation-floating-palette .palette-setting-item:hover {
        color: var(--text-primary, #fff);
      }

      .notation-floating-palette .palette-setting-item input[type="checkbox"] {
        width: 12px;
        height: 12px;
        cursor: pointer;
      }

      .notation-floating-palette .palette-empty {
        font-size: 10px;
        color: var(--text-muted, #888);
        font-style: italic;
        padding: 8px 4px;
      }

      .notation-floating-palette .palette-settings-done {
        width: 100%;
        margin-top: 8px;
        padding: 4px 8px;
        font-size: 11px;
        background: rgba(74, 158, 255, 0.2);
        border: 1px solid rgba(74, 158, 255, 0.3);
        border-radius: 4px;
        color: var(--text-primary, #fff);
        cursor: pointer;
        transition: background 0.15s ease;
      }

      .notation-floating-palette .palette-settings-done:hover {
        background: rgba(74, 158, 255, 0.35);
      }

      /* ================================================================
         ORIGINAL STYLES (preserved)
         ================================================================ */

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

      .notation-toolbar .toolbar-btn,
      .notation-floating-palette .toolbar-btn {
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

      .notation-toolbar .toolbar-btn:hover,
      .notation-floating-palette .toolbar-btn:hover {
        background: var(--bg-hover, #444);
      }

      .notation-toolbar .toolbar-btn:focus,
      .notation-floating-palette .toolbar-btn:focus {
        outline: none;
      }

      .notation-toolbar .toolbar-btn.active,
      .notation-floating-palette .toolbar-btn.active {
        background: var(--accent-color, #4a9eff);
        color: white;
      }

      .notation-toolbar .toolbar-btn.mixed,
      .notation-floating-palette .toolbar-btn.mixed {
        background: linear-gradient(135deg, var(--accent-color, #4a9eff) 50%, var(--bg-tertiary, #333) 50%);
        position: relative;
      }

      .notation-toolbar .toolbar-btn.mixed::after,
      .notation-floating-palette .toolbar-btn.mixed::after {
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

      .notation-toolbar .toolbar-btn:disabled,
      .notation-floating-palette .toolbar-btn:disabled {
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

      .dynamic-btn {
        font-size: 11px;
        font-weight: bold;
        font-style: italic;
        min-width: 28px;
        padding: 0 4px;
      }

      .dynamics-buttons {
        flex-wrap: wrap;
        gap: 2px;
      }

      .hairpin-btn {
        font-size: 16px;
        font-weight: normal;
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

      /* Override .toolbar-btn font-size for rest display buttons */
      .notation-toolbar .rest-display-btn,
      .rest-display-btn {
        width: auto !important;
        padding: 0 6px !important;
        font-size: 9px !important;
        font-weight: 500;
        height: 24px !important;
        min-width: 28px;
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

    // ================================================================
    // LAYOUT CONTROL LISTENERS (Phase 3 Enhancement)
    // ================================================================

    // Expand/Collapse Tier 2 button
    this.container.querySelector('[data-action="toggleTier2"]')?.addEventListener('click', () => {
      this.toggleTier2();
    });

    // Floating palette toggle checkbox
    this.container.querySelector('.floating-palette-checkbox')?.addEventListener('change', (e) => {
      this.setFloatingPaletteEnabled(e.target.checked);
    });

    // ================================================================
    // ORIGINAL LISTENERS
    // ================================================================

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

    // Slur button - create slur between selected notes
    this.container.querySelector('.slur-btn')?.addEventListener('click', () => {
      if (this.selectedNotesCount >= 2) {
        this.onSlur();
      } else {
        console.log('Select 2+ notes to create a slur');
      }
    });

    // Slur remove button
    this.container.querySelector('.slur-remove-btn')?.addEventListener('click', () => {
      if (this.selectedNotesCount >= 1) {
        this.onSlurRemove();
      } else {
        console.log('Select a note within a slur to remove it');
      }
    });

    // Ornament buttons - apply ornament to selected notes
    this.container.querySelectorAll('.ornament-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ornamentType = e.currentTarget.dataset.ornament;
        if (ornamentType && this.selectedNotesCount >= 1) {
          this.onOrnamentApply(ornamentType);
        } else if (this.selectedNotesCount < 1) {
          console.log('Select at least 1 note to apply an ornament');
        }
      });
    });

    // Ornament remove button
    this.container.querySelector('.ornament-remove-btn')?.addEventListener('click', () => {
      if (this.selectedNotesCount >= 1) {
        this.onOrnamentRemove();
      } else {
        console.log('Select a note to remove its ornament');
      }
    });

    // Grace note buttons - add grace note to selected note
    this.container.querySelectorAll('.grace-note-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const graceType = e.currentTarget.dataset.grace;
        if (graceType) {
          // Always call the callback - let noteEditor check selection
          this.onGraceNoteAdd(graceType);
        }
      });
    });

    // Grace note remove button
    this.container.querySelector('.grace-remove-btn')?.addEventListener('click', () => {
      // Always call the callback - let noteEditor check selection
      this.onGraceNoteRemove();
    });

    // Grace note transpose buttons
    this.container.querySelectorAll('.grace-transpose-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const halfSteps = parseInt(e.currentTarget.dataset.graceTranspose);
        if (!isNaN(halfSteps)) {
          this.onGraceNoteTranspose(halfSteps);
        }
      });
    });

    // Tempo marking select
    this.container.querySelector('.tempo-select')?.addEventListener('change', (e) => {
      const tempoId = e.target.value;
      if (tempoId) {
        const tempoMarking = TEMPO_MARKINGS.find(t => t.id === tempoId);
        if (tempoMarking) {
          this.onTempoMarkingApply(tempoMarking);
        }
        // Reset the select after applying
        e.target.value = '';
      }
    });

    // Repeat sign buttons
    this.container.querySelectorAll('.repeat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const repeatType = e.currentTarget.dataset.repeat;
        if (repeatType) {
          this.onRepeatSignApply(repeatType);
        }
      });
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

    // Dynamic buttons
    this.container.querySelectorAll('.dynamic-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const dynamic = e.currentTarget.dataset.dynamic;
        if (dynamic) {
          this.setDynamic(dynamic);
        }
      });
    });

    // Hairpin buttons - apply to selected notes
    this.container.querySelectorAll('.hairpin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hairpinType = e.currentTarget.dataset.hairpin;
        if (hairpinType && this.selectedNotesCount >= 2) {
          // Apply hairpin (crescendo/decrescendo) to selected note range
          this.onHairpinApply(hairpinType);
        } else if (this.selectedNotesCount < 2) {
          // Show feedback that 2 notes must be selected
          console.log('Select 2 notes first to create a hairpin');
        }
      });
    });

    // Hairpin remove button
    this.container.querySelectorAll('.hairpin-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (this.selectedNotesCount >= 1) {
          this.onHairpinRemove();
        } else {
          console.log('Select a note within a hairpin to remove it');
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

    // Measure Isolation Editor button
    this.container.querySelector('[data-action="measureEdit"]')?.addEventListener('click', () => {
      this.onMeasureEdit();
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
    this.updateFloatingPaletteState(); // Sync floating palette
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
    this.updateFloatingPaletteState(); // Sync floating palette
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

    // Update mode hint text if present
    const modeHint = this.container.querySelector('.mode-hint');
    if (modeHint) {
      modeHint.textContent = this.interactionMode === 'noteEntry' ? '(Alt=Sel)' : '(Alt=Add)';
    }
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
   * @returns {Object} - { restDisplayMode }
   */
  getRestDisplaySettings() {
    return {
      restDisplayMode: this.restDisplayMode,
    };
  }

  /**
   * Update rest display mode button states
   */
  updateRestDisplayButtons() {
    if (!this.container) return;
    this.container.querySelectorAll('.rest-display-btn').forEach(btn => {
      const isActive = btn.dataset.restMode === this.restDisplayMode;
      btn.classList.toggle('active', isActive);
    });
  }

  /**
   * Toggle rest mode
   */
  toggleRestMode() {
    this.isRestMode = !this.isRestMode;
    this.updateRestButton();
    this.updateFloatingPaletteState(); // Sync floating palette
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
    this.updateFloatingPaletteState(); // Sync floating palette
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
    this.updateFloatingPaletteState(); // Sync floating palette
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
   * Set dynamic marking
   * @param {string} dynamic - Dynamic ID (pp, p, mp, mf, f, ff, sfz, fp) or null to clear
   */
  setDynamic(dynamic) {
    // Toggle if clicking the same dynamic
    if (this.currentDynamic === dynamic) {
      this.currentDynamic = null;
    } else {
      this.currentDynamic = dynamic;
    }
    this.updateDynamicButtons();
    this.onDynamicChange(this.currentDynamic);
  }

  /**
   * Update dynamic button states
   */
  updateDynamicButtons() {
    if (!this.container) return;
    this.container.querySelectorAll('.dynamic-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.dynamic === this.currentDynamic);
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
      dynamic: this.currentDynamic,
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
    this.currentDynamic = null;
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

  // ========================================================================
  // LAYOUT CONTROL METHODS (Phase 3 Enhancement)
  // ========================================================================

  /**
   * Toggle Tier 2 (expanded options) visibility
   */
  toggleTier2() {
    this.isTier2Expanded = !this.isTier2Expanded;
    this.updateTier2Display();
  }

  /**
   * Update Tier 2 display without full re-render
   */
  updateTier2Display() {
    const tier2 = this.container?.querySelector('.toolbar-tier-2');
    const expandBtn = this.container?.querySelector('.expand-btn');

    if (tier2) {
      tier2.classList.toggle('expanded', this.isTier2Expanded);
      tier2.classList.toggle('collapsed', !this.isTier2Expanded);
    }

    if (expandBtn) {
      expandBtn.classList.toggle('active', this.isTier2Expanded);
      const icon = expandBtn.querySelector('.expand-icon');
      if (icon) {
        icon.textContent = this.isTier2Expanded ? '▲ Less' : '▼ More';
      }
    }
  }

  /**
   * Set sticky toolbar enabled/disabled
   * @param {boolean} enabled - Whether sticky is enabled
   */
  setStickyEnabled(enabled) {
    this.isStickyEnabled = enabled;
    localStorage.setItem('notation-toolbar-sticky', enabled ? 'true' : 'false');

    const toolbar = this.container?.querySelector('.notation-toolbar');
    if (toolbar) {
      toolbar.classList.toggle('toolbar-sticky', enabled);
    }
  }

  /**
   * Toggle sticky toolbar
   */
  toggleSticky() {
    this.setStickyEnabled(!this.isStickyEnabled);
  }

  /**
   * Set floating palette enabled/disabled
   * @param {boolean} enabled - Whether floating palette is enabled
   */
  setFloatingPaletteEnabled(enabled) {
    this.isFloatingPaletteEnabled = enabled;
    localStorage.setItem('notation-floating-palette', enabled ? 'true' : 'false');

    if (enabled) {
      // Only create palette if on Composition Studio tab
      if (this.isOnCompositionStudioTab()) {
        this.createFloatingPalette();
      }
    } else {
      this.destroyFloatingPalette();
    }
  }

  /**
   * Create the floating palette element
   * This is a persistent mini-toolbar that stays visible in a fixed position
   * on the screen, providing quick access to essential tools.
   * The palette is draggable and its position is persisted in localStorage.
   */
  createFloatingPalette() {
    // Remove existing palette if any
    this.destroyFloatingPalette();

    const palette = document.createElement('div');
    palette.id = 'notation-floating-palette';
    palette.className = 'notation-floating-palette visible'; // Start visible immediately

    // Build palette content based on settings
    const ps = this.paletteSettings;

    // Row 1: Durations + Dot/Rest (if enabled)
    let row1Content = '';
    if (ps.showDurations) {
      row1Content += DURATIONS.slice(0, 4).map(d => `
        <button class="toolbar-btn duration-btn ${d.id === this.currentDuration ? 'active' : ''}"
                data-duration="${d.id}" title="${d.label}">${d.symbol}</button>
      `).join('');
    }
    if (ps.showDurations && ps.showDotRest) {
      row1Content += '<div class="palette-divider"></div>';
    }
    if (ps.showDotRest) {
      row1Content += `
        <button class="toolbar-btn dot-btn ${this.isDotted ? 'active' : ''}" data-action="dot" title="Dotted (.)">•</button>
        <button class="toolbar-btn rest-btn ${this.isRestMode ? 'active' : ''}" data-action="rest" title="Rest (R)">𝄽</button>
      `;
    }

    // Row 2: Accidentals + Staff Select (if enabled)
    let row2Content = '';
    if (ps.showAccidentals) {
      row2Content += ACCIDENTALS.map(a => `
        <button class="toolbar-btn accidental-btn ${a.id === this.currentAccidental ? 'active' : ''}"
                data-accidental="${a.id}" title="${a.label}">${a.symbol}</button>
      `).join('');
    }
    if (ps.showAccidentals && ps.showStaffSelect) {
      row2Content += '<div class="palette-divider"></div>';
    }
    if (ps.showStaffSelect) {
      row2Content += `
        <select class="staff-select-mini" title="Staff selection">
          <option value="auto" ${this.staffSelectionMode === 'auto' ? 'selected' : ''}>Auto</option>
          <option value="treble" ${this.staffSelectionMode === 'treble' ? 'selected' : ''}>Treble</option>
          <option value="bass" ${this.staffSelectionMode === 'bass' ? 'selected' : ''}>Bass</option>
        </select>
      `;
    }

    // Row 3: Mode toggle (if enabled) - Alt-based switching with sticky
    let row3Content = '';
    if (ps.showModeToggle) {
      row3Content += `
        <button class="toolbar-btn interaction-mode-btn ${this.interactionMode === 'noteEntry' ? 'active' : ''}" data-interaction-mode="noteEntry" title="Entry Mode ON (Alt = select)" style="min-width: 32px;">ON</button>
        <button class="toolbar-btn interaction-mode-btn ${this.interactionMode === 'select' ? 'active' : ''}" data-interaction-mode="select" title="Entry Mode OFF (Alt = add)" style="min-width: 32px;">OFF</button>
      `;
    }

    // Row 4: Tuplets (if enabled)
    let row4Content = '';
    if (ps.showTuplets) {
      row4Content += `
        <button class="toolbar-btn tuplet-btn ${this.tupletInsertMode === 'triplet' ? 'active' : ''}" data-tuplet="triplet" title="Triplet">3</button>
        <button class="toolbar-btn tuplet-btn ${this.tupletInsertMode === 'quintuplet' ? 'active' : ''}" data-tuplet="quintuplet" title="Quintuplet">5</button>
        <button class="toolbar-btn tuplet-btn ${this.tupletInsertMode === 'sextuplet' ? 'active' : ''}" data-tuplet="sextuplet" title="Sextuplet">6</button>
      `;
    }

    // Row 5: Articulations (if enabled)
    let row5Content = '';
    if (ps.showArticulations) {
      row5Content += ARTICULATIONS.map(a => `
        <button class="toolbar-btn articulation-btn ${a.id === this.currentArticulation ? 'active' : ''}" data-articulation="${a.id}" title="${a.label}">${a.symbol}</button>
      `).join('');
    }

    // Row 6: Dynamics (if enabled)
    let row6Content = '';
    if (ps.showDynamics) {
      row6Content += DYNAMICS.map(d => `
        <button class="toolbar-btn dynamic-btn ${d.id === this.currentDynamic ? 'active' : ''}" data-dynamic="${d.id}" title="${d.label}">${d.symbol}</button>
      `).join('');
    }

    // Build the rows HTML
    let rowsHTML = '';
    if (row1Content) rowsHTML += `<div class="palette-row">${row1Content}</div>`;
    if (row2Content) rowsHTML += `<div class="palette-row">${row2Content}</div>`;
    if (row3Content) rowsHTML += `<div class="palette-row">${row3Content}</div>`;
    if (row4Content) rowsHTML += `<div class="palette-row">${row4Content}</div>`;
    if (row5Content) rowsHTML += `<div class="palette-row">${row5Content}</div>`;
    if (row6Content) rowsHTML += `<div class="palette-row">${row6Content}</div>`;

    // If no content, show a message
    if (!rowsHTML) {
      rowsHTML = '<div class="palette-row palette-empty">Click ⚙ to add tools</div>';
    }

    palette.innerHTML = `
      <div class="palette-header" style="cursor: grab;">
        <span class="palette-title">⋮⋮ Quick Tools</span>
        <div class="palette-header-buttons">
          <button class="palette-settings-btn" title="Customize palette">⚙</button>
          <button class="palette-close" title="Close palette">×</button>
        </div>
      </div>
      ${rowsHTML}
      <div class="palette-settings-panel" style="display: none;">
        <div class="palette-settings-title">Show in palette:</div>
        <label class="palette-setting-item">
          <input type="checkbox" data-setting="showDurations" ${ps.showDurations ? 'checked' : ''}>
          <span>Durations</span>
        </label>
        <label class="palette-setting-item">
          <input type="checkbox" data-setting="showDotRest" ${ps.showDotRest ? 'checked' : ''}>
          <span>Dot / Rest</span>
        </label>
        <label class="palette-setting-item">
          <input type="checkbox" data-setting="showAccidentals" ${ps.showAccidentals ? 'checked' : ''}>
          <span>Accidentals</span>
        </label>
        <label class="palette-setting-item">
          <input type="checkbox" data-setting="showStaffSelect" ${ps.showStaffSelect ? 'checked' : ''}>
          <span>Staff Select</span>
        </label>
        <label class="palette-setting-item">
          <input type="checkbox" data-setting="showModeToggle" ${ps.showModeToggle ? 'checked' : ''}>
          <span>Entry/Select Mode</span>
        </label>
        <label class="palette-setting-item">
          <input type="checkbox" data-setting="showTuplets" ${ps.showTuplets ? 'checked' : ''}>
          <span>Tuplets</span>
        </label>
        <label class="palette-setting-item">
          <input type="checkbox" data-setting="showArticulations" ${ps.showArticulations ? 'checked' : ''}>
          <span>Articulations</span>
        </label>
        <label class="palette-setting-item">
          <input type="checkbox" data-setting="showDynamics" ${ps.showDynamics ? 'checked' : ''}>
          <span>Dynamics</span>
        </label>
        <button class="palette-settings-done" title="Close settings">Done</button>
      </div>
    `;

    // Use fixed positioning so palette is always visible and accessible
    palette.style.position = 'fixed';

    // Load saved position from localStorage, or use default position
    // Default: left side, vertically centered to avoid FAB in bottom-right
    const savedPos = this.loadPalettePosition();
    if (savedPos) {
      palette.style.left = savedPos.left + 'px';
      palette.style.top = savedPos.top + 'px';
      palette.style.right = 'auto';
      palette.style.bottom = 'auto';
    } else {
      // Default position: left side, middle of screen (away from FAB)
      palette.style.left = '20px';
      palette.style.top = '50%';
      palette.style.transform = 'translateY(-50%)';
      palette.style.right = 'auto';
      palette.style.bottom = 'auto';
    }

    document.body.appendChild(palette);
    this.floatingPaletteElement = palette;

    // Attach event listeners to floating palette buttons
    this.attachFloatingPaletteListeners();

    // Make the palette draggable
    this.attachDragListeners();
  }

  /**
   * Load palette position from localStorage
   * @returns {Object|null} {left, top} or null if not saved
   */
  loadPalettePosition() {
    try {
      const saved = localStorage.getItem('notation-floating-palette-position');
      if (saved) {
        const pos = JSON.parse(saved);
        // Validate position is within viewport
        if (typeof pos.left === 'number' && typeof pos.top === 'number') {
          // Ensure position is within current viewport bounds
          const maxLeft = window.innerWidth - 100;
          const maxTop = window.innerHeight - 100;
          return {
            left: Math.max(0, Math.min(pos.left, maxLeft)),
            top: Math.max(0, Math.min(pos.top, maxTop))
          };
        }
      }
    } catch (e) {
      console.warn('Failed to load palette position:', e);
    }
    return null;
  }

  /**
   * Save palette position to localStorage
   * @param {number} left - Left position
   * @param {number} top - Top position
   */
  savePalettePosition(left, top) {
    try {
      localStorage.setItem('notation-floating-palette-position', JSON.stringify({ left, top }));
    } catch (e) {
      console.warn('Failed to save palette position:', e);
    }
  }

  /**
   * Attach drag listeners to make the palette draggable
   */
  attachDragListeners() {
    if (!this.floatingPaletteElement) return;

    const header = this.floatingPaletteElement.querySelector('.palette-header');
    if (!header) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onMouseDown = (e) => {
      // Don't start drag if clicking buttons
      if (e.target.classList.contains('palette-close')) return;
      if (e.target.classList.contains('palette-settings-btn')) return;

      isDragging = true;
      header.style.cursor = 'grabbing';

      // Get current position
      const rect = this.floatingPaletteElement.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;

      // Clear any transform (from default centering)
      this.floatingPaletteElement.style.transform = 'none';

      // Prevent text selection during drag
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;

      let newLeft = startLeft + deltaX;
      let newTop = startTop + deltaY;

      // Constrain to viewport
      const paletteRect = this.floatingPaletteElement.getBoundingClientRect();
      const maxLeft = window.innerWidth - paletteRect.width;
      const maxTop = window.innerHeight - paletteRect.height;

      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

      this.floatingPaletteElement.style.left = newLeft + 'px';
      this.floatingPaletteElement.style.top = newTop + 'px';
      this.floatingPaletteElement.style.right = 'auto';
      this.floatingPaletteElement.style.bottom = 'auto';
    };

    const onMouseUp = () => {
      if (!isDragging) return;

      isDragging = false;
      header.style.cursor = 'grab';

      // Save position
      const rect = this.floatingPaletteElement.getBoundingClientRect();
      this.savePalettePosition(rect.left, rect.top);
    };

    // Mouse events
    header.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Touch events for mobile
    header.addEventListener('touchstart', (e) => {
      if (e.target.classList.contains('palette-close')) return;
      const touch = e.touches[0];
      onMouseDown({ clientX: touch.clientX, clientY: touch.clientY, target: e.target, preventDefault: () => e.preventDefault() });
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }, { passive: true });

    document.addEventListener('touchend', onMouseUp);

    // Store cleanup function
    this._dragCleanup = () => {
      header.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }

  /**
   * Attach event listeners to floating palette buttons
   */
  attachFloatingPaletteListeners() {
    if (!this.floatingPaletteElement) return;

    // Close button
    this.floatingPaletteElement.querySelector('.palette-close')?.addEventListener('click', () => {
      this.setFloatingPaletteEnabled(false);
      // Also uncheck the checkbox in toolbar if visible
      const checkbox = this.container?.querySelector('.floating-palette-checkbox');
      if (checkbox) checkbox.checked = false;
    });

    // Settings button - toggle settings panel
    this.floatingPaletteElement.querySelector('.palette-settings-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = this.floatingPaletteElement.querySelector('.palette-settings-panel');
      if (panel) {
        const isVisible = panel.style.display !== 'none';
        panel.style.display = isVisible ? 'none' : 'block';
      }
    });

    // Settings Done button - close settings panel
    this.floatingPaletteElement.querySelector('.palette-settings-done')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = this.floatingPaletteElement.querySelector('.palette-settings-panel');
      if (panel) {
        panel.style.display = 'none';
      }
    });

    // Settings checkboxes
    this.floatingPaletteElement.querySelectorAll('.palette-setting-item input').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const setting = e.target.dataset.setting;
        if (setting) {
          this.updatePaletteSetting(setting, e.target.checked);
        }
      });
    });

    // Duration buttons - setDuration syncs floating palette automatically
    this.floatingPaletteElement.querySelectorAll('.duration-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const duration = e.currentTarget.dataset.duration;
        if (duration) this.setDuration(duration);
      });
    });

    // Accidental buttons - setAccidental syncs floating palette automatically
    this.floatingPaletteElement.querySelectorAll('.accidental-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const accidental = e.currentTarget.dataset.accidental;
        if (accidental) this.setAccidental(accidental);
      });
    });

    // Dot button - toggleDotted syncs floating palette automatically
    this.floatingPaletteElement.querySelector('.dot-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDotted();
    });

    // Rest button - toggleRestMode syncs floating palette automatically
    this.floatingPaletteElement.querySelector('.rest-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleRestMode();
    });

    // Staff select - setStaffSelectionMode syncs floating palette automatically
    this.floatingPaletteElement.querySelector('.staff-select-mini')?.addEventListener('change', (e) => {
      this.setStaffSelectionMode(e.target.value);
    });

    // Mode toggle buttons (if enabled)
    this.floatingPaletteElement.querySelectorAll('.interaction-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mode = e.currentTarget.dataset.interactionMode;
        if (mode) this.setInteractionMode(mode);
      });
    });

    // Tuplet buttons (if enabled)
    this.floatingPaletteElement.querySelectorAll('.tuplet-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tuplet = e.currentTarget.dataset.tuplet;
        if (tuplet) this.setTupletInsertMode(tuplet === this.tupletInsertMode ? null : tuplet);
      });
    });

    // Articulation buttons (if enabled)
    this.floatingPaletteElement.querySelectorAll('.articulation-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const articulation = e.currentTarget.dataset.articulation;
        if (articulation) this.setArticulation(articulation);
      });
    });

    // Dynamic buttons (if enabled)
    this.floatingPaletteElement.querySelectorAll('.dynamic-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dynamic = e.currentTarget.dataset.dynamic;
        if (dynamic) this.setDynamic(dynamic);
      });
    });
  }

  /**
   * Update floating palette button states to match toolbar state
   */
  updateFloatingPaletteState() {
    if (!this.floatingPaletteElement) return;

    // Update duration buttons
    this.floatingPaletteElement.querySelectorAll('.duration-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.duration === this.currentDuration);
    });

    // Update accidental buttons
    this.floatingPaletteElement.querySelectorAll('.accidental-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.accidental === this.currentAccidental);
    });

    // Update dot button
    const dotBtn = this.floatingPaletteElement.querySelector('.dot-btn');
    if (dotBtn) dotBtn.classList.toggle('active', this.isDotted);

    // Update rest button
    const restBtn = this.floatingPaletteElement.querySelector('.rest-btn');
    if (restBtn) restBtn.classList.toggle('active', this.isRestMode);

    // Update staff select
    const staffSelect = this.floatingPaletteElement.querySelector('.staff-select-mini');
    if (staffSelect) staffSelect.value = this.staffSelectionMode;

    // Update mode toggle buttons
    this.floatingPaletteElement.querySelectorAll('.interaction-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.interactionMode === this.interactionMode);
    });

    // Update tuplet buttons
    this.floatingPaletteElement.querySelectorAll('.tuplet-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tuplet === this.tupletInsertMode);
    });

    // Update articulation buttons
    this.floatingPaletteElement.querySelectorAll('.articulation-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.articulation === this.currentArticulation);
    });

    // Update dynamic buttons
    this.floatingPaletteElement.querySelectorAll('.dynamic-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.dynamic === this.currentDynamic);
    });
  }

  /**
   * Show the floating palette (makes it visible)
   */
  showFloatingPalette() {
    if (!this.floatingPaletteElement) {
      this.createFloatingPalette();
    }
    if (this.floatingPaletteElement) {
      this.floatingPaletteElement.classList.add('visible');
      this.updateFloatingPaletteState();
    }
  }

  /**
   * Hide the floating palette
   */
  hideFloatingPalette() {
    if (this.floatingPaletteElement) {
      this.floatingPaletteElement.classList.remove('visible');
    }
  }

  /**
   * Destroy the floating palette element
   */
  destroyFloatingPalette() {
    // Clean up drag listeners
    if (this._dragCleanup) {
      this._dragCleanup();
      this._dragCleanup = null;
    }

    if (this.floatingPaletteElement) {
      this.floatingPaletteElement.remove();
      this.floatingPaletteElement = null;
    }
  }

  /**
   * Get current layout settings for external use
   * @returns {Object} Layout settings
   */
  getLayoutSettings() {
    return {
      isTier2Expanded: this.isTier2Expanded,
      isStickyEnabled: this.isStickyEnabled,
      isFloatingPaletteEnabled: this.isFloatingPaletteEnabled,
    };
  }

  /**
   * Destroy toolbar
   */
  destroy() {
    document.removeEventListener('keydown', this.handleKeyDown);
    this.destroyFloatingPalette();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  TOOLBAR_LAYOUTS,
  DURATIONS,
  ACCIDENTALS,
  ARTICULATIONS,
  ZOOM_LEVELS,
  MEASURES_PER_LINE_OPTIONS,
  NotationToolbar,
};
