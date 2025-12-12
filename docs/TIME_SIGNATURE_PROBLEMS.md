# Time Signature Problems - Current Issues and Blockers

## Overview

This document catalogs all known issues and problems with the time signature change functionality in the Music Theory Lab application. Despite significant implementation work, several critical issues remain unresolved.

## Critical Issues

### 1. Treble Note Positioning Corruption

#### Problem Description
When treble notes are preserved during time signature changes, subsequent note additions are positioned incorrectly, often appearing in measure 3 instead of measure 1.

#### Root Cause
The `BuildingBlockSequence` used for treble notes maintains absolute time unit positioning, but when the block is preserved during time signature changes, the internal positioning becomes misaligned with the new measure structure.

#### Impact
- Users cannot reliably add treble notes after time signature changes
- Note positioning appears random or wrong
- Beat constraints become unenforceable

#### Current Workaround
Treble notes are **completely cleared** during time signature changes, providing a "fresh start" but losing all existing treble content.

#### Reproduction Steps
1. Add treble notes to a composition
2. Change time signature (e.g., 4/4 → 2/4)
3. Try to add new treble notes
4. Notes appear in wrong measures with no beat constraints

#### Code Location
- `compositionState.js:3187` - Treble preservation logic (currently disabled)
- `renderTrebleBlocksToMeasures()` - Rendering function with positioning issues

---

### 2. Whole Note Duration Calculation Error

#### Problem Description
Whole notes (`1n`) are calculated as 768 units (16 beats) instead of 192 units (4 beats), causing them to span entire compositions and split into excessive parts during time signature changes.

#### Root Cause
The `durationToUnits('1n')` function returns incorrect values. Despite `DURATION_UNITS['1n'] = 192`, the actual calculation produces 768 units.

#### Impact
- Whole notes behave like 16-beat monstrosities
- Time signature changes split single whole notes into 8+ parts
- Musical timing completely broken

#### Current Fix Attempt
Forced `durationToUnits('1n')` to always return 192, but the issue persists, suggesting deeper problems with the duration system or caching.

#### Reproduction Steps
1. Add a whole note to treble clef
2. Check console logs - shows `durationUnits=768`
3. Change time signature - note splits into 8 parts instead of 2

#### Code Location
- `buildingBlock.js:102` - `durationToUnits()` function
- `compositionState.js:2229` - Duration calculation in `addTrebleNote`

---

### 3. Note Splitting Logic Flaws

#### Problem Description
When notes span measure boundaries during time signature changes, the splitting logic creates too many parts or incorrect tie relationships.

#### Root Cause
The `renderTrebleBlocksToMeasures()` function splits notes based on `unitsPerMeasure`, but when the note duration is wrong (768 instead of 192), it creates 8 splits instead of 2.

#### Impact
- Visual ties become a mess
- Musical content appears fragmented
- Performance issues with excessive note parts

#### Current Status
Bass note splitting works correctly because the BassNoteStore preserves notes properly. Treble note splitting fails due to the duration calculation issues.

#### Code Location
- `compositionState.js:1850-1900` - Note splitting logic in `renderTrebleBlocksToMeasures`

---

### 4. Measure Index Positioning Errors

#### Problem Description
After time signature changes, new note additions use incorrect measure indices, causing notes to appear in measure 3 instead of measure 1.

#### Root Cause
The treble block sequence becomes misaligned after time signature changes, causing the unit-to-measure conversion to be wrong.

#### Impact
- User interface becomes unusable
- Notes appear in random locations
- No predictable note placement

#### Reproduction Steps
1. Change time signature
2. Try to add notes to measure 0
3. Notes appear in measure 3 or other wrong locations
4. Beat constraints ignored

#### Code Location
- `compositionState.js:2226` - Unit position calculation
- `renderTrebleBlocksToMeasures()` - Measure boundary calculations

---

### 5. Block Sequence State Corruption

#### Problem Description
The `BuildingBlockSequence` for treble notes becomes corrupted during time signature changes, causing all subsequent operations to fail.

#### Root Cause
Preserving the block sequence during time signature changes interferes with the internal state, causing positioning calculations to become invalid.

#### Impact
- Complete loss of treble note functionality
- Requires full page refresh to recover
- No way to edit treble after time signature changes

#### Current Workaround
Clear the treble block sequence entirely, losing all treble content.

#### Code Location
- `compositionState.js:3170-3197` - Treble preservation logic (disabled)

---

### 6. Duration System Inconsistencies

#### Problem Description
The duration calculation system has multiple inconsistencies and edge cases that cause incorrect note lengths.

#### Specific Issues
- `DURATION_UNITS` mapping may be unreliable
- `durationToUnits()` function returns wrong values
- Hardcoded fixes don't work, suggesting deeper issues
- Caching or state persistence problems

#### Impact
- All note durations potentially wrong
- Time signature changes amplify the errors
- Musical timing completely unreliable

#### Code Location
- `buildingBlock.js:26-49` - `DURATION_UNITS` definition
- `buildingBlock.js:102-105` - `durationToUnits()` function

---

### 7. UI State Synchronization Issues

#### Problem Description
The UI components (toolbar, notation display, note editor) become desynchronized after time signature changes.

#### Root Cause
Multiple state updates happening asynchronously without proper coordination.

#### Impact
- Toolbar shows wrong time signature
- Note editor uses wrong measure boundaries
- Visual display doesn't match internal state

#### Code Location
- `composerIntegration.js:275-283` - Event handling for time signature changes
- `notationToolbar.js:1193-1198` - UI updates

---

### 8. Rendering Performance Degradation

#### Problem Description
Time signature changes cause significant performance issues due to excessive re-rendering and note splitting.

#### Root Cause
Creating 8+ note parts for what should be 2 parts causes VexFlow to render many more elements than necessary.

#### Impact
- UI becomes slow and unresponsive
- Memory usage increases
- Browser may freeze with complex scores

#### Code Location
- `renderTrebleBlocksToMeasures()` - Excessive note creation
- VexFlow rendering pipeline

---

## Technical Debt

### 1. Incomplete Abstraction
- Bass and treble note systems use different storage mechanisms
- No unified note preservation API
- Duplicate code for similar operations

### 2. Hardcoded Values
- Magic numbers throughout duration calculations
- No centralized time signature constants
- Inconsistent unit conversions

### 3. Poor Error Handling
- No validation of time signature changes
- Silent failures in edge cases
- No recovery mechanisms for corrupted state

### 4. Testing Gaps
- No automated tests for time signature changes
- Manual testing only, prone to human error
- Edge cases not systematically covered

---

## Root Cause Analysis

### Primary Issue: Duration System Corruption
The fundamental problem appears to be that the duration calculation system is fundamentally broken. Despite multiple attempts to fix `durationToUnits('1n')`, it continues to return 768 instead of 192.

### Secondary Issues: State Management Failures
Once the duration system produces wrong values, the entire treble note system becomes corrupted because:
1. Wrong durations cause wrong splitting
2. Wrong splitting corrupts the block sequence
3. Corrupted block sequence causes positioning errors
4. Positioning errors make the UI unusable

### Tertiary Issues: Inconsistent Architecture
The different approaches for bass vs. treble note storage create maintenance issues and make it difficult to implement consistent behavior.

---

## Immediate Action Items

### High Priority
1. **Fix duration calculation** - Ensure `durationToUnits('1n')` returns 192
2. **Implement proper treble preservation** - Find a way to preserve treble notes without corrupting positioning
3. **Add comprehensive logging** - Track all duration calculations and positioning logic

### Medium Priority
1. **Unify note storage systems** - Create consistent API for bass and treble notes
2. **Add input validation** - Prevent invalid time signatures and operations
3. **Implement automated tests** - Ensure time signature changes work reliably

### Low Priority
1. **Performance optimization** - Reduce rendering overhead
2. **UI improvements** - Better feedback during time signature changes
3. **Documentation** - Complete API documentation for time signature functionality

---

## Current Status

**Functionality**: Working for both bass and treble notes including multiple voices
**Reliability**: Treble notes now preserved during time signature changes
**Performance**: Normal - excessive splitting issue was due to multi-voice skip
**Maintainability**: Improved with consistent multi-voice support

## Fixes Applied (2024-12)

### 1. Multi-Voice Support Enabled
**Files**: `compositionState.js` (lines 1794-1812, 1591-1602)

The multi-voice skip checks in `renderTrebleBlocksToMeasures()` and `syncMeasuresToTrebleBlock()` were causing treble notes to be completely ignored during time signature changes when Voice 2 was present. These checks have been removed because:
- The block sequence already stores voice attributes for each note
- The render logic only clears voices present in the block, preserving others
- Both voices are now properly synced and rendered during time signature changes

### 2. Treble Sync Before Import
**File**: `compositionState.js` (lines 3155-3173)

Added `syncMeasuresToTrebleBlock()` call BEFORE `importFromProgressionData()` clears measures. This ensures:
- Any treble notes edited directly in measures are captured
- Notes from all voices are preserved in the block sequence
- After import, notes are correctly re-rendered to new measure boundaries

### 3. Fixed BuildingBlockSequence.getBeatsPerMeasure()
**File**: `buildingBlock.js` (lines 809-818)

The `getBeatsPerMeasure()` function was incorrectly returning just the numerator (e.g., 6 for 6/8). Fixed to use the formula `num * (4 / denom)`:
- 4/4 → 4 beats
- 3/4 → 3 beats
- 6/8 → 3 beats (not 6)
- 2/2 → 4 beats
- 9/8 → 4.5 beats

This matches `getBeatsPerMeasureFromTimeSignature()` in compositionState.js.
