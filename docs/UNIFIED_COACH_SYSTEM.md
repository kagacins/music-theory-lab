# Unified Composition Coach System

**Date:** 2026-01-16
**Status:** Technical Design Document
**Focus:** Unified system for proactive observations AND suggestions, leveraging existing infrastructure

---

## The Vision

A **three-tier coaching system** that meets users where they are:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   TIER 1: PROACTIVE NUDGES                                                  │
│   ─────────────────────────                                                 │
│   Lightweight, contextual, automatic                                        │
│   "Hey, you just created a deceptive cadence!"                             │
│   "Try adding a borrowed chord here for color"                             │
│                                                                             │
│         ↓ User wants more? Click to...                                     │
│                                                                             │
│   TIER 2: QUICK EXPLORATION PANELS                                          │
│   ──────────────────────────────────                                        │
│   Bottom dock panels (Theory, Borrowed Chords, Voice Leading)              │
│   Curated suggestions with preview & one-click apply                       │
│   "Here are 12 borrowed chords that work in your key"                      │
│                                                                             │
│         ↓ User wants deep control? Click to...                             │
│                                                                             │
│   TIER 3: DEEP DIVE MODAL                                                   │
│   ───────────────────────────                                               │
│   Unified Recommendation Modal                                              │
│   Full flexibility: Suggest, Compare, Transform, Optimize, Sequence        │
│   Melody, Harmonize, Section, Polyphony tabs                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Current Assets Inventory

### Already Built - Detection & Analysis

| System | Location | What It Detects |
|--------|----------|-----------------|
| Pattern Detection | `patternDetection.js` | Cadences (5), Borrowed (6), Modal (5), Sequences (3) |
| Harmony Analyzer | `harmonyAnalyzer.js` | Functions, Tension, Named Progressions |
| Voice Leading | `enhancedVoiceLeading.js` | Parallels, Crossing, Leaps, Quality Scores |
| Extended Harmony | `extendedHarmonicRelationships.js` | Secondary Dominants, Chromatic Mediants |
| Chord Tone Analysis | `chordToneAnalyzer.js` | Note-to-chord relationships |
| Tension Planning | `TensionArcPlanner.js` | Tension curves, optimization |
| Motif Recognition | `motifRecognition.js` | Recurring melodic patterns |

### Already Built - Presentation

| System | Location | What It Does |
|--------|----------|--------------|
| Theory Moments | `theoryMoments.js` | Floating contextual popups |
| Theory Panel | `FullScreenBottomPanel.js` | Pattern detection, function analysis, tips |
| Borrowed Chords Panel | `FullScreenBottomPanel.js` | Curated borrowed chords with preview |
| Voice Leading Panel | `FullScreenBottomPanel.js` | Visual overlay, warnings, fixes |
| Unified Recommendation Modal | `UnifiedRecommendationModal/` | 5 chord intents, 4 other tabs |

### Already Built - Recommendation Engines

| Engine | Location | What It Generates |
|--------|----------|-------------------|
| Comprehensive Chord Recs | `comprehensiveChordRecommendations.js` | Scored next-chord suggestions |
| Chord Sequences | `chordSequences.js` | Multi-chord sequences with tension arcs |
| Theory Tools | `theoryTools.js` | Secondary dominants, modal interchange |
| Why This Works | `whyThisWorksEnhanced.js` | Multi-level explanations |

---

## The Gap: Connecting the Dots

**Current State:**
- Detectors run but results aren't aggregated
- Theory Moments fire on chord addition but miss many patterns
- Panels require user to open them manually
- Recommendations are available but not proactively surfaced

**Desired State:**
- Unified "Observation Engine" aggregates all detections
- Proactive nudges surface interesting findings automatically
- Nudges link to appropriate depth (panel or modal)
- Suggestions are equally weighted with observations

---

## Architecture: Unified Coach System

### Core Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPOSITION EVENTS                                   │
│  chordAdded, noteEdited, progressionChanged, measureCompleted               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COACH ENGINE (NEW)                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │ Observation      │  │ Suggestion       │  │ Opportunity      │          │
│  │ Detectors        │  │ Generators       │  │ Scanners         │          │
│  │ (what happened)  │  │ (what to try)    │  │ (what's missing) │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│           │                    │                      │                     │
│           └────────────────────┴──────────────────────┘                     │
│                                │                                            │
│                                ▼                                            │
│                    ┌─────────────────────┐                                  │
│                    │  Priority Queue     │                                  │
│                    │  (score, cooldown,  │                                  │
│                    │   user prefs)       │                                  │
│                    └─────────────────────┘                                  │
│                                │                                            │
│                                ▼                                            │
│                    ┌─────────────────────┐                                  │
│                    │  Presentation       │                                  │
│                    │  Router             │                                  │
│                    └─────────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │ Floating    │ │ Panel       │ │ Modal       │
            │ Nudge       │ │ Highlight   │ │ Deep Link   │
            │ (Tier 1)    │ │ (Tier 2)    │ │ (Tier 3)    │
            └─────────────┘ └─────────────┘ └─────────────┘
```

### Three Types of Coach Items

#### 1. Observations ("You just created...")
Celebrate and educate about what the user did.

```javascript
{
  type: 'observation',
  category: 'cadence',
  id: 'deceptive-cadence',
  priority: 85,
  data: { from: 'V', to: 'vi', measureIndex: 3 },

  // Presentation
  emoji: '🎉',
  title: 'Deceptive Cadence!',
  message: {
    simple: "Surprise! V went to vi instead of I.",
    intermediate: "Deceptive cadence (V→vi) - listener expects I but gets vi.",
    advanced: "V→vi resolution. vi shares 2/3 notes with I, providing continuity."
  },

  // Actions
  learnMore: 'lesson-cadences',
  explorePanel: 'theory',      // Open Theory panel with this highlighted
  deepDive: null               // No deep dive for observations
}
```

#### 2. Suggestions ("You might try...")
Proactively offer specific improvements.

```javascript
{
  type: 'suggestion',
  category: 'voice-leading',
  id: 'try-inversion',
  priority: 70,
  data: {
    chordIndex: 4,
    currentInversion: 0,
    suggestedInversion: 1,
    improvement: 15  // % voice leading improvement
  },

  // Presentation
  emoji: '✨',
  title: 'Smoother Voice Leading?',
  message: {
    simple: "Using 1st inversion here would sound smoother.",
    intermediate: "{{chord}}¹ creates stepwise bass, improving voice leading.",
    advanced: "1st inversion yields {{interval}} bass motion vs {{current}}."
  },

  // Actions
  preview: true,               // [▶ Hear it] button
  apply: true,                 // [Apply] button
  compare: true,               // [Compare] → Opens modal Compare tab
  explorePanel: 'voice-leading',
  deepDive: { tab: 'chord', intent: 'transform' }
}
```

#### 3. Opportunities ("Did you know...")
Point out things the user hasn't tried yet.

```javascript
{
  type: 'opportunity',
  category: 'harmonic-color',
  id: 'no-borrowed-chords',
  priority: 50,
  data: {
    progressionLength: 8,
    suggestions: ['bVII', 'bVI', 'iv']
  },

  // Presentation
  emoji: '🎨',
  title: 'Add Some Color?',
  message: {
    simple: "Your progression is all in-key. Try a borrowed chord for drama!",
    intermediate: "8 chords, all diatonic. Modal interchange adds emotional depth.",
    advanced: "Consider bVII (Mixolydian), bVI (Aeolian), or iv (minor subdominant)."
  },

  // Actions
  preview: false,
  apply: false,
  explorePanel: 'borrowed',    // Open Borrowed Chords panel
  deepDive: { tab: 'chord', intent: 'transform' }
}
```

---

## Coach Item Catalog

### Observations (What Happened)

| ID | Trigger | Priority | Message Example |
|----|---------|----------|-----------------|
| `deceptive-cadence` | V→vi detected | 85 | "Deceptive cadence! The unexpected vi adds emotion." |
| `plagal-cadence` | IV→I detected | 70 | "The 'Amen' cadence - gentle, hymn-like resolution." |
| `perfect-cadence` | V→I detected | 50 | "Perfect authentic cadence - the strongest resolution." |
| `secondary-dominant` | V/x detected | 80 | "Secondary dominant! Temporary tonicization of {{target}}." |
| `borrowed-chord` | bVI/bVII/etc | 85 | "Borrowed from parallel minor - adds drama!" |
| `circle-of-fifths` | 3+ chords descending 5ths | 80 | "Circle of fifths motion - classic smooth progression." |
| `modal-pattern` | Dorian/Mixolydian/etc | 75 | "Dorian i-IV pattern - jazzy, funky flavor!" |
| `chromatic-mediant` | Third-related chords | 70 | "Chromatic mediant! Dramatic color shift." |
| `sequence-pattern` | Repeated transposed pattern | 65 | "Harmonic sequence - repetition with variation." |
| `tension-peak` | Tension score > 80 | 60 | "Maximum tension reached! Perfect climax moment." |
| `smooth-voice-leading` | VL score > 90% for 3+ | 55 | "Beautiful voice leading - your voices flow smoothly." |

### Suggestions (What to Try)

| ID | Trigger | Priority | Message Example |
|----|---------|----------|-----------------|
| `try-inversion` | Root position 4+ times | 70 | "Try {{chord}}¹ for smoother bass motion." |
| `try-borrowed` | 6+ diatonic chords | 65 | "Add color with bVII or bVI here." |
| `fix-parallel-fifths` | Parallel 5ths detected | 80 | "Parallel fifths at M{{n}} - adjust for smoother voice leading?" |
| `fix-voice-crossing` | Voice crossing detected | 75 | "Voices cross at M{{n}} - swap to clarify texture?" |
| `resolve-dominant` | Unresolved V/V7 | 85 | "That V7 wants to go home! Try resolving to I." |
| `try-deceptive` | V→I pattern | 60 | "Instead of I, try vi for a surprise (deceptive cadence)." |
| `add-seventh` | Triads only for 5+ | 55 | "Add 7ths for richness - try V7 or ii7." |
| `try-secondary-dom` | ii before V | 65 | "Try V/V before your V for extra pull." |
| `extend-phrase` | 4-bar phrase | 50 | "Classic 4-bar phrase - extend to 8 for development?" |
| `vary-harmonic-rhythm` | Same duration 6+ | 55 | "Vary chord durations for rhythmic interest." |

### Opportunities (What's Missing)

| ID | Trigger | Priority | Message Example |
|----|---------|----------|-----------------|
| `no-borrowed-chords` | All diatonic, 6+ chords | 50 | "Try borrowing from parallel minor for color." |
| `no-cadence` | No V-I or IV-I, 4+ chords | 55 | "Add a cadence for phrase closure." |
| `no-secondary-dominants` | No V/x, 6+ chords | 45 | "Secondary dominants add harmonic interest." |
| `flat-tension` | Tension variance < 10% | 50 | "Your tension is flat - try building to a climax." |
| `no-contrast` | Same function 60%+ | 45 | "Add harmonic variety - too much tonic/subdominant." |
| `bass-always-root` | Root position 80%+ | 50 | "Inversions create melodic bass lines." |
| `no-extensions` | Triads only, 8+ chords | 40 | "7ths and 9ths add sophistication." |

---

## Presentation Strategies

### Tier 1: Floating Nudges

Small, animated cards that appear and auto-dismiss.

```
┌─────────────────────────────────────────────┐
│ 🎉 Deceptive Cadence!                    ✕ │
│                                             │
│ V→vi instead of the expected V→I.          │
│ This surprise adds emotional depth!         │
│                                             │
│ [Learn More]  [Open Theory Panel →]         │
└─────────────────────────────────────────────┘
```

**Styles by Category:**
- Observations (green border): Celebratory, educational
- Suggestions (amber border): Actionable, preview-able
- Opportunities (purple border): Exploratory, inviting

**Behavior:**
- Appear after 2s of no edits (debounced)
- Auto-hide after 8s (pause on hover)
- Max 2 visible at once
- Stack vertically in top-right

### Tier 2: Panel Integration

Nudges can highlight items in existing panels.

**Theory Panel Enhancement:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ 💡 Theory Insights                                               ✕ │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 🆕 NEW OBSERVATION                                              │ │
│ │ ━━━━━━━━━━━━━━━━━━━━━                                          │ │
│ │ 🎉 Deceptive Cadence detected at M3-M4!                        │ │
│ │    V → vi creates surprise resolution                          │ │
│ │    [▶ Hear it]  [Why This Works →]                             │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ 🔍 Detected Patterns                                                │
│ ├─ Deceptive Cadence (M3-M4) ← highlighted                         │
│ ├─ Circle of Fifths (M1-M4)                                        │
│ └─ Borrowed bVII (M7)                                              │
│                                                                     │
│ 💡 Suggestions                                                      │
│ ├─ ✨ Try inversion at M5 [▶] [Apply]                              │
│ └─ 🎨 Add borrowed chord at M8 [Explore →]                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Borrowed Chords Panel Enhancement:**
```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔄 Borrowed Chords                                               ✕ │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ 💡 SUGGESTED FOR YOUR PROGRESSION                               │ │
│ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                                │ │
│ │ Based on your I-V-vi-IV pattern, these would add color:        │ │
│ │                                                                 │ │
│ │ [bVII ★]  [bVI]  [iv]                                          │ │
│ │  ↑ Best fit for rock/pop feel                                  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│ All Borrowed Chords:                                                │
│ [i] [bVII] [bVI] [bIII] [iv] [bII] [bVII7] [iv7] ...              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Tier 3: Modal Deep Links

Nudges can open the Unified Recommendation Modal at the right tab/intent.

```javascript
// Suggestion nudge action
deepDive: {
  tab: 'chord',
  intent: 'transform',      // Opens Chord > Transform
  preselect: {
    chordIndex: 4,
    transformType: 'inversion'
  }
}

// Opens modal with context pre-loaded
openUnifiedRecommendationModal({
  initialTab: 'chord',
  initialIntent: 'transform',
  context: { chordIndex: 4, transformType: 'inversion' }
});
```

---

## Implementation Plan

### Phase 1: Coach Engine Foundation (3-4 days)

**Create core infrastructure:**

```
src/modules/teaching/
├── coachEngine/
│   ├── index.js              # Main engine, event listeners
│   ├── observationDetectors.js   # Adapters for existing detectors
│   ├── suggestionGenerators.js   # Generate actionable suggestions
│   ├── opportunityScanners.js    # Scan for missing patterns
│   ├── priorityQueue.js          # Score, cooldown, preferences
│   ├── coachItemTypes.js         # Type definitions
│   └── coachPresenter.js         # Presentation routing
```

**Key tasks:**
1. Create Coach Engine class with event listeners
2. Create adapters for existing detectors (patternDetection, harmonyAnalyzer, etc.)
3. Implement priority queue with cooldown and user preferences
4. Create floating nudge presenter

### Phase 2: Suggestion System (3-4 days)

**Build suggestion generators:**

```javascript
// suggestionGenerators.js

export function generateSuggestions(context) {
  const suggestions = [];

  // Voice leading improvements
  suggestions.push(...checkInversionOpportunities(context));
  suggestions.push(...checkParallelMotionFixes(context));

  // Harmonic enrichment
  suggestions.push(...checkBorrowedChordOpportunities(context));
  suggestions.push(...checkSecondaryDominantOpportunities(context));
  suggestions.push(...checkExtensionOpportunities(context));

  // Structural suggestions
  suggestions.push(...checkCadenceOpportunities(context));
  suggestions.push(...checkPhraseExtensions(context));

  return suggestions;
}
```

**Key tasks:**
1. Implement suggestion generators for each category
2. Add [▶ Hear it] preview functionality
3. Add [Apply] one-click application
4. Create suggestion-specific nudge styles

### Phase 3: Panel Integration (2-3 days)

**Enhance existing panels:**

1. Add "Coach Highlights" section to Theory Panel
2. Add "Suggested for You" section to Borrowed Chords Panel
3. Add suggestion actions to Voice Leading Panel
4. Create bidirectional links (nudge → panel, panel → modal)

### Phase 4: Modal Deep Links (2-3 days)

**Connect to Unified Recommendation Modal:**

1. Add context parameter support to `showUnifiedRecommendationModal()`
2. Implement pre-selection of tab/intent/chord
3. Add "Open in Modal" actions to nudges
4. Create smooth transition animations

### Phase 5: Polish & Preferences (2-3 days)

1. User preference persistence (which nudge types to show)
2. Skill level integration (simple/intermediate/advanced messages)
3. Animation and visual polish
4. A/B testing setup for presentation styles

---

## File Structure

```
src/modules/teaching/
├── coachEngine/
│   ├── index.js                    # CoachEngine class
│   ├── types.js                    # TypeScript-style type definitions
│   ├── detectors/
│   │   ├── cadenceDetector.js      # Wraps patternDetection
│   │   ├── borrowedChordDetector.js
│   │   ├── voiceLeadingDetector.js
│   │   ├── sequenceDetector.js
│   │   └── tensionDetector.js
│   ├── generators/
│   │   ├── inversionSuggestions.js
│   │   ├── borrowedChordSuggestions.js
│   │   ├── voiceLeadingFixes.js
│   │   ├── cadenceSuggestions.js
│   │   └── enrichmentSuggestions.js
│   ├── scanners/
│   │   ├── missingPatternScanner.js
│   │   ├── varietyScanner.js
│   │   └── tensionArcScanner.js
│   ├── priority/
│   │   ├── priorityQueue.js
│   │   ├── cooldownManager.js
│   │   └── userPreferences.js
│   └── presentation/
│       ├── floatingNudge.js
│       ├── panelHighlight.js
│       ├── modalDeepLink.js
│       └── nudgeStyles.css
├── theoryMoments.js               # (existing - could migrate to coachEngine)
├── whyThisWorksEnhanced.js        # (existing - used by nudges)
└── compositionInsights.js         # (existing - could integrate)
```

---

## Integration Points

### With Existing Detectors

```javascript
// coachEngine/detectors/cadenceDetector.js

import { detectAllPatterns, CADENCE_PATTERNS } from '../../analysis/patternDetection.js';

export function detectCadences(context) {
  const { progression, key } = context;
  const patterns = detectAllPatterns(progression, key);

  return patterns.cadences.map(cadence => ({
    type: 'observation',
    category: 'cadence',
    id: cadence.type.toLowerCase().replace(' ', '-'),
    priority: CADENCE_PRIORITIES[cadence.type] || 60,
    data: {
      cadenceType: cadence.type,
      from: cadence.chords[0],
      to: cadence.chords[1],
      measureIndex: cadence.positions[0]
    }
  }));
}
```

### With Existing Panels

```javascript
// In FullScreenBottomPanel.js _renderTheoryPanel()

import { getCoachHighlights } from '../teaching/coachEngine/index.js';

// Add to _generateTheoryInsights()
const highlights = getCoachHighlights('theory-panel');
if (highlights.length > 0) {
  html = `
    <div class="coach-highlights bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-2 mb-2">
      <div class="flex items-center gap-1.5 mb-1">
        <span class="text-sm">🎯</span>
        <span class="font-semibold text-green-800 text-xs">Just Now</span>
      </div>
      ${highlights.map(h => renderCoachHighlight(h)).join('')}
    </div>
  ` + html;
}
```

### With Unified Recommendation Modal

```javascript
// In UnifiedRecommendationModal/index.js

export function showUnifiedRecommendationModal(options = {}) {
  const {
    initialTab,
    initialIntent,
    context,      // NEW: Pre-selection context
    highlightItem // NEW: Item to highlight
  } = options;

  // ... existing code ...

  if (initialTab) {
    modalState.activeTab = initialTab;
  }
  if (initialIntent && initialTab === 'chord') {
    modalState.chordIntent = initialIntent;
  }
  if (context) {
    applyDeepLinkContext(context);
  }
}
```

---

## Success Metrics

### Engagement
- Nudge click-through rate (target: >20%)
- Panel open rate after nudge (target: >30%)
- Modal open rate after nudge (target: >15%)
- [Apply] button usage (target: >10% of suggestions)

### Learning
- Theory lesson starts from nudges
- Skill level upgrades over time
- Variety of patterns used by user
- Voice leading score improvement

### Composition Quality
- Voice leading scores trending up
- Harmonic vocabulary expansion
- Use of borrowed chords, secondary dominants
- Tension arc variety

---

## Summary

The Unified Coach System creates a **seamless gradient from passive to active learning**:

1. **Tier 1 (Nudges):** Lightweight, automatic, educational
2. **Tier 2 (Panels):** Curated exploration, preview, quick apply
3. **Tier 3 (Modal):** Full control, deep customization

By **leveraging existing detection and recommendation engines**, we avoid rebuilding infrastructure and focus on **surfacing the right information at the right time**.

The key insight: **Users don't need AI—they need the existing analysis surfaced proactively and connected to actionable next steps.**
