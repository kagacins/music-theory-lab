/**
 * Main Entry Point
 * Initializes the application and exposes necessary functions to the global scope for HTML event handlers
 */

// Import all necessary modules
import { switchTab, refreshAllTabs } from './modules/ui/tabs.js';
import { initAllSectionDragDrop } from './modules/ui/sectionDragDrop.js';
import { showModal, hideModal } from './modules/ui/modals.js';
import { renderKeyboard, updateKeyboardLabels, updateKeyNames, clearHighlights, g_KeyboardKeys } from './modules/ui/keyboard.js';
import { updateKeySignatureDisplay, setupResponsiveTitle } from './modules/ui/header.js';
import { toggleSidebar } from './modules/ui/sidebar.js';
import { initPresetUI, togglePresetPanel, openPresetPanel, closePresetPanel } from './modules/ui/presetUI.js';
import { initCircleOfFifths, toggleCircleOfFifthsPanel, openCircleOfFifthsPanel, closeCircleOfFifthsPanel } from './modules/features/circleOfFifths.js';
import { initGuitarFretboard, toggleGuitarFretboardPanel, openGuitarFretboardPanel, closeGuitarFretboardPanel, updateGuitarFretboard } from './modules/features/guitarFretboard.js';
import {
    initTheoryTools,
    toggleTheoryPanel,
    insertSecondaryDominant,
    showModalInterchangeChords,
    insertBorrowedChord,
    showChordSubstitutions,
    replaceWithSubstitution,
    setSelectedChordIndex,
    getSelectedChordIndex,
    showSecondaryDominantsInfo,
    showModalInterchangeInfo,
    // Jazz Extensions
    insertTwoFiveOne,
    insertDiminishedPassing,
    insertChromaticApproach,
    applyAlteration,
    insertTritoneSubstitution,
    addExtension,
    suggestReharmonization,
    showJazzProgressionsInfo,
    showAlteredDominantsInfo,
    showJazzVoicingsInfo
} from './modules/features/theoryTools.js';
import {
    renderBuilderSelectors,
    updateBuilderDisplay,
    selectBuilderRootNote,
    selectBuilderChordType,
    selectBuilderInterval,
    selectBuilderInversion,
    startBuilderChord,
    stopBuilderChord,
    playBuilderChordWithDuration,
    changeBuilderOctave,
    updateBuilderOctaveUI,
    updateLHInversionSelector,
    addChordToProgression,
    updateChordTypeButtonCaptions,
    updateIntervalButtonCaptions,
    capturePlayedChord,
    updateButtonSelection,
    toggleChordSetupPanel,
    toggleChordLibraryPanel,
    toggleChordIntervalsPanel
} from './modules/features/chordBuilder.js';
import {
    playArpeggio,
    stopArpeggio,
    changeArpeggioSpeed,
    updateArpeggioSpeedUI
} from './modules/audio/arpeggiator.js';
import {
    renderProgressionDisplay,
    renderProgressionControls,
    loadProgression,
    handleAutoPlayback,
    startStepChord,
    stopStepChord,
    stopTrainerChord,
    startProgressionChord,
    renderChordStaffNotation,
    toggleRecording,
    saveRecording,
    removeChordFromProgression,
    handleUndo,
    handleRedo,
    toggleProgressionNote,
    toggleProgressionLHNote,
    addToProgressionData,
    toggleStyleMoodInsightsPanel,
    toggleProgressionControlsPanel,
    toggleProgressionCardsPanel,
    toggleAllStaffNotation
} from './modules/features/progressionBuilder.js';
import {
    renderScaleSelectors,
    updateScaleDisplay,
    selectScaleRootNote,
    selectScaleType,
    playScale,
    changeScaleOctave,
    updateScaleOctaveUI,
    changeScaleSpeed,
    updateScaleSpeedUI
} from './modules/features/scaleExplorer.js';
import { initAudio, getPiano, getGuitar, getInstrument, getAudioIsReady, forceStopAllPlayback, initAudioContextKeepAlive } from './modules/audio/audioEngine.js';
import { updateUndoRedoButtons } from './modules/utils/undoRedo.js';
import {
    getCurrentTab,
    getEnharmonicPreference,
    setEnharmonicPreference,
    getNotationPreference,
    setNotationPreference,
    getIsRomanNumeralEngineOn,
    setIsRomanNumeralEngineOn,
    getIsKeyNamesOn,
    setIsKeyNamesOn,
    getIsClassicKeyboardOn,
    setIsClassicKeyboardOn,
    getIsCompactModeOn,
    setIsCompactModeOn,
    getIsDarkModeOn,
    setIsDarkModeOn,
    getIsFretboardModeOn,
    setIsFretboardModeOn,
    getNumOctaves,
    setNumOctaves
} from './modules/state/globalState.js';
import { getTrainerState, setProgressionData } from './modules/state/trainerState.js';
import {
    getBuilderRootIndex,
    getBuilderChordType,
    getBuilderInversion,
    getBuilderOctaveShift,
    getBuilderSelectionMode,
    getBuilderIntervalType,
    getBuilderOmittedNotes,
    setBuilderChordType,
    setBuilderIntervalType
} from './modules/state/builderState.js';
import { getScaleRootIndex } from './modules/state/scaleState.js';
import { toggleSuggestionEngine } from './modules/utils/voiceLeading.js';
import {
    getNoteKeyId,
    getInvertedChordNotes,
    getIntervalNotes
} from './modules/utils/noteUtils.js';
import {
    generateProgressionMelody,
    playMelody as playMelodyInternal,
    stopMelody as stopMelodyInternal,
    setCurrentMelody,
    getCurrentMelody,
    exportMelodyToMIDI,
    toggleMelodyGeneratorPanel,
    renderMelodyNotation,
    renderChordMelodyTimeline,
    toggleMelodyEditMode,
    updateMelodyNote,
    deleteMelodyNote,
    insertMelodyNote,
    refreshMelodyDisplay,
    // Interactive melody composition
    initInteractiveMelody,
    addNoteToInteractiveMelody,
    deleteLastNote,
    clearInteractiveMelody,
    setNoteDuration,
    setNoteDotted,
    getCurrentNoteDuration,
    getCurrentNoteDotted,
    renderChordProgressionStaff,
    renderInteractiveMelodyStaff,
    getInteractiveMelody,
    toggleInteractiveMode,
    playInteractiveMelodyWithChords,
    playAllMelody,
    stopPlayAllMelody,
    playMeasure,
    playSelectedMeasure,
    playFromSelectedMeasure,
    getSelectedMeasureIndex,
    startStepMeasureMelody,
    stopStepMeasureMelody,
    setMelodyClef,
    setChordClef,
    setHighlightEnabled,
    getHighlightEnabled,
    // New notation editor functions
    addRestToMelody,
    setTimeSignature,
    tieLastNote,
    getEditorState,
    setAccidental,
    setDynamic
} from './modules/audio/melodyGenerator.js';
import {
    ENHARMONIC_MAP,
    SHARP_NOTES,
    FLAT_NOTES,
    ALL_NOTES,
    KEY_SIGNATURE_TEXT,
    KEY_SIGNATURE_IMAGES,
    RELATIVE_MINOR_MAP,
    MAJOR_SCALE_STEPS
} from './data/music-data.js';

// Global Settings Functions
function toggleEnharmonic() {
    const toggle = document.getElementById('enharmonic-toggle');
    // User wants: when b/flat is selected (checked=true), use FLAT_NOTES
    // When #/sharp is selected (checked=false), use SHARP_NOTES
    // This is the reverse of the current broken behavior
    setEnharmonicPreference(toggle.checked ? 'flat' : 'sharp');

    // Update indicator colors
    const sharpIndicator = document.getElementById('sharp-indicator');
    const flatIndicator = document.getElementById('flat-indicator');

    if (getEnharmonicPreference() === 'sharp') {
        sharpIndicator.classList.remove('text-gray-500');
        sharpIndicator.classList.add('text-indigo-300');
        flatIndicator.classList.remove('text-indigo-300');
        flatIndicator.classList.add('text-gray-500');
    } else {
        flatIndicator.classList.remove('text-gray-500');
        flatIndicator.classList.add('text-indigo-300');
        sharpIndicator.classList.remove('text-indigo-300');
        sharpIndicator.classList.add('text-gray-500');
    }

    // Update window.enharmonicPreference for modules that access it
    window.enharmonicPreference = getEnharmonicPreference();

    refreshAllTabs();
}

function toggleNotationStyle() {
    const toggle = document.getElementById('notation-toggle');
    setNotationPreference(toggle.checked ? 'symbol' : 'full');

    // Update indicator colors
    const fullIndicator = document.getElementById('notation-full-indicator');
    const symbolIndicator = document.getElementById('notation-symbol-indicator');

    if (getNotationPreference() === 'full') {
        fullIndicator.classList.remove('text-gray-500');
        fullIndicator.classList.add('text-indigo-300');
        symbolIndicator.classList.remove('text-indigo-300');
        symbolIndicator.classList.add('text-gray-500');
    } else {
        symbolIndicator.classList.remove('text-gray-500');
        symbolIndicator.classList.add('text-indigo-300');
        fullIndicator.classList.remove('text-indigo-300');
        fullIndicator.classList.add('text-gray-500');
    }

    // Update builder display and chord type button captions to reflect notation preference
    refreshAllTabs();
}

function toggleRomanNumeralEngine() {
    const toggle = document.getElementById('roman-numeral-toggle');
    setIsRomanNumeralEngineOn(toggle.checked);
    
    // Update window.isRomanNumeralEngineOn for modules that access it
    window.isRomanNumeralEngineOn = getIsRomanNumeralEngineOn();
    
    // Update indicator colors
    const offIndicator = document.getElementById('roman-off-indicator');
    const onIndicator = document.getElementById('roman-on-indicator');

    if (getIsRomanNumeralEngineOn()) {
        onIndicator.classList.remove('text-gray-500');
        onIndicator.classList.add('text-indigo-300');
        offIndicator.classList.remove('text-indigo-300');
        offIndicator.classList.add('text-gray-500');
    } else {
        offIndicator.classList.remove('text-gray-500');
        offIndicator.classList.add('text-indigo-300');
        onIndicator.classList.remove('text-indigo-300');
        onIndicator.classList.add('text-gray-500');
    }
    
    // Update keyboard labels to show/hide Roman numerals
    // Call immediately - updateKeyboardLabels will handle the state
    updateKeyboardLabels();
}

function toggleKeyNames() {
    const toggle = document.getElementById('key-names-toggle');
    setIsKeyNamesOn(toggle.checked);
    
    // Update window.isKeyNamesOn for modules that access it
    window.isKeyNamesOn = getIsKeyNamesOn();
    
    // Update indicator colors
    const offIndicator = document.getElementById('key-names-off-indicator');
    const onIndicator = document.getElementById('key-names-on-indicator');

    if (getIsKeyNamesOn()) {
        onIndicator.classList.remove('text-gray-500');
        onIndicator.classList.add('text-indigo-300');
        offIndicator.classList.remove('text-indigo-300');
        offIndicator.classList.add('text-gray-500');
    } else {
        offIndicator.classList.remove('text-gray-500');
        offIndicator.classList.add('text-indigo-300');
        onIndicator.classList.remove('text-indigo-300');
        onIndicator.classList.add('text-gray-500');
    }
    
    // Update keyboard labels to show/hide key names
    updateKeyboardLabels();
}

function toggleClassicKeyboard() {
    const toggle = document.getElementById('classic-keyboard-toggle');
    setIsClassicKeyboardOn(toggle.checked);
    
    // Update window.isClassicKeyboardOn for modules that access it
    window.isClassicKeyboardOn = getIsClassicKeyboardOn();
    
    // Update indicator colors
    const offIndicator = document.getElementById('classic-keyboard-off-indicator');
    const onIndicator = document.getElementById('classic-keyboard-on-indicator');

    if (getIsClassicKeyboardOn()) {
        // Classic keyboard is ON - remove modern keyboard class
        onIndicator.classList.remove('text-gray-500');
        onIndicator.classList.add('text-indigo-300');
        offIndicator.classList.remove('text-indigo-300');
        offIndicator.classList.add('text-gray-500');
        // Remove modern keyboard class to show classic style
        const keyboard = document.getElementById('piano-keyboard');
        if (keyboard) {
            keyboard.classList.remove('modern-keyboard');
        }
    } else {
        // Classic keyboard is OFF - add modern keyboard class (default)
        offIndicator.classList.remove('text-gray-500');
        offIndicator.classList.add('text-indigo-300');
        onIndicator.classList.remove('text-indigo-300');
        onIndicator.classList.add('text-gray-500');
        // Add modern keyboard class to show modern style
        const keyboard = document.getElementById('piano-keyboard');
        if (keyboard) {
            keyboard.classList.add('modern-keyboard');
        }
    }
}

function toggleCompactControls() {
    const toggle = document.getElementById('compact-controls-toggle');
    setIsCompactModeOn(toggle.checked);

    const isCompact = getIsCompactModeOn();

    // Update indicator colors
    const offIndicator = document.getElementById('compact-off-indicator');
    const onIndicator = document.getElementById('compact-on-indicator');

    if (isCompact) {
        onIndicator.classList.remove('text-gray-500');
        onIndicator.classList.add('text-indigo-300');
        offIndicator.classList.remove('text-indigo-300');
        offIndicator.classList.add('text-gray-500');
    } else {
        offIndicator.classList.remove('text-gray-500');
        offIndicator.classList.add('text-indigo-300');
        onIndicator.classList.remove('text-indigo-300');
        onIndicator.classList.add('text-gray-500');
    }

    // Add/remove compact-mode class from body for CSS selectors
    if (isCompact) {
        document.body.classList.add('compact-mode');
    } else {
        document.body.classList.remove('compact-mode');
    }

    // The CSS now handles everything via body.compact-mode selectors
    // No need for manual classList manipulation
}

function toggleDarkMode() {
    const toggle = document.getElementById('dark-mode-toggle');
    setIsDarkModeOn(toggle.checked);

    const isDark = getIsDarkModeOn();

    // Update indicator colors
    const lightIndicator = document.getElementById('dark-mode-light-indicator');
    const darkIndicator = document.getElementById('dark-mode-dark-indicator');

    if (isDark) {
        darkIndicator.classList.remove('text-gray-500');
        darkIndicator.classList.add('text-indigo-300');
        lightIndicator.classList.remove('text-indigo-300');
        lightIndicator.classList.add('text-gray-500');
    } else {
        lightIndicator.classList.remove('text-gray-500');
        lightIndicator.classList.add('text-indigo-300');
        darkIndicator.classList.remove('text-indigo-300');
        darkIndicator.classList.add('text-gray-500');
    }

    // Add/remove dark-mode class from body for CSS selectors
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

function toggleFretboard() {
    const toggle = document.getElementById('fretboard-toggle');
    setIsFretboardModeOn(toggle.checked);

    const isFretboard = getIsFretboardModeOn();

    // Update indicator colors
    const pianoIndicator = document.getElementById('fretboard-piano-indicator');
    const guitarIndicator = document.getElementById('fretboard-guitar-indicator');

    if (isFretboard) {
        // Guitar fretboard is ON
        guitarIndicator.classList.remove('text-gray-500');
        guitarIndicator.classList.add('text-indigo-300');
        pianoIndicator.classList.remove('text-indigo-300');
        pianoIndicator.classList.add('text-gray-500');
    } else {
        // Piano keyboard is ON (default)
        pianoIndicator.classList.remove('text-gray-500');
        pianoIndicator.classList.add('text-indigo-300');
        guitarIndicator.classList.remove('text-indigo-300');
        guitarIndicator.classList.add('text-gray-500');
    }

    // Toggle visibility of keyboard vs fretboard
    const keyboard = document.getElementById('piano-keyboard');
    const fretboard = document.getElementById('guitar-fretboard-container');

    if (isFretboard) {
        // Show fretboard, hide keyboard
        if (keyboard) keyboard.style.display = 'none';
        if (fretboard) {
            fretboard.style.display = 'block';
            updateGuitarFretboard();
        }
    } else {
        // Show keyboard, hide fretboard
        if (keyboard) keyboard.style.display = 'flex';
        if (fretboard) fretboard.style.display = 'none';
    }
}

function toggleFloatingControls() {
    const panels = document.querySelectorAll('.floating-panel');
    const expandBtn = document.getElementById('expand-controls-btn');

    isFloatingControlsVisible = !isFloatingControlsVisible;

    panels.forEach(panel => {
        panel.classList.toggle('hidden', !isFloatingControlsVisible);
    });

    localStorage.setItem('isFloatingControlsVisible', isFloatingControlsVisible.toString());

    if (isFloatingControlsVisible) {
        expandBtn.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"></path></svg>';
        expandBtn.title = 'Hide Floating Controls';
    } else {
        expandBtn.innerHTML = '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd"></path><path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z"></path></svg>';
        expandBtn.title = 'Show Floating Controls';
    }
}

function toggleDisplayPanel(panelId) {
    const panel = document.getElementById(panelId);
    panel.classList.toggle('hidden');
}

function handleOctaveRangeChange(value) {
    const numOctaves = parseInt(value, 10);
    setNumOctaves(numOctaves);
    window.g_NumOctaves = numOctaves; // Update window global for keyboard module
    renderKeyboard();
    updateKeyboardLabels();
}

// ============================================================================
// Melody Generator Functions
// ============================================================================

/**
 * Generate melody based on current parameters
 * Works for both Progression Builder tab and Melody Composer tab
 */
function generateMelody() {
    const progressionData = window.getTrainerState ? window.getTrainerState().progressionData : [];

    if (!progressionData || progressionData.length === 0) {
        alert('Please create a chord progression first before generating a melody.');
        return;
    }

    // Get parameters from UI - check both old IDs (Progression Builder) and new IDs (Melody Composer)
    const style = (document.getElementById('melody-style-select-main')?.value ||
                   document.getElementById('melody-style-select')?.value || 'chord-tones');
    const density = (document.getElementById('melody-density-select-main')?.value ||
                     document.getElementById('melody-density-select')?.value || 'medium');
    const rhythm = (document.getElementById('melody-rhythm-select-main')?.value ||
                    document.getElementById('melody-rhythm-select')?.value || 'even-8th');
    const range = (document.getElementById('melody-range-select-main')?.value ||
                   document.getElementById('melody-range-select')?.value || 'medium');
    const contour = (document.getElementById('melody-contour-select-main')?.value ||
                     document.getElementById('melody-contour-select')?.value || 'arch');
    const octave = (document.getElementById('melody-octave-select-main')?.value ||
                    document.getElementById('melody-octave-select')?.value || '4');

    const params = {
        style,
        density,
        rhythm,
        range,
        contour,
        octave
    };

    // Generate melody
    const melody = generateProgressionMelody(params);

    if (melody && melody.notes && melody.notes.length > 0) {
        setCurrentMelody(melody);

        // Display melody in both locations
        displayMelody(melody);
        displayMelodyInComposerTab(melody);

        // Enable play buttons in both tabs
        const playBtn = document.getElementById('play-melody-btn');
        const playBtnMain = document.getElementById('play-melody-btn-main');
        if (playBtn) playBtn.disabled = false;
        if (playBtnMain) playBtnMain.disabled = false;

        const saveBtn = document.getElementById('save-melody-btn');
        const saveBtnMain = document.getElementById('save-melody-btn-main');
        if (saveBtn) saveBtn.disabled = false;
        if (saveBtnMain) saveBtnMain.disabled = false;

        // Auto-expand Current Melody panel
        const currentMelodyPanel = document.getElementById('current-melody-panel');
        const currentMelodyChevron = document.getElementById('current-melody-chevron');
        if (currentMelodyPanel && currentMelodyPanel.classList.contains('hidden')) {
            currentMelodyPanel.classList.remove('hidden');
            if (currentMelodyChevron) {
                currentMelodyChevron.classList.add('rotate-180');
            }
        }

        console.log('Melody generated:', melody.notes.length, 'notes');
    } else {
        alert('Failed to generate melody. Please check your progression and try again.');
    }
}

/**
 * Display generated melody in the UI
 */
function displayMelody(melody) {
    const display = document.getElementById('melody-display');
    const notesDisplay = document.getElementById('melody-notes-display');
    const noteCount = document.getElementById('melody-note-count');

    if (!display || !notesDisplay || !noteCount) return;

    // Show display
    display.classList.remove('hidden');

    // Format notes for display (group by 8s for readability)
    const notesText = melody.notes.map((note, index) => {
        const separator = (index + 1) % 8 === 0 ? '\n' : ' ';
        return note + separator;
    }).join('');

    notesDisplay.textContent = notesText;
    noteCount.textContent = melody.notes.length;

    // Get current key and progression data
    const currentKey = window.getTrainerState ? window.getTrainerState().currentKey : 'C';
    const progressionData = window.getTrainerState ? window.getTrainerState().progressionData : [];

    // Update key display
    const keyDisplay = document.getElementById('melody-key-display');
    if (keyDisplay) {
        keyDisplay.textContent = currentKey.endsWith('m') ? currentKey + ' (minor)' : currentKey + ' Major';
    }

    // Calculate and display range
    const rangeDisplay = document.getElementById('melody-range-display');
    if (rangeDisplay && melody.notes.length > 0) {
        const midiValues = melody.notes.map(note => {
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return 60;
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const noteName = match[1];
            const octave = parseInt(match[2]);
            let noteIndex = noteNames.indexOf(noteName);
            if (noteIndex === -1) {
                // Handle flat notes
                const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
                noteIndex = noteNames.indexOf(flatToSharp[noteName] || 'C');
            }
            return octave * 12 + noteIndex;
        });
        const minMidi = Math.min(...midiValues);
        const maxMidi = Math.max(...midiValues);
        const range = maxMidi - minMidi;
        rangeDisplay.textContent = `${range} semitones`;
    }

    // Calculate and display duration
    const durationDisplay = document.getElementById('melody-duration-display');
    if (durationDisplay) {
        const totalBeats = melody.durations.reduce((sum, dur) => {
            const beats = parseFloat(dur.replace('n', '')) || 4;
            return sum + (4 / beats);
        }, 0);
        durationDisplay.textContent = `${totalBeats.toFixed(1)} beats`;
    }

    // Render VexFlow notation
    renderMelodyNotation(melody, currentKey);

    // Render chord-melody timeline
    renderChordMelodyTimeline(melody, progressionData);
}

/**
 * Display generated melody in the Melody Composer tab
 */
function displayMelodyInComposerTab(melody) {
    const display = document.getElementById('melody-display-main');
    const notesDisplay = document.getElementById('melody-notes-display-main');
    const noteCount = document.getElementById('melody-note-count-main');

    if (!display || !notesDisplay || !noteCount) return;

    // Show display
    display.classList.remove('hidden');

    // Format notes for display (group by 8s for readability)
    const notesText = melody.notes.map((note, index) => {
        const separator = (index + 1) % 8 === 0 ? '\n' : ' ';
        return note + separator;
    }).join('');

    notesDisplay.textContent = notesText;
    noteCount.textContent = melody.notes.length;

    // Get current key and progression data
    const currentKey = window.getTrainerState ? window.getTrainerState().currentKey : 'C';
    const progressionData = window.getTrainerState ? window.getTrainerState().progressionData : [];

    // Update key display
    const keyDisplay = document.getElementById('melody-key-display-main');
    if (keyDisplay) {
        keyDisplay.textContent = currentKey.endsWith('m') ? currentKey + ' (minor)' : currentKey + ' Major';
    }

    // Calculate and display range
    const rangeDisplay = document.getElementById('melody-range-display-main');
    if (rangeDisplay && melody.notes.length > 0) {
        const midiValues = melody.notes.map(note => {
            const match = note.match(/^([A-G][#b]?)(\d+)$/);
            if (!match) return 60;
            const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
            const noteName = match[1];
            const octave = parseInt(match[2]);
            let noteIndex = noteNames.indexOf(noteName);
            if (noteIndex === -1) {
                // Handle flat notes
                const flatToSharp = { 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#' };
                noteIndex = noteNames.indexOf(flatToSharp[noteName] || 'C');
            }
            return octave * 12 + noteIndex;
        });
        const minMidi = Math.min(...midiValues);
        const maxMidi = Math.max(...midiValues);
        const range = maxMidi - minMidi;
        rangeDisplay.textContent = `${range} semitones`;
    }

    // Calculate and display duration
    const durationDisplay = document.getElementById('melody-duration-display-main');
    if (durationDisplay) {
        const totalBeats = melody.durations.reduce((sum, dur) => {
            const beats = parseFloat(dur.replace('n', '')) || 4;
            return sum + (4 / beats);
        }, 0);
        durationDisplay.textContent = `${totalBeats.toFixed(1)} beats`;
    }

    // Render VexFlow notation in Melody Composer canvas
    const canvas = document.getElementById('melody-notation-canvas-main');
    if (canvas) {
        // Temporarily swap canvas IDs to render in the main tab
        const originalCanvas = document.getElementById('melody-notation-canvas');
        const originalId = originalCanvas?.id;
        if (originalCanvas) originalCanvas.id = 'melody-notation-canvas-temp';
        canvas.id = 'melody-notation-canvas';

        renderMelodyNotation(melody, currentKey);

        // Restore IDs
        canvas.id = 'melody-notation-canvas-main';
        if (originalCanvas) originalCanvas.id = originalId;
    }

    // Render chord-melody timeline in Melody Composer
    const timeline = document.getElementById('chord-melody-timeline-main');
    if (timeline) {
        const originalTimeline = document.getElementById('chord-melody-timeline');
        const originalId = originalTimeline?.id;
        if (originalTimeline) originalTimeline.id = 'chord-melody-timeline-temp';
        timeline.id = 'chord-melody-timeline';

        renderChordMelodyTimeline(melody, progressionData);

        // Restore IDs
        timeline.id = 'chord-melody-timeline-main';
        if (originalTimeline) originalTimeline.id = originalId;
    }
}

/**
 * Play the generated melody
 */
function playGeneratedMelody() {
    const melody = getCurrentMelody();

    if (!melody || !melody.notes || melody.notes.length === 0) {
        alert('Please generate a melody first.');
        return;
    }

    playMelodyInternal(melody);

    // Update button states in both tabs
    const playBtn = document.getElementById('play-melody-btn');
    const stopBtn = document.getElementById('stop-melody-btn');
    const playBtnMain = document.getElementById('play-melody-btn-main');
    const stopBtnMain = document.getElementById('stop-melody-btn-main');

    if (playBtn) playBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    if (playBtnMain) playBtnMain.disabled = true;
    if (stopBtnMain) stopBtnMain.disabled = false;
}

/**
 * Stop melody playback
 */
function stopMelody() {
    stopMelodyInternal();

    // Update button states in both tabs
    const playBtn = document.getElementById('play-melody-btn');
    const stopBtn = document.getElementById('stop-melody-btn');
    const playBtnMain = document.getElementById('play-melody-btn-main');
    const stopBtnMain = document.getElementById('stop-melody-btn-main');

    if (playBtn) playBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    if (playBtnMain) playBtnMain.disabled = false;
    if (stopBtnMain) stopBtnMain.disabled = true;
}

/**
 * Save melody as MIDI file
 */
function saveMelody() {
    exportMelodyToMIDI();
}

// Expose functions to global scope for HTML event handlers
window.switchTab = switchTab;
window.refreshAllTabs = refreshAllTabs;
window.showModal = showModal;
window.hideModal = hideModal;
window.toggleSidebar = toggleSidebar;
window.toggleEnharmonic = toggleEnharmonic;
window.toggleNotationStyle = toggleNotationStyle;
window.toggleSuggestionEngine = toggleSuggestionEngine;
window.toggleRomanNumeralEngine = toggleRomanNumeralEngine;
window.toggleKeyNames = toggleKeyNames;
window.toggleClassicKeyboard = toggleClassicKeyboard;
window.toggleCompactControls = toggleCompactControls;
window.toggleDarkMode = toggleDarkMode;
window.toggleFretboard = toggleFretboard;
window.toggleFloatingControls = toggleFloatingControls;
window.toggleDisplayPanel = toggleDisplayPanel;
window.handleOctaveRangeChange = handleOctaveRangeChange;

// Drag & Drop helpers (shock/refresh)
function refreshDragDrop() {
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }
}

function shockDragDrop() {
    // Mimic the manual fix: leave the current tab briefly, then return
    const prevTab = window.currentTab || 'trainer';
    const fallback = () => refreshDragDrop();
    if (typeof window.switchTab !== 'function') return fallback();

    try {
        // If we are on trainer, hop to builder, then back after a short delay
        if (prevTab === 'trainer') {
            window.switchTab('builder');
            setTimeout(() => {
                window.switchTab('trainer');
            }, 75);
        } else {
            window.switchTab('trainer');
            setTimeout(() => {
                window.switchTab(prevTab);
            }, 75);
        }
    } catch (_) {
        fallback();
    }
}

window.refreshDragDrop = refreshDragDrop;
window.shockDragDrop = shockDragDrop;

// Keyboard shortcuts: Alt+R to refresh, Alt+S to shock (tab toggle)
document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            refreshDragDrop();
        } else if (e.key === 's' || e.key === 'S') {
            e.preventDefault();
            shockDragDrop();
        }
    }
});

// Builder functions
window.startBuilderChord = startBuilderChord;
window.stopBuilderChord = stopBuilderChord;
window.playBuilderChordWithDuration = playBuilderChordWithDuration;
window.addChordToProgression = addChordToProgression;
window.changeArpeggioSpeed = changeArpeggioSpeed;
window.changeBuilderOctave = changeBuilderOctave;
window.updateBuilderDisplay = updateBuilderDisplay;
window.selectBuilderRootNote = selectBuilderRootNote;
window.selectBuilderChordType = selectBuilderChordType;
window.selectBuilderInterval = selectBuilderInterval;
window.selectBuilderInversion = selectBuilderInversion;
window.playArpeggio = playArpeggio;
window.stopArpeggio = stopArpeggio;
window.getNoteKeyId = getNoteKeyId;
window.capturePlayedChord = capturePlayedChord;
window.getInvertedChordNotes = getInvertedChordNotes;
window.getIntervalNotes = getIntervalNotes;
window.updateBuilderDisplay = updateBuilderDisplay;
window.updateKeySignatureDisplay = updateKeySignatureDisplay;
window.updateButtonSelection = updateButtonSelection;
window.updateChordTypeButtonCaptions = updateChordTypeButtonCaptions;
window.updateIntervalButtonCaptions = updateIntervalButtonCaptions;
window.toggleChordSetupPanel = toggleChordSetupPanel;
window.toggleChordLibraryPanel = toggleChordLibraryPanel;
window.toggleChordIntervalsPanel = toggleChordIntervalsPanel;

// Expose data constants for modules that need them
window.ENHARMONIC_MAP = ENHARMONIC_MAP;
window.SHARP_NOTES = SHARP_NOTES;
window.FLAT_NOTES = FLAT_NOTES;
window.ALL_NOTES = ALL_NOTES;
window.KEY_SIGNATURE_TEXT = KEY_SIGNATURE_TEXT;
window.KEY_SIGNATURE_IMAGES = KEY_SIGNATURE_IMAGES;
window.RELATIVE_MINOR_MAP = RELATIVE_MINOR_MAP;
window.MAJOR_SCALE_STEPS = MAJOR_SCALE_STEPS;

// Trainer functions
window.handleAutoPlayback = handleAutoPlayback;
window.startStepChord = startStepChord;
window.stopStepChord = stopStepChord;
window.stopTrainerChord = stopTrainerChord;
window.startProgressionChord = startProgressionChord;
window.renderChordStaffNotation = renderChordStaffNotation;
window.addToProgressionData = addToProgressionData;
window.renderProgressionDisplay = renderProgressionDisplay;
window.renderProgressionControls = renderProgressionControls;
window.toggleRecording = toggleRecording;
window.saveRecording = saveRecording;
window.removeChordFromProgression = removeChordFromProgression;
window.toggleProgressionNote = toggleProgressionNote;
window.toggleProgressionLHNote = toggleProgressionLHNote;
window.handleUndo = handleUndo;
window.handleRedo = handleRedo;
window.updateUndoRedoButtons = updateUndoRedoButtons;

window.toggleStyleMoodInsightsPanel = toggleStyleMoodInsightsPanel;
window.toggleProgressionControlsPanel = toggleProgressionControlsPanel;
window.toggleProgressionCardsPanel = toggleProgressionCardsPanel;
window.toggleAllStaffNotation = toggleAllStaffNotation;

// Melody Composer toggle functions
window.toggleMelodyProgressionPanel = function() {
    const panel = document.getElementById('melody-progression-panel');
    const chevron = document.getElementById('melody-progression-chevron');
    if (!panel || !chevron) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }
};

window.toggleCurrentMelodyPanel = function() {
    const panel = document.getElementById('current-melody-panel');
    const chevron = document.getElementById('current-melody-chevron');
    if (!panel || !chevron) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        chevron.classList.add('rotate-180');
    } else {
        panel.classList.add('hidden');
        chevron.classList.remove('rotate-180');
    }
};

// Expand/Collapse All functions for tabs
window.expandAllTrainerSections = function() {
    const sections = [
        { panelId: 'progression-controls-panel', chevronId: 'progression-controls-chevron' },
        { panelId: 'style-mood-insights-panel', chevronId: 'style-mood-insights-chevron' },
        { panelId: 'progression-visualization-panel', chevronId: 'progression-visualization-chevron' },
        { panelId: 'theory-tools-panel', chevronId: 'theory-tools-chevron' },
        { panelId: 'melody-generator-panel', chevronId: 'melody-generator-chevron' }
    ];
    sections.forEach(({ panelId, chevronId }) => {
        const panelEl = document.getElementById(panelId);
        const chevronEl = document.getElementById(chevronId);
        if (panelEl && chevronEl) {
            panelEl.classList.remove('hidden');
            chevronEl.classList.add('rotate-180');
        }
    });
};

window.collapseAllTrainerSections = function() {
    const sections = [
        { panelId: 'progression-controls-panel', chevronId: 'progression-controls-chevron' },
        { panelId: 'style-mood-insights-panel', chevronId: 'style-mood-insights-chevron' },
        { panelId: 'progression-visualization-panel', chevronId: 'progression-visualization-chevron' },
        { panelId: 'theory-tools-panel', chevronId: 'theory-tools-chevron' },
        { panelId: 'melody-generator-panel', chevronId: 'melody-generator-chevron' }
    ];
    sections.forEach(({ panelId, chevronId }) => {
        const panelEl = document.getElementById(panelId);
        const chevronEl = document.getElementById(chevronId);
        if (panelEl && chevronEl) {
            panelEl.classList.add('hidden');
            chevronEl.classList.remove('rotate-180');
        }
    });
};

window.expandAllBuilderSections = function() {
    const sections = [
        { panelId: 'chord-setup-panel', chevronId: 'chord-setup-chevron' },
        { panelId: 'chord-library-panel', chevronId: 'chord-library-chevron' },
        { panelId: 'chord-intervals-panel', chevronId: 'chord-intervals-chevron' }
    ];
    sections.forEach(({ panelId, chevronId }) => {
        const panelEl = document.getElementById(panelId);
        const chevronEl = document.getElementById(chevronId);
        if (panelEl && chevronEl) {
            panelEl.classList.remove('hidden');
            chevronEl.classList.add('rotate-180');
        }
    });
};

window.collapseAllBuilderSections = function() {
    const sections = [
        { panelId: 'chord-setup-panel', chevronId: 'chord-setup-chevron' },
        { panelId: 'chord-library-panel', chevronId: 'chord-library-chevron' },
        { panelId: 'chord-intervals-panel', chevronId: 'chord-intervals-chevron' }
    ];
    sections.forEach(({ panelId, chevronId }) => {
        const panelEl = document.getElementById(panelId);
        const chevronEl = document.getElementById(chevronId);
        if (panelEl && chevronEl) {
            panelEl.classList.add('hidden');
            chevronEl.classList.remove('rotate-180');
        }
    });
};

window.expandAllMelodySections = function() {
    const sections = [
        { panelId: 'melody-progression-panel', chevronId: 'melody-progression-chevron' },
        { panelId: 'melody-controls-panel', chevronId: 'melody-controls-chevron' },
        { panelId: 'current-melody-panel', chevronId: 'current-melody-chevron' }
    ];
    sections.forEach(({ panelId, chevronId }) => {
        const panelEl = document.getElementById(panelId);
        const chevronEl = document.getElementById(chevronId);
        if (panelEl && chevronEl) {
            panelEl.classList.remove('hidden');
            chevronEl.classList.add('rotate-180');
        }
    });
};

window.collapseAllMelodySections = function() {
    const sections = [
        { panelId: 'melody-progression-panel', chevronId: 'melody-progression-chevron' },
        { panelId: 'melody-controls-panel', chevronId: 'melody-controls-chevron' },
        { panelId: 'current-melody-panel', chevronId: 'current-melody-chevron' }
    ];
    sections.forEach(({ panelId, chevronId }) => {
        const panelEl = document.getElementById(panelId);
        const chevronEl = document.getElementById(chevronId);
        if (panelEl && chevronEl) {
            panelEl.classList.add('hidden');
            chevronEl.classList.remove('rotate-180');
        }
    });
};

// Universal expand/collapse functions that route to the correct tab function
window.expandAllCurrentTab = function() {
    const currentTab = window.currentTab || (typeof getCurrentTab === 'function' ? getCurrentTab() : 'builder');
    if (currentTab === 'trainer') {
        window.expandAllTrainerSections();
    } else if (currentTab === 'builder') {
        window.expandAllBuilderSections();
    } else if (currentTab === 'melody') {
        window.expandAllMelodySections();
    }
};

window.collapseAllCurrentTab = function() {
    const currentTab = window.currentTab || (typeof getCurrentTab === 'function' ? getCurrentTab() : 'builder');
    if (currentTab === 'trainer') {
        window.collapseAllTrainerSections();
    } else if (currentTab === 'builder') {
        window.collapseAllBuilderSections();
    } else if (currentTab === 'melody') {
        window.collapseAllMelodySections();
    }
};

// Scale functions
window.playScale = playScale;
window.changeScaleSpeed = changeScaleSpeed;
window.changeScaleOctave = changeScaleOctave;
window.selectScaleRootNote = selectScaleRootNote;
window.selectScaleType = selectScaleType;

// Expose state to window for modules that access it globally (temporary solution)
window.g_NumOctaves = getNumOctaves();

// Expose state getters for arpeggiator and other modules
window.getEnharmonicPreference = getEnharmonicPreference;
window.getNotationPreference = getNotationPreference;
window.getNumOctaves = getNumOctaves;
window.getTrainerState = getTrainerState;
window.clearHighlights = clearHighlights;
window.getScaleRootIndex = getScaleRootIndex;
window.updateKeyboardLabels = updateKeyboardLabels;
window.getIsFretboardModeOn = getIsFretboardModeOn;
window.setIsFretboardModeOn = setIsFretboardModeOn;

// Audio functions already imported above, just expose to window
window.getPiano = getPiano;
window.getGuitar = getGuitar;
window.getInstrument = getInstrument;
window.getAudioIsReady = getAudioIsReady;
window.initAudio = initAudio;
window.forceStopAllPlayback = forceStopAllPlayback;

// Builder state functions already imported above, just expose setters to window
window.builderRootIndex = 0; // Will be updated
window.builderChordType = 'Major'; // Will be updated
window.builderInversion = 0;
window.builderOctaveShift = 0;
window.builderIntervalType = 'Major 3rd';
window.builderOmittedNotes = [];
window.enharmonicPreference = 'sharp';
window.setBuilderChordType = setBuilderChordType;
window.setBuilderIntervalType = setBuilderIntervalType;

// Preset functions
window.togglePresetPanel = togglePresetPanel;
window.openPresetPanel = openPresetPanel;
window.closePresetPanel = closePresetPanel;

// Circle of Fifths functions
window.toggleCircleOfFifthsPanel = toggleCircleOfFifthsPanel;
window.openCircleOfFifthsPanel = openCircleOfFifthsPanel;
window.closeCircleOfFifthsPanel = closeCircleOfFifthsPanel;

// Guitar Fretboard functions
window.toggleGuitarFretboardPanel = toggleGuitarFretboardPanel;
window.openGuitarFretboardPanel = openGuitarFretboardPanel;
window.closeGuitarFretboardPanel = closeGuitarFretboardPanel;
window.updateGuitarFretboard = updateGuitarFretboard;

// Theory Tools functions
window.toggleTheoryPanel = toggleTheoryPanel;
window.insertSecondaryDominant = insertSecondaryDominant;
window.showModalInterchangeChords = showModalInterchangeChords;
window.insertBorrowedChord = insertBorrowedChord;
window.showChordSubstitutions = showChordSubstitutions;
window.replaceWithSubstitution = replaceWithSubstitution;
window.setSelectedChordIndex = setSelectedChordIndex;
window.getSelectedChordIndex = getSelectedChordIndex;
window.showSecondaryDominantsInfo = showSecondaryDominantsInfo;
window.showModalInterchangeInfo = showModalInterchangeInfo;

// Jazz Extensions functions
window.insertTwoFiveOne = insertTwoFiveOne;
window.insertDiminishedPassing = insertDiminishedPassing;
window.insertChromaticApproach = insertChromaticApproach;
window.applyAlteration = applyAlteration;
window.insertTritoneSubstitution = insertTritoneSubstitution;
window.addExtension = addExtension;
window.suggestReharmonization = suggestReharmonization;
window.showJazzProgressionsInfo = showJazzProgressionsInfo;
window.showAlteredDominantsInfo = showAlteredDominantsInfo;
window.showJazzVoicingsInfo = showJazzVoicingsInfo;

// Quick Add Chord functions (for Progression Builder)
window.toggleQuickAddChord = function() {
    const form = document.getElementById('quick-add-chord-form');
    if (!form) return;

    if (form.classList.contains('hidden')) {
        form.classList.remove('hidden');
    } else {
        form.classList.add('hidden');
    }
};

// Quick Add Chord functions (for Melody Composer)
window.toggleQuickAddChordMelody = function() {
    const form = document.getElementById('quick-add-chord-form-melody');
    if (!form) return;

    if (form.classList.contains('hidden')) {
        form.classList.remove('hidden');
    } else {
        form.classList.add('hidden');
    }
};

window.quickAddChordToProgression = function() {
    // Get selected values
    const rootIndex = parseInt(document.getElementById('quick-add-root')?.value || '0');
    const chordTypeInput = document.getElementById('quick-add-type-input');
    const chordType = chordTypeInput?.value?.trim() || '';
    const inversion = parseInt(document.getElementById('quick-add-inversion')?.value || '0');

    // Validate that a chord/interval was selected from the list
    if (!chordType) {
        alert('Please select a chord or interval from the list.');
        if (chordTypeInput) chordTypeInput.focus();
        return;
    }

    // Get the datalist options to validate the selection
    const datalist = document.getElementById('chord-type-datalist');
    const validOptions = Array.from(datalist.options).map(opt => opt.value);

    if (!validOptions.includes(chordType)) {
        alert('Please select a chord or interval from the list.\n\n"' + chordType + '" is not a valid option.');
        if (chordTypeInput) chordTypeInput.focus();
        return;
    }

    // Use the existing addChordToProgression function from chord builder
    if (window.addChordToProgression && window.selectBuilderRootNote && window.selectBuilderChordType && window.selectBuilderInversion) {
        try {
            // Temporarily set the builder state to match the quick add selection
            // Pass false as playAudio parameter to prevent sound
            window.selectBuilderRootNote(rootIndex, false); // Don't play audio
            window.selectBuilderChordType(chordType, false); // Don't play audio
            window.selectBuilderInversion(inversion, false); // Don't play audio

            // Add the chord without triggering playback
            window.addChordToProgression(false); // false = don't switch to trainer tab

            // Don't hide the form - keep it open for adding more chords
            // window.toggleQuickAddChord(); // Commented out to keep form open

            // Clear the input for next time
            if (chordTypeInput) chordTypeInput.value = '';

            // Show success feedback
            const form = document.getElementById('quick-add-chord-form');
            if (form) {
                const originalBorder = form.style.borderColor;
                form.style.borderColor = '#10b981'; // Green
                setTimeout(() => {
                    form.style.borderColor = originalBorder;
                }, 300);
            }
        } catch (error) {
            console.error('Error adding chord:', error);
            alert('Error adding chord: ' + error.message);
        }
    } else {
        alert('Chord builder functions not available. Please refresh the page.');
    }
};

window.quickAddChordToProgressionMelody = function() {
    // Get selected values from Melody Composer form
    const rootIndex = parseInt(document.getElementById('quick-add-root-melody')?.value || '0');
    const chordTypeInput = document.getElementById('quick-add-type-input-melody');
    const chordType = chordTypeInput?.value?.trim() || '';
    const inversion = parseInt(document.getElementById('quick-add-inversion-melody')?.value || '0');

    // Validate that a chord/interval was selected from the list
    if (!chordType) {
        alert('Please select a chord or interval from the list.');
        if (chordTypeInput) chordTypeInput.focus();
        return;
    }

    // Get the datalist options to validate the selection
    const datalist = document.getElementById('chord-type-datalist-melody');
    const validOptions = Array.from(datalist.options).map(opt => opt.value);

    if (!validOptions.includes(chordType)) {
        alert('Please select a chord or interval from the list.\n\n"' + chordType + '" is not a valid option.');
        if (chordTypeInput) chordTypeInput.focus();
        return;
    }

    // Use the existing addChordToProgression function from chord builder
    if (window.addChordToProgression && window.selectBuilderRootNote && window.selectBuilderChordType && window.selectBuilderInversion) {
        try {
            // Temporarily set the builder state to match the quick add selection
            // Pass false as playAudio parameter to prevent sound
            window.selectBuilderRootNote(rootIndex, false); // Don't play audio
            window.selectBuilderChordType(chordType, false); // Don't play audio
            window.selectBuilderInversion(inversion, false); // Don't play audio

            // Add the chord without triggering playback
            window.addChordToProgression(false); // false = don't switch to trainer tab

            // Don't hide the form - keep it open for adding more chords
            // window.toggleQuickAddChordMelody(); // Commented out to keep form open

            // Clear the input for next time
            if (chordTypeInput) chordTypeInput.value = '';

            // Show success feedback
            const form = document.getElementById('quick-add-chord-form-melody');
            if (form) {
                const originalBorder = form.style.borderColor;
                form.style.borderColor = '#10b981'; // Green
                setTimeout(() => {
                    form.style.borderColor = originalBorder;
                }, 300);
            }
        } catch (error) {
            console.error('Error adding chord:', error);
            alert('Error adding chord: ' + error.message);
        }
    } else {
        alert('Chord builder functions not available. Please refresh the page.');
    }
};

// Melody Generator functions
window.generateMelody = generateMelody;
window.playGeneratedMelody = playGeneratedMelody;
window.stopMelody = stopMelody;
window.saveMelody = saveMelody;
window.getCurrentMelody = getCurrentMelody;

// Combined Melody + Chord Progression functions
window.toggleCombinedMelodyView = function(showNotation) {
    // Sync both toggles
    const toggle1 = document.getElementById('combined-view-toggle');
    const toggle2 = document.getElementById('combined-view-toggle-main');
    if (toggle1) toggle1.checked = showNotation;
    if (toggle2) toggle2.checked = showNotation;

    // Toggle views in both locations
    const timeline1 = document.getElementById('chord-melody-timeline');
    const notation1 = document.getElementById('chord-melody-notation');
    const timeline2 = document.getElementById('chord-melody-timeline-main');
    const notation2 = document.getElementById('chord-melody-notation-main');

    if (showNotation) {
        // Show notation, hide timeline
        if (timeline1) timeline1.classList.add('hidden');
        if (notation1) notation1.classList.remove('hidden');
        if (timeline2) timeline2.classList.add('hidden');
        if (notation2) notation2.classList.remove('hidden');

        // Render notation if we have melody
        renderCombinedNotation();
    } else {
        // Show timeline, hide notation
        if (timeline1) timeline1.classList.remove('hidden');
        if (notation1) notation1.classList.add('hidden');
        if (timeline2) timeline2.classList.remove('hidden');
        if (notation2) notation2.classList.add('hidden');
    }
};

let combinedMelodyPart = null;
let combinedChordPart = null;

window.playCombinedMelody = async function() {
    const melody = getCurrentMelody();
    const progressionData = window.getTrainerState ? window.getTrainerState().progressionData : [];

    if (!melody || !melody.notes || melody.notes.length === 0) {
        alert('Please generate a melody first.');
        return;
    }

    if (!progressionData || progressionData.length === 0) {
        alert('Please create a chord progression first.');
        return;
    }

    // Stop any currently playing combined melody
    if (combinedMelodyPart) {
        combinedMelodyPart.stop();
        combinedMelodyPart.dispose();
        combinedMelodyPart = null;
    }
    if (combinedChordPart) {
        combinedChordPart.stop();
        combinedChordPart.dispose();
        combinedChordPart = null;
    }

    // Ensure audio is ready
    await Tone.start();

    // Get instruments
    const piano = getPiano();
    const synth = getInstrument();

    if (!piano || !synth) {
        alert('Audio instruments not ready. Please wait a moment and try again.');
        return;
    }

    // Get durations from melody if available, otherwise use default
    const melodyDurations = melody.durations || melody.notes.map(() => '8n');

    // Calculate total duration in seconds for each note
    let currentTime = 0;
    const melodyEvents = melody.notes.map((note, index) => {
        const duration = melodyDurations[index] || '8n';

        // Convert Tone.js duration to seconds (at 120 BPM: 4n = 0.5s, 8n = 0.25s, 16n = 0.125s)
        let durationInSeconds = 0.25; // default to 8n
        if (duration === '4n') durationInSeconds = 0.5;
        else if (duration === '8n') durationInSeconds = 0.25;
        else if (duration === '16n') durationInSeconds = 0.125;
        else if (duration === '2n') durationInSeconds = 1.0;
        else if (duration === '1n') durationInSeconds = 2.0;

        // Ensure duration is positive
        if (durationInSeconds <= 0) {
            console.warn('Invalid duration for note', index, ':', duration, '- using 0.25s');
            durationInSeconds = 0.25;
        }

        const event = {
            time: currentTime,
            note: note,
            duration: duration
        };

        currentTime += durationInSeconds;
        return event;
    });

    // Calculate chord duration based on total melody duration
    const totalMelodyDuration = currentTime;
    const chordDuration = totalMelodyDuration / progressionData.length;

    console.log('Total melody duration:', totalMelodyDuration, 'seconds');
    console.log('Chord duration:', chordDuration, 'seconds each');

    // Create chord events (one per chord in progression)
    const chordEvents = progressionData.map((chordData, index) => {
        // Handle different chord data structures
        let chordNotes = [];

        // Try rhNotes first (right hand notes)
        if (chordData.rhNotes && Array.isArray(chordData.rhNotes)) {
            chordNotes = [...chordData.rhNotes];
        }
        // Fall back to notes property
        else if (chordData.notes && Array.isArray(chordData.notes)) {
            chordNotes = [...chordData.notes];
        }

        // Add left hand notes if available
        if (chordData.lhNotes && Array.isArray(chordData.lhNotes) && chordData.lhNotes.length > 0) {
            chordNotes.push(...chordData.lhNotes);
        }

        return {
            time: index * chordDuration,
            notes: chordNotes,
            duration: chordDuration
        };
    });

    console.log('Playing combined melody + chords:', melodyEvents.length, 'melody notes,', chordEvents.length, 'chords');

    // Create Tone.Part for melody
    combinedMelodyPart = new Tone.Part((time, event) => {
        synth.triggerAttackRelease(event.note, event.duration, time);
    }, melodyEvents);

    // Create Tone.Part for chords
    combinedChordPart = new Tone.Part((time, event) => {
        piano.triggerAttackRelease(event.notes, event.duration, time);
    }, chordEvents);

    try {
        // Ensure Transport is stopped and reset before starting
        Tone.Transport.stop();
        Tone.Transport.cancel();
        Tone.Transport.position = 0;

        // Start playback
        combinedMelodyPart.start(0);
        combinedChordPart.start(0);

        // Start transport
        Tone.Transport.start();

        console.log('Combined playback started!');

        // Stop after all notes complete
        const totalDuration = Math.max(
            melodyEvents[melodyEvents.length - 1].time + 0.5,
            chordEvents[chordEvents.length - 1].time + chordDuration
        );

        console.log('Total duration:', totalDuration, 'seconds');

        setTimeout(() => {
            Tone.Transport.stop();
            Tone.Transport.position = 0;
            if (combinedMelodyPart) {
                combinedMelodyPart.stop();
                combinedMelodyPart.dispose();
                combinedMelodyPart = null;
            }
            if (combinedChordPart) {
                combinedChordPart.stop();
                combinedChordPart.dispose();
                combinedChordPart = null;
            }
            console.log('Combined playback finished!');
        }, totalDuration * 1000 + 500);
    } catch (error) {
        console.error('Error during combined playback:', error);
        alert('Error playing combined melody: ' + error.message);
    }
};

function renderCombinedNotation() {
    // This will render the combined notation using VexFlow
    // For now, just show a placeholder
    const canvas1 = document.getElementById('chord-melody-notation-canvas');
    const canvas2 = document.getElementById('chord-melody-notation-canvas-main');

    [canvas1, canvas2].forEach(canvas => {
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('Combined notation view coming soon!', canvas.width / 2, canvas.height / 2);
        ctx.fillText('This will show melody notes over chord symbols.', canvas.width / 2, canvas.height / 2 + 25);
    });
};
window.toggleMelodyGeneratorPanel = toggleMelodyGeneratorPanel;
window.toggleMelodyEditMode = toggleMelodyEditMode;
window.updateMelodyNote = updateMelodyNote;
window.deleteMelodyNote = deleteMelodyNote;
window.insertMelodyNote = insertMelodyNote;
window.refreshMelodyDisplay = refreshMelodyDisplay;

// Expose interactive melody composition functions
window.initInteractiveMelody = initInteractiveMelody;
window.addNoteToInteractiveMelody = addNoteToInteractiveMelody;
window.deleteLastNote = deleteLastNote;
window.clearInteractiveMelody = clearInteractiveMelody;
window.setNoteDuration = setNoteDuration;
window.setNoteDotted = setNoteDotted;
window.getCurrentNoteDuration = getCurrentNoteDuration;
window.getCurrentNoteDotted = getCurrentNoteDotted;
window.renderChordProgressionStaff = renderChordProgressionStaff;
window.renderInteractiveMelodyStaff = renderInteractiveMelodyStaff;
window.getInteractiveMelody = getInteractiveMelody;
window.toggleInteractiveMode = toggleInteractiveMode;
window.playInteractiveMelodyWithChords = playInteractiveMelodyWithChords;
// New notation editor functions
window.addRestToMelody = addRestToMelody;
window.setTimeSignature = setTimeSignature;
window.tieLastNote = tieLastNote;
window.getEditorState = getEditorState;
window.setAccidental = setAccidental;
window.setDynamic = setDynamic;
window.playAllMelody = playAllMelody;
window.stopPlayAllMelody = stopPlayAllMelody;
window.playMeasure = playMeasure;
window.playSelectedMeasure = playSelectedMeasure;
window.playFromSelectedMeasure = playFromSelectedMeasure;
window.startStepMeasureMelody = startStepMeasureMelody;
window.stopStepMeasureMelody = stopStepMeasureMelody;
window.setMelodyClef = setMelodyClef;
window.setChordClef = setChordClef;
window.toggleMelodyHighlight = function(enabled) {
    setHighlightEnabled(enabled);
    // Re-render the canvas to show/hide highlighting
    const canvas = document.getElementById('interactive-melody-notation-canvas');
    if (canvas) {
        if (window.isInteractiveMode && window.renderInteractiveMelodyStaff) {
            window.renderInteractiveMelodyStaff(canvas);
        } else if (window.renderChordProgressionStaff) {
            window.renderChordProgressionStaff(canvas);
        }
    }
};

/**
 * Toggle melody recording on/off
 * @param {boolean} isRecording - true to start recording (Record), false to stop (Stop)
 */
window.toggleMelodyRecording = function(isRecording) {
    // Show/hide chord clef toggle based on recording state (two staves shown when recording)
    const chordClefToggle = document.getElementById('chord-clef-toggle-container');
    if (chordClefToggle) {
        if (isRecording) {
            chordClefToggle.classList.remove('hidden');
        } else {
            chordClefToggle.classList.add('hidden');
        }
    }
    
            // Sync time signature selector with current state
            const timeSigSelect = document.getElementById('time-signature-select');
            if (timeSigSelect && window.getEditorState) {
                const state = window.getEditorState();
                if (state && state.timeSignature) {
                    timeSigSelect.value = state.timeSignature;
                }
            }
            
            if (isRecording) {
                // NOTE: Don't reset duration here - preserve user's selected duration
                // The duration is already initialized in initInteractiveMelody and clearInteractiveMelody
                if (window.setNoteDotted) {
                    // Only reset dotted if user hasn't selected it, but don't force it
                    const dotCheckbox = document.getElementById('note-duration-dot');
                    if (dotCheckbox) {
                        // Keep the current state, don't reset
                    }
                }
        // Start recording - enable interactive mode
        try {
            if (!window.isInteractiveMode) {
                const result = toggleInteractiveMode();
                if (result) {
                    window.isInteractiveMode = true;
                    // Render the staff with chord progression and any existing melody
                    if (window.renderInteractiveMelodyStaff) {
                        const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
                        if (interactiveCanvas) {
                            window.renderInteractiveMelodyStaff(interactiveCanvas);
                        }
                    } else if (window.renderChordProgressionStaff) {
                        const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
                        if (interactiveCanvas) {
                            window.renderChordProgressionStaff(interactiveCanvas);
                        }
                    }
                } else {
                    // Failed to start - need progression first
                    // Uncheck the toggle
                    const toggle = document.getElementById('melody-recording-toggle');
                    if (toggle) {
                        toggle.checked = false;
                    }
                    // Hide chord clef toggle since recording didn't start
                    if (chordClefToggle) {
                        chordClefToggle.classList.add('hidden');
                    }
                    alert('Please create a chord progression first in the Progression Builder.');
                    return;
                }
            } else {
                // Already in interactive mode
                // Re-render the staff
                if (window.renderInteractiveMelodyStaff) {
                    const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
                    if (interactiveCanvas) {
                        window.renderInteractiveMelodyStaff(interactiveCanvas);
                    }
                }
            }
        } catch (e) {
            console.error('Error starting recording:', e);
            // Uncheck the toggle
            const toggle = document.getElementById('melody-recording-toggle');
            if (toggle) {
                toggle.checked = false;
            }
            // Hide chord clef toggle on error
            if (chordClefToggle) {
                chordClefToggle.classList.add('hidden');
            }
            alert('Error starting recording. Please make sure you have a chord progression.');
        }
    } else {
        // Stop recording - disable interactive mode
        if (window.isInteractiveMode) {
            toggleInteractiveMode();
            window.isInteractiveMode = false;
        }
        // Still render the chord progression even when not recording
        if (window.renderChordProgressionStaff) {
            const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
            if (interactiveCanvas) {
                window.renderChordProgressionStaff(interactiveCanvas);
            }
        }
    }
};

/**
 * Toggle between Free and AI melody modes
 * @param {boolean} isAIMode - true for AI mode, false for Free mode
 */
window.toggleMelodyMode = function(isAIMode) {
    const aiModeControls = document.getElementById('ai-mode-controls');
    const freeModeControls = document.getElementById('free-mode-controls');

    // Show/hide recording toggle based on mode
    const recordingToggleContainer = document.getElementById('melody-recording-toggle-container');
    
    if (isAIMode) {
        // AI Mode: Hide free mode, show AI controls
        if (freeModeControls) {
            freeModeControls.classList.add('hidden');
        }
        if (aiModeControls) {
            aiModeControls.classList.remove('hidden');
        }
        // Hide recording toggle in AI mode
        if (recordingToggleContainer) {
            recordingToggleContainer.classList.add('hidden');
        }
        // Disable interactive mode and stop recording if active
        if (window.isInteractiveMode) {
            toggleInteractiveMode();
            window.isInteractiveMode = false;
        }
        // Uncheck recording toggle
        const recordingToggle = document.getElementById('melody-recording-toggle');
        if (recordingToggle) {
            recordingToggle.checked = false;
        }
    } else {
        // Free Mode: Hide AI controls, show free mode
        if (aiModeControls) {
            aiModeControls.classList.add('hidden');
        }
        if (freeModeControls) {
            freeModeControls.classList.remove('hidden');
        }
        // Show recording toggle in Free mode
        if (recordingToggleContainer) {
            recordingToggleContainer.classList.remove('hidden');
        }
        // Note: Interactive mode will be enabled when user toggles recording
        // We don't automatically enable it here
        // But render the chord progression so user can see it
        setTimeout(() => {
            if (window.renderChordProgressionStaff) {
                const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
                if (interactiveCanvas) {
                    window.renderChordProgressionStaff(interactiveCanvas);
                }
            }
        }, 100);
    }
};

/**
 * Update UI when switching between melody composition modes
 * @deprecated This function is kept for backward compatibility but may not be used with new Free/AI toggle
 */
window.updateMelodyModeUI = function() {
    const isInteractive = window.isInteractiveMode || false;

    // Update toggle button
    const toggleBtn = document.getElementById('toggle-interactive-mode-btn');
    if (toggleBtn) {
        toggleBtn.textContent = isInteractive ? 'Stop Interactive Mode' : 'Start Interactive Mode';
        toggleBtn.className = isInteractive
            ? 'px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg shadow transition'
            : 'px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow transition';
    }

    // Update mode text
    const modeText = document.getElementById('current-mode-text');
    if (modeText) {
        modeText.textContent = isInteractive ? 'Interactive Mode' : 'Generate Mode';
    }

    // Update help text
    const helpText = document.getElementById('mode-help-text');
    if (helpText) {
        helpText.textContent = isInteractive
            ? 'Click notes on the piano keyboard to build your melody. Each note is added as a quarter note in 4/4 time.'
            : 'Automatically create melodies with AI. Switch to Interactive Mode to compose by clicking notes on the keyboard!';
    }

    // Show/hide control groups
    const generatedControls = document.getElementById('generated-mode-controls');
    const interactiveControls = document.getElementById('interactive-mode-controls');

    if (generatedControls) {
        generatedControls.style.display = isInteractive ? 'none' : 'flex';
    }
    if (interactiveControls) {
        interactiveControls.style.display = isInteractive ? 'flex' : 'none';
    }

    // Store state globally for access
    window.isInteractiveMode = isInteractive;
};

window.onSelectNoteToEdit = function() {
    // Auto-select current note value when editing - works for both tabs
    const noteSelect = document.getElementById('edit-note-select') || document.getElementById('edit-note-select-main');
    const newNoteSelect = document.getElementById('edit-new-note-select') || document.getElementById('edit-new-note-select-main');
    if (noteSelect && newNoteSelect) {
        const melody = getCurrentMelody();
        const index = parseInt(noteSelect.value);
        if (!isNaN(index) && melody) {
            newNoteSelect.value = melody.notes[index];
        }
    }
};

// Initialize application when DOM is ready
window.onload = () => {
    // Calculate and set keyboard sticky position based on header height
    const header = document.querySelector('.grid.items-center.bg-white\\/80');
    if (header) {
        const headerHeight = header.offsetHeight;
        const headerTop = parseInt(getComputedStyle(header).top) || 16; // top-4 = 1rem = 16px
        const keyboardTop = headerHeight + headerTop;
        document.documentElement.style.setProperty('--header-height', `${keyboardTop}px`);
    }
    
    // Ensure g_NumOctaves is available
    window.g_NumOctaves = getNumOctaves();

    // Render initial UI
    renderKeyboard();
    // Expose g_KeyboardKeys to window for modules that need it
    window.g_KeyboardKeys = g_KeyboardKeys;
    renderProgressionControls();
    renderProgressionDisplay();
    renderBuilderSelectors();
    renderScaleSelectors();

    // Initialize window state for modules that access it
    window.currentTab = getCurrentTab();
    window.enharmonicPreference = getEnharmonicPreference();
    window.isRomanNumeralEngineOn = getIsRomanNumeralEngineOn();
    window.isKeyNamesOn = getIsKeyNamesOn();
    
    // Initialize toggle states to match initial preferences
    // enharmonic: initial preference is 'sharp', so toggle should be unchecked (false = sharp)
    document.getElementById('enharmonic-toggle').checked = false;
    // Update enharmonic indicators to match initial state
    const sharpIndicator = document.getElementById('sharp-indicator');
    const flatIndicator = document.getElementById('flat-indicator');
    if (getEnharmonicPreference() === 'sharp') {
        sharpIndicator.classList.remove('text-gray-500');
        sharpIndicator.classList.add('text-indigo-300');
        flatIndicator.classList.remove('text-indigo-300');
        flatIndicator.classList.add('text-gray-500');
    } else {
        flatIndicator.classList.remove('text-gray-500');
        flatIndicator.classList.add('text-indigo-300');
        sharpIndicator.classList.remove('text-indigo-300');
        sharpIndicator.classList.add('text-gray-500');
    }
    document.getElementById('notation-toggle').checked = false;
    document.getElementById('suggestion-toggle').checked = false;
    document.getElementById('roman-numeral-toggle').checked = false;
    document.getElementById('key-names-toggle').checked = false;
    document.getElementById('classic-keyboard-toggle').checked = false;
    document.getElementById('compact-controls-toggle').checked = false;

    // Initialize melody mode toggle (default to Free mode - unchecked)
    const melodyModeToggle = document.getElementById('melody-mode-toggle');
    const recordingToggleContainer = document.getElementById('melody-recording-toggle-container');
    if (melodyModeToggle) {
        melodyModeToggle.checked = false; // Free mode is default (unchecked)
        // Initialize Free mode - ensure UI is in correct state
        const aiModeControls = document.getElementById('ai-mode-controls');
        const freeModeControls = document.getElementById('free-mode-controls');
        if (aiModeControls) {
            aiModeControls.classList.add('hidden');
        }
        if (freeModeControls) {
            freeModeControls.classList.remove('hidden');
        }
        // Show recording toggle in Free mode (since Free is the default)
        if (recordingToggleContainer) {
            recordingToggleContainer.classList.remove('hidden');
        }
        // Set initial state but don't automatically enable interactive mode
        window.isInteractiveMode = false;
    }

    // Initialize melody recording toggle (default to off/Stop)
    const melodyRecordingToggle = document.getElementById('melody-recording-toggle');
    if (melodyRecordingToggle) {
        melodyRecordingToggle.checked = false; // Stop is default (unchecked)
        // Render chord progression if in Free mode
        setTimeout(() => {
            const freeModeControls = document.getElementById('free-mode-controls');
            if (freeModeControls && !freeModeControls.classList.contains('hidden')) {
                // Wait a bit longer to ensure canvas is rendered
                setTimeout(() => {
                    if (window.renderChordProgressionStaff) {
                        const interactiveCanvas = document.getElementById('interactive-melody-notation-canvas');
                        if (interactiveCanvas) {
                            window.renderChordProgressionStaff(interactiveCanvas);
                        }
                    }
                }, 100);
            }
        }, 300);
    }

    // Initialize clef toggle button states (ensure chord clef toggle is hidden initially)
    const chordClefToggle = document.getElementById('chord-clef-toggle-container');
    if (chordClefToggle) {
        chordClefToggle.classList.add('hidden'); // Hidden by default (not recording)
    }
    
    // Set initial button states
    setTimeout(() => {
        if (setMelodyClef && setChordClef) {
            // Trigger update to set initial button states (treble is default)
            setMelodyClef('treble');
            setChordClef('treble');
        }
    }, 200);
    
    // Initialize indicator colors for Notation Style
    const notationFullIndicator = document.getElementById('notation-full-indicator');
    const notationSymbolIndicator = document.getElementById('notation-symbol-indicator');
    if (getNotationPreference() === 'full') {
        notationFullIndicator.classList.remove('text-gray-500');
        notationFullIndicator.classList.add('text-indigo-300');
        notationSymbolIndicator.classList.remove('text-indigo-300');
        notationSymbolIndicator.classList.add('text-gray-500');
    } else {
        notationSymbolIndicator.classList.remove('text-gray-500');
        notationSymbolIndicator.classList.add('text-indigo-300');
        notationFullIndicator.classList.remove('text-indigo-300');
        notationFullIndicator.classList.add('text-gray-500');
    }

    // Initialize indicator colors for Roman Numerals
    const romanOffIndicator = document.getElementById('roman-off-indicator');
    const romanOnIndicator = document.getElementById('roman-on-indicator');
    if (getIsRomanNumeralEngineOn()) {
        romanOnIndicator.classList.remove('text-gray-500');
        romanOnIndicator.classList.add('text-indigo-300');
        romanOffIndicator.classList.remove('text-indigo-300');
        romanOffIndicator.classList.add('text-gray-500');
    } else {
        romanOffIndicator.classList.remove('text-gray-500');
        romanOffIndicator.classList.add('text-indigo-300');
        romanOnIndicator.classList.remove('text-indigo-300');
        romanOnIndicator.classList.add('text-gray-500');
    }

    // Initialize indicator colors for Key Names
    const keyNamesOffIndicator = document.getElementById('key-names-off-indicator');
    const keyNamesOnIndicator = document.getElementById('key-names-on-indicator');
    if (getIsKeyNamesOn()) {
        keyNamesOnIndicator.classList.remove('text-gray-500');
        keyNamesOnIndicator.classList.add('text-indigo-300');
        keyNamesOffIndicator.classList.remove('text-indigo-300');
        keyNamesOffIndicator.classList.add('text-gray-500');
    } else {
        keyNamesOffIndicator.classList.remove('text-gray-500');
        keyNamesOffIndicator.classList.add('text-indigo-300');
        keyNamesOnIndicator.classList.remove('text-indigo-300');
        keyNamesOnIndicator.classList.add('text-gray-500');
    }

    // Initialize indicator colors for Classic Keyboard
    const classicKeyboardOffIndicator = document.getElementById('classic-keyboard-off-indicator');
    const classicKeyboardOnIndicator = document.getElementById('classic-keyboard-on-indicator');
    if (getIsClassicKeyboardOn()) {
        // Classic keyboard is ON - show classic style
        classicKeyboardOnIndicator.classList.remove('text-gray-500');
        classicKeyboardOnIndicator.classList.add('text-indigo-300');
        classicKeyboardOffIndicator.classList.remove('text-indigo-300');
        classicKeyboardOffIndicator.classList.add('text-gray-500');
        // Remove modern keyboard class to show classic style
        const keyboard = document.getElementById('piano-keyboard');
        if (keyboard) {
            keyboard.classList.remove('modern-keyboard');
        }
    } else {
        // Classic keyboard is OFF - show modern style (default)
        classicKeyboardOffIndicator.classList.remove('text-gray-500');
        classicKeyboardOffIndicator.classList.add('text-indigo-300');
        classicKeyboardOnIndicator.classList.remove('text-indigo-300');
        classicKeyboardOnIndicator.classList.add('text-gray-500');
        // Add modern keyboard class to show modern style
        const keyboard = document.getElementById('piano-keyboard');
        if (keyboard) {
            keyboard.classList.add('modern-keyboard');
        }
    }

    // Initialize window.isClassicKeyboardOn
    window.isClassicKeyboardOn = getIsClassicKeyboardOn();

    // Initialize indicator colors for Compact Controls
    const compactOffIndicator = document.getElementById('compact-off-indicator');
    const compactOnIndicator = document.getElementById('compact-on-indicator');
    if (getIsCompactModeOn()) {
        compactOnIndicator.classList.remove('text-gray-500');
        compactOnIndicator.classList.add('text-indigo-300');
        compactOffIndicator.classList.remove('text-indigo-300');
        compactOffIndicator.classList.add('text-gray-500');
    } else {
        compactOffIndicator.classList.remove('text-gray-500');
        compactOffIndicator.classList.add('text-indigo-300');
        compactOnIndicator.classList.remove('text-indigo-300');
        compactOnIndicator.classList.add('text-gray-500');
    }

    // Apply compact mode class if enabled
    if (getIsCompactModeOn()) {
        document.body.classList.add('compact-mode');
    }

    // Initialize fretboard toggle - default to off (piano keyboard shown)
    document.getElementById('fretboard-toggle').checked = false;
    const fretboardPianoIndicator = document.getElementById('fretboard-piano-indicator');
    const fretboardGuitarIndicator = document.getElementById('fretboard-guitar-indicator');
    if (fretboardPianoIndicator && fretboardGuitarIndicator) {
        fretboardPianoIndicator.classList.remove('text-gray-500');
        fretboardPianoIndicator.classList.add('text-indigo-300');
        fretboardGuitarIndicator.classList.remove('text-indigo-300');
        fretboardGuitarIndicator.classList.add('text-gray-500');
    }

    // Initialize trainer state
    loadProgression();
    
    // Set window.trainerState for modules that access it
    window.trainerState = getTrainerState();

    // Switch to builder tab
    switchTab('builder');

    // Update UI elements
    // Call updateKeyboardLabels after a short delay to ensure keyboard is fully rendered
    setTimeout(() => {
        updateKeyboardLabels();
    }, 100);
    updateLHInversionSelector();
    updateBuilderOctaveUI();
    updateScaleOctaveUI();
    updateScaleSpeedUI();
    updateArpeggioSpeedUI();

    // Load saved state for floating controls visibility
    const savedVisibility = localStorage.getItem('isFloatingControlsVisible');
    if (savedVisibility === 'false') toggleFloatingControls();

    // Initialize audio
    initAudio();

    // Initialize audio context keep-alive (resumes audio when user returns to page)
    initAudioContextKeepAlive();

    // Initialize preset system
    initPresetUI();

    // Initialize Circle of Fifths
    initCircleOfFifths();

    // Initialize Guitar Fretboard
    initGuitarFretboard();

    // Initialize Theory Tools
    initTheoryTools();

    // Initialize section drag-and-drop
    initAllSectionDragDrop();

    // Setup responsive title abbreviation
    setupResponsiveTitle();

    // Initialize undo/redo button states
    updateUndoRedoButtons();
    
    // Initialize Sortable for progression - commented out for now, need to access trainer state properly
    // const progressionContainer = document.getElementById('progression-visualization');
    // if (progressionContainer && typeof Sortable !== 'undefined') {
    //     new Sortable(progressionContainer, {
    //         animation: 150,
    //         ghostClass: 'sortable-ghost'
    //     });
    // }

    // Audio context will be resumed automatically by Tone.js when user interacts
};

// ============================================================================
// Preset Loading Function
// ============================================================================

/**
 * Load preset data and apply to current state
 * @param {string} category - Preset category ('chord', 'progression', 'scale')
 * @param {object} data - Preset data object
 */
window.loadPresetData = function(category, data) {
    console.log('loadPresetData called - category:', category, 'data:', data);

    try {
        switch (category) {
            case 'chord':
                console.log('Loading chord preset...');
                // Switch to builder tab first
                switchTab('builder');

                // Load builder state
                if (data.builderRootIndex !== undefined) {
                    console.log('Setting root:', data.builderRootIndex);
                    selectBuilderRootNote(data.builderRootIndex);
                }
                if (data.builderChordType !== undefined) {
                    console.log('Setting chord type:', data.builderChordType);
                    selectBuilderChordType(data.builderChordType);
                }
                if (data.builderIntervalType !== undefined) {
                    console.log('Setting interval:', data.builderIntervalType);
                    selectBuilderInterval(data.builderIntervalType);
                }
                if (data.builderInversion !== undefined) {
                    console.log('Setting inversion:', data.builderInversion);
                    selectBuilderInversion(data.builderInversion);
                }
                if (data.builderOctaveShift !== undefined && data.builderOctaveShift !== 0) {
                    console.log('Setting octave shift:', data.builderOctaveShift);
                    const currentShift = getBuilderOctaveShift();
                    // Reset to 0 first
                    for (let i = 0; i < Math.abs(currentShift); i++) {
                        changeBuilderOctave(currentShift < 0 ? 'up' : 'down');
                    }
                    // Apply target shift
                    const targetShift = data.builderOctaveShift;
                    for (let i = 0; i < Math.abs(targetShift); i++) {
                        changeBuilderOctave(targetShift > 0 ? 'up' : 'down');
                    }
                }

                updateBuilderDisplay();
                console.log('Chord preset loaded');
                break;

            case 'progression':
                console.log('Loading progression preset...');
                // Switch to progression tab first
                switchTab('trainer');

                // Load progression state
                if (data.progressionData && Array.isArray(data.progressionData)) {
                    console.log('Setting progression:', data.progressionData);
                    setProgressionData(data.progressionData);
                    renderProgressionDisplay();
                    console.log('Progression loaded');
                } else {
                    console.error('No valid progressionData in preset');
                }
                break;

            case 'scale':
                console.log('Loading scale preset...');
                // Switch to scale tab first
                switchTab('scales');

                // Load scale state
                if (data.scaleRootIndex !== undefined) {
                    console.log('Setting scale root:', data.scaleRootIndex);
                    selectScaleRootNote(data.scaleRootIndex);
                }
                if (data.scaleType !== undefined) {
                    console.log('Setting scale type:', data.scaleType);
                    selectScaleType(data.scaleType);
                }
                if (data.scaleOctaveShift !== undefined && data.scaleOctaveShift !== 0) {
                    const targetShift = data.scaleOctaveShift;
                    for (let i = 0; i < Math.abs(targetShift); i++) {
                        changeScaleOctave(targetShift > 0 ? 'up' : 'down');
                    }
                }
                console.log('Scale preset loaded');
                break;

            default:
                console.error('Unknown preset category:', category);
                throw new Error(`Unknown category: ${category}`);
        }
    } catch (error) {
        console.error('Error loading preset:', error);
        throw error; // Re-throw for the calling function
    }
};

// Set up keyboard shortcuts for Undo/Redo
document.addEventListener('keydown', (event) => {
    // Check if we're in the Progression Builder tab
    const currentTab = document.querySelector('[id^="tab-"]:not(.hidden)');
    const isTrainerTab = currentTab && currentTab.id === 'tab-trainer';

    // Only handle undo/redo in trainer tab
    if (!isTrainerTab) return;

    // Check if user is typing in an input or select element
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT')) {
        return; // Don't interfere with typing
    }

    // Ctrl+Z or Cmd+Z (Mac) for Undo
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
    }

    // Ctrl+Shift+Z or Cmd+Shift+Z (Mac) for Redo
    if ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) {
        event.preventDefault();
        handleRedo();
    }

    // Alternative: Ctrl+Y or Cmd+Y (Mac) for Redo
    if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
        event.preventDefault();
        handleRedo();
    }
});

// ===========================
// MELODY COMPOSER UI FUNCTIONS
// ===========================

// Removed setMelodyMode function - Composition Mode and Free Melody Settings UI have been removed

/**
 * Toggle the melody controls panel visibility
 */
window.toggleMelodyControlsPanel = function() {
    const panel = document.getElementById('melody-controls-panel');
    const chevron = document.getElementById('melody-controls-chevron');

    if (panel && chevron) {
        const isHidden = panel.classList.contains('hidden');
        panel.classList.toggle('hidden');
        chevron.classList.toggle('rotate-180');
        
        // When panel is opened, render chord progression if in Free mode
        if (isHidden) {
            setTimeout(() => {
                const freeModeControls = document.getElementById('free-mode-controls');
                if (freeModeControls && !freeModeControls.classList.contains('hidden')) {
                    const canvas = document.getElementById('interactive-melody-notation-canvas');
                    if (canvas && window.renderChordProgressionStaff) {
                        window.renderChordProgressionStaff(canvas);
                    }
                }
            }, 100);
        }
    }
};

/**
 * Sync progression data from Progression Builder to Melody Composer tab
 * Now uses the same rendering function as the Progression Builder for consistency
 */
window.syncProgressionToMelodyTab = function() {
    const trainerState = getTrainerState();
    const melodyCurrentKeyDisplay = document.getElementById('melody-current-key-display');

    // Update key display
    if (melodyCurrentKeyDisplay && trainerState.currentKey) {
        melodyCurrentKeyDisplay.textContent = trainerState.currentKey;
    }

    // Use the same rendering function as the Progression Builder
    // This ensures both tabs show exactly the same information
    // Pass false for syncBothTabs to avoid infinite recursion when called from tab switch
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('melody-progression-visualization', false);
    }
};
