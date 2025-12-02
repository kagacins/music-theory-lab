# Bug Fix: New Section Not Created When Adding Chords

## Issue Summary

When users selected "New Section" mode in the Unified Recommendation Modal and added chords (either via Quick suggestions, Explorer, or "Add All" for sequences), the application was not creating the new section. Chords were added to the progression but remained ungrouped.

**Expected Behavior**:
- A new section should be created with the selected type (Verse, Chorus, Bridge, etc.)
- The section should be outlined and highlighted in both chord cards and the Quick Progression picker
- All chords added in that action should be grouped into the new section

**Actual Behavior**:
- Chords were added to the progression
- No section was created
- Chords remained ungrouped

## Root Cause

The `addChordToProgression()` function in `UnifiedRecommendationModal.js` was not checking the section intent state before adding chords. It simply added chords to the progression without considering whether the user had selected "New Section" mode.

### Code Flow Before Fix

```
User clicks "Add" or "Add All"
    ↓
addChordToProgression() called
    ↓
window.addSpecificChordToProgression() adds chord
    ↓
Chord added to progression (no section created)
```

The section intent state (`INTENT_MODES.NEW_SECTION`) was being used for:
- Scoring recommendations differently
- Adjusting tension direction suggestions

But it was NOT being used to actually create sections when chords were added.

## Solution

Modified `addChordToProgression()` to:

1. **Check section intent** before adding the chord
2. **Track progression length** to calculate the new chord's index
3. **Create a new section** when in `NEW_SECTION` mode (for the first chord)
4. **Add subsequent chords to the same section** (for "Add All" sequences)

### Code Flow After Fix

```
User clicks "Add" or "Add All"
    ↓
addChordToProgression() called
    ↓
Check getSectionIntent() - is mode NEW_SECTION?
    ↓
Get progression length before adding
    ↓
window.addSpecificChordToProgression() adds chord
    ↓
Calculate new chord index
    ↓
If NEW_SECTION mode:
    - First chord: compositionState.createSection(type, [chordIndex])
    - Subsequent chords: compositionState.addChordToSection(chordIndex, sectionId)
```

## Files Modified

### `src/modules/ui/recommendations/UnifiedRecommendationModal.js`

#### `addChordToProgression()` function (lines 2048-2124)

Added new logic to handle section creation:

```javascript
function addChordToProgression(rec, rhythmicContext, options = {}) {
    // ... existing duration logic ...

    // Get section intent BEFORE adding chord
    const intent = getSectionIntent();
    const isNewSection = intent.mode === INTENT_MODES.NEW_SECTION;
    const newSectionType = intent.newSectionType || 'verse';

    // Track if this is the first chord of a new section (for "Add All" sequences)
    const isFirstOfNewSection = options.isFirstOfNewSection !== undefined
        ? options.isFirstOfNewSection
        : isNewSection;

    // Get progression length before adding (to calculate new chord index)
    const compositionState = getCompositionState();
    const progressionLengthBefore = compositionState?.getProgressionLength?.() ||
                                     getProgressionData()?.length || 0;

    // ... existing insert position logic ...
    // ... existing chord addition logic ...

    // Calculate the index of the newly added chord
    const newChordIndex = insertAfterIdx >= 0 ? insertAfterIdx + 1 : progressionLengthBefore;

    // If this is a NEW_SECTION and this is the first chord, create the section
    if (isFirstOfNewSection && compositionState?.createSection) {
        compositionState.createSection(newSectionType, [newChordIndex]);
    } else if (isNewSection && !isFirstOfNewSection && compositionState) {
        // For subsequent chords in "Add All", add to the most recent section of this type
        const sections = compositionState.getSections?.() || [];
        const matchingSections = sections.filter(s => s.type === newSectionType);
        if (matchingSections.length > 0) {
            const latestSection = matchingSections[matchingSections.length - 1];
            compositionState.addChordToSection?.(newChordIndex, latestSection.id);
        }
    }

    // ... existing post-add logic ...
}
```

#### "Add All" button handler (lines 2913-2919)

Updated to pass `isFirstOfNewSection` option:

```javascript
addAllBtn.addEventListener('click', () => {
    seq.chords.forEach((chord, idx) => {
        // Only the first chord should trigger new section creation
        // Subsequent chords get added to that section
        addChordToProgression(chord, null, { isFirstOfNewSection: idx === 0 });
    });
});
```

## Behavior Matrix

| Action | New Section Mode | Result |
|--------|------------------|--------|
| Add single Quick suggestion | OFF | Chord added, no section |
| Add single Quick suggestion | ON | Chord added, new section created |
| Add single Explorer chord | OFF | Chord added, no section |
| Add single Explorer chord | ON | Chord added, new section created |
| "Add All" sequence (4 chords) | OFF | 4 chords added, no section |
| "Add All" sequence (4 chords) | ON | 4 chords added, all in new section |

## Testing Checklist

- [ ] Add single chord with "Continue Section" selected - no section created
- [ ] Add single chord with "New Section" > "Verse" selected - Verse section created
- [ ] Add single chord with "New Section" > "Chorus" selected - Chorus section created
- [ ] Use "Add All" on sequence with "New Section" selected - all chords in new section
- [ ] Verify section appears highlighted in chord cards
- [ ] Verify section appears in Quick Progression picker
- [ ] Verify section label matches selected type (Verse, Chorus, etc.)

## Related Components

- `src/modules/state/sectionIntentState.js` - Manages section intent state
- `src/modules/state/compositionState.js` - Contains `createSection()` and `addChordToSection()` methods
- Section UI rendering in chord cards and Quick Progression picker (should auto-update when sections change)

## Date Fixed

December 1, 2025
