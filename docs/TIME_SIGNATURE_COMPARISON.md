# Time Signature Implementation Comparison

## Overview

This document compares two versions of the codebase:
1. **Working Baseline**: Commit `f39e7f6c7f4259d59500feb68aa3a3ae54a2d37e` (Dec 10, 2025) - "Rhythm Pattern Library Enhancements"
2. **Current Local Code**: With extensive time signature work that has bugs

The goal is to preserve the valuable time signature work so it can be properly integrated later.

---

## Part 1: The Working Baseline (Commit f39e7f6)

### Architecture Summary

The baseline code works correctly for **4/4 time signature only**. It uses a simple approach:

#### Key Characteristics

1. **Simple beats-per-measure calculation**:
   ```javascript
   const beatsPerMeasure = this.metadata.timeSignature?.num || 4;
   ```
   - Just uses the numerator directly
   - Works for 4/4 but wrong for compound meters (6/8 would give 6 instead of 3)

2. **Multi-voice handling**:
   - Both `syncMeasuresToTrebleBlock()` and `renderTrebleBlocksToMeasures()` skip entirely if Voice 2 has notes
   - When multi-voice is detected, measures become "source of truth" and block sequence is ignored

3. **Note adding/shifting flow**:
   ```
   User adds note → addTrebleNote() → addTrebleNoteAtUnit() → block.setNote() → renderTrebleBlocksToMeasures()
   ```
   - Notes go into block sequence first
   - Block is rendered to measures
   - Works reliably for 4/4

4. **No time signature change support**:
   - No `setTimeSignature()` function that handles note preservation
   - Changing time signature would lose all treble notes

#### Files and Key Functions

| File | Function | Purpose |
|------|----------|---------|
| `compositionState.js` | `syncMeasuresToTrebleBlock()` | Reads notes from measures → writes to block |
| `compositionState.js` | `renderTrebleBlocksToMeasures()` | Reads notes from block → writes to measures |
| `compositionState.js` | `addTrebleNoteAtUnit()` | Adds note to block at unit position |
| `buildingBlock.js` | `getBeatsPerMeasure()` | Returns `this.timeSignature.num` |
| `buildingBlock.js` | `setNote()` | Sets note in block at given position |

#### What Works

- Adding notes in 4/4 time
- Shifting notes (insert with shift)
- Multi-voice (but block sequence is disabled)
- Tied notes across measure boundaries
- All musical attributes preserved

#### What Doesn't Work

- Any time signature other than 4/4
- Time signature changes
- Compound meters (6/8, 9/8)
- Cut time (2/2)

---

## Part 2: Current Local Code (Time Signature Work)

### New Features Added

#### 1. Time Signature-Aware Helper Functions

```javascript
// compositionState.js lines 222-310

export function getBeatsPerMeasureFromTimeSignature(timeSignature = { num: 4, denom: 4 }) {
    const num = timeSignature?.num ?? 4;
    const denom = timeSignature?.denom ?? 4;
    return num * (4 / denom);  // Correctly handles all denominators
}

export const TS_PPQ = 480; // ticks per quarter note

export function getTicksPerDenominator(timeSignature)
export function getMeasureCapacityTicks(timeSignature)
export function durationStringToTicks(durationStr, timeSignature)
export function beatsToTicks(beats, timeSignature)
export function ticksToBeats(ticks)
export function sumNoteTicks(notes, timeSignature)
export function ticksToDurationString(ticks, timeSignature)
export function getNotesOverflowTicks(notes, timeSignature)
```

**Benefits**:
- Proper handling of all time signatures
- 6/8 correctly gives 3 beats (not 6)
- 2/2 correctly gives 4 beats (not 2)
- Tick-based arithmetic for precise timing

#### 2. Fixed BuildingBlockSequence.getBeatsPerMeasure()

```javascript
// buildingBlock.js lines 809-818

getBeatsPerMeasure() {
    const num = this.timeSignature?.num ?? 4;
    const denom = this.timeSignature?.denom ?? 4;
    return num * (4 / denom);  // Now matches compositionState
}
```

#### 3. Time Signature Change Support

```javascript
// compositionState.js setTimeSignature() - restructured flow

setTimeSignature(num, denom) {
    // 1. FIRST: Sync treble notes using OLD time signature (for correct positions)
    if (hasTrebleNotes) {
        this.syncMeasuresToTrebleBlock();  // Uses old TS from metadata
    }

    // 2. Update metadata time signature
    this.metadata.timeSignature = { num, denom };

    // 3. Update block sequences
    this.bassBlockSequence.setTimeSignature(num, denom);
    this.trebleBlockSequence.setTimeSignature(num, denom);

    // 4. Handle bass notes (working correctly)
    // ...

    // 5. Re-import progression data with new TS
    this.importFromProgressionData(progressionData, { timeSignature: { num, denom } });

    // 6. Re-render treble from block to new measures
    this.renderTrebleBlocksToMeasures();
}
```

#### 4. Multi-Voice Support (Removed Skip Checks)

The multi-voice skip checks were removed from both sync and render functions:

```javascript
// OLD (baseline) - skipped entirely for multi-voice:
if (hasMultipleVoices) {
    console.log(`SKIPPING - multiple voices detected`);
    return;
}

// NEW (current) - removed skip, processes all voices:
// Multi-voice is now supported - the block sequence stores voice attribute for each note
// and the render logic only clears voices present in the block, preserving others.
```

#### 5. Block Sizing Based on Note Content

```javascript
// syncMeasuresToTrebleBlock() - NEW logic

// Calculate required block size based on actual note content
let maxEndUnit = 0;
for (const note of combinedNotes) {
    const endUnit = note.startUnit + note.durationUnits;
    if (endUnit > maxEndUnit) maxEndUnit = endUnit;
}

const requiredUnits = Math.max(maxEndUnit, measureRequiredUnits, 1);
const requiredBeats = Math.ceil(requiredUnits / UNITS_PER_BEAT);
block.setDuration(requiredBeats);  // Now based on notes, not just measure count
```

#### 6. Fixed Block Clearing

```javascript
// OLD - created one giant rest:
for (let i = 0; i < block.units.length; i++) {
    block.units[i].pitches = [];
    block.units[i].parentIndex = i === 0 ? null : 0;  // Wrong!
}

// NEW - fresh independent units:
for (let i = 0; i < block.units.length; i++) {
    block.units[i] = new Unit({ pitches: [] });  // Correct
}
```

#### 7. Fixed Tied Note Rendering

```javascript
// OLD - missing 'tied' property:
const measureNote = {
    isTied: !isFirstPart,  // Only this
    // ...
};

// NEW - both properties:
const measureNote = {
    tied: !isLastPart && !note.isRest,  // First part ties TO next
    isTied: !isFirstPart,                // Continuation tied FROM previous
    // ...
};
```

---

## Part 3: Known Bugs in Current Local Code

### Bug 1: Treble Notes Not Playing Full Duration
- **Symptom**: Half notes in 2/4 don't play for 2 beats
- **Possible cause**: Duration calculation or playback timing issue
- **Status**: Not fixed

### Bug 2: Visual Ties Not Rendering
- **Symptom**: Split notes don't show tie marks
- **Possible cause**: VexFlow tie rendering requires additional configuration
- **Status**: Added `tied` property but may need VexFlow-specific fix

### Bug 3: Note Position Alignment with Bass
- **Symptom**: Second half of split treble note appears offset from bass
- **Possible cause**: May be related to how measures are structured or rendered
- **Status**: Partially addressed by sync timing fix

### Bug 4: Potential Double-Sync Issues
- **Symptom**: Unknown - may cause data corruption
- **Cause**: `initializeTrebleBlockSequence()` calls `syncMeasuresToTrebleBlock()` internally, then code may call sync again
- **Status**: Not addressed

---

## Part 4: Recommended Integration Strategy

### Phase 1: Add TS-Aware Helpers (Low Risk)

Add to baseline without changing existing behavior:

```javascript
// Add to compositionState.js
export function getBeatsPerMeasureFromTimeSignature(timeSignature = { num: 4, denom: 4 }) {
    const num = timeSignature?.num ?? 4;
    const denom = timeSignature?.denom ?? 4;
    return num * (4 / denom);
}

export const TS_PPQ = 480;
export function getTicksPerDenominator(timeSignature) { ... }
export function getMeasureCapacityTicks(timeSignature) { ... }
export function durationStringToTicks(durationStr, timeSignature) { ... }
export function beatsToTicks(beats, timeSignature) { ... }
export function ticksToBeats(ticks) { ... }
export function sumNoteTicks(notes, timeSignature) { ... }
export function ticksToDurationString(ticks, timeSignature) { ... }
export function getNotesOverflowTicks(notes, timeSignature) { ... }
```

### Phase 2: Update Calculations (Medium Risk)

Replace direct numerator usage with helper:

```javascript
// Before (many places):
const beatsPerMeasure = this.metadata.timeSignature?.num || 4;

// After:
const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);
```

Also update `buildingBlock.js`:

```javascript
getBeatsPerMeasure() {
    const num = this.timeSignature?.num ?? 4;
    const denom = this.timeSignature?.denom ?? 4;
    return num * (4 / denom);
}
```

### Phase 3: Add Time Signature Change Support (High Risk)

This is where most bugs occurred. Key lessons learned:

1. **Sync BEFORE updating metadata** - Position calculations need old TS
2. **Block size from note content** - Don't truncate based on measure count
3. **Fresh Unit objects when clearing** - Don't create parent relationships
4. **Both `tied` and `isTied` properties** - For proper tie rendering

### Phase 4: Multi-Voice During TS Changes (Highest Risk)

The multi-voice skip was removed to allow TS changes with Voice 2, but this may have introduced bugs. Consider:

1. Keep the skip for normal operations
2. Only remove it during time signature changes
3. Or implement a proper treble note store (like BassNoteStore)

---

## Part 5: Files Changed Summary

### compositionState.js

| Line Range | Change Type | Description |
|------------|-------------|-------------|
| 19 | Import | Added `Unit` import |
| 222-310 | New | TS-aware helper functions |
| 1591-1602 | Modified | Updated comment about multi-voice |
| 1604-1738 | Modified | Sync function - removed skip, new sizing logic |
| 1794-1812 | Modified | Render function - removed skip, added comment |
| 1886-1895 | Modified | Added `tied` property to split notes |
| 3131-3188 | Modified | setTimeSignature - moved sync before metadata update |

### buildingBlock.js

| Line Range | Change Type | Description |
|------------|-------------|-------------|
| 809-818 | Modified | Fixed getBeatsPerMeasure() formula |

### docs/TIME_SIGNATURE_PROBLEMS.md

Updated with fix status.

### docs/TIME_SIGNATURE_NOTES.md

Documents completed TS work.

---

## Part 6: Code Snippets to Preserve

### Complete getBeatsPerMeasureFromTimeSignature

```javascript
export function getBeatsPerMeasureFromTimeSignature(timeSignature = { num: 4, denom: 4 }) {
    const num = timeSignature?.num ?? 4;
    const denom = timeSignature?.denom ?? 4;
    return num * (4 / denom);
}
```

### Complete Tick-Based Helpers

```javascript
export const TS_PPQ = 480; // ticks per quarter note

export function getTicksPerDenominator(timeSignature = { num: 4, denom: 4 }) {
    const denom = timeSignature?.denom ?? 4;
    return TS_PPQ * (4 / denom);
}

export function getMeasureCapacityTicks(timeSignature = { num: 4, denom: 4 }) {
    const num = timeSignature?.num ?? 4;
    return num * getTicksPerDenominator(timeSignature);
}

export function durationStringToTicks(durationStr, timeSignature = { num: 4, denom: 4 }) {
    if (!durationStr) return getTicksPerDenominator(timeSignature);
    const base = durationStr.replace('.', '');
    const isDotted = durationStr.includes('.');
    let denomValue = 4;
    if (base.endsWith('1n')) denomValue = 1;
    else if (base.endsWith('2n')) denomValue = 2;
    else if (base.endsWith('4n')) denomValue = 4;
    else if (base.endsWith('8n')) denomValue = 8;
    else if (base.endsWith('16n')) denomValue = 16;
    else if (base.endsWith('32n')) denomValue = 32;
    else if (base.endsWith('64n')) denomValue = 64;

    const ticks = TS_PPQ * (4 / denomValue);
    return isDotted ? ticks * 1.5 : ticks;
}

export function beatsToTicks(beats, timeSignature = { num: 4, denom: 4 }) {
    return beats * TS_PPQ;
}

export function ticksToBeats(ticks) {
    return ticks / TS_PPQ;
}

export function sumNoteTicks(notes, timeSignature = { num: 4, denom: 4 }) {
    return notes.reduce((sum, note) => {
        return sum + durationStringToTicks(note.duration, timeSignature);
    }, 0);
}

export function ticksToDurationString(ticks, timeSignature = { num: 4, denom: 4 }) {
    // Find closest standard duration
    const durations = ['1n', '2n.', '2n', '4n.', '4n', '8n.', '8n', '16n.', '16n', '32n'];
    let closest = '4n';
    let closestDiff = Infinity;

    for (const dur of durations) {
        const durTicks = durationStringToTicks(dur, timeSignature);
        const diff = Math.abs(durTicks - ticks);
        if (diff < closestDiff) {
            closestDiff = diff;
            closest = dur;
        }
    }
    return closest;
}

export function getNotesOverflowTicks(notes, timeSignature = { num: 4, denom: 4 }) {
    const totalTicks = sumNoteTicks(notes, timeSignature);
    const capacityTicks = getMeasureCapacityTicks(timeSignature);
    return Math.max(0, totalTicks - capacityTicks);
}
```

### Correct Block Sizing Logic

```javascript
// In syncMeasuresToTrebleBlock()

// Calculate required block size based on actual note content
let maxEndUnit = 0;
for (const note of combinedNotes) {
    const endUnit = note.startUnit + note.durationUnits;
    if (endUnit > maxEndUnit) {
        maxEndUnit = endUnit;
    }
}

// Also ensure block is at least as large as the current measures require
const measureRequiredBeats = this.measures.length * beatsPerMeasure;
const measureRequiredUnits = measureRequiredBeats * UNITS_PER_BEAT;
const requiredUnits = Math.max(maxEndUnit, measureRequiredUnits, 1);
const requiredBeats = Math.ceil(requiredUnits / UNITS_PER_BEAT);

if (block.beats !== requiredBeats) {
    block.setDuration(requiredBeats);
}

// Clear with fresh units (not parent relationships)
for (let i = 0; i < block.units.length; i++) {
    block.units[i] = new Unit({ pitches: [] });
}
```

### Time Signature Change Flow

```javascript
setTimeSignature(num, denom) {
    const oldTimeSignature = this.metadata.timeSignature || { num: 4, denom: 4 };

    // CRITICAL: Sync treble notes BEFORE updating metadata
    // Uses OLD beatsPerMeasure for correct position calculation
    if (hasTrebleNotes) {
        if (this.trebleBlockSequence.blocks.length === 0) {
            this.initializeTrebleBlockSequence();
        }
        this.syncMeasuresToTrebleBlock();
    }

    // NOW update metadata
    this.metadata.timeSignature = { num, denom };

    // Update block sequences
    this.bassBlockSequence.setTimeSignature(num, denom);
    this.trebleBlockSequence.setTimeSignature(num, denom);

    // Re-import and re-render...
}
```

---

## Conclusion

The time signature work represents significant progress toward supporting multiple time signatures. The core helpers (`getBeatsPerMeasureFromTimeSignature`, tick-based functions) are solid and can be integrated with low risk.

The higher-risk changes (multi-voice support during TS changes, sync timing) need more careful testing. Consider implementing a `TrebleNoteStore` similar to `BassNoteStore` for more robust treble note preservation during time signature changes.

When ready to integrate, start with Phase 1 (helpers only), verify everything still works, then proceed incrementally.
