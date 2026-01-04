# Recommendation Engine Improvement Opportunities

## Overview

This document captures improvement opportunities for our suite of recommendation engines. These improvements focus on enhancing the existing infrastructure rather than creating new engines.

**Related Documents:**
- [0_MEASURE_EDITOR_RECOMMENDATIONS_PLAN.md](0_MEASURE_EDITOR_RECOMMENDATIONS_PLAN.md) - Measure Editor integration (COMPLETE)
- [1_NOTATION_SYSTEM_RECOMMENDATIONS.md](1_NOTATION_SYSTEM_RECOMMENDATIONS.md) - Notation system features

---

## Current Recommendation Engine Inventory

| Engine | File | Lines | Primary Purpose |
|--------|------|-------|-----------------|
| RecommendationService | `src/modules/integration/recommendationService.js` | ~800 | Central coordination hub |
| ComprehensiveChordRecommendations | `src/modules/features/comprehensiveChordRecommendations.js` | ~2,500 | 3D scoring system |
| EnhancedVoiceLeading | `src/modules/features/enhancedVoiceLeading.js` | ~1,200 | Voice leading analysis |
| BassAutoFill | `src/modules/integration/bassAutoFill.js` | ~4,400 | Bass pattern generation |
| ChordToneAnalyzer | `src/modules/analysis/chordToneAnalyzer.js` | ~400 | Note relationship analysis |
| HarmonyAnalyzer | `src/modules/analysis/harmonyAnalyzer.js` | ~600 | Progression pattern detection |
| TensionArcPlanner | `src/modules/analysis/TensionArcPlanner.js` | ~500 | Tension trajectory planning |
| UserPreferenceLearner | `src/modules/integration/userPreferenceLearner.js` | ~300 | User style learning |
| SectionGenerator | `src/modules/integration/sectionGenerator.js` | ~400 | Section generation |

---

## Part 1: Comprehensive Chord Recommendations Refactoring

### Current Issues

The `comprehensiveChordRecommendations.js` file (~2,500 lines) has grown organically and could benefit from modularization.

### Proposed Improvements

#### 1.1 Extract Scoring Functions into Separate Module

**New File:** `src/modules/features/chordScoringFunctions.js`

Extract the following scoring functions:
- `scoreVoiceLeading()` - Voice leading quality
- `scoreFunctionProgression()` - Harmonic function compatibility
- `scoreRhythmicFit()` - Duration/rhythm appropriateness
- `scoreTensionArc()` - Tension trajectory fit
- `scoreStyleMatch()` - Style/genre compatibility

**Benefits:**
- Easier testing of individual scoring components
- Reusable across different recommendation contexts
- Clearer separation of concerns

#### 1.2 Create Configuration-Based Scoring Weights

Instead of hardcoded weights, use configurable profiles:

```javascript
const SCORING_PROFILES = {
    classical: {
        voiceLeading: 0.4,
        function: 0.3,
        tension: 0.2,
        style: 0.1
    },
    jazz: {
        voiceLeading: 0.2,
        function: 0.2,
        tension: 0.3,
        style: 0.3
    },
    pop: {
        voiceLeading: 0.3,
        function: 0.35,
        tension: 0.15,
        style: 0.2
    }
};
```

**Priority:** P2 | **Effort:** Medium

---

#### 1.3 Add Caching Layer for Repeated Calculations

Many calculations are repeated when generating recommendations for adjacent chords.

**Proposed Solution:**
```javascript
class RecommendationCache {
    constructor(maxSize = 100) {
        this.cache = new Map();
        this.maxSize = maxSize;
    }

    getCacheKey(chord, context) {
        return `${chord.root}:${chord.type}:${context.key}:${context.position}`;
    }

    get(chord, context) {
        return this.cache.get(this.getCacheKey(chord, context));
    }

    set(chord, context, recommendations) {
        if (this.cache.size >= this.maxSize) {
            // LRU eviction
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(this.getCacheKey(chord, context), recommendations);
    }
}
```

**Priority:** P3 | **Effort:** Low

---

## Part 2: Enhanced Voice Leading Integration

### Current State

`enhancedVoiceLeading.js` provides excellent functions but they're not always used consistently across the codebase.

### Proposed Improvements

#### 2.1 Create Voice Leading Presets

Different musical styles have different voice leading priorities:

```javascript
const VOICE_LEADING_PRESETS = {
    strict: {
        allowParallelFifths: false,
        allowParallelOctaves: false,
        maxLeap: 5,           // Perfect fourth
        requireStepwiseMotion: true,
        tendencyToneResolution: 'required'
    },
    standard: {
        allowParallelFifths: false,
        allowParallelOctaves: false,
        maxLeap: 7,           // Perfect fifth
        requireStepwiseMotion: false,
        tendencyToneResolution: 'preferred'
    },
    contemporary: {
        allowParallelFifths: true,
        allowParallelOctaves: false,
        maxLeap: 12,          // Octave
        requireStepwiseMotion: false,
        tendencyToneResolution: 'optional'
    }
};
```

#### 2.2 Add Context-Aware Voice Leading

Consider the overall phrase structure when scoring voice leading:

- **Beginning of phrase:** Allow more freedom for establishing character
- **Middle of phrase:** Prioritize smooth motion
- **Cadence points:** Enforce traditional resolution patterns
- **Climax points:** Allow dramatic leaps for expressive effect

**Priority:** P2 | **Effort:** Medium

---

## Part 3: Section Generator Upgrades

### Current State

The `SectionGenerator` creates chord sequences but could be enhanced with more sophisticated patterns.

### Proposed Improvements

#### 3.1 Add Genre-Specific Templates

```javascript
const SECTION_TEMPLATES = {
    pop: {
        verse: ['I', 'V', 'vi', 'IV'],
        chorus: ['I', 'IV', 'V', 'I'],
        bridge: ['vi', 'IV', 'I', 'V']
    },
    jazz: {
        A: ['Imaj7', 'vi7', 'ii7', 'V7'],
        B: ['IVmaj7', 'iv7', 'iii7', 'VI7'],
        turnaround: ['I', 'VI7', 'ii7', 'V7']
    },
    classical: {
        exposition: ['I', 'V', 'I', 'IV', 'V', 'I'],
        development: ['vi', 'ii', 'V/V', 'V'],
        recapitulation: ['I', 'IV', 'V', 'I']
    }
};
```

#### 3.2 Intelligent Section Transitions

Add logic for smooth transitions between sections:
- Pre-chorus preparation
- Bridge exit strategies
- Outro wind-down patterns

**Priority:** P3 | **Effort:** Medium

---

## Part 4: Tension Arc System V2

### Current State

`TensionArcPlanner` provides basic tension trajectories.

### Proposed Improvements

#### 4.1 Multi-Dimensional Tension

Track multiple tension dimensions:
- **Harmonic tension:** Dissonance level, distance from tonic
- **Rhythmic tension:** Syncopation, activity level
- **Melodic tension:** Range extremes, leap frequency
- **Dynamic tension:** Volume, articulation intensity

```javascript
class MultiDimensionalTension {
    constructor() {
        this.harmonic = 0;
        this.rhythmic = 0;
        this.melodic = 0;
        this.dynamic = 0;
    }

    getOverallTension() {
        return (this.harmonic * 0.4 +
                this.rhythmic * 0.2 +
                this.melodic * 0.25 +
                this.dynamic * 0.15);
    }
}
```

#### 4.2 Tension Shape Templates

Pre-defined tension curves for common musical forms:

```javascript
const TENSION_SHAPES = {
    buildAndRelease: [0.2, 0.4, 0.6, 0.8, 0.9, 0.5, 0.3],
    plateauWithClimb: [0.3, 0.3, 0.3, 0.5, 0.7, 0.9, 0.4],
    wavePattern: [0.3, 0.6, 0.4, 0.7, 0.5, 0.8, 0.3],
    gradualBuild: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
};
```

**Priority:** P3 | **Effort:** High

---

## Part 5: User Preference Learning Enhancements

### Current State

`UserPreferenceLearner` tracks basic preferences.

### Proposed Improvements

#### 5.1 Contextual Preference Learning

Learn preferences based on context:
- Preferences by section type (verse vs chorus)
- Preferences by time of composition (beginning vs end)
- Preferences by key/mode

#### 5.2 Preference Decay

Older preferences should have less weight:

```javascript
function getWeightedPreference(choices, decayFactor = 0.95) {
    let weightedSum = 0;
    let totalWeight = 0;

    choices.forEach((choice, index) => {
        const weight = Math.pow(decayFactor, choices.length - 1 - index);
        weightedSum += choice.score * weight;
        totalWeight += weight;
    });

    return weightedSum / totalWeight;
}
```

#### 5.3 Preference Export/Import

Allow users to save and share preference profiles:

```javascript
exportPreferences() {
    return JSON.stringify({
        version: '1.0',
        chordTypeFrequencies: this.chordTypeFrequencies,
        functionPreferences: this.functionPreferences,
        voiceLeadingTolerance: this.voiceLeadingTolerance
    });
}

importPreferences(json) {
    const data = JSON.parse(json);
    // Validate and apply...
}
```

**Priority:** P3 | **Effort:** Medium

---

## Part 6: Cross-Engine Optimization

### 6.1 Unified Scoring Pipeline

Create a single pipeline that orchestrates all engines:

```javascript
class UnifiedScoringPipeline {
    constructor() {
        this.stages = [
            { name: 'filter', engines: [filterInvalidChords] },
            { name: 'score', engines: [
                scoreVoiceLeading,
                scoreFunction,
                scoreTension,
                scoreStyle
            ]},
            { name: 'rank', engines: [combineScores, applyPreferences] },
            { name: 'present', engines: [formatForUI, addExplanations] }
        ];
    }

    async execute(context, options) {
        let results = { ...context };

        for (const stage of this.stages) {
            for (const engine of stage.engines) {
                results = await engine(results, options);
            }
        }

        return results;
    }
}
```

### 6.2 Lazy Loading for Heavy Engines

Only load complex engines when needed:

```javascript
let harmonyAnalyzer = null;

export async function getHarmonyAnalyzer() {
    if (!harmonyAnalyzer) {
        const module = await import('../analysis/harmonyAnalyzer.js');
        harmonyAnalyzer = new module.HarmonyAnalyzer();
    }
    return harmonyAnalyzer;
}
```

**Priority:** P2 | **Effort:** High

---

## Part 7: Real-Time Performance Optimizations

### 7.1 Web Worker for Heavy Calculations

Move expensive operations to a Web Worker:

```javascript
// recommendationWorker.js
self.onmessage = function(e) {
    const { chord, context, options } = e.data;
    const recommendations = generateRecommendations(chord, context, options);
    self.postMessage({ recommendations });
};
```

### 7.2 Incremental Updates

When progression changes, only recalculate affected recommendations:

```javascript
function getAffectedIndices(changeIndex, progressionLength) {
    // Changes affect: previous chord, changed chord, next chord
    return [
        changeIndex - 1,
        changeIndex,
        changeIndex + 1
    ].filter(i => i >= 0 && i < progressionLength);
}
```

**Priority:** P3 | **Effort:** High

---

## Implementation Priority Summary

### Phase 1 (High Priority)

| Task | Effort | Impact | Status |
|------|--------|--------|--------|
| Extract scoring functions | Medium | High | ❌ Not started |
| Configuration-based weights | Medium | Medium | ❌ Not started |
| Voice leading presets | Medium | High | ❌ Not started |

### Phase 2 (Medium Priority)

| Task | Effort | Impact | Status |
|------|--------|--------|--------|
| Caching layer | Low | Medium | ❌ Not started |
| Context-aware voice leading | Medium | High | ❌ Not started |
| Genre-specific templates | Medium | Medium | ❌ Not started |

### Phase 3 (Lower Priority)

| Task | Effort | Impact | Status |
|------|--------|--------|--------|
| Multi-dimensional tension | High | Medium | ❌ Not started |
| Preference learning enhancements | Medium | Medium | ❌ Not started |
| Web Worker optimization | High | Medium | ❌ Not started |
| Unified scoring pipeline | High | High | ❌ Not started |

---

## Success Metrics

### Performance Goals
- Recommendation generation: < 50ms for single chord
- Full progression analysis: < 200ms for 16 chords
- No UI jank during recommendation display

### Quality Goals
- User acceptance rate of top recommendation: > 40%
- Voice leading issues in accepted recommendations: < 5%
- Style match score in accepted recommendations: > 0.7

### User Experience Goals
- Clear explanations for each recommendation
- Consistent behavior across all tabs
- Responsive updates as context changes

---

*Document created: January 4, 2026*
*Last updated: January 4, 2026*
*Status: Planning - Not Started*
*Version: 1.0*
