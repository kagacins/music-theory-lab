# Music Theory Lab - Killer Features Roadmap
## Strategic Plan for World-Class Music Theory Teaching & Composition

**Created:** December 2024
**Version:** 1.0
**Goal:** Make Music Theory Lab the best music theory teacher and composition assistant in the world

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Assessment](#current-state-assessment)
3. [Critical Missing Music Theory Concepts](#critical-missing-music-theory-concepts)
4. [Killer Features Recommendations](#killer-features-recommendations)
5. [Features That Make It FUN](#features-that-make-it-fun)
6. [UX Recommendations](#ux-recommendations-for-intuitive-navigation)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Competitive Differentiation](#competitive-differentiation)
9. [Success Metrics](#success-metrics)
10. [What Makes This "Best in the World"](#what-would-make-this-the-best-in-the-world)

---

## Executive Summary

Music Theory Lab is already a remarkably comprehensive application with world-class AI-powered chord recommendations, professional notation rendering, and structured learning content. To become the undisputed best music theory teaching and composition tool, we need to:

1. **Fill critical gaps** in music theory coverage (scales, modulation, rhythm)
2. **Add differentiating features** no competitor has (ear training + composition integration)
3. **Enable sharing** (audio export for social proof and viral growth)
4. **Make it addictively fun** (gamification, challenges, achievements)
5. **Complete in-progress features** (voice leading visualization, wizard enhancement)

**The Three Features That Would Create Insurmountable Lead:**
1. Audio Export (WAV/MP3) - Share creations
2. Integrated Ear Training - Only tool combining composition + ear training
3. Voice Leading Visualization - Make abstract theory visible

---

## Current State Assessment

### Fully Implemented (Strong Foundation)

| Category | Features |
|----------|----------|
| **Notation** | VexFlow grand staff, multi-page layout, note editing, chord symbols |
| **Chord System** | 50+ chord types, inversions, 3D recommendation engine (600+ combinations) |
| **AI Composition** | Melody suggestions (notes + phrases), auto-harmonize, chord tone highlighting |
| **Progressions** | 24+ templates, pattern detection, tension visualization, Roman numeral analysis |
| **Learning** | 20+ lessons, multi-level explanations, interactive tutorials, "Why This Works" panel |
| **Scales** | Major, natural minor, 7 modes, pentatonic, blues |
| **Export** | PDF (lead sheet + notation), MIDI, JSON, shareable URLs |
| **Tools** | Secondary dominants, modal interchange, tritone subs, theory tools panel |
| **UX** | Undo/redo, auto-save, dark mode, keyboard shortcuts (TAB modal) |

### Partially Implemented (From Roadmaps)

| Feature | Current Status | Remaining Work |
|---------|----------------|----------------|
| Voice Leading Visualization | Score/percentage displayed | SVG lines between notes not rendered |
| Rhythm Pattern Library | 60+ patterns defined | No browser UI for selection |
| Version History | Auto-save exists | No timeline UI, no named checkpoints |
| Songwriting Wizard | 5 steps, 6 moods | Missing style/genre, structure, tempo/feel |
| Section Tab | UI exists in modal | Not wired to SectionGenerator |
| Rhythmic Awareness UI | Backend complete (phases 1-3) | UI display pending (phases 4-5) |

### Not Implemented (From Roadmaps)

| Feature | Roadmap Source | Priority |
|---------|----------------|----------|
| Audio Export (WAV/MP3) | phase-4-roadmap | Critical |
| MusicXML Export | phase-4-roadmap | High |
| Ear Training / Practice Mode | phase-4-roadmap (7.8) | Critical |
| Real-Time Collaboration | phase-4-roadmap (7.11) | Medium |
| Mobile Companion | phase-4-roadmap (7.12) | Low |

---

## Critical Missing Music Theory Concepts

These foundational concepts are expected by serious music learners and missing from the current implementation:

### 1. Harmonic Minor & Melodic Minor Scales

**Why Critical:**
- Essential for understanding dominant function in minor keys
- The raised 7th (leading tone) explains why V-i cadences work in minor
- Melodic minor ascending vs descending is fundamental theory

**Implementation:**
```javascript
// Add to scales.js
'harmonic-minor': {
  name: 'Harmonic Minor',
  intervals: [0, 2, 3, 5, 7, 8, 11],
  description: 'Natural minor with raised 7th - creates strong V-i cadence',
  difficulty: 'intermediate'
},
'melodic-minor': {
  name: 'Melodic Minor',
  intervals: [0, 2, 3, 5, 7, 9, 11],  // Ascending form
  description: 'Minor scale with raised 6th and 7th - smooth melodic motion',
  difficulty: 'intermediate'
}
```

### 2. Whole Tone & Diminished Scales

**Why Critical:**
- Whole tone creates dreamy/ethereal sound (Debussy, film scores)
- Diminished (octatonic) is essential for jazz improvisation
- Explains augmented and diminished chord function

**Implementation:**
```javascript
'whole-tone': {
  name: 'Whole Tone',
  intervals: [0, 2, 4, 6, 8, 10],
  description: 'All whole steps - dreamy, floating, no resolution',
  difficulty: 'advanced'
},
'diminished-whole-half': {
  name: 'Diminished (Whole-Half)',
  intervals: [0, 2, 3, 5, 6, 8, 9, 11],
  description: 'Alternating W-H pattern - tension, suspense',
  difficulty: 'advanced'
},
'diminished-half-whole': {
  name: 'Diminished (Half-Whole)',
  intervals: [0, 1, 3, 4, 6, 7, 9, 10],
  description: 'Alternating H-W pattern - dominant function',
  difficulty: 'advanced'
}
```

### 3. Additional Useful Scales

```javascript
'bebop-major': {
  name: 'Bebop Major',
  intervals: [0, 2, 4, 5, 7, 8, 9, 11],
  description: 'Major scale with added #5 - smooth jazz walking lines',
  difficulty: 'advanced'
},
'bebop-dominant': {
  name: 'Bebop Dominant',
  intervals: [0, 2, 4, 5, 7, 9, 10, 11],
  description: 'Mixolydian with added natural 7 - jazz improv staple',
  difficulty: 'advanced'
},
'phrygian-dominant': {
  name: 'Phrygian Dominant',
  intervals: [0, 1, 4, 5, 7, 8, 10],
  description: 'Flamenco/Middle Eastern flavor - exotic tension',
  difficulty: 'intermediate'
},
'hungarian-minor': {
  name: 'Hungarian Minor',
  intervals: [0, 2, 3, 6, 7, 8, 11],
  description: 'Double harmonic minor - dramatic, exotic',
  difficulty: 'advanced'
},
'lydian-dominant': {
  name: 'Lydian Dominant',
  intervals: [0, 2, 4, 6, 7, 9, 10],
  description: 'Lydian with b7 - jazzy, sophisticated tension',
  difficulty: 'advanced'
}
```

### 4. Counterpoint Fundamentals

**Currently Missing:**
- Species counterpoint rules and exercises
- Parallel 5ths/octaves enforcement in lessons
- Cantus firmus writing exercises
- Voice independence scoring in melody generation

**Recommendation:**
Add a "Counterpoint Basics" lesson series:
1. What is counterpoint? (voices moving independently)
2. First species (note against note)
3. Avoid parallel 5ths and octaves (with audio examples)
4. Second species (two notes against one)
5. Writing a simple two-voice piece

### 5. Rhythm & Meter Concepts

**Currently Missing:**
- Syncopation analysis and generation
- Compound vs simple meter teaching
- Pickup measures (anacrusis)
- Hemiola and metric displacement
- Polyrhythm introduction

**Recommendation:**
Add rhythm-focused lessons and tools:
1. Understanding time signatures (simple vs compound)
2. Syncopation - accenting the "and"
3. Pickup measures in real songs
4. Swing feel vs straight
5. Advanced: polyrhythm basics

### 6. Modulation Techniques

**Currently Available:** Key change detection
**Missing:** Teaching HOW to modulate

**Modulation Types to Teach:**
1. **Pivot chord modulation** - Using a chord common to both keys
2. **Common-tone modulation** - One note bridges two keys
3. **Direct modulation** - Abrupt key change (popular in pop music)
4. **Sequential modulation** - Pattern moves to new key
5. **Chromatic modulation** - Using chromatic alteration

**Implementation:**
Add to Theory Tools panel:
- "Modulate to [key]" with method selection
- Visual explanation of pivot chord function
- Before/after playback comparison

---

## Killer Features Recommendations

### Tier 1: Critical Differentiators (Highest Priority)

#### 1. Audio Export (WAV/MP3)

**Impact:** VERY HIGH
**Effort:** Medium
**Timeline:** 2 weeks

**Why This Is Killer:**
- Users cannot share creations outside the app currently
- "Made with Music Theory Lab" watermark = viral marketing potential
- Creates emotional investment (hearing YOUR song as a real audio file)
- No competitor in the theory-teaching space does this well

**Features:**
- Export current composition as WAV or MP3
- Instrument selection (Piano, Guitar, Synth, Orchestra)
- Include/exclude click track option
- Normalize audio levels
- Optional watermark audio tag
- Quality settings (128kbps, 256kbps, 320kbps)

**Technical Approach:**
```javascript
// Use Tone.js built-in recorder
import { Recorder } from 'tone';

const recorder = new Recorder();
Tone.Destination.connect(recorder);

// Start recording
await recorder.start();

// Play composition
await playComposition();

// Stop and get blob
const recording = await recorder.stop();
const url = URL.createObjectURL(recording);

// Convert to MP3 using lamejs if needed
```

**UI Location:**
- New "Export Audio" button in export panel
- Settings modal for instrument/quality selection
- Progress indicator during render

**Success Metrics:**
- [ ] Export completes in <30 seconds for 4-minute composition
- [ ] Audio quality matches playback quality
- [ ] Multiple instruments sound correct
- [ ] File plays in all common audio players

---

#### 2. Integrated Ear Training

**Impact:** VERY HIGH
**Effort:** Medium
**Timeline:** 4 weeks

**Why This Is Killer:**
- **No one else combines composition + ear training**
- Train your ear using YOUR progressions (personal relevance)
- Creates the complete musician (theory + ear + composition)
- Gamification drives daily engagement

**Exercise Types:**

##### A. Interval Recognition
```
[Play two notes from user's melody]
"What interval is this?"
[m2] [M2] [m3] [M3] [P4] [TT] [P5] [m6] [M6] [m7] [M7] [P8]

Correct! That's a Major 3rd - the interval between C and E in your melody.
```

##### B. Chord Quality Identification
```
[Play a chord from user's progression]
"What type of chord is this?"
[Major] [Minor] [Dim] [Aug] [Dom7] [Maj7] [Min7]

Correct! That's a Dominant 7th chord - G7 in your progression.
```

##### C. Progression Dictation
```
[Play 4 chords]
"Recreate this progression by clicking chords"
[User builds: I - ? - ? - ?]

Hint: The second chord sounds "sad" - it's probably minor.
```

##### D. Chord Tone Ear Training
```
[Play chord, then single note]
"Is this note in the chord? If so, which degree?"
[Not in chord] [Root] [3rd] [5th] [7th]

Correct! That E is the 3rd of the C Major chord.
```

##### E. Melody Dictation (Advanced)
```
[Play 4-bar melody phrase]
"Recreate this melody on the staff"
[User clicks notes on notation]

Close! You got 7 of 8 notes correct.
The 5th note was D, not E.
```

**Gamification:**
- XP points for correct answers
- Streak counter (consecutive correct)
- Daily challenge (5 questions)
- Difficulty auto-adjusts based on accuracy
- Badges: "Interval Master", "Chord Detective", etc.
- Leaderboards (optional)

**Integration Points:**
- Use chords/melodies from user's current composition
- "Practice this progression" button on any saved composition
- Link XP to main learning progress system
- Ear training exercises unlock based on lesson completion

**UI Design:**
```
┌──────────────────────────────────────────────────────────┐
│ Ear Training                          Streak: 🔥 7       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Exercise: Chord Quality                    Level: 3     │
│                                                          │
│                    [▶ Play Again]                        │
│                                                          │
│  What type of chord is this?                            │
│                                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │
│  │ Major  │ │ Minor  │ │  Dom7  │ │ Maj7   │           │
│  └────────┘ └────────┘ └────────┘ └────────┘           │
│                                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐           │
│  │ Min7   │ │  Dim   │ │  Aug   │ │ Dim7   │           │
│  └────────┘ └────────┘ └────────┘ └────────┘           │
│                                                          │
│  Today: 12/15 correct (80%)     All-time: 847 XP       │
│                                                          │
│  [Exit]                            [Skip] [Hint -10XP]  │
└──────────────────────────────────────────────────────────┘
```

**Success Metrics:**
- [ ] 5+ exercise types implemented
- [ ] Difficulty progression feels smooth
- [ ] Uses user's actual compositions when available
- [ ] Daily engagement rate >40%
- [ ] XP integrates with existing progress system

---

#### 3. Voice Leading Visualization (Complete Existing)

**Impact:** HIGH
**Effort:** LOW (analysis already exists!)
**Timeline:** 1 week

**Why This Is Killer:**
- Makes abstract theory concepts VISIBLE
- Instant "aha" moments when students see the connecting lines
- Unique among competitors
- The hard work (analysis) is already done

**Visual Design:**
```
Chord 1 (C)      Chord 2 (Am)
┌─────────┐      ┌─────────┐
│    E    │━━━━━━│    E    │  ← Green solid (common tone)
│    C    │──────│    C    │  ← Green solid (common tone)
│    G    │╲     │    A    │  ← Blue solid (stepwise: G→A)
│    C    │ ╲    │    E    │  ← Orange dashed (skip: C→E)
└─────────┘  ╲   └─────────┘
              ╲_______________

Legend:
━━━ Green solid   = Common tone (same note)
─── Blue solid    = Stepwise motion (half/whole step)
┄┄┄ Orange dashed = Skip (3rd to 5th)
╌╌╌ Red dashed    = Leap (6th or more)
▓▓▓ Red thick     = Warning: Parallel 5ths/8ves
```

**Line Types & Colors:**
| Motion Type | Color | Style | Example |
|-------------|-------|-------|---------|
| Common tone | Green (#22c55e) | Solid 2px | E→E |
| Stepwise | Blue (#3b82f6) | Solid 2px | G→A |
| Skip (3rd-5th) | Orange (#f59e0b) | Dashed 2px | C→E |
| Leap (6th+) | Red (#ef4444) | Dashed 2px | C→A |
| Parallel 5ths/8ves | Red (#dc2626) | Solid 4px | Warning! |

**Features:**
- Toggle on/off in notation toolbar (default: off for beginners)
- Tooltip on hover: "E stays the same (common tone) - this creates smoothness"
- Per-transition smoothness score displayed
- Warning badges for parallel motion issues
- Click a line to hear just those two notes
- "Fix suggestions" for problem areas

**Implementation:**
```javascript
// src/modules/notation/voiceLeadingOverlay.js

export function renderVoiceLeadingLines(svgContainer, chord1, chord2, analysisResult) {
  const { voiceConnections, warnings } = analysisResult;

  voiceConnections.forEach(connection => {
    const line = createSVGLine(
      connection.startPos,
      connection.endPos,
      getLineStyle(connection.motionType)
    );

    line.addEventListener('mouseenter', () => {
      showTooltip(connection.explanation);
    });

    line.addEventListener('click', () => {
      playTwoNotes(connection.startNote, connection.endNote);
    });

    svgContainer.appendChild(line);
  });

  warnings.forEach(warning => {
    renderWarningBadge(svgContainer, warning);
  });
}
```

**Success Metrics:**
- [ ] Lines render correctly for all chord pairs
- [ ] Performance: <16ms render time (60fps)
- [ ] Tooltips explain each connection clearly
- [ ] Warning detection accurate for parallel 5ths/8ves
- [ ] Toggle persists in user settings

---

### Tier 2: Differentiation Amplifiers

#### 4. Enhanced Songwriting Wizard

**Impact:** HIGH
**Effort:** Medium
**Timeline:** 2 weeks

**Current State:** 5 steps, 6 moods
**Target State:** 8 steps with full creative control

**New Flow:**

```
Step 1: Welcome
┌──────────────────────────────────────────────────────────┐
│ What would you like to create today?                     │
│                                                          │
│ ┌─────────────────┐ ┌─────────────────┐                 │
│ │   Quick Song    │ │ Full Composition│                 │
│ │   4 chords      │ │ Verse/Chorus    │                 │
│ │   ~2 minutes    │ │ ~5 minutes      │                 │
│ └─────────────────┘ └─────────────────┘                 │
│                                                          │
│ ┌─────────────────┐                                     │
│ │ Explore & Learn │                                     │
│ │ Sandbox mode    │                                     │
│ └─────────────────┘                                     │
└──────────────────────────────────────────────────────────┘

Step 2: Mood Selection (Enhanced)
┌──────────────────────────────────────────────────────────┐
│ How should your song feel?                [🔊 Preview]   │
│                                                          │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │
│ │   😊   │ │   😢   │ │   ⚡   │ │   💭   │ │   💕   │ │
│ │ Happy  │ │  Sad   │ │Energetic│ │ Dreamy │ │Romantic│ │
│ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ │
│                                                          │
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ │
│ │   😎   │ │   🌙   │ │   🎭   │ │   🏆   │ │   🎪   │ │
│ │ Chill  │ │Nostalgic│ │Mysterious│ │Triumphant│ │Playful│ │
│ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ │
│                                                          │
│ Hover over any mood to hear a preview                   │
└──────────────────────────────────────────────────────────┘

Step 3: Style/Genre Selection (NEW)
┌──────────────────────────────────────────────────────────┐
│ What style fits your vision?                             │
│                                                          │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │   🎸    │ │   🎹    │ │   🎷    │ │   🎻    │        │
│ │   Pop   │ │  Rock   │ │  Jazz   │ │Classical│        │
│ │ Simple  │ │ Power   │ │ Complex │ │ Elegant │        │
│ │ chords  │ │ chords  │ │ voicings│ │ voice   │        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
│                                                          │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│ │   🪕    │ │   🎹    │ │   🎤    │ │   🎸    │        │
│ │  Folk   │ │Electronic│ │   R&B   │ │  Blues  │        │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
│                                                          │
│ Style affects: chord complexity, voicings, patterns     │
└──────────────────────────────────────────────────────────┘

Step 4: Structure Selection (NEW)
┌──────────────────────────────────────────────────────────┐
│ Choose your song structure:                              │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Simple (4 chords, repeat)                           │ │
│ │ ████████████████████████████████                    │ │
│ │ Perfect for: Loops, practice, simple songs          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Verse-Chorus (8+8 measures)                         │ │
│ │ ████ Verse ████ ████ Chorus ████                    │ │
│ │ Perfect for: Pop songs, singer-songwriter           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ AABA (32-bar jazz standard)                         │ │
│ │ ████ A ████ ████ A ████ ████ B ████ ████ A ████    │ │
│ │ Perfect for: Jazz standards, show tunes             │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 12-Bar Blues                                        │ │
│ │ ████ I ████ IV ████ I ████ V-IV-I ████             │ │
│ │ Perfect for: Blues, rock, jam sessions              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ [+ Custom structure]                                     │
└──────────────────────────────────────────────────────────┘

Step 5: Tempo & Feel (NEW)
┌──────────────────────────────────────────────────────────┐
│ Set the tempo and feel:                                  │
│                                                          │
│ Tempo: [━━━━━━━━━●━━━━━━] 120 BPM     [Tap Tempo]       │
│                                                          │
│ Suggested for Energetic Pop: 115-130 BPM                │
│                                                          │
│ Feel:                                                    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│ │ Straight │ │  Swing   │ │ Shuffle  │                 │
│ │ ♩ ♩ ♩ ♩  │ │ ♩.♪♩.♪  │ │ ♩ ♪♩ ♪  │                 │
│ └──────────┘ └──────────┘ └──────────┘                 │
│                                                          │
│ Time Signature:                                          │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐                            │
│ │4/4 │ │3/4 │ │6/8 │ │2/4 │                            │
│ └────┘ └────┘ └────┘ └────┘                            │
└──────────────────────────────────────────────────────────┘

Step 6: Preview & Refine
┌──────────────────────────────────────────────────────────┐
│ Here's your generated progression:              [▶ Play] │
│                                                          │
│ ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐      │
│ │  C  │  G  │  Am │  F  │  C  │  G  │  F  │  G  │      │
│ │  I  │  V  │  vi │  IV │  I  │  V  │  IV │  V  │      │
│ └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘      │
│ Verse ─────────────────  Chorus ───────────────         │
│                                                          │
│ Quick swaps (click to try):                             │
│ • Replace Am with Em (brighter)                         │
│ • Replace F with Dm (more tension)                      │
│ • Add 7ths for jazzy feel                               │
│                                                          │
│ [Regenerate]        [Customize Each]        [Continue]  │
└──────────────────────────────────────────────────────────┘

Step 7: Melody & Bass Guidance
┌──────────────────────────────────────────────────────────┐
│ Tips for your melody:                                    │
│                                                          │
│ Based on your Energetic Pop song:                       │
│ • Start phrases on chord tones (C, E, G over C Major)   │
│ • Use stepwise motion for smooth flow                   │
│ • End phrases on the root for stability                 │
│ • Rhythm: Try syncopation for energy                    │
│                                                          │
│ Auto-generated starter motif:        [▶ Play] [Use This]│
│ 🎵 C - D - E - G - E - D - C                            │
│                                                          │
│ Bass pattern suggestion:                                 │
│ ┌────────┐ ┌────────┐ ┌────────┐                       │
│ │Root-5th│ │ Walking│ │Arpeggio│                       │
│ │  ♩  ♩  │ │♩ ♩ ♩ ♩│ │♪♪♪♪   │                       │
│ └────────┘ └────────┘ └────────┘                       │
│                                                          │
│ [Skip]                                       [Continue]  │
└──────────────────────────────────────────────────────────┘

Step 8: Launch Composition
┌──────────────────────────────────────────────────────────┐
│ Your song is ready! 🎉                                   │
│                                                          │
│ Summary:                                                 │
│ • Mood: Energetic                                        │
│ • Style: Pop                                             │
│ • Structure: Verse-Chorus                                │
│ • Tempo: 120 BPM, Straight                              │
│ • Key: C Major                                           │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ☑ Enable AI melody suggestions                      │ │
│ │ ☑ Show chord tone highlighting                      │ │
│ │ ☐ Show beginner tutorials                           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│        [◀ Go Back]              [🚀 Start Composing]    │
└──────────────────────────────────────────────────────────┘
```

**Success Metrics:**
- [ ] Wizard completion rate >80%
- [ ] First-time users create song in <5 minutes
- [ ] All mood/style combinations produce appropriate results
- [ ] Structure templates generate correct measure counts

---

#### 5. Multi-Section Song Builder

**Impact:** HIGH
**Effort:** Medium
**Timeline:** 3 weeks

**Why This Is Killer:**
- Moves users from "progressions" to "complete songs"
- Each section can have its own key/tempo
- Automatic transition suggestions between sections
- Full song timeline visualization

**Features:**

##### Section Types
| Section | Typical Length | Tension Profile | Description |
|---------|----------------|-----------------|-------------|
| Intro | 4-8 measures | Low, building | Sets the mood, establishes key |
| Verse | 8-16 measures | Low-Medium | Tells the story, conversational melody |
| Pre-Chorus | 4-8 measures | Rising | Builds anticipation for chorus |
| Chorus | 8-16 measures | High (peak) | Main hook, memorable melody |
| Bridge | 4-8 measures | Contrasting | New perspective, often different key |
| Outro | 4-8 measures | Resolving | Wraps up, fade out or definitive end |
| Instrumental | Variable | Variable | Solo section, no vocals |

##### UI Design
```
┌──────────────────────────────────────────────────────────┐
│ Song Structure                          [+ Add Section]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ ┌──────┬────────┬────────┬────────┬──────┬───────────┐  │
│ │Intro │ Verse 1│ Chorus │ Verse 2│Bridge│  Chorus 2 │  │
│ │ 4m   │   8m   │   8m   │   8m   │  4m  │    8m     │  │
│ │ 🔵   │   🟢   │   🟣   │   🟢   │  🟡  │    🟣     │  │
│ │C Maj │ C Maj  │ C Maj  │ C Maj  │A min │  C Maj    │  │
│ └──────┴────────┴────────┴────────┴──────┴───────────┘  │
│                                                          │
│ Total: 40 measures | ~2:40 at 120 BPM                   │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│ Currently editing: [Verse 1 ▼]     Key: C Major         │
│                                                          │
│ ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐      │
│ │  C  │  Am │  F  │  G  │  C  │  Am │  F  │  G  │      │
│ │  I  │  vi │  IV │  V  │  I  │  vi │  IV │  V  │      │
│ └─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘      │
│                                                          │
│ [Copy to Verse 2]  [Suggest Transition to Chorus]       │
└──────────────────────────────────────────────────────────┘
```

##### Section Operations
- **Add section**: Choose type, auto-suggest appropriate progression
- **Copy section**: Duplicate with optional variations (add 7ths, change key)
- **Reorder**: Drag and drop sections
- **Transition assist**: Suggest turnaround chords between sections
- **Key change**: Automatic pivot chord suggestions for modulation
- **Delete section**: With confirmation

##### Transition Intelligence
```javascript
// When moving from Verse (C Major) to Chorus (same key)
suggestTransition('verse', 'chorus', 'C', 'C') => [
  { chord: 'G', reason: 'V creates anticipation for chorus' },
  { chord: 'G/B', reason: 'Bass walkup C-D-E into chorus' },
  { chord: 'F-G', reason: 'IV-V builds maximum tension' }
]

// When moving from Bridge (A minor) back to Chorus (C Major)
suggestTransition('bridge', 'chorus', 'Am', 'C') => [
  { chord: 'E7', reason: 'V7 of Am becomes V7/vi, pivot to C' },
  { chord: 'G', reason: 'Direct dominant preparation' },
  { chord: 'Dm-G', reason: 'ii-V provides smooth modulation' }
]
```

**Success Metrics:**
- [ ] 6+ section types supported
- [ ] Drag-drop reordering works smoothly
- [ ] Transition suggestions are musically appropriate
- [ ] Export includes all sections in correct order
- [ ] Per-section key/tempo works correctly

---

#### 6. Expanded Scale Library

**Impact:** MEDIUM-HIGH
**Effort:** LOW
**Timeline:** 3-4 days

**Scales to Add:**

```javascript
// Add to src/data/music-data.js or equivalent

const ADDITIONAL_SCALES = {
  // Essential Minor Variants
  'harmonic-minor': {
    name: 'Harmonic Minor',
    intervals: [0, 2, 3, 5, 7, 8, 11],
    description: 'Natural minor with raised 7th - creates strong V-i cadence',
    difficulty: 'intermediate',
    commonUses: ['Classical minor keys', 'Flamenco', 'Middle Eastern music'],
    relatedChords: ['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°']
  },
  'melodic-minor': {
    name: 'Melodic Minor (Jazz)',
    intervals: [0, 2, 3, 5, 7, 9, 11],
    description: 'Minor with raised 6th and 7th - smooth melodic motion',
    difficulty: 'intermediate',
    commonUses: ['Jazz improvisation', 'Classical melody writing'],
    modes: ['Melodic Minor', 'Dorian b2', 'Lydian Augmented', 'Lydian Dominant',
            'Mixolydian b6', 'Locrian #2', 'Altered/Super Locrian']
  },

  // Symmetric Scales
  'whole-tone': {
    name: 'Whole Tone',
    intervals: [0, 2, 4, 6, 8, 10],
    description: 'All whole steps - dreamy, floating, no clear resolution',
    difficulty: 'advanced',
    commonUses: ['Impressionism (Debussy)', 'Dream sequences', 'Augmented chords'],
    note: 'Only 2 unique whole tone scales exist (C and Db)'
  },
  'diminished-wh': {
    name: 'Diminished (Whole-Half)',
    intervals: [0, 2, 3, 5, 6, 8, 9, 11],
    description: 'Alternating W-H pattern - tension, suspense, mystery',
    difficulty: 'advanced',
    commonUses: ['Diminished chord improvisation', 'Suspense in film'],
    note: 'Only 3 unique diminished scales exist'
  },
  'diminished-hw': {
    name: 'Diminished (Half-Whole)',
    intervals: [0, 1, 3, 4, 6, 7, 9, 10],
    description: 'Alternating H-W pattern - dominant function, jazz tension',
    difficulty: 'advanced',
    commonUses: ['Over dominant 7th chords', 'Jazz improvisation']
  },

  // Bebop Scales
  'bebop-major': {
    name: 'Bebop Major',
    intervals: [0, 2, 4, 5, 7, 8, 9, 11],
    description: 'Major scale with added #5 - keeps chord tones on beats',
    difficulty: 'advanced',
    commonUses: ['Jazz walking bass', 'Bebop-style improvisation']
  },
  'bebop-dominant': {
    name: 'Bebop Dominant',
    intervals: [0, 2, 4, 5, 7, 9, 10, 11],
    description: 'Mixolydian with added natural 7 - jazz standard',
    difficulty: 'advanced',
    commonUses: ['Over dominant 7th chords in jazz']
  },
  'bebop-minor': {
    name: 'Bebop Minor (Dorian)',
    intervals: [0, 2, 3, 4, 5, 7, 9, 10],
    description: 'Dorian with added major 3rd - smooth voice leading',
    difficulty: 'advanced',
    commonUses: ['Over minor 7th chords in jazz']
  },

  // Exotic/World Scales
  'phrygian-dominant': {
    name: 'Phrygian Dominant',
    intervals: [0, 1, 4, 5, 7, 8, 10],
    description: 'Flamenco/Middle Eastern - exotic tension',
    difficulty: 'intermediate',
    commonUses: ['Flamenco guitar', 'Middle Eastern music', 'Metal'],
    aliases: ['Spanish Gypsy', 'Freygish', 'Ahava Rabbah']
  },
  'hungarian-minor': {
    name: 'Hungarian Minor',
    intervals: [0, 2, 3, 6, 7, 8, 11],
    description: 'Double harmonic minor - dramatic, exotic',
    difficulty: 'advanced',
    commonUses: ['Eastern European folk', 'Film scores'],
    aliases: ['Gypsy Minor', 'Double Harmonic Minor']
  },
  'double-harmonic': {
    name: 'Double Harmonic Major',
    intervals: [0, 1, 4, 5, 7, 8, 11],
    description: 'Byzantine scale - Middle Eastern, mysterious',
    difficulty: 'advanced',
    commonUses: ['Middle Eastern music', 'Byzantine chant'],
    aliases: ['Arabic', 'Byzantine', 'Gypsy Major']
  },
  'hirajoshi': {
    name: 'Hirajoshi',
    intervals: [0, 2, 3, 7, 8],
    description: 'Japanese pentatonic - serene, contemplative',
    difficulty: 'intermediate',
    commonUses: ['Japanese music', 'Meditation music', 'Video game soundtracks']
  },

  // Jazz Extensions
  'lydian-dominant': {
    name: 'Lydian Dominant',
    intervals: [0, 2, 4, 6, 7, 9, 10],
    description: 'Lydian with b7 - sophisticated jazz tension',
    difficulty: 'advanced',
    commonUses: ['Over 7#11 chords', 'Jazz fusion'],
    derivation: '4th mode of melodic minor'
  },
  'altered': {
    name: 'Altered (Super Locrian)',
    intervals: [0, 1, 3, 4, 6, 8, 10],
    description: 'Maximum tension - all alterations on dominant',
    difficulty: 'advanced',
    commonUses: ['Over altered dominant chords (7b9, 7#9, 7b5, 7#5)'],
    derivation: '7th mode of melodic minor'
  },

  // Blues Variants
  'major-blues': {
    name: 'Major Blues',
    intervals: [0, 2, 3, 4, 7, 9],
    description: 'Major pentatonic with added b3 - bright blues',
    difficulty: 'beginner',
    commonUses: ['Happy blues', 'Country', 'Gospel']
  }
};
```

**UI Enhancement for Scale Explorer:**
```
┌──────────────────────────────────────────────────────────┐
│ Scale Explorer                                           │
├──────────────────────────────────────────────────────────┤
│ Filter: [All ▼] [Beginner ▼]                            │
│                                                          │
│ Categories:                                              │
│ ├── Basic (Major, Minor, Pentatonic)                    │
│ ├── Modes (Dorian, Phrygian, Lydian...)                 │
│ ├── Minor Variants (Harmonic, Melodic)        ← NEW     │
│ ├── Symmetric (Whole Tone, Diminished)        ← NEW     │
│ ├── Bebop Scales                              ← NEW     │
│ ├── World/Exotic                              ← NEW     │
│ └── Jazz Extensions                           ← NEW     │
│                                                          │
│ Selected: Harmonic Minor in A                           │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ A  B  C  D  E  F  G# A                              │ │
│ │ 1  2  b3 4  5  b6 7  1                              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ [Piano keyboard visualization with highlighted notes]   │
│                                                          │
│ Common uses: Classical minor keys, Flamenco            │
│ Related chords: Am, Bdim, Caug, Dm, E, F, G#dim        │
│                                                          │
│ [▶ Play Ascending] [▶ Play Descending] [▶ Play Pattern]│
└──────────────────────────────────────────────────────────┘
```

**Success Metrics:**
- [ ] 15+ new scales added
- [ ] Each scale has description, difficulty, common uses
- [ ] Keyboard visualization works for all scales
- [ ] Playback works correctly (especially for 8-note scales)
- [ ] Scale filtering by difficulty/category works

---

### Tier 3: Engagement & Fun Features

#### 7. "Surprise Me" / Random Inspiration Button

**Impact:** MEDIUM
**Effort:** LOW
**Timeline:** 2-3 days

**Why This Matters:**
- Breaks creative block instantly
- Teaches by example (random good progressions)
- Fun and engaging
- Low friction discovery

**Features:**
```
┌──────────────────────────────────────────────────────────┐
│                    🎲 Surprise Me!                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Generated: Am - F - C - G                              │
│  Key: A Minor | Style: Pop | Mood: Melancholic          │
│                                                          │
│  AI Analysis:                                            │
│  "This is the 'Axis of Awesome' progression - used in   │
│   hundreds of hit songs including 'Someone Like You'    │
│   and 'Let It Be'. The vi-IV-I-V creates a bittersweet │
│   feeling that audiences love."                         │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │ [▶ Play]  [🎲 Regenerate]  [Use This]  [Modify]    ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  Constraints (optional):                                 │
│  ☐ Match current mood setting                           │
│  ☐ Include jazz chords                                  │
│  ☑ Keep it beginner-friendly                            │
│  ☐ Must include a ii-V-I                                │
└──────────────────────────────────────────────────────────┘
```

**Algorithm:**
1. Select random style/mood (or use current settings)
2. Choose from curated "interesting" progressions database
3. Apply random key transposition
4. Score with existing recommendation engine
5. Generate explanation using pattern detection

---

#### 8. Famous Song Analysis Mode

**Impact:** HIGH
**Effort:** Medium
**Timeline:** 2 weeks

**Why This Matters:**
- Learn from real music people know
- "Oh, THAT'S why this song sounds good!"
- Bridges theory to actual songs
- Highly shareable ("Look what I learned about my favorite song!")

**Features:**

##### Song Database
```javascript
const FAMOUS_SONGS = [
  {
    title: "Let It Be",
    artist: "The Beatles",
    year: 1970,
    key: "C",
    progression: ["C", "G", "Am", "F"],
    analysis: {
      romanNumerals: ["I", "V", "vi", "IV"],
      pattern: "I-V-vi-IV (Pop Progression)",
      function: ["Tonic", "Dominant", "Tonic substitute", "Subdominant"],
      explanation: "This is the '4 chord song' progression - arguably the most popular in pop music history."
    },
    spotifyId: "xxx" // For audio preview
  },
  {
    title: "Autumn Leaves",
    artist: "Jazz Standard",
    year: 1945,
    key: "Am",
    progression: ["Am7", "D7", "Gmaj7", "Cmaj7", "F#m7b5", "B7", "Em"],
    analysis: {
      romanNumerals: ["ii7", "V7", "Imaj7", "IVmaj7", "vii7b5", "V7/vi", "vi"],
      pattern: "ii-V-I with turnaround",
      function: ["Subdominant", "Dominant", "Tonic", "Subdominant",
                 "Leading tone", "Secondary dominant", "Relative major tonic"],
      explanation: "Classic jazz standard demonstrating the ii-V-I progression in both major and minor."
    }
  },
  // ... 50+ songs across genres
];
```

##### UI Design
```
┌──────────────────────────────────────────────────────────┐
│ 🎵 Famous Song Analysis                    [Search 🔍]   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ Browse by: [All] [Pop] [Rock] [Jazz] [Classical] [Folk] │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🎸 Let It Be - The Beatles                          │ │
│ │ Progression: C - G - Am - F (I - V - vi - IV)       │ │
│ │ ★★☆☆☆ Beginner                                      │ │
│ │ [Analyze] [Load Progression]                         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🎷 Autumn Leaves - Jazz Standard                    │ │
│ │ Progression: Am7 - D7 - Gmaj7 - Cmaj7...           │ │
│ │ ★★★★☆ Advanced                                      │ │
│ │ [Analyze] [Load Progression]                         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

##### Analysis View
```
┌──────────────────────────────────────────────────────────┐
│ Analysis: Let It Be - The Beatles                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ [▶ Play] [🎵 Spotify Preview]                           │
│                                                          │
│ ┌─────┬─────┬─────┬─────┐                               │
│ │  C  │  G  │  Am │  F  │                               │
│ │  I  │  V  │  vi │  IV │                               │
│ │ T   │ D   │ T'  │ S   │                               │
│ └─────┴─────┴─────┴─────┘                               │
│                                                          │
│ Pattern Detected: I-V-vi-IV                             │
│                                                          │
│ Why It Works:                                            │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ This is the "Axis of Awesome" progression, used in      │
│ hundreds of pop hits. Here's why it's so effective:     │
│                                                          │
│ 1. Starts on I (C) - establishes home clearly           │
│ 2. Moves to V (G) - creates expectation                 │
│ 3. Deceptive move to vi (Am) - surprise! Adds emotion   │
│ 4. IV (F) - subdominant provides gentle tension         │
│ 5. Loops back to I - satisfying resolution              │
│                                                          │
│ The vi chord (Am) shares two notes with I (C-E), so     │
│ the deceptive resolution still feels related to home.   │
│                                                          │
│ Other songs using this progression:                      │
│ • "Someone Like You" - Adele                            │
│ • "No Woman No Cry" - Bob Marley                        │
│ • "With or Without You" - U2                            │
│ • "Apologize" - OneRepublic                             │
│                                                          │
│ [Load This Progression]  [Compare With Mine]             │
└──────────────────────────────────────────────────────────┘
```

**Success Metrics:**
- [ ] 50+ famous songs in database
- [ ] Covers all major genres
- [ ] Difficulty-rated appropriately
- [ ] Analysis is accurate and educational
- [ ] Spotify preview integration works (where available)

---

#### 9. Practice Mode with Spaced Repetition

**Impact:** HIGH
**Effort:** Medium
**Timeline:** 2-3 weeks

**Why This Matters:**
- Transforms one-time learning into retained knowledge
- Daily engagement = habit formation
- Proven learning science (Anki algorithm)
- Differentiates from "toy" music apps

**Exercise Types:**

##### A. Chord Building Flashcards
```
Front: Build a Cmaj7 chord
Back:  C - E - G - B (Root, Major 3rd, Perfect 5th, Major 7th)

Front: What notes are in F#m7?
Back:  F# - A - C# - E

Front: Build a dominant 7th on Bb
Back:  Bb - D - F - Ab
```

##### B. Interval Recognition
```
Front: What interval is C to Ab?
Back:  Minor 6th (8 half steps)

Front: Build a Perfect 5th above E
Back:  B
```

##### C. Progression Completion
```
Front: ii - V - ? in C Major
Back:  I (Dm - G - C)

Front: Complete the plagal cadence: ? - I
Back:  IV (F - C in C Major)
```

##### D. Function Identification
```
Front: In C Major, what function does Am serve?
Back:  Tonic substitute (vi shares 2 notes with I)

Front: What Roman numeral is Eb Major in C Major?
Back:  bIII (borrowed from parallel minor)
```

**Spaced Repetition Algorithm:**
```javascript
// Based on SM-2 algorithm (used by Anki)
function calculateNextReview(card, quality) {
  // quality: 0-5 (0 = total fail, 5 = perfect recall)

  if (quality < 3) {
    // Failed - reset to learning phase
    card.interval = 1; // Review tomorrow
    card.easeFactor = Math.max(1.3, card.easeFactor - 0.2);
  } else {
    // Passed - increase interval
    if (card.interval === 0) {
      card.interval = 1;
    } else if (card.interval === 1) {
      card.interval = 6;
    } else {
      card.interval = Math.round(card.interval * card.easeFactor);
    }

    // Adjust ease factor
    card.easeFactor += (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    card.easeFactor = Math.max(1.3, card.easeFactor);
  }

  card.nextReview = addDays(today, card.interval);
  return card;
}
```

**UI Design:**
```
┌──────────────────────────────────────────────────────────┐
│ 📚 Daily Practice                     Streak: 🔥 14 days │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Today's Review: 12 cards    |    New: 5 cards          │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │                                                     ││
│  │        Build a Dominant 7th chord on G             ││
│  │                                                     ││
│  │                  [Show Answer]                      ││
│  │                                                     ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  Progress: ████████████░░░░░░░░ 7/17 cards              │
│                                                          │
│  [Skip]                                        [Exit]    │
└──────────────────────────────────────────────────────────┘

After clicking "Show Answer":

┌──────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────┐│
│  │                                                     ││
│  │        Build a Dominant 7th chord on G             ││
│  │        ─────────────────────────────────           ││
│  │        Answer: G - B - D - F                       ││
│  │        (Root, Major 3rd, Perfect 5th, Minor 7th)   ││
│  │                                                     ││
│  │        [🎵 Play chord]                             ││
│  │                                                     ││
│  └─────────────────────────────────────────────────────┘│
│                                                          │
│  How well did you know this?                            │
│                                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│  │ Again  │ │  Hard  │ │  Good  │ │  Easy  │          │
│  │ <1 min │ │ 10 min │ │ 1 day  │ │ 4 days │          │
│  └────────┘ └────────┘ └────────┘ └────────┘          │
└──────────────────────────────────────────────────────────┘
```

**Gamification:**
- Daily streak tracking with visual fire emoji
- Weekly XP goals
- Badges for milestones (100 cards reviewed, 30-day streak)
- Leaderboard (optional, friends only)

**Success Metrics:**
- [ ] 200+ cards in initial deck
- [ ] Spaced repetition algorithm works correctly
- [ ] Streak tracking motivates daily return
- [ ] 40%+ daily active users complete practice
- [ ] Knowledge retention measurably improves

---

#### 10. Composition Challenges

**Impact:** MEDIUM-HIGH
**Effort:** Medium
**Timeline:** 2 weeks

**Why This Matters:**
- Forces application of learned concepts
- Community aspect (see others' solutions)
- Weekly engagement driver
- Creates shareable content

**Challenge Types:**

##### A. Constraint Challenges
```
"Write a 4-chord progression using ONLY borrowed chords from the parallel minor"
"Create a verse using only 3 different notes in the melody"
"Build an 8-bar progression without using the I chord until the end"
```

##### B. Style Challenges
```
"Write a progression that sounds like The Beatles"
"Create a jazz turnaround using tritone substitution"
"Compose a progression suitable for a movie chase scene"
```

##### C. Theory Application
```
"Use a secondary dominant to tonicize the vi chord"
"Create a progression demonstrating deceptive cadence"
"Write using the Dorian mode - make it sound medieval"
```

##### D. Completion Challenges
```
"Finish this verse: C - Am - ? - ?"
"Add a bridge that modulates to the relative minor"
"Extend this 4-chord loop into an 8-bar verse"
```

**UI Design:**
```
┌──────────────────────────────────────────────────────────┐
│ 🏆 Weekly Challenge                    Ends in: 3d 14h   │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ This Week: "The Borrowed Chord Challenge"               │
│                                                          │
│ Write a progression in C Major that includes at least   │
│ TWO borrowed chords from C minor. The progression       │
│ should feel emotionally "bittersweet."                  │
│                                                          │
│ Requirements:                                            │
│ ✓ Key: C Major                                          │
│ ✓ Length: 4-8 chords                                    │
│ ✓ Must include 2+ borrowed chords                       │
│ ✓ Should resolve to I at the end                        │
│                                                          │
│ Hints:                                                   │
│ • Common borrowed chords: iv, bVI, bVII, bIII          │
│ • bVI - bVII - I is the "Mario Cadence"                │
│                                                          │
│ [Start Challenge]                                        │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│ Community Submissions: 47                                │
│                                                          │
│ Top Rated:                                               │
│ 1. @jazzycomposer: C - Ab - Bb - C  ⭐⭐⭐⭐⭐ (23 votes) │
│ 2. @newbie42: C - Fm - G - C       ⭐⭐⭐⭐ (18 votes)   │
│ 3. @theorynerd: C - Eb - Ab - G - C ⭐⭐⭐⭐ (15 votes)  │
│                                                          │
│ [View All Submissions]                                   │
└──────────────────────────────────────────────────────────┘
```

**Success Metrics:**
- [ ] New challenge every week
- [ ] 20+ submissions per challenge
- [ ] Rating/voting system works
- [ ] Top submissions are genuinely creative
- [ ] Challenges cover all difficulty levels

---

### Tier 4: Professional Features

#### 11. MusicXML Export

**Impact:** MEDIUM-HIGH
**Effort:** Medium
**Timeline:** 2 weeks

**Why This Matters:**
- Industry standard format
- Opens in MuseScore, Finale, Sibelius, Dorico
- Shows professional legitimacy
- Bridges to advanced composition workflow

**Implementation:**
```javascript
// Use musicxml-interfaces library
import { MusicXML } from 'musicxml-interfaces';

function exportToMusicXML(composition) {
  const musicXML = new MusicXML.ScorePartwise({
    partList: [{
      id: 'P1',
      partName: 'Piano'
    }],
    parts: [{
      id: 'P1',
      measures: composition.measures.map(measure => ({
        attributes: {
          divisions: 4,
          key: { fifths: getKeyFifths(composition.key) },
          time: { beats: measure.timeSignature.beats, beatType: measure.timeSignature.beatType },
          clef: { sign: 'G', line: 2 }
        },
        notes: measure.notes.map(note => ({
          pitch: { step: note.step, octave: note.octave, alter: note.alter },
          duration: note.duration,
          type: getDurationType(note.duration)
        }))
      }))
    }]
  });

  return musicXML.serialize();
}
```

**Supported Elements:**
- Notes with pitch, duration, accidentals
- Rests
- Chord symbols
- Key signatures
- Time signatures
- Clefs (treble, bass)
- Measure numbers
- Title and composer metadata

**Success Metrics:**
- [ ] Export opens correctly in MuseScore
- [ ] Export opens correctly in Finale (if available for testing)
- [ ] All note pitches and durations preserved
- [ ] Chord symbols appear above staff
- [ ] Key/time signatures correct

---

#### 12. Real-Time Collaboration (Future / Premium)

**Impact:** VERY HIGH
**Effort:** Hard
**Timeline:** 6-8 weeks

**Why This Matters:**
- Teachers can guide students remotely
- Friends can jam together
- Unique in the theory-teaching space
- Premium tier justification

**Features:**
- Shared sessions via unique link
- Multiple users editing simultaneously
- See others' cursors/selections
- Chat sidebar
- Teacher mode (control who can edit)
- Conflict resolution (last write wins with history)

**Technical Approach:**
- WebSocket server for real-time sync
- Operational Transform or CRDT for conflict resolution
- Room-based sessions with unique IDs
- Cursor presence broadcasting

**Consider for Phase 2 / Premium tier**

---

## Features That Make It FUN

### The Psychology of Engagement

#### 1. Instant Gratification
- **Audio export** lets users share immediately
- **Preview sounds** before committing to changes
- **"One-click arrangement"** with bass and simple drums
- **Immediate playback** of any chord/progression

#### 2. Progressive Disclosure
- **Beginner mode** hides advanced options by default
- **"Show Advanced"** reveals more when ready
- **Difficulty badges** on templates and features
- **Gradual unlock** of complex chord types

#### 3. Social Proof
- **"Used in 10,000+ compositions"** counters
- **Community gallery** of creations
- **"This chord works in 80% of pop songs"** stats
- **Famous song examples** for every concept

#### 4. Achievement Dopamine
- **Granular XP rewards** (not just lesson completion)
- **Unlock sounds/instruments** as rewards
- **Daily login streak bonuses**
- **Badge collection** with display showcase

#### 5. Creative Serendipity
- **"Surprise Me"** button for random inspiration
- **Random constraints** ("Write using only 3 chords")
- **AI-suggested "what if"** alternatives
- **Daily creative prompt** notifications

#### 6. Emotional Connection
- **Name your compositions** (not just "Untitled")
- **Album art generator** (simple geometric/gradient)
- **"Your Top Compositions"** annual recap
- **Shareable "I made this"** cards

### The "I Can't Stop" Loop

```
1. Start with wizard (low friction) ─────────────────────┐
                                                         │
2. Get AI suggestions (feels collaborative) ◄────────────┤
                                                         │
3. Learn why it works (builds knowledge) ◄───────────────┤
                                                         │
4. Challenge yourself (ear training, practice mode) ◄────┤
                                                         │
5. Share your creation (social validation) ◄─────────────┤
                                                         │
6. Come back tomorrow (streaks, daily challenges) ───────┘
```

---

## UX Recommendations for Intuitive Navigation

### 1. Unified "Create" Flow

Instead of separate disconnected tabs, consider a workflow-based approach:

```
[Start New Song]
     ↓
  Wizard (mood, style, structure)
     ↓
  Progression Builder (chord sequence)
     ↓
  Melody Composer (add melody)
     ↓
  Arrangement (bass patterns, structure)
     ↓
  Export (PDF, MIDI, Audio)
```

Each step can be skipped or returned to, but the flow guides beginners naturally.

### 2. Contextual Help Everywhere

- **Every button** has a tooltip on hover
- **Every panel** has a "?" icon that opens relevant lesson
- **"Why this?"** link on every AI suggestion
- **"Learn more"** expands inline explanations

### 3. Visual Hierarchy

```
Primary Actions (Large, Colorful):
[Add Chord] [Play] [Generate]

Secondary Actions (Medium, Subtle):
[Settings] [Export] [Share]

Destructive Actions (Small, Require Confirmation):
[Clear] [Delete] [Reset]
```

### 4. Keyboard-First for Power Users

| Shortcut | Action |
|----------|--------|
| Tab | Open recommendations modal |
| Space | Play/Pause |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+S | Save |
| Ctrl+E | Export |
| ? | Show keyboard shortcuts |
| 1-9 | Jump to section |

### 5. Mobile-Friendly Basics

- Touch-friendly chord selection (large tap targets)
- Swipe to navigate between sections
- Simplified notation view for small screens
- Full functionality requires desktop (communicate clearly)

---

## Implementation Roadmap

### Sprint 1: Complete the Foundation (2 weeks)
| Task | Effort | Impact |
|------|--------|--------|
| Voice Leading SVG Visualization | 3 days | High |
| Expanded Scale Library | 2 days | Medium-High |
| Version History Timeline UI | 3 days | Medium |
| Complete Section Tab Wiring | 2 days | Medium |

**Deliverable:** All partially-implemented features completed

### Sprint 2: The Fun Factor (3 weeks)
| Task | Effort | Impact |
|------|--------|--------|
| Audio Export (WAV/MP3) | 5 days | Very High |
| "Surprise Me" Generation | 2 days | Medium |
| Enhanced Wizard (style/genre) | 5 days | High |
| Modulation Teaching Tools | 3 days | Medium |

**Deliverable:** Users can share audio; wizard feels complete

### Sprint 3: The Differentiator (4 weeks)
| Task | Effort | Impact |
|------|--------|--------|
| Ear Training Module | 10 days | Very High |
| Practice Mode (Spaced Repetition) | 5 days | High |
| Famous Song Analysis Mode | 5 days | High |

**Deliverable:** Integrated ear training that no competitor has

### Sprint 4: Song Building (3 weeks)
| Task | Effort | Impact |
|------|--------|--------|
| Multi-Section Song Builder | 8 days | High |
| Section Transitions | 3 days | Medium |
| Composition Challenges Framework | 4 days | Medium-High |

**Deliverable:** Users create complete songs, not just progressions

### Sprint 5: Professional Polish (2 weeks)
| Task | Effort | Impact |
|------|--------|--------|
| MusicXML Export | 5 days | Medium-High |
| Counterpoint Lessons | 3 days | Medium |
| Advanced Rhythm Concepts | 2 days | Medium |

**Deliverable:** Professional output format; complete theory coverage

### Future Sprints (Backlog)
- Real-Time Collaboration (6-8 weeks)
- Mobile Companion App (8-10 weeks)
- Community Platform (6-8 weeks)
- AI Composition Assistant (4-6 weeks)

---

## Competitive Differentiation

### Current Competitive Landscape

| Feature | Music Theory Lab | Hookpad | MuseScore | Flat.io | Noteflight |
|---------|-----------------|---------|-----------|---------|------------|
| **Price** | Free | $10/mo | Free | $10/mo | $8/mo |
| **AI Chord Suggestions** | ✅ (3D engine) | ✅ (basic) | ❌ | ❌ | ❌ |
| **AI Melody Suggestions** | ✅ (advanced) | ✅ (basic) | ❌ | ❌ | ❌ |
| **Auto-Harmonize** | ✅ (style-aware) | ✅ (basic) | ❌ | ❌ | ❌ |
| **Theory Lessons** | ✅ (20+) | ✅ (some) | ❌ | ❌ | ❌ |
| **Ear Training** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Notation Quality** | ✅ (VexFlow) | ❌ | ✅ (best) | ✅ | ✅ |
| **PDF Export** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Audio Export** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **MusicXML Export** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Multi-Section** | ⚠️ (basic) | ✅ | ✅ | ✅ | ✅ |
| **Collaboration** | ❌ | ❌ | ❌ | ✅ | ✅ |

### After Implementing This Roadmap

| Feature | Music Theory Lab | Competitors |
|---------|-----------------|-------------|
| **AI Chord Suggestions** | ✅✅ (3D, style, mood) | ✅ (basic) |
| **AI Melody Suggestions** | ✅✅ (context-aware) | ✅ (basic) |
| **Theory Lessons** | ✅✅ (20+, multi-level) | ✅ (limited) |
| **Ear Training** | ✅✅ (integrated) | ❌ |
| **Audio Export** | ✅ | ⚠️ (Hookpad only) |
| **MusicXML Export** | ✅ | ✅ |
| **Multi-Section** | ✅✅ | ✅ |
| **Famous Song Analysis** | ✅✅ | ❌ |
| **Spaced Repetition** | ✅✅ | ❌ |
| **Voice Leading Visualization** | ✅✅ | ❌ |

### Unique Selling Points (After Roadmap)

1. **Only tool combining composition + ear training + theory lessons**
2. **3D chord recommendation engine** (root × type × inversion)
3. **Multi-level explanations** (Simple → Intermediate → Advanced)
4. **Voice leading visualization** (see the theory)
5. **Famous song analysis** (learn from real music)
6. **Spaced repetition practice** (retain what you learn)
7. **Free with no paywall on core features**

---

## Success Metrics

### User Engagement
| Metric | Current | Target |
|--------|---------|--------|
| Average session length | ? | >15 minutes |
| Daily active users (DAU) | ? | >1,000 |
| Weekly return rate | ? | >40% |
| Wizard completion rate | ? | >80% |

### Feature Adoption
| Metric | Target |
|--------|--------|
| Users trying melody suggestions | >80% |
| Users using auto-harmonize | >60% |
| Users completing ear training daily | >30% |
| Users exporting at least once | >50% |

### Learning Outcomes
| Metric | Target |
|--------|--------|
| Lesson completion rate | >60% |
| Ear training accuracy improvement | >20% over 30 days |
| Practice mode streak average | >7 days |
| Users creating multi-section songs | >40% |

### Quality
| Metric | Target |
|--------|--------|
| AI suggestions rated "helpful" | >80% |
| Voice leading scores average | >80 |
| Export files open correctly | >95% |
| Bug reports per 1,000 sessions | <5 |

### Growth
| Metric | Target |
|--------|--------|
| Word-of-mouth referrals | >20% of new users |
| Social shares (audio exports) | >5% of users |
| Educational institution adoption | >10 schools |
| Press/blog mentions | >5 per quarter |

---

## What Would Make This "The Best in the World"

### The "Aha Moment" Stack

For users to truly learn and remember, they need multiple reinforcement modes:

1. **SEE** → Voice leading lines showing exactly how notes connect
2. **HEAR** → Ear training using their own compositions
3. **CREATE** → AI suggestions that teach while they build
4. **PRACTICE** → Spaced repetition cementing knowledge
5. **SHARE** → Audio export proving what they made

### The Trust Builders

Users trust and recommend tools that:

1. **Explain every suggestion** with clear theory
2. **Show famous examples** they recognize
3. **Match their skill level** (difficulty filtering)
4. **Never feel like a black box** (transparent AI)

### The "I Can't Stop" Formula

```
Low Friction Entry (Wizard)
        +
Immediate Reward (Hear your song)
        +
Learning Without Trying (Why This Works)
        +
Challenge & Growth (Ear Training)
        +
Social Validation (Share Audio)
        +
Daily Habit (Streaks, Practice Mode)
        =
ADDICTION (the good kind)
```

### The Ultimate Vision

> *"Music Theory Lab is where anyone—from complete beginner to advanced musician—comes to learn, create, and share music. It's the only tool that teaches you WHY music works while you CREATE music. Every feature explains itself. Every creation teaches you something. And when you're done, you can share real audio that sounds like YOU made it—because you did."*

---

## Appendix: Quick Reference Tables

### Priority Matrix

| Feature | Impact | Effort | Priority Score |
|---------|--------|--------|----------------|
| Audio Export | Very High | Medium | **1** |
| Ear Training | Very High | Medium | **2** |
| Voice Leading Viz | High | Low | **3** |
| Enhanced Wizard | High | Medium | **4** |
| Scale Library | Medium-High | Low | **5** |
| Multi-Section | High | Medium | **6** |
| Practice Mode | High | Medium | **7** |
| Famous Songs | High | Medium | **8** |
| Surprise Me | Medium | Low | **9** |
| MusicXML | Medium-High | Medium | **10** |
| Challenges | Medium-High | Medium | **11** |
| Collaboration | Very High | Hard | **12** |

### Music Theory Coverage Checklist

| Concept | Status |
|---------|--------|
| Major/Minor Scales | ✅ |
| All 7 Modes | ✅ |
| Pentatonic/Blues | ✅ |
| Harmonic Minor | ❌ Add |
| Melodic Minor | ❌ Add |
| Whole Tone | ❌ Add |
| Diminished | ❌ Add |
| Triads | ✅ |
| 7th Chords | ✅ |
| Extended Chords | ✅ |
| Secondary Dominants | ✅ |
| Modal Interchange | ✅ |
| Tritone Substitution | ✅ |
| Voice Leading | ✅ (score) / ❌ (visual) |
| Counterpoint | ⚠️ Partial |
| Modulation | ❌ Add |
| Rhythm Concepts | ⚠️ Basic |
| Form/Structure | ⚠️ Partial |
| Ear Training | ❌ Add |

---

**Document Version:** 1.0
**Last Updated:** December 2024
**Next Review:** After Sprint 1 completion
