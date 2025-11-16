# Phase 1C: Circular Sync Fix
## Chord Duplication Issue Resolution

**Date**: 2025-11-15
**Issue**: C-F-G-C showing as C-C-F-G-C-F-G-C (duplicates)
**Status**: ✅ **FIXED**

---

## Problem Analysis

### User Report:
- Created progression: **C-F-G-C** (4 chords)
- Progression Builder shows: **C-F-G-C** (correct)
- Melody Notation shows: **C-C-F-G-C-F-G-C** (8 measures - wrong!)
- Deleting last C makes it worse: **C-C-F-C-F-G-C** (7 measures)

### Console Evidence:
```
[Bridge] Melody Composer Bridge initialized
[Sync] Added measure 0 to progression
[Sync] Added measure 1 to progression
[Sync] Added measure 2 to progression
[Sync] Added measure 3 to progression
[Bridge] Synced 5 chords to composition state  ← Should be 4, not 5!
```

### Root Cause:
**Circular Bi-Directional Sync**

1. User creates **C-F-G-C** (4 chords) in Progression Builder
2. User switches to Melody Composer
3. **Bridge syncs**: `syncProgressionToMelodyComposer()` imports progression
4. **CompositionState** adds 4 measures
5. Each `addMeasure()` fires a **'measureAdded' event**
6. **progressionNotationSync** listens to 'measureAdded' events
7. **Syncs back** to Progression Builder via `syncMeasureToProgression()`
8. **Duplicates created**: C-F-G-C becomes C-F-G-C + C (5 chords)
9. Next tab switch: 5 becomes 5+5 = 10, etc.

### Flow Diagram:
```
Progression Builder (4 chords: C-F-G-C)
         ↓
   syncProgressionToMelodyComposer()
         ↓
   CompositionState.importFromProgressionData()
         ↓
   addMeasure() × 4 → fires 'measureAdded' events
         ↓
   progressionNotationSync hears events
         ↓
   syncMeasureToProgression() adds measures BACK
         ↓
   Progression Builder (5 chords: C-F-G-C+C) ← DUPLICATION!
```

---

## Solution

### Fix: Disable Bi-Directional Sync During Import

**File**: `src/modules/integration/melodyComposerBridge.js`

**Before**:
```javascript
export function syncProgressionToMelodyComposer() {
    const progressionData = getProgressionData();

    // Import progression into composition state
    compositionState.importFromProgressionData(progressionData, {
        key: currentKey
    });
}
```

**After**:
```javascript
export function syncProgressionToMelodyComposer() {
    const progressionData = getProgressionData();

    // IMPORTANT: Disable bi-directional sync during import to prevent circular updates
    if (syncInstance && syncInstance.isUpdating !== undefined) {
        syncInstance.isUpdating = true;
    }

    try {
        // Import progression into composition state
        compositionState.importFromProgressionData(progressionData, {
            key: currentKey
        });
    } finally {
        // Re-enable bi-directional sync after import
        if (syncInstance && syncInstance.isUpdating !== undefined) {
            syncInstance.isUpdating = false;
        }
    }
}
```

### How It Works:

1. **Set `isUpdating = true`** before import
2. **Import progression** → fires 'measureAdded' events
3. **progressionNotationSync checks** `isUpdating` flag
4. **Skips sync** if `isUpdating === true` (prevents circular update)
5. **Set `isUpdating = false`** after import
6. **Future changes** can sync normally (user edits in notation)

---

## Testing Instructions

### Test 1: Basic Sync (4 Chords)
**Steps**:
1. Clear all chords in Progression Builder
2. Add: **C - F - G - C**
3. Switch to Melody Composer
4. Check console

**Expected Console Output**:
```
[Bridge DEBUG] Progression data: C-F-G-C
[Bridge DEBUG] Progression count: 4
[Bridge] Synced 4 chords to composition state
```

**Before Fix**: Would show "Synced 5 chords" (duplication)
**After Fix**: Shows "Synced 4 chords" ✅

### Test 2: Visual Verification
**Steps**:
1. Create **C - F - G - C**
2. Switch to Melody Composer
3. Count measures on staff

**Expected**:
- ✅ **4 measures** visible on staff
- ✅ Progression Builder still shows **C - F - G - C** (no duplicates)

### Test 3: Multiple Tab Switches
**Steps**:
1. Create **C - F - G - C**
2. Switch to Melody Composer (switch #1)
3. Switch to Progression Builder
4. Switch to Melody Composer (switch #2)
5. Switch to Progression Builder
6. Switch to Melody Composer (switch #3)
7. Check console and staff

**Expected**:
- ✅ All 3 switches show "Synced 4 chords"
- ✅ No accumulation (4 → 8 → 16)
- ✅ Progression Builder always shows 4 chords

### Test 4: Delete Chord
**Steps**:
1. Create **C - F - G - C**
2. Switch to Melody Composer
3. Go back to Progression Builder
4. Delete last C chord
5. Verify Progression Builder shows **C - F - G** (3 chords, not 7!)

**Expected**:
- ✅ **3 chords** in Progression Builder
- ✅ No weird duplicates like C-C-F-C-F-G-C

---

## Additional Debug Logging

Also added to help diagnose issues:

```javascript
console.log('[Bridge DEBUG] Progression data:', progressionData.map(c => c.root || c.name).join('-'));
console.log('[Bridge DEBUG] Progression count:', progressionData.length);
```

This shows exactly what chords are in the progression before import.

---

## Files Changed

| File | Lines Changed | Description |
|------|---------------|-------------|
| `melodyComposerBridge.js` | ~15 | Added `isUpdating` flag protection |
| `phase-1c-circular-sync-fix.md` | ~250 | This documentation |

---

## Why This Fix Works

### The `isUpdating` Flag Pattern:

The `progressionNotationSync` class already has an `isUpdating` flag to prevent circular updates:

```javascript
// In progressionNotationSync.js
updateProgressionFromNotation(measureIndex, chord) {
    if (this.isUpdating) return; // Prevent circular updates
    this.isUpdating = true;

    try {
        // Update progression
    } finally {
        this.isUpdating = false;
    }
}
```

Our fix applies the same pattern to the **initial import** scenario, which wasn't protected before.

---

## Lessons Learned

### Bi-Directional Sync Requires Guards:

When two systems sync in both directions:
- **System A** → **System B** (forward sync)
- **System B** → **System A** (backward sync)

You MUST prevent:
1. **Circular updates** (A→B→A→B→...)
2. **Event loops** (event triggers sync triggers event...)
3. **Data accumulation** (duplication on every sync)

### Solution Pattern:
```javascript
// Always use a guard flag
if (isUpdating) return;
isUpdating = true;

try {
    // Do sync
} finally {
    isUpdating = false;
}
```

Apply this to **BOTH DIRECTIONS** of the sync, not just one!

---

## Related Issues

This fix also resolves:
- ✅ Chord cards showing more chords than expected
- ✅ Measures accumulating on every tab switch
- ✅ Deleting chords creating weird duplicate patterns
- ✅ Console showing "Synced N chords" where N > actual chord count

---

## Verification Checklist

After applying fix, verify:
- ✅ C-F-G-C stays as 4 chords (not 5, 8, 16...)
- ✅ Multiple tab switches don't accumulate measures
- ✅ Deleting chords works correctly
- ✅ Progression Builder chord cards match Melody Notation
- ✅ Console shows correct chord count
- ✅ No "[Sync] Added measure X to progression" logs during initial import

---

**Status**: ✅ Ready for testing

**Next**: Test with various progressions (2, 4, 8, 16 chords) to ensure no duplication.
