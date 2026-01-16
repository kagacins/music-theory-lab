# Composition Coach: Unified Theory Integration Proposal

**Date:** 2026-01-16
**Status:** Proposal
**Goal:** Help users understand why their specific composition sounds the way it does, and what specific changes would make it sound better.

---

## Executive Summary

Music Theory Lab has excellent foundational teaching systems that currently operate somewhat independently. This proposal outlines how to tie these systems together into a unified "Composition Coach" experience that provides personalized, contextual music theory education directly integrated into the composition workflow.

**The Core Question We're Solving:**
*"I've created a composition with bass and treble clef populated, but I don't understand what makes it sound good or how to make it sound better using music theory."*

---

## Current State Analysis

### Existing Teaching Features

| Feature | Location | What It Does |
|---------|----------|--------------|
| **Theory Moments** | `src/modules/teaching/theoryMoments.js` | Auto-popups when using borrowed chords, cadences |
| **Why This Works** | `src/modules/teaching/whyThisWorksEnhanced.js` | Explains individual chord recommendations |
| **Voice Leading Diagrams** | `src/modules/notation/voiceLeadingOverlay.js` | Shows connection quality between chords |
| **Theory Insights Panel** | `src/modules/ui/theoryInsightsPanel.js` | Real-time pattern detection (cadences, modes) |
| **Composition Insights** | `src/modules/teaching/compositionInsights.js` | Tracks user patterns over time |
| **Interactive Lessons** | `src/modules/ui/lessonViewer.js` | Structured learning paths |
| **Unified Recommendations** | `src/modules/ui/recommendations/UnifiedRecommendationModal/` | Multi-tab suggestion system |

### The Gap

These features operate independently. A user with a completed composition doesn't get a unified experience that says:

> "Here's what's happening harmonically in YOUR piece, here's why it sounds the way it does, and here's how to improve it."

---

## Proposed Enhancements

### Organized by Complexity Level

The following features are designed to meet users where they are, from beginners who read music but don't understand theory, to advanced users seeking sophisticated analysis.

---

## Level 1: Beginner-Friendly Insights

### 1.1 "Musical Story" Narrator

**Concept:** Instead of technical terms, describe the composition's emotional journey in plain language.

**Example Output:**
```
Your Composition's Story
━━━━━━━━━━━━━━━━━━━━━━━━

Measures 1-4: "Home" (I-IV-V-I)
  → You start strong and resolved, like beginning a chapter

Measures 5-8: "Adventure" (vi-IV-I-V)
  → A softer, more questioning section - nice contrast!

Measures 9-12: "Surprise!" (bVI-bVII-I)
  → Dramatic borrowed chords! This is your "wow" moment

🎭 Overall Mood: Hopeful journey with a triumphant ending
```

**Implementation Approach:**
- Analyze chord segments and map Roman numerals to narrative beats
- Detect emotional arc (tension building, release, surprise)
- Use the existing `patternDetection.js` for cadence/borrowed chord detection
- Create a narrative template system with story archetypes

**Files to Create/Modify:**
- Create: `src/modules/teaching/musicalStoryNarrator.js`
- Modify: `src/modules/ui/theoryInsightsPanel.js` (add story view)

---

### 1.2 "Ear Training Mode" - Hear the Theory

**Concept:** Play the progression with audio annotations that explain what's happening.

**Features:**
- Voice narration: "This is your home chord" on the I
- Voice narration: "This wants to go home" on the V
- Voice narration: "Surprise! Borrowed from minor" on bVI
- Optional: Highlight the chord card/notation as each plays

**Implementation Approach:**
- Use Web Speech API (`speechSynthesis`) for narration
- Extend existing `audioEngine.js` playback with queued speech events
- Create annotation templates for each chord function

**Files to Create/Modify:**
- Create: `src/modules/audio/narratedPlayback.js`
- Modify: `src/modules/audio/melodyGenerator.js` (add narration hooks)

---

### 1.3 Color-Coded Harmonic Map

**Concept:** Subtly color the background behind measures based on harmonic function.

**Color Scheme:**
| Color | Function | Chords |
|-------|----------|--------|
| 🟢 Green | Stable/Tonic | I, vi, iii |
| 🟡 Yellow | Moving/Subdominant | IV, ii |
| 🔴 Red | Tension/Dominant | V, V7, vii° |
| 🟣 Purple | Colorful/Chromatic | bVI, bVII, secondary dominants |

**Implementation Approach:**
- Add optional overlay layer to VexFlow rendering
- Map chord Roman numerals to function categories
- Use semi-transparent backgrounds that don't interfere with notation

**Files to Create/Modify:**
- Create: `src/modules/notation/harmonicColorOverlay.js`
- Modify: `src/modules/notation/grandStaff.js` (add overlay rendering)

---

## Level 2: Intermediate "Why Does This Work?" Integration

### 2.1 Unified Composition Analysis Panel

**Concept:** A persistent side panel in Composition Studio that ties together all analysis features.

**Example Layout:**
```
┌─────────────────────────────────────┐
│ 📊 YOUR COMPOSITION ANALYSIS        │
├─────────────────────────────────────┤
│ Key: C Major                        │
│ Length: 12 measures                 │
│ Harmonic Rhythm: 1 chord/measure    │
│ Voice Leading Score: 87% (Good!)    │
│                                     │
│ 🎵 KEY MOMENTS:                     │
│  • M4: Perfect Cadence (V→I) ✓      │
│  • M7: Borrowed bVI - dramatic!     │
│  • M9: Voice crossing detected ⚠️    │
│                                     │
│ 💡 SUGGESTIONS:                     │
│  [Try vi instead of IV at M3]       │
│  [Add passing tone at M5 beat 2]    │
│  [Smooth voice leading at M9]       │
│                                     │
│ 🎓 LEARN MORE:                      │
│  [Why borrowed chords work]         │
│  [Voice leading basics]             │
│  [Cadence types explained]          │
└─────────────────────────────────────┘
```

**What It Unifies:**
- Theory Insights Panel → Key Moments section
- Voice Leading Overlay → Voice Leading Score + warnings
- Recommendation engines → Suggestions section
- Lesson system → Learn More links

**Implementation Approach:**
- Create new panel component for Full Screen mode
- Aggregate data from existing analysis modules
- Clickable suggestions that highlight relevant measures
- Deep links to existing lesson system

**Files to Create/Modify:**
- Create: `src/modules/notation/fullScreen/CompositionCoachPanel.js`
- Modify: `src/modules/notation/fullScreen/FullScreenBottomPanel.js` (add tab)

---

### 2.2 "Before/After" Comparison Player

**Concept:** When suggesting a change, let users hear both versions.

**Features:**
1. **Your version** - Current composition
2. **Suggested version** - With one specific change applied
3. **Side-by-side** - Alternating measures for direct comparison
4. **Visual diff** - Highlight what changed in the notation

**Example UI:**
```
┌────────────────────────────────────────────┐
│ SUGGESTION: Replace IV with ii at M3       │
├────────────────────────────────────────────┤
│ Why: The ii chord has smoother voice       │
│ leading to V (shared note D)               │
│                                            │
│ [▶ Your Version]  [▶ Suggested]  [▶ A/B]  │
│                                            │
│ ┌──────────┐      ┌──────────┐            │
│ │ M3: F    │  →   │ M3: Dm   │            │
│ │ (IV)     │      │ (ii)     │            │
│ └──────────┘      └──────────┘            │
│                                            │
│ [Apply Change]  [Dismiss]                  │
└────────────────────────────────────────────┘
```

**Implementation Approach:**
- Extend existing audio comparison in `whyThisWorksEnhanced.js`
- Create temporary modified progression for playback
- Add visual diff highlighting to notation

**Files to Create/Modify:**
- Create: `src/modules/teaching/beforeAfterComparison.js`
- Modify: `src/modules/teaching/whyThisWorksEnhanced.js` (integrate)

---

### 2.3 Harmonic Rhythm Analysis

**Concept:** Detect and teach about the pacing of chord changes.

**Analysis Output:**
```
HARMONIC RHYTHM ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━

Overall: 1.2 chords per measure (moderate)

M1-M4:  ♩ ♩ ♩ ♩  (1 chord/measure - steady)
M5-M6:  ♩♩ ♩♩    (2 chords/measure - accelerating!)
M7-M8:  ♩ ♩      (1 chord/measure - breathing room)

💡 Insights:
• Your harmonic rhythm speeds up approaching M6 -
  this creates forward momentum! Great instinct.

• Consider slowing down at M7-M8 even more to
  create contrast before the final cadence.

• The acceleration → deceleration pattern is
  common in classical phrase structure.
```

**Implementation Approach:**
- Calculate chord density per measure
- Detect acceleration/deceleration patterns
- Compare to common phrase structures
- Generate contextual suggestions

**Files to Create/Modify:**
- Create: `src/modules/analysis/harmonicRhythmAnalyzer.js`
- Modify: `src/modules/ui/theoryInsightsPanel.js` (add rhythm section)

---

## Level 3: Advanced Compositional Techniques

### 3.1 Voice-Specific Recommendations

**Concept:** Analyze bass and treble lines independently with specific suggestions.

**Example Output:**
```
BASS LINE ANALYSIS
━━━━━━━━━━━━━━━━━━
Motion Type: 60% root position, 25% stepwise, 15% leaps

✓ Strong: Root motion by 5ths (M1-M4) - classic!
✓ Strong: Stepwise bass at M5-M6 creates momentum

⚠ Consider: Your bass jumps an octave at M7
   → Try stepwise motion for smoother connection

💡 Suggestion: Add passing tone E between F and D
   [▶ Hear it] [Apply]


MELODY ANALYSIS
━━━━━━━━━━━━━━━
Chord Tone Usage: 75% on strong beats (good!)
Range: C4 to G5 (comfortable singable range)

✓ Strong: Melody uses chord tones on downbeats
✓ Strong: Nice arch shape in M1-M4

⚠ Consider: M6 has 3 consecutive non-chord tones
   → Intentional tension, or needs resolution?

💡 Suggestion: The F at M6 beat 3 could resolve
   down to E (chord tone of C major)
   [▶ Hear it] [Apply]
```

**Implementation Approach:**
- Extend `chordToneAnalyzer.js` for per-voice analysis
- Detect bass motion patterns (root, stepwise, leaps)
- Analyze melody contour and chord tone alignment
- Generate voice-specific suggestions

**Files to Create/Modify:**
- Create: `src/modules/analysis/voiceAnalyzer.js`
- Modify: `src/modules/analysis/chordToneAnalyzer.js` (extend)

---

### 3.2 Counterpoint Analysis (Bass + Treble)

**Concept:** Since users have BOTH clefs populated, analyze the relationship between voices.

**Example Output:**
```
COUNTERPOINT ANALYSIS
━━━━━━━━━━━━━━━━━━━━━

Voice Independence Score: 85%

Motion Types Detected:
┌─────────┬──────────┬─────────────────────────┐
│ Measure │ Motion   │ Notes                   │
├─────────┼──────────┼─────────────────────────┤
│ M1      │ Contrary │ Bass ↓, Melody ↑ ✓      │
│ M2      │ Parallel │ ⚠ Parallel 5ths        │
│ M3      │ Oblique  │ Bass holds, melody moves│
│ M4      │ Contrary │ Good voice independence │
│ M5      │ Similar  │ Both move same direction│
└─────────┴──────────┴─────────────────────────┘

⚠ WARNINGS:
• M2: Parallel 5ths detected (A→E in bass, E→B in melody)
  → Common in pop/rock, avoided in classical style
  [Learn why parallel 5ths matter →]

• M7: Voice crossing (melody goes below bass briefly)
  → Can muddy the texture
  [See how to fix →]

💡 STRENGTHS:
• Good use of contrary motion (60% of transitions)
• Voices maintain distinct registers most of the time
• Nice rhythmic independence at M5-M6
```

**Implementation Approach:**
- Analyze vertical intervals between bass and treble
- Detect motion types (parallel, contrary, oblique, similar)
- Flag classical counterpoint "errors" with style context
- Calculate voice independence metrics

**Files to Create/Modify:**
- Create: `src/modules/analysis/counterpointAnalyzer.js`
- Modify: `src/modules/notation/voiceLeadingOverlay.js` (integrate)

---

### 3.3 "Theory DNA" Fingerprint

**Concept:** Show what makes THIS composition stylistically unique.

**Example Output:**
```
YOUR COMPOSITION'S THEORY DNA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HARMONIC VOCABULARY
[████████░░] 80% Diatonic (stays in key)
[███░░░░░░░] 30% Modal Interchange (some color)
[█░░░░░░░░░] 10% Secondary Dominants

CHORD MOTION
[█████░░░░░] 50% Circle of 5ths
[████░░░░░░] 40% Stepwise root motion
[█░░░░░░░░░] 10% Third relations

VOICE LEADING
[███████░░░] 70% Smooth (stepwise)
[██░░░░░░░░] 20% Common tones
[█░░░░░░░░░] 10% Leaps

TEXTURE
[██████░░░░] 60% Homophonic
[████░░░░░░] 40% Independent voices

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎵 STYLE MATCH: Pop Ballad (78% similarity)
   Similar artists: Adele, Sam Smith, Coldplay

🎯 MISSING INGREDIENT:
   You haven't used a deceptive cadence yet!
   → Adds emotional surprise
   [Try adding one →]

📈 COMPARED TO YOUR HISTORY:
   • More diatonic than usual (+15%)
   • Less chromatic than your average (-20%)
   • Similar voice leading quality
```

**Implementation Approach:**
- Aggregate metrics from multiple analyzers
- Create style fingerprint database for comparison
- Track user's historical patterns for personalized comparison
- Suggest "missing" techniques they haven't tried

**Files to Create/Modify:**
- Create: `src/modules/analysis/theoryDNAProfiler.js`
- Modify: `src/modules/teaching/compositionInsights.js` (integrate)

---

### 3.4 "What If?" Sandbox

**Concept:** Non-destructive experimentation with style variations.

**Example UI:**
```
┌────────────────────────────────────────────┐
│ 🧪 "WHAT IF?" VARIATIONS                   │
├────────────────────────────────────────────┤
│ Based on your progression, try these:      │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ VARIATION 1: "Jazzier"                 │ │
│ │ Changes:                               │ │
│ │  • IV → ii7 (adds 7th, softer prep)   │ │
│ │  • V → V7 (stronger pull to I)        │ │
│ │  • Add 9th to final I chord           │ │
│ │                                        │ │
│ │ [▶ Play Original] [▶ Play Jazzier]    │ │
│ │ [Apply to Score] [Dismiss]             │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ VARIATION 2: "More Dramatic"           │ │
│ │ Changes:                               │ │
│ │  • Insert bVI before final cadence    │ │
│ │  • Change V to V7 for stronger ending │ │
│ │                                        │ │
│ │ [▶ Play Original] [▶ Play Dramatic]   │ │
│ │ [Apply to Score] [Dismiss]             │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ VARIATION 3: "Smoother Voice Leading"  │ │
│ │ Changes:                               │ │
│ │  • I → I (root) stays same            │ │
│ │  • IV → IV¹ (1st inversion)           │ │
│ │  • V → V (root) stays same            │ │
│ │                                        │ │
│ │ Voice Leading: 87% → 94% (+7%)        │ │
│ │                                        │ │
│ │ [▶ Play Original] [▶ Play Smoother]   │ │
│ │ [Apply to Score] [Dismiss]             │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ [Generate More Variations]                 │
└────────────────────────────────────────────┘
```

**Implementation Approach:**
- Create variation generators for different styles
- Use existing recommendation engines to generate alternatives
- Implement non-destructive preview (temporary progression copy)
- One-click apply with undo support

**Files to Create/Modify:**
- Create: `src/modules/features/whatIfSandbox.js`
- Create: `src/modules/features/variationGenerators.js`

---

## Cross-Cutting Features

### 4.1 Personalized Learning Path Based on Composition

**Concept:** Suggest lessons based on what the user just composed.

**Example:**
```
PERSONALIZED LEARNING PATH
━━━━━━━━━━━━━━━━━━━━━━━━━━
Based on your composition:

1. "Borrowed Chords Deep Dive"
   You used bVI - learn more ways to use it!
   [Start Lesson →]

2. "Voice Leading in Pop Music"
   Your score: 87% - learn to reach 95%+
   [Improve Your Score →]

3. "Deceptive Cadences"
   You haven't tried one yet - add surprise!
   [Learn This Technique →]

4. "The ii-V-I Progression"
   Based on your I-IV-V-I, try this jazzier version
   [Explore Jazz Harmony →]
```

**Implementation Approach:**
- Analyze composition for techniques used/not used
- Map techniques to existing lesson library
- Prioritize based on what would most improve the current piece
- Track which suggestions lead to lesson completion

**Files to Create/Modify:**
- Modify: `src/modules/teaching/compositionInsights.js`
- Modify: `src/modules/ui/lessonViewer.js` (add "from composition" entry)

---

### 4.2 "Explain Like I'm..." Toggle (Skill Level Switcher)

**Concept:** Allow real-time switching between explanation depths on ANY theory popup.

**Example:**
```
┌─────────────────────────────────────────────┐
│ [ELI5] [Intermediate] [Music Major]         │
├─────────────────────────────────────────────┤
│                                             │
│ ELI5:                                       │
│ "This chord is borrowed from the sad        │
│ version of your key - it adds drama!"       │
│                                             │
│ ─────────────────────────────────────────── │
│                                             │
│ Intermediate:                               │
│ "The bVI is borrowed from the parallel      │
│ minor key, creating modal interchange.      │
│ It often leads to bVII or back to I."       │
│                                             │
│ ─────────────────────────────────────────── │
│                                             │
│ Music Major:                                │
│ "Modal interchange via bVI creates          │
│ chromatic voice leading (♭6→5 in soprano)   │
│ while maintaining tonic function through    │
│ shared scale degree 1. The cross-relation   │
│ between ♮6 and ♭6 is typically avoided      │
│ by contrary motion in the outer voices."    │
│                                             │
└─────────────────────────────────────────────┘
```

**Implementation Approach:**
- Already have skill levels in `theoryMomentsConfig.js`
- Create unified level switcher component
- Persist user's preferred level in localStorage
- Apply across all theory explanations

**Files to Create/Modify:**
- Create: `src/modules/ui/skillLevelSwitcher.js`
- Modify: Multiple teaching modules to use shared component

---

### 4.3 Real-Time "Theory Feed"

**Concept:** As users compose, show a live feed of what's happening theoretically.

**Example:**
```
LIVE THEORY FEED
━━━━━━━━━━━━━━━━
[Now] 🎵 You just created a I-V-vi-IV!
      "The most popular progression in pop music"
      [Hear famous examples →]

[30s] 🎵 That E in the melody is a "passing tone"
      Non-chord tone connecting D to F
      [Learn about non-chord tones →]

[1m]  🎵 Your bass is doing "root position walking"
      Stepwise motion creates forward momentum
      [Explore bass patterns →]

[2m]  🎵 Cadence detected: Half Cadence (ends on V)
      This creates expectation - nice cliffhanger!
      [Learn about cadence types →]
```

**Implementation Approach:**
- Listen to composition change events
- Queue theory observations with timestamps
- Limit feed to avoid overwhelming user
- Make items clickable for deeper learning

**Files to Create/Modify:**
- Create: `src/modules/teaching/theoryFeed.js`
- Modify: Event listeners in composition modules

---

## Implementation Priority Matrix

### Quick Wins (High Impact, Lower Effort)

| Feature | Effort | Impact | Dependencies |
|---------|--------|--------|--------------|
| Unified Analysis Panel | Medium | High | Aggregates existing modules |
| Color-Coded Harmonic Map | Low | Medium | VexFlow overlay |
| Skill Level Switcher | Low | High | Extends existing system |
| Personalized Learning Path | Low | High | Links existing lessons |

### Medium Effort, High Value

| Feature | Effort | Impact | Dependencies |
|---------|--------|--------|--------------|
| Counterpoint Analysis | Medium | High | New analyzer needed |
| Before/After Comparison | Medium | High | Extends audio system |
| Voice-Specific Recommendations | Medium | High | Extends analyzers |
| Harmonic Rhythm Analysis | Medium | Medium | New analyzer needed |

### Ambitious but Transformative

| Feature | Effort | Impact | Dependencies |
|---------|--------|--------|--------------|
| "What If?" Sandbox | High | Very High | Variation generators |
| Musical Story Narrator | High | High | NLP-style templates |
| Theory DNA Fingerprint | High | High | Multiple analyzers |
| Ear Training Mode | High | Medium | Speech synthesis |
| Real-Time Theory Feed | Medium | Medium | Event system |

---

## Recommended Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
1. **Unified Composition Analysis Panel** - Central hub for all insights
2. **Skill Level Switcher** - Consistent experience across features
3. **Color-Coded Harmonic Map** - Visual learning aid

### Phase 2: Deep Analysis (Weeks 3-4)
4. **Counterpoint Analysis** - Unique value for bass+treble compositions
5. **Voice-Specific Recommendations** - Beyond chord-only suggestions
6. **Harmonic Rhythm Analysis** - Pacing awareness

### Phase 3: Interactive Learning (Weeks 5-6)
7. **Before/After Comparison Player** - Hear the difference
8. **Personalized Learning Path** - Contextual lesson suggestions
9. **Theory DNA Fingerprint** - Gamified self-awareness

### Phase 4: Advanced Features (Weeks 7-8)
10. **"What If?" Sandbox** - Non-destructive experimentation
11. **Musical Story Narrator** - Beginner-friendly narratives
12. **Real-Time Theory Feed** - Live composition awareness

---

## Technical Architecture Notes

### Data Flow
```
User Composition
       │
       ▼
┌─────────────────────────────────────────────────────┐
│              ANALYSIS LAYER                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Pattern     │ │ Voice       │ │ Counterpoint│   │
│  │ Detection   │ │ Analyzer    │ │ Analyzer    │   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Harmonic    │ │ Theory DNA  │ │ Chord Tone  │   │
│  │ Rhythm      │ │ Profiler    │ │ Analyzer    │   │
│  └─────────────┘ └─────────────┘ └─────────────┘   │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│           AGGREGATION LAYER                          │
│  ┌─────────────────────────────────────────────┐    │
│  │     Composition Coach Aggregator            │    │
│  │     (Unifies all analysis results)          │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│              PRESENTATION LAYER                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Analysis │ │ Theory   │ │ Learning │            │
│  │ Panel    │ │ Feed     │ │ Path     │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ What-If  │ │ Story    │ │ DNA      │            │
│  │ Sandbox  │ │ Narrator │ │ Profile  │            │
│  └──────────┘ └──────────┘ └──────────┘            │
└─────────────────────────────────────────────────────┘
```

### Key Integration Points

1. **compositionState.js** - Source of truth for composition data
2. **Event System** - `progressionUpdated`, `noteEdited`, etc.
3. **Full Screen Mode** - Primary UI integration point
4. **Lesson System** - Deep links for "Learn More"

---

## Success Metrics

### User Engagement
- Time spent in Composition Studio
- Theory popup interactions (clicks on "Learn More")
- Lesson completion rate from composition context
- Feature discovery rate (which Coach features get used)

### Learning Outcomes
- Voice leading score improvement over time
- Diversity of techniques used (borrowed chords, cadences, etc.)
- Progression from "simple" to "intermediate" explanations
- Reduction in counterpoint warnings per composition

### Composition Quality
- Average voice leading scores trending upward
- Variety in harmonic vocabulary
- Use of advanced techniques (secondary dominants, modal interchange)

---

## Appendix: Existing Code References

### Analysis Modules
- `src/modules/analysis/patternDetection.js` - Cadences, modes, borrowed chords
- `src/modules/analysis/harmonyAnalyzer.js` - Harmonic analysis
- `src/modules/analysis/chordToneAnalyzer.js` - Note-chord relationships

### Teaching Modules
- `src/modules/teaching/theoryMoments.js` - Contextual popups
- `src/modules/teaching/theoryMomentsConfig.js` - Popup content
- `src/modules/teaching/whyThisWorksEnhanced.js` - Recommendation explanations
- `src/modules/teaching/compositionInsights.js` - User pattern tracking

### UI Modules
- `src/modules/ui/theoryInsightsPanel.js` - Pattern display
- `src/modules/ui/lessonViewer.js` - Interactive lessons
- `src/modules/notation/voiceLeadingOverlay.js` - Voice leading visualization

### Data
- `src/data/theoryExplanations/chordFunctions.js` - Chord explanations
- `src/data/theoryExplanations/concepts.js` - Theory concepts
- `src/data/theoryExplanations/lessons/` - Lesson content

---

## Conclusion

Music Theory Lab already has the building blocks for an exceptional theory-integrated composition experience. This proposal focuses on **unifying and contextualizing** these existing features around the user's specific composition, creating a "Composition Coach" that provides personalized, actionable music theory education at the moment of composition.

The key insight is: **Don't just teach theory in the abstract - show users what's happening in THEIR music and how to make it better.**
