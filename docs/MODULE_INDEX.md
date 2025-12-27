# MODULE_INDEX.md

**Purpose:** Quick navigation guide for Claude Code to find the right code without reading entire files.

**Last Updated:** 2025-12-26

---

## 🎯 Entry Points (Start Here)

| File | Lines | Purpose | When to Use |
|------|-------|---------|-------------|
| [src/main.js](../src/main.js) | 8,407 | Window exports registry | Finding HTML event handlers, global function lookup |
| [src/modules/state/compositionState.js](../src/modules/state/compositionState.js) | 6,474 | **Single source of truth** for all composition data | Any chord/measure/note state questions |
| [src/modules/features/progressionBuilder.js](../src/modules/features/progressionBuilder.js) | 17,453 | Main progression UI | Progression builder tab features |

---

## 📁 Module Directory

### STATE - Data Management (6 files)
**Location:** `src/modules/state/`

**Purpose:** Single source of truth for application state. All composition data flows through here.

| File | Purpose | Key Exports |
|------|---------|-------------|
| `compositionState.js` ⭐ | Central state hub (chord progressions, measures, notes) | `CompositionState` class, `getCompositionState()` |
| `trainerState.js` | Progression Builder UI state (delegates data to compositionState) | `TrainerState` class, `getTrainerState()` |
| `builderState.js` | Chord Builder UI state | `BuilderState` class |
| `buildingBlock.js` | Musical time unit structure (48 units/beat) | `BuildingBlock`, `BuildingBlockSequence` |
| `globalState.js` | App-wide settings (tabs, enharmonic, dark mode) | `GlobalState` class |
| `scaleState.js`, `sectionIntentState.js` | Specialized state | Various getters/setters |

**When to Read:**
- Modifying chord progression data → `compositionState.js`
- UI state issues → `trainerState.js` or `builderState.js`
- Timing/rhythm calculations → `buildingBlock.js`

---

### FEATURES - Main Workflows (24 files)
**Location:** `src/modules/features/`

**Purpose:** User-facing composition tools and chord manipulation

#### Core Features (Read These First)
| File | Lines | Purpose |
|------|-------|---------|
| `progressionBuilder.js` ⭐ | 17,453 | **Main progression UI** - chord cards, playback, editing |
| `chordBuilder.js` | 3,600 | Chord construction tool (root, type, inversion, voicing) |
| `comprehensiveChordRecommendations.js` | 1,742 | Holistic chord suggestions with multi-factor scoring |
| `theoryTools.js` | 1,154 | Secondary dominants, modal interchange, borrowed chords |

#### Recommendation Engines (Multiple Systems - See Architecture Notes)
- `chordRecommendations.js` - Original recommendation engine (may be legacy)
- `comprehensiveChordRecommendations.js` - Enhanced multi-factor engine
- `chordSuggestionEngine.js` - Alternative engine
- `unifiedChordSuggestions.js` - Unified API layer

**⚠️ Note:** Multiple recommendation systems exist. Check `CoordinatedRecommendationService.js` in recommendations module for orchestration.

#### Specialized Tools
- `circleOfFifths.js` - Harmonic visualization
- `guitarFretboard.js` - Guitar chord diagrams
- `voiceLeadingOptimizer.js` - Smooth voice leading calculations
- `progressionTemplates.js` - Pre-built chord sequences
- `scaleExplorer.js` - Scale visualization
- `rhythmicPatterns.js`, `rhythmPatternLibrary.js` - Rhythm accompaniment

**When to Read:**
- Progression builder tab changes → `progressionBuilder.js`
- Chord suggestions → `comprehensiveChordRecommendations.js` (current) or check `recommendations/` module
- Theory transformations → `theoryTools.js`

---

### AI - Intelligent Composition (7 files)
**Location:** `src/modules/ai/`

**Purpose:** Melody generation and intelligent composition assistance

**Pipeline Flow:**
```
chordTimeline.js → melodySuggestion.js → enhancedMelodyController.js
                                       → sectionAwareMelodyGenerator.js
```

| File | Purpose | Key Functions |
|------|---------|---------------|
| `melodySuggestion.js` ⭐ | Core melody algorithm with genre/style awareness | `generateMelodySuggestions()` |
| `enhancedMelodyController.js` | High-level melody orchestration | `EnhancedMelodyController` class |
| `sectionAwareMelodyGenerator.js` | Context-aware generation (verse/chorus) | `generateSectionMelody()` |
| `melodicPhraseGenerator.js` | Phrase-level composition | `generatePhrase()` |
| `motifRecognition.js` | Theme identification and extension | `recognizeMotif()` |
| `autoHarmonize.js` | Automatic voice leading | `autoHarmonize()` |
| `chordTimeline.js` | Maps chords to time positions | `buildChordTimeline()` |

**When to Read:**
- Melody suggestion bugs → `melodySuggestion.js`
- Section-specific melody → `sectionAwareMelodyGenerator.js`

---

### ANALYSIS - Music Theory Analysis (5 files)
**Location:** `src/modules/analysis/`

**Purpose:** Harmonic analysis, pattern detection, tension planning

| File | Purpose | Key Exports |
|------|---------|-------------|
| `harmonyAnalyzer.js` | Identifies progression patterns (I-IV-V, ii-V-I) | `HarmonyAnalyzer` class, `COMMON_PROGRESSIONS` |
| `chordToneAnalyzer.js` | Analyzes notes relative to chord (for coloring) | `analyzeNoteAgainstChord()` |
| `TensionArcPlanner.js` | Plans harmonic tension curves | `TensionArcPlanner` class |
| `TensionOptimizer.js` | Optimizes tension flow | `TensionOptimizer` class |
| `patternDetection.js` | Generic pattern matching | `detectPattern()` |

**When to Read:**
- Progression analysis → `harmonyAnalyzer.js`
- Note highlighting/labeling → `chordToneAnalyzer.js`
- Tension optimization → `TensionArcPlanner.js`, `TensionOptimizer.js`

---

### AUDIO - Sound Synthesis (3 files)
**Location:** `src/modules/audio/`

**Purpose:** Tone.js audio playback and scheduling

| File | Purpose | Key Exports |
|------|---------|-------------|
| `audioEngine.js` ⭐ | **Critical**: Initializes instruments, manages audio context | `initializeAudio()`, `window.getPiano()`, `window.playChord()` |
| `melodyGenerator.js` | Schedules melody note playback | `playMelody()`, `scheduleMelody()` |
| `arpeggiator.js` | Sequential note playback | `playArpeggio()` |

**When to Read:**
- Audio not playing → `audioEngine.js`
- Melody playback timing → `melodyGenerator.js`

---

### NOTATION - VexFlow Rendering (13 files)
**Location:** `src/modules/notation/`

**Purpose:** Musical notation rendering and editing

#### Core Bridge (Critical!)
| File | Lines | Purpose |
|------|-------|---------|
| `composerIntegration.js` ⭐ | 3,057 | **NotationComposer class** - Bi-directional sync: compositionState ↔ VexFlow |
| `notationInit.js` | 1,234 | Initialization, `refreshNotationFromProgression()` |
| `grandStaff.js` | 4,308 | Grand staff rendering (treble + bass clefs) |
| `vexFlowRenderer.js` | 1,589 | Low-level VexFlow utilities |

#### Interactive Editing
- `noteEditor.js` (7,387 lines) - Interactive note placement on staff
- `notationToolbar.js` - Toolbar UI for notation editing
- `voiceLeadingOverlay.js` - Visual voice leading indicators

#### Layout & Pagination
- `pageManager.js`, `pageNavigator.js`, `pageLayoutManager.js` - Multi-page composition
- `staffLayouter.js` - Measure layout calculations
- `durationUtils.js`, `noteFormatter.js`, `pageConfig.js` - Utilities

**When to Read:**
- Notation not syncing → `composerIntegration.js`
- Rendering issues → `grandStaff.js` or `vexFlowRenderer.js`
- Note editing → `noteEditor.js`

**Critical Pattern:**
```javascript
// When chord progression changes:
syncProgressionToMelodyComposer();     // compositionState sync
refreshNotationFromProgression();       // VexFlow sync
```

---

### INTEGRATION - Cross-Module Sync (5 files)
**Location:** `src/modules/integration/`

**Purpose:** Connect modules that shouldn't directly depend on each other

| File | Purpose | Key Functions |
|------|---------|---------------|
| `melodyComposerBridge.js` | Syncs progression → melodySuggestion | `syncProgressionToMelodyComposer()` |
| `progressionNotationSync.js` | Bi-directional: progression ↔ notation | `syncProgressionToNotation()`, `syncNotationToProgression()` |
| `bassAutoFill.js` | Generates bass voicings from chords | `generateBassVoicing()` |
| `recommendationService.js` | Coordinates recommendation engines | `getRecommendations()` |
| `migrationHelper.js` | Data format migration | ⚠️ **Possibly unused** |

**When to Read:**
- Progression → notation sync issues → `progressionNotationSync.js`
- Melody suggestions not updating → `melodyComposerBridge.js`
- Bass generation → `bassAutoFill.js`

---

### UI - User Interface (41 files)
**Location:** `src/modules/ui/`

**Purpose:** UI components, modals, panels, event handlers

#### Core UI Management
| File | Purpose |
|------|---------|
| `tabs.js` | Tab switching (Builder, Trainer, Melody Composer, Learn) |
| `header.js` | Key signature, tempo, title display |
| `sidebar.js` | Settings panel |
| `keyboard.js` | Virtual piano keyboard |
| `modals.js` | Modal dialog system |

#### Modals & Panels (20+ files)
- `recommendations/UnifiedRecommendationModal.js` (15,489 lines) ⭐ **HUGE** - Main recommendation UI
- `chordSuggestionModal.js` - Chord suggestion picker
- `chordComparisonModal.js` - Side-by-side chord analysis
- `autoHarmonizeModal.js` - Voice leading suggestions
- `tensionOptimizerModal.js` - Harmonic tension editor
- `settingsModal.js` - Global settings
- `recommendationsPanel.js`, `unifiedSuggestionsPanel.js` - Sidebars
- `templateBrowserModal.js` - Song template browser
- `songBuilder.js`, `songwritingWizard.js` - Composition wizards
- `theoryInsightsPanel.js` - Educational insights display
- `interactiveTutorial.js` (5,486 lines) - Tutorial system
- `lessonGuidedMode.js`, `lessonViewer.js` - Learning mode

#### Specialized UI
- `sectionDragDrop.js` - Song structure editor
- `sectionIntentUI.js` - Intent selector (verse/chorus)
- `learningProgress.js` - Progress tracking
- `presetUI.js` - Preset manager

**When to Read:**
- Modal/panel UI bugs → Find specific modal file
- Tab switching → `tabs.js`
- Keyboard display → `keyboard.js`

⚠️ **Note:** Heavy use of `window.*` globals from `main.js`. Check there for event handler connections.

---

### CANVAS - Notation Canvas Suggestions (9 files)
**Location:** `src/modules/canvas/suggestions/`

**Purpose:** Inline suggestion system (alternative to modals/sidebars)

**Status:** Phase 1 foundation complete, awaiting full integration

```
canvas/suggestions/
├── CanvasSuggestionManager.js     - Main controller
├── SmartPositioner.js             - Placement algorithm
├── GhostNoteRenderer.js           - Preview rendering
├── KeyboardHandler.js             - Keyboard shortcuts
├── config/
│   ├── FeatureFlags.js            - Feature toggles
│   └── SuggestionConfig.js        - Configuration
├── components/
│   ├── ChordPalette.js            - Chord palette UI
│   ├── FloatingPalette.js         - Floating palette base
│   ├── MelodyPalette.js           - Melody palette UI
│   └── SectionIntentSelector.js   - Section intent picker
└── engines/
    ├── ChordSuggestionEngine.js
    └── MelodySuggestionEngine.js
```

**When to Read:**
- Canvas suggestion feature work → Start with `CanvasSuggestionManager.js`

---

### RECOMMENDATIONS - Unified Coordination (8+ files)
**Location:** `src/modules/recommendations/`

**Purpose:** Orchestrates multiple recommendation engines (Phase 5/6)

```
recommendations/
├── index.js                       - Module exports & init
├── core/
│   └── CompositionContext.js      - Shared context for all engines
├── coordination/
│   ├── CoordinatedRecommendationService.js - Main orchestrator
│   ├── UserPreferenceLearner.js   - Learns from user choices
│   └── SectionGenerator.js        - Complete section generation
└── harmony/
    └── index.js                   - SmartHarmonizer, CounterMelodyGenerator, BassLineGenerator
```

**Relationship to Features Module:**
- `CoordinatedRecommendationService` wraps/orchestrates engines from `features/` module
- Creates unified API for recommendations

**When to Read:**
- Understanding recommendation architecture → `CoordinatedRecommendationService.js`
- User preference learning → `UserPreferenceLearner.js`

---

### TEACHING - Educational Features (6 files)
**Location:** `src/modules/teaching/`

**Purpose:** Learning progression and contextual teaching

| File | Purpose |
|------|---------|
| `theoryMoments.js` | Contextual teaching popups |
| `theoryOverlay.js` | Visual theory overlays |
| `whyThisWorksEnhanced.js` | Explanation system for suggestions |
| `compositionInsights.js` | Learning analytics |
| `insightsStorage.js` | Persists insights data |
| `theoryMomentsConfig.js` | Teaching content configuration |

---

### STORAGE - Persistence (6 files)
**Location:** `src/modules/storage/`

**Purpose:** Save/load, auto-save, presets, version history

| File | Purpose |
|------|---------|
| `projectManager.js` | Save/load .musiclab files |
| `autoSave.js` | Auto-save to localStorage |
| `presetManager.js` | Weight/setting presets |
| `versionHistory.js` | Undo/redo system |
| `exportImport.js` | Import/export functionality |
| `storageUtils.js` | Helper functions |

---

### UTILS - Shared Utilities (4 files)
**Location:** `src/modules/utils/`

| File | Purpose | Key Functions |
|------|---------|---------------|
| `noteUtils.js` | Note operations (octave, enharmonic spelling) | `spellNoteInKey()`, `transposeNote()` |
| `romanNumerals.js` | Roman numeral conversion | `getRomanNumeral()` |
| `voiceLeading.js` | Voice leading calculations | `calculateVoiceLeadingDistance()` |
| `eventEmitter.js` | Custom event system | `EventEmitter` class |

---

### EXPORT - Audio & Document Export (2 files)
**Location:** `src/modules/export/`

| File | Lines | Purpose |
|------|-------|---------|
| `exportService.js` | 2,718 | PDF/MusicXML export orchestration |
| `audioExporter.js` | 891 | Audio file rendering (WAV/MP3) |

---

### CONFIG - Configuration (1 file)
**Location:** `src/modules/config/`

| File | Purpose |
|------|---------|
| `weightPresets.js` | Recommendation scoring weight presets |

---

## 🔄 Critical Data Flow Patterns

### Pattern 1: Chord Progression Update
```
User Action (progressionBuilder.js)
    ↓
compositionState.setProgressionData()
    ↓
syncProgressionToMelodyComposer()      [integration/melodyComposerBridge.js]
    ↓
refreshNotationFromProgression()        [notation/notationInit.js]
    ↓
NotationComposer.render()              [notation/composerIntegration.js]
```

### Pattern 2: Recommendation Request
```
User clicks "Suggestions" (progressionBuilder.js)
    ↓
comprehensiveChordRecommendations.getRecommendations()
    OR
CoordinatedRecommendationService.getRecommendations()
    ↓
UnifiedRecommendationModal.show()      [ui/recommendations/UnifiedRecommendationModal.js]
    ↓
User selects chord
    ↓
compositionState.updateChord() → cascade updates
```

### Pattern 3: Melody Generation
```
User requests melody (progressionBuilder.js or noteEditor.js)
    ↓
chordTimeline.buildChordTimeline()
    ↓
melodySuggestion.generateMelodySuggestions()
    ↓
sectionAwareMelodyGenerator.generateSectionMelody()
    ↓
enhancedMelodyController.applyMelody()
    ↓
compositionState.measures (treble clef update)
    ↓
refreshNotationFromProgression()
```

---

## 🚨 Known Architectural Issues

### Issue 1: Multiple Recommendation Systems
**Files Involved:**
- `features/chordRecommendations.js` (620 lines) - Original
- `features/comprehensiveChordRecommendations.js` (1,742 lines) - Enhanced
- `features/unifiedChordSuggestions.js` (389 lines) - Unified API
- `recommendations/coordination/CoordinatedRecommendationService.js` - Orchestrator

**Impact:** Logic duplication, unclear which is authoritative
**When Adding Features:** Check all four files or risk inconsistency

---

### Issue 2: progressionBuilder.js Monolith (17,453 lines)
**What It Does:**
- UI rendering (chord cards)
- State updates
- Playback control
- Recommendation triggers
- User input handling
- Export functionality

**Impact:** Hard to navigate, circular dependency risk
**Recommendation:** Split into:
- `progressionRenderer.js` - UI rendering
- `progressionController.js` - State management
- `progressionPlayback.js` - Audio control

---

### Issue 3: UI Module Explosion (41 files)
**Problem:** Single-purpose modals proliferate, heavy use of `window.*` globals

**Examples:**
- `chordSuggestionModal.js`
- `chordComparisonModal.js`
- `autoHarmonizeModal.js`
- `tensionOptimizerModal.js`
- `templateBrowserModal.js`

**Impact:** Maintenance burden, code duplication
**Recommendation:** Consolidate into component framework

---

### Issue 4: Incomplete Canvas Migration
**Status:** Phase 1 foundation complete but not fully integrated

**Files:**
- `canvas/suggestions/*` - New inline system (ready but unused)
- `ui/recommendations/*` - Old modal/sidebar system (still active)

**Impact:** Two systems to maintain
**Next Step:** Complete canvas integration, deprecate old modals

---

### Issue 5: Potential Dead Code
**Candidates for Removal:**
- `integration/migrationHelper.js` - No imports found
- `audio/arpeggiator.js` - Only used in chordBuilder, could be internal
- `features/chordRecommendations.js` - Possibly superseded by comprehensive version

**Action Required:** Audit imports before removing

---

## 📋 Quick Reference: Where to Look

| Task | Primary File | Related Files |
|------|--------------|---------------|
| **Chord progression data** | `state/compositionState.js` | `state/trainerState.js` |
| **Progression UI** | `features/progressionBuilder.js` | `ui/recommendations/UnifiedRecommendationModal.js` |
| **Chord suggestions** | `features/comprehensiveChordRecommendations.js` | `recommendations/coordination/CoordinatedRecommendationService.js` |
| **Notation rendering** | `notation/composerIntegration.js` | `notation/grandStaff.js`, `notation/notationInit.js` |
| **Note editing** | `notation/noteEditor.js` | `notation/notationToolbar.js` |
| **Melody generation** | `ai/melodySuggestion.js` | `ai/enhancedMelodyController.js`, `ai/sectionAwareMelodyGenerator.js` |
| **Audio playback** | `audio/audioEngine.js` | `audio/melodyGenerator.js` |
| **Theory analysis** | `analysis/harmonyAnalyzer.js` | `analysis/chordToneAnalyzer.js` |
| **Bass generation** | `integration/bassAutoFill.js` | `state/compositionState.js` |
| **Window exports** | `main.js` | (HTML event handlers) |
| **Progression sync** | `integration/progressionNotationSync.js` | `integration/melodyComposerBridge.js` |
| **Save/Load** | `storage/projectManager.js` | `storage/autoSave.js` |
| **Educational features** | `teaching/theoryMoments.js` | `teaching/whyThisWorksEnhanced.js` |

---

## 💡 Tips for Claude Code

1. **Start with MODULE_INDEX.md** (this file) to find the right module
2. **Check API_REFERENCE.md** for function signatures without reading full files
3. **Consult STATE_MANAGEMENT.md** for data flow questions
4. **Read CLAUDE.md** for critical patterns (chord type naming, inversion handling, enharmonic spelling)
5. **Use `main.js`** to trace HTML event handlers to implementation
6. **When in doubt**, check `compositionState.js` - it's the data hub

---

**Next Steps for Codebase Improvement:**
1. Create `API_REFERENCE.md` for key function signatures
2. Create `STATE_MANAGEMENT.md` for data flow diagrams
3. Audit dead code (see Issue 5 above)
4. Propose `progressionBuilder.js` refactoring plan
5. Enhance `CLAUDE.md` with Quick Start guides
