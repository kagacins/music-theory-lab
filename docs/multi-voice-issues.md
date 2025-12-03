# Multi-Voice Support - Outstanding Issues

## Overview

During implementation of multi-voice (polyphonic) support as outlined in `multi-voice-support-design.md`, two significant issues have emerged that require further investigation.

---

## Issue 1: Stem Direction Not Working

### Expected Behavior
- **Single voice**: Stems should automatically point up or down based on note position relative to the middle line of the staff
  - Treble clef: Notes at B4 or above → stems down; notes below B4 → stems up
  - Bass clef: Notes at D3 or above → stems down; notes below D3 → stems up
- **Multiple voices**: Voice 1 stems up, Voice 2 stems down (forced, regardless of pitch)

### Actual Behavior
- All stems point UP regardless of pitch position (e.g., A5, F5 above B4 still have stems up)
- This occurs even with a single voice and no Voice 2 notes present

### What Was Tried

1. **VexFlow `auto_stem: true` option** (in `vexFlowRenderer.js`)
   - Added `noteConfig.auto_stem = true` when no explicit stem direction specified
   - Result: No effect - stems still point up

2. **Custom `calculateAutoStemDirection()` function** (in `vexFlowRenderer.js`)
   - Implemented manual calculation based on pitch position
   - Function returns -1 (down) for notes >= middle line, 1 (up) for notes below
   - Explicitly sets `noteConfig.stem_direction` to calculated value
   - Result: No effect - stems still point up

3. **Debug logging confirmed correct values**
   - `hasMultipleVoices: false` (correct)
   - `stemDirection: null` being passed (correct for auto-stem mode)
   - Voice 0 notes: 1, Voice 1 notes: 0 (correct)

### Possible Causes to Investigate

1. **VexFlow version compatibility**: The project may be using a VexFlow version where `stem_direction` works differently
2. **Note creation path**: There may be another code path creating notes that bypasses `createStaveNote`
3. **Post-creation override**: Something may be resetting stem direction after note creation
4. **VexFlow Voice/Formatter**: The VexFlow Voice or Formatter may be overriding stem directions during layout

### Files Involved
- `src/modules/notation/vexFlowRenderer.js` - `createStaveNote()`, `createChordNote()`, `calculateAutoStemDirection()`
- `src/modules/notation/grandStaff.js` - `createNotesForStaff()`, voice separation logic

---

## Issue 2: Voice 2 Notes Not Placed Independently

### Expected Behavior
- When Voice 2 is selected, new notes should be placed at beat 0 of the current measure
- Voice 2 should have its own independent beat tracking separate from Voice 1
- A note in Voice 1 at beat 0 should not prevent Voice 2 from also having a note at beat 0

### Actual Behavior
- Voice 2 notes are placed at the next available beat based on Voice 1's content
- Example: Voice 1 has a note at beat 0, Voice 2 note gets placed at beat 1 instead of beat 0

### What Was Fixed (Partial)

1. **`compositionState.js`** - Added voice management methods:
   - `setActiveVoice(voiceNumber)`
   - `getActiveVoice()`
   - `getActiveVoiceIndex()`
   - `ensureVoiceExists()`
   - `voiceHasNotes()`
   - `getVoiceCount()`

2. **`noteEditor.js`** - Updated to use current voice:
   - Added `currentVoice` property and `setCurrentVoice()`, `getCurrentVoiceIndex()` methods
   - Added `getVoice(measure, staff)` helper that returns correct voice based on current selection
   - Updated `getMeasureBeatsUsed()` to use current voice instead of hardcoded `voices[0]`
   - Replaced 16+ instances of hardcoded `voices[0]` with `this.getVoice(measure, staff)`

3. **`melodyComposerBridge.js`** - Fixed hardcoded voice references:
   - `getRemainingBeats()` - now uses `compositionState.getActiveVoiceIndex()`
   - `addNoteIntelligently()` - now uses current voice index
   - `addNoteViaBridge()` - now uses current voice index
   - Cross-measure tie handling - updated to use current voice

4. **`notationInit.js`** - Fixed fallback path to use current voice

5. **`notationToolbar.js`** - Added voice switching:
   - `V` key cycles between voices
   - `Alt+1` switches to Voice 1
   - `Alt+2` switches to Voice 2
   - `onVoiceChange` callback wired up

### Remaining Issues

Despite these fixes, the voice switching may not be working correctly. Possible causes:

1. **Dropdown not triggering callback**: The voice selector dropdown may not be properly connected to `onVoiceChange`
2. **State synchronization**: The voice state may not be synchronized across all components
3. **Additional hardcoded references**: There may be more `voices[0]` references that were missed
4. **Beat calculation path**: The beat calculation for new notes may still be using Voice 1's data

### Files to Check for Remaining `voices[0]` References
```
grep -r "voices\[0\]" src/modules/
```

---

## Recommended Next Steps

### For Stem Direction
1. Add `console.log` inside VexFlow's `StaveNote` constructor (if accessible) to see what config it receives
2. Check if there's a global VexFlow setting overriding stem directions
3. Test with a minimal VexFlow example outside the app to verify stem_direction works
4. Check VexFlow version and documentation for correct API

### For Voice Independence
1. Add logging to track which voice is active when a note is added
2. Verify the voice selector dropdown's `onChange` handler is firing
3. Search for any remaining hardcoded `voices[0]` references
4. Add logging in `getMeasureBeatsUsed()` to confirm it's checking the right voice

---

## Current State of Implementation

### Completed
- Core infrastructure for multi-voice data storage
- Voice management methods in compositionState
- Voice switching UI (keyboard shortcuts)
- Voice separation in rendering pipeline
- Note gathering with voiceIndex property

### Not Working
- Automatic stem direction based on pitch
- Forced stem directions for multi-voice (up/down)
- Independent beat tracking per voice

### Not Started
- Phase 3: Advanced UI/editing features
- Phase 4: Harmony recommendations
