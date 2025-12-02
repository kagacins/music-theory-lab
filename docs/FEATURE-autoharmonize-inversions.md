# Feature: Auto-Harmonize Inversion Recommendations

## Overview

Enhance the `autoHarmonize` function to recommend optimal chord inversions based on voice leading principles, rather than always returning root position chords.

## Current State

**File:** `src/modules/ai/autoHarmonize.js`

Currently, `autoHarmonize()` returns chord suggestions with only:
- `root` - The root note (e.g., "C", "G", "Am")
- `type` - The chord type (e.g., "Major", "Minor", "Dominant7")
- `score` - Match percentage
- `reasons` - Array of explanation strings

Inversions are not calculated or returned. All chords are implicitly in root position.

## Proposed Changes

### 1. Update Return Structure

Add `inversion` field to each chord suggestion:

```javascript
{
  root: 'C',
  type: 'Major',
  inversion: 1,  // NEW: 0 = root, 1 = 1st inversion, 2 = 2nd inversion, 3 = 3rd (for 7th chords)
  score: 85,
  reasons: ['Strong tonic function', 'Smooth voice leading'],
  voiceLeadingScore: 92  // NEW: Separate score for voice leading quality
}
```

### 2. Voice Leading Analysis

Create a function to evaluate voice leading quality for each inversion option:

```javascript
/**
 * Calculate optimal inversion based on voice leading from previous chord
 * @param {Object} prevChord - Previous chord {root, type, inversion}
 * @param {Object} currentChord - Current chord {root, type}
 * @param {Array} melodyNotes - Melody notes in current measure
 * @returns {Object} Best inversion with score
 */
function calculateOptimalInversion(prevChord, currentChord, melodyNotes) {
  const inversions = getAvailableInversions(currentChord.type);
  let bestInversion = 0;
  let bestScore = 0;

  for (const inv of inversions) {
    const score = evaluateInversion(prevChord, currentChord, inv, melodyNotes);
    if (score > bestScore) {
      bestScore = score;
      bestInversion = inv;
    }
  }

  return { inversion: bestInversion, voiceLeadingScore: bestScore };
}
```

### 3. Inversion Evaluation Criteria

Score each inversion based on:

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Bass motion | 30% | Prefer stepwise bass movement over large leaps |
| Common tones | 25% | Reward inversions that maintain common tones with previous chord |
| Melody alignment | 20% | Bonus if bass doesn't clash with melody |
| Voice crossing avoidance | 15% | Penalize if inversion causes voice crossing |
| Cadential patterns | 10% | Recognize standard cadential bass patterns (e.g., V6/4 → V → I) |

### 4. Implementation Steps

#### Step 1: Add Inversion Utilities

In `autoHarmonize.js`, add:

```javascript
/**
 * Get available inversions for a chord type
 */
function getAvailableInversions(chordType) {
  const is7thChord = chordType.includes('7') || chordType.includes('9') ||
                     chordType.includes('11') || chordType.includes('13');
  return is7thChord ? [0, 1, 2, 3] : [0, 1, 2];
}

/**
 * Get bass note for a chord in a specific inversion
 */
function getBassNote(root, type, inversion) {
  const chordNotes = getChordNotes(root, type);
  if (inversion >= chordNotes.length) return chordNotes[0];
  return chordNotes[inversion];
}

/**
 * Calculate interval between two notes (in semitones)
 */
function getBassInterval(note1, note2) {
  const midi1 = noteToMidi(note1);
  const midi2 = noteToMidi(note2);
  return Math.abs(midi2 - midi1) % 12;
}
```

#### Step 2: Implement Voice Leading Scorer

```javascript
/**
 * Score voice leading quality for a specific inversion
 */
function scoreVoiceLeading(prevChord, currentRoot, currentType, inversion, melodyNotes) {
  let score = 50; // Base score

  // Get bass notes
  const prevBass = prevChord ? getBassNote(prevChord.root, prevChord.type, prevChord.inversion || 0) : null;
  const currentBass = getBassNote(currentRoot, currentType, inversion);

  if (prevBass) {
    const interval = getBassInterval(prevBass, currentBass);

    // Reward stepwise motion (1-2 semitones)
    if (interval <= 2) score += 30;
    // Small leaps okay (3-4 semitones)
    else if (interval <= 4) score += 20;
    // Medium leaps (5-7 semitones)
    else if (interval <= 7) score += 10;
    // Large leaps penalized
    else score -= 10;

    // Reward common tones
    const prevNotes = getChordNotes(prevChord.root, prevChord.type);
    const currentNotes = getChordNotes(currentRoot, currentType);
    const commonTones = prevNotes.filter(n => currentNotes.includes(n)).length;
    score += commonTones * 8;
  }

  // Check melody alignment - penalize if bass = melody note (unless intentional doubling)
  if (melodyNotes && melodyNotes.length > 0) {
    const melodyPitches = melodyNotes.map(n => n.pitch.replace(/\d+/, ''));
    if (melodyPitches.includes(currentBass)) {
      score -= 5; // Slight penalty for doubling melody in bass
    }
  }

  // Bonus for root position on strong beats / cadences
  if (inversion === 0) {
    score += 5; // Slight preference for root position stability
  }

  return Math.max(0, Math.min(100, score));
}
```

#### Step 3: Integrate into Main Algorithm

Modify the main `autoHarmonize` function:

```javascript
// In the suggestion generation loop, after scoring chord quality:
suggestions.forEach(suggestion => {
  const { inversion, voiceLeadingScore } = calculateOptimalInversion(
    prevChord,
    { root: suggestion.root, type: suggestion.type },
    measureNotes
  );

  suggestion.inversion = inversion;
  suggestion.voiceLeadingScore = voiceLeadingScore;

  // Incorporate voice leading into overall score
  suggestion.score = Math.round(
    suggestion.score * 0.7 + voiceLeadingScore * 0.3
  );
});
```

#### Step 4: Generate Multiple Inversion Options

Optionally, return multiple inversion options per chord:

```javascript
function expandWithInversions(suggestion, prevChord, melodyNotes) {
  const inversions = getAvailableInversions(suggestion.type);

  return inversions.map(inv => {
    const vlScore = scoreVoiceLeading(prevChord, suggestion.root, suggestion.type, inv, melodyNotes);
    return {
      ...suggestion,
      inversion: inv,
      voiceLeadingScore: vlScore,
      score: Math.round(suggestion.score * 0.7 + vlScore * 0.3)
    };
  }).sort((a, b) => b.score - a.score);
}
```

### 5. Files to Modify

| File | Changes |
|------|---------|
| `src/modules/ai/autoHarmonize.js` | Add inversion calculation logic |
| `src/modules/ui/recommendations/UnifiedRecommendationModal.js` | Already displays inversions (no changes needed) |
| `src/modules/ui/autoHarmonizeModal.js` | Update to show inversion badges |

### 6. Testing Considerations

1. **Voice Leading Quality**
   - Test with simple I-IV-V-I progressions
   - Verify bass moves smoothly between chords
   - Check that 6/4 chords appear in appropriate cadential contexts

2. **Edge Cases**
   - First chord (no previous chord for comparison)
   - Repeated chords (should maintain same inversion or move smoothly)
   - Large intervallic leaps in melody

3. **Style Awareness**
   - Classical style: Stricter voice leading rules
   - Pop/Rock: More flexibility, root position often preferred
   - Jazz: More complex inversions acceptable

### 7. Future Enhancements

- **Voice-specific tracking**: Track SATB voice positions, not just bass
- **Cadence detection**: Automatically use appropriate inversions for cadences (e.g., I6/4 → V7 → I)
- **Style-specific rules**: Different inversion preferences per harmony style
- **User preference**: Allow users to set inversion complexity preference

## References

- `src/modules/features/comprehensiveChordRecommendations.js` - Has existing voice leading scoring that could be reused
- `src/modules/recommendations/harmony/SmartHarmonizer.js` - Alternative harmonization approach with voicing generation
- `INVERSION_NAMES` in `src/data/music-data.js` - Inversion display names
