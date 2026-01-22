/**
 * Melody Tab Renderer for Unified Recommendation Modal
 *
 * Handles melody generation and suggestion UI including:
 * - Notes View: Single note suggestions with scoring and categorization
 * - Phrases View: Complete melodic phrase suggestions with contour and rhythm control
 * - Section-aware generation: Adapts to chord selection and section context
 */

// ============================================================================
// IMPORTS
// ============================================================================

// External data and utilities
import { CHORD_DEFINITIONS } from '../../../../data/music-data.js';
import { spellNoteInKey } from '../../../utils/noteUtils.js';
import { beatsToDuration } from '../../../notation/durationUtils.js';

// Melody suggestion engine
import {
    generateMelodySuggestions,
    MELODY_STYLE_PRESETS,
    MELODY_CONTOUR_PRESETS
} from '../../../ai/melodySuggestion.js';

// Phrase generation engine
import {
    generatePhraseCandidates,
    CONTOUR_SHAPE_LIST,
    PHRASE_LENGTH_LIST,
    RHYTHM_PATTERN_LIST
} from '../../../ai/melodicPhraseGenerator.js';

// State management
import { getCompositionState } from '../../../state/compositionState.js';
import {
    getCurrentKey,
    getProgressionData
} from '../../../state/trainerState.js';
import {
    getSectionIntent,
    INTENT_MODES,
    getEffectiveSectionContext
} from '../../../state/sectionIntentState.js';

// Notation rendering
import { createRenderer } from '../../../notation/vexFlowRenderer.js';
import { renderGrandStaffMeasure } from '../../../notation/grandStaff.js';

// Import from parent modal modules
import { modalState, MELODY_VIEWS } from './ModalState.js';
import {
    getScoreQualityLabel,
    showMelodyScoreTooltip,
    hideMelodyScoreTooltip,
    showPhraseScoreTooltip,
    hidePhraseScoreTooltip
} from './MusicUtils.js';
import { updatePersistentProgressionBar } from './StructureBuilders.js';

// ============================================================================
// CONSTANTS
// ============================================================================

// Category colors for melody suggestions
const MELODY_CATEGORY_COLORS = {
    chordTone: { bg: '#dcfce7', text: '#166534' },
    scaleTone: { bg: '#dbeafe', text: '#1e40af' },
    stepwiseMotion: { bg: '#cffafe', text: '#0e7490' },
    approachTone: { bg: '#fef3c7', text: '#92400e' },
    passingTone: { bg: '#fed7aa', text: '#9a3412' },
    tension: { bg: '#e9d5ff', text: '#7c3aed' },
    avoid: { bg: '#fee2e2', text: '#dc2626' }
};

// ============================================================================
// MELODY TAB - MAIN ENTRY POINT
// ============================================================================

function renderMelodyTab(container) {
    // Clear the container first to prevent duplicate content
    container.innerHTML = '';

    const progressionData = getProgressionData() || [];
    const key = getCurrentKey() || 'C';

    // Sync melody chord selection with the main Progression picker
    // This ensures the Melody tab responds to chord selection changes
    const hasProgressionMultiSelect = modalState.selectedProgressionStart >= 0 &&
        modalState.selectedProgressionEnd >= 0 &&
        modalState.selectedProgressionStart !== modalState.selectedProgressionEnd;

    // Track if selection changed to trigger regeneration
    const prevStart = modalState.melodySelectedChordStart;
    const prevEnd = modalState.melodySelectedChordEnd;

    if (hasProgressionMultiSelect) {
        // Multi-chord selection from Progression picker - sync to melody state
        modalState.melodySelectedChordStart = modalState.selectedProgressionStart;
        modalState.melodySelectedChordEnd = modalState.selectedProgressionEnd;
        // Auto-switch to section mode when multiple chords are selected
        modalState.melodyPositionMode = 'section';
    } else if (modalState.selectedProgressionIndex >= 0) {
        // Single chord selection from Progression picker - sync to melody state
        modalState.melodySelectedChordStart = modalState.selectedProgressionIndex;
        modalState.melodySelectedChordEnd = -1;
        // Auto-switch to section mode when any chord is selected (including N.C.)
        modalState.melodyPositionMode = 'section';
    }

    // Clear cached phrases if selection changed - forces regeneration
    const selectionChanged = prevStart !== modalState.melodySelectedChordStart ||
        prevEnd !== modalState.melodySelectedChordEnd;
    if (selectionChanged) {
        modalState.currentPhraseCandidates = [];
    }

    const selectedIndex = modalState.melodySelectedChordStart >= 0
        ? modalState.melodySelectedChordStart
        : (modalState.selectedProgressionIndex >= 0 ? modalState.selectedProgressionIndex : progressionData.length - 1);
    const currentChord = progressionData[selectedIndex] || null;

    // View toggle (Notes vs Phrases)
    const viewToggle = document.createElement('div');
    viewToggle.style.cssText = `
        display: flex;
        gap: 4px;
        padding: 4px;
        background: #f3f4f6;
        border-radius: 8px;
        margin-bottom: 16px;
    `;
    viewToggle.innerHTML = `
        <button id="melody-view-notes" class="melody-view-btn" data-view="${MELODY_VIEWS.NOTES}" style="
            flex: 1;
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            background: ${modalState.melodyView === MELODY_VIEWS.NOTES ? 'white' : 'transparent'};
            color: ${modalState.melodyView === MELODY_VIEWS.NOTES ? '#1e293b' : '#6b7280'};
            box-shadow: ${modalState.melodyView === MELODY_VIEWS.NOTES ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};
        ">
            Single Notes
        </button>
        <button id="melody-view-phrases" class="melody-view-btn" data-view="${MELODY_VIEWS.PHRASES}" style="
            flex: 1;
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            background: ${modalState.melodyView === MELODY_VIEWS.PHRASES ? 'white' : 'transparent'};
            color: ${modalState.melodyView === MELODY_VIEWS.PHRASES ? '#1e293b' : '#6b7280'};
            box-shadow: ${modalState.melodyView === MELODY_VIEWS.PHRASES ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};
        ">
            Phrases
        </button>
    `;
    container.appendChild(viewToggle);

    // Set up view toggle listeners
    viewToggle.querySelectorAll('.melody-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modalState.melodyView = btn.dataset.view;
            localStorage.setItem('unified-modal-melody-view', btn.dataset.view);
            renderMelodyTab(container);
        });
    });

    // Context display (shared between views)
    const contextSection = document.createElement('div');
    contextSection.style.cssText = `
        display: flex;
        gap: 16px;
        padding: 12px 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        margin-bottom: 16px;
        font-size: 13px;
        flex-wrap: wrap;
    `;

    // Build context display based on single vs multi-chord selection
    const melodySpelledRoot = currentChord ? spellNoteInKey(currentChord.root, key) : null;
    const isMultiChordSelected = modalState.melodySelectedChordEnd >= 0 &&
        modalState.melodySelectedChordEnd !== modalState.melodySelectedChordStart;

    let chordDisplay, positionDisplay;
    if (isMultiChordSelected) {
        const startIdx = Math.min(modalState.melodySelectedChordStart, modalState.melodySelectedChordEnd);
        const endIdx = Math.max(modalState.melodySelectedChordStart, modalState.melodySelectedChordEnd);
        const count = endIdx - startIdx + 1;
        const startChord = progressionData[startIdx];
        const endChord = progressionData[endIdx];
        const startSpelled = startChord ? spellNoteInKey(startChord.root, key) : '?';
        const endSpelled = endChord ? spellNoteInKey(endChord.root, key) : '?';
        chordDisplay = `${startSpelled} → ${endSpelled}`;
        positionDisplay = `<span style="color: var(--rm-primary);">${count} chords (#${startIdx + 1} - #${endIdx + 1})</span>`;
    } else {
        chordDisplay = currentChord ? `${melodySpelledRoot} ${currentChord.type}` : 'None selected';
        positionDisplay = selectedIndex >= 0 ? `Chord #${selectedIndex + 1}` : 'End';
    }

    contextSection.innerHTML = `
        <div>
            <span style="color: #6b7280;">Chord${isMultiChordSelected ? 's' : ''}:</span>
            <span style="font-weight: 600; color: #374151; margin-left: 4px;">
                ${chordDisplay}
            </span>
        </div>
        <div>
            <span style="color: #6b7280;">Key:</span>
            <span style="font-weight: 600; color: #374151; margin-left: 4px;">${key}</span>
        </div>
        <div>
            <span style="color: #6b7280;">Position:</span>
            <span style="font-weight: 600; color: #374151; margin-left: 4px;">
                ${positionDisplay}
            </span>
        </div>
    `;
    container.appendChild(contextSection);

    // Render appropriate view
    if (modalState.melodyView === MELODY_VIEWS.NOTES) {
        renderMelodyNotesView(container, currentChord, key);
    } else {
        renderMelodyPhrasesView(container, currentChord, key);
    }
}

// ============================================================================
// MELODY NOTES VIEW (Single Note Suggestions)
// ============================================================================

function renderMelodyNotesView(container, currentChord, key) {
    // Check if multiple chords are selected - suggest switching to Phrases view
    const isMultiChordSelected = modalState.melodySelectedChordEnd >= 0 &&
        modalState.melodySelectedChordEnd !== modalState.melodySelectedChordStart;

    if (isMultiChordSelected) {
        const rangeCount = Math.abs(modalState.melodySelectedChordEnd - modalState.melodySelectedChordStart) + 1;
        const infoBox = document.createElement('div');
        infoBox.style.cssText = `
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 16px;
            font-size: 13px;
            color: #1e40af;
        `;
        infoBox.innerHTML = `
            <strong>💡 Tip:</strong> You have ${rangeCount} chords selected. Single notes are shown for the first chord.
            Switch to <strong>Phrases</strong> view to generate melodies across all ${rangeCount} chords.
        `;
        container.appendChild(infoBox);
    }

    // Build the controls section for single notes
    const controlsSection = document.createElement('div');
    controlsSection.style.cssText = `
        display: flex;
        gap: 12px;
        padding: 12px 16px;
        background: #f9fafb;
        border-radius: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
        align-items: center;
    `;

    // Create contour control
    const contourDiv = document.createElement('div');
    contourDiv.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const contourLabel = document.createElement('label');
    contourLabel.style.cssText = 'font-size: 13px; color: #6b7280;';
    contourLabel.textContent = 'Contour:';
    contourDiv.appendChild(contourLabel);

    const contourSelect = document.createElement('select');
    contourSelect.id = 'melody-contour-select';
    contourSelect.style.cssText = 'padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white;';
    MELODY_CONTOUR_PRESETS.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.label;
        if (p.id === modalState.melodyContourId) option.selected = true;
        contourSelect.appendChild(option);
    });
    contourSelect.addEventListener('change', () => {
        modalState.melodyContourId = contourSelect.value;
        localStorage.setItem('melody-suggestion-contour', contourSelect.value);
        refreshMelodySuggestions();
    });
    contourDiv.appendChild(contourSelect);
    controlsSection.appendChild(contourDiv);

    // Create octave control
    const octaveDiv = document.createElement('div');
    octaveDiv.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const octaveLabel = document.createElement('label');
    octaveLabel.style.cssText = 'font-size: 13px; color: #6b7280;';
    octaveLabel.textContent = 'Octave:';
    octaveDiv.appendChild(octaveLabel);

    const octaveSelect = document.createElement('select');
    octaveSelect.id = 'melody-octave-select';
    octaveSelect.style.cssText = 'padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white;';
    [3, 4, 5, 6].forEach(o => {
        const option = document.createElement('option');
        option.value = o;
        option.textContent = o;
        if (o === modalState.melodyOctave) option.selected = true;
        octaveSelect.appendChild(option);
    });
    octaveSelect.addEventListener('change', () => {
        modalState.melodyOctave = parseInt(octaveSelect.value, 10);
        localStorage.setItem('melody-suggestion-octave', octaveSelect.value);
        refreshMelodySuggestions();
    });
    octaveDiv.appendChild(octaveSelect);
    controlsSection.appendChild(octaveDiv);

    container.appendChild(controlsSection);

    // Suggestions container - no nested scrolling, let modal body handle scroll
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.id = 'melody-suggestions-container';
    suggestionsContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;
    container.appendChild(suggestionsContainer);

    // Generate and display suggestions
    if (currentChord) {
        generateAndDisplayMelodySuggestions(suggestionsContainer, currentChord, key);
    } else {
        suggestionsContainer.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #6b7280;">
                <div style="font-size: 32px; margin-bottom: 12px;">🎵</div>
                <p style="margin: 0;">Add a chord to your progression to see melody suggestions</p>
            </div>
        `;
    }
    // Event listeners are now attached directly to the select elements above
}

// ============================================================================
// MELODY PHRASES VIEW (Phrase Suggestions)
// ============================================================================

function renderMelodyPhrasesView(container, currentChord, key) {
    // CRITICAL: Clear container to prevent duplicate content on re-render
    container.innerHTML = '';

    // Get progression data for section mode
    const progressionData = getProgressionData() || [];
    const compositionState = getCompositionState();
    const sections = compositionState?.getSections?.() || [];

    // Check if we're in "New Section" mode - user should be able to set duration
    const intent = getSectionIntent();
    const isNewSectionMode = intent.mode === INTENT_MODES.NEW_SECTION;

    const isEndMode = modalState.melodyPositionMode === 'end';
    const isSectionMode = modalState.melodyPositionMode === 'section';

    // In section mode, pre-select a chord only if nothing is selected yet
    // Don't override user's manual selection in the modal
    if (isSectionMode && progressionData.length > 0 && modalState.melodySelectedChordStart < 0) {
        // Try to get the currently selected chord index from the composition
        let currentSelectedIdx = -1;

        // Method 1: Check modalState.selectedProgressionIndex (used by chord tab)
        if (modalState.selectedProgressionIndex >= 0 && modalState.selectedProgressionIndex < progressionData.length) {
            currentSelectedIdx = modalState.selectedProgressionIndex;
        }

        // Method 2: Try to get from composition state
        if (currentSelectedIdx < 0 && compositionState?.getSelectedChordIndex) {
            const compSelectedIdx = compositionState.getSelectedChordIndex();
            if (compSelectedIdx >= 0 && compSelectedIdx < progressionData.length) {
                currentSelectedIdx = compSelectedIdx;
            }
        }

        // Method 3: Find matching chord in progression data
        if (currentSelectedIdx < 0 && currentChord) {
            for (let i = 0; i < progressionData.length; i++) {
                const pd = progressionData[i];
                if (pd.root === currentChord.root && pd.type === currentChord.type) {
                    currentSelectedIdx = i;
                    break;
                }
            }
        }

        // Method 4: Default to first chord if nothing else works
        if (currentSelectedIdx < 0) {
            currentSelectedIdx = 0;
        }

        // Set initial selection
        modalState.melodySelectedChordStart = currentSelectedIdx;
        modalState.melodySelectedChordEnd = -1; // Single chord selection
    }

    // Position Mode Toggle (Add to End vs Add for Section) - compact version
    const positionModeSection = document.createElement('div');
    positionModeSection.style.cssText = `
        display: flex;
        gap: 2px;
        padding: 2px;
        background: #e5e7eb;
        border-radius: 6px;
        margin-bottom: 8px;
    `;

    positionModeSection.innerHTML = `
        <button id="melody-pos-end" class="melody-pos-btn" data-mode="end" style="
            flex: 1;
            padding: 5px 10px;
            border: ${isEndMode ? '1px solid #3b82f6' : '1px solid transparent'};
            border-radius: 4px;
            font-size: 11px;
            font-weight: ${isEndMode ? '600' : '500'};
            cursor: pointer;
            transition: all 0.15s ease;
            background: ${isEndMode ? 'white' : 'transparent'};
            color: ${isEndMode ? '#3b82f6' : '#6b7280'};
        ">
            Add to End
        </button>
        <button id="melody-pos-section" class="melody-pos-btn" data-mode="section" style="
            flex: 1;
            padding: 5px 10px;
            border: ${isSectionMode ? '1px solid #3b82f6' : '1px solid transparent'};
            border-radius: 4px;
            font-size: 11px;
            font-weight: ${isSectionMode ? '600' : '500'};
            cursor: pointer;
            transition: all 0.15s ease;
            background: ${isSectionMode ? 'white' : 'transparent'};
            color: ${isSectionMode ? '#3b82f6' : '#6b7280'};
        ">
            Add for Section
        </button>
    `;
    container.appendChild(positionModeSection);

    // Section Mode: Show current selection info and direct to Progression picker
    if (isSectionMode) {
        const selectorWrapper = document.createElement('div');
        selectorWrapper.style.cssText = `
            margin-bottom: 8px;
            padding: 6px 10px;
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            border-radius: 6px;
        `;

        // Calculate selection info
        const hasSelection = modalState.melodySelectedChordStart >= 0;
        const isMultiChord = modalState.melodySelectedChordEnd >= 0 &&
            modalState.melodySelectedChordEnd !== modalState.melodySelectedChordStart;
        const startIdx = hasSelection ? Math.min(modalState.melodySelectedChordStart, modalState.melodySelectedChordEnd >= 0 ? modalState.melodySelectedChordEnd : modalState.melodySelectedChordStart) : -1;
        const endIdx = hasSelection ? Math.max(modalState.melodySelectedChordStart, modalState.melodySelectedChordEnd >= 0 ? modalState.melodySelectedChordEnd : modalState.melodySelectedChordStart) : -1;
        const selectionCount = hasSelection ? (endIdx - startIdx + 1) : 0;

        // Calculate total duration of selected chords
        const getSelectedDuration = () => {
            if (!hasSelection) return 0;
            let totalBeats = 0;
            for (let i = startIdx; i <= endIdx; i++) {
                if (progressionData[i]) {
                    // Support multiple duration property names (beats, duration, durationBeats)
                    const chordDuration = progressionData[i].beats ?? progressionData[i].duration ?? progressionData[i].durationBeats ?? 4;
                    totalBeats += chordDuration;
                }
            }
            return totalBeats;
        };

        const totalBeats = getSelectedDuration();

        const selectorLabel = document.createElement('div');
        selectorLabel.style.cssText = 'font-size: 11px; font-weight: 600; color: #1e40af;';
        if (hasSelection) {
            if (isMultiChord) {
                selectorLabel.innerHTML = `🎼 Generating melody for <strong>${selectionCount} chords</strong> (#${startIdx + 1} - #${endIdx + 1}) · ${totalBeats} beats`;
            } else {
                const chord = progressionData[startIdx];
                const spelledRoot = chord ? spellNoteInKey(chord.root, key) : '?';
                const chordDef = CHORD_DEFINITIONS[chord?.type];
                const symbol = chordDef?.symbol || '';
                selectorLabel.innerHTML = `🎼 Generating melody for <strong>${spelledRoot}${symbol}</strong> (#${startIdx + 1}) · ${totalBeats} beats`;
            }
        } else {
            selectorLabel.textContent = '🎼 Select chord(s) from the Progression picker above';
        }
        selectorWrapper.appendChild(selectorLabel);
        container.appendChild(selectorWrapper);
    }

    // Set up position mode toggle listeners AFTER the section selector is added
    positionModeSection.querySelectorAll('.melody-pos-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modalState.melodyPositionMode = btn.dataset.mode;
            localStorage.setItem('melody-position-mode', btn.dataset.mode);
            modalState.currentPhraseCandidates = []; // Clear cached phrases
            // Reset selection when switching to "Add to End" mode
            if (btn.dataset.mode === 'end') {
                modalState.melodySelectedChordStart = -1;
                modalState.melodySelectedChordEnd = -1;
                // Also clear the main Progression picker selection
                modalState.selectedProgressionStart = -1;
                modalState.selectedProgressionEnd = -1;
                updatePersistentProgressionBar();
            } else if (btn.dataset.mode === 'section') {
                // When switching to section mode, sync from Progression picker
                if (modalState.selectedProgressionIndex >= 0) {
                    modalState.melodySelectedChordStart = modalState.selectedProgressionIndex;
                    if (modalState.selectedProgressionStart >= 0 && modalState.selectedProgressionEnd >= 0) {
                        modalState.melodySelectedChordStart = modalState.selectedProgressionStart;
                        modalState.melodySelectedChordEnd = modalState.selectedProgressionEnd;
                    }
                }
            }
            // Re-render with the same container
            renderMelodyPhrasesView(container, currentChord, key);
        });
    });

    // Build the controls section for phrases - organized in logical groups
    const controlsSection = document.createElement('div');
    controlsSection.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
        padding: 12px 16px;
        background: #f9fafb;
        border-radius: 8px;
        margin-bottom: 16px;
    `;

    // Get contour, length, and rhythm options from imported lists
    const contourOptions = CONTOUR_SHAPE_LIST || [
        { id: 'ascending', label: 'Ascending' },
        { id: 'descending', label: 'Descending' },
        { id: 'arch', label: 'Arch' },
        { id: 'invertedArch', label: 'Inverted Arch' },
        { id: 'wave', label: 'Wave' },
        { id: 'plateau', label: 'Plateau' },
        { id: 'static', label: 'Static' }
    ];

    const lengthOptions = PHRASE_LENGTH_LIST || [
        { id: 'short', label: '2 beats' },
        { id: 'medium', label: '4 beats' },
        { id: 'long', label: '8 beats' },
        { id: 'extended', label: '16 beats' }
    ];

    const rhythmOptions = RHYTHM_PATTERN_LIST || [
        { id: 'steady', label: 'Steady' },
        { id: 'longShort', label: 'Long-Short' },
        { id: 'shortLong', label: 'Short-Long' },
        { id: 'syncopated', label: 'Syncopated' },
        { id: 'accelerating', label: 'Accelerating' },
        { id: 'decelerating', label: 'Decelerating' }
    ];

    // Ordered to reflect typical song structure from beginning to end
    const sectionTypes = [
        { id: 'intro', label: 'Intro' },
        { id: 'verse', label: 'Verse' },
        { id: 'prechorus', label: 'Pre-Chorus' },
        { id: 'chorus', label: 'Chorus' },
        { id: 'bridge', label: 'Bridge' },
        { id: 'outro', label: 'Outro' }
    ];

    const densityOptions = [
        { value: 0.5, label: 'Sparse' },       // Half notes (2 notes per 4 beats)
        { value: 0.75, label: 'Light' },       // Mix of half/quarter (3 notes per 4 beats)
        { value: 1.0, label: 'Normal' },       // Quarter notes (4 notes per 4 beats)
        { value: 1.5, label: 'Dense' },        // Mix of quarter/eighth (6 notes per 4 beats)
        { value: 2.0, label: 'Very Dense' },   // Eighth notes (8 notes per 4 beats)
        { value: 3.0, label: 'Rapid' }         // Mix with 16ths (12 notes per 4 beats)
    ];

    // Rhythm patterns that have explicit note values (density doesn't apply)
    const explicitNoteValuePatterns = ['even8th', 'even16th'];
    const isDensityDisabled = explicitNoteValuePatterns.includes(modalState.phraseRhythmId);
    const densityDisabledInfo = {
        'even8th': 'Fixed: 8th notes',
        'even16th': 'Fixed: 16th notes'
    }[modalState.phraseRhythmId] || '';

    const rangeOptions = [
        { value: 5, label: 'Narrow (5st)' },
        { value: 8, label: 'Medium (8st)' },
        { value: 12, label: 'Octave (12st)' },
        { value: 17, label: 'Wide (17st)' },
        { value: 24, label: '2 Octaves' }
    ];

    const selectStyle = `padding: 5px 8px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 12px; background: white; min-width: 80px;`;
    const disabledSelectStyle = `padding: 5px 8px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12px; background: #f3f4f6; min-width: 80px; color: #9ca3af; cursor: not-allowed;`;
    const labelStyle = `font-size: 12px; color: #6b7280; white-space: nowrap;`;
    const controlGroupStyle = `display: flex; align-items: center; gap: 6px;`;

    // Determine if duration should be fixed (section mode with chord(s) selected)
    // BUT: In "New Section" mode, user should always be able to set duration
    const startIdx = modalState.melodySelectedChordStart;
    const endIdx = modalState.melodySelectedChordEnd >= 0 ? modalState.melodySelectedChordEnd : startIdx;
    const minChordIdx = Math.min(startIdx, endIdx);
    const maxChordIdx = Math.max(startIdx, endIdx);
    const hasChordSelected = minChordIdx >= 0 && minChordIdx < progressionData.length;

    // Duration is editable in: end mode, new section mode, or when no chord selected
    // Duration is fixed only in: section mode with chord selected AND NOT in new section mode
    const isDurationEditable = isEndMode || isNewSectionMode || !hasChordSelected;
    const isSectionModeWithChord = isSectionMode && hasChordSelected && !isNewSectionMode;

    // Calculate fixed duration from selected chord(s) if in section mode (not new section)
    let fixedDurationBeats = null;
    let sectionDurationInfo = '';
    if (isSectionModeWithChord) {
        // Sum durations of all selected chords
        fixedDurationBeats = 0;
        for (let i = minChordIdx; i <= maxChordIdx && i < progressionData.length; i++) {
            // Support multiple duration property names (beats, duration, durationBeats)
            const chordDuration = progressionData[i].beats ?? progressionData[i].duration ?? progressionData[i].durationBeats ?? 4;
            fixedDurationBeats += chordDuration;
        }
        const numChords = maxChordIdx - minChordIdx + 1;
        if (numChords === 1) {
            sectionDurationInfo = `${fixedDurationBeats} beats`;
        } else {
            sectionDurationInfo = `${fixedDurationBeats} beats (${numChords} chords)`;
        }
    }

    // Auto-detect section type from first selected chord's section
    let autoDetectedSectionType = null;
    if (isSectionModeWithChord) {
        const selectedSections = sections.filter(s => s.chordIndices?.includes(minChordIdx));
        if (selectedSections[0]) {
            autoDetectedSectionType = selectedSections[0].type || selectedSections[0].label?.toLowerCase();
        }
    }

    // Melody style options (from MELODY_STYLE_PRESETS)
    const melodyStyleOptions = MELODY_STYLE_PRESETS || [
        { id: 'any', label: 'Balanced' },
        { id: 'pop', label: 'Pop / Top 40' },
        { id: 'jazz', label: 'Jazz' },
        { id: 'classical', label: 'Classical' },
        { id: 'rock', label: 'Rock / Blues' }
    ];

    // Group styling
    const groupStyle = `
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 10px;
    `;
    const groupHeaderStyle = `
        font-size: 10px;
        font-weight: 600;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
    `;
    const groupContentStyle = `
        display: flex;
        flex-direction: column;
        gap: 6px;
    `;
    const controlRowStyle = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    `;

    controlsSection.innerHTML = `
        <!-- Group 1: Character -->
        <div style="${groupStyle}">
            <div style="${groupHeaderStyle}">Character</div>
            <div style="${groupContentStyle}">
                <div style="${controlRowStyle}">
                    <label style="${labelStyle}">Section</label>
                    <select id="phrase-section-select" style="${selectStyle}" ${autoDetectedSectionType ? 'title="Auto-detected from selected chord"' : ''}>
                        ${sectionTypes.map(s => `
                            <option value="${s.id}" ${s.id === (autoDetectedSectionType || modalState.phraseSectionType) ? 'selected' : ''}>${s.label}</option>
                        `).join('')}
                    </select>
                </div>
                <div style="${controlRowStyle}">
                    <label style="${labelStyle}">Contour</label>
                    <select id="phrase-contour-select" style="${selectStyle}">
                        ${contourOptions.map(p => `
                            <option value="${p.id}" ${p.id === modalState.phraseContourId ? 'selected' : ''}>${p.label}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
        </div>
        <!-- Group 2: Timing & Rhythm -->
        <div style="${groupStyle}">
            <div style="${groupHeaderStyle}">Timing & Rhythm</div>
            <div style="${groupContentStyle}">
                <div style="${controlRowStyle}" ${!isDurationEditable ? 'title="Duration is determined by the selected chord/section"' : ''}>
                    <label style="${labelStyle}">Duration</label>
                    ${!isDurationEditable ? `
                        <span style="padding: 4px 8px; background: #e5e7eb; border-radius: 4px; font-size: 11px; color: #4b5563; font-weight: 500;">
                            ${sectionDurationInfo}
                        </span>
                    ` : `
                        <select id="phrase-length-select" style="${selectStyle}">
                            ${lengthOptions.map(p => `
                                <option value="${p.id}" ${p.id === modalState.phraseLengthId ? 'selected' : ''}>${p.label}</option>
                            `).join('')}
                        </select>
                    `}
                </div>
                <div style="${controlRowStyle}">
                    <label style="${labelStyle}">Rhythm</label>
                    <select id="phrase-rhythm-select" style="${selectStyle}">
                        ${rhythmOptions.map(p => `
                            <option value="${p.id}" ${p.id === modalState.phraseRhythmId ? 'selected' : ''}>${p.label}</option>
                        `).join('')}
                    </select>
                </div>
                <div style="${controlRowStyle}" ${isDensityDisabled ? 'title="Density is fixed by the selected rhythm pattern"' : ''}>
                    <label style="${labelStyle}">Density</label>
                    ${isDensityDisabled ? `
                        <span style="padding: 4px 8px; background: #e5e7eb; border-radius: 4px; font-size: 11px; color: #6b7280; font-weight: 500;">
                            ${densityDisabledInfo}
                        </span>
                    ` : `
                        <select id="phrase-density-select" style="${selectStyle}">
                            ${densityOptions.map(d => `
                                <option value="${d.value}" ${d.value === modalState.phraseDensity ? 'selected' : ''}>${d.label}</option>
                            `).join('')}
                        </select>
                    `}
                </div>
            </div>
        </div>
        <!-- Group 3: Pitch Range -->
        <div style="${groupStyle}">
            <div style="${groupHeaderStyle}">Pitch Range</div>
            <div style="${groupContentStyle}">
                <div style="${controlRowStyle}">
                    <label style="${labelStyle}">Range</label>
                    <select id="phrase-range-select" style="${selectStyle}">
                        ${rangeOptions.map(r => `
                            <option value="${r.value}" ${r.value === modalState.phraseRange ? 'selected' : ''}>${r.label}</option>
                        `).join('')}
                    </select>
                </div>
                <div style="${controlRowStyle}">
                    <label style="${labelStyle}">Octave</label>
                    <select id="phrase-octave-select" style="${selectStyle}">
                        ${[2, 3, 4, 5, 6].map(o => `
                            <option value="${o}" ${o === modalState.phraseOctave ? 'selected' : ''}>${o}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
        </div>
    `;
    container.appendChild(controlsSection);

    // Phrases container - no nested scrolling, let modal body handle scroll
    const phrasesContainer = document.createElement('div');
    phrasesContainer.id = 'phrase-suggestions-container';
    phrasesContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 12px;
    `;
    container.appendChild(phrasesContainer);

    // Set up phrase control listeners (pass container for re-rendering on rhythm change)
    setupPhraseControlListeners(currentChord, key, phrasesContainer, container);

    // Generate initial phrases or show prompt
    if (currentChord) {
        if (modalState.currentPhraseCandidates.length > 0) {
            displayPhraseCandidates(phrasesContainer, modalState.currentPhraseCandidates);
        } else {
            generateAndDisplayPhrases(phrasesContainer, currentChord, key);
        }
    } else {
        phrasesContainer.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #6b7280;">
                <div style="font-size: 32px; margin-bottom: 12px;">🎼</div>
                <p style="margin: 0;">Add a chord to your progression to generate melodic phrases</p>
            </div>
        `;
    }
}

function setupPhraseControlListeners(currentChord, key, phrasesContainer, mainContainer) {
    const styleSelect = document.getElementById('phrase-style-select');
    const sectionSelect = document.getElementById('phrase-section-select');
    const contourSelect = document.getElementById('phrase-contour-select');
    const lengthSelect = document.getElementById('phrase-length-select');
    const rhythmSelect = document.getElementById('phrase-rhythm-select');
    const densitySelect = document.getElementById('phrase-density-select');
    const rangeSelect = document.getElementById('phrase-range-select');
    const octaveSelect = document.getElementById('phrase-octave-select');

    // Helper to update state and auto-regenerate
    const updateAndRegenerate = () => {
        if (currentChord) {
            generateAndDisplayPhrases(phrasesContainer, currentChord, key);
        }
    };

    // Note: Genre selector removed - melody now uses global Style setting

    if (sectionSelect) {
        sectionSelect.addEventListener('change', () => {
            modalState.phraseSectionType = sectionSelect.value;
            localStorage.setItem('phrase-section-type', sectionSelect.value);
            updateAndRegenerate();
        });
    }

    if (contourSelect) {
        contourSelect.addEventListener('change', () => {
            modalState.phraseContourId = contourSelect.value;
            localStorage.setItem('phrase-contour', contourSelect.value);
            updateAndRegenerate();
        });
    }

    if (lengthSelect) {
        lengthSelect.addEventListener('change', () => {
            modalState.phraseLengthId = lengthSelect.value;
            localStorage.setItem('phrase-length', lengthSelect.value);
            updateAndRegenerate();
        });
    }

    if (rhythmSelect) {
        rhythmSelect.addEventListener('change', () => {
            modalState.phraseRhythmId = rhythmSelect.value;
            localStorage.setItem('phrase-rhythm', rhythmSelect.value);
            // Clear cached phrases so new rhythm is applied
            modalState.currentPhraseCandidates = [];
            // Re-render the entire view to update density control state
            // (density is disabled for explicit note value patterns like even8th/even16th)
            if (mainContainer) {
                renderMelodyPhrasesView(mainContainer, currentChord, key);
            } else {
                updateAndRegenerate();
            }
        });
    }

    if (densitySelect) {
        densitySelect.addEventListener('change', () => {
            modalState.phraseDensity = parseFloat(densitySelect.value);
            localStorage.setItem('phrase-density', densitySelect.value);
            updateAndRegenerate();
        });
    }

    if (rangeSelect) {
        rangeSelect.addEventListener('change', () => {
            modalState.phraseRange = parseInt(rangeSelect.value, 10);
            localStorage.setItem('phrase-range', rangeSelect.value);
            updateAndRegenerate();
        });
    }

    if (octaveSelect) {
        octaveSelect.addEventListener('change', () => {
            modalState.phraseOctave = parseInt(octaveSelect.value, 10);
            localStorage.setItem('phrase-octave', octaveSelect.value);
            updateAndRegenerate();
        });
    }
}

function generateAndDisplayPhrases(container, chord, key) {
    // Show loading state
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 32px; color: #6b7280;">
            <div style="width: 20px; height: 20px; border: 2px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 12px;"></div>
            <span>Generating phrases...</span>
        </div>
    `;

    try {
        // Get context for section-aware generation
        const progressionData = getProgressionData() || [];
        const compositionState = getCompositionState();
        const sections = compositionState?.getSections?.() || [];
        const isSectionMode = modalState.melodyPositionMode === 'section';

        // Handle chord range selection (supports multiple consecutive chords)
        const startIdx = modalState.melodySelectedChordStart;
        const endIdx = modalState.melodySelectedChordEnd >= 0 ? modalState.melodySelectedChordEnd : startIdx;
        const minChordIdx = Math.min(startIdx, endIdx);
        const maxChordIdx = Math.max(startIdx, endIdx);
        const isSectionModeWithChord = isSectionMode && minChordIdx >= 0 && minChordIdx < progressionData.length;

        // Determine target beats and section context
        let targetBeats = null;
        let sectionContext = null;
        let effectiveSectionType = modalState.phraseSectionType;
        let chordSequence = null; // For multi-chord phrases

        if (isSectionModeWithChord) {
            // Calculate total duration from all selected chords
            // Check for 'beats' (trainer state), 'duration', or 'durationBeats' (composition state)
            targetBeats = 0;
            chordSequence = [];
            for (let i = minChordIdx; i <= maxChordIdx && i < progressionData.length; i++) {
                const chordData = progressionData[i];
                // Support multiple duration property names and fractional beats
                const chordDuration = chordData.beats ?? chordData.duration ?? chordData.durationBeats ?? 4;
                targetBeats += chordDuration;
                chordSequence.push({
                    chord: chordData,
                    duration: chordDuration,
                    beats: chordDuration,
                    index: i
                });
            }

            // Auto-detect section type from first selected chord's section
            const selectedSections = sections.filter(s => s.chordIndices?.includes(minChordIdx));
            if (selectedSections[0]) {
                const sectionType = selectedSections[0].type || selectedSections[0].label?.toLowerCase();
                if (sectionType) {
                    effectiveSectionType = sectionType;
                }
            }

            // Build section context for context-aware generation
            // Get previous melody notes (if any)
            const previousMelody = compositionState?.getMelodyNotesBeforeChord?.(minChordIdx) || [];

            // Get next chords for look-ahead (after the selection)
            const nextChords = progressionData.slice(maxChordIdx + 1, maxChordIdx + 3);

            sectionContext = {
                previousMelody: previousMelody.slice(-8), // Last 8 notes for context
                nextChords: nextChords,
                sectionType: effectiveSectionType,
                chordIndex: minChordIdx,
                chordEndIndex: maxChordIdx,
                totalChords: progressionData.length,
                chordSequence: chordSequence
            };

            // Use the first selected chord as the primary chord
            chord = progressionData[minChordIdx];
        }

        // Use the global style from modal state, falling back to section-based style
        const sectionStyleMap = {
            verse: 'pop',
            chorus: 'pop',
            bridge: 'jazz',
            intro: 'classical',
            outro: 'pop',
            prechorus: 'pop'
        };
        // Use global style setting (from context bar), fall back to section-based mapping
        const styleId = modalState.style || sectionStyleMap[effectiveSectionType] || 'balanced';

        const candidates = generatePhraseCandidates({
            chord,
            key,
            contourId: modalState.phraseContourId,
            lengthId: modalState.phraseLengthId,
            rhythmId: modalState.phraseRhythmId,
            styleId: styleId,
            mood: modalState.mood, // Pass mood for style-aware generation
            octave: modalState.phraseOctave,
            range: modalState.phraseRange,
            densityMultiplier: modalState.phraseDensity,
            targetBeats: targetBeats, // Pass custom target beats for section mode
            sectionContext: sectionContext, // Pass section context
            chordSequence: chordSequence // Pass chord sequence for multi-chord phrases
        }, 5);

        // Verify phrase durations match target (should already be correct from generator)
        if (isSectionModeWithChord && targetBeats !== null) {
            candidates.forEach((phrase, idx) => {
                if (!phrase.rhythm) return;
                const actualBeats = phrase.rhythm.reduce((sum, r) => sum + r, 0);
                if (Math.abs(actualBeats - targetBeats) > 0.01) {
                    console.warn(`Phrase ${idx + 1}: expected ${targetBeats} beats, got ${actualBeats.toFixed(2)}`);
                }
            });
        }

        modalState.currentPhraseCandidates = candidates;
        displayPhraseCandidates(container, candidates, key);

    } catch (error) {
        console.error('Error generating phrases:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #ef4444;">
                <p>Error generating phrases. Please try again.</p>
            </div>
        `;
    }
}

function displayPhraseCandidates(container, candidates, key) {
    container.innerHTML = '';

    if (!candidates || candidates.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #6b7280;">
                <p>No phrases generated. Try different settings.</p>
            </div>
        `;
        return;
    }

    // Get key for proper enharmonic spelling
    const currentKey = key || getCurrentKey() || 'C';

    candidates.forEach((phrase, index) => {
        const phraseCard = createPhraseCard(phrase, index, currentKey);
        container.appendChild(phraseCard);
    });
}

function createPhraseCard(phrase, index, key) {
    const card = document.createElement('div');
    card.className = 'phrase-card';
    const phraseKey = key || getCurrentKey() || 'C';
    card.style.cssText = `
        padding: 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
    `;

    // Build note display with key-aware spelling
    const notes = phrase.notes || [];
    const noteDisplay = notes.map(n => {
        const match = n.match(/^([A-G][#b]?)(\d+)$/);
        if (match) {
            const spelledNote = spellNoteInKey(match[1], phraseKey);
            return `<span style="
                display: inline-block;
                padding: 4px 8px;
                background: #eff6ff;
                color: #1e40af;
                border-radius: 4px;
                font-family: monospace;
                font-size: 13px;
                margin: 2px;
            ">${spelledNote}<sub style="font-size: 10px;">${match[2]}</sub></span>`;
        }
        return `<span style="padding: 4px 8px; background: #f3f4f6; border-radius: 4px; margin: 2px;">${n}</span>`;
    }).join('');

    // Contour visualization (simple SVG representation)
    const contourSvg = createContourVisualization(phrase);

    // Score color and quality
    const score = phrase.phraseScore || 0;
    const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#6b7280';
    const quality = getScoreQualityLabel(score);

    // Calculate total duration in beats
    const rhythm = phrase.rhythm || notes.map(() => 1);
    const totalBeats = rhythm.reduce((sum, r) => sum + r, 0);
    const beatsDisplay = totalBeats % 1 === 0 ? totalBeats : totalBeats.toFixed(1);

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    height: 24px;
                    background: #e5e7eb;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #4b5563;
                ">${index + 1}</span>
                <span style="font-size: 13px; color: #6b7280;">
                    ${phrase.contour || 'arch'} | ${phrase.rhythmPattern || 'steady'}
                </span>
                <span style="
                    padding: 2px 6px;
                    background: #dbeafe;
                    color: #1e40af;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                " title="Total duration: ${beatsDisplay} beats (${notes.length} notes)">${beatsDisplay}b</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <button class="play-phrase-btn" data-index="${index}" style="
                    padding: 6px 12px;
                    background: white;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                ">&#9654; Play</button>
                <span class="phrase-score-interactive"
                    data-score="${score}"
                    data-quality="${quality.label}"
                    data-contour="${phrase.contour || 'arch'}"
                    data-length="${phrase.length || 'medium'}"
                    data-rhythm="${phrase.rhythmPattern || 'steady'}"
                    data-note-count="${notes.length}"
                    data-total-beats="${beatsDisplay}"
                    style="
                    padding: 4px 8px;
                    background: ${scoreColor}20;
                    color: ${scoreColor};
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: help;
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                ">${score}%</span>
            </div>
        </div>
        <div class="phrase-contour-view" style="margin-bottom: 12px; display: ${modalState.phraseViewMode === 'staff' ? 'none' : 'block'};">
            ${contourSvg}
        </div>
        <div class="phrase-staff-view" style="margin-bottom: 12px; display: ${modalState.phraseViewMode === 'staff' ? 'block' : 'none'};">
            <div class="phrase-staff-container" style="
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                padding: 8px;
                height: 180px;
                display: flex;
                align-items: center;
                justify-content: center;
            "></div>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${noteDisplay}
        </div>
        <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button class="toggle-view-btn" data-index="${index}" style="
                padding: 8px 12px;
                background: white;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
            " title="Toggle between line graph and grand staff view">${modalState.phraseViewMode === 'staff' ? '📈 Graph' : '🎼 Staff'}</button>
            <button class="apply-phrase-btn" data-index="${index}" style="
                flex: 1;
                padding: 8px 16px;
                background: #0ea5e9;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
            ">Apply Phrase</button>
        </div>
    `;

    // Hover effects
    card.addEventListener('mouseenter', () => {
        card.style.borderColor = '#3b82f6';
        card.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.15)';
    });
    card.addEventListener('mouseleave', () => {
        card.style.borderColor = '#e5e7eb';
        card.style.boxShadow = 'none';
    });

    // Play button - use mousedown for immediate playback (consistent with rest of site)
    const playBtn = card.querySelector('.play-phrase-btn');
    playBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        playBtn.style.transform = 'scale(0.95)';
        playBtn.style.opacity = '0.8';
        playPhrase(phrase);
    });
    playBtn.addEventListener('mouseup', () => {
        playBtn.style.transform = '';
        playBtn.style.opacity = '';
    });
    playBtn.addEventListener('mouseleave', () => {
        playBtn.style.transform = '';
        playBtn.style.opacity = '';
    });

    // Add phrase score tooltip handlers
    const phraseScoreBadge = card.querySelector('.phrase-score-interactive');
    if (phraseScoreBadge) {
        phraseScoreBadge.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
            showPhraseScoreTooltip(e, phraseScoreBadge);
        });
        phraseScoreBadge.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
            hidePhraseScoreTooltip();
        });
    }

    // Toggle view button (line graph vs grand staff)
    const toggleBtn = card.querySelector('.toggle-view-btn');
    const contourView = card.querySelector('.phrase-contour-view');
    const staffView = card.querySelector('.phrase-staff-view');

    // If starting in staff view mode, render the staff immediately
    if (modalState.phraseViewMode === 'staff') {
        const staffContainer = card.querySelector('.phrase-staff-container');
        if (staffContainer && !staffContainer.dataset.rendered) {
            renderPhraseGrandStaff(staffContainer, phrase);
            staffContainer.dataset.rendered = 'true';
        }
    }

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Toggle the global view mode
        const newMode = modalState.phraseViewMode === 'staff' ? 'graph' : 'staff';
        modalState.phraseViewMode = newMode;

        // Update ALL phrase cards to reflect the new mode
        document.querySelectorAll('.phrase-card').forEach(phraseCard => {
            const cardContourView = phraseCard.querySelector('.phrase-contour-view');
            const cardStaffView = phraseCard.querySelector('.phrase-staff-view');
            const cardToggleBtn = phraseCard.querySelector('.toggle-view-btn');

            if (newMode === 'staff') {
                if (cardContourView) cardContourView.style.display = 'none';
                if (cardStaffView) cardStaffView.style.display = 'block';
                if (cardToggleBtn) cardToggleBtn.innerHTML = '📈 Graph';

                // Render grand staff if not already rendered
                const staffContainer = phraseCard.querySelector('.phrase-staff-container');
                if (staffContainer && !staffContainer.dataset.rendered) {
                    // Get phrase data from the card's index
                    const cardIndex = parseInt(phraseCard.querySelector('.toggle-view-btn')?.dataset.index || '0');
                    const phraseData = modalState.currentPhraseCandidates[cardIndex];
                    if (phraseData) {
                        renderPhraseGrandStaff(staffContainer, phraseData);
                        staffContainer.dataset.rendered = 'true';
                    }
                }
            } else {
                if (cardContourView) cardContourView.style.display = 'block';
                if (cardStaffView) cardStaffView.style.display = 'none';
                if (cardToggleBtn) cardToggleBtn.innerHTML = '🎼 Staff';
            }
        });
    });

    // Apply button
    const applyBtn = card.querySelector('.apply-phrase-btn');
    applyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        applyPhrase(phrase);
    });

    return card;
}

function createContourVisualization(phrase) {
    const notes = phrase.notes || [];
    if (notes.length < 2) return '';

    // Convert notes to MIDI numbers for visualization
    const midiNumbers = notes.map(n => {
        const match = n.match(/^([A-G])([#b]?)(\d+)$/);
        if (!match) return 60;
        const noteNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const noteIndex = noteNames.indexOf(match[1]);
        const octave = parseInt(match[3]);
        let midi = (octave + 1) * 12 + [0, 2, 4, 5, 7, 9, 11][noteIndex];
        if (match[2] === '#') midi += 1;
        if (match[2] === 'b') midi -= 1;
        return midi;
    });

    const minMidi = Math.min(...midiNumbers);
    const maxMidi = Math.max(...midiNumbers);
    const range = maxMidi - minMidi || 1;

    const width = 280;
    const height = 40;
    const padding = 4;

    const points = midiNumbers.map((midi, i) => {
        const x = padding + (i / (midiNumbers.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((midi - minMidi) / range) * (height - 2 * padding);
        return `${x},${y}`;
    }).join(' ');

    return `
        <svg width="${width}" height="${height}" style="display: block;">
            <polyline
                points="${points}"
                fill="none"
                stroke="#3b82f6"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
            ${midiNumbers.map((midi, i) => {
                const x = padding + (i / (midiNumbers.length - 1)) * (width - 2 * padding);
                const y = height - padding - ((midi - minMidi) / range) * (height - 2 * padding);
                return `<circle cx="${x}" cy="${y}" r="3" fill="#3b82f6" />`;
            }).join('')}
        </svg>
    `;
}

function renderPhraseGrandStaff(container, phrase) {
    const notes = phrase.notes || [];
    const rhythm = phrase.rhythm || notes.map(() => 1); // Default to quarter notes

    if (notes.length === 0) {
        container.innerHTML = '<div style="color: #6b7280; text-align: center;">No notes to display</div>';
        return;
    }

    // Get VexFlow
    const VF = window.VexFlow || (window.Vex ? window.Vex.Flow : null);
    if (!VF) {
        container.innerHTML = '<div style="color: #6b7280; text-align: center;">VexFlow not available</div>';
        return;
    }

    // Convert phrase notes to the format expected by renderGrandStaffMeasure
    let beat = 0;
    const trebleNotes = notes.map((note, i) => {
        const duration = rhythm[i] || 1;
        const durationStr = duration >= 4 ? 'w' : duration >= 2 ? 'h' : duration >= 1 ? 'q' : duration >= 0.5 ? '8' : '16';
        const noteData = {
            type: 'note',
            pitch: note,
            pitches: [note],
            duration: durationStr,
            beat: beat,
            voiceIndex: 0
        };
        beat += duration;
        return noteData;
    });

    // Clear container and create canvas
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = 450;
    canvas.height = 170;
    canvas.style.cssText = 'max-width: 100%; height: auto;';
    container.appendChild(canvas);

    // Create renderer
    const rendererResult = createRenderer(canvas, canvas.width, canvas.height);
    if (!rendererResult) {
        container.innerHTML = '<div style="color: #6b7280; text-align: center;">Could not create renderer</div>';
        return;
    }

    const { context } = rendererResult;
    const currentKey = getCurrentKey() || 'C';

    // Use renderGrandStaffMeasure
    try {
        renderGrandStaffMeasure(context, {
            trebleNotes: trebleNotes,
            bassNotes: []  // Empty bass clef
        }, {
            x: 10,
            y: 5,
            width: 430,
            staffSpacing: 35,
            keySignature: currentKey,
            timeSignature: '4/4',
            showClef: true,
            showKeySignature: true,
            showTimeSignature: false,
            showBrace: true,
            showBarlines: true,
            isFirstInSystem: true,
            isLastInSystem: true,
            measureIndex: 0,
            enableHarmonicColoring: false
        });
    } catch (e) {
        console.warn('[Phrase Staff] Render error:', e);
        container.innerHTML = `<div style="color: #6b7280; text-align: center; padding: 20px;">${notes.length} notes</div>`;
    }
}

function playPhrase(phrase) {
    const notes = phrase.notes || [];
    if (notes.length === 0) return;

    try {
        const instrument = window.getInstrument && window.getInstrument();
        if (!instrument) return;

        if (window.Tone && window.Tone.context.state !== 'running') {
            window.Tone.start();
        }
        if (window.initAudio) window.initAudio();

        // Get rhythm values from the phrase - these are the actual note durations in beats
        // Each value represents how many beats that note lasts (e.g., 1 = quarter, 0.5 = eighth, 2 = half)
        const rhythm = phrase.rhythm || notes.map(() => 1);

        // Use composition tempo if available, otherwise default to 120 BPM
        const compositionState = getCompositionState();
        const tempo = compositionState?.getTempo?.() || window.compositionTempo || 120;
        const beatDuration = 60 / tempo; // Duration of one beat in seconds

        const baseTime = window.Tone?.now?.() || 0;

        // Log rhythm for debugging
        console.log('Playing phrase with rhythm:', rhythm.map(r => r.toFixed(2)).join(', '), `@ ${tempo} BPM`);

        let currentTime = baseTime;
        notes.forEach((note, i) => {
            const rhythmValue = rhythm[i] || 1;
            // Note sounds for 90% of its duration (slight gap for articulation)
            const noteDuration = rhythmValue * beatDuration * 0.9;
            try {
                instrument.triggerAttackRelease(note, noteDuration, currentTime);
            } catch (e) {
                // Ignore individual note errors
            }
            // Advance time by the full rhythm value
            currentTime += rhythmValue * beatDuration;
        });

    } catch (e) {
        console.warn('Could not play phrase:', e);
    }
}

// beatsToDuration imported from durationUtils.js (canonical source)

function applyPhrase(phrase) {
    // Save state for undo BEFORE making any changes
    // This allows user to undo if they accidentally overwrote a melody they liked
    try {
        window.saveStateBeforeChange && window.saveStateBeforeChange();
    } catch (e) {
        console.warn('[applyPhrase] Could not save state for undo:', e);
    }

    const compositionState = getCompositionState();
    const progressionData = getProgressionData() || [];
    const isSectionMode = modalState.melodyPositionMode === 'section';

    // Get selected chord range
    const startIdx = modalState.melodySelectedChordStart;
    const endIdx = modalState.melodySelectedChordEnd >= 0 ? modalState.melodySelectedChordEnd : startIdx;
    const minChordIdx = Math.min(startIdx, endIdx);
    const maxChordIdx = Math.max(startIdx, endIdx);
    const isSectionModeWithChord = isSectionMode && minChordIdx >= 0 && minChordIdx < progressionData.length;

    // Calculate insertion position and max duration for section mode
    let insertAtBeat = null;
    let maxDuration = null;
    if (isSectionModeWithChord) {
        // Calculate the beat position where the selected chord(s) start
        insertAtBeat = 0;
        for (let i = 0; i < minChordIdx; i++) {
            // Support multiple duration property names (beats, duration, durationBeats)
            const chordDuration = progressionData[i].beats ?? progressionData[i].duration ?? progressionData[i].durationBeats ?? 4;
            insertAtBeat += chordDuration;
        }

        // Calculate max duration (sum of selected chords' durations)
        maxDuration = 0;
        for (let i = minChordIdx; i <= maxChordIdx && i < progressionData.length; i++) {
            // Support multiple duration property names (beats, duration, durationBeats)
            const chordDuration = progressionData[i].beats ?? progressionData[i].duration ?? progressionData[i].durationBeats ?? 4;
            maxDuration += chordDuration;
        }
    }

    // Check if there are existing notes at/after the insertion point
    const hasExistingNotes = compositionState?.hasNotesAfterCursor?.() ||
                              compositionState?.getNoteCount?.() > 0 ||
                              (compositionState?.notes && compositionState.notes.length > 0);

    const doApply = (insertMode) => {
        // Get COPIES of notes and rhythm from the phrase (to avoid modifying original)
        let notes = [...(phrase.notes || [])];
        let rhythm = [...(phrase.rhythm || notes.map(() => 1))]; // Default to quarter notes

        // Standard durations for any adjustments
        const standardDurations = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25];

        // If in section mode, enforce max duration by truncating
        if (isSectionModeWithChord && maxDuration !== null) {
            let totalPhraseBeats = rhythm.reduce((sum, r) => sum + r, 0);

            // If phrase exceeds max, truncate notes to fit
            if (totalPhraseBeats > maxDuration + 0.01) {

                let accumulatedBeats = 0;
                let truncateIndex = 0;

                for (let i = 0; i < notes.length; i++) {
                    const noteBeats = rhythm[i] || 1;
                    if (accumulatedBeats + noteBeats > maxDuration + 0.01) {
                        // Find largest standard duration that fits in remaining space
                        const remainingSpace = maxDuration - accumulatedBeats;
                        let fitDuration = 0;
                        for (const std of standardDurations) {
                            if (std <= remainingSpace + 0.01) {
                                fitDuration = std;
                                break;
                            }
                        }
                        if (fitDuration >= 0.25) {
                            rhythm[i] = fitDuration;
                            truncateIndex = i + 1;
                        } else {
                            truncateIndex = i;
                        }
                        break;
                    }
                    accumulatedBeats += noteBeats;
                    truncateIndex = i + 1;
                }

                notes = notes.slice(0, truncateIndex);
                rhythm = rhythm.slice(0, truncateIndex);
            }
        }

        // Units per beat constant (must match buildingBlock.js)
        const UNITS_PER_BEAT = 48;

        // In section mode, use direct unit positioning to place notes at exact beat positions
        if (isSectionModeWithChord && insertAtBeat !== null && maxDuration !== null) {
            const totalPhraseBeats = rhythm.reduce((sum, r) => sum + r, 0);

            // Use addTrebleNoteAtUnit to place notes directly at specific positions
            if (compositionState?.addTrebleNoteAtUnit) {
                // First, clear the entire section to remove any old notes
                // This ensures clean replacement even if new melody is shorter
                if (compositionState.clearTrebleBeatRange) {
                    compositionState.clearTrebleBeatRange(insertAtBeat, maxDuration);
                }
                // Also clear second voice notes in the same range
                if (compositionState.clearSecondVoiceBeatRange) {
                    compositionState.clearSecondVoiceBeatRange(insertAtBeat, maxDuration);
                }
                let currentBeat = insertAtBeat;
                let addedCount = 0;

                for (let i = 0; i < notes.length; i++) {
                    const noteName = notes[i];
                    const beats = rhythm[i] || 1;
                    const startUnit = Math.round(currentBeat * UNITS_PER_BEAT);
                    const durationUnits = Math.round(beats * UNITS_PER_BEAT);

                    // Add note at specific unit position
                    compositionState.addTrebleNoteAtUnit(startUnit, durationUnits, [noteName], {});
                    addedCount++;
                    currentBeat += beats;
                }

                // Re-render to update the display
                if (compositionState.renderTrebleBlocksToMeasures) {
                    compositionState.renderTrebleBlocksToMeasures();
                }

                // Trigger notation UI update immediately
                const notationComposer = window.getNotationComposer?.();
                if (notationComposer) {
                    notationComposer.render();
                }

                // Visual feedback
                const cards = document.querySelectorAll('.phrase-card');
                cards.forEach((card, idx) => {
                    const applyBtn = card.querySelector('.apply-phrase-btn');
                    if (modalState.currentPhraseCandidates[idx] === phrase && applyBtn) {
                        applyBtn.textContent = `Applied ${addedCount} notes!`;
                        applyBtn.style.background = '#0284c7';
                        setTimeout(() => {
                            applyBtn.textContent = 'Apply Phrase';
                            applyBtn.style.background = '#0ea5e9';
                        }, 1500);
                    }
                });
                return;
            }
        }

        // Fallback for add-to-end mode: use addNoteIntelligently
        if (!window.addNoteIntelligently) {
            console.warn('addNoteIntelligently function not available');
            return;
        }

        const totalPhraseBeats = rhythm.reduce((sum, r) => sum + r, 0);
        console.log(`Applying phrase (add-to-end): ${notes.length} notes, ${totalPhraseBeats} beats total`);

        let addedCount = 0;
        for (let i = 0; i < notes.length; i++) {
            const noteName = notes[i];
            const beats = rhythm[i] || 1;
            const { duration, dotted } = beatsToDuration(beats);

            const result = window.addNoteIntelligently(
                noteName,
                duration,
                dotted,
                'treble',
                false,
                null
            );

            if (result) {
                addedCount++;
            }
        }

        const totalBeats = rhythm.reduce((sum, r) => sum + r, 0);
        console.log(`Applied phrase: ${addedCount}/${notes.length} notes (${totalBeats.toFixed(1)} beats)`);

        // Toast notification
        if (window.showToast) {
            window.showToast(`Applied melody phrase (${addedCount} notes)`, { type: 'success' });
        }

        // Visual feedback on the apply button
        const cards = document.querySelectorAll('.phrase-card');
        cards.forEach((card, i) => {
            const applyBtn = card.querySelector('.apply-phrase-btn');
            if (modalState.currentPhraseCandidates[i] === phrase && applyBtn) {
                applyBtn.textContent = `Applied ${addedCount} notes!`;
                applyBtn.style.background = '#0284c7';
                setTimeout(() => {
                    applyBtn.textContent = 'Apply Phrase';
                    applyBtn.style.background = '#0ea5e9';
                }, 1500);
            }
        });
    };

    // In section mode, we automatically clear existing notes in that section, so just apply directly
    if (isSectionModeWithChord) {
        doApply('replace');
        return;
    }

    // In add-to-end mode, check for existing notes and ask what to do
    if (hasExistingNotes) {
        const dialogMessage = `This phrase has <strong>${phrase.notes?.length || 0} notes</strong>.`;
        window.showChoiceDialog && window.showChoiceDialog({
            title: 'Insert Phrase',
            message: dialogMessage + ' How would you like to handle existing notes?',
            choices: [
                {
                    id: 'replace',
                    label: 'Replace notes',
                    description: 'The phrase will overwrite any notes at the cursor position.',
                    primary: false
                },
                {
                    id: 'shift',
                    label: 'Shift downstream notes',
                    description: 'All following notes will be pushed forward to make room for the phrase.',
                    primary: true
                }
            ],
            onChoice: (choice) => {
                if (choice) {
                    doApply(choice);
                }
            },
            allowCancel: true
        });
    } else {
        // No existing notes, just apply directly
        doApply('append');
    }
}

// ============================================================================
// MELODY NOTES VIEW - GENERATION & DISPLAY
// ============================================================================

function generateAndDisplayMelodySuggestions(container, chord, key) {
    // Show loading state
    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 32px; color: #6b7280;">
            <div style="width: 20px; height: 20px; border: 2px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 12px;"></div>
            <span>Generating suggestions...</span>
        </div>
    `;

    // Get the currently selected note to use as context for suggestions
    const selectedInfo = getSelectedNoteInfo();
    let previousNote = null;
    if (selectedInfo && selectedInfo.note) {
        // Get pitch from the selected note
        const pitch = selectedInfo.note.pitch || selectedInfo.note.pitches?.[0];
        if (pitch) {
            previousNote = pitch;
        }
    }

    // Get actual bass notes for the current position
    // This prevents melody notes from clashing with what's actually playing in the bass
    let actualBassNotes = null;
    const compositionState = getCompositionState();
    if (compositionState && selectedInfo && selectedInfo.measureIndex !== undefined) {
        const measure = compositionState.measures[selectedInfo.measureIndex];
        if (measure?.notation?.bass?.voices?.[0]?.notes) {
            const bassNotes = measure.notation.bass.voices[0].notes;
            // Find the bass note(s) at or before the current position
            // For simplicity, get all non-rest pitches from the measure's bass
            actualBassNotes = [];
            for (const note of bassNotes) {
                if (!note.isRest && note.pitches && note.pitches.length > 0) {
                    actualBassNotes.push(...note.pitches);
                }
            }
            // Remove duplicates
            actualBassNotes = [...new Set(actualBassNotes)];
            if (actualBassNotes.length === 0) {
                actualBassNotes = null;
            }
        }
    }

    // Get section context for melody suggestions
    const intent = getSectionIntent();
    const effectiveContext = getEffectiveSectionContext();

    // Build sectionIntent for melody engine
    // This allows melody suggestions to adapt based on section type and position
    let sectionIntent = null;
    if (intent && effectiveContext) {
        sectionIntent = {
            mode: intent.mode,
            subMode: intent.subMode,
            newSectionType: intent.newSectionType || effectiveContext.currentSectionType
        };
    }

    // Generate suggestions
    try {
        const result = generateMelodySuggestions({
            chord,
            key,
            previousNote: previousNote,
            styleId: modalState.style, // Use global style
            contourId: modalState.melodyContourId,
            mood: modalState.mood, // Use global mood
            octave: modalState.melodyOctave,
            range: 2,
            sectionIntent: sectionIntent, // Pass section context for section-aware melody suggestions
            actualBassNotes: actualBassNotes // Pass actual bass notes to prevent clashes
        });

        modalState.currentMelodySuggestions = result.suggestions || [];

        if (modalState.currentMelodySuggestions.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 32px; color: #6b7280;">
                    <p>No suggestions available for this context</p>
                </div>
            `;
            return;
        }

        // Clear and render suggestions
        container.innerHTML = '';

        // Info about keyboard shortcuts
        const shortcutInfo = document.createElement('div');
        shortcutInfo.style.cssText = `
            padding: 8px 12px;
            background: #eff6ff;
            border-radius: 6px;
            font-size: 12px;
            color: #1e40af;
            margin-bottom: 8px;
        `;
        shortcutInfo.textContent = 'Tip: Press 1-5 to quickly select the first 5 suggestions';
        container.appendChild(shortcutInfo);

        // Render each suggestion
        modalState.currentMelodySuggestions.forEach((suggestion, index) => {
            const item = createMelodySuggestionItem(suggestion, index, key);
            container.appendChild(item);
        });

    } catch (error) {
        console.error('Error generating melody suggestions:', error);
        container.innerHTML = `
            <div style="text-align: center; padding: 32px; color: #ef4444;">
                <p>Error generating suggestions. Please try again.</p>
            </div>
        `;
    }
}

function createMelodySuggestionItem(suggestion, index, key) {
    const item = document.createElement('div');
    item.className = 'melody-suggestion-item';
    item.dataset.note = suggestion.note;
    item.dataset.index = index;

    // Get current key for proper enharmonic spelling
    const currentKey = key || getCurrentKey() || 'C';
    const spelledPitch = spellNoteInKey(suggestion.pitch, currentKey);

    const colors = MELODY_CATEGORY_COLORS[suggestion.category] || MELODY_CATEGORY_COLORS.scaleTone;
    const scoreClass = suggestion.totalScore >= 85 ? 'excellent' :
                       suggestion.totalScore >= 70 ? 'good' :
                       suggestion.totalScore >= 55 ? 'fair' : 'low';

    const scoreColors = {
        excellent: { bg: '#dcfce7', text: '#166534' },
        good: { bg: '#fef3c7', text: '#92400e' },
        fair: { bg: '#fed7aa', text: '#9a3412' },
        low: { bg: '#e5e7eb', text: '#4b5563' }
    };

    item.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
    `;

    item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px;">
                ${index < 5 ? `<span style="
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 20px;
                    height: 20px;
                    background: #e5e7eb;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 600;
                    color: #4b5563;
                ">${index + 1}</span>` : ''}
                <span style="font-size: 16px; font-weight: 600; color: #1e293b;">
                    ${spelledPitch}<sub style="font-size: 11px; color: #6b7280;">${suggestion.octave}</sub>
                </span>
                <span style="
                    padding: 3px 8px;
                    background: ${colors.bg};
                    color: ${colors.text};
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 500;
                    text-transform: uppercase;
                ">${suggestion.categoryLabel}</span>
                ${suggestion.chordDegree ? `<span style="font-size: 12px; color: #6b7280; font-style: italic;">${suggestion.chordDegree}</span>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <button class="preview-note-btn" data-note="${suggestion.note}" style="
                    padding: 4px 8px;
                    background: transparent;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    color: #6b7280;
                " title="Preview note">&#9654;</button>
                <span class="melody-score-interactive"
                    data-score="${suggestion.totalScore}"
                    data-category="${suggestion.category || 'scaleTone'}"
                    data-category-label="${suggestion.categoryLabel || 'Scale Tone'}"
                    data-chord-degree="${suggestion.chordDegree || ''}"
                    data-is-chord-tone="${suggestion.isChordTone || false}"
                    data-is-scale-tone="${suggestion.isScaleTone || false}"
                    data-voice-leading="${suggestion.voiceLeadingDistance !== null ? suggestion.voiceLeadingDistance : ''}"
                    data-anticipates="${suggestion.anticipatesNextChord || false}"
                    data-common-tone="${suggestion.isCommonTone || false}"
                    data-reasons="${suggestion.reasons.join(' | ').replace(/"/g, '&quot;')}"
                    style="
                    padding: 4px 8px;
                    background: ${scoreColors[scoreClass].bg};
                    color: ${scoreColors[scoreClass].text};
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: help;
                    transition: transform 0.15s ease, box-shadow 0.15s ease;
                ">${suggestion.totalScore}</span>
                <button class="add-note-btn" data-note="${suggestion.note}" style="
                    padding: 4px 10px;
                    background: #3b82f6;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    font-weight: 500;
                    color: white;
                " title="Add note to composition">+ Add</button>
            </div>
        </div>
        <div style="font-size: 12px; color: #6b7280; line-height: 1.4;">
            ${suggestion.reasons.slice(0, 2).join('. ')}
        </div>
    `;

    // Add melody score tooltip handlers
    const melodyScoreBadge = item.querySelector('.melody-score-interactive');
    if (melodyScoreBadge) {
        melodyScoreBadge.addEventListener('mouseenter', (e) => {
            e.stopPropagation();
            showMelodyScoreTooltip(e, melodyScoreBadge);
        });
        melodyScoreBadge.addEventListener('mouseleave', (e) => {
            e.stopPropagation();
            hideMelodyScoreTooltip();
        });
    }

    // Hover effects
    item.addEventListener('mouseenter', () => {
        item.style.background = '#f9fafb';
        item.style.borderColor = '#3b82f6';
    });
    item.addEventListener('mouseleave', () => {
        item.style.background = 'white';
        item.style.borderColor = '#e5e7eb';
    });

    // Click to insert note (clicking anywhere on the row except buttons)
    item.addEventListener('click', (e) => {
        if (e.target.closest('.preview-note-btn') || e.target.closest('.add-note-btn')) return;
        handleMelodyNoteSelection(suggestion);
    });

    // Preview button
    const previewBtn = item.querySelector('.preview-note-btn');
    previewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        previewMelodyNote(suggestion.note);
    });

    // Add note button
    const addBtn = item.querySelector('.add-note-btn');
    addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleMelodyNoteSelection(suggestion);
    });

    return item;
}

/**
 * Get information about the currently selected note
 */
function getSelectedNoteInfo() {
    const compositionState = getCompositionState();
    if (!compositionState) return null;

    const notationComposer = window.getNotationComposer && window.getNotationComposer();
    const noteEditor = notationComposer?.noteEditor;

    // Check if there's a selected note in the note editor
    if (noteEditor && noteEditor.selectedNotes && noteEditor.selectedNotes.size > 0) {
        const noteIds = Array.from(noteEditor.selectedNotes);
        // Find the last selected treble note
        for (let i = noteIds.length - 1; i >= 0; i--) {
            const parts = noteIds[i].split('-');
            if (parts.length >= 3 && parts[1] === 'treble') {
                const measureIndex = parseInt(parts[0]);
                const noteIndex = parseInt(parts[2]);

                const measure = compositionState.measures[measureIndex];
                const trebleNotes = measure?.notation?.treble?.voices?.[0]?.notes || [];
                const note = trebleNotes[noteIndex];

                // Count total notes
                let totalNotes = 0;
                const measureCount = compositionState.getMeasureCount();
                for (let m = 0; m < measureCount; m++) {
                    const mNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes || [];
                    totalNotes += mNotes.length;
                }

                // Calculate absolute position
                let absolutePosition = 0;
                for (let m = 0; m < measureIndex; m++) {
                    const mNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes || [];
                    absolutePosition += mNotes.length;
                }
                absolutePosition += noteIndex;

                return {
                    measureIndex,
                    noteIndex,
                    note,
                    isLastNote: absolutePosition === totalNotes - 1,
                    totalNotes,
                    absolutePosition
                };
            }
        }
    }

    // No selection - check if there are any notes
    const measureCount = compositionState.getMeasureCount();
    let totalNotes = 0;
    for (let m = 0; m < measureCount; m++) {
        const trebleNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes || [];
        totalNotes += trebleNotes.length;
    }

    if (totalNotes === 0) {
        return null; // No notes exist, will append
    }

    // Find the last note
    for (let m = measureCount - 1; m >= 0; m--) {
        const trebleNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes || [];
        if (trebleNotes.length > 0) {
            return {
                measureIndex: m,
                noteIndex: trebleNotes.length - 1,
                note: trebleNotes[trebleNotes.length - 1],
                isLastNote: true,
                totalNotes,
                absolutePosition: totalNotes - 1
            };
        }
    }

    return null;
}

/**
 * Convert duration string to unit count (48 units per beat)
 */
function durationToUnits(duration) {
    const UNITS_PER_BEAT = 48;
    const map = {
        '1n': UNITS_PER_BEAT * 4,
        '2n': UNITS_PER_BEAT * 2,
        '4n': UNITS_PER_BEAT,
        '8n': UNITS_PER_BEAT / 2,
        '16n': UNITS_PER_BEAT / 4,
        '32n': UNITS_PER_BEAT / 8
    };
    return map[duration] || UNITS_PER_BEAT;
}

/**
 * Insert note at end (append mode)
 */
function insertMelodyNoteAtEnd(suggestion) {
    const duration = window.getCurrentNoteDuration ? window.getCurrentNoteDuration() : '4n';
    const dotted = window.getCurrentNoteDotted ? window.getCurrentNoteDotted() : false;

    const selectedInfo = getSelectedNoteInfo();
    const notationComposer = window.getNotationComposer && window.getNotationComposer();

    // Set the selected measure if we have selection info
    if (notationComposer && typeof notationComposer.setSelectedMeasure === 'function' && selectedInfo) {
        notationComposer.setSelectedMeasure(selectedInfo.measureIndex);
    }

    if (window.addNoteIntelligently) {
        const result = window.addNoteIntelligently(
            suggestion.note,
            duration,
            dotted,
            'treble',
            false,
            null
        );
        return result && result.success;
    }
    return false;
}

/**
 * Insert note with shift - moves existing notes forward
 */
function insertMelodyNoteWithShift(suggestion, selectedInfo) {
    const compositionState = getCompositionState();
    if (!compositionState || !selectedInfo) {
        return insertMelodyNoteAtEnd(suggestion);
    }

    const { measureIndex, noteIndex } = selectedInfo;
    const duration = window.getCurrentNoteDuration ? window.getCurrentNoteDuration() : '4n';
    const durationUnits = durationToUnits(duration);

    // Ensure treble block sequence is initialized
    if (!compositionState.trebleBlockSequence?.blocks?.length) {
        compositionState.initializeTrebleBlockSequence?.();
    }

    // Get the insertion point (after selected note)
    const noteUnitInfo = compositionState.getTrebleNoteUnit?.(measureIndex, noteIndex);
    if (!noteUnitInfo) {
        console.warn('Could not get note unit info, falling back to append');
        return insertMelodyNoteAtEnd(suggestion);
    }

    const insertUnit = noteUnitInfo.startUnit + noteUnitInfo.durationUnits;

    if (compositionState.insertTrebleNoteWithShift) {
        compositionState.insertTrebleNoteWithShift(
            insertUnit,
            durationUnits,
            [suggestion.note],
            { velocity: 0.8 }
        );

        // Trigger re-render
        const notationComposer = window.getNotationComposer && window.getNotationComposer();
        if (notationComposer) {
            notationComposer.render?.();
        }
        return true;
    }

    return insertMelodyNoteAtEnd(suggestion);
}

/**
 * Insert note by deleting notes after selection
 */
function insertMelodyNoteWithDelete(suggestion, selectedInfo) {
    const compositionState = getCompositionState();
    if (!compositionState || !selectedInfo) {
        return insertMelodyNoteAtEnd(suggestion);
    }

    const { measureIndex, noteIndex } = selectedInfo;
    const measureCount = compositionState.getMeasureCount();

    // Delete notes in current measure after noteIndex
    const currentMeasure = compositionState.measures[measureIndex];
    const trebleNotes = currentMeasure?.notation?.treble?.voices?.[0]?.notes || [];

    // Remove notes after selected note in current measure
    if (trebleNotes.length > noteIndex + 1) {
        trebleNotes.splice(noteIndex + 1);
    }

    // Clear all notes in subsequent measures
    for (let m = measureIndex + 1; m < measureCount; m++) {
        const mNotes = compositionState.measures[m]?.notation?.treble?.voices?.[0]?.notes;
        if (mNotes) {
            mNotes.length = 0;
        }
    }

    // Now append the note
    return insertMelodyNoteAtEnd(suggestion);
}

/**
 * Show visual feedback on the suggestion item
 */
function showMelodyInsertFeedback(suggestion) {
    const item = document.querySelector(`.melody-suggestion-item[data-note="${suggestion.note}"]`);
    if (item) {
        item.style.background = '#dcfce7';
        item.style.borderColor = '#10b981';
        setTimeout(() => {
            item.style.background = 'white';
            item.style.borderColor = '#e5e7eb';
        }, 300);
    }
}

function handleMelodyNoteSelection(suggestion) {
    // Save state for undo BEFORE making any changes
    try {
        window.saveStateBeforeChange && window.saveStateBeforeChange();
    } catch (e) {
        console.warn('[handleMelodyNoteSelection] Could not save state for undo:', e);
    }

    // Get the selected note info
    const selectedInfo = getSelectedNoteInfo();

    // If no notes exist or inserting at the end, just append
    if (!selectedInfo || selectedInfo.isLastNote) {
        const success = insertMelodyNoteAtEnd(suggestion);
        if (success) {
            showMelodyInsertFeedback(suggestion);
        }
        return;
    }

    // Inserting in the middle - show choice dialog
    const afterNote = selectedInfo.note?.pitch || selectedInfo.note?.pitches?.[0] || 'selected note';

    window.showChoiceDialog && window.showChoiceDialog({
        title: `Insert Note: ${suggestion.note}`,
        message: `You're inserting after <strong>${afterNote}</strong> in the middle of your melody. How would you like to handle the existing notes?`,
        choices: [
            {
                id: 'shift',
                label: 'Shift existing notes',
                description: 'Move all notes after this position forward.',
                primary: true
            },
            {
                id: 'replace',
                label: 'Replace existing notes',
                description: 'Delete all notes after this position.'
            }
        ],
        onChoice: (choice) => {
            if (!choice) return;

            let success = false;
            if (choice === 'shift') {
                success = insertMelodyNoteWithShift(suggestion, selectedInfo);
            } else if (choice === 'replace') {
                success = insertMelodyNoteWithDelete(suggestion, selectedInfo);
            }

            if (success) {
                showMelodyInsertFeedback(suggestion);
            }
        },
        allowCancel: true
    });

    // Also call the callback if set (for any additional processing)
    if (modalState.callbacks.onInsertNote) {
        modalState.callbacks.onInsertNote(suggestion);
    }
}

function previewMelodyNote(noteName) {
    try {
        const instrument = window.getInstrument && window.getInstrument();
        if (!instrument) return;

        if (window.Tone && window.Tone.context.state !== 'running') {
            window.Tone.start();
        }
        if (window.initAudio) window.initAudio();

        instrument.triggerAttackRelease(noteName, '4n');
    } catch (e) {
        console.warn('Could not preview note:', e);
    }
}

function refreshMelodySuggestions() {
    const container = document.getElementById('melody-suggestions-container');
    if (!container) return;

    const progressionData = getProgressionData() || [];
    const selectedIndex = modalState.selectedProgressionIndex >= 0
        ? modalState.selectedProgressionIndex
        : progressionData.length - 1;
    const currentChord = progressionData[selectedIndex] || null;
    const key = getCurrentKey() || 'C';

    if (currentChord) {
        generateAndDisplayMelodySuggestions(container, currentChord, key);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    renderMelodyTab,
    renderMelodyNotesView,
    renderMelodyPhrasesView,
    setupPhraseControlListeners,
    generateAndDisplayPhrases,
    displayPhraseCandidates,
    createPhraseCard,
    createContourVisualization,
    renderPhraseGrandStaff,
    playPhrase,
    beatsToDuration,
    applyPhrase,
    generateAndDisplayMelodySuggestions,
    createMelodySuggestionItem,
    getSelectedNoteInfo,
    durationToUnits,
    insertMelodyNoteAtEnd,
    insertMelodyNoteWithShift,
    insertMelodyNoteWithDelete,
    showMelodyInsertFeedback,
    handleMelodyNoteSelection,
    previewMelodyNote,
    refreshMelodySuggestions
};
