# Music Theory Lab - Product Vision & Roadmap

## The Core Problem

Musicians face a fragmented workflow when working with harmony and chord progressions:

- **Songwriters** record demos but struggle to identify what they played and communicate it to collaborators
- **Students** learn theory in isolation without hearing/seeing how concepts apply to real music
- **Hobbyists** want to write songs but don't know what chord "should" come next
- **Worship leaders & band directors** need quick charts for original arrangements

Existing tools solve pieces of this:
- Chordify detects chords in *existing* songs (not your recordings)
- Noteflight/Finale render notation (but don't help you write)
- Hooktheory teaches theory (but isn't a creation tool)
- DAWs have MIDI (but no theory intelligence)

**Music Theory Lab bridges these gaps** — analyze, understand, create, and export, all in one free browser-based tool.

---

## What Makes This Unique

### 1. Analyze Your Own Music
Most chord detection tools focus on songs in their database. Music Theory Lab analyzes LOCAL audio files — your demos, your recordings, your ideas. This serves songwriters and producers working on original material.

### 2. Theory-Aware Recommendations
Not just "here are the chords" but "here's WHY they work and what could come NEXT."

### 3. Integrated Workflow
Audio analysis → Notation rendering → Theory suggestions → Practice mode → Export. One tool, no context switching.

### 4. Free & Browser-Based
No install, no subscription for core features. Accessible to students and hobbyists.

---

## Target Audiences

| Audience | Pain Point | Value Proposition |
|----------|-----------|-------------------|
| **Indie Songwriters** | "I recorded a demo, now I need a chart for my band" | Demo → Lead Sheet in 60 seconds |
| **Music Students** | "I learn theory but can't apply it" | See/hear theory concepts in context |
| **Worship Teams** | "We need charts for Sunday, fast" | Quick analysis + professional export |
| **Hobbyist Musicians** | "I don't know what chord comes next" | Intelligent suggestions based on theory |
| **Music Teachers** | "I need to create examples and analyze student work" | All-in-one teaching tool |

---

## The Intelligence Layer: Theory & Recommendation Engines

This is the differentiator. While other tools are passive (show you what exists), Music Theory Lab is active (suggests what could be).

### A. Next Chord Recommendations

**How it works:**
- Analyze current progression context (key, recent chords, cadence patterns)
- Suggest chords ranked by:
  - **Common practice** — What statistically follows in this style?
  - **Voice leading** — What moves smoothly from current voicing?
  - **Harmonic function** — What creates appropriate tension/resolution?
  - **Style matching** — Jazz vs Pop vs Classical expectations

**User experience:**
```
Current: Am → F → G → ?

Suggestions:
  [C]  — Resolve to tonic (I). Classic V-I cadence.
  [Am] — Return to vi. Creates loop (Axis progression).
  [E7] — Secondary dominant (V/vi). Adds tension before Am.
  [Dm] — Move to iv. Darker, modal sound.
```

**Implementation approach:**
- Rule-based system using functional harmony (I, IV, V relationships)
- Weighted by detected style/genre
- Voice leading calculator finds smoothest transitions
- User feedback loop: track which suggestions are accepted

### B. Harmony Enhancement Suggestions

**The problem:** Detected chords are often simplified. "A" might really be "A7" or "Amaj7" in context.

**How it works:**
- Compare detected chords against:
  - Online chord databases (what do published charts show?)
  - Harmonic context (dominant chords often want 7ths)
  - Style norms (jazz = extensions, pop = triads)
- Suggest enhancements: "Consider A7 here — dominant 7ths are common before the IV chord"

**User experience:**
```
Detected: D → G → A → D

Suggestions:
  A → A7: "Dominant 7th adds pull toward D (V7-I resolution)"
  G → Gmaj7: "Major 7th adds sophistication (common in singer-songwriter style)"
```

### C. Melody-Harmony Relationship

**How it works:**
- Given a chord progression, suggest melody notes that:
  - Land on chord tones on strong beats
  - Use passing tones and neighbor tones appropriately
  - Follow common melodic patterns for the style
  - Respect voice leading from melody note to melody note

**User experience:**
```
Progression: C → Am → F → G

Melody suggestions for measure 1 (C chord):
  Strong beats: C, E, G (chord tones)
  Passing options: D (between C-E), F (between E-G)
  Tension note: B (major 7, resolve down to G)
```

### D. Secondary Dominants & Borrowed Chords

**Already partially implemented.** Expand to:
- Explain WHY each option works
- Audio preview of each option
- Show notation of how it changes the progression
- Suggest specific voice leading for smooth integration

**User experience:**
```
Current progression: C → Am → Dm → G

Theory suggestions:
  [Insert E7 before Am]: "Secondary dominant (V/vi) creates stronger pull to Am"
  [Replace Dm with D7]: "Secondary dominant (V/V) intensifies motion to G"
  [Replace Am with Ab]: "Borrowed from C minor (bVI). Creates chromatic bass line."
```

### E. Style/Genre Awareness

**How it works:**
- Detect or let user specify genre
- Adjust all recommendations to match style norms:

| Genre | Characteristics | Recommendation Style |
|-------|-----------------|---------------------|
| Pop | Triads, 4-chord loops, predictable | Suggest common patterns (I-V-vi-IV) |
| Jazz | Extensions, ii-V-I, chromatic | Suggest 7ths, 9ths, alterations |
| Classical | Functional harmony, voice leading | Emphasize proper resolution |
| Folk | Simple triads, modal borrowing | Suggest relative minor, modal interchange |
| Gospel | Extended chords, chromatic passing | Suggest 7ths, diminished passing chords |

### F. "Why Does This Work?" Explanations

**The educational layer.** Every suggestion includes:
- Theory explanation in plain language
- Roman numeral analysis
- Audio example
- Historical/style context

**Example:**
```
Why does F → G → C sound good?

This is a IV → V → I progression in C major.
- F (IV) is the subdominant — creates gentle tension
- G (V) is the dominant — creates strong pull toward home
- C (I) is the tonic — resolution, "home" feeling

This is one of the most common progressions in Western music,
found in everything from Bach to The Beatles.

[Play Example] [Show in Notation]
```

---

## Product Roadmap

### Phase 1: Core Polish (Current)
- [x] Audio chord detection
- [x] Notation rendering
- [x] Basic theory tools (secondary dominants, modal interchange)
- [x] Practice/trainer mode
- [ ] Bug fixes and UX improvements

### Phase 2: The "Demo to Lead Sheet" Pipeline
**Goal:** Clear workflow for analyzing original recordings

- [ ] **Section detection** — Identify verse/chorus/bridge from patterns
- [ ] **PDF lead sheet export** — Professional output with chord symbols, structure
- [ ] **MIDI export** — For DAW integration
- [ ] **MusicXML export** — For Finale/Sibelius/MuseScore

**Monetization:** Free to use, paid exports ($3-5 per export or $10/month unlimited)

### Phase 3: Intelligent Recommendations
**Goal:** The theory-aware assistant

- [ ] **Next chord suggestions** — Context-aware recommendations
- [ ] **Harmony enhancement** — "A could be A7 here"
- [ ] **Voice leading optimizer** — Smoothest path between chords
- [ ] **Style detection** — Adjust suggestions to genre

### Phase 4: Educational Layer
**Goal:** Teach while you create

- [ ] **"Why does this work?"** — Explanations for every suggestion
- [ ] **Guided lessons** — "Build your first jazz progression"
- [ ] **Ear training mode** — Identify chords by ear, with feedback
- [ ] **Progress tracking** — What theory concepts have you mastered?

**Monetization:** Free basics, paid courses/certifications

### Phase 5: Collaboration & Community
**Goal:** Share and learn together

- [ ] **Shareable links** — "Here's my progression, what do you think?"
- [ ] **Remix/fork** — Build on others' progressions
- [ ] **Community library** — Browse progressions by style/mood
- [ ] **Teacher tools** — Assign exercises, track student progress

**Monetization:** Free personal use, paid team/education licenses

---

## Revenue Model Options

### Freemium (Recommended)
| Free | Paid ($10/month or $50/year) |
|------|------------------------------|
| Audio analysis (limited minutes) | Unlimited analysis |
| Basic notation view | PDF/MIDI/MusicXML export |
| Theory suggestions | Advanced recommendations |
| Practice mode | Progress tracking |
| | Cloud save & sync |
| | Priority support |

### One-Time Purchases
- Export pack: $5 for 10 exports
- Course bundle: $29 for complete theory course
- Desktop app: $49 one-time

### B2B / Education
- School/church site license: $99/year
- LMS integration: Custom pricing
- White-label: Custom pricing

---

## Competitive Positioning

```
                    Theory Intelligence
                           ↑
                           |
        Music Theory Lab   |   Hooktheory
        (Your recordings,  |   (Learning focused,
         create & learn)   |    limited creation)
                           |
   ←───────────────────────┼───────────────────────→
   Your Music              |              Existing Songs
                           |
        DAWs               |   Chordify
        (Powerful but no   |   (Great detection,
         theory help)      |    no creation tools)
                           |
                           ↓
                    Passive Display
```

**Music Theory Lab's unique position:** Theory-intelligent tools for YOUR original music.

---

## Key Metrics to Track

### Engagement
- Audio files analyzed per user
- Progressions created per session
- Suggestions accepted vs. ignored
- Return visit rate

### Value
- Exports generated (conversion to paid)
- Time spent in learning modules
- Completion rate for guided lessons

### Growth
- Organic signups
- Shared progression views
- Referral rate

---

## The Vision

**Music Theory Lab becomes the intelligent companion for anyone creating music with chords.**

Not just a tool that shows you what exists, but a teacher and collaborator that:
- Understands what you're trying to create
- Suggests improvements grounded in theory
- Explains concepts as you encounter them
- Grows with you from beginner to advanced

The goal isn't to replace human creativity — it's to democratize music theory knowledge so anyone can write better progressions, understand why songs work, and communicate their ideas clearly.

---

## Next Actions

1. **Validate the "Demo to Lead Sheet" workflow** — Find 10 songwriters, have them try it, watch where they struggle
2. **Build PDF export** — Even basic, this unlocks revenue
3. **Prototype next-chord suggestions** — Start simple (common progressions), iterate based on feedback
4. **Create landing page** — Clear value prop: "Turn your demo into a lead sheet in 60 seconds"
5. **Set up analytics** — Understand how people actually use the tool

---

*Document created: December 2024*
*Last updated: December 2024*
