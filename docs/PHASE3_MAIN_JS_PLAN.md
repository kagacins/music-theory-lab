# Phase 3: main.js Refactoring Plan

**Created:** 2025-12-28
**Status:** Planning
**Target:** Split main.js (8,412 lines) → 5 focused modules

---

## 🎯 GOAL

Refactor main.js from a massive 8,412-line "catch-all" entry point into a clean modular structure that separates concerns while maintaining 100% backward compatibility with HTML event handlers.

**Success Criteria:**
- ✅ main.js reduced to <500 lines (minimal entry point)
- ✅ All window.* exports still work
- ✅ App initializes correctly
- ✅ Zero runtime errors
- ✅ Clear separation of concerns

---

## 📊 CURRENT STATE ANALYSIS

### File Structure (8,412 lines total)

**Lines 1-400:** Import statements (~400 lines)
- UI modules (tabs, modals, keyboard, header, sidebar)
- Feature modules (chordBuilder, progressionBuilder, scaleExplorer)
- Audio modules (audioEngine, arpeggiator)
- State modules (globalState, trainerState, builderState)
- Storage modules (projectManager, autoSave, versionHistory)
- Export modules (exportService)
- Teaching modules (theoryMoments, compositionInsights)
- Notation modules (melody generator, notation editor)

**Lines 400-7,500:** Window exports (~7,100 lines)
- Estimated 300+ `window.*` assignments
- Organized by module category
- Many with inline wrappers/adapters

**Lines 7,500-8,412:** DOMContentLoaded handler (~900 lines)
- App initialization sequence
- State restoration
- Panel state restoration
- Event listener registration
- Module initialization calls

---

## 🏗️ PROPOSED STRUCTURE

```
src/
├── main.js (400 lines)
│   - Minimal entry point
│   - Import init modules
│   - Call initialization sequence
│   - DOMContentLoaded handler
│
└── init/
    ├── windowExports.js (3,500 lines)
    │   - All window.* assignments
    │   - Organized by module category
    │   - Import all necessary functions
    │   - Export single setupWindowExports() function
    │
    ├── moduleInitialization.js (2,000 lines)
    │   - Module init calls (initAudio, initExportService, etc.)
    │   - State initialization
    │   - Panel state restoration
    │   - Export initializeModules() function
    │
    ├── globalEventHandlers.js (1,500 lines)
    │   - Document-level event listeners
    │   - Keyboard shortcuts
    │   - Global click handlers
    │   - Export setupGlobalEventHandlers() function
    │
    └── appSetup.js (1,000 lines)
        - Dark mode initialization
        - Load saved state
        - Set initial UI state
        - Responsive title setup
        - Export setupApp() function
```

---

## 🔄 MIGRATION STRATEGY

### Phase 3.1: Extract windowExports.js ✅ LOW RISK
**Estimated Lines:** ~3,500 lines

**Steps:**
1. Create `src/init/windowExports.js`
2. Copy all import statements needed for window exports
3. Move all `window.*` assignments into `setupWindowExports()` function
4. Keep existing organization (UI, Features, Audio, State, etc.)
5. Export `setupWindowExports()` function
6. Import and call from main.js before DOMContentLoaded

**Risk:** LOW - Just moving code, no logic changes

**Testing:**
- Verify all window.* exports still accessible
- Click HTML buttons to test onclick handlers
- Check browser console for undefined references

---

### Phase 3.2: Extract appSetup.js ✅ LOW RISK
**Estimated Lines:** ~1,000 lines

**Steps:**
1. Create `src/init/appSetup.js`
2. Extract dark mode initialization
3. Extract saved state loading
4. Extract initial UI state setup
5. Extract responsive title setup
6. Export `setupApp()` function
7. Call from main.js DOMContentLoaded handler

**Risk:** LOW - Independent initialization logic

**Testing:**
- Verify dark mode works
- Check saved state loads
- Confirm responsive title updates

---

### Phase 3.3: Extract moduleInitialization.js ⚠️ MEDIUM RISK
**Estimated Lines:** ~2,000 lines

**Steps:**
1. Create `src/init/moduleInitialization.js`
2. Extract all `init*` function calls:
   - `initAudio()`
   - `initExportService()`
   - `initAutoSave()`
   - `initVersionHistory()`
   - `initPresetUI()`
   - `initWhyThisWorksPanel()`
   - `initTheoryMoments()`
   - etc.
3. Extract panel state restoration
4. Extract state initialization
5. Export `initializeModules()` function
6. Call from main.js after appSetup

**Risk:** MEDIUM - Init order matters

**Testing:**
- Verify audio initializes
- Check all modules initialize
- Confirm panel states restore
- Test auto-save recovery

---

### Phase 3.4: Extract globalEventHandlers.js ⚠️ MEDIUM RISK
**Estimated Lines:** ~1,500 lines

**Steps:**
1. Create `src/init/globalEventHandlers.js`
2. Extract document-level event listeners
3. Extract keyboard shortcuts
4. Extract global click handlers
5. Export `setupGlobalEventHandlers()` function
6. Call from main.js after module initialization

**Risk:** MEDIUM - Event timing matters

**Testing:**
- Test keyboard shortcuts
- Verify click handlers work
- Check event propagation

---

### Phase 3.5: Slim Down main.js ✅ LOW RISK
**Estimated Lines:** ~400 lines remaining

**Steps:**
1. Keep minimal imports (only init modules)
2. Keep DOMContentLoaded handler (orchestration only)
3. Call init functions in correct order:
   ```javascript
   setupWindowExports();
   setupApp();
   initializeModules();
   setupGlobalEventHandlers();
   ```
4. Remove all moved code
5. Add clear comments for each phase

**Risk:** LOW - Just orchestration

**Testing:**
- Full regression test
- Verify app loads
- Test all major features

---

## ⚠️ CRITICAL DEPENDENCIES

### Window Exports Must Come First
**Why:** HTML onclick handlers expect window.* to exist immediately

**Order:**
1. `setupWindowExports()` - FIRST (before DOM ready)
2. `setupApp()` - UI initialization
3. `initializeModules()` - Feature initialization
4. `setupGlobalEventHandlers()` - Event registration

---

## 📋 TESTING CHECKLIST

After each phase:
- [ ] App loads without errors
- [ ] Window exports accessible
- [ ] HTML onclick handlers work
- [ ] Keyboard shortcuts work
- [ ] Audio initializes
- [ ] Panels restore state
- [ ] Dark mode works
- [ ] Auto-save/recovery works
- [ ] All tabs load correctly
- [ ] No console errors

---

## 🎯 EXECUTION PLAN

**Option A: All at Once (Risky)**
- Create all 4 init modules simultaneously
- Refactor main.js in single commit
- High risk of errors

**Option B: Incremental (Recommended - proven in Phases 1 & 2)**
- Extract one module at a time
- Test after each extraction
- Build confidence iteratively

**Recommended Sequence:**
1. Extract windowExports.js (lowest risk, highest value)
2. Extract appSetup.js (independent, low risk)
3. Extract moduleInitialization.js (medium risk, critical)
4. Extract globalEventHandlers.js (medium risk, timing-sensitive)
5. Slim down main.js (cleanup, low risk)

---

## 🚀 NEXT STEPS

1. Get user approval for this plan
2. Create `src/init/` directory
3. Start with Phase 3.1 (windowExports.js)
4. Test thoroughly after each phase
5. Update documentation when complete

---

**Estimated Timeline:**
- Phase 3.1: windowExports.js - 30 minutes
- Phase 3.2: appSetup.js - 20 minutes
- Phase 3.3: moduleInitialization.js - 45 minutes
- Phase 3.4: globalEventHandlers.js - 30 minutes
- Phase 3.5: Slim main.js - 15 minutes
- Testing: 30 minutes
- Documentation: 20 minutes

**Total: ~3 hours** (similar to Phases 1 & 2)

---

**Question for User:** Should we proceed with this incremental approach, or would you prefer a different strategy?
