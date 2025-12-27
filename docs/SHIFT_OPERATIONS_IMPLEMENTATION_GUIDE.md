# Shift Operations Implementation Guide

## Date: 2025-12-26
## Status: IMPLEMENTED - READY FOR TESTING

### Implementation Progress (2025-12-26):
- [x] `extractLogicalNotes()` added at line 6459
- [x] `rebuildNotesAfterShift()` added at line 6561
- [x] `deleteNoteWithShift()` added at line 6704
- [x] `insertTrebleNoteWithShiftAtPosition()` updated (both paths)
- [x] `insertTrebleNoteWithShiftAtEnd()` updated
- [x] `insertBassNoteWithShiftAtPosition()` updated
- [x] `applyDurationChangeWithShift()` updated
- [x] `applyDurationChangeWithShiftBass()` updated
- [x] Fixed dotted note rendering in `createChordNote` (vexFlowRenderer.js line 922-929)
- [x] Shift-delete now uses extract→rebuild (notationInit.js updated)
- [x] Shift+left and shift+right always insert quarter notes (predictable behavior)
- [x] Undo/redo support added for all shift operations
- [x] `_measuresManuallyEdited` flag prevents stale block sequence overwrite

### Bug Fix: Dotted Note Rendering (2025-12-26)
**Problem**: Dotted notes (e.g., '2n.' = dotted half) displayed without the dot.
**Root Cause**: `createChordNote()` in vexFlowRenderer.js only checked the `dotted` parameter, not the duration string.
**Fix**: Updated line 922 to check: `dotted || duration.endsWith('.') || vexDuration.endsWith('d')`
- Now matches the logic in `createStaveNote()` which was already correct.

### Bug Fix: Note Duplication on Insert (2025-12-26)
**Problem**: After inserting a note with shift, existing tied notes were duplicated.
**Root Cause**: `renderTrebleBlocksToMeasures()` was being called after the insert, overwriting the new measure state with stale data from `trebleBlockSequence`.
**Fix**:
1. Added `_measuresManuallyEdited` flag to compositionState
2. When extract→rebuild modifies measures, flag is set to true
3. `renderTrebleBlocksToMeasures()` checks flag and skips if measures were manually edited
- This is the NO SYNC approach: measures are truth, block sequence is invalidated.

---

## THE PROBLEM

Musical notation shift operations (insert with shift, delete with shift, duration change with shift) are broken. Specifically:

1. **Notes don't split correctly** when they now straddle measure boundaries after a shift
2. **Tied notes don't combine** when they now fit in one measure after a shift
3. **Previous fix attempts failed** because they tried to sync between multiple data structures

---

## THE SOLUTION: NO SYNC ARCHITECTURE

**Measures ARE the source of truth.** No separate block sequences for shift operations.

### Core Pattern: EXTRACT → MODIFY → REBUILD

Every shift operation follows this pattern:

```
1. EXTRACT: Pull notes from position X to end, combining tied sequences into "logical notes"
2. MODIFY: Insert/delete/change the target note
3. REBUILD: Place all logical notes sequentially, splitting at measure boundaries as needed
```

---

## KEY DATA STRUCTURES

### Measure Note Structure
```javascript
{
  type: 'note' | 'rest',
  pitches: ['C4', 'E4'],  // Array of pitch strings
  duration: '4n',          // VexFlow duration string
  beat: 0,                 // Beat position within measure (0-based)
  tied: false,             // If true, ties TO the next note (forward tie)
  isTied: false,           // If true, tied FROM previous note (backward tie)
  articulation: null,      // 'staccato', 'accent', etc.
  accidental: null,        // 'sharp', 'flat', 'natural'
  dynamic: null,           // 'p', 'f', etc.
  velocity: null,          // 0-127
  isRest: false,           // Redundant with type, but sometimes used
}
```

### Logical Note Structure (for extraction)
```javascript
{
  pitches: ['C4', 'E4'],
  totalDuration: 4,        // Total duration in BEATS (tied notes combined)
  tiedForward: false,      // If the LAST part was tied forward to something else
  attributes: {
    articulation: null,
    accidental: null,
    dynamic: null,
    velocity: null,
    isRest: false,
  }
}
```

### Tie Flag Semantics
- `tied: true` = This note ties TO the next note (draw tie curve forward)
- `isTied: true` = This note is tied FROM the previous note (continuation)
- A whole note split across 2 measures becomes:
  - Measure 1: `{ tied: true, isTied: false }` (first part)
  - Measure 2: `{ tied: false, isTied: true }` (second part)

---

## FUNCTION 1: extractLogicalNotes()

**Purpose**: Extract notes from a position to end, combining tied sequences.

**Location**: Add to `src/modules/notation/noteEditor.js` around line 6300

```javascript
/**
 * Extract logical notes from a position to end of composition
 * Combines tied note sequences into single logical notes with total duration
 * Also REMOVES the extracted notes from measures
 *
 * @param {string} clef - 'treble' or 'bass'
 * @param {number} voiceIndex - 0 or 1
 * @param {number} fromMeasure - Starting measure index
 * @param {number} fromBeat - Starting beat within that measure
 * @param {Object} compositionState - The composition state object
 * @param {number} beatsPerMeasure - Beats per measure from time signature
 * @returns {Array} Array of logical note objects
 */
extractLogicalNotes(clef, voiceIndex, fromMeasure, fromBeat, compositionState, beatsPerMeasure) {
  const logicalNotes = [];

  for (let m = fromMeasure; m < compositionState.measures.length; m++) {
    const measure = compositionState.measures[m];
    if (!measure) continue;

    const voices = clef === 'treble'
      ? measure.notation?.treble?.voices
      : measure.notation?.bass?.voices;

    if (!voices || !voices[voiceIndex]) continue;

    const voice = voices[voiceIndex];
    if (!voice.notes) continue;

    const notesToRemove = [];

    // Sort notes by beat to process in order
    const sortedNotes = [...voice.notes].sort((a, b) => (a.beat || 0) - (b.beat || 0));

    for (const note of sortedNotes) {
      const noteBeat = note.beat || 0;

      // Skip notes before extraction point in the first measure
      if (m === fromMeasure && noteBeat < fromBeat) continue;

      // Mark for removal
      notesToRemove.push(note);

      // Get duration in beats
      const durationBeats = this.getDurationInBeats(note.duration || '4n');

      if (note.isTied) {
        // This is a continuation of a previous note - add to last logical note's duration
        if (logicalNotes.length > 0) {
          const lastLogical = logicalNotes[logicalNotes.length - 1];
          lastLogical.totalDuration += durationBeats;
          // If this continuation was also tied forward, remember that
          if (note.tied) {
            lastLogical.tiedForward = true;
          }
        } else {
          // Edge case: tied note with no preceding note (shouldn't happen normally)
          // Create a new logical note for it
          logicalNotes.push({
            pitches: note.pitches || [note.pitch],
            totalDuration: durationBeats,
            tiedForward: note.tied || false,
            attributes: {
              articulation: note.articulation,
              accidental: note.accidental,
              dynamic: note.dynamic,
              velocity: note.velocity,
              isRest: note.isRest || note.type === 'rest',
            }
          });
        }
      } else {
        // New logical note (not a continuation)
        logicalNotes.push({
          pitches: note.pitches || [note.pitch],
          totalDuration: durationBeats,
          tiedForward: note.tied || false,
          attributes: {
            articulation: note.articulation,
            accidental: note.accidental,
            dynamic: note.dynamic,
            velocity: note.velocity,
            isRest: note.isRest || note.type === 'rest',
          }
        });
      }
    }

    // Remove extracted notes from the voice
    voice.notes = voice.notes.filter(n => !notesToRemove.includes(n));
  }

  return logicalNotes;
}
```

---

## FUNCTION 2: rebuildNotesAfterShift()

**Purpose**: Place logical notes sequentially, splitting at measure boundaries.

**Location**: Add to `src/modules/notation/noteEditor.js` around line 6380

```javascript
/**
 * Rebuild notes from a position, placing each logical note sequentially
 * Automatically splits notes that cross measure boundaries
 * Automatically combines notes that fit in one measure (no explicit combine needed)
 *
 * @param {string} clef - 'treble' or 'bass'
 * @param {number} voiceIndex - 0 or 1
 * @param {number} startMeasure - Starting measure index
 * @param {number} startBeat - Starting beat within that measure
 * @param {Array} logicalNotes - Array of logical note objects to place
 * @param {Object} compositionState - The composition state object
 * @param {number} beatsPerMeasure - Beats per measure from time signature
 */
rebuildNotesAfterShift(clef, voiceIndex, startMeasure, startBeat, logicalNotes, compositionState, beatsPerMeasure) {
  let currentMeasure = startMeasure;
  let currentBeat = startBeat;

  for (const logicalNote of logicalNotes) {
    let remainingBeats = logicalNote.totalDuration;
    let isFirstPart = true;

    while (remainingBeats > 0) {
      // Ensure measure exists
      while (currentMeasure >= compositionState.measures.length) {
        compositionState.addMeasure({});
      }

      const measure = compositionState.measures[currentMeasure];
      const voices = clef === 'treble'
        ? measure.notation?.treble?.voices
        : measure.notation?.bass?.voices;

      if (!voices) {
        console.error('[rebuildNotesAfterShift] No voices array in measure', currentMeasure);
        break;
      }

      // Ensure voice exists
      while (voices.length <= voiceIndex) {
        voices.push({ notes: [] });
      }
      const voice = voices[voiceIndex];

      // Calculate how much fits in this measure
      const beatsAvailable = beatsPerMeasure - currentBeat;
      const beatsToPlace = Math.min(remainingBeats, beatsAvailable);
      const isLastPart = remainingBeats <= beatsAvailable;

      // Create the measure note
      const measureNote = {
        type: logicalNote.attributes.isRest ? 'rest' : 'note',
        pitches: logicalNote.pitches,
        duration: this.beatsToDurationString(beatsToPlace),
        beat: currentBeat,
        // Tie flags
        isTied: !isFirstPart,   // Tied FROM previous if not first part
        tied: !isLastPart,      // Ties TO next if not last part
        // Other properties
        isRest: logicalNote.attributes.isRest || false,
      };

      // Add attributes only on first part
      if (isFirstPart) {
        if (logicalNote.attributes.articulation) {
          measureNote.articulation = logicalNote.attributes.articulation;
        }
        if (logicalNote.attributes.accidental) {
          measureNote.accidental = logicalNote.attributes.accidental;
        }
        if (logicalNote.attributes.dynamic) {
          measureNote.dynamic = logicalNote.attributes.dynamic;
        }
        if (logicalNote.attributes.velocity !== undefined) {
          measureNote.velocity = logicalNote.attributes.velocity;
        }
      }

      // Add to voice and sort
      voice.notes.push(measureNote);
      voice.notes.sort((a, b) => (a.beat || 0) - (b.beat || 0));

      // Advance position
      currentBeat += beatsToPlace;
      remainingBeats -= beatsToPlace;
      isFirstPart = false;

      // Move to next measure if current is full
      if (currentBeat >= beatsPerMeasure) {
        currentMeasure++;
        currentBeat = 0;
      }
    }
  }
}
```

---

## MODIFYING SHIFT-INSERT OPERATIONS

### insertTrebleNoteWithShiftAtPosition() - Line 1792

Replace the multi-voice path (lines 1881-1913) with:

```javascript
if (hasMultipleVoices) {
  // MULTI-VOICE: Use extract → insert → rebuild (NO SYNC)
  const voiceIdx = insertionPoint.voiceIndex ?? this.getVoiceIndexForStaff('treble');

  // Calculate insertion duration
  const noteDur = noteData.duration || '4n';
  const noteHasDot = noteDur.includes('.');
  let durationBeats = this.durationToBeats(noteDur);
  if (noteData.dotted && !noteHasDot) durationBeats *= 1.5;

  // 1. Extract all notes from insertion point onward
  const logicalNotes = this.extractLogicalNotes('treble', voiceIdx, measureIndex, beatPosition, compositionState, beatsPerMeasure);

  // 2. Create the new note as a logical note
  const newLogical = {
    pitches: noteData.pitches || [noteData.pitch],
    totalDuration: durationBeats,
    tiedForward: false,
    attributes: {
      articulation: noteData.articulation,
      accidental: noteData.accidental,
      dynamic: noteData.dynamic,
      velocity: noteData.velocity,
      isRest: noteData.isRest || false,
    }
  };

  // 3. Rebuild: new note first, then all extracted notes
  this.rebuildNotesAfterShift('treble', voiceIdx, measureIndex, beatPosition, [newLogical, ...logicalNotes], compositionState, beatsPerMeasure);

  this.composerIntegration.render();
  return;
}
```

### ALSO UPDATE:
- **Single-voice path** (lines 1916-1942) - same pattern
- **insertTrebleNoteWithShiftAtEnd()** (line 1951)
- **insertBassNoteWithShiftAtPosition()** (line 2036)

---

## MODIFYING SHIFT-DELETE OPERATIONS

### In notationInit.js or noteEditor.js delete handlers:

```javascript
// When shift-delete is requested:

// 1. Find the note to delete
const note = voice.notes[noteIndex];
const noteBeat = note.beat || 0;
const noteDuration = this.getDurationInBeats(note.duration || '4n');

// 2. If note is part of a tie chain (isTied=true), find the chain start
//    For now, just delete this note (tie chain handling can be added later)

// 3. Calculate position after this note
const afterBeat = noteBeat + noteDuration;
let afterMeasure = measureIndex;
if (afterBeat >= beatsPerMeasure) {
  afterMeasure++;
  afterBeat = 0;
}

// 4. Extract all notes AFTER the deleted note
const logicalNotes = this.extractLogicalNotes(clef, voiceIndex, afterMeasure, afterBeat, compositionState, beatsPerMeasure);

// 5. Remove the deleted note
voice.notes.splice(noteIndex, 1);

// 6. Rebuild from the deleted note's position
this.rebuildNotesAfterShift(clef, voiceIndex, measureIndex, noteBeat, logicalNotes, compositionState, beatsPerMeasure);
```

---

## MODIFYING DURATION CHANGE OPERATIONS

### applyDurationChangeWithShift() - Line 3251

Replace the current implementation:

```javascript
applyDurationChangeWithShift(measureIndex, noteIndex, newDuration, isDotted, compositionState) {
  const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(compositionState.metadata?.timeSignature);

  // Get the voice
  const measure = compositionState.measures[measureIndex];
  const voice = this.getVoice(measure, 'treble');
  const note = voice.notes[noteIndex];
  if (!note) return;

  const noteBeat = note.beat || 0;

  // Calculate durations
  const currentBeats = this.getDurationInBeats(note.duration || '4n');
  let newBeats = this.durationToBeats(newDuration);
  if (isDotted) newBeats *= 1.5;

  const voiceIndex = this.getVoiceIndexForStaff('treble');

  // 1. Extract all notes from this note to end
  const logicalNotes = this.extractLogicalNotes('treble', voiceIndex, measureIndex, noteBeat, compositionState, beatsPerMeasure);

  // 2. Modify the first logical note's duration
  if (logicalNotes.length > 0) {
    logicalNotes[0].totalDuration = newBeats;
  }

  // 3. Rebuild from this position
  this.rebuildNotesAfterShift('treble', voiceIndex, measureIndex, noteBeat, logicalNotes, compositionState, beatsPerMeasure);

  this.composerIntegration.render(true);
}
```

---

## HELPER FUNCTIONS NEEDED

These should already exist in noteEditor.js, but verify:

```javascript
// Convert duration string to beats
getDurationInBeats(duration) {
  // '4n' -> 1, '2n' -> 2, '1n' -> 4, '8n' -> 0.5, etc.
  // Also handle dotted: '4n.' -> 1.5
}

// Convert beats to duration string
beatsToDurationString(beats) {
  // 1 -> '4n', 2 -> '2n', 4 -> '1n', 0.5 -> '8n', etc.
  // Also handle dotted durations
}

// Duration to beats (similar to getDurationInBeats)
durationToBeats(duration, dotted = false) {
  let beats = getDurationInBeats(duration);
  if (dotted) beats *= 1.5;
  return beats;
}
```

---

## KEY FILES

1. **`src/modules/notation/noteEditor.js`** - Main file to modify
   - Add `extractLogicalNotes()` around line 6300
   - Add `rebuildNotesAfterShift()` around line 6380
   - Modify `insertTrebleNoteWithShiftAtPosition()` at line 1792
   - Modify `insertBassNoteWithShiftAtPosition()` at line 2036
   - Modify `applyDurationChangeWithShift()` at line 3251
   - Modify `applyDurationChangeWithShiftBass()` at line 3369

2. **`src/modules/notation/notationInit.js`** - Delete handlers may be here

3. **`src/modules/state/compositionState.js`** - Reference only (don't sync to blocks)

---

## TESTING CHECKLIST

### Insert Operations
- [ ] Insert quarter note in middle → downstream shifts by 1 beat
- [ ] Insert whole note at beat 3 of 4/4 → splits into dotted-half + quarter tied
- [ ] Insert before a tied continuation → inserts before the tie chain start
- [ ] Insert after a tied note → inserts after the entire tie chain

### Delete Operations
- [ ] Delete quarter note → downstream shifts back by 1 beat
- [ ] Delete causes combine: tied half+half becomes whole note
- [ ] Delete first part of tied note → entire chain deleted

### Duration Change
- [ ] Increase quarter to half → downstream shifts by 1 beat
- [ ] Increase causes split: quarter at beat 3 → half splits to dotted-quarter + eighth tied
- [ ] Decrease dotted-half to quarter → downstream shifts back

### Multi-Voice
- [ ] Treble voice 0 operations work
- [ ] Treble voice 1 operations work (independent of voice 0)
- [ ] Bass voice 0 operations work
- [ ] Bass voice 1 operations work

### Time Signatures
- [ ] 4/4 (4 beats per measure)
- [ ] 3/4 (3 beats per measure)
- [ ] 6/8 (6 beats per measure, but eighth = 1 unit)

---

## CRITICAL REMINDERS

1. **NO SYNCING** - Don't sync to trebleBlockSequence or voiceBlocks
2. **EXTRACT CLEARS** - extractLogicalNotes removes notes from measures
3. **REBUILD PLACES** - rebuildNotesAfterShift adds notes back to measures
4. **TIES ARE AUTOMATIC** - extraction combines, rebuilding splits
5. **SEQUENTIAL** - Process one note at a time, in order

---

## IF SOMETHING BREAKS

1. **Don't revert** - Debug instead
2. **Check logicalNotes** - Are they being extracted correctly?
3. **Check rebuild** - Are notes being placed at correct positions?
4. **Check tie flags** - Is `tied`/`isTied` set correctly?
5. **Check beat positions** - Is `currentBeat` advancing correctly?

---

*Document created: 2025-12-26*
*Ready for implementation*
