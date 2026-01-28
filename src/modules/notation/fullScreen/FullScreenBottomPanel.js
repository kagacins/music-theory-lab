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
import { suggestPatternContinuation } from '../../analysis/patternDetection.js';
import { HarmonyAnalyzer } from '../../analysis/harmonyAnalyzer.js';
import { renderAmbientTensionStrip } from '../../ui/AmbientTensionStrip.js';
import { renderBassMotionIndicators } from '../../ui/BassMotionIndicators.js';
import { FUNCTION_LEGEND, getHarmonicFunctionFromRoman, shouldShowFunctionColors } from '../../ui/chordFunctionLegend.js';
import { getExperienceMode } from '../../state/globalState.js';
import { showConfirmModal } from '../../ui/modals.js';
import { buildSectionsWithUngrouped } from '../../ui/recommendations/UnifiedRecommendationModal/ProgressionHelpers.js';
import { hexToRgba } from '../../ui/recommendations/UnifiedRecommendationModal/MusicUtils.js';
import { renderWorkbenchPanel } from './panels/WorkbenchPanel.js';
import { renderVoiceLeadingPanel, renderVoiceLeadingDiagram } from './panels/VoiceLeadingPanel.js';
import { renderTheoryPanel } from './panels/TheoryPanel.js';
import { renderBorrowedPanel } from './panels/BorrowedPanel.js';
import { renderQuickAddPanel } from './panels/QuickAddPanel.js';
import { renderAutoBassPanel } from './panels/AutoBassPanel.js';

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
    'voice-leading': 380,  // Taller panel for better diagram visibility
    'borrowed': 400,  // Taller to fit borrowed chord list, detail section, and progression picker
    'theory': 380  // Increased to show pattern detection, harmony analysis, and suggestions
};

const DOCK_BUTTONS = [
    { id: 'workbench', label: 'Workbench', icon: '🧪', color: 'from-indigo-500 to-purple-500' },
    { id: 'chords', label: 'Chord Progression', icon: '🎵', color: 'from-purple-500 to-indigo-500' },
    { id: 'quick-add', label: 'Quick Add', icon: '➕', color: 'from-lime-700 to-lime-800' },
    { id: 'auto-bass', label: 'Auto-Bass', icon: '🎸', color: 'from-amber-600 to-amber-500' },
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

        // Listen for section and chord structure changes to re-render chord panels
        const compState = getCompositionState();
        if (compState?.events) {
            const structureEvents = [
                'sectionCreated', 'sectionUpdated', 'sectionDeleted',
                'sectionDuplicated', 'sectionsReordered', 'sectionsReorderedByIds',
                'chordAddedToSection', 'chordRemovedFromSection',
                'sectionChordsReordered', 'sectionsUpdatedAfterDelete',
                'sectionsUpdatedAfterInsert', 'sectionsUpdatedAfterReorder',
                'chordInserted', 'chordRemoved'  // Chord structure changes
            ];
            structureEvents.forEach(eventName => {
                compState.events.on(eventName, () => {
                    // Re-render panels that show chord cards when structure changes
                    if (this.activePanel === 'chords' || this.activePanel === 'quick-add' || this.activePanel === 'auto-bass') {
                        this._renderPanelContent();
                        // Update selection visuals after re-render (for paste highlighting)
                        setTimeout(() => {
                            if (window.updateMultiSelectVisuals) {
                                window.updateMultiSelectVisuals();
                            }
                        }, 0);
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
        // Delegated to extracted WorkbenchPanel module
        renderWorkbenchPanel(container, {
            onClose: () => this.closeActivePanel()
        });
    }

    _renderChordsPanel(container) {
        // Save scroll position before re-rendering (container may be recreated)
        const existingCardsContainer = container.querySelector('#fs-chord-cards-container');
        const savedScrollLeft = existingCardsContainer?.scrollLeft || 0;

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

        // Scroll handling - center on selected chords (after paste) or restore position
        if (cardsContainer) {
            cardsContainer.style.scrollBehavior = 'auto';

            // Check if there are selected chords (e.g., after paste)
            const selectedIndices = window.getSelectedChordIndicesArray?.() || [];
            if (selectedIndices.length > 0) {
                // Scroll to center the first selected chord in the visible area
                const firstSelectedIndex = Math.min(...selectedIndices);
                const targetCard = cardsContainer.querySelector(`[data-chord-index="${firstSelectedIndex}"]`);
                if (targetCard) {
                    const containerWidth = cardsContainer.clientWidth;
                    const cardWidth = targetCard.offsetWidth;
                    // offsetLeft is the card's left edge relative to the scrollable content
                    // To center: scroll so card's center aligns with container's center
                    const cardCenter = targetCard.offsetLeft + (cardWidth / 2);
                    const scrollTo = cardCenter - (containerWidth / 2);
                    cardsContainer.scrollLeft = Math.max(0, scrollTo);
                }
            } else if (savedScrollLeft > 0) {
                // No selection, restore saved scroll position
                cardsContainer.scrollLeft = savedScrollLeft;
            }

            // Re-enable smooth scrolling after a microtask
            queueMicrotask(() => {
                cardsContainer.style.scrollBehavior = 'smooth';
            });
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
                    <div class="text-[9px] font-semibold text-white px-2 py-1 text-center whitespace-nowrap" style="background: ${sectionColor}; -webkit-text-fill-color: white;">${section.label}</div>
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
                        <div class="text-[8px] font-semibold text-white px-2 py-0.5 text-center whitespace-nowrap" style="background: ${accentColor}; -webkit-text-fill-color: white;">
                            ${suggestion.pattern || 'Continue'}
                        </div>
                        <div class="flex items-center justify-center gap-1 p-1.5">
                            <span class="text-[11px] font-bold" style="color: ${accentColor}; -webkit-text-fill-color: ${accentColor};">${displayName}${invText}</span>
                            <span class="text-[9px]" style="color: ${accentColor}; -webkit-text-fill-color: ${accentColor};">+</span>
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

    /**
     * Helper: Convert a chromatic index (0-11) to a properly spelled note name for the current key.
     * Uses flat spellings for flat keys (F, Bb, Eb, Ab, Db, Gb, Dm, Gm, Cm, Fm, Bbm, Ebm)
     * Uses sharp spellings for sharp keys (G, D, A, E, B, F#, Em, Bm, F#m, C#m, G#m)
     *
     * This fixes the bug where chords like Ab in G minor were being spelled as G#.
     *
     * @param {number} index - Chromatic index (0=C, 1=C#/Db, 2=D, etc.)
     * @param {string} key - Current key (e.g., 'C', 'Gm', 'F#')
     * @returns {string} Properly spelled note name
     */
    _getRootNameForKey(index, key) {
        const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

        // Get the enharmonic preference for this key
        const preference = window.getEnharmonicPreferenceForKey?.(key) ||
            (window.getKeyBasedEnharmonic?.() === 'flat' ? 'flat' : 'sharp');

        const notes = preference === 'flat' ? FLAT_NOTES : SHARP_NOTES;
        return notes[index % 12];
    }

    _renderQuickAddPanel(container) {
        // Initialize state if not present
        if (!this._quickAddViewMode) {
            this._quickAddViewMode = 'scroll';
        }
        if (!this._quickAddSelectedSectionIds) {
            this._quickAddSelectedSectionIds = new Set();
        }
        if (!this._quickAddCompactSectionIds) {
            this._quickAddCompactSectionIds = new Set();
        }

        renderQuickAddPanel(container, {
            onClose: () => this.closeActivePanel(),
            spellNoteInKey: (note, key) => this._spellNoteInKey(note, key),
            getRootNameForKey: (index, key) => this._getRootNameForKey(index, key),
            onRerender: () => {
                const panelContent = this.container?.querySelector('.fs-panel-content');
                if (panelContent) {
                    this._renderQuickAddPanel(panelContent);
                }
            },
            createFSChordCardWrapper: (chord, index, key) => this._createFSChordCardWrapper(chord, index, key),
            createFSPatternGhostCard: (chords, key) => this._createFSPatternGhostCard(chords, key),
            renderCompactProgressionView: (idPrefix, options) => this._renderCompactProgressionView(idPrefix, options),
            attachCompactProgressionHandlers: (containerEl, idPrefix, handlers, sectionIds) =>
                this._attachCompactProgressionHandlers(containerEl, idPrefix, handlers, sectionIds),
            addSuggestedChord: (suggestion, key) => this._addSuggestedChord(suggestion, key),
            hexToRgba: (hex, alpha) => this._hexToRgba(hex, alpha)
        }, {
            viewMode: this._quickAddViewMode,
            compactView: this._quickAddCompactView,
            selectedSectionIds: this._quickAddSelectedSectionIds,
            compactSectionIds: this._quickAddCompactSectionIds,
            setViewMode: (mode) => { this._quickAddViewMode = mode; },
            setCompactView: (compact) => { this._quickAddCompactView = compact; }
        });
    }

    // NOTE: The following QuickAdd methods have been extracted to panels/QuickAddPanel.js:
    // _updateQuickAddInsertIndicator, _handleQuickAddChord, _handleQuickAddNC,
    // _renderQuickAddSectionPicker, _renderQuickAddScrollViewCards, _renderQuickAddSectionViewCards,
    // _createQuickAddSectionContainer, _createQuickAddChordCard, _populateScaleDropdown, _populateChordTypeDropdown
    // See renderQuickAddPanel() delegation above.


    _renderAutoBassPanel(container) {
        // Initialize state if not present
        if (!this._autoBassViewMode) {
            this._autoBassViewMode = 'scroll';
        }
        if (!this._autoBassSelectedSectionIds) {
            this._autoBassSelectedSectionIds = new Set();
        }
        if (!this._autoBassCompactSectionIds) {
            this._autoBassCompactSectionIds = new Set();
        }

        renderAutoBassPanel(container, {
            onClose: () => this.closeActivePanel(),
            onRerender: () => {
                const panelContent = this.container?.querySelector('.fs-panel-content');
                if (panelContent) {
                    this._renderAutoBassPanel(panelContent);
                }
            },
            createFSChordCardWrapper: (chord, index, key) => this._createFSChordCardWrapper(chord, index, key),
            createFSPatternGhostCard: (chords, key) => this._createFSPatternGhostCard(chords, key),
            renderCompactProgressionView: (idPrefix, options) => this._renderCompactProgressionView(idPrefix, options),
            attachCompactProgressionHandlers: (containerEl, idPrefix, handlers, sectionIds) =>
                this._attachCompactProgressionHandlers(containerEl, idPrefix, handlers, sectionIds),
            addSuggestedChord: (suggestion, key) => this._addSuggestedChord(suggestion, key),
            getContainer: () => this.container
        }, {
            viewMode: this._autoBassViewMode,
            compactView: this._autoBassCompactView,
            selectedSectionIds: this._autoBassSelectedSectionIds,
            compactSectionIds: this._autoBassCompactSectionIds,
            setViewMode: (mode) => { this._autoBassViewMode = mode; },
            setCompactView: (compact) => { this._autoBassCompactView = compact; }
        });
    }

    // NOTE: The following AutoBass methods have been extracted to panels/AutoBassPanel.js:
    // _renderAutoBassSectionPicker, _renderAutoBassScrollViewCards, _renderAutoBassSectionViewCards,
    // _createAutoBassSectionContainer, _createAutoBassChordCard, _updateApplyToSelectedButton
    // See renderAutoBassPanel() delegation above.

    _renderVoiceLeadingPanel(container) {
        // Delegated to extracted VoiceLeadingPanel module
        // Initialize vlState if not present (state persists across panel toggles)
        if (!this._vlState) {
            this._vlState = {
                mode: localStorage.getItem('fs-vl-mode') || 'smooth',
                showWarningsOnly: localStorage.getItem('fs-vl-warnings-only') === 'true',
                showNewDropped: localStorage.getItem('fs-vl-show-new-dropped') !== 'false'
            };
        }

        renderVoiceLeadingPanel(container, {
            onClose: () => this.closeActivePanel(),
            getContainer: () => this.container,
            vlState: this._vlState
        });
    }

    _renderBorrowedPanel(container) {
        renderBorrowedPanel(container, {
            onClose: () => this.closeActivePanel(),
            transposeNote: (note, semitones) => this._transposeNote(note, semitones),
            getRootNameForKey: (index, key) => this._getRootNameForKey(index, key),
            onRerender: () => {
                const panelContent = this.container?.querySelector('.fs-panel-content');
                if (panelContent) {
                    this._renderBorrowedPanel(panelContent);
                }
            }
        }, {
            selectedChord: this._selectedBorrowedChord,
            inversion: this._borrowedChordInversion,
            selectedProgressionIndex: this._borrowedSelectedProgressionIndex,
            selectedSectionIds: this._borrowedSelectedSectionIds,
            pickerCollapsed: this._borrowedPickerCollapsed,
            setSelectedChord: (chord) => { this._selectedBorrowedChord = chord; },
            setInversion: (inv) => { this._borrowedChordInversion = inv; },
            setSelectedProgressionIndex: (idx) => { this._borrowedSelectedProgressionIndex = idx; },
            setSelectedSectionIds: (ids) => { this._borrowedSelectedSectionIds = ids; },
            setPickerCollapsed: (collapsed) => { this._borrowedPickerCollapsed = collapsed; }
        });
    }

    _renderTheoryPanel(container) {
        renderTheoryPanel(container, {
            onClose: () => this.closeActivePanel(),
            getChords: (compState) => this._getChords(compState)
        });
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
