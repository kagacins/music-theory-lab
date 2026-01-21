# STATE_MANAGEMENT.md

**Purpose:** Visual data flow diagrams and state synchronization patterns.

**Last Updated:** 2026-01-20 (Added Coach Engine, Experience Modes, Pattern Detection state flows)

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
│  │ sections: [                                         │    │
│  │   {id, name, type, color, chordIndices}            │    │
│  │ ]                                                   │    │
│  │                                                     │    │
│  │ settings: {key, tempo, timeSignature}               │    │
│  │ metadata: {title, composer, ...}                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  Events: 'measureAdded', 'measureUpdated', 'measureRemoved',│
│          'chordUpdated', 'settingsChanged', 'sectionChanged'│
└─────────────────────────────────────────────────────────────┘
```

**Key Principle:** CompositionState is the **ONLY** source of truth for:
- Chord progressions
- Measure structure
- Bass and treble notes
- Sections (verse, chorus, etc.)
- Composition settings

All other state managers delegate to CompositionState.

---

## 🔄 STATE SYNCHRONIZATION PATTERNS

### Pattern 1: Chord Progression Update

```
┌──────────────────┐
│  User Action     │
│ (progressionBuilder/)
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ saveStateBeforeChange()  ← ALWAYS first!   │
│ (ProgressionController.js - for undo)      │
└────────┬───────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ compositionState.updateChord()             │
│ compositionState.addMeasure()              │
│ compositionState.setProgressionData()      │
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
saveStateBeforeChange();           // 0. Save for undo (BEFORE changes)
// ... make changes ...
syncProgressionToMelodyComposer(); // 1. Sync data
refreshNotationFromProgression();  // 2. Update display
```

---

### Pattern 2: Notation Edit (Main Canvas)

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

### Pattern 3: Measure Isolation Modal Editing (NEW)

```
┌───────────────────────────┐
│  User Opens Measure       │
│  Isolation Modal          │
│ (double-click measure)    │
└────────┬──────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ openMeasureIsolationEditor(measureIndex)               │
│ (notation/measureIsolation/MeasureIsolationEditor.js)  │
└────────┬───────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ SlotGrid.fromMeasure(measureNotation)                  │
│ (notation/measureIsolation/SlotGrid.js)                │
│                                                        │
│ - Converts notation to 32nd-note slot grid             │
│ - 8 slots per beat, supports V1/V2                     │
│ - Creates editable representation                      │
└────────┬───────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ User Edits in Modal                                    │
│                                                        │
│ - Click slots to add/remove notes                      │
│ - Select duration, pitch, voice                        │
│ - Real-time preview via internal VexFlow render        │
└────────┬───────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ User clicks "Save" or "Apply"                          │
└────────┬───────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ SlotGrid.toNotation()                                  │
│                                                        │
│ - Converts slots back to notation format               │
│ - Generates optimal rests for empty slots              │
│ - V2 rests: invisible if no content, cue if has content│
└────────┬───────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ compositionState.updateMeasure() or direct assignment  │
│ refreshNotationFromProgression()                       │
└────────┬───────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│  Main VexFlow    │
│  Canvas Updated  │
└──────────────────┘
```

**V2 Rest Rules in SlotGrid:**
1. V1 always gets complete rhythmic representation (regular rests)
2. V2 is invisible when it has no content (no rests generated)
3. V2 filler rests are ALWAYS cue rests when V2 has content
4. Overlapping rests: if V1 has rest at same position, V2 rest is hidden

---

### Pattern 4: Bass Auto-Generation

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

### Pattern 5: Section Management (NEW)

```
┌──────────────────┐
│ User Creates/    │
│ Modifies Section │
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ compositionState.addSection()              │
│ compositionState.updateSection()           │
│ compositionState.removeSection()           │
└────────┬───────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ Update chord.sectionId for affected chords │
│ Emit 'sectionChanged' event                │
└────────┬───────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ renderProgressionDisplay()                 │
│ (progressionBuilder/ProgressionRenderer.js)│
│                                            │
│ - Renders section pills/chips              │
│ - Groups chords by section                 │
│ - Updates section banners                  │
└────────┬───────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│ refreshNotationFromProgression()           │
│ - Section labels appear in notation        │
└──────────────────────────────────────────────┘
```

---

### Pattern 6: Drag-and-Drop Reordering

```
┌──────────────────────────────────────────────┐
│ User Drags Chord Card or Section             │
│ (Sortable.js)                                │
└────────┬─────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────┐
│ saveStateBeforeChange()  ← BEFORE move!        │
│ (ProgressionDragDrop.js)                       │
└────────┬───────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────┐
│ handleCardDragWithinSection(evt, sectionId)    │
│ OR                                             │
│ handleSectionDragEnd(container, item, evt)     │
│ (ProgressionDragDrop.js)                       │
└────────┬───────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────┐
│ Reorder chords in compositionState             │
│ Update chord indices                           │
│ Update section.chordIndices if needed          │
└────────┬───────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────┐
│ renderProgressionDisplay()                     │
│ refreshNotationFromProgression()               │
└────────────────────────────────────────────────┘
```

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
│  - Bass and treble notes (V1 and V2)                        │
│  - Sections (verse, chorus, bridge, etc.)                   │
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
│  - Selection state       │  │  - Preview chord         │
│                          │  │                          │
│  Delegates data to:      │  │  Delegates data to:      │
│  CompositionState ───────┤  │  CompositionState ───────┤
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
  chordIndex: 0,          // Position in progression
  sectionId: "section_1"  // Which section this chord belongs to
}
```

**Mutation Rules:**
- ✅ Update via: `compositionState.updateChord(index, {root: 'D'})`
- ❌ NEVER: Direct mutation of `measures[i].chord.root = 'D'`
- **Why:** CompositionState emits events for sync

---

### Note Data (Canonical Format)

```javascript
{
  pitches: ["C4"],        // Owned by: compositionState.measures[i].notation.treble.voices[0].notes[j]
  duration: "4n",         // NO dot suffix! Use dotted property
  dotted: false,          // Separate boolean for dotted state
  beat: 0,                // Position within measure
  voice: 0,               // 0 or 1 for V1/V2
  chordIndex: 0           // Reference to owning chord
}
```

**Mutation Rules:**
- ✅ Update via: `compositionState.updateNote(measureIndex, staff, voiceIndex, noteIndex, {duration: '8n'})`
- ❌ NEVER: Direct mutation of note properties
- **Why:** Triggers VexFlow re-render

---

### Section Data (NEW)

```javascript
{
  id: "section_abc123",   // Unique ID
  name: "Verse",          // Display name
  type: "verse",          // Section type
  color: "#4CAF50",       // Display color
  chordIndices: [0, 1, 2, 3]  // Indices of chords in this section
}
```

**Mutation Rules:**
- ✅ Update via: `compositionState.updateSection(sectionId, {name: 'Chorus'})`
- ❌ NEVER: Direct mutation

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
```

### SlotGrid System (Measure Isolation)

```
┌─────────────────────────────────────────────────────────────┐
│                      SlotGrid                               │
│       (src/modules/notation/measureIsolation/SlotGrid.js)   │
│                                                             │
│  Represents measure as 32nd-note slots:                     │
│  - 1 slot = 6 units (32nd note granularity)                 │
│  - 1 beat = 8 slots                                         │
│  - 4/4 measure = 32 slots                                   │
│                                                             │
│  ┌─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┬─┐
│  │ Beat 1      │ Beat 2      │ Beat 3      │ Beat 4      │
│  │ 8 slots     │ 8 slots     │ 8 slots     │ 8 slots     │
│  └─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┴─┘
│                                                             │
│  Slot Types:                                                │
│  - EMPTY: Available for notes                               │
│  - NOTE_START: Note/chord begins here                       │
│  - CONTINUATION: Previous note extends through              │
│  - REST: Explicit rest placed here                          │
└─────────────────────────────────────────────────────────────┘
```

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

compositionState.on('sectionChanged', (sectionId) => {
  // Section was added, updated, or removed
});

compositionState.on('cleared', () => {
  // All measures removed
});
```

**Subscribers:**
- `NotationComposer` - Re-renders affected measures
- `ProgressionNotationSync` - Updates progression cards
- `melodyComposerBridge` - Syncs to legacy formats
- `ProgressionRenderer` - Updates chord cards and sections
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

// 0. Save state for undo FIRST
saveStateBeforeChange();

// 1. User clicks "Change Root" on chord card
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
// Save for undo
saveStateBeforeChange();

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
// Save for undo
saveStateBeforeChange();

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

### Scenario 5: Create New Section

```javascript
// Save for undo
saveStateBeforeChange();

// Add section
const sectionId = compositionState.addSection({
  name: 'Chorus',
  type: 'chorus',
  color: '#2196F3',
  chordIndices: [4, 5, 6, 7]
});

// Update chord cards to show section
renderProgressionDisplay('progression-visualization', true);
refreshNotationFromProgression();
```

### Scenario 6: Drag Chord to Different Section

```javascript
// Save for undo (in drag handler)
saveStateBeforeChange();

// Update chord's section assignment
compositionState.updateChord(chordIndex, { sectionId: newSectionId });

// Update section's chordIndices
compositionState.updateSection(oldSectionId, {
  chordIndices: oldSection.chordIndices.filter(i => i !== chordIndex)
});
compositionState.updateSection(newSectionId, {
  chordIndices: [...newSection.chordIndices, chordIndex]
});

// Re-render
renderProgressionDisplay('progression-visualization', true);
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

// Get sections
const sections = compState.getSections();
const section = compState.getSection(sectionId);

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

// Update section
compState.updateSection(sectionId, { name: 'Chorus 2' });
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

// View sections
window.getCompositionState().getSections();

// Export to progression data format
window.getCompositionState().exportToProgressionData();

// View settings
window.getCompositionState().getSettings();

// Force notation refresh
window.refreshNotationFromProgression();

// Force sync
window.syncProgressionToMelodyComposer();
```

### Common Issues & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| Notation not updating | VexFlow shows old data | Call `refreshNotationFromProgression()` |
| Chord cards out of sync | Cards show different data than notation | Call `syncProgressionToMelodyComposer()` |
| Bass notes wrong | Bass doesn't match chord | Call `compositionState.updateBassFromChord(index)` |
| Event not firing | Listeners not receiving events | Check event name spelling, ensure listener added |
| Circular update loop | Infinite re-renders | Check for bi-directional sync; disable notation→progression sync |
| Undo not working | Changes can't be undone | Ensure `saveStateBeforeChange()` called BEFORE changes |
| Sections not showing | Chords not grouped | Check `chord.sectionId` matches a valid section |
| V2 rests showing wrong | V2 rests not cue/invisible | Check `SlotGrid._voiceSlotsToNotation()` logic |

---

## 🌐 COMMUNITY STATE MANAGEMENT

### Authentication State

Authentication state is managed by `authService.js` using Supabase Auth:

```
┌─────────────────────────────────────────────────────────────┐
│                    Auth State (authService.js)              │
│                                                             │
│  currentUser: User | null    ← Supabase auth user           │
│  currentSession: Session | null ← JWT token + metadata      │
│  cachedProfile: Profile | null ← User profile from DB       │
│                                                             │
│  Auth Listeners: Set<callback>  ← Notified on auth changes  │
└─────────────────────────────────────────────────────────────┘
```

**State Transitions:**

```
┌────────────────┐
│  Not Signed In │ ←─────────────────────────────────┐
│  user = null   │                                   │
└───────┬────────┘                                   │
        │                                            │
        │ signInWithGoogle()                         │
        ▼                                            │
┌────────────────┐                                   │
│  Google OAuth  │ (redirect to Google)              │
│  Flow          │                                   │
└───────┬────────┘                                   │
        │                                            │
        │ OAuth callback                             │
        ▼                                            │
┌────────────────┐                                   │
│  Signed In     │ ───── signOut() ──────────────────┘
│  user = {...}  │
│  session = {   │
│    access_token│
│    expires_at  │
│  }             │
└────────────────┘
```

### Auth Event Listeners

```javascript
// Subscribe to auth changes
const unsubscribe = onAuthStateChange((event, session) => {
  // event: 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED'
  if (event === 'SIGNED_IN') {
    // Enable community features
    updateAuthButton();
    showAdminFabIfAdmin();
  } else if (event === 'SIGNED_OUT') {
    // Disable community features
    clearAdminCache();
    clearLoadedSubmissionContext();
  }
});
```

### Pattern 7: Share Submission Flow

```
┌─────────────────────────────────────┐
│  User clicks "Share to Community"   │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  Check isSignedIn()                 │
│  If not signed in → prompt sign in  │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  showShareModal()                   │
│  - Generate duplicate detection data│
│  - Check for existing similar       │
│    progressions (API call)          │
└─────────────────┬───────────────────┘
                  │
                  ├──── Exact duplicate found ───────────────┐
                  │                                          │
                  ▼                                          ▼
┌─────────────────────────────────────┐   ┌─────────────────────────────────┐
│  No duplicate found                 │   │  Show duplicate info            │
│  - Show submission form             │   │  - Link to existing             │
│  - User fills title, description,   │   │  - Option to add as variant     │
│    category, tags                   │   │  - Option to cancel             │
└─────────────────┬───────────────────┘   └─────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  hasLoadedSubmissionContext()?      │
│  - If yes: show "Update" option     │
│  - If no: normal publish            │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  POST /api/submissions              │
│  - Include composition_data         │
│  - Include chord_sequence           │
│  - Include base_hash, variant_hash  │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  Success: Clear context, show toast │
│  Error: Show error message          │
└─────────────────────────────────────┘
```

### Pattern 8: Load Community Submission

```
┌──────────────────────────────────────┐
│  User browses community submissions  │
│  (communityBrowser.js)               │
└─────────────────┬────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────┐
│  User clicks "Load" on submission    │
└─────────────────┬────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────┐
│  Check if workspace has unsaved      │
│  changes → Confirm overwrite?        │
└─────────────────┬────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────┐
│  GET /api/submission?id=xxx          │
│  → Returns full composition_data     │
└─────────────────┬────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────┐
│  compositionState.importFrom...()    │
│  or setProgressionData()             │
└─────────────────┬────────────────────┘
                  │
                  ├──── Is own submission? ───────────────────┐
                  │                                           │
                  ▼                                           ▼
┌──────────────────────────────────────┐   ┌──────────────────────────────────┐
│  clearLoadedSubmissionContext()      │   │  setLoadedSubmissionContext({    │
│  (Not own submission)                │   │    submissionId, title, etc.     │
│                                      │   │  })                              │
│                                      │   │  (Enables "Update" option)       │
└─────────────────┬────────────────────┘   └─────────────────┬────────────────┘
                  │                                          │
                  └─────────────────┬────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────┐
│  syncProgressionToMelodyComposer()   │
│  refreshNotationFromProgression()    │
└──────────────────────────────────────┘
```

### Pattern 9: Admin Dashboard Flow

```
┌─────────────────────────────────────┐
│  User clicks Admin FAB              │
│  (visible only if isAdmin)          │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  showAdminDashboard()               │
│  - Loads stats from API             │
│  - Shows dashboard modal            │
└─────────────────┬───────────────────┘
                  │
                  ▼
┌─────────────────────────────────────┐
│  Admin selects tab:                 │
│  - Overview (stats)                 │
│  - Submissions (manage)             │
│  - Users (block/unblock)            │
│  - Flags (content reports)          │
│  - Settings (app config)            │
└─────────────────┬───────────────────┘
                  │
          ┌───────┼───────┐
          │       │       │
          ▼       ▼       ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ GET/PUT  │ │ GET/PUT  │ │ GET/PUT  │
│ /admin-  │ │ /admin-  │ │ /flags   │
│submissions│ │users     │ │          │
└──────────┘ └──────────┘ └──────────┘
```

### Loaded Submission Context State

Tracks when user loads their own submission for editing:

```
┌─────────────────────────────────────────────────────────────┐
│            loadedSubmissionContext (global)                 │
│                                                             │
│  loadedContext: {                                           │
│    submissionId: string,     // Original submission ID      │
│    title: string,            // Original title              │
│    description: string,      // Original description        │
│    status: 'published'|'draft',                             │
│    submissionType: 'chord-progression'|'full-composition',  │
│    category: string,                                        │
│    loadedAt: number          // Timestamp when loaded       │
│  } | null                                                   │
└─────────────────────────────────────────────────────────────┘
```

**State Transitions:**

```
[No Context] ──load own submission──> [Context Set]
    │                                      │
    │                                      │
    │<── clearLoadedSubmissionContext() ───┘
    │         (on publish, new, or "Save as New")
    │
    └── loadedContext = null
```

### Admin Cache State

```javascript
// Cached admin status (adminService.js)
let adminStatusCache = { isAdmin: boolean, email?: string } | null;
let adminStatusCacheTime = number; // Timestamp
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Cache is cleared on:
// - Sign out
// - After CACHE_DURATION expires
// - Manual clearAdminCache() call
```

### Community State Debugging

```javascript
// In browser console:

// Check auth state
window.isSignedIn && window.isSignedIn();
window.getCurrentUser && window.getCurrentUser();

// Check loaded submission context
window.hasLoadedSubmissionContext && window.hasLoadedSubmissionContext();
window.getLoadedSubmissionContext && window.getLoadedSubmissionContext();

// Clear loaded context (for testing)
window.clearLoadedSubmissionContext && window.clearLoadedSubmissionContext();
```

### Common Community Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| Can't share | "Must be signed in" error | Call `signInWithGoogle()` |
| Token expired | API calls fail with 401 | Call `refreshSession()` or sign in again |
| Admin FAB missing | Admin can't access dashboard | Check `checkAdminStatus()`, clear cache |
| "Update" missing | Share modal shows "Publish" only | Check `hasLoadedSubmissionContext()` |
| Duplicate detected | Can't publish progression | Use "Add as Variant" or choose different chords |

---

## 🎓 COACH ENGINE STATE MANAGEMENT

### Coach Engine State Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Coach Engine State                        │
│            (src/modules/teaching/coachEngine/)               │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ enabled: boolean         // Engine on/off            │    │
│  │ scanResults: {           // Latest scan results      │    │
│  │   patterns: PatternResult[]                          │    │
│  │   opportunities: Opportunity[]                       │    │
│  │   suggestions: Suggestion[]                          │    │
│  │ }                                                    │    │
│  │ nudgeQueue: NudgeData[]  // Pending nudges           │    │
│  │ activeNudges: Map       // Currently displayed       │    │
│  │ preferences: {          // User preferences          │    │
│  │   verbosity: 'minimal' | 'moderate' | 'verbose'      │    │
│  │   dismissedPatterns: Set                             │    │
│  │ }                                                    │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  Triggers: 'progressionChanged', 'chordUpdated',            │
│            'measureAdded', 'measureRemoved'                 │
└─────────────────────────────────────────────────────────────┘
```

### Pattern 10: Coach Engine Scan Flow

```
┌──────────────────────────────────┐
│  Progression Changes             │
│  (compositionState event)        │
└─────────────────┬────────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│  isCoachEngineEnabled()?         │
│  If no → skip                    │
└─────────────────┬────────────────┘
                  │ Yes
                  ▼
┌──────────────────────────────────┐
│  Debounce (300ms)                │
│  Avoid excessive scanning        │
└─────────────────┬────────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│  scanProgression()               │
│  (coachEngine/index.js)          │
└─────────────────┬────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌────────┐  ┌──────────┐  ┌──────────┐
│ Detect │  │ Detect   │  │ Detect   │
│Cadences│  │Sequences │  │Borrowed  │
│        │  │          │  │ Chords   │
└────┬───┘  └────┬─────┘  └────┬─────┘
    │             │             │
    └─────────────┼─────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│  Merge & Prioritize Results      │
│  Filter by user preferences      │
└─────────────────┬────────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│  generateSuggestions()           │
│  Based on detected patterns      │
└─────────────────┬────────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│  Queue Nudges (3-tier system)    │
│  - Tier 1: Floating nudges       │
│  - Tier 2: Panel highlights      │
│  - Tier 3: Modal deep links      │
└─────────────────┬────────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│  showNudge() (if appropriate)    │
│  Based on experience mode        │
└──────────────────────────────────┘
```

### Pattern 11: Nudge Presentation Flow

```
┌──────────────────────────────────┐
│  Nudge Ready to Display          │
│  (from scan results)             │
└─────────────────┬────────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│  Check Experience Mode           │
│  - Focus: minimal nudges         │
│  - Guided: moderate              │
│  - Explore: all nudges           │
└─────────────────┬────────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│  Check Skill Level               │
│  - Beginner: more explanations   │
│  - Intermediate: balanced        │
│  - Advanced: minimal explanation │
└─────────────────┬────────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│  floatingNudgePresenter.js       │
│  - Position above chord card     │
│  - Render nudge content          │
│  - Set up dismiss handlers       │
└─────────────────┬────────────────┘
                  │
          ┌───────┴───────┐
          │               │
          ▼               ▼
┌─────────────────┐  ┌─────────────────┐
│ User Dismisses  │  │ User Clicks     │
│ (X or click     │  │ Action Button   │
│  outside)       │  │                 │
└────────┬────────┘  └────────┬────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────┐
│ hideNudge()     │  │ Execute action  │
│ Track dismissed │  │ (open modal,    │
│                 │  │  apply change)  │
└─────────────────┘  └─────────────────┘
```

---

## 🎚️ EXPERIENCE MODES STATE

### Experience Mode Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Experience Mode State                     │
│                (src/modules/state/globalState.js)            │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ experienceMode: 'focus' | 'guided' | 'explore'      │    │
│  │                                                     │    │
│  │ theorySkillLevel: 'beginner' | 'intermediate' |     │    │
│  │                   'advanced'                        │    │
│  │   (persisted in localStorage: 'theorySkillLevel')   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  Window Event: 'experienceModeChanged'                      │
│  Payload: { mode, previousMode }                            │
└─────────────────────────────────────────────────────────────┘
```

### Mode Feature Matrix

```
┌────────────┬──────────────────┬──────────────────┬──────────────────┐
│  Feature   │      Focus       │     Guided       │     Explore      │
├────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Tension    │     Hidden       │   Ambient only   │   Full + Detail  │
│ Strip      │                  │                  │                  │
├────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Bass       │     Hidden       │   On hover only  │   Always visible │
│ Motion     │                  │                  │                  │
├────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Coach      │   Errors only    │   Key moments    │   All insights   │
│ Nudges     │                  │                  │                  │
├────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Theory     │   Disabled       │   On request     │   Proactive      │
│ Overlays   │                  │                  │                  │
├────────────┼──────────────────┼──────────────────┼──────────────────┤
│ Pattern    │   None           │   Cadences only  │   All patterns   │
│ Detection  │                  │                  │                  │
└────────────┴──────────────────┴──────────────────┴──────────────────┘
```

### Pattern 12: Experience Mode Change Flow

```
┌──────────────────────────────────┐
│  User Changes Experience Mode    │
│  (settings modal or header)      │
└─────────────────┬────────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│  setExperienceMode(newMode)      │
│  (globalState.js)                │
└─────────────────┬────────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│  Dispatch Window Event           │
│  'experienceModeChanged'         │
│  { mode, previousMode }          │
└─────────────────┬────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌────────────┐ ┌────────────┐ ┌────────────┐
│ Ambient    │ │ Bass Motion│ │ Coach      │
│ Tension    │ │ Indicators │ │ Engine     │
│ Strip      │ │            │ │            │
│            │ │            │ │            │
│ setVisi-   │ │ setVisi-   │ │ update     │
│ bility()   │ │ bility()   │ │ Verbosity  │
└────────────┘ └────────────┘ └────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│  Re-render affected UI           │
│  - Hide/show ambient features    │
│  - Adjust nudge presentation     │
│  - Update detail levels          │
└──────────────────────────────────┘
```

---

## 📊 PATTERN DETECTION STATE

### Pattern Detection Flow

```
┌──────────────────────────────────┐
│  Request Pattern Analysis        │
│  (from coach engine or UI)       │
└─────────────────┬────────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│  detectPatterns(progression, key)│
│  (analysis/patternDetection.js)  │
└─────────────────┬────────────────┘
                  │
    ┌─────────────┼─────────────┬─────────────┐
    │             │             │             │
    ▼             ▼             ▼             ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Cadence │ │Sequence │ │ Modal   │ │Borrowed │
│Detector │ │Detector │ │ Pattern │ │ Chord   │
│         │ │         │ │Detector │ │Detector │
└────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
    │             │             │             │
    └─────────────┴──────┬──────┴─────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────┐
│  Merge Results                               │
│  - Calculate confidence scores               │
│  - Remove overlapping patterns               │
│  - Sort by relevance/confidence              │
└─────────────────┬────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────┐
│  Return PatternResult[]                      │
│  [{ type, name, chordIndices,                │
│     confidence, description }]               │
└──────────────────────────────────────────────┘
```

### Cadence Detection Detail

```
┌──────────────────────────────────┐
│  detectCadences(chords, key)     │
│  (detectors/cadenceDetector.js)  │
└─────────────────┬────────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│  For each chord pair (i, i+1)    │
│  - Get roman numerals            │
│  - Check against CADENCE_PATTERNS│
└─────────────────┬────────────────┘
                  │
          ┌───────┼───────┬───────┬───────┐
          │       │       │       │       │
          ▼       ▼       ▼       ▼       ▼
      ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
      │V → I │ │IV → I│ │V → vi│ │* → V │ │ VII  │
      │Auth. │ │Plagal│ │Decep.│ │ Half │ │Modal │
      └──────┘ └──────┘ └──────┘ └──────┘ └──────┘
                  │
                  ▼
┌──────────────────────────────────┐
│  Calculate strength (0-1)        │
│  - Position in phrase            │
│  - Voice leading quality         │
│  - Duration context              │
└──────────────────────────────────┘
```

---

## 🎹 CHORD LAB & SCALE EXPLORER STATE

### Chord Lab State

```
┌─────────────────────────────────────────────────────────────┐
│                    Chord Lab State                           │
│        (src/modules/features/chordLab/)                      │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ currentChord: {                                     │    │
│  │   root: string,                                     │    │
│  │   type: string,                                     │    │
│  │   inversion: number                                 │    │
│  │ }                                                   │    │
│  │ voicing: string[]  // Current displayed notes       │    │
│  │ isPlaying: boolean // Playback state                │    │
│  │ selectedPanel: string // Active bottom panel        │    │
│  │ keyboardHighlights: Map // Highlighted keys         │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Scale Explorer State

```
┌─────────────────────────────────────────────────────────────┐
│                   Scale Explorer State                       │
│        (src/modules/features/scaleExplorer/)                 │
│                                                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ currentScale: {                                     │    │
│  │   root: string,                                     │    │
│  │   type: string  // 'major', 'natural_minor', etc.   │    │
│  │ }                                                   │    │
│  │ scaleNotes: string[]  // Notes in current scale     │    │
│  │ highlightedChord: Chord | null                      │    │
│  │ playbackDirection: 'ascending' | 'descending'       │    │
│  │ selectedPanel: string  // Active bottom panel       │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧩 NEW SYNC SCENARIOS

### Scenario 7: Coach Engine Pattern Detection

```javascript
// When progression changes, coach engine auto-scans
compositionState.on('measureUpdated', () => {
  if (isCoachEngineEnabled()) {
    // Debounced scan
    debouncedScan();
  }
});

function debouncedScan() {
  const progressionData = compositionState.exportToProgressionData();
  const key = compositionState.getSettings().key;

  // Scan for patterns
  const results = scanProgression(progressionData, key);

  // Generate suggestions
  const suggestions = generateSuggestions({
    progressionData,
    key,
    patterns: results.patterns
  });

  // Queue nudges based on experience mode
  const mode = getExperienceMode();
  const nudges = filterNudgesForMode(suggestions, mode);
  queueNudges(nudges);
}
```

### Scenario 8: Experience Mode Toggle

```javascript
// User changes experience mode
setExperienceMode('guided');

// This triggers event
window.dispatchEvent(new CustomEvent('experienceModeChanged', {
  detail: { mode: 'guided', previousMode: 'focus' }
}));

// Listeners update UI
// AmbientTensionStrip.js
window.addEventListener('experienceModeChanged', (e) => {
  const { mode } = e.detail;
  if (mode === 'focus') {
    hideStrip();
  } else if (mode === 'guided') {
    showAmbientOnly();
  } else {
    showFull();
  }
});

// BassMotionIndicators.js
window.addEventListener('experienceModeChanged', (e) => {
  const { mode } = e.detail;
  setVisibility(mode !== 'focus');
  setHoverOnly(mode === 'guided');
});
```

### Scenario 9: Chord Context Menu Action

```javascript
// User right-clicks chord card
showChordContextMenu(chordIndex, event);

// User clicks "Find Alternatives"
// → Opens UnifiedRecommendationModal to Chord tab

// User clicks "Analyze Voice Leading"
// → Opens UnifiedRecommendationModal with voice leading focus

// User clicks "Why This Works"
// → Opens Why This Works panel for chord

// Action handlers preserve context
handleContextMenuAction(action, chordIndex) {
  switch(action) {
    case 'alternatives':
      showUnifiedRecommendationModal({
        chordIndex,
        activeTab: 'chord',
        initialView: 'alternatives'
      });
      break;
    case 'voiceLeading':
      showUnifiedRecommendationModal({
        chordIndex,
        activeTab: 'chord',
        initialView: 'voiceLeading'
      });
      break;
    // ... more actions
  }
}
```

---

## 📋 UPDATED STATE DEBUGGING

### Debug Coach Engine State

```javascript
// In browser console:

// Check coach engine status
window.isCoachEngineEnabled && window.isCoachEngineEnabled();

// Get scan results
window.getCoachEngine && window.getCoachEngine().getScanResults();

// Get active nudges
window.getCoachEngine && window.getCoachEngine().getActiveNudges();

// Force rescan
window.getCoachEngine && window.getCoachEngine().rescan();
```

### Debug Experience Mode

```javascript
// Get current mode
window.getExperienceMode && window.getExperienceMode();

// Get skill level
window.getTheorySkillLevel && window.getTheorySkillLevel();
// Or check localStorage directly
localStorage.getItem('theorySkillLevel');

// Set mode (for testing)
window.setExperienceMode && window.setExperienceMode('explore');
```

### Debug Pattern Detection

```javascript
// Run pattern detection manually
import { detectPatterns } from './modules/analysis/patternDetection.js';
const progressionData = window.getCompositionState().exportToProgressionData();
const key = window.getCompositionState().getSettings().key;
const patterns = detectPatterns(progressionData, key);
console.log(patterns);
```

### Updated Common Issues Table

| Issue | Symptom | Solution |
|-------|---------|----------|
| Nudges not showing | Coach engine disabled or Focus mode | Check `isCoachEngineEnabled()`, switch to Guided/Explore |
| Ambient features missing | Focus mode active | Switch to Guided or Explore mode |
| Pattern detection slow | Large progression | Patterns are debounced 300ms; consider reducing scan frequency |
| Context menu not appearing | Right-click handler not initialized | Call `initChordContextMenu()` |
| Skill level not persisting | localStorage issue | Check `localStorage.getItem('theorySkillLevel')` |
| Coach suggestions wrong level | Skill level mismatch | Call `setTheorySkillLevel(level)` |

---

## 🔗 RELATED DOCUMENTS

- [MODULE_INDEX.md](MODULE_INDEX.md) - Find state-related modules
- [API_REFERENCE.md](API_REFERENCE.md) - CompositionState API details
- [CLAUDE.md](../CLAUDE.md) - Critical patterns and conventions

---

## 💡 BEST PRACTICES

### DO:
- ✅ Always call `saveStateBeforeChange()` BEFORE making changes (for undo)
- ✅ Always update state through CompositionState methods
- ✅ Call sync functions after state changes
- ✅ Use event listeners for cross-module communication
- ✅ Check `autoGenerated` flag before regenerating bass
- ✅ Use canonical duration format (`{duration: '2n', dotted: true}`)
- ✅ Emit events after state mutations

### DON'T:
- ❌ Mutate measure/chord objects directly
- ❌ Skip `syncProgressionToMelodyComposer()` before `refreshNotationFromProgression()`
- ❌ Enable bi-directional notation↔progression sync (causes loops)
- ❌ Regenerate bass without saving edited notes first
- ❌ Forget to rebuild chord segments after duration changes
- ❌ Use dot suffix in duration strings (use `dotted` boolean)
- ❌ Forget `saveStateBeforeChange()` before drag operations

---

**Last Updated:** 2026-01-20
