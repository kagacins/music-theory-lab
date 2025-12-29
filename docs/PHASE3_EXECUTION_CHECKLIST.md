# Phase 3 Execution Checklist: main.js Refactoring

**Created:** 2025-12-28
**Status:** Ready for Execution
**Target:** Split main.js (8,412 lines, 386 window exports) → 5 focused modules

---

## 📋 PRE-EXECUTION CHECKLIST

### ✅ Completed Preparation
- ✅ Created `src/init/` directory
- ✅ Analyzed main.js structure (8,412 lines)
- ✅ Counted window exports (386 total)
- ✅ Identified import statements (~400 lines)
- ✅ Located window export section (lines 4415-7800)
- ✅ Located DOMContentLoaded handler (lines 7800-8412)
- ✅ Created PHASE3_MAIN_JS_PLAN.md with detailed strategy

### 📊 Key Metrics
- **Total Lines:** 8,412
- **Import Lines:** ~400 (lines 1-400)
- **Window Exports:** 386 assignments (~3,500 lines)
- **DOMContentLoaded:** ~900 lines
- **Target Reduction:** 8,412 → ~400 lines in main.js

---

## 🎯 EXECUTION PHASES

### Phase 3.1: Extract windowExports.js ⚠️ CRITICAL
**Priority:** HIGHEST (HTML onclick handlers depend on this)
**Estimated Lines:** ~3,500
**Risk:** LOW (just moving code, no logic changes)

#### Steps:
1. ✅ Create `src/init/windowExports.js`
2. ⏳ Copy ALL import statements needed for window exports from main.js
3. ⏳ Extract all 386 `window.*` assignments into `setupWindowExports()` function
4. ⏳ Organize by category (preserve existing comments):
   - UI functions (switchTab, showModal, etc.)
   - Builder functions
   - Trainer/Progression functions
   - Scale explorer functions
   - Audio functions
   - State getters/setters
   - Storage functions
   - Export functions
   - Teaching functions
   - Theory tools functions
5. ⏳ Export `setupWindowExports()` function
6. ⏳ Import and call in main.js BEFORE DOMContentLoaded
7. ⏳ Test: Verify all window.* exports accessible in console
8. ⏳ Test: Click HTML buttons to verify onclick handlers work

#### Critical Imports to Include:
```javascript
// All imports from lines 19-400 in main.js
import { switchTab, refreshAllTabs, ... } from './modules/ui/tabs.js';
import { showModal, hideModal, ... } from './modules/ui/modals.js';
// ... (copy ALL import statements)
```

#### Test Commands:
```javascript
// In browser console after page load:
console.log(typeof window.switchTab); // should be 'function'
console.log(typeof window.showModal); // should be 'function'
// Test a few HTML onclick handlers
```

---

### Phase 3.2: Extract appSetup.js ✅ LOW RISK
**Priority:** HIGH
**Estimated Lines:** ~1,000
**Risk:** LOW (independent initialization logic)

#### Steps:
1. ⏳ Create `src/init/appSetup.js`
2. ⏳ Extract dark mode initialization
3. ⏳ Extract saved state loading
4. ⏳ Extract initial UI state setup
5. ⏳ Extract responsive title setup
6. ⏳ Export `setupApp()` function
7. ⏳ Import and call from main.js DOMContentLoaded (after windowExports)
8. ⏳ Test: Verify dark mode persists
9. ⏳ Test: Verify saved state loads correctly

#### Functions to Extract:
- Dark mode toggle handler
- LocalStorage state restoration
- Initial panel visibility
- Responsive title configuration
- Any other startup UI configuration

---

### Phase 3.3: Extract moduleInitialization.js ⚠️ MEDIUM RISK
**Priority:** MEDIUM
**Estimated Lines:** ~2,000
**Risk:** MEDIUM (initialization order matters!)

#### Steps:
1. ⏳ Create `src/init/moduleInitialization.js`
2. ⏳ Extract all `init*()` function calls in CORRECT ORDER:
   ```javascript
   // Critical: Audio must be first
   await initAudio();

   // Then other modules
   initExportService();
   initAutoSave();
   initVersionHistory();
   initPresetUI();
   initWhyThisWorksPanel();
   initTheoryMoments();
   initWhyThisWorksEnhanced();
   initTheoryOverlay();
   initCompositionInsights();
   initCircleOfFifths();
   initGuitarFretboard();
   initTheoryTools();
   initUnifiedSuggestionsPanel();
   initLearnTab();
   initTabHistory();
   // ... etc
   ```
3. ⏳ Extract panel state restoration calls:
   ```javascript
   restoreAllPanelStates();
   restoreSettingsGroupStates();
   restoreHeaderDisplaysState();
   restoreTabPanelStates('trainer');
   // ... etc
   ```
4. ⏳ Export `initializeModules()` async function
5. ⏳ Import and call from main.js (after appSetup)
6. ⏳ Test: Verify audio initializes
7. ⏳ Test: Verify all panels restore state
8. ⏳ Test: Verify auto-save recovery works

#### ⚠️ CRITICAL: Initialization Order
```javascript
// MUST BE IN THIS ORDER:
1. setupWindowExports() - FIRST (HTML needs window.*)
2. setupApp() - UI initialization
3. await initializeModules() - Module initialization (audio FIRST)
4. setupGlobalEventHandlers() - Event registration
```

---

### Phase 3.4: Extract globalEventHandlers.js ⚠️ MEDIUM RISK
**Priority:** MEDIUM
**Estimated Lines:** ~1,500
**Risk:** MEDIUM (event timing matters)

#### Steps:
1. ⏳ Create `src/init/globalEventHandlers.js`
2. ⏳ Extract all document-level event listeners:
   - Keyboard shortcuts (Alt+R, Alt+S, etc.)
   - Click handlers
   - Resize handlers
   - Any other global DOM event listeners
3. ⏳ Extract helper functions used by event handlers:
   - `refreshDragDrop()`
   - `shockDragDrop()`
   - Any other event-related helpers
4. ⏳ Export `setupGlobalEventHandlers()` function
5. ⏳ Import and call from main.js (AFTER module initialization)
6. ⏳ Test: Verify keyboard shortcuts work (Alt+R, Alt+S)
7. ⏳ Test: Verify global click handlers work

#### Event Listeners to Extract:
```javascript
// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'r') refreshDragDrop();
    if (e.altKey && e.key === 's') shockDragDrop();
});

// ... any other document-level listeners
```

---

### Phase 3.5: Slim Down main.js ✅ LOW RISK
**Priority:** FINAL
**Estimated Lines:** ~400 remaining
**Risk:** LOW (just orchestration)

#### Steps:
1. ⏳ Remove all moved code from main.js
2. ⏳ Keep only minimal imports:
   ```javascript
   import { setupWindowExports } from './init/windowExports.js';
   import { setupApp } from './init/appSetup.js';
   import { initializeModules } from './init/moduleInitialization.js';
   import { setupGlobalEventHandlers } from './init/globalEventHandlers.js';
   ```
3. ⏳ Keep Google Search API config (lines 15-16)
4. ⏳ Keep DOMContentLoaded handler with orchestration ONLY:
   ```javascript
   document.addEventListener('DOMContentLoaded', async () => {
       // 1. Setup window exports (FIRST - HTML needs them)
       setupWindowExports();

       // 2. Setup app (dark mode, saved state)
       setupApp();

       // 3. Initialize modules (audio FIRST)
       await initializeModules();

       // 4. Setup global event handlers (LAST)
       setupGlobalEventHandlers();

       console.log('✅ App initialized successfully');
   });
   ```
5. ⏳ Add clear section comments
6. ⏳ Verify final line count < 500 lines

---

## ✅ POST-EXECUTION TESTING

### Critical Tests (MUST PASS):
- [ ] App loads without errors
- [ ] All tabs switch correctly
- [ ] Chord Builder works
- [ ] Progression Builder works
- [ ] Scale Explorer works
- [ ] Melody Composer works
- [ ] Audio playback works
- [ ] Keyboard shortcuts work (Alt+R, Alt+S)
- [ ] HTML onclick buttons work
- [ ] Dark mode toggles and persists
- [ ] Auto-save/recovery works
- [ ] All panels restore state
- [ ] No console errors on page load
- [ ] No "undefined" errors when clicking UI elements

### Browser Console Checks:
```javascript
// All should return 'function':
typeof window.switchTab
typeof window.showModal
typeof window.addChordToProgression
typeof window.renderProgressionDisplay
typeof window.playMelody
// ... test ~10-20 key window exports
```

---

## 📊 FINAL METRICS TARGET

**Before:**
```
main.js: 8,412 lines
├── Imports: ~400 lines
├── Window Exports: ~3,500 lines (386 assignments)
├── Init Logic: ~2,000 lines
├── Event Handlers: ~1,500 lines
└── DOMContentLoaded: ~900 lines
```

**After:**
```
main.js: ~400 lines
├── Google API config: 2 lines
├── Imports: ~10 lines (init modules only)
└── DOMContentLoaded orchestration: ~20 lines

init/windowExports.js: ~3,500 lines
├── All imports: ~400 lines
└── setupWindowExports(): ~3,100 lines

init/appSetup.js: ~1,000 lines
└── setupApp(): ~1,000 lines

init/moduleInitialization.js: ~2,000 lines
└── initializeModules(): ~2,000 lines

init/globalEventHandlers.js: ~1,500 lines
└── setupGlobalEventHandlers(): ~1,500 lines
```

**Total Code:** Still ~8,400 lines (no deletion, just organization)
**Maintainability:** VASTLY IMPROVED ✨

---

## 🚨 COMMON PITFALLS TO AVOID

### 1. Window Export Order
❌ DON'T: Call `setupWindowExports()` inside DOMContentLoaded
✅ DO: Call `setupWindowExports()` BEFORE DOMContentLoaded

**Why:** HTML may try to call window.* functions before DOM is ready

### 2. Initialization Order
❌ DON'T: Initialize modules before window exports are set
✅ DO: Follow strict order: exports → app setup → module init → events

### 3. Missing Imports
❌ DON'T: Forget to copy imports when extracting functions
✅ DO: Copy ALL necessary imports to each init module

### 4. Async/Await
❌ DON'T: Forget `await` on `initAudio()` and `initializeModules()`
✅ DO: Use `await` for async initialization

### 5. Testing
❌ DON'T: Skip testing after each phase
✅ DO: Test thoroughly after each extraction

---

## 📝 EXECUTION LOG (Fill in during execution)

### Phase 3.1: windowExports.js
- **Started:** _____
- **Completed:** _____
- **Issues:** _____
- **Tests Passed:** ☐ Yes ☐ No

### Phase 3.2: appSetup.js
- **Started:** _____
- **Completed:** _____
- **Issues:** _____
- **Tests Passed:** ☐ Yes ☐ No

### Phase 3.3: moduleInitialization.js
- **Started:** _____
- **Completed:** _____
- **Issues:** _____
- **Tests Passed:** ☐ Yes ☐ No

### Phase 3.4: globalEventHandlers.js
- **Started:** _____
- **Completed:** _____
- **Issues:** _____
- **Tests Passed:** ☐ Yes ☐ No

### Phase 3.5: Slim main.js
- **Started:** _____
- **Completed:** _____
- **Issues:** _____
- **Tests Passed:** ☐ Yes ☐ No

---

## 🎯 SUCCESS CRITERIA

Phase 3 is considered COMPLETE when:
- ✅ main.js reduced to < 500 lines
- ✅ All 386 window exports still work
- ✅ All HTML onclick handlers work
- ✅ App initializes with zero errors
- ✅ All critical tests pass
- ✅ Build succeeds with zero errors
- ✅ Documentation updated (MODULE_INDEX, REFACTORING_PLAN, REFACTORING_TRACKING)

---

**Ready for Execution:** YES ✅
**Next Session:** Execute phases 3.1 through 3.5 incrementally with testing between each
