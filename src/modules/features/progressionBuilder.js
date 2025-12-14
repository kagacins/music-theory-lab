/**
 * Progression Builder Feature Module
 *
 * Contains all progression builder/trainer tab functionality including:
 * - Progression visualization and playback
 * - Chord progression loading and management
 * - Auto-playback with rhythm patterns
 * - Step-through functionality
 * - Recording mode
 * - Chord editing within progressions
 * - Voicing editors for each chord
 */

// Import state management
import {
    getTrainerState,
    setProgressionData,
    setCurrentIndex,
    setIsPlaying,
    setIsReady,
    setIsRecording,
    setRecordedProgression,
    setProgressionRomans,
    setCurrentKey,
    setScaleNotes,
    setTrainerChordNotes,
    getProgressionData,
    getCurrentIndex,
    getIsPlaying,
    getIsRecording,
    getCurrentKey,
    getProgressionRomans,
    getScaleNotes,
    getTrainerChordNotes,
    getStepChordTimeoutId,
    setStepChordTimeoutId,
    getSuggestionStyle,
    setSuggestionStyle,
    getSuggestionMood,
    setSuggestionMood,
    getStyleMoodSuggestions,
    setStyleMoodSuggestions,
    getTensionProfile,
    setTensionProfile,
    getSelectedChordIndex,
    setSelectedChordIndex,
    // Multi-select state
    getSelectedChordIndices,
    isChordSelected,
    addToSelection,
    removeFromSelection,
    toggleSelection,
    clearSelection,
    selectSingle,
    selectRange,
    getLastSelectedIndex,
    getSelectionCount,
    getSelectedIndicesArray,
    // Clipboard state
    setClipboard,
    getClipboard,
    clearClipboard,
    hasClipboard
} from '../state/trainerState.js';

import {
    getCurrentTab,
    getEnharmonicPreference,
    setEnharmonicPreference,
    getNotationPreference
} from '../state/globalState.js';

// Import BuildingBlockSequence for undo/redo serialization
import { BuildingBlockSequence } from '../state/buildingBlock.js';

// Import guided mode event dispatcher for lesson integration
import { dispatchBuilderEvent, isGuidedModeActive, validateProgressionChord } from '../ui/lessonGuidedMode.js';

// Import audio utilities
import {
    getPiano,
    getInstrument,
    getAudioIsReady,
    getAudioIsLoading,
    initAudio,
    whenAudioReady
} from '../audio/audioEngine.js';

// Import auto-save for dirty marking
import { markDirty as markAutoSaveDirty } from '../storage/autoSave.js';

// Track last step time to determine if we're in a stepping sequence
let lastStepTime = 0;

// Track whether we're currently playing a step chord (to prevent mouseleave from advancing when not playing)
let isStepPlaying = false;

// Track staff notation visibility state for each chord position
// This persists across key/progression changes
let staffNotationStates = new Map(); // Map<position, boolean>

// Track which chords are expanded in simplified view (Phase 3.3)
const expandedChords = new Set();

// Temporary escape hatch: force a one-time flat layout render (ignoring sections)
// Used when inserting chords via suggestions to avoid rare section+layout bugs.
let forceFlatLayoutOnce = false;

// ============================================================================
// VIEW MODE STATE (Scroll View vs Section View)
// ============================================================================

// View mode: 'scroll' (horizontal scroll) or 'section' (section-based navigation)
let progressionViewMode = 'scroll';

// Selected section IDs for section view mode (supports multi-select)
let selectedSectionIds = new Set();

// LocalStorage key for view mode persistence
const VIEW_MODE_STORAGE_KEY = 'progression-view-mode';

/**
 * Initialize view mode from localStorage
 */
function initViewModeState() {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === 'scroll' || stored === 'section') {
        progressionViewMode = stored;
    }
}

/**
 * Get current view mode
 * @returns {'scroll'|'section'} Current view mode
 */
export function getProgressionViewMode() {
    return progressionViewMode;
}

/**
 * Set view mode and persist to localStorage
 * @param {'scroll'|'section'} mode - View mode to set
 */
export function setProgressionViewMode(mode) {
    if (mode !== 'scroll' && mode !== 'section') return;
    progressionViewMode = mode;
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);

    // Clear section selection when switching modes
    if (mode === 'scroll') {
        selectedSectionIds.clear();
        // Also clear the notation measure filter so render() shows all measures
        const notationComposer = window.getNotationComposer ? window.getNotationComposer() : null;
        if (notationComposer && typeof notationComposer.clearMeasureFilter === 'function') {
            notationComposer.clearMeasureFilter();
        }
    } else if (mode === 'section') {
        // Auto-select first section when switching to section view
        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        if (compositionState) {
            const sections = compositionState.getSections();
            if (sections.length > 0 && selectedSectionIds.size === 0) {
                // Sort by first chord index to get the "first" section
                const sortedSections = [...sections].sort((a, b) => {
                    const aMin = Math.min(...(a.chordIndices || [0]));
                    const bMin = Math.min(...(b.chordIndices || [0]));
                    return aMin - bMin;
                });
                selectedSectionIds.add(sortedSections[0].id);
            }
        }
    }
}

/**
 * Get selected section IDs for section view
 * @returns {Array<string>} Array of selected section IDs
 */
export function getSelectedSectionIds() {
    return [...selectedSectionIds];
}

/**
 * Check if a section is currently selected
 * @param {string} sectionId - Section ID to check
 * @returns {boolean} True if section is selected
 */
export function isSectionSelectedInView(sectionId) {
    return selectedSectionIds.has(sectionId);
}

/**
 * Select a section (optionally additive for multi-select)
 * @param {string} sectionId - Section ID to select
 * @param {boolean} additive - If true, add to selection; if false, replace selection
 */
export function selectSectionInView(sectionId, additive = false) {
    if (!additive) {
        selectedSectionIds.clear();
    }
    selectedSectionIds.add(sectionId);
}

/**
 * Deselect a section
 * @param {string} sectionId - Section ID to deselect
 */
export function deselectSectionInView(sectionId) {
    selectedSectionIds.delete(sectionId);
}

/**
 * Clear all section selections
 */
export function clearSectionSelection() {
    selectedSectionIds.clear();
    // Also clear the notation measure filter when clearing section selection
    const notationComposer = window.getNotationComposer ? window.getNotationComposer() : null;
    if (notationComposer && typeof notationComposer.clearMeasureFilter === 'function') {
        notationComposer.clearMeasureFilter();
    }
}

/**
 * Select a range of adjacent sections from last selected to target
 * @param {string} targetSectionId - Target section ID
 * @param {Array} sections - Array of all sections (in order)
 */
export function selectSectionRange(targetSectionId, sections) {
    if (selectedSectionIds.size === 0) {
        // No previous selection, just select the target
        selectedSectionIds.add(targetSectionId);
        return;
    }

    // Get the current selection's last section
    const selectedArray = [...selectedSectionIds];
    const lastSelectedId = selectedArray[selectedArray.length - 1];

    // Find indices
    const lastIndex = sections.findIndex(s => s.id === lastSelectedId);
    const targetIndex = sections.findIndex(s => s.id === targetSectionId);

    if (lastIndex === -1 || targetIndex === -1) return;

    // Select all sections in range
    const start = Math.min(lastIndex, targetIndex);
    const end = Math.max(lastIndex, targetIndex);

    for (let i = start; i <= end; i++) {
        selectedSectionIds.add(sections[i].id);
    }
}

/**
 * Convert hex color to rgba
 * @param {string} hex - Hex color string
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
function hexToRgba(hex, alpha = 0.15) {
    if (!hex || typeof hex !== 'string') {
        return `rgba(192, 132, 252, ${alpha})`;
    }
    let parsed = hex.replace('#', '');
    if (parsed.length === 3) {
        parsed = parsed.split('').map(c => c + c).join('');
    }
    const r = parseInt(parsed.slice(0, 2), 16);
    const g = parseInt(parsed.slice(2, 4), 16);
    const b = parseInt(parsed.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Initialize view mode state on load
initViewModeState();

// Set up keyboard navigation for section view
function setupSectionViewKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
        // Only handle if we're in section view mode
        if (progressionViewMode !== 'section') return;

        // Check if we have sections
        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        const sections = compositionState ? compositionState.getSections() : [];
        if (sections.length === 0) return;

        // Only handle if no input/textarea is focused
        const activeElement = document.activeElement;
        if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') return;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                navigateToPreviousSection();
                break;
            case 'ArrowRight':
                e.preventDefault();
                navigateToNextSection();
                break;
            case 'Escape':
                // Clear section selection
                clearSectionSelection();
                renderProgressionDisplay('melody-progression-visualization', true);
                updateNotationForSelectedSections();
                break;
        }
    });
}

// Initialize keyboard navigation
setupSectionViewKeyboardNavigation();

// Expose view mode functions to window for external access
window.setProgressionViewMode = setProgressionViewMode;
window.getProgressionViewMode = getProgressionViewMode;
window.navigateToPreviousSection = navigateToPreviousSection;
window.navigateToNextSection = navigateToNextSection;
window.clearSectionSelection = clearSectionSelection;

// Import note/chord utilities
import {
    noteToMidi,
    resolveEnharmonic,
    getNoteKeyId,
    getInvertedChordNotes,
    getLHNotes
} from '../utils/noteUtils.js';

// Import roman numeral utilities
import { noteToRomanNumeral } from '../utils/romanNumerals.js';

// Import data definitions
import {
    SHARP_NOTES,
    FLAT_NOTES,
    ALL_NOTES,
    CHORD_DEFINITIONS,
    INVERSION_NAMES,
    MAJOR_SCALE_STEPS,
    ENHARMONIC_MAP,
    ROMAN_MAP_BASE
} from '../../data/music-data.js';

// Import chord suggestion modal (legacy - kept for compatibility)
import { showChordSuggestionModal } from '../ui/chordSuggestionModal.js';

// Import unified recommendation modal (new consolidated UI)
import { showUnifiedRecommendationModal } from '../ui/recommendations/UnifiedRecommendationModal.js';

// Import template browser modal (Phase 3.1)
import { showTemplateBrowser } from '../ui/templateBrowserModal.js';

// Import rhythmic patterns (Phase 3.2)
import {
    RHYTHMIC_PATTERNS,
    getPatternsForChordCount,
    getPatternById,
    getCompingPatterns,
    getCompingPatternById,
    applyRhythmPattern,
    detectCurrentPattern,
    formatBeatsDisplay,
    getDefaultPatternForChordCount,
    getRecommendedPatterns,
    getPatternTimeSignatureSuitability
} from './rhythmicPatterns.js';
import {
    getAllPatternsForCount,
    getAnyPatternById,
    applyBeatsToProgression,
    saveCustomPattern,
    getCustomPatternsForCount,
    getCustomPatterns,
    deleteCustomPattern
} from './rhythmPatternLibrary.js';
import {
    previewPattern,
    stopPreview,
    setPreviewOptions
} from './rhythmPatternPreview.js';

// Phase 2.1: Import section intent state for position-based insertion
import {
    getInsertAfterIndex,
    getSectionIntent,
    INTENT_MODES
} from '../state/sectionIntentState.js';

// Import harmony analyzer (Phase 3.3) - use its COMMON_PROGRESSIONS as the single source of truth
import { HarmonyAnalyzer, COMMON_PROGRESSIONS } from '../analysis/harmonyAnalyzer.js';
import { PATTERN_CATEGORIES } from '../analysis/patternDetection.js';

// Import undo/redo utilities
import {
    saveState,
    undo as undoHistory,
    redo as redoHistory,
    pushToRedoStack,
    pushToUndoStack,
    clearHistory,
    canUndo,
    canRedo
} from '../utils/undoRedo.js';

import {
    STYLE_PRESETS,
    MOOD_PRESETS,
    generateStyleMoodSuggestions,
    analyzeTension
} from './chordSuggestionEngine.js';

// Phase 3: Tension Arc System
import { renderEnhancedTensionCurve, getTensionArcUI } from '../ui/TensionArcUI.js';
import { getTensionArcPlanner } from '../analysis/TensionArcPlanner.js';

// Voice Leading Optimization
import { getVoiceLeadingOptimizedProgression } from './voiceLeadingOptimizer.js';
import { DEFAULT_TIME_SIGNATURE } from '../../data/music-data.js';

// ============================================================================
// Chord Function Helper (Phase 3.3: Enhanced with Color-Coding)
// ============================================================================

/**
 * Get chord function label (Tonic, Dominant, Subdominant, etc.)
 * @param {string} roman - Roman numeral (e.g., 'I', 'ii', 'V', 'vii°')
 * @returns {string|null} Function label or null if not applicable
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

/**
 * Get CSS class for chord quality indicator
 * @param {string} chordType - Chord type (e.g., 'Major', 'Minor', 'Diminished', 'Augmented')
 * @returns {string} CSS class for the quality indicator
 */
function getChordQualityClass(chordType) {
    return '';
}

/**
 * Get label for chord quality
 * @param {string} chordType - Chord type
 * @returns {string} Quality label
 */
function getChordQualityLabel(chordType) {
    return chordType || 'Unknown';
}

// ============================================================================
// Style & Mood Suggestion Helpers
// ============================================================================

function getStylePresetById(id) {
    return STYLE_PRESETS.find(preset => preset.id === id) || STYLE_PRESETS[0];
}

function getMoodPresetById(id) {
    return MOOD_PRESETS.find(preset => preset.id === id) || MOOD_PRESETS[0];
}

function initializeStyleMoodControls() {
    const styleSelect = document.getElementById('trainer-style-select');
    const moodSelect = document.getElementById('trainer-mood-select');

    if (styleSelect && !styleSelect.dataset.initialized) {
        STYLE_PRESETS.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.label;
            styleSelect.appendChild(option);
        });
        styleSelect.dataset.initialized = 'true';
        styleSelect.onchange = (event) => {
            setSuggestionStyle(event.target.value);
            updateStyleMoodDescriptions();
            refreshStyleMoodInsights();
            // Update unified suggestions panel if available
            if (window.updateUnifiedSuggestions) {
                window.updateUnifiedSuggestions();
            }
        };
    }
    if (styleSelect) {
        styleSelect.value = getSuggestionStyle();
    }

    if (moodSelect && !moodSelect.dataset.initialized) {
        MOOD_PRESETS.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.id;
            option.textContent = preset.label;
            moodSelect.appendChild(option);
        });
        moodSelect.dataset.initialized = 'true';
        moodSelect.onchange = (event) => {
            setSuggestionMood(event.target.value);
            updateStyleMoodDescriptions();
            refreshStyleMoodInsights();
            // Update unified suggestions panel if available
            if (window.updateUnifiedSuggestions) {
                window.updateUnifiedSuggestions();
            }
        };
    }
    if (moodSelect) {
        moodSelect.value = getSuggestionMood();
    }

    updateStyleMoodDescriptions();

    const refreshBtn = document.getElementById('refresh-suggestions-btn');
    if (refreshBtn && !refreshBtn.dataset.bound) {
        refreshBtn.dataset.bound = 'true';
        refreshBtn.onclick = () => refreshStyleMoodInsights(true);
    }
}

function updateStyleMoodDescriptions() {
    const stylePreset = getStylePresetById(getSuggestionStyle());
    const moodPreset = getMoodPresetById(getSuggestionMood());

    const styleDescription = document.getElementById('trainer-style-description');
    if (styleDescription) {
        styleDescription.textContent = stylePreset.description;
    }

    const moodDescription = document.getElementById('trainer-mood-description');
    if (moodDescription) {
        moodDescription.textContent = moodPreset.description;
    }
}

function updateSuggestionContextDisplay(context = {}, hasSuggestions = false) {
    const contextBody = document.getElementById('suggestion-context-body');
    const contextMeta = document.getElementById('suggestion-context-meta');

    if (!contextBody || !contextMeta) return;

    const stylePreset = getStylePresetById(getSuggestionStyle());
    const moodPreset = getMoodPresetById(getSuggestionMood());

    if (!context.lastRoman) {
        contextBody.textContent = 'Build a progression to unlock tailored chord paths for your chosen style and mood.';
        contextMeta.textContent = `${stylePreset.label} · ${moodPreset.label}`;
        return;
    }

    const functionLabel = getChordFunction(context.normalizedLast) || 'Neutral';
    const statusText = hasSuggestions
        ? 'Suggestions tuned to continue the current harmonic flow.'
        : 'Adjust your style or mood to discover fresh directions.';

    contextBody.innerHTML = `Last chord <span class="font-mono font-semibold text-indigo-600">${context.lastRoman}</span> leans <span class="font-semibold">${functionLabel}</span>. ${statusText}`;
    contextMeta.textContent = `${stylePreset.label} · ${moodPreset.label}`;
}

function renderStyleMoodSuggestionList(suggestions = [], context = {}) {
    const listContainer = document.getElementById('style-mood-suggestion-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    if (!suggestions.length) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'text-xs text-gray-500 italic';
        emptyMsg.textContent = 'No suggestions yet. Add chords or adjust the palette to get tailored ideas.';
        listContainer.appendChild(emptyMsg);
        updateSuggestionContextDisplay(context, false);
        return;
    }

    suggestions.forEach((suggestion, index) => {
        const card = document.createElement('div');
        card.className = 'rounded-md border border-indigo-200 bg-white p-1.5 flex flex-col gap-0.5';

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between';

        const romanSpan = document.createElement('span');
        romanSpan.className = 'font-mono text-base font-semibold text-indigo-700';
        romanSpan.textContent = suggestion.roman;
        header.appendChild(romanSpan);

        const confidence = document.createElement('span');
        confidence.className = 'text-[11px] font-semibold text-indigo-500';
        confidence.textContent = `${Math.round(suggestion.confidence * 100)}%`;
        header.appendChild(confidence);

        card.appendChild(header);

        const typeLine = document.createElement('div');
        typeLine.className = 'text-[11px] text-gray-600 flex items-center gap-1';
        typeLine.innerHTML = `<span class="font-semibold text-gray-700">${suggestion.chordType}</span>`;
        card.appendChild(typeLine);

        if (suggestion.reason) {
            const reasonLine = document.createElement('p');
            reasonLine.className = 'text-[11px] text-gray-500 leading-snug';
            reasonLine.textContent = suggestion.reason;
            card.appendChild(reasonLine);
        }

        const actionRow = document.createElement('div');
        actionRow.className = 'flex items-center justify-between pt-0.5';

        const positionBadge = document.createElement('span');
        positionBadge.className = 'text-[10px] font-medium text-gray-400 uppercase tracking-wide';
        positionBadge.textContent = `Option ${index + 1}`;
        actionRow.appendChild(positionBadge);

        const addButton = document.createElement('button');
        addButton.className = 'px-2 py-0.5 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors';
        addButton.textContent = 'Add to Progression';
        addButton.onclick = (event) => {
            event.preventDefault();
            addSuggestedChordToProgression(suggestion);
        };
        actionRow.appendChild(addButton);

        card.appendChild(actionRow);
        listContainer.appendChild(card);
    });

    updateSuggestionContextDisplay(context, true);
}

function tensionToColor(value) {
    const clamped = Math.min(Math.max(value, 0), 1);
    const hue = 120 - Math.round(clamped * 120);
    return `hsl(${hue}, 68%, 48%)`;
}

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

function addSuggestedChordToProgression(suggestion) {
    if (!suggestion) return;

    const trainerState = getTrainerState();
    const currentKey = trainerState.currentKey || 'C';
    const keyForCalculation = currentKey.endsWith('m') ? currentKey.replace(/m$/, '') : currentKey;
    const octaveShift = trainerState.octaveShift || 0;

    const chordData = getProgressionChordNotes(
        keyForCalculation,
        suggestion.roman,
        suggestion.chordType,
        0,
        octaveShift
    );

    if (!chordData) {
        if (window.showModal) {
            window.showModal(`Unable to generate chord for ${suggestion.roman}.`, true);
        }
        return;
    }

    chordData.roman = suggestion.roman;
    chordData.type = suggestion.chordType;
    chordData.simpleName = chordData.simpleName || chordData.name;
    chordData.isVoicingExpanded = true;
    chordData.lhType = 'off';
    chordData.lhInversion = 0;
    chordData.lhOctaveShift = 0;
    chordData.lhOmittedNotes = [];
    chordData.omittedNotes = [];
    chordData.rhythmPattern = 'block';
    chordData.selectionMode = 'chord';
    chordData.octaveShift = chordData.octaveShift || 0;

    addToProgressionData(chordData);

    const display = document.getElementById('progression-chord-notes-display');
    if (display) {
        display.textContent = `Added suggested chord: ${suggestion.roman} (${suggestion.chordType})`;
    }
}

function refreshStyleMoodInsights(force = false) {
    const suggestionContainer = document.getElementById('style-mood-suggestion-list');
    const tensionTrack = document.getElementById('tension-meter-track');
    if (!suggestionContainer && !tensionTrack && !force) {
        return;
    }

    const trainerState = getTrainerState();
    const progression = trainerState.progressionData || [];
    const styleId = getSuggestionStyle() || 'any';
    const moodId = getSuggestionMood() || 'neutral';

    const suggestionResult = generateStyleMoodSuggestions({
        progression,
        styleId,
        moodId
    });
    setStyleMoodSuggestions(suggestionResult.suggestions || []);
    renderStyleMoodSuggestionList(suggestionResult.suggestions || [], suggestionResult.context);

    const tensionResult = analyzeTension(progression);
    setTensionProfile(tensionResult.profile || []);
    renderTensionVisualization(tensionResult);
}

export function toggleStyleMoodInsightsPanel() {
    // Don't allow panel toggling during guided mode (scroll is locked)
    if (isGuidedModeActive()) return;

    const panel = document.getElementById('style-mood-insights-panel');
    const section = panel?.closest('.trainer-section-item');
    const chevron = document.getElementById('style-mood-insights-chevron');
    if (!panel || !chevron || !section) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        // Expanding
        panel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        // Collapsing - hide panel which will trigger MutationObserver
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }

    // Save panel state
    if (window.savePanelState) {
        window.savePanelState('style-mood-insights-panel', !isHidden);
    }

    // Manually trigger sidebar update with a small delay to ensure DOM is updated
    if (window.triggerSectionSidebarUpdate) {
        setTimeout(() => {
            window.triggerSectionSidebarUpdate('trainer', 'style-mood-insights');
        }, 50);
    }
}

export function toggleProgressionControlsPanel() {
    // Don't allow panel toggling during guided mode (scroll is locked)
    if (isGuidedModeActive()) return;

    const panel = document.getElementById('progression-controls-panel');
    const chevron = document.getElementById('progression-controls-chevron');
    if (!panel || !chevron) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }

    // Save panel state
    if (window.savePanelState) {
        window.savePanelState('progression-controls-panel', !isHidden);
    }
}

export function toggleProgressionCardsPanel() {
    // Don't allow panel toggling during guided mode (scroll is locked)
    if (isGuidedModeActive()) return;

    const panel = document.getElementById('progression-visualization-panel');
    const chevron = document.getElementById('progression-visualization-chevron');
    if (!panel || !chevron) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }

    // Save panel state
    if (window.savePanelState) {
        window.savePanelState('progression-visualization-panel', !isHidden);
    }
}

// ============================================================================
// REUSABLE QUICK ADD CHORD COMPONENT
// ============================================================================

/**
 * Quick Add Chord Component
 * A reusable component for adding chords to the progression
 * Can be instantiated in any container
 */

// Track initialized Quick Add forms to avoid duplicates
const initializedQuickAddForms = new Set();

/**
 * Generate the HTML for the Quick Add Chord form
 * @param {string} formId - Unique ID for this form instance
 * @returns {string} HTML string for the form
 */
function generateQuickAddChordHTML(formId) {
    const datalistId = `chord-type-datalist-${formId}`;

    return `
        <div id="${formId}" class="hidden mb-3 p-4 bg-white rounded-lg border-2 border-indigo-300 shadow-lg relative z-20">
            <div class="flex items-center justify-between mb-3">
                <h4 class="text-sm font-bold text-indigo-800">Quick Add Chord</h4>
                <button onclick="window.toggleQuickAddChordForm('${formId}')" class="text-gray-500 hover:text-gray-700 text-xs font-semibold px-2 py-1 rounded hover:bg-gray-100" title="Close">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">Root Note</label>
                    <select id="${formId}-root" class="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
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
                    <label class="block text-xs font-medium text-gray-700 mb-1">Chord/Interval Type <span class="text-gray-500">(type to filter)</span></label>
                    <input
                        type="text"
                        id="${formId}-type-input"
                        list="${datalistId}"
                        class="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="Start typing or click dropdown arrow..."
                        value=""
                    >
                    <datalist id="${datalistId}">
                        <optgroup label="─── TRIADS ───">
                            <option value="Major">Major</option>
                            <option value="Minor">Minor</option>
                            <option value="Augmented">Augmented</option>
                            <option value="Diminished">Diminished</option>
                            <option value="Sus2">Sus2</option>
                            <option value="Sus4">Sus4</option>
                            <option value="Power Chord">Power Chord</option>
                        </optgroup>
                        <optgroup label="─── SEVENTHS ───">
                            <option value="Dominant 7th">Dominant 7th</option>
                            <option value="Major 7th">Major 7th</option>
                            <option value="Minor 7th">Minor 7th</option>
                            <option value="Half-Diminished 7th">Half-Diminished 7th</option>
                            <option value="Diminished 7th">Diminished 7th</option>
                            <option value="Minor-Major 7th">Minor-Major 7th</option>
                        </optgroup>
                        <optgroup label="─── NINTHS ───">
                            <option value="Major 9th">Major 9th</option>
                            <option value="Dominant 9th">Dominant 9th</option>
                            <option value="Minor 9th">Minor 9th</option>
                            <option value="6/9">6/9</option>
                            <option value="Add9">Add9</option>
                        </optgroup>
                        <optgroup label="─── EXTENDED ───">
                            <option value="Dominant 11th">Dominant 11th</option>
                            <option value="Minor 11th">Minor 11th</option>
                            <option value="Dominant 13th">Dominant 13th</option>
                            <option value="Major 6th">Major 6th</option>
                            <option value="Minor 6th">Minor 6th</option>
                        </optgroup>
                        <optgroup label="─── ALTERED ───">
                            <option value="Augmented 7th">Augmented 7th</option>
                            <option value="7b5">7b5</option>
                            <option value="7#5">7#5</option>
                            <option value="7b9">7b9</option>
                            <option value="7#9">7#9</option>
                        </optgroup>
                        <optgroup label="─── INTERVALS ───">
                            <option value="Major 2nd">Major 2nd</option>
                            <option value="Minor 2nd">Minor 2nd</option>
                            <option value="Major 3rd">Major 3rd</option>
                            <option value="Minor 3rd">Minor 3rd</option>
                            <option value="Perfect 4th">Perfect 4th</option>
                            <option value="Tritone">Tritone</option>
                            <option value="Perfect 5th">Perfect 5th</option>
                            <option value="Major 6th">Major 6th (interval)</option>
                            <option value="Minor 6th">Minor 6th (interval)</option>
                            <option value="Major 7th">Major 7th (interval)</option>
                            <option value="Minor 7th">Minor 7th (interval)</option>
                            <option value="Octave">Octave</option>
                        </optgroup>
                    </datalist>
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1">Inversion</label>
                    <select id="${formId}-inversion" class="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                        <option value="0">Root Position</option>
                        <option value="1">1st Inversion</option>
                        <option value="2">2nd Inversion</option>
                        <option value="3">3rd Inversion</option>
                    </select>
                </div>
                <div class="flex items-end gap-2">
                    <button onclick="window.quickAddChordFromForm('${formId}')" class="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg shadow transition">
                        Add
                    </button>
                    <button onclick="window.toggleQuickAddChordForm('${formId}')" class="px-3 py-2 bg-gray-400 hover:bg-gray-500 text-white text-sm font-semibold rounded-lg shadow transition">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Initialize a Quick Add Chord form in a container
 * @param {string} containerId - ID of the container to insert the form into
 * @param {string} formId - Unique ID for this form instance (defaults to 'quick-add-chord-form')
 * @param {string} insertPosition - 'beforeend', 'afterbegin', etc. (default: 'beforeend')
 * @returns {boolean} True if form was created, false if it already exists
 */
export function initQuickAddChordForm(containerId, formId = 'quick-add-chord-form', insertPosition = 'beforeend') {
    // Check if form already exists
    if (document.getElementById(formId)) {
        return false;
    }

    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`[QuickAddChord] Container '${containerId}' not found`);
        return false;
    }

    // Generate and insert the form HTML
    const formHTML = generateQuickAddChordHTML(formId);
    container.insertAdjacentHTML(insertPosition, formHTML);

    // Track this form
    initializedQuickAddForms.add(formId);

    return true;
}

/**
 * Toggle the visibility of a Quick Add Chord form
 * @param {string} formId - ID of the form to toggle
 */
export function toggleQuickAddChordForm(formId = 'quick-add-chord-form') {
    const form = document.getElementById(formId);
    if (!form) {
        console.warn(`[QuickAddChord] Form '${formId}' not found`);
        return;
    }

    if (form.classList.contains('hidden')) {
        form.classList.remove('hidden');
        // Focus the type input for quick typing
        const typeInput = document.getElementById(`${formId}-type-input`);
        if (typeInput) {
            setTimeout(() => typeInput.focus(), 100);
        }
    } else {
        form.classList.add('hidden');
    }
}

/**
 * Add a chord from a Quick Add form
 * @param {string} formId - ID of the form to read values from
 */
export function quickAddChordFromForm(formId = 'quick-add-chord-form') {
    // Get form elements
    const rootSelect = document.getElementById(`${formId}-root`);
    const typeInput = document.getElementById(`${formId}-type-input`);
    const inversionSelect = document.getElementById(`${formId}-inversion`);

    if (!rootSelect || !typeInput || !inversionSelect) {
        console.warn(`[QuickAddChord] Form elements not found for '${formId}'`);
        return;
    }

    const rootIndex = parseInt(rootSelect.value || '0');
    const chordType = typeInput.value?.trim() || '';
    const inversion = parseInt(inversionSelect.value || '0');

    // Validate that a chord/interval was selected
    if (!chordType) {
        alert('Please select a chord or interval from the list.');
        typeInput.focus();
        return;
    }

    // Get the datalist to validate the selection
    const datalistId = `chord-type-datalist-${formId}`;
    const datalist = document.getElementById(datalistId);
    if (datalist) {
        const validOptions = Array.from(datalist.querySelectorAll('option')).map(opt => opt.value);
        if (!validOptions.includes(chordType)) {
            alert('Please select a valid chord or interval from the dropdown list.');
            typeInput.focus();
            return;
        }
    }

    // Validate chord during guided mode (before adding)
    if (isGuidedModeActive()) {
        // Map root index to note name (using simple names for validation)
        const rootNotes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const rootNote = rootNotes[rootIndex] || 'C';
        const chordName = `${rootNote} ${chordType}`;

        const validation = validateProgressionChord(chordName);
        if (!validation.valid) {
            // Show error feedback
            const form = document.getElementById(formId);
            if (form) {
                form.style.borderColor = '#ef4444'; // Red
                form.style.boxShadow = '0 0 0 2px rgba(239, 68, 68, 0.3)';
                setTimeout(() => {
                    form.style.borderColor = '';
                    form.style.boxShadow = '';
                }, 1500);
            }
            alert(validation.message);
            return;
        }
    }

    // Use the existing addChordToProgression function from chord builder
    if (window.addChordToProgression && window.selectBuilderRootNote && window.selectBuilderChordType && window.selectBuilderInversion) {
        try {
            // Temporarily set the builder state to match the quick add selection
            window.selectBuilderRootNote(rootIndex, false); // Don't play audio
            window.selectBuilderChordType(chordType, false); // Don't play audio
            window.selectBuilderInversion(inversion, false); // Don't play audio

            // Add the chord without triggering playback
            window.addChordToProgression(false); // false = don't switch to trainer tab

            // Clear the input for next chord
            typeInput.value = '';

            // Show success feedback
            const form = document.getElementById(formId);
            if (form) {
                form.style.borderColor = '#10b981'; // Green
                setTimeout(() => {
                    form.style.borderColor = '';
                }, 300);
            }
        } catch (error) {
            console.error('[QuickAddChord] Error adding chord:', error);
            alert('Error adding chord. Please try again.');
        }
    } else {
        console.error('[QuickAddChord] Required chord builder functions not available');
        alert('Chord builder not available. Please try from the Scale Explorer tab.');
    }
}

/**
 * Get the default form ID for a container
 * Maps container IDs to their Quick Add form IDs
 * @param {string} containerId - Container ID
 * @returns {string} Form ID
 */
export function getQuickAddFormId(containerId) {
    // Map containers to their form IDs
    const formIdMap = {
        'progression-visualization-panel': 'quick-add-chord-form',
        'chord-progression-card-panel': 'quick-add-chord-form-melody',
        'melody-progression-visualization': 'quick-add-chord-form-melody',
    };

    return formIdMap[containerId] || 'quick-add-chord-form';
}

// Make functions available globally
window.toggleQuickAddChordForm = toggleQuickAddChordForm;
window.quickAddChordFromForm = quickAddChordFromForm;
window.initQuickAddChordForm = initQuickAddChordForm;

/**
 * Suggest inversion for smoother voice leading
 * @param {number} chordIndex - Index of current chord in progression
 * @returns {Object|null} Object with inversion, reason, and details or null if no suggestion
 */
function suggestInversion(chordIndex) {
    const trainerState = getTrainerState();
    const currentChord = trainerState.progressionData[chordIndex];
    const previousChord = chordIndex > 0 ? trainerState.progressionData[chordIndex - 1] : null;
    
    if (!previousChord || !currentChord) {
        return null;
    }
    
    // Get previous chord's bass note (lowest note)
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
            getEnharmonicPreference(),
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
 * Toggle all simplified chord cards between notation and chord info views
 * Used by the global toggle switch next to "Current Chord Progression" header
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

// Make it available globally for the toggle switch in index.html
window.toggleAllStaffNotation = toggleAllStaffNotation;

/**
 * Update the visual state of the global toggle switches
 * @param {boolean} showStaff - Current state (true = notation view, false = text view)
 */
function updateGlobalToggleButtons(showStaff) {
    // Update Progression Builder toggle checkbox
    const progToggle = document.getElementById('progression-view-toggle');
    if (progToggle) {
        progToggle.checked = showStaff;
    }

    // Update Composition Studio toggle checkbox
    const melodyToggle = document.getElementById('melody-view-toggle');
    if (melodyToggle) {
        melodyToggle.checked = showStaff;
    }
}

/**
 * Capture current staff notation visibility states before re-rendering
 * Checks both Progression Builder and Composition Studio tabs
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
 * Convert minor key to its relative major for VexFlow key signature
 * VexFlow works better with relative major keys for minor key signatures
 * @param {string} minorKey - Minor key name (e.g., "D#m", "Am", "Ebm")
 * @returns {string} Relative major key name (e.g., "F#", "C", "Gb")
 */
function getRelativeMajorForVexFlow(minorKey) {
    const enharmonic = getEnharmonicPreference();
    const notes = enharmonic === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    
    // Remove 'm' suffix
    const rootNote = minorKey.replace(/m$/, '');
    const rootIndex = notes.indexOf(rootNote);
    
    if (rootIndex === -1) {
        // Fallback: try to find in enharmonic map
        const mapped = Object.keys(ENHARMONIC_MAP).find(k => ENHARMONIC_MAP[k] === rootNote);
        if (mapped) {
            const mappedIndex = notes.indexOf(mapped);
            if (mappedIndex !== -1) {
                // Relative major is 3 semitones up from minor root
                const relativeMajorIndex = (mappedIndex + 3) % 12;
                return notes[relativeMajorIndex];
            }
        }
        return rootNote; // Fallback to original
    }
    
    // Relative major is 3 semitones up from minor root
    const relativeMajorIndex = (rootIndex + 3) % 12;
    return notes[relativeMajorIndex];
}

/**
 * Get key signature string for VexFlow (handles minor keys by converting to relative major)
 * @param {string} key - Key name (e.g., "C", "G", "F#", "Bb", "D#m", "Am")
 * @returns {string} Key signature string for VexFlow
 */
function getVexFlowKeySignature(key) {
    // Check if it's a minor key
    if (key.endsWith('m')) {
        // Convert minor key to relative major for VexFlow
        // VexFlow handles relative major key signatures better for minor keys
        const relativeMajor = getRelativeMajorForVexFlow(key);
        return relativeMajor;
    }
    
    // For major keys, return as-is
    return key;
}

/**
 * Get accidentals that should appear in the key signature
 * @param {string} key - Key name (e.g., "C", "G", "F#", "Bb", "A#m")
 * @returns {Object} { sharps: Set<string>, flats: Set<string> } - Sets of note names
 */
function getKeySignatureAccidentals(key) {
    // Remove 'm' suffix if present (for minor keys)
    const cleanKey = key.replace(/m$/, '');

    // Define the order of sharps and flats as they appear in key signatures
    const sharpOrder = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
    const flatOrder = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

    const sharps = new Set();
    const flats = new Set();

    // Map keys to number of sharps/flats
    // For keys not in the map, calculate based on relative major (for minor keys) or enharmonic equivalent
    const keySignatures = {
        'C': { type: 'none', count: 0 },
        'G': { type: 'sharp', count: 1 },
        'D': { type: 'sharp', count: 2 },
        'A': { type: 'sharp', count: 3 },
        'E': { type: 'sharp', count: 4 },
        'B': { type: 'sharp', count: 5 },
        'F#': { type: 'sharp', count: 6 },
        'C#': { type: 'sharp', count: 7 },
        'F': { type: 'flat', count: 1 },
        'Bb': { type: 'flat', count: 2 },
        'Eb': { type: 'flat', count: 3 },
        'Ab': { type: 'flat', count: 4 },
        'Db': { type: 'flat', count: 5 },
        'Gb': { type: 'flat', count: 6 },
        'Cb': { type: 'flat', count: 7 },
        // Handle enharmonic equivalents and sharp keys
        'A#': { type: 'sharp', count: 4 }, // A# major = Bb major (4 flats), but written as 4 sharps
        'D#': { type: 'sharp', count: 6 }, // D# major = Eb major (3 flats), but written as 6 sharps  
        'G#': { type: 'sharp', count: 8 }, // G# major = Ab major (4 flats), but written as 8 sharps (rare)
        // Note: These are enharmonic equivalents, but we track them as sharps for consistency
    };

    let keySig = null;
    
    // For minor keys, always use relative major for key signature calculation
    if (key.endsWith('m')) {
        const relativeMajor = getRelativeMajorForVexFlow(key);
        keySig = keySignatures[relativeMajor];
    }
    
    // If not a minor key, look up directly
    if (!keySig) {
        keySig = keySignatures[cleanKey];
    }
    
    // If still not found, try enharmonic equivalents
    if (!keySig) {
        const enharmonicMap = {
            'A#': 'Bb', 'D#': 'Eb', 'G#': 'Ab', 'C#': 'Db', 'F#': 'Gb',
            'Bb': 'A#', 'Eb': 'D#', 'Ab': 'G#', 'Db': 'C#', 'Gb': 'F#'
        };
        const equivalent = enharmonicMap[cleanKey];
        if (equivalent) {
            keySig = keySignatures[equivalent];
        }
    }
    
    if (!keySig) {
        // Default fallback
        return { sharps, flats };
    }

    if (keySig.type === 'sharp') {
        for (let i = 0; i < keySig.count; i++) {
            sharps.add(sharpOrder[i]);
        }
    } else if (keySig.type === 'flat') {
        for (let i = 0; i < keySig.count; i++) {
            flats.add(flatOrder[i]);
        }
    }

    return { sharps, flats };
}

/**
 * Calculate dynamic canvas dimensions based on key signature and note range
 * @param {string} key - Current key signature
 * @param {Array} notes - Array of note strings (e.g., ["C4", "E4", "G4"])
 * @returns {Object} { width, height } dimensions
 */
function calculateCanvasDimensions(key, notes) {
    // Count accidentals in key signature
    const keySignature = getKeySignatureAccidentals(key);
    const accidentalCount = keySignature.sharps.size + keySignature.flats.size;

    // Reduced widths to eliminate wasted white space
    let width = 130;
    if (accidentalCount >= 6) {
        width = 180; // Keys with 6-7 accidentals (F#, C#, Gb, Cb)
    } else if (accidentalCount >= 5) {
        width = 165; // Keys with 5 accidentals (B, Db)
    } else if (accidentalCount >= 3) {
        width = 150; // Keys with 3-4 accidentals
    }

    // Check note range for height calculation
    let minOctave = 10;
    let maxOctave = 0;
    notes.forEach(note => {
        const match = note.match(/^([A-G][#b]?)(\d+)$/);
        if (match) {
            const octave = parseInt(match[2]);
            minOctave = Math.min(minOctave, octave);
            maxOctave = Math.max(maxOctave, octave);
        }
    });

    // Increased heights to prevent clef cutoff and accommodate extreme notes
    let height = 120;
    const octaveRange = maxOctave - minOctave;
    if (minOctave <= 2 || maxOctave >= 6) {
        height = 160; // Extreme notes need more vertical space
    } else if (octaveRange > 2) {
        height = 140; // Wide range needs a bit more space
    }

    return { width, height };
}

/**
 * Render compact chord notation for display on chord cards
 * Only shows RH notes as whole notes in treble clef with key signature
 * @param {Object} chord - Chord object containing notes, omittedNotes, etc.
 * @param {string} key - Current key signature
 * @param {HTMLCanvasElement} canvas - Canvas element to render on
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

        // Use VexFlow 5.x namespace
        const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } = VexFlow;

        if (!Renderer || !Stave || !StaveNote || !Voice || !Formatter || !Accidental) {
            return;
        }

        // Get the key signature accidentals
        const keySignature = getKeySignatureAccidentals(key);

        // Get notes that are actually being played (respecting omitted notes)
        const rhNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));

        if (rhNotes.length === 0) {
            // Show message if no notes
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

        // Calculate dynamic canvas size based on key signature and note range
        const dimensions = calculateCanvasDimensions(key, rhNotes);
        const displayWidth = dimensions.width;
        const displayHeight = dimensions.height;

        canvas.width = displayWidth;
        canvas.height = displayHeight;
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        // Clear canvas
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Create renderer
        const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
        renderer.resize(canvas.width, canvas.height);
        const ctx = renderer.getContext();

        // Create stave with treble clef
        const staveX = 5;
        const staveY = 10;
        const staveWidth = displayWidth - 10;
        const stave = new Stave(staveX, staveY, staveWidth);
        stave.addClef('treble');

        // Add key signature - VexFlow handles minor keys better via relative major
        const vexFlowKey = getVexFlowKeySignature(key);
        try {
            stave.addKeySignature(vexFlowKey);
        } catch (e) {
            // Continue without key signature
        }

        // Adjust note start position based on key signature complexity
        // More accidentals = need more space for key signature
        const accidentalCount = keySignature.sharps.size + keySignature.flats.size;
        let noteStartOffset = 40; // Base offset
        if (accidentalCount >= 6) {
            noteStartOffset = 100; // Large offset for keys with 6-7 accidentals (F#, C#, Gb, Cb)
        } else if (accidentalCount >= 5) {
            noteStartOffset = 85; // Medium-large offset for 5 accidentals (B, Db)
        } else if (accidentalCount >= 3) {
            noteStartOffset = 65; // Medium offset for 3-4 accidentals
        }

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
        const staveNote = new StaveNote({ clef: 'treble', keys: keys, duration: 'w' });

        // Center the notes horizontally
        try {
            staveNote.setXShift(15);
        } catch (e) {
            // Ignore if API differs
        }

        // Add accidentals only for notes NOT in the key signature
        vexFlowNotes.forEach((n, idx) => {
            const noteName = n.original.replace(/\d+$/, ''); // Remove octave
            const naturalNote = noteName.replace(/[#b]/, ''); // Get base note without accidental
            const hasSharp = noteName.includes('#');
            const hasFlat = noteName.includes('b');

            // Determine if this note matches what the key signature expects
            const isSharpInKey = keySignature.sharps.has(naturalNote);
            const isFlatInKey = keySignature.flats.has(naturalNote);

            // Only add an accidental if:
            // 1. The note has an accidental AND it doesn't match what's in the key signature
            // 2. The note is natural BUT the key signature expects it sharp/flat (needs natural sign)

            if (hasSharp) {
                // Note has a sharp - only add accidental if natural note is NOT sharp in key signature
                if (!isSharpInKey) {
                    staveNote.addModifier(new Accidental('#'), idx);
                }
            } else if (hasFlat) {
                // Note has a flat - only add accidental if natural note is NOT flat in key signature
                if (!isFlatInKey) {
                    staveNote.addModifier(new Accidental('b'), idx);
                }
            } else {
                // Natural note - need natural sign if key signature expects sharp/flat
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
    }
}

/**
 * Render staff notation for a chord
 * @param {number} chordIndex - Index of chord in progression
 * @param {HTMLCanvasElement} canvas - Canvas element to render on
 */
function renderStaffNotation(chordIndex, canvas) {
    try {
        // VexFlow 5.x browser build exposes VexFlow namespace
        if (typeof VexFlow === 'undefined') {
            // Show loading message on canvas
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.fillText('VexFlow not loaded', 10, 30);
            ctx.fillText('Check browser console', 10, 50);
            return;
        }

        // Use VexFlow 5.x namespace
        const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, TextBracket } = VexFlow;

        if (!Renderer || !Stave || !StaveNote || !Voice || !Formatter || !Accidental) {
            throw new Error('VexFlow classes not found - incomplete library');
        }

        const trainerState = getTrainerState();
        const chord = trainerState.progressionData[chordIndex];
        if (!chord) return;

        // Get the current key and its key signature accidentals
        const currentKey = trainerState.currentKey;
        const keySignature = getKeySignatureAccidentals(currentKey);

        // Get notes that are actually being played (respecting omitted notes)
        const rhNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
        const lhNotes = getLHNotes(
            chord.root,
            chord.lhType,
            chord.lhInversion,
            trainerState.currentKey,
            chord.lhOctaveShift || 0,
            chord.type,
            getEnharmonicPreference()
        ).filter(n => !(chord.lhOmittedNotes || []).includes(n));

        const allNotes = [...rhNotes, ...lhNotes];

        if (allNotes.length === 0) {
            // Show message if no notes
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#666';
            ctx.font = '12px Arial';
            ctx.fillText('No notes to display', 10, 30);
            return;
        }

        // Helper functions for ottava detection (same as melodyGenerator.js)
        // Note: For chord cards, we default to treble clef, but this could be made configurable
        function getOctaveShift(note, clef = 'treble') {
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return { shift: 0, label: null };

            let midi;
            try {
                midi = noteToMidi(note);
            } catch (e) {
                return { shift: 0, label: null };
            }

            if (clef === 'bass') {
                // Bass clef thresholds
                // Comfortable range: C2 to B4 (MIDI 36-71)
                
                // 15vb: Below C1 (MIDI < 24) - extremely low notes (transpose up two octaves for display)
                // 8vb means "play one octave lower than written", so we write higher and mark with 8vb
                if (midi < 24) return { shift: 2, label: '15vb' };
                
                // 8vb: Below C2 (MIDI 24-35) - very low notes (transpose up one octave for display)
                // 8vb means "play one octave lower than written", so we write higher and mark with 8vb
                if (midi < 36) return { shift: 1, label: '8vb' };
                
                // 8va: Above B4 (MIDI 72-83) - high notes for bass clef (transpose down one octave for display)
                // Note: In bass clef, 8va above the staff means "play one octave higher" than written
                // So we write them one octave lower and mark with 8va
                if (midi > 83) return { shift: -2, label: '15va' }; // Very high - use 15va (two octaves)
                if (midi > 71) return { shift: -1, label: '8va' }; // High - use 8va (one octave)
                
                // Normal range: C2 to B4 (MIDI 36-71) - comfortable bass clef range
                return { shift: 0, label: null };
            } else {
                // Treble clef thresholds (default)
                // Comfortable range: C3 to B5 (MIDI 48-83)
                
                // 15va: C7 and above (MIDI 96+) - extremely high notes (transpose down two octaves)
                if (midi >= 96) return { shift: -2, label: '15va' };
                
                // 8va: C6 to B6 (MIDI 84-95) - very high notes (transpose down one octave)
                if (midi >= 84) return { shift: -1, label: '8va' };
                
                // 8vb: C2 to B2 (MIDI 36-47) - very low notes for treble clef (transpose up one octave)
                if (midi >= 36 && midi < 48) return { shift: 1, label: '8vb' };
                
                // 15vb: Below C2 (MIDI < 36) - extremely low notes (transpose up two octaves)
                if (midi < 36) return { shift: 2, label: '15vb' };
                
                // Normal range: C3 to B5 (MIDI 48-83) - comfortable treble clef range
                return { shift: 0, label: null };
            }
        }

        function transposeNoteForDisplay(note, octaveShift) {
            if (octaveShift === 0) return note;
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return note;
            const noteName = match[1];
            const octave = parseInt(match[2]) + octaveShift;
            return `${noteName}${octave}`;
        }

        // Separate notes into treble and bass clef, applying ottava logic
        // Notes C4 and above typically go in treble clef
        // Notes below C4 go in bass clef
        const trebleNotes = [];
        const bassNotes = [];

        // Process treble clef notes with ottava logic
        const trebleAllNotes = allNotes.filter(note => {
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return false;
            const octave = parseInt(match[2]);
            return octave >= 4;
        });
        
        // Apply ottava logic for treble clef notes
        if (trebleAllNotes.length > 0) {
            const noteOctaveInfo = trebleAllNotes.map(note => getOctaveShift(note, 'treble'));
            
            // Determine ottava handling (same logic as melodyGenerator.js)
            const uniqueOttavaTypes = new Set();
            noteOctaveInfo.forEach(info => {
                if (info && info.label) {
                    uniqueOttavaTypes.add(info.label);
                } else {
                    uniqueOttavaTypes.add(null);
                }
            });
            
            let shouldApplyOttava = false;
            let ottavaType = null;
            let ottavaShift = 0;
            
            // Case 1: All notes need the same ottava type
            if (uniqueOttavaTypes.size === 1 && !uniqueOttavaTypes.has(null)) {
                shouldApplyOttava = true;
                ottavaType = Array.from(uniqueOttavaTypes)[0];
                ottavaShift = noteOctaveInfo[0] ? noteOctaveInfo[0].shift : 0;
            } 
            // Case 2: Mixed ottava needs - check lowest note for treble clef
            else if (uniqueOttavaTypes.size > 1 || (uniqueOttavaTypes.size === 2 && uniqueOttavaTypes.has(null))) {
                let lowestMidi = Infinity;
                let lowestNoteIndex = -1;
                
                trebleAllNotes.forEach((note, idx) => {
                    try {
                        const midi = noteToMidi(note);
                        if (midi < lowestMidi) {
                            lowestMidi = midi;
                            lowestNoteIndex = idx;
                        }
                    } catch (e) {
                        // Skip if MIDI calculation fails
                    }
                });
                
                if (lowestNoteIndex >= 0 && noteOctaveInfo[lowestNoteIndex] && noteOctaveInfo[lowestNoteIndex].label) {
                    const lowestOttavaInfo = noteOctaveInfo[lowestNoteIndex];
                    if (lowestOttavaInfo.label.includes('va')) {
                        shouldApplyOttava = true;
                        ottavaType = '8va';
                        ottavaShift = -1;
                    }
                }
            }
            
            // Process treble notes with ottava applied if needed
            trebleAllNotes.forEach((note, idx) => {
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return;

                const displayNote = shouldApplyOttava 
                    ? transposeNoteForDisplay(note, ottavaShift)
                    : note;
                
                const displayMatch = displayNote.match(/^([A-G][#b]?)(\d+)$/);
                if (!displayMatch) return;
                
                const noteName = displayMatch[1];
                const octave = parseInt(displayMatch[2]);
            const vexFlowNote = `${noteName}/${octave}`;

                trebleNotes.push({ 
                    note: vexFlowNote, 
                    original: note,
                    ottavaType: shouldApplyOttava ? ottavaType : null
                });
            });
        }
        
        // Process bass clef notes (similar logic but check highest note for bass clef)
        const bassAllNotes = allNotes.filter(note => {
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return false;
            const octave = parseInt(match[2]);
            return octave < 4;
        });
        
        if (bassAllNotes.length > 0) {
            const noteOctaveInfo = bassAllNotes.map(note => getOctaveShift(note, 'bass'));
            
            const uniqueOttavaTypes = new Set();
            noteOctaveInfo.forEach(info => {
                if (info && info.label) {
                    uniqueOttavaTypes.add(info.label);
            } else {
                    uniqueOttavaTypes.add(null);
                }
            });
            
            let shouldApplyOttava = false;
            let ottavaType = null;
            let ottavaShift = 0;
            
            if (uniqueOttavaTypes.size === 1 && !uniqueOttavaTypes.has(null)) {
                shouldApplyOttava = true;
                ottavaType = Array.from(uniqueOttavaTypes)[0];
                ottavaShift = noteOctaveInfo[0] ? noteOctaveInfo[0].shift : 0;
            } 
            else if (uniqueOttavaTypes.size > 1 || (uniqueOttavaTypes.size === 2 && uniqueOttavaTypes.has(null))) {
                // For bass clef, check HIGHEST note (opposite of treble)
                let highestMidi = -Infinity;
                let highestNoteIndex = -1;
                
                bassAllNotes.forEach((note, idx) => {
                    try {
                        const midi = noteToMidi(note);
                        if (midi > highestMidi) {
                            highestMidi = midi;
                            highestNoteIndex = idx;
                        }
                    } catch (e) {
                        // Skip if MIDI calculation fails
                    }
                });
                
                if (highestNoteIndex >= 0 && noteOctaveInfo[highestNoteIndex] && noteOctaveInfo[highestNoteIndex].label) {
                    const highestOttavaInfo = noteOctaveInfo[highestNoteIndex];
                    if (highestOttavaInfo.label.includes('vb')) {
                        shouldApplyOttava = true;
                        ottavaType = '8vb';
                        ottavaShift = 1;
                    }
                }
            }
            
            // Process bass notes with ottava applied if needed
            bassAllNotes.forEach((note, idx) => {
                const match = note.match(/^([A-G][#b]?)(\d+)$/);
                if (!match) return;
                
                const displayNote = shouldApplyOttava 
                    ? transposeNoteForDisplay(note, ottavaShift)
                    : note;
                
                const displayMatch = displayNote.match(/^([A-G][#b]?)(\d+)$/);
                if (!displayMatch) return;
                
                const noteName = displayMatch[1];
                const octave = parseInt(displayMatch[2]);
                const vexFlowNote = `${noteName}/${octave}`;
                
                bassNotes.push({ 
                    note: vexFlowNote, 
                    original: note,
                    ottavaType: shouldApplyOttava ? ottavaType : null
                });
            });
        }

        // Reset canvas dimensions using device pixel ratio and actual container width
        // This avoids browser CSS downscaling that can make glyphs look compressed
        const parentWidth = (canvas.parentElement && canvas.parentElement.clientWidth) ? canvas.parentElement.clientWidth : 170;
        // Clamp display width to the card's inner width range (prevents overflow and squish)
        const displayWidth = Math.max(160, Math.min(parentWidth, 170));

        // Set canvas height BEFORE clearing or rendering (changing height clears canvas)
        // Check if we need extra height for ottava brackets
        const trebleNeedsOttava = trebleNotes.length > 0 && trebleNotes[0].ottavaType;
        const bassNeedsOttava = bassNotes.length > 0 && bassNotes[0].ottavaType;
        const needsExtraHeight = trebleNeedsOttava || bassNeedsOttava;
        
        // Use a shorter height to avoid a tall, stretched appearance on narrow cards
        const displayHeight = (trebleNotes.length > 0 && bassNotes.length > 0)
            ? (needsExtraHeight ? 195 : 175)
            : (needsExtraHeight ? 125 : 110);
        
        // Render at exact CSS size to avoid aspect distortion
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        // Match CSS size to display size (no additional CSS scaling)
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;

        // Clear canvas completely
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Create renderer
        const renderer = new Renderer(canvas, Renderer.Backends.CANVAS);
        renderer.resize(canvas.width, canvas.height);
        const ctx = renderer.getContext();

        let yOffset = 10;

        // Calculate stave width based on actual display width (minimize unused margins)
        // Leave small margins to avoid clipping clef/key signatures
        const horizontalMargin = 6;
        const staveWidth = Math.max(120, displayWidth - (horizontalMargin * 2));
        const staveX = Math.max(2, horizontalMargin - 1);

        // Render treble clef if there are treble notes
        if (trebleNotes.length > 0) {
            const stave = new Stave(staveX, yOffset, staveWidth);
            stave.addClef('treble');

            // Add key signature to the stave - VexFlow handles minor keys better via relative major
            const vexFlowKey = getVexFlowKeySignature(currentKey);
            try {
                stave.addKeySignature(vexFlowKey);
            } catch (e) {
                // Fallback: if VexFlow doesn't support the key, try without key signature
                // Continue without key signature - accidentals will still be shown per-note
            }

            // Try to move the starting X for notes to the right (more space after clef/key signature)
            try {
                if (typeof stave.setNoteStartX === 'function') {
                    // Slightly reduce offset to nudge notes left a bit
                    stave.setNoteStartX(stave.getX() + 40);
                }
            } catch (e) {
                // Ignore if API not available
            }

            stave.setContext(ctx).draw();

            // Create a single chord (all notes stacked)
            const keys = trebleNotes.map(n => n.note);
            const staveNote = new StaveNote({ clef: 'treble', keys: keys, duration: 'w' });
            // Push notes to the right of the clef for better centering
            try {
                // Positive x-shift moves the glyphs to the right
                staveNote.setXShift(18);
            } catch (e) {
                // Ignore if API differs
            }

            // Add accidentals only for notes NOT in the key signature
            trebleNotes.forEach((n, idx) => {
                const noteName = n.original.replace(/\d+$/, ''); // Remove octave
                const naturalNote = noteName.replace(/[#b]/, ''); // Get base note without accidental
                const hasSharp = noteName.includes('#');
                const hasFlat = noteName.includes('b');

                // Determine if this note matches what the key signature expects
                const isSharpInKey = keySignature.sharps.has(naturalNote);
                const isFlatInKey = keySignature.flats.has(naturalNote);
                
                // Only add an accidental if:
                // 1. The note has an accidental AND it doesn't match what's in the key signature
                // 2. The note is natural BUT the key signature expects it sharp/flat (needs natural sign)
                
                if (hasSharp) {
                    // Note has a sharp - only add accidental if natural note is NOT sharp in key signature
                    if (!isSharpInKey) {
                        staveNote.addModifier(new Accidental('#'), idx);
                    }
                    // If isSharpInKey is true, no accidental needed - key signature already covers it
                } else if (hasFlat) {
                    // Note has a flat - only add accidental if natural note is NOT flat in key signature
                    if (!isFlatInKey) {
                        staveNote.addModifier(new Accidental('b'), idx);
                    }
                    // If isFlatInKey is true, no accidental needed - key signature already covers it
                } else {
                    // Natural note (no accidental) - need natural sign if key signature expects sharp/flat
                    if (isSharpInKey || isFlatInKey) {
                        staveNote.addModifier(new Accidental('n'), idx);
                    }
                    // If not in key signature, no accidental needed
                }
            });

            const voice = new Voice({ num_beats: 4, beat_value: 4 });
            voice.addTickables([staveNote]);
            // Format to fit notes within stave width (125px)
            new Formatter().joinVoices([voice]).format([voice], staveWidth);
            voice.draw(ctx, stave);
            
            // Draw ottava bracket if needed (treble clef - above the stave)
            if (trebleNotes.length > 0 && trebleNotes[0].ottavaType) {
                try {
                    const ottavaType = trebleNotes[0].ottavaType;
                    const position = ottavaType.includes('va') ? 1 : -1; // 1 = above, -1 = below
                    const textBracket = new TextBracket({
                        start: staveNote,
                        stop: staveNote,
                        text: ottavaType,
                        position: position
                    });
                    textBracket.setContext(ctx).draw();
                } catch (e) {
                }
            }

            // Inter-staff spacing tuned to avoid overlap/clipping at this height
            yOffset += 70;
        }

        // Render bass clef if there are bass notes
        if (bassNotes.length > 0) {
            const stave = new Stave(staveX, yOffset, staveWidth);
            stave.addClef('bass');

            // Add key signature to the stave - VexFlow handles minor keys better via relative major
            const vexFlowKey = getVexFlowKeySignature(currentKey);
            try {
                stave.addKeySignature(vexFlowKey);
            } catch (e) {
                // Fallback: if VexFlow doesn't support the key, try without key signature
                // Continue without key signature - accidentals will still be shown per-note
            }

            // Try to move the starting X for notes to the right (more space after clef/key signature)
            try {
                if (typeof stave.setNoteStartX === 'function') {
                    stave.setNoteStartX(stave.getX() + 40);
                }
            } catch (e) {
                // Ignore if API not available
            }

            stave.setContext(ctx).draw();

            // Create a single chord (all notes stacked)
            const keys = bassNotes.map(n => n.note);
            const staveNote = new StaveNote({ clef: 'bass', keys: keys, duration: 'w' });
            // Push notes to the right of the clef for better centering
            try {
                staveNote.setXShift(18);
            } catch (e) {
                // Ignore if API differs
            }

            // Add accidentals only for notes NOT in the key signature
            bassNotes.forEach((n, idx) => {
                const noteName = n.original.replace(/\d+$/, ''); // Remove octave (e.g., "A#4" -> "A#")
                const naturalNote = noteName.replace(/[#b]/, ''); // Get base note without accidental (e.g., "A#" -> "A")
                const hasSharp = noteName.includes('#');
                const hasFlat = noteName.includes('b');

                // Determine if this note matches what the key signature expects
                const isSharpInKey = keySignature.sharps.has(naturalNote);
                const isFlatInKey = keySignature.flats.has(naturalNote);
                
                // Only add an accidental if:
                // 1. The note has an accidental AND it doesn't match what's in the key signature
                // 2. The note is natural BUT the key signature expects it sharp/flat (needs natural sign)
                
                if (hasSharp) {
                    // Note has a sharp - only add accidental if natural note is NOT sharp in key signature
                    if (!isSharpInKey) {
                        staveNote.addModifier(new Accidental('#'), idx);
                    }
                    // If isSharpInKey is true, no accidental needed - key signature already covers it
                } else if (hasFlat) {
                    // Note has a flat - only add accidental if natural note is NOT flat in key signature
                    if (!isFlatInKey) {
                        staveNote.addModifier(new Accidental('b'), idx);
                    }
                    // If isFlatInKey is true, no accidental needed - key signature already covers it
                } else {
                    // Natural note (no accidental) - need natural sign if key signature expects sharp/flat
                    if (isSharpInKey || isFlatInKey) {
                        staveNote.addModifier(new Accidental('n'), idx);
                    }
                    // If not in key signature, no accidental needed
                }
            });

            const voice = new Voice({ num_beats: 4, beat_value: 4 });
            voice.addTickables([staveNote]);
            // Format to fit notes within stave width (125px)
            new Formatter().joinVoices([voice]).format([voice], staveWidth);
            voice.draw(ctx, stave);
            
            // Draw ottava bracket if needed (bass clef - below the stave)
            if (bassNotes.length > 0 && bassNotes[0].ottavaType) {
                try {
                    const ottavaType = bassNotes[0].ottavaType;
                    const position = ottavaType.includes('vb') ? -1 : 1; // -1 = below, 1 = above
                    const textBracket = new TextBracket({
                        start: staveNote,
                        stop: staveNote,
                        text: ottavaType,
                        position: position
                    });
                    textBracket.setContext(ctx).draw();
                } catch (e) {
                }
            }
        }
    } catch (error) {
        // Show error message on canvas
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ff0000';
        ctx.font = '12px Arial';
        ctx.fillText('Error rendering staff notation', 10, 30);
        ctx.fillText(error.message, 10, 50);
        if (error.stack) {
            ctx.fillText(error.stack.split('\n')[0], 10, 70);
        }
    }
}

/**
 * Render chord staff notation with provided chord data
 * Wrapper function that accepts chord data directly (for Composition Studio)
 * @param {HTMLCanvasElement} canvas - Canvas element to render on
 * @param {Object} chordData - Chord data object with notes, lhType, etc.
 * @param {string} key - Current key (e.g., "C", "Dm")
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
        const lhNotes = chordData.lhType && chordData.lhType !== 'off' ?
            getLHNotes(
                chordData.root,
                chordData.lhType,
                chordData.lhInversion || 0,
                key,
                chordData.lhOctaveShift || 0,
                chordData.type,
                getEnharmonicPreference()
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

// ============================================================================
// Progression Display and Visualization
// ============================================================================

// Create singleton HarmonyAnalyzer instance
const harmonyAnalyzer = new HarmonyAnalyzer();

/**
 * PHASE 3.3/3.4: Add pattern highlighting badges above progression with collapsible categories
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
 * Create an enhanced pattern badge element
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
 * @param {Array} positions - Array of chord positions to highlight
 */
function highlightPatternChordsByPositions(positions) {
    // Clear existing highlights
    clearPatternHighlights();

    if (!positions || positions.length === 0) return;

    // Use specific selector for chord card wrappers with data-chord-index
    const chordCards = document.querySelectorAll('.chord-card-wrapper[data-chord-index]');


    positions.forEach(pos => {
        // Find card by data-chord-index attribute
        const card = document.querySelector(`.chord-card-wrapper[data-chord-index="${pos}"]`);

        if (card) {
            card.classList.add('pattern-highlight');
            // Apply styles directly to ensure they work
            card.style.setProperty('box-shadow', '0 0 15px rgba(168, 85, 247, 0.6)', 'important');
            card.style.setProperty('border-color', '#a855f7', 'important');
            card.style.setProperty('border-width', '2px', 'important');
        } else {
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

/**
 * PHASE 3.3: Render simplified chord sequence view
 * Compact cards that can expand inline to show detailed controls
 * @param {HTMLElement} container - Container to insert the view into
 * @param {Array} progressionData - Array of chord objects
 * @param {string} key - Current key
 * @param {Object} options - Rendering options
 * @param {boolean} options.showActionButtons - Whether to show Add/Clear buttons (default: true)
 */
function renderSimplifiedChordSequence(container, progressionData, key, options = {}) {
    const { showActionButtons = true } = options;

    if (!progressionData || progressionData.length === 0) return;

    // Render cards directly into the grid container (like Composition Studio)
    // Clear existing content
    container.innerHTML = '';

    // Add "Add Chord" and "Clear All" buttons as first grid item
    if (showActionButtons) {
        // Determine which toggle function to use based on container
        const isMelodyComposer = container.id === 'melody-progression-visualization';
        const toggleFunction = isMelodyComposer ? 'toggleQuickAddChordMelody' : 'toggleQuickAddChord';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'chord-card-wrapper flex flex-col justify-center items-center gap-2 p-2 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-xl';
        buttonContainer.innerHTML = `
            <button onclick="window.${toggleFunction} && window.${toggleFunction}()"
                    class="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Add chord">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Add
            </button>
            <button onclick="window.clearProgression && window.clearProgression()"
                    class="w-full px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Clear all">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"></path>
                </svg>
                Clear
            </button>
        `;
        container.appendChild(buttonContainer);
    }

    // Create card wrappers for each chord
    progressionData.forEach((chord, index) => {
        const wrapper = createChordCardWrapper(chord, index, key);
        container.appendChild(wrapper);
    });

    // Update shift classes based on expanded state
    // Use a small delay to ensure all cards are rendered before calculating shifts
    requestAnimationFrame(() => {
        updateCardShifts();
    });

    // Make container sortable
    initializeSimplifiedSortable(container);
}

/**
 * Render progression display for the Chord Builder tab
 * This is called by the chordBuilder module to render cards in its "Current Chord Progression" panel
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
            headerToggle.innerHTML = '';
            headerToggle.className = 'hidden ml-2';
        }
    }

    // Create container for cards
    const gridContainer = document.createElement('div');
    gridContainer.id = `${container.id || 'builder-progression-visualization'}-cards-grid`;

    // Branch based on view mode (same pattern as Composition Studio)
    if (progressionViewMode === 'section' && hasSections) {
        // Section View Mode: show section picker and filtered cards
        gridContainer.className = 'flex flex-col gap-2';
        renderSectionViewModeForBuilder(gridContainer, progressionData, key, sections, showActionButtons);
    } else if (progressionViewMode === 'scroll') {
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

    const isScrollView = progressionViewMode === 'scroll';
    const isSectionView = progressionViewMode === 'section';

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
                const isActive = b.getAttribute('data-mode') === progressionViewMode;
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

    // Create cards container
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'section-filtered-cards scroll-view-container flex flex-nowrap gap-2 overflow-x-auto pb-2';
    cardsContainer.style.cssText = 'scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;';

    // Get selected section IDs or show all if none selected
    const selectedIds = selectedSectionIds.size > 0 ? selectedSectionIds : new Set(sections.map(s => s.id));

    // Build combined list including pseudo-sections for ungrouped chords
    const allSectionsWithPseudo = buildSectionChipsWithUngrouped(sections);

    // Filter to only selected sections
    const visibleSections = allSectionsWithPseudo.filter(s => selectedIds.has(s.id));

    // Render section-grouped cards using the scroll view approach
    renderSectionAwareCardsScroll(cardsContainer, progressionData, key, {
        showActionButtons: showActionButtons,
        filterSections: visibleSections
    });

    gridContainer.appendChild(cardsContainer);

    // Initialize sortable on section cards areas
    initializeSectionCardsAreaSortables(cardsContainer);
}

// ============================================================================
// SONG SECTIONS UI - INLINE OVERLAY APPROACH
// ============================================================================
// Sections are rendered as colored background overlays behind sequential chord cards
// maintaining the natural left-to-right flow of the progression.
// Cards stay in a single horizontal grid - sections are indicated by colored
// backgrounds and small label badges above the first card of each section.

/**
 * Render flat cards (no sections) into a grid container
 * @param {HTMLElement} gridContainer - Grid container element
 * @param {Array} progressionData - Chord progression data
 * @param {string} key - Current key
 * @param {Object} options - Rendering options
 */
function renderFlatCards(gridContainer, progressionData, key, options = {}) {
    const { showActionButtons = true } = options;

    if (!progressionData || progressionData.length === 0) return;

    // Add "Add Chord", "Section" and "Clear All" buttons as first grid item
    if (showActionButtons) {
        const isMelodyComposer = gridContainer.id?.includes('melody');
        const toggleFunction = isMelodyComposer ? 'toggleQuickAddChordMelody' : 'toggleQuickAddChord';
        const containerId = gridContainer.id || 'melody-progression-visualization';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'chord-card-wrapper flex flex-col justify-center items-center gap-1.5 p-2 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-xl';
        buttonContainer.innerHTML = `
            <button onclick="window.${toggleFunction} && window.${toggleFunction}()"
                    class="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Add chord to progression">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Add
            </button>
            <button onclick="window.showAddSectionMenu && window.showAddSectionMenu(event, '${containerId}')"
                    class="w-full px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Select adjacent chords, then add to a section">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
                Section
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

    // Create card wrappers for each chord
    let cardsCreated = 0;
    progressionData.forEach((chord, index) => {
        const wrapper = createChordCardWrapper(chord, index, key);
        // CRITICAL: Clear any stale positioning styles that could cause grid overlap
        // This ensures CSS Grid auto-placement works correctly
        wrapper.style.gridColumn = '';
        wrapper.style.gridRow = '';
        wrapper.style.position = '';
        wrapper.style.left = '';
        wrapper.style.top = '';
        wrapper.style.transform = '';
        gridContainer.appendChild(wrapper);
        cardsCreated++;
    });

    // Update shift classes after the browser has had a chance to lay out the grid
    requestAnimationFrame(() => {
        updateCardShifts();
    });
}

// ============================================================================
// VIEW MODE UI COMPONENTS
// ============================================================================

/**
 * Create view mode toggle UI component
 * @returns {HTMLElement} Toggle container element
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
            // Update notation for section view
            updateNotationForSelectedSections();
        });
    });

    return container;
}

/**
 * Create compact view mode toggle for header placement
 * Includes "View:" label with Scroll/Section text buttons
 * @returns {HTMLElement} Compact toggle container element
 */
function createCompactViewModeToggle() {
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
            // Update notation for section view
            updateNotationForSelectedSections();
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

/**
 * Create section chip element for section picker bar
 * @param {Object} section - Section object
 * @param {boolean} isSelected - Whether section is selected
 * @param {Function} onClick - Click handler
 * @returns {HTMLElement} Section chip element
 */
function createSectionChip(section, isSelected, onClick) {
    const chip = document.createElement('button');
    const chordCount = section.chordIndices?.length || 0;
    const sectionColor = section.color || '#c084fc';

    // Much stronger visual difference for selected state
    chip.className = `section-chip flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold
                      transition-all duration-200 flex-shrink-0 cursor-pointer
                      ${isSelected ? 'ring-2 ring-offset-2 shadow-lg transform scale-105' : 'hover:scale-102'}`;
    chip.style.cssText = `
        background: ${isSelected ? hexToRgba(sectionColor, 0.35) : hexToRgba(sectionColor, 0.08)};
        border: 2px solid ${isSelected ? sectionColor : hexToRgba(sectionColor, 0.25)};
        color: ${isSelected ? '#1f2937' : '#6b7280'};
        ${isSelected ? `--tw-ring-color: ${sectionColor}; box-shadow: 0 4px 12px ${hexToRgba(sectionColor, 0.4)};` : ''}
    `;

    chip.innerHTML = `
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background: ${sectionColor}; ${isSelected ? 'box-shadow: 0 0 8px ' + sectionColor + ';' : ''}"></span>
        <span class="truncate max-w-[100px]">${section.label || 'Section'}</span>
        <span class="text-[10px] ${isSelected ? 'font-bold' : 'opacity-70'}">(${chordCount})</span>
        ${isSelected ? '<svg class="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
    `;

    chip.onclick = (e) => onClick(section.id, e.shiftKey, e.ctrlKey || e.metaKey);
    chip.setAttribute('data-section-id', section.id);

    return chip;
}

/**
 * Create section picker bar for section view mode
 * Includes "All" button at left, real sections, and "No Group X" pseudo-sections for ungrouped chords
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
    prevBtn.onclick = () => navigateToPreviousSection();
    bar.appendChild(prevBtn);

    // "All" button - moved to left side, right after prev button
    const allBtn = document.createElement('button');
    allBtn.className = `px-2.5 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 flex-shrink-0
                        ${selectedSectionIds.size === 0 ? 'bg-indigo-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`;
    allBtn.textContent = 'All';
    allBtn.title = 'Show all chords';
    allBtn.onclick = () => {
        clearSectionSelection();
        renderProgressionDisplay('melody-progression-visualization', true);
        updateNotationForSelectedSections();
    };
    bar.appendChild(allBtn);

    // Section chips container
    const chipsContainer = document.createElement('div');
    chipsContainer.className = 'flex items-center gap-1.5 flex-1 overflow-x-auto py-1 px-1';
    chipsContainer.style.scrollbarWidth = 'none'; // Hide scrollbar

    // Build combined list of real sections and ungrouped pseudo-sections
    const allChips = buildSectionChipsWithUngrouped(sections);

    allChips.forEach(chipData => {
        const isSelected = selectedSectionIds.has(chipData.id);
        const chip = createSectionChip(chipData, isSelected, handleSectionChipClick);
        chipsContainer.appendChild(chip);
    });

    bar.appendChild(chipsContainer);

    // Next section button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'section-nav-btn p-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0';
    nextBtn.innerHTML = `<svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
    </svg>`;
    nextBtn.title = 'Next section (→)';
    nextBtn.onclick = () => navigateToNextSection();
    bar.appendChild(nextBtn);

    return bar;
}

/**
 * Build array of section chip data including both real sections and "No Group X" pseudo-sections
 * for ungrouped chords, sorted by chord position
 * @param {Array} sections - Real sections from compositionState
 * @returns {Array} Combined array of section/pseudo-section objects for chips
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

    // Combine real sections and pseudo-sections, sort by first chord index
    const allSections = [...sections, ...pseudoSections];
    allSections.sort((a, b) => {
        const aMin = Math.min(...(a.chordIndices || [Infinity]));
        const bMin = Math.min(...(b.chordIndices || [Infinity]));
        return aMin - bMin;
    });

    return allSections;
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
    // Use combined list including pseudo-sections for proper range selection
    const allSections = buildSectionChipsWithUngrouped(realSections);

    if (isShiftClick) {
        // Shift+click: select range of adjacent sections
        selectSectionRange(sectionId, allSections);
    } else if (isCtrlClick) {
        // Ctrl+click: toggle this section in the selection
        if (selectedSectionIds.has(sectionId)) {
            selectedSectionIds.delete(sectionId);
        } else {
            selectedSectionIds.add(sectionId);
        }
    } else {
        // Normal click: toggle selection or select single
        if (selectedSectionIds.has(sectionId) && selectedSectionIds.size === 1) {
            // Clicking the only selected section - deselect it
            selectedSectionIds.delete(sectionId);
        } else {
            // Select only this section
            selectedSectionIds.clear();
            selectedSectionIds.add(sectionId);
        }
    }


    // Re-render with new selection
    renderProgressionDisplay('melody-progression-visualization', true);

    // Update notation to show only selected section measures
    updateNotationForSelectedSections();
}

/**
 * Navigate to previous section (includes pseudo-sections like "No Group X")
 * Going "before" the first section selects "All" (clears selection)
 */
function navigateToPreviousSection() {
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    const realSections = compositionState.getSections();
    // Get all sections including pseudo-sections, already sorted by position
    const allSections = buildSectionChipsWithUngrouped(realSections);
    if (allSections.length === 0) return;

    const selectedIds = getSelectedSectionIds();
    if (selectedIds.length === 0) {
        // Already at "All" - select last section
        selectSectionInView(allSections[allSections.length - 1].id);
    } else {
        // Find current section index and go to previous
        const currentId = selectedIds[0];
        const currentIndex = allSections.findIndex(s => s.id === currentId);
        if (currentIndex === -1) {
            // Current selection not found, go to "All"
            clearSectionSelection();
        } else if (currentIndex === 0) {
            // At first section - go to "All" (clear selection)
            clearSectionSelection();
        } else {
            const prevIndex = currentIndex - 1;
            selectSectionInView(allSections[prevIndex].id);
        }
    }

    renderProgressionDisplay('melody-progression-visualization', true);
    updateNotationForSelectedSections();
}

/**
 * Navigate to next section (includes pseudo-sections like "No Group X")
 */
function navigateToNextSection() {
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    const realSections = compositionState.getSections();
    // Get all sections including pseudo-sections, already sorted by position
    const allSections = buildSectionChipsWithUngrouped(realSections);
    if (allSections.length === 0) return;

    const selectedIds = getSelectedSectionIds();
    if (selectedIds.length === 0) {
        // No selection - select first section
        selectSectionInView(allSections[0].id);
    } else {
        // Find current section index and go to next
        const currentId = selectedIds[selectedIds.length - 1];
        const currentIndex = allSections.findIndex(s => s.id === currentId);
        if (currentIndex === -1) {
            // Current selection not found, select first
            selectSectionInView(allSections[0].id);
        } else {
            const nextIndex = Math.min(allSections.length - 1, currentIndex + 1);
            selectSectionInView(allSections[nextIndex].id);
        }
    }

    renderProgressionDisplay('melody-progression-visualization', true);
    updateNotationForSelectedSections();
}

/**
 * Update notation display to show only measures for selected sections
 */
function updateNotationForSelectedSections() {

    if (progressionViewMode !== 'section') {
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
 * Render section view mode with filtered cards
 * @param {HTMLElement} container - Container element
 * @param {Array} progressionData - Chord progression data
 * @param {string} key - Current key
 * @param {Array} sections - Array of section objects
 */
function renderSectionViewMode(container, progressionData, key, sections) {
    // Create section picker bar
    const pickerBar = createSectionPickerBar(sections);
    container.appendChild(pickerBar);

    // Create cards container with horizontal scroll wrapper
    const cardsWrapper = document.createElement('div');
    cardsWrapper.className = 'section-cards-wrapper relative overflow-x-auto custom-scrollbar scroll-view-container';
    cardsWrapper.id = 'section-cards-wrapper';
    // Add inline styles for smooth scrolling
    cardsWrapper.style.cssText = `
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
        padding-bottom: 8px;
    `;

    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'section-filtered-cards flex flex-nowrap items-start gap-2 transition-all duration-300';
    cardsContainer.id = `${container.id}-cards-grid`;

    // Collect visible chord indices based on selected sections
    let visibleChordIndices = new Set();
    const selectedIds = getSelectedSectionIds();

    // Build the combined sections list (including pseudo-sections for ungrouped chords)
    const allSectionsWithPseudo = buildSectionChipsWithUngrouped(sections);

    if (selectedIds.length === 0) {
        // No section selected - show all cards
        progressionData.forEach((_, idx) => visibleChordIndices.add(idx));
    } else {
        // Show only cards from selected sections (including pseudo-sections)
        selectedIds.forEach(sectionId => {
            // Look up in combined list that includes pseudo-sections
            const section = allSectionsWithPseudo.find(s => s.id === sectionId);
            if (section && section.chordIndices) {
                section.chordIndices.forEach(idx => visibleChordIndices.add(idx));
            }
        });
    }

    // Add "Add Chord", "Section" and "Clear All" buttons
    const isMelodyComposer = container.id?.includes('melody');
    const toggleFunction = isMelodyComposer ? 'toggleQuickAddChordMelody' : 'toggleQuickAddChord';
    const containerId = container.id || 'progression-visualization';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'chord-card-wrapper flex flex-col flex-shrink-0 justify-center items-center gap-1.5 p-2 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-xl';
    buttonContainer.style.scrollSnapAlign = 'start';
    buttonContainer.innerHTML = `
        <button onclick="window.${toggleFunction} && window.${toggleFunction}()"
                class="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                title="Add chord to progression">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Add
        </button>
        <button onclick="window.showAddSectionMenu && window.showAddSectionMenu(event, '${containerId}')"
                class="w-full px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                title="Select adjacent chords, then add to a section">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
            Section
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
    cardsContainer.appendChild(buttonContainer);

    // Render filtered cards grouped by sections (with outlines and labels)
    let animationIndex = 0;

    // Render each section/pseudo-section that has visible chords
    // (allSectionsWithPseudo was already built above for filtering)
    allSectionsWithPseudo.forEach(sectionData => {
        // Check if any of this section's chords are visible
        const visibleInSection = sectionData.chordIndices.filter(idx => visibleChordIndices.has(idx));
        if (visibleInSection.length === 0) return;

        // Create section container with outline and label
        const sectionContainer = document.createElement('div');
        sectionContainer.className = 'section-unified-container inline-flex flex-col flex-shrink-0 rounded-lg overflow-visible section-view-card';
        sectionContainer.setAttribute('data-section-id', sectionData.id);
        sectionContainer.style.cssText = `animation-delay: ${animationIndex * 50}ms; scroll-snap-align: start;`;

        // Banner header with section label
        const banner = document.createElement('div');
        banner.className = 'section-banner flex items-center gap-2 px-2 py-1 rounded-t-lg cursor-grab active:cursor-grabbing';
        banner.style.backgroundColor = sectionData.color || '#9ca3af';
        banner.setAttribute('data-section-id', sectionData.id);

        const isPseudoSection = sectionData.isPseudoSection;
        banner.innerHTML = `
            <svg class="w-3 h-3 text-white/70 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z"/>
            </svg>
            <span class="text-white text-xs font-semibold flex-grow">${sectionData.label || 'Section'}</span>
            ${!isPseudoSection ? `
                <button class="section-menu-btn p-0.5 rounded hover:bg-white/20 transition"
                        onclick="event.stopPropagation(); window.showSectionMenu && window.showSectionMenu(event, '${sectionData.id}')"
                        title="Section options">
                    <svg class="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                    </svg>
                </button>
            ` : ''}
        `;
        sectionContainer.appendChild(banner);

        // Cards area with colored background
        const cardsArea = document.createElement('div');
        cardsArea.className = 'section-cards-area items-start gap-2 p-2 rounded-b-lg';
        cardsArea.style.display = 'flex';
        cardsArea.style.flexDirection = 'row';
        cardsArea.style.flexWrap = 'wrap';
        cardsArea.style.backgroundColor = (sectionData.color || '#9ca3af') + '20';
        cardsArea.style.borderLeft = `3px solid ${sectionData.color || '#9ca3af'}`;
        cardsArea.style.borderRight = `3px solid ${sectionData.color || '#9ca3af'}`;
        cardsArea.style.borderBottom = `3px solid ${sectionData.color || '#9ca3af'}`;
        cardsArea.setAttribute('data-section-id', sectionData.id);

        // Render cards in this section
        visibleInSection.forEach(chordIdx => {
            if (chordIdx < progressionData.length) {
                const chord = progressionData[chordIdx];
                const wrapper = createChordCardWrapper(chord, chordIdx, key);
                wrapper.setAttribute('data-in-section', sectionData.id);
                cardsArea.appendChild(wrapper);
            }
        });

        sectionContainer.appendChild(cardsArea);
        cardsContainer.appendChild(sectionContainer);
        animationIndex++;
    });


    cardsWrapper.appendChild(cardsContainer);
    container.appendChild(cardsWrapper);

    // Initialize sortable on the main container (for section dragging)
    initializeSimplifiedSortable(cardsContainer);

    // Also initialize sortable on each section's cards area for card dragging within sections
    initializeSectionCardsAreaSortables(cardsContainer);

}

/**
 * Initialize Sortable on each section-cards-area for dragging cards within and between sections
 * @param {HTMLElement} container - The container with section-unified-containers
 */
function initializeSectionCardsAreaSortables(container) {
    if (typeof Sortable === 'undefined') {
        console.warn('[SectionView] Sortable not available');
        return;
    }

    const sectionContainers = container.querySelectorAll('.section-unified-container');

    sectionContainers.forEach(sectionContainer => {
        const cardsArea = sectionContainer.querySelector('.section-cards-area');
        if (!cardsArea) return;

        const sectionId = cardsArea.getAttribute('data-section-id');

        // Destroy existing sortable if any
        if (cardsArea.sortableInstance) {
            cardsArea.sortableInstance.destroy();
        }

        // Create sortable for this section's cards area
        cardsArea.sortableInstance = new Sortable(cardsArea, {
            group: {
                name: 'section-cards',
                pull: true,
                put: true  // Accept cards from other section-cards areas
            },
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            handle: '.drag-handle',
            draggable: '.chord-card-wrapper[data-chord-index]',
            swapThreshold: 0.65,
            onEnd: function(evt) {
                // Handle card reordering within section or moving between sections
                handleCardDragWithinSection(evt, sectionId);
            },
            onAdd: function(evt) {
                // Card was added from another section
                handleCardDragWithinSection(evt, evt.from.getAttribute('data-section-id'));
            }
        });
    });
}

/**
 * Render scroll view mode with horizontal scroll
 * @param {HTMLElement} gridContainer - Grid container element
 * @param {Array} progressionData - Chord progression data
 * @param {string} key - Current key
 * @param {Object} options - Rendering options
 */
function renderScrollViewMode(gridContainer, progressionData, key, options = {}) {
    // Apply scroll view styles
    gridContainer.className = 'scroll-view-container flex flex-nowrap items-start gap-2 overflow-x-auto pb-2';
    gridContainer.style.cssText = `
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        scrollbar-color: #cbd5e1 transparent;
    `;

    // Use section-aware or flat rendering with scroll snap
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    const hasSections = compositionState && compositionState.getSections().length > 0;

    if (hasSections) {
        renderSectionAwareCardsScroll(gridContainer, progressionData, key, options);
    } else {
        renderFlatCardsScroll(gridContainer, progressionData, key, options);
    }
}

/**
 * Render section-aware cards in scroll mode
 * Same as renderSectionAwareCards but with scroll-snap styles
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
                    class="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Add
            </button>
            <button onclick="window.showAddSectionMenu && window.showAddSectionMenu(event, '${containerId}')"
                    class="w-full px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
                Section
            </button>
            <button onclick="window.clearProgression && window.clearProgression()"
                    class="w-full px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"></path>
                </svg>
                Clear
            </button>
        `;
        gridContainer.appendChild(buttonContainer);
    }

    // Track if we have any sections and ungrouped chords
    const hasSections = sections.length > 0;
    let ungroupedZone = null;

    // Check if there are any ungrouped chords (chords not in any section)
    const hasUngroupedChords = progressionData.some((_, idx) => !chordToSection.has(idx));

    // Create ungrouped zone only if there are sections AND ungrouped chords
    if (hasSections && hasUngroupedChords) {
        ungroupedZone = document.createElement('div');
        ungroupedZone.className = 'ungrouped-drop-zone flex flex-col rounded-lg overflow-visible flex-shrink-0';
        ungroupedZone.style.cssText = `
            scroll-snap-align: start;
            min-width: 80px;
            min-height: 100px;
            background: rgba(156, 163, 175, 0.1);
            border: 2px dashed #9ca3af;
            border-radius: 12px;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: center;
            justify-content: flex-start;
        `;

        // Label for ungrouped zone
        const label = document.createElement('div');
        label.style.cssText = `
            font-size: 10px;
            color: #6b7280;
            text-align: center;
            padding: 2px 6px;
            background: rgba(156, 163, 175, 0.2);
            border-radius: 4px;
            white-space: nowrap;
        `;
        label.textContent = 'Ungrouped';
        ungroupedZone.appendChild(label);

        // Container for ungrouped cards
        const ungroupedCards = document.createElement('div');
        ungroupedCards.className = 'ungrouped-cards-area flex flex-wrap gap-2';
        ungroupedCards.style.cssText = 'min-height: 60px; width: 100%;';
        ungroupedZone.appendChild(ungroupedCards);

        gridContainer.appendChild(ungroupedZone);
    }

    // Render cards in sequence with scroll snap
    let i = 0;
    while (i < progressionData.length) {
        const section = chordToSection.get(i);

        if (section) {
            // This card is in a section - render the entire section as a unified container
            const sectionContainer = createUnifiedSectionContainer(section, progressionData, key);
            sectionContainer.style.scrollSnapAlign = 'start';
            sectionContainer.style.flexShrink = '0';
            gridContainer.appendChild(sectionContainer);

            // Skip all cards in this section
            const maxIndex = Math.max(...section.chordIndices);
            i = maxIndex + 1;
        } else {
            // Ungrouped card - render in ungrouped zone if it exists, otherwise directly in grid
            const chord = progressionData[i];
            const wrapper = createChordCardWrapper(chord, i, key);
            wrapper.style.scrollSnapAlign = 'start';
            wrapper.style.flexShrink = '0';

            if (ungroupedZone) {
                const ungroupedCards = ungroupedZone.querySelector('.ungrouped-cards-area');
                ungroupedCards.appendChild(wrapper);
            } else {
                gridContainer.appendChild(wrapper);
            }
            i++;
        }
    }

    // Initialize sortable on ungrouped zone if it exists
    if (ungroupedZone && typeof Sortable !== 'undefined') {
        const ungroupedCards = ungroupedZone.querySelector('.ungrouped-cards-area');
        ungroupedCards.sortableInstance = new Sortable(ungroupedCards, {
            group: {
                name: 'progression-cards',
                pull: true,
                put: function(to, from, dragEl) {
                    // Accept chord cards from anywhere
                    return dragEl.classList.contains('chord-card-wrapper') &&
                           dragEl.hasAttribute('data-chord-index');
                }
            },
            animation: 200,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            handle: '.drag-handle',
            draggable: '.chord-card-wrapper[data-chord-index]',
            swapThreshold: 0.65,
            onAdd: function(evt) {
                // Card was dropped here from a section - ungroup it
                handleCardDragWithinSection(evt, evt.from.getAttribute('data-section-id'));
            },
            onEnd: function(evt) {
                if (evt.from !== evt.to) return;
                // Reorder within ungrouped
                handleCardDragWithinSection(evt, null);
            }
        });
    }
}

/**
 * Render flat cards in scroll mode
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
                    class="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Add
            </button>
            <button onclick="window.showAddSectionMenu && window.showAddSectionMenu(event, '${containerId}')"
                    class="w-full px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
                Section
            </button>
            <button onclick="window.clearProgression && window.clearProgression()"
                    class="w-full px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5">
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
        const wrapper = createChordCardWrapper(chord, index, key);
        wrapper.style.scrollSnapAlign = 'start';
        wrapper.style.flexShrink = '0';
        gridContainer.appendChild(wrapper);
    });
}

// ============================================================================
// SECTION-AWARE CARD RENDERING (Original Functions)
// ============================================================================

/**
 * Render cards with section indicators into a grid container
 * Cards stay in horizontal flow, sections shown as colored backgrounds with labels
 * @param {HTMLElement} gridContainer - Grid container element
 * @param {Array} progressionData - Chord progression data
 * @param {string} key - Current key
 * @param {Object} options - Rendering options
 */
function renderSectionAwareCards(gridContainer, progressionData, key, options = {}) {
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

    // Add "Add Chord", "Section" and "Clear All" buttons as first item
    if (showActionButtons) {
        const isMelodyComposer = gridContainer.id?.includes('melody');
        const toggleFunction = isMelodyComposer ? 'toggleQuickAddChordMelody' : 'toggleQuickAddChord';
        const containerId = gridContainer.id || 'melody-progression-visualization';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'chord-card-wrapper flex flex-col justify-center items-center gap-1.5 p-2 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-xl';
        buttonContainer.innerHTML = `
            <button onclick="window.${toggleFunction} && window.${toggleFunction}()"
                    class="w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Add chord to progression">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Add
            </button>
            <button onclick="window.showAddSectionMenu && window.showAddSectionMenu(event, '${containerId}')"
                    class="w-full px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Select adjacent chords, then add to a section">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
                Section
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

    // Track if we have any sections and ungrouped chords
    const hasSections = sections.length > 0;
    let ungroupedZone = null;

    // Check if there are any ungrouped chords (chords not in any section)
    const hasUngroupedChords = progressionData.some((_, idx) => !chordToSection.has(idx));

    // Create ungrouped zone only if there are sections AND ungrouped chords
    if (hasSections && hasUngroupedChords) {
        ungroupedZone = document.createElement('div');
        ungroupedZone.className = 'ungrouped-drop-zone flex flex-col rounded-lg overflow-visible';
        ungroupedZone.style.cssText = `
            min-width: 80px;
            min-height: 100px;
            background: rgba(156, 163, 175, 0.1);
            border: 2px dashed #9ca3af;
            border-radius: 12px;
            padding: 8px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            align-items: center;
            justify-content: flex-start;
        `;

        // Label for ungrouped zone
        const label = document.createElement('div');
        label.style.cssText = `
            font-size: 10px;
            color: #6b7280;
            text-align: center;
            padding: 2px 6px;
            background: rgba(156, 163, 175, 0.2);
            border-radius: 4px;
            white-space: nowrap;
        `;
        label.textContent = 'Ungrouped';
        ungroupedZone.appendChild(label);

        // Container for ungrouped cards
        const ungroupedCards = document.createElement('div');
        ungroupedCards.className = 'ungrouped-cards-area flex flex-wrap gap-2';
        ungroupedCards.style.cssText = 'min-height: 60px; width: 100%;';
        ungroupedZone.appendChild(ungroupedCards);

        gridContainer.appendChild(ungroupedZone);
    }

    // Render cards in sequence, grouping adjacent section cards into containers
    let i = 0;
    while (i < progressionData.length) {
        const section = chordToSection.get(i);

        if (section) {
            // This card is in a section - render the entire section as a unified container
            const sectionContainer = createUnifiedSectionContainer(section, progressionData, key);
            gridContainer.appendChild(sectionContainer);

            // Skip all cards in this section
            const maxIndex = Math.max(...section.chordIndices);
            i = maxIndex + 1;
        } else {
            // Ungrouped card - render in ungrouped zone if it exists, otherwise directly in grid
            const chord = progressionData[i];
            const wrapper = createChordCardWrapper(chord, i, key);

            if (ungroupedZone) {
                const ungroupedCards = ungroupedZone.querySelector('.ungrouped-cards-area');
                ungroupedCards.appendChild(wrapper);
            } else {
                gridContainer.appendChild(wrapper);
            }
            i++;
        }
    }

    // Initialize sortable on ungrouped zone if it exists
    if (ungroupedZone && typeof Sortable !== 'undefined') {
        const ungroupedCards = ungroupedZone.querySelector('.ungrouped-cards-area');
        ungroupedCards.sortableInstance = new Sortable(ungroupedCards, {
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
            draggable: '.chord-card-wrapper[data-chord-index]',
            swapThreshold: 0.65,
            onAdd: function(evt) {
                handleCardDragWithinSection(evt, evt.from.getAttribute('data-section-id'));
            },
            onEnd: function(evt) {
                if (evt.from !== evt.to) return;
                handleCardDragWithinSection(evt, null);
            }
        });
    }

    // Update shift classes
    requestAnimationFrame(() => {
        updateCardShifts();
    });
}

/**
 * Create a unified section container with banner and grouped cards
 * @param {Object} section - Section object
 * @param {Array} progressionData - Full progression data
 * @param {string} key - Current key
 * @returns {HTMLElement} Section container element
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
        <svg class="w-3 h-3 text-white/70 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
    cardsArea.style.flexWrap = 'wrap';
    cardsArea.style.backgroundColor = section.color + '20'; // 20% opacity
    cardsArea.style.borderLeft = `3px solid ${section.color}`;
    cardsArea.style.borderRight = `3px solid ${section.color}`;
    cardsArea.style.borderBottom = `3px solid ${section.color}`;
    cardsArea.setAttribute('data-section-id', section.id);

    // Render cards in this section
    section.chordIndices.forEach(chordIdx => {
        if (chordIdx < progressionData.length) {
            const chord = progressionData[chordIdx];
            const wrapper = createChordCardWrapper(chord, chordIdx, key);
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
            draggable: '.chord-card-wrapper[data-chord-index]',
            swapThreshold: 0.65,
            // Handle cards added FROM outside (ungrouped or another section) INTO this section
            onAdd: function(evt) {
                handleCardDragWithinSection(evt, evt.from.getAttribute('data-section-id'));
            },
            onEnd: function(evt) {
                // Only handle reorders within this section
                // Cross-container moves are handled by onAdd
                if (evt.from !== evt.to) {
                    return;
                }
                // Handle card movement within this section
                handleCardDragWithinSection(evt, section.id);
            }
        });
    }

    return container;
}

/**
 * Render progression with song sections (legacy wrapper - calls new functions)
 * @deprecated Use renderSectionAwareCards directly
 */
function renderProgressionWithSections(container, progressionData, key, options = {}) {
    // This is now handled by the main renderProgressionDisplay function
    // which restructures the container and calls renderSectionAwareCards
}

/**
 * Create the section toolbar with Add Section button
 * @param {string} containerId - Container ID for targeting
 * @returns {HTMLElement} Toolbar element
 */
function createSectionToolbar(containerId) {
    const toolbar = document.createElement('div');
    toolbar.className = 'section-toolbar flex items-center gap-2 p-2 mb-2 bg-gray-50 rounded-lg border border-gray-200';

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    const sectionTypes = compositionState ? compositionState.constructor.SECTION_TYPES : {};

    toolbar.innerHTML = `
        <button class="add-section-btn flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-md transition"
                onclick="window.showAddSectionMenu && window.showAddSectionMenu(event, '${containerId}')">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
            </svg>
            Add Section
        </button>
        <span class="text-xs text-gray-500 ml-2">
            Select adjacent chords, then add to a section
        </span>
    `;

    return toolbar;
}

/**
 * Create a section element with header and card container
 * @param {Object} section - Section data
 * @param {number} sectionIndex - Index in sections array
 * @param {Array} progressionData - Full progression data
 * @param {string} key - Current key
 * @returns {HTMLElement} Section element
 */
function createSectionElement(section, sectionIndex, progressionData, key) {
    const sectionEl = document.createElement('div');
    sectionEl.className = `section-wrapper mb-3 ${section.collapsed ? 'collapsed' : ''}`;
    sectionEl.setAttribute('data-section-id', section.id);
    sectionEl.setAttribute('data-section-index', sectionIndex);

    // Section header
    const header = document.createElement('div');
    header.className = 'section-header flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-pointer select-none';
    header.style.backgroundColor = section.color + '20'; // 20 = 12.5% opacity
    header.style.borderLeft = `4px solid ${section.color}`;

    header.innerHTML = `
        <button class="section-collapse-btn text-gray-500 hover:text-gray-700 transition p-0.5"
                onclick="window.toggleSectionCollapse && window.toggleSectionCollapse('${section.id}')">
            <svg class="w-4 h-4 transform transition-transform ${section.collapsed ? '-rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
        </button>
        <span class="section-color-dot w-3 h-3 rounded-full" style="background-color: ${section.color}"></span>
        <span class="section-label text-sm font-semibold text-gray-700 flex-1"
              ondblclick="window.editSectionLabel && window.editSectionLabel('${section.id}', this)">
            ${section.label}
        </span>
        <span class="section-chord-count text-xs text-gray-400">${section.chordIndices.length} chords</span>
        <button class="section-menu-btn text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition"
                onclick="window.showSectionMenu && window.showSectionMenu(event, '${section.id}')">
            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
            </svg>
        </button>
    `;

    // Make header draggable for section reordering
    header.classList.add('section-drag-handle');

    sectionEl.appendChild(header);

    // Cards container (collapsible)
    const cardsContainer = document.createElement('div');
    cardsContainer.className = `section-cards-container grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 p-2 rounded-b-lg border border-t-0 ${section.collapsed ? 'hidden' : ''}`;
    cardsContainer.style.borderColor = section.color + '40';
    cardsContainer.setAttribute('data-section-id', section.id);

    // Render chords in this section
    section.chordIndices.forEach(chordIndex => {
        if (chordIndex < progressionData.length) {
            const chord = progressionData[chordIndex];
            const wrapper = createChordCardWrapper(chord, chordIndex, key);
            // Add section membership indicator
            wrapper.setAttribute('data-in-section', section.id);
            cardsContainer.appendChild(wrapper);
        }
    });

    // Add drop zone indicator for empty sections
    if (section.chordIndices.length === 0) {
        const emptyIndicator = document.createElement('div');
        emptyIndicator.className = 'section-empty-indicator flex items-center justify-center p-4 text-xs text-gray-400 border-2 border-dashed border-gray-300 rounded-lg';
        emptyIndicator.textContent = 'Drag chords here';
        cardsContainer.appendChild(emptyIndicator);
    }

    sectionEl.appendChild(cardsContainer);

    return sectionEl;
}

/**
 * Create the ungrouped chords section
 * @param {Array} ungroupedIndices - Indices of ungrouped chords
 * @param {Array} progressionData - Full progression data
 * @param {string} key - Current key
 * @param {boolean} showActionButtons - Whether to show add/clear buttons
 * @returns {HTMLElement} Ungrouped section element
 */
function createUngroupedSection(ungroupedIndices, progressionData, key, showActionButtons) {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'ungrouped-section mt-2';
    sectionEl.setAttribute('data-section-id', 'ungrouped');

    // Header
    const header = document.createElement('div');
    header.className = 'ungrouped-header flex items-center gap-2 px-3 py-1.5 text-gray-500';
    header.innerHTML = `
        <span class="text-xs font-medium uppercase tracking-wide">Ungrouped</span>
        <span class="text-xs text-gray-400">(${ungroupedIndices.length})</span>
    `;
    sectionEl.appendChild(header);

    // Cards container
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'ungrouped-cards-container grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 p-2 bg-gray-50 rounded-lg border border-dashed border-gray-300';
    cardsContainer.setAttribute('data-section-id', 'ungrouped');

    // Add action buttons if requested
    if (showActionButtons) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'chord-card-wrapper flex flex-col justify-center items-center gap-2 p-2 bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-300 rounded-xl';
        buttonContainer.innerHTML = `
            <button onclick="window.toggleQuickAddChord && window.toggleQuickAddChord()"
                    class="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Add chord">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                </svg>
                Add
            </button>
            <button onclick="window.clearProgression && window.clearProgression()"
                    class="w-full px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg shadow transition flex items-center justify-center gap-1.5"
                    title="Clear all">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"></path>
                </svg>
                Clear
            </button>
        `;
        cardsContainer.appendChild(buttonContainer);
    }

    // Render ungrouped chords
    ungroupedIndices.forEach(chordIndex => {
        if (chordIndex < progressionData.length) {
            const chord = progressionData[chordIndex];
            const wrapper = createChordCardWrapper(chord, chordIndex, key);
            cardsContainer.appendChild(wrapper);
        }
    });

    sectionEl.appendChild(cardsContainer);
    return sectionEl;
}

/**
 * Create empty state with action buttons when no progression
 * @param {string} containerId - Container ID
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
 * Initialize SortableJS for sections and their card containers
 * @param {HTMLElement} container - Main container
 */
function initializeSectionSortables(container) {
    if (typeof Sortable === 'undefined') {
        return;
    }

    // Initialize sortable for section reordering
    const sectionsContainer = container.querySelector('.sections-container');
    if (sectionsContainer) {
        // Section-level sortable (reorder sections)
        const sectionWrappers = sectionsContainer.querySelectorAll('.section-wrapper');
        if (sectionWrappers.length > 1) {
            if (sectionsContainer.sectionSortable) {
                sectionsContainer.sectionSortable.destroy();
            }
            sectionsContainer.sectionSortable = new Sortable(sectionsContainer, {
                animation: 200,
                handle: '.section-drag-handle',
                draggable: '.section-wrapper',
                ghostClass: 'section-ghost',
                // Exclude label and buttons from triggering drag (allow double-click rename)
                filter: '.section-label, .section-menu-btn, .section-collapse-btn',
                preventOnFilter: false, // Don't prevent events on filtered elements
                onEnd: function(evt) {
                    handleSectionReorder(evt.oldIndex - 1, evt.newIndex - 1); // -1 to account for toolbar
                }
            });
        }
    }

    // Initialize sortable for each section's cards container
    const cardContainers = container.querySelectorAll('.section-cards-container, .ungrouped-cards-container');
    cardContainers.forEach(cardContainer => {
        if (cardContainer.sortableInstance) {
            cardContainer.sortableInstance.destroy();
        }

        cardContainer.sortableInstance = new Sortable(cardContainer, {
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
            filter: '.section-empty-indicator, .chord-card-wrapper:not([data-chord-index])',
            onStart: function(evt) {
                // Handle multi-select drag
                const selectedCount = getSelectionCount();
                if (selectedCount > 1) {
                    evt.item.setAttribute('data-dragging-count', selectedCount);
                }
            },
            // Handle cards added FROM outside INTO this container
            onAdd: function(evt) {
                handleChordMoveToSection(evt);
            },
            onEnd: function(evt) {
                // Only handle reorders within this container
                if (evt.from !== evt.to) {
                    return;
                }
                handleChordMoveToSection(evt);
            }
        });
    });
}

/**
 * Handle section reorder after drag
 * @param {number} oldIndex - Original section index
 * @param {number} newIndex - New section index
 */
function handleSectionReorder(oldIndex, newIndex) {
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    compositionState.reorderSections(oldIndex, newIndex);

    // Re-render
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);
}

/**
 * Handle chord move between sections after drag
 * @param {Object} evt - Sortable event
 */
function handleChordMoveToSection(evt) {
    const item = evt.item;
    const chordIndex = parseInt(item.getAttribute('data-chord-index'), 10);
    const fromSectionId = evt.from.getAttribute('data-section-id');
    const toSectionId = evt.to.getAttribute('data-section-id');

    if (isNaN(chordIndex)) return;

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    // Get the new position within the target section
    const siblings = Array.from(evt.to.querySelectorAll('.chord-card-wrapper[data-chord-index]'));
    const newPosition = siblings.indexOf(item);

    // Handle multi-select move
    const selectedIndices = getSelectedIndicesArray();
    if (selectedIndices.length > 1 && selectedIndices.includes(chordIndex)) {
        // Move all selected chords
        selectedIndices.forEach((idx, i) => {
            if (toSectionId === 'ungrouped') {
                compositionState.removeChordFromSection(idx);
            } else {
                compositionState.addChordToSection(idx, toSectionId, newPosition + i);
            }
        });
    } else {
        // Single chord move
        if (toSectionId === 'ungrouped') {
            compositionState.removeChordFromSection(chordIndex);
        } else {
            compositionState.addChordToSection(chordIndex, toSectionId, newPosition);
        }
    }

    // Re-render
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);
}

// ============================================================================
// SECTION MANAGEMENT FUNCTIONS (exposed to window)
// ============================================================================

/**
 * Show the add section menu/dropdown
 * @param {Event} event - Click event
 * @param {string} containerId - Container ID
 */
window.showAddSectionMenu = function(event, containerId) {
    event.stopPropagation();

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    const sectionTypes = compositionState.constructor.SECTION_TYPES;

    // Remove existing menu if any
    const existingMenu = document.querySelector('.section-type-menu');
    if (existingMenu) existingMenu.remove();

    // Create menu
    const menu = document.createElement('div');
    menu.className = 'section-type-menu fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]';

    // Position near the button (getBoundingClientRect returns viewport-relative coords, use fixed positioning)
    const button = event.target.closest('button') || event.target;
    const rect = button.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;

    // Ensure menu stays within viewport
    requestAnimationFrame(() => {
        const menuRect = menu.getBoundingClientRect();
        if (menuRect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - menuRect.width - 8}px`;
        }
        if (menuRect.bottom > window.innerHeight) {
            menu.style.top = `${rect.top - menuRect.height - 4}px`;
        }
    });

    // Add menu items for each section type
    Object.entries(sectionTypes).forEach(([typeKey, typeInfo]) => {
        const item = document.createElement('button');
        item.className = 'w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 transition';
        item.innerHTML = `
            <span class="w-3 h-3 rounded-full" style="background-color: ${typeInfo.color}"></span>
            <span>${typeInfo.label}</span>
        `;
        item.onclick = () => {
            menu.remove();
            createNewSection(typeKey, containerId);
        };
        menu.appendChild(item);
    });

    document.body.appendChild(menu);

    // Close menu on outside click
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
};

/**
 * Create a new section (optionally with selected chords)
 * Only allows adjacent chords to be grouped
 * @param {string} type - Section type
 * @param {string} containerId - Container ID
 */
function createNewSection(type, containerId) {
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    // Get selected chord indices (already sorted)
    const selectedIndices = getSelectedIndicesArray();

    // If we have selected indices, validate they are adjacent
    if (selectedIndices.length > 1) {
        // Check for adjacency - each index should be exactly 1 more than the previous
        for (let i = 1; i < selectedIndices.length; i++) {
            if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
                // Non-adjacent selection - show warning and only use the first contiguous range

                // Find first contiguous range
                const contiguousRange = [selectedIndices[0]];
                for (let j = 1; j < selectedIndices.length; j++) {
                    if (selectedIndices[j] === contiguousRange[contiguousRange.length - 1] + 1) {
                        contiguousRange.push(selectedIndices[j]);
                    } else {
                        break;
                    }
                }

                // Show a toast/notification to the user
                if (window.showNotification) {
                    window.showNotification('Only adjacent chords can be grouped. Using first contiguous selection.', 'warning');
                }

                // Use only the contiguous range
                compositionState.createSection(type, contiguousRange);
                clearSelection();
                renderProgressionDisplay('melody-progression-visualization', true);
                renderProgressionDisplay('melody-progression-visualization', false);
                return;
            }
        }
    }

    // All indices are adjacent (or single/empty) - create section
    compositionState.createSection(type, selectedIndices);

    // Clear selection
    clearSelection();

    // Re-render
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);
}

/**
 * Toggle section collapse state
 * @param {string} sectionId - Section ID
 */
window.toggleSectionCollapse = function(sectionId) {
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    const section = compositionState.getSection(sectionId);
    if (!section) return;

    compositionState.updateSection(sectionId, { collapsed: !section.collapsed });

    // Re-render
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);
};

/**
 * Edit section label inline or via prompt dialog
 * @param {string} sectionId - Section ID
 * @param {HTMLElement} [labelElement] - Label element to edit (optional - will use prompt if not provided)
 */
window.editSectionLabel = function(sectionId, labelElement) {
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) {
        console.warn('[editSectionLabel] No composition state');
        return;
    }

    const section = compositionState.getSection(sectionId);
    if (!section) {
        console.warn('[editSectionLabel] Section not found:', sectionId);
        return;
    }

    const currentLabel = section.label;

    // If no label element provided or it's not in the DOM, use prompt dialog
    if (!labelElement || !labelElement.parentNode) {
        const newLabel = prompt('Enter new section name:', currentLabel);
        if (newLabel !== null && newLabel.trim() !== '') {
            compositionState.updateSection(sectionId, { label: newLabel.trim() });
            renderProgressionDisplay('melody-progression-visualization', true);
            renderProgressionDisplay('melody-progression-visualization', false);
        }
        return;
    }

    // Inline editing - replace label with input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentLabel;
    input.className = 'section-label-input text-sm font-semibold text-gray-700 bg-white border border-indigo-500 rounded px-1 py-0.5 outline-none';
    input.style.width = `${Math.max(currentLabel.length * 8 + 16, 80)}px`;

    // Track if we've already saved (prevent double-save on blur after Enter)
    let saved = false;

    const saveLabel = () => {
        if (saved) return;
        saved = true;

        const newLabel = input.value.trim() || currentLabel;
        compositionState.updateSection(sectionId, { label: newLabel });

        // Re-render
        renderProgressionDisplay('melody-progression-visualization', true);
        renderProgressionDisplay('melody-progression-visualization', false);
    };

    try {
        labelElement.replaceWith(input);
        input.focus();
        input.select();

        input.addEventListener('blur', saveLabel);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                input.value = currentLabel;
                input.blur();
            }
        });
    } catch (err) {
        console.warn('[editSectionLabel] Inline editing failed, using prompt:', err);
        // Fallback to prompt
        const newLabel = prompt('Enter new section name:', currentLabel);
        if (newLabel !== null && newLabel.trim() !== '') {
            compositionState.updateSection(sectionId, { label: newLabel.trim() });
            renderProgressionDisplay('melody-progression-visualization', true);
            renderProgressionDisplay('melody-progression-visualization', false);
        }
    }
};

/**
 * Show section context menu
 * @param {Event} event - Click event
 * @param {string} sectionId - Section ID
 */
window.showSectionMenu = function(event, sectionId) {
    event.stopPropagation();

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    const section = compositionState.getSection(sectionId);
    if (!section) return;

    // Remove existing menu if any
    const existingMenu = document.querySelector('.section-context-menu');
    if (existingMenu) existingMenu.remove();

    // Create context menu
    const menu = document.createElement('div');
    menu.className = 'section-context-menu fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]';

    // Get button position (getBoundingClientRect returns viewport-relative coords)
    const button = event.target.closest('button') || event.target;
    const rect = button.getBoundingClientRect();

    // Position menu below the button, aligned to left edge
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;

    // Ensure menu stays within viewport
    requestAnimationFrame(() => {
        const menuRect = menu.getBoundingClientRect();
        if (menuRect.right > window.innerWidth) {
            menu.style.left = `${window.innerWidth - menuRect.width - 8}px`;
        }
        if (menuRect.bottom > window.innerHeight) {
            menu.style.top = `${rect.top - menuRect.height - 4}px`;
        }
    });

    const menuItems = [
        { label: 'Rename', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', action: () => {
            // Call without labelElement to use prompt dialog (more reliable)
            window.editSectionLabel(sectionId);
        }},
        { label: 'Change Type', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z', action: () => {
            // Show section type picker dialog
            window.showChangeSectionTypeDialog(sectionId, section.type, compositionState);
        }},
        { label: 'Duplicate', icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z', action: () => {
            // Show duplication options dialog
            window.showDuplicateSectionDialog(sectionId, section.label, compositionState);
        }},
        { label: 'Delete Section', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16', action: () => {
            if (confirm(`Delete "${section.label}"? Chords will become ungrouped.`)) {
                compositionState.deleteSection(sectionId);
                renderProgressionDisplay('melody-progression-visualization', true);
                renderProgressionDisplay('melody-progression-visualization', false);
            }
        }, danger: false },
        { label: 'Delete Section & Chords', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', action: () => {
            const chordCount = section.chordIndices?.length || 0;
            if (confirm(`Delete "${section.label}" AND its ${chordCount} chord(s)? This cannot be undone.`)) {
                // Delete chords first, then the section
                window.deleteSectionAndChords(sectionId, compositionState);
            }
        }, danger: true }
    ];

    menuItems.forEach(item => {
        const btn = document.createElement('button');
        btn.className = `w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-100'}`;
        btn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${item.icon}"></path>
            </svg>
            <span>${item.label}</span>
        `;
        btn.onclick = () => {
            menu.remove();
            item.action();
        };
        menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    // Close menu on outside click
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
};

/**
 * Show dialog to change section type
 * @param {string} sectionId - Section ID
 * @param {string} currentType - Current section type
 * @param {Object} compositionState - Composition state instance
 */
window.showChangeSectionTypeDialog = function(sectionId, currentType, compositionState) {
    // Remove existing dialog if any
    const existingDialog = document.querySelector('.change-section-type-dialog-overlay');
    if (existingDialog) existingDialog.remove();

    // Get section types from CompositionState
    const SECTION_TYPES = {
        intro: { label: 'Intro', color: '#6366F1' },
        verse: { label: 'Verse', color: '#10B981' },
        prechorus: { label: 'Pre-Chorus', color: '#F59E0B' },
        chorus: { label: 'Chorus', color: '#EF4444' },
        bridge: { label: 'Bridge', color: '#8B5CF6' },
        interlude: { label: 'Interlude', color: '#06B6D4' },
        solo: { label: 'Solo', color: '#EC4899' },
        breakdown: { label: 'Breakdown', color: '#64748B' },
        outro: { label: 'Outro', color: '#F97316' },
        custom: { label: 'Custom', color: '#78716C' }
    };

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'change-section-type-dialog-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4';

    // Build section type options
    const typeOptions = Object.entries(SECTION_TYPES).map(([type, info]) => {
        const isSelected = type === currentType;
        return `
            <button class="section-type-option flex items-center gap-3 w-full p-2 rounded-lg border transition ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}"
                    data-type="${type}">
                <span class="w-4 h-4 rounded-full flex-shrink-0" style="background: ${info.color};"></span>
                <span class="text-sm font-medium ${isSelected ? 'text-indigo-700' : 'text-gray-700'}">${info.label}</span>
                ${isSelected ? '<svg class="w-4 h-4 text-indigo-500 ml-auto" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>' : ''}
            </button>
        `;
    }).join('');

    dialog.innerHTML = `
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Change Section Type</h3>
        <div class="space-y-2 mb-4 max-h-64 overflow-y-auto">
            ${typeOptions}
        </div>
        <div class="flex justify-end gap-2">
            <button class="cancel-btn px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition">
                Cancel
            </button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Handle type selection
    dialog.querySelectorAll('.section-type-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const newType = btn.getAttribute('data-type');
            const typeInfo = SECTION_TYPES[newType];

            // Update section type and color
            compositionState.updateSection(sectionId, {
                type: newType,
                color: typeInfo.color
            });

            // Update label to match type (unless it was custom-named)
            const section = compositionState.getSection(sectionId);
            if (section) {
                // Check if label matches a section type label (auto-generated)
                const isAutoLabel = Object.values(SECTION_TYPES).some(t =>
                    section.label.startsWith(t.label)
                );
                if (isAutoLabel) {
                    // Auto-update label to new type
                    const existingSections = compositionState.getSections();
                    const sameTypeSections = existingSections.filter(s =>
                        s.id !== sectionId && s.type === newType
                    );
                    const newLabel = sameTypeSections.length > 0
                        ? `${typeInfo.label} ${sameTypeSections.length + 1}`
                        : typeInfo.label;
                    compositionState.updateSection(sectionId, { label: newLabel });
                }
            }

            overlay.remove();
            renderProgressionDisplay('melody-progression-visualization', true);
            renderProgressionDisplay('melody-progression-visualization', false);
        });
    });

    // Handle cancel
    dialog.querySelector('.cancel-btn').addEventListener('click', () => {
        overlay.remove();
    });

    // Close on outside click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
};

/**
 * Delete a section and all its chords
 * @param {string} sectionId - Section ID to delete
 * @param {Object} compositionState - Composition state instance
 */
window.deleteSectionAndChords = function(sectionId, compositionState) {
    const section = compositionState.getSection(sectionId);
    if (!section) return;

    // Get chord indices to delete (in reverse order to avoid index shifting issues)
    const chordIndicesToDelete = [...section.chordIndices].sort((a, b) => b - a);

    // Save state for undo
    if (typeof saveStateBeforeChange === 'function') {
        saveStateBeforeChange();
    }

    // Delete section first (ungroups chords)
    compositionState.deleteSection(sectionId);

    // Delete chords in reverse order
    chordIndicesToDelete.forEach(chordIdx => {
        if (typeof compositionState.deleteChord === 'function') {
            compositionState.deleteChord(chordIdx);
        } else {
            // Fallback: remove from progression data directly
            const progressionData = getProgressionData();
            if (progressionData && chordIdx < progressionData.length) {
                progressionData.splice(chordIdx, 1);
                setProgressionData([...progressionData]);
            }
        }
    });

    // Sync to trainerState
    if (window.syncCompositionStateToTrainer) {
        window.syncCompositionStateToTrainer();
    }

    // Re-render
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

    // Update notation
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    } else if (window.getNotationComposer) {
        const notationComposer = window.getNotationComposer();
        if (notationComposer) {
            notationComposer.render();
        }
    }
};

/**
 * Show dialog for section duplication options
 * @param {string} sectionId - Section ID to duplicate
 * @param {string} sectionLabel - Section label for display
 * @param {Object} compositionState - Composition state instance
 */
window.showDuplicateSectionDialog = function(sectionId, sectionLabel, compositionState) {
    // Remove existing dialog if any
    const existingDialog = document.querySelector('.duplicate-section-dialog-overlay');
    if (existingDialog) existingDialog.remove();

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'duplicate-section-dialog-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';

    // Create dialog
    const dialog = document.createElement('div');
    dialog.className = 'bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4';
    dialog.innerHTML = `
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Duplicate "${sectionLabel}"</h3>
        <p class="text-sm text-gray-600 mb-4">Choose what to include in the duplicate:</p>

        <div class="space-y-3 mb-6">
            <label class="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                <input type="radio" name="duplicateMode" value="bass" class="mt-1 text-indigo-600 focus:ring-indigo-500" checked>
                <div>
                    <div class="font-medium text-gray-900">Bass clef / Chords only</div>
                    <div class="text-sm text-gray-500">Duplicate the chord progression and bass clef edits. The treble clef will be empty for new melody writing.</div>
                </div>
            </label>

            <label class="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                <input type="radio" name="duplicateMode" value="both" class="mt-1 text-indigo-600 focus:ring-indigo-500">
                <div>
                    <div class="font-medium text-gray-900">Both clefs</div>
                    <div class="text-sm text-gray-500">Duplicate everything including treble clef notes and bass clef edits.</div>
                </div>
            </label>
        </div>

        <div class="flex justify-end gap-3">
            <button class="cancel-btn px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                Cancel
            </button>
            <button class="duplicate-btn px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition">
                Duplicate
            </button>
        </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Handle cancel
    const cancelBtn = dialog.querySelector('.cancel-btn');
    cancelBtn.onclick = () => overlay.remove();

    // Handle click outside dialog
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    // Handle escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);

    // Handle duplicate
    const duplicateBtn = dialog.querySelector('.duplicate-btn');
    duplicateBtn.onclick = () => {
        const mode = dialog.querySelector('input[name="duplicateMode"]:checked').value;
        overlay.remove();

        // Perform duplication with selected mode
        compositionState.duplicateSection(sectionId, { mode });
        renderProgressionDisplay('melody-progression-visualization', true);
        renderProgressionDisplay('melody-progression-visualization', false);
    };
};

/**
 * Create a chord card wrapper (holds either simplified or detailed view)
 * @param {Object} chord - Chord data
 * @param {number} index - Chord index
 * @param {string} key - Current key
 * @returns {HTMLElement} Wrapper element
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
        wrapper.innerHTML = createDetailedCardHTML(chord, index, key);

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
                // Setting minWidth causes excessive whitespace between cards

                // Update card shifts after layout is applied
                requestAnimationFrame(() => {
                    updateCardShifts();
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

    // Create card element - the HTML now includes the card wrapper and duration controls
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
 * Create simplified card HTML - minimal design with buttons on right edge
 */
function createSimplifiedCardHTML(chord, index, key) {
    const roman = chord.roman || harmonyAnalyzer.getRomanNumeral(chord, key);
    const colors = getFunctionColors(roman);

    // Use simpleName for accurate chord symbol (e.g., "Gm9" for G Minor 9th)
    // Falls back to building symbol if simpleName not available
    let chordSymbol = chord.simpleName || chord.root;

    // If no simpleName, build it manually (backup)
    if (!chord.simpleName) {
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
                <!-- Function color indicator bar at top -->
                <div class="absolute top-0 left-0 right-0 h-1" style="${functionTopBorderStyle}"></div>
                <!-- Inversion indicator (top-left corner) -->
                ${inversionText ? `<div class="absolute top-2 left-1 text-xl text-red-400 font-bold">${inversionText}</div>` : ''}

                <!-- Info icon (bottom-left corner) for touchscreen devices -->
                <button class="info-tooltip-btn absolute bottom-1 left-1 w-5 h-5 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold transition" title="Show chord info">
                    i
                </button>

                <!-- Main content: horizontal layout with chord info on left, buttons on right -->
                <div class="chord-info-view flex items-center justify-between h-full p-2 pt-2.5 drag-handle cursor-grab active:cursor-grabbing">
                    <!-- Left: Chord info -->
                    <div class="flex flex-col items-center flex-1">
                        <!-- Chord Symbol -->
                        <div class="text-base font-bold text-white mb-0.5">${chordSymbol}</div>
                        <!-- Roman Numeral -->
                        <div class="text-xs ${colors.romanColor} font-bold">${roman}</div>
                        <!-- Position Label -->
                        <div class="text-[9px] text-gray-400 mt-0.5">Pos: ${index + 1}</div>
                    </div>

                    <!-- Right: Vertically stacked compact buttons -->
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
 * Create comprehensive detailed card HTML (expanded view)
 * Full-featured card with RH/LH octave shifts, inversions, voicing controls, and staff notation
 */
function createDetailedCardHTML(chord, index, key) {
    const roman = chord.roman || harmonyAnalyzer.getRomanNumeral(chord, key);
    const colors = getFunctionColors(roman);
    const chordSymbol = chord.simpleName || chord.name || `${chord.root}${chord.type}`;
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
                        <div class="text-sm font-bold">${chordSymbol}</div>
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
                    <div>
                        <label class="block text-[9px] font-semibold text-gray-700 mb-0.5">Inversion</label>
                        <div class="flex gap-0.5">
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

/**
 * Attach event listeners to card buttons
 */
function attachCardEventListeners(wrapper, index) {
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
            if (window.showProgressionChordSuggestions) {
                window.showProgressionChordSuggestions(index);
            }
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
            // No longer need to preserve transforms - flexbox/grid handles layout
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

            if (window.startProgressionChord) {
                window.startProgressionChord(index);
                // Highlight corresponding tension curve point and chord card
                highlightTensionPoint(index);
                highlightChordCard(index);
            }
        });
        playBtn.addEventListener('mouseup', () => {
            if (window.stopTrainerChord) window.stopTrainerChord();
            // Remove playback highlighting but keep selection (purple ring persists)
            unhighlightAllTensionPoints();
            unhighlightAllChordCards();
        });
        playBtn.addEventListener('mouseleave', () => {
            if (window.stopTrainerChord) window.stopTrainerChord();
            // Remove playback highlighting but keep selection (purple ring persists)
            unhighlightAllTensionPoints();
            unhighlightAllChordCards();
        });

        // Also handle touch events
        playBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            // Select this card (persistent purple ring)
            selectChordCard(index);

            if (window.startProgressionChord) {
                window.startProgressionChord(index);
                highlightTensionPoint(index);
                highlightChordCard(index);
            }
        }, { passive: false });

        playBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (window.stopTrainerChord) window.stopTrainerChord();
            // Remove playback highlighting but keep selection (purple ring persists)
            unhighlightAllTensionPoints();
            unhighlightAllChordCards();
        }, { passive: false });
    }

    // Delete button
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (window.removeChordFromProgression) {
                window.removeChordFromProgression(index);
            }
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

            // Start playing the chord with the new inversion
            if (window.startProgressionChord) {
                window.startProgressionChord(index);
            }
        });

        // Stop playing on mouseup and sync notation immediately
        btn.addEventListener('mouseup', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (window.stopTrainerChord) {
                window.stopTrainerChord();
            }

            // Update notation preserving treble notes
            updateChordAndRenderPreservingTrebleNotes(index);

            wasPressed = false;
        });

        // Also stop if mouse leaves button and sync if was pressed
        btn.addEventListener('mouseleave', (e) => {
            if (window.stopTrainerChord) {
                window.stopTrainerChord();
            }

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
            if (window.toggleProgressionNote) {
                window.toggleProgressionNote(index, note);
            }
        });
    });

    // All/None buttons for notes
    if (notesAllBtn) {
        notesAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            // Get compositionState directly - the single source of truth
            const compositionState = window.getCompositionState ? window.getCompositionState() : null;
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
                if (window.startProgressionChord && window.stopTrainerChord) {
                    window.startProgressionChord(index);
                    setTimeout(() => window.stopTrainerChord(), 500);
                }
            }
        });
    }

    if (notesNoneBtn) {
        notesNoneBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            // Get compositionState directly - the single source of truth
            const compositionState = window.getCompositionState ? window.getCompositionState() : null;
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
            if (window.showProgressionChordSuggestions) {
                window.showProgressionChordSuggestions(index);
            }
        });
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
            // Update the card UI after tooltip closes to show any inversion changes
            updateSingleCard(index);
            updateTensionCurveIfVisible();

            // Sync notation ONLY if inversion was actually changed
            if (inversionWasChanged) {
                updateChordAndRenderPreservingTrebleNotes(index);
            }

            // Reset the flag for next time
            inversionWasChanged = false;
        };

        // Show tooltip on hover (desktop) - use cardWrapper since tooltip is sibling to card
        cardWrapper.addEventListener('mouseenter', (e) => {
            isOverCard = true;
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            // Don't show tooltip if hovering over duration controls
            if (e.target.closest('.duration-whole-select') || e.target.closest('.duration-frac-select')) {
                return;
            }
            if (!isTooltipPinned) {
                tooltipTimeout = setTimeout(() => {
                    showTooltip();
                }, 300); // Small delay for hover
            }
        });

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
                if (inversionWasChanged) {
                    updateChordAndRenderPreservingTrebleNotes(index);
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
                    if (inversionWasChanged) {
                        updateChordAndRenderPreservingTrebleNotes(index);
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
                if (inversionWasChanged) {
                    updateChordAndRenderPreservingTrebleNotes(index, { skipCardRefresh: true });
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
                if (wasPressed && inversionWasChanged) {
                    updateChordAndRenderPreservingTrebleNotes(index, { skipCardRefresh: true });
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
                updateChordAndRenderPreservingTrebleNotes(index);
            }
        });
    }

    // === DURATION SELECTORS ===
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
 * Update shift classes for all cards based on expanded state
 * Shifts cards to the right when they come after an expanded card
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
 * Expand a chord card to detailed view
 * Updates cards in both containers to keep them in sync
 */
function expandChordCard(index) {
    expandedChords.add(index);

    // Find wrappers in both containers
    const wrappers = document.querySelectorAll(`.chord-card-wrapper[data-chord-index="${index}"]`);

    wrappers.forEach(wrapper => {
        const trainerState = getTrainerState();
        const chord = trainerState.progressionData[index];
        const key = trainerState.currentKey || 'C';

        // Ensure no-animation class is present and add expanded class for wider width
        wrapper.classList.add('no-animation', 'expanded-card-wrapper');

        // Replace content with detailed view immediately (no delay needed with no-animation class)
        wrapper.innerHTML = createDetailedCardHTML(chord, index, key);
        attachCardEventListeners(wrapper, index);

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

                // Update card shifts after layout is applied
                requestAnimationFrame(() => {
                    updateCardShifts();
                });
            }
        });
    });

    // Update shifts for all cards after layout is applied
    requestAnimationFrame(() => {
        updateCardShifts();
    });
}

/**
 * Collapse a chord card back to simplified view
 * Updates cards in both containers to keep them in sync
 */
function collapseChordCard(index) {
    expandedChords.delete(index);

    // Find wrappers in both containers
    const wrappers = document.querySelectorAll(`.chord-card-wrapper[data-chord-index="${index}"]`);

    wrappers.forEach(wrapper => {
        const trainerState = getTrainerState();
        const chord = trainerState.progressionData[index];
        const key = trainerState.currentKey || 'C';

        // Ensure no-animation class is present and remove expanded class
        wrapper.classList.add('no-animation');
        wrapper.classList.remove('expanded-card-wrapper');

        // Replace content with simplified view (control bar + card)
        wrapper.innerHTML = '';
        const simplifiedStructure = createSimplifiedCardStructure(chord, index, key);
        wrapper.appendChild(simplifiedStructure);
        attachCardEventListeners(wrapper, index);

        // Reset wrapper width
        wrapper.style.minWidth = '';

        // Force layout by reading dimensions
        wrapper.getBoundingClientRect();
    });

    // Update shifts for all cards after layout is applied
    requestAnimationFrame(() => {
        updateCardShifts();
    });
}

/**
 * Helper: Get chord type options HTML
 * Includes all chord types from CHORD_DEFINITIONS, organized by category
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
 * Helper: Get inversion options HTML
 */
function getInversionOptions(currentInversion) {
    const labels = ['Root Position', '1st Inversion', '2nd Inversion', '3rd Inversion'];
    return [0, 1, 2, 3].map(inv =>
        `<option value="${inv}" ${inv === currentInversion ? 'selected' : ''}>${labels[inv]}</option>`
    ).join('');
}

/**
 * Helper: Get voicing options HTML
 */
function getVoicingOptions(currentVoicing) {
    const voicings = [
        { value: 'close', label: 'Close' },
        { value: 'open', label: 'Open' },
        { value: 'drop-2', label: 'Drop-2' },
        { value: 'drop-3', label: 'Drop-3' }
    ];
    return voicings.map(v =>
        `<option value="${v.value}" ${v.value === currentVoicing ? 'selected' : ''}>${v.label}</option>`
    ).join('');
}

/**
 * Refresh only the chord notation canvas in a detailed card (without rebuilding HTML)
 * @param {number} index - Chord index
 * @param {object} chord - Chord data
 */
function refreshChordNotationCanvas(index, chord) {
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
 * Helper: Update a single card without re-rendering everything
 */
function updateSingleCard(index) {
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    const key = trainerState.currentKey || 'C';

    if (!chord) return;

    // Update cards in both containers
    const wrappers = document.querySelectorAll(`.chord-card-wrapper[data-chord-index="${index}"]`);
    if (wrappers.length === 0) return;

    wrappers.forEach(wrapper => {
        updateSingleCardWrapper(wrapper, chord, index, key);
    });
}

/**
 * Update a single card wrapper with new chord data
 */
function updateSingleCardWrapper(wrapper, chord, index, key) {
    if (!wrapper || !chord) return;

    // Check if this card is currently expanded
    const isExpanded = expandedChords.has(index);

    // Completely disable ALL transitions and animations using CSS class
    // This overrides the global .chord-card-wrapper transition and animation rules
    wrapper.classList.add('no-animation');

    // Replace the card's HTML with updated version
    if (isExpanded) {
        wrapper.innerHTML = createDetailedCardHTML(chord, index, key);
        // Ensure expanded class is present
        wrapper.classList.add('expanded-card-wrapper');

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

/**
 * Helper: Update tension curve if visible
 */
function updateTensionCurveIfVisible() {
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
 * Update chord type from simplified view
 */
function updateChordType(index, newType) {
    // Get compositionState directly - the single source of truth
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) {
        return;
    }

    const trainerState = getTrainerState();
    const chord = compositionState.getChord(index);
    if (!chord) {
        return;
    }

    // Use the chord's root directly - this is more reliable for non-diatonic chords
    // like secondary dominants (B7 in key of C) where the roman numeral might just be the note name
    const chordRoot = chord.root;
    if (!chordRoot) {
        console.warn('[updateChordType] No root note available for chord');
        return;
    }

    // Regenerate chord notes using getInvertedChordNotes directly with the chord's root
    // This is more reliable than getProgressionChordNotes for non-diatonic chords
    const chordResult = getInvertedChordNotes(
        chordRoot,
        newType,
        chord.inversion || 0,
        chord.key || trainerState.currentKey,
        0, // Get base notes without octave shift
        getEnharmonicPreference(),
        getNotationPreference()
    );

    if (!chordResult || !chordResult.specificNotes || chordResult.specificNotes.length === 0) {
        console.warn('[updateChordType] Could not regenerate notes for chord:', chordRoot, newType);
        return;
    }

    const chordInfo = {
        notes: chordResult.specificNotes,
        name: chordResult.name,
        simpleName: chordResult.simpleName
    };

    // Prepare updates object
    const updates = {
        type: newType,
        notes: chordInfo.notes,
        lhNotes: chordInfo.lhNotes,
        name: chordInfo.name,
        simpleName: chordInfo.simpleName
    };

    // Reapply octave shift if it was previously set
    if (chord.octaveShift && chord.octaveShift !== 0) {
        updates.notes = updates.notes.map(note => {
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return note;
            const noteName = match[1];
            const octave = parseInt(match[2]);
            const newOctave = octave + Math.floor(chord.octaveShift / 12);
            // Clamp octave to valid MIDI range (0-8)
            const clampedOctave = Math.max(0, Math.min(8, newOctave));
            return `${noteName}${clampedOctave}`;
        });
    }

    // Save state for undo BEFORE making changes
    saveStateBeforeChange();

    // Update chord in compositionState
    compositionState.updateChordByIndex(index, updates);

    // Also update trainerState.progressionData to keep in sync
    if (trainerState.progressionData && trainerState.progressionData[index]) {
        Object.assign(trainerState.progressionData[index], updates);
    }

    // Update only this card and tension curve (type changes affect tension)
    updateSingleCard(index);
    updateTensionCurveIfVisible();

    // Update the grand staff notation
    updateChordAndRenderPreservingTrebleNotes(index);

    // Play the chord with the new type
    const voicedNotes = updates.notes.filter(n => !(chord.omittedNotes || []).includes(n));
    const rhOctaveShift = chord.octaveShift || 0;
    const lhRelativeShift = chord.lhOctaveShift || 0;
    const absoluteLHOctaveShift = rhOctaveShift + lhRelativeShift;
    const lhNotes = getLHNotes(
        chord.root,
        chord.lhType,
        chord.lhInversion,
        trainerState.currentKey,
        absoluteLHOctaveShift,
        newType,
        getEnharmonicPreference()
    ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
    const allNotes = voicedNotes.concat(lhNotes);
    if (allNotes.length > 0) {
        playTrainerChordOnce(allNotes);
    }
}

/**
 * Update chord root note from simplified view
 * Changes the root note while preserving the chord type
 */
function updateChordRoot(index, newRoot) {
    // Get compositionState directly - the single source of truth
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) {
        return;
    }

    const trainerState = getTrainerState();
    const chord = compositionState.getChord(index);
    if (!chord) {
        return;
    }

    // Keep the same chord type, just change the root
    const chordType = chord.type || 'Major';

    // Regenerate chord notes using getInvertedChordNotes directly with the new root
    // This is more reliable than getProgressionChordNotes for all chord types
    const chordResult = getInvertedChordNotes(
        newRoot,
        chordType,
        chord.inversion || 0,
        chord.key || trainerState.currentKey,
        0, // Get base notes without octave shift
        getEnharmonicPreference(),
        getNotationPreference()
    );

    if (!chordResult || !chordResult.specificNotes || chordResult.specificNotes.length === 0) {
        console.warn('[updateChordRoot] Could not regenerate notes for chord:', newRoot, chordType);
        return;
    }

    // Prepare updates object
    const updates = {
        root: newRoot,
        notes: chordResult.specificNotes,
        name: chordResult.name,
        simpleName: chordResult.simpleName,
        roman: '' // Clear roman numeral since we're using absolute root
    };

    // Reapply octave shift if it was previously set
    if (chord.octaveShift && chord.octaveShift !== 0) {
        updates.notes = updates.notes.map(note => {
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return note;
            const noteName = match[1];
            const octave = parseInt(match[2]);
            const newOctave = octave + Math.floor(chord.octaveShift / 12);
            // Clamp octave to valid MIDI range (0-8)
            const clampedOctave = Math.max(0, Math.min(8, newOctave));
            return `${noteName}${clampedOctave}`;
        });
    }

    // Save state for undo BEFORE making changes
    saveStateBeforeChange();

    // Update chord in compositionState
    compositionState.updateChordByIndex(index, updates);

    // Also update trainerState.progressionData to keep in sync
    if (trainerState.progressionData && trainerState.progressionData[index]) {
        Object.assign(trainerState.progressionData[index], updates);
    }

    // Update only this card and tension curve
    updateSingleCard(index);
    updateTensionCurveIfVisible();

    // Update the grand staff notation
    updateChordAndRenderPreservingTrebleNotes(index);

    // Play the chord with the new root
    const voicedNotes = updates.notes.filter(n => !(chord.omittedNotes || []).includes(n));
    const rhOctaveShift = chord.octaveShift || 0;
    const lhRelativeShift = chord.lhOctaveShift || 0;
    const absoluteLHOctaveShift = rhOctaveShift + lhRelativeShift;
    const lhNotes = getLHNotes(
        newRoot,
        chord.lhType,
        chord.lhInversion,
        trainerState.currentKey,
        absoluteLHOctaveShift,
        chordType,
        getEnharmonicPreference()
    ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
    const allNotes = voicedNotes.concat(lhNotes);
    if (allNotes.length > 0) {
        playTrainerChordOnce(allNotes);
    }
}

/**
 * Update chord duration from simplified view
 * Now supports confirmation dialog when truncation is needed
 */
function updateChordDuration(index, sourceElement) {
    // Get compositionState directly - the single source of truth
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) {
        return;
    }

    // Get the chord from compositionState
    const chord = compositionState.getChord(index);
    if (!chord) {
        return;
    }

    // Find the duration selectors - they could be in either the event source's wrapper
    // or we need to search for them
    let durationWholeSelect, durationFracSelect;

    if (sourceElement) {
        // Find the closest wrapper containing the duration controls
        const wrapper = sourceElement.closest('.chord-card-wrapper') ||
                       sourceElement.closest('[data-chord-index]');
        if (wrapper) {
            durationWholeSelect = wrapper.querySelector('.duration-whole-select');
            durationFracSelect = wrapper.querySelector('.duration-frac-select');
        }
    }

    // If not found via sourceElement, search in all containers
    if (!durationWholeSelect || !durationFracSelect) {
        const wrappers = document.querySelectorAll(`[data-chord-index="${index}"]`);
        for (const wrapper of wrappers) {
            const wholeSelect = wrapper.querySelector('.duration-whole-select');
            const fracSelect = wrapper.querySelector('.duration-frac-select');
            if (wholeSelect && fracSelect) {
                durationWholeSelect = wholeSelect;
                durationFracSelect = fracSelect;
                break;
            }
        }
    }

    if (!durationWholeSelect || !durationFracSelect) {
        return;
    }

    // Parse the selected values
    const wholeBeats = parseInt(durationWholeSelect.value) || 0;
    const fracBeats = parseFloat(durationFracSelect.value) || 0;
    const totalBeats = wholeBeats + fracBeats;

    // Validation: minimum 0.25 beats (16th note)
    if (totalBeats < 0.25) {
        alert('Chord duration must be at least 0.25 beats (16th note)');
        // Reset to previous value
        const prevBeats = chord.beats || 4;
        const prevWhole = Math.floor(prevBeats);
        const prevFrac = prevBeats - prevWhole;
        durationWholeSelect.value = prevWhole;
        durationFracSelect.value = prevFrac;
        return;
    }

    // Check if the value actually changed
    if (chord.beats === totalBeats) {
        return; // No change needed
    }

    // Save state for undo BEFORE making changes
    saveStateBeforeChange();

    // Update the chord duration using compositionState's dedicated method
    // This now returns confirmation info if truncation is needed
    const result = compositionState.updateChordDuration(index, totalBeats);

    // Check if we need user confirmation for truncation
    if (result && result.needsConfirmation) {
        showTruncationWarningDialog(result.truncationInfo, () => {
            // User confirmed - force apply the change
            compositionState.forceApplyChordDuration(index, totalBeats);
            finalizeDurationChange(index, totalBeats);
        }, () => {
            // User cancelled - revert the selectors
            const prevBeats = chord.beats || 4;
            const prevWhole = Math.floor(prevBeats);
            const prevFrac = prevBeats - prevWhole;
            durationWholeSelect.value = prevWhole;
            durationFracSelect.value = prevFrac;
        });
        return;
    }

    // No confirmation needed - finalize the change
    finalizeDurationChange(index, totalBeats);
}

/**
 * Finalize duration change after update (or after user confirmation)
 */
function finalizeDurationChange(index, totalBeats) {
    // Update all card displays (both tabs)
    updateSingleCard(index);

    // Trigger re-render of the notation
    if (window.getNotationComposer) {
        const notationComposer = window.getNotationComposer();
        if (notationComposer) {
            notationComposer.render();
        }
    }

    // Dispatch event for other components that may need to know
    window.dispatchEvent(new CustomEvent('chordDurationChanged', {
        detail: { index, beats: totalBeats }
    }));

    // Update unified suggestions if available
    if (window.updateUnifiedSuggestions) {
        window.updateUnifiedSuggestions();
    }
}

/**
 * Show warning dialog when reducing duration would truncate notes
 * @param {Object} truncationInfo - Info about what will be truncated
 * @param {Function} onConfirm - Callback when user confirms
 * @param {Function} onCancel - Callback when user cancels
 */
function showTruncationWarningDialog(truncationInfo, onConfirm, onCancel) {
    // Build description of what will be affected
    let affectedDescription = '';

    if (truncationInfo.truncatedNotes.length > 0) {
        affectedDescription += `<li><strong>${truncationInfo.truncatedNotes.length} note(s)</strong> will be removed entirely</li>`;
    }

    if (truncationInfo.adjustedNote) {
        const adj = truncationInfo.adjustedNote;
        affectedDescription += `<li>The last note will be shortened from <strong>${adj.original.duration}</strong> to <strong>${adj.adjusted.duration}</strong></li>`;
    }

    const modalHTML = `
        <div id="truncation-warning-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
                <div class="bg-amber-500 px-6 py-4">
                    <h3 class="text-xl font-bold text-white flex items-center gap-2">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                        Note Truncation Warning
                    </h3>
                </div>
                <div class="p-6">
                    <p class="text-gray-700 mb-4">
                        Reducing the duration of <strong>${truncationInfo.chordName}</strong> from
                        <strong>${truncationInfo.oldDuration}</strong> to <strong>${truncationInfo.newDuration}</strong> beats
                        will affect edited bass notes:
                    </p>
                    <ul class="list-disc list-inside text-gray-600 mb-4 space-y-1">
                        ${affectedDescription}
                    </ul>
                    <p class="text-gray-600 text-sm">
                        This action cannot be undone. Do you want to continue?
                    </p>
                </div>
                <div class="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                    <button id="truncation-cancel-btn" class="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors">
                        Cancel
                    </button>
                    <button id="truncation-confirm-btn" class="px-4 py-2 text-white bg-amber-500 rounded hover:bg-amber-600 transition-colors">
                        Truncate Notes
                    </button>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    const existing = document.getElementById('truncation-warning-modal');
    if (existing) existing.remove();

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Get modal and buttons
    const modal = document.getElementById('truncation-warning-modal');
    const cancelBtn = document.getElementById('truncation-cancel-btn');
    const confirmBtn = document.getElementById('truncation-confirm-btn');

    // Handle cancel
    const handleCancel = () => {
        modal.remove();
        if (onCancel) onCancel();
    };

    // Handle confirm
    const handleConfirm = () => {
        modal.remove();
        if (onConfirm) onConfirm();
    };

    // Attach event listeners
    cancelBtn.addEventListener('click', handleCancel);
    confirmBtn.addEventListener('click', handleConfirm);

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) handleCancel();
    });

    // Close on Escape key
    const handleKeydown = (e) => {
        if (e.key === 'Escape') {
            handleCancel();
            document.removeEventListener('keydown', handleKeydown);
        }
    };
    document.addEventListener('keydown', handleKeydown);
}

/**
 * Update chord inversion from simplified view
 */
function updateChordInversion(index, newInversion, shouldUpdateUI = true, shouldSyncNotation = true) {
    // Get compositionState directly - the single source of truth
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) {
        return;
    }

    const trainerState = getTrainerState();
    const chord = compositionState.getChord(index);
    if (!chord) {
        return;
    }

    // Use the chord's root directly - this is more reliable for non-diatonic chords
    // like secondary dominants (B7 in key of C) where the roman numeral might just be the note name
    const chordRoot = chord.root;
    if (!chordRoot) {
        console.warn('[updateChordInversion] No root note available for chord');
        return;
    }

    // Regenerate chord notes using getInvertedChordNotes directly with the chord's root and type
    // This is more reliable than getProgressionChordNotes for non-diatonic chords
    const chordResult = getInvertedChordNotes(
        chordRoot,
        chord.type,
        newInversion,
        chord.key || trainerState.currentKey,
        0, // Get base notes without octave shift
        getEnharmonicPreference(),
        getNotationPreference()
    );

    if (!chordResult || !chordResult.specificNotes || chordResult.specificNotes.length === 0) {
        console.warn('[updateChordInversion] Could not regenerate notes for chord:', chordRoot, chord.type);
        return;
    }

    const chordInfo = { notes: chordResult.specificNotes };

    // Prepare updates object
    const updates = {
        inversion: newInversion,
        notes: chordInfo.notes,
        lhNotes: chordInfo.lhNotes,
        omittedNotes: [] // Clear omittedNotes since note names change with inversion
    };

    // Reapply octave shift if it was previously set
    if (chord.octaveShift && chord.octaveShift !== 0) {
        updates.notes = updates.notes.map(note => {
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return note;
            const noteName = match[1];
            const octave = parseInt(match[2]);
            const newOctave = octave + Math.floor(chord.octaveShift / 12);
            // Clamp octave to valid MIDI range (0-8)
            const clampedOctave = Math.max(0, Math.min(8, newOctave));
            return `${noteName}${clampedOctave}`;
        });
    }

    // Save state for undo BEFORE making changes
    saveStateBeforeChange();

    // Update chord in compositionState
    compositionState.updateChordByIndex(index, updates);

    // Also update trainerState.progressionData to keep in sync
    if (trainerState.progressionData && trainerState.progressionData[index]) {
        Object.assign(trainerState.progressionData[index], updates);
    }

    // Update only this card and tension curve (inversions affect tension and voice leading)
    // Skip UI update if called from tooltip to prevent closing the tooltip
    if (shouldUpdateUI) {
        updateSingleCard(index);
        updateTensionCurveIfVisible();
    }

    // Update the grand staff notation - skip if called from tooltip buttons (will sync on mouseup)
    if (shouldSyncNotation) {
        // Use new helper function that preserves treble notes
        updateChordAndRenderPreservingTrebleNotes(index);
    }
}

/**
 * Update chord voicing from simplified view
 */
function updateChordVoicing(index, newVoicing) {
    // Save state for undo BEFORE making changes
    saveStateBeforeChange();

    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    chord.voicing = newVoicing;

    // Update only this card (voicing doesn't affect tension curve)
    updateSingleCard(index);
}

/**
 * Get scale notes for a given key (for highlighting scale degree indicators)
 */
function getScaleNotesForKey(key) {
    const scalePattern = [0, 2, 4, 5, 7, 9, 11]; // Major scale intervals
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatNames = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

    // Normalize key to root note
    const rootNote = key.replace(/\s*(major|minor|m)$/i, '').trim();

    // Find root index
    let rootIndex = noteNames.indexOf(rootNote);
    if (rootIndex === -1) {
        rootIndex = flatNames.indexOf(rootNote);
    }
    if (rootIndex === -1) return [];

    // Generate scale notes
    const useFlats = rootNote.includes('b');
    const names = useFlats ? flatNames : noteNames;

    return scalePattern.map(interval => {
        const noteIndex = (rootIndex + interval) % 12;
        return names[noteIndex];
    });
}

/**
 * Update RH octave shift
 */
function updateRHOctaveShift(index, shift) {
    // Get compositionState directly - the single source of truth
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) {
        return;
    }

    const trainerState = getTrainerState();
    const chord = compositionState.getChord(index);
    if (!chord) {
        return;
    }

    // Use the chord's root directly - this is more reliable for non-diatonic chords
    // like secondary dominants (B7 in key of C) where the roman numeral might just be the note name
    const chordRoot = chord.root;
    if (!chordRoot) {
        console.warn('[updateRHOctaveShift] No root note available for chord');
        return;
    }

    // Regenerate notes using getInvertedChordNotes directly with the chord's root and type
    // This is more reliable than getProgressionChordNotes for non-diatonic chords
    const chordResult = getInvertedChordNotes(
        chordRoot,
        chord.type,
        chord.inversion || 0,
        chord.key || trainerState.currentKey,
        0, // Get base notes without octave shift
        getEnharmonicPreference(),
        getNotationPreference()
    );

    if (!chordResult || !chordResult.specificNotes || chordResult.specificNotes.length === 0) {
        console.warn('[updateRHOctaveShift] Could not regenerate notes for chord:', chordRoot, chord.type);
        return;
    }

    const chordInfo = { notes: chordResult.specificNotes };

    // Apply octave shift
    const shiftedNotes = chordInfo.notes.map(note => {
        const match = note.match(/^([A-G][#b]?)(\d+)$/);
        if (!match) return note;
        const noteName = match[1];
        const octave = parseInt(match[2]);
        const newOctave = octave + Math.floor(shift / 12);
        // Clamp octave to valid MIDI range (0-8)
        const clampedOctave = Math.max(0, Math.min(8, newOctave));
        return `${noteName}${clampedOctave}`;
    });

    // Save state for undo BEFORE making changes
    saveStateBeforeChange();

    // Update chord in compositionState
    compositionState.updateChordByIndex(index, {
        octaveShift: shift,
        notes: shiftedNotes
    });

    // Also update trainerState.progressionData to keep in sync
    if (trainerState.progressionData && trainerState.progressionData[index]) {
        trainerState.progressionData[index].octaveShift = shift;
        trainerState.progressionData[index].notes = shiftedNotes;
    }

    // Update only this card
    updateSingleCard(index);

    // Also update the grand staff notation
    updateChordAndRenderPreservingTrebleNotes(index);

    // Play the chord with the new octave (LH is relative to RH, so update LH too)
    const updatedChord = compositionState.getChord(index);
    const voicedNotes = updatedChord.notes.filter(n => !(updatedChord.omittedNotes || []).includes(n));
    const lhRelativeShift = updatedChord.lhOctaveShift || 0;
    const absoluteLHOctaveShift = shift + lhRelativeShift;
    const lhNotes = getLHNotes(
        updatedChord.root,
        updatedChord.lhType,
        updatedChord.lhInversion,
        trainerState.currentKey,
        absoluteLHOctaveShift,
        updatedChord.type,
        getEnharmonicPreference()
    ).filter(n => !(updatedChord.lhOmittedNotes || []).includes(n));
    const allNotes = voicedNotes.concat(lhNotes);
    if (allNotes.length > 0) {
        playTrainerChordOnce(allNotes);
    }
}

/**
 * Toggle staff notation visibility in expanded chord card
 */
function toggleStaffNotationInCard(index) {
    const wrapper = document.querySelector(`.chord-card-wrapper[data-chord-index="${index}"]`);
    if (!wrapper) return;

    const container = wrapper.querySelector('.staff-notation-container');
    const toggleBtn = wrapper.querySelector('.staff-notation-toggle-btn');

    if (!container) return;

    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        if (toggleBtn) toggleBtn.textContent = '♪ Hide Notation';
        // TODO: Render staff notation using VexFlow when available
        // renderStaffNotation(index);
    } else {
        container.classList.add('hidden');
        if (toggleBtn) toggleBtn.textContent = '♪ Show Notation';
    }
}

/**
 * Toggle between chord info and notation view in simplified cards
 * @param {HTMLElement} wrapper - The card wrapper element
 * @param {number} index - The chord index
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
 * Initialize drag/drop sorting for simplified chord sequence
 * @param {HTMLElement} container - Container with simplified cards
 */
function initializeSimplifiedSortable(container) {
    if (typeof Sortable === 'undefined') {
        return;
    }


    if (container.sortableInstance) {
        container.sortableInstance.destroy();
    }

    // Check if we have section containers
    const hasSections = container.querySelector('.section-unified-container') !== null;

    // Main sortable for top-level items (individual cards OR section containers)
    container.sortableInstance = new Sortable(container, {
        group: {
            name: 'progression-cards',
            pull: true,
            put: true  // Accept cards from other sortables (like section-cards-area)
        },
        animation: 200,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        // Use drag-handle class which exists on both cards and section banners
        handle: '.drag-handle, .section-banner',
        // Allow dragging direct children that are cards or sections
        draggable: '.chord-card-wrapper[data-chord-index], .section-unified-container',
        swapThreshold: 0.65,
        onStart: function(evt) {
        },
        // Handle cards added FROM sections TO the main container (ungrouped)
        onAdd: function(evt) {
            // Use the unified handler which handles cross-container moves
            handleCardDragWithinSection(evt, evt.from.getAttribute('data-section-id'));
        },
        onEnd: function(evt) {
            // Cross-container moves are handled by onAdd
            if (evt.from !== evt.to) {
                return;
            }

            const draggedItem = evt.item;

            // Check if we dragged a section container
            if (draggedItem.classList.contains('section-unified-container')) {
                // Section was dragged - need to reorder all chords within it
                handleSectionDragEnd(container, draggedItem, evt);
                return;
            }

            // For same-container moves (reordering ungrouped cards), use the unified handler
            // This ensures section indices are properly updated
            handleCardDragWithinSection(evt, null); // null because cards are ungrouped
            return;

            // DEPRECATED: Old per-card reorder logic below is no longer used
            // Kept for reference but execution never reaches here
            const oldChordIndex = parseInt(draggedItem.getAttribute('data-chord-index'), 10);

            // After the drag, find the new position by looking at sibling order
            // Need to account for cards inside sections vs standalone
            const allChordWrappers = getAllChordWrappersInOrder(container);
            const newPosition = allChordWrappers.indexOf(draggedItem);


            if (oldChordIndex !== newPosition && newPosition >= 0) {
                const actualOldIndex = oldChordIndex;
                const actualNewIndex = newPosition;


                if (actualOldIndex < 0 || actualNewIndex < 0) return; // Shouldn't happen, but safety check

                // Save state for undo BEFORE making changes
                saveStateBeforeChange();

                // Use CompositionState's reorderChord which preserves edited bass notes
                const compositionState = window.getCompositionState ? window.getCompositionState() : null;
                if (compositionState && typeof compositionState.reorderChord === 'function') {

                    // Call reorderChord FIRST - it handles everything internally
                    compositionState.reorderChord(actualOldIndex, actualNewIndex);

                    // AFTER reorderChord completes, sync trainerState from compositionState
                    // This ensures progressionData matches the reordered state
                    const updatedProgression = compositionState.exportToProgressionData();
                    setProgressionData(updatedProgression);
                } else {
                    // Fallback to old behavior if compositionState not available
                    const trainerState = getTrainerState();
                    const progressionData = [...trainerState.progressionData];
                    const progressionRomans = [...trainerState.progressionRomans];

                    // Move items
                    const [movedChord] = progressionData.splice(actualOldIndex, 1);
                    progressionData.splice(actualNewIndex, 0, movedChord);

                    const [movedRoman] = progressionRomans.splice(actualOldIndex, 1);
                    progressionRomans.splice(actualNewIndex, 0, movedRoman);

                    // Update state
                    setProgressionData(progressionData);
                    setProgressionRomans(progressionRomans);

                    // Sync progression to compositionState
                    if (window.syncProgressionToMelodyComposer) {
                        window.syncProgressionToMelodyComposer();
                    }
                }

                // Also update trainerState's progressionRomans to stay in sync
                const trainerState = getTrainerState();
                const progressionRomans = [...trainerState.progressionRomans];
                const [movedRoman] = progressionRomans.splice(actualOldIndex, 1);
                progressionRomans.splice(actualNewIndex, 0, movedRoman);
                setProgressionRomans(progressionRomans);

                // Re-render both views (this will recalculate shifts properly)
                renderProgressionDisplay('melody-progression-visualization', true);
                renderProgressionDisplay('melody-progression-visualization', false);

                // Update grand staff notation
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                } else if (window.getNotationComposer) {
                    const notationComposer = window.getNotationComposer();
                    if (notationComposer) {
                        notationComposer.render();
                    }
                }
            }
        }
    });
}

/**
 * Get all chord card wrappers in visual order (including those inside section containers)
 * @param {HTMLElement} container - The grid/flex container
 * @returns {HTMLElement[]} Array of chord wrappers in visual order
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
 * Handle card drag within or between sections
 * @param {Object} evt - Sortable event
 * @param {string} originalSectionId - The section the card was originally in
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
    const toSectionId = toContainer.getAttribute('data-section-id');
    const fromSectionId = fromContainer.getAttribute('data-section-id');

    console.log('[handleCardDragWithinSection]', {
        oldChordIndex,
        fromSectionId,
        toSectionId,
        isFilteredView,
        visibleChordOrder,
        totalChords
    });

    // Update section membership if changed
    if (fromSectionId !== toSectionId) {
        // Remove from old section
        if (fromSectionId) {
            compositionState.removeChordFromSection(oldChordIndex, fromSectionId);
        }
        // Add to new section (if dropping into a section, not to main container)
        if (toSectionId) {
            const section = compositionState.getSection(toSectionId);
            if (section) {
                // Find position within the new section
                const sectionCards = toContainer.querySelectorAll('.chord-card-wrapper[data-chord-index]');
                const positionInSection = Array.from(sectionCards).indexOf(draggedItem);
                compositionState.addChordToSection(oldChordIndex, toSectionId, positionInSection);
            }
        } else {
        }
    }

    // In filtered view (Section View mode), DON'T do global reorder
    // Just update section membership and re-render
    if (isFilteredView) {
        // Still re-render to update section visuals
        renderProgressionDisplay('melody-progression-visualization', true);
        renderProgressionDisplay('melody-progression-visualization', false);

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
        renderProgressionDisplay('melody-progression-visualization', false);
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

    // Re-render
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

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
 * Handle section container drag end - reorder all chords in the section
 * @param {HTMLElement} container - The grid/flex container
 * @param {HTMLElement} sectionEl - The dragged section container
 * @param {Object} evt - Sortable event
 */
function handleSectionDragEnd(container, sectionEl, evt) {
    const sectionId = sectionEl.getAttribute('data-section-id');
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;

    if (!compositionState || !sectionId) return;

    const section = compositionState.getSection(sectionId);
    if (!section) return;


    // Get the new order of all chords by walking through the container
    const newChordOrder = getAllChordWrappersInOrder(container).map(el => parseInt(el.getAttribute('data-chord-index'), 10));


    // Only proceed if order actually changed
    const trainerState = getTrainerState();
    const oldOrder = trainerState.progressionData.map((_, i) => i);

    if (JSON.stringify(newChordOrder) === JSON.stringify(oldOrder)) {
        return;
    }

    // Save state for undo BEFORE making changes
    saveStateBeforeChange();

    // Reorder progression data to match new order
    const newProgressionData = newChordOrder.map(oldIdx => trainerState.progressionData[oldIdx]);
    const newProgressionRomans = newChordOrder.map(oldIdx => trainerState.progressionRomans[oldIdx]);

    // Update ALL section chord indices to reflect new positions
    // Each section's chords move to their new positions in the reordered array
    compositionState.getSections().forEach(sec => {
        const oldIndices = [...sec.chordIndices];
        const newIndices = sec.chordIndices.map(oldIdx => newChordOrder.indexOf(oldIdx));
        compositionState.updateSection(sec.id, { chordIndices: newIndices.filter(idx => idx >= 0) });
    });

    // Update trainer state (setProgressionData internally calls syncWithProgressionData)
    setProgressionData(newProgressionData);
    setProgressionRomans(newProgressionRomans);

    // Re-render
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

    // Update notation
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }

    // Update voice leading analysis after section reorder
    if (window.updateVoiceLeading) {
        window.updateVoiceLeading();
    }
}

/**
 * PHASE 3.3: Highlight chords that are part of a detected pattern
 * Creates persistent shaded backgrounds behind matched chord sequences
 * @param {Object} pattern - Pattern object with matches array and pattern info
 */
function highlightPatternChords(pattern) {
    // Remove existing highlights
    document.querySelectorAll('.pattern-highlight-active').forEach(el => {
        el.classList.remove('pattern-highlight-active');
        el.removeAttribute('data-pattern-match');
        el.removeAttribute('data-match-index');
        el.style.backgroundColor = '';
        el.style.borderRadius = '';
        el.style.padding = '';
    });

    // Get pattern length from COMMON_PROGRESSIONS (from harmonyAnalyzer.js)
    const patternInfo = COMMON_PROGRESSIONS[pattern.id];
    if (!patternInfo) {
        return;
    }

    // patternInfo.pattern is an array like ['I', 'IV', 'V']
    const patternLength = patternInfo.pattern.length;

    // Array of colors for multiple occurrences (very prominent with higher opacity, thick borders, and shadows)
    const highlightColors = [
        { bg: 'rgba(168, 85, 247, 0.3)', border: 'rgba(168, 85, 247, 0.8)', shadow: '0 4px 12px rgba(168, 85, 247, 0.4)' },   // Purple
        { bg: 'rgba(236, 72, 153, 0.3)', border: 'rgba(236, 72, 153, 0.8)', shadow: '0 4px 12px rgba(236, 72, 153, 0.4)' },   // Pink
        { bg: 'rgba(59, 130, 246, 0.3)', border: 'rgba(59, 130, 246, 0.8)', shadow: '0 4px 12px rgba(59, 130, 246, 0.4)' },   // Blue
        { bg: 'rgba(16, 185, 129, 0.3)', border: 'rgba(16, 185, 129, 0.8)', shadow: '0 4px 12px rgba(16, 185, 129, 0.4)' },   // Green
        { bg: 'rgba(251, 146, 60, 0.3)', border: 'rgba(251, 146, 60, 0.8)', shadow: '0 4px 12px rgba(251, 146, 60, 0.4)' },   // Orange
        { bg: 'rgba(244, 63, 94, 0.3)', border: 'rgba(244, 63, 94, 0.8)', shadow: '0 4px 12px rgba(244, 63, 94, 0.4)' },     // Rose
    ];


    // Highlight all chords in each pattern match
    pattern.matches.forEach((startIndex, matchIdx) => {
        const color = highlightColors[matchIdx % highlightColors.length];


        // Highlight the sequence of cards
        for (let i = 0; i < patternLength; i++) {
            const chordIndex = startIndex + i;

            // Highlight card wrapper (works for both simplified and detailed views)
            const wrapper = document.querySelector(`.chord-card-wrapper[data-chord-index="${chordIndex}"]`);
            if (wrapper) {
                wrapper.classList.add('pattern-highlight-active');
                wrapper.setAttribute('data-pattern-match', pattern.id);
                wrapper.setAttribute('data-match-index', matchIdx);
                wrapper.style.backgroundColor = color.bg;
                wrapper.style.border = `3px solid ${color.border}`;
                wrapper.style.boxShadow = color.shadow;
                wrapper.style.borderRadius = '12px';
                wrapper.style.padding = '4px';
                wrapper.style.transition = 'all 0.3s ease';
            } else {
            }
        }
    });

    // Scroll to first match
    if (pattern.matches.length > 0) {
        const firstMatchWrapper = document.querySelector(`.chord-card-wrapper[data-chord-index="${pattern.matches[0]}"]`);
        if (firstMatchWrapper) {
            firstMatchWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

/**
 * Clear all pattern highlights from chord cards
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

/**
 * PHASE 3.3: Render tension curve visualization
 * Displays harmonic tension as an SVG curve above the progression
 * @param {HTMLElement} container - Container to insert the curve into
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
                    const chord = progressionData[i];
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
 * Highlight a specific tension curve point
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
 * Highlight a specific chord card
 * @param {number} index - Chord index to highlight
 */
function highlightChordCard(index) {
    // First remove all existing highlights
    unhighlightAllChordCards();

    // Highlight the specified card in both containers
    const wrappers = document.querySelectorAll(`.chord-card-wrapper[data-chord-index="${index}"]`);
    wrappers.forEach(wrapper => {
        const card = wrapper.querySelector('.simplified-card, .detailed-card');
        if (card) {
            card.classList.add('ring-4', 'ring-blue-400', 'ring-offset-2');
            card.setAttribute('data-highlighted', 'true');
        }
    });

    // Ensure shifts are maintained after highlighting (in case highlighting triggered any layout changes)
    updateCardShifts();
}

/**
 * Remove highlighting from all chord cards
 */
function unhighlightAllChordCards() {
    const allCards = document.querySelectorAll('.simplified-card[data-highlighted="true"], .detailed-card[data-highlighted="true"]');
    allCards.forEach(card => {
        // Remove blue highlight color
        card.classList.remove('ring-blue-400');
        card.removeAttribute('data-highlighted');

        // Only remove ring-4 and ring-offset-2 if card is NOT selected
        // (selected cards need these classes for their purple ring)
        if (!card.hasAttribute('data-selected')) {
            card.classList.remove('ring-4', 'ring-offset-2');
        } else {
            // Card is selected, ensure purple ring color is applied
            card.classList.add('ring-purple-500');
        }
    });
}

/**
 * Select a chord card (persistent selection state, different from playback highlighting)
 * @param {number} index - Chord index to select
 */
export function selectChordCard(index) {
    // Save selection to state and also update currentIndex to keep them in sync
    setSelectedChordIndex(index);
    setCurrentIndex(index);

    // CRITICAL: Also update multi-select state so getSelectedIndicesArray() returns correct data
    // This is needed for sectionIntentUI to properly track insert position
    clearSelection();
    selectSingle(index);

    // First remove all existing selections (visual)
    deselectAllChordCards();

    // Select the specified card in both containers
    const wrappers = document.querySelectorAll(`.chord-card-wrapper[data-chord-index="${index}"]`);
    wrappers.forEach(wrapper => {
        const card = wrapper.querySelector('.simplified-card, .detailed-card');
        if (card) {
            card.classList.add('ring-4', 'ring-purple-500', 'ring-offset-2');
            card.setAttribute('data-selected', 'true');
        }
    });

    // Ensure shifts are maintained after selection
    updateCardShifts();

    // Bi-directional sync: highlight tension curve point when chord card is selected
    unhighlightAllTensionPoints();
    highlightTensionPointForSelection(index);

    // Sync measure selection with chord card selection (legacy system)
    if (window.setSelectedMeasureIndex) {
        window.setSelectedMeasureIndex(index);
    }

    // Fire event for new notation system bi-directional sync
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('chordCardSelected', {
            detail: { index }
        }));
    }
}

/**
 * Remove selection from all chord cards
 */
function deselectAllChordCards() {
    const allCards = document.querySelectorAll('.simplified-card[data-selected="true"], .detailed-card[data-selected="true"]');
    allCards.forEach(card => {
        card.classList.remove('ring-4', 'ring-purple-500', 'ring-offset-2');
        card.removeAttribute('data-selected');
    });
    // Also clear multi-select visual styling
    const allWrappers = document.querySelectorAll('.chord-card-wrapper.multi-selected');
    allWrappers.forEach(wrapper => {
        wrapper.classList.remove('multi-selected');
    });
}

// ============================================================================
// MULTI-SELECT HELPER FUNCTIONS
// ============================================================================

/**
 * Handle Ctrl/Cmd+click to toggle a card in multi-selection
 * @param {number} index - Chord index
 */
function handleMultiSelectToggle(index) {
    // Toggle the card in the selection set
    toggleSelection(index);

    // Update visual state
    updateMultiSelectVisuals();

    // Update card shifts
    updateCardShifts();
}

/**
 * Handle Shift+click to range-select from last selected to this card
 * @param {number} index - Chord index
 */
function handleMultiSelectRange(index) {
    // Get the last selected index
    const lastIndex = getLastSelectedIndex();

    if (lastIndex === null) {
        // No previous selection, just select this one
        selectSingle(index);
    } else {
        // Range select from lastIndex to index
        selectRange(lastIndex, index);
    }

    // Update visual state
    updateMultiSelectVisuals();

    // Update card shifts
    updateCardShifts();
}

/**
 * Update visual styles for all cards based on multi-select state
 */
function updateMultiSelectVisuals() {
    const selectedIndices = getSelectedIndicesArray();

    // First, clear all multi-select visuals
    const allWrappers = document.querySelectorAll('.chord-card-wrapper');
    allWrappers.forEach(wrapper => {
        wrapper.classList.remove('multi-selected');
        const card = wrapper.querySelector('.simplified-card, .detailed-card');
        if (card) {
            card.classList.remove('ring-4', 'ring-purple-500', 'ring-offset-2', 'ring-blue-500');
            card.removeAttribute('data-selected');
        }
    });

    // Apply multi-select styling to selected cards
    selectedIndices.forEach((idx, i) => {
        const wrappers = document.querySelectorAll(`.chord-card-wrapper[data-chord-index="${idx}"]`);
        wrappers.forEach(wrapper => {
            wrapper.classList.add('multi-selected');
            const card = wrapper.querySelector('.simplified-card, .detailed-card');
            if (card) {
                card.setAttribute('data-selected', 'true');
                // First selected gets purple ring, others get blue
                if (i === 0) {
                    card.classList.add('ring-4', 'ring-purple-500', 'ring-offset-2');
                } else {
                    card.classList.add('ring-4', 'ring-blue-500', 'ring-offset-2');
                }
            }
        });
    });

    // Update selection count display (if we add one later)
    const count = selectedIndices.length;
    if (count > 1) {
    }
}

/**
 * Clear multi-selection and update visuals
 */
function clearMultiSelection() {
    clearSelection();
    updateMultiSelectVisuals();
}

// Expose to window for keyboard shortcuts
window.clearMultiSelection = clearMultiSelection;

// ============================================================================
// GLOBAL KEYBOARD SHORTCUTS FOR MULTI-SELECT AND SECTIONS
// ============================================================================

// Set up global keyboard shortcuts (runs once when module loads)
(function setupGlobalKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't handle shortcuts when typing in inputs/textareas
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }

        // Escape: Clear multi-selection
        if (e.key === 'Escape') {
            const selectionCount = getSelectionCount();
            if (selectionCount > 0) {
                clearMultiSelection();
                e.preventDefault();
            }
        }

        // Ctrl/Cmd+A: Select all chords in the current section (or all if no section focused)
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
            const trainerState = getTrainerState();
            const progressionCount = trainerState.progressionData?.length || 0;

            if (progressionCount > 0) {
                // Select all chords
                for (let i = 0; i < progressionCount; i++) {
                    addToSelection(i);
                }
                updateMultiSelectVisuals();
                e.preventDefault();
            }
        }

        // Delete/Backspace: Only for notation - don't delete chord cards with keyboard
        // Chord cards should only be deleted via their delete button
        if (e.key === 'Delete' || e.key === 'Backspace') {
            // Let notation editor handle it if it has selected notes
            // Otherwise, do nothing (don't delete chord cards)
            return;
        }

        // Ctrl/Cmd+C: Copy selected chords
        if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            const selectedIndices = getSelectedIndicesArray();
            if (selectedIndices.length > 0) {
                copySelectedChords(selectedIndices);
                e.preventDefault();
            }
        }

        // Ctrl/Cmd+V: Paste chords
        if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            pasteChords();
            e.preventDefault();
        }

        // Ctrl/Cmd+D: Duplicate selected chords
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            const selectedIndices = getSelectedIndicesArray();
            if (selectedIndices.length > 0) {
                duplicateSelectedChords(selectedIndices);
                e.preventDefault();
            }
        }
    });
})();

/**
 * Delete selected chords with confirmation
 * @param {number[]} indices - Array of chord indices to delete
 */
function deleteSelectedChords(indices) {
    if (indices.length === 0) return;

    // Confirm if deleting multiple
    if (indices.length > 1) {
        if (!confirm(`Delete ${indices.length} selected chords?`)) {
            return;
        }
    }

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    // Save state for undo before making changes
    saveStateBeforeChange();

    // Delete in reverse order to preserve indices
    const sortedIndices = [...indices].sort((a, b) => b - a);
    sortedIndices.forEach(idx => {
        compositionState.removeChord(idx);
    });

    // Clear selection
    clearMultiSelection();

    // Re-render
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);
}

/**
 * Copy selected chords to clipboard
 * @param {number[]} indices - Array of chord indices to copy
 */
function copySelectedChords(indices) {
    if (indices.length === 0) return;

    const trainerState = getTrainerState();
    const progressionData = trainerState.progressionData || [];

    // Get chord data for selected indices
    const chordsToCopy = indices
        .filter(idx => idx < progressionData.length)
        .sort((a, b) => a - b)
        .map(idx => ({ ...progressionData[idx] }));

    if (chordsToCopy.length > 0) {
        setClipboard({ type: 'chords', data: chordsToCopy });
    }
}

/**
 * Paste chords from clipboard
 */
function pasteChords() {
    const clipboard = getClipboard();
    if (!clipboard || clipboard.type !== 'chords' || !clipboard.data?.length) {
        return;
    }

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    // Save state for undo before making changes
    saveStateBeforeChange();

    const trainerState = getTrainerState();
    const progressionData = trainerState.progressionData || [];

    // Find insertion point (after last selected, or at end)
    const selectedIndices = getSelectedIndicesArray();
    let insertAt = progressionData.length;
    if (selectedIndices.length > 0) {
        insertAt = Math.max(...selectedIndices) + 1;
    }

    // Insert each chord
    clipboard.data.forEach((chord, i) => {
        const newChord = { ...chord };
        // Insert at the appropriate position
        compositionState.insertChord(insertAt + i, newChord);
    });

    // Clear selection and select pasted chords
    clearSelection();
    for (let i = 0; i < clipboard.data.length; i++) {
        addToSelection(insertAt + i);
    }

    // Re-render
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

    updateMultiSelectVisuals();
}

/**
 * Duplicate selected chords (insert copies after the selection)
 * @param {number[]} indices - Array of chord indices to duplicate
 */
function duplicateSelectedChords(indices) {
    if (indices.length === 0) return;

    const trainerState = getTrainerState();
    const progressionData = trainerState.progressionData || [];
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    // Save state for undo before making changes
    saveStateBeforeChange();

    // Get chord data for selected indices
    const chordsToDuplicate = indices
        .filter(idx => idx < progressionData.length)
        .sort((a, b) => a - b)
        .map(idx => ({ ...progressionData[idx] }));

    if (chordsToDuplicate.length === 0) return;

    // Insert after the last selected chord
    const insertAt = Math.max(...indices) + 1;

    // Insert each chord
    chordsToDuplicate.forEach((chord, i) => {
        compositionState.insertChord(insertAt + i, { ...chord });
    });

    // Clear selection and select duplicated chords
    clearSelection();
    for (let i = 0; i < chordsToDuplicate.length; i++) {
        addToSelection(insertAt + i);
    }

    // Re-render
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

    updateMultiSelectVisuals();
}

// Expose clipboard functions to window
window.copySelectedChords = () => copySelectedChords(getSelectedIndicesArray());
window.pasteChords = pasteChords;
window.duplicateSelectedChords = () => duplicateSelectedChords(getSelectedIndicesArray());
window.deleteSelectedChords = () => deleteSelectedChords(getSelectedIndicesArray());

/**
 * Remove highlighting from all tension curve points
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
 * Show detailed tooltip for tension curve point
 * @param {MouseEvent} e - Mouse event
 * @param {Object} chord - Chord data
 * @param {number} tension - Tension value
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
 * Render the progression display with all chord cards
 * Shows chord cards with controls for type, inversion, voicing, LH settings
 *
 * CHORD CARD UPDATE DEBUGGING: If cards don't update after data changes, see the
 * comprehensive debugging guide in trainerState.js (search for "CHORD CARD UPDATE FLOW").
 *
 * This function:
 * 1. Gets fresh data from getTrainerState().progressionData (which calls getProgressionData())
 * 2. Clears the container and rebuilds all chord cards from scratch
 * 3. Does NOT modify the data - only reads and renders
 *
 * Common issue: If cards show stale data, the problem is usually in the data update
 * step BEFORE this function is called. Check that:
 * - setProgressionData() was called with the new data
 * - invalidateProgressionDataCache() was called (happens automatically in setProgressionData)
 * - This render function is called AFTER the data update completes
 *
 * @param {string} containerId - Optional container ID. Defaults to 'progression-visualization'
 * @param {boolean} syncBothTabs - If true, also updates the other tab. Defaults to true for main container, false for melody container
 */
export function renderProgressionDisplay(containerId = 'progression-visualization', syncBothTabs = true) {
    // DEBUGGING: Uncomment to trace when render is called
    // console.log('[renderProgressionDisplay] Rendering', containerId);

    // Capture staff notation states before clearing DOM (always capture from both tabs)
    captureStaffNotationStates();
    
    const container = document.getElementById(containerId);
    if (!container) {
        return;
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
        if (progressionViewMode === 'section' && sections.length > 0) {
            // Section View Mode: show section picker and filtered cards
            gridContainer.className = 'flex flex-col gap-2';
            renderSectionViewMode(gridContainer, trainerState.progressionData, trainerState.currentKey || 'C', sections);
        } else if (progressionViewMode === 'scroll') {
            // Scroll View Mode: horizontal scrolling
            renderScrollViewMode(gridContainer, trainerState.progressionData, trainerState.currentKey || 'C', {
                showActionButtons: true
            });
            // Initialize sortable on the grid container
            initializeSimplifiedSortable(gridContainer);
        } else {
            // Default: Use flexbox with wrapping; section-aware rendering controls its own layout
            gridContainer.className = 'flex flex-wrap items-start gap-2';
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
    if (containerId === 'melody-progression-visualization' && trainerState.progressionData.length > 0) {
        // Check if we have any sections defined - if so, use section-aware rendering
        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        const sections = compositionState ? compositionState.getSections() : [];
        const hasSections = sections.length > 0;

        // Same restructured layout as Progression Builder
        container.innerHTML = '';
        container.className = 'flex flex-col gap-2 p-2 bg-white rounded-lg border border-gray-200';

        // Populate header toggle if we have sections (toggle is in the Chord Progression header)
        const headerToggle = document.getElementById('header-section-view-toggle');
        if (headerToggle) {
            if (sections.length > 0) {
                headerToggle.innerHTML = '';
                headerToggle.className = 'flex items-center gap-1 ml-2';
                headerToggle.appendChild(createCompactViewModeToggle());
            } else {
                headerToggle.innerHTML = '';
                headerToggle.className = 'hidden ml-2';
            }
        }

        // Create container for cards
        const gridContainer = document.createElement('div');
        gridContainer.id = `${containerId}-cards-grid`;

        // Branch based on view mode
        if (progressionViewMode === 'section' && sections.length > 0) {
            // Section View Mode: show section picker and filtered cards
            gridContainer.className = 'flex flex-col gap-2';
            renderSectionViewMode(gridContainer, trainerState.progressionData, trainerState.currentKey || 'C', sections);
        } else if (progressionViewMode === 'scroll') {
            // Scroll View Mode: horizontal scrolling
            renderScrollViewMode(gridContainer, trainerState.progressionData, trainerState.currentKey || 'C', {
                showActionButtons: true
            });
            // Initialize sortable on the grid container
            initializeSimplifiedSortable(gridContainer);
        } else {
            // Default: Use flexbox with wrapping
            gridContainer.className = 'flex flex-wrap items-start gap-2';
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

        // Also update the Composition Studio's notation
        if (window.refreshNotationFromProgression) {
            // Use requestAnimationFrame to ensure system is ready
            requestAnimationFrame(() => {
                // Sync progression to compositionState first
                if (window.syncProgressionToMelodyComposer && window.getCompositionState) {
                    window.syncProgressionToMelodyComposer();
                }
                // Then refresh notation - but respect section view filtering!
                if (progressionViewMode === 'section' && selectedSectionIds.size > 0) {
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
                getEnharmonicPreference()
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
                getEnharmonicPreference()
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
            getEnharmonicPreference()
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
                    getEnharmonicPreference()
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
                    getEnharmonicPreference()
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
            filter: 'button, .progression-chord-item button, [data-chord-index], select, input, label, .no-drag, [role="button"]',
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
                    const otherContainerId = containerId === 'progression-visualization'
                        ? 'melody-progression-visualization'
                        : 'progression-visualization';
                    renderProgressionDisplay(otherContainerId, false);

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
            renderProgressionDisplay('melody-progression-visualization', false);
            return window.ddInspect();
        };
    }
    
    // Restore staff notation states after rendering is complete
    restoreStaffNotationStates();

    // Update unified suggestions panel
    if (window.updateUnifiedSuggestions) {
        window.updateUnifiedSuggestions();
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

// ============================================================================
// Progression Loading and Management
// ============================================================================

/**
 * Load a progression from the dropdown selector
 * Initializes progression data and scale highlighting
 */
export function loadProgression() {
    const keySelect = document.getElementById('trainer-key-select');
    const progressionSelect = document.getElementById('trainer-progression-select');

    const trainerState = getTrainerState();

    // Stop playback if currently playing - but only if we're not already stopping
    // This prevents infinite recursion when handleAutoPlayback calls loadProgression
    if (trainerState.isPlaying && window.handleAutoPlayback && !trainerState._isStopping) {
        // Set a flag to prevent recursion
        trainerState._isStopping = true;
        handleAutoPlayback();
        trainerState._isStopping = false;
    }

    setCurrentKey(keySelect.value);

    // Automatically set enharmonic preference based on key signature
    // Keys with flats in their signature should display flats
    const selectedKey = keySelect.value.replace('m', ''); // Remove minor indicator
    const flatKeys = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
    if (flatKeys.includes(selectedKey)) {
        setEnharmonicPreference('flat');
    } else {
        setEnharmonicPreference('sharp');
    }

    setProgressionRomans(progressionSelect.value.split(','));
    setCurrentIndex(0);
    setIsPlaying(false);

    // Set isReady using the setter function
    setIsReady(true);
    
    // Get fresh trainerState after setting everything
    const freshTrainerState = getTrainerState();
    
    // Update window.trainerState immediately so updateKeyboardLabels can use it
    if (typeof window !== 'undefined') {
        window.trainerState = freshTrainerState;
    }
    

    // Clear any existing card highlights
    document.querySelectorAll('.active-progression-card').forEach(card => card.classList.remove('active-progression-card'));

    // Calculate scale notes using fresh state
    const scaleNotes = calculateScaleNotes(freshTrainerState.currentKey, 4, freshTrainerState.octaveShift);
    setScaleNotes(scaleNotes);

    // Generate progression data using fresh state
    // Check if key is minor
    const currentKey = freshTrainerState.currentKey;
    const isMinorKey = currentKey && currentKey.endsWith('m');
    
    // Convert Roman numerals to minor case if key is minor
    const convertToMinorCase = (roman) => {
        const minorMap = {
            'I': 'i',
            'ii': 'ii°',
            'iii': 'III',
            'IV': 'iv',
            'V': 'v',
            'vi': 'VI',
            'vii°': 'VII'
        };
        return minorMap[roman] || roman;
    };
    
    const progressionData = freshTrainerState.progressionRomans.map(roman => {
        // Convert Roman numeral to minor case if key is minor
        const displayRoman = isMinorKey ? convertToMinorCase(roman) : roman;
        
        // Handle roman numerals with accidental prefixes (bVII, #IV, etc.)
        let baseRoman = roman;
        if (roman.startsWith('b') || roman.startsWith('#') || roman.startsWith('♯')) {
            baseRoman = roman.substring(1); // Remove accidental prefix
        }
        
        // Try to find the base roman numeral in the map
        let baseInfo = ROMAN_MAP_BASE[roman] || ROMAN_MAP_BASE[baseRoman];
        
        // For borrowed chords (with accidental), default quality based on common patterns
        // bVII in rock is typically Major, #IV is typically Major, etc.
        let chordType = 'Major'; // Default for borrowed chords
        if (baseInfo) {
            chordType = baseInfo.quality;
        } else if (baseRoman === 'VII' || baseRoman === 'vii') {
            // VII (without degree) is typically Major when borrowed
            chordType = 'Major';
        }
        
        // Get key without 'm' suffix for calculation
        const keyForCalculation = isMinorKey ? currentKey.replace(/m$/, '') : currentKey;
        const chordData = getProgressionChordNotes(keyForCalculation, roman, chordType, 0, freshTrainerState.octaveShift);
        if (chordData) {
            // Validate and filter notes to ensure they're all valid strings
            if (chordData.notes && Array.isArray(chordData.notes)) {
                chordData.notes = chordData.notes.filter(note => 
                    note != null && note !== '' && typeof note === 'string' && note !== 'NaN' && !note.includes('undefined') && !note.includes('NaN')
                );
            }
            // Use the converted Roman numeral for display
            chordData.roman = displayRoman;
            // Set default LH settings for newly loaded progressions
            chordData.lhType = 'off';
            chordData.lhInversion = 0;
            chordData.lhOctaveShift = 0;
            chordData.lhOmittedNotes = [];
            chordData.rhythmPattern = 'block';
            chordData.selectionMode = 'chord';
            chordData.omittedNotes = [];
            chordData.octaveShift = 0;
        }
        return chordData;
    }).filter(Boolean); // Remove any nulls if getProgressionChordNotes fails

    setProgressionData(progressionData);

    updateProgressionControlsUI();
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);
    highlightTrainer(scaleNotes, null);

    // Update keyboard labels (function to be imported from UI module)
    // Always update to ensure Roman numerals are shown if enabled
    // This must be called after window.trainerState is updated
    // Use a small delay to ensure state is fully updated
    if (window.updateKeyboardLabels) {
        setTimeout(() => {
            window.updateKeyboardLabels();
        }, 10);
    }

    // Display key name with proper quality
    const keyDisplayName = freshTrainerState.currentKey;
    const isMinor = keyDisplayName && keyDisplayName.endsWith('m');
    const keyQuality = isMinor ? ' minor' : ' Major';
    document.getElementById('progression-chord-notes-display').textContent = 'Ready: ' + keyDisplayName + keyQuality;

    // Update key signature display (function to be imported from UI module)
    if (window.updateKeySignatureDisplay) {
        window.updateKeySignatureDisplay(freshTrainerState.currentKey);
    }
    
    // Update key signature text (function to be imported from UI module)
    if (window.updateKeySignatureText) {
        window.updateKeySignatureText(freshTrainerState.currentKey);
    }

    // Update unified suggestions (tension score, mood, etc.)
    if (window.updateUnifiedSuggestions) {
        window.updateUnifiedSuggestions();
    }

    // Update "Current Key" display text
    updateCurrentKeyDisplay();

    // Sync progression to compositionState first, then refresh notation
    if (window.syncProgressionToMelodyComposer) {
        window.syncProgressionToMelodyComposer();
    }
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }

    // Dispatch event for guided lesson mode
    if (isGuidedModeActive()) {
        dispatchBuilderEvent('progressionKeyChanged', {
            key: freshTrainerState.currentKey
        });
    }

    // Update key display in melody tab header
    const melodyCurrentKeyDisplay = document.getElementById('melody-current-key-display');
    if (melodyCurrentKeyDisplay && freshTrainerState.currentKey) {
        melodyCurrentKeyDisplay.textContent = freshTrainerState.currentKey;
    }
}

/**
 * Update enharmonic spellings for all chords in the progression without regenerating chord data
 * Called when the user changes the accidental preference (sharp/flat)
 */
export function updateProgressionEnharmonics() {
    const trainerState = getTrainerState();
    const progressionData = trainerState.progressionData;

    if (!progressionData || progressionData.length === 0) {
        return;
    }

    const enharmonicPref = getEnharmonicPreference();
    const targetNotes = enharmonicPref === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    const sourceNotes = enharmonicPref === 'sharp' ? FLAT_NOTES : SHARP_NOTES;

    // Helper to convert a note name (without octave) to the target enharmonic
    const convertNoteName = (noteName) => {
        if (!noteName) return noteName;

        // Check if it's already in the target array
        if (targetNotes.includes(noteName)) {
            return noteName;
        }

        // Find in source array and get equivalent from target
        const sourceIndex = sourceNotes.indexOf(noteName);
        if (sourceIndex !== -1) {
            return targetNotes[sourceIndex];
        }

        // Handle special cases like double sharps/flats or unusual spellings
        // Try ALL_NOTES as fallback
        const allNotesIndex = ALL_NOTES.indexOf(noteName);
        if (allNotesIndex !== -1) {
            return targetNotes[allNotesIndex];
        }

        // If not found in any array, check ENHARMONIC_MAP
        if (ENHARMONIC_MAP[noteName]) {
            const mappedNote = ENHARMONIC_MAP[noteName];
            const mappedIndex = sourceNotes.indexOf(mappedNote);
            if (mappedIndex !== -1) {
                return targetNotes[mappedIndex];
            }
            return mappedNote;
        }

        return noteName;
    };

    // Update each chord in the progression
    progressionData.forEach(chord => {
        if (!chord) return;

        // Convert root note
        const oldRoot = chord.root;
        const newRoot = convertNoteName(oldRoot);
        chord.root = newRoot;

        // Convert notes array (notes with octaves)
        if (chord.notes && Array.isArray(chord.notes)) {
            chord.notes = chord.notes.map(noteWithOctave => {
                if (!noteWithOctave || typeof noteWithOctave !== 'string') return noteWithOctave;
                return resolveEnharmonic(noteWithOctave, trainerState.currentKey, enharmonicPref);
            });
        }

        // Update simpleName with new root
        if (chord.simpleName && oldRoot !== newRoot) {
            chord.simpleName = chord.simpleName.replace(new RegExp('^' + escapeRegex(oldRoot)), newRoot);
        }

        // Update name with new root
        if (chord.name && oldRoot !== newRoot) {
            chord.name = chord.name.replace(new RegExp('^' + escapeRegex(oldRoot)), newRoot);
        }

        // Convert lhNotes if present
        if (chord.lhNotes && Array.isArray(chord.lhNotes)) {
            chord.lhNotes = chord.lhNotes.map(noteWithOctave => {
                if (!noteWithOctave || typeof noteWithOctave !== 'string') return noteWithOctave;
                return resolveEnharmonic(noteWithOctave, trainerState.currentKey, enharmonicPref);
            });
        }
    });

    // Update the state with modified data
    setProgressionData(progressionData);

    // Re-render the display
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

    // Update keyboard labels
    if (window.updateKeyboardLabels) {
        setTimeout(() => {
            window.updateKeyboardLabels();
        }, 10);
    }
}

// Helper function to escape special regex characters
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Update the current key display text (both trainer and melody tabs)
 */
function updateCurrentKeyDisplay() {
    const trainerState = getTrainerState();
    const currentKey = trainerState.currentKey || 'C';

    // Update trainer tab display
    const displayText = document.getElementById('current-key-display-text');
    if (displayText) {
        displayText.textContent = currentKey;
    }

    // Update melody tab (Composition Studio) display
    const melodyDisplayText = document.getElementById('melody-key-display-text');
    if (melodyDisplayText) {
        melodyDisplayText.textContent = currentKey;
    }
}

/**
 * Calculate scale notes for a given key
 * @param {string} key - Root note of the scale
 * @param {number} octave - Base octave
 * @param {number} octaveShift - Octave shift from base
 * @returns {Array<string>} Array of scale note names with octaves
 */
function calculateScaleNotes(key, octave = 4, octaveShift = 0) {
    const baseOctave = octave + octaveShift;
    let scaleRootIndex = ALL_NOTES.indexOf(key);
    if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[key]);

    const scaleRootMidi = noteToMidi(ALL_NOTES[scaleRootIndex] + baseOctave);
    const scaleMidiNotes = MAJOR_SCALE_STEPS.map(step => scaleRootMidi + step);
    const rawNoteNames = scaleMidiNotes.map(midi => Tone.Midi(midi).toNote());
    const resolvedNoteNames = rawNoteNames.map(note => resolveEnharmonic(note, key, getEnharmonicPreference()));

    return resolvedNoteNames;
}

/**
 * Get chord notes for a progression chord
 * @param {string} key - Key signature
 * @param {string} romanNumeral - Roman numeral or note name
 * @param {string} selectedType - Chord type
 * @param {number} selectedInversion - Inversion
 * @param {number} octaveShift - Octave shift
 * @returns {Object|null} Chord data object
 */
export function getProgressionChordNotes(key, romanNumeral, selectedType, selectedInversion, octaveShift = 0) {
    // Guard against null/undefined romanNumeral
    if (!romanNumeral) {
        console.warn('[getProgressionChordNotes] romanNumeral is null or undefined');
        return null;
    }

    let mapEntry = ROMAN_MAP_BASE[romanNumeral];
    let chordRootNote = '';

    // Handle roman numerals with flat (#) or flat (b) prefixes (e.g., bVII, #IV)
    let accidental = '';
    let baseRoman = romanNumeral;

    // Handle secondary dominants (e.g., V/iii, V/vi, V/V)
    if (romanNumeral.includes('/')) {
        const parts = romanNumeral.split('/');
        const targetRoman = parts[1]; // The chord we're targeting (e.g., 'iii' in 'V/iii')

        // Find the root of the target chord
        const targetEntry = ROMAN_MAP_BASE[targetRoman] || ROMAN_MAP_BASE[targetRoman.replace(/[°7]/g, '')];
        if (targetEntry) {
            let scaleRootIndex = ALL_NOTES.indexOf(key);
            if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[key]);

            const targetStep = MAJOR_SCALE_STEPS[targetEntry.index];
            const targetRootIndex = (scaleRootIndex + targetStep) % 12;

            // The secondary dominant is a perfect 5th above the target
            // V/x means the dominant of x, which is 7 semitones above x
            const secondaryDomIndex = (targetRootIndex + 7) % 12;
            chordRootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[secondaryDomIndex];

            // Return early with the resolved chord
            if (chordRootNote) {
                const chordResult = getInvertedChordNotes(
                    chordRootNote,
                    selectedType,
                    selectedInversion,
                    key,
                    octaveShift,
                    getEnharmonicPreference(),
                    getNotationPreference()
                );

                if (chordResult && chordResult.specificNotes) {
                    const validNotes = (chordResult.specificNotes || []).filter(note =>
                        note != null && note !== '' && typeof note === 'string' && note !== 'NaN' && !note.includes('undefined') && !note.includes('NaN')
                    );

                    if (validNotes.length > 0) {
                        return {
                            roman: romanNumeral,
                            name: chordResult.name || 'N/A',
                            simpleName: chordResult.simpleName || 'N/A',
                            notes: validNotes,
                            root: chordRootNote,
                            type: selectedType,
                            inversion: selectedInversion
                        };
                    }
                }
            }
        }
    }

    // Strip chord quality suffixes from roman numeral before lookup (e.g., ii7 -> ii, Imaj7 -> I)
    // This handles cases like ii7, V7, Imaj7, viio7, IVmaj9, Vsus4, vi6, etc.
    const cleanRoman = romanNumeral.replace(
        /maj13|min13|maj11|min11|maj9|min9|maj7|min7|dim7|aug7|add13|add11|add9|sus4|sus2|13|11|9|7|6|°|ø|\+/gi,
        ''
    );

    // Check for flat or sharp prefix
    if (cleanRoman.startsWith('b')) {
        accidental = 'flat';
        baseRoman = cleanRoman.substring(1); // Remove 'b' prefix
    } else if (cleanRoman.startsWith('#') || cleanRoman.startsWith('♯')) {
        accidental = 'sharp';
        baseRoman = cleanRoman.substring(1); // Remove '#' or '♯' prefix
    } else {
        baseRoman = cleanRoman;
    }

    // Try to find the base roman numeral in the map
    mapEntry = ROMAN_MAP_BASE[baseRoman];

    // If the roman numeral isn't standard (e.g., it's a note name like 'Db'),
    // we handle it as a non-diatonic chord.
    if (!mapEntry) {
        // If it has an accidental prefix, it's likely a borrowed chord - try to parse it
        if (accidental && baseRoman) {
            // Try common roman numeral patterns
            const romanToIndex = {
                'I': 0, 'II': 1, 'III': 2, 'IV': 3, 'V': 4, 'VI': 5, 'VII': 6,
                'i': 0, 'ii': 1, 'iii': 2, 'iv': 3, 'v': 4, 'vi': 5, 'vii': 6
            };
            
            // Handle 'VII' without the degree symbol
            const baseForLookup = baseRoman.replace('°', '').replace('°', '');
            const scaleDegreeIndex = romanToIndex[baseForLookup];
            
            if (scaleDegreeIndex !== undefined) {
                let scaleRootIndex = ALL_NOTES.indexOf(key);
                if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[key]);

                // Get the diatonic scale step
                const scaleStep = MAJOR_SCALE_STEPS[scaleDegreeIndex];
                let chordRootIndex = (scaleRootIndex + scaleStep) % 12;

                // Apply accidental (flat lowers by 1 semitone, sharp raises by 1 semitone)
                if (accidental === 'flat') {
                    chordRootIndex = (chordRootIndex - 1 + 12) % 12;
                } else if (accidental === 'sharp') {
                    chordRootIndex = (chordRootIndex + 1) % 12;
                }

                chordRootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[chordRootIndex];
            } else {
                chordRootNote = cleanRoman; // Fall back to treating as note name (use cleaned version)
            }
        } else {
            chordRootNote = cleanRoman; // The 'romanNumeral' is actually the root note (use cleaned version)
        }
    } else {
        let scaleRootIndex = ALL_NOTES.indexOf(key);
        if (scaleRootIndex === -1) scaleRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[key]);

        const scaleStep = MAJOR_SCALE_STEPS[mapEntry.index];
        let chordRootIndex = (scaleRootIndex + scaleStep) % 12;
        
        // Apply accidental if present
        if (accidental === 'flat') {
            chordRootIndex = (chordRootIndex - 1 + 12) % 12;
        } else if (accidental === 'sharp') {
            chordRootIndex = (chordRootIndex + 1) % 12;
        }
        
        chordRootNote = (getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES)[chordRootIndex];
    }

    if (!chordRootNote) {
        return null; // Could not determine root note
    }

    const chordResult = getInvertedChordNotes(
        chordRootNote,
        selectedType,
        selectedInversion,
        key,
        octaveShift,
        getEnharmonicPreference(),
        getNotationPreference()
    );

    // Validate chordResult
    if (!chordResult || !chordResult.specificNotes) {
        return null;
    }

    // Validate and filter notes to ensure they're all valid strings
    const validNotes = (chordResult.specificNotes || []).filter(note => 
        note != null && note !== '' && typeof note === 'string' && note !== 'NaN' && !note.includes('undefined') && !note.includes('NaN')
    );
    
    // If no valid notes, return null
    if (validNotes.length === 0) {
        return null;
    }

    return {
        roman: romanNumeral,
        name: chordResult.name || 'N/A',
        simpleName: chordResult.simpleName || 'N/A',
        notes: validNotes,
        root: chordRootNote,
        type: selectedType,
        inversion: selectedInversion
    };
}

// ============================================================================
// Playback Functions
// ============================================================================

/**
 * Handle auto-playback of the progression
 * Toggles between play and stop states
 */
export function handleAutoPlayback() {
    initAudio();
    
    if (!getAudioIsReady()) {
        if (!getAudioIsLoading() && window.showModal) {
            window.showModal("Loading piano samples...", false);
        }
        return;
    }

    // Get fresh state - always read from getter, not cached variable
    let trainerState = getTrainerState();

    // Check isPlaying from fresh state - also check window.trainerState for consistency
    const isCurrentlyPlaying = trainerState.isPlaying || (window.trainerState && window.trainerState.isPlaying);
    
    if (isCurrentlyPlaying) {
        // We're stopping - don't load progression, just stop playback
        // CRITICAL: Stop Transport FIRST to prevent any new events from firing
        Tone.Transport.stop();
        Tone.Transport.cancel(); // This clears all scheduleOnce callbacks
        
        // Now stop the transport Part - it won't schedule new events because Transport is stopped
        const transportId = trainerState.transportId || (window.trainerState && window.trainerState.transportId);
        if (transportId) {
            try {
                // Stop the Part - this stops all scheduled events in the Part
                transportId.stop(0);
                // Then dispose it to clean up
                transportId.dispose();
            } catch (e) {
                // Ignore errors
            }
            trainerState.transportId = null;
            if (window.trainerState) {
                window.trainerState.transportId = null;
            }
        }
        
        // Cancel all scheduled callbacks (in case any were missed)
        if (trainerState.scheduledCallbacks) {
            trainerState.scheduledCallbacks.forEach(id => {
                try {
                    Tone.Transport.clear(id);
                } catch (e) {
                    // Ignore errors
                }
            });
            trainerState.scheduledCallbacks = [];
        }
        
        // Stop all currently playing notes - do this AFTER Transport is stopped
        // to prevent any new notes from being triggered
        const instrument = getInstrument();
        if (instrument && getAudioIsReady()) {
            try {
                // Release ALL notes that might be playing - this is the key fix
                // releaseAll() releases all notes that are currently attacking or sustaining
                instrument.releaseAll(Tone.now());
            } catch (e) {
                // Ignore errors
            }
            
            // Also explicitly release any tracked chord notes
            const currentState = getTrainerState();
            if (currentState.trainerChordNotes && currentState.trainerChordNotes.length > 0) {
                try {
                    // Manually trigger release for each note
                    currentState.trainerChordNotes.forEach(note => {
                        try {
                            instrument.triggerRelease(note, Tone.now());
                        } catch (e) {
                            // Ignore individual note errors
                        }
                    });
                    setTrainerChordNotes([]);
                } catch (e) {
                    // Ignore errors
                }
            }
        }
        
        // Call stopTrainerChord after releasing all notes
        stopTrainerChord();
        
        if (window.scalePlaySequence) {
            window.scalePlaySequence.stop().dispose();
            window.scalePlaySequence = null;
        }
        
        // Update state before updating UI
        setIsPlaying(false);
        setCurrentIndex(0);
        
        // Get fresh state after updating
        const freshState = getTrainerState();
        freshState.isPlaying = false; // Ensure it's explicitly false
        
        // Sync state to window for other modules - ensure isPlaying is false
        if (typeof window !== 'undefined') {
            if (!window.trainerState) window.trainerState = {};
            window.trainerState = freshState;
            window.trainerState.isPlaying = false; // Explicitly set to false
            window.trainerState.transportId = null; // Ensure transportId is cleared
        }
        
        document.getElementById('progression-chord-notes-display').textContent = 'Playback Stopped (Reset)';
        
        // Clear all chord highlights when stopping
        if (window.clearHighlights) {
            window.clearHighlights();
        }
        highlightTrainer(freshState.scaleNotes, null);
        
        // Clear card highlights on stop
        document.querySelectorAll('.active-progression-card').forEach(card => {
            card.classList.remove('active-progression-card');
        });

        // Clear tension curve and chord card highlights
        unhighlightAllTensionPoints();
        unhighlightAllChordCards();
        
        // Update UI immediately - this must be called after state is updated
        // Use fresh state to ensure UI reflects the correct state
        updateProgressionControlsUI();
        
        return;
    }
    

    // We're starting playback - ensure progression is loaded
    // Only load from dropdown if there's no progression data (e.g., after import, we have data but isReady might be false)
    if (!trainerState.isReady) {
        // Check if we already have progression data (e.g., from import)
        if (trainerState.progressionData && trainerState.progressionData.length > 0) {
            // We have progression data, just mark as ready
            setIsReady(true);
            trainerState = getTrainerState(); // Refresh state
        } else {
            // No progression data, load from dropdown
            loadProgression();
            // Get fresh state after loading
            trainerState = getTrainerState();
            if (!trainerState.isReady || !trainerState.progressionData || trainerState.progressionData.length === 0) {
                // If still not ready after loading, return
                return;
            }
        }
    }

    // Always start playback from the first chord and select it (purple outline)
    selectChordCard(0);

    setIsPlaying(true);
    
    // Sync state to window for other modules - get fresh state after setting isPlaying
    const freshState = getTrainerState();
    if (typeof window !== 'undefined') {
        window.trainerState = freshState;
    }
    
    updateProgressionControlsUI();

    // Clear highlights before starting playback
    if (window.clearHighlights) {
        window.clearHighlights();
    }

    // Stop any previous parts and clear the transport
    if (trainerState.transportId) {
        trainerState.transportId.stop(0).dispose();
    }
    Tone.Transport.cancel();

    const speedValue = parseFloat(document.getElementById('trainer-speed-select').value);

    // Set Transport BPM based on speed to ensure correct timing
    // Convert measure duration to BPM: 1 measure = 4 beats at 120 BPM = 2 seconds
    // For speedValue of 1.5m, 1m, 0.6m, we want the measure to take that many seconds
    // At 120 BPM, 1 measure = 2 seconds. So for 1.5 seconds, we need 4 beats / 1.5s * 60 = 160 BPM
    // Formula: BPM = (4 beats / speedValue seconds) * 60
    const bpm = (4 / speedValue) * 60;
    Tone.Transport.bpm.value = bpm;

    let allEvents = [];
    let cumulativeBeats = 0; // Track cumulative beat position for chord timing

    trainerState.progressionData.forEach((chord, index) => {
        const allLhNotes = getLHNotes(
            chord.root,
            chord.lhType,
            chord.lhInversion,
            trainerState.currentKey,
            chord.lhOctaveShift || 0,
            chord.type,
            getEnharmonicPreference()
        );
        const lhNotes = allLhNotes.filter(note => !(chord.lhOmittedNotes || []).includes(note));
        const rhNotes = chord.notes.filter(note => !(chord.omittedNotes || []).includes(note));

        // Get chord duration in beats (default to 4 beats if not specified)
        const chordBeats = chord.beats !== undefined ? chord.beats : 4;
        // Convert beats to measures for Tone.js notation (4 beats = 1 measure in 4/4 time)
        const chordDurationMeasures = `${chordBeats / 4}m`;

        // Generate events at the current cumulative beat position
        allEvents.push(...generateRhythmicEvents(rhNotes, lhNotes, cumulativeBeats / 4, chord.rhythmPattern || 'block', chordDurationMeasures));

        // Schedule visual updates at the cumulative beat position
        // Store the callback ID so we can cancel it if needed
        // NOTE: Audio release is handled by the Tone.Part callback - this is only for visuals
        const callbackId = Tone.Transport.scheduleOnce(time => {
            Tone.Draw.schedule(() => {
                document.getElementById('progression-chord-notes-display').textContent = `${chord.roman} (${chord.name})`;
                highlightTrainer(trainerState.scaleNotes, rhNotes.concat(lhNotes));

                // Highlight chord card and tension curve point during Auto Play
                highlightTensionPoint(index);
                highlightChordCard(index);
            }, time);
        }, `${cumulativeBeats / 4}m`); // Convert beats to measures for scheduling

        // Increment cumulative beats for next chord
        cumulativeBeats += chordBeats;
        
        // Store callback IDs for potential cancellation (if needed)
        if (!trainerState.scheduledCallbacks) {
            trainerState.scheduledCallbacks = [];
        }
        trainerState.scheduledCallbacks.push(callbackId);
    });

    const transportPart = new Tone.Part((time, event) => {
        const notes = Array.isArray(event.note) ? event.note : [event.note];
        const instrument = getInstrument();
        const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();

        // For block chords (sustained notes), use triggerAttack only - release happens when next chord starts
        // This creates seamless transitions with no gap between chords
        const isBlockChord = event.duration.includes('m') || parseFloat(event.duration) > 0.5;

        if (isBlockChord) {
            // Play all notes with triggerAttackRelease using the full chord duration
            // The slight overlap from the release envelope of the previous chord
            // blending with the attack of the new chord creates seamless transitions
            if (isGuitar) {
                notes.forEach(note => {
                    instrument.triggerAttackRelease(note, event.duration, time, event.velocity);
                });
            } else {
                instrument.triggerAttackRelease(notes, event.duration, time, event.velocity);
            }

            // Store notes being played for tracking
            setTrainerChordNotes(notes);
        } else {
            // For short notes (arpeggios, etc.), use triggerAttackRelease as before
            if (isGuitar) {
                notes.forEach(note => {
                    instrument.triggerAttackRelease(note, event.duration, time, event.velocity);
                });
            } else {
                instrument.triggerAttackRelease(notes, event.duration, time, event.velocity);
            }
        }

        // Schedule visual flash for rhythmic events
        Tone.Draw.schedule(() => {
            notes.forEach(note => {
                const keyEl = document.getElementById(getNoteKeyId(note));
                if (keyEl) keyEl.classList.add('active-progression');
            });
        }, time);
        Tone.Draw.schedule(() => {
            notes.forEach(note => {
                const keyEl = document.getElementById(getNoteKeyId(note));
                if (keyEl) keyEl.classList.remove('active-progression');
            });
        }, time + Tone.Time(event.duration).toSeconds() * 0.9);
    }, allEvents).start(0);
    
    // Store transportId in both state objects
    trainerState.transportId = transportPart;
    if (typeof window !== 'undefined') {
        if (!window.trainerState) window.trainerState = {};
        window.trainerState.transportId = transportPart;
    }

    // Check if loop is enabled
    const loopToggle = document.getElementById('trainer-loop-toggle');
    const shouldLoop = loopToggle && loopToggle.checked;

    if (shouldLoop) {
        // Schedule loop: when progression ends, restart from beginning
        // cumulativeBeats now holds the total beat count for the entire progression
        const totalBeatsInMeasures = cumulativeBeats / 4; // Convert beats to measures for scheduling
        Tone.Transport.scheduleOnce(() => {
            // Restart the progression
            if (getIsPlaying()) {
                Tone.Draw.schedule(() => {
                    handleAutoPlayback(); // Stop current
                    setTimeout(() => {
                        if (getIsPlaying() === false) {
                            handleAutoPlayback(); // Restart after stop completes
                        }
                    }, 100);
                }, Tone.now());
            }
        }, `${totalBeatsInMeasures}m`);
    }
    
    // Schedule the cleanup at the end of the entire sequence
    // Calculate total duration based on the last event's end time
    // Find the last event time
    let maxEventTime = 0;
    allEvents.forEach(event => {
        const eventTime = Tone.Time(event.time).toSeconds();
        const eventDuration = Tone.Time(event.duration).toSeconds();
        const eventEndTime = eventTime + eventDuration;
        if (eventEndTime > maxEventTime) {
            maxEventTime = eventEndTime;
        }
    });
    
    // Add a small buffer to ensure all events complete
    const totalDuration = maxEventTime + 0.1;
    
    const cleanupCallbackId = Tone.Transport.scheduleOnce(() => {
        // Stop all notes immediately
        stopTrainerChord();
        const instrument = getInstrument();
        if (instrument && getAudioIsReady()) {
            try {
                instrument.releaseAll(Tone.now());
            } catch (e) {
                // Ignore errors
            }
        }
        
        // Stop and dispose transport
        const finalTransportId = getTrainerState().transportId || (window.trainerState && window.trainerState.transportId);
        if (finalTransportId) {
            try {
                finalTransportId.stop(0);
                finalTransportId.dispose();
            } catch (e) {
                // Ignore errors
            }
        }
        
        // Update state immediately when finished
        setIsPlaying(false);
        setCurrentIndex(0);
        
        // Get fresh state after updating
        const finalState = getTrainerState();
        finalState.transportId = null;
        if (window.trainerState) {
            window.trainerState.transportId = null;
            window.trainerState.isPlaying = false;
        }
        
        // Update UI immediately - button should say "Auto Play" again
        // Use requestAnimationFrame to ensure UI updates on next frame
        requestAnimationFrame(() => {
            updateProgressionControlsUI();
        });
        
        document.querySelectorAll('.active-progression-card').forEach(card => {
            card.classList.remove('active-progression-card');
        });
        document.getElementById('progression-chord-notes-display').textContent = 'Progression Finished';
        // Clear all chord highlights at the end
        if (window.clearHighlights) {
            window.clearHighlights();
        }
        highlightTrainer(finalState.scaleNotes, null); // Clear highlights at the end
        Tone.Transport.stop();
        Tone.Transport.cancel();

        // Dispatch event for guided lesson mode when playback completes
        if (isGuidedModeActive()) {
            dispatchBuilderEvent('progressionPlayComplete', {
                timestamp: Date.now()
            });
        }
    }, totalDuration);
    
    // Store cleanup callback ID for potential cancellation
    if (!trainerState.scheduledCallbacks) {
        trainerState.scheduledCallbacks = [];
    }
    trainerState.scheduledCallbacks.push(cleanupCallbackId);

    Tone.Transport.start();
}

/**
 * Generate rhythmic events for a chord based on pattern
 * @param {Array<string>} rhNotes - Right hand notes
 * @param {Array<string>} lhNotes - Left hand notes
 * @param {number} measure - Measure number
 * @param {string} pattern - Rhythm pattern
 * @param {string} measureDuration - Duration of one measure (e.g., '1m', '1.5m')
 * @returns {Array<Object>} Array of Tone.js event objects
 */
function generateRhythmicEvents(rhNotes, lhNotes, measure, pattern, measureDuration = '1m') {
    const events = [];
    const time = (beats) => `${measure}:${beats}`;
    
    // Use full measure duration - notes will be cut off when next chord starts via releaseAll()
    const chordDuration = measureDuration;

    switch (pattern) {
        case 'arpeggioUp':
            rhNotes.forEach((note, i) => events.push({ time: time(i), note, duration: '8n', velocity: 0.9 }));
            if (lhNotes.length > 0) events.push({ time: time(0), note: lhNotes, duration: chordDuration, velocity: 0.6 });
            break;
        case 'arpeggioDown':
            [...rhNotes].reverse().forEach((note, i) => events.push({ time: time(i), note, duration: '8n', velocity: 0.9 }));
            if (lhNotes.length > 0) events.push({ time: time(0), note: lhNotes, duration: chordDuration, velocity: 0.6 });
            break;
        case 'albertiBass':
            if (lhNotes.length >= 3) {
                const sortedLh = [...lhNotes].sort((a, b) => noteToMidi(a) - noteToMidi(b));
                const [low, mid, high] = sortedLh;
                const albertiPattern = [low, high, mid, high];
                albertiPattern.forEach((note, i) => events.push({ time: time(i), note, duration: '8n', velocity: 0.7 }));
            } else if (lhNotes.length > 0) { // Fallback for 1-2 note chords
                events.push({ time: time(0), note: lhNotes, duration: chordDuration, velocity: 0.6 });
            }
            if (rhNotes.length > 0) events.push({ time: time(0), note: rhNotes, duration: chordDuration, velocity: 0.9 });
            break;
        case 'block':
        default:
            // Use chordDuration instead of '1m' to prevent overlap
            if (rhNotes.length > 0) events.push({ time: time(0), note: rhNotes, duration: chordDuration, velocity: 0.9 });
            if (lhNotes.length > 0) events.push({ time: time(0), note: lhNotes, duration: chordDuration, velocity: 0.7 });
            break;
    }
    return events;
}

/**
 * Start playing the current step chord (hold-to-play)
 * Called when Step button is pressed down
 */
export function startStepChord() {
    initAudio();
    
    if (!getAudioIsReady()) {
        if (!getAudioIsLoading() && window.showModal) {
            window.showModal("Loading piano samples...", false);
        }
        return;
    }

    // Immediately stop any currently playing chord
    stopTrainerChord();
    
    // Aggressively stop all notes - release all immediately
    const instrument = getInstrument();
    if (instrument && getAudioIsReady()) {
        try {
            // Release all notes at the current time
            instrument.releaseAll(Tone.now());
            // Also try releasing at a slightly earlier time to catch scheduled releases
            instrument.releaseAll(Tone.now() - 0.001);
        } catch (e) {
            // Ignore errors
        }
    }
    
    // Clear highlights immediately
    if (window.clearHighlights) {
        window.clearHighlights();
    }

    let trainerState = getTrainerState();

    if (!trainerState.isReady) {
        loadProgression();
        // Get fresh state after loading
        trainerState = getTrainerState();
    }

    // Check if we're continuing a step sequence (stepped within last 3 seconds)
    const now = Date.now();
    const isSteppingSequence = (now - lastStepTime) < 3000;

    const totalChords = trainerState.progressionData ? trainerState.progressionData.length : 0;

    // Determine which chord to play
    let chordIndexToPlay;

    // Only use selected chord as starting point if we're NOT in the middle of stepping
    if (!isSteppingSequence && window.getSelectedChordIndex) {
        const selectedIndex = window.getSelectedChordIndex();

        // If there's a valid selected chord, start from there
        if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < totalChords) {
            chordIndexToPlay = selectedIndex;
        } else {
            // No selected chord - start from first chord
            chordIndexToPlay = 0;
        }
    } else {
        // In the middle of stepping sequence - use currentIndex
        if (trainerState.currentIndex === undefined || trainerState.currentIndex < 0 || trainerState.currentIndex >= totalChords) {
            chordIndexToPlay = 0;
        } else {
            chordIndexToPlay = trainerState.currentIndex;
        }
    }

    // Always update the visual selection (purple ring) to match the chord we're about to play
    selectChordCard(chordIndexToPlay);

    // Update last step time
    lastStepTime = now;

    // If auto-playback is running, stop it first
    if (trainerState.isPlaying) {
        handleAutoPlayback();
        // Wait a moment for stop to complete
        setTimeout(() => {
            trainerState = getTrainerState();
            if (!trainerState.isPlaying) {
                playCurrentStepChord();
            }
        }, 100);
        return;
    }

    playCurrentStepChord();

    function playCurrentStepChord() {
        const currentState = getTrainerState();
        const totalChords = currentState.progressionData ? currentState.progressionData.length : 0;

        if (totalChords === 0) {
            return;
        }

        // Ensure index is valid
        if (currentState.currentIndex >= totalChords) {
            setCurrentIndex(0);
        }

        if (currentState.currentIndex < totalChords) {
            // Mark that we're playing a step chord
            isStepPlaying = true;
            // Play the current chord using triggerAttack (hold to play)
            startProgressionChord(currentState.currentIndex);
        }
    }
}

/**
 * Stop playing the current step chord and advance to next
 * Called when Step button is released
 */
export function stopStepChord() {
    // Only process if we were actually playing a step chord
    // This prevents mouseleave from advancing when user just hovers over button
    if (!isStepPlaying) {
        return;
    }

    // Reset the playing flag
    isStepPlaying = false;

    // Stop the currently playing chord immediately
    stopTrainerChord();

    // Stop Tone.Transport to cancel any scheduled events
    try {
        Tone.Transport.stop();
        Tone.Transport.cancel();
    } catch (e) {
        // Ignore errors
    }

    // Aggressively stop all notes from both synth and piano
    const instrument = getInstrument();
    const piano = getPiano();

    if (instrument && getAudioIsReady()) {
        try {
            instrument.releaseAll(Tone.now());
        } catch (e) {
            // Ignore errors
        }
    }

    if (piano) {
        try {
            piano.releaseAll(Tone.now());
        } catch (e) {
            // Ignore errors
        }
    }

    // Clear highlights
    if (window.clearHighlights) {
        window.clearHighlights();
    }
    // Clear chord card and tension curve highlights
    unhighlightAllTensionPoints();
    unhighlightAllChordCards();

    // Advance to next chord and update selection
    const trainerState = getTrainerState();
    const totalChords = trainerState.progressionData ? trainerState.progressionData.length : 0;

    if (totalChords > 0) {
        const nextIndex = (trainerState.currentIndex + 1) % totalChords;

        // Select the next chord card (this also syncs the measure in notation)
        selectChordCard(nextIndex);

        // Update display
        if (nextIndex === 0) {
            const display = document.getElementById('progression-chord-notes-display');
            if (display) {
                display.textContent = 'Ready to Play (Progression Complete)';
            }
        }

        // Update last step time to maintain stepping sequence
        lastStepTime = Date.now();
    }

    updateProgressionControlsUI();
}

/**
 * Start playing a progression chord (for hold-to-play on chord cards)
 * @param {number} index - Index of chord in progression
 */
export function startProgressionChord(index) {
    // Use whenAudioReady to ensure audio plays even if this is the first interaction
    whenAudioReady(() => playProgressionChordNow(index));
}

/**
 * Internal function to play a progression chord (called after audio is ready)
 * @param {number} index - Index of chord in progression
 */
function playProgressionChordNow(index) {
    const trainerState = getTrainerState();

    if (trainerState.isPlaying) handleAutoPlayback();
    
    // Stop previous chord immediately before playing new one
    stopTrainerChord();
    
    // Clear previous chord highlights before playing new one
    if (window.clearHighlights) {
        window.clearHighlights();
    }

    const chord = trainerState.progressionData[index];
    if (!chord) return;

    // Set this chord as selected (for purple outline)
    if (window.setSelectedChordIndex) {
        window.setSelectedChordIndex(index);
    }

    document.getElementById('progression-chord-notes-display').textContent = `${chord.roman} (${chord.name})`;

    const { lhType, lhInversion, lhOctaveShift, omittedNotes = [], lhOmittedNotes = [], octaveShift = 0, inversion = 0 } = chord;

    // Regenerate chord notes based on current inversion (in case inversion was changed)
    // Get key without 'm' suffix for calculation
    let keyForCalculation = trainerState.currentKey || 'C';
    const isMinorKey = keyForCalculation && keyForCalculation.endsWith('m');
    if (isMinorKey) {
        keyForCalculation = keyForCalculation.replace(/m$/, '');
    }
    
    const chordNotesData = getProgressionChordNotes(
        keyForCalculation,
        chord.roman,
        chord.type,
        inversion, // Use current inversion from chord data
        octaveShift
    );
    
    // Use regenerated notes if available, otherwise fall back to stored notes
    // Filter out any invalid notes (null, undefined, empty strings, NaN values)
    const rawChordNotes = chordNotesData ? chordNotesData.notes : (chord.notes || []);
    const chordNotes = rawChordNotes.filter(note => {
        // Check for null, undefined, empty string
        if (note == null || note === '') return false;
        // Check if it's a string
        if (typeof note !== 'string') return false;
        // Check for 'NaN' string or notes containing 'NaN' in octave position
        if (note === 'NaN' || note.includes('NaN')) return false;
        // Check if note matches valid format (letter + optional accidental + number)
        if (!/^[A-G][#b]?\d+$/.test(note)) return false;
        return true;
    });

    // Use auto-generated bass notes if available
    let allLhNotes = [];
    let bassAutoFillActive = false;

    // Check if bass auto-fill is active
    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        const settings = compositionState.getSettings();

        if (settings && settings.autoGenerateBass && compositionState.getMeasureCount() > index) {
            const measure = compositionState.getMeasure(index);
            if (measure && measure.notation && measure.notation.bass) {
                const bassVoices = measure.notation.bass.voices || [];
                // MULTI-VOICE: Gather notes from ALL bass voices
                const allBassNotes = bassVoices.flatMap(voice => voice?.notes || []);
                if (allBassNotes.length > 0) {
                    // Use auto-generated bass notes (blue notes)
                    bassAutoFillActive = true;
                    // Extract pitch from bass notes, filter out rests and invalid pitches
                    allLhNotes = allBassNotes
                        .filter(note => note.type !== 'rest' && note.pitch)
                        .map(note => note.pitch)
                        .filter(pitch => {
                            if (pitch == null || pitch === '') return false;
                            if (typeof pitch !== 'string') return false;
                            if (pitch === 'NaN' || pitch.includes('NaN')) return false;
                            if (!/^[A-G][#b]?\d+$/.test(pitch)) return false;
                            return true;
                        });
                }
            }
        }
    }

    // If no auto-generated bass, use traditional LH chord notes
    if (!bassAutoFillActive) {
        // Calculate absolute LH octave shift (RH octave + relative LH shift)
        const absoluteLHOctaveShift = octaveShift + (lhOctaveShift || 0);
        const rawLhNotes = getLHNotes(
        chord.root,
        lhType || 'off',
        lhInversion || 0,
        trainerState.currentKey,
        absoluteLHOctaveShift,
        chord.type,
        getEnharmonicPreference()
    );
        // Filter out any invalid notes
        allLhNotes = (rawLhNotes || []).filter(note => {
            if (note == null || note === '') return false;
            if (typeof note !== 'string') return false;
            if (note === 'NaN' || note.includes('NaN')) return false;
            if (!/^[A-G][#b]?\d+$/.test(note)) return false;
            return true;
        });
    }

    // Apply saved voicing from the chord data
    const voicedNotes = chordNotes.filter(note => !omittedNotes.includes(note));
    const lhNotes = allLhNotes.filter(note => !lhOmittedNotes.includes(note));
    // Filter out any invalid notes (null, undefined, empty strings, NaN values) before playing
    const allNotes = voicedNotes.concat(lhNotes)
        .filter(note => note != null && note !== '' && typeof note === 'string' && note !== 'NaN');

    highlightTrainer(trainerState.scaleNotes, allNotes);

    // Highlight chord card and tension curve point during Step playback
    highlightTensionPoint(index);
    highlightChordCard(index);

    // Play the chord with triggerAttack (hold to play)
    if (allNotes.length > 0) {
        // Stop any previous notes IMMEDIATELY before playing new ones
        stopTrainerChord();
        
        // Re-apply highlighting after stopTrainerChord cleared it
        highlightTrainer(trainerState.scaleNotes, allNotes);
        
        // Ensure audio context is started and play the chord
        const playChord = () => {
            const instrument = getInstrument();
            if (!instrument || !getAudioIsReady()) {
                return;
            }
            
            // Release any lingering notes
            try {
                instrument.releaseAll(Tone.now());
            } catch (e) {
                // Ignore errors
            }
            
            try {
                // Play the chord - it will continue until stopTrainerChord is called
                const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                if (isGuitar) {
                    // For PluckSynth, trigger all notes at the same time (slightly in the future)
                    const baseTime = Tone.now() + 0.01;
                    allNotes.forEach((note, index) => {
                        instrument.triggerAttack(note, baseTime + index * 0.0001);
                    });
                } else {
                    instrument.triggerAttack(allNotes, Tone.now());
                }
                
                // Store notes for release when button is released
                setTrainerChordNotes(allNotes);
            } catch (e) {
            }
        };
        
        // Resume audio context if needed (browser autoplay policy)
        if (typeof Tone !== 'undefined' && Tone.context && Tone.context.state !== 'running') {
            Tone.context.resume().then(() => {
                playChord();
            }).catch(err => {
                playChord(); // Try anyway
            });
        } else {
            playChord();
        }
    }
}

/**
 * Play a single progression chord (for step mode with duration)
 * @param {number} index - Index of chord in progression
 * @param {boolean} advance - Whether to advance to next chord
 */
function playProgressionChord(index, advance = true) {
    initAudio();
    if (!getAudioIsReady()) {
        if (!getAudioIsLoading() && window.showModal) {
            window.showModal("Loading piano samples...", false);
        }
        return;
    }

    const trainerState = getTrainerState();

    if (trainerState.isPlaying) handleAutoPlayback();
    
    // Stop previous chord immediately before playing new one
    stopTrainerChord();
    
    // Clear previous chord highlights before playing new one
    if (window.clearHighlights) {
        window.clearHighlights();
    }

    const chord = trainerState.progressionData[index];
    if (!chord) return;

    document.getElementById('progression-chord-notes-display').textContent = `${chord.roman} (${chord.name})`;

    const { lhType, lhInversion, lhOctaveShift, omittedNotes = [], lhOmittedNotes = [], octaveShift = 0, inversion = 0 } = chord;

    // Regenerate chord notes based on current inversion (in case inversion was changed)
    // Get key without 'm' suffix for calculation
    let keyForCalculation = trainerState.currentKey || 'C';
    const isMinorKey = keyForCalculation && keyForCalculation.endsWith('m');
    if (isMinorKey) {
        keyForCalculation = keyForCalculation.replace(/m$/, '');
    }
    
    const chordNotesData = getProgressionChordNotes(
        keyForCalculation,
        chord.roman,
        chord.type,
        inversion, // Use current inversion from chord data
        octaveShift
    );
    
    // Use regenerated notes if available, otherwise fall back to stored notes
    const chordNotes = chordNotesData ? chordNotesData.notes : (chord.notes || []);

    // Use auto-generated bass notes if available
    let allLhNotes = [];
    let bassAutoFillActive = false;

    // Check if bass auto-fill is active
    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        const settings = compositionState.getSettings();

        if (settings && settings.autoGenerateBass && compositionState.getMeasureCount() > index) {
            const measure = compositionState.getMeasure(index);
            if (measure && measure.notation && measure.notation.bass) {
                const bassVoices = measure.notation.bass.voices || [];
                // MULTI-VOICE: Gather notes from ALL bass voices
                const allBassNotes = bassVoices.flatMap(voice => voice?.notes || []);
                if (allBassNotes.length > 0) {
                    // Use auto-generated bass notes (blue notes)
                    bassAutoFillActive = true;
                    // Extract pitch from bass notes, filter out rests
                    allLhNotes = allBassNotes
                        .filter(note => note.type !== 'rest')
                        .map(note => note.pitch)
                        .filter(Boolean);
                }
            }
        }
    }

    // If no auto-generated bass, use traditional LH chord notes
    if (!bassAutoFillActive) {
        allLhNotes = getLHNotes(
        chord.root,
        lhType,
        lhInversion,
        trainerState.currentKey,
        lhOctaveShift,
        chord.type,
        getEnharmonicPreference()
    );
    }

    // Highlight corresponding tension curve point and chord card
    highlightTensionPoint(index);
    highlightChordCard(index);

    // Apply saved voicing from the chord data
    const voicedNotes = chordNotes.filter(note => !omittedNotes.includes(note));
    const lhNotes = allLhNotes.filter(note => !lhOmittedNotes.includes(note));
    const allNotes = voicedNotes.concat(lhNotes);

    highlightTrainer(trainerState.scaleNotes, allNotes);

    // Play the chord with a duration for step mode
    if (allNotes.length > 0) {
        // Stop any previous notes IMMEDIATELY before playing new ones
        stopTrainerChord();
        const instrument = getInstrument();
        if (instrument && getAudioIsReady()) {
            try {
                instrument.releaseAll(Tone.now());
            } catch (e) {
                // Ignore errors
            }
        }
        
        // Ensure audio context is started (required for Tone.js)
        // Must be called in response to user interaction
        if (Tone.context.state !== 'running') {
            Tone.context.resume().catch(err => {
                // Ignore errors
            });
        }
        
        // Use triggerAttackRelease with a duration so notes play and stop automatically
        if (instrument && getAudioIsReady()) {
            try {
                // Get speed from selector (seconds per measure = 4 beats at this tempo)
                const speedValue = parseFloat(document.getElementById('trainer-speed-select')?.value || '1');

                // Calculate actual duration based on chord's beats property
                // speedValue is seconds per 4 beats, so seconds per beat = speedValue / 4
                const chordBeats = chord.beats !== undefined ? chord.beats : 4;
                const secondsPerBeat = speedValue / 4;
                const chordDurationSeconds = chordBeats * secondsPerBeat;
                const chordDuration = `${chordDurationSeconds * 0.9}s`; // 90% to prevent overlap



                // Play the chord with duration based on beats and tempo
                // For PluckSynth (guitar), trigger each note individually with slight time offset
                // For Sampler (piano), we can pass the array
                const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                if (isGuitar) {
                    // For PluckSynth, trigger all notes at the same time (slightly in the future)
                    // to ensure they all play together as a chord
                    const baseTime = Tone.now() + 0.01; // Small buffer to ensure all notes are scheduled
                    allNotes.forEach((note, index) => {
                        // Use very small increment (0.0001) to satisfy Tone.js requirement while keeping notes simultaneous
                        instrument.triggerAttackRelease(note, chordDuration, baseTime + index * 0.0001);
                    });
                } else {
                    instrument.triggerAttackRelease(allNotes, chordDuration, Tone.now());
                }

                // Store notes for potential manual release if needed
                setTrainerChordNotes(allNotes);

                // Use setTimeout instead of Transport.scheduleOnce for step mode
                // (doesn't require Transport to be running)
                const durationMs = chordDurationSeconds * 900; // 90% of duration in milliseconds
                const timeoutId = setTimeout(() => {
                    setTrainerChordNotes([]);
                    highlightTrainer(trainerState.scaleNotes, null);
                    setStepChordTimeoutId(null);
                }, durationMs);
                // Store timeout ID so it can be cleared if Step is pressed again
                setStepChordTimeoutId(timeoutId);
            } catch (e) {
                // Ignore errors
            }
        }
    }

    if (advance) {
        setCurrentIndex((index + 1) % trainerState.progressionData.length);
        updateProgressionControlsUI();
    }
}

/**
 * Stop playing trainer chord
 */
export function stopTrainerChord() {
    const trainerState = getTrainerState();
    const trainerChordNotes = trainerState.trainerChordNotes;

    // Clear any pending timeout
    const timeoutId = getStepChordTimeoutId();
    if (timeoutId !== null) {
        clearTimeout(timeoutId);
        setStepChordTimeoutId(null);
    }

    // Release all notes immediately, not just the tracked ones
    const instrument = getInstrument();
    if (instrument && getAudioIsReady()) {
        try {
            // Release all notes at current time
            instrument.releaseAll(Tone.now());
            // Also release tracked notes specifically if any
            if (trainerChordNotes.length > 0) {
                // For PluckSynth (guitar), release each note individually
                // For Sampler (piano), we can pass the array
                const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                if (isGuitar) {
                    trainerChordNotes.forEach(note => {
                        try {
                            instrument.triggerRelease(note, Tone.now());
                        } catch (e) {
                            // Ignore individual note errors
                        }
                    });
                } else {
                    instrument.triggerRelease(trainerChordNotes, Tone.now());
                }
            }
            setTrainerChordNotes([]);
        } catch (e) {
            // Ignore errors
        }
    }

    // Always clear chord highlights when stopping, even if playing
    if (getCurrentTab() === 'trainer' && trainerState.scaleNotes && trainerState.scaleNotes.length > 0) {
        highlightTrainer(trainerState.scaleNotes, null);
    }
}

/**
 * Show chord suggestions modal for a specific chord in the progression
 * @param {number} chordIndex - Index of the chord in the progression
 */
export function showProgressionChordSuggestions(chordIndex) {
    const trainerState = getTrainerState();
    const progression = trainerState.progressionData;

    if (!progression || chordIndex < 0 || chordIndex >= progression.length) {
        return;
    }

    const currentChord = progression[chordIndex];
    const currentRoot = currentChord.root;
    const currentType = currentChord.type || 'Major';
    const currentInversion = currentChord.inversion || 0;

    // Callback to add suggested chord to progression
    const onAddChord = (nextChordType, nextRoot, nextInversion) => {
        const key = trainerState.currentKey;

        // Get full chord information using getInvertedChordNotes
        const result = getInvertedChordNotes(
            nextRoot,
            nextChordType,
            nextInversion,
            key,
            0, // octaveShift
            getEnharmonicPreference(),
            getNotationPreference()
        );

        // Calculate roman numeral for the chord
        const roman = noteToRomanNumeral(nextRoot, key, nextChordType) || '';

        // Create complete chord data with all required properties
        const nextChordData = {
            name: result.name,
            simpleName: result.simpleName,
            notes: result.specificNotes,
            root: nextRoot,
            type: nextChordType,
            inversion: nextInversion || 0,
            selectionMode: 'chord',
            omittedNotes: [],
            octaveShift: 0,
            lhOmittedNotes: [],
            roman: roman,
            duration: currentChord.duration || '1n'
        };

        // Save state for undo BEFORE making changes
        const currentState = captureProgressionState();
        saveState(currentState);

        // Insert after current chord
        progression.splice(chordIndex + 1, 0, nextChordData);

        // Update state
        setProgressionData(progression);

        // Re-render
        renderProgressionDisplay('melody-progression-visualization', true);
        renderProgressionDisplay('melody-progression-visualization', false);
        updateProgressionControlsUI();
    };

    // Track currently playing notes for release
    let currentlyPlayingNotes = [];

    // Callback to preview a chord (starts playing)
    const onPlayChord = (chordType, root, inversion) => {
        try {
            // Get chord notes using the same method as Chord Builder
            const res = getInvertedChordNotes(
                root,
                chordType,
                inversion,
                root, // key (same as root for now)
                0, // octaveShift
                'sharp', // enharmonicPreference
                'full' // notationPreference
            );

            const heldNotes = res.specificNotes || [];
            if (heldNotes.length === 0) {
                return;
            }

            const instrument = getInstrument();
            if (!instrument) {
                return;
            }

            // Release any currently playing notes first
            if (currentlyPlayingNotes.length > 0) {
                const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                if (isGuitar) {
                    currentlyPlayingNotes.forEach(n => {
                        try { instrument.triggerRelease(n, Tone.now()); } catch (_) {}
                    });
                } else {
                    instrument.triggerRelease(currentlyPlayingNotes, Tone.now());
                }
            }

            // Trigger new notes
            const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
            const baseTime = Tone.now() + 0.01;

            if (isGuitar) {
                heldNotes.forEach((n, idx) => instrument.triggerAttack(n, baseTime + idx * 0.0001));
            } else {
                instrument.triggerAttack(heldNotes, Tone.now());
            }

            currentlyPlayingNotes = heldNotes;
            setTrainerChordNotes(heldNotes);
        } catch (error) {
        }
    };

    // Callback to stop playing chord (releases notes)
    const onStopChord = () => {
        if (currentlyPlayingNotes.length > 0) {
            const instrument = getInstrument();
            if (instrument && getAudioIsReady()) {
                const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
                if (isGuitar) {
                    currentlyPlayingNotes.forEach(n => {
                        try { instrument.triggerRelease(n, Tone.now()); } catch (_) {}
                    });
                } else {
                    instrument.triggerRelease(currentlyPlayingNotes, Tone.now());
                }
                currentlyPlayingNotes = [];
                setTrainerChordNotes([]);
            }
        }
    };

    // Show the unified recommendation modal (chord tab, suggest intent)
    showUnifiedRecommendationModal({
        currentChordType: currentType,
        currentRoot: currentRoot,
        currentInversion: currentInversion,
        onAddChord: onAddChord,
        onPlayChord: onPlayChord,
        onStopChord: onStopChord,
        initialTab: 'chord',
        initialIntent: 'suggest',
        initialView: 'quick',
        selectedChordIndex: chordIndex
    });
}

// Make it available globally for onclick handlers
window.showProgressionChordSuggestions = showProgressionChordSuggestions;

/**
 * Add a chord to the progression from Smart Suggestions panel
 * @param {string} chordType - The chord type
 * @param {string} root - The root note
 * @param {number} inversion - The inversion
 * @param {number} octaveShift - The octave shift in semitones (default 0, use -12 for one octave down)
 */
/**
 * Helper function to update a chord in compositionState and render WITHOUT wiping treble notes
 * Use this instead of window.syncNotationFromProgression() to preserve user-added treble notes
 * @param {number} index - chord index to sync
 * @param {object} [options]
 * @param {boolean} [options.skipCardRefresh=false] - if true, do not rebuild card DOM
 */
function updateChordAndRenderPreservingTrebleNotes(index, options = {}) {
    const { skipCardRefresh = false } = options;
    if (!window.getCompositionState || !window.getNotationComposer) {
        return;
    }

    const compositionState = window.getCompositionState();
    const notationComposer = window.getNotationComposer();
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];

    if (!chord || !compositionState || !notationComposer) return;


    // Block renders and syncs during update
    const wasBlockingRenders = notationComposer.isSyncingFromProgression;
    notationComposer.isSyncingFromProgression = true;

    const syncInstance = window.getProgressionNotationSync && window.getProgressionNotationSync();
    const wasBlockingSync = syncInstance ? syncInstance.isUpdating : false;
    if (syncInstance) {
        syncInstance.isUpdating = true;
    }

    try {
        // Ensure measure exists in compositionState
        while (compositionState.getMeasureCount() <= index) {
            compositionState.addMeasure({});
        }

        // Update the chord with ALL properties from progression
        compositionState.updateChord(index, {
            root: chord.root,
            type: chord.type,
            notes: chord.notes || [],
            inversion: chord.inversion || 0,
            voicing: chord.voicing || 'close',
            roman: chord.roman || null,
            name: chord.name || null,
            octaveShift: chord.octaveShift || 0,
            lhOctaveShift: chord.lhOctaveShift || 0,
            omittedNotes: chord.omittedNotes || [],
            lhOmittedNotes: chord.lhOmittedNotes || [],
            beats: chord.beats !== undefined ? chord.beats : 4 // Add beats property
        });

        // Regenerate bass for this building block (chord)
        const autoGenerateBass = compositionState.getSettings().autoGenerateBass;
        const measure = compositionState.getMeasure(index);

        if (autoGenerateBass) {
            // Use building-block-aware regeneration that handles multi-measure chords
            compositionState.regenerateAutoBassByChordIndex(index);
        } else {
            // Create simple whole-note bass from chord notes
            if (measure && measure.notation && measure.notation.bass && chord.notes && chord.notes.length > 0) {
                const voicedNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
                if (voicedNotes.length > 0) {
                    measure.notation.bass.voices[0].notes = [{
                        type: 'note',
                        pitches: [...voicedNotes],
                        duration: '1n',
                        beat: 0,
                        dotted: false
                    }];
                    measure.notation.bass.autoGenerated = false;
                }
            }
        }
    } finally {
        // Restore previous states
        notationComposer.isSyncingFromProgression = wasBlockingRenders;
        if (syncInstance) {
            syncInstance.isUpdating = wasBlockingSync;
        }
    }

    // Update chord cards across all tabs unless explicitly skipped
    if (!skipCardRefresh) {
        updateSingleCard(index);
    }

    // Render the notation
    if (notationComposer && typeof notationComposer.render === 'function') {
        notationComposer.render();
    }

    // Update voice leading analysis to reflect chord changes
    if (window.updateVoiceLeading) {
        window.updateVoiceLeading();
    }
}

// ============================================================================
// PUBLIC API FOR NOTATION UPDATES
// ============================================================================

/**
 * Public API: Update a single chord's notation while preserving treble notes
 * This is the recommended way to sync chord changes from progressionData to notation
 *
 * @param {number} index - The measure index to update
 *
 * @example
 * // After modifying a chord in progressionData, update notation:
 * trainerState.progressionData[2].inversion = 1;
 * window.updateChordNotation(2);
 */
window.updateChordNotation = function(index) {
    updateChordAndRenderPreservingTrebleNotes(index);
};

/**
 * Public API: Full rebuild of notation from progressionData
 * WARNING: This will wipe all user-added treble notes!
 * Only use this when:
 * - Loading a new progression from scratch
 * - Clearing the entire composition
 * - User explicitly chooses to reset/reload
 *
 * For chord modifications, always prefer window.updateChordNotation(index) instead
 *
 * @example
 * // Only use for full progression loads:
 * loadProgressionFromFile(data);
 * window.fullRebuildNotation();
 */
window.fullRebuildNotation = function() {
    if (window.syncProgressionToComposition) {
        window.syncProgressionToComposition();
    } else if (window.syncNotationFromProgression) {
        window.syncNotationFromProgression();
    }
};

export function addChordToProgressionByParams(chordType, root, inversion = 0, octaveShift = 0) {
    // Save current state for undo (same mechanism as other progression edits)
    const currentState = captureProgressionState();
    pushToUndoStack(currentState);

    const trainerState = getTrainerState();

    // Phase 2.1: Get insert position from section intent state
    const insertAfterIndex = getInsertAfterIndex();
    const sectionIntent = getSectionIntent();
    const usePositionBasedInsert = insertAfterIndex !== null &&
                                   insertAfterIndex >= 0 &&
                                   insertAfterIndex < trainerState.progressionData.length;

    // Get full chord information using getInvertedChordNotes
    const result = getInvertedChordNotes(
        root,
        chordType,
        inversion,
        trainerState.currentKey,
        octaveShift,
        getEnharmonicPreference(),
        getNotationPreference()
    );

    // Calculate roman numeral for the chord
    const roman = noteToRomanNumeral(root, trainerState.currentKey, chordType) || '';

    // Generate default LH notes (default pattern: 'off' - no LH by default for recommendations)
    const defaultLHType = 'off';
    const defaultLHInversion = 0;
    const defaultLHRelativeShift = 0; // No shift from LH base octave (octave 2) by default
    const rhOctaveShift = octaveShift; // Use the provided octave shift
    const absoluteLHOctaveShift = rhOctaveShift + defaultLHRelativeShift;
    const lhNotes = getLHNotes(
        root,
        defaultLHType,
        defaultLHInversion,
        trainerState.currentKey,
        absoluteLHOctaveShift,
        chordType,
        getEnharmonicPreference()
    );

    // Get default beats based on current time signature (one full measure)
    // Beats are stored as quarter-note equivalents (normalized)
    // e.g., 4/4 = 4 beats, 3/4 = 3 beats, 6/8 = 3 beats (6 eighth notes = 3 quarter notes)
    let defaultBeats = 4;
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (compositionState && compositionState.metadata && compositionState.metadata.timeSignature) {
        const ts = compositionState.metadata.timeSignature;
        // Normalize to quarter-note beats: num * (4 / denom)
        const num = ts.num || 4;
        const denom = ts.denom || 4;
        defaultBeats = num * (4 / denom);
    }

    // Create complete chord data with all required properties
    const newChordData = {
        name: result.name,
        simpleName: result.simpleName,
        notes: result.specificNotes,
        root: root,
        type: chordType,
        inversion: inversion || 0,
        selectionMode: 'chord',
        omittedNotes: [],
        octaveShift: rhOctaveShift,
        lhType: defaultLHType,
        lhInversion: defaultLHInversion,
        lhOctaveShift: defaultLHRelativeShift,
        lhNotes: lhNotes,
        lhOmittedNotes: [],
        roman: roman,
        beats: defaultBeats // Default: one measure based on current time signature
    };

    // === Stable add path: reuse addToProgressionData (same as Chord Builder) ===
    const currentProgression = getProgressionData();
    const originalLength = currentProgression.length;

    // Append using the canonical helper (handles compositionState + notation)
    if (window.addToProgressionData) {
        window.addToProgressionData(newChordData);
    } else {
        // Fallback: append and sync manually
        const appended = [...currentProgression, newChordData];
        setProgressionData(appended);
        renderProgressionDisplay('melody-progression-visualization', true);
        renderProgressionDisplay('melody-progression-visualization', false);
    }

    // After append, compute actual indices
    const afterAppend = getProgressionData();
    const newLength = afterAppend.length;
    const appendedIndex = newLength - 1;

    // Track the final index where the chord ends up
    let insertedIndex = appendedIndex;

    // If we have a valid insert-after index, move the appended chord there
    if (usePositionBasedInsert && appendedIndex >= 0) {
        const targetIndex = insertAfterIndex + 1;
        if (targetIndex >= 0 && targetIndex < newLength && targetIndex !== appendedIndex) {
            const compositionState = window.getCompositionState ? window.getCompositionState() : null;
            if (compositionState && typeof compositionState.reorderChord === 'function') {
                compositionState.reorderChord(appendedIndex, targetIndex);

                const reordered = compositionState.exportToProgressionData();
                setProgressionData(reordered);
                renderProgressionDisplay('melody-progression-visualization', true);
                renderProgressionDisplay('melody-progression-visualization', false);
            } else {
                // Pure JS fallback reorder if compositionState is unavailable
                const manual = [...afterAppend];
                const [moved] = manual.splice(appendedIndex, 1);
                manual.splice(targetIndex, 0, moved);
                setProgressionData(manual);
                renderProgressionDisplay('melody-progression-visualization', true);
                renderProgressionDisplay('melody-progression-visualization', false);
            }
            // Update insertedIndex to reflect the actual position
            insertedIndex = targetIndex;
        }
    }

    // Phase 2.1: Handle section assignment based on intent
    let sectionWasModified = false;
    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState && sectionIntent) {
            try {
                if (sectionIntent.mode === INTENT_MODES.NEW_SECTION && sectionIntent.newSectionType) {
                    // Create a new section with this chord as the first chord
                    const newSection = compositionState.createSection(
                        sectionIntent.newSectionType,
                        [insertedIndex]
                    );
                    if (newSection) {
                        sectionWasModified = true;
                    }
                } else if (sectionIntent.mode === INTENT_MODES.CONTINUE && sectionIntent.targetSection) {
                    // Add the chord to the existing section
                    compositionState.addChordToSection(insertedIndex, sectionIntent.targetSection.id);
                    sectionWasModified = true;
                }
                // If ungrouped (no targetSection), leave the chord ungrouped
            } catch (e) {
            }
        }
    }

    // Re-render display if a section was modified (to show section visuals)
    if (sectionWasModified) {
        renderProgressionDisplay('melody-progression-visualization', true);
        renderProgressionDisplay('melody-progression-visualization', false);
    }

    // Update unified suggestions
    if (window.updateUnifiedSuggestions) {
        window.updateUnifiedSuggestions();
    }

    // Phase 2.2: Dispatch event for chord recommendations sidebar
    window.dispatchEvent(new CustomEvent('progressionUpdated', {
        detail: {
            progression: updatedProgression,
            key: trainerState.currentKey
        }
    }));

    // Dispatch event for guided lesson mode
    if (isGuidedModeActive()) {
        dispatchBuilderEvent('progressionChordAdded', {
            chord: `${root} ${chordType}`,
            root,
            type: chordType,
            inversion,
            position: insertedIndex,
            key: trainerState.currentKey
        });
    }

    // Phase 2.1: Select the newly inserted chord
    selectChordCard(insertedIndex);
}

// Make it available globally
window.addChordToProgressionByParams = addChordToProgressionByParams;

/**
 * Highlight trainer scale and chord notes on keyboard
 * @param {Array<string>} scaleNotes - Scale notes to highlight
 * @param {Array<string>} chordNotes - Chord notes to highlight
 */
function highlightTrainer(scaleNotes, chordNotes) {
    // Clear highlights (function to be imported from UI module)
    if (window.clearHighlights) {
        window.clearHighlights();
    }

    if (getCurrentTab() !== 'trainer' || !scaleNotes) return;

    scaleNotes.forEach(note => {
        const keyId = getNoteKeyId(note);
        const keyElement = document.getElementById(keyId);
        if (keyElement) keyElement.classList.add('active-scale');
    });

    if (chordNotes) {
        chordNotes.forEach(note => {
            const keyId = getNoteKeyId(note);
            const keyElement = document.getElementById(keyId);
            if (keyElement) keyElement.classList.add('active-progression');
        });
    }
}

// ============================================================================
// Chord Editing Functions
// ============================================================================

/**
 * Helper function to render melody notation if needed
 * Checks if we're on Composition Studio tab or if Free mode is active
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
        // Sync progression to compositionState first
        if (window.syncProgressionToMelodyComposer && window.getCompositionState) {
            window.syncProgressionToMelodyComposer();
        }
        // refreshNotationFromProgression returns true if it rendered, false otherwise
        if (window.refreshNotationFromProgression) {
            const result = window.refreshNotationFromProgression(preventScroll);
            if (result) {
                return;
            }
        }

        // Fallback to old renderers if enhanced notation not available or didn't render
        // Phase 1B: Sync progression to composition state before rendering
        // This ensures bass auto-fill is updated when chords are added
        if (window.syncProgressionToMelodyComposer && window.getCompositionState) {
            window.syncProgressionToMelodyComposer();
        }

        // Refresh notation after updates
        if (window.refreshNotationFromProgression) {
            // Use setTimeout to ensure DOM updates are complete
            setTimeout(() => {
                window.refreshNotationFromProgression(preventScroll);
            }, 50);
        }
    }
}

/**
 * Clear all chords from the progression
 * Shows confirmation dialog if progression has chords
 */
export function clearProgression() {
    const trainerState = getTrainerState();
    const progressionData = getProgressionData();

    // If there are chords, ask for confirmation
    if (progressionData && progressionData.length > 0) {
        const chordCount = progressionData.length;
        const message = chordCount === 1
            ? 'Are you sure you want to clear the progression? This will remove 1 chord.'
            : `Are you sure you want to clear the progression? This will remove ${chordCount} chords.`;

        if (!confirm(message)) {
            return; // User cancelled
        }
    }

    // Save state for undo before clearing
    saveStateBeforeChange();

    // Stop any active playback
    if (trainerState.isPlaying && window.handleAutoPlayback) {
        window.handleAutoPlayback();
    }
    
    // Stop any step chord playback
    if (window.stopStepChord) {
        window.stopStepChord();
    }
    
    // Clear progression data
    setProgressionData([]);
    setProgressionRomans([]);
    setCurrentIndex(0);
    setIsReady(false);
    
    // Clear highlights
    if (window.clearHighlights) {
        window.clearHighlights();
    }
    
    // Clear card highlights
    document.querySelectorAll('.active-progression-card').forEach(card => {
        card.classList.remove('active-progression-card');
    });

    // Re-render the display
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

    // Update UI
    updateProgressionControlsUI();

    // Re-render melody notation canvas
    renderMelodyNotationIfNeeded();

    // Phase 2.2: Dispatch event for chord recommendations sidebar
    window.dispatchEvent(new CustomEvent('progressionUpdated', {
        detail: {
            progression: [],
            key: trainerState.currentKey
        }
    }));

    // Sync cleared progression to compositionState, then refresh notation
    if (window.syncProgressionToMelodyComposer) {
        window.syncProgressionToMelodyComposer();
    }
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }
}

export function removeChordFromProgression(index) {
    const trainerState = getTrainerState();

    if (trainerState.isPlaying) handleAutoPlayback();

    // Save state before removing
    saveStateBeforeChange();

    // IMPORTANT: progressionData is now delegated to compositionState
    // Use compositionState.removeChord() which properly syncs edits before removing
    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        // removeChord() handles syncMeasuresToBuildingBlocks internally to preserve edits
        compositionState.removeChord(index);
    } else {
        // Fallback for legacy code
        trainerState.progressionData.splice(index, 1);
    }

    // Still update Romans (this is in trainerState, not compositionState)
    trainerState.progressionRomans.splice(index, 1);

    // Handle selection state after deletion
    const selectedIndex = getSelectedChordIndex();
    const progressionLength = trainerState.progressionData.length;

    if (progressionLength === 0) {
        // No chords left, reset selection
        setSelectedChordIndex(0);
    } else if (index === selectedIndex) {
        // Deleted the selected chord - move selection to next chord (or first if this was last)
        if (index < progressionLength) {
            // Stay at same index (which is now the next chord)
            setSelectedChordIndex(index);
        } else {
            // Deleted the last chord, select the new last chord
            setSelectedChordIndex(progressionLength - 1);
        }
    } else if (index < selectedIndex) {
        // Deleted a chord before the selected one - decrement selected index
        setSelectedChordIndex(selectedIndex - 1);
    }
    // else: deleted a chord after the selected one - selected index stays the same

    // Re-render both tabs to ensure synchronization
    // First render the main progression builder
    renderProgressionDisplay('melody-progression-visualization', true);
    // Then render the melody composer tab (syncBothTabs=false to avoid infinite recursion)
    renderProgressionDisplay('melody-progression-visualization', false);

    // Auto-render melody notation if on Composition Studio tab or if Free mode is active
    renderMelodyNotationIfNeeded();

    // Phase 2.2: Dispatch event for chord recommendations sidebar
    window.dispatchEvent(new CustomEvent('progressionUpdated', {
        detail: {
            progression: trainerState.progressionData,
            key: trainerState.currentKey
        }
    }));

    // Refresh notation to reflect the deleted chord
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }
}

/**
 * Toggle a note in the progression chord voicing
 * @param {number} chordIndex - Index of chord
 * @param {string} note - Note to toggle
 */
export function toggleProgressionNote(chordIndex, note) {
    // Get compositionState directly - the single source of truth
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) {
        return;
    }

    const trainerState = getTrainerState();
    const chordData = compositionState.getChord(chordIndex);
    if (!chordData) return;

    // Save state before toggling
    saveStateBeforeChange();

    // Ensure omittedNotes array exists
    const omittedNotes = chordData.omittedNotes || [];

    const noteOmitIndex = omittedNotes.indexOf(note);
    if (noteOmitIndex > -1) {
        omittedNotes.splice(noteOmitIndex, 1); // Note was omitted, so un-omit it
    } else {
        omittedNotes.push(note); // Note was played, so omit it
    }

    // Update chord in compositionState
    compositionState.updateChordByIndex(chordIndex, {
        omittedNotes: omittedNotes
    });

    // Get updated chord for playback
    const updatedChord = compositionState.getChord(chordIndex);

    if (!updatedChord) {
        return;
    }

    // Play chord with duration after voicing change
    const voicedNotes = (updatedChord.notes || []).filter(n => !(updatedChord.omittedNotes || []).includes(n));
    const lhNotes = getLHNotes(
        updatedChord.root,
        updatedChord.lhType,
        updatedChord.lhInversion,
        trainerState.currentKey,
        updatedChord.lhOctaveShift,
        updatedChord.type,
        getEnharmonicPreference()
    ).filter(n => !(updatedChord.lhOmittedNotes || []).includes(n));
    const allNotes = voicedNotes.concat(lhNotes);

    if (allNotes.length > 0) {
        playTrainerChordOnce(allNotes);
    }

    // Update the chord notation canvas in the detailed card AND bass clef
    refreshChordNotationCanvas(chordIndex, updatedChord);

    // Sync progressionData changes to notation display
    updateChordAndRenderPreservingTrebleNotes(chordIndex);
}

/**
 * Toggle a note in the progression LH voicing
 * @param {number} chordIndex - Index of chord
 * @param {string} note - Note to toggle
 */
export function toggleProgressionLHNote(chordIndex, note) {
    const trainerState = getTrainerState();
    const chordData = trainerState.progressionData[chordIndex];
    if (!chordData) return;

    // Save state before toggling
    saveStateBeforeChange();

    if (!chordData.lhOmittedNotes) {
        chordData.lhOmittedNotes = [];
    }

    const noteOmitIndex = chordData.lhOmittedNotes.indexOf(note);
    if (noteOmitIndex > -1) {
        chordData.lhOmittedNotes.splice(noteOmitIndex, 1);
    } else {
        chordData.lhOmittedNotes.push(note);
    }

    // Skip ALL re-rendering to avoid blinking - checkbox state is already correct in DOM
    // The UI will update when user makes other changes (type, inversion, etc.)

    // Play chord with duration after LH voicing change
    const voicedNotes = chordData.notes.filter(n => !(chordData.omittedNotes || []).includes(n));
    const lhNotes = getLHNotes(
        chordData.root,
        chordData.lhType,
        chordData.lhInversion,
        trainerState.currentKey,
        chordData.lhOctaveShift,
        chordData.type,
        getEnharmonicPreference()
    ).filter(n => !chordData.lhOmittedNotes.includes(n));
    const allNotes = voicedNotes.concat(lhNotes);
    if (allNotes.length > 0) {
        playTrainerChordOnce(allNotes);
    }

    // Update the chord notation canvas in the detailed card AND bass clef
    refreshChordNotationCanvas(chordIndex, chordData);

    // Sync progressionData changes to notation display
    updateChordAndRenderPreservingTrebleNotes(chordIndex);
}

/**
 * Update a progression chord's properties
 * @param {number} index - Index of chord
 * @param {string} property - Property to update
 * @param {*} value - New value
 */
function updateProgressionChord(index, property, value) {
    const trainerState = getTrainerState();
    if (!trainerState.progressionData[index]) return;

    // Save state before updating
    saveStateBeforeChange();

    let chordState = { ...trainerState.progressionData[index] };
    const oldOctaveShift = chordState.octaveShift || 0;
    const oldNotes = [...(chordState.notes || [])];
    const oldOmittedNotes = [...(chordState.omittedNotes || [])];
    const oldLhOmittedNotes = [...(chordState.lhOmittedNotes || [])];
    
    if (property === 'type') {
        chordState.type = value;
        chordState.inversion = 0;
    } else if (property === 'inversion') {
        chordState.inversion = value;
    } else if (property === 'octaveShift') {
        chordState.octaveShift = value;
    } else if (property === 'rhythmPattern') {
        chordState.rhythmPattern = value;
    }

    // Get key without 'm' suffix for calculation
    let keyForCalculation = trainerState.currentKey || 'C';
    const isMinorKey = keyForCalculation && keyForCalculation.endsWith('m');
    if (isMinorKey) {
        keyForCalculation = keyForCalculation.replace(/m$/, '');
    }

    // Use roman numeral if available, otherwise fall back to root note
    const romanOrRoot = chordState.roman || chordState.root;
    if (!romanOrRoot) {
        console.warn('[updateProgressionChord] No roman numeral or root note available for chord');
        return;
    }

    const newData = getProgressionChordNotes(
        keyForCalculation,
        romanOrRoot,
        chordState.type,
        chordState.inversion,
        chordState.octaveShift
    );

    if (newData) {
        // Convert Roman numeral to minor case if key is minor
        if (isMinorKey && newData.roman) {
            const minorMap = {
                'I': 'i',
                'ii': 'ii°',
                'iii': 'III',
                'IV': 'iv',
                'V': 'v',
                'vi': 'VI',
                'vii°': 'VII'
            };
            newData.roman = minorMap[newData.roman] || newData.roman;
        }
        
        // If octave shift changed, map omitted notes from old octave to new octave
        if (property === 'octaveShift' && oldOctaveShift !== chordState.octaveShift) {
            // Strategy: Match notes by note name (ignoring octave) - most reliable
            // This ensures that if B4 was omitted, B5 will be omitted after octave shift
            // We don't rely on index position as it can be unreliable with inversions or note reordering
            
            // Build a comprehensive map from old note to new note by matching note names
            const noteMap = new Map();
            const usedNewNotes = new Set(); // Track which new notes have been mapped
            
            // First pass: try to match by exact position (works for most cases)
            const minLength = Math.min(oldNotes.length, newData.notes.length);
            for (let i = 0; i < minLength; i++) {
                const oldNote = oldNotes[i];
                const newNote = newData.notes[i];
                const oldMatch = oldNote.match(/^([A-G][#b]?)(\d+)$/);
                const newMatch = newNote.match(/^([A-G][#b]?)(\d+)$/);
                
                // Only map if note names match (same pitch class)
                if (oldMatch && newMatch && oldMatch[1] === newMatch[1]) {
                    noteMap.set(oldNote, newNote);
                    usedNewNotes.add(newNote);
                }
            }
            
            // Second pass: match remaining notes by name (for cases where order differs)
            oldNotes.forEach((oldNote) => {
                // Skip if already mapped
                if (noteMap.has(oldNote)) return;
                
                const oldMatch = oldNote.match(/^([A-G][#b]?)(\d+)$/);
                if (!oldMatch) return;
                
                const oldNoteName = oldMatch[1];
                
                // Find the corresponding note in the new chord by matching note name
                // Prefer notes that haven't been mapped yet
                const matchingNewNote = newData.notes.find(note => {
                    if (usedNewNotes.has(note)) return false; // Already mapped
                    const newMatch = note.match(/^([A-G][#b]?)(\d+)$/);
                    return newMatch && newMatch[1] === oldNoteName;
                });
                
                if (matchingNewNote) {
                    noteMap.set(oldNote, matchingNewNote);
                    usedNewNotes.add(matchingNewNote);
                }
            });
            
            // Map omitted notes using the comprehensive map
            const mappedOmittedNotes = oldOmittedNotes
                .map(oldOmittedNote => {
                    // Try the map first
                    const mapped = noteMap.get(oldOmittedNote);
                    if (mapped) return mapped;
                    
                    // Fallback: direct name matching if map didn't work
                    const oldMatch = oldOmittedNote.match(/^([A-G][#b]?)(\d+)$/);
                    if (oldMatch) {
                        const oldNoteName = oldMatch[1];
                        // Find first unmapped note with matching name
                        const matchingNewNote = newData.notes.find(note => {
                            const newMatch = note.match(/^([A-G][#b]?)(\d+)$/);
                            return newMatch && newMatch[1] === oldNoteName;
                        });
                        return matchingNewNote;
                    }
                    return undefined;
                })
                .filter(note => note !== undefined && note !== null); // Remove any notes that couldn't be mapped
            
            newData.omittedNotes = mappedOmittedNotes;
            
            // Debug logging to help diagnose issues (can be removed later)
            //     chordIndex: index,
            //     oldOctaveShift,
            //     newOctaveShift: chordState.octaveShift,
            //     oldNotes,
            //     newNotes: newData.notes,
            //     oldOmittedNotes,
            //     mappedOmittedNotes,
            //     finalVisibleNotes: newData.notes.filter(n => !mappedOmittedNotes.includes(n)),
            //     noteMap: Array.from(noteMap.entries())
            // });
            
            // Also map LH omitted notes if they exist
            if (oldLhOmittedNotes.length > 0 && chordState.lhType && chordState.lhType !== 'off') {
                const oldLhNotes = getLHNotes(
                    chordState.root,
                    chordState.lhType,
                    chordState.lhInversion,
                    trainerState.currentKey,
                    chordState.lhOctaveShift || 0,
                    chordState.type,
                    getEnharmonicPreference()
                );
                
                // Recalculate LH notes (they might also be affected if LH octave shift changes)
                const newLhNotes = getLHNotes(
                    newData.root,
                    chordState.lhType,
                    chordState.lhInversion,
                    trainerState.currentKey,
                    chordState.lhOctaveShift || 0,
                    newData.type,
                    getEnharmonicPreference()
                );
                
                // Map LH omitted notes
                const lhNoteNameMap = new Map();
                oldLhNotes.forEach((oldLhNote, idx) => {
                    if (newLhNotes[idx]) {
                        lhNoteNameMap.set(oldLhNote, newLhNotes[idx]);
                    } else {
                        const oldMatch = oldLhNote.match(/^([A-G][#b]?)(\d+)$/);
                        if (oldMatch) {
                            const oldNoteName = oldMatch[1];
                            const matchingNewNote = newLhNotes.find(note => {
                                const newMatch = note.match(/^([A-G][#b]?)(\d+)$/);
                                return newMatch && newMatch[1] === oldNoteName;
                            });
                            if (matchingNewNote) {
                                lhNoteNameMap.set(oldLhNote, matchingNewNote);
                            }
                        }
                    }
                });
                
                const mappedLhOmittedNotes = oldLhOmittedNotes
                    .map(oldOmittedNote => lhNoteNameMap.get(oldOmittedNote))
                    .filter(note => note !== undefined);
                
                newData.lhOmittedNotes = mappedLhOmittedNotes;
            } else {
                newData.lhOmittedNotes = oldLhOmittedNotes;
            }
        } else {
            // No octave shift change, preserve omitted notes as-is
            newData.omittedNotes = oldOmittedNotes;
            newData.lhOmittedNotes = oldLhOmittedNotes;
        }
        
        // Preserve properties that aren't recalculated
        newData.isVoicingExpanded = chordState.isVoicingExpanded;
        newData.lhType = chordState.lhType;
        newData.lhInversion = chordState.lhInversion;
        newData.lhOctaveShift = chordState.lhOctaveShift;
        newData.octaveShift = chordState.octaveShift; // Preserve octave shift
        newData.rhythmPattern = chordState.rhythmPattern; // Preserve rhythm
        trainerState.progressionData[index] = newData;
        
        // Re-render both progression displays to keep them in sync
        renderProgressionDisplay('melody-progression-visualization', true);
        renderProgressionDisplay('melody-progression-visualization', false);
        
        // Auto-render melody notation if on Composition Studio tab or if Free mode is active
        renderMelodyNotationIfNeeded();
    }

    const lhNotes = getLHNotes(
        newData.root,
        newData.lhType,
        newData.lhInversion,
        trainerState.currentKey,
        newData.lhOctaveShift,
        newData.type,
        getEnharmonicPreference()
    );

    // Play chord respecting omitted notes (same as when clicking Play button)
    const rhNotesToPlay = newData.notes.filter(n => !(newData.omittedNotes || []).includes(n));
    const lhNotesToPlay = lhNotes.filter(n => !(newData.lhOmittedNotes || []).includes(n));
    playTrainerChordOnce(rhNotesToPlay.concat(lhNotesToPlay));
    document.getElementById('progression-chord-notes-display').textContent = `Changed: ${newData.roman} (${newData.name})`;
}

/**
 * Update left hand properties for a progression chord
 * @param {number} index - Index of chord
 * @param {string} property - Property to update
 * @param {*} value - New value
 */
function updateProgressionChordLH(index, property, value) {
    const trainerState = getTrainerState();
    if (!trainerState.progressionData[index]) return;

    // Save state before updating
    saveStateBeforeChange();

    trainerState.progressionData[index][property] = property.includes('Inversion') || property.includes('Octave') ? parseInt(value, 10) : value;

    // If the LH type is changed, reset the inversion to Root
    if (property === 'lhType') {
        trainerState.progressionData[index].lhInversion = 0;
    }

    const chord = trainerState.progressionData[index];
    const lhNotes = getLHNotes(
        chord.root,
        chord.lhType,
        chord.lhInversion,
        trainerState.currentKey,
        chord.lhOctaveShift,
        chord.type,
        getEnharmonicPreference()
    );
    playTrainerChordOnce(chord.notes.concat(lhNotes));
    
    // Re-render both progression displays to keep them in sync
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);
    
    // Auto-render melody notation if on Composition Studio tab or if Free mode is active
    renderMelodyNotationIfNeeded();
}

/**
 * Play a trainer chord once for preview
 * @param {Array<string>} notes - Notes to play
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

/**
 * Get max inversion for LH type
 * @param {string} lhType - Left hand type
 * @returns {number} Maximum inversion number
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

// ============================================================================
// Recording Functions
// ============================================================================

/**
 * Toggle recording mode for progression builder
 */
export function toggleRecording() {
    const trainerState = getTrainerState();
    const isRecording = !trainerState.isRecording;
    setIsRecording(isRecording);

    const recordBtn = document.getElementById('record-progression-btn');
    const recordText = document.getElementById('record-text');
    const recordIcon = document.getElementById('record-icon');
    const saveBtn = document.getElementById('save-recording-btn');

    if (isRecording) {
        // Start recording
        setRecordedProgression([]);
        setProgressionData([]);
        setProgressionRomans([]);
        renderProgressionDisplay('melody-progression-visualization', true);
        renderProgressionDisplay('melody-progression-visualization', false);

        recordText.textContent = 'Stop';
        recordBtn.classList.add('animate-pulse');
        recordIcon.innerHTML = '<rect x="7" y="7" width="6" height="6"></rect>'; // Square icon
        saveBtn.disabled = true;

        if (window.showModal) {
            window.showModal("Recording started. Play chords on the keyboard.", true);
        }
    } else {
        // Stop recording
        recordText.textContent = 'Record';
        recordBtn.classList.remove('animate-pulse');
        recordIcon.innerHTML = '<circle cx="10" cy="10" r="7"></circle>'; // Circle icon
        saveBtn.disabled = trainerState.recordedProgression.length === 0;

        if (trainerState.recordedProgression.length > 0 && window.showModal) {
            window.showModal("Recording stopped. Press 'Save' to keep the progression.", true);
        }
    }
}

/**
 * Save the recorded progression
 */
export function saveRecording() {
    document.getElementById('save-recording-btn').disabled = true;
    if (window.showModal) {
        window.showModal("Progression saved!", true);
    }
    // The progression is already in trainerState.progressionData, so we just need to finalize it
}

// ============================================================================
// UI Helper Functions
// ============================================================================

/**
 * Add a chord to the progression data
 * @param {Object} chordData - Chord data object to add
 * @param {Object} options - Optional settings
 * @param {boolean} options.skipRender - Skip rendering (for batch operations)
 */
export function addToProgressionData(chordData, options = {}) {
    const trainerState = getTrainerState();

    // If beats not provided, default to one full measure based on current time signature
    if (chordData.beats === undefined) {
        let defaultBeats = 4;
        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        if (compositionState && compositionState.metadata && compositionState.metadata.timeSignature) {
            const ts = compositionState.metadata.timeSignature;
            // Normalize to quarter-note beats: num * (4 / denom)
            // e.g., 4/4 = 4 beats, 3/4 = 3 beats, 6/8 = 3 beats (6 eighth notes = 3 quarter notes)
            const num = ts.num || 4;
            const denom = ts.denom || 4;
            defaultBeats = num * (4 / denom);
        }
        chordData.beats = defaultBeats;
    }

    // Save state before adding (only on first chord of batch to avoid multiple undo states)
    if (!options.skipRender) {
        saveStateBeforeChange();
    }

    // Phase 2.1: Check for position-based insertion
    const insertAfterIndex = getInsertAfterIndex();
    const usePositionBasedInsert = insertAfterIndex !== null &&
                                   insertAfterIndex >= 0 &&
                                   insertAfterIndex < trainerState.progressionData.length;

    if (usePositionBasedInsert) {
        // Insert after the selected chord
        const targetIndex = insertAfterIndex + 1;
        trainerState.progressionData.splice(targetIndex, 0, chordData);

        // Update compositionState if available to keep it in sync
        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        if (compositionState && typeof compositionState.insertChordAt === 'function') {
            // If compositionState has an insertChordAt method, use it
            // Otherwise the sync will happen via setProgressionData
        }
    } else {
        // Default: append to end
        trainerState.progressionData.push(chordData);
    }

    if (chordData.roman && !trainerState.progressionRomans.includes(chordData.roman)) {
        trainerState.progressionRomans.push(chordData.roman);
    }
    setProgressionData(trainerState.progressionData);

    // Dispatch event for guided lesson mode
    if (isGuidedModeActive()) {
        dispatchBuilderEvent('progressionChordAdded', {
            chord: `${chordData.root} ${chordData.type}`,
            root: chordData.root,
            type: chordData.type,
            inversion: chordData.inversion,
            position: trainerState.progressionData.length - 1,
            key: trainerState.currentKey
        });
    }

    // Skip all rendering if in batch mode
    if (options.skipRender) {
        return;
    }

    // Save scroll position to prevent jumping when notation refreshes
    // Save both window scroll and any scrollable container scroll positions
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    const canvasContainer = document.getElementById('interactive-melody-notation-canvas')?.parentElement;
    const containerScrollTop = canvasContainer ? canvasContainer.scrollTop : 0;
    const containerScrollLeft = canvasContainer ? canvasContainer.scrollLeft : 0;

    // Render both progression displays to keep them in sync
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

    // Also update the Chord Lab/Builder panel if it exists
    if (window.updateBuilderProgressionPanel) {
        window.updateBuilderProgressionPanel();
    }

    // Auto-render melody notation if on Composition Studio tab or if Free mode is active
    // This function already checks the tab and only refreshes if needed
    // Pass preventScroll=true to prevent page from jumping to notation
    renderMelodyNotationIfNeeded(true);

    // Restore scroll position multiple times to catch any delayed scrolling
    // This prevents the page from jumping when notation refreshes on any tab
    const restoreScroll = () => {
        // Prevent any element from getting focus that might cause scrolling
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'CANVAS' || activeElement.id?.includes('canvas'))) {
            // Blur canvas if it got focused (which would cause scroll)
            activeElement.blur();
        }

        window.scrollTo(scrollX, scrollY);
        if (canvasContainer) {
            canvasContainer.scrollTop = containerScrollTop;
            canvasContainer.scrollLeft = containerScrollLeft;
        }
    };

    // Restore immediately and after rendering delays
    restoreScroll();
    requestAnimationFrame(() => {
        restoreScroll();
        requestAnimationFrame(() => {
            restoreScroll();
            // Multiple restores to catch any delayed scrolls from async rendering
            setTimeout(restoreScroll, 50);
            setTimeout(restoreScroll, 100);
            setTimeout(restoreScroll, 200);
            setTimeout(restoreScroll, 300);
        });
    });
}

/**
 * Render progression controls (populate dropdowns)
 */
export function renderProgressionControls() {
    const keySelect = document.getElementById('trainer-key-select');
    const progressionSelect = document.getElementById('trainer-progression-select');

    if (!keySelect || !progressionSelect) return;

    // Populate key selector with both major and minor keys
    keySelect.innerHTML = '';
    const notes = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;

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

    keySelect.value = selectedKey;
    progressionSelect.selectedIndex = selectedProgIndex;
    console.log(`Loaded random progression: ${selectedProgName} in ${selectedKey}`);

    // Add event listeners
    keySelect.onchange = () => loadProgression();
    progressionSelect.onchange = () => loadProgression();
    
    // Update "Current Key" display text on initial render
    updateCurrentKeyDisplay();
    
    // Add event listener for speed selector - restart playback if currently playing
    const speedSelect = document.getElementById('trainer-speed-select');
    if (speedSelect) {
        speedSelect.onchange = () => {
            const trainerState = getTrainerState();
            if (trainerState.isPlaying && window.handleAutoPlayback) {
                // Restart playback with new speed
                handleAutoPlayback(); // This will stop current playback
                // Then start again after a brief delay
                setTimeout(() => {
                    handleAutoPlayback(); // This will start with new speed
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
        renderProgressionDisplay('melody-progression-visualization', true);
        renderProgressionDisplay('melody-progression-visualization', false);
    }
}

/**
 * Update the progression controls UI state
 */
function updateProgressionControlsUI() {
    // Always get fresh state to ensure accuracy
    const trainerState = getTrainerState();
    // Also check window.trainerState for consistency
    const isPlaying = trainerState.isPlaying || (window.trainerState && window.trainerState.isPlaying);
    const isReady = trainerState.isReady;

    const playBtn = document.getElementById('play-progression-btn');
    const stepBtn = document.getElementById('step-chord-btn');

    if (!stepBtn || !playBtn) return;

    // Update Step button - disabled when not ready OR when playing
    stepBtn.disabled = !isReady || isPlaying;

    // Always use pointer cursor - remove any cursor-not-allowed classes
    stepBtn.classList.remove('cursor-not-allowed');
    stepBtn.classList.add('cursor-pointer');

    const playText = document.getElementById('play-text');
    if (isPlaying) {
        if (playText) playText.textContent = 'Stop';
        playBtn.classList.remove('bg-teal-600', 'hover:bg-teal-700');
        playBtn.classList.add('bg-red-600', 'hover:bg-red-700');
    } else {
        if (playText) playText.textContent = 'Auto Play';
        playBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        playBtn.classList.add('bg-teal-600', 'hover:bg-teal-700');
    }
}

// ============================================================================
// Undo/Redo Functions
// ============================================================================

/**
 * Capture the current progression state for undo/redo
 * Includes both chord progression data AND notation data for full undo support
 * @returns {Object} State snapshot
 */
function captureProgressionState() {
    const trainerState = getTrainerState();
    const state = {
        progressionData: JSON.parse(JSON.stringify(trainerState.progressionData)),
        progressionRomans: [...trainerState.progressionRomans],
        currentKey: trainerState.currentKey
    };

    // Capture notation state from CompositionState for full undo support
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (compositionState) {
        // Deep clone the measures array which contains all notation data
        if (compositionState.measures) {
            state.notationData = JSON.parse(JSON.stringify(compositionState.measures));
        }

        // Capture time signature from metadata
        if (compositionState.metadata?.timeSignature) {
            state.timeSignature = { ...compositionState.metadata.timeSignature };
        }

        // Capture block sequences for treble and bass clefs
        // These contain detailed note-by-unit data that's essential for accurate restoration
        if (compositionState.trebleBlockSequence) {
            try {
                state.trebleBlockSequence = compositionState.trebleBlockSequence.toJSON();
            } catch (e) {
                console.warn('[captureProgressionState] Failed to serialize trebleBlockSequence:', e);
            }
        }

        if (compositionState.bassBlockSequence) {
            try {
                state.bassBlockSequence = compositionState.bassBlockSequence.toJSON();
            } catch (e) {
                console.warn('[captureProgressionState] Failed to serialize bassBlockSequence:', e);
            }
        }

        // Capture chord segments for bass note tracking
        if (compositionState.chordSegments) {
            state.chordSegments = JSON.parse(JSON.stringify(compositionState.chordSegments));
        }

        // Capture other relevant metadata
        if (compositionState.metadata) {
            state.metadata = JSON.parse(JSON.stringify(compositionState.metadata));
        }
    }

    return state;
}

/**
 * Restore a progression state snapshot
 * Restores both chord progression data AND notation data for full undo support
 * @param {Object} state - State snapshot to restore
 */
function restoreProgressionState(state) {
    if (!state) return;

    // Restore chord progression state
    setProgressionData(state.progressionData);
    setProgressionRomans(state.progressionRomans);
    setCurrentKey(state.currentKey);

    // Restore notation state if it was captured
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (compositionState) {
        // Restore measures array
        if (state.notationData) {
            compositionState.measures = JSON.parse(JSON.stringify(state.notationData));
        }

        // Restore time signature to metadata
        if (state.timeSignature) {
            compositionState.metadata.timeSignature = { ...state.timeSignature };
        } else if (state.metadata?.timeSignature) {
            compositionState.metadata.timeSignature = { ...state.metadata.timeSignature };
        }

        // Restore full metadata if captured
        if (state.metadata) {
            // Preserve timeSignature we just set, but restore other metadata
            const preservedTS = compositionState.metadata.timeSignature;
            Object.assign(compositionState.metadata, JSON.parse(JSON.stringify(state.metadata)));
            compositionState.metadata.timeSignature = preservedTS;
        }

        // Restore treble block sequence
        if (state.trebleBlockSequence) {
            try {
                compositionState.trebleBlockSequence = BuildingBlockSequence.fromJSON(state.trebleBlockSequence);
            } catch (e) {
                console.warn('[restoreProgressionState] Failed to restore trebleBlockSequence:', e);
            }
        }

        // Restore bass block sequence
        if (state.bassBlockSequence) {
            try {
                compositionState.bassBlockSequence = BuildingBlockSequence.fromJSON(state.bassBlockSequence);
            } catch (e) {
                console.warn('[restoreProgressionState] Failed to restore bassBlockSequence:', e);
            }
        }

        // Restore chord segments for bass note tracking
        if (state.chordSegments) {
            compositionState.chordSegments = JSON.parse(JSON.stringify(state.chordSegments));
        }

        // Emit event to notify listeners of the change
        compositionState.events.emit('loaded', { measures: compositionState.measures });

        // Update time signature in toolbar and notation
        const ts = compositionState.metadata.timeSignature;
        if (ts) {
            // Update toolbar's time signature select
            if (window.getNotationComposer) {
                const notationComposer = window.getNotationComposer();
                if (notationComposer?.toolbar?.setTimeSignature) {
                    notationComposer.toolbar.setTimeSignature(ts.num, ts.denom);
                }
            }

            // Update time signature display in notation if function exists
            if (window.updateTimeSignatureDisplay) {
                window.updateTimeSignatureDisplay(ts.num, ts.denom);
            }
        }
    }

    // Re-render display
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

    // Update keyboard labels if function exists
    if (window.updateKeyboardLabels) {
        setTimeout(() => window.updateKeyboardLabels(), 10);
    }

    // Update key signature display
    if (window.updateKeySignatureDisplay) {
        window.updateKeySignatureDisplay(state.currentKey);
    }

    // Sync to window.trainerState
    if (typeof window !== 'undefined') {
        window.trainerState = getTrainerState();
    }
}

/**
 * Handle undo action
 */
export function handleUndo() {
    if (!canUndo()) return;

    // Save current state to redo stack before undoing
    const currentState = captureProgressionState();
    pushToRedoStack(currentState);

    // Get previous state
    const previousState = undoHistory();

    // Restore previous state
    if (previousState) {
        restoreProgressionState(previousState);

        // Re-render progression display in both tabs
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('melody-progression-visualization', true);
            window.renderProgressionDisplay('melody-progression-visualization', false);
        }

        // Re-render VexFlow notation from the restored compositionState.measures
        // IMPORTANT: Do NOT call syncProgressionToMelodyComposer() here!
        // That would overwrite the restored notation data with a fresh sync from progressionData,
        // losing the specific note edits (duration, accidentals, etc.) we just restored.
        if (window.getNotationComposer) {
            const notationComposer = window.getNotationComposer();
            if (notationComposer && typeof notationComposer.render === 'function') {
                notationComposer.render(true);
            }
        }

        // Refresh chord recommendations and analysis (includes borrowed chords)
        if (window.recommendationService) {
            window.recommendationService.refreshRecommendations();
        }

        // Refresh melody suggestions if controller is initialized
        if (window.melodySuggestionController &&
            typeof window.melodySuggestionController.refreshSuggestions === 'function') {
            window.melodySuggestionController.refreshSuggestions();
        }

        // Show feedback
        const display = document.getElementById('progression-chord-notes-display');
        if (display) {
            display.textContent = 'Undo: Restored previous state';
        }

        // Update undo/redo button states
        updateUndoRedoButtons();
    }
}

/**
 * Handle redo action
 */
export function handleRedo() {
    if (!canRedo()) return;

    // Save current state to undo stack before redoing
    const currentState = captureProgressionState();
    pushToUndoStack(currentState);

    // Get next state
    const nextState = redoHistory();

    // Restore next state
    if (nextState) {
        restoreProgressionState(nextState);

        // Re-render progression display in both tabs
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('melody-progression-visualization', true);
            window.renderProgressionDisplay('melody-progression-visualization', false);
        }

        // Re-render VexFlow notation from the restored compositionState.measures
        // IMPORTANT: Do NOT call syncProgressionToMelodyComposer() here!
        // That would overwrite the restored notation data with a fresh sync from progressionData,
        // losing the specific note edits (duration, accidentals, etc.) we just restored.
        if (window.getNotationComposer) {
            const notationComposer = window.getNotationComposer();
            if (notationComposer && typeof notationComposer.render === 'function') {
                notationComposer.render(true);
            }
        }

        // Refresh chord recommendations and analysis (includes borrowed chords)
        if (window.recommendationService) {
            window.recommendationService.refreshRecommendations();
        }

        // Refresh melody suggestions if controller is initialized
        if (window.melodySuggestionController &&
            typeof window.melodySuggestionController.refreshSuggestions === 'function') {
            window.melodySuggestionController.refreshSuggestions();
        }

        // Show feedback
        const display = document.getElementById('progression-chord-notes-display');
        if (display) {
            display.textContent = 'Redo: Restored next state';
        }

        // Update undo/redo button states
        updateUndoRedoButtons();
    }
}

/**
 * Save current state before making changes (to be called before mutations)
 * Call this before any edit operation to enable undo support
 */
export function saveStateBeforeChange() {
    const currentState = captureProgressionState();
    saveState(currentState);

    // Mark composition as dirty for auto-save
    // This triggers the debounced auto-save mechanism
    try {
        markAutoSaveDirty();
    } catch (e) {
        // Auto-save may not be initialized yet, ignore
    }
}

/**
 * Parse a delimited chord list string into an array of chord symbols
 * Supports various delimiters: spaces, commas, dashes, pipes, etc.
 * @param {string} chordListString - The chord list string (e.g., "C - F - Am - G" or "C, F, Am, G")
 * @returns {Array<string>} Array of chord symbols
 */
function parseChordList(chordListString) {
    if (!chordListString || typeof chordListString !== 'string') {
        return [];
    }
    
    // Trim the string
    let trimmed = chordListString.trim();
    if (!trimmed) {
        return [];
    }
    
    // Split by common delimiters: comma, dash, pipe, or multiple spaces
    // Use regex to split on one or more of: comma, dash, pipe, or whitespace
    const chords = trimmed
        .split(/[,|\-–—]|\s+/)
        .map(chord => chord.trim())
        .filter(chord => chord.length > 0);
    
    return chords;
}

/**
 * Parse a chord symbol and determine its root and type
 * @param {string} chordSymbol - Chord symbol (e.g., "C", "Am", "F#m7", "Gsus4")
 * @returns {Object|null} Object with root and type, or null if invalid
 */
function parseChordSymbol(chordSymbol) {
    if (!chordSymbol || typeof chordSymbol !== 'string') {
        return null;
    }
    
    // Match pattern: [A-G][#b]?[type/extensions]
    const match = chordSymbol.match(/^([A-G])([#b]?)(.*)$/);
    if (!match) {
        return null;
    }
    
    const root = match[1] + match[2]; // e.g., "C", "F#", "Bb"
    const typeAndExtensions = match[3]; // e.g., "m", "m7", "maj7", "sus4", ""
    
    // Determine chord type from the suffix
    // Check more specific patterns first before generic patterns
    let chordType = 'Major'; // default

    // Check for extended chords first (9ths, then 7ths, then 6ths)
    if (typeAndExtensions.includes('add9') || typeAndExtensions.includes('add2')) {
        chordType = 'Add9';
    } else if (typeAndExtensions.includes('9')) {
        if (typeAndExtensions.includes('maj9') || typeAndExtensions.includes('M9')) {
            chordType = 'Major 9th';
        } else if (typeAndExtensions.startsWith('m9')) {
            chordType = 'Minor 9th';
        } else if (typeAndExtensions.includes('6/9')) {
            chordType = '6/9';
        } else {
            chordType = 'Dominant 9th';
        }
    } else if (typeAndExtensions.includes('7')) {
        // Check for major 7th first (maj7, M7, Maj7, etc.)
        if (typeAndExtensions.toLowerCase().includes('maj7') || typeAndExtensions.includes('M7') || typeAndExtensions.includes('Δ7')) {
            chordType = 'Major 7th';
        } else if (typeAndExtensions.startsWith('m7') || typeAndExtensions.startsWith('min7') || typeAndExtensions.startsWith('-7')) {
            chordType = 'Minor 7th';
        } else if (typeAndExtensions.includes('dim7')) {
            chordType = 'Diminished 7th';
        } else if (typeAndExtensions.includes('m7b5') || typeAndExtensions.includes('ø7') || typeAndExtensions.includes('ø')) {
            chordType = 'Half-Diminished 7th';
        } else {
            // Plain 7 = Dominant 7th
            chordType = 'Dominant 7th';
        }
    } else if (typeAndExtensions.includes('6')) {
        if (typeAndExtensions.startsWith('m6')) {
            chordType = 'Minor 6th';
        } else {
            chordType = 'Major 6th';
        }
    } else if (typeAndExtensions.includes('dim')) {
        chordType = 'Diminished';
    } else if (typeAndExtensions.includes('aug') || typeAndExtensions.includes('+')) {
        chordType = 'Augmented';
    } else if (typeAndExtensions.includes('sus')) {
        chordType = typeAndExtensions.includes('sus2') || typeAndExtensions.includes('2') ? 'Sus2' : 'Sus4';
    } else if (typeAndExtensions.startsWith('m') && !typeAndExtensions.startsWith('maj')) {
        // Plain minor (only after checking for m7, m9, m6, etc.)
        chordType = 'Minor';
    }
    
    return { root, type: chordType };
}

/**
 * Import a chord list string into the progression
 * @param {string} mode - Either 'replace' or 'append'
 */
export function importChordList(mode = 'replace') {
    const input = document.getElementById('chord-list-input');
    if (!input) {
        return;
    }
    
    const chordListString = input.value.trim();
    if (!chordListString) {
        if (window.showModal) {
            window.showModal('Please enter a chord list to import.', true);
        }
        return;
    }
    
    // Parse the chord list
    const chordSymbols = parseChordList(chordListString);
    if (chordSymbols.length === 0) {
        if (window.showModal) {
            window.showModal('No valid chords found in the input. Please check the format.', true);
        }
        return;
    }
    
    // Get trainer state BEFORE clearing (if replacing)
    let trainerState = getTrainerState();
    const currentKey = trainerState.currentKey || 'C';
    const keyForCalculation = currentKey.endsWith('m') ? currentKey.replace(/m$/, '') : currentKey;
    const octaveShift = trainerState.octaveShift || 0;
    const enharmonicPreference = getEnharmonicPreference();
    const notationPreference = getNotationPreference();
    
    
    // Clear progression if replacing
    if (mode === 'replace') {
        clearProgression();
        // Get fresh state after clearing
        trainerState = getTrainerState();
    }
    
    // Convert enharmonic preference to match the key if needed
    const notes = enharmonicPreference === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
    
    // Play shutter sound only once at the beginning
    let shutterSoundPlayed = false;
    if (window.getAudioIsReady && window.getCameraShutter) {
        const audioIsReady = window.getAudioIsReady();
        const cameraShutter = window.getCameraShutter();
        // Only play if buffer is loaded
        if (audioIsReady && cameraShutter && cameraShutter.loaded) {
            cameraShutter.start();
            shutterSoundPlayed = true;
        }
    }
    
    // Process each chord
    const newChords = [];
    let successCount = 0;
    let errorCount = 0;
    
    chordSymbols.forEach((chordSymbol, index) => {
        const parsed = parseChordSymbol(chordSymbol);
        if (!parsed) {
            errorCount++;
            return;
        }
        
        // Convert root to match enharmonic preference
        let root = parsed.root;
        // Check if root needs conversion
        if (enharmonicPreference === 'sharp' && FLAT_NOTES.includes(root)) {
            // Convert flat to sharp
            const flatIndex = FLAT_NOTES.indexOf(root);
            root = SHARP_NOTES[flatIndex];
        } else if (enharmonicPreference === 'flat' && SHARP_NOTES.includes(root)) {
            // Convert sharp to flat
            const sharpIndex = SHARP_NOTES.indexOf(root);
            root = FLAT_NOTES[sharpIndex];
        }
        
        
        // Get chord notes
        const chordResult = getInvertedChordNotes(
            root,
            parsed.type,
            0, // Default to root position (no inversion)
            keyForCalculation,
            octaveShift,
            enharmonicPreference,
            notationPreference
        );
        
        
        if (!chordResult || !chordResult.specificNotes || chordResult.specificNotes.length === 0) {
            errorCount++;
            return;
        }
        
        // Calculate Roman numeral
        let trainerKeyRootIndex = ALL_NOTES.indexOf(keyForCalculation);
        if (trainerKeyRootIndex === -1) {
            trainerKeyRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[keyForCalculation] || keyForCalculation);
        }
        let addedChordRootIndex = ALL_NOTES.indexOf(root);
        if (addedChordRootIndex === -1) {
            addedChordRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[root] || root);
        }
        if (addedChordRootIndex === -1) {
            errorCount++;
            return;
        }
        
        const interval = (addedChordRootIndex - trainerKeyRootIndex + 12) % 12;
        const scaleDegreeIndex = MAJOR_SCALE_STEPS.indexOf(interval);
        
        let romanNumeral = '?';
        if (scaleDegreeIndex !== -1) {
            const romanKeys = Object.keys(ROMAN_MAP_BASE);
            // First try to find exact match (for basic triads)
            let foundKey = romanKeys.find(key =>
                ROMAN_MAP_BASE[key].index === scaleDegreeIndex &&
                ROMAN_MAP_BASE[key].quality === parsed.type
            );
            
            // If no exact match, find by scale degree index only (for extended chords)
            if (!foundKey) {
                foundKey = romanKeys.find(key => ROMAN_MAP_BASE[key].index === scaleDegreeIndex);
            }
            
            romanNumeral = foundKey || '?';
            
            // For extended chords, append the extension to the Roman numeral
            if (foundKey && parsed.type !== 'Major' && parsed.type !== 'Minor') {
                // Add extension suffix (e.g., "I7" for "I Dominant 7th")
                if (parsed.type.includes('7th')) {
                    romanNumeral = romanNumeral + '7';
                } else if (parsed.type.includes('9th')) {
                    romanNumeral = romanNumeral + '9';
                }
            }
        } else {
            // Non-diatonic chord - use root note as identifier
            romanNumeral = root;
        }
        
        // Convert Roman numeral to minor case if the key is minor
        const isMinorKey = currentKey && currentKey.endsWith('m');
        if (isMinorKey && romanNumeral && romanNumeral !== '?') {
            const minorMap = {
                'I': 'i',
                'ii': 'ii°',
                'iii': 'III',
                'IV': 'iv',
                'V': 'v',
                'vi': 'VI',
                'vii°': 'VII'
            };
            romanNumeral = minorMap[romanNumeral] || romanNumeral;
        }
        
        // Generate default LH notes (1 octave below RH)
        const defaultLHType = 'rootOnly';
        const defaultRHOctaveShift = 0; // New chords start at default octave
        const defaultLHRelativeShift = 0; // No shift from LH base octave (octave 2)
        const absoluteLHOctaveShift = defaultRHOctaveShift + defaultLHRelativeShift;
        const defaultLHNotes = getLHNotes(
            root,
            defaultLHType,
            0,  // lhInversion
            key,
            absoluteLHOctaveShift,
            parsed.type,
            getEnharmonicPreference()
        );
        
        // Create chord data object
        const chordData = {
            roman: romanNumeral,
            name: chordResult.name,
            simpleName: chordResult.simpleName || chordResult.name,
            notes: chordResult.specificNotes,
            root: root,
            type: parsed.type,
            inversion: 0,
            selectionMode: 'chord',
            omittedNotes: [],
            octaveShift: octaveShift,
            lhType: defaultLHType,
            lhInversion: 0,
            lhOctaveShift: 0,
            lhNotes: defaultLHNotes,
            lhOmittedNotes: [],
            rhythmPattern: 'block',
            isVoicingExpanded: true
        };
        
        newChords.push(chordData);
        successCount++;
    });
    
    // Add all chords to progression
    if (newChords.length > 0) {
        // Save state before adding
        saveStateBeforeChange();
        
        // Get fresh state reference
        trainerState = getTrainerState();
        
        // Ensure progressionData array exists
        if (!trainerState.progressionData) {
            trainerState.progressionData = [];
        }
        if (!trainerState.progressionRomans) {
            trainerState.progressionRomans = [];
        }
        
        
        // Add chords to progression
        newChords.forEach((chordData, idx) => {
            trainerState.progressionData.push(chordData);
            if (chordData.roman && !trainerState.progressionRomans.includes(chordData.roman)) {
                trainerState.progressionRomans.push(chordData.roman);
            }
        });
        
        
        // Update state using setters
        setProgressionData(trainerState.progressionData);
        setProgressionRomans(trainerState.progressionRomans);
        setIsReady(true);
        
        // Get fresh state after updating
        trainerState = getTrainerState();
        
        // Render progression display
        renderProgressionDisplay('melody-progression-visualization', true);
        renderProgressionDisplay('melody-progression-visualization', false);
        
        // Update UI
        updateProgressionControlsUI();
        
        // Clear the input
        input.value = '';
        
        // Show success message
        const message = mode === 'replace' 
            ? `Replaced progression with ${successCount} chord${successCount !== 1 ? 's' : ''}.`
            : `Appended ${successCount} chord${successCount !== 1 ? 's' : ''} to progression.`;
        
        if (errorCount > 0) {
            if (window.showModal) {
                window.showModal(`${message}\n\n${errorCount} chord${errorCount !== 1 ? 's' : ''} could not be parsed.`, false);
            }
        } else {
            if (window.showModal) {
                window.showModal(message, false);
            }
        }
    } else {
        if (window.showModal) {
            window.showModal('No valid chords could be imported. Please check the format.', true);
        }
    }
}

// ============================================================================
// PHASE 3.1: Template Browser Integration
// ============================================================================

/**
 * Open the template browser modal
 * Allows users to browse and select progression templates by category
 */
export function openTemplateBrowser() {
    showTemplateBrowser((template, action, rhythmPattern) => {
        loadTemplateToProgression(template, action, rhythmPattern);
    });
}

/**
 * Load a selected template into the progression
 * @param {object} template - Template object from template browser
 * @param {string} action - 'load' (replace), 'append' (add to end), 'load-suggestion' (load with voice leading), 'append-suggestion' (append with voice leading)
 * @param {string} rhythmPattern - Optional rhythm pattern ID to apply
 */
function loadTemplateToProgression(template, action = 'load', rhythmPattern = null) {

    const keySelect = document.getElementById('trainer-key-select');
    const currentKey = keySelect ? keySelect.value : 'C';

    // Determine if voice leading optimization should be applied
    const applyVoiceLeading = action.includes('suggestion');
    // Normalize action to base type ('load' or 'append')
    const baseAction = action.replace('-suggestion', '');

    // Stop playback if currently playing
    const trainerState = getTrainerState();
    if (trainerState.isPlaying && window.handleAutoPlayback) {
        handleAutoPlayback();
    }

    // Get roman numerals from template
    const romans = template.progressions;

    // Get rhythm pattern beats if specified
    const pattern = rhythmPattern ? getPatternById(rhythmPattern) : null;
    const patternBeats = pattern ? pattern.beats : null;

    // Set the key
    setCurrentKey(currentKey);

    // Calculate scale notes for the key
    const keyIndex = SHARP_NOTES.indexOf(currentKey);
    const scaleNotes = MAJOR_SCALE_STEPS.map(step => {
        const noteIndex = (keyIndex + step) % 12;
        return SHARP_NOTES[noteIndex];
    });
    setScaleNotes(scaleNotes);

    // Build progression data from template
    let progressionData = [];
    let progressionRomans = [];

    // If appending, start with existing progression
    if (baseAction === 'append' && trainerState.progressionData && trainerState.progressionData.length > 0) {
        progressionData = [...trainerState.progressionData];
        progressionRomans = [...trainerState.progressionRomans];
    }

    romans.forEach((roman, index) => {
        // Parse roman numeral to extract base and quality
        // Examples: "I", "ii", "V7", "Imaj7", "ii7", "vii°", "ii°7", "I9", "Imaj9", "#IVdim7"
        let baseRoman = roman;
        let chordQuality = null;
        let isDiminished = false;

        // Check for diminished symbol (° or dim) - must check before chord suffix stripping
        if (roman.includes('°') || roman.toLowerCase().includes('dim')) {
            isDiminished = true;
        }

        // Check for chord suffixes (in order of specificity - longer patterns first)
        if (roman.includes('maj13')) {
            baseRoman = roman.replace('maj13', '');
            chordQuality = 'Major 13th';
        } else if (roman.includes('maj11')) {
            baseRoman = roman.replace('maj11', '');
            chordQuality = 'Major 11th';
        } else if (roman.includes('maj9')) {
            baseRoman = roman.replace('maj9', '');
            chordQuality = 'Major 9th';
        } else if (roman.includes('maj7')) {
            baseRoman = roman.replace('maj7', '');
            chordQuality = 'Major 7th';
        } else if (roman.includes('dim7') || roman.includes('°7')) {
            // Diminished 7th (e.g., vii°7, #IVdim7, ii°7)
            baseRoman = roman.replace('dim7', '').replace('°7', '');
            chordQuality = 'Diminished 7th';
        } else if (roman.includes('13')) {
            baseRoman = roman.replace('13', '');
            chordQuality = 'Dominant 13th';
        } else if (roman.includes('11')) {
            baseRoman = roman.replace('11', '');
            chordQuality = 'Dominant 11th';
        } else if (roman.includes('9')) {
            baseRoman = roman.replace('9', '');
            // Determine chord type based on case and diminished flag
            if (isDiminished) {
                chordQuality = 'Diminished 9th';
            } else if (baseRoman.toLowerCase().includes('i') && baseRoman.toLowerCase() === baseRoman) {
                chordQuality = 'Minor 9th';
            } else {
                chordQuality = 'Dominant 9th';
            }
        } else if (roman.includes('7')) {
            baseRoman = roman.replace('7', '');
            // Check if this is a diminished chord with 7th
            if (isDiminished) {
                // Half-diminished for ø7 or diminished with just "7"
                chordQuality = 'Half-Diminished 7th';
            } else if (baseRoman === baseRoman.toUpperCase() || baseRoman === 'V' || baseRoman === 'VII') {
                chordQuality = 'Dominant 7th';
            } else {
                chordQuality = 'Minor 7th';
            }
        }

        // Look up the default quality from ROMAN_MAP_BASE
        const mapEntry = ROMAN_MAP_BASE[baseRoman];
        let defaultQuality = mapEntry ? mapEntry.quality : 'Major'; // Default to Major if not found

        // Override default quality if diminished symbol is present (for triads like vii° or ii°)
        if (isDiminished && !chordQuality) {
            defaultQuality = 'Diminished';
        }

        // Determine final quality - use chord quality if present, otherwise use default
        const finalQuality = chordQuality || defaultQuality;

        // Get chord info from base roman numeral with the correct quality
        const chordInfo = getProgressionChordNotes(currentKey, baseRoman, finalQuality, 0);

        if (chordInfo && chordInfo.root && chordInfo.type) {
            // Use the quality we already determined
            const finalType = finalQuality;

            // LH defaults to 'off' for template-loaded chords (no left hand playing by default)
            // Template chords load one octave lower (-12 semitones)
            // Apply rhythm pattern beats if specified, otherwise default to 4 (whole note)
            const chordData = {
                root: chordInfo.root,
                type: finalType,
                inversion: chordInfo.inversion || 0,
                voicing: 'close',
                roman: roman,
                name: chordInfo.name || `${chordInfo.root} ${finalType}`,
                simpleName: chordInfo.simpleName || `${chordInfo.root} ${finalType}`,
                notes: chordInfo.notes || [],
                lhType: 'off',
                lhInversion: 0,
                lhOctaveShift: 0,
                lhNotes: [],
                lhOmittedNotes: [],
                omittedNotes: [],
                octaveShift: 0, // Base octave is now 3, no shift needed
                key: currentKey,
                beats: patternBeats ? patternBeats[index] : 4
            };

            progressionData.push(chordData);
            progressionRomans.push(roman);
        } else {
        }
    });

    // Apply voice leading optimization if requested
    if (applyVoiceLeading && progressionData.length > 0) {
        // Get the index where new chords start (for append mode)
        const newChordsStartIndex = baseAction === 'append' && trainerState.progressionData ?
            trainerState.progressionData.length : 0;

        // Only optimize the newly added chords
        const chordsToOptimize = progressionData.slice(newChordsStartIndex);
        const optimizedChords = getVoiceLeadingOptimizedProgression(chordsToOptimize);

        // Replace the new chords with optimized versions
        for (let i = 0; i < optimizedChords.length; i++) {
            progressionData[newChordsStartIndex + i] = optimizedChords[i];
        }

        console.log(`[loadTemplateToProgression] Applied voice leading optimization to ${optimizedChords.length} chords`);
    }

    // Update state
    setProgressionData(progressionData);
    setProgressionRomans(progressionRomans);
    setCurrentIndex(0);
    setIsReady(true);

    // Clear undo/redo history for fresh start (only on load, not append)
    if (baseAction === 'load') {
        clearHistory();
    }

    // Render progression display
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

    // Update UI controls
    updateProgressionControlsUI();

    // Show success message with template info
    const actionText = baseAction === 'append' ? 'Appended' : 'Loaded';
    const voiceLeadingText = applyVoiceLeading ? ' (voice-leading optimized)' : '';
    const patternName = pattern ? ` with ${pattern.name} rhythm` : '';
    const message = `${actionText} template: "${template.name}"${voiceLeadingText}${patternName}\n${progressionData.length} total chords in ${currentKey}`;
    if (window.showModal) {
        setTimeout(() => {
            window.showModal(message, false);
            // Auto-hide after 2 seconds
            setTimeout(() => {
                if (window.hideModal) window.hideModal();
            }, 2000);
        }, 100);
    }

}

// ============================================================================
// PHASE 3.2: Rhythm Pattern Modal
// ============================================================================

/**
 * Show rhythm pattern selector modal for applying patterns to existing progressions
 */
export function showRhythmPatternModal() {
    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) {
        if (window.showModal) {
            window.showModal('No Chords', 'Add chords to the progression first before applying a rhythm pattern.');
        }
        return;
    }

    const selection = getSelectedIndicesArray ? getSelectedIndicesArray() : [];
    const hasSelection = selection && selection.length > 0;

    const getTargetIndices = (scope) => {
        if (scope === 'selection' && hasSelection) {
            return [...selection];
        }
        return progressionData.map((_, i) => i);
    };

    let currentScope = hasSelection ? 'selection' : 'all';
    const getTargetChords = () => getTargetIndices(currentScope).map(i => progressionData[i]).filter(Boolean);
    const getChordCount = () => getTargetIndices(currentScope).length;

    const buildPatterns = () => getAllPatternsForCount(getChordCount());
    const getCurrentPattern = () => detectCurrentPattern(getTargetChords());

    if (buildPatterns().length === 0) {
        if (window.showModal) {
            window.showModal('No Patterns Available', `No rhythm patterns available for ${getChordCount()}-chord selection.`);
        }
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'rhythm-pattern-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';

    // Get current time signature from compositionState
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    const timeSignature = compositionState?.metadata?.timeSignature || DEFAULT_TIME_SIGNATURE;
    const timeSignatureDisplay = `${timeSignature.num}/${timeSignature.denom}`;

    modal.innerHTML = `
        <div class="bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <!-- Header -->
            <div class="px-5 py-3 border-b border-gray-700 flex items-center justify-between flex-shrink-0">
                <div class="flex items-center gap-3">
                    <div>
                        <h2 class="text-lg font-bold text-white">Rhythm Pattern Library</h2>
                        <p class="text-xs text-gray-400">Apply rhythm patterns to your progression</p>
                    </div>
                    <div class="px-2 py-1 bg-indigo-600 bg-opacity-30 border border-indigo-500 rounded text-indigo-300 text-xs font-mono">
                        ${timeSignatureDisplay}
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button id="rhythm-manage-custom-btn" class="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium">
                        Manage Custom
                    </button>
                    <button id="rhythm-info-btn" class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded">
                        ?
                    </button>
                    <button id="rhythm-modal-close-btn" class="text-gray-400 hover:text-white transition ml-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Info Panel (collapsible) -->
            <div id="rhythm-info-panel" class="hidden px-5 py-2 bg-gray-800 border-b border-gray-700 text-xs text-gray-300 leading-relaxed">
                <strong>Target:</strong> Choose entire progression or your current selection.
                <strong>Patterns:</strong> Pick a rhythm pattern (beats per chord).
                <strong>Grid:</strong> Edit beats per chord, then Apply.
            </div>

            <!-- Content - Two columns -->
            <div class="flex-1 overflow-auto">
                <div class="px-5 py-4 flex gap-4" style="align-items: flex-start;">
                    <!-- Left Column: Pattern Selection -->
                    <div class="flex-1 space-y-3 min-w-0">
                        <div class="p-3 bg-gray-800 border border-gray-700 rounded">
                            <div class="text-xs text-gray-400 mb-1.5 font-medium">Target</div>
                            <div class="flex items-center gap-4">
                                <label class="inline-flex items-center gap-1.5 text-sm text-gray-200 cursor-pointer">
                                    <input type="radio" name="rhythm-scope" value="all" class="text-orange-500" ${currentScope === 'all' ? 'checked' : ''}>
                                    All (${progressionData.length})
                                </label>
                                <label class="inline-flex items-center gap-1.5 text-sm text-gray-200 cursor-pointer ${hasSelection ? '' : 'opacity-40'}">
                                    <input type="radio" name="rhythm-scope" value="selection" class="text-orange-500" ${currentScope === 'selection' ? 'checked' : ''} ${hasSelection ? '' : 'disabled'}>
                                    Selected (${selection.length || 0})
                                </label>
                            </div>
                        </div>

                        <div class="p-3 bg-gray-800 border border-gray-700 rounded">
                            <div class="flex items-center justify-between mb-1.5">
                                <label class="text-sm font-medium text-gray-300">Pattern</label>
                                <span id="rhythm-custom-count" class="text-[10px] text-gray-500"></span>
                            </div>
                            <select id="rhythm-pattern-select" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:border-orange-500 text-sm"></select>
                        </div>

                        <div class="p-3 bg-gray-800 rounded border border-gray-700 text-sm text-gray-300 min-h-[80px]" id="rhythm-pattern-preview">
                            <!-- Pattern description -->
                        </div>

                        <div class="p-3 bg-gray-800 border border-gray-700 rounded">
                            <div class="flex items-center gap-2">
                                <button id="rhythm-preview-btn" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-medium">
                                    ▶ Preview
                                </button>
                                <button id="rhythm-stop-preview-btn" class="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm">
                                    Stop
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Right Column: Beat Grid -->
                    <div class="flex-1 space-y-3 min-w-0">
                        <div class="p-3 bg-gray-800 border border-gray-700 rounded">
                            <div class="flex items-center justify-between mb-2">
                                <div class="text-sm font-medium text-gray-300">Beat Grid</div>
                                <div class="text-[10px] text-gray-500">Step: 0.25</div>
                            </div>
                            <div id="rhythm-grid" class="space-y-1.5 max-h-52 overflow-y-auto pr-1"></div>
                        </div>

                        <div class="p-3 bg-gray-800 border border-gray-700 rounded">
                            <div class="text-xs text-gray-400 mb-2">Save as Custom Pattern</div>
                            <div class="flex gap-2">
                                <input id="rhythm-custom-name" type="text" class="flex-1 px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm" placeholder="Pattern name...">
                                <button id="rhythm-save-custom-btn" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm font-medium whitespace-nowrap">Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="px-5 py-3 border-t border-gray-700 flex justify-end gap-2 flex-shrink-0 bg-gray-850">
                <button id="rhythm-modal-cancel-btn" class="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded transition text-sm">
                    Cancel
                </button>
                <button id="rhythm-modal-apply-btn" class="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded transition font-semibold text-sm">
                    Apply Pattern
                </button>
            </div>
        </div>

        <!-- Custom Pattern Manager Modal (hidden by default) -->
        <div id="rhythm-custom-manager" class="hidden fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
            <div class="bg-gray-900 rounded-lg shadow-2xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col">
                <div class="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
                    <h3 class="text-base font-bold text-white">Custom Patterns</h3>
                    <button id="rhythm-custom-manager-close" class="text-gray-400 hover:text-white">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <div class="flex-1 overflow-auto p-4">
                    <div id="rhythm-custom-list" class="space-y-2 text-sm">
                        <!-- populated dynamically -->
                    </div>
                </div>
                <div class="px-4 py-3 border-t border-gray-700 text-xs text-gray-400">
                    Click Load to edit in main view, or Delete to remove.
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const patternSelectEl = modal.querySelector('#rhythm-pattern-select');
    const compingSelectEl = null; // hidden comping UI
    const previewEl = modal.querySelector('#rhythm-pattern-preview');
    const gridEl = modal.querySelector('#rhythm-grid');
    const scopeRadios = modal.querySelectorAll('input[name="rhythm-scope"]');
    const customNameInput = modal.querySelector('#rhythm-custom-name');
    const infoBtn = modal.querySelector('#rhythm-info-btn');
    const infoPanel = modal.querySelector('#rhythm-info-panel');
    const customCountEl = modal.querySelector('#rhythm-custom-count');
    const customCountInlineEl = modal.querySelector('#rhythm-custom-count-inline');
    const customListEl = modal.querySelector('#rhythm-custom-list');
    const swingEl = modal.querySelector('#rhythm-swing');
    const humanizeEl = modal.querySelector('#rhythm-humanize');
    const kitEl = null; // kit hidden
    const previewBtn = modal.querySelector('#rhythm-preview-btn');
    const stopPreviewBtn = modal.querySelector('#rhythm-stop-preview-btn');
    const bassFollowToggle = modal.querySelector('#rhythm-bass-follow-toggle');

    const getTargetChordsDynamic = () => getTargetIndices(currentScope).map(i => progressionData[i]).filter(Boolean);

    const populatePatternOptions = () => {
        const patterns = buildPatterns();
        const customCount = getCustomPatternsForCount(getChordCount()).length;
        if (customCountEl) {
            customCountEl.textContent = customCount > 0 ? `${customCount} custom` : '';
        }
        if (customCountInlineEl) {
            customCountInlineEl.textContent = customCount > 0 ? `${customCount} custom` : 'No custom patterns';
        }
        const currentPattern = getCurrentPattern();

        // Sort patterns: ideal for time signature first, then compatible, then incompatible
        const sortedPatterns = [...patterns].sort((a, b) => {
            const suitA = getPatternTimeSignatureSuitability(a, timeSignature);
            const suitB = getPatternTimeSignatureSuitability(b, timeSignature);
            const order = { ideal: 0, compatible: 1, incompatible: 2 };
            return (order[suitA] || 1) - (order[suitB] || 1);
        });

        patternSelectEl.innerHTML = sortedPatterns.map(pattern => {
            const beatsDisplay = formatBeatsDisplay(pattern.beats);
            const isCurrent = currentPattern && currentPattern.id === pattern.id;
            const suitability = getPatternTimeSignatureSuitability(pattern, timeSignature);

            // Build prefix: ★ custom, • default, ✓ ideal for time sig, ~ compatible
            let prefix = '';
            if (pattern.isCustom) {
                prefix = '★ ';
            } else if (suitability === 'ideal') {
                prefix = '✓ ';
            } else if (suitability === 'incompatible') {
                prefix = '⚠ ';
            } else if (pattern.isDefault) {
                prefix = '• ';
            }

            return `
                <option value="${pattern.id}" ${isCurrent ? 'selected' : ''}>
                    ${prefix}${pattern.name} (${beatsDisplay})
                </option>
            `;
        }).join('');
    };

    const renderCustomList = () => {
        if (!customListEl) return;
        const customs = getCustomPatternsForCount(getChordCount());
        if (!customs.length) {
            customListEl.innerHTML = `<div class="text-gray-400 text-sm">No custom patterns for ${getChordCount()} chords.</div>`;
            return;
        }
        customListEl.innerHTML = customs.map(p => `
            <div class="flex items-center gap-2 p-2 bg-gray-900 rounded border border-gray-700">
                <div class="flex-1 min-w-0">
                    <div class="text-sm text-white truncate" title="${p.name}">${p.name}</div>
                    <div class="text-[11px] text-gray-400">${formatBeatsDisplay(p.beats)}</div>
                </div>
                <button class="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded load-custom-btn" data-id="${p.id}">Load</button>
                <button class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded delete-custom-btn" data-id="${p.id}">Delete</button>
            </div>
        `).join('');
    };

    const renderGrid = (beatsSource) => {
        const chords = getTargetChordsDynamic();
        gridEl.innerHTML = chords.map((chord, i) => {
            const beatVal = beatsSource && beatsSource[i] !== undefined ? beatsSource[i] : (chord.beats || 4);
            const label = chord.roman || chord.name || `Chord ${i + 1}`;
            return `
                <div class="flex items-center gap-2">
                    <div class="w-28 text-xs text-gray-300 truncate">${label}</div>
                    <input type="number" step="0.25" min="0.25" value="${beatVal}" data-beat-index="${i}"
                        class="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500" />
                </div>
            `;
        }).join('');
    };

    const updatePreview = () => {
        const patternId = patternSelectEl.value;
        const pattern = getAnyPatternById(patternId);
        const chords = getTargetChordsDynamic();
        if (pattern && previewEl) {
            const beatsDisplay = formatBeatsDisplay(pattern.beats);
            const suitability = getPatternTimeSignatureSuitability(pattern, timeSignature);

            // Build suitability badge
            let suitabilityBadge = '';
            if (suitability === 'ideal') {
                suitabilityBadge = `<span class="px-2 py-0.5 bg-green-600 bg-opacity-30 text-green-300 rounded text-xs">✓ Ideal for ${timeSignatureDisplay}</span>`;
            } else if (suitability === 'incompatible') {
                suitabilityBadge = `<span class="px-2 py-0.5 bg-red-600 bg-opacity-30 text-red-300 rounded text-xs">⚠ May not fit ${timeSignatureDisplay}</span>`;
            }

            previewEl.innerHTML = `
                <div class="text-xs text-gray-500 mb-2">Pattern Preview:</div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="text-white font-semibold">${pattern.name}</span>
                    ${suitabilityBadge}
                </div>
                <div class="text-sm text-gray-300 mb-2">${pattern.description || 'Custom pattern'}</div>
                <div class="flex flex-wrap gap-1 mb-2">
                    ${pattern.beats.map((beat, i) => `
                        <span class="px-2 py-1 bg-orange-600 bg-opacity-30 text-orange-300 rounded text-xs font-mono">
                            ${chords[i]?.roman || chords[i]?.name || '?'}: ${beat} beat${beat !== 1 ? 's' : ''}
                        </span>
                    `).join('')}
                </div>
            `;
            renderGrid(pattern.beats);
        } else {
            previewEl.innerHTML = `<div class="text-gray-400 text-sm">Select a pattern to preview.</div>`;
            renderGrid(getTargetChordsDynamic().map(c => c.beats || 4));
        }
    };

    populatePatternOptions();
    renderCustomList();
    updatePreview();

    const closeModal = () => modal.remove();

    // Event listeners
    modal.querySelector('#rhythm-modal-close-btn').addEventListener('click', closeModal);
    modal.querySelectorAll('#rhythm-modal-cancel-btn').forEach(btn => btn.addEventListener('click', closeModal));
    patternSelectEl.addEventListener('change', updatePreview);

    scopeRadios.forEach(r => {
        r.addEventListener('change', () => {
            currentScope = r.value === 'selection' && hasSelection ? 'selection' : 'all';
            populatePatternOptions();
            updatePreview();
        });
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    modal.querySelector('#rhythm-save-custom-btn').addEventListener('click', () => {
        const name = (customNameInput.value || '').trim();
        const chords = getTargetChordsDynamic();
        const inputs = Array.from(gridEl.querySelectorAll('input[data-beat-index]'));
        const beats = inputs.map(inp => Number(inp.value) || 1);
        if (!name) {
            if (window.showModal) window.showModal('Please name your custom pattern.', false);
            return;
        }
        if (beats.length !== chords.length) {
            if (window.showModal) window.showModal('Beat count must match chord count.', false);
            return;
        }
        const saved = saveCustomPattern({
            name,
            beats,
            chordCount: chords.length,
            description: `Custom (${formatBeatsDisplay(beats)})`
        });
        if (saved) {
            populatePatternOptions();
            patternSelectEl.value = saved.id;
            updatePreview();
            customNameInput.value = '';
            if (window.showModal) {
                window.showModal(`Saved "${saved.name}"`, false);
                setTimeout(() => window.hideModal && window.hideModal(), 1200);
            }
        }
    });

    modal.querySelectorAll('#rhythm-modal-apply-btn').forEach(btn => btn.addEventListener('click', () => {
        const chords = getTargetChordsDynamic();
        const inputs = Array.from(gridEl.querySelectorAll('input[data-beat-index]'));
        const beats = inputs.map(inp => Number(inp.value) || 1);
        if (beats.length !== chords.length) {
            if (window.showModal) window.showModal('Beat count must match chord count.', false);
            return;
        }
        const targetIndices = getTargetIndices(currentScope);
        const compBeats = beats;

        // Apply beats to target chords
        const updated = applyBeatsToProgression(progressionData, beats, targetIndices);
        if (!updated) {
            if (window.showModal) window.showModal('Pattern does not match the selected chords.', false);
            return;
        }

        // Write comping beats into chords as metadata
        if (compBeats) {
            targetIndices.forEach((idx, i) => {
                const chordIdx = targetIndices[i];
                if (updated[chordIdx]) {
                    updated[chordIdx].compBeats = compBeats[i % compBeats.length];
                }
            });
        }

        // Save state and commit
        saveStateBeforeChange();
        setProgressionData(updated);

        // Optional: trigger bass auto generation if user requested
        if (bassFollowToggle && bassFollowToggle.checked && window.syncProgressionToMelodyComposer) {
            window.syncProgressionToMelodyComposer();
        }
        renderProgressionDisplay('melody-progression-visualization', true);
        renderProgressionDisplay('melody-progression-visualization', false);
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        }

        // Show confirmation
        const pattern = getAnyPatternById(patternSelectEl.value);
        const patternName = pattern ? pattern.name : 'Custom beats';
        if (window.showModal) {
            window.showModal(`Applied "${patternName}"`, false);
            setTimeout(() => window.hideModal && window.hideModal(), 1500);
        }

        // Update builder panel
        if (window.updateBuilderProgressionPanel) {
            window.updateBuilderProgressionPanel();
        }
        closeModal();
    }));

    // Delete custom pattern
    modal.querySelector('#rhythm-delete-custom-btn')?.addEventListener('click', () => {
        const patternId = patternSelectEl.value;
        const pattern = getAnyPatternById(patternId);
        if (!pattern || !pattern.isCustom) {
            if (window.showModal) {
                window.showModal('Select a custom pattern to delete.', false);
                setTimeout(() => window.hideModal && window.hideModal(), 1200);
            }
            return;
        }
        deleteCustomPattern(patternId);
        populatePatternOptions();
        renderCustomList();
        updatePreview();
        if (window.showModal) {
            window.showModal(`Deleted "${pattern.name}"`, false);
            setTimeout(() => window.hideModal && window.hideModal(), 1200);
        }
    });

    // Custom list actions (load/delete)
    customListEl?.addEventListener('click', (e) => {
        const loadBtn = e.target.closest('.load-custom-btn');
        const delBtn = e.target.closest('.delete-custom-btn');
        if (loadBtn) {
            const id = loadBtn.getAttribute('data-id');
            patternSelectEl.value = id;
            updatePreview();
        } else if (delBtn) {
            const id = delBtn.getAttribute('data-id');
            const pattern = getAnyPatternById(id);
            deleteCustomPattern(id);
            populatePatternOptions();
            renderCustomList();
            if (pattern && window.showModal) {
                window.showModal(`Deleted "${pattern.name}"`, false);
                setTimeout(() => window.hideModal && window.hideModal(), 1200);
            }
        }
    });

    // Preview playback - piano chords only (no bass)
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            const chords = getTargetChordsDynamic().map(ch => ({
                ...ch,
                voicingNotes: ch.notes || []
            }));
            const inputs = Array.from(gridEl.querySelectorAll('input[data-beat-index]'));
            const beats = inputs.map(inp => Number(inp.value) || 1);
            const bpm = window.getCompositionState ? (window.getCompositionState()?.getTempo?.() || 100) : 100;

            setPreviewOptions({
                swing: 0,
                humanize: 0,
                loopLengthBars: 1,
                kit: 'acoustic'
            });

            // Play piano chords only - pass empty bassBeats to skip bass
            previewPattern({
                chords,
                bassBeats: [], // No bass
                compBeats: beats, // Piano chords use the rhythm pattern
                bpm,
                swing: 0,
                humanizeMs: 0
            });
        });
    }

    if (stopPreviewBtn) {
        stopPreviewBtn.addEventListener('click', () => {
            stopPreview();
            if (window.stopPreviewSynths) window.stopPreviewSynths();
        });
    }

    if (infoBtn && infoPanel) {
        infoBtn.addEventListener('click', () => {
            const isHidden = infoPanel.classList.contains('hidden');
            if (isHidden) {
                infoPanel.classList.remove('hidden');
            } else {
                infoPanel.classList.add('hidden');
            }
        });
    }

    // Manage Custom Patterns modal
    const manageCustomBtn = modal.querySelector('#rhythm-manage-custom-btn');
    const customManager = modal.querySelector('#rhythm-custom-manager');
    const customManagerClose = modal.querySelector('#rhythm-custom-manager-close');

    if (manageCustomBtn && customManager) {
        manageCustomBtn.addEventListener('click', () => {
            renderCustomList();
            customManager.classList.remove('hidden');
        });
    }

    if (customManagerClose && customManager) {
        customManagerClose.addEventListener('click', () => {
            customManager.classList.add('hidden');
        });

        // Close on backdrop click
        customManager.addEventListener('click', (e) => {
            if (e.target === customManager) {
                customManager.classList.add('hidden');
            }
        });
    }
}

/**
 * Apply a rhythm pattern to the current progression
 * @param {string} patternId - Pattern ID to apply
 */
export function applyRhythmPatternToProgression(patternId, options = {}) {
    const { targetIndices = null, customBeats = null } = options;
    const progressionData = getProgressionData();
    const pattern = customBeats ? null : getAnyPatternById(patternId);
    const beats = customBeats || (pattern ? pattern.beats : null);

    if (!beats || !Array.isArray(beats)) {
        console.warn('[applyRhythmPatternToProgression] No beats found for pattern:', patternId);
        return;
    }

    const updated = applyBeatsToProgression(progressionData, beats, targetIndices);

    if (!updated) {
        console.warn('[applyRhythmPatternToProgression] Failed to apply pattern:', patternId, 'target:', targetIndices);
        if (window.showModal) {
            window.showModal('Pattern does not match the selected chords. Beat count must equal target chord count.', false);
            setTimeout(() => window.hideModal && window.hideModal(), 1800);
        }
        return;
    }

    // Save state for undo BEFORE making changes
    saveStateBeforeChange();

    // Update state
    setProgressionData(updated);

    // Re-render displays
    renderProgressionDisplay('melody-progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

    // Sync to composition state for playback
    if (window.syncProgressionToMelodyComposer) {
        window.syncProgressionToMelodyComposer();
    }
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }

    // Show confirmation
    const patternName = pattern ? pattern.name : 'Custom beats';
    if (window.showModal) {
        window.showModal(`Applied "${patternName}"`, false);
        setTimeout(() => {
            if (window.hideModal) window.hideModal();
        }, 1500);
    }

    // Update builder panel
    if (window.updateBuilderProgressionPanel) {
        window.updateBuilderProgressionPanel();
    }
}

// ============================================================================
// PHASE 3.3: View Toggle Controls
// ============================================================================

// Track visibility state for analysis visualizations
let simplifiedViewVisible = true;
let tensionCurveVisible = true;

/**
 * Toggle simplified chord sequence view visibility
 */
export function toggleSimplifiedView() {
    simplifiedViewVisible = !simplifiedViewVisible;

    const container = document.getElementById('simplified-chord-sequence');
    const btn = document.getElementById('toggle-simplified-view-btn');

    if (container) {
        if (simplifiedViewVisible) {
            container.style.display = '';
            if (btn) {
                btn.classList.remove('opacity-50');
                btn.classList.add('bg-purple-100', 'hover:bg-purple-200', 'border-purple-300', 'text-purple-700');
                btn.classList.remove('bg-gray-200', 'border-gray-300', 'text-gray-500');
            }
        } else {
            container.style.display = 'none';
            if (btn) {
                btn.classList.add('opacity-50');
                btn.classList.remove('bg-purple-100', 'hover:bg-purple-200', 'border-purple-300', 'text-purple-700');
                btn.classList.add('bg-gray-200', 'border-gray-300', 'text-gray-500');
            }
        }
    }
}

/**
 * Toggle tension curve visualization visibility
 * Phase 3: Updated to support both old and new tension arc containers
 */
export function toggleTensionCurve() {
    tensionCurveVisible = !tensionCurveVisible;

    // Support both Phase 3 enhanced container and legacy container
    const container = document.getElementById('tension-arc-container') || document.getElementById('tension-curve-container');
    const btn = document.getElementById('toggle-tension-curve-btn');

    if (container) {
        if (tensionCurveVisible) {
            container.style.display = '';
            if (btn) {
                btn.classList.remove('opacity-50');
                btn.classList.add('bg-blue-100', 'hover:bg-blue-200', 'border-blue-300', 'text-blue-700');
                btn.classList.remove('bg-gray-200', 'border-gray-300', 'text-gray-500');
            }
        } else {
            container.style.display = 'none';
            if (btn) {
                btn.classList.add('opacity-50');
                btn.classList.remove('bg-blue-100', 'hover:bg-blue-200', 'border-blue-300', 'text-blue-700');
                btn.classList.add('bg-gray-200', 'border-gray-300', 'text-gray-500');
            }
        }
    }
}

/**
 * Get visibility state for analysis views
 * @returns {Object} Visibility state
 */
export function getAnalysisViewState() {
    return {
        simplifiedViewVisible,
        tensionCurveVisible
    };
}

// ============================================================================
// PHASE 3.4: Export tension curve and card highlighting functions to window
// ============================================================================

if (typeof window !== 'undefined') {
    window.highlightTensionPoint = highlightTensionPoint;
    window.unhighlightAllTensionPoints = unhighlightAllTensionPoints;
    window.highlightChordCard = highlightChordCard;
    window.unhighlightAllChordCards = unhighlightAllChordCards;
    window.expandChordCard = expandChordCard;
}
