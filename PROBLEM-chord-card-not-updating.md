# Problem: Chord Cards Not Updating After Harmonize Apply

## Summary
When applying chord changes from the Unified Recommendations Modal's Harmonize tab, the chord cards in the UI do not update to reflect the new chord types, even though the underlying data appears to be updated correctly.

## What Works (Reference Implementation)
Adding chords via `addSpecificChordToProgression()` from the Chord tab works correctly. The flow is:

**File: `src/modules/features/chordBuilder.js` lines 3077-3079**
```javascript
if (window.addToProgressionData) {
    window.addToProgressionData(newChordData);
}
```

**File: `src/modules/features/progressionBuilder.js` lines 11652-11674**
```javascript
export function addToProgressionData(chordData) {
    const trainerState = getTrainerState();
    saveStateBeforeChange();
    trainerState.progressionData.push(chordData);
    // ...
    setProgressionData(trainerState.progressionData);

    // Render both progression displays to keep them in sync
    renderProgressionDisplay('progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);

    renderMelodyNotationIfNeeded(true);
}
```

## What Also Works (Old Auto-Harmonize Modal)
The old `autoHarmonizeModal.js` simply calls `onApply(chordProgression)` and the callback in main.js handles everything.

**File: `src/main.js` lines 1991-2133 (showAutoHarmonize callback)**
```javascript
// Key working pattern:
compositionState.syncWithProgressionData(progressionData);
window.setProgressionData(progressionData);
invalidateProgressionDataCache();

setTimeout(() => {
    // Invalidate cache AGAIN right before rendering
    invalidateProgressionDataCache();

    // Refresh notation
    window.refreshNotationFromProgression();

    // Render BOTH containers
    renderProgressionDisplay('progression-visualization', true);
    renderProgressionDisplay('melody-progression-visualization', false);
}, 100);
```

## What's Broken (Unified Recommendations Modal Harmonize Tab)
**File: `src/modules/ui/recommendations/UnifiedRecommendationModal.js` lines 5617-5730**

The harmonize apply button has its own implementation that doesn't work correctly.

## Architecture Overview

### Data Flow
1. **progressionData** - Array of chord objects with root, type, inversion, notes, etc.
2. **compositionState** - Single source of truth, stores `storedProgressionData` and `measures`
3. **trainerState** - UI state, delegates `getProgressionData()` to compositionState with caching
4. **Chord Cards** - Rendered by `renderProgressionDisplay()` which reads from `getTrainerState().progressionData`

### Key Files
- `src/modules/state/compositionState.js` - Main state, has `syncWithProgressionData()` and `exportToProgressionData()`
- `src/modules/state/trainerState.js` - UI state with cache for progressionData
- `src/modules/features/progressionBuilder.js` - Has `renderProgressionDisplay()` function
- `src/modules/ui/recommendations/UnifiedRecommendationModal.js` - The broken harmonize apply

### Cache System
**File: `src/modules/state/trainerState.js` lines 47-85**
```javascript
let cachedProgressionData = null;
let cachedMeasuresLength = 0;
let cachedMeasuresHash = null;

function generateMeasuresHash(measures) {
    // Creates hash from measure chord data including type
    const chordParts = measures.map((m, i) => {
        const chord = m?.chord;
        return `${i}:${chord?.root || ''}${chord?.type || ''}${chord?.inversion || 0}`;
    });
    return `${measures.length}-${chordParts.join('|')}`;
}

export function getProgressionData() {
    const compositionState = window.getCompositionState();
    const currentMeasuresHash = generateMeasuresHash(compositionState.measures);

    // Only re-export if measures have changed
    if (cachedProgressionData === null ||
        cachedMeasuresLength !== currentMeasuresLength ||
        cachedMeasuresHash !== currentMeasuresHash) {
        cachedProgressionData = compositionState.exportToProgressionData();
        // ... update cache
    }
    return cachedProgressionData;
}

export function invalidateProgressionDataCache() {
    cachedProgressionData = null;
    cachedMeasuresLength = 0;
    cachedMeasuresHash = null;
}
```

## The Problem

When harmonize changes are applied in UnifiedRecommendationModal:

1. `syncWithProgressionData(newProgressionData)` is called - updates compositionState
2. `setProgressionData(newProgressionData)` is called - this ALSO calls syncWithProgressionData internally
3. `invalidateProgressionDataCache()` is called
4. `renderProgressionDisplay()` is called

But the chord cards don't update. The data seems correct (logs show correct chord types), but the UI doesn't reflect it.

## Debugging Observations

Console logs show:
- `[buildChordSegments] Building from progressionData: (4) ['C Major 7th', 'G Major', ...]` - Data IS correct
- `[syncWithProgressionData] Saved existing bass pitches: (4) [Array(3), ...]` - Old bass preserved
- Chord cards still show old chord type

## What Needs to Happen

The `renderProgressionDisplay()` function needs to:
1. Get fresh data from `getTrainerState().progressionData`
2. Rebuild the chord card DOM elements with the new data
3. Display the updated chord types

## Relevant Code Sections to Examine

### renderProgressionDisplay function
**File: `src/modules/features/progressionBuilder.js` line 7539**
```javascript
export function renderProgressionDisplay(containerId = 'progression-visualization', syncBothTabs = true) {
    // ...
    const trainerState = getTrainerState();
    // Uses trainerState.progressionData to render cards
    // ...
}
```

### getTrainerState function
**File: `src/modules/state/trainerState.js` line 440**
```javascript
export function getTrainerState() {
    return {
        progressionData: getProgressionData(), // This uses the cache!
        // ...
    };
}
```

### Chord Card Creation
**File: `src/modules/features/progressionBuilder.js`**
- `renderFlatCards()` - Creates card elements
- `createChordCardWrapper()` - Creates individual card wrapper
- `createSimplifiedCardStructure()` - Creates the simplified card HTML

## Questions to Investigate

1. Is `getProgressionData()` returning stale cached data even after `invalidateProgressionDataCache()`?
2. Is `renderProgressionDisplay()` actually being called?
3. Is the DOM being updated but visually not changing?
4. Is there a timing issue where the cache is rebuilt before rendering?
5. Is `compositionState.measures` not being updated correctly with the new chord types?

## Suggested Fix Approach

Compare the exact execution flow between:
1. `addToProgressionData()` (works)
2. The harmonize apply in UnifiedRecommendationModal (broken)

Find the difference and make the broken one match the working one exactly.
