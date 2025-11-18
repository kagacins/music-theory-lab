# Chord Mapping Fixes

## Issues Fixed

### 1. **Critical Bug: parseChordSymbol Function Order**
**Location:** [src/modules/features/progressionBuilder.js:6612-6658](src/modules/features/progressionBuilder.js#L6612-L6658)

**Problem:**
The original code checked for generic patterns before specific patterns, causing incorrect chord type detection:
- "m7" (Minor 7th) was incorrectly parsed as "Minor" because it matched `startsWith('m')` first
- The function never reached the 7th chord checks for minor 7th chords
- This could explain why Cmaj7 and C7 showed identical notes - if the parsing logic failed, it might default to a single chord type

**Fix:**
Reordered the checks to examine more specific patterns first:
1. Check for 9th chords first (add9, maj9, m9, 6/9, 9)
2. Then check for 7th chords (maj7, m7, dim7, m7b5, 7)
3. Then check for 6th chords (m6, 6)
4. Then check for triads (dim, aug, sus)
5. Finally check for plain minor (only after ruling out all extensions)

**Additional improvements:**
- Added case-insensitive matching for "maj7" (now accepts maj7, Maj7, MAJ7)
- Added support for alternative notations (M7, Δ7, -7, ø7, ø)
- Added support for 6th chords (6, m6, 6/9)
- Added support for Add9 chords

### 2. **Chord Type Name Mismatch**
**Location:** [src/modules/features/progressionBuilder-simplified-refactor.js:283-292](src/modules/features/progressionBuilder-simplified-refactor.js#L283-L292)

**Problem:**
The dropdown options used 'Suspended 4th' and 'Suspended 2nd', but CHORD_DEFINITIONS uses 'Sus4' and 'Sus2'. This mismatch caused:
- Dropdown selections not matching stored chord types
- Wrong chord intervals being looked up
- Potential for chords to use incorrect note mappings

**Fix:**
- Updated `getChordTypeOptions()` to use the exact same names as CHORD_DEFINITIONS
- Changed from 'Suspended 4th'/'Suspended 2nd' to 'Sus4'/'Sus2'
- Added more commonly used chord types to the dropdown:
  - Diminished 7th
  - Half-Diminished 7th
  - Add9

## Expected Behavior After Fixes

### Test Case 1: Cmaj7 vs C7
- **Input:** "Cmaj7, C7"
- **Expected Results:**
  - **Cmaj7:** Should show C, E, G, B (intervals [0, 4, 7, 11])
  - **C7:** Should show C, E, G, Bb (intervals [0, 4, 7, 10])
  - **Dropdown:** Should correctly show "Major 7th" for Cmaj7 and "Dominant 7th" for C7
  - **Description:** Should show "C Major 7th (Root)" and "C Dominant 7th (Root)" respectively

### Test Case 2: Minor 7th Chords
- **Input:** "Dm7, Am7"
- **Expected Results:**
  - **Dm7:** Should show D, F, A, C (intervals [0, 3, 7, 10])
  - **Dropdown:** Should show "Minor 7th"
  - **Description:** Should show "D Minor 7th (Root)"

### Test Case 3: Suspended Chords
- **Input:** "Csus4, Dsus2"
- **Expected Results:**
  - **Csus4:** Should show C, F, G (intervals [0, 5, 7])
  - **Dsus2:** Should show D, E, A (intervals [0, 2, 7])
  - **Dropdown:** Should correctly show "Sus4" and "Sus2"

### Test Case 4: Extended Chords
- **Input:** "Cmaj9, Dm9, G9"
- **Expected Results:**
  - **Cmaj9:** Major 9th with correct intervals [0, 4, 7, 11, 14]
  - **Dm9:** Minor 9th with correct intervals [0, 3, 7, 10, 14]
  - **G9:** Dominant 9th with correct intervals [0, 4, 7, 10, 14]

## Files Modified

1. **src/modules/features/progressionBuilder.js**
   - Fixed `parseChordSymbol()` function (lines 6612-6658)
   - Reordered chord type detection logic
   - Added support for more chord notation variants

2. **src/modules/features/progressionBuilder-simplified-refactor.js**
   - Fixed `getChordTypeOptions()` function (lines 283-292)
   - Updated dropdown values to match CHORD_DEFINITIONS
   - Added Diminished 7th, Half-Diminished 7th, and Add9 options

## Testing Instructions

1. **Open the Music Theory Lab application**
2. **Navigate to the Progression Builder**
3. **Use the Manual Chord Entry Modal to import:** `Cmaj7, C7`
4. **Verify the Simplified Chord Cards:**
   - One should display "Cmaj7" symbol
   - One should display "C7" symbol
5. **Click to expand each card to detailed view**
6. **Verify the notes and description:**
   - Cmaj7 should show: C4, E4, G4, B4 (NOT A#4/Bb4)
   - C7 should show: C4, E4, G4, Bb4
7. **Verify the dropdown:**
   - Cmaj7 should have "Major 7th" selected
   - C7 should have "Dominant 7th" selected
8. **Test playback:** Both chords should sound different
9. **Test other chord types:** Try Dm7, Fsus4, Cadd9, Bm7b5

## Technical Details

### Chord Type Mapping
All chord types now correctly map to their definitions in `src/data/music-data.js`:

| Symbol | Chord Type | Intervals | Notes (C root) |
|--------|-----------|-----------|----------------|
| C | Major | [0, 4, 7] | C, E, G |
| Cm | Minor | [0, 3, 7] | C, Eb, G |
| C7 | Dominant 7th | [0, 4, 7, 10] | C, E, G, Bb |
| Cmaj7 | Major 7th | [0, 4, 7, 11] | C, E, G, B |
| Cm7 | Minor 7th | [0, 3, 7, 10] | C, Eb, G, Bb |
| Cdim7 | Diminished 7th | [0, 3, 6, 9] | C, Eb, Gb, Bbb |
| Cm7b5 | Half-Diminished 7th | [0, 3, 6, 10] | C, Eb, Gb, Bb |
| Csus4 | Sus4 | [0, 5, 7] | C, F, G |
| Csus2 | Sus2 | [0, 2, 7] | C, D, G |
| Cadd9 | Add9 | [0, 4, 7, 14] | C, E, G, D(+1 oct) |

### Root Cause Analysis

The original bug was caused by two separate issues:

1. **Parsing Logic Order:** The parseChordSymbol function checked generic patterns (like "m" for minor) before specific patterns (like "m7" for minor 7th), causing extended chords to be misidentified as their simpler counterparts.

2. **Name Mismatch:** The dropdown used "Suspended 4th" while CHORD_DEFINITIONS expected "Sus4", causing a lookup failure that could result in undefined behavior or fallback to incorrect chord types.

When combined, these issues could cause:
- A chord symbol like "Cmaj7" to be parsed correctly initially
- But then when the chord type was changed via the dropdown or updated internally, the name mismatch would cause it to use the wrong intervals
- Both Cmaj7 and C7 ending up with the same (incorrect) intervals

The fixes ensure:
- Correct parsing of all chord symbols on import
- Consistent naming between all parts of the system
- Proper lookup of chord intervals from CHORD_DEFINITIONS
- Accurate display of chord names, notes, and types
