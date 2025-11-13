# Comprehensive Chord Recommendation System

## Overview

The Music Theory Lab now features a sophisticated 3D chord recommendation engine that evaluates **all possible next chords** across three primary dimensions plus a fourth tension dimension.

## The 3D Scoring Matrix

### Three Primary Dimensions

1. **Root Note (X-axis)**: All 12 chromatic notes (C, C#, D, D#, E, F, F#, G, G#, A, A#, B)
2. **Chord Type (Y-axis)**: 17+ chord types (Major, Minor, Dominant 7th, Augmented, etc.)
3. **Inversion (Z-axis)**: All valid inversions for each chord type (Root, 1st, 2nd, etc.)

### Fourth Dimension: Tension Direction

- **Resolve**: Prefers resolutions (e.g., Dominant → Tonic)
- **Maintain**: Keeps tension level steady
- **Build**: Increases tension (e.g., Tonic → Dominant)

## Scoring Algorithm

Each (root, type, inversion) combination receives a composite score based on:

### 1. Harmonic Function Score (30% weight)
- Evaluates tonic → subdominant → dominant relationships
- Based on scale degree functions in the current key
- Rewards common progressions (e.g., IV → V → I)
- Adjusts based on tension direction preference

### 2. Voice Leading Score (35% weight)
Comprehensive analysis of smooth voice transitions:

- **Bass Movement** (25 points): Prefers smaller intervals, rewards stepwise motion
- **Common Tones** (25 points): Shared notes between chords
- **Total Voice Movement** (30 points): Minimizes cumulative voice displacement
- **Voice Range** (10 points): Prefers mid-range voicings around middle C
- **Contrary Motion** (10 points): Bonus when outer voices move in opposite directions

### 3. Style Fit Score (20% weight)
Filters and prioritizes chord types based on musical style:

- **Pop**: Simple chords (Major, Minor, Dom7)
- **Jazz**: Extended harmonies (9ths, 11ths, 13ths)
- **Classical**: Traditional progressions (triads, 7th chords, diminished)
- **Rock**: Power chords, suspended chords
- **Indie**: Add chords, unexpected colors
- **Balanced**: No filtering (all chord types equal)

### 4. Mood Fit Score (15% weight)
Adjusts recommendations based on intended emotional quality:

- **Bright**: Favors Major, Major 7th, Add9
- **Dark**: Favors Minor, Diminished, Half-Diminished
- **Jazzy**: Favors extended chords (9ths, 11ths, 13ths)
- **Tense**: Favors Diminished, Augmented, Altered dominants
- **Calm**: Favors Major 7th, Major 6th, peaceful sounds
- **Energetic**: Favors Dominant 7th, driving progressions

## How It Works

### For Chord Builder (Lightbulb Button 💡)

1. User clicks lightbulb on any chord in Chord Builder
2. System evaluates **all possible next chords**:
   - 12 root notes × ~17 chord types × ~3 inversions each
   - = ~600+ possibilities evaluated per recommendation request
3. Each possibility is scored using the algorithm above
4. Top 10 are displayed with:
   - Root + Chord Symbol + Inversion
   - Confidence stars (⭐⭐⭐)
   - Human-readable reason
   - Hold-to-play preview buttons
   - Add to progression button

### For Progression Builder (Smart Suggestions Panel)

Uses a separate harmonic-function-aware system that understands:
- Key relationships
- Roman numeral analysis
- Functional harmony (I, IV, V, etc.)
- Common chord progressions

## Example Evaluation

**Current Chord**: C Major (Root position)
**Key**: C Major
**Style**: Jazz
**Mood**: Bright
**Tension Direction**: Resolve

**Top Recommendations might include**:

1. **G Dominant 7th (2nd inv)** - 95/100
   - Strong harmonic progression (V → I implied)
   - Excellent voice leading (smooth bass, 2 common tones)
   - Perfect for jazz style
   - Matches bright mood

2. **F Major 7th (1st inv)** - 92/100
   - Classic subdominant motion
   - Very smooth voice leading
   - Jazz-appropriate 7th chord
   - Bright, uplifting quality

3. **A Minor 7th (Root)** - 88/100
   - Good harmonic flow (vi chord)
   - Smooth transitions
   - Jazz color from 7th
   - Contrasts major with minor (still bright overall)

## Key Features

✅ **Different Root Notes**: Suggests chords on different roots (not just C → Cmaj7 → C9)
✅ **Multiple Inversions**: Considers all inversions for optimal voice leading
✅ **Context-Aware**: Uses musical key for harmonic function analysis
✅ **Style-Sensitive**: Adapts to pop, jazz, classical, rock, indie, or balanced
✅ **Mood-Driven**: Matches emotional intent (bright, dark, jazzy, tense, calm, energetic)
✅ **Tension Control**: Respects whether to resolve, maintain, or build tension
✅ **Comprehensive**: Evaluates 600+ possibilities, shows best 10

## Implementation Files

- `/src/modules/features/comprehensiveChordRecommendations.js` - Core engine
- `/src/modules/features/chordBuilder.js` - Integration with Chord Builder modal
- `/src/modules/features/unifiedChordSuggestions.js` - Legacy same-root system (still used for some contexts)
- `/src/modules/features/chordRecommendations.js` - Progression-aware system for Smart Suggestions panel

## Future Enhancements

Potential areas for expansion:

1. **User Learning**: Track which suggestions users select to personalize recommendations
2. **Progression Context**: Consider the entire progression history, not just the last chord
3. **Genre Templates**: Pre-built recommendation profiles for specific genres (Bossa Nova, Blues, etc.)
4. **Voice Leading Constraints**: Optional strict classical voice leading rules
5. **Parallel Progressions**: Suggest sequences of 2-3 chords at once
6. **Modal Interchange**: Better support for borrowed chords from parallel modes
