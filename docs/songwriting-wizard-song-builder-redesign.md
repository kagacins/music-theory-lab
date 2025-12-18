# Songwriting Wizard & Song Builder Redesign Proposal

## Current State Analysis

### Songwriting Wizard Issues
- **Path selection is superficial** - "Quick Song" vs "Full Composition" both lead to similar outcomes (both allow 40+ measures)
- **Mood/style → random progression** - Just assigns a progression from library without context
- **Contradictory features** - "Quick Swaps" suggests 7ths, then later offers "make all chords 7ths"
- **Linear wizard doesn't match songwriting** - Real songwriting is non-linear and iterative
- **No educational value** - Doesn't explain WHY progressions work for certain contexts
- **Limited editing** - Puts users on rails with modest ability to customize

### Song Builder Issues
- **Passive display** - Only shows what exists + transition suggestions
- **No arrangement tools** - Can't reorder, duplicate, or delete sections
- **No structural guidance** - No templates for typical song forms
- **No harmonic analysis** - Doesn't analyze relationships across the full song
- **Misleading name** - Called "Builder" but doesn't help build anything

---

## Recommendation A: Reimagined Songwriting Wizard

### New Philosophy: "Structure-First, Then Populate"

Instead of mood → random progression, flip the approach: define song structure first, then fill in contextually-appropriate progressions.

---

### Phase 1: Song Blueprint

**Goal:** Help user define the skeleton of their song before adding chords.

```
┌─────────────────────────────────────────────────────────────┐
│  What kind of song structure do you want?                   │
│                                                             │
│  ○ Simple (Verse → Chorus → Verse → Chorus)                │
│  ○ Standard (Verse → Chorus → Verse → Chorus → Bridge → Chorus)
│  ○ Extended (Intro → Verse → Pre-Chorus → Chorus → ...)    │
│  ○ Custom (Build your own structure)                        │
│                                                             │
│  [Show me examples of songs with this structure]            │
└─────────────────────────────────────────────────────────────┘
```

**Visual Song Map** (shown after selection):
```
┌─────────────────────────────────────────────────────────────┐
│  Your Song Structure:                                       │
│                                                             │
│  ┌──────┐   ┌────────┐   ┌──────┐   ┌────────┐   ┌───────┐ │
│  │Verse │ → │ Chorus │ → │Verse │ → │ Chorus │ → │ Outro │ │
│  │ 8 bars│   │ 8 bars │   │ 8 bars│   │ 8 bars │   │ 4 bars│ │
│  │ empty │   │ empty  │   │ empty │   │ empty  │   │ empty │ │
│  └──────┘   └────────┘   └──────┘   └────────┘   └───────┘ │
│                                                             │
│  Click any section to build its progression                 │
└─────────────────────────────────────────────────────────────┘
```

**Key Benefits:**
- User sees the big picture before diving into details
- Non-linear: can work on any section in any order
- Clear visual progress indicator

---

### Phase 2: Section-Specific Progression Building

**Goal:** Provide context-aware suggestions based on section type.

When user clicks a section (e.g., "Verse"):
```
┌─────────────────────────────────────────────────────────────┐
│  Building: VERSE (8 bars)                     Key: C Major  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Verse progressions typically:                              │
│  • Set up the story/mood                                    │
│  • Feel more "open" or unresolved                          │
│  • Often avoid the I chord until the end                   │
│                                                             │
│  Choose your approach:                                      │
│                                                             │
│  [Start from Template]  [Build Chord by Chord]  [AI Suggest]│
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Popular Verse Progressions in C Major:                     │
│                                                             │
│  ♪ Am - F - C - G      "Sensitive/Emotional"    [Use This] │
│    (vi - IV - I - V)   Used in: "Someone Like You"         │
│                                                             │
│  ♪ C - Am - F - G      "Hopeful/Building"       [Use This] │
│    (I - vi - IV - V)   Used in: "Let It Be"               │
│                                                             │
│  ♪ Am - G - F - E      "Dramatic/Minor Feel"    [Use This] │
│    (vi - V - IV - III) Used in: "Hit the Road Jack"       │
│                                                             │
│  [Show more verse progressions...]                          │
└─────────────────────────────────────────────────────────────┘
```

**Section-Type Guidance:**

| Section Type | Typical Characteristics | Common Starting Chords |
|--------------|------------------------|------------------------|
| **Verse** | Sets up story, more subdued, builds tension | vi, I, ii |
| **Pre-Chorus** | Builds anticipation, creates lift | IV, ii, V |
| **Chorus** | Emotional peak, memorable, resolved | I, IV, vi |
| **Bridge** | Contrast, new perspective, different chords | IV, vi, iii |
| **Outro** | Resolution, winding down | I, IV, V→I |

**Key Benefits:**
- Progressions are suggested based on section context
- Educational: explains WHY certain progressions work
- Shows real song examples for credibility

---

### Phase 3: Harmonic Coherence Check

**Goal:** Analyze relationships between sections and suggest improvements.

```
┌─────────────────────────────────────────────────────────────┐
│  Harmonic Analysis of Your Song                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Verse:   Am - F - C - G     Chorus:  C - G - Am - F       │
│           vi - IV - I - V             I - V - vi - IV       │
│                                                             │
│  ✓ Good contrast: Verse starts on vi, Chorus starts on I   │
│  ✓ Smooth transition: Verse ends on V, resolves to I       │
│  ⚠ Consider: Both use same 4 chords - add variety?         │
│                                                             │
│  Suggestions:                                               │
│  • Add a ii chord (Dm) to verse for more color             │
│  • Try a IV chord (F) at chorus start for "lift"           │
│  • Bridge could use different chords entirely              │
│                                                             │
│  [Apply Suggestion]  [Keep As Is]  [Show Alternatives]      │
└─────────────────────────────────────────────────────────────┘
```

**Analysis Criteria:**
- Starting chord contrast between sections
- Ending → Starting chord transitions
- Chord vocabulary overlap (too similar = less interesting)
- Energy/tension arc across the song

---

### Wizard Design Principles

1. **Structure first** - Define the song skeleton before filling in chords
2. **Context-aware suggestions** - Different progressions for verse vs chorus vs bridge
3. **Educational** - Explain WHY progressions work, not just WHAT they are
4. **Non-linear** - Let users jump between sections, not a rigid step-by-step
5. **Harmonic coherence** - Analyze relationships between sections
6. **Real examples** - Reference actual songs that use these progressions

---

## Recommendation B: Reimagined Song Builder

### New Philosophy: "Arrangement Workstation"

Transform from passive display to active arrangement tool.

---

### Main View: Visual Arrangement Timeline

```
┌─────────────────────────────────────────────────────────────┐
│  Song Builder                            Total: 3:24        │
│  Key: C Major  |  Tempo: 120 BPM  |  Time: 4/4             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ARRANGEMENT TIMELINE (drag to reorder)                     │
│  ════════════════════════════════════════════════════════   │
│                                                             │
│  ┌─────────┐ ┌─────────────┐ ┌─────────┐ ┌─────────────┐   │
│  │ INTRO   │→│   VERSE 1   │→│ CHORUS  │→│   VERSE 2   │   │
│  │ 4 bars  │ │   8 bars    │ │ 8 bars  │ │   8 bars    │   │
│  │ C - G   │ │ Am-F-C-G x2 │ │ C-G-Am-F│ │ Am-F-C-G x2 │   │
│  └─────────┘ └─────────────┘ └─────────┘ └─────────────┘   │
│                                                             │
│  ┌─────────────┐ ┌─────────┐ ┌─────────────┐               │
│  │   CHORUS    │→│ BRIDGE  │→│FINAL CHORUS │               │
│  │   8 bars    │ │ 4 bars  │ │   8 bars    │               │
│  │  C-G-Am-F   │ │ F-G-Am  │ │  C-G-Am-F   │               │
│  └─────────────┘ └─────────┘ └─────────────┘               │
│                                                             │
│  [+ Add Section]  [Suggest Structure]  [Play Full Song]     │
└─────────────────────────────────────────────────────────────┘
```

---

### Feature 1: Drag-and-Drop Arrangement

**Capabilities:**
- Drag sections to reorder the arrangement
- Visual feedback showing where section will drop
- Right-click context menu:
  - **Duplicate** - Copy section (creates "Verse 2" from "Verse 1")
  - **Delete** - Remove section from arrangement
  - **Edit** - Open section for chord editing
  - **Split** - Divide section into two parts
  - **Merge** - Combine adjacent sections

**Visual Feedback:**
- Drop zones highlight on drag
- Ghost preview shows where section will land
- Transition indicators update in real-time

---

### Feature 2: Structure Suggestions

```
┌─────────────────────────────────────────────────────────────┐
│  Structure Suggestions                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Your current structure: Intro → V → C → V → C → Bridge → C│
│                                                             │
│  Suggestions based on your style (Pop/Rock):                │
│                                                             │
│  ○ Add Pre-Chorus before each Chorus                       │
│    Creates anticipation, common in modern pop              │
│    [Preview] [Apply]                                        │
│                                                             │
│  ○ Add Instrumental Break after Bridge                     │
│    Provides breathing room, builds to final chorus         │
│    [Preview] [Apply]                                        │
│                                                             │
│  ○ Double the final Chorus                                 │
│    Creates epic ending, very common in anthemic songs      │
│    [Preview] [Apply]                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Suggestion Types:**
- Add missing common sections (pre-chorus, bridge, outro)
- Structural improvements (double chorus, add intro)
- Energy arc suggestions (build tension, create release)

---

### Feature 3: Section Relationship Analysis

```
┌─────────────────────────────────────────────────────────────┐
│  Section Relationships                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  VERSE 1 → CHORUS                                          │
│  ├─ Transition: G → C (V → I) ✓ Strong resolution          │
│  ├─ Energy: Low → High ✓ Good contrast                     │
│  └─ Recommendation: Consider adding drum fill              │
│                                                             │
│  CHORUS → VERSE 2                                          │
│  ├─ Transition: F → Am (IV → vi) ✓ Smooth                  │
│  ├─ Energy: High → Low ✓ Appropriate drop                  │
│  └─ Recommendation: Strip instrumentation gradually        │
│                                                             │
│  BRIDGE → FINAL CHORUS                                      │
│  ├─ Transition: Am → C (vi → I) ⚠ Could be stronger        │
│  ├─ Energy: Medium → High                                  │
│  └─ Recommendation: Try G → C (V → I) for bigger impact    │
│      [Apply This Change]                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Analysis Includes:**
- Chord-to-chord transition quality (smooth, strong, weak)
- Energy level changes between sections
- Actionable recommendations with one-click apply

---

### Feature 4: Variation Generator

**Goal:** Create variations of existing sections for verse 2, final chorus, etc.

```
┌─────────────────────────────────────────────────────────────┐
│  Create Variation of: VERSE 1                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Original: Am - F - C - G  (vi - IV - I - V)               │
│                                                             │
│  Variation Options:                                         │
│                                                             │
│  ○ Chord Substitutions                                     │
│    Am - Dm - C - G  (substitute F with ii)                 │
│    Adds more movement, slightly darker                      │
│                                                             │
│  ○ Extended Chords                                         │
│    Am7 - Fmaj7 - Cmaj7 - G7                                │
│    Jazzier feel, more sophisticated                         │
│                                                             │
│  ○ Rhythmic Variation                                      │
│    Am - Am - F - F - C - G - G - C                         │
│    Same chords, different rhythm/pacing                     │
│                                                             │
│  ○ Modal Interchange                                       │
│    Am - Fm - C - G  (borrow from parallel minor)           │
│    Creates unexpected color                                 │
│                                                             │
│  [Preview]  [Use as Verse 2]  [Replace Original]            │
└─────────────────────────────────────────────────────────────┘
```

**Variation Types:**
| Type | Description | Use Case |
|------|-------------|----------|
| **Chord Substitutions** | Replace chords with functional equivalents | Add variety while keeping feel |
| **Extended Chords** | Add 7ths, 9ths, etc. | Sophisticate the harmony |
| **Rhythmic Variation** | Change chord durations | Create movement/contrast |
| **Modal Interchange** | Borrow from parallel modes | Add color/surprise |
| **Inversion Changes** | Use different voicings | Smoother bass lines |

---

### Feature 5: Song Templates

```
┌─────────────────────────────────────────────────────────────┐
│  Start from Template                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  POP STRUCTURES                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ "Radio Ready"                                        │   │
│  │ Intro → Verse → Pre-Chorus → Chorus → Verse →       │   │
│  │ Pre-Chorus → Chorus → Bridge → Chorus → Outro       │   │
│  │ ~3:30 | Used by: Taylor Swift, Ed Sheeran          │   │
│  │ [Use Template]                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ "Verse-Heavy Storyteller"                            │   │
│  │ Verse → Verse → Chorus → Verse → Chorus → Verse     │   │
│  │ ~4:00 | Used by: Bob Dylan, Joni Mitchell           │   │
│  │ [Use Template]                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ROCK STRUCTURES                                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ "Arena Anthem"                                       │   │
│  │ Intro → Verse → Chorus → Verse → Chorus →           │   │
│  │ Solo → Bridge → Chorus → Chorus → Outro             │   │
│  │ ~4:30 | Used by: Queen, Journey                     │   │
│  │ [Use Template]                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Template Categories:**
- **Pop** - Radio Ready, Verse-Heavy, Dance/EDM
- **Rock** - Arena Anthem, Power Ballad, Punk Simple
- **Folk/Acoustic** - Storyteller, Campfire, Ballad
- **R&B/Soul** - Groove-Based, Slow Jam
- **Electronic** - Build & Drop, Progressive

---

## Implementation Roadmap

### Phase 1: Foundation (Highest Impact)

| Feature | Description | Effort |
|---------|-------------|--------|
| **Song Blueprint** | Structure-first wizard approach | Medium |
| **Drag-and-Drop** | Basic arrangement reordering | Medium |
| **Section Templates** | Quick-start song structures | Low |

### Phase 2: Intelligence

| Feature | Description | Effort |
|---------|-------------|--------|
| **Context-Aware Suggestions** | Different progressions for verse/chorus/bridge | High |
| **Harmonic Coherence** | Cross-section relationship analysis | High |
| **Enhanced Transitions** | Improve existing transition recommendations | Medium |

### Phase 3: Polish

| Feature | Description | Effort |
|---------|-------------|--------|
| **Variation Generator** | Create section variants automatically | High |
| **Educational Tooltips** | Explain the "why" behind suggestions | Low |
| **Famous Song Examples** | "This progression is used in..." | Medium |

---

## Summary

### Songwriting Wizard: Before vs After

| Before | After |
|--------|-------|
| Mood → Random progression | Structure → Context-aware progressions |
| Linear step-by-step | Non-linear, work on any section |
| No explanation of choices | Educational: explains WHY |
| Same suggestions for all sections | Different suggestions per section type |
| Quick Song vs Full = same result | Meaningful path differences |

### Song Builder: Before vs After

| Before | After |
|--------|-------|
| Passive display | Active arrangement workstation |
| No reordering | Drag-and-drop arrangement |
| No structure guidance | Templates + suggestions |
| Only transition tips | Full harmonic analysis |
| Can't duplicate/delete | Full section management |
| "Builder" in name only | Actually builds songs |

---

## Next Steps

1. **Decide on priority** - Which features are most valuable to implement first?
2. **Design mockups** - Create visual designs for new interfaces
3. **Refactor data model** - Ensure section/song structure supports new features
4. **Implement Phase 1** - Start with highest-impact, lowest-effort features
5. **User testing** - Validate approach before building Phase 2/3
