# Bass Preservation Implementation Plan

## Problem Statement
When chords are reordered, inserted, or removed, bass edits (pitch, duration, articulation, etc.) are lost or applied to wrong chords because the system matches bass blocks by chord ROOT name instead of unique identity.

## Solution: Chord ID-Based Bass Storage

### Core Concept
Each chord card gets a unique ID. Bass data is stored in a Map keyed by chord ID, not array position. On any structural change, we rebuild measures from the Map, handling tie splitting/combining as needed.

---

## Implementation Tasks

### Phase 1: Add Unique Chord IDs
**Status: COMPLETED**

**File: `src/data/music-data.js`**
- [x] Created `generateChordId()` function - generates `chord_<timestamp>_<counter>` format
- [x] Created `ensureChordId(chord)` helper - adds ID if missing
- [x] Exported both functions

**File: `src/modules/state/compositionState.js`**
- [x] In `syncWithProgressionData()` (line 5077-5082): Added ID generation for chords without IDs
- [x] In `exportToProgressionData()` fallback path (line 5484): Added ID to exported chords

**File: `src/modules/features/progressionBuilder/ProgressionController.js`**
- [x] In `addToProgressionData()` (line 2176-2178): Added `ensureChordId(chordData)` call
- [x] Imported `ensureChordId` from music-data.js

**Test:** Console.log chord IDs after creating progression - each should be unique

---

### Phase 2: Create Bass Data Storage by Chord ID
**Status: COMPLETED**

**File: `src/modules/state/compositionState.js`**

- [x] Add new property to CompositionState (line 922):
```javascript
this.bassDataByChordId = new Map();
```

- [x] Create helper methods (lines 5904-5961):
  - `getBassDataForChord(chordId)` - Get bass data by chord ID
  - `setBassDataForChord(chordId, data)` - Set bass data with notes and userEdited flag
  - `clearBassDataForChord(chordId)` - Remove bass data for a chord
  - `hasUserEditedBass(chordId)` - Check if chord has user-edited bass
  - `getChordIdsWithEditedBass()` - Get all chord IDs with user edits

**Test:** Manually set/get bass data by ID, verify it persists

---

### Phase 3: Update saveEditedBassNotesForMeasure()
**Status: COMPLETED**

**File: `src/modules/state/compositionState.js`**

- [x] Modified `saveEditedBassNotesForMeasure(measureIndex)` (lines 6757-6866) to:
  1. Get chord ID from `measure.chord.id`
  2. Find measures belonging to chord by ID (preferred) or chordIndex (fallback)
  3. Collect all bass notes for this chord across all measures
  4. Store in `bassDataByChordId` Map with `userEdited: true`
  5. Uses `JSON.parse(JSON.stringify())` for deep copy

- [x] Added chord ID propagation to measure.chord (line 5027 in `importFromProgressionData`)

- [x] Updated `projectManager.js` to ensure chord IDs on import:
  - Added `ensureChordId` import from music-data.js
  - Added chord ID generation in `applyProjectToState` for old projects without IDs

**Test:** Edit bass, verify data appears in Map with correct chord ID

---

### Phase 4: Update Rebuild Logic
**Status: COMPLETED**

**File: `src/modules/state/compositionState.js`**

- [x] Created `restoreBassFromChordIds()` method (lines 5977-6033):
  - Gets current progression data with chord IDs
  - Builds a map of chord ID → position info (chordIndex, startBeat, measures)
  - For each chord with user-edited bass data in Map, places notes in correct measures

- [x] Created `_placeBassNotesForChord()` helper (lines 6043-6115):
  - Takes notes with relative beat positions
  - Calculates absolute positions based on chord start beat
  - Clears existing notes for the chord before placing
  - Splits notes that cross measure boundaries with proper ties

- [x] Created `_addBassNoteToMeasure()` helper (lines 6123-6137):
  - Adds note to measure's bass voice 0
  - Ensures notation structure exists
  - Sorts notes by beat position

**Test:** Reorder two different chords, verify bass stays with correct chord

---

### Phase 5: Handle Tie Splitting/Combining
**Status: COMPLETED** (integrated into Phase 4)

**File: `src/modules/state/compositionState.js`**

- [x] Tie splitting implemented in `_placeBassNotesForChord()`:
  - Uses `beatsToDurationCanonical()` and `durationToBeatsCanonical()` from durationUtils.js
  - When note crosses measure boundary, splits into two parts with proper tie flags
  - First part: `tied: true` (ties forward), `isTied: false`
  - Second part: `tied: false`, `isTied: true` (tied from previous)

**Test:**
1. Create 2-beat chord, add half note bass
2. Change chord to 6 beats spanning 2 measures
3. Verify note is split with tie

---

### Phase 6: Update Structural Operations
**Status: COMPLETED**

**File: `src/modules/state/compositionState.js`**

- [x] Updated `reorderChord()` (line 6216-6221):
  - Added call to `restoreBassFromChordIds()` after `renderBassBlocksToMeasures()`
  - User-edited bass data follows chord IDs to new positions

- [x] Updated `insertChord()` (lines 6304-6308):
  - Added call to `restoreBassFromChordIds()` after rendering
  - Existing user edits preserved at shifted positions

- [x] Updated `removeChord()` (lines 6328-6339, 6377-6381):
  - Gets removed chord's ID before deletion
  - Cleans up bass data Map entry for removed chord
  - Calls `restoreBassFromChordIds()` for remaining chords

- [ ] Update `duplicateSection()` - TODO: Copy bass data from original chord IDs to new chord IDs

**Test:** Full workflow - create, edit bass, reorder, insert, remove, verify all works

---

### Phase 7: Update Import/Export
**Status: COMPLETED**

**File: `src/modules/storage/projectManager.js`**

- [x] `createProjectData()` (line 147-150): Added `bassDataByChordId` export
  - Converts Map to plain object using `Object.fromEntries()`
- [x] `applyProjectToState()` (lines 598-603): Added `bassDataByChordId` restore
  - Converts plain object back to Map using `new Map(Object.entries())`
- [x] `applyProjectToState()` (line 395): Added `ensureChordId()` call for imported chords
  - Ensures old projects without chord IDs get IDs generated

**File: `src/data/music-data.js`**
- [x] `ensureChordId()` exported and used in projectManager.js import

**Test:** Save project, reload, verify bass edits preserved with correct chord association

---

### Phase 8: Cleanup
**Status: NOT STARTED**

- [ ] Remove old `BuildingBlockSequence` bass tracking (or repurpose for playback only)
- [ ] Remove root-based matching logic in `syncWithProgressionData()`
- [ ] Remove `userEdited` flag from BuildingBlock class (now in Map)
- [ ] Update CLAUDE.md with new architecture

---

## Files to Modify (Summary)

1. **`src/modules/state/compositionState.js`** - Main changes
2. **`src/modules/features/progressionBuilder/*.js`** - Chord ID assignment
3. **`src/modules/notation/noteEditor.js`** - Reuse tie logic (read-only)
4. **`src/init/projectManager.js`** - Import/export
5. **`src/data/music-data.js`** - ID generation utility
6. **`CLAUDE.md`** - Documentation update

---

## Current Session Progress

### Implementation Status: PHASES 1-7 COMPLETED

All core bass preservation functionality has been implemented:

1. **Phase 1**: Chord ID generation (`generateChordId()`, `ensureChordId()`)
2. **Phase 2**: Bass data storage Map (`bassDataByChordId`)
3. **Phase 3**: Bass editing saves to Map (`saveEditedBassNotesForMeasure()`)
4. **Phase 4**: Bass restoration from Map (`restoreBassFromChordIds()`)
5. **Phase 5**: Tie splitting for notes crossing measure boundaries
6. **Phase 6**: Structural operations (reorder/insert/remove) integrated
7. **Phase 7**: Import/export for .imtl files and community database

### Remaining (Optional):
- **Phase 8**: Cleanup old BuildingBlock-based bass tracking (can coexist for now)
- Update `duplicateSection()` to copy bass data to new chord IDs

### Key Files Modified:
- `src/data/music-data.js` - Chord ID generation utilities
- `src/modules/state/compositionState.js` - Bass data Map and restoration logic
- `src/modules/storage/projectManager.js` - Import/export for bass data Map
- `src/modules/features/progressionBuilder/ProgressionController.js` - Ensure chord IDs on add

---

## Testing Checklist

- [ ] Create progression: C, G, C (two C chords)
- [ ] Edit bass of first C (change duration to half note)
- [ ] Drag first C to position 3 (after second C)
- [ ] Verify: edited bass is now in position 3, second C has default bass
- [ ] Add new chord - verify existing bass unchanged
- [ ] Remove chord - verify other bass unchanged
- [ ] Save/load project - verify bass preserved
- [ ] Change chord duration - verify tie handling works

---

*Last updated: 2026-01-13 - Phases 1-7 completed*
*Phase 8 (cleanup) is optional and can be done later*
