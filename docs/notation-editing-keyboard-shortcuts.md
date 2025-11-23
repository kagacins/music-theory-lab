# Musical Notation Editing - Keyboard Shortcuts Guide

## 🎹 Quick Reference

This guide shows all keyboard shortcuts for editing musical notation in the Music Theory Lab.

---

## ✅ **Implemented and Ready to Use**

### **Note Selection**

| Action | Shortcut | Notes |
|--------|----------|-------|
| Select note | Click | Click on any note to select it |
| Multi-select | Shift + Click | Add notes to selection |
| Select all | Ctrl/Cmd + A | Select all notes in the score |
| Deselect / Hide highlight | Esc | Hides blue highlight but keeps selection |

### **Note Movement**

| Action | Shortcut | Notes |
|--------|----------|-------|
| Move note up (half step) | ↑ | Transposes selected notes up |
| Move note down (half step) | ↓ | Transposes selected notes down |

### **Insert Notes Before/After** ✨ NEW

| Action | Shortcut | Notes |
|--------|----------|-------|
| Insert note before selected | Shift + ← | Uses current toolbar duration/settings |
| Insert note after selected | Shift + → | Uses current toolbar duration/settings |

> **Note**: Insertion validates that the new note fits in the measure. If the measure is full, you'll see a console warning.

### **Change Duration of Selected Notes** ✨ NEW

| Action | Shortcut | Notes |
|--------|----------|-------|
| Change to whole note | 1 | When notes are selected (no Shift) |
| Change to half note | 2 | When notes are selected (no Shift) |
| Change to quarter note | 3 | When notes are selected (no Shift) |
| Change to eighth note | 4 | When notes are selected (no Shift) |
| Change to 16th note | 5 | When notes are selected (no Shift) |
| Change to 32nd note | 6 | When notes are selected (no Shift) |

> **Note**: Duration changes validate that the new duration fits. If it would exceed the measure capacity, the change is rejected.

### **Articulations** ✨ NEW

| Action | Shortcut | Symbol | Notes |
|--------|----------|--------|-------|
| Toggle Staccato | Shift + S | • (dot) | Short, detached notes |
| Toggle Accent | Shift + A | > | Emphasized notes |
| Toggle Tenuto | Shift + T | - | Full value notes |
| Toggle Marcato | Shift + M | ^ | Strongly accented |

> **How it works**:
> - First press adds the articulation
> - Second press removes it
> - Articulations are mutually exclusive (only one per note)

### **Ties** ✨ NEW

| Action | Shortcut | Notes |
|--------|----------|-------|
| Toggle tie | T | Connects note to next note of same pitch |

> **Note**: Tie only works if the next note has the same pitch. Rests cannot be tied.

### **Delete Notes**

| Action | Shortcut | Notes |
|--------|----------|-------|
| Delete selected | Delete or Backspace | Removes all selected notes |

### **Playback**

| Action | Shortcut | Notes |
|--------|----------|-------|
| Play selected notes | Space or P | Plays audio for selected notes |

### **Undo/Redo**

| Action | Shortcut | Notes |
|--------|----------|-------|
| Undo | Ctrl/Cmd + Z | Undo last edit |
| Redo | Ctrl/Cmd + Y | Redo last undone edit |

---

## 🎨 **Adding Notes**

### **Basic Note Entry**

| Action | Shortcut | Notes |
|--------|----------|-------|
| Show ghost note preview | Hold Alt | Move mouse over staff |
| Add note at cursor | Alt + Click | Places note at mouse position |
| Add to chord (polyphony) | Alt + Shift + Click | Adds pitch to existing note |

### **Duration Selection (for new notes)**

| Action | Shortcut | Notes |
|--------|----------|-------|
| Whole note | Shift + 1 | Sets toolbar duration |
| Half note | Shift + 2 | Sets toolbar duration |
| Quarter note | Shift + 3 | Sets toolbar duration |
| Eighth note | Shift + 4 | Sets toolbar duration |
| 16th note | Shift + 5 | Sets toolbar duration |
| 32nd note | Shift + 6 | Sets toolbar duration |

### **Note Properties (for new notes)**

| Action | Shortcut | Notes |
|--------|----------|-------|
| Toggle rest mode | R | Next note added will be a rest |
| Toggle dotted | . (period) | Next note will be dotted |
| Sharp accidental | S or # | Next note gets sharp |
| Flat accidental | F or - | Next note gets flat |
| Natural accidental | N or = | Next note gets natural |

---

## 📝 **Usage Examples**

### Example 1: Add a Staccato Quarter Note After an Existing Note

1. Click on an existing note to select it (blue highlight appears)
2. Press **Shift + →** to insert a new note after it
3. The new note appears with the current toolbar duration (e.g., quarter note)
4. With the new note still selected, press **Shift + S** to add staccato
5. Press **↑** or **↓** to adjust pitch

### Example 2: Create a Tied Phrase

1. Add two quarter notes with the same pitch (e.g., both C4)
2. Click the first note to select it
3. Press **T** to add a tie
4. A curved line connects the two notes

### Example 3: Change Duration of Multiple Notes

1. Click first note
2. Hold **Shift** and click additional notes to multi-select
3. Press **2** to change all selected notes to half notes
4. Press **.** (period) to make them all dotted if desired

### Example 4: Add Accents to a Phrase

1. Select multiple notes (Shift + Click)
2. Press **Shift + A** to add accent marks to all
3. Press **Shift + A** again to remove them

---

## ⚠️ **Important Notes**

### Validation Rules

1. **Beat Capacity**: Inserted notes must fit within the measure's time signature
   - In 4/4 time, total beats cannot exceed 4
   - Dotted notes count as 1.5x their base duration

2. **Duration Changes**: New duration must fit in remaining measure space
   - If you try to make a quarter note into a whole note, it checks if there are 3 beats available

3. **Ties**: Only work between consecutive notes of the same pitch
   - Chord notes (polyphony) must have all pitches match

### Keyboard Shortcut Conflicts

**Duration Shortcuts have Different Behavior:**
- **Shift + 1-6**: Sets toolbar duration (for NEW notes)
- **1-6** (no Shift): Changes duration of SELECTED notes

**T key has Different Behavior:**
- **T** (no Shift): Toggle tie on selected notes
- **Shift + T**: Toggle tenuto articulation on selected notes

---

## 🐛 **Troubleshooting**

### "Could not insert note - measure may be full"
- The measure doesn't have enough remaining beats
- Check the time signature (e.g., 4/4 = 4 beats max)
- Try a shorter duration or delete some notes first

### "Could not change duration - would exceed measure capacity"
- The new duration would make the measure too long
- Example: In a full 4/4 measure, can't change quarter note to half note
- Free up space by deleting notes or using shorter durations

### Articulation/Tie not appearing
- Make sure notes are selected (blue highlight visible)
- Check console for error messages (F12 in browser)
- Ties require next note to have same pitch

### Number keys not changing duration
- Make sure notes are selected first
- Don't hold Shift (that sets toolbar duration instead)
- Check that you're not typing in an input field

---

## 🎯 **Tips & Tricks**

1. **Quick Editing Workflow**:
   - Select note → Press number to change duration → Press articulation shortcut → Press T for tie

2. **Multi-Note Editing**:
   - Select multiple notes → Apply changes to all at once
   - Saves time when editing phrases

3. **Undo is Your Friend**:
   - All edits support undo/redo (Ctrl+Z / Ctrl+Y)
   - Experiment freely!

4. **Ghost Note Preview**:
   - Hold Alt and move mouse to see where notes will be placed
   - Ghost note shows in harmonic tone color if chord context is available

5. **Measure Full?**:
   - Check remaining beats before inserting
   - Consider using shorter durations
   - Or split your phrase across multiple measures

---

## 🚀 **Coming Soon**

These features are planned for future updates:

- **Slur creation**: UI for creating slurs between notes
- **Dynamic markings**: Keyboard shortcuts for dynamics (p, f, etc.)
- **Toolbar buttons**: Visual buttons for articulations
- **Cross-measure ties**: Ties spanning barlines
- **Tuplets**: Triplets and other irregular divisions

---

## 📚 **Related Documentation**

- [VexFlow Enhancement Phases](vexflow-enhancement-phases.md) - Full roadmap
- [Notation Editing Enhancements](notation-editing-enhancements.md) - Technical API reference
- [Pitch/Pitches Standardization](pitch-pitches-standardization.md) - Polyphony implementation

---

**Last Updated**: 2025-01-23
**Version**: Phase 1 - Interactive Editing
