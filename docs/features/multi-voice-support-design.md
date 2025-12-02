# Multi-Voice Support Design Document

## Overview

This document outlines the design for adding multi-voice (polyphonic) support to the Music Theory Lab notation system. This feature allows multiple independent melodic lines to coexist within a single staff, enabling:

- Held notes while other notes move (e.g., sustained bass with walking melody)
- Counter-melodies and harmony lines
- Traditional two-voice writing (soprano/alto or tenor/bass)
- Pedal tones underneath moving lines

## Use Cases

### 1. Sustained Notes with Moving Line
```
Voice 1: [whole note C4]────────────────────
Voice 2: [♩ E4] [♩ F4] [♩ G4] [♩ A4]
```

### 2. Counter-Melody
```
Voice 1: [♩ C5] [♩ D5] [♩ E5] [♩ F5]  (main melody)
Voice 2: [♩ G4] [♩ F4] [♩ E4] [♩ D4]  (counter-melody moving opposite)
```

### 3. Harmony in Thirds/Sixths
```
Voice 1: [♩ E5] [♩ F5] [♩ G5] [♩ A5]  (melody)
Voice 2: [♩ C5] [♩ D5] [♩ E5] [♩ F5]  (parallel thirds below)
```

### 4. Pedal Tone
```
Voice 1: [♩ G4] [♩ A4] [♩ B4] [♩ C5]  (moving line)
Voice 2: [whole note C3]────────────────  (pedal)
```

---

## Data Structure

### Current Structure (Single Voice)
```javascript
measure.notation.treble = {
  voices: [
    { notes: [...] }  // Only voice 0 is used
  ]
}
```

### Proposed Structure (Multi-Voice)
```javascript
measure.notation.treble = {
  voices: [
    {
      id: 1,
      notes: [...],
      stemDirection: 'up',      // Default for voice 1
      color: null               // Default color
    },
    {
      id: 2,
      notes: [...],
      stemDirection: 'down',    // Default for voice 2
      color: '#3b82f6'          // Optional: blue tint for differentiation
    }
  ],
  activeVoice: 1  // Currently selected voice for editing
}
```

### Note Structure Enhancement
```javascript
{
  type: 'note',
  pitches: ['C4'],
  duration: 'q',
  beat: 0,
  voice: 1,                    // Which voice this note belongs to
  stemDirection: 'up',         // Can override voice default
  // ... other existing properties
}
```

### Cursor Enhancement
```javascript
this.cursor = {
  measure: 0,
  beat: 0,
  staff: 'treble',
  voice: 1,                    // Currently active voice (1 or 2)
  // ... other properties
}
```

---

## Visual Design

### Stem Direction Rules
| Voice | Default Stem | When Alone | When Both Voices Present |
|-------|--------------|------------|--------------------------|
| Voice 1 | Up | Auto (follows pitch) | Always Up |
| Voice 2 | Down | Auto (follows pitch) | Always Down |

### Color Coding (Optional, User Preference)
| Voice | Default | Selected | Hover |
|-------|---------|----------|-------|
| Voice 1 | Black (#000) | Blue highlight | Light blue bg |
| Voice 2 | Dark Blue (#1e40af) | Blue highlight | Light blue bg |

### Visual Example
```
Treble Clef:
    ┌─────────────────────────────────┐
    │  ♩↑  ♩↑  ♩↑  ♩↑                │  Voice 1 (stems up)
    │  o────────────────              │  Voice 2 (whole note, stem down)
    │  ↓                              │
    └─────────────────────────────────┘
```

### Selection States
- **Voice 1 selected**: Voice 1 notes fully opaque, Voice 2 notes at 60% opacity
- **Voice 2 selected**: Voice 2 notes fully opaque, Voice 1 notes at 60% opacity
- **Both visible**: Option to show both at full opacity

---

## UI/UX Design

### Toolbar Changes

#### Voice Selector (Enhanced)
```
┌─────────────────────────────────────┐
│ Voice: [Voice 1 ▼]  [+] [-]         │
│        ──────────                   │
│        │ Voice 1 │ ← Currently      │
│        │ Voice 2 │   selected       │
│        │ + Add   │                  │
│        └─────────┘                  │
└─────────────────────────────────────┘
```

- **Dropdown**: Select active voice
- **[+] Button**: Add voice to current measure (if < max voices)
- **[-] Button**: Remove voice (if empty or with confirmation)

#### Voice Visibility Toggle
```
┌──────────────────────┐
│ 👁 V1  👁 V2        │  (eye icons to show/hide voices)
└──────────────────────┘
```

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `1` | Switch to Voice 1 |
| `2` | Switch to Voice 2 |
| `V` | Cycle through voices |
| `Shift+V` | Toggle voice visibility |

### Click Behavior
1. **Click on empty space**: Add note to current voice at that beat
2. **Click on note**:
   - If note belongs to current voice: Select it
   - If note belongs to other voice: Switch to that voice and select
3. **Shift+Click on note**: Select without switching voice

### Visual Feedback
- **Active voice indicator**: Highlighted in toolbar
- **Ghost notes**: When hovering, show preview in current voice's color
- **Voice badge**: Small "1" or "2" badge on selected notes

---

## Rendering Changes

### VexFlow Multi-Voice Rendering
```javascript
// Create voices for VexFlow
const voice1 = new VF.Voice({ num_beats: 4, beat_value: 4 });
const voice2 = new VF.Voice({ num_beats: 4, beat_value: 4 });

voice1.addTickables(voice1Notes);
voice2.addTickables(voice2Notes);

// Format voices together (handles horizontal spacing)
new VF.Formatter()
  .joinVoices([voice1, voice2])
  .format([voice1, voice2], staveWidth);

// Draw both voices
voice1.draw(context, stave);
voice2.draw(context, stave);
```

### Stem Direction Logic
```javascript
function getStemDirection(note, voiceNumber, hasMultipleVoices) {
  if (!hasMultipleVoices) {
    // Single voice: auto based on pitch
    return note.pitches[0].octave >= 5 ? 'down' : 'up';
  }
  // Multiple voices: fixed by voice number
  return voiceNumber === 1 ? 'up' : 'down';
}
```

### Rest Handling
- Voice 1 rests: Positioned above middle line
- Voice 2 rests: Positioned below middle line
- When one voice has notes and other has rest: Rest may be hidden or shown smaller

---

## Editing Behavior

### Adding Notes
```
Current Voice: 1
Click at beat 2 → Note added to Voice 1 at beat 2

Current Voice: 2
Click at beat 2 → Note added to Voice 2 at beat 2
(Even if Voice 1 already has a note there)
```

### Selecting Notes
```
Click on Voice 1 note:
  - If Voice 1 active: Select the note
  - If Voice 2 active: Switch to Voice 1, then select

Shift+Click: Select without switching voice (for comparison)
```

### Deleting Notes
- Delete only affects notes in the current voice
- Other voice's notes remain untouched

### Copy/Paste
- Copies notes from current voice only
- Paste adds to current voice
- Option: "Paste to all voices" for duplicating patterns

### Ties and Slurs
- Ties connect notes within the same voice only
- Cross-voice ties are not supported (musically invalid)

---

## Unified Recommendations Integration

### New Tab/Mode: "Add Harmony Voice"

When user has melody in Voice 1, offer recommendations for Voice 2:

#### Harmony Types
| Type | Description | Example |
|------|-------------|---------|
| Parallel Thirds | Follows melody a 3rd below | C-E-G → A-C-E |
| Parallel Sixths | Follows melody a 6th below | C-E-G → E-G-B |
| Contrary Motion | Moves opposite to melody | C→D→E → G→F→E |
| Pedal Tone | Sustained note (root or 5th) | [G whole note] |
| Counter-melody | Independent complementary line | Custom generated |
| Rhythmic Complement | Fills gaps in main melody | Notes where V1 rests |

#### UI in Recommendations Modal
```
┌─────────────────────────────────────────────┐
│ [Chords] [Sequences] [Melody] [Harmony] ◀── │
├─────────────────────────────────────────────┤
│ Add harmony to Voice 2                      │
│                                             │
│ Based on your melody in Voice 1:            │
│ [♩ C5] [♩ D5] [♩ E5] [♩ F5]                │
│                                             │
│ Suggestions:                                │
│ ┌─────────────────────────────────────────┐ │
│ │ Parallel Thirds                    [+]  │ │
│ │ [♩ A4] [♩ B4] [♩ C5] [♩ D5]            │ │
│ │ Classic harmony, warm sound             │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Pedal Tone (Root)                  [+]  │ │
│ │ [o C4]──────────────────                │ │
│ │ Grounding sustained note                │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Counter-melody                     [+]  │ │
│ │ [♩ G4] [♩ F4] [♩ E4] [♩ D4]            │ │
│ │ Contrary motion for interest            │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

#### Harmony Generation Algorithm
```javascript
function generateHarmonyRecommendations(voice1Notes, chord, key, style) {
  const recommendations = [];

  // 1. Parallel intervals
  recommendations.push({
    type: 'parallel_thirds',
    notes: voice1Notes.map(n => transposeDown(n, 3, key)),
    description: 'Parallel thirds below melody'
  });

  // 2. Pedal tone
  recommendations.push({
    type: 'pedal',
    notes: [{ pitch: chord.root, duration: 'w' }],
    description: `Sustained ${chord.root} pedal`
  });

  // 3. Counter-melody (contrary motion)
  recommendations.push({
    type: 'contrary',
    notes: generateContraryMotion(voice1Notes, chord, key),
    description: 'Contrary motion counter-melody'
  });

  return recommendations;
}
```

---

## Implementation Phases

### Phase 1: Core Infrastructure (Foundation)
**Estimated complexity: Medium**

1. Update `compositionState.js`:
   - Extend measure structure for multiple voices
   - Add `activeVoice` to cursor
   - Add voice management methods (`addVoice`, `removeVoice`, `setActiveVoice`)

2. Update note operations:
   - `addNote()` uses current voice
   - `deleteNote()` respects voice
   - `selectNote()` aware of voice

3. Serialize/deserialize voices properly

### Phase 2: Rendering (Visual)
**Estimated complexity: Medium-High**

1. Update VexFlow renderer:
   - Render multiple voices per staff
   - Handle stem directions
   - Position rests correctly

2. Visual differentiation:
   - Color coding (optional)
   - Opacity for non-active voice

3. Selection highlighting per voice

### Phase 3: UI/Editing (Interaction)
**Estimated complexity: Medium**

1. Toolbar enhancements:
   - Voice selector functionality
   - Keyboard shortcuts
   - Visibility toggles

2. Click/selection behavior:
   - Voice-aware note selection
   - Add-to-current-voice behavior

3. Edit operations:
   - Voice-aware copy/paste
   - Voice-aware undo/redo

### Phase 4: Recommendations (AI)
**Estimated complexity: High**

1. New "Harmony" tab in Unified Recommendations
2. Harmony generation algorithms:
   - Parallel intervals
   - Contrary motion
   - Pedal tones
3. Style-aware harmony (jazz vs classical vs pop)
4. Preview and apply to Voice 2

---

## Technical Considerations

### Performance
- Rendering two voices is ~2x render cost
- Cache voice calculations when possible
- Lazy-render non-visible voices

### Compatibility
- Ensure single-voice files load correctly
- Migrate existing compositions gracefully
- Export formats (MIDI, MusicXML) support voices

### Edge Cases
1. **Overlapping notes**: Same pitch in both voices
   - Render slightly offset horizontally
   - Or merge visually with shared notehead

2. **Tied notes across voices**: Not allowed
   - Validate on tie creation

3. **Voice 2 without Voice 1**: Allowed
   - Voice 1 shows rests or is empty

4. **More than 2 voices**:
   - Design supports extension to 3-4 voices
   - UI limits to 2 initially for simplicity

### VexFlow Specifics
```javascript
// VexFlow supports multiple voices natively
// Key classes:
// - VF.Voice: Container for notes in a voice
// - VF.Formatter.joinVoices(): Aligns multiple voices
// - VF.StaveNote.setStemDirection(): Up/Down control

// Example of two-voice measure:
const voice1 = new VF.Voice({ num_beats: 4, beat_value: 4 });
const voice2 = new VF.Voice({ num_beats: 4, beat_value: 4 });

// Voice 1: quarter notes, stems up
const v1Notes = [
  new VF.StaveNote({ keys: ['e/5'], duration: 'q', stem_direction: 1 }),
  new VF.StaveNote({ keys: ['f/5'], duration: 'q', stem_direction: 1 }),
  new VF.StaveNote({ keys: ['g/5'], duration: 'q', stem_direction: 1 }),
  new VF.StaveNote({ keys: ['a/5'], duration: 'q', stem_direction: 1 }),
];

// Voice 2: whole note, stem down
const v2Notes = [
  new VF.StaveNote({ keys: ['c/4'], duration: 'w', stem_direction: -1 }),
];

voice1.addTickables(v1Notes);
voice2.addTickables(v2Notes);

// Format together for proper spacing
new VF.Formatter().joinVoices([voice1, voice2]).format([voice1, voice2], 300);

// Draw both
voice1.draw(context, stave);
voice2.draw(context, stave);
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `compositionState.js` | Multi-voice data structure, voice management methods |
| `vexFlowRenderer.js` | Multi-voice rendering, stem direction logic |
| `notationToolbar.js` | Voice selector functionality, shortcuts |
| `notationComposer.js` | Voice-aware editing operations |
| `UnifiedRecommendationModal.js` | New Harmony tab |
| `harmonyGenerator.js` | New file for harmony recommendations |

---

## Open Questions

1. **Maximum voices per staff?**
   - Propose: 2 for treble, 2 for bass (4 total)
   - Matches typical SATB writing

2. **Voice colors user-configurable?**
   - Could add to settings/preferences

3. **Auto-voice assignment?**
   - When adding notes, should system auto-detect which voice based on pitch?
   - Or always use explicitly selected voice?

4. **Cross-staff voices?**
   - Voice 1 in treble connected to Voice 1 in bass?
   - Or treat each staff independently?

---

## Success Criteria

- [ ] Can add notes to Voice 1 and Voice 2 independently
- [ ] Voices render with correct stem directions
- [ ] Can select and edit notes in specific voice
- [ ] Toolbar shows current voice clearly
- [ ] Keyboard shortcuts work (1, 2, V)
- [ ] Harmony recommendations generate useful suggestions
- [ ] Existing single-voice compositions still work
- [ ] MIDI export includes both voices correctly

---

## References

- VexFlow Multi-Voice Documentation: https://github.com/0xfe/vexflow/wiki/The-VexFlow-Tutorial
- Music notation standards for voice separation
- MIDI specification for multiple voices/channels

---

*Document created: December 1, 2025*
*Status: Design Phase*
