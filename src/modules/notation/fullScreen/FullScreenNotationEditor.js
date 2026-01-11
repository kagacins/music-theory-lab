/**
 * FullScreenNotationEditor.js - Full-Screen Notation Editing Mode
 *
 * Provides a full-screen notation editing experience similar to traditional
 * music notation software, while preserving all unique Music Theory Lab features
 * (chord brackets, measure coloring, chord labels, isolated measure modal, etc.).
 *
 * Key features:
 * - Full-screen modal overlay with larger notation display
 * - Collapsible left sidebar with vertical toolbar
 * - Zoom controls (−/+, fit-width, Ctrl+wheel)
 * - Continuous vertical scroll through all pages
 * - Configurable measures per system
 * - All existing features preserved (brackets, coloring, labels)
 *
 * Architecture:
 * - Uses existing NotationComposer and PageManager infrastructure
 * - Clones/moves canvases into full-screen container
 * - Restores original layout when closing
 */

import { getCompositionState } from '../../state/compositionState.js';
import { getGlobalState } from '../../state/globalState.js';

// Force clear any existing singleton on module reload (for HMR)
if (typeof window !== 'undefined') {
    const existingModal = document.getElementById('fullscreen-notation-modal');
    if (existingModal) {
        existingModal.remove();
    }
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
    ZOOM: 'fullscreen-notation-zoom',
    SIDEBAR: 'fullscreen-notation-sidebar',
    MEASURES_PER_SYSTEM: 'fullscreen-notation-measures-per-system',
    BOTTOM_PANEL: 'fullscreen-notation-bottom-panel',
    FS_VIEW_MODE: 'fullscreen-notation-view-mode'
};

const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

const DEFAULT_MEASURES_PER_SYSTEM = 4;
const MEASURES_PER_SYSTEM_OPTIONS = [2, 3, 4, 5, 6];

// ============================================================================
// FullScreenNotationEditor CLASS
// ============================================================================

export class FullScreenNotationEditor {
    constructor() {
        this.modal = null;
        this.isOpen = false;

        // State
        this.zoomLevel = this._loadFromStorage(STORAGE_KEYS.ZOOM, DEFAULT_ZOOM);
        this.sidebarOpen = this._loadFromStorage(STORAGE_KEYS.SIDEBAR, true);
        this.measuresPerSystem = this._loadFromStorage(STORAGE_KEYS.MEASURES_PER_SYSTEM, DEFAULT_MEASURES_PER_SYSTEM);
        this.bottomPanelOpen = this._loadFromStorage(STORAGE_KEYS.BOTTOM_PANEL, true);
        this.fullscreenViewMode = this._loadFromStorage(STORAGE_KEYS.FS_VIEW_MODE, 'scroll');

        // Selected sections for section view mode
        this.selectedFsSectionIds = new Set();

        // References to original elements (for restoration)
        this.originalPagesContainer = null;
        this.originalToolbarContainer = null;

        // Event handler bindings
        this._boundKeyHandler = this._handleKeyDown.bind(this);
        this._boundWheelHandler = this._handleWheel.bind(this);
        this._boundProgressionUpdateHandler = this._onProgressionUpdate.bind(this);

        // Original PageManager method reference (for patching)
        this._originalGetPageFromEvent = null;

        // Create modal on instantiation
        this._createModal();
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Open the full-screen notation editor
     */
    open() {
        if (this.isOpen) return;

        // Get composition state for header info
        const compState = getCompositionState();
        const settings = compState?.getSettings() || {};

        // Update header info
        this._updateHeaderInfo(settings);

        // Move notation canvases into full-screen container
        this._captureNotationElements();

        // Apply current zoom
        this._applyZoom();

        // Apply sidebar state
        this._applySidebarState();

        // Apply bottom panel state
        this._applyBottomPanelState();

        // Render chord progression in bottom panel
        this._renderChordProgression();

        // Patch PageManager for zoom-aware coordinates
        this._patchPageManagerForZoom();

        // Set up selection change listener for sidebar sync
        this._setupSelectionListener();

        // Initialize sidebar from current toolbar state
        this._initializeSidebarFromToolbar();

        // Show modal
        this.modal.classList.remove('hidden');
        this.isOpen = true;

        // Add event listeners
        document.addEventListener('keydown', this._boundKeyHandler);
        this.modal.addEventListener('wheel', this._boundWheelHandler, { passive: false });

        // Listen for progression updates to re-render chord cards
        window.addEventListener('progressionUpdated', this._boundProgressionUpdateHandler);
        window.addEventListener('chordsChanged', this._boundProgressionUpdateHandler);

        // Focus the modal for keyboard events
        this.modal.focus();
    }

    /**
     * Close the full-screen notation editor
     */
    close() {
        if (!this.isOpen) return;

        // Remove event listeners
        document.removeEventListener('keydown', this._boundKeyHandler);
        this.modal.removeEventListener('wheel', this._boundWheelHandler);

        // Remove progression update listeners
        window.removeEventListener('progressionUpdated', this._boundProgressionUpdateHandler);
        window.removeEventListener('chordsChanged', this._boundProgressionUpdateHandler);

        // Remove selection change listener
        this._removeSelectionListener();

        // Restore PageManager to original state
        this._restorePageManager();

        // Restore notation elements to original location
        this._restoreNotationElements();

        // Hide modal
        this.modal.classList.add('hidden');
        this.isOpen = false;
    }

    /**
     * Toggle full-screen mode
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    // ========================================================================
    // MODAL CREATION
    // ========================================================================

    /**
     * Create the modal DOM structure
     */
    _createModal() {
        // Remove existing modal if present
        const existing = document.getElementById('fullscreen-notation-modal');
        if (existing) {
            existing.remove();
        }

        this.modal = document.createElement('div');
        this.modal.id = 'fullscreen-notation-modal';
        this.modal.className = 'fixed inset-0 bg-black/60 hidden z-[99999] flex flex-col';
        this.modal.tabIndex = -1; // Make focusable for keyboard events

        this.modal.innerHTML = `
            <!-- Header Bar -->
            <div class="fullscreen-header h-12 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-between px-4 shadow-lg flex-shrink-0">
                <!-- Left: Sidebar Toggle + Title -->
                <div class="flex items-center gap-3">
                    <!-- Sidebar Toggle Button -->
                    <button id="fullscreen-sidebar-toggle"
                            class="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                            title="Toggle Sidebar (Ctrl+\\)">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                        </svg>
                    </button>

                    <!-- Title/Composer (clickable to edit) -->
                    <div id="fs-title-composer" class="cursor-pointer hover:bg-white/10 rounded px-2 py-0.5 transition-colors flex items-center gap-3"
                         title="Click to edit title and composer">
                        <h2 id="fs-composition-title" class="text-lg font-semibold leading-tight"
                            style="color: #ffffff !important; -webkit-text-fill-color: #ffffff !important;">
                            Untitled Composition
                        </h2>
                        <span id="fs-composition-composer" class="text-sm italic hidden"
                           style="color: rgba(255,255,255,0.7) !important; -webkit-text-fill-color: rgba(255,255,255,0.7) !important;">
                        </span>
                        <svg class="w-3.5 h-3.5 text-white/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                        </svg>
                    </div>

                    <!-- Key/Time Signature Badge -->
                    <div id="fullscreen-key-time-badge" class="px-2 py-1 bg-white/20 rounded text-sm font-medium"
                         style="color: #ffffff !important; -webkit-text-fill-color: #ffffff !important;">
                        C Major • 4/4
                    </div>
                </div>

                <!-- Center: Measures Per System Dropdown -->
                <div class="flex items-center gap-2">
                    <label class="text-sm text-white/80" style="-webkit-text-fill-color: rgba(255,255,255,0.8) !important;">
                        Measures/Row:
                    </label>
                    <select id="fullscreen-measures-dropdown"
                            class="px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-sm text-white border-none focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
                            style="color: #ffffff !important; -webkit-text-fill-color: #ffffff !important;">
                        ${MEASURES_PER_SYSTEM_OPTIONS.map(n =>
                            `<option value="${n}" ${n === this.measuresPerSystem ? 'selected' : ''} style="color: #333; -webkit-text-fill-color: #333;">${n}</option>`
                        ).join('')}
                    </select>
                </div>

                <!-- Right: Zoom Controls + Close -->
                <div class="flex items-center gap-2">
                    <!-- Zoom Controls -->
                    <div class="flex items-center gap-1 bg-white/20 rounded-lg px-2 py-1">
                        <button id="fullscreen-zoom-out"
                                class="p-1 hover:bg-white/20 rounded transition-colors"
                                title="Zoom Out (Ctrl+-)">
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
                            </svg>
                        </button>
                        <span id="fullscreen-zoom-level" class="text-sm font-medium min-w-[3rem] text-center"
                              style="color: #ffffff !important; -webkit-text-fill-color: #ffffff !important;">
                            ${this.zoomLevel}%
                        </span>
                        <button id="fullscreen-zoom-in"
                                class="p-1 hover:bg-white/20 rounded transition-colors"
                                title="Zoom In (Ctrl++)">
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                            </svg>
                        </button>
                        <div class="w-px h-4 bg-white/30 mx-1"></div>
                        <button id="fullscreen-fit-width"
                                class="p-1 hover:bg-white/20 rounded transition-colors"
                                title="Fit to Width">
                            <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
                            </svg>
                        </button>
                    </div>

                    <!-- Close Button -->
                    <button id="fullscreen-close-btn"
                            class="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                            title="Close Full-Screen">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Main Content Area -->
            <div class="flex-1 flex overflow-hidden">
                <!-- Left Sidebar (Collapsible to thin strip) - spans full height -->
                <div id="fullscreen-sidebar"
                     class="fullscreen-sidebar ${this.sidebarOpen ? 'w-64' : 'w-6'} h-full bg-gray-50 border-r border-gray-200 flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out overflow-hidden">

                    <!-- Toggle Strip (visible when collapsed) -->
                    <div class="sidebar-toggle-strip ${this.sidebarOpen ? 'hidden' : ''} w-full h-full flex flex-col items-center py-3 bg-gradient-to-b from-indigo-100 to-gray-100 cursor-pointer hover:from-indigo-200 hover:to-gray-200 border-r border-gray-300"
                         title="Click to expand Notation Tools">
                        <!-- Expand Arrow -->
                        <button class="sidebar-expand-btn p-1.5 rounded-full bg-indigo-500 hover:bg-indigo-600 shadow-md mb-2">
                            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                            </svg>
                        </button>
                        <!-- Vertical "Tools" label -->
                        <div class="flex-1 flex items-center justify-center">
                            <span class="text-[10px] font-semibold text-indigo-700 tracking-wider" style="writing-mode: vertical-rl; text-orientation: mixed; -webkit-text-fill-color: #4338ca;">
                                TOOLS
                            </span>
                        </div>
                        <!-- Music note icon at bottom -->
                        <svg class="w-4 h-4 text-indigo-500 mt-2" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/>
                        </svg>
                    </div>

                    <!-- Sidebar Content (hidden when collapsed) -->
                    <div class="sidebar-content flex flex-col h-full w-full overflow-hidden ${this.sidebarOpen ? '' : 'hidden'}">
                        <!-- Collapse Button Header -->
                        <div class="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-gray-100 border-b border-gray-200">
                            <span class="text-sm font-semibold text-gray-700">Notation Tools</span>
                            <button class="sidebar-collapse-btn p-1 rounded hover:bg-gray-200 transition-colors" title="Collapse Sidebar">
                                <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                                </svg>
                            </button>
                        </div>

                        <!-- PINNED Section (sticky at top) -->
                        <div class="flex-shrink-0 p-3 pb-0 bg-gray-50 space-y-2">
                        <!-- Jump to Section (compact, inline) -->
                        <div class="flex items-center gap-2 p-2 bg-gradient-to-r from-indigo-50 to-slate-50 rounded-lg border border-indigo-200">
                            <label class="text-xs text-indigo-600 font-medium whitespace-nowrap">Jump to:</label>
                            <select id="fs-section-jump" class="flex-1 p-1.5 rounded bg-white border border-slate-200 hover:border-indigo-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-xs shadow-sm" title="Quickly navigate to a section">
                                <option value="">-- Select --</option>
                                <option value="fs-section-accidentals">Accidentals</option>
                                <option value="fs-section-articulations">Articulations</option>
                                <option value="fs-section-dynamics">Dynamics</option>
                                <option value="fs-section-ornaments">Ornaments</option>
                                <option value="fs-section-tuplets">Tuplets</option>
                                <option value="fs-section-beams">Beams</option>
                                <option value="fs-section-slurs">Slurs & Ties</option>
                                <option value="fs-section-hairpins">Hairpins</option>
                                <option value="fs-section-grace">Grace Notes</option>
                                <option value="fs-section-repeat">Repeat Signs</option>
                                <option value="fs-section-endings">Endings</option>
                                <option value="fs-section-chord">Chord Labels</option>
                                <option value="fs-section-lyrics">Lyrics</option>
                                <option value="fs-section-pedal">Pedal</option>
                                <option value="fs-section-voicing">Voicing</option>
                                <option value="fs-section-actions">Quick Actions</option>
                            </select>
                        </div>
                        <!-- Duration Section -->
                        <div class="sidebar-section bg-indigo-50 rounded-lg border border-indigo-200 shadow-md">
                            <div class="flex items-center justify-between p-2 border-b border-indigo-200">
                                <span class="font-semibold text-indigo-800 text-sm">Duration</span>
                                <span class="text-xs text-indigo-500 flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clip-rule="evenodd"/></svg>
                                    pinned
                                </span>
                            </div>
                            <div class="p-2 space-y-1.5">
                                <div class="grid grid-cols-3 gap-1">
                                    <button class="fs-duration-btn px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-400 transition-colors text-lg shadow-sm leading-tight focus:outline-none" data-duration="1n" title="Whole note (4 beats)">𝅝</button>
                                    <button class="fs-duration-btn px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-400 transition-colors text-lg shadow-sm leading-tight focus:outline-none" data-duration="2n" title="Half note (2 beats)">𝅗𝅥</button>
                                    <button class="fs-duration-btn px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-400 transition-colors text-lg shadow-sm leading-tight focus:outline-none" data-duration="4n" title="Quarter note (1 beat)">♩</button>
                                    <button class="fs-duration-btn px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-400 transition-colors text-lg shadow-sm leading-tight focus:outline-none" data-duration="8n" title="Eighth note (1/2 beat)">♪</button>
                                    <button class="fs-duration-btn px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-400 transition-colors text-lg shadow-sm leading-tight focus:outline-none" data-duration="16n" title="16th note (1/4 beat)">𝅘𝅥𝅯</button>
                                    <button class="fs-duration-btn px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-400 transition-colors text-lg shadow-sm leading-tight focus:outline-none" data-duration="32n" title="32nd note (1/8 beat)">𝅘𝅥𝅰</button>
                                </div>
                                <div class="flex gap-1">
                                    <button class="fs-dot-btn flex-1 px-2 py-1.5 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-400 transition-colors text-xs shadow-sm focus:outline-none" title="Dotted note (+50% duration)">• Dot</button>
                                    <button class="fs-rest-btn flex-1 px-2 py-1.5 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-400 transition-colors text-xs shadow-sm focus:outline-none" title="Rest mode">𝄽 Rest</button>
                                </div>
                                <!-- Current duration indicator -->
                                <div id="fs-duration-indicator" class="text-center text-xs text-indigo-600 font-medium py-1 bg-indigo-100 rounded">
                                    Current: Quarter Note (1 beat)
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Scrollable section for other tools -->
                    <div class="flex-1 min-h-0 overflow-y-auto p-3 pt-3">
                        <div id="fullscreen-sidebar-content" class="space-y-3">
                            <!-- Accidentals Section -->
                            <div id="fs-section-accidentals" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Accidentals</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2">
                                    <div class="flex gap-1">
                                        <button class="fs-accidental-btn flex-1 px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-lg shadow-sm leading-tight" data-accidental="#" title="Sharp - Raise pitch by half step. Click again to toggle off.">♯</button>
                                        <button class="fs-accidental-btn flex-1 px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-lg shadow-sm leading-tight" data-accidental="b" title="Flat - Lower pitch by half step. Click again to toggle off.">♭</button>
                                        <button class="fs-accidental-btn flex-1 px-1.5 py-0.5 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-lg shadow-sm leading-tight" data-accidental="n" title="Natural - Cancel any sharp or flat. Click again to toggle off.">♮</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Articulations Section -->
                            <div id="fs-section-articulations" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Articulations</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2 hidden">
                                    <div class="grid grid-cols-2 gap-2">
                                        <button class="fs-articulation-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-articulation="staccato" title="Staccato - Short, detached notes. Play for half duration.">. Staccato</button>
                                        <button class="fs-articulation-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-articulation="accent" title="Accent - Emphasize note with stronger attack.">> Accent</button>
                                        <button class="fs-articulation-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-articulation="tenuto" title="Tenuto - Hold note for full duration, slight emphasis.">— Tenuto</button>
                                        <button class="fs-articulation-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-articulation="marcato" title="Marcato - Strong accent, even more emphasis than accent.">^ Marcato</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Dynamics Section -->
                            <div id="fs-section-dynamics" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Dynamics</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2 hidden">
                                    <div class="grid grid-cols-4 gap-1">
                                        <button class="fs-dynamic-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs font-serif italic shadow-sm" data-dynamic="pp" title="Pianissimo - Very soft">pp</button>
                                        <button class="fs-dynamic-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs font-serif italic shadow-sm" data-dynamic="p" title="Piano - Soft">p</button>
                                        <button class="fs-dynamic-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs font-serif italic shadow-sm" data-dynamic="mp" title="Mezzo-piano - Moderately soft">mp</button>
                                        <button class="fs-dynamic-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs font-serif italic shadow-sm" data-dynamic="mf" title="Mezzo-forte - Moderately loud">mf</button>
                                        <button class="fs-dynamic-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs font-serif italic shadow-sm" data-dynamic="f" title="Forte - Loud">f</button>
                                        <button class="fs-dynamic-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs font-serif italic shadow-sm" data-dynamic="ff" title="Fortissimo - Very loud">ff</button>
                                        <button class="fs-dynamic-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs font-serif italic shadow-sm" data-dynamic="sfz" title="Sforzando - Sudden strong accent">sfz</button>
                                        <button class="fs-dynamic-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs font-serif italic shadow-sm" data-dynamic="fp" title="Forte-piano - Loud then immediately soft">fp</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Ornaments Section -->
                            <div id="fs-section-ornaments" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Ornaments</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2 hidden">
                                    <div class="grid grid-cols-2 gap-1 mb-2">
                                        <button class="fs-ornament-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-ornament="trill" title="Trill - Rapid alternation between note and upper neighbor">tr Trill</button>
                                        <button class="fs-ornament-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-ornament="mordent" title="Mordent - Quick alternation: note → upper note → note">𝆰 Mordent</button>
                                        <button class="fs-ornament-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-ornament="turn" title="Turn - Four-note figure: upper → note → lower → note">𝆗 Turn</button>
                                        <button class="fs-ornament-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-ornament="invertedMordent" title="Inverted Mordent - Quick alternation: note → lower note → note">𝆱 Inv.Mord</button>
                                    </div>
                                    <button class="fs-ornament-remove-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-red-50 hover:border-red-400 transition-colors text-xs shadow-sm" title="Remove ornament from selected note(s)">Remove Ornament</button>
                                </div>
                            </div>

                            <!-- Tuplets Section -->
                            <div id="fs-section-tuplets" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Tuplets</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2 hidden">
                                    <div class="grid grid-cols-3 gap-1 mb-2">
                                        <button class="fs-tuplet-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs font-medium shadow-sm" data-tuplet="triplet" title="Triplet - 3 notes in the time of 2. Select exactly 3 consecutive notes.">3 Trip</button>
                                        <button class="fs-tuplet-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs font-medium shadow-sm" data-tuplet="quintuplet" title="Quintuplet - 5 notes in the time of 4. Select exactly 5 consecutive notes.">5 Quint</button>
                                        <button class="fs-tuplet-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs font-medium shadow-sm" data-tuplet="sextuplet" title="Sextuplet - 6 notes in the time of 4. Select exactly 6 consecutive notes.">6 Sext</button>
                                    </div>
                                    <button class="fs-tuplet-remove-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-red-50 hover:border-red-400 transition-colors text-xs shadow-sm" title="Remove tuplet grouping from selected note(s)">Remove Tuplet</button>
                                </div>
                            </div>

                            <!-- Beams Section -->
                            <div id="fs-section-beams" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Beams</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2 hidden">
                                    <div class="space-y-2">
                                        <button class="fs-beam-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs shadow-sm" data-beam="beam" title="Beam selected consecutive notes together (select 2+ beamable notes in same measure)">⟨⟩ Beam Selected</button>
                                        <button class="fs-beam-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs shadow-sm" data-beam="breakBetween" title="Break all beams between 2 selected notes (select exactly 2 notes in same beam group)">⊥ Break Between</button>
                                        <button class="fs-beam-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs shadow-sm" data-beam="unbeam" title="Remove this note from beaming entirely">⊘ Unbeam Note</button>
                                        <button class="fs-beam-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs shadow-sm" data-beam="clear" title="Clear manual beam settings on selected notes">✕ Clear Beam Settings</button>
                                        <button class="fs-beam-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-red-50 hover:border-red-400 transition-colors text-xs shadow-sm" data-action="clearMeasureBeams" title="Clear ALL beam settings in selected measure (click measure to select)">⌧ Clear Measure Beams</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Slurs & Ties Section -->
                            <div id="fs-section-slurs" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Slurs & Ties</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2 hidden">
                                    <div class="space-y-2">
                                        <button class="fs-slur-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs shadow-sm" data-slur="tie" title="Tie Notes (T) - Connect two notes of same pitch, combining their durations">⁀ Tie Notes</button>
                                        <button class="fs-slur-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs shadow-sm" data-slur="slur" title="Add Slur - Phrase marking over notes (legato playing, connect smoothly)">⌒ Add Slur</button>
                                        <button class="fs-slur-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-red-50 hover:border-red-400 transition-colors text-xs shadow-sm" data-slur="remove-slur" title="Remove slur/tie from selected notes">Remove Slur</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Hairpins Section (Crescendo/Decrescendo) -->
                            <div id="fs-section-hairpins" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Hairpins</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2 hidden">
                                    <div class="space-y-2">
                                        <button class="fs-hairpin-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs shadow-sm" data-hairpin="crescendo" title="Crescendo - Gradually get louder. Select 2+ consecutive notes.">< Crescendo</button>
                                        <button class="fs-hairpin-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs shadow-sm" data-hairpin="decrescendo" title="Decrescendo - Gradually get softer. Select 2+ consecutive notes.">> Decrescendo</button>
                                        <button class="fs-hairpin-remove-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-red-50 hover:border-red-400 transition-colors text-xs shadow-sm" title="Remove hairpin from selected note(s)">Remove Hairpin</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Grace Notes Section -->
                            <div id="fs-section-grace" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Grace Notes</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2 hidden">
                                    <div class="space-y-2">
                                        <div class="grid grid-cols-2 gap-2">
                                            <button class="fs-grace-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs shadow-sm" data-grace="acciaccatura" title="Acciaccatura - Quick crushed note (slashed stem). Played very fast before main note.">♯ Acciaccatura</button>
                                            <button class="fs-grace-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs shadow-sm" data-grace="appoggiatura" title="Appoggiatura - Leaning note (no slash). Takes time from main note.">♪ Appoggiatura</button>
                                        </div>
                                        <div class="flex items-center justify-between gap-2">
                                            <span class="text-xs text-slate-600">Adjust Pitch:</span>
                                            <div class="flex gap-1">
                                                <button class="fs-grace-transpose-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm font-bold shadow-sm" data-grace-transpose="-1" title="Lower grace note pitch by one semitone">−</button>
                                                <button class="fs-grace-transpose-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm font-bold shadow-sm" data-grace-transpose="1" title="Raise grace note pitch by one semitone">+</button>
                                            </div>
                                        </div>
                                        <button class="fs-grace-remove-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-red-50 hover:border-red-400 transition-colors text-xs shadow-sm" title="Remove grace note from selected notes">Remove Grace</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Repeat Signs Section -->
                            <div id="fs-section-repeat" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Repeat Signs</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2 hidden">
                                    <div class="grid grid-cols-3 gap-2">
                                        <button class="fs-repeat-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-repeat="repeatStart" title="Repeat Start - Begin repeat section">|:</button>
                                        <button class="fs-repeat-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-repeat="repeatEnd" title="Repeat End - End repeat section">:|</button>
                                        <button class="fs-repeat-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-repeat="repeatBoth" title="Repeat Both - End and start new repeat">:|:</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Endings (Volta Brackets) Section -->
                            <div id="fs-section-endings" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Endings</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2 hidden">
                                    <div class="space-y-2">
                                        <div class="grid grid-cols-2 gap-2">
                                            <button class="fs-volta-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-volta="1" title="1st Ending - Play on first pass">1.</button>
                                            <button class="fs-volta-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-volta="2" title="2nd Ending - Play on second pass">2.</button>
                                        </div>
                                        <button class="fs-volta-remove-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-red-50 hover:border-red-400 transition-colors text-xs shadow-sm" title="Remove ending bracket from selected measure">Remove Ending</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Chord Labels Section -->
                            <div id="fs-section-chord" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Chord Labels</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2 hidden">
                                    <div class="space-y-2">
                                        <input type="text" class="fs-chord-input w-full p-2 rounded bg-white border border-slate-200 hover:border-indigo-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm shadow-sm" placeholder="e.g., Cmaj7, Dm, G7" title="Enter chord symbol">
                                        <button class="fs-chord-apply-btn w-full p-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm shadow-sm" title="Apply chord symbol to selected note">✓ Apply Chord</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Lyrics Section -->
                            <div id="fs-section-lyrics" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Lyrics</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2 hidden">
                                    <div class="space-y-2">
                                        <input type="text" class="fs-lyric-input w-full p-2 rounded bg-white border border-slate-200 hover:border-indigo-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm shadow-sm" placeholder="Lyric syllable" title="Enter lyric text">
                                        <select class="fs-lyric-syllabic w-full p-2 rounded bg-white border border-slate-200 hover:border-indigo-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm shadow-sm" title="Syllable position in word">
                                            <option value="single">Single word</option>
                                            <option value="begin">Begin─ (start of word)</option>
                                            <option value="middle">─Mid─ (middle)</option>
                                            <option value="end">─End (end of word)</option>
                                        </select>
                                        <button class="fs-lyric-apply-btn w-full p-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm shadow-sm" title="Apply lyric to selected note">✓ Apply Lyric</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Pedal Section -->
                            <div id="fs-section-pedal" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Pedal</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2 hidden">
                                    <div class="grid grid-cols-2 gap-2">
                                        <button class="fs-pedal-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-pedal="down" title="Pedal Down (Ped.) - Depress sustain pedal">Ped</button>
                                        <button class="fs-pedal-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-pedal="up" title="Pedal Up (*) - Release sustain pedal">*</button>
                                        <button class="fs-pedal-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-pedal="change" title="Pedal Change - Quick release and re-depress">⟳</button>
                                        <button class="fs-pedal-btn p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-pedal="half" title="Half Pedal - Partial pedal for lighter sustain">½</button>
                                    </div>
                                </div>
                            </div>

                            <!-- Voicing Section -->
                            <div id="fs-section-voicing" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Voicing</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2">
                                    <div class="space-y-3">
                                        <!-- Voice Toggle -->
                                        <div>
                                            <label class="block text-xs text-slate-600 mb-1">Active Voice (V to toggle)</label>
                                            <div class="flex gap-2">
                                                <button class="fs-voice-btn flex-1 p-2 rounded bg-indigo-100 border border-indigo-500 text-indigo-700 font-medium transition-colors text-sm shadow-sm" data-voice="1" title="Voice 1 - Upper voice (melody)">V1</button>
                                                <button class="fs-voice-btn flex-1 p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm shadow-sm" data-voice="2" title="Voice 2 - Lower voice (harmony)">V2</button>
                                            </div>
                                        </div>
                                        <!-- V2 Rest Display Mode -->
                                        <div>
                                            <label class="block text-xs text-slate-600 mb-1">Voice 2 Rests</label>
                                            <div class="flex gap-2">
                                                <button class="fs-rest-display-btn flex-1 p-2 rounded bg-indigo-100 border border-indigo-500 transition-colors text-xs shadow-sm" data-rest-mode="clean" title="Clean mode - hide redundant Voice 2 rests">Clean</button>
                                                <button class="fs-rest-display-btn flex-1 p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs shadow-sm" data-rest-mode="explicit" title="Show all Voice 2 rests explicitly">Show All</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Quick Actions Section -->
                            <div id="fs-section-actions" class="sidebar-section">
                                <div class="sidebar-section-header flex items-center justify-between cursor-pointer p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
                                     onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.chevron').classList.toggle('rotate-180');">
                                    <span class="font-medium text-slate-700 text-sm">Quick Actions</span>
                                    <svg class="chevron w-4 h-4 text-slate-500 transform transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </div>
                                <div class="sidebar-section-content p-2">
                                    <div class="space-y-2">
                                        <button class="fs-action-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm flex items-center justify-center gap-2 shadow-sm" data-action="undo" title="Undo (Ctrl+Z)">
                                            <span>↩</span> Undo
                                        </button>
                                        <button class="fs-action-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm flex items-center justify-center gap-2 shadow-sm" data-action="redo" title="Redo (Ctrl+Y)">
                                            <span>↪</span> Redo
                                        </button>
                                        <button class="fs-action-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-red-50 hover:border-red-400 transition-colors text-sm flex items-center justify-center gap-2 shadow-sm" data-action="delete" title="Delete selected">
                                            <span>🗑</span> Delete
                                        </button>
                                        <button class="fs-action-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm flex items-center justify-center gap-2 shadow-sm" data-action="copy" title="Copy selected (Ctrl+C)">
                                            <span>📋</span> Copy
                                        </button>
                                        <button class="fs-action-btn w-full p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-sm flex items-center justify-center gap-2 shadow-sm" data-action="paste" title="Paste (Ctrl+V)">
                                            <span>📄</span> Paste
                                        </button>
                                        <div class="flex gap-2">
                                            <button class="fs-action-btn flex-1 p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs flex items-center justify-center gap-1 shadow-sm" data-action="octave-up" title="Octave up (Shift+↑)">
                                                <span>↑</span> 8va
                                            </button>
                                            <button class="fs-action-btn flex-1 p-2 rounded bg-white border border-slate-200 hover:bg-indigo-100 hover:border-indigo-500 transition-colors text-xs flex items-center justify-center gap-1 shadow-sm" data-action="octave-down" title="Octave down (Shift+↓)">
                                                <span>↓</span> 8vb
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Selection Info -->
                            <div id="fs-selection-info" class="text-xs text-slate-500 p-2 text-center border-t border-slate-200 mt-2 hidden">
                                <span id="fs-selection-count">No selection</span>
                            </div>

                            <!-- Info Note -->
                            <div class="text-xs text-slate-400 italic p-2 text-center border-t border-slate-200 mt-2">
                                Keyboard shortcuts work in full-screen mode
                            </div>
                        </div>
                    </div>
                    </div><!-- Close sidebar-content -->
                </div><!-- Close sidebar -->

                <!-- Right Area (Canvas + Bottom Panel) -->
                <div class="flex-1 flex flex-col overflow-hidden min-w-0">

                <!-- Canvas Container (Scrollable) -->
                <div id="fullscreen-canvas-container"
                     class="flex-1 overflow-auto bg-gray-100 p-4 relative">
                    <div id="fullscreen-canvas-wrapper"
                         class="inline-block min-w-full"
                         style="transform-origin: top center;">
                        <!-- Notation pages will be moved here -->
                        <div id="fullscreen-pages-container" class="flex flex-col items-center gap-4">
                            <!-- Pages will be cloned/moved here -->
                        </div>
                    </div>

                    <!-- Playback FAB (Fixed position in bottom-right of canvas container) -->
                    <div id="fullscreen-playback-fab" class="fixed bottom-6 right-6 z-50">
                        <div class="flex flex-col items-center gap-3">
                            <!-- Stop Button (above play) -->
                            <button id="fs-fab-stop-btn"
                                    class="w-12 h-12 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
                                    title="Stop">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <rect x="6" y="6" width="8" height="8"/>
                                </svg>
                            </button>

                            <!-- Main Play Button -->
                            <div class="relative">
                                <button id="fs-fab-play-btn"
                                        class="w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95"
                                        title="Play (click for menu)">
                                    <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                                    </svg>
                                </button>

                                <!-- Dropdown Menu (appears above the button) -->
                                <div id="fs-fab-menu" class="hidden absolute bottom-16 right-0 w-48 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
                                <button data-action="play-all" class="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-green-50 flex items-center gap-3 active:bg-green-100">
                                    <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
                                    <span class="text-green-700 font-medium">Play All</span>
                                </button>
                                <button data-action="play-chords" class="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-3 active:bg-blue-100">
                                    <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                                    <span class="text-blue-700">Chords Only</span>
                                </button>
                                <button data-action="play-from-selected" class="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-purple-50 flex items-center gap-3 active:bg-purple-100">
                                    <svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>
                                    <span class="text-purple-700">From Selected</span>
                                </button>
                                <button data-action="play-measure" class="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-amber-50 flex items-center gap-3 active:bg-amber-100">
                                    <svg class="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-2c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"/></svg>
                                    <span class="text-amber-700">Play Measure</span>
                                </button>
                                <div class="border-t border-gray-100"></div>
                                <button data-action="toggle-metronome" class="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-orange-50 flex items-center gap-3 active:bg-orange-100">
                                    <span class="w-4 h-4 text-orange-600 text-center">🔔</span>
                                    <span class="text-orange-700">Metronome</span>
                                    <span id="fs-metronome-status" class="ml-auto text-xs text-gray-400">OFF</span>
                                </button>
                                <div class="border-t border-gray-100"></div>
                                <button data-action="stop" class="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-red-50 flex items-center gap-3 active:bg-red-100">
                                    <svg class="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20"><rect x="6" y="6" width="8" height="8"/></svg>
                                    <span class="text-red-700 font-medium">Stop</span>
                                </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div><!-- Close canvas container -->

                <!-- Bottom Chord Progression Panel -->
                <div id="fullscreen-bottom-panel"
                     class="flex-shrink-0 border-t border-gray-300 bg-gray-50 transition-all duration-300 ease-in-out">

                    <!-- Panel Header/Handle -->
                    <div id="bottom-panel-header"
                         class="h-8 bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-between px-3 cursor-pointer select-none">
                        <div class="flex items-center gap-3">
                            <span class="text-white text-sm font-semibold" style="color: #ffffff !important; -webkit-text-fill-color: #ffffff !important;">Chord Progression</span>
                            <!-- View Mode Toggle (Scroll/Section) -->
                            <div class="flex gap-0.5 bg-white/20 rounded-lg p-0.5">
                                <button class="fs-view-mode-btn px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 flex items-center gap-1 ${this.fullscreenViewMode === 'scroll' ? 'bg-white shadow text-indigo-600' : 'text-white/80 hover:text-white hover:bg-white/10'}" data-mode="scroll" title="Scroll View" style="${this.fullscreenViewMode === 'scroll' ? '-webkit-text-fill-color: #4f46e5;' : '-webkit-text-fill-color: inherit;'}">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                                    </svg>
                                    Scroll
                                </button>
                                <button class="fs-view-mode-btn px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 flex items-center gap-1 ${this.fullscreenViewMode === 'section' ? 'bg-white shadow text-indigo-600' : 'text-white/80 hover:text-white hover:bg-white/10'}" data-mode="section" title="Section View" style="${this.fullscreenViewMode === 'section' ? '-webkit-text-fill-color: #4f46e5;' : '-webkit-text-fill-color: inherit;'}">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                                    </svg>
                                    Section
                                </button>
                            </div>
                        </div>
                        <!-- Collapse/Expand Chevron -->
                        <svg class="bottom-panel-chevron w-5 h-5 text-white transform transition-transform ${this.bottomPanelOpen ? '' : 'rotate-180'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </div>

                    <!-- Panel Content -->
                    <div id="bottom-panel-content" class="${this.bottomPanelOpen ? 'h-[140px]' : 'h-0'} overflow-hidden transition-all duration-300 ease-in-out">
                        <!-- Section Picker (shown in section mode) -->
                        <div id="fs-section-picker" class="hidden px-2 py-1 bg-gray-100 border-b border-gray-200"></div>

                        <!-- Cards Container -->
                        <div id="fs-chord-cards-container"
                             class="flex items-center gap-2 px-3 py-2 overflow-x-auto h-full"
                             style="scroll-behavior: smooth;">
                            <!-- Chord cards rendered here -->
                            <div class="text-gray-400 text-sm italic">Loading chord progression...</div>
                        </div>
                    </div>
                </div><!-- Close bottom panel -->
                </div><!-- Close right area (canvas + bottom panel) -->
            </div><!-- Close main content area -->
        `;

        document.body.appendChild(this.modal);

        // Attach event handlers
        this._attachEventHandlers();
    }

    /**
     * Attach event handlers to modal elements
     */
    _attachEventHandlers() {
        // Sidebar toggle
        const sidebarToggle = this.modal.querySelector('#fullscreen-sidebar-toggle');
        sidebarToggle?.addEventListener('click', () => this._toggleSidebar());

        // Zoom controls
        const zoomOut = this.modal.querySelector('#fullscreen-zoom-out');
        const zoomIn = this.modal.querySelector('#fullscreen-zoom-in');
        const fitWidth = this.modal.querySelector('#fullscreen-fit-width');

        zoomOut?.addEventListener('click', () => this._zoomOut());
        zoomIn?.addEventListener('click', () => this._zoomIn());
        fitWidth?.addEventListener('click', () => this._fitToWidth());

        // Measures per system dropdown
        const measuresDropdown = this.modal.querySelector('#fullscreen-measures-dropdown');
        measuresDropdown?.addEventListener('change', (e) => {
            this.measuresPerSystem = parseInt(e.target.value);
            this._saveToStorage(STORAGE_KEYS.MEASURES_PER_SYSTEM, this.measuresPerSystem);
            this._onMeasuresPerSystemChange();
        });

        // Close button
        const closeBtn = this.modal.querySelector('#fullscreen-close-btn');
        closeBtn?.addEventListener('click', () => this.close());

        // Title/Composer edit click handler
        const titleComposerEl = this.modal.querySelector('#fs-title-composer');
        titleComposerEl?.addEventListener('click', () => this._showTitleComposerEditor());

        // Close on backdrop click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Sidebar tool button handlers
        this._attachSidebarToolHandlers();

        // Playback FAB handlers
        this._attachPlaybackFABHandlers();

        // Sidebar toggle strip (expand when collapsed)
        const toggleStrip = this.modal.querySelector('.sidebar-toggle-strip');
        toggleStrip?.addEventListener('click', () => this._toggleSidebar());

        // Sidebar collapse button (collapse when expanded)
        const collapseBtn = this.modal.querySelector('.sidebar-collapse-btn');
        collapseBtn?.addEventListener('click', () => this._toggleSidebar());

        // Bottom panel toggle
        const bottomHeader = this.modal.querySelector('#bottom-panel-header');
        bottomHeader?.addEventListener('click', (e) => {
            // Ignore clicks on view mode buttons
            if (!e.target.closest('.fs-view-mode-btn')) {
                this._toggleBottomPanel();
            }
        });

        // Bottom panel view mode buttons
        this.modal.querySelectorAll('.fs-view-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.fullscreenViewMode = btn.dataset.mode;
                this._saveToStorage(STORAGE_KEYS.FS_VIEW_MODE, this.fullscreenViewMode);
                this._updateViewModeButtons();
                this._renderChordProgression();
            });
        });
    }

    /**
     * Attach event handlers for the playback FAB button
     */
    _attachPlaybackFABHandlers() {
        const playBtn = this.modal.querySelector('#fs-fab-play-btn');
        const stopBtn = this.modal.querySelector('#fs-fab-stop-btn');
        const fabMenu = this.modal.querySelector('#fs-fab-menu');

        // Toggle menu on play button click
        playBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            fabMenu?.classList.toggle('hidden');
        });

        // Stop button - immediate stop
        stopBtn?.addEventListener('click', () => {
            fabMenu?.classList.add('hidden');
            window.stopPlayAllMelody?.();
            window.stopMelody?.();
        });

        // Menu item handlers
        fabMenu?.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                fabMenu.classList.add('hidden');

                switch (action) {
                    case 'play-all':
                        // Play all (melody + chords)
                        window.playAllMelody?.();
                        break;
                    case 'play-chords':
                        // Chords/progression only
                        window.playProgressionOnly?.();
                        break;
                    case 'play-from-selected':
                        // From selected measure
                        window.playFromSelectedMeasure?.();
                        break;
                    case 'play-measure':
                        // Play selected/current measure
                        window.playSelectedMeasure?.();
                        break;
                    case 'toggle-metronome':
                        // Toggle metronome
                        const newState = window.toggleMetronome?.();
                        const statusEl = this.modal.querySelector('#fs-metronome-status');
                        if (statusEl) {
                            statusEl.textContent = newState ? 'ON' : 'OFF';
                        }
                        break;
                    case 'stop':
                        window.stopPlayAllMelody?.();
                        window.stopMelody?.();
                        break;
                }
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isOpen && fabMenu && !fabMenu.contains(e.target) && !playBtn?.contains(e.target)) {
                fabMenu.classList.add('hidden');
            }
        });
    }

    /**
     * Attach event handlers for sidebar tool buttons
     * These connect to the existing notation toolbar functionality
     */
    _attachSidebarToolHandlers() {
        const sidebar = this.modal.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        // Get toolbar reference for direct method calls
        const getToolbar = () => {
            const composer = window.getNotationComposer?.();
            return composer?.toolbar;
        };

        // Get note editor for selection operations
        const getNoteEditor = () => {
            const composer = window.getNotationComposer?.();
            return composer?.noteEditor;
        };

        // Duration buttons - NOTE: These are in the PINNED header section, not in sidebar-content
        // So we search the entire modal for them
        this.modal.querySelectorAll('.fs-duration-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const duration = e.currentTarget.dataset.duration;
                if (duration && window.setNotationDuration) {
                    window.setNotationDuration(duration);
                    this._updateActiveDurationButton(duration);
                }
            });
        });

        // Dot button - also in pinned header
        // Use toolbar's toggleDotted to apply to selected notes (not just input mode)
        const dotBtn = this.modal.querySelector('.fs-dot-btn');
        dotBtn?.addEventListener('click', () => {
            const composer = window.getNotationComposer?.();
            const toolbar = composer?.toolbar;
            if (toolbar?.toggleDotted) {
                toolbar.toggleDotted();
                // Update our button to match toolbar state
                this._updateDotButton(toolbar.isDotted);
            } else if (window.setNotationDotted) {
                // Fallback to old behavior
                const state = window.getNotationState?.();
                const newDotted = !state?.isDotted;
                window.setNotationDotted(newDotted);
                this._updateDotButton(newDotted);
            }
        });

        // Rest button - also in pinned header
        const restBtn = this.modal.querySelector('.fs-rest-btn');
        restBtn?.addEventListener('click', () => {
            if (window.setNotationRestMode) {
                const state = window.getNotationState?.();
                const newRestMode = !state?.isRestMode;
                window.setNotationRestMode(newRestMode);
                this._updateRestButton(newRestMode);
            }
        });

        // Voice select dropdown
        const voiceSelect = sidebar.querySelector('.fs-voice-select');
        voiceSelect?.addEventListener('change', (e) => {
            const voice = parseInt(e.target.value, 10);
            const toolbar = getToolbar();
            if (toolbar && voice) {
                toolbar.setVoice(voice);
                this._updateVoiceSelect(voice);
            }
        });

        // V2 Rest display mode buttons
        sidebar.querySelectorAll('.fs-rest-display-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.restMode;
                const toolbar = getToolbar();
                if (mode && toolbar) {
                    toolbar.setRestDisplayMode(mode);
                    this._updateRestDisplayButtons(mode);
                }
            });
        });

        // Accidental buttons - let toolbar.setAccidental() handle toggling
        sidebar.querySelectorAll('.fs-accidental-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const accidental = e.currentTarget.dataset.accidental;
                const toolbar = getToolbar();
                if (accidental && toolbar) {
                    toolbar.setAccidental(accidental);
                    // Only update button state immediately when NO notes are selected
                    // When notes ARE selected, _syncSidebarWithToolbar() will handle the update
                    // after the note is modified and selection state is recalculated
                    if (toolbar.selectedNotesCount === 0) {
                        this._updateActiveAccidentalButton(toolbar.currentAccidental);
                    }
                }
            });
        });

        // Articulation buttons - let toolbar.setArticulation() handle toggling
        sidebar.querySelectorAll('.fs-articulation-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const articulation = e.currentTarget.dataset.articulation;
                const toolbar = getToolbar();
                if (articulation && toolbar) {
                    // Call setArticulation directly - it handles toggling and fires onArticulationChange
                    toolbar.setArticulation(articulation);
                    // Update sidebar UI to reflect new state
                    this._updateActiveArticulationButton(toolbar.currentArticulation);
                }
            });
        });

        // Dynamic buttons - let toolbar.setDynamic() handle toggling and callback
        sidebar.querySelectorAll('.fs-dynamic-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dynamic = e.currentTarget.dataset.dynamic;
                const toolbar = getToolbar();
                if (dynamic && toolbar) {
                    // Call setDynamic directly - it handles toggling and fires onDynamicChange
                    toolbar.setDynamic(dynamic);
                    // Update sidebar UI to reflect new state
                    this._updateActiveDynamicButton(toolbar.currentDynamic);
                }
            });
        });

        // Ornament buttons - apply ornament to selected notes
        sidebar.querySelectorAll('.fs-ornament-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const ornament = e.currentTarget.dataset.ornament;
                const toolbar = getToolbar();
                if (ornament && toolbar) {
                    toolbar.onOrnamentApply?.(ornament);
                    // Don't manually update - let sync handle it after selection updates
                }
            });
        });

        // Ornament remove button
        const ornamentRemoveBtn = sidebar.querySelector('.fs-ornament-remove-btn');
        ornamentRemoveBtn?.addEventListener('click', () => {
            const toolbar = getToolbar();
            toolbar?.onOrnamentRemove?.();
        });

        // Tuplet buttons
        sidebar.querySelectorAll('.fs-tuplet-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tupletType = e.currentTarget.dataset.tuplet;
                const toolbar = getToolbar();
                if (tupletType && toolbar) {
                    toolbar.onTupletCreate?.(tupletType);
                }
            });
        });

        // Tuplet remove button
        const tupletRemoveBtn = sidebar.querySelector('.fs-tuplet-remove-btn');
        tupletRemoveBtn?.addEventListener('click', () => {
            const toolbar = getToolbar();
            toolbar?.onTupletRemove?.();
        });

        // Beam buttons
        sidebar.querySelectorAll('.fs-beam-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const beamAction = e.currentTarget.dataset.beam;
                const action = e.currentTarget.dataset.action;
                const toolbar = getToolbar();
                if (toolbar) {
                    if (action === 'clearMeasureBeams') {
                        toolbar.onClearMeasureBeams?.();
                    } else if (beamAction) {
                        toolbar.onBeamApply?.(beamAction);
                    }
                }
            });
        });

        // Slur/Tie buttons
        sidebar.querySelectorAll('.fs-slur-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const slurAction = e.currentTarget.dataset.slur;
                const toolbar = getToolbar();
                if (slurAction && toolbar) {
                    switch (slurAction) {
                        case 'tie':
                            toolbar.onTie?.();
                            break;
                        case 'slur':
                            toolbar.onSlur?.();
                            break;
                        case 'remove-slur':
                            toolbar.onSlurRemove?.();
                            break;
                    }
                }
            });
        });

        // Hairpin buttons (crescendo/decrescendo)
        sidebar.querySelectorAll('.fs-hairpin-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const hairpinType = e.currentTarget.dataset.hairpin;
                const toolbar = getToolbar();
                if (hairpinType && toolbar) {
                    toolbar.onHairpinApply?.(hairpinType);
                }
            });
        });

        // Hairpin remove button
        const hairpinRemoveBtn = sidebar.querySelector('.fs-hairpin-remove-btn');
        hairpinRemoveBtn?.addEventListener('click', () => {
            const toolbar = getToolbar();
            toolbar?.onHairpinRemove?.();
        });

        // Grace note buttons
        sidebar.querySelectorAll('.fs-grace-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const graceType = e.currentTarget.dataset.grace;
                const toolbar = getToolbar();
                if (graceType && toolbar) {
                    toolbar.onGraceNoteAdd?.(graceType);
                }
            });
        });

        // Grace note remove button
        const graceRemoveBtn = sidebar.querySelector('.fs-grace-remove-btn');
        graceRemoveBtn?.addEventListener('click', () => {
            const toolbar = getToolbar();
            toolbar?.onGraceNoteRemove?.();
        });

        // Grace note transpose buttons (adjust pitch up/down)
        sidebar.querySelectorAll('.fs-grace-transpose-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const halfSteps = parseInt(e.currentTarget.dataset.graceTranspose);
                const toolbar = getToolbar();
                if (!isNaN(halfSteps) && toolbar) {
                    toolbar.onGraceNoteTranspose?.(halfSteps);
                }
            });
        });

        // Action buttons (undo, redo, delete, copy, paste, octave shift)
        sidebar.querySelectorAll('.fs-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                const toolbar = getToolbar();
                const noteEditor = getNoteEditor();

                switch (action) {
                    case 'undo':
                        toolbar?.onUndo?.();
                        break;
                    case 'redo':
                        toolbar?.onRedo?.();
                        break;
                    case 'delete':
                        toolbar?.onDelete?.();
                        break;
                    case 'copy':
                        toolbar?.onCopy?.();
                        break;
                    case 'paste':
                        toolbar?.onPaste?.();
                        break;
                    case 'octave-up':
                        toolbar?.onOctaveShift?.(12);
                        break;
                    case 'octave-down':
                        toolbar?.onOctaveShift?.(-12);
                        break;
                }
            });
        });

        // Voice toggle buttons (V1/V2)
        sidebar.querySelectorAll('.fs-voice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const voice = parseInt(e.currentTarget.dataset.voice);
                const toolbar = getToolbar();
                if (toolbar && !isNaN(voice)) {
                    toolbar.setVoice?.(voice);
                    this._updateVoiceButtons(voice);
                }
            });
        });

        // Rest display mode buttons (Clean vs Show All)
        sidebar.querySelectorAll('.fs-rest-display-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.restMode;
                const toolbar = getToolbar();
                if (toolbar && mode) {
                    toolbar.setV2RestDisplayMode?.(mode);
                    this._updateRestDisplayButtons(mode);
                }
            });
        });

        // Repeat sign buttons
        sidebar.querySelectorAll('.fs-repeat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const repeatType = e.currentTarget.dataset.repeat;
                const toolbar = getToolbar();
                if (toolbar && repeatType) {
                    toolbar.onRepeatSignApply?.(repeatType);
                }
            });
        });

        // Volta/Ending buttons
        sidebar.querySelectorAll('.fs-volta-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const voltaNum = e.currentTarget.dataset.volta;
                const toolbar = getToolbar();
                if (toolbar && voltaNum) {
                    toolbar.onVoltaApply?.(parseInt(voltaNum));
                }
            });
        });

        // Volta remove button
        const voltaRemoveBtn = sidebar.querySelector('.fs-volta-remove-btn');
        voltaRemoveBtn?.addEventListener('click', () => {
            const toolbar = getToolbar();
            toolbar?.onVoltaRemove?.();
        });

        // Chord label apply button
        const chordApplyBtn = sidebar.querySelector('.fs-chord-apply-btn');
        chordApplyBtn?.addEventListener('click', () => {
            const input = sidebar.querySelector('.fs-chord-input');
            const chordText = input?.value?.trim();
            const toolbar = getToolbar();
            if (toolbar && chordText) {
                toolbar.onChordLabelApply?.(chordText);
                input.value = ''; // Clear input after applying
            }
        });

        // Lyric apply button
        const lyricApplyBtn = sidebar.querySelector('.fs-lyric-apply-btn');
        lyricApplyBtn?.addEventListener('click', () => {
            const input = sidebar.querySelector('.fs-lyric-input');
            const syllabicSelect = sidebar.querySelector('.fs-lyric-syllabic');
            const lyricText = input?.value?.trim();
            const syllabic = syllabicSelect?.value || 'single';
            const toolbar = getToolbar();
            if (toolbar && lyricText) {
                toolbar.onLyricApply?.(lyricText, syllabic);
                input.value = ''; // Clear input after applying
            }
        });

        // Pedal buttons
        sidebar.querySelectorAll('.fs-pedal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pedalType = e.currentTarget.dataset.pedal;
                const toolbar = getToolbar();
                if (toolbar && pedalType) {
                    toolbar.onPedalApply?.(pedalType);
                }
            });
        });

        // Quick Section Selector (jump to section)
        // Note: The dropdown is in the pinned header area, not inside #fullscreen-sidebar-content,
        // so we search from this.modal instead of sidebar
        const sectionJump = this.modal.querySelector('#fs-section-jump');
        sectionJump?.addEventListener('change', (e) => {
            const sectionId = e.target.value;
            if (!sectionId) return;

            // The sections are inside #fullscreen-sidebar-content
            const section = sidebar.querySelector(`#${sectionId}`);
            if (section) {
                // Scroll section into view
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });

                // Open the section if it's collapsed
                const content = section.querySelector('.sidebar-section-content');
                const chevron = section.querySelector('.chevron');
                if (content && content.classList.contains('hidden')) {
                    content.classList.remove('hidden');
                    chevron?.classList.add('rotate-180');
                }

                // Reset dropdown after navigation
                setTimeout(() => { e.target.value = ''; }, 300);
            }
        });
    }

    /**
     * Update voice toggle buttons to reflect active voice
     */
    _updateVoiceButtons(activeVoice) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        sidebar.querySelectorAll('.fs-voice-btn').forEach(btn => {
            const isActive = parseInt(btn.dataset.voice) === activeVoice;
            btn.classList.toggle('bg-indigo-100', isActive);
            btn.classList.toggle('border-indigo-500', isActive);
            btn.classList.toggle('text-indigo-700', isActive);
            btn.classList.toggle('font-medium', isActive);
            btn.classList.toggle('bg-white', !isActive);
            btn.classList.toggle('border-slate-200', !isActive);
        });
    }

    /**
     * Set up selection change listener to sync sidebar with selection state
     * Called when fullscreen mode is opened
     */
    _setupSelectionListener() {
        const composer = window.getNotationComposer?.();
        if (!composer?.noteEditor) return;

        // Store reference to original updateSelectionState if we want to intercept
        const noteEditor = composer.noteEditor;
        const originalUpdateOverlay = noteEditor.renderOverlay?.bind(noteEditor);

        // Create our sync function
        this._selectionSyncHandler = () => {
            if (!this.isOpen) return;
            this._syncSidebarWithSelection();
        };

        // Hook into selection changes by listening for toolbar updates
        // The toolbar gets updated whenever selection changes
        if (composer.toolbar) {
            const originalUpdateSelection = composer.toolbar.updateSelectionState?.bind(composer.toolbar);
            if (originalUpdateSelection) {
                composer.toolbar.updateSelectionState = (selectedNotes) => {
                    originalUpdateSelection(selectedNotes);
                    if (this.isOpen) {
                        this._syncSidebarWithToolbar(composer.toolbar);
                    }
                };
                this._originalUpdateSelectionState = originalUpdateSelection;
            }
        }
    }

    /**
     * Restore original selection state handler
     */
    _removeSelectionListener() {
        const composer = window.getNotationComposer?.();
        if (composer?.toolbar && this._originalUpdateSelectionState) {
            composer.toolbar.updateSelectionState = this._originalUpdateSelectionState;
            this._originalUpdateSelectionState = null;
        }
    }

    /**
     * Sync sidebar button states with the main toolbar's selection state
     */
    _syncSidebarWithToolbar(toolbar) {
        if (!toolbar || !this.modal) return;

        const hasSelection = toolbar.selectedNotesCount > 0;

        // Update duration buttons
        // When notes are selected, show their duration; otherwise show input mode duration
        if (hasSelection) {
            // Always update duration when there's a selection, even if 'mixed'
            // For 'mixed', we could show no highlight, but let's show the first selected note's duration
            const durationToShow = toolbar.selectionDuration === 'mixed'
                ? toolbar.currentDuration  // Fallback to current input duration for mixed
                : toolbar.selectionDuration;
            this._updateActiveDurationButton(durationToShow);
        } else {
            this._updateActiveDurationButton(toolbar.currentDuration);
        }

        // Update dot button
        if (hasSelection) {
            if (toolbar.selectionDotted !== 'mixed') {
                this._updateDotButton(toolbar.selectionDotted === true);
            }
        } else {
            this._updateDotButton(toolbar.isDotted);
        }

        // Update rest button
        if (hasSelection) {
            if (toolbar.selectionIsRest !== 'mixed') {
                this._updateRestButton(toolbar.selectionIsRest === true);
            }
        } else {
            this._updateRestButton(toolbar.isRestMode);
        }

        // Update accidental buttons
        // When notes are selected, show their accidental state (or null if no accidental)
        if (hasSelection) {
            if (toolbar.selectionAccidental !== 'mixed') {
                this._updateActiveAccidentalButton(toolbar.selectionAccidental);
            }
        } else {
            this._updateActiveAccidentalButton(toolbar.currentAccidental);
        }

        // Update articulation buttons
        if (hasSelection) {
            if (toolbar.selectionArticulation !== 'mixed') {
                this._updateActiveArticulationButton(toolbar.selectionArticulation);
            }
        } else {
            this._updateActiveArticulationButton(toolbar.currentArticulation);
        }

        // Update dynamic buttons
        if (hasSelection) {
            if (toolbar.selectionDynamic !== 'mixed') {
                this._updateActiveDynamicButton(toolbar.selectionDynamic);
            }
        } else {
            this._updateActiveDynamicButton(toolbar.currentDynamic);
        }

        // Update ornament buttons
        if (hasSelection) {
            if (toolbar.selectionOrnament !== 'mixed') {
                this._updateActiveOrnamentButton(toolbar.selectionOrnament);
            }
        } else {
            this._updateActiveOrnamentButton(null);
        }

        // Update tuplet buttons (reflect selection state)
        if (hasSelection) {
            if (toolbar.selectionTuplet !== 'mixed') {
                this._updateActiveTupletButton(toolbar.selectionTuplet);
            }
        } else {
            this._updateActiveTupletButton(null);
        }

        // Update pedal buttons (reflect selection state)
        if (hasSelection) {
            if (toolbar.selectionPedal !== 'mixed') {
                this._updatePedalButtons(toolbar.selectionPedal);
            }
        } else {
            this._updatePedalButtons(null);
        }

        // Update slur button state
        this._updateSlurButton(hasSelection && toolbar.selectionHasSlur);

        // Update hairpin buttons
        if (hasSelection) {
            if (toolbar.selectionHasHairpin !== 'mixed') {
                this._updateHairpinButtons(toolbar.selectionHasHairpin);
            }
        } else {
            this._updateHairpinButtons(null);
        }

        // Update grace note buttons
        if (hasSelection) {
            if (toolbar.selectionGraceNote !== 'mixed') {
                this._updateGraceNoteButtons(toolbar.selectionGraceNote);
            }
        } else {
            this._updateGraceNoteButtons(null);
        }

        // Update beam buttons
        if (hasSelection && toolbar.selectionBeam) {
            this._updateBeamButtons(toolbar.selectionBeam);
        } else {
            this._updateBeamButtons({ start: false, end: false, unbeam: false });
        }

        // Update tie button
        if (hasSelection) {
            if (toolbar.selectionTied !== 'mixed') {
                this._updateTieButton(toolbar.selectionTied === true);
            }
        } else {
            this._updateTieButton(false);
        }

        // Update volta buttons (based on measure selection)
        this._updateVoltaButtons(toolbar.selectionMeasureIndices);

        // Update repeat buttons (based on measure selection)
        this._updateRepeatButtons(toolbar.selectionMeasureIndices);

        // Update lyric buttons
        this._updateLyricButtons(toolbar.selectionHasLyric);

        // Update chord buttons (placeholder for future)
        this._updateChordButtons();

        // Update selection info
        this._updateSelectionInfo(toolbar.selectedNotesCount);

        // Update contextual button states (enable/disable based on selection)
        this._updateContextualButtonStates(toolbar);
    }

    /**
     * Sync sidebar with current selection (called when no toolbar sync available)
     */
    _syncSidebarWithSelection() {
        const composer = window.getNotationComposer?.();
        if (composer?.toolbar) {
            this._syncSidebarWithToolbar(composer.toolbar);
        }
    }

    /**
     * Update active state of duration buttons in sidebar (pinned header)
     */
    _updateActiveDurationButton(activeDuration) {
        if (!this.modal) return;

        // Duration buttons are in the PINNED header, not sidebar-content
        const buttons = this.modal.querySelectorAll('.fs-duration-btn');
        buttons.forEach(btn => {
            const isActive = btn.dataset.duration === activeDuration;
            btn.classList.toggle('bg-indigo-200', isActive);
            btn.classList.toggle('border-indigo-500', isActive);
            btn.classList.toggle('ring-2', isActive);
            btn.classList.toggle('ring-indigo-400', isActive);
            btn.classList.toggle('bg-white', !isActive);
            btn.classList.toggle('border-slate-200', !isActive);
        });

        // Update the duration indicator text
        const indicator = this.modal.querySelector('#fs-duration-indicator');
        if (indicator) {
            const durationNames = {
                '1n': 'Whole Note (4 beats)',
                '2n': 'Half Note (2 beats)',
                '4n': 'Quarter Note (1 beat)',
                '8n': 'Eighth Note (½ beat)',
                '16n': '16th Note (¼ beat)',
                '32n': '32nd Note (⅛ beat)'
            };
            const isDotted = window.getNotationState?.()?.isDotted;
            const baseName = durationNames[activeDuration] || activeDuration;
            indicator.textContent = `Current: ${baseName}${isDotted ? ' (dotted)' : ''}`;
        }
    }

    /**
     * Update active state of accidental buttons in sidebar
     */
    _updateActiveAccidentalButton(activeAccidental) {
        const sidebar = this.modal.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        sidebar.querySelectorAll('.fs-accidental-btn').forEach(btn => {
            const isActive = btn.dataset.accidental === activeAccidental;
            btn.classList.toggle('bg-purple-100', isActive);
            btn.classList.toggle('border-purple-400', isActive);
            btn.classList.toggle('bg-white', !isActive);
            btn.classList.toggle('border-slate-200', !isActive);
        });
    }

    /**
     * Update dot button state (in pinned header)
     */
    _updateDotButton(isDotted) {
        if (!this.modal) return;

        // Dot button is in the PINNED header, not sidebar-content
        const dotBtn = this.modal.querySelector('.fs-dot-btn');
        if (dotBtn) {
            dotBtn.classList.toggle('bg-indigo-200', isDotted);
            dotBtn.classList.toggle('border-indigo-500', isDotted);
            dotBtn.classList.toggle('ring-2', isDotted);
            dotBtn.classList.toggle('ring-indigo-400', isDotted);
            dotBtn.classList.toggle('bg-white', !isDotted);
            dotBtn.classList.toggle('border-slate-200', !isDotted);
        }
        // Note: Duration indicator update is handled by _updateActiveDurationButton
        // Don't call it here as it would override selection-based duration display
    }

    /**
     * Update rest button state (in pinned header)
     */
    _updateRestButton(isRest) {
        if (!this.modal) return;

        // Rest button is in the PINNED header, not sidebar-content
        const restBtn = this.modal.querySelector('.fs-rest-btn');
        if (restBtn) {
            restBtn.classList.toggle('bg-indigo-100', isRest);
            restBtn.classList.toggle('border-indigo-400', isRest);
            restBtn.classList.toggle('bg-white', !isRest);
            restBtn.classList.toggle('border-slate-200', !isRest);
        }
    }

    /**
     * Update voice select dropdown to reflect current voice
     */
    _updateVoiceSelect(voice) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        const voiceSelect = sidebar.querySelector('.fs-voice-select');
        if (voiceSelect) {
            voiceSelect.value = String(voice);
        }
    }

    /**
     * Update rest display mode buttons (Clean vs Show All)
     */
    _updateRestDisplayButtons(mode) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        sidebar.querySelectorAll('.fs-rest-display-btn').forEach(btn => {
            const isActive = btn.dataset.restMode === mode;
            btn.classList.toggle('bg-indigo-100', isActive);
            btn.classList.toggle('border-indigo-400', isActive);
            btn.classList.toggle('bg-white', !isActive);
            btn.classList.toggle('border-slate-200', !isActive);
        });
    }

    /**
     * Update active state of articulation buttons in sidebar
     */
    _updateActiveArticulationButton(activeArticulation) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        sidebar.querySelectorAll('.fs-articulation-btn').forEach(btn => {
            const isActive = btn.dataset.articulation === activeArticulation;
            btn.classList.toggle('bg-emerald-100', isActive);
            btn.classList.toggle('border-emerald-400', isActive);
            btn.classList.toggle('bg-white', !isActive);
            btn.classList.toggle('border-slate-200', !isActive);
        });
    }

    /**
     * Update active state of dynamic buttons in sidebar
     */
    _updateActiveDynamicButton(activeDynamic) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        sidebar.querySelectorAll('.fs-dynamic-btn').forEach(btn => {
            const isActive = btn.dataset.dynamic === activeDynamic;
            btn.classList.toggle('bg-orange-100', isActive);
            btn.classList.toggle('border-orange-400', isActive);
            btn.classList.toggle('bg-white', !isActive);
            btn.classList.toggle('border-slate-200', !isActive);
        });
    }

    /**
     * Update active state of ornament buttons in sidebar
     */
    _updateActiveOrnamentButton(activeOrnament) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        sidebar.querySelectorAll('.fs-ornament-btn').forEach(btn => {
            const isActive = btn.dataset.ornament === activeOrnament;
            btn.classList.toggle('bg-pink-100', isActive);
            btn.classList.toggle('border-pink-400', isActive);
            btn.classList.toggle('bg-white', !isActive);
            btn.classList.toggle('border-slate-200', !isActive);
        });
    }

    /**
     * Update pedal buttons to reflect the selected note's pedal state
     * Mirrors notationToolbar.updatePedalButtonsForSelection()
     */
    _updatePedalButtons(selectionPedal) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        sidebar.querySelectorAll('.fs-pedal-btn').forEach(btn => {
            const pedalType = btn.dataset.pedal;
            const isActive = selectionPedal === pedalType;
            btn.classList.toggle('bg-indigo-100', isActive);
            btn.classList.toggle('border-indigo-500', isActive);
            btn.classList.toggle('bg-white', !isActive);
            btn.classList.toggle('border-slate-200', !isActive);
        });
    }

    /**
     * Update active state of tuplet buttons in sidebar
     * @param {string|null} activeTuplet - 'triplet', 'quintuplet', 'sextuplet', or null
     */
    _updateActiveTupletButton(activeTuplet) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        sidebar.querySelectorAll('.fs-tuplet-btn').forEach(btn => {
            const isActive = btn.dataset.tuplet === activeTuplet;
            btn.classList.toggle('bg-indigo-100', isActive);
            btn.classList.toggle('border-indigo-500', isActive);
            btn.classList.toggle('bg-white', !isActive);
            btn.classList.toggle('border-slate-200', !isActive);
        });
    }

    /**
     * Update slur button to reflect if selected notes have a slur
     * @param {boolean} hasSlur - Whether selected notes have a slur
     */
    _updateSlurButton(hasSlur) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        // Update the slur button (not tie, that's separate)
        const slurBtn = sidebar.querySelector('.fs-slur-btn[data-slur="slur"]');
        if (slurBtn) {
            slurBtn.classList.toggle('bg-indigo-100', hasSlur);
            slurBtn.classList.toggle('border-indigo-500', hasSlur);
            slurBtn.classList.toggle('bg-white', !hasSlur);
            slurBtn.classList.toggle('border-slate-200', !hasSlur);
        }
    }

    /**
     * Update hairpin buttons to reflect selected notes' hairpin state
     * @param {string|null} hairpinType - 'crescendo', 'decrescendo', or null
     */
    _updateHairpinButtons(hairpinType) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        sidebar.querySelectorAll('.fs-hairpin-btn').forEach(btn => {
            const isActive = btn.dataset.hairpin === hairpinType;
            btn.classList.toggle('bg-indigo-100', isActive);
            btn.classList.toggle('border-indigo-500', isActive);
            btn.classList.toggle('bg-white', !isActive);
            btn.classList.toggle('border-slate-200', !isActive);
        });
    }

    /**
     * Update grace note buttons to reflect selected notes' grace note state
     * @param {string|null} graceType - 'acciaccatura', 'appoggiatura', or null
     */
    _updateGraceNoteButtons(graceType) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        sidebar.querySelectorAll('.fs-grace-btn').forEach(btn => {
            const isActive = btn.dataset.grace === graceType;
            btn.classList.toggle('bg-indigo-100', isActive);
            btn.classList.toggle('border-indigo-500', isActive);
            btn.classList.toggle('bg-white', !isActive);
            btn.classList.toggle('border-slate-200', !isActive);
        });
    }

    /**
     * Update beam buttons to reflect selected notes' beam state
     * @param {Object} beamState - Object with start, end, unbeam properties
     */
    _updateBeamButtons(beamState) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        // Beam buttons show active if the selected notes have specific beam settings
        // For now, we'll just show if there's any beam start/end on selected notes
        const hasBeamStart = beamState?.start || false;
        const hasBeamEnd = beamState?.end || false;
        const hasUnbeam = beamState?.unbeam || false;

        // Update the beam button (selection has notes that start a beam)
        const beamBtn = sidebar.querySelector('.fs-beam-btn[data-beam="beam"]');
        if (beamBtn) {
            beamBtn.classList.toggle('bg-indigo-100', hasBeamStart);
            beamBtn.classList.toggle('border-indigo-500', hasBeamStart);
            beamBtn.classList.toggle('bg-white', !hasBeamStart);
            beamBtn.classList.toggle('border-slate-200', !hasBeamStart);
        }

        // Update unbeam button
        const unbeamBtn = sidebar.querySelector('.fs-beam-btn[data-beam="unbeam"]');
        if (unbeamBtn) {
            unbeamBtn.classList.toggle('bg-indigo-100', hasUnbeam);
            unbeamBtn.classList.toggle('border-indigo-500', hasUnbeam);
            unbeamBtn.classList.toggle('bg-white', !hasUnbeam);
            unbeamBtn.classList.toggle('border-slate-200', !hasUnbeam);
        }
    }

    /**
     * Update tie button to reflect if selected notes are tied
     * @param {boolean} isTied - Whether selected notes have a tie
     */
    _updateTieButton(isTied) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        const tieBtn = sidebar.querySelector('.fs-slur-btn[data-slur="tie"]');
        if (tieBtn) {
            tieBtn.classList.toggle('bg-indigo-100', isTied);
            tieBtn.classList.toggle('border-indigo-500', isTied);
            tieBtn.classList.toggle('bg-white', !isTied);
            tieBtn.classList.toggle('border-slate-200', !isTied);
        }
    }

    /**
     * Update volta buttons to show which volta applies to selected measure(s)
     * Mirrors notationToolbar.updateVoltaButtonsForSelection()
     */
    _updateVoltaButtons(selectionMeasureIndices) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        // Get composition state to check volta brackets
        const compositionState = window.getCompositionState?.();

        // Find which volta numbers apply to the selected measure(s)
        const activeVoltaNumbers = new Set();

        if (compositionState && selectionMeasureIndices && selectionMeasureIndices.size > 0) {
            for (const measureIndex of selectionMeasureIndices) {
                const volta = compositionState.getVoltaForMeasure?.(measureIndex);
                if (volta) {
                    activeVoltaNumbers.add(String(volta.number));
                }
            }
        }

        // Update button states
        sidebar.querySelectorAll('.fs-volta-btn').forEach(btn => {
            const voltaId = btn.dataset.volta;
            const isActive = activeVoltaNumbers.has(voltaId);

            btn.classList.toggle('bg-indigo-100', isActive);
            btn.classList.toggle('border-indigo-500', isActive);
            btn.classList.toggle('bg-white', !isActive);
            btn.classList.toggle('border-slate-200', !isActive);

            // Update title based on state
            if (isActive) {
                btn.title = `Remove ${voltaId === '1' ? '1st' : '2nd'} ending from this measure`;
            } else {
                btn.title = `Add ${voltaId === '1' ? '1st' : '2nd'} ending to selected measure`;
            }
        });
    }

    /**
     * Update repeat sign buttons to show which repeat applies to selected measure(s)
     * Mirrors notationToolbar.updateRepeatButtonsForSelection()
     */
    _updateRepeatButtons(selectionMeasureIndices) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        // Get composition state to check repeat signs
        const compositionState = window.getCompositionState?.();

        // Find which repeat types apply to the selected measure(s)
        const activeRepeatTypes = new Set();

        if (compositionState && selectionMeasureIndices && selectionMeasureIndices.size > 0) {
            for (const measureIndex of selectionMeasureIndices) {
                const repeat = compositionState.getRepeatSignForMeasure?.(measureIndex);
                if (repeat) {
                    activeRepeatTypes.add(repeat.type);
                }
            }
        }

        // Update button states
        sidebar.querySelectorAll('.fs-repeat-btn').forEach(btn => {
            const repeatType = btn.dataset.repeat;
            const isActive = activeRepeatTypes.has(repeatType);

            btn.classList.toggle('bg-indigo-100', isActive);
            btn.classList.toggle('border-indigo-500', isActive);
            btn.classList.toggle('bg-white', !isActive);
            btn.classList.toggle('border-slate-200', !isActive);

            // Update title based on state
            const labels = {
                'repeatStart': 'Repeat Start |:',
                'repeatEnd': 'Repeat End :|',
                'repeatBoth': 'Repeat Both :|:'
            };
            if (isActive) {
                btn.title = `Remove ${labels[repeatType] || repeatType} from this measure`;
            } else {
                btn.title = `Add ${labels[repeatType] || repeatType} to selected measure`;
            }
        });
    }

    /**
     * Update lyric button/indicator to show if selected note has a lyric
     * Mirrors notationToolbar.updateLyricButtonsForSelection()
     */
    _updateLyricButtons(selectionHasLyric) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar) return;

        const applyBtn = sidebar.querySelector('.fs-lyric-apply-btn');
        if (applyBtn) {
            applyBtn.classList.toggle('bg-indigo-700', selectionHasLyric);
            applyBtn.classList.toggle('bg-indigo-600', !selectionHasLyric);
        }
    }

    /**
     * Update chord label button state
     */
    _updateChordButtons(/* future: selectionHasChord */) {
        // Currently the chord apply button doesn't have a toggle state
        // This can be extended in the future to show if selected note has a chord label
    }

    /**
     * Update selection info display
     */
    _updateSelectionInfo(count) {
        const selectionInfo = this.modal?.querySelector('#fs-selection-info');
        const selectionCount = this.modal?.querySelector('#fs-selection-count');
        if (!selectionInfo || !selectionCount) return;

        if (count > 0) {
            selectionInfo.classList.remove('hidden');
            selectionCount.textContent = `${count} note${count !== 1 ? 's' : ''} selected`;
        } else {
            selectionInfo.classList.add('hidden');
            selectionCount.textContent = 'No selection';
        }
    }

    /**
     * Initialize sidebar state from current toolbar state
     */
    _initializeSidebarFromToolbar() {
        const composer = window.getNotationComposer?.();
        if (!composer?.toolbar) return;

        const toolbar = composer.toolbar;

        // Set initial states
        this._updateActiveDurationButton(toolbar.currentDuration);
        this._updateDotButton(toolbar.isDotted);
        this._updateRestButton(toolbar.isRestMode);
        this._updateVoiceButtons(toolbar.voiceNumber || 1);
        this._updateRestDisplayButtons(toolbar.restDisplayMode || 'clean');
        this._updateActiveAccidentalButton(toolbar.currentAccidental);
        this._updateActiveArticulationButton(toolbar.currentArticulation);
        this._updateActiveDynamicButton(toolbar.currentDynamic);
        this._updateActiveOrnamentButton(null);
        this._updatePedalButtons(toolbar.selectionPedal);
        this._updateVoltaButtons(toolbar.selectionMeasureIndices);
        this._updateRepeatButtons(toolbar.selectionMeasureIndices);
        this._updateLyricButtons(toolbar.selectionHasLyric);
        this._updateSelectionInfo(toolbar.selectedNotesCount || 0);
        // Initialize contextual button states
        this._updateContextualButtonStates(toolbar);
    }

    /**
     * Update contextual button enable/disable states based on selection
     * Mirrors the logic from notationToolbar.updateContextualButtonStates()
     * @param {Object} toolbar - The main notation toolbar instance
     */
    _updateContextualButtonStates(toolbar) {
        const sidebar = this.modal?.querySelector('#fullscreen-sidebar-content');
        if (!sidebar || !toolbar) return;

        // Helper to set button disabled state
        const setButtonState = (selector, enabled) => {
            sidebar.querySelectorAll(selector).forEach(btn => {
                btn.disabled = !enabled;
                if (enabled) {
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                    btn.classList.add('hover:bg-opacity-100');
                } else {
                    btn.classList.add('opacity-50', 'cursor-not-allowed');
                    btn.classList.remove('hover:bg-opacity-100');
                }
            });
        };

        const count = toolbar.selectedNotesCount || 0;
        const has1 = count >= 1;
        const has2 = count >= 2;

        // --- Buttons requiring 1+ notes selected ---
        setButtonState('.fs-articulation-btn', has1);
        setButtonState('.fs-dynamic-btn', has1);
        setButtonState('.fs-ornament-btn', has1);

        // --- Buttons requiring 2+ notes selected ---
        // Slurs, ties
        setButtonState('.fs-slur-btn[data-slur="tie"]', toolbar.canTie);
        setButtonState('.fs-slur-btn[data-slur="slur"]', toolbar.canSlur);

        // Hairpins require 2+ notes
        setButtonState('.fs-hairpin-btn', toolbar.canHairpin);

        // --- Tuplet buttons (require exact counts) ---
        // Triplet: exactly 3 consecutive notes
        // Quintuplet: exactly 5 consecutive notes
        // Sextuplet: exactly 6 consecutive notes
        // When no notes selected, enable as "insert mode" buttons
        setButtonState('.fs-tuplet-btn[data-tuplet="triplet"]', toolbar.canTriplet || count === 0);
        setButtonState('.fs-tuplet-btn[data-tuplet="quintuplet"]', toolbar.canQuintuplet || count === 0);
        setButtonState('.fs-tuplet-btn[data-tuplet="sextuplet"]', toolbar.canSextuplet || count === 0);

        // --- Beam buttons ---
        // Beam selected: 2+ consecutive beamable notes in same measure
        setButtonState('.fs-beam-btn[data-beam="beam"]', toolbar.canBeamSelected);
        // Break beams between: exactly 2 notes in same beam group
        setButtonState('.fs-beam-btn[data-beam="breakBetween"]', toolbar.canBreakBeamsBetween);
        // Unbeam selected: 1+ notes
        setButtonState('.fs-beam-btn[data-beam="unbeam"]', has1);
        // Clear manual beam settings: 1+ notes
        setButtonState('.fs-beam-btn[data-beam="clear"]', has1);
        // Clear measure beams: always enabled (user can select a measure)
        setButtonState('.fs-beam-btn[data-action="clearMeasureBeams"]', true);

        // --- Remove buttons (require notes with that feature) ---
        setButtonState('.fs-slur-btn[data-slur="remove-slur"]', toolbar.notesInSlur);
        setButtonState('.fs-tuplet-remove-btn', has1 && toolbar.selectionTuplet);
        setButtonState('.fs-ornament-remove-btn', toolbar.hasOrnaments);
        setButtonState('.fs-hairpin-remove-btn', toolbar.notesInHairpin);
        setButtonState('.fs-grace-remove-btn', toolbar.hasGraceNotes);
        setButtonState('.fs-grace-transpose-btn', toolbar.hasGraceNotes);

        // --- Grace note buttons (require 1+ notes) ---
        setButtonState('.fs-grace-btn', has1);

        // --- Quick actions ---
        setButtonState('.fs-action-btn[data-action="copy"]', has1);
        setButtonState('.fs-action-btn[data-action="paste"]', true); // Always enabled if clipboard has content
        setButtonState('.fs-action-btn[data-action="octave-up"]', has1);
        setButtonState('.fs-action-btn[data-action="octave-down"]', has1);
        setButtonState('.fs-action-btn[data-action="delete"]', has1);

        // --- Pedal buttons (require 1+ notes) ---
        setButtonState('.fs-pedal-btn', has1);

        // --- Repeat/Volta buttons (require measure selection) ---
        const hasMeasure = toolbar.hasMeasureSelection;
        setButtonState('.fs-repeat-btn', hasMeasure);
        setButtonState('.fs-volta-btn', hasMeasure);
        setButtonState('.fs-volta-remove-btn', hasMeasure);

        // --- Lyric/Chord buttons (require 1+ notes) ---
        setButtonState('.fs-lyric-apply-btn', has1);
        setButtonState('.fs-chord-apply-btn', has1);
    }

    // ========================================================================
    // ZOOM-AWARE COORDINATE HANDLING
    // ========================================================================

    /**
     * Patch PageManager.getPageFromEvent to account for zoom level
     * This ensures clicks/double-clicks work correctly at any zoom level
     */
    _patchPageManagerForZoom() {
        // Get the NotationComposer's PageManager
        const composer = window.getNotationComposer?.();
        if (!composer || !composer.pageManager) {
            console.warn('FullScreenNotationEditor: Could not get PageManager for zoom patching');
            return;
        }

        const pageManager = composer.pageManager;
        const self = this;

        // Store original method
        if (!this._originalGetPageFromEvent) {
            this._originalGetPageFromEvent = pageManager.getPageFromEvent.bind(pageManager);
        }

        // Replace with zoom-aware version
        // IMPORTANT: Use arrow function to preserve pageManager as 'this', and capture 'self' for fullscreen state
        const originalGetPageFromEvent = this._originalGetPageFromEvent;
        pageManager.getPageFromEvent = (e) => {
            // Call original method to get base result
            const result = originalGetPageFromEvent(e);

            if (!result) {
                return null;
            }

            const { page, x, y } = result;

            // ZOOM COMPENSATION: When zoomed, we need to adjust coordinates
            // The original getPageFromEvent uses getBoundingClientRect() which returns ZOOMED dimensions
            // But the coordinates it calculates are relative to the zoomed display
            // We need to convert back to canvas internal coordinates
            //
            // IMPORTANT: Canvas may have 2x internal resolution for retina displays
            // (canvas.width = 2406, but CSS displays it at 1203px base)
            // So we use the zoom level directly, not the rect/canvas ratio
            if (self.isOpen && self.zoomLevel !== 100) {
                // The zoom transform scales everything by zoomLevel/100
                // Original coordinates are in "zoomed screen space"
                // We need to divide by zoom factor to get back to "base screen space"
                // which matches the internal coordinate system that note regions use
                const zoomFactor = self.zoomLevel / 100;
                const adjustedX = x / zoomFactor;
                const adjustedY = y / zoomFactor;
                return { page, x: adjustedX, y: adjustedY };
            }

            return result;
        };
    }

    /**
     * Restore PageManager to its original state
     */
    _restorePageManager() {
        if (!this._originalGetPageFromEvent) return;

        const composer = window.getNotationComposer?.();
        if (!composer || !composer.pageManager) return;

        // Restore original method
        composer.pageManager.getPageFromEvent = this._originalGetPageFromEvent;
        this._originalGetPageFromEvent = null;
    }

    // ========================================================================
    // NOTATION ELEMENT MANAGEMENT
    // ========================================================================

    /**
     * Capture notation elements and move them to full-screen container
     */
    _captureNotationElements() {
        // Store reference to original container
        this.originalPagesContainer = document.getElementById('notation-pages-container');

        if (!this.originalPagesContainer) {
            console.warn('FullScreenNotationEditor: notation-pages-container not found');
            return;
        }

        // Get fullscreen container
        const fullscreenPages = this.modal.querySelector('#fullscreen-pages-container');
        if (!fullscreenPages) return;

        // Clear any existing content in fullscreen container
        fullscreenPages.innerHTML = '';

        // Move all page canvases to fullscreen container
        // Pages have class "notation-page" and id like "notation-page-0"
        const pageCanvases = this.originalPagesContainer.querySelectorAll('.notation-page');
        pageCanvases.forEach(canvas => {
            // Store original parent reference
            canvas._originalParent = canvas.parentElement;
            canvas._originalNextSibling = canvas.nextSibling;

            // Move to fullscreen container
            fullscreenPages.appendChild(canvas);
        });

        // If no pages with .notation-page class, try canvas elements directly
        if (pageCanvases.length === 0) {
            const allCanvases = this.originalPagesContainer.querySelectorAll('canvas');
            allCanvases.forEach(canvas => {
                canvas._originalParent = canvas.parentElement;
                canvas._originalNextSibling = canvas.nextSibling;
                fullscreenPages.appendChild(canvas);
            });
        }

        // Also capture any overlay elements (chord brackets, labels, etc.)
        // These are typically positioned absolutely relative to the container
        const overlays = this.originalPagesContainer.querySelectorAll('.notation-overlay, .chord-bracket-overlay, .chord-label-overlay, [class*="overlay"]');
        overlays.forEach(overlay => {
            overlay._originalParent = overlay.parentElement;
            overlay._originalNextSibling = overlay.nextSibling;
            fullscreenPages.appendChild(overlay);
        });
    }

    /**
     * Restore notation elements to their original location
     */
    _restoreNotationElements() {
        const fullscreenPages = this.modal.querySelector('#fullscreen-pages-container');
        if (!fullscreenPages || !this.originalPagesContainer) return;

        // Move elements back to original container
        // Collect all children that have original parent references
        const elements = Array.from(fullscreenPages.children);
        elements.forEach(el => {
            if (el._originalParent) {
                if (el._originalNextSibling && el._originalNextSibling.parentElement === el._originalParent) {
                    el._originalParent.insertBefore(el, el._originalNextSibling);
                } else {
                    el._originalParent.appendChild(el);
                }
                // Clean up references
                delete el._originalParent;
                delete el._originalNextSibling;
            } else {
                // Fallback: append to original container
                this.originalPagesContainer.appendChild(el);
            }
        });
    }

    // ========================================================================
    // HEADER INFO
    // ========================================================================

    /**
     * Update header with title, composer, and key/time signature
     */
    _updateHeaderInfo(settings) {
        const compState = getCompositionState();

        // Update title display
        const titleEl = this.modal.querySelector('#fs-composition-title');
        if (titleEl) {
            const title = compState?.metadata?.title || 'Untitled Composition';
            titleEl.textContent = title;
        }

        // Update composer display (shown inline with title, separated by dash)
        const composerEl = this.modal.querySelector('#fs-composition-composer');
        if (composerEl) {
            const composer = compState?.metadata?.composer;
            if (composer) {
                composerEl.textContent = `— ${composer}`;
                composerEl.classList.remove('hidden');
            } else {
                composerEl.textContent = '';
                composerEl.classList.add('hidden');
            }
        }

        // Update key/time badge
        const badge = this.modal.querySelector('#fullscreen-key-time-badge');
        if (badge) {
            const key = settings.key || 'C';
            const mode = settings.mode || 'Major';
            const timeSig = settings.timeSignature || '4/4';
            badge.textContent = `${key} ${mode} • ${timeSig}`;
        }
    }

    // ========================================================================
    // SIDEBAR
    // ========================================================================

    /**
     * Toggle sidebar visibility
     */
    _toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
        this._saveToStorage(STORAGE_KEYS.SIDEBAR, this.sidebarOpen);
        this._applySidebarState();
    }

    /**
     * Apply current sidebar state to DOM
     */
    _applySidebarState() {
        const sidebar = this.modal.querySelector('#fullscreen-sidebar');
        const sidebarContent = sidebar?.querySelector('.sidebar-content');
        const toggleStrip = sidebar?.querySelector('.sidebar-toggle-strip');

        if (!sidebar) return;

        if (this.sidebarOpen) {
            sidebar.classList.remove('w-6');
            sidebar.classList.add('w-64');
            sidebarContent?.classList.remove('hidden');
            toggleStrip?.classList.add('hidden');
        } else {
            sidebar.classList.remove('w-64');
            sidebar.classList.add('w-6');
            sidebarContent?.classList.add('hidden');
            toggleStrip?.classList.remove('hidden');
        }

        // Adjust bottom panel width to account for sidebar
        this._adjustBottomPanelForSidebar();
    }

    /**
     * Toggle bottom panel open/closed
     */
    _toggleBottomPanel() {
        this.bottomPanelOpen = !this.bottomPanelOpen;
        this._saveToStorage(STORAGE_KEYS.BOTTOM_PANEL, this.bottomPanelOpen);
        this._applyBottomPanelState();
    }

    /**
     * Apply current bottom panel state to DOM
     */
    _applyBottomPanelState() {
        const panel = this.modal.querySelector('#fullscreen-bottom-panel');
        const content = panel?.querySelector('#bottom-panel-content');
        const chevron = panel?.querySelector('.bottom-panel-chevron');

        if (!panel || !content) return;

        if (this.bottomPanelOpen) {
            content.classList.remove('h-0');
            content.classList.add('h-[140px]');
            chevron?.classList.remove('rotate-180');
        } else {
            content.classList.remove('h-[140px]');
            content.classList.add('h-0');
            chevron?.classList.add('rotate-180');
        }
    }

    /**
     * Adjust bottom panel margin when sidebar state changes
     * Note: With the new layout (sidebar spans full height, bottom panel in right area),
     * no margin adjustment is needed - the flexbox handles it automatically.
     */
    _adjustBottomPanelForSidebar() {
        // No adjustment needed - layout handles sidebar/panel positioning automatically
    }

    // ========================================================================
    // CHORD PROGRESSION PANEL
    // ========================================================================

    /**
     * Update the view mode buttons to reflect current state
     */
    _updateViewModeButtons() {
        const buttons = this.modal.querySelectorAll('.fs-view-mode-btn');
        buttons.forEach(btn => {
            const mode = btn.dataset.mode;
            if (mode === this.fullscreenViewMode) {
                // Active state - white background with indigo text
                btn.classList.add('bg-white', 'shadow', 'text-indigo-600');
                btn.classList.remove('text-white/80', 'hover:text-white', 'hover:bg-white/10');
                btn.style.setProperty('-webkit-text-fill-color', '#4f46e5');
            } else {
                // Inactive state - transparent with white text
                btn.classList.remove('bg-white', 'shadow', 'text-indigo-600');
                btn.classList.add('text-white/80', 'hover:text-white', 'hover:bg-white/10');
                btn.style.setProperty('-webkit-text-fill-color', 'inherit');
            }
        });
    }

    // ========================================================================
    // TITLE/COMPOSER EDITOR
    // ========================================================================

    /**
     * Escape HTML special characters to prevent XSS
     */
    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show the title/composer editor popover
     */
    _showTitleComposerEditor() {
        // Don't open if already open
        if (this.modal.querySelector('#fs-title-editor-popover')) {
            return;
        }

        const compState = getCompositionState();
        const currentTitle = compState?.metadata?.title || '';
        const currentComposer = compState?.metadata?.composer || '';

        // Create popover with two input fields
        const popover = document.createElement('div');
        popover.id = 'fs-title-editor-popover';
        popover.className = 'absolute top-14 left-20 bg-white rounded-lg shadow-2xl p-4 z-[100000] w-80 border border-gray-200';
        popover.innerHTML = `
            <div class="space-y-3">
                <div class="flex items-center justify-between mb-2">
                    <h3 class="text-sm font-semibold text-gray-800">Edit Composition Info</h3>
                    <button id="fs-title-close" class="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Title</label>
                    <input type="text" id="fs-title-input"
                           class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                           placeholder="Untitled Composition" value="${this._escapeHtml(currentTitle)}" maxlength="100">
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-600 mb-1">Composer</label>
                    <input type="text" id="fs-composer-input"
                           class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                           placeholder="Optional" value="${this._escapeHtml(currentComposer)}" maxlength="100">
                </div>
                <div class="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button id="fs-title-cancel" class="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded transition-colors">
                        Cancel
                    </button>
                    <button id="fs-title-save" class="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors font-medium">
                        Save
                    </button>
                </div>
            </div>
        `;

        this.modal.appendChild(popover);

        // Focus title input
        const titleInput = popover.querySelector('#fs-title-input');
        titleInput.focus();
        titleInput.select();

        // Attach handlers
        popover.querySelector('#fs-title-save').addEventListener('click', () => this._saveTitleComposer());
        popover.querySelector('#fs-title-cancel').addEventListener('click', () => this._closeTitleEditor());
        popover.querySelector('#fs-title-close').addEventListener('click', () => this._closeTitleEditor());

        // Save on Enter in either input
        popover.querySelectorAll('input').forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this._saveTitleComposer();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this._closeTitleEditor();
                }
            });
        });

        // Close on click outside
        this._titleEditorClickOutsideHandler = (e) => {
            if (!popover.contains(e.target) && !e.target.closest('#fs-title-composer')) {
                this._closeTitleEditor();
            }
        };
        setTimeout(() => {
            document.addEventListener('click', this._titleEditorClickOutsideHandler);
        }, 10);
    }

    /**
     * Save title and composer from the editor popover
     */
    _saveTitleComposer() {
        const titleInput = this.modal.querySelector('#fs-title-input');
        const composerInput = this.modal.querySelector('#fs-composer-input');

        if (!titleInput || !composerInput) return;

        const compState = getCompositionState();
        if (compState?.metadata) {
            compState.metadata.title = titleInput.value.trim();
            compState.metadata.composer = composerInput.value.trim();

            // Emit event for other listeners
            if (typeof compState.emit === 'function') {
                compState.emit('metadataChanged', { field: 'title', value: compState.metadata.title });
            }
        }

        // Update header display
        this._updateHeaderInfo(compState?.getSettings?.() || {});

        // Close editor
        this._closeTitleEditor();

        // Refresh notation to show title/composer in sheet music
        this._refreshNotationAfterTitleChange();
    }

    /**
     * Close the title/composer editor popover
     */
    _closeTitleEditor() {
        const popover = this.modal.querySelector('#fs-title-editor-popover');
        if (popover) {
            popover.remove();
        }

        // Remove click outside handler
        if (this._titleEditorClickOutsideHandler) {
            document.removeEventListener('click', this._titleEditorClickOutsideHandler);
            this._titleEditorClickOutsideHandler = null;
        }
    }

    /**
     * Refresh notation after title/composer change
     */
    _refreshNotationAfterTitleChange() {
        // Trigger re-render of notation to show updated title/composer
        // The grandStaff.js will pick up the new values from compositionState
        if (typeof window.refreshNotationFromProgression === 'function') {
            window.refreshNotationFromProgression();
        }
    }

    /**
     * Render the chord progression in the bottom panel
     */
    _renderChordProgression() {
        const container = this.modal.querySelector('#fs-chord-cards-container');
        const sectionPicker = this.modal.querySelector('#fs-section-picker');

        if (!container) return;

        // Update view mode buttons
        this._updateViewModeButtons();

        // Get composition state and progression data
        const compState = getCompositionState();
        if (!compState) {
            container.innerHTML = '<div class="text-gray-500 text-sm">No progression loaded</div>';
            return;
        }

        // Try multiple methods to get chords - the data might be in different places
        let chords = [];

        // Method 1: getChords() - reads from measures (single source of truth)
        if (typeof compState.getChords === 'function') {
            chords = compState.getChords() || [];
        }

        // Method 2: exportToProgressionData() - fallback
        if (chords.length === 0) {
            const progressionData = compState.exportToProgressionData();
            chords = Array.isArray(progressionData) ? progressionData : [];
        }

        // Method 3: storedProgressionData directly - another fallback
        if (chords.length === 0 && compState.storedProgressionData) {
            chords = compState.storedProgressionData;
        }

        const key = compState.getSettings?.()?.key || 'C';
        const sections = compState.getSections?.() || [];

        // Clear existing content
        container.innerHTML = '';

        if (chords.length === 0) {
            container.innerHTML = '<div class="text-gray-500 text-sm">No chords in progression</div>';
            if (sectionPicker) sectionPicker.classList.add('hidden');
            return;
        }

        if (this.fullscreenViewMode === 'section' && sections.length > 0) {
            // Show section picker and render section view
            if (sectionPicker) {
                sectionPicker.classList.remove('hidden');
                this._renderSectionPicker(sectionPicker, sections);
            }
            this._renderSectionViewCards(container, chords, key, sections);
        } else {
            // Hide section picker, show scroll view
            if (sectionPicker) sectionPicker.classList.add('hidden');
            this._renderScrollViewCards(container, chords, key);
        }
    }

    /**
     * Render all cards in scroll view (horizontal scrolling)
     */
    _renderScrollViewCards(container, chords, key) {
        chords.forEach((chord, index) => {
            const card = this._createSimplifiedCard(chord, index, key);
            container.appendChild(card);
        });
    }

    /**
     * Render cards grouped by selected sections
     */
    _renderSectionViewCards(container, chords, key, sections) {
        // If no sections selected, show all sections
        const selectedIds = this.selectedFsSectionIds.size > 0
            ? this.selectedFsSectionIds
            : new Set(sections.map(s => s.id));

        // Build a map of chord index to section using startIndex + chordCount
        const chordToSection = new Map();
        sections.forEach(section => {
            const startIdx = section.startIndex ?? 0;
            const count = section.chordCount ?? 0;
            for (let i = startIdx; i < startIdx + count; i++) {
                chordToSection.set(i, section);
            }
        });

        // Filter to only selected sections and sort by startIndex
        const selectedSections = sections
            .filter(s => selectedIds.has(s.id) && (s.chordCount ?? 0) > 0)
            .sort((a, b) => (a.startIndex ?? 0) - (b.startIndex ?? 0));

        // Render each section as a group with a header
        selectedSections.forEach((section, sectionIdx) => {
            const startIdx = section.startIndex ?? 0;
            const count = section.chordCount ?? 0;

            // Create section group container
            const sectionGroup = document.createElement('div');
            sectionGroup.className = 'fs-section-group flex items-start gap-2';
            if (sectionIdx > 0) {
                sectionGroup.classList.add('ml-4'); // Add spacing between sections
            }

            // Create section header/label
            const sectionHeader = document.createElement('div');
            sectionHeader.className = 'fs-section-header flex flex-col items-center justify-center px-2 py-1 rounded-lg flex-shrink-0';
            sectionHeader.style.cssText = `
                background-color: ${section.color || '#6b7280'}20;
                border-left: 3px solid ${section.color || '#6b7280'};
                min-width: 60px;
                height: 90px;
            `;
            sectionHeader.innerHTML = `
                <span class="text-[10px] font-bold text-center leading-tight"
                      style="color: ${section.color || '#6b7280'}; -webkit-text-fill-color: ${section.color || '#6b7280'};">
                    ${section.label || 'Untitled'}
                </span>
                <span class="text-[8px] text-gray-500 mt-1" style="-webkit-text-fill-color: #6b7280;">
                    ${count} chord${count !== 1 ? 's' : ''}
                </span>
            `;
            sectionGroup.appendChild(sectionHeader);

            // Create cards container for this section
            const cardsContainer = document.createElement('div');
            cardsContainer.className = 'flex gap-2';

            // Add chord cards for this section
            for (let i = startIdx; i < startIdx + count && i < chords.length; i++) {
                const chord = chords[i];
                if (chord) {
                    const card = this._createSimplifiedCard(chord, i, key, section);
                    cardsContainer.appendChild(card);
                }
            }

            sectionGroup.appendChild(cardsContainer);
            container.appendChild(sectionGroup);

            // Add a visual separator between sections (except after last)
            if (sectionIdx < selectedSections.length - 1) {
                const separator = document.createElement('div');
                separator.className = 'fs-section-separator flex-shrink-0 w-px bg-gray-300 mx-2 self-stretch';
                separator.style.minHeight = '80px';
                container.appendChild(separator);
            }
        });

        // If no sections have chords, show a message
        if (selectedSections.length === 0) {
            container.innerHTML = '<div class="text-gray-500 text-sm">No chords in selected sections</div>';
        }
    }

    /**
     * Create a simplified chord card for the bottom panel
     * Matches the style of cards in the main Composition Studio
     */
    _createSimplifiedCard(chord, index, key, section = null) {
        const wrapper = document.createElement('div');
        wrapper.className = 'chord-card-fs-wrapper flex-shrink-0';
        wrapper.setAttribute('data-chord-index', index);
        wrapper.style.width = '118px';

        // Get chord symbol from definitions
        const CHORD_DEFINITIONS = window.CHORD_DEFINITIONS || {};
        const typeSymbol = CHORD_DEFINITIONS[chord.type]?.symbol || '';
        const displayRoot = this._spellNoteInKey(chord.root || 'C', key);
        const chordSymbol = chord.simpleName || (displayRoot + typeSymbol);

        // Get roman numeral and function colors
        const roman = this._getRomanNumeralForChord(chord, key);
        const colors = this._getFunctionColors(roman);

        // Inversion superscript - handle both number and string types
        const inversionNum = parseInt(chord.inversion, 10) || 0;
        let inversionText = '';
        if (inversionNum === 1) inversionText = '¹';
        else if (inversionNum === 2) inversionText = '²';
        else if (inversionNum === 3) inversionText = '³';
        else if (inversionNum === 4) inversionText = '⁴';

        // Beats display
        const totalBeats = chord.beats !== undefined ? chord.beats : 4;

        // Function-based border color
        const functionBorderStyle = colors.hexColor ? `border-color: ${colors.hexColor};` : '';

        wrapper.innerHTML = `
            <div class="relative border border-gray-300 rounded-xl p-1">
                <div class="simplified-card-fs bg-gradient-to-br from-gray-800 to-gray-900 border-2 rounded-xl overflow-hidden hover:shadow-xl transition-all shadow-lg relative w-full" style="min-height: 70px; ${functionBorderStyle}">
                    <!-- Inversion indicator (top-left corner) -->
                    ${inversionText ? `<div class="absolute top-1 left-1.5 text-xl text-red-400 font-bold" style="-webkit-text-fill-color: #f87171;">${inversionText}</div>` : ''}

                    <!-- Main content: horizontal layout with chord info on left, buttons on right -->
                    <div class="chord-info-view flex items-center justify-between h-full p-2 pt-2.5">
                        <!-- Left: Chord info (drag handle area) -->
                        <div class="flex flex-col items-center flex-1 cursor-pointer" title="Click to select measure">
                            <!-- Chord Symbol -->
                            <div class="text-base font-bold text-white mb-0.5" style="-webkit-text-fill-color: #ffffff;">${chordSymbol}</div>
                            <!-- Roman Numeral -->
                            <div class="text-xs font-bold" style="color: ${colors.hexColor || '#9ca3af'}; -webkit-text-fill-color: ${colors.hexColor || '#9ca3af'};">${roman}</div>
                            <!-- Position Label -->
                            <div class="text-[9px] text-gray-400 mt-0.5" style="-webkit-text-fill-color: #9ca3af;">Pos: ${index + 1}</div>
                        </div>

                        <!-- Right: Vertically stacked compact buttons -->
                        <div class="flex flex-col gap-0.5 ml-1">
                            <button class="fs-card-play-btn px-1 py-0.5 bg-white hover:bg-gray-100 rounded transition shadow-sm flex items-center justify-center" title="Play chord" data-index="${index}">
                                <svg class="w-2.5 h-2.5" fill="#1f2937" viewBox="0 0 20 20">
                                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z"></path>
                                </svg>
                            </button>
                            <button class="fs-card-suggestions-btn px-1 py-0.5 bg-amber-500 hover:bg-amber-600 rounded transition shadow-sm flex items-center justify-center" title="Suggestions" data-index="${index}">
                                <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Controls below card: beats display -->
                <div class="flex items-center justify-center gap-1 mt-1">
                    <span class="text-[10px] text-gray-600 font-medium" style="-webkit-text-fill-color: #4b5563;">${totalBeats} beat${totalBeats !== 1 ? 's' : ''}</span>
                </div>
            </div>
        `;

        // Add click handler on chord info area to select/highlight the corresponding measure
        const chordInfoArea = wrapper.querySelector('.chord-info-view > div:first-child');
        chordInfoArea?.addEventListener('click', () => {
            this._selectMeasureFromCard(index);
        });

        // Add play button handler
        const playBtn = wrapper.querySelector('.fs-card-play-btn');
        playBtn?.addEventListener('mousedown', () => {
            this._playChordFromCard(chord);
        });
        playBtn?.addEventListener('mouseup', () => {
            this._stopChordFromCard();
        });
        playBtn?.addEventListener('mouseleave', () => {
            this._stopChordFromCard();
        });

        // Add suggestions button handler
        const suggestionsBtn = wrapper.querySelector('.fs-card-suggestions-btn');
        suggestionsBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._showSuggestionsFromCard(index);
        });

        return wrapper;
    }

    /**
     * Get function-based colors for chord display
     */
    _getFunctionColors(roman) {
        const func = this._getChordFunction(roman);

        const colorMap = {
            'Tonic': { hexColor: '#10b981' },      // emerald-500
            'Dominant': { hexColor: '#ef4444' },   // red-500
            'Subdominant': { hexColor: '#3b82f6' }, // blue-500
            'Predominant': { hexColor: '#8b5cf6' }, // violet-500
            'Mediant': { hexColor: '#f59e0b' },    // amber-500
            'default': { hexColor: '#6b7280' }     // gray-500
        };

        return colorMap[func] || colorMap['default'];
    }

    /**
     * Get chord function from roman numeral
     */
    _getChordFunction(roman) {
        if (!roman) return 'default';

        // Strip modifiers for basic analysis
        const base = roman.replace(/[♭♯b#°ø+]/g, '').toUpperCase();

        if (base === 'I' || base === 'III' || base === 'VI') return 'Tonic';
        if (base === 'V' || base === 'VII') return 'Dominant';
        if (base === 'IV' || base === 'II') return 'Subdominant';

        return 'default';
    }

    /**
     * Play chord from card
     */
    _playChordFromCard(chord) {
        // Use the chord's notes array for accurate playback
        const piano = window.getPiano?.();
        if (piano && chord.notes && chord.notes.length > 0) {
            piano.triggerAttack(chord.notes);
        }
    }

    /**
     * Stop chord playback from card
     */
    _stopChordFromCard() {
        const piano = window.getPiano?.();
        if (piano) {
            piano.releaseAll?.();
        }
    }

    /**
     * Show suggestions modal from card
     */
    _showSuggestionsFromCard(index) {
        // Use the global function if available
        if (typeof window.showProgressionChordSuggestions === 'function') {
            window.showProgressionChordSuggestions(index);
        }
    }

    /**
     * Render section picker for section view mode
     */
    _renderSectionPicker(container, sections) {
        // If no sections selected yet, default to all
        if (this.selectedFsSectionIds.size === 0) {
            sections.forEach(s => this.selectedFsSectionIds.add(s.id));
        }

        const allSelected = this.selectedFsSectionIds.size === sections.length;

        container.innerHTML = `
            <div class="flex items-center gap-2 px-2 py-1 bg-gray-100 border-b border-gray-200">
                <button class="fs-section-all px-2 py-0.5 text-xs rounded transition-colors
                               ${allSelected ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
                        style="${allSelected ? '-webkit-text-fill-color: #ffffff;' : '-webkit-text-fill-color: #374151;'}">
                    All
                </button>
                <div class="flex gap-1 overflow-x-auto">
                    ${sections.map(s => {
                        const isSelected = this.selectedFsSectionIds.has(s.id);
                        return `
                            <button class="fs-section-chip px-2 py-0.5 text-xs rounded-full border transition-colors whitespace-nowrap"
                                    data-section-id="${s.id}"
                                    style="border-color: ${s.color};
                                           ${isSelected ? `background-color: ${s.color}; color: white; -webkit-text-fill-color: white;` : `color: ${s.color}; -webkit-text-fill-color: ${s.color};`}">
                                ${s.label || 'Untitled'}
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        // Attach click handlers
        const allBtn = container.querySelector('.fs-section-all');
        allBtn?.addEventListener('click', () => {
            this.selectedFsSectionIds = new Set(sections.map(s => s.id));
            this._renderChordProgression();
        });

        container.querySelectorAll('.fs-section-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const sectionId = chip.dataset.sectionId;
                if (this.selectedFsSectionIds.has(sectionId)) {
                    this.selectedFsSectionIds.delete(sectionId);
                    // Ensure at least one section is selected
                    if (this.selectedFsSectionIds.size === 0) {
                        this.selectedFsSectionIds.add(sectionId);
                    }
                } else {
                    this.selectedFsSectionIds.add(sectionId);
                }
                this._renderChordProgression();
            });
        });
    }

    /**
     * Select and highlight a measure when clicking a chord card
     */
    _selectMeasureFromCard(chordIndex) {
        // Get the NotationComposer instance
        const composer = window.getNotationComposer?.();
        if (composer) {
            // Select the measure in the notation
            composer.setSelectedMeasure(chordIndex);
        }

        // Also highlight the card visually
        this._highlightCard(chordIndex);
    }

    /**
     * Highlight a specific card in the bottom panel
     */
    _highlightCard(index) {
        const container = this.modal.querySelector('#fs-chord-cards-container');
        if (!container) return;

        // Remove highlight from all cards
        container.querySelectorAll('.chord-card-fs-wrapper').forEach(card => {
            const cardEl = card.querySelector('.simplified-card-fs');
            if (cardEl) {
                cardEl.classList.remove('ring-2', 'ring-indigo-400');
            }
        });

        // Add highlight to selected card
        const selectedCard = container.querySelector(`[data-chord-index="${index}"]`);
        if (selectedCard) {
            const cardEl = selectedCard.querySelector('.simplified-card-fs');
            if (cardEl) {
                cardEl.classList.add('ring-2', 'ring-indigo-400');
            }

            // Scroll card into view if needed
            selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    /**
     * Helper: Spell note in key (respects enharmonic preferences)
     */
    _spellNoteInKey(note, key) {
        // Use global spellNoteInKey if available
        if (typeof window.spellNoteInKey === 'function') {
            return window.spellNoteInKey(note, key);
        }
        return note;
    }

    /**
     * Helper: Get roman numeral for chord in key
     */
    _getRomanNumeralForChord(chord, key) {
        // Use global function if available
        if (typeof window.getRomanNumeral === 'function') {
            return window.getRomanNumeral(chord.root, chord.type, key);
        }

        // Fallback: try to compute basic roman numeral
        const roots = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const flatRoots = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

        // Normalize note names
        const normalizeNote = (n) => {
            if (!n) return 'C';
            const note = n.replace(/\d+$/, '').trim();
            let idx = roots.indexOf(note);
            if (idx === -1) idx = flatRoots.indexOf(note);
            return idx >= 0 ? roots[idx] : 'C';
        };

        const keyRoot = normalizeNote(key?.replace(/\s*(Major|Minor|major|minor).*$/i, ''));
        const chordRoot = normalizeNote(chord.root);

        let keyIdx = roots.indexOf(keyRoot);
        let chordIdx = roots.indexOf(chordRoot);

        if (keyIdx === -1 || chordIdx === -1) return '';

        const interval = (chordIdx - keyIdx + 12) % 12;
        const numerals = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];
        let numeral = numerals[interval] || '';

        // Lowercase for minor chords
        const type = chord.type || '';
        if (type.toLowerCase().includes('minor') || type.toLowerCase().includes('dim')) {
            numeral = numeral.toLowerCase();
        }

        return numeral;
    }

    /**
     * Handle progression update events
     */
    _onProgressionUpdate() {
        // Re-render chord progression in bottom panel
        if (this.isOpen) {
            this._renderChordProgression();
        }
    }

    // ========================================================================
    // ZOOM
    // ========================================================================

    /**
     * Zoom in by one step
     */
    _zoomIn() {
        this.zoomLevel = Math.min(MAX_ZOOM, this.zoomLevel + ZOOM_STEP);
        this._saveToStorage(STORAGE_KEYS.ZOOM, this.zoomLevel);
        this._applyZoom();
    }

    /**
     * Zoom out by one step
     */
    _zoomOut() {
        this.zoomLevel = Math.max(MIN_ZOOM, this.zoomLevel - ZOOM_STEP);
        this._saveToStorage(STORAGE_KEYS.ZOOM, this.zoomLevel);
        this._applyZoom();
    }

    /**
     * Fit notation to container width
     */
    _fitToWidth() {
        const container = this.modal.querySelector('#fullscreen-canvas-container');
        const wrapper = this.modal.querySelector('#fullscreen-canvas-wrapper');
        const pages = this.modal.querySelector('#fullscreen-pages-container');

        if (!container || !pages) return;

        // Get first page canvas for reference width
        const firstCanvas = pages.querySelector('.notation-page-canvas, canvas');
        if (!firstCanvas) return;

        const canvasWidth = firstCanvas.width || firstCanvas.offsetWidth;
        const containerWidth = container.clientWidth - 32; // Account for padding

        if (canvasWidth > 0) {
            this.zoomLevel = Math.round((containerWidth / canvasWidth) * 100);
            this.zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoomLevel));
            this._saveToStorage(STORAGE_KEYS.ZOOM, this.zoomLevel);
            this._applyZoom();
        }
    }

    /**
     * Apply current zoom level to canvas wrapper
     */
    _applyZoom() {
        const wrapper = this.modal.querySelector('#fullscreen-canvas-wrapper');
        const zoomLabel = this.modal.querySelector('#fullscreen-zoom-level');

        if (wrapper) {
            wrapper.style.transform = `scale(${this.zoomLevel / 100})`;
        }

        if (zoomLabel) {
            zoomLabel.textContent = `${this.zoomLevel}%`;
        }
    }

    // ========================================================================
    // MEASURES PER SYSTEM
    // ========================================================================

    /**
     * Handle measures per system change
     * Triggers a re-render of notation with the new measures per line
     */
    _onMeasuresPerSystemChange() {
        console.log('Measures per system changed to:', this.measuresPerSystem);

        // Get the NotationComposer and trigger re-render with new measures per line
        const notationComposer = window.getNotationComposer?.();
        if (notationComposer?.toolbar?.onMeasuresPerLineChange) {
            // Use the toolbar's callback which handles config update + re-render
            notationComposer.toolbar.onMeasuresPerLineChange(this.measuresPerSystem);
        } else if (notationComposer) {
            // Direct approach: update config and re-render
            notationComposer.config.measuresPerLine = this.measuresPerSystem;
            if (notationComposer.layoutManager?.setConfig) {
                notationComposer.layoutManager.setConfig({ measuresPerLine: this.measuresPerSystem });
            }
            notationComposer.render?.();
        } else {
            // Fallback: trigger a general notation refresh
            if (typeof window.refreshNotationFromProgression === 'function') {
                window.refreshNotationFromProgression();
            }
        }
    }

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    /**
     * Handle keyboard events
     * NOTE: Most keyboard shortcuts are handled by the existing notation system.
     * We only intercept full-screen specific shortcuts here.
     */
    _handleKeyDown(e) {
        if (!this.isOpen) return;

        // NOTE: Escape is NOT used to close full-screen mode because
        // it's needed for deselecting notes in the notation editor.
        // Use the X button in the header to close instead.

        // Ctrl/Cmd + \ to toggle sidebar (doesn't conflict with notation shortcuts)
        if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
            e.preventDefault();
            this._toggleSidebar();
            return;
        }

        // Ctrl/Cmd + Plus/Minus for zoom
        if (e.ctrlKey || e.metaKey) {
            if (e.key === '=' || e.key === '+') {
                e.preventDefault();
                this._zoomIn();
            } else if (e.key === '-') {
                e.preventDefault();
                this._zoomOut();
            } else if (e.key === '0') {
                e.preventDefault();
                this.zoomLevel = 100;
                this._saveToStorage(STORAGE_KEYS.ZOOM, this.zoomLevel);
                this._applyZoom();
            }
        }

        // All other keys pass through to the existing notation keyboard handlers
    }

    /**
     * Handle mouse wheel events for zoom
     */
    _handleWheel(e) {
        if (!this.isOpen) return;

        // Only zoom with Ctrl/Cmd held
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();

            if (e.deltaY < 0) {
                this._zoomIn();
            } else if (e.deltaY > 0) {
                this._zoomOut();
            }
        }
    }

    // ========================================================================
    // STORAGE HELPERS
    // ========================================================================

    /**
     * Load value from localStorage
     */
    _loadFromStorage(key, defaultValue) {
        try {
            const stored = localStorage.getItem(key);
            if (stored === null) return defaultValue;

            // Handle boolean
            if (stored === 'true') return true;
            if (stored === 'false') return false;

            // Handle number
            const num = parseInt(stored);
            if (!isNaN(num)) return num;

            return stored;
        } catch (e) {
            return defaultValue;
        }
    }

    /**
     * Save value to localStorage
     */
    _saveToStorage(key, value) {
        try {
            localStorage.setItem(key, String(value));
        } catch (e) {
            console.warn('FullScreenNotationEditor: Failed to save to localStorage', e);
        }
    }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let _instance = null;

// Reset singleton on HMR reload
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        _instance = null;
    });
}

/**
 * Get the singleton FullScreenNotationEditor instance
 */
export function getFullScreenNotationEditor() {
    if (!_instance) {
        _instance = new FullScreenNotationEditor();
    }
    return _instance;
}

/**
 * Open the full-screen notation editor
 * Convenience function for window export
 */
export function openFullScreenNotation() {
    getFullScreenNotationEditor().open();
}

/**
 * Close the full-screen notation editor
 * Convenience function for window export
 */
export function closeFullScreenNotation() {
    getFullScreenNotationEditor().close();
}

/**
 * Toggle the full-screen notation editor
 * Convenience function for window export
 */
export function toggleFullScreenNotation() {
    getFullScreenNotationEditor().toggle();
}
