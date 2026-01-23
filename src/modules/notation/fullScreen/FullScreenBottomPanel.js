/**
 * FullScreenBottomPanel.js - Dock-style Bottom Panel for Full-Screen Mode
 *
 * A floating dock bar at the bottom with buttons that open slide-up panels:
 * - Chord Progression
 * - Quick Add Chord
 * - Auto-Generate Bass
 * - Voice Leading
 * - Borrowed Chords
 * - Theory Insights
 */

import { getCompositionState } from '../../state/compositionState.js';
import { getCurrentKey, getProgressionData } from '../../state/trainerState.js';
import {
    SCALE_DEFINITIONS,
    SCALE_CATEGORIES,
    CHORD_DEFINITIONS
} from '../../../data/music-data.js';
import { isChordInScale } from '../../features/chordBuilder.js';
import {
    detectAllPatterns,
    getTopPatterns,
    PATTERN_CATEGORIES,
    suggestPatternContinuation
} from '../../analysis/patternDetection.js';
import { HarmonyAnalyzer } from '../../analysis/harmonyAnalyzer.js';
import { detectAllObservations } from '../../teaching/coachEngine/detectors/index.js';
import { generateAllSuggestions } from '../../teaching/coachEngine/generators/index.js';
import { scanAllOpportunities } from '../../teaching/coachEngine/scanners/opportunityScanner.js';
import { COACH_ITEM_TYPES } from '../../teaching/coachEngine/types.js';
import { renderAmbientTensionStrip } from '../../ui/AmbientTensionStrip.js';
import { renderBassMotionIndicators } from '../../ui/BassMotionIndicators.js';
import { FUNCTION_LEGEND, getHarmonicFunctionFromRoman, shouldShowFunctionColors } from '../../ui/chordFunctionLegend.js';
import { getExperienceMode } from '../../state/globalState.js';
import { showConfirmModal } from '../../ui/modals.js';
import { buildSectionsWithUngrouped } from '../../ui/recommendations/UnifiedRecommendationModal/ProgressionHelpers.js';
import { hexToRgba } from '../../ui/recommendations/UnifiedRecommendationModal/MusicUtils.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
    ACTIVE_PANEL: 'fs-dock-active-panel',
    VIEW_MODE: 'fs-dock-view-mode',
    DOCK_COLLAPSED: 'fs-dock-collapsed'
};

const DOCK_HEIGHT = 44; // Height of the dock bar
const PANEL_HEIGHTS = {
    'workbench': 240,  // Song Workbench - 3 column layout (taller for better spacing)
    'chords': 360,  // 75% larger to show full chord cards with section picker bar in section view
    'quick-add': 360,  // Combined: quick-add controls + chord progression cards
    'auto-bass': 360,  // Taller to include chord progression cards
    'voice-leading': 320,  // Increased to accommodate legend, filter controls, and fix suggestions
    'borrowed': 360,
    'theory': 380  // Increased to show pattern detection, harmony analysis, and suggestions
};

const DOCK_BUTTONS = [
    { id: 'workbench', label: 'Workbench', icon: '🧪', color: 'from-violet-500 to-indigo-500' },
    { id: 'chords', label: 'Chord Progression', icon: '🎵', color: 'from-purple-500 to-indigo-500' },
    { id: 'quick-add', label: 'Quick Add', icon: '➕', color: 'from-lime-700 to-lime-800' },
    { id: 'auto-bass', label: 'Auto-Bass', icon: '🎸', color: 'from-amber-700 to-amber-600' },
    { id: 'voice-leading', label: 'Voice Leading', icon: '📊', color: 'from-blue-500 to-cyan-500' },
    { id: 'borrowed', label: 'Borrowed Chords', icon: '🔄', color: 'from-slate-600 to-indigo-700' },
    { id: 'theory', label: 'Theory', icon: '💡', color: 'from-yellow-500 to-amber-500' }
];

// ============================================================================
// FullScreenBottomPanel CLASS
// ============================================================================

export class FullScreenBottomPanel {
    constructor(modalElement, parentEditor = null) {
        this.modal = modalElement;
        this.parentEditor = parentEditor;
        this.container = null;
        this.activePanel = null; // null = closed, or panel id
        this.viewMode = this._loadFromStorage(STORAGE_KEYS.VIEW_MODE, 'scroll');
        this.selectedSectionIds = new Set();
        this._quickAddSelectedSectionIds = new Set();  // Separate tracking for Quick Add panel

        // Collapse state - load from storage, default to expanded (false)
        this.isCollapsed = this._loadFromStorage(STORAGE_KEYS.DOCK_COLLAPSED, 'false') === 'true';

        // Borrowed chords panel state
        this._selectedBorrowedChord = null;  // Currently selected borrowed chord object
        this._borrowedChordInversion = 0;    // 0 = root, 1 = 1st inv, 2 = 2nd inv
        this._borrowedPreviewPiano = null;   // Piano sampler for preview

        // Borrowed panel progression picker state (mirrors unified modal pattern)
        this._borrowedSelectedProgressionIndex = -1;  // -1 = add at end
        this._borrowedSelectedSectionIds = new Set(); // Empty = show all chords
        this._borrowedPickerCollapsed = false;  // Progression picker collapse state

        // Compact view state for panels (toggleable summary view)
        // Default to false (standard card view) as per user request
        this._chordsCompactView = false;
        this._quickAddCompactView = false;
        this._autoBassCompactView = false;
        // Separate section ID tracking for compact views
        this._chordsCompactSectionIds = new Set();
        this._quickAddCompactSectionIds = new Set();
        this._autoBassCompactSectionIds = new Set();
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    init() {
        // Create our own container and append directly to modal
        // This ensures we're not affected by any flex layout issues
        this.container = document.createElement('div');
        this.container.id = 'fs-dock-container';
        this.modal.appendChild(this.container);

        this._render();
        this._attachEventHandlers();
    }

    toggle(panelId) {
        if (this.activePanel === panelId) {
            // Close if clicking the same panel
            this.activePanel = null;
        } else {
            // Open the new panel
            this.activePanel = panelId;
            // Dispatch event for tutorial system
            window.dispatchEvent(new CustomEvent('fsDockPanelOpened', {
                detail: { panelId }
            }));
        }
        this._saveToStorage(STORAGE_KEYS.ACTIVE_PANEL, this.activePanel || '');
        this._updateUI();
    }

    refresh() {
        if (this.activePanel) {
            this._renderPanelContent();
        }
    }

    /**
     * Close any active panel - call this when exiting full-screen mode
     * to prevent panels from staying open on next open
     */
    closeActivePanel() {
        // Clean up Quick Add selection listener if it exists
        if (this._quickAddSelectionHandler) {
            window.removeEventListener('chordCardSelected', this._quickAddSelectionHandler);
            this._quickAddSelectionHandler = null;
        }

        this.activePanel = null;
        this._saveToStorage(STORAGE_KEYS.ACTIVE_PANEL, '');
        this._updateUI();
    }

    /**
     * Toggle the collapsed state of the dock bar
     */
    toggleCollapse() {
        this.isCollapsed = !this.isCollapsed;
        this._saveToStorage(STORAGE_KEYS.DOCK_COLLAPSED, this.isCollapsed ? 'true' : 'false');

        // Close any active panel when collapsing
        if (this.isCollapsed && this.activePanel) {
            this.activePanel = null;
            this._saveToStorage(STORAGE_KEYS.ACTIVE_PANEL, '');
        }

        this._updateCollapseUI();
    }

    /**
     * Update UI elements based on collapsed state
     */
    _updateCollapseUI() {
        const dockBar = this.container.querySelector('#fs-dock-bar');
        const collapsedPill = this.container.querySelector('#fs-dock-collapsed-pill');
        const panel = this.container.querySelector('#fs-dock-panel');

        if (this.isCollapsed) {
            // Collapse: hide dock bar and panel, show pill
            if (dockBar) dockBar.style.display = 'none';
            if (panel) panel.style.display = 'none';
            if (collapsedPill) collapsedPill.style.display = '';
        } else {
            // Expand: show dock bar, hide pill
            if (dockBar) dockBar.style.display = '';
            if (collapsedPill) collapsedPill.style.display = 'none';
            if (panel) panel.style.display = '';
            // Re-render panel if there was an active panel
            this._updateUI();
        }
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    _render() {
        // Position absolute within the modal (modal has position:fixed which serves as positioning parent)
        // This way "bottom" is relative to the modal's bottom, not the screen
        this.container.style.cssText = `
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 27px !important;
            z-index: 505 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            pointer-events: none !important;
        `;

        this.container.innerHTML = `
            <!-- Slide-up Panel (above dock) -->
            <div id="fs-dock-panel"
                 class="pointer-events-auto mb-2 w-[95%] max-w-5xl bg-white rounded-xl overflow-hidden transition-all duration-300 ease-out"
                 style="max-height: 0; opacity: 0; box-shadow: 0 10px 40px -5px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.1); border: 2px solid rgba(100,100,120,0.2); ${this.isCollapsed ? 'display: none;' : ''}">
                <div id="fs-dock-panel-content">
                    <!-- Panel content rendered here -->
                </div>
            </div>

            <!-- Expanded Dock Bar -->
            <div id="fs-dock-bar"
                 class="pointer-events-auto flex items-center gap-1 px-2 py-1.5 bg-gray-900/90 backdrop-blur-sm rounded-full shadow-xl border border-gray-700 transition-all duration-300"
                 style="${this.isCollapsed ? 'display: none;' : ''}">
                ${this._renderDockButtons()}
                <!-- Collapse Button -->
                <div class="w-px h-5 bg-gray-600 mx-1"></div>
                <button id="fs-dock-collapse-btn"
                        class="flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-white hover:bg-white/15 transition-all duration-200"
                        title="Collapse dock bar">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </button>
            </div>

            <!-- Collapsed Pill (shown when collapsed) -->
            <div id="fs-dock-collapsed-pill"
                 class="pointer-events-auto flex items-center gap-2 px-3 py-2 bg-gray-900/90 backdrop-blur-sm rounded-full shadow-xl border border-gray-700 cursor-pointer hover:bg-gray-800/90 transition-all duration-300"
                 style="${this.isCollapsed ? '' : 'display: none;'}"
                 title="Expand dock bar">
                <span class="text-sm">🎹</span>
                <span class="text-xs text-gray-300 font-medium">Dock</span>
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                </svg>
            </div>
        `;

        this._updateUI();
    }

    _renderDockButtons() {
        // Render each button individually with visual differentiation
        return DOCK_BUTTONS.map(btn => `
            <button class="fs-dock-btn group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                           text-gray-300 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/25 shadow-sm"
                    data-panel="${btn.id}"
                    title="${btn.label}">
                <span class="text-sm">${btn.icon}</span>
                <span class="hidden sm:inline">${btn.label}</span>
            </button>
        `).join('');
    }

    _updateUI() {
        const panel = this.container.querySelector('#fs-dock-panel');
        const buttons = this.container.querySelectorAll('.fs-dock-btn');

        // Update button states
        buttons.forEach(btn => {
            const panelId = btn.dataset.panel;
            const isActive = panelId === this.activePanel;
            const btnDef = DOCK_BUTTONS.find(b => b.id === panelId);

            btn.classList.toggle('text-white', isActive);
            btn.classList.toggle('text-gray-300', !isActive);

            if (isActive && btnDef) {
                btn.className = `fs-dock-btn group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 text-white bg-gradient-to-r ${btnDef.color} shadow-lg border border-white/20`;
            } else {
                btn.className = `fs-dock-btn group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 text-gray-300 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/25 shadow-sm`;
            }
        });

        // Update panel visibility
        if (this.activePanel) {
            const height = PANEL_HEIGHTS[this.activePanel] || 160;
            panel.style.maxHeight = `${height}px`;
            panel.style.opacity = '1';
            this._renderPanelContent();
        } else {
            panel.style.maxHeight = '0';
            panel.style.opacity = '0';
        }
    }

    _renderPanelContent() {
        const content = this.container.querySelector('#fs-dock-panel-content');
        if (!content) return;

        const height = PANEL_HEIGHTS[this.activePanel] || 160;
        content.style.height = `${height}px`;

        switch (this.activePanel) {
            case 'workbench':
                this._renderWorkbenchPanel(content);
                break;
            case 'chords':
                this._renderChordsPanel(content);
                break;
            case 'quick-add':
                this._renderQuickAddPanel(content);
                break;
            case 'auto-bass':
                this._renderAutoBassPanel(content);
                break;
            case 'voice-leading':
                this._renderVoiceLeadingPanel(content);
                break;
            case 'borrowed':
                this._renderBorrowedPanel(content);
                break;
            case 'theory':
                this._renderTheoryPanel(content);
                break;
            default:
                content.innerHTML = '<div class="p-4 text-gray-500">Select a panel</div>';
        }
    }

    _attachEventHandlers() {
        // Dock button clicks
        this.container.querySelectorAll('.fs-dock-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle(btn.dataset.panel);
            });
        });

        // Collapse button click
        const collapseBtn = this.container.querySelector('#fs-dock-collapse-btn');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleCollapse();
            });
        }

        // Collapsed pill click (to expand)
        const collapsedPill = this.container.querySelector('#fs-dock-collapsed-pill');
        if (collapsedPill) {
            collapsedPill.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleCollapse();
            });
        }

        // Listen for chord selection changes to update Auto-Bass "Apply to Selected" button
        document.addEventListener('chordsSelectionChanged', () => {
            this._updateApplyToSelectedButton();
        });

        // Listen for section changes to re-render chord panels
        const compState = getCompositionState();
        if (compState?.events) {
            const sectionEvents = [
                'sectionCreated', 'sectionUpdated', 'sectionDeleted',
                'sectionDuplicated', 'sectionsReordered', 'sectionsReorderedByIds',
                'chordAddedToSection', 'chordRemovedFromSection',
                'sectionChordsReordered', 'sectionsUpdatedAfterDelete',
                'sectionsUpdatedAfterInsert', 'sectionsUpdatedAfterReorder'
            ];
            sectionEvents.forEach(eventName => {
                compState.events.on(eventName, () => {
                    // Re-render panels that show chord cards when sections change
                    if (this.activePanel === 'chords' || this.activePanel === 'quick-add' || this.activePanel === 'auto-bass') {
                        this._renderPanelContent();
                    }
                });
            });
        }

        // MutationObserver to watch for data-selected attribute changes on chord cards only
        this._selectionObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-selected') {
                    // Only react if it's an actual chord card
                    const target = mutation.target;
                    if (target.classList.contains('simplified-card') || target.classList.contains('detailed-card')) {
                        this._updateApplyToSelectedButton();
                        break;
                    }
                }
            }
        });
        // Observe the entire document for attribute changes
        this._selectionObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-selected'],
            subtree: true
        });
    }

    // ========================================================================
    // PANEL CONTENT RENDERERS
    // ========================================================================

    _renderWorkbenchPanel(container) {
        const compState = getCompositionState();
        // Get key from trainerState (the single source of truth for current key)
        const key = getCurrentKey() || 'C';

        container.innerHTML = `
            <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 border-b border-violet-700">
                <span class="text-white text-sm font-semibold flex items-center gap-2" style="-webkit-text-fill-color: white;">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                    Song Workbench
                </span>
                <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>

            <!-- 3-Column Layout -->
            <div class="grid grid-cols-3 gap-3 p-3 bg-gradient-to-br from-violet-50 to-indigo-50" style="height: calc(100% - 40px);">

                <!-- Column 1: Key -->
                <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                    <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                        </svg>
                        Key
                    </h4>
                    <button id="fs-workbench-key-btn"
                            class="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg transition-all">
                        <span id="fs-workbench-key-display">${key}</span>
                        <svg class="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <p class="text-[10px] text-gray-400 mt-1.5 text-center">Sets the tonal center</p>
                </div>

                <!-- Column 2: Add Chords -->
                <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                    <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-purple-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>
                        Add Chords
                    </h4>
                    <div class="space-y-1.5">
                        <button id="fs-workbench-templates-btn"
                                class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition-all">
                            <svg class="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                            <span>Browse Templates</span>
                        </button>
                        <button id="fs-workbench-type-btn"
                                class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition-all">
                            <svg class="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path></svg>
                            <span>Type Chords</span>
                        </button>
                        <button id="fs-workbench-audio-btn"
                                class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition-all">
                            <svg class="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                            <span>Analyze Audio</span>
                        </button>
                    </div>
                </div>

                <!-- Column 3: Arrange -->
                <div class="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
                    <h4 class="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        Arrange
                    </h4>
                    <div class="space-y-1.5">
                        <button id="fs-workbench-song-builder-btn"
                                class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition-all">
                            <svg class="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                            <span>Song Builder</span>
                        </button>
                        <button id="fs-workbench-rhythm-btn"
                                class="w-full flex items-center gap-2 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-md transition-all">
                            <svg class="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            <span>Rhythm Patterns</span>
                        </button>
                    </div>
                    <p class="text-[10px] text-gray-400 mt-1.5">Organize into song sections</p>
                </div>

            </div>
        `;

        // Attach close button handler
        container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
            this.closeActivePanel();
        });

        // Attach button handlers - use existing window functions
        container.querySelector('#fs-workbench-key-btn')?.addEventListener('click', () => {
            if (window.toggleCircleOfFifthsPanel) {
                window.toggleCircleOfFifthsPanel();
            }
        });

        container.querySelector('#fs-workbench-templates-btn')?.addEventListener('click', () => {
            if (window.openTemplateBrowser) {
                window.openTemplateBrowser();
            }
        });

        container.querySelector('#fs-workbench-type-btn')?.addEventListener('click', () => {
            if (window.openManualChordEntryModal) {
                window.openManualChordEntryModal();
            }
        });

        container.querySelector('#fs-workbench-audio-btn')?.addEventListener('click', () => {
            if (window.openAudioAnalyzerModal) {
                window.openAudioAnalyzerModal();
            }
        });

        container.querySelector('#fs-workbench-song-builder-btn')?.addEventListener('click', () => {
            if (window.showSongBuilderModal) {
                window.showSongBuilderModal();
            }
        });

        container.querySelector('#fs-workbench-rhythm-btn')?.addEventListener('click', () => {
            if (window.showRhythmPatternModal) {
                window.showRhythmPatternModal();
            }
        });
    }

    _renderChordsPanel(container) {
        const compState = getCompositionState();
        // Use buildSectionView() to get all sections including auto-materialized ungrouped sections
        const sections = compState?.buildSectionView?.() || compState?.getSections?.() || [];
        const hasSections = sections.length > 0;

        // Get progression data
        let chords = [];
        if (typeof compState?.getChords === 'function') {
            chords = compState.getChords() || [];
        }
        if (chords.length === 0) {
            const progressionData = compState?.exportToProgressionData?.();
            chords = Array.isArray(progressionData) ? progressionData : [];
        }
        // Get key from trainerState (the single source of truth for current key)
        const key = getCurrentKey() || 'C';

        // Determine if compact view is active
        const isCompactView = this._chordsCompactView;

        // Header with view mode toggle and action buttons
        container.innerHTML = `
            <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 border-b border-purple-700">
                <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Chord Progression</span>
                <div class="flex items-center gap-1.5">
                    <!-- Progression Summary/Details Slider Toggle (first/leftmost) -->
                    <div class="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full" title="Toggle between progression summary and detailed card view">
                        <span class="text-[8px] font-medium ${isCompactView ? 'text-white' : 'text-white/50'}" style="-webkit-text-fill-color: ${isCompactView ? 'white' : 'rgba(255,255,255,0.5)'};">Progression Summary</span>
                        <label class="relative inline-flex items-center cursor-pointer mx-0.5">
                            <input type="checkbox" id="fs-chords-compact-toggle" class="sr-only peer" ${isCompactView ? '' : 'checked'}>
                            <div class="w-7 h-4 bg-indigo-300 peer-focus:outline-none rounded-full peer
                                        peer-checked:after:translate-x-full peer-checked:after:border-white
                                        after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                        after:bg-white after:border-gray-300 after:border after:rounded-full
                                        after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-500"></div>
                        </label>
                        <span class="text-[8px] font-medium ${isCompactView ? 'text-white/50' : 'text-white'}" style="-webkit-text-fill-color: ${isCompactView ? 'rgba(255,255,255,0.5)' : 'white'};">Progression Details</span>
                    </div>
                    <!-- Action Buttons (hidden in compact view) -->
                    <button id="fs-chords-add-section-btn" class="${isCompactView ? 'hidden' : ''} px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-medium rounded transition flex items-center gap-1" title="Select adjacent chords, then add to a section">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <span>+Section</span>
                    </button>
                    <button id="fs-chords-clear-btn" class="${isCompactView ? 'hidden' : ''} px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-medium rounded transition flex items-center gap-1" title="Clear all chords">
                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                        <span>Clear</span>
                    </button>
                    <button id="fs-chords-colors-btn" class="${isCompactView ? 'hidden' : ''} px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-medium rounded transition flex items-center gap-1" title="View chord function color legend">
                        <span class="text-[8px]" style="-webkit-text-fill-color: #86efac;">●</span>
                        <span class="text-[8px]" style="-webkit-text-fill-color: #7dd3fc;">●</span>
                        <span class="text-[8px]" style="-webkit-text-fill-color: #fcd34d;">●</span>
                        <span>Legend</span>
                    </button>
                    <!-- View Mode Toggle (hidden in compact view) -->
                    <div class="${isCompactView ? 'hidden' : 'flex'} gap-0.5 bg-white/20 rounded-lg p-0.5">
                        <button class="fs-view-mode-btn px-2 py-1 text-xs font-medium rounded-md transition-all ${this.viewMode === 'scroll' ? 'bg-white shadow text-indigo-600' : 'text-white/80 hover:text-white'}"
                                data-mode="scroll" style="${this.viewMode === 'scroll' ? '-webkit-text-fill-color: #4f46e5;' : ''}">
                            Scroll
                        </button>
                        <button class="fs-view-mode-btn px-2 py-1 text-xs font-medium rounded-md transition-all ${this.viewMode === 'section' ? 'bg-white shadow text-indigo-600' : 'text-white/80 hover:text-white'}"
                                data-mode="section" style="${this.viewMode === 'section' ? '-webkit-text-fill-color: #4f46e5;' : ''}">
                            Section
                        </button>
                    </div>
                    <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
            ${isCompactView ? `
                <!-- Compact progression view -->
                <div id="fs-chords-compact-container"></div>
            ` : `
                <!-- Section picker bar (visible in section view mode when sections exist) -->
                <div id="fs-section-picker" class="${this.viewMode === 'section' && hasSections ? '' : 'hidden'}"></div>
                <!-- Cards container -->
                <div id="fs-chord-cards-container" class="flex flex-nowrap items-start gap-1 pl-4 pr-2 mt-2" style="width: 100%; height: calc(100% - ${this.viewMode === 'section' && hasSections ? '120px' : '58px'}); scroll-behavior: smooth; -webkit-overflow-scrolling: touch; overflow-x: auto; overflow-y: visible; padding-bottom: 24px; padding-top: 4px;">
                </div>
                <style>
                    #fs-chord-cards-container::-webkit-scrollbar { height: 10px; }
                    #fs-chord-cards-container::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 5px; margin: 0 8px; }
                    #fs-chord-cards-container::-webkit-scrollbar-thumb { background: linear-gradient(to right, #8b5cf6, #6366f1); border-radius: 5px; }
                    #fs-chord-cards-container::-webkit-scrollbar-thumb:hover { background: linear-gradient(to right, #7c3aed, #4f46e5); }
                    #fs-chord-cards-container { scrollbar-width: auto; scrollbar-color: #8b5cf6 #f1f5f9; }

                    /* Selection styling - remove double outline, use contained border like Quick Add/Auto Bass */
                    #fs-chord-cards-container .chord-card-wrapper {
                        outline: none !important;
                        outline-offset: 0 !important;
                    }
                    #fs-chord-cards-container .simplified-card[data-selected="true"],
                    #fs-chord-cards-container .detailed-card[data-selected="true"] {
                        border: 3px solid #a855f7 !important;
                        box-sizing: border-box !important;
                    }
                </style>
            `}
        `;

        // Attach view mode handlers
        container.querySelectorAll('.fs-view-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.viewMode = btn.dataset.mode;
                this._saveToStorage(STORAGE_KEYS.VIEW_MODE, this.viewMode);
                this._renderChordsPanel(container);
            });
        });

        // Attach close button handler
        container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
            this.closeActivePanel();
        });

        // Attach +Add Section button handler
        container.querySelector('#fs-chords-add-section-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();

            // Check if any cards are selected (either via main app state or via data-selected attribute)
            const selectedCards = document.querySelectorAll('.simplified-card[data-selected="true"], .detailed-card[data-selected="true"]');
            const selectedIndices = window.getSelectedIndicesArray ? window.getSelectedIndicesArray() : [];

            if (selectedCards.length === 0 && selectedIndices.length === 0) {
                // No selection - show helpful message
                if (window.toast) {
                    window.toast.warning('Click on chord cards to select them first, then click +Section');
                }
                return;
            }

            // Use the main app's showAddSectionMenu
            if (window.showAddSectionMenu) {
                window.showAddSectionMenu(e, 'fs-chord-cards-container');
            }
        });

        // Attach Clear button handler
        container.querySelector('#fs-chords-clear-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.clearProgression) {
                window.clearProgression();
                // Re-render after clear
                setTimeout(() => this._renderChordsPanel(container), 100);
            }
        });

        // Attach Colors button handler
        container.querySelector('#fs-chords-colors-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            // Try multiple possible function names for the legend toggle
            if (typeof window.toggleChordFunctionLegend === 'function') {
                window.toggleChordFunctionLegend();
            } else if (typeof window.showChordFunctionLegend === 'function') {
                window.showChordFunctionLegend();
            } else if (window.toast) {
                window.toast.info('Color legend shows chord functions: Tonic (I, vi), Subdominant (IV, ii), Dominant (V, vii°)');
            }
        });

        // Attach Summary/Details toggle handler (checkbox: unchecked = Summary, checked = Details)
        container.querySelector('#fs-chords-compact-toggle')?.addEventListener('change', (e) => {
            this._chordsCompactView = !e.target.checked; // checked = Details (not compact), unchecked = Summary (compact)
            this._renderChordsPanel(container);
        });

        // Handle compact view rendering
        if (isCompactView) {
            const compactContainer = container.querySelector('#fs-chords-compact-container');
            if (compactContainer) {
                // Render the compact progression view
                compactContainer.innerHTML = this._renderCompactProgressionView('fs-chords-compact', {
                    selectedSectionIds: this._chordsCompactSectionIds,
                    selectedChordIndex: window.getSelectedChordIndex?.() ?? -1,
                    accentColor: '#8b5cf6',
                    showGhostCard: true
                });

                // Attach compact view handlers
                this._attachCompactProgressionHandlers(compactContainer, 'fs-chords-compact', {
                    onSectionChange: () => {
                        this._renderChordsPanel(container);
                    },
                    onChordClick: (idx) => {
                        if (window.setSelectedChordIndex) {
                            window.setSelectedChordIndex(idx);
                        }
                        this._renderChordsPanel(container);
                    },
                    onChordHold: (idx, chord) => {
                        // Play chord on hold
                        if (chord.notes && chord.notes.length > 0 && window.getPiano) {
                            const piano = window.getPiano();
                            if (piano) {
                                piano.triggerAttack(chord.notes);
                            }
                        }
                    },
                    onChordRelease: () => {
                        // Stop playing
                        if (window.getPiano) {
                            const piano = window.getPiano();
                            if (piano) {
                                piano.releaseAll();
                            }
                        }
                    },
                    onGhostCardClick: (suggestion) => {
                        this._addSuggestedChord(suggestion, key);
                    }
                }, this._chordsCompactSectionIds);
            }
            return;
        }

        const cardsContainer = container.querySelector('#fs-chord-cards-container');
        const sectionPicker = container.querySelector('#fs-section-picker');

        if (!cardsContainer) return;

        if (chords.length === 0) {
            cardsContainer.innerHTML = '<div class="text-gray-500 text-sm p-4">No chords in progression</div>';
            return;
        }

        // Render based on view mode - EXACTLY mirroring Composition Studio
        if (this.viewMode === 'section' && hasSections) {
            // Section View: show section picker and filtered cards
            this._renderFSSectionPicker(sectionPicker, sections);
            this._renderFSSectionViewCards(cardsContainer, chords, key, sections);
        } else {
            // Scroll View: horizontal scrolling with section-aware layout
            this._renderFSScrollViewCards(cardsContainer, chords, key, sections);
        }

        // Render ambient tension strip (respects Experience Mode internally)
        // Insert it between the section picker and the cards container
        renderAmbientTensionStrip(container, chords, key);

        // Render bass motion indicators between chord cards (respects Experience Mode - Explore only)
        renderBassMotionIndicators(cardsContainer, chords, key);
    }

    /**
     * Render section picker bar for section view mode
     * EXACTLY mirrors Composition Studio's createSectionPickerBar
     */
    _renderFSSectionPicker(container, sections) {
        if (!container) return;

        // Build combined list of all sections (including ungrouped)
        const compState = getCompositionState();
        const sectionView = compState?.buildSectionView?.() || sections;

        container.innerHTML = `
            <div class="section-picker-bar flex items-center gap-2 p-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                <!-- Previous section button -->
                <button class="fs-section-nav-btn p-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-100 transition-all flex-shrink-0" title="Previous section">
                    <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                    </svg>
                </button>
                <!-- All button -->
                <button class="fs-section-all-btn px-2.5 py-1.5 text-xs font-semibold rounded-full transition-all flex-shrink-0
                               ${this.selectedSectionIds.size === 0 ? 'bg-indigo-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}">
                    All
                </button>
                <!-- Section chips container -->
                <div class="fs-section-chips-container flex items-center gap-1.5 flex-1 overflow-x-auto py-1 px-1" style="scrollbar-width: none;"></div>
                <!-- Next section button -->
                <button class="fs-section-nav-btn-next p-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-100 transition-all flex-shrink-0" title="Next section">
                    <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                </button>
            </div>
        `;

        // Populate section chips
        const chipsContainer = container.querySelector('.fs-section-chips-container');
        sectionView.forEach(section => {
            const isSelected = this.selectedSectionIds.has(section.id);
            const chip = this._createFSSectionChip(section, isSelected);
            chipsContainer.appendChild(chip);
        });

        // All button handler
        container.querySelector('.fs-section-all-btn')?.addEventListener('click', () => {
            this.selectedSectionIds.clear();
            this._renderChordsPanel(this.container.querySelector('#fs-dock-panel-content'));
        });

        // Initialize sortable on chips for drag-drop reordering
        this._initializeFSSectionChipsSortable(chipsContainer);
    }

    /**
     * Create a section chip element
     */
    _createFSSectionChip(section, isSelected) {
        const chip = document.createElement('button');
        const chordCount = section.chordIndices?.length || section.chordCount || 0;
        const sectionColor = section.color || '#c084fc';

        chip.className = `fs-section-chip flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold
                          transition-all duration-200 flex-shrink-0 cursor-pointer
                          ${isSelected ? 'ring-2 ring-offset-2 shadow-lg transform scale-105' : 'hover:scale-102'}`;
        chip.style.cssText = `
            background: ${isSelected ? this._hexToRgba(sectionColor, 0.35) : this._hexToRgba(sectionColor, 0.08)};
            border: 2px solid ${isSelected ? sectionColor : this._hexToRgba(sectionColor, 0.25)};
            color: ${isSelected ? '#1f2937' : '#6b7280'};
            ${isSelected ? `--tw-ring-color: ${sectionColor}; box-shadow: 0 4px 12px ${this._hexToRgba(sectionColor, 0.4)};` : ''}
        `;

        chip.innerHTML = `
            <span class="fs-section-chip-drag-handle cursor-grab active:cursor-grabbing"><svg class="w-3 h-3 opacity-40 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z"/>
            </svg></span>
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background: ${sectionColor}; ${isSelected ? 'box-shadow: 0 0 8px ' + sectionColor + ';' : ''}"></span>
            <span class="truncate max-w-[100px]">${section.label || 'Section'}</span>
            <span class="text-[10px] ${isSelected ? 'font-bold' : 'opacity-70'}">(${chordCount})</span>
            ${isSelected ? '<svg class="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
        `;

        chip.setAttribute('data-section-id', section.id);

        // Click handler (toggle selection)
        chip.addEventListener('click', (e) => {
            if (e.target.closest('.fs-section-chip-drag-handle')) return;

            if (e.ctrlKey || e.metaKey) {
                // Toggle this section
                if (this.selectedSectionIds.has(section.id)) {
                    this.selectedSectionIds.delete(section.id);
                } else {
                    this.selectedSectionIds.add(section.id);
                }
            } else {
                // Single select
                if (this.selectedSectionIds.has(section.id) && this.selectedSectionIds.size === 1) {
                    this.selectedSectionIds.clear();
                } else {
                    this.selectedSectionIds.clear();
                    this.selectedSectionIds.add(section.id);
                }
            }
            this._renderChordsPanel(this.container.querySelector('#fs-dock-panel-content'));
        });

        return chip;
    }

    /**
     * Render cards in section view mode (filtered by selected sections)
     */
    _renderFSSectionViewCards(container, chords, key, sections) {
        container.innerHTML = '';

        const compState = getCompositionState();
        const sectionView = compState?.buildSectionView?.() || [];

        // If no sections selected, show all
        const selectedIds = this.selectedSectionIds.size > 0
            ? this.selectedSectionIds
            : new Set(sectionView.map(s => s.id));

        // Filter to only selected sections
        const selectedSections = sectionView.filter(s => selectedIds.has(s.id));

        if (selectedSections.length === 0) {
            container.innerHTML = '<div class="text-gray-500 text-sm p-4">No chords in selected sections</div>';
            return;
        }

        // Render each selected section
        selectedSections.forEach((section, sectionIdx) => {
            const sectionContainer = this._createFSUnifiedSectionContainer(section, chords, key);
            if (sectionContainer) {
                sectionContainer.style.scrollSnapAlign = 'start';
                sectionContainer.style.flexShrink = '0';
                container.appendChild(sectionContainer);
            }

            // Add separator between sections
            if (sectionIdx < selectedSections.length - 1) {
                const separator = document.createElement('div');
                separator.className = 'fs-section-separator flex-shrink-0 w-px bg-gray-300 mx-2 self-stretch';
                separator.style.minHeight = '80px';
                container.appendChild(separator);
            }
        });

        // Add ghost card for pattern continuation suggestion (only if showing all sections)
        if (this.selectedSectionIds.size === 0) {
            const ghostCard = this._createFSPatternGhostCard(chords, key);
            if (ghostCard) {
                container.appendChild(ghostCard);
            }
        }

        // Initialize sortable for section containers
        this._initializeFSSectionContainerSortable(container);
    }

    /**
     * Render cards in scroll view mode (section-aware with banners)
     * EXACTLY mirrors Composition Studio's renderScrollViewMode / renderSectionAwareCardsScroll
     */
    _renderFSScrollViewCards(container, chords, key, sections) {
        container.innerHTML = '';

        const compState = getCompositionState();
        const sectionView = compState?.buildSectionView?.() || [];

        if (sectionView.length > 0) {
            // Render each section using unified container
            sectionView.forEach(section => {
                const sectionContainer = this._createFSUnifiedSectionContainer(section, chords, key);
                if (sectionContainer) {
                    sectionContainer.style.scrollSnapAlign = 'start';
                    sectionContainer.style.flexShrink = '0';
                    container.appendChild(sectionContainer);
                }
            });

            // Add ghost card for pattern continuation suggestion
            const ghostCard = this._createFSPatternGhostCard(chords, key);
            if (ghostCard) {
                container.appendChild(ghostCard);
            }

            // Initialize sortable for section containers
            this._initializeFSSectionContainerSortable(container);
        } else {
            // No sections - render flat cards
            chords.forEach((chord, index) => {
                const wrapper = this._createFSChordCardWrapper(chord, index, key);
                if (wrapper) {
                    wrapper.style.scrollSnapAlign = 'start';
                    wrapper.style.flexShrink = '0';
                    container.appendChild(wrapper);
                }
            });

            // Add ghost card for pattern continuation suggestion
            const ghostCard = this._createFSPatternGhostCard(chords, key);
            if (ghostCard) {
                container.appendChild(ghostCard);
            }

            // Initialize sortable for flat cards
            this._initializeFSSimplifiedSortable(container);
        }
    }

    /**
     * Create unified section container with banner and grouped cards
     * EXACTLY mirrors Composition Studio's createUnifiedSectionContainer
     */
    _createFSUnifiedSectionContainer(section, progressionData, key) {
        const container = document.createElement('div');
        container.className = 'section-unified-container inline-flex flex-col rounded-lg overflow-visible';
        container.setAttribute('data-section-id', section.id);
        container.style.setProperty('--section-color', section.color);

        // Draggable banner header
        const banner = document.createElement('div');
        banner.className = 'section-banner flex items-center gap-2 px-2 py-1 rounded-t-lg cursor-grab active:cursor-grabbing';
        banner.style.backgroundColor = section.color;
        banner.setAttribute('data-section-id', section.id);

        banner.innerHTML = `
            <svg class="section-drag-handle w-3 h-3 text-white/70 flex-shrink-0 cursor-grab active:cursor-grabbing" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
            </svg>
            <span class="text-white text-xs font-semibold flex-grow" style="-webkit-text-fill-color: white;">${section.label}</span>
            <button class="section-menu-btn p-0.5 rounded hover:bg-white/20 transition"
                    onclick="event.stopPropagation(); window.showSectionMenu && window.showSectionMenu(event, '${section.id}')"
                    title="Section options">
                <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                </svg>
            </button>
        `;

        container.appendChild(banner);

        // Cards container
        const cardsArea = document.createElement('div');
        cardsArea.className = 'section-cards-area items-start gap-2 p-2 rounded-b-lg';
        cardsArea.style.display = 'flex';
        cardsArea.style.flexDirection = 'row';
        cardsArea.style.flexWrap = 'nowrap';
        cardsArea.style.overflow = 'visible';
        cardsArea.style.backgroundColor = section.color + '20';
        cardsArea.style.borderLeft = `3px solid ${section.color}`;
        cardsArea.style.borderRight = `3px solid ${section.color}`;
        cardsArea.style.borderBottom = `3px solid ${section.color}`;
        cardsArea.setAttribute('data-section-id', section.id);

        // Render cards in this section
        if (section.chordIndices && section.chordIndices.length > 0) {
            section.chordIndices.forEach(chordIdx => {
                if (chordIdx < progressionData.length) {
                    const chord = progressionData[chordIdx];
                    const wrapper = this._createFSChordCardWrapper(chord, chordIdx, key);
                    wrapper.setAttribute('data-in-section', section.id);
                    cardsArea.appendChild(wrapper);
                }
            });
        }

        container.appendChild(cardsArea);

        // Initialize sortable on the cards area for dragging cards within/between sections
        this._initializeFSCardsAreaSortable(cardsArea, section.id);

        return container;
    }

    /**
     * Create chord card wrapper
     * Calls the Composition Studio's createChordCardWrapper, then strips fullscreen-only elements
     */
    _createFSChordCardWrapper(chord, index, key) {
        // Use Composition Studio's createChordCardWrapper
        if (typeof window.createChordCardWrapper === 'function') {
            const wrapper = window.createChordCardWrapper(chord, index, key);
            // Post-process: hide expand button, notation toggle, and expanded view for fullscreen
            this._stripFullscreenOnlyElements(wrapper);
            // Mark as fullscreen card so updateSingleCard skips it (we handle our own refresh)
            wrapper.setAttribute('data-fs-card', 'true');
            return wrapper;
        }

        // Fallback: create simplified card if main function not available
        const wrapper = document.createElement('div');
        wrapper.className = 'chord-card-wrapper flex-shrink-0';
        wrapper.setAttribute('data-chord-index', index);
        wrapper.setAttribute('data-fs-card', 'true');
        wrapper.style.width = '118px';

        const typeSymbol = CHORD_DEFINITIONS[chord.type]?.symbol || '';
        const displayRoot = this._spellNoteInKey(chord.root || 'C', key);
        const chordSymbol = chord.simpleName || (displayRoot + typeSymbol);

        const invNum = parseInt(chord.inversion, 10) || 0;
        const invText = invNum === 1 ? '¹' : invNum === 2 ? '²' : invNum === 3 ? '³' : invNum === 4 ? '⁴' : '';

        // A2: Get function colors for background tint
        const roman = chord.roman || chord.romanNumeral || '';
        const funcKey = getHarmonicFunctionFromRoman(roman);
        const funcData = FUNCTION_LEGEND[funcKey] || FUNCTION_LEGEND.neutral;
        const showColors = shouldShowFunctionColors();
        const functionBgStyle = showColors && funcData.cardBgGradient && funcData.cardBgGradient !== 'none'
            ? `background: ${funcData.cardBgGradient}, linear-gradient(to bottom right, #1f2937, #111827);`
            : 'background: linear-gradient(to bottom right, #1f2937, #111827);';
        const functionBorderStyle = showColors && funcData.hexColor
            ? `border-color: ${funcData.hexColor};`
            : 'border-color: #4b5563;';

        wrapper.innerHTML = `
            <div class="relative">
                <div class="drag-handle absolute -top-1 left-1/2 transform -translate-x-1/2 cursor-grab active:cursor-grabbing z-10 opacity-50 hover:opacity-100 transition-opacity">
                    <svg class="w-4 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm6-4a2 2 0 10.001-4.001A2 2 0 0013 4zm0 4a2 2 0 10.001 4.001A2 2 0 0013 8z"/>
                    </svg>
                </div>
                <div class="simplified-card border-2 rounded-xl p-2 hover:shadow-xl transition-all shadow-lg relative" style="min-height: 70px; ${functionBgStyle} ${functionBorderStyle}">
                    ${invText ? `<div class="absolute top-1 left-1.5 text-lg text-red-400 font-bold" style="-webkit-text-fill-color: #f87171;">${invText}</div>` : ''}
                    <button class="edit-btn absolute top-1 right-1 p-1 bg-amber-500/80 hover:bg-amber-500 text-white rounded transition" title="Edit Chord">
                        <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                        </svg>
                    </button>
                    <div class="text-center pt-1">
                        <div class="text-lg font-bold text-white" style="-webkit-text-fill-color: white;">${chordSymbol}</div>
                        <div class="text-[10px] text-gray-400 mt-0.5">${chord.beats || 4} beats</div>
                    </div>
                </div>
            </div>
        `;

        // Edit button click handler
        const editBtn = wrapper.querySelector('.edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.showChordBracketEditor) {
                    window.showChordBracketEditor(index, null, e);
                }
            });
        }

        wrapper.addEventListener('click', (e) => {
            if (e.target.closest('.drag-handle') || e.target.closest('button')) return;
            if (window.setSelectedChordIndex) {
                window.setSelectedChordIndex(index);
            }
        });

        return wrapper;
    }

    /**
     * Strip fullscreen-only elements from chord card (expand btn, notation toggle, expanded view)
     * Keeps: play button, delete button, inversion indicators, duration dropdown, etc.
     */
    _stripFullscreenOnlyElements(wrapper) {
        if (!wrapper) return;

        // Remove expand button (the ⋯ button)
        const expandBtn = wrapper.querySelector('.expand-btn');
        if (expandBtn) expandBtn.remove();

        // Remove notation toggle button (musical note icon)
        const notationToggleBtn = wrapper.querySelector('.notation-toggle-btn');
        if (notationToggleBtn) notationToggleBtn.remove();

        // Remove/hide notation view container
        const notationView = wrapper.querySelector('.notation-view');
        if (notationView) notationView.remove();

        // Remove expanded card view if present
        const expandedCard = wrapper.querySelector('.expanded-chord-card');
        if (expandedCard) expandedCard.remove();
    }

    /**
     * Create a ghost card for pattern continuation suggestions
     * Appears at the end of the chord progression when a pattern is detected
     * @param {Array} chords - The current chord progression
     * @param {string} key - Current musical key
     * @returns {HTMLElement|null} Ghost card element or null if no pattern detected
     */
    _createFSPatternGhostCard(chords, key) {
        if (!chords || chords.length < 2) return null;

        const suggestion = suggestPatternContinuation(chords, key);
        if (!suggestion) return null;

        const wrapper = document.createElement('div');
        wrapper.className = 'fs-ghost-suggestion-card';
        wrapper.style.cssText = `
            width: 120px;
            min-width: 120px;
            padding: 8px;
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%);
            border: 2px dashed #a5b4fc;
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            flex-shrink: 0;
            scroll-snap-align: start;
        `;

        // Get chord symbol for display
        const chordDef = CHORD_DEFINITIONS[suggestion.type];
        const symbol = chordDef?.symbol || '';
        const displayName = `${suggestion.root}${symbol}`;

        // Inversion indicator
        const invNum = suggestion.inversion || 0;
        const invText = invNum === 1 ? '¹' : invNum === 2 ? '²' : invNum === 3 ? '³' : invNum === 4 ? '⁴' : '';

        wrapper.innerHTML = `
            <div style="font-size: 10px; color: #6366f1; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                ${suggestion.pattern || 'Continue'}
            </div>
            <div style="font-size: 18px; font-weight: 700; color: #4f46e5;">
                ${displayName}${invText}?
            </div>
            <div style="font-size: 10px; color: #64748b; text-align: center; line-height: 1.3; max-width: 100px;">
                ${suggestion.reason}
            </div>
            <div style="display: flex; gap: 4px; margin-top: 4px;">
                <button class="fs-ghost-add-btn" style="
                    padding: 4px 10px;
                    background: #4f46e5;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    font-size: 10px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.15s;
                ">+ Add</button>
                ${suggestion.alternatives && suggestion.alternatives.length > 0 ? `
                    <button class="fs-ghost-alt-btn" style="
                        padding: 4px 8px;
                        background: transparent;
                        color: #6366f1;
                        border: 1px solid #a5b4fc;
                        border-radius: 6px;
                        font-size: 10px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.15s;
                    " title="Show alternatives">⋯</button>
                ` : ''}
            </div>
        `;

        // Hover effects
        wrapper.addEventListener('mouseenter', () => {
            wrapper.style.borderColor = '#6366f1';
            wrapper.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)';
        });
        wrapper.addEventListener('mouseleave', () => {
            wrapper.style.borderColor = '#a5b4fc';
            wrapper.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)';
        });

        // Add button click handler
        const addBtn = wrapper.querySelector('.fs-ghost-add-btn');
        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._addSuggestedChord(suggestion, key);
            });
            addBtn.addEventListener('mouseenter', () => addBtn.style.background = '#4338ca');
            addBtn.addEventListener('mouseleave', () => addBtn.style.background = '#4f46e5');
        }

        // Alternatives button click handler
        const altBtn = wrapper.querySelector('.fs-ghost-alt-btn');
        if (altBtn && suggestion.alternatives) {
            altBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._showFSPatternAlternatives(e, suggestion, key);
            });
            altBtn.addEventListener('mouseenter', () => {
                altBtn.style.background = '#eef2ff';
            });
            altBtn.addEventListener('mouseleave', () => {
                altBtn.style.background = 'transparent';
            });
        }

        // Clicking the card itself adds the suggested chord
        wrapper.addEventListener('click', () => {
            this._addSuggestedChord(suggestion, key);
        });

        return wrapper;
    }

    /**
     * Add suggested chord to progression (used by ghost card)
     * @param {Object} suggestion - The suggestion object
     * @param {string} key - Current key
     */
    _addSuggestedChord(suggestion, key) {
        const compState = getCompositionState();
        if (!compState) return;

        const inversion = suggestion.inversion || 0;
        const rootName = suggestion.root;
        const type = suggestion.type;

        // Build chord data using the app's helper (same pattern as _handleQuickAddChord)
        let chordData = null;
        if (window.getInvertedChordNotes) {
            const result = window.getInvertedChordNotes(
                rootName,
                type,
                inversion,
                key,
                0,  // octaveShift
                window.getKeyBasedEnharmonic?.() || 'sharp',
                window.getNotationPreference?.() || 'full'
            );
            const roman = window.noteToRomanNumeral?.(rootName, key, type) || suggestion.suggestedRoman || '';

            // Get default beats based on time signature
            const ts = compState.metadata?.timeSignature || { num: 4, denom: 4 };
            const defaultBeats = ts.num * (4 / ts.denom);

            chordData = {
                name: result?.name || `${rootName} ${type}`,
                simpleName: result?.simpleName || rootName,
                notes: result?.specificNotes || [],
                root: rootName,
                type: type,
                inversion: inversion,
                selectionMode: 'chord',
                omittedNotes: [],
                octaveShift: 0,
                lhType: 'off',
                lhInversion: 0,
                lhOctaveShift: 0,
                lhNotes: [],
                lhOmittedNotes: [],
                roman: roman,
                beats: defaultBeats
            };
        }

        if (!chordData) {
            console.warn('Could not create chord data for ghost card suggestion');
            return;
        }

        // Add chord at the end using compositionState
        const insertAtIndex = compState.getChords?.()?.length || 0;
        const success = compState.insertChord(insertAtIndex, chordData);

        if (success) {
            // Update roman numerals
            if (window.updateRomanNumerals) {
                window.updateRomanNumerals();
            }

            // Sync and re-render
            if (window.syncProgressionToMelodyComposer) {
                window.syncProgressionToMelodyComposer();
            }
            if (window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
            }

            // Re-render progression displays
            if (window.renderProgressionDisplay) {
                window.renderProgressionDisplay('melody-progression-visualization', true);
            }

            // Re-render this panel
            const content = this.container?.querySelector('#fs-dock-panel-content');
            if (content && this.activePanel === 'chords') {
                this._renderChordsPanel(content);
            } else if (content && this.activePanel === 'quick-add') {
                this._renderQuickAddPanel(content);
            }

            // Show toast
            if (window.toast) {
                const chordDef = CHORD_DEFINITIONS[suggestion.type];
                const symbol = chordDef?.symbol || '';
                const invText = inversion > 0 ? ` (inv ${inversion})` : '';
                window.toast.success(`Added ${rootName}${symbol}${invText} to complete the ${suggestion.pattern || 'pattern'}`);
            }
        }
    }

    /**
     * Show popup with alternative pattern suggestions
     * @param {Event} e - Click event
     * @param {Object} suggestion - Main suggestion with alternatives array
     * @param {string} key - Current key
     */
    _showFSPatternAlternatives(e, suggestion, key) {
        // Remove any existing popup
        const existingPopup = document.getElementById('fs-pattern-alternatives-popup');
        if (existingPopup) existingPopup.remove();

        const popup = document.createElement('div');
        popup.id = 'fs-pattern-alternatives-popup';
        popup.style.cssText = `
            position: fixed;
            z-index: 2147483647;
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
            min-width: 160px;
            pointer-events: auto;
            isolation: isolate;
        `;

        // Position near the button
        const rect = e.target.getBoundingClientRect();
        popup.style.left = `${rect.left}px`;
        popup.style.bottom = `${window.innerHeight - rect.top + 4}px`; // Position above

        // Build alternatives list
        let html = `<div style="font-size: 10px; color: #64748b; padding: 4px 8px; font-weight: 600;">Other options:</div>`;

        suggestion.alternatives.forEach(alt => {
            const altDef = CHORD_DEFINITIONS[alt.type];
            const altSymbol = altDef?.symbol || '';
            const altDisplay = `${alt.root}${altSymbol}`;
            const altInv = alt.inversion > 0 ? ` (inv ${alt.inversion})` : '';

            html += `
                <div class="fs-pattern-alt-option" data-root="${alt.root}" data-type="${alt.type}" data-inversion="${alt.inversion || 0}" data-octave="${alt.octave || 4}" style="
                    padding: 8px 12px;
                    cursor: pointer;
                    border-radius: 6px;
                    transition: background 0.15s;
                ">
                    <div style="font-weight: 600; color: #1f2937;">${altDisplay}${altInv}</div>
                    <div style="font-size: 10px; color: #64748b;">${alt.reason}</div>
                </div>
            `;
        });

        popup.innerHTML = html;

        // Add click handlers for alternatives
        popup.querySelectorAll('.fs-pattern-alt-option').forEach(opt => {
            opt.addEventListener('mouseenter', () => opt.style.background = '#f1f5f9');
            opt.addEventListener('mouseleave', () => opt.style.background = 'transparent');
            opt.addEventListener('click', () => {
                const altSuggestion = {
                    root: opt.dataset.root,
                    type: opt.dataset.type,
                    inversion: parseInt(opt.dataset.inversion) || 0,
                    octave: parseInt(opt.dataset.octave) || 4,
                    pattern: suggestion.pattern
                };
                this._addSuggestedChord(altSuggestion, key);
                popup.remove();
            });
        });

        document.body.appendChild(popup);

        // Close on click outside
        const closeHandler = (evt) => {
            // Use geometric bounds check for fullscreen popup reliability
            const popupRect = popup.getBoundingClientRect();
            const clickInPopupBounds =
                evt.clientX >= popupRect.left && evt.clientX <= popupRect.right &&
                evt.clientY >= popupRect.top && evt.clientY <= popupRect.bottom;

            if (!clickInPopupBounds && !popup.contains(evt.target)) {
                popup.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 10);
    }

    // ========================================================================
    // REUSABLE COMPACT PROGRESSION VIEW
    // ========================================================================

    /**
     * Render a compact progression view (chord chips grouped by section)
     * This is a read-only view for quick overview of the progression
     * @param {string} panelId - Unique ID prefix for this panel's elements
     * @param {Object} options - Configuration options
     * @param {Set} options.selectedSectionIds - Currently selected section IDs
     * @param {number} options.selectedChordIndex - Currently selected chord index (-1 for none)
     * @param {string} options.accentColor - Accent color for the panel (e.g., '#a855f7')
     * @param {boolean} options.showGhostCard - Whether to show the pattern ghost card
     * @returns {string} HTML string for the compact progression view
     */
    _renderCompactProgressionView(panelId, options = {}) {
        const {
            selectedSectionIds = new Set(),
            selectedChordIndex = -1,
            accentColor = '#6366f1',
            showGhostCard = true
        } = options;

        const progressionData = getProgressionData() || [];
        const compositionState = getCompositionState();
        const sections = compositionState?.getSections?.() || [];
        const key = getCurrentKey() || 'C';

        // Build sections with ungrouped chords
        const allSectionsWithPseudo = buildSectionsWithUngrouped(sections, progressionData.length);

        // Helper to get chord symbol suffix
        const getChordSymbol = (type) => {
            const chordDef = CHORD_DEFINITIONS[type];
            return chordDef?.symbol || '';
        };

        // Helper for inversion superscript
        const getInversionLabel = (inversion) => {
            return { 1: '¹', 2: '²', 3: '³', 4: '⁴' }[inversion] || '';
        };

        if (progressionData.length === 0) {
            return `
                <div class="px-3 py-4 text-center">
                    <div class="text-xs text-slate-400 italic">No chords in progression yet.</div>
                </div>
            `;
        }

        // Section picker row
        let sectionPickerHTML = '';
        if (allSectionsWithPseudo.length > 0) {
            const isAllSelected = selectedSectionIds.size === 0;
            sectionPickerHTML = `
                <div class="flex items-center gap-1.5 overflow-x-auto pt-1 pb-2 px-3" style="scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;">
                    <span class="text-[9px] text-slate-500 flex-shrink-0">Sections:</span>
                    <button data-section-id="all" class="${panelId}-section-pill px-2.5 py-1.5 rounded-full text-[9px] font-semibold transition-all flex-shrink-0
                        ${isAllSelected ? 'text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                        style="${isAllSelected ? `background: ${accentColor};` : ''}"
                        title="Show all chords">All</button>
                    ${allSectionsWithPseudo.map(section => {
                        const isSelected = selectedSectionIds.has(section.id);
                        const color = section.color || '#9ca3af';
                        return `
                            <button data-section-id="${section.id}" class="${panelId}-section-pill px-2.5 py-1.5 rounded-full text-[9px] font-semibold transition-all flex-shrink-0"
                                style="background: ${isSelected ? color : hexToRgba(color, 0.15)}; color: ${isSelected ? 'white' : color}; border: 1px solid ${color};"
                                title="${section.label} (${section.chordIndices.length} chords)">
                                ${section.label}
                            </button>
                        `;
                    }).join('')}
                </div>
            `;
        }

        // Determine visible sections based on selection
        let visibleSections = [];
        if (selectedSectionIds.size === 0) {
            visibleSections = [...allSectionsWithPseudo];
        } else {
            visibleSections = allSectionsWithPseudo.filter(s => selectedSectionIds.has(s.id));
        }

        // If no sections defined at all, show all chords in a single flat list
        if (allSectionsWithPseudo.length === 0) {
            visibleSections = [{
                id: 'all',
                label: 'All Chords',
                color: accentColor,
                chordIndices: progressionData.map((_, i) => i),
                isPseudoSection: true
            }];
        }

        // Build chord chips grouped by section
        const chordChipsHTML = visibleSections.map(section => {
            const sectionColor = section.color || '#9ca3af';
            const chipsHTML = section.chordIndices.map(idx => {
                if (idx >= progressionData.length) return '';
                const chord = progressionData[idx];
                const symbol = getChordSymbol(chord.type);
                const invLabel = getInversionLabel(chord.inversion);
                const isSelected = selectedChordIndex === idx;

                return `
                    <button class="${panelId}-chord-chip flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all"
                        data-chord-idx="${idx}"
                        style="background: ${isSelected ? hexToRgba(sectionColor, 0.4) : hexToRgba(sectionColor, 0.18)};
                               color: ${sectionColor};
                               border: 1px solid ${sectionColor};
                               ${isSelected ? `outline: 2px solid ${accentColor}; outline-offset: 1px;` : ''}"
                        title="${chord.root} ${chord.type}${chord.inversion ? ' (inv ' + chord.inversion + ')' : ''} — Click to select, hold to play">
                        ${chord.root}${symbol}${invLabel}
                    </button>
                `;
            }).join('');

            return `
                <div class="flex-shrink-0 rounded overflow-hidden border" style="border-color: ${hexToRgba(sectionColor, 0.3)}; background: ${hexToRgba(sectionColor, 0.05)};">
                    <div class="text-[9px] font-semibold text-white px-2 py-1 text-center whitespace-nowrap" style="background: ${sectionColor};">${section.label}</div>
                    <div class="flex items-center gap-0.5 p-1.5">${chipsHTML}</div>
                </div>
            `;
        }).join('');

        // Ghost card HTML for pattern suggestions
        let ghostCardHTML = '';
        if (showGhostCard && selectedSectionIds.size === 0) {
            const suggestion = suggestPatternContinuation(progressionData, key);
            if (suggestion) {
                const chordDef = CHORD_DEFINITIONS[suggestion.type];
                const symbol = chordDef?.symbol || '';
                const displayName = `${suggestion.root}${symbol}`;
                const invNum = suggestion.inversion || 0;
                const invText = invNum === 1 ? '¹' : invNum === 2 ? '²' : invNum === 3 ? '³' : invNum === 4 ? '⁴' : '';

                ghostCardHTML = `
                    <div class="${panelId}-ghost-card flex-shrink-0 rounded overflow-hidden border-2 border-dashed cursor-pointer transition-all hover:border-solid"
                         style="border-color: ${accentColor}; background: ${hexToRgba(accentColor, 0.08)};"
                         data-suggestion='${JSON.stringify(suggestion).replace(/'/g, "&#39;")}'
                         title="Click to add ${displayName} to complete the ${suggestion.pattern || 'pattern'}">
                        <div class="text-[8px] font-semibold text-white px-2 py-0.5 text-center whitespace-nowrap" style="background: ${accentColor};">
                            ${suggestion.pattern || 'Continue'}
                        </div>
                        <div class="flex items-center justify-center gap-1 p-1.5">
                            <span class="text-[11px] font-bold" style="color: ${accentColor};">${displayName}${invText}</span>
                            <span class="text-[9px]" style="color: ${accentColor};">+</span>
                        </div>
                    </div>
                `;
            }
        }

        return `
            <div class="border-b border-slate-200 bg-slate-50/50">
                ${sectionPickerHTML}
                <div class="flex items-center gap-1.5 overflow-x-auto px-3 py-2" style="scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;">
                    ${chordChipsHTML}
                    ${ghostCardHTML}
                </div>
            </div>
        `;
    }

    /**
     * Attach event handlers for the compact progression view
     * @param {HTMLElement} container - The panel container
     * @param {string} panelId - Unique ID prefix matching the render call
     * @param {Object} callbacks - Callback functions
     * @param {Function} callbacks.onSectionChange - Called when section selection changes (sectionId, selectedSectionIds)
     * @param {Function} callbacks.onChordClick - Called when a chord chip is clicked (chordIndex)
     * @param {Function} callbacks.onChordHold - Called when a chord chip is held (chordIndex, chord)
     * @param {Function} callbacks.onChordRelease - Called when a chord chip hold is released
     * @param {Function} callbacks.onGhostCardClick - Called when ghost card is clicked (suggestion)
     * @param {Set} selectedSectionIds - Reference to the selected section IDs set
     */
    _attachCompactProgressionHandlers(container, panelId, callbacks, selectedSectionIds) {
        const progressionData = getProgressionData() || [];
        const key = getCurrentKey() || 'C';

        // Section pill click handlers
        container.querySelectorAll(`.${panelId}-section-pill`).forEach(pill => {
            pill.addEventListener('click', () => {
                const sectionId = pill.dataset.sectionId;
                if (sectionId === 'all') {
                    selectedSectionIds.clear();
                } else {
                    if (selectedSectionIds.has(sectionId)) {
                        selectedSectionIds.delete(sectionId);
                    } else {
                        selectedSectionIds.clear();
                        selectedSectionIds.add(sectionId);
                    }
                }
                if (callbacks.onSectionChange) {
                    callbacks.onSectionChange(sectionId, selectedSectionIds);
                }
            });
        });

        // Chord chip click and hold handlers
        // Audio plays IMMEDIATELY on mousedown (no delay), click selects on release if hold was short
        container.querySelectorAll(`.${panelId}-chord-chip`).forEach(chip => {
            let holdStartTime = 0;
            let isHolding = false;
            const HOLD_THRESHOLD = 150; // ms - if held longer than this, it's a "hold" not a "click"

            const startHold = (e) => {
                e.preventDefault();
                holdStartTime = Date.now();
                isHolding = true;
                // Play audio IMMEDIATELY (no delay) - same as unified modal behavior
                const idx = parseInt(chip.dataset.chordIdx, 10);
                if (!isNaN(idx) && idx < progressionData.length && callbacks.onChordHold) {
                    callbacks.onChordHold(idx, progressionData[idx]);
                }
            };

            const endHold = () => {
                const holdDuration = Date.now() - holdStartTime;
                if (isHolding && callbacks.onChordRelease) {
                    callbacks.onChordRelease();
                }
                // If it was a short hold (quick tap), also trigger click for selection
                if (isHolding && holdDuration < HOLD_THRESHOLD && callbacks.onChordClick) {
                    const idx = parseInt(chip.dataset.chordIdx, 10);
                    if (!isNaN(idx)) {
                        callbacks.onChordClick(idx);
                    }
                }
                isHolding = false;
            };

            chip.addEventListener('mousedown', startHold);
            chip.addEventListener('mouseup', endHold);
            chip.addEventListener('mouseleave', () => {
                // Only release audio if still holding, but don't trigger click
                if (isHolding && callbacks.onChordRelease) {
                    callbacks.onChordRelease();
                }
                isHolding = false;
            });
            chip.addEventListener('touchstart', startHold, { passive: false });
            chip.addEventListener('touchend', endHold);
            chip.addEventListener('touchcancel', () => {
                if (isHolding && callbacks.onChordRelease) {
                    callbacks.onChordRelease();
                }
                isHolding = false;
            });
        });

        // Ghost card click handler
        container.querySelectorAll(`.${panelId}-ghost-card`).forEach(ghost => {
            ghost.addEventListener('click', () => {
                try {
                    const suggestionStr = ghost.dataset.suggestion;
                    if (suggestionStr && callbacks.onGhostCardClick) {
                        const suggestion = JSON.parse(suggestionStr.replace(/&#39;/g, "'"));
                        callbacks.onGhostCardClick(suggestion);
                    }
                } catch (e) {
                    console.warn('Error parsing ghost card suggestion:', e);
                }
            });
        });
    }

    /**
     * Initialize Sortable on section containers (for reordering entire sections AND receiving cards from sections)
     * MIRRORS Composition Studio's initializeSimplifiedSortable
     */
    _initializeFSSectionContainerSortable(container) {
        if (typeof Sortable === 'undefined') return;

        if (container.sortableInstance) {
            container.sortableInstance.destroy();
        }

        container.sortableInstance = new Sortable(container, {
            group: {
                name: 'fs-progression-cards',  // Same group as section cards for cross-container drag
                pull: true,
                put: true  // Accept cards dragged out of sections
            },
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            // Use drag-handle for cards, section-banner for sections
            handle: '.drag-handle, .section-banner',
            // Allow dragging both cards and section containers
            draggable: '.chord-card-wrapper[data-chord-index], .section-unified-container',
            swapThreshold: 0.4,
            sort: true,
            // Exclude buttons from triggering drag
            filter: 'button, select, input, .play-btn, .delete-btn, .edit-btn, .expand-btn, .no-drag',
            preventOnFilter: false,
            onEnd: (evt) => {
                const draggedItem = evt.item;

                // Check if we dragged a section container or a chord card
                if (draggedItem.classList.contains('section-unified-container')) {
                    // Section container was reordered
                    window.saveStateBeforeChange?.();

                    const compState = window.getCompositionState?.();
                    const trainerState = window.getTrainerState?.();
                    if (!compState || !trainerState) return;

                    const allContainers = Array.from(container.querySelectorAll(':scope > .section-unified-container'));
                    const newSectionOrder = allContainers
                        .map(cont => cont.getAttribute('data-section-id'))
                        .filter(Boolean);

                    const success = compState.reorderSectionsByIds(
                        newSectionOrder,
                        () => trainerState.progressionData,
                        (newData) => {
                            if (window.setProgressionData && window.setProgressionRomans) {
                                const newRomans = newData.map((_, i) => trainerState.progressionRomans[i] || 'I');
                                window.setProgressionData(newData);
                                window.setProgressionRomans(newRomans);
                            }
                        }
                    );

                    if (success) {
                        window.invalidateProgressionDataCache?.();
                        window.refreshNotationFromProgression?.();
                        window.renderProgressionDisplay?.('melody-progression-visualization', false);
                        this._renderChordsPanel(this.container.querySelector('#fs-dock-panel-content'));
                    }
                } else if (draggedItem.classList.contains('chord-card-wrapper')) {
                    // Chord card was dragged - delegate to the Composition Studio handler
                    // This handles cards being dropped directly on the main container (ungrouped)
                    if (evt.from === evt.to) {
                        // Same container - use handleCardDragWithinSection
                        window.saveStateBeforeChange?.();
                        const fromSectionId = evt.from.getAttribute('data-section-id');
                        this._handleFSCardDrag(evt, fromSectionId);
                    }
                    // Cross-container moves are handled by onAdd
                }
            },
            onAdd: (evt) => {
                // A card was dropped onto the main container from a section
                window.saveStateBeforeChange?.();
                const fromSectionId = evt.from.getAttribute('data-section-id');
                this._handleFSCardDrag(evt, fromSectionId);
            }
        });
    }

    /**
     * Initialize Sortable on cards area (for dragging cards within/between sections)
     */
    _initializeFSCardsAreaSortable(cardsArea, sectionId) {
        if (typeof Sortable === 'undefined') return;

        if (cardsArea.sortableInstance) {
            cardsArea.sortableInstance.destroy();
        }

        cardsArea.sortableInstance = new Sortable(cardsArea, {
            group: {
                name: 'fs-progression-cards',
                pull: true,
                put: (to, from, dragEl) => {
                    return dragEl.classList.contains('chord-card-wrapper') &&
                           dragEl.hasAttribute('data-chord-index');
                }
            },
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            handle: '.drag-handle',
            filter: 'button, select, input, .no-drag',
            preventOnFilter: false,
            draggable: '.chord-card-wrapper[data-chord-index]',
            swapThreshold: 0.65,
            delay: 150,
            delayOnTouchOnly: true,
            touchStartThreshold: 5,
            onEnd: (evt) => {
                if (evt.from === evt.to) {
                    window.saveStateBeforeChange?.();
                    this._handleFSCardDrag(evt, sectionId);
                }
            },
            onAdd: (evt) => {
                window.saveStateBeforeChange?.();
                this._handleFSCardDrag(evt, evt.from.getAttribute('data-section-id'));
            }
        });
    }

    /**
     * Initialize Sortable for flat cards (no sections)
     * Uses same group as section cards to allow cross-container drag
     */
    _initializeFSSimplifiedSortable(container) {
        if (typeof Sortable === 'undefined') return;

        if (container.sortableInstance) {
            container.sortableInstance.destroy();
        }

        container.sortableInstance = new Sortable(container, {
            group: {
                name: 'fs-progression-cards',  // Same group as section cards for cross-container drag
                pull: true,
                put: (to, from, dragEl) => {
                    return dragEl.classList.contains('chord-card-wrapper') &&
                           dragEl.hasAttribute('data-chord-index');
                }
            },
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            handle: '.drag-handle',
            filter: 'button, select, input, .no-drag',
            preventOnFilter: false,
            draggable: '.chord-card-wrapper[data-chord-index]',
            swapThreshold: 0.65,
            delay: 150,
            delayOnTouchOnly: true,
            touchStartThreshold: 5,
            onEnd: (evt) => {
                if (evt.from === evt.to) {
                    // Same container reorder
                    window.saveStateBeforeChange?.();

                    const oldIndex = parseInt(evt.item.getAttribute('data-chord-index'));
                    const allCards = Array.from(container.querySelectorAll('.chord-card-wrapper[data-chord-index]'));
                    const newIndex = allCards.indexOf(evt.item);

                    if (oldIndex === newIndex) return;

                    const trainerState = window.getTrainerState?.();
                    if (!trainerState) return;

                    const progressionData = [...trainerState.progressionData];
                    const progressionRomans = [...trainerState.progressionRomans];

                    const [movedChord] = progressionData.splice(oldIndex, 1);
                    const [movedRoman] = progressionRomans.splice(oldIndex, 1);
                    progressionData.splice(newIndex, 0, movedChord);
                    progressionRomans.splice(newIndex, 0, movedRoman);

                    window.setProgressionData?.(progressionData);
                    window.setProgressionRomans?.(progressionRomans);
                    window.invalidateProgressionDataCache?.();
                    window.refreshNotationFromProgression?.();
                    window.renderProgressionDisplay?.('melody-progression-visualization', false);
                    this._renderChordsPanel(this.container.querySelector('#fs-dock-panel-content'));

                    // Dispatch chordReordered event for tutorial system
                    window.dispatchEvent(new CustomEvent('chordReordered', {
                        detail: { fromIndex: oldIndex, toIndex: newIndex }
                    }));
                }
            },
            onAdd: (evt) => {
                // Card was added from a section - handle cross-container move
                window.saveStateBeforeChange?.();
                this._handleFSCardDrag(evt, evt.from.getAttribute('data-section-id'));
            }
        });
    }

    /**
     * Initialize Sortable on section chips for drag-drop reordering
     */
    _initializeFSSectionChipsSortable(chipsContainer) {
        if (typeof Sortable === 'undefined') return;

        if (chipsContainer.sortableInstance) {
            chipsContainer.sortableInstance.destroy();
        }

        chipsContainer.sortableInstance = new Sortable(chipsContainer, {
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            draggable: '.fs-section-chip',
            handle: '.fs-section-chip-drag-handle',
            delay: 100,
            delayOnTouchOnly: true,
            touchStartThreshold: 3,
            onEnd: (evt) => {
                window.saveStateBeforeChange?.();

                const compState = window.getCompositionState?.();
                const trainerState = window.getTrainerState?.();
                if (!compState || !trainerState) return;

                const allChips = Array.from(chipsContainer.querySelectorAll('.fs-section-chip'));
                const newSectionOrder = allChips
                    .map(chip => chip.getAttribute('data-section-id'))
                    .filter(Boolean);

                const success = compState.reorderSectionsByIds(
                    newSectionOrder,
                    () => trainerState.progressionData,
                    (newData) => {
                        if (window.setProgressionData && window.setProgressionRomans) {
                            const newRomans = newData.map((_, i) => trainerState.progressionRomans[i] || 'I');
                            window.setProgressionData(newData);
                            window.setProgressionRomans(newRomans);
                        }
                    }
                );

                if (success) {
                    window.invalidateProgressionDataCache?.();
                    window.refreshNotationFromProgression?.();
                    window.renderProgressionDisplay?.('melody-progression-visualization', false);
                    this._renderChordsPanel(this.container.querySelector('#fs-dock-panel-content'));
                }
            }
        });
    }

    /**
     * Handle card drag within or between sections
     */
    _handleFSCardDrag(evt, fromSectionId) {
        // Delegate to Composition Studio's handler if available
        if (typeof window.handleCardDragWithinSection === 'function') {
            window.handleCardDragWithinSection(evt, fromSectionId);
            // Refresh fullscreen panel
            setTimeout(() => {
                this._renderChordsPanel(this.container.querySelector('#fs-dock-panel-content'));
            }, 100);
            return;
        }

        // Fallback: simple reorder logic
        const allCards = Array.from(evt.to.querySelectorAll('.chord-card-wrapper[data-chord-index]'));
        const newOrder = allCards.map(card => parseInt(card.getAttribute('data-chord-index')));

        // Update data-chord-index attributes to reflect new order
        allCards.forEach((card, i) => {
            card.setAttribute('data-chord-index', i);
        });

        window.invalidateProgressionDataCache?.();
        window.refreshNotationFromProgression?.();
        window.renderProgressionDisplay?.('melody-progression-visualization', false);
        this._renderChordsPanel(this.container.querySelector('#fs-dock-panel-content'));
    }

    /**
     * Helper: Convert hex color to rgba
     */
    _hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Helper: Spell note in key (enharmonic correction)
     */
    _spellNoteInKey(note, key) {
        if (typeof window.spellNoteInKey === 'function') {
            return window.spellNoteInKey(note, key);
        }
        return note;
    }

    _renderQuickAddPanel(container) {
        const compState = getCompositionState();
        // Get key from trainerState (the single source of truth for current key)
        const key = getCurrentKey() || 'C';

        // Get chord progression data
        let chords = [];
        if (typeof compState?.getChords === 'function') {
            chords = compState.getChords() || [];
        }
        if (chords.length === 0) {
            const progressionData = compState?.exportToProgressionData?.();
            chords = Array.isArray(progressionData) ? progressionData : [];
        }

        // Get sections for section view
        const sections = compState?.buildSectionView?.() || compState?.getSections?.() || [];
        const hasSections = sections.length > 0;

        // Get selected chord index from MAIN APP's selection (purple/blue ring)
        // Use window.getSelectedChordIndex() instead of our own _quickAddSelectedIndex
        const selectedIndex = window.getSelectedChordIndex?.() ?? -1;
        let selectedChordInfo = null;
        let sectionInfo = null;

        if (selectedIndex >= 0 && selectedIndex < chords.length) {
            const chord = chords[selectedIndex];
            const typeSymbol = CHORD_DEFINITIONS[chord.type]?.symbol || '';
            const displayRoot = this._spellNoteInKey(chord.root || 'C', key);
            const chordName = chord.simpleName || (displayRoot + typeSymbol);

            // Get section for this chord
            sectionInfo = compState?.getSectionForChord?.(selectedIndex);

            selectedChordInfo = {
                name: chordName,
                position: selectedIndex + 1,
                section: sectionInfo
            };
        }

        // Build insert indicator text
        let insertIndicatorText = 'Insert at end';
        if (selectedChordInfo) {
            insertIndicatorText = `Insert after ${selectedChordInfo.name} at position ${selectedChordInfo.position}`;
            if (selectedChordInfo.section) {
                insertIndicatorText += ` (in ${selectedChordInfo.section.label})`;
            }
        }

        // Initialize view mode for quick-add if not set
        if (!this._quickAddViewMode) {
            this._quickAddViewMode = 'scroll';
        }

        // Determine if compact view is active
        const isCompactView = this._quickAddCompactView;

        // Combined layout: Quick Add controls on top, chord progression below
        // Using forest/moss green theme (#4d7c0f = lime-700, #3f6212 = lime-800)
        container.innerHTML = `
            <div class="flex items-center justify-between px-3 py-2 border-b" style="background: linear-gradient(to right, #4d7c0f, #3f6212); border-color: #365314;">
                <div class="flex items-center gap-3">
                    <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Quick Add Chord</span>
                    <!-- Insert position indicator - in header to avoid line wrapping -->
                    <span id="fs-quick-insert-indicator" class="text-[11px] text-white/90 font-medium bg-white/20 px-2 py-0.5 rounded" style="-webkit-text-fill-color: rgba(255,255,255,0.9);">
                        ${insertIndicatorText}
                    </span>
                </div>
                <div class="flex items-center gap-2">
                    <!-- Progression Summary/Details Slider Toggle (first/leftmost) -->
                    <div class="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full" title="Toggle between progression summary and detailed card view">
                        <span class="text-[8px] font-medium ${isCompactView ? 'text-white' : 'text-white/50'}" style="-webkit-text-fill-color: ${isCompactView ? 'white' : 'rgba(255,255,255,0.5)'};">Progression Summary</span>
                        <label class="relative inline-flex items-center cursor-pointer mx-0.5">
                            <input type="checkbox" id="fs-quickadd-compact-toggle" class="sr-only peer" ${isCompactView ? '' : 'checked'}>
                            <div class="w-7 h-4 bg-lime-300 peer-focus:outline-none rounded-full peer
                                        peer-checked:after:translate-x-full peer-checked:after:border-white
                                        after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                        after:bg-white after:border-gray-300 after:border after:rounded-full
                                        after:h-3 after:w-3 after:transition-all peer-checked:bg-lime-600"></div>
                        </label>
                        <span class="text-[8px] font-medium ${isCompactView ? 'text-white/50' : 'text-white'}" style="-webkit-text-fill-color: ${isCompactView ? 'rgba(255,255,255,0.5)' : 'white'};">Progression Details</span>
                    </div>
                    <!-- Legend button (hidden in compact view) -->
                    <button id="fs-quickadd-legend-btn" class="${isCompactView ? 'hidden' : ''} px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-medium rounded transition flex items-center gap-1" title="View chord function color legend">
                        <span class="text-[8px]" style="-webkit-text-fill-color: #86efac;">●</span>
                        <span class="text-[8px]" style="-webkit-text-fill-color: #7dd3fc;">●</span>
                        <span class="text-[8px]" style="-webkit-text-fill-color: #fcd34d;">●</span>
                        <span>Legend</span>
                    </button>
                    <!-- View mode toggle (hidden in compact view) -->
                    <div class="${isCompactView ? 'hidden' : 'flex'} gap-0.5 bg-white/20 rounded-lg p-0.5">
                        <button class="fs-qa-view-mode-btn px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${this._quickAddViewMode === 'scroll' ? 'bg-white shadow' : 'text-white/80 hover:text-white'}"
                                data-mode="scroll" style="${this._quickAddViewMode === 'scroll' ? 'color: #3f6212; -webkit-text-fill-color: #3f6212;' : ''}">
                            Scroll
                        </button>
                        <button class="fs-qa-view-mode-btn px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${this._quickAddViewMode === 'section' ? 'bg-white shadow' : 'text-white/80 hover:text-white'}"
                                data-mode="section" style="${this._quickAddViewMode === 'section' ? 'color: #3f6212; -webkit-text-fill-color: #3f6212;' : ''}">
                            Section
                        </button>
                    </div>
                    <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
            <!-- Quick Add Controls - Compact single row -->
            <div class="px-3 py-2 bg-gray-50 border-b border-gray-200">
                <div class="flex items-center gap-2 flex-wrap">
                    <!-- Scale Filter -->
                    <select id="fs-quick-scale" class="p-1.5 text-xs border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white min-w-[140px]" title="Scale Filter">
                        <option value="">All Chords</option>
                    </select>
                    <!-- Root Note -->
                    <select id="fs-quick-root" class="p-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-w-[80px]">
                        <option value="0">C</option>
                        <option value="1">C# / Db</option>
                        <option value="2">D</option>
                        <option value="3">D# / Eb</option>
                        <option value="4">E</option>
                        <option value="5">F</option>
                        <option value="6">F# / Gb</option>
                        <option value="7">G</option>
                        <option value="8">G# / Ab</option>
                        <option value="9">A</option>
                        <option value="10">A# / Bb</option>
                        <option value="11">B</option>
                    </select>
                    <!-- Chord Type -->
                    <select id="fs-quick-type" class="p-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-w-[120px]">
                    </select>
                    <!-- Inversion -->
                    <select id="fs-quick-inversion" class="p-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-w-[100px]">
                        <option value="0">Root Pos</option>
                        <option value="1">1st Inv</option>
                        <option value="2">2nd Inv</option>
                        <option value="3">3rd Inv</option>
                    </select>
                    <!-- Add Button - forest green to match header -->
                    <button id="fs-quick-add-btn" class="px-3 py-1.5 text-white text-xs font-semibold rounded-lg shadow transition flex items-center gap-1" style="background: #4d7c0f;" onmouseover="this.style.background='#3f6212'" onmouseout="this.style.background='#4d7c0f'">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                        Add Chord
                    </button>
                    <!-- N.C. Button -->
                    <button id="fs-quick-nc-btn" class="px-2 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-xs font-medium rounded-lg shadow transition flex items-center gap-1" title="Add No Chord (N.C.)">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                        Add N.C.
                    </button>
                </div>
            </div>
            ${isCompactView ? `
                <!-- Compact progression view -->
                <div id="fs-quickadd-compact-container"></div>
            ` : `
                <!-- Section picker bar (visible in section view mode when sections exist) -->
                <div id="fs-qa-section-picker" class="${this._quickAddViewMode === 'section' && hasSections ? '' : 'hidden'}"></div>
                <!-- Chord Progression Cards -->
                <div id="fs-quick-add-cards-container" class="flex flex-nowrap items-start gap-1 px-4 py-2" style="height: calc(100% - ${this._quickAddViewMode === 'section' && hasSections ? '130px' : '97px'}); overflow-x: auto; overflow-y: hidden;">
                </div>
                <style>
                    /* Scrollbar styling - forest green theme */
                    #fs-quick-add-cards-container::-webkit-scrollbar { height: 10px; }
                    #fs-quick-add-cards-container::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 5px; margin: 0 8px; }
                    #fs-quick-add-cards-container::-webkit-scrollbar-thumb { background: linear-gradient(to right, #4d7c0f, #3f6212); border-radius: 5px; border: 1px solid #365314; }
                    #fs-quick-add-cards-container::-webkit-scrollbar-thumb:hover { background: linear-gradient(to right, #3f6212, #365314); }
                    #fs-quick-add-cards-container { scrollbar-width: auto; scrollbar-color: #4d7c0f #e2e8f0; }

                    /* CRITICAL FIX: The selection outline is on .chord-card-wrapper, NOT the card itself.
                       The outline with outlineOffset causes it to extend outside the wrapper bounds.
                       Remove the outline from wrappers and use a contained border on the card instead. */
                    #fs-quick-add-cards-container .chord-card-wrapper {
                        outline: none !important;
                        outline-offset: 0 !important;
                    }

                    /* Add selection indicator as a border on the card itself (stays contained) */
                    #fs-quick-add-cards-container .simplified-card[data-selected="true"],
                    #fs-quick-add-cards-container .detailed-card[data-selected="true"] {
                        border: 3px solid #a855f7 !important;
                        box-sizing: border-box !important;
                    }
                </style>
            `}
        `;

        // Populate dropdowns
        this._populateScaleDropdown(container);
        this._populateChordTypeDropdown(container);

        // Attach view mode handlers
        container.querySelectorAll('.fs-qa-view-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._quickAddViewMode = btn.dataset.mode;
                this._renderQuickAddPanel(container);
            });
        });

        // Attach Legend button handler
        container.querySelector('#fs-quickadd-legend-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.toggleChordFunctionLegend === 'function') {
                window.toggleChordFunctionLegend();
            } else if (typeof window.showChordFunctionLegend === 'function') {
                window.showChordFunctionLegend();
            }
        });

        // Attach Summary/Details toggle handler (checkbox: unchecked = Summary, checked = Details)
        container.querySelector('#fs-quickadd-compact-toggle')?.addEventListener('change', (e) => {
            this._quickAddCompactView = !e.target.checked; // checked = Details (not compact), unchecked = Summary (compact)
            this._renderQuickAddPanel(container);
        });

        // Handle compact view rendering
        if (isCompactView) {
            const compactContainer = container.querySelector('#fs-quickadd-compact-container');
            if (compactContainer) {
                // Render the compact progression view
                compactContainer.innerHTML = this._renderCompactProgressionView('fs-quickadd-compact', {
                    selectedSectionIds: this._quickAddCompactSectionIds,
                    selectedChordIndex: selectedIndex,
                    accentColor: '#4d7c0f',
                    showGhostCard: true
                });

                // Attach compact view handlers
                this._attachCompactProgressionHandlers(compactContainer, 'fs-quickadd-compact', {
                    onSectionChange: () => {
                        this._renderQuickAddPanel(container);
                    },
                    onChordClick: (idx) => {
                        if (window.setSelectedChordIndex) {
                            window.setSelectedChordIndex(idx);
                        }
                        this._renderQuickAddPanel(container);
                    },
                    onChordHold: (idx, chord) => {
                        // Play chord on hold
                        if (chord.notes && chord.notes.length > 0 && window.getPiano) {
                            const piano = window.getPiano();
                            if (piano) {
                                piano.triggerAttack(chord.notes);
                            }
                        }
                    },
                    onChordRelease: () => {
                        // Stop playing
                        if (window.getPiano) {
                            const piano = window.getPiano();
                            if (piano) {
                                piano.releaseAll();
                            }
                        }
                    },
                    onGhostCardClick: (suggestion) => {
                        this._addSuggestedChord(suggestion, key);
                    }
                }, this._quickAddCompactSectionIds);
            }
            // Don't return - still need to set up dropdown handlers etc.
        }

        // Render section picker if in section view (only when not compact)
        if (!isCompactView && this._quickAddViewMode === 'section' && hasSections) {
            this._renderQuickAddSectionPicker(container.querySelector('#fs-qa-section-picker'), sections);
        }

        // Render chord cards (only when not compact)
        const cardsContainer = container.querySelector('#fs-quick-add-cards-container');
        if (!isCompactView && cardsContainer && chords.length > 0) {
            if (this._quickAddViewMode === 'section' && hasSections) {
                this._renderQuickAddSectionViewCards(cardsContainer, chords, key, sections, selectedIndex);
            } else {
                this._renderQuickAddScrollViewCards(cardsContainer, chords, key, sections, selectedIndex);
            }
        } else if (!isCompactView && cardsContainer) {
            cardsContainer.innerHTML = '<div class="text-gray-400 text-sm p-4">No chords yet. Add your first chord above!</div>';
        }

        // Render ambient tension strip (respects Experience Mode internally) - only in card view
        if (!isCompactView) {
            renderAmbientTensionStrip(container, chords, key);
        }

        // Render bass motion indicators between chord cards (respects Experience Mode - Explore only) - only in card view
        if (!isCompactView && cardsContainer) {
            renderBassMotionIndicators(cardsContainer, chords, key);
        }

        // Root change handler
        container.querySelector('#fs-quick-root')?.addEventListener('change', () => {
            this._populateChordTypeDropdown(container);
        });

        // Scale change handler
        container.querySelector('#fs-quick-scale')?.addEventListener('change', () => {
            this._populateChordTypeDropdown(container);
        });

        // Add button handler - insert after selected or at end
        // NOTE: Don't pass sectionInfo here - it gets re-computed at click time in the handler
        container.querySelector('#fs-quick-add-btn')?.addEventListener('click', () => {
            this._handleQuickAddChord(container);
        });

        // N.C. button handler
        container.querySelector('#fs-quick-nc-btn')?.addEventListener('click', () => {
            this._handleQuickAddNC(container);
        });

        // Close button handler
        container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
            this.closeActivePanel();
        });

        // Listen for chord selection changes to update insert indicator
        // Remove any previous listener first
        if (this._quickAddSelectionHandler) {
            window.removeEventListener('chordCardSelected', this._quickAddSelectionHandler);
        }
        this._quickAddSelectionHandler = () => {
            this._updateQuickAddInsertIndicator(container, chords, key);
        };
        window.addEventListener('chordCardSelected', this._quickAddSelectionHandler);
    }

    /**
     * Update just the insert indicator text when selection changes
     */
    _updateQuickAddInsertIndicator(container, chords, key) {
        const indicator = container.querySelector('#fs-quick-insert-indicator');
        if (!indicator) return;

        const selectedIndex = window.getSelectedChordIndex?.() ?? -1;
        let insertIndicatorText = 'Insert at end';

        if (selectedIndex >= 0 && selectedIndex < chords.length) {
            const chord = chords[selectedIndex];
            const typeSymbol = CHORD_DEFINITIONS[chord.type]?.symbol || '';
            const displayRoot = this._spellNoteInKey(chord.root || 'C', key);
            const chordName = chord.simpleName || (displayRoot + typeSymbol);

            const compState = getCompositionState();
            const sectionInfo = compState?.getSectionForChord?.(selectedIndex);

            insertIndicatorText = `Insert after ${chordName} at position ${selectedIndex + 1}`;
            if (sectionInfo) {
                insertIndicatorText += ` (in ${sectionInfo.label})`;
            }
        }

        indicator.textContent = insertIndicatorText;
    }

    /**
     * Handle adding a chord in quick-add mode
     */
    _handleQuickAddChord(container) {
        const root = parseInt(container.querySelector('#fs-quick-root').value);
        const type = container.querySelector('#fs-quick-type').value;
        const inversion = parseInt(container.querySelector('#fs-quick-inversion').value);
        const rootName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][root];

        // Use main app's selected chord index
        const insertAfterIdx = window.getSelectedChordIndex?.() ?? -1;

        const compState = getCompositionState();
        if (!compState) return;

        // === DEBUG LOGGING START ===
        console.log('=== QUICK ADD CHORD DEBUG ===');
        console.log('1. Selected chord index (insertAfterIdx):', insertAfterIdx);
        console.log('2. Total chords BEFORE insert:', compState.getChords?.()?.length);

        // Log all sections BEFORE insert
        const sectionsBefore = compState.getSections?.() || [];
        console.log('3. Sections BEFORE insert:', JSON.stringify(sectionsBefore.map(s => ({
            id: s.id,
            name: s.name,
            startIndex: s.startIndex,
            chordCount: s.chordCount,
            coversChords: `[${s.startIndex} to ${s.startIndex + s.chordCount - 1}]`
        })), null, 2));

        // Get section info for the selected chord (before insertion)
        let sectionInfo = null;
        if (insertAfterIdx >= 0) {
            sectionInfo = compState.getSectionForChord?.(insertAfterIdx);
        }
        console.log('4. Section info for selected chord:', sectionInfo ? JSON.stringify({
            id: sectionInfo.id,
            name: sectionInfo.name,
            startIndex: sectionInfo.startIndex,
            chordCount: sectionInfo.chordCount
        }) : 'null (no section)');

        // Build chord data using the app's helper
        // Get key from trainerState (the single source of truth for current key)
        const key = getCurrentKey() || 'C';
        let chordData = null;
        if (window.getInvertedChordNotes) {
            const result = window.getInvertedChordNotes(
                rootName,
                type,
                inversion,
                key,
                0,  // octaveShift
                window.getKeyBasedEnharmonic?.() || 'sharp',
                window.getNotationPreference?.() || 'full'
            );
            const roman = window.noteToRomanNumeral?.(rootName, key, type) || '';

            // Get default beats based on time signature
            const ts = compState.metadata?.timeSignature || { num: 4, denom: 4 };
            const defaultBeats = ts.num * (4 / ts.denom);

            chordData = {
                name: result?.name || `${rootName} ${type}`,
                simpleName: result?.simpleName || rootName,
                notes: result?.specificNotes || [],
                root: rootName,
                type: type,
                inversion: inversion || 0,
                selectionMode: 'chord',
                omittedNotes: [],
                octaveShift: 0,
                lhType: 'off',
                lhInversion: 0,
                lhOctaveShift: 0,
                lhNotes: [],
                lhOmittedNotes: [],
                roman: roman,
                beats: defaultBeats
            };
        }

        if (!chordData) return;

        // Calculate insert position: after selected chord, or at end
        const insertAtIndex = insertAfterIdx >= 0 ? insertAfterIdx + 1 : compState.getChords?.()?.length || 0;
        console.log('5. Will insert at index:', insertAtIndex);

        // Use compositionState.insertChord which handles bass blocks and basic section shifting
        const success = compState.insertChord(insertAtIndex, chordData);
        console.log('6. insertChord success:', success);

        // Log sections AFTER insertChord (which calls updateSectionsAfterChordInsert internally)
        const sectionsAfterInsert = compState.getSections?.() || [];
        console.log('7. Sections AFTER insertChord (before our manual fix):', JSON.stringify(sectionsAfterInsert.map(s => ({
            id: s.id,
            name: s.name,
            startIndex: s.startIndex,
            chordCount: s.chordCount,
            coversChords: `[${s.startIndex} to ${s.startIndex + s.chordCount - 1}]`
        })), null, 2));

        if (success) {
            // ALWAYS expand the section by 1 when the selected chord was in a section
            // This ensures the new chord stays in the same section as the selected chord.
            // We check if the new chord index falls within the section's range AFTER the insert.
            // If not, we expand the section to include it.
            if (sectionInfo && sectionInfo.id) {
                console.log('8. Checking if we need manual section expansion...');
                console.log('   Looking for section with id:', sectionInfo.id);

                const sections = compState.getSections?.() || [];
                const section = sections.find(s => s.id === sectionInfo.id);
                console.log('   Found section:', section ? JSON.stringify({
                    id: section.id,
                    name: section.name,
                    startIndex: section.startIndex,
                    chordCount: section.chordCount
                }) : 'NOT FOUND');

                if (section) {
                    // After insertChord, check if the new chord is actually in the section
                    const sectionStart = section.startIndex;
                    const sectionEnd = section.startIndex + section.chordCount - 1;
                    console.log('   Section range: [', sectionStart, 'to', sectionEnd, ']');
                    console.log('   insertAtIndex:', insertAtIndex);
                    console.log('   Is insertAtIndex in range?', insertAtIndex >= sectionStart && insertAtIndex <= sectionEnd);

                    // If the inserted chord index is outside the section range, expand to include it
                    if (insertAtIndex < sectionStart || insertAtIndex > sectionEnd) {
                        console.log('   --> EXPANDING section by 1 (chord was outside range)');
                        // The new chord should be right after the selected chord, so expand to include it
                        section.chordCount++;
                    } else {
                        console.log('   --> No expansion needed (chord already in range)');
                    }
                }
            } else {
                console.log('8. No section info or no section id - skipping manual expansion');
            }

            // Log final sections state
            const sectionsFinal = compState.getSections?.() || [];
            console.log('9. FINAL Sections state:', JSON.stringify(sectionsFinal.map(s => ({
                id: s.id,
                name: s.name,
                startIndex: s.startIndex,
                chordCount: s.chordCount,
                coversChords: `[${s.startIndex} to ${s.startIndex + s.chordCount - 1}]`
            })), null, 2));
            console.log('10. Total chords AFTER insert:', compState.getChords?.()?.length);
            console.log('=== END QUICK ADD CHORD DEBUG ===\n');

            // Sync state first (no visual update yet)
            if (window.syncProgressionToMelodyComposer) {
                window.syncProgressionToMelodyComposer();
            }

            // Batch all visual updates in a single animation frame to reduce jank
            requestAnimationFrame(() => {
                // Render notation
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                }

                // Update chord cards display
                if (window.renderProgressionDisplay) {
                    window.renderProgressionDisplay('melody-progression-visualization', true);
                }

                // Select the newly inserted chord
                if (window.selectChordCard) {
                    window.selectChordCard(insertAtIndex);
                }

                // Refresh the quick add panel
                const panelContent = this.container?.querySelector('#fs-dock-panel-content');
                if (panelContent) {
                    this._renderQuickAddPanel(panelContent);
                }
            });

            // Play shutter sound (can happen immediately, doesn't affect visuals)
            if (window.getAudioIsReady?.() && window.getCameraShutter) {
                const shutter = window.getCameraShutter();
                if (shutter?.loaded) {
                    shutter.start();
                }
            }

            // Dispatch progressionChordAdded event for tutorial system
            // This is the same event dispatched by addChordToProgressionByParams in ProgressionController.js
            window.dispatchEvent(new CustomEvent('progressionChordAdded', {
                detail: {
                    chord: `${rootName} ${type}`,
                    root: rootName,
                    type: type,
                    inversion: inversion,
                    position: insertAtIndex,
                    key: key
                }
            }));
        } else {
            // Even if insert failed, refresh panel to show current state
            const panelContent = this.container?.querySelector('#fs-dock-panel-content');
            if (panelContent) {
                this._renderQuickAddPanel(panelContent);
            }
        }
    }

    /**
     * Handle adding N.C. in quick-add mode
     */
    _handleQuickAddNC(container) {
        // Use main app's selected chord index
        const insertAfterIdx = window.getSelectedChordIndex?.() ?? -1;

        const compState = getCompositionState();
        if (!compState) return;

        // Get section info for the selected chord (before insertion)
        let sectionInfo = null;
        if (insertAfterIdx >= 0) {
            sectionInfo = compState.getSectionForChord?.(insertAfterIdx);
        }

        // Get default beats based on time signature
        const ts = compState.metadata?.timeSignature || { num: 4, denom: 4 };
        const defaultBeats = ts.num * (4 / ts.denom);

        // Create N.C. chord data
        const ncChordData = {
            name: 'N.C.',
            simpleName: 'N.C.',
            notes: [],
            root: null,
            type: 'N.C.',
            inversion: 0,
            selectionMode: 'chord',
            omittedNotes: [],
            octaveShift: 0,
            lhType: 'off',
            lhInversion: 0,
            lhOctaveShift: 0,
            lhNotes: [],
            lhOmittedNotes: [],
            roman: '',
            beats: defaultBeats,
            isNoChord: true
        };

        // Calculate insert position: after selected chord, or at end
        const insertAtIndex = insertAfterIdx >= 0 ? insertAfterIdx + 1 : compState.getChords?.()?.length || 0;

        // Use compositionState.insertChord which properly handles section index shifting
        const success = compState.insertChord(insertAtIndex, ncChordData);

        if (success) {
            // If the selected chord was in a section, expand that section to include the new chord
            if (sectionInfo && sectionInfo.id) {
                compState.addChordToSection(insertAtIndex, sectionInfo.id);
            }

            // Sync state first (no visual update yet)
            if (window.syncProgressionToMelodyComposer) {
                window.syncProgressionToMelodyComposer();
            }

            // Batch all visual updates in a single animation frame to reduce jank
            requestAnimationFrame(() => {
                // Render notation
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                }

                // Update chord cards display
                if (window.renderProgressionDisplay) {
                    window.renderProgressionDisplay('melody-progression-visualization', true);
                }

                // Select the newly inserted chord
                if (window.selectChordCard) {
                    window.selectChordCard(insertAtIndex);
                }

                // Refresh the quick add panel
                const panelContent = this.container?.querySelector('#fs-dock-panel-content');
                if (panelContent) {
                    this._renderQuickAddPanel(panelContent);
                }
            });
        } else {
            // Even if insert failed, refresh panel to show current state
            const panelContent = this.container?.querySelector('#fs-dock-panel-content');
            if (panelContent) {
                this._renderQuickAddPanel(panelContent);
            }
        }
    }

    /**
     * Render section picker for quick-add panel
     */
    _renderQuickAddSectionPicker(container, sections) {
        if (!container) return;

        container.innerHTML = `
            <div class="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b border-gray-200" style="overflow: visible;">
                <!-- All button -->
                <button class="fs-qa-section-all-btn px-2.5 py-1 text-[10px] font-semibold rounded-full transition-all flex-shrink-0 cursor-pointer
                               ${this._quickAddSelectedSectionIds.size === 0 ? 'bg-lime-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}">
                    All
                </button>
                <!-- Section chips -->
                <div class="fs-qa-section-chips flex items-center gap-1.5 flex-wrap"></div>
            </div>
        `;

        // Populate section chips
        const chipsContainer = container.querySelector('.fs-qa-section-chips');
        sections.forEach(section => {
            const isSelected = this._quickAddSelectedSectionIds.has(section.id);
            const chip = document.createElement('button');
            chip.className = `flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 cursor-pointer transition-all`;
            chip.style.background = isSelected ? section.color : this._hexToRgba(section.color, 0.15);
            chip.style.border = `1px solid ${section.color}`;
            chip.style.color = isSelected ? 'white' : section.color;
            if (isSelected) {
                chip.style.webkitTextFillColor = 'white';
            }
            chip.innerHTML = `
                <span class="w-2 h-2 rounded-full" style="background: ${isSelected ? 'white' : section.color};"></span>
                ${section.label} (${section.chordIndices?.length || 0})
            `;
            chip.dataset.sectionId = section.id;

            // Click handler
            chip.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    // Toggle this section
                    if (this._quickAddSelectedSectionIds.has(section.id)) {
                        this._quickAddSelectedSectionIds.delete(section.id);
                    } else {
                        this._quickAddSelectedSectionIds.add(section.id);
                    }
                } else {
                    // Single select
                    if (this._quickAddSelectedSectionIds.has(section.id) && this._quickAddSelectedSectionIds.size === 1) {
                        this._quickAddSelectedSectionIds.clear();
                    } else {
                        this._quickAddSelectedSectionIds.clear();
                        this._quickAddSelectedSectionIds.add(section.id);
                    }
                }
                this._renderQuickAddPanel(this.container.querySelector('#fs-dock-panel-content'));
            });

            chipsContainer.appendChild(chip);
        });

        // All button handler
        container.querySelector('.fs-qa-section-all-btn')?.addEventListener('click', () => {
            this._quickAddSelectedSectionIds.clear();
            this._renderQuickAddPanel(this.container.querySelector('#fs-dock-panel-content'));
        });
    }

    /**
     * Render cards in scroll view for quick-add panel
     */
    _renderQuickAddScrollViewCards(container, chords, key, sections, selectedIndex) {
        container.innerHTML = '';

        const compState = getCompositionState();
        const sectionView = compState?.buildSectionView?.() || [];

        if (sectionView.length > 0) {
            // Render with section containers
            sectionView.forEach(section => {
                const sectionContainer = this._createQuickAddSectionContainer(section, chords, key, selectedIndex);
                if (sectionContainer) {
                    container.appendChild(sectionContainer);
                }
            });
        } else {
            // Flat cards
            chords.forEach((chord, index) => {
                const wrapper = this._createQuickAddChordCard(chord, index, key, selectedIndex);
                container.appendChild(wrapper);
            });
        }

        // Add ghost card for pattern continuation suggestion
        const ghostCard = this._createFSPatternGhostCard(chords, key);
        if (ghostCard) {
            container.appendChild(ghostCard);
        }
    }

    /**
     * Render cards in section view for quick-add panel
     * Filters to only show selected sections (or all if none selected)
     */
    _renderQuickAddSectionViewCards(container, chords, key, sections, selectedIndex) {
        container.innerHTML = '';

        const compState = getCompositionState();
        const sectionView = compState?.buildSectionView?.() || [];

        // If no sections selected, show all
        const selectedIds = this._quickAddSelectedSectionIds.size > 0
            ? this._quickAddSelectedSectionIds
            : new Set(sectionView.map(s => s.id));

        // Filter to only selected sections
        const filteredSections = sectionView.filter(s => selectedIds.has(s.id));

        if (filteredSections.length > 0) {
            // Render with section containers (only selected ones)
            filteredSections.forEach(section => {
                const sectionContainer = this._createQuickAddSectionContainer(section, chords, key, selectedIndex);
                if (sectionContainer) {
                    container.appendChild(sectionContainer);
                }
            });

            // Add ghost card for pattern continuation suggestion (only if showing all sections)
            if (this._quickAddSelectedSectionIds.size === 0) {
                const ghostCard = this._createFSPatternGhostCard(chords, key);
                if (ghostCard) {
                    container.appendChild(ghostCard);
                }
            }
        } else {
            // No matching sections - show empty message
            container.innerHTML = '<div class="text-gray-400 text-sm p-4">No sections selected</div>';
        }
    }

    /**
     * Create section container for quick-add panel
     */
    _createQuickAddSectionContainer(section, progressionData, key, selectedIndex) {
        const container = document.createElement('div');
        container.className = 'inline-flex flex-col rounded-lg overflow-visible flex-shrink-0';
        container.style.marginRight = '8px';

        // Section banner
        const banner = document.createElement('div');
        banner.className = 'flex items-center gap-2 px-2 py-1 rounded-t-lg';
        banner.style.backgroundColor = section.color;
        banner.innerHTML = `<span class="text-white text-xs font-semibold" style="-webkit-text-fill-color: white;">${section.label}</span>`;
        container.appendChild(banner);

        // Cards area
        const cardsArea = document.createElement('div');
        cardsArea.className = 'flex items-start gap-1 p-2 rounded-b-lg';
        cardsArea.style.backgroundColor = section.color + '20';
        cardsArea.style.borderLeft = `2px solid ${section.color}`;
        cardsArea.style.borderRight = `2px solid ${section.color}`;
        cardsArea.style.borderBottom = `2px solid ${section.color}`;

        if (section.chordIndices && section.chordIndices.length > 0) {
            section.chordIndices.forEach(chordIdx => {
                if (chordIdx < progressionData.length) {
                    const chord = progressionData[chordIdx];
                    const wrapper = this._createQuickAddChordCard(chord, chordIdx, key, selectedIndex);
                    cardsArea.appendChild(wrapper);
                }
            });
        }

        container.appendChild(cardsArea);
        return container;
    }

    /**
     * Create chord card for quick-add panel
     * Uses main app's selection (purple/blue ring) - no separate Quick Add selection needed
     */
    _createQuickAddChordCard(chord, index, key, selectedIndex) {
        const wrapper = this._createFSChordCardWrapper(chord, index, key);
        // No custom selection styling or click handlers needed
        // Main app's selectChordCard() handles the purple/blue ring selection
        // and window.getSelectedChordIndex() gives us the selected index for insert
        return wrapper;
    }

    _populateScaleDropdown(container) {
        const scaleSelect = container.querySelector('#fs-quick-scale');
        if (!scaleSelect) return;

        // Group scales by category - EXACTLY like quickAddChord.js (lines 74-103)
        const scalesByCategory = {};
        Object.entries(SCALE_DEFINITIONS).forEach(([scaleName, scaleDef]) => {
            const category = scaleDef?.category || 'basic';
            if (!scalesByCategory[category]) {
                scalesByCategory[category] = [];
            }
            scalesByCategory[category].push(scaleName);
        });

        // Add scales organized by category with proper styling
        Object.entries(SCALE_CATEGORIES).forEach(([categoryKey, categoryInfo]) => {
            const scales = scalesByCategory[categoryKey] || [];
            if (scales.length === 0) return;

            const optgroup = document.createElement('optgroup');
            optgroup.label = `${categoryInfo.icon} ${categoryInfo.name}`;
            optgroup.style.color = '#1f2937';
            optgroup.style.fontWeight = 'bold';
            optgroup.style.background = '#f3f4f6';

            scales.forEach(scaleName => {
                const option = document.createElement('option');
                option.value = scaleName;
                option.textContent = scaleName;
                option.style.color = '#374151';
                option.style.background = 'white';
                optgroup.appendChild(option);
            });

            scaleSelect.appendChild(optgroup);
        });
    }

    _populateChordTypeDropdown(container) {
        const rootSelect = container.querySelector('#fs-quick-root');
        const typeSelect = container.querySelector('#fs-quick-type');
        const scaleSelect = container.querySelector('#fs-quick-scale');

        if (!rootSelect || !typeSelect) return;

        const rootIndex = parseInt(rootSelect.value, 10);
        const rootNoteName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][rootIndex];
        const selectedScale = scaleSelect?.value || '';

        // Store current selection
        const currentType = typeSelect.value;

        // Clear existing options
        typeSelect.innerHTML = '';

        // All chord types grouped - EXACTLY like quickAddChord.js (lines 21-28)
        const ALL_CHORD_TYPES = {
            'TRIADS': ['Major', 'Minor', 'Augmented', 'Diminished', 'Sus2', 'Sus4', 'Power Chord'],
            'SEVENTHS': ['Dominant 7th', 'Major 7th', 'Minor 7th', 'Half-Diminished 7th', 'Diminished 7th', 'Minor-Major 7th'],
            'NINTHS': ['Major 9th', 'Dominant 9th', 'Minor 9th', '6/9', 'Add9'],
            'EXTENDED': ['Dominant 11th', 'Minor 11th', 'Dominant 13th', 'Major 6th', 'Minor 6th'],
            'ALTERED': ['Augmented 7th', '7b5', '7#5', '7b9', '7#9'],
            'INTERVALS': ['Major 2nd', 'Minor 2nd', 'Major 3rd', 'Minor 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Major 6th', 'Minor 6th', 'Major 7th', 'Minor 7th', 'Octave']
        };

        // Build options with filtering - EXACTLY like quickAddChord.js (lines 130-171)
        Object.entries(ALL_CHORD_TYPES).forEach(([groupName, chordTypes]) => {
            // Skip intervals for scale filtering (they don't have meaningful scale relationships)
            const isIntervalGroup = groupName === 'INTERVALS';

            // Filter chord types if scale is selected
            const filteredTypes = selectedScale && !isIntervalGroup
                ? chordTypes.filter(chordType =>
                    CHORD_DEFINITIONS[chordType] && isChordInScale(chordType, rootNoteName, selectedScale, rootNoteName)
                )
                : chordTypes;

            // Skip empty groups when filtering
            if (selectedScale && filteredTypes.length === 0 && !isIntervalGroup) return;

            // Create optgroup with styling EXACTLY like Composition Studio
            const optgroup = document.createElement('optgroup');
            const displayName = isIntervalGroup ? 'INTERVALS' : groupName;
            const count = selectedScale && !isIntervalGroup ? ` (${filteredTypes.length})` : '';
            optgroup.label = `─── ${displayName}${count} ───`;
            optgroup.style.color = '#1f2937';
            optgroup.style.fontWeight = 'bold';
            optgroup.style.background = '#f3f4f6';

            // Add interval types without filtering, chord types with filtering
            const typesToShow = isIntervalGroup ? chordTypes : filteredTypes;

            typesToShow.forEach(chordType => {
                const option = document.createElement('option');
                option.value = chordType;
                // Add (interval) suffix for interval display names that conflict with chords
                if (isIntervalGroup && (chordType === 'Major 6th' || chordType === 'Minor 6th' || chordType === 'Major 7th' || chordType === 'Minor 7th')) {
                    option.textContent = `${chordType} (interval)`;
                } else {
                    option.textContent = chordType;
                }
                option.style.color = '#374151';
                option.style.background = 'white';
                optgroup.appendChild(option);
            });

            typeSelect.appendChild(optgroup);
        });

        // Try to restore previous selection
        const allOptions = Array.from(typeSelect.options);
        const matchingOption = allOptions.find(opt => opt.value === currentType);
        if (matchingOption) {
            typeSelect.value = currentType;
        } else if (allOptions.length > 0) {
            typeSelect.value = allOptions[0].value;
        }
    }

    _renderAutoBassPanel(container) {
        const compState = getCompositionState();
        const settings = compState?.getSettings?.() || {};
        const bassPattern = settings.bassPattern || 'root-fifth';
        const bassOctave = settings.bassOctave || 'auto';
        // Get key from trainerState (the single source of truth for current key)
        const key = getCurrentKey() || 'C';

        // Get chord progression data
        let chords = [];
        if (typeof compState?.getChords === 'function') {
            chords = compState.getChords() || [];
        }
        if (chords.length === 0) {
            const progressionData = compState?.exportToProgressionData?.();
            chords = Array.isArray(progressionData) ? progressionData : [];
        }

        // Get sections for section view
        const sections = compState?.buildSectionView?.() || compState?.getSections?.() || [];
        const hasSections = sections.length > 0;

        // Get selected chord index
        const selectedIndex = window.getSelectedChordIndex?.() ?? -1;

        // Initialize view mode for auto-bass if not set
        if (!this._autoBassViewMode) {
            this._autoBassViewMode = 'scroll';
        }

        // Determine if compact view is active
        const isCompactView = this._autoBassCompactView;

        // Helper to check if pattern is selected
        const sel = (val) => bassPattern === val ? 'selected' : '';

        container.innerHTML = `
            <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-amber-700 to-amber-600 border-b border-amber-800">
                <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Auto-Bass Patterns</span>
                <div class="flex items-center gap-2">
                    <!-- Progression Summary/Details Slider Toggle (first/leftmost) -->
                    <div class="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full" title="Toggle between progression summary and detailed card view">
                        <span class="text-[8px] font-medium ${isCompactView ? 'text-white' : 'text-white/50'}" style="-webkit-text-fill-color: ${isCompactView ? 'white' : 'rgba(255,255,255,0.5)'};">Progression Summary</span>
                        <label class="relative inline-flex items-center cursor-pointer mx-0.5">
                            <input type="checkbox" id="fs-autobass-compact-toggle" class="sr-only peer" ${isCompactView ? '' : 'checked'}>
                            <div class="w-7 h-4 bg-amber-300 peer-focus:outline-none rounded-full peer
                                        peer-checked:after:translate-x-full peer-checked:after:border-white
                                        after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                                        after:bg-white after:border-gray-300 after:border after:rounded-full
                                        after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-600"></div>
                        </label>
                        <span class="text-[8px] font-medium ${isCompactView ? 'text-white/50' : 'text-white'}" style="-webkit-text-fill-color: ${isCompactView ? 'rgba(255,255,255,0.5)' : 'white'};">Progression Details</span>
                    </div>
                    <!-- Legend button (hidden in compact view) -->
                    <button id="fs-autobass-legend-btn" class="${isCompactView ? 'hidden' : ''} px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-medium rounded transition flex items-center gap-1" title="View chord function color legend">
                        <span class="text-[8px]" style="-webkit-text-fill-color: #86efac;">●</span>
                        <span class="text-[8px]" style="-webkit-text-fill-color: #7dd3fc;">●</span>
                        <span class="text-[8px]" style="-webkit-text-fill-color: #fcd34d;">●</span>
                        <span>Legend</span>
                    </button>
                    <!-- View mode toggle (hidden in compact view) -->
                    <div class="${isCompactView ? 'hidden' : 'flex'} gap-0.5 bg-white/20 rounded-lg p-0.5">
                        <button class="fs-ab-view-mode-btn px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${this._autoBassViewMode === 'scroll' ? 'bg-white shadow' : 'text-white/80 hover:text-white'}"
                                data-mode="scroll" style="${this._autoBassViewMode === 'scroll' ? 'color: #92400e; -webkit-text-fill-color: #92400e;' : ''}">
                            Scroll
                        </button>
                        <button class="fs-ab-view-mode-btn px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${this._autoBassViewMode === 'section' ? 'bg-white shadow' : 'text-white/80 hover:text-white'}"
                                data-mode="section" style="${this._autoBassViewMode === 'section' ? 'color: #92400e; -webkit-text-fill-color: #92400e;' : ''}">
                            Section
                        </button>
                    </div>
                    <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>
            <!-- Controls Row -->
            <div class="px-3 py-2 bg-gray-50 border-b border-gray-200">
                <div class="flex flex-wrap items-center gap-3">
                    <div class="flex items-center gap-2">
                        <label class="text-xs font-medium text-gray-700">Pattern:</label>
                        <select id="fs-bass-pattern" class="p-1.5 text-xs border border-gray-300 rounded-lg min-w-[150px]">
                            <optgroup label="Simple">
                                <option value="whole-note" ${sel('whole-note')}>Whole Note</option>
                                <option value="root-fifth" ${sel('root-fifth')}>Root-Fifth</option>
                                <option value="half-time" ${sel('half-time')}>Half Time</option>
                                <option value="pedal" ${sel('pedal')}>Pedal</option>
                            </optgroup>
                            <optgroup label="Arpeggiated">
                                <option value="arpeggio" ${sel('arpeggio')}>Arpeggio (Quarter)</option>
                                <option value="arpeggio-8th" ${sel('arpeggio-8th')}>Arpeggio (8th)</option>
                                <option value="tremolo" ${sel('tremolo')}>Tremolo (16th)</option>
                                <option value="alberti" ${sel('alberti')}>Alberti</option>
                                <option value="broken-octave" ${sel('broken-octave')}>Broken Oct</option>
                                <option value="arpeggio-stride" ${sel('arpeggio-stride')}>Arp Stride</option>
                            </optgroup>
                            <optgroup label="Walking">
                                <option value="walking" ${sel('walking')}>Walking</option>
                                <option value="chromatic-approach" ${sel('chromatic-approach')}>Chromatic</option>
                                <option value="scalar-walk" ${sel('scalar-walk')}>Scalar</option>
                                <option value="bebop" ${sel('bebop')}>Bebop</option>
                                <option value="gospel-run" ${sel('gospel-run')}>Gospel Run</option>
                                <option value="descant" ${sel('descant')}>Descant</option>
                            </optgroup>
                            <optgroup label="Rhythmic">
                                <option value="dotted-rhythm" ${sel('dotted-rhythm')}>Dotted</option>
                                <option value="syncopated" ${sel('syncopated')}>Syncopated</option>
                                <option value="anticipation" ${sel('anticipation')}>Anticipation</option>
                                <option value="shuffle" ${sel('shuffle')}>Shuffle</option>
                                <option value="driving-rock" ${sel('driving-rock')}>Driving Rock</option>
                                <option value="boogie" ${sel('boogie')}>Boogie</option>
                                <option value="boogie-woogie" ${sel('boogie-woogie')}>Boogie-Woogie</option>
                                <option value="ragtime" ${sel('ragtime')}>Ragtime</option>
                            </optgroup>
                            <optgroup label="Rest/Space">
                                <option value="staccato" ${sel('staccato')}>Staccato</option>
                                <option value="call-response" ${sel('call-response')}>Call/Response</option>
                                <option value="ballad" ${sel('ballad')}>Ballad</option>
                            </optgroup>
                            <optgroup label="Style">
                                <option value="country" ${sel('country')}>Country</option>
                                <option value="bossa-nova" ${sel('bossa-nova')}>Bossa Nova</option>
                                <option value="disco-octave" ${sel('disco-octave')}>Disco</option>
                                <option value="motown" ${sel('motown')}>Motown</option>
                                <option value="tango" ${sel('tango')}>Tango</option>
                                <option value="montuno" ${sel('montuno')}>Montuno</option>
                                <option value="reggae" ${sel('reggae')}>Reggae</option>
                                <option value="funk" ${sel('funk')}>Funk</option>
                                <option value="lament" ${sel('lament')}>Lament</option>
                                <option value="habanera" ${sel('habanera')}>Habanera</option>
                                <option value="ostinato" ${sel('ostinato')}>Ostinato</option>
                            </optgroup>
                            <optgroup label="Polyphonic">
                                <option value="octave-doubling" ${sel('octave-doubling')}>Octave Dbl</option>
                                <option value="power-chord" ${sel('power-chord')}>Power Chord</option>
                                <option value="rock-power" ${sel('rock-power')}>Rock Power</option>
                                <option value="open-fifth" ${sel('open-fifth')}>Open 5th</option>
                                <option value="stride" ${sel('stride')}>Stride</option>
                                <option value="ballad-stride" ${sel('ballad-stride')}>Ballad Stride</option>
                                <option value="shell-voicing" ${sel('shell-voicing')}>Shell</option>
                                <option value="tenths" ${sel('tenths')}>Tenths</option>
                                <option value="gospel" ${sel('gospel')}>Gospel</option>
                                <option value="counterpoint" ${sel('counterpoint')}>Counterpoint</option>
                                <option value="hymn" ${sel('hymn')}>Hymn</option>
                                <option value="waltz" ${sel('waltz')}>Waltz</option>
                                <option value="romantic" ${sel('romantic')}>Romantic</option>
                                <option value="call-answer" ${sel('call-answer')}>Call/Answer</option>
                                <option value="comp" ${sel('comp')}>Comp</option>
                            </optgroup>
                        </select>
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="text-xs font-medium text-gray-700">Octave:</label>
                        <select id="fs-bass-octave" class="p-1.5 text-xs border border-gray-300 rounded-lg">
                            <option value="auto" ${bassOctave === 'auto' ? 'selected' : ''}>Auto</option>
                            <option value="2" ${bassOctave === 2 || bassOctave === '2' ? 'selected' : ''}>Oct 2</option>
                            <option value="3" ${bassOctave === 3 || bassOctave === '3' ? 'selected' : ''}>Oct 3</option>
                        </select>
                    </div>
                    <label class="flex items-center gap-1.5 cursor-pointer" title="When ON, bass plays the inversion note (3rd for 1st inv, 5th for 2nd inv)">
                        <input type="checkbox" id="fs-bass-follows-inv" class="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500">
                        <span class="text-xs font-medium text-gray-700">Follow Inv</span>
                    </label>
                    <button id="fs-bass-apply" class="px-3 py-1.5 bg-gradient-to-r from-amber-700 to-amber-600 text-white text-xs font-medium rounded-lg hover:from-amber-800 hover:to-amber-700 transition-all shadow">
                        Apply to All
                    </button>
                    <button id="fs-bass-apply-selected" class="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 text-white text-xs font-medium rounded-lg hover:from-amber-700 hover:to-amber-600 transition-all shadow" style="opacity: 0.5;" disabled title="Shift+click chord cards to multi-select, then apply pattern to selected chords only">
                        Apply to Selected
                    </button>
                    <button id="fs-bass-revert-selected" class="px-2 py-1.5 bg-gradient-to-r from-amber-300 to-amber-200 text-amber-800 text-xs font-medium rounded-lg hover:from-amber-400 hover:to-amber-300 transition-all shadow" style="opacity: 0.5;" disabled title="Revert selected chord(s) to their chord card voicings">
                        Revert Selected
                    </button>
                    <button id="fs-bass-revert" class="px-2 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-lg transition-all">
                        Revert All
                    </button>
                </div>
            </div>
            ${isCompactView ? `
                <!-- Compact progression view -->
                <div id="fs-autobass-compact-container"></div>
            ` : `
                <!-- Section picker bar (visible in section view mode when sections exist) -->
                <div id="fs-ab-section-picker" class="${this._autoBassViewMode === 'section' && hasSections ? '' : 'hidden'}"></div>
                <!-- Chord Progression Cards -->
                <div id="fs-auto-bass-cards-container" class="flex flex-nowrap items-start gap-1 px-4 py-2" style="height: calc(100% - ${this._autoBassViewMode === 'section' && hasSections ? '133px' : '100px'}); overflow-x: auto; overflow-y: hidden;">
                </div>
                <style>
                    /* Scrollbar styling - muted amber/bronze theme */
                    #fs-auto-bass-cards-container::-webkit-scrollbar { height: 10px; }
                    #fs-auto-bass-cards-container::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 5px; margin: 0 8px; }
                    #fs-auto-bass-cards-container::-webkit-scrollbar-thumb { background: linear-gradient(to right, #b45309, #92400e); border-radius: 5px; border: 1px solid #78350f; }
                    #fs-auto-bass-cards-container::-webkit-scrollbar-thumb:hover { background: linear-gradient(to right, #92400e, #78350f); }
                    #fs-auto-bass-cards-container { scrollbar-width: auto; scrollbar-color: #b45309 #e2e8f0; }

                    /* Selection styling - same as Quick Add */
                    #fs-auto-bass-cards-container .chord-card-wrapper {
                        outline: none !important;
                        outline-offset: 0 !important;
                    }
                    #fs-auto-bass-cards-container .simplified-card[data-selected="true"],
                    #fs-auto-bass-cards-container .detailed-card[data-selected="true"] {
                        border: 3px solid #a855f7 !important;
                        box-sizing: border-box !important;
                    }
                </style>
            `}
        `;

        // Attach view mode handlers
        container.querySelectorAll('.fs-ab-view-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._autoBassViewMode = btn.dataset.mode;
                this._renderAutoBassPanel(container);
            });
        });

        // Attach Legend button handler
        container.querySelector('#fs-autobass-legend-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.toggleChordFunctionLegend === 'function') {
                window.toggleChordFunctionLegend();
            } else if (typeof window.showChordFunctionLegend === 'function') {
                window.showChordFunctionLegend();
            }
        });

        // Attach Summary/Details toggle handler (checkbox: unchecked = Summary, checked = Details)
        container.querySelector('#fs-autobass-compact-toggle')?.addEventListener('change', (e) => {
            this._autoBassCompactView = !e.target.checked; // checked = Details (not compact), unchecked = Summary (compact)
            this._renderAutoBassPanel(container);
        });

        // Handle compact view rendering
        if (isCompactView) {
            const compactContainer = container.querySelector('#fs-autobass-compact-container');
            if (compactContainer) {
                // Render the compact progression view
                compactContainer.innerHTML = this._renderCompactProgressionView('fs-autobass-compact', {
                    selectedSectionIds: this._autoBassCompactSectionIds,
                    selectedChordIndex: selectedIndex,
                    accentColor: '#b45309',
                    showGhostCard: true
                });

                // Attach compact view handlers
                this._attachCompactProgressionHandlers(compactContainer, 'fs-autobass-compact', {
                    onSectionChange: () => {
                        this._renderAutoBassPanel(container);
                    },
                    onChordClick: (idx) => {
                        if (window.setSelectedChordIndex) {
                            window.setSelectedChordIndex(idx);
                        }
                        this._renderAutoBassPanel(container);
                        // Ensure Apply to Selected button state is updated after re-render
                        setTimeout(() => this._updateApplyToSelectedButton(), 100);
                    },
                    onChordHold: (idx, chord) => {
                        // Play chord on hold
                        if (chord.notes && chord.notes.length > 0 && window.getPiano) {
                            const piano = window.getPiano();
                            if (piano) {
                                piano.triggerAttack(chord.notes);
                            }
                        }
                    },
                    onChordRelease: () => {
                        // Stop playing
                        if (window.getPiano) {
                            const piano = window.getPiano();
                            if (piano) {
                                piano.releaseAll();
                            }
                        }
                    },
                    onGhostCardClick: (suggestion) => {
                        this._addSuggestedChord(suggestion, key);
                    }
                }, this._autoBassCompactSectionIds);
            }
            // Don't return - still need to set up control handlers
        }

        // Render section picker if in section view (only when not compact)
        if (!isCompactView && this._autoBassViewMode === 'section' && hasSections) {
            this._renderAutoBassSectionPicker(container.querySelector('#fs-ab-section-picker'), sections);
        }

        // Render chord cards (only when not compact)
        const cardsContainer = container.querySelector('#fs-auto-bass-cards-container');
        if (!isCompactView && cardsContainer && chords.length > 0) {
            if (this._autoBassViewMode === 'section' && hasSections) {
                this._renderAutoBassSectionViewCards(cardsContainer, chords, key, sections, selectedIndex);
            } else {
                this._renderAutoBassScrollViewCards(cardsContainer, chords, key, sections, selectedIndex);
            }
        } else if (!isCompactView && cardsContainer) {
            cardsContainer.innerHTML = '<div class="text-gray-400 text-sm p-4">No chords yet. Add chords to generate bass patterns.</div>';
        }

        // Render ambient tension strip (respects Experience Mode internally) - only in card view
        if (!isCompactView) {
            renderAmbientTensionStrip(container, chords, key);
        }

        // Render bass motion indicators between chord cards (respects Experience Mode - Explore only) - only in card view
        if (!isCompactView && cardsContainer) {
            renderBassMotionIndicators(cardsContainer, chords, key);
        }

        // Pattern change handler
        container.querySelector('#fs-bass-pattern')?.addEventListener('change', (e) => {
            if (window.handleBassPatternChange) window.handleBassPatternChange(e.target.value, e.target);
        });

        // Octave change handler
        container.querySelector('#fs-bass-octave')?.addEventListener('change', (e) => {
            if (window.handleBassOctaveChange) window.handleBassOctaveChange(e.target.value, e.target);
        });

        // Follow inversion toggle handler
        const followInvCheckbox = container.querySelector('#fs-bass-follows-inv');
        if (followInvCheckbox) {
            // Set initial state from main toggle if it exists
            const mainToggle = document.getElementById('bass-follows-inversion-toggle');
            if (mainToggle) followInvCheckbox.checked = mainToggle.checked;

            followInvCheckbox.addEventListener('change', (e) => {
                if (window.setBassFollowsInversion) window.setBassFollowsInversion(e.target.checked);
                // Sync with main toggle
                const mainToggle = document.getElementById('bass-follows-inversion-toggle');
                if (mainToggle) mainToggle.checked = e.target.checked;
                const cardToggle = document.getElementById('bass-follows-inversion-toggle-card');
                if (cardToggle) cardToggle.checked = e.target.checked;
                if (window.refreshNotationFromProgression) window.refreshNotationFromProgression();
            });
        }

        // Apply to All button
        container.querySelector('#fs-bass-apply')?.addEventListener('click', async () => {
            const confirmed = await showConfirmModal({
                title: 'Apply Bass Pattern to All',
                message: 'This will replace the bass line for all chords with the selected pattern. Continue?',
                confirmText: 'Apply to All',
                danger: false
            });
            if (!confirmed) return;

            if (window.applyBassPatternToAll) {
                await window.applyBassPatternToAll();
            } else if (window.regenerateAllBass) {
                window.regenerateAllBass();
            }
            // Refresh the panel to show updated cards
            this._renderAutoBassPanel(container);
        });

        // Apply to Selected button - applies to ALL selected chord cards
        container.querySelector('#fs-bass-apply-selected')?.addEventListener('click', async () => {
            // Get selected chord indices from multiple sources:
            // 1. Cards with data-selected="true" (card view)
            // 2. Global selection state (compact/summary view)
            const selectedChordIndices = [];

            // Method 1: Check for cards with data-selected attribute
            const selectedCards = document.querySelectorAll('.simplified-card[data-selected="true"], .detailed-card[data-selected="true"]');
            selectedCards.forEach(card => {
                const wrapper = card.closest('.chord-card-wrapper');
                const chordIndex = wrapper ? parseInt(wrapper.dataset.chordIndex, 10) : NaN;
                if (!isNaN(chordIndex) && !selectedChordIndices.includes(chordIndex)) {
                    selectedChordIndices.push(chordIndex);
                }
            });

            // Method 2: Fall back to global selection state (for compact view where cards don't exist)
            if (selectedChordIndices.length === 0) {
                // Check for multi-select array
                const globalIndices = window.getSelectedChordIndicesArray ? window.getSelectedChordIndicesArray() : [];
                if (globalIndices.length > 0) {
                    globalIndices.forEach(idx => {
                        if (!selectedChordIndices.includes(idx)) {
                            selectedChordIndices.push(idx);
                        }
                    });
                } else {
                    // Check for single selection
                    const singleIdx = window.getSelectedChordIndex ? window.getSelectedChordIndex() : -1;
                    if (singleIdx >= 0 && !selectedChordIndices.includes(singleIdx)) {
                        selectedChordIndices.push(singleIdx);
                    }
                }
            }

            if (selectedChordIndices.length === 0) return;

            const confirmed = await showConfirmModal({
                title: 'Apply Bass Pattern to Selected',
                message: `This will replace the bass line for ${selectedChordIndices.length} selected chord(s) with the current pattern. Continue?`,
                confirmText: 'Apply to Selected',
                danger: false
            });
            if (!confirmed) return;

            // Apply bass pattern to each selected chord using chord-index-aware function
            // This properly handles chords that span multiple measures
            const compState = getCompositionState();
            if (compState && typeof compState.regenerateAutoBassByChordIndex === 'function') {
                for (const chordIndex of selectedChordIndices) {
                    compState.regenerateAutoBassByChordIndex(chordIndex);
                }
            } else if (window.regenerateBassForMeasure) {
                // Fallback to measure-based regeneration if chord-aware function unavailable
                for (const index of selectedChordIndices) {
                    window.regenerateBassForMeasure(index);
                }
            }

            if (window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
            }
        });

        // Update Apply to Selected and Revert Selected button states based on current selection
        // Use timeout to ensure DOM is ready
        setTimeout(() => this._updateApplyToSelectedButton(), 300);

        // Revert Selected button - reverts selected chord(s) to their chord card voicings
        container.querySelector('#fs-bass-revert-selected')?.addEventListener('click', async () => {
            const confirmed = await showConfirmModal({
                title: 'Revert Selected Bass',
                message: 'This will revert the bass line for selected chord(s) to their original chord voicings. Continue?',
                confirmText: 'Revert Selected',
                danger: false
            });
            if (!confirmed) return;

            if (window.revertBassToChordVoicing) {
                window.revertBassToChordVoicing();
            }
            // Refresh the panel
            this._renderAutoBassPanel(container);
        });

        // Revert All button
        container.querySelector('#fs-bass-revert')?.addEventListener('click', async () => {
            const confirmed = await showConfirmModal({
                title: 'Revert All Bass',
                message: 'This will revert the bass line for ALL chords to their original chord voicings. Continue?',
                confirmText: 'Revert All',
                danger: true
            });
            if (!confirmed) return;

            if (window.revertAllBassToChordVoicing) {
                window.revertAllBassToChordVoicing();
            }
            // Refresh the panel
            this._renderAutoBassPanel(container);
        });

        // Close button handler
        container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
            this.closeActivePanel();
        });
    }

    /**
     * Render section picker for auto-bass panel
     */
    _renderAutoBassSectionPicker(container, sections) {
        if (!container) return;

        // Initialize selected sections if not set
        if (!this._autoBassSelectedSectionIds) {
            this._autoBassSelectedSectionIds = new Set();
        }

        container.innerHTML = `
            <div class="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b border-gray-200" style="overflow: visible;">
                <!-- All button -->
                <button class="fs-ab-section-pill px-2 py-1 text-[10px] font-medium rounded-full transition-all
                    ${this._autoBassSelectedSectionIds.size === 0 ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}"
                    data-section-id="all">
                    All
                </button>
                <!-- Section pills -->
                ${sections.map(section => {
                    const isSelected = this._autoBassSelectedSectionIds.has(section.id);
                    return `
                        <button class="fs-ab-section-pill px-2 py-1 text-[10px] font-medium rounded-full transition-all
                            ${isSelected ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}"
                            data-section-id="${section.id}">
                            ${section.label || section.name || 'Section'}
                        </button>
                    `;
                }).join('')}
            </div>
        `;

        // Add click handlers for section pills
        container.querySelectorAll('.fs-ab-section-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const sectionId = pill.dataset.sectionId;

                if (sectionId === 'all') {
                    // Clear selection to show all
                    this._autoBassSelectedSectionIds.clear();
                } else {
                    // Toggle this section
                    if (this._autoBassSelectedSectionIds.has(sectionId)) {
                        this._autoBassSelectedSectionIds.delete(sectionId);
                    } else {
                        this._autoBassSelectedSectionIds.add(sectionId);
                    }
                }

                // Re-render the panel
                const panelContent = this.container?.querySelector('#fs-dock-panel-content');
                if (panelContent) {
                    this._renderAutoBassPanel(panelContent);
                }
            });
        });
    }

    /**
     * Render chord cards in scroll view for auto-bass panel
     */
    _renderAutoBassScrollViewCards(container, chords, key, sections, selectedIndex) {
        container.innerHTML = '';

        const compState = getCompositionState();
        const sectionView = compState?.buildSectionView?.() || [];

        if (sectionView.length > 0) {
            // Render with section containers
            sectionView.forEach(section => {
                const sectionContainer = this._createAutoBassSectionContainer(section, chords, key, selectedIndex);
                if (sectionContainer) {
                    container.appendChild(sectionContainer);
                }
            });
        } else {
            // Flat cards
            chords.forEach((chord, index) => {
                const wrapper = this._createAutoBassChordCard(chord, index, key, selectedIndex);
                container.appendChild(wrapper);
            });
        }

        // Add ghost card for pattern continuation suggestion
        const ghostCard = this._createFSPatternGhostCard(chords, key);
        if (ghostCard) {
            container.appendChild(ghostCard);
        }
    }

    /**
     * Render chord cards in section view for auto-bass panel
     * Filters to only show selected sections (or all if none selected)
     */
    _renderAutoBassSectionViewCards(container, chords, key, sections, selectedIndex) {
        container.innerHTML = '';

        const compState = getCompositionState();
        const sectionView = compState?.buildSectionView?.() || [];

        // If no sections selected, show all
        const selectedIds = this._autoBassSelectedSectionIds && this._autoBassSelectedSectionIds.size > 0
            ? this._autoBassSelectedSectionIds
            : new Set(sectionView.map(s => s.id));

        // Filter to only selected sections
        const filteredSections = sectionView.filter(s => selectedIds.has(s.id));

        if (filteredSections.length > 0) {
            // Render with section containers (only selected ones)
            filteredSections.forEach(section => {
                const sectionContainer = this._createAutoBassSectionContainer(section, chords, key, selectedIndex);
                if (sectionContainer) {
                    container.appendChild(sectionContainer);
                }
            });

            // Add ghost card for pattern continuation suggestion (only if showing all sections)
            if (this._autoBassSelectedSectionIds.size === 0) {
                const ghostCard = this._createFSPatternGhostCard(chords, key);
                if (ghostCard) {
                    container.appendChild(ghostCard);
                }
            }
        } else {
            // No matching sections - show empty message
            container.innerHTML = '<div class="text-gray-400 text-sm p-4">No sections selected</div>';
        }
    }

    /**
     * Create section container for auto-bass panel
     */
    _createAutoBassSectionContainer(section, progressionData, key, selectedIndex) {
        const container = document.createElement('div');
        container.className = 'inline-flex flex-col rounded-lg overflow-visible flex-shrink-0';
        container.style.marginRight = '8px';

        // Section banner (muted amber theme)
        const banner = document.createElement('div');
        banner.className = 'flex items-center gap-2 px-2 py-1 rounded-t-lg';
        banner.style.backgroundColor = section.color || '#b45309';
        banner.innerHTML = `<span class="text-white text-xs font-semibold" style="-webkit-text-fill-color: white;">${section.label}</span>`;
        container.appendChild(banner);

        // Cards area
        const cardsArea = document.createElement('div');
        cardsArea.className = 'flex items-start gap-1 p-2 rounded-b-lg';
        const sectionColor = section.color || '#b45309';
        cardsArea.style.backgroundColor = sectionColor + '20';
        cardsArea.style.borderLeft = `2px solid ${sectionColor}`;
        cardsArea.style.borderRight = `2px solid ${sectionColor}`;
        cardsArea.style.borderBottom = `2px solid ${sectionColor}`;

        if (section.chordIndices && section.chordIndices.length > 0) {
            section.chordIndices.forEach(chordIdx => {
                if (chordIdx < progressionData.length) {
                    const chord = progressionData[chordIdx];
                    const wrapper = this._createAutoBassChordCard(chord, chordIdx, key, selectedIndex);
                    cardsArea.appendChild(wrapper);
                }
            });
        }

        container.appendChild(cardsArea);
        return container;
    }

    /**
     * Create chord card for auto-bass panel
     */
    _createAutoBassChordCard(chord, index, key, selectedIndex) {
        const wrapper = this._createFSChordCardWrapper(chord, index, key);
        // Click handler to select card and update Apply to Selected button
        wrapper.addEventListener('click', (e) => {
            if (e.target.closest('.drag-handle') || e.target.closest('button')) return;

            // Select this chord using main app's selection
            if (window.setSelectedChordIndex) {
                window.setSelectedChordIndex(index);
            }

            // Update Apply to Selected button after selection change
            // Use longer timeout to ensure DOM has updated with data-selected attribute
            setTimeout(() => this._updateApplyToSelectedButton(), 300);
        });
        return wrapper;
    }

    /**
     * Update Apply to Selected and Revert Selected button visibility/state
     * Checks both card selection (data-selected) and global selection state (for compact view)
     */
    _updateApplyToSelectedButton() {
        // Check multiple selection sources:
        // 1. Cards with data-selected="true" attribute
        const selectedCard = document.querySelector('.simplified-card[data-selected="true"], .detailed-card[data-selected="true"]');
        const hasCardSelection = selectedCard !== null;

        // 2. Global selection state (for compact/summary view)
        const globalIndices = window.getSelectedChordIndicesArray ? window.getSelectedChordIndicesArray() : [];
        const singleIdx = window.getSelectedChordIndex ? window.getSelectedChordIndex() : -1;
        const hasGlobalSelection = globalIndices.length > 0 || singleIdx >= 0;

        // Enable button if either selection method has a selection
        const hasSelection = hasCardSelection || hasGlobalSelection;

        // Update Apply to Selected button
        let applyBtn = this.container?.querySelector('#fs-bass-apply-selected');
        if (!applyBtn) {
            applyBtn = document.querySelector('#fs-bass-apply-selected');
        }
        if (applyBtn) {
            applyBtn.disabled = !hasSelection;
            applyBtn.style.opacity = hasSelection ? '1' : '0.5';
        }

        // Update Revert Selected button
        let revertBtn = this.container?.querySelector('#fs-bass-revert-selected');
        if (!revertBtn) {
            revertBtn = document.querySelector('#fs-bass-revert-selected');
        }
        if (revertBtn) {
            revertBtn.disabled = !hasSelection;
            revertBtn.style.opacity = hasSelection ? '1' : '0.5';
        }
    }

    _renderVoiceLeadingPanel(container) {
        // Load saved preferences - EXACTLY like voiceLeadingOverlay.js
        const savedMode = localStorage.getItem('fs-vl-mode') || 'smooth';
        const savedShowWarningsOnly = localStorage.getItem('fs-vl-warnings-only') === 'true';
        const savedShowNewDropped = localStorage.getItem('fs-vl-show-new-dropped') !== 'false'; // default true

        // MOTION_COLORS and WARNING_COLORS - EXACTLY like voiceLeadingOverlay.js (lines 24-38)
        const MOTION_COLORS = {
            commonTone: '#22C55E',  // Green
            stepwise: '#3B82F6',    // Blue
            skip: '#F97316',        // Orange
            leap: '#EF4444',        // Red
        };
        const WARNING_COLORS = {
            parallelFifth: '#0EA5E9',   // Sky blue
            parallelOctave: '#8B5CF6', // Violet
            voiceCrossing: '#F59E0B',  // Amber
            largeleap: '#EC4899',      // Pink
        };

        container.innerHTML = `
            <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 border-b border-blue-600">
                <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Voice Leading Analysis</span>
                <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="h-full flex flex-col">
                <!-- Filter Controls Row - EXACTLY like voiceLeadingOverlay.js (lines 599-659) -->
                <div class="flex items-center justify-between px-3 py-2 bg-white/50 border-b border-indigo-200">
                    <div class="flex items-center gap-3 flex-wrap">
                        <!-- Matching Mode: Segmented Control -->
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs text-gray-500">Mode:</span>
                            <div class="inline-flex rounded-md overflow-hidden border border-gray-300">
                                <button id="fs-vl-mode-smooth"
                                        class="px-2 py-1 text-xs font-medium transition-all border-r border-gray-300 ${savedMode === 'smooth' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}"
                                        title="Minimize total voice movement">
                                    Smooth
                                </button>
                                <button id="fs-vl-mode-voices"
                                        class="px-2 py-1 text-xs font-medium transition-all ${savedMode === 'voices' ? 'bg-purple-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}"
                                        title="Track by register position">
                                    Voice Parts
                                </button>
                            </div>
                            <button id="fs-vl-mode-info-btn" class="p-0.5 text-gray-400 hover:text-gray-600 transition-colors" title="Learn about matching modes">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                                </svg>
                            </button>
                        </div>

                        <span class="text-gray-300">|</span>

                        <!-- View Filter: Segmented Control -->
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs text-gray-500">Show:</span>
                            <div class="inline-flex rounded-md overflow-hidden border border-gray-300">
                                <button id="fs-vl-view-all"
                                        class="px-2 py-1 text-xs font-medium transition-all border-r border-gray-300 ${!savedShowWarningsOnly ? 'bg-gray-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}">
                                    All
                                </button>
                                <button id="fs-vl-view-warnings"
                                        class="px-2 py-1 text-xs font-medium transition-all flex items-center gap-1 ${savedShowWarningsOnly ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}">
                                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                                    </svg>
                                    Warnings
                                </button>
                            </div>
                        </div>

                        <span class="text-gray-300">|</span>

                        <!-- New/Dropped: Checkbox-style toggle -->
                        <button id="fs-vl-filter-new-dropped"
                                class="flex items-center gap-1.5 px-2 py-1 text-xs rounded border transition-all ${savedShowNewDropped ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'}"
                                title="Show gray arcs for voices that appear or disappear between chords">
                            <span id="fs-vl-new-dropped-checkbox" class="w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${savedShowNewDropped ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-gray-400'}">
                                <svg id="fs-vl-new-dropped-check" class="w-2.5 h-2.5 text-white ${savedShowNewDropped ? '' : 'hidden'}" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
                            </span>
                            <span>Added/Removed</span>
                        </button>
                    </div>
                    <div id="fs-vl-warning-summary" class="text-xs text-gray-500">
                        <!-- Warning summary will be inserted here -->
                    </div>
                </div>

                <!-- Mode Info Panel (hidden by default) - EXACTLY like voiceLeadingOverlay.js (lines 662-684) -->
                <div id="fs-vl-mode-info-panel" class="hidden px-3 py-3 bg-blue-50 border-b border-blue-200 text-sm">
                    <div class="flex justify-between items-start mb-2">
                        <span class="font-semibold text-blue-900">Voice Matching Modes</span>
                        <button id="fs-vl-mode-info-close" class="text-blue-400 hover:text-blue-600">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                    <div class="space-y-3 text-xs text-blue-800">
                        <div class="flex gap-2">
                            <span class="px-2 py-0.5 bg-blue-200 text-blue-800 rounded font-medium shrink-0">Smooth</span>
                            <p>Uses the <strong>Hungarian algorithm</strong> to minimize total semitone movement across all voices. Best for analyzing <em>efficiency</em> of voice leading.</p>
                        </div>
                        <div class="flex gap-2">
                            <span class="px-2 py-0.5 bg-purple-200 text-purple-800 rounded font-medium shrink-0">Voice Parts</span>
                            <p>Connects notes by <strong>register position</strong>: top → top, middle → middle, bottom → bottom. Best for understanding how <em>individual voice parts</em> move.</p>
                        </div>
                    </div>
                </div>

                <!-- Diagram Area - EXACTLY like voiceLeadingOverlay.js (line 687) -->
                <div id="fs-vl-diagram" class="flex-1 p-2 overflow-x-auto bg-white/30 min-h-[80px]">
                    <div class="flex items-center justify-center h-full text-gray-400 text-sm">Loading...</div>
                </div>

                <!-- Fix Suggestions Area (populated dynamically) -->
                <div id="fs-vl-fix-suggestions" class="border-t border-indigo-200 hidden"></div>

                <!-- Legend - EXACTLY like voiceLeadingOverlay.js (lines 691-734) -->
                <div class="px-3 py-2 bg-white/50 border-t border-indigo-200">
                    <div class="flex justify-center flex-wrap gap-x-4 gap-y-1 text-xs">
                        <!-- Motion types row -->
                        <div class="flex items-center gap-3">
                            <span class="text-gray-500 font-medium">Motion:</span>
                            <div class="flex items-center gap-1" title="COMMON TONE (Excellent): Same pitch held between chords. Creates stability.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${MOTION_COLORS.commonTone}" stroke-width="2.5"/></svg>
                                <span class="text-gray-600">Common</span>
                            </div>
                            <div class="flex items-center gap-1" title="STEPWISE (Good): Half or whole step (1-2 semitones). Smooth, singable.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${MOTION_COLORS.stepwise}" stroke-width="2.5"/></svg>
                                <span class="text-gray-600">Step</span>
                            </div>
                            <div class="flex items-center gap-1" title="SKIP (Acceptable): Third to fifth (3-7 semitones). Use sparingly.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${MOTION_COLORS.skip}" stroke-width="2.5" stroke-dasharray="4,2"/></svg>
                                <span class="text-gray-600">Skip</span>
                            </div>
                            <div class="flex items-center gap-1" title="LEAP (Use with care): Sixth or larger (8+ semitones). Can sound awkward.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${MOTION_COLORS.leap}" stroke-width="2.5" stroke-dasharray="3,3"/></svg>
                                <span class="text-gray-600">Leap</span>
                            </div>
                        </div>
                        <!-- Warnings row -->
                        <div class="flex items-center gap-3 ml-2 pl-2 border-l border-gray-300">
                            <span class="text-gray-500 font-medium">Warnings:</span>
                            <div class="flex items-center gap-1" title="PARALLEL 5THS (Avoid): Two voices moving in parallel perfect 5ths.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${WARNING_COLORS.parallelFifth}" stroke-width="3"/></svg>
                                <span style="color: #0EA5E9;" class="font-medium">P5</span>
                            </div>
                            <div class="flex items-center gap-1" title="PARALLEL 8VES (Avoid): Two voices moving in parallel octaves.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${WARNING_COLORS.parallelOctave}" stroke-width="3"/></svg>
                                <span style="color: #8B5CF6;" class="font-medium">P8</span>
                            </div>
                            <div class="flex items-center gap-1" title="LARGE LEAP (Caution): Jump of 8+ semitones.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${WARNING_COLORS.largeleap}" stroke-width="3"/></svg>
                                <span style="color: #EC4899;" class="font-medium">Lg Leap</span>
                            </div>
                            <div class="flex items-center gap-1" title="VOICE CROSSING (Caution): Lower voice moves above higher voice.">
                                <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="${WARNING_COLORS.voiceCrossing}" stroke-width="3"/></svg>
                                <span class="text-amber-600 font-medium">Cross</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Store state for use in diagram rendering
        this._vlState = {
            mode: savedMode,
            showWarningsOnly: savedShowWarningsOnly,
            showNewDropped: savedShowNewDropped
        };

        // Mode button handlers
        container.querySelector('#fs-vl-mode-smooth')?.addEventListener('click', () => {
            this._vlState.mode = 'smooth';
            localStorage.setItem('fs-vl-mode', 'smooth');
            this._updateVLModeButtons(container);
            this._renderVoiceLeadingDiagram();
        });

        container.querySelector('#fs-vl-mode-voices')?.addEventListener('click', () => {
            this._vlState.mode = 'voices';
            localStorage.setItem('fs-vl-mode', 'voices');
            this._updateVLModeButtons(container);
            this._renderVoiceLeadingDiagram();
        });

        // Mode info toggle
        container.querySelector('#fs-vl-mode-info-btn')?.addEventListener('click', () => {
            const infoPanel = container.querySelector('#fs-vl-mode-info-panel');
            if (infoPanel) infoPanel.classList.toggle('hidden');
        });

        container.querySelector('#fs-vl-mode-info-close')?.addEventListener('click', () => {
            const infoPanel = container.querySelector('#fs-vl-mode-info-panel');
            if (infoPanel) infoPanel.classList.add('hidden');
        });

        // View filter handlers
        container.querySelector('#fs-vl-view-all')?.addEventListener('click', () => {
            this._vlState.showWarningsOnly = false;
            localStorage.setItem('fs-vl-warnings-only', 'false');
            this._updateVLViewButtons(container);
            this._renderVoiceLeadingDiagram();
        });

        container.querySelector('#fs-vl-view-warnings')?.addEventListener('click', () => {
            this._vlState.showWarningsOnly = true;
            localStorage.setItem('fs-vl-warnings-only', 'true');
            this._updateVLViewButtons(container);
            this._renderVoiceLeadingDiagram();
        });

        // New/Dropped toggle handler
        container.querySelector('#fs-vl-filter-new-dropped')?.addEventListener('click', () => {
            this._vlState.showNewDropped = !this._vlState.showNewDropped;
            localStorage.setItem('fs-vl-show-new-dropped', this._vlState.showNewDropped.toString());
            this._updateVLNewDroppedButton(container);
            this._renderVoiceLeadingDiagram();
        });

        // Close button handler
        container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
            this.closeActivePanel();
        });

        // Render the diagram
        this._renderVoiceLeadingDiagram();
    }

    _updateVLModeButtons(container) {
        const smoothBtn = container.querySelector('#fs-vl-mode-smooth');
        const voicesBtn = container.querySelector('#fs-vl-mode-voices');
        if (this._vlState.mode === 'smooth') {
            smoothBtn?.classList.add('bg-blue-500', 'text-white');
            smoothBtn?.classList.remove('bg-white', 'text-gray-600');
            voicesBtn?.classList.remove('bg-purple-500', 'text-white');
            voicesBtn?.classList.add('bg-white', 'text-gray-600');
        } else {
            voicesBtn?.classList.add('bg-purple-500', 'text-white');
            voicesBtn?.classList.remove('bg-white', 'text-gray-600');
            smoothBtn?.classList.remove('bg-blue-500', 'text-white');
            smoothBtn?.classList.add('bg-white', 'text-gray-600');
        }
    }

    _updateVLViewButtons(container) {
        const allBtn = container.querySelector('#fs-vl-view-all');
        const warningsBtn = container.querySelector('#fs-vl-view-warnings');
        if (this._vlState.showWarningsOnly) {
            warningsBtn?.classList.add('bg-red-500', 'text-white');
            warningsBtn?.classList.remove('bg-white', 'text-gray-600');
            allBtn?.classList.remove('bg-gray-700', 'text-white');
            allBtn?.classList.add('bg-white', 'text-gray-600');
        } else {
            allBtn?.classList.add('bg-gray-700', 'text-white');
            allBtn?.classList.remove('bg-white', 'text-gray-600');
            warningsBtn?.classList.remove('bg-red-500', 'text-white');
            warningsBtn?.classList.add('bg-white', 'text-gray-600');
        }
    }

    _updateVLNewDroppedButton(container) {
        const btn = container.querySelector('#fs-vl-filter-new-dropped');
        const checkbox = container.querySelector('#fs-vl-new-dropped-checkbox');
        const checkmark = container.querySelector('#fs-vl-new-dropped-check');
        if (this._vlState.showNewDropped) {
            btn?.classList.add('bg-indigo-50', 'text-indigo-700', 'border-indigo-300');
            btn?.classList.remove('bg-white', 'text-gray-500', 'border-gray-300');
            checkbox?.classList.add('bg-indigo-500', 'border-indigo-500');
            checkbox?.classList.remove('bg-white', 'border-gray-400');
            checkmark?.classList.remove('hidden');
        } else {
            btn?.classList.remove('bg-indigo-50', 'text-indigo-700', 'border-indigo-300');
            btn?.classList.add('bg-white', 'text-gray-500', 'border-gray-300');
            checkbox?.classList.remove('bg-indigo-500', 'border-indigo-500');
            checkbox?.classList.add('bg-white', 'border-gray-400');
            checkmark?.classList.add('hidden');
        }
    }

    _renderVoiceLeadingDiagram() {
        const diagramContainer = this.container.querySelector('#fs-vl-diagram');
        if (!diagramContainer) return;

        // Get filter options from state
        const matchingMode = this._vlState?.mode || 'smooth';
        const showWarningsOnly = this._vlState?.showWarningsOnly || false;
        const showNewDropped = this._vlState?.showNewDropped !== false;

        const existingDiagram = window.voiceLeadingDiagram;
        if (existingDiagram && typeof existingDiagram.renderToContainer === 'function') {
            // Force fresh analysis before rendering to ensure warnings are up-to-date
            // This is needed because the main diagram might have stale data
            if (typeof existingDiagram.analyze === 'function') {
                existingDiagram.analyze();
            }

            // Render diagram with all filter options
            existingDiagram.renderToContainer(diagramContainer, {
                matchingMode: matchingMode,
                showWarningsOnly: showWarningsOnly,
                showNewDropped: showNewDropped
            });

            // Update warning summary
            this._updateVLWarningSummary();

            // Render fix suggestions
            this._renderVLFixSuggestions();
        } else {
            diagramContainer.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400 text-sm">Voice leading diagram not available</div>';
        }
    }

    _updateVLWarningSummary() {
        const summaryEl = this.container?.querySelector('#fs-vl-warning-summary');
        if (!summaryEl) return;

        // Simply clone/copy the content from Composition Studio's warning summary element
        // This ensures full-screen always matches Composition Studio exactly
        const compositionStudioSummary = document.getElementById('vl-warning-summary');
        if (compositionStudioSummary && compositionStudioSummary.innerHTML) {
            summaryEl.innerHTML = compositionStudioSummary.innerHTML;
        } else {
            // Fallback if Composition Studio element not found
            summaryEl.innerHTML = '<span class="text-gray-500">No analysis available</span>';
        }
    }

    _renderVLFixSuggestions() {
        const suggestionsContainer = this.container?.querySelector('#fs-vl-fix-suggestions');
        if (!suggestionsContainer) return;

        const existingDiagram = window.voiceLeadingDiagram;
        if (!existingDiagram?.analysisData) {
            suggestionsContainer.classList.add('hidden');
            return;
        }

        const { transitions, warnings } = existingDiagram.analysisData;
        if (!warnings || warnings.length === 0) {
            suggestionsContainer.classList.add('hidden');
            return;
        }

        // Generate fix suggestions - mirror voiceLeadingOverlay.js logic
        const suggestions = [];

        // Group warnings by type for suggestions
        const parallelFifths = warnings.filter(w => w.type === 'parallelFifth');
        const parallelOctaves = warnings.filter(w => w.type === 'parallelOctave');
        const voiceCrossings = warnings.filter(w => w.type === 'voiceCrossing');
        const largeLeaps = warnings.filter(w => w.type === 'largeLeap');

        if (parallelFifths.length > 0) {
            suggestions.push({
                icon: '🎵',
                title: `Parallel Fifths (${parallelFifths.length})`,
                issue: 'Two voices moving in parallel perfect fifths reduces voice independence.',
                fixes: [
                    'Use contrary or oblique motion instead',
                    'Add a passing tone between the fifths',
                    'Change one voice to create a 3rd or 6th'
                ]
            });
        }

        if (parallelOctaves.length > 0) {
            suggestions.push({
                icon: '🎹',
                title: `Parallel Octaves (${parallelOctaves.length})`,
                issue: 'Two voices moving in parallel octaves makes them sound like one voice.',
                fixes: [
                    'Use contrary motion to separate voices',
                    'Add a suspension or neighbor tone',
                    'Change chord voicing or inversion'
                ]
            });
        }

        if (voiceCrossings.length > 0) {
            suggestions.push({
                icon: '🔄',
                title: `Voice Crossings (${voiceCrossings.length})`,
                issue: 'A lower voice moved above a higher voice, which can confuse part identity.',
                fixes: [
                    'Adjust the chord voicing to keep voices in proper range',
                    'Use a different inversion',
                    'Brief crossings may be acceptable for melodic interest'
                ]
            });
        }

        if (largeLeaps.length > 0) {
            suggestions.push({
                icon: '📈',
                title: `Large Leaps (${largeLeaps.length})`,
                issue: 'Jumps of an octave or more can sound awkward or disconnected.',
                fixes: [
                    'Fill in the leap with stepwise motion if possible',
                    'Follow the leap with contrary stepwise motion',
                    'Consider if the leap serves a musical purpose (dramatic effect)'
                ]
            });
        }

        if (suggestions.length === 0) {
            suggestionsContainer.classList.add('hidden');
            return;
        }

        suggestionsContainer.classList.remove('hidden');
        suggestionsContainer.innerHTML = `
            <div class="px-3 py-2 bg-amber-50">
                <button id="fs-vl-suggestions-toggle" class="w-full flex items-center justify-between text-left">
                    <span class="flex items-center gap-2 text-sm font-medium text-amber-800">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                        </svg>
                        Fix Suggestions (${suggestions.length})
                    </span>
                    <svg id="fs-vl-suggestions-chevron" class="w-4 h-4 text-amber-600 transform transition-transform" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                </button>
                <div id="fs-vl-suggestions-content" class="hidden mt-2 space-y-2 max-h-[150px] overflow-y-auto">
                    ${suggestions.map(s => `
                        <div class="bg-white rounded-lg p-2 shadow-sm border border-amber-200">
                            <div class="flex items-start gap-2">
                                <span class="text-base">${s.icon}</span>
                                <div class="flex-1">
                                    <div class="font-medium text-gray-900 text-xs">${s.title}</div>
                                    <div class="text-[10px] text-gray-600">${s.issue}</div>
                                    <div class="mt-1">
                                        <ul class="text-[10px] text-gray-700 space-y-0.5">
                                            ${s.fixes.map(fix => `
                                                <li class="flex items-start gap-1">
                                                    <span class="text-green-500">•</span>
                                                    <span>${fix}</span>
                                                </li>
                                            `).join('')}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        // Add toggle behavior
        const toggleBtn = suggestionsContainer.querySelector('#fs-vl-suggestions-toggle');
        const content = suggestionsContainer.querySelector('#fs-vl-suggestions-content');
        const chevron = suggestionsContainer.querySelector('#fs-vl-suggestions-chevron');

        if (toggleBtn && content && chevron) {
            toggleBtn.addEventListener('click', () => {
                content.classList.toggle('hidden');
                chevron.classList.toggle('rotate-180');
            });
        }
    }

    _renderBorrowedPanel(container) {
        const compState = getCompositionState();
        const settings = compState?.getSettings?.() || {};
        // Get key from trainerState (the single source of truth for current key)
        const rawKey = getCurrentKey() || 'C';
        const mode = settings.mode || 'major';

        // Smart key display: if key already ends with 'm' (like "Dm"), don't append mode
        // Also extract the root note for transposition (strip trailing 'm' if present)
        const keyEndsWithMinor = rawKey.endsWith('m') && rawKey.length > 1;
        const key = keyEndsWithMinor ? rawKey.slice(0, -1) : rawKey;
        const keyDisplay = keyEndsWithMinor
            ? `${key} Minor`  // "Dm" -> "D Minor"
            : `${rawKey} ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;  // "C" + "major" -> "C Major"

        // Comprehensive borrowed chords with descriptions and suggestions
        const borrowedChords = [
            // From Parallel Minor (Aeolian)
            {
                root: key, type: 'Minor', numeral: 'i', label: 'parallel minor',
                source: 'Parallel Minor',
                description: 'Adds melancholy, introspective quality',
                suggestion: 'Works well as a surprise tonic substitute',
                category: 'Parallel Minor'
            },
            {
                root: this._transposeNote(key, 10), type: 'Major', numeral: 'bVII', label: 'bVII',
                source: 'Mixolydian / Parallel Minor',
                description: 'Rock/folk flavor, powerful resolution to I',
                suggestion: 'Classic rock cadence: bVII → I',
                category: 'Parallel Minor'
            },
            {
                root: this._transposeNote(key, 8), type: 'Major', numeral: 'bVI', label: 'bVI',
                source: 'Parallel Minor (Aeolian)',
                description: 'Dramatic lift, emotional depth',
                suggestion: 'Try after V for a deceptive cadence',
                category: 'Parallel Minor'
            },
            {
                root: this._transposeNote(key, 3), type: 'Minor', numeral: 'bIII', label: 'bIII',
                source: 'Parallel Minor',
                description: 'Unexpected color, often to/from IV',
                suggestion: 'Common in blues and rock progressions',
                category: 'Parallel Minor'
            },
            {
                root: this._transposeNote(key, 5), type: 'Minor', numeral: 'iv', label: 'iv',
                source: 'Parallel Minor',
                description: 'Melancholy plagal motion',
                suggestion: 'Beautiful in iv → I (minor plagal cadence)',
                category: 'Parallel Minor'
            },
            // Neapolitan
            {
                root: this._transposeNote(key, 1), type: 'Major', numeral: 'bII', label: 'Neapolitan',
                source: 'Phrygian / Neapolitan',
                description: 'Exotic, dramatic pre-dominant chord',
                suggestion: 'Typically resolves to V or directly to I',
                category: 'Chromatic'
            },
            // Dominant 7th variants
            {
                root: this._transposeNote(key, 10), type: 'Dominant 7th', numeral: 'bVII7', label: 'bVII7',
                source: 'Mixolydian',
                description: 'Bluesy dominant sound on bVII',
                suggestion: 'Strong pull to I, common in blues/rock',
                category: 'Extended'
            },
            {
                root: this._transposeNote(key, 5), type: 'Minor 7th', numeral: 'iv7', label: 'iv7',
                source: 'Parallel Minor',
                description: 'Jazzy minor plagal with 7th',
                suggestion: 'iv7 → I gives a sophisticated plagal cadence',
                category: 'Extended'
            },
            // Augmented sixth family (simplified as dominant 7ths)
            {
                root: this._transposeNote(key, 8), type: 'Dominant 7th', numeral: 'bVI7', label: 'bVI7',
                source: 'Parallel Minor',
                description: 'Tritone sub for ii7, jazz borrowing',
                suggestion: 'Works as tritone substitution: bVI7 → V',
                category: 'Extended'
            },
            // Diminished passing chord
            {
                root: this._transposeNote(key, 1), type: 'Diminished 7th', numeral: '#i°7', label: '#i°7',
                source: 'Chromatic',
                description: 'Common diminished passing chord',
                suggestion: 'Use between I and ii as a passing chord',
                category: 'Chromatic'
            },
            // Secondary dominants (borrowed function)
            {
                root: this._transposeNote(key, 2), type: 'Dominant 7th', numeral: 'V7/V', label: 'V/V',
                source: 'Secondary Dominant',
                description: 'Dominant of the dominant',
                suggestion: 'Creates strong pull to V chord',
                category: 'Secondary'
            },
            {
                root: this._transposeNote(key, 9), type: 'Dominant 7th', numeral: 'V7/ii', label: 'V/ii',
                source: 'Secondary Dominant',
                description: 'Targets the ii chord',
                suggestion: 'V7/ii → ii → V → I is a classic sequence',
                category: 'Secondary'
            },
        ];

        // Store for use in detail section
        this._borrowedChordsData = borrowedChords;

        const selectedChord = this._selectedBorrowedChord;

        // Helper to get chord symbol suffix
        const getChordSymbol = (type) => {
            const symbols = {
                'Major': '',
                'Minor': 'm',
                'Dominant 7th': '7',
                'Major 7th': 'maj7',
                'Minor 7th': 'm7',
                'Diminished': '°',
                'Diminished 7th': '°7',
                'Half-Diminished 7th': 'ø7',
                'Augmented': '+',
            };
            return symbols[type] || '';
        };

        // Render the quick progression picker
        const progressionPickerHTML = this._renderBorrowedProgressionPicker();
        // Height calculation: header (44px) + picker header (30px when collapsed, ~110px when expanded)
        const pickerHeight = this._borrowedPickerCollapsed ? 30 : 110;
        const contentHeight = `calc(100% - ${44 + pickerHeight}px)`;

        container.innerHTML = `
            <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-slate-600 to-indigo-700 border-b border-slate-500">
                <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Borrowed Chords</span>
                <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            ${progressionPickerHTML}
            <div class="px-3 pt-2 pb-1 overflow-hidden" style="height: ${contentHeight}; display: flex; flex-direction: column;">
                <div class="text-xs text-slate-500 mb-1 flex-shrink-0">Key: ${keyDisplay} — click a borrowed chord to see details</div>
                <div id="fs-borrowed-chords-list" class="flex gap-1.5 overflow-x-auto pb-1 pt-1 pl-1 flex-shrink-0" style="scrollbar-width: thin; scrollbar-color: #94a3b8 #e2e8f0;">
                    ${borrowedChords.map((chord, idx) => {
                        const isSelected = selectedChord && selectedChord.numeral === chord.numeral;
                        const chordName = chord.root + getChordSymbol(chord.type);
                        return `
                            <button class="fs-borrowed-chord flex-shrink-0 px-2 py-1 rounded border transition-all text-center
                                ${isSelected
                                    ? 'ring-2 ring-indigo-400 bg-indigo-50 border-indigo-300'
                                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'}"
                                    data-idx="${idx}" data-root="${chord.root}" data-type="${chord.type}" data-numeral="${chord.numeral}"
                                    style="min-width: 50px;">
                                <div class="font-bold text-xs text-slate-700">${chordName}</div>
                                <div class="text-[9px] text-slate-500">${chord.numeral}</div>
                            </button>
                        `;
                    }).join('')}
                </div>
                <div id="fs-borrowed-detail-section" class="flex-1 overflow-y-auto mt-1" style="scrollbar-width: thin; scrollbar-color: #94a3b8 #e2e8f0;">
                    ${selectedChord ? this._renderBorrowedDetailSection(selectedChord) : `
                        <div class="px-4 py-3 text-center text-slate-400 text-sm">
                            Select a borrowed chord above to see theory details and add to your progression
                        </div>
                    `}
                </div>
            </div>
            <style>
                #fs-borrowed-chords-list::-webkit-scrollbar { height: 6px; }
                #fs-borrowed-chords-list::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 3px; }
                #fs-borrowed-chords-list::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
                #fs-borrowed-chords-list::-webkit-scrollbar-thumb:hover { background: #64748b; }
                #fs-borrowed-detail-section::-webkit-scrollbar { width: 6px; }
                #fs-borrowed-detail-section::-webkit-scrollbar-track { background: #e2e8f0; border-radius: 3px; }
                #fs-borrowed-detail-section::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 3px; }
                #fs-borrowed-detail-section::-webkit-scrollbar-thumb:hover { background: #64748b; }
            </style>
        `;

        // Add click handlers for borrowed chord selection
        container.querySelectorAll('.fs-borrowed-chord').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                const chord = borrowedChords[idx];
                this._selectedBorrowedChord = chord;
                this._borrowedChordInversion = 0; // Reset inversion on new selection
                this._renderBorrowedPanel(container); // Re-render with selection
            });
        });

        // Add event handlers for the quick progression picker
        this._attachBorrowedProgressionPickerHandlers(container);

        // Add event handlers for detail section if a chord is selected
        if (selectedChord) {
            this._attachBorrowedDetailHandlers(container);
        }

        // Close button handler
        container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
            this.closeActivePanel();
        });
    }

    /**
     * Render the detail section for a selected borrowed chord
     */
    _renderBorrowedDetailSection(chord) {
        // Get chord symbol
        const getChordSymbol = (type) => {
            const symbols = {
                'Major': '',
                'Minor': 'm',
                'Dominant 7th': '7',
                'Major 7th': 'maj7',
                'Minor 7th': 'm7',
                'Diminished': '°',
                'Diminished 7th': '°7',
                'Half-Diminished 7th': 'ø7',
                'Augmented': '+',
            };
            return symbols[type] || '';
        };
        const chordName = chord.root + getChordSymbol(chord.type);
        const inversionLabels = ['Root', '1st', '2nd'];
        const currentInversion = this._borrowedChordInversion || 0;

        // Category colors
        const categoryColors = {
            'Parallel Minor': 'bg-purple-100 text-purple-700',
            'Chromatic': 'bg-amber-100 text-amber-700',
            'Extended': 'bg-blue-100 text-blue-700',
            'Secondary': 'bg-green-100 text-green-700',
        };
        const categoryClass = categoryColors[chord.category] || 'bg-slate-100 text-slate-600';

        return `
            <div class="border-t border-slate-200 mx-3"></div>
            <div class="px-4 py-3">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">${chord.numeral}</span>
                        <span class="font-semibold text-slate-800">${chordName}</span>
                        ${chord.category ? `<span class="px-2 py-0.5 ${categoryClass} text-[10px] font-medium rounded">${chord.category}</span>` : ''}
                    </div>
                    <button id="fs-borrowed-close-detail" class="p-1 rounded hover:bg-slate-100 transition-colors flex-shrink-0" title="Close details">
                        <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>

                <div class="text-xs text-slate-500 mb-1"><span class="font-medium">Source:</span> ${chord.source}</div>
                <div class="text-sm text-slate-700 mb-2">${chord.description}</div>

                <div class="flex items-center gap-4 mb-2 flex-wrap">
                    <button id="fs-borrowed-add-btn" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-all shadow-sm">
                        Add to Progression
                    </button>

                    <div class="flex items-center gap-1">
                        <span class="text-xs text-slate-500 mr-1">Inversion:</span>
                        ${inversionLabels.map((label, inv) => `
                            <button class="fs-borrowed-inv-btn px-2 py-1 text-xs rounded transition-all
                                ${inv === currentInversion
                                    ? 'bg-indigo-500 text-white font-medium'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                                data-inversion="${inv}" title="Hold to preview ${label} inversion">
                                ${label}
                            </button>
                        `).join('')}
                        <span class="text-[10px] text-slate-400 ml-1">(hold to preview)</span>
                    </div>
                </div>

                <div class="text-xs text-slate-600 bg-slate-50 rounded px-3 py-2 border-l-2 border-indigo-400">
                    💡 <span class="font-medium">Tip:</span> ${chord.suggestion}
                </div>
            </div>
        `;
    }

    /**
     * Attach event handlers for the borrowed chord detail section
     */
    _attachBorrowedDetailHandlers(container) {
        const chord = this._selectedBorrowedChord;
        if (!chord) return;

        // Close detail button
        container.querySelector('#fs-borrowed-close-detail')?.addEventListener('click', () => {
            this._selectedBorrowedChord = null;
            this._borrowedChordInversion = 0;
            this._renderBorrowedPanel(container);
        });

        // Add button
        container.querySelector('#fs-borrowed-add-btn')?.addEventListener('click', () => {
            this._addBorrowedChord(chord, this._borrowedChordInversion);
        });

        // Inversion buttons - click to select, hold to preview
        container.querySelectorAll('.fs-borrowed-inv-btn').forEach(btn => {
            const inv = parseInt(btn.dataset.inversion, 10);

            // Click to select inversion
            btn.addEventListener('click', () => {
                this._borrowedChordInversion = inv;
                // Update button styles
                container.querySelectorAll('.fs-borrowed-inv-btn').forEach(b => {
                    const bInv = parseInt(b.dataset.inversion, 10);
                    if (bInv === inv) {
                        b.className = 'fs-borrowed-inv-btn px-2 py-1 text-xs rounded transition-all bg-indigo-500 text-white font-medium';
                    } else {
                        b.className = 'fs-borrowed-inv-btn px-2 py-1 text-xs rounded transition-all bg-slate-100 text-slate-600 hover:bg-slate-200';
                    }
                });
            });

            // Hold to preview
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this._borrowedChordInversion = inv;
                this._startBorrowedPreview(chord.root, chord.type, inv);
                btn.classList.add('ring-2', 'ring-indigo-400');
            });

            btn.addEventListener('mouseup', () => {
                this._stopBorrowedPreview();
                btn.classList.remove('ring-2', 'ring-indigo-400');
            });

            btn.addEventListener('mouseleave', () => {
                this._stopBorrowedPreview();
                btn.classList.remove('ring-2', 'ring-indigo-400');
            });

            // Touch support
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this._borrowedChordInversion = inv;
                this._startBorrowedPreview(chord.root, chord.type, inv);
                btn.classList.add('ring-2', 'ring-indigo-400');
            });

            btn.addEventListener('touchend', () => {
                this._stopBorrowedPreview();
                btn.classList.remove('ring-2', 'ring-indigo-400');
            });
        });
    }

    /**
     * Start preview playback for borrowed chord
     */
    _startBorrowedPreview(root, type, inversion = 0) {
        try {
            // Use the app's shared piano via window.getPiano()
            const piano = window.getPiano?.();
            if (!piano) {
                console.warn('[Borrowed] Piano not available for preview');
                return;
            }

            const notes = this._buildBorrowedChordNotes(root, type, inversion);
            piano.triggerAttack(notes);
            this._borrowedPreviewActive = true;
        } catch (e) {
            console.warn('[Borrowed] Preview error:', e);
        }
    }

    /**
     * Stop preview playback
     */
    _stopBorrowedPreview() {
        try {
            const piano = window.getPiano?.();
            if (piano && this._borrowedPreviewActive) {
                piano.releaseAll();
                this._borrowedPreviewActive = false;
            }
        } catch (e) {
            console.warn('[Borrowed] Stop preview error:', e);
        }
    }

    /**
     * Render the quick progression picker for Borrowed Chords panel
     * This mirrors the unified modal's persistent progression bar pattern
     * @returns {string} HTML string for the progression picker
     */
    _renderBorrowedProgressionPicker() {
        const progressionData = getProgressionData() || [];
        const compositionState = getCompositionState();
        const sections = compositionState?.getSections?.() || [];

        // Build sections with ungrouped chords (same logic as unified modal)
        const allSectionsWithPseudo = buildSectionsWithUngrouped(sections, progressionData.length);

        // Helper to get chord symbol suffix
        const getChordSymbol = (type) => {
            const chordDef = CHORD_DEFINITIONS[type];
            return chordDef?.symbol || '';
        };

        // Helper for inversion superscript
        const getInversionLabel = (inversion) => {
            return { 1: '¹', 2: '²', 3: '³', 4: '⁴' }[inversion] || '';
        };

        if (progressionData.length === 0) {
            return `
                <div class="px-3 py-2 border-b border-slate-200 bg-slate-50">
                    <div class="text-xs text-slate-400 italic text-center">
                        No chords in progression yet. Added chords will be placed at the start.
                    </div>
                </div>
            `;
        }

        // Section picker row (only show if there are sections)
        let sectionPickerHTML = '';
        if (allSectionsWithPseudo.length > 0) {
            const isAllSelected = this._borrowedSelectedSectionIds.size === 0;
            sectionPickerHTML = `
                <div class="flex items-center gap-1.5 overflow-x-auto pt-1 pb-2" style="scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;">
                    <span class="text-[9px] text-slate-500 flex-shrink-0">Sections:</span>
                    <button data-section-id="all" class="borrowed-section-pill px-2.5 py-2 rounded-full text-[9px] font-semibold transition-all flex-shrink-0
                        ${isAllSelected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
                        title="Show all chords">All</button>
                    ${allSectionsWithPseudo.map(section => {
                        const isSelected = this._borrowedSelectedSectionIds.has(section.id);
                        const color = section.color || '#9ca3af';
                        return `
                            <button data-section-id="${section.id}" class="borrowed-section-pill px-2.5 py-2 rounded-full text-[9px] font-semibold transition-all flex-shrink-0"
                                style="background: ${isSelected ? color : hexToRgba(color, 0.15)}; color: ${isSelected ? 'white' : color}; border: 1px solid ${color};"
                                title="${section.label} (${section.chordIndices.length} chords)">
                                ${section.label}
                            </button>
                        `;
                    }).join('')}
                </div>
            `;
        }

        // Determine visible sections based on selection
        let visibleSections = [];
        if (this._borrowedSelectedSectionIds.size === 0) {
            visibleSections = [...allSectionsWithPseudo];
        } else {
            visibleSections = allSectionsWithPseudo.filter(s => this._borrowedSelectedSectionIds.has(s.id));
        }

        // If no sections defined at all, show all chords in a single flat list
        if (allSectionsWithPseudo.length === 0) {
            visibleSections = [{
                id: 'all',
                label: 'All Chords',
                color: '#6366f1',
                chordIndices: progressionData.map((_, i) => i),
                isPseudoSection: true
            }];
        }

        // Build chord chips grouped by section
        const chordChipsHTML = visibleSections.map(section => {
            const sectionColor = section.color || '#9ca3af';
            const chipsHTML = section.chordIndices.map(idx => {
                if (idx >= progressionData.length) return '';
                const chord = progressionData[idx];
                const symbol = getChordSymbol(chord.type);
                const invLabel = getInversionLabel(chord.inversion);
                const isSelected = this._borrowedSelectedProgressionIndex === idx;

                return `
                    <button class="borrowed-chord-chip flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all"
                        data-chord-idx="${idx}"
                        style="background: ${isSelected ? hexToRgba(sectionColor, 0.4) : hexToRgba(sectionColor, 0.18)};
                               color: ${sectionColor};
                               border: 1px solid ${sectionColor};
                               ${isSelected ? 'outline: 2px solid #6366f1; outline-offset: 1px;' : ''}"
                        title="${chord.root} ${chord.type}${chord.inversion ? ' (inv ' + chord.inversion + ')' : ''} — Click to select, hold to play">
                        ${chord.root}${symbol}${invLabel}
                    </button>
                `;
            }).join('');

            // Always show section container with header (even if only one section)
            // This ensures "Ungrouped 1" header is visible like in the unified modal
            return `
                <div class="flex-shrink-0 rounded overflow-hidden border" style="border-color: ${hexToRgba(sectionColor, 0.3)}; background: ${hexToRgba(sectionColor, 0.05)};">
                    <div class="text-[9px] font-semibold text-white px-2 py-1 text-center whitespace-nowrap" style="background: ${sectionColor};">${section.label}</div>
                    <div class="flex items-center gap-0.5 p-1.5">${chipsHTML}</div>
                </div>
            `;
        }).join('');

        // Determine selection text for the info note
        const selectedIdx = this._borrowedSelectedProgressionIndex;
        let selectionText = 'end of progression';
        if (selectedIdx >= 0 && selectedIdx < progressionData.length) {
            const selectedChord = progressionData[selectedIdx];
            const symbol = getChordSymbol(selectedChord.type);
            selectionText = `after ${selectedChord.root}${symbol} (#${selectedIdx + 1})`;
        }

        const isCollapsed = this._borrowedPickerCollapsed;
        const chevronRotation = isCollapsed ? '' : 'rotate-180';
        const collapseLabel = isCollapsed ? 'Show' : 'Hide';

        return `
            <div class="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50">
                <button id="borrowed-picker-toggle" class="w-full px-3 py-1.5 flex items-center justify-between hover:bg-indigo-100/60 transition-colors group">
                    <div class="flex items-center gap-2">
                        <div class="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-100 rounded-full group-hover:bg-indigo-200 transition-colors">
                            <svg class="w-3 h-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                            </svg>
                            <span class="text-[10px] font-semibold text-indigo-700">Insert Position</span>
                        </div>
                        <span class="text-[10px] text-indigo-600 font-medium bg-white/60 px-2 py-0.5 rounded">→ ${selectionText}</span>
                    </div>
                    <div class="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200/60 group-hover:bg-slate-300/60 transition-colors">
                        <span class="text-[9px] text-slate-500 font-medium">${collapseLabel}</span>
                        <svg class="w-3.5 h-3.5 text-slate-500 transition-transform ${chevronRotation}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                        </svg>
                    </div>
                </button>
                <div id="borrowed-picker-content" class="${isCollapsed ? 'hidden' : ''} px-3 pb-2">
                    ${sectionPickerHTML}
                    <div class="flex items-center gap-1.5 overflow-x-auto py-1" style="scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;">
                        ${chordChipsHTML}
                    </div>
                    <div class="text-[10px] text-slate-600 mt-1 italic">Click a chord to insert after it, or leave unselected to add at end</div>
                </div>
            </div>
        `;
    }

    /**
     * Attach event handlers for the borrowed progression picker
     * @param {HTMLElement} container - The panel container
     */
    _attachBorrowedProgressionPickerHandlers(container) {
        const progressionData = getProgressionData() || [];

        // Toggle button for collapsing/expanding the picker
        const toggleBtn = container.querySelector('#borrowed-picker-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this._borrowedPickerCollapsed = !this._borrowedPickerCollapsed;
                this._renderBorrowedPanel(container);
            });
        }

        // Section pill click handlers
        container.querySelectorAll('.borrowed-section-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const sectionId = pill.dataset.sectionId;
                if (sectionId === 'all') {
                    this._borrowedSelectedSectionIds.clear();
                } else {
                    // Toggle section selection
                    if (this._borrowedSelectedSectionIds.has(sectionId)) {
                        this._borrowedSelectedSectionIds.delete(sectionId);
                    } else {
                        this._borrowedSelectedSectionIds.clear();
                        this._borrowedSelectedSectionIds.add(sectionId);
                    }
                }
                this._renderBorrowedPanel(container);
            });
        });

        // Chord chip click and hold handlers
        container.querySelectorAll('.borrowed-chord-chip').forEach(chip => {
            const idx = parseInt(chip.dataset.chordIdx, 10);
            let holdTimeout = null;
            let isHolding = false;
            const HOLD_THRESHOLD = 150;

            const startHold = () => {
                holdTimeout = setTimeout(() => {
                    isHolding = true;
                    chip.style.transform = 'scale(0.95)';
                    chip.style.opacity = '0.85';
                    // Play the chord
                    if (idx >= 0 && idx < progressionData.length) {
                        const chord = progressionData[idx];
                        const piano = window.getPiano?.();
                        if (piano && chord.notes?.length > 0) {
                            piano.triggerAttack(chord.notes);
                        }
                    }
                }, HOLD_THRESHOLD);
            };

            const endHold = () => {
                if (holdTimeout) {
                    clearTimeout(holdTimeout);
                    holdTimeout = null;
                }
                if (isHolding) {
                    isHolding = false;
                    chip.style.transform = '';
                    chip.style.opacity = '';
                    const piano = window.getPiano?.();
                    piano?.releaseAll?.();
                }
            };

            chip.addEventListener('mousedown', startHold);
            chip.addEventListener('mouseup', endHold);
            chip.addEventListener('mouseleave', endHold);
            chip.addEventListener('touchstart', (e) => { e.preventDefault(); startHold(); }, { passive: false });
            chip.addEventListener('touchend', endHold);
            chip.addEventListener('touchcancel', endHold);
            chip.addEventListener('contextmenu', (e) => e.preventDefault());

            chip.addEventListener('click', () => {
                if (isHolding) {
                    endHold();
                    return;
                }
                // Toggle selection: if already selected, deselect (will add at end)
                if (this._borrowedSelectedProgressionIndex === idx) {
                    this._borrowedSelectedProgressionIndex = -1;
                } else {
                    this._borrowedSelectedProgressionIndex = idx;
                }
                this._renderBorrowedPanel(container);
            });

            // Hover effects
            chip.addEventListener('mouseenter', () => {
                if (!isHolding && this._borrowedSelectedProgressionIndex !== idx) {
                    chip.style.transform = 'scale(1.05)';
                    chip.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }
            });
            chip.addEventListener('mouseleave', () => {
                if (!isHolding) {
                    chip.style.transform = '';
                    chip.style.boxShadow = '';
                }
            });
        });
    }

    /**
     * Build chord notes for playback
     */
    _buildBorrowedChordNotes(root, type, inversion = 0) {
        // Intervals: Major = [0, 4, 7], Minor = [0, 3, 7]
        const intervals = type === 'Minor' ? [0, 3, 7] : [0, 4, 7];
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Normalize root (handle flats)
        let rootIdx = noteNames.indexOf(root);
        if (rootIdx === -1) {
            // Handle flats
            const flatMap = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
            rootIdx = noteNames.indexOf(flatMap[root] || root);
        }
        if (rootIdx === -1) rootIdx = 0;

        // Build notes in octave 3 (bass-ish register)
        let notes = intervals.map(interval => {
            const noteIdx = (rootIdx + interval) % 12;
            return noteNames[noteIdx] + '3';
        });

        // Apply inversion
        if (inversion === 1) {
            // Move first note up an octave
            notes[0] = notes[0].replace('3', '4');
            notes = [notes[1], notes[2], notes[0]];
        } else if (inversion === 2) {
            // Move first two notes up an octave
            notes[0] = notes[0].replace('3', '4');
            notes[1] = notes[1].replace('3', '4');
            notes = [notes[2], notes[0], notes[1]];
        }

        return notes;
    }

    /**
     * Add borrowed chord to progression
     */
    _addBorrowedChord(chord, inversion = 0) {
        const compState = getCompositionState();
        if (!compState) {
            console.warn('[Borrowed] No composition state available');
            return;
        }

        // Save state for undo/redo BEFORE making changes
        window.saveStateBeforeChange?.();

        // Get key from trainerState (the single source of truth for current key)
        const key = getCurrentKey() || 'C';

        // Use the quick progression picker's selected index
        // If user selected a chord in the picker, insert after it
        // Otherwise, append to end of progression
        const insertAfterIdx = this._borrowedSelectedProgressionIndex;

        // Build chord data using the app's helper if available
        let chordData = null;
        if (window.getInvertedChordNotes) {
            const result = window.getInvertedChordNotes(
                chord.root,
                chord.type,
                inversion,
                key,
                0,  // octaveShift
                window.getKeyBasedEnharmonic?.() || 'sharp',
                window.getNotationPreference?.() || 'full'
            );
            const roman = window.noteToRomanNumeral?.(chord.root, key, chord.type) || chord.numeral;

            // Get default beats based on time signature
            const ts = compState.metadata?.timeSignature || { num: 4, denom: 4 };
            const defaultBeats = ts.num * (4 / ts.denom);

            chordData = {
                name: result?.name || `${chord.root} ${chord.type}`,
                simpleName: result?.simpleName || chord.root,
                notes: result?.specificNotes || [],
                root: chord.root,
                type: chord.type,
                inversion: inversion || 0,
                selectionMode: 'chord',
                omittedNotes: [],
                octaveShift: 0,
                lhType: 'off',
                lhInversion: 0,
                lhOctaveShift: 0,
                lhNotes: [],
                lhOmittedNotes: [],
                roman: roman,
                beats: defaultBeats
            };
        } else {
            // Fallback: build simple chord data
            const notes = this._buildBorrowedChordNotes(chord.root, chord.type, inversion);
            // Get default beats based on time signature (1 measure worth)
            const ts = compState.metadata?.timeSignature || { num: 4, denom: 4 };
            const fallbackBeats = ts.num * (4 / ts.denom);
            chordData = {
                root: chord.root,
                type: chord.type,
                inversion: inversion,
                beats: fallbackBeats,
                notes: notes,
                roman: chord.numeral,
                name: chord.root + (chord.type === 'Minor' ? 'm' : '')
            };
        }

        if (!chordData) return;

        // Get section info for the selected chord BEFORE insertion
        // This follows the same approach as Quick Add Chord
        let sectionInfo = null;
        if (insertAfterIdx >= 0) {
            sectionInfo = compState.getSectionForChord?.(insertAfterIdx);
        }

        // Calculate insert position: after selected chord, or at end
        const totalChords = compState.getChords?.()?.length || 0;
        const insertAtIndex = insertAfterIdx >= 0 ? insertAfterIdx + 1 : totalChords;

        // Use compositionState.insertChord which handles bass blocks and section updates
        const success = compState.insertChord(insertAtIndex, chordData);

        if (success) {
            // Expand the section to include the new chord if the selected chord was in a section
            // This ensures the new chord stays in the same section as the chord it was inserted after
            if (sectionInfo && sectionInfo.id) {
                const sections = compState.getSections?.() || [];
                const section = sections.find(s => s.id === sectionInfo.id);
                if (section) {
                    const sectionStart = section.startIndex;
                    const sectionEnd = section.startIndex + section.chordCount - 1;
                    // If the inserted chord index is outside the section range, expand to include it
                    if (insertAtIndex < sectionStart || insertAtIndex > sectionEnd) {
                        section.chordCount++;
                    }
                }
            }

            // Sync and refresh the UI
            if (window.syncProgressionToMelodyComposer) {
                window.syncProgressionToMelodyComposer();
            }

            // Batch visual updates in animation frame
            requestAnimationFrame(() => {
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                }
                if (window.renderChordProgression) {
                    window.renderChordProgression();
                }
            });

            // Show feedback
            const chordName = chord.root + (chord.type === 'Minor' ? 'm' : '');
            const posText = insertAfterIdx >= 0 ? `after position ${insertAfterIdx + 1}` : 'at end';
            const sectionText = sectionInfo ? ` in "${sectionInfo.name}"` : '';
            if (window.toast) {
                window.toast.success(`Added ${chord.numeral} (${chordName}) ${posText}${sectionText}`);
            }

            // Update the selected progression index to the newly added chord
            // so subsequent adds go after this one
            this._borrowedSelectedProgressionIndex = insertAtIndex;

            // Re-render the panel to update the quick progression picker
            this._renderBorrowedPanel(container);

            // Play camera shutter sound if available
            try {
                const shutter = window.getCameraShutter?.();
                if (shutter && typeof shutter.triggerAttackRelease === 'function') {
                    shutter.triggerAttackRelease('C4', '16n');
                }
            } catch (e) {
                // Silently ignore shutter sound errors
            }
        } else {
            if (window.toast) {
                window.toast.error('Failed to add chord');
            }
        }
    }

    _renderTheoryPanel(container) {
        const compState = getCompositionState();
        // Get key from trainerState (the single source of truth for current key)
        const rawKey = getCurrentKey() || 'C';
        const mode = compState?.getSettings?.()?.mode || 'major';
        // Handle keys that already have 'm' suffix (e.g., "Bbm" should display as "Bb Minor", not "Bbm Major")
        const keyEndsWithMinor = rawKey.endsWith('m') && rawKey.length > 1 && !rawKey.endsWith('dim');
        const key = keyEndsWithMinor ? rawKey.slice(0, -1) : rawKey;
        const keyDisplay = keyEndsWithMinor
            ? `${key} Minor`
            : `${rawKey} ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;

        // Get progression data for analysis
        const progressionData = compState?.exportToProgressionData?.() || [];
        const chords = this._getChords(compState);

        // Run pattern detection
        let analysisData = null;
        if (progressionData.length >= 2) {
            analysisData = this._analyzeProgression(progressionData, key);
        }

        container.innerHTML = `
            <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 border-b border-yellow-600">
                <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Theory Insights</span>
                <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="p-2 overflow-y-auto" style="height: calc(100% - 40px);">
                <div class="text-[10px] text-gray-500 mb-1.5">Key: ${keyDisplay} • ${chords.length} chord${chords.length !== 1 ? 's' : ''}</div>
                <div id="fs-theory-content" class="space-y-1.5">
                    ${chords.length < 2
                        ? '<div class="text-gray-400 text-sm text-center py-4">Add at least 2 chords to see theory analysis</div>'
                        : this._generateTheoryInsights(analysisData, chords, key)
                    }
                </div>
            </div>
        `;

        // Close button handler
        container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
            this.closeActivePanel();
        });
    }

    /**
     * Analyze the progression using pattern detection
     */
    _analyzeProgression(progressionData, key) {
        try {
            // Run pattern detection
            const patterns = detectAllPatterns(progressionData, key);
            const topPatterns = getTopPatterns(patterns, 8); // Get top 8 patterns

            // Use HarmonyAnalyzer for named progressions
            const harmonyAnalyzer = new HarmonyAnalyzer();
            const namedProgressions = harmonyAnalyzer.detectCommonPatterns(progressionData, key);

            // Get harmonic rhythm analysis
            const harmonicRhythm = this._analyzeHarmonicRhythm(progressionData);

            // Analyze chord function distribution
            const functionAnalysis = this._analyzeChordFunctions(progressionData, key);

            // Get coach engine insights (progression-wide observations, suggestions, opportunities)
            const coachInsights = this._getCoachInsights(progressionData, key);

            return {
                topPatterns,
                namedProgressions,
                harmonicRhythm,
                functionAnalysis,
                coachInsights,
                chordCount: progressionData.length
            };
        } catch (e) {
            console.warn('[Theory] Analysis error:', e);
            return null;
        }
    }

    /**
     * Analyze harmonic rhythm (how often chords change)
     */
    _analyzeHarmonicRhythm(progressionData) {
        if (!progressionData || progressionData.length === 0) return null;

        const beatDurations = progressionData.map(c => c.beats || 4);
        const totalBeats = beatDurations.reduce((a, b) => a + b, 0);
        const avgBeats = totalBeats / progressionData.length;

        let rhythmType = 'moderate';
        let description = '';

        if (avgBeats <= 2) {
            rhythmType = 'fast';
            description = 'Quick harmonic changes create energy and momentum';
        } else if (avgBeats <= 4) {
            rhythmType = 'moderate';
            description = 'Balanced pacing allows melodies to breathe';
        } else {
            rhythmType = 'slow';
            description = 'Extended harmonies create space for development';
        }

        return { avgBeats, rhythmType, description, totalBeats };
    }

    /**
     * Analyze chord function distribution (tonic, subdominant, dominant)
     */
    _analyzeChordFunctions(progressionData, key) {
        const functions = { tonic: 0, subdominant: 0, dominant: 0, chromatic: 0 };
        const harmonyAnalyzer = new HarmonyAnalyzer();

        progressionData.forEach(chord => {
            const roman = harmonyAnalyzer.getRomanNumeral(chord, key);
            const upperRoman = roman?.toUpperCase().replace(/[^IViv]/g, '') || '';

            if (['I', 'VI', 'III'].includes(upperRoman)) {
                functions.tonic++;
            } else if (['IV', 'II'].includes(upperRoman)) {
                functions.subdominant++;
            } else if (['V', 'VII'].includes(upperRoman)) {
                functions.dominant++;
            } else {
                functions.chromatic++;
            }
        });

        const total = progressionData.length;
        return {
            tonic: Math.round((functions.tonic / total) * 100),
            subdominant: Math.round((functions.subdominant / total) * 100),
            dominant: Math.round((functions.dominant / total) * 100),
            chromatic: Math.round((functions.chromatic / total) * 100)
        };
    }

    /**
     * Get coach engine insights (observations, suggestions, opportunities)
     * Filters to only progression-wide items (not chord-specific)
     */
    _getCoachInsights(progressionData, key) {
        if (!progressionData || progressionData.length < 2) {
            return { observations: [], suggestions: [], opportunities: [] };
        }

        try {
            // Build context for coach engine
            const context = {
                progression: progressionData,
                key: key,
                mode: key?.endsWith('m') && !key?.endsWith('dim') ? 'minor' : 'major'
            };

            // Run all detectors, generators, and scanners
            const allObservations = detectAllObservations(context);
            const allSuggestions = generateAllSuggestions(context);
            const allOpportunities = scanAllOpportunities(context);

            // Filter to progression-wide items for Theory Panel display
            //
            // These are patterns that describe the OVERALL progression character,
            // not just what happens at a specific chord. Chord-specific items
            // (cadences, borrowed chords, secondary dominants, etc.) show on
            // chord badges when clicked; these provide a summary view.
            //
            // OBSERVATIONS that describe progression-wide patterns:
            const progressionWideObservations = [
                // Sequences spanning multiple chords
                'circle-of-fifths',       // e.g., Am → Dm → G → C
                'harmonic-sequence',      // Repeated interval patterns
                'ostinato-pattern',       // Repetition patterns
                'palindromic-progression', // Symmetrical progressions
                // Voice leading & texture assessments (overall quality)
                'smooth-voice-leading',   // Overall VL quality score
                'chromatic-bass-line',    // Bass line spanning multiple chords
                'chromatic-voice-motion', // Voice motion across progression
                'pedal-point',            // Sustained note across chords
                // Tension arc (describes overall shape)
                'tension-climax'          // Peak tension point
                // NOTE: The following are CHORD-SPECIFIC and show on chord badges:
                // - parallel-harmony (shows on chords involved in parallel motion)
                // - retrogression (shows on the chord where backwards motion occurs)
                // - dorian-pattern, mixolydian-pattern (shows on the modal chord pair)
                // - chromatic-mediant (shows on the mediant chord)
                // - tritone-substitution (shows on the substituted chord)
                // - chromatic-dominant-approach (shows on the approaching chord)
                // - harmonic-rhythm-change (shows on chord where rhythm changes)
            ];

            // SUGGESTIONS that apply to the whole progression:
            const progressionWideSuggestions = [
                'vary-harmonic-rhythm'
            ];

            // OPPORTUNITIES (all are progression-wide by nature):
            const progressionWideOpportunities = [
                'no-borrowed-chords', 'no-cadence', 'no-secondary-dominants',
                'flat-tension', 'bass-always-root', 'no-extensions', 'function-imbalance'
            ];

            const progressionWideIds = [
                ...progressionWideObservations,
                ...progressionWideSuggestions,
                ...progressionWideOpportunities
            ];

            const isProgressionWide = (item) => {
                // Items explicitly marked as progression-wide by ID
                if (progressionWideIds.includes(item.id)) return true;
                // Opportunities are always progression-wide
                if (item.type === COACH_ITEM_TYPES.OPPORTUNITY) return true;
                return false;
            };

            return {
                observations: allObservations.filter(isProgressionWide),
                suggestions: allSuggestions.filter(isProgressionWide),
                opportunities: allOpportunities // All opportunities are progression-wide
            };
        } catch (e) {
            console.warn('[Theory] Coach insights error:', e);
            return { observations: [], suggestions: [], opportunities: [] };
        }
    }

    _generateTheoryInsights(analysisData, chords, key) {
        if (!analysisData) {
            return `
                <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                    <div class="text-sm text-gray-500">Keep adding chords to unlock insights!</div>
                </div>
            `;
        }

        let html = '';

        // Named Progressions Section
        if (analysisData.namedProgressions && analysisData.namedProgressions.length > 0) {
            html += `
                <div class="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-2">
                    <div class="flex items-center gap-1.5 mb-1.5">
                        <span class="text-sm">🎼</span>
                        <span class="font-semibold text-purple-800 text-xs">Named Progressions</span>
                    </div>
                    <div class="space-y-1">
                        ${analysisData.namedProgressions.slice(0, 3).map(prog => `
                            <div class="bg-white/60 rounded px-2 py-1">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="font-medium text-purple-700 text-xs">${prog.name || prog.pattern}</span>
                                    ${prog.matches ? `<span class="text-[10px] text-purple-400">m.${prog.matches[0] + 1}</span>` : ''}
                                    ${prog.pattern ? `<span class="text-[10px] text-purple-500 font-mono">${prog.pattern.join('-')}</span>` : ''}
                                </div>
                                ${prog.description ? `<div class="text-[10px] text-purple-600/80 mt-0.5 leading-tight">${prog.description}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Detected Patterns Section
        if (analysisData.topPatterns && analysisData.topPatterns.length > 0) {
            html += `
                <div class="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-2">
                    <div class="flex items-center gap-1.5 mb-1">
                        <span class="text-sm">🔍</span>
                        <span class="font-semibold text-amber-800 text-xs">Detected Patterns</span>
                    </div>
                    <div class="space-y-0.5">
                        ${analysisData.topPatterns.slice(0, 5).map(pattern => {
                            const category = PATTERN_CATEGORIES[pattern.category];
                            const color = category?.color || '#6b7280';
                            const icon = category?.icon || '•';
                            const displayName = pattern.fullName || pattern.name || pattern.type;

                            return `
                                <div class="flex items-start gap-1.5 bg-white/60 rounded px-2 py-1">
                                    <span class="text-xs leading-none mt-0.5">${icon}</span>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-1.5 flex-wrap">
                                            <span class="font-medium text-xs" style="color: ${color}">${displayName}</span>
                                            ${pattern.positions ? `<span class="text-[10px] text-gray-400">m.${pattern.positions[0] + 1}</span>` : ''}
                                        </div>
                                        ${pattern.description ? `<div class="text-[10px] text-gray-500 leading-tight truncate">${pattern.description}</div>` : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        // Harmonic Rhythm Analysis
        if (analysisData.harmonicRhythm) {
            const hr = analysisData.harmonicRhythm;
            const rhythmColors = {
                fast: { bg: 'from-red-50 to-orange-50', border: 'border-red-200', text: 'text-red-700', icon: '⚡' },
                moderate: { bg: 'from-green-50 to-emerald-50', border: 'border-green-200', text: 'text-green-700', icon: '🎵' },
                slow: { bg: 'from-blue-50 to-cyan-50', border: 'border-blue-200', text: 'text-blue-700', icon: '🌊' }
            };
            const colors = rhythmColors[hr.rhythmType];

            html += `
                <div class="bg-gradient-to-r ${colors.bg} border ${colors.border} rounded-lg p-2">
                    <div class="flex items-center gap-1.5">
                        <span class="text-sm">${colors.icon}</span>
                        <span class="font-semibold ${colors.text} text-xs">Harmonic Rhythm: ${hr.rhythmType.charAt(0).toUpperCase() + hr.rhythmType.slice(1)}</span>
                        <span class="text-[10px] text-gray-400 ml-auto">${hr.avgBeats.toFixed(1)} beats/chord</span>
                    </div>
                    <div class="text-[10px] text-gray-600 mt-0.5">${hr.description}</div>
                </div>
            `;
        }

        // Chord Function Distribution
        if (analysisData.functionAnalysis) {
            const fa = analysisData.functionAnalysis;
            html += `
                <div class="bg-gradient-to-r from-slate-50 to-gray-50 border border-slate-200 rounded-lg p-2">
                    <div class="flex items-center gap-1.5 mb-1">
                        <span class="text-sm">📊</span>
                        <span class="font-semibold text-slate-700 text-xs">Harmonic Function Balance</span>
                    </div>
                    <div class="flex gap-0.5 h-3 rounded-full overflow-hidden bg-gray-200">
                        ${fa.tonic > 0 ? `<div class="bg-blue-500" style="width: ${fa.tonic}%" title="Tonic ${fa.tonic}%"></div>` : ''}
                        ${fa.subdominant > 0 ? `<div class="bg-amber-500" style="width: ${fa.subdominant}%" title="Subdominant ${fa.subdominant}%"></div>` : ''}
                        ${fa.dominant > 0 ? `<div class="bg-red-500" style="width: ${fa.dominant}%" title="Dominant ${fa.dominant}%"></div>` : ''}
                        ${fa.chromatic > 0 ? `<div class="bg-purple-500" style="width: ${fa.chromatic}%" title="Chromatic ${fa.chromatic}%"></div>` : ''}
                    </div>
                    <div class="flex justify-between text-[9px] text-gray-500 mt-0.5">
                        <span class="flex items-center gap-0.5"><span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>T ${fa.tonic}%</span>
                        <span class="flex items-center gap-0.5"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>S ${fa.subdominant}%</span>
                        <span class="flex items-center gap-0.5"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>D ${fa.dominant}%</span>
                        ${fa.chromatic > 0 ? `<span class="flex items-center gap-0.5"><span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>C ${fa.chromatic}%</span>` : ''}
                    </div>
                </div>
            `;
        }

        // Coach Insights Section (progression-wide observations and suggestions from coach engine)
        if (analysisData.coachInsights) {
            const { observations, suggestions, opportunities } = analysisData.coachInsights;
            const allInsights = [...observations, ...suggestions, ...opportunities];

            if (allInsights.length > 0) {
                html += `
                    <div class="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-2">
                        <div class="flex items-center gap-1.5 mb-1.5">
                            <span class="text-sm">🎓</span>
                            <span class="font-semibold text-indigo-800 text-xs">Coach Insights</span>
                        </div>
                        <div class="space-y-1.5">
                            ${allInsights.slice(0, 5).map(insight => this._renderCoachInsight(insight)).join('')}
                        </div>
                    </div>
                `;
            }
        }

        // Composition Tips based on analysis
        const tips = this._generateCompositionTips(analysisData, chords, key);
        if (tips.length > 0) {
            html += `
                <div class="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-2">
                    <div class="flex items-center gap-1.5 mb-1">
                        <span class="text-sm">💡</span>
                        <span class="font-semibold text-emerald-800 text-xs">Suggestions</span>
                    </div>
                    <div class="space-y-0.5">
                        ${tips.map(tip => `
                            <div class="text-[10px] text-emerald-700 flex items-start gap-1">
                                <span class="text-emerald-500">→</span>
                                <span>${tip}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        return html || `
            <div class="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center">
                <div class="text-sm text-gray-500">Analysis complete - add more chords for deeper insights!</div>
            </div>
        `;
    }

    /**
     * Generate composition tips based on analysis
     */
    _generateCompositionTips(analysisData, chords, key) {
        const tips = [];
        const fa = analysisData.functionAnalysis;
        const hr = analysisData.harmonicRhythm;

        // Balance suggestions
        if (fa.dominant < 15 && chords.length >= 4) {
            tips.push('Consider adding a V chord for stronger resolution');
        }
        if (fa.tonic > 60) {
            tips.push('Try varying chord functions - your progression is tonic-heavy');
        }
        if (fa.chromatic > 30) {
            tips.push('Great chromatic color! Consider resolving to diatonic chords for contrast');
        }

        // Rhythm suggestions
        if (hr.rhythmType === 'fast' && chords.length > 8) {
            tips.push('Consider longer chord durations to let harmonies breathe');
        }
        if (hr.rhythmType === 'slow' && chords.length < 4) {
            tips.push('Try adding more harmonic movement for interest');
        }

        // Pattern-based suggestions
        if (!analysisData.namedProgressions || analysisData.namedProgressions.length === 0) {
            if (chords.length >= 4) {
                tips.push('Try a classic ii-V-I or I-V-vi-IV progression for familiarity');
            }
        }

        // Check for lack of cadences
        const hasCadence = analysisData.topPatterns?.some(p =>
            ['PAC', 'HC', 'DC', 'PC'].includes(p.type)
        );
        if (!hasCadence && chords.length >= 3) {
            tips.push('End phrases with a cadence (V→I or IV→I) for closure');
        }

        return tips.slice(0, 3); // Limit to 3 tips
    }

    /**
     * Render a single coach insight item
     */
    _renderCoachInsight(insight) {
        // Get the message for simple skill level (or fallback)
        let message = '';
        if (typeof insight.message === 'object') {
            message = insight.message.simple || insight.message.intermediate || 'Interesting pattern detected!';
        } else if (typeof insight.message === 'string') {
            message = insight.message;
        }

        // Interpolate data placeholders
        if (insight.data && typeof message === 'string') {
            message = message.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                return insight.data[key] !== undefined ? insight.data[key] : match;
            });
        }

        // Extract location information from insight data
        const locationInfo = this._getInsightLocation(insight);

        // Determine styling based on type
        const typeStyles = {
            [COACH_ITEM_TYPES.OBSERVATION]: {
                bg: 'bg-emerald-100/60',
                border: 'border-emerald-300',
                text: 'text-emerald-800',
                label: 'Noticed',
                labelBg: 'bg-emerald-500'
            },
            [COACH_ITEM_TYPES.SUGGESTION]: {
                bg: 'bg-purple-100/60',
                border: 'border-purple-300',
                text: 'text-purple-800',
                label: 'Try This',
                labelBg: 'bg-purple-500'
            },
            [COACH_ITEM_TYPES.OPPORTUNITY]: {
                bg: 'bg-amber-100/60',
                border: 'border-amber-300',
                text: 'text-amber-800',
                label: 'Explore',
                labelBg: 'bg-amber-500'
            }
        };

        const style = typeStyles[insight.type] || typeStyles[COACH_ITEM_TYPES.OBSERVATION];
        const emoji = insight.emoji || '💡';
        const title = insight.title || 'Insight';

        return `
            <div class="${style.bg} border ${style.border} rounded px-2 py-1.5">
                <div class="flex items-start gap-1.5">
                    <span class="text-sm leading-none">${emoji}</span>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="font-medium text-xs ${style.text}">${title}</span>
                            <span class="text-[8px] px-1.5 py-0.5 rounded-full text-white ${style.labelBg}">${style.label}</span>
                            ${locationInfo ? `<span class="text-[9px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-mono">${locationInfo}</span>` : ''}
                        </div>
                        <div class="text-[10px] ${style.text} opacity-80 leading-tight mt-0.5">${message}</div>
                        ${insight.data?.suggestion ? `
                            <div class="text-[10px] ${style.text} opacity-70 italic mt-0.5">💡 ${insight.data.suggestion}</div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Extract location information from insight data for display
     * @param {Object} insight - Coach insight item
     * @returns {string|null} Human-readable location string or null
     */
    _getInsightLocation(insight) {
        const data = insight?.data;
        if (!data) return null;

        // For tension climax - use the position field if available, or build from peakIndex
        if (data.position) {
            return data.position;
        }

        // For patterns with a peak index (tension climax)
        if (typeof data.peakIndex === 'number') {
            const chordInfo = data.peakChord ? ` (${data.peakChord})` : '';
            return `chord ${data.peakIndex + 1}${chordInfo}`;
        }

        // For patterns with a start index (sequences, pedal points, chromatic bass, parallel harmony)
        if (typeof data.startIndex === 'number') {
            const endIndex = data.endIndex ?? data.startIndex;
            if (endIndex > data.startIndex) {
                return `chords ${data.startIndex + 1}-${endIndex + 1}`;
            }
            return `chord ${data.startIndex + 1}`;
        }

        // For patterns with a single chord index
        if (typeof data.chordIndex === 'number') {
            return `chord ${data.chordIndex + 1}`;
        }

        // For patterns with chord indices array
        if (Array.isArray(data.chordIndices) && data.chordIndices.length > 0) {
            if (data.chordIndices.length === 1) {
                return `chord ${data.chordIndices[0] + 1}`;
            }
            const first = data.chordIndices[0] + 1;
            const last = data.chordIndices[data.chordIndices.length - 1] + 1;
            return `chords ${first}-${last}`;
        }

        return null;
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    _getChords(compState) {
        const segments = compState?.getChordSegments?.() || [];
        return segments.map(seg => seg.chord).filter(Boolean);
    }

    /**
     * Transpose a note by semitones, using flats for borrowed chord naming
     * (bVII, bVI, bIII use flat spelling: Bb, Ab, Eb, not A#, G#, D#)
     */
    _transposeNote(note, semitones) {
        // Use flats for borrowed chords (more musically correct for flat-based Roman numerals)
        const notesWithFlats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        const notesWithSharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Find the index - handle both sharps and flats in input
        let idx = notesWithSharps.indexOf(note);
        if (idx === -1) {
            idx = notesWithFlats.indexOf(note);
        }
        if (idx === -1) {
            // Try to normalize (e.g., "Cb" -> B)
            const flatToSharp = { 'Cb': 'B', 'Fb': 'E', 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
            const normalized = flatToSharp[note];
            if (normalized) idx = notesWithSharps.indexOf(normalized);
        }
        if (idx === -1) return note;

        // Return with flat spelling (more appropriate for borrowed chords)
        return notesWithFlats[(idx + semitones) % 12];
    }

    _loadFromStorage(key, defaultValue) {
        try {
            const stored = localStorage.getItem(key);
            if (stored === null) return defaultValue;
            return stored;
        } catch {
            return defaultValue;
        }
    }

    _saveToStorage(key, value) {
        try {
            localStorage.setItem(key, String(value));
        } catch (e) {
            console.warn('FullScreenBottomPanel: Storage error', e);
        }
    }
}
