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

import { CHORD_DEFINITIONS, SHARP_NOTES, FLAT_NOTES } from '../../../data/music-data.js';
import { HarmonyAnalyzer, COMMON_PROGRESSIONS } from '../../analysis/harmonyAnalyzer.js';
import {
    getTrainerState,
    getCurrentKey,
    getProgressionData,
    setCurrentKey
} from '../../state/trainerState.js';
import { getNotationPreference } from '../../state/globalState.js';
import {
    getKeyBasedEnharmonic,
    setKeyDropdownValue,
    transposeProgression,
    updateRomanNumerals,
    transposeTreble,
    transposeTrebleWithModeAdjust,
    loadProgression,
    setProgressionViewMode
} from './ProgressionController.js';

// TEMPORARY: Import working implementation from old module
// TODO: Migrate these functions' implementations (3000+ lines total)
import {
    renderProgressionDisplay as renderProgressionDisplayOld,
    renderProgressionDisplayForBuilder as renderProgressionDisplayForBuilderOld,
    renderChordStaffNotation as renderChordStaffNotationOld,
    toggleAllStaffNotation as toggleAllStaffNotationOld
} from '../progressionBuilder.js';

// TODO: Import chord generation functions when ChordGeneration module is created
// import { getInvertedChordNotes, getChordNotes, getLHNotes } from './ChordGeneration.js';

// TODO: Import helper functions when HelperFunctions module is created
// import {
//     getScaleNotesForKey,
//     getRootNoteOptions,
//     getChordTypeOptions,
//     noteToMidi
// } from './HelperFunctions.js';

// ============================================================================
// MODULE-LEVEL STATE
// ============================================================================

/**
 * Map to track staff notation visibility state per chord index
 * Used to persist notation view when cards are re-rendered
 */
const staffNotationStates = new Map();

/**
 * Set of expanded chord indices
 * Tracks which cards are showing detailed view vs simplified view
 */
const expandedChords = new Set();

/**
 * One-time flag to force flat layout (ignore sections)
 * Used to avoid stacking issues when inserting chords in heavily-sectioned progressions
 */
let forceFlatLayoutOnce = false;

/**
 * Current progression view mode
 * Options: 'default' | 'scroll' | 'section'
 */
let progressionViewMode = 'default';

/**
 * Selected section IDs (for section view mode)
 */
const selectedSectionIds = new Set();

/**
 * User's preferred section order (for drag-drop reordering)
 */
let userSectionOrder = [];

/**
 * Pattern categories for enhanced pattern highlighting
 */
const PATTERN_CATEGORIES = {
    progressions: {
        label: 'Progressions',
        icon: '🎵',
        color: '#a855f7',
        priority: 1
    },
    cadences: {
        label: 'Cadences',
        icon: '🎼',
        color: '#3b82f6',
        priority: 2
    },
    sequences: {
        label: 'Sequences',
        icon: '🔄',
        color: '#22c55e',
        priority: 3
    },
    modal: {
        label: 'Modal',
        icon: '🎹',
        color: '#f59e0b',
        priority: 4
    },
    borrowed: {
        label: 'Borrowed',
        icon: '↔️',
        color: '#ec4899',
        priority: 5
    }
};

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

    const isScrollView = progressionViewMode === 'scroll';
    const isSectionView = progressionViewMode === 'section';

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
            renderProgressionDisplay('melody-progression-visualization', false);
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

    const isScrollView = progressionViewMode === 'scroll';
    const isSectionView = progressionViewMode === 'section';

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
            renderProgressionDisplay('melody-progression-visualization', false);
            // Update notation for section view (call via window - old module function)
            if (window.updateNotationForSelectedSections) {
                window.updateNotationForSelectedSections();
            }
            // Update toggle button styles
            container.querySelectorAll('.compact-view-btn').forEach(b => {
                const isActive = b.getAttribute('data-mode') === progressionViewMode;
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
function calculateCanvasDimensions(key, notes) {
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
function renderChordNotation(chord, key, canvas) {
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
 * Render chord staff notation with provided chord data (exported)
 * Wrapper function for external use (Composition Studio)
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} chordData - Chord data object
 * @param {string} key - Current key
 */
export function renderChordStaffNotation(canvas, chordData, key) {
    // TEMPORARY: Call old module implementation
    // TODO: Migrate implementation from progressionBuilder.js lines 2519-2711
    return renderChordStaffNotationOld(canvas, chordData, key);
}

/**
 * Toggle staff notation visibility for all chord cards (exported)
 * @param {boolean} showNotation - Whether to show notation
 */
export function toggleAllStaffNotation(showNotation) {
    // TEMPORARY: Call old module implementation
    // TODO: Migrate implementation from progressionBuilder.js
    return toggleAllStaffNotationOld(showNotation);
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
    // TODO: Implementation from lines 2726-2966
    // This is a complex function that:
    // 1. Analyzes progression for patterns
    // 2. Creates collapsible master container
    // 3. Organizes patterns by category
    // 4. Creates interactive badges
}

/**
 * Create enhanced pattern badge element
 * @param {Object} pattern - Pattern data
 * @param {string} category - Pattern category
 * @returns {HTMLElement} Badge element
 */
function createEnhancedPatternBadge(pattern, category) {
    // TODO: Implementation from lines 2974-3052
}

/**
 * Highlight chords at specific positions
 * @param {Array} positions - Array of chord positions
 */
function highlightPatternChordsByPositions(positions) {
    // TODO: Implementation from lines 3058-3091
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
 * @param {number} index - Chord index
 */
function updateSingleCard(index) {
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    const key = trainerState.currentKey || 'C';

    if (!chord) return;

    // Update cards in all containers (Progression Builder, Melody Composer, Builder)
    const wrappers = document.querySelectorAll(`.chord-card-wrapper[data-chord-index="${index}"]`);
    if (wrappers.length === 0) return;

    wrappers.forEach(wrapper => {
        updateSingleCardWrapper(wrapper, chord, index, key);
    });
}

/**
 * Update a single card wrapper with new chord data
 * @param {HTMLElement} wrapper - Card wrapper element
 * @param {Object} chord - Chord data
 * @param {number} index - Chord index
 * @param {string} key - Current key
 */
function updateSingleCardWrapper(wrapper, chord, index, key) {
    // TODO: Implementation from lines 7704-7759
}

// ============================================================================
// MAIN RENDERING FUNCTIONS
// ============================================================================

/**
 * Render progression display (main exported function)
 * @param {string} containerId - Container ID
 * @param {boolean} syncBothTabs - Whether to sync both tabs
 */
export function renderProgressionDisplay(containerId = 'progression-visualization', syncBothTabs = true) {
    // TEMPORARY: Call old module implementation (508 lines + 3000+ lines of dependencies)
    // TODO: Migrate complete implementation from progressionBuilder.js lines 10093-10600
    // along with all helper functions (captureStaffNotationStates, renderPatternHighlights,
    // createViewModeToggle, renderSectionViewMode, renderScrollViewMode, renderSectionAwareCards,
    // renderFlatCards, clearPatternHighlights, renderEnhancedTensionCurve, etc.)
    return renderProgressionDisplayOld(containerId, syncBothTabs);
}

/**
 * Render progression display for Builder tab (exported)
 * @param {HTMLElement} container - Container element
 * @param {Array} progressionData - Chord progression data
 * @param {string} key - Current key
 * @param {Object} options - Rendering options
 */
export function renderProgressionDisplayForBuilder(container, progressionData, key, options = {}) {
    // TEMPORARY: Call old module implementation
    // TODO: Migrate implementation from progressionBuilder.js
    return renderProgressionDisplayForBuilderOld(container, progressionData, key, options);
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
    console.log(`Loaded random progression: ${selectedProgName} in ${selectedKey}`);

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

        // TODO: Import showKeyChangeDialog when modals module is extracted
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
                // TODO: Import renderProgressionCards when extracted
                if (window.renderProgressionCards) {
                    window.renderProgressionCards(document.getElementById('chord-cards-container'), false);
                }
                // TODO: Import renderProgressionDisplay when extracted
                if (window.renderProgressionDisplay) {
                    window.renderProgressionDisplay('melody-progression-visualization', false);
                }
                if (window.updateKeyboardLabels) window.updateKeyboardLabels();
                if (window.updateKeySignatureDisplay) window.updateKeySignatureDisplay(newKey);
                // TODO: Import updateCurrentKeyDisplay when extracted
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
    // TODO: Import updateCurrentKeyDisplay when extracted
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
        // Render progression display
        // TODO: Import renderProgressionDisplay when extracted
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('melody-progression-visualization', true);
            window.renderProgressionDisplay('melody-progression-visualization', false);
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
    // TODO: Implementation from lines 4133-4341
}

/**
 * Create section picker bar
 * @param {Array} sections - Array of section objects
 * @returns {HTMLElement} Section picker bar
 */
function createSectionPickerBar(sections) {
    // TODO: Implementation from lines 3774-3833
}

/**
 * Create section chip element
 * @param {Object} section - Section object
 * @param {boolean} isSelected - Whether selected
 * @param {Function} onClick - Click handler
 * @returns {HTMLElement} Section chip
 */
function createSectionChip(section, isSelected, onClick) {
    // TODO: Implementation from lines 3726-3766
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
    // TODO: Implementation from lines 4667-4686
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
    // TODO: Implementation from lines 4873-4972
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
    // TODO: Implementation from lines 3459-3529
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
 * Build section chips including ungrouped chords as pseudo-sections
 * Groups consecutive ungrouped chords together and creates pseudo-sections for them
 * @param {Array} sections - Array of section objects
 * @returns {Array} Combined array of real sections and pseudo-sections
 */
function buildSectionChipsWithUngrouped(sections) {
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
        // Check if this index is consecutive OR if there's a section in between
        const prevIdx = ungroupedIndices[i - 1];
        const currIdx = ungroupedIndices[i];

        // Check if there's a section starting between prevIdx and currIdx
        const sectionInBetween = sections.some(s => {
            const sectionStart = Math.min(...(s.chordIndices || [Infinity]));
            return sectionStart > prevIdx && sectionStart < currIdx;
        });

        if (currIdx === prevIdx + 1 && !sectionInBetween) {
            // Consecutive ungrouped chord, add to current group
            currentGroup.push(currIdx);
        } else {
            // Gap or section in between - start new group
            ungroupedGroups.push([...currentGroup]);
            currentGroup = [currIdx];
        }
    }
    // Don't forget the last group
    if (currentGroup.length > 0) {
        ungroupedGroups.push(currentGroup);
    }

    // Create pseudo-section objects for each ungrouped group
    const pseudoSections = ungroupedGroups.map((indices, groupIndex) => ({
        id: `no-group-${groupIndex + 1}`,
        label: `No Group ${groupIndex + 1}`,
        color: '#9ca3af', // Gray color for ungrouped
        chordIndices: indices,
        isPseudoSection: true
    }));

    // Combine real sections and pseudo-sections
    const allSections = [...sections, ...pseudoSections];

    // If user has set a preferred order, use it
    if (userSectionOrder && userSectionOrder.length > 0) {
        // Sort by user's preferred order
        allSections.sort((a, b) => {
            const aIndex = userSectionOrder.indexOf(a.id);
            const bIndex = userSectionOrder.indexOf(b.id);
            // Items not in userSectionOrder go to the end
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        });
    } else {
        // Default: Sort all sections (real and pseudo) by their first chord index position
        // This ensures appended chords appear at the end, not the beginning
        allSections.sort((a, b) => {
            const aMin = Math.min(...(a.chordIndices || [Infinity]));
            const bMin = Math.min(...(b.chordIndices || [Infinity]));
            return aMin - bMin;
        });
    }

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
function highlightTensionPoint(index) {
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
function highlightTensionPointForSelection(index) {
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
function unhighlightAllTensionPoints() {
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
function toggleSimplifiedCardNotation(wrapper, index) {
    const card = wrapper.querySelector('.simplified-card');
    const chordInfoView = wrapper.querySelector('.chord-info-view');
    const notationView = wrapper.querySelector('.notation-view');
    const canvas = wrapper.querySelector('.simplified-notation-canvas');
    const toggleBtn = wrapper.querySelector('.notation-toggle-btn');
    const musicNoteIcon = toggleBtn?.querySelector('.music-note-icon');
    const abcText = toggleBtn?.querySelector('.abc-text');

    if (!card || !chordInfoView || !notationView || !canvas || !toggleBtn) return;

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
function updateCardShifts() {
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
                const isExpanded = expandedChords.has(chordIndex);
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

    // Track which sections have already been rendered (to avoid duplicates)
    const renderedSections = new Set();

    // Render cards in positional order - maintaining original chord sequence
    // Ungrouped chords stay in their positions, sections are rendered when we hit their first chord
    let i = 0;
    while (i < progressionData.length) {
        const section = chordToSection.get(i);

        if (section && !renderedSections.has(section.id)) {
            // This chord is in a section we haven't rendered yet - render entire section
            // Call createUnifiedSectionContainer via window (it's in the old module)
            const sectionContainer = createUnifiedSectionContainer(section, progressionData, key);
            if (sectionContainer) {
                sectionContainer.style.scrollSnapAlign = 'start';
                sectionContainer.style.flexShrink = '0';
                gridContainer.appendChild(sectionContainer);
            }
            renderedSections.add(section.id);

            // Skip all cards in this section (by finding max index in section)
            const maxIndex = Math.max(...section.chordIndices);
            i = maxIndex + 1;
        } else if (section && renderedSections.has(section.id)) {
            // This chord is in a section we already rendered (non-contiguous indices)
            // Skip it - it was already rendered with its section
            i++;
        } else {
            // Ungrouped card - render directly in grid at its position
            const chord = progressionData[i];
            // Call createChordCardWrapper (now migrated to this module)
            const wrapper = createChordCardWrapper(chord, i, key);
            if (wrapper) {
                wrapper.style.scrollSnapAlign = 'start';
                wrapper.style.flexShrink = '0';
                // Mark as ungrouped for drag/drop handling
                wrapper.setAttribute('data-ungrouped', 'true');
                gridContainer.appendChild(wrapper);
            }
            i++;
        }
    }
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
function createChordCardWrapper(chord, index, key) {
    const wrapper = document.createElement('div');
    // Use class for grid layout - Add no-animation class to prevent all transitions/animations
    const isExpanded = expandedChords.has(index);
    wrapper.className = isExpanded
        ? 'chord-card-wrapper expanded-card-wrapper no-animation'
        : 'chord-card-wrapper no-animation'; // All cards take 1 grid cell
    wrapper.setAttribute('data-chord-index', index);

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

    // Attach event listeners after rendering (use delegated function)
    if (window.attachCardEventListenersOld) {
        window.attachCardEventListenersOld(wrapper, index);
    }

    return wrapper;
}

/**
 * Create simplified card structure with control bar above
 * @param {Object} chord - Chord data
 * @param {number} index - Chord index
 * @param {string} key - Current key
 * @returns {DocumentFragment} Fragment containing control bar and card
 */
function createSimplifiedCardStructure(chord, index, key) {
    const fragment = document.createDocumentFragment();

    // Create control bar
    const controlBar = document.createElement('div');
    controlBar.className = 'flex items-center justify-center gap-2 mb-1';
    controlBar.innerHTML = `
        <!-- Music Note/ABC Toggle -->
        <button class="notation-toggle-btn bg-indigo-600 hover:bg-indigo-700 border-2 border-indigo-400 rounded px-2 py-1.5 transition flex items-center justify-center shadow-md" title="Toggle Notation View">
            <svg class="music-note-icon w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z"></path>
            </svg>
            <span class="abc-text hidden text-white text-xs font-bold">abc</span>
        </button>
        <!-- Lightbulb for Suggestions -->
        <button class="suggestions-lightbulb-btn bg-amber-500 hover:bg-amber-600 border-2 border-amber-400 rounded px-2 py-1.5 transition flex items-center justify-center shadow-md" title="Chord Suggestions">
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>
            </svg>
        </button>
        <!-- Compare Options Button (Phase 2.1) -->
        <button class="compare-btn bg-blue-500 hover:bg-blue-600 border-2 border-blue-400 rounded px-2 py-1.5 transition flex items-center justify-center shadow-md" title="Compare Options - Hear the Difference" data-card-index="${index}">
            <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"></path>
                <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"></path>
            </svg>
        </button>
    `;

    // Create card element - use local function for simplified card HTML (now migrated)
    const cardContainer = document.createElement('div');
    cardContainer.innerHTML = createSimplifiedCardHTML(chord, index, key);

    // Get the entire card structure (wrapper with card + duration controls)
    const cardStructure = cardContainer.firstElementChild; // This is the <div class="relative inline-block">

    // Find the simplified-card inside the structure for tooltip insertion
    const cardElement = cardStructure ? cardStructure.querySelector('.simplified-card') : null;

    if (cardElement) {
        // Create tooltip (appended to body for z-index escape)
        createTooltipElement(chord, index, key);
    }

    fragment.appendChild(controlBar);
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
    section.chordIndices.forEach(chordIdx => {
        if (chordIdx < progressionData.length) {
            const chord = progressionData[chordIdx];
            const wrapper = createChordCardWrapper(chord, chordIdx, key); // Already migrated - use locally
            wrapper.setAttribute('data-in-section', section.id);
            cardsArea.appendChild(wrapper);
        }
    });

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
                if (window.handleCardDragWithinSectionOld) {
                    window.handleCardDragWithinSectionOld(evt, evt.from.getAttribute('data-section-id'));
                }
            },
            onEnd: function(evt) {
                // Only handle reorders within this section
                // Cross-container moves are handled by onAdd
                if (evt.from !== evt.to) {
                    return;
                }
                // Handle card movement within this section (use delegated function)
                if (window.handleCardDragWithinSectionOld) {
                    window.handleCardDragWithinSectionOld(evt, section.id);
                }
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
    const roman = chord.roman || harmonyAnalyzer.getRomanNumeral(chord, key);
    const colors = getFunctionColors(roman);

    // Check if this is an interval (not a chord)
    const isInterval = chord.selectionMode === 'interval';

    // Use simpleName for accurate chord symbol (e.g., "Gm9" for G Minor 9th)
    // Falls back to building symbol if simpleName not available
    let chordSymbol = chord.simpleName || chord.root;

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

    return `
        <div class="relative inline-block">
            <div class="simplified-card bg-gradient-to-br from-gray-800 to-gray-900 border-2 rounded-xl overflow-hidden hover:shadow-xl transition-all shadow-lg relative" style="min-height: 80px; ${functionBorderStyle}">
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
                <div class="notation-view hidden flex items-center justify-center h-full p-2 bg-gray-50" style="min-height: 80px;">
                    <canvas class="simplified-notation-canvas"></canvas>
                </div>
            </div>

            <!-- Duration controls (dangling below card) -->
            <div class="flex items-center justify-center gap-1 mt-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded-md text-xs">
                <span class="text-gray-300 text-[10px]">Dur:</span>
                <select class="duration-whole-select bg-gray-800 text-white border border-gray-600 rounded px-1 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500" title="Whole beats" data-card-index="${index}">
                    ${[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16].map(n =>
                        `<option value="${n}" ${n === wholeBeats ? 'selected' : ''}>${n}</option>`
                    ).join('')}
                </select>
                <span class="text-gray-400 text-[10px]">+</span>
                <select class="duration-frac-select bg-gray-800 text-white border border-gray-600 rounded px-1 py-0.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500" title="Fractional beats" data-card-index="${index}">
                    <option value="0" ${fractionalBeats === 0 ? 'selected' : ''}>0</option>
                    <option value="0.25" ${fractionalBeats === 0.25 ? 'selected' : ''}>¼</option>
                    <option value="0.5" ${fractionalBeats === 0.5 ? 'selected' : ''}>½</option>
                    <option value="0.75" ${fractionalBeats === 0.75 ? 'selected' : ''}>¾</option>
                </select>
                <span class="text-gray-400 text-[10px]">♩</span>
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
function createDetailedCardHTML(chord, index, key) {
    const roman = chord.roman || harmonyAnalyzer.getRomanNumeral(chord, key);
    const colors = getFunctionColors(roman);
    const isInterval = chord.selectionMode === 'interval';
    const chordSymbol = chord.simpleName || chord.name || `${chord.root}${chord.type}`;
    const intervalSymbol = isInterval ? (chord.simpleName || chord.type) : null;
    const functionLabel = getChordFunction(roman);

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
            <label class="flex items-center gap-0.5 cursor-pointer text-gray-700 text-[10px] ${isInScale ? 'font-semibold' : ''}">
                <input type="checkbox" value="${note}" ${isChecked ? 'checked' : ''}
                    class="note-checkbox w-2.5 h-2.5 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500">
                <span class="${isInScale ? 'text-green-700' : ''}">${note}</span>
                ${isInScale ? '<span class="text-[8px] text-green-600">●</span>' : ''}
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
            <button class="inversion-btn w-8 px-0.5 py-0.5 text-[9px] font-semibold rounded transition-colors ${
                isActive ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }" data-inversion="${inv}">${label}</button>
        `);
    }

    return `
        <div class="detailed-card bg-white border-2 border-blue-500 rounded-lg overflow-hidden shadow-lg">
            <!-- Header - drag handle for reordering -->
            <div class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-1.5 drag-handle cursor-grab active:cursor-grabbing">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        ${isInterval ? `
                            <div class="text-sm font-bold">${chord.root}</div>
                            <div class="text-[10px]" style="color: rgba(255,255,255,0.8);">${intervalSymbol}</div>
                        ` : `
                            <div class="text-sm font-bold">${chordSymbol}</div>
                        `}
                        <div class="text-xs" style="color: rgba(255,255,255,0.9);">${roman}</div>
                        ${functionLabel ? `<div class="text-[9px] text-blue-200">${functionLabel}</div>` : ''}
                        <div class="text-[9px] text-blue-200">Pos: ${index + 1}</div>
                    </div>
                    <div class="flex gap-0.5">
                        <button class="collapse-btn p-0.5 text-white hover:bg-white hover:bg-opacity-20 rounded transition" title="Collapse">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                            </svg>
                        </button>
                        <button class="delete-btn p-0.5 text-white hover:bg-red-500 hover:bg-opacity-90 rounded transition" title="Delete">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Top Control Buttons -->
            <div class="bg-gray-50 border-b border-gray-200 p-1 flex gap-0.5">
                <button class="play-btn px-1.5 py-0.5 bg-green-600 hover:bg-green-700 text-white text-[9px] font-medium rounded transition flex items-center justify-center gap-0.5 whitespace-nowrap">
                    <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.841z"/>
                    </svg>
                    Play
                </button>
                <button class="suggestions-btn px-1.5 py-0.5 bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-medium rounded transition flex items-center justify-center gap-0.5 whitespace-nowrap" title="Open Suggestions">
                    <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/>
                    </svg>
                    Suggest
                </button>
            </div>

            <!-- Controls -->
            <div class="p-1.5 space-y-1.5 text-xs">
                <!-- Root Note & Chord Type side by side -->
                <div class="flex gap-1">
                    <div class="flex-1">
                        <label class="block text-[10px] font-semibold text-gray-700 mb-0.5">Root</label>
                        <select class="root-select w-full px-1 py-0.5 bg-white border border-gray-300 rounded text-[10px]">
                            ${getRootNoteOptions(chord.root)}
                        </select>
                    </div>
                    <div class="flex-[2]">
                        <label class="block text-[10px] font-semibold text-gray-700 mb-0.5">Type</label>
                        <select class="type-select w-full px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px]">
                            ${getChordTypeOptions(chord.type)}
                        </select>
                    </div>
                </div>

                <!-- RH SECTION -->
                <div class="border-2 border-blue-200 rounded p-1 bg-blue-50">
                    <div class="text-[10px] font-bold text-blue-700 mb-0.5">RIGHT HAND (Treble)</div>

                    <!-- RH Octave Shift -->
                    <div class="mb-0.5">
                        <label class="block text-[9px] font-semibold text-gray-700 mb-0.5">Octave Shift</label>
                        <select class="rh-octave-select w-full px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px]">
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
                            <label class="text-[9px] font-semibold text-indigo-600">Notes <span class="text-green-600">●</span> = in scale</label>
                            <div class="flex gap-0.5">
                                <button class="notes-all-btn px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-500 hover:bg-indigo-600 text-white rounded">All</button>
                                <button class="notes-none-btn px-1.5 py-0.5 text-[9px] font-semibold bg-gray-500 hover:bg-gray-600 text-white rounded">None</button>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-x-2 gap-y-0.5">
                            ${noteCheckboxes}
                        </div>
                    </div>

                    <!-- RH Inversion -->
                    <div class="chord-card-inversion-section bg-yellow-50 border border-yellow-300 rounded p-1">
                        <label class="block text-[9px] font-semibold text-gray-700 mb-0.5">🎹 Inversion</label>
                        <div class="flex gap-0.5 inversion-btn-group">
                            ${inversionButtons.join('')}
                        </div>
                    </div>
                </div>

                <!-- Musical Notation (Permanent) -->
                <div class="border-t border-gray-200 pt-1.5 mt-1.5">
                    <div class="text-[10px] font-semibold text-gray-700 mb-1">Musical Notation</div>
                    <canvas class="chord-notation-canvas mx-auto" style="display: block;"></canvas>
                </div>

                <!-- Footer Buttons -->
                <div class="flex gap-1 pt-1 border-t border-gray-200">
                    <button class="collapse-btn flex-1 px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-[10px] rounded transition">
                        Collapse
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Main rendering functions (already exported above with 'export' keyword)
// - renderProgressionDisplay
// - renderProgressionDisplayForBuilder
// - renderProgressionControls
// - renderChordStaffNotation
// - toggleAllStaffNotation
// - createCompactViewModeToggle

// Internal functions that may need to be exposed to window for HTML event handlers
// will be handled in the main progressionBuilder.js file
