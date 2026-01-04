# Measure Isolation Editor - Recommendation Integration Plan

## Overview

This plan outlines the integration of our **existing** recommendation engines into the Measure Isolation Editor. The goal is to bring intelligent, contextual suggestions directly into the detailed note editing workflow by **leveraging infrastructure we've already built**.

---

## CRITICAL: Existing Infrastructure to Leverage

**DO NOT create new engines from scratch.** We have extensive recommendation infrastructure already built:

### 1. RecommendationService (`src/modules/integration/recommendationService.js`)
The central coordination hub with Phase 5 cross-engine integration:
- `getRecommendationService()` - Singleton accessor
- `getRecommendations(progression, key)` - Main recommendation method
- `recordUserChoice(recommendation)` - Preference learning
- `getSectionGenerator()` - Complete section generation
- `getUserStyleProfile()` - Learned user preferences
- Integrates with: `CompositionContext`, `CoordinatedRecommendationService`, `UserPreferenceLearner`, `SectionGenerator`

### 2. Comprehensive Chord Recommendations (`src/modules/features/comprehensiveChordRecommendations.js`)
- `generateComprehensiveRecommendations()` - 3D scoring system with:
  - Voice leading analysis
  - Section context awareness
  - Tension arc integration
  - Rhythmic awareness for duration suggestions
  - Style/mood preferences

### 3. Enhanced Voice Leading (`src/modules/features/enhancedVoiceLeading.js`)
- `scoreEnhancedVoiceLeading(currentMidi, nextMidi, key, options)` - Full voice leading analysis
- `scoreVoiceLeadingQuick(currentMidi, nextMidi)` - Fast lightweight scoring
- `detectParallelMotion(currentMidi, nextMidi)` - Parallel 5ths/octaves detection
- `detectVoiceCrossing(currentMidi, nextMidi)` - Voice crossing check
- `checkTendencyToneResolution(currentMidi, nextMidi, key)` - Leading tone resolution
- `analyzeLeapRecovery(currentMidi, nextMidi, previousMidi)` - Leap recovery analysis
- `analyzeSopranoContour(currentMidi, nextMidi)` - Melodic contour analysis

### 4. Bass Auto-Fill (`src/modules/integration/bassAutoFill.js`)
- `generateBuildingBlockBass(chord, previousChord, totalBeats, options)` - Main bass generation (~4400 lines)
- `generateBassVoicing(chord, previousChord, options)` - Single chord voicing
- `generateBassRhythm(chord, timeSignature, style)` - Rhythm patterns
- `splitBlockBassIntoMeasures(blockNotes, startBeat, beatsPerMeasure, chordIndex)` - Measure splitting
- `BASS_PATTERN_OCTAVE_DEFAULTS` - Pattern configuration

### 5. Chord Tone Analyzer (`src/modules/analysis/chordToneAnalyzer.js`)
- `analyzeChordTone(note, chord)` - Note relationship analysis
- `getChordTones(chord)` - Get chord tones
- `CHORD_TONE_COLORS` - Harmonic coloring
- `NOTE_RELATIONSHIPS` - Relationship types

### 6. Harmony Analyzer (`src/modules/analysis/harmonyAnalyzer.js`)
- `HarmonyAnalyzer` class - Full progression analysis
- `analyzeProgression(progression, key)` - Pattern detection

### 7. Tension Arc System (`src/modules/analysis/TensionArcPlanner.js`)
- `TensionArcPlanner` - Tension trajectory planning
- `TensionOptimizer` - Optimization for tension curves

---

## Part 1: Measure Isolation Editor Integration

### Current State Analysis

**File:** `src/modules/notation/measureIsolation/MeasureIsolationEditor.js` (~3,900 lines)

**Current Capabilities:**
- Slot grid system (8 slots per beat) for precise note placement
- Multi-measure display (1-3 measures with prev/next navigation)
- Harmonic coloring via `chordToneAnalyzer` (already imported)
- Rich context available: `measureChord`, `currentKey`, `compositionState`
- Entry Mode vs Select Mode with keyboard shortcuts
- Multi-voice support (V1/V2 per clef)

**Available Context Data:**
- `this.currentKey` - Key signature (C, G, F#, etc.)
- `this.measureChord` - Current chord (root, type, inversion, notes)
- `this.compositionState` - Full composition state with all measures
- `this.slotGrid` - Current notes being edited
- `this.centerMeasureIndex` - Which measure is being edited
- `this.visibleMeasureIndices` - All visible measures (1-3)

**Extension Points:**
- After toolbar, before staves (best location for panel)
- `_placeNote()` function - hook after note placement
- `_handleCanvasClick()` - hook for preview suggestions
- `_renderStaves()` - called after every change

---

### Proposed UI: Smart Suggestions Panel

**Location:** Collapsible panel between toolbar and staves (~60-80px height)

```
┌─ Measure Editor - Measure 3 ─────────────────────────────────────────┐
│ [Toolbar: Duration, Accidentals, Voice, etc.]                        │
├─ 💡 Smart Suggestions ───────────────────────────── [▼ Collapse] ────┤
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐ │
│  │ Chord Tones │ │ Scale Tones │ │ Tensions    │ │ Bass Patterns   │ │
│  │ [C] [E] [G] │ │ [D][F][A][B]│ │ [Bb][D#]    │ │ [Root-5th    ▼] │ │
│  │  ●   ●   ●  │ │  ○  ○  ○  ○ │ │  ◐   ◐     │ │ [Apply Pattern] │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│ [Treble Staff Canvas]                                                │
│ [Bass Staff Canvas]                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

**Behavior:**
- Panel updates when center measure changes (new chord context)
- Panel updates when clef focus changes (treble vs bass suggestions)
- Clicking a chord/scale tone button places note at current cursor position
- Bass pattern dropdown shows available patterns; Apply fills visible measures
- Panel is collapsible to maximize staff space when not needed

---

### Implementation Phases

#### Phase 1: UI Panel Infrastructure
**Effort:** Medium | **Priority:** P1

**Tasks:**
1. Add collapsible panel HTML after toolbar in `_createModalHTML()`
2. Add panel state tracking (`this.suggestionsPanelExpanded`)
3. Add collapse/expand toggle button
4. Style panel to match modal aesthetic
5. Add placeholder sections for each suggestion type

**Files to Modify:**
- `MeasureIsolationEditor.js` - Add panel HTML and state

---

#### Phase 2: Chord Tone Integration
**Effort:** Low | **Priority:** P1

**Tasks:**
1. Import `getChordTones()` from `chordToneAnalyzer.js` (already imported for coloring)
2. Generate chord tone buttons when measure chord changes
3. Each button shows pitch name with harmonic color coding
4. Click button → place note at current slot position with appropriate octave
5. Show octave indicator (e.g., "C4" vs "C5") based on clef

**Files to Modify:**
- `MeasureIsolationEditor.js` - Add chord tone button generation and handlers

---

#### Phase 3: Scale Tone Integration
**Effort:** Low | **Priority:** P1

**Tasks:**
1. Import `getScaleTones()` from `chordToneAnalyzer.js`
2. Generate scale tone buttons (non-chord tones from key)
3. Color-code as "scale tones" (orange in current scheme)
4. Click behavior same as chord tones

**Files to Modify:**
- `MeasureIsolationEditor.js` - Add scale tone section

---

#### Phase 4: Tension/Extension Integration
**Effort:** Medium | **Priority:** P2

**Tasks:**
1. Create new function `getAvailableTensions(chord, style)` in `chordToneAnalyzer.js`
2. Return extensions based on chord type (7ths, 9ths, 11ths, 13ths)
3. Filter by style (jazz allows more, pop fewer)
4. Display as third button group with distinct color (purple)

**Files to Modify:**
- `chordToneAnalyzer.js` - Add `getAvailableTensions()` function
- `MeasureIsolationEditor.js` - Add tensions section

---

#### Phase 5: Bass Pattern Integration
**Effort:** Medium | **Priority:** P1

**Tasks:**
1. Import bass patterns from `bassAutoFill.js`
2. Add dropdown with pattern options: Root, Root-5th, Walking, Alberti, Arpeggio, etc.
3. "Apply Pattern" button fills bass clef for visible measures
4. Add "Preview" option to hear pattern before applying
5. Respect existing bass notes - option to overwrite or merge

**Files to Modify:**
- `MeasureIsolationEditor.js` - Add bass pattern UI and handlers
- `bassAutoFill.js` - May need to add measure-range generation

---

#### Phase 6: Next Note Suggestions (LEVERAGE EXISTING ENGINES)
**Effort:** Medium | **Priority:** P2

**EXISTING ENGINES TO USE:**
- `scoreEnhancedVoiceLeading()` from `enhancedVoiceLeading.js` - scores note transitions
- `analyzeSopranoContour()` from `enhancedVoiceLeading.js` - melodic contour analysis
- `analyzeLeapRecovery()` from `enhancedVoiceLeading.js` - leap recovery suggestions
- `analyzeChordTone()` from `chordToneAnalyzer.js` - chord tone relationship

**Tasks:**
1. Import existing voice leading functions into MeasureIsolationEditor
2. Create thin wrapper `_suggestNextNotes()` that:
   - Gets candidate pitches (stepwise + chord tones)
   - Uses `scoreEnhancedVoiceLeading()` to rank each candidate
   - Uses `analyzeChordTone()` to boost chord tone scores
   - Uses `analyzeSopranoContour()` for direction continuity
3. Display as small chips below the selected note info
4. Keyboard shortcut to accept top suggestion (e.g., Tab)

**Files to Modify:**
- `MeasureIsolationEditor.js` - Add wrapper method and UI (NO new functions needed in other files)

---

#### Phase 7: Voice Leading Warnings (LEVERAGE EXISTING ENGINES)
**Effort:** Low-Medium | **Priority:** P2

**EXISTING ENGINES TO USE:**
- `detectParallelMotion()` from `enhancedVoiceLeading.js` - parallel 5ths/octaves
- `detectVoiceCrossing()` from `enhancedVoiceLeading.js` - voice crossing detection
- `checkTendencyToneResolution()` from `enhancedVoiceLeading.js` - leading tone resolution
- `analyzeLeapRecovery()` from `enhancedVoiceLeading.js` - large leap handling

**Tasks:**
1. Import existing voice leading detection functions into MeasureIsolationEditor
2. After note placement, call detection functions:
   - `detectParallelMotion()` for parallel issues
   - `detectVoiceCrossing()` for crossing issues
   - `checkTendencyToneResolution()` for unresolved tendencies
3. Display warnings in status area with specific issue type
4. Optionally highlight problematic notes on canvas
5. Use `scoreEnhancedVoiceLeading()` to suggest better alternatives

**Files to Modify:**
- `MeasureIsolationEditor.js` - Add checks and UI (all functions already exist!)

---

#### Phase 8: Melodic Pattern Suggestions (LEVERAGE EXISTING ENGINES)
**Effort:** Medium | **Priority:** P3

**EXISTING ENGINES TO USE:**
- `HarmonyAnalyzer` from `harmonyAnalyzer.js` - progression pattern detection
- `analyzeSopranoContour()` from `enhancedVoiceLeading.js` - melodic contour
- `RecommendationService.getUserStyleProfile()` - learned user preferences
- `TensionArcPlanner` from `TensionArcPlanner.js` - tension trajectory

**Tasks:**
1. Create thin wrapper `_analyzeMelodicContext()` that uses existing analyzers
2. Analyze existing notes in measure using:
   - `analyzeSopranoContour()` for current melodic direction
   - `HarmonyAnalyzer` for harmonic context
3. Generate pattern suggestions based on contour + chord context
4. Display as "Continue melody" suggestions
5. One-click to apply suggested pattern

**Files to Modify:**
- `MeasureIsolationEditor.js` - Add wrapper and UI (reuse existing analysis engines)

---

### Multi-Measure Considerations

The panel must work smoothly with 1-3 visible measures:

**Single Measure:**
- Suggestions based on that measure's chord
- Bass patterns fill just that measure

**Multiple Measures:**
- Suggestions update based on CENTER measure (the one being actively edited)
- Bass patterns can fill all visible measures or just center
- Add toggle: "Apply to all visible" vs "Apply to center only"
- Chord context shown for each visible measure in panel header

**Implementation:**
```javascript
_updateSuggestionsForVisibleMeasures() {
  const centerChord = this.measureChord;
  const prevChord = this.visibleMeasureIndices.includes(this.centerMeasureIndex - 1)
    ? this.compositionState.getMeasure(this.centerMeasureIndex - 1)?.chord
    : null;
  const nextChord = this.visibleMeasureIndices.includes(this.centerMeasureIndex + 1)
    ? this.compositionState.getMeasure(this.centerMeasureIndex + 1)?.chord
    : null;

  // Update panel with context-aware suggestions
  this._renderChordTones(centerChord);
  this._renderScaleTones(this.currentKey, centerChord);
  this._renderBassPatterns(centerChord, this.visibleMeasureIndices.length);
}
```

---

## Part 2: Engine Integration Details (NOT New Engines)

> **IMPORTANT:** This section describes how to INTEGRATE existing engines into MeasureIsolationEditor,
> NOT create new ones. The implementations below are thin wrappers around existing functionality.

### 2.1 Chord Tone Analyzer - Already Complete

**File:** `src/modules/analysis/chordToneAnalyzer.js`

**Already provides:**
- `getChordTones(chord)` - Returns chord tones ✅
- `analyzeChordTone(note, chord)` - Returns relationship type ✅
- `CHORD_TONE_COLORS` - Color mapping ✅

**No new functions needed.** MeasureIsolationEditor Phase 2 already uses these.

---

### 2.2 Next Note Suggestions - Use Existing Voice Leading

**DO NOT create `suggestNextNotes()` in chordToneAnalyzer.js.**

Instead, create a thin wrapper in MeasureIsolationEditor:

```javascript
// In MeasureIsolationEditor.js
_suggestNextNotes(fromPitch, chord, key, options = {}) {
    const { maxInterval = 7, count = 5 } = options;

    // Use EXISTING functions:
    import { scoreEnhancedVoiceLeading, analyzeSopranoContour }
        from '../../features/enhancedVoiceLeading.js';
    import { analyzeChordTone } from '../../analysis/chordToneAnalyzer.js';

    // Generate candidates (simple pitch generation)
    const candidates = this._generateCandidatePitches(fromPitch, maxInterval);

    // Score using EXISTING voice leading engine
    const scored = candidates.map(candidate => {
        const vlScore = scoreEnhancedVoiceLeading(
            [this._pitchToMidi(fromPitch)],
            [this._pitchToMidi(candidate)],
            key
        );
        const toneRelationship = analyzeChordTone(candidate, chord);
        const isChordTone = toneRelationship.relationship === 'chord_tone';

        return {
            pitch: candidate,
            score: vlScore.totalScore + (isChordTone ? 20 : 0),
            reason: isChordTone ? 'Chord tone' : 'Scale tone',
            voiceLeadingScore: vlScore.totalScore
        };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, count);
}
```

**Priority:** P2 | **Effort:** Low (just wrapping existing functions)

---

### 2.3 Tension/Extension Buttons - Simple Lookup

**DO NOT create complex `getAvailableTensions()` function.**

Use simple chord type → tension mapping in MeasureIsolationEditor:

```javascript
// In MeasureIsolationEditor.js
_getAvailableTensions(chord) {
    // Simple mapping - no new engine needed
    const TENSIONS_BY_TYPE = {
        'Major': ['9', '#11', '13'],
        'Major 7th': ['9', '#11', '13'],
        'Minor': ['9', '11', '13'],
        'Minor 7th': ['9', '11', '13'],
        'Dominant 7th': ['b9', '9', '#9', '#11', 'b13', '13'],
        'Diminished': ['9', '11', 'b13'],
        'Half-Diminished 7th': ['9', '11', '13'],
    };

    return TENSIONS_BY_TYPE[chord.type] || ['9', '11', '13'];
}
```

**Priority:** P2 | **Effort:** Very Low (simple data lookup)

---

### 2.4 Bass Auto-Fill - Already Extensive

**File:** `src/modules/integration/bassAutoFill.js` (~4,400 lines!)

**Already provides:**
- `generateBuildingBlockBass(chord, previousChord, totalBeats, options)` - Main generation ✅
- `generateBassVoicing(chord, previousChord, options)` - Single chord voicing ✅
- `generateBassRhythm(chord, timeSignature, style)` - Rhythm patterns ✅
- `splitBlockBassIntoMeasures()` - Measure splitting ✅
- `BASS_PATTERN_OCTAVE_DEFAULTS` - Pattern config ✅

**Phase 4 already uses this.** MeasureIsolationEditor imports and uses these functions.

**For partial measure filling:** Use existing `generateBuildingBlockBass()` with appropriate
beat count, then slice the result. No new function needed.

**Priority:** Already implemented | **Effort:** N/A

---

### 2.5 Melodic Pattern Analysis - Use Existing Analyzers

**DO NOT create new `melodicPatternEngine.js`.**

Use existing analyzers in MeasureIsolationEditor:

```javascript
// In MeasureIsolationEditor.js
_analyzeMelodicContext(notes) {
    // Use EXISTING analyzers:
    import { analyzeSopranoContour } from '../../features/enhancedVoiceLeading.js';
    import { getHarmonyAnalyzer } from '../../analysis/harmonyAnalyzer.js';

    if (notes.length < 2) return null;

    // Get contour from existing function
    const lastTwoMidi = notes.slice(-2).map(n => this._pitchToMidi(n.pitch));
    const contour = analyzeSopranoContour(lastTwoMidi[0], lastTwoMidi[1]);

    // Simple interval pattern extraction
    const intervals = [];
    for (let i = 1; i < notes.length; i++) {
        intervals.push(this._pitchToMidi(notes[i].pitch) - this._pitchToMidi(notes[i-1].pitch));
    }

    return {
        contour: contour.direction,
        intervals: intervals,
        lastPitch: notes[notes.length - 1].pitch,
        // Use contour info to suggest next direction
        suggestedDirection: contour.isLargeLeap ? 'stepwise_recovery' : 'continue'
    };
}
```

**Priority:** P3 | **Effort:** Low (wrapper around existing analyzers)

---

### 2.6 Voice Leading Checks - Use Existing Detection Functions

**DO NOT create new `checkNoteAgainstContext()` function.**

Use existing detection functions in MeasureIsolationEditor:

```javascript
// In MeasureIsolationEditor.js
_checkVoiceLeadingIssues(newNote, existingNotes, previousMeasure) {
    // Use EXISTING detection functions:
    import {
        detectParallelMotion,
        detectVoiceCrossing,
        checkTendencyToneResolution,
        analyzeLeapRecovery,
        scoreEnhancedVoiceLeading
    } from '../../features/enhancedVoiceLeading.js';

    const issues = [];
    const newMidi = this._pitchToMidi(newNote);

    // Check parallels with each existing voice
    existingNotes.forEach((note, i) => {
        const existingMidi = this._pitchToMidi(note.pitch);
        const parallelResult = detectParallelMotion([existingMidi], [newMidi]);
        if (parallelResult.hasParallelFifths || parallelResult.hasParallelOctaves) {
            issues.push({
                type: parallelResult.hasParallelFifths ? 'parallel_fifth' : 'parallel_octave',
                severity: 'warning',
                withVoice: i === 0 ? 'bass' : `voice ${i}`
            });
        }
    });

    // Check voice crossing
    existingNotes.forEach((note, i) => {
        const crossingResult = detectVoiceCrossing(
            [this._pitchToMidi(note.pitch)],
            [newMidi]
        );
        if (crossingResult.hasCrossing) {
            issues.push({ type: 'voice_crossing', severity: 'info', withVoice: i });
        }
    });

    // Get overall score using existing function
    const vlScore = scoreEnhancedVoiceLeading(
        existingNotes.map(n => this._pitchToMidi(n.pitch)),
        [newMidi],
        this.currentKey
    );

    return { issues, score: vlScore.totalScore };
}
```

**All detection functions already exist!** Just wire them together in MeasureIsolationEditor.

**Priority:** P2 | **Effort:** Low (just calling existing functions)

---

### 2.7 Comprehensive Chord Recommendations - Already Has Melody Awareness

**File:** `src/modules/features/comprehensiveChordRecommendations.js`

**Already provides:**
- Voice leading scoring ✅
- Section context awareness ✅
- Tension arc integration ✅
- Rhythmic awareness ✅
- Style/mood preferences ✅

**For melody compatibility:** The existing `generateComprehensiveRecommendations()` already
supports melody-aware scoring through its voice leading analysis. If needed, add
`melodyNotes` parameter to existing function rather than creating new engine.

**Priority:** Future enhancement | **Effort:** Low (extend existing function)

---

### 2.8 NO New Unified Service Needed

**DO NOT create new `measureRecommendationService.js`.**

We already have `RecommendationService` in `src/modules/integration/recommendationService.js`
that provides:
- Coordinated recommendations
- User preference learning
- Section generation
- Cross-engine integration

**For Measure Editor:** Add methods directly to MeasureIsolationEditor class that
call existing services. No new service layer needed.

---

## Part 3: Implementation Priority Summary

> **KEY PRINCIPLE:** All features use EXISTING engines. Effort is LOW because we're
> just wiring existing functionality into MeasureIsolationEditor, not building new engines.

### Phase 1 (High Priority - Immediate Value) ✅ COMPLETE

| Task | Status | Effort | Existing Engine Used |
|------|--------|--------|---------------------|
| UI Panel Infrastructure | ✅ Done | Medium | N/A (new UI only) |
| Chord Tone Buttons | ✅ Done | Low | `getChordTones()` from chordToneAnalyzer |
| Scale Tone Buttons | ✅ Done | Low | Custom `_getScaleTonesForKey()` |
| Bass Pattern Dropdown | ✅ Done | Low | `generateBuildingBlockBass()` from bassAutoFill |
| Tension/Extension Buttons | ✅ Done | Very Low | Simple data lookup (no engine needed) |

### Phase 2 (Medium Priority - Enhanced Experience) ✅ COMPLETE

| Task | Status | File(s) | Effort | Existing Engine Used |
|------|--------|---------|--------|---------------------|
| Next Note Suggestions | ✅ Done | MeasureIsolationEditor.js | Low | `scoreVoiceLeadingQuick()`, chord tone detection |
| Voice Leading Warnings | ✅ Done | MeasureIsolationEditor.js | Low | `detectParallelMotion()`, `detectVoiceCrossing()`, `checkTendencyToneResolution()` |

### Phase 3 (Lower Priority - Advanced Features)

| Task | File(s) | Effort | Existing Engine Used |
|------|---------|--------|---------------------|
| Melodic Pattern Suggestions | MeasureIsolationEditor.js | Low | `analyzeSopranoContour()`, `HarmonyAnalyzer` |
| Melody-Aware Chord Recs | Future | Low | Extend `generateComprehensiveRecommendations()` |

### Summary of Engines Being Leveraged

| Engine | Source File | Used In Phases |
|--------|-------------|----------------|
| `getChordTones()` | chordToneAnalyzer.js | Phase 2 ✅ |
| `analyzeChordTone()` | chordToneAnalyzer.js | Phases 2, 6, 7 |
| `generateBuildingBlockBass()` | bassAutoFill.js | Phase 4 ✅ |
| `scoreEnhancedVoiceLeading()` | enhancedVoiceLeading.js | Phases 6, 7 |
| `detectParallelMotion()` | enhancedVoiceLeading.js | Phase 7 |
| `detectVoiceCrossing()` | enhancedVoiceLeading.js | Phase 7 |
| `checkTendencyToneResolution()` | enhancedVoiceLeading.js | Phase 7 |
| `analyzeLeapRecovery()` | enhancedVoiceLeading.js | Phases 6, 7 |
| `analyzeSopranoContour()` | enhancedVoiceLeading.js | Phases 6, 8 |
| `HarmonyAnalyzer` | harmonyAnalyzer.js | Phase 8 |
| `RecommendationService` | recommendationService.js | Future |
| `TensionArcPlanner` | TensionArcPlanner.js | Future |

---

## Part 4: Technical Notes

### Dependencies

The Measure Isolation Editor already imports:
- `chordToneAnalyzer.js` - For harmonic coloring ✅
- `compositionState` - Full composition access ✅
- `bassAutoFill.js` - For bass patterns ✅ (added in Phase 4)

Imports needed for remaining phases:
- `enhancedVoiceLeading.js` - For voice leading checks (Phase 6-7)

**NO NEW MODULES TO CREATE.** All functionality exists in existing files.

### Performance Considerations

1. **Debounce suggestions** - Don't recalculate on every mouse move
2. **Cache chord tones** - Same chord = same tones, no recalc needed
3. **Lazy load patterns** - Load bass patterns on demand, not at modal open
4. **Virtualize long lists** - If suggestions exceed 10 items, virtualize

### Accessibility

1. **Keyboard navigation** - All suggestions reachable via keyboard
2. **Screen reader labels** - Descriptive labels for suggestion buttons
3. **Focus management** - Return focus appropriately after actions
4. **Color + icons** - Don't rely on color alone for meaning

---

## Part 5: Success Metrics

### User Experience Goals

1. **Reduced time to find right note** - Chord/scale tones visible, one-click
2. **Fewer voice leading errors** - Warnings before committing
3. **Faster bass writing** - Pattern fill vs note-by-note
4. **Better melodic flow** - Intelligent next-note suggestions
5. **Educational value** - Users learn theory through suggestions

### Technical Goals

1. **< 100ms suggestion update** - Fast enough to feel instant
2. **No scroll jank** - Panel doesn't cause layout thrash
3. **Works with 1-3 measures** - Seamless multi-measure support
4. **Graceful degradation** - Works if engines unavailable

---

*Document created: January 4, 2026*
*Last updated: January 4, 2026*
*Status: ✅ ALL PHASES COMPLETE (1-8)*
*Version: 2.3*

## Changelog

### v2.3 (January 4, 2026)
- **ALL PHASES COMPLETE** ✅
- Marked Phase 8 (Melodic Pattern Suggestions) as complete
  - Added `_analyzeMelodicContour()` - analyzes notes in focused clef for melodic direction
  - Added `_renderMelodicPatterns()` - renders pattern buttons (leap recovery, continue step, chord tone, tonic return)
  - Added `_applyMelodicPattern()` - places suggested note at next available slot
  - Added "Melody Pattern" section in Smart Suggestions panel with contour indicator
  - Updates on modal open, clef focus change, note placement, and note deletion
- Changed Entry Mode default to OFF for safer editing
- Added musical context hints that render directly on selected notes:
  - Leading tone → tonic (e.g., "→ C")
  - Scale degree 4 → mediant (e.g., "↓ E?")
  - Tritone → resolution (e.g., "⟷ resolve")
  - Non-chord tones (NCT label)

### v2.2 (January 4, 2026)
- Marked Phase 7 (Voice Leading Warnings) as complete
  - Uses `detectParallelMotion()` for parallel 5ths/octaves detection
  - Uses `detectVoiceCrossing()` for voice crossing detection
  - Uses `checkTendencyToneResolution()` for tendency tone analysis
  - Warnings shown in status bar and toast notifications
- Added hint text in Tensions section when no note selected ("Select a note to see next note suggestions")

### v2.1 (January 4, 2026)
- Marked Phase 5 (Tension/Extension Buttons) as complete
- Marked Phase 6 (Next Note Suggestions) as complete
  - Uses `scoreVoiceLeadingQuick()` from enhancedVoiceLeading.js
  - Adds chord tone bonus scoring
  - Tab key shortcut to accept top suggestion
  - Suggestions appear when note is selected, hidden on deselect

### v2.0 (January 4, 2026)
- **MAJOR UPDATE:** Rewrote plan to leverage existing recommendation engines
- Added "CRITICAL: Existing Infrastructure to Leverage" section
- Updated all phases to use existing functions instead of creating new engines
- Removed proposals for new files (`melodicPatternEngine.js`, `measureRecommendationService.js`)
- Added engine usage summary table
- Marked Phases 1-4 as complete
- Reduced effort estimates (all phases now Low effort since using existing code)

### v1.0 (January 4, 2026)
- Initial plan created
