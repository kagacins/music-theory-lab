# Recommendation Engine Improvement Opportunities

## Overview

This document captures improvement opportunities for our suite of recommendation engines. These improvements focus on enhancing the existing infrastructure rather than creating new engines.

**Related Documents:**
- [0_MEASURE_EDITOR_RECOMMENDATIONS_PLAN.md](0_MEASURE_EDITOR_RECOMMENDATIONS_PLAN.md) - Measure Editor integration (COMPLETE)
- [1_NOTATION_SYSTEM_RECOMMENDATIONS.md](1_NOTATION_SYSTEM_RECOMMENDATIONS.md) - Notation system features

---

## Implementation Status (Updated 2026-01-04)

| Item | Status | Notes |
|------|--------|-------|
| **1.1 Extract Scoring Functions** | DEFERRED | Existing implementation in `comprehensiveChordRecommendations.js` works well; extraction would be high risk |
| **1.2 Configuration-Based Scoring Weights** | ALREADY EXISTS | `weightPresets.js` has 17+ presets (5 approach + 11 genre templates) |
| **1.3 Caching Layer** | ALREADY EXISTS | 500-entry cache with 30s TTL implemented |
| **2.1 Voice Leading Presets** | COMPLETE | Added 5 presets: strict, standard, contemporary, jazz, cinematic |
| **2.2 Context-Aware Voice Leading** | COMPLETE | Added position modifiers (first, middle, end, climax, transition) that adjust penalties |
| **3.x Section Generator** | ALREADY EXISTS | `SectionGenerator.js` has templates for pop/rock/jazz across section types; `sectionProfiles.js` has 10 section profiles |
| **4.1 Multi-Dimensional Tension** | COMPLETE | 4 dimensions: harmonic, rhythmic, melodic, dynamic |
| **4.2 Tension Shape Templates** | ALREADY EXISTS | `TENSION_ARC_TEMPLATES` has 8 templates (pop, epic, jazz, ballad, rock, edm, classical, ambient) |
| **5.1 Contextual Preference Learning** | COMPLETE | Records by context (style, mood); now wired to ChordTab.js selection flow |
| **5.2 Preference Decay** | ALREADY EXISTS | `decayFactor` (0.95) with `_applySessionDecay()` per session |
| **5.3 Preference Export/Import** | ALREADY EXISTS | `exportPreferences()` and `importPreferences()` methods |
| **6.1 Unified Scoring Pipeline** | REMOVED | `CoordinatedRecommendationService.js` removed (was unused wrapper); recommendations flow directly through `generateComprehensiveRecommendations()` |
| **6.2 Lazy Loading** | PARTIAL | Some dynamic imports exist, but not for heavy engines |
| **7.1 Web Worker** | PENDING | No Web Workers currently used for recommendations |
| **7.2 Incremental Updates** | PARTIAL | Caching with 1s TTL exists; incremental recalculation not implemented |

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

#### 2.1 Create Voice Leading Presets ✅ COMPLETE

**Status:** Implemented in `enhancedVoiceLeading.js` (2026-01-04)

Different musical styles have different voice leading priorities. The following presets were added:

```javascript
// In src/modules/features/enhancedVoiceLeading.js

export const VOICE_LEADING_PRESETS = {
    strict: {
        name: 'Strict (Classical)',
        parallelFifthsPenalty: 15,
        parallelOctavesPenalty: 12,
        voiceCrossingPenalty: 10,
        unresolvedTendencyPenalty: 10,
        leapWithoutRecoveryPenalty: 8,
        tendencyToneResolution: 'required'
    },
    standard: {
        name: 'Standard',
        parallelFifthsPenalty: 10,
        parallelOctavesPenalty: 8,
        voiceCrossingPenalty: 8,
        unresolvedTendencyPenalty: 6,
        leapWithoutRecoveryPenalty: 5,
        tendencyToneResolution: 'preferred'
    },
    contemporary: {
        name: 'Contemporary',
        parallelFifthsPenalty: 3,
        parallelOctavesPenalty: 5,
        voiceCrossingPenalty: 4,
        unresolvedTendencyPenalty: 2,
        leapWithoutRecoveryPenalty: 2,
        tendencyToneResolution: 'optional'
    },
    jazz: {
        name: 'Jazz',
        parallelFifthsPenalty: 0,
        parallelOctavesPenalty: 2,
        voiceCrossingPenalty: 3,
        unresolvedTendencyPenalty: 0,
        leapWithoutRecoveryPenalty: 0,
        tendencyToneResolution: 'optional'
    },
    cinematic: {
        name: 'Cinematic/Epic',
        parallelFifthsPenalty: 0,
        parallelOctavesPenalty: 0,
        voiceCrossingPenalty: 5,
        unresolvedTendencyPenalty: 3,
        leapWithoutRecoveryPenalty: 0,
        tendencyToneResolution: 'preferred'
    }
};

// Helper functions
export function getVoiceLeadingPreset(presetName) { ... }
export function getPresetForStyle(style) { ... }
```

**Integration:** The `scoreEnhancedVoiceLeading()` function now accepts a `style` option and automatically selects the appropriate preset. Style-to-preset mapping:
- Classical/Baroque → strict
- Jazz/Bossa Nova/Latin Jazz → jazz
- Pop/Rock/Indie/Electronic/R&B/Blues → contemporary
- Gospel/Country/Folk → standard
- Cinematic/Film/Epic → cinematic

#### 2.2 Add Context-Aware Voice Leading ✅ COMPLETE

**Status:** Implemented in `enhancedVoiceLeading.js` (2026-01-04)

Position modifiers dynamically adjust voice leading penalties based on section position:

```javascript
// In src/modules/features/enhancedVoiceLeading.js

export const POSITION_MODIFIERS = {
    first: {
        parallelMotionMultiplier: 0.5,   // More freedom at beginning
        voiceCrossingMultiplier: 0.6,
        tendencyToneMultiplier: 0.4,
        leapRecoveryMultiplier: 0.3
    },
    middle: {
        parallelMotionMultiplier: 1.0,   // Standard penalties
        voiceCrossingMultiplier: 1.0,
        tendencyToneMultiplier: 1.0,
        leapRecoveryMultiplier: 1.0
    },
    end: {
        parallelMotionMultiplier: 1.3,   // Stricter at cadences
        voiceCrossingMultiplier: 1.2,
        tendencyToneMultiplier: 1.5,
        leapRecoveryMultiplier: 1.2
    },
    climax: {
        parallelMotionMultiplier: 0.4,   // Allow dramatic leaps
        voiceCrossingMultiplier: 0.8,
        tendencyToneMultiplier: 0.2,
        leapRecoveryMultiplier: 0.3
    },
    transition: {
        parallelMotionMultiplier: 0.7,   // Balanced for transitions
        voiceCrossingMultiplier: 0.9,
        tendencyToneMultiplier: 0.8,
        leapRecoveryMultiplier: 0.6
    }
};

// Helper functions
export function getPositionModifiers(position) { ... }
export function applyPositionModifiers(preset, position) { ... }
```

**Integration:** The `scoreEnhancedVoiceLeading()` function now accepts a `sectionPosition` option that is passed from `comprehensiveChordRecommendations.js` using the existing `sectionContext.position` value.

---

## Part 3: Section Generator Upgrades ✅ ALREADY EXISTS

### Implementation Status

This functionality already exists in the codebase:

**File: `src/modules/recommendations/coordination/SectionGenerator.js` (~1400 lines)**

#### 3.1 Genre-Specific Templates ✅ EXISTS

`PROGRESSION_TEMPLATES` contains templates for pop, rock, and jazz across section types:

```javascript
// Already implemented in SectionGenerator.js
const PROGRESSION_TEMPLATES = {
    intro: {
        pop: [{ degrees: [1, 4, 1, 4], description: 'Simple tonic-subdominant oscillation' }, ...],
        rock: [{ degrees: [1, 5, 1, 5], description: 'Power chord foundation' }, ...],
        jazz: [{ degrees: [2, 5, 1, 1], description: 'ii-V-I establishment' }, ...]
    },
    verse: { pop: [...], rock: [...], jazz: [...] },
    prechorus: { pop: [...], rock: [...] },
    chorus: { pop: [...], rock: [...], jazz: [...] },
    bridge: { pop: [...], rock: [...], jazz: [...] },
    outro: { pop: [...], rock: [...] }
};
```

#### 3.2 Intelligent Section Transitions ✅ EXISTS

**Smooth transitions:** `SMOOTH_TRANSITIONS` maps ending degrees to preferred starting degrees:
```javascript
const SMOOTH_TRANSITIONS = {
    1: [4, 5, 6, 2],  // I -> IV, V, vi, ii
    5: [1, 6, 4],      // V -> I, vi, IV
    // etc.
};
```

**Section suggestion:** `suggestNextSection()` provides intelligent recommendations based on current structure.

**Duration arcs:** `DURATION_ARC_PROFILES` manages rhythmic flow through sections.

**File: `src/modules/features/sectionProfiles.js` (~500 lines)**

Contains 10 detailed section profiles (intro, verse, prechorus, chorus, bridge, interlude, solo, breakdown, outro, custom) with:
- Tension ranges
- Chord preferences by section
- Position adjustments (first/middle/end)
- Transition rules between sections

---

## Part 4: Tension Arc System V2

### Implementation Status

**File: `src/modules/analysis/TensionArcPlanner.js` (~845 lines)**

The TensionArcPlanner is already a comprehensive implementation with multi-factor tension analysis.

#### 4.2 Tension Shape Templates ✅ ALREADY EXISTS

`TENSION_ARC_TEMPLATES` provides 8 pre-defined tension curves:

```javascript
// Already implemented in TensionArcPlanner.js
export const TENSION_ARC_TEMPLATES = {
    pop: { name: 'Pop Standard', curve: [...], sectionHints: {...} },
    epic: { name: 'Epic/Cinematic', curve: [...] },
    jazz: { name: 'Jazz Standard', curve: [...] },
    ballad: { name: 'Ballad', curve: [...] },
    rock: { name: 'Rock', curve: [...] },
    edm: { name: 'EDM/Electronic', curve: [...] },
    classical: { name: 'Classical', curve: [...] },
    ambient: { name: 'Ambient/Minimal', curve: [...] },
    custom: { name: 'Custom', isCustom: true }
};
```

**Existing Tension Factors:**
- Chord type base tension (40% weight)
- Harmonic function tension (25% weight)
- Chromaticism/borrowed chord tension (15% weight)
- Inversion tension (10% weight)
- Position in progression tension (10% weight)

**File: `src/modules/analysis/TensionOptimizer.js`**

Provides optimization algorithms for matching tension curves:
- Find optimal inversions to match target tension
- Suggest extensions (7ths, 9ths) to adjust tension
- Chord substitution suggestions (dom7, dim, chromatic)

#### 4.1 Multi-Dimensional Tension ✅ COMPLETE

**Status:** Implemented in `MultiDimensionalTension.js` (2026-01-04)

A new `MultiDimensionalTensionAnalyzer` class tracks 4 tension dimensions:

**Dimensions:**
- **Harmonic tension:** Chord dissonance, function, chromaticism (from existing TensionArcPlanner)
- **Rhythmic tension:** Note density, syncopation level, rest ratio
- **Melodic tension:** Leap sizes, range coverage, contour complexity
- **Dynamic tension:** Volume levels, articulation intensity, dynamic change rate

**Dimension Weights (5 presets):**
```javascript
DIMENSION_WEIGHTS = {
    balanced: { harmonic: 0.40, rhythmic: 0.25, melodic: 0.20, dynamic: 0.15 },
    harmonic_focused: { harmonic: 0.60, rhythmic: 0.15, melodic: 0.15, dynamic: 0.10 },
    rhythmic_focused: { harmonic: 0.25, rhythmic: 0.45, melodic: 0.15, dynamic: 0.15 },
    melodic_focused: { harmonic: 0.25, rhythmic: 0.15, melodic: 0.45, dynamic: 0.15 },
    dynamic_focused: { harmonic: 0.30, rhythmic: 0.15, melodic: 0.15, dynamic: 0.40 }
};
```

**Style-to-Weight Mapping:**
- Classical, Baroque, Ballad, Gospel → `harmonic_focused`
- EDM, Electronic, Funk, Hip Hop, Latin, Reggae → `rhythmic_focused`
- R&B, Soul → `melodic_focused`
- Cinematic, Epic, Film, Orchestral → `dynamic_focused`
- Pop, Rock, Jazz, Indie, Country, Folk, Blues → `balanced`

**Integration with TensionArcPlanner:**
```javascript
const planner = getTensionArcPlanner();

// Enable multi-dimensional mode
planner.setMultiDimensionalMode(true, 'Pop');  // Auto-selects 'balanced' weights

// Calculate multi-dimensional tension for a chord
const result = planner.calculateMultiDimensionalTension(chord, key, {
    measureData: { notes: [...] },  // For rhythmic analysis
    melodyNotes: [...],             // For melodic analysis
    dynamicData: { volume: 0.7, articulation: 'marcato' }  // For dynamic analysis
});

// Returns:
// {
//   total: 0.52,  // Combined tension
//   harmonic: { total: 0.45, breakdown: {...} },
//   dimensions: {
//     harmonic: { value: 0.45, weight: 0.40, weighted: 0.18 },
//     rhythmic: { value: 0.55, weight: 0.25, weighted: 0.14, description: 'Active rhythm' },
//     melodic: { value: 0.40, weight: 0.20, weighted: 0.08, description: 'Balanced movement' },
//     dynamic: { value: 0.60, weight: 0.15, weighted: 0.09, description: 'Strong dynamics' }
//   },
//   isMultiDimensional: true
// }

// Calculate full curve with per-dimension tracking
const curve = planner.calculateMultiDimensionalCurve(progression, key, compositionState);

// Get per-dimension adjustment suggestions
const suggestions = planner.getMultiDimensionalSuggestions(
    { harmonic: 0.5, rhythmic: 0.7, melodic: 0.3, dynamic: 0.4 },
    { harmonic: 0.6, rhythmic: 0.5, melodic: 0.5, dynamic: 0.6 }
);
```

**Files:**
- `src/modules/analysis/MultiDimensionalTension.js` - New module (661 lines)
- `src/modules/analysis/TensionArcPlanner.js` - Updated with integration methods

---

## Part 5: User Preference Learning Enhancements

### Implementation Status

**File: `src/modules/recommendations/coordination/UserPreferenceLearner.js` (~661 lines)**

The UserPreferenceLearner is already a comprehensive implementation with decay and persistence.

#### 5.2 Preference Decay ✅ ALREADY EXISTS

```javascript
// Already implemented in UserPreferenceLearner.js
const DEFAULT_CONFIG = {
    decayFactor: 0.95,           // 5% decay per session
    maxHistorySize: 500,
    minSelectionsForSignificance: 3,
    recencyWeight: 0.7
};

_applySessionDecay() {
    // Applies decay if significant time (> 1 hour) has passed
    const decayAmount = Math.pow(this._config.decayFactor, Math.floor(hoursSinceLastSession / 24));
    this._decayObject(this._chordPreferences.chordTypes, decayAmount);
    // ... decays all preference categories
}
```

#### 5.3 Preference Export/Import ✅ ALREADY EXISTS

```javascript
// Already implemented
exportPreferences() {
    return {
        chordPreferences: this._chordPreferences,
        melodyPreferences: this._melodyPreferences,
        progressionPreferences: this._progressionPreferences,
        styleProfile: this._styleProfile,
        exportedAt: new Date().toISOString()
    };
}

importPreferences(data) {
    if (data.chordPreferences) this._chordPreferences = data.chordPreferences;
    // ... imports all categories
    this._saveToStorage();
}
```

**Existing Preference Categories:**
- Chord preferences: types, root notes, inversions, functions, voice leading
- Melody preferences: contours, intervals, note categories, range
- Progression preferences: patterns, lengths, cadences
- Style profile: dominant style, style counts, mood counts, complexity

#### 5.1 Contextual Preference Learning (PARTIAL)

Currently records preferences by context (style, mood, function), but could be enhanced:
- [ ] Preferences by section type (verse vs chorus)
- [ ] Preferences by time of composition (beginning vs end)
- [ ] Preferences by key/mode

**Priority:** P3 | **Effort:** Medium | **Status:** Partial implementation exists

---

## Part 6: Cross-Engine Optimization

### Implementation Status

#### 6.1 Unified Scoring Pipeline ❌ REMOVED (2026-01-04)

**`CoordinatedRecommendationService.js` was removed** because:
- It was never actually used in the recommendation flow
- All recommendations went directly to `generateComprehensiveRecommendations()` in `comprehensiveChordRecommendations.js`
- It was essentially a wrapper that just called the comprehensive engine anyway
- Having two parallel systems created confusion and maintenance burden

**Current architecture:**
- `RecommendationService` (integration layer) → `generateComprehensiveRecommendations()` (actual engine)
- User preferences wired directly to `ChordTab.js` via `UserPreferenceLearner.recordChordChoice()`
- All Phase 1-4 improvements (voice leading, tension, sections) connected to `comprehensiveChordRecommendations.js`

#### 6.2 Lazy Loading for Heavy Engines (PARTIAL)

Some dynamic imports exist in the codebase but not specifically for heavy recommendation engines.
Could be enhanced to lazily load:
- TensionArcPlanner
- HarmonyAnalyzer
- SectionGenerator

**Priority:** P2 | **Effort:** High | **Status:** Mostly implemented

---

## Part 7: Real-Time Performance Optimizations

### Implementation Status

#### 7.1 Web Worker for Heavy Calculations (PENDING)

No Web Workers are currently used for recommendation calculations. This remains a future enhancement opportunity for moving expensive operations off the main thread.

**Potential benefits:**
- Prevent UI jank during complex recommendation generation
- Allow background calculation while user continues working
- Parallel processing for multiple recommendation types

#### 7.2 Incremental Updates (PARTIAL)

**Existing caching:**
- `comprehensiveChordRecommendations.js` has 500-entry cache with 30s TTL
- Caches clear on context changes

**Not yet implemented:**
- Incremental recalculation when single chord changes
- Only updating affected chord positions (current vs. full recalculation)

**Priority:** P3 | **Effort:** High | **Status:** Future enhancement

---

## Implementation Priority Summary (Updated 2026-01-04)

### Completed / Already Exists

| Task | Status | Notes |
|------|--------|-------|
| Configuration-based weights | ✅ EXISTS | `weightPresets.js` (17+ presets) |
| Caching layer | ✅ EXISTS | 500-entry cache, 30s TTL |
| Voice leading presets | ✅ COMPLETE | 5 presets (strict, standard, contemporary, jazz, cinematic) |
| Context-aware voice leading | ✅ COMPLETE | Position modifiers (first, middle, end, climax, transition) |
| Multi-dimensional tension | ✅ COMPLETE | 4 dimensions (harmonic, rhythmic, melodic, dynamic) |
| Genre-specific templates | ✅ EXISTS | `SectionGenerator.js` (pop, rock, jazz templates) |
| Section profiles | ✅ EXISTS | `sectionProfiles.js` (10 section types) |
| Tension shape templates | ✅ EXISTS | 8 templates in `TensionArcPlanner.js` |
| Preference decay | ✅ EXISTS | Session-based decay with `decayFactor` |
| Preference export/import | ✅ EXISTS | `exportPreferences()` / `importPreferences()` |
| User choice recording | ✅ COMPLETE | Wired `UserPreferenceLearner.recordChordChoice()` to `ChordTab.js` |

### Removed

| Task | Status | Notes |
|------|--------|-------|
| Unified scoring pipeline | ❌ REMOVED | `CoordinatedRecommendationService.js` deleted - was unused wrapper |

### Remaining Work (Future Enhancements)

| Task | Priority | Effort | Notes |
|------|----------|--------|-------|
| Extract scoring functions | DEFERRED | Medium | Current implementation works well; high risk |
| Contextual preference learning | P3 | Medium | Add section type / key-specific preferences |
| Web Worker optimization | P3 | High | Move heavy calculations off main thread |
| Incremental updates | P3 | High | Only recalculate affected chord positions |
| Heavy engine lazy loading | P2 | Medium | Dynamic import for TensionArcPlanner, etc. |

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
*Status: Mostly Complete - Reviewed and updated*
*Version: 2.0*
