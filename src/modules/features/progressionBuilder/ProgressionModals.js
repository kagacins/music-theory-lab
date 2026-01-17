/**
 * ProgressionModals.js
 *
 * Phase 1.3 of progressionBuilder.js refactoring (GROUP E: MODAL FUNCTIONS ~1,500 lines)
 *
 * This module contains all modal and dialog-related functions from progressionBuilder.js:
 * - Recommendation modals (chord suggestions)
 * - Style/Mood suggestion controls and insights panel
 * - Section management modals (add, edit, delete, duplicate sections)
 * - Quick chord picker for adding chords to sections
 * - Warning/confirmation dialogs (truncation warnings)
 *
 * Extracted from progressionBuilder.js to reduce file size and improve maintainability.
 */

// ============================================================================
// IMPORTS - State Management
// ============================================================================

import {
    getTrainerState,
    setProgressionData,
    setTrainerChordNotes,
    getProgressionData,
    setSuggestionStyle,
    getSuggestionStyle,
    setSuggestionMood,
    getSuggestionMood,
    setStyleMoodSuggestions,
    setTensionProfile,
    getSelectedIndicesArray,
    clearSelection,
    invalidateProgressionDataCache
} from '../../state/trainerState.js';

import {
    getNotationPreference
} from '../../state/globalState.js';

import {
    getInsertAfterIndex,
    getSectionIntent,
    setSectionIntent,
    INTENT_MODES
} from '../../state/sectionIntentState.js';

// ============================================================================
// IMPORTS - Audio
// ============================================================================

import {
    getInstrument,
    getAudioIsReady
} from '../../audio/audioEngine.js';

// ============================================================================
// IMPORTS - Utilities
// ============================================================================

import {
    getInvertedChordNotes,
    getLHNotes
} from '../../utils/noteUtils.js';

import { noteToRomanNumeral } from '../../utils/romanNumerals.js';

import {
    saveState,
    pushToUndoStack
} from '../../utils/undoRedo.js';

// ============================================================================
// IMPORTS - Music Data & Theory
// ============================================================================

import {
    STYLE_PRESETS,
    MOOD_PRESETS,
    generateStyleMoodSuggestions,
    analyzeTension
} from '../chordSuggestionEngine.js';

// ============================================================================
// IMPORTS - UI Components
// ============================================================================

import { showUnifiedRecommendationModal } from '../../ui/recommendations/UnifiedRecommendationModal/index.js';

import { dispatchBuilderEvent, isGuidedModeActive } from '../../ui/lessonGuidedMode.js';

import { showPromptModal, showConfirmModal } from '../../ui/modals.js';

// ============================================================================
// IMPORTS - Cross-module dependencies
// ============================================================================

import { renderProgressionDisplay, updateSingleCard } from './ProgressionRenderer.js';
import {
    getKeyBasedEnharmonic,
    addToProgressionData,
    getProgressionChordNotes,
    selectChordCard,
    captureProgressionState,
    updateProgressionControlsUI
} from './ProgressionController.js';
import { getChordFunction } from '../../../data/theoryExplanations/chordFunctions.js';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get style preset by ID
 * @param {string} id - Style preset ID
 * @returns {Object} Style preset object
 */
function getStylePresetById(id) {
    return STYLE_PRESETS.find(preset => preset.id === id) || STYLE_PRESETS[0];
}

/**
 * Get mood preset by ID
 * @param {string} id - Mood preset ID
 * @returns {Object} Mood preset object
 */
function getMoodPresetById(id) {
    return MOOD_PRESETS.find(preset => preset.id === id) || MOOD_PRESETS[0];
}

/**
 * Get scale notes for a given key
 * @param {string} key - Musical key (e.g., 'C', 'Dm')
 * @returns {Array<string>} Array of note names in the scale
 */
export function getScaleNotesForKey(key) {
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
 * Convert tension value to color for visualization
 * @param {number} value - Tension value (0-1)
 * @returns {string} HSL color string
 */
function tensionToColor(value) {
    const clamped = Math.min(Math.max(value, 0), 1);
    const hue = 120 - Math.round(clamped * 120);
    return `hsl(${hue}, 68%, 48%)`;
}

// ============================================================================
// STYLE/MOOD CONTROLS & SUGGESTIONS
// ============================================================================

/**
 * Initialize style and mood dropdown controls
 */
export function initializeStyleMoodControls() {
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

/**
 * Update style and mood description text displays
 */
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

/**
 * Update the suggestion context display with current progression info
 * @param {Object} context - Suggestion context (lastRoman, normalizedLast, etc.)
 * @param {boolean} hasSuggestions - Whether suggestions are available
 */
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

    // TODO: getChordFunction needs to be imported
    const functionLabel = getChordFunction ? getChordFunction(context.normalizedLast) : 'Neutral';
    const statusText = hasSuggestions
        ? 'Suggestions tuned to continue the current harmonic flow.'
        : 'Adjust your style or mood to discover fresh directions.';

    contextBody.innerHTML = `Last chord <span class="font-mono font-semibold text-indigo-600">${context.lastRoman}</span> leans <span class="font-semibold">${functionLabel}</span>. ${statusText}`;
    contextMeta.textContent = `${stylePreset.label} · ${moodPreset.label}`;
}

/**
 * Render the style/mood suggestion list
 * @param {Array} suggestions - Array of suggestion objects
 * @param {Object} context - Suggestion context
 */
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

/**
 * Render tension visualization track
 * @param {Object} analysis - Tension analysis result
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
 * Add a suggested chord to the progression
 * @param {Object} suggestion - Suggestion object with roman, chordType
 */
function addSuggestedChordToProgression(suggestion) {
    if (!suggestion) return;

    const trainerState = getTrainerState();
    const currentKey = trainerState.currentKey || 'C';
    const keyForCalculation = currentKey.endsWith('m') ? currentKey.replace(/m$/, '') : currentKey;
    const octaveShift = trainerState.octaveShift || 0;

    // TODO: getProgressionChordNotes needs to be imported
    if (!getProgressionChordNotes) {
        console.warn('[addSuggestedChordToProgression] getProgressionChordNotes not available');
        return;
    }

    const chordData = getProgressionChordNotes(
        keyForCalculation,
        suggestion.roman,
        suggestion.chordType,
        0,
        octaveShift
    );

    if (!chordData) {
        if (window.showToast) {
            window.showToast(`Unable to generate chord for ${suggestion.roman}`, { type: 'error' });
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

    // TODO: addToProgressionData needs to be imported
    if (addToProgressionData) {
        addToProgressionData(chordData);
    }

    const display = document.getElementById('progression-chord-notes-display');
    if (display) {
        display.textContent = `Added suggested chord: ${suggestion.roman} (${suggestion.chordType})`;
    }
}

/**
 * Refresh style/mood insights panel with new suggestions and tension analysis
 * @param {boolean} force - Force refresh even if panel is hidden
 */
export function refreshStyleMoodInsights(force = false) {
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

/**
 * Toggle the Style/Mood Insights panel visibility
 * EXPORTED - Called from window handlers
 */
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

// ============================================================================
// SECTION MANAGEMENT MODALS
// ============================================================================

/**
 * Show menu to add a new section
 * Window-exported function
 * @param {Event} event - Click event
 * @param {string} containerId - Container ID
 */
export function showAddSectionMenu(event, containerId) {
    console.log('[Section] showAddSectionMenu called', { containerId });
    event.stopPropagation();

    // Check if any chords are selected
    const selectedIndices = getSelectedIndicesArray ? getSelectedIndicesArray() : [];
    console.log('[Section] Selected indices:', selectedIndices);

    if (selectedIndices.length === 0) {
        console.log('[Section] No chords selected - showing warning');
        // Show a message to the user
        if (window.showToast) {
            window.showToast('Please select one or more chords to create a Section', { type: 'warning' });
        }
        return;
    }

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    console.log('[Section] CompositionState:', compositionState ? 'found' : 'NOT FOUND');
    if (!compositionState) return;

    const sectionTypes = compositionState.constructor.SECTION_TYPES;
    console.log('[Section] Section types:', Object.keys(sectionTypes));

    // Remove existing menu if any
    const existingMenu = document.querySelector('.section-type-menu');
    if (existingMenu) existingMenu.remove();

    // Create menu
    const menu = document.createElement('div');
    // Use z-[9995] to appear above fullscreen overlay (z-[9990])
    // CRITICAL: pointer-events: auto is required for clicks to work in fullscreen mode
    menu.className = 'section-type-menu fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]';
    menu.style.zIndex = '9995';
    menu.style.pointerEvents = 'auto';

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

    // Dispatch event for tutorial system
    dispatchBuilderEvent('addSectionMenuOpened', { containerId });

    // Close menu on outside click
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

/**
 * Create a new section (optionally with selected chords)
 * Only allows adjacent chords to be grouped
 * @param {string} type - Section type
 * @param {string} containerId - Container ID
 */
function createNewSection(type, containerId) {
    console.log('[Section] createNewSection called', { type, containerId });

    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    console.log('[Section] CompositionState in createNewSection:', compositionState ? 'found' : 'NOT FOUND');
    if (!compositionState) return;

    // Get selected chord indices (already sorted)
    const selectedIndices = getSelectedIndicesArray();
    console.log('[Section] Selected indices for new section:', selectedIndices);

    // If we have selected indices, validate they are adjacent
    if (selectedIndices.length > 1) {
        console.log('[Section] Checking adjacency for multiple selections');
        // Check for adjacency - each index should be exactly 1 more than the previous
        for (let i = 1; i < selectedIndices.length; i++) {
            if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
                console.log('[Section] Non-adjacent selection detected - blocking section creation');

                // Show toast notification explaining the requirement
                if (window.showToast) {
                    window.showToast('Sections can only be created from consecutive chords. Please select adjacent chord cards.', { type: 'warning', duration: 4000 });
                } else if (window.showNotification) {
                    window.showNotification('Sections can only be created from consecutive chords. Please select adjacent chord cards.', 'warning');
                }

                // Do NOT create a section - just return
                console.log('[Section] Section creation blocked due to non-consecutive selection');
                return;
            }
        }
    }

    // All indices are adjacent (or single/empty) - create section
    console.log('[Section] All indices adjacent or single - creating section');
    console.log('[Section] Calling compositionState.createSection');
    compositionState.createSection(type, selectedIndices);

    // Switch to Section view when creating a section
    console.log('[Section] Switching to Section view');
    if (window.setProgressionViewMode) {
        window.setProgressionViewMode('section');
    }

    // Clear selection
    console.log('[Section] Clearing selection');
    clearSelection();

    // Re-render to show the new section
    console.log('[Section] Re-rendering progression display');
    renderProgressionDisplay('melody-progression-visualization', true);

    // Dispatch event for tutorial validation
    dispatchBuilderEvent('chordsGrouped', { groupName: type, chordIndices: selectedIndices });
    console.log('[Section] Section creation complete!');
}

/**
 * Toggle section collapse state
 * Window-exported function
 * @param {string} sectionId - Section ID
 */
export function toggleSectionCollapse(sectionId) {
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) return;

    const section = compositionState.getSection(sectionId);
    if (!section) return;

    compositionState.updateSection(sectionId, { collapsed: !section.collapsed });

    // Re-render
    // TODO: renderProgressionDisplay needs to be imported
    if (renderProgressionDisplay) {
        renderProgressionDisplay('melody-progression-visualization', true);
    }
}

/**
 * Edit section label inline or via prompt dialog
 * Window-exported function
 * @param {string} sectionId - Section ID
 * @param {HTMLElement} [labelElement] - Label element to edit (optional - will use prompt if not provided)
 */
export function editSectionLabel(sectionId, labelElement) {
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
        showPromptModal({
            title: 'Rename Section',
            message: 'Enter new section name:',
            defaultValue: currentLabel,
            placeholder: 'e.g., Verse, Chorus, Bridge...',
            confirmText: 'Rename',
        }).then(newLabel => {
            if (newLabel !== null && newLabel.trim() !== '') {
                compositionState.updateSection(sectionId, { label: newLabel.trim() });
                // TODO: renderProgressionDisplay needs to be imported
                if (renderProgressionDisplay) {
                    renderProgressionDisplay('melody-progression-visualization', true);
                }
            }
        });
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
        // TODO: renderProgressionDisplay needs to be imported
        if (renderProgressionDisplay) {
            renderProgressionDisplay('melody-progression-visualization', true);
        }
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
        console.warn('[editSectionLabel] Inline editing failed, using modal:', err);
        // Fallback to modal prompt
        showPromptModal({
            title: 'Rename Section',
            message: 'Enter new section name:',
            defaultValue: currentLabel,
            placeholder: 'e.g., Verse, Chorus, Bridge...',
            confirmText: 'Rename',
        }).then(newLabel => {
            if (newLabel !== null && newLabel.trim() !== '') {
                compositionState.updateSection(sectionId, { label: newLabel.trim() });
                // TODO: renderProgressionDisplay needs to be imported
                if (renderProgressionDisplay) {
                    renderProgressionDisplay('melody-progression-visualization', true);
                }
            }
        });
    }
}

/**
 * Show section context menu
 * Window-exported function
 * @param {Event} event - Click event
 * @param {string} sectionId - Section ID
 */
export function showSectionMenu(event, sectionId) {
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
    // Use z-[9995] to appear above fullscreen overlay (z-[9990])
    // CRITICAL: pointer-events: auto is required for clicks to work in fullscreen mode
    menu.className = 'section-context-menu fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]';
    menu.style.zIndex = '9995';
    menu.style.pointerEvents = 'auto';

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
            editSectionLabel(sectionId);
        }},
        { label: 'Change Type', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z', action: () => {
            // Show section type picker dialog
            showChangeSectionTypeDialog(sectionId, section.type, compositionState);
        }},
        { label: 'Duplicate', icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z', action: () => {
            // Show duplication options dialog
            showDuplicateSectionDialog(sectionId, section.label, compositionState);
        }},
        { label: 'Delete Section', icon: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16', action: async () => {
            const confirmed = await showConfirmModal({
                title: 'Delete Section',
                message: `Delete "${section.label}"? Chords will become ungrouped.`,
                confirmText: 'Delete',
                danger: false
            });
            if (confirmed) {
                compositionState.deleteSection(sectionId);
                if (renderProgressionDisplay) {
                    renderProgressionDisplay('melody-progression-visualization', true);
                }
            }
        }, danger: false },
        { label: 'Delete Section & Chords', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', action: async () => {
            const chordCount = section.chordIndices?.length || 0;
            const confirmed = await showConfirmModal({
                title: 'Delete Section & Chords',
                message: `Delete "${section.label}" AND its ${chordCount} chord(s)? This cannot be undone.`,
                confirmText: 'Delete All',
                danger: true
            });
            if (confirmed) {
                deleteSectionAndChords(sectionId, compositionState);
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

    // Dispatch event for tutorial system
    dispatchBuilderEvent('sectionMenuOpened', { sectionId });

    // Close menu on outside click
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

/**
 * Show dialog to change section type
 * Window-exported function
 * @param {string} sectionId - Section ID
 * @param {string} currentType - Current section type
 * @param {Object} compositionState - Composition state instance
 */
export function showChangeSectionTypeDialog(sectionId, currentType, compositionState) {
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

    // Create overlay - use z-[9995] to appear above fullscreen overlay (z-[9990])
    // CRITICAL: pointer-events: auto is required for clicks to work in fullscreen mode
    const overlay = document.createElement('div');
    overlay.className = 'change-section-type-dialog-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
    overlay.style.zIndex = '9995';
    overlay.style.pointerEvents = 'auto';

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
            // TODO: renderProgressionDisplay needs to be imported
            if (renderProgressionDisplay) {
                renderProgressionDisplay('melody-progression-visualization', true);
            }
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
}

/**
 * Delete a section and all its chords
 * Window-exported function
 * @param {string} sectionId - Section ID to delete
 * @param {Object} compositionState - Composition state instance
 */
export function deleteSectionAndChords(sectionId, compositionState) {
    const section = compositionState.getSection(sectionId);
    if (!section) return;

    // Get chord indices to delete (in reverse order to avoid index shifting issues)
    const chordIndicesToDelete = [...section.chordIndices].sort((a, b) => b - a);

    // Save state for undo
    // TODO: saveStateBeforeChange may need to be imported or handled differently
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
    // TODO: renderProgressionDisplay needs to be imported
    if (renderProgressionDisplay) {
        renderProgressionDisplay('melody-progression-visualization', true);
    }

    // Update notation
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    } else if (window.getNotationComposer) {
        const notationComposer = window.getNotationComposer();
        if (notationComposer) {
            notationComposer.render();
        }
    }
}

/**
 * Show dialog for section duplication options
 * Window-exported function
 * @param {string} sectionId - Section ID to duplicate
 * @param {string} sectionLabel - Section label for display
 * @param {Object} compositionState - Composition state instance
 */
export function showDuplicateSectionDialog(sectionId, sectionLabel, compositionState) {
    // Remove existing dialog if any
    const existingDialog = document.querySelector('.duplicate-section-dialog-overlay');
    if (existingDialog) existingDialog.remove();

    // Create overlay - use z-[9995] to appear above fullscreen overlay (z-[9990])
    // CRITICAL: pointer-events: auto is required for clicks to work in fullscreen mode
    const overlay = document.createElement('div');
    overlay.className = 'duplicate-section-dialog-overlay fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center';
    overlay.style.zIndex = '9995';
    overlay.style.pointerEvents = 'auto';

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

    // Dispatch event for tutorial system
    dispatchBuilderEvent('duplicateDialogOpened', { sectionId, sectionLabel });

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

        // Invalidate cache to ensure render sees the updated progression data
        invalidateProgressionDataCache();

        // TODO: renderProgressionDisplay needs to be imported
        if (renderProgressionDisplay) {
            renderProgressionDisplay('melody-progression-visualization', true);
        }

        // Dispatch event for tutorial validation
        dispatchBuilderEvent('groupDuplicated', { sectionId, mode });
    };
}

// ============================================================================
// CHORD RECOMMENDATION MODAL
// ============================================================================

/**
 * Show progression chord suggestions modal
 * EXPORTED - Main recommendation modal entry point
 * @param {number} chordIndex - Index of chord to show recommendations for
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

        // Get full chord information using getInvertedChordNotes (use null to derive enharmonic from key)
        const result = getInvertedChordNotes(
            nextRoot,
            nextChordType,
            nextInversion,
            key,
            0, // octaveShift
            null, // derive enharmonic from key
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
        // TODO: captureProgressionState needs to be imported
        if (captureProgressionState) {
            const currentState = captureProgressionState();
            saveState(currentState);
        }

        // Insert after current chord
        progression.splice(chordIndex + 1, 0, nextChordData);

        // Update state
        setProgressionData(progression);

        // Re-render
        // TODO: renderProgressionDisplay and updateProgressionControlsUI need to be imported
        if (renderProgressionDisplay) {
            renderProgressionDisplay('melody-progression-visualization', true);
        }
        if (updateProgressionControlsUI) {
            updateProgressionControlsUI();
        }
    };

    // Track currently playing notes for release
    let currentlyPlayingNotes = [];

    // Callback to preview a chord (starts playing)
    const onPlayChord = (chordType, root, inversion) => {
        try {
            // Get chord notes using the same method as Chord Builder (use null to derive enharmonic from key)
            const key = trainerState.currentKey || root;
            const res = getInvertedChordNotes(
                root,
                chordType,
                inversion,
                key,
                0, // octaveShift
                null, // derive enharmonic from key
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
            console.warn('[onPlayChord] Error playing chord:', error);
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

// ============================================================================
// QUICK CHORD PICKER (for adding chords to sections)
// ============================================================================

/**
 * Open a quick chord picker for adding to a section
 * @param {string} sectionId - Section ID
 * @param {Object} section - Section object
 * @param {number} insertAfterIndex - Index to insert after
 */
function openQuickChordPicker(sectionId, section, insertAfterIndex) {
    // Create a modal with common chord options for quick adding
    const existingModal = document.getElementById('quick-chord-picker-modal');
    if (existingModal) existingModal.remove();

    const trainerState = getTrainerState();
    const currentKey = trainerState.currentKey || 'C';

    // Generate common chords in the current key
    const commonRoots = getScaleNotesForKey(currentKey);
    const commonTypes = ['Major', 'Minor', 'Major 7th', 'Minor 7th', 'Dominant 7th'];

    const modal = document.createElement('div');
    modal.id = 'quick-chord-picker-modal';
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full m-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between" style="background-color: ${section.color || '#6366f1'}20">
                <div class="flex items-center gap-2">
                    <span class="text-lg font-bold text-gray-900 dark:text-white">Add Chord to ${section.label || 'Section'}</span>
                </div>
                <button class="close-modal-btn p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors text-gray-500">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
            </div>
            <div class="p-4 overflow-y-auto">
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Key: <strong>${currentKey}</strong> — Select a chord to add:</p>
                <div class="grid grid-cols-4 gap-2 mb-4">
                    ${commonRoots.slice(0, 8).map((root, i) => {
                        // Determine chord type based on scale degree
                        const isMinor = [1, 2, 5].includes(i); // ii, iii, vi are minor in major key
                        const type = isMinor ? 'Minor' : 'Major';
                        const display = root + (isMinor ? 'm' : '');
                        return `
                            <button class="quick-chord-btn px-3 py-2 rounded-lg border-2 border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all text-center"
                                    data-root="${root}" data-type="${type}">
                                <span class="font-bold text-gray-900 dark:text-white">${display}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
                <details class="mb-3">
                    <summary class="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">More chord types...</summary>
                    <div class="grid grid-cols-3 gap-2 mt-2">
                        ${commonRoots.slice(0, 6).flatMap(root =>
                            ['Major 7th', 'Minor 7th', 'Dominant 7th'].map(type => {
                                const suffix = type === 'Major 7th' ? 'maj7' : type === 'Minor 7th' ? 'm7' : '7';
                                return `
                                    <button class="quick-chord-btn px-2 py-1.5 rounded border border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all text-center text-sm"
                                            data-root="${root}" data-type="${type}">
                                        <span class="text-gray-900 dark:text-white">${root}${suffix}</span>
                                    </button>
                                `;
                            })
                        ).join('')}
                    </div>
                </details>
                <div class="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <button class="open-full-builder-btn text-sm text-blue-600 dark:text-blue-400 hover:underline">
                        Open Full Chord Builder
                    </button>
                    <button class="close-modal-btn px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Handle chord selection
    modal.querySelectorAll('.quick-chord-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const root = btn.dataset.root;
            const type = btn.dataset.type;

            // Add chord via the standard flow (will use section intent)
            if (window.addChordToProgressionByParams) {
                window.addChordToProgressionByParams(type, root, 0, 0);
            }

            modal.remove();
        });
    });

    // Handle "Open Full Chord Builder"
    const openBuilderBtn = modal.querySelector('.open-full-builder-btn');
    if (openBuilderBtn) {
        openBuilderBtn.addEventListener('click', () => {
            modal.remove();
            // Switch to Chord Builder tab
            if (window.switchTab) {
                window.switchTab('builder');
            }
        });
    }

    // Handle close buttons
    modal.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', () => modal.remove());
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

/**
 * Add a chord directly to a specific section
 * Used by placeholder slots in Section View mode
 * EXPORTED - Called from section placeholder UI
 * @param {string} sectionId - The section ID to add the chord to
 */
export function addChordToSection(sectionId) {
    // Get the composition state and find the section
    const compositionState = window.getCompositionState?.();
    if (!compositionState) {
        console.warn('[addChordToSection] No composition state available');
        return;
    }

    const section = compositionState.getSection?.(sectionId);
    if (!section) {
        console.warn('[addChordToSection] Section not found:', sectionId);
        return;
    }

    // Calculate insertion index based on section position
    // For sections with chords, insert after the last chord in the section
    // For empty placeholder sections, calculate position based on section order
    let insertAfterIndex = -1; // Default: insert at beginning

    if (section.chordIndices && section.chordIndices.length > 0) {
        // Section has chords - insert after the last one
        insertAfterIndex = Math.max(...section.chordIndices);
    } else {
        // Empty placeholder section - find the right position based on template order
        const allSections = compositionState.getSections?.() || [];
        const sectionIndex = allSections.findIndex(s => s.id === sectionId);

        if (sectionIndex > 0) {
            // Find the previous section's last chord index
            for (let i = sectionIndex - 1; i >= 0; i--) {
                const prevSection = allSections[i];
                if (prevSection.chordIndices && prevSection.chordIndices.length > 0) {
                    insertAfterIndex = Math.max(...prevSection.chordIndices);
                    break;
                }
            }
        }
    }

    // Set up the section intent so when a chord is added, it goes to this section
    setSectionIntent({
        mode: INTENT_MODES.CONTINUE,
        targetSection: section,
        insertAfterIndex: insertAfterIndex,
        needsSelection: false
    });

    // Scroll to and highlight the Builder tab to add a chord
    // Or open a quick chord picker modal
    openQuickChordPicker(sectionId, section, insertAfterIndex);
}

// ============================================================================
// WARNING/CONFIRMATION DIALOGS
// ============================================================================

/**
 * Show truncation warning dialog when chord duration change will affect notes
 * @param {Object} truncationInfo - Info about what will be truncated
 * @param {Function} onConfirm - Callback when user confirms
 * @param {Function} onCancel - Callback when user cancels
 */
export function showTruncationWarningDialog(truncationInfo, onConfirm, onCancel) {
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
        <div id="truncation-warning-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[700]">
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

// ============================================================================
// INITIALIZATION FUNCTION FOR CROSS-MODULE DEPENDENCIES
// ============================================================================

/**
 * Initialize cross-module function dependencies
 * This should be called from progressionBuilder.js after all modules are loaded
 * @param {Object} deps - Object containing function dependencies
 */
export function initializeModalDependencies(deps) {
    getKeyBasedEnharmonic = deps.getKeyBasedEnharmonic;
    getChordFunction = deps.getChordFunction;
    addToProgressionData = deps.addToProgressionData;
    renderProgressionDisplay = deps.renderProgressionDisplay;
    updateProgressionControlsUI = deps.updateProgressionControlsUI;
    updateSingleCard = deps.updateSingleCard;
    captureProgressionState = deps.captureProgressionState;
    selectChordCard = deps.selectChordCard;
    getProgressionChordNotes = deps.getProgressionChordNotes;
}

// ============================================================================
// WINDOW EXPORTS (for HTML onclick handlers)
// ============================================================================

// Export to window for HTML event handlers
window.showAddSectionMenu = showAddSectionMenu;
window.toggleSectionCollapse = toggleSectionCollapse;
window.editSectionLabel = editSectionLabel;
window.showSectionMenu = showSectionMenu;
window.showChangeSectionTypeDialog = showChangeSectionTypeDialog;
window.deleteSectionAndChords = deleteSectionAndChords;
window.showDuplicateSectionDialog = showDuplicateSectionDialog;
window.showProgressionChordSuggestions = showProgressionChordSuggestions;
window.toggleStyleMoodInsightsPanel = toggleStyleMoodInsightsPanel;
