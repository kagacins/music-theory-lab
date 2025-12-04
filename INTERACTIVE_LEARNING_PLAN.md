# Interactive Music Theory Learning Plan

## Vision Statement

Transform Music Theory Lab from a powerful composition tool into an **interactive learning experience** where users of all skill levels can:
1. **Learn** music theory through doing, not just reading
2. **Understand** why certain combinations sound good together
3. **Apply** that knowledge to write memorable songs

---

## Core Principle: Explain Like I'm Five (Then Go Deeper)

Every explanation must work at multiple levels:

```
Level 1 (Beginner):    "This chord wants to go home to the main chord"
Level 2 (Intermediate): "The G7 chord creates tension that resolves to C"
Level 3 (Advanced):     "The tritone B-F resolves to C-E via half-step motion"
```

**Never assume users know terms like:**
- Dominant, Subdominant, Tonic
- Plagal, Authentic, Deceptive
- Modal interchange, Secondary dominant
- Tritone, Leading tone

**Instead, explain the concept first, then introduce the term:**
> "This chord creates tension and wants to resolve (musicians call this a 'dominant' chord)"

---

## Current Assets (What We Have)

### Fully Implemented Building Blocks
- Chord Builder with 50+ chord types and inversions
- Progression Builder with 24 templates and pattern detection
- Chord Recommendation Engine (3D scoring, 600+ combinations)
- Melody Suggestion Engine (style-aware, categorized)
- Auto-Harmonize (bidirectional optimization)
- Voice Leading Analysis
- Theory Tools (secondary dominants, modal interchange)
- Bass Auto-Generation
- Professional Notation Rendering (VexFlow)
- Roman Numeral Analysis with color coding

### What's Missing for Learning
- **Explanation content** - The "why" behind every feature
- **Beginner-friendly language** - Jargon-free explanations
- **Progressive disclosure** - Simple first, detailed on demand
- **Interactive comparisons** - Hear the difference yourself
- **Guided learning paths** - Structured lessons

---

## Implementation Phases

### Phase 1: The Explanation Foundation (Weeks 1-3)

Build the knowledge base that powers all learning features.

#### 1.1 Theory Explanation Database

Create a structured database of music theory concepts with multi-level explanations.

**File Structure:**
```
src/data/
  theoryExplanations/
    concepts.js          # Core concept definitions
    chordFunctions.js    # Why chords work together
    progressionPatterns.js # Common patterns explained
    melodyRelationships.js # Melody-chord connections
    voiceLeadingRules.js   # Harmony principles
```

**Concept Entry Structure:**
```javascript
{
  id: "dominant-resolution",

  // For complete beginners
  simple: {
    title: "The 'Wants to Go Home' Chord",
    explanation: "Some chords feel tense and unstable. They want to move to a
                  stable chord. It's like a question that needs an answer.",
    analogy: "Think of it like a ball on a hill - it naturally wants to roll down.",
    hearIt: "Listen to these two chords. Notice how the first one feels unfinished?",
  },

  // For users who've learned the basics
  intermediate: {
    title: "Dominant to Tonic Resolution",
    explanation: "The G7 chord contains notes that create tension (B and F).
                  These notes are just a half-step away from the stable notes
                  in C major (C and E). Your ear expects them to resolve.",
    terminology: "Musicians call the tense chord 'dominant' (the V chord) and
                  the home chord 'tonic' (the I chord).",
    examples: ["Happy Birthday ending", "Amen at church", "Most pop song endings"]
  },

  // For theory enthusiasts
  advanced: {
    title: "Tritone Resolution and Voice Leading",
    explanation: "The tritone interval (B-F in G7) is inherently unstable due to
                  its 6-semitone span. It resolves inward (B→C, F→E) or outward
                  (B→C, F→E via different octaves) to the tonic triad.",
    technicalDetail: "The 7th of the dominant (F) resolves down by step while
                      the leading tone (B) resolves up by step.",
    history: "This resolution has been the foundation of Western harmony since
              the Baroque period."
  }
}
```

#### 1.2 "Why This Works" Panel Component

A sidebar/modal that appears when users interact with recommendations.

**Design Principles:**
- Appears automatically but doesn't block workflow
- Starts with simplest explanation
- "Tell me more" expands to deeper levels
- "Hear it" buttons for audio examples
- "Try the opposite" for comparison

**UI Mockup:**
```
┌─────────────────────────────────────────┐
│ Why This Sounds Good                 [×]│
├─────────────────────────────────────────┤
│                                         │
│ You chose: G → C                        │
│                                         │
│ 🎯 The Simple Answer                    │
│ ─────────────────────                   │
│ The G chord feels "tense" and wants     │
│ to move to C. It's like finishing a     │
│ sentence - G is the question, C is      │
│ the answer.                             │
│                                         │
│ [▶ Hear the tension]  [▶ Hear it resolve]│
│                                         │
│ 🎵 Try These Alternatives               │
│ ─────────────────────                   │
│ [▶ G → Am] - A "surprise" ending        │
│ [▶ G → F]  - Goes somewhere unexpected  │
│ [▶ G → Em] - Bittersweet resolution     │
│                                         │
│ [📚 Tell me the music theory...]        │
│                                         │
└─────────────────────────────────────────┘
```

**Expanded "Tell me more" state:**
```
┌─────────────────────────────────────────┐
│ 📚 The Music Theory                     │
├─────────────────────────────────────────┤
│                                         │
│ What musicians call this:               │
│ "Authentic Cadence" or "V-I resolution" │
│                                         │
│ Why it works (the science):             │
│ The G chord contains B and F - notes    │
│ that are very close to C and E in the   │
│ C chord. Your ear expects them to move  │
│ that tiny distance. When they do, it    │
│ feels satisfying.                       │
│                                         │
│ [Diagram showing B→C and F→E movement]  │
│                                         │
│ 🎓 Advanced: Musicians call this        │
│ "tritone resolution" - the B-F interval │
│ (called a tritone) is naturally tense.  │
│                                         │
│ Famous songs using this:                │
│ • "Let It Be" (Beatles) - final chord   │
│ • "Imagine" (John Lennon) - verse ends  │
│ • Virtually every classical piece       │
│                                         │
└─────────────────────────────────────────┘
```

#### 1.3 Chord Function Color System

Visual learning through consistent color coding.

**Color Meanings (Explained Simply):**
```
🟢 GREEN = "Home Base" (Tonic)
   "This chord feels stable and complete. Songs often start and end here."
   Technical term: Tonic (I, vi, iii)

🔵 BLUE = "Journey" (Subdominant)
   "This chord wants to go somewhere. It's moving away from home."
   Technical term: Subdominant (IV, ii)

🔴 RED = "Tension" (Dominant)
   "This chord feels unstable. It really wants to go back to green."
   Technical term: Dominant (V, vii°)
```

**Implementation:**
- Apply colors to chord cards in progression builder
- Show color legend on first use (dismissible)
- Color the tension curve visualization
- Option to toggle colors on/off for advanced users

---

### Phase 2: Interactive Comparison Tools (Weeks 4-5)

Help users understand by hearing differences.

#### 2.1 "Hear the Difference" A/B Comparisons

**When triggered:** User hovers over alternative chord suggestions

**Interface:**
```
┌─────────────────────────────────────────────┐
│ Compare Options                             │
├─────────────────────────────────────────────┤
│                                             │
│ Current: Dm → G → C                         │
│ [▶ Play current]                            │
│                                             │
│ ─────────────────────────────────────────── │
│                                             │
│ Alternative 1: Dm → G7 → C                  │
│ [▶ Play this]                               │
│ 💡 "Adding the 7th to G makes it pull       │
│    even harder toward C"                    │
│                                             │
│ Alternative 2: Dm → F → C                   │
│ [▶ Play this]                               │
│ 💡 "Skipping the tension chord creates a    │
│    softer, 'amen' style ending"             │
│                                             │
│ Alternative 3: Dm → Bdim → C                │
│ [▶ Play this]                               │
│ 💡 "The diminished chord adds drama         │
│    while the bass walks down: D-B-C"        │
│                                             │
│ [Apply Alternative 1] [Apply Alternative 2] │
│                                             │
└─────────────────────────────────────────────┘
```

#### 2.2 "What If" Sandbox Mode

Let users experiment safely with explanations.

**Interface concept:**
```
┌─────────────────────────────────────────────┐
│ 🧪 What If Lab                              │
├─────────────────────────────────────────────┤
│                                             │
│ Your progression: C → Am → F → G            │
│                                             │
│ What if you...                              │
│                                             │
│ [Make it sad]                               │
│  → Cm → Ab → Fm → G                         │
│  💡 "Changing to minor makes it melancholy" │
│                                             │
│ [Add jazz color]                            │
│  → Cmaj7 → Am7 → Fmaj7 → G7                 │
│  💡 "7th chords add sophistication"         │
│                                             │
│ [Use borrowed chords]                       │
│  → C → Ab → F → G                           │
│  💡 "That Ab is 'borrowed' from C minor -   │
│     it adds an unexpected emotional shift"  │
│                                             │
│ [Make it more dramatic]                     │
│  → C → Am → Dm → G                          │
│  💡 "Adding Dm before G increases tension"  │
│                                             │
└─────────────────────────────────────────────┘
```

---

### Phase 3: Guided Learning Journeys (Weeks 6-8)

Structured paths from beginner to confident songwriter.

#### 3.1 Learning Module Structure

**New Tab or Mode: "Learn"**

```
┌─────────────────────────────────────────────────────────────────┐
│  📖 Learn Music Theory                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🌱 BEGINNER PATH                                               │
│  ─────────────────                                              │
│  ✅ 1. What is a Chord?                              [Complete] │
│  ✅ 2. Major vs Minor - Happy vs Sad                 [Complete] │
│  🔵 3. Your First Progression (I-IV-V-I)            [In Progress]│
│  ⚪ 4. Why Some Chords "Want" to Move                  [Locked] │
│  ⚪ 5. The Most Popular Progression Ever               [Locked] │
│  ⚪ 6. Adding Emotion with Minor Chords                [Locked] │
│                                                                 │
│  🎸 INTERMEDIATE PATH                                           │
│  ─────────────────                                              │
│  ⚪ 7. The Power of 7th Chords                         [Locked] │
│  ⚪ 8. Borrowing Chords for Surprise                   [Locked] │
│  ⚪ 9. Creating Tension and Release                    [Locked] │
│  ...                                                            │
│                                                                 │
│  🎹 ADVANCED PATH                                               │
│  ─────────────────                                              │
│  ⚪ 15. Secondary Dominants                            [Locked] │
│  ⚪ 16. Modal Interchange Deep Dive                    [Locked] │
│  ...                                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.2 Lesson Structure Template

Each lesson follows this format:

```
┌─────────────────────────────────────────────────────────────────┐
│ Lesson 3: Your First Progression                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 📖 LEARN (2 min read)                                           │
│ ──────────────────────                                          │
│ Most songs use the same basic pattern of chords. Once you       │
│ learn it, you'll hear it everywhere!                            │
│                                                                 │
│ The pattern is: I → IV → V → I                                  │
│ In the key of C, that's: C → F → G → C                          │
│                                                                 │
│ Think of it like a journey:                                     │
│ • C is HOME (where you start and end)                           │
│ • F is TRAVELING (moving away from home)                        │
│ • G is ALMOST HOME (the "I want to go back!" feeling)           │
│ • C is HOME AGAIN (ahhh, that feels good)                       │
│                                                                 │
│ [▶ Listen to this progression]                                  │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ 👂 HEAR IT (1 min)                                              │
│ ──────────────────────                                          │
│ Here are famous songs using I-IV-V-I:                           │
│                                                                 │
│ [▶ "Twist and Shout" - Beatles]                                 │
│ [▶ "La Bamba" - Ritchie Valens]                                 │
│ [▶ "Wild Thing" - The Troggs]                                   │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ 🎹 TRY IT (interactive)                                         │
│ ──────────────────────                                          │
│ Build this progression yourself:                                │
│                                                                 │
│ Step 1: Click on C major     [✓ Done!]                          │
│ Step 2: Add F major          [Waiting...]                       │
│ Step 3: Add G major          [Locked]                           │
│ Step 4: End with C major     [Locked]                           │
│                                                                 │
│ [Current workspace shows guided chord placement]                │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ 🧪 EXPERIMENT                                                   │
│ ──────────────────────                                          │
│ Now that you've built it, try these variations:                 │
│                                                                 │
│ [Try: I → IV → V → IV] - Notice how it doesn't feel "finished"  │
│ [Try: I → V → IV → I]  - Same chords, different feeling         │
│ [Try: i → iv → V → i]  - Minor version - much sadder!           │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ ✅ QUIZ                                                         │
│ ──────────────────────                                          │
│ Which chord feels like "home" in a progression?                 │
│ ○ The IV chord                                                  │
│ ○ The V chord                                                   │
│ ● The I chord  ✓ Correct!                                       │
│                                                                 │
│                                                                 │
│                              [← Previous] [Next Lesson →]       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.3 Beginner Songwriting Wizard

Step-by-step first song creation.

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎵 Let's Write Your First Song!                     Step 1 of 5 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ How do you want your song to feel?                              │
│                                                                 │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│ │   😊         │ │   😢         │ │   ⚡         │              │
│ │   Happy      │ │   Sad        │ │   Energetic  │              │
│ │   Uplifting  │ │   Emotional  │ │   Driving    │              │
│ │   [Select]   │ │   [Select]   │ │   [Select]   │              │
│ └──────────────┘ └──────────────┘ └──────────────┘              │
│                                                                 │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│ │   🌙         │ │   ❤️         │ │   🌊         │              │
│ │   Dreamy     │ │   Romantic   │ │   Chill      │              │
│ │   Ethereal   │ │   Warm       │ │   Relaxed    │              │
│ │   [Select]   │ │   [Select]   │ │   [Select]   │              │
│ └──────────────┘ └──────────────┘ └──────────────┘              │
│                                                                 │
│                                                                 │
│                                                     [Next →]    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎵 Let's Write Your First Song!                     Step 2 of 5 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ You chose: 😊 Happy / Uplifting                                 │
│                                                                 │
│ Great choice! For a happy, uplifting song, we'll use:           │
│ • A major key (major = happy sound)                             │
│ • Chords that move with energy                                  │
│ • A strong resolution at the end                                │
│                                                                 │
│ Here's a progression that matches your mood:                    │
│                                                                 │
│ ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐                          │
│ │  C  │ → │  G  │ → │  Am │ → │  F  │                          │
│ │  I  │   │  V  │   │ vi  │   │ IV  │                          │
│ └─────┘   └─────┘   └─────┘   └─────┘                          │
│                                                                 │
│ [▶ Play this progression]                                       │
│                                                                 │
│ 💡 Why this works for "happy":                                  │
│ • Starts on C (bright, open sound)                              │
│ • G adds energy and lift                                        │
│ • Am adds just a touch of emotion (not too sad)                 │
│ • F brings it back around warmly                                │
│                                                                 │
│ This is used in: "Let It Be", "No Woman No Cry",                │
│ "With or Without You", and hundreds more!                       │
│                                                                 │
│                                          [← Back] [Use This →]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Phase 4: Melody-Chord Relationship Education (Weeks 9-10)

Help users understand why melodies work with chords.

#### 4.1 Note Category Explanations

**Beginner-Friendly Note Categories:**

```javascript
{
  "chord-tone": {
    simple: "This note is part of the chord - it fits perfectly!",
    color: "green",
    icon: "🎯",
    detail: "Like singing the same notes the piano is playing"
  },

  "scale-tone": {
    simple: "This note isn't in the chord, but it's in the key - it sounds fine!",
    color: "blue",
    icon: "✓",
    detail: "Like staying on the path even if you're not at home base"
  },

  "passing-tone": {
    simple: "This note connects two good notes - it's just passing through",
    color: "yellow",
    icon: "→",
    detail: "Like walking through a room to get somewhere else"
  },

  "tension": {
    simple: "This note creates excitement! Use it carefully for color",
    color: "orange",
    icon: "✨",
    detail: "Like adding spice to food - a little goes a long way"
  },

  "avoid": {
    simple: "This note clashes with the chord - usually best to skip it",
    color: "red",
    icon: "⚠️",
    detail: "Like two singers hitting different notes by accident"
  }
}
```

#### 4.2 Real-Time Melody Feedback

As users compose melodies, show instant feedback:

```
┌─────────────────────────────────────────────────────────────────┐
│ Current Chord: C major (C - E - G)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Your melody note: E                                             │
│                                                                 │
│ 🎯 Perfect! This is the 3rd of the chord                        │
│                                                                 │
│ Why it sounds good:                                             │
│ The note E is part of the C chord (C-E-G), so it blends         │
│ perfectly. This note helps define whether the chord sounds      │
│ happy (major) or sad (minor).                                   │
│                                                                 │
│ Try this: [▶ Hear E over C major]                               │
│ Compare:  [▶ Hear Eb over C major] - notice the "sad" sound     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Phase 5: Voice and Harmony Education (Weeks 11-12)

Teach second voices and counterpoint accessibly.

#### 5.1 "Add a Harmony" Learning Mode

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎶 Adding Harmony to Your Melody                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Your melody: C → D → E → F → G                                  │
│                                                                 │
│ There are several ways to add a second voice:                   │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 1. PARALLEL THIRDS (Sweet & Simple)                         │ │
│ │    Harmony: E → F → G → A → B                               │ │
│ │    [▶ Listen]                                               │ │
│ │                                                             │ │
│ │    💡 Each harmony note is 3 notes above the melody.        │ │
│ │       This is the most common type of harmony in pop music. │ │
│ │       Think of any song where two people sing together!     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 2. PARALLEL SIXTHS (Rich & Full)                            │ │
│ │    Harmony: E → F → G → A → B (below the melody)            │ │
│ │    [▶ Listen]                                               │ │
│ │                                                             │ │
│ │    💡 Same notes as thirds, but the harmony goes BELOW      │ │
│ │       instead of above. Creates a fuller, richer sound.     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 3. CONTRARY MOTION (Independent & Interesting)              │ │
│ │    Harmony: G → F → E → D → C                               │ │
│ │    [▶ Listen]                                               │ │
│ │                                                             │ │
│ │    💡 When melody goes UP, harmony goes DOWN (and vice      │ │
│ │       versa). This makes both parts sound independent.      │ │
│ │       Bach used this technique constantly!                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Try each one and pick your favorite!                            │
│ [Apply Option 1] [Apply Option 2] [Apply Option 3]              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 5.2 Voice Leading Explainer

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎵 How Notes Move Between Chords                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ When you play C major → G major, watch how the notes move:      │
│                                                                 │
│     C major          G major                                    │
│       G ─────────────→ G     (stays the same - very smooth!)    │
│       E ─────────────→ D     (moves down by one step - smooth)  │
│       C ─────────────→ B     (moves down by one step - smooth)  │
│                                                                 │
│ [▶ Listen to smooth movement]                                   │
│                                                                 │
│ 💡 Why does this sound good?                                    │
│ • One note STAYS THE SAME (G) - this connects the chords        │
│ • Other notes move by SMALL STEPS - this sounds natural         │
│ • No big jumps - your ear can follow easily                     │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ Now compare to POOR voice leading:                              │
│                                                                 │
│     C major          G major (different voicing)                │
│       G ───────────┐                                            │
│       E ─────────┐ └─→ B     (big jump!)                        │
│       C ───────┐ └───→ G     (big jump!)                        │
│               └─────→ D                                         │
│                                                                 │
│ [▶ Listen to jumpy movement]                                    │
│                                                                 │
│ Hear the difference? The second version sounds choppy.          │
│ Good voice leading makes your music flow.                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Phase 6: Ear Training Integration (Weeks 13-14)

Connect hearing to understanding.

#### 6.1 Chord Identification Exercises

```
┌─────────────────────────────────────────────────────────────────┐
│ 👂 Ear Training: What Chord Is This?                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ [▶ Play Mystery Chord]           [▶ Play Again]                 │
│                                                                 │
│ What type of chord did you hear?                                │
│                                                                 │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │   Major     │ │   Minor     │ │   7th       │ │   Other     │ │
│ │   (happy)   │ │   (sad)     │ │   (jazzy)   │ │             │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│                                                                 │
│ 💡 Hint: Does it sound bright and happy, or dark and sad?       │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ Your progress: ████████░░ 8/10 correct                          │
│ Current streak: 🔥 5                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 6.2 Progression Dictation

```
┌─────────────────────────────────────────────────────────────────┐
│ 👂 Ear Training: Build What You Hear                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Listen to this 4-chord progression:                             │
│ [▶ Play Progression]                                            │
│                                                                 │
│ Difficulty: ⭐⭐ Intermediate                                    │
│ Key: C major (we'll tell you this one!)                         │
│                                                                 │
│ Build the progression:                                          │
│ ┌─────┐   ┌─────┐   ┌─────┐   ┌─────┐                          │
│ │  ?  │ → │  ?  │ → │  ?  │ → │  ?  │                          │
│ └─────┘   └─────┘   └─────┘   └─────┘                          │
│                                                                 │
│ Available chords (click to place):                              │
│ [C] [Dm] [Em] [F] [G] [Am] [Bdim]                               │
│                                                                 │
│ [▶ Play My Answer]  [Check Answer]  [Give Up & Show Me]         │
│                                                                 │
│ 💡 Tip: Listen for the "home" chord (usually at the start       │
│    or end). Then listen for tension and release.                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Phase 7: Famous Progressions Library (Weeks 15-16)

Learn from real music.

#### 7.1 Progression Analysis Database

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎸 Famous Progressions                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ [Search progressions...]                                        │
│                                                                 │
│ Filter by: [All] [Pop] [Rock] [Jazz] [Classical] [Folk]         │
│ Difficulty: [All] [Beginner] [Intermediate] [Advanced]          │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ THE "AXIS" PROGRESSION                         ⭐ Beginner  │ │
│ │ I → V → vi → IV                                             │ │
│ │ C → G → Am → F                                              │ │
│ │                                                             │ │
│ │ 🎵 Used in: "Let It Be", "No Woman No Cry", "With or        │ │
│ │    Without You", "She Will Be Loved", "Demons"...           │ │
│ │                                                             │ │
│ │ 💡 Why it works: This progression has everything - a        │ │
│ │    strong start (I), energy (V), emotion (vi), and a warm  │ │
│ │    return (IV). It's the Swiss Army knife of progressions.  │ │
│ │                                                             │ │
│ │ [▶ Play] [Load into Workspace] [Learn More]                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ THE "SENSITIVE" PROGRESSION                  ⭐⭐ Intermediate│ │
│ │ vi → IV → I → V                                             │ │
│ │ Am → F → C → G                                              │ │
│ │                                                             │ │
│ │ 🎵 Used in: "Grenade", "Complicated", "Numb"...             │ │
│ │                                                             │ │
│ │ 💡 Why it works: Starting on the minor chord (vi)           │ │
│ │    immediately creates an emotional, vulnerable feeling.    │ │
│ │    The I chord arrives late, almost like hope appearing.    │ │
│ │                                                             │ │
│ │ [▶ Play] [Load into Workspace] [Learn More]                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ [Load More Progressions...]                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## New UI Components Summary

### Navigation Enhancement

```
┌─────────────────────────────────────────────────────────────────┐
│                     MUSIC THEORY LAB                            │
├─────────────────────────────────────────────────────────────────┤
│ 🎹 Chord Lab │ 🎼 Progressions │ 📝 Compose │ 📊 Scales │ 📚 Learn │
└─────────────────────────────────────────────────────────────────┘
                                                              ↑
                                                         NEW TAB
```

### Global "Learn Mode" Toggle

```
┌──────────────────────────────────────────┐
│ 🎓 Learn Mode: [ON] / OFF                │
│                                          │
│ When ON:                                 │
│ • Explanations appear automatically      │
│ • Chord functions are color-coded        │
│ • Tooltips show music theory             │
│ • "Why?" buttons appear on suggestions   │
└──────────────────────────────────────────┘
```

### Skill Level Selector (Persistent Setting)

```
┌──────────────────────────────────────────┐
│ Your Experience Level:                   │
│                                          │
│ ○ 🌱 Beginner                            │
│   "I'm just starting to learn music"     │
│                                          │
│ ○ 🌿 Intermediate                        │
│   "I know basic chords and scales"       │
│                                          │
│ ○ 🌳 Advanced                            │
│   "I understand music theory well"       │
│                                          │
│ This affects how explanations are shown. │
└──────────────────────────────────────────┘
```

---

## Implementation Priority Matrix

### Tier 1: Foundation (Do First - Weeks 1-5)
| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Theory Explanation Database | High | Critical | 1 |
| "Why This Works" Panel | Medium | Critical | 2 |
| Chord Function Colors | Low | High | 3 |
| Skill Level Setting | Low | High | 4 |
| A/B Comparison Tool | Medium | High | 5 |

### Tier 2: Structured Learning (Weeks 6-10)
| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Learn Tab / Mode | Medium | Critical | 6 |
| Beginner Lessons (5-6) | High | Critical | 7 |
| Songwriting Wizard | Medium | High | 8 |
| Melody-Chord Explanation | Medium | High | 9 |

### Tier 3: Reinforcement (Weeks 11-16)
| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Voice/Harmony Education | Medium | Medium | 10 |
| Ear Training Exercises | High | Medium | 11 |
| Famous Progressions Library | Medium | Medium | 12 |
| Progress Tracking | Medium | Low | 13 |

---

## Glossary of Terms (For the App)

This glossary powers tooltips and explanations throughout the app.

```javascript
// Example entries - full glossary to be built in Phase 1

const glossary = {
  "tonic": {
    simple: "The 'home base' chord - where songs usually start and end",
    technical: "The I chord, built on the first degree of the scale",
    example: "In the key of C, the tonic is C major"
  },

  "dominant": {
    simple: "The 'wants to go home' chord - creates tension that resolves",
    technical: "The V chord, built on the fifth degree of the scale",
    example: "In the key of C, the dominant is G major"
  },

  "resolution": {
    simple: "When a tense chord moves to a stable chord - like answering a question",
    technical: "The progression from an unstable harmony to a stable one",
    example: "G7 → C is a resolution"
  },

  "cadence": {
    simple: "The ending of a musical phrase - like punctuation in a sentence",
    technical: "A chord progression that creates a sense of conclusion",
    example: "The 'Amen' at church (F → C) is a type of cadence"
  }

  // ... hundreds more entries
};
```

---

## Success Metrics

How we'll know the learning features are working:

1. **Engagement**: Users spend more time exploring, not just building
2. **Progression Variety**: Users try more diverse chord combinations
3. **Feature Discovery**: Users access explanations and comparisons
4. **Lesson Completion**: Users progress through learning paths
5. **Return Visits**: Users come back to continue learning

---

## Files to Create/Modify

### New Files
```
src/data/
  theoryExplanations/
    concepts.js              # 200+ concept definitions
    chordFunctions.js        # Function explanations
    progressionPatterns.js   # Pattern explanations
    glossary.js              # Term definitions
    famousProgressions.js    # Analyzed real songs
    lessons/
      beginner/
        lesson01-what-is-chord.js
        lesson02-major-vs-minor.js
        lesson03-first-progression.js
        ...
      intermediate/
        ...
      advanced/
        ...

src/modules/ui/
  whyThisWorksPanel.js       # Main explanation panel
  chordComparisonModal.js    # A/B comparison interface
  learnModeToggle.js         # Global learn mode control
  skillLevelSelector.js      # User level setting
  lessonViewer.js            # Lesson display component
  earTrainingModule.js       # Quiz/exercise interface
  progressionLibrary.js      # Famous progressions browser

src/modules/features/
  explanationEngine.js       # Gets appropriate explanation for context
  learningProgress.js        # Tracks user progress through lessons
```

### Modified Files
```
src/modules/features/progressionBuilder.js
  - Add "Why?" buttons to recommendations
  - Integrate chord function colors
  - Add learn mode hooks

src/modules/features/chordBuilder.js
  - Add explanation triggers
  - Integrate with explanation engine

src/modules/ai/melodySuggestion.js
  - Add explanation data to suggestions

src/modules/ui/tabs.js
  - Add "Learn" tab

index.html
  - Add skill level selector to settings
  - Add learn mode toggle
```

---

## Next Steps

### Immediate (This Session)
1. Create the Theory Explanation Database structure
2. Build initial set of chord function explanations
3. Create the "Why This Works" panel component

### Next Session
4. Implement chord function color coding
5. Add skill level selector
6. Integrate explanations with chord recommendations

### Following Sessions
7. Build A/B comparison tool
8. Create first 3 beginner lessons
9. Add Learn tab to navigation

---

## Appendix: Beginner-Friendly Terminology Guide

**Use These Terms → Instead of These**

| Say This | Not This |
|----------|----------|
| "home chord" or "resting chord" | tonic |
| "tension chord" or "wants-to-move chord" | dominant |
| "traveling chord" | subdominant |
| "borrowed chord" or "surprise chord" | modal interchange |
| "smooth movement" or "small steps" | stepwise motion |
| "question and answer" | cadence |
| "spicy notes" or "color notes" | tensions |
| "in-between note" or "connecting note" | passing tone |
| "the 'almost home' feeling" | dominant function |
| "happy chord" / "sad chord" | major / minor |

**Always introduce the technical term AFTER the concept:**
> "This chord wants to go home (musicians call this 'dominant function')"

This way users learn both the concept AND the vocabulary.

---

*Document created: December 2024*
*Last updated: December 2024*
*Status: Ready for Implementation*
