/**
 * MeasureIsolationEditor.js - VexFlow-based Measure Isolation Editing
 *
 * Provides a "blown up" view of a single measure using VexFlow rendering
 * where users can click directly on staff positions to place notes.
 *
 * Key features:
 * - VexFlow grand staff rendering with 32 slot markers
 * - Click on staff position determines pitch automatically
 * - Duration toolbar for note length selection
 * - Direct editing - click to place, no separate "add" step
 * - Real-time preview as you edit
 * - Ottava (8va/8vb) support
 */

import { SlotGrid, SLOT_TYPES, SLOTS_PER_BEAT, durationToSlots, slotsToDuration } from './SlotGrid.js';
import { getBeatsPerMeasureFromTimeSignature } from '../../state/compositionState.js';
import { durationToBeats, beatsToDuration } from '../durationUtils.js';
import { pitchToLine } from '../staffLayouter.js';
import { KEY_SIGNATURES, noteToMidi, CLEF_RANGES } from '../vexFlowRenderer.js';
import { getPiano, getAudioIsReady, initAudio } from '../../audio/audioEngine.js';
import { getCurrentTempo } from '../../audio/melodyGenerator.js';
import { analyzeChordTone, CHORD_TONE_COLORS, NOTE_RELATIONSHIPS, getChordTones } from '../../analysis/chordToneAnalyzer.js';
import { CHORD_DEFINITIONS } from '../../../data/music-data.js';
import { scoreVoiceLeadingQuick, analyzeSopranoContour, detectParallelMotion, detectVoiceCrossing, checkTendencyToneResolution } from '../../features/enhancedVoiceLeading.js';
import { showToast } from '../../ui/toastNotifications.js';
import { generateBuildingBlockBass, BASS_PATTERN_OCTAVE_DEFAULTS } from '../../integration/bassAutoFill.js';

// VexFlow globals (loaded via CDN)
const VF = typeof Vex !== 'undefined' ? Vex.Flow : null;

/**
 * Pitch calculation utilities matching VexFlow standard positions
 */
const NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NOTE_VALUES = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/**
 * Convert line number to pitch (matching staffLayouter.js)
 * @param {number} line - Line number (0 = bottom staff line)
 * @param {string} staff - 'treble' or 'bass'
 * @returns {string} Pitch like "C4"
 */
function lineToPitch(line, staff) {
    // Reference: Treble E4 = line 0, Bass G2 = line 0
    const basePitch = staff === 'treble' ? { note: 'E', octave: 4 } : { note: 'G', octave: 2 };
    const baseNoteValue = NOTE_VALUES[basePitch.note];
    const steps = Math.round(line / 2);

    let noteIndex = baseNoteValue + steps;
    let octave = basePitch.octave;

    while (noteIndex >= 7) {
        noteIndex -= 7;
        octave += 1;
    }
    while (noteIndex < 0) {
        noteIndex += 7;
        octave -= 1;
    }

    return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * Determine if a pitch needs ottava adjustment and return adjustment info
 * Supports up to 3-octave shifts (22ma/22mb)
 * @param {string} pitch - Pitch like "C4" or "E#6"
 * @param {string} clef - 'treble' or 'bass'
 * @returns {{ needsOttava: boolean, ottavaType: string|null, displayPitch: string, shift: number }}
 */
function getOttavaAdjustment(pitch, clef) {
    const midi = noteToMidi(pitch);
    if (midi === null) {
        return { needsOttava: false, ottavaType: null, displayPitch: pitch, shift: 0 };
    }

    const range = CLEF_RANGES[clef];
    if (!range) {
        return { needsOttava: false, ottavaType: null, displayPitch: pitch, shift: 0 };
    }

    // Check if note is out of range - support up to 3 octave shifts
    if (midi > range.max + 24) {
        // Note is extremely high - needs 22ma (display three octaves lower)
        const adjustedPitch = adjustPitchByOctave(pitch, -3);
        return { needsOttava: true, ottavaType: '22ma', displayPitch: adjustedPitch, shift: -3 };
    } else if (midi > range.max + 12) {
        // Note is very high - needs 15ma (display two octaves lower)
        const adjustedPitch = adjustPitchByOctave(pitch, -2);
        return { needsOttava: true, ottavaType: '15ma', displayPitch: adjustedPitch, shift: -2 };
    } else if (midi > range.max) {
        // Note is too high - needs 8va (display one octave lower)
        const adjustedPitch = adjustPitchByOctave(pitch, -1);
        return { needsOttava: true, ottavaType: '8va', displayPitch: adjustedPitch, shift: -1 };
    } else if (midi < range.min - 24) {
        // Note is extremely low - needs 22mb (display three octaves higher)
        const adjustedPitch = adjustPitchByOctave(pitch, 3);
        return { needsOttava: true, ottavaType: '22mb', displayPitch: adjustedPitch, shift: 3 };
    } else if (midi < range.min - 12) {
        // Note is very low - needs 15mb (display two octaves higher)
        const adjustedPitch = adjustPitchByOctave(pitch, 2);
        return { needsOttava: true, ottavaType: '15mb', displayPitch: adjustedPitch, shift: 2 };
    } else if (midi < range.min) {
        // Note is too low - needs 8vb (display one octave higher)
        const adjustedPitch = adjustPitchByOctave(pitch, 1);
        return { needsOttava: true, ottavaType: '8vb', displayPitch: adjustedPitch, shift: 1 };
    }

    return { needsOttava: false, ottavaType: null, displayPitch: pitch, shift: 0 };
}

/**
 * Adjust a pitch by a number of octaves
 * @param {string} pitch - Pitch like "C4" or "E#6" (supports negative octaves like "C-1")
 * @param {number} octaveShift - Number of octaves to shift (positive = up, negative = down)
 * @returns {string} Adjusted pitch
 */
function adjustPitchByOctave(pitch, octaveShift) {
    const match = pitch.match(/^([A-G][#b]?)(-?\d+)$/);
    if (!match) return pitch;

    const noteName = match[1];
    let octave = parseInt(match[2]) + octaveShift;

    // Clamp to valid range (0-9)
    if (octave < 0) octave = 0;
    if (octave > 9) octave = 9;

    return `${noteName}${octave}`;
}

/**
 * MeasureIsolationEditor - VexFlow-based direct editing
 */
export class MeasureIsolationEditor {
    constructor(options = {}) {
        this.compositionState = options.compositionState;
        this.onApplyCallback = options.onApply || (() => {});
        this.onCancelCallback = options.onCancel || (() => {});

        // Multi-measure support
        this.centerMeasureIndex = null;     // The originally selected measure
        this.showPrevious = false;          // Toggle for previous measure
        this.showNext = false;              // Toggle for next measure
        this.measureCount = 1;              // Number of measures currently shown

        // Legacy alias (for backward compatibility during refactor)
        this.measureIndex = null;

        this.slotGrid = null;
        this.modal = null;

        // Current editing state
        this.currentDuration = '4n';
        this.isDotted = false;
        this.isRestMode = false;
        this.currentAccidental = null;  // null = use key signature, 'n' = explicit natural, '#', 'b'
        this.currentVoice = 0;  // 0 or 1

        // Mode state: Alt-based switching with optional sticky toggle
        // When noteEntryModeSticky is OFF (default):
        //   - Normal click = Select mode
        //   - Alt+Click = Note Entry mode
        // When noteEntryModeSticky is ON:
        //   - Normal click = Note Entry mode
        //   - Alt+Click = Select mode (inverted)
        this.noteEntryModeSticky = false;  // The toggle state - default OFF for safer editing
        this.isAltPressed = false;         // Tracks Alt key state for ghost note

        // Multi-selection state (replaces single selectedNote for multi-measure)
        this.selectedNotes = new Set();     // IDs: "{measureOffset}-{clef}-{voice}-{slotIndex}"
        this.lastSelectedNote = null;       // For shift-click range selection
        // Legacy alias for single selection (backward compatibility)
        this.selectedNote = null;           // { clef, voice, slotIndex }

        // Ghost note state (for preview on hover - only shown in entry mode)
        this.ghostNote = null;  // { clef, slotIndex, pitch, x, y }

        // Track last mouse position for each clef (to restore ghost note when Alt is pressed)
        this.lastMousePosition = { treble: null, bass: null };  // { x, y, slotIndex, pitch }

        // Smart Suggestions panel state
        this.suggestionsPanelExpanded = true;  // Panel expanded by default
        this.focusedClef = 'treble';           // Track which clef user is interacting with

        // Musical context hints state (leading tone arrows, etc.)
        this.showMusicalHints = true;          // Show musical context hints by default

        // Canvas and rendering
        this.trebleCanvas = null;
        this.bassCanvas = null;

        // Layout constants matching VexFlow
        this.BASE_MEASURE_WIDTH = 900; // Width per measure (excluding clef/key sig area)
        this.STAFF_WIDTH = 1000;       // Total canvas width (dynamically updated for multi-measure)
        this.TREBLE_CANVAS_HEIGHT = 135; // Treble: room above for 8va brackets, room below for 8vb brackets
        this.BASS_CANVAS_HEIGHT = 140;   // Bass: less above, more room below for low notes
        this.CANVAS_HEIGHT = 140;      // Legacy fallback
        this.SLOT_WIDTH = null;        // Calculated based on time signature (data precision)
        this.VISUAL_SLOTS_PER_BEAT = 8; // Visual grid divisions per beat (coarser than data slots)
        this.VISUAL_SLOT_WIDTH = null;  // Width of visual grid cells (for display only)
        this.CLEF_WIDTH = 70;
        this.START_X = 100;            // Where notes begin (after clef)

        // VexFlow-compatible staff layout
        this.LINE_SPACING = 10;        // 10px between staff lines (standard VexFlow)
        this.STAFF_HEIGHT = 40;        // 5 lines = 4 gaps × 10px = 40px
        this.TREBLE_STAFF_TOP_Y = 55;  // Treble: extra space for ottava brackets (8va/15ma/22ma)
        this.BASS_STAFF_TOP_Y = 30;    // Bass: less above, more room below
        this.STAFF_TOP_Y = 35;         // Legacy fallback
        this.PIXELS_PER_STEP = 5;      // 5px per diatonic step (half line spacing)

        this._createModal();
    }

    /**
     * Create the modal DOM structure
     */
    _createModal() {
        // Always remove existing modal to ensure we have latest HTML structure
        const existingModal = document.getElementById('measure-isolation-modal');
        if (existingModal) {
            existingModal.remove();
        }

        this.modal = document.createElement('div');
        this.modal.id = 'measure-isolation-modal';
        this.modal.className = 'fixed inset-0 bg-black bg-opacity-50 hidden z-[100000] flex items-center justify-center p-4';
        this.modal.innerHTML = `
            <!-- Scrollbar styles - force native scrollbar visibility -->
            <style>
                .mie-scrollable-staves {
                    overflow-x: scroll !important;
                    overflow-y: hidden !important;
                    max-width: 100%;
                    padding-bottom: 4px;
                }
                /* Force scrollbar to always show (not overlay) */
                .mie-scrollable-staves {
                    scrollbar-width: auto;
                    scrollbar-color: #6366f1 #e5e7eb;
                }
                /* Webkit/Chrome scrollbar - force visibility */
                .mie-scrollable-staves::-webkit-scrollbar {
                    -webkit-appearance: scrollbar !important;
                    height: 14px !important;
                    background: #e5e7eb;
                }
                .mie-scrollable-staves::-webkit-scrollbar-track {
                    background: #e5e7eb;
                    border-radius: 0;
                }
                .mie-scrollable-staves::-webkit-scrollbar-thumb {
                    background: #6366f1;
                    border-radius: 7px;
                    border: 3px solid #e5e7eb;
                    min-width: 40px;
                }
                .mie-scrollable-staves::-webkit-scrollbar-thumb:hover {
                    background: #4f46e5;
                }
                .mie-scrollable-staves::-webkit-scrollbar-button {
                    display: none;
                }
            </style>
            <div class="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
                <!-- Header -->
                <div class="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/>
                        </svg>
                        <h2 class="text-xl font-bold" id="mie-title">Measure Editor</h2>
                    </div>
                    <button id="mie-close-btn" class="p-2 hover:bg-white/20 rounded-lg transition-colors" title="Close (Esc)">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <!-- Toolbar -->
                <div class="px-4 py-2 bg-gray-100 border-b flex items-center gap-4 flex-wrap">
                    <!-- Duration buttons -->
                    <div class="flex items-center gap-1">
                        <span class="text-xs text-gray-500 mr-1">Duration:</span>
                        <button class="mie-dur-btn px-3 py-1.5 border rounded text-lg hover:bg-indigo-100" data-duration="1n" title="Whole (1)">𝅝</button>
                        <button class="mie-dur-btn px-3 py-1.5 border rounded text-lg hover:bg-indigo-100" data-duration="2n" title="Half (2)">𝅗𝅥</button>
                        <button class="mie-dur-btn px-3 py-1.5 border rounded text-lg bg-indigo-100 border-indigo-400" data-duration="4n" title="Quarter (3)">♩</button>
                        <button class="mie-dur-btn px-3 py-1.5 border rounded text-lg hover:bg-indigo-100" data-duration="8n" title="Eighth (4)">♪</button>
                        <button class="mie-dur-btn px-3 py-1.5 border rounded text-lg hover:bg-indigo-100" data-duration="16n" title="16th (5)">𝅘𝅥𝅯</button>
                        <button class="mie-dur-btn px-3 py-1.5 border rounded text-lg hover:bg-indigo-100" data-duration="32n" title="32nd (6)">𝅘𝅥𝅰</button>
                    </div>

                    <!-- Dotted -->
                    <label class="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" id="mie-dotted" class="w-4 h-4">
                        <span class="text-sm">Dotted (.)</span>
                    </label>

                    <!-- Accidentals -->
                    <div class="flex items-center gap-1">
                        <span class="text-xs text-gray-500 mr-1">Accidental:</span>
                        <button class="mie-acc-btn px-2 py-1 border rounded hover:bg-gray-200 bg-gray-100" data-accidental="key" title="Use key signature (K)">Key</button>
                        <button class="mie-acc-btn px-2 py-1 border rounded hover:bg-gray-200" data-accidental="n" title="Natural - override key signature (N)">♮</button>
                        <button class="mie-acc-btn px-2 py-1 border rounded hover:bg-gray-200" data-accidental="#" title="Sharp (S)">♯</button>
                        <button class="mie-acc-btn px-2 py-1 border rounded hover:bg-gray-200" data-accidental="b" title="Flat (F)">♭</button>
                    </div>

                    <!-- Rest mode toggle -->
                    <div class="flex items-center gap-1">
                        <span class="text-xs text-gray-500 mr-1">Mode:</span>
                        <button id="mie-rest-btn" class="px-3 py-1.5 border rounded hover:bg-amber-100 text-lg flex items-center gap-1" title="Toggle Rest Mode (R)">
                            <span class="text-base">𝄽</span>
                            <span class="text-xs font-medium">Rest</span>
                        </button>
                    </div>

                    <!-- Voice selector -->
                    <div class="flex items-center gap-1">
                        <span class="text-xs text-gray-500 mr-1">Voice:</span>
                        <button class="mie-voice-btn px-2 py-1 border rounded bg-blue-100 border-blue-400" data-voice="0">V1</button>
                        <button class="mie-voice-btn px-2 py-1 border rounded hover:bg-gray-200" data-voice="1">V2</button>
                    </div>

                    <!-- Delete selected note -->
                    <button id="mie-delete-btn" class="px-3 py-1.5 border rounded hover:bg-red-100 text-red-600 opacity-50" title="Delete Selected (Del/Backspace)" disabled>🗑 Delete</button>
                </div>

                <!-- Mode & View Toolbar -->
                <div class="px-4 py-2 bg-gray-50 border-b flex items-center gap-6">
                    <!-- Sticky Entry Mode Toggle -->
                    <div class="flex items-center gap-2 ml-auto">
                        <span class="text-xs text-gray-500" title="When ON, click to add notes. When OFF, hold Alt to add notes.">Entry Mode:</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="mie-sticky-toggle" class="sr-only peer" checked>
                            <div class="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer
                                        peer-checked:after:translate-x-full peer-checked:after:border-white
                                        after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                        after:bg-white after:border-gray-300 after:border after:rounded-full
                                        after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                        </label>
                        <span id="mie-sticky-status" class="text-xs text-gray-500">Click to Add</span>
                    </div>
                    <!-- Previous/Next Measure Toggles -->
                    <div class="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300">
                        <span class="text-xs text-gray-500">View:</span>
                        <label id="mie-prev-label" class="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" id="mie-show-prev" class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                            <span class="text-sm text-gray-700">Prev</span>
                        </label>
                        <label id="mie-next-label" class="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" id="mie-show-next" class="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500">
                            <span class="text-sm text-gray-700">Next</span>
                        </label>
                    </div>
                    <!-- Musical Hints Toggle & Legend -->
                    <div class="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300">
                        <div class="flex items-center gap-1.5" title="Show tendency tone hints (leading tones, tritones, chord tones, etc.)">
                            <span class="text-xs text-gray-600">Hints</span>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="mie-show-hints" class="sr-only peer" checked>
                                <div class="w-8 h-4 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer
                                            peer-checked:after:translate-x-full peer-checked:after:border-white
                                            after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                            after:bg-white after:border-gray-300 after:border after:rounded-full
                                            after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-500"></div>
                            </label>
                        </div>
                        <button id="mie-hints-legend-btn" class="px-2 py-0.5 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 rounded transition-colors" title="View hint legend">
                            <span class="font-medium">?</span> Legend
                        </button>
                    </div>
                </div>

                <!-- Instructions -->
                <div class="px-4 py-2 bg-blue-50 text-sm text-blue-800 border-b">
                    <strong>Click to add notes</strong> at the selected duration.
                    <strong>Hold <kbd class="px-1 bg-white rounded">Alt</kbd></strong> to select existing notes.
                    When selected: <kbd class="px-1 bg-white rounded">←→</kbd> move, <kbd class="px-1 bg-white rounded">↑↓</kbd> transpose, <kbd class="px-1 bg-white rounded">1-6</kbd> duration, <kbd class="px-1 bg-white rounded">S/F/N/K</kbd> accidentals, <kbd class="px-1 bg-white rounded">R</kbd> rest, <kbd class="px-1 bg-white rounded">Del</kbd> delete.
                    <kbd class="px-1 bg-white rounded">.</kbd> dotted, <kbd class="px-1 bg-white rounded">Space</kbd> play, <kbd class="px-1 bg-white rounded">Ctrl+←→</kbd> prev/next measure.
                </div>

                <!-- Smart Suggestions Panel -->
                <div id="mie-suggestions-panel" class="border-b bg-gradient-to-r from-purple-50 to-indigo-50">
                    <!-- Collapsible Header with Clef Toggle -->
                    <div id="mie-suggestions-header" class="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-purple-100/50 transition-colors">
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                            </svg>
                            <span class="text-sm font-semibold text-purple-800">Smart Suggestions</span>
                            <span id="mie-suggestions-chord-context" class="text-xs text-purple-600 font-medium px-2 py-0.5 bg-white/60 rounded-full"></span>
                            <!-- Clef Toggle -->
                            <div id="mie-clef-toggle" class="flex items-center gap-0.5 ml-2 bg-white/70 rounded-full p-0.5 border border-purple-200" onclick="event.stopPropagation()">
                                <button id="mie-clef-treble-btn" class="px-2 py-0.5 text-xs font-medium rounded-full transition-colors bg-purple-600 text-white"
                                        onclick="window.mieInstance && window.mieInstance._setClefToggle('treble')" title="Show treble suggestions">
                                    𝄞 Treble
                                </button>
                                <button id="mie-clef-bass-btn" class="px-2 py-0.5 text-xs font-medium rounded-full transition-colors text-purple-600 hover:bg-purple-100"
                                        onclick="window.mieInstance && window.mieInstance._setClefToggle('bass')" title="Show bass suggestions">
                                    𝄢 Bass
                                </button>
                            </div>
                        </div>
                        <button id="mie-suggestions-toggle" class="p-1 hover:bg-purple-200/50 rounded transition-colors" title="Toggle suggestions panel">
                            <svg id="mie-suggestions-chevron" class="w-4 h-4 text-purple-600 transform rotate-0 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                            </svg>
                        </button>
                    </div>

                    <!-- Collapsible Content -->
                    <div id="mie-suggestions-content" class="px-4 pb-3">
                        <div class="flex flex-wrap gap-4 items-start">
                            <!-- Chord Tones Section (both clefs) -->
                            <div class="flex-shrink-0">
                                <div class="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                                    <span class="w-2 h-2 rounded-full bg-green-500"></span>
                                    Chord Tones
                                </div>
                                <div id="mie-chord-tones" class="flex gap-1 flex-wrap">
                                    <!-- Populated dynamically -->
                                </div>
                            </div>

                            <!-- Scale Tones Section (both clefs) -->
                            <div class="flex-shrink-0">
                                <div class="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                                    <span class="w-2 h-2 rounded-full bg-orange-500"></span>
                                    Scale Tones
                                </div>
                                <div id="mie-scale-tones" class="flex gap-1 flex-wrap">
                                    <!-- Populated dynamically -->
                                </div>
                            </div>

                            <!-- Tensions Section (both clefs) -->
                            <div id="mie-tensions-section" class="flex-shrink-0">
                                <div class="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                                    <span class="w-2 h-2 rounded-full bg-purple-500"></span>
                                    Tensions
                                </div>
                                <div id="mie-tensions" class="flex gap-1 flex-wrap">
                                    <!-- Populated dynamically -->
                                </div>
                            </div>

                            <!-- TREBLE-SPECIFIC: Melody Pattern Section -->
                            <div id="mie-melodic-pattern-section" class="flex-shrink-0">
                                <div class="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>
                                    Melody Pattern
                                    <span id="mie-contour-indicator" class="text-gray-400 font-normal"></span>
                                </div>
                                <div id="mie-melodic-patterns" class="flex gap-1 flex-wrap">
                                    <!-- Populated dynamically with pattern suggestions -->
                                </div>
                            </div>

                            <!-- BASS-SPECIFIC: Bass Tools Section -->
                            <div id="mie-bass-patterns-section" class="flex-shrink-0 hidden" title="Auto-generate a complete bass line for this measure based on the selected pattern style">
                                <div class="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1 cursor-help"
                                     title="Choose a pattern style, then click Apply to fill this measure with bass notes matching that style">
                                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                                    Bass Pattern
                                </div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <select id="mie-bass-pattern-select" class="text-xs border rounded px-2 py-1 bg-white cursor-help" style="max-width: 120px;"
                                            title="Whole Note: Single sustained root note&#10;Root-Fifth: Alternates root and 5th&#10;Arpeggio: Plays chord tones in sequence&#10;Walking: Jazz-style stepwise motion&#10;Stride: Left-hand piano style (bass-chord)">
                                        <optgroup label="─ Basic ─">
                                            <option value="whole-note" title="Single sustained root note for the entire measure">Whole Note</option>
                                            <option value="root-fifth" title="Alternates between root and 5th - classic rock/pop pattern">Root-Fifth</option>
                                            <option value="pedal" title="Repeats the root note - creates drive and momentum">Pedal</option>
                                        </optgroup>
                                        <optgroup label="─ Arpeggiated ─">
                                            <option value="arpeggio" title="Plays chord tones in ascending/descending sequence">Arpeggio</option>
                                            <option value="alberti" title="Classical broken chord pattern (low-high-mid-high)">Alberti</option>
                                        </optgroup>
                                        <optgroup label="─ Jazz ─">
                                            <option value="walking" title="Stepwise motion connecting chord tones - jazz standard">Walking</option>
                                            <option value="stride" title="Alternates bass note with chord voicing - stride piano">Stride</option>
                                        </optgroup>
                                        <optgroup label="─ Pop/Rock ─">
                                            <option value="driving-rock" title="Driving eighth notes on root - energetic rock feel">Rock</option>
                                            <option value="motown" title="Syncopated rhythm with chromatic approaches">Motown</option>
                                            <option value="funk" title="Syncopated 16th note grooves with ghost notes">Funk</option>
                                        </optgroup>
                                        <optgroup label="─ Other ─">
                                            <option value="bossa-nova" title="Brazilian syncopated pattern - bossa nova rhythm">Bossa</option>
                                            <option value="country" title="Root-fifth alternating bass - country/folk style">Country</option>
                                            <option value="waltz" title="Oom-pah-pah pattern for 3/4 time">Waltz</option>
                                        </optgroup>
                                    </select>
                                    <button id="mie-apply-bass-pattern" class="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                                            title="Replace current bass notes with the selected pattern. This will overwrite any existing bass notes in this measure.">
                                        Apply
                                    </button>
                                </div>
                            </div>

                            <!-- BASS-SPECIFIC: Approach Notes Section -->
                            <div id="mie-bass-approach-section" class="flex-shrink-0 hidden"
                                 title="Approach notes lead smoothly into the next chord. Place these near the end of the measure to create smooth voice leading.">
                                <div class="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1 cursor-help"
                                     title="Click a note to add it. These notes resolve stepwise to the next chord's root, creating smooth bass motion.">
                                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
                                    Approach → Next
                                </div>
                                <div id="mie-bass-approach-notes" class="flex gap-1 text-xs">
                                    <!-- Populated dynamically -->
                                </div>
                            </div>

                            <!-- BASS-SPECIFIC: Tips Section -->
                            <div id="mie-bass-tips-section" class="flex-shrink-0 hidden"
                                 title="Context-aware suggestions based on chord function and melody direction">
                                <div class="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1 cursor-help"
                                     title="Tips based on harmonic function and voice leading principles">
                                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                                    Tips
                                </div>
                                <div id="mie-bass-tips-content" class="flex gap-2 text-xs flex-wrap">
                                    <!-- Populated dynamically: role indicator, contrary motion hint -->
                                </div>
                            </div>

                            <!-- Next Note Suggestions Section (shown when a note is selected) -->
                            <div id="mie-next-note-section" class="flex-shrink-0 hidden">
                                <div class="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
                                    Next Note <span class="text-gray-400 font-normal">(Tab)</span>
                                </div>
                                <div id="mie-next-note-suggestions" class="flex gap-1 flex-wrap">
                                    <!-- Populated dynamically -->
                                </div>
                            </div>

                            <!-- Hidden legacy containers -->
                            <div id="mie-bass-voice-leading" class="hidden"></div>
                            <div id="mie-bass-tips" class="hidden"></div>
                            <div id="mie-contrary-motion" class="hidden"><div id="mie-contrary-motion-hint"></div></div>
                            <div id="mie-common-bass-progressions" class="hidden"><div id="mie-bass-progression-hints"></div></div>
                            <div id="mie-bass-role-indicator" class="hidden"></div>
                            <div id="mie-bass-range-guide" class="hidden"></div>

                            <!-- Rest Suggestions Section - Hidden for now (too simplistic) -->
                            <div id="mie-rest-suggestions-section" class="flex-shrink-0 hidden">
                                <div class="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                                    <span class="text-lg leading-none">𝄽</span>
                                    Rest Suggestions
                                </div>
                                <div id="mie-rest-suggestions" class="text-xs text-gray-600">
                                    <!-- Populated dynamically with rest placement suggestions -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Main Content: The two staves -->
                <div class="flex-1 overflow-y-auto p-4 bg-gray-50">
                    <!-- Scrollable container for staves (horizontal scroll for multi-measure) -->
                    <div id="mie-staves-scroll-container" class="mie-scrollable-staves">
                        <!-- Inner wrapper to ensure canvases don't shrink -->
                        <div id="mie-staves-inner" style="display: inline-block; min-width: max-content;">
                            <!-- Measure Numbers Row -->
                            <div id="mie-measure-numbers" class="flex mb-2" style="min-height: 28px;"></div>

                            <!-- Treble Staff -->
                            <div class="mb-2">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="text-sm font-medium text-gray-600 w-20">Treble</span>
                                </div>
                                <div id="mie-treble-container" class="bg-white border rounded overflow-hidden cursor-crosshair">
                                    <canvas id="mie-treble-canvas"></canvas>
                                </div>
                            </div>

                            <!-- Bass Staff -->
                            <div>
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="text-sm font-medium text-gray-600 w-20">Bass</span>
                                </div>
                                <div id="mie-bass-container" class="bg-white border rounded overflow-hidden cursor-crosshair">
                                    <canvas id="mie-bass-canvas"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Fill Stats -->
                    <div id="mie-fill-stats" class="mt-3 p-3 bg-white rounded-lg border text-sm"></div>
                </div>

                <!-- Footer -->
                <div class="px-6 py-3 bg-gray-100 border-t flex justify-between items-center">
                    <div class="flex items-center gap-4">
                        <div id="mie-status" class="text-sm text-gray-600">Click on staff to add notes</div>
                        <button id="mie-play-btn" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2" title="Play measure (Space)">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            Play
                        </button>
                        <button id="mie-stop-btn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors hidden flex items-center gap-2" title="Stop">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"/></svg>
                            Stop
                        </button>
                    </div>
                    <div class="flex gap-2">
                        <button id="mie-cancel-btn" class="px-4 py-2 border rounded-lg hover:bg-gray-200 transition-colors" title="Discard all changes and close">Cancel</button>
                        <button id="mie-apply-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors" title="Apply changes (stays open)">Apply</button>
                        <button id="mie-close-apply-btn" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors" title="Apply changes and close">Apply & Close</button>
                    </div>
                </div>
            </div>

            <!-- Musical Hints Legend Modal -->
            <div id="mie-hints-legend-modal" class="hidden absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden max-h-[90vh] flex flex-col">
                    <div class="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between flex-shrink-0">
                        <h3 class="font-semibold">Musical Context Hints</h3>
                        <button id="mie-legend-close-btn" class="p-1 hover:bg-white/20 rounded transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    <div class="p-4 space-y-2 overflow-y-auto flex-1">
                        <p class="text-sm text-gray-600 mb-3">These hints appear on notes to help you make informed compositional decisions:</p>

                        <!-- Section: Tendency Tones -->
                        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2 mb-1">Tendency Tones</div>

                        <!-- Leading Tone -->
                        <div class="flex items-center gap-2 p-1.5 bg-red-50 rounded border border-red-200">
                            <span class="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded border border-red-300 whitespace-nowrap">→ C</span>
                            <div class="flex-1 min-w-0">
                                <span class="font-medium text-red-800 text-xs">Leading Tone</span>
                                <span class="text-[10px] text-red-600 ml-1">– resolves up to tonic (e.g., B → C)</span>
                            </div>
                        </div>

                        <!-- Chord 7th -->
                        <div class="flex items-center gap-2 p-1.5 bg-purple-50 rounded border border-purple-200">
                            <span class="px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 rounded border border-purple-300 whitespace-nowrap">7↓</span>
                            <div class="flex-1 min-w-0">
                                <span class="font-medium text-purple-800 text-xs">Chord 7th</span>
                                <span class="text-[10px] text-purple-600 ml-1">– typically resolves down by step</span>
                            </div>
                        </div>

                        <!-- Tritone -->
                        <div class="flex items-center gap-2 p-1.5 bg-red-50 rounded border border-red-200">
                            <span class="px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-700 rounded border border-red-300 whitespace-nowrap">⟷</span>
                            <div class="flex-1 min-w-0">
                                <span class="font-medium text-red-800 text-xs">Tritone</span>
                                <span class="text-[10px] text-red-600 ml-1">– unstable, resolve inward or outward</span>
                            </div>
                        </div>

                        <!-- Scale Degree 4 -->
                        <div class="flex items-center gap-2 p-1.5 bg-amber-50 rounded border border-amber-200">
                            <span class="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded border border-amber-300 whitespace-nowrap">↓ E</span>
                            <div class="flex-1 min-w-0">
                                <span class="font-medium text-amber-800 text-xs">Scale Degree 4</span>
                                <span class="text-[10px] text-amber-600 ml-1">– often resolves down to 3rd</span>
                            </div>
                        </div>

                        <!-- Suspension -->
                        <div class="flex items-center gap-2 p-1.5 bg-amber-50 rounded border border-amber-200">
                            <span class="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded border border-amber-300 whitespace-nowrap">4→3</span>
                            <div class="flex-1 min-w-0">
                                <span class="font-medium text-amber-800 text-xs">Suspension</span>
                                <span class="text-[10px] text-amber-600 ml-1">– resolve 4 down to 3</span>
                            </div>
                        </div>

                        <!-- Section: Minor Key -->
                        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1">Minor Key Hints</div>

                        <!-- Raised 6th -->
                        <div class="flex items-center gap-2 p-1.5 bg-cyan-50 rounded border border-cyan-200">
                            <span class="px-1.5 py-0.5 text-[10px] font-bold bg-cyan-100 text-cyan-700 rounded border border-cyan-300 whitespace-nowrap">↑ G#</span>
                            <div class="flex-1 min-w-0">
                                <span class="font-medium text-cyan-800 text-xs">Raised 6th</span>
                                <span class="text-[10px] text-cyan-600 ml-1">– continue up (melodic minor)</span>
                            </div>
                        </div>

                        <!-- Subtonic -->
                        <div class="flex items-center gap-2 p-1.5 bg-cyan-50 rounded border border-cyan-200">
                            <span class="px-1.5 py-0.5 text-[10px] font-bold bg-cyan-100 text-cyan-700 rounded border border-cyan-300 whitespace-nowrap">↓ F</span>
                            <div class="flex-1 min-w-0">
                                <span class="font-medium text-cyan-800 text-xs">Subtonic (♭7)</span>
                                <span class="text-[10px] text-cyan-600 ml-1">– descend (natural minor)</span>
                            </div>
                        </div>

                        <!-- Section: Approach Notes -->
                        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1">Approach Notes</div>

                        <!-- Chromatic Approach -->
                        <div class="flex items-center gap-2 p-1.5 bg-emerald-50 rounded border border-emerald-200">
                            <span class="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded border border-emerald-300 whitespace-nowrap">↑ E</span>
                            <div class="flex-1 min-w-0">
                                <span class="font-medium text-emerald-800 text-xs">Chromatic Approach</span>
                                <span class="text-[10px] text-emerald-600 ml-1">– half step to chord tone</span>
                            </div>
                        </div>

                        <!-- Section: Chord Tones -->
                        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1">Chord Tone Functions</div>

                        <div class="grid grid-cols-3 gap-1.5">
                            <!-- Root -->
                            <div class="flex items-center gap-1.5 p-1.5 bg-green-50 rounded border border-green-200">
                                <span class="px-1.5 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 rounded border border-green-300">R</span>
                                <span class="font-medium text-green-800 text-[10px]">Root</span>
                            </div>
                            <!-- 3rd -->
                            <div class="flex items-center gap-1.5 p-1.5 bg-blue-50 rounded border border-blue-200">
                                <span class="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded border border-blue-300">3rd</span>
                                <span class="font-medium text-blue-800 text-[10px]">Third</span>
                            </div>
                            <!-- 5th -->
                            <div class="flex items-center gap-1.5 p-1.5 bg-slate-50 rounded border border-slate-200">
                                <span class="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded border border-slate-300">5th</span>
                                <span class="font-medium text-slate-800 text-[10px]">Fifth</span>
                            </div>
                        </div>

                        <!-- Section: Color Notes -->
                        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1">Color Notes</div>

                        <!-- Blue Notes -->
                        <div class="flex items-center gap-2 p-1.5 bg-purple-50 rounded border border-purple-200">
                            <span class="px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 rounded border border-purple-300 whitespace-nowrap">♭3 / ♭7</span>
                            <div class="flex-1 min-w-0">
                                <span class="font-medium text-purple-800 text-xs">Blue Notes</span>
                                <span class="text-[10px] text-purple-600 ml-1">– adds blues/jazz color</span>
                            </div>
                        </div>

                        <!-- Section: Non-Chord Tones -->
                        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-3 mb-1">Non-Chord Tones</div>

                        <!-- NCT -->
                        <div class="flex items-center gap-2 p-1.5 bg-gray-50 rounded border border-gray-200">
                            <span class="px-1.5 py-0.5 text-[10px] font-bold bg-gray-200 text-gray-700 rounded border border-gray-300 whitespace-nowrap">NCT</span>
                            <div class="flex-1 min-w-0">
                                <span class="font-medium text-gray-800 text-xs">Non-Chord Tone</span>
                                <span class="text-[10px] text-gray-600 ml-1">– consider resolving to chord tone</span>
                            </div>
                        </div>

                        <p class="text-[10px] text-gray-500 mt-3 pt-2 border-t">Tip: Use the Hints toggle to show/hide these annotations.</p>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(this.modal);
        this._attachEventListeners();
    }

    /**
     * Attach all event listeners
     */
    _attachEventListeners() {
        // Cancel button - discards changes and closes
        this.modal.querySelector('#mie-cancel-btn')?.addEventListener('click', () => this.cancel());

        // Apply button - applies changes but keeps modal open
        this.modal.querySelector('#mie-apply-btn')?.addEventListener('click', () => this.applyWithoutClose());

        // Close button (header X) - discards changes and closes modal (same as Cancel)
        this.modal.querySelector('#mie-close-btn')?.addEventListener('click', () => this.cancel());

        // Close button (footer) - applies changes and closes modal
        this.modal.querySelector('#mie-close-apply-btn')?.addEventListener('click', () => this.apply());

        // Duration buttons
        this.modal.querySelectorAll('.mie-dur-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newDuration = e.currentTarget.dataset.duration;
                this.currentDuration = newDuration;
                this._updateDurationButtons();

                // If a note is selected, update its duration
                if (this.selectedNote) {
                    this._changeSelectedNoteDuration(newDuration, this.isDotted);
                } else {
                    this._updateStatus(`Duration: ${this._getDurationName(this.currentDuration)}`);
                }
            });
        });

        // Dotted checkbox
        this.modal.querySelector('#mie-dotted')?.addEventListener('change', (e) => {
            this.isDotted = e.target.checked;

            // If a note is selected, update its dotted state
            if (this.selectedNote) {
                this._changeSelectedNoteDuration(this.currentDuration, this.isDotted);
            }
        });

        // Play button
        this.modal.querySelector('#mie-play-btn')?.addEventListener('click', () => {
            this._playMeasure();
        });

        // Stop button
        this.modal.querySelector('#mie-stop-btn')?.addEventListener('click', () => {
            this._stopPlayback();
        });

        // Accidental buttons
        this.modal.querySelectorAll('.mie-acc-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const accidental = e.currentTarget.dataset.accidental;
                // 'key' means use key signature (null), otherwise use the explicit accidental
                this.currentAccidental = accidental === 'key' ? null : accidental;
                this._updateAccidentalButtons();

                // If a note is selected, apply the accidental to it
                if (this.selectedNote) {
                    if (accidental === 'key') {
                        this._applyKeySignatureAccidentalToSelectedNote();
                    } else if (accidental === 'n') {
                        this._applyAccidentalToSelectedNote('');  // Natural = no accidental
                    } else {
                        this._applyAccidentalToSelectedNote(accidental);
                    }
                }
            });
        });

        // Rest button
        this.modal.querySelector('#mie-rest-btn')?.addEventListener('click', () => {
            // If a note or rest is selected, toggle between note/rest
            if (this.selectedNote) {
                this._toggleSelectedNoteRest();
            } else {
                // Toggle rest mode for new entries
                this.isRestMode = !this.isRestMode;
                this._updateModeButtons();
            }
        });

        // Delete button (deletes selected note)
        this.modal.querySelector('#mie-delete-btn')?.addEventListener('click', () => {
            this._deleteSelectedNote();
        });

        // Voice buttons
        this.modal.querySelectorAll('.mie-voice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentVoice = parseInt(e.currentTarget.dataset.voice);
                this._updateVoiceButtons();
            });
        });

        // Sticky entry mode toggle
        this.modal.querySelector('#mie-sticky-toggle')?.addEventListener('change', (e) => {
            this.noteEntryModeSticky = e.target.checked;
            this._updateStickyToggleStatus();
            this._updateModeStatus();
            // Clear ghost note if leaving entry mode
            if (!this._isInNoteEntryMode() && this.ghostNote) {
                this.ghostNote = null;
            }
            this._renderStaves();
        });

        // Previous/Next measure toggles
        this.modal.querySelector('#mie-show-prev')?.addEventListener('change', (e) => {
            this.showPrevious = e.target.checked;
            this._reloadMeasures();
        });
        this.modal.querySelector('#mie-show-next')?.addEventListener('change', (e) => {
            this.showNext = e.target.checked;
            this._reloadMeasures();
        });

        // Musical hints toggle
        this.modal.querySelector('#mie-show-hints')?.addEventListener('change', (e) => {
            this.showMusicalHints = e.target.checked;
            this._renderStaves();  // Re-render to show/hide hints
        });

        // Musical hints legend button
        this.modal.querySelector('#mie-hints-legend-btn')?.addEventListener('click', () => {
            this._showHintsLegend();
        });

        // Legend modal close button
        this.modal.querySelector('#mie-legend-close-btn')?.addEventListener('click', () => {
            this._hideHintsLegend();
        });

        // Close legend when clicking backdrop
        this.modal.querySelector('#mie-hints-legend-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'mie-hints-legend-modal') {
                this._hideHintsLegend();
            }
        });

        // Note: Measure navigation buttons are now created dynamically in _updateMeasureNumbers()
        // and their listeners are attached in _attachNavigationButtonListeners()

        // Keyboard shortcuts - use document level handler since canvas clicks don't maintain focus
        // Store the bound handler so we can remove it later
        // Use capture phase (true) to intercept events BEFORE they reach other handlers
        this._boundKeydownHandler = (e) => {
            // Only handle if modal is visible
            if (!this.modal.classList.contains('hidden')) {
                this._handleKeydown(e);
                // Stop propagation to prevent noteEditor from also handling this event
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        };
        document.addEventListener('keydown', this._boundKeydownHandler, true);  // capture phase

        // Track Alt key release for mode switching
        this._boundKeyupHandler = (e) => {
            if (!this.modal.classList.contains('hidden')) {
                this._handleKeyup(e);
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        };
        document.addEventListener('keyup', this._boundKeyupHandler, true);  // capture phase

        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.cancel();
            }
        });

        // Smart Suggestions Panel: collapse/expand
        const suggestionsHeader = this.modal.querySelector('#mie-suggestions-header');
        const suggestionsToggle = this.modal.querySelector('#mie-suggestions-toggle');
        if (suggestionsHeader) {
            suggestionsHeader.addEventListener('click', () => this._toggleSuggestionsPanel());
        }
        if (suggestionsToggle) {
            suggestionsToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggleSuggestionsPanel();
            });
        }

        // Bass pattern apply button
        this.modal.querySelector('#mie-apply-bass-pattern')?.addEventListener('click', () => {
            this._applyBassPattern();
        });
    }

    /**
     * Handle keyboard shortcuts
     */
    _handleKeydown(e) {
        // Track Alt key state for mode switching
        if (e.key === 'Alt') {
            if (!this.isAltPressed) {
                this.isAltPressed = true;
                this._updateModeStatus();

                // Restore ghost note from last mouse position if entering entry mode
                // and not in rest mode
                if (this._isInNoteEntryMode() && !this.isRestMode) {
                    // Try to restore ghost from whichever clef has a saved position
                    const treblePos = this.lastMousePosition.treble;
                    const bassPos = this.lastMousePosition.bass;
                    if (treblePos) {
                        this.ghostNote = {
                            clef: 'treble',
                            slotIndex: treblePos.slotIndex,
                            pitch: treblePos.pitch,
                            x: treblePos.x,
                            y: treblePos.y
                        };
                    } else if (bassPos) {
                        this.ghostNote = {
                            clef: 'bass',
                            slotIndex: bassPos.slotIndex,
                            pitch: bassPos.pitch,
                            x: bassPos.x,
                            y: bassPos.y
                        };
                    }
                }

                this._renderStaves();
            }
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            // If note is selected, deselect it; otherwise cancel modal
            if (this.selectedNote) {
                this._clearSelection();
            } else {
                this.cancel();
            }
        } else if (e.key === ' ') {
            // Space bar - play/stop
            e.preventDefault();
            const stopBtn = this.modal.querySelector('#mie-stop-btn');
            if (stopBtn && !stopBtn.classList.contains('hidden')) {
                this._stopPlayback();
            } else {
                this._playMeasure();
            }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            this._deleteSelectedNote();
        } else if (e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            // If a note or rest is selected, toggle between note/rest
            if (this.selectedNote) {
                this._toggleSelectedNoteRest();
            } else {
                // Toggle rest mode for new entries
                this.isRestMode = !this.isRestMode;
                this._updateModeButtons();
            }
        } else if (e.key >= '1' && e.key <= '6') {
            e.preventDefault();
            const durations = ['1n', '2n', '4n', '8n', '16n', '32n'];
            const newDuration = durations[parseInt(e.key) - 1];
            this.currentDuration = newDuration;
            this._updateDurationButtons();
            // If a note is selected, update its duration
            if (this.selectedNote) {
                this._changeSelectedNoteDuration(newDuration, this.isDotted);
            }
        } else if (e.key === '.') {
            e.preventDefault();
            this.isDotted = !this.isDotted;
            this.modal.querySelector('#mie-dotted').checked = this.isDotted;
            // If a note is selected, update its dotted state
            if (this.selectedNote) {
                this._changeSelectedNoteDuration(this.currentDuration, this.isDotted);
            }
        } else if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            this.currentAccidental = '#';
            this._updateAccidentalButtons();
            // If a note is selected, apply sharp to it
            if (this.selectedNote) {
                this._applyAccidentalToSelectedNote('#');
            }
        } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            this.currentAccidental = 'b';
            this._updateAccidentalButtons();
            // If a note is selected, apply flat to it
            if (this.selectedNote) {
                this._applyAccidentalToSelectedNote('b');
            }
        } else if (e.key === 'n' || e.key === 'N') {
            e.preventDefault();
            this.currentAccidental = 'n';  // Explicit natural (override key signature)
            this._updateAccidentalButtons();
            // If a note is selected, remove accidental (natural)
            if (this.selectedNote) {
                this._applyAccidentalToSelectedNote('');
            }
        } else if (e.key === 'k' || e.key === 'K') {
            e.preventDefault();
            this.currentAccidental = null;  // Use key signature
            this._updateAccidentalButtons();
            // If a note is selected, apply key signature accidental
            if (this.selectedNote) {
                this._applyKeySignatureAccidentalToSelectedNote();
            }
        } else if (e.key === 'v' || e.key === 'V') {
            e.preventDefault();
            this.currentVoice = this.currentVoice === 0 ? 1 : 0;
            this._updateVoiceButtons();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();  // Prevent background scrolling
            if (this.selectedNote) {
                // Throttle key repeats to prevent freezing
                if (!this._lastTransposeTime || Date.now() - this._lastTransposeTime > 50) {
                    this._transposeSelectedNote(1);  // Up one half step
                    this._lastTransposeTime = Date.now();
                }
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();  // Prevent background scrolling
            if (this.selectedNote) {
                // Throttle key repeats to prevent freezing
                if (!this._lastTransposeTime || Date.now() - this._lastTransposeTime > 50) {
                    this._transposeSelectedNote(-1);  // Down one half step
                    this._lastTransposeTime = Date.now();
                }
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                // Ctrl+Left: navigate to previous measure
                this._navigateToPreviousMeasure();
            } else if (this.selectedNote) {
                this._moveSelectedNoteHorizontally(-1);  // Move left one slot
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                // Ctrl+Right: navigate to next measure
                this._navigateToNextMeasure();
            } else if (this.selectedNote) {
                this._moveSelectedNoteHorizontally(1);  // Move right one slot
            }
        } else if (e.key === 't' || e.key === 'T') {
            e.preventDefault();
            // Toggle tie on selected notes (works with multi-selection)
            this._toggleTieOnSelected();
        } else if (e.key === 'Tab') {
            // Tab: accept top next note suggestion (always prevent default to avoid opening rec modal)
            e.preventDefault();
            this._handleTabForNextNote();
        }
    }

    /**
     * Handle key up events (for Alt key tracking)
     */
    _handleKeyup(e) {
        if (e.key === 'Alt') {
            this.isAltPressed = false;
            this._updateModeStatus();
            // Clear ghost note when leaving entry mode (if not in sticky mode)
            if (!this.noteEntryModeSticky) {
                this.ghostNote = null;
            }
            this._renderStaves();
        }
    }

    /**
     * Determine if currently in note entry mode
     * When noteEntryModeSticky is OFF: Alt = Entry, No Alt = Select
     * When noteEntryModeSticky is ON: No Alt = Entry, Alt = Select (inverted)
     */
    _isInNoteEntryMode() {
        if (this.noteEntryModeSticky) {
            // Sticky mode: normal is entry, Alt inverts to select
            return !this.isAltPressed;
        } else {
            // Default: normal is select, Alt enables entry
            return this.isAltPressed;
        }
    }

    /**
     * Update the status bar to show current mode
     */
    _updateModeStatus() {
        const inEntryMode = this._isInNoteEntryMode();
        const modeText = inEntryMode ? 'Note Entry' : 'Select';
        const altHint = this.noteEntryModeSticky
            ? (this.isAltPressed ? ' (Alt held)' : '')
            : (this.isAltPressed ? ' (Alt held)' : ' (hold Alt to enter)');

        if (!this.selectedNote) {
            this._updateStatus(`${modeText} Mode${altHint} - Click on staff`);
        }
    }

    /**
     * Get human-readable duration name
     */
    _getDurationName(dur) {
        const names = { '1n': 'Whole', '2n': 'Half', '4n': 'Quarter', '8n': 'Eighth', '16n': '16th', '32n': '32nd' };
        return names[dur] || dur;
    }

    /**
     * Update duration button states
     */
    _updateDurationButtons() {
        this.modal.querySelectorAll('.mie-dur-btn').forEach(btn => {
            const isActive = btn.dataset.duration === this.currentDuration;
            btn.classList.toggle('bg-indigo-100', isActive);
            btn.classList.toggle('border-indigo-400', isActive);
        });
    }

    /**
     * Update accidental button states
     */
    _updateAccidentalButtons() {
        this.modal.querySelectorAll('.mie-acc-btn').forEach(btn => {
            const btnAccidental = btn.dataset.accidental;
            // 'key' button is active when currentAccidental is null
            // Other buttons are active when they match currentAccidental
            const isActive = (btnAccidental === 'key' && this.currentAccidental === null) ||
                             (btnAccidental === this.currentAccidental);
            btn.classList.toggle('bg-gray-100', isActive);
        });

        // Update status to show current accidental mode
        this._updateModeButtons();
    }

    /**
     * Update mode button states (rest only - erase mode removed)
     */
    _updateModeButtons() {
        const restBtn = this.modal.querySelector('#mie-rest-btn');

        if (restBtn) {
            restBtn.classList.toggle('bg-amber-200', this.isRestMode);
            restBtn.classList.toggle('border-amber-400', this.isRestMode);
        }

        if (this.isRestMode) {
            this._updateStatus('Rest Mode - click to place rests');
        } else {
            // Show current accidental mode
            let accMode = '';
            if (this.currentAccidental === null) {
                accMode = this.currentKey !== 'C' ? ` (Key: ${this.currentKey})` : '';
            } else if (this.currentAccidental === 'n') {
                accMode = ' (♮ natural)';
            } else if (this.currentAccidental === '#') {
                accMode = ' (♯ sharp)';
            } else if (this.currentAccidental === 'b') {
                accMode = ' (♭ flat)';
            }
            this._updateStatus(`Click on staff to add notes${accMode}`);
        }
    }

    /**
     * Toggle the Smart Suggestions panel expanded/collapsed
     */
    _toggleSuggestionsPanel() {
        this.suggestionsPanelExpanded = !this.suggestionsPanelExpanded;
        const content = this.modal.querySelector('#mie-suggestions-content');
        const chevron = this.modal.querySelector('#mie-suggestions-chevron');

        if (content) {
            content.classList.toggle('hidden', !this.suggestionsPanelExpanded);
        }
        if (chevron) {
            chevron.classList.toggle('rotate-180', !this.suggestionsPanelExpanded);
        }
    }

    /**
     * Get chord degree labels (1, 3, 5, 7, etc.) for chord tones
     * Maps chord intervals to their traditional degree names
     * @param {object} chord - Chord object with type
     * @returns {string[]} Array of degree labels corresponding to chord tones
     */
    _getChordDegrees(chord) {
        // Map interval to degree label
        const INTERVAL_TO_DEGREE = {
            0: '1',    // Root
            2: '2',    // Major 2nd (sus2)
            3: 'b3',   // Minor 3rd
            4: '3',    // Major 3rd
            5: '4',    // Perfect 4th (sus4)
            6: 'b5',   // Diminished 5th
            7: '5',    // Perfect 5th
            8: '#5',   // Augmented 5th
            9: '6',    // Major 6th
            10: 'b7',  // Minor 7th (dominant)
            11: '7',   // Major 7th
            14: '9',   // 9th (octave + 2nd)
            17: '11',  // 11th (octave + 4th)
            18: '#11', // Augmented 11th
            21: '13',  // 13th (octave + 6th)
        };

        const chordDef = CHORD_DEFINITIONS[chord.type];
        if (!chordDef?.intervals) return [];

        return chordDef.intervals.map(interval => INTERVAL_TO_DEGREE[interval] || String(interval));
    }

    /**
     * Get scale degree labels for scale tones
     * @param {string[]} scaleTones - Array of scale tone note names
     * @param {string} keyRoot - Root of the key
     * @returns {string[]} Array of degree labels (1, 2, 3, 4, 5, 6, 7)
     */
    _getScaleDegrees(scaleTones, keyRoot) {
        const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const ENHARMONIC_MAP = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

        // Normalize key root
        let normalizedRoot = keyRoot;
        if (ENHARMONIC_MAP[keyRoot]) {
            normalizedRoot = ENHARMONIC_MAP[keyRoot];
        }
        const rootIndex = ALL_NOTES.indexOf(normalizedRoot);
        if (rootIndex === -1) return scaleTones.map(() => '');

        // Scale degrees in semitones from root (for major scale)
        const MAJOR_SCALE_DEGREES = {
            0: '1', 2: '2', 4: '3', 5: '4', 7: '5', 9: '6', 11: '7'
        };

        return scaleTones.map(tone => {
            let normalizedTone = tone;
            if (ENHARMONIC_MAP[tone]) {
                normalizedTone = ENHARMONIC_MAP[tone];
            }
            const toneIndex = ALL_NOTES.indexOf(normalizedTone);
            if (toneIndex === -1) return '';

            const interval = (toneIndex - rootIndex + 12) % 12;
            return MAJOR_SCALE_DEGREES[interval] || String(interval);
        });
    }

    /**
     * Update the Smart Suggestions panel based on current chord context
     */
    _updateSuggestionsPanel() {
        if (!this.measureChord) return;

        const chord = this.measureChord;
        const key = this.currentKey || 'C';

        // Update chord context display
        const contextEl = this.modal.querySelector('#mie-suggestions-chord-context');
        if (contextEl) {
            contextEl.textContent = `${chord.root} ${chord.type || 'Major'}`;
        }

        // Get chord tones and scale tones
        const chordTones = getChordTones(chord);

        // Detect if key is minor and get appropriate scale tones
        const isMinorKey = /m$|min$|Minor$/i.test(key);
        const keyRoot = key.replace(/m$|maj$|min$|Major$|Minor$/i, '');
        const scaleTones = this._getScaleTonesForKey(keyRoot, isMinorKey);

        // Filter scale tones to exclude chord tones (show only non-chord scale tones)
        // Also keep track of which scale degrees are excluded
        const nonChordScaleTones = [];
        const nonChordScaleDegrees = [];
        const allScaleDegrees = this._getScaleDegrees(scaleTones, keyRoot);

        // Must compare full pitch names including accidentals (C# != C)
        const ENHARMONIC = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
        scaleTones.forEach((tone, index) => {
            const toneNorm = ENHARMONIC[tone] || tone;
            const isChordTone = chordTones.some(ct => {
                const ctNorm = ENHARMONIC[ct] || ct;
                return ctNorm === toneNorm;
            });
            if (!isChordTone) {
                nonChordScaleTones.push(tone);
                nonChordScaleDegrees.push(allScaleDegrees[index]);
            }
        });

        // Get chord degrees for display
        const chordDegrees = this._getChordDegrees(chord);

        // Render chord tone buttons with degree info
        this._renderToneButtons('mie-chord-tones', chordTones, 'chord', { degrees: chordDegrees });

        // Render scale tone buttons with degree info
        this._renderToneButtons('mie-scale-tones', nonChordScaleTones, 'scale', { degrees: nonChordScaleDegrees });

        // Get and render tension buttons
        const tensions = this._getAvailableTensions(chord);
        this._renderTensionButtons('mie-tensions', tensions, chord.root);

        // Show/hide clef-specific sections based on toggle
        const isBass = this.focusedClef === 'bass';
        const isTreble = !isBass;

        // Treble-specific sections (hide when bass is selected)
        const melodicPatternSection = this.modal.querySelector('#mie-melodic-pattern-section');
        if (melodicPatternSection) melodicPatternSection.classList.toggle('hidden', !isTreble);

        // Tensions - hide for bass (tensions like 9, 11, 13 are melodic, not bass notes)
        const tensionsSection = this.modal.querySelector('#mie-tensions-section');
        if (tensionsSection) tensionsSection.classList.toggle('hidden', isBass);

        // Bass-specific sections (hide when treble is selected)
        const bassPatternsSection = this.modal.querySelector('#mie-bass-patterns-section');
        const bassApproachSection = this.modal.querySelector('#mie-bass-approach-section');
        const bassTipsSection = this.modal.querySelector('#mie-bass-tips-section');

        if (bassPatternsSection) bassPatternsSection.classList.toggle('hidden', !isBass);
        if (bassApproachSection) bassApproachSection.classList.toggle('hidden', !isBass);
        if (bassTipsSection) bassTipsSection.classList.toggle('hidden', !isBass);

        // Update bass-specific hints when bass clef is focused
        if (isBass) {
            this._updateBassHints();
        }

        // Update rest suggestions for both clefs
        this._renderRestSuggestions();
    }

    /**
     * Update bass-specific hints: approach notes and tips (role, contrary motion)
     */
    _updateBassHints() {
        const chord = this.measureChord;
        if (!chord) return;

        // Get next chord for approach note suggestions
        const nextChord = this.nextMeasureChord;

        // Update approach notes section
        this._renderBassApproachNotes(chord, nextChord);

        // Update tips section (role + contrary motion)
        this._renderBassTips(chord);
    }

    /**
     * Render bass tips section with role indicator and contrary motion hint
     */
    _renderBassTips(chord) {
        const container = this.modal.querySelector('#mie-bass-tips-content');
        if (!container) return;

        const tips = [];

        // 1. Chord function/role indicator with detailed tooltip
        const roleInfo = this._getChordRoleInfo(chord);
        if (roleInfo) {
            tips.push(`<span class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200 cursor-help"
                             title="${roleInfo.tooltip}">${roleInfo.label}</span>`);
        }

        // 2. Contrary motion hint based on melody direction
        const trebleNotes = this._getNotesInClef('treble');
        if (trebleNotes.length >= 2) {
            const melodyDirection = this._analyzeMelodyDirection(trebleNotes.slice(-3));
            if (melodyDirection === 'ascending') {
                tips.push(`<span class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 cursor-help"
                                 title="Contrary Motion: Your melody is rising. Moving the bass DOWN creates contrary motion - the strongest type of voice leading. Try stepping down to a lower chord tone.">↑mel → ↓bass</span>`);
            } else if (melodyDirection === 'descending') {
                tips.push(`<span class="px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200 cursor-help"
                                 title="Contrary Motion: Your melody is falling. Moving the bass UP creates contrary motion - the strongest type of voice leading. Try stepping up to a higher chord tone.">↓mel → ↑bass</span>`);
            }
        } else {
            tips.push(`<span class="px-1.5 py-0.5 rounded bg-gray-50 text-gray-400 border border-gray-200 cursor-help"
                             title="Add 2+ melody notes to see contrary motion suggestions. Contrary motion (bass moves opposite to melody) creates the strongest voice leading.">No melody yet</span>`);
        }

        // 3. Range reminder with detailed tooltip
        tips.push(`<span class="text-gray-400 text-[10px] cursor-help"
                         title="Bass clef comfortable range: E1 (lowest) to C4 (highest). The sweet spot is E2-G3. Notes below E2 can sound muddy; notes above G3 may clash with the melody.">Range: E1–C4</span>`);

        container.innerHTML = tips.join('');
    }

    /**
     * Get chord role info with label and detailed tooltip
     */
    _getChordRoleInfo(chord) {
        if (!chord || !chord.root) return null;

        const key = this.currentKey || 'C';
        const keyRoot = key.replace(/m$|maj$|min$|Major$|Minor$/i, '');

        const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const ENHARMONIC = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

        let chordRoot = chord.root;
        if (ENHARMONIC[chordRoot]) chordRoot = ENHARMONIC[chordRoot];
        let keyNote = keyRoot;
        if (ENHARMONIC[keyNote]) keyNote = ENHARMONIC[keyNote];

        const chordIndex = ALL_NOTES.indexOf(chordRoot);
        const keyIndex = ALL_NOTES.indexOf(keyNote);

        if (chordIndex === -1 || keyIndex === -1) return null;

        const interval = (chordIndex - keyIndex + 12) % 12;

        // Map to scale degree function with detailed explanations
        const roleData = {
            0: {
                label: 'I - Tonic',
                tooltip: 'TONIC (I): Home base. The bass should feel grounded here. Root position is strongest. This chord provides resolution and stability.'
            },
            2: {
                label: 'ii - Pre-Dom',
                tooltip: 'PRE-DOMINANT (ii): Sets up the dominant. Bass often moves by step (ii→V) or by fifth. Creates forward motion toward the V chord.'
            },
            4: {
                label: 'iii',
                tooltip: 'MEDIANT (iii): Tonic substitute or passing chord. Bass can move by step in either direction. Often connects I and IV or vi.'
            },
            5: {
                label: 'IV - Subdom',
                tooltip: 'SUBDOMINANT (IV): Creates gentle tension. Bass often moves to V (up a step) or back to I. The "amen" chord in plagal cadences.'
            },
            7: {
                label: 'V - Dominant',
                tooltip: 'DOMINANT (V): Maximum tension, wants to resolve to I. The bass on the 5th scale degree creates strong pull. Root position is most powerful.'
            },
            9: {
                label: 'vi',
                tooltip: 'SUBMEDIANT (vi): Tonic substitute, relative minor. Creates softer feel than I. Bass often moves by step to V or IV.'
            },
            11: {
                label: 'vii°',
                tooltip: 'LEADING TONE (vii°): Dominant substitute, very unstable. Bass usually moves up by half step to I. Rarely used in root position.'
            }
        };

        return roleData[interval] || null;
    }

    /**
     * Render bass approach notes - compact inline display of approach notes to next chord
     */
    _renderBassApproachNotes(currentChord, nextChord) {
        const container = this.modal.querySelector('#mie-bass-approach-notes');
        if (!container) return;

        if (!nextChord || !nextChord.root) {
            container.innerHTML = '<span class="text-gray-400 italic text-[10px] cursor-help" title="This is the last measure in your progression. Approach notes help connect to the NEXT chord.">No next chord</span>';
            return;
        }

        const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const ENHARMONIC_MAP = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

        let nextRoot = nextChord.root;
        if (ENHARMONIC_MAP[nextRoot]) nextRoot = ENHARMONIC_MAP[nextRoot];
        const targetIndex = ALL_NOTES.indexOf(nextRoot);
        if (targetIndex === -1) {
            container.innerHTML = '';
            return;
        }

        // Show just the 2 most useful approach notes (half-step below + fifth above)
        const halfStepBelow = ALL_NOTES[(targetIndex - 1 + 12) % 12];
        const fifthAbove = ALL_NOTES[(targetIndex + 7) % 12];

        container.innerHTML = `
            <button class="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200"
                    onclick="window.mieInstance && window.mieInstance._playAndPlaceNote('${halfStepBelow}2')"
                    title="CHROMATIC APPROACH: ${halfStepBelow} is a half-step below ${nextChord.root}. Place this on the last beat to create smooth chromatic voice leading into the next measure. The ↑ indicates it resolves upward.">
                ${halfStepBelow}↑
            </button>
            <button class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200"
                    onclick="window.mieInstance && window.mieInstance._playAndPlaceNote('${fifthAbove}2')"
                    title="DOMINANT APPROACH: ${fifthAbove} is the 5th above ${nextChord.root} (V→I relationship). This creates the strongest harmonic pull - the classic 'dominant to tonic' bass motion.">
                ${fifthAbove}
            </button>
            <span class="text-gray-400 text-[10px] cursor-help" title="These notes lead smoothly into ${nextChord.root} (the next chord's root). Place them near the end of this measure.">→${nextChord.root}</span>
        `;
    }

    /**
     * Render contrary motion hint based on melody direction
     * Suggests moving bass in opposite direction to melody for good voice leading
     */
    _renderContraryMotionHint() {
        const container = this.modal.querySelector('#mie-contrary-motion-hint');
        if (!container) return;

        // Get melody notes from treble clef
        const trebleNotes = this._getNotesInClef('treble');

        if (trebleNotes.length < 2) {
            container.innerHTML = '<span class="text-gray-400 italic">Add 2+ melody notes to see contrary motion suggestions</span>';
            return;
        }

        // Analyze melody direction (look at last few notes)
        const recentNotes = trebleNotes.slice(-3); // Last 3 notes
        const melodyDirection = this._analyzeMelodyDirection(recentNotes);

        // Get chord tones for suggestions
        const chord = this.measureChord;
        const chordTones = chord ? getChordTones(chord) : [];

        let suggestion = '';
        let buttonHtml = '';

        if (melodyDirection === 'ascending') {
            suggestion = `<span class="text-blue-600">↑ Melody rising → <span class="font-medium">move bass ↓</span></span>`;
            // Suggest descending bass notes (lower octave options)
            const descendingOptions = chordTones.map(tone => ({
                note: tone,
                pitch: `${tone}2`,
                label: '↓'
            }));
            buttonHtml = descendingOptions.map(opt => `
                <button class="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 border border-blue-300 rounded hover:bg-blue-200"
                        onclick="window.mieInstance && window.mieInstance._playAndPlaceNote('${opt.pitch}')"
                        title="Play ${opt.note} (contrary motion down)">
                    ${opt.note}${opt.label}
                </button>
            `).join('');
        } else if (melodyDirection === 'descending') {
            suggestion = `<span class="text-green-600">↓ Melody falling → <span class="font-medium">move bass ↑</span></span>`;
            // Suggest ascending bass notes (higher octave options)
            const ascendingOptions = chordTones.map(tone => ({
                note: tone,
                pitch: `${tone}3`,
                label: '↑'
            }));
            buttonHtml = ascendingOptions.map(opt => `
                <button class="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 border border-green-300 rounded hover:bg-green-200"
                        onclick="window.mieInstance && window.mieInstance._playAndPlaceNote('${opt.pitch}')"
                        title="Play ${opt.note} (contrary motion up)">
                    ${opt.note}${opt.label}
                </button>
            `).join('');
        } else {
            suggestion = '<span class="text-gray-500">○ Melody static → bass can move freely</span>';
        }

        container.innerHTML = `
            <div class="mb-1">${suggestion}</div>
            ${buttonHtml ? `<div class="flex gap-1 flex-wrap">${buttonHtml}</div>` : ''}
        `;
    }

    /**
     * Analyze melody direction from recent notes
     * @param {Array} notes - Array of note objects with pitches
     * @returns {string} 'ascending', 'descending', or 'static'
     */
    _analyzeMelodyDirection(notes) {
        if (notes.length < 2) return 'static';

        // Get MIDI values for comparison
        let totalDirection = 0;
        for (let i = 1; i < notes.length; i++) {
            const prevPitch = notes[i - 1].pitches?.[0] || notes[i - 1].pitch;
            const currPitch = notes[i].pitches?.[0] || notes[i].pitch;

            if (!prevPitch || !currPitch) continue;

            const prevMidi = noteToMidi(prevPitch);
            const currMidi = noteToMidi(currPitch);

            if (currMidi > prevMidi) totalDirection++;
            else if (currMidi < prevMidi) totalDirection--;
        }

        if (totalDirection > 0) return 'ascending';
        if (totalDirection < 0) return 'descending';
        return 'static';
    }

    /**
     * Get notes from a specific clef in the current measure
     * @param {string} clef - 'treble' or 'bass'
     * @returns {Array} Array of note objects
     */
    _getNotesInClef(clef) {
        if (!this.slotGrid) return [];

        const notes = [];
        const totalSlots = this.slotGrid.totalSlots;

        for (let i = 0; i < totalSlots; i++) {
            const slot = this.slotGrid.getSlot(clef, 0, i);
            if (slot && slot.type === SLOT_TYPES.NOTE_START && slot.pitches && slot.pitches.length > 0) {
                notes.push({
                    slotIndex: i,
                    pitches: slot.pitches,
                    pitch: slot.pitches[0],
                    duration: slot.duration
                });
            }
        }

        return notes;
    }

    /**
     * Render common bass progression patterns based on current and next chord
     */
    _renderCommonBassProgressions(currentChord, nextChord) {
        const container = this.modal.querySelector('#mie-bass-progression-hints');
        if (!container) return;

        const patterns = [];

        // Get interval between current and next chord roots
        if (nextChord && nextChord.root) {
            const interval = this._getIntervalBetweenRoots(currentChord.root, nextChord.root);

            // Suggest patterns based on the harmonic motion
            if (interval === 5 || interval === 7) {
                // Perfect 4th/5th motion (most common)
                patterns.push({
                    name: 'V-I Motion',
                    description: `Strong bass: ${currentChord.root}→${nextChord.root}`,
                    icon: '⬇',
                    color: 'emerald'
                });
                patterns.push({
                    name: 'Walking',
                    description: 'Fill with passing tones',
                    icon: '🚶',
                    color: 'blue'
                });
            } else if (interval === 2 || interval === 10) {
                // Step motion (ascending/descending)
                patterns.push({
                    name: 'Stepwise',
                    description: `Smooth: ${currentChord.root}→${nextChord.root}`,
                    icon: '➡',
                    color: 'blue'
                });
            } else if (interval === 3 || interval === 4 || interval === 8 || interval === 9) {
                // Third motion
                patterns.push({
                    name: '3rd Motion',
                    description: 'Consider passing tone',
                    icon: '↗',
                    color: 'purple'
                });
            } else if (interval === 0) {
                // Same chord
                patterns.push({
                    name: 'Pedal',
                    description: 'Hold root or octave leap',
                    icon: '⏸',
                    color: 'gray'
                });
            }
        }

        // Add generic suggestions based on current chord
        const chordType = currentChord.type || 'Major';
        if (chordType.includes('7') || chordType.includes('Dominant')) {
            patterns.push({
                name: 'Dominant',
                description: 'Strong resolution expected',
                icon: '⚡',
                color: 'amber'
            });
        }

        if (patterns.length === 0) {
            patterns.push({
                name: 'Root-5th',
                description: 'Classic bass foundation',
                icon: '🎵',
                color: 'indigo'
            });
        }

        // Render pattern hints
        container.innerHTML = patterns.map(p => {
            const colorClasses = {
                emerald: 'bg-emerald-100 text-emerald-700 border-emerald-300',
                blue: 'bg-blue-100 text-blue-700 border-blue-300',
                purple: 'bg-purple-100 text-purple-700 border-purple-300',
                amber: 'bg-amber-100 text-amber-700 border-amber-300',
                gray: 'bg-gray-100 text-gray-700 border-gray-300',
                indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300'
            };
            return `
                <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded border ${colorClasses[p.color] || colorClasses.gray}" title="${p.description}">
                    <span>${p.icon}</span>
                    <span class="font-medium">${p.name}</span>
                </div>
            `;
        }).join(' ');
    }

    /**
     * Get semitone interval between two note roots
     */
    _getIntervalBetweenRoots(root1, root2) {
        const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const ENHARMONIC_MAP = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

        let n1 = root1;
        let n2 = root2;
        if (ENHARMONIC_MAP[n1]) n1 = ENHARMONIC_MAP[n1];
        if (ENHARMONIC_MAP[n2]) n2 = ENHARMONIC_MAP[n2];

        const idx1 = ALL_NOTES.indexOf(n1);
        const idx2 = ALL_NOTES.indexOf(n2);

        if (idx1 === -1 || idx2 === -1) return 0;

        return (idx2 - idx1 + 12) % 12;
    }

    /**
     * Render rest suggestions based on musical context
     * Suggests where rests might improve phrasing, breathing, or rhythmic interest
     */
    _renderRestSuggestions() {
        const container = this.modal.querySelector('#mie-rest-suggestions');
        if (!container) return;

        const clef = this.focusedClef;
        const notes = this._getNotesInClef(clef);
        const beatsPerMeasure = this.beatsPerMeasure || 4;
        const totalSlots = this.slotGrid?.totalSlots || 16;

        const suggestions = [];

        // Check fill status
        const filledSlots = this._countFilledSlots(clef);
        const fillPercentage = (filledSlots / totalSlots) * 100;

        // Suggestion 1: If measure is very full, suggest adding rhythmic variety with rests
        if (fillPercentage > 80) {
            suggestions.push({
                text: 'Measure is dense - consider replacing some notes with rests for breathing room',
                type: 'density',
                icon: '💨',
                color: 'amber'
            });
        }

        // Suggestion 2: Check for beat alignment - suggest rests on weak beats
        if (notes.length > 0 && fillPercentage < 75) {
            // Find gaps in the measure
            const gaps = this._findGapsInMeasure(clef);
            if (gaps.length > 0) {
                const beatGaps = gaps.filter(g => g.slot % SLOTS_PER_BEAT === 0);
                if (beatGaps.length > 0) {
                    suggestions.push({
                        text: `Gap on beat ${Math.floor(beatGaps[0].slot / SLOTS_PER_BEAT) + 1} - add rest for clarity`,
                        type: 'gap',
                        icon: '🎯',
                        color: 'blue',
                        action: () => this._placeRestAtSlot(clef, beatGaps[0].slot)
                    });
                }
            }
        }

        // Suggestion 3: For bass, suggest rests for rhythmic patterns
        if (clef === 'bass') {
            if (notes.length >= 3 && fillPercentage > 50) {
                suggestions.push({
                    text: 'Try staccato effect: shorten notes with rests between',
                    type: 'rhythm',
                    icon: '🥁',
                    color: 'purple'
                });
            }
            // Pickup/anacrusis suggestion
            if (notes.length === 0 || (notes.length > 0 && notes[0].slotIndex > 2 * SLOTS_PER_BEAT)) {
                suggestions.push({
                    text: 'Rest at start creates pickup/anacrusis feel',
                    type: 'anacrusis',
                    icon: '⏩',
                    color: 'green'
                });
            }
        }

        // Suggestion 4: For melody, suggest phrase breathing
        if (clef === 'treble') {
            if (notes.length >= 4) {
                // Check if all notes are back-to-back
                const allConsecutive = this._areNotesConsecutive(notes);
                if (allConsecutive) {
                    suggestions.push({
                        text: 'Long phrase - consider rest for breath/phrasing',
                        type: 'phrase',
                        icon: '🎵',
                        color: 'indigo'
                    });
                }
            }

            // Cadential rest suggestion
            if (beatsPerMeasure >= 4 && notes.length > 0) {
                const lastNote = notes[notes.length - 1];
                const lastBeat = Math.floor(lastNote.slotIndex / SLOTS_PER_BEAT);
                if (lastBeat === beatsPerMeasure - 2) {
                    suggestions.push({
                        text: 'Rest on final beat creates anticipation',
                        type: 'cadence',
                        icon: '✨',
                        color: 'pink'
                    });
                }
            }
        }

        // Suggestion 5: Syncopation suggestion
        if (notes.length >= 2 && fillPercentage > 40 && fillPercentage < 70) {
            suggestions.push({
                text: 'Add rest on strong beat for syncopation',
                type: 'syncopation',
                icon: '🎹',
                color: 'orange'
            });
        }

        // Render suggestions
        if (suggestions.length === 0) {
            container.innerHTML = '<span class="text-gray-400 italic">Add notes to see rest suggestions</span>';
            return;
        }

        const colorClasses = {
            amber: 'bg-amber-50 border-amber-200 text-amber-700',
            blue: 'bg-blue-50 border-blue-200 text-blue-700',
            purple: 'bg-purple-50 border-purple-200 text-purple-700',
            green: 'bg-green-50 border-green-200 text-green-700',
            indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
            pink: 'bg-pink-50 border-pink-200 text-pink-700',
            orange: 'bg-orange-50 border-orange-200 text-orange-700'
        };

        container.innerHTML = suggestions.slice(0, 3).map(s => `
            <div class="flex items-start gap-1 mb-1 p-1 rounded border ${colorClasses[s.color] || 'bg-gray-50'}">
                <span>${s.icon}</span>
                <span>${s.text}</span>
            </div>
        `).join('');
    }

    /**
     * Count filled slots in a clef
     */
    _countFilledSlots(clef) {
        if (!this.slotGrid) return 0;

        let count = 0;
        const totalSlots = this.slotGrid.totalSlots;

        for (let i = 0; i < totalSlots; i++) {
            const slot = this.slotGrid.getSlot(clef, 0, i);
            if (slot && (slot.type === SLOT_TYPES.NOTE_START || slot.type === SLOT_TYPES.NOTE_CONT || slot.type === SLOT_TYPES.REST)) {
                count++;
            }
        }

        return count;
    }

    /**
     * Find gaps (empty slots) in the measure
     */
    _findGapsInMeasure(clef) {
        if (!this.slotGrid) return [];

        const gaps = [];
        const totalSlots = this.slotGrid.totalSlots;

        for (let i = 0; i < totalSlots; i++) {
            const slot = this.slotGrid.getSlot(clef, 0, i);
            if (slot && slot.type === SLOT_TYPES.EMPTY) {
                gaps.push({ slot: i });
            }
        }

        return gaps;
    }

    /**
     * Check if notes are all consecutive (no gaps between them)
     */
    _areNotesConsecutive(notes) {
        if (notes.length < 2) return false;

        for (let i = 1; i < notes.length; i++) {
            const prevEnd = notes[i - 1].slotIndex + durationToSlots(notes[i - 1].duration, notes[i - 1].dotted);
            const currStart = notes[i].slotIndex;

            if (currStart > prevEnd) {
                return false; // There's a gap
            }
        }

        return true;
    }

    /**
     * Place a rest at a specific slot
     */
    _placeRestAtSlot(clef, slotIndex) {
        if (!this.slotGrid) return;

        this.slotGrid.setNote(clef, 0, slotIndex, {
            pitches: [],
            duration: this.currentDuration,
            dotted: this.isDotted,
            isRest: true
        });

        this._renderStaves();
        this._updateFillStats();
        showToast('Rest placed', 'success');
    }

    /**
     * Render bass role indicator - warns about common mistakes
     */
    _renderBassRoleIndicator(chord) {
        const container = this.modal.querySelector('#mie-bass-role-indicator');
        if (!container) return;

        const warnings = [];
        const tips = [];

        // Get chord 3rd (to warn about doubling)
        const chordTones = getChordTones(chord);
        if (chordTones.length >= 2) {
            const third = chordTones[1]; // Second chord tone is usually the 3rd
            warnings.push(`<span class="text-amber-600">⚠️ Avoid doubling ${third} (chord 3rd)</span>`);
        }

        // Tip about root in bass
        tips.push(`<span class="text-green-600">✓ Root (${chord.root}) is strongest in bass</span>`);

        // Tip about 5th
        if (chordTones.length >= 3) {
            tips.push(`<span class="text-blue-600">○ Fifth (${chordTones[2]}) is safe alternate</span>`);
        }

        // Check if chord has inversion that affects bass
        if (chord.inversion && chord.inversion > 0) {
            const inversionNote = chordTones[chord.inversion] || chordTones[0];
            tips.push(`<span class="text-purple-600">⤵ Inversion ${chord.inversion}: ${inversionNote} in bass</span>`);
        }

        container.innerHTML = [...warnings, ...tips].join('<br>');
    }

    /**
     * Render bass range guide
     */
    _renderBassRangeGuide() {
        const container = this.modal.querySelector('#mie-bass-range-guide');
        if (!container) return;

        container.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="font-medium">Range:</span>
                <span class="bg-green-100 text-green-700 px-1 rounded">E1-E3</span>
                <span class="text-gray-400">optimal</span>
                <span class="bg-yellow-100 text-yellow-700 px-1 rounded">C1-G3</span>
                <span class="text-gray-400">extended</span>
            </div>
        `;
    }

    /**
     * Get scale tones for a key, supporting both major and minor
     * @param {string} keyRoot - Root note of the key (e.g., "E", "Bb")
     * @param {boolean} isMinor - Whether the key is minor
     * @returns {string[]} Array of note names in the scale
     */
    _getScaleTonesForKey(keyRoot, isMinor) {
        // Note names in chromatic order
        const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const ENHARMONIC_MAP = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

        // Scale intervals (semitones from root)
        const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11];
        const NATURAL_MINOR_SCALE_STEPS = [0, 2, 3, 5, 7, 8, 10];

        // Normalize the key root to find its index
        let normalizedRoot = keyRoot;
        if (ENHARMONIC_MAP[keyRoot]) {
            normalizedRoot = ENHARMONIC_MAP[keyRoot];
        }
        const rootIndex = ALL_NOTES.indexOf(normalizedRoot);
        if (rootIndex === -1) return [];

        // Select appropriate scale steps
        const scaleSteps = isMinor ? NATURAL_MINOR_SCALE_STEPS : MAJOR_SCALE_STEPS;

        // Build scale tones
        return scaleSteps.map(step => ALL_NOTES[(rootIndex + step) % 12]);
    }

    /**
     * Render tone buttons in a container with Note (Number) format
     * @param {string} containerId - ID of the container element
     * @param {string[]} tones - Array of tone names (without octaves)
     * @param {string} type - 'chord' or 'scale' for styling
     * @param {object} degreeInfo - Optional object with {root, degrees} for showing degree numbers
     */
    _renderToneButtons(containerId, tones, type, degreeInfo = null) {
        const container = this.modal.querySelector(`#${containerId}`);
        if (!container) return;

        const colorClass = type === 'chord'
            ? 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300'
            : 'bg-orange-100 hover:bg-orange-200 text-orange-800 border-orange-300';

        const subtextColorClass = type === 'chord' ? 'text-green-600' : 'text-orange-600';

        container.innerHTML = tones.map((tone, index) => {
            // Get degree number if degreeInfo is provided
            const degree = degreeInfo?.degrees?.[index] || '';
            const displayDegree = degree ? ` <span class="${subtextColorClass} font-normal">(${degree})</span>` : '';

            return `
                <button class="mie-tone-btn px-2 py-1 text-xs font-medium border rounded transition-colors ${colorClass}"
                        data-tone="${tone}" data-type="${type}" title="Click to add ${tone}${degree ? ` (${degree})` : ''}">
                    ${tone}${displayDegree}
                </button>
            `;
        }).join('');

        // Attach click handlers
        container.querySelectorAll('.mie-tone-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tone = btn.dataset.tone;
                this._placeNoteFromSuggestion(tone);
            });
        });
    }

    /**
     * Get available tensions/extensions for a chord
     * Simple data lookup - no complex engine needed
     * @param {object} chord - Chord object with type property
     * @returns {string[]} Array of tension names (e.g., ['9', '#11', '13'])
     */
    _getAvailableTensions(chord) {
        const TENSIONS_BY_TYPE = {
            'Major': ['9', '#11', '13'],
            'Major 7th': ['9', '#11', '13'],
            'Minor': ['9', '11', '13'],
            'Minor 7th': ['9', '11', '13'],
            'Minor-Major 7th': ['9', '11', '13'],
            'Dominant 7th': ['b9', '9', '#9', '#11', 'b13', '13'],
            'Dominant 9th': ['#11', 'b13', '13'],
            'Dominant 11th': ['b9', '9', '#9', 'b13', '13'],
            'Dominant 13th': ['b9', '9', '#9', '#11'],
            'Diminished': ['9', '11', 'b13'],
            'Diminished 7th': ['9', '11', 'b13'],
            'Half-Diminished 7th': ['9', '11', '13'],
            'Augmented': ['9', '#11'],
            'Augmented 7th': ['9', '#11'],
            'Sus2': ['11', '13'],
            'Sus4': ['9', '13'],
            'Add9': ['11', '13'],
            'Major 9th': ['#11', '13'],
            'Minor 9th': ['11', '13'],
            '6/9': ['#11', '13'],
        };

        return TENSIONS_BY_TYPE[chord.type] || ['9', '11', '13'];
    }

    /**
     * Render tension buttons in a container with Note (Number) format
     * @param {string} containerId - ID of the container element
     * @param {string[]} tensions - Array of tension names (e.g., ['9', '#11'])
     * @param {string} chordRoot - Root note of the chord for calculating actual pitches
     */
    _renderTensionButtons(containerId, tensions, chordRoot) {
        const container = this.modal.querySelector(`#${containerId}`);
        if (!container) return;

        // Map tension names to semitone intervals from root
        const TENSION_INTERVALS = {
            'b9': 1,   // minor 9th
            '9': 2,    // major 9th
            '#9': 3,   // augmented 9th
            '11': 5,   // perfect 11th
            '#11': 6,  // augmented 11th
            'b13': 8,  // minor 13th
            '13': 9,   // major 13th
        };

        const ALL_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const ENHARMONIC_MAP = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };

        // Get root index
        let normalizedRoot = chordRoot;
        if (ENHARMONIC_MAP[chordRoot]) {
            normalizedRoot = ENHARMONIC_MAP[chordRoot];
        }
        const rootIndex = ALL_NOTES.indexOf(normalizedRoot);

        container.innerHTML = tensions.map(tension => {
            const interval = TENSION_INTERVALS[tension];
            const pitch = interval !== undefined && rootIndex !== -1
                ? ALL_NOTES[(rootIndex + interval) % 12]
                : tension;

            // Format: Note (Number) - e.g., "D (9)" not "9 (D)"
            return `
                <button class="mie-tension-btn px-2 py-1 text-xs font-medium border rounded transition-colors bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-300"
                        data-tension="${tension}" data-pitch="${pitch}" title="Add ${pitch} (${tension})">
                    ${pitch} <span class="text-purple-600 font-normal">(${tension})</span>
                </button>
            `;
        }).join('');

        // Attach click handlers
        container.querySelectorAll('.mie-tension-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const pitch = btn.dataset.pitch;
                this._placeNoteFromSuggestion(pitch);
            });
        });
    }

    /**
     * Generate next note suggestions based on voice leading and chord context
     * Uses existing voice leading engines - no new logic needed
     * @param {string} fromPitch - Current pitch (e.g., "C4")
     * @param {object} chord - Current chord context
     * @param {object} options - Options like maxInterval, count
     * @returns {Array} Array of suggestion objects with pitch, score, reason
     */
    _suggestNextNotes(fromPitch, chord, options = {}) {
        const { maxInterval = 7, count = 5 } = options;

        if (!fromPitch) return [];

        // Parse the current pitch to get MIDI value
        const fromMidi = noteToMidi(fromPitch);
        if (fromMidi === null) return [];

        // Generate candidate pitches within range (stepwise + nearby)
        const candidates = [];
        for (let offset = -maxInterval; offset <= maxInterval; offset++) {
            if (offset === 0) continue; // Skip same note
            const candidateMidi = fromMidi + offset;
            if (candidateMidi < 21 || candidateMidi > 108) continue; // Piano range

            // Convert MIDI back to pitch name
            const pitchName = this._midiToPitch(candidateMidi);
            if (pitchName) {
                candidates.push({ pitch: pitchName, midi: candidateMidi, offset });
            }
        }

        // Score each candidate using existing voice leading engine
        const scored = candidates.map(candidate => {
            // Use quick voice leading scoring (lightweight)
            const vlScore = scoreVoiceLeadingQuick([fromMidi], [candidate.midi]);

            // Check if it's a chord tone for bonus
            // Must compare full pitch names including accidentals (C# != C)
            const pitchWithoutOctave = candidate.pitch.replace(/\d+$/, '');
            const chordTones = chord ? getChordTones(chord) : [];
            const isChordTone = chordTones.some(ct => {
                // Normalize enharmonics for comparison (Db = C#, etc.)
                const ENHARMONIC = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
                const ctNorm = ENHARMONIC[ct] || ct;
                const pitchNorm = ENHARMONIC[pitchWithoutOctave] || pitchWithoutOctave;
                return ctNorm === pitchNorm;
            });

            // Determine direction for contour analysis
            const direction = candidate.offset > 0 ? 'ascending' : 'descending';
            const isStepwise = Math.abs(candidate.offset) <= 2;

            // Calculate final score
            let score = vlScore.totalScore || 50;
            if (isChordTone) score += 25;
            if (isStepwise) score += 15;

            // Determine reason
            let reason = isStepwise ? 'Step' : 'Leap';
            if (isChordTone) reason = 'Chord tone';

            return {
                pitch: candidate.pitch,
                midi: candidate.midi,
                score,
                reason,
                direction,
                isChordTone,
                isStepwise
            };
        });

        // Sort by score and return top candidates
        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, count);
    }

    /**
     * Convert MIDI note number to pitch string (e.g., 60 -> "C4")
     * @param {number} midi - MIDI note number
     * @returns {string} Pitch string
     */
    _midiToPitch(midi) {
        const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const noteIndex = midi % 12;
        return `${NOTE_NAMES[noteIndex]}${octave}`;
    }

    /**
     * Render next note suggestions in the UI
     * Shows when a note is selected in the slot grid
     */
    _renderNextNoteSuggestions() {
        const section = this.modal.querySelector('#mie-next-note-section');
        const container = this.modal.querySelector('#mie-next-note-suggestions');
        const hint = this.modal.querySelector('#mie-select-note-hint');
        if (!section || !container) return;

        // Check if we have a selected note
        const selectedNote = this._getSelectedNote();
        if (!selectedNote || !selectedNote.pitch) {
            section.classList.add('hidden');
            if (hint) hint.classList.remove('hidden');
            return;
        }

        // Hide the hint when showing suggestions
        if (hint) hint.classList.add('hidden');

        // Get suggestions
        const suggestions = this._suggestNextNotes(selectedNote.pitch, this.measureChord);
        if (suggestions.length === 0) {
            section.classList.add('hidden');
            return;
        }

        // Store suggestions for Tab key access
        this._nextNoteSuggestions = suggestions;

        // Show section
        section.classList.remove('hidden');

        // Render suggestion buttons
        container.innerHTML = suggestions.map((suggestion, index) => {
            const pitchWithoutOctave = suggestion.pitch.replace(/\d+$/, '');
            const isFirst = index === 0;
            const colorClass = suggestion.isChordTone
                ? 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300'
                : 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300';
            const arrow = suggestion.direction === 'ascending' ? '↑' : '↓';

            return `
                <button class="mie-next-note-btn px-2 py-1 text-xs font-medium border rounded transition-colors ${colorClass} ${isFirst ? 'ring-2 ring-offset-1 ring-blue-400' : ''}"
                        data-pitch="${suggestion.pitch}" data-index="${index}"
                        title="${suggestion.reason} - Score: ${Math.round(suggestion.score)}">
                    ${arrow} ${pitchWithoutOctave} <span class="opacity-60">(${suggestion.reason})</span>
                </button>
            `;
        }).join('');

        // Attach click handlers
        container.querySelectorAll('.mie-next-note-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const pitch = btn.dataset.pitch;
                this._acceptNextNoteSuggestion(pitch);
            });
        });
    }

    /**
     * Get the currently selected note from the slot grid
     * @returns {object|null} Selected note object or null
     */
    _getSelectedNote() {
        if (!this.selectedSlot) return null;

        const { clef, voice = 0, slotIndex, pitch: selectedPitch } = this.selectedSlot;
        const slot = this.slotGrid.getSlot(clef, voice, slotIndex);

        if (slot && slot.type === SLOT_TYPES.NOTE_START && slot.pitches && slot.pitches.length > 0) {
            return {
                // Use the specific selected pitch if available, otherwise first pitch
                pitch: selectedPitch || slot.pitches[0],
                clef,
                voice,
                slotIndex
            };
        }
        return null;
    }

    /**
     * Accept a next note suggestion and place it
     * @param {string} pitch - The pitch to place
     */
    _acceptNextNoteSuggestion(pitch) {
        if (!this.selectedSlot) return;

        // Find the next available slot after the selected one
        const { clef, voice = 0, slotIndex } = this.selectedSlot;
        const nextSlotIndex = this._findNextAvailableSlotAfter(slotIndex, clef, voice);

        if (nextSlotIndex !== null) {
            // Place the note
            this._placeNote(clef, nextSlotIndex, pitch, voice);
            this._renderStaves();
            this._updateFillStats();

            // Select the new note (with the pitch we just placed)
            this.selectedSlot = { clef, voice, slotIndex: nextSlotIndex, pitch };

            // Play the note for feedback
            this._playNotePreview(pitch);

            // Update suggestions for the new note
            this._renderNextNoteSuggestions();
        } else {
            showToast('No available slot after selected note', 'warning');
        }
    }

    /**
     * Find the next available slot after a given slot index
     * @param {number} afterSlotIndex - Slot index to start searching after
     * @param {string} clef - Clef to search in (defaults to focusedClef)
     * @param {number} voice - Voice to search in (defaults to 0)
     * @returns {number|null} Next available slot index or null
     */
    _findNextAvailableSlotAfter(afterSlotIndex, clef = this.focusedClef, voice = 0) {
        const totalSlots = this.slotGrid.totalSlots;

        for (let s = afterSlotIndex + 1; s < totalSlots; s++) {
            const slot = this.slotGrid.getSlot(clef, voice, s);
            if (slot && slot.type === SLOT_TYPES.EMPTY) {
                return s;
            }
        }
        return null;
    }

    /**
     * Handle Tab key to accept top next note suggestion
     */
    _handleTabForNextNote() {
        if (this._nextNoteSuggestions && this._nextNoteSuggestions.length > 0) {
            const topSuggestion = this._nextNoteSuggestions[0];
            this._acceptNextNoteSuggestion(topSuggestion.pitch);
            return true; // Handled
        }
        return false; // Not handled
    }

    /**
     * Check voice leading issues after a note is placed
     * Uses existing voice leading detection functions from enhancedVoiceLeading.js
     * @param {string} clef - The clef where note was placed ('treble' or 'bass')
     * @param {number} slotIndex - The slot index where note was placed
     * @param {string} newPitch - The pitch that was placed
     */
    _checkVoiceLeadingIssues(clef, slotIndex, newPitch) {
        const warnings = [];

        // Get the previous slot with a note in the same voice
        const prevSlotData = this._findPreviousNoteSlot(clef, this.currentVoice, slotIndex);

        if (!prevSlotData) {
            // No previous note to compare - no warnings possible
            return;
        }

        const prevPitches = prevSlotData.slot.pitches || [];
        const newPitchMidi = noteToMidi(newPitch);

        if (newPitchMidi === null || prevPitches.length === 0) return;

        // Convert previous pitches to MIDI
        const prevMidi = prevPitches.map(p => noteToMidi(p)).filter(m => m !== null).sort((a, b) => a - b);
        const newMidi = [newPitchMidi]; // Currently just the single new pitch

        // For more comprehensive checking, gather all notes at the current slot
        const currentSlotMidi = this._getAllNotesAtSlot(slotIndex);

        // 1. Check for parallel fifths and octaves
        if (prevMidi.length >= 1 && currentSlotMidi.length >= 2) {
            // Need at least 2 voices in both chords for parallel motion
            const parallelIssues = detectParallelMotion(prevMidi, currentSlotMidi);

            if (parallelIssues.parallelFifths) {
                warnings.push({
                    type: 'parallel_fifths',
                    severity: 'warning',
                    message: `⚠️ Parallel 5ths detected`
                });
            }
            if (parallelIssues.parallelOctaves) {
                warnings.push({
                    type: 'parallel_octaves',
                    severity: 'warning',
                    message: `⚠️ Parallel 8ves detected`
                });
            }
        }

        // 2. Check for voice crossing
        if (currentSlotMidi.length >= 2) {
            const crossingIssues = detectVoiceCrossing(prevMidi, currentSlotMidi);

            if (crossingIssues.count > 0) {
                warnings.push({
                    type: 'voice_crossing',
                    severity: 'info',
                    message: `ℹ️ Voice crossing`
                });
            }
        }

        // 3. Check for unresolved tendency tones (leading tone, etc.)
        if (this.currentKey && prevMidi.length > 0) {
            const tendencyResult = checkTendencyToneResolution(prevMidi, newMidi, this.currentKey);

            if (tendencyResult.unresolved && tendencyResult.unresolved.length > 0) {
                tendencyResult.unresolved.forEach(issue => {
                    warnings.push({
                        type: 'tendency_unresolved',
                        severity: 'info',
                        message: `ℹ️ ${issue.description || 'Unresolved tendency tone'}`
                    });
                });
            }
        }

        // Display warnings if any
        if (warnings.length > 0) {
            // Show most severe warning in status, collect all for toast
            const severeWarning = warnings.find(w => w.severity === 'warning') || warnings[0];

            // Update status with the warning
            setTimeout(() => {
                // Delayed to show after the "Added note" message
                this._updateStatus(severeWarning.message);
            }, 100);

            // Show toast for all warnings
            if (warnings.some(w => w.severity === 'warning')) {
                const warningMessages = warnings.filter(w => w.severity === 'warning').map(w => w.message.replace(/^[⚠️ℹ️]\s*/, '')).join(', ');
                showToast(warningMessages, { type: 'warning', duration: 3000 });
            }
        }
    }

    /**
     * Find the previous note slot before a given slot index
     * @param {string} clef - The clef to search
     * @param {number} voice - The voice to search
     * @param {number} beforeSlotIndex - Search before this slot index
     * @returns {object|null} { slot, slotIndex } or null
     */
    _findPreviousNoteSlot(clef, voice, beforeSlotIndex) {
        for (let s = beforeSlotIndex - 1; s >= 0; s--) {
            const slot = this.slotGrid.getSlot(clef, voice, s);
            if (slot && slot.type === SLOT_TYPES.NOTE_START) {
                return { slot, slotIndex: s };
            }
        }
        return null;
    }

    /**
     * Get all notes (MIDI values) at a given slot index across both clefs
     * @param {number} slotIndex - The slot index
     * @returns {number[]} Array of MIDI values, sorted low to high
     */
    _getAllNotesAtSlot(slotIndex) {
        const midiValues = [];

        // Check both clefs and both voices
        ['bass', 'treble'].forEach(clef => {
            [0, 1].forEach(voice => {
                const slot = this.slotGrid.getSlot(clef, voice, slotIndex);
                if (slot && (slot.type === SLOT_TYPES.NOTE_START || slot.type === SLOT_TYPES.CONTINUATION)) {
                    const pitches = slot.pitches || [];
                    pitches.forEach(p => {
                        const midi = noteToMidi(p);
                        if (midi !== null) midiValues.push(midi);
                    });
                }
            });
        });

        return midiValues.sort((a, b) => a - b);
    }

    /**
     * Place a note from a suggestion button click
     * @param {string} tone - The tone name (without octave)
     */
    _placeNoteFromSuggestion(tone) {
        // Determine octave based on focused clef
        const octave = this.focusedClef === 'bass' ? 3 : 4;
        const pitch = `${tone}${octave}`;

        // Find the next available slot position
        const slotIndex = this._findNextAvailableSlot();

        if (slotIndex !== null) {
            // Place the note
            this._placeNote(this.focusedClef, slotIndex, pitch, 0);  // measureOffset 0 = center measure
            this._renderStaves();
            this._updateFillStats();

            // Play the note for feedback
            this._playNotePreview(pitch);
        } else {
            showToast('Measure is full', 'warning');
        }
    }

    /**
     * Play and place a note with full pitch (including octave)
     * Used by bass approach note buttons
     * @param {string} fullPitch - Full pitch like "B2" or "C#3"
     */
    _playAndPlaceNote(fullPitch) {
        // Find the next available slot position
        const slotIndex = this._findNextAvailableSlot();

        if (slotIndex !== null) {
            // Place the note (using bass clef since this is for bass approach notes)
            this._placeNote('bass', slotIndex, fullPitch, 0);
            this._renderStaves();
            this._updateFillStats();

            // Play the note for feedback
            this._playNotePreview(fullPitch);
        } else {
            showToast('Measure is full', 'warning');
        }
    }

    /**
     * Play a single note preview for audio feedback
     * @param {string} pitch - Pitch like "C4"
     */
    async _playNotePreview(pitch) {
        // Ensure audio is ready
        if (!getAudioIsReady()) {
            await initAudio();
        }

        const piano = getPiano();
        if (!piano) return;

        // Play a short preview of the note
        try {
            piano.triggerAttackRelease(pitch, '8n', Tone.now());
        } catch (e) {
            // Ignore audio errors - non-critical
        }
    }

    /**
     * Find the next available slot in the current measure
     * @returns {number|null} Slot index or null if measure is full
     */
    _findNextAvailableSlot() {
        if (!this.slotGrid) return 0;

        // Iterate through slots to find the first empty one
        const totalSlots = this.slotGrid.totalSlots;
        for (let i = 0; i < totalSlots; i++) {
            const slot = this.slotGrid.getSlot(this.focusedClef, this.currentVoice, i);
            if (slot && slot.type === SLOT_TYPES.EMPTY) {
                return i;
            }
        }

        // Measure is full
        return null;
    }

    /**
     * Apply the selected bass pattern to visible measures
     */
    _applyBassPattern() {
        const patternSelect = this.modal.querySelector('#mie-bass-pattern-select');
        if (!patternSelect) return;

        const pattern = patternSelect.value;
        const chord = this.measureChord;

        if (!chord || !chord.root) {
            showToast('No chord context available', 'warning');
            return;
        }

        // Get beats per measure
        const beatsPerMeasure = this.beatsPerMeasure || 4;

        // Generate bass pattern
        const bassNotes = generateBuildingBlockBass(chord, null, beatsPerMeasure, {
            bassPattern: pattern,
            bassOctave: BASS_PATTERN_OCTAVE_DEFAULTS[pattern] || 2
        });

        if (!bassNotes || bassNotes.length === 0) {
            showToast('Could not generate bass pattern', 'warning');
            return;
        }

        // Clear existing bass notes in center measure
        if (this.slotGrid) {
            // Clear all bass slots for voice 0
            const totalSlots = this.slotGrid.totalSlots;
            for (let i = 0; i < totalSlots; i++) {
                this.slotGrid.clearSlot('bass', 0, i);
            }

            // Add the generated notes
            let currentSlot = 0;
            for (const note of bassNotes) {
                if (note.isRest) continue;  // Skip rests for now

                const slots = durationToSlots(note.duration, note.dotted);
                const pitches = Array.isArray(note.pitches) ? note.pitches : [note.pitches];

                this.slotGrid.setNote('bass', 0, currentSlot, {
                    pitches: pitches,
                    duration: note.duration,
                    dotted: note.dotted || false,
                    isRest: false
                });

                currentSlot += slots;
            }
        }

        this._renderStaves();
        this._updateFillStats();
        showToast(`Applied ${pattern} bass pattern`, 'success');
    }

    /**
     * Set the focused clef and update UI accordingly
     * @param {string} clef - 'treble' or 'bass'
     */
    _setFocusedClef(clef) {
        this.focusedClef = clef;
        this._updateClefToggleUI();
        this._updateSuggestionsPanel();
        this._renderMelodicPatterns();  // Update melodic suggestions for new clef
    }

    /**
     * Handle clef toggle button click from Smart Suggestions header
     * @param {string} clef - 'treble' or 'bass'
     */
    _setClefToggle(clef) {
        this.focusedClef = clef;
        this._updateClefToggleUI();
        this._updateSuggestionsPanel();
        this._renderMelodicPatterns();
    }

    /**
     * Update the clef toggle button UI to reflect current focusedClef state
     */
    _updateClefToggleUI() {
        const trebleBtn = this.modal.querySelector('#mie-clef-treble-btn');
        const bassBtn = this.modal.querySelector('#mie-clef-bass-btn');

        if (!trebleBtn || !bassBtn) return;

        const isTreble = this.focusedClef === 'treble';

        // Active button: purple bg, white text
        // Inactive button: text only, hover effect
        if (isTreble) {
            trebleBtn.className = 'px-2 py-0.5 text-xs font-medium rounded-full transition-colors bg-purple-600 text-white';
            bassBtn.className = 'px-2 py-0.5 text-xs font-medium rounded-full transition-colors text-purple-600 hover:bg-purple-100';
        } else {
            trebleBtn.className = 'px-2 py-0.5 text-xs font-medium rounded-full transition-colors text-purple-600 hover:bg-purple-100';
            bassBtn.className = 'px-2 py-0.5 text-xs font-medium rounded-full transition-colors bg-purple-600 text-white';
        }
    }

    /**
     * Update delete button enabled state
     */
    _updateDeleteButton() {
        const deleteBtn = this.modal.querySelector('#mie-delete-btn');
        if (deleteBtn) {
            const hasSelection = this.selectedNote !== null;
            deleteBtn.disabled = !hasSelection;
            deleteBtn.classList.toggle('opacity-50', !hasSelection);
            deleteBtn.classList.toggle('hover:bg-red-100', hasSelection);
        }
    }

    /**
     * Update toolbar to reflect selected note's duration
     * This syncs the toolbar state to match the selected note
     */
    _updateToolbarForSelection() {
        if (!this.selectedNote) {
            // No selection - reset to defaults if needed
            return;
        }

        const { clef, voice, slotIndex } = this.selectedNote;
        const slot = this.slotGrid.getSlot(clef, voice, slotIndex);

        if (slot.type === SLOT_TYPES.NOTE_START || slot.type === SLOT_TYPES.REST) {
            // Update duration to match selected note
            if (slot.duration) {
                this.currentDuration = slot.duration;
                this._updateDurationButtons();
            }

            // Update dotted state
            this.isDotted = slot.dotted || false;
            const dottedCheckbox = this.modal.querySelector('#mie-dotted');
            if (dottedCheckbox) {
                dottedCheckbox.checked = this.isDotted;
            }

            // Update rest mode based on selection
            this.isRestMode = slot.type === SLOT_TYPES.REST;
            this._updateModeButtons();

            // Update voice to match selected note's voice
            this.currentVoice = voice;
            this._updateVoiceButtons();
        }
    }

    /**
     * Clear the current note selection
     */
    _clearSelection() {
        this.selectedNote = null;
        this.selectedNotes.clear();
        this.lastSelectedNote = null;
        this.selectedSlot = null;
        this._nextNoteSuggestions = null;
        this._updateDeleteButton();
        this._renderStaves();
        this._updateStatus('Click on staff to add notes');

        // Hide next note suggestions section and show hint
        const nextNoteSection = this.modal.querySelector('#mie-next-note-section');
        if (nextNoteSection) nextNoteSection.classList.add('hidden');
        const hint = this.modal.querySelector('#mie-select-note-hint');
        if (hint) hint.classList.remove('hidden');
    }

    /**
     * Delete the currently selected note
     * For chords, if a specific pitch is selected, only delete that pitch
     */
    _deleteSelectedNote() {
        if (!this.selectedNote) {
            this._updateStatus('No note selected');
            return;
        }

        const { clef, voice, slotIndex, pitch } = this.selectedNote;
        const slot = this.slotGrid.getSlot(clef, voice, slotIndex);

        // Check if this is a tuplet note - prevent deletion
        if (slot.tupletGroupId || slot.tupletType) {
            this._updateStatus('⚠️ Cannot delete tuplet notes individually. Use Composition Studio to delete entire tuplet groups.');
            return;
        }

        // Check if this is a chord with multiple pitches and a specific pitch is selected
        if (slot.type === SLOT_TYPES.NOTE_START && slot.pitches?.length > 1 && pitch) {
            // Remove only the selected pitch from the chord
            const newPitches = slot.pitches.filter(p => p !== pitch);
            if (newPitches.length > 0) {
                // Update the slot with remaining pitches
                this.slotGrid.setNote(clef, voice, slotIndex, {
                    pitches: newPitches,
                    duration: slot.duration,
                    dotted: slot.dotted,
                    stemDirection: slot.stemDirection,
                    articulation: slot.articulation,
                    dynamic: slot.dynamic
                });
                this._updateStatus(`Removed ${pitch} from chord (${newPitches.length} note${newPitches.length > 1 ? 's' : ''} remaining)`);
            } else {
                // No pitches left - clear the entire slot
                this.slotGrid.clearSlot(clef, voice, slotIndex);
                this._updateStatus('Note deleted');
            }
        } else {
            // Single note or rest - clear the entire slot
            this.slotGrid.clearSlot(clef, voice, slotIndex);
            this._updateStatus(slot.type === SLOT_TYPES.REST ? 'Rest deleted' : 'Note deleted');
        }

        // Clear selection
        this.selectedNote = null;

        this._updateDeleteButton();
        this._updateToolbarForSelection();
        this._renderStaves();
        this._updateFillStats();
        this._renderMelodicPatterns();  // Update after deletion
    }

    /**
     * Select a note at the given position
     * @param {string} clef - 'treble' or 'bass'
     * @param {number} voice - Voice index (0 or 1)
     * @param {number} slotIndex - Slot position
     * @param {string|null} pitch - Specific pitch (for chord note selection) or null for rest
     */
    _selectNoteAtSlot(clef, voice, slotIndex, pitch = null) {
        // Clear any existing multi-selection and set single selection
        this.selectedNotes.clear();
        const noteId = this._makeNoteId(clef, voice, slotIndex, pitch);
        this.selectedNotes.add(noteId);

        // Also set legacy selectedNote for backward compatibility
        this.selectedNote = { clef, voice, slotIndex, pitch };
        this.lastSelectedNote = { clef, voice, slotIndex, pitch };

        // Set selectedSlot for next note suggestions (include voice and pitch)
        this.selectedSlot = { clef, voice, slotIndex, pitch };

        this._updateDeleteButton();
        this._updateToolbarForSelection();
        this._renderStaves();

        // Update next note suggestions based on selected note
        this._renderNextNoteSuggestions();

        const slot = this.slotGrid.getSlot(clef, voice, slotIndex);
        if (slot.type === SLOT_TYPES.REST) {
            this._updateStatus(`Selected rest - ←→ move, R to note, 1-6 duration, Del delete`);
        } else if (pitch && slot.pitches?.length > 1) {
            this._updateStatus(`Selected ${pitch} in chord - ←→ move, ↑↓ transpose, S/F/N/K accidentals, R rest, Del`);
        } else {
            const pitchInfo = pitch || slot.pitches?.join(', ') || 'note';
            this._updateStatus(`Selected ${pitchInfo} - ←→ move, ↑↓ transpose, S/F/N/K accidentals, R rest, Del, Tab=next`);
        }
    }

    /**
     * Create a unique note ID for multi-selection tracking
     * @param {string} clef - 'treble' or 'bass'
     * @param {number} voice - Voice index (0 or 1)
     * @param {number} slotIndex - Global slot index
     * @param {string|null} pitch - Specific pitch in chord (optional)
     * @returns {string} Unique note identifier
     */
    _makeNoteId(clef, voice, slotIndex, pitch = null) {
        const measureOffset = this.slotGrid?.getMeasureIndexForSlot(slotIndex) || 0;
        // Include pitch in ID for chord note differentiation
        return `${measureOffset}-${clef}-${voice}-${slotIndex}${pitch ? '-' + pitch : ''}`;
    }

    /**
     * Parse a note ID back into its components
     * @param {string} noteId - Note identifier
     * @returns {Object} { measureOffset, clef, voice, slotIndex, pitch }
     */
    _parseNoteId(noteId) {
        const parts = noteId.split('-');
        return {
            measureOffset: parseInt(parts[0], 10),
            clef: parts[1],
            voice: parseInt(parts[2], 10),
            slotIndex: parseInt(parts[3], 10),
            pitch: parts[4] || null
        };
    }

    /**
     * Toggle tie on selected notes
     * Ties connect notes of the same pitch across slots/measures
     */
    _toggleTieOnSelected() {
        if (this.selectedNotes.size === 0) {
            this._updateStatus('No notes selected to tie');
            return;
        }

        // Parse all selected note IDs and toggle their tied state
        let toggledCount = 0;
        for (const noteId of this.selectedNotes) {
            const parsed = this._parseNoteId(noteId);
            const slot = this.slotGrid.getSlot(parsed.clef, parsed.voice, parsed.slotIndex);

            if (slot.type === SLOT_TYPES.NOTE_START) {
                // Toggle the tied property
                slot.tied = !slot.tied;
                toggledCount++;
            }
        }

        if (toggledCount > 0) {
            this._renderStaves();
            this._updateFillStats();
            const tieState = toggledCount === 1 ?
                (this.slotGrid.getSlot(
                    this._parseNoteId([...this.selectedNotes][0]).clef,
                    this._parseNoteId([...this.selectedNotes][0]).voice,
                    this._parseNoteId([...this.selectedNotes][0]).slotIndex
                ).tied ? 'added' : 'removed') :
                'toggled';
            this._updateStatus(`Tie ${tieState} on ${toggledCount} note${toggledCount > 1 ? 's' : ''}`);
        } else {
            this._updateStatus('No notes to tie (only notes can have ties)');
        }
    }

    /**
     * Toggle a note in the multi-selection (for Shift+Click)
     */
    _toggleNoteInSelection(clef, voice, slotIndex, pitch = null) {
        const noteId = this._makeNoteId(clef, voice, slotIndex, pitch);

        if (this.selectedNotes.has(noteId)) {
            // Remove from selection
            this.selectedNotes.delete(noteId);
        } else {
            // Add to selection
            this.selectedNotes.add(noteId);
        }

        // Update lastSelectedNote and legacy selectedNote
        if (this.selectedNotes.size === 1) {
            // If only one note selected, update legacy selectedNote
            const [singleId] = this.selectedNotes;
            const parsed = this._parseNoteId(singleId);
            this.selectedNote = { clef: parsed.clef, voice: parsed.voice, slotIndex: parsed.slotIndex, pitch: parsed.pitch };
        } else if (this.selectedNotes.size === 0) {
            this.selectedNote = null;
        } else {
            // Multiple notes selected - selectedNote stays as last clicked
            this.selectedNote = null;  // Or keep it for operations that need a "primary" note
        }

        this.lastSelectedNote = { clef, voice, slotIndex, pitch };

        this._updateDeleteButton();
        this._updateToolbarForSelection();
        this._renderStaves();

        // Update status message
        const count = this.selectedNotes.size;
        if (count === 0) {
            this._updateStatus('No notes selected');
        } else if (count === 1) {
            const slot = this.slotGrid.getSlot(clef, voice, slotIndex);
            const pitchInfo = pitch || slot.pitches?.join(', ') || 'note';
            this._updateStatus(`Selected ${pitchInfo} - ←→ move, ↑↓ transpose, T toggle tie`);
        } else {
            this._updateStatus(`${count} notes selected - T to toggle ties, Del to delete`);
        }
    }

    /**
     * Change the duration of the selected note
     * @param {string} newDuration - New duration (e.g., '4n', '2n')
     * @param {boolean} dotted - Whether the note should be dotted
     */
    _changeSelectedNoteDuration(newDuration, dotted) {
        if (!this.selectedNote) return;

        const { clef, voice, slotIndex } = this.selectedNote;
        const slot = this.slotGrid.getSlot(clef, voice, slotIndex);

        if (slot.type !== SLOT_TYPES.NOTE_START && slot.type !== SLOT_TYPES.REST) {
            this._updateStatus('Cannot change duration of this slot');
            return;
        }

        // Check if this is a tuplet note - prevent duration changes
        if (slot.tupletGroupId || slot.tupletType) {
            this._updateStatus('⚠️ Cannot change tuplet note duration. Use arrow keys to change pitch or Composition Studio for other edits.');
            return;
        }

        // Calculate new duration in slots
        const newDurationBeats = durationToBeats(newDuration, dotted);
        const newDurationSlots = Math.round(newDurationBeats * SLOTS_PER_BEAT);
        const availableSlots = this.slotGrid.totalSlots - slotIndex;

        // Check if the new duration would overflow
        if (newDurationSlots > availableSlots) {
            this._updateStatus(`⚠️ Duration too long - would overflow measure (max ${availableSlots} slots)`);
            return;
        }

        // Update the slot with new duration (preserving all note properties)
        if (slot.type === SLOT_TYPES.NOTE_START) {
            this.slotGrid.setNote(clef, voice, slotIndex, {
                pitches: slot.pitches,
                duration: newDuration,
                dotted: dotted,
                stemDirection: slot.stemDirection,
                articulation: slot.articulation,
                dynamic: slot.dynamic,
                ornament: slot.ornament,
                fermata: slot.fermata,
                graceNotes: slot.graceNotes,
                tied: slot.tied,
                isTied: slot.isTied,
                slur: slot.slur
            });
            const durationName = this._getDurationName(newDuration) + (dotted ? ' dotted' : '');
            this._updateStatus(`Changed to ${durationName}`);
        } else if (slot.type === SLOT_TYPES.REST) {
            this.slotGrid.setRest(clef, voice, slotIndex, {
                duration: newDuration,
                dotted: dotted
            });
            const durationName = this._getDurationName(newDuration) + (dotted ? ' dotted' : '');
            this._updateStatus(`Changed rest to ${durationName}`);
        }

        this._renderStaves();
        this._updateFillStats();
    }

    /**
     * Toggle selected item between note and rest
     * - If note selected: convert to rest
     * - If rest selected: convert to note (using default pitch for clef)
     */
    _toggleSelectedNoteRest() {
        if (!this.selectedNote) return;

        const { clef, voice, slotIndex } = this.selectedNote;
        const slot = this.slotGrid.getSlot(clef, voice, slotIndex);

        if (slot.type === SLOT_TYPES.NOTE_START) {
            // Convert note to rest (preserve duration and tuplet properties)
            this.slotGrid.setRest(clef, voice, slotIndex, {
                duration: slot.duration,
                dotted: slot.dotted,
                // Preserve tuplet properties so the rest maintains its place in the tuplet group
                tuplet: slot.tuplet,
                tupletGroupId: slot.tupletGroupId,
                tupletType: slot.tupletType
            });
            const isTuplet = slot.tupletGroupId || slot.tupletType;
            this._updateStatus(isTuplet ? 'Converted tuplet note to rest' : 'Converted to rest');
            // Update selection - it's now a rest
            this._selectNoteAtSlot(clef, voice, slotIndex, null);
        } else if (slot.type === SLOT_TYPES.REST) {
            // Convert rest to note - use a sensible default pitch for the clef
            const defaultPitch = clef === 'treble' ? 'B4' : 'D3';
            this.slotGrid.setNote(clef, voice, slotIndex, {
                pitches: [defaultPitch],
                duration: slot.duration,
                dotted: slot.dotted,
                // Preserve tuplet properties so the note maintains its place in the tuplet group
                tuplet: slot.tuplet,
                tupletGroupId: slot.tupletGroupId,
                tupletType: slot.tupletType
            });
            const isTuplet = slot.tupletGroupId || slot.tupletType;
            this._updateStatus(isTuplet ? `Converted tuplet rest to note (${defaultPitch})` : `Converted to note (${defaultPitch})`);
            // Update selection - it's now a note
            this._selectNoteAtSlot(clef, voice, slotIndex, defaultPitch);
        } else {
            this._updateStatus('Select a note or rest first');
            return;
        }

        this._renderStaves();
        this._updateFillStats();
    }

    /**
     * Apply an accidental to the selected note
     * @param {string} accidental - '#', 'b', or '' (natural)
     */
    _applyAccidentalToSelectedNote(accidental) {
        if (!this.selectedNote) return;

        const { clef, voice, slotIndex, pitch } = this.selectedNote;
        const slot = this.slotGrid.getSlot(clef, voice, slotIndex);

        if (slot.type !== SLOT_TYPES.NOTE_START || !slot.pitches?.length) {
            this._updateStatus('No note selected');
            return;
        }

        // If a specific pitch is selected (in a chord), only modify that pitch
        // Otherwise modify all pitches in the slot
        const pitchesToModify = pitch ? [pitch] : slot.pitches;
        const newPitches = slot.pitches.map(p => {
            if (!pitchesToModify.includes(p)) return p;

            // Parse the pitch (e.g., "C#4" -> { note: "C", acc: "#", octave: "4" })
            const match = p.match(/^([A-G])([#b]?)(\d+)$/);
            if (!match) return p;

            const noteLetter = match[1];
            const octave = match[3];

            // Create new pitch with the specified accidental
            return noteLetter + accidental + octave;
        });

        // Update the slot with new pitches (preserving all note properties)
        this.slotGrid.setNote(clef, voice, slotIndex, {
            pitches: newPitches,
            duration: slot.duration,
            dotted: slot.dotted,
            stemDirection: slot.stemDirection,
            articulation: slot.articulation,
            dynamic: slot.dynamic,
            ornament: slot.ornament,
            fermata: slot.fermata,
            graceNotes: slot.graceNotes,
            tied: slot.tied,
            isTied: slot.isTied,
            slur: slot.slur
        });

        // Update selection to point to new pitch
        if (pitch) {
            const match = pitch.match(/^([A-G])([#b]?)(\d+)$/);
            if (match) {
                const newPitch = match[1] + accidental + match[3];
                this.selectedNote.pitch = newPitch;
            }
        }

        const accName = accidental === '#' ? 'sharp' : accidental === 'b' ? 'flat' : 'natural';
        this._updateStatus(`Applied ${accName}`);
        this._renderStaves();
    }

    /**
     * Apply the key signature accidental to the selected note
     */
    _applyKeySignatureAccidentalToSelectedNote() {
        if (!this.selectedNote) return;

        const { clef, voice, slotIndex, pitch } = this.selectedNote;
        const slot = this.slotGrid.getSlot(clef, voice, slotIndex);

        if (slot.type !== SLOT_TYPES.NOTE_START || !slot.pitches?.length) {
            this._updateStatus('No note selected');
            return;
        }

        // If a specific pitch is selected (in a chord), only modify that pitch
        // Otherwise modify all pitches in the slot
        const pitchesToModify = pitch ? [pitch] : slot.pitches;
        const newPitches = slot.pitches.map(p => {
            if (!pitchesToModify.includes(p)) return p;

            // Parse the pitch
            const match = p.match(/^([A-G])([#b]?)(\d+)$/);
            if (!match) return p;

            const noteLetter = match[1];
            const octave = match[3];

            // Get the accidental from key signature for this note letter
            const keyAcc = this._getKeySignatureAccidentalForNote(noteLetter);

            return noteLetter + keyAcc + octave;
        });

        // Update the slot (preserving all note properties)
        this.slotGrid.setNote(clef, voice, slotIndex, {
            pitches: newPitches,
            duration: slot.duration,
            dotted: slot.dotted,
            stemDirection: slot.stemDirection,
            articulation: slot.articulation,
            dynamic: slot.dynamic,
            ornament: slot.ornament,
            fermata: slot.fermata,
            graceNotes: slot.graceNotes,
            tied: slot.tied,
            isTied: slot.isTied,
            slur: slot.slur
        });

        // Update selection
        if (pitch) {
            const match = pitch.match(/^([A-G])([#b]?)(\d+)$/);
            if (match) {
                const keyAcc = this._getKeySignatureAccidentalForNote(match[1]);
                this.selectedNote.pitch = match[1] + keyAcc + match[3];
            }
        }

        this._updateStatus(`Applied key signature (${this.currentKey})`);
        this._renderStaves();
    }

    /**
     * Transpose the selected note by a number of half steps
     * Uses the key signature's enharmonic preference (sharps vs flats)
     * @param {number} semitones - Number of half steps (positive = up, negative = down)
     */
    _transposeSelectedNote(semitones) {
        if (!this.selectedNote) return;

        const { clef, voice, slotIndex, pitch } = this.selectedNote;
        const slot = this.slotGrid.getSlot(clef, voice, slotIndex);

        if (slot.type !== SLOT_TYPES.NOTE_START || !slot.pitches?.length) {
            this._updateStatus('No note selected');
            return;
        }

        // Chromatic scales for transposition
        const CHROMATIC_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const CHROMATIC_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

        // Determine enharmonic preference from key signature accidentals
        // If key has flats (Bb, Eb, etc.), use flat spelling; otherwise use sharps
        const useFlats = this.keyAccidentals && this.keyAccidentals.length > 0 &&
            this.keyAccidentals[0]?.includes('b');
        const chromatic = useFlats ? CHROMATIC_FLAT : CHROMATIC_SHARP;

        // If a specific pitch is selected (in a chord), only transpose that pitch
        // Otherwise transpose all pitches
        const pitchesToModify = pitch ? [pitch] : slot.pitches;
        const newPitches = slot.pitches.map(p => {
            if (!pitchesToModify.includes(p)) return p;

            // Parse the pitch
            const match = p.match(/^([A-G])([#b]?)(\d+)$/);
            if (!match) return p;

            const noteName = match[1] + match[2];  // e.g., "C#"
            let octave = parseInt(match[3]);

            // Find current position in chromatic scale
            // Normalize enharmonic equivalents
            let noteIndex = chromatic.indexOf(noteName);
            if (noteIndex === -1) {
                // Try the other spelling
                const altChromatic = useFlats ? CHROMATIC_SHARP : CHROMATIC_FLAT;
                noteIndex = altChromatic.indexOf(noteName);
                if (noteIndex === -1) {
                    // Handle edge cases like Cb, E#, etc.
                    const enharmonicMap = {
                        'Cb': 11, 'B#': 0, 'Fb': 4, 'E#': 5
                    };
                    noteIndex = enharmonicMap[noteName];
                    if (noteIndex === undefined) return p;  // Can't transpose
                }
            }

            // Apply transposition
            let newIndex = noteIndex + semitones;

            // Handle octave changes
            while (newIndex < 0) {
                newIndex += 12;
                octave--;
            }
            while (newIndex >= 12) {
                newIndex -= 12;
                octave++;
            }

            // Get the new note name from chromatic scale
            const newNoteName = chromatic[newIndex];

            return newNoteName + octave;
        });

        // Update the slot (preserving all note properties)
        this.slotGrid.setNote(clef, voice, slotIndex, {
            pitches: newPitches,
            duration: slot.duration,
            dotted: slot.dotted,
            stemDirection: slot.stemDirection,
            articulation: slot.articulation,
            dynamic: slot.dynamic,
            ornament: slot.ornament,
            fermata: slot.fermata,
            graceNotes: slot.graceNotes,
            tied: slot.tied,
            isTied: slot.isTied,
            slur: slot.slur
        });

        // Update selection to point to new pitch
        if (pitch) {
            const pitchIndex = slot.pitches.indexOf(pitch);
            if (pitchIndex >= 0 && pitchIndex < newPitches.length) {
                this.selectedNote.pitch = newPitches[pitchIndex];
            }
        }

        const direction = semitones > 0 ? '↑' : '↓';
        const newPitch = pitch ? this.selectedNote.pitch : newPitches.join(', ');
        this._updateStatus(`Transposed ${direction} to ${newPitch}`);
        this._renderStaves();
    }

    /**
     * Move the selected note horizontally to an adjacent slot
     * @param {number} direction - -1 for left, +1 for right
     */
    _moveSelectedNoteHorizontally(direction) {
        if (!this.selectedNote) return;

        const { clef, voice, slotIndex } = this.selectedNote;
        const slot = this.slotGrid.getSlot(clef, voice, slotIndex);

        if (slot.type !== SLOT_TYPES.NOTE_START && slot.type !== SLOT_TYPES.REST) {
            this._updateStatus('No note or rest selected');
            return;
        }

        const newSlotIndex = slotIndex + direction;

        // Check bounds
        if (newSlotIndex < 0) {
            this._updateStatus('⚠️ Already at start of measure');
            return;
        }

        // Check if the note would overflow the measure at the new position
        const durationSlots = slot.durationSlots || 1;
        if (newSlotIndex + durationSlots > this.slotGrid.totalSlots) {
            this._updateStatus(`⚠️ Note would overflow measure at this position`);
            return;
        }

        // Check if destination slot is occupied (and not by the current note's continuation)
        const destSlot = this.slotGrid.getSlot(clef, voice, newSlotIndex);
        if (destSlot.type === SLOT_TYPES.NOTE_START || destSlot.type === SLOT_TYPES.REST) {
            this._updateStatus('⚠️ Destination slot is occupied');
            return;
        }
        // If moving left, also check we're not moving into a continuation of another note
        if (direction < 0 && destSlot.type === SLOT_TYPES.CONTINUATION) {
            this._updateStatus('⚠️ Destination slot is part of another note');
            return;
        }

        // Clear the old slot
        this.slotGrid.clearSlot(clef, voice, slotIndex);

        // Place at new position
        if (slot.type === SLOT_TYPES.NOTE_START) {
            this.slotGrid.setNote(clef, voice, newSlotIndex, {
                pitches: slot.pitches,
                duration: slot.duration,
                dotted: slot.dotted,
                stemDirection: slot.stemDirection,
                articulation: slot.articulation,
                dynamic: slot.dynamic
            });
        } else if (slot.type === SLOT_TYPES.REST) {
            this.slotGrid.setRest(clef, voice, newSlotIndex, {
                duration: slot.duration,
                dotted: slot.dotted
            });
        }

        // Update selection to new position
        this.selectedNote.slotIndex = newSlotIndex;

        const dirArrow = direction > 0 ? '→' : '←';
        const beat = newSlotIndex / SLOTS_PER_BEAT;
        this._updateStatus(`Moved ${dirArrow} to beat ${beat.toFixed(2)}`);
        this._renderStaves();
        this._updateFillStats();
    }

    /**
     * Play the current measure using the global piano and BPM
     */
    async _playMeasure() {
        // Ensure audio is ready
        if (!getAudioIsReady()) {
            await initAudio();
        }

        const piano = getPiano();
        if (!piano) {
            this._updateStatus('⚠️ Piano not available');
            return;
        }

        // Get current tempo
        const bpm = getCurrentTempo();
        const secondsPerBeat = 60 / bpm;

        // Collect all notes from the slot grid with slot info for highlighting
        const allNotes = [];

        ['treble', 'bass'].forEach(clef => {
            for (let v = 0; v < this.slotGrid.voiceCount; v++) {
                for (let s = 0; s < this.slotGrid.totalSlots; s++) {
                    const slot = this.slotGrid.getSlot(clef, v, s);
                    if (slot.type === SLOT_TYPES.NOTE_START && slot.pitches?.length > 0) {
                        const beat = s / SLOTS_PER_BEAT;
                        const durationBeats = durationToBeats(slot.duration, slot.dotted);
                        const durationSlots = Math.round(durationBeats * SLOTS_PER_BEAT);
                        allNotes.push({
                            pitches: slot.pitches,
                            startTime: beat * secondsPerBeat,
                            duration: durationBeats * secondsPerBeat,
                            clef: clef,
                            voice: v,
                            slotIndex: s,
                            durationSlots: durationSlots
                        });
                    }
                }
            }
        });

        if (allNotes.length === 0) {
            this._updateStatus('No notes to play');
            return;
        }

        // Show stop button, hide play button
        const playBtn = this.modal.querySelector('#mie-play-btn');
        const stopBtn = this.modal.querySelector('#mie-stop-btn');
        if (playBtn) playBtn.classList.add('hidden');
        if (stopBtn) stopBtn.classList.remove('hidden');

        // Store timeout IDs so we can cancel
        this._playbackTimeouts = [];

        // Initialize playback highlighting state
        this._playingNotes = new Set();  // Set of "clef-voice-slot" keys

        // Schedule all notes with highlighting
        allNotes.forEach(note => {
            const noteKey = `${note.clef}-${note.voice}-${note.slotIndex}`;

            // Start note - highlight and play
            const startTimeout = setTimeout(() => {
                this._playingNotes.add(noteKey);
                this._renderStaves();
                piano.triggerAttackRelease(note.pitches, note.duration, Tone.now());
            }, note.startTime * 1000);
            this._playbackTimeouts.push(startTimeout);

            // End note - remove highlight
            const endTimeout = setTimeout(() => {
                this._playingNotes.delete(noteKey);
                this._renderStaves();
            }, (note.startTime + note.duration) * 1000);
            this._playbackTimeouts.push(endTimeout);
        });

        // Calculate total duration
        const beatsPerMeasure = this.slotGrid.totalSlots / SLOTS_PER_BEAT;
        const measureDuration = beatsPerMeasure * secondsPerBeat;

        // Reset buttons after playback
        const resetTimeout = setTimeout(() => {
            this._stopPlayback();
        }, measureDuration * 1000 + 100);
        this._playbackTimeouts.push(resetTimeout);

        this._updateStatus(`Playing measure at ${bpm} BPM...`);
    }

    /**
     * Stop playback
     */
    _stopPlayback() {
        // Clear all scheduled timeouts
        if (this._playbackTimeouts) {
            this._playbackTimeouts.forEach(id => clearTimeout(id));
            this._playbackTimeouts = [];
        }

        // Clear highlighting
        if (this._playingNotes) {
            this._playingNotes.clear();
            this._renderStaves();
        }

        // Show play button, hide stop button
        const playBtn = this.modal.querySelector('#mie-play-btn');
        const stopBtn = this.modal.querySelector('#mie-stop-btn');
        if (playBtn) playBtn.classList.remove('hidden');
        if (stopBtn) stopBtn.classList.add('hidden');

        this._updateStatus('Click on staff to add notes');
    }

    /**
     * Update voice button states
     */
    _updateVoiceButtons() {
        this.modal.querySelectorAll('.mie-voice-btn').forEach(btn => {
            const isActive = parseInt(btn.dataset.voice) === this.currentVoice;
            btn.classList.toggle('bg-blue-100', isActive);
            btn.classList.toggle('border-blue-400', isActive);
        });
    }


    /**
     * Update sticky toggle status text
     */
    _updateStickyToggleStatus() {
        const statusEl = this.modal.querySelector('#mie-sticky-status');
        if (statusEl) {
            statusEl.textContent = this.noteEntryModeSticky ? 'Click to Add' : 'Hold Alt';
        }
    }

    /**
     * Show the musical hints legend modal
     */
    _showHintsLegend() {
        const legendModal = this.modal.querySelector('#mie-hints-legend-modal');
        if (legendModal) {
            legendModal.classList.remove('hidden');
        }
    }

    /**
     * Hide the musical hints legend modal
     */
    _hideHintsLegend() {
        const legendModal = this.modal.querySelector('#mie-hints-legend-modal');
        if (legendModal) {
            legendModal.classList.add('hidden');
        }
    }

    /**
     * Open the editor for a specific measure
     */
    open(measureIndex) {
        this.measureIndex = measureIndex;
        this.centerMeasureIndex = measureIndex;  // Multi-measure: track the originally selected measure
        this.showPrevious = false;  // Reset to single measure view
        this.showNext = false;
        this.measureCount = 1;
        this.currentDuration = '4n';
        this.isDotted = false;
        this.isRestMode = false;
        this.currentAccidental = null;  // null = use key signature
        this.currentVoice = 0;
        this.ghostNote = null;  // Clear ghost note
        this.selectedNote = null;  // Clear any selection
        this.selectedNotes.clear();  // Clear multi-selection
        this.lastSelectedNote = null;
        this.isAltPressed = false;  // Reset Alt key state
        // Note: noteEntryModeSticky is NOT reset - it persists across modal opens

        const measure = this.compositionState.getMeasure(measureIndex);
        if (!measure) {
            console.error(`[MeasureIsolationEditor] Measure ${measureIndex} not found`);
            return;
        }

        // DEBUG: Log measure data to identify duplication source
        console.log('[MeasureIsolationEditor] Loading measure:', measureIndex);
        console.log('[MeasureIsolationEditor] Bass voices:', JSON.stringify(measure.notation?.bass?.voices, null, 2));
        console.log('[MeasureIsolationEditor] Treble voices:', JSON.stringify(measure.notation?.treble?.voices, null, 2));

        // Get the current key for key signature display
        // Key is stored in compositionState.metadata.key (direct property access)
        this.currentKey = this.compositionState.metadata?.key || 'C';
        this.keyAccidentals = KEY_SIGNATURES[this.currentKey] || [];
        console.log('[MIE] Key from metadata:', this.currentKey, 'accidentals:', this.keyAccidentals);

        // Get the chord for this measure (for harmonic function coloring)
        this.measureChord = measure.chord || null;
        console.log('[MIE] Measure chord:', this.measureChord);

        // Get the next measure's chord for bass approach note suggestions
        const nextMeasure = this.compositionState.getMeasure(measureIndex + 1);
        this.nextMeasureChord = nextMeasure?.chord || null;
        console.log('[MIE] Next measure chord:', this.nextMeasureChord);

        const timeSignature = this.compositionState.getTimeSignature();
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);

        // Calculate START_X dynamically based on number of key signature accidentals
        // Base: 70 (clef) + 12 per accidental + 20 margin
        const accidentalCount = this.keyAccidentals.length;
        this.START_X = 70 + (accidentalCount * 12) + 20;

        // Calculate slot width based on available space and number of slots
        const totalSlots = Math.round(beatsPerMeasure * SLOTS_PER_BEAT);
        this.SLOT_WIDTH = (this.STAFF_WIDTH - this.START_X - 30) / totalSlots;
        // Visual slot width for grid display (coarser grid for usability)
        const totalVisualSlots = Math.round(beatsPerMeasure * this.VISUAL_SLOTS_PER_BEAT);
        this.VISUAL_SLOT_WIDTH = (this.STAFF_WIDTH - this.START_X - 30) / totalVisualSlots;

        // Create slot grid (single measure initially)
        this.slotGrid = new SlotGrid(timeSignature, 2, 1);
        this.slotGrid.loadFromMeasure(measure);

        // Store visible measure indices (just the center measure initially)
        this.visibleMeasureIndices = [measureIndex];

        // Update title
        const titleEl = this.modal.querySelector('#mie-title');
        if (titleEl) {
            titleEl.textContent = `Measure Editor - Measure ${measureIndex + 1}`;
        }

        // Reset UI state
        this._updateDurationButtons();
        this._updateAccidentalButtons();
        this._updateModeButtons();
        this._updateVoiceButtons();
        this._updateDeleteButton();
        this.modal.querySelector('#mie-dotted').checked = false;

        // Sync sticky toggle checkbox with state (persists across modal opens)
        const stickyToggle = this.modal.querySelector('#mie-sticky-toggle');
        if (stickyToggle) {
            stickyToggle.checked = this.noteEntryModeSticky;
        }
        this._updateStickyToggleStatus();
        this._updateModeStatus();

        // Reset Previous/Next checkboxes and update their enabled state
        const prevCheckbox = this.modal.querySelector('#mie-show-prev');
        const nextCheckbox = this.modal.querySelector('#mie-show-next');
        if (prevCheckbox) prevCheckbox.checked = false;
        if (nextCheckbox) nextCheckbox.checked = false;
        this._updatePrevNextToggles();

        // Update Smart Suggestions panel with chord context
        this._updateSuggestionsPanel();

        // Note: Navigation buttons are created in _updateMeasureNumbers() which runs after canvas init

        // Show modal
        this.modal.classList.remove('hidden');

        // Initialize canvases and render
        setTimeout(() => {
            this._initCanvases();
            this._updateMeasureNumbers();
            this._renderStaves();
            this._updateFillStats();
            this._renderMelodicPatterns();  // Initialize melodic pattern suggestions
        }, 50);
    }

    /**
     * Initialize the canvases
     */
    _initCanvases() {
        // Treble canvas - less height below staff (notes go up)
        this.trebleCanvas = this.modal.querySelector('#mie-treble-canvas');
        if (this.trebleCanvas) {
            this.trebleCanvas.width = this.STAFF_WIDTH;
            this.trebleCanvas.height = this.TREBLE_CANVAS_HEIGHT;
            this.trebleCanvas.onclick = (e) => this._handleCanvasClick(e, 'treble');
            this.trebleCanvas.onmousemove = (e) => this._handleCanvasMouseMove(e, 'treble');
            this.trebleCanvas.onmouseleave = () => this._handleCanvasMouseLeave('treble');
        }

        // Bass canvas - more height below staff (notes go down)
        this.bassCanvas = this.modal.querySelector('#mie-bass-canvas');
        if (this.bassCanvas) {
            this.bassCanvas.width = this.STAFF_WIDTH;
            this.bassCanvas.height = this.BASS_CANVAS_HEIGHT;
            this.bassCanvas.onclick = (e) => this._handleCanvasClick(e, 'bass');
            this.bassCanvas.onmousemove = (e) => this._handleCanvasMouseMove(e, 'bass');
            this.bassCanvas.onmouseleave = () => this._handleCanvasMouseLeave('bass');
        }
    }

    /**
     * Handle canvas click - determine slot and pitch from position
     */
    _handleCanvasClick(event, clef) {
        // Update focused clef for Smart Suggestions panel
        this._setFocusedClef(clef);

        // Set clef-specific STAFF_TOP_Y for pitch calculations
        this.STAFF_TOP_Y = clef === 'treble' ? this.TREBLE_STAFF_TOP_Y : this.BASS_STAFF_TOP_Y;

        const canvas = clef === 'treble' ? this.trebleCanvas : this.bassCanvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        // Determine slot index from X position
        // Convert visual position to data slot: click position -> visual slot -> beat -> data slot
        const slotX = x - this.START_X;
        if (slotX < 0) {
            this._updateStatus('Click after the clef to add notes');
            return;
        }

        // Calculate beat position from visual slot, then convert to data slot
        const visualSlot = slotX / this.VISUAL_SLOT_WIDTH;
        const beatPosition = visualSlot / this.VISUAL_SLOTS_PER_BEAT;
        const rawSlotIndex = Math.floor(beatPosition * SLOTS_PER_BEAT);

        // For note placement, snap to the start of the visual slot the user clicked in
        // This makes placement less finicky - clicking anywhere in a visual slot places at its start
        const dataSlotsPerVisual = SLOTS_PER_BEAT / this.VISUAL_SLOTS_PER_BEAT;  // 48/8 = 6
        const snappedSlotIndex = Math.floor(rawSlotIndex / dataSlotsPerVisual) * dataSlotsPerVisual;

        // Use raw slot for selection (finding existing notes), snapped slot for note placement
        const slotIndex = rawSlotIndex;  // For selection/detection
        const placementSlotIndex = snappedSlotIndex;  // For placing new notes

        if (slotIndex < 0 || slotIndex >= this.slotGrid.totalSlots) {
            this._updateStatus(this.measureCount > 1 ? 'Click within the measure bounds' : 'Click within the measure');
            return;
        }

        // Mode-based click handling:
        // - In Select mode: clicking on notes selects them, clicking empty space does nothing
        // - In Entry mode: always add/place notes (skip selection)
        const inEntryMode = this._isInNoteEntryMode();
        const clickedNote = this._findNoteAtClick(clef, slotIndex, y);

        // In Select mode, only allow note selection (no adding notes)
        if (!inEntryMode) {
            if (clickedNote) {
                // Use the actual slot index where the note is stored, not the clicked position
                const actualSlotIndex = clickedNote.slotIndex;
                const noteId = this._makeNoteId(clef, clickedNote.voice, actualSlotIndex, clickedNote.pitch);

                if (event.shiftKey) {
                    // Shift+Click: Toggle note in multi-selection
                    this._toggleNoteInSelection(clef, clickedNote.voice, actualSlotIndex, clickedNote.pitch);
                } else {
                    // Normal click: Replace selection
                    // If clicking same note that's already selected (and no multi-selection), deselect it
                    if (this.selectedNotes.size === 1 && this.selectedNotes.has(noteId)) {
                        this._clearSelection();
                    } else {
                        // Select just this note (clears any multi-selection)
                        this._selectNoteAtSlot(clef, clickedNote.voice, actualSlotIndex, clickedNote.pitch);
                    }
                }
            } else {
                // Clicking empty space in Select mode
                if (!event.shiftKey) {
                    // Clear selection when clicking empty space (unless shift is held)
                    if (this.selectedNotes.size > 0) {
                        this._clearSelection();
                    } else {
                        this._updateStatus('Hold Alt to enter notes');
                    }
                }
            }
            return;
        }

        // In Entry mode: Clear any existing selection when adding new notes
        if (this.selectedNote) {
            this._clearSelection();
        }

        // Rest mode - don't need pitch
        // Use placementSlotIndex (snapped to visual slot start) for cleaner placement
        if (this.isRestMode) {
            this._placeRest(clef, placementSlotIndex);
            return;
        }

        // Determine pitch from Y position using VexFlow-compatible calculation
        const pitch = this._getPitchFromY(y, clef);
        if (!pitch) {
            this._updateStatus('Click on or near a staff line or space');
            return;
        }

        // Determine accidental to use
        let accidental = '';
        if (this.currentAccidental === null) {
            // Use key signature: find if this note letter has an accidental in the key
            accidental = this._getKeySignatureAccidentalForNote(pitch.note);
        } else if (this.currentAccidental === 'n') {
            // Explicit natural - no accidental (override key signature)
            accidental = '';
        } else {
            // User explicitly selected # or b
            accidental = this.currentAccidental;
        }

        const fullPitch = pitch.note + accidental + pitch.octave;
        // Use placementSlotIndex (snapped to visual slot start) for cleaner placement
        this._placeNote(clef, placementSlotIndex, fullPitch);
    }

    /**
     * Handle canvas mouse move - update ghost note preview
     */
    _handleCanvasMouseMove(event, clef) {
        // Set clef-specific STAFF_TOP_Y for pitch calculations
        this.STAFF_TOP_Y = clef === 'treble' ? this.TREBLE_STAFF_TOP_Y : this.BASS_STAFF_TOP_Y;

        const canvas = clef === 'treble' ? this.trebleCanvas : this.bassCanvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        // Calculate slot index
        const slotX = x - this.START_X;
        if (slotX < 0) {
            this.lastMousePosition[clef] = null;
            if (this.ghostNote && this.ghostNote.clef === clef) {
                this.ghostNote = null;
                this._renderStaves();
            }
            return;
        }

        // Calculate beat position from visual slot, then convert to data slot
        const visualSlot = slotX / this.VISUAL_SLOT_WIDTH;
        const beatPosition = visualSlot / this.VISUAL_SLOTS_PER_BEAT;
        const rawSlotIndex = Math.floor(beatPosition * SLOTS_PER_BEAT);
        if (rawSlotIndex < 0 || rawSlotIndex >= this.slotGrid.totalSlots) {
            this.lastMousePosition[clef] = null;
            if (this.ghostNote && this.ghostNote.clef === clef) {
                this.ghostNote = null;
                this._renderStaves();
            }
            return;
        }

        // Snap to visual slot start for ghost note positioning (matches note placement)
        const dataSlotsPerVisual = SLOTS_PER_BEAT / this.VISUAL_SLOTS_PER_BEAT;  // 48/8 = 6
        const snappedSlotIndex = Math.floor(rawSlotIndex / dataSlotsPerVisual) * dataSlotsPerVisual;

        // Get pitch from Y position
        const pitchInfo = this._getPitchFromY(y, clef);
        if (!pitchInfo) {
            this.lastMousePosition[clef] = null;
            if (this.ghostNote && this.ghostNote.clef === clef) {
                this.ghostNote = null;
                this._renderStaves();
            }
            return;
        }

        // Determine accidental to use
        let accidental = '';
        if (this.currentAccidental === null) {
            accidental = this._getKeySignatureAccidentalForNote(pitchInfo.note);
        } else if (this.currentAccidental === 'n') {
            accidental = '';
        } else {
            accidental = this.currentAccidental;
        }

        const fullPitch = pitchInfo.note + accidental + pitchInfo.octave;
        // Position ghost note at snapped visual slot for consistent alignment
        // This shows exactly where the note will be placed
        const snappedBeat = snappedSlotIndex / SLOTS_PER_BEAT;
        const snappedVisualSlot = snappedBeat * this.VISUAL_SLOTS_PER_BEAT;
        const noteX = this.START_X + (snappedVisualSlot * this.VISUAL_SLOT_WIDTH) + (this.VISUAL_SLOT_WIDTH / 2);
        const noteY = this._getYFromPitch(fullPitch, clef);

        // Always store last mouse position for this clef (so we can restore ghost on Alt press)
        this.lastMousePosition[clef] = { x: noteX, y: noteY, slotIndex: snappedSlotIndex, pitch: fullPitch };

        // Only show ghost note in entry mode (not in select mode)
        // Also don't show ghost in rest mode
        if (!this._isInNoteEntryMode() || this.isRestMode) {
            if (this.ghostNote && this.ghostNote.clef === clef) {
                this.ghostNote = null;
                this._renderStaves();
            }
            return;
        }

        // Update ghost note if changed
        const newGhost = { clef, slotIndex: snappedSlotIndex, pitch: fullPitch, x: noteX, y: noteY };
        const ghostChanged = !this.ghostNote ||
            this.ghostNote.clef !== clef ||
            this.ghostNote.slotIndex !== snappedSlotIndex ||
            this.ghostNote.pitch !== fullPitch;

        if (ghostChanged) {
            this.ghostNote = newGhost;
            this._renderStaves();
        }
    }

    /**
     * Handle canvas mouse leave - clear ghost note and last mouse position
     */
    _handleCanvasMouseLeave(clef) {
        this.lastMousePosition[clef] = null;
        if (this.ghostNote && this.ghostNote.clef === clef) {
            this.ghostNote = null;
            this._renderStaves();
        }
    }

    /**
     * Find the closest note/rest to the click position within a tolerance
     * Returns { voice, slotIndex, pitch } if found, null otherwise
     * The pitch property allows selecting individual notes within a chord
     *
     * Uses distance-based selection to find the closest note/rest, which is
     * especially useful for polyphony and tuplets where notes may be close together.
     */
    _findNoteAtClick(clef, clickSlotIndex, clickY) {
        // Convert click slot index to X position for distance calculations
        const clickBeat = clickSlotIndex / SLOTS_PER_BEAT;
        const clickVisualSlot = clickBeat * this.VISUAL_SLOTS_PER_BEAT;
        const clickX = this.START_X + (clickVisualSlot * this.VISUAL_SLOT_WIDTH) + (this.VISUAL_SLOT_WIDTH / 2);

        // Tolerance settings
        const MAX_Y_DISTANCE = 20;  // Maximum vertical distance in pixels
        const MAX_X_DISTANCE = this.VISUAL_SLOT_WIDTH * 2;  // Maximum horizontal distance (2 visual slots)

        // Track the closest candidate
        let closestCandidate = null;
        let closestDistance = Infinity;

        // Search all slots (not just a narrow range) to find the closest note
        for (let v = 0; v < this.slotGrid.voiceCount; v++) {
            for (let s = 0; s < this.slotGrid.totalSlots; s++) {
                const slot = this.slotGrid.getSlot(clef, v, s);

                // Calculate the X position of this slot
                const slotBeat = s / SLOTS_PER_BEAT;
                const slotVisualPos = slotBeat * this.VISUAL_SLOTS_PER_BEAT;
                const slotX = this.START_X + (slotVisualPos * this.VISUAL_SLOT_WIDTH) + (this.VISUAL_SLOT_WIDTH / 2);

                // Quick X distance check - skip if too far horizontally
                const xDistance = Math.abs(clickX - slotX);
                if (xDistance > MAX_X_DISTANCE) continue;

                if (slot.type === SLOT_TYPES.NOTE_START) {
                    // Check each pitch in the note/chord
                    for (const pitch of slot.pitches || []) {
                        const ottavaInfo = getOttavaAdjustment(pitch, clef);
                        const ottavaShift = ottavaInfo.shift;
                        const noteY = this._getYFromPitch(pitch, clef, ottavaShift);

                        const yDistance = Math.abs(clickY - noteY);
                        if (yDistance > MAX_Y_DISTANCE) continue;

                        // Calculate combined distance (weighted: Y is more important for pitch selection)
                        const distance = Math.sqrt(xDistance * xDistance + yDistance * yDistance * 4);

                        if (distance < closestDistance) {
                            closestDistance = distance;
                            closestCandidate = { voice: v, slotIndex: s, pitch };
                        }
                    }
                } else if (slot.type === SLOT_TYPES.CONTINUATION) {
                    // Find the parent note start
                    const parentIndex = this._findNoteStartForContinuation(clef, v, s);
                    if (parentIndex !== null) {
                        const parentSlot = this.slotGrid.getSlot(clef, v, parentIndex);
                        for (const pitch of parentSlot.pitches || []) {
                            const ottavaInfo = getOttavaAdjustment(pitch, clef);
                            const ottavaShift = ottavaInfo.shift;
                            const noteY = this._getYFromPitch(pitch, clef, ottavaShift);

                            const yDistance = Math.abs(clickY - noteY);
                            if (yDistance > MAX_Y_DISTANCE) continue;

                            const distance = Math.sqrt(xDistance * xDistance + yDistance * yDistance * 4);

                            if (distance < closestDistance) {
                                closestDistance = distance;
                                closestCandidate = { voice: v, slotIndex: parentIndex, pitch };
                            }
                        }
                    }
                } else if (slot.type === SLOT_TYPES.REST) {
                    // Rest is positioned in middle of staff
                    const restY = this.STAFF_TOP_Y + 22;
                    const yDistance = Math.abs(clickY - restY);
                    if (yDistance > MAX_Y_DISTANCE) continue;

                    const distance = Math.sqrt(xDistance * xDistance + yDistance * yDistance * 4);

                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestCandidate = { voice: v, slotIndex: s, pitch: null };
                    }
                }
            }
        }

        return closestCandidate;
    }

    /**
     * Find the note start index for a continuation slot
     */
    _findNoteStartForContinuation(clef, voice, slotIndex) {
        for (let i = slotIndex - 1; i >= 0; i--) {
            const slot = this.slotGrid.getSlot(clef, voice, i);
            if (slot.type === SLOT_TYPES.NOTE_START) {
                return i;
            } else if (slot.type !== SLOT_TYPES.CONTINUATION) {
                return null;  // Gap found, no parent
            }
        }
        return null;
    }

    /**
     * Get pitch from Y coordinate using VexFlow-compatible calculation
     * Note: With automatic ottava detection, this returns the raw pitch from the visual position.
     * Notes that would require ottava treatment will be automatically displayed with brackets.
     */
    _getPitchFromY(y, clef) {
        // Calculate relative Y from staff top
        const relativeY = y - this.STAFF_TOP_Y;

        // Staff bottom line is at y = STAFF_HEIGHT (40px below top)
        // Each step (line or space) is PIXELS_PER_STEP (5px)
        const bottomLineY = this.STAFF_HEIGHT;
        const steps = Math.round((bottomLineY - relativeY) / this.PIXELS_PER_STEP);
        const line = steps * 2;

        // Convert line to pitch
        const basePitch = lineToPitch(line, clef);

        const match = basePitch.match(/^([A-G])(\d+)$/);
        if (match) {
            return { note: match[1], octave: parseInt(match[2]) };
        }

        return null;
    }

    /**
     * Get the accidental for a note letter from the current key signature
     * @param {string} noteLetter - Single letter note name (A-G)
     * @returns {string} The accidental ('#' or 'b') or '' if no accidental
     */
    _getKeySignatureAccidentalForNote(noteLetter) {
        if (!this.keyAccidentals || this.keyAccidentals.length === 0) {
            return '';
        }

        // Key accidentals are like ['F#', 'C#', 'G#'] or ['Bb', 'Eb']
        for (const acc of this.keyAccidentals) {
            // Extract note letter and accidental from key signature entry
            if (acc.startsWith(noteLetter)) {
                // Return the accidental part (everything after the note letter)
                return acc.substring(1);  // e.g., 'F#' -> '#', 'Bb' -> 'b'
            }
        }

        return '';
    }

    /**
     * Get Y position from pitch (inverse of _getPitchFromY)
     * @param {string} pitch - Pitch like "C4"
     * @param {string} clef - 'treble' or 'bass'
     * @param {number} [ottavaShift=0] - Octave shift for display (from automatic ottava detection)
     */
    _getYFromPitch(pitch, clef, ottavaShift = 0) {
        // Parse pitch
        const match = pitch.match(/^([A-G])([#b]?)(\d+)$/);
        if (!match) return this.STAFF_TOP_Y + 20; // Default to middle

        let octave = parseInt(match[3]);

        // Apply ottava shift for display (ottavaShift is already negative for 8va, positive for 8vb)
        if (ottavaShift !== 0) {
            octave += ottavaShift;
        }

        const adjustedPitch = match[1] + match[2] + octave;

        // Use pitchToLine from staffLayouter
        const line = pitchToLine(adjustedPitch, clef);
        const steps = line / 2;

        // Convert steps to Y position
        const bottomLineY = this.STAFF_HEIGHT;
        const relativeY = bottomLineY - (steps * this.PIXELS_PER_STEP);

        return this.STAFF_TOP_Y + relativeY;
    }

    /**
     * Generate optimal note/rest durations to fill a given number of slots
     * Uses the minimum number of tied notes to fill the space exactly
     * @param {number} slots - Number of slots to fill
     * @returns {Array<{duration: string, dotted: boolean, slots: number}>} Array of durations
     * @private
     */
    _generateOptimalDurations(slots) {
        if (slots <= 0) return [];

        const results = [];

        // Standard durations in descending order of slots (48 slots per beat to match SLOTS_PER_BEAT)
        // Dotted whole = 288 slots (6 beats), Whole = 192 slots (4 beats), etc.
        const standardDurations = [
            { duration: '1n', dotted: true, slots: 288 },   // dotted whole (6 beats)
            { duration: '1n', dotted: false, slots: 192 },  // whole (4 beats)
            { duration: '2n', dotted: true, slots: 144 },   // dotted half (3 beats)
            { duration: '2n', dotted: false, slots: 96 },   // half (2 beats)
            { duration: '4n', dotted: true, slots: 72 },    // dotted quarter (1.5 beats)
            { duration: '4n', dotted: false, slots: 48 },   // quarter (1 beat)
            { duration: '8n', dotted: true, slots: 36 },    // dotted eighth (0.75 beats)
            { duration: '8n', dotted: false, slots: 24 },   // eighth (0.5 beats)
            { duration: '16n', dotted: true, slots: 18 },   // dotted sixteenth (0.375 beats)
            { duration: '16n', dotted: false, slots: 12 },  // sixteenth (0.25 beats)
            { duration: '32n', dotted: false, slots: 6 },   // thirty-second (0.125 beats)
        ];

        let remainingSlots = slots;

        // Greedy algorithm: use largest duration that fits
        while (remainingSlots > 0) {
            let found = false;
            for (const dur of standardDurations) {
                if (dur.slots <= remainingSlots) {
                    results.push({ ...dur });
                    remainingSlots -= dur.slots;
                    found = true;
                    break;
                }
            }
            if (!found) {
                // Shouldn't happen with 32nd notes as minimum, but safety fallback
                console.warn(`[MeasureIsolationEditor] Could not fill remaining ${remainingSlots} slots`);
                break;
            }
        }

        return results;
    }

    /**
     * Place a note at the given position
     */
    _placeNote(clef, slotIndex, pitch) {
        // Check if there's already a note at this slot
        const existingSlot = this.slotGrid.getSlot(clef, this.currentVoice, slotIndex);

        // Check if this slot is part of a tuplet - limit editing for tuplets
        if (existingSlot.tupletGroupId || existingSlot.tupletType) {
            this._updateStatus('⚠️ Cannot add notes to tuplet. Use arrow keys to change pitch or Composition Studio for complex edits.');
            return;
        }

        // Also check if any slot in the duration range would overlap with a tuplet
        const durationBeats = durationToBeats(this.currentDuration, this.isDotted);
        const durationSlots = Math.round(durationBeats * SLOTS_PER_BEAT);
        for (let s = slotIndex; s < slotIndex + durationSlots && s < this.slotGrid.totalSlots; s++) {
            const checkSlot = this.slotGrid.getSlot(clef, this.currentVoice, s);
            if (checkSlot.tupletGroupId || checkSlot.tupletType) {
                this._updateStatus('⚠️ Note would overlap with tuplet. Use Composition Studio for complex tuplet edits.');
                return;
            }
        }

        if (existingSlot.type === SLOT_TYPES.NOTE_START) {
            // Add pitch to existing chord (polyphony)
            if (!existingSlot.pitches?.includes(pitch)) {
                this.slotGrid.addPitchToNote(clef, this.currentVoice, slotIndex, pitch);
                this._updateStatus(`Added ${pitch} to chord`);
            } else {
                this._updateStatus(`${pitch} already in chord`);
                return;
            }
        } else if (existingSlot.type === SLOT_TYPES.CONTINUATION) {
            this._updateStatus('⚠️ Slot is part of a longer note - select and delete first');
            return;
        } else if (existingSlot.type === SLOT_TYPES.REST) {
            // Overwriting a rest - warn the user
            this._updateStatus(`⚠️ Replacing rest with ${pitch}`);
            // Fall through to place the note
        } else {
            // Check if the other voice has content at this slot
            const otherVoice = this.currentVoice === 0 ? 1 : 0;
            const otherSlot = this.slotGrid.getSlot(clef, otherVoice, slotIndex);
            if (otherSlot.type === SLOT_TYPES.NOTE_START || otherSlot.type === SLOT_TYPES.CONTINUATION) {
                // Other voice has content - inform user this creates a multi-voice situation
                const otherPitchInfo = otherSlot.pitches?.join(', ') || 'content';
                this._updateStatus(`Adding ${pitch} (Voice ${this.currentVoice + 1}) - V${otherVoice + 1} has ${otherPitchInfo} here`);
            }
        }

        // Only reach here if placing new note (not adding to chord)
        if (existingSlot.type !== SLOT_TYPES.NOTE_START) {
            // Check if note would overflow the measure
            const durationBeats = durationToBeats(this.currentDuration, this.isDotted);
            const durationSlots = Math.round(durationBeats * SLOTS_PER_BEAT);
            const availableSlots = this.slotGrid.totalSlots - slotIndex;

            // Determine stem direction:
            // Only force V1 up / V2 down when BOTH voices are active in this clef
            const v0HasContent = this.slotGrid.voiceHasContent(clef, 0);
            const v1HasContent = this.slotGrid.voiceHasContent(clef, 1);
            const bothVoicesActive = v0HasContent && v1HasContent;

            // If placing in V2 and V1 already has content, or vice versa, both will be active
            const willBothBeActive = bothVoicesActive ||
                (this.currentVoice === 0 && v1HasContent) ||
                (this.currentVoice === 1 && v0HasContent);

            let stemDirection = undefined;  // undefined = natural direction based on pitch
            if (willBothBeActive) {
                // Force stem direction: V1 up (1), V2 down (-1)
                stemDirection = this.currentVoice === 0 ? 1 : -1;
            }

            if (durationSlots > availableSlots) {
                // Note would overflow - truncate and use ties to fill available space
                const availableBeats = availableSlots / SLOTS_PER_BEAT;
                const requestedBeats = durationBeats;

                // Show toast notification about truncation
                showToast(
                    `Note truncated: ${requestedBeats} beats → ${availableBeats} beats`,
                    { type: 'warning', duration: 3000 }
                );

                // Generate optimal durations to fill available space with ties
                const optimalDurations = this._generateOptimalDurations(availableSlots);

                if (optimalDurations.length === 0) {
                    this._updateStatus(`⚠️ No space available at this position`);
                    return;
                }

                // Place notes with ties
                let currentSlot = slotIndex;
                optimalDurations.forEach((dur, index) => {
                    const isFirst = index === 0;
                    const isLast = index === optimalDurations.length - 1;
                    const needsTie = optimalDurations.length > 1 && !isLast;

                    this.slotGrid.setNote(clef, this.currentVoice, currentSlot, {
                        pitches: [pitch],
                        duration: dur.duration,
                        dotted: dur.dotted,
                        stemDirection: stemDirection,
                        tied: needsTie,  // This note ties to the next
                        isTied: !isFirst  // This note is tied from the previous
                    });

                    currentSlot += dur.slots;
                });

                // Status message
                const tiedCount = optimalDurations.length;
                const tiedMsg = tiedCount > 1 ? ` (${tiedCount} tied notes)` : '';
                this._updateStatus(`Added ${pitch} truncated to ${availableBeats} beats${tiedMsg}`);
            } else {
                // Normal placement - note fits
                this.slotGrid.setNote(clef, this.currentVoice, slotIndex, {
                    pitches: [pitch],
                    duration: this.currentDuration,
                    dotted: this.isDotted,
                    stemDirection: stemDirection
                });

                // Check if note spans measures (for informative status message)
                if (this.measureCount > 1) {
                    const startMeasure = this.slotGrid.getMeasureIndexForSlot(slotIndex);
                    const endMeasure = this.slotGrid.getMeasureIndexForSlot(slotIndex + durationSlots - 1);
                    if (endMeasure > startMeasure) {
                        const measuresCrossed = endMeasure - startMeasure;
                        this._updateStatus(`Added ${pitch} spanning ${measuresCrossed + 1} measures (tied)`);
                    } else {
                        this._updateStatus(`Added ${pitch} (${this._getDurationName(this.currentDuration)}${this.isDotted ? ' dotted' : ''})`);
                    }
                } else {
                    this._updateStatus(`Added ${pitch} (${this._getDurationName(this.currentDuration)}${this.isDotted ? ' dotted' : ''})`);
                }
            }
        }

        this._renderStaves();
        this._updateFillStats();

        // Check for voice leading issues after placing the note
        this._checkVoiceLeadingIssues(clef, slotIndex, pitch);

        // Update melodic pattern suggestions
        this._renderMelodicPatterns();
    }

    /**
     * Place a rest at the given position
     */
    _placeRest(clef, slotIndex) {
        const existingSlot = this.slotGrid.getSlot(clef, this.currentVoice, slotIndex);

        // Check if this slot is part of a tuplet - limit editing for tuplets
        if (existingSlot.tupletGroupId || existingSlot.tupletType) {
            this._updateStatus('⚠️ Cannot replace tuplet with rest. Use Composition Studio for complex tuplet edits.');
            return;
        }

        if (existingSlot.type === SLOT_TYPES.CONTINUATION) {
            this._updateStatus('Slot is part of a longer note - use Erase first');
            return;
        }

        // Check if rest would overflow the measure
        const durationBeats = durationToBeats(this.currentDuration, this.isDotted);
        const durationSlots = Math.round(durationBeats * SLOTS_PER_BEAT);
        const availableSlots = this.slotGrid.totalSlots - slotIndex;

        if (durationSlots > availableSlots) {
            // Rest would overflow - truncate to fill available space
            const availableBeats = availableSlots / SLOTS_PER_BEAT;

            // Show toast notification about truncation
            showToast(
                `Rest truncated: ${durationBeats} beats → ${availableBeats} beats`,
                { type: 'warning', duration: 3000 }
            );

            // Generate optimal durations to fill available space
            const optimalDurations = this._generateOptimalDurations(availableSlots);

            if (optimalDurations.length === 0) {
                this._updateStatus(`⚠️ No space available at this position`);
                return;
            }

            // Place rests (rests don't tie, just place multiple)
            let currentSlot = slotIndex;
            optimalDurations.forEach((dur) => {
                this.slotGrid.setRest(clef, this.currentVoice, currentSlot, {
                    duration: dur.duration,
                    dotted: dur.dotted
                });
                currentSlot += dur.slots;
            });

            // Status message
            const restCount = optimalDurations.length;
            const restMsg = restCount > 1 ? ` (${restCount} rests)` : '';
            this._updateStatus(`Added rest truncated to ${availableBeats} beats${restMsg}`);
        } else {
            // Normal placement - rest fits
            this.slotGrid.setRest(clef, this.currentVoice, slotIndex, {
                duration: this.currentDuration,
                dotted: this.isDotted
            });

            this._updateStatus(`Added rest (${this._getDurationName(this.currentDuration)})`);
        }

        this._renderStaves();
        this._updateFillStats();
    }

    /**
     * Erase at the given slot
     */
    _eraseAtSlot(clef, slotIndex) {
        const existingSlot = this.slotGrid.getSlot(clef, this.currentVoice, slotIndex);

        if (existingSlot.type === SLOT_TYPES.EMPTY) {
            this._updateStatus('Slot is already empty');
            return;
        }

        this.slotGrid.clearSlot(clef, this.currentVoice, slotIndex);
        this._updateStatus('Cleared slot');
        this._renderStaves();
        this._updateFillStats();
        this._renderMelodicPatterns();  // Update after erase
    }

    /**
     * Render both staves
     */
    _renderStaves() {
        this._renderStaff('treble');
        this._renderStaff('bass');

        // Draw measure bar lines on top
        if (this.measureCount > 1) {
            this._drawMeasureBarLines();
        }
    }

    /**
     * Render a single staff with slot grid overlay
     */
    _renderStaff(clef) {
        const canvas = clef === 'treble' ? this.trebleCanvas : this.bassCanvas;
        if (!canvas) return;

        // Set clef-specific STAFF_TOP_Y for all rendering methods
        this.STAFF_TOP_Y = clef === 'treble' ? this.TREBLE_STAFF_TOP_Y : this.BASS_STAFF_TOP_Y;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw measure background shading (prev/next measures get subtle gray)
        if (this.measureCount > 1 && this.visibleMeasureIndices) {
            const visualSlotsPerMeasure = Math.round(this.slotGrid.beatsPerMeasure * this.VISUAL_SLOTS_PER_BEAT);
            this.visibleMeasureIndices.forEach((measureIndex, viewOffset) => {
                if (measureIndex !== this.centerMeasureIndex) {
                    // Non-center measures get gray background
                    const startVisualSlot = viewOffset * visualSlotsPerMeasure;
                    const x = this.START_X + (startVisualSlot * this.VISUAL_SLOT_WIDTH);
                    const width = visualSlotsPerMeasure * this.VISUAL_SLOT_WIDTH;

                    ctx.fillStyle = 'rgba(156, 163, 175, 0.15)';  // Gray-400 at 15% opacity
                    ctx.fillRect(x, 0, width, canvas.height);
                }
            });
        }

        // Draw slot fill shading first (very background)
        this._drawSlotFillShading(ctx, clef);

        // Draw slot grid lines (background)
        this._drawSlotGrid(ctx);

        // Draw staff lines
        this._drawStaffLines(ctx, clef);

        // Draw clef
        this._drawClef(ctx, clef);

        // Draw key signature after clef
        this._drawKeySignature(ctx, clef);

        // Draw notes from slot grid (includes automatic ottava detection and brackets)
        this._drawNotes(ctx, clef);

        // Draw ghost note preview (if hovering on this clef)
        this._drawGhostNote(ctx, clef);
    }

    /**
     * Draw slot fill shading - green for filled, red for unfilled
     * Uses visual slots for display (coarser than data slots) to avoid performance issues
     * If both voices are in use, split vertically: top half = V1, bottom half = V2
     */
    _drawSlotFillShading(ctx, clef) {
        const beatsPerMeasure = this.slotGrid.beatsPerMeasure * this.slotGrid.measureCount;
        const totalVisualSlots = Math.round(beatsPerMeasure * this.VISUAL_SLOTS_PER_BEAT);
        const dataSlotsPerVisualSlot = SLOTS_PER_BEAT / this.VISUAL_SLOTS_PER_BEAT;

        // Check if both voices have content
        const v0HasContent = this.slotGrid.voiceHasContent(clef, 0);
        const v1HasContent = this.slotGrid.voiceHasContent(clef, 1);
        const bothVoicesActive = v0HasContent && v1HasContent;

        // Define the shading area (the staff area plus some margin)
        const shadingTop = this.STAFF_TOP_Y - 20;
        const shadingBottom = this.STAFF_TOP_Y + this.STAFF_HEIGHT + 20;
        const shadingHeight = shadingBottom - shadingTop;
        const halfHeight = shadingHeight / 2;

        // Colors - light transparent versions
        const filledColor = 'rgba(34, 197, 94, 0.15)';   // Light green
        const unfilledColor = 'rgba(239, 68, 68, 0.15)'; // Light red

        for (let vs = 0; vs < totalVisualSlots; vs++) {
            const x = this.START_X + (vs * this.VISUAL_SLOT_WIDTH);

            // Check if ANY data slot in this visual slot range is filled
            const dataSlotStart = Math.floor(vs * dataSlotsPerVisualSlot);
            const dataSlotEnd = Math.floor((vs + 1) * dataSlotsPerVisualSlot);

            if (bothVoicesActive) {
                // Check fill status for each voice across the data slot range
                let v0Filled = false;
                let v1Filled = false;

                for (let s = dataSlotStart; s < dataSlotEnd && s < this.slotGrid.totalSlots; s++) {
                    const v0Slot = this.slotGrid.getSlot(clef, 0, s);
                    const v1Slot = this.slotGrid.getSlot(clef, 1, s);
                    if (v0Slot.type !== SLOT_TYPES.EMPTY) v0Filled = true;
                    if (v1Slot.type !== SLOT_TYPES.EMPTY) v1Filled = true;
                }

                // Top half (V1)
                ctx.fillStyle = v0Filled ? filledColor : unfilledColor;
                ctx.fillRect(x, shadingTop, this.VISUAL_SLOT_WIDTH, halfHeight);

                // Bottom half (V2)
                ctx.fillStyle = v1Filled ? filledColor : unfilledColor;
                ctx.fillRect(x, shadingTop + halfHeight, this.VISUAL_SLOT_WIDTH, halfHeight);

                // Draw a subtle divider line between V1 and V2 areas
                ctx.strokeStyle = 'rgba(156, 163, 175, 0.3)';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(x, shadingTop + halfHeight);
                ctx.lineTo(x + this.VISUAL_SLOT_WIDTH, shadingTop + halfHeight);
                ctx.stroke();
                ctx.setLineDash([]);
            } else {
                // Single voice mode: use whichever voice has content (or V0 by default)
                const activeVoice = v1HasContent ? 1 : 0;
                let isFilled = false;

                for (let s = dataSlotStart; s < dataSlotEnd && s < this.slotGrid.totalSlots; s++) {
                    const slot = this.slotGrid.getSlot(clef, activeVoice, s);
                    if (slot.type !== SLOT_TYPES.EMPTY) {
                        isFilled = true;
                        break;
                    }
                }

                ctx.fillStyle = isFilled ? filledColor : unfilledColor;
                ctx.fillRect(x, shadingTop, this.VISUAL_SLOT_WIDTH, shadingHeight);
            }
        }

        // Draw tuplet group indicators on top of the slot shading
        this._drawTupletGroupIndicators(ctx, clef);
    }

    /**
     * Draw visual indicators for tuplet groups in the slot grid
     * Shows purple borders/highlights around slots that contain tuplet notes
     * This helps users identify which notes belong to a tuplet group
     */
    _drawTupletGroupIndicators(ctx, clef) {
        const dataSlotsPerVisualSlot = SLOTS_PER_BEAT / this.VISUAL_SLOTS_PER_BEAT;

        // Collect tuplet groups from the slot grid
        const tupletGroups = {};  // groupId -> { slots: [], color }

        // Scan all slots for tuplet notes
        for (let v = 0; v < this.slotGrid.voiceCount; v++) {
            for (let s = 0; s < this.slotGrid.totalSlots; s++) {
                const slot = this.slotGrid.getSlot(clef, v, s);
                if (slot.type === SLOT_TYPES.NOTE_START && slot.tupletGroupId) {
                    if (!tupletGroups[slot.tupletGroupId]) {
                        tupletGroups[slot.tupletGroupId] = {
                            slots: [],
                            tupletType: slot.tupletType || 'triplet',
                            voice: v
                        };
                    }
                    // Track the visual slot range this note occupies
                    const visualSlotStart = Math.floor(s / dataSlotsPerVisualSlot);
                    const durationSlots = slot.durationSlots || dataSlotsPerVisualSlot;
                    const visualSlotEnd = Math.ceil((s + durationSlots) / dataSlotsPerVisualSlot);
                    tupletGroups[slot.tupletGroupId].slots.push({
                        dataSlot: s,
                        visualStart: visualSlotStart,
                        visualEnd: visualSlotEnd,
                        pitches: slot.pitches
                    });
                }
            }
        }

        // Draw indicators for each tuplet group
        const shadingTop = this.STAFF_TOP_Y - 20;
        const shadingHeight = this.STAFF_HEIGHT + 40;

        for (const [groupId, group] of Object.entries(tupletGroups)) {
            if (group.slots.length === 0) continue;

            // Find the full span of this tuplet group
            const minVisualSlot = Math.min(...group.slots.map(s => s.visualStart));
            const maxVisualSlot = Math.max(...group.slots.map(s => s.visualEnd));

            const startX = this.START_X + (minVisualSlot * this.VISUAL_SLOT_WIDTH);
            const endX = this.START_X + (maxVisualSlot * this.VISUAL_SLOT_WIDTH);
            const width = endX - startX;

            // Draw a colored border around the tuplet span
            ctx.save();
            ctx.strokeStyle = '#7c3aed';  // Purple
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2]);  // Dashed line

            // Draw top and bottom borders
            ctx.beginPath();
            ctx.moveTo(startX, shadingTop);
            ctx.lineTo(endX, shadingTop);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(startX, shadingTop + shadingHeight);
            ctx.lineTo(endX, shadingTop + shadingHeight);
            ctx.stroke();

            // Draw left and right borders
            ctx.beginPath();
            ctx.moveTo(startX, shadingTop);
            ctx.lineTo(startX, shadingTop + shadingHeight);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(endX, shadingTop);
            ctx.lineTo(endX, shadingTop + shadingHeight);
            ctx.stroke();

            ctx.setLineDash([]);

            // Draw subtle background fill
            ctx.fillStyle = 'rgba(124, 58, 237, 0.06)';  // Very light purple
            ctx.fillRect(startX, shadingTop, width, shadingHeight);

            // Draw tuplet label at the top
            const tupletLabel = group.tupletType === 'triplet' ? '3' :
                               group.tupletType === 'quintuplet' ? '5' :
                               group.tupletType === 'sextuplet' ? '6' : '?';
            ctx.fillStyle = '#7c3aed';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`[${tupletLabel}]`, startX + width / 2, shadingTop - 2);

            ctx.restore();
        }
    }

    /**
     * Draw vertical slot grid lines
     * Uses visual slots (coarser) for display while data uses full 48-slot resolution
     * Handles both simple and compound meters with appropriate beat groupings
     */
    _drawSlotGrid(ctx) {
        const beatsPerMeasure = this.slotGrid.beatsPerMeasure * this.slotGrid.measureCount;
        const totalVisualSlots = Math.round(beatsPerMeasure * this.VISUAL_SLOTS_PER_BEAT);
        const isCompound = this.slotGrid.isCompoundMeter();

        for (let s = 0; s <= totalVisualSlots; s++) {
            const x = this.START_X + (s * this.VISUAL_SLOT_WIDTH);
            const beat = s / this.VISUAL_SLOTS_PER_BEAT;
            const subBeat = s % this.VISUAL_SLOTS_PER_BEAT;

            // Calculate beat info for visual slot
            const isDownbeat = subBeat === 0;
            const isHalfBeat = subBeat === this.VISUAL_SLOTS_PER_BEAT / 2;
            const isQuarterBeat = subBeat % (this.VISUAL_SLOTS_PER_BEAT / 4) === 0;

            // Different styles for beat markers - DARKER colors
            if (isDownbeat) {
                ctx.strokeStyle = '#6b7280';  // Darker gray for downbeats (felt beats)
                ctx.lineWidth = 1.5;
            } else if (isCompound && (subBeat % Math.round(this.VISUAL_SLOTS_PER_BEAT / 3) === 0)) {
                // In compound meter, show triplet divisions (eighth notes) more prominently
                ctx.strokeStyle = '#9ca3af';  // Medium gray for triplet eighth notes
                ctx.lineWidth = 1;
            } else if (!isCompound && isHalfBeat) {
                ctx.strokeStyle = '#9ca3af';  // Medium gray for half beats (simple meter)
                ctx.lineWidth = 1;
            } else if (isQuarterBeat) {
                ctx.strokeStyle = '#c9cdd4';  // Lighter gray for subdivisions
                ctx.lineWidth = 0.75;
            } else {
                ctx.strokeStyle = '#d1d5db';  // Light gray for fine subdivisions
                ctx.lineWidth = 0.5;
            }

            // Draw grid lines from above staff to below
            const gridTop = this.STAFF_TOP_Y - 30;  // Room for ledger lines
            const gridBottom = this.STAFF_TOP_Y + this.STAFF_HEIGHT + 30;

            ctx.beginPath();
            ctx.moveTo(x, gridTop);
            ctx.lineTo(x, gridBottom);
            ctx.stroke();

            // Beat numbers on downbeats - draw above the grid lines
            // For multi-measure, restart beat numbering at 1 for each measure
            if (isDownbeat && s < totalVisualSlots) {
                ctx.fillStyle = '#1f2937';  // Dark gray
                ctx.font = 'bold 12px Arial';

                // Calculate beat number within measure
                const measureIndex = Math.floor(beat / this.slotGrid.beatsPerMeasure);
                const beatInMeasure = Math.floor(beat % this.slotGrid.beatsPerMeasure) + 1;

                // Offset to the right to avoid overlap with bar lines
                ctx.fillText(beatInMeasure.toString(), x + 8, 18);
            }
        }
    }

    /**
     * Draw staff lines
     */
    _drawStaffLines(ctx, clef) {
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1;

        // 5 staff lines, each LINE_SPACING (10px) apart
        for (let i = 0; i < 5; i++) {
            const y = this.STAFF_TOP_Y + (i * this.LINE_SPACING);
            ctx.beginPath();
            ctx.moveTo(20, y);
            ctx.lineTo(this.STAFF_WIDTH - 20, y);
            ctx.stroke();
        }

        // Bar lines at start and end
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(20, this.STAFF_TOP_Y);
        ctx.lineTo(20, this.STAFF_TOP_Y + this.STAFF_HEIGHT);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(this.STAFF_WIDTH - 20, this.STAFF_TOP_Y);
        ctx.lineTo(this.STAFF_WIDTH - 20, this.STAFF_TOP_Y + this.STAFF_HEIGHT);
        ctx.stroke();
    }

    /**
     * Draw bar lines between measures for multi-measure view
     * This draws on both canvases simultaneously
     */
    _drawMeasureBarLines() {
        if (this.measureCount <= 1) return;

        const visualSlotsPerMeasure = Math.round(this.slotGrid.beatsPerMeasure * this.VISUAL_SLOTS_PER_BEAT);

        // Draw bar lines on both canvases
        [this.trebleCanvas, this.bassCanvas].forEach(canvas => {
            if (!canvas) return;
            const ctx = canvas.getContext('2d');

            // Draw prominent bar lines at each measure boundary
            ctx.strokeStyle = '#1f2937';  // Gray-800 - darker for visibility
            ctx.lineWidth = 3;

            for (let m = 1; m < this.measureCount; m++) {
                const visualSlotOffset = m * visualSlotsPerMeasure;
                const x = this.START_X + (visualSlotOffset * this.VISUAL_SLOT_WIDTH);

                // Draw thicker, more prominent bar line - full canvas height like slot grid lines
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
        });
    }

    /**
     * Draw clef symbol
     */
    _drawClef(ctx, clef) {
        ctx.fillStyle = '#1f2937';
        ctx.font = '50px serif';

        if (clef === 'treble') {
            // Treble clef G line is the 2nd line from bottom (G4)
            ctx.fillText('𝄞', 30, this.STAFF_TOP_Y + 32);
        } else {
            // Bass clef F line is the 2nd line from top (F3)
            ctx.fillText('𝄢', 30, this.STAFF_TOP_Y + 28);
        }
    }

    /**
     * Draw key signature accidentals after the clef
     * Sharps and flats are placed on specific staff lines following music notation convention
     *
     * Standard music notation uses specific pitches for key signature accidentals:
     * - Sharps: F#5, C#5, G#5, D#5, A#4, E#5, B#4 (treble clef)
     * - Flats: Bb4, Eb5, Ab4, Db5, Gb4, Cb5, Fb4 (treble clef)
     *
     * We use the same _getYFromPitch() function to get consistent positioning
     */
    _drawKeySignature(ctx, clef) {
        if (!this.keyAccidentals || this.keyAccidentals.length === 0) {
            return;
        }

        // Define the specific pitches for each accidental in the key signature
        // These are the standard octaves used in music notation
        const sharpPitches = {
            treble: { 'F': 'F5', 'C': 'C5', 'G': 'G5', 'D': 'D5', 'A': 'A4', 'E': 'E5', 'B': 'B4' },
            bass: { 'F': 'F3', 'C': 'C3', 'G': 'G3', 'D': 'D3', 'A': 'A2', 'E': 'E3', 'B': 'B2' }
        };

        const flatPitches = {
            treble: { 'B': 'B4', 'E': 'E5', 'A': 'A4', 'D': 'D5', 'G': 'G4', 'C': 'C5', 'F': 'F4' },
            bass: { 'B': 'B2', 'E': 'E3', 'A': 'A2', 'D': 'D3', 'G': 'G2', 'C': 'C3', 'F': 'F2' }
        };

        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 16px serif';

        let x = 70;  // Start after clef
        const isSharp = this.keyAccidentals[0]?.includes('#');

        this.keyAccidentals.forEach((acc) => {
            const noteName = acc.replace('#', '').replace('b', '');
            const pitchTable = isSharp ? sharpPitches : flatPitches;
            const pitch = pitchTable[clef]?.[noteName];

            if (pitch) {
                const y = this._getYFromPitch(pitch, clef);
                const symbol = isSharp ? '♯' : '♭';
                ctx.fillText(symbol, x, y + 5);
                x += 12;  // Space between accidentals
            }
        });
    }

    /**
     * Check if a pitch requires an accidental based on the key signature
     * Returns: '' if no accidental needed, or the accidental to show
     */
    _getDisplayAccidental(pitch) {
        if (!pitch) return '';

        const match = pitch.match(/^([A-G])([#b]?)(\d+)$/);
        if (!match) return '';

        const noteName = match[1];
        const accidental = match[2] || '';

        // Check if this note letter is in the key signature
        const keyAccidentalForNote = this.keyAccidentals.find(acc =>
            acc.startsWith(noteName)
        );

        if (keyAccidentalForNote) {
            // Note is in key signature
            const keyAccType = keyAccidentalForNote.includes('#') ? '#' : 'b';

            if (accidental === keyAccType) {
                // Note has same accidental as key signature - don't display it
                return '';
            } else if (accidental === '') {
                // Note is natural but key has accidental - show natural
                return 'n';
            } else {
                // Note has different accidental - show it
                return accidental;
            }
        } else {
            // Note letter not in key signature - show the accidental if any
            return accidental;
        }
    }

    /**
     * Get harmonic function color for a pitch based on the current chord
     * Returns { fill, stroke } colors, or null if no chord/harmonic coloring
     *
     * @param {string} pitch - The pitch to analyze (e.g., 'C4', 'F#5')
     * @param {string} clef - 'treble' or 'bass' (bass notes typically aren't colored)
     * @returns {{ fill: string, stroke: string } | null}
     */
    _getHarmonicColor(pitch, clef) {
        // Only color treble clef notes (melody), not bass (accompaniment)
        if (clef === 'bass') {
            return null;
        }

        // No chord = no harmonic coloring
        if (!this.measureChord || !this.measureChord.root) {
            return null;
        }

        try {
            const analysis = analyzeChordTone(pitch, this.measureChord, this.currentKey);
            if (analysis && analysis.colors) {
                return {
                    fill: analysis.colors.fill,
                    stroke: analysis.colors.stroke
                };
            }
        } catch (e) {
            // Fall back to default if analysis fails
            console.warn('[MIE] Harmonic analysis failed for', pitch, e);
        }

        return null;
    }

    /**
     * Draw ottava brackets for groups of notes that need them
     * Supports 8va/15ma/22ma (above) and 8vb/15mb/22mb (below)
     * @param {CanvasRenderingContext2D} ctx
     * @param {string} clef - 'treble' or 'bass'
     * @param {Array} brackets - Array of bracket info: { type, startX, endX, startSlot, endSlot }
     */
    _drawOttavaBrackets(ctx, clef, brackets) {
        if (!brackets || brackets.length === 0) return;

        for (const bracket of brackets) {
            // Determine if bracket goes above (8va/15ma/22ma) or below (8vb/15mb/22mb)
            const isAbove = bracket.type === '8va' || bracket.type === '15ma' || bracket.type === '22ma';
            const label = bracket.type;

            // Position bracket relative to the actual note positions:
            // - Above brackets (8va/15ma/22ma): above the notes (above minNoteY)
            // - Below brackets (8vb/15mb/22mb): below the notes (below maxNoteY)
            // Fall back to staff position if note Y wasn't tracked or is invalid
            let bracketY;
            if (isAbove) {
                // Above: position above the highest note in the bracket
                // Check for valid Y (not Infinity from empty pitch array)
                const hasValidMinY = bracket.minNoteY !== undefined &&
                                     bracket.minNoteY !== Infinity &&
                                     bracket.minNoteY > 0;
                const noteTopY = hasValidMinY ? bracket.minNoteY : this.STAFF_TOP_Y;
                bracketY = noteTopY - 20;  // 20px above the highest note
            } else {
                // Below: position below the lowest note in the bracket
                // Check for valid Y (not -Infinity from empty pitch array)
                const hasValidMaxY = bracket.maxNoteY !== undefined &&
                                     bracket.maxNoteY !== -Infinity &&
                                     bracket.maxNoteY > 0;
                const noteBottomY = hasValidMaxY ? bracket.maxNoteY : (this.STAFF_TOP_Y + this.STAFF_HEIGHT);
                bracketY = noteBottomY + 25;  // 25px below the lowest note
            }

            // Extend bracket slightly beyond note positions
            const startX = bracket.startX - 10;
            const endX = bracket.endX + 15;

            ctx.save();
            ctx.strokeStyle = '#3b82f6';  // Blue
            ctx.fillStyle = '#3b82f6';
            ctx.lineWidth = 1.5;

            // Draw label
            ctx.font = 'italic 12px serif';
            const labelWidth = ctx.measureText(label).width;
            // For above brackets, label goes above the line; for below brackets, label goes below the line
            ctx.fillText(label, startX, bracketY + (isAbove ? -3 : 12));

            // Draw dashed line from after label to end
            ctx.setLineDash([4, 2]);
            const lineStartX = startX + labelWidth + 5;

            if (lineStartX < endX) {
                ctx.beginPath();
                ctx.moveTo(lineStartX, bracketY);
                ctx.lineTo(endX, bracketY);
                ctx.stroke();
            }

            // Draw end hook pointing toward the notes:
            // - Above brackets (8va/15ma/22ma): hook goes DOWN (toward notes below the bracket)
            // - Below brackets (8vb/15mb/22mb): hook goes UP (toward notes above the bracket)
            const hookHeight = isAbove ? 8 : -8;
            ctx.beginPath();
            ctx.moveTo(endX, bracketY);
            ctx.lineTo(endX, bracketY + hookHeight);
            ctx.stroke();

            ctx.restore();
        }
    }

    /**
     * Draw notes from the slot grid with automatic ottava detection and bracketing
     */
    _drawNotes(ctx, clef) {
        // Collect ottava bracket info as we draw notes
        // Structure: { type: '8va'|'8vb', startX, endX, startSlot, endSlot }
        const ottavaBrackets = [];
        let currentBracket = null;

        // Collect beam groups and tuplet groups for later rendering
        // We need to track stem positions, so we'll do this in a separate pass
        const beamGroups = [];
        const tupletGroups = {};  // Keyed by tupletGroupId
        const notePositions = [];  // Store position info for each note

        for (let v = 0; v < this.slotGrid.voiceCount; v++) {
            // Reset bracket tracking for each voice
            currentBracket = null;

            for (let s = 0; s < this.slotGrid.totalSlots; s++) {
                const slot = this.slotGrid.getSlot(clef, v, s);
                // Position notes based on their beat position, not slot index
                // This gives better visual alignment since the visual grid uses VISUAL_SLOT_WIDTH
                const beatPosition = s / SLOTS_PER_BEAT;
                const visualSlotPosition = beatPosition * this.VISUAL_SLOTS_PER_BEAT;
                const x = this.START_X + (visualSlotPosition * this.VISUAL_SLOT_WIDTH) + (this.VISUAL_SLOT_WIDTH / 2);

                if (slot.type === SLOT_TYPES.NOTE_START) {
                    // For Voice 1, check if Voice 0 has identical pitches at same slot
                    if (v === 1) {
                        const v0Slot = this.slotGrid.getSlot(clef, 0, s);
                        if (v0Slot.type === SLOT_TYPES.NOTE_START) {
                            const v0Midi = (v0Slot.pitches || []).map(p => noteToMidi(p)).sort((a, b) => a - b).join(',');
                            const v1Midi = (slot.pitches || []).map(p => noteToMidi(p)).sort((a, b) => a - b).join(',');
                            if (v0Midi === v1Midi) {
                                continue;
                            }
                        }
                    }

                    // Determine ottava adjustment for this note (check all pitches)
                    const pitches = slot.pitches || [];
                    let noteOttavaType = null;
                    let noteOttavaShift = 0;

                    // Only check for ottava if note has pitches
                    if (pitches.length > 0) {
                        for (const pitch of pitches) {
                            const ottavaInfo = getOttavaAdjustment(pitch, clef);
                            if (ottavaInfo.needsOttava) {
                                // If any pitch in a chord needs ottava, apply to all
                                noteOttavaType = ottavaInfo.ottavaType;
                                noteOttavaShift = ottavaInfo.shift;
                                break;
                            }
                        }
                    }

                    // Track ottava brackets (only for voice 0 to avoid duplicate brackets)
                    if (v === 0) {
                        if (noteOttavaType) {
                            // Calculate the displayed Y position of this note (with ottava shift)
                            // Need to find the min (highest on screen) and max (lowest on screen) Y for bracket positioning
                            let noteMinY = Infinity;
                            let noteMaxY = -Infinity;
                            for (const pitch of pitches) {
                                const noteY = this._getYFromPitch(pitch, clef, noteOttavaShift);
                                noteMinY = Math.min(noteMinY, noteY);
                                noteMaxY = Math.max(noteMaxY, noteY);
                            }

                            if (!currentBracket || currentBracket.type !== noteOttavaType) {
                                // Close previous bracket if different type
                                if (currentBracket) {
                                    ottavaBrackets.push(currentBracket);
                                }
                                // Start new bracket - track min/max Y of notes for positioning
                                currentBracket = {
                                    type: noteOttavaType,
                                    startX: x,
                                    endX: x,
                                    startSlot: s,
                                    endSlot: s,
                                    minNoteY: noteMinY,  // Highest note (smallest Y)
                                    maxNoteY: noteMaxY   // Lowest note (largest Y)
                                };
                            } else {
                                // Extend current bracket and update min/max Y
                                currentBracket.endX = x;
                                currentBracket.endSlot = s;
                                currentBracket.minNoteY = Math.min(currentBracket.minNoteY, noteMinY);
                                currentBracket.maxNoteY = Math.max(currentBracket.maxNoteY, noteMaxY);
                            }
                        } else {
                            // No ottava needed - close any open bracket
                            if (currentBracket) {
                                ottavaBrackets.push(currentBracket);
                                currentBracket = null;
                            }
                        }
                    }

                    // Draw the note with ottava adjustment
                    this._drawNoteHead(ctx, x, slot, v, clef, s, noteOttavaShift);

                    // Collect position info for beams and tuplets
                    const notePitches = slot.pitches || [];
                    const noteDuration = slot.duration || '4n';
                    const isBeamable = ['8n', '16n', '32n', '64n'].includes(noteDuration);

                    if (notePitches.length > 0 && isBeamable) {
                        // Calculate stem info (same logic as _drawNoteHead)
                        const v0HasContent = this.slotGrid.voiceHasContent(clef, 0);
                        const v1HasContent = this.slotGrid.voiceHasContent(clef, 1);
                        const bothVoicesActive = v0HasContent && v1HasContent;

                        const primaryPitch = notePitches[0];
                        const y = this._getYFromPitch(primaryPitch, clef, noteOttavaShift);
                        const middleY = this.STAFF_TOP_Y + (this.STAFF_HEIGHT / 2);

                        let stemUp;
                        if (slot.stemDirection !== undefined) {
                            stemUp = slot.stemDirection > 0;
                        } else if (bothVoicesActive) {
                            stemUp = v === 0;
                        } else {
                            stemUp = y > middleY;
                        }

                        const stemX = stemUp ? x + 6 : x - 6;
                        const stemLength = 30;
                        const stemEndY = stemUp ? y - stemLength : y + stemLength;

                        const noteInfo = {
                            slotIndex: s,
                            voice: v,
                            x,
                            y,
                            stemX,
                            stemEndY,
                            stemUp,
                            duration: noteDuration,
                            beamLevels: this._getBeamLevelCount(noteDuration),
                            color: '#1e40af',  // Default blue
                            tupletGroupId: slot.tupletGroupId,
                            tupletType: slot.tupletType
                        };

                        notePositions.push(noteInfo);

                        // Track tuplet groups
                        if (slot.tupletGroupId) {
                            if (!tupletGroups[slot.tupletGroupId]) {
                                tupletGroups[slot.tupletGroupId] = {
                                    notes: [],
                                    tupletNumber: slot.tupletType === 'triplet' ? 3 :
                                                  slot.tupletType === 'quintuplet' ? 5 :
                                                  slot.tupletType === 'sextuplet' ? 6 : 3
                                };
                            }
                            tupletGroups[slot.tupletGroupId].notes.push(noteInfo);
                        }
                    }

                } else if (slot.type === SLOT_TYPES.REST) {
                    // Rests terminate any active ottava bracket
                    if (v === 0 && currentBracket) {
                        ottavaBrackets.push(currentBracket);
                        currentBracket = null;
                    }
                    this._drawRest(ctx, x, slot, v, clef, s);

                } else if (slot.type === SLOT_TYPES.CONTINUATION) {
                    // Continuation extends the previous note's ottava
                    this._drawContinuation(ctx, x);
                } else if (slot.type === SLOT_TYPES.EMPTY) {
                    // Empty slots terminate any active ottava bracket
                    if (v === 0 && currentBracket) {
                        ottavaBrackets.push(currentBracket);
                        currentBracket = null;
                    }
                }
            }

            // Close any remaining bracket at end of voice
            if (v === 0 && currentBracket) {
                ottavaBrackets.push(currentBracket);
                currentBracket = null;
            }
        }

        // Draw ottava brackets after all notes
        this._drawOttavaBrackets(ctx, clef, ottavaBrackets);

        // Process beam groups from notePositions
        // Group consecutive beamable notes (same voice, not in tuplets, no rests between)
        if (notePositions.length > 0) {
            // Separate notes by voice
            const notesByVoice = {};
            notePositions.forEach(n => {
                if (!notesByVoice[n.voice]) notesByVoice[n.voice] = [];
                notesByVoice[n.voice].push(n);
            });

            // For each voice, find consecutive beamable notes (excluding tuplet notes)
            for (const voice of Object.keys(notesByVoice)) {
                const voiceNotes = notesByVoice[voice].filter(n => !n.tupletGroupId);
                voiceNotes.sort((a, b) => a.slotIndex - b.slotIndex);

                let currentGroup = [];
                let lastSlotIndex = -2;

                for (const note of voiceNotes) {
                    // Check if this note is consecutive with previous
                    // (allowing for small gaps due to duration)
                    const isConsecutive = note.slotIndex <= lastSlotIndex + 8;  // Allow gap up to 1 beat

                    if (isConsecutive && currentGroup.length > 0) {
                        // Check stem direction consistency
                        if (note.stemUp === currentGroup[0].stemUp) {
                            currentGroup.push(note);
                        } else {
                            // Stem direction changed - end group and start new
                            if (currentGroup.length >= 2) {
                                beamGroups.push({
                                    notes: [...currentGroup],
                                    beamLevels: Math.min(...currentGroup.map(n => n.beamLevels))
                                });
                            }
                            currentGroup = [note];
                        }
                    } else {
                        // Gap found - end current group
                        if (currentGroup.length >= 2) {
                            beamGroups.push({
                                notes: [...currentGroup],
                                beamLevels: Math.min(...currentGroup.map(n => n.beamLevels))
                            });
                        }
                        currentGroup = [note];
                    }

                    lastSlotIndex = note.slotIndex + (note.beamLevels > 1 ? 2 : 4);  // Approximate note duration
                }

                // Don't forget last group
                if (currentGroup.length >= 2) {
                    beamGroups.push({
                        notes: [...currentGroup],
                        beamLevels: Math.min(...currentGroup.map(n => n.beamLevels))
                    });
                }
            }

            // Draw beams (drawn OVER note heads, so flags are hidden)
            this._drawBeams(ctx, clef, beamGroups);

            // Draw tuplet brackets (includes beams for tuplet notes)
            const tupletGroupArray = Object.values(tupletGroups).filter(g => g.notes.length >= 2);

            // Also create beam groups for tuplet notes
            for (const tg of tupletGroupArray) {
                // Sort notes by slot index
                tg.notes.sort((a, b) => a.slotIndex - b.slotIndex);

                // Create beam group for tuplet
                if (tg.notes.length >= 2) {
                    beamGroups.push({
                        notes: [...tg.notes],
                        beamLevels: Math.min(...tg.notes.map(n => n.beamLevels))
                    });
                }
            }

            // Re-draw beams to include tuplet beams
            // Clear the beam area first would require more complex logic
            // For now, tuplet beams are drawn on top
            this._drawBeams(ctx, clef, tupletGroupArray.map(tg => ({
                notes: tg.notes,
                beamLevels: Math.min(...tg.notes.map(n => n.beamLevels))
            })));

            // Draw tuplet brackets
            this._drawTupletBrackets(ctx, clef, tupletGroupArray);
        }
    }

    /**
     * Draw a note head at position with proper duration representation
     * @param {number} ottavaShift - Octave shift for display (from automatic ottava detection)
     */
    _drawNoteHead(ctx, x, slot, voiceIndex, clef, slotIndex, ottavaShift = 0) {
        const pitches = slot.pitches || [];
        const duration = slot.duration || '4n';
        const isDotted = slot.dotted || false;

        // Determine note characteristics based on duration
        const isWhole = duration === '1n';
        const isHalf = duration === '2n';
        const isFilled = !isWhole && !isHalf;  // Quarter and shorter are filled
        const hasStem = !isWhole;  // All except whole notes have stems
        const flagCount = this._getFlagCount(duration);

        // Default voice colors (used for bass and when harmonic coloring not available)
        const defaultColor = voiceIndex === 0 ? '#1e40af' : '#7c3aed';

        // Check if this slot is selected (check both legacy selectedNote and multi-selection Set)
        const legacySlotSelected = this.selectedNote &&
            this.selectedNote.clef === clef &&
            this.selectedNote.voice === voiceIndex &&
            this.selectedNote.slotIndex === slotIndex;

        for (const pitch of pitches) {
            // Apply ottava shift for display position
            const y = this._getYFromPitch(pitch, clef, ottavaShift);

            // Check if this specific pitch is selected (for chords)
            // Check both legacy selection and multi-selection Set
            const noteIdWithPitch = this._makeNoteId(clef, voiceIndex, slotIndex, pitch);
            const noteIdWithoutPitch = this._makeNoteId(clef, voiceIndex, slotIndex, null);
            const isInMultiSelection = this.selectedNotes.has(noteIdWithPitch) || this.selectedNotes.has(noteIdWithoutPitch);
            const isPitchSelected = isInMultiSelection || (legacySlotSelected &&
                (!this.selectedNote.pitch || this.selectedNote.pitch === pitch));

            // Draw selection ring first (behind note) - only for selected pitch
            if (isPitchSelected) {
                ctx.save();
                ctx.strokeStyle = '#3b82f6';  // Blue selection ring
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(x, y, 14, 0, Math.PI * 2);
                ctx.stroke();
                // Optional: light blue fill behind note
                ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
                ctx.fill();
                ctx.restore();
            }

            // Draw ledger lines first (behind note)
            this._drawLedgerLines(ctx, x, y);

            // Draw accidental (before note head) - only if not covered by key signature
            const displayAccidental = this._getDisplayAccidental(pitch);
            if (displayAccidental) {
                ctx.fillStyle = '#374151';
                ctx.font = '14px Arial';
                let symbol = '';
                if (displayAccidental === '#') symbol = '♯';
                else if (displayAccidental === 'b') symbol = '♭';
                else if (displayAccidental === 'n') symbol = '♮';
                if (symbol) {
                    ctx.fillText(symbol, x - 18, y + 4);
                }
            }

            // Check if this note is currently playing
            const noteKey = `${clef}-${voiceIndex}-${slotIndex}`;
            const isPlaying = this._playingNotes?.has(noteKey);

            // Determine color - red if playing, otherwise harmonic coloring for treble, default for bass
            let color, strokeColor;
            if (isPlaying) {
                color = '#dc2626';      // Red-600 for playing notes
                strokeColor = '#dc2626';
            } else {
                const harmonicColors = this._getHarmonicColor(pitch, clef);
                color = harmonicColors ? harmonicColors.fill : defaultColor;
                strokeColor = harmonicColors ? harmonicColors.stroke : defaultColor;
            }

            // Draw note head
            ctx.save();
            if (isWhole) {
                // Whole note: wider, unfilled oval (single ellipse, no inner shape)
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.ellipse(x, y, 9, 6, 0, 0, Math.PI * 2);
                ctx.stroke();
            } else if (isHalf) {
                // Half note: unfilled oval with stem
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(x, y, 7, 5, -0.3, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                // Quarter and shorter: filled oval
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.ellipse(x, y, 7, 5, -0.3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            // Draw stem (for all except whole notes)
            if (hasStem) {
                // Only force stem direction when BOTH voices are active in this clef
                // If only one voice is in use, use natural stem direction based on pitch
                const v0HasContent = this.slotGrid.voiceHasContent(clef, 0);
                const v1HasContent = this.slotGrid.voiceHasContent(clef, 1);
                const bothVoicesActive = v0HasContent && v1HasContent;

                const explicitStemDir = slot.stemDirection;
                let stemUp;
                if (explicitStemDir !== undefined) {
                    // Explicit stem direction from slot data (set during placement)
                    stemUp = explicitStemDir > 0;
                } else if (bothVoicesActive) {
                    // Both voices active: V1 stems up, V2 stems down
                    stemUp = voiceIndex === 0;
                } else {
                    // Single voice mode: natural stem direction based on pitch position
                    // Stems go up if note is below middle of staff, down if above
                    const middleY = this.STAFF_TOP_Y + (this.STAFF_HEIGHT / 2);
                    stemUp = y > middleY;
                }
                const stemX = stemUp ? x + 6 : x - 6;
                const stemLength = 30;
                const stemEndY = stemUp ? y - stemLength : y + stemLength;

                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(stemX, y);
                ctx.lineTo(stemX, stemEndY);
                ctx.stroke();

                // Draw flags for 8th notes and shorter
                if (flagCount > 0) {
                    this._drawFlags(ctx, stemX, stemEndY, stemUp, flagCount, color);
                }
            }

            // Draw dot if dotted
            if (isDotted) {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x + 12, y, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw musical context hint for notes with tendency tones
            // Only show if hints are enabled via toggle
            // Show important hints (leading tone, tritone) on ALL notes
            // Show NCT hints only when selected (to avoid clutter)
            if (this.showMusicalHints) {
                const hint = this._getMusicalContextHint(pitch, clef);
                if (hint) {
                    const isImportantHint = hint.type === 'leading_tone' || hint.type === 'tritone' || hint.type === 'fourth_degree';
                    if (isImportantHint || isPitchSelected) {
                        // Determine stem direction for hint placement
                        const middleY = this.STAFF_TOP_Y + (this.STAFF_HEIGHT / 2);
                        const stemUp = slot.stemDirection !== undefined ? slot.stemDirection > 0 : y > middleY;
                        this._drawMusicalContextHint(ctx, x, y, hint, stemUp);
                    }
                }
            }
        }
    }

    /**
     * Get number of flags based on duration
     */
    _getFlagCount(duration) {
        switch (duration) {
            case '8n': return 1;
            case '16n': return 2;
            case '32n': return 3;
            case '64n': return 4;
            default: return 0;
        }
    }

    /**
     * Get musical context hint for a pitch (leading tone, chord tone, etc.)
     * Shows helpful annotations for composers
     * @param {string} pitch - The pitch (e.g., "B4")
     * @param {string} clef - 'treble' or 'bass'
     * @returns {object|null} Hint object with text, color, and suggestion
     */
    _getMusicalContextHint(pitch, clef) {
        if (!this.currentKey || !this.measureChord) return null;

        const pitchMidi = noteToMidi(pitch);
        if (pitchMidi === null) return null;

        const pitchClass = pitchMidi % 12;
        const keyRoot = this.currentKey.replace(/m$/, ''); // Remove minor suffix if present
        const isMinorKey = this.currentKey.endsWith('m');
        const keyMidi = noteToMidi(keyRoot + '4');
        if (keyMidi === null) return null;
        const keyPitchClass = keyMidi % 12;

        // Calculate scale degree (in semitones from tonic)
        const scaleDegree = ((pitchClass - keyPitchClass + 12) % 12);

        // Note names for resolution targets
        const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const tonicName = NOTE_NAMES[keyPitchClass];

        // Get chord information
        const chordTones = getChordTones(this.measureChord);
        const pitchName = pitch.replace(/\d+$/, ''); // Remove octave
        const ENHARMONIC = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
                            'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };
        const pitchNorm = ENHARMONIC[pitchName] || pitchName;
        const isChordTone = chordTones.some(ct => {
            const ctNorm = ENHARMONIC[ct] || ct;
            return ctNorm === pitchNorm || ct === pitchName;
        });

        // Determine chord tone function (root, 3rd, 5th, 7th)
        let chordToneFunction = null;
        if (isChordTone && chordTones.length > 0) {
            const chordRoot = this.measureChord.root;
            const chordRootNorm = ENHARMONIC[chordRoot] || chordRoot;

            // Check if this is the root
            if (pitchNorm === chordRootNorm || pitchName === chordRoot) {
                chordToneFunction = 'root';
            } else if (chordTones.length >= 2) {
                const thirdTone = chordTones[1];
                const thirdNorm = ENHARMONIC[thirdTone] || thirdTone;
                if (pitchNorm === thirdNorm || pitchName === thirdTone) {
                    chordToneFunction = 'third';
                }
            }
            if (!chordToneFunction && chordTones.length >= 3) {
                const fifthTone = chordTones[2];
                const fifthNorm = ENHARMONIC[fifthTone] || fifthTone;
                if (pitchNorm === fifthNorm || pitchName === fifthTone) {
                    chordToneFunction = 'fifth';
                }
            }
            if (!chordToneFunction && chordTones.length >= 4) {
                const seventhTone = chordTones[3];
                const seventhNorm = ENHARMONIC[seventhTone] || seventhTone;
                if (pitchNorm === seventhNorm || pitchName === seventhTone) {
                    chordToneFunction = 'seventh';
                }
            }
        }

        // Check for tendency tones - priority order matters!
        const hints = [];

        // 1. Leading tone (scale degree 7 = 11 semitones above tonic) - HIGHEST PRIORITY
        if (scaleDegree === 11) {
            hints.push({
                text: `→ ${tonicName}`,
                fullText: `Leading tone: resolves up to ${tonicName}`,
                color: '#dc2626', // Red
                type: 'leading_tone',
                direction: 'up',
                priority: 1
            });
        }

        // 2. Chord 7th - resolves down (very important for voice leading)
        if (chordToneFunction === 'seventh') {
            // 7th typically resolves down by step
            const resolveTarget = NOTE_NAMES[(pitchClass - 1 + 12) % 12];
            hints.push({
                text: `7↓`,
                fullText: `Chord 7th: typically resolves down to ${resolveTarget}`,
                color: '#7c3aed', // Purple
                type: 'chord_seventh',
                direction: 'down',
                priority: 2
            });
        }

        // 3. Tritone (6 semitones from tonic) - unstable, wants resolution
        if (scaleDegree === 6) {
            hints.push({
                text: '⟷',
                fullText: 'Tritone: unstable, resolve inward or outward',
                color: '#ef4444', // Red
                type: 'tritone',
                direction: 'resolve',
                priority: 3
            });
        }

        // 4. Scale degree 4 (5 semitones above tonic) - tendency to resolve down to 3
        if (scaleDegree === 5) {
            const thirdName = NOTE_NAMES[(keyPitchClass + 4) % 12];
            hints.push({
                text: `↓ ${thirdName}`,
                fullText: `Scale degree 4: often resolves down to ${thirdName}`,
                color: '#f59e0b', // Amber
                type: 'fourth_degree',
                direction: 'down',
                priority: 4
            });
        }

        // 5. Raised 6th in minor (melodic minor ascending)
        if (isMinorKey && scaleDegree === 9) {
            // Raised 6th in minor typically continues up to raised 7th
            const raisedSeventh = NOTE_NAMES[(keyPitchClass + 11) % 12];
            hints.push({
                text: `↑ ${raisedSeventh}`,
                fullText: `Raised 6th: continue up to ${raisedSeventh} (melodic minor)`,
                color: '#0891b2', // Cyan
                type: 'raised_sixth',
                direction: 'up',
                priority: 5
            });
        }

        // 6. Lowered 7th in minor (natural minor / descending melodic)
        if (isMinorKey && scaleDegree === 10) {
            const sixthDegree = NOTE_NAMES[(keyPitchClass + 8) % 12];
            hints.push({
                text: `↓ ${sixthDegree}`,
                fullText: `Subtonic: descend to ${sixthDegree} (natural minor)`,
                color: '#0891b2', // Cyan
                type: 'subtonic',
                direction: 'down',
                priority: 5
            });
        }

        // 7. Chromatic approach note (half step to chord tone)
        if (!isChordTone) {
            // Check if this note is a half step away from a chord tone
            for (const ct of chordTones) {
                const ctMidi = noteToMidi(ct + '4');
                if (ctMidi !== null) {
                    const ctPitchClass = ctMidi % 12;
                    const distance = Math.abs(pitchClass - ctPitchClass);
                    if (distance === 1 || distance === 11) {
                        const direction = ((ctPitchClass - pitchClass + 12) % 12) === 1 ? '↑' : '↓';
                        hints.push({
                            text: `${direction} ${ct}`,
                            fullText: `Chromatic approach: resolve to ${ct}`,
                            color: '#059669', // Emerald
                            type: 'chromatic_approach',
                            direction: direction === '↑' ? 'up' : 'down',
                            priority: 6
                        });
                        break;
                    }
                }
            }
        }

        // 8. Suspension indicator (4-3, 7-6, 9-8 patterns)
        if (!isChordTone && chordTones.length >= 2) {
            const thirdTone = chordTones[1];
            const thirdMidi = noteToMidi(thirdTone + '4');
            if (thirdMidi !== null) {
                const thirdPitchClass = thirdMidi % 12;
                // Sus4 (one step above the 3rd)
                if (((pitchClass - thirdPitchClass + 12) % 12) === 1) {
                    hints.push({
                        text: `4→3`,
                        fullText: `Suspension: resolve 4 down to 3 (${thirdTone})`,
                        color: '#d97706', // Amber-600
                        type: 'suspension_4_3',
                        direction: 'down',
                        priority: 7
                    });
                }
            }
        }

        // 9. Chord 5th indicator (can often be omitted)
        if (chordToneFunction === 'fifth' && hints.length === 0) {
            hints.push({
                text: '5th',
                fullText: 'Chord 5th: stable, but can be omitted if needed',
                color: '#64748b', // Slate
                type: 'chord_fifth',
                direction: null,
                priority: 10
            });
        }

        // 10. Chord 3rd indicator (defines quality - important!)
        if (chordToneFunction === 'third' && hints.length === 0) {
            hints.push({
                text: '3rd',
                fullText: 'Chord 3rd: defines major/minor quality (important!)',
                color: '#2563eb', // Blue
                type: 'chord_third',
                direction: null,
                priority: 10
            });
        }

        // 11. Root indicator
        if (chordToneFunction === 'root' && hints.length === 0) {
            hints.push({
                text: 'R',
                fullText: 'Chord root: foundational tone',
                color: '#16a34a', // Green
                type: 'chord_root',
                direction: null,
                priority: 10
            });
        }

        // 12. Blue note detection (♭3, ♭5, ♭7 for blues/jazz feel)
        // Only show if not already a chord tone and not already hinted
        if (!isChordTone && hints.length === 0) {
            // ♭3 (3 semitones), ♭5 (6 semitones - also tritone), ♭7 (10 semitones)
            if (scaleDegree === 3) {
                hints.push({
                    text: '♭3',
                    fullText: 'Blue note (♭3): adds blues/jazz color',
                    color: '#7c3aed', // Purple
                    type: 'blue_note',
                    direction: null,
                    priority: 8
                });
            } else if (scaleDegree === 10 && !isMinorKey) {
                hints.push({
                    text: '♭7',
                    fullText: 'Blue note (♭7): adds blues/dominant color',
                    color: '#7c3aed', // Purple
                    type: 'blue_note',
                    direction: null,
                    priority: 8
                });
            }
        }

        // 13. Non-chord tone (lowest priority, only if nothing else)
        if (!isChordTone && hints.length === 0) {
            hints.push({
                text: 'NCT',
                fullText: 'Non-chord tone: consider resolving to chord tone',
                color: '#6b7280', // Gray
                type: 'non_chord_tone',
                direction: null,
                priority: 20
            });
        }

        // Sort by priority and return the highest priority hint
        hints.sort((a, b) => (a.priority || 99) - (b.priority || 99));
        return hints.length > 0 ? hints[0] : null;
    }

    /**
     * Draw musical context hint annotation near a note
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} x - X position
     * @param {number} y - Y position of note
     * @param {object} hint - Hint object from _getMusicalContextHint
     * @param {boolean} stemUp - Whether stem goes up (affects hint placement)
     */
    _drawMusicalContextHint(ctx, x, y, hint, stemUp) {
        if (!hint) return;

        ctx.save();

        // Position hint above or below note based on stem direction
        const hintY = stemUp ? y + 25 : y - 20;

        // Draw background pill
        ctx.font = 'bold 9px Arial';
        const textWidth = ctx.measureText(hint.text).width;
        const pillPadding = 3;
        const pillWidth = textWidth + pillPadding * 2;
        const pillHeight = 14;

        // Background
        ctx.fillStyle = hint.color + '20'; // 20% opacity
        ctx.strokeStyle = hint.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x - pillWidth / 2, hintY - pillHeight / 2, pillWidth, pillHeight, 3);
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.fillStyle = hint.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(hint.text, x, hintY);

        ctx.restore();
    }

    /**
     * Analyze the melodic contour of existing notes in the focused clef
     * Returns contour info and suggests continuation patterns
     * @returns {object} Analysis with contour direction, intervals, and suggestions
     */
    _analyzeMelodicContour() {
        // Collect all notes from the focused clef
        const notes = [];

        for (let s = 0; s < this.slotGrid.totalSlots; s++) {
            const slot = this.slotGrid.getSlot(this.focusedClef, 0, s); // Voice 0
            if (slot && slot.type === SLOT_TYPES.NOTE_START && slot.pitches && slot.pitches.length > 0) {
                const midi = noteToMidi(slot.pitches[0]); // Use top pitch
                if (midi !== null) {
                    notes.push({ slotIndex: s, midi, pitch: slot.pitches[0] });
                }
            }
        }

        if (notes.length < 2) {
            return { hasContour: false, notes, suggestions: [] };
        }

        // Calculate intervals between consecutive notes
        const intervals = [];
        for (let i = 1; i < notes.length; i++) {
            const interval = notes[i].midi - notes[i - 1].midi;
            intervals.push(interval);
        }

        // Analyze contour characteristics
        const lastInterval = intervals[intervals.length - 1];
        const lastNote = notes[notes.length - 1];

        // Determine overall contour direction
        let ascendingCount = 0, descendingCount = 0, staticCount = 0;
        intervals.forEach(i => {
            if (i > 0) ascendingCount++;
            else if (i < 0) descendingCount++;
            else staticCount++;
        });

        let overallDirection = 'mixed';
        if (ascendingCount > descendingCount + staticCount) overallDirection = 'ascending';
        else if (descendingCount > ascendingCount + staticCount) overallDirection = 'descending';

        // Generate suggestions based on contour rules
        const suggestions = [];
        const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Rule 1: After a large leap (> 4 semitones), suggest stepwise motion in opposite direction
        if (Math.abs(lastInterval) > 4) {
            const recoveryDirection = lastInterval > 0 ? -1 : 1; // Opposite direction
            const recoveryMidi = lastNote.midi + recoveryDirection * 2; // Step
            const recoveryPitch = this._midiToPitch(recoveryMidi);
            const recoveryNoteName = recoveryPitch.replace(/\d+$/, '');
            suggestions.push({
                pattern: 'leap_recovery',
                description: `Step back → ${recoveryNoteName}`,
                pitches: [recoveryPitch],
                emoji: lastInterval > 0 ? '↘' : '↗',
                color: '#10b981' // Green
            });
        }

        // Rule 2: Suggest continuing stepwise in same direction
        if (Math.abs(lastInterval) <= 2 && lastInterval !== 0) {
            const continueMidi = lastNote.midi + (lastInterval > 0 ? 2 : -2);
            const continuePitch = this._midiToPitch(continueMidi);
            const continueNoteName = continuePitch.replace(/\d+$/, '');
            suggestions.push({
                pattern: 'continue_step',
                description: `Continue ${lastInterval > 0 ? 'up' : 'down'} → ${continueNoteName}`,
                pitches: [continuePitch],
                emoji: lastInterval > 0 ? '↑' : '↓',
                color: '#3b82f6' // Blue
            });
        }

        // Rule 3: Suggest chord tone resolution
        if (this.measureChord) {
            const chordTones = getChordTones(this.measureChord);
            const lastPitchName = lastNote.pitch.replace(/\d+$/, '');
            // Must compare full pitch names including accidentals (C# != C)
            const ENHARMONIC = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
            const lastPitchNorm = ENHARMONIC[lastPitchName] || lastPitchName;
            const isOnChordTone = chordTones.some(ct => (ENHARMONIC[ct] || ct) === lastPitchNorm);

            if (!isOnChordTone) {
                // Find nearest chord tone
                const octave = parseInt(lastNote.pitch.match(/\d+$/)?.[0] || '4');
                for (const ct of chordTones) {
                    const ctMidi = noteToMidi(ct + octave);
                    if (ctMidi && Math.abs(ctMidi - lastNote.midi) <= 4) {
                        const direction = ctMidi > lastNote.midi ? '↑' : '↓';
                        suggestions.push({
                            pattern: 'chord_tone',
                            description: `To chord tone ${ct}`,
                            pitches: [ct + octave],
                            emoji: '♪',
                            color: '#8b5cf6' // Purple
                        });
                        break;
                    }
                }
            }
        }

        // Rule 4: Suggest returning to tonic for phrase endings
        if (this.currentKey && notes.length >= 4) {
            const keyRoot = this.currentKey.replace(/m$/, '');
            const octave = parseInt(lastNote.pitch.match(/\d+$/)?.[0] || '4');
            const tonicPitch = keyRoot + octave;
            const tonicMidi = noteToMidi(tonicPitch);

            if (tonicMidi && Math.abs(tonicMidi - lastNote.midi) <= 7 && tonicMidi !== lastNote.midi) {
                suggestions.push({
                    pattern: 'tonic_return',
                    description: `Return to ${keyRoot}`,
                    pitches: [tonicPitch],
                    emoji: '🏠',
                    color: '#f59e0b' // Amber
                });
            }
        }

        return {
            hasContour: true,
            notes,
            intervals,
            lastInterval,
            overallDirection,
            suggestions: suggestions.slice(0, 4) // Max 4 suggestions
        };
    }

    /**
     * Render melodic pattern suggestions in the UI
     */
    _renderMelodicPatterns() {
        const container = this.modal.querySelector('#mie-melodic-patterns');
        const indicator = this.modal.querySelector('#mie-contour-indicator');
        if (!container) return;

        const analysis = this._analyzeMelodicContour();

        // Update contour indicator
        if (indicator) {
            if (analysis.hasContour) {
                const dirIcon = analysis.overallDirection === 'ascending' ? '📈' :
                               analysis.overallDirection === 'descending' ? '📉' : '〰️';
                indicator.textContent = `${dirIcon} ${analysis.notes.length} notes`;
            } else {
                indicator.textContent = analysis.notes.length > 0 ? '(add more notes)' : '(no notes yet)';
            }
        }

        if (!analysis.hasContour || analysis.suggestions.length === 0) {
            container.innerHTML = '<span class="text-xs text-gray-400 italic">Add 2+ notes to see pattern suggestions</span>';
            return;
        }

        // Render suggestion buttons
        container.innerHTML = analysis.suggestions.map((suggestion, index) => `
            <button class="mie-melodic-pattern-btn px-2 py-1 text-xs font-medium border rounded transition-colors hover:opacity-80"
                    style="background-color: ${suggestion.color}15; border-color: ${suggestion.color}; color: ${suggestion.color};"
                    data-pitches="${suggestion.pitches.join(',')}" data-index="${index}"
                    title="${suggestion.description}">
                ${suggestion.emoji} ${suggestion.description}
            </button>
        `).join('');

        // Attach click handlers
        container.querySelectorAll('.mie-melodic-pattern-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const pitches = btn.dataset.pitches.split(',');
                this._applyMelodicPattern(pitches);
            });
        });
    }

    /**
     * Apply a melodic pattern suggestion (place the suggested note)
     * @param {string[]} pitches - Array of pitches to place
     */
    _applyMelodicPattern(pitches) {
        if (!pitches || pitches.length === 0) return;

        // Find next available slot
        const nextSlot = this._findNextAvailableSlot();
        if (nextSlot === null) {
            showToast('No available slot for pattern', 'warning');
            return;
        }

        // Place the first pitch (for now, just single note patterns)
        const pitch = pitches[0];
        this._placeNote(this.focusedClef, nextSlot, pitch, 0);
        this._renderStaves();
        this._updateFillStats();

        // Play the note for feedback
        this._playNotePreview(pitch);

        // Update the melodic patterns display
        this._renderMelodicPatterns();
    }

    /**
     * Draw flags on a note stem
     */
    _drawFlags(ctx, stemX, stemEndY, stemUp, count, color) {
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;

        const flagLength = 12;
        const flagSpacing = 6;
        const direction = stemUp ? 1 : -1;

        for (let i = 0; i < count; i++) {
            const flagY = stemEndY + (i * flagSpacing * direction);

            ctx.beginPath();
            ctx.moveTo(stemX, flagY);

            // Curved flag
            if (stemUp) {
                ctx.quadraticCurveTo(
                    stemX + flagLength * 0.8, flagY + 4,
                    stemX + flagLength, flagY + 10
                );
                ctx.lineTo(stemX + flagLength - 2, flagY + 8);
                ctx.quadraticCurveTo(
                    stemX + flagLength * 0.6, flagY + 2,
                    stemX, flagY + 4
                );
            } else {
                ctx.quadraticCurveTo(
                    stemX - flagLength * 0.8, flagY - 4,
                    stemX - flagLength, flagY - 10
                );
                ctx.lineTo(stemX - flagLength + 2, flagY - 8);
                ctx.quadraticCurveTo(
                    stemX - flagLength * 0.6, flagY - 2,
                    stemX, flagY - 4
                );
            }

            ctx.fill();
        }
    }

    /**
     * Draw beams connecting consecutive beamable notes
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} clef - 'treble' or 'bass'
     * @param {Array} beamGroups - Array of beam group objects with note info
     */
    _drawBeams(ctx, clef, beamGroups) {
        if (!beamGroups || beamGroups.length === 0) return;

        const BEAM_THICKNESS = 4;
        const BEAM_SPACING = 6;  // Space between primary and secondary beams

        for (const group of beamGroups) {
            if (!group.notes || group.notes.length < 2) continue;

            const notes = group.notes;
            const firstNote = notes[0];
            const lastNote = notes[notes.length - 1];

            // All notes in a beam group should have same stem direction
            const stemUp = firstNote.stemUp;
            const color = firstNote.color || '#1e40af';

            ctx.fillStyle = color;
            ctx.strokeStyle = color;

            // Calculate beam Y position (at the stem ends)
            // Use linear interpolation between first and last stem ends
            const startStemEndY = firstNote.stemEndY;
            const endStemEndY = lastNote.stemEndY;

            // Draw primary beam (connects all notes)
            ctx.beginPath();
            ctx.moveTo(firstNote.stemX, startStemEndY);
            ctx.lineTo(lastNote.stemX, endStemEndY);
            ctx.lineTo(lastNote.stemX, endStemEndY + (stemUp ? BEAM_THICKNESS : -BEAM_THICKNESS));
            ctx.lineTo(firstNote.stemX, startStemEndY + (stemUp ? BEAM_THICKNESS : -BEAM_THICKNESS));
            ctx.closePath();
            ctx.fill();

            // Draw secondary beams for 16th notes and shorter
            const beamLevels = group.beamLevels || 1;
            for (let level = 1; level < beamLevels; level++) {
                const beamOffset = (BEAM_THICKNESS + BEAM_SPACING) * level * (stemUp ? 1 : -1);

                // For secondary beams, we need to check which notes have this beam level
                // For simplicity, draw full secondary beam if all notes are 16th or shorter
                ctx.beginPath();
                ctx.moveTo(firstNote.stemX, startStemEndY + beamOffset);
                ctx.lineTo(lastNote.stemX, endStemEndY + beamOffset);
                ctx.lineTo(lastNote.stemX, endStemEndY + beamOffset + (stemUp ? BEAM_THICKNESS : -BEAM_THICKNESS));
                ctx.lineTo(firstNote.stemX, startStemEndY + beamOffset + (stemUp ? BEAM_THICKNESS : -BEAM_THICKNESS));
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    /**
     * Draw tuplet brackets with numbers and duration span
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} clef - 'treble' or 'bass'
     * @param {Array} tupletGroups - Array of tuplet group objects
     */
    _drawTupletBrackets(ctx, clef, tupletGroups) {
        if (!tupletGroups || tupletGroups.length === 0) return;

        const BRACKET_OFFSET = 25;  // Distance from stem end to bracket
        const BRACKET_HEIGHT = 8;   // Height of bracket hooks

        // Tuplet ratios for duration span display
        const TUPLET_RATIOS = {
            3: { actual: 3, normal: 2, name: 'triplet' },      // 3 notes in time of 2
            5: { actual: 5, normal: 4, name: 'quintuplet' },   // 5 notes in time of 4
            6: { actual: 6, normal: 4, name: 'sextuplet' },    // 6 notes in time of 4
        };

        for (const group of tupletGroups) {
            if (!group.notes || group.notes.length < 2) continue;

            const notes = group.notes;
            const firstNote = notes[0];
            const lastNote = notes[notes.length - 1];
            const tupletNumber = group.tupletNumber || 3;
            const ratio = TUPLET_RATIOS[tupletNumber] || { actual: tupletNumber, normal: 2 };

            // Determine bracket position (above or below based on stem direction)
            const stemUp = firstNote.stemUp;
            const bracketAbove = stemUp;  // Bracket goes opposite of stem direction... actually same direction for tuplets

            // Find the extreme Y positions for bracket placement
            let bracketY;
            if (bracketAbove) {
                // Find the minimum (highest) stem end Y and go above it
                const minY = Math.min(...notes.map(n => n.stemEndY));
                bracketY = minY - BRACKET_OFFSET;
            } else {
                // Find the maximum (lowest) stem end Y and go below it
                const maxY = Math.max(...notes.map(n => n.stemEndY));
                bracketY = maxY + BRACKET_OFFSET;
            }

            const startX = firstNote.stemX;
            const endX = lastNote.stemX;
            const midX = (startX + endX) / 2;

            // Use a distinct tuplet color for visibility
            ctx.strokeStyle = '#7c3aed';  // Purple for tuplet bracket
            ctx.fillStyle = '#7c3aed';
            ctx.lineWidth = 2;

            // Draw bracket hooks
            const hookDir = bracketAbove ? 1 : -1;

            // Left hook
            ctx.beginPath();
            ctx.moveTo(startX, bracketY + BRACKET_HEIGHT * hookDir);
            ctx.lineTo(startX, bracketY);
            ctx.stroke();

            // Right hook
            ctx.beginPath();
            ctx.moveTo(endX, bracketY + BRACKET_HEIGHT * hookDir);
            ctx.lineTo(endX, bracketY);
            ctx.stroke();

            // Horizontal lines (with gap for number and ratio)
            const numberWidth = 30;  // Wider gap for "3:2" style notation
            const gapStart = midX - numberWidth / 2;
            const gapEnd = midX + numberWidth / 2;

            // Left horizontal
            if (gapStart > startX + 5) {
                ctx.beginPath();
                ctx.moveTo(startX, bracketY);
                ctx.lineTo(gapStart, bracketY);
                ctx.stroke();
            }

            // Right horizontal
            if (gapEnd < endX - 5) {
                ctx.beginPath();
                ctx.moveTo(gapEnd, bracketY);
                ctx.lineTo(endX, bracketY);
                ctx.stroke();
            }

            // Draw tuplet ratio (e.g., "3:2" for triplet)
            ctx.font = 'bold 11px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const ratioText = `${ratio.actual}:${ratio.normal}`;
            ctx.fillText(ratioText, midX, bracketY);

            // Draw duration span indicator below the bracket
            // Calculate total beats this tuplet spans
            const noteBaseDuration = firstNote.duration || '8n';
            const singleNoteDuration = {
                '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125
            }[noteBaseDuration] || 0.5;
            const totalSpanBeats = singleNoteDuration * ratio.normal;  // e.g., triplet 8ths = 0.5 * 2 = 1 beat

            // Show span text (e.g., "= 2 beats" or "= 1 beat")
            ctx.font = 'italic 9px Arial';
            ctx.fillStyle = '#7c3aed';
            const spanText = totalSpanBeats === 1 ? '= 1 beat' : `= ${totalSpanBeats} beats`;
            const spanTextY = bracketAbove ? bracketY - 12 : bracketY + 12;
            ctx.fillText(spanText, midX, spanTextY);

            // Draw visual grouping indicator on each note in the tuplet
            // Small purple dots or markers to show these notes are grouped
            ctx.fillStyle = '#7c3aed';
            for (const note of notes) {
                // Draw a small marker above/below each note head
                const markerY = bracketAbove ? note.y - 20 : note.y + 20;
                ctx.beginPath();
                ctx.arc(note.x, markerY, 3, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw a subtle background highlight for the tuplet span in the slot grid area
            // This helps visualize which slots the tuplet occupies
            if (this.VISUAL_SLOT_WIDTH) {
                const firstSlot = firstNote.slotIndex;
                const lastSlot = lastNote.slotIndex;

                // Convert to visual X positions - calculate actual tuplet span
                const spanStartBeat = firstSlot / SLOTS_PER_BEAT;
                // Calculate end based on actual tuplet duration, not arbitrary +16
                const lastNoteDurationSlots = Math.round(singleNoteDuration * SLOTS_PER_BEAT * (ratio.normal / ratio.actual));
                const spanEndBeat = (lastSlot + lastNoteDurationSlots) / SLOTS_PER_BEAT;
                const spanStartX = this.START_X + (spanStartBeat * this.VISUAL_SLOTS_PER_BEAT * this.VISUAL_SLOT_WIDTH);
                const spanEndX = this.START_X + (spanEndBeat * this.VISUAL_SLOTS_PER_BEAT * this.VISUAL_SLOT_WIDTH);

                // Draw subtle highlight under the tuplet span
                ctx.fillStyle = 'rgba(124, 58, 237, 0.08)';  // Very light purple
                const highlightTop = this.STAFF_TOP_Y - 10;
                const highlightHeight = this.STAFF_HEIGHT + 20;
                ctx.fillRect(spanStartX, highlightTop, spanEndX - spanStartX, highlightHeight);
            }
        }
    }

    /**
     * Get beam level count based on duration (1 for 8th, 2 for 16th, etc.)
     */
    _getBeamLevelCount(duration) {
        switch (duration) {
            case '8n': return 1;
            case '16n': return 2;
            case '32n': return 3;
            case '64n': return 4;
            default: return 0;
        }
    }

    /**
     * Draw ledger lines for notes outside staff
     */
    _drawLedgerLines(ctx, x, y) {
        const staffTop = this.STAFF_TOP_Y;
        const staffBottom = this.STAFF_TOP_Y + this.STAFF_HEIGHT;

        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1;

        // Above staff (ledger lines every LINE_SPACING above top line)
        for (let ly = staffTop - this.LINE_SPACING; ly >= y - 3; ly -= this.LINE_SPACING) {
            ctx.beginPath();
            ctx.moveTo(x - 12, ly);
            ctx.lineTo(x + 12, ly);
            ctx.stroke();
        }

        // Below staff (ledger lines every LINE_SPACING below bottom line)
        for (let ly = staffBottom + this.LINE_SPACING; ly <= y + 3; ly += this.LINE_SPACING) {
            ctx.beginPath();
            ctx.moveTo(x - 12, ly);
            ctx.lineTo(x + 12, ly);
            ctx.stroke();
        }
    }

    /**
     * Draw a rest symbol
     */
    _drawRest(ctx, x, slot, voiceIndex, clef, slotIndex) {
        const y = this.STAFF_TOP_Y + 22;

        // Check if this rest is selected
        const isSelected = this.selectedNote &&
            this.selectedNote.clef === clef &&
            this.selectedNote.voice === voiceIndex &&
            this.selectedNote.slotIndex === slotIndex;

        // Draw selection ring if selected
        if (isSelected) {
            ctx.save();
            ctx.strokeStyle = '#3b82f6';  // Blue selection ring
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x, y - 2, 16, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
            ctx.fill();
            ctx.restore();
        }

        ctx.fillStyle = '#6b7280';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';

        // Different rest symbols based on duration
        const duration = slot.duration || '4n';
        let restSymbol = '𝄽';  // Quarter rest default

        if (duration === '1n') restSymbol = '𝄻';
        else if (duration === '2n') restSymbol = '𝄼';
        else if (duration === '8n') restSymbol = '𝄾';
        else if (duration === '16n') restSymbol = '𝄿';
        else if (duration === '32n') restSymbol = '𝅀';

        ctx.fillText(restSymbol, x, y);
        ctx.textAlign = 'left';
    }

    /**
     * Draw continuation mark
     * Note: With 48 slots per beat, we don't draw individual continuation marks
     * as they would be too numerous and cluttered. The green/red shading shows
     * which areas are filled vs empty.
     */
    _drawContinuation(ctx, x) {
        // Don't draw continuation marks - the slot fill shading already indicates
        // which slots are occupied. Drawing 47 grey bars for a single quarter note
        // would be too cluttered.
        // ctx.fillStyle = '#d1d5db';
        // ctx.fillRect(x - 3, this.STAFF_TOP_Y + 15, 6, 10);
    }

    /**
     * Draw ghost note preview with ledger lines
     * Shows a semi-transparent preview of where the note will be placed
     */
    _drawGhostNote(ctx, clef) {
        if (!this.ghostNote || this.ghostNote.clef !== clef) {
            return;
        }

        const { x, y, pitch } = this.ghostNote;
        const duration = this.currentDuration;
        const isDotted = this.isDotted;

        // Determine note style based on duration
        const isWhole = duration === '1n';
        const isHalf = duration === '2n';
        const isFilled = !isWhole && !isHalf;
        const hasStem = !isWhole;

        // Determine ghost color - use harmonic coloring if available (for treble)
        let ghostColor = 'rgba(59, 130, 246, 0.5)';  // Default: Blue with 50% opacity
        const harmonicColors = this._getHarmonicColor(pitch, clef);
        if (harmonicColors) {
            // Convert hex color to rgba with 50% opacity
            const hexToRgba = (hex, alpha) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            };
            ghostColor = hexToRgba(harmonicColors.fill, 0.5);
        }

        ctx.save();

        // Draw ledger lines first (semi-transparent)
        ctx.strokeStyle = 'rgba(107, 114, 128, 0.5)';
        ctx.lineWidth = 1;

        // Calculate which ledger lines are needed
        const staffTop = this.STAFF_TOP_Y;
        const staffBottom = this.STAFF_TOP_Y + this.STAFF_HEIGHT;
        const lineSpacing = this.STAFF_HEIGHT / 4;  // 5 lines = 4 spaces

        // Ledger lines above staff
        if (y < staffTop) {
            let ly = staffTop - lineSpacing;
            while (ly >= y - 3) {
                ctx.beginPath();
                ctx.moveTo(x - 12, ly);
                ctx.lineTo(x + 12, ly);
                ctx.stroke();
                ly -= lineSpacing;
            }
        }

        // Ledger lines below staff
        if (y > staffBottom) {
            let ly = staffBottom + lineSpacing;
            while (ly <= y + 3) {
                ctx.beginPath();
                ctx.moveTo(x - 12, ly);
                ctx.lineTo(x + 12, ly);
                ctx.stroke();
                ly += lineSpacing;
            }
        }

        // Middle C ledger line (special case)
        // For treble clef, middle C (C4) is one ledger line below
        // For bass clef, middle C (C4) is one ledger line above
        const middleCY = this._getYFromPitch('C4', clef);
        if (Math.abs(y - middleCY) < 5) {
            ctx.beginPath();
            ctx.moveTo(x - 12, middleCY);
            ctx.lineTo(x + 12, middleCY);
            ctx.stroke();
        }

        // Draw accidental if needed (semi-transparent)
        const displayAccidental = this._getDisplayAccidental(pitch);
        if (displayAccidental) {
            ctx.fillStyle = 'rgba(55, 65, 81, 0.5)';
            ctx.font = '14px Arial';
            let symbol = '';
            if (displayAccidental === '#') symbol = '♯';
            else if (displayAccidental === 'b') symbol = '♭';
            else if (displayAccidental === 'n') symbol = '♮';
            if (symbol) {
                ctx.fillText(symbol, x - 18, y + 4);
            }
        }

        // Draw note head
        if (isWhole) {
            // Whole note: wider, unfilled oval
            ctx.strokeStyle = ghostColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(x, y, 9, 6, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else if (isHalf) {
            // Half note: unfilled oval
            ctx.strokeStyle = ghostColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(x, y, 7, 5, -0.3, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // Quarter and shorter: filled oval
            ctx.fillStyle = ghostColor;
            ctx.beginPath();
            ctx.ellipse(x, y, 7, 5, -0.3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw stem (for all except whole notes)
        if (hasStem) {
            // Natural stem direction based on pitch
            const middleY = this.STAFF_TOP_Y + (this.STAFF_HEIGHT / 2);
            const stemUp = y > middleY;
            const stemX = stemUp ? x + 6 : x - 6;
            const stemLength = 30;
            const stemEndY = stemUp ? y - stemLength : y + stemLength;

            ctx.strokeStyle = ghostColor;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(stemX, y);
            ctx.lineTo(stemX, stemEndY);
            ctx.stroke();
        }

        // Draw dot for dotted notes
        if (isDotted) {
            ctx.fillStyle = ghostColor;
            ctx.beginPath();
            ctx.arc(x + 14, y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * Update fill statistics
     * Shows slot counts: filled / total (where a slot is filled if V1 OR V2 has content)
     */
    _updateFillStats() {
        const statsEl = this.modal.querySelector('#mie-fill-stats');
        if (!statsEl || !this.slotGrid) return;

        const totalSlots = this.slotGrid.totalSlots;

        // Calculate filled slots for each clef
        // A slot counts as filled if EITHER V1 or V2 (or both) has content
        const getClefFillStats = (clef) => {
            let filledSlots = 0;
            let v0FilledSlots = 0;
            let v1FilledSlots = 0;

            for (let s = 0; s < totalSlots; s++) {
                const v0Slot = this.slotGrid.getSlot(clef, 0, s);
                const v1Slot = this.slotGrid.getSlot(clef, 1, s);

                const v0Filled = v0Slot.type !== SLOT_TYPES.EMPTY;
                const v1Filled = v1Slot.type !== SLOT_TYPES.EMPTY;

                if (v0Filled) v0FilledSlots++;
                if (v1Filled) v1FilledSlots++;

                // A slot is "filled" if either voice has content (max +1 per slot)
                if (v0Filled || v1Filled) {
                    filledSlots++;
                }
            }

            return {
                filledSlots,
                totalSlots,
                v0FilledSlots,
                v1FilledSlots,
                percentFilled: Math.round((filledSlots / totalSlots) * 100)
            };
        };

        const trebleStats = getClefFillStats('treble');
        const bassStats = getClefFillStats('bass');

        // Check if V2 is in use for each clef
        const trebleV2Active = this.slotGrid.voiceHasContent('treble', 1);
        const bassV2Active = this.slotGrid.voiceHasContent('bass', 1);

        const bar = (pct) => `
            <div class="w-16 h-2 bg-gray-200 rounded-full overflow-hidden inline-block mx-1">
                <div class="h-full ${pct === 100 ? 'bg-green-500' : 'bg-amber-400'}" style="width:${pct}%"></div>
            </div>
        `;

        const formatClef = (stats, name, v2Active) => {
            const isComplete = stats.filledSlots === stats.totalSlots;
            const fillColor = isComplete ? 'text-green-600' : 'text-amber-600';

            if (v2Active) {
                // Show both voices separately when V2 is in use
                return `
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="font-medium w-14">${name}:</span>
                        <span class="text-xs ${fillColor} font-semibold">${stats.filledSlots}/${stats.totalSlots}</span>
                        ${bar(stats.percentFilled)}
                        <span class="text-gray-300 mx-1">|</span>
                        <span class="text-gray-500 text-xs">V1: ${stats.v0FilledSlots}/${stats.totalSlots}</span>
                        <span class="text-gray-500 text-xs">V2: ${stats.v1FilledSlots}/${stats.totalSlots}</span>
                    </div>
                `;
            } else {
                // Single voice mode - simpler display
                return `
                    <div class="flex items-center gap-2">
                        <span class="font-medium w-14">${name}:</span>
                        <span class="text-xs ${fillColor} font-semibold">${stats.filledSlots}/${stats.totalSlots}</span>
                        ${bar(stats.percentFilled)}
                    </div>
                `;
            }
        };

        statsEl.innerHTML = `
            <div class="flex flex-col gap-1">
                ${formatClef(trebleStats, 'Treble', trebleV2Active)}
                ${formatClef(bassStats, 'Bass', bassV2Active)}
            </div>
        `;
    }

    /**
     * Update status message
     */
    _updateStatus(message) {
        const statusEl = this.modal.querySelector('#mie-status');
        if (statusEl) {
            statusEl.textContent = message;
        }
    }

    // ========================================================================
    // MULTI-MEASURE HELPERS
    // ========================================================================

    /**
     * Get the list of visible measure indices based on toggle states
     * @returns {number[]} Array of measure indices to display
     */
    _getVisibleMeasureIndices() {
        if (this.centerMeasureIndex === null) return [];

        const totalMeasures = this.compositionState?.measures?.length || 0;
        const indices = [];

        // Add previous measure if toggle is on and it exists
        if (this.showPrevious && this.centerMeasureIndex > 0) {
            indices.push(this.centerMeasureIndex - 1);
        }

        // Always add the center measure
        indices.push(this.centerMeasureIndex);

        // Add next measure if toggle is on and it exists
        if (this.showNext && this.centerMeasureIndex < totalMeasures - 1) {
            indices.push(this.centerMeasureIndex + 1);
        }

        return indices;
    }

    /**
     * Navigate to the previous measure
     * Saves current changes first, then loads the previous measure
     */
    _navigateToPreviousMeasure() {
        if (this.centerMeasureIndex <= 0) return;

        // Apply current changes before navigating
        this._applyChangesToCompositionState();

        // Move to previous measure
        this.centerMeasureIndex--;
        this.measureIndex = this.centerMeasureIndex;

        // Clear selection
        this.selectedNote = null;

        // Reload with new center measure
        this._reloadMeasures();
        this._updateNavigationButtons();
        this._updateStatus(`Navigated to Measure ${this.centerMeasureIndex + 1}`);
    }

    /**
     * Navigate to the next measure
     * Saves current changes first, then loads the next measure
     */
    _navigateToNextMeasure() {
        const totalMeasures = this.compositionState?.measures?.length || 0;
        if (this.centerMeasureIndex >= totalMeasures - 1) return;

        // Apply current changes before navigating
        this._applyChangesToCompositionState();

        // Move to next measure
        this.centerMeasureIndex++;
        this.measureIndex = this.centerMeasureIndex;

        // Clear selection
        this.selectedNote = null;

        // Reload with new center measure
        this._reloadMeasures();
        this._updateNavigationButtons();
        this._updateStatus(`Navigated to Measure ${this.centerMeasureIndex + 1}`);
    }

    /**
     * Update the enabled/disabled state of navigation buttons
     * Since buttons are now part of measure numbers HTML, this just updates measure numbers
     */
    _updateNavigationButtons() {
        // Navigation buttons are now embedded in measure numbers, so refresh them
        this._updateMeasureNumbers();
        // Also update prev/next checkboxes as the new center measure changes context
        this._updatePrevNextToggles();
    }

    /**
     * Reload measures when Previous/Next toggles change
     * Re-creates the SlotGrid and re-renders
     */
    _reloadMeasures() {
        const measureIndices = this._getVisibleMeasureIndices();
        this.measureCount = measureIndices.length;

        if (measureIndices.length === 0) {
            console.warn('[MeasureIsolationEditor] No measures to display');
            return;
        }

        // Update title
        const titleEl = this.modal.querySelector('#mie-title');
        if (titleEl) {
            const measureList = measureIndices.map(i => i + 1).join(', ');
            titleEl.textContent = `Measure Editor - Measure${this.measureCount > 1 ? 's' : ''} ${measureList}`;
        }

        // Calculate new staff width based on measure count
        // BASE_MEASURE_WIDTH per measure, plus space for clef/key signature
        this.STAFF_WIDTH = this.START_X + (this.BASE_MEASURE_WIDTH * this.measureCount) + 30;

        // Get time signature for slot calculations
        const timeSignature = this.compositionState.getTimeSignature();
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);
        const slotsPerMeasure = Math.round(beatsPerMeasure * SLOTS_PER_BEAT);
        const visualSlotsPerMeasure = Math.round(beatsPerMeasure * this.VISUAL_SLOTS_PER_BEAT);

        // Update slot width - slots stay consistent size across all measures
        this.SLOT_WIDTH = this.BASE_MEASURE_WIDTH / slotsPerMeasure;
        // Visual slot width for grid display
        this.VISUAL_SLOT_WIDTH = this.BASE_MEASURE_WIDTH / visualSlotsPerMeasure;

        // Create multi-measure SlotGrid
        this.slotGrid = new SlotGrid(timeSignature, 2, this.measureCount);

        // Load all visible measures
        const measures = measureIndices.map(idx => this.compositionState.getMeasure(idx));
        this.slotGrid.loadFromMeasures(measures);

        // Store measure indices for later use (e.g., saving)
        this.visibleMeasureIndices = measureIndices;

        // Re-initialize canvases with new width, then update measure numbers and render
        this._initCanvases();
        this._updateMeasureNumbers();
        this._renderStaves();
        this._updateFillStats();

        console.log('[MeasureIsolationEditor] Reloaded measures:', measureIndices, 'width:', this.STAFF_WIDTH);
    }

    /**
     * Update the measure numbers display above the staves
     * Shows measure numbers with visual distinction for selected vs prev/next
     * Includes navigation arrows flanking the center measure pill
     */
    _updateMeasureNumbers() {
        const container = this.modal?.querySelector('#mie-measure-numbers');
        if (!container) {
            console.warn('[MIE] Measure numbers container not found');
            return;
        }

        const measureIndices = this.visibleMeasureIndices || [this.centerMeasureIndex];
        if (!measureIndices || measureIndices.length === 0) {
            console.warn('[MIE] No measure indices available');
            return;
        }

        // Calculate the actual measure width based on canvas and slot dimensions
        const slotsPerMeasure = this.slotGrid?.slotsPerMeasure || 32;

        // Get measure width from SLOT_WIDTH if available, otherwise use canvas width
        let measureWidth;
        if (this.SLOT_WIDTH && this.SLOT_WIDTH > 0) {
            measureWidth = this.SLOT_WIDTH * slotsPerMeasure;
        } else if (this.trebleCanvas) {
            // Fallback: calculate from canvas width
            measureWidth = (this.trebleCanvas.width - this.START_X - 30) / measureIndices.length;
        } else {
            // Last resort fallback
            measureWidth = 800;
        }

        // Update the container's left margin to match START_X
        const startX = this.START_X || 100;
        container.style.marginLeft = `${startX}px`;

        // Check navigation button states
        const totalMeasures = this.compositionState?.measures?.length || 0;
        const canGoPrev = this.centerMeasureIndex > 0;
        const canGoNext = this.centerMeasureIndex < totalMeasures - 1;

        // Build measure number labels
        let html = '';
        measureIndices.forEach((measureIndex, viewOffset) => {
            const isCenter = measureIndex === this.centerMeasureIndex;
            const measureNum = measureIndex + 1;  // 1-indexed for display

            // Determine styling based on whether this is the selected (center) measure
            const bgClass = isCenter
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-300 text-gray-700';

            if (isCenter) {
                // Center measure with navigation arrows
                const prevBtnClass = canGoPrev
                    ? 'hover:bg-indigo-100 text-indigo-600 cursor-pointer'
                    : 'text-gray-300 cursor-not-allowed';
                const nextBtnClass = canGoNext
                    ? 'hover:bg-indigo-100 text-indigo-600 cursor-pointer'
                    : 'text-gray-300 cursor-not-allowed';

                html += `
                    <div class="flex-shrink-0 flex items-center justify-center gap-2" style="width: ${measureWidth}px;">
                        <button id="mie-prev-measure-btn"
                                class="p-1.5 rounded-full transition-colors ${prevBtnClass}"
                                title="Previous Measure (Ctrl+←)"
                                ${canGoPrev ? '' : 'disabled'}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                            </svg>
                        </button>
                        <span class="inline-block px-4 py-1.5 rounded-full text-sm font-bold ${bgClass} shadow-sm">
                            Measure ${measureNum}
                        </span>
                        <button id="mie-next-measure-btn"
                                class="p-1.5 rounded-full transition-colors ${nextBtnClass}"
                                title="Next Measure (Ctrl+→)"
                                ${canGoNext ? '' : 'disabled'}>
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                        </button>
                    </div>
                `;
            } else {
                // Non-center measure (prev/next context)
                const label = measureIndex < this.centerMeasureIndex ? `← M${measureNum}` : `M${measureNum} →`;
                html += `
                    <div class="flex-shrink-0 text-center" style="width: ${measureWidth}px;">
                        <span class="inline-block px-4 py-1.5 rounded-full text-sm font-bold ${bgClass} shadow-sm">
                            ${label}
                        </span>
                    </div>
                `;
            }
        });

        container.innerHTML = html;

        // Re-attach event listeners to the newly created buttons
        this._attachNavigationButtonListeners();
    }

    /**
     * Attach click listeners to navigation buttons (called after updating measure numbers)
     */
    _attachNavigationButtonListeners() {
        const prevBtn = this.modal?.querySelector('#mie-prev-measure-btn');
        const nextBtn = this.modal?.querySelector('#mie-next-measure-btn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => this._navigateToPreviousMeasure());
        }
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this._navigateToNextMeasure());
        }
    }

    /**
     * Update the Previous/Next toggle states (disable if at edges)
     */
    _updatePrevNextToggles() {
        const totalMeasures = this.compositionState?.measures?.length || 0;

        const prevCheckbox = this.modal.querySelector('#mie-show-prev');
        const nextCheckbox = this.modal.querySelector('#mie-show-next');
        const prevLabel = this.modal.querySelector('#mie-prev-label');
        const nextLabel = this.modal.querySelector('#mie-next-label');

        if (prevCheckbox) {
            // Disable if center is first measure
            const prevDisabled = this.centerMeasureIndex <= 0;
            prevCheckbox.disabled = prevDisabled;
            if (prevDisabled) {
                prevCheckbox.checked = false;
                this.showPrevious = false;
            }
            // Style label text lighter when disabled
            if (prevLabel) {
                const labelSpan = prevLabel.querySelector('span');
                if (labelSpan) {
                    labelSpan.className = prevDisabled ? 'text-sm text-gray-300' : 'text-sm text-gray-700';
                }
                prevLabel.classList.toggle('cursor-not-allowed', prevDisabled);
                prevLabel.classList.toggle('cursor-pointer', !prevDisabled);
            }
        }

        if (nextCheckbox) {
            // Disable if center is last measure
            const nextDisabled = this.centerMeasureIndex >= totalMeasures - 1;
            nextCheckbox.disabled = nextDisabled;
            if (nextDisabled) {
                nextCheckbox.checked = false;
                this.showNext = false;
            }
            // Style label text lighter when disabled
            if (nextLabel) {
                const labelSpan = nextLabel.querySelector('span');
                if (labelSpan) {
                    labelSpan.className = nextDisabled ? 'text-sm text-gray-300' : 'text-sm text-gray-700';
                }
                nextLabel.classList.toggle('cursor-not-allowed', nextDisabled);
                nextLabel.classList.toggle('cursor-pointer', !nextDisabled);
            }
        }
    }

    /**
     * Cancel and close
     */
    cancel() {
        this.modal.classList.add('hidden');
        this.slotGrid = null;
        this.onCancelCallback();
    }

    /**
     * Apply changes to composition state without closing the modal
     * Used when navigating between measures to save before switching
     */
    _applyChangesToCompositionState() {
        if (!this.slotGrid || this.centerMeasureIndex === null) {
            return;
        }

        // Get the list of visible measure indices
        const measureIndices = this.visibleMeasureIndices || [this.centerMeasureIndex];

        // Apply edits to each visible measure
        measureIndices.forEach((measureIndex, viewOffset) => {
            // Extract notation for this specific measure from the multi-measure grid
            const editedNotation = this.slotGrid.extractMeasureNotation(viewOffset);

            // Apply to composition state
            const measure = this.compositionState.getMeasure(measureIndex);
            if (measure) {
                // Ensure notation structure exists
                if (!measure.notation) {
                    measure.notation = { treble: { voices: [] }, bass: { voices: [] } };
                }

                // Update notation
                measure.notation.treble = editedNotation.treble;
                measure.notation.bass = editedNotation.bass;
            }
        });

        // Trigger refresh of notation display (without closing modal)
        if (this.onApplyCallback) {
            this.onApplyCallback();
        }
    }

    /**
     * Apply changes without closing - allows user to continue editing
     */
    applyWithoutClose() {
        if (!this.slotGrid || this.centerMeasureIndex === null) {
            return;
        }

        // Apply changes
        this._applyChangesToCompositionState();

        // Show confirmation
        this._updateStatus('✓ Changes applied');

        // Reset status after a moment
        setTimeout(() => {
            if (this.selectedNote) {
                this._updateStatusForSelectedNote();
            } else {
                this._updateStatus('Click on staff to add notes');
            }
        }, 1500);

        console.log('[MeasureIsolationEditor] Applied changes (staying open)');
    }

    /**
     * Apply changes and close
     */
    apply() {
        if (!this.slotGrid || this.centerMeasureIndex === null) {
            this.cancel();
            return;
        }

        // Apply changes
        this._applyChangesToCompositionState();

        console.log('[MeasureIsolationEditor] Applied changes and closing');

        // Close modal
        this.modal.classList.add('hidden');
        this.slotGrid = null;
    }
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

let editorInstance = null;

/**
 * Get or create the editor instance
 */
export function getMeasureIsolationEditor(options = {}) {
    if (!editorInstance) {
        editorInstance = new MeasureIsolationEditor(options);
        // Expose on window for inline onclick handlers
        window.mieInstance = editorInstance;
    } else if (options.compositionState) {
        editorInstance.compositionState = options.compositionState;
    }
    return editorInstance;
}

/**
 * Open the measure isolation editor
 */
export function openMeasureIsolationEditor(measureIndex, options = {}) {
    const editor = getMeasureIsolationEditor(options);
    // Ensure window reference is set (in case editor was created differently)
    window.mieInstance = editor;
    if (options.onApply) editor.onApplyCallback = options.onApply;
    if (options.onCancel) editor.onCancelCallback = options.onCancel;
    editor.open(measureIndex);
}
