# Dependency Tree Analysis - renderProgressionDisplay Migration

**Date:** 2025-12-27
**Goal:** Migrate renderProgressionDisplay and dependencies using bottom-up approach
**Strategy:** Find leaf functions (no dependencies), migrate those first, then move up the tree

---

## Current Status

✅ **Working via delegation:** New module imports and calls old module's implementation
📍 **Server running:** http://localhost:3002
🎯 **Next step:** Migrate leaf dependencies first

---

## Dependency Tree (Bottom-Up)

### Level 1: Pure Utility Functions (No Dependencies - MIGRATE FIRST)

These functions don't call other progressionBuilder functions. Safe to migrate immediately.

1. **`captureStaffNotationStates()`** (line 1547, ~24 lines)
   - Uses: DOM queries, staffNotationStates Map
   - Dependencies: NONE
   - **Complexity: LOW** ✅

2. **`clearPatternHighlights()`** (line 9161, ~20 lines)
   - Uses: DOM queries
   - Dependencies: NONE
   - **Complexity: LOW** ✅

3. **`getFunctionColors(roman)`** (helper in renderProgressionDisplay)
   - Pure function, returns color strings
   - Dependencies: NONE
   - **Complexity: LOW** ✅

4. **`getChordFunction(roman)`** (helper in renderProgressionDisplay)
   - Pure function, returns function label
   - Dependencies: NONE
   - **Complexity: LOW** ✅

---

### Level 2: Simple Rendering Functions (Few Dependencies)

These call Level 1 functions or use basic utilities.

5. **`createViewModeToggle()`** (line 3595, ~42 lines)
   - Creates toggle UI element
   - Calls: progressionViewMode setter
   - Dependencies: Module state variable
   - **Complexity: LOW** ✅

6. **`createCompactViewModeToggle()`** (line 3643, ~46 lines)
   - Similar to createViewModeToggle
   - Dependencies: Module state variable
   - **Complexity: LOW** ✅

---

### Level 3: Pattern & Chord Rendering

7. **`renderPatternHighlights(container, progressionData, key)`** (line 2726, ~240 lines)
   - Creates pattern highlight badges
   - Calls: HarmonyAnalyzer.analyzeProgression
   - Dependencies: HarmonyAnalyzer (already imported)
   - **Complexity: MEDIUM** ⚠️

8. **`renderFlatCards(gridContainer, progressionData, key, options)`** (line 3459, ~71 lines)
   - Renders simplified chord cards in flat grid
   - Calls: createChordCardWrapper (needs to find/migrate)
   - Dependencies: createChordCardWrapper
   - **Complexity: MEDIUM** ⚠️

---

### Level 4: Section-Aware Rendering

9. **`renderSectionAwareCards(gridContainer, progressionData, key, options)`** (line 4873, ~100 lines)
   - Renders cards grouped by sections
   - Calls: createUnifiedSectionContainer, createChordCardWrapper
   - Dependencies: Section utilities + createChordCardWrapper
   - **Complexity: HIGH** 🔴

10. **`renderSectionViewMode(container, progressionData, key, sections)`** (line 4133, ~209 lines)
    - Renders section picker + filtered cards
    - Calls: buildSectionChipsWithUngrouped, initializeSectionChipsSortable
    - Dependencies: Multiple section utilities
    - **Complexity: HIGH** 🔴

11. **`renderScrollViewMode(gridContainer, progressionData, key, options)`** (line 4667, ~20 lines)
    - Horizontal scrolling layout
    - Calls: renderSectionAwareCardsScroll or renderFlatCardsScroll
    - Dependencies: Scroll variants
    - **Complexity: MEDIUM** ⚠️

---

### Level 5: Notation Sync

12. **`updateNotationForSelectedSections()`** (line 4052, ~73 lines)
    - Updates VexFlow notation for selected sections
    - Calls: window.getCompositionState, window.refreshNotationFromProgression
    - Dependencies: Window globals
    - **Complexity: MEDIUM** ⚠️

---

### Level 6: Main Render Function (TOP OF TREE)

13. **`renderProgressionDisplay(containerId, syncBothTabs)`** (lines 10093-10600, **508 lines**)
    - Calls ALL of the above functions
    - Dependencies: Everything above + many more helpers
    - **Complexity: EXTREMELY HIGH** 🔴🔴🔴

---

## Missing Dependencies to Find

Before migrating, need to locate these functions:

- `createChordCardWrapper()` - Used by renderFlatCards
- `updateCardShifts()` - Used by section rendering
- `buildSectionChipsWithUngrouped()` - Used by renderSectionViewMode
- `createUnifiedSectionContainer()` - Used by renderSectionAwareCards
- `createPseudoSectionContainer()` - Used by section rendering
- `renderSectionAwareCardsScroll()` - Used by renderScrollViewMode
- `renderFlatCardsScroll()` - Used by renderScrollViewMode
- `initializeSectionChipsSortable()` - Already in ProgressionDragDrop.js? (check)
- Various other helpers

---

## Migration Plan (Bottom-Up)

### Phase 1: Migrate Leaf Functions (✅ SAFE)
**Estimated time:** 30 minutes
**Functions:** captureStaffNotationStates, clearPatternHighlights, getFunctionColors, getChordFunction

1. Read each function from original file
2. Copy to ProgressionRenderer.js (before renderProgressionDisplay)
3. No import changes needed (pure utility)
4. Test: No immediate visible changes, but functions available

---

### Phase 2: Migrate Simple UI Functions (✅ SAFE)
**Estimated time:** 30 minutes
**Functions:** createViewModeToggle, createCompactViewModeToggle

1. Read each function
2. Copy to ProgressionRenderer.js
3. Ensure progressionViewMode state variable exists (already does)
4. Test: Toggle functionality should work

---

### Phase 3: Find and Migrate Card Wrappers
**Estimated time:** 1 hour
**Functions:** createChordCardWrapper + related helpers

1. Search for createChordCardWrapper in original file
2. Identify all its dependencies
3. Copy function tree
4. Test: Card rendering should work

---

### Phase 4: Migrate Pattern Highlighting
**Estimated time:** 45 minutes
**Functions:** renderPatternHighlights

1. Already has HarmonyAnalyzer imported
2. Copy 240-line function
3. Test: Pattern badges should appear

---

### Phase 5: Migrate Flat Card Rendering
**Estimated time:** 1 hour
**Functions:** renderFlatCards + dependencies

1. Depends on createChordCardWrapper (done in Phase 3)
2. Copy function
3. Test: Flat card layout should work

---

### Phase 6: Migrate Section Rendering (COMPLEX)
**Estimated time:** 2-3 hours
**Functions:** renderSectionAwareCards, renderSectionViewMode, renderScrollViewMode + all helpers

1. Locate all section utilities
2. Copy entire function tree
3. Test extensively: Section view mode

---

### Phase 7: Migrate updateNotationForSelectedSections
**Estimated time:** 30 minutes
**Functions:** updateNotationForSelectedSections

1. Uses window globals (fine)
2. Copy function
3. Test: Section selection → notation update

---

### Phase 8: Finally Migrate Main Function
**Estimated time:** 1 hour
**Functions:** renderProgressionDisplay

1. All dependencies now migrated
2. Copy 508-line function
3. Replace delegation with real implementation
4. Remove import from old module
5. Test EVERYTHING

---

## Total Estimated Time

**10-12 hours** of focused work, spread across 8 phases

---

## Next Immediate Action

**Start with Phase 1:** Migrate the 4 leaf functions that have zero dependencies.

These are 100% safe to migrate and will reduce the dependency tree immediately.

---

**Last Updated:** 2025-12-27
