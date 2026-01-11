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
import {
    SCALE_DEFINITIONS,
    SCALE_CATEGORIES,
    CHORD_DEFINITIONS
} from '../../../data/music-data.js';
import { isChordInScale } from '../../features/chordBuilder.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
    ACTIVE_PANEL: 'fs-dock-active-panel',
    VIEW_MODE: 'fs-dock-view-mode'
};

const DOCK_HEIGHT = 44; // Height of the dock bar
const PANEL_HEIGHTS = {
    'workbench': 240,  // Song Workbench - 3 column layout (taller for better spacing)
    'chords': 340,  // 75% larger to show full chord cards with section picker bar in section view
    'quick-add': 195,
    'auto-bass': 200,
    'voice-leading': 320,  // Increased to accommodate legend, filter controls, and fix suggestions
    'borrowed': 200,
    'theory': 220
};

const DOCK_BUTTONS = [
    { id: 'workbench', label: 'Workbench', icon: '🧪', color: 'from-violet-500 to-indigo-500' },
    { id: 'chords', label: 'Chord Progression', icon: '🎵', color: 'from-purple-500 to-indigo-500' },
    { id: 'quick-add', label: 'Quick Add', icon: '➕', color: 'from-green-500 to-emerald-500' },
    { id: 'auto-bass', label: 'Auto-Bass', icon: '🎸', color: 'from-amber-500 to-orange-500' },
    { id: 'voice-leading', label: 'Voice Leading', icon: '📊', color: 'from-blue-500 to-cyan-500' },
    { id: 'borrowed', label: 'Borrowed', icon: '🔄', color: 'from-pink-500 to-rose-500' },
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
        this.activePanel = null;
        this._saveToStorage(STORAGE_KEYS.ACTIVE_PANEL, '');
        this._updateUI();
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
            z-index: 9995 !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            pointer-events: none !important;
        `;

        this.container.innerHTML = `
            <!-- Slide-up Panel (above dock) -->
            <div id="fs-dock-panel"
                 class="pointer-events-auto mb-2 w-[95%] max-w-5xl bg-white rounded-xl overflow-hidden transition-all duration-300 ease-out"
                 style="max-height: 0; opacity: 0; box-shadow: 0 10px 40px -5px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.1); border: 2px solid rgba(100,100,120,0.2);">
                <div id="fs-dock-panel-content">
                    <!-- Panel content rendered here -->
                </div>
            </div>

            <!-- Dock Bar -->
            <div id="fs-dock-bar"
                 class="pointer-events-auto flex items-center gap-1 px-2 py-1.5 bg-gray-900/90 backdrop-blur-sm rounded-full shadow-xl border border-gray-700">
                ${this._renderDockButtons()}
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
    }

    // ========================================================================
    // PANEL CONTENT RENDERERS
    // ========================================================================

    _renderWorkbenchPanel(container) {
        const compState = getCompositionState();
        const settings = compState?.getSettings?.() || {};
        const key = settings.key || 'C';
        const mode = settings.mode || 'major';
        const keyDisplay = `${key} ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;

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
                        <span id="fs-workbench-key-display">${keyDisplay}</span>
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
        const key = compState?.getSettings?.()?.key || 'C';

        // Header with view mode toggle
        container.innerHTML = `
            <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 border-b border-purple-700">
                <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Chord Progression</span>
                <div class="flex items-center gap-2">
                    <div class="flex gap-0.5 bg-white/20 rounded-lg p-0.5">
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
            <!-- Section picker bar (visible in section view mode when sections exist) -->
            <div id="fs-section-picker" class="${this.viewMode === 'section' && hasSections ? '' : 'hidden'}"></div>
            <!-- Cards container -->
            <div id="fs-chord-cards-container" class="flex flex-nowrap items-start gap-1 pl-4 pr-2 mt-2" style="width: 100%; height: calc(100% - ${this.viewMode === 'section' && hasSections ? '120px' : '58px'}); scroll-behavior: smooth; -webkit-overflow-scrolling: touch; overflow-x: auto; overflow-y: hidden; padding-bottom: 24px;">
            </div>
            <style>
                #fs-chord-cards-container::-webkit-scrollbar { height: 10px; }
                #fs-chord-cards-container::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 5px; margin: 0 8px; }
                #fs-chord-cards-container::-webkit-scrollbar-thumb { background: linear-gradient(to right, #8b5cf6, #6366f1); border-radius: 5px; }
                #fs-chord-cards-container::-webkit-scrollbar-thumb:hover { background: linear-gradient(to right, #7c3aed, #4f46e5); }
                #fs-chord-cards-container { scrollbar-width: auto; scrollbar-color: #8b5cf6 #f1f5f9; }
            </style>
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

        wrapper.innerHTML = `
            <div class="relative">
                <div class="drag-handle absolute -top-1 left-1/2 transform -translate-x-1/2 cursor-grab active:cursor-grabbing z-10 opacity-50 hover:opacity-100 transition-opacity">
                    <svg class="w-4 h-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm6-4a2 2 0 10.001-4.001A2 2 0 0013 4zm0 4a2 2 0 10.001 4.001A2 2 0 0013 8z"/>
                    </svg>
                </div>
                <div class="simplified-card bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-600 rounded-xl p-2 hover:shadow-xl transition-all shadow-lg relative" style="min-height: 70px;">
                    ${invText ? `<div class="absolute top-1 left-1.5 text-lg text-red-400 font-bold" style="-webkit-text-fill-color: #f87171;">${invText}</div>` : ''}
                    <div class="text-center pt-1">
                        <div class="text-lg font-bold text-white" style="-webkit-text-fill-color: white;">${chordSymbol}</div>
                        <div class="text-[10px] text-gray-400 mt-0.5">${chord.beats || 4} beats</div>
                    </div>
                </div>
            </div>
        `;

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
     * Initialize Sortable on section containers (for reordering entire sections)
     */
    _initializeFSSectionContainerSortable(container) {
        if (typeof Sortable === 'undefined') return;

        if (container.sortableInstance) {
            container.sortableInstance.destroy();
        }

        container.sortableInstance = new Sortable(container, {
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            handle: '.section-banner',
            draggable: '.section-unified-container',
            swapThreshold: 0.3,
            sort: true,
            onEnd: (evt) => {
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
                    // Refresh both Composition Studio and fullscreen panel
                    window.renderProgressionDisplay?.('melody-progression-visualization', false);
                    this._renderChordsPanel(this.container.querySelector('#fs-dock-panel-content'));
                }
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
     */
    _initializeFSSimplifiedSortable(container) {
        if (typeof Sortable === 'undefined') return;

        if (container.sortableInstance) {
            container.sortableInstance.destroy();
        }

        container.sortableInstance = new Sortable(container, {
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            handle: '.drag-handle',
            filter: 'button, select, input, .no-drag',
            preventOnFilter: false,
            draggable: '.chord-card-wrapper[data-chord-index]',
            delay: 150,
            delayOnTouchOnly: true,
            touchStartThreshold: 5,
            onEnd: (evt) => {
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
        const key = compState?.getSettings?.()?.key || 'C';

        // EXACTLY mirror the Composition Studio quick-add-chord-form layout
        container.innerHTML = `
            <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500 border-b border-green-600">
                <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Quick Add Chord</span>
                <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="p-3">
                <!-- Scale Filter Row - EXACTLY like Composition Studio (lines 1791-1800 in index.html) -->
                <div class="mb-3 p-2 bg-purple-50 rounded-lg border border-purple-200">
                    <div class="flex items-center gap-3 flex-wrap">
                        <label class="text-xs font-medium text-purple-700">Scale Filter:</label>
                        <select id="fs-quick-scale" class="flex-1 min-w-[200px] p-1.5 text-sm border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-white">
                            <option value="">All Chords (no filter)</option>
                            <!-- Options populated by _populateScaleDropdown -->
                        </select>
                        <span class="text-xs text-purple-600 italic">Filter chord types by scale compatibility</span>
                    </div>
                </div>
                <!-- Main Controls Grid - EXACTLY like Composition Studio (lines 1802-1894 in index.html) -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                        <label class="block text-xs font-medium text-gray-700 mb-1">Root Note</label>
                        <select id="fs-quick-root" class="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
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
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-700 mb-1">Chord/Interval Type</label>
                        <select id="fs-quick-type" class="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                            <!-- Populated by _populateChordTypeDropdown -->
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-gray-700 mb-1">Inversion</label>
                        <select id="fs-quick-inversion" class="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                            <option value="0">Root Position</option>
                            <option value="1">1st Inversion</option>
                            <option value="2">2nd Inversion</option>
                            <option value="3">3rd Inversion</option>
                        </select>
                    </div>
                    <div class="flex items-end gap-2">
                        <button id="fs-quick-add-btn" class="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow transition">
                            Add
                        </button>
                    </div>
                </div>
                <!-- N.C. Button Row -->
                <div class="mt-3 flex justify-end">
                    <button id="fs-quick-nc-btn" class="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-xs font-medium rounded-lg shadow transition flex items-center gap-1.5" title="Add No Chord (N.C.) - reserves time without harmony">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                        Add No Chord (N.C.)
                    </button>
                </div>
            </div>
        `;

        // Populate dropdowns
        this._populateScaleDropdown(container);
        this._populateChordTypeDropdown(container);

        // Root change handler - update chord types based on scale filter
        container.querySelector('#fs-quick-root')?.addEventListener('change', () => {
            this._populateChordTypeDropdown(container);
        });

        // Scale change handler - filter chord types
        container.querySelector('#fs-quick-scale')?.addEventListener('change', () => {
            this._populateChordTypeDropdown(container);
        });

        // Add button handler
        container.querySelector('#fs-quick-add-btn')?.addEventListener('click', () => {
            const root = parseInt(container.querySelector('#fs-quick-root').value);
            const type = container.querySelector('#fs-quick-type').value;
            const inversion = parseInt(container.querySelector('#fs-quick-inversion').value);
            const rootName = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][root];

            if (window.addChordToProgressionByParams) {
                window.addChordToProgressionByParams(type, rootName, inversion, 0, true);
            }
        });

        // N.C. button handler
        container.querySelector('#fs-quick-nc-btn')?.addEventListener('click', () => {
            if (window.addNoChordToProgression) {
                window.addNoChordToProgression();
            }
        });

        // Close button handler
        container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
            this.closeActivePanel();
        });
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

        // Helper to check if pattern is selected
        const sel = (val) => bassPattern === val ? 'selected' : '';

        container.innerHTML = `
            <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 border-b border-amber-600">
                <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Auto-Bass Patterns</span>
                <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="p-3 h-full">
                <div class="flex flex-wrap items-center gap-4 mb-3">
                    <div class="flex items-center gap-2">
                        <label class="text-xs font-medium text-gray-700">Bass Pattern:</label>
                        <select id="fs-bass-pattern" class="p-1.5 text-sm border border-gray-300 rounded-lg min-w-[180px]">
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
                        <select id="fs-bass-octave" class="p-1.5 text-sm border border-gray-300 rounded-lg">
                            <option value="auto" ${bassOctave === 'auto' ? 'selected' : ''}>Auto</option>
                            <option value="2" ${bassOctave === 2 || bassOctave === '2' ? 'selected' : ''}>Oct 2</option>
                            <option value="3" ${bassOctave === 3 || bassOctave === '3' ? 'selected' : ''}>Oct 3</option>
                        </select>
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="flex items-center gap-1.5 cursor-pointer" title="When ON, bass plays the inversion note (3rd for 1st inv, 5th for 2nd inv)">
                            <input type="checkbox" id="fs-bass-follows-inv" class="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500">
                            <span class="text-xs font-medium text-gray-700">Follow Inv</span>
                        </label>
                    </div>
                    <button id="fs-bass-apply" class="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow">
                        Apply to All
                    </button>
                    <button id="fs-bass-revert" class="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg transition-all">
                        Revert All
                    </button>
                </div>
                <div class="text-xs text-gray-500">
                    Auto-generate bass patterns based on your chord progression. Changes apply to the bass clef.
                </div>
            </div>
        `;

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

        // Apply button
        container.querySelector('#fs-bass-apply')?.addEventListener('click', () => {
            if (window.regenerateBassForAllChords) window.regenerateBassForAllChords();
        });

        // Revert button
        container.querySelector('#fs-bass-revert')?.addEventListener('click', () => {
            if (window.revertBassForAllChords) window.revertBassForAllChords();
        });

        // Close button handler
        container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
            this.closeActivePanel();
        });
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
        const key = compState?.getSettings?.()?.key || 'C';

        // Common borrowed chords
        const borrowedChords = [
            { root: key, type: 'Minor', label: 'i (parallel minor)', from: 'Parallel Minor' },
            { root: this._transposeNote(key, 10), type: 'Major', label: 'bVII', from: 'Mixolydian' },
            { root: this._transposeNote(key, 8), type: 'Major', label: 'bVI', from: 'Aeolian' },
            { root: this._transposeNote(key, 3), type: 'Minor', label: 'biii', from: 'Parallel Minor' },
            { root: this._transposeNote(key, 5), type: 'Minor', label: 'iv', from: 'Parallel Minor' },
            { root: this._transposeNote(key, 1), type: 'Major', label: 'bII (Neapolitan)', from: 'Phrygian' },
        ];

        container.innerHTML = `
            <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-pink-500 to-rose-500 border-b border-pink-600">
                <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Borrowed Chords</span>
                <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="p-3 h-full">
                <div class="text-xs text-gray-600 mb-2">Borrowed chords from parallel modes (key: ${key})</div>
                <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    ${borrowedChords.map(chord => `
                        <button class="fs-borrowed-chord p-2 bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200 rounded-lg hover:from-pink-100 hover:to-rose-100 transition-all text-center"
                                data-root="${chord.root}" data-type="${chord.type}">
                            <div class="font-bold text-sm text-pink-700">${chord.root}${chord.type === 'Minor' ? 'm' : ''}</div>
                            <div class="text-[10px] text-pink-500">${chord.label}</div>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        // Add click handlers
        container.querySelectorAll('.fs-borrowed-chord').forEach(btn => {
            btn.addEventListener('click', () => {
                const root = btn.dataset.root;
                const type = btn.dataset.type;
                if (window.addChordToProgressionByParams) {
                    window.addChordToProgressionByParams(type, root, 0, 0, true);
                }
            });
        });

        // Close button handler
        container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
            this.closeActivePanel();
        });
    }

    _renderTheoryPanel(container) {
        const compState = getCompositionState();
        const key = compState?.getSettings?.()?.key || 'C';
        const chords = this._getChords(compState);

        container.innerHTML = `
            <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 border-b border-yellow-600">
                <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">Theory Insights</span>
                <button class="fs-panel-close-btn p-1 rounded-full hover:bg-white/20 transition-colors" title="Close panel">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="p-3 h-full overflow-auto">
                <div class="text-xs text-gray-600 mb-2">Theory insights for your progression (key: ${key})</div>
                <div id="fs-theory-content" class="space-y-2">
                    ${chords.length < 2
                        ? '<div class="text-gray-400 text-sm">Add at least 2 chords to see theory analysis</div>'
                        : this._generateTheoryInsights(chords, key)
                    }
                </div>
            </div>
        `;

        // Close button handler
        container.querySelector('.fs-panel-close-btn')?.addEventListener('click', () => {
            this.closeActivePanel();
        });
    }

    _generateTheoryInsights(chords, key) {
        const insights = [];

        // Check for common progressions
        if (chords.length >= 4) {
            const roots = chords.slice(0, 4).map(c => c.root);
            // I-V-vi-IV detection (simplified)
            insights.push(`
                <div class="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div class="font-medium text-yellow-800 text-sm">📊 Progression Analysis</div>
                    <div class="text-xs text-yellow-700 mt-1">${chords.length} chords in ${key} major</div>
                </div>
            `);
        }

        // Check for secondary dominants
        const hasDom7 = chords.some(c => c.type === 'Dominant 7th');
        if (hasDom7) {
            insights.push(`
                <div class="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div class="font-medium text-blue-800 text-sm">🎯 Secondary Dominant Detected</div>
                    <div class="text-xs text-blue-700 mt-1">You have a dominant 7th chord that may function as a secondary dominant.</div>
                </div>
            `);
        }

        if (insights.length === 0) {
            insights.push(`
                <div class="p-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <div class="text-sm text-gray-600">Keep adding chords to unlock more insights!</div>
                </div>
            `);
        }

        return insights.join('');
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    _getChords(compState) {
        const segments = compState?.getChordSegments?.() || [];
        return segments.map(seg => seg.chord).filter(Boolean);
    }

    _transposeNote(note, semitones) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const idx = notes.indexOf(note.replace('b', '#').charAt(0) + (note.includes('#') ? '#' : ''));
        if (idx === -1) return note;
        return notes[(idx + semitones) % 12];
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
