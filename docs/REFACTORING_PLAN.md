# REFACTORING_PLAN.md

**Purpose:** Proposed refactoring plan for large, monolithic files to improve maintainability.

**Last Updated:** 2025-12-26

---

## 🎯 EXECUTIVE SUMMARY

The codebase has 3 files exceeding 10,000 lines and several others exceeding 4,000 lines. While the code is functional, these large files create maintenance challenges:

- **Difficult navigation:** Finding specific functionality requires scrolling through thousands of lines
- **Merge conflicts:** Large files increase risk of conflicts in team development
- **Testing complexity:** Hard to unit test when responsibilities are mixed
- **Circular dependencies:** Large files tend to import from many modules

**Top 5 Largest Files:**
1. `progressionBuilder.js` - 17,453 lines
2. `UnifiedRecommendationModal.js` - 15,489 lines
3. `main.js` - 8,407 lines
4. `noteEditor.js` - 7,387 lines
5. `compositionState.js` - 6,474 lines

**Recommended Approach:** Incremental refactoring with clear module boundaries and comprehensive testing between steps.

---

## 🔴 PRIORITY 1: progressionBuilder.js (17,453 lines)

**File:** [src/modules/features/progressionBuilder.js](../src/modules/features/progressionBuilder.js)

### Current Responsibilities (Too Many!)

This file currently handles:
1. **UI Rendering** - Chord card HTML generation
2. **State Management** - Progression data updates
3. **Event Handling** - User interactions (click, drag, drop)
4. **Playback Control** - Audio playback scheduling
5. **Modal Coordination** - Opening recommendation/analysis modals
6. **Export Functionality** - PDF/MIDI export
7. **Template Management** - Loading progression templates
8. **Drag-and-Drop** - SortableJS integration
9. **Theory Analysis** - Pattern detection triggers
10. **Window Exports** - Massive window.* export list

### Proposed Refactoring

**Split into 6 focused modules:**

```
features/progressionBuilder/
├── index.js (300 lines)
│   - Main entry point
│   - Coordinates sub-modules
│   - Minimal window exports
│
├── ProgressionRenderer.js (2,500 lines)
│   - Chord card HTML generation
│   - Card update/refresh logic
│   - Visual styling
│   - EXPORTS: renderChordCard(), updateCardAtIndex(), renderProgression()
│
├── ProgressionController.js (3,000 lines)
│   - State updates (add/remove/swap chords)
│   - Delegates to compositionState
│   - Business logic for progression manipulation
│   - EXPORTS: addChord(), removeChord(), swapChords(), updateChord()
│
├── ProgressionPlayback.js (2,000 lines)
│   - Audio playback scheduling
│   - Metronome integration
│   - Playback state management
│   - EXPORTS: playProgression(), stopPlayback(), toggleMetronome()
│
├── ProgressionDragDrop.js (1,500 lines)
│   - SortableJS integration
│   - Drag-and-drop event handlers
│   - Reorder logic
│   - EXPORTS: initializeDragDrop(), handleReorder()
│
├── ProgressionModals.js (1,200 lines)
│   - Modal coordination (recommendations, analysis, templates)
│   - Modal open/close logic
│   - Data preparation for modals
│   - EXPORTS: openRecommendationsModal(), openAnalysisModal()
│
└── ProgressionExport.js (1,000 lines)
    - PDF export
    - MIDI export
    - Template save/load
    - EXPORTS: exportToPDF(), exportToMIDI(), saveAsTemplate()
```

### Migration Strategy

**Phase 1:** Extract ProgressionPlayback (lowest risk)
- Move playback functions to separate file
- Update imports in progressionBuilder.js
- Test playback functionality
- **Risk:** Low (playback is independent)

**Phase 2:** Extract ProgressionExport
- Move export functions to separate file
- Test all export formats
- **Risk:** Low (export is one-way operation)

**Phase 3:** Extract ProgressionModals
- Move modal coordination logic
- Test all modal interactions
- **Risk:** Medium (modals interact with many systems)

**Phase 4:** Extract ProgressionRenderer
- Move HTML generation to separate file
- Test visual rendering
- **Risk:** Medium (rendering is core functionality)

**Phase 5:** Extract ProgressionDragDrop
- Move SortableJS integration
- Test reordering
- **Risk:** Medium (affects state updates)

**Phase 6:** Extract ProgressionController
- Move state update logic
- Update index.js to coordinate
- **Risk:** High (core state management)

**Phase 7:** Create index.js coordinator
- Minimal re-exports
- Clear module initialization
- **Risk:** Low (just wiring)

### Expected Benefits

- **Maintainability:** Each module has single responsibility
- **Testing:** Can unit test each module independently
- **Navigation:** Find functionality quickly by module name
- **Reusability:** Renderer could be used by other tabs
- **Team Development:** Reduced merge conflicts

---

## 🔴 PRIORITY 2: UnifiedRecommendationModal.js (15,489 lines)

**File:** [src/modules/ui/recommendations/UnifiedRecommendationModal.js](../src/modules/ui/recommendations/UnifiedRecommendationModal.js)

### Current Responsibilities

This massive modal handles:
1. **Recommendation Display** - Grid/list of chord suggestions
2. **Filtering** - By function, tension, color, style
3. **Sorting** - By score, voice leading, etc.
4. **Chord Preview** - Audio playback
5. **Theory Explanations** - "Why This Works" integration
6. **Progression Context** - Previous/next chord analysis
7. **Voice Leading Visualization** - Graphical voice leading
8. **Mood/Style Selection** - Style-based filtering
9. **Tension Arc Visualization** - Harmonic tension graphs
10. **Multiple Recommendation Engines** - Coordinates 3+ engines

### Proposed Refactoring

**Split into UI components + logic modules:**

```
ui/recommendations/
├── UnifiedRecommendationModal.js (1,500 lines)
│   - Main modal shell
│   - Component coordination
│   - EXPORTS: showRecommendationModal(), hideRecommendationModal()
│
├── components/
│   ├── RecommendationGrid.js (2,000 lines)
│   │   - Grid display of suggestions
│   │   - Card rendering
│   │
│   ├── RecommendationFilters.js (1,500 lines)
│   │   - Filter UI (function, tension, color, style)
│   │   - Filter state management
│   │
│   ├── RecommendationSort.js (800 lines)
│   │   - Sort controls
│   │   - Sort algorithms
│   │
│   ├── ChordPreviewPlayer.js (1,000 lines)
│   │   - Audio preview playback
│   │   - Progression playback
│   │
│   ├── TheoryExplanationPanel.js (2,000 lines)
│   │   - "Why This Works" display
│   │   - Contextual theory
│   │
│   ├── VoiceLeadingVisualizer.js (1,500 lines)
│   │   - Voice leading graphs
│   │   - Visual indicators
│   │
│   └── TensionArcDisplay.js (1,200 lines)
│       - Tension graph rendering
│       - Arc visualization
│
└── logic/
    ├── RecommendationAggregator.js (1,500 lines)
    │   - Coordinates multiple engines
    │   - Merges results
    │
    ├── RecommendationScorer.js (1,000 lines)
    │   - Scoring algorithms
    │   - Ranking logic
    │
    └── RecommendationFilter.js (1,000 lines)
        - Filter application
        - Search logic
```

### Migration Strategy

**Phase 1:** Extract RecommendationAggregator (logic layer)
- Move engine coordination to separate file
- Test recommendation generation
- **Risk:** Medium

**Phase 2:** Extract smaller components (low coupling)
- ChordPreviewPlayer
- TensionArcDisplay
- **Risk:** Low

**Phase 3:** Extract larger components
- RecommendationGrid
- RecommendationFilters
- **Risk:** Medium

**Phase 4:** Extract theory components
- TheoryExplanationPanel
- VoiceLeadingVisualizer
- **Risk:** Medium

**Phase 5:** Refactor main modal to coordinate components
- Wire components together
- Test full modal flow
- **Risk:** High

### Expected Benefits

- **Component Reusability:** Components could be used in other UIs
- **Faster Development:** Smaller files easier to modify
- **Better Testing:** Test each component independently
- **Performance:** Could lazy-load components

---

## 🟡 PRIORITY 3: main.js (8,407 lines)

**File:** [src/main.js](../src/main.js)

### Current Responsibilities

This file is the "catch-all" for:
1. **Window Exports** - 100+ functions exported to window
2. **Initialization** - App startup logic
3. **Event Handlers** - Global event listeners
4. **Module Imports** - Imports from 50+ modules

### Proposed Refactoring

**Split into focused initialization modules:**

```
src/
├── main.js (500 lines)
│   - Minimal entry point
│   - Calls initialization modules
│   - DOMContentLoaded handler
│
├── init/
│   ├── windowExports.js (3,000 lines)
│   │   - All window.* assignments
│   │   - Organized by module
│   │   - GOAL: Reduce over time
│   │
│   ├── globalEventHandlers.js (1,500 lines)
│   │   - Document-level event listeners
│   │   - Keyboard shortcuts
│   │
│   ├── moduleInitialization.js (2,000 lines)
│   │   - Initialize audio
│   │   - Initialize notation
│   │   - Initialize state
│   │
│   └── appSetup.js (1,000 lines)
│       - Dark mode
│       - Load saved state
│       - Set initial UI state
│
└── modules/
    (existing modules)
```

### Migration Strategy

**Phase 1:** Extract windowExports.js
- Move all window.* assignments
- Group by module
- **Risk:** Low (just moving code)

**Phase 2:** Extract moduleInitialization.js
- Move init calls
- **Risk:** Low

**Phase 3:** Extract globalEventHandlers.js
- Move event listeners
- **Risk:** Medium (event timing matters)

**Phase 4:** Extract appSetup.js
- Move setup logic
- **Risk:** Low

**Phase 5:** Slim down main.js to minimal entry point
- Call initialization modules
- **Risk:** Low

### Long-Term Goal: Eliminate Window Exports

**Strategy:** Gradually migrate from `window.*` to proper imports

**Example:**
```javascript
// CURRENT (bad):
// HTML: onclick="window.addChord()"
window.addChord = addChord;

// FUTURE (good):
// HTML: data-action="addChord"
document.addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  if (action === 'addChord') addChord();
});
```

---

## 🟡 PRIORITY 4: noteEditor.js (7,387 lines)

**File:** [src/modules/notation/noteEditor.js](../src/modules/notation/noteEditor.js)

### Current Responsibilities

1. **Note Placement** - Click-to-place notes on staff
2. **Note Editing** - Modify duration, pitch, accidental
3. **Note Deletion** - Remove notes
4. **Selection Management** - Track selected notes
5. **Toolbar Integration** - Duration/accidental buttons
6. **Keyboard Shortcuts** - Note input via keyboard
7. **Voice Management** - Handle multiple voices
8. **Measure Operations** - Split, merge measures
9. **Shift Operations** - Move notes across measures

### Proposed Refactoring

**Split into focused editor modules:**

```
notation/noteEditor/
├── index.js (300 lines)
│   - NoteEditor class (main API)
│   - Coordinates sub-modules
│
├── NotePlacement.js (1,500 lines)
│   - Click-to-place logic
│   - Staff position calculation
│   - Note creation
│
├── NoteSelection.js (1,000 lines)
│   - Selection state
│   - Multi-select
│   - Selection rendering
│
├── NoteModification.js (1,500 lines)
│   - Change duration
│   - Change pitch
│   - Change accidental
│
├── MeasureOperations.js (1,200 lines)
│   - Split measures
│   - Merge measures
│   - Measure boundary handling
│
├── ShiftOperations.js (1,000 lines)
│   - Move notes left/right
│   - Cross-measure movement
│   - Beat calculations
│
└── KeyboardInput.js (1,000 lines)
    - Keyboard shortcuts
    - MIDI input (if applicable)
    - Input mode management
```

### Migration Strategy

**Phase 1:** Extract KeyboardInput (independent)
- Move keyboard handler logic
- **Risk:** Low

**Phase 2:** Extract ShiftOperations
- Move shift logic (already documented in SHIFT_OPERATIONS_IMPLEMENTATION_GUIDE.md)
- **Risk:** Low

**Phase 3:** Extract MeasureOperations
- Move measure split/merge
- **Risk:** Medium

**Phase 4:** Extract NoteModification
- Move edit functions
- **Risk:** Medium

**Phase 5:** Extract NotePlacement
- Move placement logic
- **Risk:** Medium

**Phase 6:** Extract NoteSelection
- Move selection logic
- **Risk:** High (many interactions)

**Phase 7:** Refactor index.js to coordinate
- Wire sub-modules
- **Risk:** High

---

## 🟢 PRIORITY 5: compositionState.js (6,474 lines)

**File:** [src/modules/state/compositionState.js](../src/modules/state/compositionState.js)

### Current Responsibilities

This file is actually **well-organized** despite its size:
1. **Measure Management** - Add/remove/update measures
2. **Chord Management** - Update chord properties
3. **Note Management** - Add/remove/update notes
4. **Bass Management** - Auto-generation + ChordSegments
5. **Settings Management** - Key, tempo, time signature
6. **Import/Export** - Multiple format support
7. **Event Emission** - EventEmitter pattern

### Analysis

**This file does NOT need major refactoring** because:
- Clear single responsibility (state management)
- Well-documented functions
- Logical grouping of related operations
- EventEmitter pattern works well

### Minor Improvements (Optional)

**Could extract to sub-modules if desired:**

```
state/compositionState/
├── index.js (1,500 lines)
│   - Main CompositionState class
│   - Measure/chord/note CRUD
│
├── BassNoteStore.js (2,000 lines)
│   - ChordSegment management
│   - Bass auto-generation
│   - Edited note tracking
│
├── TimeSignatureManager.js (1,000 lines)
│   - Time signature changes
│   - Note redistribution
│   - Duration calculations
│
└── FormatConverters.js (1,500 lines)
    - Import/export functions
    - Format migrations
```

**Recommendation:** **Leave as-is** unless team prefers smaller files. The current structure is maintainable.

---

## 📊 REFACTORING IMPACT SUMMARY

| File | Current Lines | Proposed Modules | Estimated Lines per Module | Priority |
|------|---------------|------------------|----------------------------|----------|
| progressionBuilder.js | 17,453 | 7 modules | 300-3,000 | HIGH |
| UnifiedRecommendationModal.js | 15,489 | 12 modules | 800-2,000 | HIGH |
| main.js | 8,407 | 5 modules | 500-3,000 | MEDIUM |
| noteEditor.js | 7,387 | 7 modules | 300-1,500 | MEDIUM |
| compositionState.js | 6,474 | Keep as-is (or 4 modules) | 1,000-2,000 | LOW |

---

## 🚀 IMPLEMENTATION ROADMAP

### Month 1: High-Priority Files

**Week 1-2:** progressionBuilder.js
- Extract ProgressionPlayback.js
- Extract ProgressionExport.js
- Test thoroughly

**Week 3-4:** progressionBuilder.js (continued)
- Extract ProgressionModals.js
- Extract ProgressionRenderer.js
- Test

### Month 2: High-Priority Files (continued)

**Week 1-2:** progressionBuilder.js (final)
- Extract ProgressionDragDrop.js
- Extract ProgressionController.js
- Create index.js
- Full regression test

**Week 3-4:** UnifiedRecommendationModal.js
- Extract RecommendationAggregator.js
- Extract smaller components (ChordPreviewPlayer, TensionArcDisplay)
- Test

### Month 3: Medium-Priority Files

**Week 1-2:** UnifiedRecommendationModal.js (continued)
- Extract remaining components
- Refactor main modal
- Test

**Week 3-4:** main.js
- Extract windowExports.js
- Extract moduleInitialization.js
- Test

### Month 4: Cleanup & Testing

**Week 1-2:** noteEditor.js
- Extract KeyboardInput.js
- Extract ShiftOperations.js
- Test

**Week 3-4:** Final polish
- Update documentation
- Performance testing
- Address any issues

---

## ✅ REFACTORING CHECKLIST

For each file refactor:

### Before Refactoring
- [ ] Create feature branch
- [ ] Document current functionality
- [ ] Write/update tests
- [ ] Take performance baseline
- [ ] Review with team

### During Refactoring
- [ ] Extract one module at a time
- [ ] Update imports
- [ ] Run tests after each extraction
- [ ] Update documentation
- [ ] Commit after each successful extraction

### After Refactoring
- [ ] Full regression test
- [ ] Performance comparison
- [ ] Update MODULE_INDEX.md
- [ ] Update API_REFERENCE.md
- [ ] Code review
- [ ] Merge to main

---

## 🎯 SUCCESS METRICS

**Quantitative:**
- Largest file < 5,000 lines
- Average file size < 1,000 lines
- Test coverage > 70% (if adding tests)
- No performance regression

**Qualitative:**
- Easier to find functionality
- Fewer merge conflicts
- Faster onboarding for new developers
- Clearer module boundaries

---

## ⚠️ RISKS & MITIGATION

### Risk 1: Breaking Changes
**Mitigation:**
- Refactor incrementally
- Test after each extraction
- Keep old code temporarily during migration

### Risk 2: Performance Regression
**Mitigation:**
- Benchmark before/after
- Profile hot paths
- Optimize if needed

### Risk 3: Merge Conflicts (if team is active)
**Mitigation:**
- Communicate refactoring plan
- Coordinate timing
- Use feature flags for gradual rollout

### Risk 4: Introduced Bugs
**Mitigation:**
- Write tests before refactoring
- Full regression test suite
- Beta testing period

---

## 📚 RELATED DOCUMENTS

- [MODULE_INDEX.md](MODULE_INDEX.md) - Update after refactoring
- [API_REFERENCE.md](API_REFERENCE.md) - Update function locations
- [DEAD_CODE_AUDIT.md](DEAD_CODE_AUDIT.md) - Remove dead code first
- [CLAUDE.md](../CLAUDE.md) - Update architecture overview

---

**Recommendation:** Start with progressionBuilder.js refactoring as it will have the highest impact on maintainability. The other files can be refactored as time permits.
