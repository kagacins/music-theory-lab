# Pattern Highlighting Feature - Chord Progression Detection

## Overview
Restored and enhanced the chord progression pattern detection highlighting system. When users click on detected progression badges, the system now highlights all matching chord sequences with persistent colored backgrounds.

## How It Works

### 1. **Pattern Detection**
The `HarmonyAnalyzer` automatically detects common chord progressions in your sequence:
- I-IV-V-I (Basic)
- I-V-vi-IV (Pop Progression)
- ii-V-I (Jazz Progression)
- vi-IV-I-V (Deceptive)
- And many more...

**Location:** [progressionBuilder.js:1870](../src/modules/features/progressionBuilder.js#L1870)

### 2. **Pattern Badges**
Detected patterns appear as colorful badges above the chord cards:
- **Icon:** Lightning bolt indicating the pattern
- **Name:** Pattern name (e.g., "I-IV-V-I")
- **Count:** Number of occurrences (e.g., "2×")
- **Tooltip:** Shows description and measure locations

**Location:** [progressionBuilder.js:1879-1922](../src/modules/features/progressionBuilder.js#L1879)

### 3. **Interactive Highlighting**

#### Clicking a Badge:
1. **First Click:** Highlights all matching sequences
   - Badge scales up slightly (1.05x)
   - Badge gets a purple shadow
   - All matching chord sequences get colored backgrounds
   - Scrolls to first occurrence

2. **Second Click:** Clears highlights
   - Badge returns to normal state
   - All colored backgrounds removed

#### Multiple Occurrences:
When a pattern appears multiple times, each occurrence gets a different color with very prominent borders and shadows:
- **1st occurrence:** Purple background (`rgba(168, 85, 247, 0.3)`) with border (`rgba(168, 85, 247, 0.8)`) and shadow
- **2nd occurrence:** Pink background (`rgba(236, 72, 153, 0.3)`) with border (`rgba(236, 72, 153, 0.8)`) and shadow
- **3rd occurrence:** Blue background (`rgba(59, 130, 246, 0.3)`) with border (`rgba(59, 130, 246, 0.8)`) and shadow
- **4th occurrence:** Green background (`rgba(16, 185, 129, 0.3)`) with border (`rgba(16, 185, 129, 0.8)`) and shadow
- **5th occurrence:** Orange background (`rgba(251, 146, 60, 0.3)`) with border (`rgba(251, 146, 60, 0.8)`) and shadow
- **6th occurrence:** Rose background (`rgba(244, 63, 94, 0.3)`) with border (`rgba(244, 63, 94, 0.8)`) and shadow
- Colors cycle if there are more than 6 occurrences
- Each occurrence has a colored drop shadow for maximum visibility

## Implementation Details

### Functions

#### `renderPatternHighlights(container, progressionData, key)`
**Purpose:** Analyzes progression and creates clickable badges for detected patterns

**Process:**
1. Removes old pattern highlights
2. Calls `harmonyAnalyzer.analyzeProgression()`
3. Creates a badge for each detected pattern
4. Adds click handlers with toggle functionality

**Location:** [progressionBuilder.js:1860-1926](../src/modules/features/progressionBuilder.js#L1860)

#### `highlightPatternChords(pattern)`
**Purpose:** Creates persistent shaded backgrounds with very prominent borders and shadows behind matched chord sequences

**Features:**
- Clears previous highlights
- Applies different colors to each occurrence
- Adds data attributes for tracking:
  - `data-pattern-match`: Pattern ID
  - `data-match-index`: Which occurrence (0, 1, 2...)
- Applies inline styles:
  - `backgroundColor`: Semi-transparent color (30% opacity)
  - `border`: 3px solid border (80% opacity)
  - `boxShadow`: Colored drop shadow (40% opacity)
  - `borderRadius`: 12px rounded corners
  - `padding`: 4px spacing
  - `transition`: Smooth 0.3s animation
- Scrolls to first match

**Location:** [progressionBuilder.js:3195-3258](../src/modules/features/progressionBuilder.js#L3195)

#### `clearPatternHighlights()`
**Purpose:** Removes all pattern highlighting from chord cards

**Process:**
1. Finds all elements with `.pattern-highlight-active` class
2. Removes class and data attributes
3. Clears inline styles (background, border, borderRadius, padding)

**Location:** [progressionBuilder.js:3264-3274](../src/modules/features/progressionBuilder.js#L3264)

### Visual Design

#### Badge States
```css
/* Normal State */
.pattern-badge {
    background: linear-gradient(to right, #a855f7, #ec4899);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    cursor: pointer;
    transition: all 0.3s ease;
}

/* Hover State */
.pattern-badge:hover {
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
}

/* Active State (when pattern is highlighted) */
.pattern-badge-active {
    transform: scale(1.05);
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.4);
}
```

#### Highlighted Card Wrapper
```css
.pattern-highlight-active {
    background-color: rgba(168, 85, 247, 0.3); /* Or other color - 30% opacity */
    border: 3px solid rgba(168, 85, 247, 0.8); /* Very prominent border - 80% opacity */
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.4); /* Colored drop shadow */
    border-radius: 12px;
    padding: 4px;
    transition: all 0.3s ease;
}
```

## User Experience

### Example Workflow:
1. User builds progression: C - F - G - C
2. System detects: "I-IV-V-I (Basic)" badge appears
3. User clicks badge:
   - Badge scales up with purple glow
   - All 4 chord cards (C, F, G, C) get purple background with prominent purple border
   - Page scrolls to show first card (C)
4. User clicks badge again:
   - Badge returns to normal
   - Purple backgrounds and borders disappear

### Multiple Patterns:
If progression is: C - F - G - C - Am - F - C - G
- Pattern 1: "I-IV-V-I" at measures 1-4 (purple background with purple border)
- Pattern 2: "vi-IV-I-V" at measures 5-8 (pink background with pink border)

Clicking "I-IV-V-I" highlights measures 1-4 in purple with prominent border.
Clicking "vi-IV-I-V" clears purple, highlights measures 5-8 in pink with prominent border.

## Playback Highlighting

### Auto Play and Step Playback
When playing chords using the **Auto Play** button or **Step** buttons, the system provides real-time visual feedback:

1. **Chord Card Highlighting:**
   - Active chord card gets a blue ring (`ring-4 ring-blue-400 ring-offset-2`)
   - Previous highlights are cleared before highlighting the current chord
   - Automatically cleared when playback stops

2. **Tension Curve Point Highlighting:**
   - Corresponding point on tension curve enlarges (radius 8px)
   - Point border changes to blue (`#3b82f6`) with 4px width
   - Helps visualize harmonic tension during playback
   - Automatically cleared when playback stops

**Implementation:**
- [progressionBuilder.js:6132-6134](../src/modules/features/progressionBuilder.js#L6132) - Calls `highlightTensionPoint()` and `highlightChordCard()`
- [progressionBuilder.js:5375-5377](../src/modules/features/progressionBuilder.js#L5375) - Clears highlights on stop

## Benefits

1. **Visual Learning:** See common progressions in your music
2. **Pattern Recognition:** Learn to identify progressions by sight
3. **Multiple Occurrences:** Different colors for repeated patterns
4. **Persistent:** Highlights stay until cleared or changed
5. **Smooth Scrolling:** Auto-scroll to first occurrence
6. **Toggle Functionality:** Click again to clear
7. **Accessible:** Works with both simplified and detailed card views
8. **Playback Feedback:** Real-time highlighting during Auto Play and Step playback
9. **Tension Visualization:** See harmonic tension on curve during playback

## Technical Notes

### Data Attributes
Each highlighted card wrapper gets:
```html
<div class="chord-card-wrapper pattern-highlight-active"
     data-chord-index="0"
     data-pattern-match="I-IV-V-I"
     data-match-index="0"
     style="background-color: rgba(168, 85, 247, 0.3); border: 3px solid rgba(168, 85, 247, 0.8); box-shadow: 0 4px 12px rgba(168, 85, 247, 0.4); border-radius: 12px; padding: 4px;">
```

### Pattern Object Structure
```javascript
{
    id: "I-IV-V-I",
    name: "I-IV-V-I",
    description: "Classic authentic cadence progression",
    matches: [0, 8, 16], // Start indices of pattern occurrences
}
```

### Color Cycling
```javascript
const highlightColors = [
    { bg: 'rgba(168, 85, 247, 0.3)', border: 'rgba(168, 85, 247, 0.8)', shadow: '0 4px 12px rgba(168, 85, 247, 0.4)' },   // Purple
    { bg: 'rgba(236, 72, 153, 0.3)', border: 'rgba(236, 72, 153, 0.8)', shadow: '0 4px 12px rgba(236, 72, 153, 0.4)' },   // Pink
    { bg: 'rgba(59, 130, 246, 0.3)', border: 'rgba(59, 130, 246, 0.8)', shadow: '0 4px 12px rgba(59, 130, 246, 0.4)' },   // Blue
    { bg: 'rgba(16, 185, 129, 0.3)', border: 'rgba(16, 185, 129, 0.8)', shadow: '0 4px 12px rgba(16, 185, 129, 0.4)' },   // Green
    { bg: 'rgba(251, 146, 60, 0.3)', border: 'rgba(251, 146, 60, 0.8)', shadow: '0 4px 12px rgba(251, 146, 60, 0.4)' },   // Orange
    { bg: 'rgba(244, 63, 94, 0.3)', border: 'rgba(244, 63, 94, 0.8)', shadow: '0 4px 12px rgba(244, 63, 94, 0.4)' },     // Rose
];

// Use modulo to cycle colors
const color = highlightColors[matchIdx % highlightColors.length];
// Apply: color.bg for background, color.border for border, color.shadow for box-shadow
```

## Future Enhancements

Potential improvements:
- [ ] Add legend showing which color represents which occurrence
- [ ] Allow multiple patterns highlighted simultaneously
- [ ] Add "Clear All" button in quick analysis bar
- [ ] Highlight individual measures within pattern differently
- [ ] Show pattern name overlay on highlighted cards
- [ ] Animate transition between patterns

## Additional Progressions

The following progressions from the Template Browser have been added to the pattern detection system:

1. **vi-IV-I-V (Sensitive)** - Emotional variation starting on minor chord
2. **I-bVII-IV (Mixolydian Rock)** - Rock progression with modal flavor
3. **Power Ballad** - Extended 8-chord progression for dramatic rock ballads
4. **i-iv-V-i (Minor Basic)** - Basic minor key progression
5. **Circle of Fifths** - Complete 8-chord circle of fifths progression
6. **I-V-I Waltz** - Classic waltz progression
7. **I-IV-I-V-I (Folk Waltz)** - Extended waltz progression

These are now automatically detected and displayed as badges above the progression!

## Related Files

- [progressionBuilder.js](../src/modules/features/progressionBuilder.js) - Main implementation
- [harmonyAnalyzer.js](../src/modules/analysis/harmonyAnalyzer.js) - Pattern detection logic and COMMON_PROGRESSIONS definitions
- [progressionTemplates.js](../src/modules/features/progressionTemplates.js) - Template Browser progressions
