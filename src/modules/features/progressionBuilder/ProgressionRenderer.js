/**
 * ProgressionRenderer.js
 *
 * Handles all rendering operations for chord progression displays.
 * This module manages:
 * - Chord card creation (simplified and detailed views)
 * - VexFlow staff notation rendering
 * - Pattern highlighting and tension visualization
 * - Section-aware card layouts
 * - View mode toggling (scroll, section, default)
 * - Card update and refresh operations
 *
 * Phase 1.4 of progressionBuilder.js refactoring.
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { CHORD_DEFINITIONS, SHARP_NOTES, FLAT_NOTES, INVERSION_NAMES, ENHARMONIC_MAP } from '../../../data/music-data.js';
import { HarmonyAnalyzer, COMMON_PROGRESSIONS } from '../../analysis/harmonyAnalyzer.js';
import { PATTERN_CATEGORIES } from '../../analysis/patternDetection.js';
import {
    getTrainerState,
    getCurrentKey,
    getProgressionData,
    setProgressionData,
    setProgressionRomans,
    setCurrentKey,
    getSelectedChordIndex,
    clearSelection,
    selectSingle
} from '../../state/trainerState.js';
import { getNotationPreference, getCurrentTab } from '../../state/globalState.js';
import {
    getKeyBasedEnharmonic,
    setKeyDropdownValue,
    transposeProgression,
    updateRomanNumerals,
    transposeTreble,
    transposeTrebleWithModeAdjust,
    loadProgression,
    setProgressionViewMode,
    getProgressionViewMode,
    expandChordCard,
    collapseChordCard,
    isChordExpanded,
    updateChordType,
    updateChordRoot,
    updateChordInversion,
    updateChordDuration,
    updateRHOctaveShift,
    updateChordAndRenderPreservingTrebleNotes,
    selectChordCard,
    highlightChordCard,
    unhighlightAllChordCards,
    removeChordFromProgression,
    saveStateBeforeChange,
    toggleProgressionNote,
    toggleProgressionLHNote,
    updateProgressionChord,
    updateProgressionChordLH,
    getSelectedSectionIds,
    isSectionSelectedInView,
    selectSectionInView,
    deselectSectionInView,
    clearSectionSelection,
    handleMultiSelectToggle,
    handleMultiSelectRange,
    clearMultiSelection,
    updateMultiSelectVisuals
} from './ProgressionController.js';
import { getScaleNotesForKey, showProgressionChordSuggestions } from './ProgressionModals.js';
import {
    startProgressionChord,
    stopTrainerChord
} from './ProgressionPlayback.js';
import { getCompositionState } from '../../state/compositionState.js';
import { renderEnhancedTensionCurve } from '../../ui/TensionArcUI.js';
import {
    initializeSimplifiedSortable,
    initializeSectionChipsSortable,
    initializeSectionCardsAreaSortables,
    initializeSectionContainerSortable
} from './ProgressionDragDrop.js';
import { dispatchBuilderEvent } from '../../ui/lessonGuidedMode.js';
import { getLHNotes, getInvertedChordNotes, noteToMidi } from '../../utils/noteUtils.js';
import { initAudio, getAudioIsReady, getPiano } from '../../audio/audioEngine.js';
import { highlightTrainer } from '../../ui/keyboard.js';

// Note: ChordGeneration and HelperFunctions modules were planned for future refactoring
// but are not currently needed as functions are imported from other modules

// ============================================================================
// MODULE-LEVEL STATE
// ============================================================================

/**
 * Map to track staff notation visibility state per chord index
 * Used to persist notation view when cards are re-rendered
 */
const staffNotationStates = new Map();

// ============================================================================
// DEBOUNCED RENDER SYSTEM
// ============================================================================

/**
 * Pending render requests - tracks which containers need rendering
 * Format: { containerId: { syncBothTabs: boolean, timestamp: number } }
 */
const pendingRenders = new Map();

/**
 * Debounce timer ID
 */
let renderDebounceTimer = null;

/**
 * Debounce delay in milliseconds
 * Short enough to feel responsive, long enough to coalesce rapid calls
 */
const RENDER_DEBOUNCE_MS = 16; // ~1 frame at 60fps

/**
 * Debug mode for render debouncing
 * Set window.DEBUG_RENDER_DEBOUNCE = true in console to enable
 */
const isDebugMode = () => typeof window !== 'undefined' && window.DEBUG_RENDER_DEBOUNCE;

/**
 * Execute all pending renders in a single batch
 * Optimizes by rendering each container only once
 */
function executePendingRenders() {
    if (pendingRenders.size === 0) return;

    // Copy and clear pending renders to avoid re-entrancy issues
    const toRender = new Map(pendingRenders);
    pendingRenders.clear();
    renderDebounceTimer = null;

    if (isDebugMode()) {
        console.log(`[RenderDebounce] Executing batch render for ${toRender.size} container(s):`, Array.from(toRender.keys()));
    }

    // Determine which containers to render
    const containers = Array.from(toRender.keys());

    // If both main containers are pending, render them efficiently
    const hasProgViz = containers.includes('progression-visualization');
    const hasMelodyViz = containers.includes('melody-progression-visualization');
    const hasBuilderViz = containers.includes('builder-progression-visualization');

    // Render each unique container once
    // Use syncBothTabs=false to prevent recursive renders
    if (hasProgViz) {
        renderProgressionDisplayImmediate('progression-visualization', false);
    }
    if (hasMelodyViz) {
        renderProgressionDisplayImmediate('melody-progression-visualization', false);
    }
    if (hasBuilderViz) {
        renderProgressionDisplayImmediate('builder-progression-visualization', false);
    }

    // Handle any other containers
    containers.forEach(containerId => {
        if (containerId !== 'progression-visualization' &&
            containerId !== 'melody-progression-visualization' &&
            containerId !== 'builder-progression-visualization') {
            renderProgressionDisplayImmediate(containerId, false);
        }
    });
}

/**
 * Schedule a render request with debouncing
 * Multiple rapid calls are coalesced into a single render
 * @param {string} containerId - Container to render
 * @param {boolean} syncBothTabs - Whether to sync both tabs (adds other container to queue)
 */
function scheduleRender(containerId, syncBothTabs) {
    const wasEmpty = pendingRenders.size === 0;

    // Add this container to pending renders
    pendingRenders.set(containerId, {
        syncBothTabs,
        timestamp: Date.now()
    });

    if (isDebugMode()) {
        console.log(`[RenderDebounce] Scheduled: ${containerId} (syncBothTabs=${syncBothTabs}), pending=${pendingRenders.size}`);
    }

    // If syncBothTabs is true, also queue the other main container
    if (syncBothTabs) {
        if (containerId === 'progression-visualization') {
            pendingRenders.set('melody-progression-visualization', {
                syncBothTabs: false,
                timestamp: Date.now()
            });
        } else if (containerId === 'melody-progression-visualization') {
            pendingRenders.set('progression-visualization', {
                syncBothTabs: false,
                timestamp: Date.now()
            });
        }
    }

    // Clear existing timer and set a new one
    if (renderDebounceTimer) {
        clearTimeout(renderDebounceTimer);
    }

    renderDebounceTimer = setTimeout(executePendingRenders, RENDER_DEBOUNCE_MS);
}

/**
 * Force immediate execution of any pending renders
 * Use when you need renders to complete before continuing
 */
export function flushPendingRenders() {
    if (renderDebounceTimer) {
        clearTimeout(renderDebounceTimer);
        renderDebounceTimer = null;
    }
    executePendingRenders();
}

// Note: expandedChords state is managed in ProgressionController.js
// Use isChordExpanded(index) to check if a chord is expanded

/**
 * One-time flag to force flat layout (ignore sections)
 * Used to avoid stacking issues when inserting chords in heavily-sectioned progressions
 */
let forceFlatLayoutOnce = false;

// PATTERN_CATEGORIES is imported from patternDetection.js

// ============================================================================
// HELPER FUNCTIONS - STAFF NOTATION STATE
// ============================================================================

/**
 * Capture current staff notation visibility states before re-rendering
 * Stores which chord cards have staff notation visible
 */
function captureStaffNotationStates() {
    staffNotationStates.clear();

    // Check both containers
    const containers = ['progression-visualization', 'melody-progression-visualization'];

    containers.forEach(containerId => {
        const wrappers = document.querySelectorAll(`#${containerId} > div`);

        wrappers.forEach((wrapper, index) => {
            // Only set state if not already set (first container wins, or we merge states)
            if (!staffNotationStates.has(index)) {
                const card = wrapper.querySelector('.progression-chord-item');
                if (card) {
                    const staffContainer = card.querySelector(`#staff-notation-${index}`) || document.getElementById(`staff-notation-${index}`);
                    if (staffContainer && !staffContainer.classList.contains('hidden')) {
                        // Staff notation is visible for this chord
                        staffNotationStates.set(index, true);
                    }
                }
            }
        });
    });
}

/**
 * Restore staff notation visibility states after re-rendering
 * Restores to both Progression Builder and Composition Studio tabs
 */
function restoreStaffNotationStates() {
    // Use setTimeout to ensure DOM is fully rendered
    setTimeout(() => {
        staffNotationStates.forEach((shouldShow, chordIndex) => {
            if (shouldShow) {
                // Restore in both containers
                const containers = ['progression-visualization', 'melody-progression-visualization'];

                containers.forEach(containerId => {
                    const wrapper = document.querySelectorAll(`#${containerId} > div`)[chordIndex];
                    if (!wrapper) return;

                const card = wrapper.querySelector('.progression-chord-item');
                if (!card) return;

                    // Find elements within this specific container
                    const staffContainer = card.querySelector(`#staff-notation-${chordIndex}`) || document.getElementById(`staff-notation-${chordIndex}`);
                    const staffCanvas = card.querySelector(`#staff-canvas-${chordIndex}`) || document.getElementById(`staff-canvas-${chordIndex}`);

                    if (!staffContainer || !staffCanvas) return;

                const staffToggleBtn = wrapper.querySelector('button[title="Toggle staff notation view"], button[title="Show chord card"]');
                    const header = card.querySelector(`#chord-header-${chordIndex}`) || document.getElementById(`chord-header-${chordIndex}`);
                const cardContent = Array.from(card.children).filter(child =>
                    child.id !== `staff-notation-${chordIndex}` &&
                    child.id !== `chord-header-${chordIndex}`
                );

                // Show staff, hide card content
                staffContainer.classList.remove('hidden');
                cardContent.forEach(child => {
                    child.style.display = 'none';
                });

                // Update button
                if (staffToggleBtn) {
                    staffToggleBtn.innerHTML = '<span class="font-bold text-sm">abc</span>';
                    staffToggleBtn.title = 'Show chord card';
                }

                    // Render staff notation
                renderStaffNotation(chordIndex, staffCanvas);
                });
            }
        });
    }, 50); // Small delay to ensure DOM is ready
}

/**
 * Clear all pattern highlight styling from chord cards
 * Removes both old and new pattern highlight styles
 */
function clearPatternHighlights() {
    // Clear old highlight style
    document.querySelectorAll('.pattern-highlight-active').forEach(el => {
        el.classList.remove('pattern-highlight-active');
        el.removeAttribute('data-pattern-match');
        el.removeAttribute('data-match-index');
        el.style.backgroundColor = '';
        el.style.border = '';
        el.style.boxShadow = '';
        el.style.borderRadius = '';
        el.style.padding = '';
    });

    // Clear new highlight style
    document.querySelectorAll('.pattern-highlight').forEach(el => {
        el.classList.remove('pattern-highlight');
        el.style.boxShadow = '';
        el.style.borderColor = '';
        el.style.borderWidth = '';
    });
}

// ============================================================================
// HELPER FUNCTIONS - COLOR & DISPLAY
// ============================================================================

/**
 * Convert hex color to rgba
 * @param {string} hex - Hex color code
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
function hexToRgba(hex, alpha = 0.15) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Get harmonic function for a Roman numeral
 * Maps roman numerals to Tonic, Dominant, or Subdominant
 * @param {string} roman - Roman numeral (e.g., 'I', 'V7', 'ii')
 * @returns {string|null} Function name or null
 */
function getChordFunction(roman) {
    // Map roman numerals to their harmonic function
    const functionMap = {
        'I': 'Tonic',
        'i': 'Tonic',
        'V': 'Dominant',
        'v': 'Dominant',
        'IV': 'Subdominant',
        'iv': 'Subdominant',
        'ii': 'Subdominant',
        'iii': 'Tonic',
        'III': 'Tonic',
        'vi': 'Tonic',
        'VI': 'Tonic',
        'vii°': 'Dominant',
        'VII': 'Dominant'
    };

    // Handle undefined/null roman numerals
    if (!roman) return null;

    // Handle roman numerals with suffixes (like 'V7', 'ii7', etc.)
    const baseRoman = roman.replace(/[0-9°]/g, '');
    return functionMap[baseRoman] || null;
}

/**
 * Get color classes for roman numeral based on harmonic function
 * Per INTERACTIVE_LEARNING_PLAN.md Section 1.3:
 *   🟢 GREEN = "Home Base" (Tonic) - I, vi, iii
 *   🔵 BLUE = "Journey" (Subdominant) - IV, ii
 *   🔴 RED = "Tension" (Dominant) - V, vii°
 *   🟣 PURPLE = Borrowed/Modal Interchange
 * @param {string} roman - Roman numeral
 * @returns {object} Object with romanColor, functionColor, bgColor, borderColor, function, hexColor
 */
function getFunctionColors(roman) {
    const func = getChordFunction(roman);

    // Check if it's a borrowed chord (has flat or sharp prefix)
    // Handles both unicode symbols (♭, ♯) and ASCII equivalents (b, #)
    const isBorrowed = roman && (roman.includes('♭') || roman.includes('♯') || roman.includes('#') || roman.startsWith('b'));

    const colorMap = {
        'Tonic': {
            function: 'Tonic',
            romanColor: 'text-emerald-600 dark:text-emerald-400',
            functionColor: 'text-emerald-500 dark:text-emerald-400',
            bgColor: 'bg-emerald-100 dark:bg-emerald-900/50',
            borderColor: 'border-emerald-400 dark:border-emerald-600',
            hexColor: '#10b981' // emerald-500
        },
        'Dominant': {
            function: 'Dominant',
            romanColor: 'text-red-600 dark:text-red-400',
            functionColor: 'text-red-500 dark:text-red-400',
            bgColor: 'bg-red-100 dark:bg-red-900/50',
            borderColor: 'border-red-400 dark:border-red-600',
            hexColor: '#ef4444' // red-500
        },
        'Subdominant': {
            function: 'Subdominant',
            romanColor: 'text-blue-600 dark:text-blue-400',
            functionColor: 'text-blue-500 dark:text-blue-400',
            bgColor: 'bg-blue-100 dark:bg-blue-900/50',
            borderColor: 'border-blue-400 dark:border-blue-600',
            hexColor: '#3b82f6' // blue-500
        }
    };

    // Borrowed/Modal interchange chords get purple
    if (isBorrowed) {
        return {
            function: 'Borrowed',
            romanColor: 'text-purple-600 dark:text-purple-400',
            functionColor: 'text-purple-500 dark:text-purple-400',
            bgColor: 'bg-purple-100 dark:bg-purple-900/50',
            borderColor: 'border-purple-400 dark:border-purple-600',
            hexColor: '#8b5cf6' // purple-500
        };
    }

    return colorMap[func] || {
        function: 'Unknown',
        romanColor: 'text-gray-600 dark:text-gray-400',
        functionColor: 'text-gray-500 dark:text-gray-400',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        borderColor: 'border-gray-400 dark:border-gray-600',
        hexColor: '#6b7280' // gray-500
    };
}

// ============================================================================
// UI HELPER FUNCTIONS - VIEW MODE TOGGLES
// ============================================================================

/**
 * Create view mode toggle buttons (Scroll / Section)
 * Returns a DOM element with toggle buttons for switching view modes
 * @returns {HTMLElement} Toggle button container
 */
function createViewModeToggle() {
    const container = document.createElement('div');
    container.className = 'view-mode-toggle flex items-center gap-1 bg-gray-100 rounded-lg p-0.5';
    container.id = 'view-mode-toggle';

    const isScrollView = getProgressionViewMode() === 'scroll';
    const isSectionView = getProgressionViewMode() === 'section';

    container.innerHTML = `
        <button class="view-mode-btn px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 flex items-center gap-1
                       ${isScrollView ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}"
                data-mode="scroll" title="Scroll View - Horizontal scrolling">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
            Scroll
        </button>
        <button class="view-mode-btn px-2 py-1 text-xs font-medium rounded-md transition-all duration-200 flex items-center gap-1
                       ${isSectionView ? 'bg-white shadow text-indigo-600' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}"
                data-mode="section" title="Section View - Navigate by section">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
            </svg>
            Section
        </button>
    `;

    // Add event listeners
    container.querySelectorAll('.view-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            setProgressionViewMode(mode);
            // Re-render both progression displays
            renderProgressionDisplay('melody-progression-visualization', true);
            // Update notation for section view (call via window - old module function)
            if (window.updateNotationForSelectedSections) {
                window.updateNotationForSelectedSections();
            }
        });
    });

    return container;
}

/**
 * Create compact view mode toggle for header placement
 * Includes "View:" label with Scroll/Section text buttons
 * @returns {HTMLElement} Compact toggle container element
 */
export function createCompactViewModeToggle() {
    const container = document.createElement('div');
    container.className = 'flex items-center gap-1.5';
    container.id = 'compact-view-mode-toggle';

    const currentMode = getProgressionViewMode();
    const isScrollView = currentMode === 'scroll';
    const isSectionView = currentMode === 'section';

    container.innerHTML = `
        <span class="text-xs text-white/70 font-medium">View:</span>
        <div class="flex items-center gap-0.5 bg-white/20 rounded-md p-0.5">
            <button class="compact-view-btn px-2 py-1 text-xs font-medium rounded transition-all duration-200
                           ${isScrollView ? 'bg-white/30 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}"
                    data-mode="scroll" title="Scroll View - Horizontal scrolling">
                Scroll
            </button>
            <button class="compact-view-btn px-2 py-1 text-xs font-medium rounded transition-all duration-200
                           ${isSectionView ? 'bg-white/30 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}"
                    data-mode="section" title="Section View - Navigate by section">
                Section
            </button>
        </div>
    `;

    // Add event listeners
    container.querySelectorAll('.compact-view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent header collapse
            const mode = btn.getAttribute('data-mode');
            setProgressionViewMode(mode);
            // Re-render progression display
            renderProgressionDisplay('melody-progression-visualization', true);
            // Update notation for section view (call via window - old module function)
            if (window.updateNotationForSelectedSections) {
                window.updateNotationForSelectedSections();
            }
            // Update toggle button styles
            container.querySelectorAll('.compact-view-btn').forEach(b => {
                const isActive = b.getAttribute('data-mode') === getProgressionViewMode();
                b.className = `compact-view-btn px-2 py-1 text-xs font-medium rounded transition-all duration-200
                              ${isActive ? 'bg-white/30 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}`;
            });
        });
    });

    return container;
}

// ============================================================================
// VEXFLOW HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate canvas dimensions based on key signature and notes
 * @param {string} key - Key signature
 * @param {Array} notes - Array of note strings
 * @returns {Object} Width and height
 */
export function calculateCanvasDimensions(key, notes) {
    // TODO: Move to HelperFunctions module or keep here as VexFlow-specific
    const keySignature = getKeySignatureAccidentals(key);
    const accidentalCount = keySignature.sharps.size + keySignature.flats.size;

    let width = 120;
    if (accidentalCount >= 6) width = 180;
    else if (accidentalCount >= 5) width = 165;
    else if (accidentalCount >= 3) width = 140;

    const height = 90;
    return { width, height };
}

/**
 * Get VexFlow-compatible key signature string
 * @param {string} key - Key (e.g., "C", "Dm")
 * @returns {string} VexFlow key signature
 */
function getVexFlowKeySignature(key) {
    // VexFlow expects major keys and handles minor via relative major
    if (key.endsWith('m')) {
        return getRelativeMajorForVexFlow(key);
    }
    return key;
}

/**
 * Get relative major key for VexFlow (minor keys)
 * @param {string} minorKey - Minor key
 * @returns {string} Relative major key
 */
function getRelativeMajorForVexFlow(minorKey) {
    // Remove 'm' suffix
    const root = minorKey.slice(0, -1);

    // Relative major is 3 semitones up
    const sharpNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

    const notes = root.includes('b') ? flatNotes : sharpNotes;
    const index = notes.indexOf(root);
    if (index === -1) return 'C';

    const majorIndex = (index + 3) % 12;
    return notes[majorIndex];
}

/**
 * Get key signature accidentals
 * @param {string} key - Key signature
 * @returns {Object} Sharps and flats sets
 */
function getKeySignatureAccidentals(key) {
    // Maps for major and minor keys
    const majorKeySharps = {
        'G': new Set(['F']),
        'D': new Set(['F', 'C']),
        'A': new Set(['F', 'C', 'G']),
        'E': new Set(['F', 'C', 'G', 'D']),
        'B': new Set(['F', 'C', 'G', 'D', 'A']),
        'F#': new Set(['F', 'C', 'G', 'D', 'A', 'E']),
        'C#': new Set(['F', 'C', 'G', 'D', 'A', 'E', 'B'])
    };

    const majorKeyFlats = {
        'F': new Set(['B']),
        'Bb': new Set(['B', 'E']),
        'Eb': new Set(['B', 'E', 'A']),
        'Ab': new Set(['B', 'E', 'A', 'D']),
        'Db': new Set(['B', 'E', 'A', 'D', 'G']),
        'Gb': new Set(['B', 'E', 'A', 'D', 'G', 'C']),
        'Cb': new Set(['B', 'E', 'A', 'D', 'G', 'C', 'F'])
    };

    // Handle minor keys by converting to relative major
    let actualKey = key;
    if (key.endsWith('m')) {
        actualKey = getRelativeMajorForVexFlow(key);
    }

    return {
        sharps: majorKeySharps[actualKey] || new Set(),
        flats: majorKeyFlats[actualKey] || new Set()
    };
}

// ============================================================================
// NOTATION RENDERING - VEXFLOW
// ============================================================================

/**
 * Render compact chord notation on canvas
 * Shows RH notes as whole notes in bass clef with key signature
 * @param {Object} chord - Chord object
 * @param {string} key - Current key signature
 * @param {HTMLCanvasElement} canvas - Canvas element
 */
export function renderChordNotation(chord, key, canvas) {
    try {
        // VexFlow 5.x browser build exposes VexFlow namespace
        if (typeof VexFlow === 'undefined') {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '12px Arial';
            ctx.fillText('VexFlow not loaded', 10, 30);
            return;
        }

        const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } = VexFlow;

        if (!Renderer || !Stave || !StaveNote || !Voice || !Formatter || !Accidental) {
            return;
        }

        // Get key signature accidentals
        const keySignature = getKeySignatureAccidentals(key);

        // Get notes that are actually being played (respecting omitted notes)
        const rhNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));

        if (rhNotes.length === 0) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '12px Arial';
            ctx.fillText('No notes to display', 10, 30);
            return;
        }

        // Convert notes to VexFlow format (e.g., "C4" -> "C/4")
        const vexFlowNotes = rhNotes.map(note => {
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return null;
            const noteName = match[1];
            const octave = parseInt(match[2]);
            return {
                vexNote: `${noteName}/${octave}`,
                original: note
            };
        }).filter(n => n !== null);

        if (vexFlowNotes.length === 0) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '12px Arial';
            ctx.fillText('Invalid note format', 10, 30);
            return;
        }

        // Calculate dynamic canvas size
        const dimensions = calculateCanvasDimensions(key, rhNotes);
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        canvas.style.width = `${dimensions.width}px`;
        canvas.style.height = `${dimensions.height}px`;

        // Clear canvas
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Create renderer
        const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
        renderer.resize(canvas.width, canvas.height);
        const ctx = renderer.getContext();

        // Create stave with bass clef
        const staveX = 5;
        const staveY = 10;
        const staveWidth = dimensions.width - 10;
        const stave = new Stave(staveX, staveY, staveWidth);
        stave.addClef('bass');

        // Add key signature
        const vexFlowKey = getVexFlowKeySignature(key);
        try {
            stave.addKeySignature(vexFlowKey);
        } catch (e) {
            // Continue without key signature
        }

        // Adjust note start position based on key signature complexity
        const accidentalCount = keySignature.sharps.size + keySignature.flats.size;
        let noteStartOffset = 40;
        if (accidentalCount >= 6) noteStartOffset = 100;
        else if (accidentalCount >= 5) noteStartOffset = 85;
        else if (accidentalCount >= 3) noteStartOffset = 65;

        try {
            if (typeof stave.setNoteStartX === 'function') {
                stave.setNoteStartX(stave.getX() + noteStartOffset);
            }
        } catch (e) {
            // Ignore if API not available
        }

        stave.setContext(ctx).draw();

        // Create a single chord (all notes stacked as whole notes)
        const keys = vexFlowNotes.map(n => n.vexNote);
        const staveNote = new StaveNote({ clef: 'bass', keys: keys, duration: 'w' });

        // Center the notes horizontally
        try {
            staveNote.setXShift(15);
        } catch (e) {
            // Ignore if API differs
        }

        // Add accidentals only for notes NOT in the key signature
        vexFlowNotes.forEach((n, idx) => {
            const noteName = n.original.replace(/\d+$/, '');
            const naturalNote = noteName.replace(/[#b]/, '');
            const hasSharp = noteName.includes('#');
            const hasFlat = noteName.includes('b');

            const isSharpInKey = keySignature.sharps.has(naturalNote);
            const isFlatInKey = keySignature.flats.has(naturalNote);

            if (hasSharp) {
                if (!isSharpInKey) {
                    staveNote.addModifier(new Accidental('#'), idx);
                }
            } else if (hasFlat) {
                if (!isFlatInKey) {
                    staveNote.addModifier(new Accidental('b'), idx);
                }
            } else {
                if (isSharpInKey || isFlatInKey) {
                    staveNote.addModifier(new Accidental('n'), idx);
                }
            }
        });

        const voice = new Voice({ num_beats: 4, beat_value: 4 });
        voice.addTickables([staveNote]);
        new Formatter().joinVoices([voice]).format([voice], staveWidth - 50);
        voice.draw(ctx, stave);

    } catch (e) {
        console.error('[renderChordNotation] Error:', e);
    }
}

/**
 * Render staff notation for a chord with grand staff
 * @param {number} chordIndex - Index of chord in progression
 * @param {HTMLCanvasElement} canvas - Canvas element
 */
function renderStaffNotation(chordIndex, canvas) {
    // TODO: This is a large function (~700 lines) that handles grand staff rendering with ottava logic
    // It should stay in ProgressionRenderer.js as it's VexFlow-specific rendering
    // Implementation continues from line 1981-2510 of progressionBuilder.js
    // For brevity, marking as TODO to copy full implementation
}

/**
 * Refresh only the chord notation canvas in a detailed card (without rebuilding HTML)
 * @param {number} index - Chord index
 * @param {object} chord - Chord data
 */
export function refreshChordNotationCanvas(index, chord) {
    const trainerState = getTrainerState();
    const key = trainerState.currentKey || 'C';

    // Find the canvas in the detailed card for this chord
    const wrapper = document.querySelector(`.chord-card-wrapper[data-chord-index="${index}"]`);
    if (!wrapper) return;

    const canvas = wrapper.querySelector('.chord-notation-canvas');
    if (canvas) {
        // Re-render the chord notation with updated data
        renderChordNotation(chord, key, canvas);
    }
}

/**
 * Render chord staff notation with provided chord data (exported)
 * Wrapper function for external use (Composition Studio)
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} chordData - Chord data object
 * @param {string} key - Current key
 */
export function renderChordStaffNotation(canvas, chordData, key) {
    try {
        // VexFlow 5.x browser build exposes VexFlow namespace
        if (typeof VexFlow === 'undefined') {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.fillText('VexFlow not loaded', 10, 30);
            return;
        }

        const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } = VexFlow;

        if (!Renderer || !Stave || !StaveNote || !Voice || !Formatter || !Accidental) {
            throw new Error('VexFlow classes not found');
        }

        // Get key signature accidentals
        const keySignature = getKeySignatureAccidentals(key);

        // Get notes that are actually being played (respecting omitted notes)
        const rhNotes = chordData.notes.filter(n => !(chordData.omittedNotes || []).includes(n));
        const lhNotes = chordData.lhType && chordData.lhType !== 'off' && window.getLHNotes ?
            window.getLHNotes(
                chordData.root,
                chordData.lhType,
                chordData.lhInversion || 0,
                key,
                chordData.lhOctaveShift || 0,
                chordData.type,
                getKeyBasedEnharmonic()
            ).filter(n => !(chordData.lhOmittedNotes || []).includes(n)) : [];

        const allNotes = [...rhNotes, ...lhNotes];

        if (allNotes.length === 0) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '12px Arial';
            ctx.fillText('No notes to display', 10, 30);
            return;
        }

        // Separate notes into treble and bass clef
        const trebleNotes = [];
        const bassNotes = [];

        allNotes.forEach(note => {
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return;

            const noteName = match[1];
            const octave = parseInt(match[2]);
            const vexFlowNote = `${noteName}/${octave}`;

            if (octave >= 4) {
                trebleNotes.push({ note: vexFlowNote, original: note });
            } else {
                bassNotes.push({ note: vexFlowNote, original: note });
            }
        });

        // Set canvas dimensions
        canvas.width = 350;
        canvas.height = (trebleNotes.length > 0 && bassNotes.length > 0) ? 200 : 120;

        // Clear canvas
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Create renderer
        const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
        renderer.resize(canvas.width, canvas.height);
        const ctx = renderer.getContext();

        let yOffset = 10;
        const staveWidth = 165;
        const staveX = 0;

        // Render treble clef if there are treble notes
        if (trebleNotes.length > 0) {
            const stave = new Stave(staveX, yOffset, staveWidth);
            stave.addClef('treble');

            const vexFlowKey = getVexFlowKeySignature(key);
            try {
                stave.addKeySignature(vexFlowKey);
            } catch (e) {
                // Ignore key signature errors
            }

            stave.setContext(ctx).draw();

            const staveNote = new StaveNote({
                keys: trebleNotes.map(n => n.note),
                duration: 'w',
                clef: 'treble'
            });

            // Add accidentals based on key signature
            trebleNotes.forEach((noteData, idx) => {
                const match = noteData.original.match(/^([A-G])([#b]?)(\d+)$/);
                if (!match) return;

                const noteLetter = match[1];
                const accidental = match[2];

                const isSharpInKey = keySignature.sharps.has(noteLetter);
                const isFlatInKey = keySignature.flats.has(noteLetter);

                if (accidental === '#') {
                    if (!isSharpInKey) {
                        staveNote.addModifier(new Accidental('#'), idx);
                    }
                } else if (accidental === 'b') {
                    if (!isFlatInKey) {
                        staveNote.addModifier(new Accidental('b'), idx);
                    }
                } else {
                    if (isSharpInKey || isFlatInKey) {
                        staveNote.addModifier(new Accidental('n'), idx);
                    }
                }
            });

            const voice = new Voice({ num_beats: 4, beat_value: 4 });
            voice.addTickables([staveNote]);
            new Formatter().joinVoices([voice]).format([voice], staveWidth);
            voice.draw(ctx, stave);

            yOffset += 90;
        }

        // Render bass clef if there are bass notes
        if (bassNotes.length > 0) {
            const stave = new Stave(staveX, yOffset, staveWidth);
            stave.addClef('bass');

            const vexFlowKey = getVexFlowKeySignature(key);
            try {
                stave.addKeySignature(vexFlowKey);
            } catch (e) {
                // Ignore key signature errors
            }

            stave.setContext(ctx).draw();

            const staveNote = new StaveNote({
                keys: bassNotes.map(n => n.note),
                duration: 'w',
                clef: 'bass'
            });

            // Add accidentals based on key signature
            bassNotes.forEach((noteData, idx) => {
                const match = noteData.original.match(/^([A-G])([#b]?)(\d+)$/);
                if (!match) return;

                const noteLetter = match[1];
                const accidental = match[2];

                const isSharpInKey = keySignature.sharps.has(noteLetter);
                const isFlatInKey = keySignature.flats.has(noteLetter);

                if (accidental === '#') {
                    if (!isSharpInKey) {
                        staveNote.addModifier(new Accidental('#'), idx);
                    }
                } else if (accidental === 'b') {
                    if (!isFlatInKey) {
                        staveNote.addModifier(new Accidental('b'), idx);
                    }
                } else {
                    if (isSharpInKey || isFlatInKey) {
                        staveNote.addModifier(new Accidental('n'), idx);
                    }
                }
            });

            const voice = new Voice({ num_beats: 4, beat_value: 4 });
            voice.addTickables([staveNote]);
            new Formatter().joinVoices([voice]).format([voice], staveWidth);
            voice.draw(ctx, stave);
        }
    } catch (error) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ff0000';
        ctx.font = '12px Arial';
        ctx.fillText('Error rendering staff notation', 10, 30);
        ctx.fillText(error.message, 10, 50);
    }
}

/**
 * Toggle staff notation visibility for all chord cards (exported)
 * @param {boolean} showNotation - True to show notation, false to show chord info
 */
export function toggleAllStaffNotation(showNotation) {
    const container = document.getElementById('progression-visualization');
    if (!container) return;

    const trainerState = getTrainerState();
    const allWrappers = Array.from(container.querySelectorAll('.chord-card-wrapper[data-chord-index]'));

    // Process all cards synchronously (no counting needed)
    allWrappers.forEach(wrapper => {
        // Skip expanded cards - they always show notation
        if (wrapper.classList.contains('expanded-card-wrapper')) return;

        const index = parseInt(wrapper.getAttribute('data-chord-index'));
        if (isNaN(index)) return;

        const card = wrapper.querySelector('.simplified-card');
        const chordInfoView = wrapper.querySelector('.chord-info-view');
        const notationView = wrapper.querySelector('.notation-view');
        const canvas = wrapper.querySelector('.simplified-notation-canvas');
        const toggleBtn = wrapper.querySelector('.notation-toggle-btn');
        const musicNoteIcon = toggleBtn?.querySelector('.music-note-icon');
        const abcText = toggleBtn?.querySelector('.abc-text');

        if (!card || !chordInfoView || !notationView || !canvas) return;

        const chord = trainerState.progressionData[index];
        const key = trainerState.currentKey || 'C';

        if (showNotation) {
            // Show notation view
            chordInfoView.classList.add('hidden');
            notationView.classList.remove('hidden');

            // Change toggle to show ABC text
            if (musicNoteIcon) musicNoteIcon.classList.add('hidden');
            if (abcText) abcText.classList.remove('hidden');

            // Add class to bypass CSS width constraints
            wrapper.classList.add('has-notation');

            // Calculate dimensions and set width on the internal elements only
            const dimensions = calculateCanvasDimensions(key, chord.notes);
            card.style.minHeight = `${dimensions.height + 20}px`;
            card.style.minWidth = `${dimensions.width + 20}px`;
            notationView.style.minHeight = `${dimensions.height + 20}px`;
            notationView.style.minWidth = `${dimensions.width + 20}px`;
            // Don't set wrapper.style.minWidth - let CSS handle via fit-content

            // Render notation on canvas
            requestAnimationFrame(() => {
                renderChordNotation(chord, key, canvas);
            });
        } else {
            // Show chord info view
            notationView.classList.add('hidden');
            chordInfoView.classList.remove('hidden');

            // Change toggle to show music note icon
            if (musicNoteIcon) musicNoteIcon.classList.remove('hidden');
            if (abcText) abcText.classList.add('hidden');

            // Remove class to restore CSS width constraints
            wrapper.classList.remove('has-notation');

            // Reset ALL dimension styles to ensure clean state
            card.style.minHeight = '80px';
            card.style.minWidth = '';
            card.style.width = '';
            notationView.style.minHeight = '';
            notationView.style.minWidth = '';
            notationView.style.width = '';
            wrapper.style.minWidth = '';
            wrapper.style.width = '';
        }
    });

    // Force a synchronous layout by reading dimensions
    container.getBoundingClientRect();

    // Also force layout on each wrapper to ensure minWidth is applied
    allWrappers.forEach(wrapper => {
        wrapper.getBoundingClientRect();
    });

    // Update card shifts after all widths have been set
    // Use triple requestAnimationFrame to ensure all style updates are processed
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                updateCardShifts();
            });
        });
    });
}

// ============================================================================
// PATTERN HIGHLIGHTING
// ============================================================================

/**
 * Create singleton HarmonyAnalyzer instance
 */
const harmonyAnalyzer = new HarmonyAnalyzer();

/**
 * Render pattern highlights with collapsible categories
 * @param {HTMLElement} container - Container element
 * @param {Array} progressionData - Progression data
 * @param {string} key - Current key
 */
function renderPatternHighlights(container, progressionData, key) {
    if (!progressionData || progressionData.length === 0) return;

    // Remove old pattern highlights if they exist
    const oldHighlights = document.querySelector('#pattern-highlights-container');
    if (oldHighlights) {
        oldHighlights.remove();
    }

    // Analyze progression for patterns
    const analysis = harmonyAnalyzer.analyzeProgression(progressionData, key);

    // Use enhanced patterns if available, fallback to legacy patterns
    const enhancedPatterns = analysis.enhancedPatterns || {
        progressions: analysis.patterns || [],
        cadences: [],
        sequences: [],
        modal: [],
        borrowed: []
    };

    // Check if we have any patterns to display
    const hasAnyPatterns = Object.values(enhancedPatterns).some(arr => arr && arr.length > 0);
    if (!hasAnyPatterns) return;

    // Create master collapsible pattern container
    const patternContainer = document.createElement('div');
    patternContainer.className = 'mb-2 px-4';
    patternContainer.id = 'pattern-highlights-container';

    // Add CSS for compact horizontal layout
    const style = document.createElement('style');
    style.textContent = `
        .pattern-master-container {
            background: rgba(20, 20, 30, 0.8);
            border: 1px solid rgba(100, 100, 120, 0.3);
            border-radius: 0.5rem;
            overflow: hidden;
        }
        .pattern-master-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.375rem 0.75rem;
            background: rgba(30, 30, 40, 0.6);
            cursor: pointer;
            transition: all 0.2s;
            border-bottom: 1px solid rgba(100, 100, 120, 0.2);
        }
        .pattern-master-header:hover {
            background: rgba(40, 40, 50, 0.8);
        }
        .pattern-master-header.collapsed {
            border-bottom: none;
        }
        .pattern-master-title {
            flex: 1;
            font-weight: 600;
            color: #e5e7eb;
            font-size: 0.7rem;
        }
        .pattern-master-expand {
            font-size: 0.625rem;
            transition: transform 0.2s;
            color: #9ca3af;
        }
        .pattern-master-header:not(.collapsed) .pattern-master-expand {
            transform: rotate(180deg);
        }
        .pattern-master-content {
            padding: 0.5rem;
            max-height: 300px;
            overflow: hidden;
            transition: max-height 0.3s ease, padding 0.3s ease;
        }
        .pattern-master-content.collapsed {
            max-height: 0;
            padding: 0 0.5rem;
        }
        .pattern-category-row {
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            margin-bottom: 0.375rem;
        }
        .pattern-category-row:last-child {
            margin-bottom: 0;
        }
        .pattern-category-label {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.25rem 0.5rem;
            background: rgba(50, 50, 60, 0.6);
            border-radius: 0.375rem;
            font-size: 0.5rem;
            font-weight: 600;
            color: #d1d5db;
            white-space: nowrap;
            min-width: 70px;
        }
        .pattern-category-label-icon {
            font-size: 0.625rem;
        }
        .pattern-badges-row {
            display: flex;
            flex-wrap: wrap;
            gap: 0.375rem;
            flex: 1;
        }
        .enhanced-pattern-badge {
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            gap: 0.125rem;
            padding: 0.375rem 0.5rem;
            border-radius: 0.5rem;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }
        .enhanced-pattern-badge:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
        }
        .enhanced-pattern-badge.progressions {
            background: linear-gradient(135deg, #a855f7, #8b5cf6);
            color: white;
        }
        .enhanced-pattern-badge.cadences {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: white;
        }
        .enhanced-pattern-badge.sequences {
            background: linear-gradient(135deg, #22c55e, #16a34a);
            color: white;
        }
        .enhanced-pattern-badge.modal {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: white;
        }
        .enhanced-pattern-badge.borrowed {
            background: linear-gradient(135deg, #ec4899, #db2777);
            color: white;
        }
        .pattern-badge-chords {
            font-size: 0.5rem;
            font-weight: 700;
            opacity: 0.95;
            letter-spacing: -0.02em;
        }
        .pattern-badge-name {
            font-size: 0.5rem;
            font-weight: 500;
            opacity: 0.9;
        }
        .pattern-badge-count {
            font-size: 0.45rem;
            opacity: 0.8;
            background: rgba(255, 255, 255, 0.25);
            padding: 0.0625rem 0.25rem;
            border-radius: 0.25rem;
            margin-left: 0.25rem;
        }
        .pattern-highlight {
            box-shadow: 0 0 15px rgba(168, 85, 247, 0.6) !important;
            border-color: #a855f7 !important;
        }
    `;
    patternContainer.appendChild(style);

    // Create master container
    const masterContainer = document.createElement('div');
    masterContainer.className = 'pattern-master-container';

    // Count total patterns
    const totalPatterns = Object.values(enhancedPatterns).reduce((sum, arr) => sum + (arr?.length || 0), 0);

    // Create master header (collapsed by default)
    const masterHeader = document.createElement('button');
    masterHeader.className = 'pattern-master-header collapsed';
    masterHeader.innerHTML = `
        <span class="pattern-master-title">Detected Patterns (${totalPatterns})</span>
        <span class="pattern-master-expand">▼</span>
    `;

    // Create master content (collapsed by default)
    const masterContent = document.createElement('div');
    masterContent.className = 'pattern-master-content collapsed';

    // Sort categories by priority
    const sortedCategories = Object.entries(PATTERN_CATEGORIES)
        .sort((a, b) => a[1].priority - b[1].priority);

    for (const [categoryKey, categoryInfo] of sortedCategories) {
        const patterns = enhancedPatterns[categoryKey];

        // Skip empty categories
        if (!patterns || patterns.length === 0) continue;

        // Create horizontal category row
        const categoryRow = document.createElement('div');
        categoryRow.className = 'pattern-category-row';

        // Category label
        const categoryLabel = document.createElement('div');
        categoryLabel.className = 'pattern-category-label';
        categoryLabel.style.borderLeft = `2px solid ${categoryInfo.color}`;
        categoryLabel.innerHTML = `
            <span class="pattern-category-label-icon">${categoryInfo.icon}</span>
            <span>${categoryInfo.label}</span>
        `;

        // Badges container
        const badgesRow = document.createElement('div');
        badgesRow.className = 'pattern-badges-row';

        // Add badges for each pattern
        patterns.forEach(pattern => {
            const badge = createEnhancedPatternBadge(pattern, categoryKey);
            badgesRow.appendChild(badge);
        });

        categoryRow.appendChild(categoryLabel);
        categoryRow.appendChild(badgesRow);
        masterContent.appendChild(categoryRow);
    }

    // Toggle expand/collapse
    masterHeader.addEventListener('click', () => {
        masterHeader.classList.toggle('collapsed');
        masterContent.classList.toggle('collapsed');
    });

    masterContainer.appendChild(masterHeader);
    masterContainer.appendChild(masterContent);
    patternContainer.appendChild(masterContainer);

    // Insert at the top of the container
    container.insertBefore(patternContainer, container.firstChild);
}

/**
 * Create enhanced pattern badge element
 * @param {Object} pattern - Pattern data
 * @param {string} category - Pattern category
 * @returns {HTMLElement} Badge element
 */
function createEnhancedPatternBadge(pattern, category) {
    const badge = document.createElement('button');
    badge.className = `enhanced-pattern-badge ${category}`;

    // Get display name and count
    const name = pattern.name || pattern.shortName || pattern.type;
    const count = pattern.matches?.length || pattern.count || 1;

    // Get chord symbols if available and <= 6 chords
    const chordSymbols = pattern.pattern && pattern.pattern.length <= 6
        ? pattern.pattern.join('-')
        : (pattern.chords && pattern.chords.length <= 6 ? pattern.chords.join('-') : '');

    // Build tooltip
    let tooltip = pattern.description || pattern.fullName || name;
    if (pattern.positions) {
        tooltip += `\nPositions: ${pattern.positions.map(p => p + 1).join(', ')}`;
    } else if (pattern.matches) {
        tooltip += `\nFound at: ${pattern.matches.map(m => `measure ${m + 1}`).join(', ')}`;
    }
    tooltip += '\n\nClick to highlight';

    badge.title = tooltip;

    // Badge content with two rows: chords on top (if short), name below
    let content = '';
    if (chordSymbols) {
        content += `<div class="pattern-badge-chords">${chordSymbols}</div>`;
    }
    content += `<div class="pattern-badge-name">${name}`;
    if (count > 1) {
        content += `<span class="pattern-badge-count">${count}×</span>`;
    }
    content += `</div>`;

    badge.innerHTML = content;

    // Click handler to highlight chords
    badge.addEventListener('click', (e) => {
        e.stopPropagation();

        // Clear any existing highlights first
        clearPatternHighlights();

        // Remove active state from all badges
        document.querySelectorAll('.enhanced-pattern-badge').forEach(b => {
            b.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
        });

        // Check if this badge is already active
        const isActive = badge.dataset.active === 'true';

        if (!isActive) {
            // Activate this badge
            badge.dataset.active = 'true';
            badge.style.boxShadow = `0 4px 12px ${PATTERN_CATEGORIES[category]?.color || '#a855f7'}88`;

            // Calculate positions to highlight
            let positions = [];
            if (pattern.positions && Array.isArray(pattern.positions)) {
                positions = pattern.positions;
            } else if (pattern.matches) {
                // For progressions, expand matches to full pattern length
                const patternLen = pattern.pattern?.length || 1;
                positions = pattern.matches.flatMap(m =>
                    Array.from({ length: patternLen }, (_, i) => m + i)
                );
            }

            highlightPatternChordsByPositions(positions);
        } else {
            // Deactivate this badge
            badge.dataset.active = 'false';
            badge.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
        }
    });

    return badge;
}

/**
 * Highlight chords at specific positions
 * @param {Array} positions - Array of chord positions
 */
function highlightPatternChordsByPositions(positions) {
    // Clear existing highlights
    clearPatternHighlights();

    if (!positions || positions.length === 0) return;

    positions.forEach(pos => {
        // Find card by data-chord-index attribute
        const card = document.querySelector(`.chord-card-wrapper[data-chord-index="${pos}"]`);

        if (card) {
            card.classList.add('pattern-highlight');
            // Apply styles directly to ensure they work
            card.style.setProperty('box-shadow', '0 0 15px rgba(168, 85, 247, 0.6)', 'important');
            card.style.setProperty('border-color', '#a855f7', 'important');
            card.style.setProperty('border-width', '2px', 'important');
        }
    });

    // Auto-clear after 3 seconds
    setTimeout(() => {
        clearPatternHighlights();
        // Also reset badge active states
        document.querySelectorAll('.enhanced-pattern-badge').forEach(b => {
            b.dataset.active = 'false';
            b.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
        });
    }, 3000);
}

// ============================================================================
// CARD CREATION - SIMPLIFIED VIEW
// ============================================================================

// ============================================================================
// CARD UPDATE FUNCTIONS
// ============================================================================

/**
 * Update a single card without re-rendering everything
 * Updates cards in all containers with matching data-chord-index
 * Skips fullscreen cards (marked with data-fs-card) - they handle their own refresh
 * @param {number} index - Chord index
 */
export function updateSingleCard(index) {
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    const key = trainerState.currentKey || 'C';

    if (!chord) return;

    // Update cards in all containers (Progression Builder, Melody Composer, Builder)
    // Skip fullscreen cards - they use their own refresh mechanism
    const wrappers = document.querySelectorAll(`.chord-card-wrapper[data-chord-index="${index}"]:not([data-fs-card])`);
    if (wrappers.length === 0) return;

    wrappers.forEach(wrapper => {
        updateSingleCardWrapper(wrapper, chord, index, key);
    });

    // Note: Fullscreen panel refresh is NOT called here automatically
    // It's called explicitly by chordBracketEditor when chord data actually changes
}

/**
 * Update a single card wrapper with new chord data
 * @param {HTMLElement} wrapper - Card wrapper element
 * @param {Object} chord - Chord data
 * @param {number} index - Chord index
 * @param {string} key - Current key
 */
function updateSingleCardWrapper(wrapper, chord, index, key) {
    if (!wrapper || !chord) return;

    // Check if this card is currently expanded
    const isExpanded = isChordExpanded(index);

    // Completely disable ALL transitions and animations using CSS class
    // This overrides the global .chord-card-wrapper transition and animation rules
    wrapper.classList.add('no-animation');

    // Replace the card's HTML with updated version
    if (isExpanded) {
        wrapper.innerHTML = createDetailedCardHTML(chord, index, key);
        // Ensure expanded class is present
        wrapper.classList.add('expanded-card-wrapper');
        // Remove fixed width for expanded cards (they size dynamically)
        wrapper.style.width = '';

        // Render chord notation on the canvas (after DOM is ready)
        requestAnimationFrame(() => {
            const canvas = wrapper.querySelector('.chord-notation-canvas');
            if (canvas) {
                renderChordNotation(chord, key, canvas);

                // Adjust card dimensions based on canvas size
                const dimensions = calculateCanvasDimensions(key, chord.notes);
                const detailedCard = wrapper.querySelector('.detailed-card');
                if (detailedCard) {
                    detailedCard.style.minWidth = `${dimensions.width + 20}px`;
                }
                // Don't set wrapper minWidth - CSS handles it via fit-content
            }
        });
    } else {
        wrapper.innerHTML = '';
        const simplifiedStructure = createSimplifiedCardStructure(chord, index, key);
        wrapper.appendChild(simplifiedStructure);
        // Ensure expanded class is removed
        wrapper.classList.remove('expanded-card-wrapper');
        // Set fixed width for simplified cards
        wrapper.style.width = '120px';
    }

    // Re-attach event listeners
    attachCardEventListeners(wrapper, index);

    // Keep no-animation class permanently to prevent any flash
    // The CSS rule ensures all children also have transitions/animations disabled

    // Restore selection (purple ring) if this card was selected
    const selectedIndex = getSelectedChordIndex();
    if (selectedIndex === index) {
        const card = wrapper.querySelector('.simplified-card, .detailed-card');
        if (card) {
            card.classList.add('ring-4', 'ring-purple-500', 'ring-offset-2');
            card.setAttribute('data-selected', 'true');
        }
    }
    // No longer need transforms - flexbox/grid handles layout automatically
}

// ============================================================================
// HELPER FUNCTIONS - CHORD SUGGESTIONS & PLAYBACK
// ============================================================================

/**
 * Suggest optimal inversion for voice leading
 * Analyzes bass note motion between chords and recommends smoothest inversion
 * @param {number} chordIndex - Index of chord to analyze
 * @returns {Object|null} Suggestion object or null if no suggestion
 */
function suggestInversion(chordIndex) {
    const trainerState = getTrainerState();
    const currentChord = trainerState.progressionData[chordIndex];
    const previousChord = chordIndex > 0 ? trainerState.progressionData[chordIndex - 1] : null;

    if (!previousChord || !currentChord) {
        return null;
    }

    // Get previous chord's bass note (lowest note)
    // Guard against null/undefined notes array
    if (!previousChord.notes || !Array.isArray(previousChord.notes)) {
        return null;
    }
    const prevNotes = previousChord.notes.filter(n => !(previousChord.omittedNotes || []).includes(n));
    if (prevNotes.length === 0) return null;

    const prevBassNote = prevNotes[0]; // First note is typically the bass
    const prevBassMidi = noteToMidi(prevBassNote);

    // Get current chord's possible bass notes for each inversion
    const def = CHORD_DEFINITIONS[currentChord.type];
    if (!def) return null;

    const maxInversion = Math.min(def.intervals.length - 1, 2); // Limit to first 3 inversions

    let bestInversion = 0;
    let smallestInterval = Infinity;
    let bestBassNote = '';
    let intervalDetails = '';

    for (let inv = 0; inv <= maxInversion; inv++) {
        const chordResult = getInvertedChordNotes(
            currentChord.root,
            currentChord.type,
            inv,
            trainerState.currentKey,
            currentChord.octaveShift || 0,
            getKeyBasedEnharmonic(),
            getNotationPreference()
        );

        if (chordResult && chordResult.specificNotes.length > 0) {
            const currentBassNote = chordResult.specificNotes[0];
            const currentBassMidi = noteToMidi(currentBassNote);

            // Calculate interval (prefer stepwise motion or small intervals)
            const interval = Math.abs(currentBassMidi - prevBassMidi);
            const semitones = interval % 12;

            // Prefer stepwise motion (1-2 semitones) or small intervals
            if (semitones <= 2 || interval < smallestInterval) {
                smallestInterval = interval;
                bestInversion = inv;
                bestBassNote = currentBassNote.replace(/[0-9]/g, '');

                // Create interval description
                if (semitones === 0) {
                    intervalDetails = 'same note (common tone)';
                } else if (semitones === 1) {
                    intervalDetails = 'half step (smooth voice leading)';
                } else if (semitones === 2) {
                    intervalDetails = 'whole step (smooth voice leading)';
                } else if (semitones <= 4) {
                    intervalDetails = 'small interval (good voice leading)';
                } else {
                    intervalDetails = 'smaller leap than current';
                }
            }
        }
    }

    // Only suggest if different from current
    if (bestInversion === currentChord.inversion) {
        return null;
    }

    const inversionName = INVERSION_NAMES[bestInversion] || `Inversion ${bestInversion}`;
    const prevBassNoteName = prevBassNote.replace(/[0-9]/g, '');

    return {
        inversion: bestInversion,
        inversionName: inversionName,
        reason: `Creates smoother voice leading from ${prevBassNoteName} to ${bestBassNote} (${intervalDetails})`,
        bassNote: bestBassNote,
        prevBassNote: prevBassNoteName,
        interval: intervalDetails
    };
}

/**
 * Toggle staff notation display for a chord card
 * Works with both Progression Builder and Composition Studio tabs
 * @param {number} chordIndex - Index of chord in progression
 * @param {string} sourceContainerId - Optional container ID where the toggle was clicked
 */
function toggleStaffNotation(chordIndex, sourceContainerId = null) {
    // Determine which containers to update
    const containers = [];
    if (sourceContainerId === 'melody-progression-visualization') {
        // Toggled from melody tab - update both
        containers.push('progression-visualization');
        containers.push('melody-progression-visualization');
    } else if (sourceContainerId === 'progression-visualization') {
        // Toggled from progression tab - update both
        containers.push('progression-visualization');
        containers.push('melody-progression-visualization');
    } else {
        // Default: try to find which container has the chord
        const progWrapper = document.querySelectorAll('#progression-visualization > div')[chordIndex];
        const melodyWrapper = document.querySelectorAll('#melody-progression-visualization > div')[chordIndex];
        if (progWrapper) containers.push('progression-visualization');
        if (melodyWrapper) containers.push('melody-progression-visualization');
    }

    // Get the current state from the first available container
    let currentState = null;
    for (const containerId of containers) {
        const wrapper = document.querySelectorAll(`#${containerId} > div`)[chordIndex];
        if (wrapper) {
            const card = wrapper.querySelector('.progression-chord-item');
            if (card) {
                const staffContainer = card.querySelector(`#staff-notation-${chordIndex}`) || document.getElementById(`staff-notation-${chordIndex}`);
                if (staffContainer) {
                    currentState = !staffContainer.classList.contains('hidden');
                    break;
                }
            }
        }
    }

    // Determine new state (toggle)
    const newState = !currentState;

    // Store the state for this position
    staffNotationStates.set(chordIndex, newState);

    // Update all containers
    containers.forEach(containerId => {
        const wrapper = document.querySelectorAll(`#${containerId} > div`)[chordIndex];
    if (!wrapper) return;

    const card = wrapper.querySelector('.progression-chord-item');
    if (!card) return;

        // Find elements within this specific container (not globally by ID)
        const staffContainer = card.querySelector(`#staff-notation-${chordIndex}`) || document.getElementById(`staff-notation-${chordIndex}`);
        const staffCanvas = card.querySelector(`#staff-canvas-${chordIndex}`) || document.getElementById(`staff-canvas-${chordIndex}`);
    const staffToggleBtn = wrapper.querySelector('button[title="Toggle staff notation view"], button[title="Show chord card"]');

    if (!staffContainer || !staffCanvas) return;

    // Get all card content except the staff container and header
        const header = card.querySelector(`#chord-header-${chordIndex}`) || document.getElementById(`chord-header-${chordIndex}`);
    const cardContent = Array.from(card.children).filter(child =>
        child.id !== `staff-notation-${chordIndex}` &&
        child.id !== `chord-header-${chordIndex}`
    );

    if (newState) {
        // Show staff, hide card content (but keep header visible)
        staffContainer.classList.remove('hidden');
        cardContent.forEach(child => {
            child.style.display = 'none';
        });

        // Change icon to "abc" text
        if (staffToggleBtn) {
            staffToggleBtn.innerHTML = '<span class="font-bold text-sm">abc</span>';
            staffToggleBtn.title = 'Show chord card';
        }

        renderStaffNotation(chordIndex, staffCanvas);
    } else {
        // Hide staff, show card content
        staffContainer.classList.add('hidden');
        cardContent.forEach(child => {
            child.style.display = '';
        });

        // Change icon back to music note
        if (staffToggleBtn) {
            staffToggleBtn.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"></path></svg>';
            staffToggleBtn.title = 'Toggle staff notation view';
        }
        }
    });
}

/**
 * Update notation display based on selected sections in section view mode
 * Filters VexFlow rendering to show only measures in selected sections
 */
function updateNotationForSelectedSections() {

    if (getProgressionViewMode() !== 'section') {
        return;
    }

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) {
        return;
    }

    const selectedIds = getSelectedSectionIds();

    // Get notation composer instance via the getter function
    const notationComposer = window.getNotationComposer ? window.getNotationComposer() : null;
    if (!notationComposer) {
        return;
    }

    if (selectedIds.length === 0) {
        // Show all measures when no section selected
        // Clear any existing measure filter
        if (typeof notationComposer.clearMeasureFilter === 'function') {
            notationComposer.clearMeasureFilter();
        }
        if (typeof notationComposer.render === 'function') {
            notationComposer.render();
        }
        return;
    }

    // Calculate measure range - need to handle both real sections and pseudo-sections
    // Build the combined sections list (including pseudo-sections)
    const realSections = compositionState.getSections() || [];
    const allSectionsWithPseudo = buildSectionChipsWithUngrouped(realSections);

    // Collect all chord indices from selected sections (real or pseudo)
    let allChordIndices = [];
    selectedIds.forEach(sectionId => {
        const section = allSectionsWithPseudo.find(s => s.id === sectionId);
        if (section && section.chordIndices) {
            allChordIndices.push(...section.chordIndices);
        }
    });

    if (allChordIndices.length === 0) {
        if (typeof notationComposer.render === 'function') {
            notationComposer.render();
        }
        return;
    }

    // Calculate measure range from chord indices
    const startMeasure = Math.min(...allChordIndices);
    const endMeasure = Math.max(...allChordIndices);


    // Set the persistent measure filter so that subsequent render() calls respect it
    // This allows canvas interactions (hover, click, edit) to work within the filtered view
    if (typeof notationComposer.setMeasureFilter === 'function') {
        notationComposer.setMeasureFilter(startMeasure, endMeasure);
    }

    // Render the filtered measures
    if (typeof notationComposer.renderFilteredMeasures === 'function') {
        notationComposer.renderFilteredMeasures(startMeasure, endMeasure);
    } else {
        // Fallback: just render normally (filter is set, render() will use it)
        if (typeof notationComposer.render === 'function') {
            notationComposer.render();
        }
    }
}

/**
 * Render melody notation if on Composition Studio tab or Free mode is active
 * @param {boolean} preventScroll - Whether to prevent scrolling after render
 */
function renderMelodyNotationIfNeeded(preventScroll = false) {
    // Check if we're on the Composition Studio tab
    const currentTab = getCurrentTab();
    const isMelodyTab = currentTab === 'melody';

    // Check if Free mode controls are visible (Free mode is active)
    const freeModeControls = document.getElementById('free-mode-controls');
    const isFreeModeActive = freeModeControls && !freeModeControls.classList.contains('hidden');

    // Only render if on Melody tab or if Free mode is active
    if (isMelodyTab || isFreeModeActive) {
        // Phase 4.4: Use enhanced notation system if available
        // Sync progression to compositionState first, then refresh notation
        // Note: refreshNotationFromProgression is debounced, so multiple calls are coalesced
        if (window.syncProgressionToMelodyComposer && window.getCompositionState) {
            window.syncProgressionToMelodyComposer();
        }
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression(preventScroll);
        }
    }
}

/**
 * Play a chord once with duration (for preview/test playback)
 * @param {Array} notes - Array of note names to play
 */
function playTrainerChordOnce(notes) {
    initAudio();
    if (!getAudioIsReady()) return;

    stopTrainerChord();
    if (window.stopBuilderChord) window.stopBuilderChord();

    getPiano().triggerAttackRelease(notes, '0.5s');

    const trainerState = getTrainerState();
    highlightTrainer(trainerState.scaleNotes, notes);
    Tone.Draw.schedule(() => {
        highlightTrainer(trainerState.scaleNotes, null);
    }, Tone.now() + 0.5);
}

// ============================================================================
// MAIN RENDERING FUNCTIONS
// ============================================================================

/**
 * Get maximum inversion for a left-hand type
 * @param {string} lhType - Left-hand type
 * @returns {number} Maximum inversion
 */
function getMaxInversionForLhType(lhType) {
    let intervals;
    if (lhType === 'Major' || lhType === 'Minor' || lhType === 'Dominant 7th') {
        intervals = CHORD_DEFINITIONS[lhType].intervals;
    } else if (lhType === 'shell_maj7' || lhType === 'shell_min7' || lhType === 'shell_dom7') {
        intervals = [0, 4, 11]; // All shells are 3-note chords
    } else {
        intervals = [0]; // For single notes or simple intervals
    }
    return Math.max(0, (intervals || [0]).length - 1);
}

/**
 * Render progression display (debounced public API)
 * Multiple rapid calls are coalesced into a single render for better performance.
 * Use flushPendingRenders() if you need to ensure renders complete immediately,
 * or pass immediate=true to bypass debouncing entirely.
 * @param {string} containerId - Container ID
 * @param {boolean} syncBothTabs - Whether to sync both tabs
 * @param {boolean} immediate - If true, bypass debouncing and render immediately
 */
export function renderProgressionDisplay(containerId = 'progression-visualization', syncBothTabs = true, immediate = false) {
    if (immediate) {
        // Flush any pending renders first to avoid stale state
        flushPendingRenders();
        renderProgressionDisplayImmediate(containerId, syncBothTabs);
    } else {
        scheduleRender(containerId, syncBothTabs);
    }
}

/**
 * Render progression display immediately (bypasses debouncing)
 * This is the actual rendering implementation.
 * @param {string} containerId - Container ID
 * @param {boolean} syncBothTabs - Whether to sync both tabs
 */
function renderProgressionDisplayImmediate(containerId = 'progression-visualization', syncBothTabs = true) {
    // Render progression cards to the specified container

    // Capture staff notation states before clearing DOM (always capture from both tabs)
    captureStaffNotationStates();

    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    // Save scroll positions of all scrollable containers before re-rendering
    const scrollPositions = new Map();
    const scrollableSelectors = [
        '.scroll-view-container',
        '.section-filtered-cards',
        '.section-cards-wrapper',
        '.section-chips-container',
        '[class*="overflow-x-auto"]'
    ];
    scrollableSelectors.forEach(selector => {
        container.querySelectorAll(selector).forEach(el => {
            if (el.scrollLeft > 0) {
                // Use a unique key based on class or id
                const key = el.id || el.className;
                scrollPositions.set(key, el.scrollLeft);
            }
        });
    });
    // Also check if container itself is scrollable
    if (container.scrollLeft > 0) {
        scrollPositions.set('container', container.scrollLeft);
    }

    // IMPORTANT: Destroy Sortable BEFORE clearing innerHTML
    // because innerHTML = '' destroys all DOM elements Sortable is tracking
    // Destroy Sortable for both progression builder and melody tab
    if ((containerId === 'progression-visualization' || containerId === 'melody-progression-visualization') && container.sortableInstance) {
        try {
            container.sortableInstance.destroy();
            container.sortableInstance = null;
        } catch (e) {
            container.sortableInstance = null;
        }
    }

    container.innerHTML = '';

    const trainerState = getTrainerState();

    // DEPRECATED: This block handles the old "Progression Workshop" tab which has been removed.
    // The container 'progression-visualization' no longer exists in the UI.
    // This code is kept for reference but will never execute.
    // TODO: Remove this entire block in a future cleanup pass.
    if (containerId === 'progression-visualization' && trainerState.progressionData.length > 0) {
        // Get parent panel to render pattern badges and tension curve outside the grid
        const panel = container.parentElement;

        // Remove old pattern badges and tension curve if they exist
        const oldPatterns = panel?.querySelector('#pattern-highlights-container');
        const oldTension = panel?.querySelector('#tension-curve-container');
        const oldTensionArc = panel?.querySelector('#tension-arc-container');
        if (oldPatterns) oldPatterns.remove();
        if (oldTension) oldTension.remove();
        if (oldTensionArc) oldTensionArc.remove();

        // Clear any existing pattern highlights from chord cards
        clearPatternHighlights();

        // 1. Pattern highlighting badges at top of panel (before grid)
        if (panel) {
            renderPatternHighlights(panel, trainerState.progressionData, trainerState.currentKey || 'C');
            // Move it before the grid container
            const badges = panel.querySelector('#pattern-highlights-container');
            if (badges) {
                panel.insertBefore(badges, container);
            }
        }

        // 2. Simplified chord cards with Add Chord/Clear All buttons as first grid item
        // Check if we have any sections defined - if so, use section-aware rendering,
        // unless a one-time flat layout has been requested.
        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        let hasSections = compositionState && compositionState.getSections().length > 0;

        // One-time override: when forceFlatLayoutOnce is true, ignore sections
        // for this render of the main progression view. This avoids rare stacking
        // issues when inserting chords via suggestions in heavily-sectioned songs.
        if (containerId === 'progression-visualization' && forceFlatLayoutOnce) {
            hasSections = false;
            forceFlatLayoutOnce = false;
        }

        // Both section-aware and flat rendering use the same approach:
        // 1. Clear container and remove grid classes
        // 2. Add toolbar at top (full width) with view mode toggle
        // 3. Add grid container with cards below

        // Clear and restructure container
        container.innerHTML = '';
        // Save original classes and temporarily make it a flex column
        const originalClasses = container.className;
        container.className = 'flex flex-col gap-2 p-2 bg-white rounded-lg border border-gray-200';

        // Add view mode toggle toolbar if we have sections
        const sections = compositionState ? compositionState.getSections() : [];
        if (sections.length > 0) {
            const toolbar = document.createElement('div');
            toolbar.className = 'flex items-center justify-between px-3 py-2 bg-indigo-50 rounded-lg border-2 border-indigo-200 mb-3';
            toolbar.id = 'view-mode-toolbar';
            toolbar.style.cssText = 'min-height: 40px;'; // Ensure visibility

            // Label on left
            const label = document.createElement('span');
            label.className = 'text-sm font-semibold text-indigo-700';
            label.textContent = 'Card View:';
            toolbar.appendChild(label);

            // Toggle on right
            toolbar.appendChild(createViewModeToggle());
            container.appendChild(toolbar);


            // Debug: verify it's actually in the DOM
            setTimeout(() => {
                const toolbarCheck = document.getElementById('view-mode-toolbar');
            }, 100);
        } else {
        }

        // Create container for cards
        const gridContainer = document.createElement('div');
        gridContainer.id = `${containerId}-cards-grid`;

        // Branch based on view mode
        if (getProgressionViewMode() === 'section' && sections.length > 0) {
            // Section View Mode: show section picker and filtered cards
            gridContainer.className = 'flex flex-col gap-2';
            renderSectionViewMode(gridContainer, trainerState.progressionData, trainerState.currentKey || 'C', sections);
        } else if (getProgressionViewMode() === 'scroll') {
            // Scroll View Mode: horizontal scrolling
            renderScrollViewMode(gridContainer, trainerState.progressionData, trainerState.currentKey || 'C', {
                showActionButtons: true
            });
            // Initialize sortable on the grid container
            initializeSimplifiedSortable(gridContainer);
        } else {
            // Default: Use flexbox with horizontal scroll (no wrapping)
            gridContainer.className = 'scroll-view-container flex flex-nowrap items-start gap-1 overflow-x-auto pb-2';
            if (hasSections) {
                renderSectionAwareCards(gridContainer, trainerState.progressionData, trainerState.currentKey || 'C', {
                    showActionButtons: true
                });
            } else {
                renderFlatCards(gridContainer, trainerState.progressionData, trainerState.currentKey || 'C', {
                    showActionButtons: true
                });
            }
            // Initialize sortable on the grid container
            initializeSimplifiedSortable(gridContainer);
        }

        container.appendChild(gridContainer);

        // 3. Tension curve visualization (after grid, at bottom of panel) - Phase 3 Enhanced
        if (panel) {
            const compositionStateForTension = window.getCompositionState ? window.getCompositionState() : null;
            const sectionsForTension = compositionStateForTension ? compositionStateForTension.getSections() : [];
            renderEnhancedTensionCurve(panel, trainerState.progressionData, trainerState.currentKey || 'C', sectionsForTension);
        }

        // 4. Move Quick Analysis Bar above tension curve
        const quickAnalysisBar = panel?.querySelector('#quick-analysis-bar-container');
        const tensionCurve = panel?.querySelector('#tension-arc-container') || panel?.querySelector('#tension-curve-container');
        if (quickAnalysisBar && tensionCurve) {
            // Remove from current position and insert before tension curve
            quickAnalysisBar.remove();
            panel.insertBefore(quickAnalysisBar, tensionCurve);
        }

        // Don't render old-style detailed cards below - they expand inline from simplified
        // (Sortable is already initialized in renderSimplifiedChordSequence)

        // Update Chord Builder panel (three-way sync)
        if (window.updateBuilderProgressionPanel) {
            window.updateBuilderProgressionPanel();
        }

        return;
    }

    // COMPOSITION STUDIO: Use simplified/detailed card style with Add/Clear buttons
    // Also render when we have wireframe sections (even if no chords yet) so users can see placeholders
    const compositionStateForCheck = window.getCompositionState ? window.getCompositionState() : null;
    const sectionsForCheck = compositionStateForCheck ? compositionStateForCheck.getSections() : [];
    const hasWireframeSections = sectionsForCheck.length > 0;

    if (containerId === 'melody-progression-visualization' && (trainerState.progressionData.length > 0 || hasWireframeSections)) {
        // Check if we have any sections defined - if so, use section-aware rendering
        const compositionState = compositionStateForCheck;
        const sections = sectionsForCheck;
        const hasSections = sections.length > 0;

        // Same restructured layout as Progression Builder
        container.innerHTML = '';
        container.className = 'flex flex-col gap-2 p-2 bg-white rounded-lg border border-gray-200';

        // Populate header toggle (toggle is in the Chord Progression header)
        const headerToggle = document.getElementById('header-section-view-toggle');
        if (headerToggle) {
            if (hasSections) {
                headerToggle.innerHTML = '';
                headerToggle.className = 'flex items-center gap-1 ml-2';
                headerToggle.appendChild(createCompactViewModeToggle());
            } else {
                // No sections - hide toggle and default to scroll view
                headerToggle.innerHTML = '';
                headerToggle.className = 'hidden';
                setProgressionViewMode('scroll');
            }
        }

        // Create container for cards
        const gridContainer = document.createElement('div');
        gridContainer.id = `${containerId}-cards-grid`;

        // Branch based on view mode - pass showActionButtons: false since toolbar is above
        if (getProgressionViewMode() === 'section' && sections.length > 0) {
            // Section View Mode: show section picker and filtered cards
            gridContainer.className = 'flex flex-col gap-2';
            renderSectionViewMode(gridContainer, trainerState.progressionData, trainerState.currentKey || 'C', sections);
        } else if (getProgressionViewMode() === 'scroll') {
            // Scroll View Mode: horizontal scrolling
            renderScrollViewMode(gridContainer, trainerState.progressionData, trainerState.currentKey || 'C', {
                showActionButtons: false
            });
            // Initialize sortable on the grid container
            initializeSimplifiedSortable(gridContainer);
        } else {
            // Default: Use flexbox with horizontal scroll (no wrapping)
            gridContainer.className = 'scroll-view-container flex flex-nowrap items-start gap-1 overflow-x-auto pb-2';
            if (hasSections) {
                renderSectionAwareCards(gridContainer, trainerState.progressionData, trainerState.currentKey || 'C', {
                    showActionButtons: false
                });
            } else {
                renderFlatCards(gridContainer, trainerState.progressionData, trainerState.currentKey || 'C', {
                    showActionButtons: false
                });
            }
            // Initialize sortable on the grid container
            initializeSimplifiedSortable(gridContainer);
        }

        container.appendChild(gridContainer);

        // Also update the Composition Studio's notation
        if (window.refreshNotationFromProgression) {
            // Use requestAnimationFrame to ensure system is ready
            requestAnimationFrame(() => {
                // Sync progression to compositionState first
                if (window.syncProgressionToMelodyComposer && window.getCompositionState) {
                    window.syncProgressionToMelodyComposer();
                }
                // Then refresh notation - but respect section view filtering!
                if (getProgressionViewMode() === 'section' && getSelectedSectionIds().length > 0) {
                    // In section view with a selection - use filtered rendering
                    // Add a small delay to ensure sync has completed
                    setTimeout(() => {
                        updateNotationForSelectedSections();
                    }, 50);
                } else {
                    // Normal full rendering
                    window.refreshNotationFromProgression();
                }
            });
        }

        return;
    }

    // For other views, render traditional detailed cards
    trainerState.progressionData.forEach((chordData, index) => {
        // Create wrapper container for controls above and card below
        const wrapper = document.createElement('div');
        wrapper.className = 'flex flex-col items-center w-full max-w-[170px] relative';
        // Make wrapper draggable for Sortable
        wrapper.setAttribute('data-index', index);

        // Controls container above the card (centered)
        // Position relative with z-index to appear on top of expanded cards
        const topControls = document.createElement('div');
        topControls.className = 'flex items-center justify-center gap-1 mb-0.5 relative z-10';

        const playBtn = document.createElement('button');
        playBtn.innerHTML = '<svg class="w-2.5 h-2.5 inline mr-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z"></path></svg>Play';
        playBtn.className = 'px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 active:bg-indigo-300 transition no-drag';
        playBtn.setAttribute('data-chord-index', index);
        playBtn.onmousedown = (e) => {
            e.stopPropagation();
            // Don't preventDefault - audio needs the event to work properly
            // Get current index from wrapper's data attribute (handles drag-and-drop)
            const wrapper = e.target.closest(`#${containerId} > div`);
            const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
            startProgressionChord(currentIndex);
        };
        playBtn.onmouseup = (e) => {
            e.stopPropagation();
            stopTrainerChord();
        };
        playBtn.onmouseleave = (e) => {
            e.stopPropagation();
            stopTrainerChord();
        };
        // Touch events for mobile/tablet
        playBtn.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            e.preventDefault();
            // Get current index from wrapper's data attribute (handles drag-and-drop)
            const wrapper = e.target.closest(`#${containerId} > div`);
            const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
            startProgressionChord(currentIndex);
        }, { passive: false });
        playBtn.addEventListener('touchend', (e) => {
            e.stopPropagation();
            e.preventDefault();
            stopTrainerChord();
        }, { passive: false });
        playBtn.addEventListener('touchcancel', (e) => {
            e.stopPropagation();
            e.preventDefault();
            stopTrainerChord();
        }, { passive: false });
        topControls.appendChild(playBtn);

        // Add Staff Notation Toggle button (icon only, next to Play)
        const staffToggleBtn = document.createElement('button');
        staffToggleBtn.innerHTML = '<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"></path></svg>';
        staffToggleBtn.className = 'p-0.5 text-teal-600 rounded-full hover:bg-teal-100 transition';
        staffToggleBtn.title = 'Toggle staff notation view';
        staffToggleBtn.setAttribute('data-chord-index', index);
        staffToggleBtn.onclick = (e) => {
            e.stopPropagation();
            // Get current index from wrapper's data attribute (handles drag-and-drop)
            const wrapper = e.target.closest(`#${containerId} > div`);
            const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
            // Pass the container ID so we can sync both tabs
            toggleStaffNotation(currentIndex, containerId);
        };
        topControls.appendChild(staffToggleBtn);

        // Add Chord Suggestion button (lightbulb icon, next to staff toggle)
        const suggestionBtn = document.createElement('button');
        suggestionBtn.innerHTML = '💡';
        suggestionBtn.className = 'text-sm p-0.5 text-yellow-600 rounded-full hover:bg-yellow-100 transition';
        suggestionBtn.title = 'Get chord suggestions';
        suggestionBtn.setAttribute('data-chord-index', index);
        suggestionBtn.onclick = (e) => {
            e.stopPropagation();
            // Get current index from wrapper's data attribute (handles drag-and-drop)
            const wrapper = e.target.closest(`#${containerId} > div`);
            const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
            if (window.showProgressionChordSuggestions) {
                window.showProgressionChordSuggestions(currentIndex);
            }
        };
        topControls.appendChild(suggestionBtn);

        wrapper.appendChild(topControls);

        // Create the card itself
        const card = document.createElement('div');
        card.className = 'p-1 bg-indigo-50 rounded-lg shadow border border-indigo-200 flex flex-col gap-0.5 progression-chord-item w-full';
        // Prevent text selection during drag
        card.style.userSelect = 'none';
        card.style.webkitUserSelect = 'none';
        card.style.msUserSelect = 'none';

        // Add click handler for theory tools selection
        card.onclick = (e) => {
            // Don't trigger if clicking on buttons inside the card
            if (e.target.closest('button')) return;
            if (window.setSelectedChordIndex) {
                // Get current index from wrapper's data attribute (handles drag-and-drop)
                const currentIndex = parseInt(wrapper.getAttribute('data-index')) || index;
                window.setSelectedChordIndex(currentIndex);
            }
        };

        const header = document.createElement('div');
        header.className = 'flex justify-between items-start';

        const nameContainer = document.createElement('div');
        nameContainer.className = 'flex flex-col text-left';

        // PHASE 3.3: Color-coded roman numerals by harmonic function
        const colors = getFunctionColors(chordData.roman);

        const romanEl = document.createElement('span');
        romanEl.className = `font-mono font-bold text-sm ${colors.romanColor} leading-tight`;
        romanEl.textContent = chordData.roman;
        nameContainer.appendChild(romanEl);

        const simpleNameEl = document.createElement('span');
        simpleNameEl.className = 'px-0.5 font-sans text-[10px] text-gray-500 leading-tight';
        simpleNameEl.textContent = chordData.simpleName || '';
        nameContainer.appendChild(simpleNameEl);

        // Add chord function label (Tonic, Dominant, Subdominant, etc.)
        const functionLabel = getChordFunction(chordData.roman);
        if (functionLabel) {
            const functionEl = document.createElement('span');
            functionEl.className = `px-0.5 font-sans text-[10px] ${colors.functionColor} font-medium leading-tight`;
            functionEl.textContent = functionLabel;
            nameContainer.appendChild(functionEl);
        }

        // Add scale notes indicator (shows which scale notes work over this chord)
        const scaleNotesEl = document.createElement('span');
        scaleNotesEl.className = 'px-0.5 font-sans text-[9px] text-purple-500 leading-tight cursor-help whitespace-nowrap overflow-hidden text-ellipsis block';
        const trainerState = getTrainerState();
        const scaleNotes = trainerState.scaleNotes || [];
        const chordNotes = chordData.notes || [];
        const scaleNotesInChord = scaleNotes.filter(sn => {
            const snBase = sn.replace(/[0-9]/g, '');
            return chordNotes.some(cn => cn.replace(/[0-9]/g, '') === snBase);
        });
        if (scaleNotesInChord.length > 0) {
            const scaleText = `Scale: ${scaleNotesInChord.map(n => n.replace(/[0-9]/g, '')).slice(0, 3).join(', ')}${scaleNotesInChord.length > 3 ? '...' : ''}`;
            scaleNotesEl.textContent = scaleText;
            scaleNotesEl.title = `Scale notes that work over this chord: ${scaleNotesInChord.map(n => n.replace(/[0-9]/g, '')).join(', ')}`;
            nameContainer.appendChild(scaleNotesEl);
        }

        header.appendChild(nameContainer);

        // Delete button in header (right side)
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';
        deleteBtn.className = 'p-0.5 text-gray-400 rounded-full hover:bg-gray-200 hover:text-gray-600 transition flex-shrink-0';
        deleteBtn.title = 'Remove Chord';
        deleteBtn.onmousedown = (e) => {
            e.stopPropagation();
        };
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            // Get current index from wrapper's data attribute (handles drag-and-drop)
            const currentIndex = parseInt(wrapper.getAttribute('data-index')) || index;
            removeChordFromProgression(currentIndex);
        };
        header.appendChild(deleteBtn);

        header.id = `chord-header-${index}`;

        card.title = `Drag to reorder ${chordData.simpleName}`;
        card.style.cursor = 'grab';

        card.appendChild(header);

        // Staff Notation Container (hidden by default)
        // This will be shown when toggled, replacing all other card content
        const staffContainer = document.createElement('div');
        staffContainer.id = `staff-notation-${index}`;
        staffContainer.className = 'hidden p-1 bg-white rounded w-full overflow-hidden';
        const staffCanvas = document.createElement('canvas');
        staffCanvas.id = `staff-canvas-${index}`;
        // Render at 220px to give VexFlow room to space notes far from clef
        staffCanvas.width = 220;
        staffCanvas.height = 150;
        // Display at 100% of card width
        staffCanvas.style.width = '100%';
        staffCanvas.style.maxWidth = '100%';
        staffCanvas.style.height = 'auto';
        staffCanvas.style.display = 'block';
        staffContainer.appendChild(staffCanvas);
        card.appendChild(staffContainer);

        // Chord Type Selector with Quality Indicator
        const typeSelectContainer = document.createElement('div');
        typeSelectContainer.className = 'relative mt-0';

        const typeSelect = document.createElement('select');
        typeSelect.className = 'w-full p-0.5 pr-5 text-[10px] border border-gray-300 rounded';
        Object.keys(CHORD_DEFINITIONS).forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = getNotationPreference() === 'symbol' ? (CHORD_DEFINITIONS[type].symbol || type) : type;
            if (type === chordData.type) option.selected = true;
            typeSelect.appendChild(option);
        });
        typeSelect.onchange = (e) => {
            const wrapper = e.target.closest(`#${containerId} > div`);
            const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
            updateProgressionChord(currentIndex, 'type', e.target.value);
        };
        typeSelect.onmousedown = (e) => e.stopPropagation();
        typeSelect.style.cursor = 'default';
        typeSelectContainer.appendChild(typeSelect);
        card.appendChild(typeSelectContainer);

        // Voicing editor for RH chord
        const editor = document.createElement('div');
        editor.className = 'flex flex-wrap gap-x-1 gap-y-0.5 items-center p-0.5 mt-0.5 rounded bg-gray-50 border';

        const voicingLabelContainer = document.createElement('div');
        voicingLabelContainer.className = 'w-full flex items-center justify-between mb-0';

        const voicingLabel = document.createElement('h4');
        voicingLabel.className = 'text-[10px] font-semibold text-indigo-600';
        voicingLabel.textContent = 'Voicing';
        voicingLabelContainer.appendChild(voicingLabel);

        // Add "All" and "None" buttons for RH voicing
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'flex gap-0.5';

        const allButton = document.createElement('button');
        allButton.textContent = 'All';
        allButton.className = 'px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors';
        allButton.onmousedown = (e) => e.stopPropagation();
        allButton.onclick = (e) => {
            const wrapper = e.target.closest('#progression-visualization > div');
            const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
            const trainerState = getTrainerState();
            const chord = trainerState.progressionData[currentIndex];
            if (!chord) return;

            // Save state before changing voicing
            saveStateBeforeChange();

            // Ensure omittedNotes array exists
            if (!chord.omittedNotes) {
                chord.omittedNotes = [];
            }

            // Select all: clear all omitted notes
            chord.omittedNotes = [];

            // Update checkboxes directly without re-rendering
            const cardWrapper = e.target.closest('#progression-visualization > div');
            if (cardWrapper) {
                const checkboxes = cardWrapper.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => {
                    if (chord.notes && chord.notes.includes(cb.value)) {
                        cb.checked = true;
                    }
                });
            }

            // Play chord with duration
            const lhNotes = getLHNotes(
                chord.root,
                chord.lhType,
                chord.lhInversion,
                trainerState.currentKey,
                chord.lhOctaveShift,
                chord.type,
                getKeyBasedEnharmonic()
            ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
            const voicedNotes = chord.notes.filter(n => !chord.omittedNotes.includes(n));
            const allNotes = voicedNotes.concat(lhNotes);
            if (allNotes.length > 0) {
                playTrainerChordOnce(allNotes);
            }
        };
        allButton.title = 'Select all notes';

        const noneButton = document.createElement('button');
        noneButton.textContent = 'None';
        noneButton.className = 'px-1.5 py-0.5 text-[10px] font-semibold bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors';
        noneButton.onmousedown = (e) => e.stopPropagation();
        noneButton.onclick = (e) => {
            const wrapper = e.target.closest('#progression-visualization > div');
            const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
            const trainerState = getTrainerState();
            const chord = trainerState.progressionData[currentIndex];
            if (!chord) return;

            // Save state before changing voicing
            saveStateBeforeChange();

            // Ensure omittedNotes array exists
            if (!chord.omittedNotes) {
                chord.omittedNotes = [];
            }

            // Select none: omit all notes
            const notesToOmit = [...(chord.notes || [])];
            chord.omittedNotes = notesToOmit;

            // Update checkboxes directly without re-rendering
            const cardWrapper = e.target.closest(`#${containerId} > div`);
            if (cardWrapper) {
                const checkboxes = cardWrapper.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => {
                    if (chord.notes && chord.notes.includes(cb.value)) {
                        cb.checked = false;
                    }
                });
            }

            // Play chord with duration (should be empty if all notes omitted)
            const lhNotes = getLHNotes(
                chord.root,
                chord.lhType,
                chord.lhInversion,
                trainerState.currentKey,
                chord.lhOctaveShift,
                chord.type,
                getKeyBasedEnharmonic()
            ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
            const voicedNotes = chord.notes.filter(n => !chord.omittedNotes.includes(n));
            const allNotes = voicedNotes.concat(lhNotes);
            // Play even if empty (will just play LH notes if any)
            playTrainerChordOnce(allNotes);
        };
        noneButton.title = 'Deselect all notes';

        buttonContainer.appendChild(allButton);
        buttonContainer.appendChild(noneButton);
        voicingLabelContainer.appendChild(buttonContainer);
        editor.appendChild(voicingLabelContainer);

        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'w-full flex flex-wrap gap-x-2 gap-y-0.5 mb-1';

        const notesForVoicing = chordData.notes || [];
        notesForVoicing.forEach(note => {
            const wrapper = document.createElement('label');
            wrapper.className = 'flex items-center gap-0.5 cursor-pointer text-gray-700 text-[10px]';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = note;
            checkbox.checked = !(chordData.omittedNotes || []).includes(note);
            checkbox.className = 'w-2.5 h-2.5 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500';
        checkbox.onmousedown = (e) => e.stopPropagation();
            checkbox.onchange = (e) => {
                const cardWrapper = e.target.closest(`#${containerId} > div`);
                const currentIndex = cardWrapper ? parseInt(cardWrapper.getAttribute('data-index')) || index : index;
                toggleProgressionNote(currentIndex, note);
            };
            wrapper.appendChild(checkbox);
            wrapper.append(note);
            checkboxContainer.appendChild(wrapper);
        });
        editor.appendChild(checkboxContainer);

        // Inversion Selector with Suggestions
        const invContainer = document.createElement('div');
        invContainer.className = 'mt-0.5';

        const invLabelContainer = document.createElement('div');
        invLabelContainer.className = 'flex items-center justify-between mb-0.5';

        const invLabel = document.createElement('label');
        invLabel.className = 'block text-[10px] font-medium text-gray-600';
        invLabel.textContent = 'Inversion:';
        invLabelContainer.appendChild(invLabel);

        // Add suggestion button with tooltip
        const inversionSuggestionBtn = document.createElement('button');
        inversionSuggestionBtn.type = 'button';
        inversionSuggestionBtn.textContent = '💡';
        inversionSuggestionBtn.title = 'Hover to see inversion suggestion';
        inversionSuggestionBtn.onmousedown = (e) => e.stopPropagation();

        // Check if there's a suggestion and set button color accordingly
        const checkSuggestion = () => {
            const suggestion = suggestInversion(index);
            if (suggestion) {
                // Green-tinted when there is a suggestion
                inversionSuggestionBtn.className = 'px-1 py-0.5 text-[10px] bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors relative';
            } else {
                // Red-tinted when there is no suggestion
                inversionSuggestionBtn.className = 'px-1 py-0.5 text-[10px] bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors relative';
            }
        };

        // Set initial button color
        checkSuggestion();

        // Create tooltip container - append to body to avoid z-index issues
        const tooltipContainer = document.createElement('div');
        tooltipContainer.id = `inversion-tooltip-${index}`;
        tooltipContainer.className = 'fixed bg-white border border-gray-300 rounded-lg shadow-xl z-[9999] p-2';
        tooltipContainer.style.display = 'none';
        tooltipContainer.style.width = '240px';
        document.body.appendChild(tooltipContainer);

        // Show tooltip on hover
        let tooltipTimeout;
        inversionSuggestionBtn.addEventListener('mouseenter', () => {
            clearTimeout(tooltipTimeout);
            // Update button color on hover (in case suggestion status changed)
            checkSuggestion();
            const suggestion = suggestInversion(index);

            // Position tooltip near the button
            const rect = inversionSuggestionBtn.getBoundingClientRect();
            tooltipContainer.style.left = `${rect.left + (rect.width / 2)}px`;
            tooltipContainer.style.top = `${rect.top - 10}px`;
            tooltipContainer.style.transform = 'translate(-50%, -100%)';

            if (suggestion) {
                tooltipContainer.innerHTML = `
                    <div class="text-[10px] font-semibold text-indigo-700 mb-0.5">Suggested: ${suggestion.inversionName}</div>
                    <div class="text-[10px] text-gray-600 mb-1.5">${suggestion.reason}</div>
                    <button class="w-full px-2 py-0.5 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors">
                        Accept
                    </button>
                `;

                // Add click handler to Accept button
                const acceptBtn = tooltipContainer.querySelector('button');
                acceptBtn.onclick = (e) => {
                    e.stopPropagation();
                    // Get current index from wrapper's data attribute (handles drag-and-drop)
                    const wrapper = inversionSuggestionBtn.closest(`#${containerId} > div`);
                    const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
                    updateProgressionChord(currentIndex, 'inversion', suggestion.inversion);
                    tooltipContainer.style.display = 'none';
                    // Update button color after accepting suggestion
                    setTimeout(() => checkSuggestion(), 50);
                };

                tooltipContainer.style.display = 'block';
            } else {
                tooltipContainer.innerHTML = `
                    <div class="text-[10px] text-gray-600">No suggestion available. Current inversion is already optimal or no previous chord to compare.</div>
                `;
                tooltipContainer.style.display = 'block';
            }
        });

        inversionSuggestionBtn.addEventListener('mouseleave', () => {
            tooltipTimeout = setTimeout(() => {
                tooltipContainer.style.display = 'none';
            }, 100); // Small delay to allow moving to tooltip
        });

        // Keep tooltip visible when hovering over it
        tooltipContainer.addEventListener('mouseenter', () => {
            clearTimeout(tooltipTimeout);
        });

        tooltipContainer.addEventListener('mouseleave', () => {
            tooltipContainer.style.display = 'none';
        });
        invLabelContainer.appendChild(inversionSuggestionBtn);
        invContainer.appendChild(invLabelContainer);

        // Inversion button switches
        const invButtonContainer = document.createElement('div');
        invButtonContainer.className = 'flex gap-0.5';

        const def = CHORD_DEFINITIONS[chordData.type];
        const maxInversion = def ? def.intervals.length - 1 : 0;
        const currentInversion = chordData.inversion || 0;

        // Create buttons for all available inversions (up to maxInversion)
        const invButtons = [];
        for (let invIndex = 0; invIndex <= maxInversion; invIndex++) {
            const invButton = document.createElement('button');
            invButton.type = 'button';
            // Use INVERSION_NAMES for display, or fallback to 'R' for root, number for others
            const invName = INVERSION_NAMES[invIndex] || (invIndex === 0 ? 'R' : invIndex.toString());
            invButton.textContent = invIndex === 0 ? 'R' : invName.replace('st', '').replace('nd', '').replace('rd', '').replace('th', '');
            invButton.setAttribute('data-inversion', invIndex);
            invButton.className = `flex-1 px-1 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                invIndex === currentInversion
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`;

            let isPlaying = false;
            let heldNotes = null;

            // Helper function to update button highlighting
            const updateButtonHighlighting = () => {
                invButtonContainer.querySelectorAll('button').forEach((btn) => {
                    const btnInversion = parseInt(btn.getAttribute('data-inversion'));
                    if (btnInversion === invIndex) {
                        btn.className = 'flex-1 px-1 py-0.5 text-[10px] font-semibold rounded transition-colors bg-indigo-600 text-white';
                    } else {
                        btn.className = 'flex-1 px-1 py-0.5 text-[10px] font-semibold rounded transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300';
                    }
                });
            };

            const startPlayback = (e) => {
                if (e) e.stopPropagation();
                // Update highlighting immediately
                updateButtonHighlighting();

                if (!isPlaying) {
                    isPlaying = true;
                    // Get chord notes for direct playback
                    const key = getCurrentKey ? getCurrentKey() : 'C';
                    const res = getInvertedChordNotes(
                        chordData.root,
                        chordData.type,
                        invIndex,
                        key,
                        0, // octave shift
                        'sharp', // enharmonic preference
                        'full' // notation preference
                    );
                    heldNotes = res.specificNotes || [];
                    const instrument = window.getInstrument && window.getInstrument();
                    if (instrument && heldNotes.length > 0) {
                        const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                        const baseTime = Tone.now() + 0.01;
                        if (isGuitar) {
                            heldNotes.forEach((n, idx) => instrument.triggerAttack(n, baseTime + idx * 0.0001));
                        } else {
                            instrument.triggerAttack(heldNotes, Tone.now());
                        }
                    }
                }
            };

            const stopPlayback = (e) => {
                if (e) e.stopPropagation();
                if (isPlaying) {
                    isPlaying = false;
                    // Stop playback
                    const instrument = window.getInstrument && window.getInstrument();
                    if (instrument && heldNotes && heldNotes.length > 0) {
                        const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                        if (isGuitar) {
                            heldNotes.forEach(n => {
                                try { instrument.triggerRelease(n, Tone.now()); } catch (_) {}
                            });
                        } else {
                            instrument.triggerRelease(heldNotes, Tone.now());
                        }
                        heldNotes = null;
                    }
                }
            };

            // Hold-to-play with immediate highlighting
            invButton.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                startPlayback(e);
            });

            invButton.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                stopPlayback(e);
                // Update state silently (without playing chord again)
                const wrapper = e.target.closest(`#${containerId} > div`);
                const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
                const selectedInversion = invIndex;

                const trainerState = getTrainerState();
                if (trainerState.progressionData[currentIndex]) {
                    trainerState.progressionData[currentIndex].inversion = selectedInversion;
                    saveStateBeforeChange();
                }
                setTimeout(() => checkSuggestion(), 50);
            });

            invButton.addEventListener('mouseleave', (e) => {
                e.stopPropagation();
                stopPlayback(e);
            });

            // Touch events for mobile/tablet
            invButton.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                e.preventDefault();
                startPlayback(e);
            }, { passive: false });

            invButton.addEventListener('touchend', (e) => {
                e.stopPropagation();
                e.preventDefault();
                stopPlayback(e);
                // Update state silently (without playing chord again)
                const wrapper = e.target.closest(`#${containerId} > div`);
                const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
                const selectedInversion = invIndex;

                const trainerState = getTrainerState();
                if (trainerState.progressionData[currentIndex]) {
                    trainerState.progressionData[currentIndex].inversion = selectedInversion;
                    saveStateBeforeChange();
                }
                setTimeout(() => checkSuggestion(), 50);
            }, { passive: false });

            invButton.addEventListener('touchcancel', (e) => {
                e.stopPropagation();
                e.preventDefault();
                stopPlayback(e);
            }, { passive: false });

            invButtonContainer.appendChild(invButton);
            invButtons.push(invButton);
        }

        invContainer.appendChild(invButtonContainer);

        editor.appendChild(invContainer);

        // Octave Shift Selector
        const octContainer = document.createElement('div');
        octContainer.className = 'mt-0.5';

        const octLabel = document.createElement('label');
        octLabel.className = 'block text-[10px] font-medium text-gray-600 mb-0.5';
        octLabel.textContent = 'Octave Adj.:';
        octContainer.appendChild(octLabel);

        const octSelect = document.createElement('select');
        octSelect.className = 'w-full p-0.5 text-[10px] border border-gray-300 rounded';
        // Reverse order: +3 at top, -3 at bottom
        for (let i = 3; i >= -3; i--) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `${i > 0 ? '+' : ''}${i}`;
            if (i === (chordData.octaveShift || 0)) option.selected = true;
            octSelect.appendChild(option);
        }
        octSelect.onchange = (e) => {
            const wrapper = e.target.closest(`#${containerId} > div`);
            const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
            updateProgressionChord(currentIndex, 'octaveShift', parseInt(e.target.value));
        };
        octSelect.onmousedown = (e) => e.stopPropagation();
        octSelect.style.cursor = 'default';
        octContainer.appendChild(octSelect);
        editor.appendChild(octContainer);

        card.appendChild(editor);

        // Left Hand Controls
        const lhLabel = document.createElement('div');
        lhLabel.className = 'text-[10px] text-gray-500 font-medium mt-0.5';
        lhLabel.textContent = 'Left Hand:';
        card.appendChild(lhLabel);

        const lhContainer = document.createElement('div');
        lhContainer.className = 'p-0.5 mt-0 rounded bg-gray-50 border';

        const lhControlGrid = document.createElement('div');
        lhControlGrid.className = 'grid grid-cols-2 gap-x-0.5 gap-y-0.5 items-end';

        // LH Type Dropdown
        const lhTypeWrapper = document.createElement('div');
        lhTypeWrapper.className = 'col-span-2';
        const lhTypeLabel = document.createElement('label');
        lhTypeLabel.className = 'block text-[10px] font-medium text-gray-600';
        lhTypeLabel.textContent = 'Type';
        const lhTypeSelect = document.createElement('select');
        lhTypeSelect.className = 'w-full p-0.5 text-[10px] border border-gray-300 rounded';

        // Copy options from source select, preserving text and title attributes
        const sourceSelect = document.getElementById('builder-lh-type-select');
        if (sourceSelect) {
            Array.from(sourceSelect.options).forEach(sourceOption => {
                const newOption = document.createElement('option');
                newOption.value = sourceOption.value;
                newOption.textContent = sourceOption.textContent; // Only copy text content, not innerHTML
                if (sourceOption.title) {
                    newOption.title = sourceOption.title; // Copy title attribute for tooltip
                }
                lhTypeSelect.appendChild(newOption);
            });
        }

        lhTypeSelect.value = chordData.lhType || 'off';
        lhTypeSelect.onchange = (e) => {
            const wrapper = e.target.closest(`#${containerId} > div`);
            const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
            updateProgressionChordLH(currentIndex, 'lhType', e.target.value);
        };
        lhTypeSelect.onmousedown = (e) => e.stopPropagation();
        lhTypeWrapper.appendChild(lhTypeLabel);
        lhTypeWrapper.appendChild(lhTypeSelect);
        lhControlGrid.appendChild(lhTypeWrapper);

        // LH Inversion Buttons (similar to RH inversion buttons)
        const lhInvWrapper = document.createElement('div');
        lhInvWrapper.className = 'col-span-2';
        const lhInvLabel = document.createElement('label');
        lhInvLabel.className = 'block text-[10px] font-medium text-gray-600 mb-0.5';
        lhInvLabel.textContent = 'Inversion:';
        lhInvWrapper.appendChild(lhInvLabel);

        const lhInvButtonContainer = document.createElement('div');
        lhInvButtonContainer.className = 'flex gap-0.5';

        const maxLhInversion = getMaxInversionForLhType(chordData.lhType);
        const currentLhInversion = chordData.lhInversion || 0;

        // Only show inversion buttons if LH type is not 'off' and has inversions available
        if (chordData.lhType && chordData.lhType !== 'off' && maxLhInversion > 0) {
            // Create buttons for R, 1, 2, 3 (up to maxLhInversion)
            for (let invIndex = 0; invIndex <= Math.min(maxLhInversion, 3); invIndex++) {
                const lhInvButton = document.createElement('button');
                lhInvButton.type = 'button';
                lhInvButton.textContent = invIndex === 0 ? 'R' : invIndex.toString();
                lhInvButton.setAttribute('data-lh-inversion', invIndex);
                lhInvButton.className = `flex-1 px-1 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                    invIndex === currentLhInversion
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`;

                let isPlaying = false;
                let heldNotes = null;

                // Helper function to update button highlighting
                const updateLhButtonHighlighting = () => {
                    lhInvButtonContainer.querySelectorAll('button').forEach((btn) => {
                        const btnInversion = parseInt(btn.getAttribute('data-lh-inversion'));
                        if (btnInversion === invIndex) {
                            btn.className = 'flex-1 px-1 py-0.5 text-[10px] font-semibold rounded transition-colors bg-indigo-600 text-white';
                        } else {
                            btn.className = 'flex-1 px-1 py-0.5 text-[10px] font-semibold rounded transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300';
                        }
                    });
                };

                const startLhPlayback = (e) => {
                    if (e) e.stopPropagation();
                    // Update highlighting immediately
                    updateLhButtonHighlighting();

                    if (!isPlaying) {
                        isPlaying = true;
                        // Get LH chord notes for direct playback
                        const key = getCurrentKey ? getCurrentKey() : 'C';
                        const lhOctaveShift = chordData.lhOctaveShift || 0;
                        heldNotes = getLHNotes(
                            chordData.root,
                            chordData.lhType,
                            invIndex,
                            key,
                            lhOctaveShift,
                            chordData.type,
                            'sharp' // enharmonic preference
                        ) || [];
                        const instrument = window.getInstrument && window.getInstrument();
                        if (instrument && heldNotes.length > 0) {
                            const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                            const baseTime = Tone.now() + 0.01;
                            if (isGuitar) {
                                heldNotes.forEach((n, idx) => instrument.triggerAttack(n, baseTime + idx * 0.0001));
                            } else {
                                instrument.triggerAttack(heldNotes, Tone.now());
                            }
                        }
                    }
                };

                const stopLhPlayback = (e) => {
                    if (e) e.stopPropagation();
                    if (isPlaying) {
                        isPlaying = false;
                        // Stop playback
                        const instrument = window.getInstrument && window.getInstrument();
                        if (instrument && heldNotes && heldNotes.length > 0) {
                            const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                            if (isGuitar) {
                                heldNotes.forEach(n => {
                                    try { instrument.triggerRelease(n, Tone.now()); } catch (_) {}
                                });
                            } else {
                                instrument.triggerRelease(heldNotes, Tone.now());
                            }
                            heldNotes = null;
                        }
                    }
                };

                // Hold-to-play with immediate highlighting
                lhInvButton.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    startLhPlayback(e);
                });

                lhInvButton.addEventListener('mouseup', (e) => {
                    e.stopPropagation();
                    stopLhPlayback(e);
                    // Update state silently (without playing chord again)
                    const wrapper = e.target.closest(`#${containerId} > div`);
                    const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
                    const selectedLhInversion = invIndex;

                    const trainerState = getTrainerState();
                    if (trainerState.progressionData[currentIndex]) {
                        trainerState.progressionData[currentIndex].lhInversion = selectedLhInversion;
                        saveStateBeforeChange();
                    }
                });

                lhInvButton.addEventListener('mouseleave', (e) => {
                    e.stopPropagation();
                    stopLhPlayback(e);
                });

                // Touch events for mobile/tablet
                lhInvButton.addEventListener('touchstart', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    startLhPlayback(e);
                }, { passive: false });

                lhInvButton.addEventListener('touchend', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    stopLhPlayback(e);
                    // Update state silently (without playing chord again)
                    const wrapper = e.target.closest(`#${containerId} > div`);
                    const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
                    const selectedLhInversion = invIndex;

                    const trainerState = getTrainerState();
                    if (trainerState.progressionData[currentIndex]) {
                        trainerState.progressionData[currentIndex].lhInversion = selectedLhInversion;
                        saveStateBeforeChange();
                    }
                }, { passive: false });

                lhInvButton.addEventListener('touchcancel', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    stopLhPlayback(e);
                }, { passive: false });

                lhInvButtonContainer.appendChild(lhInvButton);
            }
        } else {
            // Show disabled state when LH is off or no inversions available
            const disabledText = document.createElement('div');
            disabledText.className = 'text-[10px] text-gray-400 italic py-0.5';
            disabledText.textContent = chordData.lhType === 'off' ? 'Off' : 'N/A';
            lhInvButtonContainer.appendChild(disabledText);
        }

        lhInvWrapper.appendChild(lhInvButtonContainer);
        lhControlGrid.appendChild(lhInvWrapper);

        // LH Octave Dropdown
        const lhOctWrapper = document.createElement('div');
        lhOctWrapper.className = 'col-span-2';
        const lhOctLabel = document.createElement('label');
        lhOctLabel.className = 'block text-[10px] font-medium text-gray-600 mb-0.5';
        lhOctLabel.textContent = 'Octave Adj.:';
        const lhOctaveSelect = document.createElement('select');
        lhOctaveSelect.className = 'w-full p-0.5 text-[10px] border border-gray-300 rounded';
        lhOctaveSelect.innerHTML = document.getElementById('builder-lh-octave-select').innerHTML;
        lhOctaveSelect.value = chordData.lhOctaveShift || '0';
        lhOctaveSelect.onchange = (e) => {
            const wrapper = e.target.closest(`#${containerId} > div`);
            const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
            updateProgressionChordLH(currentIndex, 'lhOctaveShift', parseInt(e.target.value, 10));
        };
        lhOctaveSelect.onmousedown = (e) => e.stopPropagation();
        lhOctWrapper.appendChild(lhOctLabel);
        lhOctWrapper.appendChild(lhOctaveSelect);
        lhControlGrid.appendChild(lhOctWrapper);

        lhContainer.appendChild(lhControlGrid);

        // LH Voicing Editor
        const lhVoicingEditor = document.createElement('div');
        lhVoicingEditor.className = 'p-0.5 mt-0.5 rounded bg-gray-100 border-t';

        const lhVoicingLabelContainer = document.createElement('div');
        lhVoicingLabelContainer.className = 'w-full flex items-center justify-between mb-0';

        const lhVoicingLabel = document.createElement('h4');
        lhVoicingLabel.className = 'text-[10px] font-semibold text-indigo-600';
        lhVoicingLabel.textContent = 'Voicing';
        lhVoicingLabelContainer.appendChild(lhVoicingLabel);

        const allLhNotes = getLHNotes(
            chordData.root,
            chordData.lhType,
            chordData.lhInversion,
            trainerState.currentKey,
            chordData.lhOctaveShift,
            chordData.type,
            getKeyBasedEnharmonic()
        );

        if (allLhNotes.length > 0) {
            // Add "All" and "None" buttons for LH voicing
            const lhButtonContainer = document.createElement('div');
            lhButtonContainer.className = 'flex gap-0.5';

            const lhAllButton = document.createElement('button');
            lhAllButton.textContent = 'All';
            lhAllButton.className = 'px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500 hover:bg-indigo-600 text-white rounded transition-colors';
            lhAllButton.onmousedown = (e) => e.stopPropagation();
            lhAllButton.onclick = (e) => {
                const wrapper = e.target.closest(`#${containerId} > div`);
                const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
                const trainerState = getTrainerState();
                const chord = trainerState.progressionData[currentIndex];
                if (!chord) return;

                // Save state before changing LH voicing
                saveStateBeforeChange();

                // Ensure lhOmittedNotes array exists
                if (!chord.lhOmittedNotes) {
                    chord.lhOmittedNotes = [];
                }

                // Select all: clear all omitted LH notes
                chord.lhOmittedNotes = [];

                // Update LH checkboxes directly without re-rendering
                const cardWrapper = e.target.closest(`#${containerId} > div`);
                if (cardWrapper) {
                    const lhCheckboxes = cardWrapper.querySelectorAll('.lh-voicing-checkbox');
                    lhCheckboxes.forEach(cb => {
                        cb.checked = true;
                    });
                }

                // Play chord with duration
                const lhNotes = getLHNotes(
                    chord.root,
                    chord.lhType,
                    chord.lhInversion,
                    trainerState.currentKey,
                    chord.lhOctaveShift,
                    chord.type,
                    getKeyBasedEnharmonic()
                ).filter(n => !chord.lhOmittedNotes.includes(n));
                const voicedNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
                const allNotes = voicedNotes.concat(lhNotes);
                if (allNotes.length > 0) {
                    playTrainerChordOnce(allNotes);
                }
            };
            lhAllButton.title = 'Select all LH notes';

            const lhNoneButton = document.createElement('button');
            lhNoneButton.textContent = 'None';
            lhNoneButton.className = 'px-1.5 py-0.5 text-[10px] font-semibold bg-gray-500 hover:bg-gray-600 text-white rounded transition-colors';
            lhNoneButton.onmousedown = (e) => e.stopPropagation();
            lhNoneButton.onclick = (e) => {
                const wrapper = e.target.closest(`#${containerId} > div`);
                const currentIndex = wrapper ? parseInt(wrapper.getAttribute('data-index')) || index : index;
                const trainerState = getTrainerState();
                const chord = trainerState.progressionData[currentIndex];
                if (!chord) return;

                // Save state before changing LH voicing
                saveStateBeforeChange();

                // Ensure lhOmittedNotes array exists
                if (!chord.lhOmittedNotes) {
                    chord.lhOmittedNotes = [];
                }

                // Select none: omit all LH notes
                chord.lhOmittedNotes = [...allLhNotes];

                // Update LH checkboxes directly without re-rendering
                const cardWrapper = e.target.closest(`#${containerId} > div`);
                if (cardWrapper) {
                    const lhCheckboxes = cardWrapper.querySelectorAll('.lh-voicing-checkbox');
                    lhCheckboxes.forEach(cb => {
                        cb.checked = false;
                    });
                }

                // Play chord with duration (should only have RH notes if any)
                const lhNotes = getLHNotes(
                    chord.root,
                    chord.lhType,
                    chord.lhInversion,
                    trainerState.currentKey,
                    chord.lhOctaveShift,
                    chord.type,
                    getKeyBasedEnharmonic()
                ).filter(n => !chord.lhOmittedNotes.includes(n));
                const voicedNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
                const allNotes = voicedNotes.concat(lhNotes);
                // Play even if empty (will just play RH notes if any)
                playTrainerChordOnce(allNotes);
            };
            lhNoneButton.title = 'Deselect all LH notes';

            lhButtonContainer.appendChild(lhAllButton);
            lhButtonContainer.appendChild(lhNoneButton);
            lhVoicingLabelContainer.appendChild(lhButtonContainer);
            lhVoicingEditor.appendChild(lhVoicingLabelContainer);

            const lhCheckboxContainer = document.createElement('div');
            lhCheckboxContainer.className = 'flex flex-wrap gap-x-2 gap-y-0.5';

            allLhNotes.forEach(note => {
                const wrapper = document.createElement('label');
                wrapper.className = 'flex items-center gap-0.5 cursor-pointer text-gray-700 text-[10px]';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = note;
                checkbox.checked = !(chordData.lhOmittedNotes || []).includes(note);
                checkbox.className = 'w-2.5 h-2.5 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500 lh-voicing-checkbox';
        checkbox.onmousedown = (e) => e.stopPropagation();
                checkbox.onchange = (e) => {
                    const cardWrapper = e.target.closest(`#${containerId} > div`);
                    const currentIndex = cardWrapper ? parseInt(cardWrapper.getAttribute('data-index')) || index : index;
                    toggleProgressionLHNote(currentIndex, note);
                };
                wrapper.appendChild(checkbox);
                wrapper.append(note);
                lhCheckboxContainer.appendChild(wrapper);
            });
            lhVoicingEditor.appendChild(lhCheckboxContainer);
            lhContainer.appendChild(lhVoicingEditor);
        }

        card.appendChild(lhContainer);

        // Append card to wrapper
        wrapper.appendChild(card);

        // Append wrapper to container
        container.appendChild(wrapper);
    });

    // Initialize Sortable for drag-and-drop after rendering
    // For both the main progression builder and melody tab
    // Always create a fresh instance since we rebuilt the DOM with innerHTML = ''
    if ((containerId === 'progression-visualization' || containerId === 'melody-progression-visualization') && typeof Sortable !== 'undefined') {
        container.sortableInstance = new Sortable(container, {
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            draggable: '> div', // Only direct children (wrappers) are draggable
            forceFallback: true,
            fallbackOnBody: true,
            scrollSensitivity: 40,
            scrollSpeed: 10,
            // Touch-specific options
            delay: 150, // Delay before drag starts (helps distinguish tap from drag on touch)
            delayOnTouchOnly: true, // Only apply delay on touch devices
            touchStartThreshold: 5, // Pixels of movement needed before drag starts
            swapThreshold: 0.65, // More forgiving drop zone threshold
            filter: 'button, .progression-chord-item button, select, input, label, .no-drag, [role="button"]',
            preventOnFilter: false, // Don't prevent default on filtered elements - let buttons work normally
            // Prevent text selection during drag
            onStart: function(evt) {
                document.querySelectorAll('.progression-chord-item').forEach(card => {
                    card.style.userSelect = 'none';
                    card.style.webkitUserSelect = 'none';
                });
                // Hide any floating tooltips that might intercept pointer events
                document.querySelectorAll("[id^='inversion-tooltip-']").forEach(el => {
                    el.style.display = 'none';
                });
                // Debug snapshot
                if (typeof window !== 'undefined') {
                    window.ddLast = {
                        phase: 'start',
                        oldIndex: evt.oldIndex,
                        newIndex: evt.newIndex,
                        time: Date.now(),
                        itemHTML: evt.item ? evt.item.innerHTML.slice(0, 80) : null
                    };
                }
            },
            onEnd: function(evt) {
                document.querySelectorAll('.progression-chord-item').forEach(card => {
                    card.style.userSelect = '';
                    card.style.webkitUserSelect = '';
                });

                const trainerState = getTrainerState();
                if (evt.oldIndex !== undefined && evt.newIndex !== undefined && evt.oldIndex !== evt.newIndex) {
                    // Move chord data
                    const movedItem = trainerState.progressionData.splice(evt.oldIndex, 1)[0];
                    trainerState.progressionData.splice(evt.newIndex, 0, movedItem);
                    // Move roman numeral
                    const movedRoman = trainerState.progressionRomans.splice(evt.oldIndex, 1)[0];
                    trainerState.progressionRomans.splice(evt.newIndex, 0, movedRoman);
                    // Update indices on wrappers and buttons to match new order
                    Array.from(container.children).forEach((wrapper, idx) => {
                        wrapper.setAttribute('data-index', idx);
                        // Update button indices
                        const buttons = wrapper.querySelectorAll('[data-chord-index]');
                        buttons.forEach(btn => {
                            btn.setAttribute('data-chord-index', idx);
                        });
                    });
                    // Clear active highlight to avoid any pointer stacking issues
                    document.querySelectorAll('.active-progression-card').forEach(card => card.classList.remove('active-progression-card'));

                    // Update global trainer state snapshot for other modules
                    if (typeof window !== 'undefined') {
                        window.trainerState = getTrainerState();
                        window.ddLast = {
                            phase: 'end',
                            oldIndex: evt.oldIndex,
                            newIndex: evt.newIndex,
                            time: Date.now(),
                            orderAfter: Array.from(container.children).map(w => w.getAttribute('data-index'))
                        };
                    }

                    // Re-render the other tab to keep them in sync
                    // Use immediate render to avoid re-debouncing during drag-drop
                    const otherContainerId = containerId === 'progression-visualization'
                        ? 'melody-progression-visualization'
                        : 'progression-visualization';
                    renderProgressionDisplayImmediate(otherContainerId, false);

                    // Update grand staff notation (chord order affects rendering)
                    // Always update regardless of active tab so it's ready when user switches
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                    } else {
                    }

                    // Re-render melody notation if needed (chord order affects melody rendering)
                    renderMelodyNotationIfNeeded();
                }
            }
        });
    }

    // Install lightweight debug helpers (callable from console)
    if (typeof window !== 'undefined' && !window.ddInspect) {
        window.ddInspect = () => {
            const cont = document.getElementById('progression-visualization');
            const wrappers = cont ? Array.from(cont.children) : [];
            const chosen = cont ? cont.querySelectorAll('.sortable-chosen').length : -1;
            const drag = cont ? cont.querySelectorAll('.sortable-drag').length : -1;
            const hasInstance = !!(cont && cont.sortableInstance);
            return {
                hasContainer: !!cont,
                wrappers: wrappers.length,
                chosenCount: chosen,
                dragCount: drag,
                hasSortableInstance: hasInstance,
                lastEvent: window.ddLast || null,
                wrapperIndices: wrappers.map(w => w.getAttribute('data-index')),
                activeCards: cont ? Array.from(cont.querySelectorAll('.active-progression-card')).length : 0
            };
        };
        window.ddForceRebind = () => {
            const cont = document.getElementById('progression-visualization');
            try {
                if (cont && cont.sortableInstance && typeof cont.sortableInstance.destroy === 'function') {
                    cont.sortableInstance.destroy();
                    cont.sortableInstance = null;
                }
            } catch (_) {}
            renderProgressionDisplay('melody-progression-visualization', true);
            return window.ddInspect();
        };
    }

    // Restore staff notation states after rendering is complete
    restoreStaffNotationStates();

    // Update unified suggestions panel
    if (window.updateUnifiedSuggestions) {
        window.updateUnifiedSuggestions();
    }

    // Restore scroll positions after rendering
    if (scrollPositions.size > 0) {
        requestAnimationFrame(() => {
            // Restore container scroll
            if (scrollPositions.has('container')) {
                container.scrollLeft = scrollPositions.get('container');
            }
            // Restore scroll for other containers by matching class names
            scrollableSelectors.forEach(selector => {
                container.querySelectorAll(selector).forEach(el => {
                    const key = el.id || el.className;
                    if (scrollPositions.has(key)) {
                        el.scrollLeft = scrollPositions.get(key);
                    }
                });
            });
        });
    }

    // Restore selection state after rendering (persistent purple ring)
    const selectedIndex = getSelectedChordIndex();
    const freshState = getTrainerState();
    const totalChords = freshState.progressionData ? freshState.progressionData.length : 0;

    // Use setTimeout to ensure DOM has fully updated
    setTimeout(() => {
        if (selectedIndex !== undefined && selectedIndex !== null && selectedIndex >= 0 && selectedIndex < totalChords) {
            // Restore previous selection
            selectChordCard(selectedIndex);
        } else if (totalChords > 0) {
            // No selection - select first chord by default
            selectChordCard(0);
        }
    }, 0);
}

/**
 * Render progression display for Builder tab (exported)
 * @param {HTMLElement} container - Container element
 * @param {Array} progressionData - Chord progression data
 * @param {string} key - Current key
 * @param {Object} options - Rendering options
 */
export function renderProgressionDisplayForBuilder(container, progressionData, key, options = {}) {
    const { showActionButtons = false, isBuilderTab = true, detailed = false } = options;

    if (!progressionData || progressionData.length === 0) return;

    // Destroy existing Sortable instance before clearing
    if (container.sortableInstance) {
        try {
            container.sortableInstance.destroy();
            container.sortableInstance = null;
        } catch (e) {
            container.sortableInstance = null;
        }
    }

    // Clear existing content
    container.innerHTML = '';

    // Check if we have sections
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    const sections = compositionState ? compositionState.getSections() : [];
    const hasSections = sections.length > 0;

    // Use same flex column layout for all cases
    container.className = 'flex flex-col gap-2 p-2 bg-white rounded-lg border border-gray-200';

    // Populate header toggle if we have sections (toggle is in the Chord Progression header)
    const headerToggle = document.getElementById('builder-header-section-view-toggle');
    if (headerToggle) {
        if (hasSections) {
            headerToggle.innerHTML = '';
            headerToggle.className = 'flex items-center gap-1 ml-2';
            headerToggle.appendChild(createCompactBuilderViewModeToggle());
        } else {
            // No sections - hide toggle and default to scroll view
            headerToggle.innerHTML = '';
            headerToggle.className = 'hidden ml-2';
            setProgressionViewMode('scroll');
        }
    }

    // Create container for cards
    const gridContainer = document.createElement('div');
    gridContainer.id = `${container.id || 'builder-progression-visualization'}-cards-grid`;

    // Branch based on view mode (same pattern as Composition Studio)
    if (getProgressionViewMode() === 'section' && hasSections) {
        // Section View Mode: show section picker and filtered cards
        gridContainer.className = 'flex flex-col gap-2';
        renderSectionViewModeForBuilder(gridContainer, progressionData, key, sections, showActionButtons);
    } else if (getProgressionViewMode() === 'scroll') {
        // Scroll View Mode: horizontal scrolling
        renderScrollViewMode(gridContainer, progressionData, key, {
            showActionButtons: showActionButtons,
            isBuilder: true
        });
        initializeSimplifiedSortable(gridContainer);
    } else {
        // Default: Use flexbox with wrapping
        gridContainer.className = 'flex flex-wrap items-start gap-2';
        if (hasSections) {
            renderSectionAwareCards(gridContainer, progressionData, key, {
                showActionButtons: showActionButtons
            });
        } else {
            renderFlatCards(gridContainer, progressionData, key, {
                showActionButtons: showActionButtons
            });
        }
        initializeSimplifiedSortable(gridContainer);
    }

    container.appendChild(gridContainer);

    // Update shift classes
    requestAnimationFrame(() => {
        updateCardShifts();
    });
}

/**
 * Create compact view mode toggle for Chord Lab builder header
 * Styled to match the purple/pink gradient header
 * @returns {HTMLElement} Compact toggle container element
 */
function createCompactBuilderViewModeToggle() {
    const container = document.createElement('div');
    container.className = 'flex items-center gap-1.5';
    container.id = 'compact-builder-view-mode-toggle';

    const isScrollView = getProgressionViewMode() === 'scroll';
    const isSectionView = getProgressionViewMode() === 'section';

    container.innerHTML = `
        <span class="text-xs text-white/70 font-medium">View:</span>
        <div class="flex items-center gap-0.5 bg-white/20 rounded-md p-0.5">
            <button class="compact-builder-view-btn px-2 py-1 text-xs font-medium rounded transition-all duration-200
                           ${isScrollView ? 'bg-white/30 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}"
                    data-mode="scroll" title="Scroll View - Horizontal scrolling">
                Scroll
            </button>
            <button class="compact-builder-view-btn px-2 py-1 text-xs font-medium rounded transition-all duration-200
                           ${isSectionView ? 'bg-white/30 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}"
                    data-mode="section" title="Section View - Navigate by section">
                Section
            </button>
        </div>
    `;

    // Add event listeners
    container.querySelectorAll('.compact-builder-view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent header button toggle
            const mode = btn.getAttribute('data-mode');
            setProgressionViewMode(mode);
            // Re-render both tabs to keep them in sync
            renderProgressionDisplay('melody-progression-visualization', true);
            if (window.updateBuilderProgressionPanel) {
                window.updateBuilderProgressionPanel();
            }
            // Update notation for section view
            updateNotationForSelectedSections();

            // Update toggle button styles
            container.querySelectorAll('.compact-builder-view-btn').forEach(b => {
                const isActive = b.getAttribute('data-mode') === getProgressionViewMode();
                b.className = `compact-builder-view-btn px-2 py-1 text-xs font-medium rounded transition-all duration-200
                              ${isActive ? 'bg-white/30 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}`;
            });
        });
    });

    return container;
}

// Expose to window for chordBuilder.js to use
window.createCompactBuilderViewModeToggle = createCompactBuilderViewModeToggle;

/**
 * Render section view mode specifically for Chord Lab builder
 * Shows section picker bar and filtered cards
 * @param {HTMLElement} gridContainer - Container for cards
 * @param {Array} progressionData - Chord progression data
 * @param {string} key - Current key
 * @param {Array} sections - Array of section objects
 * @param {boolean} showActionButtons - Whether to show action buttons
 */
function renderSectionViewModeForBuilder(gridContainer, progressionData, key, sections, showActionButtons = false) {
    // Add section picker bar (same as Composition Studio)
    const pickerBar = createSectionPickerBar(sections);
    gridContainer.appendChild(pickerBar);

    // Initialize Sortable on the chips container now that it's in the DOM
    const chipsContainer = pickerBar.querySelector('#section-chips-container');
    if (chipsContainer) {
        initializeSectionChipsSortable(chipsContainer);
    }

    // Create cards container wrapper
    const cardsWrapper = document.createElement('div');
    cardsWrapper.className = 'section-cards-wrapper relative overflow-x-auto custom-scrollbar scroll-view-container';
    cardsWrapper.style.cssText = 'scroll-behavior: smooth; -webkit-overflow-scrolling: touch; padding-bottom: 8px;';

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'section-filtered-cards flex flex-nowrap items-start gap-2';
    cardsContainer.id = `${gridContainer.id}-cards-grid`;

    // Collect visible chord indices based on selected sections
    let visibleChordIndices = new Set();
    const selectedIds = getSelectedSectionIds();

    // Build the combined sections list (all sections are now real, including ungrouped)
    const allSections = buildSectionChipsWithUngrouped(sections);

    if (selectedIds.length === 0) {
        // No section selected - show all cards
        progressionData.forEach((_, idx) => visibleChordIndices.add(idx));
    } else {
        // Show only cards from selected sections (including ungrouped sections)
        selectedIds.forEach(sectionId => {
            const section = allSections.find(s => s.id === sectionId);
            if (section && section.chordIndices) {
                section.chordIndices.forEach(idx => visibleChordIndices.add(idx));
            }
        });
    }

    // Render each section (all are now real sections, including ungrouped)
    allSections.forEach(sectionData => {
        // Check if any of this section's chords are visible
        const visibleInSection = (sectionData.chordIndices || []).filter(idx => visibleChordIndices.has(idx));

        // Skip if no visible chords UNLESS it's a placeholder section
        const isPlaceholderSection = sectionData.isPlaceholder || sectionData.fromTemplate;
        if (visibleInSection.length === 0 && !isPlaceholderSection) return;

        // Create section container with outline and label
        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'section-unified-container inline-flex flex-col flex-shrink-0 rounded-lg overflow-visible section-view-card';
        sectionContainer.setAttribute('data-section-id', sectionData.id);

        const isUngrouped = sectionData.type === 'ungrouped';

        if (isUngrouped) {
            sectionContainer.setAttribute('data-ungrouped-section', 'true');
        }

        // Banner header with section label
        const banner = document.createElement('div');
        banner.className = 'section-banner flex items-center gap-2 px-2 py-1 rounded-t-lg cursor-grab active:cursor-grabbing';
        banner.style.backgroundColor = sectionData.color || '#9ca3af';
        banner.setAttribute('data-section-id', sectionData.id);

        banner.innerHTML = `
            <svg class="section-drag-handle w-3 h-3 text-white/70 flex-shrink-0 cursor-grab active:cursor-grabbing" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
            </svg>
            <span class="text-white text-xs font-semibold flex-grow">${sectionData.label || 'Section'}</span>
            <span class="text-white/70 text-xs">${visibleInSection.length}</span>
            <button class="section-menu-btn p-0.5 rounded hover:bg-white/20 transition"
                    onclick="event.stopPropagation(); window.showSectionMenu && window.showSectionMenu(event, '${sectionData.id}')"
                    title="Section options">
                <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                </svg>
            </button>
        `;
        sectionContainer.appendChild(banner);

        // Cards area with colored background
        const cardsArea = document.createElement('div');
        cardsArea.className = 'section-cards-area items-start gap-2 p-2 rounded-b-lg';
        cardsArea.style.display = 'flex';
        cardsArea.style.flexDirection = 'row';
        cardsArea.style.flexWrap = 'nowrap';
        cardsArea.style.overflowX = 'auto';
        cardsArea.style.overflowY = 'visible';
        cardsArea.style.backgroundColor = (sectionData.color || '#9ca3af') + '20';
        cardsArea.style.borderLeft = `3px solid ${sectionData.color || '#9ca3af'}`;
        cardsArea.style.borderRight = `3px solid ${sectionData.color || '#9ca3af'}`;
        cardsArea.style.borderBottom = `3px solid ${sectionData.color || '#9ca3af'}`;
        cardsArea.setAttribute('data-section-id', sectionData.id);

        // Render cards in this section
        if (visibleInSection.length > 0) {
            visibleInSection.forEach(chordIdx => {
                if (chordIdx < progressionData.length) {
                    const chord = progressionData[chordIdx];
                    const wrapper = createChordCardWrapper(chord, chordIdx, key);
                    wrapper.setAttribute('data-in-section', sectionData.id);
                    cardsArea.appendChild(wrapper);
                }
            });
        } else if (isPlaceholderSection) {
            // This is a placeholder section - show "Add Chord" placeholders
            const expectedCount = sectionData.expectedChordCount || 4;
            for (let i = 0; i < expectedCount; i++) {
                const placeholder = document.createElement('div');
                placeholder.className = 'chord-placeholder flex flex-col justify-center items-center p-3 rounded-lg flex-shrink-0';
                placeholder.style.cssText = `
                    min-width: 80px;
                    min-height: 100px;
                    border: 2px dashed ${sectionData.color || '#9ca3af'};
                    background-color: ${(sectionData.color || '#9ca3af')}10;
                    cursor: pointer;
                `;
                placeholder.innerHTML = `
                    <svg class="w-6 h-6 mb-1" style="color: ${sectionData.color || '#9ca3af'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    <span class="text-xs font-medium" style="color: ${sectionData.color || '#9ca3af'}">Add</span>
                `;
                placeholder.onclick = () => {
                    if (window.addChordToSection) {
                        window.addChordToSection(sectionData.id);
                    } else if (window.toggleQuickAddChord) {
                        window.toggleQuickAddChord();
                    }
                };
                cardsArea.appendChild(placeholder);
            }
        }

        sectionContainer.appendChild(cardsArea);
        cardsContainer.appendChild(sectionContainer);
    });

    cardsWrapper.appendChild(cardsContainer);
    gridContainer.appendChild(cardsWrapper);

    // Initialize sortable on section cards areas (for dragging cards between sections)
    initializeSectionCardsAreaSortables(cardsContainer);

    // Initialize sortable for dragging entire section containers
    initializeSectionContainerSortable(cardsContainer);
}

/**
 * Render progression controls (populate dropdowns) (exported)
 */
/**
 * Render progression builder controls
 * - Populates key and progression dropdowns
 * - Sets random key and progression on initial load
 * - Adds event listeners for key/progression changes
 */
export function renderProgressionControls() {
    const keySelect = document.getElementById('trainer-key-select');
    const progressionSelect = document.getElementById('trainer-progression-select');

    if (!keySelect || !progressionSelect) return;

    // Populate key selector with both major and minor keys
    keySelect.innerHTML = '';
    const notes = getKeyBasedEnharmonic() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

    // Build array of all keys for random selection
    const allKeys = [];

    // Add major keys
    notes.forEach((note, index) => {
        const option = document.createElement('option');
        option.value = note;
        option.textContent = `${note} Major`;
        keySelect.appendChild(option);
        allKeys.push(note);
    });

    // Add minor keys
    notes.forEach((note, index) => {
        const option = document.createElement('option');
        option.value = `${note}m`;
        option.textContent = `${note} minor`;
        keySelect.appendChild(option);
        allKeys.push(`${note}m`);
    });

    // Populate progression selector using analyzer's pattern definitions
    progressionSelect.innerHTML = '';
    const progressionKeys = Object.keys(COMMON_PROGRESSIONS);
    progressionKeys.forEach((progKey, index) => {
        const pattern = COMMON_PROGRESSIONS[progKey];
        const option = document.createElement('option');
        option.value = pattern.pattern.join(',');
        option.textContent = pattern.name;
        option.setAttribute('data-pattern-id', progKey);
        progressionSelect.appendChild(option);
    });

    // Randomly select a key and progression on initial load
    // Build valid keys from the actual dropdown options to ensure they match
    // Filter to only VexFlow-compatible keys (avoid D#, G#, A# major which need double sharps)
    const invalidMajorRoots = ['D#', 'G#', 'A#']; // These would require double sharps
    const invalidMinorRoots = ['D#', 'G#', 'A#', 'E#', 'B#']; // These are problematic in minor too

    const validMajorKeys = notes.filter(note => !invalidMajorRoots.includes(note));
    const validMinorKeys = notes
        .filter(note => !invalidMinorRoots.includes(note))
        .map(note => `${note}m`);

    // Categorize progressions by mode based on their first chord
    // Lowercase roman numerals (i, ii, etc.) indicate minor mode
    // Uppercase (I, II, etc.) indicate major mode
    const majorModeProgs = [];
    const minorModeProgs = [];

    progressionKeys.forEach((progKey, index) => {
        const pattern = COMMON_PROGRESSIONS[progKey];
        const firstChord = pattern.pattern[0];
        // Check if first chord is lowercase (minor mode) - look at first letter after any 'b' prefix
        const chordWithoutFlat = firstChord.replace(/^b/, '');
        const isMinorMode = chordWithoutFlat[0] === chordWithoutFlat[0].toLowerCase();

        if (isMinorMode) {
            minorModeProgs.push({ key: progKey, index });
        } else {
            majorModeProgs.push({ key: progKey, index });
        }
    });

    // Randomly decide major or minor mode, then pick matching key and progression
    const useMajorMode = Math.random() > 0.3; // Slight preference for major (70/30)

    let selectedKey, selectedProgIndex, selectedProgName;

    if (useMajorMode && majorModeProgs.length > 0) {
        const randomKeyIndex = Math.floor(Math.random() * validMajorKeys.length);
        const randomProgIndex = Math.floor(Math.random() * majorModeProgs.length);
        selectedKey = validMajorKeys[randomKeyIndex];
        selectedProgIndex = majorModeProgs[randomProgIndex].index;
        selectedProgName = majorModeProgs[randomProgIndex].key;
    } else if (minorModeProgs.length > 0) {
        const randomKeyIndex = Math.floor(Math.random() * validMinorKeys.length);
        const randomProgIndex = Math.floor(Math.random() * minorModeProgs.length);
        selectedKey = validMinorKeys[randomKeyIndex];
        selectedProgIndex = minorModeProgs[randomProgIndex].index;
        selectedProgName = minorModeProgs[randomProgIndex].key;
    } else {
        // Fallback to major if no minor progressions available
        const randomKeyIndex = Math.floor(Math.random() * validMajorKeys.length);
        selectedKey = validMajorKeys[randomKeyIndex];
        selectedProgIndex = 0;
        selectedProgName = progressionKeys[0];
    }

    // Use setKeyDropdownValue to properly handle flat keys that may need dropdown repopulation
    setKeyDropdownValue(selectedKey, false); // false = don't trigger loadProgression yet
    progressionSelect.selectedIndex = selectedProgIndex;

    // Add event listeners
    keySelect.onchange = () => {
        const progressionData = getProgressionData();
        const currentKey = getCurrentKey();
        const newKey = keySelect.value;

        console.log('[KeyChange] Handler triggered:', { currentKey, newKey, chordCount: progressionData?.length || 0 });

        // If same key selected or no chords, just proceed normally
        if (newKey === currentKey || !progressionData || progressionData.length === 0) {
            console.log('[KeyChange] No dialog needed - loading progression normally');
            loadProgression();
            return;
        }

        // Format key names for display (e.g., "C" → "C Major", "Am" → "A minor")
        const formatKeyDisplay = (key) => {
            if (key.endsWith('m')) {
                return `${key.slice(0, -1)} minor`;
            }
            return `${key} Major`;
        };

        console.log('[KeyChange] Showing dialog for key change with', progressionData.length, 'chords');

        const showKeyChangeDialog = window.showKeyChangeDialog;

        // Check if dialog function is available
        if (typeof showKeyChangeDialog !== 'function') {
            console.error('[KeyChange] showKeyChangeDialog is not a function! Falling back to loadProgression');
            loadProgression();
            return;
        }

        // Show dialog to ask how to handle existing chords
        showKeyChangeDialog({
            oldKey: formatKeyDisplay(currentKey),
            newKey: formatKeyDisplay(newKey),
            chords: progressionData,
            onChoice: (choice) => {
                console.log('[KeyChange] Dialog choice:', choice);

                // Handle null/cancelled
                if (!choice) {
                    keySelect.value = currentKey;
                    return;
                }

                // Handle bass clef (chords) - choice is an object { bass: 'transpose'|'keep', treble: ... }
                if (choice.bass === 'transpose') {
                    console.log('[KeyChange] Transposing from', currentKey, 'to', newKey);
                    // Transpose chords to new key (keep Roman numerals, change notes)
                    transposeProgression(currentKey, newKey);
                } else if (choice.bass === 'keep') {
                    console.log('[KeyChange] Keeping chords, updating Roman numerals for', newKey);
                    // Keep same chords but update Roman numerals
                    updateRomanNumerals(newKey);
                }

                // Handle treble clef (melody) if applicable
                if (choice.treble === 'transpose') {
                    console.log('[KeyChange] Transposing melody from', currentKey, 'to', newKey);
                    if (window.transposeTreble) {
                        window.transposeTreble(currentKey, newKey);
                    }
                } else if (choice.treble === 'adjust') {
                    console.log('[KeyChange] Transposing melody with mode adjustment');
                    if (window.transposeTrebleWithModeAdjust) {
                        window.transposeTrebleWithModeAdjust(currentKey, newKey);
                    }
                }
                // 'keep' = do nothing for treble, melody stays as-is

                // Update key and re-render
                setCurrentKey(newKey);
                if (window.renderProgressionCards) {
                    window.renderProgressionCards(document.getElementById('chord-cards-container'), false);
                }
                if (window.renderProgressionDisplay) {
                    window.renderProgressionDisplay('melody-progression-visualization', false);
                }
                if (window.updateKeyboardLabels) window.updateKeyboardLabels();
                if (window.updateKeySignatureDisplay) window.updateKeySignatureDisplay(newKey);
                if (window.updateCurrentKeyDisplay) window.updateCurrentKeyDisplay();

                // Sync to composition state
                if (window.syncProgressionToCompositionState) {
                    window.syncProgressionToCompositionState();
                }
            }
        });
    };
    progressionSelect.onchange = () => loadProgression();

    // Update "Current Key" display text on initial render
    if (window.updateCurrentKeyDisplay) window.updateCurrentKeyDisplay();

    // Add event listener for speed selector - restart playback if currently playing
    const speedSelect = document.getElementById('trainer-speed-select');
    if (speedSelect) {
        speedSelect.onchange = () => {
            const trainerState = getTrainerState();
            if (trainerState.isPlaying && window.handleAutoPlayback) {
                // Restart playback with new speed
                window.handleAutoPlayback(); // This will stop current playback
                // Then start again after a brief delay
                setTimeout(() => {
                    window.handleAutoPlayback(); // This will start with new speed
                }, 100);
            }
        };
    }

    // Style & mood controls are now initialized in the Smart Chord Suggestions panel
    // initializeStyleMoodControls();
    // refreshStyleMoodInsights(true);

    // If progression data is empty, load default progression
    const progressionData = getProgressionData();
    if (progressionData.length === 0) {
        loadProgression();
    } else {
        // Render progression display (syncBothTabs=true handles both containers)
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('melody-progression-visualization', true);
        }
    }
}

// ============================================================================
// SECTION VIEW MODE
// ============================================================================

/**
 * Render section view mode with filtered cards
 * @param {HTMLElement} container - Container element
 * @param {Array} progressionData - Progression data
 * @param {string} key - Current key
 * @param {Array} sections - Array of section objects
 */
function renderSectionViewMode(container, progressionData, key, sections) {
    // Delegate to the builder implementation
    renderSectionViewModeForBuilder(container, progressionData, key, sections, true);
}

/**
 * Handle section chip click
 * @param {string} sectionId - Section ID that was clicked
 * @param {boolean} isShiftClick - Whether shift key was held
 * @param {boolean} isCtrlClick - Whether ctrl/cmd key was held
 */
function handleSectionChipClick(sectionId, isShiftClick, isCtrlClick = false) {
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    const realSections = compositionState ? compositionState.getSections() : [];
    // Use combined list including ungrouped sections for proper range selection
    const allSections = buildSectionChipsWithUngrouped(realSections);
    const selectedIds = getSelectedSectionIds();

    if (isShiftClick) {
        // Shift+click: select range of adjacent sections
        selectSectionRange(sectionId, allSections);
    } else if (isCtrlClick) {
        // Ctrl+click: toggle this section in the selection
        if (isSectionSelectedInView(sectionId)) {
            deselectSectionInView(sectionId);
        } else {
            selectSectionInView(sectionId, true);
        }
    } else {
        // Normal click: toggle selection or select single
        if (isSectionSelectedInView(sectionId) && selectedIds.length === 1) {
            // Clicking the only selected section - deselect it
            deselectSectionInView(sectionId);
        } else {
            // Select only this section
            selectSectionInView(sectionId, false);
        }
    }

    // Re-render with new selection
    rerenderActiveProgressionDisplay();

    // Update notation to show only selected section measures
    if (window.updateNotationForSelectedSections) {
        window.updateNotationForSelectedSections();
    }
}

/**
 * Create section picker bar for section view mode
 * Includes "All" button at left, plus all sections (including ungrouped ones)
 * @param {Array} sections - Array of section objects
 * @returns {HTMLElement} Section picker bar element
 */
function createSectionPickerBar(sections) {
    const bar = document.createElement('div');
    bar.className = 'section-picker-bar flex items-center gap-2 p-2 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg mb-2 border border-gray-200';
    bar.id = 'section-picker-bar';

    // Previous section button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'section-nav-btn p-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0';
    prevBtn.innerHTML = `<svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
    </svg>`;
    prevBtn.title = 'Previous section (←)';
    prevBtn.onclick = () => {
        if (window.navigateToPreviousSection) {
            window.navigateToPreviousSection();
        }
    };
    bar.appendChild(prevBtn);

    // "All" button - moved to left side, right after prev button
    const selectedIds = getSelectedSectionIds();
    const allBtn = document.createElement('button');
    allBtn.className = `px-2.5 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 flex-shrink-0
                        ${selectedIds.length === 0 ? 'bg-indigo-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`;
    allBtn.textContent = 'All';
    allBtn.title = 'Show all chords';
    allBtn.setAttribute('data-section-id', 'all');
    allBtn.onclick = () => {
        clearSectionSelection();
        rerenderActiveProgressionDisplay();
        if (window.updateNotationForSelectedSections) {
            window.updateNotationForSelectedSections();
        }
    };
    bar.appendChild(allBtn);

    // Section chips container
    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'section-chips-container flex items-center gap-1.5 flex-1 overflow-x-auto py-1 px-1';
    chipsContainer.id = 'section-chips-container';
    chipsContainer.style.scrollbarWidth = 'none'; // Hide scrollbar

    // Build combined list of all sections (including ungrouped ones)
    const allChips = buildSectionChipsWithUngrouped(sections);

    allChips.forEach(chipData => {
        const isSelected = isSectionSelectedInView(chipData.id);
        const chip = createSectionChip(chipData, isSelected, handleSectionChipClick);
        chipsContainer.appendChild(chip);
    });

    bar.appendChild(chipsContainer);

    // Note: Sortable initialization is done AFTER this bar is appended to the document
    // See renderSectionViewMode where initializeSectionChipsSortable is called

    // Next section button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'section-nav-btn p-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0';
    nextBtn.innerHTML = `<svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
    </svg>`;
    nextBtn.title = 'Next section (→)';
    nextBtn.onclick = () => {
        if (window.navigateToNextSection) {
            window.navigateToNextSection();
        }
    };
    bar.appendChild(nextBtn);

    return bar;
}

/**
 * Create section chip element for section picker bar
 * @param {Object} section - Section object
 * @param {boolean} isSelected - Whether section is selected
 * @param {Function} onClick - Click handler that receives (sectionId, shiftKey, ctrlKey)
 * @returns {HTMLElement} Section chip element
 */
function createSectionChip(section, isSelected, onClick) {
    const chip = document.createElement('button');
    const chordCount = section.chordIndices?.length || section.chordCount || 0;
    const sectionColor = section.color || '#c084fc';
    const isUngrouped = section.type === 'ungrouped';

    // Much stronger visual difference for selected state
    // Dragging is via the handle, so keep cursor-pointer for the chip itself
    chip.className = `section-chip flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold
                      transition-all duration-200 flex-shrink-0 cursor-pointer
                      ${isSelected ? 'ring-2 ring-offset-2 shadow-lg transform scale-105' : 'hover:scale-102'}`;
    chip.style.cssText = `
        background: ${isSelected ? hexToRgba(sectionColor, 0.35) : hexToRgba(sectionColor, 0.08)};
        border: 2px solid ${isSelected ? sectionColor : hexToRgba(sectionColor, 0.25)};
        color: ${isSelected ? '#1f2937' : '#6b7280'};
        ${isSelected ? `--tw-ring-color: ${sectionColor}; box-shadow: 0 4px 12px ${hexToRgba(sectionColor, 0.4)};` : ''}
    `;

    // Add drag grip icon for all sections (including ungrouped for reordering)
    const dragGrip = `<span class="section-pill-drag-handle cursor-grab active:cursor-grabbing"><svg class="w-3 h-3 opacity-40 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M7 2a2 2 0 10.001 4.001A2 2 0 007 2zm0 6a2 2 0 10.001 4.001A2 2 0 007 8zm0 6a2 2 0 10.001 4.001A2 2 0 007 14zm6-8a2 2 0 10.001-4.001A2 2 0 0013 6zm0 2a2 2 0 10.001 4.001A2 2 0 0013 8zm0 6a2 2 0 10.001 4.001A2 2 0 0013 14z"/>
    </svg></span>`;

    chip.innerHTML = `
        ${dragGrip}
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background: ${sectionColor}; ${isSelected ? 'box-shadow: 0 0 8px ' + sectionColor + ';' : ''}"></span>
        <span class="truncate max-w-[100px]">${section.label || 'Section'}</span>
        <span class="text-[10px] ${isSelected ? 'font-bold' : 'opacity-70'}">(${chordCount})</span>
        ${isSelected ? '<svg class="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
    `;

    chip.setAttribute('data-section-id', section.id);

    // Add click handler AFTER setting innerHTML (innerHTML can clear event listeners)
    chip.addEventListener('click', (e) => {
        // Don't trigger if clicking on drag handle
        if (e.target.closest('.section-pill-drag-handle')) {
            return;
        }
        onClick(section.id, e.shiftKey, e.ctrlKey || e.metaKey);
    });

    // Mark ungrouped sections and store their chord indices for reference
    if (isUngrouped) {
        chip.setAttribute('data-ungrouped-section', 'true');
        chip.setAttribute('data-chord-indices', JSON.stringify(section.chordIndices || []));
    }

    return chip;
}

// ============================================================================
// SCROLL VIEW MODE
// ============================================================================

/**
 * Render scroll view mode with horizontal scroll
 * @param {HTMLElement} gridContainer - Grid container
 * @param {Array} progressionData - Progression data
 * @param {string} key - Current key
 * @param {Object} options - Rendering options
 */
function renderScrollViewMode(gridContainer, progressionData, key, options = {}) {
    // Apply scroll view container styles
    gridContainer.className = 'scroll-view-container flex flex-nowrap items-start gap-1 overflow-x-auto pb-2';
    gridContainer.style.cssText = `
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 transparent;
    `;

    // Check if there are sections - if so, use section-aware rendering
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    const sections = compositionState ? compositionState.getSections() : [];
    const hasSections = sections && sections.length > 0;

    if (hasSections) {
        // Render with section containers/banners in scroll mode
        renderSectionAwareCardsScroll(gridContainer, progressionData, key, options);
    } else {
        // Flat cards without sections
        renderFlatCardsScroll(gridContainer, progressionData, key, options);
    }
}

// ============================================================================
// SECTION-AWARE CARD RENDERING
// ============================================================================

/**
 * Render section-aware cards into grid container
 * @param {HTMLElement} gridContainer - Grid container
 * @param {Array} progressionData - Progression data
 * @param {string} key - Current key
 * @param {Object} options - Rendering options
 */
function renderSectionAwareCards(gridContainer, progressionData, key, options = {}) {
    // Delegate to the scroll implementation
    renderSectionAwareCardsScroll(gridContainer, progressionData, key, options);
}

/**
 * Create unified section container with banner and grouped cards
 * @param {Object} section - Section object
 * @param {Array} progressionData - Full progression data
 * @param {string} key - Current key
 * @returns {HTMLElement} Section container
 */
// ============================================================================
// FLAT CARD RENDERING
// ============================================================================

/**
 * Render flat cards (no sections) into grid container
 * @param {HTMLElement} gridContainer - Grid container
 * @param {Array} progressionData - Progression data
 * @param {string} key - Current key
 * @param {Object} options - Rendering options
 */
function renderFlatCards(gridContainer, progressionData, key, options = {}) {
    // Delegate to the scroll implementation
    renderFlatCardsScroll(gridContainer, progressionData, key, options);
}

// ============================================================================
// VIEW MODE UI COMPONENTS
// ============================================================================

/**
 * Create view mode toggle UI component
 * @returns {HTMLElement} Toggle container
 */
// ============================================================================
// ACTION BUTTONS & TOOLBARS
// ============================================================================

/**
 * Create action buttons toolbar
 * @param {string} containerId - Container ID
 * @returns {HTMLElement} Toolbar element
 */
function createActionButtonsToolbar(containerId) {
    // TODO: Implementation from lines 3541-3585
}

/**
 * Create section toolbar
 * @param {string} containerId - Container ID
 * @returns {HTMLElement} Toolbar element
 */
function createSectionToolbar(containerId) {
    // TODO: Implementation from lines 5188-5209
}

// ============================================================================
// SECTION ELEMENT CREATION
// ============================================================================

/**
 * Create section element with header and card container
 * @param {Object} section - Section data
 * @param {number} sectionIndex - Section index
 * @param {Array} progressionData - Full progression data
 * @param {string} key - Current key
 * @returns {HTMLElement} Section element
 */
function createSectionElement(section, sectionIndex, progressionData, key) {
    // TODO: Implementation from lines 5219-5285
}

/**
 * Create ungrouped section for chords not in any section
 * @param {Array} ungroupedIndices - Indices of ungrouped chords
 * @param {Array} progressionData - Full progression data
 * @param {string} key - Current key
 * @param {boolean} showActionButtons - Whether to show action buttons
 * @returns {HTMLElement} Ungrouped section element
 */
function createUngroupedSection(ungroupedIndices, progressionData, key, showActionButtons) {
    // TODO: Implementation from lines 5295-5366
}

/**
 * Create empty progression state message with "Add First Chord" button
 * @param {string} containerId - Container ID for progression display
 * @returns {HTMLElement} Empty state element
 */
function createEmptyProgressionState(containerId) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-progression-state flex flex-col items-center justify-center p-8 text-center';
    emptyState.innerHTML = `
        <p class="text-gray-500 text-sm mb-4">No chords in progression</p>
        <button onclick="window.toggleQuickAddChord && window.toggleQuickAddChord()"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow transition flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Add First Chord
        </button>
    `;
    return emptyState;
}

/**
 * Build section chips for all sections including ungrouped ones
 * Delegates to compositionState.buildSectionView() which now materializes
 * ungrouped chords as real 'ungrouped' type sections
 * @param {Array} sections - Sections from getSections (not directly used - kept for API compat)
 * @returns {Array} Array of all sections (all are now real, no pseudo-sections)
 */
export function buildSectionChipsWithUngrouped(sections) {
    // Use the centralized buildSectionView from compositionState
    // This now returns all real sections, including 'ungrouped' type sections
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;

    if (compositionState && typeof compositionState.buildSectionView === 'function') {
        // Use the authoritative section view (all sections are now real)
        const sectionView = compositionState.buildSectionView();

        // Check if user has a custom order preference
        const userOrder = getUserSectionOrder();

        if (userOrder && userOrder.length > 0) {
            // Sort by user's preferred order, with fallback to startIndex
            sectionView.sort((a, b) => {
                const aIndex = userOrder.indexOf(a.id);
                const bIndex = userOrder.indexOf(b.id);

                // If both are in userOrder, use that order
                if (aIndex !== -1 && bIndex !== -1) {
                    return aIndex - bIndex;
                }

                // If both are NOT in userOrder, sort by startIndex
                if (aIndex === -1 && bIndex === -1) {
                    return (a.startIndex || 0) - (b.startIndex || 0);
                }

                // Mixed: use startIndex comparison
                return (a.startIndex || 0) - (b.startIndex || 0);
            });
        }
        // If no user order, buildSectionView already returns in startIndex order

        return sectionView;
    }

    // FALLBACK: Old logic for backward compatibility
    const trainerState = getTrainerState();
    const progressionLength = trainerState.progressionData?.length || 0;

    if (progressionLength === 0) return sections;

    // Find all chord indices that are in a section
    const sectionedIndices = new Set();
    sections.forEach(section => {
        (section.chordIndices || []).forEach(idx => sectionedIndices.add(idx));
    });

    // Find ungrouped indices (not in any section)
    const ungroupedIndices = [];
    for (let i = 0; i < progressionLength; i++) {
        if (!sectionedIndices.has(i)) {
            ungroupedIndices.push(i);
        }
    }

    // If no ungrouped chords, just return sections sorted by position
    if (ungroupedIndices.length === 0) {
        return [...sections].sort((a, b) => {
            const aMin = Math.min(...(a.chordIndices || [0]));
            const bMin = Math.min(...(b.chordIndices || [0]));
            return aMin - bMin;
        });
    }

    // Group consecutive ungrouped indices into pseudo-sections
    const ungroupedGroups = [];
    let currentGroup = [ungroupedIndices[0]];

    for (let i = 1; i < ungroupedIndices.length; i++) {
        const prevIdx = ungroupedIndices[i - 1];
        const currIdx = ungroupedIndices[i];

        const sectionInBetween = sections.some(s => {
            const sectionStart = Math.min(...(s.chordIndices || [Infinity]));
            return sectionStart > prevIdx && sectionStart < currIdx;
        });

        if (currIdx === prevIdx + 1 && !sectionInBetween) {
            currentGroup.push(currIdx);
        } else {
            ungroupedGroups.push([...currentGroup]);
            currentGroup = [currIdx];
        }
    }
    if (currentGroup.length > 0) {
        ungroupedGroups.push(currentGroup);
    }

    // Create pseudo-section objects
    const pseudoSections = ungroupedGroups.map((indices, groupIndex) => ({
        id: `no-group-${groupIndex + 1}`,
        label: `No Group ${groupIndex + 1}`,
        color: '#9ca3af',
        chordIndices: indices,
        startIndex: indices[0],
        chordCount: indices.length,
        isPseudoSection: true
    }));

    // Combine and sort
    const allSections = [...sections, ...pseudoSections];
    allSections.sort((a, b) => {
        const aMin = a.startIndex !== undefined ? a.startIndex : Math.min(...(a.chordIndices || [Infinity]));
        const bMin = b.startIndex !== undefined ? b.startIndex : Math.min(...(b.chordIndices || [Infinity]));
        return aMin - bMin;
    });

    return allSections;
}

/**
 * Convert tension value (0-1) to color (green for low, red for high)
 * @param {number} value - Tension value between 0 and 1
 * @returns {string} HSL color string
 */
function tensionToColor(value) {
    const clamped = Math.min(Math.max(value, 0), 1);
    const hue = 120 - Math.round(clamped * 120);
    return `hsl(${hue}, 68%, 48%)`;
}

/**
 * Render tension visualization meter and details
 * @param {Object} analysis - Tension analysis data with profile and summary
 */
function renderTensionVisualization(analysis) {
    const track = document.getElementById('tension-meter-track');
    const summaryEl = document.getElementById('tension-summary-text');
    const descriptorEl = document.getElementById('tension-summary-description');
    const emptyEl = document.getElementById('tension-meter-empty');
    const detailList = document.getElementById('tension-detail-list');

    if (!track) return;

    track.innerHTML = '';
    if (detailList) detailList.innerHTML = '';

    const profile = analysis?.profile || [];
    if (!profile.length) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        if (summaryEl) summaryEl.textContent = '0% avg • 0% peak';
        if (descriptorEl) descriptorEl.textContent = 'Add chords to see where tension builds and releases.';
        return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');

    profile.forEach(item => {
        const segment = document.createElement('div');
        segment.className = 'h-full flex-1 transition-colors duration-300';
        segment.style.backgroundColor = tensionToColor(item.tension);
        segment.style.minWidth = '4px';
        segment.style.margin = '0 0.5px';
        segment.title = `${item.roman} • ${item.level} (${Math.round(item.tension * 100)}%)`;
        track.appendChild(segment);

        if (detailList) {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between text-xs text-gray-600';
            const romanSpan = document.createElement('span');
            romanSpan.className = 'font-mono font-semibold text-gray-700';
            romanSpan.textContent = item.roman;
            const detailSpan = document.createElement('span');
            detailSpan.className = 'text-gray-500';
            detailSpan.textContent = `${item.level} • ${Math.round(item.tension * 100)}%`;
            row.appendChild(romanSpan);
            row.appendChild(detailSpan);
            detailList.appendChild(row);
        }
    });

    const summary = analysis.summary || {};
    if (summaryEl) {
        const averagePct = Math.round((summary.average || 0) * 100);
        const peakPct = Math.round((summary.peak || 0) * 100);
        const trendLabel = summary.trend || 'steady';
        const trendReadable = trendLabel.charAt(0).toUpperCase() + trendLabel.slice(1);
        summaryEl.textContent = `Avg ${averagePct}% • Peak ${peakPct}% • Trend ${trendReadable}`;
    }
    if (descriptorEl && summary.descriptor) {
        descriptorEl.textContent = summary.descriptor;
    }
}

/**
 * Render tension curve visualization (SVG graph)
 * @param {HTMLElement} container - Container element to insert curve into
 * @param {Array} progressionData - Array of chord objects
 * @param {string} key - Current key
 */
function renderTensionCurve(container, progressionData, key) {
    if (!progressionData || progressionData.length === 0) return;

    // Calculate tension values for each chord
    const tensionValues = harmonyAnalyzer.calculateTensionCurve(progressionData, key);

    if (!tensionValues || tensionValues.length === 0) return;

    // Create tension curve container
    const curveContainer = document.createElement('div');
    curveContainer.id = 'tension-curve-container';
    curveContainer.className = 'mb-2 px-2';

    // SVG dimensions - use more of the available width, increase bottom padding for x-axis labels
    const width = Math.min(1200, window.innerWidth - 40);
    const height = 140; // Increased from 120 to accommodate x-axis labels
    const padding = { top: 20, right: 30, bottom: 30, left: 40 }; // Increased bottom padding
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // Calculate SVG path for smooth curve
    const xStep = graphWidth / Math.max(1, tensionValues.length - 1);
    const points = tensionValues.map((tension, i) => ({
        x: padding.left + (i * xStep),
        y: padding.top + graphHeight - (tension / 100 * graphHeight)
    }));

    // Create smooth curve using quadratic bezier curves
    let pathData = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        const controlX = (current.x + next.x) / 2;
        const controlY = (current.y + next.y) / 2;
        pathData += ` Q ${controlX} ${current.y}, ${controlX} ${controlY}`;
        pathData += ` Q ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }

    // Create gradient for tension coloring
    const gradientId = 'tension-gradient';
    const gradientStops = [
        { offset: '0%', color: '#10b981', label: 'Low' },    // Green
        { offset: '50%', color: '#f59e0b', label: 'Medium' }, // Amber
        { offset: '100%', color: '#ef4444', label: 'High' }   // Red
    ];

    // Build SVG (no dark background panel)
    curveContainer.innerHTML = `
        <div class="p-1">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
                    </svg>
                    <h3 class="text-sm font-semibold text-gray-700">Harmonic Tension</h3>
                </div>
                <div class="flex items-center gap-3 text-xs">
                    <div class="flex items-center gap-1">
                        <div class="w-3 h-3 rounded-full bg-green-500"></div>
                        <span class="text-gray-600">Low</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <div class="w-3 h-3 rounded-full bg-amber-500"></div>
                        <span class="text-gray-600">Medium</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <div class="w-3 h-3 rounded-full bg-red-500"></div>
                        <span class="text-gray-600">High</span>
                    </div>
                </div>
            </div>
            <svg width="${width}" height="${height}" class="mx-auto">
                <defs>
                    <linearGradient id="${gradientId}" x1="0%" y1="100%" x2="0%" y2="0%">
                        ${gradientStops.map(stop =>
                            `<stop offset="${stop.offset}" stop-color="${stop.color}" />`
                        ).join('')}
                    </linearGradient>
                    <linearGradient id="${gradientId}-fill" x1="0%" y1="100%" x2="0%" y2="0%">
                        ${gradientStops.map(stop =>
                            `<stop offset="${stop.offset}" stop-color="${stop.color}" stop-opacity="0.15" />`
                        ).join('')}
                    </linearGradient>
                </defs>

                <!-- Grid lines -->
                ${[0, 25, 50, 75, 100].map(tension => {
                    const y = padding.top + graphHeight - (tension / 100 * graphHeight);
                    return `
                        <line
                            x1="${padding.left}"
                            y1="${y}"
                            x2="${padding.left + graphWidth}"
                            y2="${y}"
                            stroke="#374151"
                            stroke-width="1"
                            stroke-dasharray="2,2"
                        />
                        <text
                            x="${padding.left - 8}"
                            y="${y + 4}"
                            text-anchor="end"
                            font-size="10"
                            fill="#9ca3af"
                        >${tension}</text>
                    `;
                }).join('')}

                <!-- Area fill under curve -->
                <path
                    d="${pathData} L ${points[points.length - 1].x} ${padding.top + graphHeight} L ${points[0].x} ${padding.top + graphHeight} Z"
                    fill="url(#${gradientId}-fill)"
                />

                <!-- Tension curve line -->
                <path
                    d="${pathData}"
                    stroke="url(#${gradientId})"
                    stroke-width="3"
                    fill="none"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />

                <!-- Data points -->
                ${points.map((point, i) => {
                    const tension = tensionValues[i];
                    let color = '#10b981'; // Green
                    if (tension > 66) color = '#ef4444'; // Red
                    else if (tension > 33) color = '#f59e0b'; // Amber

                    return `
                        <circle
                            class="tension-curve-point"
                            data-chord-index="${i}"
                            cx="${point.x}"
                            cy="${point.y}"
                            r="5"
                            fill="${color}"
                            stroke="#1f2937"
                            stroke-width="2"
                            style="cursor: pointer; transition: all 0.2s;"
                            onmouseover="this.setAttribute('r', '7'); this.setAttribute('stroke-width', '3');"
                            onmouseout="this.setAttribute('r', '5'); this.setAttribute('stroke-width', '2');"
                        />
                    `;
                }).join('')}

                <!-- X-axis tick marks -->
                ${points.map((point, i) => `
                    <line
                        x1="${point.x}"
                        y1="${padding.top + graphHeight}"
                        x2="${point.x}"
                        y2="${padding.top + graphHeight + 5}"
                        stroke="#9ca3af"
                        stroke-width="1"
                    />
                    <text
                        x="${point.x}"
                        y="${padding.top + graphHeight + 18}"
                        text-anchor="middle"
                        font-size="10"
                        fill="#6b7280"
                        font-weight="500"
                    >${i + 1}</text>
                `).join('')}

                <!-- Y-axis label -->
                <text
                    x="${padding.left / 2}"
                    y="${height / 2}"
                    text-anchor="middle"
                    font-size="11"
                    fill="#9ca3af"
                    transform="rotate(-90, ${padding.left / 2}, ${height / 2})"
                >Tension</text>

                <!-- X-axis label -->
                <text
                    x="${width / 2}"
                    y="${padding.top + graphHeight + 32}"
                    text-anchor="middle"
                    font-size="11"
                    fill="#9ca3af"
                >Chord Position</text>
            </svg>
        </div>
    `;

    // Insert at the top of the container
    container.insertBefore(curveContainer, container.firstChild);

    // Add event listeners to data points for click and hover
    const dataPoints = curveContainer.querySelectorAll('.tension-curve-point');
    dataPoints.forEach((circle, index) => {
        const chord = progressionData[index];
        const tension = tensionValues[index];

        // Press and hold to play chord
        circle.addEventListener('mousedown', () => {
            if (window.startProgressionChord) {
                window.startProgressionChord(index);
                // Highlight this point and the corresponding chord card
                highlightTensionPoint(index);
                highlightChordCard(index);
            }
        });

        // Release to stop playing
        circle.addEventListener('mouseup', () => {
            if (window.stopTrainerChord) {
                window.stopTrainerChord();
            }
            unhighlightAllTensionPoints();
            unhighlightAllChordCards();
        });

        // Click to select chord card (bi-directional sync)
        circle.addEventListener('click', () => {
            selectChordCard(index);
        });

        // Create detailed tooltip on hover (but not if it interferes with playback)
        circle.addEventListener('mouseenter', (e) => {
            showTensionTooltip(e, chord, tension, index, key);
        });

        // Stop playing and hide tooltip if mouse leaves the circle
        circle.addEventListener('mouseleave', () => {
            if (window.stopTrainerChord) {
                window.stopTrainerChord();
            }
            unhighlightAllTensionPoints();
            unhighlightAllChordCards();
            hideTensionTooltip();
        });
    });
}

/**
 * Show detailed tooltip for tension curve point
 * @param {MouseEvent} e - Mouse event for positioning
 * @param {Object} chord - Chord data
 * @param {number} tension - Tension value (0-100)
 * @param {number} index - Chord index
 * @param {string} key - Current key
 */
function showTensionTooltip(e, chord, tension, index, key) {
    // Remove any existing tooltip
    hideTensionTooltip();

    // Get chord function and details
    const func = harmonyAnalyzer.getChordFunction(chord, key);
    const roman = chord.roman || harmonyAnalyzer.getRomanNumeral(chord, key);
    const chordName = chord.simpleName || chord.name || `${chord.root}${chord.type}`;
    const notes = chord.notes ? chord.notes.join(', ') : '';

    // Calculate tension breakdown
    let breakdown = [];

    // Function tension
    const functionTension = {
        'Tonic': 10,
        'Subdominant': 40,
        'Predominant': 50,
        'Dominant': 80
    };
    const funcTension = functionTension[func] || 30;
    breakdown.push(`Function (${func}): ${funcTension}%`);

    // Chord type complexity
    let typeTension = 0;
    if (chord.type) {
        if (chord.type.includes('Diminished')) typeTension = 20;
        else if (chord.type.includes('Augmented')) typeTension = 18;
        else if (chord.type.includes('13')) typeTension = 16;
        else if (chord.type.includes('11')) typeTension = 14;
        else if (chord.type.includes('9')) typeTension = 12;
        else if (chord.type.includes('7')) typeTension = 10;
        else if (chord.type.includes('sus')) typeTension = 8;
    }
    if (typeTension > 0) {
        breakdown.push(`Complexity: ${typeTension}%`);
    }

    // Chromaticism
    const scaleChords = harmonyAnalyzer.getMajorScaleChords(key);
    const isInKey = harmonyAnalyzer.isChordInKey(chord, scaleChords);
    if (!isInKey) {
        breakdown.push(`Chromatic: 20%`);
    }

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.id = 'tension-tooltip';
    tooltip.className = 'fixed z-50 bg-gray-900 text-white p-3 rounded-lg shadow-2xl border border-gray-700 text-sm max-w-xs';
    tooltip.style.left = `${e.clientX + 10}px`;
    tooltip.style.top = `${e.clientY - 10}px`;
    tooltip.style.pointerEvents = 'none';

    tooltip.innerHTML = `
        <div class="font-bold mb-2 text-blue-400">Chord ${index + 1}: ${chordName}</div>
        <div class="space-y-1 text-xs">
            <div><span class="text-gray-400">Roman:</span> ${roman}</div>
            <div><span class="text-gray-400">Type:</span> ${chord.type || 'Major'}</div>
            ${notes ? `<div><span class="text-gray-400">Notes:</span> ${notes}</div>` : ''}
            <div class="border-t border-gray-700 mt-2 pt-2">
                <div class="font-semibold mb-1">Tension: ${Math.round(tension)}%</div>
                <div class="text-gray-400 space-y-0.5">
                    ${breakdown.map(line => `<div>• ${line}</div>`).join('')}
                </div>
            </div>
            <div class="text-xs text-gray-500 italic mt-2">Click to play</div>
        </div>
    `;

    document.body.appendChild(tooltip);
}

/**
 * Hide tension tooltip
 */
function hideTensionTooltip() {
    const tooltip = document.getElementById('tension-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

/**
 * Highlight tension curve point during playback (blue)
 * @param {number} index - Chord index to highlight
 */
export function highlightTensionPoint(index) {
    const container = document.getElementById('tension-curve-container');
    if (!container) return;

    const points = container.querySelectorAll('.tension-curve-point');
    points.forEach((point, i) => {
        if (i === index) {
            point.setAttribute('r', '8');
            point.setAttribute('stroke', '#3b82f6');
            point.setAttribute('stroke-width', '4');
            point.classList.add('highlighted-tension-point');
        }
    });
}

/**
 * Highlight tension curve point for selection (purple to match card selection)
 * This is different from playback highlighting (blue)
 * @param {number} index - Chord index to highlight
 */
export function highlightTensionPointForSelection(index) {
    const container = document.getElementById('tension-curve-container');
    if (!container) return;

    const points = container.querySelectorAll('.tension-curve-point');
    points.forEach((point, i) => {
        if (i === index) {
            point.setAttribute('r', '7');
            point.setAttribute('stroke', '#a855f7'); // Purple to match card selection
            point.setAttribute('stroke-width', '3');
            point.classList.add('selected-tension-point');
        }
    });
}

/**
 * Unhighlight all tension curve points
 * Removes both playback (blue) and selection (purple) highlighting
 */
export function unhighlightAllTensionPoints() {
    const container = document.getElementById('tension-curve-container');
    if (!container) return;

    const points = container.querySelectorAll('.tension-curve-point');
    points.forEach(point => {
        if (point.classList.contains('highlighted-tension-point') || point.classList.contains('selected-tension-point')) {
            point.setAttribute('r', '5');
            point.setAttribute('stroke', '#1f2937');
            point.setAttribute('stroke-width', '2');
            point.classList.remove('highlighted-tension-point', 'selected-tension-point');
        }
    });
}

/**
 * Toggle notation view on simplified chord cards
 * Switches between chord info view and VexFlow notation view
 */
export function toggleSimplifiedCardNotation(wrapper, index) {
    const card = wrapper.querySelector('.simplified-card');
    const chordInfoView = wrapper.querySelector('.chord-info-view');
    const notationView = wrapper.querySelector('.notation-view');
    const canvas = wrapper.querySelector('.simplified-notation-canvas');
    const toggleBtn = wrapper.querySelector('.notation-toggle-btn');
    const musicNoteIcon = toggleBtn?.querySelector('.music-note-icon');
    const abcText = toggleBtn?.querySelector('.abc-text');

    if (!card || !chordInfoView || !notationView || !canvas || !toggleBtn) {
        return;
    }

    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    const key = trainerState.currentKey || 'C';

    // Toggle views
    if (notationView.classList.contains('hidden')) {
        // Show notation view
        chordInfoView.classList.add('hidden');
        notationView.classList.remove('hidden');

        // Change toggle to show ABC text (indicating you can go back to chord info)
        if (musicNoteIcon) musicNoteIcon.classList.add('hidden');
        if (abcText) abcText.classList.remove('hidden');

        // Render notation on canvas with dynamic sizing
        requestAnimationFrame(() => {
            renderChordNotation(chord, key, canvas);

            // Adjust card dimensions based on canvas size
            const dimensions = calculateCanvasDimensions(key, chord.notes);
            card.style.minHeight = `${dimensions.height + 20}px`; // Add padding
            card.style.minWidth = `${dimensions.width + 20}px`; // Set width for notation view
            notationView.style.minHeight = `${dimensions.height + 20}px`;
            notationView.style.minWidth = `${dimensions.width + 20}px`;

            // IMPORTANT: Add class to bypass CSS width constraints
            wrapper.classList.add('has-notation');
            // Don't set wrapper.style.minWidth - let CSS fit-content handle it

            // Update card shifts after layout is applied
            requestAnimationFrame(() => {
                updateCardShifts();
            });
        });
    } else {
        // Show chord info view
        notationView.classList.add('hidden');
        chordInfoView.classList.remove('hidden');

        // Change toggle to show music note icon (indicating you can view notation)
        if (musicNoteIcon) musicNoteIcon.classList.remove('hidden');
        if (abcText) abcText.classList.add('hidden');

        // Remove class to restore CSS width constraints
        wrapper.classList.remove('has-notation');

        // Reset ALL dimension styles to ensure clean state
        card.style.minHeight = '80px';
        card.style.minWidth = '';
        card.style.width = '';
        notationView.style.minHeight = '';
        notationView.style.minWidth = '';
        notationView.style.width = '';
        wrapper.style.minWidth = '';
        wrapper.style.width = '';

        // Force layout by reading dimensions
        wrapper.getBoundingClientRect();

        // Update card shifts after layout is applied with proper timing
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                updateCardShifts();
            });
        });
    }
}

/**
 * Update card shifts for all progression containers
 * Accumulates shifts when multiple cards are expanded
 * Uses transform instead of margin to preserve card width
 */
export function updateCardShifts() {
    // Update shifts for all three containers (Progression Builder, Composition Studio, Chord Builder)
    const containers = [
        document.getElementById('progression-visualization'),
        document.getElementById('melody-progression-visualization'),
        document.getElementById('builder-progression-visualization')
    ].filter(c => c); // Filter out null containers

    containers.forEach(container => {
        updateContainerShifts(container);
    });
}

/**
 * Update shift classes for a specific container
 */
function updateContainerShifts(container) {
    if (!container) return;

    // Use double requestAnimationFrame to ensure DOM is fully rendered and all updates are complete
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            // Get the grid container (may be nested inside main container)
            const gridContainer = container.querySelector('[id$="-cards-grid"]') || container;

            // Check if we have sections - if so, use flexbox layout and skip manual shifting
            // Flexbox handles layout naturally without needing transform shifts
            const hasSections = gridContainer.querySelector('.section-unified-container') !== null;
            if (hasSections) {
                // Clear any existing shifts since flexbox handles layout
                const allWrappers = gridContainer.querySelectorAll('.chord-card-wrapper[data-chord-index]');
                allWrappers.forEach(wrapper => {
                    wrapper.classList.remove('shift-right');
                    wrapper.style.removeProperty('--card-shift');
                    wrapper.style.transform = '';
                });
                return;
            }

            // For grid layouts without sections, apply manual shifting for expanded cards
            const allWrappers = Array.from(gridContainer.querySelectorAll(':scope > .chord-card-wrapper[data-chord-index]'));

            if (allWrappers.length === 0) return;

            // Determine baseline card width (unexpanded, simplified card without notation)
            // Look for a simplified card without notation showing
            let baselineWidth = 0;
            let allCardsHaveNotation = true;

            for (const wrapper of allWrappers) {
                const chordIndex = parseInt(wrapper.getAttribute('data-chord-index'));
                const isExpanded = isChordExpanded(chordIndex);
                const notationView = wrapper.querySelector('.notation-view');
                const notationShowing = notationView && !notationView.classList.contains('hidden');

                // If this is a simplified card without notation, use its width as baseline
                if (!isExpanded && !notationShowing) {
                    baselineWidth = wrapper.offsetWidth;
                    allCardsHaveNotation = false;
                    break;
                }
            }

            // If no baseline found (all cards expanded or showing notation), use a small fixed baseline
            // This ensures all wider cards will cause shifts
            if (baselineWidth === 0 || allCardsHaveNotation) {
                // Use a small baseline so all cards with notation/expanded will cause shifts
                // This represents the minimum "slot" width in the grid
                baselineWidth = 120;
            }

            // If card width is 0, cards might not be rendered yet, try again after a short delay
            if (baselineWidth === 0) {
                setTimeout(() => updateCardShifts(), 50);
                return;
            }

            // For flexbox layouts (when using flex container), don't apply manual shifting
            // Flexbox handles spacing naturally via gap property
            const isFlexLayout = gridContainer.classList.contains('flex');
            if (isFlexLayout) {
                // Clear any existing shifts since flexbox handles layout
                allWrappers.forEach(wrapper => {
                    wrapper.classList.remove('shift-right');
                    wrapper.style.removeProperty('--card-shift');
                    wrapper.style.transform = '';
                });
                return;
            }

            // For CSS Grid layouts, the grid handles card placement automatically
            // We don't need manual shifting - expanded cards will span their cell
            // and grid flow handles the rest
            // Clear any existing shifts
            allWrappers.forEach(wrapper => {
                wrapper.classList.remove('shift-right');
                wrapper.style.removeProperty('--card-shift');
                wrapper.style.transform = '';
            });
        });
    });
}

/**
 * Get all chord card wrappers in the order they appear in the container
 * Handles sections, ungrouped zones, and individual cards
 */
function getAllChordWrappersInOrder(container) {
    const result = [];
    const topLevelItems = container.children;

    for (const item of topLevelItems) {
        if (item.classList.contains('section-unified-container')) {
            // Section container - get cards inside it
            const sectionCards = item.querySelectorAll('.chord-card-wrapper[data-chord-index]');
            result.push(...Array.from(sectionCards));
        } else if (item.classList.contains('ungrouped-drop-zone')) {
            // Ungrouped zone - get cards inside ungrouped-cards-area
            const ungroupedCards = item.querySelectorAll('.ungrouped-cards-area .chord-card-wrapper[data-chord-index]');
            result.push(...Array.from(ungroupedCards));
        } else if (item.classList.contains('chord-card-wrapper') && item.hasAttribute('data-chord-index')) {
            // Individual chord card
            result.push(item);
        }
    }

    return result;
}


/**
 * Render section-aware cards in scroll mode
 * Maintains section grouping with horizontal scrolling
 */
function renderSectionAwareCardsScroll(gridContainer, progressionData, key, options = {}) {
    const { showActionButtons = true } = options;
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;

    if (!progressionData || progressionData.length === 0) return;

    // Get sections sorted by their first chord index
    const sections = compositionState ? compositionState.getSections() : [];
    const sortedSections = [...sections].sort((a, b) => {
        const aMin = Math.min(...a.chordIndices);
        const bMin = Math.min(...b.chordIndices);
        return aMin - bMin;
    });

    // Build a map of chord index → section
    const chordToSection = new Map();
    sections.forEach(section => {
        section.chordIndices.forEach(chordIdx => {
            chordToSection.set(chordIdx, section);
        });
    });

    // Add action buttons
    if (showActionButtons) {
        const isMelodyComposer = gridContainer.id?.includes('melody');
        const toggleFunction = isMelodyComposer ? 'toggleQuickAddChordMelody' : 'toggleQuickAddChord';
        const containerId = gridContainer.id || 'progression-visualization';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'chord-card-wrapper flex flex-col justify-center items-center gap-1.5 p-2 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex-shrink-0';
        buttonContainer.style.scrollSnapAlign = 'start';
        buttonContainer.innerHTML = `
            <button onclick="window.${toggleFunction} && window.${toggleFunction}()"
                    class="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Add chord to progression">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                +Add Chord
            </button>
            <button onclick="window.showAddSectionMenu && window.showAddSectionMenu(event, '${containerId}')"
                    class="add-section-btn w-full px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Select adjacent chords, then add to a section">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
                +Add Section
            </button>
            <button onclick="window.showSongBuilderModal && window.showSongBuilderModal()"
                    class="w-full px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Open Song Builder to organize sections">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                </svg>
                Song Builder
            </button>
            <button onclick="window.clearProgression && window.clearProgression()"
                    class="w-full px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Clear all chords">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"></path>
                </svg>
                Clear
            </button>
        `;
        gridContainer.appendChild(buttonContainer);
    }

    // Use buildSectionView to get the proper section order
    // All sections are now real (including ungrouped ones)
    const sectionView = compositionState ? compositionState.buildSectionView() : [];

    if (sectionView.length > 0) {
        // Render each section using unified container
        sectionView.forEach(section => {
            const sectionContainer = createUnifiedSectionContainer(section, progressionData, key);
            if (sectionContainer) {
                sectionContainer.style.scrollSnapAlign = 'start';
                sectionContainer.style.flexShrink = '0';
                gridContainer.appendChild(sectionContainer);
            }
        });
    } else {
        // Fallback: No sections at all - render all cards as ungrouped
        // This shouldn't happen if buildSectionView works correctly, but just in case
        for (let i = 0; i < progressionData.length; i++) {
            const chord = progressionData[i];
            const wrapper = createChordCardWrapper(chord, i, key);
            if (wrapper) {
                wrapper.style.scrollSnapAlign = 'start';
                wrapper.style.flexShrink = '0';
                wrapper.setAttribute('data-ungrouped', 'true');
                gridContainer.appendChild(wrapper);
            }
        }
    }

    // Initialize Sortable for dragging entire section containers
    initializeSectionContainerSortable(gridContainer);
}

/**
 * Render flat cards in scroll mode
 * Simple horizontal scrolling layout without sections
 */
function renderFlatCardsScroll(gridContainer, progressionData, key, options = {}) {
    const { showActionButtons = true } = options;

    if (!progressionData || progressionData.length === 0) return;

    // Add action buttons
    if (showActionButtons) {
        const isMelodyComposer = gridContainer.id?.includes('melody');
        const toggleFunction = isMelodyComposer ? 'toggleQuickAddChordMelody' : 'toggleQuickAddChord';
        const containerId = gridContainer.id || 'progression-visualization';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'chord-card-wrapper flex flex-col justify-center items-center gap-1.5 p-2 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex-shrink-0';
        buttonContainer.style.scrollSnapAlign = 'start';
        buttonContainer.innerHTML = `
            <button onclick="window.${toggleFunction} && window.${toggleFunction}()"
                    class="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Add chord to progression">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                +Add Chord
            </button>
            <button onclick="window.showAddSectionMenu && window.showAddSectionMenu(event, '${containerId}')"
                    class="add-section-btn w-full px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Select adjacent chords, then add to a section">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
                +Add Section
            </button>
            <button onclick="window.showSongBuilderModal && window.showSongBuilderModal()"
                    class="w-full px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Open Song Builder to organize sections">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                </svg>
                Song Builder
            </button>
            <button onclick="window.clearProgression && window.clearProgression()"
                    class="w-full px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Clear all chords">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"></path>
                </svg>
                Clear
            </button>
        `;
        gridContainer.appendChild(buttonContainer);
    }

    // Render all cards with scroll snap
    progressionData.forEach((chord, index) => {
        // Call createChordCardWrapper (now migrated to this module)
        const wrapper = createChordCardWrapper(chord, index, key);
        if (wrapper) {
            wrapper.style.scrollSnapAlign = 'start';
            wrapper.style.flexShrink = '0';
            gridContainer.appendChild(wrapper);
        }
    });
}


// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Create chord card wrapper (main entry point for card creation)
 * Creates either simplified or detailed card based on expandedChords state
 */
export function createChordCardWrapper(chord, index, key) {
    const wrapper = document.createElement('div');
    // Use class for grid layout - Add no-animation class to prevent all transitions/animations
    const isExpanded = isChordExpanded(index);
    wrapper.className = isExpanded
        ? 'chord-card-wrapper expanded-card-wrapper no-animation'
        : 'chord-card-wrapper no-animation'; // All cards take 1 grid cell
    wrapper.setAttribute('data-chord-index', index);

    // Set fixed width for simplified cards (expanded cards size dynamically)
    if (!isExpanded) {
        wrapper.style.width = '120px';
    }

    // Render simplified or detailed based on state
    if (isExpanded) {
        // Use local function for detailed card HTML
        wrapper.innerHTML = createDetailedCardHTML(chord, index, key);

        // Render chord notation on the canvas (after DOM is ready)
        requestAnimationFrame(() => {
            const canvas = wrapper.querySelector('.chord-notation-canvas');
            if (canvas) {
                // Use local function for notation rendering
                renderChordNotation(chord, key, canvas);

                // Adjust card dimensions based on canvas size
                const dimensions = calculateCanvasDimensions(key, chord.notes);
                const detailedCard = wrapper.querySelector('.detailed-card');
                if (detailedCard && dimensions) {
                    detailedCard.style.minWidth = `${dimensions.width + 20}px`;
                }
                // Don't set wrapper minWidth - CSS handles it via fit-content
                // Setting minWidth causes excessive whitespace between cards

                // Update card shifts after layout is applied
                requestAnimationFrame(() => {
                    updateCardShifts(); // Already migrated - use directly
                });
            }
        });
    } else {
        // For simplified cards, create control bar above the card
        const simplifiedStructure = createSimplifiedCardStructure(chord, index, key);
        wrapper.appendChild(simplifiedStructure);
    }

    // Attach event listeners after rendering
    attachCardEventListeners(wrapper, index);

    return wrapper;
}

/**
 * Create simplified card structure with control bar above
 * @param {Object} chord - Chord data
 * @param {number} index - Chord index
 * @param {string} key - Current key
 * @returns {DocumentFragment} Fragment containing control bar and card
 */
export function createSimplifiedCardStructure(chord, index, key) {
    const fragment = document.createDocumentFragment();

    // Create card element - use local function for simplified card HTML
    const cardContainer = document.createElement('div');
    cardContainer.innerHTML = createSimplifiedCardHTML(chord, index, key);

    // Get the entire card structure (wrapper with card + controls below)
    const cardStructure = cardContainer.firstElementChild; // This is the <div class="relative inline-block">

    // Find the simplified-card inside the structure for tooltip insertion
    const cardElement = cardStructure ? cardStructure.querySelector('.simplified-card') : null;

    if (cardElement) {
        // Create tooltip (appended to body for z-index escape)
        createTooltipElement(chord, index, key);
    }

    if (cardStructure) {
        fragment.appendChild(cardStructure);
    }

    return fragment;
}

/**
 * Create tooltip element for simplified cards
 */
function createTooltipElement(chord, index, key) {
    const roman = chord.roman || harmonyAnalyzer.getRomanNumeral(chord, key);
    const colors = getFunctionColors(roman);
    const fullChordName = `${chord.root} ${chord.type}`;
    const notesText = chord.notes ? chord.notes.join(', ') : '';

    // Get chord description from CHORD_DEFINITIONS
    const def = CHORD_DEFINITIONS ? CHORD_DEFINITIONS[chord.type] : null;
    const chordDescription = def && def.description ? def.description : '';

    // Get harmonic function label
    const functionLabels = {
        'Tonic': 'Tonic (I)',
        'Subdominant': 'Subdominant (IV)',
        'Dominant': 'Dominant (V)',
        'Predominant': 'Predominant',
        'Mediant': 'Mediant',
        'Submediant': 'Submediant (vi)',
        'Leading Tone': 'Leading Tone (vii°)'
    };
    const harmonicFunction = colors.function || 'Unknown';
    const functionLabel = functionLabels[harmonicFunction] || harmonicFunction;

    // Generate inversion buttons for tooltip
    const maxInversion = def ? def.intervals.length - 1 : 2;
    const currentInversion = chord.inversion || 0;
    const tooltipInversionButtons = [];
    for (let inv = 0; inv <= maxInversion; inv++) {
        const isActive = inv === currentInversion;
        const label = inv === 0 ? 'Root' : `${inv}${inv === 1 ? 'st' : inv === 2 ? 'nd' : 'rd'}`;
        tooltipInversionButtons.push(`
            <button class="tooltip-inversion-btn px-2 py-1 text-xs font-semibold rounded transition-colors ${
                isActive ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }" data-inversion="${inv}" data-card-index="${index}">${label}</button>
        `);
    }

    // Remove any existing tooltip for this index (cleanup on re-render)
    const existingTooltip = document.querySelector(`.chord-tooltip[data-chord-index="${index}"]`);
    if (existingTooltip) {
        existingTooltip.remove();
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'chord-tooltip hidden bg-gray-800 border-2 border-indigo-500 rounded-lg shadow-xl p-4 pointer-events-auto';
    tooltip.style.cssText = 'position: fixed; z-index: 999999; min-width: 250px; max-width: 350px;';
    tooltip.setAttribute('data-chord-index', index);
    // Append to body to escape all containers
    document.body.appendChild(tooltip);
    tooltip.innerHTML = `
        <!-- Close button for touch devices -->
        <button class="tooltip-close-btn absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-sm font-bold transition bg-gray-700 hover:bg-gray-600" title="Close">×</button>

        <div class="text-base font-bold text-white mb-2 pr-6">${fullChordName}</div>
        ${chordDescription ? `<div class="text-xs text-gray-300 mb-3 italic leading-relaxed">${chordDescription}</div>` : ''}
        <div class="text-xs text-gray-300 mb-1.5"><strong class="text-gray-200">Notes:</strong> ${notesText}</div>
        <div class="text-xs text-gray-300 mb-1.5"><strong class="text-gray-200">Roman Numeral:</strong> ${roman}</div>
        <div class="text-xs text-gray-300 mb-3"><strong class="text-gray-200">Function:</strong> ${functionLabel}</div>
        <div class="border-t border-gray-600 pt-2.5">
            <div class="text-xs text-gray-300 mb-2 font-semibold">Inversion (hold to play):</div>
            <div class="flex gap-1.5 flex-wrap">
                ${tooltipInversionButtons.join('')}
            </div>
        </div>
        <!-- Tooltip arrow - will be repositioned based on tooltip position -->
        <div class="tooltip-arrow absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-transparent"></div>
    `;

    return tooltip;
}

/**
 * Create unified section container (renders section with cards)
 * Used in section-aware rendering modes
 */
/**
 * Create a pseudo-section container for ungrouped chords
 * This wraps ungrouped chords in a container so they can participate in section reordering
 * @param {Object} section - Pseudo-section object from buildSectionView
 * @param {Array} progressionData - Full progression data
 * @param {string} key - Current key
 * @returns {HTMLElement} Pseudo-section container
 */
function createPseudoSectionContainer(section, progressionData, key) {
    const container = document.createElement('div');
    container.className = 'section-unified-container inline-flex flex-col rounded-lg overflow-visible';
    container.setAttribute('data-section-id', section.id);
    container.setAttribute('data-pseudo-section', 'true');
    container.style.setProperty('--section-color', section.color || '#6b7280');

    // Subtle banner for ungrouped chords - less prominent than real sections
    const banner = document.createElement('div');
    banner.className = 'section-banner flex items-center gap-2 px-2 py-1 rounded-t-lg cursor-grab active:cursor-grabbing';
    banner.style.backgroundColor = section.color || '#6b7280';
    banner.style.opacity = '0.7';
    banner.setAttribute('data-section-id', section.id);

    banner.innerHTML = `
        <svg class="section-drag-handle w-3 h-3 text-white/70 flex-shrink-0 cursor-grab active:cursor-grabbing" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
        </svg>
        <span class="text-white text-xs font-medium flex-grow italic">${section.label || 'Ungrouped'}</span>
    `;

    container.appendChild(banner);

    // Cards container
    const cardsArea = document.createElement('div');
    cardsArea.className = 'section-cards-area items-start gap-2 p-2 rounded-b-lg';
    cardsArea.style.display = 'flex';
    cardsArea.style.flexDirection = 'row';
    cardsArea.style.flexWrap = 'nowrap';
    cardsArea.style.overflowX = 'auto';
    cardsArea.style.overflowY = 'visible';
    cardsArea.style.backgroundColor = (section.color || '#6b7280') + '20'; // 20% opacity - same as real sections
    cardsArea.style.borderLeft = `3px solid ${section.color || '#6b7280'}`;
    cardsArea.style.borderRight = `3px solid ${section.color || '#6b7280'}`;
    cardsArea.style.borderBottom = `3px solid ${section.color || '#6b7280'}`;
    cardsArea.setAttribute('data-section-id', section.id);

    // Render cards using chordIndices from section view
    const indices = section.chordIndices || [];
    indices.forEach(chordIdx => {
        if (chordIdx < progressionData.length) {
            const chord = progressionData[chordIdx];
            const wrapper = createChordCardWrapper(chord, chordIdx, key);
            wrapper.setAttribute('data-ungrouped', 'true');
            cardsArea.appendChild(wrapper);
        }
    });

    container.appendChild(cardsArea);

    // Initialize Sortable on the cards area (same as real sections)
    if (typeof Sortable !== 'undefined') {
        cardsArea.sortableInstance = new Sortable(cardsArea, {
            group: {
                name: 'progression-cards',
                pull: true,
                put: function(to, from, dragEl) {
                    return dragEl.classList.contains('chord-card-wrapper') &&
                           dragEl.hasAttribute('data-chord-index');
                }
            },
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            handle: '.drag-handle',
            filter: 'button, select, input, .play-btn, .delete-btn, .expand-btn, .info-tooltip-btn, .no-drag',
            preventOnFilter: false,
            draggable: '.chord-card-wrapper[data-chord-index]',
            swapThreshold: 0.65,
            delay: 150,
            delayOnTouchOnly: true,
            touchStartThreshold: 5,
            onAdd: function(evt) {
                // Card added from another section/pseudo-section
                handleCardDragWithinSection(evt, evt.from.getAttribute('data-section-id'));
            },
            onEnd: function(evt) {
                // Only handle reorders within this pseudo-section
                if (evt.from !== evt.to) {
                    return;
                }
                handleCardDragWithinSection(evt, section.id);
            }
        });
    }

    return container;
}

function createUnifiedSectionContainer(section, progressionData, key) {
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
        <span class="text-white text-xs font-semibold flex-grow">${section.label}</span>
        <button class="section-menu-btn p-0.5 rounded hover:bg-white/20 transition"
                onclick="event.stopPropagation(); window.showSectionMenu && window.showSectionMenu(event, '${section.id}')"
                title="Section options">
            <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
            </svg>
        </button>
    `;

    container.appendChild(banner);

    // Cards container with colored background - force horizontal layout with inline styles
    const cardsArea = document.createElement('div');
    cardsArea.className = 'section-cards-area items-start gap-2 p-2 rounded-b-lg';
    // Force horizontal layout with inline styles to avoid CSS specificity issues
    cardsArea.style.display = 'flex';
    cardsArea.style.flexDirection = 'row';
    cardsArea.style.flexWrap = 'nowrap';
    cardsArea.style.overflowX = 'auto';
    cardsArea.style.overflowY = 'visible';
    cardsArea.style.backgroundColor = section.color + '20'; // 20% opacity
    cardsArea.style.borderLeft = `3px solid ${section.color}`;
    cardsArea.style.borderRight = `3px solid ${section.color}`;
    cardsArea.style.borderBottom = `3px solid ${section.color}`;
    cardsArea.setAttribute('data-section-id', section.id);

    // Render cards in this section
    if (section.chordIndices && section.chordIndices.length > 0) {
        section.chordIndices.forEach(chordIdx => {
            if (chordIdx < progressionData.length) {
                const chord = progressionData[chordIdx];
                const wrapper = createChordCardWrapper(chord, chordIdx, key); // Already migrated - use locally
                wrapper.setAttribute('data-in-section', section.id);
                cardsArea.appendChild(wrapper);
            }
        });
    } else if (section.isPlaceholder || section.fromTemplate) {
        // This is a placeholder section - show "Add Chord" placeholders
        const expectedCount = section.expectedChordCount || 4;
        for (let i = 0; i < expectedCount; i++) {
            const placeholder = document.createElement('div');
            placeholder.className = 'chord-placeholder flex flex-col justify-center items-center p-3 rounded-lg flex-shrink-0';
            placeholder.style.cssText = `
                min-width: 80px;
                min-height: 100px;
                border: 2px dashed ${section.color || '#9ca3af'};
                background-color: ${(section.color || '#9ca3af')}10;
                cursor: pointer;
            `;
            placeholder.innerHTML = `
                <svg class="w-6 h-6 mb-1" style="color: ${section.color || '#9ca3af'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                <span class="text-xs font-medium" style="color: ${section.color || '#9ca3af'}">Add</span>
            `;
            placeholder.onclick = () => {
                if (window.addChordToSection) {
                    window.addChordToSection(section.id);
                } else if (window.toggleQuickAddChord) {
                    window.toggleQuickAddChord();
                }
            };
            cardsArea.appendChild(placeholder);
        }
    }

    container.appendChild(cardsArea);

    // Initialize Sortable on the cards area for dragging cards within/out of section
    if (typeof Sortable !== 'undefined') {
        cardsArea.sortableInstance = new Sortable(cardsArea, {
            group: {
                name: 'progression-cards',  // MUST match other sortables for cross-container drag
                pull: true,
                put: function(to, from, dragEl) {
                    // Only accept chord cards, NOT section containers
                    return dragEl.classList.contains('chord-card-wrapper') &&
                           dragEl.hasAttribute('data-chord-index');
                }
            },
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            handle: '.drag-handle',
            // Exclude buttons from triggering drag - let them receive clicks
            filter: 'button, select, input, .play-btn, .delete-btn, .expand-btn, .info-tooltip-btn, .no-drag',
            preventOnFilter: false,
            draggable: '.chord-card-wrapper[data-chord-index]',
            swapThreshold: 0.65,
            // Touch-specific options
            delay: 150,
            delayOnTouchOnly: true,
            touchStartThreshold: 5,
            // Handle cards added FROM outside (ungrouped or another section) INTO this section
            onAdd: function(evt) {
                // Use delegated function for drag handling (not yet migrated)
                handleCardDragWithinSection(evt, evt.from.getAttribute('data-section-id'));
            },
            onEnd: function(evt) {
                // Only handle reorders within this section
                // Cross-container moves are handled by onAdd
                if (evt.from !== evt.to) {
                    return;
                }
                // Handle card movement within this section (use delegated function)
                handleCardDragWithinSection(evt, section.id);
            }
        });
    }

    return container;
}

/**
 * Create simplified card HTML
 * Returns HTML string for simplified chord card display
 */
function createSimplifiedCardHTML(chord, index, key) {
    const isNoChord = chord.type === 'No Chord';
    const roman = isNoChord ? '' : (chord.roman || harmonyAnalyzer.getRomanNumeral(chord, key));
    const colors = isNoChord ? { romanColor: 'text-gray-500', hexColor: '#6b7280' } : getFunctionColors(roman);

    // Check if this is an interval (not a chord)
    const isInterval = chord.selectionMode === 'interval';

    // Use simpleName for accurate chord symbol (e.g., "Gm9" for G Minor 9th)
    // Falls back to building symbol if simpleName not available
    let chordSymbol = isNoChord ? 'N.C.' : (chord.simpleName || chord.root);

    // If no simpleName, build it manually (backup)
    if (!chord.simpleName && !isInterval) {
        if (chord.type === 'Dominant 7th') chordSymbol += '7';
        else if (chord.type === 'Major 7th') chordSymbol += 'maj7';
        else if (chord.type === 'Minor 7th') chordSymbol += 'm7';
        else if (chord.type === 'Minor 9th') chordSymbol += 'm9';
        else if (chord.type === 'Major 9th') chordSymbol += 'maj9';
        else if (chord.type === 'Dominant 9th') chordSymbol += '9';
        else if (chord.type === 'Minor') chordSymbol += 'm';
        else if (chord.type === 'Diminished') chordSymbol += '°';
        else if (chord.type === 'Diminished 7th') chordSymbol += 'dim7';
        else if (chord.type === 'Half-Diminished 7th') chordSymbol += 'ø7';
        else if (chord.type === 'Augmented') chordSymbol += '+';
        else if (chord.type === 'Sus4') chordSymbol += 'sus4';
        else if (chord.type === 'Sus2') chordSymbol += 'sus2';
        else if (chord.type === 'Add9') chordSymbol += 'add9';
        else if (chord.type === 'Major 6th') chordSymbol += '6';
        else if (chord.type === 'Minor 6th') chordSymbol += 'm6';
    }

    // For intervals, prepare separate root and interval symbol for display
    const intervalSymbol = isInterval ? (chord.simpleName || chord.type) : null;

    let inversionText = '';
    if (chord.inversion === 1) { inversionText = '¹'; }
    else if (chord.inversion === 2) { inversionText = '²'; }
    else if (chord.inversion === 3) { inversionText = '³'; }

    // Parse beats into whole and fractional parts
    const totalBeats = chord.beats !== undefined ? chord.beats : 4;
    const wholeBeats = Math.floor(totalBeats);
    const fractionalBeats = totalBeats - wholeBeats;

    // Get function-based border color
    const functionBorderStyle = colors.hexColor ? `border-color: ${colors.hexColor};` : '';
    const functionTopBorderStyle = colors.hexColor ? `background: linear-gradient(to right, ${colors.hexColor}, ${colors.hexColor});` : '';

    // Generate duration dropdown options with emphasis
    // Whole beats: background color + bold, Half beats: bold only
    const durationOptions = [];
    for (let whole = 0; whole <= 16; whole++) {
        for (let frac = 0; frac < 1; frac += 0.25) {
            const value = whole + frac;
            if (value === 0) continue; // Skip 0 beats

            let label;
            if (frac === 0) {
                label = `${whole}`;
            } else if (frac === 0.25) {
                label = whole === 0 ? '¼' : `${whole}¼`;
            } else if (frac === 0.5) {
                label = whole === 0 ? '½' : `${whole}½`;
            } else if (frac === 0.75) {
                label = whole === 0 ? '¾' : `${whole}¾`;
            }

            // Styling: whole beats get background, half beats get bold
            let style = '';
            if (frac === 0) {
                style = 'background-color: #374151; font-weight: bold;'; // whole beats
            } else if (frac === 0.5) {
                style = 'font-weight: bold;'; // half beats
            }

            const selected = value === totalBeats ? 'selected' : '';
            durationOptions.push(`<option value="${value}" ${selected} style="${style}">${label}</option>`);
        }
    }

    return `
        <div class="relative border border-gray-300 rounded-xl p-1" style="width: 118px;">
            <div class="simplified-card bg-gradient-to-br from-gray-800 to-gray-900 border-2 rounded-xl overflow-hidden hover:shadow-xl transition-all shadow-lg relative w-full" style="min-height: 70px; ${functionBorderStyle}">
                <!-- Inversion indicator (top-left corner) -->
                ${inversionText ? `<div class="absolute top-2 left-1 text-xl text-red-400 font-bold">${inversionText}</div>` : ''}

                <!-- Info icon (bottom-left corner) for touchscreen devices -->
                <button class="info-tooltip-btn absolute bottom-1 left-1 w-4 h-4 bg-transparent border border-white hover:bg-white/20 rounded-full flex items-center justify-center text-white text-[10px] font-bold transition" title="Show chord info">
                    i
                </button>

                <!-- Main content: horizontal layout with chord info on left, buttons on right -->
                <div class="chord-info-view flex items-center justify-between h-full p-2 pt-2.5">
                    <!-- Left: Chord info (this is the drag handle) -->
                    <div class="flex flex-col items-center flex-1 drag-handle cursor-grab active:cursor-grabbing">
                        <!-- Chord/Interval Symbol -->
                        ${isInterval ? `
                            <div class="text-base font-bold text-white mb-0">${chord.root}</div>
                            <div class="text-[10px] text-gray-300 font-medium">${intervalSymbol}</div>
                        ` : `
                            <div class="text-base font-bold text-white mb-0.5">${chordSymbol}</div>
                        `}
                        <!-- Roman Numeral -->
                        <div class="text-xs ${colors.romanColor} font-bold">${roman}</div>
                        <!-- Position Label -->
                        <div class="text-[9px] text-gray-400 mt-0.5">Pos: ${index + 1}</div>
                    </div>

                    <!-- Right: Vertically stacked compact buttons (NOT in drag-handle) -->
                    <div class="flex flex-col gap-0.5 ml-1">
                        <button class="play-btn px-1 py-0.5 bg-white hover:bg-gray-100 rounded transition shadow-sm flex items-center justify-center" title="Play">
                            <svg class="w-2.5 h-2.5" fill="#1f2937" viewBox="0 0 20 20">
                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z"></path>
                            </svg>
                        </button>
                        <button class="delete-btn px-1 py-0.5 bg-red-600/80 hover:bg-red-600 text-white text-[8px] rounded transition" title="Delete">
                            ✕
                        </button>
                        <button class="expand-btn px-1 py-0.5 bg-gray-600/80 hover:bg-gray-600 text-white text-[8px] rounded transition" title="Expand">
                            ⋯
                        </button>
                    </div>
                </div>

                <!-- Notation view (hidden by default, light background) -->
                <div class="notation-view hidden flex items-center justify-center h-full p-2 bg-gray-50" style="min-height: 70px;">
                    <canvas class="simplified-notation-canvas"></canvas>
                </div>
            </div>

            <!-- Controls below card: duration dropdown + action buttons -->
            <div class="flex flex-col items-center gap-1 mt-1">
                <!-- Duration dropdown with label -->
                <div class="flex items-center justify-center gap-1 w-full">
                    <span class="text-[9px] text-gray-900 font-medium whitespace-nowrap">Beats:</span>
                    <select class="duration-select bg-gray-800 text-white border border-gray-600 rounded px-2 py-1 text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[50px]" title="Duration (beats)" data-card-index="${index}">
                        ${durationOptions.join('')}
                    </select>
                </div>

                <!-- Action buttons row -->
                <div class="flex items-center gap-1">
                    <!-- Notation toggle -->
                    <button class="notation-toggle-btn bg-indigo-600 hover:bg-indigo-700 rounded px-1.5 py-1 transition flex items-center justify-center" title="Toggle Notation View">
                        <svg class="music-note-icon w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"></path>
                        </svg>
                        <span class="abc-text hidden text-white text-[9px] font-bold">abc</span>
                    </button>
                    <!-- Suggestions -->
                    <button class="suggestions-lightbulb-btn bg-amber-500 hover:bg-amber-600 rounded px-1.5 py-1 transition flex items-center justify-center" title="Chord Suggestions">
                        <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>
                        </svg>
                    </button>
                    <!-- Compare -->
                    <button class="compare-btn bg-blue-500 hover:bg-blue-600 rounded px-1.5 py-1 transition flex items-center justify-center" title="Compare Options" data-card-index="${index}">
                        <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path>
                            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Helper: Get chord type options HTML for dropdown
 * Organized by chord groups for better UX
 */
function getChordTypeOptions(currentType) {
    // Organized by chord groups for better UX
    const chordGroups = [
        { label: 'Special', types: ['No Chord'] },
        { label: 'Triads', types: ['Major', 'Minor', 'Diminished', 'Augmented', 'Sus2', 'Sus4', 'Power Chord'] },
        { label: '7th Chords', types: ['Dominant 7th', 'Major 7th', 'Minor 7th', 'Minor-Major 7th', 'Diminished 7th', 'Half-Diminished 7th', 'Augmented 7th'] },
        { label: '6th Chords', types: ['Major 6th', 'Minor 6th'] },
        { label: '9th Chords', types: ['Add9', 'Major 9th', 'Dominant 9th', 'Minor 9th', '6/9'] },
        { label: 'Extended', types: ['Dominant 11th', 'Minor 11th', 'Dominant 13th'] },
        { label: 'Altered', types: ['7b5', '7#5', '7b9', '7#9'] }
    ];

    let html = '';
    chordGroups.forEach(group => {
        html += `<optgroup label="${group.label}">`;
        group.types.forEach(type => {
            // Check if this type exists in CHORD_DEFINITIONS
            if (CHORD_DEFINITIONS[type]) {
                html += `<option value="${type}" ${type === currentType ? 'selected' : ''}>${type}</option>`;
            }
        });
        html += '</optgroup>';
    });

    return html;
}

/**
 * Helper: Get root note options HTML
 * All 12 chromatic notes
 */
function getRootNoteOptions(currentRoot) {
    const roots = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

    // Normalize current root for comparison (handle enharmonics)
    const normalizedCurrent = currentRoot || 'C';

    return roots.map(root =>
        `<option value="${root}" ${root === normalizedCurrent ? 'selected' : ''}>${root}</option>`
    ).join('');
}

/**
 * HTML generator for detailed/expanded chord cards
 * @param {Object} chord - Chord data object
 * @param {number} index - Chord position in progression
 * @param {string} key - Current key signature
 * @returns {string} HTML string for detailed card
 */
export function createDetailedCardHTML(chord, index, key) {
    const isNoChord = chord.type === 'No Chord';
    const roman = isNoChord ? '' : (chord.roman || harmonyAnalyzer.getRomanNumeral(chord, key));
    const colors = isNoChord ? { romanColor: 'text-gray-500', hexColor: '#6b7280' } : getFunctionColors(roman);
    const isInterval = chord.selectionMode === 'interval';
    const chordSymbol = isNoChord ? 'N.C.' : (chord.simpleName || chord.name || `${chord.root}${chord.type}`);
    const intervalSymbol = isInterval ? (chord.simpleName || chord.type) : null;
    const functionLabel = isNoChord ? 'No Chord' : getChordFunction(roman);

    // Get scale notes for highlighting
    const scaleNotes = getScaleNotesForKey(key);

    // RH: Generate note checkboxes with scale indicators
    const rhNotes = chord.notes || [];
    const rhOctaveShift = chord.octaveShift || 0;
    const noteCheckboxes = rhNotes.map(note => {
        const isChecked = !(chord.omittedNotes || []).includes(note);
        const noteWithoutOctave = note.replace(/\d+$/, '');
        const isInScale = scaleNotes.includes(noteWithoutOctave);

        return `
            <label class="flex items-center gap-0.5 cursor-pointer text-gray-700 text-[11px] ${isInScale ? 'font-semibold' : ''}">
                <input type="checkbox" value="${note}" ${isChecked ? 'checked' : ''}
                    class="note-checkbox w-3 h-3 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500">
                <span class="${isInScale ? 'text-green-700' : ''}">${note}</span>
                ${isInScale ? '<span class="text-[9px] text-green-600">●</span>' : ''}
            </label>
        `;
    }).join('');

    // Generate inversion buttons (RH)
    const def = CHORD_DEFINITIONS ? CHORD_DEFINITIONS[chord.type] : null;
    const maxInversion = def ? def.intervals.length - 1 : 2;
    const currentInversion = chord.inversion || 0;
    const inversionButtons = [];
    for (let inv = 0; inv <= maxInversion; inv++) {
        const isActive = inv === currentInversion;
        const label = inv === 0 ? 'R' : inv.toString();
        inversionButtons.push(`
            <button class="inversion-btn w-8 px-0.5 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                isActive ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }" data-inversion="${inv}">${label}</button>
        `);
    }

    return `
        <div class="detailed-card bg-white border-2 border-blue-500 rounded-lg overflow-hidden shadow-lg">
            <!-- Compact Header - single row with all info, drag handle for reordering -->
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 py-1.5 drag-handle cursor-grab active:cursor-grabbing flex justify-between items-center">
                <div class="flex items-center gap-2 flex-wrap">
                    ${isInterval ? `
                        <span class="text-base font-bold">${chord.root}</span>
                        <span class="text-sm opacity-80">${intervalSymbol}</span>
                    ` : `
                        <span class="text-base font-bold">${chordSymbol}</span>
                    `}
                    <span class="text-sm opacity-90">${roman}</span>
                    ${functionLabel ? `<span class="text-xs opacity-70">${functionLabel}</span>` : ''}
                    <span class="text-xs opacity-70">#${index + 1}</span>
                </div>
                <div class="flex gap-0.5">
                    <button class="play-btn p-1 hover:bg-white hover:bg-opacity-20 rounded transition" title="Play (hold)">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z"/>
                        </svg>
                    </button>
                    <button class="suggestions-btn p-1 hover:bg-white hover:bg-opacity-20 rounded transition" title="Suggest">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>
                        </svg>
                    </button>
                    <button class="collapse-btn p-1 hover:bg-white hover:bg-opacity-20 rounded transition" title="Collapse">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                    <button class="delete-btn p-1 hover:bg-red-500 hover:bg-opacity-90 rounded transition" title="Delete">
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Controls -->
            <div class="p-1.5 space-y-1.5 text-xs">
                <!-- Root Note & Chord Type side by side -->
                <div class="flex gap-1">
                    <div class="flex-1">
                        <label class="block text-[11px] font-semibold text-gray-700 mb-0.5">Root</label>
                        <select class="root-select w-full px-1 py-0.5 bg-white border border-gray-300 rounded text-[11px]">
                            ${getRootNoteOptions(chord.root)}
                        </select>
                    </div>
                    <div class="flex-[2]">
                        <label class="block text-[11px] font-semibold text-gray-700 mb-0.5">Type</label>
                        <select class="type-select w-full px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[11px]">
                            ${getChordTypeOptions(chord.type)}
                        </select>
                    </div>
                </div>

                <!-- RH SECTION -->
                <div class="border-2 border-blue-200 rounded p-1 bg-blue-50">
                    <div class="text-[11px] font-bold text-blue-700 mb-0.5">RIGHT HAND (Treble)</div>

                    <!-- RH Octave Shift -->
                    <div class="mb-0.5">
                        <label class="block text-[10px] font-semibold text-gray-700 mb-0.5">Octave Shift</label>
                        <select class="rh-octave-select w-full px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[11px]">
                            <option value="-36" ${rhOctaveShift === -36 ? 'selected' : ''}>-3 octaves (-36)</option>
                            <option value="-24" ${rhOctaveShift === -24 ? 'selected' : ''}>-2 octaves (-24)</option>
                            <option value="-12" ${rhOctaveShift === -12 ? 'selected' : ''}>-1 octave (-12)</option>
                            <option value="0" ${rhOctaveShift === 0 ? 'selected' : ''}>0 (default)</option>
                            <option value="12" ${rhOctaveShift === 12 ? 'selected' : ''}>+1 octave (+12)</option>
                            <option value="24" ${rhOctaveShift === 24 ? 'selected' : ''}>+2 octaves (+24)</option>
                            <option value="36" ${rhOctaveShift === 36 ? 'selected' : ''}>+3 octaves (+36)</option>
                        </select>
                    </div>

                    <!-- RH Notes/Voicing -->
                    <div class="border border-gray-300 rounded p-1 bg-white mb-0.5">
                        <div class="flex items-center justify-between mb-0.5">
                            <label class="text-[10px] font-semibold text-indigo-600">Notes <span class="text-green-600">●</span> = in scale</label>
                            <div class="flex gap-0.5">
                                <button class="notes-all-btn px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-500 hover:bg-indigo-600 text-white rounded">All</button>
                                <button class="notes-none-btn px-1.5 py-0.5 text-[10px] font-semibold bg-gray-500 hover:bg-gray-600 text-white rounded">None</button>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-x-2 gap-y-0.5">
                            ${noteCheckboxes}
                        </div>
                    </div>

                    <!-- RH Inversion -->
                    <div class="chord-card-inversion-section bg-yellow-50 border border-yellow-300 rounded p-1">
                        <label class="block text-[10px] font-semibold text-gray-700 mb-0.5">🎹 Inversion</label>
                        <div class="flex gap-0.5 inversion-btn-group">
                            ${inversionButtons.join('')}
                        </div>
                    </div>
                </div>

                <!-- Musical Notation (Permanent) -->
                <div class="border-t border-gray-200 pt-1.5 mt-1.5">
                    <div class="text-[11px] font-semibold text-gray-700 mb-1">Musical Notation</div>
                    <canvas class="chord-notation-canvas mx-auto" style="display: block;"></canvas>
                </div>

                <!-- Footer Buttons -->
                <div class="flex gap-1 pt-1 border-t border-gray-200">
                    <button class="collapse-btn flex-1 px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-[11px] rounded transition">
                        Collapse
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Handle chord card drag-and-drop within or between sections
 * @param {Event} evt - Sortable event object
 * @param {string} originalSectionId - Original section ID (optional)
 */
function handleCardDragWithinSection(evt, originalSectionId) {
    const draggedItem = evt.item;
    const oldChordIndex = parseInt(draggedItem.getAttribute('data-chord-index'), 10);
    const fromContainer = evt.from;
    const toContainer = evt.to;

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    // Find the parent grid container
    let gridContainer = toContainer;
    while (gridContainer && !gridContainer.id?.includes('-cards-grid')) {
        gridContainer = gridContainer.parentElement;
    }
    if (!gridContainer) {
        // May be at the top-level flex container
        gridContainer = toContainer.closest('[id$="-cards-grid"]') ||
                       toContainer.closest('.flex.flex-wrap') ||
                       toContainer.closest('.section-filtered-cards');
    }

    // Get the visible chord order from the container
    const visibleChordWrappers = getAllChordWrappersInOrder(gridContainer || toContainer.parentElement);
    const visibleChordOrder = visibleChordWrappers.map(el => parseInt(el.getAttribute('data-chord-index'), 10));

    // Check if we're in a filtered view (Section View mode)
    // In filtered view, we only see some chords, not all
    const trainerState = getTrainerState();
    const totalChords = trainerState.progressionData.length;
    const isFilteredView = visibleChordOrder.length < totalChords;

    // Check if the card moved to a different section or out of a section
    // In Section View (filtered), the container doesn't have data-section-id,
    // but the cards have data-in-section attribute
    let toSectionId = toContainer.getAttribute('data-section-id');
    let fromSectionId = fromContainer.getAttribute('data-section-id');

    // If container doesn't have section ID, check the dragged item's section
    if (!fromSectionId) {
        fromSectionId = draggedItem.getAttribute('data-in-section');
    }
    // For destination, check if there's a section context from nearby cards
    if (!toSectionId && isFilteredView) {
        // In filtered view, all visible cards might be from the same section(s)
        // Get the section from the dragged item itself
        toSectionId = draggedItem.getAttribute('data-in-section');
    }

    // Update section membership if changed
    if (fromSectionId !== toSectionId) {
        saveStateBeforeChange();

        console.log('[handleCardDragWithinSection] === CROSS-SECTION DRAG ===');
        console.log('  fromSectionId:', fromSectionId);
        console.log('  toSectionId:', toSectionId);
        console.log('  oldChordIndex:', oldChordIndex);
        console.log('  sections BEFORE:', JSON.stringify(compositionState.sections.map(s => ({id: s.id, name: s.name, start: s.startIndex, count: s.chordCount}))));

        const trainerState = getTrainerState();
        const toSection = toSectionId && !toSectionId.startsWith('no-group')
            ? compositionState.getSection(toSectionId)
            : null;

        console.log('  toSection:', toSection ? {id: toSection.id, name: toSection.name, start: toSection.startIndex, count: toSection.chordCount} : null);

        // Calculate where the chord should be moved to
        let targetIndex = oldChordIndex; // Default: no movement
        let insertIndex = oldChordIndex;

        if (toSection) {
            // Find position within the new section based on where the card was dropped
            const sectionCards = toContainer.querySelectorAll('.chord-card-wrapper[data-chord-index]');
            const positionInSection = Array.from(sectionCards).indexOf(draggedItem);
            console.log('  positionInSection:', positionInSection, 'of', sectionCards.length, 'cards');

            // Calculate target position in the progression
            const sectionStart = toSection.startIndex;
            const sectionEnd = toSection.startIndex + toSection.chordCount - 1;

            if (positionInSection <= 0) {
                // Dropped at/before the start of the section
                targetIndex = sectionStart;
            } else if (positionInSection >= toSection.chordCount) {
                // Dropped at/after the end of the section
                targetIndex = sectionEnd + 1;
            } else {
                // Dropped in the middle
                targetIndex = sectionStart + positionInSection;
            }

            // Calculate actual insert index after removal
            insertIndex = targetIndex;
            if (oldChordIndex < targetIndex) {
                insertIndex--;
            }
            console.log('  targetIndex:', targetIndex, 'insertIndex:', insertIndex);
        }

        // Step 1: Move the chord data if needed
        if (oldChordIndex !== targetIndex && oldChordIndex !== insertIndex) {
            console.log('  Moving chord data from', oldChordIndex, 'to', insertIndex);
            const chord = trainerState.progressionData[oldChordIndex];
            const roman = trainerState.progressionRomans[oldChordIndex];

            // Remove from old position
            const newProgressionData = [...trainerState.progressionData];
            const newProgressionRomans = [...trainerState.progressionRomans];
            newProgressionData.splice(oldChordIndex, 1);
            newProgressionRomans.splice(oldChordIndex, 1);

            // Insert at new position
            newProgressionData.splice(insertIndex, 0, chord);
            newProgressionRomans.splice(insertIndex, 0, roman);

            // Step 2: Update section indices for the move (preserveMembership=false to update memberships)
            compositionState.updateSectionsAfterChordReorder(oldChordIndex, insertIndex, false);
            console.log('  sections AFTER updateSectionsAfterChordReorder:', JSON.stringify(compositionState.sections.map(s => ({id: s.id, name: s.name, start: s.startIndex, count: s.chordCount}))));

            // Update trainer state
            setProgressionData(newProgressionData);
            setProgressionRomans(newProgressionRomans);

            // Step 3: The chord is now at insertIndex and updateSectionsAfterChordReorder has updated memberships
            // But if the chord wasn't in a section before and we want it in one, or vice versa, handle that
            const chordNowInSection = compositionState.getSectionForChord(insertIndex);
            console.log('  chordNowInSection:', chordNowInSection ? {id: chordNowInSection.id, name: chordNowInSection.name} : null);

            if (toSection && (!chordNowInSection || chordNowInSection.id !== toSectionId)) {
                // Chord should be in toSection but isn't - add it
                console.log('  Adding chord to section', toSectionId);
                compositionState.addChordToSection(insertIndex, toSectionId);
            } else if (!toSection && chordNowInSection) {
                // Chord should be ungrouped but is in a section - remove it
                console.log('  Removing chord from section');
                compositionState.removeChordFromSection(insertIndex);
            }
        } else {
            console.log('  No data movement needed (oldChordIndex === targetIndex or insertIndex)');
            // No data movement needed, just update section membership
            if (fromSectionId && !fromSectionId.startsWith('no-group')) {
                console.log('  Removing from old section:', fromSectionId);
                compositionState.removeChordFromSection(oldChordIndex);
            }
            if (toSection) {
                console.log('  Adding to new section:', toSectionId);
                compositionState.addChordToSection(oldChordIndex, toSectionId);
            }
        }

        console.log('  sections FINAL:', JSON.stringify(compositionState.sections.map(s => ({id: s.id, name: s.name, start: s.startIndex, count: s.chordCount}))));

        // Re-render to reflect section membership changes
        renderProgressionDisplay('progression-visualization', false);
        renderProgressionDisplay('melody-progression-visualization', true);

        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        }

        return; // Exit - section membership change handled
    }

    // If dragging within the same section (or both ungrouped), reorder the actual chord data
    if (fromSectionId === toSectionId) {
        // Get the section - all sections are now real, including ungrouped ones
        const section = fromSectionId ? compositionState.getSection(toSectionId) : null;

        // Check if this is an ungrouped section
        const isUngroupedSection = section && section.type === 'ungrouped';

        if (section) {
            // Get the new order of chord indices within this section from the DOM
            const sectionCards = toContainer.querySelectorAll('.chord-card-wrapper[data-chord-index]');
            const newSectionOrder = Array.from(sectionCards).map(card =>
                parseInt(card.getAttribute('data-chord-index'), 10)
            );

            // Check if order actually changed within the section
            if (JSON.stringify(newSectionOrder) !== JSON.stringify(section.chordIndices)) {
                saveStateBeforeChange();

                const trainerState = getTrainerState();

                // Get the sorted positions that this section occupies
                const sectionPositions = [...section.chordIndices].sort((a, b) => a - b);

                // Build full new order array: for each position in progression,
                // determine which OLD index's data should go there
                const fullNewOrder = [];
                for (let i = 0; i < trainerState.progressionData.length; i++) {
                    const posInSection = sectionPositions.indexOf(i);
                    if (posInSection !== -1) {
                        // This position is in the section - get data from reordered index
                        fullNewOrder.push(newSectionOrder[posInSection]);
                    } else {
                        // Non-section position keeps its own data
                        fullNewOrder.push(i);
                    }
                }

                // Reorder the actual progression data
                const newProgressionData = fullNewOrder.map(oldIdx => trainerState.progressionData[oldIdx]);
                const newProgressionRomans = fullNewOrder.map(oldIdx => trainerState.progressionRomans[oldIdx]);

                // Section indices stay the same - they still occupy the same positions,
                // we just swapped the data at those positions
                // No need to update section.chordIndices

                // Update trainer state
                setProgressionData(newProgressionData);
                setProgressionRomans(newProgressionRomans);

                // Dispatch event for guided mode tutorials
                dispatchBuilderEvent('chordReordered', {
                    fromIndex: oldChordIndex,
                    toIndex: newSectionOrder.indexOf(oldChordIndex) !== -1 ?
                        sectionPositions[newSectionOrder.indexOf(oldChordIndex)] : oldChordIndex,
                    sectionId: toSectionId
                });
            }
        } else if (!fromSectionId || isUngroupedSection) {
            // Ungrouped chords being reordered within an ungrouped section
            // For ungrouped sections, we reorder the actual progression data
            const ungroupedCards = Array.from(toContainer.querySelectorAll('.chord-card-wrapper[data-chord-index]'));
            const newVisualOrder = ungroupedCards.map(card =>
                parseInt(card.getAttribute('data-chord-index'), 10)
            );

            // Get the indices that are in this section (sorted for position mapping)
            const indicesInSection = [...newVisualOrder].sort((a, b) => a - b);

            // Check if visual order differs from sorted order (i.e., user reordered)
            if (JSON.stringify(newVisualOrder) !== JSON.stringify(indicesInSection)) {
                saveStateBeforeChange();

                const trainerState = getTrainerState();
                const newProgressionData = [...trainerState.progressionData];
                const newProgressionRomans = [...trainerState.progressionRomans];

                // Simple approach: copy data from old positions to new positions
                // Visual position i should show data from newVisualOrder[i]
                // Put it at sorted position indicesInSection[i]
                for (let i = 0; i < indicesInSection.length; i++) {
                    const sourceIdx = newVisualOrder[i];
                    const targetIdx = indicesInSection[i];
                    newProgressionData[targetIdx] = trainerState.progressionData[sourceIdx];
                    newProgressionRomans[targetIdx] = trainerState.progressionRomans[sourceIdx];
                }

                setProgressionData(newProgressionData);
                setProgressionRomans(newProgressionRomans);

                // Dispatch event for guided mode tutorials
                const newPositionIdx = newVisualOrder.indexOf(oldChordIndex);
                const newTargetIdx = newPositionIdx !== -1 ? indicesInSection[newPositionIdx] : oldChordIndex;
                dispatchBuilderEvent('chordReordered', {
                    fromIndex: oldChordIndex,
                    toIndex: newTargetIdx,
                    sectionId: null
                });

                // Sync to composition state before re-render
                if (window.syncProgressionToMelodyComposer) {
                    window.syncProgressionToMelodyComposer();
                }

                window.dispatchEvent(new CustomEvent('showNotification', {
                    detail: { message: 'Cards reordered', type: 'success' }
                }));
            }
            // Fall through to re-render below
        }

        // Re-render to update visuals (for real sections)
        renderProgressionDisplay('melody-progression-visualization', true);

        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        }
        if (window.updateVoiceLeading) {
            window.updateVoiceLeading();
        }
        return; // Exit early - don't do global reorder
    }

    // In filtered view (Section View mode), don't do global reorder
    // Section reordering was already handled above
    if (isFilteredView) {
        // Re-render to update section visuals
        renderProgressionDisplay('melody-progression-visualization', true);

        // Update notation for filtered view
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        }
        // Update voice leading analysis after reorder
        if (window.updateVoiceLeading) {
            window.updateVoiceLeading();
        }
        return;
    }

    // In full view (Scroll mode), do global reorder if order changed
    const oldOrder = trainerState.progressionData.map((_, i) => i);

    if (JSON.stringify(visibleChordOrder) === JSON.stringify(oldOrder)) {
        // Still re-render to update section visuals
        renderProgressionDisplay('melody-progression-visualization', true);
        return;
    }

    // Save state for undo BEFORE making changes
    saveStateBeforeChange();

    // Reorder progression data to match new order
    const newProgressionData = visibleChordOrder.map(oldIdx => trainerState.progressionData[oldIdx]);
    const newProgressionRomans = visibleChordOrder.map(oldIdx => trainerState.progressionRomans[oldIdx]);

    // Update all section chord indices to reflect new positions
    compositionState.getSections().forEach(section => {
        const newIndices = section.chordIndices.map(oldIdx => visibleChordOrder.indexOf(oldIdx));
        compositionState.updateSection(section.id, { chordIndices: newIndices.filter(idx => idx >= 0) });
    });

    // Update trainer state (setProgressionData internally calls syncWithProgressionData)
    setProgressionData(newProgressionData);
    setProgressionRomans(newProgressionRomans);

    // Dispatch event for guided mode tutorials
    const newPosition = visibleChordOrder.indexOf(oldChordIndex);
    dispatchBuilderEvent('chordReordered', {
        fromIndex: oldChordIndex,
        toIndex: newPosition !== -1 ? newPosition : oldChordIndex,
        sectionId: null
    });

    // Re-render
    renderProgressionDisplay('melody-progression-visualization', true);

    // Update notation
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }

    // Update voice leading analysis after reorder
    if (window.updateVoiceLeading) {
        window.updateVoiceLeading();
    }
}

/**
 * Helper: Update tension curve if visible
 */
export function updateTensionCurveIfVisible() {
    // Check for either old or new tension container
    const tensionContainer = document.getElementById('tension-arc-container') || document.getElementById('tension-curve-container');
    if (tensionContainer && tensionContainer.style.display !== 'none') {
        const trainerState = getTrainerState();
        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        const sections = compositionState ? compositionState.getSections() : [];
        const panel = document.getElementById('progression-visualization')?.parentElement;
        if (panel) {
            // Remove old tension containers
            const oldTension = panel.querySelector('#tension-curve-container');
            if (oldTension) oldTension.remove();
            const oldTensionArc = panel.querySelector('#tension-arc-container');
            if (oldTensionArc) oldTensionArc.remove();

            // Re-render with enhanced tension arc visualization (Phase 3)
            renderEnhancedTensionCurve(panel, trainerState.progressionData, trainerState.currentKey || 'C', sections);

            // Reposition Quick Analysis Bar above tension curve
            const quickAnalysisBar = panel?.querySelector('#quick-analysis-bar-container');
            const tensionCurve = panel?.querySelector('#tension-arc-container') || panel?.querySelector('#tension-curve-container');
            if (quickAnalysisBar && tensionCurve) {
                quickAnalysisBar.remove();
                panel.insertBefore(quickAnalysisBar, tensionCurve);
            }
        }
    }
}

/**
 * Attach all event listeners to a chord card wrapper
 * This massive function wires up all interactive elements within a chord card:
 * - Play/expand/collapse/delete buttons
 * - Root/type/inversion selectors
 * - Note checkboxes
 * - Tooltips and hover behavior
 * - Duration selectors
 * - Multi-select click handlers
 */
export function attachCardEventListeners(wrapper, index) {
    const expandBtn = wrapper.querySelector('.expand-btn');
    const collapseBtns = wrapper.querySelectorAll('.collapse-btn'); // Get ALL collapse buttons
    const playBtn = wrapper.querySelector('.play-btn');
    const deleteBtn = wrapper.querySelector('.delete-btn');
    const rootSelect = wrapper.querySelector('.root-select');
    const typeSelect = wrapper.querySelector('.type-select');
    const inversionBtns = wrapper.querySelectorAll('.inversion-btn');
    const noteCheckboxes = wrapper.querySelectorAll('.note-checkbox');
    const notesAllBtn = wrapper.querySelector('.notes-all-btn');
    const notesNoneBtn = wrapper.querySelector('.notes-none-btn');
    const notationToggleBtn = wrapper.querySelector('.notation-toggle-btn');
    const suggestionsLightbulbBtn = wrapper.querySelector('.suggestions-lightbulb-btn');

    // Helper function to update inversion button highlighting in expanded card
    const updateInversionButtonHighlight = (selectedInversion) => {
        inversionBtns.forEach(btn => {
            const btnInversion = parseInt(btn.getAttribute('data-inversion'));
            if (btnInversion === selectedInversion) {
                btn.classList.add('bg-indigo-600', 'text-white');
                btn.classList.remove('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
            } else {
                btn.classList.remove('bg-indigo-600', 'text-white');
                btn.classList.add('bg-gray-200', 'text-gray-700', 'hover:bg-gray-300');
            }
        });
    };

    // Notation toggle button (simplified cards - in control bar above card)
    if (notationToggleBtn) {
        notationToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSimplifiedCardNotation(wrapper, index);
        });
    }

    // Suggestions lightbulb button (simplified cards - in control bar above card)
    if (suggestionsLightbulbBtn) {
        suggestionsLightbulbBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showProgressionChordSuggestions(index);
        });
    }

    // Compare button (Phase 2.1: A/B Comparison) - now opens unified hub at Compare intent
    const compareBtn = wrapper.querySelector('.compare-btn');
    if (compareBtn) {
        compareBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Open unified recommendation modal at Compare intent
            if (window.showUnifiedRecommendationModal) {
                window.showUnifiedRecommendationModal({
                    initialIntent: 'compare',
                    selectedChordIndex: index
                });
            } else if (window.showChordComparisonModal) {
                // Fallback to standalone modal
                window.showChordComparisonModal(index);
            }
        });
    }

    // Expand button
    if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            expandChordCard(index);
        });
    }

    // Collapse buttons (there may be multiple - header and footer)
    collapseBtns.forEach(collapseBtn => {
        collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            collapseChordCard(index);
        });
    });

    // Play button
    if (playBtn) {
        playBtn.addEventListener('mousedown', () => {
            // Select this card (persistent purple ring)
            selectChordCard(index);

            startProgressionChord(index);
            // Highlight corresponding tension curve point and chord card
            highlightTensionPoint(index);
            highlightChordCard(index);
        });
        playBtn.addEventListener('mouseup', () => {
            stopTrainerChord();
            // Remove playback highlighting but keep selection (purple ring persists)
            unhighlightAllTensionPoints();
            unhighlightAllChordCards();
        });
        playBtn.addEventListener('mouseleave', () => {
            stopTrainerChord();
            // Remove playback highlighting but keep selection (purple ring persists)
            unhighlightAllTensionPoints();
            unhighlightAllChordCards();
        });

        // Also handle touch events
        playBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            // Select this card (persistent purple ring)
            selectChordCard(index);

            startProgressionChord(index);
            highlightTensionPoint(index);
            highlightChordCard(index);
        }, { passive: false });

        playBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopTrainerChord();
            // Remove playback highlighting but keep selection (purple ring persists)
            unhighlightAllTensionPoints();
            unhighlightAllChordCards();
        }, { passive: false });
    }

    // Delete button
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            removeChordFromProgression(index);
        });
    }

    // Add click handler to simplified and detailed cards
    // Clicking anywhere on the card (except buttons) selects it WITHOUT playing
    // Supports multi-select with Ctrl/Cmd+click and Shift+click
    const clickableCards = wrapper.querySelectorAll('.simplified-card, .detailed-card');
    clickableCards.forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't interfere with button clicks, inputs, or selects - they have their own handlers
            if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;

            // Handle multi-select with Ctrl/Cmd+click or Shift+click
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;
            const isShift = e.shiftKey;

            if (isCtrlOrCmd) {
                // Ctrl/Cmd+click: Toggle this card in multi-selection
                handleMultiSelectToggle(index);
            } else if (isShift) {
                // Shift+click: Range select from last selected
                handleMultiSelectRange(index);
            } else {
                // Normal click: Clear multi-selection and select single card
                clearSelection();
                selectChordCard(index);
                // Also add to multi-select state for consistency
                selectSingle(index);
                // Update bass selection UI for single selection
                updateMultiSelectVisuals();
            }
            // No longer need to preserve transforms - flexbox/grid handles layout
        });
    });

    // Chord root select
    if (rootSelect) {
        rootSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            updateChordRoot(index, e.target.value);
        });
    }

    // Chord type select
    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            updateChordType(index, e.target.value);
        });
    }

    // Inversion buttons
    inversionBtns.forEach(btn => {
        let wasPressed = false;

        // Update inversion and start playing on mousedown (skip notation sync)
        btn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            wasPressed = true;
            const inversion = parseInt(btn.getAttribute('data-inversion'));

            // Update WITHOUT syncing notation (to prevent flash)
            updateChordInversion(index, inversion, true, false);

            // Update button highlighting immediately
            updateInversionButtonHighlight(inversion);

            // Start playing the chord with the new inversion
            startProgressionChord(index);
        });

        // Stop playing on mouseup and sync notation immediately
        btn.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            e.preventDefault();
            stopTrainerChord();

            // Update notation preserving treble notes
            updateChordAndRenderPreservingTrebleNotes(index);

            wasPressed = false;
        });

        // Also stop if mouse leaves button and sync if was pressed
        btn.addEventListener('mouseleave', (e) => {
            stopTrainerChord();

            // Sync notation if button was pressed
            if (wasPressed) {
                updateChordAndRenderPreservingTrebleNotes(index);
            }

            wasPressed = false;
        });
    });

    // Note checkboxes
    noteCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            const note = checkbox.value;
            toggleProgressionNote(index, note);
        });
    });

    // All/None buttons for notes
    if (notesAllBtn) {
        notesAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            // Get compositionState directly - the single source of truth
            const compositionState = getCompositionState();
            if (!compositionState) {
                return;
            }

            const chord = compositionState.getChord(index);
            if (chord) {
                // Update chord in compositionState
                compositionState.updateChordByIndex(index, {
                    omittedNotes: []
                });

                // Update checkboxes
                noteCheckboxes.forEach(cb => cb.checked = true);

                // Sync progressionData changes to notation display
                updateChordAndRenderPreservingTrebleNotes(index);

                // Play the chord
                startProgressionChord(index);
                setTimeout(() => stopTrainerChord(), 500);
            }
        });
    }

    if (notesNoneBtn) {
        notesNoneBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            // Get compositionState directly - the single source of truth
            const compositionState = getCompositionState();
            if (!compositionState) {
                return;
            }

            const chord = compositionState.getChord(index);
            if (chord && chord.notes) {
                // Update chord in compositionState
                compositionState.updateChordByIndex(index, {
                    omittedNotes: [...chord.notes]
                });

                // Update checkboxes
                noteCheckboxes.forEach(cb => cb.checked = false);

                // Sync progressionData changes to notation display
                updateChordAndRenderPreservingTrebleNotes(index);
            }
        });
    }

    // === COMPREHENSIVE CARD CONTROLS ===

    // RH Octave shift dropdown
    const rhOctaveSelect = wrapper.querySelector('.rh-octave-select');
    if (rhOctaveSelect) {
        rhOctaveSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            const shift = parseInt(e.target.value);
            updateRHOctaveShift(index, shift);
        });
    }

    // Suggestions button
    const suggestionsBtn = wrapper.querySelector('.suggestions-btn');
    if (suggestionsBtn) {
        suggestionsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Open the chord suggestions modal
            showProgressionChordSuggestions(index);
        });
    }

    // === DETAILED CARD TOOLTIP CLEANUP ===
    // When on an expanded/detailed card, hide tooltip when mouse leaves the card
    const detailedCard = wrapper.querySelector('.detailed-card');
    if (detailedCard) {
        const chordTooltipForDetailed = document.querySelector(`.chord-tooltip[data-chord-index="${index}"]`);
        if (chordTooltipForDetailed) {
            // Add mouseleave handler to hide tooltip when leaving expanded card
            wrapper.addEventListener('mouseleave', () => {
                chordTooltipForDetailed.classList.add('hidden');
            });
        }
    }

    // === SIMPLIFIED CARD INTERACTIVE TOOLTIP ===
    const simplifiedCard = wrapper.querySelector('.simplified-card');
    // Tooltip is now on body, find it by data-chord-index
    const chordTooltip = document.querySelector(`.chord-tooltip[data-chord-index="${index}"]`);
    const infoTooltipBtn = wrapper.querySelector('.info-tooltip-btn');
    const tooltipInversionBtns = chordTooltip ? chordTooltip.querySelectorAll('.tooltip-inversion-btn') : [];

    // Get the card wrapper (parent of simplified-card) for hover events
    const cardWrapper = simplifiedCard ? simplifiedCard.parentElement : null;

    if (simplifiedCard && chordTooltip && cardWrapper) {
        let tooltipTimeout = null;
        let isTooltipPinned = false;
        let hideTimeout = null;
        let inversionWasChanged = false; // Track if inversion was changed during this tooltip session
        let isOverCard = false;
        let isOverTooltip = false;
        const ensureTooltipVisible = () => {
            if (!isTooltipPinned && chordTooltip.classList.contains('hidden') && !tooltipTimeout) {
                tooltipTimeout = setTimeout(() => {
                    showTooltip();
                }, 120); // quick recovery show
            }
        };

        const scheduleHideTooltip = () => {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
            }
            hideTimeout = setTimeout(() => {
                const shouldHide = !isOverCard && !isOverTooltip;
                if (shouldHide) {
                    hideTooltip();
                }
            }, 350); // Grace period to allow moving between card and tooltip
        };

        const showTooltip = () => {
            // Check if progression tooltips are disabled
            if (window.progressionTooltipsEnabled === false) {
                return;
            }

            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            // Reset the change flag when tooltip opens
            inversionWasChanged = false;

            const rect = wrapper.getBoundingClientRect();
            const arrow = chordTooltip.querySelector('.tooltip-arrow');

            // Show tooltip to measure it
            chordTooltip.classList.remove('hidden');
            const tooltipRect = chordTooltip.getBoundingClientRect();

            // Center horizontally on the card
            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
            chordTooltip.style.left = `${left}px`;

            const margin = 8;
            const availableAbove = rect.top;
            const availableBelow = window.innerHeight - rect.bottom;
            // Prefer placing above; fall back to below only if there's clearly more space below
            const placeAbove = availableAbove >= tooltipRect.height + margin || availableAbove >= availableBelow;

            if (placeAbove) {
                chordTooltip.style.top = `${rect.top - tooltipRect.height - margin}px`;
                if (arrow) {
                    arrow.style.bottom = '-8px';
                    arrow.style.top = 'auto';
                    arrow.style.borderTop = '8px solid #6366f1';
                    arrow.style.borderBottom = 'none';
                }
            } else {
                chordTooltip.style.top = `${rect.bottom + margin}px`;
                if (arrow) {
                    arrow.style.top = '-8px';
                    arrow.style.bottom = 'auto';
                    arrow.style.borderBottom = '8px solid #6366f1';
                    arrow.style.borderTop = 'none';
                }
            }
        };

        const hideTooltip = () => {
            chordTooltip.classList.add('hidden');
            isTooltipPinned = false;

            // Check if notation view is currently showing - if so, don't rebuild the card
            // This prevents the notation view from being reset when mouse leaves card area
            const notationView = cardWrapper.querySelector('.notation-view');
            const isNotationShowing = notationView && !notationView.classList.contains('hidden');

            // Update the card UI after tooltip closes to show any inversion changes
            // But skip if notation view is showing to preserve it
            if (!isNotationShowing) {
                updateSingleCard(index);
            }
            updateTensionCurveIfVisible();

            // Sync notation ONLY if inversion was actually changed
            if (inversionWasChanged && window.updateChordAndRenderPreservingTrebleNotes) {
                window.updateChordAndRenderPreservingTrebleNotes(index);
            }

            // Reset the flag for next time
            inversionWasChanged = false;
        };

        // Show tooltip on hover (desktop) - only when over the actual card, not controls below
        // We don't use cardWrapper mouseenter for tooltip anymore - only use simplifiedCard mouseenter below

        // When mouse leaves card, only cancel the pending show timeout
        cardWrapper.addEventListener('mouseleave', (e) => {
            isOverCard = false;
            if (tooltipTimeout) {
                clearTimeout(tooltipTimeout);
                tooltipTimeout = null;
            }
            // Start delayed hide if user doesn't enter tooltip
            scheduleHideTooltip();
        });

        // Redundant listener on the card itself to improve reliability
        simplifiedCard.addEventListener('mouseenter', () => {
            isOverCard = true;
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            if (!isTooltipPinned && !tooltipTimeout) {
                tooltipTimeout = setTimeout(() => {
                    showTooltip();
                }, 150);
            }
        });

        // If cursor moves on the card and tooltip failed to appear, recover quickly
        simplifiedCard.addEventListener('mousemove', () => {
            isOverCard = true;
            ensureTooltipVisible();
        });

        // Hide tooltip when mouse leaves the simplified card itself (not just the wrapper)
        simplifiedCard.addEventListener('mouseleave', () => {
            isOverCard = false;
            if (tooltipTimeout) {
                clearTimeout(tooltipTimeout);
                tooltipTimeout = null;
            }
            // Schedule hide - tooltip will stay open if user moves to it
            scheduleHideTooltip();
        });

        // Keep tooltip open when mouse enters it
        chordTooltip.addEventListener('mouseenter', () => {
            isOverTooltip = true;
            isTooltipPinned = true;
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
        });

        // ONLY hide when mouse leaves the tooltip itself
        chordTooltip.addEventListener('mouseleave', () => {
            isOverTooltip = false;
            scheduleHideTooltip();
        });

        // Hide tooltip when hovering over duration controls
        const durationControls = wrapper.querySelector('.flex.items-center.justify-center.gap-1.mt-1');
        if (durationControls) {
            durationControls.addEventListener('mouseenter', () => {
                if (tooltipTimeout) {
                    clearTimeout(tooltipTimeout);
                    tooltipTimeout = null;
                }
                if (!isTooltipPinned) {
                    chordTooltip.classList.add('hidden');
                }
            });
        }

        // Close button click - close tooltip
        const tooltipCloseBtn = chordTooltip.querySelector('.tooltip-close-btn');
        if (tooltipCloseBtn) {
            tooltipCloseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                chordTooltip.classList.add('hidden');
                isTooltipPinned = false;
                // Update the card UI after closing to show any inversion changes
                updateSingleCard(index);
                updateTensionCurveIfVisible();

                // Sync notation if inversion was changed
                if (inversionWasChanged && window.updateChordAndRenderPreservingTrebleNotes) {
                    window.updateChordAndRenderPreservingTrebleNotes(index);
                }

                // Reset the flag
                inversionWasChanged = false;
            });
        }

        // Info button click - toggle tooltip (for touchscreens)
        if (infoTooltipBtn) {
            infoTooltipBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = !chordTooltip.classList.contains('hidden');
                if (isVisible) {
                    chordTooltip.classList.add('hidden');
                    isTooltipPinned = false;
                    // Update the card UI after closing to show any inversion changes
                    updateSingleCard(index);
                    updateTensionCurveIfVisible();

                    // Sync notation if inversion was changed
                    if (inversionWasChanged && window.updateChordAndRenderPreservingTrebleNotes) {
                        window.updateChordAndRenderPreservingTrebleNotes(index);
                    }

                    // Reset the flag
                    inversionWasChanged = false;
                } else {
                    // Show tooltip using the same positioning logic
                    showTooltip();
                    isTooltipPinned = true;
                    // Reset the flag when opening
                    inversionWasChanged = false;
                }
            });
        }

        // Function to update inversion button highlighting
        const updateInversionButtonHighlight = (selectedInversion) => {
            tooltipInversionBtns.forEach(btn => {
                const btnInversion = parseInt(btn.getAttribute('data-inversion'));
                if (btnInversion === selectedInversion) {
                    btn.classList.add('bg-indigo-600', 'text-white');
                    btn.classList.remove('bg-gray-700', 'text-gray-300', 'hover:bg-gray-600');
                } else {
                    btn.classList.remove('bg-indigo-600', 'text-white');
                    btn.classList.add('bg-gray-700', 'text-gray-300', 'hover:bg-gray-600');
                }
            });
        };

        // Initialize button highlighting with current inversion
        const trainerState = getTrainerState();
        const chord = trainerState.progressionData[index];
        if (chord && tooltipInversionBtns.length > 0) {
            updateInversionButtonHighlight(chord.inversion || 0);
        }

        // Tooltip inversion buttons - hold to play
        tooltipInversionBtns.forEach(btn => {
            // Track if button was actually pressed (not just hovered)
            let wasPressed = false;

            // Mouseenter - prevent any browser auto-scroll behavior
            btn.addEventListener('mouseenter', (e) => {
                e.preventDefault();
                // Prevent button from receiving focus which can trigger scroll
                if (document.activeElement === btn) {
                    btn.blur();
                }
            });

            // Mousedown - start playing chord WITHOUT syncing notation (to prevent flicker)
            btn.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault(); // Prevent any browser default behavior that might cause scrolling
                wasPressed = true;
                const inversion = parseInt(btn.getAttribute('data-inversion'));

                // Update the chord inversion - skip UI update AND notation sync to prevent flicker
                updateChordInversion(index, inversion, false, false);

                // Mark that inversion was changed (so we sync notation when tooltip closes)
                inversionWasChanged = true;

                // Update button highlighting
                updateInversionButtonHighlight(inversion);

                // Start playing the chord with new inversion
                if (window.startProgressionChord) {
                    window.startProgressionChord(index);
                }
            });

            // Mouseup - stop playing chord and sync notation immediately
            btn.addEventListener('mouseup', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (window.stopTrainerChord) {
                    window.stopTrainerChord();
                }

                // Sync notation immediately without rebuilding the card/tooltip
                if (inversionWasChanged && window.updateChordAndRenderPreservingTrebleNotes) {
                    window.updateChordAndRenderPreservingTrebleNotes(index, { skipCardRefresh: true });
                    inversionWasChanged = false;
                }

                wasPressed = false;
            });

            // Mouseleave - stop playing if user drags off button and sync notation
            btn.addEventListener('mouseleave', (e) => {
                e.stopPropagation(); // Don't let this bubble to tooltip's mouseleave
                if (window.stopTrainerChord) {
                    window.stopTrainerChord();
                }

                // Sync notation if button was pressed and user dragged off
                if (wasPressed && inversionWasChanged && window.updateChordAndRenderPreservingTrebleNotes) {
                    window.updateChordAndRenderPreservingTrebleNotes(index, { skipCardRefresh: true });
                    inversionWasChanged = false;
                }

                wasPressed = false;
            });

            // Touch events for mobile
            btn.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                const inversion = parseInt(btn.getAttribute('data-inversion'));

                // Update the chord inversion (but don't update UI to prevent tooltip closing)
                updateChordInversion(index, inversion, false);

                // Update button highlighting
                updateInversionButtonHighlight(inversion);

                // Start playing the chord with new inversion
                if (window.startProgressionChord) {
                    window.startProgressionChord(index);
                }

                // Refresh notation immediately alongside playback
                if (window.refreshNotationFromProgression) {
                    requestAnimationFrame(() => {
                        window.refreshNotationFromProgression();
                    });
                }
            }, { passive: true });

            btn.addEventListener('touchend', (e) => {
                e.stopPropagation();
                if (window.stopTrainerChord) {
                    window.stopTrainerChord();
                }
            }, { passive: true });

            // Prevent click event from bubbling
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });

        // Close tooltip when clicking outside
        document.addEventListener('click', (e) => {
            if (isTooltipPinned && !cardWrapper.contains(e.target) && !chordTooltip.contains(e.target)) {
                chordTooltip.classList.add('hidden');
                isTooltipPinned = false;
                // Update the card UI after closing to show any inversion changes
                updateSingleCard(index);
                updateTensionCurveIfVisible();

                // Also update the Composition Studio's notation
                if (window.updateChordAndRenderPreservingTrebleNotes) {
                    window.updateChordAndRenderPreservingTrebleNotes(index);
                }
            }
        });
    }

    // === DURATION SELECTOR (single dropdown) ===
    const durationSelect = wrapper.querySelector('.duration-select');

    if (durationSelect) {
        durationSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            // New single dropdown - value is the total beats (e.g., "4", "2.5", "0.25")
            const newBeats = parseFloat(e.target.value);
            if (!isNaN(newBeats) && newBeats > 0) {
                updateChordDuration(index, e.target, newBeats);
            }
        });
    }

    // Legacy support for old two-dropdown system (detailed cards may still use it)
    const durationWholeSelect = wrapper.querySelector('.duration-whole-select');
    const durationFracSelect = wrapper.querySelector('.duration-frac-select');

    if (durationWholeSelect) {
        durationWholeSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            updateChordDuration(index, e.target);
        });
    }

    if (durationFracSelect) {
        durationFracSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            updateChordDuration(index, e.target);
        });
    }
}

/**
 * Re-render the active progression display (whichever tab is currently visible)
 * This is a helper function for operations that need to refresh the UI after state changes
 */
export function rerenderActiveProgressionDisplay() {
    const currentTab = getCurrentTab();

    if (currentTab === 'progression-builder' || currentTab === 'trainer') {
        renderProgressionDisplay('progression-visualization', false);
    } else if (currentTab === 'melody-composer' || currentTab === 'melody') {
        renderProgressionDisplay('melody-progression-visualization', false);
    } else if (currentTab === 'chord-builder' || currentTab === 'builder') {
        renderProgressionDisplay('builder-progression-visualization', false);
    }
}

/**
 * Hide all chord tooltips
 * Call this when chords are removed to prevent orphaned tooltips
 */
export function hideAllChordTooltips() {
    const tooltips = document.querySelectorAll('.chord-tooltip');
    tooltips.forEach(tooltip => {
        tooltip.classList.add('hidden');
    });
}

// Main rendering functions (already exported above with 'export' keyword)
// - renderProgressionDisplay
// - renderProgressionDisplayForBuilder
// - renderProgressionControls
// - renderChordStaffNotation
// - toggleAllStaffNotation
// - createCompactViewModeToggle
// - rerenderActiveProgressionDisplay

// Internal functions that may need to be exposed to window for HTML event handlers
// will be handled in the main progressionBuilder.js file
