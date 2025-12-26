# Shift-Delete Tied Notes Bug - Investigation Document

## Last Updated: 2025-12-24

## Problem Statement

When using Ctrl+Delete (shift-delete) to remove notes, tied note chains are not being properly maintained. The `tied` flag is being lost between delete operations, causing:
1. Merges to fail in subsequent operations
2. Final result to be incorrect (e.g., getting DH+Q instead of whole note)

## Test Scenario

1. Add 3 quarter notes at beats 0, 1, 2 in measure 1
2. Add a whole note at beat 3 - it auto-splits into:
   - Q@beat3 (1 beat) with `tied=true` in measure 1
   - DH@beat0 (3 beats) with `isTied=true` in measure 2
3. Ctrl+Delete each quarter note one at a time

### Expected Results

- **After delete 1**: Q@0, Q@1, HN@2(tied), HN@M2B0(isTied) - total 4 beats for chain
- **After delete 2**: Q@0, DH@1(tied), Q@M2B0(isTied) - total 4 beats for chain
- **After delete 3**: Whole note (1n) at beat 0 - 4 beats, no split needed

### Actual Results

- **After delete 1**: Correct - HN+HN tied chain
- **After delete 2**: Shows HN (2 beats) visually instead of DH (3 beats) - tied flag lost
- **After delete 3**: Shows DH+Q instead of whole note - merge fails because tied=undefined

## Root Cause Identified

The `tied` flag is being set correctly during the split operation:
```
[shiftNotesBackward] SPLIT firstNote: beat=1, duration=2n., tied=true, isTied=false
```

But when collected for the NEXT delete operation, it shows:
```
[mergeTiedNotes] Note: {measure: 1, beat: 1, duration: '2n.', pitch: 'D#5', tied: undefined, …}
```

**The tied flag changes from `true` to `undefined` between operations.**

This is NOT a serialization issue (we tried using `= false` instead of `delete`).
Something ELSE is overwriting the note data after shiftNotesBackward completes.

## Likely Culprits

1. **Renderer reconstruction** - The notation renderer may be reconstructing notes from a different data source
2. **CompositionState sync** - There may be a sync between notation state and another data structure (Tone.js timeline?) that doesn't preserve tied flags
3. **AutoSave/Load cycle** - Though autoSave happens after, there might be some state refresh happening
4. **VexFlow re-render** - When VexFlow re-renders, it might be creating new note objects that don't have the tied flags

## Key Files

1. **`src/modules/notation/noteEditor.js`**
   - `shiftNotesBackward()` - Lines ~6041-6215
   - `mergeTiedNotes()` - Lines ~6220-6382
   - `beatsToDurationString()` - Lines ~6528-6542
   - `getDurationInBeats()` - Lines ~6960-6970

2. **`src/modules/notation/notationInit.js`**
   - `onNoteDelete` callback that triggers shift-delete - Lines ~919-1035

3. **Need to investigate:**
   - `notationRenderer.js` - Check if it reconstructs notes
   - `compositionState.js` - Check for state sync that might overwrite notes

## Fixes Attempted

### Attempt 1: Remove conditional merge check
**File**: noteEditor.js, mergeTiedNotes()
**Change**: Removed the check `if (newBeat + combinedDuration <= beatsPerMeasure)` - now always merges tied chains
**Result**: Merge now happens, but tied flags still lost between operations

### Attempt 2: Use explicit `= false` instead of `delete`
**File**: noteEditor.js
**Changes**:
- Line 6335: `mergedNote.isTied = false` instead of `delete mergedNote.isTied`
- Line 6342: `mergedNote.tied = false` instead of `delete mergedNote.tied`
- Line 6145: `firstNote.isTied = false` instead of `delete firstNote.isTied`
- Line 6168: `secondNote.tied = false` instead of `delete secondNote.tied`
- Line 6181: `newNote.isTied = false` instead of `delete newNote.isTied`
**Result**: No change - tied flag still becomes undefined

### Attempt 3: Debug logging
Added extensive logging to trace the flow:
- Log each note being collected
- Log merge candidates and results
- Log split operations with tied flag values
- Log final state of measures

**Finding**: Logs confirm tied=true at creation but tied=undefined at next collection

## Root Cause Found & Fixed (2025-12-24)

The root cause was identified as the `syncMeasuresToTrebleBlock()` function not preserving the `tied` flag. When notes were synced to the treble block sequence, the `tied` property was lost. If `renderTrebleBlocksToMeasures()` was called later (even unexpectedly), the notes would be recreated without the proper `tied` flags.

### Fix Applied - Attempt 4 (SUCCESSFUL)

**Files Modified:**

1. **`src/modules/state/compositionState.js`**
   - Line 2094: Added `tied: note.tied || false` to preserve forward tie flag when collecting notes
   - Line 2170: Added `tied: note.tied || false` to combined notes
   - Line 2181: Pass `tied` to block.setNote via attributes
   - Lines 2317-2322: Updated `renderTrebleBlocksToMeasures()` to properly compute `tiedValue`:
     - If not last part: always tie (to next split part)
     - If last part: preserve `note.tied` from block data

2. **`src/modules/state/buildingBlock.js`**
   - Line 737: Added `tied: unit.tied || false` to the note object returned by `getNotes()`

3. **`src/modules/notation/noteEditor.js`**
   - Lines 6177-6182: Added explicit undefined checks for `tied` and `isTied` in non-split reinsertion path

**Summary:**
The `tied` flag is now preserved through the entire sync/render cycle:
1. `syncMeasuresToTrebleBlock()` now captures `tied` from measures
2. The block stores `tied` in its units
3. `getNotes()` returns the `tied` value
4. `renderTrebleBlocksToMeasures()` uses the preserved `tied` value for last parts
5. `shiftNotesBackward()` ensures `tied` is never undefined

## Debug Logging Currently in Place

The following console logs are active:
- `[shiftNotesBackward]` - Start, collection, processing, split, insert, final state
- `[mergeTiedNotes]` - Start, each note, merge passes, results
- `[beatsToDurationString]` - Beat to duration conversions
- `[SHIFT-DELETE]` and `[SINGLE-SHIFT-DELETE]` in notationInit.js

## Code Structure

### Flow of Shift-Delete

1. User presses Ctrl+Delete
2. `notationInit.js:onNoteDelete` is called with `shiftNotes: true`
3. Note is deleted from voice.notes array
4. `noteEditor.shiftNotesBackward()` is called
5. Notes are collected from deletion point onwards
6. `mergeTiedNotes()` merges tied chains
7. Notes are repositioned at new beats
8. If note crosses measure boundary, it's split with proper tied/isTied flags
9. Render is triggered
10. **SOMEWHERE HERE the tied flags are lost**
11. Next delete operation collects notes with tied=undefined

### Tied Flag Semantics

- `tied: true` - This note ties FORWARD to the next note
- `isTied: true` - This note is tied FROM the previous note
- A tied chain: Note1(tied=true) → Note2(isTied=true, tied=true) → Note3(isTied=true)

## Data Structures

Notes are stored in:
```javascript
compositionState.measures[measureIndex].notation.treble.voices[voiceIndex].notes[]
```

Each note object:
```javascript
{
  beat: 0,           // Position within measure
  duration: '4n',    // Tone.js duration string
  pitch: 'C4',       // Pitch or array of pitches
  tied: true/false,  // Ties forward
  isTied: true/false // Tied from previous
}
```

## Questions to Answer

1. Where is the code that runs between shiftNotesBackward completing and the next delete starting?
2. Is there a render/refresh cycle that reconstructs note objects?
3. Is there a separate data store (like Tone.js Part) that doesn't have tied flags, and notes get synced from it?
4. Is there any code that clones notes without preserving all properties?

---

## Attempt 5 Investigation (2025-12-24 - Current Session)

### Bug Still Present After "Fix 4"
The user reports that after deleting a quarter note with Ctrl+Delete:
- 3 quarter notes in measure 1 + quarter tied to dotted half (Q tied to DH)
- After delete: gets 3 quarter notes + **dotted quarter** tied to dotted half
- First measure now has **4.5 beats** (should be 4)
- Second measure has **5 beats** including rests (should be 4)
- The tied chain went from 4 beats to 4.5 beats!

### CRITICAL BUG FOUND: Unit Class Missing `tied` Property

**The previous "Fix 4" was incomplete!**

While compositionState.js was updated to pass `tied` to `block.setNote()` via attributes,
and buildingBlock.js `getNotes()` was updated to return `unit.tied`, the **Unit class
constructor never saves the `tied` property**!

**Proof:**
```bash
# Search for "this.tied" in Unit class
grep "this\.tied" src/modules/state/buildingBlock.js
# Result: No matches found
```

The Unit class at lines 196-355 defines many properties:
- `this.pitches`, `this.parentIndex`, `this.dynamic`, `this.velocity`, etc.
- `this.lyric` (last property before constructor ends)
- **NO `this.tied = options.tied`!**

When `setNote()` is called with `{ ...attributes, tied: true }`:
1. The options object contains `tied: true`
2. But the Unit constructor never extracts it with `this.tied = options.tied`
3. So `unit.tied` is always `undefined`
4. `getNotes()` returns `unit.tied || false` which is always `false`
5. The tied flag is lost!

### Fix Applied (Session 5)

**File: `src/modules/state/buildingBlock.js`**

Added to Unit constructor after line 346 (after lyric property):
```javascript
// =====================================================================
// TIE FLAGS (for shift-delete operations)
// =====================================================================

// Forward tie - this note ties TO the next note
// Critical for preserving tied note chains during shift operations
this.tied = options.tied || false;
```

### Additional Fix Applied (Session 5)

**File: `src/modules/state/buildingBlock.js` - Unit.clone() method**

Added `tied: this.tied` to the clone method to preserve the flag when units are cloned.

### Verification Needed

1. **Test the fix** - With the Unit class now storing `tied`, the sync cycle should preserve
   the flag. The merge/split logic in shiftNotesBackward should now work correctly.
2. **If still broken** - The merge logic itself may need review. See analysis below.

### Complete Analysis of Correct Behavior

When the fix is working, here's what SHOULD happen:

**Initial State:**
- Measure 0: Q@0, Q@1, Q@2, Q@3(tied=true)
- Measure 1: DH@0(isTied=true)
- Tied chain = 1 + 3 = 4 beats

**After deleting Q@0 (first delete):**
1. Collect: Q@1, Q@2, Q@3(tied), DH(isTied)
2. Merge: Q@3 + DH = 4 beats → '1n' (whole note) at position beat 3
3. Shift back 1 beat: WholeNote moves to beat 2
4. Split at measure boundary: 2 beats + 2 beats → HN@beat2(tied) + HN@M1B0(isTied)
5. Result: Q@0, Q@1, HN@2(tied) in M0 | HN@0(isTied) in M1
6. Chain preserved: 2 + 2 = 4 beats ✓

**After deleting Q@0 again (second delete):**
1. Collect: Q@1, HN@2(tied), HN@M1B0(isTied)
2. Merge: HN@2 + HN = 4 beats → '1n' (whole note) at position beat 2
3. Shift back 1 beat: WholeNote moves to beat 1
4. Split at measure boundary: 3 beats + 1 beat → DH@beat1(tied) + Q@M1B0(isTied)
5. Result: Q@0, DH@1(tied) in M0 | Q@0(isTied) in M1
6. Chain preserved: 3 + 1 = 4 beats ✓

**After deleting Q@0 one more time (third delete):**
1. Collect: DH@1(tied), Q@M1B0(isTied)
2. Merge: DH + Q = 4 beats → '1n' (whole note) at position beat 1
3. Shift back 1 beat: WholeNote moves to beat 0
4. No split needed: 4 beats fits exactly in measure 0
5. Result: WholeNote@0 in M0 | (empty) in M1
6. Chain collapsed: 4 beats as single note ✓

### Flow Analysis

After `shiftNotesBackward` completes:
1. `notationInit.js` calls `syncMeasuresToTrebleBlock()` (lines 948, 1040, 1102)
2. This syncs measures → block sequence
3. If anything later calls `renderTrebleBlocksToMeasures()`, it reads from block → measures
4. With the Unit class bug, `tied` was never stored, so it was lost

### The `beatsToDurationString` Function

This function uses `>=` comparisons which could cause issues:
```javascript
beatsToDurationString(beats) {
    if (beats >= 4) result = '1n';      // 4+ beats = whole
    else if (beats >= 3) result = '2n.';  // 3+ beats = dotted half
    else if (beats >= 2) result = '2n';   // 2+ beats = half
    else if (beats >= 1.5) result = '4n.'; // 1.5+ beats = dotted quarter
    ...
}
```

If there's any floating-point imprecision (e.g., 2.9999 beats), it could return
the wrong duration. But the user says this isn't the main issue - it's the
total duration of tied chains not being preserved.

### Recommended Approach (If Current Fix Doesn't Work)

If fixing the Unit class doesn't resolve the issue, consider:

1. **Skip block sync after shift operations** - After shiftNotesBackward,
   don't call syncMeasuresToTrebleBlock(). The measures are the source of truth.

2. **Simpler merge logic** - Instead of tracking tied/isTied flags:
   - Calculate total duration of tied chain as a number
   - After shift, determine if it fits in one measure
   - If yes, use a single note with that duration
   - If no, split at measure boundary with fresh tied/isTied flags

3. **Track tied chains by ID** - Give each tied chain a unique ID so parts
   can be identified and merged regardless of flag state.

---

## Session 5 Continued: Fundamental Architecture Issues Discovered

### Problem: Measure Duration Constraints Not Enforced

After fixing the Unit class `tied` property, the user reports:
1. First delete works correctly
2. Second delete breaks things
3. **Measures can have more than beatsPerMeasure worth of notes**
4. This happens especially when rests are involved

### Root Causes Identified

#### 1. Merge Logic is Too Aggressive (line 6305)
```javascript
return other.note.isTied || pitchMatch;
```
This merges notes if they have **same pitch AND adjacent**, even if not tied!
This can incorrectly merge separate notes that happen to be adjacent and same pitch.

#### 2. No Measure Duration Validation
The `shiftNotesBackward` function:
- Collects notes, removes them from measures
- Shifts and re-inserts at new positions
- **Never validates that measure total ≤ beatsPerMeasure**
- Notes can be inserted that overflow the measure

#### 3. Rests Are Collected and Shifted Too
When notes are deleted normally (not shift-delete), they're replaced with rests.
These stored rests are then collected and shifted during shift-delete operations,
potentially causing confusion.

### Architecture Flaws

1. **No Single Source of Truth for Measure Duration**
   - Notes just have `beat` and `duration` properties
   - Nothing prevents overlapping notes or overfilled measures
   - The render code auto-generates rests to fill gaps, masking problems

2. **Block Sequence vs Measures Dual Data Model**
   - `compositionState.measures[]` - stores notes by measure
   - `trebleBlockSequence` - unit-based timeline
   - Syncing between them can lose/corrupt data (e.g., tied flag before fix)

3. **Shift Operation Doesn't Account for Existing Notes**
   - Just inserts at new positions without checking what's already there
   - Should either: remove conflicting notes, or validate before insert

### Recommended Architecture Changes

#### Option A: Add Strict Validation
After each shift operation, validate every measure:
```javascript
function validateMeasure(measure, beatsPerMeasure) {
    const notes = measure.notation.treble.voices[0].notes;
    let totalBeats = 0;
    for (const note of notes) {
        const duration = getDurationInBeats(note.duration);
        if (note.beat + duration > beatsPerMeasure) {
            throw new Error('Note extends beyond measure');
        }
        totalBeats += duration;
    }
    if (totalBeats > beatsPerMeasure) {
        throw new Error('Measure has too many beats');
    }
}
```

#### Option B: Work in Absolute Beats
Instead of measure-relative positions, work entirely in absolute beats:
1. Convert all notes to absolute beat positions
2. Perform shift operation in absolute space
3. Convert back to measure-relative at the end
4. This avoids measure boundary issues during the operation

#### Option C: Use Block Sequence as Source of Truth
The unit-based block sequence naturally handles duration constraints.
For shift operations:
1. Convert measures → block sequence
2. Perform shift in block sequence (already handles ties correctly)
3. Convert back to measures
4. This leverages existing infrastructure

### Immediate Fixes Applied (Session 5)

1. **Fixed the merge condition** (line 6305):
   ```javascript
   // Only merge if actually tied, not just same pitch
   return other.note.isTied === true;
   ```
   Previously merged notes just because they had same pitch and were adjacent!

2. **Added helper functions**:
   - `clearConflictingNotesAtBeat(voice, beat, duration, beatsPerMeasure)` - Removes any overlapping notes before insertion
   - `validateMeasureDuration(measure, staff, voiceIndex, beatsPerMeasure, measureIndex)` - Validates no note exceeds measure bounds

3. **Added clearing before each insertion** in shiftNotesBackward:
   - Before inserting first part of split note
   - Before inserting second part of split note
   - Before inserting non-split notes

4. **Added validation at end of shiftNotesBackward**:
   - Loops through all measures and validates durations
   - Logs errors if any measure violates duration constraints

### Complete List of Fixes in Session 5

**File: `src/modules/state/buildingBlock.js`**
1. Unit constructor: Added `this.tied = options.tied || false;`
2. Unit.clone(): Added `tied: this.tied,`

**File: `src/modules/notation/noteEditor.js`**
1. Line ~6305: Fixed merge condition to require `isTied === true`
2. Added `clearConflictingNotesAtBeat()` helper function
3. Added `validateMeasureDuration()` helper function
4. Added clearing calls before each note insertion in shiftNotesBackward
5. Added validation loop at end of shiftNotesBackward
