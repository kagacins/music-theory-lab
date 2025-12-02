# Unified Recommendation Modal - Status Report

**Last Updated:** November 30, 2024

## Overview

The Unified Recommendation Modal consolidates chord, melody, and section recommendations into a single, comprehensive interface. It replaces the previously separate Tab-initiated chord suggestion form and Lightbulb-initiated chord explorer modal.

---

## Current Implementation Status

### Phase 1: Modal Shell ✅ COMPLETE

| Feature | Status | Notes |
|---------|--------|-------|
| Modal container structure | ✅ Done | Full-screen overlay with centered modal |
| Tab navigation (Chord, Melody, Section) | ✅ Done | Three tabs with active state styling |
| Context Bar | ✅ Done | Section intent, Style, Mood, Duration, Weights |
| State management | ✅ Done | `modalState` object with localStorage persistence |
| Keyboard shortcuts | ✅ Done | Tab, Shift+Tab, Ctrl+Tab, Escape, Arrow keys, 1-5 |

### Phase 2: Chord Tab ✅ MOSTLY COMPLETE

| Feature | Status | Notes |
|---------|--------|-------|
| Quick Suggestions view | ✅ Done | Top 10 recommendations with scores and reasons |
| All Chords Explorer view | ✅ Done | Paginated table with filtering and sorting |
| Sequences view | ✅ Done | Multi-chord sequences with Play Sequence button |
| Duration suggestions | ✅ Done | Rhythmic context display and duration badges |
| Section intent integration | ✅ Done | Intent passed to recommendation scoring |
| Inversion selector | ✅ Done | Root, 1st, 2nd inversion buttons |
| Progression selector | ✅ Done | Clickable chord chips with section grouping |
| Current chord display in Sequences | ✅ Done | Shows "Current" chord at start of sequences |
| Clickable chord playback | ✅ Done | Mousedown/mouseup for chord preview |
| Play Sequence button | ✅ Done | Plays current + sequence chords with timing |
| Sequence length option | ✅ Done | 2-5 chord selector |
| "Updating Suggestions..." indicator | ✅ Done | Pulsing animation during refresh |
| Hold-to-preview on cards | ✅ Done | Play button with mousedown/mouseup |
| Roman numeral display | ⏳ Partial | Reason text includes function, not explicit numeral |
| Expandable score breakdown | ❌ Not Done | Scores shown inline, not expandable |

### Phase 3: Section Tab ⏳ PARTIAL

| Feature | Status | Notes |
|---------|--------|-------|
| Current structure display | ⏳ Basic | Shows sections list with chord counts |
| Section type suggestions | ⏳ Basic | Shows section type buttons |
| Section generator UI | ⏳ Basic | Type and length selectors, Generate button |
| Harmonic analysis panel | ❌ Not Done | Placeholder only |
| Connection to SectionGenerator | ❌ Not Done | Buttons not wired up |

### Phase 4: Melody Tab ❌ PLACEHOLDER

| Feature | Status | Notes |
|---------|--------|-------|
| Melody suggestions | ❌ Not Done | Placeholder message only |
| Motif/phrase modes | ❌ Not Done | Not implemented |
| Rhythm pattern selection | ❌ Not Done | Not implemented |

### Phase 5: Triggers ✅ COMPLETE

| Feature | Status | Notes |
|---------|--------|-------|
| Tab key opens modal | ✅ Done | Opens to Chord tab |
| Shift+Tab opens modal | ✅ Done | Opens to Melody tab |
| Ctrl+Tab opens modal | ✅ Done | Opens to Section tab |
| Toggle behavior | ✅ Done | Second press closes modal |
| Last used tab persistence | ✅ Done | Saved to localStorage |

### Phase 6: Legacy Cleanup ❌ NOT STARTED

| Feature | Status | Notes |
|---------|--------|-------|
| Deprecate chordSuggestionModal.js | ❌ Not Done | Still in use as fallback |
| Refactor chordExplorerModal.js | ❌ Not Done | Still separate modal |
| Update import references | ❌ Not Done | Both systems coexist |
| Remove dead code | ❌ Not Done | Legacy code still present |

---

## Current Features Summary

### Context Bar Controls
- **Section Intent**: Continue Section (Build/Resolve/Final) or New Section (type selector)
- **Style**: Balanced, Pop, Jazz, Classical, Rock, Indie, Folk, Electronic
- **Mood**: Bright, Dark, Jazzy, Tense, Calm, Energetic
- **Duration Toggle**: Enable/disable rhythmic duration suggestions
- **Weights Button**: Opens chord weights configuration modal

### Chord Tab Views
1. **Quick Suggestions** (default)
   - Progression selector with section-grouped chords
   - Inversion selector
   - Rhythmic context display (average duration, trend, pattern)
   - Top 10 recommendation cards with scores, reasons, duration badges
   - Hold-to-play preview, Add button on each card
   - Number keys 1-5 for quick add

2. **Sequences**
   - Sequence length selector (2-5 chords)
   - Sequence cards showing: Current chord → Suggested sequence
   - Clickable chord chips for individual playback
   - Play Sequence button (plays all chords with timing)
   - Add All button to add entire sequence

3. **All Chords Explorer**
   - Root and Type filters
   - Sortable columns (Root, Type, Inversion, Score, sub-scores)
   - Paginated results (25 per page)
   - Add button on each row

### Section Tab (Basic)
- Current structure visualization
- Section type quick buttons
- Generate section form (type, length, generate button)

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Tab` | Open modal (Chord tab) / Close if open |
| `Shift+Tab` | Open modal (Melody tab) / Close if open |
| `Ctrl+Tab` | Open modal (Section tab) / Close if open |
| `Escape` | Close modal |
| `←/→` | Switch between tabs |
| `1-5` | Quick-add top 5 suggestions (Chord tab, Quick view) |

---

## Future Implementation Roadmap

### High Priority

#### 1. Complete Section Tab Integration
- Wire up Generate Section button to `SectionGenerator`
- Implement proper harmonic analysis panel showing:
  - Current tension level
  - Cadence expectation
  - Key stability analysis
- Add next section recommendations with confidence scores
- Connect to existing section generation infrastructure

#### 2. Implement Melody Tab
- Port melody suggestion logic from existing systems
- Add motif continuation mode
- Add new phrase generation mode
- Add cadential melody patterns
- Integrate with notation editor for direct application

#### 3. Score Breakdown Expansion
- Make score cards expandable to show sub-scores:
  - Voice leading score
  - Harmonic function score
  - Style fit score
  - Mood fit score
  - Section context score
- Add tooltips explaining each score component

### Medium Priority

#### 4. 3D Visualization Integration
- Option to toggle 3D chord space visualization in Explorer view
- Visual representation of chord relationships
- Interactive navigation through chord space

#### 5. Advanced Sequence Features
- Support for 4-5 chord sequences (currently limited to 2-3)
- Sequence pattern recognition
- Common progression templates (I-V-vi-IV, ii-V-I, etc.)
- Sequence comparison view

#### 6. Enhanced Section Grouping
- Visual timeline of song structure
- Drag-and-drop section reordering
- Section templates (verse-chorus-verse, etc.)
- Auto-detection of section boundaries

### Lower Priority

#### 7. Legacy Modal Removal
- Remove `chordSuggestionModal.js` once unified modal is stable
- Refactor `chordExplorerModal.js` as embeddable component
- Clean up duplicate event handlers
- Update all import references

#### 8. Performance Optimizations
- Lazy load tab content
- Virtualize long chord lists
- Cache recommendation results
- Debounce preference changes

#### 9. Additional Features
- Custom weight presets (save/load)
- Recommendation history
- Favorite chords/sequences
- Export progression as MIDI

---

## Known Issues

1. **Sequences limited to 2-3 chords**: The `generateChordSequences` function only implements 2-chord and 3-chord sequences; 4-5 chord options in UI won't produce longer sequences.

2. **Section grouping in progression**: May not display correctly if composition state doesn't have properly defined sections.

3. **Melody tab placeholder**: Users may expect functionality that isn't implemented yet.

4. **Old modals still accessible**: Both legacy modals (chordSuggestionModal, chordExplorerModal) still exist and may be triggered by other parts of the application.

---

## Technical Notes

### File Location
```
src/modules/ui/recommendations/UnifiedRecommendationModal.js
```

### Key Dependencies
- `comprehensiveChordRecommendations.js` - Chord scoring engine
- `chordSequences.js` - Multi-chord sequence generation
- `sectionIntentState.js` - Section intent state management
- `trainerState.js` - Progression and key state
- `compositionState.js` - Section grouping data
- `rhythmicContextAnalyzer.js` - Duration suggestions

### State Persistence
The following is saved to localStorage:
- `unified-modal-active-tab` - Last active tab
- `unified-modal-chord-view` - Last chord view (quick/explorer/sequences)
- `chord-suggestion-style` - Selected style
- `chord-suggestion-mood` - Selected mood
- `chord-suggestion-rhythm-awareness` - Duration toggle state
- `chord-suggestion-lookback` - Lookback depth
- `chord-suggestion-sequence-length` - Sequence length preference

---

## Decision Log

| Decision | Date | Rationale |
|----------|------|-----------|
| Single modal approach | Initial | Reduce UI fragmentation, improve discoverability |
| Section intent in context bar | Initial | Affects all recommendation types |
| Three chord views | Initial | Balance quick access with detailed exploration |
| Sequences include current chord | Nov 2024 | Provides context for sequence evaluation |
| Tab keyboard shortcuts | Nov 2024 | Quick access matches old Tab-initiated form |
| Progression selector with sections | Nov 2024 | Visual structure helps with positioning |
