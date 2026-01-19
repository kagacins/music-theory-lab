# Educational Enhancement Roadmap
## Deepening Theory Integration Without Overwhelming Users

**Created:** January 2026
**Version:** 1.0
**Goal:** Layer educational features thoughtfully to enhance learning without cluttering the interface

---

## Table of Contents

1. [The Core Challenge](#the-core-challenge)
2. [Progressive Disclosure Framework](#progressive-disclosure-framework)
3. [Feature Proposals](#feature-proposals)
4. [UI Strategy: Modes & Personas](#ui-strategy-modes--personas)
5. [Implementation Phases](#implementation-phases)
6. [Integration with Existing Systems](#integration-with-existing-systems)

---

## The Core Challenge

Music Theory Lab already has extensive educational features:
- Coach Engine with 32+ pattern detections
- Multi-level explanations (Simple/Intermediate/Advanced)
- Theory Moments for discovery celebrations
- Dock panels for deep exploration
- Tooltips throughout the interface

**The problem isn't missing features - it's discoverability and cognitive load.**

Adding more tooltips, buttons, and panels risks:
- Information overload for beginners
- Distraction for experienced users who want to compose
- "Feature blindness" where users stop noticing helpful elements
- Cluttered UI that feels intimidating

**The solution: A thoughtful information architecture that reveals depth progressively.**

---

## Progressive Disclosure Framework

### The Three Layers Principle

Every educational feature should exist at one of three layers:

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER 1: AMBIENT                                                │
│ Always visible, never intrusive                                 │
│ Examples: Tension curve, function colors, subtle highlights     │
│ User effort: None (passive awareness)                           │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 2: ON-DEMAND                                              │
│ Revealed by simple interaction (hover, tap, click)              │
│ Examples: Chord tooltips, quick comparisons, "What If?" panel   │
│ User effort: Minimal (curiosity-driven)                         │
├─────────────────────────────────────────────────────────────────┤
│ LAYER 3: DEEP DIVE                                              │
│ Requires intentional navigation (open modal, panel, tab)        │
│ Examples: Full explanations, recommendation modal, theory panel │
│ User effort: Intentional (learning-focused)                     │
└─────────────────────────────────────────────────────────────────┘
```

### Information Density Modes

Rather than showing everything always, implement **Experience Modes** that control information density site-wide:

| Mode | Target User | Information Density | Features Visible |
|------|-------------|---------------------|------------------|
| **Focus** | Experienced composers | Minimal | Just composition tools, no education |
| **Guided** | Active learners | Moderate | Tooltips, suggestions, Theory Moments |
| **Explore** | Curious beginners | Rich | All educational features, proactive hints |

**Implementation:**
- Single toggle in header: `Focus ← → Explore` slider
- Persisted to localStorage
- Affects ALL educational surfaces consistently
- Default: Guided (middle ground)

---

## Feature Proposals

### Category A: Ambient Features (Always Visible, Never Intrusive)

These features provide information through **visual design** without requiring interaction.

---

#### A1. Tension Curve Visualization

**What:** A subtle line graph showing harmonic tension across the progression, displayed as a thin strip below or above the chord cards.

**Why:** Gives users insight into the emotional shape of their piece at a glance.

**Visual Design:**
```
Tension:  ╭──╮        ╭──────╮
         ╱    ╲      ╱        ╲
────────╱      ╲────╱          ╲────
        C    Am    F    G    C    Am    G    C
        ▼    ▼     ▼    ▼    ▼    ▼     ▼    ▼
       Low  Med   Med  High  Low  Med  High  Low
```

**Implementation:**
- Use existing tension analysis from coach engine
- Render as SVG path below progression cards
- Height: 24px, subtle gradient (blue→orange→red for low→high)
- Only visible in Guided/Explore modes
- Click any point to get explanation of why tension is high/low there

**Layer:** 1 (Ambient)
**Effort:** Low (data already computed)
**Files to modify:**
- `src/modules/features/progressionBuilder/index.js` - Add tension strip component
- `src/modules/teaching/coachEngine/detectors/` - Expose tension scores per chord

---

#### A2. Function Color Coding (Enhanced)

**What:** Subtle background tint on chord cards indicating harmonic function.

**Current State:** Theory Overlay exists but may be too subtle or not always on.

**Enhancement:**
- Make it a core feature (not just an overlay)
- Use very subtle pastel backgrounds that don't interfere with readability
- Add tiny legend icon that expands on hover

**Color Scheme:**
| Function | Color | Hex | Opacity |
|----------|-------|-----|---------|
| Tonic (I, vi) | Sage Green | #86efac | 15% |
| Subdominant (IV, ii) | Sky Blue | #7dd3fc | 15% |
| Dominant (V, vii°) | Warm Amber | #fcd34d | 15% |
| Borrowed | Lavender | #c4b5fd | 15% |
| Secondary Dom | Coral | #fca5a5 | 15% |

**Layer:** 1 (Ambient)
**Effort:** Low (enhance existing)
**Files to modify:**
- `src/modules/features/progressionBuilder/` - Chord card rendering
- `src/styles/music.css` - Function color classes

---

#### A3. Bass Line Motion Indicator

**What:** Small arrows between chord cards showing bass movement direction and distance.

**Visual:**
```
┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐
│  C  │ → │ Am  │ ↓ │  F  │ ← │  G  │
│  I  │   │ vi  │   │ IV  │   │  V  │
└─────┘   └─────┘   └─────┘   └─────┘
         ↓step    ↓3rd      ↑step
```

**Arrow Types:**
- → Ascending step (half/whole)
- ← Descending step
- ↗ Ascending skip (3rd-5th)
- ↘ Descending skip
- ⇗ Ascending leap (6th+)
- ⇘ Descending leap
- • Common tone (no movement)

**Layer:** 1 (Ambient) - Visible only in Guided/Explore modes
**Effort:** Low
**Files to modify:**
- `src/modules/features/progressionBuilder/` - Add between-card indicators

---

### Category B: On-Demand Features (Revealed by Simple Interaction)

These features appear with minimal user effort - a hover, tap, or single click.

---

#### B1. Universal Chord Tooltips

**What:** Hovering over ANY chord symbol anywhere in the app shows a consistent, informative tooltip.

**Tooltip Content:**
```
┌─────────────────────────────────────┐
│ Cmaj7  (C Major 7th)                │
│ ─────────────────────               │
│ Notes: C - E - G - B                │
│ Function: Tonic (I)                 │
│ ─────────────────────               │
│ [▶ Play]  [? Learn More]            │
└─────────────────────────────────────┘
```

**Applies to:**
- Chord cards in progression
- Chord symbols in notation
- Recommendation suggestions
- Template previews
- Community submission cards

**Key Principle:** Same tooltip component everywhere = consistency

**Layer:** 2 (On-Demand)
**Effort:** Medium (create reusable component, integrate everywhere)
**Files to create:**
- `src/modules/ui/universalChordTooltip.js` - Single source tooltip component

---

#### B2. "What If?" Quick Variation Panel

**What:** When a chord is selected, a small floating panel appears nearby with 4-6 quick variations to audition.

**Visual Design:**
```
      ┌─ What If? ────────────────────┐
      │                               │
      │  [▶ Minor?]    [▶ Add 7th?]   │
      │  [▶ Invert?]   [▶ Borrow?]    │
      │                               │
      │  ──────────────────────────── │
      │  [Apply]           [Dismiss]  │
      └───────────────────────────────┘
              ▼
        ┌─────────┐
        │   Am    │  ← Selected chord
        └─────────┘
```

**Variations Offered (context-aware):**
| If chord is... | Show these options |
|----------------|-------------------|
| Major triad | Minor?, Sus4?, Add 7th?, Invert? |
| Minor triad | Major?, Sus2?, Add 7th?, Invert? |
| 7th chord | 9th?, Different quality?, Invert? |
| Diatonic | Borrow from parallel?, Secondary dom? |
| Already borrowed | Return to diatonic? |

**Behavior:**
- Appears when chord is selected (not on hover - too disruptive)
- Each button plays audio preview without committing
- "Apply" commits the change
- "Dismiss" or clicking elsewhere closes it
- Only visible in Guided/Explore modes

**Layer:** 2 (On-Demand)
**Effort:** Medium
**Files to create:**
- `src/modules/ui/whatIfPanel.js` - Floating variation panel

---

#### B3. "Continue This Pattern" Suggestion

**What:** When the coach detects a pattern in progress, show a subtle inline suggestion for the next chord.

**Trigger Conditions:**
- Circle of fifths detected (3+ chords) → Suggest continuation
- Chromatic bass descent detected → Suggest next chromatic step
- Sequence detected → Suggest transposed repetition
- Cadential setup (ii-V or IV-V) → Suggest resolution

**Visual (subtle, inline):**
```
┌─────┐   ┌─────┐   ┌─────┐   ┌╌╌╌╌╌┐
│ Am  │ → │ Dm  │ → │  G  │   ┊  C? ┊ ← Dashed/ghost card
│ vi  │   │ ii  │   │  V  │   ┊  I  ┊
└─────┘   └─────┘   └─────┘   └╌╌╌╌╌┘
                               "Complete the cadence?"
                               [Add C] [Show alternatives]
```

**Behavior:**
- Ghost card appears only when pattern is detected
- Single click adds the suggested chord
- "Show alternatives" opens recommendation panel
- Dismissable (don't show again for this pattern)

**Layer:** 2 (On-Demand)
**Effort:** Medium (leverages existing pattern detection)
**Files to modify:**
- `src/modules/teaching/coachEngine/` - Add pattern continuation suggestions
- `src/modules/features/progressionBuilder/` - Render ghost suggestion card

---

#### B4. Inline Explanation Expansion

**What:** Any "Why This Works" or coach observation can expand inline without opening a modal.

**Current:** Clicking explanation often opens modal or navigates.
**Enhanced:** First click expands a small inline panel. Second click (or "Learn More") goes deeper.

**Visual:**
```
Before click:
┌──────────────────────────────────────┐
│ 💡 Deceptive cadence detected        │
└──────────────────────────────────────┘

After click (expanded inline):
┌──────────────────────────────────────┐
│ 💡 Deceptive cadence detected        │
│ ──────────────────────────────────── │
│ Your V→vi surprises the ear!         │
│ Instead of resolving to I, the vi    │
│ creates an unexpected but beautiful  │
│ moment of continuation.              │
│                                      │
│ [▶ Hear V→I]  [▶ Hear V→vi]         │
│ [Learn more...]                      │
└──────────────────────────────────────┘
```

**Layer:** 2 (On-Demand)
**Effort:** Low (modify existing coach item rendering)

---

### Category C: Deep Dive Features (Intentional Navigation)

These exist for users who want to learn deeply. They require opening panels/modals.

---

#### C1. "Theory Concepts Used" Checklist

**What:** A panel showing which music theory concepts appear in the current composition.

**Location:** New tab in Theory dock panel, or section within existing Theory panel.

**Visual:**
```
┌─ Theory Concepts in Your Piece ─────────────┐
│                                             │
│ CADENCES                                    │
│ ✅ Authentic (V→I) ............ measures 3-4│
│ ✅ Deceptive (V→vi) ........... measures 7-8│
│ ☐ Plagal (IV→I) .............. not yet      │
│ ☐ Half cadence ............... not yet      │
│                                             │
│ BORROWED CHORDS                             │
│ ✅ ♭VII (B♭) ................. measure 5    │
│ ☐ iv (Fm) .................... not yet      │
│ ☐ ♭VI (A♭) ................... not yet      │
│                                             │
│ SECONDARY DOMINANTS                         │
│ ☐ V/V ........................ not yet      │
│ ☐ V/vi ....................... not yet      │
│                                             │
│ VOICE LEADING                               │
│ ✅ Stepwise bass motion ...... 60% of moves │
│ ✅ Common tones retained ..... 4 instances  │
│ ⚠️ Parallel fifths ........... 1 instance   │
│                                             │
│ ─────────────────────────────────────────── │
│ You've used 5 of 15 tracked concepts!       │
│ [Explore unused concepts...]                │
└─────────────────────────────────────────────┘
```

**Gamification potential:**
- "Unlock" badges for using concepts
- "Try this concept" suggestions
- Track across all compositions (Composition DNA integration)

**Layer:** 3 (Deep Dive)
**Effort:** Medium
**Files to modify:**
- `src/modules/notation/fullScreen/FullScreenBottomPanel.js` - Add to Theory panel
- `src/modules/teaching/compositionInsights.js` - Expand concept tracking

---

#### C2. "This Sounds Like..." Cultural Context Panel

**What:** Connect the user's creation to real music examples and genres.

**Trigger:** User clicks "What does this sound like?" or system proactively shows when strong pattern match found.

**Content:**
```
┌─ This Sounds Like... ───────────────────────┐
│                                             │
│ Your progression: Am - F - C - G            │
│                                             │
│ GENRE MATCHES                               │
│ ● 90% Pop/Rock (2000s-present)              │
│ ● 70% Folk/Acoustic                         │
│ ● 40% Alternative                           │
│                                             │
│ FAMOUS EXAMPLES                             │
│ 🎵 "Someone Like You" - Adele               │
│ 🎵 "Let It Be" - The Beatles                │
│ 🎵 "No Woman No Cry" - Bob Marley           │
│ 🎵 "With Or Without You" - U2               │
│                                             │
│ WHY IT WORKS                                │
│ This is the "Axis Progression" - vi-IV-I-V  │
│ rotated. It's become the most common        │
│ progression in pop music because it:        │
│ • Starts on a minor chord (emotional)       │
│ • Has strong root motion                    │
│ • Cycles endlessly without feeling stuck    │
│                                             │
│ [Load a variation] [Compare to original]    │
└─────────────────────────────────────────────┘
```

**Data Source:**
- Build from existing pattern detection
- Curate a database of ~50 famous progressions with metadata
- Match against user's current/selected progression

**Layer:** 3 (Deep Dive)
**Effort:** Medium-High (requires progression database)
**Files to create:**
- `src/data/famousProgressions.js` - Curated progression database
- `src/modules/ui/soundsLikePanel.js` - Panel component

---

#### C3. "Why Not This?" Explanation for Low-Scored Options

**What:** When user tries to add an unusual chord, explain why it might be challenging.

**Trigger:** User adds chord that scores below threshold in recommendation engine, OR user explicitly asks "Why not X?"

**Visual (non-blocking notification):**
```
┌─ Heads Up ──────────────────────────────────┐
│                                             │
│ G# Major is unusual in C Major              │
│                                             │
│ This chord:                                 │
│ • Contains notes outside the key (G#, B#)   │
│ • Creates an abrupt shift in tonal center   │
│ • Has no common tones with your previous F  │
│                                             │
│ This doesn't mean it's wrong! Unexpected    │
│ chords can create exciting moments.         │
│                                             │
│ If you want this sound, try:                │
│ • Using it as a passing chord               │
│ • Approaching it with E7 first (V/G#)       │
│ • Committing to a modulation                │
│                                             │
│ [Keep it anyway]  [Show alternatives]       │
└─────────────────────────────────────────────┘
```

**Key principle:** Never BLOCK the user. Educate, then let them decide.

**Layer:** 3 (triggered contextually)
**Effort:** Low (use existing recommendation scores)
**Files to modify:**
- `src/modules/features/progressionBuilder/` - Add chord scoring check on add

---

#### C4. Ear Training Integration Points

**What:** Connect composition actions to ear training exercises.

**Integration Points:**

1. **After creating a cadence:**
   ```
   "You just wrote a deceptive cadence!
   [Train your ear to recognize this →]"
   ```

2. **After using an interval:**
   ```
   "That melody moves by a Perfect 4th.
   [Practice interval recognition →]"
   ```

3. **In Theory Concepts panel:**
   ```
   "Authentic Cadence ✅
   [Test: Can you hear this in songs? →]"
   ```

**Layer:** 3 (opt-in, linked from education surfaces)
**Effort:** Depends on ear training implementation
**Prerequisite:** Ear Training feature from KILLER_FEATURES_ROADMAP

---

### Category D: Theory Moments Enhancements

**Note:** Theory Moments already exist for "discovery celebrations." These enhancements make them more impactful.

---

#### D1. Richer Theory Moment Content

**Current:** Basic celebration message.
**Enhanced:** Add context, audio examples, and "related concepts."

**Example Enhanced Theory Moment:**
```
┌─ 🎉 Discovery! ─────────────────────────────┐
│                                             │
│ You created a DECEPTIVE CADENCE!            │
│                                             │
│ The V→vi movement is one of music's         │
│ favorite surprises. Instead of the          │
│ expected resolution to I, the vi chord      │
│ shares two notes with I but adds an         │
│ unexpected emotional turn.                  │
│                                             │
│ [▶ Hear V→I (expected)]                     │
│ [▶ Hear V→vi (what you did)]                │
│                                             │
│ FAMOUS USES:                                │
│ • "Yesterday" - The Beatles                 │
│ • "My Heart Will Go On" - Celine Dion       │
│                                             │
│ RELATED CONCEPTS:                           │
│ • Authentic cadence (V→I)                   │
│ • Plagal cadence (IV→I)                     │
│                                             │
│ [Awesome, got it!]    [Tell me more...]     │
└─────────────────────────────────────────────┘
```

**Layer:** 2-3 (appears proactively, can dive deeper)
**Effort:** Medium (enhance existing Theory Moments system)
**Files to modify:**
- `src/modules/teaching/theoryMomentsConfig.js` - Richer content
- `src/modules/teaching/theoryMoments.js` - Enhanced rendering

---

#### D2. Theory Moment Frequency Tuning

**Problem:** Too many moments = annoying. Too few = missed learning.

**Solution:** Intelligent frequency based on:
- User's experience mode (Focus/Guided/Explore)
- Recency of similar moments
- User's dismissal patterns
- Novelty of the discovery

**Rules:**
| Condition | Show Moment? |
|-----------|--------------|
| Focus mode | Never (unless critical warning) |
| Same concept shown <24h ago | No |
| User dismissed this type 3+ times | No |
| First time user creates this pattern | Yes (full celebration) |
| Second time creating pattern | Brief acknowledgment only |
| Third+ time | Silent (they know it) |

**Files to modify:**
- `src/modules/teaching/theoryMoments.js` - Add frequency logic

---

## UI Strategy: Modes & Personas

### The Experience Mode Toggle

**Location:** Global header, always accessible

**Visual:**
```
┌──────────────────────────────────────────────────────────┐
│  🎹 Music Theory Lab    [Focus ○───●─── Explore]   ⚙️   │
└──────────────────────────────────────────────────────────┘
```

**Three Positions:**
1. **Focus** (left) - Minimal UI, no educational popups
2. **Guided** (center, default) - Balanced education + composition
3. **Explore** (right) - Maximum educational features

### What Each Mode Controls

| Feature | Focus | Guided | Explore |
|---------|-------|--------|---------|
| Tension curve | Hidden | Visible | Visible + interactive |
| Function colors | Hidden | Subtle | Prominent + legend |
| Bass motion arrows | Hidden | Hidden | Visible |
| Chord tooltips | Minimal (name only) | Standard | Rich (with theory) |
| "What If?" panel | Disabled | On selection | On hover |
| Pattern suggestions | Disabled | On strong match | Always when detected |
| Theory Moments | Disabled | Important only | All discoveries |
| Coach nudges | Disabled | Moderate | Frequent |
| Inline explanations | Collapsed | Expandable | Auto-expanded |
| Concept checklist | Hidden | In panel | Prominent |
| "Sounds Like" | Manual only | On strong match | Proactive |

### Persona Profiles (Future Enhancement)

Allow users to save and name their preferred configurations:

- **"Flow State"** - Focus mode + metronome + loop
- **"Student"** - Explore mode + Theory Moments on
- **"Teacher Demo"** - Explore mode + all visualizations
- **"Quick Sketch"** - Focus mode + minimal panels

---

## Implementation Phases

### Phase 1: Foundation (2 weeks)

**Goal:** Establish the mode system and basic ambient features.

| Task | Effort | Dependencies |
|------|--------|--------------|
| Implement Experience Mode toggle | 3 days | None |
| Add mode state to globalState.js | 1 day | None |
| Wire mode to existing features (coach, theory moments) | 2 days | Mode toggle |
| Tension curve visualization | 3 days | Existing tension analysis |
| Enhanced function color coding | 2 days | Existing theory overlay |

**Deliverable:** Users can switch between Focus/Guided/Explore and see immediate difference in information density.

---

### Phase 2: On-Demand Intelligence (3 weeks)

**Goal:** Add the "quick discovery" features that make exploration playful.

| Task | Effort | Dependencies |
|------|--------|--------------|
| Universal Chord Tooltip component | 3 days | None |
| Integrate tooltip across all surfaces | 4 days | Tooltip component |
| "What If?" variation panel | 5 days | Audio preview system |
| "Continue This Pattern" ghost card | 4 days | Pattern detection |
| Inline explanation expansion | 2 days | Existing coach items |

**Deliverable:** Hovering and clicking reveals contextual education everywhere.

---

### Phase 3: Deep Dive Content (3 weeks)

**Goal:** Rich educational content for users who want to learn deeply.

| Task | Effort | Dependencies |
|------|--------|--------------|
| Theory Concepts Checklist panel | 4 days | Concept tracking |
| Famous Progressions database | 3 days | Curation effort |
| "This Sounds Like" panel | 4 days | Progressions database |
| "Why Not This?" explanations | 2 days | Recommendation scoring |
| Enhanced Theory Moments content | 3 days | Content writing |

**Deliverable:** Users can explore the theory behind their creations in depth.

---

### Phase 4: Polish & Integration (2 weeks)

**Goal:** Ensure all features work together harmoniously.

| Task | Effort | Dependencies |
|------|--------|--------------|
| Mode-aware feature toggling audit | 2 days | All features |
| Performance optimization | 2 days | All features |
| Tooltip/panel positioning fixes | 2 days | All features |
| User testing and iteration | 3 days | All features |
| Documentation updates | 1 day | All features |

**Deliverable:** Cohesive, polished educational experience.

---

## Integration with Existing Systems

### Coach Engine Integration

The Coach Engine already detects 32+ patterns. Enhancements connect to it:

| Enhancement | Coach Integration |
|-------------|-------------------|
| Tension curve | Use chord tension scores from coach |
| Pattern continuation | Use detected patterns, add continuation logic |
| "Why Not?" explanations | Use recommendation scoring |
| Concept checklist | Use observation types as concepts |

**Files involved:**
- `src/modules/teaching/coachEngine/coachEngine.js`
- `src/modules/teaching/coachEngine/detectors/`
- `src/modules/teaching/coachEngine/coachItemTypes.js`

### Theory Moments Integration

Theory Moments handle "discovery celebrations." Enhancements:
- Richer content structure in `theoryMomentsConfig.js`
- Better frequency control in `theoryMoments.js`
- Mode-aware triggering

### Recommendation Engine Integration

The comprehensive recommendation engine scores all chord options. Use this:
- "What If?" panel uses scoring to show best variations
- "Why Not?" uses low scores to trigger explanations
- Ghost suggestions use top-scored next chords

**Files involved:**
- `src/modules/features/comprehensiveChordRecommendations.js`

### Composition Insights Integration

The Composition DNA dashboard tracks user patterns. Expand:
- Concept checklist feeds into long-term tracking
- "Theory concepts used" aggregates to "concepts mastered"
- Famous progression matches inform personalized suggestions

**Files involved:**
- `src/modules/teaching/compositionInsights.js`

---

## Appendix: Feature-Mode Matrix

Quick reference for which features appear in which mode:

| Feature | Layer | Focus | Guided | Explore |
|---------|-------|-------|--------|---------|
| **Ambient** |
| Tension curve | 1 | ❌ | ✅ | ✅+ |
| Function colors | 1 | ❌ | ✅ (subtle) | ✅ (prominent) |
| Bass motion arrows | 1 | ❌ | ❌ | ✅ |
| **On-Demand** |
| Chord tooltips | 2 | Minimal | Standard | Rich |
| "What If?" panel | 2 | ❌ | On click | On select |
| Pattern continuation | 2 | ❌ | On strong match | Always |
| Inline expansion | 2 | ❌ | Click to expand | Auto-expand |
| **Deep Dive** |
| Theory Concepts | 3 | ❌ | In panel | Prominent |
| "Sounds Like" | 3 | Manual | On match | Proactive |
| "Why Not?" | 3 | ❌ | On unusual | On unusual |
| Theory Moments | 2-3 | ❌ | Important only | All |

---

## Success Metrics

### Quantitative
- Time spent in composition vs. exploring explanations
- Feature discovery rate (% of users who use each feature)
- Mode usage distribution (Focus/Guided/Explore split)
- Theory Moment engagement (viewed vs. dismissed)

### Qualitative
- User feedback on "feeling overwhelmed" (should decrease)
- User feedback on "learning something new" (should increase)
- User feedback on "finding what I need" (should increase)

---

## Open Questions

1. **Mobile/touch behavior:** How do hover-based features adapt?
2. **Onboarding:** Should new users start in Explore mode with a tour?
3. **A/B testing:** Can we test mode defaults to find optimal?
4. **Accessibility:** Ensure all features work with screen readers

---

**Document Version:** 1.0
**Last Updated:** January 2026
**Next Review:** After Phase 1 completion
