/**
 * Window Exports Module
 *
 * This module contains all window.* assignments that expose functions to the global scope
 * for HTML event handlers. This was extracted from main.js as part of the Phase 3 refactoring.
 *
 * All functions are exported through a single setupWindowExports() function that should be
 * called during application initialization.
 */

// Import all necessary modules
import { switchTab, refreshAllTabs, initTabHistory } from '../modules/ui/tabs.js';
import { enterApp, enterAppToTab, showStartHereModal } from './appSetup.js';
import { initAllSectionDragDrop } from '../modules/ui/sectionDragDrop.js';
import { initAllSectionSidebars, triggerSectionSidebarUpdate } from '../modules/ui/sectionSidebar.js';
import { showModal, hideModal, showModalHTML, showAboutModal, hideAboutModal, showConfirmModal } from '../modules/ui/modals.js';
import { renderKeyboard, updateKeyboardLabels, updateKeyNames, clearHighlights, g_KeyboardKeys } from '../modules/ui/keyboard.js';
import { updateKeySignatureDisplay } from '../modules/ui/header.js';
import { toggleSidebar, toggleSettingsGroup, restoreSettingsGroupStates, toggleHeaderDisplays, restoreHeaderDisplaysState } from '../modules/ui/sidebar.js';
import { showSettingsModal, showChordWeightsModal, showMelodyWeightsModal } from '../modules/ui/settingsModal.js';
import { initPresetUI, togglePresetPanel, openPresetPanel, closePresetPanel } from '../modules/ui/presetUI.js';
import { initUnifiedSuggestionsPanel, updateUnifiedSuggestions } from '../modules/ui/unifiedSuggestionsPanel.js';
import { initWhyThisWorksPanel } from '../modules/ui/whyThisWorksPanel.js';
import { openManualChordEntryModal, closeManualChordEntryModal } from '../modules/ui/manualChordEntryModal.js';
import { showAutoHarmonizeModal } from '../modules/ui/autoHarmonizeModal.js';
import { showTensionOptimizerModal } from '../modules/ui/tensionOptimizerModal.js';
import { toast, showToast } from '../modules/ui/toastNotifications.js';
import { showCompositionStudioHelp, closeCompositionStudioHelp } from '../modules/ui/compositionStudioHelp.js';
import {
    quickAddChordFromForm,
    updateQuickAddChordTypes,
    populateScaleDropdown,
    initQuickAddChordForms
} from '../modules/ui/quickAddChord.js';
// Phase 1.3 & Phase 2: Interactive Learning Tools
import { showChordComparisonModal } from '../modules/ui/chordComparisonModal.js';
import { showWhatIfSandbox } from '../modules/ui/whatIfSandbox.js';
import { initChordFunctionLegend, showLegend as showChordFunctionLegend, hideLegend as hideChordFunctionLegend, toggleLegend as toggleChordFunctionLegend } from '../modules/ui/chordFunctionLegend.js';
// Phase 3: Guided Learning Journeys
// Learn tab is lazy loaded when user clicks the tab (see tabs.js)
import { dispatchBuilderEvent } from '../modules/ui/lessonGuidedMode.js';
import { startLetItBeTutorial } from '../modules/teaching/letItBeTutorial.js';
// Tier 1: Teaching-Composition Integration
import { initTheoryMoments, toggleTheoryMoments, recallTheoryMoment } from '../modules/teaching/theoryMoments.js';
import { initWhyThisWorksEnhanced } from '../modules/teaching/whyThisWorksEnhanced.js';
import { initTheoryOverlay, toggleTheoryOverlay } from '../modules/teaching/theoryOverlay.js';
import { initCompositionInsights, showInsightsDashboard, trackProgression } from '../modules/teaching/compositionInsights.js';
import { getCoachEngine, initCoachEngine } from '../modules/teaching/coachEngine/index.js';
import { initCircleOfFifths, toggleCircleOfFifthsPanel, openCircleOfFifthsPanel, closeCircleOfFifthsPanel } from '../modules/features/circleOfFifths.js';
import { initGuitarFretboard, toggleGuitarFretboardPanel, openGuitarFretboardPanel, closeGuitarFretboardPanel, updateGuitarFretboard } from '../modules/features/guitarFretboard.js';
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
} from '../modules/features/theoryTools.js';
import {
    toggleSongSearchPanel,
    searchSongChords,
    importSongProgression,
    openUltimateGuitarSearch,
    importInternetSongProgression,
    toggleSearchMode,
    getSearchMode,
    generateChordSuggestions,
    applySuggestedChord,
    highlightChordInProgression
} from '../modules/features/songSearch.js';
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
    updateChordAtIndex,
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
    setScaleFilterMode,
    getAvailableScales,
    isChordInScale,
    toggleChordIntervalsPanel,
    toggleBuilderProgressionPanel,
    toggleBuilderCardView,
    renderBuilderProgressionCards,
    updateBuilderProgressionPanel,
    // Chord Identifier
    toggleChordIdentifierPanel,
    identifyChordFromInput,
    clearChordIdentifier,
    addNoteToIdentifierInput,
    setBuilderChord,
    playChordPreview,
    stopChordPreview,
    toggleBuilderNote,
    toggleBuilderLHNote
} from '../modules/features/chordBuilder.js';
import {
    playArpeggio,
    stopArpeggio,
    changeArpeggioSpeed,
    updateArpeggioSpeedUI
} from '../modules/audio/arpeggiator.js';
// REFACTORED: progressionBuilder.js split into 7 modules (Complete - 2025-12-28)
// All functions now fully implemented in new modular structure
import {
    renderProgressionDisplay,
    rerenderActiveProgressionDisplay,
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
    renderProgressionDisplayForBuilder,
    highlightTrainer,
    getKeyBasedEnharmonic,
    getProgressionChordNotes,
    navigateToPreviousSection,
    navigateToNextSection
} from '../modules/features/progressionBuilder/index.js';
import {
    renderScaleSelectors,
    updateScaleDisplay,
    selectScaleRootNote,
    selectScaleType,
    playScale,
    changeScaleOctave,
    updateScaleOctaveUI,
    changeScaleSpeed,
    updateScaleSpeedUI,
    filterScalesByCategory,
    updateScaleInfoPanel
} from '../modules/features/scaleExplorer.js';
import { initAudio, getPiano, getGuitar, getInstrument, getAudioIsReady, getCameraShutter, forceStopAllPlayback, initAudioContextKeepAlive, getMetronomeEnabled, setMetronomeEnabled, toggleMetronome } from '../modules/audio/audioEngine.js';
import { updateUndoRedoButtons } from '../modules/utils/undoRedo.js';
import { savePanelState, restoreAllPanelStates, restoreTabPanelStates } from '../modules/storage/panelState.js';
import {
    initExportService,
    showPDFExportDialog,
    showMIDIExportDialog,
    showMIDIImportDialog,
    showAudioExportDialog,
    copyShareableLink,
    parseShareableLink,
    importFromMIDI
} from '../modules/export/exportService.js';
import {
    saveProjectToFile,
    loadProjectFromFile,
    applyProjectToState,
    validateProjectData,
    PROJECT_FORMAT_VERSION
} from '../modules/storage/projectManager.js';
import {
    initAutoSave,
    markDirty as markAutoSaveDirty,
    saveNow as saveAutoSaveNow,
    checkForRecovery,
    loadAutoSave,
    clearAutoSave,
    getAutoSaveStatus,
    onAutoSave,
    onDirtyStateChange,
    hasUnsavedChanges
} from '../modules/storage/autoSave.js';
import {
    initVersionHistory,
    createVersion,
    createCheckpoint,
    getVersions,
    getVersionSnapshot
} from '../modules/storage/versionHistory.js';
import { showVersionHistoryPanel } from '../modules/ui/versionHistoryPanel.js';
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
    setNumOctaves,
    getExperienceMode,
    setExperienceMode,
    isFeatureEnabled
} from '../modules/state/globalState.js';
import { getTrainerState, setProgressionData, setIsReady, getCurrentKey, setCurrentKey, invalidateProgressionDataCache } from '../modules/state/trainerState.js';
import {
    getBuilderRootIndex,
    getBuilderChordType,
    getBuilderInversion,
    getBuilderOctaveShift,
    getBuilderSelectionMode,
    getBuilderIntervalType,
    getBuilderOmittedNotes,
    getBuilderChordNotes,
    setBuilderChordType,
    setBuilderIntervalType
} from '../modules/state/builderState.js';
import { getScaleRootIndex } from '../modules/state/scaleState.js';
import { toggleSuggestionEngine } from '../modules/utils/voiceLeading.js';
// Import voice leading overlay to register global toggle functions
import '../modules/notation/voiceLeadingOverlay.js';
// Import theory insights panel to register global functions
import '../modules/ui/theoryInsightsPanel.js';
import {
    getNoteKeyId,
    getInvertedChordNotes,
    getIntervalNotes
} from '../modules/utils/noteUtils.js';
import {
    generateProgressionMelody,
    playMelody as playMelodyInternal,
    stopMelody as stopMelodyInternal,
    setCurrentMelody,
    getCurrentMelody,
    exportMelodyToMIDI,
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
    playProgressionOnly,
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
    setMelodyTempo,
    getCurrentTempo
} from '../modules/audio/melodyGenerator.js';

// Phase 1A: New composition integration modules
import {
    CompositionState,
    getCompositionState,
    resetCompositionState,
    getBeatsPerMeasureFromTimeSignature
} from '../modules/state/compositionState.js';
import {
    BuildingBlock,
    BuildingBlockSequence,
    Unit,
    UNITS_PER_BEAT,
    unitsToDuration,
    durationToUnits
} from '../modules/state/buildingBlock.js';
import {
    ProgressionNotationSync,
    getProgressionNotationSync,
    initProgressionNotationSync,
    syncProgressionToComposition,
    syncCompositionToProgression
} from '../modules/integration/progressionNotationSync.js';
import {
    generateBassVoicing,
    generateBassRhythm,
    calculateVoiceLeadingScore
} from '../modules/integration/bassAutoFill.js';
import {
    migrateToCompositionState,
    migrateProgressionOnly,
    autoMigrateOnTabSwitch,
    exportToOldFormats,
    needsMigration,
    validateMigration,
    backupOldData,
    restoreFromBackup
} from '../modules/integration/migrationHelper.js';
import {
    initMelodyComposerBridge,
    syncProgressionToMelodyComposer,
    importInteractiveMelodyToComposition,
    exportCompositionToInteractiveMelody,
    getBridgeCompositionState,
    addNoteViaBridge,
    addNoteIntelligently,
    setBassPattern,
    setBassOctave,
    getBassOctave,
    getEffectiveBassOctave,
    hasUserEditedBass,
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
} from '../modules/integration/melodyComposerBridge.js';

// Bass pattern octave defaults
import {
    BASS_PATTERN_OCTAVE_DEFAULTS,
    getDefaultOctaveForPattern
} from '../modules/integration/bassAutoFill.js';

// Phase 4.4: Enhanced notation system
import {
    initEnhancedNotation,
    renderEnhancedNotation,
    refreshNotationFromProgression,
    flushNotationRefresh,
    getNotationRenderStats,
    resetNotationRenderStats,
    setNotationDuration,
    setNotationRestMode,
    setNotationDotted,
    setNotationAccidental,
    getNotationState,
    highlightPlayingNote,
    clearPlaybackHighlights,
    getNotationComposer,
    isNotationInitialized,
    showNotationShortcuts
} from '../modules/notation/notationInit.js';

// Audio analysis for chord detection from uploaded songs
import {
    initSongAnalyzer,
    openAudioAnalyzerModal,
    startAudioAnalysis,
    importDetectedChords,
    clearAudioFile,
    reanalyzeAudio,
    closeAudioAnalyzerModal,
    transposeDetectedChords,
    setExpectedKey,
    resetTranspose,
    searchOnlineChords
} from '../modules/features/songAnalyzer.js';

import {
    showSongBuilderModal
} from '../modules/ui/songwritingWizard.js';
import {
    showAddSectionMenu
} from '../modules/features/progressionBuilder/ProgressionModals.js';
import {
    togglePanel
} from '../modules/ui/floatingSuggestionsPanel.js';

// Measure Isolation Editor
import {
    openMeasureIsolationEditor,
    getMeasureIsolationEditor
} from '../modules/notation/measureIsolation/index.js';

// Full-Screen Notation Editor (Tab mode only - modal mode is deprecated)
import {
    getFullScreenNotationEditor
} from '../modules/notation/fullScreen/FullScreenNotationEditor.js';

// Full-Screen Chord Lab Editor
import {
    initChordLabNewTab,
    closeChordLabNewTab,
    getFullScreenChordLabEditor
} from '../modules/features/chordLab/FullScreenChordLabEditor.js';

// Full-Screen Scale Explorer
import {
    initScaleExplorerNewTab,
    closeScaleExplorerNewTab,
    getFullScreenScaleExplorer
} from '../modules/features/scaleExplorer/FullScreenScaleExplorer.js';

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
} from '../data/music-data.js';

/**
 * Setup all window exports for HTML event handlers
 * This function should be called during application initialization
 */
export function setupWindowExports() {
    // Chord Lab Enharmonic Toggle - only affects root note display in Chord Lab
    function toggleChordLabEnharmonic() {
        const toggle = document.getElementById('chordlab-enharmonic-toggle');
        // When flat is selected (checked=true), use FLAT_NOTES
        // When sharp is selected (checked=false), use SHARP_NOTES
        setEnharmonicPreference(toggle.checked ? 'flat' : 'sharp');

        // Update indicator label styles
        const sharpIndicator = document.getElementById('chordlab-sharp-indicator');
        const flatIndicator = document.getElementById('chordlab-flat-indicator');

        if (getEnharmonicPreference() === 'sharp') {
            // Sharps active - white text in header
            sharpIndicator.className = 'text-[9px] font-semibold text-white/90';
            flatIndicator.className = 'text-[9px] font-semibold text-white/60';
        } else {
            // Flats active - white text in header
            sharpIndicator.className = 'text-[9px] font-semibold text-white/60';
            flatIndicator.className = 'text-[9px] font-semibold text-white/90';
        }

        // Update window.enharmonicPreference for Chord Lab modules that access it
        window.enharmonicPreference = getEnharmonicPreference();

        // Re-render the root note selector buttons to show sharps or flats
        if (window.renderBuilderSelectors) {
            window.renderBuilderSelectors();
        }
        // Also update the display
        if (window.updateBuilderDisplay) {
            window.updateBuilderDisplay();
        }
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
        console.log('[RomanNumeral] Toggle clicked, checkbox checked:', toggle.checked);
        setIsRomanNumeralEngineOn(toggle.checked);

        // Update window.isRomanNumeralEngineOn for modules that access it
        window.isRomanNumeralEngineOn = getIsRomanNumeralEngineOn();
        console.log('[RomanNumeral] State after set:', window.isRomanNumeralEngineOn);

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

        window.isFloatingControlsVisible = !window.isFloatingControlsVisible;

        panels.forEach(panel => {
            panel.classList.toggle('hidden', !window.isFloatingControlsVisible);
        });

        localStorage.setItem('isFloatingControlsVisible', window.isFloatingControlsVisible.toString());

        if (window.isFloatingControlsVisible) {
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
            // If we are on melody tab, hop to builder, then back after a short delay
            if (prevTab === 'melody') {
                window.switchTab('builder');
                setTimeout(() => {
                    window.switchTab('melody');
                }, 75);
            } else {
                window.switchTab('melody');
                setTimeout(() => {
                    window.switchTab(prevTab);
                }, 75);
            }
        } catch (_) {
            fallback();
        }
    }

    // Chord and Interval tooltips toggles
    // These use CSS classes to show/hide the custom tooltip elements
    window.chordTooltipsEnabled = true;
    window.intervalTooltipsEnabled = true;

    function toggleChordTooltips(enabled) {
        window.chordTooltipsEnabled = enabled;
        const chordSelector = document.getElementById('builder-chord-type-selector');
        const chordLibraryPanel = document.getElementById('chord-library-panel');
        const statusText = document.getElementById('chord-details-status');

        // Add class to containers to hide info icons
        if (chordSelector) {
            chordSelector.classList.toggle('tooltips-hidden', !enabled);
        }
        if (chordLibraryPanel) {
            chordLibraryPanel.classList.toggle('tooltips-hidden', !enabled);
        }
        if (statusText) {
            statusText.textContent = enabled ? 'On' : 'Off';
        }

        // Add class to body to control tooltip visibility (tooltips are appended to body)
        document.body.classList.toggle('chord-tooltips-disabled', !enabled);

        // Also hide any currently visible tooltips
        if (!enabled) {
            document.querySelectorAll('.chord-button-tooltip[data-chord-type]').forEach(t => {
                t.style.opacity = '0';
                t.style.visibility = 'hidden';
            });
        }
    }

    function toggleIntervalTooltips(enabled) {
        window.intervalTooltipsEnabled = enabled;
        const intervalSelector = document.getElementById('builder-interval-selector');
        const intervalsPanel = document.getElementById('chord-intervals-panel');
        const statusText = document.getElementById('interval-details-status');

        // Add class to containers to hide info icons
        if (intervalSelector) {
            intervalSelector.classList.toggle('tooltips-hidden', !enabled);
        }
        if (intervalsPanel) {
            intervalsPanel.classList.toggle('tooltips-hidden', !enabled);
        }
        if (statusText) {
            statusText.textContent = enabled ? 'On' : 'Off';
        }

        // Add class to body to control tooltip visibility (tooltips are appended to body)
        document.body.classList.toggle('interval-tooltips-disabled', !enabled);

        // Also hide any currently visible tooltips (interval tooltips don't have data-chord-type)
        if (!enabled) {
            document.querySelectorAll('.chord-button-tooltip:not([data-chord-type])').forEach(t => {
                t.style.opacity = '0';
                t.style.visibility = 'hidden';
            });
        }
    }

    // Progression tooltips toggle (for chord cards in progression)
    window.progressionTooltipsEnabled = true;

    function toggleProgressionTooltips(enabled) {
        window.progressionTooltipsEnabled = enabled;
        const statusText = document.getElementById('progression-tooltips-status');
        const progressionContainer = document.getElementById('melody-progression-visualization');

        if (statusText) {
            statusText.textContent = enabled ? 'On' : 'Off';
        }

        // Add class to progression container to control tooltip visibility
        if (progressionContainer) {
            progressionContainer.classList.toggle('progression-tooltips-disabled', !enabled);
        }

        // Add class to body as fallback for tooltips appended to body
        document.body.classList.toggle('progression-tooltips-disabled', !enabled);

        // Hide any currently visible progression tooltips
        if (!enabled) {
            document.querySelectorAll('.chord-card-tooltip, .chord-tooltip').forEach(t => {
                t.style.opacity = '0';
                t.style.visibility = 'hidden';
            });
        }
    }

    // Add chord from recommendation (used by Smart Suggestions panel)
    function addChordFromRecommendation(root, type, inversion) {
        // Import the necessary functions
        import('../modules/state/builderState.js').then(module => {
            const { setBuilderRootIndex, setBuilderChordType, setBuilderInversion } = module;
            import('../data/music-data.js').then(dataModule => {
                const { ALL_NOTES } = dataModule;
                import('../modules/state/trainerState.js').then(stateModule => {
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
                        import('../modules/features/chordBuilder.js').then(builderModule => {
                            builderModule.addChordToProgression(false, true, true);
                        });
                    }
                });
            });
        });
    }

    // Melody Composer toggle functions
    function toggleMelodyProgressionPanel() {
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
    }

    function toggleCurrentMelodyPanel() {
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
    }

    // Melody Section Toggle (Composition Studio)
    // Uses standard section pattern with -toggle and -panel naming
    function toggleMelodySection(sectionId, event = null) {
        // If event is provided, check if click was in the right 25% zone (collapse zone)
        // This prevents accidental collapses from clicking elsewhere on the header
        if (event && event.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            const clickX = event.clientX;
            const rightZoneStart = rect.right - (rect.width * 0.25); // Right 25% of header

            // If click was NOT in the right zone, don't toggle
            // Exception: if clicking directly on chevron (which should always work)
            const clickedChevron = event.target.closest('[id$="-chevron"]') ||
                                   event.target.closest('.chevron-icon') ||
                                   event.target.closest('svg[class*="rotate"]');

            if (clickX < rightZoneStart && !clickedChevron) {
                return; // Click was in left 75%, ignore
            }
        }

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
    }

    // Expand/Collapse All functions for tabs
    function expandAllTrainerSections() {
        const sections = [
            { panelId: 'song-search-panel', chevronId: 'song-search-chevron' },
            { panelId: 'progression-controls-panel', chevronId: 'progression-controls-chevron' },
            { panelId: 'style-mood-insights-panel', chevronId: 'style-mood-insights-chevron' },
            { panelId: 'progression-visualization-panel', chevronId: 'progression-visualization-chevron' },
            { panelId: 'theory-tools-panel', chevronId: 'theory-tools-chevron' }
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
    }

    function collapseAllTrainerSections() {
        const sections = [
            { panelId: 'song-search-panel', chevronId: 'song-search-chevron' },
            { panelId: 'progression-controls-panel', chevronId: 'progression-controls-chevron' },
            { panelId: 'style-mood-insights-panel', chevronId: 'style-mood-insights-chevron' },
            { panelId: 'progression-visualization-panel', chevronId: 'progression-visualization-chevron' },
            { panelId: 'theory-tools-panel', chevronId: 'theory-tools-chevron' }
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
    }

    function expandAllBuilderSections() {
        const sections = [
            { panelId: 'chord-setup-panel', chevronId: 'chord-setup-chevron' },
            { panelId: 'chord-library-panel', chevronId: 'chord-library-chevron' },
            { panelId: 'chord-intervals-panel', chevronId: 'chord-intervals-chevron' },
            { panelId: 'builder-progression-panel', chevronId: 'builder-progression-chevron' }
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
    }

    function collapseAllBuilderSections() {
        const sections = [
            { panelId: 'chord-setup-panel', chevronId: 'chord-setup-chevron' },
            { panelId: 'chord-library-panel', chevronId: 'chord-library-chevron' },
            { panelId: 'chord-intervals-panel', chevronId: 'chord-intervals-chevron' },
            { panelId: 'builder-progression-panel', chevronId: 'builder-progression-chevron' }
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
    }

    function expandAllMelodySections() {
        // Standard sections with panel/chevron pattern
        const sections = [
            { panelId: 'melody-progression-setup-panel', chevronId: 'melody-progression-setup-chevron' },
            { panelId: 'chord-progression-card-panel', chevronId: 'chord-progression-card-chevron' },
            { panelId: 'staff-notation-card-panel', chevronId: 'staff-notation-card-chevron' },
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
                if (window.savePanelState) {
                    window.savePanelState(panelId, true);
                }
            }
        });

        // Handle Voice Leading panel (custom toggle)
        const voiceLeadingPanel = window.voiceLeadingDiagram;
        if (voiceLeadingPanel && !voiceLeadingPanel.isPanelExpanded) {
            voiceLeadingPanel.togglePanel();
        }

        // Handle Theory Insights panel (custom toggle)
        const theoryInsightsPanel = window.theoryInsightsPanel;
        if (theoryInsightsPanel && !theoryInsightsPanel.isPanelExpanded) {
            theoryInsightsPanel.togglePanel();
        }
    }

    function collapseAllMelodySections() {
        // Standard sections with panel/chevron pattern
        const sections = [
            { panelId: 'melody-progression-setup-panel', chevronId: 'melody-progression-setup-chevron' },
            { panelId: 'chord-progression-card-panel', chevronId: 'chord-progression-card-chevron' },
            { panelId: 'staff-notation-card-panel', chevronId: 'staff-notation-card-chevron' },
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
                if (window.savePanelState) {
                    window.savePanelState(panelId, false);
                }
            }
        });

        // Handle Voice Leading panel (custom toggle)
        const voiceLeadingPanel = window.voiceLeadingDiagram;
        if (voiceLeadingPanel && voiceLeadingPanel.isPanelExpanded) {
            voiceLeadingPanel.togglePanel();
        }

        // Handle Theory Insights panel (custom toggle)
        const theoryInsightsPanel = window.theoryInsightsPanel;
        if (theoryInsightsPanel && theoryInsightsPanel.isPanelExpanded) {
            theoryInsightsPanel.togglePanel();
        }
    }

    // Universal expand/collapse functions that route to the correct tab function
    function expandAllCurrentTab() {
        const currentTab = window.currentTab || (typeof getCurrentTab === 'function' ? getCurrentTab() : 'builder');
        if (currentTab === 'trainer') {
            expandAllTrainerSections();
        } else if (currentTab === 'builder') {
            expandAllBuilderSections();
        } else if (currentTab === 'melody') {
            expandAllMelodySections();
        }
    }

    function collapseAllCurrentTab() {
        const currentTab = window.currentTab || (typeof getCurrentTab === 'function' ? getCurrentTab() : 'builder');
        if (currentTab === 'trainer') {
            collapseAllTrainerSections();
        } else if (currentTab === 'builder') {
            collapseAllBuilderSections();
        } else if (currentTab === 'melody') {
            collapseAllMelodySections();
        }
    }

    // Toggle the melody controls panel visibility
    function toggleMelodyControlsPanel() {
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
    }

    /**
     * Sync progression data from Progression Builder to Melody Composer tab
     * Now uses the same rendering function as the Progression Builder for consistency
     */
    function syncProgressionToMelodyTab() {
        const trainerState = getTrainerState();
        const melodyCurrentKeyDisplay = document.getElementById('melody-current-key-display');
        const melodyKeyDisplayText = document.getElementById('melody-key-display-text');
        const melodyWorkbenchKeyDisplay = document.getElementById('melody-workbench-key-display');

        // Update key display in header badge
        if (melodyCurrentKeyDisplay && trainerState.currentKey) {
            melodyCurrentKeyDisplay.textContent = trainerState.currentKey;
        }

        // Update key display in Progression Setup panel
        if (melodyKeyDisplayText && trainerState.currentKey) {
            melodyKeyDisplayText.textContent = trainerState.currentKey;
        }

        // Update key display in Song Workbench
        if (melodyWorkbenchKeyDisplay && trainerState.currentKey) {
            melodyWorkbenchKeyDisplay.textContent = trainerState.currentKey;
        }

        // Use the same rendering function as the Progression Builder
        // This ensures both tabs show exactly the same information
        // Pass false for syncBothTabs to avoid infinite recursion when called from tab switch
        if (window.renderProgressionDisplay) {
            window.renderProgressionDisplay('melody-progression-visualization', false);
        }
    }

    // ============================================================================
    // WINDOW EXPORTS
    // ============================================================================

    // Tab functions
    window.switchTab = switchTab;
    window.refreshAllTabs = refreshAllTabs;

    // Landing page functions
    window.enterApp = enterApp;
    window.enterAppToTab = enterAppToTab;
    window.showStartHereModal = showStartHereModal;

    // Modal functions
    window.showModal = showModal;
    window.hideModal = hideModal;
    window.showModalHTML = showModalHTML;
    window.showAboutModal = showAboutModal;
    window.hideAboutModal = hideAboutModal;
    window.showCompositionStudioHelp = showCompositionStudioHelp;
    window.closeCompositionStudioHelp = closeCompositionStudioHelp;

    // Sidebar functions
    window.toggleSidebar = toggleSidebar;
    window.toggleSettingsGroup = toggleSettingsGroup;
    window.toggleHeaderDisplays = toggleHeaderDisplays;

    // Settings modal functions
    window.showSettingsModal = showSettingsModal;
    window.showChordWeightsModal = showChordWeightsModal;
    window.showMelodyWeightsModal = showMelodyWeightsModal;

    // Toggle functions for settings
    window.toggleChordLabEnharmonic = toggleChordLabEnharmonic;
    window.toggleNotationStyle = toggleNotationStyle;
    window.toggleSuggestionEngine = toggleSuggestionEngine;
    window.toggleRomanNumeralEngine = toggleRomanNumeralEngine;
    window.toggleKeyNames = toggleKeyNames;
    window.toggleClassicKeyboard = toggleClassicKeyboard;
    window.toggleDarkMode = toggleDarkMode;
    window.toggleFretboard = toggleFretboard;
    window.toggleChordToneHighlighting = toggleChordToneHighlighting;
    window.toggleChordSpans = toggleChordSpans;
    window.toggleFloatingControls = toggleFloatingControls;
    window.toggleDisplayPanel = toggleDisplayPanel;
    window.handleOctaveRangeChange = handleOctaveRangeChange;

    // Recommendation/suggestion functions
    window.updateRecommendations = updateUnifiedSuggestions;
    window.updateUnifiedSuggestions = updateUnifiedSuggestions;

    // Toast notifications
    window.toast = toast;
    window.showToast = showToast;

    // Phase 1.3 & Phase 2: Interactive Learning Tools
    window.showChordComparisonModal = showChordComparisonModal;
    window.showWhatIfSandbox = showWhatIfSandbox;
    window.showChordFunctionLegend = showChordFunctionLegend;
    window.hideChordFunctionLegend = hideChordFunctionLegend;
    window.toggleChordFunctionLegend = toggleChordFunctionLegend;

    // Drag & Drop helpers
    window.refreshDragDrop = refreshDragDrop;
    window.shockDragDrop = shockDragDrop;

    // Builder functions
    window.startBuilderChord = startBuilderChord;
    window.stopBuilderChord = stopBuilderChord;
    window.playBuilderChordWithDuration = playBuilderChordWithDuration;
    window.addChordToProgression = addChordToProgression;
    window.addSpecificChordToProgression = addSpecificChordToProgression;
    window.changeArpeggioSpeed = changeArpeggioSpeed;
    window.changeBuilderOctave = changeBuilderOctave;
    window.updateBuilderDisplay = updateBuilderDisplay;
    window.renderBuilderSelectors = renderBuilderSelectors;
    window.selectBuilderRootNote = selectBuilderRootNote;
    window.selectBuilderChordType = selectBuilderChordType;
    window.selectBuilderInterval = selectBuilderInterval;
    window.selectBuilderInversion = selectBuilderInversion;
    window.selectBuilderChordBySymbol = selectBuilderChordBySymbol;
    window.updateChordAtIndex = updateChordAtIndex;
    window.playArpeggio = playArpeggio;
    window.stopArpeggio = stopArpeggio;
    window.getNoteKeyId = getNoteKeyId;
    window.capturePlayedChord = capturePlayedChord;
    window.getInvertedChordNotes = getInvertedChordNotes;
    window.getIntervalNotes = getIntervalNotes;
    window.updateKeySignatureDisplay = updateKeySignatureDisplay;
    window.updateButtonSelection = updateButtonSelection;
    window.updateChordTypeButtonCaptions = updateChordTypeButtonCaptions;
    window.updateIntervalButtonCaptions = updateIntervalButtonCaptions;
    window.toggleChordSetupPanel = toggleChordSetupPanel;
    window.toggleChordLibraryPanel = toggleChordLibraryPanel;
    window.toggleChordLibraryMode = toggleChordLibraryMode;
    window.setScaleFilterMode = setScaleFilterMode;
    window.getAvailableScales = getAvailableScales;
    window.isChordInScale = isChordInScale;
    window.toggleChordIntervalsPanel = toggleChordIntervalsPanel;
    window.toggleChordIdentifierPanel = toggleChordIdentifierPanel;
    window.identifyChordFromInput = identifyChordFromInput;
    window.clearChordIdentifier = clearChordIdentifier;
    window.addNoteToIdentifierInput = addNoteToIdentifierInput;
    window.setBuilderChord = setBuilderChord;
    window.playChordPreview = playChordPreview;
    window.stopChordPreview = stopChordPreview;
    window.toggleBuilderNote = toggleBuilderNote;
    window.toggleBuilderLHNote = toggleBuilderLHNote;
    window.loadProgression = loadProgression;

    // Chord and Interval tooltip toggles
    window.toggleChordTooltips = toggleChordTooltips;
    window.toggleIntervalTooltips = toggleIntervalTooltips;
    window.toggleProgressionTooltips = toggleProgressionTooltips;

    // Builder progression panel functions
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
    window.renderProgressionControls = renderProgressionControls;
    window.renderProgressionDisplay = renderProgressionDisplay;
    window.rerenderActiveProgressionDisplay = rerenderActiveProgressionDisplay;
    window.getKeyBasedEnharmonic = getKeyBasedEnharmonic;
    window.getProgressionChordNotes = getProgressionChordNotes;
    window.navigateToPreviousSection = navigateToPreviousSection;
    window.navigateToNextSection = navigateToNextSection;
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

    /**
     * Clear all treble clef (melody) notes
     */
    window.clearAllTrebleNotes = function() {
        const compositionState = getCompositionState();
        if (!compositionState) {
            console.warn('No composition state to clear');
            return;
        }

        // Confirm with user
        if (!confirm('Are you sure you want to clear all melody notes from the treble clef?')) {
            return;
        }

        // Save state for undo BEFORE making changes
        if (window.saveStateBeforeChange) {
            window.saveStateBeforeChange();
        }

        // Get total duration in beats (all measures)
        const numMeasures = compositionState.measures?.length || 8;
        const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);
        const totalBeats = numMeasures * beatsPerMeasure;

        // Clear all treble notes using the beat range method
        if (compositionState.clearTrebleBeatRange) {
            compositionState.clearTrebleBeatRange(0, totalBeats);
        }

        // Refresh notation display
        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        }

        console.log('Cleared all treble clef notes');
    };

    /**
     * Toggle quick add chord form visibility
     */
    window.toggleQuickAddChordForm = function(formId) {
        const form = document.getElementById(formId);
        if (form) {
            const wasHidden = form.classList.contains('hidden');
            form.classList.toggle('hidden');
            // Dispatch event when form is opened (for tutorials)
            if (wasHidden && window.dispatchBuilderEvent) {
                window.dispatchBuilderEvent('quickAddFormOpened', { formId });
            }
            // Initialize scale dropdown when form is opened
            if (wasHidden) {
                populateScaleDropdown(formId);
            }
        }
    };

    // Quick Add Chord functions
    window.quickAddChordFromForm = quickAddChordFromForm;
    window.updateQuickAddChordTypes = updateQuickAddChordTypes;
    window.populateScaleDropdown = populateScaleDropdown;
    window.initQuickAddChordForms = initQuickAddChordForms;

    // Progression panel toggle functions
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
    window.highlightTrainer = highlightTrainer;

    // Add chord from recommendation
    window.addChordFromRecommendation = addChordFromRecommendation;

    // Melody Composer toggle functions
    window.toggleMelodyProgressionPanel = toggleMelodyProgressionPanel;
    window.toggleCurrentMelodyPanel = toggleCurrentMelodyPanel;
    window.toggleMelodySection = toggleMelodySection;

    // Expand/Collapse All functions
    window.expandAllTrainerSections = expandAllTrainerSections;
    window.collapseAllTrainerSections = collapseAllTrainerSections;
    window.expandAllBuilderSections = expandAllBuilderSections;
    window.collapseAllBuilderSections = collapseAllBuilderSections;
    window.expandAllMelodySections = expandAllMelodySections;
    window.collapseAllMelodySections = collapseAllMelodySections;
    window.expandAllCurrentTab = expandAllCurrentTab;
    window.collapseAllCurrentTab = collapseAllCurrentTab;

    // Scale functions
    window.playScale = playScale;
    window.changeScaleSpeed = changeScaleSpeed;
    window.changeScaleOctave = changeScaleOctave;
    window.selectScaleRootNote = selectScaleRootNote;
    window.selectScaleType = selectScaleType;
    window.filterScalesByCategory = filterScalesByCategory;
    window.updateScaleInfoPanel = updateScaleInfoPanel;

    // Expose state to window for modules that access it globally (temporary solution)
    window.g_NumOctaves = getNumOctaves();
    window.enharmonicPreference = getEnharmonicPreference();
    window.isRomanNumeralEngineOn = getIsRomanNumeralEngineOn();
    window.isKeyNamesOn = getIsKeyNamesOn();
    window.isClassicKeyboardOn = getIsClassicKeyboardOn();

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

    // Experience Mode exports
    window.getExperienceMode = getExperienceMode;
    window.setExperienceMode = setExperienceMode;
    window.isFeatureEnabled = isFeatureEnabled;

    // Expose globalState object for modules that need multiple functions
    window.globalState = {
        getExperienceMode,
        setExperienceMode,
        isFeatureEnabled,
        getEnharmonicPreference,
        getNotationPreference,
        getNumOctaves,
        getIsFretboardModeOn,
        setIsFretboardModeOn
    };

    // Panel state persistence functions
    window.savePanelState = savePanelState;
    window.restoreAllPanelStates = restoreAllPanelStates;
    window.restoreTabPanelStates = restoreTabPanelStates;

    // Audio functions
    window.initAudio = initAudio;
    window.getPiano = getPiano;
    window.getGuitar = getGuitar;
    window.getInstrument = getInstrument;
    window.getAudioIsReady = getAudioIsReady;
    window.getCameraShutter = getCameraShutter;
    window.forceStopAllPlayback = forceStopAllPlayback;
    window.initAudioContextKeepAlive = initAudioContextKeepAlive;
    window.getMetronomeEnabled = getMetronomeEnabled;
    window.setMetronomeEnabled = setMetronomeEnabled;
    window.toggleMetronome = toggleMetronome;

    // Export/Import functions
    window.showPDFExportDialog = showPDFExportDialog;
    window.showMIDIExportDialog = showMIDIExportDialog;
    window.showMIDIImportDialog = showMIDIImportDialog;
    window.showAudioExportDialog = showAudioExportDialog;
    window.copyShareableLink = copyShareableLink;
    window.parseShareableLink = parseShareableLink;
    window.importFromMIDI = importFromMIDI;

    // Project management functions (raw functions)
    window.saveProjectToFile = saveProjectToFile;
    window.loadProjectFromFile = loadProjectFromFile;
    window.applyProjectToState = applyProjectToState;
    window.validateProjectData = validateProjectData;
    window.PROJECT_FORMAT_VERSION = PROJECT_FORMAT_VERSION;

    // Complete save project function - wraps saveProjectToFile with toast and UI cleanup
    window.saveProject = async function saveProject() {
        try {
            const compositionState = window.getCompositionState();
            if (!compositionState) {
                if (window.showToast) {
                    window.showToast('No composition to save', { type: 'error' });
                }
                return { success: false, error: 'No composition to save' };
            }

            const result = await saveProjectToFile(compositionState);

            if (result.success) {
                // Show success toast
                if (window.showToast) {
                    window.showToast(`Saved: ${result.filename}`, { type: 'success' });
                }

                // Close the FAB submenus (File dropdown) without closing the entire FAB
                if (window.closeFabSubmenus) {
                    window.closeFabSubmenus();
                }
            } else if (result.error !== 'Save cancelled') {
                // Show error toast (but not for user cancellation)
                if (window.showToast) {
                    window.showToast(result.error || 'Failed to save project', { type: 'error' });
                }
            }

            return result;
        } catch (error) {
            console.error('[IMTL Export] Error in saveProject:', error);
            if (window.showToast) {
                window.showToast(error.message || 'Failed to save project', { type: 'error' });
            }
            return { success: false, error: error.message };
        }
    };

    // Complete load project function - combines loadProjectFromFile + applyProjectToState
    window.loadProject = async function loadProject() {
        console.log('[IMTL Import] window.loadProject() called');
        try {
            // Get the project file
            console.log('[IMTL Import] Calling loadProjectFromFile()...');
            const result = await loadProjectFromFile();
            console.log('[IMTL Import] loadProjectFromFile() returned:', { success: result.success, error: result.error, hasProject: !!result.project });
            if (!result.success) {
                console.log('[IMTL Import] Load failed or cancelled:', result.error);
                if (result.error !== 'Load cancelled') {
                    toast.error(result.error || 'Failed to load project');
                }
                return { success: false, error: result.error };
            }

            // Get current state instances
            console.log('[IMTL Import] Getting compositionState and trainerState...');
            const compositionState = getCompositionState();
            const trainerState = getTrainerState();
            console.log('[IMTL Import] compositionState:', !!compositionState, 'trainerState:', !!trainerState);

            if (!compositionState || !trainerState) {
                const error = 'Application state not ready. Please wait for the app to fully load.';
                console.error('[IMTL Import] State not ready:', error);
                toast.error(error);
                return { success: false, error };
            }

            // Apply the project to state
            console.log('[IMTL Import] Calling applyProjectToState()...');
            const applyResult = applyProjectToState(result.project, compositionState, trainerState, {
                onProgressionLoaded: (progressionData) => {
                    console.log('[IMTL Import] onProgressionLoaded callback, progressionData length:', progressionData?.length);
                    // Refresh progression display after loading
                    if (window.renderProgressionDisplay) {
                        console.log('[IMTL Import] Calling renderProgressionDisplay for all three containers...');
                        window.renderProgressionDisplay('melody-progression-visualization', true);
                        window.renderProgressionDisplay('progression-visualization', true);
                        window.renderProgressionDisplay('builder-progression-visualization', true);
                    } else {
                        console.warn('[IMTL Import] window.renderProgressionDisplay not available!');
                    }
                },
                onNotationRefresh: () => {
                    console.log('[IMTL Import] onNotationRefresh callback');
                    if (window.refreshNotationFromProgression) {
                        console.log('[IMTL Import] Calling refreshNotationFromProgression...');
                        window.refreshNotationFromProgression();
                    } else {
                        console.warn('[IMTL Import] window.refreshNotationFromProgression not available!');
                    }
                }
            });
            console.log('[IMTL Import] applyProjectToState() returned:', applyResult);

            if (!applyResult.success) {
                console.error('[IMTL Import] Apply failed:', applyResult.error);
                toast.error(applyResult.error || 'Failed to apply project');
                return { success: false, error: applyResult.error };
            }

            // Update title display - prefer filename over default "Untitled Project"
            const metadataTitle = result.project.metadata?.title;
            const hasCustomTitle = metadataTitle && metadataTitle !== 'Untitled Project';
            const projectTitle = hasCustomTitle ? metadataTitle : (result.filename || 'Untitled Project');
            console.log('[IMTL Import] SUCCESS! Project loaded:', projectTitle);
            toast.success(`Loaded: ${projectTitle}`);

            // Note: refreshNotationFromProgression is already called via onNotationRefresh callback
            // and is debounced, so no need for an additional call here

            // Update key display in all locations (including melody-workbench-key-display)
            if (window.syncProgressionToMelodyTab) {
                window.syncProgressionToMelodyTab();
            }

            // Close the FAB submenus (File dropdown) without closing the entire FAB
            if (window.closeFabSubmenus) {
                window.closeFabSubmenus();
            }

            console.log('[IMTL Import] Load complete, returning success');
            return { success: true, project: result.project, filename: result.filename };
        } catch (error) {
            console.error('[IMTL Import] Caught error in loadProject:', error);
            const errorMessage = error.message || 'Failed to load project';
            toast.error(errorMessage);
            return { success: false, error: errorMessage };
        }
    };

    // Auto-save functions
    window.markDirty = markAutoSaveDirty;
    window.saveNow = saveAutoSaveNow;
    window.checkForRecovery = checkForRecovery;
    window.loadAutoSave = loadAutoSave;
    window.clearAutoSave = clearAutoSave;
    window.getAutoSaveStatus = getAutoSaveStatus;
    window.onAutoSave = onAutoSave;
    window.onDirtyStateChange = onDirtyStateChange;
    window.hasUnsavedChanges = hasUnsavedChanges;

    // Version history functions
    window.createVersion = createVersion;
    window.createCheckpoint = createCheckpoint;
    window.getVersions = getVersions;
    window.getVersionSnapshot = getVersionSnapshot;
    window.showVersionHistoryPanel = showVersionHistoryPanel;

    // Theory Tools functions
    window.initTheoryTools = initTheoryTools;
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

    // Song Search functions
    window.toggleSongSearchPanel = toggleSongSearchPanel;
    window.searchSongChords = searchSongChords;
    window.importSongProgression = importSongProgression;
    window.openUltimateGuitarSearch = openUltimateGuitarSearch;
    window.importInternetSongProgression = importInternetSongProgression;
    window.toggleSearchMode = toggleSearchMode;
    window.getSearchMode = getSearchMode;
    window.generateChordSuggestions = generateChordSuggestions;
    window.applySuggestedChord = applySuggestedChord;
    window.highlightChordInProgression = highlightChordInProgression;

    // Circle of Fifths functions
    window.initCircleOfFifths = initCircleOfFifths;
    window.toggleCircleOfFifthsPanel = toggleCircleOfFifthsPanel;
    window.openCircleOfFifthsPanel = openCircleOfFifthsPanel;
    window.closeCircleOfFifthsPanel = closeCircleOfFifthsPanel;

    // Guitar Fretboard functions
    window.initGuitarFretboard = initGuitarFretboard;
    window.toggleGuitarFretboardPanel = toggleGuitarFretboardPanel;
    window.openGuitarFretboardPanel = openGuitarFretboardPanel;
    window.closeGuitarFretboardPanel = closeGuitarFretboardPanel;
    window.updateGuitarFretboard = updateGuitarFretboard;

    // Teaching integration functions
    window.initTheoryMoments = initTheoryMoments;
    window.toggleTheoryMoments = toggleTheoryMoments;
    window.recallTheoryMoment = recallTheoryMoment;
    window.initWhyThisWorksEnhanced = initWhyThisWorksEnhanced;
    window.initTheoryOverlay = initTheoryOverlay;
    window.toggleTheoryOverlay = toggleTheoryOverlay;
    window.initCompositionInsights = initCompositionInsights;
    window.showInsightsDashboard = showInsightsDashboard;
    window.trackProgression = trackProgression;

    // Coach Engine functions
    window.getCoachEngine = getCoachEngine;
    window.initCoachEngine = initCoachEngine;
    window.toggleCoachEngine = function(enabled) {
        const engine = getCoachEngine();
        engine.setEnabled(enabled);
        // Update UI
        const statusEl = document.getElementById('coach-engine-status');
        if (statusEl) {
            statusEl.textContent = enabled ? 'On' : 'Off';
        }
        return enabled;
    };
    window.triggerCoachAnalysis = function() {
        const engine = getCoachEngine();
        engine.analyzeCurrentComposition();
    };
    window.setCoachSkillLevel = function(level) {
        const engine = getCoachEngine();
        engine.setSkillLevel(level);
    };
    window.recallCoachNudge = function() {
        if (window.recallCoachNudge) {
            return window.recallCoachNudge();
        }
        return false;
    };

    // Melody Generator functions
    window.generateProgressionMelody = generateProgressionMelody;
    window.playMelody = playMelodyInternal;
    window.stopMelody = stopMelodyInternal;
    window.setCurrentMelody = setCurrentMelody;
    window.getCurrentMelody = getCurrentMelody;
    window.exportMelodyToMIDI = exportMelodyToMIDI;
    window.renderMelodyNotation = renderMelodyNotation;
    window.renderChordMelodyTimeline = renderChordMelodyTimeline;
    window.toggleMelodyEditMode = toggleMelodyEditMode;
    window.updateMelodyNote = updateMelodyNote;
    window.deleteMelodyNote = deleteMelodyNote;
    window.insertMelodyNote = insertMelodyNote;
    window.refreshMelodyDisplay = refreshMelodyDisplay;

    // Interactive melody composition functions
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
    window.playAllMelody = playAllMelody;
    window.stopPlayAllMelody = stopPlayAllMelody;
    window.playMeasure = playMeasure;
    window.playSelectedMeasure = playSelectedMeasure;
    window.playFromSelectedMeasure = playFromSelectedMeasure;
    window.playProgressionOnly = playProgressionOnly;
    window.getSelectedMeasureIndex = getSelectedMeasureIndex;
    window.setSelectedMeasureIndex = setSelectedMeasureIndex;
    window.startStepMeasureMelody = startStepMeasureMelody;
    window.stopStepMeasureMelody = stopStepMeasureMelody;
    window.setMelodyClef = setMelodyClef;
    window.setChordClef = setChordClef;
    window.setHighlightEnabled = setHighlightEnabled;
    window.getHighlightEnabled = getHighlightEnabled;

    // New notation editor functions
    window.addRestToMelody = addRestToMelody;
    window.setTimeSignature = setTimeSignature;
    window.tieLastNote = tieLastNote;
    window.getEditorState = getEditorState;
    window.setAccidental = setAccidental;
    window.setDynamic = setDynamic;
    window.setMelodyTempo = setMelodyTempo;
    window.getCurrentTempo = getCurrentTempo;

    // Unified BPM setter - updates both compositionState.metadata.tempo AND interactiveMelody.tempo
    // This ensures all playback functions use the correct tempo
    window.setBPM = (bpm) => {
        const validBpm = Math.max(40, Math.min(300, parseInt(bpm) || 120));
        // Update compositionState (the official source of truth for saved projects)
        const compState = getCompositionState();
        if (compState && typeof compState.setTempo === 'function') {
            compState.setTempo(validBpm);
        }
        // Update interactiveMelody.tempo (used by playback functions)
        setMelodyTempo(validBpm);
    };
    window.getBPM = () => {
        // Get from compositionState first (official source), fall back to getCurrentTempo
        const compState = getCompositionState();
        if (compState && typeof compState.getTempo === 'function') {
            return compState.getTempo();
        }
        return getCurrentTempo();
    };

    // Composition State functions
    window.CompositionState = CompositionState;
    window.getCompositionState = getCompositionState;
    window.resetCompositionState = resetCompositionState;
    window.getBeatsPerMeasureFromTimeSignature = getBeatsPerMeasureFromTimeSignature;

    // Building Block functions
    window.BuildingBlock = BuildingBlock;
    window.BuildingBlockSequence = BuildingBlockSequence;
    window.Unit = Unit;
    window.UNITS_PER_BEAT = UNITS_PER_BEAT;
    window.unitsToDuration = unitsToDuration;
    window.durationToUnits = durationToUnits;

    // Progression Notation Sync functions
    window.ProgressionNotationSync = ProgressionNotationSync;
    window.getProgressionNotationSync = getProgressionNotationSync;
    window.initProgressionNotationSync = initProgressionNotationSync;
    window.syncProgressionToComposition = syncProgressionToComposition;
    window.syncCompositionToProgression = syncCompositionToProgression;

    // Bass Auto Fill functions
    window.generateBassVoicing = generateBassVoicing;
    window.generateBassRhythm = generateBassRhythm;
    window.calculateVoiceLeadingScore = calculateVoiceLeadingScore;
    window.BASS_PATTERN_OCTAVE_DEFAULTS = BASS_PATTERN_OCTAVE_DEFAULTS;
    window.getDefaultOctaveForPattern = getDefaultOctaveForPattern;

    // Migration Helper functions
    window.migrateToCompositionState = migrateToCompositionState;
    window.migrateProgressionOnly = migrateProgressionOnly;
    window.autoMigrateOnTabSwitch = autoMigrateOnTabSwitch;
    window.exportToOldFormats = exportToOldFormats;
    window.needsMigration = needsMigration;
    window.validateMigration = validateMigration;
    window.backupOldData = backupOldData;
    window.restoreFromBackup = restoreFromBackup;

    // Melody Composer Bridge functions
    window.initMelodyComposerBridge = initMelodyComposerBridge;
    window.syncProgressionToMelodyComposer = syncProgressionToMelodyComposer;
    window.importInteractiveMelodyToComposition = importInteractiveMelodyToComposition;
    window.exportCompositionToInteractiveMelody = exportCompositionToInteractiveMelody;
    window.getBridgeCompositionState = getBridgeCompositionState;
    window.addNoteViaBridge = addNoteViaBridge;
    window.addNoteIntelligently = addNoteIntelligently;
    window.setBassPattern = setBassPattern;
    window.setBassOctave = setBassOctave;
    window.getBassOctave = getBassOctave;
    window.getEffectiveBassOctave = getEffectiveBassOctave;
    window.hasUserEditedBass = hasUserEditedBass;
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

    // =========================================================================
    // BASS PATTERN UI HANDLERS
    // =========================================================================

    let _previousBassPattern = 'root-fifth';
    let _previousBassOctave = 'auto';

    /**
     * Handle bass pattern change with user edit protection
     */
    window.handleBassPatternChange = function(newPattern, selectEl) {
        const settings = getBridgeSettings();
        const autoGenerateEnabled = settings?.autoGenerateBass;

        // Only check for edits if auto-generate is ON
        if (autoGenerateEnabled && hasUserEditedBass()) {
            const confirmed = confirm(
                'You have manually edited bass notes that will be overwritten by this change.\n\n' +
                'Continue with this pattern change?'
            );
            if (!confirmed) {
                selectEl.value = _previousBassPattern;
                return;
            }
        }

        _previousBassPattern = newPattern;
        setBassPattern(newPattern);
        window.updateBassOctaveSelector && window.updateBassOctaveSelector();
        window.refreshNotationFromProgression && window.refreshNotationFromProgression();

        // Sync the other pattern selector
        const otherSelector = selectEl.id === 'bass-pattern-select-card'
            ? document.getElementById('bass-pattern-select')
            : document.getElementById('bass-pattern-select-card');
        if (otherSelector) {
            otherSelector.value = newPattern;
        }
    };

    /**
     * Handle bass octave change with user edit protection
     */
    window.handleBassOctaveChange = function(newOctaveValue, selectEl) {
        const settings = getBridgeSettings();
        const autoGenerateEnabled = settings?.autoGenerateBass;

        if (autoGenerateEnabled && hasUserEditedBass()) {
            const confirmed = confirm(
                'You have manually edited bass notes that will be overwritten by this change.\n\n' +
                'Continue with this octave change?'
            );
            if (!confirmed) {
                selectEl.value = _previousBassOctave;
                return;
            }
        }

        _previousBassOctave = newOctaveValue;

        let octaveValue = null;
        if (newOctaveValue === '2') octaveValue = 2;
        else if (newOctaveValue === '3') octaveValue = 3;

        setBassOctave(octaveValue);

        if (window.refreshNotationFromProgression) {
            window.refreshNotationFromProgression();
        }

        // Sync the other octave selector
        const otherSelector = selectEl.id === 'bass-octave-select-card'
            ? document.getElementById('bass-octave-select')
            : document.getElementById('bass-octave-select-card');
        if (otherSelector) {
            otherSelector.value = newOctaveValue;
        }
    };

    /**
     * Update the bass octave selector UI to reflect current state
     */
    window.updateBassOctaveSelector = function() {
        const currentOctave = getBassOctave();
        const selectors = [
            document.getElementById('bass-octave-select'),
            document.getElementById('bass-octave-select-card')
        ];

        selectors.forEach(selector => {
            if (selector) {
                selector.value = currentOctave === null ? 'auto' : String(currentOctave);

                // Update "Auto" option to show pattern default
                const patternSelect = selector.id === 'bass-octave-select-card'
                    ? document.getElementById('bass-pattern-select-card')
                    : document.getElementById('bass-pattern-select');

                if (patternSelect) {
                    const pattern = patternSelect.value;
                    const defaultOctave = getDefaultOctaveForPattern(pattern);
                    const autoOption = selector.querySelector('option[value="auto"]');
                    if (autoOption) {
                        autoOption.textContent = `Auto (${defaultOctave})`;
                    }
                }
            }
        });
    };

    /**
     * Apply bass pattern to ALL chords
     */
    window.applyBassPatternToAll = async function() {
        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        if (!compositionState) {
            window.toast?.error('Composition state not available');
            return;
        }

        const chordCount = compositionState.storedProgressionData?.length || 0;
        if (chordCount === 0) {
            window.toast?.warning('No chords in progression');
            return;
        }

        const patternSelect = document.getElementById('bass-pattern-select-card') ||
                             document.getElementById('bass-pattern-select');
        const bassPattern = patternSelect?.value || 'root-fifth';

        const octaveSelect = document.getElementById('bass-octave-select-card');
        const inversionToggle = document.getElementById('bass-follows-inversion-toggle-card');
        const bassOctave = octaveSelect?.value === 'auto' ? null : parseInt(octaveSelect?.value || '2');
        const bassFollowsInversion = inversionToggle?.checked || false;

        const confirmed = await showConfirmModal({
            title: 'Apply Bass Pattern to All',
            message: `Apply "<strong>${bassPattern}</strong>" bass pattern to all ${chordCount} chords?<br><br>This will overwrite any existing bass notes.`,
            confirmText: 'Apply to All',
            cancelText: 'Cancel'
        });
        if (!confirmed) return;

        // Update settings
        compositionState.updateSettings({
            bassPattern: bassPattern,
            bassOctave: bassOctave,
            bassFollowsInversion: bassFollowsInversion
        });

        // Clear per-chord patterns
        if (compositionState.storedProgressionData) {
            for (let i = 0; i < compositionState.storedProgressionData.length; i++) {
                compositionState.storedProgressionData[i].bassPattern = null;
            }
        }

        const trainerState = window.getTrainerState ? window.getTrainerState() : null;
        if (trainerState?.progressionData) {
            for (let i = 0; i < trainerState.progressionData.length; i++) {
                if (trainerState.progressionData[i]) {
                    trainerState.progressionData[i].bassPattern = null;
                }
            }
        }

        // Force rebuild of chord segments to ensure they're current
        if (typeof compositionState.buildChordSegments === 'function') {
            compositionState.buildChordSegments();
        }

        // Regenerate all bass - this writes directly to measures
        // Do NOT call renderBassBlocksToMeasures() after this as it would overwrite
        // the generated notes with the (unchanged) building block contents
        if (typeof compositionState.regenerateAllAutoBassByBuildingBlock === 'function') {
            compositionState.regenerateAllAutoBassByBuildingBlock();
        }

        window.refreshNotationFromProgression && window.refreshNotationFromProgression();
        window.renderProgressionDisplay && window.renderProgressionDisplay();
        window.toast?.success(`Applied "${bassPattern}" to all ${chordCount} chords`);
    };

    /**
     * Apply bass pattern to selected chord cards
     */
    window.applyBassToSelection = function() {
        const selectedIndices = window.getSelectedChordIndicesArray ? window.getSelectedChordIndicesArray() : [];
        if (selectedIndices.length === 0) {
            window.toast?.warning('Please select one or more chord cards first');
            return;
        }

        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        if (!compositionState) {
            window.toast?.error('Composition state not available');
            return;
        }

        if (typeof compositionState.setChordBassPattern !== 'function') {
            window.toast?.error('Per-chord bass pattern feature not available');
            return;
        }

        const patternSelect = document.getElementById('bass-pattern-select-card') ||
                             document.getElementById('bass-pattern-select');
        const bassPattern = patternSelect?.value || 'root-fifth';

        const trainerState = window.getTrainerState ? window.getTrainerState() : null;

        // Force rebuild of chord segments to ensure they're current
        if (typeof compositionState.buildChordSegments === 'function') {
            compositionState.buildChordSegments();
        }

        let successCount = 0;
        for (const chordIndex of selectedIndices) {
            if (compositionState.setChordBassPattern(chordIndex, bassPattern)) {
                if (trainerState?.progressionData?.[chordIndex]) {
                    trainerState.progressionData[chordIndex].bassPattern = bassPattern;
                }
                successCount++;
            }
        }

        // setChordBassPattern already calls regenerateAutoBassByChordIndex which writes
        // directly to measures. Do NOT call renderBassBlocksToMeasures() as it would
        // overwrite the generated notes with the (unchanged) building block contents.

        window.refreshNotationFromProgression && window.refreshNotationFromProgression();
        window.renderProgressionDisplay && window.renderProgressionDisplay();

        if (successCount > 0) {
            window.toast?.success(`Applied "${bassPattern}" to ${successCount} chord${successCount > 1 ? 's' : ''}`);
        }
    };

    /**
     * Revert selected chords' bass to chord voicings
     */
    window.revertBassToChordVoicing = function() {
        const selectedIndices = window.getSelectedChordIndicesArray ? window.getSelectedChordIndicesArray() : [];
        if (selectedIndices.length === 0) {
            window.toast?.warning('Please select one or more chord cards first');
            return;
        }

        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        if (!compositionState) {
            window.toast?.error('Composition state not available');
            return;
        }

        const trainerState = window.getTrainerState ? window.getTrainerState() : null;

        // Force rebuild of chord segments to ensure they're current
        if (typeof compositionState.buildChordSegments === 'function') {
            compositionState.buildChordSegments();
        }

        let successCount = 0;
        for (const chordIndex of selectedIndices) {
            // Clear per-chord pattern
            if (compositionState.storedProgressionData?.[chordIndex]) {
                compositionState.storedProgressionData[chordIndex].bassPattern = null;
            }
            if (trainerState?.progressionData?.[chordIndex]) {
                trainerState.progressionData[chordIndex].bassPattern = null;
            }

            // Place chord voicing in bass (handles multi-measure chords with ties)
            if (typeof compositionState.placeChordVoicingInBassForChord === 'function') {
                if (compositionState.placeChordVoicingInBassForChord(chordIndex)) {
                    successCount++;
                }
            }
        }

        // placeChordVoicingInBassForChord writes directly to measures.
        // Do NOT call renderBassBlocksToMeasures() as it would overwrite.

        window.refreshNotationFromProgression && window.refreshNotationFromProgression();
        window.renderProgressionDisplay && window.renderProgressionDisplay();

        if (successCount > 0) {
            window.toast?.success(`Reverted ${successCount} chord${successCount > 1 ? 's' : ''} to chord voicing`);
        }
    };

    /**
     * Revert ALL chords' bass to chord voicings
     */
    window.revertAllBassToChordVoicing = function() {
        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        if (!compositionState) {
            window.toast?.error('Composition state not available');
            return;
        }

        const chordCount = compositionState.storedProgressionData?.length || 0;
        if (chordCount === 0) {
            window.toast?.warning('No chords in progression');
            return;
        }

        const confirmed = confirm(
            `Revert bass for all ${chordCount} chords to their chord card voicings?\n\n` +
            'This will replace any bass patterns with the chord notes.'
        );
        if (!confirmed) return;

        const trainerState = window.getTrainerState ? window.getTrainerState() : null;

        // Force rebuild of chord segments to ensure they're current
        if (typeof compositionState.buildChordSegments === 'function') {
            compositionState.buildChordSegments();
        }

        // Clear all per-chord patterns
        if (compositionState.storedProgressionData) {
            for (let i = 0; i < compositionState.storedProgressionData.length; i++) {
                compositionState.storedProgressionData[i].bassPattern = null;
            }
        }
        if (trainerState?.progressionData) {
            for (let i = 0; i < trainerState.progressionData.length; i++) {
                if (trainerState.progressionData[i]) {
                    trainerState.progressionData[i].bassPattern = null;
                }
            }
        }

        // Place chord voicing in bass for each chord (handles multi-measure chords with ties)
        for (let i = 0; i < chordCount; i++) {
            if (typeof compositionState.placeChordVoicingInBassForChord === 'function') {
                compositionState.placeChordVoicingInBassForChord(i);
            }
        }

        // placeChordVoicingInBassForChord writes directly to measures.
        // Do NOT call renderBassBlocksToMeasures() as it would overwrite.

        window.refreshNotationFromProgression && window.refreshNotationFromProgression();
        window.renderProgressionDisplay && window.renderProgressionDisplay();
        window.toast?.success(`Reverted all ${chordCount} chords to chord voicings`);
    };

    // Enhanced notation system functions
    window.initEnhancedNotation = initEnhancedNotation;
    window.renderEnhancedNotation = renderEnhancedNotation;
    window.refreshNotationFromProgression = refreshNotationFromProgression;
    window.flushNotationRefresh = flushNotationRefresh;
    window.getNotationRenderStats = getNotationRenderStats;
    window.resetNotationRenderStats = resetNotationRenderStats;
    window.setNotationDuration = setNotationDuration;
    window.setNotationRestMode = setNotationRestMode;
    window.setNotationDotted = setNotationDotted;
    window.setNotationAccidental = setNotationAccidental;
    window.getNotationState = getNotationState;
    window.highlightPlayingNote = highlightPlayingNote;
    window.clearPlaybackHighlights = clearPlaybackHighlights;
    window.getNotationComposer = getNotationComposer;
    window.isNotationInitialized = isNotationInitialized;
    window.showNotationShortcuts = showNotationShortcuts;

    // Song Analyzer functions
    window.initSongAnalyzer = initSongAnalyzer;
    window.openAudioAnalyzerModal = openAudioAnalyzerModal;
    window.startAudioAnalysis = startAudioAnalysis;
    window.importDetectedChords = importDetectedChords;
    window.clearAudioFile = clearAudioFile;
    window.reanalyzeAudio = reanalyzeAudio;
    window.closeAudioAnalyzerModal = closeAudioAnalyzerModal;
    window.transposeDetectedChords = transposeDetectedChords;
    window.setExpectedKey = setExpectedKey;
    window.resetTranspose = resetTranspose;
    window.searchOnlineChords = searchOnlineChords;

    // Melody controls panel toggle
    window.toggleMelodyControlsPanel = toggleMelodyControlsPanel;

    // Sync progression to melody tab
    window.syncProgressionToMelodyTab = syncProgressionToMelodyTab;

    // Manual chord entry modal
    window.openManualChordEntryModal = openManualChordEntryModal;
    window.closeManualChordEntryModal = closeManualChordEntryModal;

    // Auto harmonize modal
    window.showAutoHarmonizeModal = showAutoHarmonizeModal;

    // Tension optimizer modal
    window.showTensionOptimizerModal = showTensionOptimizerModal;

    // Preset UI functions
    window.initPresetUI = initPresetUI;
    window.togglePresetPanel = togglePresetPanel;
    window.openPresetPanel = openPresetPanel;
    window.closePresetPanel = closePresetPanel;

    // Unified suggestions panel
    window.initUnifiedSuggestionsPanel = initUnifiedSuggestionsPanel;

    // Why This Works panel
    window.initWhyThisWorksPanel = initWhyThisWorksPanel;

    // Learn Tab - lazy loaded in tabs.js, but provide a stub for compatibility
    window.initLearnTab = async () => {
        const module = await import('../modules/ui/learnTabController.js');
        module.initLearnTab();
    };

    // Let It Be Tutorial
    window.startLetItBeTutorial = startLetItBeTutorial;
    window.dispatchBuilderEvent = dispatchBuilderEvent;

    // Builder state getters (for other modules)
    window.getBuilderRootIndex = getBuilderRootIndex;
    window.getBuilderChordType = getBuilderChordType;
    window.getBuilderInversion = getBuilderInversion;
    window.getBuilderOctaveShift = getBuilderOctaveShift;
    window.getBuilderSelectionMode = getBuilderSelectionMode;
    window.getBuilderIntervalType = getBuilderIntervalType;
    window.getBuilderOmittedNotes = getBuilderOmittedNotes;
    window.getBuilderChordNotes = getBuilderChordNotes;
    window.setBuilderChordType = setBuilderChordType;
    window.setBuilderIntervalType = setBuilderIntervalType;

    // Trainer state functions
    window.setProgressionData = setProgressionData;
    window.getCurrentKey = getCurrentKey;
    window.setCurrentKey = setCurrentKey;
    window.invalidateProgressionDataCache = invalidateProgressionDataCache;

    // Songwriting Wizard functions
    window.showSongBuilderModal = showSongBuilderModal;

    // Progression Modals functions
    window.showAddSectionMenu = showAddSectionMenu;

    // Floating Suggestions Panel functions
    window.togglePanel = togglePanel;

    // Measure Isolation Editor
    window.openMeasureIsolationEditor = (measureIndex) => {
        const compositionState = window.getCompositionState ? window.getCompositionState() : null;
        if (!compositionState) {
            console.error('[MeasureIsolationEditor] No compositionState available');
            return;
        }

        // Save state for undo before opening editor
        if (window.saveStateBeforeChange) {
            window.saveStateBeforeChange();
        }

        openMeasureIsolationEditor(measureIndex, {
            compositionState,
            onApply: () => {
                // Refresh displays after changes applied
                if (window.refreshNotationFromProgression) {
                    window.refreshNotationFromProgression();
                }
            },
            onCancel: () => {
                // Nothing special needed
            }
        });
    };
    window.getMeasureIsolationEditor = getMeasureIsolationEditor;

    // Full-Screen Notation Editor (Tab mode only - modal mode is deprecated)
    // NOTE: openFullScreenNotation, closeFullScreenNotation, toggleFullScreenNotation are REMOVED
    // Users access Composition Studio via switchTab('studio-new'), not modal
    window.getFullScreenNotationEditor = getFullScreenNotationEditor;

    // Full-Screen Chord Lab Editor
    window.initChordLabNewTab = initChordLabNewTab;
    window.closeChordLabNewTab = closeChordLabNewTab;
    window.getFullScreenChordLabEditor = getFullScreenChordLabEditor;

    // Full-Screen Scale Explorer
    window.initScaleExplorerNewTab = initScaleExplorerNewTab;
    window.closeScaleExplorerNewTab = closeScaleExplorerNewTab;
    window.getFullScreenScaleExplorer = getFullScreenScaleExplorer;
}
