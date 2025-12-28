# Phase 2 Migration Plan - UnifiedRecommendationModal.js

**Date:** 2025-12-28
**File:** `src/modules/ui/recommendations/UnifiedRecommendationModal.js`
**Size:** 15,489 lines
**Strategy:** Bottom-up migration with hybrid delegation (proven in Phase 1)

---

## 📊 ANALYSIS SUMMARY

**Current State:**
- **2 exported functions** (showUnifiedRecommendationModal, closeUnifiedRecommendationModal)
- **150+ internal functions** handling UI rendering, data processing, audio playback
- **30+ state variables** in modalState object
- **20+ external dependencies**
- **5 major tabs:** Chord, Melody, Section, Harmonize, Polyphony

**Code Breakdown:**
- UI Rendering: ~45 functions (~7,000 lines)
- Audio/Playback: ~6 functions (~500 lines)
- Data Processing: ~12 functions (~1,500 lines)
- Music Math/Utilities: ~20 functions (~500 lines)
- Event Handling: ~8 functions (~400 lines)
- Scoring/Tooltips: ~10 functions (~800 lines)
- Data Generation: ~9 functions (~900 lines)
- Harmonic Analysis: ~5 functions (~600 lines)

---

## 🎯 PROPOSED MODULE STRUCTURE

Split into **12 focused modules** (~1,300 lines each average):

```
ui/recommendations/UnifiedRecommendationModal/
├── index.js (~400 lines)
│   - Main entry point
│   - Re-exports all functions
│   - Window exports (if needed)
│   - Modal initialization and cleanup
│   - EXPORTS: showUnifiedRecommendationModal(), closeUnifiedRecommendationModal()
│
├── ModalStructure.js (~800 lines)
│   - Modal container creation
│   - Tab navigation UI
│   - Header and context bar
│   - Persistent progression bar
│   - EXPORTS: createModalStructure(), createHeader(), createTabNavigation(), etc.
│
├── ModalState.js (~400 lines)
│   - modalState object management
│   - State persistence (localStorage)
│   - State initialization
│   - EXPORTS: getModalState(), updateModalState(), saveModalState(), etc.
│
├── ChordTab.js (~2,500 lines)
│   - Chord tab main renderer
│   - Intent navigation (6 intents)
│   - Intent content dispatchers
│   - EXPORTS: renderChordTab(), createChordIntentNav(), renderChordIntentContent(), etc.
│
├── ChordViews.js (~2,000 lines)
│   - Quick suggestions view
│   - Explorer view (multi-filter)
│   - Sequences view
│   - Recommendation card creation
│   - EXPORTS: renderQuickSuggestionsView(), renderExplorerView(), renderSequencesView(), createRecommendationCard()
│
├── ChordIntents.js (~2,000 lines)
│   - Suggest intent (quick + explorer)
│   - Compare intent (alternatives)
│   - Transform intent (progression transformation)
│   - Optimize intent (tension arc)
│   - Sequence intent (multi-chord)
│   - Advanced intent (borrowed, secondary dominants, chromatic mediants)
│   - EXPORTS: renderSuggestIntent(), renderCompareIntent(), renderTransformIntent(), etc.
│
├── MelodyTab.js (~1,800 lines)
│   - Melody tab main renderer
│   - Notes view (individual note suggestions)
│   - Phrases view (melodic phrase generation)
│   - Melody suggestion generation
│   - Phrase candidate display
│   - EXPORTS: renderMelodyTab(), renderMelodyNotesView(), renderMelodyPhrasesView(), etc.
│
├── SectionTab.js (~1,000 lines)
│   - Section generation interface
│   - Section type selectors
│   - Section generation logic
│   - Fallback generators
│   - Section preview display
│   - EXPORTS: renderSectionTab(), handleGenerateSectionClick(), displaySectionOptionsPreview(), etc.
│
├── HarmonizeTab.js (~700 lines)
│   - Auto-harmonization interface
│   - Style/section selectors
│   - Harmonization suggestions
│   - Bass pattern application
│   - EXPORTS: renderHarmonizeTab(), createTextureRecommendationsDisplay(), etc.
│
├── PolyphonyTab.js (~1,500 lines)
│   - Polyphony/texture tab
│   - Texture type selectors
│   - Bass pattern selectors
│   - Polyphony preview rendering
│   - Texture note generation
│   - EXPORTS: renderPolyphonyTab(), generateTextureNotes(), updatePolyphonyPreview(), etc.
│
├── AudioPlayback.js (~600 lines)
│   - Audio context management
│   - Chord playback (hold-to-play)
│   - Sequence playback
│   - Phrase playback
│   - Polyphony preview playback
│   - EXPORTS: playChord(), stopChord(), playChordSequence(), playPhrase(), etc.
│
└── MusicUtils.js (~700 lines)
    - Music math utilities
    - Pitch conversion (MIDI, note names)
    - Scale operations
    - Interval calculations
    - Note validation
    - Score tooltips
    - EXPORTS: transposePitch(), pitchToMidi(), midiToPitch(), showChordScoreTooltip(), etc.
```

**Total:** ~14,400 lines across 12 modules (7% reduction from 15,489 lines)

---

## 📋 MIGRATION BATCHES

### Batch 1: Core Infrastructure (3 modules) - **START HERE**
**Estimated Time:** 2-3 hours

1. **ModalState.js** (~400 lines)
   - Extract modalState object
   - State management functions
   - localStorage persistence
   - **Risk:** LOW (isolated state management)

2. **MusicUtils.js** (~700 lines)
   - Extract music math utilities
   - Pitch conversion functions
   - Scale/interval operations
   - Score tooltip functions
   - **Risk:** LOW (pure utility functions)

3. **AudioPlayback.js** (~600 lines)
   - Extract audio context management
   - All playback functions
   - **Risk:** LOW (independent audio module)

**Why Start Here:** These are "leaf" modules with minimal dependencies - they don't call other modal functions, making them safest to extract first.

---

### Batch 2: Tab Infrastructure (2 modules)
**Estimated Time:** 2-3 hours

4. **ModalStructure.js** (~800 lines)
   - Modal container creation
   - Tab navigation
   - Header components
   - **Risk:** MEDIUM (depends on ModalState)

5. **index.js** (~400 lines)
   - Main entry point
   - Initialization logic
   - Re-exports all functions
   - **Risk:** HIGH (coordinates everything)

---

### Batch 3: Simple Tabs (2 modules)
**Estimated Time:** 2-3 hours

6. **SectionTab.js** (~1,000 lines)
   - Section generation UI
   - Relatively independent
   - **Risk:** MEDIUM

7. **HarmonizeTab.js** (~700 lines)
   - Harmonization UI
   - Relatively independent
   - **Risk:** MEDIUM

---

### Batch 4: Complex Tabs (2 modules)
**Estimated Time:** 3-4 hours

8. **MelodyTab.js** (~1,800 lines)
   - Notes + Phrases views
   - Melody suggestion logic
   - **Risk:** MEDIUM-HIGH

9. **PolyphonyTab.js** (~1,500 lines)
   - Texture generation
   - Complex note generation logic
   - **Risk:** MEDIUM-HIGH

---

### Batch 5: Chord Tab Foundation (2 modules)
**Estimated Time:** 3-4 hours

10. **ChordViews.js** (~2,000 lines)
    - Quick, Explorer, Sequences views
    - Recommendation card creation
    - **Risk:** HIGH (core chord UI)

11. **ChordIntents.js** (~2,000 lines)
    - All 6 intent renderers
    - Advanced harmonic concepts
    - **Risk:** HIGH (complex logic)

---

### Batch 6: Chord Tab Main (1 module)
**Estimated Time:** 2-3 hours

12. **ChordTab.js** (~2,500 lines)
    - Main chord tab coordinator
    - Intent navigation
    - **Risk:** VERY HIGH (most complex, depends on ChordViews and ChordIntents)

---

## 🔑 KEY DEPENDENCIES

**Dependency Order (bottom-up):**
1. MusicUtils (no dependencies)
2. AudioPlayback (no dependencies)
3. ModalState (no dependencies)
4. ModalStructure → ModalState
5. SectionTab → ModalState, MusicUtils, AudioPlayback
6. HarmonizeTab → ModalState, MusicUtils, AudioPlayback
7. MelodyTab → ModalState, MusicUtils, AudioPlayback
8. PolyphonyTab → ModalState, MusicUtils, AudioPlayback
9. ChordViews → ModalState, MusicUtils, AudioPlayback
10. ChordIntents → ModalState, MusicUtils, AudioPlayback, ChordViews
11. ChordTab → ChordViews, ChordIntents
12. index.js → ALL modules

---

## ✅ SUCCESS CRITERIA

**Per Batch:**
- [ ] Module created with proper imports
- [ ] Functions migrated with full implementations
- [ ] Build succeeds (npm run dev)
- [ ] Zero console errors
- [ ] Modal opens successfully
- [ ] Tab switches work
- [ ] Features in migrated module work

**Final Success:**
- [ ] All 12 modules created
- [ ] Old file archived to `archived/UnifiedRecommendationModal.js.old`
- [ ] Hybrid loading removed
- [ ] All tabs functional
- [ ] All recommendation types work
- [ ] Audio playback works
- [ ] Zero errors in console
- [ ] Documentation updated

---

## 📝 MIGRATION PROCESS (Per Batch)

1. **Create module file** with imports
2. **Copy functions** from original file
3. **Fix dependencies** (imports, state access)
4. **Add exports** at bottom of file
5. **Update index.js** to import and re-export
6. **Test** - npm run dev, open modal, test features
7. **Commit** if batch successful

---

## 🎯 ESTIMATED TOTAL TIME

- **Batch 1-3:** ~6-9 hours (infrastructure + simple tabs)
- **Batch 4-6:** ~8-11 hours (complex tabs + chord hub)
- **Testing & Cleanup:** ~2-3 hours
- **Documentation:** ~1-2 hours

**Total:** ~17-25 hours spread over multiple sessions

---

## 🚀 NEXT IMMEDIATE STEPS

1. Create directory: `src/modules/ui/recommendations/UnifiedRecommendationModal/`
2. Start with Batch 1: Extract MusicUtils.js, AudioPlayback.js, ModalState.js
3. Create index.js with hybrid delegation pattern
4. Test each module extraction

---

**Based on Phase 1 Lessons:**
- ✅ Use hybrid delegation pattern from the start
- ✅ Migrate in small batches (test after each)
- ✅ Bottom-up dependency order
- ✅ Keep old file for reference during migration
- ✅ Maintain zero errors throughout

**Status:** Ready to begin Batch 1
**Last Updated:** 2025-12-28
