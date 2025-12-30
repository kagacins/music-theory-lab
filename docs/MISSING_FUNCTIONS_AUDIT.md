# Missing Window Functions Audit - Music Theory Lab

Date: 2025-12-28
Baseline: git commit 6aa27c3 ("Before tutorial change")

## 🔴 CRITICAL: FAB (Floating Action Button) Completely Broken

**ROOT CAUSE**: `initMobileFab()` function was lost during Phase 3 refactoring

- **Function**: `initMobileFab()` (634 lines in git commit 5695c45)
- **Location in git**: src/main.js (commit 5695c45 - "Major FAB updates")
- **Current status**: MISSING from codebase entirely
- **Impact**: ALL FAB buttons are non-functional
- **Called from**: moduleInitialization.js or appSetup.js (needs to be added)
- **Priority**: IMMEDIATE - This breaks a major UI component

**Action Required**:
1. Extract `initMobileFab()` function from git commit 5695c45:src/main.js
2. Extract `handleFabAction()` helper function
3. Create new file: `src/modules/ui/floatingActionButton.js`
4. Add import and initialization call to moduleInitialization.js
5. Add to windowExports.js if needed

---

## Summary
- 4 MISSING ENTIRELY
- 14 EXIST BUT NOT EXPORTED
- 12 EXIST AND EXPORTED (working)
- **1 CRITICAL MISSING**: initMobileFab() - breaks entire FAB system

## Functions Needing Restoration

These 13 functions exist in source but are NOT exported to window:

1. clearAudioFile (songAnalyzer.js)
2. reanalyzeAudio (songAnalyzer.js)
3. closeAudioAnalyzerModal (songAnalyzer.js)
4. importDetectedChords (songAnalyzer.js)
5. transposeDetectedChords (songAnalyzer.js)
6. setExpectedKey (songAnalyzer.js)
7. resetTranspose (songAnalyzer.js)
8. searchOnlineChords (songAnalyzer.js)
9. showNotationShortcuts (notationInit.js)
10. showSongBuilderModal (songwritingWizard.js)
11. showAddSectionMenu (ProgressionModals.js)
12. togglePanel (floatingSuggestionsPanel.js)
13. recallTheoryMoment (theoryMoments.js)

All need to be added to window exports in src/init/windowExports.js

## Functions to Remove or Implement

1. generateMelody (HTML line 2622) - MISSING from codebase
2. playGeneratedMelody (HTML line 2627) - MISSING from codebase
3. playCombinedMelody (HTML line 2947) - MISSING from codebase
4. toggleMelodyMode (HTML line 2520) - MISSING from codebase
5. toggleMelodyRecording (HTML line 2529) - MISSING from codebase
6. toggleCombinedMelodyView (HTML line 2941) - MISSING from codebase
7. revertBassToChordVoicing (HTML line 2379) - MISSING from codebase
8. revertAllBassToChordVoicing (HTML line 2385) - MISSING from codebase

## HTML Corrections Needed

1. Line 817: Change "showVersionHistory" to "showVersionHistoryPanel"
2. Line 2817: Change "toggleMelodyHighlight" to "setHighlightEnabled"

## Bass Function Handlers

Lines 2716, 2775: Consider using existing setBassPattern/setBassOctave functions instead.

## Files Modified

- src/init/windowExports.js (add 13 exports)
- index.html (update 2 function names, remove 8 buttons/checkboxes)

