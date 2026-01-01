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
import { KEY_SIGNATURES, noteToMidi } from '../vexFlowRenderer.js';
import { getPiano, getAudioIsReady, initAudio } from '../../audio/audioEngine.js';
import { getCurrentTempo } from '../../audio/melodyGenerator.js';
import { analyzeChordTone, CHORD_TONE_COLORS, NOTE_RELATIONSHIPS } from '../../analysis/chordToneAnalyzer.js';
import { showToast } from '../../ui/toastNotifications.js';

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
 * MeasureIsolationEditor - VexFlow-based direct editing
 */
export class MeasureIsolationEditor {
    constructor(options = {}) {
        this.compositionState = options.compositionState;
        this.onApplyCallback = options.onApply || (() => {});
        this.onCancelCallback = options.onCancel || (() => {});

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
        this.noteEntryModeSticky = false;  // The toggle state
        this.isAltPressed = false;         // Tracks Alt key state for ghost note

        // Selection state (for click-to-select, then delete)
        this.selectedNote = null;  // { clef, voice, slotIndex }

        // Ghost note state (for preview on hover - only shown in entry mode)
        this.ghostNote = null;  // { clef, slotIndex, pitch, x, y }

        // Track last mouse position for each clef (to restore ghost note when Alt is pressed)
        this.lastMousePosition = { treble: null, bass: null };  // { x, y, slotIndex, pitch }

        // Ottava state
        this.trebleOttava = 0;  // 0 = none, 1 = 8va, -1 = 8vb
        this.bassOttava = 0;

        // Canvas and rendering
        this.trebleCanvas = null;
        this.bassCanvas = null;

        // Layout constants matching VexFlow
        this.STAFF_WIDTH = 1000;
        this.CANVAS_HEIGHT = 280;      // Increased for more ledger line space
        this.SLOT_WIDTH = null;        // Calculated based on time signature
        this.CLEF_WIDTH = 70;
        this.START_X = 100;            // Where notes begin (after clef)

        // VexFlow-compatible staff layout
        this.LINE_SPACING = 10;        // 10px between staff lines (standard VexFlow)
        this.STAFF_HEIGHT = 40;        // 5 lines = 4 gaps × 10px = 40px
        this.STAFF_TOP_Y = 100;        // More room above for ledger lines and 8va
        this.PIXELS_PER_STEP = 5;      // 5px per diatonic step (half line spacing)

        this._createModal();
    }

    /**
     * Create the modal DOM structure
     */
    _createModal() {
        this.modal = document.getElementById('measure-isolation-modal');
        if (this.modal) {
            return;
        }

        this.modal = document.createElement('div');
        this.modal.id = 'measure-isolation-modal';
        this.modal.className = 'fixed inset-0 bg-black bg-opacity-50 hidden z-[9999] flex items-center justify-center p-4';
        this.modal.innerHTML = `
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

                    <!-- Rest mode -->
                    <button id="mie-rest-btn" class="px-3 py-1.5 border rounded hover:bg-gray-200 text-lg" title="Rest Mode (R)">𝄽</button>

                    <!-- Voice selector -->
                    <div class="flex items-center gap-1">
                        <span class="text-xs text-gray-500 mr-1">Voice:</span>
                        <button class="mie-voice-btn px-2 py-1 border rounded bg-blue-100 border-blue-400" data-voice="0">V1</button>
                        <button class="mie-voice-btn px-2 py-1 border rounded hover:bg-gray-200" data-voice="1">V2</button>
                    </div>

                    <!-- Delete selected note -->
                    <button id="mie-delete-btn" class="px-3 py-1.5 border rounded hover:bg-red-100 text-red-600 opacity-50" title="Delete Selected (Del/Backspace)" disabled>🗑 Delete</button>
                </div>

                <!-- Ottava Toolbar -->
                <div class="px-4 py-2 bg-gray-50 border-b flex items-center gap-6">
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-500">Treble Ottava:</span>
                        <button class="mie-ottava-btn px-2 py-1 border rounded text-sm hover:bg-blue-100" data-clef="treble" data-ottava="-1" title="8vb - One octave down">8vb</button>
                        <button class="mie-ottava-btn px-2 py-1 border rounded text-sm bg-gray-100" data-clef="treble" data-ottava="0" title="None">—</button>
                        <button class="mie-ottava-btn px-2 py-1 border rounded text-sm hover:bg-blue-100" data-clef="treble" data-ottava="1" title="8va - One octave up">8va</button>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-gray-500">Bass Ottava:</span>
                        <button class="mie-ottava-btn px-2 py-1 border rounded text-sm hover:bg-blue-100" data-clef="bass" data-ottava="-1" title="8vb - One octave down">8vb</button>
                        <button class="mie-ottava-btn px-2 py-1 border rounded text-sm bg-gray-100" data-clef="bass" data-ottava="0" title="None">—</button>
                        <button class="mie-ottava-btn px-2 py-1 border rounded text-sm hover:bg-blue-100" data-clef="bass" data-ottava="1" title="8va - One octave up">8va</button>
                    </div>
                    <!-- Sticky Entry Mode Toggle -->
                    <div class="flex items-center gap-2 ml-auto">
                        <span class="text-xs text-gray-500" title="When ON, default is Entry mode. When OFF, hold Alt for Entry mode.">Entry Mode:</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="mie-sticky-toggle" class="sr-only peer">
                            <div class="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer
                                        peer-checked:after:translate-x-full peer-checked:after:border-white
                                        after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                        after:bg-white after:border-gray-300 after:border after:rounded-full
                                        after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                        </label>
                        <span id="mie-sticky-status" class="text-xs text-gray-500">Hold Alt</span>
                    </div>
                </div>

                <!-- Instructions -->
                <div class="px-4 py-2 bg-blue-50 text-sm text-blue-800 border-b">
                    <strong>Select Mode</strong> (default): click notes to select.
                    <strong>Hold <kbd class="px-1 bg-white rounded">Alt</kbd></strong> for Entry Mode (click to add notes).
                    When selected: <kbd class="px-1 bg-white rounded">←→</kbd> move, <kbd class="px-1 bg-white rounded">↑↓</kbd> transpose, <kbd class="px-1 bg-white rounded">1-6</kbd> duration, <kbd class="px-1 bg-white rounded">S/F/N/K</kbd> accidentals, <kbd class="px-1 bg-white rounded">R</kbd> rest, <kbd class="px-1 bg-white rounded">Del</kbd> delete.
                    <kbd class="px-1 bg-white rounded">.</kbd> dotted, <kbd class="px-1 bg-white rounded">Space</kbd> play.
                </div>

                <!-- Main Content: The two staves -->
                <div class="flex-1 overflow-auto p-4 bg-gray-50">
                    <!-- Treble Staff -->
                    <div class="mb-4">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-sm font-medium text-gray-600">Treble Clef</span>
                            <span id="mie-treble-ottava-label" class="text-xs text-blue-600 font-medium hidden"></span>
                        </div>
                        <div id="mie-treble-container" class="bg-white border rounded-lg overflow-hidden cursor-crosshair">
                            <canvas id="mie-treble-canvas"></canvas>
                        </div>
                    </div>

                    <!-- Bass Staff -->
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-sm font-medium text-gray-600">Bass Clef</span>
                            <span id="mie-bass-ottava-label" class="text-xs text-blue-600 font-medium hidden"></span>
                        </div>
                        <div id="mie-bass-container" class="bg-white border rounded-lg overflow-hidden cursor-crosshair">
                            <canvas id="mie-bass-canvas"></canvas>
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
                        <button id="mie-cancel-btn" class="px-4 py-2 border rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                        <button id="mie-apply-btn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">Apply Changes</button>
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
        // Close button
        this.modal.querySelector('#mie-close-btn')?.addEventListener('click', () => this.cancel());

        // Cancel button
        this.modal.querySelector('#mie-cancel-btn')?.addEventListener('click', () => this.cancel());

        // Apply button
        this.modal.querySelector('#mie-apply-btn')?.addEventListener('click', () => this.apply());

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

        // Ottava buttons
        this.modal.querySelectorAll('.mie-ottava-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const clef = e.currentTarget.dataset.clef;
                const ottava = parseInt(e.currentTarget.dataset.ottava);
                if (clef === 'treble') {
                    this.trebleOttava = ottava;
                } else {
                    this.bassOttava = ottava;
                }
                this._updateOttavaButtons();
                this._renderStaves();
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
            if (this.selectedNote) {
                this._moveSelectedNoteHorizontally(-1);  // Move left one slot
            }
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (this.selectedNote) {
                this._moveSelectedNoteHorizontally(1);  // Move right one slot
            }
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
        this._updateDeleteButton();
        this._renderStaves();
        this._updateStatus('Click on staff to add notes');
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
    }

    /**
     * Select a note at the given position
     * @param {string} clef - 'treble' or 'bass'
     * @param {number} voice - Voice index (0 or 1)
     * @param {number} slotIndex - Slot position
     * @param {string|null} pitch - Specific pitch (for chord note selection) or null for rest
     */
    _selectNoteAtSlot(clef, voice, slotIndex, pitch = null) {
        this.selectedNote = { clef, voice, slotIndex, pitch };
        this._updateDeleteButton();
        this._updateToolbarForSelection();
        this._renderStaves();

        const slot = this.slotGrid.getSlot(clef, voice, slotIndex);
        if (slot.type === SLOT_TYPES.REST) {
            this._updateStatus(`Selected rest - ←→ move, R to note, 1-6 duration, Del delete`);
        } else if (pitch && slot.pitches?.length > 1) {
            this._updateStatus(`Selected ${pitch} in chord - ←→ move, ↑↓ transpose, S/F/N/K accidentals, R rest, Del`);
        } else {
            const pitchInfo = pitch || slot.pitches?.join(', ') || 'note';
            this._updateStatus(`Selected ${pitchInfo} - ←→ move, ↑↓ transpose, S/F/N/K accidentals, R rest, Del`);
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

        // Calculate new duration in slots
        const newDurationBeats = durationToBeats(newDuration, dotted);
        const newDurationSlots = Math.round(newDurationBeats * SLOTS_PER_BEAT);
        const availableSlots = this.slotGrid.totalSlots - slotIndex;

        // Check if the new duration would overflow
        if (newDurationSlots > availableSlots) {
            this._updateStatus(`⚠️ Duration too long - would overflow measure (max ${availableSlots} slots)`);
            return;
        }

        // Update the slot with new duration
        if (slot.type === SLOT_TYPES.NOTE_START) {
            this.slotGrid.setNote(clef, voice, slotIndex, {
                pitches: slot.pitches,
                duration: newDuration,
                dotted: dotted,
                stemDirection: slot.stemDirection,
                articulation: slot.articulation,
                dynamic: slot.dynamic
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
            // Convert note to rest (preserve duration)
            this.slotGrid.setRest(clef, voice, slotIndex, {
                duration: slot.duration,
                dotted: slot.dotted
            });
            this._updateStatus(`Converted to rest`);
            // Update selection - it's now a rest
            this._selectNoteAtSlot(clef, voice, slotIndex, null);
        } else if (slot.type === SLOT_TYPES.REST) {
            // Convert rest to note - use a sensible default pitch for the clef
            const defaultPitch = clef === 'treble' ? 'B4' : 'D3';
            this.slotGrid.setNote(clef, voice, slotIndex, {
                pitches: [defaultPitch],
                duration: slot.duration,
                dotted: slot.dotted
            });
            this._updateStatus(`Converted to note (${defaultPitch})`);
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

        // Update the slot with new pitches
        this.slotGrid.setNote(clef, voice, slotIndex, {
            pitches: newPitches,
            duration: slot.duration,
            dotted: slot.dotted,
            stemDirection: slot.stemDirection,
            articulation: slot.articulation,
            dynamic: slot.dynamic
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

        // Update the slot
        this.slotGrid.setNote(clef, voice, slotIndex, {
            pitches: newPitches,
            duration: slot.duration,
            dotted: slot.dotted,
            stemDirection: slot.stemDirection,
            articulation: slot.articulation,
            dynamic: slot.dynamic
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

        // Update the slot
        this.slotGrid.setNote(clef, voice, slotIndex, {
            pitches: newPitches,
            duration: slot.duration,
            dotted: slot.dotted,
            stemDirection: slot.stemDirection,
            articulation: slot.articulation,
            dynamic: slot.dynamic
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

        // Collect all notes from the slot grid
        const allNotes = [];

        ['treble', 'bass'].forEach(clef => {
            for (let v = 0; v < this.slotGrid.voiceCount; v++) {
                for (let s = 0; s < this.slotGrid.totalSlots; s++) {
                    const slot = this.slotGrid.getSlot(clef, v, s);
                    if (slot.type === SLOT_TYPES.NOTE_START && slot.pitches?.length > 0) {
                        const beat = s / SLOTS_PER_BEAT;
                        const durationBeats = durationToBeats(slot.duration, slot.dotted);
                        allNotes.push({
                            pitches: slot.pitches,
                            startTime: beat * secondsPerBeat,
                            duration: durationBeats * secondsPerBeat
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

        // Schedule all notes
        const now = Tone.now();
        allNotes.forEach(note => {
            const timeoutId = setTimeout(() => {
                piano.triggerAttackRelease(note.pitches, note.duration, Tone.now());
            }, note.startTime * 1000);
            this._playbackTimeouts.push(timeoutId);
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
     * Update ottava button states
     */
    _updateOttavaButtons() {
        this.modal.querySelectorAll('.mie-ottava-btn').forEach(btn => {
            const clef = btn.dataset.clef;
            const ottava = parseInt(btn.dataset.ottava);
            const currentOttava = clef === 'treble' ? this.trebleOttava : this.bassOttava;
            const isActive = ottava === currentOttava;
            btn.classList.toggle('bg-blue-100', isActive);
            btn.classList.toggle('border-blue-400', isActive);
            btn.classList.toggle('bg-gray-100', !isActive && ottava === 0);
        });

        // Update labels
        const trebleLabel = this.modal.querySelector('#mie-treble-ottava-label');
        const bassLabel = this.modal.querySelector('#mie-bass-ottava-label');

        if (trebleLabel) {
            if (this.trebleOttava === 1) {
                trebleLabel.textContent = '(8va - notes sound one octave higher)';
                trebleLabel.classList.remove('hidden');
            } else if (this.trebleOttava === -1) {
                trebleLabel.textContent = '(8vb - notes sound one octave lower)';
                trebleLabel.classList.remove('hidden');
            } else {
                trebleLabel.classList.add('hidden');
            }
        }

        if (bassLabel) {
            if (this.bassOttava === 1) {
                bassLabel.textContent = '(8va - notes sound one octave higher)';
                bassLabel.classList.remove('hidden');
            } else if (this.bassOttava === -1) {
                bassLabel.textContent = '(8vb - notes sound one octave lower)';
                bassLabel.classList.remove('hidden');
            } else {
                bassLabel.classList.add('hidden');
            }
        }
    }

    /**
     * Update sticky toggle status text
     */
    _updateStickyToggleStatus() {
        const statusEl = this.modal.querySelector('#mie-sticky-status');
        if (statusEl) {
            statusEl.textContent = this.noteEntryModeSticky ? 'Always On' : 'Hold Alt';
        }
    }

    /**
     * Open the editor for a specific measure
     */
    open(measureIndex) {
        this.measureIndex = measureIndex;
        this.currentDuration = '4n';
        this.isDotted = false;
        this.isRestMode = false;
        this.currentAccidental = null;  // null = use key signature
        this.currentVoice = 0;
        this.trebleOttava = 0;
        this.bassOttava = 0;
        this.ghostNote = null;  // Clear ghost note
        this.selectedNote = null;  // Clear any selection
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

        const timeSignature = this.compositionState.getTimeSignature();
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(timeSignature);

        // Calculate START_X dynamically based on number of key signature accidentals
        // Base: 70 (clef) + 12 per accidental + 20 margin
        const accidentalCount = this.keyAccidentals.length;
        this.START_X = 70 + (accidentalCount * 12) + 20;

        // Calculate slot width based on available space and number of slots
        const totalSlots = Math.round(beatsPerMeasure * SLOTS_PER_BEAT);
        this.SLOT_WIDTH = (this.STAFF_WIDTH - this.START_X - 30) / totalSlots;

        // Create slot grid
        this.slotGrid = new SlotGrid(timeSignature);
        this.slotGrid.loadFromMeasure(measure);

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
        this._updateOttavaButtons();
        this._updateDeleteButton();
        this.modal.querySelector('#mie-dotted').checked = false;

        // Sync sticky toggle checkbox with state (persists across modal opens)
        const stickyToggle = this.modal.querySelector('#mie-sticky-toggle');
        if (stickyToggle) {
            stickyToggle.checked = this.noteEntryModeSticky;
        }
        this._updateStickyToggleStatus();
        this._updateModeStatus();

        // Show modal
        this.modal.classList.remove('hidden');

        // Initialize canvases and render
        setTimeout(() => {
            this._initCanvases();
            this._renderStaves();
            this._updateFillStats();
        }, 50);
    }

    /**
     * Initialize the canvases
     */
    _initCanvases() {
        // Treble canvas
        this.trebleCanvas = this.modal.querySelector('#mie-treble-canvas');
        if (this.trebleCanvas) {
            this.trebleCanvas.width = this.STAFF_WIDTH;
            this.trebleCanvas.height = this.CANVAS_HEIGHT;
            this.trebleCanvas.onclick = (e) => this._handleCanvasClick(e, 'treble');
            this.trebleCanvas.onmousemove = (e) => this._handleCanvasMouseMove(e, 'treble');
            this.trebleCanvas.onmouseleave = () => this._handleCanvasMouseLeave('treble');
        }

        // Bass canvas
        this.bassCanvas = this.modal.querySelector('#mie-bass-canvas');
        if (this.bassCanvas) {
            this.bassCanvas.width = this.STAFF_WIDTH;
            this.bassCanvas.height = this.CANVAS_HEIGHT;
            this.bassCanvas.onclick = (e) => this._handleCanvasClick(e, 'bass');
            this.bassCanvas.onmousemove = (e) => this._handleCanvasMouseMove(e, 'bass');
            this.bassCanvas.onmouseleave = () => this._handleCanvasMouseLeave('bass');
        }
    }

    /**
     * Handle canvas click - determine slot and pitch from position
     */
    _handleCanvasClick(event, clef) {
        const canvas = clef === 'treble' ? this.trebleCanvas : this.bassCanvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        // Determine slot index from X position
        const slotX = x - this.START_X;
        if (slotX < 0) {
            this._updateStatus('Click after the clef to add notes');
            return;
        }

        const slotIndex = Math.floor(slotX / this.SLOT_WIDTH);
        if (slotIndex < 0 || slotIndex >= this.slotGrid.totalSlots) {
            this._updateStatus('Click within the measure bounds');
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
                // If clicking same note that's already selected, deselect it
                // For chords, also check if clicking the same pitch
                if (this.selectedNote &&
                    this.selectedNote.clef === clef &&
                    this.selectedNote.voice === clickedNote.voice &&
                    this.selectedNote.slotIndex === clickedNote.slotIndex &&
                    this.selectedNote.pitch === clickedNote.pitch) {
                    this._clearSelection();
                } else {
                    // Select this note (with specific pitch for chord notes)
                    this._selectNoteAtSlot(clef, clickedNote.voice, clickedNote.slotIndex, clickedNote.pitch);
                }
            } else {
                // Clicking empty space in Select mode - show hint
                this._updateStatus('Hold Alt to enter notes');
            }
            return;
        }

        // In Entry mode: Clear any existing selection when adding new notes
        if (this.selectedNote) {
            this._clearSelection();
        }

        // Rest mode - don't need pitch
        if (this.isRestMode) {
            this._placeRest(clef, slotIndex);
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
        this._placeNote(clef, slotIndex, fullPitch);
    }

    /**
     * Handle canvas mouse move - update ghost note preview
     */
    _handleCanvasMouseMove(event, clef) {
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

        const slotIndex = Math.floor(slotX / this.SLOT_WIDTH);
        if (slotIndex < 0 || slotIndex >= this.slotGrid.totalSlots) {
            this.lastMousePosition[clef] = null;
            if (this.ghostNote && this.ghostNote.clef === clef) {
                this.ghostNote = null;
                this._renderStaves();
            }
            return;
        }

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
        const noteX = this.START_X + (slotIndex * this.SLOT_WIDTH) + (this.SLOT_WIDTH / 2);
        const noteY = this._getYFromPitch(fullPitch, clef);

        // Always store last mouse position for this clef (so we can restore ghost on Alt press)
        this.lastMousePosition[clef] = { x: noteX, y: noteY, slotIndex, pitch: fullPitch };

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
        const newGhost = { clef, slotIndex, pitch: fullPitch, x: noteX, y: noteY };
        const ghostChanged = !this.ghostNote ||
            this.ghostNote.clef !== clef ||
            this.ghostNote.slotIndex !== slotIndex ||
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
     * Find if a note exists at click position
     * Returns { voice, slotIndex, pitch } if found, null otherwise
     * The pitch property allows selecting individual notes within a chord
     */
    _findNoteAtClick(clef, slotIndex, clickY) {
        // Check both voices for notes at this slot
        for (let v = 0; v < this.slotGrid.voiceCount; v++) {
            const slot = this.slotGrid.getSlot(clef, v, slotIndex);

            // Check for note start or continuation (continuation should select the parent note)
            if (slot.type === SLOT_TYPES.NOTE_START) {
                // Check if click is near any of the note's pitches
                for (const pitch of slot.pitches || []) {
                    const noteY = this._getYFromPitch(pitch, clef);
                    if (Math.abs(clickY - noteY) < 15) {  // 15px hit zone
                        return { voice: v, slotIndex, pitch };  // Include specific pitch
                    }
                }
            } else if (slot.type === SLOT_TYPES.CONTINUATION) {
                // Find the parent note start
                const parentIndex = this._findNoteStartForContinuation(clef, v, slotIndex);
                if (parentIndex !== null) {
                    const parentSlot = this.slotGrid.getSlot(clef, v, parentIndex);
                    for (const pitch of parentSlot.pitches || []) {
                        const noteY = this._getYFromPitch(pitch, clef);
                        if (Math.abs(clickY - noteY) < 15) {
                            return { voice: v, slotIndex: parentIndex, pitch };  // Include specific pitch
                        }
                    }
                }
            } else if (slot.type === SLOT_TYPES.REST) {
                // Check if click is near the rest position (middle of staff)
                const restY = this.STAFF_TOP_Y + 22;
                if (Math.abs(clickY - restY) < 15) {
                    return { voice: v, slotIndex, pitch: null };  // Rests don't have pitch
                }
            }
        }

        return null;
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
     */
    _getPitchFromY(y, clef) {
        const ottava = clef === 'treble' ? this.trebleOttava : this.bassOttava;

        // Calculate relative Y from staff top
        const relativeY = y - this.STAFF_TOP_Y;

        // Staff bottom line is at y = STAFF_HEIGHT (40px below top)
        // Each step (line or space) is PIXELS_PER_STEP (5px)
        const bottomLineY = this.STAFF_HEIGHT;
        const steps = Math.round((bottomLineY - relativeY) / this.PIXELS_PER_STEP);
        const line = steps * 2;

        // Convert line to pitch
        const basePitch = lineToPitch(line, clef);

        // Apply ottava adjustment
        if (ottava !== 0) {
            const match = basePitch.match(/^([A-G])(\d+)$/);
            if (match) {
                const adjustedOctave = parseInt(match[2]) + ottava;
                return { note: match[1], octave: adjustedOctave };
            }
        }

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
     */
    _getYFromPitch(pitch, clef) {
        const ottava = clef === 'treble' ? this.trebleOttava : this.bassOttava;

        // Parse pitch
        const match = pitch.match(/^([A-G])([#b]?)(\d+)$/);
        if (!match) return this.STAFF_TOP_Y + 20; // Default to middle

        let octave = parseInt(match[3]);

        // Reverse ottava adjustment for display
        if (ottava !== 0) {
            octave -= ottava;
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

        // Standard durations in descending order of slots (8 slots per beat)
        // Dotted whole = 48 slots, Whole = 32 slots, Dotted half = 24 slots, etc.
        const standardDurations = [
            { duration: '1n', dotted: true, slots: 48 },   // dotted whole (6 beats)
            { duration: '1n', dotted: false, slots: 32 },  // whole (4 beats)
            { duration: '2n', dotted: true, slots: 24 },   // dotted half (3 beats)
            { duration: '2n', dotted: false, slots: 16 },  // half (2 beats)
            { duration: '4n', dotted: true, slots: 12 },   // dotted quarter (1.5 beats)
            { duration: '4n', dotted: false, slots: 8 },   // quarter (1 beat)
            { duration: '8n', dotted: true, slots: 6 },    // dotted eighth (0.75 beats)
            { duration: '8n', dotted: false, slots: 4 },   // eighth (0.5 beats)
            { duration: '16n', dotted: true, slots: 3 },   // dotted sixteenth (0.375 beats)
            { duration: '16n', dotted: false, slots: 2 },  // sixteenth (0.25 beats)
            { duration: '32n', dotted: false, slots: 1 },  // thirty-second (0.125 beats)
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

                // Status message
                this._updateStatus(`Added ${pitch} (${this._getDurationName(this.currentDuration)}${this.isDotted ? ' dotted' : ''})`);
            }
        }

        this._renderStaves();
        this._updateFillStats();
    }

    /**
     * Place a rest at the given position
     */
    _placeRest(clef, slotIndex) {
        const existingSlot = this.slotGrid.getSlot(clef, this.currentVoice, slotIndex);

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
    }

    /**
     * Render both staves
     */
    _renderStaves() {
        this._renderStaff('treble');
        this._renderStaff('bass');
    }

    /**
     * Render a single staff with slot grid overlay
     */
    _renderStaff(clef) {
        const canvas = clef === 'treble' ? this.trebleCanvas : this.bassCanvas;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

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

        // Draw ottava bracket if active
        this._drawOttavaBracket(ctx, clef);

        // Draw notes from slot grid
        this._drawNotes(ctx, clef);

        // Draw ghost note preview (if hovering on this clef)
        this._drawGhostNote(ctx, clef);
    }

    /**
     * Draw slot fill shading - green for filled, red for unfilled
     * If both voices are in use, split vertically: top half = V1, bottom half = V2
     */
    _drawSlotFillShading(ctx, clef) {
        const totalSlots = this.slotGrid.totalSlots;

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

        for (let s = 0; s < totalSlots; s++) {
            const x = this.START_X + (s * this.SLOT_WIDTH);

            if (bothVoicesActive) {
                // Split shading: top half for V1, bottom half for V2
                const v0Slot = this.slotGrid.getSlot(clef, 0, s);
                const v1Slot = this.slotGrid.getSlot(clef, 1, s);

                const v0Filled = v0Slot.type !== SLOT_TYPES.EMPTY;
                const v1Filled = v1Slot.type !== SLOT_TYPES.EMPTY;

                // Top half (V1)
                ctx.fillStyle = v0Filled ? filledColor : unfilledColor;
                ctx.fillRect(x, shadingTop, this.SLOT_WIDTH, halfHeight);

                // Bottom half (V2)
                ctx.fillStyle = v1Filled ? filledColor : unfilledColor;
                ctx.fillRect(x, shadingTop + halfHeight, this.SLOT_WIDTH, halfHeight);

                // Draw a subtle divider line between V1 and V2 areas
                ctx.strokeStyle = 'rgba(156, 163, 175, 0.3)';
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 2]);
                ctx.beginPath();
                ctx.moveTo(x, shadingTop + halfHeight);
                ctx.lineTo(x + this.SLOT_WIDTH, shadingTop + halfHeight);
                ctx.stroke();
                ctx.setLineDash([]);
            } else {
                // Single voice mode: use whichever voice has content (or V0 by default)
                const activeVoice = v1HasContent ? 1 : 0;
                const slot = this.slotGrid.getSlot(clef, activeVoice, s);
                const isFilled = slot.type !== SLOT_TYPES.EMPTY;

                ctx.fillStyle = isFilled ? filledColor : unfilledColor;
                ctx.fillRect(x, shadingTop, this.SLOT_WIDTH, shadingHeight);
            }
        }
    }

    /**
     * Draw vertical slot grid lines
     */
    _drawSlotGrid(ctx) {
        const totalSlots = this.slotGrid.totalSlots;

        for (let s = 0; s <= totalSlots; s++) {
            const x = this.START_X + (s * this.SLOT_WIDTH);
            const beatInfo = this.slotGrid.getSlotBeatInfo(s);

            // Different styles for beat markers - DARKER colors
            if (beatInfo.isDownbeat) {
                ctx.strokeStyle = '#6b7280';  // Darker gray for downbeats
                ctx.lineWidth = 1.5;
            } else if (beatInfo.isHalfBeat) {
                ctx.strokeStyle = '#9ca3af';  // Medium gray for half beats
                ctx.lineWidth = 1;
            } else {
                ctx.strokeStyle = '#d1d5db';  // Light gray for subdivisions
                ctx.lineWidth = 0.5;
            }

            // Draw from top of canvas to below staff
            const gridTop = this.STAFF_TOP_Y - 60;
            const gridBottom = this.STAFF_TOP_Y + this.STAFF_HEIGHT + 60;

            ctx.beginPath();
            ctx.moveTo(x, gridTop);
            ctx.lineTo(x, gridBottom);
            ctx.stroke();

            // Beat numbers on downbeats
            if (beatInfo.isDownbeat && s < totalSlots) {
                ctx.fillStyle = '#374151';
                ctx.font = 'bold 11px Arial';
                ctx.fillText(beatInfo.beat.toString(), x + 2, gridTop - 5);
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
        console.log('[MIE] _drawKeySignature called for', clef, 'key:', this.currentKey, 'accidentals:', this.keyAccidentals);
        if (!this.keyAccidentals || this.keyAccidentals.length === 0) {
            console.log('[MIE] No key accidentals to draw');
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

            console.log('[MIE] Drawing accidental:', acc, 'noteName:', noteName, 'pitch:', pitch, 'at x:', x);

            if (pitch) {
                const y = this._getYFromPitch(pitch, clef);
                const symbol = isSharp ? '♯' : '♭';
                console.log('[MIE] Drawing symbol:', symbol, 'at y:', y);
                ctx.fillText(symbol, x, y + 5);
                x += 12;  // Space between accidentals
            } else {
                console.warn('[MIE] Could not find pitch for noteName:', noteName, 'in', clef);
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
     * Draw ottava bracket if active
     */
    _drawOttavaBracket(ctx, clef) {
        const ottava = clef === 'treble' ? this.trebleOttava : this.bassOttava;
        if (ottava === 0) return;

        const label = ottava === 1 ? '8va' : '8vb';
        const bracketY = ottava === 1 ? this.STAFF_TOP_Y - 40 : this.STAFF_TOP_Y + this.STAFF_HEIGHT + 30;
        const bracketWidth = this.STAFF_WIDTH - this.START_X - 40;

        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.fillStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 2]);

        // Draw bracket line
        ctx.beginPath();
        ctx.moveTo(this.START_X, bracketY);
        ctx.lineTo(this.START_X + bracketWidth, bracketY);
        ctx.stroke();

        // Draw vertical hooks
        const hookHeight = ottava === 1 ? 8 : -8;
        ctx.beginPath();
        ctx.moveTo(this.START_X, bracketY);
        ctx.lineTo(this.START_X, bracketY + hookHeight);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(this.START_X + bracketWidth, bracketY);
        ctx.lineTo(this.START_X + bracketWidth, bracketY + hookHeight);
        ctx.stroke();

        // Draw label
        ctx.setLineDash([]);
        ctx.font = 'italic 12px serif';
        ctx.fillText(label, this.START_X + 5, bracketY - 3);

        ctx.restore();
    }

    /**
     * Draw notes from the slot grid
     */
    _drawNotes(ctx, clef) {
        console.log(`[MIE] Drawing notes for ${clef} clef`);
        for (let v = 0; v < this.slotGrid.voiceCount; v++) {
            for (let s = 0; s < this.slotGrid.totalSlots; s++) {
                const slot = this.slotGrid.getSlot(clef, v, s);
                const x = this.START_X + (s * this.SLOT_WIDTH) + (this.SLOT_WIDTH / 2);

                if (slot.type === SLOT_TYPES.NOTE_START) {
                    console.log(`[MIE] ${clef} V${v} slot ${s}: NOTE_START pitches=${JSON.stringify(slot.pitches)}`);
                    // For Voice 1, check if Voice 0 has identical pitches at same slot
                    // Compare by MIDI values for more robust matching (handles enharmonic equivalents)
                    if (v === 1) {
                        const v0Slot = this.slotGrid.getSlot(clef, 0, s);
                        if (v0Slot.type === SLOT_TYPES.NOTE_START) {
                            const v0Midi = (v0Slot.pitches || []).map(p => noteToMidi(p)).sort((a, b) => a - b).join(',');
                            const v1Midi = (slot.pitches || []).map(p => noteToMidi(p)).sort((a, b) => a - b).join(',');
                            console.log(`[MIE] Duplicate check: V0=${v0Midi}, V1=${v1Midi}, skip=${v0Midi === v1Midi}`);
                            if (v0Midi === v1Midi) {
                                // Identical content (by MIDI value) - skip rendering Voice 1's duplicate
                                continue;
                            }
                        }
                    }
                    this._drawNoteHead(ctx, x, slot, v, clef, s);
                } else if (slot.type === SLOT_TYPES.REST) {
                    this._drawRest(ctx, x, slot, v, clef, s);
                } else if (slot.type === SLOT_TYPES.CONTINUATION) {
                    this._drawContinuation(ctx, x);
                }
            }
        }
    }

    /**
     * Draw a note head at position with proper duration representation
     */
    _drawNoteHead(ctx, x, slot, voiceIndex, clef, slotIndex) {
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

        // Check if this slot is selected
        const isSlotSelected = this.selectedNote &&
            this.selectedNote.clef === clef &&
            this.selectedNote.voice === voiceIndex &&
            this.selectedNote.slotIndex === slotIndex;

        for (const pitch of pitches) {
            const y = this._getYFromPitch(pitch, clef);

            // Check if this specific pitch is selected (for chords)
            // If no specific pitch in selection, all pitches in the slot are selected
            const isPitchSelected = isSlotSelected &&
                (!this.selectedNote.pitch || this.selectedNote.pitch === pitch);

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

            // Determine color - use harmonic coloring for treble, default for bass
            const harmonicColors = this._getHarmonicColor(pitch, clef);
            const color = harmonicColors ? harmonicColors.fill : defaultColor;
            const strokeColor = harmonicColors ? harmonicColors.stroke : defaultColor;

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
     */
    _drawContinuation(ctx, x) {
        ctx.fillStyle = '#d1d5db';
        ctx.fillRect(x - 3, this.STAFF_TOP_Y + 15, 6, 10);
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

    /**
     * Cancel and close
     */
    cancel() {
        this.modal.classList.add('hidden');
        this.slotGrid = null;
        this.onCancelCallback();
    }

    /**
     * Apply changes and close
     */
    apply() {
        if (!this.slotGrid || this.measureIndex === null) {
            this.cancel();
            return;
        }

        // Get edited notation
        const editedNotation = this.slotGrid.toMeasureNotation();

        // Apply to composition state
        const measure = this.compositionState.getMeasure(this.measureIndex);
        if (measure) {
            // Ensure notation structure exists
            if (!measure.notation) {
                measure.notation = { treble: { voices: [] }, bass: { voices: [] } };
            }

            // Update notation
            measure.notation.treble = editedNotation.treble;
            measure.notation.bass = editedNotation.bass;

            console.log('[MeasureIsolationEditor] Applied changes to measure', this.measureIndex);
        }

        // Close modal
        this.modal.classList.add('hidden');
        this.slotGrid = null;

        // Callback triggers refresh
        this.onApplyCallback();
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
    if (options.onApply) editor.onApplyCallback = options.onApply;
    if (options.onCancel) editor.onCancelCallback = options.onCancel;
    editor.open(measureIndex);
}
