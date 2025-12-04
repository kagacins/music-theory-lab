# Recommendation Engine Enhancement Plan

## Overview

This document outlines a comprehensive plan to enhance the Music Theory Lab's recommendation engines for chords, chord sequences, melody, and harmony. The enhancements build upon the existing solid foundation while addressing specific opportunities identified through analysis.

**Created:** December 2024
**Status:** Active Development
**Primary Files:**
- `src/modules/features/chordSequences.js` - Chord sequence generation
- `src/modules/ai/autoHarmonize.js` - Melody harmonization
- `src/modules/features/comprehensiveChordRecommendations.js` - Individual chord recommendations
- `src/modules/ai/melodySuggestion.js` - Melody note suggestions

---

## Current State Summary

### Chord Sequence Recommendations
- Uses beam-search algorithm for multi-chord sequences (2, 4, or 8 chords)
- Style-aware same-root tolerance (Jazz 30%, Pop 10%)
- Evaluates voice leading, pattern coherence, root variety, and cadential motion
- Dynamic weight adjustment based on user preferences

**Current Limitations:**
- Look-back limited to 1 chord when generating each step
- No tracking of root occurrence across the full sequence context
- No melody awareness - ignores existing melody for the section
- Same-root penalty can be overcome by high individual chord scores

### Auto-Harmonize
- Analyzes melody notes measure-by-measure
- Considers previous chord for voice leading
- Style-aware chord type preferences
- Section context profiles for intro/verse/chorus/etc.

**Current Limitations:**
- Only looks at immediately previous chord (not 2-3 chords back)
- No look-ahead capability - doesn't consider upcoming melody
- Sequential processing without optimization pass

### Individual Chord Recommendations
- 3D evaluation: root × chord type × inversion
- 4th dimension: tension direction
- Considers harmonic function, style preferences, mood modifiers
- Section context integration

### Melody Recommendations
- Note categorization by relationship to chord
- Style-specific scoring adjustments
- Contour awareness (ascending/descending/arch)

---

## Enhancement Tiers

### Tier 1: Quick Wins (High Impact, Lower Effort)

#### Enhancement A: Root Fatigue Tracking
**Goal:** Prevent repetitive root usage across sequences by tracking and penalizing roots that appear too frequently in recent context.

**Implementation:**
1. Add `analyzeRootHistory()` function to examine last 6-8 chords (including progression context)
2. Create escalating penalty system:
   - Root appears 1x in last 6 chords: no penalty
   - Root appears 2x: -15 point penalty
   - Root appears 3x: -35 point penalty
   - Root appears 4+: -60 point penalty
3. Integrate into `generateChordSequences()` scoring
4. Make penalties style-aware (jazz more tolerant than pop)

**Files Modified:** `chordSequences.js`

**Expected Impact:** Significantly reduces same-root repetition in recommended sequences

---

#### Enhancement B: Melody Awareness in Chord Sequences
**Goal:** When generating chord sequences for a section with existing melody, ensure recommended chords harmonize well with the melody.

**Implementation:**
1. Add optional `melodyData` parameter to `generateChordSequences()`
2. Create `scoreMelodyAlignment()` function:
   - Extract prominent melody pitches for each chord position
   - Calculate what percentage of melody notes are chord tones
   - Bonus for chord tones on strong beats
3. Add `melodyAlignment` weight to `BASE_SEQUENCE_WEIGHTS` (suggest 0.15)
4. Integrate with existing `analyzeMeasureMelody()` from autoHarmonize.js

**Files Modified:** `chordSequences.js`

**Expected Impact:** Chord sequences that work musically with existing melodies

---

#### Enhancement C: Extended Look-Back in Auto-Harmonize
**Goal:** Consider 2-3 previous chords instead of just 1 for better pattern awareness and voice leading.

**Implementation:**
1. Modify `autoHarmonize()` to maintain a sliding window of last 3 chords
2. Create `analyzeChordPattern()` to detect repetitive patterns (I-IV-I-IV)
3. Penalize creating patterns that repeat more than twice
4. Enhance voice leading scoring to consider motion trends across 3 chords
5. Add "progression momentum" awareness (are we building or releasing tension?)

**Files Modified:** `autoHarmonize.js`

**Expected Impact:** More sophisticated harmonizations that avoid mechanical repetition

---

### Tier 2: Moderate Integration (Medium Effort)

#### Enhancement D: Look-Ahead in Auto-Harmonize
**Goal:** Consider upcoming melody notes when choosing current chord to prepare voice leading.

**Implementation:**
1. Add two-pass harmonization option:
   - Pass 1: Generate initial suggestions measure-by-measure
   - Pass 2: Refine choices based on what comes next
2. Create `evaluateLookAhead()` function:
   - Examine melody notes in next 1-2 measures
   - Check if current chord choice prepares for upcoming melodic content
   - Reward chords that create smooth transitions to likely next chords
3. Detect upcoming modulations or key changes in melody
4. Add optional `bidirectional` mode for highest quality harmonization

**Files Modified:** `autoHarmonize.js`

**Expected Impact:** Harmonizations that sound intentional and prepared

---

#### Enhancement E: Deeper Section Context Integration
**Goal:** Use section type (intro/verse/chorus/bridge) more deeply in all recommendation engines.

**Implementation:**
1. Create unified `SectionContextProvider` module:
   - Standardize section context format across all engines
   - Include: section type, position in section, section energy/intensity, preceding/succeeding section types
2. Enhance `chordSequences.js`:
   - Chorus: encourage stronger root motion, more tension variety
   - Verse: allow more repetition, gentler progressions
   - Bridge: encourage departure from established patterns
   - Intro/Outro: favor resolution and stability
3. Add section-transition awareness:
   - Pre-chorus building to chorus should increase tension
   - Chorus to verse should provide release
4. Create `getSectionCharacteristics()` utility for consistent section behavior

**Files Modified:** `chordSequences.js`, `autoHarmonize.js`, `comprehensiveChordRecommendations.js`

**Expected Impact:** Recommendations that fit the musical context of each section

---

#### Enhancement F: Cross-Engine Melody Verification
**Goal:** After generating chord sequences, verify compatibility with existing melody and optionally adjust.

**Implementation:**
1. Create `verifyMelodyCompatibility()` function:
   - Takes chord sequence and melody data
   - Calculates compatibility score for each chord-measure pair
   - Identifies problem areas (many non-chord tones on strong beats)
2. Add optional `melodyVerification` mode to sequence generation:
   - After beam search, run verification pass
   - Flag or filter sequences with low melody compatibility
3. Create `suggestMelodyAwareAlternatives()`:
   - For problem chords, suggest alternatives that work better with melody
4. Integrate with chord sequence UI to show melody compatibility indicator

**Files Modified:** `chordSequences.js`, new utility module

**Expected Impact:** Ensures all chord recommendations work with existing musical content

---

### Tier 3: Advanced (Higher Effort) - Future Reference

#### Enhancement G: Bidirectional Harmonization
**Goal:** Full forward-backward optimization for highest quality harmonizations.

**Implementation:**
1. Forward pass: Generate candidate harmonizations
2. Backward pass: Starting from end, optimize voice leading backward
3. Reconciliation: Merge passes, preferring smoothest overall voice leading
4. Optional iterative refinement until convergence

**Expected Impact:** Professional-quality harmonizations comparable to human arrangers

---

#### Enhancement H: Tension Arc Planning
**Goal:** Generate progressions that follow a specified tension trajectory.

**Implementation:**
1. Accept target tension curve (array of values 0-1)
2. Modify beam search to prefer sequences matching target tension
3. Create tension-aware scoring that rewards matching the arc
4. Allow user to draw/specify tension curves in UI

**Expected Impact:** Gives users control over emotional trajectory of their music

---

#### Enhancement I: Machine Learning Preference Learning
**Goal:** Learn from user choices to improve future recommendations.

**Implementation:**
1. Track which suggestions users select vs reject
2. Build user preference profile over time
3. Adjust recommendation scoring based on learned preferences
4. Allow preference import/export between sessions

**Expected Impact:** Personalized recommendations that improve with use

---

#### Enhancement J: Full-Song Planning
**Goal:** Generate coherent progressions for entire song structures.

**Implementation:**
1. Accept song structure (verse-chorus-verse-chorus-bridge-chorus)
2. Plan harmonic journey across sections
3. Ensure key relationships and transitions work
4. Suggest modulations at appropriate points

**Expected Impact:** End-to-end song composition assistance

---

## Implementation Priority

### Phase 1 (COMPLETED - December 2024)
1. Enhancement A: Root Fatigue Tracking - DONE
   - Added `analyzeRootFatigue()` and `calculateRootFatigueScore()` to chordSequences.js
   - Tracks root usage across last 8 chords with position weighting
   - Style-aware sensitivity (jazz more tolerant, pop/rock stricter)
   - Integrated into sequence scoring as new weight factor

2. Enhancement B: Melody Awareness in Chord Sequences - DONE
   - Added `calculateMelodyAlignmentScore()` to chordSequences.js
   - Analyzes melody notes per measure and scores chord tone matches
   - Considers beat position weighting for strong beats
   - New `melodyOptions` parameter in `generateChordSequences()`

3. Enhancement C: Extended Look-Back in Auto-Harmonize - DONE
   - Added `EXTENDED_LOOKBACK_CONFIG` with 3-chord history depth
   - Pattern detection: repetitive alternation, pendulum motion, frequent roots
   - Pattern bonuses: circle of fifths, stepwise motion, cadential approach
   - `applyExtendedLookback()` re-scores suggestions based on history

4. Enhancement D: Look-Ahead in Auto-Harmonize - DONE
   - Added `LOOKAHEAD_CONFIG` with 2-measure look-ahead
   - `analyzeLookAhead()` examines upcoming melody for preparation bonuses
   - Rewards common tones, leading tone preparation, tension trajectory
   - `applyLookAhead()` integrated into main harmonization loop

5. Enhancement E: Deeper Section Context Integration - DONE
   - Added `calculateSectionContextScore()` to chordSequences.js
   - Imports and uses `sectionProfiles.js` for section-aware scoring
   - Evaluates chord type preferences, position adjustments, transitions
   - Section-specific behaviors for chorus, bridge, outro, prechorus

6. Enhancement F: Cross-Engine Melody Verification - DONE
   - Added `verifyMelodyCompatibility()` as main verification function
   - `batchVerifyMelodyCompatibility()` for filtering multiple sequences
   - `filterMelodyCompatibleSequences()` for easy filtering
   - Provides detailed compatibility reports with alternative suggestions

### Phase 2 (COMPLETED - December 2024)

7. Enhancement G: Bidirectional Harmonization - DONE
   - Added `BIDIRECTIONAL_CONFIG` with iteration and weight settings
   - `bidirectionalHarmonize()` performs forward-backward optimization
   - `performBackwardPass()` re-scores based on following chord
   - `calculateBackwardScore()` evaluates voice leading TO next chord
   - `calculateVoiceLeadingToNext()`, `calculateTensionResolutionScore()`, `calculatePreparationScore()`
   - Integrated into `autoHarmonize()` with `bidirectional` option (default: true)

8. Enhancement H: Tension Arc Planning - DONE
   - Added `TENSION_ARC_CONFIG` with chord tension levels
   - `TENSION_ARC_SHAPES` with predefined patterns: flat, ascending, descending, arch, wave, dramatic, stepped
   - `calculateChordTensionLevel()` considers chord type, harmonic function, inversion
   - `calculateTensionArcMatch()` scores sequence against target arc
   - `generateTensionArcSequences()` generates sequences following target tension
   - `createCustomTensionArc()` for user-defined tension curves
   - `suggestTensionArcForSection()` recommends arcs by section type

### Phase 3 (Long-term)
- Enhancement I: Machine Learning
- Enhancement J: Full-Song Planning

---

## Testing Strategy

### Unit Tests
- Test root fatigue penalties with various chord histories
- Test melody alignment scoring with known melody/chord pairs
- Test look-ahead scoring with prepared progressions

### Integration Tests
- Generate sequences with and without melody context, verify difference
- Test section context affects recommendations appropriately
- Verify cross-engine verification catches incompatibilities

### User Acceptance
- A/B testing with real users
- Collect feedback on recommendation quality
- Compare "before" and "after" recommendation samples

---

## Success Metrics

1. **Root Variety:** Average unique roots per 4-chord sequence should increase
2. **Melody Compatibility:** Chord sequences should have 70%+ chord-tone alignment with melodies
3. **User Satisfaction:** Fewer "regenerate" actions needed to find suitable recommendations
4. **Pattern Variety:** Reduced occurrence of mechanical repetitive patterns

---

## Notes

- All enhancements maintain backward compatibility
- User weight preferences continue to work as before
- Style-awareness preserved and enhanced
- Performance impact should be minimal (most work happens in already-expensive generation phase)
