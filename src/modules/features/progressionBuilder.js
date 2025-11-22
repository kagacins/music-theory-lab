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
    setSelectedChordIndex
} from '../state/trainerState.js';

import {
    getCurrentTab,
    getEnharmonicPreference,
    getNotationPreference
} from '../state/globalState.js';

// Import audio utilities
import {
    getPiano,
    getInstrument,
    getAudioIsReady,
    getAudioIsLoading,
    initAudio
} from '../audio/audioEngine.js';

// Track last step time to determine if we're in a stepping sequence
let lastStepTime = 0;

// Track whether we're currently playing a step chord (to prevent mouseleave from advancing when not playing)
let isStepPlaying = false;

// Track staff notation visibility state for each chord position
// This persists across key/progression changes
let staffNotationStates = new Map(); // Map<position, boolean>

// Track which chords are expanded in simplified view (Phase 3.3)
const expandedChords = new Set();

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

// Import chord suggestion modal
import { showChordSuggestionModal } from '../ui/chordSuggestionModal.js';

// Import template browser modal (Phase 3.1)
import { showTemplateBrowser } from '../ui/templateBrowserModal.js';

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
 * PHASE 3.3: Color-coded harmonic analysis
 * @param {string} roman - Roman numeral
 * @returns {object} Object with romanColor and functionColor CSS classes
 */
function getFunctionColors(roman) {
    const func = getChordFunction(roman);

    const colorMap = {
        'Tonic': {
            romanColor: 'text-blue-600 dark:text-blue-400',
            functionColor: 'text-blue-500 dark:text-blue-400',
            bgColor: 'bg-blue-100 dark:bg-blue-900',
            borderColor: 'border-blue-300 dark:border-blue-700'
        },
        'Dominant': {
            romanColor: 'text-red-600 dark:text-red-400',
            functionColor: 'text-red-500 dark:text-red-400',
            bgColor: 'bg-red-100 dark:bg-red-900',
            borderColor: 'border-red-300 dark:border-red-700'
        },
        'Subdominant': {
            romanColor: 'text-green-600 dark:text-green-400',
            functionColor: 'text-green-500 dark:text-green-400',
            bgColor: 'bg-green-100 dark:bg-green-900',
            borderColor: 'border-green-300 dark:border-green-700'
        }
    };

    return colorMap[func] || {
        romanColor: 'text-indigo-700 dark:text-indigo-300',
        functionColor: 'text-indigo-500 dark:text-indigo-400',
        bgColor: 'bg-indigo-100 dark:bg-indigo-900',
        borderColor: 'border-indigo-300 dark:border-indigo-700'
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
 * Works with both Progression Builder and Melody Composer tabs
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

            // Calculate dimensions and set width immediately
            const dimensions = calculateCanvasDimensions(key, chord.notes);
            card.style.minHeight = `${dimensions.height + 20}px`;
            card.style.minWidth = `${dimensions.width + 20}px`;
            notationView.style.minHeight = `${dimensions.height + 20}px`;
            notationView.style.minWidth = `${dimensions.width + 20}px`;
            wrapper.style.minWidth = `${dimensions.width + 40}px`; // Set wrapper width

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

    // Update Melody Composer toggle checkbox
    const melodyToggle = document.getElementById('melody-view-toggle');
    if (melodyToggle) {
        melodyToggle.checked = showStaff;
    }
}

/**
 * Capture current staff notation visibility states before re-rendering
 * Checks both Progression Builder and Melody Composer tabs
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
 * Restores to both Progression Builder and Melody Composer tabs
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
        console.log(`Minor key ${key} -> relative major ${relativeMajor} -> key signature:`, keySig);
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
            console.error('VexFlow library not loaded');
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
            console.error('Missing VexFlow classes');
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
            console.warn(`VexFlow key signature error for ${key} (tried ${vexFlowKey}):`, e);
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
        console.error('Error rendering chord notation:', e);
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
            console.error('VexFlow library not loaded. Available window keys:',
                Object.keys(window).filter(k => k.toLowerCase().includes('vex')));
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
            console.error('Missing VexFlow classes');
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
            chord.lhOctaveShift || -12,
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
                console.warn('Error calculating MIDI for note:', note, e);
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
                console.warn(`VexFlow key signature error for ${currentKey} (tried ${vexFlowKey}):`, e);
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
                    console.warn('Error drawing treble ottava bracket:', e);
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
                console.warn(`VexFlow key signature error for ${currentKey} (tried ${vexFlowKey}):`, e);
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
                    console.warn('Error drawing bass ottava bracket:', e);
                }
            }
        }
    } catch (error) {
        console.error('Error rendering staff notation:', error);
        console.error('Error stack:', error.stack);
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
 * Wrapper function that accepts chord data directly (for Melody Composer)
 * @param {HTMLCanvasElement} canvas - Canvas element to render on
 * @param {Object} chordData - Chord data object with notes, lhType, etc.
 * @param {string} key - Current key (e.g., "C", "Dm")
 */
export function renderChordStaffNotation(canvas, chordData, key) {
    console.log('renderChordStaffNotation called with chordData:', chordData, 'key:', key);
    try {
        // VexFlow 5.x browser build exposes VexFlow namespace
        if (typeof VexFlow === 'undefined') {
            console.error('VexFlow library not loaded');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '14px Arial';
            ctx.fillText('VexFlow not loaded', 10, 30);
            return;
        }

        const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } = VexFlow;

        if (!Renderer || !Stave || !StaveNote || !Voice || !Formatter || !Accidental) {
            console.error('Missing VexFlow classes');
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
                chordData.lhOctaveShift || -12,
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
                console.warn('VexFlow key signature error:', e);
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
                console.warn('VexFlow key signature error:', e);
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
        console.error('Error rendering staff notation:', error);
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

            console.log('Highlighting positions:', positions, 'for pattern:', name);
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

    console.log('Found chord cards:', chordCards.length, 'Highlighting positions:', positions);

    positions.forEach(pos => {
        // Find card by data-chord-index attribute
        const card = document.querySelector(`.chord-card-wrapper[data-chord-index="${pos}"]`);

        if (card) {
            card.classList.add('pattern-highlight');
            // Apply styles directly to ensure they work
            card.style.setProperty('box-shadow', '0 0 15px rgba(168, 85, 247, 0.6)', 'important');
            card.style.setProperty('border-color', '#a855f7', 'important');
            card.style.setProperty('border-width', '2px', 'important');
            console.log('Highlighted card at position:', pos);
        } else {
            console.log('Could not find card at position:', pos);
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

    // Render cards directly into the grid container (like Melody Composer)
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
                // Also set wrapper width so it takes up space in grid
                // Use extra padding for expanded cards to prevent overlap
                wrapper.style.minWidth = `${dimensions.width + 80}px`;

                // Force layout by reading dimensions
                wrapper.getBoundingClientRect();

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
    `;

    // Create card element
    const cardContainer = document.createElement('div');
    cardContainer.innerHTML = createSimplifiedCardHTML(chord, index, key);
    const cardElement = cardContainer.querySelector('.simplified-card');

    // Create tooltip wrapper for the card
    const cardWrapper = document.createElement('div');
    cardWrapper.className = 'relative'; // Position relative for tooltip positioning
    cardWrapper.style.position = 'relative';

    // Add card to wrapper
    if (cardElement) {
        cardWrapper.appendChild(cardElement);
    }

    // Create and add tooltip outside the card but inside the wrapper
    const tooltipElement = createTooltipElement(chord, index, key);
    if (tooltipElement) {
        cardWrapper.appendChild(tooltipElement);
    }

    fragment.appendChild(controlBar);
    fragment.appendChild(cardWrapper);

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

    const tooltip = document.createElement('div');
    tooltip.className = 'chord-tooltip hidden absolute z-50 bg-gray-800 border-2 border-indigo-500 rounded-lg shadow-xl p-4 pointer-events-auto';
    tooltip.style.cssText = 'bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 8px; min-width: 250px; max-width: 350px;';
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
        <!-- Tooltip arrow -->
        <div class="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-indigo-500"></div>
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
        else if (chord.type === 'Suspended 4th') chordSymbol += 'sus4';
        else if (chord.type === 'Suspended 2nd') chordSymbol += 'sus2';
        else if (chord.type === 'Add9') chordSymbol += 'add9';
        else if (chord.type === 'Major 6th') chordSymbol += '6';
        else if (chord.type === 'Minor 6th') chordSymbol += 'm6';
    }

    let inversionText = '';
    if (chord.inversion === 1) { inversionText = '¹'; }
    else if (chord.inversion === 2) { inversionText = '²'; }
    else if (chord.inversion === 3) { inversionText = '³'; }

    return `
        <div class="simplified-card bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-gray-700 rounded-xl overflow-hidden hover:border-indigo-500 transition-all shadow-lg relative" style="min-height: 80px;">
            <!-- Inversion indicator (top-left corner) -->
            ${inversionText ? `<div class="absolute top-1 left-1 text-xl text-red-400 font-bold">${inversionText}</div>` : ''}

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

    // LH: Generate notes based on pattern
    // Ensure lhType has a default value
    if (!chord.lhType) {
        chord.lhType = 'rootOnly';
    }

    // Generate LH notes if missing and lhType is not 'off'
    if (chord.lhType !== 'off' && (!chord.lhNotes || chord.lhNotes.length === 0)) {
        const rhOctaveShift = chord.octaveShift || 0;
        const lhRelativeShift = chord.lhOctaveShift || -12;
        const absoluteLHOctaveShift = rhOctaveShift + lhRelativeShift;
        const lhInversion = chord.lhInversion || 0;
        chord.lhNotes = getLHNotes(
            chord.root,
            chord.lhType,
            lhInversion,
            key,
            absoluteLHOctaveShift,
            chord.type,
            getEnharmonicPreference()
        );
    }

    const lhNotes = chord.lhNotes || [];
    const lhOctaveShift = chord.lhOctaveShift || -12;
    const lhInversion = chord.lhInversion || 0;
    const lhNoteCheckboxes = lhNotes.map(note => {
        const isChecked = !(chord.lhOmittedNotes || []).includes(note);
        const noteWithoutOctave = note.replace(/\d+$/, '');
        const isInScale = scaleNotes.includes(noteWithoutOctave);

        return `
            <label class="flex items-center gap-0.5 cursor-pointer text-gray-700 text-[10px] ${isInScale ? 'font-semibold' : ''}">
                <input type="checkbox" value="${note}" ${isChecked ? 'checked' : ''}
                    class="lh-note-checkbox w-2.5 h-2.5 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500">
                <span class="${isInScale ? 'text-green-700' : ''}">${note}</span>
                ${isInScale ? '<span class="text-[8px] text-green-600">●</span>' : ''}
            </label>
        `;
    }).join('');

    // LH Inversion buttons
    const lhInversionButtons = [];
    for (let inv = 0; inv <= maxInversion; inv++) {
        const isActive = inv === lhInversion;
        const label = inv === 0 ? 'R' : inv.toString();
        lhInversionButtons.push(`
            <button class="lh-inversion-btn w-8 px-0.5 py-0.5 text-[9px] font-semibold rounded transition-colors ${
                isActive ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }" data-inversion="${inv}">${label}</button>
        `);
    }

    // LH Pattern options - matching Melody Composer
    const lhPatterns = [
        { value: 'off', label: 'Off' },
        { value: 'rootOnly', label: 'Root Only' },
        { value: 'rootAnd5th', label: 'Root + 5th' },
        { value: 'powerChord', label: 'Power Chord' },
        { value: 'Major', label: 'Major Triad' },
        { value: 'Minor', label: 'Minor Triad' },
        { value: 'shell_maj7', label: 'Shell (R-3-7)' },
        { value: 'shell_min7', label: 'Minor 7th Shell (R-b3-b7)' },
        { value: 'shell_dom7', label: 'Dominant 7th Shell (R-3-b7)' },
        { value: 'spread', label: 'Spread Triad (R-5-10)' },
        { value: 'quartal', label: 'Quartal (R-4-7)' },
        { value: 'Dominant 7th', label: 'Dominant 7th' }
    ];
    const lhOptions = lhPatterns.map(p =>
        `<option value="${p.value}" ${(chord.lhType || 'rootOnly') === p.value ? 'selected' : ''}>${p.label}</option>`
    ).join('');

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
                <!-- Chord Type -->
                <div>
                    <label class="block text-[10px] font-semibold text-gray-700 mb-0.5">Chord Type</label>
                    <select class="type-select w-full px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px]">
                        ${getChordTypeOptions(chord.type)}
                    </select>
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

                <!-- LH SECTION -->
                <div class="border-2 border-green-200 rounded p-1 bg-green-50">
                    <div class="text-[10px] font-bold text-green-700 mb-0.5">LEFT HAND (Bass)</div>

                    <!-- LH Pattern -->
                    <div class="mb-0.5">
                        <label class="block text-[9px] font-semibold text-gray-700 mb-0.5">Pattern</label>
                        <select class="lh-pattern-select w-full px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px]">
                            ${lhOptions}
                        </select>
                    </div>

                    <!-- LH Octave Shift (Relative to RH) -->
                    <div class="mb-0.5">
                        <label class="block text-[9px] font-semibold text-gray-700 mb-0.5">Octave (from RH)</label>
                        <select class="lh-octave-select w-full px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px]">
                            <option value="-36" ${lhOctaveShift === -36 ? 'selected' : ''}>-3 octaves</option>
                            <option value="-24" ${lhOctaveShift === -24 ? 'selected' : ''}>-2 octaves</option>
                            <option value="-12" ${lhOctaveShift === -12 ? 'selected' : ''}>-1 octave (default)</option>
                            <option value="0" ${lhOctaveShift === 0 ? 'selected' : ''}>Same as RH</option>
                            <option value="12" ${lhOctaveShift === 12 ? 'selected' : ''}>+1 octave</option>
                            <option value="24" ${lhOctaveShift === 24 ? 'selected' : ''}>+2 octaves</option>
                            <option value="36" ${lhOctaveShift === 36 ? 'selected' : ''}>+3 octaves</option>
                        </select>
                    </div>

                    <!-- LH Inversion -->
                    <div class="mb-0.5">
                        <label class="block text-[9px] font-semibold text-gray-700 mb-0.5">Inversion</label>
                        <div class="flex gap-0.5">
                            ${lhInversionButtons.join('')}
                        </div>
                    </div>

                    <!-- LH Notes/Voicing -->
                    ${lhNotes.length > 0 ? `
                    <div class="border border-gray-300 rounded p-1 bg-white">
                        <div class="flex items-center justify-between mb-0.5">
                            <label class="text-[9px] font-semibold text-green-600">Notes</label>
                            <div class="flex gap-0.5">
                                <button class="lh-notes-all-btn px-1.5 py-0.5 text-[9px] font-semibold bg-green-500 hover:bg-green-600 text-white rounded">All</button>
                                <button class="lh-notes-none-btn px-1.5 py-0.5 text-[9px] font-semibold bg-gray-500 hover:bg-gray-600 text-white rounded">None</button>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-x-2 gap-y-0.5">
                            ${lhNoteCheckboxes}
                        </div>
                    </div>
                    ` : '<div class="text-[9px] text-gray-500 italic">No LH notes (pattern is Off)</div>'}
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
    const typeSelect = wrapper.querySelector('.type-select');
    const lhPatternSelect = wrapper.querySelector('.lh-pattern-select');
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

    // Expand button
    if (expandBtn) {
        expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Preserve transform before expanding
            const currentShift = wrapper.style.getPropertyValue('--card-shift') || '';
            const currentTransform = wrapper.style.transform || '';
            const hadShiftClass = wrapper.classList.contains('shift-right');
            
            expandChordCard(index);
            
            // Restore transform immediately after expansion
            if (currentShift) {
                requestAnimationFrame(() => {
                    wrapper.style.setProperty('--card-shift', currentShift);
                    wrapper.style.transform = currentTransform || `translateX(${currentShift})`;
                    if (hadShiftClass) {
                        wrapper.classList.add('shift-right');
                    }
                    updateCardShifts();
                });
            }
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
        // Helper function to preserve transform when button is clicked
        const preserveTransform = () => {
            const currentShift = wrapper.style.getPropertyValue('--card-shift') || '';
            const currentTransform = wrapper.style.transform || '';
            const hadShiftClass = wrapper.classList.contains('shift-right');
            
            if (currentShift) {
                wrapper.style.setProperty('--card-shift', currentShift);
                wrapper.style.transform = currentTransform || `translateX(${currentShift})`;
                if (hadShiftClass) {
                    wrapper.classList.add('shift-right');
                }
            } else if (currentTransform) {
                wrapper.style.transform = currentTransform;
                if (hadShiftClass) {
                    wrapper.classList.add('shift-right');
                }
            }
        };
        
        playBtn.addEventListener('mousedown', () => {
            // Preserve transform before any operations
            preserveTransform();

            // Select this card (persistent purple ring)
            selectChordCard(index);

            if (window.startProgressionChord) {
                window.startProgressionChord(index);
                // Highlight corresponding tension curve point and chord card
                highlightTensionPoint(index);
                highlightChordCard(index);
            }

            // Ensure transform is maintained after highlighting
            requestAnimationFrame(() => {
                preserveTransform();
            });
        });
        playBtn.addEventListener('mouseup', () => {
            // Preserve transform
            preserveTransform();

            if (window.stopTrainerChord) window.stopTrainerChord();
            // Remove playback highlighting but keep selection (purple ring persists)
            unhighlightAllTensionPoints();
            unhighlightAllChordCards();

            // Ensure transform is maintained
            requestAnimationFrame(() => {
                preserveTransform();
            });
        });
        playBtn.addEventListener('mouseleave', () => {
            // Preserve transform
            preserveTransform();

            if (window.stopTrainerChord) window.stopTrainerChord();
            // Remove playback highlighting but keep selection (purple ring persists)
            unhighlightAllTensionPoints();
            unhighlightAllChordCards();

            // Ensure transform is maintained
            requestAnimationFrame(() => {
                preserveTransform();
            });
        });
        
        // Also handle touch events
        playBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            preserveTransform();

            // Select this card (persistent purple ring)
            selectChordCard(index);

            if (window.startProgressionChord) {
                window.startProgressionChord(index);
                highlightTensionPoint(index);
                highlightChordCard(index);
            }

            requestAnimationFrame(() => {
                preserveTransform();
            });
        }, { passive: false });

        playBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            preserveTransform();

            if (window.stopTrainerChord) window.stopTrainerChord();
            // Remove playback highlighting but keep selection (purple ring persists)
            unhighlightAllTensionPoints();
            unhighlightAllChordCards();

            requestAnimationFrame(() => {
                preserveTransform();
            });
        }, { passive: false });
    }

    // Delete button
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            // Preserve transform before deletion (though card will be removed anyway)
            const currentShift = wrapper.style.getPropertyValue('--card-shift') || '';
            const currentTransform = wrapper.style.transform || '';
            const hadShiftClass = wrapper.classList.contains('shift-right');
            
            if (window.removeChordFromProgression) {
                window.removeChordFromProgression(index);
            }
            
            // After deletion, update shifts for remaining cards
            requestAnimationFrame(() => {
                updateCardShifts();
            });
        });
    }

    // Add click handler to simplified and detailed cards
    // Clicking anywhere on the card (except buttons) selects it WITHOUT playing
    const clickableCards = wrapper.querySelectorAll('.simplified-card, .detailed-card');
    clickableCards.forEach(card => {
        card.addEventListener('click', (e) => {
            // Don't interfere with button clicks, inputs, or selects - they have their own handlers
            if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;

            // Preserve the current shift immediately to prevent visual flash
            const currentShift = wrapper.style.getPropertyValue('--card-shift') || '';
            const currentTransform = wrapper.style.transform || '';
            const hadShiftClass = wrapper.classList.contains('shift-right');

            // Select this card (persistent purple ring) - NO playback, only selection
            selectChordCard(index);

            // Restore shift immediately using CSS custom property (persists even if inline style is reset)
            if (currentShift) {
                wrapper.style.setProperty('--card-shift', currentShift);
                wrapper.style.transform = currentTransform || `translateX(${currentShift})`;
                if (hadShiftClass) {
                    wrapper.classList.add('shift-right');
                }
            } else if (currentTransform) {
                wrapper.style.transform = currentTransform;
                if (hadShiftClass) {
                    wrapper.classList.add('shift-right');
                }
            }

            // Then recalculate shifts properly after any potential updates
            requestAnimationFrame(() => {
                updateCardShifts();
            });
        });
    });

    // Chord type select
    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            updateChordType(index, e.target.value);
        });
    }

    // LH pattern select
    if (lhPatternSelect) {
        lhPatternSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            updateChordLHPattern(index, e.target.value);
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
            if (wasPressed && window.syncNotationFromProgression) {
                window.syncNotationFromProgression();
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
            const trainerState = getTrainerState();
            const chord = trainerState.progressionData[index];
            if (chord) {
                chord.omittedNotes = [];
                // Update checkboxes
                noteCheckboxes.forEach(cb => cb.checked = true);

                // Sync progressionData changes to notation display
                if (window.syncNotationFromProgression) {
                    window.syncNotationFromProgression();
                }

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
            const trainerState = getTrainerState();
            const chord = trainerState.progressionData[index];
            if (chord && chord.notes) {
                chord.omittedNotes = [...chord.notes];
                // Update checkboxes
                noteCheckboxes.forEach(cb => cb.checked = false);

                // Sync progressionData changes to notation display
                if (window.syncNotationFromProgression) {
                    window.syncNotationFromProgression();
                }
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

    // LH Octave shift dropdown
    const lhOctaveSelect = wrapper.querySelector('.lh-octave-select');
    if (lhOctaveSelect) {
        lhOctaveSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            const shift = parseInt(e.target.value);
            updateLHOctaveShift(index, shift);
        });
    }

    // LH Inversion buttons
    const lhInversionBtns = wrapper.querySelectorAll('.lh-inversion-btn');
    lhInversionBtns.forEach(btn => {
        let wasPressed = false;

        btn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            wasPressed = true;
            const inversion = parseInt(btn.getAttribute('data-inversion'));

            // Update WITHOUT syncing notation (to prevent flash)
            updateLHInversion(index, inversion, true, false);

            // Start playing the chord with the new LH inversion
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
            if (wasPressed && window.syncNotationFromProgression) {
                window.syncNotationFromProgression();
            }

            wasPressed = false;
        });
    });

    // LH Note checkboxes
    const lhNoteCheckboxes = wrapper.querySelectorAll('.lh-note-checkbox');
    lhNoteCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            const note = checkbox.value;
            toggleLHNote(index, note);

            // Update the card to reflect the change
            updateSingleCard(index);
        });
    });

    // LH All/None buttons
    const lhAllBtn = wrapper.querySelector('.lh-notes-all-btn');
    const lhNoneBtn = wrapper.querySelector('.lh-notes-none-btn');

    if (lhAllBtn) {
        lhAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const trainerState = getTrainerState();
            const chord = trainerState.progressionData[index];
            if (chord) {
                chord.lhOmittedNotes = [];
                // Update checkboxes
                lhNoteCheckboxes.forEach(cb => cb.checked = true);
                // Play the chord
                if (window.startProgressionChord && window.stopTrainerChord) {
                    window.startProgressionChord(index);
                    setTimeout(() => window.stopTrainerChord(), 500);
                }
            }
        });
    }

    if (lhNoneBtn) {
        lhNoneBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const trainerState = getTrainerState();
            const chord = trainerState.progressionData[index];
            if (chord && chord.lhNotes) {
                chord.lhOmittedNotes = [...chord.lhNotes];
                // Update checkboxes
                lhNoteCheckboxes.forEach(cb => cb.checked = false);
            }
        });
    }

    // Staff Notation Toggle button
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
    const chordTooltip = wrapper.querySelector('.chord-tooltip');
    const infoTooltipBtn = wrapper.querySelector('.info-tooltip-btn');
    const tooltipInversionBtns = wrapper.querySelectorAll('.tooltip-inversion-btn');

    // Get the card wrapper (parent of simplified-card) for hover events
    const cardWrapper = simplifiedCard ? simplifiedCard.parentElement : null;

    if (simplifiedCard && chordTooltip && cardWrapper) {
        let tooltipTimeout = null;
        let isTooltipPinned = false;
        let hideTimeout = null;
        let inversionWasChanged = false; // Track if inversion was changed during this tooltip session

        const showTooltip = () => {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            // Reset the change flag when tooltip opens
            inversionWasChanged = false;
            chordTooltip.classList.remove('hidden');
        };

        const hideTooltip = () => {
            if (!isTooltipPinned) {
                // Longer delay before hiding to allow mouse to move to tooltip
                hideTimeout = setTimeout(() => {
                    chordTooltip.classList.add('hidden');
                    // Update the card UI after tooltip closes to show any inversion changes
                    updateSingleCard(index);
                    updateTensionCurveIfVisible();

                    // Sync notation ONLY if inversion was actually changed
                    if (inversionWasChanged && window.syncNotationFromProgression) {
                        // Use requestAnimationFrame to ensure UI updates complete first
                        requestAnimationFrame(() => {
                            window.syncNotationFromProgression();
                        });
                    }

                    // Reset the flag for next time
                    inversionWasChanged = false;
                }, 500);
            }
        };

        // Show tooltip on hover (desktop) - use cardWrapper since tooltip is sibling to card
        cardWrapper.addEventListener('mouseenter', () => {
            if (!isTooltipPinned) {
                tooltipTimeout = setTimeout(() => {
                    showTooltip();
                }, 300); // Small delay for hover
            }
        });

        // Hide tooltip when mouse leaves cardWrapper (if not pinned)
        cardWrapper.addEventListener('mouseleave', (e) => {
            if (tooltipTimeout) {
                clearTimeout(tooltipTimeout);
                tooltipTimeout = null;
            }
            // Only hide if not moving to the tooltip
            if (!chordTooltip.contains(e.relatedTarget)) {
                hideTooltip();
            }
        });

        // Keep tooltip open when mouse enters tooltip
        chordTooltip.addEventListener('mouseenter', () => {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
        });

        // Hide tooltip when mouse leaves tooltip (if not pinned)
        chordTooltip.addEventListener('mouseleave', () => {
            hideTooltip();
        });

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
                if (inversionWasChanged && window.syncNotationFromProgression) {
                    requestAnimationFrame(() => {
                        window.syncNotationFromProgression();
                    });
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
                    if (inversionWasChanged && window.syncNotationFromProgression) {
                        requestAnimationFrame(() => {
                            window.syncNotationFromProgression();
                        });
                    }

                    // Reset the flag
                    inversionWasChanged = false;
                } else {
                    chordTooltip.classList.remove('hidden');
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

                // Sync notation immediately
                if (inversionWasChanged) {
                    updateChordAndRenderPreservingTrebleNotes(index);
                    inversionWasChanged = false;
                }

                wasPressed = false;
            });

            // Mouseleave - stop playing if user drags off button and sync notation
            btn.addEventListener('mouseleave', (e) => {
                if (window.stopTrainerChord) {
                    window.stopTrainerChord();
                }

                // Sync notation if button was pressed and user dragged off
                if (wasPressed && inversionWasChanged) {
                    updateChordAndRenderPreservingTrebleNotes(index);
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

                // Also update the Melody Composer's notation
                updateChordAndRenderPreservingTrebleNotes(index);
            }
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
    // Update shifts for both containers
    const containers = [
        document.getElementById('progression-visualization'),
        document.getElementById('melody-progression-visualization')
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
            const allWrappers = Array.from(container.querySelectorAll('.chord-card-wrapper[data-chord-index]'));

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

            // Calculate accumulated shift for each card based on actual card widths
            // Any card wider than baseline causes subsequent cards to shift
            allWrappers.forEach((wrapper, idx) => {
                let accumulatedShift = 0;

                // Check each previous card to see if it's wider than baseline
                for (let i = 0; i < idx; i++) {
                    const prevWrapper = allWrappers[i];
                    const prevWidth = prevWrapper.offsetWidth;

                    // If previous card is wider than baseline, shift this card
                    if (prevWidth > baselineWidth + 10) { // 10px tolerance
                        const extraWidth = prevWidth - baselineWidth;
                        const shiftAmount = extraWidth + 10;
                        accumulatedShift += shiftAmount; // Full extra width + 10px gap
                    }
                }

                // Apply shift if needed using CSS custom property to persist transform
                // This prevents flash when inline styles are reset
                if (accumulatedShift > 0) {
                    wrapper.classList.add('shift-right');
                    // Set CSS custom property which persists even if inline style is reset
                    wrapper.style.setProperty('--card-shift', `${accumulatedShift}px`);
                    // Also set inline transform as backup
                    wrapper.style.transform = `translateX(${accumulatedShift}px)`;
                } else {
                    wrapper.classList.remove('shift-right');
                    // Clear CSS custom property
                    wrapper.style.removeProperty('--card-shift');
                    wrapper.style.transform = '';
                }
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
                // Also set wrapper width so it takes up space in grid
                // Use extra padding for expanded cards to prevent overlap
                wrapper.style.minWidth = `${dimensions.width + 80}px`;

                // Force layout by reading dimensions
                wrapper.getBoundingClientRect();

                // Update card shifts after layout is applied
                requestAnimationFrame(() => {
                    updateCardShifts();
                });
            }
        });

        // Force layout by reading dimensions
        wrapper.getBoundingClientRect();
    });

    // Update shifts for all cards after layout is applied
    // (will be called again after notation renders and sets minWidth)
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
        { label: 'Triads', types: ['Major', 'Minor', 'Diminished', 'Augmented', 'Suspended 2nd', 'Suspended 4th', 'Power Chord'] },
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

    // Preserve the current shift before updating to prevent visual flash
    const currentShift = wrapper.style.getPropertyValue('--card-shift') || '';
    const currentTransform = wrapper.style.transform || '';
    const hadShiftClass = wrapper.classList.contains('shift-right');

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
                // Also set wrapper width so it takes up space in grid
                // Use extra padding for expanded cards to prevent overlap
                wrapper.style.minWidth = `${dimensions.width + 80}px`;

                // Force layout by reading dimensions
                wrapper.getBoundingClientRect();

                // Update card shifts after layout is applied
                requestAnimationFrame(() => {
                    updateCardShifts();
                });
            }
        });
    } else {
        wrapper.innerHTML = '';
        const simplifiedStructure = createSimplifiedCardStructure(chord, index, key);
        wrapper.appendChild(simplifiedStructure);
        // Ensure expanded class is removed
        wrapper.classList.remove('expanded-card-wrapper');
    }

    // Immediately restore the shift using CSS custom property (persists even if inline style is reset)
    if (currentShift) {
        wrapper.style.setProperty('--card-shift', currentShift);
        wrapper.style.transform = currentTransform || `translateX(${currentShift})`;
        if (hadShiftClass) {
            wrapper.classList.add('shift-right');
        }
    } else if (currentTransform) {
        // Fallback to inline transform if custom property wasn't set
        wrapper.style.transform = currentTransform;
        if (hadShiftClass) {
            wrapper.classList.add('shift-right');
        }
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

    // Recalculate and update shifts properly after DOM is ready
    // This ensures all cards have correct shifts, but we've already prevented the flash
    requestAnimationFrame(() => {
        updateCardShifts();
    });
}

/**
 * Helper: Update tension curve if visible
 */
function updateTensionCurveIfVisible() {
    const tensionContainer = document.getElementById('tension-curve-container');
    if (tensionContainer && tensionContainer.style.display !== 'none') {
        const trainerState = getTrainerState();
        const panel = document.getElementById('progression-visualization')?.parentElement;
        if (panel) {
            // Remove old tension curve
            const oldTension = panel.querySelector('#tension-curve-container');
            if (oldTension) oldTension.remove();

            // Re-render tension curve with updated data
            renderTensionCurve(panel, trainerState.progressionData, trainerState.currentKey || 'C');

            // Reposition Quick Analysis Bar above tension curve
            const quickAnalysisBar = panel?.querySelector('#quick-analysis-bar-container');
            const tensionCurve = panel?.querySelector('#tension-curve-container');
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
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    chord.type = newType;

    // Regenerate chord notes with new type
    const chordInfo = getProgressionChordNotes(
        chord.key || trainerState.currentKey,
        chord.roman,
        newType,
        chord.inversion
    );

    if (chordInfo) {
        chord.notes = chordInfo.notes;
        chord.lhNotes = chordInfo.lhNotes;
        chord.name = chordInfo.name;
        chord.simpleName = chordInfo.simpleName;

        // Reapply octave shift if it was previously set
        if (chord.octaveShift && chord.octaveShift !== 0) {
            chord.notes = chord.notes.map(note => {
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
    }

    // Save state
    saveState({ type: 'chord-update', data: { index, property: 'type', value: newType } });

    // Update only this card and tension curve (type changes affect tension)
    updateSingleCard(index);
    updateTensionCurveIfVisible();

    // Update the grand staff notation
    requestAnimationFrame(() => {
        // Sync progressionData changes to notation display
        if (window.syncNotationFromProgression) {
            
            window.syncNotationFromProgression();
        }
    });

    // Play the chord with the new type
    const voicedNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
    const rhOctaveShift = chord.octaveShift || 0;
    const lhRelativeShift = chord.lhOctaveShift || -12;
    const absoluteLHOctaveShift = rhOctaveShift + lhRelativeShift;
    const lhNotes = getLHNotes(
        chord.root,
        chord.lhType,
        chord.lhInversion,
        trainerState.currentKey,
        absoluteLHOctaveShift,
        chord.type,
        getEnharmonicPreference()
    ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
    const allNotes = voicedNotes.concat(lhNotes);
    if (allNotes.length > 0) {
        playTrainerChordOnce(allNotes);
    }
}

/**
 * Update chord inversion from simplified view
 */
function updateChordInversion(index, newInversion, shouldUpdateUI = true, shouldSyncNotation = true) {
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    chord.inversion = newInversion;

    // Regenerate chord notes with new inversion
    const chordInfo = getProgressionChordNotes(
        chord.key || trainerState.currentKey,
        chord.roman,
        chord.type,
        newInversion
    );

    if (chordInfo) {
        chord.notes = chordInfo.notes;
        chord.lhNotes = chordInfo.lhNotes;

        // Clear omittedNotes since note names change with inversion (e.g., C4 becomes C5)
        // This ensures all notes are played and checkboxes show correct state
        chord.omittedNotes = [];

        // Reapply octave shift if it was previously set
        if (chord.octaveShift && chord.octaveShift !== 0) {
            chord.notes = chord.notes.map(note => {
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
    }

    // Save state
    saveState({ type: 'chord-update', data: { index, property: 'inversion', value: newInversion } });

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
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    chord.voicing = newVoicing;

    // Save state
    saveState({ type: 'chord-update', data: { index, property: 'voicing', value: newVoicing } });

    // Update only this card (voicing doesn't affect tension curve)
    updateSingleCard(index);
}

/**
 * Update chord LH pattern from simplified view
 */
function updateChordLHPattern(index, newLHPattern) {
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    chord.lhType = newLHPattern;

    // Regenerate LH notes with new pattern (using relative LH octave shift)
    const rhOctaveShift = chord.octaveShift || 0;
    const lhRelativeShift = chord.lhOctaveShift || -12;
    const absoluteLHOctaveShift = rhOctaveShift + lhRelativeShift;
    chord.lhNotes = getLHNotes(
        chord.root,
        newLHPattern,
        chord.lhInversion || 0,
        trainerState.currentKey,
        absoluteLHOctaveShift,
        chord.type,
        getEnharmonicPreference()
    );

    // Save state
    saveState({ type: 'chord-update', data: { index, property: 'lhType', value: newLHPattern } });

    // Update only this card (LH pattern doesn't affect tension curve)
    updateSingleCard(index);

    // Also update the grand staff notation
    requestAnimationFrame(() => {
        // Sync progressionData changes to notation display
        if (window.syncNotationFromProgression) {
            
            window.syncNotationFromProgression();
        }
    });

    // Play the chord with the new LH pattern
    const voicedNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
    const lhNotes = (chord.lhNotes || []).filter(n => !(chord.lhOmittedNotes || []).includes(n));
    const allNotes = voicedNotes.concat(lhNotes);
    if (allNotes.length > 0) {
        playTrainerChordOnce(allNotes);
    }
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
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    chord.octaveShift = shift;

    // Regenerate notes with new octave
    const chordInfo = getProgressionChordNotes(
        chord.key || trainerState.currentKey,
        chord.roman,
        chord.type,
        chord.inversion
    );

    if (chordInfo && chordInfo.notes) {
        // Apply octave shift
        chord.notes = chordInfo.notes.map(note => {
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return note;
            const noteName = match[1];
            const octave = parseInt(match[2]);
            const newOctave = octave + Math.floor(shift / 12);
            // Clamp octave to valid MIDI range (0-8)
            const clampedOctave = Math.max(0, Math.min(8, newOctave));
            return `${noteName}${clampedOctave}`;
        });
    }

    // Save state
    saveState({ type: 'chord-update', data: { index, property: 'octaveShift', value: shift } });

    // Update only this card
    updateSingleCard(index);

    // Also update the grand staff notation
    updateChordAndRenderPreservingTrebleNotes(index);

    // Play the chord with the new octave (LH is relative to RH, so update LH too)
    const voicedNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
    const lhRelativeShift = chord.lhOctaveShift || -12;
    const absoluteLHOctaveShift = shift + lhRelativeShift;
    const lhNotes = getLHNotes(
        chord.root,
        chord.lhType,
        chord.lhInversion,
        trainerState.currentKey,
        absoluteLHOctaveShift,
        chord.type,
        getEnharmonicPreference()
    ).filter(n => !(chord.lhOmittedNotes || []).includes(n));
    const allNotes = voicedNotes.concat(lhNotes);
    if (allNotes.length > 0) {
        playTrainerChordOnce(allNotes);
    }
}

/**
 * Update LH octave shift (relative to RH)
 */
function updateLHOctaveShift(index, shift) {
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    chord.lhOctaveShift = shift;

    // Regenerate LH notes with new relative octave shift
    const rhOctaveShift = chord.octaveShift || 0;
    const absoluteLHOctaveShift = rhOctaveShift + shift;
    chord.lhNotes = getLHNotes(
        chord.root,
        chord.lhType || 'off',
        chord.lhInversion || 0,
        trainerState.currentKey,
        absoluteLHOctaveShift,
        chord.type,
        getEnharmonicPreference()
    );

    // Save state
    saveState({ type: 'chord-update', data: { index, property: 'lhOctaveShift', value: shift } });

    // Update only this card
    updateSingleCard(index);

    // Also update the grand staff notation
    updateChordAndRenderPreservingTrebleNotes(index);

    // Play the chord with the new LH octave
    const voicedNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
    const lhNotes = (chord.lhNotes || []).filter(n => !(chord.lhOmittedNotes || []).includes(n));
    const allNotes = voicedNotes.concat(lhNotes);
    if (allNotes.length > 0) {
        playTrainerChordOnce(allNotes);
    }
}

/**
 * Update LH inversion
 */
function updateLHInversion(index, newInversion, shouldUpdateUI = true, shouldSyncNotation = true) {
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];
    chord.lhInversion = newInversion;

    // Regenerate LH notes with new inversion (using relative LH octave shift)
    const rhOctaveShift = chord.octaveShift || 0;
    const lhRelativeShift = chord.lhOctaveShift || -12;
    const absoluteLHOctaveShift = rhOctaveShift + lhRelativeShift;
    chord.lhNotes = getLHNotes(
        chord.root,
        chord.lhType || 'off',
        newInversion,
        trainerState.currentKey,
        absoluteLHOctaveShift,
        chord.type,
        getEnharmonicPreference()
    );

    // Clear lhOmittedNotes since note names change with inversion
    chord.lhOmittedNotes = [];

    // Save state
    saveState({ type: 'chord-update', data: { index, property: 'lhInversion', value: newInversion } });

    // Update only this card (if requested)
    if (shouldUpdateUI) {
        updateSingleCard(index);
    }

    // Also update the grand staff notation (if requested)
    if (shouldSyncNotation) {
        updateChordAndRenderPreservingTrebleNotes(index);
    }

    // Note: Playback is handled by the press-and-hold event handler on the button
    // Don't call playTrainerChordOnce here as it would conflict with the hold behavior
}

/**
 * Toggle LH note on/off
 */
function toggleLHNote(index, note) {
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];

    if (!chord.lhOmittedNotes) chord.lhOmittedNotes = [];

    const idx = chord.lhOmittedNotes.indexOf(note);
    if (idx > -1) {
        chord.lhOmittedNotes.splice(idx, 1);
    } else {
        chord.lhOmittedNotes.push(note);
    }

    // Save state
    saveState({ type: 'chord-update', data: { index, property: 'lhOmittedNotes', value: chord.lhOmittedNotes } });

    // Update the grand staff notation
    updateChordAndRenderPreservingTrebleNotes(index);

    // Play the chord with the new LH voicing
    const voicedNotes = chord.notes.filter(n => !(chord.omittedNotes || []).includes(n));
    const lhNotes = (chord.lhNotes || []).filter(n => !chord.lhOmittedNotes.includes(n));
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

            // Set minWidth on the wrapper so it actually takes up space in the grid
            const targetWidth = dimensions.width + 40;
            wrapper.style.minWidth = `${targetWidth}px`;

            // Force layout by reading dimensions
            wrapper.getBoundingClientRect();

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
        filter: '.chord-card-wrapper:first-child', // Exclude Add/Clear buttons (first child)
        swapThreshold: 0.65, // More tolerant swapping for transformed elements
        onStart: function(evt) {
            // Clear all transforms during drag so Sortable can calculate positions correctly
            const allWrappers = container.querySelectorAll('.chord-card-wrapper[data-chord-index]');
            allWrappers.forEach(wrapper => {
                // Store current transform for restoration
                wrapper.setAttribute('data-stored-transform', wrapper.style.transform || '');
                wrapper.style.transform = '';
                wrapper.classList.remove('shift-right');
            });
        },
        onEnd: function(evt) {
            // First, restore transforms for all cards (in case drag was cancelled)
            const allWrappers = container.querySelectorAll('.chord-card-wrapper[data-chord-index]');
            allWrappers.forEach(wrapper => {
                const storedTransform = wrapper.getAttribute('data-stored-transform') || '';
                if (storedTransform) {
                    wrapper.style.transform = storedTransform;
                    wrapper.classList.add('shift-right');
                }
                wrapper.removeAttribute('data-stored-transform');
            });

            if (evt.oldIndex !== evt.newIndex) {
                // Account for button container at index 0
                // Subtract 1 from both indices since buttons take up position 0
                const actualOldIndex = evt.oldIndex - 1;
                const actualNewIndex = evt.newIndex - 1;

                if (actualOldIndex < 0 || actualNewIndex < 0) return; // Shouldn't happen, but safety check

                // Reorder progression data
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

                // Save state for undo/redo
                saveState({
                    type: 'reorder',
                    data: { fromIndex: actualOldIndex, toIndex: actualNewIndex }
                });

                // Re-render both views (this will recalculate shifts properly)
                renderProgressionDisplay('progression-visualization', true);
                renderProgressionDisplay('melody-progression-visualization', false);

                // Update grand staff notation (chord order affects rendering)
                console.log('[ProgressionBuilder-Simplified] Drag/drop completed, refreshing notation...');
                // Sync progression to compositionState first
                if (window.syncProgressionToMelodyComposer && window.getCompositionState) {
                    window.syncProgressionToMelodyComposer();
                }
                // Then refresh the notation rendering
                if (window.refreshNotationFromProgression) {
                    const result = window.refreshNotationFromProgression();
                    console.log('[ProgressionBuilder-Simplified] Notation refresh result:', result);
                } else {
                    console.warn('[ProgressionBuilder-Simplified] window.refreshNotationFromProgression not available');
                }
            }
        }
    });
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
        console.warn('Pattern not found in COMMON_PROGRESSIONS:', pattern.id);
        console.log('Available patterns:', Object.keys(COMMON_PROGRESSIONS));
        console.log('Pattern object:', pattern);
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

    console.log(`Highlighting ${pattern.matches.length} occurrence(s) of pattern "${pattern.id}" with length ${patternLength}`);

    // Highlight all chords in each pattern match
    pattern.matches.forEach((startIndex, matchIdx) => {
        const color = highlightColors[matchIdx % highlightColors.length];

        console.log(`  Match ${matchIdx + 1}: Starting at index ${startIndex}, using colors bg:${color.bg}, border:${color.border}`);

        // Highlight the sequence of cards
        for (let i = 0; i < patternLength; i++) {
            const chordIndex = startIndex + i;

            // Highlight card wrapper (works for both simplified and detailed views)
            const wrapper = document.querySelector(`.chord-card-wrapper[data-chord-index="${chordIndex}"]`);
            if (wrapper) {
                console.log(`    ✓ Found wrapper for chord ${chordIndex}`);
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
                console.warn(`    ✗ Could not find wrapper for chord index ${chordIndex}`);
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

    // First remove all existing selections
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
}

/**
 * Remove highlighting from all tension curve points
 */
function unhighlightAllTensionPoints() {
    const container = document.getElementById('tension-curve-container');
    if (!container) return;

    const points = container.querySelectorAll('.tension-curve-point');
    points.forEach(point => {
        if (point.classList.contains('highlighted-tension-point')) {
            point.setAttribute('r', '5');
            point.setAttribute('stroke', '#1f2937');
            point.setAttribute('stroke-width', '2');
            point.classList.remove('highlighted-tension-point');
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
 * @param {string} containerId - Optional container ID. Defaults to 'progression-visualization'
 * @param {boolean} syncBothTabs - If true, also updates the other tab. Defaults to true for main container, false for melody container
 */
export function renderProgressionDisplay(containerId = 'progression-visualization', syncBothTabs = true) {
    // Capture staff notation states before clearing DOM (always capture from both tabs)
    captureStaffNotationStates();
    
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`Container with ID "${containerId}" not found`);
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
            console.warn('Error destroying Sortable:', e);
            container.sortableInstance = null;
        }
    }
    
    container.innerHTML = '';

    const trainerState = getTrainerState();

    // PHASE 3.3: Add analysis visualizations (only for main progression builder tab)
    if (containerId === 'progression-visualization' && trainerState.progressionData.length > 0) {
        // Get parent panel to render pattern badges and tension curve outside the grid
        const panel = container.parentElement;

        // Remove old pattern badges and tension curve if they exist
        const oldPatterns = panel?.querySelector('#pattern-highlights-container');
        const oldTension = panel?.querySelector('#tension-curve-container');
        if (oldPatterns) oldPatterns.remove();
        if (oldTension) oldTension.remove();

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
        renderSimplifiedChordSequence(container, trainerState.progressionData, trainerState.currentKey || 'C');

        // 3. Tension curve visualization (after grid, at bottom of panel)
        if (panel) {
            renderTensionCurve(panel, trainerState.progressionData, trainerState.currentKey || 'C');
        }

        // 4. Move Quick Analysis Bar above tension curve
        const quickAnalysisBar = panel?.querySelector('#quick-analysis-bar-container');
        const tensionCurve = panel?.querySelector('#tension-curve-container');
        if (quickAnalysisBar && tensionCurve) {
            // Remove from current position and insert before tension curve
            quickAnalysisBar.remove();
            panel.insertBefore(quickAnalysisBar, tensionCurve);
        }

        // Don't render old-style detailed cards below - they expand inline from simplified
        // (Sortable is already initialized in renderSimplifiedChordSequence)
        return;
    }

    // MELODY COMPOSER: Use same simplified/detailed card style with Add/Clear buttons
    if (containerId === 'melody-progression-visualization' && trainerState.progressionData.length > 0) {
        // Render simplified chord cards with action buttons (same as Progression Builder)
        renderSimplifiedChordSequence(container, trainerState.progressionData, trainerState.currentKey || 'C', {
            showActionButtons: true
        });

        // Also update the Melody Composer's notation
        if (window.refreshNotationFromProgression) {
            // Use requestAnimationFrame to ensure system is ready
            requestAnimationFrame(() => {
                // Sync progression to compositionState first
                if (window.syncProgressionToMelodyComposer && window.getCompositionState) {
                    window.syncProgressionToMelodyComposer();
                }
                // Then refresh the notation rendering
                window.refreshNotationFromProgression();
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
        lhOctaveSelect.value = chordData.lhOctaveShift || '-12';
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
                    console.log('[ProgressionBuilder] Drag/drop completed, refreshing notation...');
                    if (window.refreshNotationFromProgression) {
                        const result = window.refreshNotationFromProgression();
                        console.log('[ProgressionBuilder] Notation refresh result:', result);
                    } else {
                        console.warn('[ProgressionBuilder] window.refreshNotationFromProgression not available');
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
            renderProgressionDisplay('progression-visualization', true);
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
            chordData.lhOctaveShift = -12;
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
    renderProgressionDisplay('progression-visualization', true);
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
    renderProgressionDisplay('progression-visualization', true);
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
 * Update the "Current Key: X" display text
 */
function updateCurrentKeyDisplay() {
    const displayText = document.getElementById('current-key-display-text');
    if (displayText) {
        const trainerState = getTrainerState();
        const currentKey = trainerState.currentKey || 'C';
        displayText.textContent = `Current Key: ${currentKey}`;
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
        console.warn(`Invalid chord result for ${chordRootNote} ${selectedType} (inversion ${selectedInversion})`);
        return null;
    }

    // Validate and filter notes to ensure they're all valid strings
    const validNotes = (chordResult.specificNotes || []).filter(note => 
        note != null && note !== '' && typeof note === 'string' && note !== 'NaN' && !note.includes('undefined') && !note.includes('NaN')
    );
    
    // If no valid notes, return null
    if (validNotes.length === 0) {
        console.warn(`No valid notes generated for ${chordRootNote} ${selectedType} (inversion ${selectedInversion})`);
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
    const trainerState = getTrainerState();

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
    const measureDuration = `${speedValue}m`;
    
    // Set Transport BPM based on speed to ensure correct timing
    // Convert measure duration to BPM: 1 measure = 4 beats at 120 BPM = 2 seconds
    // For speedValue of 1.5m, 1m, 0.6m, we want the measure to take that many seconds
    // At 120 BPM, 1 measure = 2 seconds. So for 1.5 seconds, we need 4 beats / 1.5s * 60 = 160 BPM
    // Formula: BPM = (4 beats / speedValue seconds) * 60
    const bpm = (4 / speedValue) * 60;
    Tone.Transport.bpm.value = bpm;

    let allEvents = [];
    trainerState.progressionData.forEach((chord, index) => {
        const measure = index;
        const allLhNotes = getLHNotes(
            chord.root,
            chord.lhType,
            chord.lhInversion,
            trainerState.currentKey,
            chord.lhOctaveShift || -12,
            chord.type,
            getEnharmonicPreference()
        );
        const lhNotes = allLhNotes.filter(note => !(chord.lhOmittedNotes || []).includes(note));
        const rhNotes = chord.notes.filter(note => !(chord.omittedNotes || []).includes(note));

        // Generate events with measure duration to prevent overlap
        allEvents.push(...generateRhythmicEvents(rhNotes, lhNotes, measure, chord.rhythmPattern || 'block', measureDuration));

        // Schedule visual updates per measure
        // Store the callback ID so we can cancel it if needed
        const callbackId = Tone.Transport.scheduleOnce(time => {
            // Stop previous chord IMMEDIATELY at the start of the new measure to prevent overlap
            Tone.Draw.schedule(() => {
                stopTrainerChord();
                // Also release all notes to ensure clean stop
                const instrument = getInstrument();
                if (instrument && getAudioIsReady()) {
                    try {
                        instrument.releaseAll(time);
                    } catch (e) {
                        // Ignore errors
                    }
                }
            }, time);
            
            Tone.Draw.schedule(() => {
                document.getElementById('progression-chord-notes-display').textContent = `${chord.roman} (${chord.name})`;
                highlightTrainer(trainerState.scaleNotes, rhNotes.concat(lhNotes));

                // Highlight chord card and tension curve point during Auto Play
                highlightTensionPoint(index);
                highlightChordCard(index);
            }, time);
        }, `${measure}m`);
        
        // Store callback IDs for potential cancellation (if needed)
        if (!trainerState.scheduledCallbacks) {
            trainerState.scheduledCallbacks = [];
        }
        trainerState.scheduledCallbacks.push(callbackId);
    });

    const transportPart = new Tone.Part((time, event) => {
        const notes = Array.isArray(event.note) ? event.note : [event.note];
        
        // Stop any previous notes IMMEDIATELY before playing new ones to prevent overlap
        const instrument = getInstrument();
        if (instrument) {
            // Release ALL currently playing notes at the exact time the new chord starts
            try {
                instrument.releaseAll(time);
                setTrainerChordNotes([]);
            } catch (e) {
                // Ignore errors
            }
        }
        
        // For PluckSynth (guitar), trigger each note individually
        // For Sampler (piano), we can pass the array
        const isGuitar = window.getIsFretboardModeOn && window.getIsFretboardModeOn();
        if (isGuitar) {
            notes.forEach(note => {
                instrument.triggerAttackRelease(note, event.duration, time, event.velocity);
            });
        } else {
            instrument.triggerAttackRelease(notes, event.duration, time, event.velocity);
        }
        
        // Store notes being played for this event (for block chords that span full measure)
        if (notes.length > 0 && (event.duration.includes('m') || event.duration.includes('s'))) {
            // This is a chord spanning a duration - store it for potential release
            setTrainerChordNotes(notes);
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
        const totalMeasures = trainerState.progressionData.length;
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
        }, `${totalMeasures}m`);
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
    
    // Calculate chord duration to prevent overlap - use 90% of measure duration to ensure clean stop
    const measureDurationSeconds = Tone.Time(measureDuration).toSeconds();
    const chordDuration = `${measureDurationSeconds * 0.9}s`; // 90% of measure to prevent overlap

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
                const bassVoice = measure.notation.bass.voices && measure.notation.bass.voices[0];
                if (bassVoice && bassVoice.notes && bassVoice.notes.length > 0) {
                    // Use auto-generated bass notes (blue notes)
                    bassAutoFillActive = true;
                    // Extract pitch from bass notes, filter out rests and invalid pitches
                    allLhNotes = bassVoice.notes
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
        const absoluteLHOctaveShift = octaveShift + (lhOctaveShift || -12);
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
                console.error('Error playing chord:', e);
            }
        };
        
        // Resume audio context if needed (browser autoplay policy)
        if (typeof Tone !== 'undefined' && Tone.context && Tone.context.state !== 'running') {
            Tone.context.resume().then(() => {
                playChord();
            }).catch(err => {
                console.error('Error resuming audio context:', err);
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
                const bassVoice = measure.notation.bass.voices && measure.notation.bass.voices[0];
                if (bassVoice && bassVoice.notes && bassVoice.notes.length > 0) {
                    // Use auto-generated bass notes (blue notes)
                    bassAutoFillActive = true;
                    // Extract pitch from bass notes, filter out rests
                    allLhNotes = bassVoice.notes
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
                // Get speed from selector to match Auto Play duration
                const speedValue = parseFloat(document.getElementById('trainer-speed-select')?.value || '1');
                const chordDuration = `${speedValue * 0.9}s`; // 90% of measure duration to prevent overlap
                
                // Play the chord with duration based on speed selector
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
                const durationMs = speedValue * 900; // 90% of speed value in milliseconds
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
        console.warn('Invalid chord index for suggestions:', chordIndex);
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
        renderProgressionDisplay('progression-visualization', true);
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
                console.warn('No notes generated for chord:', chordType, root, inversion);
                return;
            }

            const instrument = getInstrument();
            if (!instrument) {
                console.warn('Instrument not ready');
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
            console.error('Error playing chord:', error);
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

    // Show the modal
    showChordSuggestionModal(currentType, currentRoot, currentInversion, onAddChord, onPlayChord, onStopChord);
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
 */
function updateChordAndRenderPreservingTrebleNotes(index) {
    if (!window.getCompositionState || !window.getNotationComposer) {
        return;
    }

    const compositionState = window.getCompositionState();
    const notationComposer = window.getNotationComposer();
    const trainerState = getTrainerState();
    const chord = trainerState.progressionData[index];

    if (!chord) return;

    console.log('[UPDATE CHORD] Updating chord at index', index);

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
        });

        // Regenerate bass for this measure
        const autoGenerateBass = compositionState.getSettings().autoGenerateBass;
        const measure = compositionState.getMeasure(index);

        if (autoGenerateBass) {
            compositionState.updateBassFromChord(index);
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

    // Update chord cards on melody tab
    const melodyContainer = document.getElementById('melody-progression-visualization');
    if (melodyContainer && trainerState.progressionData.length > 0) {
        melodyContainer.innerHTML = '';
        renderSimplifiedChordSequence(melodyContainer, trainerState.progressionData, trainerState.currentKey || 'C', {
            showActionButtons: true
        });
    }

    // Render the notation
    if (notationComposer && typeof notationComposer.render === 'function') {
        notationComposer.render();
    }
}

export function addChordToProgressionByParams(chordType, root, inversion = 0, octaveShift = 0) {
    // Save current state for undo
    const currentState = captureProgressionState();
    pushToUndoStack(currentState);

    const trainerState = getTrainerState();

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
    const defaultLHRelativeShift = -12; // One octave below RH by default (for when LH is enabled later)
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
        roman: roman
    };

    // Add to the end of the progression
    const updatedProgression = [...trainerState.progressionData, newChordData];

    // Update state
    setProgressionData(updatedProgression);

    // Re-render progression display
    renderProgressionDisplay('progression-visualization', true);
    // DON'T render melody-progression-visualization here - we manually update compositionState below

    // Phase 1B: Sync to melody composer if it's active
    // This ensures bass auto-fill updates when chords are added while on melody tab
    if (window.getCompositionState && window.getNotationComposer) {
        const compositionState = window.getCompositionState();
        const notationComposer = window.getNotationComposer();

        console.log('[ADD CHORD] Treble notes BEFORE:');
        for (let i = 0; i < compositionState.getMeasureCount(); i++) {
            const measure = compositionState.getMeasure(i);
            const trebleNotes = measure?.notation?.treble?.voices?.[0]?.notes || [];
            console.log(`  M${i}: ${trebleNotes.length} notes`);
        }

        // CRITICAL: Block BOTH automatic renders AND bi-directional sync during update
        // This prevents progressionNotationSync from syncing our changes back to progressionData
        // and then back to compositionState (which would wipe treble notes)
        const wasBlockingRenders = notationComposer.isSyncingFromProgression;
        notationComposer.isSyncingFromProgression = true;

        // Also block the bi-directional sync
        const syncInstance = window.getProgressionNotationSync && window.getProgressionNotationSync();
        const wasBlockingSync = syncInstance ? syncInstance.isUpdating : false;
        if (syncInstance) {
            syncInstance.isUpdating = true;
        }

        try {
            // Instead of full sync (which wipes user's treble notes), just add the new measure
            // Get the index where the chord was added (last in progression)
            const measureIndex = updatedProgression.length - 1;

            // Add measure to compositionState if it doesn't exist
            while (compositionState.getMeasureCount() <= measureIndex) {
                compositionState.addMeasure({});
            }

            // Update the chord for this measure
            const chord = updatedProgression[measureIndex];
            compositionState.updateChord(measureIndex, {
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
            });

            // Generate bass for this measure
            const autoGenerateBass = compositionState.getSettings().autoGenerateBass;
            console.log('[ADD CHORD] autoGenerateBass:', autoGenerateBass, 'for measure', measureIndex);

            const measure = compositionState.getMeasure(measureIndex);

            if (autoGenerateBass) {
                // Auto-generate is ON: generate pattern-based bass
                console.log('[ADD CHORD] Calling updateBassFromChord for measure', measureIndex);
                compositionState.updateBassFromChord(measureIndex);
            } else {
                // Auto-generate is OFF: create simple whole-note chord bass
                console.log('[ADD CHORD] Creating simple whole-note bass for measure', measureIndex);
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

            // Verify bass was generated
            const bassNotes = measure?.notation?.bass?.voices?.[0]?.notes || [];
            console.log('[ADD CHORD] Measure', measureIndex, 'now has', bassNotes.length, 'bass notes');
        } finally {
            // Restore previous render blocking state
            notationComposer.isSyncingFromProgression = wasBlockingRenders;

            // Restore previous sync blocking state
            if (syncInstance) {
                syncInstance.isUpdating = wasBlockingSync;
            }
        }

        console.log('[ADD CHORD] Treble notes AFTER:');
        for (let i = 0; i < compositionState.getMeasureCount(); i++) {
            const measure = compositionState.getMeasure(i);
            const trebleNotes = measure?.notation?.treble?.voices?.[0]?.notes || [];
            console.log(`  M${i}: ${trebleNotes.length} notes`);
        }

        // First update the chord cards on the melody tab (without wiping compositionState)
        const melodyContainer = document.getElementById('melody-progression-visualization');
        if (melodyContainer && updatedProgression.length > 0) {
            // Render just the simplified chord cards, skip the sync
            melodyContainer.innerHTML = '';
            renderSimplifiedChordSequence(melodyContainer, updatedProgression, trainerState.currentKey || 'C', {
                showActionButtons: true
            });
        }

        // CRITICAL: Render canvas AFTER DOM updates
        // performRender now includes aggressive repaint triggers
        if (notationComposer && typeof notationComposer.render === 'function') {
            notationComposer.render();
        }
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
 * Checks if we're on Melody Composer tab or if Free mode is active
 */
function renderMelodyNotationIfNeeded() {
    // Check if we're on the Melody Composer tab
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
            const result = window.refreshNotationFromProgression();
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
                window.refreshNotationFromProgression();
            }, 50);
        }
    }
}

/**
 * Clear all chords from the progression
 */
export function clearProgression() {
    const trainerState = getTrainerState();
    
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
    renderProgressionDisplay('progression-visualization', true);
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
}

export function removeChordFromProgression(index) {
    const trainerState = getTrainerState();

    if (trainerState.isPlaying) handleAutoPlayback();

    // Save state before removing
    saveStateBeforeChange();

    trainerState.progressionData.splice(index, 1);
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
    renderProgressionDisplay('progression-visualization', true);
    // Then render the melody composer tab (syncBothTabs=false to avoid infinite recursion)
    renderProgressionDisplay('melody-progression-visualization', false);

    // Auto-render melody notation if on Melody Composer tab or if Free mode is active
    renderMelodyNotationIfNeeded();

    // Phase 2.2: Dispatch event for chord recommendations sidebar
    window.dispatchEvent(new CustomEvent('progressionUpdated', {
        detail: {
            progression: trainerState.progressionData,
            key: trainerState.currentKey
        }
    }));
}

/**
 * Toggle a note in the progression chord voicing
 * @param {number} chordIndex - Index of chord
 * @param {string} note - Note to toggle
 */
export function toggleProgressionNote(chordIndex, note) {
    const trainerState = getTrainerState();
    const chordData = trainerState.progressionData[chordIndex];
    if (!chordData) return;

    // Save state before toggling
    saveStateBeforeChange();

    // Ensure omittedNotes array exists
    if (!chordData.omittedNotes) {
        chordData.omittedNotes = [];
    }

    const noteOmitIndex = chordData.omittedNotes.indexOf(note);
    if (noteOmitIndex > -1) {
        chordData.omittedNotes.splice(noteOmitIndex, 1); // Note was omitted, so un-omit it
    } else {
        chordData.omittedNotes.push(note); // Note was played, so omit it
    }

    // Play chord with duration after voicing change
    const voicedNotes = chordData.notes.filter(n => !chordData.omittedNotes.includes(n));
    const lhNotes = getLHNotes(
        chordData.root,
        chordData.lhType,
        chordData.lhInversion,
        trainerState.currentKey,
        chordData.lhOctaveShift,
        chordData.type,
        getEnharmonicPreference()
    ).filter(n => !(chordData.lhOmittedNotes || []).includes(n));
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
    
    const newData = getProgressionChordNotes(
        keyForCalculation,
        chordState.roman,
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
            // console.log('Octave shift mapping:', {
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
                    chordState.lhOctaveShift || -12,
                    chordState.type,
                    getEnharmonicPreference()
                );
                
                // Recalculate LH notes (they might also be affected if LH octave shift changes)
                const newLhNotes = getLHNotes(
                    newData.root,
                    chordState.lhType,
                    chordState.lhInversion,
                    trainerState.currentKey,
                    chordState.lhOctaveShift || -12,
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
        renderProgressionDisplay('progression-visualization', true);
        renderProgressionDisplay('melody-progression-visualization', false);
        
        // Auto-render melody notation if on Melody Composer tab or if Free mode is active
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
    renderProgressionDisplay('progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);
    
    // Auto-render melody notation if on Melody Composer tab or if Free mode is active
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
        renderProgressionDisplay('progression-visualization', true);
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
 */
export function addToProgressionData(chordData) {
    const trainerState = getTrainerState();

    // Save state before adding
    saveStateBeforeChange();

    trainerState.progressionData.push(chordData);
    if (chordData.roman && !trainerState.progressionRomans.includes(chordData.roman)) {
        trainerState.progressionRomans.push(chordData.roman);
    }
    setProgressionData(trainerState.progressionData);
    
    // Render both progression displays to keep them in sync
    renderProgressionDisplay('progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);
    
    // Auto-render melody notation if on Melody Composer tab or if Free mode is active
    renderMelodyNotationIfNeeded();
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

    // Add major keys
    notes.forEach((note, index) => {
        const option = document.createElement('option');
        option.value = note;
        option.textContent = `${note} Major`;
        if (index === 0) option.selected = true;
        keySelect.appendChild(option);
    });

    // Add minor keys
    notes.forEach((note, index) => {
        const option = document.createElement('option');
        option.value = `${note}m`;
        option.textContent = `${note} minor`;
        keySelect.appendChild(option);
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
        // Select first one by default (Pop Progression)
        if (index === 0) {
            option.selected = true;
        }
        progressionSelect.appendChild(option);
    });

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
                console.log('[speedSelect] Speed changed, restarting playback');
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
    const trainerState = getTrainerState();
    if (trainerState.progressionData.length === 0) {
        loadProgression();
    } else {
        // Render progression display
        renderProgressionDisplay('progression-visualization', true);
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
 * @returns {Object} State snapshot
 */
function captureProgressionState() {
    const trainerState = getTrainerState();
    return {
        progressionData: JSON.parse(JSON.stringify(trainerState.progressionData)),
        progressionRomans: [...trainerState.progressionRomans],
        currentKey: trainerState.currentKey
    };
}

/**
 * Restore a progression state snapshot
 * @param {Object} state - State snapshot to restore
 */
function restoreProgressionState(state) {
    if (!state) return;

    // Restore state
    setProgressionData(state.progressionData);
    setProgressionRomans(state.progressionRomans);
    setCurrentKey(state.currentKey);

    // Re-render display
    renderProgressionDisplay('progression-visualization', true);
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
            window.renderProgressionDisplay('progression-visualization', true);
            window.renderProgressionDisplay('melody-progression-visualization', false);
        }

        // Sync to composition state and refresh VexFlow notation
        if (window.syncProgressionToMelodyComposer) {
            window.syncProgressionToMelodyComposer();
        }
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
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
            window.renderProgressionDisplay('progression-visualization', true);
            window.renderProgressionDisplay('melody-progression-visualization', false);
        }

        // Sync to composition state and refresh VexFlow notation
        if (window.syncProgressionToMelodyComposer) {
            window.syncProgressionToMelodyComposer();
        }
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
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
 */
function saveStateBeforeChange() {
    const currentState = captureProgressionState();
    saveState(currentState);
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
        chordType = typeAndExtensions.includes('sus2') || typeAndExtensions.includes('2') ? 'Suspended 2nd' : 'Suspended 4th';
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
        console.error('Chord list input not found');
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
    console.log('Parsed chord symbols:', chordSymbols);
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
    
    console.log('Import settings:', { mode, currentKey, keyForCalculation, octaveShift, enharmonicPreference });
    
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
        if (audioIsReady && cameraShutter) {
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
        console.log(`Processing chord ${index + 1}/${chordSymbols.length}: "${chordSymbol}" ->`, parsed);
        if (!parsed) {
            console.warn(`Could not parse chord: ${chordSymbol}`);
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
        
        console.log(`  Root: ${parsed.root} -> ${root}, Type: ${parsed.type}`);
        
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
        
        console.log(`  Chord result:`, chordResult);
        
        if (!chordResult || !chordResult.specificNotes || chordResult.specificNotes.length === 0) {
            console.warn(`Could not generate notes for chord: ${chordSymbol} (root: ${root}, type: ${parsed.type})`);
            errorCount++;
            return;
        }
        
        // Calculate Roman numeral
        const trainerKeyRootIndex = ALL_NOTES.indexOf(keyForCalculation);
        let addedChordRootIndex = ALL_NOTES.indexOf(root);
        if (addedChordRootIndex === -1) {
            addedChordRootIndex = ALL_NOTES.indexOf(ENHARMONIC_MAP[root] || root);
        }
        if (addedChordRootIndex === -1) {
            console.warn(`Could not find root note index for: ${root}`);
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
        const defaultLHRelativeShift = -12; // 1 octave below RH
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
            lhOctaveShift: -12,
            lhNotes: defaultLHNotes,
            lhOmittedNotes: [],
            rhythmPattern: 'block',
            isVoicingExpanded: true
        };
        
        newChords.push(chordData);
        successCount++;
    });
    
    // Add all chords to progression
    console.log(`Total chords to add: ${newChords.length}, Success: ${successCount}, Errors: ${errorCount}`);
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
        
        console.log(`Before adding: progression has ${trainerState.progressionData.length} chords`);
        
        // Add chords to progression
        newChords.forEach((chordData, idx) => {
            console.log(`Adding chord ${idx + 1}:`, chordData);
            trainerState.progressionData.push(chordData);
            if (chordData.roman && !trainerState.progressionRomans.includes(chordData.roman)) {
                trainerState.progressionRomans.push(chordData.roman);
            }
        });
        
        console.log(`After adding: progression has ${trainerState.progressionData.length} chords`);
        
        // Update state using setters
        setProgressionData(trainerState.progressionData);
        setProgressionRomans(trainerState.progressionRomans);
        setIsReady(true);
        
        // Get fresh state after updating
        trainerState = getTrainerState();
        console.log(`State after setProgressionData: ${trainerState.progressionData.length} chords`);
        
        // Render progression display
        console.log('Rendering progression display...');
        renderProgressionDisplay('progression-visualization', true);
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
        console.error('No chords were successfully parsed!');
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
    showTemplateBrowser((template, action) => {
        loadTemplateToProgression(template, action);
    });
}

/**
 * Load a selected template into the progression
 * @param {object} template - Template object from template browser
 * @param {string} action - 'load' (replace) or 'append' (add to end)
 */
function loadTemplateToProgression(template, action = 'load') {
    console.log('Loading template:', template.name);

    const keySelect = document.getElementById('trainer-key-select');
    const currentKey = keySelect ? keySelect.value : 'C';

    // Stop playback if currently playing
    const trainerState = getTrainerState();
    if (trainerState.isPlaying && window.handleAutoPlayback) {
        handleAutoPlayback();
    }

    // Get roman numerals from template
    const romans = template.progressions;

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
    if (action === 'append' && trainerState.progressionData && trainerState.progressionData.length > 0) {
        progressionData = [...trainerState.progressionData];
        progressionRomans = [...trainerState.progressionRomans];
    }

    romans.forEach((roman, index) => {
        // Parse roman numeral to extract base and quality
        // Examples: "I", "ii", "V7", "Imaj7", "ii7", "vii°"
        let baseRoman = roman;
        let chordQuality = null;

        // Check for 7th chord suffixes
        if (roman.includes('maj7')) {
            baseRoman = roman.replace('maj7', '');
            chordQuality = 'Major 7th';
        } else if (roman.includes('7')) {
            baseRoman = roman.replace('7', '');
            // Determine if it's dominant 7th or minor 7th based on case
            if (baseRoman === baseRoman.toUpperCase() || baseRoman === 'V' || baseRoman === 'VII') {
                chordQuality = 'Dominant 7th';
            } else {
                chordQuality = 'Minor 7th';
            }
        }

        // Look up the default quality from ROMAN_MAP_BASE
        const mapEntry = ROMAN_MAP_BASE[baseRoman];
        const defaultQuality = mapEntry ? mapEntry.quality : 'Major'; // Default to Major if not found

        // Determine final quality - use 7th chord quality if present, otherwise use default
        const finalQuality = chordQuality || defaultQuality;

        // Get chord info from base roman numeral with the correct quality
        const chordInfo = getProgressionChordNotes(currentKey, baseRoman, finalQuality, 0);

        if (chordInfo && chordInfo.root && chordInfo.type) {
            // Use the quality we already determined
            const finalType = finalQuality;

            // LH defaults to 'off' for template-loaded chords (no left hand playing by default)
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
                octaveShift: 0,
                key: currentKey
            };

            progressionData.push(chordData);
            progressionRomans.push(roman);
        } else {
            console.warn(`Could not generate chord for roman numeral: ${roman} (base: ${baseRoman}) in key ${currentKey}`, chordInfo);
        }
    });

    // Update state
    setProgressionData(progressionData);
    setProgressionRomans(progressionRomans);
    setCurrentIndex(0);
    setIsReady(true);

    // Clear undo/redo history for fresh start (only on load, not append)
    if (action === 'load') {
        clearHistory();
    }

    // Save initial state
    saveState({
        progressionData: [...progressionData],
        progressionRomans: [...progressionRomans]
    });

    // Render progression display
    renderProgressionDisplay('progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

    // Update UI controls
    updateProgressionControlsUI();

    // Show success message with template info
    const actionText = action === 'append' ? 'Appended' : 'Loaded';
    const message = `${actionText} template: "${template.name}"\n${progressionData.length} total chords in ${currentKey}`;
    if (window.showModal) {
        setTimeout(() => {
            window.showModal(message, false);
            // Auto-hide after 2 seconds
            setTimeout(() => {
                if (window.hideModal) window.hideModal();
            }, 2000);
        }, 100);
    }

    console.log('Template loaded successfully:', {
        template: template.name,
        chords: progressionData.length,
        key: currentKey
    });
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
 */
export function toggleTensionCurve() {
    tensionCurveVisible = !tensionCurveVisible;

    const container = document.getElementById('tension-curve-container');
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
}
