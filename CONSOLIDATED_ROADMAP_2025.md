# Music Theory Lab - Consolidated Roadmap 2025

## Executive Summary

Music Theory Lab has evolved into a sophisticated composition and learning platform with powerful AI-driven recommendation engines. This roadmap consolidates insights from all planning documents and identifies strategic opportunities to **deeply integrate teaching with composition** - the unique value proposition that differentiates us from tools like MuseScore (notation-focused) and Hookpad (composition-focused).

**Core Philosophy**: Every composition action becomes a learning opportunity. Every learning exercise produces real music.

---

## Current State Assessment

### What's Been Implemented (Strengths)

| Category | Implementation Level | Key Features |
|----------|---------------------|--------------|
| **Chord Building** | Complete | 18+ chord types, inversions, voicings, octave control |
| **Progression Builder** | Complete | Multi-section, drag-drop, templates, undo/redo |
| **Recommendation Engine** | Complete | 4D scoring (root/type/inversion/tension), style/mood aware |
| **Voice Leading Analysis** | Complete | Common tones, stepwise motion, parallel detection |
| **Melody Suggestions** | Complete | Context-aware, multiple contours, chord tone analysis |
| **Auto-Harmonization** | Complete | SATB voicing, style-aware, bass line generation |
| **Learning Curriculum** | Partial | 20+ lessons, 4 learning paths, progress tracking |
| **Ear Training** | Partial | Interval/chord recognition, difficulty levels |
| **Notation (VexFlow)** | Partial | Grand staff, basic editing, multi-system |
| **Audio Playback** | Complete | Web Audio, arpeggiator, rhythm patterns |
| **Song Analysis** | Partial | Local file analysis, pattern detection |
| **Export Pipeline** | Complete | MIDI, PDF lead sheet, audio (WAV/MP3), shareable links |
| **Onboarding** | Complete | "Let It Be" interactive tutorials (Verse, Chorus, Melody) |

### Remaining Gaps & Opportunities

1. **MusicXML Export** - Not yet implemented (interop with notation software)
2. **Mobile Experience** - Desktop-optimized only (audience limiter)
3. **Real-Time Feedback Loop** - Learning insights don't flow into composition context
4. **Personalized Learning Paths** - Generic curriculum, not adaptive to user's actual compositions
5. **Simplified Mode Toggle** - No way to hide advanced features for beginners
6. **Community Features** - No collaboration or social sharing beyond links

---

## Strategic Vision: "Learn by Composing, Compose by Learning"

### The Integration Thesis

Most music tools separate learning (courses, exercises) from creating (DAWs, notation software). Music Theory Lab's competitive advantage is the **seamless fusion** of both:

```
Traditional Approach:
  Learn Theory  -->  [Gap]  -->  Apply to Composition

Music Theory Lab Approach:
  Compose  <-->  Real-Time Theory Insights  <-->  Targeted Learning
     |                    |                           |
     +-------- Continuous Feedback Loop --------------+
```

---

## Roadmap Phases

## Phase A: Foundation Completion ✅ COMPLETE

### A.1 Export & Share Pipeline ✅
All core export features are now implemented:

| Feature | Status | Notes |
|---------|--------|-------|
| **MIDI Export** | ✅ Complete | Full progression/melody export to DAWs |
| **PDF Lead Sheet** | ✅ Complete | Print chord charts with notation via jsPDF |
| **Audio Export (WAV/MP3)** | ✅ Complete | High-quality audio rendering |
| **Shareable Links** | ✅ Complete | URL-based progression sharing with copy-to-clipboard |
| **MusicXML Export** | ⏳ Not Started | Interop with notation software (future) |

### A.2 Onboarding & Discovery ✅ (Partial)
Interactive tutorials implemented, additional UX improvements possible:

| Feature | Status | Notes |
|---------|--------|-------|
| **Interactive Welcome Tour** | ✅ Complete | "Let It Be" Verse/Chorus/Melody tutorials |
| **Quick Start Templates** | ✅ Complete | 65+ song structure templates available |
| **Simplified Mode Toggle** | ⏳ Not Started | Hide advanced features for beginners |
| **Contextual Hint System** | ⏳ Not Started | Smart tooltips based on user actions |
| **Goal-Based Entry** | ⏳ Not Started | "I want to write a song / learn theory / analyze a song" |

---

## Phase B: Intelligent Teaching-Composition Integration (PRIORITY: HIGH)

### B.1 "Theory Moments" - Contextual Learning During Composition

**Concept**: When a user makes an interesting harmonic choice, surface relevant theory education at the moment of maximum engagement.

**Implementation**:

```javascript
// When user adds a borrowed chord
if (isModalInterchange(newChord)) {
  showTheoryMoment({
    title: "You just used Modal Interchange!",
    explanation: "Borrowing the {chord} from {parallelMode} adds {emotion}",
    learnMore: "lesson/modal-interchange",
    examples: ["Radiohead - Creep uses this exact move"]
  });
}
```

**Trigger Points**:
| User Action | Theory Moment |
|-------------|---------------|
| Uses secondary dominant | Explain V/x relationship, tension building |
| Creates deceptive cadence | Explain expectation subversion, vi chord role |
| Builds tritone substitution | Explain shared tritones, jazz voice leading |
| Uses Neapolitan chord | Explain bII, classical drama, emotional impact |
| Creates cycle of 5ths | Explain strong root motion, Nashville Number |
| Modulates to new key | Explain pivot chords, common modulation techniques |

### B.2 "Why This Works" Explanations 2.0

**Current**: Basic text explanations for recommendations

**Enhanced**: Multi-layered, interactive explanations with audio comparison

```
Why F chord works after C major:

[Play Current] [Play Recommended] [A/B Compare]

BEGINNER VIEW:
  "F is the IV chord - it feels like moving forward"

INTERMEDIATE VIEW:
  "The IV chord creates plagal motion. The F shares 'C' as a
   common tone with your C chord, creating smooth voice leading."

ADVANCED VIEW:
  "Voice leading analysis:
   - C→F: Common tone retention (C)
   - Bass moves P4 (strong root motion)
   - Harmonic rhythm: 2 bars each = balanced phrase"

[Show on Staff] [Show on Piano] [Show on Circle of Fifths]
```

### B.3 Composition Challenges - Guided Creative Exercises

**Concept**: Structured exercises that teach theory through constraint-based composition.

| Challenge | Learning Goal | User Creates |
|-----------|---------------|--------------|
| **"Four Chords, One Song"** | Understand I-V-vi-IV ubiquity | Original song using only 4 chords |
| **"The Minor Turn"** | Modal mixture | Major progression with one borrowed chord |
| **"Jazz It Up"** | Extensions and alterations | Take simple progression, add 7ths/9ths |
| **"The Climb"** | Tension arcs | 8-bar build from rest to climax |
| **"Surprise Me"** | Deceptive cadences | Write progression with unexpected resolution |
| **"Walk the Circle"** | Circle of 5ths | Progression using consecutive 5th motion |
| **"Borrowed Colors"** | Modal interchange | Use 3 chords from parallel minor |
| **"Secondary Drama"** | Secondary dominants | Add V/V or V/vi to existing progression |

**Each challenge includes**:
- Clear creative constraint
- Theory explanation (before/after)
- Audio examples from real songs
- AI evaluation of submission
- Badge/XP upon completion

### B.4 "Composition Insights" Dashboard

**Concept**: Analyze user's compositions to generate personalized learning recommendations.

**Tracked Metrics**:
- Chord vocabulary usage (which types they use/avoid)
- Key preferences
- Progression patterns (repeated habits)
- Voice leading quality scores
- Tension arc tendencies

**Generated Insights**:
```
Your Composition DNA:

Chord Vocabulary: 65% of your progressions use Major/Minor triads
  → Suggestion: Try adding 7th chords for more color
  → Lesson: "Introduction to Seventh Chords"

Harmonic Habits: You always resolve V to I
  → Suggestion: Explore deceptive cadences (V → vi)
  → Challenge: "Surprise Me"

Key Preferences: 80% of work in Major keys
  → Suggestion: Natural minor has a different emotional palette
  → Lesson: "Writing in Minor Keys"

Voice Leading: Your bass often jumps large intervals
  → Suggestion: Stepwise bass motion creates smoother flow
  → Tool: Enable "Bass Voice Leading Hints"
```

### B.5 Real-Time Theory Overlay Mode

**Concept**: Optional overlay that annotates the progression with theory information as you build.

**Display Elements** (toggleable):
- Roman numeral analysis (I, IV, V7, etc.)
- Harmonic function coloring (T/S/D)
- Voice leading arrows between chords
- Tension score graph below timeline
- Common tone highlighting
- Scale degree labels on notes

---

## Phase C: Advanced Composition Intelligence

### C.1 Style-Guided Composition Mode

**Concept**: Choose a style/era and get tailored recommendations + theory education.

| Style | Characteristics | Theory Education |
|-------|-----------------|------------------|
| **Pop/Top 40** | I-V-vi-IV, simple triads, hook-focused | Catchy progressions, verse-chorus structure |
| **Jazz Standards** | ii-V-I, extensions, tritone subs | Functional harmony, alterations |
| **Classical** | Clear cadences, voice leading, sequences | Common practice period rules |
| **Neo-Soul** | Extended chords, chromatic movement | Gospel influence, smooth voice leading |
| **Lo-Fi/Chill** | 7th chords, inversions, lazy tempo | Suspended chords, major 7ths |
| **EDM/Pop** | Simple progressions, strong bass | Bass-driven harmony, drops |
| **Film Score** | Modal, chromatic, emotional arcs | Leitmotifs, tension scoring |

**Features**:
- Style-filtered chord recommendations
- "This is typical for {style}" explanations
- Example songs in selected style
- Style-appropriate rhythm patterns
- Gradual complexity unlocking

### C.2 Melody-Harmony Integration

**Concept**: Tighter integration between melody creation and chord progression.

| Feature | Description |
|---------|-------------|
| **Melody-First Workflow** | Hum/play melody, auto-generate chord options |
| **Chord Tone Targets** | Melody editor highlights which notes are chord tones |
| **Passing Tone Education** | Real-time annotation of non-chord tone types |
| **Contour Visualization** | Visual arc showing melody shape vs tension |
| **Counter-Melody Suggestions** | AI-generated secondary melodies with theory explanation |

### C.3 Song Structure Intelligence

**Concept**: AI-assisted full song arrangement with section-specific guidance.

**Features**:
- Suggested section order based on genre
- Energy arc across full song visualization
- "Copy with variation" for section development
- Key change suggestions for bridges
- Pre-chorus tension building templates
- Outro resolution patterns

---

## Phase D: Enhanced Learning Experiences

### D.1 Interactive Ear Training 2.0

**Concept**: Ear training that uses the user's own compositions.

| Exercise Type | Description |
|---------------|-------------|
| **Progression Recognition** | Play progressions from user's songs, identify chords |
| **Chord Quality Quiz** | Hear chords from current key, identify type |
| **Interval Singing** | Sing the interval between selected notes |
| **Bass Line Dictation** | Hear bass, write the line |
| **Tension Matching** | Listen to example, match the tension level |

### D.2 Famous Progressions Analysis

**Concept**: Deep-dive analysis of iconic songs with interactive recreation.

**For Each Famous Song**:
1. Hear the original progression
2. See the Roman numeral analysis
3. Learn "why it works" (theory breakdown)
4. Interactive recreation step-by-step
5. Challenge: Write variation in different key
6. Save to personal "inspiration" collection

**Curated Library**:
- Axis of Awesome (4-chord song medley)
- Pachelbel's Canon (descending bass)
- Beatles - Let It Be (I-V-vi-IV)
- Radiohead - Creep (modal mixture)
- Bill Withers - Lean On Me (gospel influence)
- Jazz Standards (Autumn Leaves, All The Things You Are)

### D.3 Adaptive Lesson Paths

**Concept**: Learning path that adapts based on composition activity.

**Logic Flow**:
```
User composes with mostly triads
  → System notes limited vocabulary
  → Next suggested lesson: "Seventh Chords"
  → Challenge appears: "Jazz It Up"

User completes challenge
  → System notes new chord usage
  → Composition Insights updates
  → More advanced lesson unlocks
```

---

## Phase E: Community & Social Features

### E.1 Progression Sharing & Remix

| Feature | Status | Description |
|---------|--------|-------------|
| **Share as URL** | ✅ Complete | Unique link to progression with copy-to-clipboard |
| **Embed Widget** | ⏳ Not Started | Embeddable player for blogs/social |
| **Remix Chain** | ⏳ Not Started | Track evolution of shared progressions |
| **Template Contribution** | ⏳ Not Started | Users submit templates to public library |

### E.2 Collaborative Composition (Future)

| Feature | Description |
|---------|-------------|
| **Real-Time Collaboration** | Multiple users editing same progression |
| **Async Contribution** | Add to shared progression, notify collaborators |
| **Feedback/Comments** | Comment on specific measures/chords |

---

## Phase F: Platform & Performance

### F.1 Mobile-First Responsive Design

| Feature | Description |
|---------|-------------|
| **Touch-Optimized Controls** | Larger tap targets, swipe gestures |
| **Simplified Mobile View** | Essential features only on small screens |
| **Offline Mode (PWA)** | Work without internet connection |
| **Progressive Enhancement** | Full features on tablet/desktop |

### F.2 Performance Optimization

| Feature | Description |
|---------|-------------|
| **Lazy Loading** | Load modules on demand |
| **Audio Preloading** | Instant playback, no lag |
| **State Persistence** | Never lose work |
| **Undo/Redo Performance** | Instant state restoration |

---

## Implementation Priority Matrix

### ✅ Completed (Foundation)
| Item | Status |
|------|--------|
| MIDI Export | ✅ Implemented |
| PDF Lead Sheet Export | ✅ Implemented |
| Audio Export (WAV/MP3) | ✅ Implemented |
| Shareable Links | ✅ Implemented |
| Interactive Onboarding ("Let It Be") | ✅ Implemented |
| Quick Start Templates | ✅ Implemented (65+ templates) |

### Tier 1: High Priority (Next Sprint) - Teaching-Composition Integration
| Item | Rationale |
|------|-----------|
| Theory Moments (B.1) | Core differentiation - learning at moment of action |
| Why This Works 2.0 (B.2) | Interactive explanations with A/B comparison |
| Composition Insights Dashboard (B.4) | Personalized learning based on user's compositions |
| Real-Time Theory Overlay (B.5) | Visual Roman numerals, voice leading arrows |

### Tier 2: Strategic Differentiation
| Item | Rationale |
|------|-----------|
| Composition Challenges (B.3) | Gamified learning through creative constraints |
| Style-Guided Mode (C.1) | Genre-specific recommendations + education |
| Famous Progressions Library (D.2) | Interactive analysis of iconic songs |
| Adaptive Lesson Paths (D.3) | Curriculum that responds to composition activity |

### Tier 3: Platform & UX Polish
| Item | Rationale |
|------|-----------|
| Simplified Mode Toggle | Better beginner experience |
| Goal-Based Entry Flow | "Write a song" vs "Learn theory" paths |
| Mobile Responsive (F.1) | Audience expansion |
| MusicXML Export | Notation software interop |

### Tier 4: Future Expansion
| Item | Rationale |
|------|-----------|
| Embed Widget (E.1) | Shareable players for blogs/social |
| Collaboration (E.2) | Real-time multi-user editing |
| MIDI Input | Real-time chord detection from keyboard |
| VST/AU Plugin | DAW integration |

---

## Success Metrics

### User Engagement
- **Composition-to-Learning Ratio**: Users who compose AND access learning
- **Theory Moment Engagement**: % of moments clicked/explored
- **Challenge Completion Rate**: % of started challenges completed
- **Return Visit Rate**: Users who return within 7 days

### Learning Outcomes
- **Chord Vocabulary Growth**: New chord types used over time
- **Voice Leading Improvement**: Quality score trends
- **Ear Training Accuracy**: Improvement in recognition tasks
- **Lesson Completion Rate**: % of lessons finished

### Business Metrics
- **Export Usage**: Downloads per user per month
- **Time on Platform**: Average session length
- **Feature Discovery**: % of features used
- **Sharing Rate**: Progressions shared per user

---

## Competitive Positioning

| Competitor | Strength | Music Theory Lab Advantage |
|------------|----------|---------------------------|
| **MuseScore** | Notation, community | Integrated learning, AI recommendations |
| **Hookpad** | Composition, melody | Deeper theory education, personalization |
| **Flat.io** | Collaboration, cloud | Real-time theory insights, challenges |
| **Noteflight** | Education market | Composition-first learning, not exercise-first |
| **teoria.com** | Theory exercises | Composition integration, modern UI |
| **musictheory.net** | Free learning | Interactive composition, not passive |

**Our Unique Position**: The only tool where composing music IS learning music theory, and learning theory CREATES music.

---

## Appendix: Feature Ideas Backlog

### Quick Wins
- [ ] Keyboard shortcut cheat sheet modal
- [ ] "Random progression" generator for inspiration
- [x] Transpose entire song in one click (via key change)
- [x] Quick tempo/key change per section (implemented)
- [ ] Favorite chord quick-access palette

### Medium Effort
- [x] Chord substitution suggester (recommendation engine does this)
- [ ] Progression similarity search ("Find songs like this")
- [ ] Custom scale creator for modal exploration
- [ ] Recording + transcription (sing melody, get notes)
- [ ] Metronome with subdivision options

### High Effort / Future
- [x] AI melody generation from chord progression (melody suggestion engine)
- [ ] Lyrics integration with syllable alignment
- [ ] MIDI input for real-time chord detection
- [ ] VST/AU plugin version for DAW integration
- [ ] Multi-instrument arrangement (drums, bass, keys)

---

## Conclusion

Music Theory Lab has **completed its foundation** with exports, onboarding, and sophisticated AI-powered composition tools all in place. The strategic opportunity now lies in **making every interaction a teaching moment** while **making every lesson produce real music**.

### What's Done
- Full export pipeline (MIDI, PDF, Audio, Shareable Links)
- Interactive onboarding via "Let It Be" tutorials
- 65+ song structure templates
- AI-powered chord recommendations with voice leading analysis
- 20+ structured lessons with multi-level explanations

### The Next Leap
The features that will differentiate Music Theory Lab from every other tool:

1. **Theory Moments** - Contextual learning popups when users make interesting harmonic choices
2. **Composition Insights** - AI analysis of user's compositions to suggest personalized lessons
3. **Creative Challenges** - Constraint-based composition exercises that teach theory by doing
4. **Famous Progressions** - Interactive analysis and recreation of iconic songs

### The Vision
**A musician opens Music Theory Lab to write a song and walks away a better musician. A learner opens it to study theory and walks away with an original composition.**

No other tool truly fuses composition and education. This is our competitive moat.

---

*Document created: December 2025*
*Last updated: December 2025*
*Status: Foundation Complete - Ready for Teaching-Composition Integration Phase*
