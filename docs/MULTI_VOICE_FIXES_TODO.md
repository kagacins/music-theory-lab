# Multi-Voice Fixes: Treble and Bass Clef

This document tracks multi-voice support fixes for both treble and bass clefs.

## Summary of Issues Fixed

### 1. Shift/Delete Operations Using trebleBlockSequence (Major Issue)

**Problem**: The `insertTrebleNoteWithShiftAtPosition` and `insertTrebleNoteWithShiftAtEnd` functions use `trebleBlockSequence` which is a flat structure that doesn't understand voices. When it syncs and renders, it overwrites the voice structure.

**Fix Applied**: Added multi-voice detection that bypasses `trebleBlockSequence` when Voice 2 has notes:

```javascript
// MULTI-VOICE CHECK: Detect if Voice 2 has any notes across all measures
const hasMultipleVoices = compositionState.measures.some(m => {
  const voices = m.notation?.treble?.voices || [];
  return voices.length > 1 && voices[1]?.notes?.length > 0;
});

if (hasMultipleVoices) {
  // Use direct voice-based shifting instead of trebleBlockSequence
  this.shiftNotesForward(...);
  // Insert note directly into voice
}
```

**Files Modified**:
- `noteEditor.js`: `insertTrebleNoteWithShiftAtPosition()` (lines ~1663-1767)
- `noteEditor.js`: `insertTrebleNoteWithShiftAtEnd()` (lines ~1775-1849)

**Status**: COMPLETED for treble. Bass clef uses different architecture (BuildingBlockSequence for chord cards).

---

### 2. shiftNotesForward Now Multi-Voice Aware

**Problem**: The original `shiftNotesForward` function:
- Only operated on `voices[0]`
- Silently dropped notes that shifted beyond the last measure
- Didn't create voices in target measures

**Fixes Applied**:
- Now iterates through ALL voices
- Stores `voiceIndex` with each shifted note
- Creates new measures if shifted notes exceed composition length
- Creates voice arrays in target measures if they don't exist

**File Modified**: `noteEditor.js`: `shiftNotesForward()` (lines ~5214-5330)

**Status**: COMPLETED - handles both treble and bass via `staff` parameter.

---

### 3. executePasteWithDelete Now Multi-Voice Aware

**Problem**: Only cleared and operated on `voices[0]`

**Fix Applied**: Now iterates through all voices when deleting notes

**File Modified**: `noteEditor.js`: `executePasteWithDelete()` (lines ~5333-5365)

**Status**: COMPLETED - handles both staves via `staff` parameter.

---

### 4. findInsertionPoint Returns Voice Index

**Problem**: When clicking on a note to insert near it, the code would insert into the currently selected voice, not the voice of the clicked note.

**Fixes Applied**:
- `findInsertionPoint` now looks at ALL notes (not just current voice)
- Returns `voiceIndex` of the clicked note
- Uses Y position to disambiguate when multiple notes are at the same X position

**File Modified**: `noteEditor.js`: `findInsertionPoint()` (lines ~1040-1127)

**Status**: COMPLETED - handles both staves. Bass clef notes have `voiceIndex` in `noteRegions`.

---

### 5. Insertion Uses Voice from Insertion Point

**Problem**: When inserting a note, the code used `getVoice(measure, staff)` which returns the currently selected voice, not the voice the user clicked on.

**Fix Applied**: Now uses `insertionPoint.voiceIndex` when available

**Files Modified**:
- `noteEditor.js`: `insertTrebleNoteWithShiftAtPosition()` - uses `insertionPoint.voiceIndex`
- `noteEditor.js`: `addNoteAtPosition()` insertion point path - uses `insertVoiceIndex`

**Status**: COMPLETED - applies to both staves.

---

### 6. Note Deletion Preserves Voice Index in Replacement Rests

**Problem**: When deleting a note and replacing it with a rest, the rest didn't have `voiceIndex`, causing it to be filtered into Voice 1.

**Fix Applied**: `splitDottedDuration` now accepts `voiceIdx` parameter and includes it in generated rests

**File Modified**: `notationInit.js`: `onNoteDelete` handler and `splitDottedDuration()` (lines ~608-681)

**Status**: COMPLETED - applies to both staves.

---

### 7. fillGapsWithRests Now Multi-Voice Aware

**Problem**:
- `fillGapsWithRests` was skipping existing rests when calculating occupied beat ranges
- Auto-generated rests had `voiceIndex: undefined`

**Fixes Applied**:
- Now includes both notes AND rests when building occupied ranges
- Accepts `voiceIndex` parameter and includes it in auto-generated rests
- Both treble and bass calls now pass the appropriate voiceIndex

**File Modified**: `grandStaff.js`: `fillGapsWithRests()` (lines ~175-288)

**Status**: COMPLETED - applies to both staves.

---

### 8. renderTrebleBlocksToMeasures Now Multi-Voice Aware (NEW)

**Problem**: The function was clearing and writing only to `voices[0]`, losing Voice 2 data when syncing from the block sequence.

**Fix Applied**:
- Determines which voices are present in the block data
- Only clears voices that will be written from the block
- Writes notes to the correct voice based on `note.voice` attribute
- Includes `voiceIndex` property on rendered notes

**File Modified**: `compositionState.js`: `renderTrebleBlocksToMeasures()` (lines ~1679-1789)

**Status**: COMPLETED

---

### 9. renderBassBlocksToMeasures Now Multi-Voice Aware (NEW)

**Problem**: The function was overwriting `voices[0]` completely, potentially losing Voice 2 data.

**Fix Applied**:
- Ensures voices array structure exists
- Only updates `voices[0]` (chord-card data)
- Preserves `voices[1+]` for manual multi-voice additions
- Adds `voiceIndex: 0` to rendered notes

**File Modified**: `compositionState.js`: `renderBassBlocksToMeasures()` (lines ~864-929)

**Status**: COMPLETED

---

### 10. Bass Clef Note Regions Include voiceIndex

**Problem**: Bass clef needed proper multi-voice support in note regions for click detection.

**Status**: ALREADY IMPLEMENTED - `grandStaff.js` already includes `voiceIndex` in bass note regions (lines ~1941-1969).

---

## Architecture Notes

### Treble vs Bass Clef Multi-Voice

**Treble Clef**:
- Uses `trebleBlockSequence` (flat unit-based structure) for melodic notation
- Voice data is stored with `voice` attribute (1-based: Voice 1, Voice 2)
- `syncMeasuresToTrebleBlock` reads from ALL voices and stores `voice` number
- `renderTrebleBlocksToMeasures` writes to the appropriate voice based on `note.voice`

**Bass Clef**:
- Uses `bassBlockSequence` (BuildingBlockSequence) for chord-card based bass lines
- Voice 0 is managed by the block sequence (chord cards)
- Voice 1+ is for manual melodic additions, NOT managed by block sequence
- `syncMeasuresToBuildingBlocks` only reads from Voice 0 (intentional)
- `renderBassBlocksToMeasures` only writes to Voice 0, preserving Voice 1+

---

## Files Modified in This Session

1. **noteEditor.js**
   - `findInsertionPoint()` - multi-voice aware, returns voiceIndex
   - `addNoteAtPosition()` - uses insertVoiceIndex from insertion point
   - `insertTrebleNoteWithShiftAtPosition()` - multi-voice bypass for block sequence
   - `insertTrebleNoteWithShiftAtEnd()` - multi-voice bypass for block sequence
   - `shiftNotesForward()` - multi-voice aware, creates measures/voices
   - `executePasteWithDelete()` - multi-voice aware

2. **grandStaff.js**
   - `fillGapsWithRests()` - accepts voiceIndex, counts existing rests as occupied
   - `fillGapsWithRests` calls now pass voiceIndex for both treble and bass
   - `applyRestVisibility()` - debug logging added

3. **notationInit.js**
   - `onNoteDelete` handler - passes voiceIndex to splitDottedDuration
   - `splitDottedDuration()` - includes voiceIndex in generated rests

4. **compositionState.js**
   - `renderTrebleBlocksToMeasures()` - multi-voice aware, writes to correct voice
   - `renderBassBlocksToMeasures()` - preserves Voice 2+, adds voiceIndex to notes

---

## Testing Checklist

### Treble Clef Multi-Voice
- [ ] Add notes to Voice 1 and Voice 2 in same measure
- [ ] Insert note between existing Voice 1 notes (shift mode)
- [ ] Insert note between existing Voice 2 notes (shift mode)
- [ ] Delete note from Voice 2 - should show cue rest
- [ ] Play All should play both voices
- [ ] Auto Play should play both voices
- [ ] Operations that trigger sync should preserve both voices

### Bass Clef Multi-Voice
- [ ] Add notes to Voice 1 and Voice 2 in same measure
- [ ] Insert note between existing Voice 1 notes
- [ ] Insert note between existing Voice 2 notes
- [ ] Delete note from Voice 2 - should show cue rest
- [ ] Play All should play both voices
- [ ] Auto Play should play both voices
- [ ] Chord card changes should preserve Voice 2 notes

---

## Remaining Known Issues

### 1. Smart Rest Visibility Not Applied Consistently

**Problem**: The `applyRestVisibility` only runs when `hasMultipleVoices` is true. After some operations, rests don't get cue/hidden styling.

**Debugging Added**:
- `grandStaff.js` line 1428-1429: Voice separation logging
- `grandStaff.js` line 409-415: Rest visibility application logging

**Status**: Needs investigation
