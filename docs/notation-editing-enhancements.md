# Musical Notation Editing Enhancements

## Overview

This document describes the new interactive editing capabilities added to the Music Theory Lab's notation system. These features enable comprehensive manipulation of musical notation beyond basic note entry.

---

## 🎯 New Capabilities

### 1. **Insert Notes Before/After Selected Note**
- Insert a new note before or after the currently selected note
- Automatically validates that the new note fits within the measure's time signature
- Preserves measure timing integrity

### 2. **Change Duration of Existing Notes**
- Modify the duration of selected notes (whole, half, quarter, 8th, 16th, 32nd)
- Toggle dotted rhythms on existing notes
- Validates that duration changes fit within measure constraints

### 3. **Articulations**
- Add expressive markings to notes:
  - **Staccato** - Short, detached notes (dot above/below)
  - **Accent** - Emphasized notes (> symbol)
  - **Tenuto** - Full value, slightly emphasized (- symbol)
  - **Marcato** - Strongly accented (^ symbol)
- Toggle articulations on/off
- Visual rendering in VexFlow notation

### 4. **Ties**
- Connect notes of the same pitch across beats or barlines
- Automatic validation (only ties notes with matching pitches)
- Supports polyphonic notes (chords)
- Toggle ties on/off

### 5. **Slurs**
- Connect phrases of different pitches
- Curved line spanning multiple notes
- Specify start and end notes
- Visual rendering in VexFlow

### 6. **Dynamic Markings**
- Add volume indications: `pp`, `p`, `mp`, `mf`, `f`, `ff`, `fff`
- Positioned below staff
- Per-note dynamics support

---

## 📊 API Reference

### MeasureManager Methods

#### Beat Calculation

```javascript
// Get total beats used in a staff
getUsedBeats(measureIndex, staff)
// Returns: number (beats)

// Get remaining available beats
getRemainingBeats(measureIndex, staff)
// Returns: number (beats)

// Check if a note duration fits in the measure
canFitNote(measureIndex, staff, duration, dotted = false)
// Returns: boolean
```

#### Note Insertion

```javascript
// Insert note before another note
insertNoteBefore(measureIndex, staff, noteIndex, noteData)
// Returns: boolean (success)

// Insert note after another note
insertNoteAfter(measureIndex, staff, noteIndex, noteData)
// Returns: boolean (success)
```

**Example:**
```javascript
const success = measureManager.insertNoteAfter(0, 'treble', 2, {
  pitch: 'C4',
  duration: '4n',
  dotted: false,
  articulation: 'staccato'
});
```

#### Duration Changes

```javascript
// Change duration of existing note
changeNoteDuration(measureIndex, staff, noteIndex, newDuration, newDotted = false)
// Returns: boolean (success)
```

**Example:**
```javascript
// Change note at index 1 to dotted half note
measureManager.changeNoteDuration(0, 'treble', 1, '2n', true);
```

#### Articulations

```javascript
// Set articulation
setArticulation(measureIndex, staff, noteIndex, articulation)
// articulation: 'staccato' | 'accent' | 'tenuto' | 'marcato' | null

// Toggle articulation on/off
toggleArticulation(measureIndex, staff, noteIndex, articulation)

// Returns: boolean (success)
```

**Example:**
```javascript
// Add staccato to note
measureManager.setArticulation(0, 'treble', 0, 'staccato');

// Toggle accent (turns on if off, off if on)
measureManager.toggleArticulation(0, 'treble', 1, 'accent');
```

#### Dynamics

```javascript
// Set dynamic marking
setDynamic(measureIndex, staff, noteIndex, dynamic)
// dynamic: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff' | 'fff' | null

// Returns: boolean (success)
```

#### Ties

```javascript
// Add tie to note (connects to next note of same pitch)
addTie(measureIndex, staff, noteIndex)

// Remove tie from note
removeTie(measureIndex, staff, noteIndex)

// Toggle tie on/off
toggleTie(measureIndex, staff, noteIndex)

// Returns: boolean (success)
```

**Example:**
```javascript
// Tie middle C quarter note to next middle C
measureManager.addTie(0, 'treble', 0);
```

#### Slurs

```javascript
// Add slur between two notes (can be different pitches)
addSlur(measureIndex, staff, startNoteIndex, endNoteIndex)

// Remove slur from a note
removeSlur(measureIndex, staff, noteIndex)

// Returns: boolean (success)
```

**Example:**
```javascript
// Slur from note 0 to note 3
measureManager.addSlur(0, 'treble', 0, 3);
```

---

## 🎹 Keyboard Shortcuts (Planned)

### Note Insertion
| Action | Shortcut |
|--------|----------|
| Insert note before | `Shift + Left Arrow` |
| Insert note after | `Shift + Right Arrow` |

### Duration Changes
| Action | Shortcut |
|--------|----------|
| Change to whole note | `Shift + 1` (existing) |
| Change to half note | `Shift + 2` (existing) |
| Change to quarter note | `Shift + 3` (existing) |
| Change to eighth note | `Shift + 4` (existing) |
| Change to 16th note | `Shift + 5` (existing) |
| Change to 32nd note | `Shift + 6` (existing) |
| Toggle dotted | `.` (period) - existing |

### Articulations
| Action | Shortcut |
|--------|----------|
| Staccato | `Shift + S` |
| Accent | `Shift + A` |
| Tenuto | `Shift + T` |
| Marcato | `Shift + M` |

### Ties & Slurs
| Action | Shortcut |
|--------|----------|
| Toggle tie | `T` |
| Start slur | `Shift + (` |
| End slur | `Shift + )` |

---

## 🔧 Implementation Status

### ✅ Completed (Backend)

1. **MeasureManager Methods** - All core functionality implemented:
   - ✅ Beat calculation (`getUsedBeats`, `getRemainingBeats`, `canFitNote`)
   - ✅ Note insertion (`insertNoteBefore`, `insertNoteAfter`)
   - ✅ Duration changes (`changeNoteDuration`)
   - ✅ Articulations (`setArticulation`, `toggleArticulation`)
   - ✅ Dynamics (`setDynamic`)
   - ✅ Ties (`addTie`, `removeTie`, `toggleTie`)
   - ✅ Slurs (`addSlur`, `removeSlur`)

2. **Data Structures** - Note template already supports:
   - ✅ `articulation` property
   - ✅ `tied` and `tiedTo` properties
   - ✅ `dynamic` property
   - ✅ `slur` property (with start/end indices)

### 🚧 In Progress (Frontend Integration)

1. **NoteEditor UI Integration** - Wire up methods to user interactions
2. **Keyboard Shortcuts** - Implement shortcut handling
3. **Toolbar Controls** - Add UI buttons for articulations/dynamics
4. **VexFlow Rendering** - Ensure all markings render correctly
5. **Visual Feedback** - Show articulations/ties/slurs in blue selection overlay

### 📋 Planned (Testing & Polish)

1. **Comprehensive Testing** - Test all features with various scenarios
2. **Error Handling** - User-friendly messages for invalid operations
3. **Documentation Updates** - Update vexflow-enhancement-phases.md
4. **Tutorial/Help** - In-app guide for new features

---

## 💡 Usage Examples

### Example 1: Adding a Staccato Quarter Note After an Existing Note

```javascript
// 1. Select note at index 0
noteEditor.selectNote(0, 'treble', 0);

// 2. Insert new quarter note after it
const noteData = {
  pitch: 'E4',
  duration: '4n',
  dotted: false,
  articulation: 'staccato'
};

measureManager.insertNoteAfter(0, 'treble', 0, noteData);

// 3. Render to show changes
composerIntegration.render();
```

### Example 2: Creating a Tied Phrase

```javascript
// Add two middle C quarter notes
measureManager.addNote(0, 'treble', { pitch: 'C4', duration: '4n' }, 0);
measureManager.addNote(0, 'treble', { pitch: 'C4', duration: '4n' }, 1);

// Tie them together
measureManager.addTie(0, 'treble', 0);

// Render
composerIntegration.render();
```

### Example 3: Adding a Slurred Phrase with Dynamics

```javascript
// Add 4 ascending notes
const notes = ['C4', 'D4', 'E4', 'F4'];
notes.forEach((pitch, i) => {
  measureManager.addNote(0, 'treble', { pitch, duration: '4n' }, i);
});

// Add slur across all 4 notes
measureManager.addSlur(0, 'treble', 0, 3);

// Add crescendo dynamics
measureManager.setDynamic(0, 'treble', 0, 'p');   // Piano
measureManager.setDynamic(0, 'treble', 3, 'f');   // Forte

// Render
composerIntegration.render();
```

### Example 4: Changing Duration with Validation

```javascript
// Try to change a quarter note to a half note
const success = measureManager.changeNoteDuration(0, 'treble', 0, '2n', false);

if (!success) {
  console.log('Cannot change duration - would exceed measure capacity');

  // Show remaining beats
  const remaining = measureManager.getRemainingBeats(0, 'treble');
  console.log(`Remaining beats in measure: ${remaining}`);
}
```

---

## 🎨 Visual Rendering

### VexFlow Articulation Symbols

The following VexFlow modifiers are used:

| Articulation | VexFlow Modifier |
|--------------|------------------|
| Staccato | `Articulation('a.')` |
| Accent | `Articulation('a>')` |
| Tenuto | `Articulation('a-')` |
| Marcato | `Articulation('a^')` |

### Tie Rendering

Ties are rendered using VexFlow's `StaveTie`:
- Connects note heads of the same pitch
- Curves upward for notes above middle staff
- Curves downward for notes below middle staff

### Slur Rendering

Slurs use VexFlow's curve API:
- Connects phrases of different pitches
- Always curves in the direction opposite note stems
- Can span multiple notes

---

## 🔍 Validation Rules

### Beat Capacity
- Total beats in a measure cannot exceed the time signature numerator
- Example: In 4/4 time, max 4 beats
- Dotted notes count as 1.5x their base duration

### Tie Constraints
- Can only tie notes with matching pitches
- Cannot tie rests
- Supports polyphonic notes (entire chord must match)

### Slur Constraints
- Start note must come before end note
- Cannot slur rests
- Can span notes of different pitches

### Insertion Constraints
- New note must fit within remaining beats
- Cannot insert if measure is already full
- Duration + dotted state determines space needed

---

## 🚀 Next Steps

1. **Integrate with NoteEditor** - Connect methods to click/keyboard events
2. **Add Toolbar Buttons** - Create UI for articulations and dynamics
3. **Implement Shortcuts** - Wire up keyboard commands
4. **VexFlow Rendering** - Ensure all new properties render correctly
5. **Multi-Select Operations** - Apply articulations/ties to multiple notes at once
6. **Cross-Measure Ties** - Support ties spanning barlines
7. **Hairpins** - Add crescendo/diminuendo wedges (future enhancement)

---

## 📝 Notes

- All methods include automatic undo/redo support via `saveState()`
- Beat calculations account for dotted rhythms (1.5x multiplier)
- Tie validation checks both single notes (`pitch`) and chords (`pitches`)
- Articulations are mutually exclusive (only one per note)
- Dynamics accumulate (last marking applies until changed)

---

## 🐛 Known Limitations

1. **Cross-measure ties** - Currently only ties within same measure
2. **Multiple voices** - Articulations apply to voice 1 only (for now)
3. **Tuplets** - Beat calculations don't account for triplets yet
4. **Hairpins** - Gradual dynamics (cresc./dim.) not yet implemented
5. **Fermatas** - Hold symbols not yet supported

---

This document will be updated as features are completed and tested.
