# Rhythmic Awareness Enhancement - Phases 4 & 5

## Overview

This document defines the remaining implementation phases for the Rhythmic Awareness feature, which adds duration/timing suggestions to chord recommendations and section generation.

---

## Completed Phases (1-3) Summary

### Phase 1: `rhythmicContextAnalyzer.js` ✅
**Location:** `src/modules/features/rhythmicContextAnalyzer.js`

Created the core analysis engine with:
- `analyzeRhythmicContext()` - Main analysis function
- Harmonic rhythm trend detection (accelerating/decelerating/steady/varied)
- Style-aware duration defaults (`STYLE_HARMONIC_RHYTHM`)
- Section position factors (`SECTION_POSITION_FACTORS`)
- Duration suggestion with confidence scores and reasoning
- Helper functions: `quickDurationSuggestion()`, `getDurationForSectionPosition()`

### Phase 2: `comprehensiveChordRecommendations.js` ✅
**Location:** `src/modules/features/comprehensiveChordRecommendations.js`

Added `rhythmInfo` parameter to `generateComprehensiveRecommendations()`:
```javascript
rhythmInfo = {
  enabled: true,
  compositionState: compositionState,
  insertAfterIndex: number
}
```

Each recommendation now includes:
- `suggestedDuration` - Beats for this chord
- `durationConfidence` - 0-100 confidence score
- `durationReason` - Human-readable explanation
- `durationAlternatives` - Array of alternative durations
- `rhythmicContext` - Analysis summary

Added `calculateChordDurationAdjustment()` for chord-specific duration logic.

### Phase 3: `SectionGenerator.js` ✅
**Location:** `src/modules/recommendations/coordination/SectionGenerator.js`

Added duration arc planning:
- `DURATION_ARC_PROFILES` - Section-type-specific duration curves
- `STYLE_BASE_DURATIONS` - Style defaults
- `_planDurationArc()` - Plans duration curve coordinated with tension arc
- `_applyDurationsToProgression()` - Applies durations to chords
- Generated sections now include `durationArc` and `rhythmicInfo`

### Integration: `recommendationService.js` ✅
**Location:** `src/modules/integration/recommendationService.js`

- Wired `rhythmInfo` parameter into recommendation calls
- Added localStorage setting: `chord-suggestion-rhythm-awareness`
- Formatted recommendations include duration fields

### UI Toggle: `chordSuggestionModal.js` ✅
**Location:** `src/modules/ui/chordSuggestionModal.js`

- Added "Duration: Suggest" checkbox to controls row
- Persists setting to localStorage
- Dispatches `rhythmAwarenessChanged` event

---

## Phase 4: CompositionContext Integration

### Goal
Connect the rhythmic analyzer to `CompositionContext.js` so all recommendation engines can access rhythmic snapshots through the shared context system.

### Files to Modify
- `src/modules/recommendations/core/CompositionContext.js`

### Implementation Tasks

#### 4.1 Add Rhythmic Snapshot Method
```javascript
// In CompositionContext class

import {
    analyzeRhythmicContext,
    HARMONIC_RHYTHM_TRENDS
} from '../../features/rhythmicContextAnalyzer.js';

/**
 * Get rhythmic context snapshot for current composition state
 * @param {Object} options - Analysis options
 * @returns {Object} Rhythmic analysis snapshot
 */
getRhythmicSnapshot(options = {}) {
    const snapshot = this.getSnapshot();

    return analyzeRhythmicContext(
        { storedProgressionData: snapshot.progression },
        {
            style: options.style || this._currentStyle || 'pop',
            currentChordIndex: snapshot.insertAfterIndex ?? (snapshot.progression.length - 1),
            insertAfterIndex: snapshot.insertAfterIndex,
            sectionContext: this._getCurrentSectionContext()
        }
    );
}

/**
 * Get current section context for rhythm analysis
 * @private
 */
_getCurrentSectionContext() {
    const snapshot = this.getSnapshot();
    if (!snapshot.sections || snapshot.sections.length === 0) return null;

    // Find section containing current chord
    const currentIndex = snapshot.insertAfterIndex ?? (snapshot.progression.length - 1);
    const currentSection = snapshot.sections.find(s =>
        currentIndex >= s.startIndex && currentIndex <= s.endIndex
    );

    if (!currentSection) return null;

    return {
        type: currentSection.type,
        startIndex: currentSection.startIndex,
        endIndex: currentSection.endIndex,
        targetLength: currentSection.targetLength
    };
}
```

#### 4.2 Add Rhythmic Change Listener
```javascript
// In CompositionContext constructor or initialize()

// Listen for rhythm awareness setting changes
window.addEventListener('rhythmAwarenessChanged', (e) => {
    this._rhythmAwarenessEnabled = e.detail.enabled;
    this._invalidateCache('rhythmic');
    this.emit('rhythmSettingChanged', e.detail);
});
```

#### 4.3 Cache Rhythmic Analysis
```javascript
// Add caching to prevent repeated analysis

_rhythmicCache = null;
_rhythmicCacheKey = null;

getRhythmicSnapshot(options = {}) {
    const cacheKey = this._buildRhythmicCacheKey(options);

    if (this._rhythmicCache && this._rhythmicCacheKey === cacheKey) {
        return this._rhythmicCache;
    }

    const analysis = this._computeRhythmicSnapshot(options);
    this._rhythmicCache = analysis;
    this._rhythmicCacheKey = cacheKey;

    return analysis;
}

_buildRhythmicCacheKey(options) {
    const snapshot = this.getSnapshot();
    return JSON.stringify({
        progressionLength: snapshot.progression.length,
        lastChordBeats: snapshot.progression[snapshot.progression.length - 1]?.beats,
        insertAfterIndex: snapshot.insertAfterIndex,
        style: options.style
    });
}
```

#### 4.4 Expose in Snapshot
```javascript
// Update getSnapshot() to optionally include rhythmic data

getSnapshot(options = { includeRhythmic: false }) {
    const base = {
        // ... existing snapshot fields
    };

    if (options.includeRhythmic && this._rhythmAwarenessEnabled) {
        base.rhythmicContext = this.getRhythmicSnapshot();
    }

    return base;
}
```

### Testing Checklist
- [ ] `getRhythmicSnapshot()` returns valid analysis
- [ ] Cache invalidates on progression changes
- [ ] Cache invalidates on rhythm setting toggle
- [ ] Section context correctly identified
- [ ] No performance regression on rapid chord additions

---

## Phase 5: UI Display Integration

### Goal
Display duration suggestions in the recommendation UI components so users can see and act on rhythmic recommendations.

### Files to Modify
- `src/modules/features/chordBuilder.js` - Main chord builder UI
- `src/modules/ui/recommendationsSidebar.js` - Sidebar recommendations
- `src/modules/ui/chordExplorerModal.js` - 3D explorer modal

### Implementation Tasks

#### 5.1 Chord Builder Duration Display
**File:** `src/modules/features/chordBuilder.js`

Add duration badge to recommendation cards:
```javascript
// In recommendation card rendering function

if (recommendation.suggestedDuration) {
    const durationBadge = document.createElement('div');
    durationBadge.className = 'duration-suggestion-badge';
    durationBadge.innerHTML = `
        <span class="duration-icon">⏱</span>
        <span class="duration-value">${recommendation.suggestedDuration} beats</span>
        <span class="duration-confidence">(${recommendation.durationConfidence}%)</span>
    `;
    durationBadge.title = recommendation.durationReason || 'Suggested duration';
    durationBadge.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: #6366f1;
        background: #eef2ff;
        padding: 2px 8px;
        border-radius: 4px;
        margin-top: 4px;
    `;

    card.appendChild(durationBadge);
}
```

#### 5.2 Duration Alternatives Dropdown
```javascript
// Optional: Show alternative durations

if (recommendation.durationAlternatives?.length > 0) {
    const altContainer = document.createElement('div');
    altContainer.className = 'duration-alternatives';
    altContainer.style.cssText = `
        display: flex;
        gap: 4px;
        margin-top: 4px;
        flex-wrap: wrap;
    `;

    recommendation.durationAlternatives.forEach(alt => {
        const altBtn = document.createElement('button');
        altBtn.textContent = `${alt.duration}b`;
        altBtn.title = alt.reason;
        altBtn.style.cssText = `
            font-size: 10px;
            padding: 2px 6px;
            border: 1px solid #e5e7eb;
            border-radius: 3px;
            background: white;
            cursor: pointer;
        `;
        altBtn.onclick = () => {
            // Apply this duration when chord is added
            recommendation.selectedDuration = alt.duration;
            // Update badge display
            durationBadge.querySelector('.duration-value').textContent = `${alt.duration} beats`;
        };
        altContainer.appendChild(altBtn);
    });

    card.appendChild(altContainer);
}
```

#### 5.3 Apply Duration on Add
```javascript
// When user clicks "Add to Progression"

const addChordWithDuration = (recommendation) => {
    const duration = recommendation.selectedDuration || recommendation.suggestedDuration;

    // Call existing add chord function with duration
    addChordToProgression({
        root: recommendation.root,
        type: recommendation.type,
        inversion: recommendation.inversion,
        beats: duration  // New: include duration
    });
};
```

#### 5.4 Recommendations Sidebar Display
**File:** `src/modules/ui/recommendationsSidebar.js`

Add compact duration indicator:
```javascript
// In formatRecommendationCard() or similar

if (rec.suggestedDuration) {
    const durationIndicator = document.createElement('span');
    durationIndicator.className = 'sidebar-duration';
    durationIndicator.textContent = `${rec.suggestedDuration}b`;
    durationIndicator.title = rec.durationReason;
    durationIndicator.style.cssText = `
        font-size: 10px;
        color: #8b5cf6;
        background: #f5f3ff;
        padding: 1px 4px;
        border-radius: 2px;
        margin-left: 4px;
    `;
    // Append to chord name area
}
```

#### 5.5 3D Explorer Modal
**File:** `src/modules/ui/chordExplorerModal.js`

Add duration column/indicator to the comprehensive view:
```javascript
// In table/grid rendering

// Add duration header
const durationHeader = document.createElement('th');
durationHeader.textContent = 'Duration';
durationHeader.title = 'Suggested chord duration in beats';
headerRow.appendChild(durationHeader);

// Add duration cell for each recommendation
const durationCell = document.createElement('td');
if (rec.suggestedDuration) {
    durationCell.innerHTML = `
        <strong>${rec.suggestedDuration}b</strong>
        <br>
        <small style="color: #6b7280;">${rec.durationConfidence}%</small>
    `;
} else {
    durationCell.textContent = '-';
}
row.appendChild(durationCell);
```

#### 5.6 Rhythmic Context Display Panel (Optional)
Add an expandable panel showing current rhythmic analysis:
```javascript
const createRhythmicContextPanel = (rhythmicContext) => {
    const panel = document.createElement('div');
    panel.className = 'rhythmic-context-panel';
    panel.innerHTML = `
        <div class="panel-header" style="cursor: pointer;">
            <span>📊 Rhythmic Context</span>
            <span class="toggle-icon">▼</span>
        </div>
        <div class="panel-content" style="display: none;">
            <div><strong>Avg Duration:</strong> ${rhythmicContext.averageDuration} beats</div>
            <div><strong>Trend:</strong> ${rhythmicContext.harmonicRhythmTrend}</div>
            <div><strong>Position:</strong> ${rhythmicContext.sectionPosition}</div>
            <div><strong>Pattern:</strong> ${rhythmicContext.detectedPattern?.name || 'None'}</div>
        </div>
    `;

    // Toggle expand/collapse
    panel.querySelector('.panel-header').onclick = () => {
        const content = panel.querySelector('.panel-content');
        const icon = panel.querySelector('.toggle-icon');
        const isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        icon.textContent = isHidden ? '▲' : '▼';
    };

    return panel;
};
```

### CSS Styles (Optional)
Add to stylesheet or inline:
```css
.duration-suggestion-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #6366f1;
    background: #eef2ff;
    padding: 2px 8px;
    border-radius: 4px;
    margin-top: 4px;
}

.duration-suggestion-badge:hover {
    background: #e0e7ff;
}

.duration-alternatives button:hover {
    background: #f3f4f6;
    border-color: #6366f1;
}

.rhythmic-context-panel {
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    margin: 8px 0;
    font-size: 12px;
}

.rhythmic-context-panel .panel-header {
    padding: 8px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.rhythmic-context-panel .panel-content {
    padding: 8px 12px;
    border-top: 1px solid #e5e7eb;
}
```

### Testing Checklist
- [ ] Duration badge displays on recommendation cards
- [ ] Tooltip shows duration reason on hover
- [ ] Alternative durations are clickable
- [ ] Selected duration persists when adding chord
- [ ] Sidebar shows compact duration indicator
- [ ] 3D explorer shows duration column
- [ ] Rhythmic context panel expands/collapses
- [ ] All displays respect rhythm awareness toggle
- [ ] No layout issues on mobile/tablet

---

## Future Enhancements (Post Phase 5)

### Potential Phase 6: Rhythm Pattern Library Integration
- Connect duration suggestions to `rhythmicPatterns.js` pattern library
- Suggest complete rhythm patterns (not just single durations)
- "Apply Pattern" button to set durations for multiple chords at once

### Potential Phase 7: Visual Rhythm Editor
- Timeline view showing chord durations
- Drag-to-resize chord durations
- Visual harmonic rhythm curve display
- Pattern detection visualization

### Potential Phase 8: Audio-Aware Rhythm
- Analyze imported audio for tempo/rhythm
- Sync suggestions to detected tempo
- Beat-grid alignment assistance

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/modules/features/rhythmicContextAnalyzer.js` | Core rhythm analysis engine |
| `src/modules/features/comprehensiveChordRecommendations.js` | Chord recommendation with duration |
| `src/modules/recommendations/coordination/SectionGenerator.js` | Section generation with duration arcs |
| `src/modules/integration/recommendationService.js` | Service layer integration |
| `src/modules/recommendations/core/CompositionContext.js` | Shared context (Phase 4) |
| `src/modules/features/chordBuilder.js` | Main chord builder UI (Phase 5) |
| `src/modules/ui/recommendationsSidebar.js` | Sidebar UI (Phase 5) |
| `src/modules/ui/chordExplorerModal.js` | 3D explorer UI (Phase 5) |
| `src/modules/ui/chordSuggestionModal.js` | Suggestion modal with toggle |
| `src/modules/features/rhythmicPatterns.js` | Existing rhythm pattern library |

---

## localStorage Keys

| Key | Default | Description |
|-----|---------|-------------|
| `chord-suggestion-rhythm-awareness` | `'true'` | Enable/disable duration suggestions |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `rhythmAwarenessChanged` | `{ enabled: boolean }` | Fired when toggle changes |
| `recommendationsUpdated` | `{ recommendations, ... }` | Includes duration data when enabled |

---

*Document created: Phase 1-3 implementation complete*
*Next: Phase 4 (CompositionContext) → Phase 5 (UI Display)*
