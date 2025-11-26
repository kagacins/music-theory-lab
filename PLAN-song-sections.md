# Song Sections Feature - Implementation Plan

## Overview
Add the ability to group chord cards into named song sections (Verse, Chorus, Bridge, etc.) with visual organization, multi-select, drag-and-drop between sections, and copy/paste capabilities.

## Section Types (Core 10)
1. **Intro** - Opening section
2. **Verse** - Main storytelling section
3. **Pre-Chorus** - Builds tension before chorus
4. **Chorus** - Hook/memorable repeated section
5. **Bridge** - Contrasting section
6. **Interlude** - Instrumental break
7. **Solo** - Instrumental feature
8. **Breakdown** - Stripped-down dynamics
9. **Outro** - Ending section
10. **Custom** - User-defined label

## Data Model Changes

### compositionState.js
```javascript
// Add to CompositionState constructor:
this.sections = [];  // Array of section objects

// Section object structure:
{
  id: 'section_1',           // Unique ID
  type: 'verse',             // One of the section types or 'custom'
  label: 'Verse 1',          // Display label (auto-generated or custom)
  chordIndices: [0, 1, 2, 3], // Indices of chords in this section
  color: '#4F46E5',          // Section color for visual distinction
  collapsed: false           // Whether section is collapsed in UI
}
```

### trainerState.js
```javascript
// Add multi-select state:
selectedChordIndices: new Set(),  // Multiple selected chords
lastSelectedIndex: null,          // For shift-click range selection
```

## Implementation Phases

### Phase 1: Data Model & State Management
**Files:** compositionState.js, trainerState.js

1. Add `sections` array to CompositionState
2. Add section CRUD methods:
   - `createSection(type, chordIndices)` - Create new section
   - `updateSection(sectionId, updates)` - Update section properties
   - `deleteSection(sectionId)` - Delete section (chords remain ungrouped)
   - `getSectionForChord(chordIndex)` - Get section containing a chord
   - `moveChordToSection(chordIndex, sectionId)` - Move chord between sections
   - `reorderSections(fromIndex, toIndex)` - Reorder sections
3. Add multi-select state to trainerState:
   - `selectedChordIndices: Set`
   - `addToSelection(index)`, `removeFromSelection(index)`, `clearSelection()`
   - `selectRange(fromIndex, toIndex)` - For shift-click
4. Section color palette (10 distinct colors for visual grouping)

### Phase 2: Section UI Components
**Files:** progressionBuilder.js, music.css

1. Create section wrapper component:
   ```html
   <div class="section-wrapper" data-section-id="section_1">
     <div class="section-header">
       <span class="section-color-bar"></span>
       <span class="section-label">Verse 1</span>
       <button class="section-collapse-btn">▼</button>
       <button class="section-menu-btn">⋮</button>
     </div>
     <div class="section-cards-container">
       <!-- Chord cards go here -->
     </div>
   </div>
   ```

2. Section header with:
   - Colored left border/bar
   - Editable label (click to edit)
   - Collapse/expand toggle
   - Context menu (rename, change type, delete, duplicate)

3. Ungrouped chords area:
   - Cards not in any section render in a neutral "Ungrouped" area
   - Can drag into sections or create new section from selection

4. CSS styling:
   - Section wrapper with colored border
   - Collapse animation
   - Hover states
   - Selection ring styles for multi-select

### Phase 3: Multi-Select Implementation
**Files:** progressionBuilder.js

1. Click handlers:
   - Normal click: Select single card (clear others)
   - Ctrl/Cmd + click: Toggle card in selection
   - Shift + click: Range select from last selected

2. Visual feedback:
   - Purple ring for primary selection (existing)
   - Blue ring for additional selections
   - Selection count indicator

3. Keyboard shortcuts:
   - Ctrl/Cmd + A: Select all in current section
   - Escape: Clear selection
   - Delete: Delete selected chords (with confirmation if multiple)

### Phase 4: Drag-and-Drop Between Sections
**Files:** progressionBuilder.js

1. Configure SortableJS for nested groups:
   ```javascript
   // Section container sortable (reorder sections)
   new Sortable(sectionsContainer, {
     group: 'sections',
     handle: '.section-header',
     // ...
   });

   // Each section's card container (reorder cards, move between sections)
   new Sortable(sectionCardsContainer, {
     group: 'chords',  // Shared group allows cross-section drag
     // ...
   });
   ```

2. Drag behaviors:
   - Single card drag: Move one card
   - Multi-select drag: Move all selected cards together
   - Drop on section: Add to that section
   - Drop on ungrouped area: Remove from section

3. Section expansion on drag-over:
   - Collapsed sections auto-expand when hovering with dragged cards
   - Visual drop indicator

### Phase 5: Section Operations
**Files:** progressionBuilder.js

1. Context menu for sections:
   - Rename section
   - Change section type (dropdown)
   - Duplicate section (copies all chords)
   - Delete section (keeps chords ungrouped)
   - Move section up/down

2. Context menu for selected chords:
   - Create section from selection
   - Add to existing section (submenu)
   - Remove from section
   - Copy selection
   - Paste (after current selection)
   - Delete selection

3. Toolbar buttons:
   - "Add Section" button
   - Section type quick-picker

### Phase 6: Copy/Paste & Duplication
**Files:** progressionBuilder.js, compositionState.js

1. Clipboard operations:
   - Store copied section/chords in memory (not system clipboard)
   - Copy: Store chord data + section info
   - Paste: Insert after current selection or at end

2. Section duplication:
   - Deep copy all chords in section
   - Auto-increment label (Verse 1 → Verse 2)
   - Insert after original section

3. Keyboard shortcuts:
   - Ctrl/Cmd + C: Copy selected chords/section
   - Ctrl/Cmd + V: Paste
   - Ctrl/Cmd + D: Duplicate selection

### Phase 7: Three-Tab Synchronization
**Files:** progressionBuilder.js, chordBuilder.js

1. Sync sections across:
   - Progression Builder (`#progression-visualization`)
   - Melody Composer (`#melody-progression-visualization`)
   - Chord Builder (`#builder-progression-visualization`)

2. Section state included in:
   - `compositionState.exportToProgressionData()`
   - `compositionState.syncWithProgressionData()`

3. Visual consistency:
   - Same colors and labels across all tabs
   - Collapsed state may differ per tab (UI preference)

### Phase 8: Persistence & Export
**Files:** compositionState.js

1. Include sections in save/load:
   - JSON export includes sections array
   - Import reconstructs section groupings

2. Backward compatibility:
   - Old progressions without sections load as "all ungrouped"
   - No breaking changes to existing data

## File Changes Summary

| File | Changes |
|------|---------|
| compositionState.js | Add sections array, section CRUD methods, export/import updates |
| trainerState.js | Add multi-select state (selectedChordIndices, etc.) |
| progressionBuilder.js | Section rendering, drag-drop config, multi-select handlers, context menus |
| chordBuilder.js | Section display in builder tab |
| music.css | Section styling, multi-select visual states |
| index.html | Section toolbar buttons (if needed) |

## UI Mockup (ASCII)

```
┌─────────────────────────────────────────────────────────────┐
│ [+ Add Section]  [Verse ▼] [Chorus ▼] [Bridge ▼]           │
├─────────────────────────────────────────────────────────────┤
│ ┌─ Intro ──────────────────────────────────────────────┐   │
│ │ 🟦 [C]  [Am]  [F]  [G]                               │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─ Verse 1 ────────────────────────────────────────────┐   │
│ │ 🟩 [Am]  [F]  [C]  [G]  [Am]  [F]  [C]  [G]         │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─ Chorus ─────────────────────────────────────────────┐   │
│ │ 🟨 [F]  [G]  [C]  [Am]  [F]  [G]  [C]               │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ ── Ungrouped ──────────────────────────────────────────    │
│    [Dm]  [E7]                                               │
└─────────────────────────────────────────────────────────────┘
```

## Testing Checklist
- [ ] Create section from selected chords
- [ ] Drag single chord between sections
- [ ] Drag multiple selected chords between sections
- [ ] Collapse/expand sections
- [ ] Rename sections
- [ ] Delete section (chords become ungrouped)
- [ ] Duplicate section
- [ ] Copy/paste chords
- [ ] Copy/paste entire section
- [ ] Reorder sections via drag
- [ ] Sync across all three tabs
- [ ] Save/load with sections
- [ ] Load old progression without sections (backward compat)
- [ ] Undo/redo section operations
