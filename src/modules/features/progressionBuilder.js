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
    setTensionProfile
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

// Track staff notation visibility state for each chord position
// This persists across key/progression changes
let staffNotationStates = new Map(); // Map<position, boolean>

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
    ROMAN_MAP_BASE,
    COMMON_PROGRESSIONS
} from '../../data/music-data.js';

// Import chord suggestion modal
import { showChordSuggestionModal } from '../ui/chordSuggestionModal.js';

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
// Chord Function Helper
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
    chordData.lhOctaveShift = -12;
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
 * Toggle all chord cards between staff notation and text/controls view
 * @param {boolean} showStaff - If true, show staff notation for all cards. If false, show text/controls.
 */
export function toggleAllStaffNotation(showStaff) {
    // Get progression data to know how many chords we have
    const progressionData = getProgressionData();
    if (!progressionData || progressionData.length === 0) {
        return; // No chords to toggle
    }

    // Toggle all cards
    for (let i = 0; i < progressionData.length; i++) {
        // Update the state map
        staffNotationStates.set(i, showStaff);

        // Update both containers (Progression Builder and Melody Composer)
        const containers = ['progression-visualization', 'melody-progression-visualization'];

        containers.forEach(containerId => {
            const wrapper = document.querySelectorAll(`#${containerId} > div`)[i];
            if (!wrapper) return;

            const card = wrapper.querySelector('.progression-chord-item');
            if (!card) return;

            // Find elements within this specific container
            const staffContainer = card.querySelector(`#staff-notation-${i}`) || document.getElementById(`staff-notation-${i}`);
            const staffCanvas = card.querySelector(`#staff-canvas-${i}`) || document.getElementById(`staff-canvas-${i}`);
            const staffToggleBtn = wrapper.querySelector('button[title="Toggle staff notation view"], button[title="Show chord card"]');

            if (!staffContainer || !staffCanvas) return;

            // Get all card content except the staff container and header
            const header = card.querySelector(`#chord-header-${i}`) || document.getElementById(`chord-header-${i}`);
            const cardContent = Array.from(card.children).filter(child =>
                child.id !== `staff-notation-${i}` &&
                child.id !== `chord-header-${i}`
            );

            if (showStaff) {
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

                renderStaffNotation(i, staffCanvas);
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

    // Update the global toggle button states in both tabs
    updateGlobalToggleButtons(showStaff);
}

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

        const romanEl = document.createElement('span');
        romanEl.className = 'font-mono font-bold text-sm text-indigo-700 leading-tight';
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
            functionEl.className = 'px-0.5 font-sans text-[10px] text-indigo-500 font-medium leading-tight';
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
            renderProgressionDisplay();
            return window.ddInspect();
        };
    }
    
    // Restore staff notation states after rendering is complete
    restoreStaffNotationStates();

    // Update unified suggestions panel
    if (window.updateUnifiedSuggestions) {
        window.updateUnifiedSuggestions();
    }
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
    renderProgressionDisplay();
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
    
    // Check for flat or sharp prefix
    if (romanNumeral.startsWith('b')) {
        accidental = 'flat';
        baseRoman = romanNumeral.substring(1); // Remove 'b' prefix
    } else if (romanNumeral.startsWith('#') || romanNumeral.startsWith('♯')) {
        accidental = 'sharp';
        baseRoman = romanNumeral.substring(1); // Remove '#' or '♯' prefix
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
                chordRootNote = romanNumeral; // Fall back to treating as note name
            }
        } else {
            chordRootNote = romanNumeral; // The 'romanNumeral' is actually the root note.
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

    return {
        roman: romanNumeral,
        name: chordResult.name,
        simpleName: chordResult.simpleName,
        notes: chordResult.specificNotes,
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

    // Always start playback from the first chord
    setCurrentIndex(0);

    if (trainerState.currentIndex >= trainerState.progressionData.length) {
        setCurrentIndex(0);
    }

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
                document.querySelectorAll('#progression-visualization > div').forEach((wrapper) => {
                    const card = wrapper.querySelector('.progression-chord-item');
                    const wrapperIndex = parseInt(wrapper.getAttribute('data-index'));
                    if (card && wrapperIndex === index) {
                        card.classList.add('active-progression-card');
                    } else if (card) {
                        card.classList.remove('active-progression-card');
                    }
                });
                document.getElementById('progression-chord-notes-display').textContent = `${chord.roman} (${chord.name})`;
                highlightTrainer(trainerState.scaleNotes, rhNotes.concat(lhNotes));
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
    
    // Only use selected chord as starting point if we're NOT in the middle of stepping
    if (!isSteppingSequence && window.getSelectedChordIndex) {
        const selectedIndex = window.getSelectedChordIndex();
        const totalChords = trainerState.progressionData ? trainerState.progressionData.length : 0;
        
        // If there's a valid selected chord, start from there
        if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < totalChords) {
            setCurrentIndex(selectedIndex);
        } else if (trainerState.currentIndex === undefined || trainerState.currentIndex < 0 || trainerState.currentIndex >= totalChords) {
            // No selected chord and currentIndex is invalid - start from first chord
            setCurrentIndex(0);
        }
        // Otherwise, continue from current currentIndex
    } else if (trainerState.currentIndex === undefined || trainerState.currentIndex < 0) {
        // Fallback: ensure we start from a valid index
        const totalChords = trainerState.progressionData ? trainerState.progressionData.length : 0;
        if (trainerState.currentIndex >= totalChords) {
            setCurrentIndex(0);
        }
    }
    
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
    // Stop the currently playing chord immediately
    stopTrainerChord();
    
    // Aggressively stop all notes
    const instrument = getInstrument();
    if (instrument && getAudioIsReady()) {
        try {
            instrument.releaseAll(Tone.now());
            instrument.releaseAll(Tone.now() - 0.001);
        } catch (e) {
            // Ignore errors
        }
    }
    
    // Clear highlights
    if (window.clearHighlights) {
        window.clearHighlights();
    }

    // Advance to next chord
    const trainerState = getTrainerState();
    const totalChords = trainerState.progressionData ? trainerState.progressionData.length : 0;

    if (totalChords > 0) {
        const nextIndex = (trainerState.currentIndex + 1) % totalChords;
        setCurrentIndex(nextIndex);
        
        // Update display
        if (nextIndex === 0) {
            const display = document.getElementById('progression-chord-notes-display');
            if (display) {
                display.textContent = 'Ready to Play (Progression Complete)';
            }
        }
        
        updateProgressionControlsUI();
        
        // Update last step time to maintain stepping sequence
        lastStepTime = Date.now();
    }
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

    const { lhType, lhInversion, lhOctaveShift, omittedNotes = [], lhOmittedNotes = [], octaveShift = 0 } = chord;

    const allLhNotes = getLHNotes(
        chord.root,
        lhType,
        lhInversion,
        trainerState.currentKey,
        lhOctaveShift,
        chord.type,
        getEnharmonicPreference()
    );

    // Highlight the current card - find by data-index attribute
    document.querySelectorAll('#progression-visualization > div').forEach((wrapper) => {
        const card = wrapper.querySelector('.progression-chord-item');
        const wrapperIndex = parseInt(wrapper.getAttribute('data-index'));
        if (card && wrapperIndex === index) {
            card.classList.add('active-progression-card');
        } else if (card) {
            card.classList.remove('active-progression-card');
        }
    });

    // Apply saved voicing from the chord data
    const voicedNotes = chord.notes.filter(note => !omittedNotes.includes(note));
    const lhNotes = allLhNotes.filter(note => !lhOmittedNotes.includes(note));
    const allNotes = voicedNotes.concat(lhNotes);

    highlightTrainer(trainerState.scaleNotes, allNotes);

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

    const { lhType, lhInversion, lhOctaveShift, omittedNotes = [], lhOmittedNotes = [], octaveShift = 0 } = chord;

    const allLhNotes = getLHNotes(
        chord.root,
        lhType,
        lhInversion,
        trainerState.currentKey,
        lhOctaveShift,
        chord.type,
        getEnharmonicPreference()
    );

    // Highlight the current card - find by data-index attribute
    document.querySelectorAll('#progression-visualization > div').forEach((wrapper) => {
        const card = wrapper.querySelector('.progression-chord-item');
        const wrapperIndex = parseInt(wrapper.getAttribute('data-index'));
        if (card && wrapperIndex === index) {
            card.classList.add('active-progression-card');
        } else if (card) {
            card.classList.remove('active-progression-card');
        }
    });

    // Apply saved voicing from the chord data
    const voicedNotes = chord.notes.filter(note => !omittedNotes.includes(note));
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
 */
export function addChordToProgressionByParams(chordType, root, inversion = 0) {
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
        0, // octaveShift
        getEnharmonicPreference(),
        getNotationPreference()
    );

    // Calculate roman numeral for the chord
    const roman = noteToRomanNumeral(root, trainerState.currentKey, chordType) || '';

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
        octaveShift: 0,
        lhOmittedNotes: [],
        roman: roman
    };

    // Add to the end of the progression
    const updatedProgression = [...trainerState.progressionData, newChordData];

    // Update state
    setProgressionData(updatedProgression);

    // Re-render both progression displays
    renderProgressionDisplay('progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

    // Update unified suggestions
    if (window.updateUnifiedSuggestions) {
        window.updateUnifiedSuggestions();
    }
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
        // Get the canvas
        const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
        if (interactiveCanvas) {
            // Use setTimeout to ensure DOM updates are complete
            setTimeout(() => {
                // Check if we're in interactive mode (recording) or just showing chords
                if (window.isInteractiveMode && window.renderInteractiveMelodyStaff) {
                    window.renderInteractiveMelodyStaff(interactiveCanvas);
                } else if (window.renderChordProgressionStaff) {
                    window.renderChordProgressionStaff(interactiveCanvas);
                }
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
    renderProgressionDisplay();
    
    // Update UI
    updateProgressionControlsUI();
}

export function removeChordFromProgression(index) {
    const trainerState = getTrainerState();

    if (trainerState.isPlaying) handleAutoPlayback();

    // Save state before removing
    saveStateBeforeChange();

    trainerState.progressionData.splice(index, 1);
    trainerState.progressionRomans.splice(index, 1);
    
    // Re-render both tabs to ensure synchronization
    // First render the main progression builder
    renderProgressionDisplay('progression-visualization', true);
    // Then render the melody composer tab (syncBothTabs=false to avoid infinite recursion)
    renderProgressionDisplay('melody-progression-visualization', false);
    
    // Auto-render melody notation if on Melody Composer tab or if Free mode is active
    renderMelodyNotationIfNeeded();
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

    // Re-render the progression display to update the UI (checkbox states, etc.)
    // This ensures the UI reflects the current state, especially important after ottava shifts
    renderProgressionDisplay('progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

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
    
    // Auto-render melody notation if on Melody Composer tab or if Free mode is active
    // This needs to happen after re-rendering the progression display
    renderMelodyNotationIfNeeded();
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

    // Re-render the progression display to update the UI (checkbox states, etc.)
    // This ensures the UI reflects the current state, especially important after ottava shifts
    renderProgressionDisplay('progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

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
    
    // Auto-render melody notation if on Melody Composer tab or if Free mode is active
    // This needs to happen after re-rendering the progression display
    renderMelodyNotationIfNeeded();
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
        renderProgressionDisplay();

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

    // Populate progression selector
    progressionSelect.innerHTML = '';
    Object.keys(COMMON_PROGRESSIONS).forEach(progName => {
        const option = document.createElement('option');
        option.value = COMMON_PROGRESSIONS[progName].join(',');
        option.textContent = progName;
        if (progName === 'I-IV-V-I (Basic)') option.selected = true;
        progressionSelect.appendChild(option);
    });

    // Add event listeners
    keySelect.onchange = () => loadProgression();
    progressionSelect.onchange = () => loadProgression();
    
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
        renderProgressionDisplay();
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
    renderProgressionDisplay();

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
    let chordType = 'Major'; // default
    if (typeAndExtensions.startsWith('m') && !typeAndExtensions.startsWith('maj')) {
        chordType = 'Minor';
    } else if (typeAndExtensions.includes('dim')) {
        chordType = 'Diminished';
    } else if (typeAndExtensions.includes('aug')) {
        chordType = 'Augmented';
    } else if (typeAndExtensions.includes('sus')) {
        chordType = typeAndExtensions.includes('sus2') ? 'Sus2' : 'Sus4';
    } else if (typeAndExtensions.includes('7')) {
        if (typeAndExtensions.includes('maj7') || typeAndExtensions.includes('M7')) {
            chordType = 'Major 7th';
        } else if (typeAndExtensions.startsWith('m7')) {
            chordType = 'Minor 7th';
        } else {
            chordType = 'Dominant 7th';
        }
    } else if (typeAndExtensions.includes('9')) {
        if (typeAndExtensions.includes('maj9') || typeAndExtensions.includes('M9')) {
            chordType = 'Major 9th';
        } else if (typeAndExtensions.startsWith('m9')) {
            chordType = 'Minor 9th';
        } else {
            chordType = 'Dominant 9th';
        }
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
            lhType: 'off',
            lhInversion: 0,
            lhOctaveShift: -12,
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
