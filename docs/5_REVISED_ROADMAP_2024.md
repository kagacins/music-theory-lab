# Music Theory Lab - Revised Roadmap 2024
## Harmonized Plan for Enhanced Songwriting Experience

---

## Executive Summary

This revised roadmap focuses on making Music Theory Lab the most **intuitive and enjoyable** assisted songwriting tool available. The key priorities are:

1. **Songwriting Wizard Enhancement** - Transform from basic to comprehensive guided experience
2. **Voice Leading Visualization** - Make the existing analysis visible and educational
3. **Rhythm Pattern Library** - Enable professional bass/comping patterns
4. **Auto-Save & Version History** - Protect user work
5. **Section Tab Completion** - Wire up existing generation infrastructure

---

## Current State Assessment

### Fully Implemented
- VexFlow Professional Notation (Phase 4.4)
- Melody Suggestion Engine with Notes + Phrases views
- Chord Recommendation System with sequences
- Auto-Harmonize functionality
- Chord Tone Highlighting/Analysis
- Export System (MIDI, PDF lead sheet + notation, shareable links)
- Basic bi-directional sync
- Undo/Redo system
- Basic Songwriting Wizard (5 steps, 6 moods)

### Voice Leading Status
**Currently Visible to Users:**
- Voice Leading score displayed as number/percentage in:
  - Chord Explorer Modal (sortable column)
  - Recommendations Sidebar (color-coded indicator)
  - Auto-Harmonize Modal (percentage display)
- Educational tutorials covering voice leading concepts
- "Smooth/Moderate/Jumpy" quality labels

**Analysis Available but NOT Visually Displayed:**
- SVG lines connecting notes between chords (showing voice motion)
- Parallel fifths/octaves warnings on notation
- Voice crossing indicators
- Bass interval quality visualization
- Common tone highlighting between chords

### Partially Implemented
- Section Tab in Unified Modal (UI exists, not fully wired)
- Session save/load (no versioning)

### Not Implemented
- Voice Leading Visualization (SVG lines between notes)
- Rhythm Pattern Library
- Version History / Auto-save
- Style/Genre selection in wizard
- Song structure builder

---

## Priority 1: Songwriting Wizard Enhancement

### Current State
- 5 steps: Mood → Preview → Customize → Melody Tips → Export
- 6 moods with curated progressions
- Key transposition, basic variations
- "Why it works" theory explanations

### Proposed Enhancements

#### Phase A: Comprehensive First-Run Experience
**Goal:** Transform wizard into a full creative launch pad

**New Flow (8 steps):**
1. **Welcome** - "What would you like to create today?"
   - Quick Song (4-chord, guided)
   - Full Composition (verse/chorus structure)
   - Explore & Learn (sandbox mode)

2. **Mood Selection** - Enhanced with audio previews
   - Keep existing 6 moods
   - Add: Mysterious, Triumphant, Nostalgic, Playful
   - Each mood plays a 4-second audio preview on hover

3. **Style/Genre Selection** - NEW
   - Pop, Rock, Jazz, Classical, Folk, Electronic, R&B, Blues
   - Each style adjusts chord complexity, voicings, patterns
   - Visual genre cards with example artists

4. **Structure Selection** - NEW
   - Simple (4 chords, repeat)
   - Verse-Chorus (8+8 measures)
   - Verse-Prechorus-Chorus (8+4+8)
   - AABA (32-bar)
   - 12-Bar Blues
   - Custom builder

5. **Tempo & Feel** - NEW
   - Tempo slider with BPM tap
   - Feel: Straight, Swing, Shuffle
   - Time signature: 4/4, 3/4, 6/8

6. **Preview & Refine**
   - Full playback with generated structure
   - Visual chord chart showing all sections
   - Quick-swap chords within style

7. **Melody & Bass Guidance**
   - Enhanced tips with interactive examples
   - Auto-suggest starter melody motifs
   - Bass pattern selection

8. **Launch Composition**
   - Load to Composition Studio
   - One-click to enable AI suggestions
   - Optional tutorial overlay

#### Phase B: Better Integration
- Make wizard accessible from main screen (not just Learn tab)
- "Start New Song" button in header
- Return to wizard from composition (refine choices)
- Remember last used settings

#### Phase C: Smart Defaults
- AI-driven parameter suggestions based on mood+style
- Tempo auto-set based on genre
- Complexity auto-adjust based on user skill level

---

## Priority 2: Voice Leading Visualization

### Goal
Make the existing voice leading analysis **visible** through SVG overlay on the notation.

### Features

#### Visual Elements
```
Chord 1          Chord 2
┌─────┐          ┌─────┐
│  E  │─────────▶│  E  │  (green line = common tone)
│  C  │─╲      ╱─│  D  │  (blue line = stepwise)
│  G  │──╲────╱──│  G  │  (green line = common tone)
│  C  │───────▶──│  F  │  (orange line = skip)
└─────┘          └─────┘
```

#### Line Types & Colors
- **Green (solid)**: Common tone (same note)
- **Blue (solid)**: Stepwise motion (half/whole step)
- **Orange (dashed)**: Skip (3rd-5th)
- **Red (dashed)**: Large leap (6th+)
- **Red (thick, warning)**: Parallel 5ths/8ves

#### Analysis Overlays
- Toggle on/off in notation toolbar
- Tooltip on hover: "E stays the same (common tone)"
- Summary score per transition
- Warning badges for parallel motion issues

#### Interactive Features
- Click a line to hear just those two notes
- Highlight all instances of a specific pattern
- "Fix this" suggestions for problem areas

### Implementation
- New file: `src/modules/notation/voiceLeadingOverlay.js`
- SVG layer rendered over VexFlow canvas
- Integrates with existing `enhancedVoiceLeading.js` analysis
- Performance: Only render for visible measures

---

## Priority 3: Rhythm Pattern Library

### Goal
Enable users to apply professional bass and comping patterns with one click.

### Pattern Categories

#### Bass Patterns (Already defined in UnifiedRecommendationModal)
```javascript
'Simple Patterns': ['whole-note', 'root-fifth', 'half-time', 'pedal']
'Arpeggiated': ['arpeggio', 'alberti', 'broken-octave']
'Walking & Melodic': ['walking', 'chromatic-approach', 'scalar-walk', 'bebop']
'Rhythmic': ['dotted-rhythm', 'syncopated', 'anticipation', 'shuffle', 'driving-rock', 'boogie']
'Style': ['country', 'bossa-nova', 'disco-octave', 'motown', 'reggae', 'funk']
```

#### Comping Patterns (NEW)
- Block chords
- Charleston rhythm
- Bossa nova comping
- Rock power chord
- Ballad arpeggios

### Features
- Pattern browser with audio preview
- Apply to single measure, section, or all
- Customize pattern (edit grid)
- Save custom patterns
- Suggest patterns based on style selection

### Implementation
- New file: `src/modules/features/rhythmPatternLibrary.js`
- Pattern preview player
- Pattern-to-notation converter
- Integration with bassAutoFill.js

---

## Priority 4: Auto-Save & Version History

### Goal
Never lose user work, enable experimentation with confidence.

### Features

#### Auto-Save
- Save to localStorage every 30 seconds
- Save on significant actions (add chord, edit note)
- Background save (non-blocking)
- "Last saved: 30 seconds ago" indicator

#### Version History
- Rolling history of last 50 saves
- Named checkpoints ("Before adding bridge")
- Timeline view in sidebar
- Preview any version
- Restore with confirmation
- Compare versions side-by-side

#### Crash Recovery
- Detect unsaved work on page load
- "Recover unsaved work?" prompt
- Never lose more than 30 seconds of work

### Implementation
- New file: `src/modules/storage/autoSave.js`
- New file: `src/modules/storage/versionHistory.js`
- History panel UI
- Diff view component

---

## Priority 5: Section Tab Completion

### Current State
- UI exists with section type buttons
- Generate section form exists
- NOT wired to SectionGenerator

### Needed Work
- Connect "Generate" button to `SectionGenerator.generateSection()`
- Display harmonic analysis (tension, cadence expectation)
- Show recommended next section types
- Enable section reordering via drag-drop
- Section timeline visualization

---

## Implementation Timeline

### Sprint 1: Songwriting Wizard (Weeks 1-2)
| Task | Est. |
|------|------|
| Add Style/Genre selection step | 3 days |
| Add Structure selection step | 2 days |
| Add Tempo/Feel step | 1 day |
| Enhance preview with full structure | 2 days |
| Make wizard accessible from main screen | 1 day |
| Polish & test | 1 day |

### Sprint 2: Voice Leading Visualization (Weeks 3-4)
| Task | Est. |
|------|------|
| Create SVG overlay architecture | 2 days |
| Implement line rendering for chord pairs | 2 days |
| Add colors/styles based on analysis | 1 day |
| Add interactive features (tooltips, click) | 2 days |
| Integrate with notation toolbar | 1 day |
| Warning badges for parallel motion | 1 day |
| Polish & test | 1 day |

### Sprint 3: Rhythm Patterns & Auto-Save (Weeks 5-6)
| Task | Est. |
|------|------|
| Pattern library data structure | 1 day |
| Pattern browser UI | 2 days |
| Pattern-to-notation conversion | 2 days |
| Auto-save implementation | 1 day |
| Version history storage | 2 days |
| History panel UI | 2 days |

### Sprint 4: Section Tab & Polish (Weeks 7-8)
| Task | Est. |
|------|------|
| Wire Section tab to SectionGenerator | 2 days |
| Harmonic analysis display | 2 days |
| Section timeline visualization | 2 days |
| Full integration testing | 2 days |
| Documentation & cleanup | 2 days |

---

## Success Metrics

### User Experience
- [ ] First-time users complete a song in <10 minutes
- [ ] Wizard completion rate >80%
- [ ] Return user rate >40% weekly

### Feature Adoption
- [ ] >70% use voice leading visualization
- [ ] >60% apply at least one rhythm pattern
- [ ] >50% create named checkpoints

### Quality
- [ ] Zero data loss reports
- [ ] Voice leading warnings accurate >95%
- [ ] Pattern application sounds correct 100%

---

## Quick Wins (Implement as Encountered)

1. **"Surprise Me" button** - Random template with AI scoring
2. **Tempo tap** - Set BPM by tapping spacebar
3. **Quick transpose** - Dropdown to transpose entire composition
4. **Audio export** - Render to WAV using MediaRecorder
5. **Dark mode for wizard** - Consistent theming

---

**Document Created:** December 2024
**Project:** Music Theory Lab
**Version:** 3.0
