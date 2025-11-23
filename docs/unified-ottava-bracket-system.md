# Unified Ottava Bracket System

## Overview

This document describes the design and implementation of a unified ottava bracket rendering system for the Music Theory Lab's VexFlow notation display. The system handles 8va/8vb, 16va/16vb, and 32va/32vb brackets that span consecutive notes across measure boundaries.

---

## Problem Statement

### Current System Issues

The current implementation has **two separate bracket systems**:

1. **Intra-measure brackets** - Handle multiple notes within a single measure
2. **Cross-measure brackets** - Handle single-note measures across multiple measures

This dual system creates problems:

- **Gap at measure boundaries**: When the last note of measure 0 needs 8va and the first note of measure 1 needs 8va, two separate brackets are drawn instead of one continuous bracket
- **All-or-nothing within measures**: Cross-measure brackets only work when ALL notes in a measure need the same ottava
- **Complex conditional logic**: Determining which system to use requires checking measure note counts and bracket spans

### User Requirements

Users need ottava brackets that:
1. **Span consecutive notes** requiring the same ottava adjustment, regardless of measure boundaries
2. **Work with melody lines** where only some notes in a measure need ottava
3. **Handle chord progressions** where entire measures need ottava
4. **Support all ottava types**: 8va/8vb (±1 octave), 16va/16vb (±2 octaves), 32va/32vb (±3 octaves)

---

## Proposed Solution: Unified Bracket System

### Core Concept

Replace the dual system with a **single unified system** that:

1. **Flattens all notes** across all measures into a sequential list
2. **Groups consecutive notes** that need the same ottava label
3. **Draws one bracket** per group, spanning from first to last note in the group

This approach is **measure-agnostic** - it doesn't care about measure boundaries.

---

## Implementation Design

### Data Structure

#### 1. Flat Note List

Create a flat array of all rendered notes with their ottava requirements:

```javascript
const bassNotesFlat = [];
const trebleNotesFlat = [];

for (let i = 0; i < renderedMeasures.length; i++) {
  const measure = renderedMeasures[i];

  if (measure.bassNotes && measure.bassNotes.length > 0) {
    for (let noteIdx = 0; noteIdx < measure.bassNotes.length; noteIdx++) {
      const note = measure.bassNotes[noteIdx];

      // Find ottava label for this specific note
      let ottavaLabel = null;
      if (measure.bassOttavaBrackets) {
        for (const bracket of measure.bassOttavaBrackets) {
          if (noteIdx >= bracket.startIndex && noteIdx <= bracket.endIndex) {
            ottavaLabel = bracket.label;
            break;
          }
        }
      }

      bassNotesFlat.push({
        note,              // VexFlow note object
        measureIndex: i,   // Which measure this note belongs to
        noteIndex: noteIdx, // Index within the measure
        ottavaLabel        // '8va', '16va', '32va', '8vb', '16vb', '32vb', or null
      });
    }
  }
}
```

**Example flat list**:
```javascript
[
  { note: VexNote, measureIndex: 0, noteIndex: 0, ottavaLabel: null },
  { note: VexNote, measureIndex: 0, noteIndex: 1, ottavaLabel: null },
  { note: VexNote, measureIndex: 0, noteIndex: 2, ottavaLabel: '8va' },  // Last note of measure 0
  { note: VexNote, measureIndex: 1, noteIndex: 0, ottavaLabel: '8va' },  // First note of measure 1
  { note: VexNote, measureIndex: 1, noteIndex: 1, ottavaLabel: '8va' },
  { note: VexNote, measureIndex: 1, noteIndex: 2, ottavaLabel: null },
  // ...
]
```

#### 2. Ottava Groups

Group consecutive notes with the same ottava label:

```javascript
const groups = [
  {
    label: '8va',
    notes: [
      { note: VexNote, measureIndex: 0, noteIndex: 2, ottavaLabel: '8va' },
      { note: VexNote, measureIndex: 1, noteIndex: 0, ottavaLabel: '8va' },
      { note: VexNote, measureIndex: 1, noteIndex: 1, ottavaLabel: '8va' }
    ]
  },
  // ... more groups
]
```

### Algorithm

#### Grouping Algorithm

```javascript
let currentGroup = null;

for (let i = 0; i < notesFlat.length; i++) {
  const noteInfo = notesFlat[i];

  if (noteInfo.ottavaLabel) {
    if (!currentGroup || currentGroup.label !== noteInfo.ottavaLabel) {
      // Draw previous group if exists
      if (currentGroup && currentGroup.notes.length > 0) {
        drawOttavaBracket(currentGroup, clef, context);
      }
      // Start new group
      currentGroup = {
        label: noteInfo.ottavaLabel,
        notes: [noteInfo]
      };
    } else {
      // Continue current group
      currentGroup.notes.push(noteInfo);
    }
  } else {
    // No ottava - draw and reset group
    if (currentGroup && currentGroup.notes.length > 0) {
      drawOttavaBracket(currentGroup, clef, context);
    }
    currentGroup = null;
  }
}

// Draw final group
if (currentGroup && currentGroup.notes.length > 0) {
  drawOttavaBracket(currentGroup, clef, context);
}
```

#### Bracket Drawing

```javascript
function drawOttavaBracket(group, clef, context) {
  if (!group || !group.notes || group.notes.length === 0) return;

  const startNoteInfo = group.notes[0];
  const endNoteInfo = group.notes[group.notes.length - 1];

  // Determine bracket position (above for 8va/16va/32va, below for 8vb/16vb/32vb)
  const is8va = group.label === '8va' || group.label === '16va' || group.label === '32va';
  const position = is8va ? VF.TextBracket.Positions.TOP : VF.TextBracket.Positions.BOTTOM;

  // Create VexFlow bracket
  const textBracket = new VF.TextBracket({
    start: startNoteInfo.note,
    stop: endNoteInfo.note,
    text: group.label,
    superscript: '',
    position: position,
  });

  textBracket.render_options = {
    text_position_vertical: position,
    bracket_height: 15,
    show_bracket: true,
    underline_superscript: false,
  };

  // Calculate vertical positioning based on extreme pitches in the group
  const lineOffset = calculateLineOffset(group, clef, is8va);
  textBracket.setLine(lineOffset);
  textBracket.setContext(context).draw();
}
```

#### Line Offset Calculation

The bracket must be positioned above the highest note (for 8va) or below the lowest note (for 8vb):

```javascript
function calculateLineOffset(group, clef, is8va) {
  const isBass = clef === 'bass';
  let extremePitchLine = is8va ? -Infinity : Infinity;

  for (const noteInfo of group.notes) {
    if (is8va) {
      // Find highest pitch
      const highLine = isBass
        ? getHighestPitchLine(noteInfo.note)  // Bass: larger line = higher pitch
        : getLowestPitchLine(noteInfo.note);   // Treble: smaller line = higher pitch

      if (isBass) {
        if (highLine > extremePitchLine) extremePitchLine = highLine;
      } else {
        if (highLine < extremePitchLine) extremePitchLine = highLine;
      }
    } else {
      // Find lowest pitch
      const lowLine = isBass
        ? getLowestPitchLine(noteInfo.note)
        : getHighestPitchLine(noteInfo.note);

      if (isBass) {
        if (lowLine < extremePitchLine) extremePitchLine = lowLine;
      } else {
        if (lowLine > extremePitchLine) extremePitchLine = lowLine;
      }
    }
  }

  // Calculate offset based on clef and direction
  if (isBass) {
    return is8va
      ? (extremePitchLine - 5.0)   // Above highest note
      : (3.5 - extremePitchLine);  // Below lowest note
  } else {
    return is8va
      ? (8.0 - extremePitchLine)   // Above highest note
      : (extremePitchLine - 3.5);  // Below lowest note
  }
}
```

---

## Integration Points

### 1. Note Creation (createNotesForStaff)

**Current**: Each measure's notes are created with `ottavaBrackets` array attached to the measure

**Keep**: This per-measure bracket metadata is still useful for determining which notes need ottava

**Location**: `grandStaff.js` lines ~600-700

### 2. Bracket Drawing (after all notes rendered)

**Current**: Two separate loops - one for intra-measure, one for cross-measure

**Replace with**: Single unified loop that:
1. Builds flat note lists
2. Groups consecutive notes with same ottava
3. Draws brackets for each group

**Location**: `grandStaff.js` lines ~1025-1630

### 3. Helper Functions

**Keep existing**:
- `getHighestPitchLine(note)` - Gets highest pitch's staff line
- `getLowestPitchLine(note)` - Gets lowest pitch's staff line
- `applyOttavaAdjustment(pitches, clef)` - Determines ottava label for notes
- `applyOctaveShift(pitch, semitones)` - Transposes notes for display

**Add new**:
- `buildFlatNoteList(renderedMeasures, clef)` - Creates flat note array
- `groupConsecutiveOttava(notesFlat)` - Groups notes by ottava label
- `drawOttavaBracket(group, clef, context)` - Draws a single bracket
- `calculateLineOffset(group, clef, is8va)` - Calculates bracket position

---

## Code Location

### Files Modified

1. **`src/modules/notation/grandStaff.js`**
   - Replace bracket drawing logic (lines ~1025-1630)
   - Add helper functions after existing helpers

### Files Not Modified

1. **`src/modules/notation/vexFlowRenderer.js`**
   - `CLEF_RANGES` configuration already supports all ottava types
   - `applyOttavaAdjustment()` already returns correct labels

2. **`src/modules/notation/staffLayouter.js`**
   - No changes needed

3. **`src/modules/notation/notationInit.js`**
   - No changes needed

---

## Implementation Steps

### Phase 1: Add Helper Functions

```javascript
// Location: After existing getHighestPitchLine/getLowestPitchLine functions

/**
 * Build a flat list of all notes with their ottava requirements
 * @param {Array} renderedMeasures - Array of rendered measure data
 * @param {string} clef - 'bass' or 'treble'
 * @returns {Array} Flat array of note info objects
 */
function buildFlatNoteList(renderedMeasures, clef) {
  const notesFlat = [];
  const notesProp = clef === 'bass' ? 'bassNotes' : 'trebleNotes';
  const bracketsProp = clef === 'bass' ? 'bassOttavaBrackets' : 'trebleOttavaBrackets';

  for (let i = 0; i < renderedMeasures.length; i++) {
    const measure = renderedMeasures[i];
    const notes = measure[notesProp];

    if (notes && notes.length > 0) {
      for (let noteIdx = 0; noteIdx < notes.length; noteIdx++) {
        const note = notes[noteIdx];

        // Find ottava label for this note
        let ottavaLabel = null;
        if (measure[bracketsProp]) {
          for (const bracket of measure[bracketsProp]) {
            if (noteIdx >= bracket.startIndex && noteIdx <= bracket.endIndex) {
              ottavaLabel = bracket.label;
              break;
            }
          }
        }

        notesFlat.push({
          note,
          measureIndex: i,
          noteIndex: noteIdx,
          ottavaLabel
        });
      }
    }
  }

  return notesFlat;
}

/**
 * Group consecutive notes with the same ottava label
 * @param {Array} notesFlat - Flat array of note info objects
 * @returns {Array} Array of ottava groups
 */
function groupConsecutiveOttava(notesFlat) {
  const groups = [];
  let currentGroup = null;

  for (let i = 0; i < notesFlat.length; i++) {
    const noteInfo = notesFlat[i];

    if (noteInfo.ottavaLabel) {
      if (!currentGroup || currentGroup.label !== noteInfo.ottavaLabel) {
        // Start new group
        if (currentGroup) {
          groups.push(currentGroup);
        }
        currentGroup = {
          label: noteInfo.ottavaLabel,
          notes: [noteInfo]
        };
      } else {
        // Continue current group
        currentGroup.notes.push(noteInfo);
      }
    } else {
      // No ottava - finalize current group
      if (currentGroup) {
        groups.push(currentGroup);
        currentGroup = null;
      }
    }
  }

  // Add final group
  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}
```

### Phase 2: Replace Bracket Drawing Logic

```javascript
// Location: Replace lines ~1025-1630 in grandStaff.js

// PHASE 1.4+: Unified ottava bracket system
// Groups consecutive notes with same ottava across measure boundaries

// Build flat note lists
const bassNotesFlat = buildFlatNoteList(renderedMeasures, 'bass');
const trebleNotesFlat = buildFlatNoteList(renderedMeasures, 'treble');

// Group consecutive notes with same ottava
const bassGroups = groupConsecutiveOttava(bassNotesFlat);
const trebleGroups = groupConsecutiveOttava(trebleNotesFlat);

// Draw bass clef brackets
for (const group of bassGroups) {
  drawOttavaBracket(group, 'bass', context);
}

// Draw treble clef brackets
for (const group of trebleGroups) {
  drawOttavaBracket(group, 'treble', context);
}
```

### Phase 3: Implement Bracket Drawing

```javascript
/**
 * Draw an ottava bracket for a group of consecutive notes
 * @param {Object} group - Ottava group with label and notes
 * @param {string} clef - 'bass' or 'treble'
 * @param {Object} context - VexFlow rendering context
 */
function drawOttavaBracket(group, clef, context) {
  if (!group || !group.notes || group.notes.length === 0) return;

  try {
    const startNoteInfo = group.notes[0];
    const endNoteInfo = group.notes[group.notes.length - 1];
    const is8va = group.label === '8va' || group.label === '16va' || group.label === '32va';
    const position = is8va ? TOP_POSITION : BOTTOM_POSITION;

    const textBracket = new VF.TextBracket({
      start: startNoteInfo.note,
      stop: endNoteInfo.note,
      text: group.label,
      superscript: '',
      position: position,
    });

    textBracket.render_options = {
      ...textBracket.render_options,
      text_position_vertical: position,
      bracket_height: 15,
      show_bracket: true,
      underline_superscript: false,
    };

    // Calculate line offset based on extreme pitches
    const lineOffset = calculateLineOffset(group, clef, is8va);
    textBracket.setLine(lineOffset);
    textBracket.setContext(context).draw();

    console.log(`[Unified ${clef} bracket] Drew ${group.label} bracket spanning ${group.notes.length} notes from measure ${startNoteInfo.measureIndex} to ${endNoteInfo.measureIndex}`);
  } catch (e) {
    console.warn(`Error drawing unified ${clef} ottava bracket:`, e);
  }
}

/**
 * Calculate vertical line offset for ottava bracket
 * @param {Object} group - Ottava group
 * @param {string} clef - 'bass' or 'treble'
 * @param {boolean} is8va - True for 8va/16va/32va, false for 8vb/16vb/32vb
 * @returns {number} Line offset
 */
function calculateLineOffset(group, clef, is8va) {
  const isBass = clef === 'bass';
  let extremePitchLine = is8va ? -Infinity : Infinity;

  for (const noteInfo of group.notes) {
    if (is8va) {
      const highLine = isBass ? getHighestPitchLine(noteInfo.note) : getLowestPitchLine(noteInfo.note);
      if (isBass) {
        if (highLine > extremePitchLine) extremePitchLine = highLine;
      } else {
        if (highLine < extremePitchLine) extremePitchLine = highLine;
      }
    } else {
      const lowLine = isBass ? getLowestPitchLine(noteInfo.note) : getHighestPitchLine(noteInfo.note);
      if (isBass) {
        if (lowLine < extremePitchLine) extremePitchLine = lowLine;
      } else {
        if (lowLine > extremePitchLine) extremePitchLine = lowLine;
      }
    }
  }

  return isBass
    ? (is8va ? (extremePitchLine - 5.0) : (3.5 - extremePitchLine))
    : (is8va ? (8.0 - extremePitchLine) : (extremePitchLine - 3.5));
}
```

---

## Example Scenarios

### Scenario 1: Melody with Partial Ottava

**Input**:
- Measure 0: [C5, D5, E6, F6] - last 2 notes need 8va
- Measure 1: [G6, A6, B5, C5] - first 2 notes need 8va

**Flat list**:
```javascript
[
  { note: C5, measureIndex: 0, noteIndex: 0, ottavaLabel: null },
  { note: D5, measureIndex: 0, noteIndex: 1, ottavaLabel: null },
  { note: E6, measureIndex: 0, noteIndex: 2, ottavaLabel: '8va' },
  { note: F6, measureIndex: 0, noteIndex: 3, ottavaLabel: '8va' },
  { note: G6, measureIndex: 1, noteIndex: 0, ottavaLabel: '8va' },
  { note: A6, measureIndex: 1, noteIndex: 1, ottavaLabel: '8va' },
  { note: B5, measureIndex: 1, noteIndex: 2, ottavaLabel: null },
  { note: C5, measureIndex: 1, noteIndex: 3, ottavaLabel: null },
]
```

**Groups**:
```javascript
[
  {
    label: '8va',
    notes: [E6, F6, G6, A6]  // Spans measures 0-1
  }
]
```

**Result**: One continuous 8va bracket from E6 to A6 across the measure boundary

### Scenario 2: Chord Progression

**Input**:
- Measure 0: [Cmaj] - needs 8va
- Measure 1: [Gmaj] - needs 8va
- Measure 2: [Fmaj] - no ottava

**Flat list**:
```javascript
[
  { note: Cmaj, measureIndex: 0, noteIndex: 0, ottavaLabel: '8va' },
  { note: Gmaj, measureIndex: 1, noteIndex: 0, ottavaLabel: '8va' },
  { note: Fmaj, measureIndex: 2, noteIndex: 0, ottavaLabel: null },
]
```

**Groups**:
```javascript
[
  {
    label: '8va',
    notes: [Cmaj, Gmaj]
  }
]
```

**Result**: One 8va bracket spanning measures 0-1

### Scenario 3: Mixed Ottava Types

**Input**:
- Measure 0: [E7, F7] - needs 16va
- Measure 1: [G7, A7] - needs 16va
- Measure 2: [E6, F6] - needs 8va

**Groups**:
```javascript
[
  {
    label: '16va',
    notes: [E7, F7, G7, A7]
  },
  {
    label: '8va',
    notes: [E6, F6]
  }
]
```

**Result**: One 16va bracket for measures 0-1, one 8va bracket for measure 2

---

## Benefits

### Advantages Over Current System

1. **Simplicity**: Single algorithm vs. two separate systems
2. **Correctness**: Handles all note/measure combinations correctly
3. **Maintainability**: Less conditional logic, easier to understand
4. **Flexibility**: Works for any musical content (melody, chords, mixed)
5. **Performance**: One pass through notes instead of multiple loops

### Edge Cases Handled

✅ Last note of measure needs ottava, first note of next measure needs same ottava
✅ All notes in multiple consecutive measures need ottava
✅ Some notes in a measure need ottava, others don't
✅ Single note needs ottava
✅ Different ottava types in succession (16va → 8va)
✅ Ottava ends mid-measure
✅ Ottava starts mid-measure

---

## Testing Plan

### Unit Tests

Test the helper functions in isolation:

```javascript
// Test buildFlatNoteList
const measures = [/* mock measure data */];
const flatList = buildFlatNoteList(measures, 'treble');
assert(flatList.length === expectedNoteCount);
assert(flatList[0].ottavaLabel === '8va');

// Test groupConsecutiveOttava
const groups = groupConsecutiveOttava(flatList);
assert(groups.length === expectedGroupCount);
assert(groups[0].label === '8va');
assert(groups[0].notes.length === 4);
```

### Integration Tests

Test with real musical content:

1. **Melody test**: 4 measures with notes spanning E3-E7
2. **Chord progression test**: 8 measures with high chords needing 8va
3. **Mixed test**: Alternating melody and chords with various ottava needs
4. **Boundary test**: Notes at exact thresholds (E6, E3, E7, E2, E8, E1)

### Visual Verification

Check rendered output for:
- Bracket continuity across measures
- Correct bracket positioning (above/below staff)
- Correct label (8va, 16va, 32va, 8vb, 16vb, 32vb)
- No overlapping brackets
- No duplicate brackets

---

## Migration Path

### Step 1: Feature Flag

Add a feature flag to test the new system:

```javascript
const USE_UNIFIED_OTTAVA_SYSTEM = true;  // Toggle for testing

if (USE_UNIFIED_OTTAVA_SYSTEM) {
  // New unified system
  const bassNotesFlat = buildFlatNoteList(renderedMeasures, 'bass');
  // ...
} else {
  // Old dual system
  // ... existing code
}
```

### Step 2: Parallel Testing

Run both systems and compare output:
- Log bracket counts
- Log bracket spans
- Verify visual consistency

### Step 3: Remove Old Code

Once verified, remove:
- Old intra-measure bracket loop (~lines 1025-1319)
- Old cross-measure bracket loop (~lines 1321-1628)
- Conditional logic for `isMultiNoteMeasure`

---

## Performance Considerations

### Complexity Analysis

**Old system**:
- O(M × N) for intra-measure brackets (M measures, N notes per measure)
- O(M) for cross-measure brackets
- Total: O(M × N)

**New system**:
- O(M × N) to build flat list
- O(M × N) to group notes
- O(G) to draw brackets (G groups, typically G << M × N)
- Total: O(M × N)

**Result**: Similar complexity, but simpler code path

### Memory Usage

**Old system**: Bracket metadata stored per-measure
**New system**: Temporary flat list (M × N note objects)

**Impact**: Negligible - flat list is temporary and small

---

## Future Enhancements

### Possible Improvements

1. **Bracket styling**: Different colors/styles for different ottava types
2. **Smart positioning**: Avoid collisions with dynamics, articulations
3. **Multi-voice support**: Separate ottava for voice 1 vs voice 2
4. **Interactive editing**: Click bracket to toggle ottava on/off

### VexFlow Limitations

**Current limitation**: `TextBracket` can only span notes in the same `StaveNote` voice

**Workaround**: Our system works within this limitation by grouping notes sequentially

**Future**: If VexFlow adds cross-system bracket support, we could extend to multi-page ottava

---

## References

### VexFlow Documentation

- [TextBracket API](https://github.com/0xfe/vexflow/wiki/TextBracket)
- [StaveNote](https://github.com/0xfe/vexflow/wiki/StaveNote)

### Music Notation Standards

- Ottava notation: "8va" placed above bracket, dotted line continues
- Standard positions: 8va/8vb (±1 octave), 15ma/15mb (±2 octaves), 22ma/22mb (±3 octaves)
- Our implementation uses: 8va/8vb, 16va/16vb, 32va/32vb

### Related Files

- `vexFlowRenderer.js` - Note rendering and ottava adjustment
- `staffLayouter.js` - Staff positioning calculations
- `grandStaff.js` - Grand staff rendering and bracket drawing

---

## Conclusion

The unified ottava bracket system provides a simpler, more correct solution for rendering ottava brackets across measure boundaries. By treating all notes as a sequential stream and grouping consecutive notes with the same ottava requirement, we eliminate the complexity of the dual intra/cross-measure system while handling all edge cases correctly.

The implementation is straightforward, testable, and maintainable. It requires replacing ~600 lines of complex conditional logic with ~150 lines of simple grouping and drawing code.
