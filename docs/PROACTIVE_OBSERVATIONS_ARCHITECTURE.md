# Proactive Observations & Suggestions Architecture

**Date:** 2026-01-16
**Status:** Technical Design Document
**Focus:** Level 2 features - Proactive, visually delightful observations without AI dependency

---

## The Core Challenge

You've identified the fundamental tension:

> "How can we proactively point out observations and suggestions without:
> a) Tying into an AI model, or
> b) Trying to enumerate every possible 'interesting' thing?"

**The Good News:** Your codebase already has **60-70% of the detection infrastructure built**. The gap isn't detection—it's **aggregation, prioritization, and presentation**.

---

## Current Detection Capabilities (Already Built)

| Category | What's Detected | Location |
|----------|-----------------|----------|
| **Cadences** | PAC, HC, PC, DC, Phrygian HC | `patternDetection.js` |
| **Borrowed Chords** | bVI, bVII, bIII, iv, bII, #iv° | `patternDetection.js` |
| **Modal Patterns** | Dorian, Mixolydian, Phrygian, Lydian, Aeolian | `patternDetection.js` |
| **Sequences** | Circle of 5ths, ii-V chains, stepwise bass | `patternDetection.js` |
| **Secondary Dominants** | V/ii, V/iii, V/IV, V/V, V/vi | `extendedHarmonicRelationships.js` |
| **Chromatic Mediants** | Third-related chord pairs | `extendedHarmonicRelationships.js` |
| **Voice Leading Issues** | Parallel 5ths/8ves, crossing, large leaps | `enhancedVoiceLeading.js` |
| **Tension Arc** | Per-chord tension scores, arc shape | `harmonyAnalyzer.js` |
| **Harmonic Functions** | Tonic, dominant, subdominant classification | `harmonyAnalyzer.js` |
| **Chord Tone Relationships** | Root, 3rd, 5th, 7th, extensions, chromatic | `chordToneAnalyzer.js` |
| **Motifs** | Recurring melodic patterns | `motifRecognition.js` |

**Key Insight:** You don't need to enumerate infinite possibilities. You need to:
1. **Aggregate** existing detections into a unified stream
2. **Prioritize** which observations are most interesting right now
3. **Present** them in a delightful, non-intrusive way

---

## Proposed Architecture: "Observation Engine"

### Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     COMPOSITION EVENTS                               │
│  (chordAdded, noteEdited, progressionChanged, measureCompleted)     │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    OBSERVATION ENGINE                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ Detector    │  │ Detector    │  │ Detector    │  ... (existing) │
│  │ Adapters    │  │ Adapters    │  │ Adapters    │                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│         │               │               │                           │
│         └───────────────┴───────────────┘                           │
│                         │                                           │
│                         ▼                                           │
│              ┌─────────────────────┐                                │
│              │  Observation Queue  │                                │
│              │  (prioritized)      │                                │
│              └─────────────────────┘                                │
│                         │                                           │
│                         ▼                                           │
│              ┌─────────────────────┐                                │
│              │  Display Strategy   │                                │
│              │  (timing, location) │                                │
│              └─────────────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     VISUAL PRESENTATION                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Floating     │  │ Inline       │  │ Margin       │              │
│  │ Cards        │  │ Annotations  │  │ Badges       │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Observation Types (The Enumeration)

Rather than infinite possibilities, we define **categories** of observations. Each category has:
- A **detector** (mostly already exists)
- A **template** for display
- A **priority** score
- A **cooldown** to prevent spam

### Category 1: "You Just Created..." (Celebratory)

These celebrate interesting harmonic moments the user created.

| Observation | Trigger | Priority | Cooldown |
|-------------|---------|----------|----------|
| Deceptive Cadence | V→vi detected | High | 60s |
| Plagal Cadence | IV→I detected | Medium | 60s |
| Perfect Cadence | V→I detected | Low | 120s |
| Secondary Dominant | V/x pattern | High | 45s |
| Borrowed Chord | bVI, bVII, etc. | High | 30s |
| Circle of Fifths | 3+ chords in sequence | High | 90s |
| Modal Pattern | Dorian i-IV, etc. | Medium | 60s |
| Chromatic Mediant | Third-related chords | Medium | 60s |

**Template:**
```
🎉 You just created a [PATTERN NAME]!
   [Short explanation]
   [Learn more →]
```

### Category 2: "Did You Notice..." (Educational)

These point out theory concepts in the user's work.

| Observation | Trigger | Priority | Cooldown |
|-------------|---------|----------|----------|
| Tension Building | 3+ chords increasing tension | Medium | 90s |
| Tension Release | High→Low tension transition | Medium | 90s |
| Harmonic Rhythm Change | Acceleration or deceleration | Medium | 120s |
| Voice Leading Quality | Score drops below 70% | High | 60s |
| Smooth Voice Leading | Score above 90% for 3+ chords | Medium | 90s |
| Common Tone Connection | Same note held across chords | Low | 120s |
| Leading Tone Resolution | 7→1 resolution detected | Medium | 60s |

**Template:**
```
💡 Did you notice...
   [Observation about their music]
   [Why it matters]
```

### Category 3: "You Might Try..." (Suggestions)

These suggest specific improvements or variations.

| Suggestion | Trigger | Priority | Cooldown |
|------------|---------|----------|----------|
| Add Inversion | Root position for 4+ chords | Medium | 120s |
| Try Borrowed Chord | Long diatonic stretch | Medium | 180s |
| Smooth Voice Leading | Parallel 5ths detected | High | 45s |
| Add Tension | Flat tension curve | Medium | 120s |
| Resolve Dominant | Unresolved V7 hanging | High | 30s |
| Try Deceptive Cadence | V→I pattern, suggest V→vi | Medium | 180s |
| Secondary Dominant | ii→V pattern, suggest V/V | Medium | 120s |

**Template:**
```
✨ You might try...
   [Specific suggestion]
   [▶ Hear it] [Apply] [Dismiss]
```

### Category 4: "Warning" (Issues)

These flag potential problems (already shown in voice leading overlay).

| Warning | Trigger | Priority | Cooldown |
|---------|---------|----------|----------|
| Parallel Fifths | Detected in voice leading | High | 30s |
| Parallel Octaves | Detected in voice leading | High | 30s |
| Voice Crossing | Voices swap registers | Medium | 45s |
| Large Leap | 8+ semitone jump | Medium | 60s |
| Unresolved Tension | Dominant without resolution | Medium | 90s |

**Template:**
```
⚠️ Heads up...
   [Issue description]
   [Why it might matter]
   [Fix it →] [It's intentional]
```

---

## Part 2: Priority & Timing System

Not all observations should appear immediately. The system uses:

### Priority Scoring

```javascript
const PRIORITY_WEIGHTS = {
  // Base priority by category
  'celebration': 80,    // "You just created..."
  'educational': 60,    // "Did you notice..."
  'suggestion': 70,     // "You might try..."
  'warning': 90,        // Issues

  // Modifiers
  'first_time_user_sees': +20,   // Never seen this type before
  'rare_pattern': +15,           // Uncommon harmonic event
  'in_context': +10,             // Relevant to current work
  'recently_shown': -30,         // Same type shown recently
  'user_dismissed_before': -50,  // User dismissed this type
};
```

### Display Timing

```javascript
const TIMING_RULES = {
  // Don't interrupt active editing
  debounce_after_edit: 2000,  // Wait 2s after last edit

  // Don't spam
  min_between_any: 10000,     // 10s between any observations
  min_between_same_type: 60000, // 60s between same type

  // Batch similar observations
  batch_window: 3000,         // Group observations within 3s
  max_batch_size: 3,          // Show max 3 at once

  // User engagement
  auto_hide_after: 8000,      // Auto-hide after 8s
  pause_on_hover: true,       // Pause timer on hover
};
```

---

## Part 3: Visual Presentation Options

### Option A: Floating Cards (Like Theory Moments)

Current Theory Moments appear as floating cards in the top-right. This works but can feel disconnected from the notation.

```
┌─────────────────────────────────────────────────────────────┐
│                                          ┌─────────────┐   │
│   [Notation Staff]                       │ 🎉 You just │   │
│                                          │ created a   │   │
│                                          │ deceptive   │   │
│                                          │ cadence!    │   │
│                                          └─────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Pros:** Non-intrusive, familiar pattern
**Cons:** Disconnected from the music, easy to ignore

### Option B: Inline Annotations (On the Notation)

Observations appear directly on/near the relevant measures.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   [Measure 1]  [Measure 2]  [Measure 3]  [Measure 4]       │
│       C           G           Am          F                 │
│                      ▲                                      │
│                      │                                      │
│              ┌───────┴───────┐                              │
│              │ 🎉 Deceptive  │                              │
│              │ cadence here! │                              │
│              └───────────────┘                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Pros:** Contextual, shows exactly where the pattern is
**Cons:** Can clutter notation, harder to implement

### Option C: Margin Badges (Sidebar Indicators)

Small badges appear in a left margin, clicking reveals details.

```
┌────┬────────────────────────────────────────────────────────┐
│    │                                                        │
│ 🎉 │   [Measure 1]  [Measure 2]  [Measure 3]  [Measure 4]  │
│    │       C           G           Am          F            │
│    │                                                        │
│ 💡 │   [Measure 5]  [Measure 6]  [Measure 7]  [Measure 8]  │
│    │       Dm          G           C           C            │
│    │                                                        │
│ ⚠️ │   [Measure 9]  [Measure 10] [Measure 11] [Measure 12] │
│    │       F           G           Am          E            │
│    │                                                        │
└────┴────────────────────────────────────────────────────────┘
```

**Pros:** Clean, non-intrusive, shows density of observations
**Cons:** Requires sidebar space, less immediate

### Option D: Toast Stream (Bottom Notifications)

A stream of observations flows at the bottom, like a news ticker.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   [Notation Staff - Full Width]                             │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 🎉 Deceptive cadence at M3  │  💡 Tension building M5-M8   │
└─────────────────────────────────────────────────────────────┘
```

**Pros:** Doesn't block notation, can show multiple
**Cons:** Easy to miss, less detailed

### Option E: **Recommended Hybrid Approach**

Combine multiple presentation styles based on observation type:

| Type | Presentation | Why |
|------|--------------|-----|
| Celebrations | Floating card (brief) | Deserves attention, not tied to location |
| Educational | Inline annotation | Shows exactly what we're talking about |
| Suggestions | Floating card with action buttons | Needs user decision |
| Warnings | Inline annotation + margin badge | Must be visible at location |

---

## Part 4: Concrete Implementation Plan

### File Structure

```
src/modules/teaching/
├── observationEngine.js        # Core engine (NEW)
├── observationTypes.js         # Type definitions (NEW)
├── observationPrioritizer.js   # Priority/timing logic (NEW)
├── observationPresenter.js     # Visual rendering (NEW)
├── theoryMoments.js            # (existing - could be migrated)
└── theoryMomentsConfig.js      # (existing - could be migrated)
```

### Core Data Structures

```javascript
// observationTypes.js

export const OBSERVATION_TYPES = {
  // Celebrations
  'deceptive-cadence': {
    category: 'celebration',
    emoji: '🎉',
    title: 'Deceptive Cadence!',
    templates: {
      simple: "You created a surprise! V went to vi instead of I.",
      intermediate: "Deceptive cadence (V→vi) - the listener expects I but gets vi.",
      advanced: "V→vi deceptive resolution. The vi shares 2 notes with I, providing harmonic continuity despite the surprise."
    },
    detector: 'patternDetection:cadences',
    priority: 85,
    cooldown: 60000,
    presentation: 'floating',
    learnMoreLesson: 'lesson-advanced-voice-leading'
  },

  'secondary-dominant': {
    category: 'celebration',
    emoji: '🔥',
    title: 'Secondary Dominant!',
    templates: {
      simple: "That chord really wants to go somewhere specific!",
      intermediate: "You used a secondary dominant (V/x) - it pulls toward a non-tonic chord.",
      advanced: "Secondary dominant creates a temporary tonicization, expanding harmonic vocabulary."
    },
    detector: 'extendedHarmonicRelationships:secondaryDominants',
    priority: 80,
    cooldown: 45000,
    presentation: 'floating',
    learnMoreLesson: 'lesson-secondary-dominants'
  },

  // Suggestions
  'try-inversion': {
    category: 'suggestion',
    emoji: '✨',
    title: 'Try an Inversion?',
    templates: {
      simple: "Your bass could move more smoothly with an inversion here.",
      intermediate: "Using {{chord}}¹ instead of root position would create stepwise bass motion.",
      advanced: "First inversion here yields bass motion of {{interval}} instead of {{current_interval}}, improving voice leading score by ~{{improvement}}%."
    },
    detector: 'voiceLeading:inversionOpportunity',
    priority: 65,
    cooldown: 120000,
    presentation: 'floating-action',
    actions: ['hear-comparison', 'apply', 'dismiss']
  },

  // Warnings
  'parallel-fifths': {
    category: 'warning',
    emoji: '⚠️',
    title: 'Parallel Fifths',
    templates: {
      simple: "These two voices are moving together in a way that classical music avoids.",
      intermediate: "Parallel fifths between {{voice1}} and {{voice2}} - common in rock, avoided in classical.",
      advanced: "Parallel P5 motion ({{note1}}→{{note2}} against {{note3}}→{{note4}}) weakens voice independence."
    },
    detector: 'voiceLeading:parallelFifths',
    priority: 75,
    cooldown: 30000,
    presentation: 'inline',
    actions: ['fix-suggestion', 'intentional']
  }
};
```

### Observation Engine Core

```javascript
// observationEngine.js

import { OBSERVATION_TYPES } from './observationTypes.js';
import { detectAllPatterns } from '../analysis/patternDetection.js';
import { HarmonyAnalyzer } from '../analysis/harmonyAnalyzer.js';
// ... other detector imports

class ObservationEngine {
  constructor() {
    this.queue = [];
    this.history = [];
    this.cooldowns = new Map();
    this.presenter = new ObservationPresenter();
  }

  init() {
    // Listen for composition events
    window.addEventListener('chordAdded', (e) => this.onChordAdded(e.detail));
    window.addEventListener('noteEdited', (e) => this.onNoteEdited(e.detail));
    window.addEventListener('progressionChanged', (e) => this.onProgressionChanged(e.detail));
    window.addEventListener('measureCompleted', (e) => this.onMeasureCompleted(e.detail));
  }

  onChordAdded(detail) {
    // Debounce
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this.runDetectors(detail);
    }, 2000);
  }

  runDetectors(context) {
    const observations = [];

    // Run each detector adapter
    for (const [typeId, config] of Object.entries(OBSERVATION_TYPES)) {
      if (this.isOnCooldown(typeId)) continue;

      const detected = this.runDetector(config.detector, context);
      if (detected) {
        observations.push({
          type: typeId,
          config,
          data: detected,
          timestamp: Date.now()
        });
      }
    }

    // Prioritize and queue
    const prioritized = this.prioritize(observations);
    this.queueObservations(prioritized);
  }

  prioritize(observations) {
    return observations
      .map(obs => ({
        ...obs,
        score: this.calculatePriority(obs)
      }))
      .filter(obs => obs.score > 50) // Minimum threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Max 3 at a time
  }

  calculatePriority(observation) {
    let score = observation.config.priority;

    // First time seeing this type?
    if (!this.history.some(h => h.type === observation.type)) {
      score += 20;
    }

    // Recently shown same type?
    const lastSameType = this.history
      .filter(h => h.type === observation.type)
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    if (lastSameType && Date.now() - lastSameType.timestamp < 300000) {
      score -= 30;
    }

    // User dismissed this type before?
    if (this.getDismissedTypes().has(observation.type)) {
      score -= 50;
    }

    return score;
  }

  queueObservations(observations) {
    for (const obs of observations) {
      this.queue.push(obs);
      this.setCooldown(obs.type, obs.config.cooldown);
    }

    this.processQueue();
  }

  processQueue() {
    if (this.queue.length === 0) return;

    const obs = this.queue.shift();
    this.presenter.show(obs);
    this.history.push(obs);
  }
}
```

### Detector Adapters

The key insight is that detectors already exist—we just need thin adapters:

```javascript
// observationDetectors.js

export const DETECTOR_ADAPTERS = {
  'patternDetection:cadences': (context) => {
    const { progression, index, key } = context;
    if (index < 1) return null;

    const prev = progression[index - 1];
    const curr = progression[index];

    // Use existing detection logic from patternDetection.js
    const prevRoman = normalizeRoman(prev.roman || prev.romanNumeral);
    const currRoman = normalizeRoman(curr.roman || curr.romanNumeral);

    // Deceptive cadence
    if ((prevRoman === 'V' || prevRoman === 'V7') && currRoman === 'vi') {
      return {
        cadenceType: 'deceptive',
        from: prevRoman,
        to: currRoman,
        measureIndex: index
      };
    }

    // ... other cadences
    return null;
  },

  'voiceLeading:parallelFifths': (context) => {
    // Tap into existing voice leading analysis
    const vlResult = window.calculateProgressionVoiceLeading?.(context.progression);
    if (!vlResult?.warnings) return null;

    const parallelFifths = vlResult.warnings.filter(w => w.type === 'parallel-fifths');
    if (parallelFifths.length > 0) {
      return {
        warnings: parallelFifths,
        measureIndex: parallelFifths[0].measureIndex
      };
    }
    return null;
  },

  'voiceLeading:inversionOpportunity': (context) => {
    // Check if using inversion would improve voice leading
    const { progression, index } = context;
    if (index < 1) return null;

    const curr = progression[index];
    if (curr.inversion !== 0) return null; // Already inverted

    // Calculate current VL score
    const currentScore = calculateVoiceLeadingScore(progression[index-1], curr);

    // Calculate with first inversion
    const withInversion = { ...curr, inversion: 1 };
    const invertedScore = calculateVoiceLeadingScore(progression[index-1], withInversion);

    if (invertedScore - currentScore > 15) { // 15% improvement threshold
      return {
        chord: curr,
        currentScore,
        invertedScore,
        improvement: invertedScore - currentScore,
        suggestedInversion: 1
      };
    }
    return null;
  }
};
```

---

## Part 5: Visual Presentation Implementation

### Floating Card Component

```javascript
// observationPresenter.js

export class ObservationPresenter {
  show(observation) {
    switch (observation.config.presentation) {
      case 'floating':
        this.showFloatingCard(observation);
        break;
      case 'floating-action':
        this.showFloatingCardWithActions(observation);
        break;
      case 'inline':
        this.showInlineAnnotation(observation);
        break;
    }
  }

  showFloatingCard(observation) {
    const skillLevel = localStorage.getItem('theorySkillLevel') || 'simple';
    const template = observation.config.templates[skillLevel];
    const text = this.interpolateTemplate(template, observation.data);

    const card = document.createElement('div');
    card.className = 'observation-card';
    card.innerHTML = `
      <div class="observation-card-inner" style="--accent-color: ${this.getCategoryColor(observation.config.category)}">
        <div class="observation-header">
          <span class="observation-emoji">${observation.config.emoji}</span>
          <span class="observation-title">${observation.config.title}</span>
          <button class="observation-close" aria-label="Close">×</button>
        </div>
        <div class="observation-body">
          <p>${text}</p>
        </div>
        ${observation.config.learnMoreLesson ? `
          <div class="observation-footer">
            <button class="observation-learn-more">Learn more →</button>
          </div>
        ` : ''}
      </div>
    `;

    // Animate in
    document.body.appendChild(card);
    requestAnimationFrame(() => card.classList.add('visible'));

    // Auto-hide
    this.scheduleAutoHide(card, 8000);
  }

  showInlineAnnotation(observation) {
    // Find the relevant measure in notation
    const measureIndex = observation.data.measureIndex;
    const measureElement = document.querySelector(`[data-measure-index="${measureIndex}"]`);

    if (!measureElement) {
      // Fallback to floating if can't find measure
      this.showFloatingCard(observation);
      return;
    }

    const annotation = document.createElement('div');
    annotation.className = 'inline-observation';
    annotation.innerHTML = `
      <div class="inline-observation-pointer"></div>
      <div class="inline-observation-content">
        <span class="observation-emoji">${observation.config.emoji}</span>
        <span>${observation.config.title}</span>
      </div>
    `;

    // Position below the measure
    const rect = measureElement.getBoundingClientRect();
    annotation.style.left = `${rect.left + rect.width/2}px`;
    annotation.style.top = `${rect.bottom + 8}px`;

    document.body.appendChild(annotation);
    requestAnimationFrame(() => annotation.classList.add('visible'));

    this.scheduleAutoHide(annotation, 6000);
  }
}
```

### CSS Styles

```css
/* observations.css */

/* Floating Card */
.observation-card {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 99998;
  max-width: 320px;
  opacity: 0;
  transform: translateX(20px);
  transition: all 0.3s ease-out;
}

.observation-card.visible {
  opacity: 1;
  transform: translateX(0);
}

.observation-card-inner {
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px -10px rgba(0,0,0,0.2);
  border-left: 4px solid var(--accent-color, #6366f1);
  overflow: hidden;
}

.observation-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--accent-color) 15%, white),
    color-mix(in srgb, var(--accent-color) 5%, white)
  );
}

.observation-emoji {
  font-size: 1.5rem;
}

.observation-title {
  font-weight: 600;
  color: #1f2937;
  flex: 1;
}

.observation-body {
  padding: 0.75rem 1rem;
  color: #4b5563;
  font-size: 0.9rem;
  line-height: 1.5;
}

.observation-footer {
  padding: 0.5rem 1rem 0.75rem;
  border-top: 1px solid #f3f4f6;
}

.observation-learn-more {
  color: var(--accent-color);
  font-size: 0.85rem;
  font-weight: 500;
  background: none;
  border: none;
  cursor: pointer;
}

/* Category Colors */
.observation-card[data-category="celebration"] { --accent-color: #10b981; }
.observation-card[data-category="educational"] { --accent-color: #6366f1; }
.observation-card[data-category="suggestion"] { --accent-color: #f59e0b; }
.observation-card[data-category="warning"] { --accent-color: #ef4444; }

/* Inline Annotation */
.inline-observation {
  position: fixed;
  z-index: 99997;
  opacity: 0;
  transform: translateY(-10px);
  transition: all 0.3s ease-out;
}

.inline-observation.visible {
  opacity: 1;
  transform: translateY(0);
}

.inline-observation-pointer {
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 8px solid white;
  margin-left: calc(50% - 8px);
}

.inline-observation-content {
  background: white;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 500;
}
```

---

## Part 6: Where It Fits in Composition Studio

Since you mentioned uncertainty about where a "persistent side panel" would fit, here are alternatives that work with the existing layout:

### Option 1: Enhance Existing "Theory" Panel

The bottom dock already has a "Theory" panel (`theory` in `DOCK_BUTTONS`). Enhance it to show recent observations:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NOTATION AREA                                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│ [Workbench] [Chords] [Quick Add] [Auto-Bass] [Voice] [Borrowed] [💡Theory] │
├─────────────────────────────────────────────────────────────────────┤
│ RECENT OBSERVATIONS                      │ PATTERNS DETECTED        │
│ ┌─────────────────────────────────────┐  │ ✓ Deceptive Cadence (M3) │
│ │ 🎉 Deceptive cadence at M3!         │  │ ✓ Circle of 5ths (M1-4)  │
│ │    V→vi instead of expected V→I     │  │ ✓ Borrowed bVII (M7)     │
│ │    [Learn more →]                   │  │                          │
│ └─────────────────────────────────────┘  │ SUGGESTIONS              │
│ ┌─────────────────────────────────────┐  │ • Try inversion at M5    │
│ │ ✨ Try inversion at M5?             │  │ • Add tension at M6      │
│ │    Would improve voice leading 12%  │  │                          │
│ │    [▶ Hear] [Apply] [Dismiss]       │  │                          │
│ └─────────────────────────────────────┘  │                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Option 2: Floating Observation Stream

Observations float in from the right, stack vertically, auto-dismiss:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                              ┌─────────────────────┐│
│                                              │ 🎉 Deceptive        ││
│   NOTATION AREA                              │ cadence at M3!      ││
│                                              └─────────────────────┘│
│                                              ┌─────────────────────┐│
│                                              │ ✨ Try inversion    ││
│                                              │ at M5?              ││
│                                              └─────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### Option 3: Notation Margin Badges

Badges appear in left margin of notation, hover/click for details:

```
┌────┬────────────────────────────────────────────────────────────────┐
│    │  System 1                                                      │
│ 🎉 │  [M1: C] [M2: G] [M3: Am] [M4: F]                             │
│    │                    ↑ Click badge for details                   │
│────│────────────────────────────────────────────────────────────────│
│    │  System 2                                                      │
│ ✨ │  [M5: Dm] [M6: G] [M7: C] [M8: C]                             │
│    │     ↑ Suggestion available                                     │
└────┴────────────────────────────────────────────────────────────────┘
```

---

## Part 7: Implementation Phases

### Phase 1: Foundation (2-3 days)
1. Create `observationEngine.js` core
2. Create `observationTypes.js` with 10 initial types
3. Create detector adapters for existing detectors
4. Basic floating card presenter

### Phase 2: Integration (2-3 days)
5. Hook into composition events
6. Implement priority/cooldown system
7. Add to Composition Studio (enhance Theory panel)
8. Test with real compositions

### Phase 3: Polish (2-3 days)
9. Inline annotations for warnings
10. "Hear it" / "Apply" actions for suggestions
11. User preference persistence
12. Animations and visual polish

### Phase 4: Expansion (ongoing)
13. Add more observation types
14. Connect to lesson system
15. A/B test presentation styles
16. User feedback collection

---

## Conclusion

**You don't need AI to provide intelligent observations.** You need:

1. **Aggregation** - Unify your existing detectors into one stream
2. **Prioritization** - Show the most interesting things first
3. **Presentation** - Make observations delightful and contextual

The enumeration approach works because music theory IS enumerable at the level of "interesting patterns." There are only so many cadence types, borrowed chord categories, voice leading issues, etc. Your codebase already detects most of them—we just need to surface them proactively.

**Start with the 15-20 most impactful observations**, then expand based on user feedback.
