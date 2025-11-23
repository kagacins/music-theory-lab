# Ghost Note Vertical Scrolling Issue

## Problem Description

The ghost note preview (shown when hovering with Alt key held) has incorrect vertical positioning after scrolling the notation canvas viewport vertically. The issue manifests as:

1. **Before any scrolling**: Ghost note tracks mouse cursor accurately in both treble and bass clefs
2. **After vertical scrolling**: Ghost note appears significantly above or below the mouse cursor
3. **Horizontal scrolling works correctly**: No positioning issues when scrolling left/right
4. **Issue is proportional to scroll distance**: The farther you scroll vertically, the worse the offset

### User Experience

1. User loads page with 6+ measures (causing vertical scrolling with 2 rows of 4 measures each)
2. User scrolls down to see second row of measures
3. User holds Alt and moves mouse over bass clef in second row
4. Ghost note appears way above mouse cursor, sometimes even in treble clef
5. The pitch detection is also wrong - it "pegs" at certain pitches that change based on scroll amount

## Architecture Overview

### Coordinate Systems

There are three coordinate systems in play:

1. **Viewport coordinates**: Mouse events (`clientX`, `clientY`) - relative to browser window
2. **Canvas-local coordinates**: Relative to canvas element's top-left, accounts for scroll via `getBoundingClientRect()`
3. **Layout coordinates**: Absolute positions in the full rendered canvas (used by VexFlow for rendering)

### Key Components

1. **Base Canvas** (`position: static`): Scrolls naturally with parent container
2. **Overlay Canvas** (`position: absolute`): For drawing ghost notes and selection highlights
3. **StaffLayoutManager**: Converts coordinates and manages multi-system layout
4. **NoteEditor**: Handles mouse events and ghost note rendering

### Rendering Pipeline

```
User moves mouse
  ↓
handleMouseMove(e) - Mouse event in viewport coords
  ↓
getCanvasPosition(e) - Convert to canvas-local coords using getBoundingClientRect()
  ↓
layoutManager.getStaffPositionAtPoint(x, y) - Convert to staff position (pitch, measure, etc.)
  ↓
updateGhostNote(staffPosition, mouseX, mouseY) - Create ghost note data
  ↓
drawGhostNote(ctx) - Draw on overlay canvas
```

## Attempted Fixes

### Attempt 1: Initial Scroll Offset Adjustment

**What was tried**: Added scroll offset adjustments to `getCanvasPosition()`, `drawGhostNote()`, and `drawSelectionHighlights()`

**Files modified**:
- `src/modules/notation/noteEditor.js`
- `src/modules/notation/notationInit.js`

**Result**: Ghost note and selection box disappeared completely

**Why it failed**: Changed overlay positioning to `left: 0; top: 0` which made elements render outside viewport

### Attempt 2: Dynamic Overlay Positioning

**What was tried**: Made overlay position update dynamically based on scroll:
```javascript
overlay.style.left = (baseCanvas.offsetLeft - scrollLeft) + 'px';
overlay.style.top = (baseCanvas.offsetTop - scrollTop) + 'px';
```

**Result**:
- ✅ Selection box now works correctly
- ❌ Ghost note still offset proportional to scroll distance
- ❌ Notes couldn't be selected after scrolling

**Why it partially failed**: Fixed overlay positioning but coordinate conversion still had issues

### Attempt 3: Remove Scroll Offset from getCanvasPosition()

**What was tried**: Removed scroll offset from coordinate calculation since `getBoundingClientRect()` already accounts for it:
```javascript
// BEFORE (wrong - double counting):
return {
  x: e.clientX - rect.left + scrollLeft,
  y: e.clientY - rect.top + scrollTop,
};

// AFTER (correct):
return {
  x: e.clientX - rect.left,
  y: e.clientY - rect.top,
};
```

**Result**:
- ✅ Note selection after scrolling works
- ✅ Horizontal scrolling ghost note works perfectly
- ❌ Vertical scrolling ghost note still broken in second row

**Why vertical still broken**: Unknown - horizontal works fine with same code

### Attempt 4: Fix staffHeight Constant

**What was tried**: Changed hardcoded `staffHeight = 40` to `staffHeight = 80` to match VexFlow rendering

**Files modified**:
- `src/modules/notation/noteEditor.js:1181`
- `src/modules/notation/staffLayouter.js:289`

**Result**:
- ✅ Ghost note positioning improved slightly
- ❌ Still offset in second row with vertical scroll
- ❌ Notes being added to wrong measure (e.g., 7th instead of 1st)

**Partial success**: Correct constant was necessary but not sufficient

### Attempt 5: Remove layoutManager.setScroll() (Believed to be double-counting)

**What was tried**: Removed the `layoutManager.setScroll()` call from scroll event handler, believing it was causing double-counting since `getCanvasPosition()` returns canvas-local coordinates

**Result**:
- ❌ Issue got WORSE
- ❌ Both horizontal AND vertical scrolling broke
- ❌ Ghost note positioning wrong even in first row after scroll

**Why it failed**: layoutManager NEEDS scroll offset to convert canvas-local → layout coordinates for measure detection

**Reverted**: This change was reverted

### Attempt 6: Restore layoutManager.setScroll() + Expose to Window

**What was tried**:
1. Restored `layoutManager.setScroll()` call in scroll handler
2. Fixed critical bug: `window.notationLayoutManager` was never set!
3. Exposed layoutManager to window in `composerIntegration.js:58`
4. Added initial scroll position setting on overlay creation

**Files modified**:
- `src/modules/notation/notationInit.js:124-130` - Set initial scroll
- `src/modules/notation/notationInit.js:149-153` - Update on scroll
- `src/modules/notation/composerIntegration.js:57-58` - Expose to window

**Code added**:
```javascript
// In composerIntegration.js constructor:
this.layoutManager = new StaffLayoutManager({
  measuresPerLine: this.config.measuresPerLine,
});
// Expose layoutManager to window for scroll coordination with overlay
window.notationLayoutManager = this.layoutManager;

// In notationInit.js after overlay creation:
// CRITICAL: Set initial scroll position in layoutManager
if (window.notationLayoutManager) {
  const scrollLeft = baseCanvas.parentElement.scrollLeft || 0;
  const scrollTop = baseCanvas.parentElement.scrollTop || 0;
  window.notationLayoutManager.setScroll(scrollLeft, scrollTop);
}

// In scroll event handler:
if (window.notationLayoutManager) {
  const scrollLeft = baseCanvas.parentElement.scrollLeft || 0;
  const scrollTop = baseCanvas.parentElement.scrollTop || 0;
  window.notationLayoutManager.setScroll(scrollLeft, scrollTop);
}
```

**Expected result**: Should work like horizontal scrolling (which works perfectly)

**Actual result**: User reports "both issues appear the exact same" - still broken

## Current State

### What Works
- ✅ Horizontal scrolling: Ghost note tracks cursor perfectly
- ✅ Selection box follows selected notes during scroll
- ✅ Note selection after scrolling
- ✅ First row (no vertical scroll): Perfect ghost note tracking
- ✅ Bass clef in first row: Works correctly

### What Doesn't Work
- ❌ Vertical scrolling: Ghost note offset from cursor
- ❌ Second row after vertical scroll: Wrong pitch detection
- ❌ Ghost note "pegs" at certain pitches based on scroll amount

## Relevant Code Sections

### staffLayouter.js - getStaffPositionAtPoint (Lines 277-336)

This method converts canvas-local coordinates to staff position (pitch, measure, staff):

```javascript
getStaffPositionAtPoint(x, y) {
  const measureBounds = this.getMeasureAtPoint(x, y);
  if (!measureBounds) return null;

  // Apply zoom and scroll
  const realY = (y + this.config.scrollY) / this.config.zoom;

  // Calculate staff Y positions from measure bounds
  const systemMarginTop = 20;
  const staffHeight = 80; // Standard 5-line staff height (NOT 40!)
  const staffSpacing = 80;
  const trebleY = measureBounds.y + systemMarginTop;
  const bassY = measureBounds.y + systemMarginTop + staffHeight + staffSpacing;

  // Determine which staff
  const trebleBottom = trebleY + 80;
  const bassTop = bassY - 40;

  let staff, staffY;
  const middleY = (trebleBottom + bassTop) / 2;

  if (realY >= bassY) {
    staff = 'bass';
    staffY = bassY;
  } else if (realY <= middleY) {
    staff = 'treble';
    staffY = trebleY;
  } else {
    staff = 'bass';
    staffY = bassY;
  }

  // Calculate staff line (0 = bottom line, 8 = top line)
  const relativeY = realY - staffY;
  const lineSpacing = 10;
  const line = Math.round((40 - relativeY) / (lineSpacing / 2));

  // Convert line to pitch
  const pitch = lineToPitch(line, staff);

  return {
    measure: measureBounds,
    staff,
    line,
    pitch,
  };
}
```

### noteEditor.js - getCanvasPosition (Lines 370-380)

Converts mouse event to canvas-local coordinates:

```javascript
getCanvasPosition(e) {
  const rect = this.canvas.getBoundingClientRect();

  // getBoundingClientRect() is already viewport-relative and accounts for parent scroll
  // Mouse events (clientX/Y) are also viewport-relative
  // So we just need the difference to get canvas-local coordinates
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}
```

### noteEditor.js - drawGhostNote (Lines 1144-1194)

Draws the ghost note on overlay:

```javascript
drawGhostNote(ctx) {
  if (!this.ghostNote || !this.ghostNote.measure) {
    return;
  }

  const bounds = this.ghostNote.measure;

  // Get scroll offset to convert layout coordinates → canvas-local coordinates
  const scrollLeft = this.canvas.parentElement ? this.canvas.parentElement.scrollLeft : 0;
  const scrollTop = this.canvas.parentElement ? this.canvas.parentElement.scrollTop : 0;

  // Convert measure bounds from layout coordinates to canvas-local coordinates
  const canvasBounds = {
    x: bounds.x - scrollLeft,
    y: bounds.y - scrollTop,
    width: bounds.width,
    height: bounds.height,
  };

  // Calculate note X position (mouseX is already in canvas-local coordinates)
  const noteX = this.ghostNote.mouseX !== undefined
    ? this.ghostNote.mouseX
    : (canvasBounds.x + (canvasBounds.width / 2));

  // Calculate staff Y positions from measure bounds (now in canvas-local coordinates)
  const systemMarginTop = 20;
  const staffHeight = 80; // Standard 5-line staff height (NOT 40!)
  const staffSpacing = 80;
  const trebleY = canvasBounds.y + systemMarginTop;
  const bassY = canvasBounds.y + systemMarginTop + staffHeight + staffSpacing;

  // Calculate note Y position from pitch and staff line
  const staffY = this.ghostNote.staff === 'treble' ? trebleY : bassY;
  const lineSpacing = 10;
  const line = this.pitchToLine(this.ghostNote.pitch, this.ghostNote.staff);
  const noteY = staffY + (40 - line * (lineSpacing / 2));

  // Draw ghost note...
}
```

## Debug Console Output

When hovering over second row with vertical scroll of 235px:

```
[NoteEditor] Mouse position (canvas-local): 395, 464
[NoteEditor] Detected staff position: {
  measure: 4,
  measureBounds: { index: 4, system: 1, x: 40, y: 460, width: 220, height: 280 },
  staff: "bass",
  pitch: "F2",
  line: 10
}
[NoteEditor] Scroll: { scrollLeft: 0, scrollTop: 235 }
[NoteEditor] Ghost note created: {
  pitch: "F2",
  staff: "bass",
  measure: { index: 4, system: 1, x: 40, y: 460, width: 220, height: 280 }
}
[NoteEditor] Drawing ghost note: {
  staff: "bass",
  pitch: "F2",
  measureBounds: { index: 4, system: 1, x: 40, y: 460, width: 220, height: 280 },
  scroll: { scrollLeft: 0, scrollTop: 235 }
}
```

## Key Observations

1. **Horizontal scrolling works perfectly with identical code** - Why?
2. **`getMeasureAtPoint()` correctly identifies measure in second row** - The measure detection works
3. **`getStaffPositionAtPoint()` uses `realY = (y + this.config.scrollY) / this.config.zoom`** - Is this correct for vertical but not horizontal?
4. **Canvas-local Y coordinate is 464, layout Y is 460** - Very close, seems right
5. **Ghost note uses same coordinate conversion as selection box** - Selection box works, ghost note doesn't

## Questions for Investigation

1. Why does horizontal scrolling work but vertical doesn't with identical coordinate conversion logic?
2. Is there a difference in how VexFlow calculates vertical vs horizontal positions for multi-row layouts?
3. Should `getStaffPositionAtPoint()` be using canvas-local coordinates instead of adding scroll again?
4. Is the issue in `lineToPitch()` or `pitchToLine()` calculations?
5. Why does the ghost note "peg" at certain pitches that change with scroll amount?

## Files to Review

- `src/modules/notation/staffLayouter.js` - Layout manager and coordinate conversion
- `src/modules/notation/noteEditor.js` - Ghost note rendering and mouse handling
- `src/modules/notation/notationInit.js` - Overlay creation and scroll handlers
- `src/modules/notation/grandStaff.js` - VexFlow rendering constants (staffHeight = 80)
- `src/modules/notation/composerIntegration.js` - NotationComposer main class

## Attempt 7: Nuclear Solution - Extract Actual VexFlow Positions

**What was tried**: Instead of calculating staff positions, extract ACTUAL positions from rendered VexFlow staves using `stave.getY()` and `stave.getX()`

**Rationale**: Eliminate all calculation errors by using real positions directly from VexFlow after rendering

**Files modified**:
- `src/modules/notation/grandStaff.js:renderGrandStaffSystem` - Capture actual positions after rendering
- `src/modules/notation/staffLayouter.js` - Add `actualMeasurePositions` Map and `setActualMeasurePositions()` method
- `src/modules/notation/composerIntegration.js:822-826` - Call `setActualMeasurePositions()` after rendering
- `src/modules/notation/noteEditor.js:1172-1209` - Use actual positions in `drawGhostNote()`

**Code added**:
```javascript
// In grandStaff.js - capture actual positions:
if (result) {
  const actualTrebleY = result.trebleStave ? result.trebleStave.getY() : y;
  const actualBassY = result.bassStave ? result.bassStave.getY() : y + 80 + staffSpacing;

  renderedMeasures.push({
    index: i,
    ...result,
    actualBounds: {
      x: actualX,
      trebleY: actualTrebleY,
      bassY: actualBassY,
      width: actualWidth,
      height: (actualBassY - actualTrebleY) + 100,
    },
  });
}

// In staffLayouter.js - store actual positions:
setActualMeasurePositions(measures) {
  this.actualMeasurePositions.clear();
  measures.forEach((measure, index) => {
    if (measure.actualBounds) {
      this.actualMeasurePositions.set(index, {
        index: index,
        x: measure.actualBounds.x,
        trebleY: measure.actualBounds.trebleY,
        bassY: measure.actualBounds.bassY,
        width: measure.actualBounds.width,
        height: measure.actualBounds.height,
      });
    }
  });
}

// In noteEditor.js - use actual positions:
if (useActualPositions) {
  trebleY = bounds.actualTrebleY;
  bassY = bounds.actualBassY;
}
```

**Result**:
- ❌ Made ghost note placement worse everywhere
- ❌ Ghost note appeared beneath mouse pointer in 2nd row
- ❌ Ghost note not appearing at all in some cases

**Why it failed**: Overlay canvas positioning was incorrect (discovered to be 123px too high)

## Attempt 8: Fix Overlay Canvas Positioning - getBoundingClientRect()

**What was tried**: Discovered overlay canvas was positioned incorrectly. Changed to use `getBoundingClientRect()` for positioning calculation

**Discovery**: Console debugging revealed:
- Base canvas: `x: 346, y: 233` (viewport position)
- Overlay canvas: `x: 345, y: 110` (123px too high!)

**Files modified**:
- `src/modules/notation/notationInit.js:106-114` - Changed `updateOverlayPosition()` to use `getBoundingClientRect()`

**Code added**:
```javascript
const updateOverlayPosition = () => {
  const baseRect = baseCanvas.getBoundingClientRect();
  const parentRect = baseCanvas.parentElement.getBoundingClientRect();

  // Position overlay relative to parent to match base canvas exactly
  overlay.style.left = (baseRect.left - parentRect.left) + 'px';
  overlay.style.top = (baseRect.top - parentRect.top) + 'px';
};
```

**Result**:
- ❌ Ghost note now "incredibly high, off the viewport even on the top row"
- Console showed: `overlay.style.top = 127.986px` (still wrong)

**Why it failed**: The calculation `(baseRect.top - parentRect.top)` doesn't correctly position absolute overlay over static base canvas

## Attempt 9: Fix Overlay Canvas Positioning - offsetTop/offsetLeft

**What was tried**: Changed to use `offsetTop` and `offsetLeft` instead of `getBoundingClientRect()` calculation

**Rationale**: `offsetTop`/`offsetLeft` give element's position relative to its offsetParent, which is correct for absolute positioning

**Files modified**:
- `src/modules/notation/notationInit.js:106-111`

**Code added**:
```javascript
const updateOverlayPosition = () => {
  overlay.style.left = baseCanvas.offsetLeft + 'px';
  overlay.style.top = baseCanvas.offsetTop + 'px';
};
```

**Result**:
- ✅ Initial positioning improved
- ❌ Horizontal scroll broken - ghost note now right of pointer after scroll
- ❌ Second row - "don't even know where it is"

**Why it failed**: `offsetTop`/`offsetLeft` don't change when scrolling, so overlay stays fixed while base canvas moves with scroll

## Attempt 10: FINAL FIX - Subtract Scroll from Overlay Position & Add Scroll to Coordinate Conversion

**What was tried**: Two-part fix addressing both overlay positioning and coordinate conversion

**Root Cause Identified**:
1. **Overlay positioning**: Must subtract scroll to keep absolute overlay aligned with static base canvas during scroll
2. **Coordinate conversion**: Must add scroll to convert canvas-local (viewport-relative) → layout (absolute) coordinates

**Files modified**:
- `src/modules/notation/notationInit.js:106-115` - Subtract scroll from overlay position
- `src/modules/notation/staffLayouter.js:284-288` - Add scroll to coordinate conversion

**Code added**:
```javascript
// Fix 1: Overlay positioning
const updateOverlayPosition = () => {
  const scrollLeft = baseCanvas.parentElement.scrollLeft || 0;
  const scrollTop = baseCanvas.parentElement.scrollTop || 0;

  // Overlay is position:absolute, base canvas is position:static
  // When parent scrolls, base canvas moves in viewport, but overlay doesn't
  // So we subtract scroll to make overlay move with base canvas
  overlay.style.left = (baseCanvas.offsetLeft - scrollLeft) + 'px';
  overlay.style.top = (baseCanvas.offsetTop - scrollTop) + 'px';
};

// Fix 2: Coordinate conversion in getMeasureAtPoint()
// CRITICAL: x and y are canvas-local coordinates (viewport-relative, from getBoundingClientRect)
// VexFlow positions are layout coordinates (absolute positions in full canvas)
// To convert canvas-local → layout: ADD scroll, then apply zoom
const realX = (x + this.config.scrollX) / this.config.zoom;
const realY = (y + this.config.scrollY) / this.config.zoom;
```

**Expected Result**:
- ✅ Horizontal scroll - ghost note tracks cursor
- ✅ Vertical scroll - ghost note tracks cursor in all rows
- ✅ Both scrolls - coordinates align properly

**Status**: Awaiting user testing after page reload

## Key Lessons Learned

### Coordinate System Relationships

1. **Canvas-local coordinates** (from `getBoundingClientRect()`):
   - Viewport-relative
   - Already accounts for parent scroll
   - Changes when scrolling (element moves in viewport)
   - Used by mouse events after `getCanvasPosition()` conversion

2. **Layout coordinates** (used by VexFlow):
   - Absolute positions in full canvas
   - Does NOT change when scrolling
   - Used for rendering positions
   - Conversion: `layoutCoord = (canvasLocalCoord + scroll) / zoom`

3. **Overlay positioning** (absolute vs static):
   - Base canvas is `position: static` → moves naturally with scroll
   - Overlay is `position: absolute` → stays fixed unless manually repositioned
   - Must subtract scroll from overlay position to track base canvas
   - Formula: `overlayPos = offsetPos - scroll`

### Common Mistakes to Avoid

1. ❌ **Don't add scroll to canvas-local coordinates** - `getBoundingClientRect()` already accounts for it
2. ❌ **Don't use `getBoundingClientRect()` for overlay positioning** - Use `offsetTop`/`offsetLeft` with scroll adjustment
3. ❌ **Don't forget to convert coordinate systems** - Canvas-local ≠ Layout coordinates
4. ❌ **Don't assume overlay moves with scroll** - Absolute positioning requires manual updates
5. ✅ **Do use actual VexFlow positions when available** - Eliminates calculation errors
6. ✅ **Do update overlay position on every scroll event** - Keeps overlay aligned with base canvas

### Why Previous Attempts Failed

| Attempt | Why It Failed |
|---------|---------------|
| 1-2 | Changed overlay to `left: 0; top: 0`, rendering outside viewport |
| 3 | Only fixed canvas-local coord calculation, not overlay positioning |
| 4-6 | Fixed constants and scroll tracking, but coordinate conversion still wrong |
| 7 | Good idea (actual positions) but overlay positioning broken |
| 8 | Wrong calculation for absolute positioning |
| 9 | Didn't account for scroll in overlay positioning |
| 10 | **Should work** - Fixes both overlay position AND coordinate conversion |

### If Issue Persists After Attempt 10

If ghost note is still misaligned after this fix, investigate:

1. **Verify scroll values are correct** - Log `this.config.scrollX` and `this.config.scrollY` in `getMeasureAtPoint()`
2. **Verify overlay position updates on scroll** - Log overlay `style.left` and `style.top` in scroll handler
3. **Verify actual VexFlow positions** - Log `actualTrebleY` and `actualBassY` values
4. **Check for CSS interference** - Verify no padding/margin/transform affecting calculations
5. **Test zoom factor** - Verify `this.config.zoom` is correct (should be 1.0 normally)
6. **Check VexFlow rendering** - Verify `stave.getY()` returns expected values
