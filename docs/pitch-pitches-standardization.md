# Note Pitch/Pitches Standardization Guide

## Problem Statement

Throughout the codebase, notes can be represented in two ways:
1. **Single notes**: `note.pitch` (string) - e.g., `"C4"`
2. **Chords/Polyphony**: `note.pitches` (array) - e.g., `["C4", "E4", "G4"]`

This dual representation has caused multiple bugs where code only checks `note.pitch` and fails to handle polyphonic notes with `note.pitches`.

---

## ⚠️ **IMPORTANT: Use `note.pitches` Going Forward**

**New Standard**: All new code should:
1. **Store notes using `note.pitches` (array)** - even for single notes
2. **Use the helper function `getNotePitches(note)`** to safely read note pitches
3. **Never directly access `note.pitch`** without also checking `note.pitches`

---

## Helper Function

Add this utility function to a shared module (e.g., `src/modules/utils/noteUtils.js`):

```javascript
/**
 * Safely get all pitches from a note object
 * Handles both legacy single-note format (note.pitch) and polyphonic format (note.pitches)
 * @param {Object} note - Note object
 * @returns {Array<string>} Array of pitch strings (e.g., ["C4", "E4", "G4"])
 */
export function getNotePitches(note) {
  if (!note) return [];

  // Prefer note.pitches (polyphonic format)
  if (note.pitches && Array.isArray(note.pitches)) {
    return note.pitches;
  }

  // Fallback to note.pitch (legacy single-note format)
  if (note.pitch && typeof note.pitch === 'string') {
    return [note.pitch];
  }

  // No valid pitch data
  return [];
}

/**
 * Check if a note has any pitch data (single or polyphonic)
 * @param {Object} note - Note object
 * @returns {boolean} True if note has pitch or pitches
 */
export function hasPitch(note) {
  return getNotePitches(note).length > 0;
}

/**
 * Get the primary (first/lowest) pitch from a note
 * Useful for situations that need a single representative pitch
 * @param {Object} note - Note object
 * @returns {string|null} Pitch string or null if no pitches
 */
export function getPrimaryPitch(note) {
  const pitches = getNotePitches(note);
  return pitches.length > 0 ? pitches[0] : null;
}
```

---

## Usage Examples

### ✅ CORRECT - Using Helper Function

```javascript
import { getNotePitches, hasPitch, getPrimaryPitch } from './utils/noteUtils.js';

// Play all pitches in a note (works for both single notes and chords)
const pitches = getNotePitches(note);
pitches.forEach(pitch => {
  synth.triggerAttackRelease(pitch, duration, time);
});

// Check if note has pitch data
if (hasPitch(note)) {
  // Process note
}

// Get a single representative pitch (for UI display, etc.)
const displayPitch = getPrimaryPitch(note);
console.log(`Primary pitch: ${displayPitch}`);
```

### ❌ INCORRECT - Direct Access

```javascript
// BAD: Only handles single notes, breaks for chords
if (note.pitch) {
  synth.triggerAttackRelease(note.pitch, duration, time);
}

// BAD: Inconsistent logic
const notePitch = note.pitch || note.pitches[0];
```

---

## Audit of Current Codebase

### Files with `note.pitch` Usage

#### 🔴 **HIGH PRIORITY** - Audio Playback (breaks functionality)

**`src/modules/audio/melodyGenerator.js`**

| Line | Code | Issue | Fix Needed |
|------|------|-------|------------|
| 2038 | `.map(note => note.pitch)` | Only gets single pitch | Use `getNotePitches(note)` and flatten |
| 2073 | `note.pitch` | Won't play chords | Use `getNotePitches(note).forEach(...)` |
| 2085 | `note.pitch` | Won't play chords | Use `getNotePitches(note).forEach(...)` |
| 2114 | `.map(note => note.pitch)` | Only gets single pitch | Use `getNotePitches(note)` and flatten |
| 2345 | `note.pitch` | Won't track chord notes | Use `getNotePitches(note)` |
| 2403 | `note.pitch` | Won't play chords | Use `getNotePitches(note).forEach(...)` |
| 2407 | `note.pitch` | Won't create IDs for all chord notes | Loop through `getNotePitches(note)` |
| 2440 | `note.pitch` | Won't highlight chord notes on keyboard | Loop through `getNotePitches(note)` |
| 2445 | `note.pitch` | Won't track chord notes | Use `getNotePitches(note)` |
| 2502 | `note.pitch` | Won't create IDs for all chord notes | Loop through `getNotePitches(note)` |
| 2863 | `note.pitch` | Won't play chords | Use `getNotePitches(note).forEach(...)` |
| 2867 | `note.pitch` | Won't highlight chord notes | Loop through `getNotePitches(note)` |
| 2877 | `pitch: note.pitch` | Won't schedule chord notes | Use `pitches: getNotePitches(note)` |
| 3389 | `.filter(note.pitch)` | Filters out chords! | Use `hasPitch(note)` |
| 3392 | `pitch: note.pitch` | Won't schedule chord notes | Use `pitches: getNotePitches(note)` |
| 3400 | `note.pitch` | Won't play chords | Use `getNotePitches(note).forEach(...)` |
| 3404 | `note.pitch` | Won't highlight chord notes | Loop through `getNotePitches(note)` |
| 4452 | `note.pitch` | Won't convert all chord pitches | Loop through `getNotePitches(note)` |
| 4467 | `note.pitch` | Won't check accidentals on all chord pitches | Loop through `getNotePitches(note)` |
| 4475 | `note.pitch` | Won't create IDs for all chord notes | Loop through `getNotePitches(note)` |

**Lines 3211 and 3721**: Already fixed! ✅ (Uses `note.pitches || (note.pitch ? [note.pitch] : [])`)

#### 🟡 **MEDIUM PRIORITY** - Note Creation/Editing (affects user input)

**`src/modules/notation/noteEditor.js`**

| Line | Code | Issue | Status |
|------|------|-------|--------|
| 220 | `this.hoveredPosition.pitch` | Single pitch for hover | ✅ OK - hover position is always single |
| 262 | `staffPosition.pitch` | Adding single note | ✅ OK - adding creates single note |
| 274 | `pitch: staffPosition.pitch` | Adding single note | ✅ OK - new notes are single |
| 362 | `pitch: staffPosition.pitch` | Adding to polyphony | ✅ OK - adds one pitch at a time |
| 572 | `pitch: region.pitch` | Display pitch | Should use `getPrimaryPitch(region)` |
| 588 | `staffPosition.pitch` | Getting pitch for color | ✅ OK - staff position is single |
| 791 | `region.pitches \|\| (region.pitch ? [region.pitch] : [])` | ✅ GOOD PATTERN | Already handles both! |
| 1139 | `staffPosition.pitch` | Checking staff position | ✅ OK - staff position is single |
| 1146 | `pitch: staffPosition.pitch` | Ghost note | ✅ OK - ghost is single note |

**`src/modules/notation/notationInit.js`**

| Line | Code | Issue | Status |
|------|------|-------|--------|
| 256 | `note.pitch \|\| 'B4'` | Default pitch | ✅ OK - has fallback |
| 280-281 | Creates both `pitch` and `pitches` | Good! | ✅ Ensures both exist |
| 320 | `note.pitch \|\| note.pitches?.[0]` | ✅ GOOD PATTERN | Already handles both! |
| 329, 349 | `note.pitch = newPitch` | Should also update `note.pitches[0]` | ⚠️ Potential desync |
| 431-437 | Converts `note.pitch` → `note.pitches` | ✅ GOOD | Migration logic |
| 863 | `note.pitch` for analysis | Should use `getPrimaryPitch(note)` | Minor issue |

**`src/modules/notation/measureEditor.js`**

| Line | Code | Issue | Status |
|------|------|-------|--------|
| 370-373 | Converts `note.pitch` → `note.pitches` | ✅ GOOD | Migration logic |
| 406 | `note.pitch = note.pitches[0]` | Backward compatibility | ⚠️ Keeps both in sync |

**`src/modules/notation/grandStaff.js`**

| Line | Code | Issue | Status |
|------|------|-------|--------|
| 105 | `note.pitches \|\| (note.pitch ? [note.pitch] : [])` | ✅ GOOD PATTERN | Already handles both! |
| 464 | `pitch: noteData.pitch \|\| noteData.pitches[0]` | ✅ GOOD | Has fallback |

#### 🟢 **LOW PRIORITY** - Data Sync/Migration (existing patterns work)

**`src/modules/notation/composerIntegration.js`**

Most instances are for validation or migration - already have proper fallbacks.

---

## Migration Strategy

### Phase 1: Add Helper Functions ✅
Create `src/modules/utils/noteUtils.js` with the three helper functions.

### Phase 2: Fix Critical Audio Bugs 🔴
Update `melodyGenerator.js` to use helpers in all playback functions:
- `playAllMeasures()` (lines ~2000-2200)
- `playMeasureNotes()` (lines ~2300-2500)
- `playAllMelody()` (lines ~3600-3900)
- Bass note playback (lines ~4400-4500)

### Phase 3: Update Note Editor 🟡
- Line 572: Use `getPrimaryPitch()` for display
- Lines 329, 349 in notationInit.js: Update both `pitch` and `pitches[0]` when transposing

### Phase 4: Enforce in New Code 📝
- Add ESLint rule to warn on direct `note.pitch` access
- Update documentation
- Add comments to existing code

---

## Data Format Standardization

### Current State (Mixed)
```javascript
// Single note - OLD FORMAT
{
  type: 'note',
  pitch: 'C4',
  duration: '4n',
  beat: 0
}

// Chord - NEW FORMAT
{
  type: 'note',
  pitches: ['C4', 'E4', 'G4'],
  duration: '4n',
  beat: 0
}
```

### Future State (Standardized)
```javascript
// Single note - ALWAYS use array
{
  type: 'note',
  pitches: ['C4'],  // Array with one element
  duration: '4n',
  beat: 0
}

// Chord - Same format
{
  type: 'note',
  pitches: ['C4', 'E4', 'G4'],
  duration: '4n',
  beat: 0
}
```

### Backward Compatibility
```javascript
// When creating notes, set BOTH for compatibility
{
  type: 'note',
  pitch: 'C4',        // For old code
  pitches: ['C4'],    // For new code (primary)
  duration: '4n',
  beat: 0
}

// When reading notes, ALWAYS use helper
const pitches = getNotePitches(note); // Works with both formats
```

---

## Testing Checklist

After implementing changes, test:

- [ ] Play single melody note with hold-to-play ✅ (works)
- [ ] Play chord (polyphonic) note with hold-to-play ✅ (works)
- [ ] Play single melody note with "Play All"
- [ ] Play chord (polyphonic) note with "Play All"
- [ ] Play single melody note with "Auto Play"
- [ ] Play chord (polyphonic) note with "Auto Play"
- [ ] Transpose single note with arrow keys ✅ (works)
- [ ] Transpose chord with arrow keys
- [ ] Piano keyboard highlights all chord notes
- [ ] Red note highlighting shows all chord notes during playback
- [ ] Bass notes with chords play correctly

---

## Code Review Guidelines

### When reviewing new code, check:

1. ✅ **Uses `getNotePitches(note)`** instead of `note.pitch` or `note.pitches`
2. ✅ **Uses `hasPitch(note)`** instead of `if (note.pitch)` or `if (note.pitches)`
3. ✅ **Uses `getPrimaryPitch(note)`** when only one pitch is needed (UI display, etc.)
4. ✅ **Loops through all pitches** when performing operations (play, highlight, transpose)
5. ✅ **Stores notes as arrays** (`pitches: ['C4']`) not strings (`pitch: 'C4'`)

### Example Code Review

#### ❌ Before
```javascript
// Playing notes
if (note.pitch) {
  synth.triggerAttackRelease(note.pitch, duration);
}

// Filtering notes
const validNotes = notes.filter(n => n.pitch && n.type === 'note');
```

#### ✅ After
```javascript
// Playing notes
const pitches = getNotePitches(note);
pitches.forEach(pitch => {
  synth.triggerAttackRelease(pitch, duration);
});

// Filtering notes
const validNotes = notes.filter(n => hasPitch(n) && n.type === 'note');
```

---

## Summary

**The Problem**: Inconsistent use of `note.pitch` vs `note.pitches` causes bugs where polyphonic notes are skipped.

**The Solution**:
1. Use helper functions (`getNotePitches`, `hasPitch`, `getPrimaryPitch`) everywhere
2. Store all notes with `pitches` array (even single notes)
3. Maintain backward compatibility by setting both `pitch` and `pitches` when creating notes

**Priority**: Fix audio playback bugs first (HIGH), then note editing (MEDIUM), then enforce in new code (ONGOING).
