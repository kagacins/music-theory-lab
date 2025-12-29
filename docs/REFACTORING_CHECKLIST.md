# Refactoring Validation Checklist

Use this checklist after completing any refactoring work to ensure no functionality is lost.

## Phase 1: Build Validation

- [ ] **Run dev server** - `npm run dev`
  - [ ] Check terminal output for ANY errors (not just new ones)
  - [ ] Look for `Failed to resolve import` messages
  - [ ] Look for `Cannot find module` messages
  - [ ] Verify server starts on expected port

- [ ] **Run production build** - `npm run build`
  - [ ] Build completes without errors
  - [ ] No import resolution failures
  - [ ] Check dist/ output exists

- [ ] **Run import checker** - `node scripts/check-imports.js`
  - [ ] All import paths resolve correctly
  - [ ] No broken file references

## Phase 2: Module Initialization Verification

Check that all initialization functions are called in the correct order:

### In `src/init/moduleInitialization.js`:

- [ ] `initAudio()` - FIRST, with await
- [ ] `initAudioContextKeepAlive()` - After audio init
- [ ] `initPresetUI()` - Feature modules section
- [ ] `initCircleOfFifths()` - Feature modules section
- [ ] `initGuitarFretboard()` - Feature modules section
- [ ] `initTheoryTools()` - Feature modules section
- [ ] `initTheoryMoments()` - Teaching system section
- [ ] `initTheoryOverlay()` - Teaching system section
- [ ] `initCompositionInsights()` - Teaching system section
- [ ] `initSongAnalyzer()` - Song analyzer section
- [ ] `initUnifiedSuggestionsPanel()` - UI components (delayed 200ms)
- [ ] `initWhyThisWorksPanel()` - UI components (delayed 200ms)
- [ ] `initWhyThisWorksEnhanced()` - UI components (delayed 200ms)
- [ ] `initChordFunctionLegend()` - UI components (delayed 200ms)
- [ ] `restoreAllPanelStates()` - Panel state section (delayed 100ms)
- [ ] `initAllSectionDragDrop()` - Section UI
- [ ] `initAllSectionSidebars()` - Section UI (delayed 200ms)
- [ ] Event listeners for compositionState events
- [ ] `initAutoSave()` - Storage system (delayed 500ms)
- [ ] `initVersionHistory()` - Storage system (delayed 500ms)
- [ ] `checkForRecovery()` - Storage system (delayed 500ms)
- [ ] `initExportService()` - Additional modules (delayed 100ms)
- [ ] `initInteractiveMelody()` - Additional modules (delayed 200ms)
- [ ] `initEnhancedNotation()` - Additional modules (delayed 250ms)
- [ ] `initLearnTab()` - Additional modules (delayed 300ms)
- [ ] `initMelodyComposerBridge()` - Additional modules (delayed 300ms)
- [ ] `initProgressionNotationSync()` - Additional modules (no delay)

### In `src/init/appSetup.js`:

- [ ] Tab switching system initialized
- [ ] Dark mode toggle initialized and state applied
- [ ] Saved global state restored (enharmonic, Roman numerals, etc.)
- [ ] Responsive page title setup
- [ ] Panel expand/collapse handlers setup

### In `src/init/globalEventHandlers.js`:

- [ ] Keyboard shortcuts (Alt+R, Alt+S, Ctrl+Z, Ctrl+Y, Tab, ?, 1-5, R, Escape)
- [ ] Click-outside handlers (FAB menu, help dropdown)
- [ ] Custom event listeners (applyGeneratedSection)

## Phase 3: Functional Testing

Test each major feature to ensure it still works:

### Chord Builder Tab
- [ ] Add chord to progression works
- [ ] Root note selection works
- [ ] Chord type buttons work
- [ ] Inversion toggles work
- [ ] Audio playback works
- [ ] Builder progression cards render

### Progression Builder Tab
- [ ] Progression cards display correctly
- [ ] Drag-and-drop reordering works
- [ ] Edit chord modal opens
- [ ] Delete chord works
- [ ] Play progression works
- [ ] Undo/Redo works

### Melody Composer Tab
- [ ] Notation displays correctly
- [ ] Note insertion works
- [ ] Note editing works
- [ ] Melody playback works
- [ ] Chord progression cards sync
- [ ] Suggestions panel works

### Teaching Features
- [ ] Theory Moments appear
- [ ] Theory Overlay displays
- [ ] Composition Insights panel works
- [ ] Why This Works panel works
- [ ] Chord Function Legend displays

### UI Features
- [ ] Tab switching works
- [ ] Dark mode toggle works and persists
- [ ] Panel collapse/expand works and persists
- [ ] Section drag-and-drop works
- [ ] Section sidebars work
- [ ] Floating Action Button (FAB) works

### Storage Features
- [ ] Auto-save triggers
- [ ] Crash recovery works
- [ ] Version history tracks changes
- [ ] Export works (MIDI, JSON, etc.)
- [ ] Import works

### Audio Features
- [ ] Piano keyboard works
- [ ] Chord playback works
- [ ] Melody playback works
- [ ] Metronome works
- [ ] Audio context resumes after tab switch

## Phase 4: Import Path Verification

Use grep to verify critical imports:

```bash
# Check for any imports from non-existent paths
grep -r "from '\.\./modules/storage/exportService" src/

# Should be: from '../modules/export/exportService.js'
grep -r "initExportService" src/

# Check dark mode import
grep -r "getIsDarkModeOn" src/init/

# Check all init function imports in moduleInitialization.js
grep "^import.*from.*init" src/init/moduleInitialization.js
```

## Phase 5: Console Error Check

- [ ] Open browser dev tools console
- [ ] Refresh page
- [ ] Check for JavaScript errors
- [ ] Check for failed network requests
- [ ] Test each tab - no errors on tab switch

## Phase 6: Git Diff Review

Before committing refactoring changes:

```bash
# Review all changes
git diff

# Look for:
# - Accidentally deleted init calls
# - Changed import paths
# - Removed function definitions
# - Modified timing (setTimeout values)
```

## Common Mistakes to Watch For

1. **Import path errors**
   - Wrong directory (storage vs export)
   - Wrong filename (lessonGuidedMode vs learnTabController)
   - Function exists in different file than expected

2. **Missing initialization calls**
   - Function imported but never called
   - Initialization called without proper delay
   - Initialization order wrong (audio not first)

3. **False success reports**
   - Claiming "build successful" without checking terminal output
   - Ignoring warning messages
   - Not testing actual functionality

4. **Timing issues**
   - setTimeout delays removed accidentally
   - Init functions called before dependencies ready
   - DOM queries before elements exist

## Automated Validation

Run these commands before committing refactoring work:

```bash
# 1. Check all imports resolve
node scripts/check-imports.js

# 2. Verify build succeeds
npm run build

# 3. Start dev server and check for errors
npm run dev
# (Check terminal output manually)
```

## Success Criteria

Refactoring is complete when:

1. ✅ `npm run build` completes with ZERO errors
2. ✅ `npm run dev` starts with ZERO errors
3. ✅ `node scripts/check-imports.js` passes
4. ✅ All functional tests pass
5. ✅ Browser console shows no errors
6. ✅ Git diff shows no accidental deletions
7. ✅ Every feature works exactly as before refactoring
