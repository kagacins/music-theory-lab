# Music Theory Lab - Phase 4+ Strategic Roadmap
## Building the Best Music Theory & Songwriting Application

---

## Executive Summary

This roadmap outlines the strategic next steps to transform Music Theory Lab into the world's best music theory and songwriting application for users of all skill levels. The key differentiator is **AI-assisted composition** - helping users compose, not just notate.

**Core Philosophy:** Start with harmony → intelligently suggest notes → create complete arrangements

---

## Current State Summary

### Completed Features (Strong Foundation)

#### Chord Recommendation System
- 3D scoring engine evaluating 600+ chord combinations
- Harmonic function, voice leading, style, and mood scoring
- Modal interchange detection
- Customizable weights

#### Progression Builder
- 24 professional templates across 6 categories
- Pattern detection (I-IV-V, ii-V-I, etc.) with visual highlighting
- Tension curve visualization
- Color-coded harmonic analysis (Tonic/Subdominant/Dominant)
- Template browser with search and categorization

#### Melody Composer
- Basic melody notation with measure editing
- Auto-generated bass notes
- Chord card display with detailed voicing info
- Playback integration with Tone.js

#### Integration Infrastructure
- `bassAutoFill.js` - Voice-led bass generation
- `progressionNotationSync.js` - Sync framework
- `melodyComposerBridge.js` - Builder ↔ Composer connection
- `compositionState.js` - Unified state management

### Deferred Features (From Previous Plans)

- Phase 3.2: Voice Leading Visualization
- VexFlow professional notation rendering
- Full bi-directional chord ↔ notation sync
- AI melody suggestions / auto-harmonize
- MusicXML export
- MIDI import

---

## Phase 4: AI-Assisted Composition & Professional Notation
**Priority: CRITICAL - This is the killer differentiator**

No competitor (MuseScore, Flat.io, Noteflight, Hookpad) does this well. This is what will make Music Theory Lab stand out.

### 4.1 Melody Suggestion Engine
**Duration:** 2-3 weeks
**Priority:** 🔥 Critical

#### Features

**Core Algorithm:**
```javascript
// Suggestion categories with scoring
{
  chordTones: { score: 95, reason: "Chord tone - strong and stable" },
  stepwiseMotion: { score: 85, reason: "Stepwise from previous note" },
  approachTones: { score: 75, reason: "Chromatic approach to chord tone" },
  passingTones: { score: 65, reason: "Passing tone - adds movement" },
  tensions: { score: 55, reason: "Tension note - use with care" }
}
```

**Context Awareness:**
- Current chord in measure
- Previous melody notes (for stepwise motion)
- Key signature
- Style setting (jazz = more approach tones, pop = more chord tones)

**UI Components:**
1. **Sidebar Panel** - Top 10 melody suggestions with:
   - Note name and octave
   - Score (0-100)
   - Category label
   - Reason text
   - Click to insert

2. **Staff Overlay** - Ghost notes showing:
   - Green: Chord tones (safe choices)
   - Blue: Scale tones (good choices)
   - Orange: Tensions (interesting choices)

3. **Interactive Workflow:**
   - Hover over staff position → see suggestions
   - Click suggestion → insert note
   - Keyboard shortcut to cycle through suggestions

#### Implementation Files
- `src/modules/ai/melodySuggestion.js` - Core engine
- `src/modules/ui/melodySuggestionPanel.js` - Sidebar UI
- `src/modules/ui/staffOverlay.js` - Visual overlay

#### Success Metrics
- [ ] Suggests 10+ notes per beat position
- [ ] Chord tones always ranked highest
- [ ] Stepwise motion from previous note detected
- [ ] Style-appropriate suggestions (jazz vs pop)
- [ ] <100ms response time

---

### 4.2 Auto-Harmonize Feature
**Duration:** 2 weeks
**Priority:** 🔥 Critical

#### Features

**Melody Analysis:**
- Group notes by measure
- Identify prominent pitches (on-beat, long duration)
- Find chords containing most melody notes

**Chord Suggestion:**
- Score each candidate chord by:
  - Match percentage (notes in chord)
  - Voice leading from previous chord
  - Harmonic function fit
- Show top 3 options per measure

**UI Flow:**
1. User composes melody (4-8 measures)
2. Clicks "Auto-Harmonize" button
3. Modal shows suggested progression:
   ```
   Measure 1: C Major (92%) | Am (78%)
   Measure 2: F Major (88%) | Dm (75%)
   Measure 3: G Major (95%) | Em (80%)
   Measure 4: C Major (90%) | Am (72%)
   ```
4. User can customize each measure
5. Click "Apply" to set progression + auto-fill bass

#### Implementation Files
- `src/modules/ai/autoHarmonize.js` - Analysis engine
- `src/modules/ui/autoHarmonizeModal.js` - Selection UI

#### Success Metrics
- [ ] 70%+ accuracy on common melodies
- [ ] Suggests functional progressions (not random chords)
- [ ] Voice leading score > 80 between suggestions
- [ ] Works with 4-16 measure melodies

---

### 4.3 Chord Tone Highlighting
**Duration:** 1 week
**Priority:** High

#### Features

**Real-Time Analysis:**
- As playhead moves, highlight melody notes
- Color code based on relationship to current chord:
  - Green: Root
  - Blue: 3rd or 5th
  - Purple: 7th or extension
  - Orange: Scale tone (not in chord)
  - Red: Chromatic/tension

**Visual Indicators:**
- Note head color change
- Optional glow effect
- Tooltip with "Root of C Major" explanation

**Educational Tooltips:**
- "This E is the 3rd of C Major - creates brightness"
- "This F is a passing tone between E and G"
- "This Ab is borrowed from C minor - adds color"

#### Implementation Files
- `src/modules/analysis/chordToneAnalyzer.js` - Analysis
- `src/modules/ui/noteHighlighter.js` - Visual effects

#### Success Metrics
- [ ] Real-time highlighting (<16ms latency)
- [ ] Accurate chord tone identification
- [ ] Educational tooltips for beginners
- [ ] Toggle on/off in settings

---

### 4.4 VexFlow Professional Notation
**Duration:** 4-6 weeks
**Priority:** High

#### Features

**Professional Rendering:**
- Replace current notation with VexFlow library
- Proper measure spacing and justification
- Correct note beaming and stem directions
- Accidentals and key signatures displayed correctly
- Time signature changes mid-piece

**Grand Staff Display:**
- Treble clef (right hand / melody)
- Bass clef (left hand / chords)
- Brace connecting staves
- Synchronized measure alignment

**Multi-System Layout:**
- 4 measures per line (configurable)
- Automatic system breaks
- Page breaks for printing
- Scrollable/zoomable view
- Measure numbers

**Note Entry & Editing:**
- Click to add notes at position
- Duration selector (whole, half, quarter, eighth, sixteenth)
- Dotted notes and rests
- Drag to reposition notes
- Delete/backspace to remove

**Advanced Notation:**
- Dynamics (p, mp, mf, f, ff)
- Articulations (staccato, accent, tenuto)
- Ties and slurs
- Chord symbols above staff
- Lyrics below staff (future)

#### Implementation Strategy

**Phase 4.4a (Weeks 1-2): Core Integration**
```javascript
// modules/notation/vexFlowRenderer.js
export function renderMeasure(container, measureData, options) {
  const VF = Vex.Flow;
  const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);

  const context = renderer.getContext();
  const stave = new VF.Stave(10, 40, 400);

  stave.addClef(options.clef || "treble");
  stave.addTimeSignature(`${measureData.timeSig.num}/${measureData.timeSig.denom}`);
  stave.addKeySignature(measureData.keySignature);

  stave.setContext(context).draw();

  // Convert our note format to VexFlow format
  const notes = measureData.notes.map(noteData => {
    return new VF.StaveNote({
      keys: [noteData.pitch],
      duration: noteData.duration
    });
  });

  VF.Formatter.FormatAndDraw(context, stave, notes);
}
```

**Phase 4.4b (Weeks 3-4): Grand Staff**
```javascript
function renderGrandStaff(container, measureData) {
  const trebleStave = new VF.Stave(10, 0, 400).addClef("treble");
  const bassStave = new VF.Stave(10, 100, 400).addClef("bass");

  // Connect with brace
  const brace = new VF.StaveConnector(trebleStave, bassStave);
  brace.setType(VF.StaveConnector.type.BRACE);

  // Render both staves synchronized
  trebleStave.setContext(context).draw();
  bassStave.setContext(context).draw();
  brace.setContext(context).draw();
}
```

**Phase 4.4c (Weeks 5-6): Multi-System & Polish**
- Implement system layout algorithm
- Add note editing interactions
- Performance optimization
- Integration with existing Melody Composer

#### Implementation Files
- `src/modules/notation/vexFlowRenderer.js` - Core rendering
- `src/modules/notation/staffLayouter.js` - Multi-system layout
- `src/modules/notation/noteFormatter.js` - Note spacing/beaming
- `src/modules/notation/grandStaff.js` - Two-hand display
- `src/modules/notation/noteEditor.js` - Click-to-edit
- `src/modules/notation/vexFlowMigration.js` - Data format conversion

#### UI Components

**Toolbar:**
```
[♩ Quarter ▼] [♪ Eighth] [𝅗𝅥 Half] [𝅝 Whole] | [+ Rest] [· Dot]
[Voice 1 ▼] | [Zoom: 100% ▼] | [4 measures/line ▼]
```

**Staff Display:**
```
┌─────────────────────────────────────────────────────────┐
│ Measure 1        Measure 2        Measure 3    Measure 4│
│ ┌─ C Major ────┬───────────────┬────────────┬──────────┐│
│ │🎼 ♩ ♩ ♩ ♩    │  𝅗𝅥     𝅗𝅥    │            │          ││
│ ├──────────────┼───────────────┼────────────┼──────────┤│
│ │🎹 𝅝          │  𝅗𝅥     𝅗𝅥    │            │          ││
│ └──────────────┴───────────────┴────────────┴──────────┘│
└─────────────────────────────────────────────────────────┘
```

#### Data Model Integration

```javascript
// Bridge between existing notation and VexFlow
export function convertToVexFlow(melodyComposerData) {
  return melodyComposerData.measures.map(measure => ({
    number: measure.number,
    keySignature: measure.key,
    timeSignature: measure.timeSignature,
    trebleNotes: measure.melody.map(note => ({
      keys: [`${note.pitch}/${note.octave}`],
      duration: convertDuration(note.duration)
    })),
    bassNotes: measure.bass.map(note => ({
      keys: [`${note.pitch}/${note.octave}`],
      duration: convertDuration(note.duration)
    }))
  }));
}
```

#### Success Metrics
- [ ] VexFlow renders all current melodies correctly
- [ ] Grand staff displays with proper brace
- [ ] Note entry works via click
- [ ] 60fps performance with 50+ measures
- [ ] Supports 100+ measures without lag
- [ ] Clean export to PDF
- [ ] Backward compatible with existing data

#### Risk Mitigation
- **VexFlow learning curve**: Start with simple examples, use official documentation
- **Performance**: Implement virtual scrolling, only render visible measures
- **Data migration**: Create migration script for existing compositions
- **Browser compatibility**: VexFlow well-supported, test Chrome/Firefox/Safari

---

## Phase 5: Enhanced Integration & Sync
**Priority: HIGH - Makes the app feel cohesive**

### 5.1 Complete Bi-Directional Sync
**Duration:** 1-2 weeks
**Priority:** High

#### Features

**Progression → Notation Sync:**
- Change chord in Progression Builder → updates Melody Composer
- Bass auto-fills with voice leading
- Chord symbol updates above staff

**Notation → Progression Sync:**
- Edit chord in Melody Composer → updates Progression Builder
- Trigger recommendation refresh
- Keep recommendation panel in sync

**Event System:**
```javascript
// Unified event flow
compositionState.on('chordChanged', (measureIndex, chord) => {
  progressionBuilder.updateChord(measureIndex, chord);
  melodyComposer.updateChordDisplay(measureIndex, chord);
  recommendationPanel.refreshSuggestions(measureIndex);
});
```

#### Implementation Files
- Update `src/modules/integration/progressionNotationSync.js`
- Update `src/modules/state/compositionState.js`

#### Success Metrics
- [ ] Changes sync within 50ms
- [ ] No infinite loops (proper debouncing)
- [ ] Undo/redo works across sync boundary
- [ ] Clear visual feedback on sync

---

### 5.2 Voice Leading Visualization
**Duration:** 2 weeks
**Priority:** Medium

*Previously deferred from Phase 3.2*

#### Features

**Visual Elements:**
- SVG lines connecting notes between chords
- Line color indicates quality:
  - Green: Common tone
  - Blue: Stepwise motion
  - Orange: Skip (3rd-5th)
  - Red: Large leap (6th+)

**Analysis Overlays:**
- Parallel 5ths/octaves warnings (red highlight)
- Voice crossing indicators
- Voice range indicators (soprano/alto/tenor/bass)

**Smoothness Scoring:**
- Per-transition score (0-100)
- Overall progression score
- Suggestions for improvement

#### Implementation Files
- `src/modules/ui/voiceLeadingVisualizer.js` - SVG rendering
- `src/modules/analysis/voiceLeadingAnalyzer.js` - Detection

#### Success Metrics
- [ ] Accurate voice connection lines
- [ ] Parallel motion detection works
- [ ] Smooth animation on chord change
- [ ] Educational tooltips on hover

---

### 5.3 Real-Time Sidebar Recommendations
**Duration:** 1 week
**Priority:** Medium

#### Features

**Docked Panel:**
- Always visible while composing
- Shows "Next Chord" suggestions (top 5)
- Updates as cursor moves between measures

**Quick Actions:**
- Preview button (plays chord)
- Insert button (adds to progression + auto-arranges)
- "Show All" link to full explorer

**Context Display:**
- Current measure number
- Current chord
- Key signature
- Tension direction

#### Implementation Files
- Update `src/modules/ui/recommendationsSidebar.js`
- `src/modules/features/realtimeRecommendations.js`

#### Success Metrics
- [ ] Updates on cursor move (<100ms)
- [ ] Preview plays correct voicing
- [ ] Insert adds chord + bass
- [ ] Doesn't block notation editing

---

## Phase 6: Professional Output & Advanced Editing
**Priority: HIGH for export, MEDIUM for editing**

### 6.1 Enhanced Export System
**Duration:** 2-3 weeks
**Priority:** High

#### Features

**MusicXML Export:**
- Full score with treble + bass
- Chord symbols above staff
- Key/time signatures
- Opens in MuseScore, Sibelius, Finale

**MIDI Import:**
- Parse .mid files
- Extract melody + bass lines
- Detect chords from notes
- Load into Melody Composer

**PDF Sheet Music:**
- Print-ready layout
- Proper notation rendering
- Title, composer, tempo markings

**Audio Export:**
- WAV or MP3 format
- Uses current Tone.js sounds
- Includes melody + chords

#### Implementation Files
- `src/modules/export/musicXMLExporter.js`
- `src/modules/import/midiImporter.js`
- `src/modules/export/pdfExporter.js`
- `src/modules/export/audioExporter.js`

#### Success Metrics
- [ ] MusicXML opens correctly in MuseScore
- [ ] MIDI import handles common files
- [ ] PDF is print-quality
- [ ] Audio matches playback

---

### 6.2 Copy/Paste/Undo System
**Duration:** 1-2 weeks
**Priority:** Medium

#### Features

**Selection:**
- Click to select single measure
- Shift+click for range
- Ctrl+A for all

**Clipboard Operations:**
- Ctrl+C: Copy measures
- Ctrl+V: Paste at cursor
- Ctrl+X: Cut measures
- Delete: Remove measures

**Undo/Redo:**
- Ctrl+Z: Undo (50 steps)
- Ctrl+Y: Redo
- Works across all operations
- Shows action name in status

#### Implementation Files
- Update `src/modules/utils/undoRedo.js`
- `src/modules/features/clipboardManager.js`

#### Success Metrics
- [ ] 50-step undo history
- [ ] Copy/paste works for 1-16 measures
- [ ] Keyboard shortcuts work
- [ ] No data loss on undo

---

## Phase 7: New Feature Ideas (Expanded)

### For Beginners (Accessibility)

#### Guided Songwriting Wizard
**Duration:** 2 weeks

Step-by-step composition flow:
1. "What mood?" → Select emotion
2. "What style?" → Select genre
3. "Pick a template" → Show filtered options
4. "Write your melody" → AI suggestions enabled
5. "Export your song" → Multiple formats

#### Theory Explanations on Hover
**Duration:** 1 week

Tooltips explaining:
- "V → I is called an authentic cadence"
- "The IV chord is subdominant - creates gentle tension"
- "This Am is the relative minor of C"

#### Difficulty Ratings
**Duration:** 3 days

Mark features and templates:
- 🟢 Beginner
- 🟡 Intermediate
- 🔴 Advanced

Show skill-appropriate defaults.

---

### For Intermediate Users (Productivity)

#### Song Form Builder
**Duration:** 2 weeks

Pre-built structures:
- Verse (4-8 bars) → Chorus (8 bars) → Bridge (4 bars)
- AABA jazz form
- 12-bar blues

Visual timeline with sections.

#### Rhythm Pattern Library
**Duration:** 1-2 weeks

Genre-specific comping:
- Ballad: whole notes
- Rock: steady eighths
- Jazz: comping rhythms
- Latin: montuno patterns

Apply to bass or chords.

#### Quick Arrangement Styles
**Duration:** 1 week

One-click arrangements:
- "Ballad": arpeggiated bass, sustained chords
- "Rock": power chord voicings
- "Jazz": walking bass, shell voicings
- "Classical": Alberti bass

#### Progression Variations
**Duration:** 1 week

Suggestions like:
- "Try substituting vi for I"
- "Add a passing chord between IV and V"
- "Use tritone substitution for V"

---

### For Advanced Users (Power)

#### Custom Scale Support
**Duration:** 2 weeks

Beyond major/minor:
- Harmonic minor
- Melodic minor
- All 7 modes
- Pentatonic scales
- Blues scale

Affects melody suggestions and chord recommendations.

#### Reharmonization Tools
**Duration:** 2-3 weeks

Advanced substitutions:
- Tritone substitution
- Chord substitution chart
- "Jazz up this progression" one-click
- Secondary dominants

#### Multi-Section Compositions
**Duration:** 2 weeks

Full song structure:
- Intro → Verse → Pre-Chorus → Chorus → Bridge → Outro
- Section navigation
- Section-specific key/tempo
- Section repeat markers

#### Modulation Assistant
**Duration:** 1-2 weeks

Key change helpers:
- Common pivot chords
- Chromatic modulation options
- Visual key relationship (circle of fifths)
- Smooth transition suggestions

---

### For All Users (Polish)

#### Practice Mode
**Duration:** 2 weeks

Ear training with user's progressions:
- "What chord comes next?"
- "Is this note a chord tone?"
- Interval recognition
- Rhythm dictation

#### Session History
**Duration:** 1 week

Full timeline:
- Auto-save every 30 seconds
- Named restore points
- Compare versions
- Revert to any point

#### Collaborative Features
**Duration:** 3-4 weeks

Share and collaborate:
- Share progression via link
- Embed in websites
- Real-time collaboration (future)
- Community template library

#### Mobile Companion
**Duration:** 4-6 weeks

Responsive design:
- View progressions on phone
- Playback controls
- Basic editing
- Sync with desktop

---

## Implementation Timeline

| Phase | Feature | Duration | Priority | Dependencies |
|-------|---------|----------|----------|--------------|
| **4.1** | Melody Suggestion Engine | 2-3 weeks | 🔥 Critical | None |
| **4.2** | Auto-Harmonize | 2 weeks | 🔥 Critical | 4.1 |
| **4.3** | Chord Tone Highlighting | 1 week | High | None |
| **5.1** | Bi-Directional Sync | 1-2 weeks | High | None |
| **5.2** | Voice Leading Visualization | 2 weeks | Medium | 5.1 |
| **5.3** | Real-Time Sidebar | 1 week | Medium | 5.1 |
| **6.1** | Export System | 2-3 weeks | High | None |
| **6.2** | Copy/Paste/Undo | 1-2 weeks | Medium | None |
| **6.3** | VexFlow Integration | 4-6 weeks | Lower | 6.2 |
| --- | **New Ideas** | --- | --- | --- |
| | Guided Wizard | 2 weeks | Medium | 4.1, 4.2 |
| | Theory Tooltips | 1 week | Medium | None |
| | Song Form Builder | 2 weeks | Medium | 5.1 |
| | Custom Scales | 2 weeks | Low | 4.1 |
| | Reharmonization | 2-3 weeks | Low | 5.1 |
| | Practice Mode | 2 weeks | Low | None |
| | Mobile Companion | 4-6 weeks | Low | 6.1 |

**Total Estimated Time:** 16-24 weeks for core features (Phases 4-6)

---

## Competitive Analysis

| Feature | MuseScore | Flat.io | Noteflight | Hookpad | **Music Theory Lab** |
|---------|-----------|---------|------------|---------|---------------------|
| **Free** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **AI Chord Recommendations** | ❌ | ❌ | ❌ | ⚠️ Limited | ✅✅ |
| **AI Melody Suggestions** | ❌ | ❌ | ❌ | ❌ | ✅✅ (Phase 4.1) |
| **Auto-Harmonize** | ❌ | ❌ | ❌ | ❌ | ✅✅ (Phase 4.2) |
| **Voice Leading Analysis** | ❌ | ❌ | ❌ | ❌ | ✅✅ |
| **Modal Interchange** | ❌ | ❌ | ❌ | ⚠️ | ✅✅ |
| **Tension Visualization** | ❌ | ❌ | ❌ | ⚠️ | ✅✅ |
| **Template Library** | ❌ | ❌ | ❌ | ✅ | ✅✅ |
| **Professional Notation** | ✅✅ | ✅ | ✅ | ❌ | ⚠️ → ✅ (Phase 6.3) |
| **Beginner-Friendly** | ⚠️ | ✅ | ✅ | ✅ | ✅✅ (with wizard) |
| **MusicXML Export** | ✅✅ | ✅ | ✅ | ❌ | ⚠️ → ✅ (Phase 6.1) |

**Unique Value Proposition:**

> *"Music Theory Lab is the only composition software that helps you compose, not just notate. Start with chords or melody, and let AI help you create complete arrangements."*

---

## Success Metrics (Overall)

### User Engagement
- [ ] Average session length > 15 minutes
- [ ] Return rate > 40% weekly
- [ ] Completion rate (export) > 25%

### Feature Adoption
- [ ] 80%+ users try melody suggestions
- [ ] 60%+ users use auto-harmonize
- [ ] 50%+ users export at least once

### Quality
- [ ] AI suggestions rated "helpful" 80%+
- [ ] Voice leading scores average > 80
- [ ] Export files open correctly 95%+

### Growth
- [ ] Word-of-mouth referrals
- [ ] Community template submissions
- [ ] Educational institution adoption

---

## Immediate Next Steps

### Week 1-2: Melody Suggestion Engine Foundation
1. Design `melodySuggestion.js` algorithm
2. Create sidebar UI component
3. Implement chord tone detection
4. Add stepwise motion analysis
5. Build click-to-insert workflow

### Week 3: Integration & Testing
1. Connect to existing Melody Composer
2. Add style-aware filtering
3. Test with various progressions
4. Gather feedback and iterate

### Week 4-5: Auto-Harmonize
1. Build melody analysis algorithm
2. Create chord matching system
3. Design modal UI
4. Implement apply workflow

### Week 6: Polish & Documentation
1. Performance optimization
2. User documentation
3. Tutorial/onboarding
4. Bug fixes

---

## Technical Considerations

### Performance
- Melody suggestions: <100ms response
- Sync operations: <50ms
- Rendering: 60fps minimum
- Large progressions: 100+ measures support

### Architecture
- Maintain modular structure
- Use event-driven sync
- Keep state centralized
- Cache expensive calculations

### Testing
- Unit tests for algorithms
- Integration tests for sync
- User acceptance testing
- Performance benchmarks

### Accessibility
- Keyboard navigation
- Screen reader support
- High contrast mode
- Tooltips for all icons

---

## Conclusion

This roadmap positions Music Theory Lab as the premier AI-assisted composition tool. By prioritizing **Phase 4 (AI-Assisted Composition)**, we create immediate differentiation from competitors while building on our existing strengths in harmonic analysis and chord recommendations.

The phased approach allows for:
- **Incremental value delivery** - Each phase is independently useful
- **User feedback integration** - Iterate based on real usage
- **Risk management** - Validate before proceeding
- **Resource flexibility** - Adjust timeline as needed

**Recommended starting point:** Phase 4.1 - Melody Suggestion Engine

This feature will create immediate "wow moments" for users, demonstrate the unique value proposition, and provide a foundation for the auto-harmonize feature.

---

**Document Created:** November 2024
**Project:** Music Theory Lab
**Version:** 1.0
