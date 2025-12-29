# Chord Tab Extraction Summary

## Overview
Successfully extracted the Chord Tab section from `UnifiedRecommendationModal.js` into a new modular file `ChordTab.js`.

**Source file:** `src/modules/ui/recommendations/UnifiedRecommendationModal.js`  
**Lines extracted:** 1893-8693 (6,801 lines)  
**New file:** `src/modules/ui/recommendations/UnifiedRecommendationModal/ChordTab.js`  
**Final line count:** 6,938 lines (including header and exports)  
**File size:** 284 KB

## Extraction Statistics

- **Total functions extracted:** 55
- **Public exports:** 68 items (functions + utilities)
- **External dependencies:** 12 import statements
- **Window.* references:** 15 global functions

## Exported Functions

### Main Tab Rendering
1. `renderChordTab` - Main entry point for Chord Tab
2. `createChordIntentNav` - Creates the intent navigation (Suggest, Compare, Transform, etc.)
3. `renderChordIntentContent` - Renders content for selected intent

### Intent Renderers (6 total)
4. `renderSuggestIntent` - Quick suggestions + Explorer toggle
5. `renderCompareIntent` - Side-by-side chord comparison
6. `renderTransformIntent` - Chord transformation presets
7. `renderOptimizeIntent` - Tension arc optimization
8. `renderSequenceIntent` - Multi-chord sequence generation
9. `renderAdvancedIntent` - Advanced harmonic techniques

### Advanced Section Creators
10. `createAdvancedSection_BorrowedChords`
11. `createAdvancedSection_SecondaryDominants`
12. `createAdvancedSection_ChromaticMediants`
13. `createAdvancedChordCard`

### Advanced Chord Generators
14. `generateBorrowedChordsForKey`
15. `generateSecondaryDominantsForKey`
16. `generateChromaticMediantsForKey`
17. `scoreAdvancedChordInContext`

### Compare Intent Utilities
18. `applyCompareReplacement`
19. `playCompareChordSequence`
20. `getChordNotesForPlayback`

### Transform Intent Utilities
21. `optimizeVoiceLeading`
22. `showTransformPreview`

### Optimize (Tension Arc) Utilities
23. `renderTensionHeader`
24. `renderTensionControls`
25. `renderTensionSVG`
26. `createTensionSmoothPath`
27. `renderTensionSectionBackgrounds`
28. `renderTensionMismatchHighlights`
29. `renderTensionStats`
30. `renderTensionMismatchList`
31. `renderTensionActions`
32. `attachTensionEventListeners`
33. `getTensionColor`

### Suggest View Utilities
34. `createChordViewSelector`
35. `renderChordView`
36. `createInversionSelector`
37. `createCompactProgressionSelector`
38. `renderQuickSuggestionsView`

### Explorer and Sequence Views
39. `renderExplorerView`
40. `renderSequencesView`
41. `renderSequenceCards`
42. `renderExpandedAlternatives`

### Advanced Explanation Utilities
43. `showAdvancedExplanationModal`
44. `generateModalInterchangeExplanation`
45. `generateSecondaryDominantExplanation`
46. `generateChromaticMediantExplanation`
47. `getChordNotesForDisplay`
48. `normalizeNoteForComparison`
49. `getChordInKeyForDegree`

### Recommendation Card Utilities
50. `createRecommendationCard`
51. `addChordToProgression`
52. `hasAdvancedFeatures`
53. `formatModeName`
54. `getAdvancedFeatureItems`
55. `createAdvancedSection`

## Import Requirements

### External Data and Utilities
```javascript
import { CHORD_DEFINITIONS, INVERSION_NAMES, ALL_NOTES } from '../../../../data/music-data.js';
import { getInvertedChordNotes, getChordNotes, spellNoteInKey, getEnharmonicPreferenceForKey } from '../../../utils/noteUtils.js';
import { noteToRomanNumeral } from '../../../utils/romanNumerals.js';
```

### Feature Modules
```javascript
import { generateComprehensiveRecommendations } from '../../../features/comprehensiveChordRecommendations.js';
import {
    generateChordSequences,
    generateSequencesWithRoot,
    describeSequence,
    generateSequenceReason,
    TENSION_ARC_SHAPES,
    generateTensionArcSequences,
    suggestTensionArcForSection,
    verifyMelodyCompatibility,
    calculateMelodyAlignmentScore
} from '../../../features/chordSequences.js';
```

### State Management
```javascript
import { getCompositionState } from '../../../state/compositionState.js';
import {
    getCurrentKey,
    getProgressionData,
    setProgressionData,
    getContextAwareMode,
    setContextAwareMode,
    getProgressionLookback,
    setProgressionLookback,
    getSelectedChordIndex,
    setSelectedChordIndex
} from '../../../state/trainerState.js';
import {
    getSectionIntent,
    setSectionIntent,
    INTENT_MODES,
    CONTINUE_SUBMODES,
    getInsertAfterIndex,
    setInsertAfterIndex,
    getEffectiveSectionContext,
    refreshInsertContext,
    refreshInsertContextForIndex
} from '../../../state/sectionIntentState.js';
```

### Analysis Modules
```javascript
import { getTensionArcPlanner, TensionArcPlanner, TENSION_ARC_TEMPLATES } from '../../../analysis/TensionArcPlanner.js';
import { analyzeRhythmicContext } from '../../../features/rhythmicContextAnalyzer.js';
```

## Dependencies from Parent Module (Index.js)

These items are currently referenced in the code but will need to be provided by the parent module's index.js:

### State Objects
- `modalState` - Main modal state object

### Constants
- `CHORD_VIEWS` - { QUICK, EXPLORER }
- `CHORD_INTENTS` - { SUGGEST, COMPARE, TRANSFORM, OPTIMIZE, SEQUENCE, ADVANCED }

### Utility Functions
- `getScoreColor(score)` - Returns color based on score value
- `getScoreQualityLabel(score)` - Returns quality label (Excellent, Good, etc.)
- `hexToRgba(hex, alpha)` - Converts hex color to rgba
- `getInversionLabel(inversion)` - Returns inversion label
- `setupHoldToPlay(button, chord)` - Sets up hold-to-play functionality
- `hideAllScoreTooltips()` - Hides all score tooltip overlays

### UI Update Functions
- `updatePersistentProgressionBar()` - Updates the progression bar display

## Window.* References (Global Functions)

These functions are called via `window.*` and are expected to be available globally:

1. `window.addSpecificChordToProgression()`
2. `window.dispatchEvent()`
3. `window.getInstrument()`
4. `window.getPiano()`
5. `window.highlightChordCard()`
6. `window.refreshNotationFromProgression()`
7. `window.renderProgressionDisplay()`
8. `window.saveStateBeforeChange()`
9. `window.selectBuilderRootNote()`
10. `window.selectChordCard()`
11. `window.showTensionOptimizerModal()`
12. `window.showToast()`
13. `window.showWhyThisWorks()`
14. `window.syncProgressionToMelodyComposer()`
15. `window.unhighlightAllChordCards()`

## External Library Dependencies

- **Tone.js** - Used for audio playback in `playCompareChordSequence()`
  - `Tone.context.state`
  - `Tone.start()`
  - `Tone.now()`

## Next Steps for Integration

1. **Create ModalState.js** - Extract modal state and constants
2. **Create MusicUtils.js** - Extract music utility functions
3. **Update index.js** - Re-export all modular components
4. **Update UnifiedRecommendationModal.js** - Import from ChordTab.js instead of defining inline
5. **Test all functionality** - Ensure all chord tab features work after modularization

## File Structure After Extraction

```
src/modules/ui/recommendations/UnifiedRecommendationModal/
├── ChordTab.js (NEW - 6,938 lines)
├── index.js (TODO - will re-export all modules)
├── ModalState.js (TODO - state and constants)
├── MusicUtils.js (TODO - music utilities)
└── ... (other tab modules to be extracted)
```

## Notes

- All function logic has been preserved exactly as-is
- No modifications to business logic were made
- Import paths adjusted for new location in subdirectory
- Placeholder comments added for dependencies that will come from index.js
- Ready for integration once ModalState.js and index.js are created
