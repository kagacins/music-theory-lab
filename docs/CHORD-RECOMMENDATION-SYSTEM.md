# Chord Recommendation System Architecture

This document explains how the chord recommendation system works, including how the various weight settings and style/mood preferences interact to generate chord suggestions.

## Overview

The chord recommendation system uses a **two-modal partnership** where both settings work together to produce nuanced recommendations:

1. **Recommendation Weights Modal** (Navigation Sidebar) - Controls how much each scoring factor matters
2. **Chord Suggestion Modal** (Lightbulb on cards) - Controls what chord types score well for a given style/mood

## The Scoring Engine

The main scoring function is `generateComprehensiveRecommendations()` in `src/modules/features/comprehensiveChordRecommendations.js`.

### Five Scoring Components

Each potential chord is evaluated across five dimensions:

| Component | Function | What It Evaluates |
|-----------|----------|-------------------|
| Harmonic Function | `scoreHarmonicFunction()` | Tonic → Subdominant → Dominant relationships, tension/resolution |
| Voice Leading | `scoreVoiceLeading()` | Bass movement, common tones, total voice movement, contrary motion |
| Style Fit | `scoreStyleFit()` | How well the chord type fits the selected genre/style |
| Mood Fit | `scoreMoodFit()` | How well the chord type fits the selected emotional mood |
| Modal Interchange | `scoreModalInterchange()` | Borrowed chords from parallel modes |

Each component returns a score from 0-100.

### The Weighted Combination Formula

```javascript
totalScore =
    (harmonicScore × weights.harmonic) +
    (voiceLeadingScore × weights.voiceLeading) +
    (styleFit × weights.style) +
    (moodFit × weights.mood) +
    (modalInterchange × weights.modalInterchange)
```

## Recommendation Weights Modal

**Location:** Navigation Sidebar → "Recommendation Weights"
**Storage:** `localStorage: 'chord-recommendation-weights'`

### What It Controls

The **multipliers** for each scoring component. These weights determine how much each factor contributes to the final score.

### Approach-Based Presets

| Preset | harmonic | voiceLeading | style | mood | modalInterchange |
|--------|----------|--------------|-------|------|------------------|
| Balanced | 25% | 30% | 20% | 15% | 10% |
| Voice Leading | 25% | 45% | 15% | 10% | 5% |
| Harmonic Function | 45% | 30% | 12% | 8% | 5% |
| Style Match | 25% | 15% | 40% | 8% | 12% |
| Mood Match | 25% | 20% | 8% | 35% | 12% |

### Genre Template Presets

Complete profiles optimized for specific genres:
- Pop
- Rock
- Bossa Nova
- Blues
- Jazz Standard
- Classical
- Gospel
- R&B/Soul
- Country
- Latin Jazz

Each genre template adjusts all five weights to favor that genre's characteristic harmonic patterns.

## Chord Suggestion Modal

**Location:** Lightbulb button above chord cards
**Storage:**
- Style: `localStorage: 'chord-suggestion-style'`
- Mood: `localStorage: 'chord-suggestion-mood'`

### What It Controls

The **component scores themselves** - what chord types are evaluated favorably.

### Style Dropdown Options

| Style | Description | Effect on Scoring |
|-------|-------------|-------------------|
| Balanced Blend | Mix of common and interesting progressions | Neutral scoring |
| Top 40 / Pop | Radio-friendly, catchy progressions | Triads score 95, extensions score lower |
| Jazz / Complex | Sophisticated harmony with extensions | 7ths/9ths/13ths score high |
| Classical / Traditional | Time-tested voice leading | Triads and 7ths favored |
| Rock / Power | Strong, driving progressions | Power chords and triads favored |
| Indie / Alternative | Unexpected, creative choices | Modal interchange boosted |

### Mood Dropdown Options

| Mood | Description | Effect on Scoring |
|------|-------------|-------------------|
| Happy / Bright | Uplifting, positive feel | Major chords 95, minor 50 |
| Melancholic / Dark | Sad, introspective feel | Minor chords boosted |
| Jazzy / Complex | Sophisticated, colorful | Extensions and alterations boosted |
| Tense / Dramatic | Building tension | Diminished, augmented, altered chords boosted |
| Calm / Peaceful | Relaxed, serene | Simpler triads, suspended chords |
| Energetic / Driving | High energy, momentum | Power chords, dominant 7ths |

## How They Work Together

### Neither Overrides the Other

Both settings are **always applied together** in a multiplicative/additive relationship:

1. **Style/Mood** determine the raw component scores (0-100 for each chord type)
2. **Weights** determine how much each component contributes to the final score

### Example Calculation

**Settings:**
- Weights Modal: "Style Match" preset (style weight = 40%)
- Suggestion Modal: Style = "Pop", Mood = "Happy/Bright"

**For a G Major chord:**
- `styleScore = scoreStyleFit("Major", "pop")` → returns 95
- `moodScore = scoreMoodFit("Major", "bright")` → returns 95

**Contribution to final score:**
```
(95 × 0.40) + (95 × 0.15) = 38 + 14.25 = 52.25 points
```

**If weights were "Balanced" instead (style = 20%):**
```
(95 × 0.20) + (95 × 0.15) = 19 + 14.25 = 33.25 points
```

Same chord, different final score - both settings matter!

## Mixing and Matching

You can combine settings from different "families" for nuanced results:

| Combination | Result |
|-------------|--------|
| "Pop" weights + "Pop" style | Maximum pop optimization |
| "Pop" style + "Voice Leading" weights | Pop-friendly chords with smooth voice leading |
| "Jazz" style + "Happy/Bright" mood | Jazz chords but favoring brighter-sounding ones |
| "Classical" style + "Tense/Dramatic" mood | Traditional harmony with tension-building choices |

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. RECOMMENDATION WEIGHTS MODAL                              │
│    User selects preset (e.g., "Voice Leading")              │
│    → Saves weights to localStorage                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. CHORD SUGGESTION MODAL                                    │
│    User selects Style (e.g., "Pop") and Mood (e.g., "Bright")│
│    → Saves choices to localStorage                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. SCORING ENGINE                                            │
│    Reads all three settings from localStorage               │
│    For each potential chord:                                │
│    a) Calculate component scores (using style/mood)         │
│    b) Apply weights formula                                 │
│    c) Sum weighted components                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. RESULTS                                                   │
│    Sort all chords by total score                           │
│    Display top recommendations                              │
└─────────────────────────────────────────────────────────────┘
```

## Key Files

| Component | File Path |
|-----------|-----------|
| Weight Presets | `src/modules/config/weightPresets.js` |
| Scoring Engine | `src/modules/features/comprehensiveChordRecommendations.js` |
| Suggestion Modal | `src/modules/ui/chordSuggestionModal.js` |
| Chord Explorer | `src/modules/ui/chordExplorerModal.js` |
| Unified Styles/Moods | `src/modules/ui/unifiedChordSuggestions.js` |

## Practical Usage Tips

### For Beginners
- Start with "Balanced" weights and "Balanced Blend" style
- Adjust mood to match the feeling you want

### For Genre-Specific Work
- Select matching genre in both modals (e.g., "Pop" preset + "Top 40/Pop" style)
- This maximizes optimization for that genre

### For Experimentation
- Mix different settings to create unique sounds
- Try "Voice Leading" weights with unusual style/mood combinations

### For Advanced Users
- Use the Chord Explorer Modal to see all ~600 evaluated combinations
- Adjust individual weights with sliders for fine-tuned control
- The 3D visualization shows how different factors interact

## Technical Notes

### Weight Normalization

Weights are automatically normalized to sum to 1.0 (100%):

```javascript
function normalizeWeights(weights) {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    const normalized = {};
    for (const key in weights) {
        normalized[key] = weights[key] / sum;
    }
    return normalized;
}
```

This ensures consistent scoring regardless of how weights are adjusted.

### Context Mode

The scoring engine has a "context mode" that considers the full progression history (not just the previous chord) for more sophisticated recommendations. This uses slightly different default weights optimized for contextual analysis.

## Summary

The chord recommendation system is a sophisticated tool that lets you control:
- **What sounds good** (Style and Mood settings)
- **What matters most** (Weight settings)

Both work together multiplicatively - the style/mood settings determine raw scores, and the weights determine how much each scoring factor contributes. This creates a flexible system where you can optimize for specific genres while maintaining your preferred analytical approach.
