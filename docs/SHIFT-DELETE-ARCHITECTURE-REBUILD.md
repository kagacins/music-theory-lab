# Shift-Delete Architecture Rebuild Guide

## Last Updated: 2025-12-24

## Purpose
This document provides everything needed to rebuild the shift-delete functionality correctly. Read this BEFORE investigating the codebase.

---

## The Problem

There are TWO shift operations that must work correctly:

### 1. Insert with Shift (Shift+Arrow)
- User selects an existing note
- User presses Shift+Left or Shift+Right arrow
- A new note is inserted adjacent to the selected note
- All subsequent notes shift RIGHT to make room
- Tied note chains must maintain their total duration
- Measure boundaries must be respected

### 2. Delete with Shift (Ctrl+Delete)
- User deletes a note
- All subsequent notes shift LEFT to fill the gap
- Tied note chains must maintain their total duration
- Measure boundaries must be respected

**Both operations are the inverse of each other and should use the same underlying mechanism.**

**What's broken:**
- Tied note durations change incorrectly (e.g., 4-beat chain becomes 4.5 beats)
- Measures can end up with more than beatsPerMeasure worth of notes
- The second or third shift operation breaks things even if the first works
- Dotted notes appear where they shouldn't
- **As of Session 5, even insertion with shift may be broken** (user reported regression)

---

## The Architecture (Two Data Models)

### Model 1: Measures Array
```javascript
compositionState.measures[measureIndex].notation.treble.voices[voiceIndex].notes[]
```

Each note:
```javascript
{
  beat: 0,           // Position within measure (0 to beatsPerMeasure-1)
  duration: '4n',    // Tone.js duration string ('1n', '2n', '4n', '8n', etc.)
  pitch: 'C4',       // Single pitch or null
  pitches: ['C4'],   // Array of pitches (for chords)
  tied: true/false,  // This note ties FORWARD to next note
  isTied: true/false,// This note is tied FROM previous note
  isRest: true/false,
  dotted: true/false,
}
```

### Model 2: Block Sequence (Unit-based Timeline)
```javascript
compositionState.trebleBlockSequence.blocks[0].units[]
```

Each unit represents 1/4 of a beat (UNITS_PER_BEAT = 4). A quarter note spans 4 units.

```javascript
// Unit class (src/modules/state/buildingBlock.js)
{
  pitches: [],        // Empty = rest
  parentIndex: null,  // null = note start, number = continuation of note at that index
  tied: false,        // Forward tie (ADDED IN SESSION 5 - may need verification)
  // ... many other musical attributes
}
```

### The Sync Problem
- `syncMeasuresToTrebleBlock()` - Reads measures, writes to block sequence
- `renderTrebleBlocksToMeasures()` - Reads block sequence, writes to measures
- **If any property isn't preserved through both directions, it gets lost**

---

## Key Files and Functions

### src/modules/state/compositionState.js

**Working Functions (use block sequence):**
- `insertTrebleNoteWithShift(insertUnit, durationUnits, pitches, attributes)` - Line ~2411
  - Works on block sequence
  - Shifts units forward, inserts new note
  - Calls `renderTrebleBlocksToMeasures()` at end

- `deleteTrebleNoteWithShift(noteStartUnit, shiftBack)` - Line ~2473
  - Works on block sequence
  - Shifts units backward to fill gap
  - Calls `renderTrebleBlocksToMeasures()` at end

**Sync Functions:**
- `syncMeasuresToTrebleBlock()` - Line ~2030
  - Collects notes from measures with absolute positions
  - Combines tied notes into single logical notes
  - Writes to block sequence
  - **CRITICAL**: Must preserve `tied` flag (Line 2094, 2170, 2181)

- `renderTrebleBlocksToMeasures()` - Line ~2245
  - Reads notes from block via `block.getNotes()`
  - Splits notes at measure boundaries
  - Sets `tied` and `isTied` flags on split notes
  - **CRITICAL**: Lines 2320-2322 compute `tiedValue`

### src/modules/state/buildingBlock.js

**Unit Class** - Line ~196
- Stores all musical properties for one unit of time
- **CRITICAL**: `this.tied` was MISSING before Session 5 fix (Line ~354)
- `clone()` method must preserve all properties including `tied` (Line ~374)

**BuildingBlock.getNotes()** - Line ~666
- Converts units back to note objects
- Returns `tied: unit.tied || false` (Line ~737)

**BuildingBlock.setNote()** - Line ~594
- Sets a note spanning multiple units
- Spreads attributes into first unit

### src/modules/notation/noteEditor.js

**Shift Forward Function:**
- `shiftNotesForward()` - Line ~5765 (approximately)
  - Used when inserting notes with shift
  - Works on measures directly (same architecture as shiftNotesBackward)
  - May have same issues as shiftNotesBackward

**Broken Functions (work on measures directly):**
- `shiftNotesBackward()` - Line ~6104
  - Collects notes from measures
  - Calls `mergeTiedNotes()` to combine tied chains
  - Shifts and re-inserts at new positions
  - Splits notes at measure boundaries
  - **THIS IS THE PROBLEMATIC APPROACH**

- `mergeTiedNotes()` - Line ~6290
  - Attempts to merge tied note chains
  - **BUG FIXED IN SESSION 5**: Line ~6306 was merging notes just because same pitch

- `beatsToDurationString(beats)` - Line ~6542
  - Converts beat count to duration string
  - Uses >= comparisons (potential rounding issues)

- `getDurationInBeats(duration)` - Line ~6974
  - Converts duration string to beats

### src/modules/notation/notationInit.js

**onNoteDelete handler** - Line ~795+
- Handles Ctrl+Delete (shift-delete)
- Currently uses `noteEditor.shiftNotesBackward()` (broken approach)
- **SHOULD USE**: `compositionState.deleteTrebleNoteWithShift()` instead

---

## Duration Mappings

```javascript
// Duration to beats
'1n': 4,   '1n.': 6,
'2n': 2,   '2n.': 3,
'4n': 1,   '4n.': 1.5,
'8n': 0.5, '8n.': 0.75,
'16n': 0.25

// Units per beat
UNITS_PER_BEAT = 4

// Duration to units
'4n' = 4 units
'2n' = 8 units
'1n' = 16 units
```

---

## Tied Note Semantics

A tied note chain spanning measures:
```
Measure 1: [Q at beat 3, tied=true]  --ties to-->  [DH at beat 0, isTied=true] :Measure 2
```

- `tied: true` = This note ties FORWARD to the next note
- `isTied: true` = This note is tied FROM the previous note
- Total duration = sum of all parts (1 + 3 = 4 beats in example)

When notes shift and the chain fits in one measure:
```
Before: Q(tied) + DH(isTied) = 4 beats across 2 measures
After:  WholeNote = 4 beats in 1 measure (no ties needed)
```

When notes shift and must split differently:
```
Before: Q(tied) + DH(isTied) at beat 3 = 4 beats
After shift to beat 1: DH(tied) + Q(isTied) = 3+1 = 4 beats (still correct)
```

---

## How Insert and Delete Should Mirror Each Other

### Insert with Shift (Shift+Arrow)
1. User selects an existing note at position X
2. User presses Shift+Left or Shift+Right arrow
3. A new note (with current toolbar duration D) is inserted to the left or right of selected note
4. All notes at the insertion point and beyond shift RIGHT by D beats to make room
5. If any note now crosses a measure boundary, split it with ties
6. Total composition length increases by D beats

### Delete with Shift
1. User deletes note at position X with duration D
2. Note is removed
3. All notes at position > X shift LEFT by D beats
4. If any tied chain now fits in one measure, merge it
5. If any note now crosses a measure boundary differently, re-split with ties
6. Total composition length decreases by D beats

### The Key Insight
Both operations are about:
1. Converting notes to absolute positions (not measure-relative)
2. Adding or removing space at a position
3. Converting back to measure-relative with correct ties

**The block sequence does this naturally because it's already in absolute units.**

---

## The Correct Approach

### Why Block Sequence Works
The block sequence is a flat array of units. Each unit is 1/4 beat. Notes are just ranges of units with the same parentIndex pointing to the start.

**For Insert (insertTrebleNoteWithShift):**
1. Extend the block by the new note's duration
2. Shift all units at and after insert point FORWARD
3. Insert new note's units at the insert point
4. Call `renderTrebleBlocksToMeasures()` - handles all measure boundary splitting

**For Delete (deleteTrebleNoteWithShift):**
1. Shift all units after the deleted note BACKWARD
2. Truncate the block by the deleted note's duration
3. Call `renderTrebleBlocksToMeasures()` - handles all measure boundary splitting

**Why this is correct:**
- No complex merge logic needed - duration is just the number of units
- No tied flag tracking needed during the operation - ties are computed fresh at render
- Measure boundaries are handled in ONE place (`renderTrebleBlocksToMeasures`)
- The block sequence naturally represents duration as physical space

### The Fix Strategy

**Option 1: Use Block Sequence for All Shift Operations**

Modify `notationInit.js` to use `compositionState.deleteTrebleNoteWithShift()` instead of `noteEditor.shiftNotesBackward()`.

The flow would be:
1. User presses Ctrl+Delete on a note
2. Find the note's position in units: `compositionState.getTrebleNoteUnit(measureIndex, noteIndex)`
3. Call `compositionState.deleteTrebleNoteWithShift(startUnit, true)`
4. This automatically:
   - Removes the units for that note
   - Shifts all subsequent units back
   - Re-renders to measures with correct tied notes

**Option 2: Rewrite Measure-Based Approach**

If block sequence can't be used (e.g., multi-voice scenarios), the measure-based approach needs:
1. Convert ALL notes to absolute beat positions first
2. Work in absolute space (no measure boundaries during operation)
3. Track tied chains by ID, not by flag detection
4. Convert back to measure-relative at the end
5. Validate measure durations before committing

---

## Session 5 Changes (May Need Reverting)

### buildingBlock.js
1. Added `this.tied = options.tied || false;` to Unit constructor (Line ~354)
2. Added `tied: this.tied,` to Unit.clone() (Line ~419)

### noteEditor.js
1. Changed merge condition from `other.note.isTied || pitchMatch` to `other.note.isTied === true` (Line ~6306)
2. Added `clearConflictingNotesAtBeat()` function (Line ~6043)
3. Added `validateMeasureDuration()` function (Line ~6074)
4. Added clearing/validation calls in `shiftNotesBackward()`

**User reported that insertion with shift broke after these changes.** May need to revert and verify.

---

## Test Scenario

1. Create composition in 4/4 time
2. Add 3 quarter notes at beats 0, 1, 2 in measure 1
3. Add a whole note at beat 3 - it auto-splits into:
   - Q at beat 3 (tied=true) in measure 1
   - DH at beat 0 (isTied=true) in measure 2
4. Ctrl+Delete each quarter note one at a time

**Expected progression:**
- Initial: Q@0, Q@1, Q@2, Q@3(tied) | DH@0(isTied) - Chain = 4 beats
- After delete Q@0: Q@0, Q@1, HN@2(tied) | HN@0(isTied) - Chain = 4 beats
- After delete Q@0: Q@0, DH@1(tied) | Q@0(isTied) - Chain = 4 beats
- After delete Q@0: WholeNote@0 | (empty) - Chain = 4 beats (no ties needed)

**What actually happens:**
- Durations change incorrectly
- Dotted notes appear where they shouldn't
- Measures exceed beatsPerMeasure

---

## Debugging Tips

Console logs to look for:
- `[shiftNotesBackward]` - Shows the shift operation
- `[mergeTiedNotes]` - Shows tied chain detection
- `[SHIFT-DELETE]` - Shows the delete trigger in notationInit.js
- `[validateMeasureDuration] VIOLATION:` - Shows measure overflow

Key things to check:
1. Is the note actually being removed before shift?
2. Are tied flags correct on collected notes?
3. Is merge happening when it should?
4. Is the duration calculation correct after merge?
5. Is the split calculation correct at measure boundaries?

---

## Recommendation

**Don't patch the measure-based approach anymore.**

The block sequence approach (`deleteTrebleNoteWithShift`) is architecturally correct. Make shift-delete use it:

1. In `notationInit.js`, when `deletion.shiftDelete` is true:
2. Call `compositionState.syncMeasuresToTrebleBlock()` first
3. Find the note's unit position
4. Call `compositionState.deleteTrebleNoteWithShift(startUnit, true)`
5. The render happens automatically

This leverages the working insertion code's architecture for deletion too.

---

## Files to Read First (in order)

1. This document
2. `src/modules/state/compositionState.js` - Lines 2411-2520 (insert/delete with shift)
3. `src/modules/state/buildingBlock.js` - Lines 196-400 (Unit class), 594-750 (setNote, getNotes)
4. `src/modules/notation/notationInit.js` - Lines 795-1050 (onNoteDelete handler)

---

## Questions to Answer Before Coding

1. Does `insertTrebleNoteWithShift` still work correctly? (User said it broke)
2. If not, what broke it? (Possibly Session 5 changes to Unit class)
3. Can we use `deleteTrebleNoteWithShift` for the shift-delete operation?
4. Are there multi-voice scenarios that prevent using block sequence?
5. Should we revert Session 5 changes first to establish a baseline?

---

## The Core Requirements (CRITICAL)

### When Shifting Causes a Note to Straddle Measures
If a note with duration D starts at beat B and B + D > beatsPerMeasure:
1. Split into the MINIMUM number of notes needed
2. First note: from beat B to end of measure (duration = beatsPerMeasure - B)
3. Second note: from beat 0 of next measure (duration = remaining beats)
4. If second note still exceeds measure, continue splitting
5. All parts are TIED together to maintain the original duration

Example in 4/4 (beatsPerMeasure = 4):
- Whole note (4 beats) shifted to beat 2
- Beat 2 + 4 = 6 > 4, must split
- First part: 2 beats at beat 2 (half note, tied=true)
- Second part: 2 beats at beat 0 of next measure (half note, isTied=true)

### When Shifting Causes Tied Notes to Fit in One Measure
If tied notes that previously straddled a measure now fit entirely within one measure:
1. COMBINE them into a single note
2. The tie is removed (no longer needed)
3. The combined duration must equal the sum of the original parts

Example:
- Before: HN at beat 2 (tied=true) + HN at beat 0 of M2 (isTied=true) = 4 beats
- After shift to beat 0: Whole note at beat 0 = 4 beats (no ties)

### Special Issues with Dotted Notes
Dotted notes have non-integer beat counts:
- Dotted half (2n.): 3 beats
- Dotted quarter (4n.): 1.5 beats
- Dotted eighth (8n.): 0.75 beats

**Problem 1: Splitting dotted notes**
If a dotted half (3 beats) at beat 2 must split:
- First part: 2 beats (beat 2 to beat 4) = half note
- Second part: 1 beat = quarter note
- These are NOT both dotted - the dot is "absorbed" into the split

**Problem 2: Combining into dotted notes**
When combining, must recognize when result should be dotted:
- 2 + 1 = 3 beats = dotted half (not half + quarter)
- 1 + 0.5 = 1.5 beats = dotted quarter (not quarter + eighth)

### Special Issues with Rests
Rests should generally NOT be shifted or combined:
- Rests represent silence, not sustained sound
- Tied rests don't make musical sense
- When a note is deleted, the space becomes available (shift) or becomes rest (no shift)

**Current bug**: Rests may be getting collected and shifted along with notes, or rests may be incorrectly created/modified during shift operations.

---

## Keyboard Event Flow

### Shift+Arrow (Insert with Shift)

```
User presses Shift+Left or Shift+Right with note selected
    ↓
noteEditor.js: handleKeyDown() catches the event
    ↓
noteEditor.js: Determines insert position (left or right of selected note)
    ↓
noteEditor.js: Calls compositionState.addTrebleNote() with insertWithShift=true
    ↓
compositionState.js: addTrebleNote() line ~2765
    ↓
compositionState.js: insertTrebleNoteWithShift() line ~2411
    ↓
Block sequence is modified (units shifted, new note inserted)
    ↓
compositionState.js: renderTrebleBlocksToMeasures() line ~2245
    ↓
Measures are rebuilt from block sequence with correct ties
    ↓
notationComposer.render() displays the result
```

### Ctrl+Delete (Delete with Shift)

```
User presses Ctrl+Delete with note selected
    ↓
noteEditor.js: deleteSelectedNotes(shiftDelete=true)
    ↓
Emits 'noteDelete' event with shiftDelete: true
    ↓
notationInit.js: onNoteDelete handler, line ~795
    ↓
CURRENT (BROKEN) PATH:
    notationInit.js: Removes note from measure directly
        ↓
    noteEditor.js: shiftNotesBackward() line ~6104
        ↓
    Complex measure-based merge/split logic (BUGGY)
        ↓
    compositionState.syncMeasuresToTrebleBlock()

CORRECT PATH (should use instead):
    compositionState.js: deleteTrebleNote() with shiftBack=true
        ↓
    compositionState.js: deleteTrebleNoteWithShift() line ~2473
        ↓
    Block sequence is modified (units shifted, block truncated)
        ↓
    compositionState.js: renderTrebleBlocksToMeasures()
        ↓
    Measures are rebuilt from block sequence with correct ties
```

---

## Critical Code: renderTrebleBlocksToMeasures()

This is where measure boundaries and ties are computed. Located at compositionState.js line ~2245.

```javascript
renderTrebleBlocksToMeasures() {
    // Skip if multi-voice (measures are source of truth for voice 2)
    if (this.hasMultipleVoices('treble')) {
        return;
    }

    const block = this.trebleBlockSequence.blocks[0];
    if (!block) return;

    const notes = block.getNotes(); // Get all notes from unit-based block
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);

    // Clear existing treble notes in all measures
    for (const measure of this.measures) {
        if (measure.notation?.treble?.voices?.[0]) {
            measure.notation.treble.voices[0].notes = [];
        }
    }

    // Place each note into measures, splitting at boundaries
    for (const note of notes) {
        const startBeat = note.startUnit / UNITS_PER_BEAT; // Convert units to beats
        const durationBeats = note.durationUnits / UNITS_PER_BEAT;

        let remainingBeats = durationBeats;
        let currentBeat = startBeat;
        let isFirstPart = true;

        while (remainingBeats > 0) {
            const measureIndex = Math.floor(currentBeat / beatsPerMeasure);
            const beatInMeasure = currentBeat % beatsPerMeasure;
            const beatsUntilMeasureEnd = beatsPerMeasure - beatInMeasure;

            // How much of this note fits in current measure?
            const beatsThisMeasure = Math.min(remainingBeats, beatsUntilMeasureEnd);

            // Ensure measure exists
            while (this.measures.length <= measureIndex) {
                this.addMeasure({});
            }

            // Compute tie flags
            const needsTieForward = remainingBeats > beatsThisMeasure; // More parts coming
            const isTiedFromPrevious = !isFirstPart; // This is a continuation

            // For the LAST part, preserve the original note's forward tie
            // (in case this note was part of a longer chain)
            const tiedValue = needsTieForward ? true : (note.tied || false);

            // Create the note part
            const notePart = {
                pitch: note.pitches[0] || null,
                pitches: note.pitches,
                duration: beatsToDuration(beatsThisMeasure), // Convert beats to duration string
                beat: beatInMeasure,
                tied: tiedValue,
                isTied: isTiedFromPrevious,
                isRest: note.isRest,
                // ... other attributes
            };

            // Add to measure
            this.measures[measureIndex].notation.treble.voices[0].notes.push(notePart);

            // Move to next part
            remainingBeats -= beatsThisMeasure;
            currentBeat += beatsThisMeasure;
            isFirstPart = false;
        }
    }

    // Sort notes in each measure by beat
    for (const measure of this.measures) {
        if (measure.notation?.treble?.voices?.[0]?.notes) {
            measure.notation.treble.voices[0].notes.sort((a, b) => a.beat - b.beat);
        }
    }
}
```

**Key insight**: This function doesn't need to "merge" anything - it just places notes from the block sequence into measures and computes ties fresh each time. The block sequence IS the source of truth for duration.

---

## Critical Code: insertTrebleNoteWithShift()

Located at compositionState.js line ~2411.

```javascript
insertTrebleNoteWithShift(insertUnit, durationUnits, pitches, attributes = {}) {
    // Sync from measures first to get latest state
    if (this.trebleBlockSequence.blocks.length === 0) {
        this.initializeTrebleBlockSequence();
    } else {
        this.syncMeasuresToTrebleBlock();
    }

    const block = this.trebleBlockSequence.blocks[0];
    const totalUnits = block.units.length;

    // Step 1: Extend the block by the duration of the new note
    const newTotalUnits = totalUnits + durationUnits;
    const newTotalBeats = Math.ceil(newTotalUnits / UNITS_PER_BEAT);
    block.setDuration(newTotalBeats);

    // Step 2: Shift all units at and after insertUnit FORWARD by durationUnits
    // Work backwards to avoid overwriting
    for (let i = block.units.length - 1; i >= insertUnit + durationUnits; i--) {
        const sourceIndex = i - durationUnits;
        if (sourceIndex >= insertUnit && sourceIndex < totalUnits) {
            const sourceUnit = block.units[sourceIndex];
            block.units[i] = sourceUnit.clone();

            // Adjust parentIndex if it pointed to something in the shifted region
            if (block.units[i].parentIndex !== null && block.units[i].parentIndex >= insertUnit) {
                block.units[i].parentIndex += durationUnits;
            }
        }
    }

    // Step 3: Insert the new note at insertUnit
    block.setNote(insertUnit, durationUnits, pitches, attributes);

    // Step 4: Ensure we have enough measures
    const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);
    const requiredMeasures = Math.ceil(newTotalBeats / beatsPerMeasure);
    while (this.measures.length < requiredMeasures) {
        this.addMeasure({});
    }

    // Step 5: Re-render to measures (handles all tie logic)
    this.renderTrebleBlocksToMeasures();
}
```

---

## Critical Code: deleteTrebleNoteWithShift()

Located at compositionState.js line ~2473.

```javascript
deleteTrebleNoteWithShift(noteStartUnit, shiftBack = false) {
    if (this.trebleBlockSequence.blocks.length === 0) {
        return;
    }

    const block = this.trebleBlockSequence.blocks[0];
    const notes = block.getNotes();

    // Find the note at this position
    const noteToDelete = notes.find(n => n.startUnit === noteStartUnit);
    if (!noteToDelete) {
        return;
    }

    const deleteDurationUnits = noteToDelete.durationUnits;

    if (shiftBack) {
        // Shift downstream notes back to fill the gap

        // Step 1: Shift all units after the deleted note BACK by deleteDurationUnits
        const shiftStart = noteStartUnit + deleteDurationUnits;
        for (let i = noteStartUnit; i < block.units.length - deleteDurationUnits; i++) {
            const sourceIndex = i + deleteDurationUnits;
            if (sourceIndex < block.units.length) {
                const sourceUnit = block.units[sourceIndex];
                block.units[i] = sourceUnit.clone();

                // Adjust parentIndex
                if (block.units[i].parentIndex !== null && block.units[i].parentIndex >= shiftStart) {
                    block.units[i].parentIndex -= deleteDurationUnits;
                }
            }
        }

        // Step 2: Truncate the block
        const newTotalUnits = block.units.length - deleteDurationUnits;
        const newTotalBeats = Math.ceil(newTotalUnits / UNITS_PER_BEAT);
        block.setDuration(Math.max(1, newTotalBeats)); // At least 1 beat
    } else {
        // Replace the note with a rest (no shift)
        block.setRest(noteStartUnit, deleteDurationUnits);
    }

    // Re-render to measures (handles all tie logic)
    this.renderTrebleBlocksToMeasures();
}
```

---

## Critical Code: The Broken shiftNotesBackward()

This is what's currently being used for Ctrl+Delete. Located at noteEditor.js line ~6104.

**Why it's broken:**
1. Works on measures directly instead of block sequence
2. Has complex merge logic that tries to detect tied notes by flags
3. Tied flags can be lost through sync cycles
4. Doesn't handle dotted notes correctly in all cases
5. Can create measures with more than beatsPerMeasure

```javascript
shiftNotesBackward(fromMeasure, fromBeat, shiftBeats, staff, voiceIndex, compositionState, beatsPerMeasure) {
    // Collect all notes that need to be shifted
    const notesToShift = [];

    for (let m = fromMeasure; m < compositionState.measures.length; m++) {
        // ... collect notes at or after fromBeat
        // Remove from current position
        voice.notes.splice(i, 1);
    }

    // Try to merge tied notes (THIS IS FRAGILE)
    const mergedNotes = this.mergeTiedNotes(notesToShift, beatsPerMeasure, shiftBeats);

    // Re-insert notes at shifted positions
    for (const item of mergedNotes) {
        // Calculate new position
        const newAbsoluteBeat = oldAbsoluteBeat - shiftBeats;
        const newMeasure = Math.floor(newAbsoluteBeat / beatsPerMeasure);
        const newBeat = newAbsoluteBeat % beatsPerMeasure;

        // Check if note needs to be split across measure boundary
        if (noteEndBeat > beatsPerMeasure) {
            // Split note (THIS LOGIC HAS BUGS)
            // ... create first part with tied=true
            // ... create second part with isTied=true
        } else {
            // Insert note as-is
        }
    }
}
```

**The merge logic (also broken):**
```javascript
mergeTiedNotes(notesToShift, beatsPerMeasure, shiftBeats) {
    // Tries to find pairs where note.tied=true and next note.isTied=true
    // BUG: Was also merging notes just because same pitch (fixed in Session 5)
    // BUG: tied flags can be undefined, causing merge to fail
    // BUG: Doesn't handle chains of 3+ tied notes correctly
}
```

---

## State Before Session 5

**What was working:**
- Insert with Shift (Shift+Arrow) - reportedly working
- Normal note entry
- Normal delete (replace with rest)

**What was broken:**
- Delete with Shift (Ctrl+Delete) - tied notes losing duration
- Tied flags being lost between operations

**Session 5 changes that may have caused regression:**
1. Added `this.tied = options.tied || false;` to Unit constructor
2. Added `tied: this.tied` to Unit.clone()
3. Changed merge condition in mergeTiedNotes

If insert with shift is now broken, it's likely because of #1 or #2 affecting the Unit class behavior in ways we didn't anticipate.

---

## Duration Conversion Functions

### beatsToDuration(beats) - Converting beat count to duration string
```javascript
// Must handle all cases including dotted notes
function beatsToDuration(beats) {
    if (beats >= 4) return '1n';
    if (beats >= 3) return '2n.';  // Dotted half
    if (beats >= 2) return '2n';
    if (beats >= 1.5) return '4n.'; // Dotted quarter
    if (beats >= 1) return '4n';
    if (beats >= 0.75) return '8n.'; // Dotted eighth
    if (beats >= 0.5) return '8n';
    if (beats >= 0.25) return '16n';
    return '16n';
}
```

**Problem with >= comparisons:**
- 2.9999 beats returns '2n.' (3 beats) - WRONG, should be '2n' + something
- This function assumes beats will be exact, but floating point can cause issues

### durationToBeats(duration) - Converting duration string to beats
```javascript
const DURATION_TO_BEATS = {
    '1n': 4,   '1n.': 6,
    '2n': 2,   '2n.': 3,
    '4n': 1,   '4n.': 1.5,
    '8n': 0.5, '8n.': 0.75,
    '16n': 0.25, '16n.': 0.375,
};
```

---

## Checklist for Rebuild

1. [ ] Verify insertTrebleNoteWithShift works (if broken, revert Session 5 changes first)
2. [ ] Make Ctrl+Delete use deleteTrebleNoteWithShift instead of shiftNotesBackward
3. [ ] Verify renderTrebleBlocksToMeasures correctly splits notes at measure boundaries
4. [ ] Verify renderTrebleBlocksToMeasures correctly sets tied/isTied flags
5. [ ] Test with dotted notes specifically
6. [ ] Test with notes that span multiple measures (chains of 3+ tied notes)
7. [ ] Verify measure duration is never exceeded
8. [ ] Test the full scenario: 3 quarter notes + whole note, delete each quarter one by one
