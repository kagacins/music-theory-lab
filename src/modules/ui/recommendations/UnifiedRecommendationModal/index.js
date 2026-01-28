/**
 * UnifiedRecommendationModal - Main Entry Point
 *
 * This is the coordinator file for the UnifiedRecommendationModal system.
 * Uses hybrid delegation pattern during migration - delegates to old module
 * while gradually migrating functions to new modular structure.
 *
 * Batch Status:
 * - ✅ Batch 1: MusicUtils.js (44 functions), AudioPlayback.js (11 functions), ModalState.js (47 properties, 6 functions)
 * - ✅ Batch 2: UIHelpers.js (2 functions)
 * - ✅ Batch 3: DataFormatters.js (3 functions)
 * - ✅ Batch 4: VisualizationHelpers.js (2 functions)
 * - ✅ Batch 5: ChordHelpers.js (3 functions)
 * - ✅ Batch 6: ChordHelpers.js (+1 function = 4 total)
 * - ✅ Batch 7: ProgressionHelpers.js (1 function)
 * - ✅ Batch 8: Constants.js (5 constants)
 * - ✅ Batch 9: Constants.js (+4 constants = 9 total)
 * - ✅ Batch 10: TabNavigation.js (3 functions)
 * - ✅ Batch 11: ModalHelpers.js (3 functions)
 * - ✅ Batch 12: ModalHelpers.js (+2 functions = 5 total)
 * - ✅ Batch 13: StructureBuilders.js (10 functions)
 * - ✅ Batch 14: ChordTab.js (48 functions, ~6,966 lines)
 * - ✅ Batch 15: MelodyTab.js (26 functions, ~2,254 lines)
 * - ✅ Batch 16: SectionTab.js (11 functions, ~921 lines)
 * - ✅ Batch 17: HarmonizeTab.js (1 function, ~562 lines)
 * - ✅ Batch 18: PolyphonyTab.js (13 functions, ~2,265 lines)
 * - ✅ Phase 3: Main modal functions (showUnifiedRecommendationModal, closeUnifiedRecommendationModal)
 * - ✅ MIGRATION COMPLETE - Ready for Phase 4 cleanup
 */

// ============================================================================
// IMPORTS FROM EXTRACTED MODULES (Batch 1)
// ============================================================================

// Modal State Management
import {
    modalState,
    getModalState,
    updateModalState,
    resetModalState,
    saveModalState,
    setStateProperty,
    TABS,
    CHORD_VIEWS,
    CHORD_INTENTS,
    MELODY_VIEWS
} from './ModalState.js';

// Audio Playback Functions
import {
    ensureAudioReady,
    playChord,
    stopChord,
    setupHoldToPlay,
    playChordSequence,
    playCompareChordSequence,
    playPhrase,
    previewMelodyNote,
    playGeneratedSection,
    previewBassPattern,
    playPolyphonyPreview,
    beatsToDuration as beatsToDurationAudio
} from './AudioPlayback.js';

// Music Utility Functions
import {
    hexToRgba,
    SCORE_DESCRIPTIONS,
    getScoreQualityLabel,
    formatScoreContribution,
    getScoreColor,
    getInversionLabel,
    getMaxInversion,
    transposePitch,
    comparePitches,
    getPitchDifference,
    getPitchValue,
    pitchToMidi,
    midiToPitch,
    shouldPreferFlats,
    getFifthFromRoot,
    getThirdFromRoot,
    getSeventhFromRoot,
    getChordTonesForStyle,
    parseKeyRoot,
    isInScale,
    isBlueNote,
    nearestScaleTone,
    validateNoteForStyle,
    isChordToneMidi,
    clampToVoiceRange,
    validateAndConstrainPitch,
    getScalePitches,
    getScaleDegree,
    transposeDiatonic,
    beatsToDuration,
    durationToUnits,
    getDurationInBeats,
    showChordScoreTooltip,
    hideChordScoreTooltip,
    showMelodyScoreTooltip,
    hideMelodyScoreTooltip,
    showSequenceScoreTooltip,
    hideSequenceScoreTooltip,
    showPhraseScoreTooltip,
    hidePhraseScoreTooltip,
    hideAllScoreTooltips,
    injectTooltipStyles
} from './MusicUtils.js';

// UI Helper Functions
import {
    showLoadingSplash,
    createSeparator
} from './UIHelpers.js';

// Data Formatting Functions
import {
    hasAdvancedFeatures,
    formatModeName,
    getAdvancedFeatureItems
} from './DataFormatters.js';

// Visualization Helper Functions
import {
    getTensionColor,
    createTensionSmoothPath
} from './VisualizationHelpers.js';

// Chord Helper Functions
import {
    getChordNotesForDisplay,
    normalizeNoteForComparison,
    getChordInKeyForDegree,
    getRelativeNote
} from './ChordHelpers.js';

// Progression Helper Functions
import {
    buildSectionsWithUngrouped
} from './ProgressionHelpers.js';

// Constants and Configuration
import {
    MODAL_ID,
    SECTION_TYPES,
    HARMONY_STYLES,
    HARMONIZE_SECTION_TYPES,
    BASS_STYLE_CATEGORIES,
    MELODY_CATEGORY_COLORS,
    TEXTURE_TYPES,
    BASS_PATTERN_CATEGORIES,
    TAB_INFO
} from './Constants.js';

// Tab Navigation Functions
import {
    switchTab,
    renderActiveTab,
    handleKeydown
} from './TabNavigation.js';

// Modal Helper Functions
import {
    updateHeaderSelectionBadge,
    showSectionInfo,
    showTabInfo,
    getChordNotesForPlayback,
    updateSubModeSelector
} from './ModalHelpers.js';

// Structure Builder Functions
import {
    createModalStructure,
    createHeader,
    createPersistentProgressionBar,
    updatePersistentProgressionBar,
    createTabNavigation,
    createContextBar,
    createSectionIntentControls,
    createStyleMoodControls,
    createDurationToggle,
    createWeightsButton
} from './StructureBuilders.js';

// Chord Tab Functions
import { renderChordTab } from './ChordTab.js';

// Melody Tab Functions
import { renderMelodyTab } from './MelodyTab.js';

// Section Tab Functions
import { renderSectionTab } from './SectionTab.js';

// Harmonize Tab Functions
import { renderHarmonizeTab } from './HarmonizeTab.js';

// Polyphony Tab Functions
import { renderPolyphonyTab } from './PolyphonyTab.js';

// ============================================================================
// EXTERNAL MODULE IMPORTS (for main modal functions)
// ============================================================================

// State management
import {
    getCurrentKey,
    getProgressionData,
    getSelectedChordIndex
} from '../../../state/trainerState.js';
import {
    refreshInsertContextForIndex
} from '../../../state/sectionIntentState.js';
import { getCompositionState } from '../../../state/compositionState.js';

// Performance optimization
import { clearRecommendationCache } from '../../../features/comprehensiveChordRecommendations.js';

// ============================================================================
// MAIN MODAL FUNCTIONS
// ============================================================================

/**
 * Shows the unified recommendation modal with specified options.
 *
 * @param {Object} options - Modal configuration
 * @param {string} options.initialTab - Initial tab ('chord', 'melody', 'section', 'harmonize', 'polyphony')
 * @param {string} options.initialView - Initial chord view ('quick', 'explorer', 'sequences')
 * @param {string} options.initialIntent - Initial chord intent ('suggest', 'compare', 'transform', etc.)
 * @param {number} options.selectedChordIndex - Chord index to select in progression
 * @param {string} options.currentRoot - Current chord root note
 * @param {string} options.currentChordType - Current chord type
 * @param {number} options.currentInversion - Current chord inversion
 * @param {Function} options.onAddChord - Callback when chord is added
 * @param {Function} options.onPlayChord - Callback when chord is played
 * @param {Function} options.onStopChord - Callback when chord playback stops
 */
export function showUnifiedRecommendationModal(options = {}) {
    // Clear recommendation cache for fresh results
    // This ensures new modal opens get fresh computations while
    // sequence generation within the same session benefits from caching
    clearRecommendationCache();

    // Remove existing modal
    const existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();

    // Update state from options
    modalState.currentChordType = options.currentChordType || 'Major';
    modalState.currentRoot = options.currentRoot || 'C';
    modalState.activeInversion = options.currentInversion || 0;
    modalState.callbacks.onAddChord = options.onAddChord;
    modalState.callbacks.onPlayChord = options.onPlayChord;
    modalState.callbacks.onStopChord = options.onStopChord;

    // Set initial tab if specified, otherwise restore from localStorage
    if (options.initialTab && Object.values(TABS).includes(options.initialTab)) {
        // Special handling for harmonize tab - fall back to chord if no melody notes
        if (options.initialTab === TABS.HARMONIZE) {
            const compositionState = getCompositionState();
            const hasMelodyNotes = compositionState?.getAllMelodyNotes?.()?.length > 0;
            modalState.activeTab = hasMelodyNotes ? TABS.HARMONIZE : TABS.CHORD;
        } else {
            modalState.activeTab = options.initialTab;
        }
    } else {
        // Restore last used tab from localStorage
        const savedTab = localStorage.getItem('unified-modal-active-tab');
        if (savedTab && Object.values(TABS).includes(savedTab)) {
            // Special handling for harmonize tab - fall back to chord if no melody notes
            if (savedTab === TABS.HARMONIZE) {
                const compositionState = getCompositionState();
                const hasMelodyNotes = compositionState?.getAllMelodyNotes?.()?.length > 0;
                modalState.activeTab = hasMelodyNotes ? TABS.HARMONIZE : TABS.CHORD;
            } else {
                modalState.activeTab = savedTab;
            }
        }
        // If no saved tab or invalid, keep the default (TABS.CHORD from ModalState.js)
    }
    if (options.initialView && Object.values(CHORD_VIEWS).includes(options.initialView)) {
        modalState.chordView = options.initialView;
    }
    // Set initial intent for chord hub if specified
    if (options.initialIntent && Object.values(CHORD_INTENTS).includes(options.initialIntent)) {
        modalState.chordIntent = options.initialIntent;
        // Also switch to chord tab when intent is specified
        modalState.activeTab = TABS.CHORD;
    }

    // Initialize selectedProgressionIndex
    const progressionData = getProgressionData() || [];

    // Check if explicit selectedChordIndex was provided
    if (options.selectedChordIndex !== undefined) {
        if (options.selectedChordIndex >= 0 && options.selectedChordIndex < progressionData.length) {
            modalState.selectedProgressionIndex = options.selectedChordIndex;
            const selectedChord = progressionData[options.selectedChordIndex];
            modalState.currentRoot = selectedChord.root;
            modalState.currentChordType = selectedChord.type;
            modalState.activeInversion = selectedChord.inversion || 0;
        } else {
            modalState.selectedProgressionIndex = -1;
        }
    } else {
        // Fall back to currently selected chord card
        const currentlySelectedIndex = getSelectedChordIndex();
        if (currentlySelectedIndex !== null && currentlySelectedIndex >= 0 && currentlySelectedIndex < progressionData.length) {
            modalState.selectedProgressionIndex = currentlySelectedIndex;
            // Also sync currentRoot, currentChordType, and activeInversion to match the selected chord
            const selectedChord = progressionData[currentlySelectedIndex];
            modalState.currentRoot = selectedChord.root;
            modalState.currentChordType = selectedChord.type;
            modalState.activeInversion = selectedChord.inversion || 0;
        } else {
            // Default to adding after last chord
            modalState.selectedProgressionIndex = -1;
            // When adding after last chord, use the last chord's context if available
            if (progressionData.length > 0) {
                const lastChord = progressionData[progressionData.length - 1];
                modalState.currentRoot = lastChord.root;
                modalState.currentChordType = lastChord.type;
                modalState.activeInversion = lastChord.inversion || 0;
            }
        }
    }

    // Reset melody tab chord selection so it re-syncs with the current selection
    // This ensures the quick progression selector shows the currently selected chord
    modalState.melodySelectedChordStart = -1;
    modalState.melodySelectedChordEnd = -1;

    // Create and show modal
    const modal = createModalStructure();
    document.body.appendChild(modal);

    // Initialize section intent context based on current selection
    // This sets targetSection so we know which section type the user is working with
    const compositionStateForInit = getCompositionState();
    if (compositionStateForInit?.getSections) {
        const sections = compositionStateForInit.getSections();
        const progLength = progressionData.length;

        // If no chord is selected but we have chords, default to first chord (index 0)
        // This matches the visual highlighting behavior in the modal
        if (modalState.selectedProgressionIndex === -1 && progLength > 0) {
            modalState.selectedProgressionIndex = 0;
            const firstChord = progressionData[0];
            modalState.currentRoot = firstChord.root;
            modalState.currentChordType = firstChord.type;
            modalState.activeInversion = firstChord.inversion || 0;
        }

        // Use the modal's selectedProgressionIndex for section context
        const effectiveIndex = modalState.selectedProgressionIndex >= 0 ? modalState.selectedProgressionIndex : 0;
        refreshInsertContextForIndex(effectiveIndex, sections, progLength);
    }

    // Render initial content
    renderActiveTab();

    // Listen for weight/preference changes to refresh recommendations
    const handlePreferenceChange = (event) => {
        // Only refresh if the modal is still in the DOM
        if (!document.getElementById(MODAL_ID)) {
            return;
        }

        // Update local state from new preferences
        if (event.detail) {
            if (event.detail.style) modalState.style = event.detail.style;
            if (event.detail.mood) modalState.mood = event.detail.mood;
        }

        // Clear cached melody phrases so they regenerate with new settings
        modalState.currentPhraseCandidates = [];
        modalState.currentMelodySuggestions = [];

        // Refresh the active tab to reflect new weights
        renderActiveTab();
    };

    document.addEventListener('chord-suggestion-preference-changed', handlePreferenceChange);

    // Add keyboard shortcut handler for Escape and number keys
    const keydownHandler = (e) => {
        // Only handle if modal is still open
        if (!document.getElementById(MODAL_ID)) return;
        handleKeydown(e);
    };
    document.addEventListener('keydown', keydownHandler);

    // Also listen for weight changes (from Chord Explorer settings)
    // This ensures sequence recommendations update when user saves weight settings
    document.addEventListener('chord-weights-changed', handlePreferenceChange);

    // Listen for progression updates (when chords are cleared or modified)
    // This ensures the modal re-renders when the underlying progression changes
    const handleProgressionUpdate = (event) => {
        // Only refresh if the modal is still in the DOM
        if (!document.getElementById(MODAL_ID)) {
            return;
        }

        // Update the modal state with new progression context
        const progressionData = getProgressionData() || [];
        if (progressionData.length === 0) {
            // Reset to defaults when progression is cleared
            modalState.selectedProgressionIndex = -1;
            modalState.currentRoot = 'C';
            modalState.currentChordType = 'Major';
            modalState.activeInversion = 0;
        } else if (modalState.selectedProgressionIndex >= progressionData.length) {
            // Selected index is now out of bounds, reset to last chord
            modalState.selectedProgressionIndex = progressionData.length - 1;
            const lastChord = progressionData[modalState.selectedProgressionIndex];
            modalState.currentRoot = lastChord.root;
            modalState.currentChordType = lastChord.type;
            modalState.activeInversion = lastChord.inversion || 0;
        }

        // Clear cached data
        modalState.currentPhraseCandidates = [];
        modalState.currentMelodySuggestions = [];

        // Refresh the active tab
        renderActiveTab();
    };

    window.addEventListener('progressionUpdated', handleProgressionUpdate);

    // Clean up event listeners when modal is removed
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.removedNodes) {
                if (node === modal || node.contains?.(modal)) {
                    document.removeEventListener('chord-suggestion-preference-changed', handlePreferenceChange);
                    document.removeEventListener('chord-weights-changed', handlePreferenceChange);
                    document.removeEventListener('keydown', keydownHandler);
                    window.removeEventListener('progressionUpdated', handleProgressionUpdate);
                    observer.disconnect();
                    return;
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Focus management
    modal.focus();
}

/**
 * Closes the unified recommendation modal.
 */
export function closeUnifiedRecommendationModal() {
    // Hide any open tooltips before closing
    hideAllScoreTooltips();

    const modal = document.getElementById(MODAL_ID);
    if (modal) {
        // Save state
        localStorage.setItem('unified-modal-active-tab', modalState.activeTab);
        localStorage.setItem('unified-modal-chord-view', modalState.chordView);
        modal.remove();
    }
}

// ============================================================================
// RE-EXPORT ALL EXTRACTED MODULE FUNCTIONS
// ============================================================================

// Modal State (Batch 1)
export {
    modalState,
    getModalState,
    updateModalState,
    resetModalState,
    saveModalState,
    setStateProperty,
    TABS,
    CHORD_VIEWS,
    CHORD_INTENTS,
    MELODY_VIEWS
};

// Audio Playback (Batch 1)
export {
    ensureAudioReady,
    playChord,
    stopChord,
    setupHoldToPlay,
    playChordSequence,
    playCompareChordSequence,
    playPhrase,
    previewMelodyNote,
    playGeneratedSection,
    previewBassPattern,
    playPolyphonyPreview
};

// Music Utils (Batch 1)
export {
    hexToRgba,
    SCORE_DESCRIPTIONS,
    getScoreQualityLabel,
    formatScoreContribution,
    getScoreColor,
    getInversionLabel,
    getMaxInversion,
    transposePitch,
    comparePitches,
    getPitchDifference,
    getPitchValue,
    pitchToMidi,
    midiToPitch,
    shouldPreferFlats,
    getFifthFromRoot,
    getThirdFromRoot,
    getSeventhFromRoot,
    getChordTonesForStyle,
    parseKeyRoot,
    isInScale,
    isBlueNote,
    nearestScaleTone,
    validateNoteForStyle,
    isChordToneMidi,
    clampToVoiceRange,
    validateAndConstrainPitch,
    getScalePitches,
    getScaleDegree,
    transposeDiatonic,
    beatsToDuration,
    durationToUnits,
    getDurationInBeats,
    showChordScoreTooltip,
    hideChordScoreTooltip,
    showMelodyScoreTooltip,
    hideMelodyScoreTooltip,
    showSequenceScoreTooltip,
    hideSequenceScoreTooltip,
    showPhraseScoreTooltip,
    hidePhraseScoreTooltip,
    hideAllScoreTooltips,
    injectTooltipStyles
};

// UI Helpers (Batch 2)
export {
    showLoadingSplash,
    createSeparator
};

// Data Formatters (Batch 3)
export {
    hasAdvancedFeatures,
    formatModeName,
    getAdvancedFeatureItems
};

// Visualization Helpers (Batch 4)
export {
    getTensionColor,
    createTensionSmoothPath
};

// Chord Helpers (Batch 5 + 6)
export {
    getChordNotesForDisplay,
    normalizeNoteForComparison,
    getChordInKeyForDegree,
    getRelativeNote
};

// Progression Helpers (Batch 7)
export {
    buildSectionsWithUngrouped
};

// Constants and Configuration (Batch 8 + 9)
export {
    MODAL_ID,
    SECTION_TYPES,
    HARMONY_STYLES,
    HARMONIZE_SECTION_TYPES,
    BASS_STYLE_CATEGORIES,
    MELODY_CATEGORY_COLORS,
    TEXTURE_TYPES,
    BASS_PATTERN_CATEGORIES,
    TAB_INFO
};

// Tab Navigation (Batch 10)
export {
    switchTab,
    renderActiveTab,
    handleKeydown
};

// Modal Helpers (Batch 11 + 12)
export {
    updateHeaderSelectionBadge,
    showSectionInfo,
    showTabInfo,
    getChordNotesForPlayback,
    updateSubModeSelector
};

// Structure Builders (Batch 13)
export {
    createModalStructure,
    createHeader,
    createPersistentProgressionBar,
    updatePersistentProgressionBar,
    createTabNavigation,
    createContextBar,
    createSectionIntentControls,
    createStyleMoodControls,
    createDurationToggle,
    createWeightsButton
};

// Chord Tab (Batch 14)
export { renderChordTab };

// Melody Tab (Batch 15)
export { renderMelodyTab };

// Section Tab (Batch 16)
export { renderSectionTab };

// Harmonize Tab (Batch 17)
export { renderHarmonizeTab };

// Polyphony Tab (Batch 18)
export { renderPolyphonyTab };

// ============================================================================
// WINDOW EXPORTS (for legacy compatibility)
// ============================================================================

// Export main functions to window for HTML onclick handlers (if needed)
if (typeof window !== 'undefined') {
    window.showUnifiedRecommendationModal = showUnifiedRecommendationModal;
    window.closeUnifiedRecommendationModal = closeUnifiedRecommendationModal;

    // Export renderActiveTab for progression bar chord selection updates
    window.renderActiveTab = renderActiveTab;

    // Export tab renderers for old module delegation
    window.renderChordTab = renderChordTab;
    window.renderMelodyTab = renderMelodyTab;
    window.renderSectionTab = renderSectionTab;
    window.renderHarmonizeTab = renderHarmonizeTab;
    window.renderPolyphonyTab = renderPolyphonyTab;
}
