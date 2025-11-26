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

## Key Patterns

### Chord Data Structure
```javascript
{
  root: "C",
  type: "Major",
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
