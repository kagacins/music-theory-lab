/**
 * ChordLabBottomPanel.js - Bottom Dock Panel for Full-Screen Chord Lab
 *
 * Renders content to the MAIN CONTENT AREA when tabs are selected:
 * - Library: Full chord type grid with classic button design, arpeggio buttons, tooltips
 * - Intervals: Interval button grid with arpeggio buttons
 * - Progression: Chord cards display (reuses existing rendering)
 * - Identifier: Chord identification from note input
 * - Settings: Playback settings (arpeggio speed, display options)
 *
 * Uses the EXACT same button design as the classic Chord Lab including:
 * - Button wrapper with hover scale effect
 * - Main button with press-and-hold playback
 * - Arpeggio up/down buttons on the right
 * - Tooltips with descriptions
 */

import { getCompositionState } from '../../state/compositionState.js';
import { getTrainerState } from '../../state/trainerState.js';
import { getEnharmonicPreference } from '../../state/globalState.js';
import {
    getBuilderRootIndex,
    getBuilderChordType,
    getChordLibraryMode,
    getScaleFilter,
    setChordLibraryMode,
    setScaleFilter,
    getLastDiatonicChord,
    setLastDiatonicChord,
    setBuilderRootIndex,
    getPaletteFilter,
    setPaletteFilter
} from '../../state/builderState.js';
import {
    SHARP_NOTES, FLAT_NOTES, CHORD_DEFINITIONS, CHORD_GROUPS,
    INTERVAL_DEFINITIONS, INTERVAL_GROUPS, SCALE_DEFINITIONS, SCALE_CATEGORIES,
    generateDiatonicChords, generateScaleDiatonicChords,
    CHORD_PALETTE_CATEGORIES, CHORD_PALETTES, getPalettesByCategory, isChordInPalette,
    SUBSTITUTION_TYPES, calculateChordSubstitutions, getSubstitutionType
} from '../../../data/music-data.js';
import { isChordInScale } from '../chordBuilder.js';
import { FUNCTION_LEGEND, getHarmonicFunctionFromRoman, shouldShowFunctionColors } from '../../ui/chordFunctionLegend.js';
import { renderBassMotionIndicators } from '../../ui/BassMotionIndicators.js';

// ============================================================================
// CONSTANTS
// ============================================================================

const PANEL_IDS = ['library', 'intervals', 'substitutions', 'progression', 'identifier'];

const PANEL_CONFIG = {
    library: {
        icon: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"/></svg>`,
        label: 'Library',
        activeColor: 'bg-indigo-600',
        hoverColor: 'hover:bg-indigo-700'
    },
    intervals: {
        icon: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>`,
        label: 'Intervals',
        activeColor: 'bg-emerald-600',
        hoverColor: 'hover:bg-emerald-700'
    },
    substitutions: {
        icon: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>`,
        label: 'Substitutions',
        activeColor: 'bg-amber-700',
        hoverColor: 'hover:bg-amber-800'
    },
    progression: {
        icon: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>`,
        label: 'Chord Progression',
        activeColor: 'bg-violet-600',
        hoverColor: 'hover:bg-violet-700'
    },
    identifier: {
        icon: `<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/></svg>`,
        label: 'Identifier',
        activeColor: 'bg-cyan-600',
        hoverColor: 'hover:bg-cyan-700'
    }
};

// Storage keys for persisting user preferences
const STORAGE_KEYS = {
    VIEW_MODE: 'chordlab-progression-view-mode'
};

// ============================================================================
// ChordLabBottomPanel CLASS
// ============================================================================

export class ChordLabBottomPanel {
    constructor(container, editor) {
        this.container = container;
        this.editor = editor;
        this.currentPanel = 'library'; // Default to library
        this.tooltipsEnabled = true;
        this.identifierResults = [];
        // Progression panel state
        this.viewMode = this._loadFromStorage(STORAGE_KEYS.VIEW_MODE, 'scroll');
        this.selectedSectionIds = new Set();
        // Substitutions panel state - locks to chord selected when opening panel
        this.lockedSubstitutionChord = null; // { root, rootIndex, chordType, symbol }
    }

    _loadFromStorage(key, defaultValue) {
        try {
            const stored = localStorage.getItem(key);
            return stored !== null ? stored : defaultValue;
        } catch {
            return defaultValue;
        }
    }

    _saveToStorage(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch {
            // Ignore storage errors
        }
    }

    /**
     * Programmatically set tooltips/details enabled state
     * Used by tutorial system to disable tooltips during tutorials
     * @param {boolean} enabled - Whether tooltips should be enabled
     */
    setTooltipsEnabled(enabled) {
        this.tooltipsEnabled = enabled;

        // Update the checkbox if it exists
        const tooltipsToggle = document.getElementById('fs-library-tooltips');
        if (tooltipsToggle) {
            tooltipsToggle.checked = enabled;
        }

        // Update label styling
        const offLabel = document.getElementById('fs-details-off-label');
        const onLabel = document.getElementById('fs-details-on-label');
        if (offLabel) {
            offLabel.className = `text-[10px] font-semibold ${!enabled ? 'text-white' : 'text-white/60'}`;
        }
        if (onLabel) {
            onLabel.className = `text-[10px] font-semibold ${enabled ? 'text-white' : 'text-white/60'}`;
        }

        // Hide any open tooltip when disabled
        if (!enabled) {
            this._hideAllTooltips();
        }

        // Disable/enable the toggle container during tutorials
        const toggleContainer = tooltipsToggle?.closest('.flex.items-center');
        if (toggleContainer) {
            if (!enabled && window.isTutorialInProgress) {
                toggleContainer.dataset.tutorialDisabled = 'true';
                toggleContainer.style.opacity = '0.4';
                toggleContainer.style.pointerEvents = 'none';
            } else {
                delete toggleContainer.dataset.tutorialDisabled;
                toggleContainer.style.opacity = '';
                toggleContainer.style.pointerEvents = '';
            }
        }
    }

    init() {
        this._renderDock();
        // Show library panel content by default
        this._renderMainContent('library');

        // Listen for progression updates (e.g., when cleared from Composition Studio)
        // to keep the Progression panel in sync
        window.addEventListener('progressionUpdated', () => {
            // Only refresh if the progression panel is currently visible
            if (this.currentPanel === 'progression') {
                const mainContent = this.container.querySelector('#fs-chordlab-main-content');
                if (mainContent) {
                    this._renderProgressionContent(mainContent);
                }
            }
        });
    }

    openPanel(panelId) {
        if (!PANEL_IDS.includes(panelId)) return;

        // Toggle panel if same panel clicked
        if (this.currentPanel === panelId) {
            // Don't close - just keep it selected
            return;
        }

        // When opening Substitutions panel, lock to current chord from builder
        if (panelId === 'substitutions') {
            const enhPref = getEnharmonicPreference();
            const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
            const rootIndex = getBuilderRootIndex();
            const chordType = getBuilderChordType();
            const chordDef = CHORD_DEFINITIONS[chordType];
            this.lockedSubstitutionChord = {
                root: notes[rootIndex],
                rootIndex: rootIndex,
                chordType: chordType,
                symbol: chordDef?.symbol || ''
            };
        }

        this.currentPanel = panelId;
        this._renderDock();
        this._renderMainContent(panelId);
    }

    /**
     * Refresh the current panel content (called when builder state changes)
     */
    refresh() {
        if (this.currentPanel) {
            this._renderMainContent(this.currentPanel);
        }
    }

    /**
     * Update just the chord button highlighting without full re-render.
     * This preserves tooltips and other interactive elements.
     */
    updateButtonHighlighting() {
        const currentChordType = window.getBuilderChordType ? window.getBuilderChordType() : null;
        const container = this.container?.querySelector('#fs-chord-grid-container');
        if (!container) return;

        // Update all button wrappers
        container.querySelectorAll('.key-button-wrapper').forEach(wrapper => {
            const chordType = wrapper.dataset.chordType;
            const isSelected = chordType === currentChordType;

            // Update wrapper classes
            wrapper.className = `key-button-wrapper flex items-stretch rounded-lg shadow-sm overflow-hidden transition duration-150 transform hover:scale-105 ${isSelected ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'bg-gray-200'}`;

            // Update main button within
            const mainButton = wrapper.querySelector('button[data-chord-type]');
            if (mainButton) {
                mainButton.className = `flex-grow px-1.5 py-1.5 text-center text-sm font-medium ${isSelected ? 'text-indigo-800 bg-indigo-100' : 'text-gray-800'} hover:bg-indigo-100`;

                // Update the symbol text color
                const symbolSpan = mainButton.querySelector('span:last-child');
                if (symbolSpan) {
                    symbolSpan.className = `block ${isSelected ? 'text-indigo-600' : 'text-gray-500'} pointer-events-none`;
                    symbolSpan.style.fontSize = '0.65rem';
                    symbolSpan.style.lineHeight = '0.9';
                }
            }
        });
    }

    closePanel() {
        // Reset to library as default
        this.currentPanel = 'library';
        this._renderDock();
        this._renderMainContent('library');
    }

    // ========================================================================
    // DOCK RENDERING (just tab buttons)
    // ========================================================================

    _renderDock() {
        const dock = this.container?.querySelector('#fs-chordlab-bottom-dock');
        if (!dock) return;

        // Build buttons with Composition Studio floating bar style
        const buttonsHtml = PANEL_IDS.map(id => {
            const config = PANEL_CONFIG[id];
            const isActive = this.currentPanel === id;

            // Active buttons get gradient background, inactive get subtle dark styling
            if (isActive) {
                // Map activeColor to gradient colors
                const gradientMap = {
                    'bg-indigo-600': 'from-indigo-500 to-blue-600',
                    'bg-emerald-600': 'from-emerald-500 to-teal-500',
                    'bg-amber-700': 'from-amber-700 to-amber-600',
                    'bg-violet-600': 'from-violet-500 to-purple-500',
                    'bg-cyan-600': 'from-cyan-500 to-sky-500'
                };
                const gradient = gradientMap[config.activeColor] || 'from-gray-500 to-gray-600';

                return `
                    <button onclick="window.fsChordLabOpenPanel && window.fsChordLabOpenPanel('${id}')"
                            class="fs-chordlab-dock-btn flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                                   text-white bg-gradient-to-r ${gradient} shadow-lg border border-white/20"
                            data-panel="${id}"
                            title="${config.label}">
                        <span class="text-sm">${config.icon}</span>
                        <span class="hidden sm:inline">${config.label}</span>
                    </button>
                `;
            } else {
                return `
                    <button onclick="window.fsChordLabOpenPanel && window.fsChordLabOpenPanel('${id}')"
                            class="fs-chordlab-dock-btn flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                                   text-gray-300 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/25 shadow-sm"
                            data-panel="${id}"
                            title="${config.label}">
                        <span class="text-sm">${config.icon}</span>
                        <span class="hidden sm:inline">${config.label}</span>
                    </button>
                `;
            }
        }).join('');

        // Floating pill-shaped bar matching Composition Studio
        dock.innerHTML = `
            <div class="pointer-events-auto flex items-center gap-1 px-2 py-1.5 bg-gray-900/90 backdrop-blur-sm rounded-full shadow-xl border border-gray-700">
                ${buttonsHtml}
            </div>
        `;
    }

    // ========================================================================
    // MAIN CONTENT RENDERING (Library, Intervals, etc. go here)
    // ========================================================================

    _renderMainContent(panelId) {
        const mainContent = this.container?.querySelector('#fs-chordlab-main-content');
        if (!mainContent) return;

        switch (panelId) {
            case 'library':
                this._renderLibraryContent(mainContent);
                break;
            case 'intervals':
                this._renderIntervalsContent(mainContent);
                break;
            case 'substitutions':
                this._renderSubstitutionsContent(mainContent);
                break;
            case 'progression':
                this._renderProgressionContent(mainContent);
                break;
            case 'identifier':
                this._renderIdentifierContent(mainContent);
                break;
        }
    }

    // ========================================================================
    // LIBRARY CONTENT (rendered to main area)
    // ========================================================================

    _renderLibraryContent(container) {
        const libraryMode = getChordLibraryMode();
        const scaleOptions = this._generateScaleOptionsWithIcons();
        const paletteOptions = this._generatePaletteOptions();
        const currentScale = getScaleFilter();
        const currentPalette = getPaletteFilter();
        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootNote = notes[getBuilderRootIndex()];

        // Build header text based on mode and filters
        let headerText = 'Chord Library';
        const filters = [];
        if (libraryMode === 'diatonic') {
            filters.push(currentScale ? `Diatonic to ${rootNote} ${currentScale}` : `Diatonic to ${rootNote} Major`);
        } else if (currentScale) {
            filters.push(`${rootNote} ${currentScale}`);
        }
        if (currentPalette && CHORD_PALETTES[currentPalette]) {
            filters.push(CHORD_PALETTES[currentPalette].label);
        }
        if (filters.length > 0) {
            headerText = filters.join(' + ');
        }

        // Build header HTML
        container.innerHTML = `
            <div class="h-full flex flex-col">
                <!-- Library controls bar -->
                <div class="flex items-center flex-wrap px-3 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 flex-shrink-0 gap-y-1">
                    <span class="text-white font-semibold text-sm mr-4">${headerText}</span>
                    <div class="flex items-center gap-2 flex-wrap">
                        <!-- Chromatic/Diatonic toggle (wider, matches classic style) -->
                        <div class="flex items-center gap-1.5 px-2 py-1 bg-white/20 rounded-full" title="Toggle: Chromatic (all chords) ↔ Diatonic (scale chords)">
                            <span class="text-[10px] font-semibold ${libraryMode === 'chromatic' ? 'text-white' : 'text-white/60'}">Chromatic</span>
                            <label class="relative inline-flex items-center cursor-pointer mx-1">
                                <input type="checkbox" id="fs-library-mode"
                                       ${libraryMode === 'diatonic' ? 'checked' : ''}
                                       class="sr-only peer">
                                <div class="w-8 h-4 bg-gray-400 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-400"></div>
                            </label>
                            <span class="text-[10px] font-semibold ${libraryMode === 'diatonic' ? 'text-white' : 'text-white/60'}">Diatonic</span>
                        </div>

                        <!-- Scale filter (with icons, matches classic style) -->
                        <div class="flex items-center gap-1.5 px-2 py-1 bg-white/20 rounded-full" title="Filter chords by scale">
                            <svg class="w-3.5 h-3.5 text-white/80" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clip-rule="evenodd"/>
                            </svg>
                            <span class="text-[10px] font-semibold text-white/80">Scale:</span>
                            <select id="fs-library-scale"
                                    class="px-1.5 py-0.5 bg-white/30 text-white text-[10px] rounded border-none outline-none cursor-pointer" style="max-width: 120px;">
                                <option value="" style="color: #374151; background: white;">All Scales</option>
                                ${scaleOptions}
                            </select>
                        </div>

                        <!-- Palette filter (NEW) -->
                        <div class="flex items-center gap-1.5 px-2 py-1 bg-white/20 rounded-full" title="Filter chords by style palette">
                            <svg class="w-3.5 h-3.5 text-white/80" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4 2a2 2 0 00-2 2v11a3 3 0 106 0V4a2 2 0 00-2-2H4zm1 14a1 1 0 100-2 1 1 0 000 2zm5-1.757l4.9-4.9a2 2 0 000-2.828L13.485 5.1a2 2 0 00-2.828 0L10 5.757v8.486zM16 18H9.071l6-6H16a2 2 0 012 2v2a2 2 0 01-2 2z" clip-rule="evenodd"/>
                            </svg>
                            <span class="text-[10px] font-semibold text-white/80">Palette:</span>
                            <select id="fs-library-palette"
                                    class="px-1.5 py-0.5 bg-white/30 text-white text-[10px] rounded border-none outline-none cursor-pointer" style="max-width: 130px;">
                                <option value="" style="color: #374151; background: white;">All Chords</option>
                                ${paletteOptions}
                            </select>
                        </div>

                        <!-- Details toggle (styled like Chromatic/Diatonic) -->
                        <div class="flex items-center gap-1.5 px-2 py-1 bg-white/20 rounded-full" title="Show/hide chord details">
                            <span class="text-[10px] font-semibold ${!this.tooltipsEnabled ? 'text-white' : 'text-white/60'}" id="fs-details-off-label">Details Off</span>
                            <label class="relative inline-flex items-center cursor-pointer mx-1">
                                <input type="checkbox" id="fs-library-tooltips"
                                       ${this.tooltipsEnabled ? 'checked' : ''}
                                       class="sr-only peer">
                                <div class="w-8 h-4 bg-gray-400 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-400"></div>
                            </label>
                            <span class="text-[10px] font-semibold ${this.tooltipsEnabled ? 'text-white' : 'text-white/60'}" id="fs-details-on-label">Details On</span>
                        </div>
                    </div>
                </div>

                <!-- Chord grid container (scrollable) -->
                <div id="fs-chord-grid-container" class="flex-1 overflow-y-auto p-3">
                </div>
            </div>
        `;

        // Render the chord grid using DOM (not HTML strings) for proper event attachment
        const gridContainer = container.querySelector('#fs-chord-grid-container');
        this._renderChordLibraryGridDOM(gridContainer, libraryMode);

        // Attach event handlers
        const modeToggle = container.querySelector('#fs-library-mode');
        if (modeToggle) {
            modeToggle.addEventListener('change', (e) => {
                if (window.toggleChordLibraryMode) {
                    window.toggleChordLibraryMode(e.target.checked);
                }
                this._renderLibraryContent(container);
            });
        }

        const scaleSelect = container.querySelector('#fs-library-scale');
        if (scaleSelect) {
            scaleSelect.addEventListener('change', (e) => {
                if (setScaleFilter) {
                    setScaleFilter(e.target.value || null);
                }
                this._renderLibraryContent(container);
            });
        }

        const paletteSelect = container.querySelector('#fs-library-palette');
        if (paletteSelect) {
            paletteSelect.addEventListener('change', (e) => {
                setPaletteFilter(e.target.value || null);
                this._renderLibraryContent(container);
            });
        }

        const tooltipsToggle = container.querySelector('#fs-library-tooltips');
        if (tooltipsToggle) {
            tooltipsToggle.addEventListener('change', (e) => {
                this.tooltipsEnabled = e.target.checked;
                // Update label colors to match Chromatic/Diatonic toggle style
                const offLabel = document.getElementById('fs-details-off-label');
                const onLabel = document.getElementById('fs-details-on-label');
                if (offLabel) {
                    offLabel.className = `text-[10px] font-semibold ${!this.tooltipsEnabled ? 'text-white' : 'text-white/60'}`;
                }
                if (onLabel) {
                    onLabel.className = `text-[10px] font-semibold ${this.tooltipsEnabled ? 'text-white' : 'text-white/60'}`;
                }
                // Hide any open tooltip when disabled
                if (!this.tooltipsEnabled) {
                    this._hideAllTooltips();
                }
            });

            // Disable tooltips toggle and turn OFF tooltips during tutorials
            if (window.isTutorialInProgress) {
                // Force tooltips OFF during tutorial
                this.tooltipsEnabled = false;
                tooltipsToggle.checked = false;
                // Update label styling
                const offLabel = document.getElementById('fs-details-off-label');
                const onLabel = document.getElementById('fs-details-on-label');
                if (offLabel) offLabel.className = 'text-[10px] font-semibold text-white';
                if (onLabel) onLabel.className = 'text-[10px] font-semibold text-white/60';

                // Disable the toggle container
                const toggleContainer = tooltipsToggle.closest('.flex.items-center');
                if (toggleContainer) {
                    toggleContainer.dataset.tutorialDisabled = 'true';
                    toggleContainer.style.opacity = '0.4';
                    toggleContainer.style.pointerEvents = 'none';
                }
            }
        }
    }

    /**
     * Create an interactive tooltip for a chord button with inversion buttons
     * @param {HTMLElement} button - The main chord button
     * @param {string} chordType - The chord type
     * @param {string} symbol - Display symbol (e.g., "Cmaj7")
     * @param {string} description - Chord description
     * @returns {HTMLElement} The tooltip element
     */
    _createChordTooltip(button, chordType, symbol, description) {
        const tooltip = document.createElement('div');
        tooltip.className = 'fs-chord-tooltip';
        tooltip.style.cssText = `
            position: fixed;
            z-index: 999999;
            background: #111827;
            color: #f3f4f6;
            padding: 10px 14px;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            max-width: 320px;
            font-size: 12px;
            line-height: 1.4;
            pointer-events: auto;
            border: 1px solid #374151;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.15s ease-in-out, visibility 0.15s ease-in-out;
        `;

        // Get max inversions for this chord
        const chordDef = CHORD_DEFINITIONS[chordType];
        const maxInversion = chordDef ? chordDef.intervals.length - 1 : 0;
        const INVERSION_NAMES = ['Root', '1st', '2nd', '3rd', '4th'];

        // Build tooltip content with inversion buttons
        let inversionButtonsHtml = '';
        for (let inv = 0; inv <= maxInversion && inv < 5; inv++) {
            const invName = INVERSION_NAMES[inv];
            inversionButtonsHtml += `
                <button class="tooltip-inversion-btn" data-inversion="${inv}"
                        style="padding: 3px 8px; background-color: #374151; color: #d1d5db; border: 1px solid #4b5563; border-radius: 3px; font-size: 11px; cursor: pointer; transition: all 0.15s; white-space: nowrap;">
                    ${invName}
                </button>
            `;
        }

        tooltip.innerHTML = `
            <button class="tooltip-close-btn" style="position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border-radius: 50%; background: #4b5563; color: #d1d5db; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; line-height: 1; transition: all 0.15s;"
                    title="Close">×</button>
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: #fbbf24; padding-right: 24px;">${symbol}</div>
            <div style="font-weight: 500; font-size: 12px; margin-bottom: 6px; color: #d1d5db;">${chordType}</div>
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 8px;">${description || 'No description available'}</div>
            <div style="font-weight: 500; font-size: 11px; margin-bottom: 4px; color: #d1d5db;">Inversions:</div>
            <div class="tooltip-inversions-container" style="display: flex; gap: 4px; flex-wrap: wrap;">
                ${inversionButtonsHtml}
            </div>
        `;

        // Add close button event handler
        const closeBtn = tooltip.querySelector('.tooltip-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                tooltip.style.opacity = '0';
                tooltip.style.visibility = 'hidden';
            });
            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.backgroundColor = '#ef4444';
                closeBtn.style.color = 'white';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.backgroundColor = '#4b5563';
                closeBtn.style.color = '#d1d5db';
            });
        }

        document.body.appendChild(tooltip);

        // Function to update inversion button highlighting
        // Only highlight if THIS chord type is currently selected
        const updateInversionHighlight = () => {
            const currentChordType = window.getBuilderChordType ? window.getBuilderChordType() : null;
            const currentInversion = window.getBuilderInversion ? window.getBuilderInversion() : 0;
            const isThisChordSelected = currentChordType === chordType;

            tooltip.querySelectorAll('.tooltip-inversion-btn').forEach(btn => {
                const btnInv = parseInt(btn.dataset.inversion, 10);
                // Only highlight the inversion button if this chord is selected AND it's the current inversion
                if (isThisChordSelected && btnInv === currentInversion) {
                    btn.style.backgroundColor = '#fbbf24'; // amber
                    btn.style.color = '#1f2937';
                    btn.style.borderColor = '#f59e0b';
                    btn.style.fontWeight = '600';
                } else {
                    btn.style.backgroundColor = '#374151';
                    btn.style.color = '#d1d5db';
                    btn.style.borderColor = '#4b5563';
                    btn.style.fontWeight = '500';
                }
            });
        };

        // Add press-and-hold handlers to inversion buttons (EXACTLY like classic Chord Lab)
        tooltip.querySelectorAll('.tooltip-inversion-btn').forEach(btn => {
            // Hover effects (only when not selected)
            btn.addEventListener('mouseenter', () => {
                // Check if THIS chord type is selected and this inversion is active
                const currentChordType = window.getBuilderChordType ? window.getBuilderChordType() : null;
                const currentInversion = window.getBuilderInversion ? window.getBuilderInversion() : 0;
                const btnInv = parseInt(btn.dataset.inversion, 10);
                const isThisChordSelected = currentChordType === chordType;
                if (!isThisChordSelected || btnInv !== currentInversion) {
                    btn.style.backgroundColor = '#4b5563';
                    btn.style.color = '#f3f4f6';
                }
            });
            btn.addEventListener('mouseleave', () => {
                updateInversionHighlight();
            });

            // Press-and-hold to play (mousedown/mouseup) - EXACTLY like chordBuilder.js
            btn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                const inversionIndex = parseInt(btn.dataset.inversion, 10);

                // FIRST: Select the chord type for THIS tooltip (without playing yet)
                if (window.selectBuilderChordType) {
                    window.selectBuilderChordType(chordType, false);
                }
                // THEN: Select the inversion (without playing yet)
                if (window.selectBuilderInversion) {
                    window.selectBuilderInversion(inversionIndex, false);
                }
                // NOW: Start playing the chord
                if (window.startBuilderChord) {
                    window.startBuilderChord();
                }

                // Store the selected chord+inversion for Add Chord button
                window.lastTooltipChordSelection = { chordType, inversion: inversionIndex, chordRoot: null };

                // Update button highlighting in this tooltip
                updateInversionHighlight();

                // Update the main builder display
                if (window.updateBuilderDisplay) {
                    window.updateBuilderDisplay();
                }
                // Update chord button highlighting (without destroying tooltips)
                this.updateButtonHighlighting();
                // Directly update the editor's sidebar (don't rely on event)
                if (this.editor && this.editor._syncFromBuilderState) {
                    this.editor._syncFromBuilderState();
                }
            });
            btn.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                if (window.stopBuilderChord) {
                    window.stopBuilderChord();
                }
            });
            btn.addEventListener('mouseleave', (e) => {
                // Stop chord if mouse leaves while holding
                if (window.stopBuilderChord) {
                    window.stopBuilderChord();
                }
                updateInversionHighlight();
            });

            // Touch events for mobile - same pattern
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const inversionIndex = parseInt(btn.dataset.inversion, 10);

                // FIRST: Select the chord type for THIS tooltip
                if (window.selectBuilderChordType) {
                    window.selectBuilderChordType(chordType, false);
                }
                // THEN: Select the inversion
                if (window.selectBuilderInversion) {
                    window.selectBuilderInversion(inversionIndex, false);
                }
                // NOW: Start playing
                if (window.startBuilderChord) {
                    window.startBuilderChord();
                }

                // Store the selected chord+inversion
                window.lastTooltipChordSelection = { chordType, inversion: inversionIndex, chordRoot: null };

                // Update highlighting and display
                updateInversionHighlight();
                if (window.updateBuilderDisplay) {
                    window.updateBuilderDisplay();
                }
                // Update chord button highlighting (without destroying tooltips)
                this.updateButtonHighlighting();
                // Directly update the editor's sidebar (don't rely on event)
                if (this.editor && this.editor._syncFromBuilderState) {
                    this.editor._syncFromBuilderState();
                }
            }, { passive: false });
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.stopBuilderChord) {
                    window.stopBuilderChord();
                }
            }, { passive: false });
            btn.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (window.stopBuilderChord) {
                    window.stopBuilderChord();
                }
            }, { passive: false });
        });

        // Store updateInversionHighlight for external use
        tooltip._updateInversionHighlight = updateInversionHighlight;

        // Show tooltip function
        const showTooltip = () => {
            if (!this.tooltipsEnabled) return;

            const rect = button.getBoundingClientRect();
            const gap = 12;
            const edgePadding = 10;

            // Make tooltip temporarily visible to measure actual dimensions
            tooltip.style.visibility = 'hidden';
            tooltip.style.opacity = '0';
            tooltip.style.display = 'block';
            tooltip.style.transform = 'none'; // Reset transform to measure true width
            const actualHeight = tooltip.offsetHeight;
            const actualWidth = tooltip.offsetWidth;

            // Calculate horizontal position - center over button but shift if it would overflow
            let leftPos = rect.left + rect.width / 2;
            let transformX = 'translateX(-50%)'; // Default: center over button

            // Check if tooltip would overflow right edge
            const tooltipRightEdge = leftPos + (actualWidth / 2);
            if (tooltipRightEdge > window.innerWidth - edgePadding) {
                // Shift left to fit within screen
                leftPos = window.innerWidth - actualWidth - edgePadding;
                transformX = 'none'; // No centering transform needed
            }
            // Check if tooltip would overflow left edge
            const tooltipLeftEdge = leftPos - (actualWidth / 2);
            if (tooltipLeftEdge < edgePadding && transformX === 'translateX(-50%)') {
                leftPos = edgePadding;
                transformX = 'none';
            }

            // Calculate vertical position - prefer above, fall back to below
            let topPos = rect.top - actualHeight - gap;
            if (topPos < edgePadding) {
                // Not enough space above, show below
                topPos = rect.bottom + gap;
            }

            tooltip.style.left = leftPos + 'px';
            tooltip.style.top = topPos + 'px';
            tooltip.style.transform = transformX;

            // Update inversion highlighting when tooltip opens
            updateInversionHighlight();

            tooltip.style.visibility = 'visible';
            tooltip.style.opacity = '1';
        };

        // Hide tooltip function
        const hideTooltip = () => {
            setTimeout(() => {
                if (!tooltip.matches(':hover') && !button.matches(':hover')) {
                    tooltip.style.opacity = '0';
                    tooltip.style.visibility = 'hidden';
                }
            }, 50);
        };

        // Mouse events on button
        button.addEventListener('mouseenter', showTooltip);
        button.addEventListener('mouseleave', hideTooltip);

        // Keep tooltip visible when hovering over it
        tooltip.addEventListener('mouseenter', () => {
            tooltip.style.opacity = '1';
            tooltip.style.visibility = 'visible';
        });
        tooltip.addEventListener('mouseleave', hideTooltip);

        // Store reference for cleanup
        button._tooltip = tooltip;

        return tooltip;
    }

    _hideAllTooltips() {
        document.querySelectorAll('.fs-chord-tooltip').forEach(t => {
            t.style.opacity = '0';
            t.style.visibility = 'hidden';
        });
    }

    /**
     * Render chord library grid using DOM elements (not HTML strings)
     * This allows proper event listener attachment for hover tooltips
     * Handles both DIATONIC and CHROMATIC modes matching classic chord lab behavior
     */
    _renderChordLibraryGridDOM(container, mode) {
        container.innerHTML = '';

        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootIndex = getBuilderRootIndex();
        const rootNote = notes[rootIndex];
        const currentChordType = getBuilderChordType();
        const scaleFilter = getScaleFilter();

        // Create parent grid
        const grid = document.createElement('div');
        grid.className = 'grid grid-cols-2 md:grid-cols-5 lg:grid-cols-6 gap-2';

        if (mode === 'diatonic') {
            // DIATONIC MODE: Render scale-degree based chords with Roman numerals
            const paletteFilter = getPaletteFilter();
            let diatonicChords;
            if (scaleFilter && SCALE_DEFINITIONS[scaleFilter]) {
                // Scale-aware diatonic mode: generate chords from the selected scale
                diatonicChords = generateScaleDiatonicChords(rootNote, scaleFilter, notes);
            } else {
                // Standard diatonic mode: use Major scale
                diatonicChords = generateDiatonicChords(rootNote, notes);
            }

            diatonicChords.forEach(group => {
                // Apply palette filter to diatonic chords if active
                let filteredChords = group.chords;
                if (paletteFilter) {
                    filteredChords = filteredChords.filter(chord =>
                        isChordInPalette(chord.type, paletteFilter)
                    );
                }

                // Skip empty groups when palette filtering
                if (paletteFilter && filteredChords.length === 0) return;

                const groupContainer = document.createElement('div');
                groupContainer.className = 'border border-gray-200 rounded-lg p-2 flex flex-col bg-white';

                const title = document.createElement('h4');
                title.className = 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 text-center';
                title.textContent = paletteFilter ? `${group.title} (${filteredChords.length})` : group.title;
                groupContainer.appendChild(title);

                const buttonGrid = document.createElement('div');
                buttonGrid.className = 'grid grid-cols-1 gap-1.5';

                filteredChords.forEach(chord => {
                    if (!CHORD_DEFINITIONS[chord.type]) return;

                    const chordRootIndex = notes.indexOf(chord.root);
                    const chordSymbol = CHORD_DEFINITIONS[chord.type].symbol || '';
                    const description = CHORD_DEFINITIONS[chord.type].description || '';

                    // Check if this exact chord (root + type) is currently selected in diatonic mode
                    const lastDiatonic = getLastDiatonicChord();
                    const isExactMatch = lastDiatonic && (chord.root === lastDiatonic.root && chord.type === lastDiatonic.type);
                    const isTypeMatch = (chord.type === currentChordType && !isExactMatch);

                    // Button wrapper with diatonic-specific styling
                    const buttonWrapper = document.createElement('div');
                    buttonWrapper.className = `key-button-wrapper flex items-stretch rounded-lg shadow-sm overflow-hidden transition duration-150 transform hover:scale-105 ${isExactMatch ? 'bg-teal-100 ring-2 ring-teal-500' : isTypeMatch ? 'bg-teal-50 ring-1 ring-teal-300' : 'bg-gray-200'}`;
                    buttonWrapper.style.position = 'relative';
                    buttonWrapper.dataset.chordType = chord.type;
                    buttonWrapper.dataset.chordRoot = chord.root;
                    buttonWrapper.dataset.diatonicMode = 'true';

                    // Main button
                    const mainButton = document.createElement('button');
                    mainButton.dataset.chordType = chord.type;
                    mainButton.dataset.chordRoot = chord.root;
                    mainButton.dataset.roman = chord.roman;
                    mainButton.dataset.diatonicMode = 'true';

                    // Apply different styling for exact match vs type match
                    if (isExactMatch) {
                        mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium bg-teal-600 text-white hover:bg-teal-700';
                    } else if (isTypeMatch) {
                        mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium bg-teal-200 text-gray-800 hover:bg-teal-300';
                    } else {
                        mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium text-gray-800 hover:bg-indigo-100';
                    }

                    // Display: chord type on top, root+symbol and roman below
                    const textColor = isExactMatch ? 'text-white' : 'text-gray-800';
                    const secondaryColor = isExactMatch ? 'text-white' : 'text-gray-500';
                    mainButton.innerHTML = `
                        <span class="block text-xs font-bold leading-tight pointer-events-none ${textColor}">${chord.type}</span>
                        <span class="block ${secondaryColor} pointer-events-none" style="font-size: 0.65rem; line-height: 0.9;">${chord.root}${chordSymbol} - ${chord.roman}</span>
                    `;

                    // Mouse events - play the specific diatonic chord without changing root
                    mainButton.addEventListener('mousedown', () => {
                        // Save this as the last played diatonic chord for highlighting
                        setLastDiatonicChord({ root: chord.root, type: chord.type });
                        // Temporarily set root to this chord's root, play, then restore
                        const originalRoot = getBuilderRootIndex();
                        setBuilderRootIndex(chordRootIndex);
                        if (window.selectBuilderChordType) {
                            window.selectBuilderChordType(chord.type, true);
                        }
                        setBuilderRootIndex(originalRoot);
                        // Store selection for Add Chord button
                        window.lastTooltipChordSelection = { chordType: chord.type, inversion: 0, chordRoot: chord.root };
                        // Update highlighting after a brief delay
                        setTimeout(() => this._updateDiatonicButtonHighlighting(), 50);
                    });
                    mainButton.addEventListener('mouseup', () => {
                        if (window.stopBuilderChord) window.stopBuilderChord();
                    });
                    mainButton.addEventListener('mouseleave', () => {
                        if (window.stopBuilderChord) window.stopBuilderChord();
                    });

                    // Touch events
                    let touchHolding = false;
                    mainButton.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        touchHolding = true;
                        mainButton.dataset.held = 'true';
                        setLastDiatonicChord({ root: chord.root, type: chord.type });
                        const originalRoot = getBuilderRootIndex();
                        setBuilderRootIndex(chordRootIndex);
                        if (window.selectBuilderChordType) {
                            window.selectBuilderChordType(chord.type, true);
                        }
                        setBuilderRootIndex(originalRoot);
                        window.lastTooltipChordSelection = { chordType: chord.type, inversion: 0, chordRoot: chord.root };
                        setTimeout(() => this._updateDiatonicButtonHighlighting(), 50);
                    }, { passive: false });
                    mainButton.addEventListener('touchend', (e) => {
                        e.preventDefault();
                        touchHolding = false;
                        mainButton.dataset.held = 'false';
                        if (window.stopBuilderChord) window.stopBuilderChord();
                    }, { passive: false });
                    mainButton.addEventListener('touchcancel', (e) => {
                        e.preventDefault();
                        touchHolding = false;
                        mainButton.dataset.held = 'false';
                        if (window.stopBuilderChord) window.stopBuilderChord();
                    }, { passive: false });

                    buttonWrapper.appendChild(mainButton);

                    // Create tooltip
                    this._createChordTooltip(mainButton, chord.type, `${chord.root}${chordSymbol}`, description);

                    // Info icon
                    this._addInfoIcon(buttonWrapper, mainButton);

                    // Arpeggio buttons
                    this._addArpeggioButtons(buttonWrapper, chord.type, chord.root, chordRootIndex);

                    buttonGrid.appendChild(buttonWrapper);
                });

                groupContainer.appendChild(buttonGrid);
                grid.appendChild(groupContainer);
            });
        } else {
            // CHROMATIC MODE: Show all chords (optionally filtered by scale and/or palette)
            const paletteFilter = getPaletteFilter();
            const hasFilters = scaleFilter || paletteFilter;

            CHORD_GROUPS.forEach(group => {
                // Filter chord types by scale AND palette if active
                let filteredTypes = group.types;

                // Apply scale filter
                if (scaleFilter) {
                    filteredTypes = filteredTypes.filter(chordType =>
                        CHORD_DEFINITIONS[chordType] && isChordInScale(chordType, rootNote, scaleFilter, rootNote)
                    );
                }

                // Apply palette filter (combines with scale filter)
                if (paletteFilter) {
                    filteredTypes = filteredTypes.filter(chordType =>
                        isChordInPalette(chordType, paletteFilter)
                    );
                }

                // Skip empty groups when filtering
                if (hasFilters && filteredTypes.length === 0) return;

                const groupContainer = document.createElement('div');
                groupContainer.className = 'border border-gray-200 rounded-lg p-2 flex flex-col bg-white';

                const title = document.createElement('h4');
                title.className = 'text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 text-center';
                title.textContent = hasFilters ? `${group.title} (${filteredTypes.length})` : group.title;
                groupContainer.appendChild(title);

                const buttonGrid = document.createElement('div');
                buttonGrid.className = 'grid grid-cols-1 gap-1.5';

                filteredTypes.forEach(chordType => {
                    const def = CHORD_DEFINITIONS[chordType];
                    if (!def) return;

                    const symbol = def.symbol || '';
                    const description = def.description || '';
                    const isSelected = chordType === currentChordType;

                    // Button wrapper
                    const buttonWrapper = document.createElement('div');
                    buttonWrapper.className = `key-button-wrapper flex items-stretch rounded-lg shadow-sm overflow-hidden transition duration-150 transform hover:scale-105 ${isSelected ? 'bg-indigo-100 ring-2 ring-indigo-500' : 'bg-gray-200'}`;
                    buttonWrapper.style.position = 'relative';
                    buttonWrapper.dataset.chordType = chordType;

                    // Main button
                    const mainButton = document.createElement('button');
                    mainButton.className = `flex-grow px-1.5 py-1.5 text-center text-sm font-medium ${isSelected ? 'text-indigo-800 bg-indigo-100' : 'text-gray-800'} hover:bg-indigo-100`;
                    mainButton.dataset.chordType = chordType;
                    mainButton.innerHTML = `
                        <span class="block text-xs font-bold leading-tight pointer-events-none">${chordType}</span>
                        <span class="block ${isSelected ? 'text-indigo-600' : 'text-gray-500'} pointer-events-none" style="font-size: 0.65rem; line-height: 0.9;">${rootNote}${symbol}</span>
                    `;

                    // Mouse events for press-and-hold playback
                    mainButton.addEventListener('mousedown', () => {
                        if (window.selectBuilderChordType) {
                            window.selectBuilderChordType(chordType, true);
                        }
                        // Store selection for Add Chord button
                        window.lastTooltipChordSelection = { chordType, inversion: 0, chordRoot: null };
                        // Update button highlighting
                        this.updateButtonHighlighting();
                        // Update sidebar directly
                        if (this.editor && this.editor._syncFromBuilderState) {
                            this.editor._syncFromBuilderState();
                        }
                    });
                    mainButton.addEventListener('mouseup', () => {
                        if (window.stopBuilderChord) window.stopBuilderChord();
                    });

                    // Touch events
                    let touchHolding = false;
                    mainButton.addEventListener('touchstart', (e) => {
                        e.preventDefault();
                        touchHolding = true;
                        mainButton.dataset.held = 'true';
                        if (window.selectBuilderChordType) {
                            window.selectBuilderChordType(chordType, true);
                        }
                        window.lastTooltipChordSelection = { chordType, inversion: 0, chordRoot: null };
                        this.updateButtonHighlighting();
                        if (this.editor && this.editor._syncFromBuilderState) {
                            this.editor._syncFromBuilderState();
                        }
                    }, { passive: false });
                    mainButton.addEventListener('touchend', (e) => {
                        e.preventDefault();
                        touchHolding = false;
                        mainButton.dataset.held = 'false';
                        if (window.stopBuilderChord) window.stopBuilderChord();
                    }, { passive: false });
                    mainButton.addEventListener('touchcancel', (e) => {
                        e.preventDefault();
                        touchHolding = false;
                        mainButton.dataset.held = 'false';
                        if (window.stopBuilderChord) window.stopBuilderChord();
                    }, { passive: false });

                    buttonWrapper.appendChild(mainButton);

                    // Create tooltip
                    this._createChordTooltip(mainButton, chordType, `${rootNote}${symbol}`, description);

                    // Info icon
                    this._addInfoIcon(buttonWrapper, mainButton);

                    // Arpeggio buttons
                    this._addArpeggioButtons(buttonWrapper, chordType, null, null);

                    buttonGrid.appendChild(buttonWrapper);
                });

                groupContainer.appendChild(buttonGrid);
                grid.appendChild(groupContainer);
            });
        }

        container.appendChild(grid);

        // Check if no chords were found (grid is empty or has no children)
        if (grid.children.length === 0) {
            const enhPref = getEnharmonicPreference();
            const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
            const rootNote = notes[getBuilderRootIndex()];
            const scaleFilter = getScaleFilter();
            const paletteFilter = getPaletteFilter();

            // Build descriptive filter names
            const filterParts = [];
            if (mode === 'diatonic') {
                filterParts.push(`Diatonic to ${scaleFilter || 'Major'}`);
            } else if (scaleFilter) {
                filterParts.push(`${scaleFilter} scale`);
            }
            if (paletteFilter && CHORD_PALETTES[paletteFilter]) {
                filterParts.push(`${CHORD_PALETTES[paletteFilter].label} palette`);
            }

            const filterDescription = filterParts.length > 0
                ? filterParts.join(' + ')
                : 'the selected filters';

            // Create empty state message
            const emptyState = document.createElement('div');
            emptyState.className = 'flex flex-col items-center justify-center h-full text-center p-8';
            emptyState.innerHTML = `
                <svg class="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <h3 class="text-lg font-semibold text-gray-500 mb-2">No Chords Found</h3>
                <p class="text-sm text-gray-400 max-w-md">
                    No chords match <strong>${filterDescription}</strong> with root <strong>${rootNote}</strong>.
                </p>
                <p class="text-xs text-gray-400 mt-3">
                    Try changing the scale, palette, or switching to Chromatic mode.
                </p>
            `;

            container.innerHTML = '';
            container.appendChild(emptyState);
        }
    }

    /**
     * Add info icon to button wrapper (shared between diatonic and chromatic modes)
     */
    _addInfoIcon(buttonWrapper, mainButton) {
        const infoIcon = document.createElement('button');
        infoIcon.className = 'chord-info-icon';
        infoIcon.innerHTML = 'ℹ';
        infoIcon.style.cssText = 'position:absolute;bottom:1px;left:1px;width:12px;height:12px;border-radius:50%;background-color:rgba(107,114,128,0.5);color:rgba(255,255,255,0.8);font-size:8px;font-weight:600;display:flex;align-items:center;justify-content:center;border:none;cursor:pointer;z-index:10;padding:0;line-height:1;transition:all 0.2s';
        infoIcon.addEventListener('mouseenter', () => {
            infoIcon.style.backgroundColor = 'rgba(83,122,187,0.6)';
            infoIcon.style.color = 'white';
            infoIcon.style.transform = 'scale(1.15)';
        });
        infoIcon.addEventListener('mouseleave', () => {
            infoIcon.style.backgroundColor = 'rgba(107,114,128,0.5)';
            infoIcon.style.color = 'rgba(255,255,255,0.8)';
            infoIcon.style.transform = 'scale(1)';
        });
        infoIcon.addEventListener('mousedown', (e) => e.stopPropagation());
        infoIcon.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: false });
        infoIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            // Show tooltip on click for touch devices
            if (mainButton._tooltip) {
                const rect = mainButton.getBoundingClientRect();
                mainButton._tooltip.style.left = (rect.left + rect.width / 2) + 'px';
                mainButton._tooltip.style.top = (rect.top - 160 - 12) + 'px';
                mainButton._tooltip.style.transform = 'translateX(-50%)';
                mainButton._tooltip.style.opacity = '1';
                mainButton._tooltip.style.visibility = 'visible';
            }
        });
        buttonWrapper.appendChild(infoIcon);
    }

    /**
     * Add arpeggio up/down buttons to button wrapper
     * @param {HTMLElement} buttonWrapper - The wrapper element
     * @param {string} chordType - The chord type
     * @param {string|null} chordRoot - The chord root (for diatonic mode) or null
     * @param {number|null} chordRootIndex - The root index (for diatonic mode) or null
     */
    _addArpeggioButtons(buttonWrapper, chordType, chordRoot, chordRootIndex) {
        const arpContainer = document.createElement('div');
        arpContainer.className = 'flex flex-col w-8 border-l border-gray-300';

        // Arp Up
        const arpUp = document.createElement('button');
        arpUp.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800 border-b border-gray-300';
        arpUp.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path></svg>';
        arpUp.title = 'Arpeggio Up';
        arpUp.addEventListener('click', (e) => {
            e.stopPropagation();
            if (chordRoot && chordRootIndex !== null) {
                // Diatonic mode: temporarily switch root
                const originalRoot = getBuilderRootIndex();
                setBuilderRootIndex(chordRootIndex);
                if (window.playArpeggio) window.playArpeggio('chord', chordType, 'up');
                setBuilderRootIndex(originalRoot);
            } else {
                // Chromatic mode: use current root
                if (window.playArpeggio) window.playArpeggio('chord', chordType, 'up');
            }
        });
        arpContainer.appendChild(arpUp);

        // Arp Down
        const arpDown = document.createElement('button');
        arpDown.className = 'flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800';
        arpDown.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
        arpDown.title = 'Arpeggio Down';
        arpDown.addEventListener('click', (e) => {
            e.stopPropagation();
            if (chordRoot && chordRootIndex !== null) {
                // Diatonic mode: temporarily switch root
                const originalRoot = getBuilderRootIndex();
                setBuilderRootIndex(chordRootIndex);
                if (window.playArpeggio) window.playArpeggio('chord', chordType, 'down');
                setBuilderRootIndex(originalRoot);
            } else {
                // Chromatic mode: use current root
                if (window.playArpeggio) window.playArpeggio('chord', chordType, 'down');
            }
        });
        arpContainer.appendChild(arpDown);

        buttonWrapper.appendChild(arpContainer);
    }

    /**
     * Update button highlighting for diatonic mode
     */
    _updateDiatonicButtonHighlighting() {
        const container = this.container?.querySelector('#fs-chord-grid-container');
        if (!container) return;

        const lastDiatonic = getLastDiatonicChord();
        const currentChordType = getBuilderChordType();

        container.querySelectorAll('.key-button-wrapper[data-diatonic-mode="true"]').forEach(wrapper => {
            const chordType = wrapper.dataset.chordType;
            const chordRoot = wrapper.dataset.chordRoot;

            const isExactMatch = lastDiatonic && (chordRoot === lastDiatonic.root && chordType === lastDiatonic.type);
            const isTypeMatch = (chordType === currentChordType && !isExactMatch);

            // Update wrapper classes
            wrapper.className = `key-button-wrapper flex items-stretch rounded-lg shadow-sm overflow-hidden transition duration-150 transform hover:scale-105 ${isExactMatch ? 'bg-teal-100 ring-2 ring-teal-500' : isTypeMatch ? 'bg-teal-50 ring-1 ring-teal-300' : 'bg-gray-200'}`;

            // Update main button
            const mainButton = wrapper.querySelector('button[data-chord-type]');
            if (mainButton) {
                if (isExactMatch) {
                    mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium bg-teal-600 text-white hover:bg-teal-700';
                } else if (isTypeMatch) {
                    mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium bg-teal-200 text-gray-800 hover:bg-teal-300';
                } else {
                    mainButton.className = 'flex-grow px-1.5 py-1.5 text-center text-sm font-medium text-gray-800 hover:bg-indigo-100';
                }

                // Update text colors
                const typeSpan = mainButton.querySelector('span:first-child');
                const symbolSpan = mainButton.querySelector('span:last-child');
                if (typeSpan) {
                    typeSpan.className = `block text-xs font-bold leading-tight pointer-events-none ${isExactMatch ? 'text-white' : 'text-gray-800'}`;
                }
                if (symbolSpan) {
                    symbolSpan.className = `block ${isExactMatch ? 'text-white' : 'text-gray-500'} pointer-events-none`;
                    symbolSpan.style.fontSize = '0.65rem';
                    symbolSpan.style.lineHeight = '0.9';
                }
            }
        });
    }

    _generateScaleOptions() {
        const scaleCategories = {
            'Basic': ['Major', 'Natural Minor', 'Major Pentatonic', 'Minor Pentatonic', 'Blues'],
            'Modes': ['Dorian', 'Phrygian', 'Lydian', 'Mixolydian', 'Locrian'],
            'Minor Variants': ['Harmonic Minor', 'Melodic Minor'],
            'Jazz': ['Bebop Major', 'Bebop Dominant', 'Lydian Dominant', 'Altered']
        };

        let options = '';
        Object.entries(scaleCategories).forEach(([category, scales]) => {
            options += `<optgroup label="${category}">`;
            scales.forEach(scale => {
                if (SCALE_DEFINITIONS[scale]) {
                    options += `<option value="${scale}">${scale}</option>`;
                }
            });
            options += `</optgroup>`;
        });

        return options;
    }

    /**
     * Generate scale options with icons organized by category (matches classic chord lab)
     */
    _generateScaleOptionsWithIcons() {
        const currentScale = getScaleFilter();

        // Group scales by category using SCALE_CATEGORIES
        const scalesByCategory = {};
        Object.entries(SCALE_DEFINITIONS).forEach(([scaleName, scaleDef]) => {
            const category = scaleDef.category || 'other';
            if (!scalesByCategory[category]) {
                scalesByCategory[category] = [];
            }
            scalesByCategory[category].push(scaleName);
        });

        // Define category order for display (matches classic chord lab)
        const categoryOrder = ['basic', 'modes', 'minor-variants', 'symmetric', 'bebop', 'exotic', 'jazz'];

        let options = '';
        categoryOrder.forEach(categoryKey => {
            const scales = scalesByCategory[categoryKey];
            if (scales && scales.length > 0) {
                const categoryInfo = SCALE_CATEGORIES[categoryKey];
                const icon = categoryInfo?.icon || '';
                const name = categoryInfo?.name || categoryKey;

                options += `<optgroup label="${icon} ${name}" style="color: #1f2937; font-weight: bold; background: #f3f4f6;">`;

                // Sort scales alphabetically within category
                scales.sort().forEach(scaleName => {
                    const isSelected = scaleName === currentScale;
                    options += `<option value="${scaleName}" style="color: #374151; background: white;" ${isSelected ? 'selected' : ''}>${scaleName}</option>`;
                });

                options += `</optgroup>`;
            }
        });

        return options;
    }

    /**
     * Generate HTML options for the palette filter dropdown
     * Groups palettes by category (Genre, Mood, Function)
     */
    _generatePaletteOptions() {
        const currentPalette = getPaletteFilter();

        // Category display order and styling
        const categoryConfig = {
            genre: { label: 'Genre', icon: '🎵' },
            mood: { label: 'Mood', icon: '✨' },
            function: { label: 'Function', icon: '🧩' }
        };

        let options = '';

        // Generate options grouped by category
        Object.entries(categoryConfig).forEach(([categoryKey, config]) => {
            const palettes = getPalettesByCategory(categoryKey);
            if (palettes.length > 0) {
                options += `<optgroup label="${config.icon} ${config.label}" style="color: #1f2937; font-weight: bold; background: #f3f4f6;">`;

                palettes.forEach(palette => {
                    const isSelected = palette.id === currentPalette;
                    options += `<option value="${palette.id}" style="color: #374151; background: white;" ${isSelected ? 'selected' : ''}>${palette.label}</option>`;
                });

                options += `</optgroup>`;
            }
        });

        return options;
    }

    // ========================================================================
    // INTERVALS CONTENT (rendered to main area)
    // ========================================================================

    _renderIntervalsContent(container) {
        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootNote = notes[getBuilderRootIndex()];

        container.innerHTML = `
            <div class="h-full flex flex-col">
                <!-- Intervals header with gradient styling -->
                <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 flex-shrink-0">
                    <span class="text-white font-semibold text-sm">Intervals from ${rootNote}</span>
                </div>

                <!-- Interval grid (scrollable) -->
                <div class="flex-1 overflow-y-auto p-3">
                    ${this._renderIntervalsGrid()}
                </div>
            </div>
        `;
    }

    /**
     * Render interval grid using EXACT same layout as classic Chord Lab:
     * - Horizontal row of group columns (grid-cols-6)
     * - Each group is a bordered column with title and vertical list of buttons
     */
    _renderIntervalsGrid() {
        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootIndex = getBuilderRootIndex();
        const rootNote = notes[rootIndex];

        // Parent grid: groups laid out horizontally (same layout as chord library)
        let html = '<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">';

        // Use INTERVAL_GROUPS from music-data.js
        INTERVAL_GROUPS.forEach(group => {
            // Each group is a column
            html += `
                <div class="border border-gray-200 rounded-lg p-2 flex flex-col bg-white">
                    <h4 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 text-center">${group.title}</h4>
                    <div class="grid grid-cols-1 gap-1.5">
            `;

            group.types.forEach(intervalType => {
                const def = INTERVAL_DEFINITIONS[intervalType];
                if (!def) return;

                const symbol = def.symbol || '';

                html += `
                    <div class="key-button-wrapper flex items-stretch rounded-lg shadow-sm overflow-hidden bg-gray-200 transition duration-150 transform hover:scale-105">
                        <!-- Main button for interval (press-and-hold) -->
                        <button class="flex-grow px-1.5 py-1.5 text-center text-sm font-medium text-gray-800 hover:bg-emerald-100"
                                data-interval-type="${intervalType}"
                                onmousedown="window.selectBuilderInterval && window.selectBuilderInterval('${intervalType}', true)"
                                onmouseup="window.stopBuilderChord && window.stopBuilderChord()"
                                onmouseleave="window.stopBuilderChord && window.stopBuilderChord()"
                                ontouchstart="event.preventDefault(); window.selectBuilderInterval && window.selectBuilderInterval('${intervalType}', true)"
                                ontouchend="event.preventDefault(); window.stopBuilderChord && window.stopBuilderChord()"
                                title="${def.description || intervalType}">
                            <span class="block text-xs font-bold leading-tight pointer-events-none">${intervalType}</span>
                            <span class="block text-gray-500 pointer-events-none" style="font-size: 0.65rem; line-height: 0.9;">${symbol}</span>
                        </button>

                        <!-- Arpeggio buttons container -->
                        <div class="flex flex-col w-10 border-l border-gray-300">
                            <!-- Arp Up -->
                            <button class="flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800 border-b border-gray-300"
                                    onclick="event.stopPropagation(); window.playArpeggio && window.playArpeggio('interval', '${intervalType}', 'up')"
                                    title="Arpeggio Up">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"></path>
                                </svg>
                            </button>
                            <!-- Arp Down -->
                            <button class="flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-300 hover:text-gray-800"
                                    onclick="event.stopPropagation(); window.playArpeggio && window.playArpeggio('interval', '${intervalType}', 'down')"
                                    title="Arpeggio Down">
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                                </svg>
                            </button>
                        </div>
                    </div>
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

    // ========================================================================
    // SUBSTITUTIONS CONTENT (rendered to main area)
    // Shows chord substitution options with educational descriptions
    // ========================================================================

    _renderSubstitutionsContent(container) {
        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

        // Use locked chord if available, otherwise capture from builder state
        if (!this.lockedSubstitutionChord) {
            const rootIndex = getBuilderRootIndex();
            const chordType = getBuilderChordType();
            const chordDef = CHORD_DEFINITIONS[chordType];
            this.lockedSubstitutionChord = {
                root: notes[rootIndex],
                rootIndex: rootIndex,
                chordType: chordType,
                symbol: chordDef?.symbol || ''
            };
        }

        const rootNote = this.lockedSubstitutionChord.root;
        const chordType = this.lockedSubstitutionChord.chordType;
        const chordSymbol = this.lockedSubstitutionChord.symbol;

        // Calculate substitutions for the locked chord
        const substitutions = calculateChordSubstitutions(rootNote, chordType, notes);

        // Group substitutions by type
        const groupedSubs = {};
        substitutions.forEach(sub => {
            if (!groupedSubs[sub.type]) {
                groupedSubs[sub.type] = [];
            }
            groupedSubs[sub.type].push(sub);
        });

        container.innerHTML = `
            <div class="h-full flex flex-col">
                <!-- Header bar -->
                <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-700 to-amber-600 flex-shrink-0">
                    <div class="flex items-center gap-3">
                        <span class="text-white font-semibold text-sm" style="-webkit-text-fill-color: white;">Substitutions for</span>
                        <span class="px-3 py-1 bg-white/20 rounded-full text-white font-bold text-lg" style="-webkit-text-fill-color: white;">${rootNote}${chordSymbol}</span>
                        <span class="text-white/70 text-xs" style="-webkit-text-fill-color: rgba(255,255,255,0.7);">(${chordType})</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-white/60 text-xs hidden sm:inline" style="-webkit-text-fill-color: rgba(255,255,255,0.6);">Click chord buttons to preview • Locked to selected chord</span>
                        <button id="update-locked-chord-btn" class="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs font-medium flex items-center gap-1.5 transition-all" title="Update to current chord in builder">
                            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/>
                            </svg>
                            <span style="-webkit-text-fill-color: white;">Update Chord</span>
                        </button>
                    </div>
                </div>

                <!-- Substitutions grid (scrollable) -->
                <div class="flex-1 overflow-y-auto p-4">
                    ${substitutions.length === 0 ? `
                        <div class="flex items-center justify-center h-full text-gray-500">
                            <div class="text-center">
                                <svg class="w-12 h-12 mx-auto mb-3 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1z" clip-rule="evenodd"/>
                                </svg>
                                <p class="font-medium">No substitutions available</p>
                                <p class="text-sm">Try selecting a different chord type</p>
                            </div>
                        </div>
                    ` : this._renderSubstitutionGroups(groupedSubs, rootNote, chordType)}
                </div>
            </div>
        `;

        // Attach event handlers for substitution buttons
        this._attachSubstitutionHandlers(container);

        // "Update Chord" button handler - updates the locked chord from current builder state
        const updateBtn = container.querySelector('#update-locked-chord-btn');
        if (updateBtn) {
            updateBtn.addEventListener('click', () => {
                const enhPref = getEnharmonicPreference();
                const notesArr = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
                const newRootIndex = getBuilderRootIndex();
                const newChordType = getBuilderChordType();
                const chordDef = CHORD_DEFINITIONS[newChordType];

                this.lockedSubstitutionChord = {
                    root: notesArr[newRootIndex],
                    rootIndex: newRootIndex,
                    chordType: newChordType,
                    symbol: chordDef?.symbol || ''
                };

                // Re-render with new chord
                this._renderSubstitutionsContent(container);
            });
        }
    }

    /**
     * Render grouped substitution sections
     */
    _renderSubstitutionGroups(groupedSubs, originalRoot, originalType) {
        const originalSymbol = CHORD_DEFINITIONS[originalType]?.symbol || '';
        const originalLabel = `${originalRoot}${originalSymbol}`;

        let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">';

        // Define display order for substitution types
        const typeOrder = ['tritoneSub', 'relativeMinor', 'diatonicThird', 'secondaryDominant', 'parallelMode', 'qualityChange', 'diminishedPassing', 'commonTone'];

        typeOrder.forEach(typeId => {
            const subs = groupedSubs[typeId];
            if (!subs || subs.length === 0) return;

            const typeInfo = getSubstitutionType(typeId);
            if (!typeInfo) return;

            html += `
                <div class="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                    <!-- Section header with gradient -->
                    <div class="px-4 py-3 bg-gradient-to-r ${typeInfo.color} text-white">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <span class="text-lg">${typeInfo.icon}</span>
                                <span class="font-semibold">${typeInfo.label}</span>
                            </div>
                            <!-- Play Original button -->
                            <button class="play-original-btn px-2 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium flex items-center gap-1 transition-all"
                                    data-root="${originalRoot}"
                                    data-type="${originalType}"
                                    title="Play original chord ${originalLabel}">
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                                </svg>
                                <span>${originalLabel}</span>
                            </button>
                        </div>
                    </div>

                    <!-- Description -->
                    <div class="px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <p class="text-xs text-gray-600 leading-relaxed">${typeInfo.description}</p>
                    </div>

                    <!-- How to use -->
                    <div class="px-4 py-2 bg-amber-50/70 border-b border-amber-200">
                        <p class="text-xs text-amber-700"><strong>How to use:</strong> ${typeInfo.howToUse}</p>
                    </div>

                    <!-- Substitution chord buttons -->
                    <div class="p-3">
                        <div class="flex flex-wrap gap-2">
                            ${subs.map(sub => this._renderSubstitutionButton(sub, typeInfo)).join('')}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    /**
     * Render a single substitution chord button
     */
    _renderSubstitutionButton(sub, typeInfo) {
        const isPrefix = sub.isPrefix ? '→' : '';
        const prefixLabel = sub.isPrefix ? '<span class="text-[9px] text-amber-700 block">Use before target</span>' : '';

        return `
            <div class="substitution-chord-btn flex flex-col items-center p-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-all hover:scale-105 hover:shadow-md min-w-[70px]"
                 data-root="${sub.root}"
                 data-type="${sub.chordType}"
                 data-sub-type="${sub.type}"
                 title="${sub.reason}">
                <span class="text-sm font-bold text-gray-800">${sub.label}</span>
                ${prefixLabel}
                <span class="text-[10px] text-gray-500 mt-1 text-center leading-tight max-w-[100px]">${sub.reason.split(' - ')[0]}</span>
            </div>
        `;
    }

    /**
     * Attach event handlers for substitution buttons (preview-only, no state changes)
     */
    _attachSubstitutionHandlers(container) {
        // Helper function to play a chord preview
        // Note: This changes the builder state to play the chord, which updates the sidebar.
        // The substitution panel itself stays locked to the original chord.
        // The sidebar showing the previewed chord is helpful feedback for the user.
        const playChordPreview = (root, chordType) => {
            const enhPref = getEnharmonicPreference();
            const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
            const rootIndex = notes.indexOf(root);

            if (rootIndex !== -1) {
                setBuilderRootIndex(rootIndex);
                if (window.selectBuilderChordType) {
                    window.selectBuilderChordType(chordType, true); // true = play
                }

                // Sync sidebar to show the previewed chord
                if (this.editor && this.editor._syncFromBuilderState) {
                    this.editor._syncFromBuilderState();
                }
            }
        };

        // Substitution chord buttons - preview only
        const buttons = container.querySelectorAll('.substitution-chord-btn');
        buttons.forEach(btn => {
            btn.addEventListener('mousedown', () => {
                playChordPreview(btn.dataset.root, btn.dataset.type);
            });

            btn.addEventListener('mouseup', () => {
                if (window.stopBuilderChord) window.stopBuilderChord();
            });

            btn.addEventListener('mouseleave', () => {
                if (window.stopBuilderChord) window.stopBuilderChord();
            });

            // Touch events
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                playChordPreview(btn.dataset.root, btn.dataset.type);
            }, { passive: false });

            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (window.stopBuilderChord) window.stopBuilderChord();
            }, { passive: false });
        });

        // "Play Original" buttons - play the locked chord
        const originalButtons = container.querySelectorAll('.play-original-btn');
        originalButtons.forEach(btn => {
            btn.addEventListener('mousedown', () => {
                playChordPreview(btn.dataset.root, btn.dataset.type);
            });

            btn.addEventListener('mouseup', () => {
                if (window.stopBuilderChord) window.stopBuilderChord();
            });

            btn.addEventListener('mouseleave', () => {
                if (window.stopBuilderChord) window.stopBuilderChord();
            });

            // Touch events
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                playChordPreview(btn.dataset.root, btn.dataset.type);
            }, { passive: false });

            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                if (window.stopBuilderChord) window.stopBuilderChord();
            }, { passive: false });
        });
    }

    // ========================================================================
    // PROGRESSION CONTENT (rendered to main area)
    // EXACTLY mirrors Composition Studio's FullScreenBottomPanel._renderChordsPanel
    // ========================================================================

    _renderProgressionContent(container) {
        const compState = window.getCompositionState?.();
        // Use buildSectionView() to get all sections including auto-materialized ungrouped sections
        const sections = compState?.buildSectionView?.() || compState?.getSections?.() || [];
        const hasSections = sections.length > 0;

        // Get progression data
        const trainerState = getTrainerState();
        const chords = trainerState?.progressionData || [];
        const key = trainerState?.currentKey || 'C';
        const chordCount = chords.length;

        // Header with view mode toggle and action buttons - EXACTLY like Composition Studio
        container.innerHTML = `
            <div class="h-full flex flex-col">
                <!-- Gradient header matching Composition Studio -->
                <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 border-b border-purple-700 flex-shrink-0">
                    <span class="text-white text-sm font-semibold" style="-webkit-text-fill-color: white;">
                        Chord Progression
                        <span class="ml-2 px-1.5 py-0.5 bg-white/20 text-white rounded-full text-[10px]">${chordCount}</span>
                    </span>
                    <div class="flex items-center gap-1.5">
                        <!-- Action Buttons -->
                        <button id="fs-cl-chords-colors-btn" class="px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-[10px] font-medium rounded transition flex items-center gap-1" title="View chord function color legend">
                            <span class="text-[8px]" style="-webkit-text-fill-color: #86efac;">●</span>
                            <span class="text-[8px]" style="-webkit-text-fill-color: #7dd3fc;">●</span>
                            <span class="text-[8px]" style="-webkit-text-fill-color: #fcd34d;">●</span>
                            <span>Legend</span>
                        </button>
                        <!-- View Mode Toggle -->
                        <div class="flex gap-0.5 bg-white/20 rounded-lg p-0.5">
                            <button class="fs-cl-view-mode-btn px-2 py-1 text-xs font-medium rounded-md transition-all ${this.viewMode === 'scroll' ? 'bg-white shadow text-indigo-600' : 'text-white/80 hover:text-white'}"
                                    data-mode="scroll" style="${this.viewMode === 'scroll' ? '-webkit-text-fill-color: #4f46e5;' : ''}">
                                Scroll
                            </button>
                            <button class="fs-cl-view-mode-btn px-2 py-1 text-xs font-medium rounded-md transition-all ${this.viewMode === 'section' ? 'bg-white shadow text-indigo-600' : 'text-white/80 hover:text-white'}"
                                    data-mode="section" style="${this.viewMode === 'section' ? '-webkit-text-fill-color: #4f46e5;' : ''}">
                                Section
                            </button>
                        </div>
                    </div>
                </div>
                <!-- Section picker bar (visible in section view mode when sections exist) -->
                <div id="fs-cl-section-picker" class="${this.viewMode === 'section' && hasSections ? '' : 'hidden'}"></div>
                <!-- Cards container -->
                <div id="fs-cl-chord-cards-container" class="flex flex-nowrap items-start gap-1 pl-4 pr-2 mt-2" style="width: 100%; height: calc(100% - ${this.viewMode === 'section' && hasSections ? '120px' : '58px'}); scroll-behavior: smooth; -webkit-overflow-scrolling: touch; overflow-x: auto; overflow-y: visible; padding-bottom: 24px; padding-top: 4px;">
                </div>
                <style>
                    #fs-cl-chord-cards-container::-webkit-scrollbar { height: 10px; }
                    #fs-cl-chord-cards-container::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 5px; margin: 0 8px; }
                    #fs-cl-chord-cards-container::-webkit-scrollbar-thumb { background: linear-gradient(to right, #8b5cf6, #6366f1); border-radius: 5px; }
                    #fs-cl-chord-cards-container::-webkit-scrollbar-thumb:hover { background: linear-gradient(to right, #7c3aed, #4f46e5); }
                    #fs-cl-chord-cards-container { scrollbar-width: auto; scrollbar-color: #8b5cf6 #f1f5f9; }

                    /* Selection styling */
                    #fs-cl-chord-cards-container .chord-card-wrapper {
                        outline: none !important;
                        outline-offset: 0 !important;
                    }
                    #fs-cl-chord-cards-container .simplified-card[data-selected="true"],
                    #fs-cl-chord-cards-container .detailed-card[data-selected="true"] {
                        border: 3px solid #a855f7 !important;
                        box-sizing: border-box !important;
                    }
                </style>
            </div>
        `;

        // Attach view mode handlers
        container.querySelectorAll('.fs-cl-view-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.viewMode = btn.dataset.mode;
                this._saveToStorage(STORAGE_KEYS.VIEW_MODE, this.viewMode);
                this._renderProgressionContent(container);
            });
        });

        // Attach Colors button handler
        container.querySelector('#fs-cl-chords-colors-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof window.toggleChordFunctionLegend === 'function') {
                window.toggleChordFunctionLegend();
            } else if (typeof window.showChordFunctionLegend === 'function') {
                window.showChordFunctionLegend();
            } else if (window.toast) {
                window.toast.info('Color legend shows chord functions: Tonic (I, vi), Subdominant (IV, ii), Dominant (V, vii°)');
            }
        });

        const cardsContainer = container.querySelector('#fs-cl-chord-cards-container');
        const sectionPicker = container.querySelector('#fs-cl-section-picker');

        if (!cardsContainer) return;

        if (chords.length === 0) {
            cardsContainer.innerHTML = `
                <div class="flex items-center justify-center w-full h-full">
                    <div class="text-center text-gray-400">
                        <p class="text-lg mb-2">No chords in progression</p>
                        <p class="text-sm">Use the sidebar or Library panel to add chords</p>
                    </div>
                </div>
            `;
            return;
        }

        // Render based on view mode - EXACTLY mirroring Composition Studio
        if (this.viewMode === 'section' && hasSections) {
            // Section View: show section picker and filtered cards
            this._renderCLSectionPicker(sectionPicker, sections);
            this._renderCLSectionViewCards(cardsContainer, chords, key, sections);
        } else {
            // Scroll View: horizontal scrolling with section-aware layout
            this._renderCLScrollViewCards(cardsContainer, chords, key, sections);
        }

        // Render bass motion indicators between chord cards (respects Experience Mode - Explore only)
        renderBassMotionIndicators(cardsContainer, chords, key);
    }

    /**
     * Render section picker bar for section view mode
     */
    _renderCLSectionPicker(container, sections) {
        if (!container) return;

        const compState = window.getCompositionState?.();
        const sectionView = compState?.buildSectionView?.() || sections;

        container.innerHTML = `
            <div class="section-picker-bar flex items-center gap-2 p-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200 mx-2 mt-2">
                <!-- Previous section button -->
                <button class="fs-cl-section-nav-btn p-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-100 transition-all flex-shrink-0" title="Previous section">
                    <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                    </svg>
                </button>
                <!-- All button -->
                <button class="fs-cl-section-all-btn px-2.5 py-1.5 text-xs font-semibold rounded-full transition-all flex-shrink-0
                               ${this.selectedSectionIds.size === 0 ? 'bg-indigo-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}">
                    All
                </button>
                <!-- Section chips container -->
                <div class="fs-cl-section-chips-container flex items-center gap-1.5 flex-1 overflow-x-auto py-1 px-1" style="scrollbar-width: none;"></div>
                <!-- Next section button -->
                <button class="fs-cl-section-nav-btn-next p-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-100 transition-all flex-shrink-0" title="Next section">
                    <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                </button>
            </div>
        `;

        // Populate section chips
        const chipsContainer = container.querySelector('.fs-cl-section-chips-container');
        sectionView.forEach(section => {
            const isSelected = this.selectedSectionIds.has(section.id);
            const chip = this._createCLSectionChip(section, isSelected, container);
            chipsContainer.appendChild(chip);
        });

        // All button handler
        container.querySelector('.fs-cl-section-all-btn')?.addEventListener('click', () => {
            this.selectedSectionIds.clear();
            this._renderProgressionContent(this.container.querySelector('#fs-chordlab-main-content'));
        });

        // Initialize sortable on chips for drag-drop reordering
        this._initializeCLSectionChipsSortable(chipsContainer);
    }

    /**
     * Create a section chip element
     */
    _createCLSectionChip(section, isSelected, parentContainer) {
        const chip = document.createElement('button');
        const chordCount = section.chordIndices?.length || section.chordCount || 0;
        const sectionColor = section.color || '#c084fc';

        chip.className = `fs-cl-section-chip flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold
                          transition-all duration-200 flex-shrink-0 cursor-pointer
                          ${isSelected ? 'ring-2 ring-offset-2 shadow-lg transform scale-105' : 'hover:scale-102'}`;
        chip.style.cssText = `
            background: ${isSelected ? this._hexToRgba(sectionColor, 0.35) : this._hexToRgba(sectionColor, 0.08)};
            border: 2px solid ${isSelected ? sectionColor : this._hexToRgba(sectionColor, 0.25)};
            color: ${isSelected ? '#1f2937' : '#6b7280'};
            ${isSelected ? `--tw-ring-color: ${sectionColor}; box-shadow: 0 4px 12px ${this._hexToRgba(sectionColor, 0.4)};` : ''}
        `;

        chip.innerHTML = `
            <span class="fs-cl-section-chip-drag-handle cursor-grab active:cursor-grabbing"><svg class="w-3 h-3 opacity-40 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
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
            if (e.target.closest('.fs-cl-section-chip-drag-handle')) return;

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
            this._renderProgressionContent(this.container.querySelector('#fs-chordlab-main-content'));
        });

        return chip;
    }

    /**
     * Render cards in section view mode (filtered by selected sections)
     */
    _renderCLSectionViewCards(container, chords, key, sections) {
        container.innerHTML = '';

        const compState = window.getCompositionState?.();
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
            const sectionContainer = this._createCLUnifiedSectionContainer(section, chords, key);
            if (sectionContainer) {
                sectionContainer.style.scrollSnapAlign = 'start';
                sectionContainer.style.flexShrink = '0';
                container.appendChild(sectionContainer);
            }

            // Add separator between sections
            if (sectionIdx < selectedSections.length - 1) {
                const separator = document.createElement('div');
                separator.className = 'fs-cl-section-separator flex-shrink-0 w-px bg-gray-300 mx-2 self-stretch';
                separator.style.minHeight = '80px';
                container.appendChild(separator);
            }
        });

        // Initialize sortable for section containers
        this._initializeCLSectionContainerSortable(container);
    }

    /**
     * Render cards in scroll view mode (section-aware with banners)
     */
    _renderCLScrollViewCards(container, chords, key, sections) {
        container.innerHTML = '';

        const compState = window.getCompositionState?.();
        const sectionView = compState?.buildSectionView?.() || [];

        if (sectionView.length > 0) {
            // Render each section using unified container
            sectionView.forEach(section => {
                const sectionContainer = this._createCLUnifiedSectionContainer(section, chords, key);
                if (sectionContainer) {
                    sectionContainer.style.scrollSnapAlign = 'start';
                    sectionContainer.style.flexShrink = '0';
                    container.appendChild(sectionContainer);
                }
            });

            // Initialize sortable for section containers
            this._initializeCLSectionContainerSortable(container);
        } else {
            // No sections - render flat cards
            chords.forEach((chord, index) => {
                const wrapper = this._createCLChordCardWrapper(chord, index, key);
                if (wrapper) {
                    wrapper.style.scrollSnapAlign = 'start';
                    wrapper.style.flexShrink = '0';
                    container.appendChild(wrapper);
                }
            });

            // Initialize sortable for flat cards
            this._initializeCLSimplifiedSortable(container);
        }
    }

    /**
     * Create unified section container with banner and grouped cards
     */
    _createCLUnifiedSectionContainer(section, progressionData, key) {
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
                    const wrapper = this._createCLChordCardWrapper(chord, chordIdx, key);
                    wrapper.setAttribute('data-in-section', section.id);
                    cardsArea.appendChild(wrapper);
                }
            });
        }

        container.appendChild(cardsArea);

        // Initialize sortable on the cards area
        this._initializeCLCardsAreaSortable(cardsArea, section.id);

        return container;
    }

    /**
     * Create chord card wrapper - matches Composition Studio style
     */
    _createCLChordCardWrapper(chord, index, key) {
        // Use Composition Studio's createChordCardWrapper if available
        if (typeof window.createChordCardWrapper === 'function') {
            const wrapper = window.createChordCardWrapper(chord, index, key);
            // Strip fullscreen-only elements
            this._stripFullscreenOnlyElements(wrapper);
            wrapper.setAttribute('data-fs-card', 'true');
            return wrapper;
        }

        // Fallback: create simplified card
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
     * Strip fullscreen-only elements from chord card
     */
    _stripFullscreenOnlyElements(wrapper) {
        if (!wrapper) return;
        const expandBtn = wrapper.querySelector('.expand-btn');
        if (expandBtn) expandBtn.remove();
        const notationToggleBtn = wrapper.querySelector('.notation-toggle-btn');
        if (notationToggleBtn) notationToggleBtn.remove();
        const notationView = wrapper.querySelector('.notation-view');
        if (notationView) notationView.remove();
        const expandedCard = wrapper.querySelector('.expanded-chord-card');
        if (expandedCard) expandedCard.remove();
    }

    /**
     * Helper: Convert hex color to rgba
     */
    _hexToRgba(hex, alpha) {
        if (!hex || hex.length < 7) return `rgba(192, 132, 252, ${alpha})`;
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
     * Initialize Sortable on section containers
     */
    _initializeCLSectionContainerSortable(container) {
        if (typeof Sortable === 'undefined') return;

        if (container.sortableInstance) {
            container.sortableInstance.destroy();
        }

        container.sortableInstance = new Sortable(container, {
            group: {
                name: 'fs-cl-progression-cards',
                pull: true,
                put: true
            },
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            handle: '.drag-handle, .section-banner',
            draggable: '.chord-card-wrapper[data-chord-index], .section-unified-container',
            swapThreshold: 0.4,
            sort: true,
            filter: 'button, select, input, .play-btn, .delete-btn, .expand-btn, .no-drag',
            preventOnFilter: false,
            onEnd: (evt) => {
                const draggedItem = evt.item;
                if (draggedItem.classList.contains('section-unified-container')) {
                    this._handleCLSectionReorder(evt, container);
                } else if (draggedItem.classList.contains('chord-card-wrapper')) {
                    if (evt.from === evt.to) {
                        window.saveStateBeforeChange?.();
                        const fromSectionId = evt.from.getAttribute('data-section-id');
                        this._handleCLCardDrag(evt, fromSectionId);
                    }
                }
            },
            onAdd: (evt) => {
                window.saveStateBeforeChange?.();
                const fromSectionId = evt.from.getAttribute('data-section-id');
                this._handleCLCardDrag(evt, fromSectionId);
            }
        });
    }

    /**
     * Initialize Sortable on cards area
     */
    _initializeCLCardsAreaSortable(cardsArea, sectionId) {
        if (typeof Sortable === 'undefined') return;

        if (cardsArea.sortableInstance) {
            cardsArea.sortableInstance.destroy();
        }

        cardsArea.sortableInstance = new Sortable(cardsArea, {
            group: {
                name: 'fs-cl-progression-cards',
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
                    this._handleCLCardDrag(evt, sectionId);
                }
            },
            onAdd: (evt) => {
                window.saveStateBeforeChange?.();
                this._handleCLCardDrag(evt, evt.from.getAttribute('data-section-id'));
            }
        });
    }

    /**
     * Initialize Sortable for flat cards (no sections)
     */
    _initializeCLSimplifiedSortable(container) {
        if (typeof Sortable === 'undefined') return;

        if (container.sortableInstance) {
            container.sortableInstance.destroy();
        }

        container.sortableInstance = new Sortable(container, {
            group: {
                name: 'fs-cl-progression-cards',
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
                    this._renderProgressionContent(this.container.querySelector('#fs-chordlab-main-content'));
                }
            },
            onAdd: (evt) => {
                window.saveStateBeforeChange?.();
                this._handleCLCardDrag(evt, evt.from.getAttribute('data-section-id'));
            }
        });
    }

    /**
     * Initialize Sortable on section chips
     */
    _initializeCLSectionChipsSortable(chipsContainer) {
        if (typeof Sortable === 'undefined') return;

        if (chipsContainer.sortableInstance) {
            chipsContainer.sortableInstance.destroy();
        }

        chipsContainer.sortableInstance = new Sortable(chipsContainer, {
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            draggable: '.fs-cl-section-chip',
            handle: '.fs-cl-section-chip-drag-handle',
            delay: 100,
            delayOnTouchOnly: true,
            touchStartThreshold: 3,
            onEnd: (evt) => {
                this._handleCLSectionChipReorder(evt, chipsContainer);
            }
        });
    }

    /**
     * Handle section reorder via drag
     */
    _handleCLSectionReorder(evt, container) {
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
            this._renderProgressionContent(this.container.querySelector('#fs-chordlab-main-content'));
        }
    }

    /**
     * Handle section chip reorder
     */
    _handleCLSectionChipReorder(evt, chipsContainer) {
        window.saveStateBeforeChange?.();

        const compState = window.getCompositionState?.();
        const trainerState = window.getTrainerState?.();
        if (!compState || !trainerState) return;

        const allChips = Array.from(chipsContainer.querySelectorAll('.fs-cl-section-chip'));
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
            this._renderProgressionContent(this.container.querySelector('#fs-chordlab-main-content'));
        }
    }

    /**
     * Handle card drag within or between sections
     */
    _handleCLCardDrag(evt, fromSectionId) {
        // Delegate to Composition Studio's handler if available
        if (typeof window.handleCardDragWithinSection === 'function') {
            window.handleCardDragWithinSection(evt, fromSectionId);
            // Refresh chord lab panel
            setTimeout(() => {
                this._renderProgressionContent(this.container.querySelector('#fs-chordlab-main-content'));
            }, 100);
            return;
        }

        // Fallback: simple reorder logic
        window.invalidateProgressionDataCache?.();
        window.refreshNotationFromProgression?.();
        window.renderProgressionDisplay?.('melody-progression-visualization', false);
        this._renderProgressionContent(this.container.querySelector('#fs-chordlab-main-content'));
    }

    // ========================================================================
    // IDENTIFIER CONTENT (rendered to main area)
    // ========================================================================

    _renderIdentifierContent(container) {
        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

        container.innerHTML = `
            <div class="h-full flex flex-col">
                <!-- Identifier header - gradient banner matching Library/Intervals -->
                <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-cyan-600 to-sky-600 flex-shrink-0">
                    <span class="text-white font-semibold text-sm">Chord Identifier</span>
                    <div class="flex items-center gap-2">
                        <button onclick="window.fsChordLabClearIdentifier && window.fsChordLabClearIdentifier()"
                                class="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-medium rounded-full transition-colors">
                            Clear
                        </button>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto p-3">
                    <!-- Input section -->
                    <div class="mb-4">
                        <label class="text-gray-500 text-xs block mb-1">Enter notes (space, comma, or hyphen separated)</label>
                        <div class="flex gap-2">
                            <input type="text" id="fs-identifier-input"
                                   placeholder="e.g., C E G or C, E, G or C-E-G"
                                   class="flex-1 px-3 py-2 bg-white text-gray-700 rounded-lg border border-gray-300 focus:border-cyan-500 focus:outline-none text-sm"
                                   onkeydown="if(event.key === 'Enter') window.fsChordLabIdentify && window.fsChordLabIdentify()">
                            <button onclick="window.fsChordLabIdentify && window.fsChordLabIdentify()"
                                    class="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg transition-colors">
                                Identify
                            </button>
                        </div>
                    </div>

                    <!-- Quick note buttons -->
                    <div class="mb-4">
                        <label class="text-gray-500 text-xs block mb-1">Quick add notes</label>
                        <div class="flex flex-wrap gap-1">
                            ${notes.map(note => `
                                <button onclick="window.fsChordLabAddNote && window.fsChordLabAddNote('${note}')"
                                        class="px-2.5 py-1.5 bg-gray-100 hover:bg-cyan-100 text-gray-700 hover:text-cyan-700 text-xs font-medium rounded border border-gray-200 hover:border-cyan-300 transition-colors">
                                    ${note}
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Results -->
                    <div id="fs-identifier-results">
                        ${this._renderIdentifierResults()}
                    </div>
                </div>
            </div>
        `;

        // Attach event handlers
        window.fsChordLabIdentify = () => this._identifyChord();
        window.fsChordLabClearIdentifier = () => this._clearIdentifier();
        window.fsChordLabAddNote = (note) => this._addNoteToIdentifier(note);
    }

    _renderIdentifierResults() {
        if (this.identifierResults.length === 0) {
            return `
                <div class="text-gray-400 text-center py-8">
                    <p>Enter notes above to identify possible chords</p>
                </div>
            `;
        }

        return `
            <div class="space-y-2">
                <h3 class="text-gray-600 text-sm font-semibold">Matching Chords</h3>
                ${this.identifierResults.map(result => `
                    <div class="bg-violet-50 rounded-lg p-3 border border-violet-200 hover:border-violet-400 transition-colors">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-lg font-bold text-violet-900">${result.symbol}</span>
                            <span class="text-xs px-2 py-0.5 ${result.matchType === 'Exact' ? 'bg-green-500 text-white' : result.matchType === 'Extended' ? 'bg-blue-500 text-white' : 'bg-yellow-400 text-yellow-900'} rounded">${result.matchType}</span>
                        </div>
                        <div class="text-xs text-gray-600">${result.fullName}</div>
                        ${result.missingNotes.length > 0 ? `<div class="text-xs text-orange-600 mt-1">Missing: ${result.missingNotes.join(', ')}</div>` : ''}
                        ${result.extraNotes.length > 0 ? `<div class="text-xs text-blue-600 mt-1">Extra: ${result.extraNotes.join(', ')}</div>` : ''}
                        <div class="mt-2 flex gap-2">
                            <button onmousedown="window.playChordPreview && window.playChordPreview('${result.root}', '${result.type}', ${result.inversion})"
                                    onmouseup="window.stopChordPreview && window.stopChordPreview()"
                                    onmouseleave="window.stopChordPreview && window.stopChordPreview()"
                                    ontouchstart="window.playChordPreview && window.playChordPreview('${result.root}', '${result.type}', ${result.inversion})"
                                    ontouchend="window.stopChordPreview && window.stopChordPreview()"
                                    class="px-2 py-1 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded flex items-center gap-1 select-none">
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/></svg>
                                Play
                            </button>
                            <button onclick="window.addChordToProgressionByParams && window.addChordToProgressionByParams('${result.type}', '${result.root}', ${result.inversion}, 0)"
                                    class="px-2 py-1 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded flex items-center gap-1">
                                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>
                                Add to Progression
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    _identifyChord() {
        const input = this.container?.querySelector('#fs-identifier-input');
        if (!input) return;

        const inputValue = input.value.trim();
        if (!inputValue) {
            this.identifierResults = [];
            this._updateIdentifierResults();
            return;
        }

        // Parse notes from input (supports space, comma, hyphen separators)
        const notes = this._parseNoteInput(inputValue);

        if (notes.length < 2) {
            this.identifierResults = [];
            this._updateIdentifierResults();
            return;
        }

        // Convert notes to pitch classes
        const pitchClasses = notes.map(n => this._noteToPitchClass(n)).filter(pc => pc !== null);

        if (pitchClasses.length < 2) {
            this.identifierResults = [];
            this._updateIdentifierResults();
            return;
        }

        // Find matching chords
        this.identifierResults = this._findMatchingChords(pitchClasses, notes);
        this._updateIdentifierResults();
    }

    /**
     * Parse note input string into array of note names (without octaves)
     */
    _parseNoteInput(inputStr) {
        if (!inputStr || typeof inputStr !== 'string') return [];

        // Replace all delimiters with space, then split
        const normalized = inputStr
            .replace(/[,\-:]/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        // Normalize note names (strip octave numbers, uppercase first letter)
        const notes = normalized.map(n => {
            const noteOnly = n.replace(/\d+$/, '');
            return noteOnly.charAt(0).toUpperCase() + noteOnly.slice(1).toLowerCase();
        });

        // Remove duplicates
        return [...new Set(notes)];
    }

    /**
     * Convert a note to its pitch class (0-11)
     */
    _noteToPitchClass(note) {
        const noteMap = {
            'C': 0, 'C#': 1, 'Db': 1,
            'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4, 'Fb': 4, 'E#': 5,
            'F': 5, 'F#': 6, 'Gb': 6,
            'G': 7, 'G#': 8, 'Ab': 8,
            'A': 9, 'A#': 10, 'Bb': 10,
            'B': 11, 'Cb': 11, 'B#': 0
        };
        return noteMap[note] ?? null;
    }

    /**
     * Convert pitch class to note name
     */
    _pitchClassToNote(pc, preferSharps = true) {
        const sharpNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
        return preferSharps ? sharpNotes[pc] : flatNotes[pc];
    }

    /**
     * Find chords that match the given pitch classes
     */
    _findMatchingChords(inputPitchClasses, inputNotes) {
        const matches = [];

        // Define chord intervals for matching
        const chordIntervals = {
            'Major': [0, 4, 7],
            'Minor': [0, 3, 7],
            'Diminished': [0, 3, 6],
            'Augmented': [0, 4, 8],
            'Sus2': [0, 2, 7],
            'Sus4': [0, 5, 7],
            'Dominant 7th': [0, 4, 7, 10],
            'Major 7th': [0, 4, 7, 11],
            'Minor 7th': [0, 3, 7, 10],
            'Minor-Major 7th': [0, 3, 7, 11],
            'Diminished 7th': [0, 3, 6, 9],
            'Half-Diminished 7th': [0, 3, 6, 10],
            'Augmented 7th': [0, 4, 8, 10],
            'Major 6th': [0, 4, 7, 9],
            'Minor 6th': [0, 3, 7, 9],
            'Add9': [0, 4, 7, 14],
            'Major 9th': [0, 4, 7, 11, 14],
            'Dominant 9th': [0, 4, 7, 10, 14],
            'Minor 9th': [0, 3, 7, 10, 14],
            '6/9': [0, 4, 7, 9, 14],
            '7b5': [0, 4, 6, 10],
            '7#5': [0, 4, 8, 10],
            '7b9': [0, 4, 7, 10, 13],
            '7#9': [0, 4, 7, 10, 15],
            'Power Chord': [0, 7]
        };

        // Chord symbols for display (matching classic chord lab)
        const chordSymbols = {
            'Major': '', 'Minor': 'm', 'Diminished': 'dim', 'Augmented': 'aug',
            'Sus2': 'sus2', 'Sus4': 'sus4',
            'Dominant 7th': '7', 'Major 7th': 'maj7', 'Minor 7th': 'm7',
            'Minor-Major 7th': 'm(maj7)', 'Diminished 7th': 'dim7',
            'Half-Diminished 7th': 'm7b5', 'Augmented 7th': 'aug7',
            'Major 6th': '6', 'Minor 6th': 'm6', 'Add9': 'add9',
            'Major 9th': 'maj9', 'Dominant 9th': '9', 'Minor 9th': 'm9',
            '6/9': '6/9', '7b5': '7b5', '7#5': '7#5', '7b9': '7b9', '7#9': '7#9',
            'Power Chord': '5'
        };

        const inputSet = new Set(inputPitchClasses);
        const bassNotePc = inputPitchClasses.length > 0 ? inputPitchClasses[0] : null;

        // Try each pitch class as potential root
        for (let rootPc = 0; rootPc < 12; rootPc++) {
            const rootNote = this._pitchClassToNote(rootPc);

            // Try each chord type
            for (const [chordType, intervals] of Object.entries(chordIntervals)) {
                const chordPitchClasses = intervals.map(i => (rootPc + (i % 12)) % 12);
                const chordSet = new Set(chordPitchClasses);

                // Check for exact match
                const isExactMatch = inputSet.size === chordSet.size &&
                    [...inputSet].every(pc => chordSet.has(pc));

                // Check for subset (input notes are part of the chord)
                const isSubset = [...inputSet].every(pc => chordSet.has(pc)) && inputSet.size < chordSet.size;

                // Check for superset (chord notes are part of input, with extras)
                const isSuperset = [...chordSet].every(pc => inputSet.has(pc)) && inputSet.size > chordSet.size;

                if (isExactMatch || isSubset || isSuperset) {
                    const missingNotes = [...chordSet]
                        .filter(pc => !inputSet.has(pc))
                        .map(pc => this._pitchClassToNote(pc));

                    const extraNotes = [...inputSet]
                        .filter(pc => !chordSet.has(pc))
                        .map(pc => this._pitchClassToNote(pc));

                    // Detect inversion based on bass note
                    let inversion = 0;
                    let bassNote = null;
                    if (bassNotePc !== null && chordSet.has(bassNotePc)) {
                        const bassInterval = (bassNotePc - rootPc + 12) % 12;
                        const chordToneIndex = intervals.findIndex(i => (i % 12) === bassInterval);
                        if (chordToneIndex > 0) {
                            inversion = chordToneIndex;
                            const useFlatSpelling = chordType.includes('Minor') ||
                                                    chordType.includes('Diminished') ||
                                                    chordType.includes('Half-Diminished') ||
                                                    rootNote.includes('b');
                            bassNote = this._pitchClassToNote(bassNotePc, !useFlatSpelling);
                        }
                    }

                    // Determine if root should use flats
                    const useFlatsForRoot = chordType.includes('Minor') ||
                                            chordType.includes('Diminished') ||
                                            chordType.includes('Half-Diminished');
                    const displayRoot = this._pitchClassToNote(rootPc, !useFlatsForRoot);

                    // Build symbol with slash notation for inversions (like classic chord lab)
                    const baseSymbol = displayRoot + (chordSymbols[chordType] || '');
                    const symbol = inversion > 0 && bassNote ? `${baseSymbol}/${bassNote}` : baseSymbol;

                    // Build full name with inversion info
                    const inversionNames = ['Root Position', '1st Inversion', '2nd Inversion', '3rd Inversion', '4th Inversion'];
                    const inversionName = inversion > 0 ? ` (${inversionNames[inversion] || `${inversion}th Inv.`})` : '';
                    const fullName = `${displayRoot} ${chordType}${inversionName}`;

                    matches.push({
                        root: displayRoot,
                        type: chordType,
                        inversion: inversion,
                        bassNote: bassNote,
                        symbol: symbol,
                        fullName: fullName,
                        matchType: isExactMatch ? 'Exact' : isSubset ? 'Partial' : 'Extended',
                        missingNotes,
                        extraNotes,
                        score: isExactMatch ? 100 : isSuperset ? 80 : 60 - missingNotes.length * 10
                    });
                }
            }
        }

        // Sort by score (exact matches first)
        matches.sort((a, b) => b.score - a.score);

        return matches.slice(0, 12);
    }

    _clearIdentifier() {
        const input = this.container?.querySelector('#fs-identifier-input');
        if (input) input.value = '';
        this.identifierResults = [];
        this._updateIdentifierResults();
    }

    _addNoteToIdentifier(note) {
        const input = this.container?.querySelector('#fs-identifier-input');
        if (input) {
            const currentValue = input.value.trim();
            input.value = currentValue ? `${currentValue} ${note}` : note;
        }
    }

    _updateIdentifierResults() {
        const resultsContainer = this.container?.querySelector('#fs-identifier-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = this._renderIdentifierResults();
        }
    }
}
