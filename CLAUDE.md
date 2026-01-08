# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 📚 NAVIGATION DOCUMENTS (READ THESE FIRST!)

**Before exploring the codebase, consult these guides to avoid unnecessary context usage:**

1. **[MODULE_INDEX.md](docs/MODULE_INDEX.md)** - Quick module navigation guide
   - Find which module handles what functionality
   - Locate files by feature area
   - Understand module dependencies
   - **Use this to find the right files without reading everything**

2. **[API_REFERENCE.md](docs/API_REFERENCE.md)** - Key function signatures
   - Quick lookup for function parameters and return types
   - Critical data structures (Chord, Note, Measure objects)
   - **Use this to understand APIs without reading full implementations**

3. **[STATE_MANAGEMENT.md](docs/STATE_MANAGEMENT.md)** - State flow diagrams
   - Data flow patterns (progression → compositionState → notation)
   - Event synchronization sequences
   - **Use this to understand state changes without tracing code**

**Workflow:** When starting a task, check MODULE_INDEX.md first to find relevant files, then use API_REFERENCE.md for function signatures, and finally read specific files only as needed.

---

## Project Overview

Music Theory Lab is an interactive web application for music theory education and chord progression composition. It uses a **chord-first composition workflow** where users build chord progressions first, then the system auto-generate1s bass accompaniment and suggests melody notes based on harmonic context.

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

## CRITICAL: Chord Card Width - CSS Override Issue

**Chord cards have their width set via inline styles in JavaScript, but CSS rules in `music.css` can override them with `!important`.**

Both ungrouped (no sections defined) and grouped (inside sections) chord cards need explicit width rules to prevent them from becoming too narrow.

### The Problem

JavaScript sets `wrapper.style.width = '120px'` on chord card wrappers in `ProgressionRenderer.js`. However, CSS rules with `width: auto !important` override this, causing cards to shrink to their `min-width` value (often 90px), making them too narrow.

### File Locations

- **Ungrouped cards**: `music.css` around line 2076-2078
- **Grouped cards (in sections)**: `music.css` lines 4166-4171

### Current Fixed Values

**Ungrouped chord cards** (before any sections are created):
```css
/* Around line 2076-2078 in music.css */
/* The rule that was overriding inline width: 120px */
/* Changed from width: auto !important to: */
width: 118px !important;
min-width: 118px;
```

**Grouped chord cards** (inside `.section-cards-area`):
```css
/* Lines 4166-4171 in music.css */
.section-cards-area .chord-card-wrapper {
    flex-shrink: 0;
    width: 118px !important; /* Fixed width to match ungrouped cards */
    min-width: 118px; /* Match ungrouped card width */
    max-width: 300px; /* Maximum for expanded cards */
}
```

### If Cards Appear Too Narrow

1. Check if a CSS rule is setting `width: auto !important`
2. Look in `music.css` for rules targeting `.chord-card-wrapper`
3. The fix is to set an explicit width with `!important` (e.g., `width: 118px !important`)
4. Both `width` and `min-width` should be set to the same value

### Note on Width Values

- **118px** is the current standard width for both grouped and ungrouped cards
- This value accounts for padding and ensures consistent card sizing
- Expanded cards (with notation view) use `width: fit-content` and are not affected

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

## CRITICAL: Note Property Copying - Use copyNoteWithAllProperties()

**When copying notes between data structures (compositionState → measureManager, import/export, etc.), ALWAYS use the centralized `copyNoteWithAllProperties()` helper function.**

### The Problem This Solves

Notes have MANY properties beyond just pitch and duration:
- `articulation` (staccato, accent, tenuto, marcato)
- `dynamic` (pp, p, mp, mf, f, ff, sfz, fp)
- `ornament` (trill, mordent, turn)
- `fermata` (normal, short, long)
- `graceNotes` (acciaccatura, appoggiatura)
- `lyric` (syllable text)
- `pedal` (down, up, half, change)
- `slur`, `beam`, `stemDirection`, `velocity`, etc.

Previously, code that copied notes manually would forget properties, causing them to be lost during:
- `.imtl` file import
- `syncFromProgression()` calls
- `refreshNotationFromProgression()` calls

### The Solution

**Location:** `src/modules/notation/composerIntegration.js` (exported function at top of file)

```javascript
import { copyNoteWithAllProperties } from './composerIntegration.js';

// CORRECT - Uses centralized function that includes ALL properties
const newNote = copyNoteWithAllProperties(originalNote, voiceIndex);

// WRONG - Manual copying that will miss properties!
const newNote = {
  pitch: note.pitch,
  duration: note.duration,
  // Missing articulation, dynamic, pedal, ornament, fermata, etc.!
};
```

### When Adding New Note Properties

If you add a new property to notes (e.g., from the toolbar):
1. Add it to `copyNoteWithAllProperties()` in `composerIntegration.js`
2. It will automatically be preserved everywhere

### Key Files That Use This

- `composerIntegration.js` - `syncFromProgression()`, `convertMeasuresToGrandStaff()`
- `projectManager.js` - Import/export (uses JSON.parse/stringify for deep copy)
- `compositionState.js` - Note creation and manipulation

---

## CRITICAL: Dotted Note Canonical Format

**Dotted notes MUST use the canonical format with a SEPARATE `dotted` boolean property.**

### The Problem We Solved

Dotted state was previously tracked in THREE inconsistent ways across the codebase:
1. `note.dotted` boolean property
2. `duration: '4n.'` (dot suffix in Tone.js string)
3. VexFlow `'qd'` format (d suffix)

This caused constant bugs where dotted notes would lose their dot when:
- Split across measure boundaries
- Selected in the UI (toolbar wouldn't update)
- Converted between formats

### The Solution: Centralized Utilities

**ALL dotted note operations MUST use `src/modules/notation/durationUtils.js`**

```javascript
import {
  normalizeDottedState,  // Ensure note has canonical format
  isDotted,              // Check if note is dotted (handles all formats)
  getBaseDuration,       // Strip '.' from duration string
  beatsToDuration,       // Convert beats → { duration, dotted }
  durationToBeats,       // Convert duration + dotted → beats
  getNoteDurationInBeats,// Get beats for note object
  createNote,            // Create properly formatted note
} from './durationUtils.js';
```

### Canonical Format (REQUIRED)

```javascript
// CORRECT - Canonical format
{
  duration: '2n',     // Base duration WITHOUT dot suffix
  dotted: true,       // Separate boolean property
  // ... other properties
}

// WRONG - Do not use dot in duration string
{
  duration: '2n.',    // NO! Dot should not be in duration string
}
```

### When Creating Notes

```javascript
// CORRECT - Use beatsToDuration() which returns canonical format
const { duration, dotted } = beatsToDuration(3); // { duration: '2n', dotted: true }
const note = {
  pitches: ['C4'],
  duration,  // '2n' (no dot)
  dotted,    // true
  beat: 0,
};

// ALSO CORRECT - Use createNote() helper
const note = createNote({
  pitches: ['C4'],
  beats: 3,  // Automatically converts to duration: '2n', dotted: true
  beat: 0,
});
```

### When Checking Dotted State

```javascript
// CORRECT - Use centralized isDotted()
import { isDotted } from './durationUtils.js';
if (isDotted(note)) {
  // This handles note.dotted flag AND duration ending with '.'
}

// WRONG - Don't check multiple conditions manually
if (note.dotted || note.duration?.endsWith('.')) {  // NO!
```

### When Calculating Beats

```javascript
// CORRECT - Use durationToBeats() with both parameters
import { durationToBeats, getNoteDurationInBeats } from './durationUtils.js';

const beats = durationToBeats(note.duration, note.dotted);
// OR for convenience:
const beats = getNoteDurationInBeats(note);

// WRONG - Don't calculate manually
const beats = DURATION_TO_BEATS[note.duration] * (note.dotted ? 1.5 : 1); // NO!
```

### For VexFlow Rendering

The `vexFlowRenderer.js` file handles conversion to VexFlow's 'd' suffix format internally. When passing notes to rendering functions:

```javascript
// Pass the canonical format - renderer handles VexFlow conversion
createNote({
  pitches: ['C4'],
  duration: '2n',  // NOT '2n.'
  dotted: true,
});
```

### Key Files Updated

- `src/modules/notation/durationUtils.js` - **THE SINGLE SOURCE OF TRUTH**
- `src/modules/notation/noteEditor.js` - Uses centralized utilities
- `src/modules/notation/notationToolbar.js` - Uses centralized utilities
- `src/modules/notation/vexFlowRenderer.js` - Uses centralized utilities

### Common Mistakes to AVOID

1. **Creating duration strings with dots**
   ```javascript
   // WRONG
   note.duration = '2n.';

   // CORRECT
   note.duration = '2n';
   note.dotted = true;
   ```

2. **Manual dotted checks**
   ```javascript
   // WRONG
   const isDotted = note.dotted || note.duration?.endsWith('.');

   // CORRECT
   import { isDotted } from './durationUtils.js';
   const isDottedNote = isDotted(note);
   ```

3. **Creating custom beatsToDuration functions**
   ```javascript
   // WRONG - There are 6+ different implementations scattered across files
   function myBeatsToDuration(beats) { ... }

   // CORRECT - Use the ONE centralized function
   import { beatsToDuration } from './durationUtils.js';
   ```

4. **Forgetting to set dotted when splitting notes**
   ```javascript
   // WRONG - Sets duration but forgets dotted flag
   measureNote.duration = '2n.';

   // CORRECT - Use beatsToDuration which returns both
   const { duration, dotted } = beatsToDuration(beatsToPlace);
   measureNote.duration = duration;
   measureNote.dotted = dotted;
   ```

---

## KNOWN ISSUE: Duration Conversion Edge Cases

**Some edge cases exist when converting arbitrary beat values to durations.**

### Non-Standard Beat Values

Values like 2.5 or 3.5 beats don't have standard single-note duration representations. The `beatsToDuration()` function finds the closest match, which may result in slight beat loss.

### Future Improvement

For non-standard beat values, a compound duration system could be added that returns multiple notes (e.g., 2.5 beats → half note tied to eighth note).

### Related Files

- `src/modules/notation/durationUtils.js` - Centralized duration utilities
- `src/modules/notation/noteEditor.js` - Shift operations
- `src/modules/notation/notationInit.js` - Note initialization

---

## 🚀 QUICK START GUIDES

**These task-specific guides help you quickly implement common features without reading the entire codebase.**

---

### Quick Start: Adding a New Chord Type

**Files to modify:** [src/data/music-data.js](src/data/music-data.js)

1. **Add chord definition to `CHORD_DEFINITIONS`:**
   ```javascript
   'My New Chord': {
     symbol: 'mynew',           // Display symbol (e.g., Cmynew)
     intervals: [0, 4, 7, 11],  // Semitone intervals from root
     group: 'Extended',         // CHORD_GROUPS category
     commonInversions: [0, 1]   // Which inversions are common
   }
   ```

2. **Test the chord:**
   - Open Chord Builder tab
   - Select your chord type from dropdown
   - Verify symbol displays correctly
   - Test playback
   - Test in progressions

3. **Add to `CHORD_GROUPS` (optional):**
   ```javascript
   Extended: [
     'Dominant 9th',
     'My New Chord',  // Add here
     // ...
   ]
   ```

**That's it!** The chord will automatically appear in all dropdowns and recommendation systems.

---

### Quick Start: Adding UI to Progression Builder

**Files to modify:**
- [index.html](index.html) - Add HTML
- [src/modules/features/progressionBuilder.js](src/modules/features/progressionBuilder.js) - Add handler
- [src/main.js](src/main.js) - Export to window

**Steps:**

1. **Add HTML in `index.html`:**
   ```html
   <!-- Find the #progression-builder-tab section -->
   <button id="my-new-button" onclick="window.myNewFeature && window.myNewFeature()">
     My Feature
   </button>
   ```

2. **Add handler in `progressionBuilder.js`:**
   ```javascript
   export function myNewFeature() {
     // Get composition state
     const compState = getCompositionState();

     // Modify progression
     compState.updateChord(0, { root: 'D' });

     // Sync (ALWAYS call both!)
     syncProgressionToMelodyComposer();
     refreshNotationFromProgression();
   }
   ```

3. **Export in `main.js`:**
   ```javascript
   import { myNewFeature } from './modules/features/progressionBuilder.js';
   window.myNewFeature = myNewFeature;
   ```

4. **Test:**
   - Click your button
   - Verify functionality works
   - Check that notation updates

---

### Quick Start: Adding a Recommendation Engine

**Files to create/modify:**
- Create: `src/modules/features/myRecommendationEngine.js`
- Modify: [src/modules/features/comprehensiveChordRecommendations.js](src/modules/features/comprehensiveChordRecommendations.js)

**Steps:**

1. **Create your recommendation engine:**
   ```javascript
   // src/modules/features/myRecommendationEngine.js
   export function generateMyRecommendations(currentChord, key, previousChords) {
     const recommendations = [];

     // Your recommendation logic here
     recommendations.push({
       root: 'C',
       type: 'Major',
       inversion: 0,
       score: 0.9,
       reason: 'Why this works'
     });

     return recommendations;
   }
   ```

2. **Integrate into comprehensive recommendations:**
   ```javascript
   // In comprehensiveChordRecommendations.js
   import { generateMyRecommendations } from './myRecommendationEngine.js';

   // Inside generateComprehensiveRecommendations():
   const myRecs = generateMyRecommendations(currentChord, key, prevChords);
   allRecommendations.push(...myRecs);
   ```

3. **Test:**
   - Open Progression Builder
   - Click "Suggestions" on a chord
   - Verify your recommendations appear

**See Also:** [docs/MODULE_INDEX.md](docs/MODULE_INDEX.md) - Recommendation engines section

---

### Quick Start: Modifying Chord Card Display

**Files to modify:** [src/modules/features/progressionBuilder.js](src/modules/features/progressionBuilder.js)

**Find the chord card HTML generation** (search for `createChordCard` or `updateSingleCard`):

1. **Locate card HTML template:**
   ```javascript
   // Search for: "chord-card" or "progression-card"
   // Around line ~2000-3000
   ```

2. **Add your custom HTML:**
   ```javascript
   cardHTML += `
     <div class="my-custom-section">
       ${chord.root} - ${chord.type}
     </div>
   `;
   ```

3. **Add event handlers if needed:**
   ```javascript
   // Add onclick handler
   <button onclick="window.myCardAction && window.myCardAction(${index})">
     Action
   </button>
   ```

4. **Style with Tailwind classes:**
   ```javascript
   <div class="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
     Custom content
   </div>
   ```

5. **Update all three card locations:**
   - `#progression-visualization` (Progression Builder)
   - `#melody-progression-visualization` (Melody Composer)
   - `#builder-progression-visualization` (Chord Builder)

**Tip:** Use `updateSingleCard(index)` to update all three cards at once.

---

### Quick Start: Adding a Modal Dialog

**Files to create/modify:**
- Create: `src/modules/ui/myCustomModal.js`
- Modify: [src/main.js](src/main.js)
- Modify: [index.html](index.html)

**Steps:**

1. **Create modal HTML in `index.html`:**
   ```html
   <!-- Add before closing </body> -->
   <div id="my-custom-modal" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex items-center justify-center">
     <div class="bg-white rounded-lg p-6 max-w-2xl w-full">
       <h2>My Custom Modal</h2>
       <div id="my-modal-content"></div>
       <button onclick="window.closeMyModal && window.closeMyModal()">Close</button>
     </div>
   </div>
   ```

2. **Create modal controller:**
   ```javascript
   // src/modules/ui/myCustomModal.js
   export function showMyModal(data) {
     const modal = document.getElementById('my-custom-modal');
     const content = document.getElementById('my-modal-content');

     // Populate content
     content.innerHTML = `<p>${data.message}</p>`;

     // Show modal
     modal.classList.remove('hidden');
   }

   export function closeMyModal() {
     const modal = document.getElementById('my-custom-modal');
     modal.classList.add('hidden');
   }
   ```

3. **Export in `main.js`:**
   ```javascript
   import { showMyModal, closeMyModal } from './modules/ui/myCustomModal.js';
   window.showMyModal = showMyModal;
   window.closeMyModal = closeMyModal;
   ```

4. **Open from anywhere:**
   ```javascript
   window.showMyModal({ message: 'Hello!' });
   ```

---

### Quick Start: Adding a New State Property

**Files to modify:** [src/modules/state/compositionState.js](src/modules/state/compositionState.js)

**Steps:**

1. **Add to CompositionState constructor:**
   ```javascript
   constructor() {
     // ... existing properties
     this.myNewProperty = initialValue;
   }
   ```

2. **Add getter:**
   ```javascript
   getMyNewProperty() {
     return this.myNewProperty;
   }
   ```

3. **Add setter with event emission:**
   ```javascript
   setMyNewProperty(value) {
     this.myNewProperty = value;
     this.emit('myPropertyChanged', value);
   }
   ```

4. **Listen for changes:**
   ```javascript
   const compState = getCompositionState();
   compState.on('myPropertyChanged', (value) => {
     console.log('Property changed:', value);
   });
   ```

5. **Include in export/import:**
   ```javascript
   // In exportToProgressionData():
   return {
     // ... existing exports
     myNewProperty: this.myNewProperty
   };

   // In importFromProgressionData():
   this.myNewProperty = data.myNewProperty || defaultValue;
   ```

---

### Quick Start: Modifying VexFlow Notation Display

**Files to modify:**
- [src/modules/notation/grandStaff.js](src/modules/notation/grandStaff.js) - Staff rendering
- [src/modules/notation/vexFlowRenderer.js](src/modules/notation/vexFlowRenderer.js) - Low-level VexFlow

**Common Tasks:**

**1. Change staff appearance:**
```javascript
// In grandStaff.js, find stave creation:
const stave = new Vex.Flow.Stave(x, y, width);
stave.setContext(context);
stave.setConfigForLines(5, { visible: true }); // Modify staff lines
```

**2. Add custom annotations:**
```javascript
// In vexFlowRenderer.js, when creating StaveNote:
const staveNote = new Vex.Flow.StaveNote({
  clef: 'treble',
  keys: ['c/4'],
  duration: 'q'
});

// Add annotation
staveNote.addAnnotation(0, new Vex.Flow.Annotation('text')
  .setFont('Arial', 10)
  .setVerticalJustification(Vex.Flow.Annotation.VerticalJustify.TOP));
```

**3. Change note styling:**
```javascript
// In vexFlowRenderer.js:
staveNote.setStyle({
  fillStyle: 'blue',
  strokeStyle: 'blue'
});
```

**4. Refresh notation after changes:**
```javascript
refreshNotationFromProgression();
```

---

### Quick Start: Adding Audio Playback

**Files to use:**
- [src/modules/audio/audioEngine.js](src/modules/audio/audioEngine.js) - Get instrument
- [src/modules/audio/melodyGenerator.js](src/modules/audio/melodyGenerator.js) - Scheduling

**Play a chord:**
```javascript
import { getPiano } from './modules/audio/audioEngine.js';

async function playMyChord() {
  const piano = getPiano();
  if (!piano) {
    console.error('Piano not ready');
    return;
  }

  const notes = ['C4', 'E4', 'G4'];
  const duration = '2n'; // Half note

  // Trigger attack
  piano.triggerAttackRelease(notes, duration);
}
```

**Play a melody sequence:**
```javascript
import { getPiano } from './modules/audio/audioEngine.js';
import Tone from 'tone';

async function playMyMelody() {
  const piano = getPiano();
  const melody = [
    { notes: ['C4'], duration: '4n', time: 0 },
    { notes: ['E4'], duration: '4n', time: 0.5 },
    { notes: ['G4'], duration: '4n', time: 1.0 }
  ];

  // Start Tone.js transport
  Tone.Transport.cancel(); // Clear existing events

  melody.forEach(note => {
    Tone.Transport.schedule((time) => {
      piano.triggerAttackRelease(note.notes, note.duration, time);
    }, note.time);
  });

  Tone.Transport.start();
}
```

**See Also:** [docs/API_REFERENCE.md](docs/API_REFERENCE.md#-audio-engine) - Audio functions

---

### Quick Start: Debugging State Issues

**Useful console commands:**

```javascript
// View entire composition state
window.getCompositionState().getMeasures();

// View specific measure
window.getCompositionState().getMeasure(0);

// View chord segments (bass alignment)
window.getCompositionState().getChordSegments();

// Export to progression format
window.getCompositionState().exportToProgressionData();

// View settings
window.getCompositionState().getSettings();

// View current progression (legacy format)
window.progressionData;

// Force notation refresh
window.refreshNotationFromProgression();

// Force sync
window.syncProgressionToMelodyComposer();
```

**See Also:** [docs/STATE_MANAGEMENT.md](docs/STATE_MANAGEMENT.md#-state-debugging)

---

### Quick Start: Running Tests

**This project currently has no formal test suite.**

**To manually test changes:**

1. **Test Progression Builder:**
   - Add chords
   - Remove chords
   - Swap chords (drag-and-drop)
   - Change chord properties
   - Play progression

2. **Test Melody Composer:**
   - Add notes to staff
   - Edit notes
   - Delete notes
   - Generate melody suggestions

3. **Test Chord Builder:**
   - Build custom chord
   - Preview chord
   - Add to progression

4. **Test Sync:**
   - Make changes in progression → verify notation updates
   - Make changes in notation → verify progression updates
   - Change key → verify all chords respell correctly

5. **Test Save/Load:**
   - Save project
   - Refresh page
   - Load project
   - Verify all data restored

---

## CRITICAL: Ottava Bracket Positioning (8va/8vb/15ma/15mb)

**File:** `src/modules/notation/grandStaff.js` (functions `drawBassBracket` and `drawTrebleBracket`)

**WARNING:** TOP position (8va/15ma) and BOTTOM position (8vb/15mb) brackets behave DIFFERENTLY with `setLine()`. Do NOT assume they work the same way.

### VexFlow Line Number Convention (IMPORTANT!)

VexFlow line numbers work like this:
- **LARGER/positive line numbers** = higher on staff = **higher pitch**
- **SMALLER/negative line numbers** = lower on staff = **lower pitch**

Example: A note at line 5 is HIGHER than a note at line -1.

Helper functions in grandStaff.js:
- `getHighestPitchLine(note)` → returns LARGEST line number (highest pitch)
- `getLowestPitchLine(note)` → returns SMALLEST line number (lowest pitch, can be negative)

### Tracking Variables Initialization

When tracking highest/lowest pitch across multiple notes in a bracket:
```javascript
// For finding the HIGHEST pitch (largest line number) - use MAX
let highestPitchLine = -Infinity;  // Will find maximum via > comparison

// For finding the LOWEST pitch (smallest line number) - use MIN
let lowestPitchLine = Infinity;    // Will find minimum via < comparison
```

### TREBLE CLEF 8va/15ma/22ma (TOP Position) - Bracket ABOVE Notes

For treble clef brackets that appear ABOVE the notes:

```javascript
// highestLine is the LARGEST line number (most positive = highest pitch)
// Use highestLine directly, subtract offset to position above
// For TOP: LARGER NEGATIVE offset = bracket moves DOWN (closer to notes)
lineOffset = highestLine - OFFSET;
```

**Current OFFSET value:** `4.5`

**How it works:**
- When `highestLine = 5` (high note): `lineOffset = 5 - 4.5 = 0.5` (bracket just above)
- When `highestLine = 2` (lower note): `lineOffset = 2 - 4.5 = -2.5` (bracket lower on page)

**Adjustments:**
- **To move label DOWN (closer to notes):** Increase OFFSET (e.g., `4.5` → `5.5`)
- **To move label UP (farther from notes):** Decrease OFFSET (e.g., `4.5` → `3.5`)

### TREBLE CLEF 8vb/15mb (BOTTOM Position) - Bracket BELOW Notes

For treble clef brackets that appear BELOW the notes:

```javascript
// lowestLine is the SMALLEST line number (most negative = lowest pitch)
// Negate lowestLine so lower notes produce larger offsets (pushing bracket down)
lineOffset = -lowestLine + OFFSET;
```

**Current OFFSET value:** `3.0`

**How it works:**
- When `lowestLine = -1` (low note): `lineOffset = -(-1) + 3.0 = 4.0` (bracket pushed down)
- When `lowestLine = 0.5` (higher note): `lineOffset = -(0.5) + 3.0 = 2.5` (bracket closer)

**Adjustments:**
- **To move label DOWN (farther below notes):** Increase OFFSET (e.g., `+3.0` → `+4.0`)
- **To move label UP (closer to notes):** Decrease OFFSET (e.g., `+3.0` → `+2.0`)

### BASS CLEF 8va/15ma/22ma (TOP Position) - Bracket ABOVE Notes

For bass clef brackets that appear ABOVE the notes:

```javascript
// highestLine is the LARGEST line number (most positive = highest pitch)
// Use highestLine directly, subtract offset to position above
// For TOP: LARGER NEGATIVE offset = bracket moves DOWN (closer to notes)
// Uses SAME formula and offset as treble clef
lineOffset = highestLine - OFFSET;
```

**Current OFFSET value:** `4.5` (same as treble clef)

**Adjustments:**
- **To move label DOWN (closer to notes):** Increase OFFSET (e.g., `4.5` → `5.5`)
- **To move label UP (farther from notes):** Decrease OFFSET (e.g., `4.5` → `3.5`)

### BASS CLEF 8vb/15mb/22mb (BOTTOM Position) - Bracket BELOW Notes

For bass clef brackets that appear BELOW the notes:

```javascript
// lowestLine is the SMALLEST line number (most negative = lowest pitch)
// Negate lowestLine so lower notes produce larger offsets
// Bass clef ALSO uses ADDITION (same as treble clef for 8vb/15mb)
lineOffset = -lowestLine + OFFSET;
```

**Current OFFSET value:** `2.0`

**How it works:**
- When `lowestLine = -1` (low note): `lineOffset = -(-1) + 2.0 = 1 + 2 = 3.0` (bracket pushed down)
- When `lowestLine = 0.5` (higher note): `lineOffset = -(0.5) + 2.0 = -0.5 + 2 = 1.5` (bracket closer)

**Adjustments:**
- **To move label DOWN (farther below notes):** Increase OFFSET (e.g., `+2.0` → `+3.0`)
- **To move label UP (closer to notes):** Decrease OFFSET (e.g., `+2.0` → `+1.0`)

### Summary: All Ottava Formulas

| Clef | Position | Labels | Formula | OFFSET |
|------|----------|--------|---------|--------|
| Treble | TOP (above) | 8va/15ma/22ma | `highestLine - OFFSET` | 4.5 |
| Treble | BOTTOM (below) | 8vb/15mb/22mb | `-lowestLine + OFFSET` | 3.0 |
| Bass | TOP (above) | 8va/15ma/22ma | `highestLine - OFFSET` | 4.5 |
| Bass | BOTTOM (below) | 8vb/15mb/22mb | `-lowestLine + OFFSET` | 2.0 |

**Key insight:** TOP and BOTTOM positions use completely different formula patterns. TOP subtracts, BOTTOM negates then adds.

---

## 📚 Additional Resources

- [docs/MODULE_INDEX.md](docs/MODULE_INDEX.md) - Find modules by functionality
- [docs/API_REFERENCE.md](docs/API_REFERENCE.md) - Function signatures and data structures
- [docs/STATE_MANAGEMENT.md](docs/STATE_MANAGEMENT.md) - State flow and sync patterns
- [docs/DEAD_CODE_AUDIT.md](docs/DEAD_CODE_AUDIT.md) - Known dead code (safe to ignore)
- [docs/REFACTORING_PLAN.md](docs/REFACTORING_PLAN.md) - Future refactoring plans

---

**Last Updated:** 2025-12-26
