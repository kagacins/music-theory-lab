/**
 * Main Entry Point
 * Initializes the application and exposes necessary functions to the global scope for HTML event handlers
 *
 * GOOGLE CUSTOM SEARCH API CONFIGURATION:
 * - Production (Netlify): Uses serverless function with env vars (API key hidden)
 * - Local dev: Uses VITE_GOOGLE_SEARCH_API_KEY from .env.local
 *
 * See GOOGLE_SEARCH_API_SETUP.md for detailed setup instructions.
 */

// Google Custom Search API Configuration
// In production, these will be undefined and the Netlify function will be used instead
// In local dev, these come from .env.local (gitignored)
window.GOOGLE_SEARCH_API_KEY = import.meta.env.VITE_GOOGLE_SEARCH_API_KEY || '';
window.GOOGLE_SEARCH_ENGINE_ID = import.meta.env.VITE_GOOGLE_SEARCH_ENGINE_ID || '';

// Import all necessary modules
import { switchTab, refreshAllTabs, initTabHistory } from './modules/ui/tabs.js';
import { initAllSectionDragDrop } from './modules/ui/sectionDragDrop.js';
import { initAllSectionSidebars, triggerSectionSidebarUpdate } from './modules/ui/sectionSidebar.js';
// REMOVED: import { initFloatingSuggestionsPanel } from './modules/ui/floatingSuggestionsPanel.js';
import { showModal, hideModal, showModalHTML, showAboutModal, hideAboutModal } from './modules/ui/modals.js';
import { renderKeyboard, updateKeyboardLabels, updateKeyNames, clearHighlights, g_KeyboardKeys } from './modules/ui/keyboard.js';
import { updateKeySignatureDisplay, setupResponsiveTitle } from './modules/ui/header.js';
import { toggleSidebar, toggleSettingsGroup, restoreSettingsGroupStates, toggleHeaderDisplays, restoreHeaderDisplaysState } from './modules/ui/sidebar.js';
import { showSettingsModal, showChordWeightsModal, showMelodyWeightsModal } from './modules/ui/settingsModal.js';
import { initPresetUI, togglePresetPanel, openPresetPanel, closePresetPanel } from './modules/ui/presetUI.js';
import { initUnifiedSuggestionsPanel, updateUnifiedSuggestions } from './modules/ui/unifiedSuggestionsPanel.js';
import { initWhyThisWorksPanel } from './modules/ui/whyThisWorksPanel.js';
import { openManualChordEntryModal, closeManualChordEntryModal } from './modules/ui/manualChordEntryModal.js';
import { showAutoHarmonizeModal } from './modules/ui/autoHarmonizeModal.js';
import { showTensionOptimizerModal } from './modules/ui/tensionOptimizerModal.js';
import { toast, showToast } from './modules/ui/toastNotifications.js';
// Phase 1.3 & Phase 2: Interactive Learning Tools
import { showChordComparisonModal } from './modules/ui/chordComparisonModal.js';
import { showWhatIfSandbox } from './modules/ui/whatIfSandbox.js';
import { initChordFunctionLegend, showLegend as showChordFunctionLegend, hideLegend as hideChordFunctionLegend, toggleLegend as toggleChordFunctionLegend } from './modules/ui/chordFunctionLegend.js';
// Phase 3: Guided Learning Journeys
import { initLearnTab } from './modules/ui/learnTabController.js';
import { dispatchBuilderEvent } from './modules/ui/lessonGuidedMode.js';
// Tier 1: Teaching-Composition Integration
import { initTheoryMoments, toggleTheoryMoments } from './modules/teaching/theoryMoments.js';
import { initWhyThisWorksEnhanced } from './modules/teaching/whyThisWorksEnhanced.js';
import { initTheoryOverlay, toggleTheoryOverlay } from './modules/teaching/theoryOverlay.js';
import { initCompositionInsights, showInsightsDashboard, trackProgression } from './modules/teaching/compositionInsights.js';
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
    importInternetSongProgression,
    toggleSearchMode,
    getSearchMode,
    generateChordSuggestions,
    applySuggestedChord,
    highlightChordInProgression
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
// REFACTORED: progressionBuilder.js split into 7 modules (Complete - 2025-12-28)
// All functions now fully implemented in new modular structure
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
    renderProgressionDisplayForBuilder,
    highlightTrainer
} from './modules/features/progressionBuilder/index.js';
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
} from './modules/features/scaleExplorer.js';
import { initAudio, getPiano, getGuitar, getInstrument, getAudioIsReady, getCameraShutter, forceStopAllPlayback, initAudioContextKeepAlive, getMetronomeEnabled, setMetronomeEnabled, toggleMetronome } from './modules/audio/audioEngine.js';
import { updateUndoRedoButtons } from './modules/utils/undoRedo.js';
import { savePanelState, restoreAllPanelStates, restoreTabPanelStates } from './modules/storage/panelState.js';
import {
    initExportService,
    showPDFExportDialog,
    showMIDIExportDialog,
    showMIDIImportDialog,
    showAudioExportDialog,
    copyShareableLink,
    parseShareableLink,
    importFromMIDI
} from './modules/export/exportService.js';
import {
    saveProjectToFile,
    loadProjectFromFile,
    applyProjectToState,
    validateProjectData,
    PROJECT_FORMAT_VERSION
} from './modules/storage/projectManager.js';
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
} from './modules/storage/autoSave.js';
import {
    initVersionHistory,
    createVersion,
    createCheckpoint,
    getVersions,
    getVersionSnapshot
} from './modules/storage/versionHistory.js';
import { showVersionHistoryPanel } from './modules/ui/versionHistoryPanel.js';
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
// Import voice leading overlay to register global toggle functions
import './modules/notation/voiceLeadingOverlay.js';
// Import theory insights panel to register global functions
import './modules/ui/theoryInsightsPanel.js';
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
} from './modules/audio/melodyGenerator.js';

// Phase 1A: New composition integration modules
import {
    CompositionState,
    getCompositionState,
    resetCompositionState,
    getBeatsPerMeasureFromTimeSignature
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
} from './modules/integration/melodyComposerBridge.js';

// Bass pattern octave defaults
import {
    BASS_PATTERN_OCTAVE_DEFAULTS,
    getDefaultOctaveForPattern
} from './modules/integration/bassAutoFill.js';

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

// Audio analysis for chord detection from uploaded songs
import {
    initSongAnalyzer,
    openAudioAnalyzerModal,
    startAudioAnalysis,
    importDetectedChords
} from './modules/features/songAnalyzer.js';

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

// ============================================================================
// MOBILE/TOUCH DEVICE HANDLING
// ============================================================================

/**
 * Handle tooltips on mobile/touch devices
 * On touch devices, native title tooltips can interfere with button presses
 * This removes them and stores the info in data-tooltip for accessibility
 */
function handleMobileTooltips() {
    // Detect touch capability (for tooltip handling)
    const hasTouchCapability = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // More conservative mobile detection for FAB (actual mobile devices)
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        || (hasTouchCapability && window.innerWidth <= 768);

    if (hasTouchCapability) {
        // Find all elements with title attributes and convert them
        const elementsWithTitles = document.querySelectorAll('[title]');
        elementsWithTitles.forEach(el => {
            const title = el.getAttribute('title');
            if (title) {
                // Store in data attribute for potential custom tooltip/accessibility
                el.setAttribute('data-tooltip', title);
                // Remove native title to prevent popup on tap
                el.removeAttribute('title');
            }
        });

        // Add a class to body so CSS can adjust for touch
        document.body.classList.add('touch-device');
    }

    // Show mobile FAB (currently enabled for testing on all devices)
    // TODO: Restore mobile-only check after FAB is refined: if (isMobileDevice) { ... }
    const mobileFab = document.getElementById('mobile-fab');
    if (mobileFab) {
        mobileFab.classList.remove('hidden');
    }
    initMobileFab();
}

/**
 * Initialize the Mobile Floating Action Button (FAB)
 * 2-tier Speed Dial for comprehensive quick access on touch devices
 */
function initMobileFab() {
    const fabMain = document.getElementById('mobile-fab-main');
    const fabMenu = document.getElementById('mobile-fab-menu');
    const fabCategories = document.querySelectorAll('.fab-category');

    if (!fabMain || !fabMenu) return;

    let isOpen = false;
    let activeSubmenu = null;
    let isHandlingAction = false; // Flag to prevent closing during action handling

    // Quick buttons containers for each tab
    const fabBuilderQuickButtons = document.getElementById('fab-builder-quick-buttons');
    const fabMelodyQuickButtons = document.getElementById('fab-melody-quick-buttons');
    // Individual button references for event handlers
    const fabAddChordQuick = document.getElementById('fab-add-chord-quick');
    const fabPlayChordQuick = document.getElementById('fab-play-chord-quick');

    // Toggle main FAB menu (first tier)
    fabMain.addEventListener('click', (e) => {
        e.stopPropagation();
        isOpen = !isOpen;
        fabMenu.classList.toggle('hidden', !isOpen);
        fabMain.querySelector('.fab-icon').style.transform = isOpen ? 'rotate(45deg)' : 'rotate(0deg)';

        // Dispatch event for guided mode tutorials when FAB is opened
        if (isOpen) {
            dispatchBuilderEvent('fabOpened', { tab: window.currentTab || 'builder' });
        }

        // Hide/show quick buttons based on FAB state and current tab
        if (fabBuilderQuickButtons && window.currentTab === 'builder') {
            fabBuilderQuickButtons.classList.toggle('hidden', isOpen);
        }
        if (fabMelodyQuickButtons && window.currentTab === 'melody') {
            fabMelodyQuickButtons.classList.toggle('hidden', isOpen);
        }

        // Close any open submenu when closing main menu
        if (!isOpen) {
            closeAllSubmenus();
            // Dispatch event for guided mode tutorials when FAB is closed
            dispatchBuilderEvent('fabClosed', {});
        }

        // Show labels on hover
        if (isOpen) {
            showCategoryLabels();

            // Update context-aware labels based on current tab
            const currentTab = window.currentTab || 'builder';
            const suggestionsCategory = document.querySelector('[data-category="suggestions"]');
            if (suggestionsCategory) {
                const label = suggestionsCategory.querySelector('.fab-label');
                const btn = suggestionsCategory.querySelector('.fab-category-btn');
                if (currentTab === 'builder') {
                    if (label) label.textContent = 'Add';
                    // Change icon to plus-circle (distinct from FAB expand button)
                    if (btn) btn.innerHTML = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd"/></svg>';
                } else {
                    if (label) label.textContent = 'Suggestions';
                    // Change icon to lightbulb
                    if (btn) btn.innerHTML = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"/></svg>';
                }
            }
        }
    });

    // Category buttons toggle submenus (second tier)
    fabCategories.forEach(category => {
        const categoryBtn = category.querySelector('.fab-category-btn');
        const categoryType = category.dataset.category;

        categoryBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            // Close other categories' submenus
            fabCategories.forEach(other => {
                if (other !== category) {
                    other.querySelectorAll('.fab-submenu').forEach(sub => sub.classList.add('hidden'));
                }
            });

            // For playback category, show the correct submenu based on current tab
            if (categoryType === 'playback') {
                const currentTab = window.currentTab || 'builder';
                const builderSubmenu = document.getElementById('fab-playback-builder');
                const melodySubmenu = document.getElementById('fab-playback-melody');
                const defaultSubmenu = document.getElementById('fab-playback-default');

                // Determine target submenu
                let targetSubmenu;
                if (currentTab === 'builder') {
                    targetSubmenu = builderSubmenu;
                } else if (currentTab === 'melody') {
                    targetSubmenu = melodySubmenu;
                } else {
                    targetSubmenu = defaultSubmenu;
                }

                // Check if currently open BEFORE hiding
                const isCurrentlyOpen = targetSubmenu && !targetSubmenu.classList.contains('hidden');

                // Hide all playback submenus
                [builderSubmenu, melodySubmenu, defaultSubmenu].forEach(sub => {
                    if (sub) sub.classList.add('hidden');
                });

                // Toggle: if was open, leave closed; if was closed, show it
                if (targetSubmenu && !isCurrentlyOpen) {
                    targetSubmenu.classList.remove('hidden');
                    activeSubmenu = targetSubmenu;
                } else {
                    activeSubmenu = null;
                }
            } else if (categoryType === 'suggestions') {
                // For suggestions category, show Add (builder) or Suggestions (melody)
                const currentTab = window.currentTab || 'builder';
                const addSubmenu = document.getElementById('fab-add-builder');
                const suggestionsSubmenu = document.getElementById('fab-suggestions-melody');

                // Determine target submenu
                let targetSubmenu;
                if (currentTab === 'builder') {
                    targetSubmenu = addSubmenu;
                } else if (currentTab === 'melody') {
                    targetSubmenu = suggestionsSubmenu;
                }

                // Check if currently open BEFORE hiding
                const isCurrentlyOpen = targetSubmenu && !targetSubmenu.classList.contains('hidden');

                // Hide both submenus
                [addSubmenu, suggestionsSubmenu].forEach(sub => {
                    if (sub) sub.classList.add('hidden');
                });

                // Toggle: if was open, leave closed; if was closed, show it
                if (targetSubmenu && !isCurrentlyOpen) {
                    targetSubmenu.classList.remove('hidden');
                    activeSubmenu = targetSubmenu;
                } else {
                    activeSubmenu = null;
                }
            } else if (categoryType === 'settings') {
                // For settings category, toggle submenu and dispatch event for tutorial
                const submenu = category.querySelector('.fab-submenu');
                if (submenu) {
                    const isSubmenuOpen = !submenu.classList.contains('hidden');
                    submenu.classList.toggle('hidden', isSubmenuOpen);
                    activeSubmenu = isSubmenuOpen ? null : submenu;

                    // Dispatch event for tutorial tracking
                    if (!isSubmenuOpen) {
                        dispatchBuilderEvent('settingsSectionClicked', {});
                    }
                }
            } else {
                // For other categories, toggle their single submenu
                const submenu = category.querySelector('.fab-submenu');
                if (submenu) {
                    const isSubmenuOpen = !submenu.classList.contains('hidden');
                    submenu.classList.toggle('hidden', isSubmenuOpen);
                    activeSubmenu = isSubmenuOpen ? null : submenu;
                }
            }
        });

        // Handle submenu action buttons (both circular .fab-action buttons and dropdown menu buttons)
        const actionBtns = category.querySelectorAll('.fab-action, .fab-submenu button[data-action]');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                // Set flag to prevent document click handler from closing FAB
                isHandlingAction = true;
                handleFabAction(action);

                // Keep dropdown open - only close when clicking category button or outside FAB
                // (removed auto-close behavior per user request)

                // Reset flag after a short delay to allow any triggered clicks to complete
                setTimeout(() => {
                    isHandlingAction = false;
                }, 100);
            });
        });
    });

    // Wire up FAB settings panel controls
    initFabSettingsPanel();

    // Close FAB when clicking outside (but not when clicking on FAB elements or during action handling)
    document.addEventListener('click', (e) => {
        // Check both local flag and global flag (for settings panel controls)
        if (isOpen && !isHandlingAction && !window._fabIsHandlingAction && !e.target.closest('#mobile-fab')) {
            closeFab();
        }
    });

    function closeAllSubmenus() {
        // Close ALL submenus in ALL categories (some categories have multiple submenus)
        fabCategories.forEach(category => {
            category.querySelectorAll('.fab-submenu').forEach(submenu => {
                submenu.classList.add('hidden');
            });
        });
        // Also close any standalone submenus by ID
        ['fab-playback-builder', 'fab-playback-melody', 'fab-playback-default',
         'fab-add-builder', 'fab-suggestions-melody', 'fab-file-dropdown',
         'fab-edit-dropdown', 'fab-help-dropdown'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        activeSubmenu = null;
    }

    function showCategoryLabels() {
        // Briefly show labels then fade them
        const labels = document.querySelectorAll('.fab-label');
        labels.forEach(label => {
            label.style.opacity = '1';
            setTimeout(() => {
                label.style.opacity = '0';
            }, 1500);
        });
    }

    function closeFab() {
        isOpen = false;
        fabMenu.classList.add('hidden');
        fabMain.querySelector('.fab-icon').style.transform = 'rotate(0deg)';
        closeAllSubmenus();
        // Show quick buttons when closing FAB based on current tab
        if (fabBuilderQuickButtons && window.currentTab === 'builder') {
            fabBuilderQuickButtons.classList.remove('hidden');
        }
        if (fabMelodyQuickButtons && window.currentTab === 'melody') {
            fabMelodyQuickButtons.classList.remove('hidden');
        }
        // Dispatch event for guided mode tutorials
        dispatchBuilderEvent('fabClosed', {});
    }

    // Expose closeFab globally so it can be called on tab change
    window.closeFab = closeFab;

    // Quick Play Chord button - press-and-hold pattern for Chord Lab
    if (fabPlayChordQuick) {
        // Mouse events
        fabPlayChordQuick.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (window.startBuilderChord) window.startBuilderChord();
        });
        fabPlayChordQuick.addEventListener('mouseup', () => {
            if (window.stopBuilderChord) window.stopBuilderChord();
        });
        fabPlayChordQuick.addEventListener('mouseleave', () => {
            if (window.stopBuilderChord) window.stopBuilderChord();
        });

        // Touch events
        fabPlayChordQuick.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (window.startBuilderChord) window.startBuilderChord();
        });
        fabPlayChordQuick.addEventListener('touchend', () => {
            if (window.stopBuilderChord) window.stopBuilderChord();
        });
        fabPlayChordQuick.addEventListener('touchcancel', () => {
            if (window.stopBuilderChord) window.stopBuilderChord();
        });
    }

    // Quick Add Chord button - click to open add chord menu
    if (fabAddChordQuick) {
        fabAddChordQuick.addEventListener('click', () => {
            const addChordBtn = document.getElementById('action-add-chord');
            if (addChordBtn) addChordBtn.click();
        });
    }

    // Melody quick buttons - Play All, Stop, Suggestions
    const fabPlayAllQuick = document.getElementById('fab-play-all-quick');
    const fabStopQuick = document.getElementById('fab-stop-quick');
    const fabSuggestionsQuick = document.getElementById('fab-suggestions-quick');

    if (fabPlayAllQuick) {
        fabPlayAllQuick.addEventListener('click', () => {
            // Context-aware play button
            const currentTab = document.querySelector('.tab-pane.active')?.id?.replace('tab-', '') || 'melody';

            if (currentTab === 'melody') {
                // Composition Studio: use playAllMelody for seamless chord playback
                if (window.playAllMelody) {
                    window.playAllMelody();
                }
            } else if (currentTab === 'builder' || currentTab === 'trainer') {
                // Chord Lab or Trainer: use handleAutoPlayback
                if (window.handleAutoPlayback) {
                    window.handleAutoPlayback();
                }
            } else {
                // Other tabs: click the play-all button
                const playAllBtn = document.getElementById('action-play-all');
                if (playAllBtn) playAllBtn.click();
            }
        });
    }

    if (fabStopQuick) {
        fabStopQuick.addEventListener('click', () => {
            const stopBtn = document.getElementById('action-stop-btn');
            if (stopBtn) stopBtn.click();
        });
    }

    if (fabSuggestionsQuick) {
        fabSuggestionsQuick.addEventListener('click', () => {
            if (window.showUnifiedRecommendationModal) {
                window.showUnifiedRecommendationModal({ initialTab: 'chord' });
            }
        });
    }

    function handleFabAction(action) {
        switch (action) {
            // Playback actions
            case 'play-all':
                const playBtn = document.getElementById('action-play-btn');
                if (playBtn) playBtn.click();
                break;
            case 'stop':
                const stopBtn = document.getElementById('action-stop-btn');
                if (stopBtn) stopBtn.click();
                break;
            case 'play-measure':
                // Play just the selected/current measure
                if (window.composerIntegration && window.composerIntegration.playCurrentMeasure) {
                    window.composerIntegration.playCurrentMeasure();
                }
                break;

            // Chord Lab (builder) playback actions
            case 'play-current-chord':
                // Directly call playBuilderChordWithDuration instead of clicking hidden dropdown button
                if (window.playBuilderChordWithDuration) {
                    window.playBuilderChordWithDuration();
                }
                break;
            case 'play-builder-progression':
                // Directly call handleAutoPlayback instead of clicking hidden dropdown button
                if (window.handleAutoPlayback) {
                    window.handleAutoPlayback();
                }
                break;

            // Composition Studio (melody) playback actions
            case 'play-all-melody':
                const playAllBtn = document.getElementById('action-play-all');
                if (playAllBtn) playAllBtn.click();
                break;
            case 'play-progression-only':
                const playProgOnlyBtn = document.getElementById('action-play-progression');
                if (playProgOnlyBtn) playProgOnlyBtn.click();
                break;
            case 'play-from-cursor':
                const playFromCursorBtn = document.getElementById('action-play-from-cursor');
                if (playFromCursorBtn) playFromCursorBtn.click();
                break;
            case 'play-measure-melody':
                const playMeasureBtn = document.getElementById('action-play-measure');
                if (playMeasureBtn) playMeasureBtn.click();
                break;

            case 'toggle-metronome':
                const newState = toggleMetronome();
                // Update FAB status display
                const statusEl = document.getElementById('fab-metronome-status');
                if (statusEl) {
                    statusEl.textContent = newState ? 'ON' : 'OFF';
                    statusEl.classList.toggle('text-green-600', newState);
                    statusEl.classList.toggle('text-gray-400', !newState);
                }
                break;

            // Chord Lab (builder) add actions
            case 'add-chord':
                const addChordBtn = document.getElementById('action-add-chord');
                if (addChordBtn) addChordBtn.click();
                break;
            case 'add-go':
                const addGoBtn = document.getElementById('action-add-go');
                if (addGoBtn) addGoBtn.click();
                break;

            // Composition Studio (melody) suggestions actions
            case 'suggest-chords':
                if (window.showUnifiedRecommendationModal) {
                    window.showUnifiedRecommendationModal({ initialTab: 'chord' });
                }
                break;
            case 'suggest-melody':
                if (window.showUnifiedRecommendationModal) {
                    window.showUnifiedRecommendationModal({ initialTab: 'melody' });
                }
                break;
            case 'suggest-section':
                if (window.showUnifiedRecommendationModal) {
                    window.showUnifiedRecommendationModal({ initialTab: 'section' });
                }
                break;
            case 'suggest-harmonize':
                if (window.showUnifiedRecommendationModal) {
                    window.showUnifiedRecommendationModal({ initialTab: 'harmonize' });
                }
                break;
            case 'suggest-texture':
                if (window.showUnifiedRecommendationModal) {
                    window.showUnifiedRecommendationModal({ initialTab: 'polyphony' });
                }
                break;

            // Edit actions
            case 'undo':
                const undoBtn = document.getElementById('action-undo');
                if (undoBtn) undoBtn.click();
                break;
            case 'redo':
                const redoBtn = document.getElementById('action-redo');
                if (redoBtn) redoBtn.click();
                break;
            case 'clear-treble':
                const clearTrebleBtn = document.getElementById('action-clear-treble');
                if (clearTrebleBtn) clearTrebleBtn.click();
                break;
            case 'clear-progression':
                const clearProgBtn = document.getElementById('action-clear-progression');
                if (clearProgBtn) clearProgBtn.click();
                break;

            // File actions
            case 'save':
                const saveBtn = document.getElementById('action-save');
                if (saveBtn) saveBtn.click();
                break;
            case 'load':
                const loadBtn = document.getElementById('action-load');
                if (loadBtn) loadBtn.click();
                break;
            case 'export-midi':
                const midiBtn = document.getElementById('action-export-midi');
                if (midiBtn) midiBtn.click();
                break;
            case 'export-pdf':
                const pdfBtn = document.getElementById('action-export-pdf');
                if (pdfBtn) pdfBtn.click();
                break;
            case 'share-link':
                const shareBtn = document.getElementById('action-copy-link');
                if (shareBtn) shareBtn.click();
                break;
            case 'new-song':
                if (window.showSongBuilderModal) {
                    window.showSongBuilderModal();
                }
                break;
            case 'version-history':
                if (window.showVersionHistory) {
                    window.showVersionHistory();
                }
                break;
            case 'create-checkpoint':
                if (window.createCheckpoint) {
                    window.createCheckpoint();
                }
                break;
            case 'import-midi':
                const importMidiBtn = document.getElementById('action-import-midi');
                if (importMidiBtn) importMidiBtn.click();
                break;
            case 'export-audio':
                const exportAudioBtn = document.getElementById('action-export-audio');
                if (exportAudioBtn) exportAudioBtn.click();
                break;

            // Help actions
            case 'start-here':
                window.location.href = 'start-here.html';
                break;
            case 'keyboard-shortcuts':
                if (window.showNotationShortcuts) {
                    window.showNotationShortcuts();
                }
                break;

            default:
                console.warn('Unknown FAB action:', action);
        }
    }
}

/**
 * Initialize FAB Settings Panel controls
 * Syncs with the main settings controls in the action bar
 */
function initFabSettingsPanel() {
    // BPM Slider (FAB is the single source of truth for BPM)
    const fabBpmSlider = document.getElementById('fab-bpm-slider');
    const fabBpmValue = document.getElementById('fab-bpm-value');

    if (fabBpmSlider && fabBpmValue) {
        // Initialize from interactiveMelody.tempo or default
        const interactiveMelody = window.getInteractiveMelody?.() || {};
        const initialTempo = interactiveMelody.tempo || window.g_Tempo || 120;
        fabBpmSlider.value = initialTempo;
        fabBpmValue.textContent = initialTempo;

        fabBpmSlider.addEventListener('input', (e) => {
            const bpm = parseInt(e.target.value);
            fabBpmValue.textContent = bpm;
            // Apply BPM change globally
            window.g_Tempo = bpm;
            if (window.setPlaybackBPM) window.setPlaybackBPM(bpm);
            // Update interactiveMelody.tempo for Play All
            if (window.setMelodyTempo) window.setMelodyTempo(bpm);
            // Update compositionState settings
            const compositionState = window.getCompositionState?.();
            if (compositionState?.setSettings) {
                const currentSettings = compositionState.getSettings?.() || {};
                compositionState.setSettings({ ...currentSettings, tempo: bpm });
            }
            // Dispatch event for guided mode tutorials
            dispatchBuilderEvent('bpmChanged', { bpm });
        });
    }

    // Arpeggio Speed
    const fabArpSlower = document.getElementById('fab-arp-slower');
    const fabArpFaster = document.getElementById('fab-arp-faster');
    const fabArpSpeed = document.getElementById('fab-arp-speed');
    const actionArpSpeed = document.getElementById('action-arp-speed');

    const arpSpeeds = ['Slow', 'Medium', 'Fast'];
    let currentArpIndex = 1; // Default to Medium

    // Sync initial value
    if (actionArpSpeed && fabArpSpeed) {
        fabArpSpeed.textContent = actionArpSpeed.textContent;
        currentArpIndex = arpSpeeds.indexOf(actionArpSpeed.textContent);
        if (currentArpIndex === -1) currentArpIndex = 1;
    }

    // Reference to isHandlingAction flag from outer scope
    const getIsHandlingAction = () => window._fabIsHandlingAction;
    const setIsHandlingAction = (val) => { window._fabIsHandlingAction = val; };

    if (fabArpSlower) {
        fabArpSlower.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsHandlingAction(true);
            if (currentArpIndex > 0) {
                currentArpIndex--;
                const speed = arpSpeeds[currentArpIndex];
                if (fabArpSpeed) fabArpSpeed.textContent = speed;
                if (actionArpSpeed) actionArpSpeed.textContent = speed;
                // Call arpeggio speed function directly (works without action bar)
                if (window.changeArpeggioSpeed) {
                    window.changeArpeggioSpeed('slower');
                }
            }
            setTimeout(() => setIsHandlingAction(false), 100);
        });
    }

    if (fabArpFaster) {
        fabArpFaster.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsHandlingAction(true);
            if (currentArpIndex < arpSpeeds.length - 1) {
                currentArpIndex++;
                const speed = arpSpeeds[currentArpIndex];
                if (fabArpSpeed) fabArpSpeed.textContent = speed;
                if (actionArpSpeed) actionArpSpeed.textContent = speed;
                // Call arpeggio speed function directly (works without action bar)
                if (window.changeArpeggioSpeed) {
                    window.changeArpeggioSpeed('faster');
                }
            }
            setTimeout(() => setIsHandlingAction(false), 100);
        });
    }

    // RH Octave controls (Chord Lab only)
    const fabRhOctaveDown = document.getElementById('fab-rh-octave-down');
    const fabRhOctaveUp = document.getElementById('fab-rh-octave-up');
    const fabRhOctave = document.getElementById('fab-rh-octave');
    const builderOctaveDisplay = document.getElementById('builder-octave-display');

    // Sync initial value from builder display
    if (fabRhOctave && builderOctaveDisplay) {
        // Extract just the number from "Oct: 0" format
        const match = builderOctaveDisplay.textContent.match(/-?\d+/);
        if (match) {
            fabRhOctave.textContent = match[0];
        }
    }

    if (fabRhOctaveDown) {
        fabRhOctaveDown.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsHandlingAction(true);
            if (window.changeBuilderOctave) {
                window.changeBuilderOctave(-1);
                // Stop the chord after a brief preview (500ms)
                setTimeout(() => {
                    if (window.stopBuilderChord) window.stopBuilderChord();
                }, 500);
                // Sync display
                setTimeout(() => {
                    if (fabRhOctave && builderOctaveDisplay) {
                        const match = builderOctaveDisplay.textContent.match(/-?\d+/);
                        if (match) fabRhOctave.textContent = match[0];
                    }
                }, 50);
            }
            setTimeout(() => setIsHandlingAction(false), 100);
        });
    }

    if (fabRhOctaveUp) {
        fabRhOctaveUp.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            setIsHandlingAction(true);
            if (window.changeBuilderOctave) {
                window.changeBuilderOctave(1);
                // Stop the chord after a brief preview (500ms)
                setTimeout(() => {
                    if (window.stopBuilderChord) window.stopBuilderChord();
                }, 500);
                // Sync display
                setTimeout(() => {
                    if (fabRhOctave && builderOctaveDisplay) {
                        const match = builderOctaveDisplay.textContent.match(/-?\d+/);
                        if (match) fabRhOctave.textContent = match[0];
                    }
                }, 50);
            }
            setTimeout(() => setIsHandlingAction(false), 100);
        });
    }

    // Loop Toggle
    const fabLoopToggle = document.getElementById('fab-loop-toggle');
    const actionLoopToggle = document.getElementById('action-loop-toggle');

    if (fabLoopToggle) {
        // Sync initial value
        if (actionLoopToggle) {
            fabLoopToggle.checked = actionLoopToggle.checked;
        }

        fabLoopToggle.addEventListener('change', (e) => {
            e.stopPropagation();
            const isLooping = e.target.checked;
            if (actionLoopToggle) actionLoopToggle.checked = isLooping;
            if (window.setLoopPlayback) window.setLoopPlayback(isLooping);
        });
    }

    // Highlight Notes Toggle
    const fabHighlightToggle = document.getElementById('fab-highlight-toggle');
    const actionHighlightToggle = document.getElementById('action-highlight-toggle');

    if (fabHighlightToggle) {
        // Sync initial value
        if (actionHighlightToggle) {
            fabHighlightToggle.checked = actionHighlightToggle.checked;
        }

        fabHighlightToggle.addEventListener('change', (e) => {
            e.stopPropagation();
            const highlight = e.target.checked;
            if (actionHighlightToggle) actionHighlightToggle.checked = highlight;
            if (window.setHighlightNotes) window.setHighlightNotes(highlight);
        });
    }
}

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

// ============================================================================
// Landing Page Functions
// ============================================================================

/**
 * Enter the main app from the landing page
 */
function enterApp() {
    const landingPage = document.getElementById('landing-page');
    const mainApp = document.getElementById('main-app');

    if (landingPage && mainApp) {
        // Fade out landing page
        landingPage.style.transition = 'opacity 0.3s ease-out';
        landingPage.style.opacity = '0';

        setTimeout(() => {
            landingPage.classList.add('hidden');
            mainApp.classList.remove('hidden');

            // Fade in main app
            mainApp.style.opacity = '0';
            mainApp.style.transition = 'opacity 0.3s ease-in';
            setTimeout(() => {
                mainApp.style.opacity = '1';
            }, 50);
        }, 300);
    }
}

/**
 * Enter the main app and switch to a specific tab
 * @param {string} tabName - The tab to switch to after entering
 */
function enterAppToTab(tabName) {
    const landingPage = document.getElementById('landing-page');
    const mainApp = document.getElementById('main-app');

    if (landingPage && mainApp) {
        // Fade out landing page
        landingPage.style.transition = 'opacity 0.3s ease-out';
        landingPage.style.opacity = '0';

        setTimeout(() => {
            landingPage.classList.add('hidden');
            mainApp.classList.remove('hidden');

            // Fade in main app
            mainApp.style.opacity = '0';
            mainApp.style.transition = 'opacity 0.3s ease-in';
            setTimeout(() => {
                mainApp.style.opacity = '1';
                // Switch to the requested tab after app is visible
                if (window.switchTab) {
                    window.switchTab(tabName);
                }
            }, 50);
        }, 300);
    }
}

/**
 * Show the Start Here modal (placeholder for guided onboarding)
 */
function showStartHereModal() {
    // For now, show a placeholder modal explaining the Start Here feature is coming
    const content = `
        <div class="text-center">
            <div class="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-3">Start Here - Coming Soon!</h3>
            <p class="text-gray-600 mb-4">
                A guided onboarding experience is in development that will help you discover all the features of the Interactive Music Theory Lab.
            </p>
            <p class="text-gray-600 mb-4">
                <strong>In the meantime, here are some quick tips:</strong>
            </p>
            <ul class="text-left text-gray-600 space-y-2 mb-4 max-w-md mx-auto">
                <li class="flex items-start gap-2">
                    <span class="text-indigo-500 font-bold">1.</span>
                    <span><strong>Chord Lab</strong> - Build and explore chords on the interactive keyboard</span>
                </li>
                <li class="flex items-start gap-2">
                    <span class="text-purple-500 font-bold">2.</span>
                    <span><strong>Composition Studio</strong> - Create progressions and generate melodies</span>
                </li>
                <li class="flex items-start gap-2">
                    <span class="text-emerald-500 font-bold">3.</span>
                    <span><strong>Scale Explorer</strong> - Learn scales and modes with fingering guides</span>
                </li>
                <li class="flex items-start gap-2">
                    <span class="text-rose-500 font-bold">4.</span>
                    <span><strong>Theory Academy</strong> - Interactive lessons from basics to advanced</span>
                </li>
            </ul>
            <p class="text-sm text-gray-500">
                Press <kbd class="px-2 py-1 bg-gray-100 rounded text-xs font-mono">?</kbd> anywhere in the app to see keyboard shortcuts!
            </p>
        </div>
    `;

    if (window.showModalHTML) {
        window.showModalHTML(content, true);
    } else if (window.showModal) {
        window.showModal('Start Here feature coming soon! Explore the tabs to discover all features.');
    }
}

/**
 * Start the "Let It Be" interactive site tutorial
 * This tutorial walks users through creating the Beatles chorus progression,
 * teaching Chord Lab, Composition Studio, chord editing, and more.
 */
function startLetItBeTutorial() {
    const landingPage = document.getElementById('landing-page');
    const mainApp = document.getElementById('main-app');

    // If we're on the landing page, enter the app first
    if (landingPage && !landingPage.classList.contains('hidden')) {
        // Fade out landing page
        landingPage.style.transition = 'opacity 0.3s ease-out';
        landingPage.style.opacity = '0';

        setTimeout(() => {
            landingPage.classList.add('hidden');
            mainApp.classList.remove('hidden');

            // Fade in main app
            mainApp.style.opacity = '0';
            mainApp.style.transition = 'opacity 0.3s ease-in';
            setTimeout(() => {
                mainApp.style.opacity = '1';
                // Switch to Chord Lab and start the tutorial
                if (window.switchTab) {
                    window.switchTab('builder');
                }
                // Start the guided tutorial after a brief delay
                setTimeout(() => {
                    launchLetItBeTutorial();
                }, 500);
            }, 50);
        }, 300);
    } else {
        // Already in the app, just start the tutorial
        if (window.switchTab) {
            window.switchTab('builder');
        }
        setTimeout(() => {
            launchLetItBeTutorial();
        }, 300);
    }
}

/**
 * Launch the Let It Be tutorial steps
 * This is called after the app is ready and we're on the Chord Lab tab
 */
function launchLetItBeTutorial() {
    // Check if the guided mode system is available
    if (!window.startGuidedMode) {
        console.warn('[LetItBeTutorial] Guided mode not available yet. Retrying...');
        setTimeout(launchLetItBeTutorial, 500);
        return;
    }

    // Show modal with choice of Verse, Chorus, or Melody tutorial
    showTutorialStartModal(
        // Verse tutorial callback
        () => {
            actuallyLaunchLetItBeVerseTutorial();
        },
        // Chorus tutorial callback
        () => {
            actuallyLaunchLetItBeTutorial();
        },
        // Melody tutorial callback
        () => {
            actuallyLaunchLetItBeMelodyTutorial();
        }
    );
}

/**
 * Show a modal explaining the tutorial options
 */
function showTutorialStartModal(onConfirmVerse, onConfirmChorus, onConfirmMelody) {
    // Remove any existing modal
    const existingModal = document.getElementById('tutorial-start-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'tutorial-start-modal';
    modal.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/50';
    modal.innerHTML = `
        <div class="bg-white rounded-xl shadow-2xl max-w-lg mx-4 p-6">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <span class="text-2xl">🎸</span>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-gray-900">"Let It Be" Interactive Tutorial</h3>
                    <p class="text-sm text-gray-500">Learn to create the iconic Beatles song</p>
                </div>
            </div>
            <div class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p class="text-sm text-amber-800">
                    <strong>Note:</strong> These tutorials will clear any existing chord progression so you can start fresh. Your work will not be saved.
                </p>
            </div>
            <p class="text-gray-600 mb-4">
                Choose which part of "Let It Be" you'd like to learn:
            </p>
            <div class="space-y-3 mb-6">
                <button id="tutorial-start-verse" class="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-all font-medium flex items-center gap-3">
                    <span class="text-2xl">🎹</span>
                    <div class="text-left">
                        <div class="font-bold">Create Chords of Verse (Recommended)</div>
                        <div class="text-sm opacity-90">C-G-Am-F with inversions, grouping, duplication (start here!)</div>
                    </div>
                </button>
                <button id="tutorial-start-chorus" class="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-all font-medium flex items-center gap-3">
                    <span class="text-2xl">🎹</span>
                    <div class="text-left">
                        <div class="font-bold">Create Chords of Chorus</div>
                        <div class="text-sm opacity-90">Am-G-F-C with drag & drop reordering, Quick Add, BPM</div>
                    </div>
                </button>
                <button id="tutorial-start-melody" class="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg hover:from-emerald-600 hover:to-teal-700 transition-all font-medium flex items-center gap-3 opacity-60">
                    <span class="text-2xl">🎵</span>
                    <div class="text-left">
                        <div class="font-bold">Create Melody of Chorus (WIP)</div>
                        <div class="text-sm opacity-90">Learn VexFlow notation, add melody notes (coming soon)</div>
                    </div>
                </button>
            </div>
            <div class="flex justify-end">
                <button id="tutorial-start-cancel" class="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                    Cancel
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('tutorial-start-cancel').addEventListener('click', () => {
        modal.remove();
    });

    document.getElementById('tutorial-start-verse').addEventListener('click', () => {
        modal.remove();
        if (onConfirmVerse) onConfirmVerse();
    });

    document.getElementById('tutorial-start-chorus').addEventListener('click', () => {
        modal.remove();
        if (onConfirmChorus) onConfirmChorus();
    });

    document.getElementById('tutorial-start-melody').addEventListener('click', () => {
        modal.remove();
        if (onConfirmMelody) onConfirmMelody();
    });

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Launch the "Let It Be" Verse Tutorial
 * Linear flow: C-G-Am-F with G in 1st inversion, grouping, duplication
 */
function actuallyLaunchLetItBeVerseTutorial() {
    console.log('[LetItBeVerseTutorial] Starting verse tutorial, clearing progression...');

    // Set flag to suppress Theory Moments during tutorial setup
    window.isTutorialSetupInProgress = true;

    // Clear the progression first
    clearProgression(true);

    // Reset BPM to 120
    const defaultBpm = 120;
    window.g_Tempo = defaultBpm;
    if (window.setPlaybackBPM) window.setPlaybackBPM(defaultBpm);
    if (window.setMelodyTempo) window.setMelodyTempo(defaultBpm);
    const fabBpmSlider = document.getElementById('fab-bpm-slider');
    const fabBpmValue = document.getElementById('fab-bpm-value');
    if (fabBpmSlider) fabBpmSlider.value = defaultBpm;
    if (fabBpmValue) fabBpmValue.textContent = defaultBpm;

    // Disable chord card tooltips during tutorial
    document.body.classList.add('progression-tooltips-disabled');

    // Helper function to expand Composition Studio panels
    function expandCompositionStudioPanels() {
        const chordProgressionPanel = document.getElementById('chord-progression-card-panel');
        const chordProgressionChevron = document.getElementById('chord-progression-card-chevron');
        if (chordProgressionPanel && chordProgressionPanel.classList.contains('hidden')) {
            chordProgressionPanel.classList.remove('hidden');
            if (chordProgressionChevron) chordProgressionChevron.classList.add('rotate-180');
        }
        const setupPanel = document.getElementById('melody-progression-setup-panel');
        const setupChevron = document.getElementById('melody-progression-setup-chevron');
        if (setupPanel && setupPanel.classList.contains('hidden')) {
            setupPanel.classList.remove('hidden');
            if (setupChevron) setupChevron.classList.add('rotate-180');
        }
    }

    const verseTutorialSteps = [
        // ========== INTRODUCTION ==========
        {
            instruction: 'Welcome! We\'re going to create the verse of "Let It Be" by The Beatles.',
            callout: '🎸 The verse uses the classic C-G-Am-F progression. You\'ll learn: Chord Lab, inversions, grouping, and duplication!',
            validation: null,
            successMessage: null
        },
        // ========== GO TO COMPOSITION STUDIO TO SET KEY ==========
        {
            instruction: '🎹 First, let\'s set the key. Click the "Composition Studio" tab.',
            spotlight: '#header-tab-btn-melody',
            targetElement: '#header-tab-btn-melody',
            callout: 'We\'ll set the key to C Major so our chords show Roman numerals correctly.',
            isActionStep: true,
            validation: { type: 'tab_selected', value: 'melody' },
            successMessage: 'Welcome to the Composition Studio!',
            quickAdvance: true
        },
        {
            instruction: 'Click the "Key" button to open the Circle of Fifths.',
            spotlight: '#melody-key-button',
            targetElement: '#melody-key-button',
            callout: '"Let It Be" is in C Major - the most common key for pop songs!',
            isActionStep: true,
            validation: { type: 'circle_of_fifths_opened' },
            successMessage: 'Circle of Fifths opened!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        {
            instruction: 'Click on "C" in the Circle of Fifths to set the key to C Major.',
            spotlight: '#circle-of-fifths-panel',
            targetElement: '#circle-of-fifths-panel',
            spotlightExtraHeight: 50,
            callout: 'C Major has no sharps or flats.',
            isActionStep: true,
            validation: { type: 'progression_key_changed', value: 'C Major' },
            successMessage: 'Key set to C Major!',
            quickAdvance: true
        },
        // ========== NAVIGATE TO CHORD LAB ==========
        {
            instruction: '🎵 Now let\'s go to the Chord Lab to build our chords. Click the "Chord Lab" tab.',
            spotlight: '#header-tab-btn-builder',
            targetElement: '#header-tab-btn-builder',
            callout: 'The Chord Lab is where you create and explore individual chords.',
            isActionStep: true,
            validation: { type: 'tab_selected', value: 'builder' },
            successMessage: 'Welcome to the Chord Lab!',
            quickAdvance: true
        },
        // ========== CHORD 1: C Major ==========
        {
            instruction: 'Let\'s build the first chord. Select "C" as the root note.',
            spotlight: '#builder-note-selector',
            targetElement: '#builder-note-selector',
            callout: 'The verse starts with C Major - the I chord (home base).',
            validation: { type: 'root_selected', value: 'C' },
            successMessage: 'C selected!',
            quickAdvance: true
        },
        {
            instruction: 'Select "Major" as the chord type.',
            spotlight: '#builder-chord-type-selector',
            targetElement: '#builder-chord-type-selector',
            callout: 'C Major gives us that bright, stable foundation.',
            validation: { type: 'type_selected', value: 'Major' },
            successMessage: 'Major selected!',
            quickAdvance: true
        },
        {
            instruction: 'Click the purple "+" button to add C Major to your progression.',
            spotlight: '#fab-add-chord-quick',
            targetElement: '#fab-add-chord-quick',
            callout: 'First chord of the verse!',
            validation: { type: 'chord_added_to_progression', value: 'C Major' },
            successMessage: 'C Major added!'
        },
        // ========== CHORD 2: G Major (1st Inversion) ==========
        {
            instruction: 'Now select "G" as the root for the second chord.',
            spotlight: '#builder-note-selector',
            targetElement: '#builder-note-selector',
            callout: 'G Major (V chord) creates tension that wants to resolve.',
            validation: { type: 'root_selected', value: 'G' },
            successMessage: 'G selected!',
            quickAdvance: true
        },
        {
            instruction: 'Keep "Major" selected (it should already be).',
            spotlight: '#builder-chord-type-selector',
            targetElement: '#builder-chord-type-selector',
            callout: 'G Major is the dominant chord - very powerful!',
            validation: { type: 'type_selected', value: 'Major' },
            successMessage: 'Major selected!',
            quickAdvance: true
        },
        {
            instruction: 'Click the purple "+" button to add G Major.',
            spotlight: '#fab-add-chord-quick',
            targetElement: '#fab-add-chord-quick',
            callout: 'We\'ll change this to 1st inversion in the Composition Studio later.',
            validation: { type: 'chord_added_to_progression', value: 'G Major' },
            successMessage: 'G Major added!'
        },
        // ========== CHORD 3: Am ==========
        {
            instruction: 'Select "A" as the root for the third chord.',
            spotlight: '#builder-note-selector',
            targetElement: '#builder-note-selector',
            callout: 'Am (vi chord) adds that emotional, melancholic touch.',
            validation: { type: 'root_selected', value: 'A' },
            successMessage: 'A selected!',
            quickAdvance: true
        },
        {
            instruction: 'Select "Minor" as the chord type.',
            spotlight: '#builder-chord-type-selector',
            targetElement: '#builder-chord-type-selector',
            callout: 'The minor chord gives the verse its reflective quality.',
            validation: { type: 'type_selected', value: 'Minor' },
            successMessage: 'Minor selected!',
            quickAdvance: true
        },
        {
            instruction: 'Click the purple "+" button to add Am.',
            spotlight: '#fab-add-chord-quick',
            targetElement: '#fab-add-chord-quick',
            callout: 'Third chord done!',
            validation: { type: 'chord_added_to_progression', value: 'A Minor' },
            successMessage: 'Am added!'
        },
        // ========== CHORD 4: F Major ==========
        {
            instruction: 'Select "F" as the root for the fourth and final chord.',
            spotlight: '#builder-note-selector',
            targetElement: '#builder-note-selector',
            callout: 'F Major (IV chord) completes our classic progression.',
            validation: { type: 'root_selected', value: 'F' },
            successMessage: 'F selected!',
            quickAdvance: true
        },
        {
            instruction: 'Select "Major" as the chord type.',
            spotlight: '#builder-chord-type-selector',
            targetElement: '#builder-chord-type-selector',
            callout: 'F Major - the subdominant that leads us back to C.',
            validation: { type: 'type_selected', value: 'Major' },
            successMessage: 'Major selected!',
            quickAdvance: true
        },
        {
            instruction: 'Click the purple "+" button to add F Major.',
            spotlight: '#fab-add-chord-quick',
            targetElement: '#fab-add-chord-quick',
            callout: 'We now have the complete C-G-Am-F progression!',
            validation: { type: 'chord_added_to_progression', value: 'F Major' },
            successMessage: 'F Major added! All four chords complete.'
        },
        // ========== SWITCH TO COMPOSITION STUDIO ==========
        {
            instruction: 'Great! Now click "Composition Studio" to edit our chords.',
            spotlight: '#header-tab-btn-melody',
            targetElement: '#header-tab-btn-melody',
            callout: 'Time to add the inversion and set up our verse!',
            validation: { type: 'tab_selected', value: 'melody' },
            successMessage: 'Welcome to the Composition Studio!',
            quickAdvance: true
        },
        // ========== EDIT G INVERSION ==========
        {
            instruction: '🔧 Let\'s improve voice leading! Click the "⋯" button on the G Major chord card to expand it.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 100,
            callout: 'Paul McCartney plays G in 1st inversion (B in bass) for smoother voice leading.',
            isActionStep: true,
            validation: { type: 'chord_card_expanded' },
            successMessage: 'Card expanded!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        {
            instruction: '🎹 In the yellow "🎹 Inversion" section, click "1" to select 1st inversion.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 200,
            callout: 'This puts B in the bass, keeping the top note (G) constant from the C chord.',
            isActionStep: true,
            validation: { type: 'chord_card_edited', property: 'inversion' },
            successMessage: 'G is now 1st inversion! The bass line is smoother.',
            quickAdvance: true,
            onEnter: () => {
                setTimeout(() => {
                    const invSections = document.querySelectorAll('.chord-card-inversion-section');
                    invSections.forEach(section => {
                        section.classList.add('animate-pulse');
                        section.style.boxShadow = '0 0 10px 3px rgba(234, 179, 8, 0.6)';
                    });
                }, 300);
            },
            onExit: () => {
                const invSections = document.querySelectorAll('.chord-card-inversion-section');
                invSections.forEach(section => {
                    section.classList.remove('animate-pulse');
                    section.style.boxShadow = '';
                });
            }
        },
        // ========== COLLAPSE CHORD CARD ==========
        {
            instruction: 'Click the "×" button to collapse the chord card.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 200,
            callout: 'Collapse the card to continue.',
            isActionStep: true,
            validation: { type: 'all_cards_collapsed' },
            successMessage: 'Card collapsed!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== CHANGE DURATION TO HALF NOTES ==========
        {
            instruction: '🎵 Change all chord durations to "2" (half notes). Find the Duration dropdowns below each card.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 50,
            callout: 'Each chord gets 2 beats. 4 chords × 2 beats = 8 beats (2 measures).',
            isActionStep: true,
            validation: { type: 'all_chords_duration', beats: 2 },
            successMessage: 'All chords set to half notes!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== SELECT ALL CHORDS ==========
        {
            instruction: '📁 Select all 4 chords: Click the first chord, then Shift+click the last chord.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 100,
            callout: 'Multi-select lets you group and manage chords together!',
            isActionStep: true,
            validation: { type: 'all_chords_selected', expectedCount: 4 },
            successMessage: 'All 4 chords selected!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== CLICK +ADD SECTION ==========
        {
            instruction: '➕ Click the "+Add Section" button in the header toolbar.',
            spotlight: 'button[data-tooltip="Add Section"]',
            targetElement: 'button[data-tooltip="Add Section"]',
            spotlightPadding: 10,
            callout: 'This groups your selected chords into a named section.',
            isActionStep: true,
            validation: { type: 'add_section_menu_opened' },
            successMessage: 'Section menu opened!',
            quickAdvance: true,
            onEnter: () => {
                expandCompositionStudioPanels();
                // Highlight the +Add Section button
                setTimeout(() => {
                    const addSectionBtn = document.querySelector('button[data-tooltip="Add Section"]');
                    if (addSectionBtn) {
                        addSectionBtn.classList.add('animate-pulse');
                        addSectionBtn.style.boxShadow = '0 0 15px 5px rgba(255, 255, 255, 0.8)';
                    }
                }, 300);
            },
            onExit: () => {
                const addSectionBtn = document.querySelector('button[data-tooltip="Add Section"]');
                if (addSectionBtn) {
                    addSectionBtn.classList.remove('animate-pulse');
                    addSectionBtn.style.boxShadow = '';
                }
            }
        },
        // ========== CLICK VERSE ==========
        {
            instruction: '🎼 Click "Verse" from the section type menu.',
            // No spotlight - the menu is already visible and we'll highlight it via onEnter
            spotlight: null,
            targetElement: null,
            callout: 'Naming sections helps organize your composition!',
            isActionStep: true,
            validation: { type: 'chords_grouped', groupName: 'verse' },
            successMessage: 'Chords grouped as "Verse"!',
            quickAdvance: true,
            onEnter: () => {
                // Wait for menu to appear and highlight it
                const highlightMenu = () => {
                    const menu = document.querySelector('.section-type-menu');
                    if (menu) {
                        menu.style.boxShadow = '0 0 20px 5px rgba(147, 51, 234, 0.7)';
                        menu.style.border = '2px solid rgba(147, 51, 234, 0.8)';
                        // Find and highlight the Verse button
                        const buttons = menu.querySelectorAll('button');
                        buttons.forEach(btn => {
                            if (btn.textContent.includes('Verse')) {
                                btn.classList.add('animate-pulse');
                                btn.style.backgroundColor = 'rgba(147, 51, 234, 0.3)';
                            }
                        });
                    } else {
                        // Menu not found yet, retry
                        setTimeout(highlightMenu, 50);
                    }
                };
                setTimeout(highlightMenu, 50);
            },
            onExit: () => {
                const menu = document.querySelector('.section-type-menu');
                if (menu) {
                    menu.style.boxShadow = '';
                    menu.style.border = '';
                    const buttons = menu.querySelectorAll('button');
                    buttons.forEach(btn => {
                        btn.classList.remove('animate-pulse');
                        btn.style.backgroundColor = '';
                    });
                }
            }
        },
        // ========== CLICK SECTION MENU (KEBAB) ==========
        {
            instruction: '⋮ Click the three dots menu (⋮) in the upper right corner of the Verse section.',
            spotlight: '.section-menu-btn',
            targetElement: '.section-menu-btn',
            spotlightPadding: 8,
            callout: 'This opens the section options menu.',
            isActionStep: true,
            validation: { type: 'section_menu_opened' },
            successMessage: 'Section menu opened!',
            quickAdvance: true,
            onEnter: () => {
                expandCompositionStudioPanels();
                setTimeout(() => {
                    const menuBtn = document.querySelector('.section-menu-btn');
                    if (menuBtn) {
                        menuBtn.classList.add('animate-pulse');
                        menuBtn.style.boxShadow = '0 0 15px 5px rgba(255, 255, 255, 0.8)';
                    }
                }, 300);
            },
            onExit: () => {
                const menuBtn = document.querySelector('.section-menu-btn');
                if (menuBtn) {
                    menuBtn.classList.remove('animate-pulse');
                    menuBtn.style.boxShadow = '';
                }
            }
        },
        // ========== CLICK DUPLICATE IN MENU ==========
        {
            instruction: '📋 Click "Duplicate" from the menu.',
            spotlight: null,
            targetElement: null,
            callout: 'This will open the duplication options dialog.',
            isActionStep: true,
            validation: { type: 'duplicate_dialog_opened' },
            successMessage: 'Duplicate dialog opened!',
            quickAdvance: true,
            onEnter: () => {
                // Highlight the Duplicate option in the menu
                const highlightDuplicate = () => {
                    const menu = document.querySelector('.section-context-menu');
                    if (menu) {
                        menu.style.boxShadow = '0 0 20px 5px rgba(99, 102, 241, 0.5)';
                        const buttons = menu.querySelectorAll('button');
                        buttons.forEach(btn => {
                            if (btn.textContent.includes('Duplicate')) {
                                btn.classList.add('animate-pulse');
                                btn.style.backgroundColor = 'rgba(99, 102, 241, 0.2)';
                            }
                        });
                    } else {
                        setTimeout(highlightDuplicate, 50);
                    }
                };
                setTimeout(highlightDuplicate, 50);
            },
            onExit: () => {
                const menu = document.querySelector('.section-context-menu');
                if (menu) {
                    menu.style.boxShadow = '';
                    const buttons = menu.querySelectorAll('button');
                    buttons.forEach(btn => {
                        btn.classList.remove('animate-pulse');
                        btn.style.backgroundColor = '';
                    });
                }
            }
        },
        // ========== CLICK DUPLICATE IN DIALOG ==========
        {
            instruction: '📋 "Bass clef / Chords only" is already selected. Click the "Duplicate" button.',
            spotlight: null,
            targetElement: null,
            callout: 'This duplicates the chords with empty treble clef for new melody writing.',
            isActionStep: true,
            validation: { type: 'group_duplicated' },
            successMessage: 'Group duplicated! You now have 8 chords.',
            quickAdvance: true,
            onEnter: () => {
                // Highlight the Duplicate button in the dialog
                const highlightDialog = () => {
                    const dialog = document.querySelector('.duplicate-section-dialog-overlay');
                    if (dialog) {
                        const duplicateBtn = dialog.querySelector('.duplicate-btn');
                        if (duplicateBtn) {
                            duplicateBtn.classList.add('animate-pulse');
                            duplicateBtn.style.boxShadow = '0 0 15px 5px rgba(99, 102, 241, 0.6)';
                        }
                    } else {
                        setTimeout(highlightDialog, 50);
                    }
                };
                setTimeout(highlightDialog, 50);
            },
            onExit: () => {
                const dialog = document.querySelector('.duplicate-section-dialog-overlay');
                if (dialog) {
                    const duplicateBtn = dialog.querySelector('.duplicate-btn');
                    if (duplicateBtn) {
                        duplicateBtn.classList.remove('animate-pulse');
                        duplicateBtn.style.boxShadow = '';
                    }
                }
            }
        },
        // ========== DELETE 7TH CHORD (Am) ==========
        {
            instruction: '🗑️ Delete the 7th chord (Am, 2nd to last) by clicking the × icon on its card.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 150,
            callout: 'We\'ll modify the ending for a proper verse resolution.',
            isActionStep: true,
            validation: { type: 'chord_deleted' },
            successMessage: 'Chord deleted!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== EXPAND LAST CHORD CARD ==========
        {
            instruction: '🎹 Click on the last chord (F) to expand its card.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 150,
            callout: 'We\'ll change F to 2nd inversion (F/C) for a smooth resolution.',
            isActionStep: true,
            validation: { type: 'chord_card_expanded' },
            successMessage: 'Card expanded!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== CHANGE TO F/C (2ND INVERSION) ==========
        {
            instruction: '🎹 In the yellow "🎹 Inversion" section, click "2" to select 2nd inversion (F/C).',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 200,
            callout: 'F/C (2nd inversion) puts C in the bass - perfect for resolving back to C Major!',
            isActionStep: true,
            validation: { type: 'chord_card_edited', property: 'inversion' },
            successMessage: 'F is now 2nd inversion (F/C)!',
            quickAdvance: true,
            onEnter: () => {
                setTimeout(() => {
                    const invSections = document.querySelectorAll('.chord-card-inversion-section');
                    invSections.forEach(section => {
                        section.classList.add('animate-pulse');
                        section.style.boxShadow = '0 0 10px 3px rgba(234, 179, 8, 0.6)';
                    });
                }, 300);
            },
            onExit: () => {
                const invSections = document.querySelectorAll('.chord-card-inversion-section');
                invSections.forEach(section => {
                    section.classList.remove('animate-pulse');
                    section.style.boxShadow = '';
                });
            }
        },
        // ========== COLLAPSE CHORD CARD ==========
        {
            instruction: 'Click the "×" button to collapse the chord card.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 150,
            callout: 'Collapse the card to access the duration dropdown.',
            isActionStep: true,
            validation: { type: 'all_cards_collapsed' },
            successMessage: 'Card collapsed!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== CHANGE DURATION TO WHOLE NOTE ==========
        {
            instruction: '🎵 Change the last chord\'s duration to "4" (whole note) using the Duration dropdown below the card.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 150,
            callout: 'The final F/C gets 4 beats, giving the verse a strong ending.',
            isActionStep: true,
            validation: { type: 'single_chord_duration', beats: 4 },
            successMessage: 'Duration set to whole note!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== FAB: BPM ==========
        {
            instruction: '⚙️ Click the floating action button (purple +) to open settings.',
            spotlight: '#mobile-fab-main',
            targetElement: '#mobile-fab-main',
            callout: 'Let\'s set the tempo for a ballad feel.',
            isActionStep: true,
            validation: { type: 'fab_opened' },
            successMessage: 'FAB opened!',
            quickAdvance: true
        },
        {
            instruction: 'Click the Settings button (gear icon) to see BPM controls.',
            spotlight: '.fab-category[data-category="settings"]',
            targetElement: '.fab-category[data-category="settings"]',
            callout: 'The Settings section contains tempo controls.',
            isActionStep: true,
            validation: { type: 'settings_section_clicked' },
            successMessage: 'Settings expanded!',
            quickAdvance: true
        },
        {
            instruction: 'Set the BPM to around 70 for the classic ballad feel.',
            spotlight: '#fab-bpm-slider',
            targetElement: '#fab-bpm-slider',
            callout: '"Let It Be" is a ballad at ~70 BPM.',
            isActionStep: true,
            validation: { type: 'bpm_changed', minBpm: 65, maxBpm: 75 },
            successMessage: 'Perfect tempo!',
            quickAdvance: true
        },
        {
            instruction: '📱 Close the FAB menu by tapping the purple + button.',
            spotlight: '#mobile-fab-main',
            targetElement: '#mobile-fab-main',
            callout: 'Close the menu to access the Play button.',
            isActionStep: true,
            validation: { type: 'fab_closed' },
            successMessage: 'Great!',
            quickAdvance: true
        },
        // ========== FINAL PLAYBACK ==========
        {
            instruction: '🎵 Click the green "Play" button to hear your verse!',
            spotlight: '#fab-play-all-quick',
            targetElement: '#fab-play-all-quick',
            callout: 'You\'ve built the complete "Let It Be" verse with proper voice leading!',
            isActionStep: true,
            validation: { type: 'progression_played' },
            successMessage: 'Beautiful! The verse sounds great!',
            quickAdvance: true,
            onEnter: () => {
                // Scroll the notation into view so it's visible during playback
                setTimeout(() => {
                    const notationContainer = document.querySelector('.notation-canvas-wrapper') ||
                                              document.getElementById('staff-notation-card-panel') ||
                                              document.getElementById('staff-notation-card');
                    if (notationContainer) {
                        notationContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
        },
        // ========== COMPLETION ==========
        {
            instruction: '🎉 Congratulations! You\'ve completed the "Let It Be" Verse tutorial!',
            callout: '📚 You learned: Adding chords in Chord Lab, Editing inversions for voice leading, Changing durations, Multi-selecting chords, Grouping & duplicating sections, Deleting chords, and Adjusting BPM!',
            validation: null,
            successMessage: null,
            allowFreeExplore: true
        }
    ];

    // Clear setup flag now that guided mode is starting
    window.isTutorialSetupInProgress = false;

    // Start the guided mode
    window.startGuidedMode({
        lessonId: 'let-it-be-verse-tutorial',
        lessonTitle: '"Let It Be" Verse Interactive Tutorial',
        targetTab: 'builder',
        steps: verseTutorialSteps,
        onComplete: (actionHistory) => {
            console.log('[LetItBeVerseTutorial] Tutorial completed!', actionHistory);
            if (window.switchTab) {
                window.switchTab('melody');
            }
            if (window.showModal) {
                window.showModal('🎉 Congratulations! You\'ve completed the "Let It Be" Verse tutorial! You now know how to build, edit, group, and duplicate chord progressions.', true);
            }
        },
        onCancel: () => {
            console.log('[LetItBeVerseTutorial] Tutorial cancelled by user.');
            if (window.switchTab) {
                window.switchTab('melody');
            }
        }
    });
}

/**
 * Actually launch the Chorus tutorial (after confirmation)
 */
function actuallyLaunchLetItBeTutorial() {
    console.log('[LetItBeTutorial] Starting tutorial, clearing progression...');

    // Set flag to suppress Theory Moments during tutorial setup
    window.isTutorialSetupInProgress = true;

    // Clear the progression first (user already confirmed in the modal)
    clearProgression(true); // true = skip confirmation dialog

    // Reset BPM to 120
    const defaultBpm = 120;
    window.g_Tempo = defaultBpm;
    if (window.setPlaybackBPM) window.setPlaybackBPM(defaultBpm);
    if (window.setMelodyTempo) window.setMelodyTempo(defaultBpm);
    const fabBpmSlider = document.getElementById('fab-bpm-slider');
    const fabBpmValue = document.getElementById('fab-bpm-value');
    if (fabBpmSlider) fabBpmSlider.value = defaultBpm;
    if (fabBpmValue) fabBpmValue.textContent = defaultBpm;

    console.log('[LetItBeTutorial] Progression cleared, chords remaining:', window.getProgressionData?.()?.length || 0);

    // Disable chord card tooltips during tutorial for cleaner UI
    document.body.classList.add('progression-tooltips-disabled');

    // Helper function to expand Composition Studio panels for tutorial
    function expandCompositionStudioPanels() {
        // Expand the Chord Progression panel
        const chordProgressionPanel = document.getElementById('chord-progression-card-panel');
        const chordProgressionChevron = document.getElementById('chord-progression-card-chevron');
        if (chordProgressionPanel && chordProgressionPanel.classList.contains('hidden')) {
            chordProgressionPanel.classList.remove('hidden');
            if (chordProgressionChevron) chordProgressionChevron.classList.add('rotate-180');
        }

        // Expand the Progression Setup panel (contains key selector area)
        const setupPanel = document.getElementById('melody-progression-setup-panel');
        const setupChevron = document.getElementById('melody-progression-setup-chevron');
        if (setupPanel && setupPanel.classList.contains('hidden')) {
            setupPanel.classList.remove('hidden');
            if (setupChevron) setupChevron.classList.add('rotate-180');
        }
    }

    // Define the tutorial steps
    // "Let It Be" CHORUS progression: Am - G - F - C
    const letItBeTutorialSteps = [
        // ========== INTRODUCTION ==========
        {
            instruction: 'Welcome to the Interactive Tutorial! We\'re going to create the iconic chorus of "Let It Be" by The Beatles.',
            callout: '🎸 This tutorial will teach you the Chord Lab, Composition Studio, and more. We\'ll intentionally make a few "mistakes" along the way so you can learn how to fix them!',
            validation: null,
            successMessage: null
        },
        // ========== GO TO COMPOSITION STUDIO TO SET KEY ==========
        {
            instruction: '🎹 First, let\'s set the key. Click the "Composition Studio" tab.',
            spotlight: '#header-tab-btn-melody',
            targetElement: '#header-tab-btn-melody',
            callout: 'We\'ll set the key in the Composition Studio so our chords show Roman numerals correctly.',
            isActionStep: true,
            validation: { type: 'tab_selected', value: 'melody' },
            successMessage: 'Welcome to the Composition Studio!',
            quickAdvance: true
        },
        {
            instruction: 'Click the "Key" button (next to "Chord Progression") to open the Circle of Fifths.',
            spotlight: '#melody-key-button',
            targetElement: '#melody-key-button',
            callout: '"Let It Be" is in the key of C Major. Setting the key helps us see Roman numerals (like vi, V, IV, I) for each chord.',
            isActionStep: true,
            validation: { type: 'circle_of_fifths_opened' },
            successMessage: 'Circle of Fifths opened!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        {
            instruction: 'Click on "C" in the Circle of Fifths to set the key to C Major.',
            spotlight: '#circle-of-fifths-panel',
            targetElement: '#circle-of-fifths-panel',
            spotlightExtraHeight: 50,
            callout: 'C Major has no sharps or flats - it\'s the most common key for pop songs!',
            isActionStep: true,
            validation: { type: 'progression_key_changed', value: 'C Major' },
            successMessage: 'Key set to C Major! Now the chords will show their Roman numerals.',
            quickAdvance: true
        },
        // ========== NAVIGATE TO CHORD LAB ==========
        {
            instruction: '🎵 Now let\'s go to the Chord Lab to build our chords. Click the "Chord Lab" tab.',
            spotlight: '#header-tab-btn-builder',
            targetElement: '#header-tab-btn-builder',
            callout: 'The Chord Lab is where you create and explore individual chords before adding them to your progression.',
            isActionStep: true,
            validation: { type: 'tab_selected', value: 'builder' },
            successMessage: 'Welcome to the Chord Lab!',
            quickAdvance: true
        },
        // ========== CHORD LAB: Add Am (first chord of chorus) ==========
        {
            instruction: 'Let\'s start by building our first chord. Select "A" as the root note in the Note Selector grid.',
            spotlight: '#builder-note-selector',
            targetElement: '#builder-note-selector',
            callout: 'The "Let It Be" chorus starts with Am - the vi chord that gives it that emotional feel.',
            validation: { type: 'root_selected', value: 'A' },
            successMessage: 'A selected!',
            quickAdvance: true
        },
        {
            instruction: 'Now select "Minor" as the chord type.',
            spotlight: '#builder-chord-type-selector',
            targetElement: '#builder-chord-type-selector',
            callout: 'Am (A Minor) sets the melancholic, reflective mood of the chorus.',
            validation: { type: 'type_selected', value: 'Minor' },
            successMessage: 'Minor selected!',
            quickAdvance: true
        },
        {
            instruction: 'Click the purple "+" button on the right side of the screen to add Am to your progression.',
            spotlight: '#fab-add-chord-quick',
            targetElement: '#fab-add-chord-quick',
            callout: 'This Am chord starts our "Let It Be" chorus. The Add Chord button is in the floating action menu.',
            validation: { type: 'chord_added_to_progression', value: 'A Minor' },
            successMessage: 'Am added! First chord done.'
            // No quickAdvance - allow time for next step to position correctly
        },
        // ========== CHORD LAB: Add C Major (INTENTIONALLY WRONG - should be G) ==========
        {
            instruction: '⚠️ INTENTIONAL MISTAKE: Let\'s add C next - but wait, the chorus goes Am-G-F-C, so C should be LAST! Select "C" as the root.',
            spotlight: '#builder-note-selector',
            targetElement: '#builder-note-selector',
            callout: 'We\'re adding C in the wrong position on purpose. You\'ll learn to reorder chords in the Composition Studio!',
            validation: { type: 'root_selected', value: 'C' },
            successMessage: 'C selected!',
            quickAdvance: true
        },
        {
            instruction: 'Select "Major" as the chord type.',
            spotlight: '#builder-chord-type-selector',
            targetElement: '#builder-chord-type-selector',
            callout: 'C Major is the I chord - home base. But it belongs at the END of the chorus, not here!',
            validation: { type: 'type_selected', value: 'Major' },
            successMessage: 'Major selected!'
            // No quickAdvance - allow time for UI to adjust before FAB step
        },
        {
            instruction: 'Click the purple "+" button to add C Major to the progression.',
            spotlight: '#fab-add-chord-quick',
            targetElement: '#fab-add-chord-quick',
            callout: 'Remember: C is in the wrong position. We\'ll move it to the end later!',
            validation: { type: 'chord_added_to_progression', value: 'C Major' },
            successMessage: 'C Major added (in wrong position - we\'ll fix this)!'
            // No quickAdvance - allow time for next step to position correctly
        },
        // ========== CHORD LAB: Add G Major ==========
        {
            instruction: 'Now let\'s add the G chord. Select "G" as the root.',
            spotlight: '#builder-note-selector',
            targetElement: '#builder-note-selector',
            callout: 'G is the V chord - the dominant that creates tension before resolving to C.',
            validation: { type: 'root_selected', value: 'G' },
            successMessage: 'G selected!',
            quickAdvance: true
        },
        {
            instruction: 'Select "Major" as the chord type.',
            spotlight: '#builder-chord-type-selector',
            targetElement: '#builder-chord-type-selector',
            callout: 'G Major should be the 2nd chord in the chorus. We\'re also skipping F (another intentional mistake)!',
            validation: { type: 'type_selected', value: 'Major' },
            successMessage: 'Major selected!',
            quickAdvance: true
        },
        {
            instruction: 'Click the purple "+" button to add G Major to the progression.',
            spotlight: '#fab-add-chord-quick',
            targetElement: '#fab-add-chord-quick',
            callout: 'We now have Am - C - G, but we need Am - G - F - C. Time to fix it in the Composition Studio!',
            validation: { type: 'chord_added_to_progression', value: 'G Major' },
            successMessage: 'G Major added! Now let\'s head to the Composition Studio.'
            // No quickAdvance - allow time for next step to position correctly
        },
        // ========== SWITCH TO COMPOSITION STUDIO ==========
        {
            instruction: 'Great! Now click on the "Composition Studio" tab to see our progression and fix those mistakes.',
            spotlight: '#header-tab-btn-melody',
            targetElement: '#header-tab-btn-melody',
            callout: 'The Composition Studio is where you arrange, edit, and perfect your chord progressions.',
            validation: { type: 'tab_selected', value: 'melody' },
            successMessage: 'Welcome to the Composition Studio!',
            quickAdvance: true
        },
        // ========== COMPOSITION STUDIO: Summary + Drag/Drop combined ==========
        {
            instruction: '🔄 Your progression shows Am - C - G, but the chorus is Am - G - F - C. First, drag the C chord card to the END (after G). Click and hold the C card, then drag it past G.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 100,
            callout: 'Click on the C Major card (black rectangle) and drag it to the right of G. The order should become Am - G - C.',
            validation: { type: 'chord_reordered' },
            successMessage: 'C moved to the end! Now it\'s Am - G - C. We just need to add F!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== QUICK ADD: First show the button, then the form ==========
        {
            instruction: '➕ ADD MISSING F: Click the "+ Add Chord" button (next to the "Chord Progression" header) to open the Quick Add form.',
            spotlight: '#melody-quick-add-btn',
            targetElement: '#melody-quick-add-btn',
            callout: 'This button opens a quick way to add chords without going back to Chord Lab.',
            isActionStep: true,
            validation: { type: 'quick_add_form_opened' },
            successMessage: 'Quick Add form opened!',
            // No quickAdvance - allow time to scroll to Quick Add button
            onEnter: () => {
                expandCompositionStudioPanels();
                // Scroll the +Add Chord button into view (above any keyboard)
                setTimeout(() => {
                    const addChordBtn = document.getElementById('melody-quick-add-btn');
                    if (addChordBtn) {
                        addChordBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
        },
        {
            instruction: 'In the Quick Add form, select "F" as the root, leave it as "Major", and click "Add Chord".',
            spotlight: '#quick-add-chord-form-melody',
            targetElement: '#quick-add-chord-form-melody',
            spotlightExtraHeight: 50,
            callout: 'F Major (IV chord) is the missing piece! Leave the inversion as Root Position for now.',
            isActionStep: true,
            validation: { type: 'chord_added_to_progression', value: 'F Major' },
            successMessage: 'F Major added! Now we have Am - G - C - F. One more reorder to go!'
            // No quickAdvance - allow time to scroll to Quick Add form
        },
        // ========== DRAG F before C ==========
        {
            instruction: '🔄 Almost there! The order is Am - G - C - F but we need Am - G - F - C. Drag the C chord card to the END (after F).',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 100,
            callout: 'Drag the C Major card to the right of F. This completes the correct chorus order!',
            validation: { type: 'chord_reordered' },
            successMessage: 'Perfect! The chorus is now Am - G - F - C!',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== CHANGE DURATION TO HALF NOTES ==========
        {
            instruction: '🎵 DURATION: The "Let It Be" chorus uses half notes (2 beats each). Look at the "Duration" row below each chord card and change ALL four chords to duration 2.',
            spotlight: '#melody-progression-visualization',
            targetElement: '#melody-progression-visualization',
            spotlightExtraHeight: 50,
            callout: 'Find the Duration dropdowns showing "4" (whole notes). Change each one to "2" for half notes. The chorus has 4 chords × 2 beats = 8 beats (2 measures).',
            isActionStep: true,
            validation: { type: 'all_chords_duration', beats: 2 },
            successMessage: 'All chords set to half notes! Now the rhythm matches the original song.',
            quickAdvance: true,
            onEnter: expandCompositionStudioPanels
        },
        // ========== FAB: Open and adjust BPM ==========
        {
            instruction: '⚙️ ADJUST TEMPO: Click the floating action button (the purple circle with +) in the bottom right corner to open it.',
            spotlight: '#mobile-fab-main',
            targetElement: '#mobile-fab-main',
            callout: 'The FAB (Floating Action Button) gives you quick access to playback settings, BPM, and more.',
            isActionStep: true,
            validation: { type: 'fab_opened' },
            successMessage: 'FAB opened! Now find the Settings (gear icon).',
            quickAdvance: true
        },
        {
            instruction: 'Click the gray Settings button (gear icon) in the FAB menu to see the BPM controls.',
            spotlight: '.fab-category[data-category="settings"]',
            targetElement: '.fab-category[data-category="settings"]',
            callout: 'The Settings section contains tempo (BPM), arpeggio speed, and other playback options.',
            isActionStep: true,
            validation: { type: 'settings_section_clicked' },
            successMessage: 'Settings expanded! Now adjust the BPM.',
            quickAdvance: true
        },
        {
            instruction: 'Use the BPM slider to set the tempo to around 70 BPM for the classic ballad feel.',
            spotlight: '#fab-bpm-slider',
            targetElement: '#fab-bpm-slider',
            callout: '"Let It Be" is a ballad at ~70 BPM. Set the tempo between 65-75 BPM.',
            isActionStep: true,
            validation: { type: 'bpm_changed', minBpm: 65, maxBpm: 75 },
            successMessage: 'Perfect tempo! The progression is ready to play.',
            quickAdvance: true
        },
        // ========== CLOSE FAB FIRST ==========
        {
            instruction: '📱 Close the FAB menu by tapping the purple + button.',
            spotlight: '#mobile-fab-main',
            targetElement: '#mobile-fab-main',
            callout: 'Close the menu to access the Play button.',
            isActionStep: true,
            validation: { type: 'fab_closed' },
            successMessage: 'Great!',
            quickAdvance: true  // Advance immediately without delay
        },
        // ========== FINAL PLAYBACK ==========
        {
            instruction: '🎵 LISTEN: Click the green "Play" button to hear your complete "Let It Be" progression!',
            spotlight: '#fab-play-all-quick',
            targetElement: '#fab-play-all-quick',
            callout: 'You\'ve built the iconic Am-G-F-C progression. Click Play to hear it!',
            isActionStep: true,
            validation: { type: 'progression_played' },
            successMessage: 'Beautiful! You\'ve created the "Let It Be" chorus progression!',
            quickAdvance: true,
            onEnter: () => {
                // Scroll the notation into view so it's visible during playback
                setTimeout(() => {
                    const notationContainer = document.querySelector('.notation-canvas-wrapper') ||
                                              document.getElementById('staff-notation-card-panel') ||
                                              document.getElementById('staff-notation-card');
                    if (notationContainer) {
                        notationContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
            }
        },
        // ========== COMPLETION ==========
        {
            instruction: '🎉 Congratulations! You\'ve completed the "Let It Be" tutorial!',
            callout: '📚 You learned: Adding chords in Chord Lab, Reordering with drag & drop, Quick Add, Changing chord duration (half notes), Adjusting BPM (~70 for ballads), and Playing your progression!',
            validation: null,
            successMessage: null,
            allowFreeExplore: true
        }
    ];

    // Clear setup flag now that guided mode is starting
    window.isTutorialSetupInProgress = false;

    // Start the guided mode
    window.startGuidedMode({
        lessonId: 'let-it-be-chords-tutorial',
        lessonTitle: '"Let It Be" Chords Interactive Tutorial',
        targetTab: 'builder',
        steps: letItBeTutorialSteps,
        onComplete: (actionHistory) => {
            console.log('[LetItBeTutorial] Tutorial completed!', actionHistory);
            // Stay in Composition Studio
            if (window.switchTab) {
                window.switchTab('melody');
            }
            if (window.showModal) {
                window.showModal('🎉 Congratulations! You\'ve completed the "Let It Be" Chords tutorial. Keep exploring and creating!', true);
            }
        },
        onCancel: () => {
            console.log('[LetItBeTutorial] Tutorial cancelled by user.');
            // Return to Composition Studio on cancel too
            if (window.switchTab) {
                window.switchTab('melody');
            }
        }
    });
}

/**
 * Launch the "Let It Be" Melody Tutorial
 * Sets up the chord progression and starts the melody creation tutorial
 */
function actuallyLaunchLetItBeMelodyTutorial() {
    console.log('[LetItBeMelodyTutorial] Starting melody tutorial, setting up progression...');

    // Set flag to suppress Theory Moments during tutorial setup
    window.isTutorialSetupInProgress = true;

    // Clear the progression first
    clearProgression(true); // true = skip confirmation dialog

    // Disable chord card tooltips during tutorial for cleaner UI
    document.body.classList.add('progression-tooltips-disabled');

    // Switch to Composition Studio tab
    if (window.switchTab) {
        window.switchTab('melody');
    }

    // Helper function to expand necessary panels for the melody tutorial
    function expandMelodyTutorialPanels() {
        // Expand the Staff Notation panel
        const notationPanel = document.getElementById('staff-notation-card-panel');
        const notationChevron = document.getElementById('staff-notation-card-chevron');
        if (notationPanel && notationPanel.classList.contains('hidden')) {
            notationPanel.classList.remove('hidden');
            if (notationChevron) notationChevron.classList.add('rotate-180');
        }

        // Expand the Chord Progression panel
        const chordProgressionPanel = document.getElementById('chord-progression-card-panel');
        const chordProgressionChevron = document.getElementById('chord-progression-card-chevron');
        if (chordProgressionPanel && chordProgressionPanel.classList.contains('hidden')) {
            chordProgressionPanel.classList.remove('hidden');
            if (chordProgressionChevron) chordProgressionChevron.classList.add('rotate-180');
        }
    }

    // Set the key to C Major FIRST - use same method as Circle of Fifths
    setTimeout(() => {
        console.log('[LetItBeMelodyTutorial] Setting key to C Major...');

        // Use setKeyDropdownValue which properly handles the key change (same as Circle of Fifths)
        // This internally calls setCurrentKey and updates all necessary state
        if (window.setKeyDropdownValue) {
            window.setKeyDropdownValue('C', false); // 'C' not 'C Major' - the function handles quality
            console.log('[LetItBeMelodyTutorial] Used setKeyDropdownValue to set key to C Major');
        } else {
            // Fallback: directly update the dropdown and displays
            console.warn('[LetItBeMelodyTutorial] setKeyDropdownValue not available, using fallback');
            const keySelect = document.getElementById('trainer-key-select');
            if (keySelect) {
                keySelect.value = 'C';
                // Trigger change event to update state
                keySelect.dispatchEvent(new Event('change'));
            }
        }

        // Update ALL key displays (same as Circle of Fifths does)
        const keyDisplays = [
            'melody-current-key-display',
            'melody-key-display-text',
            'melody-workbench-key-display'
        ];
        keyDisplays.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = 'C Major';
        });

        console.log('[LetItBeMelodyTutorial] Key set to C Major');

        // Set BPM to 72 (ballad tempo)
        if (window.interactiveMelody) {
            window.interactiveMelody.tempo = 72;
        }
        // Update BPM slider
        const bpmSlider = document.getElementById('fab-bpm-slider');
        const bpmDisplay = document.getElementById('fab-bpm-value');
        if (bpmSlider) bpmSlider.value = 72;
        if (bpmDisplay) bpmDisplay.textContent = '72';

        // Add the chord progression with pickup measure:
        // C (pickup with dotted half rest, melody starts beat 4) - Am - G - F - C
        // Each chord is 2 beats (half note), inversions for smooth voice leading
        const chordsToAdd = [
            { root: 'C', type: 'Major', inversion: 0, beats: 2 },      // Pickup measure (dotted half rest + beat 4 melody)
            { root: 'A', type: 'Minor', inversion: 1, beats: 2 },      // Am 1st inv
            { root: 'G', type: 'Major', inversion: 1, beats: 2 },      // G 1st inv
            { root: 'F', type: 'Major', inversion: 0, beats: 2 },      // F root
            { root: 'C', type: 'Major', inversion: 0, beats: 2 }       // C root (end)
        ];

        chordsToAdd.forEach((chord, index) => {
            setTimeout(() => {
                if (window.addSpecificChordToProgression) {
                    window.addSpecificChordToProgression(chord.type, chord.inversion, false, chord.root);

                    // After adding, update the duration
                    setTimeout(() => {
                        const progressionData = window.getProgressionData?.() || [];
                        if (progressionData.length > index) {
                            if (window.updateChordDuration) {
                                window.updateChordDuration(index, chord.beats);
                            }
                        }
                    }, 50);
                }
            }, index * 100); // Stagger chord additions
        });

        // After all chords are added, set up the pickup measure and start the tutorial
        setTimeout(() => {
            // Expand panels BEFORE adding the rest
            expandMelodyTutorialPanels();

            // Add a dotted half rest to the pickup measure (beats 1-3)
            // This leaves beat 4 free for the user to add the pickup notes
            // First, select measure 0 so subsequent edits go there
            const notationComposer = window.getNotationComposer && window.getNotationComposer();
            if (notationComposer) {
                notationComposer.setSelectedMeasure(0);
            }

            // Add a dotted half rest directly to compositionState
            // This is more reliable than addNoteIntelligently for programmatic setup
            try {
                if (window.getCompositionState) {
                    const compositionState = window.getCompositionState();

                    console.log('[LetItBeMelodyTutorial] Measure count:', compositionState.getMeasureCount());

                    // Ensure measure 0 exists and has the proper structure
                    if (compositionState.getMeasureCount() > 0) {
                        const measure = compositionState.getMeasure(0);
                        console.log('[LetItBeMelodyTutorial] Measure 0:', measure);

                        // Ensure treble clef voice exists
                        if (measure && measure.notation && measure.notation.treble) {
                            // Ensure voice 0 exists
                            if (!measure.notation.treble.voices) {
                                measure.notation.treble.voices = [{ notes: [] }];
                            }
                            if (!measure.notation.treble.voices[0]) {
                                measure.notation.treble.voices[0] = { notes: [] };
                            }

                            // Add the dotted half rest at beat 0
                            const restNote = {
                                type: 'rest',
                                isRest: true,
                                duration: '2n',  // half note base
                                dotted: true,    // makes it 3 beats
                                beat: 0
                            };

                            measure.notation.treble.voices[0].notes.push(restNote);
                            console.log('[LetItBeMelodyTutorial] Added dotted half rest (3 beats) to measure 0 treble clef');
                            console.log('[LetItBeMelodyTutorial] Treble notes now:', measure.notation.treble.voices[0].notes);
                        } else {
                            console.warn('[LetItBeMelodyTutorial] Measure 0 treble notation not found. Measure:', measure);
                        }
                    } else {
                        console.warn('[LetItBeMelodyTutorial] No measures exist yet');
                    }
                } else {
                    console.warn('[LetItBeMelodyTutorial] getCompositionState not available');
                }
            } catch (e) {
                console.warn('[LetItBeMelodyTutorial] Could not add rest:', e);
            }

            // Verify the rest is still in compositionState before refresh
            const csBeforeRefresh = window.getCompositionState && window.getCompositionState();
            if (csBeforeRefresh) {
                const m0 = csBeforeRefresh.getMeasure(0);
                console.log('[LetItBeMelodyTutorial] Before refresh - Measure 0 treble voices:', m0?.notation?.treble?.voices);
            }

            // Refresh notation - call render directly on the notationComposer
            // to ensure our compositionState changes are rendered
            const nc = window.getNotationComposer && window.getNotationComposer();
            if (nc) {
                console.log('[LetItBeMelodyTutorial] Calling syncFromProgression...');
                nc.syncFromProgression();
                console.log('[LetItBeMelodyTutorial] syncFromProgression complete');

                // Check measureManager to see what was loaded
                if (nc.measureManager && nc.measureManager.measures && nc.measureManager.measures[0]) {
                    console.log('[LetItBeMelodyTutorial] MeasureManager measure 0 trebleNotes:', nc.measureManager.measures[0].trebleNotes);
                }
            } else if (window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
            }

            // Start the melody tutorial after setup is complete
            setTimeout(() => {
                launchLetItBeMelodyTutorialSteps();
            }, 300);
        }, chordsToAdd.length * 100 + 800); // Extra delay to ensure measures are fully initialized

    }, 100);
}

/**
 * Launch the actual melody tutorial steps
 */
function launchLetItBeMelodyTutorialSteps() {
    console.log('[LetItBeMelodyTutorial] Starting tutorial steps...');

    // Helper function to expand Staff Notation panel
    function expandStaffNotationPanel() {
        const notationPanel = document.getElementById('staff-notation-card-panel');
        const notationChevron = document.getElementById('staff-notation-card-chevron');
        if (notationPanel && notationPanel.classList.contains('hidden')) {
            notationPanel.classList.remove('hidden');
            if (notationChevron) notationChevron.classList.add('rotate-180');
        }
    }

    // Helper function to scroll the notation toolbar into view
    function scrollToolbarIntoView() {
        const toolbar = document.getElementById('notation-toolbar-container');
        if (toolbar) {
            toolbar.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Helper function to scroll the notation panel into view (below virtual keyboard)
    function scrollNotationIntoView() {
        const notationPanel = document.getElementById('staff-notation-card-panel');
        if (notationPanel) {
            notationPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    // Define the melody tutorial steps
    // "Let It Be" chorus melody: "Let it be, let it be..."
    // This tutorial teaches Note Entry Mode vs Select Mode, durations, ties, and rests
    const letItBeMelodySteps = [
        // ========== PART 1: INTRODUCTION ==========
        {
            instruction: 'Welcome to the "Let It Be" Melody Tutorial! We\'ll learn melody notation by entering the famous chorus melody.\n\n🎯 ASSISTED PLACEMENT MODE: This tutorial focuses on teaching you the notation toolbar. If you click at the wrong pitch, we\'ll automatically place the note in the correct position. Outside of tutorials, notes go exactly where you click!',
            callout: 'The chords are C - G - Am - F. The melody "Let it be, let it be..." starts on beat 4 of the first measure!',
            validation: null,
            successMessage: null
        },
        {
            instruction: 'Look at the Musical Notation card. This is where we\'ll enter the melody in the treble clef (top staff).',
            spotlight: '#staff-notation-card-panel',
            targetElement: '#staff-notation-card-panel',
            spotlightExtraHeight: 100,
            callout: 'The grand staff shows treble (melody) and bass clefs. The chords have already filled in some bass notes!',
            validation: null,
            successMessage: null,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'This is the Notation Toolbar. It has everything you need to enter notes, rests, and more.',
            spotlight: '#notation-toolbar-container',
            targetElement: '#notation-toolbar-container',
            spotlightExtraHeight: 20,
            callout: 'The toolbar has sections for: Input Mode, Duration, Modifiers (rests, dots, ties), and Edit functions.',
            validation: null,
            successMessage: null,
            onEnter: expandStaffNotationPanel
        },
        // ========== PART 2: TWO MODES EXPLAINED ==========
        {
            instruction: 'There are TWO ways to work with notation. Let\'s learn both!',
            callout: '✏ NOTE ENTRY MODE: Click anywhere on the staff to ADD a note at that pitch.\n⎀ SELECT MODE: Click to SELECT existing notes, then edit them.',
            validation: null,
            successMessage: null,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'NOTE ENTRY MODE (✏) is for adding new notes. You click on the staff where you want the note, and it appears!',
            spotlight: '[data-interaction-mode="noteEntry"]',
            targetElement: '[data-interaction-mode="noteEntry"]',
            callout: 'In Note Entry Mode:\n• Click on staff = add note at that pitch\n• The duration button you\'ve selected determines the note length\n• Notes are added in sequence',
            validation: null,
            successMessage: null,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'SELECT MODE (⎀) is for editing. Click to select notes, then transpose, delete, or modify them.',
            spotlight: '[data-interaction-mode="select"]',
            targetElement: '[data-interaction-mode="select"]',
            callout: 'In Select Mode:\n• Click a note = select it\n• Shift+Click = select multiple notes\n• Alt+Click = add a note (without switching modes!)\n• Alt+Click on selected note = add polyphony (stack another note)\n• Esc = unselect note\n• Use toolbar to transpose or delete',
            validation: null,
            successMessage: null,
            onEnter: expandStaffNotationPanel
        },
        // ========== PART 3: ADDING NOTES ==========
        {
            instruction: 'Let\'s start adding the melody! First, click the Note Entry Mode button (✏).',
            spotlight: '[data-interaction-mode="noteEntry"]',
            targetElement: '[data-interaction-mode="noteEntry"]',
            callout: 'This mode lets you click anywhere on the treble staff to add notes.',
            isActionStep: true,
            validation: { type: 'interaction_mode_set', value: 'noteEntry' },
            successMessage: 'Note Entry Mode activated!',
            quickAdvance: true,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'The melody starts with a quick 16th note. Click the 16th note button.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'Duration buttons: Whole, Half, Quarter (♩), Eighth (♪), 16th, 32nd\nKeyboard shortcut: Shift+5 for 16th notes',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th note duration selected!',
            quickAdvance: true,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click in MEASURE 1 (first measure) at the E5 position to add the first note. While moving your mouse, you can hold the Alt key to see where the note will be placed.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'E5 is in the 1st SPACE from the top in the treble clef (just below the top line).\n\n💡 Your mouse pointer\'s horizontal position within a measure doesn\'t matter - notes are added after the last note in that measure!\n\n💡 Hold Alt to see a "ghost note" preview showing exactly where your note will be placed!',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added! The melody has begun!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'The next note is an 8th note. Click the 8th note button (♪).',
            spotlight: '[data-duration="8n"]',
            targetElement: '[data-duration="8n"]',
            callout: 'Keyboard shortcut: Shift+4 for 8th notes',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '8n' },
            successMessage: 'Eighth note duration selected!',
            quickAdvance: true,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click in MEASURE 1 on D5 (the 4th line - 2nd line from the top).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'D5 is on the 4th LINE of the treble staff (2nd line from top).\nClick in MEASURE 1 - your mouse pointer\'s horizontal position within the measure doesn\'t matter. The new note will be added after the last note in the measure.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'D5',
            successMessage: 'D5 added!',
            quickAdvance: true,
            onEnter: expandStaffNotationPanel
        },
        // ========== PART 4: CREATING TIED NOTES ==========
        {
            instruction: 'Now let\'s learn about TIES! A tie connects two notes of the same pitch, making them ring as one.',
            callout: 'The next part has C5 (16th) TIED to C5 (quarter) - they\'ll ring together as one long note.\nTies are used for rhythms that can\'t be written as a single note.',
            validation: null,
            successMessage: null,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'Select 16th note duration for the first C5.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'We\'ll add a short C5 first, then tie it to a longer C5.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th note selected!',
            quickAdvance: true,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click in MEASURE 1 on C5 (3rd space from bottom / 2nd space from top) to add the first note of the tie.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'C5 is in the 3rd SPACE of the treble staff (2nd space from top).\nYour mouse pointer\'s horizontal position within the measure doesn\'t matter.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'C5',
            successMessage: 'First C5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Now select quarter note duration (♩) for the second part of the tie.',
            spotlight: '[data-duration="4n"]',
            targetElement: '[data-duration="4n"]',
            callout: 'The tied quarter note will sustain the C5.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '4n' },
            successMessage: 'Quarter note selected!',
            quickAdvance: true,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add another C5 at the same pitch (3rd space). Click anywhere in MEASURE 2.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'This C5 will be tied to the previous one.\nYour mouse pointer\'s horizontal position within the measure doesn\'t matter.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'C5',
            successMessage: 'Second C5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Now switch to SELECT MODE (⎀) so we can select the notes to tie them.',
            spotlight: '[data-interaction-mode="select"]',
            targetElement: '[data-interaction-mode="select"]',
            callout: 'Select Mode lets us click on existing notes to select them.\nRemember: Alt+Click adds notes, Esc unselects.',
            isActionStep: true,
            validation: { type: 'interaction_mode_set', value: 'select' },
            successMessage: 'Select Mode activated!',
            quickAdvance: true,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click on the first C5 (16th note) to select it.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'When selected, the note will be highlighted. You can Shift+Click to select additional notes.',
            isActionStep: true,
            validation: { type: 'notes_selected' },
            successMessage: 'Note selected!',
            quickAdvance: true,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'Hold Shift and click the second C5 (quarter note) to add it to the selection.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Both C5 notes should now be highlighted.',
            isActionStep: true,
            validation: { type: 'multiple_notes_selected' },
            successMessage: 'Both notes selected!',
            quickAdvance: false,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'Click the Tie button (⁀) in the toolbar to connect the two notes!',
            spotlight: '.tie-btn',
            targetElement: '.tie-btn',
            callout: 'The tie creates a curved line connecting the notes.\nKeyboard shortcut: T',
            isActionStep: true,
            validation: { type: 'tie_created' },
            successMessage: 'Tie created! The two C5s now ring as one long note!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Press Esc to unselect the notes before continuing.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Pressing Esc clears your selection. This is important before adding more notes!',
            isActionStep: true,
            validation: { type: 'notes_deselected' },
            successMessage: 'Selection cleared!',
            quickAdvance: false,
            onEnter: expandStaffNotationPanel
        },
        // ========== PART 5: CONTINUING THE MELODY ==========
        {
            instruction: 'Now let\'s continue the melody! Make sure you\'re in Note Entry Mode (✏).',
            spotlight: '[data-interaction-mode="noteEntry"]',
            targetElement: '[data-interaction-mode="noteEntry"]',
            callout: 'We\'ll add: E5-G5-A5, rest, G5-G5-E5-D5-C5, A4-G4, tied E5s, and more!',
            isActionStep: true,
            validation: { type: 'interaction_mode_set', value: 'noteEntry' },
            successMessage: 'Note Entry Mode activated!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Select 16th note duration.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'Keyboard shortcut: Shift+5',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th note selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add E5 (1st space from top) to the second measure.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'E5 is in the 1st space from the top of the treble clef.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select 8th note duration (♪).',
            spotlight: '[data-duration="8n"]',
            targetElement: '[data-duration="8n"]',
            callout: 'Keyboard shortcut: Shift+4',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '8n' },
            successMessage: '8th note selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add G5 (1st ledger line above the staff) to the second measure.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'G5 is on the 1st ledger line ABOVE the treble staff.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'G5',
            successMessage: 'G5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select 16th note duration.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'Back to 16th notes.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th note selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add A5 (1st space above the staff - immediately above the G you just added) to the second measure.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'A5 is in the 1st SPACE above the staff (immediately above the G5 ledger line).',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'A5',
            successMessage: 'A5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Now add a quarter rest. Select quarter note duration.',
            spotlight: '[data-duration="4n"]',
            targetElement: '[data-duration="4n"]',
            callout: 'Quarter duration for the rest.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '4n' },
            successMessage: 'Quarter selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Turn on Rest mode (𝄽).',
            spotlight: '[data-action="rest"]',
            targetElement: '[data-action="rest"]',
            callout: 'Keyboard shortcut: R',
            isActionStep: true,
            validation: { type: 'rest_mode_activated' },
            successMessage: 'Rest mode on!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click to add the quarter rest.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Click anywhere in the current measure.',
            isActionStep: true,
            validation: { type: 'rest_added_to_treble' },
            successMessage: 'Quarter rest added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Turn off Rest mode.',
            spotlight: '[data-action="rest"]',
            targetElement: '[data-action="rest"]',
            callout: 'Back to note entry.',
            isActionStep: true,
            validation: { type: 'rest_mode_deactivated' },
            successMessage: 'Rest mode off!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Select 16th note duration for the next phrase.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'We\'ll add G5-G5-E5-D5.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th note selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add G5 (1st ledger line above).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'First of two G5s.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'G5',
            successMessage: 'G5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add another G5 (same position).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Second G5.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'G5',
            successMessage: 'G5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add E5 (1st space from top).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'E5 is in the 1st space from the top.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add D5 (4th line - 2nd line from top).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'D5 is on the 4th line of the treble clef.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'D5',
            successMessage: 'D5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select quarter note duration (♩).',
            spotlight: '[data-duration="4n"]',
            targetElement: '[data-duration="4n"]',
            callout: 'For the C5 quarter note.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '4n' },
            successMessage: 'Quarter selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add C5 (3rd space - 2nd space from top).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'C5 is in the 3rd space of the treble clef.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'C5',
            successMessage: 'C5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select 16th note duration.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'For A4.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add A4 (2nd space from bottom).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'A4 is in the 2nd space from the BOTTOM.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'A4',
            successMessage: 'A4 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select 8th note duration (♪).',
            spotlight: '[data-duration="8n"]',
            targetElement: '[data-duration="8n"]',
            callout: 'For G4.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '8n' },
            successMessage: '8th selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add G4 (2nd line from bottom).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'G4 is on the 2nd line from the BOTTOM.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'G4',
            successMessage: 'G4 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        // ========== TIED E5s ==========
        {
            instruction: 'Now another tied pair! Select 16th note.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'First E5 will be a 16th note.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add E5 (1st space from top).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'First E5 of the tied pair.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select quarter note duration.',
            spotlight: '[data-duration="4n"]',
            targetElement: '[data-duration="4n"]',
            callout: 'Second E5 will be a quarter.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '4n' },
            successMessage: 'Quarter selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add E5 (same position).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Second E5 of the tied pair.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Switch to Select Mode (⎀) to tie them.',
            spotlight: '[data-interaction-mode="select"]',
            targetElement: '[data-interaction-mode="select"]',
            callout: 'We need to select both notes to tie them.',
            isActionStep: true,
            validation: { type: 'interaction_mode_set', value: 'select' },
            successMessage: 'Select Mode!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click the first E5 (16th) to select it.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Select the shorter E5 first.',
            isActionStep: true,
            validation: { type: 'notes_selected' },
            successMessage: 'Note selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Shift+Click the second E5 (quarter).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Add to selection with Shift+Click.',
            isActionStep: true,
            validation: { type: 'multiple_notes_selected' },
            successMessage: 'Both selected!',
            quickAdvance: false,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'Click the Tie button (⁀).',
            spotlight: '.tie-btn',
            targetElement: '.tie-btn',
            callout: 'Keyboard shortcut: T',
            isActionStep: true,
            validation: { type: 'tie_created' },
            successMessage: 'Tied!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Press Esc to deselect.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Clear selection before continuing.',
            isActionStep: true,
            validation: { type: 'notes_deselected' },
            successMessage: 'Deselected!',
            quickAdvance: false,
            onEnter: expandStaffNotationPanel
        },
        // ========== RESTS ==========
        {
            instruction: 'Add a quarter rest. Switch to Note Entry Mode.',
            spotlight: '[data-interaction-mode="noteEntry"]',
            targetElement: '[data-interaction-mode="noteEntry"]',
            callout: 'Back to Note Entry for the rest.',
            isActionStep: true,
            validation: { type: 'interaction_mode_set', value: 'noteEntry' },
            successMessage: 'Note Entry Mode!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Select quarter duration.',
            spotlight: '[data-duration="4n"]',
            targetElement: '[data-duration="4n"]',
            callout: 'Quarter rest.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '4n' },
            successMessage: 'Quarter selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Turn on Rest mode.',
            spotlight: '[data-action="rest"]',
            targetElement: '[data-action="rest"]',
            callout: 'Keyboard: R',
            isActionStep: true,
            validation: { type: 'rest_mode_activated' },
            successMessage: 'Rest mode on!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click to add the quarter rest.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Add the quarter rest.',
            isActionStep: true,
            validation: { type: 'rest_added_to_treble' },
            successMessage: 'Quarter rest!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Now add a 16th rest. Select 16th duration.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: '16th rest.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click to add the 16th rest.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Add the short rest.',
            isActionStep: true,
            validation: { type: 'rest_added_to_treble' },
            successMessage: '16th rest!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Turn off Rest mode.',
            spotlight: '[data-action="rest"]',
            targetElement: '[data-action="rest"]',
            callout: 'Back to notes.',
            isActionStep: true,
            validation: { type: 'rest_mode_deactivated' },
            successMessage: 'Rest mode off!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        // ========== FINAL PHRASE ==========
        {
            instruction: 'Add three E5 16th notes. Duration should be 16th.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'First E5 of three.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add second E5.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Second E5.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add third E5.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Third E5.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select 8th note duration.',
            spotlight: '[data-duration="8n"]',
            targetElement: '[data-duration="8n"]',
            callout: 'F5 is an 8th note.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '8n' },
            successMessage: '8th selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add F5 (top line of the staff).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'F5 is on the TOP LINE of the treble clef.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'F5',
            successMessage: 'F5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select 16th note duration.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: 'Two more E5s.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add E5.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'E5 (1st space from top).',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add another E5.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Second E5.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Select quarter note duration.',
            spotlight: '[data-duration="4n"]',
            targetElement: '[data-duration="4n"]',
            callout: 'D5 is a quarter note.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '4n' },
            successMessage: 'Quarter selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add D5 (4th line).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'D5 is on the 4th line (2nd line from top).',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'D5',
            successMessage: 'D5 quarter added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add a 16th rest. Select 16th duration.',
            spotlight: '[data-duration="16n"]',
            targetElement: '[data-duration="16n"]',
            callout: '16th rest coming up.',
            isActionStep: true,
            validation: { type: 'duration_selected', value: '16n' },
            successMessage: '16th selected!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Turn on Rest mode.',
            spotlight: '[data-action="rest"]',
            targetElement: '[data-action="rest"]',
            callout: 'For the 16th rest.',
            isActionStep: true,
            validation: { type: 'rest_mode_activated' },
            successMessage: 'Rest mode on!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Click to add the 16th rest.',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Add the rest.',
            isActionStep: true,
            validation: { type: 'rest_added_to_treble' },
            successMessage: '16th rest!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Turn off Rest mode.',
            spotlight: '[data-action="rest"]',
            targetElement: '[data-action="rest"]',
            callout: 'Back to notes for the ending.',
            isActionStep: true,
            validation: { type: 'rest_mode_deactivated' },
            successMessage: 'Rest mode off!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollToolbarIntoView();
            }
        },
        {
            instruction: 'Add E5 (16th note, 1st space from top).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'E5 for the final phrase.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'E5',
            successMessage: 'E5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add D5 (4th line).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'D5.',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'D5',
            successMessage: 'D5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        {
            instruction: 'Add final C5 (3rd space).',
            spotlight: '#notation-pages-container',
            targetElement: '#notation-pages-container',
            callout: 'Last note of the chorus!',
            isActionStep: true,
            validation: { type: 'note_added_to_treble' },
            expectedNote: 'C5',
            successMessage: 'Final C5 added!',
            quickAdvance: false,
            onEnter: () => {
                expandStaffNotationPanel();
                scrollNotationIntoView();
            }
        },
        // ========== SUMMARY ==========
        {
            instruction: '🎉 Congratulations! You\'ve entered the complete "Let It Be" chorus melody!',
            callout: 'You\'ve mastered:\n• Note Entry Mode & Select Mode\n• Duration selection\n• Adding rests\n• Creating ties\n• Staff positions (lines vs spaces)',
            validation: null,
            successMessage: null,
            onEnter: expandStaffNotationPanel
        },
        {
            instruction: 'You\'re ready to create your own melodies!',
            callout: 'KEYBOARD SHORTCUTS:\n• Shift+1-6: Duration (1=whole, 6=32nd)\n• R: Toggle rest mode\n• T: Create tie\n• Delete: Delete selected\n• Ctrl+Z: Undo\n• Alt: Show ghost note preview',
            validation: null,
            successMessage: 'You\'ve mastered melody notation entry!',
            allowFreeExplore: true,
            onEnter: expandStaffNotationPanel
        }
    ];

    // Clear setup flag now that guided mode is starting
    window.isTutorialSetupInProgress = false;

    // Start the guided mode
    window.startGuidedMode({
        lessonId: 'let-it-be-melody-tutorial',
        lessonTitle: '"Let It Be" Melody Interactive Tutorial',
        targetTab: 'melody',
        steps: letItBeMelodySteps,
        onComplete: (actionHistory) => {
            console.log('[LetItBeMelodyTutorial] Tutorial completed!', actionHistory);
            // Stay in Composition Studio
            if (window.switchTab) {
                window.switchTab('melody');
            }
            if (window.showModal) {
                window.showModal('🎉 Congratulations! You\'ve completed the "Let It Be" melody tutorial. Keep creating!', true);
            }
        },
        onCancel: () => {
            console.log('[LetItBeMelodyTutorial] Tutorial cancelled by user.');
            // Stay in Composition Studio
            if (window.switchTab) {
                window.switchTab('melody');
            }
        }
    });
}

// Landing page now always shows on root site visit - no skip behavior

// Expose functions to global scope for HTML event handlers
window.switchTab = switchTab;
window.refreshAllTabs = refreshAllTabs;
window.showModal = showModal;
window.hideModal = hideModal;
window.showModalHTML = showModalHTML;
window.showAboutModal = showAboutModal;
window.hideAboutModal = hideAboutModal;
window.toggleSidebar = toggleSidebar;
window.toggleSettingsGroup = toggleSettingsGroup;
window.toggleHeaderDisplays = toggleHeaderDisplays;
window.showSettingsModal = showSettingsModal;
window.showChordWeightsModal = showChordWeightsModal;
window.showMelodyWeightsModal = showMelodyWeightsModal;
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
window.updateRecommendations = updateUnifiedSuggestions;
window.updateUnifiedSuggestions = updateUnifiedSuggestions;

// Toast notifications
window.toast = toast;
window.showToast = showToast;

// Landing page functions
window.enterApp = enterApp;
window.enterAppToTab = enterAppToTab;
window.showStartHereModal = showStartHereModal;
window.startLetItBeTutorial = startLetItBeTutorial;

// Phase 1.3 & Phase 2: Interactive Learning Tools
window.showChordComparisonModal = showChordComparisonModal;
window.showWhatIfSandbox = showWhatIfSandbox;
window.showChordFunctionLegend = showChordFunctionLegend;
window.hideChordFunctionLegend = hideChordFunctionLegend;
window.toggleChordFunctionLegend = toggleChordFunctionLegend;

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
window.updateBuilderDisplay = updateBuilderDisplay;
window.updateKeySignatureDisplay = updateKeySignatureDisplay;
window.updateButtonSelection = updateButtonSelection;
window.updateChordTypeButtonCaptions = updateChordTypeButtonCaptions;
window.updateIntervalButtonCaptions = updateIntervalButtonCaptions;
window.toggleChordSetupPanel = toggleChordSetupPanel;
window.toggleChordLibraryPanel = toggleChordLibraryPanel;
window.toggleChordLibraryMode = toggleChordLibraryMode;
window.toggleChordIntervalsPanel = toggleChordIntervalsPanel;
window.loadProgression = loadProgression;

// Chord and Interval tooltips toggles
// These use CSS classes to show/hide the custom tooltip elements
window.chordTooltipsEnabled = true;
window.intervalTooltipsEnabled = true;

window.toggleChordTooltips = function(enabled) {
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
};

window.toggleIntervalTooltips = function(enabled) {
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
};

// Progression tooltips toggle (for chord cards in progression)
window.progressionTooltipsEnabled = true;

window.toggleProgressionTooltips = function(enabled) {
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
};

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
// HYBRID MODE: Use new implementations where available, old module for placeholders
window.addToProgressionData = addToProgressionData; // From new module (fixed)
window.renderProgressionControls = renderProgressionControls; // From new module (fixed)
window.renderProgressionDisplay = renderProgressionDisplay; // From new module (fully migrated)
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
window.highlightTrainer = highlightTrainer; // Keyboard highlighting for chord playback

// Debug: Verify function is available
if (typeof window.importChordList !== 'function') {
    console.error('importChordList is not a function!', typeof importChordList, importChordList);
} else {
    console.log('importChordList successfully exposed to window');
}

// Add chord from recommendation (used by Smart Suggestions panel)
window.addChordFromRecommendation = function(root, type, inversion) {
    // Import the necessary functions
    import('./modules/state/builderState.js').then(module => {
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
};

window.collapseAllTrainerSections = function() {
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
};

window.expandAllBuilderSections = function() {
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
};

window.collapseAllBuilderSections = function() {
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
};

window.expandAllMelodySections = function() {
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
};

window.collapseAllMelodySections = function() {
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
window.filterScalesByCategory = filterScalesByCategory;
window.updateScaleInfoPanel = updateScaleInfoPanel;

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

// Metronome functions
window.getMetronomeEnabled = getMetronomeEnabled;
window.setMetronomeEnabled = setMetronomeEnabled;
window.toggleMetronome = toggleMetronome;

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
window.toggleSearchMode = toggleSearchMode;
window.getSearchMode = getSearchMode;
window.generateChordSuggestions = generateChordSuggestions;
window.applySuggestedChord = applySuggestedChord;
window.highlightChordInProgression = highlightChordInProgression;

// Song Analyzer functions (audio chord detection)
window.openAudioAnalyzerModal = openAudioAnalyzerModal;
window.startAudioAnalysis = startAudioAnalysis;
window.importDetectedChords = importDetectedChords;

// Theory Tools functions
window.toggleTheoryPanel = toggleTheoryPanel;
window.toggleTheoryMoments = toggleTheoryMoments;
window.toggleTheoryOverlay = toggleTheoryOverlay;
window.showCompositionInsights = showInsightsDashboard;
window.trackComposition = trackProgression;
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

    // Get chord notes at base octave 3 (no shift needed since base is now 3)
    const key = getCurrentKey();
    const chordData = getInvertedChordNotes(root, type, inversion, key, 0);

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

    // Get chord notes at base octave 3 (no shift needed since base is now 3)
    const key = getCurrentKey();
    const chordData = getInvertedChordNotes(root, type, inversion, key, 0);

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
window.getCurrentTempo = getCurrentTempo; // Single source of truth for BPM

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
window.playProgressionOnly = playProgressionOnly;

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
    // Clear any old landing page skip preference (we now always show landing page)
    localStorage.removeItem('skipLandingPage');

    // Scroll all tab content areas to top on initial page load
    const tabIds = ['tab-builder', 'tab-melody', 'tab-scales', 'tab-learn'];
    tabIds.forEach(tabId => {
        const tabContent = document.getElementById(tabId);
        if (tabContent) {
            tabContent.scrollTop = 0;
        }
    });
    // Also scroll the main window to top
    window.scrollTo(0, 0);

    // Calculate and set keyboard sticky position based on header height
    const header = document.getElementById('main-header');
    if (header) {
        const headerHeight = header.offsetHeight;
        const headerTop = parseInt(getComputedStyle(header).top) || 16; // top-4 = 1rem = 16px
        const keyboardTop = headerHeight + headerTop;
        document.documentElement.style.setProperty('--header-height', `${keyboardTop}px`);
    }

    // Set initial tab data attribute on body
    document.body.setAttribute('data-active-tab', getCurrentTab());

    // Handle tooltips on mobile/touch devices
    // Native title tooltips can interfere with button presses on touch devices
    handleMobileTooltips();

    // Hide Tab hint banner if user previously dismissed it
    const tabHintBanner = document.getElementById('tab-hint-banner');
    if (tabHintBanner && localStorage.getItem('tab-hint-dismissed') === 'true') {
        tabHintBanner.classList.add('hidden');
    }

    // ===========================
    // AUTO-SAVE & VERSION HISTORY INITIALIZATION
    // ===========================
    // Initialize after a short delay to ensure compositionState is ready
    setTimeout(() => {
        const compositionState = getCompositionState();
        if (compositionState) {
            // Initialize auto-save system
            initAutoSave(compositionState);

            // Subscribe to dirty state changes for unsaved indicator
            onDirtyStateChange((isDirty) => {
                const indicator = document.getElementById('unsaved-indicator');
                if (indicator) {
                    indicator.classList.toggle('hidden', !isDirty);
                }
            });

            // Initialize version history
            initVersionHistory(compositionState);

            // Check for crash recovery
            const recovery = checkForRecovery();
            if (recovery.hasRecovery) {
                const shouldRecover = confirm(
                    `Unsaved work detected from ${recovery.metadata.timeSince}.\n\n` +
                    `Title: ${recovery.metadata.title}\n` +
                    `Chords: ${recovery.metadata.chordCount}\n` +
                    `Key: ${recovery.metadata.key}\n\n` +
                    `Would you like to recover this work?`
                );

                if (shouldRecover) {
                    const loaded = loadAutoSave();
                    if (loaded.success) {
                        const trainerState = getTrainerState();
                        applyProjectToState(
                            loaded.project,
                            compositionState,
                            trainerState,
                            {
                                onProgressionLoaded: (progressionData) => {
                                    if (trainerState) {
                                        trainerState.progressionData = [...progressionData];
                                    }
                                    if (typeof window.updateProgressionVisualization === 'function') {
                                        window.updateProgressionVisualization();
                                    }
                                    if (typeof window.renderBuilderProgressionCards === 'function') {
                                        window.renderBuilderProgressionCards();
                                    }
                                },
                                onNotationRefresh: () => {
                                    if (typeof window.refreshNotationFromProgression === 'function') {
                                        window.refreshNotationFromProgression();
                                    }
                                },
                                onMetadataUpdated: (metadata) => {
                                    const tempoDisplay = document.getElementById('tempo-display');
                                    if (tempoDisplay && metadata.tempo) {
                                        tempoDisplay.textContent = metadata.tempo;
                                    }
                                    if (metadata.key && typeof window.updateKeySignatureDisplay === 'function') {
                                        window.updateKeySignatureDisplay(metadata.key);
                                    }
                                }
                            }
                        );
                        showToast('Previous work recovered successfully!', 'success');
                    }
                } else {
                    // User chose not to recover - clear the auto-save
                    clearAutoSave();
                }
            }

            // Update auto-save status indicator
            updateAutoSaveStatusIndicator();

            // Subscribe to auto-save events for status updates
            onAutoSave((event) => {
                updateAutoSaveStatusIndicator();
                if (event.success) {
                    // Also create a version snapshot periodically (every 5 auto-saves)
                    const status = getAutoSaveStatus();
                    if (status.lastSaveTime && Math.random() < 0.2) {
                        createVersion({ trigger: 'auto' });
                    }
                }
            });

            console.log('[Main] Auto-save and version history initialized');
        }
    }, 1000);

    // Check for shared progression link
    const sharedProgression = initExportService();
    if (sharedProgression) {
        console.log('[Main] Loading shared progression:', sharedProgression);
        // Load shared progression after app is ready
        setTimeout(() => {
            // Set the key
            if (sharedProgression.key) {
                const keySelect = document.getElementById('key-select');
                if (keySelect) {
                    keySelect.value = sharedProgression.key;
                    keySelect.dispatchEvent(new Event('change'));
                }
            }
            // Add chords to progression
            // addSpecificChordToProgression(chordType, inversion, playShutterSound, overrideRoot)
            if (sharedProgression.progression && sharedProgression.progression.length > 0) {
                sharedProgression.progression.forEach(chord => {
                    addSpecificChordToProgression(chord.type, chord.inversion || 0, false, chord.root);
                });
            }
            // Clean URL without reloading
            window.history.replaceState({}, '', window.location.pathname);
        }, 500);
    }

    // Wire up sticky action bar buttons
    const actionPlayBtn = document.getElementById('action-play-btn');
    const actionPlayAll = document.getElementById('action-play-all');
    const actionPlayProgression = document.getElementById('action-play-progression');
    const actionPlayFromCursor = document.getElementById('action-play-from-cursor');
    const actionPlayMeasure = document.getElementById('action-play-measure');
    const actionStopBtn = document.getElementById('action-stop-btn');
    const actionTabSuggestions = document.getElementById('action-tab-suggestions');
    const actionSave = document.getElementById('action-save');
    const actionLoad = document.getElementById('action-load');
    const actionImportMidi = document.getElementById('action-import-midi');
    const actionExportMidi = document.getElementById('action-export-midi');
    const actionExportPDF = document.getElementById('action-export-pdf');
    const actionExportAudio = document.getElementById('action-export-audio');
    const actionCopyLink = document.getElementById('action-copy-link');
    const actionSettingsBtn = document.getElementById('action-settings-btn');
    const actionSettingsPopover = document.getElementById('action-settings-popover');
    const actionLoopToggle = document.getElementById('action-loop-toggle');
    const actionHighlightToggle = document.getElementById('action-highlight-toggle');
    const actionHelpBtn = document.getElementById('action-help-btn');
    const actionUndo = document.getElementById('action-undo');
    const actionRedo = document.getElementById('action-redo');
    // Chord Lab specific
    const actionAddChord = document.getElementById('action-add-chord');
    const actionAddGo = document.getElementById('action-add-go');
    const actionArpSlower = document.getElementById('action-arp-slower');
    const actionArpFaster = document.getElementById('action-arp-faster');
    const actionArpSpeed = document.getElementById('action-arp-speed');
    const actionOctaveDown = document.getElementById('action-octave-down');
    const actionOctaveUp = document.getElementById('action-octave-up');
    const actionOctaveDisplay = document.getElementById('action-octave-display');

    // Play button (primary) - context-aware based on current tab
    if (actionPlayBtn) {
        actionPlayBtn.addEventListener('click', (e) => {
            // Don't trigger if clicking on dropdown arrow area (melody tab has dropdown)
            if (e.target.closest('.group > div:not(button)')) return;

            const currentTab = window.currentTab || 'builder';

            if (currentTab === 'melody') {
                // Composition Studio: Play melody + chords
                if (window.playAllMelody) {
                    window.playAllMelody();
                }
            } else if (currentTab === 'trainer') {
                // Progression Workshop: Play chords only (toggle auto-playback)
                if (window.handleAutoPlayback) {
                    window.handleAutoPlayback();
                }
            } else if (currentTab === 'builder') {
                // Chord Lab: Play current chord (primary action)
                if (window.playBuilderChordWithDuration) {
                    window.playBuilderChordWithDuration();
                }
            }
        });
    }

    // Play All dropdown option (melody tab)
    if (actionPlayAll) {
        actionPlayAll.addEventListener('click', () => {
            if (window.playAllMelody) {
                window.playAllMelody();
            }
        });
    }

    // Play Chords Only (progression without melody) - uses gapless approach
    if (actionPlayProgression) {
        actionPlayProgression.addEventListener('click', () => {
            if (window.playProgressionOnly) {
                window.playProgressionOnly();
            }
        });
    }

    // Chord Lab: Play Current Chord dropdown option
    const actionPlayCurrentChord = document.getElementById('action-play-current-chord');
    if (actionPlayCurrentChord) {
        actionPlayCurrentChord.addEventListener('click', () => {
            if (window.playBuilderChordWithDuration) {
                window.playBuilderChordWithDuration();
            }
        });
    }

    // Chord Lab: Play Progression dropdown option
    const actionPlayBuilderProgression = document.getElementById('action-play-builder-progression');
    if (actionPlayBuilderProgression) {
        actionPlayBuilderProgression.addEventListener('click', () => {
            if (window.handleAutoPlayback) {
                window.handleAutoPlayback();
            }
        });
    }

    // Play from Selected/Cursor
    if (actionPlayFromCursor) {
        actionPlayFromCursor.addEventListener('click', () => {
            if (window.playFromSelectedMeasure) {
                window.playFromSelectedMeasure();
            } else if (window.playAllMelody) {
                // Fall back to play all if no selection function
                window.playAllMelody();
            }
        });
    }

    // Play Measure (plays currently selected measure only)
    if (actionPlayMeasure) {
        actionPlayMeasure.addEventListener('click', () => {
            if (window.playSelectedMeasure) {
                window.playSelectedMeasure();
            } else if (window.playMeasure) {
                // Fall back to playing measure 0
                window.playMeasure(0);
            }
        });
    }

    if (actionStopBtn) {
        actionStopBtn.addEventListener('click', () => {
            // Stop all types of playback
            if (window.stopPlayAllMelody) window.stopPlayAllMelody();
            if (window.stopMelody) window.stopMelody();
            if (window.forceStopAllPlayback) window.forceStopAllPlayback(true);
            if (window.stopNotationPlaybackHighlighting) window.stopNotationPlaybackHighlighting();
        });
    }

    if (actionTabSuggestions) {
        actionTabSuggestions.addEventListener('click', () => {
            if (window.showUnifiedRecommendationModal) {
                window.showUnifiedRecommendationModal({});
            }
        });
    }

    // Save button
    if (actionSave) {
        actionSave.addEventListener('click', () => {
            if (window.saveProject) {
                window.saveProject();
            }
        });
    }

    // Load button
    if (actionLoad) {
        actionLoad.addEventListener('click', () => {
            if (window.loadProject) {
                window.loadProject();
            }
        });
    }

    // Import MIDI
    if (actionImportMidi) {
        actionImportMidi.addEventListener('click', () => {
            showMIDIImportDialog();
        });
    }

    // Export MIDI
    if (actionExportMidi) {
        actionExportMidi.addEventListener('click', () => {
            showMIDIExportDialog();
        });
    }

    if (actionCopyLink) {
        actionCopyLink.addEventListener('click', () => {
            copyShareableLink();
        });
    }

    // Export PDF
    if (actionExportPDF) {
        actionExportPDF.addEventListener('click', () => {
            showPDFExportDialog();
        });
    }

    // Export Audio
    if (actionExportAudio) {
        actionExportAudio.addEventListener('click', () => {
            showAudioExportDialog();
        });
    }

    if (actionHelpBtn) {
        actionHelpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('help-dropdown');
            if (dropdown) {
                dropdown.classList.toggle('hidden');
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('help-dropdown');
            const container = document.getElementById('help-menu-container');
            if (dropdown && container && !container.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }

    // Undo button
    if (actionUndo) {
        actionUndo.addEventListener('click', () => {
            if (window.handleUndo) {
                window.handleUndo();
            }
        });
    }

    // Redo button
    if (actionRedo) {
        actionRedo.addEventListener('click', () => {
            if (window.handleRedo) {
                window.handleRedo();
            }
        });
    }

    // Clear Treble Clef button
    const actionClearTreble = document.getElementById('action-clear-treble');
    if (actionClearTreble) {
        actionClearTreble.addEventListener('click', () => {
            if (window.clearAllTrebleNotes) {
                window.clearAllTrebleNotes();
            }
        });
    }

    // Clear Progression button
    const actionClearProgression = document.getElementById('action-clear-progression');
    if (actionClearProgression) {
        actionClearProgression.addEventListener('click', () => {
            if (window.clearProgression) {
                window.clearProgression();
            }
        });
    }

    // Settings popover is now hover-based (no click handler needed)

    // Loop toggle
    if (actionLoopToggle) {
        // Initialize from current state
        actionLoopToggle.checked = window.g_LoopEnabled || false;

        actionLoopToggle.addEventListener('change', (e) => {
            window.g_LoopEnabled = e.target.checked;
            // Sync with existing loop toggle
            const loopToggle = document.getElementById('loop-toggle');
            if (loopToggle) loopToggle.checked = e.target.checked;
        });
    }

    // Highlight toggle
    if (actionHighlightToggle) {
        // Initialize from current state (default on)
        actionHighlightToggle.checked = window.g_HighlightEnabled !== false;

        actionHighlightToggle.addEventListener('change', (e) => {
            window.g_HighlightEnabled = e.target.checked;
            // Sync with existing highlight toggle
            const highlightToggle = document.getElementById('highlight-toggle');
            if (highlightToggle) highlightToggle.checked = e.target.checked;
        });
    }

    // Chord Lab: Add Chord button
    if (actionAddChord) {
        actionAddChord.addEventListener('click', () => {
            if (window.addChordToProgression) {
                window.addChordToProgression(false);
            }
        });
    }

    // Chord Lab: Add & Go button
    if (actionAddGo) {
        actionAddGo.addEventListener('click', () => {
            if (window.addChordToProgression) {
                window.addChordToProgression(true);
            }
        });
    }

    // Chord Lab: Arpeggio Speed controls
    if (actionArpSlower) {
        actionArpSlower.addEventListener('click', () => {
            if (window.changeArpeggioSpeed) {
                window.changeArpeggioSpeed('slower');
                // Sync display
                const floatingDisplay = document.getElementById('arp-speed-display');
                if (floatingDisplay && actionArpSpeed) {
                    actionArpSpeed.textContent = floatingDisplay.textContent;
                }
            }
        });
    }

    if (actionArpFaster) {
        actionArpFaster.addEventListener('click', () => {
            if (window.changeArpeggioSpeed) {
                window.changeArpeggioSpeed('faster');
                // Sync display
                const floatingDisplay = document.getElementById('arp-speed-display');
                if (floatingDisplay && actionArpSpeed) {
                    actionArpSpeed.textContent = floatingDisplay.textContent;
                }
            }
        });
    }

    // Chord Lab: RH Octave controls
    if (actionOctaveDown) {
        actionOctaveDown.addEventListener('click', () => {
            if (window.changeBuilderOctave) {
                window.changeBuilderOctave(-1); // Pass -1, not 'down'
                // Sync display
                const floatingDisplay = document.getElementById('builder-octave-display');
                if (floatingDisplay && actionOctaveDisplay) {
                    actionOctaveDisplay.textContent = floatingDisplay.textContent;
                }
            }
        });
    }

    if (actionOctaveUp) {
        actionOctaveUp.addEventListener('click', () => {
            if (window.changeBuilderOctave) {
                window.changeBuilderOctave(1); // Pass 1, not 'up'
                // Sync display
                const floatingDisplay = document.getElementById('builder-octave-display');
                if (floatingDisplay && actionOctaveDisplay) {
                    actionOctaveDisplay.textContent = floatingDisplay.textContent;
                }
            }
        });
    }

    // Initialize Chord Lab action bar displays from existing controls
    if (actionArpSpeed) {
        const floatingArpDisplay = document.getElementById('arp-speed-display');
        if (floatingArpDisplay) {
            actionArpSpeed.textContent = floatingArpDisplay.textContent;
        }
    }
    if (actionOctaveDisplay) {
        const floatingOctaveDisplay = document.getElementById('builder-octave-display');
        if (floatingOctaveDisplay) {
            actionOctaveDisplay.textContent = floatingOctaveDisplay.textContent;
        }
    }

    // Show action bar only for melody tab (Chord Lab uses FAB instead)
    const actionBar = document.getElementById('action-bar');
    const currentTab = getCurrentTab();
    if (actionBar && currentTab === 'melody') {
        actionBar.classList.remove('hidden');
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

    // Initialize browser history support for tab navigation
    // This allows the back button to return to previous tabs/lessons
    initTabHistory();
    
    // Initialize Chord Lab enharmonic toggle state (if it exists)
    // Chord Lab has its own toggle; Composition Studio auto-determines from key
    const chordLabEnharmonicToggle = document.getElementById('chordlab-enharmonic-toggle');
    if (chordLabEnharmonicToggle) {
        // enharmonic: initial preference is 'sharp', so toggle should be unchecked (false = sharp)
        chordLabEnharmonicToggle.checked = getEnharmonicPreference() === 'flat';
        // Update enharmonic indicators to match initial state
        const sharpIndicator = document.getElementById('chordlab-sharp-indicator');
        const flatIndicator = document.getElementById('chordlab-flat-indicator');
        if (sharpIndicator && flatIndicator) {
            if (getEnharmonicPreference() === 'sharp') {
                sharpIndicator.className = 'text-[9px] font-semibold text-white/90';
                flatIndicator.className = 'text-[9px] font-semibold text-white/60';
            } else {
                sharpIndicator.className = 'text-[9px] font-semibold text-white/60';
                flatIndicator.className = 'text-[9px] font-semibold text-white/90';
            }
        }
    }
    // Initialize toggle states (with null checks for optional toggles)
    const notationToggle = document.getElementById('notation-toggle');
    if (notationToggle) notationToggle.checked = false;
    const romanNumeralToggle = document.getElementById('roman-numeral-toggle');
    if (romanNumeralToggle) romanNumeralToggle.checked = false;
    const keyNamesToggle = document.getElementById('key-names-toggle');
    if (keyNamesToggle) keyNamesToggle.checked = false;
    const classicKeyboardToggle = document.getElementById('classic-keyboard-toggle');
    if (classicKeyboardToggle) classicKeyboardToggle.checked = false;
    const compactControlsToggle = document.getElementById('compact-controls-toggle');
    if (compactControlsToggle) compactControlsToggle.checked = false;
    
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

    // Restore settings group collapsed states from localStorage
    restoreSettingsGroupStates();

    // Restore header displays collapsed state from localStorage
    restoreHeaderDisplaysState();

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

    // Initialize metronome status display from saved preference
    const fabMetronomeStatus = document.getElementById('fab-metronome-status');
    if (fabMetronomeStatus) {
        const metronomeOn = getMetronomeEnabled();
        fabMetronomeStatus.textContent = metronomeOn ? 'ON' : 'OFF';
        fabMetronomeStatus.classList.toggle('text-green-600', metronomeOn);
        fabMetronomeStatus.classList.toggle('text-gray-400', !metronomeOn);
    }

    // Initialize preset system
    initPresetUI();

    // Initialize Circle of Fifths
    initCircleOfFifths();

    // Initialize Guitar Fretboard
    initGuitarFretboard();

    // Initialize Theory Tools
    initTheoryTools();

    // Initialize Teaching Integration (Tier 1)
    initTheoryMoments();
    initTheoryOverlay();
    initCompositionInsights();

    // Initialize Song Analyzer (for audio chord detection)
    initSongAnalyzer();

    // Initialize Unified Smart Suggestions Panel (replaces old recommendations + style/mood)
    setTimeout(() => {
        initUnifiedSuggestionsPanel();
        // Initialize Why This Works panel (educational explanations)
        initWhyThisWorksPanel();
        // Initialize Enhanced Why This Works (Tier 1 - overrides standard panel)
        initWhyThisWorksEnhanced();
        // Phase 1.3: Initialize Chord Function Color Legend
        initChordFunctionLegend();
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
        // REMOVED: Floating suggestions panel
        // initFloatingSuggestionsPanel();
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
                        changeBuilderOctave(currentShift < 0 ? 1 : -1);
                    }
                    // Apply target shift
                    const targetShift = data.builderOctaveShift;
                    for (let i = 0; i < Math.abs(targetShift); i++) {
                        changeBuilderOctave(targetShift > 0 ? 1 : -1);
                    }
                }

                updateBuilderDisplay();
                console.log('Chord preset loaded');
                break;

            case 'progression':
                console.log('Loading progression preset...');
                // Switch to Composition Studio tab first
                switchTab('melody');

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
    // Check which tab we're in - undo/redo works on builder, trainer, and melody tabs
    const currentTab = document.querySelector('[id^="tab-"]:not(.hidden)');
    const tabId = currentTab ? currentTab.id : '';
    const isUndoRedoTab = tabId === 'tab-builder' || tabId === 'tab-trainer' || tabId === 'tab-melody';

    // Only handle undo/redo in tabs that support it
    if (!isUndoRedoTab) return;

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
                    // Update time signature display if exists
                    if (metadata.timeSignature) {
                        // Convert {num, denom} object to "num/denom" string for dropdown
                        const ts = metadata.timeSignature;
                        const tsString = typeof ts === 'string' ? ts : `${ts.num}/${ts.denom}`;

                        // Update notation toolbar time signature select
                        const timeSigSelect = document.querySelector('.time-signature-select');
                        if (timeSigSelect) {
                            timeSigSelect.value = tsString;
                        }

                        // Also update any other time signature displays
                        const timeSigDisplay = document.getElementById('time-signature-display');
                        if (timeSigDisplay) {
                            timeSigDisplay.textContent = tsString;
                        }
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

// ===========================
// AUTO-SAVE & VERSION HISTORY UI
// ===========================

/**
 * Update the auto-save status indicator in the UI
 */
function updateAutoSaveStatusIndicator() {
    const indicator = document.getElementById('auto-save-indicator');
    if (!indicator) return;

    const status = getAutoSaveStatus();

    if (status.enabled) {
        if (status.isDirty) {
            indicator.innerHTML = `
                <span class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                <span class="text-yellow-400 text-xs">Unsaved</span>
            `;
        } else if (status.lastSaveTimeFormatted) {
            indicator.innerHTML = `
                <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                <span class="text-gray-400 text-xs">Saved ${status.lastSaveTimeFormatted}</span>
            `;
        } else {
            indicator.innerHTML = `
                <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                <span class="text-gray-400 text-xs">Auto-save on</span>
            `;
        }
    } else {
        indicator.innerHTML = `
            <span class="w-2 h-2 bg-gray-500 rounded-full"></span>
            <span class="text-gray-500 text-xs">Auto-save off</span>
        `;
    }
}

/**
 * Show the version history panel
 */
window.showVersionHistory = function() {
    showVersionHistoryPanel((project) => {
        // Restore callback - get fresh references inside callback
        const compositionState = getCompositionState();
        const trainerState = getTrainerState();

        if (project) {
            const result = applyProjectToState(
                project,
                compositionState,
                trainerState,
                {
                    onProgressionLoaded: (progressionData) => {
                        if (trainerState) {
                            trainerState.progressionData = [...progressionData];
                        }
                        // Refresh all progression displays
                        if (typeof window.renderProgressionDisplay === 'function') {
                            window.renderProgressionDisplay();
                        }
                        if (typeof window.updateProgressionVisualization === 'function') {
                            window.updateProgressionVisualization();
                        }
                        if (typeof window.renderBuilderProgressionCards === 'function') {
                            window.renderBuilderProgressionCards();
                        }
                    },
                    onNotationRefresh: () => {
                        if (typeof window.refreshNotationFromProgression === 'function') {
                            window.refreshNotationFromProgression();
                        }
                        if (typeof window.renderMelodyNotation === 'function') {
                            window.renderMelodyNotation();
                        }
                    },
                    onMetadataUpdated: (metadata) => {
                        const tempoDisplay = document.getElementById('tempo-display');
                        if (tempoDisplay && metadata.tempo) {
                            tempoDisplay.textContent = metadata.tempo;
                        }
                        if (metadata.key && typeof window.updateKeySignatureDisplay === 'function') {
                            window.updateKeySignatureDisplay(metadata.key);
                        }
                        // Update key select dropdown
                        const keySelect = document.getElementById('key-select');
                        if (keySelect && metadata.key) {
                            keySelect.value = metadata.key;
                        }
                    }
                }
            );

            if (result.success) {
                showToast('Version restored successfully!', 'success');
            } else {
                showToast('Failed to restore version: ' + (result.error || 'Unknown error'), 'error');
            }
        }
    });
};

/**
 * Create a named checkpoint
 */
window.createCheckpoint = function(name) {
    if (!name) {
        name = prompt('Enter a name for this checkpoint:');
    }
    if (name && name.trim()) {
        const result = createCheckpoint(name.trim());
        if (result.success) {
            showToast(`Checkpoint "${name}" created`, 'success');
        } else {
            showToast(result.error || 'Failed to create checkpoint', 'error');
        }
        return result;
    }
    return { success: false, error: 'No name provided' };
};

/**
 * Get auto-save status for external access
 */
window.getAutoSaveStatus = getAutoSaveStatus;

/**
 * Force an immediate auto-save
 */
window.saveAutoSaveNow = saveAutoSaveNow;

// ===========================
// PHASE 2.2: CHORD RECOMMENDATIONS SIDEBAR
// ===========================

// Import recommendation modules
import { getRecommendationService } from './modules/integration/recommendationService.js';
// REMOVED: Recommendations sidebar
// import { getRecommendationsSidebarController } from './modules/ui/recommendationsSidebarController.js';
// import { initStyleMoodDisplay, updateStyleMoodDisplay } from './modules/ui/recommendationsSidebar.js';

// Phase 4.1: Melody suggestion modules REMOVED - use Recommendations Modal instead
// The floating melody suggestion panel has been deprecated in favor of the
// unified Recommendations Modal (UnifiedRecommendationModal.js)

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
// REMOVED: let recommendationsSidebarController = null;
let enhancedMelodyControllerInitialized = false;

/**
 * Initialize the chord recommendations service
 * REMOVED: Sidebar controller - now using Recommendations Modal instead
 */
window.initializeRecommendationsSidebar = function() {
    // Only initialize once
    if (recommendationService) {
        return;
    }

    try {
        // Get singleton instance
        recommendationService = getRecommendationService();

        // Initialize service (sets up event listeners for progression changes)
        recommendationService.initialize();

        // Expose service globally for undo/redo and other integrations
        window.recommendationService = recommendationService;

        // REMOVED: Sidebar controller and style/mood display
        // Use Recommendations Modal (UnifiedRecommendationModal.js) instead
    } catch (error) {
        // Error initializing recommendations service
    }
};

/**
 * Initialize the melody suggestions controller - DEPRECATED
 * The floating melody panel has been replaced by the Recommendations Modal
 * This stub function exists for backwards compatibility
 */
window.initMelodySuggestionController = function(options = {}) {
    // DEPRECATED: Use Recommendations Modal instead
    // Initialize enhanced melody controller if not already done
    if (!enhancedMelodyControllerInitialized) {
        try {
            initEnhancedMelodyController({
                onPhraseSelected: (phrase) => {
                    console.log('Phrase inserted:', phrase.notes.length, 'notes');
                },
                onMotifDetected: (analysis) => {
                    console.log('Motifs detected:', analysis.totalDetected);
                }
            });
            enhancedMelodyControllerInitialized = true;
        } catch (err) {
            console.warn('Enhanced melody controller initialization deferred');
        }
    }
};

// Deprecated melody suggestion functions - stubs for backwards compatibility
window.refreshMelodySuggestions = function() { /* Deprecated - use Recommendations Modal */ };
window.setMelodySuggestionMeasure = function() { /* Deprecated */ };
window.setMelodySuggestionStyle = function() { /* Deprecated */ };
window.setMelodySuggestionOctave = function() { /* Deprecated */ };
window.insertSuggestedNote = function() { /* Deprecated */ };
window.toggleMelodySuggestionsPanel = function() { /* Deprecated */ };

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
 * Refresh melody suggestions - DEPRECATED
 * The floating melody panel has been replaced by the Recommendations Modal
 */
window.refreshMelodySuggestions = function() {
    // Deprecated - use Recommendations Modal for melody suggestions
};

/**
 * Refresh chord recommendations (called after weights are saved)
 */
window.refreshChordRecommendations = function() {
    // REMOVED: Sidebar controller - use recommendation service directly
    if (window.recommendationService && window.recommendationService.refresh) {
        window.recommendationService.refresh();
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
        // Chords mode handled by Recommendations Modal
        return;
    }
});

// Global ? key handler for keyboard shortcuts help
document.addEventListener('keydown', function(e) {
    // Don't trigger in input fields
    const tagName = e.target.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || e.target.isContentEditable) {
        return;
    }

    // ? key (with or without shift) - show keyboard shortcuts
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        if (window.showNotationShortcuts) {
            window.showNotationShortcuts();
        }
    }
});

// Tab keyboard shortcut for Recommendations Modal
document.addEventListener('keydown', function(e) {
    // Helper to check if element is an input
    const isInputElement = (element) => {
        const tagName = element.tagName.toLowerCase();
        return tagName === 'input' ||
               tagName === 'textarea' ||
               tagName === 'select' ||
               element.isContentEditable;
    };

    // Tab key - open/close unified recommendation modal
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (!isInputElement(e.target)) {
            e.preventDefault();
            const existingModal = document.getElementById('unified-recommendation-modal');
            if (existingModal) {
                window.closeUnifiedRecommendationModal && window.closeUnifiedRecommendationModal();
            } else {
                window.showUnifiedRecommendationModal && window.showUnifiedRecommendationModal({});
            }
        }
    }
    // Shift+Tab - open unified recommendation modal (melody tab)
    else if (e.key === 'Tab' && e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (!isInputElement(e.target)) {
            e.preventDefault();
            const existingModal = document.getElementById('unified-recommendation-modal');
            if (existingModal) {
                window.closeUnifiedRecommendationModal && window.closeUnifiedRecommendationModal();
            } else {
                window.showUnifiedRecommendationModal && window.showUnifiedRecommendationModal({ initialTab: 'melody' });
            }
        }
    }
    // Ctrl+Tab - open unified recommendation modal (section tab)
    else if (e.key === 'Tab' && e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        if (!isInputElement(e.target)) {
            e.preventDefault();
            const existingModal = document.getElementById('unified-recommendation-modal');
            if (existingModal) {
                window.closeUnifiedRecommendationModal && window.closeUnifiedRecommendationModal();
            } else {
                window.showUnifiedRecommendationModal && window.showUnifiedRecommendationModal({ initialTab: 'section' });
            }
        }
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
window.setBassOctave = setBassOctave;
window.getBassOctave = getBassOctave;
window.getEffectiveBassOctave = getEffectiveBassOctave;
window.getDefaultOctaveForPattern = getDefaultOctaveForPattern;
window.BASS_PATTERN_OCTAVE_DEFAULTS = BASS_PATTERN_OCTAVE_DEFAULTS;
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

// Store previous values for reverting if user cancels
let _previousBassPattern = 'root-fifth';
let _previousBassOctave = 'auto';

/**
 * Handle bass pattern change with user edit protection
 * @param {string} newPattern - The new pattern value
 * @param {HTMLSelectElement} selectEl - The select element that triggered the change
 */
window.handleBassPatternChange = function(newPattern, selectEl) {
    const settings = getBridgeSettings();
    const autoGenerateEnabled = settings?.autoGenerateBass;

    // Only check for edits if auto-generate is ON (when it could overwrite)
    if (autoGenerateEnabled && hasUserEditedBass()) {
        const confirmed = confirm(
            'You have manually edited bass notes that will be overwritten by this change.\n\n' +
            'Your edits are saved and can be restored by turning off Auto-Generate Bass.\n\n' +
            'Continue with this pattern change?'
        );

        if (!confirmed) {
            // Revert to previous value
            selectEl.value = _previousBassPattern;
            return;
        }
    }

    // Store current value before change
    _previousBassPattern = newPattern;

    // Apply the change
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
 * @param {string} newOctaveValue - The new octave value ('auto', '2', or '3')
 * @param {HTMLSelectElement} selectEl - The select element that triggered the change
 */
window.handleBassOctaveChange = function(newOctaveValue, selectEl) {
    const settings = getBridgeSettings();
    const autoGenerateEnabled = settings?.autoGenerateBass;

    // Only check for edits if auto-generate is ON (when it could overwrite)
    if (autoGenerateEnabled && hasUserEditedBass()) {
        const confirmed = confirm(
            'You have manually edited bass notes that will be overwritten by this change.\n\n' +
            'Your edits are saved and can be restored by turning off Auto-Generate Bass.\n\n' +
            'Continue with this octave change?'
        );

        if (!confirmed) {
            // Revert to previous value
            selectEl.value = _previousBassOctave;
            return;
        }
    }

    // Store current value before change
    _previousBassOctave = newOctaveValue;

    // Apply the change
    let octaveValue = null;
    if (newOctaveValue === '2') {
        octaveValue = 2;
    } else if (newOctaveValue === '3') {
        octaveValue = 3;
    }
    // else remains null for 'auto'

    setBassOctave(octaveValue);

    // Refresh notation to show the updated bass
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
 * Update the bass octave selector UI to reflect the current state
 * Called when pattern changes to show the new default, or to sync UI with settings
 */
window.updateBassOctaveSelector = function() {
    const currentOctave = getBassOctave();
    const selectors = [
        document.getElementById('bass-octave-select'),
        document.getElementById('bass-octave-select-card')
    ];

    selectors.forEach(selector => {
        if (selector) {
            if (currentOctave === null) {
                selector.value = 'auto';
            } else {
                selector.value = String(currentOctave);
            }

            // Update the "Auto" option to show the pattern default
            const patternSelect = selector.id === 'bass-octave-select-card'
                ? document.getElementById('bass-pattern-select-card')
                : document.getElementById('bass-pattern-select');

            if (patternSelect) {
                const pattern = patternSelect.value;
                const defaultOctave = getDefaultOctaveForPattern(pattern);
                const autoOption = selector.querySelector('option[value="auto"]');
                if (autoOption) {
                    // Show the default octave in the Auto option label
                    const octaveLabel = defaultOctave === 2 ? 'Low' : 'Mid';
                    if (selector.id === 'bass-octave-select-card') {
                        autoOption.textContent = `Auto (${defaultOctave})`;
                    } else {
                        autoOption.textContent = `Auto (Pattern Default: Oct ${defaultOctave} - ${octaveLabel})`;
                    }
                }
            }
        }
    });
};

/**
 * Apply bass pattern to ALL chords with confirmation dialog
 */
window.applyBassPatternToAll = function() {
    // Get compositionState
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) {
        if (window.toast) {
            window.toast.error('Composition state not available');
        }
        return;
    }

    const chordCount = compositionState.storedProgressionData?.length || 0;
    if (chordCount === 0) {
        if (window.toast) {
            window.toast.warning('No chords in progression');
        }
        return;
    }

    // Get current bass pattern from selector
    const patternSelect = document.getElementById('bass-pattern-select-card') ||
                         document.getElementById('bass-pattern-select');
    const bassPattern = patternSelect?.value || 'root-fifth';

    // Get octave and inversion settings
    const octaveSelect = document.getElementById('bass-octave-select-card');
    const inversionToggle = document.getElementById('bass-follows-inversion-toggle-card');
    const bassOctave = octaveSelect?.value === 'auto' ? null : parseInt(octaveSelect?.value || '2');
    const bassFollowsInversion = inversionToggle?.checked || false;

    // Confirmation dialog
    const confirmed = confirm(
        `Apply "${bassPattern}" bass pattern to all ${chordCount} chords?\n\n` +
        'This will overwrite any existing bass notes.'
    );

    if (!confirmed) {
        return;
    }

    // Update settings
    compositionState.updateSettings({
        bassPattern: bassPattern,
        bassOctave: bassOctave,
        bassFollowsInversion: bassFollowsInversion
    });

    // Clear any per-chord patterns (reset all to global)
    if (compositionState.storedProgressionData) {
        for (let i = 0; i < compositionState.storedProgressionData.length; i++) {
            compositionState.storedProgressionData[i].bassPattern = null;
        }
    }

    // Get trainer state to also update progressionData
    const trainerState = window.getTrainerState ? window.getTrainerState() : null;
    if (trainerState && trainerState.progressionData) {
        for (let i = 0; i < trainerState.progressionData.length; i++) {
            if (trainerState.progressionData[i]) {
                trainerState.progressionData[i].bassPattern = null;
            }
        }
    }

    // Regenerate all bass using the new pattern
    if (typeof compositionState.regenerateAllAutoBassByBuildingBlock === 'function') {
        compositionState.regenerateAllAutoBassByBuildingBlock();
    }

    // Refresh notation
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }

    // Update chord cards
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    if (window.toast) {
        window.toast.success(`Applied "${bassPattern}" to all ${chordCount} chords`);
    }
};

/**
 * Apply bass pattern to selected chord cards
 */
window.applyBassToSelection = function() {
    // Get selected chord indices from multi-selection
    const selectedIndices = window.getSelectedChordIndicesArray ? window.getSelectedChordIndicesArray() : [];

    if (selectedIndices.length === 0) {
        if (window.toast) {
            window.toast.warning('Please select one or more chord cards first (Ctrl+click or Shift+click)');
        }
        return;
    }

    // Get compositionState
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) {
        if (window.toast) {
            window.toast.error('Composition state not available');
        }
        return;
    }

    // Verify setChordBassPattern method exists
    if (typeof compositionState.setChordBassPattern !== 'function') {
        if (window.toast) {
            window.toast.error('Per-chord bass pattern feature not available');
        }
        return;
    }

    // Get current bass pattern from selector
    const patternSelect = document.getElementById('bass-pattern-select-card') ||
                         document.getElementById('bass-pattern-select');
    const bassPattern = patternSelect?.value || 'root-fifth';

    // Get trainer state to also update progressionData (for chord card visuals)
    const trainerState = window.getTrainerState ? window.getTrainerState() : null;

    // Apply the pattern to each selected chord
    let successCount = 0;
    for (const chordIndex of selectedIndices) {
        if (compositionState.setChordBassPattern(chordIndex, bassPattern)) {
            // Also update trainerState.progressionData for chord card visual indicators
            if (trainerState && trainerState.progressionData && trainerState.progressionData[chordIndex]) {
                trainerState.progressionData[chordIndex].bassPattern = bassPattern;
            }
            successCount++;
        }
    }

    // Refresh notation and update UI
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }

    // Update the custom patterns info display
    if (window.updateCustomBassPatternInfo) {
        window.updateCustomBassPatternInfo();
    }

    // Update chord cards to show visual indicator
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    if (window.toast && successCount > 0) {
        window.toast.success(`Applied "${bassPattern}" to ${successCount} chord${successCount > 1 ? 's' : ''}`);
    }
};

/**
 * Revert selected chords' bass to their chord card voicings
 * Places the chord notes directly in the bass clef
 */
window.revertBassToChordVoicing = function() {
    // Get selected chord indices from multi-selection
    const selectedIndices = window.getSelectedChordIndicesArray ? window.getSelectedChordIndicesArray() : [];

    if (selectedIndices.length === 0) {
        if (window.toast) {
            window.toast.warning('Please select one or more chord cards first');
        }
        return;
    }

    // Get compositionState
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) {
        if (window.toast) {
            window.toast.error('Composition state not available');
        }
        return;
    }

    // Get trainer state for chord data
    const trainerState = window.getTrainerState ? window.getTrainerState() : null;

    // Revert each selected chord to its chord voicing
    let successCount = 0;
    for (const chordIndex of selectedIndices) {
        // Clear per-chord pattern
        if (compositionState.storedProgressionData?.[chordIndex]) {
            compositionState.storedProgressionData[chordIndex].bassPattern = null;
        }
        if (trainerState?.progressionData?.[chordIndex]) {
            trainerState.progressionData[chordIndex].bassPattern = null;
        }

        // Place chord voicing in bass clef
        if (typeof compositionState.placeChordVoicingInBass === 'function') {
            // Get the measure index for this chord
            const segment = compositionState.getChordSegment ? compositionState.getChordSegment(chordIndex) : null;
            if (segment) {
                const beatsPerMeasure = 4; // Default, should come from time signature
                const measureIndex = Math.floor(segment.startBeat / beatsPerMeasure);
                compositionState.placeChordVoicingInBass(measureIndex);
                successCount++;
            }
        }
    }

    // Refresh notation
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }

    // Update chord cards
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    if (window.toast && successCount > 0) {
        window.toast.success(`Reverted ${successCount} chord${successCount > 1 ? 's' : ''} to chord voicing`);
    }
};

/**
 * Revert ALL chords' bass to their chord card voicings
 */
window.revertAllBassToChordVoicing = function() {
    // Get compositionState
    const compositionState = window.getCompositionState ? window.getCompositionState() : null;
    if (!compositionState) {
        if (window.toast) {
            window.toast.error('Composition state not available');
        }
        return;
    }

    const chordCount = compositionState.storedProgressionData?.length || 0;
    if (chordCount === 0) {
        if (window.toast) {
            window.toast.warning('No chords in progression');
        }
        return;
    }

    // Confirmation dialog
    const confirmed = confirm(
        `Revert bass for all ${chordCount} chords to their chord card voicings?\n\n` +
        'This will replace any bass patterns with the chord notes.'
    );

    if (!confirmed) {
        return;
    }

    // Get trainer state for chord data
    const trainerState = window.getTrainerState ? window.getTrainerState() : null;

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

    // Place chord voicing in bass for each measure
    const measureCount = compositionState.getMeasureCount ? compositionState.getMeasureCount() : 0;
    for (let i = 0; i < measureCount; i++) {
        if (typeof compositionState.placeChordVoicingInBass === 'function') {
            compositionState.placeChordVoicingInBass(i);
        }
    }

    // Refresh notation
    if (window.refreshNotationFromProgression) {
        window.refreshNotationFromProgression();
    }

    // Update chord cards
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay();
    }

    if (window.toast) {
        window.toast.success(`Reverted all ${chordCount} chords to chord voicings`);
    }
};

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
};
