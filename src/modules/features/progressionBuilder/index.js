/**
 * progressionBuilder/index.js
 *
 * Main coordinator module for Progression Builder
 *
 * This file serves as the single entry point for the refactored progressionBuilder module,
 * which has been split from a monolithic 17,453-line file into 6 focused modules:
 *
 * - ProgressionPlayback.js    - Audio playback (auto-play, step mode, rhythm patterns)
 * - ProgressionExport.js       - Import/export, templates, rhythm pattern application
 * - ProgressionModals.js       - All modals (recommendations, sections, style/mood)
 * - ProgressionRenderer.js     - All rendering (cards, notation, sections, patterns)
 * - ProgressionDragDrop.js     - Drag-and-drop functionality (sections, cards, chips)
 * - ProgressionController.js   - State management (CRUD operations, selections, undo/redo)
 *
 * REFACTORING PHASE: Phase 1.7 - Create coordinator (FINAL PHASE)
 *
 * This coordinator:
 * 1. Imports all functions from the 6 modules
 * 2. Re-exports public API functions
 * 3. Wires up cross-module dependencies via initialization functions
 * 4. Exports window functions for HTML onclick handlers (legacy pattern)
 * 5. Provides a clean, organized interface to the progression builder system
 */

// ============================================================================
// MODULE IMPORTS
// ============================================================================

// Playback Functions
import {
    handleAutoPlayback,
    startStepChord,
    stopStepChord,
    startProgressionChord,
    stopTrainerChord
} from './ProgressionPlayback.js';

// Export/Import Functions
import {
    importChordList,
    openTemplateBrowser,
    showRhythmPatternModal,
    applyRhythmPatternToProgression
} from './ProgressionExport.js';

// Modal Functions
import {
    showProgressionChordSuggestions,
    refreshStyleMoodInsights,
    toggleStyleMoodInsightsPanel,
    initializeStyleMoodControls,
    showAddSectionMenu,
    toggleSectionCollapse,
    editSectionLabel,
    showSectionMenu,
    showChangeSectionTypeDialog,
    deleteSectionAndChords,
    showDuplicateSectionDialog,
    addChordToSection,
    showTruncationWarningDialog
} from './ProgressionModals.js';

// Rendering Functions
import {
    renderProgressionDisplay,
    renderProgressionDisplayForBuilder,
    renderProgressionControls,
    renderChordStaffNotation,
    toggleAllStaffNotation,
    createCompactViewModeToggle
} from './ProgressionRenderer.js';

// Drag-Drop Functions
import {
    initializeSectionContainerSortable,
    initializeSectionCardsAreaSortables,
    initializeSectionChipsSortable,
    initializeSimplifiedSortable
} from './ProgressionDragDrop.js';

// Controller Functions (LARGE EXPORT LIST)
import {
    // View Mode & Section Management
    getProgressionViewMode,
    setProgressionViewMode,
    getSelectedSectionIds,
    isSectionSelectedInView,
    selectSectionInView,
    deselectSectionInView,
    clearSectionSelection,
    selectSectionRange,
    navigateToPreviousSection,
    navigateToNextSection,

    // Chord Selection
    selectChordCard,
    highlightChordCard,
    unhighlightAllChordCards,
    expandChordCard,
    collapseAllChordCards,

    // Multi-Select
    clearMultiSelection,
    updateBassSelectionUI,
    updateCustomBassPatternInfo,
    copySelectedChords,
    pasteChords,
    duplicateSelectedChords,
    deleteSelectedChords,

    // Chord Management
    addChordToProgressionByParams,
    addToProgressionData,
    removeChordFromProgression,
    toggleProgressionNote,
    toggleProgressionLHNote,
    clearProgression,

    // Data & State
    loadProgression,
    updateProgressionEnharmonics,
    getProgressionChordNotes,
    getKeyBasedEnharmonic,

    // Key & Transposition
    setKeyDropdownValue,
    transposeProgression,
    updateRomanNumerals,
    transposeTreble,
    transposeTrebleWithModeAdjust,

    // Recording
    toggleRecording,
    saveRecording,

    // Undo/Redo
    handleUndo,
    handleRedo,
    saveStateBeforeChange,

    // Panel Toggles
    toggleProgressionControlsPanel,
    toggleProgressionCardsPanel,

    // Analysis
    toggleSimplifiedView,
    toggleTensionCurve,
    getAnalysisViewState
} from './ProgressionController.js';

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the Progression Builder module
 * Called by main.js during app initialization
 */
export function initProgressionBuilder() {
    // Initialize style/mood controls
    initializeStyleMoodControls();

    // Render progression controls (dropdowns, event listeners, load random progression)
    renderProgressionControls();

    console.log('[ProgressionBuilder] Module initialized');
}

// ============================================================================
// PUBLIC API - Re-export all functions for external use
// ============================================================================

// Playback
export {
    handleAutoPlayback,
    startStepChord,
    stopStepChord,
    startProgressionChord,
    stopTrainerChord
};

// Export/Import
export {
    importChordList,
    openTemplateBrowser,
    showRhythmPatternModal,
    applyRhythmPatternToProgression
};

// Modals
export {
    showProgressionChordSuggestions,
    refreshStyleMoodInsights,
    toggleStyleMoodInsightsPanel,
    showAddSectionMenu,
    toggleSectionCollapse,
    editSectionLabel,
    showSectionMenu,
    showChangeSectionTypeDialog,
    deleteSectionAndChords,
    showDuplicateSectionDialog,
    addChordToSection,
    showTruncationWarningDialog
};

// Rendering
export {
    renderProgressionDisplay,
    renderProgressionDisplayForBuilder,
    renderProgressionControls,
    renderChordStaffNotation,
    toggleAllStaffNotation,
    createCompactViewModeToggle
};

// Drag-Drop
export {
    initializeSectionContainerSortable,
    initializeSectionCardsAreaSortables,
    initializeSectionChipsSortable,
    initializeSimplifiedSortable
};

// Controller - View Mode
export {
    getProgressionViewMode,
    setProgressionViewMode,
    getSelectedSectionIds,
    isSectionSelectedInView,
    selectSectionInView,
    deselectSectionInView,
    clearSectionSelection,
    selectSectionRange,
    navigateToPreviousSection,
    navigateToNextSection
};

// Controller - Selection
export {
    selectChordCard,
    highlightChordCard,
    unhighlightAllChordCards,
    expandChordCard,
    collapseAllChordCards,
    clearMultiSelection,
    updateBassSelectionUI,
    updateCustomBassPatternInfo,
    copySelectedChords,
    pasteChords,
    duplicateSelectedChords,
    deleteSelectedChords
};

// Controller - Chord Management
export {
    addChordToProgressionByParams,
    addToProgressionData,
    removeChordFromProgression,
    toggleProgressionNote,
    toggleProgressionLHNote,
    clearProgression
};

// Controller - Data
export {
    loadProgression,
    updateProgressionEnharmonics,
    getProgressionChordNotes,
    getKeyBasedEnharmonic
};

// Controller - Transposition
export {
    setKeyDropdownValue,
    transposeProgression,
    updateRomanNumerals,
    transposeTreble,
    transposeTrebleWithModeAdjust
};

// Controller - Recording
export {
    toggleRecording,
    saveRecording
};

// Controller - History
export {
    handleUndo,
    handleRedo,
    saveStateBeforeChange
};

// Controller - Panels
export {
    toggleProgressionControlsPanel,
    toggleProgressionCardsPanel
};

// Controller - Analysis
export {
    toggleSimplifiedView,
    toggleTensionCurve,
    getAnalysisViewState
};

// ============================================================================
// WINDOW EXPORTS - For HTML onclick handlers (legacy pattern)
// ============================================================================
// HYBRID MODE: Only export functions that have been fully implemented
// Placeholder functions will use old module's window exports instead

if (typeof window !== 'undefined') {
    // IMPLEMENTED FUNCTIONS - Override old module
    window.addToProgressionData = addToProgressionData; // ✅ Full implementation
    window.renderProgressionControls = renderProgressionControls; // ✅ Full implementation

    // DELEGATED FUNCTIONS - New module calls old implementation temporarily
    window.renderProgressionDisplay = renderProgressionDisplay; // ⏳ Delegates to old (3000+ lines to migrate)
    window.renderProgressionDisplayForBuilder = renderProgressionDisplayForBuilder; // ⏳ Delegates to old
    window.renderChordStaffNotation = renderChordStaffNotation; // ⏳ Delegates to old
    window.toggleAllStaffNotation = toggleAllStaffNotation; // ⏳ Delegates to old

    // All other functions use old module's exports (commented out below)
}

if (false && typeof window !== 'undefined') {
    // Playback
    window.handleAutoPlayback = handleAutoPlayback;
    window.startStepChord = startStepChord;
    window.stopStepChord = stopStepChord;
    window.startProgressionChord = startProgressionChord;
    window.stopTrainerChord = stopTrainerChord;

    // Export/Import
    window.importChordList = importChordList;
    window.openTemplateBrowser = openTemplateBrowser;
    window.showRhythmPatternModal = showRhythmPatternModal;
    window.applyRhythmPatternToProgression = applyRhythmPatternToProgression;

    // Modals
    window.showProgressionChordSuggestions = showProgressionChordSuggestions;
    window.refreshStyleMoodInsights = refreshStyleMoodInsights;
    window.toggleStyleMoodInsightsPanel = toggleStyleMoodInsightsPanel;
    window.showAddSectionMenu = showAddSectionMenu;
    window.toggleSectionCollapse = toggleSectionCollapse;
    window.editSectionLabel = editSectionLabel;
    window.showSectionMenu = showSectionMenu;
    window.showChangeSectionTypeDialog = showChangeSectionTypeDialog;
    window.deleteSectionAndChords = deleteSectionAndChords;
    window.showDuplicateSectionDialog = showDuplicateSectionDialog;
    window.addChordToSection = addChordToSection;

    // Rendering
    window.renderProgressionDisplay = renderProgressionDisplay;
    window.toggleAllStaffNotation = toggleAllStaffNotation;
    window.createCompactViewModeToggle = createCompactViewModeToggle;

    // View Mode
    window.setProgressionViewMode = setProgressionViewMode;
    window.getProgressionViewMode = getProgressionViewMode;
    window.navigateToPreviousSection = navigateToPreviousSection;
    window.navigateToNextSection = navigateToNextSection;
    window.clearSectionSelection = clearSectionSelection;

    // Selection
    window.clearMultiSelection = clearMultiSelection;
    window.updateBassSelectionUI = updateBassSelectionUI;
    window.updateCustomBassPatternInfo = updateCustomBassPatternInfo;
    window.copySelectedChords = copySelectedChords;
    window.pasteChords = pasteChords;
    window.duplicateSelectedChords = duplicateSelectedChords;
    window.deleteSelectedChords = deleteSelectedChords;
    window.highlightChordCard = highlightChordCard;
    window.unhighlightAllChordCards = unhighlightAllChordCards;
    window.expandChordCard = expandChordCard;
    window.collapseAllChordCards = collapseAllChordCards;

    // Chord Management
    window.showProgressionChordSuggestions = showProgressionChordSuggestions;
    window.addChordToProgressionByParams = addChordToProgressionByParams;
    window.addChordToSection = addChordToSection;
    window.clearProgression = clearProgression;

    // Undo/Redo
    window.handleUndo = handleUndo;
    window.handleRedo = handleRedo;
}
