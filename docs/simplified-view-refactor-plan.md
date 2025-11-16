# Simplified View Refactor Plan

## Current Problem
- Simplified cards and detailed cards are mixing in the same sortable container
- Layout is confusing - cards can be dragged into wrong positions
- Too much shown by default

## New Architecture

### Container Structure
```
progression-visualization (main container)
├── pattern-highlights (badges)
├── simplified-chord-sequence
│   ├── simplified-sequence-wrapper
│   │   ├── Card 1 Wrapper
│   │   │   ├── Simplified Card (with expand button)
│   │   │   └── Expanded Controls (hidden by default)
│   │   ├── Card 2 Wrapper
│   │   │   ├── Simplified Card
│   │   │   └── Expanded Controls
│   │   └── ...
│   └── (sortable on wrappers)
├── tension-curve-container
└── detailed-cards-container (HIDDEN BY DEFAULT)
```

### Simplified Card Features
1. **Compact Display:**
   - Drag handle (⋮⋮)
   - Chord symbol (C, Dm7, etc.)
   - Roman numeral (color-coded)
   - Inversion indicator

2. **Quick Actions:**
   - Expand button (▼)
   - Play button (▶)
   - Delete button (×)

3. **Expanded Controls (inline):**
   - Chord Type dropdown
   - Inversion dropdown
   - Voicing dropdown
   - LH pattern selector
   - Close button

### Implementation Steps

1. **Modify renderProgressionDisplay():**
   - Don't render detailed cards by default
   - Keep them as fallback/export option

2. **Refactor renderSimplifiedChordSequence():**
   - Each chord gets a wrapper div
   - Wrapper contains: simplified card + expanded controls
   - Expanded controls hidden by default (max-height: 0)

3. **Add expand/collapse animation:**
   - Smooth height transition
   - Button icon changes (▼ ↔ ▲)
   - Only one expanded at a time (optional)

4. **Update helper functions:**
   - `updateChordType(index, type)`
   - `updateChordInversion(index, inv)`
   - `updateChordVoicing(index, voicing)`

5. **Sortable configuration:**
   - Drag handle on simplified card top
   - Dragging reorders wrappers (not individual cards)
   - Maintains expansion state during drag

## Benefits

1. **Cleaner default view** - Only see what you need
2. **Progressive disclosure** - Advanced controls when needed
3. **Better spatial organization** - No mixing of containers
4. **Tension curve alignment** - Clearer correlation with chords
5. **Easier to understand** - One card = one chord, expandable

## Migration Notes

- Existing detailed card rendering code remains
- Can toggle between simplified/detailed modes if needed
- All state management stays the same
- Backward compatible with existing progressions
