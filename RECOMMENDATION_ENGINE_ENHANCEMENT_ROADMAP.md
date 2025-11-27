# Recommendation Engine Enhancement Roadmap

## Vision: Building the Most Powerful Music Theory & Songwriting Tool

This document outlines a comprehensive strategy to transform Music Theory Lab's recommendation engines into an industry-leading intelligent composition assistant. By leveraging your existing architecture—particularly the section-based composition model (verse, chorus, bridge)—we can create deeply contextual, musically intelligent suggestions that no competitor currently offers.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Competitive Differentiation Strategy](#3-competitive-differentiation-strategy)
4. [Chord Progression Recommendation Enhancements](#4-chord-progression-recommendation-enhancements)
5. [Next Chord Recommendation Enhancements](#5-next-chord-recommendation-enhancements)
6. [Melody Recommendation Enhancements](#6-melody-recommendation-enhancements)
7. [Harmony Recommendation Enhancements](#7-harmony-recommendation-enhancements)
8. [Cross-Engine Integration](#8-cross-engine-integration)
9. [Implementation Priorities](#9-implementation-priorities)
10. [Technical Architecture](#10-technical-architecture)
11. [Success Metrics](#11-success-metrics)

---

## 1. Executive Summary

### Current Strengths
- **Three-tiered chord recommendation system** (basic, unified, comprehensive)
- **Section-aware composition** (verse, chorus, bridge, etc.)
- **Voice leading analysis** with multi-dimensional scoring
- **Style and mood parameters** affecting suggestions
- **59 chord types** and comprehensive music theory data

### Key Enhancement Opportunities

| Area | Current Gap | Enhancement Value |
|------|-------------|-------------------|
| **Section Context** | Sections exist but don't influence recommendations | High - Major differentiator |
| **Song Structure Intelligence** | No understanding of verse→chorus relationships | High - Unique feature |
| **Tension Arc Planning** | Single-chord analysis only | High - Compositional power |
| **Learning from Choices** | No adaptation to user style | Medium - Personalization |
| **Cross-Engine Coordination** | Engines operate independently | High - Holistic composition |
| **Genre-Specific Patterns** | Generic style parameters | Medium - Authenticity |

### Transformation Goal
Move from **reactive suggestions** (what chord comes next?) to **compositional intelligence** (how should this section feel, and how does it connect to the song's emotional arc?).

---

## 2. Current State Analysis

### 2.1 Chord Recommendation Engines

#### chordRecommendations.js (Basic)
```
Approach: Harmonic function analysis (T→S→D cycle)
Strengths: Simple, fast, educational
Limitations: No context beyond last chord
```

#### unifiedChordSuggestions.js (Style/Mood)
```
Approach: Style + mood filtering with inversion scoring
Strengths: 6 moods × 6 styles = 36 combinations
Limitations: No progression history consideration
```

#### comprehensiveChordRecommendations.js (Advanced)
```
Approach: 3D scoring (root × type × inversion)
Strengths: 7 scoring dimensions, pattern detection
Limitations: Context limited to 4 previous chords
```

### 2.2 Melody Recommendation Engine

#### melodySuggestion.js
```
Approach: Note categorization with style multipliers
Strengths: Chord tone awareness, voice leading
Limitations: Single-note suggestions, no phrase generation
```

### 2.3 Harmony/Analysis

#### autoHarmonize.js + harmonyAnalyzer.js
```
Approach: Melody-to-chord matching, pattern detection
Strengths: 21+ pattern recognition, mood analysis
Limitations: Passive analysis, not generative
```

### 2.4 Section System (Untapped Potential)

Your `compositionState.js` has a sophisticated section system:
```javascript
SECTION_TYPES = {
  verse: { label: 'Verse', color: '#10B981' },
  prechorus: { label: 'Pre-Chorus', color: '#F59E0B' },
  chorus: { label: 'Chorus', color: '#EF4444' },
  bridge: { label: 'Bridge', color: '#8B5CF6' },
  outro: { label: 'Outro', color: '...' },
  intro: { label: 'Intro', color: '...' },
  custom: { label: 'Custom', color: '#6B7280' }
}
```

**This is your biggest untapped differentiator.** No competitor meaningfully uses section context for recommendations.

---

## 3. Competitive Differentiation Strategy

### 3.1 What Competitors Offer

| Tool | Chord Suggestions | Section Awareness | Melody Generation |
|------|-------------------|-------------------|-------------------|
| Hooktheory | Pattern database | None | Basic |
| Scaler 2 | Scale-based | None | Phrase-based |
| Captain Chords | Loop-based | None | MIDI patterns |
| ChordChord | Random/rules | None | None |

### 3.2 Your Unique Value Proposition

**"Section-Aware Compositional Intelligence"**

No tool currently:
1. Understands that a **chorus should feel different** from a verse
2. Suggests chords that **create contrast** between sections
3. Plans **tension arcs** across an entire song structure
4. Recommends **melodic motifs** that unify sections
5. Ensures **harmonic continuity** at section boundaries

### 3.3 Differentiation Framework

```
Level 1: Basic (Current Competitors)
├── "Here's what chord usually comes next"

Level 2: Contextual (Your Current State)
├── "Based on your style/mood, here's what fits"

Level 3: Structural (Target State) ← YOUR DIFFERENTIATOR
├── "You're in verse 2 - here's how to build toward your chorus"
├── "Your chorus uses these patterns - your verse should contrast with..."
├── "This bridge needs to release tension before returning to chorus"

Level 4: Compositional (Future State)
├── "Here's a complete verse that would complement your existing chorus"
├── "Based on your compositional style, you prefer these patterns..."
```

---

## 4. Chord Progression Recommendation Enhancements

### 4.1 Section-Aware Progression Generation

#### Concept
Generate complete chord progressions for sections based on:
- The **section type** (verse, chorus, bridge)
- **Existing sections** in the composition
- **Relationship rules** between section types

#### Section Characteristic Profiles

```javascript
const SECTION_PROFILES = {
  verse: {
    tensionRange: [0.2, 0.5],      // Lower tension
    preferredLength: [4, 8],       // Measures
    harmonicComplexity: 'moderate',
    typicalPatterns: ['I-IV-I-V', 'I-vi-IV-V', 'I-V-vi-IV'],
    avoidPatterns: ['V-I'],        // Save strong resolution for chorus
    contrastWith: ['chorus'],      // Should differ from chorus
    melodicDensity: 'moderate',
    emotionalRole: 'setup'
  },

  prechorus: {
    tensionRange: [0.5, 0.8],      // Building tension
    preferredLength: [2, 4],
    harmonicComplexity: 'building',
    typicalPatterns: ['ii-V', 'IV-V', 'vi-IV-V'],
    mustEndWith: ['V', 'viio', 'IV'], // Dominant preparation
    emotionalRole: 'anticipation'
  },

  chorus: {
    tensionRange: [0.6, 0.9],      // Higher energy
    preferredLength: [4, 8],
    harmonicComplexity: 'simple',   // Memorable, singable
    typicalPatterns: ['I-V-vi-IV', 'I-IV-V-I', 'vi-IV-I-V'],
    shouldStartWith: ['I', 'vi'],   // Strong arrival
    emotionalRole: 'payoff'
  },

  bridge: {
    tensionRange: [0.4, 0.7],      // Different, not necessarily higher
    preferredLength: [4, 8],
    harmonicComplexity: 'high',     // New harmonic territory
    typicalPatterns: ['vi-ii-V-I', 'IV-iv-I', 'bVI-bVII-I'],
    mustDifferFrom: ['verse', 'chorus'],
    allowModalInterchange: true,
    emotionalRole: 'departure'
  },

  outro: {
    tensionRange: [0.1, 0.4],      // Resolving
    preferredLength: [4, 8],
    harmonicComplexity: 'simple',
    typicalPatterns: ['IV-I', 'I-IV-I', 'vi-IV-I'],
    mustEndWith: ['I'],             // Final resolution
    emotionalRole: 'closure'
  }
};
```

#### Implementation: Section Progression Generator

```javascript
class SectionProgressionGenerator {
  generateForSection(sectionType, existingSections, key, options = {}) {
    const profile = SECTION_PROFILES[sectionType];
    const constraints = this.buildConstraints(profile, existingSections, options);

    return {
      primary: this.generateProgression(constraints, profile, 'optimal'),
      alternatives: [
        this.generateProgression(constraints, profile, 'creative'),
        this.generateProgression(constraints, profile, 'classic'),
        this.generateProgression(constraints, profile, 'unexpected')
      ],
      reasoning: this.explainChoices(constraints, existingSections)
    };
  }

  buildConstraints(profile, existingSections, options) {
    const constraints = {
      tensionTarget: profile.tensionRange,
      length: options.length || profile.preferredLength[0],
      mustAvoid: [],
      shouldDifferFrom: [],
      connectionRequirements: {}
    };

    // Analyze existing sections for contrast
    existingSections.forEach(section => {
      if (profile.contrastWith?.includes(section.type)) {
        constraints.shouldDifferFrom.push({
          sectionId: section.id,
          chords: section.chords,
          contrastLevel: 'high'
        });
      }

      if (profile.mustDifferFrom?.includes(section.type)) {
        constraints.shouldDifferFrom.push({
          sectionId: section.id,
          chords: section.chords,
          contrastLevel: 'mandatory'
        });
      }
    });

    return constraints;
  }

  calculateContrast(progression1, progression2) {
    // Measures: root movement patterns, chord types used,
    // harmonic rhythm, tension profile
    const factors = {
      rootDiversity: this.compareRootPatterns(progression1, progression2),
      chordTypeDiversity: this.compareChordTypes(progression1, progression2),
      tensionProfileDifference: this.compareTensionCurves(progression1, progression2),
      patternNovelty: this.checkPatternOverlap(progression1, progression2)
    };

    return Object.values(factors).reduce((sum, val) => sum + val, 0) / 4;
  }
}
```

### 4.2 Tension Arc Planning

#### Concept
Plan chord progressions that create intentional emotional journeys across sections.

#### Tension Scoring System

```javascript
const TENSION_VALUES = {
  // Chord functions relative to key
  'I': 0.1,      // Most stable (tonic)
  'vi': 0.3,     // Relative minor - mild tension
  'IV': 0.35,    // Subdominant - slight pull
  'ii': 0.45,    // Supertonic - moderate
  'iii': 0.5,    // Mediant - ambiguous
  'V': 0.7,      // Dominant - strong pull
  'V7': 0.8,     // Dominant 7th - stronger
  'viio': 0.85,  // Leading tone - very tense
  'bVII': 0.6,   // Modal mixture
  'bVI': 0.55,   // Modal mixture
  'iv': 0.5,     // Borrowed from minor
  '#IVo': 0.9,   // Very unstable
};

// Modifiers
const TENSION_MODIFIERS = {
  inversion: {
    0: 0,        // Root position
    1: +0.05,    // First inversion - slightly less stable
    2: +0.1,     // Second inversion - more unstable
  },
  extensions: {
    '7th': +0.1,
    '9th': +0.15,
    '11th': +0.2,
    '13th': +0.25,
    'sus': +0.05,
  },
  position: {
    'on_beat_1': -0.05,  // Stronger = more resolved
    'on_weak_beat': +0.05,
  }
};
```

#### Tension Arc Templates

```javascript
const TENSION_ARC_TEMPLATES = {
  'standard_pop': {
    verse: [0.3, 0.4, 0.35, 0.5],      // Gentle rise
    prechorus: [0.5, 0.6, 0.7, 0.75],  // Building
    chorus: [0.2, 0.6, 0.5, 0.3],      // Arrive, maintain, resolve
    bridge: [0.4, 0.5, 0.6, 0.7],      // Different journey
    outro: [0.3, 0.25, 0.2, 0.1]       // Wind down
  },

  'emotional_ballad': {
    verse: [0.2, 0.3, 0.4, 0.5],
    prechorus: [0.5, 0.65, 0.8, 0.85],
    chorus: [0.3, 0.5, 0.6, 0.2],      // Big release
    bridge: [0.7, 0.75, 0.8, 0.6],     // Climax
    outro: [0.4, 0.3, 0.2, 0.1]
  },

  'rock_anthem': {
    verse: [0.4, 0.5, 0.45, 0.6],
    prechorus: [0.6, 0.7, 0.75, 0.8],
    chorus: [0.5, 0.7, 0.6, 0.5],      // Sustained energy
    bridge: [0.3, 0.4, 0.6, 0.8],      // Drop then build
    outro: [0.6, 0.5, 0.4, 0.3]
  },

  'edm_build': {
    verse: [0.3, 0.35, 0.4, 0.45],
    buildup: [0.5, 0.6, 0.7, 0.85, 0.9, 0.95],  // Extended build
    drop: [0.2, 0.6, 0.5, 0.4],        // Release then groove
    breakdown: [0.2, 0.25, 0.3, 0.35],
    outro: [0.3, 0.25, 0.2, 0.15]
  }
};

class TensionArcPlanner {
  planArc(sections, targetTemplate = 'standard_pop') {
    const template = TENSION_ARC_TEMPLATES[targetTemplate];
    const plan = [];

    sections.forEach(section => {
      const targetCurve = template[section.type] || template.verse;
      const currentCurve = this.analyzeTensionCurve(section.chords);

      plan.push({
        sectionId: section.id,
        sectionType: section.type,
        currentCurve,
        targetCurve,
        alignment: this.calculateCurveAlignment(currentCurve, targetCurve),
        suggestions: this.generateAdjustments(section, targetCurve)
      });
    });

    return {
      overallArc: this.visualizeArc(plan),
      sectionPlans: plan,
      transitionAnalysis: this.analyzeTransitions(plan)
    };
  }

  generateAdjustments(section, targetCurve) {
    const suggestions = [];
    const currentChords = section.chords;

    targetCurve.forEach((targetTension, index) => {
      if (index < currentChords.length) {
        const currentTension = this.getChordTension(currentChords[index]);
        const diff = targetTension - currentTension;

        if (Math.abs(diff) > 0.15) {
          suggestions.push({
            position: index,
            currentChord: currentChords[index],
            issue: diff > 0 ? 'too_stable' : 'too_tense',
            alternatives: this.findChordsAtTension(targetTension, section.key)
          });
        }
      }
    });

    return suggestions;
  }
}
```

### 4.3 Section Transition Optimization

#### Concept
Ensure smooth or intentionally dramatic transitions between sections.

```javascript
class SectionTransitionAnalyzer {
  analyzeTransition(fromSection, toSection, key) {
    const lastChord = fromSection.chords[fromSection.chords.length - 1];
    const firstChord = toSection.chords[0];

    return {
      harmonicConnection: this.analyzeHarmonicConnection(lastChord, firstChord, key),
      tensionTransition: this.analyzeTensionShift(fromSection, toSection),
      voiceLeading: this.analyzeVoiceLeading(lastChord, firstChord),
      suggestions: this.generateTransitionSuggestions(fromSection, toSection, key)
    };
  }

  generateTransitionSuggestions(fromSection, toSection, key) {
    const fromType = fromSection.type;
    const toType = toSection.type;

    // Section-specific transition rules
    const transitionRules = {
      'verse→prechorus': {
        ideal: 'building',
        lastChordSuggestions: ['IV', 'ii', 'vi'],
        description: 'Should feel like beginning to lift'
      },
      'prechorus→chorus': {
        ideal: 'arrival',
        lastChordSuggestions: ['V', 'V7', 'viio'],
        firstChordSuggestions: ['I', 'vi'],
        description: 'Strong dominant preparation, satisfying arrival'
      },
      'chorus→verse': {
        ideal: 'reset',
        lastChordSuggestions: ['I', 'V'],
        description: 'Clear ending, fresh start'
      },
      'chorus→bridge': {
        ideal: 'departure',
        firstChordSuggestions: ['vi', 'IV', 'bVI', 'ii'],
        description: 'Move to new harmonic territory'
      },
      'bridge→chorus': {
        ideal: 'return',
        lastChordSuggestions: ['V', 'V/V', 'viio'],
        description: 'Build anticipation for triumphant return'
      }
    };

    const ruleKey = `${fromType}→${toType}`;
    return transitionRules[ruleKey] || this.generateGenericTransition(fromSection, toSection);
  }
}
```

### 4.4 Genre-Specific Progression Libraries

#### Enhanced Pattern Database

```javascript
const GENRE_PROGRESSION_LIBRARIES = {
  pop: {
    verse: [
      { pattern: ['I', 'V', 'vi', 'IV'], popularity: 95, songs: ['Let It Be', 'No Woman No Cry'] },
      { pattern: ['I', 'IV', 'vi', 'V'], popularity: 80, songs: ['Someone Like You'] },
      { pattern: ['vi', 'IV', 'I', 'V'], popularity: 75, songs: ['Despacito'] },
      { pattern: ['I', 'vi', 'IV', 'V'], popularity: 70, songs: ['Stand By Me'] }
    ],
    chorus: [
      { pattern: ['I', 'V', 'vi', 'IV'], popularity: 90 },
      { pattern: ['I', 'IV', 'I', 'V'], popularity: 70 },
      { pattern: ['vi', 'IV', 'I', 'V'], popularity: 75 }
    ],
    bridge: [
      { pattern: ['vi', 'ii', 'V', 'I'], popularity: 60 },
      { pattern: ['IV', 'I', 'V', 'vi'], popularity: 55 },
      { pattern: ['ii', 'IV', 'vi', 'V'], popularity: 50 }
    ]
  },

  rock: {
    verse: [
      { pattern: ['I', 'bVII', 'IV', 'I'], popularity: 80, songs: ['Sweet Child O Mine'] },
      { pattern: ['I', 'IV', 'V', 'IV'], popularity: 75 },
      { pattern: ['i', 'bVI', 'bVII', 'i'], popularity: 70, songs: ['Stairway to Heaven'] }
    ],
    chorus: [
      { pattern: ['I', 'V', 'IV', 'I'], popularity: 85 },
      { pattern: ['I', 'bVII', 'IV', 'I'], popularity: 70 }
    ]
  },

  jazz: {
    verse: [
      { pattern: ['Imaj7', 'vi7', 'ii7', 'V7'], popularity: 85 },
      { pattern: ['Imaj7', 'IV7', 'iii7', 'vi7'], popularity: 70 }
    ],
    turnaround: [
      { pattern: ['I', 'vi', 'ii', 'V'], popularity: 95 },
      { pattern: ['I', '#Io7', 'ii', 'V'], popularity: 80 },
      { pattern: ['I', 'bIII7', 'bVI7', 'bII7'], popularity: 70 }
    ],
    bridge: [
      { pattern: ['IVmaj7', 'iv7', 'iii7', 'bIII7'], popularity: 65 },
      { pattern: ['ii7', 'V7', 'Imaj7', 'VI7'], popularity: 75 }
    ]
  },

  rnb: {
    verse: [
      { pattern: ['Imaj7', 'IV', 'vi7', 'V'], popularity: 80 },
      { pattern: ['I', 'iii7', 'vi7', 'IV'], popularity: 75 }
    ],
    chorus: [
      { pattern: ['I', 'V', 'vi', 'IV'], popularity: 85 },
      { pattern: ['Imaj7', 'vi7', 'ii7', 'V7'], popularity: 70 }
    ]
  },

  edm: {
    buildup: [
      { pattern: ['vi', 'IV', 'I', 'V'], popularity: 90 },
      { pattern: ['i', 'bVI', 'bIII', 'bVII'], popularity: 80 }
    ],
    drop: [
      { pattern: ['vi', 'IV', 'I', 'V'], popularity: 85 },
      { pattern: ['i', 'bVI', 'bVII', 'i'], popularity: 75 }
    ]
  },

  country: {
    verse: [
      { pattern: ['I', 'IV', 'V', 'I'], popularity: 90 },
      { pattern: ['I', 'V', 'IV', 'I'], popularity: 85 }
    ],
    chorus: [
      { pattern: ['I', 'IV', 'I', 'V'], popularity: 88 },
      { pattern: ['I', 'V', 'vi', 'IV'], popularity: 80 }
    ]
  },

  gospel: {
    verse: [
      { pattern: ['I', 'IV', 'I', 'V'], popularity: 85 },
      { pattern: ['I', 'vi', 'ii', 'V'], popularity: 80 }
    ],
    chorus: [
      { pattern: ['I', 'IV', 'V', 'I'], popularity: 90 },
      { pattern: ['I', 'V/V', 'V', 'I'], popularity: 75 }
    ]
  }
};
```

---

## 5. Next Chord Recommendation Enhancements

### 5.1 Deep Context Analysis

#### Current Limitation
The `comprehensiveChordRecommendations.js` looks at only 4 previous chords.

#### Enhancement: Full Progression Context

```javascript
class DeepContextAnalyzer {
  analyzeContext(progression, currentPosition, sectionInfo) {
    return {
      // Immediate context (current behavior, enhanced)
      immediate: this.analyzeImmediateContext(progression, currentPosition, 4),

      // Section context (NEW)
      section: this.analyzeSectionContext(progression, currentPosition, sectionInfo),

      // Cross-section context (NEW)
      crossSection: this.analyzeCrossSectionPatterns(progression, sectionInfo),

      // Full progression patterns (NEW)
      global: this.analyzeGlobalPatterns(progression),

      // User's compositional tendencies (NEW)
      compositional: this.analyzeCompositionalStyle(progression)
    };
  }

  analyzeSectionContext(progression, position, sectionInfo) {
    if (!sectionInfo) return null;

    const currentSection = sectionInfo.sections.find(s =>
      s.chordIndices.includes(position)
    );

    if (!currentSection) return null;

    const sectionChords = currentSection.chordIndices
      .filter(i => i < position)
      .map(i => progression[i]);

    return {
      sectionType: currentSection.type,
      positionInSection: currentSection.chordIndices.indexOf(position),
      sectionLength: currentSection.chordIndices.length,
      chordsBeforeInSection: sectionChords,
      isNearSectionEnd: this.isNearSectionEnd(position, currentSection),
      sectionProfile: SECTION_PROFILES[currentSection.type],

      // What patterns have been established in this section?
      establishedPatterns: this.detectPatternsInChords(sectionChords),

      // What harmonic areas have been visited?
      harmonicAreas: this.mapHarmonicAreas(sectionChords),

      // Tension trajectory within section
      tensionTrajectory: this.calculateTensionTrajectory(sectionChords)
    };
  }

  analyzeCrossSectionPatterns(progression, sectionInfo) {
    if (!sectionInfo?.sections?.length) return null;

    const patterns = {
      // Do similar sections use similar progressions?
      sectionTypePatterns: {},

      // How do sections typically transition?
      transitionPatterns: [],

      // What chords appear in multiple sections?
      recurringChords: new Map()
    };

    // Group sections by type and find patterns
    const byType = {};
    sectionInfo.sections.forEach(section => {
      if (!byType[section.type]) byType[section.type] = [];
      byType[section.type].push(
        section.chordIndices.map(i => progression[i])
      );
    });

    // Find commonalities within section types
    Object.entries(byType).forEach(([type, sectionChords]) => {
      if (sectionChords.length > 1) {
        patterns.sectionTypePatterns[type] = this.findCommonPatterns(sectionChords);
      }
    });

    return patterns;
  }

  analyzeCompositionalStyle(progression) {
    // Analyze what the user tends to prefer
    return {
      // Does user prefer complex or simple chords?
      complexityPreference: this.calculateComplexityPreference(progression),

      // Does user prefer diatonic or chromatic choices?
      diatonicRatio: this.calculateDiatonicRatio(progression),

      // Common root movements (by 4th, by step, etc.)
      rootMovementPatterns: this.analyzeRootMovements(progression),

      // Preferred inversions
      inversionPreference: this.analyzeInversionUsage(progression),

      // Chord type frequency
      chordTypeFrequency: this.countChordTypes(progression)
    };
  }
}
```

### 5.2 Position-Aware Recommendations

#### Concept
Recommendations change based on WHERE in the section/song you are.

```javascript
class PositionAwareRecommender {
  getRecommendations(progression, position, sectionInfo, key, options) {
    const context = this.deepContextAnalyzer.analyzeContext(
      progression, position, sectionInfo
    );

    // Different strategies based on position
    let strategy;

    if (context.section) {
      const { positionInSection, sectionLength, sectionType } = context.section;
      const relativePosition = positionInSection / sectionLength;

      if (relativePosition < 0.25) {
        strategy = 'section_opening';
      } else if (relativePosition > 0.75) {
        strategy = 'section_closing';
      } else {
        strategy = 'section_middle';
      }

      // Is this the last section before a different section type?
      if (context.section.isNearSectionEnd && this.hasFollowingSection(sectionInfo, position)) {
        strategy = 'section_transition';
      }
    }

    return this.applyStrategy(strategy, context, key, options);
  }

  applyStrategy(strategy, context, key, options) {
    const strategies = {
      'section_opening': {
        // Establish the section's character
        preferStable: true,
        allowedTensionRange: [0.2, 0.5],
        favorPatternStart: true,
        description: 'Establishing the section character'
      },

      'section_middle': {
        // Develop and explore
        preferVariety: true,
        allowedTensionRange: [0.3, 0.7],
        encourageMovement: true,
        description: 'Developing the section'
      },

      'section_closing': {
        // Prepare for what's next
        prepareTransition: true,
        considerNextSection: true,
        description: 'Preparing for transition'
      },

      'section_transition': {
        // Specific transition logic
        useTransitionRules: true,
        fromSection: context.section.sectionType,
        toSection: this.getNextSectionType(context),
        description: 'Creating smooth transition'
      }
    };

    return this.generateWithStrategy(strategies[strategy], context, key, options);
  }
}
```

### 5.3 Harmonic Rhythm Awareness

#### Concept
Understand and respect the rate of harmonic change.

```javascript
class HarmonicRhythmAnalyzer {
  analyzeHarmonicRhythm(progression, measures) {
    // Calculate chords per measure
    const chordsPerMeasure = progression.length / measures.length;

    // Detect patterns in harmonic rhythm
    const rhythmPattern = this.detectRhythmPattern(progression, measures);

    return {
      averageRate: chordsPerMeasure,
      pattern: rhythmPattern, // e.g., 'one_per_measure', 'two_per_measure', 'irregular'
      accelerating: this.isAccelerating(progression, measures),
      suggestions: this.suggestRhythm(rhythmPattern, progression.length)
    };
  }

  suggestRhythm(pattern, progressionLength) {
    // If user has been using one chord per measure, suggest continuing
    // If approaching section end, might suggest accelerating
    // etc.
  }
}
```

### 5.4 Motif Recognition & Development

#### Concept
Recognize short chord patterns (motifs) and suggest developments.

```javascript
class MotifRecognizer {
  findMotifs(progression) {
    const motifs = [];

    // Look for repeated 2-3 chord patterns
    for (let len = 2; len <= 3; len++) {
      for (let i = 0; i <= progression.length - len; i++) {
        const pattern = progression.slice(i, i + len);
        const occurrences = this.countOccurrences(progression, pattern);

        if (occurrences >= 2) {
          motifs.push({
            pattern,
            length: len,
            occurrences,
            positions: this.findPositions(progression, pattern),
            type: this.classifyMotif(pattern)
          });
        }
      }
    }

    return motifs;
  }

  suggestMotifDevelopment(motif, key) {
    const developments = [];

    // Transposition
    developments.push({
      type: 'transposition',
      suggestions: this.transposeMotif(motif.pattern, [2, 5, 7]) // Up a step, 4th, 5th
    });

    // Inversion (melodic inversion of root movement)
    developments.push({
      type: 'inversion',
      suggestion: this.invertMotifMovement(motif.pattern)
    });

    // Extension
    developments.push({
      type: 'extension',
      suggestion: this.extendMotif(motif.pattern, key)
    });

    // Variation (change one chord)
    developments.push({
      type: 'variation',
      suggestions: this.varyMotif(motif.pattern, key)
    });

    return developments;
  }
}
```

---

## 6. Melody Recommendation Enhancements

### 6.1 Phrase-Level Generation

#### Current Limitation
`melodySuggestion.js` suggests individual notes.

#### Enhancement: Melodic Phrase Generator

```javascript
class MelodicPhraseGenerator {
  generatePhrase(options) {
    const {
      chord,
      key,
      length = 4,           // Number of notes
      style = 'pop',
      contour = 'arch',     // Overall shape
      rhythmPattern = null, // Optional rhythm template
      previousPhrase = null // For continuity
    } = options;

    // Generate multiple candidate phrases
    const candidates = [];

    for (let i = 0; i < 10; i++) {
      const phrase = this.buildPhrase(length, chord, key, contour, style);
      const score = this.scorePhrase(phrase, options);
      candidates.push({ phrase, score });
    }

    // Return top phrases with explanations
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(c => ({
        notes: c.phrase,
        score: c.score,
        contourDescription: this.describeContour(c.phrase),
        chordToneAnalysis: this.analyzeChordTones(c.phrase, chord),
        voiceLeadingQuality: this.analyzeVoiceLeading(c.phrase)
      }));
  }

  buildPhrase(length, chord, key, contour, style) {
    const phrase = [];
    const contourShape = this.getContourShape(contour, length);

    for (let i = 0; i < length; i++) {
      const targetPitch = contourShape[i]; // Relative pitch target
      const previousNote = phrase[i - 1] || null;

      // Get note options
      const options = this.getNoteOptions(chord, key, targetPitch, style);

      // Apply voice leading from previous note
      if (previousNote) {
        options.forEach(opt => {
          opt.score += this.voiceLeadingBonus(previousNote, opt.note);
        });
      }

      // Select best note
      const selected = this.selectNote(options);
      phrase.push(selected);
    }

    return phrase;
  }

  getContourShape(contour, length) {
    const shapes = {
      'arch': this.generateArch(length),         // Rise then fall
      'valley': this.generateValley(length),      // Fall then rise
      'ascending': this.generateAscending(length),
      'descending': this.generateDescending(length),
      'wave': this.generateWave(length),          // Multiple peaks
      'plateau': this.generatePlateau(length),    // Rise, hold, fall
      'question': this.generateQuestion(length),  // Rise at end
      'answer': this.generateAnswer(length)       // Fall at end
    };

    return shapes[contour] || shapes.arch;
  }
}
```

### 6.2 Section-Appropriate Melodies

#### Concept
Different sections need different melodic approaches.

```javascript
const SECTION_MELODY_PROFILES = {
  verse: {
    rangeOctaves: 1,           // Narrower range
    complexity: 'moderate',
    rhythmicDensity: 'moderate',
    chordToneRatio: 0.6,       // More non-chord tones OK
    repeatability: 'high',      // Should be memorable/singable
    typicalContours: ['wave', 'plateau'],
    startingNotes: ['1', '3', '5'], // Scale degrees
    description: 'Storytelling - conversational, accessible'
  },

  prechorus: {
    rangeOctaves: 1.5,
    complexity: 'building',
    rhythmicDensity: 'increasing',
    chordToneRatio: 0.5,
    repeatability: 'moderate',
    typicalContours: ['ascending', 'question'],
    direction: 'building_up',
    description: 'Building anticipation - rising energy'
  },

  chorus: {
    rangeOctaves: 1.5,
    complexity: 'simple',       // Memorable hooks
    rhythmicDensity: 'moderate',
    chordToneRatio: 0.8,       // Strong chord tones
    repeatability: 'very_high', // Must be catchy
    typicalContours: ['arch', 'plateau'],
    startingNotes: ['1', '5'], // Strong starts
    peakNote: 'high',          // Should hit high point
    description: 'Payoff - memorable, singable, emotional peak'
  },

  bridge: {
    rangeOctaves: 2,           // Can explore more
    complexity: 'high',
    rhythmicDensity: 'variable',
    chordToneRatio: 0.5,       // More chromatic OK
    repeatability: 'low',       // Can be through-composed
    typicalContours: ['valley', 'wave'],
    allowChromatic: true,
    description: 'Departure - contrast, surprise, different perspective'
  }
};

class SectionAwareMelodyGenerator extends MelodicPhraseGenerator {
  generateForSection(sectionType, chord, key, options = {}) {
    const profile = SECTION_MELODY_PROFILES[sectionType];

    const enhancedOptions = {
      ...options,
      rangeOctaves: profile.rangeOctaves,
      chordToneTarget: profile.chordToneRatio,
      contour: options.contour || profile.typicalContours[0],
      startingNotes: profile.startingNotes,
      allowChromatic: profile.allowChromatic || false
    };

    const phrases = this.generatePhrase(enhancedOptions);

    // Score phrases based on section appropriateness
    phrases.forEach(phrase => {
      phrase.sectionFit = this.scoreSectionFit(phrase, profile);
    });

    return phrases.sort((a, b) => b.sectionFit - a.sectionFit);
  }

  scoreSectionFit(phrase, profile) {
    let score = 0;

    // Check range compliance
    const range = this.calculateRange(phrase.notes);
    if (range <= profile.rangeOctaves * 12) score += 20;

    // Check chord tone ratio
    const chordToneRatio = phrase.chordToneAnalysis.ratio;
    const ratioDiff = Math.abs(chordToneRatio - profile.chordToneRatio);
    score += (1 - ratioDiff) * 30;

    // Check contour match
    if (profile.typicalContours.includes(phrase.contourDescription)) {
      score += 25;
    }

    // Check repeatability (melodic simplicity)
    if (profile.repeatability === 'very_high') {
      score += this.calculateSimplicity(phrase.notes) * 25;
    }

    return score;
  }
}
```

### 6.3 Melodic Motif Development

#### Concept
Recognize and develop melodic motifs across sections.

```javascript
class MelodicMotifDeveloper {
  developMotif(originalMotif, targetSection, key) {
    const sectionProfile = SECTION_MELODY_PROFILES[targetSection];
    const developments = [];

    // Exact repetition (for hooks)
    developments.push({
      type: 'repetition',
      motif: originalMotif,
      appropriateFor: ['chorus', 'verse'],
      description: 'Exact repetition for memorability'
    });

    // Sequence (transposition)
    [2, -2, 5, -5, 7].forEach(interval => {
      developments.push({
        type: 'sequence',
        motif: this.transpose(originalMotif, interval),
        interval,
        appropriateFor: ['verse', 'prechorus', 'bridge'],
        description: `Transposed ${interval > 0 ? 'up' : 'down'} ${Math.abs(interval)} semitones`
      });
    });

    // Inversion (flip upside down)
    developments.push({
      type: 'inversion',
      motif: this.invert(originalMotif, key),
      appropriateFor: ['bridge', 'verse'],
      description: 'Melodic inversion - mirror image'
    });

    // Retrograde (backwards)
    developments.push({
      type: 'retrograde',
      motif: this.retrograde(originalMotif),
      appropriateFor: ['bridge'],
      description: 'Played in reverse'
    });

    // Augmentation (slower)
    developments.push({
      type: 'augmentation',
      motif: this.augment(originalMotif),
      appropriateFor: ['chorus', 'bridge'],
      description: 'Stretched out - longer note values'
    });

    // Diminution (faster)
    developments.push({
      type: 'diminution',
      motif: this.diminish(originalMotif),
      appropriateFor: ['prechorus', 'bridge'],
      description: 'Compressed - shorter note values'
    });

    // Embellishment
    developments.push({
      type: 'embellishment',
      motif: this.embellish(originalMotif, key),
      appropriateFor: ['verse', 'bridge'],
      description: 'Added passing tones and decorations'
    });

    // Filter by section appropriateness
    return developments.filter(d =>
      d.appropriateFor.includes(targetSection)
    );
  }
}
```

### 6.4 Lyric-Aware Melody Suggestions

#### Concept (Future Enhancement)
If lyrics are provided, match melodic rhythm and contour to syllable stress.

```javascript
class LyricAwareMelodyGenerator {
  generateForLyrics(lyrics, chord, key, options) {
    const syllables = this.parseSyllables(lyrics);
    const stressPattern = this.analyzeStress(syllables);

    // Map stress to melodic contour
    const contour = this.stressToContour(stressPattern);

    // Generate melody matching syllable count
    return this.generatePhrase({
      ...options,
      length: syllables.length,
      contour,
      stressPattern,
      chord,
      key
    });
  }

  stressToContour(stressPattern) {
    // Stressed syllables get higher notes
    // Unstressed syllables get lower notes
    return stressPattern.map((stress, i) => {
      if (stress === 'primary') return 0.8;
      if (stress === 'secondary') return 0.6;
      return 0.4;
    });
  }
}
```

---

## 7. Harmony Recommendation Enhancements

### 7.1 Smart Auto-Harmonization

#### Current Limitation
`autoHarmonize.js` suggests basic chord matches for melody notes.

#### Enhancement: Context-Aware Harmonization

```javascript
class SmartAutoHarmonizer {
  harmonize(melody, key, options = {}) {
    const {
      style = 'pop',
      sectionType = 'verse',
      harmonyStyle = 'block',    // 'block', 'arpeggiated', 'countermelody'
      voices = 3,                // Number of harmony voices
      existingProgression = []   // If there's already a chord progression
    } = options;

    // If chord progression exists, harmonize within those chords
    if (existingProgression.length > 0) {
      return this.harmonizeWithProgression(melody, existingProgression, options);
    }

    // Otherwise, generate chords AND harmony parts
    return this.generateFullHarmonization(melody, key, options);
  }

  harmonizeWithProgression(melody, progression, options) {
    const harmonized = [];

    melody.forEach((note, i) => {
      const chord = this.getChordAtPosition(progression, i, melody.length);

      harmonized.push({
        melodyNote: note,
        chord: chord,
        harmonyNotes: this.generateHarmonyNotes(note, chord, options.voices, options.style),
        voicings: this.suggestVoicings(note, chord, options.harmonyStyle)
      });
    });

    return harmonized;
  }

  generateHarmonyNotes(melodyNote, chord, voices, style) {
    const harmonies = [];
    const melodyPitch = this.noteToPitch(melodyNote);
    const chordTones = this.getChordTones(chord);

    // Style-specific harmony intervals
    const styleIntervals = {
      pop: [-3, -5],           // 3rd and 5th below
      gospel: [-3, -5, -7],    // Add 7th for richness
      jazz: [-3, -6, -10],     // More open voicings
      classical: [-3, -5],     // Traditional
      barbershop: [-3, -5, -7, -12]  // Full 4-part
    };

    const intervals = styleIntervals[style] || styleIntervals.pop;

    intervals.slice(0, voices - 1).forEach(interval => {
      const harmonyPitch = melodyPitch + interval;

      // Adjust to chord tone if close
      const adjustedPitch = this.adjustToChordTone(harmonyPitch, chordTones);

      harmonies.push({
        pitch: adjustedPitch,
        note: this.pitchToNote(adjustedPitch),
        interval: melodyPitch - adjustedPitch,
        isChordTone: chordTones.includes(adjustedPitch % 12)
      });
    });

    return harmonies;
  }
}
```

### 7.2 Counter-Melody Generation

#### Concept
Generate independent melodic lines that complement the main melody.

```javascript
class CounterMelodyGenerator {
  generate(mainMelody, chord, key, options = {}) {
    const {
      type = 'parallel',     // 'parallel', 'contrary', 'oblique', 'free'
      interval = -3,         // Default: 3rd below
      rhythm = 'same',       // 'same', 'complementary', 'independent'
      complexity = 'simple'
    } = options;

    switch (type) {
      case 'parallel':
        return this.generateParallel(mainMelody, interval, chord, key);
      case 'contrary':
        return this.generateContrary(mainMelody, chord, key);
      case 'oblique':
        return this.generateOblique(mainMelody, chord, key);
      case 'free':
        return this.generateFreeCountermelody(mainMelody, chord, key, complexity);
    }
  }

  generateContrary(mainMelody, chord, key) {
    // When main melody goes up, counter goes down
    const counter = [];
    let lastCounterNote = this.getStartingNote(mainMelody[0], chord, 'below');

    for (let i = 1; i < mainMelody.length; i++) {
      const mainDirection = this.noteToPitch(mainMelody[i]) - this.noteToPitch(mainMelody[i-1]);
      const counterDirection = -mainDirection; // Opposite direction

      const targetPitch = this.noteToPitch(lastCounterNote) + counterDirection;
      const adjustedNote = this.adjustToScaleOrChord(targetPitch, chord, key);

      counter.push(adjustedNote);
      lastCounterNote = adjustedNote;
    }

    return counter;
  }

  generateFreeCountermelody(mainMelody, chord, key, complexity) {
    // Independent but complementary line
    const counter = [];

    mainMelody.forEach((mainNote, i) => {
      const options = [];
      const mainPitch = this.noteToPitch(mainNote);

      // Get chord tones that work well against the melody note
      const chordTones = this.getChordTones(chord);

      chordTones.forEach(tone => {
        const interval = Math.abs(mainPitch - tone) % 12;
        const consonance = this.getConsonance(interval);

        options.push({
          pitch: tone,
          consonance,
          voiceLeadingScore: counter.length > 0
            ? this.scoreVoiceLeading(counter[counter.length - 1], tone)
            : 50
        });
      });

      // Select best option balancing consonance and voice leading
      const selected = this.selectBestOption(options, complexity);
      counter.push(this.pitchToNote(selected.pitch));
    });

    return counter;
  }
}
```

### 7.3 Bass Line Generation

#### Concept
Generate bass lines that support the harmony.

```javascript
class BassLineGenerator {
  generate(progression, key, options = {}) {
    const {
      style = 'root',        // 'root', 'walking', 'pedal', 'melodic'
      rhythm = 'whole',      // 'whole', 'half', 'quarter', 'eighth'
      sectionType = 'verse'
    } = options;

    switch (style) {
      case 'root':
        return this.generateRootBass(progression);
      case 'walking':
        return this.generateWalkingBass(progression, key);
      case 'pedal':
        return this.generatePedalBass(progression, key);
      case 'melodic':
        return this.generateMelodicBass(progression, key);
    }
  }

  generateWalkingBass(progression, key) {
    const bassLine = [];

    progression.forEach((chord, i) => {
      const nextChord = progression[i + 1] || progression[0];
      const currentRoot = this.getRoot(chord);
      const nextRoot = this.getRoot(nextChord);

      // Generate approach to next chord
      const approach = this.generateApproach(currentRoot, nextRoot, key);

      bassLine.push({
        chordIndex: i,
        notes: [
          { note: currentRoot, beat: 1 },           // Root on beat 1
          { note: this.getFifth(chord), beat: 2 },  // 5th on beat 2
          { note: approach[0], beat: 3 },           // Approach note 1
          { note: approach[1], beat: 4 }            // Approach note 2 (chromatic to next root)
        ]
      });
    });

    return bassLine;
  }

  generateApproach(fromNote, toNote, key) {
    const fromPitch = this.noteToPitch(fromNote);
    const toPitch = this.noteToPitch(toNote);
    const distance = toPitch - fromPitch;

    if (Math.abs(distance) <= 2) {
      // Close: use scale tones
      return [
        this.pitchToNote(fromPitch + 2),
        this.pitchToNote(toPitch - 1) // Chromatic approach
      ];
    } else if (distance > 0) {
      // Ascending: walk up
      return [
        this.pitchToNote(fromPitch + 3),
        this.pitchToNote(toPitch - 1)
      ];
    } else {
      // Descending: walk down
      return [
        this.pitchToNote(fromPitch - 2),
        this.pitchToNote(toPitch + 1)
      ];
    }
  }
}
```

---

## 8. Cross-Engine Integration

### 8.1 Unified Composition Context

#### Concept
All engines share a common understanding of the composition.

```javascript
class CompositionContext {
  constructor() {
    this.key = null;
    this.tempo = 120;
    this.timeSignature = { num: 4, denom: 4 };
    this.sections = [];
    this.chordProgression = [];
    this.melodies = [];
    this.bassLine = null;
    this.harmonies = [];

    // Analysis cache
    this.analysis = {
      tensionCurve: null,
      patternMap: null,
      motifs: null,
      sectionRelationships: null
    };

    // User preferences (learned)
    this.userPreferences = {
      complexityLevel: 'moderate',
      chordTypePreferences: {},
      rootMovementPatterns: [],
      inversionUsage: 'moderate',
      styleLeaning: 'pop'
    };
  }

  update(changes) {
    // Update context and invalidate relevant analysis
    Object.assign(this, changes);
    this.invalidateAnalysis(Object.keys(changes));
    this.notifyEngines(changes);
  }

  notifyEngines(changes) {
    // Notify all registered engines of context changes
    this.engines.forEach(engine => {
      engine.onContextChange(this, changes);
    });
  }

  getAnalysis() {
    // Lazy computation of analysis
    if (!this.analysis.tensionCurve) {
      this.analysis.tensionCurve = this.tensionAnalyzer.analyze(this);
    }
    if (!this.analysis.patternMap) {
      this.analysis.patternMap = this.patternDetector.analyze(this);
    }
    // ... etc

    return this.analysis;
  }
}
```

### 8.2 Coordinated Recommendations

#### Concept
When one engine makes a suggestion, others adjust accordingly.

```javascript
class CoordinatedRecommendationService {
  constructor(context) {
    this.context = context;
    this.chordEngine = new EnhancedChordRecommender(context);
    this.melodyEngine = new SectionAwareMelodyGenerator(context);
    this.harmonyEngine = new SmartAutoHarmonizer(context);
    this.bassEngine = new BassLineGenerator(context);
  }

  getHolisticRecommendation(position, sectionInfo) {
    // Get chord recommendations first
    const chordRecs = this.chordEngine.getRecommendations(position, sectionInfo);

    // For top chord recommendations, generate matching melodies
    const holisticRecs = chordRecs.slice(0, 5).map(chordRec => {
      const melodyRecs = this.melodyEngine.generateForSection(
        sectionInfo.currentSection.type,
        chordRec.chord,
        this.context.key
      );

      const bassRecs = this.bassEngine.generate(
        [...this.context.chordProgression, chordRec.chord],
        this.context.key,
        { sectionType: sectionInfo.currentSection.type }
      );

      return {
        chord: chordRec,
        suggestedMelodies: melodyRecs.slice(0, 3),
        suggestedBass: bassRecs.notes[bassRecs.notes.length - 1],
        combinedScore: this.scoreHolisticFit(chordRec, melodyRecs[0], bassRecs)
      };
    });

    return holisticRecs.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  scoreHolisticFit(chord, melody, bass) {
    let score = chord.totalScore * 0.4;

    // Bonus if melody and chord work well together
    if (melody) {
      const melodyChordFit = this.scoreMelodyChordFit(melody, chord);
      score += melodyChordFit * 0.3;
    }

    // Bonus if bass creates good voice leading with melody and chord
    if (bass) {
      const bassIntegration = this.scoreBassIntegration(bass, chord, melody);
      score += bassIntegration * 0.3;
    }

    return score;
  }
}
```

### 8.3 "Complete Section" Generation

#### Concept
Generate complete sections with chords, melody, bass, and harmony.

```javascript
class SectionGenerator {
  async generateSection(sectionType, options = {}) {
    const {
      length = 4,
      existingSections = [],
      key,
      style = 'pop',
      mood = 'neutral',
      constraints = {}
    } = options;

    // Step 1: Generate chord progression for section
    const progressionGenerator = new SectionProgressionGenerator();
    const progressionOptions = await progressionGenerator.generateForSection(
      sectionType,
      existingSections,
      key,
      { length, style, mood }
    );

    const progression = progressionOptions.primary;

    // Step 2: Generate melody over progression
    const melodyGenerator = new SectionAwareMelodyGenerator();
    const melodies = [];

    progression.forEach(chord => {
      const phraseOptions = melodyGenerator.generateForSection(
        sectionType,
        chord,
        key,
        { style }
      );
      melodies.push(phraseOptions[0]);
    });

    // Step 3: Generate bass line
    const bassGenerator = new BassLineGenerator();
    const bassLine = bassGenerator.generate(progression, key, {
      style: style === 'jazz' ? 'walking' : 'root',
      sectionType
    });

    // Step 4: Generate harmony (optional)
    const harmonyGenerator = new SmartAutoHarmonizer();
    const harmony = harmonyGenerator.harmonize(melodies, key, {
      style,
      sectionType
    });

    return {
      sectionType,
      progression,
      progressionAlternatives: progressionOptions.alternatives,
      melody: melodies,
      bassLine,
      harmony,

      // Analysis
      analysis: {
        tensionCurve: this.analyzeTension(progression),
        moodAssessment: this.assessMood(progression, melodies),
        contrastWithExisting: this.assessContrast(progression, existingSections)
      },

      // Explanation
      reasoning: {
        progressionChoice: progressionOptions.reasoning,
        melodyApproach: `${sectionType} melody using ${SECTION_MELODY_PROFILES[sectionType].description}`,
        bassApproach: `Bass line style: ${style}`
      }
    };
  }
}
```

---

## 9. Implementation Priorities

### Phase 1: Section Context Integration (High Impact, Medium Effort)

**Goal**: Make existing engines section-aware.

#### Tasks:
1. **Modify `comprehensiveChordRecommendations.js`**
   - Add `sectionInfo` parameter
   - Implement `SECTION_PROFILES` data
   - Add section-position-aware scoring
   - Add section transition detection

2. **Create `SectionTransitionAnalyzer`**
   - Detect when user is at section boundary
   - Apply transition rules (verse→chorus, etc.)
   - Score recommendations for transition quality

3. **Update `recommendationService.js`**
   - Pass section context to engines
   - Include section information in UI output

4. **UI Integration**
   - Show section-relevant explanations
   - Highlight transition recommendations

### Phase 2: Tension Arc System (High Impact, Medium Effort)

**Goal**: Enable compositional planning through tension analysis.

#### Tasks:
1. **Create `TensionArcPlanner`**
   - Implement tension scoring for all chord types
   - Define tension arc templates
   - Calculate current vs. target curves

2. **Add Tension Visualization**
   - Display tension curve per section
   - Show overall song tension arc
   - Highlight tension mismatches

3. **Integrate with Recommendations**
   - Factor tension targets into chord scoring
   - Suggest chords that match tension trajectory

### Phase 3: Enhanced Melody Generation (High Impact, High Effort)

**Goal**: Move from single-note to phrase-level generation.

#### Tasks:
1. **Create `MelodicPhraseGenerator`**
   - Implement contour shapes
   - Add phrase scoring
   - Generate multiple candidates

2. **Create `SectionAwareMelodyGenerator`**
   - Define `SECTION_MELODY_PROFILES`
   - Implement section-appropriate generation
   - Score phrases for section fit

3. **Add Motif Recognition**
   - Detect repeated patterns
   - Suggest motif developments
   - Track motifs across sections

### Phase 4: Cross-Engine Coordination (Medium Impact, High Effort)

**Goal**: All engines work together holistically.

#### Tasks:
1. **Create `CompositionContext`**
   - Shared state for all engines
   - Lazy analysis computation
   - Change notification system

2. **Create `CoordinatedRecommendationService`**
   - Holistic recommendations
   - Combined scoring
   - "Complete section" generation

3. **Add User Preference Learning**
   - Track user choices
   - Adjust recommendations over time
   - Style profile building

### Phase 5: Advanced Harmony Features (Medium Impact, Medium Effort)

**Goal**: Rich harmonization and counterpoint.

#### Tasks:
1. **Enhance `autoHarmonize.js`**
   - Style-aware harmonization
   - Multiple voice generation
   - Context-aware chord selection

2. **Create `CounterMelodyGenerator`**
   - Parallel, contrary, oblique motion
   - Free countermelody generation
   - Voice independence scoring

3. **Create `BassLineGenerator`**
   - Root, walking, pedal, melodic styles
   - Approach note generation
   - Rhythm variation

---

## 10. Technical Architecture

### 10.1 Proposed Module Structure

```
src/modules/
├── recommendations/               # NEW: Unified recommendation system
│   ├── core/
│   │   ├── CompositionContext.js     # Shared state
│   │   ├── SectionProfiles.js        # Section characteristics
│   │   ├── TensionScoring.js         # Tension calculations
│   │   └── GenreLibraries.js         # Genre-specific patterns
│   │
│   ├── chord/
│   │   ├── ChordRecommender.js       # Enhanced chord engine
│   │   ├── SectionProgressionGenerator.js
│   │   ├── TransitionAnalyzer.js
│   │   └── MotifRecognizer.js
│   │
│   ├── melody/
│   │   ├── PhraseGenerator.js
│   │   ├── SectionMelodyGenerator.js
│   │   ├── MotifDeveloper.js
│   │   └── ContourShapes.js
│   │
│   ├── harmony/
│   │   ├── SmartHarmonizer.js
│   │   ├── CounterMelodyGenerator.js
│   │   └── BassLineGenerator.js
│   │
│   ├── analysis/
│   │   ├── TensionArcPlanner.js
│   │   ├── DeepContextAnalyzer.js
│   │   └── PatternMatcher.js
│   │
│   └── coordination/
│       ├── CoordinatedService.js     # Orchestrates all engines
│       ├── SectionGenerator.js       # Complete section generation
│       └── UserPreferenceLearner.js  # Adapts to user style
```

### 10.2 Data Flow

```
User Action (add chord, select section, etc.)
         │
         ▼
┌─────────────────────────────────────────┐
│         CompositionContext              │
│  - Updates shared state                 │
│  - Invalidates stale analysis           │
│  - Notifies registered engines          │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│     CoordinatedRecommendationService    │
│  - Gathers context (section, position)  │
│  - Queries specialized engines          │
│  - Combines and ranks results           │
│  - Returns holistic recommendations     │
└─────────────────────────────────────────┘
         │
         ├──────────────┬──────────────┬──────────────┐
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ ChordEngine │ │MelodyEngine │ │HarmonyEngine│ │ BassEngine  │
│             │ │             │ │             │ │             │
│ Section-    │ │ Phrase-     │ │ Context-    │ │ Style-      │
│ aware       │ │ level       │ │ aware       │ │ appropriate │
│ context-    │ │ section-    │ │ multi-voice │ │ approach    │
│ driven      │ │ appropriate │ │ generation  │ │ notes       │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
         │              │              │              │
         └──────────────┴──────────────┴──────────────┘
                                │
                                ▼
                   ┌─────────────────────┐
                   │   UI Components     │
                   │  - Suggestion panel │
                   │  - Tension curve    │
                   │  - Section cards    │
                   └─────────────────────┘
```

### 10.3 API Design

```javascript
// Primary API for UI integration
class RecommendationAPI {
  // Get next chord recommendations
  getChordRecommendations(options) {
    // options: { position, sectionInfo, key, style, mood, tension }
    // returns: [{ chord, score, reasons, sectionFit, tensionFit, ... }]
  }

  // Get complete progression for a section
  getSectionProgression(options) {
    // options: { sectionType, length, existingSections, key, style, mood }
    // returns: { primary, alternatives, reasoning }
  }

  // Get melody suggestions
  getMelodySuggestions(options) {
    // options: { chord, key, sectionType, previousNote, style, contour }
    // returns: [{ notes, score, contour, chordToneAnalysis, ... }]
  }

  // Get phrase-level melody
  getMelodicPhrase(options) {
    // options: { chord, key, sectionType, length, contour, style }
    // returns: [{ phrase, score, analysis }]
  }

  // Get harmonization
  getHarmonization(options) {
    // options: { melody, chord, key, voices, style }
    // returns: [{ melodyNote, harmonyNotes, voicings }]
  }

  // Get bass line suggestions
  getBassLine(options) {
    // options: { progression, key, style, sectionType }
    // returns: { notes: [{ note, beat }], style }
  }

  // Get tension analysis
  getTensionAnalysis(options) {
    // options: { progression, sections, targetTemplate }
    // returns: { currentCurve, targetCurve, suggestions }
  }

  // Generate complete section
  generateSection(options) {
    // options: { sectionType, length, existingSections, key, style, mood }
    // returns: { progression, melody, bass, harmony, analysis }
  }
}
```

---

## 11. Success Metrics

### 11.1 User Experience Metrics

| Metric | Current Baseline | Target | Measurement |
|--------|------------------|--------|-------------|
| Recommendation acceptance rate | ~30% (est.) | 50%+ | Track "use suggestion" clicks |
| Time to complete section | Unknown | -30% | Track section completion time |
| User engagement with suggestions | Unknown | +50% | Track suggestion panel interactions |
| Return user rate | Unknown | +25% | Track daily/weekly active users |

### 11.2 Technical Quality Metrics

| Metric | Target | Validation |
|--------|--------|------------|
| Section-appropriate recommendations | 80%+ rated "good fit" | User feedback survey |
| Tension curve alignment | Within 0.15 of target | Automated analysis |
| Voice leading quality | Average score > 75 | Existing scoring system |
| Cross-section contrast | > 40% harmonic variety | Automated analysis |

### 11.3 Competitive Differentiation Metrics

| Feature | Competitors | Our Target |
|---------|-------------|------------|
| Section-aware recommendations | 0/4 major competitors | Full implementation |
| Tension arc planning | 0/4 major competitors | Full implementation |
| Cross-section analysis | 0/4 major competitors | Full implementation |
| Phrase-level melody | 1/4 (Scaler) | Enhanced implementation |
| Integrated chord/melody/bass | 0/4 major competitors | Full implementation |

---

## Conclusion

By implementing these enhancements, Music Theory Lab will transform from a capable music theory tool into **the most compositionally intelligent songwriting assistant available**. The key differentiator—**section-aware compositional intelligence**—addresses a gap that no competitor currently fills.

The phased approach allows for incremental value delivery:

1. **Phase 1** (Section Context) immediately differentiates from competitors
2. **Phase 2** (Tension Arc) adds unique compositional planning
3. **Phase 3** (Enhanced Melody) elevates melody generation significantly
4. **Phase 4** (Cross-Engine) creates holistic composition assistance
5. **Phase 5** (Advanced Harmony) completes the full-stack composition tool

Each phase builds on the previous, creating a progressively more powerful and differentiated product.

---

*Document Version: 1.0*
*Created: 2025*
*Music Theory Lab Enhancement Roadmap*
