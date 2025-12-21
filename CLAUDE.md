# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Music Theory Lab is an interactive web application for music theory education and chord progression composition. It uses a **chord-first composition workflow** where users build chord progressions first, then the system auto-generates bass accompaniment and suggests melody notes based on harmonic context.

## Build Commands

```bash
# Build CSS (Tailwind)
npm run build-css

# Watch CSS during development
npm run watch-css
```

This is a client-side web app with no backend. Open `index.html` directly in a browser or serve with any static file server.

## Architecture Overview

### Core Data Flow

The application follows a bi-directional sync pattern between chord progressions and notation:

```
Chord Progression Cards ←→ CompositionState ←→ VexFlow Notation
```

**CompositionState** (`src/modules/state/compositionState.js`) is the single source of truth for:
- Chord data (root, type, inversion, beats)
- Measure structure
- Bass and treble notation
- BuildingBlockSequence for bass/treble notes

**TrainerState** (`src/modules/state/trainerState.js`) delegates progression data to CompositionState and manages UI state only.

### Module Organization

```
src/
├── main.js                    # Entry point, window exports for HTML handlers
├── data/music-data.js         # Constants: CHORD_DEFINITIONS, scales, intervals
└── modules/
    ├── state/                 # State management
    │   ├── compositionState.js    # Single source of truth for composition
    │   ├── trainerState.js        # Progression Builder UI state
    │   ├── builderState.js        # Chord Builder UI state
    │   ├── buildingBlock.js       # BuildingBlock/BuildingBlockSequence classes
    │   └── globalState.js         # App-wide settings (tab, enharmonic pref)
    │
    ├── features/              # Main feature modules
    │   ├── chordBuilder.js        # Chord Builder tab functionality
    │   ├── progressionBuilder.js  # Progression Builder tab (10K+ lines)
    │   └── theoryTools.js         # Secondary dominants, modal interchange
    │
    ├── notation/              # VexFlow notation rendering
    │   ├── composerIntegration.js # NotationComposer class - bridges systems
    │   ├── notationInit.js        # Initialization, refreshNotationFromProgression
    │   ├── grandStaff.js          # Grand staff rendering with VexFlow
    │   └── vexFlowRenderer.js     # Low-level VexFlow utilities
    │
    ├── integration/           # Cross-module sync
    │   ├── melodyComposerBridge.js    # Syncs progression → compositionState
    │   ├── progressionNotationSync.js # Bi-directional sync
    │   └── bassAutoFill.js            # Generates bass voicings
    │
    ├── audio/                 # Audio playback
    │   ├── audioEngine.js         # Tone.js piano sampler
    │   └── melodyGenerator.js     # Playback scheduling
    │
    ├── ui/                    # UI components
    │   ├── tabs.js                # Tab switching logic
    │   ├── keyboard.js            # Virtual piano keyboard
    │   └── panelState.js          # Collapsible panel persistence
    │
    └── analysis/              # Harmonic analysis
        ├── chordToneAnalyzer.js   # Note coloring by chord function
        └── harmonyAnalyzer.js     # Progression pattern detection
```

### Key Sync Functions

When chord progression changes, this sequence ensures all systems stay in sync:

1. `syncProgressionToMelodyComposer()` - Syncs progressionData → compositionState
2. `refreshNotationFromProgression()` - Syncs compositionState → notation display

Both must be called in order when loading/modifying progressions.

### Three-Tab Sync Pattern

Chord cards appear on three tabs and must stay synchronized:
- Progression Builder: `#progression-visualization`
- Melody Composer: `#melody-progression-visualization`
- Chord Builder: `#builder-progression-visualization`

`updateSingleCard(index)` updates all cards with matching `data-chord-index`.

### BuildingBlock System

`BuildingBlockSequence` is the authoritative data structure for bass and treble notes. When progressions change:
- Check if reinitialization is needed (different chord count or roots)
- Clear and reinitialize blocks for new progressions
- Call `renderBassBlocksToMeasures()` to populate notation

### Window Exports

`main.js` exports most functions to `window` for use by HTML event handlers. Check there first when looking for how UI elements connect to code.

## CRITICAL: Chord Type Naming Convention

**ALWAYS check `CHORD_DEFINITIONS` in `src/data/music-data.js` before creating, swapping, or suggesting chords.**

The `chord.type` property MUST exactly match a key in `CHORD_DEFINITIONS`. Incorrect names cause:
- Silent failures in chord playback
- Missing/wrong chord symbols in UI
- Broken transformations

### Valid Chord Type Names (exact strings required)
```
Major, Minor, Diminished, Augmented, Sus2, Sus4,
Dominant 7th, Major 7th, Minor 7th, Minor-Major 7th,
Diminished 7th, Half-Diminished 7th, Augmented 7th,
Major 6th, Minor 6th, Add9, Major 9th, Dominant 9th, Minor 9th,
6/9, Dominant 11th, Minor 11th, Dominant 13th,
7b5, 7#5, 7b9, 7#9, Major 7th #11, Power Chord
```

### Common Mistakes - DO NOT USE THESE:
- ~~"Suspended 4th"~~ → Use `"Sus4"`
- ~~"Suspended 2nd"~~ → Use `"Sus2"`
- ~~"Maj7"~~ → Use `"Major 7th"`
- ~~"Min7"~~ → Use `"Minor 7th"`
- ~~"Dom7"~~ → Use `"Dominant 7th"`
- ~~"Dim"~~ → Use `"Diminished"`
- ~~"Aug"~~ → Use `"Augmented"`
- ~~"m7b5"~~ → Use `"Half-Diminished 7th"`

### Getting Chord Symbol for Display
```javascript
import { CHORD_DEFINITIONS } from '../data/music-data.js';
const symbol = CHORD_DEFINITIONS[chord.type]?.symbol ?? '';
const display = `${chord.root}${symbol}`;  // e.g., "Cmaj7", "Dsus4"
```

---

## CRITICAL: Chord Playback Must Use chord.notes Array

**When playing chords (especially in modals/previews), ALWAYS use the chord's existing `notes` array instead of regenerating notes.**

The `chord.notes` array contains the exact notes with octaves that are displayed in chord cards and VexFlow notation. Regenerating notes from `chord.root` and `chord.type` will often produce different octaves, causing playback to not match what the user sees.

### WRONG - Regenerating notes (causes octave mismatch):
```javascript
// DON'T DO THIS - ignores the actual chord.notes octave information!
const res = getInvertedChordNotes(chord.root, chord.type, chord.inversion || 0, key, 0, 'sharp', 'full');
const notes = res?.specificNotes || [];
instrument.triggerAttack(notes);
```

### CORRECT - Use chord.notes when available:
```javascript
// DO THIS - matches chord cards and VexFlow notation exactly
let notes = [];
if (chord.notes && chord.notes.length > 0) {
    notes = [...chord.notes];  // Use actual notes with correct octaves
} else {
    // Fallback only if chord.notes is missing
    const res = getInvertedChordNotes(chord.root, chord.type, chord.inversion || 0, key, 0, 'sharp', 'full');
    notes = res?.specificNotes || [];
}
instrument.triggerAttack(notes);
```

### Why This Matters:
- Chord cards display notes at specific octaves (e.g., G3, B3, D4)
- VexFlow renders these exact notes on the staff
- If playback regenerates notes, it may use different octaves (e.g., G4, B4, D5)
- This creates a confusing disconnect where what you see ≠ what you hear

### When Modifying Chords (transforms, voice leading, etc.):
When changing a chord's properties, **update the `notes` array** to match:
```javascript
// When changing inversion or type, regenerate notes at the SAME octave
const baseOctave = chord.notes?.[0]?.match(/(\d+)$/)?.[1] || 4;
const newNotes = getChordNotes(chord.root, newType, key, baseOctave);
chord.type = newType;
chord.notes = newNotes.specificNotes;  // Keep notes in sync!
```

---

## Key Patterns

### Chord Data Structure
```javascript
{
  root: "C",
  type: "Major",  // MUST match CHORD_DEFINITIONS key exactly!
  inversion: 0,
  notes: ["C4", "E4", "G4"],
  beats: 4,
  omittedNotes: [],
  lhType: "off" | "root" | "fifth" | "octave" | "chord",
  lhOctaveShift: -12
}
```

### Notation Note Format
```javascript
{
  pitches: ["C4", "E4", "G4"],  // Array for chords
  duration: "4n",               // Tone.js duration notation
  beat: 0,                      // Beat position in measure
  dotted: false,
  isRest: false,
  isTied: false
}
```

## External Dependencies

- **Tone.js** - Audio synthesis and scheduling (CDN)
- **VexFlow** - Music notation rendering (CDN)
- **SortableJS** - Drag-and-drop reordering (CDN)
- **Tailwind CSS** - Styling (built locally)
