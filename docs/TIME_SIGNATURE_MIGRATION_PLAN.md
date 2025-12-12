# Time Signature Migration Plan

## Purpose

This document provides a comprehensive guide for integrating time signature functionality from the current local codebase into commit `f39e7f6c7f4259d59500feb68aa3a3ae54a2d37e` ("Rhythm Pattern Library Enhancements"). The goal is to preserve valuable time signature work while reverting to a stable baseline.

---

## Background

### Target Baseline: Commit f39e7f6
- **Date**: Dec 10, 2025
- **Status**: Working correctly for 4/4 time signature only
- **Architecture**: Simple `beatsPerMeasure = timeSignature.num` approach
- **Limitation**: Incorrect for compound meters (6/8 gives 6 instead of 3)

### Current Local Code
- **Status**: Extensive time signature work with known bugs
- **Contains**: TS-aware helpers, tick-based calculations, multi-voice support during TS changes
- **Bugs**: Treble notes not playing full duration, visual ties not rendering, position alignment issues

---

## Phase 1: Add TS-Aware Helper Functions (LOW RISK)

### What to Add to `compositionState.js`

Add these helper functions **without changing any existing behavior**:

```javascript
// ============================================================================
// TIME SIGNATURE HELPER FUNCTIONS
// ============================================================================

/**
 * Ticks per quarter note - the fundamental timing resolution
 * 480 is a standard MIDI PPQ value that divides evenly by many common note values
 */
export const TS_PPQ = 480;

/**
 * Calculate the effective beats per measure from a time signature object
 * This correctly handles all time signatures including compound meters
 *
 * @param {Object} timeSignature - { num: number, denom: number }
 * @returns {number} - Effective beats per measure
 *
 * @example
 * getBeatsPerMeasureFromTimeSignature({ num: 4, denom: 4 }) // Returns 4
 * getBeatsPerMeasureFromTimeSignature({ num: 6, denom: 8 }) // Returns 3 (compound)
 * getBeatsPerMeasureFromTimeSignature({ num: 2, denom: 2 }) // Returns 4 (cut time)
 */
export function getBeatsPerMeasureFromTimeSignature(timeSignature = { num: 4, denom: 4 }) {
    const num = timeSignature?.num ?? 4;
    const denom = timeSignature?.denom ?? 4;
    // Formula: multiply by (4/denom) to normalize everything to quarter-note beats
    // 4/4: 4 * (4/4) = 4 beats
    // 6/8: 6 * (4/8) = 3 beats (compound duple)
    // 2/2: 2 * (4/2) = 4 beats (cut time = 4 quarter note beats)
    // 3/4: 3 * (4/4) = 3 beats
    return num * (4 / denom);
}

/**
 * Get ticks per denominator unit for a time signature
 * @param {Object} timeSignature - { num: number, denom: number }
 * @returns {number} - Ticks per denominator note
 */
export function getTicksPerDenominator(timeSignature = { num: 4, denom: 4 }) {
    const denom = timeSignature?.denom ?? 4;
    // A quarter note = TS_PPQ ticks
    // An eighth note = TS_PPQ / 2 ticks
    // A half note = TS_PPQ * 2 ticks
    return TS_PPQ * (4 / denom);
}

/**
 * Calculate total tick capacity for one measure
 * @param {Object} timeSignature - { num: number, denom: number }
 * @returns {number} - Total ticks that fit in one measure
 */
export function getMeasureCapacityTicks(timeSignature = { num: 4, denom: 4 }) {
    const num = timeSignature?.num ?? 4;
    return num * getTicksPerDenominator(timeSignature);
}

/**
 * Convert a duration string (Tone.js format) to ticks
 * @param {string} durationStr - Duration like '4n', '8n.', '2n'
 * @param {Object} timeSignature - Current time signature
 * @returns {number} - Duration in ticks
 */
export function durationStringToTicks(durationStr, timeSignature = { num: 4, denom: 4 }) {
    if (!durationStr) return getTicksPerDenominator(timeSignature);

    const base = durationStr.replace('.', '');
    const isDotted = durationStr.includes('.');

    let denomValue = 4; // Default to quarter note
    if (base.endsWith('1n')) denomValue = 1;
    else if (base.endsWith('2n')) denomValue = 2;
    else if (base.endsWith('4n')) denomValue = 4;
    else if (base.endsWith('8n')) denomValue = 8;
    else if (base.endsWith('16n')) denomValue = 16;
    else if (base.endsWith('32n')) denomValue = 32;
    else if (base.endsWith('64n')) denomValue = 64;

    // Calculate base ticks (relative to quarter note)
    const ticks = TS_PPQ * (4 / denomValue);

    // Dotted notes are 1.5x their base duration
    return isDotted ? ticks * 1.5 : ticks;
}

/**
 * Convert beats to ticks
 * @param {number} beats - Number of beats
 * @param {Object} timeSignature - Current time signature (unused but for API consistency)
 * @returns {number} - Equivalent ticks
 */
export function beatsToTicks(beats, timeSignature = { num: 4, denom: 4 }) {
    return beats * TS_PPQ;
}

/**
 * Convert ticks to beats
 * @param {number} ticks - Number of ticks
 * @returns {number} - Equivalent beats
 */
export function ticksToBeats(ticks) {
    return ticks / TS_PPQ;
}

/**
 * Sum the total ticks for an array of notes
 * @param {Array} notes - Array of note objects with duration property
 * @param {Object} timeSignature - Current time signature
 * @returns {number} - Total ticks
 */
export function sumNoteTicks(notes, timeSignature = { num: 4, denom: 4 }) {
    return notes.reduce((sum, note) => {
        return sum + durationStringToTicks(note.duration, timeSignature);
    }, 0);
}

/**
 * Convert ticks to the closest standard duration string
 * @param {number} ticks - Number of ticks
 * @param {Object} timeSignature - Current time signature
 * @returns {string} - Closest duration string
 */
export function ticksToDurationString(ticks, timeSignature = { num: 4, denom: 4 }) {
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

/**
 * Calculate overflow ticks beyond measure capacity
 * @param {Array} notes - Array of note objects with duration property
 * @param {Object} timeSignature - Current time signature
 * @returns {number} - Overflow ticks (0 if within capacity)
 */
export function getNotesOverflowTicks(notes, timeSignature = { num: 4, denom: 4 }) {
    const totalTicks = sumNoteTicks(notes, timeSignature);
    const capacityTicks = getMeasureCapacityTicks(timeSignature);
    return Math.max(0, totalTicks - capacityTicks);
}
```

### What to Add to `buildingBlock.js`

Update the `getBeatsPerMeasure()` method in `BuildingBlockSequence` class:

```javascript
// BEFORE (baseline f39e7f6):
getBeatsPerMeasure() {
    return this.timeSignature?.num ?? 4;
}

// AFTER (TS-aware):
getBeatsPerMeasure() {
    const num = this.timeSignature?.num ?? 4;
    const denom = this.timeSignature?.denom ?? 4;
    return num * (4 / denom);
}
```

### Integration Instructions for Claude

1. **First**: Checkout commit f39e7f6:
   ```bash
   git checkout f39e7f6c7f4259d59500feb68aa3a3ae54a2d37e
   git checkout -b feature/time-signature-support
   ```

2. **Add helper functions** to `src/modules/state/compositionState.js`:
   - Add the `TS_PPQ` constant near the top of the file
   - Add all helper functions in a clearly commented section
   - Export all new functions

3. **Update `buildingBlock.js`**:
   - Modify `getBeatsPerMeasure()` to use the `num * (4 / denom)` formula

4. **Test**: Verify the app still works identically for 4/4 time before proceeding

---

## Phase 2: Update Calculation Points (MEDIUM RISK)

### Files to Modify

Replace hardcoded `beatsPerMeasure = timeSignature.num` with the helper function:

#### In `compositionState.js`:

Search for all occurrences of:
```javascript
const beatsPerMeasure = this.metadata.timeSignature?.num || 4;
```

Replace with:
```javascript
const beatsPerMeasure = getBeatsPerMeasureFromTimeSignature(this.metadata.timeSignature);
```

#### In `noteEditor.js`:

Update `getRemainingBeats()` and `getCurrentBeat()` to use the helper.

#### In `progressionBuilder.js`:

Ensure new chord duration defaults to full measure capacity.

### Integration Instructions for Claude

1. Use find/replace to locate all `timeSignature?.num || 4` patterns
2. Replace each with `getBeatsPerMeasureFromTimeSignature(timeSignature)`
3. Test thoroughly with 4/4 to ensure no regressions
4. Then test with 3/4 and 6/8

---

## Phase 3: Time Signature UI Control (MEDIUM RISK)

### What to Add

From `notationToolbar.js`, add the time signature dropdown:

```javascript
// Time signature dropdown in toolbar HTML
<select class="time-signature-select">
  <option value="4/4">4/4</option>
  <option value="3/4">3/4</option>
  <option value="2/4">2/4</option>
  <option value="6/8">6/8</option>
  <option value="2/2">2/2</option>
  <option value="9/8">9/8</option>
</select>

// Event handler
this.container.querySelector('.time-signature-select')?.addEventListener('change', (e) => {
  const [num, denom] = e.target.value.split('/').map(Number);
  this.setTimeSignature(num, denom);
});
```

### Integration Instructions for Claude

1. Add time signature select to `notationToolbar.js` render method
2. Add event listener for change events
3. Connect to `compositionState.setTimeSignature(num, denom)`
4. Ensure VexFlow re-renders with correct time signature

---

## Phase 4: Note Preservation During TS Changes (HIGH RISK)

### Critical Lessons Learned

The current local code has bugs in this area. Key insights:

1. **Sync BEFORE metadata update**: Position calculations need the OLD time signature
2. **Block size from note content**: Don't truncate based on measure count
3. **Fresh Unit objects when clearing**: Don't create parent relationships
4. **Both `tied` and `isTied` properties**: For proper tie rendering

### Recommended Approach

**Option A: Simple (lose notes on TS change)**
- Don't implement this phase
- Warn user that changing time signature will clear notes
- User can re-enter notes in new time signature

**Option B: Complex (preserve notes)**
- Requires careful implementation of sync timing
- Use the patterns from current local code but test extensively
- Key code pattern:

```javascript
setTimeSignature(num, denom) {
    // CRITICAL: Sync treble notes BEFORE updating metadata
    const hasTrebleNotes = /* check if treble has notes */;
    if (hasTrebleNotes) {
        this.syncMeasuresToTrebleBlock(); // Uses OLD TS
    }

    // NOW update metadata
    this.metadata.timeSignature = { num, denom };

    // Update block sequences
    this.bassBlockSequence.setTimeSignature(num, denom);
    this.trebleBlockSequence.setTimeSignature(num, denom);

    // Re-render notes to new measure structure
    this.renderTrebleBlocksToMeasures();
}
```

### Integration Instructions for Claude

1. For Option A: Simply clear notes and warn user
2. For Option B: Implement sync-before-update pattern with extensive testing
3. Test with various note combinations crossing measure boundaries

---

## Phase 5: Multi-Voice During TS Changes (HIGHEST RISK)

### Current Status

The baseline code (f39e7f6) skips sync/render operations if multi-voice is detected. The local code removed these skips, causing bugs.

### Recommendation

Keep the multi-voice skip checks for normal operations. Only attempt multi-voice TS changes after all other phases are stable.

---

## Testing Checklist

### Phase 1 Tests
- [ ] 4/4 time works identically to before
- [ ] No console errors
- [ ] Helper functions return correct values

### Phase 2 Tests
- [ ] 4/4 still works
- [ ] 3/4 measures have 3 beats
- [ ] 6/8 measures have 3 beats (compound)
- [ ] Note insertion respects capacity

### Phase 3 Tests
- [ ] Time signature dropdown appears
- [ ] Selecting different TS re-renders notation
- [ ] VexFlow shows correct time signature

### Phase 4 Tests
- [ ] Notes preserved when changing 4/4 to 2/4
- [ ] Tied notes split correctly at new measure boundaries
- [ ] Audio playback duration is correct

### Phase 5 Tests
- [ ] Multi-voice compositions handle TS changes
- [ ] Voice 2 notes not corrupted

---

## Files Changed in Local Code (Reference)

| File | Lines | Changes |
|------|-------|---------|
| `compositionState.js` | 222-310 | New TS helper functions |
| `compositionState.js` | 3131-3188 | setTimeSignature flow |
| `buildingBlock.js` | 809-818 | getBeatsPerMeasure formula |
| `noteEditor.js` | various | Capacity validation |
| `notationToolbar.js` | various | UI dropdown |
| `composerIntegration.js` | various | Event coordination |

---

## Summary

1. **Phase 1** (helpers) is safe and provides foundation
2. **Phase 2** (calculation updates) is medium risk but straightforward
3. **Phase 3** (UI) is medium risk, adds user-facing feature
4. **Phase 4** (note preservation) is high risk, consider Option A (simple) first
5. **Phase 5** (multi-voice) is highest risk, defer until everything else is stable

Start with Phase 1, verify stability, then proceed incrementally.
