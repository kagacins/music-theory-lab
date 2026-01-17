/**
 * FullScreenChordLabEditor.js - Full-Screen Chord Lab Experience
 *
 * Provides a full-screen chord lab editing experience with:
 * - Full-width virtual keyboard with note names and roman numerals
 * - Collapsible left sidebar with all chord controls
 * - Bottom dock with 5 panels: Library, Intervals, Progression, Identifier, Settings
 * - FAB menu for quick actions
 *
 * This wraps the existing chordBuilder.js functionality in a modern full-screen UI.
 */

import { getCompositionState } from '../../state/compositionState.js';
import { getGlobalState, getEnharmonicPreference, setEnharmonicPreference } from '../../state/globalState.js';
import { getTrainerState } from '../../state/trainerState.js';
import {
    getBuilderRootIndex,
    getBuilderChordType,
    getBuilderInversion,
    getBuilderOctaveShift,
    getChordLibraryMode,
    getBuilderOmittedNotes,
    getBuilderLHOmittedNotes
} from '../../state/builderState.js';

// Helper functions to get LH settings from DOM (same pattern as chordBuilder.js)
function getBuilderLHType() {
    return document.getElementById('builder-lh-type-select')?.value || 'off';
}
function getBuilderLHInversion() {
    return parseInt(document.getElementById('builder-lh-inversion-select')?.value || '0', 10);
}
function getBuilderLHOctaveShift() {
    return parseInt(document.getElementById('builder-lh-octave-select')?.value || '0', 10);
}
function setBuilderLHType(value) {
    const el = document.getElementById('builder-lh-type-select');
    if (el) el.value = value;
}
function setBuilderLHInversion(value) {
    const el = document.getElementById('builder-lh-inversion-select');
    if (el) el.value = value.toString();
}
function setBuilderLHOctaveShift(value) {
    const el = document.getElementById('builder-lh-octave-select');
    if (el) el.value = value.toString();
}
import { SHARP_NOTES, FLAT_NOTES, CHORD_DEFINITIONS, CHORD_GROUPS, INTERVAL_DEFINITIONS, SCALE_DEFINITIONS, SCALE_CATEGORIES } from '../../../data/music-data.js';
import { ChordLabBottomPanel } from './ChordLabBottomPanel.js';
import { getInvertedChordNotes, getLHNotes } from '../../utils/noteUtils.js';
import { getNotationPreference } from '../../state/globalState.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
    SIDEBAR_COLLAPSED: 'chordlab-new-sidebar',
    LAST_PANEL: 'chordlab-new-panel',
    LIBRARY_MODE: 'chordlab-new-library-mode',
    SCALE_FILTER: 'chordlab-new-scale-filter',
    TOOLTIPS_ENABLED: 'chordlab-new-tooltips'
};

// LH type options with labels
const LH_TYPE_OPTIONS = [
    { value: 'off', label: 'Off' },
    { value: 'rootOnly', label: 'Root Only' },
    { value: 'rootAnd5th', label: 'Root + 5th' },
    { value: 'powerChord', label: 'Power Chord' },
    { value: 'Major', label: 'Major Triad' },
    { value: 'Minor', label: 'Minor Triad' },
    { value: 'shell_maj7', label: 'Shell (R-3-7)' },
    { value: 'shell_min7', label: 'Shell Min7' },
    { value: 'shell_dom7', label: 'Shell Dom7' },
    { value: 'spread', label: 'Spread (R-5-10)' },
    { value: 'quartal', label: 'Quartal (R-4-7)' },
    { value: 'Dominant 7th', label: 'Dom 7th' }
];

// ============================================================================
// SINGLETON
// ============================================================================

let instance = null;

/**
 * Get the singleton instance of FullScreenChordLabEditor
 */
export function getFullScreenChordLabEditor() {
    if (!instance) {
        instance = new FullScreenChordLabEditor();
    }
    return instance;
}

// ============================================================================
// FullScreenChordLabEditor CLASS
// ============================================================================

class FullScreenChordLabEditor {
    constructor() {
        this.isTabMode = false;
        this.tabContent = null;
        this.bottomPanel = null;

        // References for keyboard capture/restore
        this.originalKeyboardParent = null;
        this.originalKeyboardNextSibling = null;

        // State
        this.sidebarCollapsed = this._loadFromStorage(STORAGE_KEYS.SIDEBAR_COLLAPSED, false);

        // Event handler bindings
        this._boundKeyHandler = this._handleKeyDown.bind(this);
        this._boundBuilderUpdateHandler = this._onBuilderUpdate.bind(this);
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Open the chord lab editor in tab mode
     */
    openInTabMode() {
        // If already in tab mode, just re-capture keyboard (it may have been restored when switching tabs)
        if (this.isTabMode) {
            console.log('[FullScreenChordLabEditor] Already in tab mode, re-capturing keyboard');
            this._captureKeyboard();
            this._syncFromBuilderState();
            // Update keyboard labels (Roman numerals) when re-entering tab
            if (window.updateKeyboardLabels) {
                setTimeout(() => window.updateKeyboardLabels(), 50);
            }
            return;
        }

        const tabContainer = document.getElementById('chordlab-new-container');
        if (!tabContainer) {
            console.error('[FullScreenChordLabEditor] chordlab-new-container not found');
            return;
        }

        // Mark as in tab mode
        this.isTabMode = true;

        // Generate the content HTML
        tabContainer.innerHTML = this._generateTabModeHTML();

        // Get reference to the main content div
        this.tabContent = tabContainer.querySelector('#chordlab-new-content');

        // Capture the keyboard from its original location
        this._captureKeyboard();

        // Apply sidebar state
        this._applySidebarState();

        // Initialize bottom panel
        this.bottomPanel = new ChordLabBottomPanel(this.tabContent, this);
        this.bottomPanel.init();

        // Attach event handlers
        this._attachEventHandlers();

        // Initialize FAB (2-tier Speed Dial)
        this._initFAB();

        // Sync UI from current builder state
        this._syncFromBuilderState();

        // Add event listeners
        document.addEventListener('keydown', this._boundKeyHandler);
        window.addEventListener('builderUpdated', this._boundBuilderUpdateHandler);

        // Update keyboard labels (Roman numerals) if enabled
        // This ensures Roman numerals are shown when switching to chordlab-new tab
        if (window.updateKeyboardLabels) {
            setTimeout(() => window.updateKeyboardLabels(), 50);
        }

        console.log('[FullScreenChordLabEditor] Opened in tab mode');
    }

    /**
     * Close the tab mode
     */
    closeTabMode() {
        if (!this.isTabMode) return;

        // Remove event listeners
        document.removeEventListener('keydown', this._boundKeyHandler);
        window.removeEventListener('builderUpdated', this._boundBuilderUpdateHandler);

        // Restore keyboard to original location
        this._restoreKeyboard();

        // Close bottom panel
        this.bottomPanel?.closePanel();

        // Clear tab container
        const tabContainer = document.getElementById('chordlab-new-container');
        if (tabContainer) {
            tabContainer.innerHTML = `
                <div class="flex items-center justify-center h-screen">
                    <div class="text-center">
                        <div class="text-gray-400">Chord Lab (New) closed</div>
                    </div>
                </div>
            `;
        }

        this.isTabMode = false;
        console.log('[FullScreenChordLabEditor] Closed tab mode');
    }

    // ========================================================================
    // HTML GENERATION
    // ========================================================================

    _generateTabModeHTML() {
        return `
        <div id="chordlab-new-content" class="w-full h-full flex flex-col bg-gray-100 overflow-hidden relative">
            <!-- Keyboard container (FULL WIDTH at top) -->
            <div id="fs-chordlab-keyboard-area" class="w-full px-4 py-2 bg-gray-200 border-b border-gray-300">
                <!-- Keyboard will be moved here -->
            </div>

            <!-- Content area below keyboard: Sidebar + Main - extends to bottom -->
            <div class="flex flex-1 overflow-hidden">
                <!-- Sidebar (narrow, compact) -->
                ${this._generateSidebarHTML()}

                <!-- Main content area -->
                <div class="flex-1 flex flex-col overflow-hidden">
                    <!-- Current chord info bar (compact) -->
                    <div id="fs-chordlab-chord-display" class="bg-white border-b border-gray-200 px-4 py-1.5 flex items-center gap-4 shadow-sm">
                        <span id="fs-current-chord-symbol" class="text-amber-600 text-xl font-bold">C</span>
                        <span id="fs-current-chord-name" class="text-gray-700 font-semibold">C Major</span>
                        <span id="fs-current-chord-notes" class="text-gray-500 text-sm">C4 - E4 - G4</span>
                    </div>

                    <!-- Main content area - Shows Library/Intervals/Progression content - extends to bottom -->
                    <div id="fs-chordlab-main-content" class="flex-1 overflow-y-auto p-3 pb-16 bg-gray-50">
                        <!-- Content rendered by bottom panel tabs -->
                        <div class="text-gray-400 text-center py-8">Select a tab below to view content</div>
                    </div>
                </div>
            </div>

            <!-- Floating Bottom dock (matches Composition Studio style) -->
            <div id="fs-chordlab-bottom-dock" class="absolute left-0 right-0 bottom-4 flex justify-center pointer-events-none z-50">
                <!-- Floating bar rendered here by ChordLabBottomPanel -->
            </div>

            <!-- FAB Menu -->
            ${this._generateFABHTML()}
        </div>
        `;
    }

    _generateChordLibraryHTML() {
        // Generate the chord library grid for the main content area
        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootIndex = getBuilderRootIndex();
        const rootNote = notes[rootIndex];
        const currentChordType = getBuilderChordType();

        let html = '<div class="space-y-4">';

        // Generate chord groups
        CHORD_GROUPS.forEach(group => {
            html += `
                <div class="bg-white rounded-lg shadow-sm p-4">
                    <h3 class="text-gray-700 text-sm font-semibold mb-3 uppercase tracking-wide">${group.title}</h3>
                    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
            `;

            group.types.forEach(chordType => {
                const def = CHORD_DEFINITIONS[chordType];
                if (!def) return;

                const symbol = def.symbol || '';
                const isSelected = chordType === currentChordType;
                const selectedClass = isSelected ? 'ring-2 ring-amber-500 bg-amber-50' : 'bg-gray-50 hover:bg-gray-100';

                html += `
                    <button onmousedown="window.selectBuilderChordType && window.selectBuilderChordType('${chordType}', true)"
                            class="p-2 ${selectedClass} rounded-lg text-left transition-colors border border-gray-200"
                            title="${chordType}">
                        <div class="text-gray-800 text-sm font-medium truncate">${chordType}</div>
                        <div class="text-amber-600 text-xs font-semibold">${rootNote}${symbol}</div>
                    </button>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    _generateHeaderHTML() {
        const trainerState = getTrainerState();
        const currentKey = trainerState?.currentKey || 'C Major';

        return `
        <div id="fs-chordlab-header" class="bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 flex items-center justify-between shadow-lg">
            <!-- Left: Back button and title -->
            <div class="flex items-center gap-3">
                <button onclick="window.switchTab && window.switchTab('builder')"
                        class="flex items-center gap-1 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm transition-colors"
                        title="Return to Chord Lab (Classic)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                    </svg>
                    Classic
                </button>
                <div class="text-white">
                    <span class="font-bold text-lg">Chord Lab</span>
                    <span class="text-white/70 text-sm ml-2">New</span>
                </div>
            </div>

            <!-- Center: Key display -->
            <div class="flex items-center gap-2">
                <span class="text-white/80 text-sm">Key:</span>
                <span id="fs-chordlab-key" class="text-white font-semibold">${currentKey}</span>
            </div>

            <!-- Right: Action buttons -->
            <div class="flex items-center gap-2">
                <!-- Play dropdown -->
                <div class="relative group">
                    <button class="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm transition-colors">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                        </svg>
                        Play
                        <svg class="w-3 h-3 opacity-70" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                    <div class="absolute right-0 mt-1 w-44 bg-white rounded-lg shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                        <button onclick="window.playBuilderChordWithDuration && window.playBuilderChordWithDuration()"
                                class="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg flex items-center gap-2">
                            <svg class="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                            </svg>
                            Play Current Chord
                        </button>
                        <button onclick="window.playBuilderProgression && window.playBuilderProgression()"
                                class="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-b-lg flex items-center gap-2">
                            <svg class="w-4 h-4 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/>
                            </svg>
                            Play Progression
                        </button>
                    </div>
                </div>

                <!-- Add dropdown -->
                <div class="relative group">
                    <button class="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-sm transition-colors">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/>
                        </svg>
                        Add
                        <svg class="w-3 h-3 opacity-70" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                    <div class="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                        <button onclick="window.addChordToProgression && window.addChordToProgression(false)"
                                class="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg flex items-center gap-2">
                            <svg class="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/>
                            </svg>
                            Add Chord
                        </button>
                        <button onclick="window.addChordToProgression && window.addChordToProgression(true)"
                                class="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 rounded-b-lg flex items-center gap-2">
                            <svg class="w-4 h-4 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/>
                            </svg>
                            Add & Go to Composer
                        </button>
                    </div>
                </div>

                <!-- Stop button -->
                <button onclick="window.forceStopAllPlayback && window.forceStopAllPlayback(true)"
                        class="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm transition-colors"
                        title="Stop">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <rect x="6" y="6" width="8" height="8"/>
                    </svg>
                </button>
            </div>
        </div>
        `;
    }

    _generateSidebarHTML() {
        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootIndex = getBuilderRootIndex();
        const chordType = getBuilderChordType();
        const inversion = getBuilderInversion();
        const octaveShift = getBuilderOctaveShift();
        const lhType = getBuilderLHType?.() || 'off';
        const lhInversion = getBuilderLHInversion?.() || 0;
        const lhOctave = getBuilderLHOctaveShift?.() || 0;

        // Generate LH type options
        const lhTypeOptions = LH_TYPE_OPTIONS.map(opt => {
            const selected = opt.value === lhType ? 'selected' : '';
            return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
        }).join('');

        // Get max inversions for current chord (up to 4th inversion for 5+ note chords)
        const chordDef = CHORD_DEFINITIONS[chordType];
        const maxInversion = chordDef ? Math.min(chordDef.intervals.length - 1, 4) : 2;

        return `
        <div id="fs-chordlab-sidebar" class="w-52 bg-white border-r border-gray-200 flex flex-col overflow-y-auto text-sm" style="min-width: 200px;">
            <div class="p-2.5 space-y-2.5">
                <!-- Root Note -->
                <div class="bg-gray-50 rounded p-2.5">
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-gray-700 font-semibold text-sm">Root</span>
                        <label class="flex items-center gap-0.5 cursor-pointer" title="Sharp/Flat">
                            <span class="${enhPref === 'sharp' ? 'text-amber-600 font-bold' : 'text-gray-400'}">♯</span>
                            <div class="relative">
                                <input type="checkbox" id="fs-chordlab-enharmonic"
                                       ${enhPref === 'flat' ? 'checked' : ''}
                                       onchange="window.fsChordLabToggleEnharmonic && window.fsChordLabToggleEnharmonic(this.checked)"
                                       class="sr-only peer">
                                <div class="w-6 h-3 bg-gray-300 peer-checked:bg-amber-500 rounded-full"></div>
                                <div class="absolute top-0.5 left-0.5 w-2 h-2 bg-white rounded-full transition-transform peer-checked:translate-x-3"></div>
                            </div>
                            <span class="${enhPref === 'flat' ? 'text-amber-600 font-bold' : 'text-gray-400'}">♭</span>
                        </label>
                    </div>
                    <div id="fs-root-buttons" class="grid grid-cols-4 gap-1">
                        ${notes.map((note, i) => `
                            <button data-root="${i}"
                                    onmousedown="window.fsChordLabSelectRoot && window.fsChordLabSelectRoot(${i})"
                                    onmouseup="window.stopBuilderChord && window.stopBuilderChord()"
                                    onmouseleave="window.stopBuilderChord && window.stopBuilderChord()"
                                    class="px-1.5 py-1.5 text-xs font-semibold rounded ${i === rootIndex ? 'bg-amber-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}">
                                ${note}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Inversion -->
                <div class="bg-gray-50 rounded p-2.5">
                    <span class="text-gray-700 font-semibold block mb-1.5 text-sm">Inversion</span>
                    <div id="fs-inversion-buttons" class="grid grid-cols-5 gap-1">
                        ${[0, 1, 2, 3, 4].map(inv => {
                            const labels = ['R', '1', '2', '3', '4'];
                            const disabled = inv > maxInversion;
                            const active = inv === inversion && !disabled;
                            return `
                                <button data-inv="${inv}"
                                        onmousedown="window.fsChordLabSelectInversion && window.fsChordLabSelectInversion(${inv})"
                                        onmouseup="window.stopBuilderChord && window.stopBuilderChord()"
                                        onmouseleave="window.stopBuilderChord && window.stopBuilderChord()"
                                        class="px-1.5 py-1.5 text-xs font-semibold rounded ${active ? 'bg-amber-500 text-white' : disabled ? 'bg-gray-100 text-gray-300' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}"
                                        ${disabled ? 'disabled' : ''}>
                                    ${labels[inv]}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- RH Octave -->
                <div class="bg-gray-50 rounded p-2.5">
                    <span class="text-gray-700 font-semibold block mb-1.5 text-sm">RH Octave</span>
                    <div class="flex items-center justify-center gap-1.5">
                        <button onmousedown="window.changeBuilderOctave && window.changeBuilderOctave(-1)"
                                onmouseup="window.stopBuilderChord && window.stopBuilderChord()"
                                onmouseleave="window.stopBuilderChord && window.stopBuilderChord()"
                                class="w-7 h-7 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded border border-gray-200 text-sm">-</button>
                        <span id="fs-rh-octave" class="w-10 text-center text-gray-800 font-semibold text-sm">${octaveShift >= 0 ? '+' : ''}${octaveShift}</span>
                        <button onmousedown="window.changeBuilderOctave && window.changeBuilderOctave(1)"
                                onmouseup="window.stopBuilderChord && window.stopBuilderChord()"
                                onmouseleave="window.stopBuilderChord && window.stopBuilderChord()"
                                class="w-7 h-7 bg-white hover:bg-gray-100 text-gray-700 font-bold rounded border border-gray-200 text-sm">+</button>
                    </div>
                </div>

                <!-- Include Notes (RH Voicing) -->
                <div class="bg-gray-50 rounded p-2.5">
                    <div class="flex items-center gap-2 mb-1.5">
                        <span class="text-gray-700 font-semibold text-xs">Include Notes</span>
                        <div id="fs-rh-voicing-buttons" class="flex gap-1">
                            <button onclick="window.fsChordLabSelectAllNotes && window.fsChordLabSelectAllNotes()"
                                    class="px-2 py-0.5 text-xs font-semibold bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors"
                                    title="Select all notes">All</button>
                            <button onclick="window.fsChordLabSelectNoneNotes && window.fsChordLabSelectNoneNotes()"
                                    class="px-2 py-0.5 text-xs font-semibold bg-gray-400 hover:bg-gray-500 text-white rounded transition-colors"
                                    title="Deselect all notes">None</button>
                        </div>
                    </div>
                    <div id="fs-voicing-checkboxes" class="flex flex-wrap gap-x-2 gap-y-1 items-center px-1.5 py-1 rounded bg-white border border-gray-200">
                        <!-- Checkboxes populated dynamically -->
                    </div>
                </div>

            </div>
        </div>
        `;
    }

    _generateFABHTML() {
        // Full FAB matching classic Chord Lab - 2-tier Speed Dial design
        return `
        <div id="fs-chordlab-fab" class="fixed bottom-20 right-4 z-50">
            <!-- Quick buttons (visible when FAB menu is closed) - matching classic Chord Lab order -->
            <div id="fs-fab-quick-buttons" class="flex flex-col gap-2 mb-2">
                <!-- Add Chord (top) - circle with plus icon matching classic -->
                <button onclick="window.addChordToProgression && window.addChordToProgression(false)"
                        class="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
                        title="Add to Progression">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/>
                    </svg>
                </button>
                <!-- Play Chord (bottom) - press-and-hold -->
                <button id="fs-fab-play-chord-quick"
                        class="w-12 h-12 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
                        title="Play Chord (hold)">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                    </svg>
                </button>
            </div>

            <!-- Main FAB button -->
            <button id="fs-fab-main"
                    class="w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all active:scale-95"
                    title="Quick Actions">
                <svg class="w-6 h-6 fs-fab-icon transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
            </button>

            <!-- FAB category menu (first tier) - appears above main FAB -->
            <div id="fs-fab-menu" class="hidden absolute bottom-16 right-0 flex flex-col-reverse gap-2 mb-2">
                <!-- Playback category -->
                <div class="fs-fab-category relative" data-category="playback">
                    <button class="fs-fab-category-btn w-12 h-12 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-md flex items-center justify-center transition-all active:scale-95" aria-label="Playback">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
                    </button>
                    <span class="fs-fab-label absolute right-14 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 transition-opacity pointer-events-none">Playback</span>
                    <!-- Playback submenu -->
                    <div class="fs-fab-submenu hidden absolute bottom-0 right-14 w-44 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                        <button class="fs-fab-play-chord-btn w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-green-50 flex items-center gap-2 active:bg-green-100">
                            <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-2c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/></svg>
                            <span class="text-green-700 font-medium">Play Chord (Hold)</span>
                        </button>
                        <button data-action="play-builder-progression" class="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2 active:bg-blue-100">
                            <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
                            <span class="text-blue-700">Play Progression</span>
                        </button>
                        <div class="border-t border-gray-100"></div>
                        <button data-action="stop" class="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-red-50 flex items-center gap-2 active:bg-red-100">
                            <svg class="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20"><rect x="6" y="6" width="8" height="8"/></svg>
                            <span class="text-red-700 font-medium">Stop</span>
                        </button>
                    </div>
                </div>

                <!-- Add category -->
                <div class="fs-fab-category relative" data-category="add">
                    <button class="fs-fab-category-btn w-12 h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-md flex items-center justify-center transition-all active:scale-95" aria-label="Add">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/></svg>
                    </button>
                    <span class="fs-fab-label absolute right-14 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 transition-opacity pointer-events-none">Add</span>
                    <!-- Add submenu -->
                    <div class="fs-fab-submenu hidden absolute bottom-0 right-14 w-40 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                        <button data-action="add-chord" class="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-indigo-50 flex items-center gap-2 active:bg-indigo-100">
                            <svg class="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/></svg>
                            <span class="text-indigo-700 font-medium">Add Chord</span>
                        </button>
                        <button data-action="add-go" class="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-teal-50 flex items-center gap-2 active:bg-teal-100">
                            <svg class="w-4 h-4 text-teal-600" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd"/></svg>
                            <span class="text-teal-700">Add & Go</span>
                        </button>
                    </div>
                </div>

                <!-- File category -->
                <div class="fs-fab-category relative" data-category="file">
                    <button class="fs-fab-category-btn w-12 h-12 bg-amber-600 hover:bg-amber-700 text-white rounded-full shadow-md flex items-center justify-center transition-all active:scale-95" aria-label="File">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                    </button>
                    <span class="fs-fab-label absolute right-14 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 transition-opacity pointer-events-none">File</span>
                    <!-- File submenu -->
                    <div class="fs-fab-submenu hidden absolute bottom-0 right-14 w-40 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                        <button data-action="save" class="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 active:bg-gray-200">
                            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
                            Save
                        </button>
                        <button data-action="load" class="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 active:bg-gray-200">
                            <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                            Load
                        </button>
                    </div>
                </div>

                <!-- Settings category -->
                <div class="fs-fab-category relative" data-category="settings">
                    <button class="fs-fab-category-btn w-12 h-12 bg-gray-600 hover:bg-gray-700 text-white rounded-full shadow-md flex items-center justify-center transition-all active:scale-95" aria-label="Settings">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </button>
                    <span class="fs-fab-label absolute right-14 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 transition-opacity pointer-events-none">Settings</span>
                    <!-- Settings panel -->
                    <div class="fs-fab-submenu hidden absolute right-14 bottom-0 w-56 bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-50">
                        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Playback Settings</div>
                        <!-- BPM -->
                        <div class="flex items-center justify-between mb-3">
                            <label class="text-sm text-gray-700">BPM</label>
                            <div class="flex items-center gap-2">
                                <input type="range" id="fs-fab-bpm-slider" min="40" max="200" value="120" class="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                                <span id="fs-fab-bpm-value" class="text-sm font-semibold text-gray-700 w-8">120</span>
                            </div>
                        </div>
                        <!-- Arpeggio Speed -->
                        <div class="flex items-center justify-between mb-3">
                            <label class="text-sm text-gray-700">Arpeggio</label>
                            <div class="flex items-center gap-1">
                                <button id="fs-fab-arp-slower" class="px-2 py-0.5 text-sm font-bold bg-gray-200 rounded hover:bg-gray-300 active:scale-95">-</button>
                                <span id="fs-fab-arp-speed" class="text-xs font-semibold text-gray-700 w-12 text-center">Medium</span>
                                <button id="fs-fab-arp-faster" class="px-2 py-0.5 text-sm font-bold bg-gray-200 rounded hover:bg-gray-300 active:scale-95">+</button>
                            </div>
                        </div>
                        <!-- RH Octave -->
                        <div class="flex items-center justify-between">
                            <label class="text-sm text-gray-700">RH Octave</label>
                            <div class="flex items-center gap-1">
                                <button id="fs-fab-rh-octave-down" class="px-2 py-0.5 text-sm font-bold bg-gray-200 rounded hover:bg-gray-300 active:scale-95">-</button>
                                <span id="fs-fab-rh-octave" class="text-xs font-semibold text-gray-700 w-6 text-center">4</span>
                                <button id="fs-fab-rh-octave-up" class="px-2 py-0.5 text-sm font-bold bg-gray-200 rounded hover:bg-gray-300 active:scale-95">+</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Help category -->
                <div class="fs-fab-category relative" data-category="help">
                    <button class="fs-fab-category-btn w-12 h-12 bg-gray-500 hover:bg-gray-600 text-white rounded-full shadow-md flex items-center justify-center transition-all active:scale-95" aria-label="Help">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </button>
                    <span class="fs-fab-label absolute right-14 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 transition-opacity pointer-events-none">Help</span>
                    <!-- Help submenu -->
                    <div class="fs-fab-submenu hidden absolute bottom-0 right-14 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                        <button data-action="start-here" class="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-green-50 flex items-center gap-2 active:bg-green-100">
                            <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                            <span class="text-green-700 font-medium">Start Here Guide</span>
                        </button>
                        <button onclick="window.startLetItBeTutorial && window.startLetItBeTutorial()" class="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-emerald-50 flex items-center gap-2 active:bg-emerald-100">
                            <span class="text-lg">🎸</span>
                            <span class="text-emerald-700 font-medium">"Let It Be" Tutorial</span>
                        </button>
                        <button data-action="keyboard-shortcuts" class="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2 active:bg-blue-100">
                            <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                            <span class="text-blue-700">Keyboard Shortcuts</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    // ========================================================================
    // KEYBOARD CAPTURE/RESTORE
    // ========================================================================

    _captureKeyboard() {
        // The keyboard is in #keyboard-section > #piano-keyboard
        const keyboardSection = document.getElementById('keyboard-section');
        const pianoKeyboard = document.getElementById('piano-keyboard');

        if (pianoKeyboard) {
            this.originalKeyboardParent = pianoKeyboard.parentElement;
            this.originalKeyboardNextSibling = pianoKeyboard.nextSibling;

            const keyboardArea = this.tabContent?.querySelector('#fs-chordlab-keyboard-area');
            if (keyboardArea) {
                keyboardArea.appendChild(pianoKeyboard);
                // Style for full width
                pianoKeyboard.style.maxWidth = '100%';
                pianoKeyboard.style.width = '100%';
                // Make sure it's visible (tabs.js may have hidden keyboard-section)
                if (keyboardSection) {
                    keyboardSection.classList.add('hidden');
                }
                console.log('[FullScreenChordLabEditor] Keyboard captured');
            }
        } else {
            console.warn('[FullScreenChordLabEditor] Piano keyboard not found');
        }
    }

    _restoreKeyboard() {
        const pianoKeyboard = document.getElementById('piano-keyboard');
        const keyboardSection = document.getElementById('keyboard-section');

        if (pianoKeyboard && this.originalKeyboardParent) {
            this.originalKeyboardParent.insertBefore(pianoKeyboard, this.originalKeyboardNextSibling);
            // Restore original styling
            pianoKeyboard.style.maxWidth = '';
            pianoKeyboard.style.width = '';
            // tabs.js should handle visibility when switching back
            console.log('[FullScreenChordLabEditor] Keyboard restored');
        }
        this.originalKeyboardParent = null;
        this.originalKeyboardNextSibling = null;
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    _attachEventHandlers() {
        // Expose methods to window for HTML onclick handlers
        window.fsChordLabToggleSidebar = () => this._toggleSidebar();
        window.fsChordLabToggleEnharmonic = (isFlat) => this._toggleEnharmonic(isFlat);
        window.fsChordLabToggleSection = (section) => this._toggleSection(section);
        window.fsChordLabSelectAllNotes = () => this._selectAllNotes();
        window.fsChordLabSelectNoneNotes = () => this._selectNoneNotes();
        window.fsChordLabSetLHType = (type) => this._setLHType(type);
        window.fsChordLabSetLHInversion = (inv) => this._setLHInversion(inv);
        window.fsChordLabSetLHOctave = (oct) => this._setLHOctave(oct);
        window.fsChordLabOpenPanel = (panel) => this.bottomPanel?.openPanel(panel);
        window.fsChordLabToggleFABMenu = () => this._toggleFABMenu();
        window.fsChordLabCloseFABMenu = () => this._closeFABMenu();
        window.fsChordLabSelectInversion = (inv) => this._selectInversion(inv);
        window.fsChordLabSelectRoot = (index) => this._selectRoot(index);
    }

    _selectRoot(index) {
        // Select root note (without playing - we'll use startBuilderChord for sustained playback)
        if (window.selectBuilderRootNote) {
            window.selectBuilderRootNote(index, false);
        }
        // Start sustained playback (will stop on mouseup/mouseleave)
        if (window.startBuilderChord) {
            window.startBuilderChord();
        }
        // Update sidebar UI
        this._syncFromBuilderState();
        // Refresh bottom panel to update chord symbols with new root
        this.bottomPanel?.refresh();
    }

    _handleKeyDown(event) {
        // Escape closes FAB menu or bottom panel
        if (event.key === 'Escape') {
            this._closeFABMenu();
            this.bottomPanel?.closePanel();
        }
    }

    _onBuilderUpdate() {
        // Sync UI when builder state changes
        this._syncFromBuilderState();
        // Update chord button highlighting (preserves tooltips)
        this.bottomPanel?.updateButtonHighlighting();
    }

    // ========================================================================
    // UI UPDATES
    // ========================================================================

    _syncFromBuilderState() {
        if (!this.tabContent) return;

        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootIndex = getBuilderRootIndex();
        const chordType = getBuilderChordType();
        const inversion = getBuilderInversion();
        const octaveShift = getBuilderOctaveShift();
        const lhType = getBuilderLHType?.() || 'off';

        // Update root buttons (light theme)
        const rootButtons = this.tabContent.querySelectorAll('#fs-root-buttons button');
        rootButtons.forEach((btn, i) => {
            btn.textContent = notes[i];
            // Reset classes first
            btn.className = 'px-1.5 py-1.5 text-xs font-semibold rounded';
            if (i === rootIndex) {
                btn.classList.add('bg-amber-500', 'text-white');
            } else {
                btn.classList.add('bg-white', 'text-gray-700', 'hover:bg-gray-100', 'border', 'border-gray-200');
            }
        });

        // Update chord type dropdown
        const typeSelect = this.tabContent.querySelector('#fs-chordlab-type');
        if (typeSelect) typeSelect.value = chordType;

        // Update inversion buttons (light theme)
        this._updateInversionButtons(inversion);

        // Update RH octave display
        const octaveDisplay = this.tabContent.querySelector('#fs-rh-octave');
        if (octaveDisplay) octaveDisplay.textContent = octaveShift;

        // Update LH selects
        const lhTypeSelect = this.tabContent.querySelector('#fs-lh-type');
        if (lhTypeSelect) lhTypeSelect.value = lhType;

        // Update chord display
        this._updateChordDisplay();

        // Update voicing checkboxes
        this._updateVoicingCheckboxes();
    }

    _updateChordDisplay() {
        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootIndex = getBuilderRootIndex();
        const chordType = getBuilderChordType();
        const inversion = getBuilderInversion();
        const octaveShift = getBuilderOctaveShift();
        const rootNote = notes[rootIndex];

        const chordDef = CHORD_DEFINITIONS[chordType];
        const symbol = chordDef?.symbol || '';

        // Compute chord notes from current state (don't rely on getBuilderChordNotes which is only set during playback)
        let chordNotes = [];
        if (chordType && chordDef) {
            const result = getInvertedChordNotes(
                rootNote,
                chordType,
                inversion,
                rootNote,
                octaveShift * 12,
                enhPref,
                getNotationPreference()
            );
            chordNotes = result?.specificNotes || [];
        }

        const invLabels = ['Root Position', '1st Inversion', '2nd Inversion', '3rd Inversion', '4th Inversion', '5th Inversion'];

        const nameEl = this.tabContent?.querySelector('#fs-current-chord-name');
        const notesEl = this.tabContent?.querySelector('#fs-current-chord-notes');
        const symbolEl = this.tabContent?.querySelector('#fs-current-chord-symbol');

        if (nameEl) {
            nameEl.textContent = `${rootNote} ${chordType} (${invLabels[inversion] || 'Root Position'})`;
        }
        if (notesEl) {
            notesEl.textContent = chordNotes.length > 0 ? chordNotes.join(' - ') : 'Select a chord';
        }
        if (symbolEl) {
            symbolEl.textContent = `${rootNote}${symbol}`;
        }
    }

    _updateVoicingCheckboxes() {
        // Get current state for computing notes
        const enhPref = getEnharmonicPreference();
        const currentNotes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootIndex = getBuilderRootIndex();
        const rootNote = currentNotes[rootIndex];
        const chordType = getBuilderChordType();
        const inversion = getBuilderInversion();
        const octaveShift = getBuilderOctaveShift();

        // RH voicing checkboxes
        const rhContainer = this.tabContent?.querySelector('#fs-voicing-checkboxes');
        if (rhContainer) {
            // Compute notes from current state (don't rely on getBuilderChordNotes which is only set during playback)
            let notes = [];
            if (chordType && CHORD_DEFINITIONS[chordType]) {
                const result = getInvertedChordNotes(
                    rootNote,
                    chordType,
                    inversion,
                    rootNote,
                    octaveShift * 12,
                    enhPref,
                    getNotationPreference()
                );
                notes = result?.specificNotes || [];
            }
            const omitted = getBuilderOmittedNotes?.() || [];

            if (notes.length === 0) {
                rhContainer.innerHTML = '<span class="text-gray-400 text-xs">Select a chord</span>';
            } else {
                rhContainer.innerHTML = notes.map(note => {
                    const isOmitted = omitted.includes(note);
                    return `
                        <label class="flex items-center gap-1.5 text-gray-700 text-xs cursor-pointer hover:text-gray-900">
                            <input type="checkbox" data-note="${note}"
                                   ${!isOmitted ? 'checked' : ''}
                                   onchange="window.toggleBuilderNote && window.toggleBuilderNote('${note}')"
                                   class="w-3.5 h-3.5 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500">
                            ${note}
                        </label>
                    `;
                }).join('');
            }
        }

        // LH voicing checkboxes
        const lhContainer = this.tabContent?.querySelector('#fs-lh-voicing-checkboxes');
        if (lhContainer) {
            // Compute LH notes from current state
            const lhType = getBuilderLHType?.() || 'off';
            const lhInversion = getBuilderLHInversion?.() || 0;
            const lhOctaveShift = getBuilderLHOctaveShift?.() || 0;

            let lhNotes = [];
            if (lhType !== 'off' && chordType) {
                lhNotes = getLHNotes(rootNote, lhType, lhInversion, rootNote, lhOctaveShift, chordType, enhPref) || [];
            }
            const lhOmitted = getBuilderLHOmittedNotes?.() || [];

            if (lhNotes.length === 0) {
                lhContainer.innerHTML = '<span class="text-gray-400 text-xs">No LH notes</span>';
            } else {
                lhContainer.innerHTML = lhNotes.map(note => {
                    const isOmitted = lhOmitted.includes(note);
                    return `
                        <label class="flex items-center gap-1.5 text-gray-600 text-xs cursor-pointer hover:text-gray-800">
                            <input type="checkbox" data-note="${note}"
                                   ${!isOmitted ? 'checked' : ''}
                                   onchange="window.toggleBuilderLHNote && window.toggleBuilderLHNote('${note}')"
                                   class="w-3.5 h-3.5 rounded border-gray-300 text-indigo-500 focus:ring-indigo-500">
                            ${note}
                        </label>
                    `;
                }).join('');
            }
        }
    }

    _applySidebarState() {
        const sidebar = this.tabContent?.querySelector('#fs-chordlab-sidebar');
        const toggle = this.tabContent?.querySelector('#fs-sidebar-toggle svg');

        if (sidebar && this.sidebarCollapsed) {
            sidebar.classList.add('w-0', 'min-w-0', 'overflow-hidden', 'p-0');
            sidebar.classList.remove('w-56');
            sidebar.style.minWidth = '0';
        }
        if (toggle && this.sidebarCollapsed) {
            toggle.classList.add('rotate-180');
        }
    }

    // ========================================================================
    // SIDEBAR ACTIONS
    // ========================================================================

    _toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        this._saveToStorage(STORAGE_KEYS.SIDEBAR_COLLAPSED, this.sidebarCollapsed);

        const sidebar = this.tabContent?.querySelector('#fs-chordlab-sidebar');
        const toggle = this.tabContent?.querySelector('#fs-sidebar-toggle svg');

        if (sidebar) {
            if (this.sidebarCollapsed) {
                sidebar.classList.add('w-0', 'min-w-0', 'overflow-hidden');
                sidebar.classList.remove('w-56');
                sidebar.style.minWidth = '0';
            } else {
                sidebar.classList.remove('w-0', 'min-w-0', 'overflow-hidden');
                sidebar.classList.add('w-56');
                sidebar.style.minWidth = '220px';
            }
        }
        if (toggle) {
            toggle.classList.toggle('rotate-180', this.sidebarCollapsed);
        }
    }

    _toggleEnharmonic(isFlat) {
        const newPref = isFlat ? 'flat' : 'sharp';
        setEnharmonicPreference(newPref);

        // Update UI
        this._syncFromBuilderState();

        // Trigger global update
        if (window.updateBuilderDisplay) {
            window.updateBuilderDisplay();
        }
    }

    _toggleSection(section) {
        const content = this.tabContent?.querySelector(`#fs-${section}-content`);
        const chevron = this.tabContent?.querySelector(`#fs-${section}-chevron`);

        if (content) {
            content.classList.toggle('hidden');
        }
        if (chevron) {
            chevron.classList.toggle('rotate-180', !content?.classList.contains('hidden'));
        }
    }

    _selectAllNotes() {
        if (window.setBuilderOmittedNotes) {
            window.setBuilderOmittedNotes([]);
            this._updateVoicingCheckboxes();
            if (window.updateBuilderDisplay) window.updateBuilderDisplay();
            // Brief playback after toggling
            if (window.playBuilderChordWithDuration) window.playBuilderChordWithDuration();
        }
    }

    _selectNoneNotes() {
        const notes = window.getBuilderChordNotes?.() || [];
        if (window.setBuilderOmittedNotes) {
            window.setBuilderOmittedNotes([...notes]);
            this._updateVoicingCheckboxes();
            if (window.updateBuilderDisplay) window.updateBuilderDisplay();
            // No playback when all notes are omitted (nothing to play)
        }
    }

    _setLHType(type) {
        if (setBuilderLHType) {
            setBuilderLHType(type);
            if (window.updateBuilderDisplay) window.updateBuilderDisplay();
        }
    }

    _setLHInversion(inv) {
        if (setBuilderLHInversion) {
            setBuilderLHInversion(inv);
            if (window.updateBuilderDisplay) window.updateBuilderDisplay();
        }
    }

    _setLHOctave(oct) {
        if (setBuilderLHOctaveShift) {
            setBuilderLHOctaveShift(oct);
            if (window.updateBuilderDisplay) window.updateBuilderDisplay();
        }
    }

    _selectInversion(inv) {
        // Call the existing builder inversion function
        if (window.selectBuilderInversion) {
            window.selectBuilderInversion(inv, true);
        }
        // Update the UI immediately
        this._updateInversionButtons(inv);
    }

    _updateInversionButtons(selectedInv) {
        const chordType = getBuilderChordType();
        const chordDef = CHORD_DEFINITIONS[chordType];
        const maxInversion = chordDef ? Math.min(chordDef.intervals.length - 1, 4) : 2;

        const invButtons = this.tabContent?.querySelectorAll('#fs-inversion-buttons button');
        invButtons?.forEach((btn, inv) => {
            const disabled = inv > maxInversion;
            const active = inv === selectedInv && !disabled;
            btn.disabled = disabled;

            // Reset classes
            btn.className = 'px-1.5 py-1.5 text-xs font-semibold rounded';

            if (active) {
                btn.classList.add('bg-amber-500', 'text-white');
            } else if (disabled) {
                btn.classList.add('bg-gray-100', 'text-gray-300', 'cursor-not-allowed');
            } else {
                btn.classList.add('bg-white', 'text-gray-700', 'hover:bg-gray-100', 'border', 'border-gray-200');
            }
        });
    }

    // ========================================================================
    // FAB MENU - Full 2-tier Speed Dial matching classic Chord Lab
    // ========================================================================

    _initFAB() {
        const fabMain = this.tabContent?.querySelector('#fs-fab-main');
        const fabMenu = this.tabContent?.querySelector('#fs-fab-menu');
        const fabQuickButtons = this.tabContent?.querySelector('#fs-fab-quick-buttons');
        const fabCategories = this.tabContent?.querySelectorAll('.fs-fab-category');

        if (!fabMain || !fabMenu) {
            console.warn('[FullScreenChordLabEditor] FAB elements not found');
            return;
        }

        this._fabIsOpen = false;
        this._fabActiveSubmenu = null;
        this._fabIsHandlingAction = false;

        // Toggle main FAB menu (first tier)
        fabMain.addEventListener('click', (e) => {
            e.stopPropagation();
            this._fabIsOpen = !this._fabIsOpen;
            fabMenu.classList.toggle('hidden', !this._fabIsOpen);
            fabMain.querySelector('.fs-fab-icon').style.transform = this._fabIsOpen ? 'rotate(45deg)' : 'rotate(0deg)';

            // Hide/show quick buttons based on FAB state
            if (fabQuickButtons) {
                fabQuickButtons.classList.toggle('hidden', this._fabIsOpen);
            }

            // Close any open submenu when closing main menu
            if (!this._fabIsOpen) {
                this._closeAllFABSubmenus();
            }

            // Show labels briefly on open
            if (this._fabIsOpen) {
                this._showFABCategoryLabels();
            }
        });

        // Category buttons toggle submenus (second tier)
        fabCategories?.forEach(category => {
            const categoryBtn = category.querySelector('.fs-fab-category-btn');
            const submenu = category.querySelector('.fs-fab-submenu');

            categoryBtn?.addEventListener('click', (e) => {
                e.stopPropagation();

                // Close other categories' submenus
                fabCategories.forEach(other => {
                    if (other !== category) {
                        const otherSubmenu = other.querySelector('.fs-fab-submenu');
                        if (otherSubmenu) otherSubmenu.classList.add('hidden');
                    }
                });

                // Toggle this category's submenu
                if (submenu) {
                    const isCurrentlyOpen = !submenu.classList.contains('hidden');
                    submenu.classList.toggle('hidden', isCurrentlyOpen);
                    this._fabActiveSubmenu = isCurrentlyOpen ? null : submenu;
                }
            });

            // Handle submenu action buttons
            const actionBtns = category.querySelectorAll('[data-action]');
            actionBtns?.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    this._fabIsHandlingAction = true;
                    this._handleFABAction(action);
                    setTimeout(() => {
                        this._fabIsHandlingAction = false;
                    }, 100);
                });
            });
        });

        // Play chord button in submenu (press-and-hold)
        const playChordSubmenuBtn = this.tabContent?.querySelector('.fs-fab-play-chord-btn');
        if (playChordSubmenuBtn) {
            playChordSubmenuBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                if (window.startBuilderChord) window.startBuilderChord();
            });
            playChordSubmenuBtn.addEventListener('mouseup', () => {
                if (window.stopBuilderChord) window.stopBuilderChord();
            });
            playChordSubmenuBtn.addEventListener('mouseleave', () => {
                if (window.stopBuilderChord) window.stopBuilderChord();
            });
            playChordSubmenuBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (window.startBuilderChord) window.startBuilderChord();
            }, { passive: false });
            playChordSubmenuBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (window.stopBuilderChord) window.stopBuilderChord();
            }, { passive: false });
            playChordSubmenuBtn.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                if (window.stopBuilderChord) window.stopBuilderChord();
            }, { passive: false });
        }

        // Quick Play Chord button (press-and-hold)
        const fabPlayChordQuick = this.tabContent?.querySelector('#fs-fab-play-chord-quick');
        if (fabPlayChordQuick) {
            fabPlayChordQuick.addEventListener('mousedown', (e) => {
                e.preventDefault();
                if (window.startBuilderChord) window.startBuilderChord();
            });
            fabPlayChordQuick.addEventListener('mouseup', () => {
                if (window.stopBuilderChord) window.stopBuilderChord();
            });
            fabPlayChordQuick.addEventListener('mouseleave', () => {
                if (window.stopBuilderChord) window.stopBuilderChord();
            });
            fabPlayChordQuick.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (window.startBuilderChord) window.startBuilderChord();
            }, { passive: false });
            fabPlayChordQuick.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (window.stopBuilderChord) window.stopBuilderChord();
            }, { passive: false });
            fabPlayChordQuick.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                if (window.stopBuilderChord) window.stopBuilderChord();
            }, { passive: false });
        }

        // Initialize FAB Settings Panel controls
        this._initFABSettingsPanel();

        // Close FAB when clicking outside
        document.addEventListener('click', (e) => {
            if (this._fabIsOpen && !this._fabIsHandlingAction && !e.target.closest('#fs-chordlab-fab')) {
                this._closeFABMenu();
            }
        });
    }

    _initFABSettingsPanel() {
        // BPM Slider
        const fabBpmSlider = this.tabContent?.querySelector('#fs-fab-bpm-slider');
        const fabBpmValue = this.tabContent?.querySelector('#fs-fab-bpm-value');

        if (fabBpmSlider && fabBpmValue) {
            // Initialize from global tempo
            const initialTempo = window.g_Tempo || 120;
            fabBpmSlider.value = initialTempo;
            fabBpmValue.textContent = initialTempo;

            fabBpmSlider.addEventListener('input', (e) => {
                e.stopPropagation();
                const bpm = parseInt(e.target.value);
                fabBpmValue.textContent = bpm;
                window.g_Tempo = bpm;
                if (window.setPlaybackBPM) window.setPlaybackBPM(bpm);
                if (window.setMelodyTempo) window.setMelodyTempo(bpm);
                const compositionState = window.getCompositionState?.();
                if (compositionState?.setSettings) {
                    const currentSettings = compositionState.getSettings?.() || {};
                    compositionState.setSettings({ ...currentSettings, tempo: bpm });
                }
            });
        }

        // Arpeggio Speed
        const fabArpSlower = this.tabContent?.querySelector('#fs-fab-arp-slower');
        const fabArpFaster = this.tabContent?.querySelector('#fs-fab-arp-faster');
        const fabArpSpeed = this.tabContent?.querySelector('#fs-fab-arp-speed');
        const arpSpeeds = ['Slow', 'Medium', 'Fast'];
        let currentArpIndex = 1;

        if (fabArpSlower) {
            fabArpSlower.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this._fabIsHandlingAction = true;
                if (currentArpIndex > 0) {
                    currentArpIndex--;
                    const speed = arpSpeeds[currentArpIndex];
                    if (fabArpSpeed) fabArpSpeed.textContent = speed;
                    if (window.changeArpeggioSpeed) window.changeArpeggioSpeed('slower');
                }
                setTimeout(() => this._fabIsHandlingAction = false, 100);
            });
        }

        if (fabArpFaster) {
            fabArpFaster.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this._fabIsHandlingAction = true;
                if (currentArpIndex < arpSpeeds.length - 1) {
                    currentArpIndex++;
                    const speed = arpSpeeds[currentArpIndex];
                    if (fabArpSpeed) fabArpSpeed.textContent = speed;
                    if (window.changeArpeggioSpeed) window.changeArpeggioSpeed('faster');
                }
                setTimeout(() => this._fabIsHandlingAction = false, 100);
            });
        }

        // RH Octave controls
        const fabRhOctaveDown = this.tabContent?.querySelector('#fs-fab-rh-octave-down');
        const fabRhOctaveUp = this.tabContent?.querySelector('#fs-fab-rh-octave-up');
        const fabRhOctave = this.tabContent?.querySelector('#fs-fab-rh-octave');
        let octaveChangeInProgress = false;

        // Sync initial value
        const builderOctaveDisplay = document.getElementById('builder-octave-display');
        if (fabRhOctave && builderOctaveDisplay) {
            const match = builderOctaveDisplay.textContent.match(/-?\d+/);
            if (match) fabRhOctave.textContent = match[0];
        }

        if (fabRhOctaveDown) {
            fabRhOctaveDown.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (octaveChangeInProgress) return;

                octaveChangeInProgress = true;
                this._fabIsHandlingAction = true;

                if (window.changeBuilderOctave) {
                    window.changeBuilderOctave(-1);
                    setTimeout(() => {
                        if (window.stopBuilderChord) window.stopBuilderChord();
                    }, 500);
                    setTimeout(() => {
                        if (fabRhOctave && builderOctaveDisplay) {
                            const match = builderOctaveDisplay.textContent.match(/-?\d+/);
                            if (match) fabRhOctave.textContent = match[0];
                        }
                    }, 50);
                }

                setTimeout(() => {
                    this._fabIsHandlingAction = false;
                    octaveChangeInProgress = false;
                }, 150);
            });
        }

        if (fabRhOctaveUp) {
            fabRhOctaveUp.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (octaveChangeInProgress) return;

                octaveChangeInProgress = true;
                this._fabIsHandlingAction = true;

                if (window.changeBuilderOctave) {
                    window.changeBuilderOctave(1);
                    setTimeout(() => {
                        if (window.stopBuilderChord) window.stopBuilderChord();
                    }, 500);
                    setTimeout(() => {
                        if (fabRhOctave && builderOctaveDisplay) {
                            const match = builderOctaveDisplay.textContent.match(/-?\d+/);
                            if (match) fabRhOctave.textContent = match[0];
                        }
                    }, 50);
                }

                setTimeout(() => {
                    this._fabIsHandlingAction = false;
                    octaveChangeInProgress = false;
                }, 150);
            });
        }
    }

    _handleFABAction(action) {
        switch (action) {
            // Playback actions
            case 'play-builder-progression':
                if (window.handleAutoPlayback) window.handleAutoPlayback();
                break;
            case 'stop':
                if (window.forceStopAllPlayback) window.forceStopAllPlayback(true);
                break;

            // Add actions
            case 'add-chord':
                if (window.addChordToProgression) window.addChordToProgression(false);
                break;
            case 'add-go':
                if (window.addChordToProgression) window.addChordToProgression(true);
                break;

            // File actions
            case 'save':
                const saveBtn = document.getElementById('action-save');
                if (saveBtn) saveBtn.click();
                break;
            case 'load':
                const loadBtn = document.getElementById('action-load');
                if (loadBtn) loadBtn.click();
                break;

            // Help actions
            case 'start-here':
                window.location.href = 'start-here.html';
                break;
            case 'keyboard-shortcuts':
                if (window.showNotationShortcuts) window.showNotationShortcuts();
                break;

            default:
                console.warn('[FullScreenChordLabEditor] Unknown FAB action:', action);
        }
    }

    _showFABCategoryLabels() {
        const labels = this.tabContent?.querySelectorAll('.fs-fab-label');
        labels?.forEach(label => {
            label.style.opacity = '1';
            setTimeout(() => {
                label.style.opacity = '0';
            }, 1500);
        });
    }

    _closeAllFABSubmenus() {
        const submenus = this.tabContent?.querySelectorAll('.fs-fab-submenu');
        submenus?.forEach(submenu => submenu.classList.add('hidden'));
        this._fabActiveSubmenu = null;
    }

    _toggleFABMenu() {
        const fabMain = this.tabContent?.querySelector('#fs-fab-main');
        if (fabMain) {
            fabMain.click();
        }
    }

    _closeFABMenu() {
        const fabMenu = this.tabContent?.querySelector('#fs-fab-menu');
        const fabQuickButtons = this.tabContent?.querySelector('#fs-fab-quick-buttons');
        const fabIcon = this.tabContent?.querySelector('.fs-fab-icon');

        if (fabMenu && !fabMenu.classList.contains('hidden')) {
            this._fabIsOpen = false;
            fabMenu.classList.add('hidden');
            if (fabIcon) fabIcon.style.transform = 'rotate(0deg)';
            if (fabQuickButtons) fabQuickButtons.classList.remove('hidden');
            this._closeAllFABSubmenus();
        }
    }

    // ========================================================================
    // STORAGE HELPERS
    // ========================================================================

    _loadFromStorage(key, defaultValue) {
        try {
            const stored = localStorage.getItem(key);
            if (stored !== null) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.warn(`[FullScreenChordLabEditor] Failed to load ${key} from storage:`, e);
        }
        return defaultValue;
    }

    _saveToStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn(`[FullScreenChordLabEditor] Failed to save ${key} to storage:`, e);
        }
    }
}

export { FullScreenChordLabEditor };

// ============================================================================
// TAB MODE INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * Initialize the Chord Lab (New) tab
 * Called when switching to the chordlab-new tab
 */
export function initChordLabNewTab() {
    getFullScreenChordLabEditor().openInTabMode();
}

/**
 * Close the Chord Lab (New) tab
 * Called when switching away from the chordlab-new tab
 */
export function closeChordLabNewTab() {
    getFullScreenChordLabEditor().closeTabMode();
}

// ============================================================================
// WINDOW EXPORTS
// ============================================================================

// Expose tab mode functions to window for tabs.js
window.initChordLabNewTab = initChordLabNewTab;
window.closeChordLabNewTab = closeChordLabNewTab;
window.getFullScreenChordLabEditor = getFullScreenChordLabEditor;
