# Full-Featured Music Composition Software - Implementation Plan

## Executive Summary

Transform the Music Theory Lab's Melody Builder into a comprehensive, web-based music composition platform comparable to MuseScore, Flat.io, or Noteflight, while maintaining integration with the existing chord progression and recommendation engine.

---

## Current State Analysis

### ✅ What We Have
- **Chord Progression Builder**: Multi-chord progressions with inversion support
- **Comprehensive Chord Recommendations**: 3D scoring system with modal interchange
- **Basic Melody Notation**: Single-line melody editing in "Melody Notation" area
- **Audio Playback**: Tone.js integration for chord and note playback
- **Theory Engine**: Voice leading analysis, harmonic function, modal interchange
- **Export**: Basic MIDI export capability

### ❌ What We Need
- **Polyphonic notation**: Multiple voices per staff
- **Two-hand notation**: Treble + Bass clef with coordination
- **Rhythm editing**: Flexible note durations, rests, tuplets
- **Multi-line staves**: Like real sheet music (systems)
- **Dynamic markings**: Key changes, time signature changes mid-piece
- **Advanced editing**: Copy/paste, undo/redo across all elements
- **Full score rendering**: Professional notation display

---

## Architecture Overview

### Technology Stack Recommendations

| Component | Recommended Technology | Rationale |
|-----------|----------------------|-----------|
| **Notation Rendering** | [VexFlow](https://www.vexflow.com/) | Most mature web-based music notation library, excellent rendering |
| **Data Model** | Custom JSON → MusicXML export | Start simple, enable industry-standard export |
| **Playback** | Tone.js (existing) | Already integrated, supports polyphony |
| **UI Framework** | Vanilla JS (existing) | Consistency with current codebase |
| **State Management** | Centralized store pattern | Manage complex notation state |

### Data Model Structure

```javascript
{
  composition: {
    metadata: {
      title: "String",
      composer: "String",
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 }
    },
    systems: [  // Each system = one line of music
      {
        measures: [
          {
            number: 1,
            keySignature: "C",
            timeSignature: { num: 4, denom: 4 },  // Can change mid-piece
            staves: [
              {
                clef: "treble",
                voices: [  // Multiple voices per staff (polyphony)
                  {
                    notes: [
                      {
                        pitch: "C4",
                        duration: "quarter",
                        dotted: false,
                        accidental: null
                      }
                    ]
                  }
                ]
              },
              {
                clef: "bass",
                voices: [ /* bass clef notes */ ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## Phased Implementation Plan

### 🎯 Phase 1: Enhanced Single-Staff Notation (Weeks 1-3)
**Goal**: Upgrade current melody notation to support professional single-staff composition

#### 1.1 Integrate VexFlow Rendering
- Replace current notation rendering with VexFlow
- Display measures with proper bar lines
- Show time signature, key signature, clef

**Implementation**:
```javascript
// modules/notation/vexFlowRenderer.js
export function renderMeasure(container, measureData, options) {
  const VF = Vex.Flow;
  const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);

  const context = renderer.getContext();
  const stave = new VF.Stave(10, 40, 400);

  // Add clef, time signature, key signature
  stave.addClef(options.clef || "treble");
  stave.addTimeSignature(`${measureData.timeSignature.num}/${measureData.timeSignature.denom}`);
  if (measureData.keySignature) {
    stave.addKeySignature(measureData.keySignature);
  }

  stave.setContext(context).draw();

  // Render notes
  const notes = measureData.notes.map(noteData => {
    return new VF.StaveNote({
      keys: [noteData.pitch],
      duration: noteData.duration
    });
  });

  VF.Formatter.FormatAndDraw(context, stave, notes);
}
```

#### 1.2 Multi-Measure Display
- Show 4 measures per line
- Scrollable/paginated view
- Measure numbers

#### 1.3 Rhythm Editor
- Click to add note
- Dropdown to select duration (whole, half, quarter, eighth, sixteenth)
- Dot button for dotted notes
- Rest insertion

#### 1.4 Polyphony in Treble Clef
- Support 2 voices in melody clef
- Voice 1 (stems up), Voice 2 (stems down)
- Voice selector in UI

**UI Mock**:
```
┌─────────────────────────────────────────────────────┐
│ Measure 1          | Measure 2          | Measure 3 │
│  ╭─────────────╮   │  ╭─────────────╮   │          │
│  │ ♩ ♩ ♩ ♩     │   │  │  𝅗𝅥      𝅗𝅥   │   │          │
│  ╰─────────────╯   │  ╰─────────────╯   │          │
│                     │                     │          │
└─────────────────────────────────────────────────────┘
[♩ Quarter] [♪ Eighth] [𝅗𝅥 Half] [🎵 Voice 1 ▼] [+ Rest]
```

**Deliverables**:
- ✅ VexFlow integrated
- ✅ Multi-measure display
- ✅ Note duration editor
- ✅ Polyphonic voices (2 voices max)
- ✅ Rest support

---

### 🎯 Phase 2: Two-Hand Piano Notation (Weeks 4-6)
**Goal**: Add bass clef and coordinate between hands

#### 2.1 Grand Staff Rendering
- Treble clef (right hand) + Bass clef (left hand)
- Brace connecting staves
- Synchronized measures

**VexFlow Implementation**:
```javascript
function renderGrandStaff(container, measureData) {
  const trebleStave = new VF.Stave(10, 0, 400).addClef("treble");
  const bassStave = new VF.Stave(10, 80, 400).addClef("bass");

  // Add brace
  const brace = new VF.StaveConnector(trebleStave, bassStave);
  brace.setType(VF.StaveConnector.type.BRACE);

  // Render both staves
  trebleStave.setContext(context).draw();
  bassStave.setContext(context).draw();
  brace.setContext(context).draw();
}
```

#### 2.2 Chord Integration
- Auto-populate bass clef from chord progression
- Show chord symbols above treble staff
- Edit chord voicings in bass clef

#### 2.3 Bass Clef Editor
- Same editing tools as treble clef
- Voice leading visualization between hands
- Highlight parallel fifths/octaves warnings

**Deliverables**:
- ✅ Grand staff rendering
- ✅ Bass clef editing
- ✅ Chord progression → bass clef auto-fill
- ✅ Voice leading warnings

---

### 🎯 Phase 3: Dynamic Changes & Multi-Line Display (Weeks 7-9)
**Goal**: Support key changes, time signature changes, and multi-system display

#### 3.1 Key Signature Changes
```javascript
// Data model
{
  measure: 5,
  changeKeySignature: "G"  // Change to G major at measure 5
}
```

**UI**:
- Click measure → "Change Key" button
- Show key signature picker
- Transpose existing notes (with confirmation)

#### 3.2 Time Signature Changes
```javascript
{
  measure: 9,
  changeTimeSignature: { num: 3, denom: 4 }  // Change to 3/4
}
```

#### 3.3 Multi-System (Multi-Line) Display
- Break composition into systems automatically
- 4 measures per system (configurable)
- Page breaks for printing
- System-level settings (staff spacing, size)

**Layout Algorithm**:
```javascript
function layoutSystems(measures, measuresPerSystem = 4) {
  const systems = [];
  for (let i = 0; i < measures.length; i += measuresPerSystem) {
    systems.push({
      startMeasure: i,
      endMeasure: Math.min(i + measuresPerSystem - 1, measures.length - 1),
      measures: measures.slice(i, i + measuresPerSystem)
    });
  }
  return systems;
}
```

**Deliverables**:
- ✅ Mid-piece key changes
- ✅ Mid-piece time signature changes
- ✅ Multi-system display
- ✅ Auto-layout algorithm
- ✅ Manual system breaks

---

### 🎯 Phase 4: Advanced Editing Features (Weeks 10-12)
**Goal**: Professional editing capabilities

#### 4.1 Copy/Paste/Delete
```javascript
// Clipboard structure
{
  type: "measures",
  data: [
    { measure: 1, staves: [...] },
    { measure: 2, staves: [...] }
  ]
}
```

**Operations**:
- Select measures (click + drag)
- Copy: Ctrl+C
- Paste: Ctrl+V
- Delete: Delete key

#### 4.2 Comprehensive Undo/Redo
```javascript
// History stack
const historyStack = {
  past: [],
  present: { composition: {...} },
  future: []
};

function undo() {
  if (historyStack.past.length === 0) return;

  historyStack.future.unshift(historyStack.present);
  historyStack.present = historyStack.past.pop();
  renderComposition(historyStack.present);
}
```

#### 4.3 MIDI Import/Export
- Import MIDI files → notation
- Export notation → MIDI
- Use [tone.js MIDI](https://github.com/Tonejs/Midi) library

#### 4.4 MusicXML Export
- Export to MusicXML for compatibility with Sibelius, Finale, MuseScore
- Use [musicxml-interfaces](https://github.com/MuseScore/musicxml-interfaces)

**Deliverables**:
- ✅ Copy/paste/delete measures
- ✅ Full undo/redo (50 steps)
- ✅ MIDI import
- ✅ MIDI export (enhanced)
- ✅ MusicXML export

---

### 🎯 Phase 5: Polish & Performance (Weeks 13-14)
**Goal**: Optimize and refine the user experience

#### 5.1 Performance Optimization
- Virtual scrolling for large compositions (100+ measures)
- Lazy rendering (only render visible systems)
- Web Worker for layout calculations

#### 5.2 Keyboard Shortcuts
```javascript
const shortcuts = {
  'Ctrl+Z': undo,
  'Ctrl+Y': redo,
  'Ctrl+C': copy,
  'Ctrl+V': paste,
  'Delete': deleteSelection,
  'Space': playPause,
  'ArrowLeft': moveCursorLeft,
  'ArrowRight': moveCursorRight,
  '1-9': setNoteDuration  // 1=whole, 2=half, 3=quarter, etc.
};
```

#### 5.3 Mobile Responsiveness
- Touch-friendly note editing
- Swipe to scroll measures
- Responsive layout for tablets

#### 5.4 Tutorials & Help
- Interactive tutorial for first-time users
- Context-sensitive help
- Video tutorials

**Deliverables**:
- ✅ Performance optimizations
- ✅ Full keyboard shortcut support
- ✅ Mobile-friendly interface
- ✅ Help documentation

---

## Technical Implementation Details

### State Management Pattern

```javascript
// modules/notation/notationState.js
export const NotationState = {
  composition: null,
  selection: {
    measures: [],
    notes: []
  },
  cursor: {
    measure: 0,
    beat: 0,
    voice: 0
  },
  clipboard: null,

  // Actions
  addMeasure(position) {
    // Add measure and update history
  },
  updateNote(measureId, noteId, changes) {
    // Update note and update history
  },
  changeKeySignature(measureId, newKey) {
    // Change key and optionally transpose
  }
};
```

### Integration with Existing Chord System

```javascript
// Bridge between chord progression and notation
export function chordProgressionToNotation(progression, key) {
  return progression.map((chord, index) => {
    return {
      measure: index,
      staves: [
        {
          clef: "treble",
          voices: [
            { notes: generateMelodyFromChord(chord, key) }
          ]
        },
        {
          clef: "bass",
          voices: [
            { notes: generateBassVoicing(chord, key) }
          ]
        }
      ],
      chordSymbol: `${chord.root}${chord.type}`
    };
  });
}
```

---

## User Interface Mockups

### Main Composition View
```
┌────────────────────────────────────────────────────────────┐
│ 🎵 Music Theory Lab - Composition                          │
│ File Edit View Insert Help                      [Settings] │
├────────────────────────────────────────────────────────────┤
│ [▶ Play] [⏸ Pause] [⏹ Stop] Tempo: [120] Key: [C Major ▼]│
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Measure 1        Measure 2        Measure 3    Measure 4  │
│ ┌─ C Major ─────┬─────────────────┬────────────┬──────────┐│
│ │ 🎼 ♩ ♩ ♩ ♩    │  𝅗𝅥      𝅗𝅥     │            │          ││
│ │╭──────────────╮│                 │            │          ││
│ │╰──────────────╯│                 │            │          ││
│ │ 🎹 𝅝           │  𝅗𝅥      𝅗𝅥     │            │          ││
│ └───────────────┴─────────────────┴────────────┴──────────┘│
│                                                             │
│  Measure 5        Measure 6        Measure 7    Measure 8  │
│ ┌───────────────┬─────────────────┬────────────┬──────────┐│
│ │               │                 │            │          ││
│ └───────────────┴─────────────────┴────────────┴──────────┘│
│                                                             │
├────────────────────────────────────────────────────────────┤
│ Duration: [♩ ▼] [🎵 Voice 1 ▼] [+ Add Note] [+ Add Rest]  │
│ [Copy] [Paste] [Delete] [Change Key] [Change Time Sig]    │
└────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/
├── modules/
│   ├── notation/
│   │   ├── vexFlowRenderer.js       // VexFlow rendering logic
│   │   ├── notationState.js         // State management
│   │   ├── measureEditor.js         // Measure editing tools
│   │   ├── noteEditor.js            // Note editing tools
│   │   ├── voiceManager.js          // Polyphony management
│   │   ├── systemLayouter.js        // Multi-line layout
│   │   └── exporters/
│   │       ├── midiExporter.js
│   │       └── musicXMLExporter.js
│   ├── ui/
│   │   ├── compositionView.js       // Main composition UI
│   │   ├── toolbars/
│   │   │   ├── durationToolbar.js
│   │   │   └── editingToolbar.js
│   │   └── modals/
│   │       ├── keyChangeModal.js
│   │       └── timeSigModal.js
│   ├── integration/
│   │   └── chordToNotationBridge.js // Chord ↔ Notation
│   └── playback/
│       └── notationPlayer.js        // Playback engine
└── data/
    └── notation-data.js              // Note durations, symbols, etc.
```

---

## Risk Mitigation

| Risk | Impact | Mitigation Strategy |
|------|--------|---------------------|
| **VexFlow learning curve** | High | Start with simple examples, incremental complexity |
| **Performance with large scores** | Medium | Implement virtual scrolling from Phase 1 |
| **Mobile editing complexity** | Medium | Simplify mobile UI, focus on desktop first |
| **Data loss during editing** | High | Auto-save every 30 seconds, local storage backup |
| **Browser compatibility** | Low | VexFlow is well-supported, test on Chrome/Firefox/Safari |

---

## Success Metrics

### Phase 1
- ✅ Can create 16-measure melody with varied rhythms
- ✅ 2-voice polyphony works correctly
- ✅ Renders at 60fps

### Phase 2
- ✅ Can compose piano piece with both hands
- ✅ Chord symbols display above staff
- ✅ Bass clef auto-fill from progression

### Phase 3
- ✅ Can change key mid-composition
- ✅ Multi-line display works for 50+ measures
- ✅ Print-ready layout

### Phase 4
- ✅ Copy/paste works reliably
- ✅ Undo/redo never loses data
- ✅ Can export to MusicXML and open in MuseScore

### Phase 5
- ✅ Supports 200+ measures without lag
- ✅ All keyboard shortcuts work
- ✅ Mobile users can view and play compositions

---

## Next Steps (Immediate Actions)

1. **Week 1**:
   - Install and test VexFlow
   - Create proof-of-concept: Render single measure with notes
   - Design notation state structure

2. **Week 2**:
   - Build measure editor component
   - Implement note addition/deletion
   - Add duration selector

3. **Week 3**:
   - Add polyphony support (2 voices)
   - Build multi-measure display
   - Connect to existing chord progression

---

## Questions for Consideration

1. **Should we maintain backward compatibility** with existing melody notation data?
   - **Recommendation**: Yes, write migration script

2. **How many measures per line on mobile?**
   - **Recommendation**: 2 measures (vs. 4 on desktop)

3. **Should we support percussion notation?**
   - **Recommendation**: Phase 6 (future enhancement)

4. **Integration with chord recommendation: Auto-suggest melody?**
   - **Recommendation**: Phase 6 - AI-assisted melody generation

---

## Conclusion

This is an ambitious but achievable project that will transform the Music Theory Lab into a professional composition platform. The phased approach allows for:

- **Incremental value delivery** (each phase is usable)
- **Risk management** (test and validate before proceeding)
- **User feedback integration** (gather feedback after each phase)
- **Resource flexibility** (can adjust timeline based on resources)

**Estimated Total Timeline**: 14 weeks (3.5 months) for full implementation
**MVP Timeline**: 6 weeks (Phases 1-2) for basic two-hand composition

Ready to start with Phase 1?
