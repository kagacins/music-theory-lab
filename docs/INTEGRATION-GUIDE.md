# Integration Guide: Simplified View Refactor

## Files to Update

### 1. progressionBuilder.js
**Location:** Lines 1897-2002

**Action:** Replace the following functions with code from `progressionBuilder-simplified-refactor.js`:
- `renderSimplifiedChordSequence()`
- `initializeSimplifiedSortable()`

**Additionally add these new functions:**
- `createChordCardWrapper()`
- `createSimplifiedCardHTML()`
- `createDetailedCardHTML()`
- `attachCardEventListeners()`
- `expandChordCard()`
- `collapseChordCard()`
- `getChordTypeOptions()`
- `getInversionOptions()`
- `getVoicingOptions()`
- `updateChordType()`
- `updateChordInversion()`
- `updateChordVoicing()`

**Add at top of file:**
```javascript
// Track which chords are expanded (after imports)
const expandedChords = new Set();
```

### 2. highlightPatternChords()
**Update selector on line 2027:**
```javascript
// OLD:
const simplifiedCard = document.querySelector(`[data-simplified-index="${chordIndex}"]`);

// NEW:
const wrapper = document.querySelector(`.chord-card-wrapper[data-chord-index="${chordIndex}"]`);
const simplifiedCard = wrapper?.querySelector('.simplified-card');
```

### 3. initializeSimplifiedSortable()
**Update handle selector on line 1972:**
```javascript
// OLD:
handle: '.simplified-chord-card',

// NEW:
handle: '.drag-handle',
```

## CSS Additions (music.css)

Add these styles for smooth animations:

```css
/* Chord card wrapper transitions */
.chord-card-wrapper {
    transition: width 0.3s ease-out;
}

/* Simplified and detailed card base styles */
.simplified-card,
.detailed-card {
    height: 100%;
}

/* Animation for content swap */
@keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}

.chord-card-wrapper > div {
    animation: fadeIn 0.2s ease-out;
}
```

## Testing Checklist

After integration:
- [ ] Simplified cards render (100px wide)
- [ ] Click "Details" button expands card to 200px
- [ ] Detailed view shows all controls (Type, Inversion, Voicing)
- [ ] Dropdowns work and update chord
- [ ] "Collapse" button returns to simplified view
- [ ] Multiple cards can be expanded at once
- [ ] Drag/drop still works (use drag handle)
- [ ] Play button works in both views
- [ ] Delete button works in both views
- [ ] Tension curve still renders below
- [ ] Pattern highlighting works
- [ ] Horizontal scroll appears when many chords

## Benefits

1. **Clean default view** - Compact, only essentials visible
2. **Progressive disclosure** - Advanced controls on demand
3. **Multiple expansions** - Work on several chords at once
4. **Smooth UX** - Animated transitions, clear feedback
5. **Spatial efficiency** - Horizontal layout with scroll
6. **Better alignment** - Tension curve aligns with simplified cards

## Migration Notes

- Detailed cards no longer render by default in progression-visualization
- Melody tab still uses old detailed view (unaffected)
- All state management unchanged
- Backward compatible with existing progressions
- expandedChords Set tracks which cards are detailed
