# Music Notation Editor Expansion Plan

## Overview
This document outlines the comprehensive expansion of the Melody Composer into a full-fledged music notation editor with support for professional music writing capabilities.

## Phase 1: Data Structure & Core Functionality ✅ (In Progress)

### Updated Data Structure
```javascript
let interactiveMelody = {
    // Melody staff (editable, treble or bass)
    melodyNotes: [], // Array of { type: 'note'|'rest', pitch, duration, measure, beat, dotted, tied }
    // Chord staff (editable, treble or bass)
    chordNotes: [], // Array of { type: 'note'|'rest', pitches: [], duration, measure, beat, dotted }
    timeSignature: '4/4',
    beatsPerMeasure: 4,
    beatDuration: '4n',
    tempo: 120,
    key: 'C'
};
```

### Completed Functions
- ✅ `initInteractiveMelody()` - Updated for new structure
- ✅ `addNoteToInteractiveMelody()` - Updated for melody notes
- ✅ `deleteLastNote()` - Updated with measure overflow handling
- ✅ `clearInteractiveMelody()` - Updated to clear both melody and chord notes
- ✅ `addRestToMelody(duration, dotted)` - NEW: Add rests with variable durations
- ✅ `setTimeSignature(timeSignature)` - NEW: Change time signature (4/4, 3/4, 6/8, etc)
- ✅ `tieLastNote()` - NEW: Create ties between notes
- ✅ `getEditorState()` - NEW: Get current editing state

## Phase 2: UI Enhancements (Next Steps)

### Rest Entry UI
- Add "Add Rest" button for each duration
- Dotted rest toggle checkbox
- Visual feedback when rest is selected

### Time Signature Selector
```
Current: 4/4 [dropdown]
- 2/2 (Alla Breve)
- 2/4
- 3/4
- 4/4 (default)
- 6/8
- 9/8
- 12/8
```

### Note Editing Controls
- Tie button (creates tie to next note)
- Edit existing notes (click to modify)
- Delete individual notes
- Undo/Redo buttons

### Clef Selection
- Melody clef: Treble / Bass / Alto
- Chord clef: Treble / Bass / Grand Staff

## Phase 3: Rendering Improvements

### Proper Beaming
- Automatic beaming for 8th, 16th, 32nd notes
- Group consecutive beamable notes correctly
- Handle dotted notes in beams

### Tie Rendering
- VexFlow `Tie()` object for connecting notes
- Handle ties across measures
- Visual clarity when rendering ties

### Rests
- Support all durations (whole, half, quarter, 8th, 16th, 32nd)
- Dotted rests with 50% duration increase
- Proper placement on staff

## Phase 4: Playback Enhancements

### Tie Handling
- Single sustained note for tied notes
- Total duration = sum of tied note durations

### Rest Handling
- Silence during rest durations
- Maintain timing accuracy

### Time Signature Aware Playback
- Respect current time signature (not hardcoded to 4/4)
- Adjust measure boundaries based on beats per measure

## Phase 5: Dual Clef Editing

### Chord Staff Editing
- Add/remove notes from chord voicings
- Edit duration of chord notes
- Support for different chord clefs

### Melody Staff Editing
- Single-note melody editing
- Tie support
- Note selection and modification

## Current Issues to Fix

### 16th Note Rendering
- Debug VexFlow 16th note representation
- Ensure correct duration string format
- Verify beaming with 16th notes

### Measure Overflow
- ✅ Implemented strict mode with auto-rests
- Tested with multiple 8th/16th notes
- Notes properly constrained to measure width

### Compatibility
- Backward compatibility with existing progressions
- Migration path for old data structure

## Implementation Priority

1. **Phase 1** (In Progress)
   - Data structure updates
   - Rest support
   - Time signature changes

2. **Phase 2** (Next)
   - UI components for rests and time signatures
   - Enhanced note controls

3. **Phase 3** (Following)
   - Proper beaming algorithm
   - Tie rendering with VexFlow
   - Rest rendering

4. **Phase 4** (Then)
   - Playback updates for ties and rests
   - Time signature-aware timing

5. **Phase 5** (Finally)
   - Dual clef editing
   - Professional notation capabilities

## Technical Notes

### VexFlow Integration
- `Rest` class for creating rests
- `Tie` class for note connections
- `Beam.generateBeams()` for auto-beaming
- Formatter strict mode for measure constraints

### Tone.js Playback
- Use `triggerAttackRelease()` for individual notes
- Sum durations for tied notes
- Silence for rests

### Beat/Measure Tracking
- Maintain fractional beat positions (0.5, 0.25, 0.75)
- Respect `beatsPerMeasure` from time signature
- Auto-measure increment when beat >= beatsPerMeasure

## API Reference

### Adding Elements
```javascript
// Add note
addNoteToInteractiveMelody(noteName, skipPlayback)

// Add rest
addRestToMelody(duration, dotted)

// Create tie to next note
tieLastNote()
```

### Modifying Score
```javascript
// Change time signature
setTimeSignature('3/4')

// Delete last element
deleteLastNote()

// Clear everything
clearInteractiveMelody()
```

### Getting Information
```javascript
// Get current editor state
getEditorState()

// Get all melody notes
getInteractiveMelody()
```

## Future Enhancements

- Swing/shuffle rhythm notation
- Triplet support
- Compound time signatures (6/8, 9/8)
- Key signature changes mid-score
- Dynamic markings (pp, p, mp, mf, f, ff)
- Articulation marks (staccato, accent, tenuto)
- Expression text
- Repeat signs and codas
- Multiple voices per staff
- Score export to MusicXML format
- MIDI file export

