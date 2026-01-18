/**
 * FullScreenScaleExplorer.js - Full-Screen Scale Explorer Experience
 *
 * Provides a full-screen scale exploration experience with:
 * - Full-width virtual keyboard with scale degree highlighting
 * - Collapsible left sidebar with root selection and category filters
 * - Main content area with scale types grid and scale info
 * - Bottom dock with playback controls (Play Asc, Play Desc, Speed, Octave)
 * - FAB menu for quick actions
 *
 * This mirrors the FullScreenChordLabEditor pattern but for scales.
 */

import { getGlobalState, getEnharmonicPreference, setEnharmonicPreference, getCurrentTab } from '../../state/globalState.js';
import {
    getScaleRootIndex,
    setScaleRootIndex,
    getScaleType,
    setScaleType,
    getScaleOctaveShift,
    setScaleOctaveShift,
    getScaleSpeed,
    setScaleSpeed
} from '../../state/scaleState.js';
import { SHARP_NOTES, FLAT_NOTES, SCALE_DEFINITIONS, SCALE_CATEGORIES, ALL_NOTES, ENHARMONIC_MAP } from '../../../data/music-data.js';
import { ARPEGGIO_SPEEDS } from '../../audio/arpeggiator.js';
import { ScaleExplorerBottomPanel } from './ScaleExplorerBottomPanel.js';
import { resolveEnharmonic, getNoteKeyId } from '../../utils/noteUtils.js';
import { getPiano, getInstrument, getAudioIsReady, initAudio, forceStopAllPlayback } from '../../audio/audioEngine.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
    SIDEBAR_COLLAPSED: 'scaleexplorer-new-sidebar',
    LAST_PANEL: 'scaleexplorer-new-panel',
    CATEGORY_FILTER: 'scaleexplorer-new-category',
    DIFFICULTY_FILTER: 'scaleexplorer-new-difficulty',
    TOOLTIPS_ENABLED: 'scaleexplorer-new-tooltips'
};

// ============================================================================
// SINGLETON
// ============================================================================

let instance = null;

/**
 * Get the singleton instance of FullScreenScaleExplorer
 */
export function getFullScreenScaleExplorer() {
    if (!instance) {
        instance = new FullScreenScaleExplorer();
    }
    return instance;
}

// ============================================================================
// FullScreenScaleExplorer CLASS
// ============================================================================

class FullScreenScaleExplorer {
    constructor() {
        this.isTabMode = false;
        this.tabContent = null;
        this.bottomPanel = null;

        // References for keyboard capture/restore
        this.originalKeyboardParent = null;
        this.originalKeyboardNextSibling = null;

        // State
        this.sidebarCollapsed = this._loadFromStorage(STORAGE_KEYS.SIDEBAR_COLLAPSED, false);
        // Category filters - array for multi-select, empty array means "all"
        const storedFilters = this._loadFromStorage(STORAGE_KEYS.CATEGORY_FILTER, []);
        this.categoryFilters = Array.isArray(storedFilters) ? storedFilters : [];
        // Difficulty filters - array for multi-select, empty array means "all"
        const storedDifficultyFilters = this._loadFromStorage(STORAGE_KEYS.DIFFICULTY_FILTER, []);
        this.difficultyFilters = Array.isArray(storedDifficultyFilters) ? storedDifficultyFilters : [];
        this.tooltipsEnabled = this._loadFromStorage(STORAGE_KEYS.TOOLTIPS_ENABLED, true);

        // Event handler bindings
        this._boundKeyHandler = this._handleKeyDown.bind(this);
        this._boundScaleUpdateHandler = this._onScaleUpdate.bind(this);
    }

    // ========================================================================
    // STORAGE HELPERS
    // ========================================================================

    _loadFromStorage(key, defaultValue) {
        try {
            const stored = localStorage.getItem(key);
            if (stored === null) return defaultValue;
            return JSON.parse(stored);
        } catch {
            return defaultValue;
        }
    }

    _saveToStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // Ignore storage errors
        }
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Open the scale explorer in tab mode
     */
    openInTabMode() {
        // If already in tab mode, just re-capture keyboard
        if (this.isTabMode) {
            console.log('[FullScreenScaleExplorer] Already in tab mode, re-capturing keyboard');
            this._captureKeyboard();
            this._syncFromScaleState();
            // Update keyboard labels when re-entering tab
            if (window.updateKeyboardLabels) {
                setTimeout(() => window.updateKeyboardLabels(), 50);
            }
            return;
        }

        const tabContainer = document.getElementById('scaleexplorer-new-container');
        if (!tabContainer) {
            console.error('[FullScreenScaleExplorer] scaleexplorer-new-container not found');
            return;
        }

        // Mark as in tab mode
        this.isTabMode = true;

        // Generate the content HTML
        tabContainer.innerHTML = this._generateTabModeHTML();

        // Get reference to the main content div
        this.tabContent = tabContainer.querySelector('#scaleexplorer-new-content');

        // Capture the keyboard from its original location
        this._captureKeyboard();

        // Apply sidebar state
        this._applySidebarState();

        // Initialize bottom panel
        this.bottomPanel = new ScaleExplorerBottomPanel(this.tabContent, this);
        this.bottomPanel.init();

        // Attach event handlers
        this._attachEventHandlers();

        // Initialize FAB
        this._initFAB();

        // Sync UI from current scale state
        this._syncFromScaleState();

        // Render the scale types grid
        this._renderScaleTypesGrid();

        // Add event listeners
        document.addEventListener('keydown', this._boundKeyHandler);
        window.addEventListener('scaleUpdated', this._boundScaleUpdateHandler);

        // Update keyboard labels (scale degrees) if enabled
        if (window.updateKeyboardLabels) {
            setTimeout(() => window.updateKeyboardLabels(), 50);
        }

        // Initial scale highlighting
        this._highlightScaleNotes();

        console.log('[FullScreenScaleExplorer] Opened in tab mode');
    }

    /**
     * Close the tab mode
     */
    closeTabMode() {
        if (!this.isTabMode) return;

        // Remove event listeners
        document.removeEventListener('keydown', this._boundKeyHandler);
        window.removeEventListener('scaleUpdated', this._boundScaleUpdateHandler);

        // Restore keyboard to original location
        this._restoreKeyboard();

        // Close bottom panel
        this.bottomPanel?.closePanel();

        // Clear tab container
        const tabContainer = document.getElementById('scaleexplorer-new-container');
        if (tabContainer) {
            tabContainer.innerHTML = `
                <div class="flex items-center justify-center h-screen">
                    <div class="text-center">
                        <div class="text-gray-400">Scale Explorer (New) closed</div>
                    </div>
                </div>
            `;
        }

        this.isTabMode = false;
        console.log('[FullScreenScaleExplorer] Closed tab mode');
    }

    // ========================================================================
    // HTML GENERATION
    // ========================================================================

    _generateTabModeHTML() {
        return `
        <div id="scaleexplorer-new-content" class="w-full h-full flex flex-col bg-gray-100 overflow-hidden relative">
            <!-- Keyboard container (FULL WIDTH at top) -->
            <div id="fs-scaleexplorer-keyboard-area" class="w-full px-4 py-2 bg-gray-200 border-b border-gray-300">
                <!-- Keyboard will be moved here -->
            </div>

            <!-- Content area below keyboard: Sidebar + Main - extends to bottom -->
            <div class="flex flex-1 overflow-hidden">
                <!-- Sidebar (narrow, compact) -->
                ${this._generateSidebarHTML()}

                <!-- Main content area -->
                <div class="flex-1 flex flex-col overflow-hidden">
                    <!-- Scale Info Panel (compact, at top) -->
                    <div id="fs-scale-info-panel" class="bg-lime-50 border-b border-lime-200 px-3 py-2 shadow-sm"></div>

                    <!-- Main content area - Shows Scale Types Grid -->
                    <div id="fs-scaleexplorer-main-content" class="flex-1 overflow-y-auto p-2 pb-16 bg-gray-50">
                        <!-- Scale types grid rendered here -->
                        <div id="fs-scale-types-grid"></div>
                    </div>
                </div>
            </div>

            <!-- Floating Bottom dock -->
            <div id="fs-scaleexplorer-bottom-dock" class="absolute left-0 right-0 bottom-4 flex justify-center pointer-events-none z-50">
                <!-- Floating bar rendered here by ScaleExplorerBottomPanel -->
            </div>

            <!-- FAB Menu -->
            ${this._generateFABHTML()}
        </div>
        `;
    }

    _generateSidebarHTML() {
        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootIndex = getScaleRootIndex();

        return `
        <div id="fs-scaleexplorer-sidebar" class="w-52 bg-white border-r border-gray-200 flex flex-col overflow-y-auto text-sm" style="min-width: 200px;">
            <div class="p-2 space-y-2">
                <!-- Root Note -->
                <div class="bg-gray-50 rounded p-2">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-gray-700 font-semibold text-sm">Root</span>
                        <label class="flex items-center gap-0.5 cursor-pointer" title="Sharp/Flat">
                            <span class="${enhPref === 'sharp' ? 'text-lime-600 font-bold' : 'text-gray-400'}">&#9839;</span>
                            <div class="relative">
                                <input type="checkbox" id="fs-scaleexplorer-enharmonic"
                                       ${enhPref === 'flat' ? 'checked' : ''}
                                       onchange="window.fsScaleExplorerToggleEnharmonic && window.fsScaleExplorerToggleEnharmonic(this.checked)"
                                       class="sr-only peer">
                                <div class="w-7 h-3.5 bg-gray-300 peer-checked:bg-lime-500 rounded-full"></div>
                                <div class="absolute top-0.5 left-0.5 w-2.5 h-2.5 bg-white rounded-full transition-transform peer-checked:translate-x-3.5"></div>
                            </div>
                            <span class="${enhPref === 'flat' ? 'text-lime-600 font-bold' : 'text-gray-400'}">&#9837;</span>
                        </label>
                    </div>
                    <div id="fs-scale-root-buttons" class="grid grid-cols-4 gap-1">
                        ${notes.map((note, i) => `
                            <button data-root="${i}"
                                    onclick="window.fsScaleExplorerSelectRoot && window.fsScaleExplorerSelectRoot(${i})"
                                    class="px-1.5 py-1.5 text-xs font-semibold rounded ${i === rootIndex ? 'bg-lime-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'}">
                                ${note}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Category Filters -->
                <div class="bg-gray-50 rounded p-2">
                    <span class="text-gray-700 font-semibold text-sm block mb-1">Category</span>
                    <div id="fs-scale-category-buttons" class="flex flex-wrap gap-1">
                        <button data-category="all"
                                onclick="window.fsScaleExplorerFilterCategory && window.fsScaleExplorerFilterCategory('all')"
                                class="scale-category-btn px-2 py-1 text-[11px] font-medium rounded-lg transition-all ${this.categoryFilters.length === 0 ? 'bg-lime-500 text-white' : 'bg-white text-gray-700 hover:bg-lime-100 border border-gray-200'}">
                            All
                        </button>
                        ${Object.entries(SCALE_CATEGORIES).map(([id, cat]) => `
                            <button data-category="${id}"
                                    onclick="window.fsScaleExplorerFilterCategory && window.fsScaleExplorerFilterCategory('${id}')"
                                    class="scale-category-btn px-2 py-1 text-[11px] font-medium rounded-lg transition-all ${this.categoryFilters.includes(id) ? 'bg-lime-500 text-white' : 'bg-white text-gray-700 hover:bg-lime-100 border border-gray-200'}"
                                    title="${cat.description} (click to toggle)">
                                ${cat.icon} ${cat.name}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Difficulty Filters -->
                <div class="bg-gray-50 rounded p-2">
                    <span class="text-gray-700 font-semibold text-sm block mb-1">Difficulty</span>
                    <div id="fs-scale-difficulty-buttons" class="flex flex-wrap gap-1">
                        <button data-difficulty="all"
                                onclick="window.fsScaleExplorerFilterDifficulty && window.fsScaleExplorerFilterDifficulty('all')"
                                class="scale-difficulty-btn px-2 py-1 text-[11px] font-medium rounded-lg transition-all ${this.difficultyFilters.length === 0 ? 'bg-lime-500 text-white' : 'bg-white text-gray-700 hover:bg-lime-100 border border-gray-200'}">
                            All
                        </button>
                        <button data-difficulty="beginner"
                                onclick="window.fsScaleExplorerFilterDifficulty && window.fsScaleExplorerFilterDifficulty('beginner')"
                                class="scale-difficulty-btn px-2 py-1 text-[11px] font-medium rounded-lg transition-all ${this.difficultyFilters.includes('beginner') ? 'bg-green-500 text-white' : 'bg-white text-gray-700 hover:bg-green-100 border border-gray-200'}"
                                title="Beginner scales (click to toggle)">
                            🟢 Beginner
                        </button>
                        <button data-difficulty="intermediate"
                                onclick="window.fsScaleExplorerFilterDifficulty && window.fsScaleExplorerFilterDifficulty('intermediate')"
                                class="scale-difficulty-btn px-2 py-1 text-[11px] font-medium rounded-lg transition-all ${this.difficultyFilters.includes('intermediate') ? 'bg-yellow-500 text-white' : 'bg-white text-gray-700 hover:bg-yellow-100 border border-gray-200'}"
                                title="Intermediate scales (click to toggle)">
                            🟡 Intermediate
                        </button>
                        <button data-difficulty="advanced"
                                onclick="window.fsScaleExplorerFilterDifficulty && window.fsScaleExplorerFilterDifficulty('advanced')"
                                class="scale-difficulty-btn px-2 py-1 text-[11px] font-medium rounded-lg transition-all ${this.difficultyFilters.includes('advanced') ? 'bg-red-500 text-white' : 'bg-white text-gray-700 hover:bg-red-100 border border-gray-200'}"
                                title="Advanced scales (click to toggle)">
                            🔴 Advanced
                        </button>
                    </div>
                </div>

                <!-- Notes Display -->
                <div class="bg-lime-50 border border-lime-200 rounded p-2">
                    <span class="text-lime-700 font-semibold text-sm block mb-1">Scale Notes</span>
                    <div id="fs-sidebar-scale-notes" class="text-lime-800 text-xs font-mono">
                        C - D - E - F - G - A - B - C
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    _generateFABHTML() {
        return `
        <div id="fs-scaleexplorer-fab" class="fixed bottom-20 right-4 z-50">
            <!-- Quick buttons (visible when FAB menu is closed) -->
            <div id="fs-scale-fab-quick-buttons" class="flex flex-col gap-2 mb-2">
                <!-- Play Ascending (top) -->
                <button onclick="window.fsScaleExplorerPlay && window.fsScaleExplorerPlay('asc')"
                        class="w-12 h-12 bg-lime-600 hover:bg-lime-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
                        title="Play Ascending">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                    </svg>
                </button>
                <!-- Play Descending (bottom) -->
                <button onclick="window.fsScaleExplorerPlay && window.fsScaleExplorerPlay('desc')"
                        class="w-12 h-12 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
                        title="Play Descending">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                </button>
            </div>

            <!-- Main FAB button -->
            <button id="fs-scale-fab-main"
                    class="w-14 h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all active:scale-95"
                    title="Quick Actions">
                <svg class="w-6 h-6 fs-scale-fab-icon transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
            </button>

            <!-- FAB category menu (appears above main FAB) -->
            <div id="fs-scale-fab-menu" class="hidden absolute bottom-16 right-0 flex flex-col-reverse gap-2 mb-2">
                <!-- Playback category -->
                <div class="fs-scale-fab-category relative" data-category="playback">
                    <button class="fs-scale-fab-category-btn w-12 h-12 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-md flex items-center justify-center transition-all active:scale-95" aria-label="Playback">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
                    </button>
                    <span class="fs-scale-fab-label absolute right-14 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 transition-opacity pointer-events-none">Playback</span>
                    <!-- Playback submenu -->
                    <div class="fs-scale-fab-submenu hidden absolute bottom-0 right-14 w-44 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                        <button onclick="window.fsScaleExplorerPlay && window.fsScaleExplorerPlay('asc')" class="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-green-50 flex items-center gap-2 active:bg-green-100">
                            <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                            </svg>
                            <span class="text-green-700 font-medium">Play Ascending</span>
                        </button>
                        <button onclick="window.fsScaleExplorerPlay && window.fsScaleExplorerPlay('desc')" class="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2 active:bg-blue-100">
                            <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                            </svg>
                            <span class="text-blue-700">Play Descending</span>
                        </button>
                        <div class="border-t border-gray-100"></div>
                        <button onclick="window.forceStopAllPlayback && window.forceStopAllPlayback(true)" class="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-red-50 flex items-center gap-2 active:bg-red-100">
                            <svg class="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20"><rect x="6" y="6" width="8" height="8"/></svg>
                            <span class="text-red-700 font-medium">Stop</span>
                        </button>
                    </div>
                </div>

                <!-- Settings category -->
                <div class="fs-scale-fab-category relative" data-category="settings">
                    <button class="fs-scale-fab-category-btn w-12 h-12 bg-gray-600 hover:bg-gray-700 text-white rounded-full shadow-md flex items-center justify-center transition-all active:scale-95" aria-label="Settings">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </button>
                    <span class="fs-scale-fab-label absolute right-14 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 transition-opacity pointer-events-none">Settings</span>
                    <!-- Settings panel -->
                    <div class="fs-scale-fab-submenu hidden absolute right-14 bottom-0 w-56 bg-white rounded-lg shadow-xl border border-gray-200 p-3 z-50">
                        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Playback Settings</div>
                        <!-- Playback Speed -->
                        <div class="flex items-center justify-between mb-3">
                            <label class="text-sm text-gray-700">Speed</label>
                            <div class="flex items-center gap-1">
                                <button id="fs-scale-fab-speed-slower" class="px-2 py-0.5 text-sm font-bold bg-gray-200 rounded hover:bg-gray-300 active:scale-95">-</button>
                                <span id="fs-scale-fab-speed" class="text-xs font-semibold text-gray-700 w-12 text-center">${getScaleSpeed()}</span>
                                <button id="fs-scale-fab-speed-faster" class="px-2 py-0.5 text-sm font-bold bg-gray-200 rounded hover:bg-gray-300 active:scale-95">+</button>
                            </div>
                        </div>
                        <!-- Octave -->
                        <div class="flex items-center justify-between">
                            <label class="text-sm text-gray-700">Octave</label>
                            <div class="flex items-center gap-1">
                                <button id="fs-scale-fab-octave-down" class="px-2 py-0.5 text-sm font-bold bg-gray-200 rounded hover:bg-gray-300 active:scale-95">-</button>
                                <span id="fs-scale-fab-octave" class="text-xs font-semibold text-gray-700 w-6 text-center">${getScaleOctaveShift()}</span>
                                <button id="fs-scale-fab-octave-up" class="px-2 py-0.5 text-sm font-bold bg-gray-200 rounded hover:bg-gray-300 active:scale-95">+</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Help category -->
                <div class="fs-scale-fab-category relative" data-category="help">
                    <button class="fs-scale-fab-category-btn w-12 h-12 bg-gray-500 hover:bg-gray-600 text-white rounded-full shadow-md flex items-center justify-center transition-all active:scale-95" aria-label="Help">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </button>
                    <span class="fs-scale-fab-label absolute right-14 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 transition-opacity pointer-events-none">Help</span>
                    <!-- Help submenu -->
                    <div class="fs-scale-fab-submenu hidden absolute bottom-0 right-14 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                        <button onclick="window.switchTab && window.switchTab('scales')" class="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-green-50 flex items-center gap-2 active:bg-green-100">
                            <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                            <span class="text-green-700 font-medium">Classic View</span>
                        </button>
                        <button onclick="window.showKeyboardShortcuts && window.showKeyboardShortcuts()" class="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-2 active:bg-blue-100">
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
        const keyboardSection = document.getElementById('keyboard-section');
        const pianoKeyboard = document.getElementById('piano-keyboard');

        if (pianoKeyboard) {
            this.originalKeyboardParent = pianoKeyboard.parentElement;
            this.originalKeyboardNextSibling = pianoKeyboard.nextSibling;

            const keyboardArea = this.tabContent?.querySelector('#fs-scaleexplorer-keyboard-area');
            if (keyboardArea) {
                keyboardArea.appendChild(pianoKeyboard);
                // Style for full width
                pianoKeyboard.style.maxWidth = '100%';
                pianoKeyboard.style.width = '100%';
                // Make sure it's visible
                if (keyboardSection) {
                    keyboardSection.classList.add('hidden');
                }
                console.log('[FullScreenScaleExplorer] Keyboard captured');
            }
        } else {
            console.warn('[FullScreenScaleExplorer] Piano keyboard not found');
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
            console.log('[FullScreenScaleExplorer] Keyboard restored');
        }
        this.originalKeyboardParent = null;
        this.originalKeyboardNextSibling = null;
    }

    // ========================================================================
    // SCALE NOTES CALCULATION
    // ========================================================================

    _getScaleNotes(rootNote, scaleType, octaveShift = 0) {
        const scaleDef = SCALE_DEFINITIONS[scaleType];
        if (!scaleDef) return [];

        const baseOctave = 4 + octaveShift;
        let rootIndex = ALL_NOTES.indexOf(rootNote);
        if (rootIndex === -1) rootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[rootNote]);

        const rootAbsoluteSemitone = rootIndex + ((baseOctave - 4) * 12);

        let notes = [];
        for (const step of scaleDef.intervals) {
            const absoluteSemitone = rootAbsoluteSemitone + step;
            const noteIndex = ((absoluteSemitone % 12) + 12) % 12;
            const noteOctave = 4 + Math.floor(absoluteSemitone / 12);
            let noteName = ALL_NOTES[noteIndex] + noteOctave;
            notes.push(resolveEnharmonic(noteName, rootNote, getEnharmonicPreference()));
        }

        // Add octave root
        const octaveRootSemitone = rootAbsoluteSemitone + 12;
        const octaveRootIndex = ((octaveRootSemitone % 12) + 12) % 12;
        const octaveRootOctave = 4 + Math.floor(octaveRootSemitone / 12);
        let octaveRootNote = ALL_NOTES[octaveRootIndex] + octaveRootOctave;
        notes.push(resolveEnharmonic(octaveRootNote, rootNote, getEnharmonicPreference()));

        return notes;
    }

    _highlightScaleNotes() {
        // Clear existing highlights
        if (window.clearHighlights) {
            window.clearHighlights();
        }

        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootNote = notes[getScaleRootIndex()];
        const scaleNotes = this._getScaleNotes(rootNote, getScaleType(), getScaleOctaveShift());

        if (getCurrentTab() !== 'scaleexplorer-new') return;

        scaleNotes.forEach(note => {
            const keyId = getNoteKeyId(note);
            const keyElement = document.getElementById(keyId);
            if (keyElement) keyElement.classList.add('active-scale-explorer');
        });
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    _attachEventHandlers() {
        // Expose methods to window for HTML onclick handlers
        window.fsScaleExplorerToggleSidebar = () => this._toggleSidebar();
        window.fsScaleExplorerToggleEnharmonic = (isFlat) => this._toggleEnharmonic(isFlat);
        window.fsScaleExplorerSelectRoot = (index) => this._selectRoot(index);
        window.fsScaleExplorerSelectScale = (type) => this._selectScale(type);
        window.fsScaleExplorerFilterCategory = (category) => this._filterCategory(category);
        window.fsScaleExplorerFilterDifficulty = (difficulty) => this._filterDifficulty(difficulty);
        window.fsScaleExplorerChangeOctave = (amount) => this._changeOctave(amount);
        window.fsScaleExplorerChangeSpeed = (direction) => this._changeSpeed(direction);
        window.fsScaleExplorerPlay = (direction) => this._playScale(direction);
        window.fsScaleExplorerToggleFABMenu = () => this._toggleFABMenu();
        window.fsScaleExplorerCloseFABMenu = () => this._closeFABMenu();
    }

    _handleKeyDown(event) {
        // Escape closes FAB menu
        if (event.key === 'Escape') {
            this._closeFABMenu();
        }
    }

    _onScaleUpdate() {
        this._syncFromScaleState();
        this._highlightScaleNotes();
    }

    // ========================================================================
    // UI ACTIONS
    // ========================================================================

    _selectRoot(index) {
        setScaleRootIndex(index);
        window.scaleRootIndex = index;
        this._syncFromScaleState();
        this._renderScaleTypesGrid();
        this._highlightScaleNotes();
        // Update keyboard labels
        if (window.updateKeyboardLabels) {
            setTimeout(() => window.updateKeyboardLabels(), 10);
        }
    }

    _selectScale(type) {
        setScaleType(type);
        this._syncFromScaleState();
        this._renderScaleTypesGrid();
        this._highlightScaleNotes();
        this._updateScaleInfoPanel();
    }

    _filterCategory(category) {
        if (category === 'all') {
            // Clear all filters - show all scales
            this.categoryFilters = [];
        } else {
            // Toggle the category in the array
            const index = this.categoryFilters.indexOf(category);
            if (index === -1) {
                // Add category
                this.categoryFilters.push(category);
            } else {
                // Remove category
                this.categoryFilters.splice(index, 1);
            }
        }
        this._saveToStorage(STORAGE_KEYS.CATEGORY_FILTER, this.categoryFilters);
        this._updateCategoryButtons();
        this._renderScaleTypesGrid();
    }

    _filterDifficulty(difficulty) {
        if (difficulty === 'all') {
            // Clear all filters - show all difficulties
            this.difficultyFilters = [];
        } else {
            // Toggle the difficulty in the array
            const index = this.difficultyFilters.indexOf(difficulty);
            if (index === -1) {
                // Add difficulty
                this.difficultyFilters.push(difficulty);
            } else {
                // Remove difficulty
                this.difficultyFilters.splice(index, 1);
            }
        }
        this._saveToStorage(STORAGE_KEYS.DIFFICULTY_FILTER, this.difficultyFilters);
        this._updateDifficultyButtons();
        this._renderScaleTypesGrid();
    }

    _updateDifficultyButtons() {
        const container = this.tabContent?.querySelector('#fs-scale-difficulty-buttons');
        if (!container) return;

        container.querySelectorAll('.scale-difficulty-btn').forEach(btn => {
            const difficulty = btn.dataset.difficulty;
            if (difficulty === 'all') {
                if (this.difficultyFilters.length === 0) {
                    btn.className = 'scale-difficulty-btn px-2 py-1 text-[11px] font-medium rounded-lg transition-all bg-lime-500 text-white';
                } else {
                    btn.className = 'scale-difficulty-btn px-2 py-1 text-[11px] font-medium rounded-lg transition-all bg-white text-gray-700 hover:bg-lime-100 border border-gray-200';
                }
            } else {
                const isActive = this.difficultyFilters.includes(difficulty);
                const colorMap = {
                    'beginner': isActive ? 'bg-green-500 text-white' : 'bg-white text-gray-700 hover:bg-green-100 border border-gray-200',
                    'intermediate': isActive ? 'bg-yellow-500 text-white' : 'bg-white text-gray-700 hover:bg-yellow-100 border border-gray-200',
                    'advanced': isActive ? 'bg-red-500 text-white' : 'bg-white text-gray-700 hover:bg-red-100 border border-gray-200'
                };
                btn.className = `scale-difficulty-btn px-2 py-1 text-[11px] font-medium rounded-lg transition-all ${colorMap[difficulty] || ''}`;
            }
        });
    }

    _changeOctave(amount) {
        let newShift = getScaleOctaveShift() + amount;
        if (newShift < -3 || newShift > 3) return;
        setScaleOctaveShift(newShift);
        this._syncFromScaleState();
        this._highlightScaleNotes();
    }

    _changeSpeed(direction) {
        const speedLabels = Object.keys(ARPEGGIO_SPEEDS);
        let currentIndex = speedLabels.indexOf(getScaleSpeed());

        if (direction === 'faster') {
            currentIndex = Math.min(speedLabels.length - 1, currentIndex + 1);
        } else {
            currentIndex = Math.max(0, currentIndex - 1);
        }
        setScaleSpeed(speedLabels[currentIndex]);
        this._syncFromScaleState();
    }

    _playScale(direction = 'asc') {
        initAudio();
        if (!getAudioIsReady()) return;

        forceStopAllPlayback();

        // Ensure Transport is fully stopped and reset
        Tone.Transport.stop();
        Tone.Transport.cancel();
        Tone.Transport.position = 0;

        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootNote = notes[getScaleRootIndex()];
        const scaleNotes = this._getScaleNotes(rootNote, getScaleType(), getScaleOctaveShift());

        if (direction === 'desc') {
            scaleNotes.reverse();
        }

        this._highlightScaleNotes();

        const speedValue = ARPEGGIO_SPEEDS[getScaleSpeed()];
        const noteDurationSeconds = Tone.Time(speedValue).toSeconds();

        const scalePlaySequence = new Tone.Sequence((time, note) => {
            const instrument = getInstrument();
            if (instrument) {
                instrument.triggerAttackRelease(note, speedValue, time);
            }
            Tone.Draw.schedule(() => {
                const keyEl = document.getElementById(getNoteKeyId(note));
                if (keyEl) keyEl.classList.add('active-scale-playback');
            }, time);
            Tone.Draw.schedule(() => {
                const keyEl = document.getElementById(getNoteKeyId(note));
                if (keyEl) keyEl.classList.remove('active-scale-playback');
            }, time + noteDurationSeconds * 0.9);
        }, scaleNotes, speedValue).start(0);

        // Store sequence globally so forceStopAllPlayback can clean it up
        window.scalePlaySequence = scalePlaySequence;

        Tone.Transport.start();

        Tone.Transport.scheduleOnce(time => {
            scalePlaySequence.stop().dispose();
            window.scalePlaySequence = null;
            Tone.Transport.stop();
            Tone.Draw.schedule(() => {
                this._highlightScaleNotes();
            }, time);
        }, scaleNotes.length * noteDurationSeconds);
    }

    _toggleEnharmonic(isFlat) {
        setEnharmonicPreference(isFlat ? 'flat' : 'sharp');
        this._syncFromScaleState();
        this._renderScaleTypesGrid();
        this._highlightScaleNotes();
        if (window.updateKeyboardLabels) {
            setTimeout(() => window.updateKeyboardLabels(), 10);
        }
    }

    _toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        this._saveToStorage(STORAGE_KEYS.SIDEBAR_COLLAPSED, this.sidebarCollapsed);
        this._applySidebarState();
    }

    // ========================================================================
    // UI UPDATES
    // ========================================================================

    _syncFromScaleState() {
        if (!this.tabContent) return;

        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootIndex = getScaleRootIndex();
        const scaleType = getScaleType();
        const octaveShift = getScaleOctaveShift();
        const speed = getScaleSpeed();
        const rootNote = notes[rootIndex];

        // Update root buttons
        const rootButtons = this.tabContent.querySelectorAll('#fs-scale-root-buttons button');
        rootButtons.forEach((btn, i) => {
            btn.textContent = notes[i];
            btn.className = 'px-1.5 py-1.5 text-xs font-semibold rounded';
            if (i === rootIndex) {
                btn.classList.add('bg-lime-500', 'text-white');
            } else {
                btn.classList.add('bg-white', 'text-gray-700', 'hover:bg-gray-100', 'border', 'border-gray-200');
            }
        });

        // Update octave display
        const octaveDisplay = this.tabContent.querySelector('#fs-scale-octave');
        if (octaveDisplay) octaveDisplay.textContent = octaveShift >= 0 ? `+${octaveShift}` : octaveShift;

        // Update speed display
        const speedDisplay = this.tabContent.querySelector('#fs-scale-speed');
        if (speedDisplay) speedDisplay.textContent = speed;

        // Update FAB speed/octave displays
        const fabSpeedDisplay = this.tabContent.querySelector('#fs-scale-fab-speed');
        if (fabSpeedDisplay) fabSpeedDisplay.textContent = speed;
        const fabOctaveDisplay = this.tabContent.querySelector('#fs-scale-fab-octave');
        if (fabOctaveDisplay) fabOctaveDisplay.textContent = octaveShift;

        // Update bottom panel speed/octave displays
        const bottomSpeedDisplay = this.tabContent.querySelector('#fs-bottom-speed-display');
        if (bottomSpeedDisplay) bottomSpeedDisplay.textContent = speed;
        const bottomOctaveDisplay = this.tabContent.querySelector('#fs-bottom-octave-display');
        if (bottomOctaveDisplay) bottomOctaveDisplay.textContent = octaveShift;

        // Update bottom panel scale name
        const bottomScaleName = this.tabContent.querySelector('#fs-bottom-scale-name');
        if (bottomScaleName) bottomScaleName.textContent = `${rootNote} ${scaleType}`;

        // Update scale display
        const scaleNotes = this._getScaleNotes(rootNote, scaleType, octaveShift);

        const nameEl = this.tabContent.querySelector('#fs-current-scale-name');
        const notesEl = this.tabContent.querySelector('#fs-current-scale-notes');
        const sidebarNotesEl = this.tabContent.querySelector('#fs-sidebar-scale-notes');

        if (nameEl) nameEl.textContent = `${rootNote} ${scaleType}`;
        if (notesEl) notesEl.textContent = scaleNotes.join(' - ');
        if (sidebarNotesEl) sidebarNotesEl.textContent = scaleNotes.join(' - ');

        // Update enharmonic toggle
        const enhToggle = this.tabContent.querySelector('#fs-scaleexplorer-enharmonic');
        if (enhToggle) enhToggle.checked = enhPref === 'flat';
    }

    _updateCategoryButtons() {
        const buttons = this.tabContent?.querySelectorAll('#fs-scale-category-buttons button');
        if (!buttons) return;

        buttons.forEach(btn => {
            const category = btn.dataset.category;
            btn.className = 'scale-category-btn px-2 py-1 text-[11px] font-medium rounded-lg transition-all';
            const isSelected = category === 'all'
                ? this.categoryFilters.length === 0
                : this.categoryFilters.includes(category);
            if (isSelected) {
                btn.classList.add('bg-lime-500', 'text-white');
            } else {
                btn.classList.add('bg-white', 'text-gray-700', 'hover:bg-lime-100', 'border', 'border-gray-200');
            }
        });
    }

    _renderScaleTypesGrid() {
        const grid = this.tabContent?.querySelector('#fs-scale-types-grid');
        if (!grid) return;

        const currentScaleType = getScaleType();

        // Group scales by category
        const groupedScales = {};
        Object.entries(SCALE_DEFINITIONS).forEach(([type, scale]) => {
            // If category filters are set, only include scales from selected categories
            if (this.categoryFilters.length > 0 && !this.categoryFilters.includes(scale.category)) return;

            // If difficulty filters are set, only include scales with selected difficulties
            if (this.difficultyFilters.length > 0 && !this.difficultyFilters.includes(scale.difficulty)) return;

            const category = scale.category || 'other';
            if (!groupedScales[category]) {
                groupedScales[category] = [];
            }
            groupedScales[category].push({ type, scale });
        });

        let html = '<div class="space-y-2">';

        // Render by category - compact chip style
        Object.entries(groupedScales).forEach(([categoryId, scales]) => {
            const categoryInfo = SCALE_CATEGORIES[categoryId] || { name: categoryId, icon: '🎵' };

            html += `
                <div class="bg-white rounded-lg shadow-sm p-2.5">
                    <div class="flex items-center gap-1.5 mb-2">
                        <span class="text-sm">${categoryInfo.icon}</span>
                        <span class="text-gray-600 text-xs font-semibold uppercase tracking-wide">${categoryInfo.name}</span>
                    </div>
                    <div class="flex flex-wrap gap-1.5">
            `;

            scales.forEach(({ type, scale }) => {
                const isSelected = type === currentScaleType;
                const selectedClass = isSelected
                    ? 'bg-lime-500 text-white border-lime-600'
                    : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-lime-100 hover:border-lime-300';

                html += `
                    <button onclick="window.fsScaleExplorerSelectScale && window.fsScaleExplorerSelectScale('${type}')"
                            class="px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${selectedClass}"
                            title="${scale.description || type}">
                        ${type}
                    </button>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        html += '</div>';
        grid.innerHTML = html;

        // Update info panel for selected scale
        this._updateScaleInfoPanel();
    }

    _getDifficultyBadge(difficulty) {
        const badges = {
            'beginner': '<span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded font-medium">Beginner</span>',
            'intermediate': '<span class="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded font-medium">Intermediate</span>',
            'advanced': '<span class="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-medium">Advanced</span>'
        };
        return badges[difficulty] || '';
    }

    _updateScaleInfoPanel() {
        const infoPanel = this.tabContent?.querySelector('#fs-scale-info-panel');
        if (!infoPanel) return;

        const currentType = getScaleType();
        const scale = SCALE_DEFINITIONS[currentType];
        if (!scale) return;

        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootNote = notes[getScaleRootIndex()];
        const scaleNotes = this._getScaleNotes(rootNote, currentType, getScaleOctaveShift());

        // Compact horizontal info bar with larger fonts
        infoPanel.innerHTML = `
            <div class="flex items-center gap-3 flex-wrap">
                <span class="font-bold text-lime-800 text-lg">${rootNote} ${currentType}</span>
                ${this._getDifficultyBadge(scale.difficulty)}
                <span class="text-gray-500 text-sm">|</span>
                <span class="text-gray-600 text-sm font-mono">${scaleNotes.map(n => n.slice(0, -1)).join(' - ')}</span>
                ${scale.description ? `
                    <span class="text-gray-500 text-sm">|</span>
                    <span class="text-gray-500 text-sm italic truncate max-w-md">${scale.description}</span>
                ` : ''}
                ${scale.aliases && scale.aliases.length ? `
                    <span class="text-gray-400 text-xs">(${scale.aliases[0]})</span>
                ` : ''}
            </div>
        `;
    }

    _applySidebarState() {
        const sidebar = this.tabContent?.querySelector('#fs-scaleexplorer-sidebar');
        if (sidebar) {
            if (this.sidebarCollapsed) {
                sidebar.classList.add('w-0', 'min-w-0', 'overflow-hidden', 'p-0');
                sidebar.classList.remove('w-52');
            } else {
                sidebar.classList.remove('w-0', 'min-w-0', 'overflow-hidden', 'p-0');
                sidebar.classList.add('w-52');
            }
        }
    }

    // ========================================================================
    // FAB MENU
    // ========================================================================

    _initFAB() {
        const mainBtn = this.tabContent?.querySelector('#fs-scale-fab-main');
        const menu = this.tabContent?.querySelector('#fs-scale-fab-menu');
        const quickButtons = this.tabContent?.querySelector('#fs-scale-fab-quick-buttons');

        if (!mainBtn || !menu) return;

        // Main FAB button click - toggle menu
        mainBtn.addEventListener('click', () => this._toggleFABMenu());

        // Category button hover shows submenu
        const categoryBtns = menu.querySelectorAll('.fs-scale-fab-category-btn');
        categoryBtns.forEach(btn => {
            const category = btn.closest('.fs-scale-fab-category');
            const submenu = category?.querySelector('.fs-scale-fab-submenu');
            const label = category?.querySelector('.fs-scale-fab-label');

            btn.addEventListener('mouseenter', () => {
                if (label) label.classList.add('opacity-100');
            });
            btn.addEventListener('mouseleave', () => {
                if (label) label.classList.remove('opacity-100');
            });
            btn.addEventListener('click', () => {
                // Toggle submenu
                if (submenu) {
                    const isVisible = !submenu.classList.contains('hidden');
                    // Hide all submenus first
                    menu.querySelectorAll('.fs-scale-fab-submenu').forEach(sm => sm.classList.add('hidden'));
                    // Show this one if it wasn't visible
                    if (!isVisible) {
                        submenu.classList.remove('hidden');
                    }
                }
            });
        });

        // FAB speed buttons
        const speedSlower = this.tabContent.querySelector('#fs-scale-fab-speed-slower');
        const speedFaster = this.tabContent.querySelector('#fs-scale-fab-speed-faster');
        if (speedSlower) speedSlower.addEventListener('click', () => this._changeSpeed('slower'));
        if (speedFaster) speedFaster.addEventListener('click', () => this._changeSpeed('faster'));

        // FAB octave buttons
        const octaveDown = this.tabContent.querySelector('#fs-scale-fab-octave-down');
        const octaveUp = this.tabContent.querySelector('#fs-scale-fab-octave-up');
        if (octaveDown) octaveDown.addEventListener('click', () => this._changeOctave(-1));
        if (octaveUp) octaveUp.addEventListener('click', () => this._changeOctave(1));
    }

    _toggleFABMenu() {
        const menu = this.tabContent?.querySelector('#fs-scale-fab-menu');
        const quickButtons = this.tabContent?.querySelector('#fs-scale-fab-quick-buttons');
        const mainBtn = this.tabContent?.querySelector('#fs-scale-fab-main');
        const icon = mainBtn?.querySelector('.fs-scale-fab-icon');

        if (!menu) return;

        const isOpen = !menu.classList.contains('hidden');

        if (isOpen) {
            // Close menu
            menu.classList.add('hidden');
            menu.querySelectorAll('.fs-scale-fab-submenu').forEach(sm => sm.classList.add('hidden'));
            if (quickButtons) quickButtons.classList.remove('hidden');
            if (icon) icon.style.transform = '';
        } else {
            // Open menu
            menu.classList.remove('hidden');
            if (quickButtons) quickButtons.classList.add('hidden');
            if (icon) icon.style.transform = 'rotate(45deg)';
        }
    }

    _closeFABMenu() {
        const menu = this.tabContent?.querySelector('#fs-scale-fab-menu');
        const quickButtons = this.tabContent?.querySelector('#fs-scale-fab-quick-buttons');
        const mainBtn = this.tabContent?.querySelector('#fs-scale-fab-main');
        const icon = mainBtn?.querySelector('.fs-scale-fab-icon');

        if (menu && !menu.classList.contains('hidden')) {
            menu.classList.add('hidden');
            menu.querySelectorAll('.fs-scale-fab-submenu').forEach(sm => sm.classList.add('hidden'));
            if (quickButtons) quickButtons.classList.remove('hidden');
            if (icon) icon.style.transform = '';
        }
    }
}

// ============================================================================
// TAB MODE EXPORTS
// ============================================================================

/**
 * Initialize the Scale Explorer (New) tab
 * Called when switching to the scaleexplorer-new tab
 */
export function initScaleExplorerNewTab() {
    getFullScreenScaleExplorer().openInTabMode();
}

/**
 * Close the Scale Explorer (New) tab
 * Called when switching away from the scaleexplorer-new tab
 */
export function closeScaleExplorerNewTab() {
    getFullScreenScaleExplorer().closeTabMode();
}

// Expose tab mode functions to window for tabs.js
window.initScaleExplorerNewTab = initScaleExplorerNewTab;
window.closeScaleExplorerNewTab = closeScaleExplorerNewTab;
window.getFullScreenScaleExplorer = getFullScreenScaleExplorer;
