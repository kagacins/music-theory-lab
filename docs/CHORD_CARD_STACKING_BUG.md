# Chord Card Stacking Bug - Position-Based Insertion

## Problem Summary

When inserting a chord at a specific position (not at the end) in the progression, two chord cards visually stack on top of each other instead of the grid properly flowing all cards into separate cells.

## Steps to Reproduce

1. Have a progression with 4 chords (e.g., C Major, G Major, A Minor, F Major)
2. Select chord at index 2 (A Minor)
3. Use the floating suggestions panel to add a new chord (e.g., A Minor 6th)
4. The new chord should be inserted at index 3, with F Major moving to index 4
5. **Expected**: 5 chord cards displayed in a grid
6. **Actual**: Only 4 chord cards visible - the new chord (index 3) and old chord (now index 4) are stacked on top of each other

## Observed Behavior

- When hovering over tooltips on cards 0-2, the 4th visible card sometimes changes (showing the card that was hidden behind)
- When deleting the "4th" visible card, the other stacked card becomes visible
- This suggests both cards ARE in the DOM but are positioned at the same grid location

## Technical Details

### Data Flow (Verified Correct)
```
1. addChordToProgressionByParams() creates updatedProgression with chord inserted at correct position
2. setProgressionData(updatedProgression) syncs to compositionState
3. renderProgressionDisplay() is called
4. renderFlatCards() iterates through progressionData and creates cards in order
5. All 5 cards are created with correct data-chord-index values (0, 1, 2, 3, 4)
```

### Console Log Evidence
```
[renderFlatCards] Chord order: [0]CM, [1]GM, [2]AM, [3]AM, [4]FM
[renderFlatCards] Created card 0: C Major
[renderFlatCards] Created card 1: G Major
[renderFlatCards] Created card 2: A Minor
[renderFlatCards] Created card 3: A Minor 6th
[renderFlatCards] Created card 4: F Major
[renderFlatCards] END - Created 5 cards, grid now has 5 children
```

### The Problem
Despite 5 cards being correctly added to the DOM with correct indices, cards at index 3 and 4 appear at the same visual position. CSS Grid should auto-place them but isn't.

## Key Files

### progressionBuilder.js
- `addChordToProgressionByParams()` - handles position-based insertion (line ~10598)
- `renderFlatCards()` - creates and appends chord cards to grid (line ~2696)
- `createChordCardWrapper()` - creates individual card DOM elements (line ~3609)
- `renderProgressionDisplayForBuilder()` - renders cards for Chord Builder tab (line ~2582)

### chordBuilder.js
- `renderBuilderProgressionCards()` - called to update Chord Builder panel (line ~1826)
- `updateBuilderProgressionPanel()` - triggers re-render when progression changes (line ~1910)

### Containers
- `#builder-progression-visualization` - grid container on Chord Builder tab
- `#progression-visualization` - grid container on Progression Builder tab
- Both use CSS Grid: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2`

## What Has Been Tried

1. **Clearing stale positioning styles** on card wrappers:
```javascript
wrapper.style.gridColumn = '';
wrapper.style.gridRow = '';
wrapper.style.position = '';
wrapper.style.left = '';
wrapper.style.top = '';
wrapper.style.transform = '';
```

2. **Forcing reflow** after adding cards:
```javascript
gridContainer.style.display = 'none';
void gridContainer.offsetHeight;
gridContainer.style.display = '';
void gridContainer.offsetHeight;
```

3. **Setting explicit grid-auto-flow**:
```javascript
container.style.gridAutoFlow = 'row';
```

4. **Overlap detection** - confirmed cards report position (0,0) but this is because container has 0 dimensions at check time (even though user can see cards)

## Clues

1. The container reports `size=0x0` in delayed checks, even though the panel IS visible and user CAN see cards
2. All cards report position (0,0) in checks
3. The issue only happens with position-based insertion (inserting in middle), not when appending to end
4. Cards 3 and 4 are both in the DOM with correct indices
5. The "winner" of the stacking seems arbitrary - sometimes the new card shows, sometimes the old card

## CSS Classes

Card wrappers have class: `chord-card-wrapper no-animation`

Grid container has classes: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 p-2 bg-white rounded-lg border border-gray-200`

## Questions to Investigate

1. Why does CSS Grid place two items in the same cell?
2. Is there something in SortableJS initialization affecting card positions?
3. Is there a timing issue where grid layout happens before container has dimensions?
4. Could there be multiple render calls interfering with each other?

## Hypothesis

The most likely cause is that when cards are rendered, the container momentarily has 0 dimensions (perhaps during a layout cycle), causing CSS Grid to collapse all items to position (0,0). When the container becomes visible, the grid doesn't recalculate positions for all items.

The fix likely needs to:
1. Ensure container has valid dimensions BEFORE rendering cards
2. OR force grid to recalculate ALL item positions after container becomes visible
3. OR use a different approach to card rendering that doesn't depend on immediate grid layout
