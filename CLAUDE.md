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

## CRITICAL: Always Include Inversion Data AND Use Correct Enharmonic Spelling

**When passing chord data between modules (modals, playback, displays), ALWAYS include the `inversion` property AND use correctly spelled note names for the key.**

### Common Issues to Avoid:

1. **Missing inversions** - Frequently missed when:
   - Creating chord comparison/playback buttons
   - Passing chord context to modals (Why This Works, recommendations)
   - Playing chord sequences
   - Displaying chord labels/symbols

2. **Wrong enharmonic spelling** - A chord recommended as Bb may show as A# in playback buttons if you pass the raw `chord.root` instead of the spelled version. Always use `spellNoteInKey(chord.root, key)` for display and data passing.

### Chord Data Must Include Inversion AND Correct Spelling
```javascript
// WRONG - Missing inversion and using raw root
const chordData = { root: chord.root, type: 'Dominant 7th' };

// CORRECT - Include inversion AND use spelled root for enharmonic consistency
const chordData = {
    root: spellNoteInKey(chord.root, currentKey),  // Bb not A#
    type: 'Dominant 7th',
    inversion: chord.inversion || 0,
    notes: chord.notes  // Pre-computed notes respect inversion voicing
};
```

### When Passing Chord Context to Modals
```javascript
// WRONG - Passing raw chord data
prevChordData: prevChord,
nextChordData: nextChord,

// CORRECT - Spell roots and include inversions
prevChordData: prevChord ? {
    root: spellNoteInKey(prevChord.root, key),
    type: prevChord.type,
    inversion: prevChord.inversion || 0,
    notes: prevChord.notes
} : null,
```

### Display Chord Symbols with Inversion
Use superscript notation for inversions: C¹, Dm⁷², G⁷³
```javascript
function getChordSymbol(root, type, inversion = 0) {
    const symbol = root + getTypeSymbol(type);
    const invLabel = { 1: '¹', 2: '²', 3: '³', 4: '⁴' }[inversion] || '';
    return symbol + invLabel;
}
```

### Playback with Inversions
```javascript
// Use getInvertedChordNotes for inversions, or prefer pre-computed notes
if (chord.notes && chord.notes.length > 0) {
    notes = [...chord.notes];  // Pre-computed notes already have correct voicing
} else if (chord.inversion > 0) {
    const result = getInvertedChordNotes(chord.root, chord.type, chord.inversion);
    notes = result?.specificNotes || [];
} else {
    const result = getChordNotes(chord.root, chord.type);
    notes = result?.specificNotes || [];
}
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

---

## CRITICAL: CSS Text Color Override Issue

**When setting text colors via inline styles or Tailwind classes, you MUST also set `-webkit-text-fill-color`.**

This project has CSS (likely from Tailwind or custom styles) that sets `-webkit-text-fill-color`, which **overrides** the standard `color` property. Even `color: white !important` will be ignored if `-webkit-text-fill-color` is set to something else.

### Symptom:
- You set `style="color: white;"` or `class="text-white"`
- Text still appears dark/wrong color
- Dev tools Computed tab shows `color: rgb(255,255,255)` but `-webkit-text-fill-color: rgba(0,0,0,0)`

### Solution - Always set both properties:
```html
<!-- WRONG - color alone won't work -->
<span style="color: white;">Text</span>

<!-- CORRECT - set both color and -webkit-text-fill-color -->
<span style="color: #ffffff !important; -webkit-text-fill-color: #ffffff !important;">Text</span>
```

### Debugging:
When text color isn't working:
1. Right-click the element → Inspect
2. Go to "Computed" tab (not Styles)
3. Filter for "color"
4. Check both `color` AND `-webkit-text-fill-color` values

---

## CRITICAL: Collapsible Card Header Patterns

**When adding buttons or toggles to collapsible card headers, follow the established pattern exactly.**

### Header Element Must Be a `<div>`, NOT a `<button>`

Card headers that contain interactive elements (buttons, toggles) MUST use a `<div>` element, not a `<button>`. You cannot nest `<button>` elements inside a `<button>` - this is invalid HTML and will break the layout.

### Working Pattern (from `chord-progression-card-toggle`):

```html
<div id="[card]-card-toggle"
     onclick="if (!event.target.closest('.drag-handle') && !event.target.closest('button')) { window.toggleMelodySection && window.toggleMelodySection('[card]-card'); }"
     class="w-full px-4 py-2 bg-gradient-to-r from-[color1] to-[color2] text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-between cursor-pointer">
    <span class="flex items-center gap-2 flex-wrap">
        <!-- Drag handle SVG -->
        <!-- Icon SVG -->
        Card Title
        <!-- Buttons and toggles go HERE, inside the span -->
        <div class="flex items-center gap-1" onclick="event.stopPropagation()">
            <!-- Your buttons/toggles -->
        </div>
    </span>
    <!-- Chevron SVG -->
</div>
```

### Key Requirements:

1. **Use `<div>` not `<button>`** for the card toggle element
2. **Add `cursor-pointer`** to the class since divs don't have pointer cursor by default
3. **Exclude `button` in onclick**: `!event.target.closest('button')` prevents card collapse when clicking buttons
4. **Wrap interactive elements** in a div with `onclick="event.stopPropagation()"`
5. **All content inside the `<span>`** before the chevron

### Toggle Switch Pattern (matching project style):

```html
<div class="flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full" onclick="event.stopPropagation()" title="Toggle description">
    <span class="text-[9px] font-semibold text-white/80">Label</span>
    <label class="relative inline-flex items-center cursor-pointer mx-1">
        <input type="checkbox" id="[toggle]-checkbox" class="sr-only peer" checked
               onchange="window.toggleFunction && window.toggleFunction(this.checked)">
        <div class="w-8 h-4 bg-gray-400 peer-focus:outline-none rounded-full peer
                    peer-checked:after:translate-x-full peer-checked:after:border-white
                    after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                    after:bg-white after:border-gray-300 after:border after:rounded-full
                    after:h-3 after:w-3 after:transition-all peer-checked:bg-[accent-color]"></div>
    </label>
    <span class="text-[9px] font-semibold text-white/80" id="[toggle]-status">On</span>
</div>
```

Use `peer-checked:bg-emerald-500` for green headers, `peer-checked:bg-cyan-500` for blue headers.

### Styled Button Pattern (like DNA button):

```html
<button id="[action]-btn" onclick="window.actionFunction && window.actionFunction()"
        title="Button description"
        class="px-2 py-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600
               rounded-full text-[9px] font-bold text-white shadow-sm transition-all flex items-center gap-1">
    <svg class="w-3 h-3" ...></svg>
    Label
</button>
```

---

## KNOWN ISSUE: Dotted Duration Conversion Limitations

**The `beatsToDurationString()` function has precision limitations when converting arbitrary beat values to duration strings.**

### The Problem

When notes are split across measure boundaries or merged after shift-delete operations, the beat values may not align perfectly with standard musical durations. The current conversion uses `>=` comparisons that can lead to duration loss:

```javascript
// Current implementation in noteEditor.js:beatsToDurationString()
beatsToDurationString(beats) {
  if (beats >= 4) return '1n';
  if (beats >= 3) return '2n.';  // 3.5 beats → '2n.' (3 beats) - loses 0.5!
  if (beats >= 2) return '2n';   // 2.5 beats → '2n' (2 beats) - loses 0.5!
  if (beats >= 1.5) return '4n.';
  if (beats >= 1) return '4n';
  // ...etc
}
```

### Symptoms

1. **Beat loss during operations**: After shift-delete or note splitting, total beats in measure may not match original
2. **Dotted rests don't render well**: VexFlow has issues with dotted rests, so we split them into non-dotted rests
3. **Non-standard beat values**: Values like 2.5 or 3.5 beats don't have standard duration strings

### Areas Affected

- `shiftNotesBackward()` - Shift-delete operations
- `mergeTiedNotes()` - Merging notes that no longer cross measure boundaries
- Note splitting when notes cross measure boundaries
- `splitDottedDuration()` in `notationInit.js` - When replacing notes with rests

### Future Improvements Needed

1. **Compound duration support**: Break non-standard beat values into multiple notes (e.g., 2.5 beats → half note tied to eighth note)
2. **Beat tracking validation**: After operations, verify total beats in measure equals expected value
3. **Improved duration mapping**: Instead of `>=`, use exact comparisons with compound duration fallback

### Current Workarounds

- The system splits dotted durations into base + half when creating rests
- Tied note merging only occurs when the combined duration fits a standard value
- Shift-delete attempts to preserve note integrity but may lose fractional beats in edge cases

### Related Files

- `src/modules/notation/noteEditor.js` - `beatsToDurationString()`, `shiftNotesBackward()`, `mergeTiedNotes()`
- `src/modules/notation/notationInit.js` - `splitDottedDuration()`, `durationToBeats()`
