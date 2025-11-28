/**
 * Composer Integration - Bridges new notation system with existing Melody Composer
 * Part of the Phase 4.4 VexFlow Professional Notation enhancement
 *
 * This module connects the new modular notation system with:
 * - CompositionState (measure/chord/notation data)
 * - Progression Builder (chord recommendations)
 * - Melody Suggestion Engine
 * - Harmonic Tone Analyzer (coloring)
 */

import { getCompositionState } from '../state/compositionState.js';
import { getProgressionData, getCurrentKey } from '../state/trainerState.js';
import { analyzeChordTone, CHORD_TONE_COLORS } from '../analysis/chordToneAnalyzer.js';
import { StaffLayoutManager } from './staffLayouter.js';
import { NotationToolbar } from './notationToolbar.js';
import {
  renderGrandStaffSystem,
  convertToGrandStaffFormat,
  GRAND_STAFF_DEFAULTS,
} from './grandStaff.js';
import {
  createRenderer,
  noteToMidi,
  getVexFlowKeySignature,
} from './vexFlowRenderer.js';
import { getInteractiveMelody, playMeasure } from '../audio/melodyGenerator.js';
import { generateBassVoicing } from '../integration/bassAutoFill.js';
import { showNoteTooltip, hideNoteTooltip } from '../ui/noteHighlighter.js';
import { PageManager } from './pageManager.js';
import { PAGE_CONFIG, getMeasurePagePosition, applyPaginationPreset, getTotalPages } from './pageConfig.js';
import { PageLayoutManager } from './pageLayoutManager.js';
import { PageNavigator } from './pageNavigator.js';

// ============================================================================
// NOTATION COMPOSER CLASS
// ============================================================================

/**
 * Main class that integrates the new notation system with existing components
 */
export class NotationComposer {
  constructor(options = {}) {
    // Configuration
    this.config = {
      container: options.container || null, // DEPRECATED: Now using PageManager
      pageContainer: options.pageContainer || options.container?.parentElement || null, // Container for pages
      toolbarContainer: options.toolbarContainer || null,
      pageNavigatorContainer: options.pageNavigatorContainer || null, // NEW: Container for page navigation
      measuresPerLine: options.measuresPerLine || 4,
      showMeasureNumbers: options.showMeasureNumbers !== false,
      showChordSymbols: options.showChordSymbols !== false,
      enableHarmonicColoring: options.enableHarmonicColoring !== false,
      enableMelodySuggestions: options.enableMelodySuggestions !== false,
      viewMode: options.viewMode || PAGE_CONFIG.viewModes.SINGLE, // NEW: Default to single page
      enablePagination: options.enablePagination !== false, // NEW: Enable pagination by default
    };

    // State management
    this.compositionState = null;
    this.measureManager = { measures: [] }; // Simple container for synced measure data
    this.layoutManager = new StaffLayoutManager({
      measuresPerLine: this.config.measuresPerLine,
    });
    // Expose layoutManager to window for scroll coordination with overlay
    window.notationLayoutManager = this.layoutManager;
    this.toolbar = null;
    this.pageManager = null; // Will be initialized in init()
    this.pageLayoutManager = null; // NEW: Page layout manager for pagination
    this.pageNavigator = null; // NEW: Page navigation UI

    // Rendering state
    this.renderedSystem = null;
    this.noteRegions = [];  // Bounding boxes for notes with analysis for tooltips
    this.chordBracketRegions = [];  // Click regions for chord bracket labels
    this.selectedMeasure = null;
    this.selectedStaff = null;
    this.selectedNote = null;
    this.pendingRenderFrame = null;  // requestAnimationFrame ID for debouncing renders
    this.lastRenderTime = 0;  // Timestamp of last render for debouncing
    this.noteEditor = null;  // Reference to NoteEditor for Phase 1A ghost note rendering

    // Highlighting state
    this.selectedMeasureIndex = -1;   // Blue border for selected measure
    this.activeMeasureIndex = -1;     // Yellow background for playing measure
    this.activeNotes = new Set();     // Note IDs for red highlighting during playback

    // Re-entrancy guards to prevent infinite loops
    this.isSyncingFromProgression = false;
    this.isHandlingSync = false;

    // Track pages with event listeners to prevent duplicates
    this.pagesWithListeners = new Set();

    // Event handlers
    this.onUpdate = options.onUpdate || (() => {});
    this.onSelectionChange = options.onSelectionChange || (() => {});
    this.onNoteAdded = options.onNoteAdded || (() => {});

    // Initialize
    if (options.autoInit !== false) {
      this.init();
    }
  }

  /**
   * Initialize the notation composer
   */
  init() {
    // Get composition state
    this.compositionState = getCompositionState();

    // NEW: Initialize PageLayoutManager if pagination is enabled
    if (this.config.enablePagination) {
      this.pageLayoutManager = new PageLayoutManager();
      this.layoutManager.setPageLayoutManager(this.pageLayoutManager);
    }

    // Create PageManager for multi-page rendering
    if (this.config.pageContainer) {
      this.pageManager = new PageManager(this.config.pageContainer, {
        viewMode: this.config.viewMode,
        onPageChange: (pageIndex) => this.handlePageChange(pageIndex),
      });

      // NEW: Link PageLayoutManager to PageManager
      if (this.pageLayoutManager) {
        this.pageManager.setPageLayoutManager(this.pageLayoutManager);
      }
    }

    // NEW: Create page navigator if pagination enabled and container provided
    if (this.config.enablePagination && this.config.pageNavigatorContainer) {
      this.pageNavigator = new PageNavigator({
        onPageChange: (pageIndex) => this.render(),
        onMeasuresPerPageChange: (preset) => this.handleMeasuresPerPageChange(preset),
      });
      this.pageNavigator.setPageManager(this.pageManager);
      this.pageNavigator.setPageLayoutManager(this.pageLayoutManager);
      this.pageNavigator.create(this.config.pageNavigatorContainer);
    }

    // Create toolbar if container provided
    if (this.config.toolbarContainer) {
      this.toolbar = new NotationToolbar({
        onDurationChange: () => this.render(),
        onZoomChange: (zoom) => {
          this.layoutManager.setZoom(zoom / 100);
          this.render();
        },
        onMeasuresPerLineChange: (mpl) => {
          this.config.measuresPerLine = mpl;
          this.layoutManager.setConfig({ measuresPerLine: mpl });
          this.render();
        },
        onUndo: () => this.undo(),
        onRedo: () => this.redo(),
        onDelete: () => {
          if (this.noteEditor) {
            this.noteEditor.deleteSelectedNotes();
          }
        },
        onTie: () => {
          if (this.noteEditor) {
            this.noteEditor.toggleTieOnSelected();
          }
        },
      });
      this.toolbar.create(this.config.toolbarContainer);
    }

    // Subscribe to composition state changes
    // NOTE: We do NOT listen to chordChanged - it causes cascading sync issues
    // Instead, chord update functions call window.syncNotationFromProgression() directly
    if (this.compositionState) {
      this.compositionState.events.on('noteAdded', () => {
        this.render();
      });
      this.compositionState.events.on('noteRemoved', () => {
        this.render();
      });
      this.compositionState.events.on('measureAdded', () => {
        this.render();
      });
      this.compositionState.events.on('measureRemoved', () => {
        this.render();
      });
      // When bass is updated by compositionState directly, re-render
      this.compositionState.events.on('bassUpdated', () => {
        this.render();
      });
    }

    // Expose a single sync function that chord updates should call
    // This replaces the automatic chordChanged event listener
    window.syncNotationFromProgression = () => {
      // DEPRECATION WARNING: This function rebuilds the entire notation from scratch
      // and will wipe out user-added treble notes!
      console.warn(
        '[DEPRECATED] window.syncNotationFromProgression() is deprecated for chord modifications.\n' +
        'This function rebuilds ALL notation from scratch and WIPES user-added treble notes.\n' +
        'For chord updates, use: window.updateChordNotation(measureIndex)\n' +
        'For full rebuilds only, use: window.fullRebuildNotation()\n' +
        'Stack trace:', new Error().stack
      );

      if (this.isHandlingSync) {
        return;
      }

      // CRITICAL: Set sync flag BEFORE calling syncProgressionToMelodyComposer
      // to block renders triggered by that function
      this.isSyncingFromProgression = true;
      this.isHandlingSync = true;

      try {
        // Step 1: Sync progressionData → compositionState
        if (window.syncProgressionToMelodyComposer) {
          window.syncProgressionToMelodyComposer();
        }
        // Step 2: Sync compositionState → display
        this.syncFromProgression();
      } finally {
        this.isHandlingSync = false;
        // Note: isSyncingFromProgression is reset in syncFromProgression with a delay
      }
    };

    // Listen for chord tone highlighting changes
    document.addEventListener('chord-tone-highlighting-changed', (e) => {
      const enabled = e.detail?.enabled !== false;
      this.config.enableHarmonicColoring = enabled;
      this.render();
    });

    // Listen for window resize to update layout
    let resizeTimeout;
    window.addEventListener('resize', () => {
      // Debounce resize events
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.layoutManager.invalidate();
        this.render();
      }, 100);
    });

    // Set up canvas event listeners
    if (this.config.container) {
      this.setupCanvasEvents();
    }

    // Set up bi-directional sync with chord progression cards
    this.setupProgressionSync();

    // Export methods to window for external access
    this.exportToWindow();
  }

  /**
   * Handle page change event
   * @param {number} pageIndex - New page index
   */
  handlePageChange(pageIndex) {
    // Update layout manager's current page
    if (this.layoutManager) {
      this.layoutManager.setCurrentPageIndex(pageIndex);
    }

    // Update page navigator display
    if (this.pageNavigator) {
      this.pageNavigator.updateDisplay();
    }

    // Clear any ghost notes (they may be on the old page)
    if (this.noteEditor) {
      this.noteEditor.ghostNote = null;
    }

    // Re-render to show the new page
    this.render();
  }

  /**
   * Handle measures per page change
   * @param {string} preset - Preset name ('8_MEASURES' or '16_MEASURES')
   */
  handleMeasuresPerPageChange(preset) {
    // Apply the preset to page config
    applyPaginationPreset(preset);

    // Recalculate page layout
    if (this.pageLayoutManager && this.compositionState) {
      const totalMeasures = this.compositionState.getMeasureCount();
      this.pageLayoutManager.calculatePageLayout(totalMeasures);
    }

    // Update page manager to create/remove pages as needed
    if (this.pageManager) {
      // Reset to first page when changing layout
      this.pageManager.goToPage(0);
    }

    // Re-render with new layout
    this.render();
  }

  /**
   * Set up bi-directional sync with chord progression cards
   */
  setupProgressionSync() {
    // Listen for chord progression card clicks
    if (typeof window !== 'undefined') {
      window.addEventListener('chordCardSelected', (e) => {
        const { index } = e.detail || {};
        if (typeof index === 'number' && index !== this.selectedMeasureIndex) {
          this.selectedMeasureIndex = index;
          this.render();
        }
      });
    }
  }

  /**
   * Export methods to window for external access
   */
  exportToWindow() {
    if (typeof window !== 'undefined') {
      const self = this;

      // Expose setSelectedMeasure for external calls
      window.setNotationSelectedMeasure = (index) => self.setSelectedMeasure(index);
      window.getNotationSelectedMeasure = () => self.getSelectedMeasure();

      // Expose playback highlighting methods
      window.setNotationActiveMeasure = (index) => self.setActiveMeasure(index);
      window.getNotationActiveMeasure = () => self.getActiveMeasure();
      window.addNotationActiveNote = (noteId) => self.addActiveNote(noteId);
      window.removeNotationActiveNote = (noteId) => self.removeActiveNote(noteId);
      window.clearNotationActiveNotes = () => self.clearActiveNotes();
      window.stopNotationPlaybackHighlighting = () => self.stopPlaybackHighlighting();

      // Expose toolbar state for melody suggestions
      window.getCurrentNoteDuration = () => self.toolbar ? self.toolbar.getState().duration : '4n';
      window.getCurrentNoteDotted = () => self.toolbar ? self.toolbar.getState().dotted : false;
      window.getCurrentNoteAccidental = () => self.toolbar ? self.toolbar.getState().accidental : null;
      window.getCurrentNoteIsRest = () => self.toolbar ? self.toolbar.getState().isRest : false;
    }
  }

  // ============================================================================
  // DATA CONVERSION
  // ============================================================================

  /**
   * Convert CompositionState measures to grand staff format
   * @returns {Array} - Array of measure data for rendering
   */
  convertMeasuresToGrandStaff() {
    if (!this.compositionState) {
      return [];
    }

    const measures = [];
    const measureCount = this.compositionState.getMeasureCount();

    for (let i = 0; i < measureCount; i++) {
      const measure = this.compositionState.getMeasure(i);
      if (!measure) continue;

      const measureData = {
        trebleNotes: [],
        bassNotes: [],
        chordSymbol: null,
        measureNumber: i + 1,
        // Include chord object for harmonic analysis
        chord: measure.chord ? {
          root: measure.chord.root,
          type: measure.chord.type,
          notes: measure.chord.notes,
        } : null,
      };

      // Convert treble clef notes from notation voices
      const trebleVoices = measure.notation.treble.voices;
      if (trebleVoices && trebleVoices[0] && trebleVoices[0].notes.length > 0) {
        measureData.trebleNotes = trebleVoices[0].notes
          .filter(note => {
            // Keep rests
            if (note.isRest) return true;
            // For non-rests, require valid pitch or pitches array
            if (note.pitches && Array.isArray(note.pitches) && note.pitches.length > 0) return true;
            if (note.pitch && typeof note.pitch === 'string' && note.pitch.match(/^[A-G][#b]?\d+$/)) return true;
            // Filter out notes with null/undefined pitch
            return false;
          })
          .map(note => ({
            pitch: note.pitch,
            pitches: note.pitches,
            duration: note.duration || '4n',
            isRest: note.isRest || false,
            dotted: note.dotted || false,
            accidental: note.accidental || null,
          }));
      }
      // NOTE: Fallback to interactiveMelody.melodyNotes REMOVED
      // This was causing deleted notes to reappear because keyboard recording
      // adds to both interactiveMelody.melodyNotes (legacy) and compositionState (new).
      // Now we ONLY read from compositionState to ensure consistent behavior between
      // Alt+Click and keyboard recording.
      // The interactiveMelody.melodyNotes array is still used for playback and other
      // legacy features, but NOT for rendering.

      // Convert bass clef notes from notation voices
      const bassVoices = measure.notation.bass.voices;
      if (bassVoices && bassVoices[0] && bassVoices[0].notes.length > 0) {
        console.log(`[composerIntegration OLD PATH] Measure ${i} bass notes:`, bassVoices[0].notes.map(n => ({ beat: n.beat, isTied: n.isTied })));
        measureData.bassNotes = bassVoices[0].notes.map(note => {
          // Handle both single notes and chords
          if (note.pitches && Array.isArray(note.pitches)) {
            return {
              pitches: note.pitches,
              duration: note.duration || '1n',
              beat: note.beat || 0,
              dotted: note.dotted || false,
              isTied: note.isTied,  // CRITICAL: Preserve isTied for cross-measure ties
            };
          }
          return {
            pitch: note.pitch,
            duration: note.duration || '1n',
            beat: note.beat || 0,
            isRest: note.isRest || false,
            dotted: note.dotted || false,
            isTied: note.isTied,  // CRITICAL: Preserve isTied for cross-measure ties
          };
        });
      }

      // If notation voices are empty but chord data exists, use chord notes
      // Chord progression notes go in bass clef (left hand accompaniment)
      // Treble clef is reserved for melody
      if (measureData.trebleNotes.length === 0 && measureData.bassNotes.length === 0) {
        if (measure.chord && measure.chord.notes && measure.chord.notes.length > 0) {
          // All chord notes go to bass clef
          // If notes are very high, they'll still display correctly with ledger lines
          const chordNotes = [...measure.chord.notes];

          measureData.bassNotes.push({
            pitches: chordNotes,
            duration: '1n',
          });
        }
      }

      // Add chord symbol if available
      if (measure.chord && measure.chord.root) {
        const typeSuffix = this.getChordTypeSuffix(measure.chord.type);
        measureData.chordSymbol = measure.chord.root + typeSuffix;
      }

      measures.push(measureData);
    }

    return measures;
  }

  /**
   * Get chord type suffix for display
   * @param {string} chordType - Chord type name
   * @returns {string} - Suffix for chord symbol
   */
  getChordTypeSuffix(chordType) {
    if (!chordType) return '';

    const suffixes = {
      // Basic triads
      'Major': '',
      'Minor': 'm',
      'Diminished': 'dim',
      'Augmented': 'aug',
      'Power Chord': '5',

      // Suspended chords (all variants)
      'Suspended 2nd': 'sus2',
      'Suspended 4th': 'sus4',
      'Suspended 2': 'sus2',
      'Suspended 4': 'sus4',
      'Sus2': 'sus2',
      'Sus4': 'sus4',

      // Seventh chords
      'Dominant 7th': '7',
      'Major 7th': 'maj7',
      'Minor 7th': 'm7',
      'Half-Diminished 7th': 'm7b5',
      'Diminished 7th': 'dim7',
      'Minor-Major 7th': 'mMaj7',

      // Ninth chords
      'Add9': 'add9',
      'Add 9': 'add9',
      'Minor 9th': 'm9',
      'Minor 9': 'm9',
      'Major 9th': 'maj9',
      'Major 9': 'maj9',
      'Dominant 9th': '9',
      'Dominant 9': '9',
      '6/9': '6/9',

      // Extended chords
      'Minor 11th': 'm11',
      'Minor 11': 'm11',
      'Dominant 11th': '11',
      'Dominant 11': '11',
      'Minor 13th': 'm13',
      'Minor 13': 'm13',
      'Dominant 13th': '13',
      'Dominant 13': '13',
    };

    return suffixes[chordType] || '';
  }

  /**
   * Sync from progression data
   * IMPORTANT: This method now reads from compositionState (which is the single source of truth)
   * and prepares data for rendering. It does NOT modify compositionState - that's done by
   * syncWithProgressionData() which properly handles variable chord durations.
   */
  syncFromProgression() {
    // Cancel any pending render since we're doing a full sync
    if (this.pendingRenderFrame) {
      cancelAnimationFrame(this.pendingRenderFrame);
      this.pendingRenderFrame = null;
    }

    try {
      const progressionData = getProgressionData();
      const currentKey = getCurrentKey();

      if (!progressionData || progressionData.length === 0) {
        // Reset flag before rendering empty state
        this.isSyncingFromProgression = false;
        // Render empty state instead of just returning
        this.renderEmptyState();
        return;
      }

      // compositionState.syncWithProgressionData() properly creates measures
      // from chords with variable durations. A single chord can span multiple
      // measures. We must iterate over measures, not chords!

      if (!this.compositionState) {
        this.isSyncingFromProgression = false;
        return;
      }

      const measureCount = this.compositionState.getMeasureCount();

      // Clear measure manager and rebuild from compositionState measures
      this.measureManager.measures = [];

      for (let measureIndex = 0; measureIndex < measureCount; measureIndex++) {
        const stateMeasure = this.compositionState.getMeasure(measureIndex);
        if (!stateMeasure) {
          continue;
        }

        const chord = stateMeasure.chord || {};

        // Generate chord symbol from chord data
        let chordSymbol = null;
        if (chord.root) {
          const typeSuffix = this.getChordTypeSuffix(chord.type);
          chordSymbol = chord.root + typeSuffix;
        }

        const measureData = {
          trebleNotes: [],
          bassNotes: [],
          keySignature: currentKey,
          timeSignature: '4/4',
          chord: {
            root: chord.root,
            type: chord.type,
            notes: chord.notes,
          },
          // Auto-populate chord symbol from chord card data
          metadata: chordSymbol ? { chordSymbol } : null,
          isAutoGeneratedBass: stateMeasure.notation?.bass?.autoGenerated || false,
        };

        // Get bass notes from compositionState
        const bassVoices = stateMeasure.notation?.bass?.voices;
        if (bassVoices && bassVoices[0]) {
          const bassNotes = bassVoices[0].notes || [];

          if (bassNotes.length > 0) {
            console.log(`[syncFromProgression] Measure ${measureIndex} bass notes from compositionState:`, bassNotes.map(n => `dur=${n.duration}, tied=${n.isTied}, pitches=${n.pitches?.length || 0}`).join('; '));
            measureData.bassNotes = bassNotes.map(note => ({
              pitch: note.pitch,
              pitches: note.pitches,
              duration: note.duration || '4n',
              beat: note.beat || 0,
              isRest: note.isRest || note.type === 'rest',
              dotted: note.dotted || false,
              tie: note.tie,
              isTied: note.isTied
            }));
          }
        }

        // Get treble notes from compositionState
        const trebleVoices = stateMeasure.notation?.treble?.voices;
        if (trebleVoices && trebleVoices[0]) {
          const trebleNotes = trebleVoices[0].notes || [];
          if (trebleNotes.length > 0) {
            measureData.trebleNotes = trebleNotes.map(note => ({
              pitch: note.pitch,
              pitches: note.pitches,
              duration: note.duration || '4n',
              beat: note.beat || 0,
              isRest: note.isRest || note.type === 'rest',
              dotted: note.dotted || false,
              tie: note.tie,
              tied: note.tied,
              isTied: note.isTied
            }));
          }
        }

        // Add measure to manager
        this.measureManager.measures.push(measureData);
      }

      // Now render using the correctly built measures
      this.render(true);
    } catch (error) {
      console.error('[syncFromProgression] Error:', error);
    } finally {
      // Reset sync flag with delay to allow event propagation
      setTimeout(() => {
        this.isSyncingFromProgression = false;
      }, 50);
    }
  }


  // ============================================================================
  // RENDERING
  // ============================================================================

  /**
   * Render the notation
   * Immediately renders but uses debouncing to prevent excessive renders
   * @param {boolean} bypassSyncCheck - If true, skip the sync-in-progress check (internal use only)
   */
  render(bypassSyncCheck = false) {
    if (!this.config.container) {
      return;
    }

    // CRITICAL: Block ALL renders while sync is in progress
    // This prevents event-driven renders from catching partial state (e.g., 1 measure instead of 4)
    // Exception: Allow final sync render to bypass this check
    if (this.isSyncingFromProgression && !bypassSyncCheck) {
      return;
    }

    // CRITICAL: Bypass renders (final sync render) skip debouncing to execute immediately
    if (bypassSyncCheck) {
      this.lastRenderTime = Date.now();
      this.performRender();
      return;
    }

    // Debounce rapid renders using a timestamp check
    const now = Date.now();
    if (this.lastRenderTime && (now - this.lastRenderTime) < 16) { // ~60fps limit
      // Too soon since last render, schedule for next frame
      if (this.pendingRenderFrame) {
        cancelAnimationFrame(this.pendingRenderFrame);
      }
      this.pendingRenderFrame = requestAnimationFrame(() => {
        this.pendingRenderFrame = null;
        this.render(bypassSyncCheck); // Preserve bypass flag through debouncing
      });
      return;
    }

    this.lastRenderTime = now;
    this.performRender();
  }

  /**
   * Actually perform the rendering
   */
  performRender() {
    // Check if container is still in the DOM
    const isInDOM = document.body.contains(this.config.container);

    if (!isInDOM) {
      const newContainer = document.getElementById(this.config.container.id);
      if (newContainer) {
        this.config.container = newContainer;
      } else {
        return;
      }
    }

    // Get measures to render from compositionState (single source of truth)
    // Convert from compositionState format to renderGrandStaffSystem format
    const hasCompositionState = this.compositionState && this.compositionState.measures.length > 0;

    const measures = hasCompositionState
      ? this.compositionState.measures.map(m => ({
          trebleNotes: m.notation.treble.voices[0].notes
            .map(note => {
              return {
                pitch: note.pitch,
                pitches: note.pitches,
                duration: note.duration || '4n',
                dotted: note.dotted || false,
                accidental: note.accidental || null,
                beat: note.beat || 0,
                tie: note.tie,  // CRITICAL: Preserve tie property for cross-measure notes
                tied: note.tied,  // CRITICAL: For same-measure ties
                isTied: note.isTied,  // CRITICAL: For cross-measure ties (continuation notes)
                articulation: note.articulation || null,  // CRITICAL: Articulations (staccato, accent, etc.)
                velocity: note.velocity,
                isChordTone: note.isChordTone,
                isRest: note.isRest || note.type === 'rest'  // CRITICAL: Include rests
              };
            }),
          bassNotes: m.notation.bass.voices[0].notes
            .map(note => ({
              pitch: note.pitch,
              pitches: note.pitches,
              duration: note.duration || '4n',
              dotted: note.dotted || false,
              accidental: note.accidental || null,
              beat: note.beat || 0,
              tie: note.tie,
              tied: note.tied,  // CRITICAL: For same-measure ties
              isTied: note.isTied,  // CRITICAL: For cross-measure ties
              articulation: note.articulation || null,  // CRITICAL: Articulations
              velocity: note.velocity,
              isChordTone: note.isChordTone,
              isRest: note.isRest || note.type === 'rest'  // CRITICAL: Include rests
            })),
          keySignature: m.keySignature || this.compositionState.metadata.key,
          timeSignature: m.timeSignature
            ? `${m.timeSignature.num}/${m.timeSignature.denom}`
            : '4/4',
          chord: m.chord,
          isAutoGeneratedMelody: m.notation.treble.autoGenerated || false,
          isAutoGeneratedBass: m.notation.bass.autoGenerated || false,
          // Auto-populate chord symbol from chord card data if not already set
          metadata: m.metadata?.chordSymbol
            ? m.metadata
            : (m.chord?.root
              ? { ...m.metadata, chordSymbol: m.chord.root + this.getChordTypeSuffix(m.chord.type) }
              : m.metadata),
        }))
      : []; // compositionState is now required - no fallback

    if (measures.length === 0) {
      // Render empty state
      this.renderEmptyState();
      return;
    }

    // NOTE: Fallback to populate from interactiveMelody.melodyNotes REMOVED
    // This was causing deleted notes to reappear because keyboard recording
    // adds to both interactiveMelody.melodyNotes (legacy) and compositionState (new).
    // Now we ONLY read from compositionState to ensure consistent behavior between
    // Alt+Click and keyboard recording.
    // The interactiveMelody.melodyNotes array is still used for playback and other
    // legacy features, but NOT for rendering.

    // Get key signature
    const key = this.compositionState
      ? this.compositionState.metadata.key
      : getCurrentKey() || 'C';

    // Get time signature
    const timeSig = this.compositionState
      ? `${this.compositionState.metadata.timeSignature.num}/${this.compositionState.metadata.timeSignature.denom}`
      : '4/4';

    // Calculate layout
    this.layoutManager.calculateLayout(measures.length, {
      keySignature: key,
      timeSignature: timeSig,
    });

    // Render using PageManager (multi-page) or legacy single canvas
    if (this.pageManager) {
      // MULTI-PAGE RENDERING
      this.renderedSystem = this.renderToPages(measures, key, timeSig);
    } else {
      // LEGACY SINGLE CANVAS RENDERING
      const compositionState = getCompositionState();
      const settings = compositionState ? compositionState.getSettings() : {};
      const showChordSpans = settings.showChordSpans !== false; // Default to true

      this.renderedSystem = renderGrandStaffSystem(this.config.container, measures, {
        measuresPerLine: this.config.measuresPerLine,
        keySignature: key,
        timeSignature: timeSig,
        showMeasureNumbers: this.config.showMeasureNumbers,
        // Highlighting options
        selectedMeasureIndex: this.selectedMeasureIndex,
        activeMeasureIndex: this.activeMeasureIndex,
        activeNotes: this.activeNotes,
        enableHarmonicColoring: this.config.enableHarmonicColoring,
        // Chord span settings
        showChordSpans: showChordSpans,
      });
    }

    // CRITICAL: Update layout manager with ACTUAL VexFlow positions (nuclear solution)
    // This eliminates coordinate mismatch by using real positions instead of calculations
    if (this.renderedSystem && this.renderedSystem.measures) {
      // In pagination mode, we need to be careful - only the current page's measures have valid positions
      // Clear old positions first, then set only current page measures
      if (this.config.enablePagination && this.pageLayoutManager) {
        // Clear all positions first
        this.layoutManager.actualMeasurePositions.clear();
      }
      this.layoutManager.setActualMeasurePositions(this.renderedSystem.measures);
    }

    // Store note regions for tooltip detection
    if (this.renderedSystem && this.renderedSystem.noteRegions) {
      this.noteRegions = this.renderedSystem.noteRegions;
    } else {
      this.noteRegions = [];
    }

    // Store chord bracket regions for click handling
    if (this.renderedSystem && this.renderedSystem.chordBracketRegions) {
      this.chordBracketRegions = this.renderedSystem.chordBracketRegions;
    } else {
      this.chordBracketRegions = [];
    }

    // Apply harmonic coloring if enabled
    if (this.config.enableHarmonicColoring) {
      this.applyHarmonicColoring();
    }

    // Update toolbar state
    if (this.toolbar) {
      this.toolbar.setUndoRedoState(
        false, // undo no longer supported via measureManager
        false  // redo no longer supported via measureManager
      );
    }

    // Force browser repaint by triggering a reflow
    // This ensures the canvas actually displays the new rendering
    if (this.config.container) {
      void this.config.container.offsetHeight;
      // Also force a style recalculation
      const canvas = this.config.container;
      const computedStyle = window.getComputedStyle(canvas);
      void computedStyle.width; // Force style computation
      // Trigger paint by modifying and restoring a property
      canvas.style.transform = 'translateZ(0)';
      setTimeout(() => {
        canvas.style.transform = '';
      }, 0);
    }

    // PHASE 1A/1B: Draw ghost note after VexFlow rendering
    if (this.noteEditor && this.noteEditor.ghostNote) {
      if (this.pageManager) {
        // Multi-page: Draw on the page containing the ghost note's measure
        const measureIndex = this.noteEditor.ghostNote.measure?.index;
        if (measureIndex !== undefined) {
          const page = this.pageManager.getPageForMeasure(measureIndex);
          if (page) {
            const ctx = page.canvas.getContext('2d');
            this.noteEditor.drawGhostNote(ctx);
          }
        }
      } else {
        // Legacy single canvas
        const ctx = this.config.container.getContext('2d');
        this.noteEditor.drawGhostNote(ctx);
      }
    }

    // PHASE 1.3: Draw selection highlights after VexFlow rendering
    if (this.noteEditor && this.noteEditor.selectedNotes && this.noteEditor.selectedNotes.size > 0) {
      if (this.pageManager) {
        // Multi-page: Draw selection highlights on all pages that contain selected notes
        this.noteEditor.drawSelectionHighlightsMultiPage(this.pageManager);
      } else {
        // Legacy single canvas
        const ctx = this.config.container.getContext('2d');
        this.noteEditor.drawSelectionHighlights(ctx);
      }
    }

    // PHASE 1.6: Draw hover toolbar (Shift+hover over selected notes)
    if (this.noteEditor && this.noteEditor.hoverToolbar) {
      if (this.pageManager) {
        // Multi-page: Draw toolbar on the first selected note's page
        if (this.noteEditor.selectedNotes.size > 0) {
          const firstNoteId = Array.from(this.noteEditor.selectedNotes)[0];
          const [measureIndex] = this.noteEditor.parseNoteId(firstNoteId);
          const page = this.pageManager.getPageForMeasure(measureIndex);
          if (page) {
            const ctx = page.canvas.getContext('2d');
            this.noteEditor.drawHoverToolbar(ctx);
          }
        }
      } else {
        // Legacy single canvas
        const ctx = this.config.container.getContext('2d');
        this.noteEditor.drawHoverToolbar(ctx);
      }
    }

    // Notify listeners
    this.onUpdate();
  }

  /**
   * Render empty state
   */
  renderEmptyState() {
    const container = this.config.container;
    if (!container) return;

    // Clear and show message
    if (container.tagName === 'CANVAS') {
      const ctx = container.getContext('2d');
      container.width = 800;
      container.height = 200;
      ctx.clearRect(0, 0, container.width, container.height);
      ctx.font = '16px Arial';
      ctx.fillStyle = '#888';
      ctx.textAlign = 'center';
      ctx.fillText(
        'No measures to display. Add chords in Progression Builder or click to add notes.',
        container.width / 2,
        container.height / 2
      );
    }
  }

  /**
   * Render measures to multiple pages
   * @param {Array} measures - All measures to render
   * @param {string} key - Key signature
   * @param {string} timeSig - Time signature
   * @returns {Object} - Rendered system data
   */
  renderToPages(measures, key, timeSig) {
    // NEW: If pagination is enabled, use PageLayoutManager
    if (this.config.enablePagination && this.pageLayoutManager) {
      return this.renderWithPagination(measures, key, timeSig);
    }

    // LEGACY: Original multi-page rendering (renders all pages)
    // Clear all existing pages
    this.pageManager.clearAllPages();

    // Get settings for chord spans
    const compositionState = getCompositionState();
    const settings = compositionState ? compositionState.getSettings() : {};

    // Group measures by page (8 measures per page)
    const measuresPerPage = PAGE_CONFIG.measuresPerPage;
    const allRenderedMeasures = [];
    const allNoteRegions = [];
    const allChordBracketRegions = [];

    for (let pageIndex = 0; pageIndex * measuresPerPage < measures.length; pageIndex++) {
      const startMeasure = pageIndex * measuresPerPage;
      const endMeasure = Math.min(startMeasure + measuresPerPage, measures.length);
      const pageMeasures = measures.slice(startMeasure, endMeasure);

      // Get page canvas
      const page = this.pageManager.getPageForMeasure(startMeasure);

      // Render this page's measures
      const renderedPage = renderGrandStaffSystem(page.canvas, pageMeasures, {
        measuresPerLine: this.config.measuresPerLine,
        keySignature: key,
        timeSignature: timeSig,
        showMeasureNumbers: this.config.showMeasureNumbers,
        startMeasureNumber: startMeasure + 1, // Measure numbers are 1-based
        // Highlighting options
        selectedMeasureIndex: this.selectedMeasureIndex - startMeasure, // Adjust for page offset
        activeMeasureIndex: this.activeMeasureIndex - startMeasure, // Adjust for page offset
        activeNotes: this.activeNotes,
        enableHarmonicColoring: this.config.enableHarmonicColoring,
        // Chord span settings
        showChordSpans: settings.showChordSpans !== false, // Default to true
      });

      // Collect rendered measures (adjust indices back to global)
      if (renderedPage && renderedPage.measures) {
        renderedPage.measures.forEach((measure, localIndex) => {
          const globalIndex = startMeasure + localIndex;
          allRenderedMeasures.push({
            ...measure,
            index: globalIndex,
            pageIndex: pageIndex,
          });

          // Register measure with page manager
          if (measure.actualBounds) {
            this.pageManager.registerMeasure(pageIndex, globalIndex, measure.actualBounds);
          }
        });
      }

      // Collect note regions (adjust indices to global)
      if (renderedPage && renderedPage.noteRegions) {
        renderedPage.noteRegions.forEach(region => {
          allNoteRegions.push({
            ...region,
            measureIndex: startMeasure + region.measureIndex,
            pageIndex: pageIndex,
          });
        });
      }

      // Collect chord bracket regions (adjust indices to global)
      if (renderedPage && renderedPage.chordBracketRegions) {
        renderedPage.chordBracketRegions.forEach(region => {
          allChordBracketRegions.push({
            ...region,
            pageIndex: pageIndex,
          });
        });
      }
    }

    // Return combined rendered system
    return {
      measures: allRenderedMeasures,
      noteRegions: allNoteRegions,
      chordBracketRegions: allChordBracketRegions,
    };
  }

  /**
   * NEW: Render with pagination system (renders only current page)
   * @param {Array} measures - All measures to render
   * @param {string} key - Key signature
   * @param {string} timeSig - Time signature
   * @returns {Object} - Rendered system data
   */
  renderWithPagination(measures, key, timeSig) {
    // Calculate page layout
    this.pageLayoutManager.calculatePageLayout(measures.length);

    // Get current page index
    let currentPageIndex = this.pageManager.getCurrentPage();

    // Ensure we have enough page canvases
    const totalPages = this.pageLayoutManager.getTotalPages();

    // CRITICAL: If current page is beyond the total pages (e.g., measures were removed),
    // navigate back to the last valid page
    if (currentPageIndex >= totalPages) {
      const newPageIndex = Math.max(0, totalPages - 1);
      this.pageManager.goToPage(newPageIndex);
      currentPageIndex = newPageIndex;
    }

    while (this.pageManager.pages.length < totalPages) {
      this.pageManager.addPage();
    }

    // Remove excess pages if we have too many
    while (this.pageManager.pages.length > totalPages) {
      const removedPage = this.pageManager.pages.pop();
      if (removedPage.canvas.parentElement) {
        removedPage.canvas.parentElement.removeChild(removedPage.canvas);
      }
    }

    // Update PageManager layout to show only current page
    this.pageManager.updateLayout();

    // Get current page data
    const currentPage = this.pageLayoutManager.getCurrentPage();
    if (!currentPage) {
      return { measures: [], noteRegions: [] };
    }

    const startMeasure = currentPage.startMeasure;
    const endMeasure = currentPage.endMeasure;
    const pageMeasures = measures.slice(startMeasure, endMeasure + 1);

    // Get page canvas
    const page = this.pageManager.getPage(currentPageIndex);
    if (!page) {
      return { measures: [], noteRegions: [] };
    }

    // Clear the current page
    this.pageManager.clearPage(currentPageIndex);

    // CRITICAL: Convert activeNotes from global measure indices to page-local indices
    // activeNotes contains IDs like "10-0-D4" (global measure 10)
    // But VexFlow needs "2-0-D4" (local measure 2 on page with startMeasure=8)
    const pageLocalActiveNotes = new Set();
    for (const noteId of this.activeNotes) {
      const parts = noteId.split('-');
      if (parts.length >= 3) {
        const globalMeasureIndex = parseInt(parts[0], 10);
        if (!isNaN(globalMeasureIndex) && globalMeasureIndex >= startMeasure && globalMeasureIndex <= endMeasure) {
          // This note is on the current page, convert to page-local index
          const localMeasureIndex = globalMeasureIndex - startMeasure;
          const pageLocalNoteId = `${localMeasureIndex}-${parts.slice(1).join('-')}`;
          pageLocalActiveNotes.add(pageLocalNoteId);
        }
      }
    }

    // Get settings for chord spans
    const compositionState = getCompositionState();
    const settings = compositionState ? compositionState.getSettings() : {};

    // Render this page's measures
    const renderedPage = renderGrandStaffSystem(page.canvas, pageMeasures, {
      measuresPerLine: this.config.measuresPerLine,
      keySignature: key,
      timeSignature: timeSig,
      showMeasureNumbers: this.config.showMeasureNumbers,
      startMeasureNumber: startMeasure + 1, // Measure numbers are 1-based
      // Highlighting options
      selectedMeasureIndex: this.selectedMeasureIndex - startMeasure, // Adjust for page offset
      activeMeasureIndex: this.activeMeasureIndex - startMeasure, // Adjust for page offset
      activeNotes: pageLocalActiveNotes, // CRITICAL: Use page-local note IDs
      enableHarmonicColoring: this.config.enableHarmonicColoring,
      // Chord span settings
      showChordSpans: settings.showChordSpans !== false, // Default to true
    });

    const allRenderedMeasures = [];
    const allNoteRegions = [];
    const allChordBracketRegions = [];

    // Collect rendered measures (adjust indices back to global)
    if (renderedPage && renderedPage.measures) {
      renderedPage.measures.forEach((measure, localIndex) => {
        const globalIndex = startMeasure + localIndex;
        allRenderedMeasures.push({
          ...measure,
          index: globalIndex,
          pageIndex: currentPageIndex,
        });

        // Register measure with page manager
        if (measure.actualBounds) {
          this.pageManager.registerMeasure(currentPageIndex, globalIndex, measure.actualBounds);
        }
      });
    }

    // Collect note regions (adjust indices to global)
    if (renderedPage && renderedPage.noteRegions) {
      renderedPage.noteRegions.forEach(region => {
        allNoteRegions.push({
          ...region,
          measureIndex: startMeasure + region.measureIndex,
          pageIndex: currentPageIndex,
        });
      });
    }

    // Collect chord bracket regions
    if (renderedPage && renderedPage.chordBracketRegions) {
      renderedPage.chordBracketRegions.forEach(region => {
        allChordBracketRegions.push({
          ...region,
          pageIndex: currentPageIndex,
        });
      });
    }

    // Update page navigator display
    if (this.pageNavigator) {
      this.pageNavigator.updateDisplay();
    }

    // CRITICAL: Re-attach event listeners to new page canvases
    if (this.noteEditor) {
      this.noteEditor.attachPageEventListeners();
    }

    // CRITICAL: Re-attach composer integration event listeners (for measure selection, hold-to-play)
    this.attachPageCanvasEvents();

    // Force browser repaint on the page canvas to ensure it displays immediately
    if (page && page.canvas) {
      void page.canvas.offsetHeight;
      const computedStyle = window.getComputedStyle(page.canvas);
      void computedStyle.width;
      page.canvas.style.transform = 'translateZ(0)';
      setTimeout(() => {
        page.canvas.style.transform = '';
      }, 0);
    }

    // Return combined rendered system
    return {
      measures: allRenderedMeasures,
      noteRegions: allNoteRegions,
      chordBracketRegions: allChordBracketRegions,
    };
  }

  /**
   * Apply harmonic tone coloring to rendered notes
   */
  applyHarmonicColoring() {
    // This will be called during playback to highlight notes
    // For static rendering, we'll apply colors based on chord context
    // Implementation will use the analyzeChordTone function
  }

  // ============================================================================
  // INTERACTION
  // ============================================================================

  /**
   * Set up canvas event listeners for interaction
   */
  setupCanvasEvents() {
    // Track for click-and-hold playback
    this.mouseDownTime = null;
    this.mouseDownMeasure = null;
    this.holdTimer = null;

    // Multi-page mode: Attach to all page canvases
    if (this.pageManager) {
      this.attachPageCanvasEvents();
      return;
    }

    // Legacy single canvas mode
    const container = this.config.container;
    if (!container) return;

    // Mousedown handler - for click-and-hold playback
    container.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));

    // Mouseup handler - for click vs hold detection
    container.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));

    // Mouse move for hover effects
    container.addEventListener('mousemove', (e) => this.handleMouseMove(e));

    // Mouse leave - cancel any pending hold
    container.addEventListener('mouseleave', () => this.handleCanvasMouseLeave());
  }

  /**
   * Attach event listeners to all page canvases (multi-page mode)
   * CRITICAL: Track actual canvas elements with WeakSet, not IDs, since canvases can be recreated
   */
  attachPageCanvasEvents() {
    if (!this.pageManager) return;

    // Initialize canvas-based tracking if not exists
    if (!this.pagesWithCanvasListeners) {
      this.pagesWithCanvasListeners = new WeakSet();
    }

    const pages = this.pageManager.getAllPages();
    pages.forEach(page => {
      // Skip if this ACTUAL CANVAS ELEMENT already has listeners attached
      if (this.pagesWithCanvasListeners.has(page.canvas)) {
        return;
      }

      // Attach listeners
      page.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
      page.canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
      page.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
      page.canvas.addEventListener('mouseleave', () => this.handleCanvasMouseLeave());

      // Mark this canvas element as having listeners
      this.pagesWithCanvasListeners.add(page.canvas);
      // Keep old Set for backwards compatibility
      this.pagesWithListeners.add(page.canvas.id);
    });
  }

  /**
   * Handle mousedown on canvas (single or multi-page)
   */
  handleCanvasMouseDown(e) {
    // Only handle if Alt is NOT held (to avoid conflict with note editor)
    if (e.altKey) return;

    // Get position - works for both single and multi-page mode
    const position = this.getPositionFromEvent(e);
    if (!position) return;

    const staffPosition = this.layoutManager.getStaffPositionAtPoint(position.x, position.y);

    if (staffPosition && staffPosition.measure) {
      this.mouseDownTime = Date.now();
      this.mouseDownMeasure = staffPosition.measure.index;

      // Start a timer - if held for 200ms, start playback
      this.holdTimer = setTimeout(() => {
        if (this.mouseDownMeasure !== null && typeof playMeasure !== 'undefined') {
          playMeasure(this.mouseDownMeasure);
        }
      }, 200);
    }
  }

  /**
   * Handle mouseup on canvas (single or multi-page)
   */
  handleCanvasMouseUp(e) {
    // Only handle if Alt is NOT held
    if (e.altKey) return;

    // Calculate how long the mouse was held
    const elapsedTime = this.mouseDownTime ? (Date.now() - this.mouseDownTime) : 0;

    // Clear hold timer if it hasn't fired yet
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }

    // If it was a quick click (< 200ms), handle as measure selection
    // If held >= 200ms, playback already started, don't select
    if (elapsedTime < 200) {
      this.handleClick(e);
    }

    this.mouseDownTime = null;
    this.mouseDownMeasure = null;
  }

  /**
   * Handle mouse leave from canvas (single or multi-page)
   */
  handleCanvasMouseLeave() {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
    this.mouseDownTime = null;
    this.mouseDownMeasure = null;
    this.handleMouseLeave();
  }

  /**
   * Get canvas position from event (works for both single and multi-page mode)
   */
  getPositionFromEvent(e) {
    // Multi-page mode
    if (this.pageManager) {
      const pageInfo = this.pageManager.getPageFromEvent(e);
      if (pageInfo) {
        return { x: pageInfo.x, y: pageInfo.y, page: pageInfo.page };
      }
      return null;
    }

    // Legacy single canvas mode
    const container = this.config.container;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  /**
   * Handle click on canvas (for measure selection only)
   * Note adding is now handled by NoteEditor (Alt+Click)
   * @param {MouseEvent} e - Mouse event
   */
  handleClick(e) {
    // Get position - works for both single and multi-page mode
    const position = this.getPositionFromEvent(e);
    if (!position) return;

    // Find what was clicked
    const staffPosition = this.layoutManager.getStaffPositionAtPoint(position.x, position.y);

    if (staffPosition && staffPosition.measure) {
      this.selectedMeasure = staffPosition.measure.index;
      this.selectedStaff = staffPosition.staff || null;

      // Update selectedMeasureIndex for highlighting (blue border)
      this.setSelectedMeasure(staffPosition.measure.index);

      this.onSelectionChange({
        measure: this.selectedMeasure,
        staff: this.selectedStaff,
        pitch: staffPosition.pitch,
      });
    }
  }

  // ============================================================================
  // SELECTION AND HIGHLIGHTING CONTROL
  // ============================================================================

  /**
   * Set the selected measure index
   * @param {number} index - Measure index (-1 for none)
   */
  setSelectedMeasure(index) {
    const prevIndex = this.selectedMeasureIndex;
    this.selectedMeasureIndex = index;

    // Fire bi-directional sync event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notationMeasureSelected', {
        detail: { measureIndex: index, previousIndex: prevIndex }
      }));

      // Also update the chord progression card highlight
      if (window.setSelectedChordIndex) {
        window.setSelectedChordIndex(index);
      }
    }

    // Re-render to show highlight
    if (prevIndex !== index) {
      this.render();
    }
  }

  /**
   * Get the selected measure index
   * @returns {number} Selected measure index
   */
  getSelectedMeasure() {
    return this.selectedMeasureIndex;
  }

  /**
   * Set the active measure for playback highlighting
   * @param {number} index - Measure index (-1 for none)
   */
  setActiveMeasure(index) {
    const prevIndex = this.activeMeasureIndex;
    this.activeMeasureIndex = index;

    // PAGINATION: Auto-navigate to the page containing the active measure
    if (this.config.enablePagination && this.pageLayoutManager && index >= 0) {
      const pageForMeasure = this.pageLayoutManager.getPageForMeasure(index);
      if (pageForMeasure && pageForMeasure.pageIndex !== this.pageManager.getCurrentPage()) {
        // Navigate to the page containing this measure
        this.pageManager.goToPage(pageForMeasure.pageIndex);
        // goToPage triggers handlePageChange which calls render(), so no need to render again
        return;
      }
    }

    // Re-render to show yellow highlight
    if (prevIndex !== index) {
      this.render();
    }
  }

  /**
   * Get the active measure index
   * @returns {number} Active measure index
   */
  getActiveMeasure() {
    return this.activeMeasureIndex;
  }

  /**
   * Add a note to the active notes set (for red highlighting during playback)
   * @param {string} noteId - Note ID in format "measureIndex-beat-pitch"
   */
  addActiveNote(noteId) {
    this.activeNotes.add(noteId);

    // PAGINATION: Navigate to page containing this note if needed
    if (this.config.enablePagination && this.pageLayoutManager && noteId) {
      // Extract measure index from noteId (format: "measureIndex-beat-pitch")
      const measureIndex = parseInt(noteId.split('-')[0], 10);
      if (!isNaN(measureIndex)) {
        const pageForMeasure = this.pageLayoutManager.getPageForMeasure(measureIndex);
        if (pageForMeasure) {
          if (pageForMeasure.pageIndex !== this.pageManager.getCurrentPage()) {
            this.pageManager.goToPage(pageForMeasure.pageIndex);
            return; // goToPage triggers render via handlePageChange
          }
        }
      }
    }

    this.render();
  }

  /**
   * Remove a note from the active notes set
   * @param {string} noteId - Note ID
   */
  removeActiveNote(noteId) {
    this.activeNotes.delete(noteId);
    this.render();
  }

  /**
   * Clear all active notes
   */
  clearActiveNotes() {
    this.activeNotes.clear();
    this.render();
  }

  /**
   * Check if a note is active
   * @param {string} noteId - Note ID
   * @returns {boolean}
   */
  isNoteActive(noteId) {
    return this.activeNotes.has(noteId);
  }

  /**
   * Stop playback highlighting (reset both active measure and notes)
   */
  stopPlaybackHighlighting() {
    this.activeMeasureIndex = -1;
    this.activeNotes.clear();
    this.render();
  }

  /**
   * Handle mouse move for hover effects
   * @param {MouseEvent} e - Mouse event
   */
  handleMouseMove(e) {
    const rect = this.config.container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if mouse is over any note region (uses actual VexFlow bounding boxes)
    let hoveredRegion = null;
    for (const region of this.noteRegions) {
      if (region.bounds) {
        const { x: rx, y: ry, width, height } = region.bounds;
        if (
          x >= rx &&
          x <= rx + width &&
          y >= ry &&
          y <= ry + height
        ) {
          hoveredRegion = region;
          break;
        }
      }
    }

    // Show tooltip if we found a note region with analysis
    if (hoveredRegion && !hoveredRegion.isRest && hoveredRegion.analysis && hoveredRegion.analysis.tooltip) {
      // Use document.body to avoid overflow clipping issues
      showNoteTooltip(document.body, hoveredRegion.analysis, e.clientX, e.clientY);
      return;
    }

    // Hide tooltip when not over a note
    hideNoteTooltip();
  }

  /**
   * Handle mouse leave
   */
  handleMouseLeave() {
    hideNoteTooltip();
  }

  /**
   * Check if a click hit a chord bracket region and handle it
   * @param {number} x - Click X coordinate
   * @param {number} y - Click Y coordinate
   * @returns {boolean} - True if a bracket was clicked
   */
  checkChordBracketClick(x, y) {
    if (!this.chordBracketRegions || this.chordBracketRegions.length === 0) {
      return false;
    }

    for (const region of this.chordBracketRegions) {
      if (x >= region.x && x <= region.x + region.width &&
          y >= region.y && y <= region.y + region.height) {
        console.log('[ComposerIntegration] Chord bracket clicked:', region);
        this.handleChordBracketClick(region);
        return true;
      }
    }
    return false;
  }

  /**
   * Handle click on a chord bracket label
   * Replaces the bass notes in that building block with the foundational chord
   * @param {Object} region - Chord bracket region data
   */
  handleChordBracketClick(region) {
    const { chordData, chordIndex, startBeat, endBeat, durationBeats } = region;

    if (!chordData || !this.compositionState) {
      console.warn('[ComposerIntegration] Cannot replace chord - missing data');
      return;
    }

    console.log('[ComposerIntegration] Replacing bass with foundational chord:', {
      chordIndex,
      chord: chordData,
      startBeat,
      endBeat,
      durationBeats,
    });

    // Call compositionState to replace bass notes with foundational chord
    this.compositionState.replaceBassWithFoundationalChord(
      chordIndex,
      startBeat,
      durationBeats,
      chordData
    );

    // Re-render to show the changes
    this.render();
  }

  // ============================================================================
  // NOTE OPERATIONS
  // ============================================================================

  /**
   * Add a note to the composition
   * @param {number} measureIndex - Measure index
   * @param {string} staff - 'treble' or 'bass'
   * @param {Object} noteData - Note data
   */
  addNote(measureIndex, staff, noteData) {
    // Update composition state if available
    if (this.compositionState) {
      // Ensure measure exists
      while (this.compositionState.getMeasureCount() <= measureIndex) {
        this.compositionState.addMeasure({});
      }

      this.compositionState.addNote(measureIndex, staff, 0, noteData);
    }

    this.onNoteAdded(measureIndex, staff, noteData);
    this.render();
  }

  /**
   * Delete selected note
   * Note: Now handled by NoteEditor directly with compositionState
   */
  deleteSelected() {
    // Deprecated - NoteEditor handles deletion directly
    console.warn('[ComposerIntegration] deleteSelected() is deprecated - use NoteEditor.deleteSelectedNotes()');
  }

  /**
   * Add a tie to selected note
   * Note: Now handled by NoteEditor directly with compositionState
   */
  addTie() {
    // Deprecated - NoteEditor handles ties directly
    console.warn('[ComposerIntegration] addTie() is deprecated - use NoteEditor.toggleTieOnSelected()');
  }

  /**
   * Undo last action
   */
  undo() {
    // Deprecated - undo/redo now managed at CompositionState level
    console.warn('[ComposerIntegration] undo() is deprecated');
  }

  /**
   * Redo last undone action
   */
  redo() {
    // Deprecated - undo/redo now managed at CompositionState level
    console.warn('[ComposerIntegration] redo() is deprecated');
  }

  // ============================================================================
  // MEASURE OPERATIONS
  // ============================================================================

  /**
   * Add a new measure
   * @param {number} index - Index to insert at (null for end)
   */
  addMeasure(index = null) {
    if (this.compositionState) {
      this.compositionState.addMeasure({});
    }
    this.render();
  }

  /**
   * Remove a measure
   * @param {number} index - Measure index
   */
  removeMeasure(index) {
    if (this.compositionState) {
      this.compositionState.removeMeasure(index);
    }
    this.render();
  }

  // ============================================================================
  // SETTINGS
  // ============================================================================

  /**
   * Update configuration
   * @param {Object} config - New configuration
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };

    if (config.measuresPerLine) {
      this.layoutManager.setConfig({ measuresPerLine: config.measuresPerLine });
    }

    this.render();
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
   * @param {number} zoom - Zoom percentage (50-200)
   */
  setZoom(zoom) {
    this.layoutManager.setZoom(zoom / 100);
    this.render();
  }

  // ============================================================================
  // EXPORT/IMPORT
  // ============================================================================

  /**
   * Export to JSON
   * @returns {string} - JSON string
   */
  toJSON() {
    // Now handled by compositionState
    return this.compositionState ? JSON.stringify(this.compositionState) : '{}';
  }

  /**
   * Import from JSON
   * @param {string} json - JSON string
   */
  fromJSON(json) {
    // Deprecated - compositionState handles serialization
    console.warn('[ComposerIntegration] fromJSON() is deprecated');
    this.render();
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Destroy the composer and clean up
   */
  destroy() {
    if (this.toolbar) {
      this.toolbar.destroy();
    }

    // Remove event listeners from canvas
    if (this.config.container) {
      this.config.container.replaceWith(this.config.container.cloneNode(true));
    }

    // Clear state
    this.compositionState = null;
    this.renderedSystem = null;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a NotationComposer instance
 * @param {Object} options - Configuration options
 * @returns {NotationComposer} - New instance
 */
export function createNotationComposer(options = {}) {
  return new NotationComposer(options);
}

// ============================================================================
// INTEGRATION HELPERS
// ============================================================================

/**
 * Initialize notation composer for the Melody Composer tab
 * @param {HTMLElement} canvasContainer - Container for the staff canvas
 * @param {HTMLElement} toolbarContainer - Container for the toolbar
 * @returns {NotationComposer} - Initialized composer
 */
export function initMelodyComposerNotation(canvasContainer, toolbarContainer) {
  const composer = new NotationComposer({
    container: canvasContainer,
    toolbarContainer: toolbarContainer,
    enableHarmonicColoring: true,
    enableMelodySuggestions: true,
  });

  // Sync from progression if available
  // Use window.syncNotationFromProgression to ensure flags are set properly
  if (window.syncNotationFromProgression) {
    window.syncNotationFromProgression();
  }

  return composer;
}

/**
 * Get harmonic analysis for a note
 * @param {string} pitch - Note pitch like "C4"
 * @param {Object} chord - Chord data
 * @param {string} key - Key signature
 * @returns {Object} - Analysis result with colors
 */
export function getHarmonicAnalysis(pitch, chord, key) {
  if (!pitch || !chord) return null;

  return analyzeChordTone(pitch, chord, key);
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  NotationComposer,
  createNotationComposer,
  initMelodyComposerNotation,
  getHarmonicAnalysis,
};
