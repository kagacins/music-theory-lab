# Music Theory Lab - Chord & Melody Suggestions System

## Overview
The Music Theory Lab application has a sophisticated dual-suggestions system that provides intelligent recommendations for both chord progressions and melody notes.

## System Architecture

### 1. CHORD SUGGESTIONS SYSTEM

#### Core Suggestion Engine
- **File**: src/modules/features/unifiedChordSuggestions.js
- **Main Functions**:
  - generateUnifiedChordSuggestions() - Main suggestion generator
  - getBaseSuggestions() - Mood-based recommendations
  - applyStyleFilter() - Style-specific filtering
  - scoredInversionOptions() - Voice leading optimization

- **Styles**: Balanced, Pop, Jazz, Classical, Rock, Indie
- **Moods**: Bright, Dark, Jazzy, Tense, Calm, Energetic

#### UI Component - Modal
- **File**: src/modules/ui/chordSuggestionModal.js
- **Features**:
  - Style/mood selector with live preview
  - Current Chord vs Context Aware modes
  - Inversion selection buttons
  - Hold-to-play functionality
  - Show All button → Chord Explorer

#### UI Component - Sidebar
- **File**: src/modules/ui/recommendationsSidebar.js
- **Key Functions**:
  - renderRecommendationItem() - Single recommendation display
  - renderRecommendations() - Bulk rendering
  - updateContextDisplay() - Key/last chord info
  - playChordPreview() - Audio playback
  - renderAnalysisPanel() - Harmonic analysis

#### Controller
- **File**: src/modules/ui/recommendationsSidebarController.js
- **Responsibilities**:
  - Event listener setup
  - User interaction handling
  - Sidebar resizing
  - Keyboard shortcuts integration

### 2. MELODY SUGGESTIONS SYSTEM

#### Suggestion Engine
- **File**: src/modules/ai/melodySuggestion.js
- **Key Functions**:
  - generateMelodySuggestions() - Main generator
  - analyzeNote() - Individual note analysis
  - scoreChordRelation() - Chord tone scoring
  - scoreScaleRelation() - Scale membership
  - scoreVoiceLeading() - Interval/motion scoring
  - scoreApproachTone() - Chromatic approaches
  - scoreTension() - Harmonic tension

- **Note Categories** (with base scores):
  - Chord Tone (95)
  - Scale Tone (70)
  - Stepwise Motion (85)
  - Approach Tone (75)
  - Passing Tone (65)
  - Tension (55)
  - Avoid (25)

- **Style Presets**: Balanced, Pop, Jazz, Classical, Rock
- **Contour Presets**: Free, Ascending, Descending, Arch, Stepwise

#### UI Panel Component
- **File**: src/modules/ui/melodySuggestionPanel.js
- **Features**:
  - Color-coded categories
  - Keyboard shortcuts (1-5)
  - Preview button
  - Context display (chord/key/prev note)
  - Detailed tooltips
  - Empty/loading states

#### Controller
- **File**: src/modules/ai/melodySuggestionController.js
- **Responsibilities**:
  - Listens to composition state events
  - Generates context-aware suggestions
  - Handles note insertion
  - Manages audio preview
  - Updates after note insertion

- **Event Listeners**:
  - chordChanged
  - cursorMoved
  - noteAdded
  - progressionImported

## Integration Flow

### Chord Suggestions Integration
User clicks "Suggest Chords" in Progression Builder
↓
showChordSuggestionModal() called
↓
User selects style/mood/inversion
↓
generateComprehensiveRecommendations() OR generateChordSequences()
↓
User selects chord
↓
onAddChord callback
↓
melodySuggestionController.refreshSuggestions() triggered

### Melody Suggestions Integration
Composition State event (measure selected/chord changed)
↓
melodySuggestionController event listeners
↓
refreshSuggestions()
↓
Get context: chord, key, previousNote, recentNotes
↓
generateMelodySuggestions(context)
↓
Score notes: 12 pitches × octave range
↓
Sort by score, take top 15
↓
updateSuggestions() → renderSuggestions()
↓
User clicks note → handleNoteSelected()
↓
window.addNoteIntelligently()
↓
Notation re-rendered
↓
refreshSuggestions() (with new context)

## Scoring System

### Chord Scoring Components
1. Bass Movement - Smooth voice leading (0-15 pts)
2. Common Tones - Shared notes between chords (0-15 pts)
3. Total Voice Movement - Minimal movement (0-20 pts)
4. Voice Range - Mid-range preference (0-10 pts)
5. Contrary Motion - Bass/soprano opposition (0-5 pts)

### Melody Scoring Components
1. Harmonic Relationship - Chord/scale membership
2. Voice Leading - Smooth interval/motion
3. Approach Tone - Chromatic lead potential
4. Tension - Harmonic color
5. Contour Preference - Direction bias
6. Recency Penalty - Avoids repeated notes

## Key Configuration

### localStorage Keys
- chord-suggestion-style - Last selected style
- chord-suggestion-mood - Last selected mood
- suggestionsSidebarCollapsed - Sidebar state
- chord-recommendations-sidebar-width - Sidebar width

### Style Rule Multipliers (Melody)
Each style adjusts:
- chordToneBoost (0.6-1.3)
- scaleToneBoost (0.9-1.2)
- stepwiseBoost (0.9-1.5)
- approachToneBoost (0.6-1.4)
- tensionPenalty (0.6-1.4)

## Event System

### Custom Events
1. recommendationsUpdated - Chord recommendations update
2. chord-suggestion-preference-changed - Style/mood changed
3. chord-suggestion-inversion-changed - Inversion changed

### Composition State Events
- chordChanged
- cursorMoved
- noteAdded
- progressionImported

## UI Features

### Chord Suggestions
- Modal with sticky header
- Hold-to-play chord preview
- Inversion buttons
- Two modes: single chords vs sequences
- Numbered shortcuts (1-5)
- Detailed tooltips

### Melody Suggestions
- Context display panel
- Color-coded by category
- Score badges
- Numbered shortcuts (1-5)
- Preview button
- Comprehensive tooltips
- Empty/loading states

### Sidebar Management
- Collapse/expand toggle
- Lightbulb icon when collapsed
- Smooth animations
- Persistent state (localStorage)
- Responsive width adjustment

## File Reference Map

### Suggestion Engines
- src/modules/features/unifiedChordSuggestions.js
- src/modules/ai/melodySuggestion.js

### UI Components
- src/modules/ui/chordSuggestionModal.js
- src/modules/ui/recommendationsSidebar.js
- src/modules/ui/melodySuggestionPanel.js
- src/modules/ui/suggestionsSidebarToggle.js

### Controllers
- src/modules/ui/recommendationsSidebarController.js
- src/modules/ai/melodySuggestionController.js

### Integration Points
- src/modules/features/progressionBuilder.js
- src/modules/features/chordSuggestionEngine.js
- src/modules/features/comprehensiveChordRecommendations.js
- src/modules/features/chordSequences.js
- src/main.js

### State Management
- src/modules/state/compositionState.js
- src/modules/state/trainerState.js
- src/modules/config/weightPresets.js

### Utilities
- src/modules/utils/noteUtils.js
- src/modules/analysis/harmonyAnalyzer.js
- src/modules/audio/audioEngine.js

## Performance

### Chord Suggestions
- Lazy computation (only when modal opens)
- Preference caching (localStorage)
- Efficient style filtering

### Melody Suggestions
- Chromatic generation: 12 notes × octave range
- Optimized scoring: Multiple categories averaged
- Result limit: Top 15 returned
- Recency tracking: Last 20 notes

### Audio Playback
- Hold-to-play for immediate feedback
- Asynchronous (non-blocking)
- Proper note release cleanup

## Testing Functions

Available globally:
- window.testSidebarRecommendations()
- window.renderRecommendations(recommendations)
- melodySuggestionPanel.testMelodySuggestionPanel()

Browser console access:
- window.melodySuggestionController?.refreshSuggestions()
- window.showChordSuggestionModal(...)
- window.melodySuggestionController?.getConfig()

