# MODULE_INDEX.md

**Purpose:** Quick navigation guide for Claude Code to find the right code without reading entire files.

**Last Updated:** 2026-01-08 (Added Community, Admin, Backend API, Config, Import modules)

---

## 🎯 Entry Points (Start Here)

| File | Lines | Purpose | When to Use |
|------|-------|---------|-------------|
| [src/main.js](../src/main.js) | ~38 | **App entry point** - imports init modules, calls setupWindowExports() and DOMContentLoaded handler | Starting point for understanding app boot sequence |
| [src/modules/state/compositionState.js](../src/modules/state/compositionState.js) | 8,212 | **Single source of truth** for all composition data | Any chord/measure/note state questions |
| [src/modules/features/progressionBuilder/index.js](../src/modules/features/progressionBuilder/index.js) | ~484 | Main progression coordinator | Progression builder tab features |

---

## 📁 Module Directory

### INIT - Application Initialization (4 files)
**Location:** `src/init/`

**Purpose:** Orchestrates app initialization sequence. Extracted from main.js during Phase 3 refactoring.

**CRITICAL INITIALIZATION ORDER (DO NOT CHANGE):**
1. `setupWindowExports()` - Called BEFORE DOMContentLoaded for HTML onclick handlers
2. `setupApp()` - UI state, dark mode, saved state (in DOMContentLoaded)
3. `await initializeModules()` - Audio FIRST, then other modules (in DOMContentLoaded)
4. `setupGlobalEventHandlers()` - Event listeners LAST (in DOMContentLoaded)

| File | Lines | Purpose | Key Functions |
|------|-------|---------|--------------|
| `windowExports.js` | 2,160 | All window.* assignments for HTML event handlers | `setupWindowExports()` |
| `appSetup.js` | 634 | Dark mode, saved state, UI initialization | `setupApp()` |
| `moduleInitialization.js` | 385 | All init*() calls, panel restoration | `initializeModules()` (async) |
| `globalEventHandlers.js` | 303 | Keyboard shortcuts, click-outside, custom events | `setupGlobalEventHandlers()` |

**When to Read:**
- App initialization issues → `main.js` then trace through init/ modules in order
- Window export debugging → `windowExports.js`
- Dark mode or saved state → `appSetup.js`
- Module initialization order → `moduleInitialization.js`
- Keyboard shortcuts or event handlers → `globalEventHandlers.js`

---

### STATE - Data Management (7 files)
**Location:** `src/modules/state/`

**Purpose:** Single source of truth for application state. All composition data flows through here.

| File | Lines | Purpose | Key Exports |
|------|-------|---------|-------------|
| `compositionState.js` ⭐ | 8,212 | Central state hub (chord progressions, measures, notes, sections) | `CompositionState` class, `getCompositionState()` |
| `buildingBlock.js` | 1,146 | Musical time unit structure (48 units/beat) | `BuildingBlock`, `BuildingBlockSequence`, `Unit` |
| `trainerState.js` | 650 | Progression Builder UI state (delegates data to compositionState) | `TrainerState` class, `getTrainerState()` |
| `sectionIntentState.js` | 488 | Section intent/mood state | Various getters/setters |
| `globalState.js` | 165 | App-wide settings (tabs, enharmonic, dark mode) | `GlobalState` class |
| `builderState.js` | 162 | Chord Builder UI state | `BuilderState` class |
| `scaleState.js` | 81 | Scale explorer state | Various getters/setters |

**When to Read:**
- Modifying chord progression data → `compositionState.js`
- UI state issues → `trainerState.js` or `builderState.js`
- Timing/rhythm calculations → `buildingBlock.js`
- Section management → `compositionState.js` (sections are now in compositionState)

---

### FEATURES - Main Workflows
**Location:** `src/modules/features/`

**Purpose:** User-facing composition tools and chord manipulation

#### Core Features
| File | Lines | Purpose |
|------|-------|---------|
| `progressionBuilder/` ⭐ | ~17,800 | **Main progression UI** - refactored into 7 focused modules |
| `chordBuilder.js` | 3,601 | Chord construction tool (root, type, inversion, voicing) |
| `comprehensiveChordRecommendations.js` | 1,835 | Holistic chord suggestions with multi-factor scoring |
| `theoryTools.js` | 1,896 | Secondary dominants, modal interchange, borrowed chords |
| `songAnalyzer.js` | 2,977 | Analyze songs for chord progressions |
| `chordSequences.js` | 2,877 | Chord sequence generation |

#### progressionBuilder/ Subdirectory (7 modules)
**Purpose:** Progression Builder tab functionality - split from monolith into focused modules

| File | Lines | Purpose | Key Exports |
|------|-------|---------|-------------|
| `index.js` | 484 | Main coordinator, re-exports all functions | All progressionBuilder functions |
| `ProgressionRenderer.js` | 7,214 | UI rendering engine (chord cards, sections, notation) | `renderProgressionDisplay()`, `updateSingleCard()` |
| `ProgressionController.js` | 4,427 | State management, CRUD operations, undo/redo | `addChordToProgressionByParams()`, `updateChordType()`, `saveStateBeforeChange()` |
| `ProgressionModals.js` | 1,670 | All modal dialogs (suggestions, sections, insights) | `showProgressionChordSuggestions()`, `showAddSectionMenu()` |
| `ProgressionExport.js` | 1,519 | Import/export templates and rhythm patterns | `importChordList()`, `openTemplateBrowser()` |
| `ProgressionDragDrop.js` | 1,343 | Drag-and-drop functionality (Sortable.js integration) | `initializeSectionContainerSortable()`, `handleCardDragWithinSection()` |
| `ProgressionPlayback.js` | 1,141 | Audio playback and rhythm patterns | `handleAutoPlayback()`, `startProgressionChord()` |

#### Recommendation Engines
- `chordRecommendations.js` (620 lines) - Original recommendation engine
- `comprehensiveChordRecommendations.js` (1,835 lines) - Enhanced multi-factor engine
- `chordSuggestionEngine.js` - Alternative engine
- `unifiedChordSuggestions.js` - Unified API layer

#### Specialized Tools
| File | Lines | Purpose |
|------|-------|---------|
| `circleOfFifths.js` | 798 | Harmonic visualization |
| `guitarFretboard.js` | 1,052 | Guitar chord diagrams |
| `voiceLeadingOptimizer.js` | - | Smooth voice leading calculations |
| `progressionTemplates.js` | 1,641 | Pre-built chord sequences |
| `scaleExplorer.js` | - | Scale visualization |
| `rhythmicPatterns.js` | 718 | Rhythm accompaniment |
| `rhythmPatternLibrary.js` | - | Rhythm pattern presets |
| `songSearch.js` | 1,621 | Search songs by chord progression |

**When to Read:**
- Progression builder tab changes → `progressionBuilder/` subdirectory
  - State/CRUD operations → `ProgressionController.js`
  - UI rendering → `ProgressionRenderer.js`
  - Modals → `ProgressionModals.js`
  - Playback → `ProgressionPlayback.js`
  - Import/export → `ProgressionExport.js`
  - Drag-and-drop → `ProgressionDragDrop.js`
- Chord suggestions → `comprehensiveChordRecommendations.js`
- Theory transformations → `theoryTools.js`

---

### NOTATION - VexFlow Rendering (16+ files)
**Location:** `src/modules/notation/`

**Purpose:** Musical notation rendering and editing

#### Core Bridge (Critical!)
| File | Lines | Purpose |
|------|-------|---------|
| `noteEditor.js` ⭐ | 9,038 | **Main interactive note placement** - click-to-add, selection, editing |
| `grandStaff.js` | 5,248 | Grand staff rendering (treble + bass clefs) |
| `notationToolbar.js` | 3,647 | Toolbar UI for notation editing (duration, articulation, dynamics) |
| `composerIntegration.js` | 3,170 | **NotationComposer class** - Bi-directional sync: compositionState ↔ VexFlow |
| `notationInit.js` | 2,413 | Initialization, `refreshNotationFromProgression()` |
| `voiceLeadingOverlay.js` | 2,391 | Visual voice leading indicators |
| `vexFlowRenderer.js` | 1,504 | Low-level VexFlow utilities |

#### Measure Isolation Modal (NEW - slot-based editing)
**Location:** `src/modules/notation/measureIsolation/`

| File | Lines | Purpose |
|------|-------|---------|
| `MeasureIsolationEditor.js` | 3,009 | "Blown up" single-measure editor modal with intuitive slot-based note placement |
| `SlotGrid.js` | 755 | Core data structure - 32nd-note slot granularity for precise placement |
| `index.js` | 17 | Module exports |

**Key Features:**
- 32nd-note slot granularity (8 slots per beat)
- Both clefs and multiple voices (V1/V2)
- Chord building (polyphony within voices)
- Optimal rest filling for empty slots
- V2 rest handling: invisible when no content, cue rests when V2 has content

#### Layout & Pagination
| File | Lines | Purpose |
|------|-------|---------|
| `staffLayouter.js` | 653 | Measure layout calculations |
| `noteFormatter.js` | 485 | Note formatting utilities |
| `durationUtils.js` | 366 | **Centralized duration handling** - canonical dotted format |
| `pageManager.js` | 343 | Multi-page composition |
| `pageNavigator.js` | 305 | Page navigation |
| `pageLayoutManager.js` | 232 | Page layout |
| `pageConfig.js` | 169 | Page configuration |
| `index.js` | 186 | Module exports |

**When to Read:**
- Notation not syncing → `composerIntegration.js`
- Rendering issues → `grandStaff.js` or `vexFlowRenderer.js`
- Note editing (main canvas) → `noteEditor.js`
- Note editing (measure isolation) → `measureIsolation/MeasureIsolationEditor.js`
- Toolbar/duration selection → `notationToolbar.js`
- Duration calculations → `durationUtils.js`

**Critical Pattern:**
```javascript
// When chord progression changes:
syncProgressionToMelodyComposer();     // compositionState sync
refreshNotationFromProgression();       // VexFlow sync
```

---

### UI - User Interface (45+ files)
**Location:** `src/modules/ui/`

**Purpose:** UI components, modals, panels, event handlers

#### Core UI Management
| File | Lines | Purpose |
|------|-------|---------|
| `tabs.js` | - | Tab switching (Builder, Trainer, Melody Composer, Learn) |
| `header.js` | - | Key signature, tempo, title display |
| `sidebar.js` | - | Settings panel |
| `keyboard.js` | 926 | Virtual piano keyboard |
| `modals.js` | - | Modal dialog system |

#### Major Modals & Panels
| File | Lines | Purpose |
|------|-------|---------|
| `interactiveTutorial.js` | 5,486 | Tutorial system |
| `songwritingWizard.js` | 4,274 | Composition wizard |
| `lessonViewer.js` | 2,814 | Lesson display |
| `songBuilder.js` | 2,704 | Song building UI |
| `lessonGuidedMode.js` | 2,098 | Guided lesson mode |
| `chordExplorerModal.js` | 2,091 | Chord exploration |
| `theoryInsightsPanel.js` | 2,068 | Educational insights |
| `settingsModal.js` | 1,619 | Global settings |
| `songwritingWizardModal.js` | 1,571 | Wizard modal |
| `whyThisWorksPanel.js` | 1,561 | Theory explanation panel |
| `chordSuggestionModal.js` | 1,442 | Chord suggestion picker |
| `autoHarmonizeModal.js` | 1,081 | Voice leading suggestions |
| `recommendationsSidebar.js` | 1,072 | Recommendations sidebar |
| `sectionSidebar.js` | 1,071 | Section management sidebar |

#### UnifiedRecommendationModal (REFACTORED - 20 files)
**Location:** `src/modules/ui/recommendations/UnifiedRecommendationModal/`

**Purpose:** Main recommendation UI - refactored from 15,489-line monolith into focused modules

| File | Lines | Purpose |
|------|-------|---------|
| `ChordTab.js` | 6,964 | Chord recommendation tab |
| `MelodyTab.js` | 2,352 | Melody suggestion tab |
| `PolyphonyTab.js` | 2,222 | Polyphony/harmony tab |
| `MusicUtils.js` | 1,496 | Music utility functions |
| `SectionTab.js` | 945 | Section management tab |
| `StructureBuilders.js` | 817 | UI structure builders |
| `index.js` | 630 | Main coordinator |
| `HarmonizeTab.js` | 612 | Harmonization tab |
| `AudioPlayback.js` | 609 | Audio preview playback |
| `Constants.js` | 263 | Shared constants |
| `ModalState.js` | 235 | Modal state management |
| `ModalHelpers.js` | 202 | Helper functions |
| `TabNavigation.js` | 122 | Tab navigation |
| `DataFormatters.js` | 96 | Data formatting |
| `ProgressionHelpers.js` | 88 | Progression helpers |
| `ChordHelpers.js` | 87 | Chord helpers |
| `UIHelpers.js` | 68 | UI helpers |
| `VisualizationHelpers.js` | 39 | Visualization helpers |

#### Specialized UI
| File | Lines | Purpose |
|------|-------|---------|
| `floatingActionButton.js` | 754 | Floating action button (FAB) |
| `sectionDragDrop.js` | - | Song structure editor |
| `sectionIntentUI.js` | - | Intent selector (verse/chorus) |
| `learningProgress.js` | - | Progress tracking |
| `presetUI.js` | - | Preset manager |
| `toastNotifications.js` | - | Toast notification system |
| `TensionArcUI.js` | - | Tension arc visualization |

**When to Read:**
- Modal/panel UI bugs → Find specific modal file
- Tab switching → `tabs.js`
- Keyboard display → `keyboard.js`
- Recommendation modal → `ui/recommendations/UnifiedRecommendationModal/`

---

### AI - Intelligent Composition (8 files)
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
| `melodySuggestionController.js` | Controller for melody suggestions | - |
| `motifRecognition.js` | Theme identification and extension | `recognizeMotif()` |
| `autoHarmonize.js` | Automatic voice leading | `autoHarmonize()` |
| `chordTimeline.js` | Maps chords to time positions | `buildChordTimeline()` |

**When to Read:**
- Melody suggestion bugs → `melodySuggestion.js`
- Section-specific melody → `sectionAwareMelodyGenerator.js`

---

### ANALYSIS - Music Theory Analysis (6 files)
**Location:** `src/modules/analysis/`

**Purpose:** Harmonic analysis, pattern detection, tension planning

| File | Purpose | Key Exports |
|------|---------|-------------|
| `harmonyAnalyzer.js` | Identifies progression patterns (I-IV-V, ii-V-I) | `HarmonyAnalyzer` class, `COMMON_PROGRESSIONS` |
| `chordToneAnalyzer.js` | Analyzes notes relative to chord (for coloring) | `analyzeNoteAgainstChord()` |
| `TensionArcPlanner.js` | Plans harmonic tension curves | `TensionArcPlanner` class |
| `TensionOptimizer.js` | Optimizes tension flow | `TensionOptimizer` class |
| `MultiDimensionalTension.js` | 4-dimension tension analysis (harmonic, rhythmic, melodic, dynamic) | `MultiDimensionalTensionAnalyzer` class, `DIMENSION_WEIGHTS` |
| `patternDetection.js` | Generic pattern matching | `detectPattern()` |

**When to Read:**
- Progression analysis → `harmonyAnalyzer.js`
- Note highlighting/labeling → `chordToneAnalyzer.js`
- Tension optimization → `TensionArcPlanner.js`, `TensionOptimizer.js`
- Multi-dimensional tension → `MultiDimensionalTension.js`

---

### AUDIO - Sound Synthesis (3 files)
**Location:** `src/modules/audio/`

**Purpose:** Tone.js audio playback and scheduling

| File | Purpose | Key Exports |
|------|---------|-------------|
| `audioEngine.js` ⭐ | **Critical**: Initializes instruments, manages audio context | `initializeAudio()`, `getPiano()`, `playChord()` |
| `melodyGenerator.js` | Schedules melody note playback | `playMelody()`, `scheduleMelody()` |
| `arpeggiator.js` | Sequential note playback | `playArpeggio()` |

**When to Read:**
- Audio not playing → `audioEngine.js`
- Melody playback timing → `melodyGenerator.js`

---

### INTEGRATION - Cross-Module Sync (5 files)
**Location:** `src/modules/integration/`

**Purpose:** Connect modules that shouldn't directly depend on each other

| File | Purpose | Key Functions |
|------|---------|---------------|
| `melodyComposerBridge.js` | Syncs progression → melodySuggestion | `syncProgressionToMelodyComposer()` |
| `progressionNotationSync.js` | Bi-directional: progression ↔ notation | `syncProgressionToComposition()` |
| `bassAutoFill.js` | Generates bass voicings from chords | `generateBassVoicing()` |
| `recommendationService.js` | Coordinates recommendation engines | `getRecommendations()` |
| `migrationHelper.js` | Data format migration | ⚠️ **Possibly unused** |

**When to Read:**
- Progression → notation sync issues → `progressionNotationSync.js`
- Melody suggestions not updating → `melodyComposerBridge.js`
- Bass generation → `bassAutoFill.js`

---

### TEACHING - Educational Features (7 files)
**Location:** `src/modules/teaching/`

**Purpose:** Learning progression and contextual teaching

| File | Lines | Purpose |
|------|-------|---------|
| `letItBeTutorial.js` | 2,522 | "Let It Be" guided tutorial |
| `whyThisWorksEnhanced.js` | 1,300 | Explanation system for suggestions |
| `theoryMoments.js` | 724 | Contextual teaching popups |
| `compositionInsights.js` | 656 | Learning analytics |
| `theoryOverlay.js` | 596 | Visual theory overlays |
| `theoryMomentsConfig.js` | 251 | Teaching content configuration |
| `insightsStorage.js` | 216 | Persists insights data |

---

### RECOMMENDATIONS - Unified Coordination (8+ files)
**Location:** `src/modules/recommendations/`

**Purpose:** Orchestrates multiple recommendation engines

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
    ├── index.js                   - Exports
    ├── SmartHarmonizer.js         - Smart harmonization
    ├── CounterMelodyGenerator.js  - Counter melody generation
    └── BassLineGenerator.js       - Bass line generation
```

**When to Read:**
- Understanding recommendation architecture → `CoordinatedRecommendationService.js`
- User preference learning → `UserPreferenceLearner.js`

---

### STORAGE - Persistence (7 files)
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
| `panelState.js` | Panel collapse/expand persistence |

---

### COMMUNITY - Social Features & Sharing (8 files, ~6,773 lines)
**Location:** `src/modules/community/`

**Purpose:** User authentication, progression sharing, community browsing, and social features

| File | Lines | Purpose | Key Exports |
|------|-------|---------|-------------|
| `communityBrowser.js` ⭐ | 2,943 | Browse/search community submissions | `showCommunityBrowser()`, `loadSubmission()` |
| `shareModal.js` | 1,640 | Share progressions to community | `showShareModal()`, `initShareModal()` |
| `mySubmissions.js` | 746 | View/manage user's own submissions | `showMySubmissions()` |
| `authButton.js` | 542 | Authentication UI component | `initAuthButton()`, `updateAuthButton()` |
| `authService.js` | 427 | Supabase authentication service | `signInWithGoogle()`, `signOut()`, `isSignedIn()`, `getAuthToken()` |
| `duplicateDetection.js` | 353 | Check for duplicate submissions | `generateDuplicateDetectionData()`, `extractChordsFromComposition()` |
| `loadedSubmissionContext.js` | 91 | Track loaded submission for editing | `setLoadedSubmissionContext()`, `getLoadedSubmissionContext()` |
| `supabaseClient.js` | 31 | Supabase client initialization | `supabase` |

**Data Flow:**
```
User Signs In (Google OAuth)
    ↓
authService.js → supabaseClient.js → Supabase Auth
    ↓
User Profile Created/Loaded
    ↓
Community Features Enabled (browse, share, upvote)
```

**When to Read:**
- Authentication issues → `authService.js`
- Share/publish flow → `shareModal.js`
- Browse community → `communityBrowser.js`
- User's submissions → `mySubmissions.js`
- Duplicate detection → `duplicateDetection.js`

---

### ADMIN - Admin Dashboard & Moderation (3 files, ~2,079 lines)
**Location:** `src/modules/admin/`

**Purpose:** Admin dashboard for content moderation, user management, and app settings

| File | Lines | Purpose | Key Exports |
|------|-------|---------|-------------|
| `adminDashboardModal.js` ⭐ | 1,537 | Admin dashboard UI with tabs | `showAdminDashboard()`, `initAdminDashboard()` |
| `adminService.js` | 419 | Admin API client | `checkAdminStatus()`, `getSubmissions()`, `blockUser()`, `getFlags()` |
| `adminFab.js` | 123 | Admin floating action button | `initAdminFab()`, `showAdminFabIfAdmin()` |

**Admin Dashboard Tabs:**
- **Overview**: Stats, recent activity
- **Submissions**: Review, approve, reject, delete
- **Users**: Block/unblock, view activity
- **Flags**: Handle user reports
- **Settings**: App-wide configuration

**When to Read:**
- Admin dashboard UI → `adminDashboardModal.js`
- API calls to admin endpoints → `adminService.js`
- Admin access control → `adminFab.js` + `adminService.js`

---

### BACKEND - Netlify Functions API (17 files, ~4,547 lines)
**Location:** `netlify/functions/`

**Purpose:** Serverless API endpoints for community features, authentication, and admin operations

#### Core Submission Endpoints
| File | Lines | Purpose | Endpoint |
|------|-------|---------|----------|
| `submissions.js` ⭐ | 841 | Browse/create submissions | `GET/POST /api/submissions` |
| `submission.js` | 262 | Get single submission | `GET /api/submission` |
| `my-submissions.js` | 206 | User's own submissions | `GET /api/my-submissions` |
| `submission-status.js` | 177 | Check submission status | `GET /api/submission-status` |
| `submission-families.js` | 383 | Group similar progressions | `GET /api/submission-families` |
| `submission-versions.js` | 374 | Version history for edits | `GET/POST /api/submission-versions` |
| `check-duplicate.js` | 295 | Duplicate detection | `POST /api/check-duplicate` |

#### Admin Endpoints
| File | Lines | Purpose | Endpoint |
|------|-------|---------|----------|
| `admin-check.js` | 51 | Verify admin status | `GET /api/admin-check` |
| `admin-submissions.js` | 324 | Admin submission management | `GET/PUT/DELETE /api/admin-submissions` |
| `admin-users.js` | 329 | User management | `GET/PUT /api/admin-users` |
| `admin-stats.js` | 158 | Dashboard statistics | `GET /api/admin-stats` |

#### Social & Moderation
| File | Lines | Purpose | Endpoint |
|------|-------|---------|----------|
| `upvote.js` | 170 | Upvote submissions | `POST /api/upvote` |
| `flags.js` | 455 | Content flagging/reporting | `GET/POST/PUT/DELETE /api/flags` |
| `tags.js` | 94 | Submission tags | `GET /api/tags` |

#### Utility
| File | Lines | Purpose | Endpoint |
|------|-------|---------|----------|
| `searchChords.js` | 80 | Search by chord sequence | `GET /api/searchChords` |
| `app-settings.js` | 156 | App configuration | `GET/PUT /api/app-settings` |
| `utils/adminAuth.js` | 192 | Admin authentication helper | (internal) |

**When to Read:**
- API endpoint behavior → Specific function file
- Authentication flow → `utils/adminAuth.js`
- Submission CRUD → `submissions.js`, `submission.js`
- Admin operations → `admin-*.js` files

---

### CONFIG - Application Configuration (1 file)
**Location:** `src/modules/config/`

| File | Lines | Purpose | Key Exports |
|------|-------|---------|-------------|
| `weightPresets.js` | 882 | Recommendation weight presets | Weight preset definitions |

---

### IMPORT - File Import (1 file)
**Location:** `src/modules/import/`

| File | Lines | Purpose | Key Exports |
|------|-------|---------|-------------|
| `musicXmlImporter.js` | 926 | Import MusicXML files | `importMusicXML()` |

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
├── index.js                       - Module exports
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
| `exportService.js` | ~2,700 | PDF/MusicXML export orchestration |
| `audioExporter.js` | ~900 | Audio file rendering (WAV/MP3) |

---

### DATA - Music Data & Theory Content
**Location:** `src/data/`

| File/Folder | Purpose |
|-------------|---------|
| `music-data.js` | **CRITICAL**: CHORD_DEFINITIONS, scales, intervals, ALL_NOTES |
| `songStructureTemplates.js` | Song structure presets |
| `theoryExplanations/` | Theory content for lessons |
| `theoryExplanations/lessons/` | Lesson content (beginner, intermediate, advanced) |

---

## 🔄 Critical Data Flow Patterns

### Pattern 1: Chord Progression Update
```
User Action (progressionBuilder/)
    ↓
compositionState.updateChord() / addMeasure()
    ↓
syncProgressionToMelodyComposer()      [integration/melodyComposerBridge.js]
    ↓
refreshNotationFromProgression()        [notation/notationInit.js]
    ↓
NotationComposer.render()              [notation/composerIntegration.js]
```

### Pattern 2: Note Editing (Measure Isolation Modal)
```
User opens Measure Isolation Modal
    ↓
MeasureIsolationEditor.fromMeasure()   [notation/measureIsolation/]
    ↓
SlotGrid created from measure notation
    ↓
User edits (click slots to add/remove notes)
    ↓
SlotGrid.toNotation() → measure notation
    ↓
compositionState updated → refreshNotationFromProgression()
```

### Pattern 3: Recommendation Flow
```
User clicks "Suggestions" on chord card
    ↓
showProgressionChordSuggestions()      [progressionBuilder/ProgressionModals.js]
    ↓
comprehensiveChordRecommendations.getRecommendations()
    ↓
UnifiedRecommendationModal shown       [ui/recommendations/UnifiedRecommendationModal/]
    ↓
User selects chord → compositionState.updateChord()
```

---

## 📋 Quick Reference: Where to Look

| Task | Primary File | Related Files |
|------|--------------|---------------|
| **Chord progression data** | `state/compositionState.js` | `state/trainerState.js` |
| **Progression UI rendering** | `features/progressionBuilder/ProgressionRenderer.js` | `ProgressionController.js` |
| **Progression state/CRUD** | `features/progressionBuilder/ProgressionController.js` | `state/compositionState.js` |
| **Chord suggestions** | `features/comprehensiveChordRecommendations.js` | `ui/recommendations/UnifiedRecommendationModal/` |
| **Notation rendering** | `notation/composerIntegration.js` | `notation/grandStaff.js`, `notationInit.js` |
| **Note editing (main)** | `notation/noteEditor.js` | `notation/notationToolbar.js` |
| **Note editing (measure modal)** | `notation/measureIsolation/MeasureIsolationEditor.js` | `SlotGrid.js` |
| **Duration handling** | `notation/durationUtils.js` | `state/buildingBlock.js` |
| **Melody generation** | `ai/melodySuggestion.js` | `ai/enhancedMelodyController.js` |
| **Audio playback** | `audio/audioEngine.js` | `audio/melodyGenerator.js` |
| **Theory analysis** | `analysis/harmonyAnalyzer.js` | `analysis/chordToneAnalyzer.js` |
| **Bass generation** | `integration/bassAutoFill.js` | `state/compositionState.js` |
| **Window exports** | `init/windowExports.js` | (HTML event handlers) |
| **Progression sync** | `integration/progressionNotationSync.js` | `integration/melodyComposerBridge.js` |
| **Save/Load** | `storage/projectManager.js` | `storage/autoSave.js` |
| **Undo/Redo** | `storage/versionHistory.js` | `progressionBuilder/ProgressionController.js` |
| **Educational features** | `teaching/theoryMoments.js` | `teaching/whyThisWorksEnhanced.js` |
| **Sections** | `state/compositionState.js` | `progressionBuilder/ProgressionRenderer.js` |
| **Authentication** | `community/authService.js` | `community/authButton.js` |
| **Share to Community** | `community/shareModal.js` | `community/duplicateDetection.js` |
| **Browse Community** | `community/communityBrowser.js` | `community/loadedSubmissionContext.js` |
| **User Submissions** | `community/mySubmissions.js` | `admin/adminService.js` |
| **Admin Dashboard** | `admin/adminDashboardModal.js` | `admin/adminService.js` |
| **Content Moderation** | `admin/adminService.js` | `netlify/functions/flags.js` |
| **Backend API** | `netlify/functions/submissions.js` | All `netlify/functions/*.js` |

---

## 💡 Tips for Claude Code

1. **Start with MODULE_INDEX.md** (this file) to find the right module
2. **Check API_REFERENCE.md** for function signatures without reading full files
3. **Consult STATE_MANAGEMENT.md** for data flow questions
4. **Read CLAUDE.md** for critical patterns (chord type naming, inversion handling, enharmonic spelling)
5. **Use `init/windowExports.js`** to trace HTML event handlers to implementation
6. **When in doubt**, check `compositionState.js` - it's the data hub
7. **For notation editing**, check if it's main canvas (`noteEditor.js`) or measure modal (`measureIsolation/`)
8. **For recommendations**, the modal is now in `ui/recommendations/UnifiedRecommendationModal/`
9. **For community features**, start with `community/authService.js` for auth, `community/shareModal.js` for sharing
10. **For admin features**, check `admin/adminService.js` for API calls, `adminDashboardModal.js` for UI
11. **For backend API**, check `netlify/functions/` - each file is one endpoint

---

## 🗂️ File Size Reference (Largest Files)

| File | Lines | Module |
|------|-------|--------|
| `noteEditor.js` | 9,038 | notation |
| `compositionState.js` | 8,212 | state |
| `ProgressionRenderer.js` | 7,214 | progressionBuilder |
| `ChordTab.js` | 6,964 | UnifiedRecommendationModal |
| `interactiveTutorial.js` | 5,486 | ui |
| `grandStaff.js` | 5,248 | notation |
| `ProgressionController.js` | 4,427 | progressionBuilder |
| `songwritingWizard.js` | 4,274 | ui |
| `notationToolbar.js` | 3,647 | notation |
| `chordBuilder.js` | 3,601 | features |
| `composerIntegration.js` | 3,170 | notation |
| `MeasureIsolationEditor.js` | 3,009 | measureIsolation |
| `songAnalyzer.js` | 2,977 | features |
| `chordSequences.js` | 2,877 | features |
| `lessonViewer.js` | 2,814 | ui |
| `songBuilder.js` | 2,704 | ui |
| `letItBeTutorial.js` | 2,522 | teaching |
| `notationInit.js` | 2,413 | notation |
| `voiceLeadingOverlay.js` | 2,391 | notation |
| `MelodyTab.js` | 2,352 | UnifiedRecommendationModal |
| `PolyphonyTab.js` | 2,222 | UnifiedRecommendationModal |
| `windowExports.js` | 2,160 | init |
| `lessonGuidedMode.js` | 2,098 | ui |
| `chordExplorerModal.js` | 2,091 | ui |
| `theoryInsightsPanel.js` | 2,068 | ui |
| `communityBrowser.js` | 2,943 | community |
| `shareModal.js` | 1,640 | community |
| `adminDashboardModal.js` | 1,537 | admin |
| `musicXmlImporter.js` | 926 | import |
| `weightPresets.js` | 882 | config |
| `submissions.js` | 841 | netlify/functions |
| `mySubmissions.js` | 746 | community |
| `authButton.js` | 542 | community |
| `flags.js` | 455 | netlify/functions |
| `authService.js` | 427 | community |
| `adminService.js` | 419 | admin |
