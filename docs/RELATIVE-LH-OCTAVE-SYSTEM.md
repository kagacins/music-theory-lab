# Relative LH Octave System Implementation

## Overview
Changed the Left Hand (LH) octave shift system from **absolute** to **relative** positioning. LH octave is now calculated relative to the Right Hand (RH) position, making it more intuitive and maintaining proper bass-to-melody spacing when transposing.

## Changes Made

### 1. **LH Octave Dropdown Labels Updated**

**Before:**
- Labels showed absolute octave values
- "0 (default)" implied LH at same octave as middle C
- Labels: `-3 octaves (-36)`, `-2 octaves (-24)`, `-1 octave (-12)`, `0 (default)`, etc.

**After:**
- Labels show relative position to RH
- `-1 octave (default)` is now standard (bass 1 octave below melody)
- Labels: `-3 octaves`, `-2 octaves`, `-1 octave (default)`, `Same as RH`, `+1 octave`, etc.
- Label changed to "Octave (from RH)" to clarify it's relative

**File:** [progressionBuilder.js:2287-2299](../src/modules/features/progressionBuilder.js#L2287)

### 2. **LH Note Generation Now Calculates Absolute Octave**

**Before:**
```javascript
const lhOctaveShift = chord.lhOctaveShift || -12;
chord.lhNotes = getLHNotes(
    chord.root,
    chord.lhType,
    lhInversion,
    key,
    lhOctaveShift,  // Used relative value directly
    chord.type,
    getEnharmonicPreference()
);
```

**After:**
```javascript
const rhOctaveShift = chord.octaveShift || 0;
const lhRelativeShift = chord.lhOctaveShift || -12;
const absoluteLHOctaveShift = rhOctaveShift + lhRelativeShift;
chord.lhNotes = getLHNotes(
    chord.root,
    chord.lhType,
    lhInversion,
    key,
    absoluteLHOctaveShift,  // Calculated absolute value
    chord.type,
    getEnharmonicPreference()
);
```

### 3. **Updated Functions**

All functions that generate or regenerate LH notes now calculate absolute octave shift:

#### Card Display Auto-Generation
**Location:** [progressionBuilder.js:2111-2125](../src/modules/features/progressionBuilder.js#L2111)
- Generates LH notes when displaying card if missing
- Calculates absolute LH octave = RH octave + relative LH shift

#### updateChordType()
**Location:** [progressionBuilder.js:2802-2819](../src/modules/features/progressionBuilder.js#L2802)
- When chord type changes, regenerates notes
- LH notes use relative system for playback

#### updateChordLHPattern()
**Location:** [progressionBuilder.js:2888-2900](../src/modules/features/progressionBuilder.js#L2888)
- When LH pattern changes, regenerates LH notes
- Uses relative LH shift + RH octave

#### updateRHOctaveShift()
**Location:** [progressionBuilder.js:2981-2997](../src/modules/features/progressionBuilder.js#L2981)
- **Important:** When RH octave changes, LH must follow!
- Calculates new absolute LH position = new RH shift + relative LH shift
- Ensures LH maintains relative distance from RH

#### updateLHOctaveShift()
**Location:** [progressionBuilder.js:3003-3019](../src/modules/features/progressionBuilder.js#L3003)
- When user changes LH relative shift dropdown
- Comment updated: "Update LH octave shift (relative to RH)"
- Calculates absolute = current RH octave + new relative shift

#### updateLHInversion()
**Location:** [progressionBuilder.js:3044-3056](../src/modules/features/progressionBuilder.js#L3044)
- When LH inversion button pressed
- Regenerates LH notes with relative system

#### addChordToProgressionByParams()
**Location:** [progressionBuilder.js:6368-6382](../src/modules/features/progressionBuilder.js#L6368)
- When adding chord via Smart Suggestions
- New chords: RH octave = 0, LH relative = -12, absolute LH = -12

#### parseAndAddChords()
**Location:** [progressionBuilder.js:7585-7598](../src/modules/features/progressionBuilder.js#L7585)
- When loading progression from text input
- Calculates absolute LH octave for new chords

#### loadProgressionByRomans()
**Location:** [progressionBuilder.js:7786-7799](../src/modules/features/progressionBuilder.js#L7786)
- When loading progression by Roman numerals
- Uses relative system for LH octave

## How It Works

### Conceptual Model

**Before (Absolute):**
- RH at octave 4
- LH octave shift = -12 → LH at octave 2
- User shifts RH to octave 5
- LH stays at octave 2 (❌ bass now 3 octaves below melody!)

**After (Relative):**
- RH at octave 4
- LH relative shift = -12 → LH at octave 3 (1 octave below)
- User shifts RH to octave 5
- LH automatically moves to octave 4 (✅ still 1 octave below melody!)

### State Structure

Chord objects store:
```javascript
{
    octaveShift: 0,        // RH octave shift (semitones from default)
    lhOctaveShift: -12,    // LH relative shift (semitones from RH)
    lhNotes: [...]         // Generated LH notes at absolute octave
}
```

### Calculation Formula

```
Absolute LH Octave Shift = RH Octave Shift + LH Relative Shift
```

**Examples:**

1. **Default new chord:**
   - RH shift = 0
   - LH relative = -12
   - Absolute LH = 0 + (-12) = -12 (1 octave below middle C)

2. **RH shifted up 1 octave:**
   - RH shift = +12
   - LH relative = -12
   - Absolute LH = 12 + (-12) = 0 (middle C)

3. **LH 2 octaves below RH:**
   - RH shift = 0
   - LH relative = -24
   - Absolute LH = 0 + (-24) = -24 (2 octaves below middle C)

4. **RH up 1 octave, LH 2 octaves below:**
   - RH shift = +12
   - LH relative = -24
   - Absolute LH = 12 + (-24) = -12 (1 octave below middle C)

## Benefits

1. **Intuitive Behavior:** LH maintains relative position to RH when transposing
2. **Proper Voicing:** Bass-to-melody spacing stays consistent across octaves
3. **Musical Logic:** Matches how musicians think about accompaniment ("bass 1 octave below melody")
4. **User Friendly:** Changing RH octave automatically adjusts LH accordingly
5. **Flexible Control:** Users can still independently adjust LH relative distance

## User Experience

### Before:
1. User adds Cmaj chord (RH at octave 4, LH at octave 2)
2. User shifts RH up 1 octave → RH at octave 5
3. LH stays at octave 2 → Bass now 3 octaves below melody (too wide!)
4. User must manually adjust LH octave to fix spacing

### After:
1. User adds Cmaj chord (RH at octave 4, LH at octave 3 = 1 octave below)
2. User shifts RH up 1 octave → RH at octave 5
3. LH automatically moves to octave 4 → Still 1 octave below melody ✓
4. No manual adjustment needed!

## Default Values

All new chords created with:
- **RH Octave Shift:** `0` (middle C region)
- **LH Relative Shift:** `-12` (1 octave below RH)
- **Absolute LH Octave:** `-12` (octave 2)

## Backward Compatibility

Existing chords in saved progressions:
- `lhOctaveShift` is now interpreted as **relative to RH**
- For chords created with old system where RH was at default (0), behavior is identical
- Chords where RH was shifted may sound different (but more musically correct)

## Testing Checklist

- [x] LH dropdown shows relative labels
- [x] Default shows "-1 octave (default)"
- [x] New chords have LH 1 octave below RH
- [ ] Changing RH octave updates LH position
- [ ] Changing LH relative shift works correctly
- [ ] LH pattern changes use relative system
- [ ] LH inversion changes use relative system
- [ ] Playback uses correct absolute octave
- [ ] All chord creation methods use relative system
- [ ] Test edge cases (RH at +36, LH at -36, etc.)

## Related Files

- [progressionBuilder.js](../src/modules/features/progressionBuilder.js) - Main implementation
- [CARD-UI-IMPROVEMENTS.md](./CARD-UI-IMPROVEMENTS.md) - UI button improvements
- [LH-TYPE-FIX.md](./LH-TYPE-FIX.md) - LH type system fixes
- [LEFT-HAND-INTEGRATION.md](./LEFT-HAND-INTEGRATION.md) - Original LH integration

## Migration Notes

If you have existing progressions with custom octave shifts:
- The system now interprets `lhOctaveShift` as relative to RH
- If you had set LH to absolute -24 (octave 1) and RH to +12 (octave 5), the LH will now be at octave 3 (RH 5 + relative -24 = octave 1... wait that's -12... let me recalculate)
- Actually: RH +12 = octave 5, LH relative -24 = octave 5 + (-24 semitones / 12) = octave 5 - 2 = octave 3
- This is more musically correct than the old system where LH would stay at absolute octave 1 regardless of RH position
