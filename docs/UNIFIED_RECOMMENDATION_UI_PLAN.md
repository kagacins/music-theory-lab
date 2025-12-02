# Unified Recommendation UI Plan

## Overview

Consolidate the two chord recommendation interfaces (Tab form + Lightbulb form) into a single, comprehensive recommendation modal with consistent UI across Chords, Melody, and Section Generation.

## Current State Analysis

### Tab Form (chordSuggestionModal.js)
- Style/Mood controls
- Current Chord vs Context Aware modes
- Duration suggestions with rhythm awareness
- Inversion controls with hold-to-play
- "Show All" button to open Explorer
- **Missing**: Full chord explorer, comprehensive scoring view

### Lightbulb Form (chordExplorerModal.js)
- 3D Visualization + Data Table tabs
- Style/Mood controls (duplicated)
- Full scoring transparency
- Filterable chord list
- **Missing**: Section intent, duration suggestions, sequence generation

### Section Intent (SectionIntentSelector.js + generateTabUI.js)
- Continue Section / Start New Section modes
- Section type selection
- Harmonic analysis
- Section generation
- **Exists separately** from chord suggestion flow

## Unified Design

### Single Modal Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✕  RECOMMENDATION CENTER                           [Settings ⚙️]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────┬─────────┬─────────┐                                    │
│  │ 🎹 CHORD │ 🎵 MELODY │ 📝 SECTION │  ← Tab Navigation            │
│  └─────────┴─────────┴─────────┘                                    │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  CONTEXT BAR (always visible)                                       │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ Current: Cmaj → [Continue Section ▼] [Verse ▼]                  ││
│  │ Style: [Pop ▼]  Mood: [Bright ▼]  Duration: [⏱ On]  [Weights ⚙]││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  CHORD TAB CONTENT                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ VIEW: [Quick Suggestions] [All Chords Explorer] [Sequences]     ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─ QUICK SUGGESTIONS ─────────────────────────────────────────────┐│
│  │                                                                 ││
│  │  Top Recommendations:                                           ││
│  │  ┌──────────────────────────────────────────────────────────┐  ││
│  │  │ 1. G Major (V)  ⏱4b  92%  [▶ Play] [➕ Add]              │  ││
│  │  │    "Strong dominant resolution to tonic"                  │  ││
│  │  │    Voice: 85  Harmonic: 95  Style: 90  Mood: 88          │  ││
│  │  └──────────────────────────────────────────────────────────┘  ││
│  │  ┌──────────────────────────────────────────────────────────┐  ││
│  │  │ 2. Am (vi)  ⏱4b  87%  [▶ Play] [➕ Add]                  │  ││
│  │  │    "Relative minor, smooth voice leading"                 │  ││
│  │  └──────────────────────────────────────────────────────────┘  ││
│  │  ... more suggestions ...                                       ││
│  │                                                                 ││
│  │  Inversion: [Root ●] [1st ○] [2nd ○]     Lookback: [4 chords ▼]││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─ RHYTHMIC CONTEXT ──────────────────────────────────────────────┐│
│  │ Avg: 4 beats | Trend: ➡️ steady | Pattern: 4-4-4-4              ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Chord Tab Views

#### 1. Quick Suggestions View (Default)
- Top 5-10 chord recommendations
- Each card shows:
  - Chord name + Roman numeral
  - Duration badge
  - Confidence score
  - Quick reason
  - Expandable score breakdown
  - Play/Add buttons
- Inversion selector
- Lookback depth control

#### 2. All Chords Explorer View
- Embeds the full chordExplorerModal table
- Filterable by root, type, inversion, score
- Sortable columns
- Full scoring transparency
- 3D visualization toggle

#### 3. Sequences View
- Multi-chord sequence suggestions
- Shows 2-4 chord progressions
- Each sequence with combined score
- Add entire sequence option

### Context Bar (Shared Across All Tabs)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Section: [Continue ▼] → [Build | Conclude | Final]                  │
│          [New Section ▼] → [Intro | Verse | Chorus | Bridge | ...]  │
│                                                                     │
│ Style: [Pop ▼]  Mood: [Bright ▼]  ⏱Duration: [On/Off]              │
│                                                                     │
│ [⚙️ Weights] → Opens weight adjustment panel                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Melody Tab Content

```
┌─────────────────────────────────────────────────────────────────────┐
│  MELODY TAB                                                         │
│                                                                     │
│  Current Chord: C Major | Section: Verse | Position: 3 of 8        │
│                                                                     │
│  ┌─ MELODY SUGGESTIONS ────────────────────────────────────────────┐│
│  │ [Motif Continuation] [New Phrase] [Cadential]                   ││
│  │                                                                 ││
│  │ Suggested Notes:                                                ││
│  │ ┌────────────────────────────────────────────────────────────┐ ││
│  │ │ E → G → C  "Ascending arpeggio, strong resolution"         │ ││
│  │ │ [▶ Play] [Apply]                                           │ ││
│  │ └────────────────────────────────────────────────────────────┘ ││
│  │                                                                 ││
│  │ Rhythm Pattern: [Quarter] [Eighth] [Syncopated]                ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### Section Tab Content

```
┌─────────────────────────────────────────────────────────────────────┐
│  SECTION TAB                                                        │
│                                                                     │
│  ┌─ CURRENT STRUCTURE ─────────────────────────────────────────────┐│
│  │ [Intro 4] → [Verse 8] → [Chorus 8*] → [?]                       ││
│  │                                     ↑ Current                   ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─ NEXT SECTION SUGGESTION ───────────────────────────────────────┐│
│  │ Recommended: Bridge (85%)                                       ││
│  │ "Creates contrast after energetic chorus"                       ││
│  │                                                                 ││
│  │ Alternatives: [Verse 72%] [Instrumental 68%] [Outro 45%]        ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─ GENERATE SECTION ──────────────────────────────────────────────┐│
│  │ Type: [Bridge ▼]  Length: [4 chords ▼] [8 chords ▼]             ││
│  │                                                                 ││
│  │ [🎲 Generate Preview]                                           ││
│  │                                                                 ││
│  │ Preview: Dm → G → Em → Am                                       ││
│  │ [▶ Play All] [Apply to Progression]                             ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─ HARMONIC ANALYSIS ─────────────────────────────────────────────┐│
│  │ Current Tension: Medium (building)                              ││
│  │ Cadence Expectation: 2 chords to resolution                     ││
│  │ Key Stability: Strong (C Major confirmed)                       ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Create Unified Modal Shell
- [ ] Create new `UnifiedRecommendationModal.js`
- [ ] Implement tab navigation (Chord, Melody, Section)
- [ ] Create shared Context Bar component
- [ ] Set up state management for unified modal

### Phase 2: Migrate Chord Tab
- [ ] Port Quick Suggestions from chordSuggestionModal
- [ ] Embed All Chords Explorer (refactor chordExplorerModal as component)
- [ ] Add Sequences view
- [ ] Integrate duration suggestions
- [ ] Connect section intent to chord generation

### Phase 3: Migrate Section Tab
- [ ] Port section intent selector
- [ ] Port section generation UI
- [ ] Add harmonic analysis panel
- [ ] Connect to recommendation service

### Phase 4: Migrate/Enhance Melody Tab
- [ ] Port existing melody suggestions
- [ ] Align UI with new design
- [ ] Add motif/phrase modes

### Phase 5: Update Triggers
- [ ] Tab key opens unified modal (Chord tab active)
- [ ] Lightbulb button opens unified modal (Chord tab, Quick view)
- [ ] Shift+Tab could open specific tab
- [ ] Update all event handlers

### Phase 6: Remove Old Modals
- [ ] Deprecate chordSuggestionModal.js
- [ ] Refactor chordExplorerModal.js as embeddable component
- [ ] Update all import references
- [ ] Clean up dead code

## File Structure

```
src/modules/ui/recommendations/
├── UnifiedRecommendationModal.js    # Main modal container
├── components/
│   ├── ContextBar.js                # Shared context controls
│   ├── TabNavigation.js             # Tab switching
│   ├── chord/
│   │   ├── QuickSuggestionsView.js  # Default chord view
│   │   ├── AllChordsExplorer.js     # Full explorer (refactored)
│   │   ├── SequencesView.js         # Multi-chord sequences
│   │   └── ChordCard.js             # Individual suggestion card
│   ├── melody/
│   │   └── MelodySuggestions.js     # Melody tab content
│   ├── section/
│   │   ├── SectionStructure.js      # Current structure display
│   │   ├── SectionSuggestion.js     # Next section recommendation
│   │   ├── SectionGenerator.js      # Generate new sections
│   │   └── HarmonicAnalysis.js      # Analysis panel
│   └── shared/
│       ├── ScoreBreakdown.js        # Reusable score display
│       ├── PlayButton.js            # Hold-to-play component
│       └── DurationBadge.js         # Duration indicator
├── state/
│   └── unifiedRecommendationState.js # Modal state management
└── styles/
    └── unified-recommendation.css    # Consolidated styles
```

## Key Benefits

1. **Single Entry Point**: One modal for all recommendation needs
2. **Consistent UI**: Same controls and layout across tabs
3. **Shared Context**: Section intent affects all recommendations
4. **No Duplication**: Style/mood/duration controls in one place
5. **Better Discovery**: Users see all capabilities together
6. **Easier Maintenance**: Centralized recommendation UI code

## Keyboard Shortcuts (Updated)

| Shortcut | Action |
|----------|--------|
| `Tab` | Open Unified Modal (last used tab) |
| `Shift+Tab` | Open Unified Modal → Chord Tab |
| `Ctrl+Tab` | Open Unified Modal → Section Tab |
| `1-5` (in modal) | Quick-add top 5 suggestions |
| `Escape` | Close modal |
| `←/→` | Switch tabs |

## Migration Strategy

1. Build new unified modal alongside existing modals
2. Feature flag to switch between old/new UI
3. Gradual migration of functionality
4. User testing with both versions
5. Remove old modals once stable

## Open Questions

1. Should the 3D visualization remain a separate toggle or become a dedicated view?
2. How to handle the "Weights" panel - inline or separate modal?
3. Should sequence generation show in Chord tab or Section tab?
4. Persist last-used tab between sessions?

## Success Criteria

- [ ] Single modal accessed from Tab key and lightbulb
- [ ] All chord suggestion features available
- [ ] All section intent features integrated
- [ ] Duration suggestions working across views
- [ ] Consistent look and feel with rest of app
- [ ] No regression in functionality
- [ ] Improved user workflow efficiency
