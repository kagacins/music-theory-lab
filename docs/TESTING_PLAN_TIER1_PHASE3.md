# Testing Plan: Phase 3 - Theory Overlay

## Overview
Test the visual theory overlay system that adds annotations to the chord progression display, including function color coding, voice leading arrows, and function indicators.

---

## Prerequisites
1. Start the dev server: `npm run dev`
2. Open the app in browser
3. Navigate to **Composition Studio** tab
4. Set key to **C Major** (for predictable analysis)
5. Build a progression with at least 4 chords (e.g., C → Am → F → G)

---

## Test Cases

### 1. Toggle Button Visibility

#### Location
- [ ] **Location**: "Overlay" button visible in Staff Notation section header
- [ ] **Position**: Next to the "Tips" button (Theory Moments toggle)
- [ ] **Style**: Matches other buttons (white text, semi-transparent background)

#### Initial State
- [ ] Overlay is **ON** by default
- [ ] Button shows full opacity when enabled

### 2. Toggle Functionality

#### Test: Enable/Disable
1. Click "Overlay" button
2. **Expected**: Overlay toggles off
3. Check console for `[TheoryOverlay] Enabled: false`
4. Click again to re-enable
5. **Expected**: Overlay reappears

#### Test: Persistence
1. Disable overlay
2. Refresh page
3. **Expected**: Overlay remains disabled (localStorage persistence)

### 3. Function Color Coding

#### Test: Card Border Colors
1. Enable overlay (if disabled)
2. Look at chord cards in progression
3. **Expected**: Each card has a colored left border indicating function:
   - **Green**: Tonic (I, C Major)
   - **Blue**: Subdominant (IV, F Major)
   - **Red**: Dominant (V, G Major)
   - **Cyan**: Submediant (vi, A Minor)
   - **Purple**: Mediant (iii)
   - **Amber**: Predominant (ii)

#### Test: Function Badge
1. Look at top-right corner of each chord card
2. **Expected**: Small colored circle (16px) matching the function color
3. Hover over badge
4. **Expected**: Tooltip shows function name (e.g., "Tonic function")

### 4. Voice Leading Arrows

#### Test: Arrow Visibility
1. Build a progression with 3+ chords
2. Enable overlay
3. **Expected**: Curved arrows appear between consecutive chord cards

#### Test: Arrow Colors
1. Look at the arrow colors between chords
2. **Expected**:
   - **Green arrows**: Smooth voice leading (many common tones)
   - **Blue arrows**: Good stepwise motion
   - **Amber arrows**: Some leaps (dashed line style)

#### Test: Common Tones Indicator
1. Look at arrows between chords with shared notes
2. **Expected**: Small circle with number showing common tone count

#### Test: Non-Consecutive Chords
1. Skip or remove a chord in the middle
2. **Expected**: No arrow drawn between non-consecutive indices

### 5. Overlay Updates

#### Test: Add Chord
1. Add a new chord to progression
2. **Expected**: Overlay updates automatically to include new card

#### Test: Remove Chord
1. Remove a chord from progression
2. **Expected**: Overlay updates, arrows redrawn

#### Test: Reorder Chords
1. Drag a chord to a new position
2. **Expected**: Overlay redraws with new ordering

### 6. Hover Effects

#### Test: Card Hover
1. Hover over a chord card
2. **Expected**: Card gets enhanced shadow with function color

#### Test: Arrow Visibility on Hover
1. Hover over a chord card
2. **Expected**: Connected arrows may become more visible

### 7. Edge Cases

#### Test: Single Chord
1. Clear progression
2. Add only one chord
3. **Expected**: Function color applied, no arrows (no pairs)

#### Test: Empty Progression
1. Clear all chords
2. **Expected**: No overlay elements, no errors

#### Test: Many Chords (10+)
1. Add 10 or more chords
2. **Expected**: All function colors and arrows render correctly

#### Test: Scroll View
1. If progression scrolls horizontally
2. **Expected**: SVG overlay scrolls with cards

### 8. Multiple Containers

#### Test: Composition Studio
1. Check `progression-visualization` container
2. **Expected**: Overlay renders

#### Test: Melody Composer (if applicable)
1. Check `melody-progression-visualization` container
2. **Expected**: Overlay renders there too

---

## Console Verification
Open DevTools Console and look for:
- `[TheoryOverlay] Initialized` on page load
- `[TheoryOverlay] Enabled: true/false` on toggle
- No JavaScript errors during overlay rendering

---

## localStorage Keys
- `theoryOverlayEnabled` - `"true"` | `"false"`

---

## Visual Reference

### Function Colors
| Roman Numeral | Function | Color | Hex |
|---------------|----------|-------|-----|
| I | Tonic | Green | #22c55e |
| IV | Subdominant | Blue | #3b82f6 |
| V, vii° | Dominant | Red | #ef4444 |
| ii | Predominant | Amber | #f59e0b |
| iii | Mediant | Purple | #8b5cf6 |
| vi | Submediant | Cyan | #06b6d4 |

### Voice Leading Arrow Types
| Type | Color | Style | Meaning |
|------|-------|-------|---------|
| Smooth | Green | Solid | Many common tones |
| Step | Blue | Solid | Mostly stepwise motion |
| Leap | Amber | Dashed | Contains leaps |

---

## Known Limitations
1. Arrow positions are calculated from card bounding boxes, may shift on resize
2. Borrowed chords default to "Predominant" function color
3. SVG overlay requires container to be position: relative
4. Voice leading analysis is simplified (doesn't track individual voices)

---

## Pass Criteria
- [ ] Toggle button works
- [ ] Toggle state persists across refresh
- [ ] Function colors appear on all cards
- [ ] Function badges appear with correct colors
- [ ] Voice leading arrows draw between consecutive chords
- [ ] Arrow colors reflect voice leading quality
- [ ] Common tones indicator shows count
- [ ] Overlay updates when progression changes
- [ ] No console errors
