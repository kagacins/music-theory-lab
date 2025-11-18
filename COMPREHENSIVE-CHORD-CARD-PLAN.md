# Comprehensive Chord Card Enhancement Plan

## Goal
Create fully-featured detailed chord cards in the Progression Builder that match the Melody Composer's 300+ line comprehensive cards.

## Current Features ✅
- Chord symbol and roman numeral display
- Chord type selector dropdown
- Note checkboxes for RH voicing
- All/None buttons for RH notes
- Inversion buttons (R, 1, 2, 3)
- LH pattern selector dropdown
- Play and Delete buttons
- Collapse button

## Missing Features to Add ❌

### 1. Top Control Buttons Row
- **Play Button** ✅ (already exists, move to top)
- **Staff Notation Toggle** ❌ (show/hide musical notation)
- **Suggestions Button** ❌ (open chord recommendations sidebar)

### 2. RH (Right Hand) Controls
- **RH Octave Shift** ❌ (+12, 0, -12 buttons or slider)
- Scale note indicators ❌ (show which notes are in the scale)

### 3. LH (Left Hand) Controls
- **LH Pattern** ✅ (already exists)
- **LH Inversion** ❌ (R, 1, 2, 3 buttons like RH)
- **LH Octave Shift** ❌ (+12, 0, -12 buttons or slider)
- **LH Voicing Checkboxes** ❌ (select which LH notes to play)
- **LH All/None buttons** ❌

### 4. Staff Notation
- **Canvas for musical notation** ❌ (VexFlow rendering)
- **Toggle to show/hide** ❌

## Implementation Plan

### Phase 1: Enhanced Card Structure
Create new `createComprehensiveDetailedCardHTML()` function with organized sections:
```
┌─────────────────────────────────────────────┐
│ Header: Chord Symbol + Function + Controls  │
├─────────────────────────────────────────────┤
│ Top Buttons: [Play] [Notation] [Suggest]   │
├─────────────────────────────────────────────┤
│ Chord Type Selector                         │
├─────────────────────────────────────────────┤
│ RH SECTION                                  │
│ - Octave Shift: [-12] [0] [+12]            │
│ - Note Checkboxes with scale indicators    │
│ - [All] [None] buttons                      │
│ - Inversion: [R] [1] [2] [3]               │
├─────────────────────────────────────────────┤
│ LH SECTION                                  │
│ - Pattern Selector                          │
│ - Octave Shift: [-12] [0] [+12]            │
│ - Inversion: [R] [1] [2] [3]               │
│ - Note Checkboxes                           │
│ - [All] [None] buttons                      │
├─────────────────────────────────────────────┤
│ Staff Notation Canvas (collapsible)         │
├─────────────────────────────────────────────┤
│ Footer: [Collapse] Button                   │
└─────────────────────────────────────────────┘
```

### Phase 2: State Management
Add to chord data structure:
```javascript
{
  // Existing
  root, type, inversion, notes, omittedNotes,
  lhType, lhInversion,

  // NEW
  octaveShift: 0,           // RH octave shift (-12, 0, +12)
  lhOctaveShift: -12,       // LH octave shift (default 1 octave lower)
  lhNotes: [],              // Array of LH notes
  lhOmittedNotes: [],       // LH notes to exclude
  showStaffNotation: false  // Toggle for notation canvas
}
```

### Phase 3: Helper Functions
```javascript
// Generate LH notes based on pattern, inversion, and chord
function generateLHNotes(chord, lhType, lhInversion, octaveShift) {
  // Returns array of note strings
}

// Get scale notes for highlighting
function getScaleNotes(key) {
  // Returns array of note names in the scale
}

// Toggle staff notation visibility
function toggleStaffNotation(chordIndex) {
  // Show/hide VexFlow canvas
}

// Render staff notation
function renderStaffNotation(chord, canvas) {
  // Use VexFlow to draw notation
}
```

### Phase 4: Event Handlers
```javascript
// RH Octave Shift
function updateRHOctaveShift(index, shift) {
  const chord = getChord(index);
  chord.octaveShift = shift;
  regenerateNotesWithOctaveShift(chord);
  updateCard(index);
}

// LH Inversion
function updateLHInversion(index, inversion) {
  const chord = getChord(index);
  chord.lhInversion = inversion;
  regenerateLHNotes(chord);
  updateCard(index);
}

// LH Octave Shift
function updateLHOctaveShift(index, shift) {
  const chord = getChord(index);
  chord.lhOctaveShift = shift;
  regenerateLHNotes(chord);
  updateCard(index);
}

// LH Note Toggle
function toggleLHNote(index, note) {
  const chord = getChord(index);
  if (!chord.lhOmittedNotes) chord.lhOmittedNotes = [];

  const idx = chord.lhOmittedNotes.indexOf(note);
  if (idx > -1) {
    chord.lhOmittedNotes.splice(idx, 1);
  } else {
    chord.lhOmittedNotes.push(note);
  }
}

// Open Suggestions Sidebar
function openChordSuggestions(index) {
  // Trigger unified suggestions panel
  if (window.showChordRecommendations) {
    const chord = getChord(index);
    window.showChordRecommendations(chord, index);
  }
}
```

## Code Structure

### File Organization
- **progressionBuilder.js**: Update `createDetailedCardHTML()`
- **progressionBuilder.js**: Add new event handlers
- **progressionBuilder.js**: Add helper functions for LH generation

### Estimated Lines of Code
- Enhanced HTML template: ~200 lines
- Event handlers: ~100 lines
- Helper functions: ~150 lines
- **Total: ~450 lines** (matching Melody Composer's scope)

## Visual Design

### Color Scheme
- **RH Section**: Blue border/background tint
- **LH Section**: Green border/background tint
- **Active buttons**: Indigo (primary)
- **Scale notes**: Yellow highlight indicator
- **Disabled notes**: Gray

### Compact Layout
- Use Tailwind's grid system
- 2-column layout where possible
- Collapsible sections for advanced controls
- Small text (`text-[10px]`) for labels
- Icons instead of text where possible

## Testing Checklist
- [ ] All RH controls update notes correctly
- [ ] RH octave shift transposes notes
- [ ] LH pattern generates correct notes
- [ ] LH inversion works independently of RH
- [ ] LH octave shift works correctly
- [ ] LH note checkboxes toggle correctly
- [ ] Staff notation renders when toggled
- [ ] Suggestions button opens sidebar
- [ ] Play button plays both RH and LH
- [ ] All state persists across expand/collapse

## Integration with Melody Composer
Once complete, this same card can be used in:
1. **Progression Builder** (current focus)
2. **Melody Composer Tab** (replace existing cards)
3. **Unified Suggestions Panel** (consistent UX)

## Next Steps
1. Implement comprehensive HTML template
2. Add state management for new fields
3. Implement event handlers
4. Add helper functions for LH generation
5. Integrate staff notation toggle
6. Test thoroughly
7. Document for future maintainers
