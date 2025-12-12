# GhostNote and Cue Rest Migration Plan

## Purpose

This document provides a comprehensive guide for integrating the GhostNote/cue rest functionality from the current local codebase into commit `f39e7f6c7f4259d59500feb68aa3a3ae54a2d37e`. This feature uses VexFlow's built-in `GhostNote` class to create invisible spacing elements that maintain horizontal alignment between voices and clefs.

---

## What This Feature Does

### Problem Solved
In multi-voice notation, when Voice 1 has a note at beat 1 and Voice 2 has a note at beat 3, the voices need to align horizontally. Without proper spacing, Voice 2's note might appear at the wrong horizontal position.

### Solution
Use VexFlow's `GhostNote` class to create invisible "spacer" notes that:
1. Take up rhythmic time (affect horizontal spacing)
2. Are completely invisible (no glyph rendered)
3. Allow voices to align properly within the same clef
4. Allow treble and bass clefs to align properly

### Cue Rests
Additionally, the feature provides "cue rests" - smaller, grayed-out rests that:
1. Show where the other voice has notes
2. Help musicians understand the rhythmic relationship
3. Can be hidden entirely via a toolbar checkbox ("Hide Cue")

---

## Architecture Overview

### Render Modes for Rests

Each rest in multi-voice notation gets assigned a `_renderMode`:

| Mode | Behavior | When Used |
|------|----------|-----------|
| `'normal'` | Full-size visible rest | Primary voice, no overlap |
| `'cue'` | Small gray rest (60% size) | Rest overlaps with note in other voice |
| `'ghost'` | Invisible, maintains spacing | Hidden rests, or user chose "Hide Cue" |

### Flow Overview

```
1. User creates multi-voice composition
2. Renderer analyzes rest visibility (analyzeRestVisibility)
3. Render modes applied to each rest (applyRestVisibility)
4. VexFlow notes created based on render mode:
   - 'ghost' → createGhostNote()
   - 'cue' → createRest() with isCue: true
   - 'normal' → createRest()
5. Voices aligned using GhostNotes (alignVoicesWithGhostNotes)
6. VexFlow renders with proper spacing
```

---

## Code Components to Migrate

### 1. GhostNote Creation (`vexFlowRenderer.js`)

Add this function to create VexFlow GhostNotes:

```javascript
/**
 * Create a VexFlow GhostNote - an invisible note that maintains rhythmic spacing
 * Use this for hidden rests in multi-voice notation to keep voices aligned
 * @param {string} duration - Duration string (e.g., '4n', 'q')
 * @returns {Object} - VexFlow GhostNote
 */
export function createGhostNote(duration = '4n') {
  const VF = getVF();
  if (!VF) {
    console.error('[createGhostNote] VexFlow not available!');
    return null;
  }

  // Check if GhostNote class exists
  if (!VF.GhostNote) {
    console.error('[createGhostNote] VF.GhostNote class not found! VexFlow version issue?');
    return null;
  }

  // Convert duration to VexFlow format
  let vexDuration = DURATION_MAP[duration] || duration || 'q';

  // GhostNote doesn't use 'r' suffix - it's inherently a spacer
  // Remove any 'r' suffix if present
  vexDuration = vexDuration.replace(/r$/, '');

  try {
    const ghostNote = new VF.GhostNote({ duration: vexDuration });
    ghostNote._isGhostNote = true;
    ghostNote._isHiddenRest = true;
    return ghostNote;
  } catch (e) {
    console.error('[createGhostNote] FAILED to create GhostNote:', e);
    // Fallback: create a rest and hide it
    const fallbackRest = createRest(duration, 'treble', { hidden: true });
    return fallbackRest;
  }
}
```

### 2. Cue Rest Creation (`vexFlowRenderer.js`)

Update `createRest()` to support cue-sized rests:

```javascript
/**
 * Create a rest note
 * @param {string} duration - Duration of the rest
 * @param {string} clef - Clef for positioning
 * @param {Object} options - Optional settings for rest appearance
 * @param {boolean} options.isCue - If true, render as cue-sized (smaller) rest
 * @param {boolean} options.hidden - If true, rest is hidden (for clean notation mode)
 * @returns {Object} - VexFlow StaveNote (rest)
 */
export function createRest(duration = '4n', clef = 'treble', options = {}) {
  const { isCue = false, hidden = false } = options;

  // Pass isCue to createStaveNote so it can set glyph_font_scale at construction time
  // VexFlow 5.x requires scale to be set in constructor, not after
  const restNote = createStaveNote({
    pitch: null,
    duration,
    isRest: true,
    isCue, // Pass cue flag to constructor
  }, 'C', clef);

  if (!restNote) return null;

  // Mark as hidden FIRST (priority: invisible spacer but selectable)
  if (hidden) {
    restNote.glyph = null; // Remove glyph to make it not render
    restNote._isHiddenRest = true;
    restNote._isCueRest = isCue;
    return restNote;
  }

  // Apply cue color styling AFTER creation (color can be set post-construction)
  if (isCue && restNote.setStyle) {
    restNote.setStyle({
      fillStyle: 'rgba(0, 0, 0, 0.4)',
      strokeStyle: 'rgba(0, 0, 0, 0.4)',
    });
    // Try to add CSS class for post-render scaling
    if (restNote.addClass) {
      restNote.addClass('vf-cue-rest');
    }
    if (restNote.setAttribute) {
      restNote.setAttribute('data-cue-rest', 'true');
    }
  }

  restNote._isCueRest = isCue;
  return restNote;
}
```

### 3. In `createStaveNote()`, add isCue support:

```javascript
// Add to noteData destructuring:
const {
  // ... existing properties
  isCue = false,   // Create as cue-sized (smaller) note/rest
} = noteData;

// Before creating the note, add to noteConfig:
if (isCue) {
  // Make cue rests noticeably smaller - about 60% of normal size
  const CUE_FONT_SCALE = 23; // ~60% of normal (39)
  noteConfig.glyph_font_scale = CUE_FONT_SCALE;
  noteConfig.stroke_px = 1; // Smaller ledger lines
}
```

### 4. Rest Visibility Analysis (`grandStaff.js`)

Add the function to analyze which rests should be visible/hidden/cue:

```javascript
/**
 * Analyze rest visibility for multi-voice notation
 *
 * @param {Array} primaryVoiceNotes - Notes from voice 1 (typically stems up)
 * @param {Array} secondaryVoiceNotes - Notes from voice 2 (typically stems down)
 * @param {Object} options - Display options
 * @param {string} options.restDisplayMode - 'clean' (smart omission) or 'explicit' (show all)
 * @returns {Object} - { primaryRestVisibility: Map, secondaryRestVisibility: Map }
 *                     Each map: beat -> { hidden: boolean, isCue: boolean }
 */
export function analyzeRestVisibility(primaryVoiceNotes, secondaryVoiceNotes, options = {}) {
  const { restDisplayMode = 'clean' } = options;

  // Maps: beat number -> { hidden: boolean, isCue: boolean }
  const primaryRestVisibility = new Map();
  const secondaryRestVisibility = new Map();

  // If explicit mode, show all rests (no hiding)
  if (restDisplayMode === 'explicit') {
    return { primaryRestVisibility, secondaryRestVisibility };
  }

  // Helper to normalize beat values for comparison
  const normalizeBeat = (beat) => Math.round((beat ?? 0) * 10000) / 10000;

  // Build beat maps for each voice
  const primaryNoteBeats = new Set();
  const secondaryNoteBeats = new Set();

  primaryVoiceNotes.forEach(note => {
    if (!note.isRest && note.type !== 'rest') {
      primaryNoteBeats.add(normalizeBeat(note.beat));
    }
  });

  secondaryVoiceNotes.forEach(note => {
    if (!note.isRest && note.type !== 'rest') {
      secondaryNoteBeats.add(normalizeBeat(note.beat));
    }
  });

  // Analyze primary voice rests
  primaryVoiceNotes.forEach(note => {
    if (note.isRest || note.type === 'rest') {
      const beat = normalizeBeat(note.beat);
      const secondaryHasNote = secondaryNoteBeats.has(beat);

      if (secondaryHasNote) {
        // Primary rest overlaps with secondary note - mark as cue
        primaryRestVisibility.set(beat, { hidden: false, isCue: true });
      }
    }
  });

  // Analyze secondary voice rests
  secondaryVoiceNotes.forEach(note => {
    if (note.isRest || note.type === 'rest') {
      const beat = normalizeBeat(note.beat);
      const primaryHasNote = primaryNoteBeats.has(beat);

      if (primaryHasNote) {
        // Secondary rest overlaps with primary note - mark as cue
        secondaryRestVisibility.set(beat, { hidden: false, isCue: true });
      }
    }
  });

  return { primaryRestVisibility, secondaryRestVisibility };
}
```

### 5. Apply Rest Visibility (`grandStaff.js`)

```javascript
/**
 * Apply rest visibility settings using simple render modes.
 * Sets _renderMode on each rest: 'ghost' (hidden), 'cue' (small grey), or 'normal'
 *
 * @param {Array} notes - Array of note data
 * @param {Map} restVisibilityMap - Map of beat -> { hidden, isCue }
 * @param {boolean} hideCueRests - If true, cue rests become ghost notes (hidden)
 */
export function applyRestVisibility(notes, restVisibilityMap, hideCueRests = false) {
  // Clear previous render mode
  notes.forEach(note => {
    if (note.isRest || note.type === 'rest') {
      note._renderMode = undefined;
    }
  });

  if (!restVisibilityMap || restVisibilityMap.size === 0) {
    return;
  }

  const normalizeBeat = (beat) => Math.round((beat ?? 0) * 10000) / 10000;

  notes.forEach(note => {
    if (note.isRest || note.type === 'rest') {
      const beat = normalizeBeat(note.beat);
      const visibility = restVisibilityMap.get(beat);

      if (visibility) {
        if (visibility.hidden) {
          // Rest should be hidden (redundant rest in clean mode)
          note._renderMode = 'ghost';
        } else if (visibility.isCue) {
          // Rest overlaps with note in other voice
          if (hideCueRests) {
            // User wants cue rests hidden
            note._renderMode = 'ghost';
          } else {
            // User wants cue rests visible (small, grey)
            note._renderMode = 'cue';
          }
        } else {
          // Normal visible rest
          note._renderMode = 'normal';
        }
      }
    }
  });
}
```

### 6. Voice Alignment with GhostNotes (`grandStaff.js`)

This is the core alignment function. Add to `renderGrandStaffMeasure()`:

```javascript
/**
 * Align two voices within the same clef using GhostNotes
 * This ensures Voice 1 and Voice 2 on the same stave are properly aligned
 */
const alignVoicesWithGhostNotes = (notes1, vex1, notes2, vex2, totalBeats) => {
  const VF = getVF();

  // Helper to round beats for comparison
  const roundBeat = (beat) => Math.round((beat ?? 0) * 10000) / 10000;

  // Build beat maps: beat -> { noteData, vexNote }
  const buildBeatMap = (notes, vexNotes) => {
    const map = new Map();
    notes.forEach((note, i) => {
      const beat = roundBeat(note.beat);
      if (vexNotes[i]) {
        map.set(beat, { noteData: note, vexNote: vexNotes[i] });
      }
    });
    return map;
  };

  // Convert beats to VexFlow duration string
  const beatsToDuration = (beats) => {
    if (beats >= 4) return 'w';
    if (beats >= 3) return 'hd'; // dotted half
    if (beats >= 2) return 'h';
    if (beats >= 1.5) return 'qd'; // dotted quarter
    if (beats >= 1) return 'q';
    if (beats >= 0.75) return '8d'; // dotted eighth
    if (beats >= 0.5) return '8';
    if (beats >= 0.25) return '16';
    return '32';
  };

  const beatMap1 = buildBeatMap(notes1, vex1);
  const beatMap2 = buildBeatMap(notes2, vex2);

  // Collect all unique beat positions from both voices
  const allBeats = new Set([...beatMap1.keys(), ...beatMap2.keys()]);
  const sortedBeats = Array.from(allBeats).sort((a, b) => a - b);

  const aligned1 = [];
  const aligned2 = [];

  for (let i = 0; i < sortedBeats.length; i++) {
    const beat = sortedBeats[i];
    const entry1 = beatMap1.get(beat);
    const entry2 = beatMap2.get(beat);

    // Calculate gap to next beat (or end of measure)
    const nextBeat = sortedBeats[i + 1] ?? totalBeats;
    const gapBeats = roundBeat(nextBeat - beat);

    // Voice 1: add note or ghost
    if (entry1) {
      aligned1.push(entry1.vexNote);
    } else if (gapBeats > 0) {
      const ghostDuration = beatsToDuration(gapBeats);
      aligned1.push(new VF.GhostNote({ duration: ghostDuration }));
    }

    // Voice 2: add note or ghost
    if (entry2) {
      aligned2.push(entry2.vexNote);
    } else if (gapBeats > 0) {
      const ghostDuration = beatsToDuration(gapBeats);
      aligned2.push(new VF.GhostNote({ duration: ghostDuration }));
    }
  }

  return { aligned1, aligned2 };
};
```

### 7. Use in Rendering

In `renderGrandStaffMeasure()`, apply the alignment:

```javascript
// After creating vex notes for both voices...

// Align Voice 1 and Voice 2 within TREBLE clef
let alignedTrebleNotes1 = vexTrebleNotes;
let alignedTrebleNotes2 = vexTrebleNotes2;

if (hasMultipleVoices && vexTrebleNotes2.length > 0) {
  const trebleAligned = alignVoicesWithGhostNotes(
    primaryTrebleVoiceNotes, vexTrebleNotes,
    secondaryTrebleVoiceNotes, vexTrebleNotes2,
    totalBeats
  );
  alignedTrebleNotes1 = trebleAligned.aligned1;
  alignedTrebleNotes2 = trebleAligned.aligned2;
}

// Similar for bass clef...
```

### 8. Toolbar UI (`notationToolbar.js`)

Add the "Hide Cue" checkbox:

```javascript
// In render() HTML:
<div class="toolbar-section rest-display-section">
  <div class="button-group">
    <button class="toolbar-btn rest-display-btn ${this.restDisplayMode === 'clean' ? 'active' : ''}"
            data-rest-mode="clean" title="Clean: Hide redundant rests">Clean</button>
    <button class="toolbar-btn rest-display-btn ${this.restDisplayMode === 'explicit' ? 'active' : ''}"
            data-rest-mode="explicit" title="Show all rests">All</button>
  </div>
  <label class="cue-rest-toggle" title="Hide cue rests (uncheck to show grey cue rests)">
    <input type="checkbox" class="cue-rest-checkbox" ${this.cueRestsForSecondaryVoice ? 'checked' : ''}>
    <span class="cue-rest-label">Hide Cue</span>
  </label>
</div>

// Event listener:
this.container.querySelector('.cue-rest-checkbox')?.addEventListener('change', (e) => {
  this.setCueRestsEnabled(e.target.checked);
});

// Method:
setCueRestsEnabled(enabled) {
  this.cueRestsForSecondaryVoice = enabled;
  localStorage.setItem('notation-cue-rests', enabled ? 'true' : 'false');
  this.onRestDisplayModeChange({
    restDisplayMode: this.restDisplayMode,
    cueRestsForSecondaryVoice: this.cueRestsForSecondaryVoice,
  });
}
```

### 9. CSS for Cue Rests

```css
.cue-rest-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--bg-secondary, #333);
  color: var(--text-primary, #fff);
  transition: background 0.15s ease;
  height: 32px;
}

.cue-rest-toggle:hover {
  background: var(--bg-hover, #444);
}

.cue-rest-checkbox {
  width: 12px;
  height: 14px;
  cursor: pointer;
}

.cue-rest-label {
  font-size: 11px;
  color: var(--text-muted, #888);
}
```

---

## Integration Steps for Claude

### Step 1: Verify VexFlow GhostNote Support

Before integrating, verify that commit f39e7f6 already has GhostNote support:

```bash
git show f39e7f6:src/modules/notation/grandStaff.js | grep -c "GhostNote"
```

**IMPORTANT**: The baseline commit f39e7f6 already has GhostNote alignment code! Check the `alignVoicesWithGhostNotes` function. The main additions from local code are:

1. The `createGhostNote()` helper in vexFlowRenderer.js
2. The cue rest styling (smaller, grayed)
3. The toolbar "Hide Cue" checkbox
4. The `_renderMode` system

### Step 2: Add createGhostNote to vexFlowRenderer.js

1. Open `src/modules/notation/vexFlowRenderer.js`
2. Add the `createGhostNote()` function
3. Export it

### Step 3: Update createRest for Cue Support

1. Add `options` parameter to `createRest()`
2. Add cue styling logic
3. Test with multi-voice composition

### Step 4: Add Rest Visibility Analysis

1. Add `analyzeRestVisibility()` to grandStaff.js
2. Add `applyRestVisibility()` to grandStaff.js
3. Call them before creating VexFlow notes in `renderGrandStaffMeasure()`

### Step 5: Add Toolbar Controls

1. Add "Clean/All" buttons and "Hide Cue" checkbox to notationToolbar.js
2. Add event handlers
3. Connect to compositionState settings
4. Trigger re-render on change

### Step 6: Test

Create a test composition:
1. Add a whole note in Voice 1 at beat 1
2. Add a quarter note in Voice 2 at beat 3
3. Verify Voice 2's note aligns horizontally at beat 3
4. Verify cue rest appears at beat 1 in Voice 2 (small, gray)
5. Toggle "Hide Cue" and verify rest disappears
6. Toggle "All" mode and verify full-size rests appear

---

## Summary of Files to Modify

| File | What to Add |
|------|-------------|
| `vexFlowRenderer.js` | `createGhostNote()`, update `createRest()` with cue support |
| `grandStaff.js` | `analyzeRestVisibility()`, `applyRestVisibility()`, integrate into render |
| `notationToolbar.js` | Hide Cue checkbox, Clean/All buttons |
| `composerIntegration.js` | Pass rest display settings to renderer |
| `compositionState.js` | Store `restDisplayMode`, `cueRestsForSecondaryVoice` settings |

---

## Verification Checklist

- [ ] GhostNotes create proper horizontal spacing
- [ ] Cue rests appear small and gray at 60% size
- [ ] "Hide Cue" checkbox hides cue rests entirely
- [ ] "Clean" mode hides redundant rests
- [ ] "All" mode shows all rests at full size
- [ ] Multi-voice treble aligns correctly
- [ ] Multi-voice bass aligns correctly
- [ ] Treble and bass clefs align with each other
- [ ] Settings persist across page reload (localStorage)

---

## Notes

The baseline commit f39e7f6 already has the core GhostNote alignment logic in `grandStaff.js`. The main enhancements from local code are:

1. **Cue rest styling** - making overlapping rests smaller and grayed
2. **User controls** - "Hide Cue" checkbox and "Clean/All" toggle
3. **`_renderMode` system** - cleaner way to track how each rest should render
4. **`createGhostNote()` helper** - encapsulated function in vexFlowRenderer.js

Start by understanding the existing GhostNote code in f39e7f6, then layer the enhancements on top.
