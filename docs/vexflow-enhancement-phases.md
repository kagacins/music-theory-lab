# VexFlow Professional Notation Enhancement - Phase Plan

This document outlines the phased approach to enhancing the Music Theory Lab's notation system with VexFlow professional rendering and interactive editing capabilities.

---

## Phase Overview

### ✅ **Foundation (Completed - Phase 4.4a/4.4b)**
- Professional VexFlow rendering with proper beaming and spacing
- Grand staff display with treble and bass clefs
- Multi-system layout with configurable measures per line
- Zoom and scroll functionality
- Harmonic tone coloring for melody analysis
- Playback highlighting (yellow measure background, red notes)
- Polyphony support (chord rendering)

---

## 🚀 **Phase 1: Interactive Note Editing (Current - IMPLEMENTED)**

**Goal**: Enable users to add, edit, and delete notes directly on the staff

### Features Implemented:

#### **1.1 Click-to-Add Notes**
- **Alt+Click** anywhere on the staff to insert a note
- Duration determined by toolbar selection
- Works on both treble and bass clefs
- Ghost note preview on hover when **Alt is held** (follows mouse cursor)
- **Regular click** on a measure to select it
- **Hold regular click** on a measure to play it back

#### **1.2 Toolbar Integration**
- **Duration Selection**: Whole, half, quarter, 8th, 16th, 32nd notes
  - Keyboard: **Shift+1** through **Shift+6** (avoids conflict with chord suggestions)
- **Rest Mode**: Toggle to insert rests instead of notes
  - Keyboard: **R**
- **Dotted Notes**: Toggle for dotted rhythms
  - Keyboard: **.** (period)
- **Accidentals**: Sharp, flat, natural
  - Keyboard: **S** (sharp), **F** (flat), **N** (natural)
- **Undo/Redo**: Full history support
  - Keyboard: **Ctrl+Z** / **Ctrl+Y**

#### **1.3 Note Selection & Editing**
- Click notes to select them (blue highlight)
- **Shift+Click** for multi-select
- **Drag selected notes** to change pitch
- **Arrow keys** (↑/↓) to transpose selected notes
- **Delete/Backspace** to remove selected notes

#### **1.4 Polyphony (Chord) Editing**
- **Alt+Shift+Click** on staff to add pitch to existing note
- Automatically converts single notes to chords
- Visual stacking of simultaneous pitches

#### **1.5 Visual Feedback**
- Selection highlights with blue outline
- Ghost note preview at mouse position
- Overlay canvas for non-destructive visual elements

### Known Issues (To Fix):
- No measure beat limit enforcement
- Melody suggestions don't respect toolbar duration
- Need visual indicator when Alt is held (to show note editing mode is active)

---

## 📋 **Phase 2: Advanced Notation Elements (Planned)**

**Goal**: Add expressive notation markings and symbols

### 2.1 Articulations
- **Staccato** (dot above/below note)
- **Accent** (> symbol)
- **Tenuto** (horizontal line)
- **Marcato** (^ symbol)
- Toolbar buttons with visual feedback
- Apply to selected notes

### 2.2 Dynamics
- **p, mp, mf, f, ff, fff** markings
- Positioned below staff
- Toolbar selector or text input
- Hairpins (crescendo/diminuendo) - future enhancement

### 2.3 Ties & Slurs
- **Ties**: Connect same-pitch notes across barlines
- **Slurs**: Curved line connecting different pitches
- Click-and-drag to create
- Automatic curve calculation

### 2.4 Chord Symbols
- Display above staff (e.g., "Cmaj7", "Dm7", "G7")
- Auto-populated from chord progression data
- Editable text for custom symbols
- Jazz chord notation support

### 2.5 Lyrics (Optional)
- Text entry below staff
- Syllable-to-note alignment
- Hyphenation support
- Multiple verse layers

---

## 🎨 **Phase 3: Advanced Editing (Planned)**

**Goal**: Professional score editing capabilities

### 3.1 Copy/Paste
- Copy selected notes
- Paste at cursor position
- Preserve all attributes (duration, articulations, etc.)
- Keyboard: **Ctrl+C** / **Ctrl+V**

### 3.2 Note Duration Editing
- Click existing note + duration button to change
- Visual feedback during editing
- Automatic beat reflow

### 3.3 Measure Operations
- Insert/delete measures
- Copy entire measures
- Repeat signs and measure repeats
- Time signature changes mid-piece

### 3.4 Voice Management
- Toggle between Voice 1 and Voice 2
- Independent note streams on same staff
- Visual differentiation (stem direction)
- Cross-staff voicing

### 3.5 Tuplets
- Triplets, quintuplets, septuplets
- Custom ratios
- Auto-bracket generation
- Smart spacing

---

## 🔧 **Phase 4: Workflow Enhancements (Planned)**

**Goal**: Streamline composition workflow

### 4.1 MIDI Input
- Real-time note entry from MIDI keyboard
- Quantization options
- Velocity-to-dynamics mapping
- Record mode with metronome

### 4.2 Smart Input
- Piano roll overlay for mouse input
- Step-time entry mode
- Auto-completion based on key/scale
- Harmony suggestions

### 4.3 Export Capabilities
- **MusicXML export** for Finale/Sibelius/MuseScore
- **PDF rendering** via VexFlow
- **MIDI export** with dynamics
- **PNG/SVG export** for sharing

### 4.4 Template Library
- Common progression templates
- Genre-specific voicings
- Custom template saving
- Import/export template files

---

## 🎼 **Phase 5: Professional Features (Future)**

**Goal**: Publication-ready score engraving

### 5.1 Multi-Instrument Scores
- Full orchestral score support
- Transposing instruments
- Condensed scores
- Part extraction

### 5.2 Advanced Layout
- Custom system/page breaks
- Staff spacing controls
- Text annotations and rehearsal marks
- Ossia staves

### 5.3 Playback Enhancements
- Expression interpretation (dynamics, articulations)
- Swing/humanization
- Tempo changes and fermatas
- Real-time effects

### 5.4 Collaboration
- Multi-user editing
- Version history
- Comments and annotations
- Cloud sync

---

## Implementation Timeline

| Phase | Status | Estimated Completion |
|-------|--------|---------------------|
| Foundation (4.4a/4.4b) | ✅ Complete | Done |
| **Phase 1** | 🚧 **Debugging** | In Progress |
| Phase 2 | 📋 Planned | TBD |
| Phase 3 | 📋 Planned | TBD |
| Phase 4 | 📋 Planned | TBD |
| Phase 5 | 📋 Planned | TBD |

---

## Technical Architecture

### Key Modules

1. **notationInit.js** - Initialization and wiring
2. **noteEditor.js** - Interactive editing logic
3. **notationToolbar.js** - UI controls and shortcuts
4. **staffLayouter.js** - Position calculations
5. **vexFlowRenderer.js** - VexFlow rendering
6. **grandStaff.js** - Grand staff layout and rendering
7. **measureEditor.js** - Measure data management
8. **composerIntegration.js** - Integration with composition state

### Data Flow

```
User Click → noteEditor.handleMouseDown()
           → getStaffPositionAtPoint() (calculate pitch)
           → onNoteAdd callback
           → compositionState.getMeasure()
           → voice.notes.push()
           → notationComposer.render()
           → VexFlow rendering
           → noteEditor.setNoteRegions() (for click detection)
```

---

## Keyboard Shortcuts Reference

### Notation Editing
| Action | Shortcut |
|--------|----------|
| Whole note | Shift+1 |
| Half note | Shift+2 |
| Quarter note | Shift+3 |
| Eighth note | Shift+4 |
| 16th note | Shift+5 |
| 32nd note | Shift+6 |
| Rest mode | R |
| Dotted | . (period) |
| Sharp | S or # |
| Flat | F or - |
| Natural | N or = |
| Delete | Delete/Backspace |
| Undo | Ctrl+Z |
| Redo | Ctrl+Y or Ctrl+Shift+Z |
| Tie | T |

### Note Selection
| Action | Shortcut |
|--------|----------|
| Select note | Click |
| Multi-select | Shift+Click |
| Select all | Ctrl+A |
| Deselect | Esc |
| Move up | ↑ |
| Move down | ↓ |

### Measure Operations
| Action | Shortcut |
|--------|----------|
| Select measure | Click |
| Play measure | Hold Click |

### Note Editing (requires Alt key)
| Action | Shortcut |
|--------|----------|
| Add note | Alt+Click |
| Add to chord | Alt+Shift+Click |

### Chord/Melody Suggestions (No Conflict)
| Action | Shortcut |
|--------|----------|
| Insert suggestion 1 | 1 |
| Insert suggestion 2 | 2 |
| Insert suggestion 3 | 3 |
| Insert suggestion 4 | 4 |
| Insert suggestion 5 | 5 |

---

## Design Principles

1. **Non-Destructive**: Visual elements (selection, ghost notes) use overlay canvas
2. **Keyboard-First**: All common actions have keyboard shortcuts
3. **Context-Aware**: Toolbar state syncs with editor state
4. **Undo-Friendly**: All mutations save undo state
5. **Real-Time Feedback**: Immediate visual response to user actions
6. **Progressive Enhancement**: Basic features first, advanced features layered on top

---

## Notes

- Shift modifier chosen for duration shortcuts to avoid conflict with existing 1-5 chord suggestion shortcuts
- Ghost note preview uses harmonic tone coloring when chord context is available
- Note regions updated after every render for accurate click detection
- Overlay canvas prevents re-rendering main canvas during selection/hover
