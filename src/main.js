/**
 * Main Entry Point
 * Initializes the application and exposes necessary functions to the global scope for HTML event handlers
 * 
 * GOOGLE CUSTOM SEARCH API CONFIGURATION:
 * Internet search for "Search Song Chords" feature is enabled.
 * 
 * SECURITY WARNING: API keys in client-side code are visible to anyone.
 * Consider using a backend proxy for production deployments.
 * 
 * See GOOGLE_SEARCH_API_SETUP.md for detailed setup instructions.
 */

// Google Custom Search API Configuration
window.GOOGLE_SEARCH_API_KEY = 'AIzaSyCKMAccLd1yCc9tuTWmCBItpnB7QxtZiWo';
window.GOOGLE_SEARCH_ENGINE_ID = '6233b4a886ca64ede';

// Import all necessary modules
import { switchTab, refreshAllTabs } from './modules/ui/tabs.js';
import { initAllSectionDragDrop } from './modules/ui/sectionDragDrop.js';
import { initAllSectionSidebars, triggerSectionSidebarUpdate } from './modules/ui/sectionSidebar.js';
import { initFloatingSuggestionsPanel } from './modules/ui/floatingSuggestionsPanel.js';
import { showModal, hideModal } from './modules/ui/modals.js';
import { renderKeyboard, updateKeyboardLabels, updateKeyNames, clearHighlights, g_KeyboardKeys } from './modules/ui/keyboard.js';
import { updateKeySignatureDisplay, setupResponsiveTitle } from './modules/ui/header.js';
import { toggleSidebar } from './modules/ui/sidebar.js';
import { showSettingsModal, showChordWeightsModal, showMelodyWeightsModal } from './modules/ui/settingsModal.js';
import { initPresetUI, togglePresetPanel, openPresetPanel, closePresetPanel } from './modules/ui/presetUI.js';
import { initUnifiedSuggestionsPanel, updateUnifiedSuggestions } from './modules/ui/unifiedSuggestionsPanel.js';
import { openManualChordEntryModal, closeManualChordEntryModal } from './modules/ui/manualChordEntryModal.js';
import { showAutoHarmonizeModal } from './modules/ui/autoHarmonizeModal.js';
import { showTensionOptimizerModal } from './modules/ui/tensionOptimizerModal.js';
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
    toggleSongSearchPanel,
    searchSongChords,
    importSongProgression,
    openUltimateGuitarSearch,
    importInternetSongProgression
} from './modules/features/songSearch.js';
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
    selectBuilderChordBySymbol,
    updateBuilderOctaveUI,
    updateLHInversionSelector,
    addChordToProgression,
    addSpecificChordToProgression,
    updateChordTypeButtonCaptions,
    updateIntervalButtonCaptions,
    capturePlayedChord,
    updateButtonSelection,
    toggleChordSetupPanel,
    toggleChordLibraryPanel,
    toggleChordLibraryMode,
    toggleChordIntervalsPanel,
    toggleBuilderProgressionPanel,
    toggleBuilderCardView,
    renderBuilderProgressionCards,
    updateBuilderProgressionPanel
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
    saveStateBeforeChange,
    toggleProgressionNote,
    toggleProgressionLHNote,
    addToProgressionData,
    toggleStyleMoodInsightsPanel,
    toggleProgressionControlsPanel,
    toggleProgressionCardsPanel,
    toggleAllStaffNotation,
    clearProgression,
    importChordList,
    openTemplateBrowser,
    showRhythmPatternModal,
    toggleSimplifiedView,
    toggleTensionCurve,
    selectChordCard,
    renderProgressionDisplayForBuilder
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
import { initAudio, getPiano, getGuitar, getInstrument, getAudioIsReady, getCameraShutter, forceStopAllPlayback, initAudioContextKeepAlive } from './modules/audio/audioEngine.js';
import { updateUndoRedoButtons } from './modules/utils/undoRedo.js';
import { savePanelState, restoreAllPanelStates, restoreTabPanelStates } from './modules/storage/panelState.js';
import {
    saveProjectToFile,
    loadProjectFromFile,
    applyProjectToState,
    validateProjectData,
    PROJECT_FORMAT_VERSION
} from './modules/storage/projectManager.js';
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
import { getTrainerState, setProgressionData, setIsReady, getCurrentKey, invalidateProgressionDataCache } from './modules/state/trainerState.js';
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
    addNoteToMeasure,
    deleteLastNote,
    clearInteractiveMelody,
    setNoteDuration,
    setNoteDotted,
    getCurrentNoteDuration,
    getCurrentNoteDotted,
    getInteractiveMelody,
    restoreInteractiveMelody,
    toggleInteractiveMode,
    playInteractiveMelodyWithChords,
    playAllMelody,
    stopPlayAllMelody,
    playMeasure,
    playSelectedMeasure,
    playFromSelectedMeasure,
    getSelectedMeasureIndex,
    setSelectedMeasureIndex,
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
    setDynamic,
    setMelodyTempo
} from './modules/audio/melodyGenerator.js';

// Phase 1A: New composition integration modules
import {
    CompositionState,
    getCompositionState,
    resetCompositionState
} from './modules/state/compositionState.js';
import {
    BuildingBlock,
    BuildingBlockSequence,
    Unit,
    UNITS_PER_BEAT,
    unitsToDuration,
    durationToUnits
} from './modules/state/buildingBlock.js';
import {
    ProgressionNotationSync,
    getProgressionNotationSync,
    initProgressionNotationSync,
    syncProgressionToComposition,
    syncCompositionToProgression
} from './modules/integration/progressionNotationSync.js';
import {
    generateBassVoicing,
    generateBassRhythm,
    calculateVoiceLeadingScore
} from './modules/integration/bassAutoFill.js';
import {
    migrateToCompositionState,
    migrateProgressionOnly,
    autoMigrateOnTabSwitch,
    exportToOldFormats,
    needsMigration,
    validateMigration,
    backupOldData,
    restoreFromBackup
} from './modules/integration/migrationHelper.js';
import {
    initMelodyComposerBridge,
    syncProgressionToMelodyComposer,
    importInteractiveMelodyToComposition,
    exportCompositionToInteractiveMelody,
    getBridgeCompositionState,
    addNoteViaBridge,
    addNoteIntelligently,
    setBassPattern,
    setBassFollowsInversion,
    setAutoGenerateBass,
    isBassAutoGenerated,
    editBassNote,
    addBassNote,
    regenerateBassForMeasure,
    regenerateAllBass,
    getBassPatternOptions,
    getBridgeSettings,
    setUseCompositionState,
    isUsingCompositionState
} from './modules/integration/melodyComposerBridge.js';

// Phase 4.4: Enhanced notation system
import {
    initEnhancedNotation,
    renderEnhancedNotation,
    refreshNotationFromProgression,
    setNotationDuration,
    setNotationRestMode,
    setNotationDotted,
    setNotationAccidental,
    getNotationState,
    highlightPlayingNote,
    clearPlaybackHighlights,
    getNotationComposer,
    isNotationInitialized
} from './modules/notation/notationInit.js';

import {
    ENHARMONIC_MAP,
    SHARP_NOTES,
    FLAT_NOTES,
    ALL_NOTES,
    KEY_SIGNATURE_TEXT,
    KEY_SIGNATURE_IMAGES,
    RELATIVE_MINOR_MAP,
    MAJOR_SCALE_STEPS,
    generateDiatonicChords
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

function toggleChordToneHighlighting() {
    const toggle = document.getElementById('chord-tone-highlighting-toggle');
    const enabled = toggle.checked;

    // Update indicator colors
    const offIndicator = document.getElementById('chord-tone-off-indicator');
    const onIndicator = document.getElementById('chord-tone-on-indicator');

    if (enabled) {
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

    // Update CompositionState
    try {
        if (window.getCompositionState) {
            const compositionState = window.getCompositionState();
            compositionState.updateSettings({ highlightChordTones: enabled });
        }
    } catch (e) {
        console.warn('Could not update CompositionState:', e);
    }

    // Save to localStorage
    localStorage.setItem('chord-tone-highlighting', enabled.toString());

    // Dispatch event for other components
    document.dispatchEvent(new CustomEvent('chord-tone-highlighting-changed', {
        detail: { enabled }
    }));

    // Re-render notation canvas
    const canvas = document.getElementById('interactive-melody-notation-canvas');
    if (canvas && window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }
}

function toggleChordSpans() {
    const toggle = document.getElementById('chord-spans-toggle');
    const enabled = toggle.checked;

    // Update indicator colors
    const offIndicator = document.getElementById('chord-spans-off-indicator');
    const onIndicator = document.getElementById('chord-spans-on-indicator');

    if (enabled) {
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

    // Update CompositionState
    try {
        if (window.getCompositionState) {
            const compositionState = window.getCompositionState();
            compositionState.updateSettings({ showChordSpans: enabled });
        }
    } catch (e) {
        console.warn('Could not update CompositionState:', e);
    }

    // Save to localStorage
    localStorage.setItem('chord-spans', enabled.toString());

    // Dispatch event for other components
    document.dispatchEvent(new CustomEvent('chord-spans-changed', {
        detail: { enabled }
    }));

    // Re-render notation canvas
    const canvas = document.getElementById('interactive-melody-notation-canvas');
    if (canvas && window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
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
window.showSettingsModal = showSettingsModal;
window.showChordWeightsModal = showChordWeightsModal;
window.showMelodyWeightsModal = showMelodyWeightsModal;
window.toggleEnharmonic = toggleEnharmonic;
window.toggleNotationStyle = toggleNotationStyle;
window.toggleSuggestionEngine = toggleSuggestionEngine;
window.toggleRomanNumeralEngine = toggleRomanNumeralEngine;
window.toggleKeyNames = toggleKeyNames;
window.toggleClassicKeyboard = toggleClassicKeyboard;
window.toggleCompactControls = toggleCompactControls;
window.toggleDarkMode = toggleDarkMode;
window.toggleFretboard = toggleFretboard;
window.toggleChordToneHighlighting = toggleChordToneHighlighting;
window.toggleChordSpans = toggleChordSpans;
window.toggleFloatingControls = toggleFloatingControls;
window.toggleDisplayPanel = toggleDisplayPanel;
window.handleOctaveRangeChange = handleOctaveRangeChange;
window.updateRecommendations = updateUnifiedSuggestions;
window.updateUnifiedSuggestions = updateUnifiedSuggestions;

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
window.addSpecificChordToProgression = addSpecificChordToProgression;
window.changeArpeggioSpeed = changeArpeggioSpeed;
window.changeBuilderOctave = changeBuilderOctave;
window.updateBuilderDisplay = updateBuilderDisplay;
window.selectBuilderRootNote = selectBuilderRootNote;
window.selectBuilderChordType = selectBuilderChordType;
window.selectBuilderInterval = selectBuilderInterval;
window.selectBuilderInversion = selectBuilderInversion;
window.selectBuilderChordBySymbol = selectBuilderChordBySymbol;
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
window.toggleChordLibraryMode = toggleChordLibraryMode;
window.toggleChordIntervalsPanel = toggleChordIntervalsPanel;
window.toggleBuilderProgressionPanel = toggleBuilderProgressionPanel;
window.toggleBuilderCardView = toggleBuilderCardView;
window.renderBuilderProgressionCards = renderBuilderProgressionCards;
window.updateBuilderProgressionPanel = updateBuilderProgressionPanel;

// Expose data constants for modules that need them
window.ENHARMONIC_MAP = ENHARMONIC_MAP;
window.SHARP_NOTES = SHARP_NOTES;
window.FLAT_NOTES = FLAT_NOTES;
window.ALL_NOTES = ALL_NOTES;
window.KEY_SIGNATURE_TEXT = KEY_SIGNATURE_TEXT;
window.KEY_SIGNATURE_IMAGES = KEY_SIGNATURE_IMAGES;
window.RELATIVE_MINOR_MAP = RELATIVE_MINOR_MAP;
window.MAJOR_SCALE_STEPS = MAJOR_SCALE_STEPS;
window.generateDiatonicChords = generateDiatonicChords;

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
window.clearProgression = clearProgression;
window.toggleProgressionNote = toggleProgressionNote;
window.toggleProgressionLHNote = toggleProgressionLHNote;
window.handleUndo = handleUndo;
window.handleRedo = handleRedo;
window.saveStateBeforeChange = saveStateBeforeChange;
window.updateUndoRedoButtons = updateUndoRedoButtons;
window.selectChordCard = selectChordCard;

window.toggleStyleMoodInsightsPanel = toggleStyleMoodInsightsPanel;
window.toggleProgressionControlsPanel = toggleProgressionControlsPanel;
window.toggleProgressionCardsPanel = toggleProgressionCardsPanel;
window.triggerSectionSidebarUpdate = triggerSectionSidebarUpdate;
window.toggleAllStaffNotation = toggleAllStaffNotation;
window.importChordList = importChordList;
window.openTemplateBrowser = openTemplateBrowser;
window.showRhythmPatternModal = showRhythmPatternModal;
window.toggleSimplifiedView = toggleSimplifiedView;
window.toggleTensionCurve = toggleTensionCurve;
window.renderProgressionDisplayForBuilder = renderProgressionDisplayForBuilder;

// Debug: Verify function is available
if (typeof window.importChordList !== 'function') {
    console.error('importChordList is not a function!', typeof importChordList, importChordList);
} else {
    console.log('importChordList successfully exposed to window');
}

// Add chord from recommendation (used by Smart Suggestions panel)
window.addChordFromRecommendation = function(root, type, inversion) {
    // Import the necessary functions
    import('./modules/state/chordBuilderState.js').then(module => {
        const { setBuilderRootIndex, setBuilderChordType, setBuilderInversion } = module;
        import('./data/music-data.js').then(dataModule => {
            const { ALL_NOTES } = dataModule;
            import('./modules/state/trainerState.js').then(stateModule => {
                const { getEnharmonicPreference } = stateModule;

                // Set up builder state to match the recommendation
                const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
                const notes = getEnharmonicPreference() === 'sharp' ? SHARP_NOTES : FLAT_NOTES;
                const rootIndex = notes.indexOf(root);

                if (rootIndex !== -1) {
                    setBuilderRootIndex(rootIndex);
                    setBuilderChordType(type);
                    setBuilderInversion(inversion);

                    // Import and call addChordToProgression with fromRecommendation=true
                    // This sets the default LH pattern to 'off'
                    import('./modules/features/chordBuilder.js').then(builderModule => {
                        builderModule.addChordToProgression(false, true, true);
                    });
                }
            });
        });
    });
};

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
    
    // Save panel state
    if (window.savePanelState) {
        window.savePanelState('melody-progression-panel', !isHidden);
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

    // Save panel state
    if (window.savePanelState) {
        window.savePanelState('current-melody-panel', !isHidden);
    }
};

// Melody Section Toggle (Composition Studio)
// Uses standard section pattern with -toggle and -panel naming
window.toggleMelodySection = function(sectionId) {
    const panel = document.getElementById(`${sectionId}-panel`);
    const chevron = document.getElementById(`${sectionId}-chevron`);
    if (!panel) return;

    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
        panel.classList.remove('hidden');
        if (chevron) chevron.classList.add('rotate-180');
    } else {
        panel.classList.add('hidden');
        if (chevron) chevron.classList.remove('rotate-180');
    }

    // Save panel state
    if (window.savePanelState) {
        window.savePanelState(`${sectionId}-panel`, !isHidden);
    }
};

// Expand/Collapse All functions for tabs
window.expandAllTrainerSections = function() {
    const sections = [
        { panelId: 'song-search-panel', chevronId: 'song-search-chevron' },
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
            // Save panel state
            if (window.savePanelState) {
                window.savePanelState(panelId, true);
            }
        }
    });
};

window.collapseAllTrainerSections = function() {
    const sections = [
        { panelId: 'song-search-panel', chevronId: 'song-search-chevron' },
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
            // Save panel state
            if (window.savePanelState) {
                window.savePanelState(panelId, false);
            }
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
            // Save panel state
            if (window.savePanelState) {
                window.savePanelState(panelId, true);
            }
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
            // Save panel state
            if (window.savePanelState) {
                window.savePanelState(panelId, false);
            }
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
            // Save panel state
            if (window.savePanelState) {
                window.savePanelState(panelId, true);
            }
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
            // Save panel state
            if (window.savePanelState) {
                window.savePanelState(panelId, false);
            }
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
window.setIsReady = setIsReady;
window.clearHighlights = clearHighlights;
window.getScaleRootIndex = getScaleRootIndex;
window.updateKeyboardLabels = updateKeyboardLabels;
window.getIsFretboardModeOn = getIsFretboardModeOn;
window.setIsFretboardModeOn = setIsFretboardModeOn;

// Panel state persistence functions
window.savePanelState = savePanelState;
window.restoreAllPanelStates = restoreAllPanelStates;
window.restoreTabPanelStates = restoreTabPanelStates;

// Audio functions already imported above, just expose to window
window.getPiano = getPiano;
window.getGuitar = getGuitar;
window.getInstrument = getInstrument;
window.getAudioIsReady = getAudioIsReady;
window.getCameraShutter = getCameraShutter;
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

// Song Search functions
window.toggleSongSearchPanel = toggleSongSearchPanel;
window.searchSongChords = searchSongChords;
window.importSongProgression = importSongProgression;
window.openUltimateGuitarSearch = openUltimateGuitarSearch;
window.importInternetSongProgression = importInternetSongProgression;

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

// ============================================================================
// QUICK ADD CHORD FUNCTIONS
// These use the reusable Quick Add Chord component from progressionBuilder.js
// The wrapper functions maintain backwards compatibility with existing HTML onclick handlers
// ============================================================================

// Toggle Quick Add form for Progression Builder
window.toggleQuickAddChord = function() {
    if (window.toggleQuickAddChordForm) {
        window.toggleQuickAddChordForm('quick-add-chord-form');
    }
};

// Toggle Quick Add form for Melody Composer (uses same component)
window.toggleQuickAddChordMelody = function() {
    if (window.toggleQuickAddChordForm) {
        window.toggleQuickAddChordForm('quick-add-chord-form-melody');
    }
};

// Add chord from Progression Builder Quick Add form
window.quickAddChordToProgression = function() {
    if (window.quickAddChordFromForm) {
        window.quickAddChordFromForm('quick-add-chord-form');
    }
};

// Add chord from Melody Composer Quick Add form
window.quickAddChordToProgressionMelody = function() {
    if (window.quickAddChordFromForm) {
        window.quickAddChordFromForm('quick-add-chord-form-melody');
    }
};

// Alias for quickAddChordToProgressionMelody (used by compact form)
window.quickAddChordMelody = function() {
    if (window.quickAddChordFromForm) {
        window.quickAddChordFromForm('quick-add-chord-form-melody');
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
window.addNoteToMeasure = addNoteToMeasure;
window.deleteLastNote = deleteLastNote;
window.clearInteractiveMelody = clearInteractiveMelody;
window.setNoteDuration = setNoteDuration;
window.setNoteDotted = setNoteDotted;
window.getCurrentNoteDuration = getCurrentNoteDuration;
window.getCurrentNoteDotted = getCurrentNoteDotted;
window.getInteractiveMelody = getInteractiveMelody;
window.restoreInteractiveMelody = restoreInteractiveMelody;
window.toggleInteractiveMode = toggleInteractiveMode;
window.playInteractiveMelodyWithChords = playInteractiveMelodyWithChords;

// Chord preview functions for harmonizer (continuous playback while pressed)
let activePreviewNotes = [];
let activePreviewMelodyNotes = [];
let previewTimeoutId = null;
let melodyTimeoutIds = [];

window.startChordPreview = function(root, type, inversion = 0) {
    // Stop any existing preview
    window.stopChordPreview();

    // Initialize audio if needed
    if (window.initAudio) window.initAudio();
    if (!window.getAudioIsReady || !window.getAudioIsReady()) {
        console.warn('[ChordPreview] Audio not ready');
        return;
    }

    const piano = window.getPiano ? window.getPiano() : null;
    if (!piano) {
        console.warn('[ChordPreview] Piano not available');
        return;
    }

    // Get chord notes centered around C3 (octaveShift = -12 semitones from C4)
    const key = getCurrentKey();
    const chordData = getInvertedChordNotes(root, type, inversion, key, -12);

    if (chordData && chordData.specificNotes && chordData.specificNotes.length > 0) {
        activePreviewNotes = chordData.specificNotes;
        activePreviewNotes.forEach(note => {
            piano.triggerAttack(note, Tone.now());
        });
    } else {
        console.warn('[ChordPreview] Could not get chord notes for:', root, type);
    }
};

window.stopChordPreview = function() {
    // Clear any pending timeouts
    if (previewTimeoutId) {
        clearTimeout(previewTimeoutId);
        previewTimeoutId = null;
    }
    melodyTimeoutIds.forEach(id => clearTimeout(id));
    melodyTimeoutIds = [];

    const piano = window.getPiano ? window.getPiano() : null;
    if (piano) {
        // Stop chord notes
        if (activePreviewNotes.length > 0) {
            activePreviewNotes.forEach(note => {
                piano.triggerRelease(note, Tone.now());
            });
        }
        // Stop melody notes
        if (activePreviewMelodyNotes.length > 0) {
            activePreviewMelodyNotes.forEach(note => {
                piano.triggerRelease(note, Tone.now());
            });
        }
    }
    activePreviewNotes = [];
    activePreviewMelodyNotes = [];
};

// Play chord sustained while melody notes play sequentially
window.playChordWithMelody = function(root, type, melodyNotes, inversion = 0, tempo = 120) {
    // Stop any existing preview
    window.stopChordPreview();

    // Initialize audio if needed
    if (window.initAudio) window.initAudio();
    if (!window.getAudioIsReady || !window.getAudioIsReady()) {
        console.warn('[ChordPreview] Audio not ready');
        return;
    }

    const piano = window.getPiano ? window.getPiano() : null;
    if (!piano) {
        console.warn('[ChordPreview] Piano not available');
        return;
    }

    // Get chord notes centered around C3 (octaveShift = -12 semitones from C4)
    const key = getCurrentKey();
    const chordData = getInvertedChordNotes(root, type, inversion, key, -12);

    // Calculate note durations in seconds for Tone.js scheduling
    const beatDuration = 60 / tempo; // seconds per quarter note
    const durationMap = {
        'w': beatDuration * 4,      // whole note
        'h': beatDuration * 2,      // half note
        'q': beatDuration,          // quarter note
        '8': beatDuration / 2,      // eighth note
        '16': beatDuration / 4      // sixteenth note
    };

    // Get a common start time for perfect synchronization
    const startTime = Tone.now() + 0.01; // Small buffer to ensure scheduling works

    // Play chord (sustained throughout) at exact start time
    if (chordData && chordData.specificNotes && chordData.specificNotes.length > 0) {
        activePreviewNotes = chordData.specificNotes;
        activePreviewNotes.forEach(note => {
            piano.triggerAttack(note, startTime);
        });
    }

    // Schedule melody notes using Tone.js timing for perfect sync
    let currentTime = 0; // in seconds
    activePreviewMelodyNotes = [];

    if (melodyNotes && melodyNotes.length > 0) {
        melodyNotes.forEach((noteObj, index) => {
            const duration = durationMap[noteObj.duration] || beatDuration;

            if (noteObj.pitch && noteObj.type !== 'rest') {
                // Schedule note attack at exact time
                const noteStartTime = startTime + currentTime;
                piano.triggerAttack(noteObj.pitch, noteStartTime);
                activePreviewMelodyNotes.push(noteObj.pitch);

                // Schedule note release
                const noteEndTime = noteStartTime + duration * 0.9;
                piano.triggerRelease(noteObj.pitch, noteEndTime);
            }

            currentTime += duration;
        });
    }

    // Calculate total duration in milliseconds for the cleanup timeout
    const totalDurationMs = (currentTime + 0.2) * 1000; // Add small buffer
    previewTimeoutId = setTimeout(() => {
        window.stopChordPreview();
    }, totalDurationMs);
};
// New notation editor functions
window.addRestToMelody = addRestToMelody;
window.setTimeSignature = setTimeSignature;
window.tieLastNote = tieLastNote;
window.getEditorState = getEditorState;
window.setAccidental = setAccidental;
window.setDynamic = setDynamic;
window.setMelodyTempo = setMelodyTempo;

// Notation Control Panel Tab Switching
window.showNotationTab = function(tabName) {
    // Hide all tab contents
    const allContents = document.querySelectorAll('.notation-tab-content');
    allContents.forEach(content => {
        content.classList.add('hidden');
    });
    
    // Remove active state from all tab buttons
    const allTabs = document.querySelectorAll('[id^="notation-tab-"]');
    allTabs.forEach(tab => {
        tab.classList.remove('bg-blue-600', 'text-white');
        tab.classList.add('bg-gray-200', 'text-gray-700');
    });
    
    // Show selected tab content
    const selectedContent = document.getElementById(`notation-content-${tabName}`);
    if (selectedContent) {
        selectedContent.classList.remove('hidden');
    }
    
    // Activate selected tab button
    const selectedTab = document.getElementById(`notation-tab-${tabName}`);
    if (selectedTab) {
        selectedTab.classList.remove('bg-gray-200', 'text-gray-700');
        selectedTab.classList.add('bg-blue-600', 'text-white');
    }
};
window.playAllMelody = playAllMelody;
window.stopPlayAllMelody = stopPlayAllMelody;
window.playMeasure = playMeasure;
window.playSelectedMeasure = playSelectedMeasure;
window.playFromSelectedMeasure = playFromSelectedMeasure;

/**
 * Show the Auto-Harmonize modal to suggest chords for the melody
 */
window.showAutoHarmonize = function() {
    // Get melody notes from compositionState (from notation editor)
    const compositionState = getCompositionState();
    let melodyNotes = compositionState.getAllMelodyNotes();

    // Fallback to interactiveMelody if no notes in composition state (keyboard composition mode)
    if (!melodyNotes || melodyNotes.length === 0) {
        const melodyData = getInteractiveMelody();
        melodyNotes = melodyData && melodyData.melodyNotes ? melodyData.melodyNotes : [];
    }

    if (!melodyNotes || melodyNotes.length === 0) {
        alert('No melody notes found. Please record or enter some melody notes first.');
        return;
    }

    // Get the current key
    const currentKey = getCurrentKey();

    // Get current progression to use as defaults for suggestions
    const currentProgression = window.getTrainerState ? window.getTrainerState().progressionData : [];

    // Get settings for tempo and other melody settings
    const settings = compositionState.getSettings();
    const tempo = settings.tempo || 120;

    // Show the modal
    showAutoHarmonizeModal(
        melodyNotes,
        currentKey,
        // onApply callback - apply the harmonization
        (chordProgression) => {
            // CRITICAL: Use the new syncWithProgressionData method to ensure proper bass generation and state sync
            // This replaces the manual update logic which was missing bass generation for new chords

            // Ensure all measures have metadata property
            compositionState.ensureAllMeasuresHaveMetadata();

            // Get current progressionData or initialize if empty
            const trainerState = window.getTrainerState ? window.getTrainerState() : null;
            let progressionData = trainerState ? [...trainerState.progressionData] : [];
            
            // Update progressionData with the new chords from harmonization
            chordProgression.forEach(chord => {
                // Ensure progressionData has enough elements
                while (progressionData.length <= chord.measureIndex) {
                    progressionData.push({
                        root: null,
                        type: null,
                        inversion: 0,
                        roman: null, 
                        name: '',
                        notes: [],
                        selectionMode: 'chord',
                        omittedNotes: [],
                        octaveShift: 0
                    });
                }

                // Update the specific measure in progressionData
                if (progressionData[chord.measureIndex]) {
                    progressionData[chord.measureIndex] = {
                        ...progressionData[chord.measureIndex],
                        root: chord.root,
                        type: chord.type,
                        inversion: chord.inversion || 0,
                        // CRITICAL: Clear notes so they are regenerated for the new chord
                        // properly in syncWithProgressionData. Otherwise old notes persist
                        // causing bass generation to use the wrong pitches.
                        notes: [],
                        omittedNotes: [],
                        lhOmittedNotes: [],
                    };
                }
            });

            // Sync composition state with the updated progression data
            // This will:
            // 1. Update chord data
            // 2. Auto-generate bass (since we added that call in syncWithProgressionData)
            // 3. Preserve existing melody notes
            if (typeof compositionState.syncWithProgressionData === 'function') {
                compositionState.syncWithProgressionData(progressionData);
            } else {
                console.warn('syncWithProgressionData not available, falling back to manual update');
                // Fallback manual update logic (same as before)
                chordProgression.forEach((chord) => {
                    const measure = compositionState.getMeasure(chord.measureIndex);
                    if (!measure) return;

                    measure.chord.root = chord.root;
                    measure.chord.type = chord.type;
                    
                    // Manually trigger bass update if needed
                    if (compositionState.settings.autoGenerateBass) {
                        compositionState.updateBassFromChord(chord.measureIndex);
                    }
                    
                    compositionState.events.emit('chordChanged', chord.measureIndex, measure.chord, {});
                });
            }

            // Update the trainer state with the modified progression data
            // NOTE: setProgressionData also calls syncWithProgressionData internally,
            // but the _isSyncing guard prevents double-processing
            if (window.setProgressionData) {
                window.setProgressionData(progressionData);
            }

            // Invalidate caches to ensure fresh data on next access
            invalidateProgressionDataCache();

            // Force immediate render with a small delay to ensure state is fully updated
            // NOTE: We already synced the progression data directly via compositionState.syncWithProgressionData()
            // so we skip syncProgressionToMelodyComposer() which would re-read from getProgressionData()
            // and potentially overwrite our changes with stale cached data.
            setTimeout(() => {
                console.log('[AutoHarmonize] Starting post-apply refresh...');

                // Invalidate cache AGAIN right before rendering to ensure absolutely fresh data
                // This guards against any race conditions or intermediate cache rebuilds
                invalidateProgressionDataCache();
                console.log('[AutoHarmonize] Cache invalidated');

                // Verify compositionState has the updated chords
                const cs = window.getCompositionState ? window.getCompositionState() : null;
                if (cs) {
                    const chordInfo = [];
                    for (let i = 0; i < cs.getMeasureCount(); i++) {
                        const m = cs.getMeasure(i);
                        chordInfo.push(`[${i}] ${m?.chord?.root || '?'}${m?.chord?.type || ''}`);
                    }
                    console.log('[AutoHarmonize] CompositionState chords:', chordInfo.join(', '));
                }

                // Refresh notation from the already-synced compositionState
                if (window.refreshNotationFromProgression) {
                    console.log('[AutoHarmonize] Calling refreshNotationFromProgression');
                    window.refreshNotationFromProgression();
                } else {
                    console.log('[AutoHarmonize] refreshNotationFromProgression not available, using fallback');
                    // Fallback to direct render if refreshNotationFromProgression not available
                    if (window.getNotationComposer) {
                        const notationComposer = window.getNotationComposer();
                        if (notationComposer && typeof notationComposer.render === 'function') {
                            notationComposer.render(true);
                        }
                    }
                }

                // Update chord card display AFTER render to ensure fresh data is used
                // Update BOTH containers (main progression tab and melody tab)
                console.log('[AutoHarmonize] About to render chord cards');
                if (typeof renderProgressionDisplay === 'function') {
                    // Log what getTrainerState returns before rendering
                    const trainerState = window.getTrainerState ? window.getTrainerState() : null;
                    if (trainerState) {
                        const pdInfo = trainerState.progressionData.map((c, i) => `[${i}] ${c?.root || '?'}${c?.type || ''}`);
                        console.log('[AutoHarmonize] TrainerState progressionData:', pdInfo.join(', '));
                    }

                    console.log('[AutoHarmonize] Rendering progression-visualization');
                    renderProgressionDisplay('progression-visualization', true);
                    console.log('[AutoHarmonize] Rendering melody-progression-visualization');
                    renderProgressionDisplay('melody-progression-visualization', false);
                    console.log('[AutoHarmonize] Chord card rendering complete');
                } else {
                    console.error('[AutoHarmonize] renderProgressionDisplay is not a function!');
                }
            }, 100);

            // Make sure we stay on the Melody Composer tab
            if (window.switchTab) {
                window.switchTab('melody');
            }
        },
        // onPlayChord callback - preview chord (continuous while pressed)
        (root, type, inversion) => {
            if (window.startChordPreview) {
                window.startChordPreview(root, type, inversion);
            }
        },
        // onStopChord callback - stop preview
        () => {
            if (window.stopChordPreview) {
                window.stopChordPreview();
            }
        },
        // Pass current progression for prioritizing current chords
        currentProgression,
        // onPlayChordWithMelody callback - play chord and melody together
        (root, type, measureMelodyNotes, inversion, tempo) => {
            if (window.playChordWithMelody) {
                window.playChordWithMelody(root, type, measureMelodyNotes, inversion, tempo);
            }
        },
        // Pass tempo for playback
        tempo
    );
};
// Wrap setSelectedMeasureIndex to also update melody suggestions
window.setSelectedMeasureIndex = function(index) {
    setSelectedMeasureIndex(index);
    // Phase 4.1: Update melody suggestions when measure is selected
    if (window.setMelodySuggestionMeasure) {
        window.setMelodySuggestionMeasure(index);
    }
};
window.startStepMeasureMelody = startStepMeasureMelody;
window.stopStepMeasureMelody = stopStepMeasureMelody;
window.setMelodyClef = setMelodyClef;
window.setChordClef = setChordClef;

/**
 * Show the Tension Optimizer modal
 * Optimizes chord inversions and suggests extensions to match target tension curve
 */
window.showTensionOptimizer = function() {
    showTensionOptimizerModal();
};
window.toggleMelodyHighlight = function(enabled) {
    setHighlightEnabled(enabled);
    // Re-render the notation to show/hide highlighting
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }
};

/**
 * Toggle melody recording on/off
 * @param {boolean} isRecording - true to start recording (Record), false to stop (Stop)
 */
window.toggleMelodyRecording = function(isRecording) {
    // Both clef toggles are now always visible (no need to show/hide)
    
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
                    // Refresh notation with chord progression and any existing melody
                    if (window.refreshNotationFromProgression) {
                        window.refreshNotationFromProgression();
                    }
                }
                // Note: toggleInteractiveMode now always returns true for melody-first workflow
            } else {
                // Already in interactive mode - refresh notation
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                }
            }
        } catch (e) {
            console.error('Error starting recording:', e);
            // Uncheck the toggle
            const toggle = document.getElementById('melody-recording-toggle');
            if (toggle) {
                toggle.checked = false;
            }
            alert('Error starting recording: ' + e.message);
        }
    } else {
        // Stop recording - disable interactive mode
        if (window.isInteractiveMode) {
            toggleInteractiveMode();
            window.isInteractiveMode = false;
        }
        // Refresh notation to show chord progression
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
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
        // Refresh notation so user can see chord progression
        setTimeout(() => {
            if (window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
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
    const header = document.getElementById('main-header');
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
    
    // Initialize chord tone highlighting toggle
    const chordToneToggle = document.getElementById('chord-tone-highlighting-toggle');
    if (chordToneToggle) {
        // Get current setting from localStorage or CompositionState
        let chordToneEnabled = true;
        try {
            if (window.getCompositionState) {
                const compositionState = window.getCompositionState();
                const settings = compositionState.getSettings();
                chordToneEnabled = settings.highlightChordTones !== false;
            } else {
                const stored = localStorage.getItem('chord-tone-highlighting');
                chordToneEnabled = stored !== 'false';
            }
        } catch (e) {
            const stored = localStorage.getItem('chord-tone-highlighting');
            chordToneEnabled = stored !== 'false';
        }
        chordToneToggle.checked = chordToneEnabled;
        
        // Update indicator colors
        const offIndicator = document.getElementById('chord-tone-off-indicator');
        const onIndicator = document.getElementById('chord-tone-on-indicator');
        if (chordToneEnabled) {
            if (onIndicator) {
                onIndicator.classList.remove('text-gray-500');
                onIndicator.classList.add('text-indigo-300');
            }
            if (offIndicator) {
                offIndicator.classList.remove('text-indigo-300');
                offIndicator.classList.add('text-gray-500');
            }
        } else {
            if (offIndicator) {
                offIndicator.classList.remove('text-gray-500');
                offIndicator.classList.add('text-indigo-300');
            }
            if (onIndicator) {
                onIndicator.classList.remove('text-indigo-300');
                onIndicator.classList.add('text-gray-500');
            }
        }
    }

    // Initialize chord spans toggle
    const chordSpansToggle = document.getElementById('chord-spans-toggle');
    if (chordSpansToggle) {
        // Get current setting from localStorage or CompositionState
        let chordSpansEnabled = true; // Default to true (checked)
        try {
            if (window.getCompositionState) {
                const compositionState = window.getCompositionState();
                const settings = compositionState.getSettings();
                chordSpansEnabled = settings.showChordSpans !== false;
            } else {
                const stored = localStorage.getItem('chord-spans');
                chordSpansEnabled = stored !== 'false';
            }
        } catch (e) {
            const stored = localStorage.getItem('chord-spans');
            chordSpansEnabled = stored !== 'false';
        }
        chordSpansToggle.checked = chordSpansEnabled;

        // Update indicator colors
        const offIndicator = document.getElementById('chord-spans-off-indicator');
        const onIndicator = document.getElementById('chord-spans-on-indicator');
        if (chordSpansEnabled) {
            if (onIndicator) {
                onIndicator.classList.remove('text-gray-500');
                onIndicator.classList.add('text-indigo-300');
            }
            if (offIndicator) {
                offIndicator.classList.remove('text-indigo-300');
                offIndicator.classList.add('text-gray-500');
            }
        } else {
            if (offIndicator) {
                offIndicator.classList.remove('text-gray-500');
                offIndicator.classList.add('text-indigo-300');
            }
            if (onIndicator) {
                onIndicator.classList.remove('text-indigo-300');
                onIndicator.classList.add('text-gray-500');
            }
        }
    }

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
        // Refresh notation if in Free mode
        setTimeout(() => {
            const freeModeControls = document.getElementById('free-mode-controls');
            if (freeModeControls && !freeModeControls.classList.contains('hidden')) {
                // Wait a bit longer to ensure notation system is ready
                setTimeout(() => {
                    if (window.refreshNotationFromProgression) {
                        window.refreshNotationFromProgression();
                    }
                }, 100);
            }
        }, 300);
    }

    // Initialize clef toggle button states (both clef toggles are always visible)
    
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

    // Initialize Unified Smart Suggestions Panel (replaces old recommendations + style/mood)
    setTimeout(() => {
        initUnifiedSuggestionsPanel();
    }, 200);

    // Restore panel states FIRST, before initializing sidebar system
    // This prevents the sidebar from overwriting saved states with HTML defaults
    // Use a small delay to ensure DOM is ready
    setTimeout(() => {
        restoreAllPanelStates();
        // If Chord Builder progression panel is expanded, render the cards
        if (window.updateBuilderProgressionPanel) {
            window.updateBuilderProgressionPanel();
        }
    }, 100);

    // Initialize section drag-and-drop (this also restores section ordering)
    initAllSectionDragDrop();
    
    // Initialize section sidebar system AFTER restoring panel states
    // This ensures the sidebar sees the restored states, not HTML defaults
    setTimeout(() => {
        initAllSectionSidebars();
        // Initialize floating suggestions panel
        initFloatingSuggestionsPanel();
    }, 200);

    // Setup responsive title abbreviation
    setupResponsiveTitle();

    // Initialize undo/redo button states
    updateUndoRedoButtons();
    
    // Set up cache invalidation for progression data when composition state changes
    // This prevents excessive calls to exportToProgressionData() when tooltips open or cards are clicked
    if (window.getCompositionState) {
        const compositionState = window.getCompositionState();
        if (compositionState && compositionState.events) {
            // Invalidate cache when chords are modified
            compositionState.events.on('chordChanged', () => invalidateProgressionDataCache());
            compositionState.events.on('chordInserted', () => invalidateProgressionDataCache());
            compositionState.events.on('chordRemoved', () => invalidateProgressionDataCache());
            compositionState.events.on('chordReordered', () => invalidateProgressionDataCache());
            compositionState.events.on('chordDurationChanged', () => invalidateProgressionDataCache());
            compositionState.events.on('progressionSynced', () => invalidateProgressionDataCache());
            compositionState.events.on('progressionImported', () => invalidateProgressionDataCache());
            compositionState.events.on('cleared', () => invalidateProgressionDataCache());
        }
    }
    
    // Initialize Sortable for progression - commented out for now, need to access trainer state properly
    // const progressionContainer = document.getElementById('progression-visualization');
    // if (progressionContainer && typeof Sortable !== 'undefined') {
    //     new Sortable(progressionContainer, {
    //         animation: 150,
    //         ghostClass: 'sortable-ghost'
    //     });
    // }

    // Ensure song search toggle button works (fallback for GitHub Pages module loading issues)
    const songSearchToggle = document.getElementById('song-search-toggle');
    if (songSearchToggle) {
        // Remove existing onclick and use addEventListener for better reliability
        songSearchToggle.removeAttribute('onclick');
        songSearchToggle.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.toggleSongSearchPanel) {
                window.toggleSongSearchPanel();
            } else {
                console.error('toggleSongSearchPanel not available');
            }
        });
    }

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
// PHASE 1A: COMPOSITION STATE & INTEGRATION
// ===========================

// Composition State
window.getCompositionState = getCompositionState;
window.resetCompositionState = resetCompositionState;
window.CompositionState = CompositionState;

// Insert chord card at specific index (for copy/paste building blocks)
// Follows the same pattern as chord suggestion form in progressionBuilder.js
window.insertChordCardAt = function(index, chordData, durationBeats = 4) {
    const trainerState = getTrainerState();
    if (!trainerState || !trainerState.progressionData) {
        console.warn('[insertChordCardAt] No trainer state or progression data available');
        return false;
    }

    const compositionState = getCompositionState();

    // CRITICAL: Before inserting, save existing bass pitches to lhNotes for ALL chords
    // This ensures existing bass pitches are preserved when blocks are reinitialized
    if (compositionState && compositionState.bassBlockSequence) {
        const blocks = compositionState.bassBlockSequence.blocks;
        for (let i = 0; i < blocks.length && i < trainerState.progressionData.length; i++) {
            const block = blocks[i];
            if (block && block.getNotes) {
                const notes = block.getNotes();
                if (notes.length > 0 && notes[0].pitches && notes[0].pitches.length > 0) {
                    // Save current bass pitches as lhNotes
                    trainerState.progressionData[i].lhNotes = [...notes[0].pitches];
                    console.log(`[insertChordCardAt] Saved bass pitches for chord ${i}:`, notes[0].pitches);
                }
            }
        }
    }

    // Get current progression and make a copy
    const progression = [...trainerState.progressionData];

    // Prepare chord data matching the format used by chord suggestion form
    const chord = {
        root: chordData.root || 'C',
        type: chordData.type || 'Major',
        inversion: chordData.inversion || 0,
        name: chordData.name || `${chordData.root || 'C'} ${chordData.type || 'Major'}`,
        simpleName: chordData.simpleName || chordData.name,
        notes: chordData.notes || [],
        selectionMode: 'chord',
        omittedNotes: chordData.omittedNotes || [],
        lhOmittedNotes: chordData.lhOmittedNotes || [],
        octaveShift: chordData.octaveShift || 0,
        lhOctaveShift: chordData.lhOctaveShift || 0,
        roman: chordData.roman || '',
        beats: durationBeats,
        // Include lhNotes if provided (for bass at correct octave)
        lhNotes: chordData.lhNotes || [],
    };

    // Insert the chord at the specified index (same as chord suggestion: splice)
    progression.splice(index, 0, chord);

    console.log(`[insertChordCardAt] Inserting chord at index ${index}:`, chord);
    console.log(`[insertChordCardAt] Progression now has ${progression.length} chords`);

    // Update state using the same method as chord suggestion form
    setProgressionData(progression);

    // Re-render using the same method as chord suggestion form
    renderProgressionDisplay('progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

    return true;
};

// BuildingBlock Module (for project save/load)
window.buildingBlockModule = {
    BuildingBlock,
    BuildingBlockSequence,
    Unit,
    UNITS_PER_BEAT,
    unitsToDuration,
    durationToUnits
};

// Progression-Notation Sync
window.getProgressionNotationSync = getProgressionNotationSync;
window.initProgressionNotationSync = initProgressionNotationSync;
window.syncProgressionToComposition = syncProgressionToComposition;
window.syncCompositionToProgression = syncCompositionToProgression;
window.ProgressionNotationSync = ProgressionNotationSync;

// Bass Auto-Fill
window.generateBassVoicing = generateBassVoicing;
window.generateBassRhythm = generateBassRhythm;
window.calculateVoiceLeadingScore = calculateVoiceLeadingScore;

// Migration Helpers
window.migrateToCompositionState = migrateToCompositionState;
window.migrateProgressionOnly = migrateProgressionOnly;
window.autoMigrateOnTabSwitch = autoMigrateOnTabSwitch;
window.exportToOldFormats = exportToOldFormats;
window.needsMigration = needsMigration;
window.validateMigration = validateMigration;
window.backupOldData = backupOldData;
window.restoreFromBackup = restoreFromBackup;

// ===========================
// PROJECT SAVE/LOAD (OS File System)
// ===========================

/**
 * Save current project to a file (OS file picker)
 * Saves the complete composition including:
 * - Chord progression (chord cards)
 * - Bass BuildingBlockSequence (all bass notes)
 * - Treble BuildingBlockSequence (all melody notes)
 * - Metadata (title, tempo, key, time signature)
 */
window.saveProject = async function() {
    try {
        const compositionState = getCompositionState();
        if (!compositionState) {
            alert('No composition data available to save.');
            return;
        }

        // Check if there's any content to save
        const progressionData = compositionState.exportToProgressionData();
        if (!progressionData || progressionData.length === 0) {
            alert('No chord progression to save. Add some chords first!');
            return;
        }

        // Show a brief "saving" indicator
        const result = await saveProjectToFile(compositionState);

        if (result.success) {
            // Show success message
            showToast(`Project saved as "${result.filename}"`, 'success');
        } else if (result.error !== 'Save cancelled') {
            alert(`Failed to save project: ${result.error}`);
        }
    } catch (error) {
        console.error('[saveProject] Error:', error);
        alert('An unexpected error occurred while saving the project.');
    }
};

/**
 * Load a project from a file (OS file picker)
 * Restores the complete composition state including chord cards and notation
 */
window.loadProject = async function() {
    try {
        // Confirm if there's existing content
        const compositionState = getCompositionState();
        const trainerState = getTrainerState();

        if (compositionState && trainerState?.progressionData?.length > 0) {
            const confirmLoad = confirm(
                'Loading a project will replace your current work. ' +
                'Any unsaved changes will be lost.\n\n' +
                'Do you want to continue?'
            );
            if (!confirmLoad) {
                return;
            }
        }

        // Open file picker and load
        const result = await loadProjectFromFile();

        if (!result.success) {
            if (result.error !== 'Load cancelled') {
                alert(`Failed to load project: ${result.error}`);
            }
            return;
        }

        // Apply project to state
        const applyResult = applyProjectToState(
            result.project,
            compositionState,
            trainerState,
            {
                // Callback to update chord cards UI
                onProgressionLoaded: (progressionData) => {
                    // Update trainerState
                    if (trainerState) {
                        trainerState.progressionData = [...progressionData];
                    }

                    // Refresh all progression visualizations
                    if (typeof window.updateProgressionVisualization === 'function') {
                        window.updateProgressionVisualization();
                    }
                    if (typeof window.renderBuilderProgressionCards === 'function') {
                        window.renderBuilderProgressionCards();
                    }
                },
                // Callback to refresh notation display
                onNotationRefresh: () => {
                    if (typeof window.refreshNotationFromProgression === 'function') {
                        window.refreshNotationFromProgression();
                    }
                },
                // Callback for metadata updates
                onMetadataUpdated: (metadata) => {
                    // Update tempo display if exists
                    const tempoDisplay = document.getElementById('tempo-display');
                    if (tempoDisplay && metadata.tempo) {
                        tempoDisplay.textContent = metadata.tempo;
                    }
                    // Update key display if exists
                    if (metadata.key && typeof window.updateKeySignatureDisplay === 'function') {
                        window.updateKeySignatureDisplay(metadata.key);
                    }
                }
            }
        );

        if (applyResult.success) {
            showToast(`Project "${result.project.metadata?.title || result.filename}" loaded successfully!`, 'success');

            // Switch to Melody Composer tab to see the loaded content
            if (typeof switchTab === 'function') {
                switchTab('melody');
            }
        } else {
            alert(`Failed to apply project data: ${applyResult.error}`);
        }
    } catch (error) {
        console.error('[loadProject] Error:', error);
        alert('An unexpected error occurred while loading the project.');
    }
};

/**
 * Simple toast notification helper
 */
function showToast(message, type = 'info') {
    // Check if a toast container exists, create one if not
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2';
        document.body.appendChild(toastContainer);
    }

    // Create toast element
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
    toast.className = `${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in-up`;

    // Add icon based on type
    const icon = type === 'success'
        ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
        : type === 'error'
        ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'
        : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';

    toast.innerHTML = `${icon}<span>${message}</span>`;
    toastContainer.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('animate-fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ===========================
// PHASE 2.2: CHORD RECOMMENDATIONS SIDEBAR
// ===========================

// Import recommendation modules
import { getRecommendationService } from './modules/integration/recommendationService.js';
import { getRecommendationsSidebarController } from './modules/ui/recommendationsSidebarController.js';
import { initStyleMoodDisplay, updateStyleMoodDisplay } from './modules/ui/recommendationsSidebar.js';

// Phase 4.1: Import melody suggestion modules
import {
    initMelodySuggestionController,
    refreshSuggestions as refreshMelodySuggestions,
    setCurrentMeasure as setMelodySuggestionMeasure,
    setStyle as setMelodySuggestionStyle,
    setOctave as setMelodySuggestionOctave,
    insertNote as insertSuggestedNote
} from './modules/ai/melodySuggestionController.js';

// Phase 4: Import enhanced melody generation modules
import {
    initEnhancedMelodyController,
    setSectionType as setEnhancedSectionType,
    setSectionPosition as setEnhancedSectionPosition,
    updatePhraseSettings,
    generatePhrases,
    getMotifSuggestions,
    isEnhancedControllerInitialized,
    getSelectedNoteInfo,
    regeneratePhrases,
    CONTOUR_SHAPE_LIST,
    PHRASE_LENGTH_LIST,
    RHYTHM_PATTERN_LIST,
    SECTION_MELODY_PROFILE_LIST
} from './modules/ai/enhancedMelodyController.js';

// Global instances for recommendations (singleton pattern)
let recommendationService = null;
let recommendationsSidebarController = null;
let melodySuggestionControllerInitialized = false;
let enhancedMelodyControllerInitialized = false;

/**
 * Initialize the chord recommendations sidebar
 * Called when the Melody Composer tab is first loaded
 */
window.initializeRecommendationsSidebar = function() {
    // Only initialize once
    if (recommendationService && recommendationsSidebarController) {
        return;
    }

    try {
        // Get singleton instances
        recommendationService = getRecommendationService();
        recommendationsSidebarController = getRecommendationsSidebarController();

        // Initialize service (sets up event listeners for progression changes)
        recommendationService.initialize();

        // Initialize controller (sets up UI event listeners and initial render)
        recommendationsSidebarController.initialize();

        // Initialize style/mood display from saved settings
        initStyleMoodDisplay();

        // Expose services globally for undo/redo and other integrations
        window.recommendationService = recommendationService;
        window.updateStyleMoodDisplay = updateStyleMoodDisplay;
    } catch (error) {
        // Error initializing recommendations sidebar
    }
};

/**
 * Initialize the melody suggestions controller
 * Called when the Melody Composer tab is first loaded
 */
window.initMelodySuggestionController = function(options = {}) {
    // Only initialize once
    if (melodySuggestionControllerInitialized) {
        // Just refresh suggestions if already initialized
        refreshMelodySuggestions();
        return;
    }

    try {
        // Initialize the controller
        initMelodySuggestionController(options);
        melodySuggestionControllerInitialized = true;

        // Set up style selector event listener - auto-refreshes on change
        // This is set up in the controller's setupEventListeners() function

        // Set up panel toggle
        window.toggleMelodySuggestionsPanel = function() {
            const panel = document.getElementById('melody-suggestions-panel');
            const chevron = document.getElementById('melody-suggestions-chevron');

            if (panel) {
                const listEl = document.getElementById('melody-suggestions-list');
                const contextEl = document.getElementById('melody-suggestion-context');
                const styleEl = panel.querySelector('.style-selector');

                [listEl, contextEl, styleEl].forEach(el => {
                    if (el) el.classList.toggle('hidden');
                });

                if (chevron) {
                    chevron.classList.toggle('rotate-180');
                }
            }
        };

        // Phase 4: Initialize enhanced melody controller
        if (!enhancedMelodyControllerInitialized) {
            try {
                initEnhancedMelodyController({
                    onPhraseSelected: (phrase) => {
                        console.log('✅ Phrase inserted:', phrase.notes.length, 'notes');
                    },
                    onMotifDetected: (analysis) => {
                        console.log('🎵 Motifs detected:', analysis.totalDetected);
                    }
                });
                enhancedMelodyControllerInitialized = true;
            } catch (err) {
                console.warn('Enhanced melody controller initialization deferred');
            }
        }
    } catch (error) {
        // Error initializing melody suggestion controller
    }
};

// Expose melody suggestion functions to window
window.refreshMelodySuggestions = refreshMelodySuggestions;
window.setMelodySuggestionMeasure = setMelodySuggestionMeasure;
window.setMelodySuggestionStyle = setMelodySuggestionStyle;
window.setMelodySuggestionOctave = setMelodySuggestionOctave;
window.insertSuggestedNote = insertSuggestedNote;

// Phase 4: Expose enhanced melody generation functions to window
window.setEnhancedSectionType = setEnhancedSectionType;
window.setEnhancedSectionPosition = setEnhancedSectionPosition;
window.updatePhraseSettings = updatePhraseSettings;
window.generatePhrases = generatePhrases;
window.getMotifSuggestions = getMotifSuggestions;
window.getSelectedNoteInfo = getSelectedNoteInfo;
window.regeneratePhrases = regeneratePhrases;
window.CONTOUR_SHAPE_LIST = CONTOUR_SHAPE_LIST;
window.PHRASE_LENGTH_LIST = PHRASE_LENGTH_LIST;
window.RHYTHM_PATTERN_LIST = RHYTHM_PATTERN_LIST;
window.SECTION_MELODY_PROFILE_LIST = SECTION_MELODY_PROFILE_LIST;

// Phase 4: Handler for treble note selection changes
// Called from notationInit.js when treble clef notes are selected
window.onTrebleNoteSelectionChanged = function(trebleNoteIds) {
    // Update single note suggestions based on new selection
    if (melodySuggestionControllerInitialized) {
        refreshMelodySuggestions();
    }

    // Update phrase suggestions based on new selection
    if (enhancedMelodyControllerInitialized) {
        regeneratePhrases();
    }
};

// ===========================
// SUGGESTION MODE TOGGLE (Chords/Melody)
// ===========================

// Track current suggestion mode
let currentSuggestionMode = 'chords';

/**
 * Switch between Chords, Melody, and Generate suggestion modes
 * @param {string} mode - 'chords', 'melody', or 'generate'
 */
window.switchSuggestionMode = function(mode) {
    if (mode !== 'chords' && mode !== 'melody' && mode !== 'generate') return;

    currentSuggestionMode = mode;

    // Update floating panel toggle buttons
    const chordsBtn = document.getElementById('suggestions-mode-chords');
    const melodyBtn = document.getElementById('suggestions-mode-melody');
    const generateBtn = document.getElementById('suggestions-mode-generate');

    if (chordsBtn) chordsBtn.classList.toggle('active', mode === 'chords');
    if (melodyBtn) melodyBtn.classList.toggle('active', mode === 'melody');
    if (generateBtn) generateBtn.classList.toggle('active', mode === 'generate');

    // Show/hide sections
    const chordsSection = document.getElementById('chord-suggestions-section');
    const melodySection = document.getElementById('melody-suggestions-section');
    const generateSection = document.getElementById('generate-suggestions-section');

    if (chordsSection) chordsSection.classList.toggle('hidden', mode !== 'chords');
    if (melodySection) melodySection.classList.toggle('hidden', mode !== 'melody');
    if (generateSection) generateSection.classList.toggle('hidden', mode !== 'generate');

    // Refresh Generate tab UI when switching to generate mode
    if (mode === 'generate') {
        import('./modules/ui/generateTabUI.js').then(module => {
            module.refreshUI();
        });
    }
};

/**
 * Get the current suggestion mode
 * @returns {string} 'chords' or 'melody'
 */
window.getCurrentSuggestionMode = function() {
    return currentSuggestionMode;
};

// ===========================
// GENERATED SECTION APPLICATION
// ===========================

/**
 * Handle applying a generated section to the composition
 * Listens for the 'applyGeneratedSection' event from generateTabUI
 */
window.addEventListener('applyGeneratedSection', async (event) => {
    const { progression, sectionType, style } = event.detail;

    if (!progression || !Array.isArray(progression) || progression.length === 0) {
        return;
    }

    // Get current progression length before adding (to know indices of new chords)
    let startIndex = 0;
    try {
        const compositionState = getCompositionState();
        if (compositionState) {
            const currentChords = compositionState.exportToProgressionData();
            startIndex = currentChords ? currentChords.length : 0;
        }
    } catch (e) {
        // Fall back to trainer state
        const trainerProgression = getProgressionData();
        startIndex = trainerProgression ? trainerProgression.length : 0;
    }

    // Import the chordBuilder module to add chords
    const chordBuilder = await import('./modules/features/chordBuilder.js');

    // Add each chord in the progression
    for (let i = 0; i < progression.length; i++) {
        const chord = progression[i];
        const root = chord.root;
        const type = chord.type || 'Major';
        const inversion = chord.inversion || 0;

        // Set the builder root note first
        const rootIndex = ALL_NOTES.indexOf(root);
        if (rootIndex !== -1) {
            chordBuilder.selectBuilderRootNote(rootIndex, false); // Don't play audio
        }

        // Add the chord (no shutter sound for batch operations except first)
        const playSound = (i === 0);
        chordBuilder.addSpecificChordToProgression(type, inversion, playSound, root);
    }

    // Create a section group for the newly added chords
    try {
        const compositionState = getCompositionState();

        if (compositionState && sectionType) {
            // Calculate indices of the newly added chords
            const newChordIndices = [];
            for (let i = 0; i < progression.length; i++) {
                newChordIndices.push(startIndex + i);
            }

            // Create the section with the new chord indices
            compositionState.createSection(sectionType, newChordIndices);
        }
    } catch (e) {
        console.warn('Could not create section group:', e);
    }

    // Dispatch event to notify other components
    window.dispatchEvent(new CustomEvent('progressionUpdated'));

    // Refresh the progression display to show the new section grouping
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('progression-visualization', true);
        window.renderProgressionDisplay('melody-progression-visualization', false);
    }
});

/**
 * Open the suggestion weights modal to the appropriate tab based on current mode
 */
window.openSuggestionWeights = function() {
    const mode = currentSuggestionMode;
    if (mode === 'melody') {
        showMelodyWeightsModal();
    } else {
        showChordWeightsModal();
    }
};

/**
 * Refresh melody suggestions (called after weights are saved)
 */
window.refreshMelodySuggestions = function() {
    // Import refreshSuggestions from controller if available
    if (window.melodySuggestionController && window.melodySuggestionController.refreshSuggestions) {
        window.melodySuggestionController.refreshSuggestions();
    } else {
        // Fallback: click the refresh button
        const refreshBtn = document.getElementById('refresh-melody-suggestions-btn');
        if (refreshBtn) refreshBtn.click();
    }
};

/**
 * Refresh chord recommendations (called after weights are saved)
 */
window.refreshChordRecommendations = function() {
    // Use the sidebar controller's refresh method
    if (window.recommendationsSidebarController && window.recommendationsSidebarController.refresh) {
        window.recommendationsSidebarController.refresh();
    } else {
        // Fallback: click the refresh button
        const refreshBtn = document.getElementById('refresh-recommendations-btn');
        if (refreshBtn) refreshBtn.click();
    }
};

// Set up keyboard shortcuts for suggestions
document.addEventListener('keydown', function(e) {
    // Only handle shortcuts when in Melody Composer tab
    if (window.currentTab !== 'melody') return;

    // Don't handle if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    // Handle number keys 1-5 for inserting suggestions
    // Only handle melody mode here - chords mode is handled by RecommendationsSidebarController
    if (e.key >= '1' && e.key <= '5') {
        if (currentSuggestionMode === 'melody') {
            const index = parseInt(e.key) - 1;
            // Insert melody note suggestion
            const items = document.querySelectorAll('#melody-suggestions-list .melody-suggestion-item');
            if (items[index]) {
                // Add pulse animation
                items[index].classList.add('shortcut-pulse');
                setTimeout(() => items[index].classList.remove('shortcut-pulse'), 500);

                items[index].click();
                // Refresh is handled by handleNoteSelected after insertion
            }
        }
        // Chords mode handled by RecommendationsSidebarController
        return;
    }

    // Handle R key for refresh
    // Only handle melody mode here - chords mode is handled by RecommendationsSidebarController
    if (e.key === 'r' || e.key === 'R') {
        if (currentSuggestionMode === 'melody') {
            const refreshBtn = document.getElementById('refresh-melody-suggestions-btn');
            if (refreshBtn) refreshBtn.click();
        }
        // Chords mode handled by RecommendationsSidebarController
        return;
    }

    // Handle Escape for deselect
    // Only handle melody mode here - chords mode is handled by RecommendationsSidebarController
    if (e.key === 'Escape') {
        if (currentSuggestionMode === 'melody') {
            const selected = document.querySelector('#melody-suggestions-list .melody-suggestion-item.selected');
            if (selected) selected.classList.remove('selected');
        }
        // Chords mode handled by RecommendationsSidebarController
        return;
    }
});

// Melody Composer Bridge (Phase 1B)
window.initMelodyComposerBridge = initMelodyComposerBridge;
window.syncProgressionToMelodyComposer = syncProgressionToMelodyComposer;
window.importInteractiveMelodyToComposition = importInteractiveMelodyToComposition;
window.exportCompositionToInteractiveMelody = exportCompositionToInteractiveMelody;

// Phase 4.4: Enhanced Notation System
window.initEnhancedNotation = initEnhancedNotation;
window.renderEnhancedNotation = renderEnhancedNotation;
window.refreshNotationFromProgression = refreshNotationFromProgression;
window.setNotationDuration = setNotationDuration;
window.setNotationRestMode = setNotationRestMode;
window.setNotationDotted = setNotationDotted;
window.setNotationAccidental = setNotationAccidental;
window.getNotationState = getNotationState;
window.highlightPlayingNote = highlightPlayingNote;
window.clearPlaybackHighlights = clearPlaybackHighlights;
window.getNotationComposer = getNotationComposer;
window.isNotationInitialized = isNotationInitialized;
window.getBridgeCompositionState = getBridgeCompositionState;
window.addNoteViaBridge = addNoteViaBridge;
window.addNoteIntelligently = addNoteIntelligently;
window.setBassPattern = setBassPattern;
window.setBassFollowsInversion = setBassFollowsInversion;
window.setAutoGenerateBass = setAutoGenerateBass;
window.isBassAutoGenerated = isBassAutoGenerated;
window.editBassNote = editBassNote;
window.addBassNote = addBassNote;
window.regenerateBassForMeasure = regenerateBassForMeasure;
window.regenerateAllBass = regenerateAllBass;
window.getBassPatternOptions = getBassPatternOptions;
window.getBridgeSettings = getBridgeSettings;
window.setUseCompositionState = setUseCompositionState;
window.isUsingCompositionState = isUsingCompositionState;

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
        
        // Save panel state
        if (window.savePanelState) {
            window.savePanelState('melody-controls-panel', !isHidden);
        }
        
        // When panel is opened, refresh notation if in Free mode
        if (isHidden) {
            setTimeout(() => {
                const freeModeControls = document.getElementById('free-mode-controls');
                if (freeModeControls && !freeModeControls.classList.contains('hidden')) {
                    if (window.refreshNotationFromProgression) {
                        window.refreshNotationFromProgression();
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
