# Phase 2: Real-Time Chord Recommendations While Composing
## Smart Composition Assistant

**Start Date**: 2025-11-15
**Estimated Duration**: 3-4 weeks
**Status**: 🚀 **PLANNING**

---

## Executive Summary

Phase 2 transforms the Melody Composer into an intelligent composition assistant by bringing the powerful chord recommendation engine directly into the notation view. Composers can now see, preview, and insert chord suggestions in real-time while working on their composition, without switching between tabs.

---

## Phase 1 Completion Summary

### ✅ What We Built (Phase 1A-C)

**Phase 1A: Data Architecture**
- CompositionState centralized data model
- Event system for bi-directional sync
- Bass auto-fill algorithms (5 patterns)
- Voice leading calculations

**Phase 1B: UI Integration**
- Bridge layer for progression ↔ composition sync
- Bass pattern dropdown with live preview
- Auto-generate toggle with state management
- Tab initialization and sync

**Phase 1C: Visualization & UX**
- Bass rendering on staff with VexFlow
- Blue color coding for auto-generated notes
- Proper note spacing and clef detection
- All 5 bass patterns working correctly:
  - Whole-note (voice-led)
  - Root-fifth (actual roots)
  - Arpeggio (ascending pitch order)
  - Alberti (lowest-highest-middle-highest)
  - Walking bass (smooth stepwise motion)

**Round 4 Bug Fixes**:
- ✅ Fourth note spacing in first measure
- ✅ Toggle state respected when adding chords
- ✅ Root-fifth pattern uses actual chord roots
- ✅ Arpeggio pattern sorted by pitch
- ✅ Walking bass smooth transitions
- ✅ Regenerate button moved to discrete link

### 📊 Phase 1 Metrics

| Metric | Achievement |
|--------|-------------|
| Lines of code written | ~4,200+ |
| Bass patterns implemented | 5/5 |
| Bugs fixed in Round 4 | 6 critical issues |
| Data architecture completeness | 100% |
| UI integration completeness | 100% |
| Visualization completeness | 100% |
| User-facing features | Auto-generate toggle, pattern selector, regenerate |

---

## Phase 2 Vision

### The Problem We're Solving

**Current workflow** (cumbersome):
1. User composes in Melody Composer
2. Wants to add/change a chord
3. Switches to Progression Builder tab
4. Reviews recommendations
5. Adds chord
6. Switches back to Melody Composer
7. Sees result (with auto-generated bass)

**Phase 2 workflow** (seamless):
1. User composes in Melody Composer
2. Sees chord recommendations **in sidebar** (always visible)
3. Clicks recommended chord to insert
4. Bass auto-generates immediately
5. Continues composing without tab switching

### Key Benefits

1. **No context switching** - Everything in one view
2. **Real-time feedback** - See recommendations update as you compose
3. **Faster workflow** - Click to insert instead of tab switching
4. **Visual harmony analysis** - See chord functions and voice leading scores
5. **Smarter composition** - AI suggestions while you work

---

## Phase 2 Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Melody Composer Tab                     │
├─────────────────────────┬───────────────────────────────┤
│                         │                               │
│  Chord Recommendations  │    Notation Staff             │
│  Sidebar (NEW)          │    (Existing)                 │
│                         │                               │
│  ┌──────────────────┐  │    ┌──────────────────────┐   │
│  │ Next Chord:      │  │    │  ╔═══╦═══╦═══╦═══╗   │   │
│  │                  │  │    │  ║ C │ F │ G │ C ║   │   │
│  │ 🎵 IV (F)   92%  │  │    │  ╚═══╩═══╩═══╩═══╝   │   │
│  │ 🎵 V  (G)   88%  │  │    │  ────────────────────  │   │
│  │ 🎵 vi (Am)  85%  │  │    │  ⚌ ⚌ ⚌ ⚌ (bass)      │   │
│  │ 🎵 ii (Dm)  78%  │  │    └──────────────────────┘   │
│  │ 🎵 I  (C)   70%  │  │                               │
│  │                  │  │    Controls:                  │
│  │ [Show More...]   │  │    [Pattern ▼] [Toggle]      │
│  └──────────────────┘  │                               │
│                         │                               │
│  Current Analysis:      │                               │
│  Key: C Major           │                               │
│  Last: I → ?            │                               │
│                         │                               │
└─────────────────────────┴───────────────────────────────┘
```

### Data Flow

```
User composes → CompositionState updated
                      ↓
            Chord Analysis Engine
                      ↓
       ┌──────────────┴──────────────┐
       ↓                              ↓
Recommendation Engine          Harmony Analyzer
(existing)                     (existing)
       ↓                              ↓
Top 5-10 Chords                Chord Functions
Voice Leading Scores           Modal Interchange
       ↓                              ↓
       └──────────────┬──────────────┘
                      ↓
            Sidebar Component (NEW)
                      ↓
       User clicks suggestion
                      ↓
       addChordToProgression()
                      ↓
       syncProgressionToMelodyComposer()
                      ↓
       Bass auto-generates
                      ↓
       Staff re-renders
```

---

## Phase 2 Breakdown

### Phase 2.1: Sidebar UI Component (Week 1)

**Goal**: Create the visual container for chord recommendations

#### 2.1.1 HTML Structure

**File**: `index.html`

Add sidebar to Melody Composer section:

```html
<!-- Melody Composer Tab Content -->
<div id="melody-composer-tab" class="tab-content">
    <div class="flex gap-3">
        <!-- NEW: Recommendations Sidebar -->
        <div id="chord-recommendations-sidebar" class="w-64 flex-shrink-0 bg-white rounded-lg border border-violet-200 p-4">
            <h3 class="text-sm font-bold text-violet-800 mb-3">Chord Suggestions</h3>

            <!-- Current Context -->
            <div class="bg-violet-50 rounded p-2 mb-3 text-xs">
                <div class="flex justify-between">
                    <span class="text-gray-600">Key:</span>
                    <span id="current-key-display" class="font-semibold">C Major</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-600">Last Chord:</span>
                    <span id="last-chord-display" class="font-semibold">I (C)</span>
                </div>
            </div>

            <!-- Recommendations List -->
            <div id="recommendations-list" class="space-y-2">
                <!-- Will be populated by JavaScript -->
            </div>

            <button id="refresh-recommendations-btn" class="mt-3 w-full text-xs text-blue-600 hover:text-blue-800">
                Refresh Suggestions
            </button>
        </div>

        <!-- Existing: Notation Area -->
        <div class="flex-1">
            <!-- Existing melody composer content -->
        </div>
    </div>
</div>
```

#### 2.1.2 CSS Styling

**File**: Create `src/styles/recommendations-sidebar.css`

```css
/* Chord Recommendations Sidebar */
.chord-recommendation-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
    background: white;
    cursor: pointer;
    transition: all 0.15s ease;
}

.chord-recommendation-item:hover {
    background: #f3f4f6;
    border-color: #8b5cf6;
    transform: translateX(2px);
}

.chord-recommendation-item.selected {
    background: #ede9fe;
    border-color: #8b5cf6;
}

.chord-info {
    display: flex;
    align-items: center;
    gap: 8px;
}

.chord-symbol {
    font-weight: 600;
    font-size: 14px;
    color: #1f2937;
}

.chord-function {
    font-size: 11px;
    color: #6b7280;
    font-weight: 500;
}

.chord-score {
    display: flex;
    align-items: center;
    gap: 4px;
}

.score-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
}

.score-excellent {
    background: #dcfce7;
    color: #16a34a;
}

.score-good {
    background: #dbeafe;
    color: #2563eb;
}

.score-fair {
    background: #fef3c7;
    color: #d97706;
}

.voice-leading-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
}

.vl-excellent { background: #16a34a; }
.vl-good { background: #2563eb; }
.vl-fair { background: #d97706; }
.vl-poor { background: #dc2626; }
```

#### 2.1.3 Recommendation Item Template

**Function**: `renderRecommendationItem()`

```javascript
// src/modules/ui/recommendationsSidebar.js

/**
 * Render a single chord recommendation item
 * @param {object} recommendation - Chord recommendation with score
 * @returns {HTMLElement} DOM element for the recommendation
 */
function renderRecommendationItem(recommendation) {
    const item = document.createElement('div');
    item.className = 'chord-recommendation-item';
    item.dataset.chordRoot = recommendation.chord.root;
    item.dataset.chordType = recommendation.chord.type;

    // Score classification
    const scoreClass = recommendation.totalScore >= 85 ? 'excellent' :
                      recommendation.totalScore >= 70 ? 'good' : 'fair';

    const vlClass = recommendation.voiceLeadingScore >= 85 ? 'excellent' :
                   recommendation.voiceLeadingScore >= 70 ? 'good' :
                   recommendation.voiceLeadingScore >= 50 ? 'fair' : 'poor';

    item.innerHTML = `
        <div class="chord-info">
            <span class="chord-symbol">${recommendation.chord.root}${getChordSuffix(recommendation.chord.type)}</span>
            <span class="chord-function">${recommendation.function || ''}</span>
        </div>
        <div class="chord-score">
            <div class="voice-leading-indicator vl-${vlClass}"
                 title="Voice Leading: ${recommendation.voiceLeadingScore}%"></div>
            <span class="score-badge score-${scoreClass}">${Math.round(recommendation.totalScore)}%</span>
        </div>
    `;

    // Click handler
    item.addEventListener('click', () => {
        insertChordFromRecommendation(recommendation);
    });

    return item;
}

/**
 * Get chord suffix for display (m, 7, dim, etc.)
 */
function getChordSuffix(type) {
    const suffixes = {
        'Major': '',
        'Minor': 'm',
        'Diminished': 'dim',
        'Augmented': 'aug',
        'Major7': 'maj7',
        'Minor7': 'm7',
        'Dominant7': '7',
        'Diminished7': 'dim7',
        'HalfDiminished7': 'm7♭5'
    };
    return suffixes[type] || '';
}
```

**Deliverables**:
- ✅ Sidebar HTML structure
- ✅ CSS styling for recommendations
- ✅ Recommendation item rendering
- ✅ Hover and click interactions
- ✅ Score visualization (percentage + color coding)
- ✅ Voice leading indicator (colored dot)

---

### Phase 2.2: Recommendation Engine Integration (Week 2)

**Goal**: Connect existing recommendation engine to sidebar

#### 2.2.1 Recommendation Service

**File**: Create `src/modules/integration/recommendationService.js`

```javascript
/**
 * Recommendation Service
 *
 * Bridges the existing chord recommendation engine with the
 * real-time composition workflow.
 */

import { getProgressionData } from '../features/progressionBuilder.js';
import { calculateNextChordRecommendations } from '../features/chordRecommendations.js';

export class RecommendationService {
    constructor(compositionState) {
        this.compositionState = compositionState;
        this.recommendations = [];
        this.currentKey = 'C';

        // Listen for composition changes
        this.setupListeners();
    }

    setupListeners() {
        // Update recommendations when progression changes
        if (this.compositionState) {
            this.compositionState.on('measureAdded', () => {
                this.refreshRecommendations();
            });

            this.compositionState.on('measureUpdated', () => {
                this.refreshRecommendations();
            });
        }
    }

    /**
     * Get current chord recommendations
     * @param {number} limit - Number of recommendations to return
     * @returns {Array} Top N chord recommendations
     */
    getRecommendations(limit = 5) {
        const progressionData = getProgressionData();

        if (!progressionData || progressionData.length === 0) {
            // No progression yet - suggest common starting chords
            return this.getStarterChords(limit);
        }

        // Get last chord in progression
        const lastChord = progressionData[progressionData.length - 1];

        // Use existing recommendation engine
        const allRecommendations = calculateNextChordRecommendations(
            lastChord,
            progressionData,
            this.currentKey
        );

        // Sort by total score and return top N
        const sorted = allRecommendations.sort((a, b) => b.totalScore - a.totalScore);
        return sorted.slice(0, limit);
    }

    /**
     * Get starter chord suggestions for empty progression
     */
    getStarterChords(limit = 5) {
        const key = this.currentKey;

        // Common starting chords in any key
        return [
            { chord: { root: key, type: 'Major' }, function: 'I', totalScore: 95, voiceLeadingScore: 90 },
            { chord: { root: getScaleDegree(key, 5), type: 'Major' }, function: 'V', totalScore: 85, voiceLeadingScore: 85 },
            { chord: { root: getScaleDegree(key, 4), type: 'Major' }, function: 'IV', totalScore: 80, voiceLeadingScore: 80 },
            { chord: { root: getScaleDegree(key, 6), type: 'Minor' }, function: 'vi', totalScore: 75, voiceLeadingScore: 75 },
            { chord: { root: getScaleDegree(key, 2), type: 'Minor' }, function: 'ii', totalScore: 70, voiceLeadingScore: 70 }
        ].slice(0, limit);
    }

    /**
     * Refresh recommendations based on current state
     */
    refreshRecommendations() {
        this.recommendations = this.getRecommendations();

        // Dispatch event for UI to update
        window.dispatchEvent(new CustomEvent('recommendations-updated', {
            detail: { recommendations: this.recommendations }
        }));
    }

    /**
     * Set the current key for recommendations
     */
    setKey(key) {
        this.currentKey = key;
        this.refreshRecommendations();
    }
}

/**
 * Helper: Get scale degree note in key
 */
function getScaleDegree(key, degree) {
    const scaleMap = {
        'C': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
        'G': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
        'D': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
        'F': ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
        // ... add all keys
    };

    const scale = scaleMap[key] || scaleMap['C'];
    return scale[(degree - 1) % 7];
}

// Global instance
let recommendationServiceInstance = null;

export function initRecommendationService(compositionState) {
    recommendationServiceInstance = new RecommendationService(compositionState);
    return recommendationServiceInstance;
}

export function getRecommendationService() {
    return recommendationServiceInstance;
}
```

#### 2.2.2 Sidebar Controller

**File**: Create `src/modules/ui/recommendationsSidebarController.js`

```javascript
/**
 * Recommendations Sidebar Controller
 *
 * Manages the sidebar UI and interactions
 */

import { getRecommendationService } from '../integration/recommendationService.js';
import { renderRecommendationItem, getChordSuffix } from './recommendationsSidebar.js';
import { addChordToProgressionByParams } from '../features/progressionBuilder.js';

export class RecommendationsSidebarController {
    constructor() {
        this.container = document.getElementById('recommendations-list');
        this.currentKeyDisplay = document.getElementById('current-key-display');
        this.lastChordDisplay = document.getElementById('last-chord-display');
        this.refreshBtn = document.getElementById('refresh-recommendations-btn');

        this.setupListeners();
        this.updateDisplay();
    }

    setupListeners() {
        // Listen for recommendation updates
        window.addEventListener('recommendations-updated', (event) => {
            this.renderRecommendations(event.detail.recommendations);
        });

        // Refresh button
        if (this.refreshBtn) {
            this.refreshBtn.addEventListener('click', () => {
                const service = getRecommendationService();
                if (service) {
                    service.refreshRecommendations();
                }
            });
        }
    }

    /**
     * Render recommendations to sidebar
     */
    renderRecommendations(recommendations) {
        if (!this.container) return;

        // Clear existing
        this.container.innerHTML = '';

        if (!recommendations || recommendations.length === 0) {
            this.container.innerHTML = '<p class="text-xs text-gray-500">No suggestions available</p>';
            return;
        }

        // Render each recommendation
        recommendations.forEach((rec, index) => {
            const item = renderRecommendationItem(rec);
            this.container.appendChild(item);
        });

        // Update context display
        this.updateContextDisplay();
    }

    /**
     * Update current key and last chord display
     */
    updateContextDisplay() {
        const service = getRecommendationService();
        if (!service) return;

        // Update key
        if (this.currentKeyDisplay) {
            this.currentKeyDisplay.textContent = service.currentKey + ' Major';
        }

        // Update last chord
        const progressionData = getProgressionData();
        if (this.lastChordDisplay && progressionData && progressionData.length > 0) {
            const lastChord = progressionData[progressionData.length - 1];
            const chordName = lastChord.root + getChordSuffix(lastChord.type);
            this.lastChordDisplay.textContent = chordName;
        } else if (this.lastChordDisplay) {
            this.lastChordDisplay.textContent = '(none)';
        }
    }

    /**
     * Initial display
     */
    updateDisplay() {
        const service = getRecommendationService();
        if (service) {
            const recommendations = service.getRecommendations();
            this.renderRecommendations(recommendations);
        }
    }
}

/**
 * Insert chord from recommendation
 */
export function insertChordFromRecommendation(recommendation) {
    // Add chord to progression using existing function
    addChordToProgressionByParams(
        recommendation.chord.root,
        recommendation.chord.type,
        0, // inversion
        null // notes (will be auto-generated)
    );

    // The progression sync will handle:
    // 1. Adding measure to CompositionState
    // 2. Generating bass (if toggle ON)
    // 3. Re-rendering staff
    // 4. Updating recommendations
}

// Initialize on page load
let sidebarController = null;

export function initRecommendationsSidebar() {
    sidebarController = new RecommendationsSidebarController();
    return sidebarController;
}
```

**Deliverables**:
- ✅ RecommendationService class
- ✅ Integration with existing recommendation engine
- ✅ Event-based updates
- ✅ Sidebar controller with rendering
- ✅ Click-to-insert functionality
- ✅ Current context display

---

### Phase 2.3: Real-Time Analysis Display (Week 3)

**Goal**: Show harmony analysis and insights

#### 2.3.1 Harmony Analyzer

**File**: Create `src/modules/analysis/harmonyAnalyzer.js`

```javascript
/**
 * Harmony Analyzer
 *
 * Analyzes chord progressions for:
 * - Chord functions (I, IV, V, etc.)
 * - Modal interchange
 * - Common patterns (ii-V-I, etc.)
 */

export class HarmonyAnalyzer {
    /**
     * Analyze chord function in key
     */
    static analyzeChordFunction(chord, key) {
        // Determine scale degree and quality
        const scaleDegree = getScaleDegree(chord.root, key);
        const quality = chord.type;

        // Major key functions
        const majorFunctions = {
            1: { quality: 'Major', symbol: 'I', name: 'Tonic' },
            2: { quality: 'Minor', symbol: 'ii', name: 'Supertonic' },
            3: { quality: 'Minor', symbol: 'iii', name: 'Mediant' },
            4: { quality: 'Major', symbol: 'IV', name: 'Subdominant' },
            5: { quality: 'Major', symbol: 'V', name: 'Dominant' },
            6: { quality: 'Minor', symbol: 'vi', name: 'Submediant' },
            7: { quality: 'Diminished', symbol: 'vii°', name: 'Leading Tone' }
        };

        const expected = majorFunctions[scaleDegree];

        if (expected && expected.quality === quality) {
            // Diatonic chord
            return {
                degree: scaleDegree,
                symbol: expected.symbol,
                name: expected.name,
                diatonic: true,
                modalInterchange: false
            };
        } else {
            // Modal interchange or chromatic
            return {
                degree: scaleDegree,
                symbol: this.getModalInterchangeSymbol(scaleDegree, quality),
                name: 'Borrowed',
                diatonic: false,
                modalInterchange: true
            };
        }
    }

    /**
     * Detect common progressions
     */
    static detectProgressionPattern(chords, key) {
        if (chords.length < 2) return null;

        const functions = chords.map(c => this.analyzeChordFunction(c, key));

        // ii-V-I
        if (this.matchesPattern(functions, ['ii', 'V', 'I'])) {
            return { name: 'ii-V-I', type: 'cadence', strength: 'strong' };
        }

        // I-V-vi-IV (pop progression)
        if (this.matchesPattern(functions, ['I', 'V', 'vi', 'IV'])) {
            return { name: 'Pop Progression', type: 'common', strength: 'medium' };
        }

        // V-I (authentic cadence)
        if (this.matchesPattern(functions, ['V', 'I'])) {
            return { name: 'Authentic Cadence', type: 'cadence', strength: 'strong' };
        }

        return null;
    }

    static matchesPattern(functions, pattern) {
        if (functions.length < pattern.length) return false;
        const tail = functions.slice(-pattern.length);
        return tail.every((f, i) => f.symbol === pattern[i]);
    }

    static getModalInterchangeSymbol(degree, quality) {
        // Simplified - would need full implementation
        const symbols = {
            'Major': ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'],
            'Minor': ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'],
            'Diminished': ['i°', 'ii°', 'iii°', 'iv°', 'v°', 'vi°', 'vii°']
        };
        return symbols[quality][degree - 1] || '?';
    }
}

function getScaleDegree(noteRoot, key) {
    const chromatic = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const keyIndex = chromatic.indexOf(key);
    const noteIndex = chromatic.indexOf(noteRoot);

    if (keyIndex === -1 || noteIndex === -1) return 1;

    const distance = (noteIndex - keyIndex + 12) % 12;
    const degreeMap = [1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 7]; // Approximate
    return degreeMap[distance];
}
```

#### 2.3.2 Analysis Display Component

Add to sidebar below recommendations:

```html
<!-- Analysis Panel -->
<div id="harmony-analysis-panel" class="mt-4 pt-3 border-t border-gray-200">
    <h4 class="text-xs font-bold text-violet-800 mb-2">Harmony Analysis</h4>

    <div id="progression-pattern" class="text-xs mb-2">
        <!-- e.g., "ii-V-I Cadence detected" -->
    </div>

    <div id="modal-interchange-indicator" class="text-xs">
        <!-- e.g., "Using borrowed chord from parallel minor" -->
    </div>
</div>
```

**Deliverables**:
- ✅ HarmonyAnalyzer class
- ✅ Chord function detection
- ✅ Modal interchange detection
- ✅ Common pattern recognition
- ✅ Analysis display in sidebar

---

### Phase 2.4: Polish & Testing (Week 4)

**Goal**: Refine UX and ensure quality

#### 2.4.1 Features to Add

1. **Preview on Hover**
   - Hover over recommendation → highlight what would change
   - Show bass pattern that would be generated
   - Audio preview on hover (optional)

2. **Keyboard Shortcuts**
   - `1-5` keys to insert top 5 recommendations
   - `R` to refresh recommendations
   - `Esc` to dismiss preview

3. **Recommendation Explanations**
   - Tooltip showing why chord is recommended
   - "Strong voice leading", "Common in jazz", etc.

4. **Settings**
   - Number of recommendations to show (5/10/15)
   - Auto-refresh on/off
   - Recommendation weights (use existing weight system)

#### 2.4.2 Testing Checklist

- ✅ Sidebar appears on Melody Composer tab
- ✅ Recommendations update when chord added
- ✅ Click recommendation inserts chord
- ✅ Bass auto-generates with inserted chord
- ✅ Voice leading scores accurate
- ✅ Chord functions display correctly
- ✅ Modal interchange detected
- ✅ Works with empty progression
- ✅ Works with 1, 4, 8, 16 chord progressions
- ✅ Performance: <100ms recommendation update
- ✅ No memory leaks from event listeners
- ✅ Responsive layout (sidebar collapses on mobile)

---

## Success Criteria

### Functional Requirements
- ✅ Sidebar displays top 5 chord recommendations
- ✅ Recommendations update in real-time (<100ms)
- ✅ Click recommendation inserts chord + auto-generates bass
- ✅ Voice leading scores accurate (within 5% of Progression Builder)
- ✅ Chord functions displayed (I, IV, V, etc.)
- ✅ Modal interchange detected and shown
- ✅ Works for empty progressions (starter chords)

### User Experience
- ✅ No tab switching needed to add chords
- ✅ Visual feedback on hover
- ✅ Clear score indicators (color-coded)
- ✅ Keyboard shortcuts work
- ✅ Responsive design (works on tablet/desktop)

### Technical
- ✅ Integrates with existing recommendation engine
- ✅ Uses existing bass auto-fill system
- ✅ Event-driven architecture (no polling)
- ✅ <100ms recommendation calculation time
- ✅ Clean separation of concerns (service/controller/view)

---

## Files to Create/Modify

### New Files
| File | Purpose | Lines (est.) |
|------|---------|--------------|
| `src/modules/integration/recommendationService.js` | Recommendation engine integration | ~200 |
| `src/modules/ui/recommendationsSidebar.js` | Sidebar rendering functions | ~150 |
| `src/modules/ui/recommendationsSidebarController.js` | Sidebar controller logic | ~200 |
| `src/modules/analysis/harmonyAnalyzer.js` | Harmony analysis | ~150 |
| `src/styles/recommendations-sidebar.css` | Sidebar styling | ~100 |
| `docs/phase-2-plan.md` | This document | ~1000 |
| `docs/phase-2-test-guide.md` | Testing guide | ~300 |

**Total**: ~2,100 lines

### Modified Files
| File | Changes | Lines (est.) |
|------|---------|--------------|
| `index.html` | Add sidebar structure | +50 |
| `src/modules/integration/melodyComposerBridge.js` | Initialize recommendation service | +20 |
| `src/modules/features/tabs.js` | Initialize sidebar on tab load | +15 |

**Total**: ~85 lines modified

---

## Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| **Week 1** | 2.1: Sidebar UI | HTML structure, CSS, rendering functions |
| **Week 2** | 2.2: Engine Integration | RecommendationService, sidebar controller, click-to-insert |
| **Week 3** | 2.3: Analysis Display | Harmony analyzer, function display, pattern detection |
| **Week 4** | 2.4: Polish & Testing | Hover preview, keyboard shortcuts, testing, docs |

---

## Risk Mitigation

### Risk: Performance with large progressions
**Mitigation**: Cache recommendations, debounce updates, lazy calculation

### Risk: Recommendation engine not accessible from notation view
**Mitigation**: Already using global functions in `chordRecommendations.js`, can import directly

### Risk: UI clutter on smaller screens
**Mitigation**: Collapsible sidebar, responsive design, hide on mobile by default

### Risk: User confusion about recommendation scores
**Mitigation**: Color coding, tooltips explaining scores, visual voice leading indicators

---

## Future Enhancements (Phase 3+)

1. **Inline Chord Suggestions** (Phase 2.5)
   - Hover over empty measure → see suggestion bubble
   - Click to insert without going to sidebar

2. **Customizable Recommendation Weights** (Phase 2.5)
   - Expose existing weight sliders in sidebar
   - "More jazzy", "More classical" presets

3. **Audio Preview** (Phase 3)
   - Hover → hear chord with current bass pattern
   - Before inserting

4. **AI-Powered Suggestions** (Phase 4)
   - Learn from user's composition style
   - Suggest melody notes based on chord

5. **Chord Voicing Editor** (Phase 3)
   - Click chord in sidebar → adjust voicing
   - Drag notes to change inversion

---

## Phase 2 Completion Checklist

Before marking Phase 2 complete:
- ✅ All 4 sub-phases delivered
- ✅ Test guide completed
- ✅ User testing with 5+ real progressions
- ✅ Documentation updated
- ✅ No critical bugs
- ✅ Performance metrics met (<100ms updates)
- ✅ Code review completed
- ✅ Git commit with detailed message

---

**Status**: 🚀 **READY TO START**

Let's build an intelligent composition assistant that makes creating music faster, smarter, and more enjoyable!

**Next Step**: Implement Phase 2.1 - Sidebar UI Component
