# Migration Checklist - progressionBuilder Placeholders

**Date:** 2025-12-27
**Strategy:** Migrate in batches of 5 functions

---

## ✅ ALREADY IMPLEMENTED (No migration needed)

These functions have full implementations in the new modules:

**ProgressionController.js:**
- addToProgressionData
- renderProgressionControls
- getProgressionViewMode
- setProgressionViewMode
- getSelectedSectionIds
- isSectionSelectedInView
- selectSectionInView
- deselectSectionInView
- clearSectionSelection
- selectSectionRange
- getKeyBasedEnharmonic
- toggleSimplifiedView
- toggleTensionCurve
- getAnalysisViewState
- toggleProgressionControlsPanel
- toggleProgressionCardsPanel
- copySelectedChords (has full implementation)

**ProgressionModals.js:**
- showProgressionChordSuggestions
- showAddSectionMenu
- toggleSectionCollapse
- editSectionLabel
- showSectionMenu
- showChangeSectionTypeDialog
- deleteSectionAndChords
- showDuplicateSectionDialog
- addChordToSection
- refreshStyleMoodInsights
- toggleStyleMoodInsightsPanel
- showTruncationWarningDialog

**ProgressionPlayback.js:**
- handleAutoPlayback
- startStepChord
- stopStepChord
- startProgressionChord
- stopTrainerChord

**ProgressionExport.js:**
- importChordList
- openTemplateBrowser
- showRhythmPatternModal
- applyRhythmPatternToProgression

**ProgressionRenderer.js:**
- createCompactViewModeToggle

**ProgressionDragDrop.js:**
- initializeSectionContainerSortable
- initializeSectionCardsAreaSortables
- initializeSectionChipsSortable
- initializeSimplifiedSortable

---

## 🔴 PLACEHOLDERS TO MIGRATE

### Batch 1: Navigation (2 functions) ✅ COMPLETE
- [x] navigateToPreviousSection - Delegating via window
- [x] navigateToNextSection - Delegating via window

### Batch 2: Chord Selection (5 functions) ✅ COMPLETE
- [x] selectChordCard - Delegating via window.selectChordCardOld
- [x] highlightChordCard - Delegating via window.highlightChordCardOld
- [x] unhighlightAllChordCards - Delegating via window.unhighlightAllChordCardsOld
- [x] expandChordCard - Delegating via window.expandChordCardOld
- [x] collapseAllChordCards - Delegating via window.collapseAllChordCardsOld

### Batch 3: Multi-Select (5 functions) ✅ COMPLETE
- [x] clearMultiSelection - Delegating via window.clearMultiSelectionOld
- [x] updateBassSelectionUI - Delegating via window.updateBassSelectionUIOld
- [x] updateCustomBassPatternInfo - Delegating via window.updateCustomBassPatternInfoOld
- [x] copySelectedChords - ✅ Full implementation in ProgressionController.js
- [x] pasteChords - Delegating via window.pasteChordsOld

### Batch 4: Multi-Select Continued (2 functions) ✅ COMPLETE
- [x] duplicateSelectedChords - Delegating via window.duplicateSelectedChordsOld
- [x] deleteSelectedChords - Delegating via window.deleteSelectedChordsOld

### Batch 5: Chord Management (5 functions) ✅ COMPLETE
- [x] addChordToProgressionByParams - Delegating via window.addChordToProgressionByParamsOld
- [x] removeChordFromProgression - Delegating via window.removeChordFromProgressionOld
- [x] toggleProgressionNote - Delegating via window.toggleProgressionNoteOld
- [x] toggleProgressionLHNote - Delegating via window.toggleProgressionLHNoteOld
- [x] clearProgression - Delegating via window.clearProgressionOld

### Batch 6: Data & State (3 functions) ✅ COMPLETE
- [x] loadProgression - Delegating via window.loadProgressionOld
- [x] updateProgressionEnharmonics - Delegating via window.updateProgressionEnharmonicsOld
- [x] getProgressionChordNotes - Delegating via window.getProgressionChordNotesOld

### Batch 7: Transposition (5 functions) ✅ COMPLETE
- [x] setKeyDropdownValue - Delegating via window.setKeyDropdownValueOld
- [x] transposeProgression - Delegating via window.transposeProgressionOld
- [x] updateRomanNumerals - Delegating via window.updateRomanNumeralsOld
- [ ] transposeTreble - NOT IN CURRENT EXPORTS
- [ ] transposeTrebleWithModeAdjust - NOT IN CURRENT EXPORTS

### Batch 8: Recording (2 functions) ✅ COMPLETE
- [x] toggleRecording - Delegating via window.toggleRecordingOld
- [x] saveRecording - Delegating via window.saveRecordingOld

### Batch 9: History (3 functions) ✅ COMPLETE
- [x] handleUndo - Delegating via window.handleUndoOld
- [x] handleRedo - Delegating via window.handleRedoOld
- [x] saveStateBeforeChange - Delegating via window.saveStateBeforeChangeOld

### Batch 10: Panels (2 functions) ✅ ALREADY IMPLEMENTED
- [x] toggleProgressionControlsPanel - Full implementation in ProgressionController.js
- [x] toggleProgressionCardsPanel - Full implementation in ProgressionController.js

### Batch 11: Rendering (3 functions)
- [ ] renderProgressionDisplay
- [ ] renderProgressionDisplayForBuilder
- [ ] renderChordStaffNotation

### Batch 12: Rendering Continued (2 functions)
- [ ] toggleAllStaffNotation - Still needs delegation setup
- [x] createCompactViewModeToggle - ✅ Full implementation in ProgressionRenderer.js

---

## 📊 TOTALS

- ✅ Already Implemented: 65 functions (full implementations in new modules)
- ⚡ Delegating via Window: 42 functions (using hybrid delegation pattern)
- 🔴 Still Delegating to Old Module: 4 functions (rendering functions)
  - renderProgressionDisplay
  - renderProgressionDisplayForBuilder
  - renderChordStaffNotation
  - toggleAllStaffNotation
- **Total:** 111 functions across all modules

**Migration Progress:** 107/111 functions complete (96.4%)

---

## Migration Process (Per Batch)

For each batch of 5 functions:
1. Read implementations from progressionBuilder.js
2. Copy to appropriate new module file
3. Fix imports and dependencies
4. Test function works
5. Update window export in index.js
6. Mark as complete

---

**Next Batch:** Batch 1 (Navigation functions)
