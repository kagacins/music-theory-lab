# API_REFERENCE.md

**Purpose:** Quick lookup for key function signatures without reading full files.

**Last Updated:** 2025-12-26

---

## 🎯 COMPOSITIONSTATE - Central State Management
**File:** [src/modules/state/compositionState.js](../src/modules/state/compositionState.js)

### Factory Functions

```javascript
getCompositionState() → CompositionState
// Get or create the global singleton instance

resetCompositionState() → CompositionState
// Reset and return fresh singleton

getBeatsPerMeasureFromTimeSignature(timeSignature?) → number
// Returns beats per measure (e.g., 4 for 4/4)

getTicksPerDenominator(timeSignature?) → number
// Ticks per beat based on time signature denominator

getMeasureCapacityTicks(timeSignature?) → number
// Total ticks available in a measure

durationStringToTicks(durationStr, timeSignature?) → number
// Convert Tone.js duration ('4n', '8n', etc.) to ticks

beatsToTicks(beats, timeSignature?) → number
// Convert beats to ticks

ticksToBeats(ticks) → number
// Convert ticks to beats

ticksToDurationString(ticks, timeSignature?) → string
// Convert ticks back to Tone.js duration string

sumNoteTicks(notes[], timeSignature?) → number
// Sum durations of note array in ticks

getNotesOverflowTicks(notes[], timeSignature?) → number
// How many ticks notes overflow measure capacity
```

### Note Collection & Redistribution

```javascript
collectAllNotesWithAbsolutePositions(measures[], staff, timeSignature) → CollectedNote[]
// Flatten all notes with absolute positions for time signature changes

redistributeNotesToNewMeasures(compositionState, staff, collectedNotes[], newTimeSignature) → void
// Redistribute notes across new measure boundaries after time sig change
```

### CompositionState Class - Chord Segments

```javascript
getChordSegments() → ChordSegment[]
// Get all chord segments with bass note ranges

getChordSegment(chordIndex) → ChordSegment | null
// Get segment for specific chord index

getChordSegmentForBeat(beat) → ChordSegment | null
// Find which chord segment contains a given beat

getRemainingBeatsInBuildingBlock(beat) → number
// How many beats left in the current chord segment

buildChordSegments() → void
// Rebuild all chord segments (call after progression changes)

gatherBassNotesForChord(chordIndex) → Note[]
// Collect all bass notes belonging to a chord

checkIfBassIsEdited(chordIndex) → boolean
// Check if user manually edited bass for this chord

calculateSegmentBassBeats(segment) → number
// Calculate total beats of bass notes in segment

truncateSegmentBassNotes(chordIndex, newDurationBeats) → {truncatedNotes, adjustedNote, newBassNotes}
// Truncate bass notes when chord duration shrinks
```

### Measure Methods

```javascript
getMeasure(index) → Measure | null
// Get measure at index

getMeasureCount() → number
// Total number of measures

addMeasure(chordData?) → number
// Add new measure, returns new index

removeMeasure(index) → boolean
// Remove measure at index

insertMeasure(index, chordData?) → number
// Insert measure at specific position
```

### Chord Methods

```javascript
getChord(index) → Chord | null
// Get chord at index

updateChordDuration(chordIndex, newBeats) → boolean
// Update chord duration (handles bass truncation)

updateChord(index, chordData) → void
// Update chord properties (root, type, inversion, etc.)

updateChordInversion(index, inversion) → void
// Update just the inversion
```

### Note Methods

```javascript
addNote(measureIndex, staff, voiceIndex, noteData) → void
// Add note to measure

updateNote(measureIndex, staff, voiceIndex, noteIndex, changes) → void
// Update note properties

removeNote(measureIndex, staff, voiceIndex, noteIndex) → boolean
// Remove note from measure

getNotes(measureIndex, staff, voiceIndex) → Note[]
// Get all notes for voice
```

### Sync & Import/Export

```javascript
syncWithProgressionData(progressionData[], options?) → void
// Sync compositionState with progression data (safe partial update)

importFromProgressionData(progressionData[], options?) → void
// Import full progression data (replaces all)

exportToProgressionData() → Array
// Export to legacy progressionData format

importFromInteractiveMelody(interactiveMelody) → void
// Import from interactiveMelody format

exportToInteractiveMelody() → object
// Export to interactiveMelody format

clear() → void
// Clear all measures and reset state
```

### Bass Auto-Generation

```javascript
updateBassFromChord(measureIndex) → void
// Regenerate bass for single measure

regenerateAllAutoBassByBuildingBlock() → void
// Regenerate all auto-generated bass notes

saveEditedBassNotes() → void
// Save all edited bass notes to restoration cache

saveEditedBassNotesForMeasure(measureIndex) → void
// Save edited bass for single measure

restoreEditedBassNotes() → boolean
// Restore bass notes after regeneration
```

### Settings & Metadata

```javascript
getSettings() → object
// Get composition settings (key, tempo, time signature)

updateSettings(updates) → void
// Update settings (emits event)

getMetadata() → object
// Get metadata (title, composer, etc.)

updateMetadata(updates) → void
// Update metadata
```

### Voice Management

```javascript
getActiveVoiceIndexForStaff(staff) → number
// Get currently active voice for staff ('treble' or 'bass')

setActiveVoiceForStaff(staff, voiceIndex) → void
// Set active voice for staff
```

### Constants

```javascript
TS_PPQ = 480  // Ticks per quarter note
```

---

## 🔄 PROGRESSION NOTATION SYNC
**File:** [src/modules/integration/progressionNotationSync.js](../src/modules/integration/progressionNotationSync.js)

### Global Functions

```javascript
getProgressionNotationSync() → ProgressionNotationSync
// Get singleton instance

initProgressionNotationSync() → ProgressionNotationSync
// Initialize sync system

syncProgressionToComposition() → void
// Sync current progression → compositionState (wrapper)

syncCompositionToProgression() → void
// DISABLED - One-way sync only (progression → composition)
```

### ProgressionNotationSync Class

```javascript
updateProgressionFromNotation(measureIndex, chord) → void
// Update progression card when chord edited in notation

syncMeasureToProgression(measureIndex, measure) → void
// Sync single measure to progression

removeMeasureFromProgression(measureIndex) → void
// Remove measure from progression

syncProgressionToNotation() → void
// Sync entire progression → notation

syncNotationToProgression() → void
// DISABLED - Would sync notation → progression

highlightChordTonesInMelody(measureIndex) → boolean[]
// Highlight melody notes that are chord tones

destroy() → void
// Clean up event listeners
```

---

## 🌉 MELODY COMPOSER BRIDGE
**File:** [src/modules/integration/melodyComposerBridge.js](../src/modules/integration/melodyComposerBridge.js)

### Initialization & Sync

```javascript
initMelodyComposerBridge() → {compositionState, syncInstance}
// Initialize bridge system

syncProgressionToMelodyComposer() → void
// Sync progression → compositionState → notation (CRITICAL FUNCTION)

importInteractiveMelodyToComposition(interactiveMelody) → void
// Import interactiveMelody format to compositionState

exportCompositionToInteractiveMelody() → object
// Export compositionState to interactiveMelody format

getBridgeCompositionState() → CompositionState
// Get the bridge's compositionState reference
```

### Note Addition

```javascript
addNoteViaBridge(measureIndex, staff, note) → void
// Add note through bridge (handles sync)

addNoteIntelligently(pitch, duration, dotted, staff, isRest?, accidental?, articulation?, tuplet?) → {success, measuresFilled}
// Intelligently add note (auto-fills measures if needed)
```

### Bass Management

```javascript
hasUserEditedBass() → boolean
// Check if any bass notes were manually edited

setBassPattern(pattern, resetOctaveToAuto?) → void
// Set bass pattern ('root', 'fifth', 'octave', 'chord', 'off')

setBassOctave(octave) → void
// Set manual bass octave (null for auto)

getBassOctave() → number | null
// Get current bass octave setting

getEffectiveBassOctave() → number
// Get actual bass octave (respects auto setting)

setBassFollowsInversion(enabled) → void
// Whether bass follows chord inversions

setAutoGenerateBass(enabled) → void
// Enable/disable auto bass generation

isBassAutoGenerated(measureIndex) → boolean
// Check if bass for measure is auto-generated

editBassNote(measureIndex, noteIndex, changes) → void
// Edit bass note (marks as edited)

addBassNote(measureIndex, note) → void
// Add bass note (marks as edited)

regenerateBassForMeasure(measureIndex) → void
// Regenerate bass for single measure

regenerateAllBass() → void
// Regenerate all bass notes
```

### Settings

```javascript
getBassPatternOptions() → {value, label, description}[]
// Get available bass pattern options

getBridgeSettings() → object
// Get current bridge settings

setUseCompositionState(enabled) → void
// Enable/disable compositionState usage

isUsingCompositionState() → boolean
// Check if using compositionState
```

---

## 🎼 NOTATION INIT
**File:** [src/modules/notation/notationInit.js](../src/modules/notation/notationInit.js)

### Initialization & Access

```javascript
initEnhancedNotation(options?) → void
// Initialize notation system (NotationComposer, NoteEditor)

isNotationInitialized() → boolean
// Check if notation is initialized

getNotationComposer() → NotationComposer | null
// Get NotationComposer instance

getNoteEditor() → NoteEditor | null
// Get NoteEditor instance

getSuggestionManager() → object | null
// Get suggestion manager instance
```

### Rendering

```javascript
renderEnhancedNotation(canvas?) → void
// Render notation to canvas

refreshNotationFromProgression(preventScroll?) → void
// CRITICAL: Refresh notation from compositionState (call after progression changes)

updateMeasureBass(measureIndex, chord) → void
// Update bass for single measure
```

### Editor State

```javascript
setNotationDuration(duration) → void
// Set current note duration ('4n', '8n', etc.)

setNotationRestMode(isRest) → void
// Toggle rest mode

setNotationDotted(isDotted) → void
// Toggle dotted notes

setNotationAccidental(accidental) → void
// Set accidental ('#', 'b', 'n', null)

getNotationState() → object
// Get current editor state
```

### Playback

```javascript
highlightPlayingNote(measureIndex, staff, noteIndex, chord) → void
// Highlight note during playback

clearPlaybackHighlights() → void
// Clear all playback highlights
```

### Shortcuts

```javascript
showNotationShortcuts() → void
// Show keyboard shortcuts modal
```

### Cleanup

```javascript
destroyEnhancedNotation() → void
// Destroy notation system
```

---

## 🔊 AUDIO ENGINE
**File:** [src/modules/audio/audioEngine.js](../src/modules/audio/audioEngine.js)

### Initialization

```javascript
initAudio() → void
// Initialize Tone.js audio system (must be called on user interaction)

resumeAudioContextIfNeeded() → void
// Resume audio context if suspended

preWarmAudioContext() → void
// Pre-warm audio context to reduce latency

initAudioContextKeepAlive() → void
// Keep audio context alive with periodic pings
```

### Instrument Access

```javascript
getPiano() → Tone.Sampler | null
// Get piano instrument (main instrument)

getPianoReverb() → Tone.Reverb | null
// Get piano reverb effect

getGuitar() → Tone.Sampler | Tone.PluckSynth | null
// Get guitar instrument

getInstrument() → Tone.Sampler | Tone.PluckSynth | null
// Get current active instrument (usually piano)

getCameraShutter() → Tone.Player | null
// Get camera shutter sound effect
```

### Audio State

```javascript
getAudioIsLoading() → boolean
// Check if audio is loading

getAudioIsReady() → boolean
// Check if audio is ready

whenAudioReady(callback) → void
// Execute callback when audio ready

setAudioIsLoading(value) → void
// Set loading state

setAudioIsReady(value) → void
// Set ready state
```

### Playback

```javascript
forceStopAllPlayback(andClearHighlights?) → void
// Force stop all playing sounds
```

### Metronome

```javascript
getMetronomeSynth() → {downbeat, beat}
// Get metronome synth instances

getMetronomeEnabled() → boolean
// Check if metronome is enabled

setMetronomeEnabled(enabled) → void
// Enable/disable metronome

toggleMetronome() → boolean
// Toggle metronome, returns new state

startMetronome(beatsPerMeasure?, totalMeasures?) → void
// Start metronome playback

stopMetronome() → void
// Stop metronome

scheduleMetronomeClick(time, isDownbeat?) → void
// Schedule single metronome click
```

---

## 🎵 NOTE UTILITIES
**File:** [src/modules/utils/noteUtils.js](../src/modules/utils/noteUtils.js)

### Enharmonic & Key Spelling

```javascript
getEnharmonicPreferenceForKey(key) → 'sharp' | 'flat'
// Get preferred enharmonic spelling for key (C# = sharp, Db = flat)

spellNoteInKey(note, key) → string
// Spell note correctly for key (A# → Bb in key of Bb)

resolveEnharmonic(noteWithOctave, key, enharmonicPreference?) → string
// Resolve note with octave to correct enharmonic
```

### Note Conversion

```javascript
noteToMidi(note) → number
// Convert note name to MIDI number (C4 = 60)

getNoteKeyId(note) → string
// Get keyboard key ID for note
```

### Chord Generation

```javascript
getChordNotes(rootNoteName, chordType, key, octave?, enharmonicPreference?) → {notes, specificNotes}
// Generate chord notes
// notes: ['C', 'E', 'G']
// specificNotes: ['C4', 'E4', 'G4']

getInvertedChordNotes(rootNote, chordType, inversion, key, octaveShift?, enharmonicPreference?, notationPreference?) → {notes, specificNotes}
// Generate inverted chord notes
// inversion: 0 (root), 1 (1st), 2 (2nd), 3 (3rd)
```

### Intervals

```javascript
getIntervalNotes(rootNote, intervalType, octaveShift?, enharmonicPreference?) → {notes, specificNotes}
// Generate interval notes (e.g., Perfect 5th from C = G)

getLHNotes(rootNote, lhType, lhInversion?, key, lhOctaveShift, rhChordType?, enharmonicPreference?) → {notes, specificNotes}
// Generate left-hand bass notes
// lhType: 'root', 'fifth', 'octave', 'chord', 'off'
```

### Note Analysis

```javascript
getNotePitches(note) → string[]
// Get all pitches from note object (handles chords)

hasPitch(note) → boolean
// Check if note has pitch data (not a rest)

getPrimaryPitch(note) → string
// Get primary pitch (first pitch if chord)

isPolyphonic(note) → boolean
// Check if note is polyphonic (multiple pitches)
```

---

## 📊 MUSIC DATA CONSTANTS
**File:** [src/data/music-data.js](../src/data/music-data.js)

### Exported Constants

```javascript
ALL_NOTES
// All 12 chromatic notes: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

SHARP_NOTES
// Chromatic with sharps: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

FLAT_NOTES
// Chromatic with flats: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

MAJOR_SCALE_STEPS
// [0, 2, 4, 5, 7, 9, 11]

ROMAN_MAP_BASE
// Roman numeral to chord quality mapping

COMMON_PROGRESSIONS
// Array of {name, chords, category, description}

CHORD_DEFINITIONS
// CRITICAL: All chord types with intervals/symbols
// Format: { 'Major': {symbol: '', intervals: [0, 4, 7], ...}, 'Minor': {...}, ... }
// ALWAYS check this for valid chord.type values!

INVERSION_NAMES
// ['Root Position', '1st Inversion', '2nd Inversion', '3rd Inversion', ...]

INTERVAL_DEFINITIONS
// All interval definitions

CHORD_GROUPS
// Grouped chord types for UI

INTERVAL_GROUPS
// Grouped intervals for UI

SCALE_DEFINITIONS
// All scales with categories

ENHARMONIC_MAP
// Enharmonic equivalents: {'C#': 'Db', 'Db': 'C#', ...}

KEY_SIGNATURE_TEXT
// Text representations of key signatures

KEY_SIGNATURE_IMAGES
// Image paths for key signature images

RELATIVE_MINOR_MAP
// Major to relative minor: {'C': 'A', 'G': 'E', ...}

DIATONIC_CHORD_GROUPS
// Chords grouped by key

TIME_SIGNATURES
// Available time signatures

DEFAULT_TIME_SIGNATURE = {num: 4, denom: 4}
```

### Exported Functions

```javascript
generateDiatonicChords(key) → string[]
// Generate diatonic chord roots for key
// Example: generateDiatonicChords('C') → ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']
```

---

## 📦 KEY DATA STRUCTURES

### Chord Object

```javascript
{
  root: string,              // 'C', 'Bb', 'F#', etc.
  type: string,              // MUST match CHORD_DEFINITIONS key exactly!
  inversion: number,         // 0 = root, 1 = 1st, 2 = 2nd, 3 = 3rd
  notes: string[],           // ['C4', 'E4', 'G4'] - actual displayed notes
  beats: number,             // Duration in beats
  chordIndex: number,        // Position in progression
  omittedNotes: string[],    // Notes omitted from chord
  lhType: string,            // 'off' | 'root' | 'fifth' | 'octave' | 'chord'
  lhOctaveShift: number,     // Octave shift for left hand
  roman: string,             // 'I', 'ii', 'V', etc. (optional)
  name: string               // Display name (optional)
}
```

### Note Object

```javascript
{
  type: 'note' | 'rest',
  pitch: string,             // 'C4' (for single note)
  pitches: string[],         // ['C4', 'E4', 'G4'] (for chord)
  duration: string,          // '4n', '8n', '2n', '16n', etc. (Tone.js format)
  beat: number,              // Position in measure (0-based)
  dotted: boolean,           // Dotted note
  isRest: boolean,           // Is this a rest
  accidental: string | null, // '#', 'b', 'n', null
  articulation: string | null, // Articulation type
  tuplet: {type, num, val} | null, // Tuplet info
  tie: 'start' | 'continue' | 'end' | undefined, // Tie state
  chordIndex: number         // Index of owning chord
}
```

### Measure Object

```javascript
{
  chord: Chord,              // Chord object for this measure
  notation: {
    treble: {
      voices: [
        { notes: Note[] }    // Voice 1 notes
      ]
    },
    bass: {
      voices: [
        { notes: Note[] }    // Voice 1 notes
      ],
      autoGenerated: boolean // Whether bass is auto-generated
    }
  }
}
```

### ChordSegment Object

```javascript
{
  chordIndex: number,        // Index of chord
  startBeat: number,         // Absolute start position
  durationBeats: number,     // Duration in beats
  chord: Chord,              // Chord object reference
  bassNotes: Note[],         // Bass notes for this segment
  isEdited: boolean,         // User manually edited bass
  originalBassNotes: Note[]  // Original auto-generated bass (for restore)
}
```

### CollectedNote Object

```javascript
{
  note: Note,                // Note object
  absoluteBeat: number       // Absolute position in composition
}
```

---

## 🚀 CRITICAL SYNC PATTERN

When chord progression changes, **ALWAYS** call both functions in order:

```javascript
// 1. Sync progression data → compositionState
syncProgressionToMelodyComposer();

// 2. Sync compositionState → VexFlow notation display
refreshNotationFromProgression();
```

This ensures:
- CompositionState has latest chord data
- Notation display matches compositionState
- Bass auto-generation is triggered
- All systems stay synchronized

---

## ⚠️ CRITICAL PATTERNS FROM CLAUDE.MD

### Chord Type Naming

**ALWAYS use exact strings from CHORD_DEFINITIONS:**

✅ CORRECT:
- `"Major"`, `"Minor"`, `"Diminished"`, `"Augmented"`
- `"Sus2"`, `"Sus4"`
- `"Dominant 7th"`, `"Major 7th"`, `"Minor 7th"`
- `"Diminished 7th"`, `"Half-Diminished 7th"`

❌ WRONG:
- `"Maj7"`, `"Min7"`, `"Dom7"`
- `"Suspended 4th"`, `"Suspended 2nd"`
- `"Dim"`, `"Aug"`, `"m7b5"`

### Chord Playback

**ALWAYS use `chord.notes` array instead of regenerating:**

```javascript
// ✅ CORRECT - Use existing notes
const notes = chord.notes || [];
instrument.triggerAttack(notes);

// ❌ WRONG - Regenerating may produce different octaves
const res = getInvertedChordNotes(chord.root, chord.type, chord.inversion);
const notes = res?.specificNotes || [];
```

### Include Inversion Data

**ALWAYS include `inversion` when passing chord data:**

```javascript
// ✅ CORRECT
const chordData = {
  root: spellNoteInKey(chord.root, key),
  type: chord.type,
  inversion: chord.inversion || 0,
  notes: chord.notes
};

// ❌ WRONG - Missing inversion
const chordData = {
  root: chord.root,
  type: chord.type
};
```

### Enharmonic Spelling

**ALWAYS use `spellNoteInKey()` for display:**

```javascript
// ✅ CORRECT - Bb in key of Bb
const displayRoot = spellNoteInKey(chord.root, currentKey);

// ❌ WRONG - May show A# instead of Bb
const displayRoot = chord.root;
```

---

## 📚 See Also

- [MODULE_INDEX.md](MODULE_INDEX.md) - Module navigation guide
- [STATE_MANAGEMENT.md](STATE_MANAGEMENT.md) - State flow diagrams
- [CLAUDE.md](../CLAUDE.md) - Critical patterns and architecture
