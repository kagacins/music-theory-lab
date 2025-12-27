# STATE_MANAGEMENT.md

**Purpose:** Visual data flow diagrams and state synchronization patterns.

**Last Updated:** 2025-12-26

---

## 🎯 CORE STATE ARCHITECTURE

### Single Source of Truth

```
┌─────────────────────────────────────────────────────────────┐
│                    CompositionState                         │
│            (src/modules/state/compositionState.js)          │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ measures: [                                        │    │
│  │   {                                                │    │
│  │     chord: {root, type, inversion, notes, beats}   │    │
│  │     notation: {                                    │    │
│  │       treble: {voices: [{notes: [...]}]}           │    │
│  │       bass: {voices: [{notes: [...]}]}             │    │
│  │     }                                               │    │
│  │   }                                                 │    │
│  │ ]                                                   │    │
│  │                                                     │    │
│  │ settings: {key, tempo, timeSignature}               │    │
│  │ metadata: {title, composer, ...}                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  Events: 'measureAdded', 'measureUpdated',                  │
│          'chordUpdated', 'settingsChanged'                  │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle:** CompositionState is the **ONLY** source of truth for:
- Chord progressions
- Measure structure
- Bass and treble notes
- Composition settings

All other state managers delegate to CompositionState.

---

## 🔄 STATE SYNCHRONIZATION PATTERNS

### Pattern 1: Chord Progression Update

```
┌──────────────────┐
│  User Action     │
│ (progressionBuilder.js)
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ compositionState.setProgressionData()      │
│ compositionState.updateChord()             │
│ compositionState.addMeasure()              │
└────────┬───────────────────────────────────┘
         │
         ├─────────────────────────────────────┐
         │                                     │
         ▼                                     ▼
┌─────────────────────────┐      ┌──────────────────────────┐
│ Event: 'measureUpdated' │      │ Event: 'chordUpdated'    │
└────────┬────────────────┘      └────────┬─────────────────┘
         │                                │
         ▼                                ▼
┌─────────────────────────────────────────────────────┐
│ syncProgressionToMelodyComposer()                   │
│ (integration/melodyComposerBridge.js)               │
│                                                     │
│ - Updates any legacy interactiveMelody references   │
│ - Triggers bass auto-generation                     │
│ - Emits sync events                                 │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│ refreshNotationFromProgression()                    │
│ (notation/notationInit.js)                          │
│                                                     │
│ - Calls NotationComposer.render()                   │
│ - Updates VexFlow display                           │
│ - Highlights current measure                        │
└────────┬────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  VexFlow Canvas  │
│  (Visible Update)│
└──────────────────┘
```

**CRITICAL:** Always call both sync functions in order:
```javascript
syncProgressionToMelodyComposer();  // 1. Sync data
refreshNotationFromProgression();    // 2. Update display
```

---

### Pattern 2: Notation Edit (Bi-Directional Sync)

```
┌──────────────────┐
│  User Clicks     │
│  Staff Note      │
│ (noteEditor.js)  │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ compositionState.addNote()                 │
│ compositionState.updateNote()              │
│ compositionState.removeNote()              │
└────────┬───────────────────────────────────┘
         │
         ├─────────────────────────────────────┐
         │                                     │
         ▼                                     ▼
┌─────────────────────────┐      ┌──────────────────────────┐
│ NotationComposer        │      │ ProgressionNotationSync  │
│ .updateMeasure()        │      │ .updateProgressionFrom   │
│                         │      │  Notation()              │
│ Updates VexFlow display │      │                          │
│                         │      │ Updates chord cards if   │
│                         │      │ chord was edited         │
└─────────────────────────┘      └──────────────────────────┘
```

**Note:** Notation → Progression sync is **DISABLED** by default to prevent circular updates. Only chord-level changes sync back to progression cards.

---

### Pattern 3: Bass Auto-Generation

```
┌──────────────────┐
│ Chord Added/     │
│ Changed          │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ compositionState.updateBassFromChord()     │
│                                            │
│ IF bass is auto-generated:                 │
│   - Get bass pattern (root/fifth/octave)   │
│   - Generate bass notes from chord         │
│   - Populate bass staff                    │
└────────┬───────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ bassAutoFill.generateBassVoicing()         │
│ (integration/bassAutoFill.js)              │
│                                            │
│ - Uses BuildingBlockSequence              │
│ - Respects chord duration                  │
│ - Applies user octave preferences          │
└────────┬───────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ compositionState.measures[i].notation.bass │
│ Updated with new bass notes                │
└────────┬───────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ refreshNotation  │
│ FromProgression()│
└──────────────────┘
```

**User Edit Detection:**
- If user manually edits bass → `bass.autoGenerated = false`
- Auto-generation skips edited measures
- "Regenerate All Bass" resets autoGenerated flags

---

## 🏗️ STATE MANAGER HIERARCHY

```
┌─────────────────────────────────────────────────────────────┐
│                      GlobalState                            │
│              (src/modules/state/globalState.js)             │
│                                                             │
│  App-wide settings:                                         │
│  - Current tab (Builder/Trainer/Melody/Learn)               │
│  - Enharmonic preference (sharp/flat)                       │
│  - Dark mode                                                │
│  - Notation display preferences                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   CompositionState ⭐                        │
│            (src/modules/state/compositionState.js)          │
│                                                             │
│  SINGLE SOURCE OF TRUTH:                                    │
│  - All chord progression data                               │
│  - All measures and notation                                │
│  - Bass and treble notes                                    │
│  - Composition settings (key, tempo, time sig)              │
│                                                             │
│  Used by: Everything                                        │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────┐  ┌──────────────────────────┐
│      TrainerState        │  │      BuilderState        │
│  (trainerState.js)       │  │   (builderState.js)      │
│                          │  │                          │
│  UI state only:          │  │  UI state only:          │
│  - Selected chord index  │  │  - Selected root         │
│  - Playback position     │  │  - Selected type         │
│  - Panel visibility      │  │  - Selected inversion    │
│                          │  │  - Preview chord         │
│  Delegates data to:      │  │                          │
│  CompositionState ───────┤  │  Delegates data to:      │
│                          │  │  CompositionState ───────┤
└──────────────────────────┘  └──────────────────────────┘
              │                           │
              └───────────┬───────────────┘
                          │
                          ▼
                ┌─────────────────────┐
                │  CompositionState   │
                │  (shared)           │
                └─────────────────────┘
```

**Key Design:**
- TrainerState and BuilderState **DO NOT** store chord/progression data
- They only store UI-specific state (selections, visibility, playback position)
- All data operations delegate to CompositionState

---

## 📦 DATA STRUCTURES & OWNERSHIP

### Chord Data

```javascript
{
  root: "C",              // Owned by: CompositionState.measures[i].chord
  type: "Major 7th",      // Owned by: CompositionState.measures[i].chord
  inversion: 0,           // Owned by: CompositionState.measures[i].chord
  notes: ["C4","E4","G4","B4"], // Owned by: CompositionState.measures[i].chord
  beats: 4,               // Owned by: CompositionState.measures[i].chord
  chordIndex: 0           // Position in progression
}
```

**Mutation Rules:**
- ✅ Update via: `compositionState.updateChord(index, {root: 'D'})`
- ❌ NEVER: Direct mutation of `measures[i].chord.root = 'D'`
- **Why:** CompositionState emits events for sync

---

### Note Data

```javascript
{
  pitches: ["C4"],        // Owned by: CompositionState.measures[i].notation.treble.voices[0].notes[j]
  duration: "4n",         // Owned by: CompositionState.measures[i].notation.treble.voices[0].notes[j]
  dotted: false,          // Owned by: CompositionState.measures[i].notation.treble.voices[0].notes[j]
  beat: 0,                // Position within measure
  chordIndex: 0           // Reference to owning chord
}
```

**Mutation Rules:**
- ✅ Update via: `compositionState.updateNote(measureIndex, staff, voiceIndex, noteIndex, {duration: '8n'})`
- ❌ NEVER: Direct mutation of note properties
- **Why:** Triggers VexFlow re-render

---

### Bass Auto-Generation State

```javascript
{
  autoGenerated: true,    // Owned by: CompositionState.measures[i].notation.bass
  originalBassNotes: [],  // Owned by: ChordSegment (for restore)
  isEdited: false         // Owned by: ChordSegment
}
```

**State Transitions:**
```
[Auto-generated] ──user edits bass──> [Manually Edited]
        │                                     │
        │                                     │
        └──"Regenerate All Bass"──────────────┘
                       │
                       ▼
              [Auto-generated]
```

---

## 🎵 BuildingBlock System (Timing Abstraction)

```
┌─────────────────────────────────────────────────────────────┐
│              BuildingBlockSequence                          │
│           (src/modules/state/buildingBlock.js)              │
│                                                             │
│  Represents musical time as discrete units:                 │
│  - 1 beat = 48 units                                        │
│  - 4/4 measure = 192 units                                  │
│                                                             │
│  ┌───────┬───────┬───────┬───────┐                         │
│  │ Beat1 │ Beat2 │ Beat3 │ Beat4 │  (4/4 measure)          │
│  │ 48u   │ 48u   │ 48u   │ 48u   │                         │
│  └───────┴───────┴───────┴───────┘                         │
│                                                             │
│  Chord segments map to beat ranges:                         │
│  Chord 0: beats 0-3 (units 0-191)                           │
│  Chord 1: beats 4-7 (units 192-383)                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   ChordSegment                              │
│                                                             │
│  {                                                          │
│    chordIndex: 0,                                           │
│    startBeat: 0,          // Absolute beat position         │
│    durationBeats: 4,      // Chord duration                 │
│    chord: {Chord},        // Reference to chord data        │
│    bassNotes: [Note],     // Bass notes in this segment     │
│    isEdited: false,       // User edited bass?              │
│    originalBassNotes: []  // For restore                    │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

**Usage:**
- Bass auto-generation uses ChordSegments to know which beats belong to which chord
- When chord duration changes → ChordSegments rebuilt
- Bass notes are truncated/extended to fit new segment boundaries

---

## 🔔 EVENT SYSTEM

### CompositionState Events

```javascript
compositionState.on('measureAdded', (measureIndex) => {
  // New measure was added at index
});

compositionState.on('measureUpdated', (measureIndex) => {
  // Measure data changed (chord or notes)
});

compositionState.on('measureRemoved', (measureIndex) => {
  // Measure was deleted
});

compositionState.on('chordUpdated', (measureIndex) => {
  // Chord properties changed (root, type, inversion)
});

compositionState.on('settingsChanged', (settings) => {
  // Key, tempo, or time signature changed
});

compositionState.on('cleared', () => {
  // All measures removed
});
```

**Subscribers:**
- `NotationComposer` - Re-renders affected measures
- `ProgressionNotationSync` - Updates progression cards
- `melodyComposerBridge` - Syncs to legacy formats
- UI components - Update displays

---

## 🚨 CRITICAL SYNC SEQUENCE

### When Loading a Saved Composition

```javascript
// CORRECT ORDER:

// 1. Import progression data → compositionState
compositionState.importFromProgressionData(savedProgressionData);

// 2. Sync any legacy format references
syncProgressionToMelodyComposer();

// 3. Update VexFlow notation display
refreshNotationFromProgression();

// 4. Update UI state
trainerState.setCurrentChordIndex(0);
```

**Why This Order Matters:**
1. CompositionState must be populated first (source of truth)
2. Legacy format sync ensures backward compatibility
3. Notation render requires compositionState to be ready
4. UI state depends on composition data existing

---

### When User Edits a Chord Card

```javascript
// CORRECT FLOW:

// 1. User clicks "Change Root" on chord card
// progressionBuilder.js calls:
compositionState.updateChord(index, { root: 'D' });

// 2. CompositionState emits 'chordUpdated' event
// NotationComposer listens and re-renders measure

// 3. Sync functions update related systems
syncProgressionToMelodyComposer();  // Legacy format sync
refreshNotationFromProgression();    // VexFlow update

// 4. Bass regeneration (if auto-generated)
compositionState.updateBassFromChord(index);
```

**Anti-Pattern (DO NOT DO THIS):**
```javascript
// ❌ WRONG - Updating progressionData directly
progressionData[index].root = 'D';
updateChordCard(index);
// This bypasses CompositionState and breaks sync!
```

---

## 🧩 COMMON SYNC SCENARIOS

### Scenario 1: Add New Chord

```javascript
// Add measure with chord
const newIndex = compositionState.addMeasure({
  root: 'C',
  type: 'Major',
  inversion: 0,
  beats: 4
});

// Sync
syncProgressionToMelodyComposer();
refreshNotationFromProgression();
```

### Scenario 2: Change Chord Duration

```javascript
// Update duration (handles bass truncation automatically)
compositionState.updateChordDuration(chordIndex, newBeats);

// Rebuild chord segments (for bass alignment)
compositionState.buildChordSegments();

// Sync
syncProgressionToMelodyComposer();
refreshNotationFromProgression();
```

### Scenario 3: Change Time Signature

```javascript
// Update settings
compositionState.updateSettings({
  timeSignature: { num: 3, denom: 4 }
});

// Redistribute notes across new measure boundaries
// (handled internally by compositionState)

// Sync
syncProgressionToMelodyComposer();
refreshNotationFromProgression();
```

### Scenario 4: Manually Edit Bass

```javascript
// User adds/edits bass note
compositionState.addNote(measureIndex, 'bass', 0, {
  pitches: ['C2'],
  duration: '4n',
  beat: 0
});

// This automatically marks bass as edited:
// measures[measureIndex].notation.bass.autoGenerated = false

// Future auto-generation will skip this measure
```

### Scenario 5: Regenerate All Bass

```javascript
// Save edited bass notes first (for potential restore)
compositionState.saveEditedBassNotes();

// Regenerate all auto-generated bass
compositionState.regenerateAllAutoBassByBuildingBlock();

// Restore any manually edited bass
compositionState.restoreEditedBassNotes();

// Sync
refreshNotationFromProgression();
```

---

## 🎯 STATE ACCESS PATTERNS

### Getting Current State

```javascript
// Get composition state instance
const compState = getCompositionState();

// Get specific measure
const measure = compState.getMeasure(index);

// Get chord
const chord = compState.getChord(index);

// Get notes
const trebleNotes = compState.getNotes(measureIndex, 'treble', 0);
const bassNotes = compState.getNotes(measureIndex, 'bass', 0);

// Get settings
const settings = compState.getSettings(); // {key, tempo, timeSignature}
```

### Modifying State

```javascript
// Update chord
compState.updateChord(index, {
  root: 'D',
  type: 'Minor 7th',
  inversion: 1
});

// Add note
compState.addNote(measureIndex, 'treble', 0, {
  pitches: ['C4'],
  duration: '4n',
  dotted: false,
  beat: 0
});

// Update note
compState.updateNote(measureIndex, 'treble', 0, noteIndex, {
  duration: '8n'
});

// Remove note
compState.removeNote(measureIndex, 'treble', 0, noteIndex);
```

---

## 📋 STATE DEBUGGING

### Debug Current State

```javascript
// In browser console:

// View entire composition state
window.getCompositionState().getMeasures();

// View specific measure
window.getCompositionState().getMeasure(0);

// View chord segments (bass alignment)
window.getCompositionState().getChordSegments();

// Export to progression data format
window.getCompositionState().exportToProgressionData();

// View settings
window.getCompositionState().getSettings();
```

### Common Issues & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| Notation not updating | VexFlow shows old data | Call `refreshNotationFromProgression()` |
| Chord cards out of sync | Cards show different data than notation | Call `syncProgressionToMelodyComposer()` |
| Bass notes wrong | Bass doesn't match chord | Call `compositionState.updateBassFromChord(index)` |
| Event not firing | Listeners not receiving events | Check event name spelling, ensure listener added |
| Circular update loop | Infinite re-renders | Check for bi-directional sync; disable notation→progression sync |

---

## 🔗 RELATED DOCUMENTS

- [MODULE_INDEX.md](MODULE_INDEX.md) - Find state-related modules
- [API_REFERENCE.md](API_REFERENCE.md) - CompositionState API details
- [CLAUDE.md](../CLAUDE.md) - Critical patterns and conventions

---

## 💡 BEST PRACTICES

### DO:
- ✅ Always update state through CompositionState methods
- ✅ Call sync functions after state changes
- ✅ Use event listeners for cross-module communication
- ✅ Check `autoGenerated` flag before regenerating bass
- ✅ Emit events after state mutations

### DON'T:
- ❌ Mutate measure/chord objects directly
- ❌ Skip `syncProgressionToMelodyComposer()` before `refreshNotationFromProgression()`
- ❌ Enable bi-directional notation↔progression sync (causes loops)
- ❌ Regenerate bass without saving edited notes first
- ❌ Forget to rebuild chord segments after duration changes

---

**Last Updated:** 2025-12-26
