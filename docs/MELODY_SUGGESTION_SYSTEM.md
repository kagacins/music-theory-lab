# Melody Suggestion System - Technical Reference

**Version:** 1.0.0
**Last Updated:** December 2024
**Purpose:** Comprehensive documentation for understanding, debugging, and enhancing the melody suggestion engine.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Concepts](#core-concepts)
3. [File Structure](#file-structure)
4. [Scoring System Deep Dive](#scoring-system-deep-dive)
5. [Music Theory Fundamentals](#music-theory-fundamentals)
6. [Known Issues & Solutions](#known-issues--solutions)
7. [Enhancement Opportunities](#enhancement-opportunities)
8. [Testing & Debugging](#testing--debugging)

---

## Architecture Overview

### Data Flow

```
User Action (click beat position)
        ↓
MelodySuggestionController.js (orchestration)
        ↓
melodySuggestion.js::generateMelodySuggestions()
        ↓
    ┌───────────────────────────────────────┐
    │  For each candidate note (all 12     │
    │  pitch classes × octave range):      │
    │                                       │
    │  1. scoreChordRelation()             │
    │  2. scoreScaleRelation()             │
    │  3. scoreVoiceLeading()              │
    │  4. scoreApproachTone()              │
    │  5. scoreTension()                   │
    │  6. scoreChordClash()                │
    │  7. scoreOutOfKey()                  │
    │  8. scoreAnticipation()              │
    │  9. scoreContour()                   │
    │  10. scoreMood()                     │
    │  11. Apply proximity/recency bonuses │
    └───────────────────────────────────────┘
        ↓
Sort candidates by total score
        ↓
Normalize to 0-100 range
        ↓
Return top 15 suggestions
        ↓
UI displays in MelodySuggestionPanel or CanvasSuggestionManager
```

### Key Interfaces

```javascript
// Main suggestion function signature
generateMelodySuggestions({
    chord: { root: 'C', type: 'Major' },  // Current chord
    key: 'C',                              // Key signature
    previousNote: 'G4',                    // Previous melody note
    styleId: 'pop',                        // Style preset
    contourId: 'ascending',                // Contour preference
    mood: 'bright',                        // Mood setting
    octave: 4,                             // Target octave
    range: 2,                              // Octave range to consider
    recentNotes: ['E4', 'G4', 'C5'],       // Recent notes for recency penalty
    nextChord: { root: 'G', type: 'Major' }, // Next chord (for anticipation)
    anticipationFactor: 0.7,               // 0-1, proximity to chord change
    sectionIntent: { mode: 'continue', subMode: 'building' }
})
```

---

## Core Concepts

### Note Categories

Each candidate note is classified into one of these categories:

| Category | Base Score | Description | When Applied |
|----------|------------|-------------|--------------|
| `chordTone` | 95 | Note is part of current chord | Root, 3rd, 5th, 7th, etc. |
| `stepwiseMotion` | 85 | Smooth motion from previous note | Within 2 semitones |
| `approachTone` | 75 | Half-step to chord tone | Chromatic neighbor |
| `scaleTone` | 70 | In the key signature | Diatonic, non-chord tone |
| `passingTone` | 65 | Creates melodic movement | Between chord tones |
| `tension` | 55 | Adds harmonic color | b9, #11, b13 |
| `avoid` | 25 | Clashes with chord | Semitone from chord tone |

### Pitch Class System

All pitch calculations use **pitch classes** (0-11 representing C through B):

```javascript
// Pitch class mapping
const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Example: E = pitch class 4, Bb/A# = pitch class 10
```

### Scale Intervals

```javascript
const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],        // W-W-H-W-W-W-H
    minor: [0, 2, 3, 5, 7, 8, 10],        // W-H-W-W-H-W-W
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11], // Raised 7th
    dorian: [0, 2, 3, 5, 7, 9, 10],       // Minor with raised 6th
    mixolydian: [0, 2, 4, 5, 7, 9, 10],   // Major with lowered 7th
    pentatonicMajor: [0, 2, 4, 7, 9],     // No 4th or 7th
    blues: [0, 3, 5, 6, 7, 10]            // Minor pentatonic + blue note
};
```

### Chord Intervals

```javascript
const CHORD_INTERVALS = {
    'Major': [0, 4, 7],           // Root, M3, P5
    'Minor': [0, 3, 7],           // Root, m3, P5
    'Dominant 7th': [0, 4, 7, 10], // Root, M3, P5, m7
    'Major 7th': [0, 4, 7, 11],   // Root, M3, P5, M7
    'Minor 7th': [0, 3, 7, 10],   // Root, m3, P5, m7
    'Diminished': [0, 3, 6],      // Root, m3, dim5
    'Augmented': [0, 4, 8],       // Root, M3, aug5
    'Sus4': [0, 5, 7],            // Root, P4, P5
    'Sus2': [0, 2, 7],            // Root, M2, P5
    // ... see full list in melodySuggestion.js
};
```

---

## File Structure

### Primary Files

| File | Purpose | Key Exports |
|------|---------|-------------|
| `src/modules/ai/melodySuggestion.js` | Core scoring engine | `generateMelodySuggestions()`, `STYLE_RULES`, `MOOD_RULES` |
| `src/modules/ai/melodySuggestionController.js` | Orchestration & context | Controller class |
| `src/modules/ui/melodySuggestionPanel.js` | Sidebar UI | Panel rendering |
| `src/modules/config/weightPresets.js` | User weight presets | `getSavedMelodyWeights()`, `MELODY_WEIGHT_PRESETS` |
| `src/modules/canvas/suggestions/` | Canvas-integrated UI | `CanvasSuggestionManager` |

### Related Files

| File | Purpose |
|------|---------|
| `src/modules/ai/melodicPhraseGenerator.js` | Multi-note phrase generation |
| `src/modules/ai/sectionAwareMelodyGenerator.js` | Section-based melody generation |
| `src/modules/ai/enhancedMelodyController.js` | Advanced melody features |
| `src/modules/ai/motifRecognition.js` | Pattern/motif detection |

---

## Scoring System Deep Dive

### Style Rules

Style rules are **multipliers** that adjust base scores. Values > 1.0 boost, < 1.0 reduce.

```javascript
export const STYLE_RULES = {
    pop: {
        chordToneBoost: 1.3,          // Pop loves chord tones
        scaleToneBoost: 1.1,          // Scale tones good
        stepwiseBoost: 1.2,           // Smooth melodies
        approachToneBoost: 0.7,       // Less chromatic
        tensionPenalty: 1.4,          // Avoid tension
        chromaticPenalty: 1.8,        // Strong diatonic preference
        chromaticApproachPenalty: 0.4, // Chromatic approaches rare
        chordClashPenalty: 35,        // Heavy clash penalty
        preferredIntervals: [0, 2, 4, 5, 7],
        avoidIntervals: [1, 6, 10, 11]
    },
    jazz: {
        chordToneBoost: 1.0,
        scaleToneBoost: 0.9,
        approachToneBoost: 1.4,       // Jazz loves approach tones
        tensionPenalty: 0.6,          // Tension is a feature!
        chromaticPenalty: 0.5,        // Chromatic is welcome
        chromaticApproachPenalty: 1.2, // Chromatic approaches BOOSTED
        chordClashPenalty: 5,         // Clashes = color
        avoidIntervals: []            // Nothing avoided
    },
    // ... classical, rock, balanced, indie
};
```

### Mood Rules

Mood rules apply **additional bonuses/penalties** on top of style rules:

```javascript
export const MOOD_RULES = {
    calm: {
        stepwiseBonus: 15,            // Smooth motion
        wideLeapPenalty: -12,         // No big jumps
        consonanceBonus: 10,          // Perfect intervals
        dissonancePenalty: -15,       // Avoid dissonance
        chromaticPenalty: -20,        // Stay diatonic
        chromaticApproachPenalty: -25, // No chromatic tension
        chordClashPenalty: -30,       // No clashing
        chordToneBonus: 12            // Stable chord tones
    },
    bright: {
        majorIntervalBonus: 15,
        preferMajorThird: true,
        preferPerfectFifth: true,
        highRegisterBonus: 8,         // Per octave above 4
        dissonancePenalty: -12
    },
    tense: {
        tensionBonus: 20,
        wideLeapBonus: 10,
        tritoneBonus: 15,
        stepwisePenalty: -8
    },
    // ... dark, jazzy, energetic
};
```

### Critical Scoring Functions

#### 1. scoreChordRelation()
Determines if note is a chord tone and which degree.

```javascript
// Returns: { score: 95, category: 'chordTone', detail: 'Root' }
// Root = highest priority, then 5th, 3rd, extensions
```

#### 2. scoreApproachTone() - KEY-AWARE
**Critical fix applied:** Now distinguishes diatonic vs chromatic approach tones.

```javascript
function scoreApproachTone(note, chord, previousNote, styleRules, keyRoot, scaleType) {
    const notePc = getPitchClass(note);
    const chordTones = getChordTones(chord);
    const scaleNotes = getScaleNotes(keyRoot, scaleType);
    const isInScale = scaleNotes.includes(notePc);

    // Check if half-step from chord tone
    for (const chordTone of chordTones) {
        if ((notePc + 1) % 12 === chordTone || (notePc + 11) % 12 === chordTone) {
            // Diatonic approach = full score
            // Chromatic approach = reduced by chromaticApproachPenalty
            const chromaticMultiplier = isInScale ? 1.0 : (styleRules.chromaticApproachPenalty || 0.6);
            return {
                score: baseScore * styleRules.approachToneBoost * chromaticMultiplier,
                category: 'approachTone',
                detail: isInScale ? 'Diatonic approach' : 'Chromatic approach',
                isChromatic: !isInScale
            };
        }
    }
    return null;
}
```

#### 3. scoreChordClash()
Penalizes notes a semitone away from chord tones (creates dissonance).

```javascript
function scoreChordClash(note, chord, styleRules, keyRoot, scaleType) {
    // Returns penalty if note is semitone from ANY chord tone
    // Penalty increased 1.5x if note is also outside the key
    // Example: G natural against E major chord = clashes with G# (the 3rd)
}
```

#### 4. scoreOutOfKey()
Penalizes chromatic (non-diatonic) notes.

```javascript
function scoreOutOfKey(note, keyRoot, scaleType, styleRules) {
    // Returns: { penalty: 18, category: 'chromatic', detail: 'Outside key signature' }
    // Penalty = chromaticPenalty × 15 base points
}
```

#### 5. scoreAnticipation()
Rewards notes that lead smoothly into the NEXT chord.

```javascript
// High score for:
// - Root of next chord (35 points)
// - Leading tone to next root (32 points)
// - 3rd of next chord (30 points)
// - Common tones between chords (+10 bonus)
```

---

## Music Theory Fundamentals

### Why Key-Awareness Matters

**Problem Example (December 2024 fix):**
- Key: B major (contains G#, not G)
- Chord: E major (E-G#-B)
- Before fix: G natural scored 75 as "approach tone" to G#
- Issue: G natural is chromatic in B major, creates tension against E major

**After fix:**
- G natural detected as chromatic (not in B major scale)
- Approach tone score reduced by `chromaticApproachPenalty` (0.6× for balanced)
- Additional chord clash penalty (G is semitone from G#)
- Additional out-of-key penalty
- Total: ~100 point penalty instead of 75 point bonus

### Interval Quality Reference

| Semitones | Interval | Quality | Melodic Use |
|-----------|----------|---------|-------------|
| 0 | Unison | Perfect | Repetition, emphasis |
| 1 | Minor 2nd | Dissonant | Chromatic passing, tension |
| 2 | Major 2nd | Mild dissonance | Stepwise motion, common |
| 3 | Minor 3rd | Consonant | Smooth, minor feel |
| 4 | Major 3rd | Consonant | Smooth, major feel |
| 5 | Perfect 4th | Perfect | Open, suspended |
| 6 | Tritone | Dissonant | Tension, needs resolution |
| 7 | Perfect 5th | Perfect | Strong, open |
| 8 | Minor 6th | Consonant | Expressive |
| 9 | Major 6th | Consonant | Bright, common |
| 10 | Minor 7th | Mild dissonance | Jazz color |
| 11 | Major 7th | Dissonant | Tension, leads to octave |
| 12 | Octave | Perfect | Emphasis, climax |

### Chord Tone Hierarchy

Within a chord, notes have different levels of stability:

1. **Root** - Most stable, defines the chord
2. **5th** - Very stable, reinforces root
3. **3rd** - Defines major/minor quality
4. **7th** - Adds color, less stable
5. **Extensions** (9, 11, 13) - Color tones, context-dependent

### Common Avoid Notes

| Chord Type | Avoid Note | Reason |
|------------|------------|--------|
| Major triad | Perfect 4th | Clashes with major 3rd |
| Major 7th | Perfect 4th | Same + clashes with 7th |
| Dominant 7th | Major 7th | Clashes with minor 7th |
| Minor 7th | Major 3rd | Clashes with minor 3rd |

---

## Known Issues & Solutions

### Issue: Out-of-Key Notes Scoring Too High
**Symptom:** Chromatic notes recommended when they shouldn't be
**Root Cause:** `scoreApproachTone()` didn't check if note was in key
**Solution:** Added `keyRoot` and `scaleType` parameters, apply `chromaticApproachPenalty`

### Issue: Chord Clashes Not Penalized
**Symptom:** Notes a semitone from chord tones score well
**Root Cause:** No function to detect semitone conflicts
**Solution:** Added `scoreChordClash()` function with style-specific penalties

### Issue: Calm Mood Still Suggests Tense Notes
**Symptom:** Chromatic/tension notes appear in calm mood suggestions
**Root Cause:** Mood rules didn't have chromatic penalties
**Solution:** Added `chromaticPenalty`, `chromaticApproachPenalty`, `chordClashPenalty` to calm mood

### Issue: Template Chord Voicings Not Voice-Led
**Symptom:** bVII chord lower than I chord when loaded
**Root Cause:** `convertTemplateToChordData()` uses fixed `baseOctave = 3`
**Solution:** (Pending) Apply `getVoiceLeadingOptimizedProgression()` by default

---

## Harmonic Awareness Features (December 2024)

The melody suggestion system now includes sophisticated harmonic awareness, matching the chord recommendation system's level of music theory understanding.

### Phase 1: Harmonic Function Awareness ✅

**Function:** `scoreHarmonicFunctionFit(note, chord, key, styleRules)`

Understands whether the current chord is Tonic, Subdominant, or Dominant and adjusts note preferences accordingly:

| Chord Function | Note Preferences |
|----------------|------------------|
| **Dominant (V, vii°)** | Leading tone (+25), Scale degree 4 (+18), Chord root (+10) |
| **Tonic (I, iii, vi)** | Tonic note (+15), Fifth (+10), Avoid 4th (-8 in non-jazz) |
| **Subdominant (ii, IV)** | All scale tones acceptable (+5) |

### Phase 2: Tendency Tone Resolution ✅

**Function:** `scoreTendencyToneResolution(note, previousNote, chord, key, styleRules)`

Tracks melodic tension and rewards proper resolution:

| Previous Note | Expected Resolution | Score |
|---------------|---------------------|-------|
| Leading tone (7) | Resolve UP to tonic | +30 if resolved, -20 if unresolved |
| Scale degree 4 | Resolve DOWN to 3 | +20 if resolved |
| Chromatic note | Resolve by half-step | +25 if resolved, -15 if jumped away |

### Phase 3: Modal/Borrowed Chord Awareness ✅

**Function:** `detectBorrowedChordMode(chord, key)` + `scoreModalFit(note, chord, key)`

When a chord is borrowed from another mode, the system suggests notes from that mode:

| Borrowed Chord | Source Mode | Scale Used |
|----------------|-------------|------------|
| bVII (Major) | Mixolydian | Major with b7 |
| iv (Minor) | Parallel Minor | Natural minor |
| bVI (Major) | Parallel Minor | Natural minor |
| bIII (Major) | Parallel Minor | Natural minor |
| ii° (Diminished) | Natural Minor | Natural minor |

**Scoring:** Notes fitting the borrowed mode get +12, notes outside get -18.

### Phase 4: Bass Clef Awareness / Counterpoint ✅

**Function:** `scoreBassRelationship(melodyNote, chord, bassNote, styleRules)`

Considers the bass note and applies counterpoint rules:

| Interval with Bass | Score | Reason |
|--------------------|-------|--------|
| Unison/Octave | -5 to -12 | Reduces melodic independence |
| Major/minor 3rd | +12 | Rich harmony |
| Major/minor 6th | +10 | Good counterpoint |
| Perfect 5th | -2 to -8 | Open/hollow sound |
| Perfect 4th | -5 to +2 | Context dependent |
| 2nd/7th | -8× tension penalty | Dissonant |
| Tritone | -10× tension penalty | Maximum tension |

### Phase 5: Phrase Position & Cadential Patterns ✅

**Function:** `scorePhrasePosition(note, chord, key, phraseContext, nextChord)`

Different note preferences based on where we are in the phrase:

| Position | Preferred Notes | Score |
|----------|-----------------|-------|
| **Cadence (final)** | Tonic (+30), Third (+20), Fifth (+12), Others (-15) |
| **Approaching Cadence** | Leading tone (+25), Scale degree 2 (+15) |
| **Beginning** | Tonic (+18), Fifth (+15), Third (+10) |
| **Middle** | No special adjustments |

Phrase position is inferred from `sectionIntent`:
- `final` → cadence
- `concluding` → approaching-cadence
- `starting` → beginning
- Other → middle

### Phase 6: Resolution Expectation Tracking ✅

**Class:** `MelodyResolutionTracker`

Tracks unresolved melodic tensions across notes:

```javascript
const tracker = createResolutionTracker(key);

// Record each note played
tracker.recordNote('B4'); // Records that leading tone needs resolution

// Score how well a candidate resolves expectations
const result = tracker.scoreResolution('C5');
// Returns: { score: 19, reasons: ['Leading tone expects tonic - resolved!'], resolvedCount: 1 }
```

**Tracked Expectations:**
- Leading tone → expects tonic (urgency 0.95)
- Scale degree 4 → expects 3rd (urgency 0.7)
- Chromatic notes → expect half-step resolution (urgency 0.8)

**Note:** Phase 6 tracking requires integration at a higher level to persist across suggestion calls.

---

## Remaining Enhancement Opportunities

### Medium Priority

1. **Blue Note Support for Rock/Blues**
   - `useBlueNotes: true` flag exists but not implemented
   - Enhancement: Add b5 (blue note) as valid tension in blues context

2. **Rhythmic Context**
   - Currently: Only pitch is considered
   - Enhancement: Strong beats prefer chord tones, weak beats allow passing tones

3. **Motif Recognition Integration**
   - `motifRecognition.js` exists but not integrated
   - Enhancement: Suggest notes that continue detected patterns

4. **Voice Leading Between Melody Notes**
   - Currently: Only considers previous note
   - Enhancement: Look at last 2-3 notes for better contour analysis

### Lower Priority

5. **Register-Specific Scoring**
   - Enhancement: Different rules for soprano vs. alto register melodies

6. **Harmonic Rhythm Awareness**
   - Enhancement: Consider how long current chord lasts

7. **Genre-Specific Blue/Outside Notes**
   - Enhancement: Jazz allows more outside, pop restricts

8. **Real-Time Learning**
   - Track which suggestions user selects
   - Adjust weights based on user preference patterns

---

## Testing & Debugging

### Debug Logging

Add to `generateMelodySuggestions()`:

```javascript
console.log('[MelodySuggestion] Context:', {
    chord: chord.root + ' ' + chord.type,
    key: key,
    keyRoot: keyRoot,
    scaleType: scaleType,
    style: styleId,
    mood: mood
});

// Per-candidate debugging:
console.log(`[MelodySuggestion] ${noteName}: `, {
    chordScore: chordScore?.score,
    approachScore: approachScore?.score,
    clashPenalty: clashResult?.penalty,
    outOfKeyPenalty: outOfKeyResult?.penalty,
    moodBonus: moodBonus,
    total: totalScore
});
```

### Test Cases

#### Test 1: Key Awareness
```javascript
// Setup: E major chord in B major key
// Expected: G# scores high (chord tone), G natural scores low (chromatic clash)
const result = generateMelodySuggestions({
    chord: { root: 'E', type: 'Major' },
    key: 'B',
    styleId: 'balanced',
    mood: 'calm'
});
// Verify: G# near top, G natural near bottom or absent
```

#### Test 2: Chord Clash Detection
```javascript
// Setup: C major chord
// Expected: B natural (semitone from C) penalized, D (whole step) not penalized
const result = generateMelodySuggestions({
    chord: { root: 'C', type: 'Major' },
    key: 'C',
    styleId: 'pop'
});
// Verify: D scores higher than B
```

#### Test 3: Style Differentiation
```javascript
// Setup: Same chord, different styles
// Expected: Jazz allows more chromatic, Pop restricts
const jazzResult = generateMelodySuggestions({ styleId: 'jazz', ... });
const popResult = generateMelodySuggestions({ styleId: 'pop', ... });
// Verify: Jazz has more variety, Pop more chord-tone focused
```

#### Test 4: Mood Impact
```javascript
// Setup: Same chord, calm vs tense mood
// Expected: Calm = consonant, Tense = dissonant
const calmResult = generateMelodySuggestions({ mood: 'calm', ... });
const tenseResult = generateMelodySuggestions({ mood: 'tense', ... });
// Verify: Different rankings for same notes
```

### Common Debugging Scenarios

**"Why did X note score so high?"**
1. Add logging to each scoring function
2. Check if it's a chord tone (highest priority)
3. Check if approach tone logic is triggering incorrectly
4. Verify key/scale detection is correct

**"Suggestions seem random"**
1. Check that `chord` object has valid `root` and `type`
2. Verify `type` matches exact key in `CHORD_INTERVALS`
3. Check that `key` parameter is being passed correctly

**"Style/mood not affecting results"**
1. Verify `styleId` matches key in `STYLE_RULES`
2. Verify `mood` matches key in `MOOD_RULES`
3. Check that user weight multipliers aren't overriding

---

## Appendix: Quick Reference

### CHORD_DEFINITIONS Naming (from claude.md)

**Always use these exact strings for chord types:**
```
Major, Minor, Diminished, Augmented, Sus2, Sus4,
Dominant 7th, Major 7th, Minor 7th, Minor-Major 7th,
Diminished 7th, Half-Diminished 7th, Augmented 7th,
Major 6th, Minor 6th, Add9, Major 9th, Dominant 9th, Minor 9th,
6/9, Dominant 11th, Minor 11th, Dominant 13th,
7b5, 7#5, 7b9, 7#9, Major 7th #11, Power Chord
```

### Pitch Class Quick Reference

| Note | C | C#/Db | D | D#/Eb | E | F | F#/Gb | G | G#/Ab | A | A#/Bb | B |
|------|---|-------|---|-------|---|---|-------|---|-------|---|-------|---|
| PC   | 0 | 1     | 2 | 3     | 4 | 5 | 6     | 7 | 8     | 9 | 10    | 11|

### MIDI Note Numbers

```
C4 = 60 (middle C)
Formula: MIDI = (octave + 1) × 12 + pitchClass
Example: E4 = (4 + 1) × 12 + 4 = 64
```

---

## Document Maintenance

When making changes to the melody suggestion system:

1. Update the relevant section of this document
2. Add to "Known Issues & Solutions" if fixing a bug
3. Add to "Enhancement Opportunities" if identifying new improvements
4. Update test cases as needed

**Last comprehensive review:** December 2024
