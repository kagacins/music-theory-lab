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
import { PAGE_CONFIG, getMeasurePagePosition, applyPaginationPreset, getTotalPages, updatePageConfig } from './pageConfig.js';
import { PageLayoutManager } from './pageLayoutManager.js';
import { PageNavigator } from './pageNavigator.js';
import { initVoiceLeadingOverlay, getVoiceLeadingOverlay } from './voiceLeadingOverlay.js';
import { DEFAULT_TIME_SIGNATURE } from '../../data/music-data.js';

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
    this.voiceLeadingOverlay = null;  // Voice leading visualization overlay

    // Highlighting state
    this.selectedMeasureIndex = -1;   // Blue border for selected measure
    this.activeMeasureIndex = -1;     // Yellow background for playing measure
    this.activeNotes = new Set();     // Note IDs for red highlighting during playback

    // Playback cursor state
    this.playbackCursor = null;       // { measureIndex, beat } for vertical cursor line

    // Section view filtering state
    this.measureFilter = null;        // { startMeasure, endMeasure } for section view mode

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
          // Also update PAGE_CONFIG for pagination
          updatePageConfig({ measuresPerSystem: mpl });
          // Re-layout pages if pagination is enabled
          if (this.pageLayoutManager) {
            const measures = this.measureManager.measures || [];
            this.pageLayoutManager.layoutPages(measures.length);
          }
          this.render();
        },
        onTimeSignatureChange: (num, denom) => {
          if (this.compositionState) {
            // Check if scaling dialog is needed
            const scalingInfo = this.compositionState.getTimeSignatureScalingInfo(num, denom);

            if (scalingInfo.needsScaling) {
              // Show dialog asking user about scaling
              this.showTimeSignatureScalingDialog(num, denom, scalingInfo);
            } else {
              // No chords or same beats per measure - just change directly
              this.applyTimeSignatureChange(num, denom, false);
            }
          }
        },
        onUndo: () => {
          if (typeof window.handleUndo === 'function') {
            window.handleUndo();
          }
        },
        onRedo: () => {
          if (typeof window.handleRedo === 'function') {
            window.handleRedo();
          }
        },
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
        onTupletModeToggle: (tupletType) => {
          if (this.noteEditor) {
            if (tupletType) {
              this.noteEditor.toggleTupletInsertMode(tupletType);
            } else {
              this.noteEditor.exitTupletInsertMode();
            }
          }
        },
        onTupletCreate: (tupletType) => {
          if (this.noteEditor) {
            this.noteEditor.createTupletFromSelection(tupletType);
            // Re-trigger selection state update after tuplet creation
            this.updateToolbarSelectionState();
          }
        },
        onTupletRemove: (tupletType) => {
          if (this.noteEditor) {
            this.noteEditor.removeTupletFromSelection();
            // Re-trigger selection state update after tuplet removal
            this.updateToolbarSelectionState();
          }
        },
        onTranspose: (semitones) => {
          if (this.noteEditor) {
            this.noteEditor.transposeSelection(semitones);
          }
        },
        onTemplateInsert: (templateType) => {
          this.insertMeasureTemplate(templateType);
        },
        onVoiceChange: (voiceNumber) => {
          // Update composition state with new active voice for the current staff
          if (this.compositionState) {
            // MULTI-VOICE FIX: Set voice for BOTH staves to ensure consistency
            // This allows the user to select a voice and then click on either staff
            this.compositionState.setActiveVoiceForStaff('treble', voiceNumber);
            this.compositionState.setActiveVoiceForStaff('bass', voiceNumber);
          }
          // Update note editor with new voice number
          if (this.noteEditor) {
            this.noteEditor.setCurrentVoice(voiceNumber);
          }
          // Re-render to show voice-specific highlighting if needed
          this.render();
        },
        onRestDisplayModeChange: (settings) => {
          // Update composition state with new rest display settings
          if (this.compositionState) {
            this.compositionState.updateSettings({
              restDisplayMode: settings.restDisplayMode,
              cueRestsForSecondaryVoice: settings.cueRestsForSecondaryVoice,
              hideCueRests: settings.hideCueRests,
            });
          }
          // Re-render to apply new rest display mode
          this.render();
        },
        onVoiceLeadingToggle: (visible) => {
          // Toggle voice leading visualization overlay
          if (this.voiceLeadingOverlay) {
            this.voiceLeadingOverlay.setVisible(visible);
          } else if (visible) {
            // Initialize overlay if not exists and should be visible
            this.initVoiceLeadingOverlay();
          }
        },
      });
      this.toolbar.create(this.config.toolbarContainer);

      // Sync toolbar's initial settings (from localStorage) to compositionState
      if (this.compositionState) {
        const initialRestSettings = this.toolbar.getRestDisplaySettings();
        this.compositionState.updateSettings({
          restDisplayMode: initialRestSettings.restDisplayMode,
          cueRestsForSecondaryVoice: initialRestSettings.cueRestsForSecondaryVoice,
          hideCueRests: initialRestSettings.hideCueRests,
        });

        // Sync toolbar's time signature to match compositionState
        const ts = this.compositionState.getTimeSignature();
        this.toolbar.setTimeSignature(ts.num, ts.denom);
      }
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

      // Expose playback cursor methods for position marker
      window.setNotationPlaybackCursor = (measureIndex, beat) => self.setPlaybackCursor(measureIndex, beat);
      window.clearNotationPlaybackCursor = () => self.clearPlaybackCursor();

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

      // Convert treble clef notes from ALL notation voices
      // Multi-voice support: gather notes from each voice with voice index
      const trebleVoices = measure.notation.treble.voices;
      measureData.trebleNotes = [];

      if (trebleVoices) {
        trebleVoices.forEach((voice, voiceIndex) => {
          if (voice && voice.notes && voice.notes.length > 0) {
            const voiceNotes = voice.notes
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
                tuplet: note.tuplet || null,
                voiceIndex: voiceIndex, // Track which voice this note belongs to
                beat: note.beat || 0,   // Include beat position for proper voice alignment
              }));
            measureData.trebleNotes.push(...voiceNotes);
          }
        });
      }
      // NOTE: Fallback to interactiveMelody.melodyNotes REMOVED
      // This was causing deleted notes to reappear because keyboard recording
      // adds to both interactiveMelody.melodyNotes (legacy) and compositionState (new).
      // Now we ONLY read from compositionState to ensure consistent behavior between
      // Alt+Click and keyboard recording.
      // The interactiveMelody.melodyNotes array is still used for playback and other
      // legacy features, but NOT for rendering.

      // Convert bass clef notes from notation voices - MULTI-VOICE SUPPORT
      const bassVoices = measure.notation.bass.voices;
      if (bassVoices && bassVoices.length > 0) {
        // Gather notes from ALL voices, not just voice 0
        bassVoices.forEach((voice, voiceIndex) => {
          if (voice && voice.notes && voice.notes.length > 0) {
            const voiceNotes = voice.notes.map(note => {
              // Handle both single notes and chords
              if (note.pitches && Array.isArray(note.pitches)) {
                return {
                  pitches: note.pitches,
                  duration: note.duration || '1n',
                  beat: note.beat || 0,
                  dotted: note.dotted || false,
                  isTied: note.isTied,  // CRITICAL: Preserve isTied for cross-measure ties
                  tuplet: note.tuplet || null,
                  voiceIndex: voiceIndex,  // CRITICAL: Track voice for multi-voice rendering
                };
              }
              return {
                pitch: note.pitch,
                duration: note.duration || '1n',
                beat: note.beat || 0,
                isRest: note.isRest || false,
                dotted: note.dotted || false,
                isTied: note.isTied,  // CRITICAL: Preserve isTied for cross-measure ties
                tuplet: note.tuplet || null,
                voiceIndex: voiceIndex,  // CRITICAL: Track voice for multi-voice rendering
              };
            });
            measureData.bassNotes.push(...voiceNotes);
          }
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
      'Sus2': 'sus2',
      'Sus4': 'sus4',
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
      'Add9': 'add9',
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
  syncFromProgression(preventScroll = false) {
    // Cancel any pending render since we're doing a full sync
    if (this.pendingRenderFrame) {
      cancelAnimationFrame(this.pendingRenderFrame);
      this.pendingRenderFrame = null;
    }

    // Store preventScroll flag for use during render
    this._preventScrollDuringSync = preventScroll;

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

        // Get time signature from compositionState metadata (not hardcoded 4/4)
        const ts = this.compositionState.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE;
        const timeSignatureString = `${ts.num}/${ts.denom}`;

        const measureData = {
          trebleNotes: [],
          bassNotes: [],
          keySignature: currentKey,
          timeSignature: timeSignatureString,
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
            measureData.bassNotes = bassNotes.map(note => ({
              pitch: note.pitch,
              pitches: note.pitches,
              duration: note.duration || '4n',
              beat: note.beat || 0,
              isRest: note.isRest || note.type === 'rest',
              dotted: note.dotted || false,
              tie: note.tie,
              isTied: note.isTied,
              tuplet: note.tuplet || null
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
              isTied: note.isTied,
              tuplet: note.tuplet || null
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
        this._preventScrollDuringSync = false;
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

    // SECTION VIEW MODE: If a measure filter is active, delegate to renderFilteredMeasures
    if (this.measureFilter !== null) {
      this.renderFilteredMeasures(this.measureFilter.startMeasure, this.measureFilter.endMeasure);
      return;
    }

    // Capture scroll position BEFORE any rendering or DOM manipulation
    // This is critical to prevent page jumps during sync/refresh
    const scrollY = this._preventScrollDuringSync ? window.scrollY : null;
    const scrollX = this._preventScrollDuringSync ? window.scrollX : null;
    const canvasContainer = this.config.container ? this.config.container.parentElement : null;
    const containerScrollTop = (this._preventScrollDuringSync && canvasContainer) ? canvasContainer.scrollTop : null;
    const containerScrollLeft = (this._preventScrollDuringSync && canvasContainer) ? canvasContainer.scrollLeft : null;

    // Prevent canvas from getting focus (which causes scroll)
    if (this._preventScrollDuringSync && this.config.container) {
      const canvas = this.config.container;
      canvas.setAttribute('tabindex', '-1');
      canvas.style.outline = 'none';
      // Temporarily disable scrollIntoView
      if (!canvas._originalScrollIntoView) {
        canvas._originalScrollIntoView = canvas.scrollIntoView;
        canvas.scrollIntoView = () => {}; // No-op
      }
    }

    // Get measures to render from compositionState (single source of truth)
    // Convert from compositionState format to renderGrandStaffSystem format
    const hasCompositionState = this.compositionState && this.compositionState.measures.length > 0;

    const measures = hasCompositionState
      ? this.compositionState.measures.map(m => ({
          // Gather notes from ALL voices, not just voice 0
          trebleNotes: (m.notation.treble.voices || []).flatMap((voice, voiceIndex) =>
            (voice?.notes || []).map(note => ({
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
              isRest: note.isRest || note.type === 'rest',  // CRITICAL: Include rests
              tuplet: note.tuplet || null,  // CRITICAL: Preserve tuplet grouping for rendering
              voiceIndex: voiceIndex,  // CRITICAL: Track which voice this note belongs to
              _restDisplay: note._restDisplay,  // CRITICAL: Preserve cue/hidden rest styling for multi-voice
            }))
          ),
          // MULTI-VOICE: Gather bass notes from ALL voices, not just voice 0
          bassNotes: (m.notation.bass.voices || []).flatMap((voice, voiceIndex) =>
            (voice?.notes || []).map(note => ({
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
              isRest: note.isRest || note.type === 'rest',  // CRITICAL: Include rests
              tuplet: note.tuplet || null,  // CRITICAL: Preserve tuplet grouping
              voiceIndex: voiceIndex,  // CRITICAL: Track which voice this note belongs to
              _restDisplay: note._restDisplay,  // CRITICAL: Preserve cue/hidden rest styling for multi-voice
            }))
          ),
          keySignature: m.keySignature || this.compositionState.metadata.key,
          // CRITICAL FIX: Use compositionState's metadata time signature, not individual measure's
          // Individual measures may not have timeSignature set, but the global one is always current
          timeSignature: this.compositionState.metadata.timeSignature
            ? `${this.compositionState.metadata.timeSignature.num}/${this.compositionState.metadata.timeSignature.denom}`
            : (m.timeSignature ? `${m.timeSignature.num}/${m.timeSignature.denom}` : '4/4'),
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
        playbackCursor: this.playbackCursor,
        enableHarmonicColoring: this.config.enableHarmonicColoring,
        // Chord span settings
        showChordSpans: showChordSpans,
        // Multi-voice rest display settings
        restDisplayMode: settings.restDisplayMode || 'clean',
        cueRestsForSecondaryVoice: settings.cueRestsForSecondaryVoice !== false,
        // hideCueRests = !cueRestsForSecondaryVoice (checkbox unchecked = hide cue rests)
        hideCueRests: settings.cueRestsForSecondaryVoice === false,
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
      const canvas = this.config.container;
      
      void canvas.offsetHeight;
      // Also force a style recalculation
      const computedStyle = window.getComputedStyle(canvas);
      void computedStyle.width; // Force style computation
      // Trigger paint by modifying and restoring a property
      canvas.style.transform = 'translateZ(0)';
      
      setTimeout(() => {
        canvas.style.transform = '';
        
        // Restore scroll position if we're preventing scroll
        if (this._preventScrollDuringSync && scrollY !== null) {
          window.scrollTo(scrollX, scrollY);
          if (canvasContainer && containerScrollTop !== null) {
            canvasContainer.scrollTop = containerScrollTop;
            canvasContainer.scrollLeft = containerScrollLeft;
          }
        }
        
        // Restore scrollIntoView
        if (canvas._originalScrollIntoView) {
           canvas.scrollIntoView = canvas._originalScrollIntoView;
           delete canvas._originalScrollIntoView;
        }
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

    // Initialize voice leading overlay on first render if preference is set
    const voiceLeadingPref = localStorage.getItem('voice-leading-overlay-visible');
    if (voiceLeadingPref === 'true' && !this.voiceLeadingOverlay) {
      this.initVoiceLeadingOverlay();
    }

    // Update voice leading overlay if visible
    this.updateVoiceLeadingOverlay();

    // Update theory insights panel
    if (window.updateTheoryInsights) {
      window.updateTheoryInsights();
    }

    // Notify listeners
    this.onUpdate();
  }

  /**
   * Render empty state
   */
  renderEmptyState() {
    // Clear all pages if using multi-page rendering
    if (this.pageManager) {
      this.pageManager.clearAllPages();
    }

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
   * Render only a specific range of measures (for section view mode)
   * This allows filtering the notation to show only selected sections
   * @param {number} startMeasure - First measure to render (0-based index)
   * @param {number} endMeasure - Last measure to render (0-based index, inclusive)
   */
  renderFilteredMeasures(startMeasure, endMeasure) {

    if (!this.config.container) {
      return;
    }

    // Get measures to render from compositionState
    const hasCompositionState = this.compositionState && this.compositionState.measures.length > 0;
    if (!hasCompositionState) {
      this.renderEmptyState();
      return;
    }

    // Validate measure range
    const totalMeasures = this.compositionState.measures.length;
    const validStart = Math.max(0, Math.min(startMeasure, totalMeasures - 1));
    const validEnd = Math.max(validStart, Math.min(endMeasure, totalMeasures - 1));
    console.log('[NotationComposer] Validated range:', validStart, 'to', validEnd, '(total:', totalMeasures, ')');

    // Get the filtered measures
    const allMeasures = this.compositionState.measures.slice(validStart, validEnd + 1);

    if (allMeasures.length === 0) {
      this.renderEmptyState();
      return;
    }

    // Convert from compositionState format to renderGrandStaffSystem format
    const measures = allMeasures.map(m => ({
      trebleNotes: (m.notation.treble.voices || []).flatMap((voice, voiceIndex) =>
        (voice?.notes || []).map(note => ({
          pitch: note.pitch,
          pitches: note.pitches,
          duration: note.duration || '4n',
          dotted: note.dotted || false,
          accidental: note.accidental || null,
          beat: note.beat || 0,
          tie: note.tie,
          tied: note.tied,
          isTied: note.isTied,
          articulation: note.articulation || null,
          velocity: note.velocity,
          isChordTone: note.isChordTone,
          isRest: note.isRest || note.type === 'rest',
          tuplet: note.tuplet || null,
          voiceIndex: voiceIndex,
          _restDisplay: note._restDisplay,
        }))
      ),
      bassNotes: (m.notation.bass.voices || []).flatMap((voice, voiceIndex) =>
        (voice?.notes || []).map(note => ({
          pitch: note.pitch,
          pitches: note.pitches,
          duration: note.duration || '4n',
          dotted: note.dotted || false,
          accidental: note.accidental || null,
          beat: note.beat || 0,
          tie: note.tie,
          tied: note.tied,
          isTied: note.isTied,
          articulation: note.articulation || null,
          velocity: note.velocity,
          isChordTone: note.isChordTone,
          isRest: note.isRest || note.type === 'rest',
          tuplet: note.tuplet || null,
          voiceIndex: voiceIndex,
          _restDisplay: note._restDisplay,
        }))
      ),
      keySignature: m.keySignature || this.compositionState.metadata.key,
      // CRITICAL FIX: Use compositionState's metadata time signature, not individual measure's
      timeSignature: this.compositionState.metadata.timeSignature
        ? `${this.compositionState.metadata.timeSignature.num}/${this.compositionState.metadata.timeSignature.denom}`
        : (m.timeSignature ? `${m.timeSignature.num}/${m.timeSignature.denom}` : '4/4'),
      chord: m.chord,
      isAutoGeneratedMelody: m.notation.treble.autoGenerated || false,
      isAutoGeneratedBass: m.notation.bass.autoGenerated || false,
      metadata: m.metadata?.chordSymbol
        ? m.metadata
        : (m.chord?.root
          ? { ...m.metadata, chordSymbol: m.chord.root + this.getChordTypeSuffix(m.chord.type) }
          : m.metadata),
    }));

    // Get key and time signature
    const key = this.compositionState.metadata.key || 'C';
    const timeSig = `${this.compositionState.metadata.timeSignature?.num || 4}/${this.compositionState.metadata.timeSignature?.denom || 4}`;

    // SECTION VIEW FIX: Convert global indices to local for filtered rendering
    // selectedMeasureIndex and activeMeasureIndex are global, need to subtract offset
    const localSelectedIndex = this.selectedMeasureIndex >= validStart && this.selectedMeasureIndex <= validEnd
      ? this.selectedMeasureIndex - validStart
      : -1;
    const localActiveIndex = this.activeMeasureIndex >= validStart && this.activeMeasureIndex <= validEnd
      ? this.activeMeasureIndex - validStart
      : -1;

    // Convert activeNotes from global to local indices
    // activeNotes contains IDs like "measureIndex-beat-pitch"
    const localActiveNotes = new Set();
    for (const noteId of this.activeNotes) {
      const parts = noteId.split('-');
      if (parts.length >= 3) {
        const globalMeasureIndex = parseInt(parts[0], 10);
        if (!isNaN(globalMeasureIndex) && globalMeasureIndex >= validStart && globalMeasureIndex <= validEnd) {
          const localMeasureIndex = globalMeasureIndex - validStart;
          const localNoteId = `${localMeasureIndex}-${parts.slice(1).join('-')}`;
          localActiveNotes.add(localNoteId);
        }
      }
    }

    // Render options with measure offset for correct numbering
    const renderOptions = {
      measuresPerLine: this.config.measuresPerLine || 4,
      keySignature: key,
      timeSignature: timeSig,
      showMeasureNumbers: this.config.showMeasureNumbers ?? true,
      startMeasureNumber: validStart + 1, // 1-based display numbering
      globalMeasureOffset: validStart, // For internal calculations
      selectedMeasureIndex: localSelectedIndex,
      activeMeasureIndex: localActiveIndex,
      activeNotes: localActiveNotes,
      playbackCursor: this.playbackCursor,
      enableHarmonicColoring: this.config.enableHarmonicColoring,
      enableChordSpans: this.config.enableChordSpans,
    };

    // Use multi-page or single canvas rendering
    if (this.pageManager) {
      // Multi-page rendering with filtered measures
      // Pass highlighting overrides for section view mode
      this.renderedSystem = this.renderToPages(measures, key, timeSig, {
        selectedMeasureIndexOverride: localSelectedIndex,
        activeMeasureIndexOverride: localActiveIndex,
        activeNotesOverride: localActiveNotes,
        playbackCursorOverride: this.playbackCursor,
        globalMeasureOffset: validStart, // So renderToPages knows the offset
      });
    } else {
      // Single canvas rendering
      this.renderedSystem = renderGrandStaffSystem(this.config.container, measures, renderOptions);
    }

    // Update layout manager positions
    if (this.renderedSystem?.measures && this.layoutManager) {
      this.layoutManager.setActualMeasurePositions(this.renderedSystem.measures);
    }

    // SECTION VIEW FIX: Update noteRegions for ghost note and note selection to work
    if (this.renderedSystem && this.renderedSystem.noteRegions) {
      this.noteRegions = this.renderedSystem.noteRegions;
    } else {
      this.noteRegions = [];
    }

    // Update chord bracket regions
    if (this.renderedSystem && this.renderedSystem.chordBracketRegions) {
      this.chordBracketRegions = this.renderedSystem.chordBracketRegions;
    } else {
      this.chordBracketRegions = [];
    }

    // SECTION VIEW: Draw ghost note after VexFlow rendering (same as performRender)
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

    // SECTION VIEW: Draw selection highlights after rendering
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

    // SECTION VIEW: Draw hover toolbar (Shift+hover over selected notes)
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
   * Set measure filter for section view mode
   * When set, render() will use renderFilteredMeasures() instead of rendering all measures
   * @param {number} startMeasure - First measure to render (0-based index, this becomes the globalMeasureOffset)
   * @param {number} endMeasure - Last measure to render (0-based index, inclusive)
   */
  setMeasureFilter(startMeasure, endMeasure) {
    // Store both the range AND the offset so we can map local indices back to global
    this.measureFilter = {
      startMeasure,
      endMeasure,
      offset: startMeasure  // The first measure's global index
    };
  }

  /**
   * Clear measure filter - render() will go back to rendering all measures
   */
  clearMeasureFilter() {
    this.measureFilter = null;
  }

  /**
   * Check if a measure filter is currently active
   * @returns {boolean}
   */
  hasMeasureFilter() {
    return this.measureFilter !== null;
  }

  /**
   * Get the current measure filter offset (for mapping local to global indices)
   * @returns {number} The offset to add to local indices, or 0 if no filter
   */
  getMeasureFilterOffset() {
    return this.measureFilter?.offset || 0;
  }

  /**
   * Render measures to multiple pages
   * @param {Array} measures - All measures to render
   * @param {string} key - Key signature
   * @param {string} timeSig - Time signature
   * @returns {Object} - Rendered system data
   */
  renderToPages(measures, key, timeSig, overrideOptions = {}) {
    // NEW: If pagination is enabled, use PageLayoutManager
    if (this.config.enablePagination && this.pageLayoutManager) {
      return this.renderWithPagination(measures, key, timeSig, overrideOptions);
    }

    // LEGACY: Original multi-page rendering (renders all pages)
    // Clear all existing pages
    this.pageManager.clearAllPages();

    // Get settings for chord spans
    const compositionState = getCompositionState();
    const settings = compositionState ? compositionState.getSettings() : {};

    // SECTION VIEW FIX: Use override indices if provided (for filtered rendering)
    const useOverrideHighlighting = overrideOptions.selectedMeasureIndexOverride !== undefined;
    const baseSelectedIndex = useOverrideHighlighting
      ? overrideOptions.selectedMeasureIndexOverride
      : this.selectedMeasureIndex;
    const baseActiveIndex = useOverrideHighlighting
      ? overrideOptions.activeMeasureIndexOverride
      : this.activeMeasureIndex;
    const baseActiveNotes = useOverrideHighlighting
      ? overrideOptions.activeNotesOverride
      : this.activeNotes;
    const basePlaybackCursor = overrideOptions.playbackCursorOverride || this.playbackCursor;
    const globalOffset = overrideOptions.globalMeasureOffset || 0;

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
        startMeasureNumber: startMeasure + globalOffset + 1, // Measure numbers are 1-based, add global offset for section view
        globalMeasureOffset: startMeasure + globalOffset, // For chord bracket positioning on multi-page
        // Highlighting options - use base indices (already local) and adjust for page offset
        selectedMeasureIndex: baseSelectedIndex - startMeasure,
        activeMeasureIndex: baseActiveIndex - startMeasure,
        activeNotes: baseActiveNotes,
        // Adjust playback cursor for page offset
        playbackCursor: basePlaybackCursor && basePlaybackCursor.measureIndex >= startMeasure && basePlaybackCursor.measureIndex < endMeasure
          ? { measureIndex: basePlaybackCursor.measureIndex - startMeasure, beat: basePlaybackCursor.beat }
          : null,
        enableHarmonicColoring: this.config.enableHarmonicColoring,
        // Chord span settings
        showChordSpans: settings.showChordSpans !== false, // Default to true
        // Multi-voice rest display settings
        restDisplayMode: settings.restDisplayMode || 'clean',
        cueRestsForSecondaryVoice: settings.cueRestsForSecondaryVoice !== false,
        // hideCueRests = !cueRestsForSecondaryVoice (checkbox unchecked = hide cue rests)
        hideCueRests: settings.cueRestsForSecondaryVoice === false,
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
   * @param {Object} overrideOptions - Optional override options for section view mode
   * @returns {Object} - Rendered system data
   */
  renderWithPagination(measures, key, timeSig, overrideOptions = {}) {
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

    // SECTION VIEW FIX: Check if we have override options from filtered rendering
    const hasOverrides = overrideOptions.selectedMeasureIndexOverride !== undefined;
    const globalOffset = overrideOptions.globalMeasureOffset || 0;

    // CRITICAL: Convert activeNotes to page-local indices
    // In section view: overrideOptions.activeNotesOverride contains section-local IDs (0-7 for 8-measure section)
    // We need to convert to page-local IDs (0-3 for page 2 with startMeasure=4)
    // In normal mode: this.activeNotes contains global IDs which need conversion to page-local
    let pageLocalActiveNotes = new Set();
    if (hasOverrides && overrideOptions.activeNotesOverride) {
      // SECTION VIEW: Convert section-local note IDs to page-local note IDs
      for (const noteId of overrideOptions.activeNotesOverride) {
        const parts = noteId.split('-');
        if (parts.length >= 3) {
          const sectionLocalMeasureIndex = parseInt(parts[0], 10);
          // Check if this note is on the current page within the section
          if (!isNaN(sectionLocalMeasureIndex) && sectionLocalMeasureIndex >= startMeasure && sectionLocalMeasureIndex <= endMeasure) {
            // Convert section-local to page-local
            const pageLocalMeasureIndex = sectionLocalMeasureIndex - startMeasure;
            const pageLocalNoteId = `${pageLocalMeasureIndex}-${parts.slice(1).join('-')}`;
            pageLocalActiveNotes.add(pageLocalNoteId);
          }
        }
      }
    } else {
      // Normal mode: Convert from global to page-local
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
    }

    // SECTION VIEW FIX: Calculate highlighting indices
    // Override indices are section-local (e.g., 0-7 for an 8-measure section)
    // We need to convert to page-local (e.g., 0-3 for page 2 with startMeasure=4)
    let localSelectedIndex, localActiveIndex;
    if (hasOverrides) {
      // Section view: convert section-local to page-local by subtracting page startMeasure
      const sectionLocalSelected = overrideOptions.selectedMeasureIndexOverride;
      const sectionLocalActive = overrideOptions.activeMeasureIndexOverride;
      // Check if the selected/active measure is on this page
      localSelectedIndex = (sectionLocalSelected >= startMeasure && sectionLocalSelected <= endMeasure)
        ? sectionLocalSelected - startMeasure
        : -1;
      localActiveIndex = (sectionLocalActive >= startMeasure && sectionLocalActive <= endMeasure)
        ? sectionLocalActive - startMeasure
        : -1;
    } else {
      // Normal mode: convert global to page-local
      localSelectedIndex = this.selectedMeasureIndex - startMeasure;
      localActiveIndex = this.activeMeasureIndex - startMeasure;
    }

    // Calculate local playback cursor
    let localPlaybackCursor = null;
    const baseCursor = hasOverrides ? overrideOptions.playbackCursorOverride : this.playbackCursor;
    if (baseCursor && baseCursor.measureIndex >= startMeasure && baseCursor.measureIndex <= endMeasure) {
      localPlaybackCursor = {
        measureIndex: baseCursor.measureIndex - startMeasure,
        beat: baseCursor.beat
      };
    }

    // Get settings for chord spans
    const compositionState = getCompositionState();
    const settings = compositionState ? compositionState.getSettings() : {};

    // Calculate measure number offset for display
    // In section view mode: globalOffset is section start, startMeasure is page offset within section
    // Total offset = globalOffset + startMeasure
    const measureNumberOffset = hasOverrides ? (globalOffset + startMeasure) : startMeasure;

    // Render this page's measures
    const renderedPage = renderGrandStaffSystem(page.canvas, pageMeasures, {
      measuresPerLine: this.config.measuresPerLine,
      keySignature: key,
      timeSignature: timeSig,
      showMeasureNumbers: this.config.showMeasureNumbers,
      startMeasureNumber: measureNumberOffset + 1, // Measure numbers are 1-based
      globalMeasureOffset: measureNumberOffset, // For chord bracket positioning on multi-page
      // Highlighting options - use calculated local indices
      selectedMeasureIndex: localSelectedIndex,
      activeMeasureIndex: localActiveIndex,
      activeNotes: pageLocalActiveNotes, // CRITICAL: Use page-local note IDs
      playbackCursor: localPlaybackCursor,
      enableHarmonicColoring: this.config.enableHarmonicColoring,
      // Chord span settings
      showChordSpans: settings.showChordSpans !== false, // Default to true
      // Multi-voice rest display settings
      restDisplayMode: settings.restDisplayMode || 'clean',
      cueRestsForSecondaryVoice: settings.cueRestsForSecondaryVoice !== false,
      // hideCueRests = !cueRestsForSecondaryVoice (checkbox unchecked = hide cue rests)
      hideCueRests: settings.cueRestsForSecondaryVoice === false,
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
      // SECTION VIEW FIX: Apply filter offset to convert local index to global
      const filterOffset = this.getMeasureFilterOffset();
      this.mouseDownMeasure = staffPosition.measure.index + filterOffset;

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
      // SECTION VIEW FIX: Apply filter offset to convert local index to global
      const filterOffset = this.getMeasureFilterOffset();
      const globalMeasureIndex = staffPosition.measure.index + filterOffset;

      this.selectedMeasure = globalMeasureIndex;
      this.selectedStaff = staffPosition.staff || null;

      // Update selectedMeasureIndex for highlighting (blue border)
      this.setSelectedMeasure(globalMeasureIndex);

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
   * Insert a pattern template into the selected measure
   * @param {string} templateType - Type of template to insert
   */
  insertMeasureTemplate(templateType) {
    const measureIndex = this.selectedMeasureIndex;
    if (measureIndex < 0) {
      if (window.toast) {
        window.toast.warning('Please select a measure first');
      }
      return;
    }

    const compositionState = getCompositionState();
    if (!compositionState || !compositionState.measures[measureIndex]) {
      return;
    }

    // Save state for undo
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    // Get current chord info for the measure (for chord-based templates)
    const chord = this.getChordForMeasure(measureIndex);
    const rootNote = chord?.root || 'C';
    const octave = 4;

    // Template definitions - each returns an array of notes
    const templates = {
      'block-chord': () => {
        // Whole note chord
        const pitches = this.getChordPitches(chord, octave);
        return [{
          pitches,
          duration: '1n',
          beat: 0,
        }];
      },
      'arpeggio-up': () => {
        // Ascending arpeggio in 8th notes
        const pitches = this.getChordPitches(chord, octave);
        return pitches.map((pitch, i) => ({
          pitch,
          duration: '8n',
          beat: i * 0.5,
        }));
      },
      'arpeggio-down': () => {
        // Descending arpeggio in 8th notes
        const pitches = this.getChordPitches(chord, octave).reverse();
        return pitches.map((pitch, i) => ({
          pitch,
          duration: '8n',
          beat: i * 0.5,
        }));
      },
      'alberti-bass': () => {
        // Classic Alberti bass pattern: root-fifth-third-fifth
        const pitches = this.getChordPitches(chord, octave - 1);
        const [root, third, fifth] = pitches;
        const pattern = [root, fifth || third, third || root, fifth || third];
        return pattern.map((pitch, i) => ({
          pitch,
          duration: '8n',
          beat: i * 0.5,
        }));
      },
      'walking-bass': () => {
        // Walking bass: root-third-fifth-approach
        const pitches = this.getChordPitches(chord, octave - 1);
        const [root, third, fifth] = pitches;
        const approachNote = this.getApproachNote(root);
        const pattern = [root, third || root, fifth || third || root, approachNote];
        return pattern.map((pitch, i) => ({
          pitch,
          duration: '4n',
          beat: i,
        }));
      },
      'tremolo': () => {
        // Tremolo pattern in 16th notes
        const pitches = this.getChordPitches(chord, octave);
        const notes = [];
        for (let i = 0; i < 8; i++) {
          notes.push({
            pitches: pitches.slice(0, 2), // Use first two pitches
            duration: '16n',
            beat: i * 0.25,
          });
        }
        return notes;
      },
    };

    const templateFn = templates[templateType];
    if (!templateFn) {
      console.warn(`Unknown template type: ${templateType}`);
      return;
    }

    const notes = templateFn();

    // Get the target voice (use bass for bass patterns, treble otherwise)
    const isBassPattern = templateType === 'alberti-bass' || templateType === 'walking-bass';
    const staff = isBassPattern ? 'bass' : 'treble';
    const voiceIndex = 0;

    // Clear existing notes in the target voice for this measure
    const measure = compositionState.measures[measureIndex];
    if (measure.notation?.[staff]?.voices?.[voiceIndex]) {
      measure.notation[staff].voices[voiceIndex].notes = [];
    }

    // Insert the template notes
    for (const note of notes) {
      const noteData = {
        measureIndex,
        staff,
        voiceIndex,
        beat: note.beat,
        duration: note.duration,
        pitch: note.pitch || note.pitches?.[0],
        pitches: note.pitches,
      };

      compositionState.addNoteToMeasure(noteData);
    }

    // Mark dirty for auto-save
    if (typeof window.markAutoSaveDirty === 'function') {
      window.markAutoSaveDirty();
    }

    // Sync changes
    if (isBassPattern && compositionState.bassBlockSequence?.blocks?.length > 0) {
      compositionState.syncMeasuresToBuildingBlocks();
    } else if (compositionState.trebleBlockSequence?.blocks?.length > 0) {
      compositionState.syncMeasuresToTrebleBlock();
    }

    // Show success toast
    if (window.toast) {
      const templateNames = {
        'block-chord': 'Block Chords',
        'arpeggio-up': 'Arpeggio Up',
        'arpeggio-down': 'Arpeggio Down',
        'alberti-bass': 'Alberti Bass',
        'walking-bass': 'Walking Bass',
        'tremolo': 'Tremolo',
      };
      window.toast.success(`Inserted ${templateNames[templateType]} pattern`);
    }

    // Re-render
    this.render(true);
  }

  /**
   * Get chord information for a measure
   * @param {number} measureIndex - Measure index
   * @returns {Object|null} Chord info or null
   */
  getChordForMeasure(measureIndex) {
    const compositionState = getCompositionState();
    if (!compositionState) return null;

    const segments = compositionState.getChordSegments?.();
    if (segments) {
      // Find segment that contains this measure
      const beatsPerMeasure = compositionState.getBeatsPerMeasure?.() || 4;
      const measureStartBeat = measureIndex * beatsPerMeasure;

      for (const segment of segments) {
        if (segment.startBeat <= measureStartBeat && segment.startBeat + segment.durationBeats > measureStartBeat) {
          return segment.chord;
        }
      }
    }

    return { root: 'C', type: 'Major' };
  }

  /**
   * Get chord pitches based on chord info
   * @param {Object} chord - Chord info
   * @param {number} octave - Base octave
   * @returns {Array<string>} Array of pitch strings
   */
  getChordPitches(chord, octave) {
    if (!chord) {
      return [`C${octave}`, `E${octave}`, `G${octave}`];
    }

    const root = chord.root || 'C';
    const type = chord.type || 'Major';

    // Note intervals for different chord types
    const intervals = {
      'Major': [0, 4, 7],
      'Minor': [0, 3, 7],
      'Diminished': [0, 3, 6],
      'Augmented': [0, 4, 8],
      'Dominant 7th': [0, 4, 7, 10],
      'Major 7th': [0, 4, 7, 11],
      'Minor 7th': [0, 3, 7, 10],
    };

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const rootIndex = noteNames.indexOf(root.replace(/[#b]/g, ''));

    const chordIntervals = intervals[type] || intervals['Major'];

    return chordIntervals.map(interval => {
      let noteIndex = (rootIndex + interval) % 12;
      let noteOctave = octave + Math.floor((rootIndex + interval) / 12);
      return `${noteNames[noteIndex]}${noteOctave}`;
    });
  }

  /**
   * Get an approach note (semitone below or above the root)
   * @param {string} rootPitch - Root pitch (e.g., "C3")
   * @returns {string} Approach note pitch
   */
  getApproachNote(rootPitch) {
    const match = rootPitch.match(/^([A-G][#b]?)(\d+)$/);
    if (!match) return rootPitch;

    const [, noteName, octaveStr] = match;
    let octave = parseInt(octaveStr, 10);

    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    let noteIndex = noteNames.indexOf(noteName);
    if (noteIndex === -1) noteIndex = 0;

    // Go down one semitone for approach
    noteIndex--;
    if (noteIndex < 0) {
      noteIndex = 11;
      octave--;
    }

    return `${noteNames[noteIndex]}${octave}`;
  }

  /**
   * Set the active measure for playback highlighting
   * @param {number} index - Measure index (-1 for none)
   */
  setActiveMeasure(index) {
    const prevIndex = this.activeMeasureIndex;
    this.activeMeasureIndex = index;

    // PAGINATION: Auto-navigate to the page containing the active measure
    // Skip page navigation during playback to prevent scroll issues
    if (this.config.enablePagination && this.pageLayoutManager && index >= 0 && !window._playbackScrollLock) {
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
    this.playbackCursor = null;
    this.render();
  }

  /**
   * Set playback cursor position for visual marker
   * @param {number} measureIndex - Measure index
   * @param {number} beat - Beat position within measure (0-based, can be fractional)
   */
  setPlaybackCursor(measureIndex, beat) {
    // DISABLED: Playback cursor feature disabled due to conflicts with multiple render triggers
    // this.playbackCursor = { measureIndex, beat };
    return;

    // PAGINATION: Auto-navigate to the page containing the cursor
    if (this.config.enablePagination && this.pageLayoutManager && measureIndex >= 0) {
      const pageForMeasure = this.pageLayoutManager.getPageForMeasure(measureIndex);
      if (pageForMeasure && pageForMeasure.pageIndex !== this.pageManager.getCurrentPage()) {
        this.pageManager.goToPage(pageForMeasure.pageIndex);
        return;
      }
    }

    this.render();
  }

  /**
   * Clear the playback cursor
   */
  clearPlaybackCursor() {
    this.playbackCursor = null;
    this.render();
  }

  /**
   * Handle mouse move for hover effects
   * @param {MouseEvent} e - Mouse event
   */
  handleMouseMove(e) {
    // Use e.target (the actual canvas) for correct coordinates in multi-page mode
    const target = e.target || this.config.container;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // In multi-page mode, determine which page this event is from
    let currentPageIndex = null;
    if (this.pageManager && target.id) {
      const pages = this.pageManager.getAllPages();
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].canvas === target || pages[i].canvas.id === target.id) {
          currentPageIndex = i;
          break;
        }
      }
    }

    // Check if mouse is over any note region (uses actual VexFlow bounding boxes)
    let hoveredRegion = null;
    for (const region of this.noteRegions) {
      // In multi-page mode, only check regions from the current page
      if (currentPageIndex !== null && region.pageIndex !== undefined && region.pageIndex !== currentPageIndex) {
        continue;
      }

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

      // Respect active voice when working in either staff (voice 1 or 2)
      // MULTI-VOICE: Use staff-aware voice method for both treble and bass
      const voiceIndex = this.compositionState.getActiveVoiceIndexForStaff?.(staff) ??
        (staff === 'treble' ? this.noteEditor?.getCurrentVoiceIndex?.() : 0) ??
        0;

      const noteWithVoice = {
        ...noteData,
        voiceIndex,
      };

      this.compositionState.addNote(measureIndex, staff, voiceIndex, noteWithVoice);

      // Notify listeners with full note data (including voice info)
      this.onNoteAdded(measureIndex, staff, noteWithVoice);
    } else {
      this.onNoteAdded(measureIndex, staff, noteData);
    }

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

  /**
   * Update toolbar selection state based on currently selected notes
   * Called after operations that modify selected notes (like tuplet create/remove)
   */
  updateToolbarSelectionState() {
    if (!this.toolbar || !this.noteEditor || !this.compositionState) return;

    const selectedNoteObjects = [];
    const selectedVoices = new Set();

    for (const noteId of this.noteEditor.selectedNotes) {
      const parts = noteId.split('-');
      const measureIndex = parseInt(parts[0]);
      const staff = parts[1];
      // Note ID format: measureIndex-staff-voiceIndex-noteIndex[-pitchIndex]
      const voiceIndex = parseInt(parts[2]) || 0;
      const noteIndex = parseInt(parts[3]) || parseInt(parts[2]); // Fallback for legacy 3-part IDs

      // Track which voices are selected
      selectedVoices.add(voiceIndex);

      const measure = this.compositionState.getMeasure(measureIndex);
      if (measure) {
        // Use the correct voice index from the note ID
        const note = measure.notation[staff]?.voices[voiceIndex]?.notes[noteIndex];
        if (note) {
          selectedNoteObjects.push({
            ...note,
            measureIndex,
            staff,
            voiceIndex,
            noteIndex,
          });
        }
      }
    }

    // Update the voice selector to reflect the selected note's voice
    // Only update if all selected notes are from the same voice
    if (selectedVoices.size === 1) {
      const selectedVoice = [...selectedVoices][0];
      // Voice selector uses 1-based index (Voice 1, Voice 2), but internal is 0-based
      this.toolbar.setVoiceDisplay(selectedVoice + 1);

      // Also sync the compositionState's active voice for the selected staff
      const selectedStaffs = new Set(selectedNoteObjects.map(n => n.staff));
      if (selectedStaffs.size === 1 && this.compositionState.setActiveVoiceForStaff) {
        const staff = [...selectedStaffs][0];
        this.compositionState.setActiveVoiceForStaff(staff, selectedVoice + 1);
        this.selectedStaff = staff; // Update selectedStaff to match selection
      }
    }

    this.toolbar.updateSelectionState(selectedNoteObjects);
  }

  // ============================================================================
  // VOICE LEADING VISUALIZATION
  // ============================================================================

  /**
   * Initialize the voice leading analyzer
   * Note: This now uses a panel-based approach instead of SVG overlays
   */
  initVoiceLeadingOverlay() {
    if (this.voiceLeadingOverlay) {
      // Already initialized, just update
      this.voiceLeadingOverlay.update();
      return;
    }

    // Initialize the analyzer (new panel-based approach)
    this.voiceLeadingOverlay = initVoiceLeadingOverlay({
      container: this.config.container,
      compositionState: this.compositionState,
      onToggle: (visible) => {
        // Sync toolbar button state
        if (this.toolbar) {
          this.toolbar.setVoiceLeadingVisible(visible);
        }
      },
    });

    // The analyzer handles its own visibility based on saved preference
  }

  /**
   * Update voice leading overlay after notation changes
   */
  updateVoiceLeadingOverlay() {
    if (this.voiceLeadingOverlay && this.voiceLeadingOverlay.isVisible) {
      this.voiceLeadingOverlay.update();
    }
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
      // Also update PAGE_CONFIG for pagination
      updatePageConfig({ measuresPerSystem: config.measuresPerLine });
      // Re-layout pages if pagination is enabled
      if (this.pageLayoutManager) {
        const measures = this.measureManager.measures || [];
        this.pageLayoutManager.layoutPages(measures.length);
      }
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
  // TIME SIGNATURE CHANGE WITH SCALING OPTION
  // ============================================================================

  /**
   * Show dialog asking user whether to scale chord durations when time signature changes
   * @param {number} num - New numerator
   * @param {number} denom - New denominator
   * @param {Object} scalingInfo - Info from getTimeSignatureScalingInfo
   */
  showTimeSignatureScalingDialog(num, denom, scalingInfo) {
    // Remove any existing dialog
    const existingDialog = document.getElementById('time-signature-scaling-dialog');
    if (existingDialog) {
      existingDialog.remove();
    }

    // Generate example text based on what's changing
    const noteValueExample = scalingInfo.denominatorChanged
      ? `A whole note in ${scalingInfo.oldTimeSignature} becomes a half note in ${scalingInfo.newTimeSignature}`
      : 'Note values stay the same';

    const measureExample = scalingInfo.beatsPerMeasureChanged
      ? `A 1-measure chord stays 1 measure`
      : 'Measure count stays the same';

    // Create dialog
    const dialog = document.createElement('div');
    dialog.id = 'time-signature-scaling-dialog';
    dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    dialog.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-lg mx-4">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Time Signature Change</h3>
        <p class="text-gray-600 mb-4">
          You're changing from <strong>${scalingInfo.oldTimeSignature}</strong> to <strong>${scalingInfo.newTimeSignature}</strong>
          with <strong>${scalingInfo.chordCount} chord(s)</strong> in your progression.
        </p>
        <p class="text-gray-700 font-medium mb-4">How should chord durations be handled?</p>

        <div class="space-y-3 mb-6">
          <label class="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition ${scalingInfo.denominatorChanged ? '' : 'opacity-50'}">
            <input type="radio" name="scaling-option" value="noteValue" class="mt-1" ${scalingInfo.denominatorChanged ? 'checked' : ''}>
            <div>
              <div class="font-medium text-gray-800">Keep note values</div>
              <div class="text-sm text-gray-500">${noteValueExample}</div>
              <div class="text-xs text-blue-600 mt-1">Duration numbers adjust to match the new beat unit</div>
            </div>
          </label>

          <label class="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-300 transition">
            <input type="radio" name="scaling-option" value="measures" class="mt-1" ${!scalingInfo.denominatorChanged ? 'checked' : ''}>
            <div>
              <div class="font-medium text-gray-800">Keep measure count</div>
              <div class="text-sm text-gray-500">${measureExample}</div>
              <div class="text-xs text-green-600 mt-1">Chord spans the same number of measures</div>
            </div>
          </label>

          <label class="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition">
            <input type="radio" name="scaling-option" value="none" class="mt-1">
            <div>
              <div class="font-medium text-gray-800">Keep internal values (no scaling)</div>
              <div class="text-sm text-gray-500">Raw beat numbers stay exactly the same</div>
              <div class="text-xs text-gray-500 mt-1">May result in chords spanning partial measures</div>
            </div>
          </label>
        </div>

        <div class="flex gap-3 justify-end">
          <button class="cancel-btn px-4 py-2 text-gray-600 hover:text-gray-800 transition">Cancel</button>
          <button class="apply-btn px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">Apply</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // Handle cancel
    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
      dialog.remove();
      // Reset the toolbar dropdown to the old value
      if (this.toolbar) {
        const oldTS = this.compositionState.getTimeSignature();
        this.toolbar.setTimeSignature(oldTS.num, oldTS.denom);
      }
    });

    // Handle apply
    dialog.querySelector('.apply-btn').addEventListener('click', () => {
      const scaleOption = dialog.querySelector('input[name="scaling-option"]:checked').value;
      dialog.remove();

      let scaleFactor = 1;
      if (scaleOption === 'noteValue') {
        // Keep note values: scale by oldDenom/newDenom
        // 4/4 to 6/8: factor = 4/8 = 0.5 (whole note -> half note)
        scaleFactor = scalingInfo.scaleFactorForNoteValues;
      } else if (scaleOption === 'measures') {
        // Keep measure count: scale by newBeatsPerMeasure/oldBeatsPerMeasure
        // 4/4 to 6/8: factor = 3/4 = 0.75 (1 measure stays 1 measure)
        scaleFactor = scalingInfo.scaleFactorForMeasures;
      }
      // 'none' keeps scaleFactor = 1

      this.applyTimeSignatureChange(num, denom, scaleFactor !== 1, scaleFactor);
    });

    // Handle click outside to cancel
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
        // Reset the toolbar dropdown
        if (this.toolbar) {
          const oldTS = this.compositionState.getTimeSignature();
          this.toolbar.setTimeSignature(oldTS.num, oldTS.denom);
        }
      }
    });
  }

  /**
   * Apply time signature change with optional duration scaling
   * @param {number} num - New numerator
   * @param {number} denom - New denominator
   * @param {boolean} shouldScale - Whether to scale chord durations
   * @param {number} scaleFactor - Scale factor for durations (if shouldScale is true)
   */
  applyTimeSignatureChange(num, denom, shouldScale, scaleFactor = 1) {
    // Save state before time signature change for undo support
    if (typeof window.saveStateBeforeChange === 'function') {
      window.saveStateBeforeChange();
    }

    let scaledProgressionData = null;

    // Scale chord durations if requested (before changing time signature)
    // This updates the building blocks with new durations
    if (shouldScale && scaleFactor !== 1) {
      scaledProgressionData = this.compositionState.scaleChordDurations(scaleFactor);
    }

    // Apply the time signature change
    // This rebuilds measures for the new time signature
    this.compositionState.setTimeSignature(num, denom);

    // If we scaled durations, sync the scaled data with the NEW time signature
    // This ensures the progression data reflects both the new durations AND new time signature
    if (scaledProgressionData && scaledProgressionData.length > 0) {
      this.compositionState.syncWithProgressionData(scaledProgressionData, {
        key: this.compositionState.metadata?.key || 'C',
        timeSignature: { num, denom }
      });
    }

    this.render();

    // Update progression displays to reflect new durations
    if (window.renderProgressionDisplay) {
      window.renderProgressionDisplay('melody-progression-visualization', true);
      window.renderProgressionDisplay('melody-progression-visualization', false);
    }
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
