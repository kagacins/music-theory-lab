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
    updateScaleSpeedUI,
    filterScalesByCategory,
    updateScaleInfoPanel
} from './modules/features/scaleExplorer.js';
import { initAudio, getPiano, getGuitar, getInstrument, getAudioIsReady, getCameraShutter, forceStopAllPlayback, initAudioContextKeepAlive } from './modules/audio/audioEngine.js';
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

    // Quick Play Chord button (above FAB, visible when FAB collapsed in Chord Lab)
    const fabPlayChordQuick = document.getElementById('fab-play-chord-quick');
    // Quick buttons for Composition Studio (above FAB, visible when FAB collapsed)
    const fabMelodyQuickButtons = document.getElementById('fab-melody-quick-buttons');

    // Toggle main FAB menu (first tier)
    fabMain.addEventListener('click', (e) => {
        e.stopPropagation();
        isOpen = !isOpen;
        fabMenu.classList.toggle('hidden', !isOpen);
        fabMain.querySelector('.fab-icon').style.transform = isOpen ? 'rotate(45deg)' : 'rotate(0deg)';

        // Hide/show quick buttons based on FAB state and current tab
        if (fabPlayChordQuick && window.currentTab === 'builder') {
            fabPlayChordQuick.classList.toggle('hidden', isOpen);
        }
        if (fabMelodyQuickButtons && window.currentTab === 'melody') {
            fabMelodyQuickButtons.classList.toggle('hidden', isOpen);
        }

        // Close any open submenu when closing main menu
        if (!isOpen) {
            closeAllSubmenus();
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
                    // Change icon to plus
                    if (btn) btn.innerHTML = '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>';
                } else {
                    if (label) label.textContent = 'Suggestions';
                    // Change icon to lightning bolt
                    if (btn) btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>';
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
        if (fabPlayChordQuick && window.currentTab === 'builder') {
            fabPlayChordQuick.classList.remove('hidden');
        }
        if (fabMelodyQuickButtons && window.currentTab === 'melody') {
            fabMelodyQuickButtons.classList.remove('hidden');
        }
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

    // Melody quick buttons - Play All, Stop, Suggestions
    const fabPlayAllQuick = document.getElementById('fab-play-all-quick');
    const fabStopQuick = document.getElementById('fab-stop-quick');
    const fabSuggestionsQuick = document.getElementById('fab-suggestions-quick');

    if (fabPlayAllQuick) {
        fabPlayAllQuick.addEventListener('click', () => {
            const playAllBtn = document.getElementById('action-play-all');
            if (playAllBtn) playAllBtn.click();
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
                if (window.openSongwritingWizard) {
                    window.openSongwritingWizard();
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
    // BPM Slider
    const fabBpmSlider = document.getElementById('fab-bpm-slider');
    const fabBpmValue = document.getElementById('fab-bpm-value');
    const actionBpmSlider = document.getElementById('action-bpm-slider');
    const actionBpmValue = document.getElementById('action-bpm-value');

    if (fabBpmSlider && fabBpmValue) {
        // Sync initial value from action bar
        if (actionBpmSlider) {
            fabBpmSlider.value = actionBpmSlider.value;
            fabBpmValue.textContent = actionBpmSlider.value;
        }

        fabBpmSlider.addEventListener('input', (e) => {
            const bpm = e.target.value;
            fabBpmValue.textContent = bpm;
            // Sync to action bar
            if (actionBpmSlider) actionBpmSlider.value = bpm;
            if (actionBpmValue) actionBpmValue.textContent = bpm;
            // Apply BPM change
            if (window.setPlaybackBPM) window.setPlaybackBPM(parseInt(bpm));
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

// Toast notifications
window.toast = toast;
window.showToast = showToast;

// Landing page functions
window.enterApp = enterApp;
window.enterAppToTab = enterAppToTab;
window.showStartHereModal = showStartHereModal;

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
    const actionBpmSlider = document.getElementById('action-bpm-slider');
    const actionBpmValue = document.getElementById('action-bpm-value');
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

    // Play Chords Only (progression without melody)
    if (actionPlayProgression) {
        actionPlayProgression.addEventListener('click', () => {
            if (window.handleAutoPlayback) {
                window.handleAutoPlayback();
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

    // BPM slider
    if (actionBpmSlider && actionBpmValue) {
        // Initialize from current tempo (prefer interactiveMelody.tempo if available)
        const interactiveMelody = window.getInteractiveMelody?.() || {};
        const initialTempo = interactiveMelody.tempo || window.g_Tempo || 120;
        actionBpmSlider.value = initialTempo;
        actionBpmValue.textContent = initialTempo;

        actionBpmSlider.addEventListener('input', (e) => {
            const bpm = parseInt(e.target.value);
            actionBpmValue.textContent = bpm;
            window.g_Tempo = bpm;

            // Update interactiveMelody.tempo for melody playback
            if (window.setMelodyTempo) {
                window.setMelodyTempo(bpm);
            }

            // Update compositionState settings for notation playback
            const compositionState = window.getCompositionState?.();
            if (compositionState?.setSettings) {
                const currentSettings = compositionState.getSettings?.() || {};
                compositionState.setSettings({ ...currentSettings, tempo: bpm });
            }

            // Sync with existing BPM inputs
            const bpmInput = document.getElementById('bpm-input');
            if (bpmInput) bpmInput.value = bpm;
            const melodyBpm = document.getElementById('melody-bpm-value');
            if (melodyBpm) melodyBpm.textContent = bpm;
            const melodyBpmSlider = document.getElementById('melody-bpm');
            if (melodyBpmSlider) melodyBpmSlider.value = bpm;
        });
    }

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

    // Initialize Song Analyzer (for audio chord detection)
    initSongAnalyzer();

    // Initialize Unified Smart Suggestions Panel (replaces old recommendations + style/mood)
    setTimeout(() => {
        initUnifiedSuggestionsPanel();
        // Initialize Why This Works panel (educational explanations)
        initWhyThisWorksPanel();
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
 * Apply bass pattern to selected measure only
 * Allows generating bass for a specific measure without affecting the whole composition
 */
window.applyBassToSelection = function() {
    // Get selected measure index
    const selectedIndex = window.getNotationSelectedMeasure ? window.getNotationSelectedMeasure() : -1;

    if (selectedIndex < 0) {
        if (window.toast) {
            window.toast.warning('Please select a measure first');
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

    // Get the building block for the selected measure
    const blocks = compositionState.getBuildingBlocks();
    if (!blocks || selectedIndex >= blocks.length) {
        if (window.toast) {
            window.toast.error('Invalid measure selection');
        }
        return;
    }

    const block = blocks[selectedIndex];
    if (!block || !block.chord) {
        if (window.toast) {
            window.toast.warning('Selected measure has no chord');
        }
        return;
    }

    // Get current bass settings
    const settings = getBridgeSettings();
    const bassPattern = settings?.bassPattern || 'root-fifth';
    const bassOctave = settings?.bassOctave || null;
    const bassFollowsInversion = settings?.bassFollowsInversion || false;

    // Get time signature
    const timeSig = compositionState.metadata?.timeSignature || { num: 4, denom: 4 };
    const beatsPerMeasure = timeSig.num;

    // Import and call generateBuildingBlockBass
    import('./modules/integration/bassAutoFill.js').then(({ generateBuildingBlockBass }) => {
        // Get previous chord for voice leading
        const previousChord = selectedIndex > 0 ? blocks[selectedIndex - 1]?.chord : null;

        // Generate bass for this measure
        const bassNotes = generateBuildingBlockBass(block.chord, previousChord, beatsPerMeasure, {
            bassPattern,
            bassOctave,
            bassFollowsInversion,
            timeSignature: timeSig
        });

        // Update the building block's bass notes
        if (bassNotes && bassNotes.length > 0) {
            block.bassNotes = bassNotes;

            // Mark as modified and refresh
            compositionState.markModified();

            if (window.refreshNotationFromProgression) {
                window.refreshNotationFromProgression();
            }

            if (window.toast) {
                window.toast.success(`Applied "${bassPattern}" pattern to measure ${selectedIndex + 1}`);
            }
        }
    }).catch(err => {
        console.error('[applyBassToSelection] Error:', err);
        if (window.toast) {
            window.toast.error('Failed to generate bass pattern');
        }
    });
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

    // Update key display in header badge
    if (melodyCurrentKeyDisplay && trainerState.currentKey) {
        melodyCurrentKeyDisplay.textContent = trainerState.currentKey;
    }

    // Update key display in Progression Setup panel
    if (melodyKeyDisplayText && trainerState.currentKey) {
        melodyKeyDisplayText.textContent = trainerState.currentKey;
    }

    // Use the same rendering function as the Progression Builder
    // This ensures both tabs show exactly the same information
    // Pass false for syncBothTabs to avoid infinite recursion when called from tab switch
    if (window.renderProgressionDisplay) {
        window.renderProgressionDisplay('melody-progression-visualization', false);
    }
};
