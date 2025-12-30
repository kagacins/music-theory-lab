# Music Theory Lab - Notation System Recommendations

## Executive Summary

This document provides a comprehensive analysis of the current VexFlow implementation, notation toolbar, and musical data structures in Music Theory Lab. It identifies critical issues, improvement opportunities, and proposes a strategic implementation plan including a new **Measure Isolation Editing** feature.

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Identified Issues and Bugs](#identified-issues-and-bugs)
3. [Notation Toolbar Enhancement Plan](#notation-toolbar-enhancement-plan)
4. [Measure Isolation Editing Feature](#measure-isolation-editing-feature)
5. [Implementation Priority Matrix](#implementation-priority-matrix)
6. [Technical Recommendations](#technical-recommendations)

---

## Current Architecture Analysis

### Data Flow Overview

```
User Input (noteEditor.js)
    ↓
BuildingBlock/Unit System (buildingBlock.js)
    ↓
Composition State (compositionState.js)
    ↓
Measure Rendering (compositionState.renderTrebleBlocksToMeasures)
    ↓
VexFlow Rendering (vexFlowRenderer.js, grandStaff.js)
    ↓
Visual Output (SVG)
```

### Core Data Structures

#### Unit Subdivision System
- **48 units per beat** (enables clean division for all common note values)
- Quarter note = 48 units
- Eighth note = 24 units
- Sixteenth note = 12 units
- Triplet quarter = 32 units
- Dotted quarter = 72 units

#### parentIndex System
- `null` = Note start (contains all attributes: pitch, duration, articulation, accidental)
- `number` = Continuation unit pointing back to the note start index
- Critical for maintaining note integrity during operations

#### Two Rendering Paths
1. **Single-voice path**: Uses `trebleBlockSequence` with `insertTrebleNoteWithShift()`
2. **Multi-voice path**: Uses `shiftNotesForward()` directly on measure notation

#### Tie Flag System
- `tied: true` = Forward tie (this note ties TO the next)
- `isTied: true` = Backward tie (continuation FROM previous note)

### Key Files and Responsibilities

| File | Responsibility |
|------|---------------|
| `noteEditor.js` | User input handling, note selection, toolbar state |
| `buildingBlock.js` | Unit/BuildingBlock classes, note grouping, measure rendering |
| `compositionState.js` | Global state, shift operations, measure synchronization |
| `vexFlowRenderer.js` | VexFlow note creation, accidental tracking, rendering |
| `grandStaff.js` | Multi-voice handling, rest filling, staff coordination |
| `notationToolbar.js` | UI controls for notation attributes |

---

## Identified Issues and Bugs

### Issue Status Summary (Updated December 29, 2025)

| # | Issue | Status | Action Needed |
|---|-------|--------|---------------|
| 1 | Bass/Treble Shift Architectural Difference | ✅ Documented | Intentional design |
| 2 | Cross-Measure Tie Rendering | ⚠️ Needs Test | Verify in both clefs |
| 3 | Tied Note Merging Tolerance | ✅ Resolved | None |
| 4 | Block/Measure Desync (Multi-voice) | ⚠️ Documented | Intentional limitation |
| 5 | parentIndex Chain Breaking | ✅ Fixed | None |
| 6 | Accidental State Persistence | ✅ Appears Fixed | Verify with testing |
| 7 | Articulation Leaking | ✅ Intentional | Not a bug |
| 8 | Multi-Voice Rest Handling | ✅ Improved | Has configurable modes |
| 9 | Key Signature Sync | ✅ Fixed | None |
| 10 | Double Accidental Display | ℹ️ Edge Case | Low priority |

### Critical Issues

#### 1. Bass/Treble Shift Operations - Intentional Architectural Difference
**Status**: ✅ DOCUMENTED (Dec 29, 2025) - Different by design

**The Fundamental Difference**:
- **Treble**: Uses a **single continuous block** (`trebleBlockSequence.blocks[0]`) spanning the entire composition
- **Bass**: Uses **multiple blocks, one per chord** (`bassBlockSequence.blocks[chordIndex]`) tied to chord progression

**Why They're Different**:
```
TREBLE MODEL (Single Block):
┌─────────────────────────────────────────────────────────────┐
│  Block 0: [unit][unit][unit][unit][unit][unit][unit]...    │
│           ^--- All melody notes in one continuous block    │
└─────────────────────────────────────────────────────────────┘
- Shift operation: Move units within the block, adjust parentIndex pointers
- Clean abstraction for continuous melody editing

BASS MODEL (Chord-Aligned Blocks):
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Block 0 (C)  │ │ Block 1 (Am) │ │ Block 2 (F)  │  ...
│ [root][5th]  │ │ [root][5th]  │ │ [root][5th]  │
└──────────────┘ └──────────────┘ └──────────────┘
- Each block contains bass notes for ONE chord
- Blocks reorder when chords are reordered (drag-and-drop)
- Shift operations must work ACROSS chord boundaries
```

**Current Implementation**:
| Clef | Shift Method | Location | Data Source |
|------|-------------|----------|-------------|
| Treble | `insertTrebleNoteWithShift()` | compositionState.js:2690 | `trebleBlockSequence.blocks[0]` |
| Bass | `insertBassNoteWithShiftAtPosition()` | noteEditor.js:2007 | Measures directly |

**Why Measures for Bass Shift?**
The bass `bassBlockSequence` is optimized for chord-based operations (reordering, duration changes), not note-level editing. When users manually edit bass notes, those edits are stored in `measure.notation.bass` and marked with `autoGenerated: false` to preserve them across chord changes.

**Impact**: This is working as designed. Bass edits persist correctly via `saveEditedBassNotesForMeasure()`.

**Future Enhancement** (Optional): Could add `insertBassNoteWithShift()` to compositionState for API consistency, but would need to handle cross-chord-boundary cases carefully.

#### 2. Cross-Measure Tie Rendering - Status Check Needed
**Location**: `compositionState.js:2501-2645` (`renderTrebleBlocksToMeasures`)
**Location**: `compositionState.js:1640-1707` (`renderBassBlocksToMeasures`)
**Status**: ⚠️ NEEDS VERIFICATION
**Issue**: Both treble and bass rendering functions now handle tie flags (`tied` and `isTied`):
- Treble: Lines 2599-2611 set tie flags during cross-measure splitting
- Bass: Lines 1675-1676 pass through tie flags from BuildingBlockSequence
**Current Code** (treble - line 2599-2611):
```javascript
const tiedValue = !isLastPart
    ? (!note.isRest)  // Always tie to next part if not last
    : (note.tied || false);  // Preserve block's tied flag for last part
// ...
isTied: !isFirstPart, // True if this is a continuation FROM the previous note
tied: tiedValue,
```
**Impact**: Visual rendering of ties in `grandStaff.js` uses manual curve drawing. May still have edge cases.
**Recommendation**: Test cross-measure ties in both clefs to verify correct rendering.

#### 3. Tied Note Merging Tolerance Bug
**Location**: Previously `buildingBlock.js:735-744`
**Status**: ✅ RESOLVED or REFACTORED
**Issue**: The original merging algorithm with 1-unit tolerance no longer exists in the codebase. The code at lines 730-750 now handles pedal, text, voice, stem direction, and lyric properties.
**Current State**: The `getNotes()` method (lines 630-760) walks through units and reconstructs notes based on `parentIndex` chains without tolerance-based merging.
**Impact**: This issue appears to have been resolved through refactoring.

#### 4. Block vs Measure Desynchronization
**Location**: `compositionState.js:2282-2330` (`syncMeasuresToTrebleBlock`)
**Status**: ⚠️ DOCUMENTED LIMITATION
**Issue**: When Voice 2 has notes, the block sequence sync is explicitly skipped (lines 2291-2299):
```javascript
// MULTI-VOICE CHECK: Skip sync if Voice 2 has any notes
// The block sequence cannot represent multiple voices at the same position
const hasMultipleVoices = this.measures.some(m => { ... });
if (hasMultipleVoices) {
    console.log('[syncMeasuresToTrebleBlock] Skipping - multiple voices detected');
    return;
}
```
**Root Cause**: `BuildingBlockSequence` is a flat unit-based structure that cannot represent simultaneous notes at the same time position (required for Voice 2).
**Impact**: In multi-voice mode, measures become the source of truth and block-based operations are disabled.
**Recommendation**: This is an intentional architectural limitation. Document it clearly for users.

#### 5. parentIndex Chain Breaking
**Location**: `buildingBlock.js:604-660` (`setNote()`)
**Status**: ✅ FIXED
**Issue**: The `setNote()` method now includes a "CRITICAL FIX" (lines 629-659) that handles parentIndex chain repair:
```javascript
// CRITICAL FIX: If there are units AFTER this note that have parentIndex pointing
// to any unit within this note, they need to be updated to form a proper rest.
```
**Current Behavior**: When a note overwrites units that had continuation pointers, the code:
1. Detects orphaned continuation units
2. Converts the first orphan into a new note start
3. Updates subsequent orphans to point to the new start
**Impact**: This issue has been addressed. Note grouping should be maintained during edit operations.

### Moderate Issues

#### 6. Accidental State Persistence
**Location**: `buildingBlock.js:374-404` (`Unit.clone()`)
**Status**: ✅ APPEARS FIXED
**Investigation (Dec 29, 2025)**:
- `Unit.clone()` properly preserves accidentals (lines 388-390):
  ```javascript
  accidental: this.accidental,
  accidentals: this.accidentals ? [...this.accidentals] : null,
  ```
- `shiftNotesForward()` in noteEditor.js uses `JSON.parse(JSON.stringify(note))` for deep copy
- Both treble and bass shift operations preserve accidental data through cloning
**Recommendation**: Verify with manual testing. If issues persist, they may be in specific edge cases.

#### 7. Articulation Leaking to Shift-Inserted Notes
**Location**: `noteEditor.js:1452, 1554, 1607, 1667, etc.`
**Status**: ⚠️ INTENTIONAL BEHAVIOR
**Investigation (Dec 29, 2025)**:
- Articulation is applied from `this.currentArticulation` (toolbar state) to NEW notes
- This is **by design** - like standard notation software (Sibelius, Finale, MuseScore)
- Toolbar state persists until user toggles it off
- SHIFTED notes preserve their original articulations via `extractLogicalNotes()` (lines 6497, 6512)
**Not a Bug**: The toolbar articulation applies to newly inserted notes. Existing notes keep their articulations.
**Recommendation**: If different behavior is desired, could add option to auto-reset articulation after insert.

#### 8. Multi-Voice Rest Handling
**Location**: `grandStaff.js:178-300` (`fillGapsWithRests`), `grandStaff.js:302-420` (`analyzeRestVisibility`)
**Status**: ✅ SIGNIFICANTLY IMPROVED
**Investigation (Dec 29, 2025)**:
- `analyzeRestVisibility()` now provides smart rest visibility for multi-voice:
  - `restDisplayMode: 'clean'` - Hides redundant rests where another voice has a note
  - `restDisplayMode: 'explicit'` - Shows all rests
  - `cueRestsForSecondaryVoice` - Uses smaller cue-sized rests
  - `hideCueRests` - Makes cue rests invisible (GhostNotes)
- Settings stored in `compositionState.settings` (lines 852-854)
- Auto-generated rests marked with `_autoGenerated: true` flag
**Impact**: This issue has been substantially addressed with configurable display modes.

### Minor Issues

#### 9. Key Signature Sync (FIXED)
**Location**: `trainerState.js:282-293`
**Status**: ✅ FIXED - `setCurrentKey()` now syncs to `compositionState.metadata.key`.

#### 10. Double Accidental Display
**Issue**: Double sharps (##) and double flats (bb) are supported but rarely used correctly.
**Impact**: Edge case handling may need refinement.

---

## Notation Toolbar Enhancement Plan

### Current Capabilities

| Category | Features |
|----------|----------|
| **Durations** | Whole, half, quarter, eighth, sixteenth, thirty-second |
| **Modifiers** | Dotted notes, rests |
| **Tuplets** | Triplets, quintuplets, septuplets |
| **Accidentals** | Natural, sharp, flat, double-sharp, double-flat |
| **Articulations** | Staccato, accent, tenuto, marcato, fermata |
| **Voice Control** | Voice 1, Voice 2 selection |
| **Time Signature** | Configurable |
| **Layout** | Measures per line |

### Tier 1 Enhancements (High Priority)

#### 1. Dynamics
**Symbols**: pp, p, mp, mf, f, ff, sfz, fp
**Implementation**:
- Add `dynamics` property to Unit class
- Render below staff using VexFlow's `Annotation` or `TextDynamics`
- Store in note data structure

#### 2. Slurs and Phrase Marks
**Status**: 🔧 DATA STRUCTURE EXISTS, UI MISSING
**Existing Infrastructure** (`buildingBlock.js:260-261`):
```javascript
// Slur information: { start: slurId, end: slurId } - supports nested slurs
this.slur = options.slur || null;
```
- `slur` property already exists on Unit class
- `_computeSlurForPart()` method handles slurs in split notes (lines 1047-1060)
- Slur data flows through measure rendering
**Remaining Work**:
- Create UI for slur creation (click-drag between notes)
- Implement VexFlow `Curve` rendering based on slur data
- Add slur visibility in notation

#### 3. Crescendo/Decrescendo (Hairpins)
**Implementation**:
- Store start/end positions
- Use VexFlow's `StaveHairpin`
- UI: Button to mark crescendo/decrescendo regions

### Tier 2 Enhancements (Medium Priority)

#### 4. Repeat Signs and Endings
**Types**: Start repeat, end repeat, first/second endings
**Implementation**:
- Measure-level attributes
- Use VexFlow's `Barline` types and `Volta`

#### 5. Tempo Markings
**Types**: BPM, Italian terms (Allegro, Andante, etc.)
**Implementation**:
- Store in composition metadata or measure
- Render using VexFlow's `StaveText`

#### 6. Grace Notes
**Implementation**:
- Use VexFlow's `GraceNoteGroup`
- Add `graceNotes` array property to main notes

#### 7. Ornaments
**Types**: Trill, mordent, turn, tremolo
**Implementation**:
- Use VexFlow's `Ornament` modifier
- Add to articulation options

### Tier 3 Enhancements (Lower Priority)

#### 8. Custom Beam Groups
Allow users to control beam groupings manually.

#### 9. Lyrics/Text Annotations
Add text below notes for lyrics or analysis.

#### 10. Chord Symbols
Display chord names above the staff.

#### 11. Pedal Markings
Piano-specific sustain pedal notation.

### Proposed Toolbar Redesign

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Duration] [Rest] [Dot] │ [Tuplet ▼] │ [Accidental ▼] │ [Voice ▼] │
├─────────────────────────────────────────────────────────────────────┤
│ [Articulation ▼] │ [Dynamics ▼] │ [Slur] [Tie] │ [More ▼]         │
├─────────────────────────────────────────────────────────────────────┤
│ [Measure Edit Mode] │ [Time Sig] │ [Key Sig] │ [Tempo]            │
└─────────────────────────────────────────────────────────────────────┘
```

**Design Principles**:
- Group related controls
- Use dropdowns for less common options
- Keep frequently used controls always visible
- Add keyboard shortcuts for power users

---

## Measure Isolation Editing Feature

### Concept Overview

**Measure Isolation Editing** allows users to edit a single measure in isolation without affecting surrounding measures. Changes are validated before being applied, ensuring the measure respects time signature constraints.

### User Workflow

1. **Select Measure**: Click on a measure to select it
2. **Enter Edit Mode**: Click "Edit Measure" button or press `E`
3. **Isolated Editing**:
   - Measure expands to show detailed editing view
   - Notes can be moved, resized, added, deleted freely
   - Real-time beat counter shows current/max beats
   - Surrounding measures are dimmed but visible for context
4. **Validate**: System checks if edits fit within time signature
5. **Apply/Cancel**:
   - "Apply" commits changes if valid
   - "Cancel" reverts to original state
   - Invalid states prevent Apply (with feedback)

### Technical Design

#### State Management

```javascript
// measureIsolationState.js
const measureIsolationState = {
    isActive: false,
    measureIndex: null,
    clef: null, // 'treble' or 'bass'
    originalMeasure: null, // Deep copy for revert
    workingMeasure: null,  // Current edits
    validationErrors: [],

    enterEditMode(measureIndex, clef) { ... },
    exitEditMode(commit = false) { ... },
    validateMeasure() { ... },
    applyChanges() { ... },
    revertChanges() { ... }
};
```

#### Validation Rules

```javascript
function validateMeasure(measure, timeSignature) {
    const errors = [];
    const maxUnits = timeSignature.numerator * 48; // Units per measure

    // Check total duration
    const totalUnits = measure.voices.reduce((sum, voice) => {
        return Math.max(sum, calculateVoiceDuration(voice));
    }, 0);

    if (totalUnits > maxUnits) {
        errors.push({
            type: 'OVERFLOW',
            message: `Measure exceeds ${timeSignature.numerator} beats`,
            excess: totalUnits - maxUnits
        });
    }

    if (totalUnits < maxUnits) {
        errors.push({
            type: 'UNDERFLOW',
            message: `Measure needs ${(maxUnits - totalUnits) / 48} more beats`,
            deficit: maxUnits - totalUnits
        });
    }

    // Check voice alignment (optional - may allow independent voice lengths)
    // Check for orphaned ties
    // Check for invalid note values

    return { valid: errors.length === 0, errors };
}
```

#### UI Components

```
┌──────────────────────────────────────────────────────────────────┐
│  Measure 3 - Edit Mode                              [x] Close    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  [Expanded Staff View - Shows notes larger for editing]    │  │
│  │                                                            │  │
│  │  Voice 1: ♩ ♩ ♩ ♩                                         │  │
│  │  Voice 2: ♩ ♪♪ ♩ ♩                                        │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Beats: [████████████████____] 4/4  (4.0 / 4.0)                │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Cancel    │  │  Validate   │  │   Apply     │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└──────────────────────────────────────────────────────────────────┘
```

#### Note Manipulation in Edit Mode

**Drag Operations**:
- Horizontal drag: Move note in time (snap to grid based on current duration)
- Vertical drag: Change pitch
- Edge drag: Resize note duration

**Smart Adjustments**:
- When a note is moved, adjacent notes don't shift (isolation principle)
- Gaps are filled with rests automatically
- Overlapping notes show warning

#### Tie Handling at Boundaries

**Incoming Ties** (from previous measure):
- Show indicator that note is tied from previous
- Editing the pitch updates both sides of tie
- Can break tie (adds accidental if needed)

**Outgoing Ties** (to next measure):
- Show indicator that note ties forward
- Changing duration that would break tie shows warning
- Can explicitly break tie

### Implementation Phases

#### Phase 1: Core Infrastructure
- Create `measureIsolationState.js`
- Add enter/exit edit mode functions
- Implement deep copy for measure backup
- Add validation framework

#### Phase 2: UI Components
- Create expanded measure view component
- Add beat counter visualization
- Implement edit mode toolbar
- Add visual feedback for validation errors

#### Phase 3: Note Manipulation
- Implement drag-to-move for notes
- Implement drag-to-resize for duration
- Add pitch adjustment via vertical drag
- Implement grid snapping

#### Phase 4: Integration
- Connect to existing noteEditor
- Handle tie boundaries correctly
- Integrate with undo/redo system
- Add keyboard shortcuts

---

## Implementation Priority Matrix

### Phase 1: Critical Fixes (Immediate)

| Item | Effort | Impact | Priority |
|------|--------|--------|----------|
| Fix articulation leaking on shift-insert | Low | High | P0 |
| Complete bass clef tie rendering | Medium | High | P0 |
| Fix tied note merging tolerance | Low | Medium | P1 |
| Implement bass clef shift operations | High | High | P1 |

### Phase 2: Stability Improvements (Short-term)

| Item | Effort | Impact | Priority |
|------|--------|--------|----------|
| Unified shift operation API | High | High | P1 |
| Block/Measure sync improvements | Medium | High | P1 |
| parentIndex chain protection | Medium | Medium | P2 |
| Multi-voice rest optimization | Low | Low | P2 |

### Phase 3: Feature Enhancements (Medium-term)

| Item | Effort | Impact | Priority |
|------|--------|--------|----------|
| Dynamics support | Medium | High | P1 |
| Slurs and phrase marks | High | High | P1 |
| Measure Isolation Editing | High | Very High | P1 |
| Crescendo/decrescendo | Medium | Medium | P2 |
| Toolbar redesign | Medium | Medium | P2 |

### Phase 4: Advanced Features (Long-term)

| Item | Effort | Impact | Priority |
|------|--------|--------|----------|
| Repeat signs and endings | Medium | Medium | P2 |
| Grace notes | Medium | Medium | P3 |
| Ornaments | Low | Low | P3 |
| Custom beam groups | High | Low | P3 |
| Lyrics support | Medium | Medium | P3 |

---

## Technical Recommendations

### 1. Create Unified Note Operation API

```javascript
// noteOperations.js
export const NoteOperations = {
    insert(options) {
        const { clef, voice, measureIndex, position, noteData, shiftMode } = options;
        // Unified logic for both clefs
        // Handles shift operations consistently
    },

    delete(options) {
        const { clef, voice, measureIndex, noteIndex, shiftMode } = options;
        // Unified delete with shift support
    },

    update(options) {
        const { clef, voice, measureIndex, noteIndex, updates } = options;
        // Update note properties without breaking ties
    },

    move(options) {
        const { clef, voice, fromMeasure, fromIndex, toMeasure, toIndex } = options;
        // Move note between positions
    }
};
```

### 2. Add Comprehensive Tie Management

```javascript
// tieManager.js
export const TieManager = {
    createTie(note1, note2) { ... },
    breakTie(note) { ... },
    validateTies(measures) { ... },
    repairBrokenTies(measures) { ... },
    getTieChain(note) { ... } // Get all notes in a tie chain
};
```

### 3. Implement Event-Driven Architecture

```javascript
// notationEvents.js
export const NotationEvents = {
    NOTE_ADDED: 'note:added',
    NOTE_DELETED: 'note:deleted',
    NOTE_UPDATED: 'note:updated',
    MEASURE_CHANGED: 'measure:changed',
    TIE_CREATED: 'tie:created',
    TIE_BROKEN: 'tie:broken'
};

// Usage
eventBus.emit(NotationEvents.NOTE_ADDED, { measureIndex, noteData });
```

### 4. Add Undo/Redo for Notation Changes

```javascript
// notationHistory.js
export const NotationHistory = {
    push(action) { ... },
    undo() { ... },
    redo() { ... },
    canUndo() { ... },
    canRedo() { ... }
};
```

### 5. Improve Error Handling

```javascript
// notationErrors.js
export class NotationError extends Error {
    constructor(message, type, context) {
        super(message);
        this.type = type;
        this.context = context;
    }
}

export const ErrorTypes = {
    INVALID_DURATION: 'INVALID_DURATION',
    MEASURE_OVERFLOW: 'MEASURE_OVERFLOW',
    BROKEN_TIE: 'BROKEN_TIE',
    INVALID_PITCH: 'INVALID_PITCH'
};
```

### 6. Add Development Tools

```javascript
// notationDebugger.js (dev only)
export const NotationDebugger = {
    logMeasureState(measureIndex) { ... },
    visualizeUnits(buildingBlock) { ... },
    validateAllTies() { ... },
    checkParentIndexIntegrity() { ... },
    exportStateSnapshot() { ... }
};
```

---

## Conclusion

The Music Theory Lab notation system has a solid foundation with the unit-based subdivision system and VexFlow integration. The key areas for improvement are:

1. **Stability**: Fix cross-measure tie handling, implement bass clef shift operations, and protect parentIndex chains
2. **Features**: Add dynamics, slurs, and the Measure Isolation Editing feature
3. **Architecture**: Create unified APIs for note operations and improve event-driven updates
4. **User Experience**: Redesign the toolbar and add keyboard shortcuts

The **Measure Isolation Editing** feature represents a significant opportunity to improve user confidence when editing compositions. By allowing users to edit measures in isolation with validation before committing, we can eliminate the fear of unintended consequences that currently makes notation editing feel fragile.

---

## Appendix: File Reference

| File | Lines | Key Functions |
|------|-------|---------------|
| `noteEditor.js` | ~7400 | `insertNoteBeforeSelected()`, `insertNoteAfterSelected()`, `handleStaffClick()`, `insertBassNoteWithShiftAtPosition()` |
| `buildingBlock.js` | ~1150 | `setNote()`, `getNotes()`, `renderToMeasures()`, `_computeSlurForPart()` |
| `compositionState.js` | ~7200 | `insertTrebleNoteWithShift()`, `deleteTrebleNoteWithShift()`, `renderTrebleBlocksToMeasures()`, `renderBassBlocksToMeasures()` |
| `vexFlowRenderer.js` | ~1400 | `parseNote()`, `getRequiredAccidental()`, `createStaveNote()` |
| `grandStaff.js` | ~4300 | `fillGapsWithRests()`, voice separation logic, `drawTieCurve()`, `drawPartialTieCurve()` |
| `notationToolbar.js` | ~1850 | UI state management, toolbar rendering |
| `trainerState.js` | ~650 | `setCurrentKey()`, global training state |

---

*Document generated: December 26, 2025*
*Last Updated: December 29, 2025*
*Version: 1.1*
