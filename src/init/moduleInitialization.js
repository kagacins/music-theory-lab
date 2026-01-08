/**
 * moduleInitialization.js
 *
 * Module initialization orchestration.
 * This module handles:
 * - Audio system initialization (MUST be first)
 * - Feature module initialization (Circle of Fifths, Guitar Fretboard, Theory Tools, etc.)
 * - UI component initialization (suggestions panels, sidebars, etc.)
 * - Teaching system initialization (Theory Moments, Overlays, Insights)
 * - Panel state restoration
 * - Event listener setup for composition state changes
 *
 * Extracted from main.js Phase 3.3 refactoring.
 *
 * CRITICAL: initAudio() MUST be called first with await to ensure audio system is ready
 * before other modules that depend on it are initialized.
 */

import {
    initAudio,
    initAudioContextKeepAlive,
    getMetronomeEnabled
} from '../modules/audio/audioEngine.js';

import {
    initPresetUI
} from '../modules/ui/presetUI.js';

import {
    initCircleOfFifths
} from '../modules/features/circleOfFifths.js';

import {
    initGuitarFretboard
} from '../modules/features/guitarFretboard.js';

import {
    initTheoryTools
} from '../modules/features/theoryTools.js';

import {
    initTheoryMoments
} from '../modules/teaching/theoryMoments.js';

import {
    initTheoryOverlay
} from '../modules/teaching/theoryOverlay.js';

import {
    initCompositionInsights
} from '../modules/teaching/compositionInsights.js';

import {
    initSongAnalyzer
} from '../modules/features/songAnalyzer.js';

import {
    initUnifiedSuggestionsPanel
} from '../modules/ui/unifiedSuggestionsPanel.js';

import {
    initWhyThisWorksPanel
} from '../modules/ui/whyThisWorksPanel.js';

import {
    initWhyThisWorksEnhanced
} from '../modules/teaching/whyThisWorksEnhanced.js';

import {
    initChordFunctionLegend
} from '../modules/ui/chordFunctionLegend.js';

import {
    restoreAllPanelStates
} from '../modules/storage/panelState.js';

import {
    initAllSectionDragDrop
} from '../modules/ui/sectionDragDrop.js';

import {
    initAllSectionSidebars
} from '../modules/ui/sectionSidebar.js';

import {
    getCompositionState
} from '../modules/state/compositionState.js';

import {
    getTrainerState
} from '../modules/state/trainerState.js';

import {
    invalidateProgressionDataCache
} from '../modules/state/trainerState.js';

import {
    initAutoSave,
    checkForRecovery,
    loadAutoSave,
    clearAutoSave
} from '../modules/storage/autoSave.js';

import {
    initVersionHistory
} from '../modules/storage/versionHistory.js';

import {
    applyProjectToState
} from '../modules/storage/projectManager.js';

// Learn tab is lazy loaded when user clicks the tab (see tabs.js)

import {
    initExportService
} from '../modules/export/exportService.js';

import {
    initInteractiveMelody
} from '../modules/audio/melodyGenerator.js';

import {
    initEnhancedNotation
} from '../modules/notation/notationInit.js';

import {
    initMelodyComposerBridge
} from '../modules/integration/melodyComposerBridge.js';

import {
    initProgressionNotationSync
} from '../modules/integration/progressionNotationSync.js';

import {
    initMobileFab
} from '../modules/ui/floatingActionButton.js';

import {
    initAuthButton
} from '../modules/community/authButton.js';

import {
    initShareModal
} from '../modules/community/shareModal.js';

import {
    initCommunityBrowser
} from '../modules/community/communityBrowser.js';

// Import mySubmissions module (registers window functions on import)
import '../modules/community/mySubmissions.js';

import {
    initAdminFab
} from '../modules/admin/adminFab.js';

import { toast } from '../modules/ui/toastNotifications.js';


/**
 * Helper function to update the toolbar editing context indicator
 * Uses the toolbar's refreshEditingContext method to gather and display context
 * @param {Object} compositionState - The composition state instance (unused, kept for API compatibility)
 */
function updateToolbarEditingContext(compositionState) {
    const composer = window.getNotationComposer?.();
    if (!composer?.toolbar?.refreshEditingContext) return;
    composer.toolbar.refreshEditingContext();
}

/**
 * Initialize all application modules
 * This function orchestrates the initialization of all feature modules, UI components,
 * and teaching systems in the correct order.
 *
 * @returns {Promise<void>}
 */
export async function initializeModules() {
    const startTime = performance.now();

    // ===========================
    // AUDIO INITIALIZATION (MUST BE FIRST)
    // ===========================
    // Initialize audio - starts loading samples but doesn't block
    // (initAudio is synchronous, sample loading happens in background)
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

    // ===========================
    // FEATURE MODULE INITIALIZATION
    // ===========================

    // Initialize preset system
    initPresetUI();

    // Initialize Circle of Fifths
    initCircleOfFifths();

    // Initialize Guitar Fretboard
    initGuitarFretboard();

    // Initialize Theory Tools
    initTheoryTools();


    // ===========================
    // TEACHING SYSTEM INITIALIZATION (TIER 1)
    // ===========================

    initTheoryMoments();
    initTheoryOverlay();
    initCompositionInsights();


    // ===========================
    // SONG ANALYZER INITIALIZATION
    // ===========================

    // Initialize Song Analyzer (for audio chord detection)
    initSongAnalyzer();

    // ===========================
    // UI COMPONENT INITIALIZATION (DELAYED)
    // ===========================

    // Initialize Unified Smart Suggestions Panel (replaces old recommendations + style/mood)
    // Delayed to ensure DOM is fully ready
    setTimeout(() => {
        initUnifiedSuggestionsPanel();
        // Initialize Why This Works panel (educational explanations)
        initWhyThisWorksPanel();
        // Initialize Enhanced Why This Works (Tier 1 - overrides standard panel)
        initWhyThisWorksEnhanced();
        // Phase 1.3: Initialize Chord Function Color Legend
        initChordFunctionLegend();
    }, 200);

    // ===========================
    // PANEL STATE RESTORATION
    // ===========================

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

    // ===========================
    // SECTION UI INITIALIZATION
    // ===========================

    // Initialize section drag-and-drop (this also restores section ordering)
    initAllSectionDragDrop();

    // Initialize section sidebar system AFTER restoring panel states
    // This ensures the sidebar sees the restored states, not HTML defaults
    setTimeout(() => {
        initAllSectionSidebars();
        // REMOVED: Floating suggestions panel
        // initFloatingSuggestionsPanel();
    }, 200);

    // ===========================
    // COMPOSITION STATE EVENT HANDLERS
    // ===========================

    // Set up cache invalidation for progression data when composition state changes
    // This prevents excessive calls to exportToProgressionData() when tooltips open or cards are clicked
    const compositionState = getCompositionState();
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

        // Sync chord card highlight and toolbar context indicator with active bass block selection
        compositionState.events.on('activeBassBlockChanged', (blockIndex) => {
            if (blockIndex !== null && blockIndex >= 0) {
                window.highlightChordCard?.(blockIndex);
            } else {
                window.unhighlightAllChordCards?.();
            }
            // Update toolbar with full context
            updateToolbarEditingContext(compositionState);
        });

        // Update toolbar when staff selection mode changes
        compositionState.events.on('activeStaffChanged', () => {
            updateToolbarEditingContext(compositionState);
        });

        // Update toolbar when selection changes
        compositionState.events.on('selectionChanged', () => {
            updateToolbarEditingContext(compositionState);
        });
    }

    // ===========================
    // STORAGE SYSTEM INITIALIZATION
    // ===========================

    // Initialize after a short delay to ensure compositionState is fully ready
    setTimeout(() => {
        const compositionState = getCompositionState();
        if (compositionState) {
            // Initialize auto-save system
            initAutoSave(compositionState);

            // Initialize version history
            initVersionHistory(compositionState);

            // Check for crash recovery
            const recovery = checkForRecovery();
            if (recovery.hasRecovery) {
                const shouldRecover = confirm(
                    `Unsaved work detected from ${recovery.metadata.timeSince}.\n\n` +
                    `Title: ${recovery.metadata.title}\n` +
                    `Last saved: ${recovery.metadata.formattedDate}\n\n` +
                    `Would you like to recover this work?`
                );

                if (shouldRecover) {
                    const result = loadAutoSave();
                    if (result.success) {
                        const trainerState = getTrainerState();
                        applyProjectToState(result.project, compositionState, trainerState, {
                            onProgressionLoaded: (progressionData) => {
                                // Refresh progression display after loading
                                if (window.renderProgressionDisplay) {
                                    window.renderProgressionDisplay('melody-progression-visualization', true);
                                }
                            },
                            onNotationRefresh: () => {
                                if (window.refreshNotationFromProgression) {
                                    window.refreshNotationFromProgression();
                                }
                            }
                        });
                        toast.success('Your work has been recovered!');
                    } else {
                        toast.error('Failed to recover work: ' + result.error);
                    }
                    clearAutoSave();
                } else {
                    clearAutoSave();
                }
            }
        }
    }, 500);

    // ===========================
    // ADDITIONAL MODULE INITIALIZATION (DELAYED)
    // ===========================

    // Initialize Export Service (delayed to ensure compositionState is ready)
    setTimeout(() => {
        initExportService();
    }, 100);

    // Initialize Interactive Melody (delayed to ensure DOM is ready)
    setTimeout(() => {
        initInteractiveMelody();
    }, 200);

    // Initialize Enhanced Notation (delayed to ensure VexFlow is ready)
    setTimeout(() => {
        initEnhancedNotation();
    }, 250);

    // Learn Tab is lazy loaded when user clicks the tab (see tabs.js)

    // Initialize Melody Composer Bridge (delayed to ensure compositionState is ready)
    setTimeout(() => {
        initMelodyComposerBridge();
    }, 300);

    // Initialize Progression-Notation Sync (no delay needed, sync system is ready)
    initProgressionNotationSync();

    // Initialize Floating Action Button (FAB) - delayed to ensure DOM is ready
    setTimeout(() => {
        initMobileFab();
    }, 100);

    // ===========================
    // COMMUNITY FEATURES INITIALIZATION
    // ===========================

    // Initialize Auth Button (Sign In / User Avatar in header)
    // Now non-blocking - renders immediately, loads auth state in background
    setTimeout(() => {
        initAuthButton();
        initShareModal();
        initCommunityBrowser();
    }, 50); // Reduced delay since these are now non-blocking

    // ===========================
    // ADMIN FEATURES INITIALIZATION
    // ===========================

    // Initialize Admin FAB (only shows for admin users)
    // Delayed to ensure auth is initialized first
    setTimeout(() => {
        initAdminFab();
    }, 200);
}
