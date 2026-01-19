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

import { getCompositionState, getBeatsPerMeasureFromTimeSignature } from '../state/compositionState.js';
import { getProgressionData, getCurrentKey } from '../state/trainerState.js';
import { dispatchBuilderEvent } from '../ui/lessonGuidedMode.js';
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
import { getInteractiveMelody, playMeasure, setTimeSignature as setMelodyTimeSignature } from '../audio/melodyGenerator.js';
import { generateBassVoicing } from '../integration/bassAutoFill.js';
import { showNoteTooltip, hideNoteTooltip } from '../ui/noteHighlighter.js';
import { PageManager } from './pageManager.js';
import { PAGE_CONFIG, getMeasurePagePosition, applyPaginationPreset, getTotalPages, updatePageConfig } from './pageConfig.js';
import { PageLayoutManager } from './pageLayoutManager.js';
import { PageNavigator } from './pageNavigator.js';
import { initVoiceLeadingOverlay, getVoiceLeadingOverlay } from './voiceLeadingOverlay.js';
import { DEFAULT_TIME_SIGNATURE } from '../../data/music-data.js';

// ============================================================================
// CENTRALIZED NOTE PROPERTY COPYING
// ============================================================================
// CRITICAL: This is the SINGLE SOURCE OF TRUTH for note properties.
// All note-copying operations MUST use this function to avoid bugs where
// properties like articulation, dynamics, pedal, ornaments, etc. get lost
// during syncFromProgression, import, or other operations.
//
// If you add a new note property to the toolbar or notation system:
// 1. Add it to this function
// 2. It will automatically be preserved everywhere
// ============================================================================

/**
 * Copy ALL properties from a source note to a new note object.
 * This is the ONLY function that should be used when copying notes
 * between data structures (e.g., compositionState → measureManager).
 *
 * @param {Object} note - Source note object
 * @param {number} voiceIndex - Voice index for multi-voice rendering
 * @returns {Object} New note object with all properties preserved
 */
export function copyNoteWithAllProperties(note, voiceIndex = 0) {
  return {
    // Core pitch/duration properties
    pitch: note.pitch,
    pitches: note.pitches,
    duration: note.duration || '4n',
    beat: note.beat || 0,
    isRest: note.isRest || note.type === 'rest' || false,
    dotted: note.dotted || false,

    // Tie/slur properties
    tie: note.tie,
    tied: note.tied,
    isTied: note.isTied,
    slur: note.slur || null,

    // Tuplet and voice - IMPORTANT: Notes store tuplet info in THREE possible ways:
    // 1. note.tuplet (object with type, groupId, actual, normal)
    // 2. note.tupletType (flat string: 'triplet', 'quintuplet', 'sextuplet')
    // 3. note.tupletGroupId (flat string for grouping)
    // ALL THREE must be preserved for playback to work correctly!
    tuplet: note.tuplet || null,
    tupletType: note.tupletType || null,
    tupletGroupId: note.tupletGroupId || null,
    voiceIndex: voiceIndex,

    // Accidentals
    accidental: note.accidental || null,

    // ============================================
    // NOTATION TOOLBAR PROPERTIES - ALL OF THEM!
    // ============================================
    // Articulations (staccato, accent, tenuto, marcato, etc.)
    articulation: note.articulation || null,

    // Dynamics (pp, p, mp, mf, f, ff, sfz, fp, etc.)
    dynamic: note.dynamic || null,

    // Ornaments (trill, mordent, turn, etc.)
    ornament: note.ornament || null,

    // Arpeggio (rolled chord): { direction: 'up' | 'down' }
    arpeggio: note.arpeggio || null,

    // Fermata markings ('normal', 'short', 'long')
    fermata: note.fermata || null,

    // Grace notes (acciaccatura, appoggiatura)
    graceNotes: note.graceNotes || null,

    // Lyrics
    lyric: note.lyric || null,

    // Piano pedal markings ('down', 'up', 'half', 'change')
    pedal: note.pedal || null,

    // Velocity for playback
    velocity: note.velocity,

    // Chord tone analysis flag
    isChordTone: note.isChordTone,

    // Multi-voice rest display (_restDisplay: 'cue', 'hidden', etc.)
    _restDisplay: note._restDisplay,

    // Stem direction override
    stemDirection: note.stemDirection || null,

    // Manual beam control
    beam: note.beam || null,
  };
}

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
      viewMode: options.viewMode || PAGE_CONFIG.defaultViewMode, // Use PAGE_CONFIG default (continuous)
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
    this.hoveredMeasureIndex = -1;    // Track hovered measure for edit icon overlay
    this.measureEditOverlay = null;   // DOM element for measure edit icon
    this.coachIndicatorOverlay = null; // DOM element for coach insight icon
    this.measureCoachItems = new Map(); // Map<measureIndex, Array<coachItem>>
    this.chordCoachItems = new Map();   // Map<chordIndex, Array<coachItem>> for chord-based overlay
    this.chordSymbolRegions = [];       // Position data for chord symbols above staff
    this.chordLabelOverlayContainer = null; // DOM container for chord label overlays
    this._chordBadgeUpdateTimer = null; // Debounce timer for badge placement
    this.lastMouseClientX = 0;        // Track last mouse position for scroll detection
    this.lastMouseClientY = 0;
    this.overlayPositionCheckInterval = null; // Interval to check if mouse moved away during scroll

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
            this.pageLayoutManager.calculatePageLayout(measures.length);
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
        onDelete: (shiftDelete = false) => {
          if (this.noteEditor) {
            this.noteEditor.deleteSelectedNotes(shiftDelete);
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
      this.compositionState.events.on('noteAdded', (measureIndex, staff, voiceIndex, note) => {
        this.render();
        // Dispatch event for tutorial validation
        dispatchBuilderEvent('notationNoteAdded', { measureIndex, staff, voiceIndex, note });
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
        // Use measureIndex if available (correct position accounting for chord durations)
        // Fall back to index for backwards compatibility
        const { measureIndex, index } = e.detail || {};
        const targetMeasure = typeof measureIndex === 'number' ? measureIndex : index;
        if (typeof targetMeasure === 'number' && targetMeasure !== this.selectedMeasureIndex) {
          this.selectedMeasureIndex = targetMeasure;
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
        // Include chord object for harmonic analysis and playback filtering
        chord: measure.chord ? {
          root: measure.chord.root,
          type: measure.chord.type,
          notes: measure.chord.notes,
          omittedNotes: measure.chord.omittedNotes || [],
          lhType: measure.chord.lhType,
          lhInversion: measure.chord.lhInversion,
          lhOmittedNotes: measure.chord.lhOmittedNotes || [],
          lhOctaveShift: measure.chord.lhOctaveShift,
          inversion: measure.chord.inversion,
        } : null,
      };

      // Convert treble clef notes from ALL notation voices
      // Multi-voice support: gather notes from each voice with voice index
      const trebleVoices = measure.notation.treble.voices;
      measureData.trebleNotes = [];

      // CRITICAL: Uses copyNoteWithAllProperties to ensure ALL properties are preserved
      if (trebleVoices) {
        trebleVoices.forEach((voice, voiceIndex) => {
          if (voice && voice.notes && voice.notes.length > 0) {
            const voiceNotes = voice.notes
              .filter(note => {
                // Keep rests
                if (note.isRest) return true;
                // For non-rests, require valid pitch or pitches array
                // Allows double sharps (##) and double flats (bb) like F##3, Bbb4
                if (note.pitches && Array.isArray(note.pitches) && note.pitches.length > 0) return true;
                if (note.pitch && typeof note.pitch === 'string' && note.pitch.match(/^[A-G][#b]*\d+$/)) return true;
                // Filter out notes with null/undefined pitch
                return false;
              })
              .map(note => copyNoteWithAllProperties(note, voiceIndex));
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
      // CRITICAL: Uses copyNoteWithAllProperties to ensure ALL properties are preserved
      const bassVoices = measure.notation.bass.voices;
      if (bassVoices && bassVoices.length > 0) {
        // Gather notes from ALL voices, not just voice 0
        bassVoices.forEach((voice, voiceIndex) => {
          if (voice && voice.notes && voice.notes.length > 0) {
            const voiceNotes = voice.notes.map(note => copyNoteWithAllProperties(note, voiceIndex));
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
          // Filter out omitted notes so they don't render or play
          const omittedNotes = measure.chord.omittedNotes || [];
          console.log(`[composerIntegration] measure.chord.omittedNotes:`, omittedNotes);
          console.log(`[composerIntegration] measure.chord.notes:`, measure.chord.notes);
          const chordNotes = measure.chord.notes.filter(n => !omittedNotes.includes(n));
          console.log(`[composerIntegration] chordNotes after filtering:`, chordNotes);

          measureData.bassNotes.push({
            pitches: chordNotes,
            duration: '1n',
          });
        }
      }

      // Add chord symbol if available
      if (measure.chord && measure.chord.root) {
        // For intervals, use "C P4" format; for chords, use normal symbol
        if (measure.chord.selectionMode === 'interval') {
          measureData.chordSymbol = measure.chord.root + ' ' + (measure.chord.simpleName || measure.chord.type);
        } else {
          const typeSuffix = this.getChordTypeSuffix(measure.chord.type);
          measureData.chordSymbol = measure.chord.root + typeSuffix;
        }
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

      // Sixth chords
      'Major 6th': '6',
      'Minor 6th': 'm6',

      // Seventh chords
      'Dominant 7th': '7',
      'Major 7th': 'maj7',
      'Minor 7th': 'm7',
      'Half-Diminished 7th': 'm7b5',
      'Diminished 7th': 'dim7',
      'Minor-Major 7th': 'mMaj7',
      'Augmented 7th': 'aug7',

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
          // For intervals, use "C P4" format; for chords, use normal symbol
          if (chord.selectionMode === 'interval') {
            chordSymbol = chord.root + ' ' + (chord.simpleName || chord.type);
          } else {
            const typeSuffix = this.getChordTypeSuffix(chord.type);
            chordSymbol = chord.root + typeSuffix;
          }
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
            omittedNotes: chord.omittedNotes || [],
            lhType: chord.lhType,
            lhInversion: chord.lhInversion,
            lhOmittedNotes: chord.lhOmittedNotes || [],
            lhOctaveShift: chord.lhOctaveShift,
            inversion: chord.inversion,
          },
          // Auto-populate chord symbol from chord card data
          metadata: chordSymbol ? { chordSymbol } : null,
          isAutoGeneratedBass: stateMeasure.notation?.bass?.autoGenerated || false,
        };

        // Get bass notes from compositionState - ALL VOICES
        // CRITICAL: Uses copyNoteWithAllProperties to ensure ALL properties are preserved
        const bassVoices = stateMeasure.notation?.bass?.voices;
        if (bassVoices) {
          const allBassNotes = [];
          bassVoices.forEach((voice, voiceIndex) => {
            const voiceNotes = voice?.notes || [];
            voiceNotes.forEach((note, noteIndex) => {
              const copiedNote = copyNoteWithAllProperties(note, voiceIndex);
              allBassNotes.push(copiedNote);
            });
          });
          if (allBassNotes.length > 0) {
            measureData.bassNotes = allBassNotes;
          }
        }

        // Get treble notes from compositionState - ALL VOICES
        // CRITICAL: Uses copyNoteWithAllProperties to ensure ALL properties are preserved
        const trebleVoices = stateMeasure.notation?.treble?.voices;
        if (trebleVoices) {
          const allTrebleNotes = [];
          trebleVoices.forEach((voice, voiceIndex) => {
            const voiceNotes = voice?.notes || [];
            voiceNotes.forEach((note, noteIndex) => {
              const copiedNote = copyNoteWithAllProperties(note, voiceIndex);
              allTrebleNotes.push(copiedNote);
            });
          });
          if (allTrebleNotes.length > 0) {
            measureData.trebleNotes = allTrebleNotes;
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

    // DEBUG: Log special properties in compositionState.measures before rendering
    if (hasCompositionState) {
      this.compositionState.measures.forEach((m, i) => {
        const bassNotes = m.notation?.bass?.voices?.[0]?.notes || [];
        bassNotes.forEach((note, ni) => {
          if (note.pedal || note.dynamic || note.ornament || note.articulation) {
            console.log(`[RENDER DEBUG] compositionState measure ${i} bass note ${ni}:`, {
              pedal: note.pedal, dynamic: note.dynamic, ornament: note.ornament, articulation: note.articulation
            });
          }
        });
      });
    }

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
              dynamic: note.dynamic || null,  // CRITICAL: Dynamics (pp, p, mp, mf, f, ff, sfz, fp)
              velocity: note.velocity,
              isChordTone: note.isChordTone,
              isRest: note.isRest || note.type === 'rest',  // CRITICAL: Include rests
              tuplet: note.tuplet || null,  // CRITICAL: Preserve tuplet grouping for rendering
              tupletType: note.tupletType || null,  // CRITICAL: Flat tuplet type for playback
              tupletGroupId: note.tupletGroupId || null,  // CRITICAL: Tuplet group ID for playback
              voiceIndex: voiceIndex,  // CRITICAL: Track which voice this note belongs to
              _restDisplay: note._restDisplay,  // CRITICAL: Preserve cue/hidden rest styling for multi-voice
              graceNotes: note.graceNotes || null,  // Grace notes (acciaccatura, appoggiatura)
              ornament: note.ornament || null,  // Ornaments (trill, mordent, turn, etc.)
              slur: note.slur || null,  // Slur information { start: slurId, end: slurId }
              fermata: note.fermata || null,  // Fermata markings ('normal', 'short', 'long')
              stemDirection: note.stemDirection || null,  // Stem direction override
              lyric: note.lyric || null,  // Lyric syllable { text, syllabic }
              pedal: note.pedal || null,  // Pedal marking ('down', 'up', 'half', 'change')
              beam: note.beam || null,  // Manual beam control { start, end, break }
              arpeggio: note.arpeggio || null,  // Arpeggio (rolled chord) { direction: 'up' | 'down' }
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
              dynamic: note.dynamic || null,  // CRITICAL: Dynamics (pp, p, mp, mf, f, ff, sfz, fp)
              velocity: note.velocity,
              isChordTone: note.isChordTone,
              isRest: note.isRest || note.type === 'rest',  // CRITICAL: Include rests
              tuplet: note.tuplet || null,  // CRITICAL: Preserve tuplet grouping
              tupletType: note.tupletType || null,  // CRITICAL: Flat tuplet type for playback
              tupletGroupId: note.tupletGroupId || null,  // CRITICAL: Tuplet group ID for playback
              voiceIndex: voiceIndex,  // CRITICAL: Track which voice this note belongs to
              _restDisplay: note._restDisplay,  // CRITICAL: Preserve cue/hidden rest styling for multi-voice
              graceNotes: note.graceNotes || null,  // Grace notes (acciaccatura, appoggiatura)
              ornament: note.ornament || null,  // Ornaments (trill, mordent, turn, etc.)
              slur: note.slur || null,  // Slur information { start: slurId, end: slurId }
              fermata: note.fermata || null,  // Fermata markings ('normal', 'short', 'long')
              stemDirection: note.stemDirection || null,  // Stem direction override
              lyric: note.lyric || null,  // Lyric syllable { text, syllabic }
              pedal: note.pedal || null,  // Pedal marking ('down', 'up', 'half', 'change')
              beam: note.beam || null,  // Manual beam control { start, end, break }
              arpeggio: note.arpeggio || null,  // Arpeggio (rolled chord) { direction: 'up' | 'down' }
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
              ? { ...m.metadata, chordSymbol: m.chord.selectionMode === 'interval'
                  ? m.chord.root + ' ' + (m.chord.simpleName || m.chord.type)
                  : m.chord.root + this.getChordTypeSuffix(m.chord.type) }
              : m.metadata),
        }))
      : []; // compositionState is now required - no fallback

    // DEBUG: Log special properties in the mapped measures array
    measures.forEach((m, i) => {
      (m.bassNotes || []).forEach((note, ni) => {
        if (note.pedal || note.dynamic || note.ornament || note.articulation) {
          console.log(`[RENDER DEBUG] Mapped measures[${i}].bassNotes[${ni}]:`, {
            pedal: note.pedal, dynamic: note.dynamic, ornament: note.ornament, articulation: note.articulation
          });
        }
      });
    });

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

      // Check for export mode options
      const exportOpts = this.exportOptions || {};
      const isExporting = exportOpts.isExporting || false;

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
        // Chord span settings - respect export options
        showChordSpans: isExporting ? (exportOpts.includeSectionColoring !== false || exportOpts.includeBrackets !== false || exportOpts.includeChordLabels !== false) : showChordSpans,
        // Individual chord span element controls (for export)
        showChordSpanShading: isExporting ? (exportOpts.includeSectionColoring !== false) : true,
        showChordBrackets: isExporting ? (exportOpts.includeBrackets !== false) : true,
        showChordLabels: isExporting ? (exportOpts.includeChordLabels !== false) : true,
        // Multi-voice rest display settings
        restDisplayMode: settings.restDisplayMode || 'clean',
        // Phase 2 Bass Block Isolation: active block highlighting
        activeBassBlockIndex: compositionState ? compositionState.getActiveBassBlockIndex() : -1,
        chordSegments: compositionState ? compositionState.getChordSegments() : [],
        // Coach Engine highlights (for analysis feedback)
        coachHighlightIndices: compositionState ? compositionState.getCoachHighlightIndices() : [],
        // Hairpins (crescendo/decrescendo)
        hairpins: compositionState ? compositionState.hairpins : [],
        // Slurs (phrase marks)
        slurs: compositionState ? compositionState.slurs : [],
        // Tempo markings
        tempoMarkings: compositionState ? compositionState.tempoMarkings : [],
        // Repeat signs
        repeatSigns: compositionState ? compositionState.repeatSigns : [],
        // Volta brackets (1st/2nd endings)
        voltaBrackets: compositionState ? compositionState.voltaBrackets : [],
        // Export mode - hides UI hints like "Hold Alt/Option..."
        isExporting: isExporting,
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

    // Store chord symbol regions for coach overlay positioning
    // Use the LATEST rendered positions - always replace to avoid stale data
    if (this.renderedSystem && this.renderedSystem.chordSymbolRegions) {
      const newRegions = this.renderedSystem.chordSymbolRegions;
      // Only update if regions actually changed (different count or different positions)
      const regionsChanged = !this.chordSymbolRegions ||
        this.chordSymbolRegions.length !== newRegions.length ||
        newRegions.some((r, i) => {
          const old = this.chordSymbolRegions[i];
          return !old || r.x !== old.x || r.y !== old.y || r.chordIndex !== old.chordIndex;
        });

      if (regionsChanged) {
        this.chordSymbolRegions = [...newRegions];
        // Only schedule badge update if positions actually changed
        this._scheduleChordBadgeUpdate();
      }
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
          dynamic: note.dynamic || null,  // Dynamics (pp, p, mp, mf, f, ff, sfz, fp)
          velocity: note.velocity,
          isChordTone: note.isChordTone,
          isRest: note.isRest || note.type === 'rest',
          tuplet: note.tuplet || null,
          tupletType: note.tupletType || null,
          tupletGroupId: note.tupletGroupId || null,
          voiceIndex: voiceIndex,
          _restDisplay: note._restDisplay,
          graceNotes: note.graceNotes || null,  // Grace notes (acciaccatura, appoggiatura)
          ornament: note.ornament || null,  // Ornaments (trill, mordent, turn, etc.)
          slur: note.slur || null,  // Slur information { start: slurId, end: slurId }
          fermata: note.fermata || null,  // Fermata markings ('normal', 'short', 'long')
          stemDirection: note.stemDirection || null,  // Stem direction override
          lyric: note.lyric || null,  // Lyric syllable { text, syllabic }
          pedal: note.pedal || null,  // Pedal marking ('down', 'up', 'half', 'change')
          beam: note.beam || null,  // Manual beam control { start, end, break }
          arpeggio: note.arpeggio || null,  // Arpeggio (rolled chord) { direction: 'up' | 'down' }
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
          dynamic: note.dynamic || null,  // Dynamics (pp, p, mp, mf, f, ff, sfz, fp)
          velocity: note.velocity,
          isChordTone: note.isChordTone,
          isRest: note.isRest || note.type === 'rest',
          tuplet: note.tuplet || null,
          tupletType: note.tupletType || null,
          tupletGroupId: note.tupletGroupId || null,
          voiceIndex: voiceIndex,
          _restDisplay: note._restDisplay,
          graceNotes: note.graceNotes || null,  // Grace notes (acciaccatura, appoggiatura)
          ornament: note.ornament || null,  // Ornaments (trill, mordent, turn, etc.)
          slur: note.slur || null,  // Slur information { start: slurId, end: slurId }
          fermata: note.fermata || null,  // Fermata markings ('normal', 'short', 'long')
          stemDirection: note.stemDirection || null,  // Stem direction override
          lyric: note.lyric || null,  // Lyric syllable { text, syllabic }
          pedal: note.pedal || null,  // Pedal marking ('down', 'up', 'half', 'change')
          beam: note.beam || null,  // Manual beam control { start, end, break }
          arpeggio: note.arpeggio || null,  // Arpeggio (rolled chord) { direction: 'up' | 'down' }
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
          ? { ...m.metadata, chordSymbol: m.chord.selectionMode === 'interval'
              ? m.chord.root + ' ' + (m.chord.simpleName || m.chord.type)
              : m.chord.root + this.getChordTypeSuffix(m.chord.type) }
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

    // Check for export mode options
    const exportOpts = this.exportOptions || {};
    const isExporting = exportOpts.isExporting || false;

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
      // Hairpins (crescendo/decrescendo)
      hairpins: this.compositionState ? this.compositionState.hairpins : [],
      // Slurs (phrase marks)
      slurs: this.compositionState ? this.compositionState.slurs : [],
      // Tempo markings
      tempoMarkings: this.compositionState ? this.compositionState.tempoMarkings : [],
      // Export mode - hides UI hints
      isExporting: isExporting,
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

    // Update chord symbol regions for coach overlay - only if positions changed
    if (this.renderedSystem && this.renderedSystem.chordSymbolRegions) {
      const newRegions = this.renderedSystem.chordSymbolRegions;
      const regionsChanged = !this.chordSymbolRegions ||
        this.chordSymbolRegions.length !== newRegions.length ||
        newRegions.some((r, i) => {
          const old = this.chordSymbolRegions[i];
          return !old || r.x !== old.x || r.y !== old.y || r.chordIndex !== old.chordIndex;
        });

      if (regionsChanged) {
        this.chordSymbolRegions = [...newRegions];
        this._scheduleChordBadgeUpdate();
      }
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
    const allChordSymbolRegions = []; // For coach overlay positioning

    for (let pageIndex = 0; pageIndex * measuresPerPage < measures.length; pageIndex++) {
      const startMeasure = pageIndex * measuresPerPage;
      const endMeasure = Math.min(startMeasure + measuresPerPage, measures.length);
      const pageMeasures = measures.slice(startMeasure, endMeasure);

      // Get page canvas
      const page = this.pageManager.getPageForMeasure(startMeasure);

      // Render this page's measures
      const compositionState = getCompositionState();
      // Check for export mode options
      const exportOpts = this.exportOptions || {};
      const isExporting = exportOpts.isExporting || false;

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
        // Chord span settings - respect export options
        showChordSpans: isExporting ? (exportOpts.includeSectionColoring !== false || exportOpts.includeBrackets !== false || exportOpts.includeChordLabels !== false) : (settings.showChordSpans !== false),
        // Individual chord span element controls (for export)
        showChordSpanShading: isExporting ? (exportOpts.includeSectionColoring !== false) : true,
        showChordBrackets: isExporting ? (exportOpts.includeBrackets !== false) : true,
        showChordLabels: isExporting ? (exportOpts.includeChordLabels !== false) : true,
        // Multi-voice rest display settings
        restDisplayMode: settings.restDisplayMode || 'clean',
        // Phase 2 Bass Block Isolation: active block highlighting
        activeBassBlockIndex: compositionState ? compositionState.getActiveBassBlockIndex() : -1,
        chordSegments: compositionState ? compositionState.getChordSegments() : [],
        // Coach Engine highlights (for analysis feedback)
        coachHighlightIndices: compositionState ? compositionState.getCoachHighlightIndices() : [],
        // Hairpins (crescendo/decrescendo)
        hairpins: compositionState ? compositionState.hairpins : [],
        // Slurs (phrase marks)
        slurs: compositionState ? compositionState.slurs : [],
        // Tempo markings
        tempoMarkings: compositionState ? compositionState.tempoMarkings : [],
        // Repeat signs
        repeatSigns: compositionState ? compositionState.repeatSigns : [],
        // Volta brackets (1st/2nd endings)
        voltaBrackets: compositionState ? compositionState.voltaBrackets : [],
        // Export mode - hides UI hints
        isExporting: isExporting,
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

      // Collect chord symbol regions for coach overlay (adjust to global)
      if (renderedPage && renderedPage.chordSymbolRegions) {
        renderedPage.chordSymbolRegions.forEach(region => {
          allChordSymbolRegions.push({
            ...region,
            pageIndex: pageIndex,
          });
        });
      }
    }

    // Update PageManager layout to apply view mode (continuous/single/two-page)
    this.pageManager.updateLayout();

    // Return combined rendered system
    return {
      measures: allRenderedMeasures,
      noteRegions: allNoteRegions,
      chordBracketRegions: allChordBracketRegions,
      chordSymbolRegions: allChordSymbolRegions,
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

    // Ensure we have enough page canvases
    const totalPages = this.pageLayoutManager.getTotalPages();

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

    // Update PageManager layout (will show all pages if in continuous mode)
    this.pageManager.updateLayout();

    // CONTINUOUS MODE: Render ALL pages when in continuous view mode (for fullscreen scroll)
    if (this.pageManager.currentViewMode === 'continuous' && totalPages > 1) {
      return this._renderAllPagesForContinuousMode(measures, key, timeSig, overrideOptions, totalPages);
    }

    // SINGLE/TWO-PAGE MODE: Render only the current page
    // Get current page index
    let currentPageIndex = this.pageManager.getCurrentPage();

    // CRITICAL: If current page is beyond the total pages (e.g., measures were removed),
    // navigate back to the last valid page
    if (currentPageIndex >= totalPages) {
      const newPageIndex = Math.max(0, totalPages - 1);
      this.pageManager.goToPage(newPageIndex);
      currentPageIndex = newPageIndex;
    }

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
    // Check for export mode options
    const exportOpts = this.exportOptions || {};
    const isExporting = exportOpts.isExporting || false;

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
      // Chord span settings - respect export options
      showChordSpans: isExporting ? (exportOpts.includeSectionColoring !== false || exportOpts.includeBrackets !== false || exportOpts.includeChordLabels !== false) : (settings.showChordSpans !== false),
      // Individual chord span element controls (for export)
      showChordSpanShading: isExporting ? (exportOpts.includeSectionColoring !== false) : true,
      showChordBrackets: isExporting ? (exportOpts.includeBrackets !== false) : true,
      showChordLabels: isExporting ? (exportOpts.includeChordLabels !== false) : true,
      // Multi-voice rest display settings
      restDisplayMode: settings.restDisplayMode || 'clean',
      // Phase 2 Bass Block Isolation: active block highlighting
      activeBassBlockIndex: compositionState ? compositionState.getActiveBassBlockIndex() : -1,
      chordSegments: compositionState ? compositionState.getChordSegments() : [],
      // Coach Engine highlights (for analysis feedback)
      coachHighlightIndices: compositionState ? compositionState.getCoachHighlightIndices() : [],
      // Hairpins (crescendo/decrescendo)
      hairpins: compositionState ? compositionState.hairpins : [],
      // Slurs (phrase marks)
      slurs: compositionState ? compositionState.slurs : [],
      // Tempo markings
      tempoMarkings: compositionState ? compositionState.tempoMarkings : [],
      // Repeat signs
      repeatSigns: compositionState ? compositionState.repeatSigns : [],
      // Volta brackets (1st/2nd endings)
      voltaBrackets: compositionState ? compositionState.voltaBrackets : [],
      // Export mode - hides UI hints
      isExporting: isExporting,
    });

    const allRenderedMeasures = [];
    const allNoteRegions = [];
    const allChordBracketRegions = [];
    const allChordSymbolRegions = []; // For coach overlay positioning

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

    // Collect chord symbol regions for coach overlay
    if (renderedPage && renderedPage.chordSymbolRegions) {
      renderedPage.chordSymbolRegions.forEach(region => {
        allChordSymbolRegions.push({
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
      chordSymbolRegions: allChordSymbolRegions,
    };
  }

  /**
   * Render ALL pages for continuous scroll mode (used in fullscreen)
   * This loops through all pages and renders them, unlike renderWithPagination
   * which only renders the current page for single-page view navigation.
   */
  _renderAllPagesForContinuousMode(measures, key, timeSig, overrideOptions, totalPages) {
    const allRenderedMeasures = [];
    const allNoteRegions = [];
    const allChordBracketRegions = [];
    const allChordSymbolRegions = []; // For coach overlay positioning

    // Get settings
    const compositionState = getCompositionState();
    const settings = compositionState ? compositionState.getSettings() : {};
    const hasOverrides = overrideOptions.selectedMeasureIndexOverride !== undefined;

    // Clear all pages first
    this.pageManager.clearAllPages();

    // Render each page
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      // Get page layout info from the pages array
      const pageLayout = this.pageLayoutManager.pages[pageIndex];
      if (!pageLayout) continue;

      const startMeasure = pageLayout.startMeasure;
      const endMeasure = pageLayout.endMeasure;
      const pageMeasures = measures.slice(startMeasure, endMeasure + 1);

      // Get page canvas
      const page = this.pageManager.getPage(pageIndex);
      if (!page) continue;

      // Convert global indices to page-local indices for highlighting
      let localSelectedIndex = -1;
      let localActiveIndex = -1;

      if (hasOverrides) {
        const overrideSelected = overrideOptions.selectedMeasureIndexOverride;
        const overrideActive = overrideOptions.activeMeasureIndexOverride;
        if (overrideSelected >= startMeasure && overrideSelected <= endMeasure) {
          localSelectedIndex = overrideSelected - startMeasure;
        }
        if (overrideActive >= startMeasure && overrideActive <= endMeasure) {
          localActiveIndex = overrideActive - startMeasure;
        }
      } else {
        if (this.selectedMeasureIndex >= startMeasure && this.selectedMeasureIndex <= endMeasure) {
          localSelectedIndex = this.selectedMeasureIndex - startMeasure;
        }
        if (this.activeMeasureIndex >= startMeasure && this.activeMeasureIndex <= endMeasure) {
          localActiveIndex = this.activeMeasureIndex - startMeasure;
        }
      }

      // Convert active notes to page-local indices
      const pageLocalActiveNotes = new Set();
      const sourceNotes = hasOverrides ? (overrideOptions.activeNotesOverride || new Set()) : this.activeNotes;
      for (const noteId of sourceNotes) {
        const parts = noteId.split('-');
        if (parts.length >= 3) {
          const globalMeasureIndex = parseInt(parts[0], 10);
          if (!isNaN(globalMeasureIndex) && globalMeasureIndex >= startMeasure && globalMeasureIndex <= endMeasure) {
            const localMeasureIndex = globalMeasureIndex - startMeasure;
            const pageLocalNoteId = `${localMeasureIndex}-${parts.slice(1).join('-')}`;
            pageLocalActiveNotes.add(pageLocalNoteId);
          }
        }
      }

      // Check for export mode options
      const exportOpts = this.exportOptions || {};
      const isExporting = exportOpts.isExporting || false;

      // Render the page using the same function as renderWithPagination
      const renderResult = renderGrandStaffSystem(page.canvas, pageMeasures, {
        key,
        timeSig,
        selectedMeasureIndex: localSelectedIndex,
        activeMeasureIndex: localActiveIndex,
        activeNotes: pageLocalActiveNotes,
        showChordSpans: isExporting ? (exportOpts.includeSectionColoring !== false || exportOpts.includeBrackets !== false || exportOpts.includeChordLabels !== false) : settings.showChordSpans,
        // Individual chord span element controls (for export)
        showChordSpanShading: isExporting ? (exportOpts.includeSectionColoring !== false) : true,
        showChordBrackets: isExporting ? (exportOpts.includeBrackets !== false) : true,
        showChordLabels: isExporting ? (exportOpts.includeChordLabels !== false) : true,
        chordSegments: compositionState?.getChordSegments() || [],
        chordSpanStartOffset: startMeasure,
        pageIndex: pageIndex,
        startMeasureOffset: startMeasure,
        measuresPerSystem: this.config.measuresPerSystem || 4,
        isExporting: isExporting,
      });

      // Accumulate results with global measure indices
      if (renderResult) {
        // Adjust measure indices to be global
        const adjustedMeasures = (renderResult.measures || []).map((m, i) => ({
          ...m,
          globalIndex: startMeasure + i,
        }));
        allRenderedMeasures.push(...adjustedMeasures);

        // Adjust note regions to have global measure indices
        const adjustedRegions = (renderResult.noteRegions || []).map(region => ({
          ...region,
          measureIndex: region.measureIndex + startMeasure,
          pageIndex: pageIndex,
        }));
        allNoteRegions.push(...adjustedRegions);

        // Accumulate chord bracket regions with page index
        if (renderResult.chordBracketRegions) {
          const adjustedBrackets = renderResult.chordBracketRegions.map(region => ({
            ...region,
            pageIndex: pageIndex,
          }));
          allChordBracketRegions.push(...adjustedBrackets);
        }

        // Accumulate chord symbol regions for coach overlay with page index
        if (renderResult.chordSymbolRegions) {
          const adjustedSymbols = renderResult.chordSymbolRegions.map(region => ({
            ...region,
            pageIndex: pageIndex,
          }));
          allChordSymbolRegions.push(...adjustedSymbols);
        }
      }
    }

    // Re-attach event listeners
    if (this.noteEditor) {
      this.noteEditor.attachPageEventListeners();
    }
    this.attachPageCanvasEvents();

    return {
      measures: allRenderedMeasures,
      noteRegions: allNoteRegions,
      chordBracketRegions: allChordBracketRegions,
      chordSymbolRegions: allChordSymbolRegions,
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

    // Double-click handler - for measure isolation editor
    container.addEventListener('dblclick', (e) => this.handleCanvasDblClick(e));

    // Mouse move for hover effects
    container.addEventListener('mousemove', (e) => this.handleMouseMove(e));

    // Mouse leave - cancel any pending hold
    container.addEventListener('mouseleave', () => this.handleCanvasMouseLeave());

    // Touch events for mobile long-press on chord brackets
    container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    container.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    container.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: true });
    container.addEventListener('touchcancel', () => this.cancelLongPress());

    // Wheel event - hide measure edit overlay during trackpad/mouse wheel scrolling
    // (wheel fires directly from input device, unlike scroll which only fires on scrollable elements)
    container.addEventListener('wheel', () => this.hideMeasureEditOverlay(), { passive: true });

    // Also listen on document for wheel events anywhere (captures trackpad scrolling over the page)
    document.addEventListener('wheel', () => this.hideMeasureEditOverlay(), { passive: true });
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
      page.canvas.addEventListener('dblclick', (e) => this.handleCanvasDblClick(e));
      page.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
      page.canvas.addEventListener('mouseleave', () => this.handleCanvasMouseLeave());

      // Touch events for mobile long-press on chord brackets
      page.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
      page.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
      page.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: true });
      page.canvas.addEventListener('touchcancel', () => this.cancelLongPress());

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

      // MOBILE: Show measure edit overlay on tap (since hover doesn't work on touch)
      // This gives mobile users a button to tap to open the Measure Isolation Editor
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (isTouchDevice) {
        // Get canvas/container rect for positioning
        const container = this.pageManager ?
          this.pageManager.container :
          this.config.container;
        if (container) {
          const rect = container.getBoundingClientRect();
          // Get zoom factor from FullScreenNotationEditor (same pattern as handleMouseMove)
          const fsEditor = window.getFullScreenNotationEditor?.();
          const zoomFactor = (fsEditor?.isOpen || fsEditor?.isTabMode) ? (fsEditor.zoomLevel / 100) : 1;
          const measureBounds = staffPosition.measure;
          const measureRight = rect.left + (measureBounds.x + measureBounds.width) * zoomFactor;
          const measureTop = rect.top + measureBounds.y * zoomFactor;
          this.showMeasureEditOverlay(measureRight - 5, measureTop + 5, globalMeasureIndex);
        }
      }
    }
  }

  /**
   * Handle double-click on canvas - open Measure Isolation Editor
   * @param {MouseEvent} e - Mouse event
   */
  handleCanvasDblClick(e) {
    // Get position - works for both single and multi-page mode
    const position = this.getPositionFromEvent(e);
    if (!position) return;

    // Find what was clicked
    const staffPosition = this.layoutManager.getStaffPositionAtPoint(position.x, position.y);

    if (staffPosition && staffPosition.measure) {
      // SECTION VIEW FIX: Apply filter offset to convert local index to global
      const filterOffset = this.getMeasureFilterOffset();
      const globalMeasureIndex = staffPosition.measure.index + filterOffset;

      // Open the Measure Isolation Editor for this measure
      if (window.openMeasureIsolationEditor) {
        window.openMeasureIsolationEditor(globalMeasureIndex);
      }
    }
  }

  // ============================================================================
  // TOUCH EVENT HANDLERS (Mobile long-press for chord bracket editor)
  // ============================================================================

  /**
   * Handle touch start - check if touching a chord bracket for long-press detection
   * @param {TouchEvent} e - Touch event
   */
  handleTouchStart(e) {
    if (e.touches.length !== 1) {
      this.cancelLongPress();
      return;
    }

    const touch = e.touches[0];

    // Get position from touch event (zoom-adjusted)
    const position = this.getTouchPosition(touch);
    if (!position) return;

    // Check if touch is on a chord bracket region (pass page for multi-page mode)
    const bracketRegion = this.findChordBracketAtPosition(position.x, position.y, position.page);

    if (bracketRegion) {
      // Store touch info for long-press detection
      this.longPressData = {
        startX: touch.clientX,
        startY: touch.clientY,
        region: bracketRegion,
        timestamp: Date.now()
      };

      // Start long-press timer (500ms)
      this.longPressTimer = setTimeout(() => {
        this.triggerLongPress();
      }, 500);

      // Prevent default to avoid text selection, but allow scroll if user moves
      // We'll check movement in touchmove
    } else {
      this.cancelLongPress();
    }
  }

  /**
   * Handle touch move - cancel long-press if moved too far
   * @param {TouchEvent} e - Touch event
   */
  handleTouchMove(e) {
    if (!this.longPressData || e.touches.length !== 1) {
      this.cancelLongPress();
      return;
    }

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - this.longPressData.startX);
    const deltaY = Math.abs(touch.clientY - this.longPressData.startY);

    // Cancel if moved more than 10px (user is scrolling)
    if (deltaX > 10 || deltaY > 10) {
      this.cancelLongPress();
    }
  }

  /**
   * Handle touch end - cancel long-press timer
   * @param {TouchEvent} e - Touch event
   */
  handleTouchEnd(e) {
    // If long-press already triggered, don't do anything
    if (this.longPressTriggered) {
      this.longPressTriggered = false;
      e.preventDefault(); // Prevent click from firing
      return;
    }

    this.cancelLongPress();
  }

  /**
   * Cancel any pending long-press
   */
  cancelLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressData = null;
    this.longPressTriggered = false;
  }

  /**
   * Trigger long-press action - open chord bracket editor
   */
  triggerLongPress() {
    if (!this.longPressData) return;

    const { region } = this.longPressData;
    this.longPressTriggered = true;

    // Haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Open the chord bracket editor
    console.log('[ComposerIntegration] Long-press on chord bracket:', region.chordIndex);
    if (window.showChordBracketEditor) {
      window.showChordBracketEditor(region.chordIndex, region, null);
    }

    this.cancelLongPress();
  }

  /**
   * Get position from touch event (similar to getPositionFromEvent but for Touch)
   * @param {Touch} touch - Touch object
   * @returns {Object|null} - {x, y} position or null
   */
  getTouchPosition(touch) {
    // Get zoom factor from FullScreenNotationEditor if active
    const fsEditor = window.getFullScreenNotationEditor?.();
    const zoomFactor = (fsEditor?.isOpen || fsEditor?.isTabMode) ? (fsEditor.zoomLevel / 100) : 1;

    // Multi-page mode
    if (this.pageManager) {
      // Find which page canvas contains this touch
      const pages = this.pageManager.getAllPages();
      for (const page of pages) {
        const rect = page.canvas.getBoundingClientRect();
        if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          // Divide by zoomFactor to convert screen coords to canvas internal coords
          return {
            x: (touch.clientX - rect.left) / zoomFactor,
            y: (touch.clientY - rect.top) / zoomFactor,
            page: page
          };
        }
      }
      return null;
    }

    // Legacy single canvas mode
    const container = this.config.container;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    // Divide by zoomFactor to convert screen coords to canvas internal coords
    return {
      x: (touch.clientX - rect.left) / zoomFactor,
      y: (touch.clientY - rect.top) / zoomFactor,
    };
  }

  /**
   * Find chord bracket region at given position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Object|null} - Chord bracket region or null
   */
  findChordBracketAtPosition(x, y, page = null) {
    if (!this.chordBracketRegions || this.chordBracketRegions.length === 0) {
      return null;
    }

    for (const region of this.chordBracketRegions) {
      // In multi-page mode, check page index matches
      if (page && region.pageIndex !== undefined && region.pageIndex !== page.pageIndex) {
        continue;
      }

      if (x >= region.x && x <= region.x + region.width &&
          y >= region.y && y <= region.y + region.height) {
        return region;
      }
    }
    return null;
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
      // Need to find which chord occupies this measure (accounting for varying chord durations)
      if (window.setSelectedChordIndex && index >= 0) {
        const compositionState = getCompositionState();
        const chordSegments = compositionState?.getChordSegments?.() || [];
        const timeSignature = compositionState?.getSettings?.()?.timeSignature || { num: 4, denom: 4 };
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);

        // Calculate the beat position for the start of this measure
        const measureStartBeat = index * beatsPerMeasure;

        // Find the chord segment that contains this beat
        let chordIndex = index; // Default fallback
        for (const segment of chordSegments) {
          const segmentEndBeat = segment.startBeat + segment.durationBeats;
          if (measureStartBeat >= segment.startBeat && measureStartBeat < segmentEndBeat) {
            chordIndex = segment.chordIndex;
            break;
          }
        }

        window.setSelectedChordIndex(chordIndex);
      } else if (window.setSelectedChordIndex) {
        window.setSelectedChordIndex(index);
      }
    }

    // Update volta buttons to highlight if this measure is in a volta bracket
    if (this.toolbar && index >= 0) {
      this.toolbar.selectionMeasureIndices = new Set([index]);
      this.toolbar.updateVoltaButtonsForSelection();
    } else if (this.toolbar) {
      this.toolbar.selectionMeasureIndices = new Set();
      this.toolbar.updateVoltaButtonsForSelection();
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
    // Track mouse position for scroll detection (mouse stays still but page moves)
    this.lastMouseClientX = e.clientX;
    this.lastMouseClientY = e.clientY;

    // Use e.target (the actual canvas) for correct coordinates in multi-page mode
    const target = e.target || this.config.container;
    const rect = target.getBoundingClientRect();

    // Get zoom factor from FullScreenNotationEditor if active
    const fsEditor = window.getFullScreenNotationEditor?.();
    const zoomFactor = (fsEditor?.isOpen || fsEditor?.isTabMode) ? (fsEditor.zoomLevel / 100) : 1;

    // Convert screen coordinates to canvas internal coordinates
    // When zoomed, screen coordinates need to be divided by zoom factor
    const x = (e.clientX - rect.left) / zoomFactor;
    const y = (e.clientY - rect.top) / zoomFactor;

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
    if (hoveredRegion && !hoveredRegion.isRest) {
      // For polyphonic notes, find which specific pitch the mouse is closest to
      let analysisToShow = hoveredRegion.analysis;

      if (hoveredRegion.pitches && hoveredRegion.pitches.length > 1 && hoveredRegion.noteHeadPositions) {
        // Find the note head closest to the mouse Y position
        const noteHeads = hoveredRegion.noteHeadPositions;
        let closestIdx = 0;
        let closestDist = Math.abs(y - noteHeads[0].y);

        for (let i = 1; i < noteHeads.length; i++) {
          const dist = Math.abs(y - noteHeads[i].y);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = i;
          }
        }

        // Get the pitch for the closest note head
        // noteHeadPositions are in the same order as pitches (sorted by MIDI ascending)
        // But VexFlow getYs() returns Y positions from bottom to top of staff (higher Y = lower on screen)
        // So lower Y = higher pitch, meaning the order might be reversed
        // Actually, pitches are sorted by MIDI ascending (low to high)
        // and VexFlow Y positions: lower Y = higher on staff = higher pitch
        // So noteHeads[0] (lowest Y) corresponds to highest pitch
        // We need to match based on sorted order: pitches are low-to-high, Ys are high-to-low
        const pitches = [...hoveredRegion.pitches];
        // Sort note head positions by Y descending (higher Y first = lower pitch)
        const sortedHeads = noteHeads.map((pos, idx) => ({ pos, originalIdx: idx }))
          .sort((a, b) => b.pos.y - a.pos.y);

        // Find which sorted index the closest head corresponds to
        const closestInSorted = sortedHeads.findIndex(h => h.originalIdx === closestIdx);
        const hoveredPitch = pitches[closestInSorted >= 0 ? closestInSorted : 0];

        // Generate analysis for the specific hovered pitch
        if (hoveredPitch && hoveredRegion.chord) {
          try {
            const keySignature = window.getCompositionState?.()?.keySignature || 'C';
            analysisToShow = analyzeChordTone(hoveredPitch, hoveredRegion.chord, keySignature);
          } catch (e) {
            // Fall back to the pre-computed analysis
          }
        }
      }

      if (analysisToShow && analysisToShow.tooltip) {
        // Use document.body to avoid overflow clipping issues
        showNoteTooltip(document.body, analysisToShow, e.clientX, e.clientY);
        this.hideMeasureEditOverlay(); // Hide edit icon when showing tooltip
        return;
      }
    }

    // Hide tooltip when not over a note
    hideNoteTooltip();

    // Check if mouse is over a measure for edit icon
    const staffPosition = this.layoutManager.getStaffPositionAtPoint(x, y);
    if (staffPosition && staffPosition.measure) {
      // Apply section filter offset for correct global index
      const filterOffset = this.getMeasureFilterOffset();
      const globalMeasureIndex = staffPosition.measure.index + filterOffset;

      // Only update if measure changed
      if (globalMeasureIndex !== this.hoveredMeasureIndex) {
        // Position at top-right corner of the measure
        // Scale measureBounds by zoom factor (measureBounds is in canvas internal coords)
        const measureBounds = staffPosition.measure;
        const measureRight = rect.left + (measureBounds.x + measureBounds.width) * zoomFactor;
        const measureTop = rect.top + measureBounds.y * zoomFactor;
        this.showMeasureEditOverlay(measureRight - 5, measureTop + 5, globalMeasureIndex);

        // NOTE: Measure-based coach indicator is disabled - now using chord-based overlays above staff
        // The old measure compass icon is replaced by clickable badges on chord labels
      }
    } else {
      // Use delayed hide to allow mouse to reach the overlay
      this.scheduleMeasureEditOverlayHide();
    }
  }

  /**
   * Handle mouse leave
   */
  handleMouseLeave() {
    hideNoteTooltip();
    this.scheduleMeasureEditOverlayHide();
  }

  /**
   * Handle canvas mouse leave specifically
   */
  handleCanvasMouseLeave() {
    hideNoteTooltip();
    // Delay hiding to allow user to move mouse to the overlay
    this.scheduleMeasureEditOverlayHide();
  }

  /**
   * Schedule hiding the measure edit overlay with a delay
   * This allows the user to move their mouse from the canvas to the overlay or coach indicator
   */
  scheduleMeasureEditOverlayHide() {
    // Clear any existing hide timer
    if (this.measureEditHideTimer) {
      clearTimeout(this.measureEditHideTimer);
    }
    // Set a short delay before hiding
    this.measureEditHideTimer = setTimeout(() => {
      // Don't hide if mouse is over either the edit overlay or coach indicator
      if (!this.isMouseOverEditOverlay && !this.isMouseOverCoachIndicator) {
        this.hideMeasureEditOverlay();
      }
    }, 150);
  }

  /**
   * Create the measure edit overlay icon (lazy initialization)
   */
  createMeasureEditOverlay() {
    if (this.measureEditOverlay) return this.measureEditOverlay;

    const overlay = document.createElement('div');
    overlay.id = 'measure-edit-overlay';
    overlay.className = 'measure-edit-overlay';
    overlay.innerHTML = `
      <button class="measure-edit-btn" title="Edit this measure (double-click also works)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
      </button>
    `;
    overlay.style.cssText = `
      position: fixed;
      z-index: 1000;
      pointer-events: auto;
      display: none;
      padding: 4px;
    `;

    // Track when mouse is over the overlay to prevent hiding
    overlay.addEventListener('mouseenter', () => {
      this.isMouseOverEditOverlay = true;
      if (this.measureEditHideTimer) {
        clearTimeout(this.measureEditHideTimer);
        this.measureEditHideTimer = null;
      }
    });
    overlay.addEventListener('mouseleave', () => {
      this.isMouseOverEditOverlay = false;
      this.scheduleMeasureEditOverlayHide();
    });

    // Style the button
    const btn = overlay.querySelector('.measure-edit-btn');
    btn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: 2px solid white;
      border-radius: 6px;
      cursor: pointer;
      color: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: transform 0.15s, box-shadow 0.15s;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.1)';
      btn.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const measureIndex = this.hoveredMeasureIndex;
      console.log('[MeasureEditOverlay] Click - measureIndex:', measureIndex);
      if (measureIndex >= 0 && window.openMeasureIsolationEditor) {
        this.hideMeasureEditOverlay(true); // preserve index until function called
        window.openMeasureIsolationEditor(measureIndex);
        this.hoveredMeasureIndex = -1; // now reset
      } else {
        console.warn('[MeasureEditOverlay] Click failed - measureIndex:', measureIndex, 'hasFunction:', !!window.openMeasureIsolationEditor);
      }
    });

    document.body.appendChild(overlay);
    this.measureEditOverlay = overlay;
    return overlay;
  }

  /**
   * Show the measure edit overlay at a specific position
   * @param {number} x - X position (client coordinates)
   * @param {number} y - Y position (client coordinates)
   * @param {number} measureIndex - Global measure index
   */
  showMeasureEditOverlay(x, y, measureIndex) {
    const overlay = this.createMeasureEditOverlay();
    this.hoveredMeasureIndex = measureIndex;

    // Position the overlay - offset slightly to bottom-right of the measure
    overlay.style.left = `${x - 14}px`;
    overlay.style.top = `${y - 14}px`;
    overlay.style.display = 'block';

    // Start position check interval to detect scroll-induced mouse movement
    // (trackpad scrolling moves the page but doesn't fire mouse events)
    this.startOverlayPositionCheck();
  }

  /**
   * Hide the measure edit overlay
   * @param {boolean} preserveIndex - If true, don't reset hoveredMeasureIndex (used when clicking)
   */
  hideMeasureEditOverlay(preserveIndex = false) {
    // Stop position check interval
    this.stopOverlayPositionCheck();

    if (this.measureEditOverlay) {
      this.measureEditOverlay.style.display = 'none';
    }
    // Also hide coach indicator
    this.hideCoachIndicator();

    if (!preserveIndex) {
      this.hoveredMeasureIndex = -1;
    }
  }

  /**
   * Start interval to check if mouse is still over the measure
   * This detects when scrolling moves the page away from the mouse
   */
  startOverlayPositionCheck() {
    // Clear any existing interval
    this.stopOverlayPositionCheck();

    // Check every 100ms if mouse is still over a measure
    this.overlayPositionCheckInterval = setInterval(() => {
      // Don't hide if mouse is on edit overlay or coach indicator
      if (this.isMouseOverEditOverlay || this.isMouseOverCoachIndicator) return;

      // Get element at last known mouse position
      const elementAtPoint = document.elementFromPoint(this.lastMouseClientX, this.lastMouseClientY);
      if (!elementAtPoint) {
        this.hideMeasureEditOverlay();
        return;
      }

      // Check if mouse is still over a canvas (notation area)
      const isOverCanvas = elementAtPoint.tagName === 'CANVAS' ||
                           elementAtPoint.closest('#notation-container') ||
                           elementAtPoint.closest('.notation-page');

      if (!isOverCanvas) {
        this.hideMeasureEditOverlay();
      }
    }, 100);
  }

  /**
   * Stop the overlay position check interval
   */
  stopOverlayPositionCheck() {
    if (this.overlayPositionCheckInterval) {
      clearInterval(this.overlayPositionCheckInterval);
      this.overlayPositionCheckInterval = null;
    }
  }

  // ============================================================================
  // COACH INDICATOR OVERLAY
  // ============================================================================

  /**
   * Update coach items for measures (called after analysis)
   * @param {Array} coachItems - Array of coach items with chordIndices data
   */
  updateMeasureCoachItems(coachItems) {
    this.measureCoachItems.clear();
    this.chordCoachItems.clear();

    if (!coachItems || coachItems.length === 0) {
      // Clear badges when there are no coach items (e.g., progression cleared)
      this.updateChordLabelOverlays();
      return;
    }

    // Get chord segments to map chord indices to measures
    const chordSegments = this.compositionState?.getChordSegments() || [];

    // Get beats per measure for calculating measure index from startBeat
    const timeSignature = this.compositionState?.getTimeSignature() || { num: 4, denom: 4 };
    const beatsPerMeasure = timeSignature.num;

    for (const item of coachItems) {
      // Get chord indices from this item
      // Priority: Use explicit chordIndex/chordIndices if provided
      // Only fall back to startIndex/endIndex if no explicit indices given
      let chordIndices = [];
      if (item.data?.chordIndex !== undefined) {
        chordIndices.push(item.data.chordIndex);
      }
      if (item.data?.chordIndices?.length > 0) {
        chordIndices.push(...item.data.chordIndices);
      }
      // Only use startIndex/endIndex as fallback when no explicit indices provided
      if (chordIndices.length === 0) {
        if (item.data?.startIndex !== undefined) {
          chordIndices.push(item.data.startIndex);
        }
        if (item.data?.endIndex !== undefined) {
          chordIndices.push(item.data.endIndex);
        }
      }

      // Map chord indices to measure indices
      for (const chordIndex of chordIndices) {
        const segment = chordSegments.find(s => s.chordIndex === chordIndex);
        if (segment) {
          // Calculate measure index from startBeat (segments have startBeat, not startMeasure)
          const measureIndex = Math.floor(segment.startBeat / beatsPerMeasure);
          if (!this.measureCoachItems.has(measureIndex)) {
            this.measureCoachItems.set(measureIndex, []);
          }
          // Avoid duplicates
          const existing = this.measureCoachItems.get(measureIndex);
          if (!existing.some(i => i.id === item.id)) {
            existing.push(item);
          }
        }
      }
    }

    // Also build chord-based mapping for chord label overlays
    // (chordCoachItems was already cleared at the top of this function)
    for (const item of coachItems) {
      // Get all chord indices this item relates to
      // Priority: Use explicit chordIndex/chordIndices if provided
      // Only fall back to startIndex/endIndex if no explicit indices given
      let chordIndices = [];
      if (item.data?.chordIndex !== undefined) {
        chordIndices.push(item.data.chordIndex);
      }
      if (item.data?.chordIndices?.length > 0) {
        chordIndices.push(...item.data.chordIndices);
      }
      // Only use startIndex/endIndex as fallback when no explicit indices provided
      if (chordIndices.length === 0) {
        if (item.data?.startIndex !== undefined) {
          chordIndices.push(item.data.startIndex);
        }
        if (item.data?.endIndex !== undefined) {
          chordIndices.push(item.data.endIndex);
        }
      }

      // Add item to each chord's list
      for (const chordIndex of chordIndices) {
        if (!this.chordCoachItems.has(chordIndex)) {
          this.chordCoachItems.set(chordIndex, []);
        }
        const existing = this.chordCoachItems.get(chordIndex);
        if (!existing.some(i => i.id === item.id)) {
          existing.push(item);
        }
      }
    }

    // NOTE: updateChordLabelOverlays is NOT called here - the caller (_scheduleChordBadgeUpdate)
    // will call it after coach analysis completes, avoiding duplicate calls
  }

  /**
   * Create the coach indicator overlay icon (lazy initialization)
   */
  createCoachIndicatorOverlay() {
    if (this.coachIndicatorOverlay) return this.coachIndicatorOverlay;

    const overlay = document.createElement('div');
    overlay.id = 'coach-indicator-overlay';
    overlay.className = 'coach-indicator-overlay';
    // Badge is OUTSIDE the button so it won't be clipped by button's border-radius
    overlay.innerHTML = `
      <button class="coach-indicator-btn" title="Coach insights for this measure">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </button>
      <span class="coach-badge">0</span>
    `;
    overlay.style.cssText = `
      position: fixed;
      z-index: 1001;
      pointer-events: auto;
      display: none;
    `;

    // Track when mouse is over the coach indicator to prevent hiding (same pattern as edit overlay)
    overlay.addEventListener('mouseenter', () => {
      this.isMouseOverCoachIndicator = true;
      if (this.measureEditHideTimer) {
        clearTimeout(this.measureEditHideTimer);
        this.measureEditHideTimer = null;
      }
    });
    overlay.addEventListener('mouseleave', () => {
      this.isMouseOverCoachIndicator = false;
      this.scheduleMeasureEditOverlayHide();
    });

    // Style the button
    const btn = overlay.querySelector('.coach-indicator-btn');
    btn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      border: 2px solid white;
      border-radius: 50%;
      cursor: pointer;
      color: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: transform 0.15s, box-shadow 0.15s;
    `;

    // Style the badge - positioned at bottom-right, OUTSIDE button to avoid clipping
    const badge = overlay.querySelector('.coach-badge');
    badge.style.cssText = `
      position: absolute;
      bottom: -2px;
      right: -4px;
      min-width: 16px;
      height: 16px;
      background: #ef4444;
      border-radius: 8px;
      font-size: 10px;
      font-weight: bold;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 4px;
      border: 2px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      z-index: 1;
      pointer-events: none;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.15)';
      btn.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.5)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const measureIndex = this.hoveredMeasureIndex;
      const items = this.measureCoachItems.get(measureIndex) || [];
      console.log('[CoachIndicator] Click - measureIndex:', measureIndex, 'items:', items.length);

      if (items.length > 0) {
        // Show coach popup near the indicator
        this.showCoachPopupForMeasure(measureIndex, items, e.clientX, e.clientY);
      }
    });

    document.body.appendChild(overlay);
    this.coachIndicatorOverlay = overlay;
    return overlay;
  }

  /**
   * Show coach indicator at measure position
   * @param {number} x - X position (client coordinates)
   * @param {number} y - Y position (client coordinates)
   * @param {number} measureIndex - Measure index
   */
  showCoachIndicator(x, y, measureIndex) {
    const items = this.measureCoachItems.get(measureIndex);
    if (!items || items.length === 0) return;

    const overlay = this.createCoachIndicatorOverlay();

    // Update badge count
    const badge = overlay.querySelector('.coach-badge');
    badge.textContent = items.length;
    badge.style.display = items.length > 1 ? 'flex' : 'none';

    // Position to the LEFT of the edit icon (edit icon is at x-14, y-14)
    // Edit icon is 28px wide (24px + 4px padding), so coach icon goes 32px left of edit icon position
    overlay.style.left = `${x - 46}px`;  // 32px to the left of edit icon
    overlay.style.top = `${y - 12}px`;   // Slightly lower than edit icon (2px down)
    overlay.style.display = 'block';
  }

  /**
   * Hide the coach indicator overlay
   */
  hideCoachIndicator() {
    if (this.coachIndicatorOverlay) {
      this.coachIndicatorOverlay.style.display = 'none';
    }
  }

  /**
   * Show coach popup for measure with multiple items
   * @param {number} measureIndex - Measure index
   * @param {Array} items - Coach items for this measure
   * @param {number} x - Click X position
   * @param {number} y - Click Y position
   */
  showCoachPopupForMeasure(measureIndex, items, x, y) {
    // Remove any existing popup
    const existingPopup = document.getElementById('coach-measure-popup');
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement('div');
    popup.id = 'coach-measure-popup';

    // Calculate popup dimensions for positioning
    const popupWidth = 300;  // Approximate width
    const popupHeight = Math.min(350, 60 + items.length * 80);  // Approximate height
    const margin = 10;

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate best position - prefer to the RIGHT of click point
    let popupX = x + margin;  // Default: to the right of click
    let popupY = y;  // Same vertical position

    // If goes off right edge, flip to the left of click instead
    if (popupX + popupWidth > viewportWidth - margin) {
      popupX = x - popupWidth - margin;
    }

    // If still goes off left edge, clamp to left edge
    if (popupX < margin) {
      popupX = margin;
    }

    // If goes off bottom, move up
    if (popupY + popupHeight > viewportHeight - margin) {
      popupY = viewportHeight - popupHeight - margin;
    }

    // Final clamp to ensure it's visible
    popupX = Math.max(margin, popupX);
    popupY = Math.max(margin, popupY);

    popup.style.cssText = `
      position: fixed;
      left: ${popupX}px;
      top: ${popupY}px;
      z-index: 2147483647;
      pointer-events: auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      border: 1px solid #e5e7eb;
      max-width: 320px;
      min-width: 260px;
      overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      padding: 10px 14px;
      font-weight: 600;
      font-size: 13px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <span>💡 Insights for Measure ${measureIndex + 1}</span>
      <button id="coach-popup-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 18px; line-height: 1;">&times;</button>
    `;
    popup.appendChild(header);

    // Items list
    const list = document.createElement('div');
    list.style.cssText = `
      max-height: 300px;
      overflow-y: auto;
      padding: 8px;
    `;

    items.forEach((item, idx) => {
      const itemEl = document.createElement('div');
      itemEl.style.cssText = `
        padding: 10px 12px;
        margin-bottom: 6px;
        background: #f9fafb;
        border-radius: 8px;
        cursor: pointer;
        border: 1px solid #e5e7eb;
        transition: all 0.15s;
      `;
      itemEl.addEventListener('mouseenter', () => {
        itemEl.style.background = '#fef3c7';
        itemEl.style.borderColor = '#f59e0b';
      });
      itemEl.addEventListener('mouseleave', () => {
        itemEl.style.background = '#f9fafb';
        itemEl.style.borderColor = '#e5e7eb';
      });

      const emoji = item.emoji || (item.type === 'observation' ? '👀' : item.type === 'suggestion' ? '💡' : '🎯');
      const title = item.title || item.id;

      // Get the raw message template
      let rawMessage = typeof item.message === 'object'
        ? (item.message.simple || item.message.intermediate || Object.values(item.message)[0])
        : (item.message || '');

      // Interpolate template variables with actual data values
      const message = rawMessage.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return item.data && item.data[key] !== undefined ? item.data[key] : match;
      });

      itemEl.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <span style="font-size: 16px;">${emoji}</span>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 12px; color: #374151; margin-bottom: 2px;">${title}</div>
            <div style="font-size: 11px; color: #6b7280; line-height: 1.4; word-wrap: break-word;">${message}</div>
          </div>
        </div>
      `;

      itemEl.addEventListener('click', () => {
        // Get popup position to place nudge nearby
        const popupRect = popup.getBoundingClientRect();
        const nudgeWidth = 350;  // Approximate nudge width
        const margin = 10;
        const viewportWidth = window.innerWidth;

        // Calculate nudge position - prefer right of popup, but flip to left if needed
        let nudgeX = popupRect.right + margin;
        let nudgeY = popupRect.top;

        // If nudge would go off right edge, position to left of popup instead
        if (nudgeX + nudgeWidth > viewportWidth - margin) {
          nudgeX = popupRect.left - nudgeWidth - margin - 12;  // Extra 12px gap when on left
        }

        // If still off screen (left edge), clamp to left edge
        if (nudgeX < margin) {
          nudgeX = margin;
        }

        const nudgePosition = { x: nudgeX, y: nudgeY };

        // Show the full nudge for this item, positioned intelligently
        // Pass keepSummaryOpen: true to use fade animation and stay open
        if (window.showCoachNudge) {
          window.showCoachNudge(item, nudgePosition, { keepSummaryOpen: true });
        }
        // Don't close the summary popup - let user close it manually
      });

      list.appendChild(itemEl);
    });

    popup.appendChild(list);
    document.body.appendChild(popup);

    // Close button handler
    popup.querySelector('#coach-popup-close').addEventListener('click', () => {
      popup.remove();
    });

    // Close on outside click - but NOT if clicking inside the nudge popup
    const closeOnOutsideClick = (e) => {
      // Check if click is inside this popup
      if (popup.contains(e.target)) {
        return;
      }
      // Check if click is inside the coach nudge popup (opened from clicking an item)
      const nudgePopup = document.getElementById('coach-nudge-popup');
      if (nudgePopup && nudgePopup.contains(e.target)) {
        return;
      }
      // Click was truly outside both popups - close this summary popup
      popup.remove();
      document.removeEventListener('click', closeOnOutsideClick);
    };
    setTimeout(() => {
      document.addEventListener('click', closeOnOutsideClick);
    }, 100);
  }

  // ============================================================================
  // CHORD LABEL OVERLAY (Above-measure chord symbols with coach badges)
  // ============================================================================

  /**
   * Schedule chord badge update with debouncing
   * This ensures badges are only placed ONCE after all rendering settles,
   * avoiding stale position issues from multiple render passes
   */
  _scheduleChordBadgeUpdate() {
    // Prevent re-entry during badge update cycle
    if (this._isUpdatingBadges) {
      return;
    }

    // Clear any pending update
    if (this._chordBadgeUpdateTimer) {
      clearTimeout(this._chordBadgeUpdateTimer);
    }

    // Schedule update after a short delay to let rendering settle
    this._chordBadgeUpdateTimer = setTimeout(() => {
      this._isUpdatingBadges = true;
      try {
        // ALWAYS re-run coach analysis when chords change
        // This ensures badge counts update when chords are added/removed/reordered
        if (window.triggerCoachAnalysis) {
          // Clear existing items to force fresh analysis
          this.chordCoachItems.clear();
          window.triggerCoachAnalysis();
        }

        // Now place the badges with final positions
        this.updateChordLabelOverlays();
      } finally {
        // Allow next update after a short delay
        setTimeout(() => {
          this._isUpdatingBadges = false;
        }, 200);
      }
    }, 100); // 100ms debounce - enough for multiple render passes to complete
  }

  /**
   * Update chord label overlays positioned above chord symbols
   * Shows clickable badges with coach item counts
   */
  updateChordLabelOverlays() {
    // Get the canvas/container element for positioning
    // For multi-page mode, use the page manager's container
    let container = this.config?.container;
    if (this.pageManager && this.pageManager.container) {
      container = this.pageManager.container;
    }
    if (!container) {
      return;
    }

    // CRITICAL: Remove ALL old overlay containers AND individual badge overlays from the entire document
    // This ensures we don't have orphaned overlays from previous containers or fullscreen mode
    document.querySelectorAll('#chord-label-overlay-container').forEach(el => el.remove());
    document.querySelectorAll('.chord-label-overlay').forEach(el => el.remove());
    document.querySelectorAll('.chord-coach-badge').forEach(el => el.remove());

    // Create fresh overlay container in the current container
    this.chordLabelOverlayContainer = document.createElement('div');
    this.chordLabelOverlayContainer.id = 'chord-label-overlay-container';
    this.chordLabelOverlayContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
    `;
    // Position relative to container
    container.style.position = 'relative';
    container.appendChild(this.chordLabelOverlayContainer);

    // If no chord symbol regions, nothing to show
    if (!this.chordSymbolRegions || this.chordSymbolRegions.length === 0) {
      return;
    }

    // Get zoom factor for positioning
    const zoomFactor = this.config?.zoomLevel || 1;

    // Get container rect for positioning calculations
    const containerRect = container.getBoundingClientRect();

    // Create a badge for each chord symbol that has coach items
    for (const region of this.chordSymbolRegions) {
      const chordIndex = region.chordIndex;
      const items = this.chordCoachItems.get(chordIndex) || [];
      const itemCount = items.length;

      // For multi-page mode, find the canvas for this region's page
      let canvasOffsetX = 0;
      let canvasOffsetY = 0;

      // Try pageManager first (multi-page mode)
      if (this.pageManager && region.pageIndex !== undefined) {
        const page = this.pageManager.getPage(region.pageIndex);
        if (page && page.canvas) {
          const canvasRect = page.canvas.getBoundingClientRect();
          canvasOffsetX = canvasRect.left - containerRect.left;
          canvasOffsetY = canvasRect.top - containerRect.top;
        }
      } else if (this.pageManager && region.pageIndex === undefined) {
        // pageManager exists but region doesn't have pageIndex - try to get first page canvas
        const page = this.pageManager.getPage(0);
        if (page && page.canvas) {
          const canvasRect = page.canvas.getBoundingClientRect();
          canvasOffsetX = canvasRect.left - containerRect.left;
          canvasOffsetY = canvasRect.top - containerRect.top;
        }
      } else if (!this.pageManager && this.config?.container) {
        // Legacy single-canvas mode - use config.container directly
        const canvas = this.config.container;
        if (canvas) {
          const canvasRect = canvas.getBoundingClientRect();
          canvasOffsetX = canvasRect.left - containerRect.left;
          canvasOffsetY = canvasRect.top - containerRect.top;
        }
      }

      // Create clickable overlay element
      const overlay = document.createElement('div');
      overlay.className = 'chord-label-overlay';
      overlay.dataset.chordIndex = chordIndex;

      // Position the badge just below the chord label, centered horizontally
      // region.x and region.y are canvas coordinates for where the chord text was drawn
      // region.y is the text baseline, so +2 puts badge just below the text
      const labelWidth = region.width || (region.chordSymbol?.length || 1) * 8; // Estimate if not provided
      const badgeX = canvasOffsetX + ((region.x + labelWidth / 2) * zoomFactor) - 8; // Centered under label
      const badgeY = canvasOffsetY + ((region.y + 2) * zoomFactor); // Just below chord label (2px below baseline)

      overlay.style.cssText = `
        position: absolute;
        left: ${badgeX}px;
        top: ${badgeY}px;
        pointer-events: auto;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 2px 6px;
        background: ${itemCount > 0 ? 'rgba(245, 158, 11, 0.15)' : 'transparent'};
        border-radius: 8px;
        transition: background 0.15s;
      `;

      // Badge with count (always show, even if count is 0 - but style differently)
      const badge = document.createElement('span');
      badge.className = 'chord-coach-badge';
      badge.textContent = itemCount > 0 ? itemCount : '';
      badge.style.cssText = `
        display: ${itemCount > 0 ? 'flex' : 'none'};
        align-items: center;
        justify-content: center;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        border-radius: 8px;
        font-size: 10px;
        font-weight: bold;
        color: white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      `;
      overlay.appendChild(badge);

      // Hover effect
      overlay.addEventListener('mouseenter', () => {
        if (itemCount > 0) {
          overlay.style.background = 'rgba(245, 158, 11, 0.3)';
        }
      });
      overlay.addEventListener('mouseleave', () => {
        overlay.style.background = itemCount > 0 ? 'rgba(245, 158, 11, 0.15)' : 'transparent';
      });

      // Click handler - show coach popup for this chord
      overlay.addEventListener('click', (e) => {
        e.stopPropagation();
        if (itemCount > 0) {
          this.showCoachPopupForChord(chordIndex, items, e.clientX, e.clientY);
        }
      });

      this.chordLabelOverlayContainer.appendChild(overlay);
    }
  }

  /**
   * Show coach popup for a specific chord
   * @param {number} chordIndex - Chord index
   * @param {Array} items - Coach items for this chord
   * @param {number} x - Click X position
   * @param {number} y - Click Y position
   */
  showCoachPopupForChord(chordIndex, items, x, y) {
    // Remove any existing popup
    const existingPopup = document.getElementById('coach-measure-popup');
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement('div');
    popup.id = 'coach-measure-popup';

    // Calculate popup dimensions for positioning
    const popupWidth = 300;
    const popupHeight = Math.min(350, 60 + items.length * 80);
    const margin = 10;

    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate best position - prefer to the RIGHT of click point
    let popupX = x + margin;
    let popupY = y;

    // If goes off right edge, flip to the left
    if (popupX + popupWidth > viewportWidth - margin) {
      popupX = x - popupWidth - margin;
    }

    // Clamp positions
    popupX = Math.max(margin, popupX);
    popupY = Math.max(margin, Math.min(popupY, viewportHeight - popupHeight - margin));

    popup.style.cssText = `
      position: fixed;
      left: ${popupX}px;
      top: ${popupY}px;
      z-index: 2147483647;
      pointer-events: auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      border: 1px solid #e5e7eb;
      max-width: 360px;
      min-width: 280px;
      overflow: hidden;
    `;

    // Header - show chord number
    const header = document.createElement('div');
    header.style.cssText = `
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      padding: 10px 14px;
      font-weight: 600;
      font-size: 13px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    header.innerHTML = `
      <span>💡 Insights for Chord ${chordIndex + 1}</span>
      <button id="coach-popup-close" style="background: none; border: none; color: white; cursor: pointer; font-size: 18px; line-height: 1;">&times;</button>
    `;
    popup.appendChild(header);

    // Items list
    const list = document.createElement('div');
    list.style.cssText = `
      max-height: 300px;
      overflow-y: auto;
      padding: 8px;
    `;

    items.forEach((item) => {
      const itemEl = document.createElement('div');
      itemEl.style.cssText = `
        padding: 10px 12px;
        margin-bottom: 6px;
        background: #f9fafb;
        border-radius: 8px;
        cursor: pointer;
        border: 1px solid #e5e7eb;
        transition: all 0.15s;
      `;
      itemEl.addEventListener('mouseenter', () => {
        itemEl.style.background = '#fef3c7';
        itemEl.style.borderColor = '#f59e0b';
      });
      itemEl.addEventListener('mouseleave', () => {
        itemEl.style.background = '#f9fafb';
        itemEl.style.borderColor = '#e5e7eb';
      });

      const emoji = item.emoji || (item.type === 'observation' ? '👀' : item.type === 'suggestion' ? '💡' : '🎯');
      const title = item.title || item.id;

      // Get the raw message template
      let rawMessage = typeof item.message === 'object'
        ? (item.message.simple || item.message.intermediate || Object.values(item.message)[0])
        : (item.message || '');

      // Interpolate template variables with actual data values
      const message = rawMessage.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return item.data && item.data[key] !== undefined ? item.data[key] : match;
      });

      itemEl.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 10px;">
          <span style="font-size: 20px;">${emoji}</span>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 14px; color: #374151; margin-bottom: 3px;">${title}</div>
            <div style="font-size: 13px; color: #6b7280; line-height: 1.5; word-wrap: break-word;">${message}</div>
          </div>
        </div>
      `;

      itemEl.addEventListener('click', () => {
        const popupRect = popup.getBoundingClientRect();
        const nudgeWidth = 350;
        const margin = 10;

        let nudgeX = popupRect.right + margin;
        let nudgeY = popupRect.top;

        if (nudgeX + nudgeWidth > viewportWidth - margin) {
          nudgeX = popupRect.left - nudgeWidth - margin - 12;  // Extra 12px gap when on left
        }
        if (nudgeX < margin) {
          nudgeX = margin;
        }

        // Show the full nudge for this item, positioned intelligently
        // Pass keepSummaryOpen: true to use fade animation and stay open
        if (window.showCoachNudge) {
          window.showCoachNudge(item, { x: nudgeX, y: nudgeY }, { keepSummaryOpen: true });
        }
        // Don't close the summary popup - let user close it manually
      });

      list.appendChild(itemEl);
    });

    popup.appendChild(list);
    document.body.appendChild(popup);

    // Close button handler
    popup.querySelector('#coach-popup-close').addEventListener('click', () => {
      popup.remove();
    });

    // Close on outside click - but NOT if clicking inside the nudge popup
    const closeOnOutsideClick = (e) => {
      // Check if click is inside this popup
      if (popup.contains(e.target)) {
        return;
      }
      // Check if click is inside the coach nudge popup (opened from clicking an item)
      const nudgePopup = document.getElementById('coach-nudge-popup');
      if (nudgePopup && nudgePopup.contains(e.target)) {
        return;
      }
      // Click was truly outside both popups - close this summary popup
      popup.remove();
      document.removeEventListener('click', closeOnOutsideClick);
    };
    setTimeout(() => {
      document.addEventListener('click', closeOnOutsideClick);
    }, 100);
  }

  /**
   * Check if a click hit a chord bracket region and handle it
   * @param {number} x - Click X coordinate
   * @param {number} y - Click Y coordinate
   * @param {MouseEvent} event - The original click event (for modifier keys)
   * @returns {boolean} - True if a bracket was clicked
   */
  checkChordBracketClick(x, y, event = null) {
    if (!this.chordBracketRegions || this.chordBracketRegions.length === 0) {
      return false;
    }

    for (const region of this.chordBracketRegions) {
      if (x >= region.x && x <= region.x + region.width &&
          y >= region.y && y <= region.y + region.height) {
        this.handleChordBracketClick(region, event);
        return true;
      }
    }
    return false;
  }

  /**
   * Handle click on a chord bracket label
   * Selects the corresponding bass block for editing (Phase 2 enhancement)
   * Shift+Click replaces bass notes with foundational chord (original behavior)
   * Double-click opens compact chord editor popup
   * @param {Object} region - Chord bracket region data
   * @param {MouseEvent} event - The click event (to check for modifier keys)
   */
  handleChordBracketClick(region, event = null) {
    const { chordData, chordIndex, startBeat, endBeat, durationBeats } = region;

    if (!this.compositionState) {
      console.warn('[ComposerIntegration] Cannot handle bracket click - missing compositionState');
      return;
    }

    // Double-click = Open compact chord editor popup
    if (event && event.detail === 2) {
      console.log('[ComposerIntegration] Double-click on chord bracket:', chordIndex);
      if (window.showChordBracketEditor) {
        window.showChordBracketEditor(chordIndex, region, event);
      }
      return;
    }

    // Shift+Click = Replace bass with foundational chord (original behavior)
    if (event && event.shiftKey && chordData) {
      console.log('[ComposerIntegration] Replacing bass with foundational chord:', {
        chordIndex,
        chord: chordData,
        startBeat,
        endBeat,
        durationBeats,
      });

      this.compositionState.replaceBassWithFoundationalChord(
        chordIndex,
        startBeat,
        durationBeats,
        chordData
      );

      this.render();
      return;
    }

    // Regular click = Select this bass block for editing

    // Set the active staff to bass and the active block index
    this.compositionState.setActiveStaff('bass');
    this.compositionState.setActiveBassBlockIndex(chordIndex);

    // Also update the toolbar to show bass mode
    if (this.toolbar) {
      this.toolbar.setStaffSelectionMode('bass');
    }

    // Sync with chord card selection so they stay in sync
    // This ensures the unified recommendation modal knows which chord is selected
    if (window.setSelectedChordIndex) {
      window.setSelectedChordIndex(chordIndex);
    }
    // Also select the chord card visually
    if (window.selectChordCard) {
      window.selectChordCard(chordIndex);
    }

    // Re-render to show the block highlight
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
      // Extract pitchIndex if present (5th part, index 4)
      const pitchIndex = parts.length > 4 ? parseInt(parts[4]) : null;

      // Track which voices are selected
      selectedVoices.add(voiceIndex);

      const measure = this.compositionState.getMeasure(measureIndex);
      if (measure) {
        // Use the correct voice index from the note ID
        const note = measure.notation[staff]?.voices[voiceIndex]?.notes[noteIndex];
        if (note) {
          // Include selectedPitch if a specific pitch was clicked in a chord
          const selectedPitch = (pitchIndex !== null && note.pitches && note.pitches[pitchIndex])
            ? note.pitches[pitchIndex]
            : null;
          selectedNoteObjects.push({
            ...note,
            measureIndex,
            staff,
            voiceIndex,
            noteIndex,
            pitchIndex,
            selectedPitch,
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
        this.pageLayoutManager.calculatePageLayout(measures.length);
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
      : 'Not applicable when beat unit stays the same';

    const measureExample = scalingInfo.beatsPerMeasureChanged
      ? `A 1-measure chord stays 1 measure (durations scale proportionally)`
      : 'Measure count stays the same';

    // Generate example for "no scaling" option
    const noScalingExample = `A whole note in ${scalingInfo.oldTimeSignature} stays ${scalingInfo.oldDenom} beats but now straddles measures in ${scalingInfo.newTimeSignature}`;

    // Create dialog
    // Use very high z-index to appear above fullscreen notation editor (which uses z-[9990])
    const dialog = document.createElement('div');
    dialog.id = 'time-signature-scaling-dialog';
    dialog.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
    dialog.style.zIndex = '99999';
    dialog.innerHTML = `
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-lg mx-4">
        <h3 class="text-lg font-bold text-gray-800 mb-4">Time Signature Change</h3>
        <p class="text-gray-600 mb-4">
          You're changing from <strong>${scalingInfo.oldTimeSignature}</strong> to <strong>${scalingInfo.newTimeSignature}</strong>
          with <strong>${scalingInfo.chordCount} chord(s)</strong> in your progression.
        </p>
        <p class="text-gray-700 font-medium mb-4">How should chord durations be handled?</p>

        <div class="space-y-3 mb-6">
          <label class="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition ${scalingInfo.denominatorChanged ? '' : 'opacity-50 cursor-not-allowed'}">
            <input type="radio" name="scaling-option" value="noteValue" class="mt-1" ${scalingInfo.denominatorChanged ? 'checked' : 'disabled'}>
            <div>
              <div class="font-medium text-gray-800">Keep note values</div>
              <div class="text-sm text-gray-500">${noteValueExample}</div>
              <div class="text-xs text-blue-600 mt-1">Only applies when beat unit changes (e.g., /4 to /8)</div>
            </div>
          </label>

          <label class="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-green-50 hover:border-green-300 transition">
            <input type="radio" name="scaling-option" value="measures" class="mt-1" ${!scalingInfo.denominatorChanged ? 'checked' : ''}>
            <div>
              <div class="font-medium text-gray-800">Keep measure count</div>
              <div class="text-sm text-gray-500">${measureExample}</div>
              <div class="text-xs text-green-600 mt-1">Chords fill the same number of measures</div>
            </div>
          </label>

          <label class="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition">
            <input type="radio" name="scaling-option" value="none" class="mt-1">
            <div>
              <div class="font-medium text-gray-800">Keep beat count (no scaling)</div>
              <div class="text-sm text-gray-500">${noScalingExample}</div>
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

    // CRITICAL: Update the interactiveMelody time signature for metronome and playback
    // Without this, the metronome clicks the old number of beats per measure
    setMelodyTimeSignature(`${num}/${denom}`);

    // Update progression displays to reflect new durations
    if (window.renderProgressionDisplay) {
      window.renderProgressionDisplay('melody-progression-visualization', true);
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
