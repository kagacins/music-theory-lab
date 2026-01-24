/**
 * ScaleExplorerBottomPanel.js - Bottom dock panel for Scale Explorer (New)
 *
 * Provides the floating bottom dock with:
 * - Playback controls (Play Asc, Play Desc, Stop)
 * - Speed and Octave controls
 * - Quick access to scale categories
 *
 * Follows the same pattern as ChordLabBottomPanel.
 */

import { getEnharmonicPreference } from '../../state/globalState.js';
import {
    getScaleRootIndex,
    getScaleType,
    getScaleOctaveShift,
    getScaleSpeed
} from '../../state/scaleState.js';
import { SHARP_NOTES, FLAT_NOTES, SCALE_DEFINITIONS, SCALE_CATEGORIES } from '../../../data/music-data.js';

// ============================================================================
// ScaleExplorerBottomPanel CLASS
// ============================================================================

export class ScaleExplorerBottomPanel {
    constructor(tabContent, parent) {
        this.tabContent = tabContent;
        this.parent = parent;
        this.currentPanel = null;
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    init() {
        this._renderDock();
    }

    // ========================================================================
    // DOCK RENDERING
    // ========================================================================

    _renderDock() {
        const dock = this.tabContent?.querySelector('#fs-scaleexplorer-bottom-dock');
        if (!dock) return;

        const speed = getScaleSpeed();
        const octave = getScaleOctaveShift();

        dock.innerHTML = `
            <div class="pointer-events-auto flex items-center gap-1 px-3 py-2 bg-gray-900/90 backdrop-blur-sm rounded-full shadow-xl">
                <!-- Play Ascending Button -->
                <button onclick="window.fsScaleExplorerPlay && window.fsScaleExplorerPlay('asc')"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-700 to-emerald-600 text-white text-xs font-semibold transition-all hover:from-emerald-800 hover:to-emerald-700 active:scale-95"
                        title="Play Ascending">
                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
                    </svg>
                    Asc
                </button>

                <!-- Play Descending Button -->
                <button onclick="window.fsScaleExplorerPlay && window.fsScaleExplorerPlay('desc')"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold transition-all hover:from-emerald-700 hover:to-teal-700 active:scale-95"
                        title="Play Descending">
                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    Desc
                </button>

                <!-- Divider -->
                <div class="w-px h-6 bg-gray-600 mx-1"></div>

                <!-- Speed Controls -->
                <div class="flex items-center gap-1 px-2 py-1 bg-white/10 rounded-full">
                    <button onclick="window.fsScaleExplorerChangeSpeed && window.fsScaleExplorerChangeSpeed('slower')"
                            class="w-5 h-5 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold active:scale-95">
                        -
                    </button>
                    <span id="fs-bottom-speed-display" class="text-[10px] font-semibold text-white w-12 text-center">${speed}</span>
                    <button onclick="window.fsScaleExplorerChangeSpeed && window.fsScaleExplorerChangeSpeed('faster')"
                            class="w-5 h-5 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold active:scale-95">
                        +
                    </button>
                </div>

                <!-- Divider -->
                <div class="w-px h-6 bg-gray-600 mx-1"></div>

                <!-- Octave Controls -->
                <div class="flex items-center gap-1 px-2 py-1 bg-white/10 rounded-full">
                    <span class="text-[9px] text-gray-400">Oct</span>
                    <button onclick="window.fsScaleExplorerChangeOctave && window.fsScaleExplorerChangeOctave(-1)"
                            class="w-5 h-5 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold active:scale-95">
                        -
                    </button>
                    <span id="fs-bottom-octave-display" class="text-[10px] font-semibold text-white w-5 text-center">${octave}</span>
                    <button onclick="window.fsScaleExplorerChangeOctave && window.fsScaleExplorerChangeOctave(1)"
                            class="w-5 h-5 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold active:scale-95">
                        +
                    </button>
                </div>

                <!-- Divider -->
                <div class="w-px h-6 bg-gray-600 mx-1"></div>

                <!-- Stop Button -->
                <button onclick="window.forceStopAllPlayback && window.forceStopAllPlayback(true)"
                        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs font-semibold transition-all hover:from-red-600 hover:to-rose-600 active:scale-95"
                        title="Stop">
                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <rect x="6" y="6" width="8" height="8"/>
                    </svg>
                    Stop
                </button>

                <!-- Divider -->
                <div class="w-px h-6 bg-gray-600 mx-1"></div>

                <!-- Scale Info Display -->
                <div class="flex items-center gap-2 px-2 py-1 bg-emerald-600/20 rounded-full">
                    <span id="fs-bottom-scale-name" class="text-[11px] font-bold text-emerald-400">${this._getCurrentScaleName()}</span>
                </div>
            </div>
        `;
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    _getCurrentScaleName() {
        const enhPref = getEnharmonicPreference();
        const notes = enhPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
        const rootNote = notes[getScaleRootIndex()];
        const scaleType = getScaleType();
        return `${rootNote} ${scaleType}`;
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    refresh() {
        this._renderDock();
    }

    updateSpeedDisplay() {
        const speedDisplay = this.tabContent?.querySelector('#fs-bottom-speed-display');
        if (speedDisplay) {
            speedDisplay.textContent = getScaleSpeed();
        }
    }

    updateOctaveDisplay() {
        const octaveDisplay = this.tabContent?.querySelector('#fs-bottom-octave-display');
        if (octaveDisplay) {
            octaveDisplay.textContent = getScaleOctaveShift();
        }
    }

    updateScaleNameDisplay() {
        const nameDisplay = this.tabContent?.querySelector('#fs-bottom-scale-name');
        if (nameDisplay) {
            nameDisplay.textContent = this._getCurrentScaleName();
        }
    }

    closePanel() {
        this.currentPanel = null;
    }
}
