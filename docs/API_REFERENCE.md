# API_REFERENCE.md

**Purpose:** Quick lookup for key function signatures without reading full files.

**Last Updated:** 2026-01-08 (Added Community, Admin, Backend API sections)

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

### Section Management (NEW)

```javascript
getSections() → Section[]
// Get all sections (verse, chorus, etc.)

getSection(sectionId) → Section | null
// Get section by ID

addSection(section) → string
// Add new section, returns section ID

updateSection(sectionId, updates) → void
// Update section properties

removeSection(sectionId) → boolean
// Remove section by ID

reorderSections(newOrder) → void
// Reorder sections by ID array

getChordsInSection(sectionId) → Chord[]
// Get all chords belonging to a section
```

### Measure Methods

```javascript
getMeasure(index) → Measure | null
// Get measure at index

getMeasures() → Measure[]
// Get all measures

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

## ⏱️ DURATION UTILITIES - Centralized Duration Handling
**File:** [src/modules/notation/durationUtils.js](../src/modules/notation/durationUtils.js)

**CRITICAL:** All duration operations should use these utilities to ensure consistent canonical format (separate `duration` and `dotted` properties).

### Constants

```javascript
DURATION_TO_BEATS = {
  '1n': 4, '2n': 2, '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125
}

BEATS_TO_DURATION = {
  4: '1n', 2: '2n', 1: '4n', 0.5: '8n', 0.25: '16n', 0.125: '32n'
}

DOTTED_BEATS = {
  '1n': 6, '2n': 3, '4n': 1.5, '8n': 0.75, '16n': 0.375, '32n': 0.1875
}
```

### Core Functions

```javascript
normalizeDottedState(note) → Note
// Ensure note has canonical format (dotted as separate boolean, not in duration string)
// Example: {duration: '2n.', dotted: undefined} → {duration: '2n', dotted: true}

isDotted(note) → boolean
// Check if note is dotted (handles both formats)

getBaseDuration(duration) → string
// Strip '.' from duration string if present
// Example: '2n.' → '2n'

beatsToDuration(beats) → { duration: string, dotted: boolean }
// Convert beats to canonical duration format
// Example: 3 beats → { duration: '2n', dotted: true }

beatsToDurationString(beats) → string
// Convert beats to Tone.js duration string (includes dot if needed)
// Example: 3 beats → '2n.'

durationToBeats(duration, dotted = false) → number
// Convert duration to beats
// Example: ('2n', true) → 3 beats

getNoteDurationInBeats(note) → number
// Get total beats for a note object (handles dotted correctly)

toVexFlowDuration(duration, dotted = false) → string
// Convert to VexFlow format ('h', 'q', 'hd', 'qd', etc.)
// Example: ('2n', true) → 'hd'

fromVexFlowDuration(vexDuration) → { duration: string, dotted: boolean }
// Convert VexFlow format to canonical format
// Example: 'hd' → { duration: '2n', dotted: true }

createNote({ pitches, beats, duration, dotted, beat, ...rest }) → Note
// Create properly formatted note with canonical duration format

validateDottedState(note) → { isValid: boolean, issues: string[] }
// Check if note has consistent dotted state
```

---

## 🎹 MEASURE ISOLATION EDITOR - Slot-Based Editing
**File:** [src/modules/notation/measureIsolation/](../src/modules/notation/measureIsolation/)

### SlotGrid Constants & Types

```javascript
UNITS_PER_SLOT = 6          // 32nd note = smallest slot
SLOTS_PER_BEAT = 8          // 48 units/beat ÷ 6 units/slot = 8 slots/beat

SLOT_TYPES = {
  EMPTY: 'empty',           // Available for notes
  NOTE_START: 'note',       // Note/chord starts here
  CONTINUATION: 'continuation',  // Previous note continues
  REST: 'rest'              // Explicit rest
}
```

### SlotGrid Functions

```javascript
durationToSlots(duration, dotted = false) → number
// Convert duration to number of slots
// Example: ('4n', false) → 8 slots

slotsToDuration(slots) → { duration: string, dotted: boolean }
// Convert slots to canonical duration format
// Example: 12 slots → { duration: '4n', dotted: true }
```

### SlotGrid Class

```javascript
class SlotGrid {
  constructor(timeSignature, voiceCount = 2)
  // Create grid for measure with given time signature

  fromMeasure(measureNotation) → this
  // Load notation data into grid

  toNotation() → { treble: {...}, bass: {...} }
  // Export grid to notation format

  setNote(clef, voice, slotIndex, pitches, durationSlots, options?) → boolean
  // Place a note at slot

  setRest(clef, voice, slotIndex, durationSlots) → boolean
  // Place a rest at slot

  clearSlots(clef, voice, startSlot, count) → void
  // Clear range of slots

  getSlot(clef, voice, slotIndex) → Slot
  // Get slot at position

  voiceHasContent(clef, voiceIndex) → boolean
  // Check if voice has any notes/rests

  getSlotBeatInfo(slotIndex) → { beat, isDownbeat, isHalfBeat }
  // Get beat position info for slot
}
```

### MeasureIsolationEditor

```javascript
getMeasureIsolationEditor(options?) → MeasureIsolationEditor
// Get or create singleton editor instance

openMeasureIsolationEditor(measureIndex, options?) → void
// Open editor for specific measure

class MeasureIsolationEditor {
  constructor(options?)

  open(measureIndex) → void
  // Open editor for measure

  close() → void
  // Close editor

  save() → void
  // Save changes to compositionState

  // Internal methods handle:
  // - Click-to-place notes
  // - Duration/pitch selection
  // - Voice switching (V1/V2)
  // - Clef switching (treble/bass)
  // - Real-time preview
}
```

---

## 🎵 PROGRESSION CONTROLLER - State & CRUD Operations
**File:** [src/modules/features/progressionBuilder/ProgressionController.js](../src/modules/features/progressionBuilder/ProgressionController.js)

### View & Selection State

```javascript
getProgressionViewMode() → 'all' | 'sections'
// Get current view mode

setProgressionViewMode(mode) → void
// Set view mode

getSelectedSectionIds() → string[]
// Get currently selected section IDs

selectSectionInView(sectionId, additive = false) → void
// Select section (additive adds to selection)

deselectSectionInView(sectionId) → void
// Deselect section

clearSectionSelection() → void
// Clear all section selections

selectSectionRange(targetSectionId, sections) → void
// Select range of sections (shift-click)

navigateToPreviousSection() / navigateToNextSection() → void
// Section navigation
```

### Chord CRUD Operations

```javascript
addChordToProgressionByParams(chordType, root, inversion = 0, octaveShift = 0) → void
// Add chord with parameters

addToProgressionData(chordData, options?) → void
// Add chord data object to progression

removeChordFromProgression(index) → void
// Remove chord at index

deleteSelectedChords(indices) → void
// Delete multiple selected chords

updateChordType(index, newType) → void
// Update chord type (e.g., 'Major' → 'Minor 7th')

updateChordRoot(index, newRoot) → void
// Update chord root (e.g., 'C' → 'D')

updateChordInversion(index, newInversion, shouldUpdateUI?, shouldSyncNotation?) → void
// Update chord inversion

updateChordDuration(index, sourceElement) → void
// Update chord duration (interactive, from dropdown)

finalizeDurationChange(index, totalBeats) → void
// Finalize duration change programmatically

updateChordVoicing(index, newVoicing) → void
// Update chord voicing

updateChordAndRenderPreservingTrebleNotes(index, options?) → void
// Update chord while preserving user's treble notes
```

### Transposition

```javascript
transposeTreble(oldKey, newKey) → void
// Transpose all treble notes from old key to new key

transposeTrebleWithModeAdjust(oldKey, newKey) → void
// Transpose with mode adjustment (major↔minor)

getKeyBasedEnharmonic() → 'sharp' | 'flat'
// Get enharmonic preference based on current key
```

### Undo/Redo

```javascript
saveStateBeforeChange() → void
// Save current state for undo (call BEFORE making changes)
// Integrates with versionHistory.js
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
```

### Audio State

```javascript
getAudioIsLoading() → boolean
// Check if audio is loading

getAudioIsReady() → boolean
// Check if audio is ready

whenAudioReady(callback) → void
// Execute callback when audio ready

forceStopAllPlayback(andClearHighlights?) → void
// Force stop all playing sounds
```

### Metronome

```javascript
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

CHORD_DEFINITIONS
// CRITICAL: All chord types with intervals/symbols
// Format: { 'Major': {symbol: '', intervals: [0, 4, 7], ...}, 'Minor': {...}, ... }
// ALWAYS check this for valid chord.type values!

COMMON_PROGRESSIONS
// Array of {name, chords, category, description}

TIME_SIGNATURES
// Available time signatures

DEFAULT_TIME_SIGNATURE = {num: 4, denom: 4}
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
  sectionId: string          // Section this chord belongs to (optional)
}
```

### Note Object (Canonical Format)

```javascript
{
  type: 'note' | 'rest',
  pitch: string,             // 'C4' (for single note)
  pitches: string[],         // ['C4', 'E4', 'G4'] (for chord)
  duration: string,          // '4n', '8n', '2n', '16n', etc. (NO dot suffix!)
  dotted: boolean,           // Separate dotted flag (ALWAYS use this format)
  beat: number,              // Position in measure (0-based)
  isRest: boolean,           // Is this a rest
  accidental: string | null, // '#', 'b', 'n', null
  articulation: string | null, // Articulation type
  voice: number,             // 0 or 1 for V1/V2
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
        { notes: Note[] },   // Voice 1 notes
        { notes: Note[] }    // Voice 2 notes (optional)
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

### Section Object

```javascript
{
  id: string,                // Unique section ID
  name: string,              // Display name ('Verse', 'Chorus', etc.)
  type: string,              // Section type
  color: string,             // Display color
  chordIndices: number[]     // Indices of chords in this section
}
```

### Slot Object (Measure Isolation)

```javascript
{
  type: SLOT_TYPES,          // 'empty', 'note', 'continuation', 'rest'
  pitches: string[],         // For notes: ['C4', 'E4']
  duration: string,          // Original duration
  dotted: boolean,           // Dotted flag
  durationSlots: number,     // Duration in slots
  articulation: string,      // Optional articulation
  dynamic: string,           // Optional dynamic marking
  tied: boolean,             // Tie to next note
  isTied: boolean            // Tied from previous note
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

### Canonical Duration Format

**ALWAYS use separate `dotted` property:**

```javascript
// ✅ CORRECT - Canonical format
{
  duration: '2n',
  dotted: true
}

// ❌ WRONG - Dot in duration string
{
  duration: '2n.'
}
```

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
```

---

## 🔐 AUTHENTICATION SERVICE
**File:** [src/modules/community/authService.js](../src/modules/community/authService.js)

### Initialization

```javascript
initAuthService() → Promise<{user, session}>
// Initialize auth service, get initial session, set up listeners

signInWithGoogle() → Promise<{provider, url}>
// Trigger Google OAuth sign-in flow (redirects to Google)

signOut() → Promise<boolean>
// Sign out current user
```

### User State

```javascript
getCurrentUser() → User | null
// Get current signed-in user object

getCurrentSession() → Session | null
// Get current session with tokens

isSignedIn() → boolean
// Quick check if user is signed in

getUserDisplayInfo() → {id, email, displayName, avatarUrl} | null
// Get user info for UI display
```

### Profile Management

```javascript
getUserProfile(forceRefresh?) → Promise<Profile | null>
// Get user profile from database (cached)

updateUserProfile(updates) → Promise<Profile>
// Update user profile (username, display_name, bio)

isUsernameAvailable(username) → Promise<boolean>
// Check if username is available for registration

getSubmissionDisplayName() → Promise<{displayName, isUsername, hasUsername}>
// Get name to show on submissions (prefers username)
```

### Auth Events

```javascript
onAuthStateChange(callback) → () => void
// Subscribe to auth changes, returns unsubscribe function
// callback receives (event, session)
// Events: 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED'

getAuthToken() → Promise<string | null>
// Get JWT token for API requests (auto-refreshes if needed)

refreshSession() → Promise<boolean>
// Manually refresh session token
```

---

## 📤 SHARE MODAL
**File:** [src/modules/community/shareModal.js](../src/modules/community/shareModal.js)

### Modal Control

```javascript
initShareModal() → void
// Initialize modal DOM element

showShareModal() → void
// Show share modal (checks for duplicates first)

hideShareModal() → void
// Hide share modal
```

### Submission Types

Two submission types are supported:
- `"chord-progression"`: Chord cards with durations, inversions, bass, sections (no melody)
- `"full-composition"`: Complete composition including melody, dynamics, articulations

---

## 🔍 COMMUNITY BROWSER
**File:** [src/modules/community/communityBrowser.js](../src/modules/community/communityBrowser.js)

### Browser Control

```javascript
showCommunityBrowser() → void
// Open community browser modal

hideCommunityBrowser() → void
// Close community browser modal

loadSubmission(submissionId) → Promise<void>
// Load a submission into the workspace
```

---

## 📂 MY SUBMISSIONS
**File:** [src/modules/community/mySubmissions.js](../src/modules/community/mySubmissions.js)

```javascript
showMySubmissions() → void
// Show modal with user's own submissions

hideMySubmissions() → void
// Close my submissions modal
```

---

## 📍 LOADED SUBMISSION CONTEXT
**File:** [src/modules/community/loadedSubmissionContext.js](../src/modules/community/loadedSubmissionContext.js)

Tracks when a submission is loaded for editing (enables "Update" vs "Save as New").

```javascript
setLoadedSubmissionContext(context) → void
// Set context when loading own submission for editing
// context: {submissionId, title, description, status, submissionType, category}

getLoadedSubmissionContext() → LoadedContext | null
// Get current loaded submission context

hasLoadedSubmissionContext() → boolean
// Check if a submission is loaded for editing

clearLoadedSubmissionContext() → void
// Clear context (on new composition, publish, or "Save as New")

getLoadedSubmissionTitle() → string | null
// Get title for UI display
```

---

## 🔑 ADMIN SERVICE
**File:** [src/modules/admin/adminService.js](../src/modules/admin/adminService.js)

### Admin Status

```javascript
checkAdminStatus() → Promise<{isAdmin: boolean, email?: string}>
// Check if current user is admin (cached 5 minutes)

clearAdminCache() → void
// Clear admin status cache (call on sign out)
```

### Dashboard Stats

```javascript
getAdminStats() → Promise<Stats>
// Get dashboard statistics
```

### Submission Management

```javascript
getSubmissions(options?) → Promise<{submissions, total, page}>
// Get submissions list with filtering
// options: {search, status, type, sort, page, limit}

getSubmission(id) → Promise<Submission>
// Get single submission by ID

updateSubmission(id, updates, reason?) → Promise<Submission>
// Update submission (status, featured, etc.)

deleteSubmission(id, reason?) → Promise<{success: boolean}>
// Delete a submission
```

### User Management

```javascript
getUsers(options?) → Promise<{users, total, page}>
// Get users list with filtering
// options: {search, blocked, sort, page, limit}

getUser(id) → Promise<User>
// Get single user by ID

blockUser(userId, reason, scope?) → Promise<User>
// Block a user (scope: 'all' | 'submissions')

unblockUser(userId, reason?) → Promise<User>
// Unblock a user
```

### Content Moderation (Flags)

```javascript
getFlags(options?) → Promise<{flags, total, page}>
// Get flags list (admin only)
// options: {status, reason, search, sort, page, limit}

getFlag(id) → Promise<Flag>
// Get single flag by ID

updateFlag(id, status, resolutionNotes?) → Promise<Flag>
// Update flag status (resolved, dismissed, etc.)

deleteFlag(id) → Promise<{success: boolean}>
// Delete a flag

submitFlag(submissionId, reason, description?) → Promise<Flag>
// Submit a flag/report (any authenticated user)
```

### App Settings

```javascript
getAppSettings() → Promise<{settings: Setting[]}>
// Get all app settings

getAppSetting(key) → Promise<{setting: Setting}>
// Get specific setting by key

updateAppSetting(key, value) → Promise<Setting>
// Update app setting (admin only)

getProgressionChordLimit() → Promise<{limit: number | null, enabled: boolean}>
// Get chord limit setting (public, for share modal)
```

### User Submission Management (non-admin)

```javascript
updateOwnSubmission(id, updates) → Promise<Submission>
// Update own submission (authenticated user)

getSubmissionVersions(submissionId) → Promise<{versions: Version[]}>
// Get version history for own submission

getSubmissionVersion(submissionId, versionId) → Promise<{version: Version}>
// Get specific version with full composition data

restoreSubmissionVersion(submissionId, versionId) → Promise<Submission>
// Restore a previous version
```

---

## 🌐 BACKEND API ENDPOINTS

### Submissions API (`/api/submissions`)
```
GET  /api/submissions          - Browse/search submissions
POST /api/submissions          - Create new submission (auth required)
PUT  /api/submissions          - Update own submission (auth required)
```

Query parameters for GET:
- `search`: Text search
- `type`: 'chord-progression' | 'full-composition'
- `category`: 'original', 'arrangement', etc.
- `tags`: Comma-separated tag slugs
- `key`: Key signature filter
- `sort`: 'newest' | 'popular' | 'trending'
- `page`, `limit`: Pagination

### Admin API
```
GET    /api/admin-check        - Check if user is admin
GET    /api/admin-stats        - Dashboard statistics
GET    /api/admin-submissions  - List submissions (admin)
PUT    /api/admin-submissions  - Update submission (admin)
DELETE /api/admin-submissions  - Delete submission (admin)
GET    /api/admin-users        - List users (admin)
PUT    /api/admin-users        - Block/unblock user (admin)
```

### Social API
```
POST /api/upvote               - Upvote a submission (auth required)
GET  /api/flags                - Get flags (admin only)
POST /api/flags                - Submit flag (auth required)
PUT  /api/flags                - Update flag (admin only)
GET  /api/tags                 - Get available tags
```

### Version API
```
GET  /api/submission-versions  - Get version history
POST /api/submission-versions  - Restore a version
```

---

## 📦 COMMUNITY DATA STRUCTURES

### User Profile
```javascript
{
  id: string,                   // Supabase user ID
  username: string | null,      // Unique username (optional)
  display_name: string | null,  // Display name
  avatar_url: string | null,    // Profile image URL
  bio: string | null,           // User bio
  created_at: string,           // ISO timestamp
  updated_at: string            // ISO timestamp
}
```

### Submission
```javascript
{
  id: string,                   // Unique submission ID
  user_id: string,              // Owner's user ID
  title: string,                // Submission title
  description: string | null,   // Description
  submission_type: string,      // 'chord-progression' | 'full-composition'
  category: string,             // 'original', 'arrangement', etc.
  status: string,               // 'draft' | 'published' | 'hidden'
  composition_data: object,     // Full composition JSON
  chord_sequence: string,       // Normalized chord string (for search)
  key_signature: string,        // Key of the piece
  upvote_count: number,         // Number of upvotes
  view_count: number,           // Number of views
  base_hash: string,            // Hash for duplicate detection (chord family)
  variant_hash: string,         // Hash including durations/inversions
  created_at: string,
  updated_at: string,
  tags: string[]                // Tag slugs
}
```

### Flag (Content Report)
```javascript
{
  id: string,
  submission_id: string,
  reporter_id: string,
  reason: string,               // 'inappropriate', 'spam', 'copyright', 'other'
  description: string | null,   // Additional details
  status: string,               // 'pending', 'resolved', 'dismissed'
  resolution_notes: string | null,
  resolved_by: string | null,
  created_at: string,
  resolved_at: string | null
}
```

### Loaded Submission Context
```javascript
{
  submissionId: string,
  title: string,
  description: string,
  status: string,               // 'published' | 'draft'
  submissionType: string,       // 'chord-progression' | 'full-composition'
  category: string,
  loadedAt: number              // Timestamp
}
```

---

## 📚 See Also

- [MODULE_INDEX.md](MODULE_INDEX.md) - Module navigation guide
- [STATE_MANAGEMENT.md](STATE_MANAGEMENT.md) - State flow diagrams
- [CLAUDE.md](../CLAUDE.md) - Critical patterns and architecture
