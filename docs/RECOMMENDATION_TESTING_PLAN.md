# Recommendation Engine Enhancement Testing Plan

## Overview

This document provides a comprehensive testing plan for the recommendation engine enhancements (A-H) implemented in the Music Theory Lab. The tests are designed to verify correct functionality, measure improvement over baseline, and ensure no regressions.

**Date:** December 2024
**Enhancements Covered:** A, B, C, D, E, F, G, H

---

## Test Environment Setup

### Prerequisites
1. Node.js v18+ installed
2. Music Theory Lab development environment configured
3. Test melody data files available
4. Access to browser console for interactive testing

### Test Data
Create test fixtures in `src/tests/fixtures/` containing:
- Sample melodies (various keys, time signatures, styles)
- Known chord progressions with expected scores
- Section definition samples
- Tension arc test cases

---

## Enhancement A: Root Fatigue Tracking

### Unit Tests

#### Test A1: Root Occurrence Counting
```javascript
// File: src/tests/chordSequences.test.js

import { analyzeRootFatigue, calculateRootFatigueScore } from '../modules/features/chordSequences.js';

describe('Root Fatigue Tracking', () => {
    test('should detect roots appearing multiple times in history', () => {
        const history = [
            { root: 'C', type: 'Major' },
            { root: 'G', type: 'Major' },
            { root: 'C', type: 'Minor' },
            { root: 'F', type: 'Major' }
        ];
        const sequence = [{ root: 'C', type: 'Major' }];

        const analysis = analyzeRootFatigue(history, sequence, 'pop');

        expect(analysis.rootOccurrences.get('C').count).toBe(3);
        expect(analysis.penalties.get('C')).toBeGreaterThan(0);
    });

    test('should apply escalating penalties for frequent roots', () => {
        const history = [
            { root: 'C', type: 'Major' },
            { root: 'C', type: 'Minor' },
            { root: 'C', type: 'Major 7th' }
        ];
        const sequence = [{ root: 'C', type: 'Dominant 7th' }];

        const analysis = analyzeRootFatigue(history, sequence, 'pop');

        // 4 occurrences should have highest penalty
        expect(analysis.penalties.get('C')).toBeGreaterThan(40);
    });

    test('should apply style-specific sensitivity', () => {
        const history = [{ root: 'C', type: 'Major' }, { root: 'C', type: 'Minor' }];
        const sequence = [{ root: 'C', type: 'Major 7th' }];

        const jazzAnalysis = analyzeRootFatigue(history, sequence, 'jazz');
        const popAnalysis = analyzeRootFatigue(history, sequence, 'pop');

        // Jazz should be more tolerant (lower penalty)
        expect(jazzAnalysis.totalPenalty).toBeLessThan(popAnalysis.totalPenalty);
    });
});
```

#### Test A2: Fatigue Score Integration
```javascript
test('calculateRootFatigueScore returns 0-100', () => {
    const sequence = [
        { root: 'C', type: 'Major' },
        { root: 'G', type: 'Major' },
        { root: 'Am', type: 'Minor' },
        { root: 'F', type: 'Major' }
    ];
    const history = [];

    const score = calculateRootFatigueScore(sequence, history, 'pop');

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
});

test('unique roots should score higher than repeated roots', () => {
    const uniqueSequence = [
        { root: 'C', type: 'Major' },
        { root: 'G', type: 'Major' },
        { root: 'Am', type: 'Minor' },
        { root: 'F', type: 'Major' }
    ];
    const repeatedSequence = [
        { root: 'C', type: 'Major' },
        { root: 'C', type: 'Minor' },
        { root: 'C', type: 'Major 7th' },
        { root: 'C', type: 'Dominant 7th' }
    ];

    const uniqueScore = calculateRootFatigueScore(uniqueSequence, [], 'pop');
    const repeatedScore = calculateRootFatigueScore(repeatedSequence, [], 'pop');

    expect(uniqueScore).toBeGreaterThan(repeatedScore);
});
```

### Integration Tests

#### Test A3: Sequence Generation Diversity
```javascript
test('generateChordSequences should produce diverse roots', () => {
    const sequences = generateChordSequences(
        'C', 'Major', 0,
        [{ root: 'C', type: 'Major' }],
        'C Major', 'pop', 'bright', 'resolve',
        4, 4, 5, null, false
    );

    // Check that not all sequences start with the same root
    const startingRoots = sequences.map(seq => seq.chords[0].root);
    const uniqueStartingRoots = new Set(startingRoots);

    expect(uniqueStartingRoots.size).toBeGreaterThan(1);
});
```

### Manual Testing Checklist

- [ ] Generate 4-chord sequences with "Build" in various sections
- [ ] Verify sequences don't have 3+ chords with the same root
- [ ] Compare results between jazz and pop styles
- [ ] Check that the Root Fatigue score appears in breakdown

---

## Enhancement B: Melody Awareness in Chord Sequences

### Unit Tests

#### Test B1: Melody Alignment Scoring
```javascript
import { calculateMelodyAlignmentScore } from '../modules/features/chordSequences.js';

describe('Melody Alignment', () => {
    test('should score high when melody notes are chord tones', () => {
        const sequence = [{ root: 'C', type: 'Major' }]; // C, E, G
        const melody = [
            { measure: 0, pitch: 'C4', beat: 0 },
            { measure: 0, pitch: 'E4', beat: 1 },
            { measure: 0, pitch: 'G4', beat: 2 }
        ];

        const result = calculateMelodyAlignmentScore(sequence, melody, 0, 'C Major');

        expect(result.score).toBeGreaterThan(80);
        expect(result.averageMatchPercentage).toBeGreaterThan(80);
    });

    test('should score lower when melody notes clash with chord', () => {
        const sequence = [{ root: 'C', type: 'Major' }]; // C, E, G
        const melody = [
            { measure: 0, pitch: 'C#4', beat: 0 }, // Not in C major
            { measure: 0, pitch: 'F#4', beat: 1 }, // Not in C major
            { measure: 0, pitch: 'B4', beat: 2 }   // Not a chord tone
        ];

        const result = calculateMelodyAlignmentScore(sequence, melody, 0, 'C Major');

        expect(result.score).toBeLessThan(60);
    });

    test('should weight strong beats more heavily', () => {
        // Chord tone on strong beat should score better than on weak beat
        const sequence = [{ root: 'C', type: 'Major' }];

        const strongBeatMelody = [
            { measure: 0, pitch: 'C4', beat: 0 }, // Strong beat, chord tone
            { measure: 0, pitch: 'F4', beat: 1 }  // Weak beat, non-chord
        ];
        const weakBeatMelody = [
            { measure: 0, pitch: 'F4', beat: 0 }, // Strong beat, non-chord
            { measure: 0, pitch: 'C4', beat: 1 }  // Weak beat, chord tone
        ];

        const strongResult = calculateMelodyAlignmentScore(sequence, strongBeatMelody, 0, 'C Major');
        const weakResult = calculateMelodyAlignmentScore(sequence, weakBeatMelody, 0, 'C Major');

        expect(strongResult.score).toBeGreaterThan(weakResult.score);
    });
});
```

#### Test B2: No Melody Handling
```javascript
test('should return neutral score when no melody', () => {
    const sequence = [{ root: 'C', type: 'Major' }];

    const result = calculateMelodyAlignmentScore(sequence, [], 0, 'C Major');

    expect(result.score).toBe(75);
    expect(result.hasMelody).toBe(false);
});
```

### Integration Tests

#### Test B3: Melody-Aware Sequence Generation
```javascript
test('sequences should align better with melody when melody provided', () => {
    const melody = [
        { measure: 0, pitch: 'E4', beat: 0 },
        { measure: 1, pitch: 'D4', beat: 0 },
        { measure: 2, pitch: 'C4', beat: 0 },
        { measure: 3, pitch: 'B3', beat: 0 }
    ];

    const withMelody = generateChordSequences(
        'C', 'Major', 0, [], 'C Major', 'pop', 'bright', 'resolve',
        4, 4, 5, null, false,
        { melodyData: melody, startMeasure: 0 }
    );

    const withoutMelody = generateChordSequences(
        'C', 'Major', 0, [], 'C Major', 'pop', 'bright', 'resolve',
        4, 4, 5, null, false,
        null
    );

    // With melody should have melody alignment info
    expect(withMelody[0].melodyAlignment).toBeDefined();
    expect(withoutMelody[0].melodyAlignment).toBeNull();
});
```

### Manual Testing Checklist

- [ ] Create a melody in a section
- [ ] Use "Build" to generate chord sequences
- [ ] Verify sequences include Melody Alignment in breakdown
- [ ] Check that high-scoring sequences have chord tones on strong beats
- [ ] Compare results with and without melody

---

## Enhancement C: Extended Look-Back in Auto-Harmonize

### Unit Tests

#### Test C1: Pattern Detection
```javascript
import { analyzeChordHistory } from '../modules/ai/autoHarmonize.js';
// Note: May need to export for testing

describe('Extended Look-Back', () => {
    test('should detect two-chord repetitive pattern', () => {
        const history = [
            { root: 'C', type: 'Major' },
            { root: 'F', type: 'Major' },
            { root: 'C', type: 'Major' }
        ];
        const candidate = { root: 'F', type: 'Major' };

        const analysis = analyzeChordHistory(history, candidate, 'C Major');

        expect(analysis.patterns).toContain('two-chord-repeat');
        expect(analysis.scoreAdjustment).toBeLessThan(0);
    });

    test('should detect pendulum motion', () => {
        const history = [
            { root: 'C', type: 'Major' },
            { root: 'G', type: 'Major' }
        ];
        const candidate = { root: 'C', type: 'Major' };

        const analysis = analyzeChordHistory(history, candidate, 'C Major');

        expect(analysis.patterns).toContain('pendulum');
    });

    test('should reward circle of fifths motion', () => {
        const history = [
            { root: 'D', type: 'Minor' },  // ii
            { root: 'G', type: 'Major' }   // V
        ];
        const candidate = { root: 'C', type: 'Major' }; // I

        const analysis = analyzeChordHistory(history, candidate, 'C Major');

        expect(analysis.scoreAdjustment).toBeGreaterThan(0);
    });
});
```

### Integration Tests

#### Test C2: Auto-Harmonize Pattern Avoidance
```javascript
test('auto-harmonize should avoid repetitive patterns', () => {
    const melody = generateTestMelody(8); // 8 measures

    const results = autoHarmonize(melody, 'C Major', {
        numSuggestions: 3,
        harmonyStyle: 'pop'
    });

    // Extract top suggestions
    const topChords = results.map(r => r.suggestions[0]);

    // Check for no I-IV-I-IV-I-IV pattern
    let repetitivePatternCount = 0;
    for (let i = 0; i < topChords.length - 3; i++) {
        if (topChords[i].root === topChords[i + 2].root &&
            topChords[i + 1].root === topChords[i + 3].root &&
            topChords[i].root !== topChords[i + 1].root) {
            repetitivePatternCount++;
        }
    }

    expect(repetitivePatternCount).toBeLessThan(2);
});
```

### Manual Testing Checklist

- [ ] Run auto-harmonize on 8+ measure melody
- [ ] Verify no I-IV-I-IV mechanical repetition
- [ ] Check that suggestions show history-based adjustments
- [ ] Compare with bidirectional=false to see difference

---

## Enhancement D: Look-Ahead in Auto-Harmonize

### Unit Tests

#### Test D1: Look-Ahead Analysis
```javascript
describe('Look-Ahead', () => {
    test('should reward chords that prepare upcoming melody', () => {
        const notesByMeasure = {
            0: [{ pitch: 'G4', beat: 0 }],
            1: [{ pitch: 'C4', beat: 0 }]  // Resolution to tonic
        };

        // G7 should prepare the C resolution
        const g7 = { root: 'G', type: 'Dominant 7th' };
        const cMaj = { root: 'C', type: 'Major' };

        const g7Analysis = analyzeLookAhead(g7, notesByMeasure, 0, 'C Major');
        const cMajAnalysis = analyzeLookAhead(cMaj, notesByMeasure, 0, 'C Major');

        // G7 should score higher because it prepares the C resolution
        expect(g7Analysis.scoreAdjustment).toBeGreaterThan(cMajAnalysis.scoreAdjustment);
    });

    test('should consider common tones with upcoming melody', () => {
        const notesByMeasure = {
            0: [{ pitch: 'E4', beat: 0 }],
            1: [{ pitch: 'E4', beat: 0 }]  // Same note continues
        };

        // C Major contains E, should score well
        const cMaj = { root: 'C', type: 'Major' };
        const analysis = analyzeLookAhead(cMaj, notesByMeasure, 0, 'C Major');

        expect(analysis.reasons).toContain('Prepares upcoming melody');
    });
});
```

### Integration Tests

#### Test D2: Harmonization with Look-Ahead
```javascript
test('look-ahead should influence chord choices', () => {
    // Melody that resolves to tonic
    const melody = [
        { measure: 0, pitch: 'B4', beat: 0 }, // Leading tone
        { measure: 1, pitch: 'C5', beat: 0 }  // Tonic
    ];

    const results = autoHarmonize(melody, 'C Major', {
        numSuggestions: 3
    });

    // First measure should prefer dominant function
    const firstMeasureRoots = results[0].suggestions.map(s => s.root);
    expect(firstMeasureRoots).toContain('G');
});
```

### Manual Testing Checklist

- [ ] Create melody with clear resolution pattern
- [ ] Run auto-harmonize
- [ ] Verify chords prepare for resolutions
- [ ] Check that suggestions include "Prepares upcoming melody" reason

---

## Enhancement E: Deeper Section Context Integration

### Unit Tests

#### Test E1: Section Context Scoring
```javascript
import { calculateSectionContextScore } from '../modules/features/chordSequences.js';

describe('Section Context', () => {
    test('chorus should prefer strong tonic opening', () => {
        const sequence = [
            { root: 'C', type: 'Major' },
            { root: 'G', type: 'Major' }
        ];
        const sectionInfo = {
            sectionType: 'chorus',
            positionInSection: 0,
            totalInSection: 8
        };

        const result = calculateSectionContextScore(sequence, sectionInfo, 'C Major');

        expect(result.score).toBeGreaterThan(60);
        expect(result.reasons).toContain('Strong chorus opening');
    });

    test('prechorus should avoid tonic resolution', () => {
        const resolvingSequence = [
            { root: 'G', type: 'Major' },
            { root: 'C', type: 'Major', inversion: 0 }
        ];
        const buildingSequence = [
            { root: 'F', type: 'Major' },
            { root: 'G', type: 'Dominant 7th' }
        ];

        const sectionInfo = {
            sectionType: 'prechorus',
            positionInSection: 2,
            totalInSection: 4
        };

        const resolvingScore = calculateSectionContextScore(resolvingSequence, sectionInfo, 'C Major');
        const buildingScore = calculateSectionContextScore(buildingSequence, sectionInfo, 'C Major');

        expect(buildingScore.score).toBeGreaterThan(resolvingScore.score);
    });

    test('outro should prefer final resolution', () => {
        const sequence = [
            { root: 'G', type: 'Major' },
            { root: 'C', type: 'Major' }
        ];
        const sectionInfo = {
            sectionType: 'outro',
            positionInSection: 6,
            totalInSection: 8
        };

        const result = calculateSectionContextScore(sequence, sectionInfo, 'C Major');

        expect(result.reasons).toContain('Resolves properly');
    });
});
```

### Integration Tests

#### Test E2: Section-Aware Sequence Generation
```javascript
test('sequences should differ by section type', () => {
    const verseSequences = generateChordSequences(
        'C', 'Major', 0, [], 'C Major', 'pop', 'bright', 'resolve',
        4, 4, 5,
        { sectionType: 'verse', positionInSection: 0, totalInSection: 8 },
        true
    );

    const chorusSequences = generateChordSequences(
        'C', 'Major', 0, [], 'C Major', 'pop', 'bright', 'resolve',
        4, 4, 5,
        { sectionType: 'chorus', positionInSection: 0, totalInSection: 8 },
        true
    );

    // Should have different recommendations
    const verseFirst = verseSequences[0].chords.map(c => c.root).join('-');
    const chorusFirst = chorusSequences[0].chords.map(c => c.root).join('-');

    // May be same but breakdown should differ
    expect(verseSequences[0].breakdown.find(b => b.name === 'Section Context')).toBeDefined();
    expect(chorusSequences[0].breakdown.find(b => b.name === 'Section Context')).toBeDefined();
});
```

### Manual Testing Checklist

- [ ] Define sections (verse, chorus, bridge)
- [ ] Generate sequences in each section
- [ ] Verify Section Context appears in breakdown
- [ ] Check that chorus recommendations are more "impactful"
- [ ] Check that prechorus builds without resolving

---

## Enhancement F: Cross-Engine Melody Verification

### Unit Tests

#### Test F1: Melody Compatibility Verification
```javascript
import { verifyMelodyCompatibility, batchVerifyMelodyCompatibility } from '../modules/features/chordSequences.js';

describe('Melody Verification', () => {
    test('should return compatible for chord tones', () => {
        const chord = { root: 'C', type: 'Major' };
        const melody = [
            { measure: 0, pitch: 'C4', beat: 0 },
            { measure: 0, pitch: 'E4', beat: 1 },
            { measure: 0, pitch: 'G4', beat: 2 }
        ];

        const result = verifyMelodyCompatibility(chord, melody, 0, 'C Major');

        expect(result.compatible).toBe(true);
        expect(result.rating).toBe('excellent');
    });

    test('should identify poor compatibility', () => {
        const chord = { root: 'C', type: 'Major' };
        const melody = [
            { measure: 0, pitch: 'C#4', beat: 0 },
            { measure: 0, pitch: 'F#4', beat: 2 }
        ];

        const result = verifyMelodyCompatibility(chord, melody, 0, 'C Major');

        expect(result.compatible).toBe(false);
        expect(result.problemChords.length).toBeGreaterThan(0);
    });

    test('should suggest alternatives for poor matches', () => {
        const chord = { root: 'C', type: 'Major' };
        const melody = [
            { measure: 0, pitch: 'F#4', beat: 0 }, // F# prominent
            { measure: 0, pitch: 'A4', beat: 1 }
        ];

        const result = verifyMelodyCompatibility(chord, melody, 0, 'C Major');

        if (result.suggestions.length > 0) {
            expect(result.suggestions[0].suggestions).toBeDefined();
        }
    });
});
```

#### Test F2: Batch Verification
```javascript
test('batchVerifyMelodyCompatibility sorts by score', () => {
    const sequences = [
        { chords: [{ root: 'C', type: 'Major' }] },
        { chords: [{ root: 'F#', type: 'Diminished' }] }
    ];
    const melody = [{ measure: 0, pitch: 'C4', beat: 0 }];

    const results = batchVerifyMelodyCompatibility(sequences, melody, 0, 'C Major');

    // C Major should score higher and be first
    expect(results[0].chords[0].root).toBe('C');
    expect(results[0].melodyScore).toBeGreaterThan(results[1].melodyScore);
});
```

### Manual Testing Checklist

- [ ] Create melody and generate chord sequences
- [ ] Call verifyMelodyCompatibility on results
- [ ] Verify compatibility ratings make sense
- [ ] Check that problem chords are identified
- [ ] Review suggested alternatives

---

## Enhancement G: Bidirectional Harmonization

### Unit Tests

#### Test G1: Backward Pass Optimization
```javascript
import { bidirectionalHarmonize } from '../modules/ai/autoHarmonize.js';

describe('Bidirectional Harmonization', () => {
    test('should improve total score after optimization', () => {
        const forwardResults = [
            { measureIndex: 0, suggestions: [{ root: 'C', type: 'Major', score: 70 }] },
            { measureIndex: 1, suggestions: [{ root: 'G', type: 'Major', score: 70 }] },
            { measureIndex: 2, suggestions: [{ root: 'C', type: 'Major', score: 70 }] }
        ];

        const optimized = bidirectionalHarmonize(forwardResults, {}, 'C Major');

        // Results should be marked as optimized
        expect(optimized[0].bidirectionalOptimized).toBe(true);
    });

    test('should prefer V-I resolution patterns', () => {
        // When last chord is I, should prefer V before it
        const forwardResults = [
            { measureIndex: 0, suggestions: [
                { root: 'C', type: 'Major', score: 70 },
                { root: 'G', type: 'Dominant 7th', score: 65 }
            ]},
            { measureIndex: 1, suggestions: [{ root: 'C', type: 'Major', score: 80 }] }
        ];

        const optimized = bidirectionalHarmonize(forwardResults, {}, 'C Major');

        // G7 should now be preferred (V-I resolution)
        expect(optimized[0].suggestions[0].root).toBe('G');
    });
});
```

### Integration Tests

#### Test G2: Auto-Harmonize with Bidirectional
```javascript
test('bidirectional harmonization improves progression quality', () => {
    const melody = generateTestMelody(8);

    const withBidirectional = autoHarmonize(melody, 'C Major', {
        bidirectional: true
    });

    const withoutBidirectional = autoHarmonize(melody, 'C Major', {
        bidirectional: false
    });

    // With bidirectional should have the flag
    expect(withBidirectional[0].bidirectionalOptimized).toBe(true);
    expect(withoutBidirectional[0].bidirectionalOptimized).toBeUndefined();
});
```

### Manual Testing Checklist

- [ ] Run auto-harmonize with bidirectional=true (default)
- [ ] Compare with bidirectional=false
- [ ] Verify V-I resolutions are preferred
- [ ] Check that tension builds and releases appropriately

---

## Enhancement H: Tension Arc Planning

### Unit Tests

#### Test H1: Tension Arc Shapes
```javascript
import { TENSION_ARC_SHAPES, calculateTensionArcMatch, calculateChordTensionLevel } from '../modules/features/chordSequences.js';

describe('Tension Arc Planning', () => {
    test('ascending arc should increase over length', () => {
        const arc = TENSION_ARC_SHAPES.ascending(4, 0.2, 0.8);

        expect(arc[0]).toBeCloseTo(0.2);
        expect(arc[3]).toBeCloseTo(0.8);
        expect(arc[1]).toBeGreaterThan(arc[0]);
        expect(arc[2]).toBeGreaterThan(arc[1]);
    });

    test('arch shape should peak in middle', () => {
        const arc = TENSION_ARC_SHAPES.arch(5, 0.2, 0.9);

        expect(arc[2]).toBeCloseTo(0.9); // Middle peak
        expect(arc[0]).toBeCloseTo(0.2);
        expect(arc[4]).toBeCloseTo(0.2);
    });

    test('chord tension levels should be reasonable', () => {
        expect(calculateChordTensionLevel({ root: 'C', type: 'Major' }, 'C Major'))
            .toBeLessThan(0.3);
        expect(calculateChordTensionLevel({ root: 'G', type: 'Dominant 7th' }, 'C Major'))
            .toBeGreaterThan(0.6);
        expect(calculateChordTensionLevel({ root: 'B', type: 'Diminished' }, 'C Major'))
            .toBeGreaterThan(0.8);
    });
});
```

#### Test H2: Arc Matching
```javascript
test('should score high for matching tension arc', () => {
    const sequence = [
        { root: 'C', type: 'Major' },      // Low tension
        { root: 'F', type: 'Major' },      // Medium-low
        { root: 'G', type: 'Dominant 7th' }, // High
        { root: 'C', type: 'Major' }       // Resolve to low
    ];
    const targetArc = [0.2, 0.4, 0.7, 0.2]; // Matches the pattern

    const result = calculateTensionArcMatch(sequence, targetArc, 'C Major');

    expect(result.matchQuality).toBe('good'); // or 'excellent'
    expect(result.score).toBeGreaterThan(60);
});

test('should score low for mismatched tension arc', () => {
    const sequence = [
        { root: 'G', type: 'Dominant 7th' }, // High tension
        { root: 'G', type: 'Dominant 7th' },
        { root: 'G', type: 'Dominant 7th' },
        { root: 'G', type: 'Dominant 7th' }
    ];
    const targetArc = [0.2, 0.2, 0.2, 0.2]; // Low tension throughout

    const result = calculateTensionArcMatch(sequence, targetArc, 'C Major');

    expect(result.matchQuality).toBe('poor');
    expect(result.avgDeviation).toBeGreaterThan(0.3);
});
```

#### Test H3: Section-Based Tension Arcs
```javascript
import { suggestTensionArcForSection } from '../modules/features/chordSequences.js';

test('should suggest appropriate arcs for sections', () => {
    const introArc = suggestTensionArcForSection('intro', 4);
    const chorusArc = suggestTensionArcForSection('chorus', 8);
    const outroArc = suggestTensionArcForSection('outro', 4);

    // Intro should be low
    expect(introArc[0]).toBeLessThan(0.4);

    // Chorus should have higher peak
    expect(Math.max(...chorusArc)).toBeGreaterThan(0.6);

    // Outro should decrease
    expect(outroArc[outroArc.length - 1]).toBeLessThan(outroArc[0]);
});
```

### Integration Tests

#### Test H4: Tension Arc Sequence Generation
```javascript
import { generateTensionArcSequences } from '../modules/features/chordSequences.js';

test('should generate sequences matching tension arc', () => {
    const targetArc = [0.3, 0.5, 0.7, 0.4]; // Build then release

    const sequences = generateTensionArcSequences(
        'C', 'Major', 0, [], 'C Major', targetArc,
        { topN: 5 }
    );

    expect(sequences.length).toBe(5);
    expect(sequences[0].tensionArcMatch).toBeDefined();
    expect(sequences[0].tensionMatchQuality).toBeDefined();
});
```

### Manual Testing Checklist

- [ ] Use TENSION_ARC_SHAPES to generate various arcs
- [ ] Generate sequences with generateTensionArcSequences
- [ ] Verify sequences follow the tension trajectory
- [ ] Test with different section types
- [ ] Create custom tension arc and verify interpolation

---

## Performance Testing

### Benchmark Tests

```javascript
describe('Performance', () => {
    test('generateChordSequences should complete in < 500ms', () => {
        const start = performance.now();

        for (let i = 0; i < 10; i++) {
            generateChordSequences(
                'C', 'Major', 0, [], 'C Major', 'pop', 'bright', 'resolve',
                4, 4, 5, null, false,
                { melodyData: generateTestMelody(4), startMeasure: 0 }
            );
        }

        const elapsed = performance.now() - start;
        expect(elapsed / 10).toBeLessThan(500);
    });

    test('autoHarmonize with bidirectional should complete in < 1000ms', () => {
        const melody = generateTestMelody(16);
        const start = performance.now();

        autoHarmonize(melody, 'C Major', {
            bidirectional: true,
            numSuggestions: 3
        });

        const elapsed = performance.now() - start;
        expect(elapsed).toBeLessThan(1000);
    });
});
```

---

## Regression Testing

### Critical Path Tests

1. **Basic Chord Recommendations Still Work**
   - Generate single chord recommendations
   - Verify scores are in expected range
   - Check that top recommendation is musically sensible

2. **Auto-Harmonize Core Functionality**
   - Harmonize simple melody
   - Verify all measures have suggestions
   - Check that suggestions are in key

3. **Sequence Generation**
   - Generate 2, 4, and 8 chord sequences
   - Verify correct lengths returned
   - Check that sequences are playable

4. **User Weight Preferences**
   - Save custom weights
   - Generate recommendations
   - Verify weights affect scoring

---

## Success Metrics

### Quantitative Metrics

| Metric | Baseline | Target | How to Measure |
|--------|----------|--------|----------------|
| Unique roots in 4-chord sequence | 2.3 avg | 3.0+ avg | Count unique roots per sequence |
| Melody compatibility score | N/A | 65%+ avg | Average chord tone match |
| Repetitive pattern occurrence | 15% | <5% | Detect I-IV-I-IV patterns |
| Tension arc match deviation | N/A | <0.15 avg | Average deviation from target |

### Qualitative Metrics

- User reports of "better" recommendations
- Fewer "regenerate" clicks needed
- More musically coherent harmonizations
- Section-appropriate chord choices

---

## Test Execution Schedule

### Phase 1: Unit Tests (Day 1-2)
- Run all unit tests for A-H
- Fix any failing tests
- Achieve 90%+ coverage

### Phase 2: Integration Tests (Day 3-4)
- Run integration tests
- Test cross-enhancement interactions
- Verify no regressions

### Phase 3: Manual Testing (Day 5-6)
- Execute all manual testing checklists
- Document any issues found
- Verify UI displays new breakdown items

### Phase 4: Performance Testing (Day 7)
- Run benchmarks
- Compare to baseline
- Optimize if needed

---

## Appendix: Test Utilities

### Generate Test Melody
```javascript
function generateTestMelody(measures, key = 'C Major') {
    const notes = [];
    const scale = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4'];

    for (let m = 0; m < measures; m++) {
        for (let b = 0; b < 4; b++) {
            notes.push({
                measure: m,
                measureIndex: m,
                beat: b,
                pitch: scale[Math.floor(Math.random() * scale.length)],
                duration: 'q'
            });
        }
    }

    return notes;
}
```

### Test Fixture Locations
- `src/tests/fixtures/melodies/` - Sample melodies
- `src/tests/fixtures/progressions/` - Known progressions
- `src/tests/fixtures/sections/` - Section definitions
