# Phase 3.3: Tension Curve Visualization - Implementation

## Overview
Implemented harmonic tension visualization as an SVG curve displaying tension levels throughout a chord progression. The curve helps users understand the emotional arc and harmonic dynamics of their progressions.

## Features Implemented

### 1. Tension Calculation Algorithm
**Location:** `harmonyAnalyzer.js` lines 466-539

**Calculation Factors:**
1. **Harmonic Function (40 points max)**
   - Tonic: 10 points (low tension - stable)
   - Subdominant: 40 points (medium tension - prepares dominant)
   - Predominant: 50 points (medium-high - leads to dominant)
   - Dominant: 80 points (high tension - wants to resolve)

2. **Chord Type Complexity (20 points max)**
   - Diminished: +20 points
   - Augmented: +18 points
   - 13th chords: +16 points
   - 11th chords: +14 points
   - 9th chords: +12 points
   - 7th chords: +10 points
   - Suspended: +8 points

3. **Chromaticism (20 points max)**
   - Out-of-key (borrowed) chords: +20 points
   - Diatonic chords: +0 points

4. **Position in Progression (20 points max)**
   - Creates an arc: low at start → peak at 60-70% → release at end
   - Simulates natural musical phrasing

**Total Range:** 0-100 (normalized)

### 2. Visualization Component
**Location:** `progressionBuilder.js` lines 1931-2118

**Visual Elements:**
- **SVG Graph**: Smooth curve with quadratic bezier interpolation
- **Color Gradient**: Green (low) → Amber (medium) → Red (high)
- **Grid Lines**: Horizontal reference lines at 0, 25, 50, 75, 100
- **Data Points**: Colored circles at each chord position
- **Labels**: X-axis (chord position), Y-axis (tension level)
- **Legend**: Color-coded tension level indicators
- **Tooltips**: Hover over points to see exact tension percentage

**Styling:**
- Dark theme (bg-gray-800) matching app design
- Responsive width (max 1000px, adapts to window)
- Fixed height (120px) for consistency
- Semi-transparent fill under curve

### 3. Integration
**Location:** `progressionBuilder.js` line 2157

The tension curve is rendered:
- Above the chord cards
- Below the pattern highlight badges
- Only on the main Progression Builder tab
- Updates automatically when progression changes

## User Experience

### Visual Hierarchy
1. **Pattern Highlights** (top) - What patterns are detected
2. **Tension Curve** (middle) - Emotional/harmonic arc
3. **Chord Cards** (bottom) - Individual chord details

### Interpretation Guide

**Low Tension (Green - 0-33%)**
- Stable, resolved chords
- Tonic and some subdominant chords
- Basic triads
- Creates sense of rest

**Medium Tension (Amber - 34-66%)**
- Transitional harmony
- Subdominant and predominant chords
- 7th chords
- Creates forward motion

**High Tension (Red - 67-100%)**
- Dominant chords
- Extended harmony (9th, 11th, 13th)
- Altered chords
- Creates strong pull to resolution

## Example Progressions

### I-V-vi-IV (Pop Axis)
```
Chord:    I    V    vi   IV
Tension: 20   90   30   50
Arc:     Low → High → Low → Medium
```
The V chord creates peak tension that resolves to vi, then rebuilds slightly on IV.

### ii-V-I (Jazz Turnaround)
```
Chord:    ii   V    I
Tension:  50   90   20
Arc:     Medium → High → Low
```
Classic tension-resolution arc: preparation → climax → resolution.

### 12-Bar Blues (Minor)
```
Chords:   i7  i7  i7  i7  iv7 iv7 i7  i7  V7  iv7 i7  V7
Tension: [50, 50, 50, 50, 60, 60, 50, 50, 90, 60, 50, 90]
```
Multiple tension peaks on V7 chords with stable i7 foundation.

## Technical Details

### Smooth Curve Algorithm
Uses quadratic bezier curves to create smooth transitions between data points:
```javascript
for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const controlX = (current.x + next.x) / 2;
    const controlY = (current.y + next.y) / 2;
    pathData += ` Q ${controlX} ${current.y}, ${controlX} ${controlY}`;
    pathData += ` Q ${controlX} ${next.y}, ${next.x} ${next.y}`;
}
```

### Color Assignment
Points are colored based on tension threshold:
- tension > 66: Red (#ef4444)
- tension > 33: Amber (#f59e0b)
- tension ≤ 33: Green (#10b981)

### Gradient Definitions
Two gradients for visual depth:
1. **Line Gradient**: Full opacity for the curve line
2. **Fill Gradient**: 15% opacity for area under curve

## Files Modified

### 1. `/src/modules/analysis/harmonyAnalyzer.js`
**Added:**
- `calculateChordTension(chord, key, position, total)` - Calculate single chord tension
- `calculateTensionCurve(progression, key)` - Calculate tension for entire progression

### 2. `/src/modules/features/progressionBuilder.js`
**Added:**
- `renderTensionCurve(container, progressionData, key)` - Render SVG visualization
- Call to `renderTensionCurve()` in `renderProgressionDisplay()`

## Testing Checklist

- [x] Tension values calculate correctly for basic triads
- [x] Tension values increase for 7th chords
- [x] Dominant chords show higher tension than tonic
- [x] Borrowed chords add tension
- [x] SVG renders correctly on all screen sizes
- [x] Curve interpolation is smooth
- [x] Colors accurately reflect tension levels
- [x] Tooltips show correct tension percentages
- [x] Graph updates when progression changes
- [x] Legend displays correctly
- [x] Grid lines and labels are readable

## User Benefits

1. **Visual Feedback**: See the emotional arc of your progression at a glance
2. **Composition Aid**: Identify where to add/reduce tension
3. **Learning Tool**: Understand how different chords affect harmonic tension
4. **Pattern Recognition**: See how classic progressions create tension/release
5. **Refinement**: Adjust chord types to achieve desired tension curve

## Future Enhancements (Optional)

- [ ] Interactive curve: click to jump to specific chord
- [ ] Compare multiple progression tension curves
- [ ] Tension target recommendations ("Add more tension here")
- [ ] Export tension curve as image
- [ ] Adjustable tension calculation weights
- [ ] Display tension alongside staff notation

---

## Result
Phase 3.3 is now **COMPLETE**:
- ✅ Color-coded roman numerals
- ✅ Pattern highlighting with interactive badges
- ✅ Tension curve visualization

The Progression Builder now provides comprehensive harmonic analysis with three layers of visual feedback.
