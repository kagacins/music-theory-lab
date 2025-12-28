# Placeholder Migration Plan - Phase 1 Refactoring

**Date:** 2025-12-26
**Status:** 🚧 IN PROGRESS - Hybrid Mode Active

---

## Current Status

### ✅ What's Working (Hybrid Mode)

The app is functional using a **hybrid approach**:
- Both old (`progressionBuilder.js`) and new (`progressionBuilder/index.js`) modules loaded
- New implementations override old ones where they exist
- Placeholder functions fall back to original working code via window exports

**Successfully Migrated Functions:**
1. ✅ `addToProgressionData()` - Full ~250-line implementation in ProgressionController.js
2. ✅ `renderProgressionControls()` - Full ~240-line implementation in ProgressionRenderer.js

**All Other Functions (~85):**
- Use original progressionBuilder.js implementation via window object
- New modules contain placeholder stubs that log messages

---

## Why This Happened

The original refactoring approach was flawed:
1. ❌ Created function signatures with `console.log` placeholders
2. ❌ Did NOT move actual code from original file
3. ❌ No incremental testing during extraction
4. ❌ Assumed placeholders would be replaced later

**Result:** 7 well-structured modules with ~85 empty function shells.

---

## Migration Strategy

### Tier 1: Critical Rendering Functions (PRIORITY)

These functions are required for basic app functionality:

#### 1. `renderProgressionDisplay()` (~300 lines)
**File:** ProgressionRenderer.js (placeholder at line 648)
**Original:** progressionBuilder.js lines 10093-10371
**Dependencies:**
- renderSectionViewMode
- renderScrollViewMode
- renderSectionAwareCards
- renderFlatCards
- renderPatternHighlights
- renderEnhancedTensionCurve
- createViewModeToggle
- createCompactViewModeToggle
- captureStaffNotationStates
- clearPatternHighlights
- initializeSimplifiedSortable
- updateNotationForSelectedSections

**Migration Approach:**
- Must migrate ALL helper functions first
- Estimate: ~1500 lines total
- High complexity - deeply interconnected

#### 2. `loadProgression()` (~180 lines)
**File:** ProgressionController.js (placeholder at line 1103)
**Original:** progressionBuilder.js lines 11608-11788
**Dependencies:**
- parseRomanNumeral
- getChordNotes
- updateRomanNumerals
- renderProgressionDisplay (already migrated in step 1)

**Migration Approach:**
- Migrate after renderProgressionDisplay
- Moderate complexity
- Estimate: ~250 lines with helpers

---

### Tier 2: Chord Management Functions

After Tier 1 is complete, migrate core CRUD operations:

1. `removeChordFromProgression()` - Delete chords
2. `clearProgression()` - Clear all chords
3. `updateProgressionEnharmonics()` - Key changes
4. `toggleProgressionNote()` / `toggleProgressionLHNote()` - Note editing

**Estimate:** ~500 lines total

---

### Tier 3: Selection & Multi-Select Functions

User interaction and clipboard operations:

1. `selectChordCard()` / `highlightChordCard()` / `unhighlightAllChordCards()`
2. `expandChordCard()` / `collapseAllChordCards()`
3. `copySelectedChords()` / `pasteChords()` / `duplicateSelectedChords()`
4. `deleteSelectedChords()`

**Estimate:** ~800 lines total

---

### Tier 4: Modal Functions

Complex UI dialogs (lowest priority - already working via old module):

1. `showProgressionChordSuggestions()` - Recommendations modal
2. `showAddSectionMenu()` / `showSectionMenu()` - Section modals
3. `showChangeSectionTypeDialog()` / `showDuplicateSectionDialog()`
4. `deleteSectionAndChords()` - Section deletion

**Estimate:** ~1200 lines total

---

### Tier 5: Playback & Export Functions

Audio and data operations:

1. `handleAutoPlayback()` - Auto-play progression
2. `startStepChord()` / `stopStepChord()` - Step-through mode
3. `importChordList()` - Import from text
4. `openTemplateBrowser()` - Template browser
5. `showRhythmPatternModal()` - Rhythm patterns

**Estimate:** ~1000 lines total

---

### Tier 6: Drag-Drop Functions

Sortable.js integration:

1. `initializeSectionContainerSortable()`
2. `initializeSectionCardsAreaSortables()`
3. `initializeSectionChipsSortable()`
4. `initializeSimplifiedSortable()` (already used by renderProgressionDisplay)

**Estimate:** ~600 lines total

---

## Total Migration Workload

**Estimated Lines to Migrate:** ~6,000 lines
**Functions to Migrate:** ~85 functions
**Current Progress:** 2/87 functions (2.3%)

---

## Migration Process (Per Function)

For each function migration:

1. **Locate in original file** - Find function definition and all helpers
2. **Read full implementation** - Understand dependencies
3. **Identify ALL dependencies** - Other functions, imports, globals
4. **Copy implementation** - Move code to new module file
5. **Fix imports** - Add necessary import statements
6. **Test immediately** - Verify function works in isolation
7. **Update window export** - Enable new implementation in index.js
8. **Test in app** - Verify no regressions
9. **Document completion** - Update this file

---

## Current Blocker Resolution

**User Question:** "Does this create any value in the refactor?"

**Answer:** Yes, the hybrid approach creates value as a **migration path**:

✅ **Immediate Value:**
- App is working NOW (no extended downtime)
- Module structure is correct
- Can migrate incrementally without breaking app

✅ **Long-term Value:**
- Each migrated function reduces dependency on old module
- Eventually can delete the 17,453-line monolithic file
- Better code organization and maintainability

❌ **NOT Valuable:**
- Having placeholders forever
- Loading both modules permanently
- Leaving migration incomplete

---

## Next Steps

1. ✅ Create this migration plan document
2. ⏳ Migrate Tier 1 functions (renderProgressionDisplay + helpers)
3. ⏳ Migrate Tier 1 functions (loadProgression + helpers)
4. ⏳ Test full workflow after Tier 1
5. ⏳ Proceed with Tier 2-6 incrementally
6. ⏳ Remove old module when all functions migrated
7. ⏳ Clean up hybrid loading code

---

## Success Criteria

**Phase 1 Complete When:**
- ✅ All Tier 1 functions migrated
- ✅ All Tier 2 functions migrated
- ✅ App fully functional without old module
- ✅ Old progressionBuilder.js can be deleted
- ✅ No window fallback dependencies remain

**Estimated Timeline:** Tier 1 (critical) should be completed first, then can proceed with remaining tiers incrementally.

---

**Last Updated:** 2025-12-26
**Next Task:** Migrate `renderProgressionDisplay()` and all helper functions (Tier 1, Priority 1)
