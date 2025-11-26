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

These features are organized by user skill level and include detailed specifications for implementation.

---

### 7.1 Guided Songwriting Wizard
**Duration:** 2-3 weeks
**Priority:** High
**Target Users:** Beginners

#### Features

**Step-by-Step Flow:**
1. **Welcome Screen**: "Let's write a song together!"
2. **Mood Selection**: Visual cards with emotions (Happy, Sad, Energetic, Calm, Mysterious)
3. **Style Selection**: Genre cards (Pop, Rock, Jazz, Classical, Electronic)
4. **Template Selection**: Filtered templates based on mood/style
5. **Structure Selection**: Verse-Chorus, AABA, 12-bar, Custom
6. **Composition Mode**: AI suggestions enabled, guided tooltips
7. **Export Options**: MIDI, PDF, Audio, Share link

**Intelligent Defaults:**
- Auto-set tempo based on mood (Energetic = 130bpm, Calm = 70bpm)
- Pre-select appropriate key (Bright = C Major, Dark = A Minor)
- Enable melody suggestions by default
- Show only beginner-friendly chord types

**Progress Tracking:**
- Visual progress bar through steps
- "Skip to advanced" option for experienced users
- Save progress and resume later

#### UI Components

**Wizard Modal:**
```
┌──────────────────────────────────────────────────────┐
│ 🎵 Songwriting Wizard                    Step 2 of 7 │
├──────────────────────────────────────────────────────┤
│                                                       │
│  What style are you going for?                       │
│                                                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│  │   🎸    │  │   🎹    │  │   🎷    │              │
│  │   Pop   │  │Classical│  │   Jazz  │              │
│  │ ✓ Selected│ │         │  │         │              │
│  └─────────┘  └─────────┘  └─────────┘              │
│                                                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│  │   🎸    │  │   🎹    │  │   🎧    │              │
│  │   Rock  │  │  Blues  │  │Electronic│              │
│  └─────────┘  └─────────┘  └─────────┘              │
│                                                       │
│         [← Back]              [Next →]               │
└──────────────────────────────────────────────────────┘
```

#### Implementation Files
- `src/modules/ui/songwritingWizard.js` - Main wizard controller
- `src/modules/ui/wizardSteps/moodSelector.js` - Mood selection step
- `src/modules/ui/wizardSteps/styleSelector.js` - Style selection step
- `src/modules/ui/wizardSteps/structureBuilder.js` - Song structure step
- `src/modules/config/wizardDefaults.js` - Mood/style → settings mapping

#### Success Metrics
- [ ] Complete wizard flow in <3 minutes
- [ ] 90%+ beginner users complete first song
- [ ] Mood → settings mapping produces appropriate results
- [ ] Skip option works for experienced users
- [ ] Progress saves to localStorage

---

### 7.2 Theory Explanations on Hover
**Duration:** 1-2 weeks
**Priority:** High
**Target Users:** Beginners, Intermediate

#### Features

**Contextual Tooltips:**
- Hover over any chord → see theory explanation
- Hover over roman numeral → see function description
- Hover over pattern badge → see pattern explanation
- Hover over tension score → see what creates tension

**Explanation Categories:**

**Chord Function Explanations:**
```javascript
const FUNCTION_EXPLANATIONS = {
  tonic: {
    title: "Tonic (I)",
    description: "Home base - feels resolved and stable",
    examples: "Usually starts and ends songs"
  },
  subdominant: {
    title: "Subdominant (IV, ii)",
    description: "Creates gentle movement away from home",
    examples: "Often leads to dominant chords"
  },
  dominant: {
    title: "Dominant (V, vii°)",
    description: "Creates tension that wants to resolve to tonic",
    examples: "V → I is the strongest resolution"
  }
};
```

**Progression Explanations:**
- "V → I is called an **authentic cadence** - the strongest resolution"
- "IV → I is a **plagal cadence** - sometimes called the 'Amen' cadence"6
- "ii → V → I is the **most common jazz progression**"

**Modal Interchange Explanations:**
- "This bVII is **borrowed from the parallel minor** - adds darkness"
- "The iv chord is a **common borrowed chord** - heard in many pop songs"

**Voice Leading Explanations:**
- "These chords share **2 common tones** - creates smooth connection"
- "The bass moves by **step** (C → D) - very smooth"
- "Warning: **parallel fifths** between soprano and alto"

#### UI Components

**Tooltip Design:**
```
┌─────────────────────────────────┐
│ F Major (IV) - Subdominant      │
├─────────────────────────────────┤
│ Creates gentle tension, often   │
│ leads to V (dominant).          │
│                                 │
│ Common progressions:            │
│ • I → IV → V → I               │
│ • IV → iv → I (minor plagal)   │
│                                 │
│ Famous uses:                    │
│ • "Let It Be" (Beatles)        │
│ • "No Woman No Cry" (Marley)   │
│                                 │
│ [Learn More →]                  │
└─────────────────────────────────┘
```

#### Implementation Files
- `src/modules/ui/theoryTooltips.js` - Tooltip rendering system
- `src/modules/data/theoryExplanations.js` - All explanation content
- `src/modules/data/famousSongs.js` - Song examples database
- `src/modules/analysis/tooltipTriggers.js` - When to show tooltips

#### Success Metrics
- [ ] Tooltips appear within 200ms of hover
- [ ] 100+ unique explanations
- [ ] Toggle on/off in settings
- [ ] "Learn More" links to external resources
- [ ] Mobile long-press support

---

### 7.3 Difficulty Ratings System
**Duration:** 1 week
**Priority:** Medium
**Target Users:** All

#### Features

**Rating Levels:**
- 🟢 **Beginner**: Simple triads, common progressions, basic rhythms
- 🟡 **Intermediate**: 7th chords, borrowed chords, syncopation
- 🔴 **Advanced**: Extended chords, complex voice leading, modulation

**Applied To:**
- Templates in browser
- Chord types in recommendations
- Features in UI (hide advanced by default)
- Patterns detected

**User Skill Setting:**
- Set in preferences
- Filters content appropriately
- Can always "show advanced"

#### Implementation
```javascript
const DIFFICULTY_RATINGS = {
  chordTypes: {
    'Major': 'beginner',
    'Minor': 'beginner',
    'Dominant 7th': 'intermediate',
    'Major 7th': 'intermediate',
    'Minor 7th': 'intermediate',
    'Diminished': 'intermediate',
    'Augmented': 'advanced',
    'Half-Diminished': 'advanced',
    '9th': 'advanced',
    '11th': 'advanced',
    '13th': 'advanced'
  },
  patterns: {
    'I-IV-V': 'beginner',
    'I-V-vi-IV': 'beginner',
    'ii-V-I': 'intermediate',
    'I-vi-ii-V': 'intermediate',
    'Rhythm Changes': 'advanced'
  }
};
```

#### Implementation Files
- `src/modules/config/difficultyRatings.js` - Rating definitions
- `src/modules/ui/difficultyFilter.js` - Filter UI component
- Update `src/modules/ui/templateBrowserModal.js` - Show badges
- Update `src/modules/features/chordRecommendations.js` - Filter by skill

#### Success Metrics
- [ ] All templates have difficulty rating
- [ ] All chord types have rating
- [ ] User preference persists
- [ ] Filter reduces noise for beginners
- [ ] Advanced users see everything

---

### 7.4 Song Form Builder
**Duration:** 2-3 weeks
**Priority:** High
**Target Users:** Intermediate, Advanced

#### Features

**Pre-Built Forms:**
```javascript
const SONG_FORMS = {
  'verse-chorus': {
    name: 'Verse-Chorus',
    sections: [
      { type: 'verse', measures: 8, label: 'Verse 1' },
      { type: 'chorus', measures: 8, label: 'Chorus' },
      { type: 'verse', measures: 8, label: 'Verse 2' },
      { type: 'chorus', measures: 8, label: 'Chorus' },
      { type: 'bridge', measures: 4, label: 'Bridge' },
      { type: 'chorus', measures: 8, label: 'Final Chorus' }
    ]
  },
  'aaba': {
    name: 'AABA (32-bar)',
    sections: [
      { type: 'A', measures: 8 },
      { type: 'A', measures: 8 },
      { type: 'B', measures: 8, label: 'Bridge' },
      { type: 'A', measures: 8 }
    ]
  },
  '12-bar-blues': {
    name: '12-Bar Blues',
    sections: [
      { type: 'I', measures: 4 },
      { type: 'IV', measures: 2 },
      { type: 'I', measures: 2 },
      { type: 'V', measures: 1 },
      { type: 'IV', measures: 1 },
      { type: 'I', measures: 2 }
    ]
  }
};
```

**Visual Timeline:**
- Drag-and-drop sections
- Color-coded by section type
- Resize sections by dragging edges
- Double-click to edit section properties

**Section Properties:**
- Name/label
- Number of measures
- Key (for modulation)
- Tempo (for tempo changes)
- Repeat count

**Navigation:**
- Click section to jump
- Keyboard shortcuts (1-9 for sections)
- Mini-map showing full structure

#### UI Components

**Timeline View:**
```
┌──────────────────────────────────────────────────────────┐
│ Song Structure                              [+ Section]   │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ ┌────────┬────────┬────────┬────────┬──────┬──────────┐ │
│ │ Intro  │ Verse 1│ Chorus │ Verse 2│Bridge│  Outro   │ │
│ │  4m    │   8m   │   8m   │   8m   │  4m  │    4m    │ │
│ │  🔵    │   🟢   │   🟣   │   🟢   │  🟡  │    🔵    │ │
│ └────────┴────────┴────────┴────────┴──────┴──────────┘ │
│                                                           │
│ Total: 36 measures | ~2:24 at 120 BPM                    │
└──────────────────────────────────────────────────────────┘
```

#### Implementation Files
- `src/modules/features/songFormBuilder.js` - Core logic
- `src/modules/ui/songFormTimeline.js` - Visual timeline
- `src/modules/ui/sectionEditor.js` - Section properties modal
- `src/modules/data/songForms.js` - Pre-built form templates
- `src/modules/state/songStructure.js` - Structure state management

#### Success Metrics
- [ ] 10+ pre-built forms
- [ ] Drag-and-drop works smoothly
- [ ] Section navigation works
- [ ] Key/tempo per section
- [ ] Export respects structure

---

### 7.5 Rhythm Pattern Library
**Duration:** 2 weeks
**Priority:** High
**Target Users:** Intermediate

#### Features

**Pattern Categories:**
```javascript
const RHYTHM_PATTERNS = {
  bass: {
    'whole-notes': { name: 'Whole Notes', pattern: ['w'] },
    'root-fifth': { name: 'Root-Fifth', pattern: ['q', 'q', 'q', 'q'] },
    'walking': { name: 'Walking Bass', pattern: ['q', 'q', 'q', 'q'], melodic: true },
    'alberti': { name: 'Alberti Bass', pattern: ['e', 'e', 'e', 'e', 'e', 'e', 'e', 'e'] },
    'arpeggio': { name: 'Arpeggio', pattern: ['e', 'e', 'e', 'e'] },
    'shuffle': { name: 'Shuffle', pattern: ['q.', 'e', 'q.', 'e'], swing: true }
  },
  comping: {
    'block': { name: 'Block Chords', pattern: ['w'] },
    'charleston': { name: 'Charleston', pattern: ['q.', 'e', 'h'] },
    'bossa': { name: 'Bossa Nova', pattern: ['e.', 's', 'e', 'e.', 's', 'e', 'q'] },
    'rock-steady': { name: 'Rock Steady', pattern: ['e', 'e', 'e', 'e', 'e', 'e', 'e', 'e'] }
  }
};
```

**Pattern Browser:**
- Filter by genre (Jazz, Latin, Rock, Pop, Classical)
- Preview pattern with current chord
- Apply to selected measures or all
- Customize pattern (edit individual hits)

**Visual Pattern Editor:**
- Grid showing beats and subdivisions
- Click to toggle hits
- Drag to adjust duration
- Save custom patterns

#### UI Components

**Pattern Browser:**
```
┌─────────────────────────────────────────────┐
│ Rhythm Patterns           [Bass ▼] [All ▼]  │
├─────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐    │
│ │ Root-Fifth      │ │ Walking Bass    │    │
│ │ ♩ ♩ ♩ ♩        │ │ ♩ ♩ ♩ ♩        │    │
│ │ [▶] [Apply]     │ │ [▶] [Apply]     │    │
│ └─────────────────┘ └─────────────────┘    │
│ ┌─────────────────┐ ┌─────────────────┐    │
│ │ Arpeggio        │ │ Alberti         │    │
│ │ ♪♪♪♪           │ │ ♪♪♪♪♪♪♪♪       │    │
│ │ [▶] [Apply]     │ │ [▶] [Apply]     │    │
│ └─────────────────┘ └─────────────────┘    │
└─────────────────────────────────────────────┘
```

#### Implementation Files
- `src/modules/features/rhythmPatternLibrary.js` - Pattern database
- `src/modules/ui/rhythmPatternBrowser.js` - Browser UI
- `src/modules/ui/rhythmPatternEditor.js` - Custom pattern editor
- `src/modules/audio/patternPlayer.js` - Pattern preview playback

#### Success Metrics
- [ ] 20+ pre-built patterns
- [ ] Genre filtering works
- [ ] Preview plays correctly
- [ ] Apply updates notation
- [ ] Custom patterns save

---

### 7.6 Reharmonization Tools
**Duration:** 3-4 weeks
**Priority:** Medium
**Target Users:** Advanced

#### Features

**Substitution Types:**
```javascript
const SUBSTITUTIONS = {
  tritone: {
    name: 'Tritone Substitution',
    description: 'Replace dominant with chord a tritone away',
    example: 'G7 → Db7',
    apply: (chord) => transposeSemitones(chord, 6)
  },
  relativeMinor: {
    name: 'Relative Minor',
    description: 'Replace major with its relative minor',
    example: 'C → Am',
    apply: (chord) => getRelativeMinor(chord)
  },
  secondaryDominant: {
    name: 'Secondary Dominant',
    description: 'Add dominant before any chord',
    example: 'Dm → A7 → Dm',
    apply: (chord) => getDominantOf(chord)
  },
  diminishedPassing: {
    name: 'Diminished Passing',
    description: 'Add diminished chord between',
    example: 'C → C#dim → Dm',
    apply: (chord1, chord2) => getDiminishedBetween(chord1, chord2)
  }
};
```

**"Jazz It Up" One-Click:**
- Analyze progression
- Apply appropriate substitutions
- Add 7ths to all chords
- Insert passing chords
- Show before/after comparison

**Chord Substitution Chart:**
- Visual matrix of substitution options
- Click to apply
- Hear comparison
- Undo instantly

#### UI Components

**Reharmonization Panel:**
```
┌──────────────────────────────────────────────────┐
│ Reharmonization Tools                             │
├──────────────────────────────────────────────────┤
│ Original: C → Am → F → G                         │
│                                                   │
│ Suggestions:                                      │
│ ┌─────────────────────────────────────────────┐ │
│ │ ✨ Jazz It Up                               │ │
│ │ Cmaj7 → A7 → Dm7 → G7 → Cmaj7              │ │
│ │ [▶ Preview] [Apply]                         │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🔄 Tritone Sub on V                        │ │
│ │ C → Am → F → Db7                           │ │
│ │ [▶ Preview] [Apply]                         │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ ➕ Add Secondary Dominants                  │ │
│ │ C → E7 → Am → C7 → F → D7 → G              │ │
│ │ [▶ Preview] [Apply]                         │ │
│ └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

#### Implementation Files
- `src/modules/features/reharmonization.js` - Substitution algorithms
- `src/modules/ui/reharmonizationPanel.js` - Panel UI
- `src/modules/analysis/substitutionAnalyzer.js` - Suggest substitutions
- `src/modules/data/substitutionRules.js` - Substitution definitions

#### Success Metrics
- [ ] All substitution types work correctly
- [ ] "Jazz It Up" produces musical results
- [ ] Preview plays comparison
- [ ] Undo restores original
- [ ] Voice leading maintained

---

### 7.7 Custom Scale Support
**Duration:** 2 weeks
**Priority:** Medium
**Target Users:** Intermediate, Advanced

#### Features

**Supported Scales:**
```javascript
const SCALES = {
  // Major modes
  'ionian': [0, 2, 4, 5, 7, 9, 11],      // Major
  'dorian': [0, 2, 3, 5, 7, 9, 10],
  'phrygian': [0, 1, 3, 5, 7, 8, 10],
  'lydian': [0, 2, 4, 6, 7, 9, 11],
  'mixolydian': [0, 2, 4, 5, 7, 9, 10],
  'aeolian': [0, 2, 3, 5, 7, 8, 10],     // Natural minor
  'locrian': [0, 1, 3, 5, 6, 8, 10],

  // Other scales
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11],
  'pentatonic-major': [0, 2, 4, 7, 9],
  'pentatonic-minor': [0, 3, 5, 7, 10],
  'blues': [0, 3, 5, 6, 7, 10],
  'whole-tone': [0, 2, 4, 6, 8, 10],
  'diminished': [0, 2, 3, 5, 6, 8, 9, 11]
};
```

**Scale Integration:**
- Melody suggestions use selected scale
- Chord recommendations match scale
- Scale degree colors on keyboard
- Scale reference in sidebar

**Scale Visualization:**
- Circle of fifths with scale highlighted
- Keyboard with scale tones marked
- Staff with scale ascending/descending

#### Implementation Files
- `src/modules/data/scales.js` - Scale definitions
- `src/modules/analysis/scaleAnalyzer.js` - Scale detection
- `src/modules/ui/scaleSelector.js` - Scale picker UI
- Update `src/modules/ai/melodySuggestion.js` - Use selected scale
- Update `src/modules/features/chordRecommendations.js` - Scale-aware

#### Success Metrics
- [ ] 15+ scales supported
- [ ] Melody suggestions respect scale
- [ ] Chord recommendations match
- [ ] Visual scale display accurate
- [ ] Mode interchange detection

---

### 7.8 Practice Mode (Ear Training)
**Duration:** 2-3 weeks
**Priority:** Medium
**Target Users:** All

#### Features

**Exercise Types:**

**Chord Identification:**
- Hear chord → identify type (Major, Minor, Dom7, etc.)
- Progressive difficulty
- Use chords from user's progression

**Progression Dictation:**
- Hear 4-chord progression → identify chords
- Start with I-IV-V, advance to jazz changes
- Show roman numerals or chord names

**Interval Recognition:**
- Hear two notes → identify interval
- Melodic and harmonic modes
- Use intervals from user's melody

**Chord Tone Ear Training:**
- Hear chord + single note → is it a chord tone?
- Identify which degree (root, 3rd, 5th, 7th)
- Builds melody writing intuition

**Progress Tracking:**
- Accuracy percentage per exercise
- Streak counter
- Difficulty auto-adjusts
- Badges/achievements

#### UI Components

**Practice Mode Screen:**
```
┌──────────────────────────────────────────────────┐
│ 🎧 Ear Training - Chord Identification           │
├──────────────────────────────────────────────────┤
│                                                   │
│                 [▶ Play Again]                    │
│                                                   │
│  What type of chord is this?                     │
│                                                   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │ Major  │ │ Minor  │ │  Dom7  │ │ Maj7   │   │
│  └────────┘ └────────┘ └────────┘ └────────┘   │
│                                                   │
│  Streak: 🔥 7 | Accuracy: 82% | Level: 3        │
│                                                   │
│  [Exit Practice]                                 │
└──────────────────────────────────────────────────┘
```

#### Implementation Files
- `src/modules/features/practiceMode.js` - Exercise controller
- `src/modules/features/exercises/chordIdentification.js`
- `src/modules/features/exercises/progressionDictation.js`
- `src/modules/features/exercises/intervalRecognition.js`
- `src/modules/ui/practiceUI.js` - Practice mode UI
- `src/modules/storage/practiceProgress.js` - Progress persistence

#### Success Metrics
- [ ] 4+ exercise types
- [ ] Difficulty progression works
- [ ] Progress saves to localStorage
- [ ] Uses user's own progressions
- [ ] Accuracy tracking accurate

---

### 7.9 Multi-Section Compositions
**Duration:** 2-3 weeks
**Priority:** High
**Target Users:** Intermediate, Advanced

#### Features

**Section Management:**
- Add/remove sections (Intro, Verse, Chorus, Bridge, Outro, Custom)
- Reorder sections via drag-and-drop
- Copy sections (Verse 1 → Verse 2)
- Section-specific settings:
  - Key signature (for modulation)
  - Tempo (for tempo changes)
  - Time signature

**Section Linking:**
- Repeat markers (1st/2nd endings)
- D.C. al Coda, D.S. al Fine
- Section repeat count

**Navigation:**
- Section tabs/dropdown
- Mini-map showing full composition
- Keyboard shortcuts (Ctrl+1-9)
- "Go to section" command

**Transitions:**
- Auto-suggest transition chords between sections
- Modulation detection and assistance
- Common tone highlighting

#### UI Components

**Section Tabs:**
```
┌──────────────────────────────────────────────────────────┐
│ [Intro] [Verse 1] [Chorus] [Verse 2] [Bridge] [Outro] [+]│
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Section: Chorus | Key: G Major | Tempo: 128 | 4/4       │
│  Measures: 1-8 of 8                                       │
│                                                           │
│  [Notation content...]                                    │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

#### Implementation Files
- `src/modules/features/sectionManager.js` - Section CRUD
- `src/modules/state/sectionState.js` - Section data model
- `src/modules/ui/sectionTabs.js` - Tab navigation
- `src/modules/ui/sectionMinimap.js` - Overview minimap
- `src/modules/analysis/transitionAnalyzer.js` - Transition suggestions

#### Success Metrics
- [ ] 6+ section types
- [ ] Modulation between sections works
- [ ] Navigation is intuitive
- [ ] Export includes all sections
- [ ] Playback respects repeats

---

### 7.10 Session History & Auto-Save
**Duration:** 1-2 weeks
**Priority:** High
**Target Users:** All

#### Features

**Auto-Save:**
- Save every 30 seconds
- Save on every significant action
- Background save (non-blocking)
- localStorage + optional cloud

**Version History:**
- Timeline of all saves
- Named checkpoints ("Before jazz reharmonization")
- Preview any version
- Restore with confirmation

**Compare Versions:**
- Side-by-side diff view
- Highlight changes
- Cherry-pick specific changes

**Crash Recovery:**
- Detect unsaved work on load
- Offer to restore
- Never lose more than 30 seconds

#### UI Components

**History Panel:**
```
┌─────────────────────────────────────────┐
│ Session History                   [×]   │
├─────────────────────────────────────────┤
│ 📌 Before adding bridge (checkpoint)    │
│    Today, 3:45 PM                       │
│    [Preview] [Restore]                  │
│                                         │
│ ○  Auto-save                           │
│    Today, 3:42 PM                       │
│    [Preview] [Restore]                  │
│                                         │
│ ○  Auto-save                           │
│    Today, 3:38 PM                       │
│    [Preview] [Restore]                  │
│                                         │
│ ○  Added chorus section                │
│    Today, 3:35 PM                       │
│    [Preview] [Restore]                  │
│                                         │
│ [+ Create Checkpoint]                   │
└─────────────────────────────────────────┘
```

#### Implementation Files
- `src/modules/storage/autoSave.js` - Auto-save controller
- `src/modules/storage/versionHistory.js` - History management
- `src/modules/ui/historyPanel.js` - History UI
- `src/modules/ui/versionCompare.js` - Diff view

#### Success Metrics
- [ ] Auto-save every 30 seconds
- [ ] 50+ versions retained
- [ ] Restore works correctly
- [ ] Crash recovery works
- [ ] Minimal performance impact

---

### 7.11 Collaboration & Sharing
**Duration:** 3-4 weeks
**Priority:** Medium
**Target Users:** All

#### Features

**Share via Link:**
- Generate unique URL
- Viewer mode (read-only)
- Editor mode (with password)
- Embed code for websites

**Export/Import:**
- Export as .mtl file (Music Theory Lab format)
- Import .mtl files
- Include all settings and history

**Community Templates:**
- Submit templates to community library
- Browse community creations
- Rate and review
- Fork and modify

**Future: Real-Time Collaboration:**
- Multiple users editing simultaneously
- Cursor presence
- Chat/comments
- Conflict resolution

#### Implementation Files
- `src/modules/sharing/linkGenerator.js` - Share link creation
- `src/modules/sharing/embedCode.js` - Embed generation
- `src/modules/export/mtlFormat.js` - Native file format
- `src/modules/ui/shareModal.js` - Sharing UI
- `src/modules/api/communityTemplates.js` - Community API

#### Success Metrics
- [ ] Share links work correctly
- [ ] Embed displays properly
- [ ] .mtl import/export round-trips
- [ ] Community templates load

---

### 7.12 Mobile Companion
**Duration:** 4-6 weeks
**Priority:** Low
**Target Users:** All

#### Features

**Responsive Design:**
- Works on tablets and phones
- Touch-friendly controls
- Gesture support (swipe, pinch)

**Mobile-Optimized Features:**
- View progressions
- Playback controls
- Basic chord editing
- Export and share

**Progressive Web App:**
- Install on home screen
- Offline support
- Push notifications (optional)

**Sync:**
- Cloud storage backend
- Sync between devices
- Conflict resolution

#### Implementation
- CSS media queries for responsive layout
- Touch event handlers
- Service worker for offline
- Cloud API for sync

#### Success Metrics
- [ ] Usable on 320px width
- [ ] Touch targets 44px+
- [ ] Playback works on mobile
- [ ] PWA installable
- [ ] Offline viewing works

---

## Implementation Timeline

### Core Phases (4-6)

| Phase | Feature | Duration | Priority | Dependencies |
|-------|---------|----------|----------|--------------|
| **4.1** | Melody Suggestion Engine | 2-3 weeks | 🔥 Critical | None |
| **4.2** | Auto-Harmonize | 2 weeks | 🔥 Critical | 4.1 |
| **4.3** | Chord Tone Highlighting | 1 week | High | None |
| **4.4** | VexFlow Professional Notation | 4-6 weeks | High | None |
| **5.1** | Bi-Directional Sync | 1-2 weeks | High | None |
| **5.2** | Voice Leading Visualization | 2 weeks | Medium | 5.1 |
| **5.3** | Real-Time Sidebar | 1 week | Medium | 5.1 |
| **6.1** | Export System | 2-3 weeks | High | 4.4 |
| **6.2** | Copy/Paste/Undo | 1-2 weeks | Medium | None |

### Phase 7: Extended Features

| Phase | Feature | Duration | Priority | Dependencies | Target Users |
|-------|---------|----------|----------|--------------|--------------|
| **7.1** | Guided Songwriting Wizard | 2-3 weeks | High | 4.1, 4.2 | Beginners |
| **7.2** | Theory Explanations on Hover | 1-2 weeks | High | None | Beginners, Intermediate |
| **7.3** | Difficulty Ratings System | 1 week | Medium | None | All |
| **7.4** | Song Form Builder | 2-3 weeks | High | 5.1 | Intermediate, Advanced |
| **7.5** | Rhythm Pattern Library | 2 weeks | High | None | Intermediate |
| **7.6** | Reharmonization Tools | 3-4 weeks | Medium | 5.1 | Advanced |
| **7.7** | Custom Scale Support | 2 weeks | Medium | 4.1 | Intermediate, Advanced |
| **7.8** | Practice Mode (Ear Training) | 2-3 weeks | Medium | None | All |
| **7.9** | Multi-Section Compositions | 2-3 weeks | High | 5.1 | Intermediate, Advanced |
| **7.10** | Session History & Auto-Save | 1-2 weeks | High | None | All |
| **7.11** | Collaboration & Sharing | 3-4 weeks | Medium | 6.1 | All |
| **7.12** | Mobile Companion | 4-6 weeks | Low | 6.1 | All |

### Suggested Implementation Order

**Sprint 1 (Weeks 1-6): AI Foundation**
- 4.1 Melody Suggestion Engine
- 4.2 Auto-Harmonize
- 4.3 Chord Tone Highlighting
- 7.2 Theory Explanations

**Sprint 2 (Weeks 7-12): Professional Notation**
- 4.4 VexFlow Integration (Phase 4.4a-c)
- 5.1 Bi-Directional Sync
- 7.10 Session History & Auto-Save

**Sprint 3 (Weeks 13-18): Production Features**
- 6.1 Export System
- 6.2 Copy/Paste/Undo
- 7.1 Guided Songwriting Wizard
- 7.3 Difficulty Ratings

**Sprint 4 (Weeks 19-24): Advanced Composition**
- 7.4 Song Form Builder
- 7.9 Multi-Section Compositions
- 7.5 Rhythm Pattern Library
- 5.2 Voice Leading Visualization

**Sprint 5 (Weeks 25-30): Power User Features**
- 7.6 Reharmonization Tools
- 7.7 Custom Scale Support
- 5.3 Real-Time Sidebar
- 7.8 Practice Mode

**Sprint 6 (Weeks 31-38): Polish & Share**
- 7.11 Collaboration & Sharing
- 7.12 Mobile Companion

**Total Estimated Time:**
- Core features (Phases 4-6): 18-26 weeks
- All features (Phases 4-7): 30-38 weeks

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
| **Professional Notation** | ✅✅ | ✅ | ✅ | ❌ | ⚠️ → ✅ (Phase 4.4) |
| **Beginner-Friendly** | ⚠️ | ✅ | ✅ | ✅ | ✅✅ (Phase 7.1 wizard) |
| **MusicXML Export** | ✅✅ | ✅ | ✅ | ❌ | ⚠️ → ✅ (Phase 6.1) |
| **Song Form Builder** | ⚠️ | ❌ | ❌ | ⚠️ | ✅✅ (Phase 7.4) |
| **Ear Training** | ❌ | ❌ | ❌ | ❌ | ✅✅ (Phase 7.8) |
| **Reharmonization** | ❌ | ❌ | ❌ | ⚠️ | ✅✅ (Phase 7.6) |

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

### Sprint 1: AI Foundation (Weeks 1-6)

#### Week 1-2: Melody Suggestion Engine Foundation (4.1)
1. Design `melodySuggestion.js` algorithm structure
2. Implement chord tone detection and scoring
3. Add stepwise motion analysis from previous notes
4. Create sidebar UI component with suggestion cards
5. Build click-to-insert workflow

#### Week 3: Auto-Harmonize Foundation (4.2)
1. Build melody analysis algorithm (group by measure)
2. Create chord matching scoring system
3. Design auto-harmonize modal UI
4. Implement apply workflow with bass auto-fill

#### Week 4: Integration & Polish (4.1, 4.2)
1. Connect melody suggestions to existing Melody Composer
2. Add style-aware filtering for suggestions
3. Test with various progressions and genres
4. Gather feedback and iterate on UI

#### Week 5: Chord Tone Highlighting (4.3)
1. Implement real-time analysis during playback
2. Create color-coded note highlighting
3. Add educational tooltips for each note type
4. Build toggle system in settings

#### Week 6: Theory Explanations (7.2)
1. Create theory explanation database
2. Implement hover tooltip system
3. Add famous song examples
4. Test across all UI touchpoints

### Sprint 2: Professional Notation (Weeks 7-12)

#### Week 7-8: VexFlow Core Integration (4.4a)
1. Install and configure VexFlow library
2. Create `vexFlowRenderer.js` with basic measure rendering
3. Implement note format conversion from existing data
4. Build single-staff display with clef/key/time

#### Week 9-10: Grand Staff & Multi-System (4.4b)
1. Implement grand staff with brace connector
2. Create synchronized treble/bass clef display
3. Build multi-system layout algorithm
4. Add measure number display

#### Week 11: Note Editing & Bi-Directional Sync (4.4c, 5.1)
1. Implement click-to-add note entry
2. Add duration selector toolbar
3. Complete bi-directional sync with Progression Builder
4. Test full round-trip editing

#### Week 12: Session History (7.10)
1. Implement auto-save every 30 seconds
2. Create version history storage
3. Build history panel UI
4. Add crash recovery detection

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
**Last Updated:** November 2024
**Project:** Music Theory Lab
**Version:** 2.0

### Changelog
- v2.0: Moved VexFlow to Phase 4.4, expanded Phase 7 with detailed specs for 12 features, added sprint-based implementation timeline
- v1.0: Initial roadmap with Phases 4-6 and basic new feature ideas
